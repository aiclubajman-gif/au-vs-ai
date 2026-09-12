/**
 * POST /api/profile — save name and optional college (§4, §6).
 * Runs before the device check and before any attempt exists.
 */
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server';
import { profileSetupSchema } from '@/lib/validation';
import { ok, fail, messageFor } from '@/lib/api/respond';

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) return fail('UNAUTHORIZED', messageFor('UNAUTHORIZED'), 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('SERVER_ERROR', messageFor('SERVER_ERROR'), 400);
  }

  const parsed = profileSetupSchema.safeParse(body);
  if (!parsed.success) {
    return fail('VALIDATION', parsed.error.issues[0]?.message ?? 'Check your details.', 400);
  }

  const admin = createAdminSupabase();
  const { error } = await admin
    .from('profiles')
    .update({
      full_name: parsed.data.fullName,
      college_id: parsed.data.collegeId ?? null,
    })
    .eq('id', auth.user.id);

  if (error) return fail('SERVER_ERROR', messageFor('SERVER_ERROR'), 500);

  return ok({ saved: true });
}
