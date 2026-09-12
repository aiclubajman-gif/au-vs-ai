/**
 * POST /api/attempt/start
 *
 * Thin wrapper over start_attempt(). All the fairness logic lives in the
 * database function so it stays atomic (§7).
 *
 * §8: the client must confirm the drawing model loaded and passed a hidden
 * test inference BEFORE this is called. If it did not, we refuse to create the
 * attempt so the student does not burn their one game on a device that cannot
 * finish it.
 */
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server';
import { ok, fail, messageFor, codeFromPgError, refCode } from '@/lib/api/respond';
import { toAssignment } from '@/lib/api/serialize';

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) return fail('UNAUTHORIZED', messageFor('UNAUTHORIZED'), 401);

  let body: { modelReady?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional on resume.
  }

  const admin = createAdminSupabase();

  // Does an attempt already exist? Resume never requires the model check,
  // because the student already passed it when the attempt was created.
  const { data: existing } = await admin
    .from('attempts')
    .select('id')
    .eq('user_id', auth.user.id)
    .neq('status', 'invalidated')
    .maybeSingle();

  if (!existing && body.modelReady !== true) {
    return fail('MODEL_UNAVAILABLE', messageFor('MODEL_UNAVAILABLE'), 409);
  }

  const { data, error } = await admin.rpc('start_attempt', { p_user_id: auth.user.id });

  if (error) {
    const code = codeFromPgError(error);
    const ref = refCode();
    await admin.from('app_events').insert({
      event: 'attempt_start_failed',
      ref_code: ref,
      user_id: auth.user.id,
      details: { code },
    });
    return fail(code, messageFor(code), code === 'SERVER_ERROR' ? 500 : 409, ref);
  }

  // Normalised to camelCase here so the browser never has to know that
  // Postgres speaks snake_case.
  return ok(toAssignment(data));
}
