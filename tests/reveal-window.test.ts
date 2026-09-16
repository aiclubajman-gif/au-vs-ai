import { describe, it, expect } from 'vitest';
import { REVEAL_WINDOW_MS, revealTimeRemaining } from '@/lib/client/reveal-window';
import { submitWithRetry, type SubmitFailure } from '@/lib/client/submit';

/**
 * The Round 2 analysis hold.
 *
 * The bug these tests exist for: the readout window used to be measured from
 * the moment the classifier returned. A save that failed and then succeeded on
 * retry could take longer than the whole window, so the remaining wait came out
 * at zero and the analysis screen closed the instant Continue lit up — the
 * student never saw the predictions they had just earned.
 *
 * The window is now anchored on the save, so the student always gets the full
 * seven seconds of usable screen, however long the saving took.
 */

const URL = '/api/round2/submit';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const okBody = { ok: true, data: { points: 180, recognised: true } };
const serverError = { ok: false, error: { code: 'SERVER_ERROR', message: 'Temporary failure.' } };

/** The single submission Round 2 builds once and resends unchanged on retry. */
const BODY = {
  attemptId: '3f9c1b2a-4d5e-4f6a-8b9c-0d1e2f3a4b5c',
  targetConfidence: 0.71,
  topPredictions: [{ label: 'cat', confidence: 0.71 }],
  drawTimeMs: 11_400,
  bitmap28: 'AAAA',
  idempotencyKey: '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d',
};

/**
 * A stand-in for the Round 2 analysis screen: a clock that only moves when
 * something takes time, and the same save-then-hold sequence the component
 * runs. Kept deliberately close to Round2's save(), so a change to the rule
 * there has to be made here too.
 */
function analysisScreen({ responses }: { responses: Response[] }) {
  let now = 1_700_000_000_000;
  let sent = 0;
  const bodiesSent: string[] = [];

  /** Every wait the screen scheduled before advancing to the next screen. */
  const scheduledWaits: number[] = [];
  let advances = 0;
  let savedAtMs: number | null = null;
  let failure: SubmitFailure | null = null;
  let inFlight = false;

  // finish() in the component: Continue and the timeout share one guard, so
  // the round ends exactly once however many times this is reached.
  let completed = false;
  const finish = () => {
    if (completed) return;
    completed = true;
    advances++;
  };

  return {
    get savedAtMs() {
      return savedAtMs;
    },
    get failure() {
      return failure;
    },
    get scheduledWaits() {
      return scheduledWaits;
    },
    get advances() {
      return advances;
    },
    get bodiesSent() {
      return bodiesSent;
    },
    now: () => now,
    /** Time the student spends looking at a failed save before tapping retry. */
    wait: (ms: number) => {
      now += ms;
    },
    /** What the "Continues by itself in Ns" line would read right now. */
    countdownSeconds: () =>
      Math.ceil(revealTimeRemaining(savedAtMs, now, REVEAL_WINDOW_MS) / 1000),
    /** Continue: available as soon as the result is saved. */
    tapContinue: () => {
      if (savedAtMs === null) return;
      finish();
    },
    /** Round2.save(), with the clock and the network under the test's control. */
    async save() {
      if (inFlight) return;
      inFlight = true;
      failure = null;

      const result = await submitWithRetry(URL, BODY, {
        fetchImpl: async (_url, init) => {
          bodiesSent.push(String(init.body));
          // A round trip is not free, failed or not.
          now += 400;
          return responses[Math.min(sent++, responses.length - 1)].clone();
        },
        sleep: async (ms) => {
          now += ms;
        },
      });

      inFlight = false;
      if (!result.ok) {
        failure = result;
        return;
      }

      // The fix: the window is anchored here, on the save.
      savedAtMs = now;
      // The component hands this wait to setTimeout(finish, ...).
      scheduledWaits.push(REVEAL_WINDOW_MS);
    },
    fireScheduledAdvance() {
      const wait = scheduledWaits.at(-1);
      if (wait === undefined) return;
      now += wait;
      finish();
    },
  };
}

describe('revealTimeRemaining', () => {
  it('leaves the whole window ahead while the result is still unsaved', () => {
    // However long the save has been failing and retrying, none of it counts.
    expect(revealTimeRemaining(null, 1_000_000, REVEAL_WINDOW_MS)).toBe(REVEAL_WINDOW_MS);
  });

  it('starts the window at the save, not before it', () => {
    expect(revealTimeRemaining(5_000, 5_000, REVEAL_WINDOW_MS)).toBe(REVEAL_WINDOW_MS);
    expect(revealTimeRemaining(5_000, 7_500, REVEAL_WINDOW_MS)).toBe(4_500);
  });

  it('never goes negative once the window is spent', () => {
    expect(revealTimeRemaining(5_000, 50_000, REVEAL_WINDOW_MS)).toBe(0);
  });
});

describe('Round 2 analysis hold', () => {
  it('holds the full window on a first-time save', async () => {
    const screen = analysisScreen({ responses: [json(200, okBody)] });
    await screen.save();

    expect(screen.failure).toBeNull();
    expect(screen.scheduledWaits).toEqual([REVEAL_WINDOW_MS]);
    expect(screen.countdownSeconds()).toBe(7);
  });

  it('holds the full window after an initial save failure and a retried success', async () => {
    // The regression. The predictions are on screen from here; everything that
    // follows is the save struggling, which the student watches happen.
    const screen = analysisScreen({
      responses: [
        json(503, serverError),
        json(503, serverError),
        json(503, serverError),
        json(200, okBody),
      ],
    });
    const revealedAt = screen.now();

    // First save: all three attempts fail, and the retry notice appears.
    await screen.save();
    expect(screen.failure).not.toBeNull();
    expect(screen.savedAtMs).toBeNull();
    expect(screen.scheduledWaits).toEqual([]);

    // The student reads the notice, then taps "Try again".
    screen.wait(12_000);
    await screen.save();

    // Far more than a whole window has now passed since the predictions
    // appeared — exactly the case that used to collapse the wait to zero.
    expect(screen.now() - revealedAt).toBeGreaterThan(REVEAL_WINDOW_MS);

    expect(screen.failure).toBeNull();
    expect(screen.savedAtMs).toBe(screen.now());
    expect(screen.scheduledWaits).toEqual([REVEAL_WINDOW_MS]);
    expect(screen.countdownSeconds()).toBe(7);
  });

  it('holds the full window when submitWithRetry recovers on its own', async () => {
    // No visible failure, just a slow save: the same collapse, no retry tap.
    const screen = analysisScreen({
      responses: [json(503, serverError), json(200, okBody)],
    });
    const revealedAt = screen.now();

    await screen.save();

    expect(screen.now() - revealedAt).toBeGreaterThan(0);
    expect(screen.failure).toBeNull();
    expect(screen.scheduledWaits).toEqual([REVEAL_WINDOW_MS]);
    expect(screen.countdownSeconds()).toBe(7);
  });

  it('resends the same submission on retry, idempotency key included', async () => {
    const screen = analysisScreen({
      responses: [
        json(503, serverError),
        json(503, serverError),
        json(503, serverError),
        json(200, okBody),
      ],
    });

    await screen.save();
    screen.wait(12_000);
    await screen.save();

    expect(screen.bodiesSent.length).toBe(4);
    expect(new Set(screen.bodiesSent).size).toBe(1);
    expect(JSON.parse(screen.bodiesSent[0]).idempotencyKey).toBe(BODY.idempotencyKey);
  });

  it('advances once when Continue is tapped and the hold then expires', async () => {
    const screen = analysisScreen({ responses: [json(200, okBody)] });
    await screen.save();

    screen.tapContinue();
    screen.fireScheduledAdvance();

    expect(screen.advances).toBe(1);
  });

  it('advances once when the hold expires and Continue is tapped afterwards', async () => {
    const screen = analysisScreen({ responses: [json(200, okBody)] });
    await screen.save();

    screen.fireScheduledAdvance();
    screen.tapContinue();

    expect(screen.advances).toBe(1);
  });

  it('cannot advance before the result is saved', async () => {
    const screen = analysisScreen({ responses: [json(503, serverError)] });
    await screen.save();

    screen.tapContinue();

    expect(screen.failure).not.toBeNull();
    expect(screen.advances).toBe(0);
  });
});
