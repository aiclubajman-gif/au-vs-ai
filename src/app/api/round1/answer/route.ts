/**
 * POST /api/round1/answer
 *
 * §11 — the response deliberately does NOT say whether the answer was right.
 * Students stand next to friends; revealing correctness would let the first
 * player in a group leak the whole image bank. The server records the result
 * privately and the client shows a neutral "Answer locked".
 *
 * Only correctness is recorded per image. The Round 1 score is calculated once,
 * in complete_attempt(), from correct answers over images assigned.
 */
import { createAdminSupabase } from '@/lib/supabase/server';
import { round1SubmitSchema } from '@/lib/validation';
import { ok, fail, messageFor, refCode } from '@/lib/api/respond';
import { requireOwnedAttempt } from '@/lib/api/attempt';
import { isRound1Correct } from '@/lib/scoring';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('SERVER_ERROR', messageFor('SERVER_ERROR'), 400);
  }

  const parsed = round1SubmitSchema.safeParse(body);
  if (!parsed.success) return fail('SERVER_ERROR', messageFor('SERVER_ERROR'), 400);

  const { attemptId, slot, selectedAnswer, responseTimeMs } = parsed.data;

  const guard = await requireOwnedAttempt(attemptId);
  if (!guard.ok) return fail(guard.code, messageFor(guard.code), guard.status);
  if (guard.attempt.status !== 'in_progress') {
    return fail('ALREADY_COMPLETED', messageFor('ALREADY_COMPLETED'), 409);
  }

  const admin = createAdminSupabase();

  const { data: slotRow } = await admin
    .from('attempt_round1')
    .select('slot, image_id, answered_at')
    .eq('attempt_id', attemptId)
    .eq('slot', slot)
    .maybeSingle();

  if (!slotRow) return fail('ATTEMPT_NOT_FOUND', messageFor('ATTEMPT_NOT_FOUND'), 404);

  // Idempotent: a retry after a dropped connection must not re-score, and a
  // refresh must not let a student change an answer they already gave.
  // answered_at, not selected_answer, is the submission marker, because a
  // timeout is recorded with no selection at all.
  if (slotRow.answered_at !== null) {
    return ok({ locked: true, alreadyAnswered: true });
  }

  let correct = false;

  if (selectedAnswer !== null) {
    // The correct label is read here on the server and never sent anywhere.
    const { data: image } = await admin
      .from('round1_images')
      .select('label')
      .eq('id', slotRow.image_id)
      .maybeSingle();

    // An image deactivated or deleted mid-event would otherwise crash the round.
    if (!image) return fail('SERVER_ERROR', messageFor('SERVER_ERROR'), 500);

    correct = isRound1Correct(selectedAnswer, image.label);
  }

  // Only an unanswered slot is written, so two copies of the same request
  // racing each other cannot both score.
  const { data: written, error: writeError } = await admin
    .from('attempt_round1')
    .update({
      selected_answer: selectedAnswer,
      correct,
      response_time_ms: responseTimeMs,
      answered_at: new Date().toISOString(),
    })
    .eq('attempt_id', attemptId)
    .eq('slot', slot)
    .is('answered_at', null)
    .select('slot');

  if (writeError) {
    const ref = refCode();
    await admin.from('app_events').insert({
      event: 'round1_answer_failed',
      ref_code: ref,
      user_id: guard.userId,
      details: { attempt_id: attemptId, slot },
    });
    return fail('SERVER_ERROR', messageFor('SERVER_ERROR'), 500, ref);
  }

  if (!written || written.length === 0) {
    return ok({ locked: true, alreadyAnswered: true });
  }

  // Difficulty stats for the admin dashboard, not shown publicly during play.
  // A timeout is not an answer, so it does not count towards an image's stats.
  if (selectedAnswer !== null) {
    await admin.rpc('bump_image_stats', { p_image_id: slotRow.image_id, p_correct: correct });
  }

  // Complete when every image THIS attempt was assigned has been answered.
  // The rows are the assignment, so 8- and 10-image games need no constant.
  const { data: slots } = await admin
    .from('attempt_round1')
    .select('answered_at')
    .eq('attempt_id', attemptId);

  const assigned = slots?.length ?? 0;
  const answered = (slots ?? []).filter((s) => s.answered_at !== null).length;
  const roundComplete = assigned > 0 && answered >= assigned;
  if (roundComplete) {
    await admin.from('attempts').update({ current_round: 2 }).eq('id', attemptId);
  }

  return ok({ locked: true, roundComplete });
}
