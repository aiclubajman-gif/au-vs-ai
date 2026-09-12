/**
 * POST /api/attempt/result — re-read a finished result (e.g. after a refresh
 * on the result screen). Returns total, rank, human/AI and percentile only.
 */
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server';
import { ok, fail, messageFor, codeFromPgError } from '@/lib/api/respond';

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

  const admin = createAdminSupabase();

  // The caller may omit attemptId — a student reopening the link knows their
  // session but not their attempt id. Resolve it from the authenticated user,
  // which also means one student can never read another's result.
  let attemptId = body.attemptId;
  if (!attemptId) {
    const { data: own } = await admin
      .from('attempts')
      .select('id')
      .eq('user_id', auth.user.id)
      .eq('status', 'completed')
      .maybeSingle();
    if (!own) return fail('ATTEMPT_NOT_FOUND', messageFor('ATTEMPT_NOT_FOUND'), 404);
    attemptId = own.id;
  }

  const { data, error } = await admin.rpc('get_attempt_result_public', {
    p_attempt_id: attemptId,
    p_user_id: auth.user.id,
  });

  if (error) {
    const code = codeFromPgError(error);
    return fail(code, messageFor(code), 404);
  }

  return ok(data);
}
