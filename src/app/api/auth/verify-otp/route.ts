/**
 * POST /api/auth/verify-otp
 *
 * On success, creates the profile row if this is a first sign-in, deriving the
 * student ID from the email local part (§5). The name is collected on the next
 * screen, so the profile starts with a placeholder that profileSetup replaces.
 */
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server';
import { auEmailSchema, otpSchema, extractStudentId } from '@/lib/validation';
import { ok, fail, messageFor } from '@/lib/api/respond';
import { rateLimit, resetLimit, OTP_VERIFY } from '@/lib/api/rate-limit';

export async function POST(req: Request) {
  let body: { email?: unknown; token?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail('SERVER_ERROR', messageFor('SERVER_ERROR'), 400);
  }

  const email = auEmailSchema.safeParse(body.email ?? '');
  const token = otpSchema.safeParse(body.token ?? '');

  if (!email.success) return fail('INVALID_DOMAIN', messageFor('INVALID_DOMAIN'), 400);
  if (!token.success) return fail('OTP_INVALID', messageFor('OTP_INVALID'), 400);

  const lockKey = `otp:verify:${email.data}`;
  const attempt = rateLimit(lockKey, OTP_VERIFY.limit, OTP_VERIFY.windowMs);
  if (!attempt.allowed) {
    return fail('OTP_LOCKED', messageFor('OTP_LOCKED'), 429);
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.data,
    token: token.data,
    type: 'email',
  });

  if (error || !data.user) {
    return fail('OTP_INVALID', messageFor('OTP_INVALID'), 401);
  }

  // Correct code clears the lockout counter.
  resetLimit(lockKey);

  const admin = createAdminSupabase();

  const { data: existing } = await admin
    .from('profiles')
    .select('id, full_name, college_id')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!existing) {
    await admin.from('profiles').insert({
      id: data.user.id,
      full_name: 'Pending',
      student_id: extractStudentId(email.data),
    });
  }

  const { data: attemptRow } = await admin
    .from('attempts')
    .select('id, status')
    .eq('user_id', data.user.id)
    .neq('status', 'invalidated')
    .maybeSingle();

  return ok({
    userId: data.user.id,
    needsProfile: !existing || existing.full_name === 'Pending',
    attemptStatus: attemptRow?.status ?? 'not_started',
  });
}
