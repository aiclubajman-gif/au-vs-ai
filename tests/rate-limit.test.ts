import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, resetLimit, clientIp } from '@/lib/api/rate-limit';

describe('Rate limiting', () => {
  beforeEach(() => {
    resetLimit('t:a');
    resetLimit('t:b');
  });

  it('allows the first request', () => {
    expect(rateLimit('t:a', 1, 60_000).allowed).toBe(true);
  });

  it('blocks a second request inside the window', () => {
    rateLimit('t:a', 1, 60_000);
    const second = rateLimit('t:a', 1, 60_000);
    expect(second.allowed).toBe(false);
    expect(second.retryAfterMs).toBeGreaterThan(0);
  });

  it('allows exactly `limit` attempts then blocks (wrong-code lockout)', () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimit('t:b', 5, 900_000).allowed).toBe(true);
    }
    expect(rateLimit('t:b', 5, 900_000).allowed).toBe(false);
  });

  it('tracks keys independently so one student cannot lock out another', () => {
    rateLimit('t:a', 1, 60_000);
    expect(rateLimit('t:b', 1, 60_000).allowed).toBe(true);
  });

  it('resets after the window expires', async () => {
    rateLimit('t:a', 1, 20);
    expect(rateLimit('t:a', 1, 20).allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 30));
    expect(rateLimit('t:a', 1, 20).allowed).toBe(true);
  });

  it('reads the first address from x-forwarded-for', () => {
    const req = new Request('https://x.test', {
      headers: { 'x-forwarded-for': '203.0.113.9, 70.41.3.18' },
    });
    expect(clientIp(req)).toBe('203.0.113.9');
  });

  it('falls back to a sentinel when no IP header exists', () => {
    expect(clientIp(new Request('https://x.test'))).toBe('unknown');
  });
});
