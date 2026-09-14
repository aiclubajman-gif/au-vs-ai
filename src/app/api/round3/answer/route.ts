/**
 * POST /api/round3/answer
 *
 * §21 — returns nothing about the answer, the error, or the points. Every
 * student gets the SAME question, so any feedback at all would propagate
 * through the queue within minutes.
 */
import { createAdminSupabase } from '@/lib/supabase/server';
import { round3SubmitSchema } from '@/lib/validation';
import { ok, fail, messageFor, refCode } from '@/lib/api/respond';
import { requireOwnedAttempt, loadSettings } from '@/lib/api/attempt';
import { scoreRound3, clampGuessToRange, round3AbsError } from '@/lib/scoring';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('SERVER_ERROR', messageFor('SERVER_ERROR'), 400);
  }

  const parsed = round3SubmitSchema.safeParse(body);
  if (!parsed.success) return fail('SERVER_ERROR', messageFor('SERVER_ERROR'), 400);

  const { attemptId, guess } = parsed.data;

  const guard = await requireOwnedAttempt(attemptId);
  if (!guard.ok) return fail(guard.code, messageFor(guard.code), guard.status);
  if (guard.attempt.status !== 'in_progress') {
    return fail('ALREADY_COMPLETED', messageFor('ALREADY_COMPLETED'), 409);
  }

  const admin = createAdminSupabase();

  const { data: existing } = await admin
    .from('attempt_round3')
    .select('answered_at')
    .eq('attempt_id', attemptId)
    .single();

  if (existing?.answered_at) return ok({ locked: true, alreadyAnswered: true });

  const { data: question } = await admin
    .from('round3_question')
    .select('correct_answer, min_value, max_value')
    .eq('id', guard.attempt.round3_question_id)
    .maybeSingle();

  if (!question) return fail('NO_ROUND3_QUESTION', messageFor('NO_ROUND3_QUESTION'), 500);

  const settings = await loadSettings();

  const correctAnswer = Number(question.correct_answer);
  const safeGuess = clampGuessToRange(
    guess,
    Number(question.min_value),
    Number(question.max_value),
  );

  const points = scoreRound3(safeGuess, {
    correctAnswer,
    tolerance: settings.round3ScoringTolerance,
    toleranceExponent: settings.round3ToleranceExponent,
  });

  // Only an unanswered row is written, so a retry racing the original request
  // cannot replace the guess or score it twice.
  const { data: written, error: writeError } = await admin
    .from('attempt_round3')
    .update({
      guess: safeGuess,
      abs_error: round3AbsError(safeGuess, correctAnswer),
      points,
      answered_at: new Date().toISOString(),
    })
    .eq('attempt_id', attemptId)
    .is('answered_at', null)
    .select('attempt_id');

  if (writeError) {
    const ref = refCode();
    await admin.from('app_events').insert({
      event: 'round3_answer_failed',
      ref_code: ref,
      user_id: guard.userId,
      details: { attempt_id: attemptId },
    });
    return fail('SERVER_ERROR', messageFor('SERVER_ERROR'), 500, ref);
  }

  if (!written || written.length === 0) return ok({ locked: true, alreadyAnswered: true });

  await admin.from('attempts').update({ current_round: 4 }).eq('id', attemptId);

  return ok({ locked: true });
}
