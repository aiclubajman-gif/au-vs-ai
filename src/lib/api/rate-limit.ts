/**
 * In-memory rate limiting for OTP abuse protection (§33) and the wrong-code
 * lockout.
 *
 * DELIBERATE SCOPE: this is per-serverless-instance, so it is a speed bump, not
 * a wall. Supabase enforces the authoritative auth rate limits server-side.
 * This layer exists to give a friendly message before Supabase returns a raw
 * 429, and to stop a student burning a friend's attempt by guessing codes.
 *
 * Do not replace this with Redis before the fair. It is not worth the moving
 * part for a two-day event.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Prevents unbounded growth on a long-running instance. */
function sweep(now: number) {
  if (buckets.size < 500) return;
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: existing.resetAt - now };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, retryAfterMs: 0 };
}

export function resetLimit(key: string) {
  buckets.delete(key);
}

/** §34 — one OTP request per email per 60s. */
export const OTP_SEND = { limit: 1, windowMs: 60_000 };
/** Broader net so one device cannot cycle many addresses. */
export const OTP_SEND_PER_IP = { limit: 12, windowMs: 10 * 60_000 };
/** Five wrong codes locks that email for 15 minutes. */
export const OTP_VERIFY = { limit: 5, windowMs: 15 * 60_000 };

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
