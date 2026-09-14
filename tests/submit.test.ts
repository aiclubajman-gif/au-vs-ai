import { describe, it, expect, vi } from 'vitest';
import {
  postJson,
  submitWithRetry,
  isRetryable,
  describeSaveFailure,
  NETWORK_ERROR_MESSAGE,
  type SubmitFailure,
} from '@/lib/client/submit';

/**
 * The client submission helper is what stands between a dropped connection at
 * the booth and a student's answer silently disappearing. These tests pin down
 * the three promises it makes: it never throws, it never retries something the
 * server refused on purpose, and every retry is the SAME submission.
 */

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const noSleep = () => Promise.resolve();

const BODY = {
  attemptId: '3f9c1b2a-4d5e-4f6a-8b9c-0d1e2f3a4b5c',
  slot: 2,
  selectedAnswer: null,
  responseTimeMs: 8000,
  idempotencyKey: '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d',
};

describe('postJson', () => {
  it('turns a thrown network error into a failure instead of throwing', async () => {
    const res = await postJson('/api/x', {}, () => Promise.reject(new TypeError('Failed to fetch')));
    expect(res).toEqual({
      ok: false,
      kind: 'network',
      code: 'NETWORK',
      message: NETWORK_ERROR_MESSAGE,
    });
  });

  it('treats a non-JSON gateway page as a retryable server failure', async () => {
    const res = await postJson('/api/x', {}, async () => new Response('<html>504</html>', { status: 504 }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.kind).toBe('server');
    expect(res.code).toBe('BAD_RESPONSE');
    expect(res.status).toBe(504);
    expect(isRetryable(res)).toBe(true);
  });

  it('keeps a structured refusal, including its reference code, and does not mark it retryable', async () => {
    const res = await postJson('/api/x', {}, async () =>
      json(409, {
        ok: false,
        error: { code: 'ALREADY_COMPLETED', message: 'Your official attempt is already complete.', ref: 'ERR-7K2M' },
      }),
    );
    expect(res).toMatchObject({
      ok: false,
      kind: 'rejected',
      code: 'ALREADY_COMPLETED',
      ref: 'ERR-7K2M',
      status: 409,
    });
    if (!res.ok) expect(isRetryable(res)).toBe(false);
  });

  it('treats a structured 5xx as retryable and keeps its reference code', async () => {
    const res = await postJson('/api/x', {}, async () =>
      json(500, { ok: false, error: { code: 'SERVER_ERROR', message: 'Something went wrong.', ref: 'ERR-ABCD' } }),
    );
    expect(res).toMatchObject({ ok: false, kind: 'server', code: 'SERVER_ERROR', ref: 'ERR-ABCD' });
  });

  it('returns the data of a successful response', async () => {
    const res = await postJson<{ locked: boolean }>('/api/x', {}, async () =>
      json(200, { ok: true, data: { locked: true } }),
    );
    expect(res).toEqual({ ok: true, data: { locked: true } });
  });
});

describe('submitWithRetry', () => {
  it('retries a dropped connection with the SAME body and idempotency key', async () => {
    const sent: string[] = [];
    let calls = 0;
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      sent.push(String(init.body));
      calls++;
      if (calls < 3) throw new TypeError('Failed to fetch');
      return json(200, { ok: true, data: { locked: true } });
    });
    const delays: number[] = [];
    const sleep = async (ms: number) => {
      delays.push(ms);
    };

    const res = await submitWithRetry('/api/round1/answer', BODY, { fetchImpl, sleep });

    expect(res.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(new Set(sent).size).toBe(1);
    expect(JSON.parse(sent[2]).idempotencyKey).toBe(BODY.idempotencyKey);
    expect(delays).toEqual([800, 2000]);
  });

  it('a manual "Try again" with the stored body resends the identical submission', async () => {
    const sent: string[] = [];
    let online = false;
    const fetchImpl = async (_url: string, init: RequestInit) => {
      sent.push(String(init.body));
      if (!online) throw new TypeError('offline');
      return json(200, { ok: true, data: { locked: true } });
    };

    // Automatic retries run out while offline...
    const first = await submitWithRetry('/api/round3/answer', BODY, { fetchImpl, sleep: noSleep });
    expect(first.ok).toBe(false);

    // ...then the student taps "Try again", which passes the same stored body.
    online = true;
    const second = await submitWithRetry('/api/round3/answer', BODY, { fetchImpl, sleep: noSleep });

    expect(second.ok).toBe(true);
    expect(sent).toHaveLength(4);
    expect(new Set(sent).size).toBe(1);
  });

  it('does not retry a refusal the server will repeat', async () => {
    const fetchImpl = vi.fn(async () =>
      json(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'You are not signed in.' } }),
    );

    const res = await submitWithRetry('/api/round3/answer', BODY, { fetchImpl, sleep: noSleep });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({ ok: false, kind: 'rejected', code: 'UNAUTHORIZED' });
  });

  it('gives up after a bounded number of tries and reports the failure', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new TypeError('offline')));
    const onRetry = vi.fn();

    const res = await submitWithRetry('/api/round2/submit', BODY, {
      fetchImpl,
      sleep: noSleep,
      onRetry,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(res).toMatchObject({ ok: false, kind: 'network' });
  });

  it('stops retrying once the screen has gone away', async () => {
    let cancelled = false;
    const fetchImpl = vi.fn(async () => {
      cancelled = true;
      throw new TypeError('offline');
    });

    await submitWithRetry('/api/round1/answer', BODY, {
      fetchImpl,
      sleep: noSleep,
      isCancelled: () => cancelled,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('describeSaveFailure', () => {
  const base: SubmitFailure = { ok: false, kind: 'network', code: 'NETWORK', message: NETWORK_ERROR_MESSAGE };

  it('uses connection copy for network and gateway failures', () => {
    expect(describeSaveFailure(base, 'answer')).toMatch(/couldn't save your answer/i);
    expect(
      describeSaveFailure({ ...base, kind: 'server', code: 'BAD_RESPONSE', status: 502 }, 'drawing'),
    ).toMatch(/couldn't save your drawing/i);
  });

  it("shows the server's own message otherwise", () => {
    expect(
      describeSaveFailure(
        { ok: false, kind: 'rejected', code: 'ALREADY_COMPLETED', message: 'Your official attempt is already complete.' },
        'answer',
      ),
    ).toBe('Your official attempt is already complete.');
  });
});
