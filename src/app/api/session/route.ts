/**
 * GET /api/session
 *
 * Lets a returning browser skip straight past sign-in. A student who refreshes
 * mid-round, or whose phone locks and reopens the tab, must not be asked for a
 * new verification code — at a busy booth that is the difference between
 * finishing and giving up.
 */
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server';
import { ok } from '@/lib/api/respond';
import { computeDisplayName } from '@/lib/avatars';

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) return ok({ signedIn: false });

  const admin = createAdminSupabase();

  const [{ data: profile }, { data: attempt }, { data: avatarEvent }] = await Promise.all([
    admin.from('profiles').select('id, full_name, student_id').eq('id', auth.user.id).maybeSingle(),
    admin
      .from('attempts')
      .select('status')
      .eq('user_id', auth.user.id)
      .neq('status', 'invalidated')
      .maybeSingle(),
    admin
      .from('app_events')
      .select('details')
      .eq('user_id', auth.user.id)
      .eq('event', 'avatar_selected')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const fullName = profile?.full_name && profile.full_name !== 'Pending' ? profile.full_name : null;
  const displayName = computeDisplayName(fullName);
  const maskedIdSuffix = profile?.student_id ? profile.student_id.slice(-4) : null;
  const avatarDetails = avatarEvent?.details as { avatarId?: string; gender?: 'Male' | 'Female' } | undefined;

  return ok({
    signedIn: true,
    userId: auth.user.id,
    fullName,
    displayName,
    maskedIdSuffix,
    avatarId: avatarDetails?.avatarId ?? null,
    gender: avatarDetails?.gender ?? null,
    needsProfile: !profile || profile.full_name === 'Pending',
    attemptStatus: attempt?.status ?? 'not_started',
  });
}
