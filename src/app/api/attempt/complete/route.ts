/**
 * POST /api/attempt/complete
 *
 * Hands off to complete_attempt(), which recomputes the total from stored
 * round rows inside a single locked transaction. The browser's idea of the
 * score is never consulted (§9).
 *
 * Safe to call repeatedly: a retry on a flaky connection returns the existing
 * result rather than rescoring (§40).
 */
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server';
import { ok, fail, messageFor, codeFromPgError, refCode } from '@/lib/api/respond';

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail('UNAUTHORIZED', messageFor('UNAUTHORIZED'), 401);

  let body: { attemptId?: string };
  try {
    body = await req.json();
  } catch {
    return fail('SERVER_ERROR', messageFor('SERVER_ERROR'), 400);
  }

  if (!body.attemptId) return fail('ATTEMPT_NOT_FOUND', messageFor('ATTEMPT_NOT_FOUND'), 400);

  const admin = createAdminSupabase();
  const { data, error } = await admin.rpc('complete_attempt', {
    p_attempt_id: body.attemptId,
    p_user_id: auth.user.id,
  });

  if (error) {
    const code = codeFromPgError(error);
    const ref = refCode();
    await admin.from('app_events').insert({
      event: 'attempt_complete_failed',
      ref_code: ref,
      user_id: auth.user.id,
      details: { code, attempt_id: body.attemptId },
    });
    return fail(code, messageFor(code), 500, ref);
  }

  return ok(data);
}
