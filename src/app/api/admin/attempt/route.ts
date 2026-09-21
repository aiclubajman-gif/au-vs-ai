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

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return fail('UNAUTHORIZED', messageFor('UNAUTHORIZED'), 403);

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const admin = createAdminSupabase();

  let attemptsData: Array<{
    id: string;
    status: string;
    total_score: number | null;
    valid_for_prize: boolean;
    started_at: string;
    user_id: string;
    is_test: boolean;
  }> = [];

  if (!q) {
    const { data } = await admin
      .from('attempts')
      .select('id, status, total_score, valid_for_prize, started_at, user_id, is_test')
      .order('started_at', { ascending: false })
      .limit(60);
    attemptsData = data ?? [];
  } else {
    // 1. Search profiles matching name or student_id
    const { data: matchedProfiles } = await admin
      .from('profiles')
      .select('id')
      .or(`full_name.ilike.%${q}%,student_id.ilike.%${q}%`)
      .limit(50);

    const userIds = (matchedProfiles ?? []).map((p) => p.id);

    if (userIds.length > 0) {
      const { data } = await admin
        .from('attempts')
        .select('id, status, total_score, valid_for_prize, started_at, user_id, is_test')
        .or(`user_id.in.(${userIds.join(',')}),id.ilike.%${q}%`)
        .order('started_at', { ascending: false })
        .limit(60);
      attemptsData = data ?? [];
    } else {
      const { data } = await admin
        .from('attempts')
        .select('id, status, total_score, valid_for_prize, started_at, user_id, is_test')
        .ilike('id', `%${q}%`)
        .order('started_at', { ascending: false })
        .limit(60);
      attemptsData = data ?? [];
    }
  }

  const allUserIds = [...new Set(attemptsData.map((a) => a.user_id))];
  const { data: allProfiles } = allUserIds.length
    ? await admin.from('profiles').select('id, full_name, student_id').in('id', allUserIds)
    : { data: [] };

  const profileMap = new Map((allProfiles ?? []).map((p) => [p.id, p]));

  const rows = attemptsData.map((r) => {
    const p = profileMap.get(r.user_id);
    return {
      id: r.id,
      name: p?.full_name ?? 'Unknown',
      maskedId: (p?.student_id ?? '').slice(-4),
      status: r.status,
      totalScore: r.total_score,
      validForPrize: r.valid_for_prize,
      startedAt: r.started_at,
    };
  });

  return ok({ attempts: rows });
}

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
