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

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) return ok({ signedIn: false });

  const admin = createAdminSupabase();

  const [{ data: profile }, { data: attempt }] = await Promise.all([
    admin.from('profiles').select('full_name').eq('id', auth.user.id).maybeSingle(),
    admin
      .from('attempts')
      .select('status')
      .eq('user_id', auth.user.id)
      .neq('status', 'invalidated')
      .maybeSingle(),
  ]);

  return ok({
    signedIn: true,
    needsProfile: !profile || profile.full_name === 'Pending',
    attemptStatus: attempt?.status ?? 'not_started',
  });
}
