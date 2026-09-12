/**
 * POST /api/admin/attempt — reset or invalidate an attempt (§30, §47).
 *
 * Reset marks the old attempt 'invalidated' rather than deleting it. The
 * one-attempt unique index excludes invalidated rows, so the student can play
 * again, and the original remains for audit. Deleting would destroy the record
 * of what went wrong.
 */
import { createAdminSupabase } from '@/lib/supabase/server';
import { requireAdmin, logAdminAction } from '@/lib/api/admin-guard';
import { ok, fail, messageFor } from '@/lib/api/respond';

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return fail('UNAUTHORIZED', messageFor('UNAUTHORIZED'), 403);

  let body: { attemptId?: string; action?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return fail('SERVER_ERROR', messageFor('SERVER_ERROR'), 400);
  }

  const { attemptId, action, reason } = body;
  if (!attemptId || !action) {
    return fail('SERVER_ERROR', messageFor('SERVER_ERROR'), 400);
  }

  const admin = createAdminSupabase();

  if (action === 'reset' || action === 'invalidate') {
    const { error } = await admin
      .from('attempts')
      .update({
        status: 'invalidated',
        valid_for_prize: false,
        invalid_reason: reason ?? (action === 'reset' ? 'admin reset' : 'admin invalidated'),
      })
      .eq('id', attemptId);

    if (error) return fail('SERVER_ERROR', error.message, 500);

    await logAdminAction(auth.userId, auth.email, action, 'attempt', attemptId, { reason });
    return ok({ done: true, action });
  }

  if (action === 'toggle_prize') {
    const { data: current } = await admin
      .from('attempts')
      .select('valid_for_prize')
      .eq('id', attemptId)
      .maybeSingle();

    if (!current) return fail('ATTEMPT_NOT_FOUND', messageFor('ATTEMPT_NOT_FOUND'), 404);

    const next = !current.valid_for_prize;
    await admin.from('attempts').update({ valid_for_prize: next }).eq('id', attemptId);
    await logAdminAction(auth.userId, auth.email, 'toggle_prize', 'attempt', attemptId, {
      valid_for_prize: next,
    });
    return ok({ done: true, validForPrize: next });
  }

  return fail('SERVER_ERROR', 'Unknown action.', 400);
}
