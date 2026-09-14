/**
 * POST /api/round2/submit
 *
 * §14 — inference runs in the browser AFTER the student submits, so the
 * predictions arrive here already computed. The score is calculated server-side
 * from the reported confidence and is never returned (§22); the student sees
 * the predictions, not the points.
 */
import { createAdminSupabase } from '@/lib/supabase/server';
import { round2SubmitSchema } from '@/lib/validation';
import { ok, fail, messageFor, refCode } from '@/lib/api/respond';
import { requireOwnedAttempt, loadSettings } from '@/lib/api/attempt';
import { scoreRound2 } from '@/lib/scoring';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('SERVER_ERROR', messageFor('SERVER_ERROR'), 400);
  }

  const parsed = round2SubmitSchema.safeParse(body);
  if (!parsed.success) return fail('SERVER_ERROR', messageFor('SERVER_ERROR'), 400);

  const { attemptId, targetConfidence, topPredictions, drawTimeMs, bitmap28 } = parsed.data;

  const guard = await requireOwnedAttempt(attemptId);
  if (!guard.ok) return fail(guard.code, messageFor(guard.code), guard.status);
  if (guard.attempt.status !== 'in_progress') {
    return fail('ALREADY_COMPLETED', messageFor('ALREADY_COMPLETED'), 409);
  }

  const admin = createAdminSupabase();

  const { data: existing } = await admin
    .from('attempt_round2')
    .select('submitted_at')
    .eq('attempt_id', attemptId)
    .single();

  if (existing?.submitted_at) return ok({ locked: true, alreadyAnswered: true });

  const settings = await loadSettings();
  const result = scoreRound2(
    { targetConfidence, drawTimeMs },
    {
      recognitionThreshold: settings.round2RecognitionThreshold,
      speedBonusMax: settings.round2SpeedBonusMax,
      drawTimeMs: settings.round2DrawMs,
    },
  );

  // Only an unsubmitted row is written, so a retry racing the original request
  // cannot score the drawing twice.
  const { data: written, error: writeError } = await admin
    .from('attempt_round2')
    .update({
      recognized: result.recognized,
      target_confidence: targetConfidence,
      top_predictions: topPredictions,
      draw_time_ms: drawTimeMs,
      points: result.points,
      bitmap28: bitmap28 ? Buffer.from(bitmap28, 'base64') : null,
      submitted_at: new Date().toISOString(),
    })
    .eq('attempt_id', attemptId)
    .is('submitted_at', null)
    .select('attempt_id');

  if (writeError) {
    const ref = refCode();
    await admin.from('app_events').insert({
      event: 'round2_submit_failed',
      ref_code: ref,
      user_id: guard.userId,
      details: { attempt_id: attemptId },
    });
    return fail('SERVER_ERROR', messageFor('SERVER_ERROR'), 500, ref);
  }

  if (!written || written.length === 0) return ok({ locked: true, alreadyAnswered: true });

  await admin.from('attempts').update({ current_round: 3 }).eq('id', attemptId);

  return ok({ locked: true, recognized: result.recognized });
}
