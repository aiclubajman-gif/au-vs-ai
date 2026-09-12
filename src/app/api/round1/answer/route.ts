/**
 * POST /api/round1/answer
 *
 * §11 — the response deliberately does NOT say whether the answer was right.
 * Students stand next to friends; revealing correctness would let the first
 * player in a group leak the whole image bank. The server records the result
 * privately and the client shows a neutral "Answer locked".
 */
import { createAdminSupabase } from '@/lib/supabase/server';
import { round1SubmitSchema } from '@/lib/validation';
import { ok, fail, messageFor } from '@/lib/api/respond';
import { requireOwnedAttempt } from '@/lib/api/attempt';
import { scoreRound1Slot, ROUND1_SLOTS } from '@/lib/scoring';

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
    .select('slot, image_id, selected_answer')
    .eq('attempt_id', attemptId)
    .eq('slot', slot)
    .maybeSingle();

  if (!slotRow) return fail('ATTEMPT_NOT_FOUND', messageFor('ATTEMPT_NOT_FOUND'), 404);

  // Idempotent: a retry after a dropped connection must not re-score, and a
  // refresh must not let a student change an answer they already gave.
  if (slotRow.selected_answer !== null) {
    return ok({ locked: true, alreadyAnswered: true });
  }

  // The correct label is read here on the server and never sent anywhere.
  const { data: image } = await admin
    .from('round1_images')
    .select('label')
    .eq('id', slotRow.image_id)
    .maybeSingle();

  // An image deactivated or deleted mid-event would otherwise crash the round.
  if (!image) return fail('SERVER_ERROR', messageFor('SERVER_ERROR'), 500);

  const correct = image.label === selectedAnswer;
  const points = scoreRound1Slot(slot, correct);

  await admin
    .from('attempt_round1')
    .update({
      selected_answer: selectedAnswer,
      correct,
      points,
      response_time_ms: responseTimeMs,
      answered_at: new Date().toISOString(),
    })
    .eq('attempt_id', attemptId)
    .eq('slot', slot);

  // Difficulty stats for the admin dashboard, not shown publicly during play.
  await admin.rpc('bump_image_stats', { p_image_id: slotRow.image_id, p_correct: correct });

  const { count } = await admin
    .from('attempt_round1')
    .select('slot', { count: 'exact', head: true })
    .eq('attempt_id', attemptId)
    .not('selected_answer', 'is', null);

  const roundComplete = (count ?? 0) >= ROUND1_SLOTS;
  if (roundComplete) {
    await admin.from('attempts').update({ current_round: 2 }).eq('id', attemptId);
  }

  return ok({ locked: true, roundComplete });
}
