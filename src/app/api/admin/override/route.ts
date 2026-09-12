/**
 * POST /api/admin/override — issue a verification code by hand (§38).
 *
 * For the student at the booth whose code never arrived. A board member checks
 * their AU ID card, enters their email here, and reads the 6-digit code off
 * the screen.
 *
 * HOW THIS AVOIDS BEING A BACK DOOR
 *
 * It does not invent its own auth. `generateLink` asks Supabase for a REAL
 * email OTP and returns it instead of mailing it. The student then signs in
 * through the exact same screen as everyone else, and the session that results
 * is identical. There is no second login path to secure.
 *
 * What it genuinely weakens is the proof that this person controls that AU
 * mailbox — an admin could type any AU address. So the attempt is marked
 * prize-ineligible unless the board member confirms they saw the ID card, and
 * that rule is enforced in start_attempt(), not here.
 */
import { createAdminSupabase } from '@/lib/supabase/server';
import { requireAdmin, logAdminAction } from '@/lib/api/admin-guard';
import { overrideIssueSchema, extractStudentId } from '@/lib/validation';
import { ok, fail, messageFor } from '@/lib/api/respond';

const CODE_TTL_MINUTES = 15;

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return fail('UNAUTHORIZED', messageFor('UNAUTHORIZED'), 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('SERVER_ERROR', messageFor('SERVER_ERROR'), 400);
  }

  const parsed = overrideIssueSchema.safeParse(body);
  if (!parsed.success) {
    return fail('INVALID_DOMAIN', parsed.error.issues[0]?.message ?? 'Invalid email.', 400);
  }

  const { email, idVerified } = parsed.data;
  const admin = createAdminSupabase();

  // ---- Make sure the account exists ------------------------------------
  // generateLink with type 'magiclink' requires an existing user. A first-time
  // student will not have one, so create it here. The AU domain was already
  // validated by the schema above; createUser bypasses the auth hook, so this
  // route is solely responsible for that check.
  const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let user = existing?.users.find((u) => u.email?.toLowerCase() === email);

  if (!user) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (createErr || !created.user) {
      return fail('SERVER_ERROR', createErr?.message ?? 'Could not create account.', 500);
    }
    user = created.user;
  }

  // ---- Ask Supabase for a real OTP, unsent -----------------------------
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  const code = link?.properties?.email_otp;

  if (linkErr || !code) {
    return fail('SERVER_ERROR', linkErr?.message ?? 'Could not generate a code.', 500);
  }

  // ---- Record the verification method ----------------------------------
  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name')
    .eq('id', user.id)
    .maybeSingle();

  if (profile) {
    await admin
      .from('profiles')
      .update({ verification_method: 'staff_override', id_verified: idVerified })
      .eq('id', user.id);
  } else {
    await admin.from('profiles').insert({
      id: user.id,
      full_name: 'Pending',
      student_id: extractStudentId(email),
      verification_method: 'staff_override',
      id_verified: idVerified,
    });
  }

  // ---- Audit. The code itself is never stored (§48) --------------------
  await admin.from('staff_override_codes').insert({
    email,
    code_hash: null,
    id_verified: idVerified,
    issued_by: auth.userId,
    expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString(),
  });

  await logAdminAction(auth.userId, auth.email, 'override_issued', 'email', email, {
    id_verified: idVerified,
  });

  return ok({
    code,
    email,
    idVerified,
    prizeEligible: idVerified,
    expiresInMinutes: CODE_TTL_MINUTES,
  });
}
