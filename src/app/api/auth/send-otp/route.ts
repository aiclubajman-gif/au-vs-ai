/**
 * POST /api/auth/send-otp
 *
 * Domain restriction happens in three places, deliberately:
 *   1. here, for a fast friendly message
 *   2. the Before User Created hook, which is authoritative
 *   3. a CHECK constraint on staff override codes
 */
import { createAdminSupabase } from '@/lib/supabase/server';
import { auEmailSchema } from '@/lib/validation';
import { ok, fail, messageFor, refCode } from '@/lib/api/respond';
import { rateLimit, clientIp, OTP_SEND, OTP_SEND_PER_IP } from '@/lib/api/rate-limit';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('SERVER_ERROR', messageFor('SERVER_ERROR'), 400);
  }

  const parsed = auEmailSchema.safeParse(
    (body as { email?: unknown })?.email ?? '',
  );

  if (!parsed.success) {
    return fail('INVALID_DOMAIN', messageFor('INVALID_DOMAIN'), 400);
  }

  const email = parsed.data;

  const perIp = rateLimit(`otp:ip:${clientIp(req)}`, OTP_SEND_PER_IP.limit, OTP_SEND_PER_IP.windowMs);
  if (!perIp.allowed) {
    return fail('RATE_LIMITED', messageFor('RATE_LIMITED'), 429);
  }

  const perEmail = rateLimit(`otp:email:${email}`, OTP_SEND.limit, OTP_SEND.windowMs);
  if (!perEmail.allowed) {
    return ok({
      sent: false,
      cooldownMs: perEmail.retryAfterMs,
      message: `Wait ${Math.ceil(perEmail.retryAfterMs / 1000)}s before requesting another code.`,
    });
  }

  const admin = createAdminSupabase();
  const ref = refCode();

  const { error } = await admin.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    // Never log the code itself (§48). Log that a send failed, and why.
    await admin.from('app_events').insert({
      event: 'otp_send_failed',
      ref_code: ref,
      details: { reason: error.message },
    });
    return fail('EMAIL_SEND_FAILED', messageFor('EMAIL_SEND_FAILED'), 502, ref);
  }

  await admin.from('app_events').insert({ event: 'otp_requested' });

  return ok({ sent: true, cooldownMs: OTP_SEND.windowMs });
}
