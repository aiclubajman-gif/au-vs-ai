import 'server-only';

import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server';

/**
 * Admin authorization (§30, §39).
 *
 * Checked server-side on EVERY admin request against the `admins` table. There
 * is no client-side flag, no env-var shortcut, and no way to grant yourself
 * access through the UI. Hiding buttons is not access control.
 */
export type AdminCheck =
  | { ok: true; userId: string; email: string; canRaffle: boolean }
  | { ok: false };

export async function requireAdmin(): Promise<AdminCheck> {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };

  const admin = createAdminSupabase();
  const { data } = await admin
    .from('admins')
    .select('email, can_raffle')
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (!data) return { ok: false };

  return {
    ok: true,
    userId: auth.user.id,
    email: data.email,
    canRaffle: data.can_raffle,
  };
}

/** Every admin action is recorded with who did it (§48). */
export async function logAdminAction(
  adminId: string,
  adminEmail: string,
  action: string,
  targetType?: string,
  targetId?: string,
  details?: Record<string, unknown>,
) {
  const admin = createAdminSupabase();
  await admin.from('admin_actions').insert({
    admin_id: adminId,
    admin_email: adminEmail,
    action,
    target_type: targetType ?? null,
    target_id: targetId ?? null,
    details: details ?? null,
  });
}
