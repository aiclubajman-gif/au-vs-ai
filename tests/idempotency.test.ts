/**
 * Ambiguous network success: the database committed, the response was lost.
 *
 * These tests run the REAL round route handlers against an in-memory stand-in
 * for the Supabase query builder, and the REAL client retry helper against
 * those handlers. Nothing about the idempotency path is mocked out.
 *
 * How idempotency actually works (from the route code, not the key):
 *   - idempotencyKey is validated but never stored or compared by the server.
 *   - A submission is recognised as already made by its row's marker column:
 *     attempt_round1.answered_at / attempt_round2.submitted_at /
 *     attempt_round3.answered_at.
 *   - A request that finds the marker set returns 200 {locked, alreadyAnswered}.
 *   - Two copies racing past that check meet a conditional UPDATE ... WHERE
 *     marker IS NULL: exactly one writes, the other matches no row and gets the
 *     same 200 response.
 * The client moves on whenever the response is ok, so a retry of a committed
 * submission resolves as success and nothing is written or scored twice.
 *
 * The same harness covers the 60-second format (migration 0015): 8- and
 * 10-image games, resume on the attempt's frozen timing, and a start that
 * fails cleanly when settings are unavailable. The stand-in's start_attempt
 * mirrors the SQL's contract; the SQL itself is checked in
 * sixty-second-format.test.ts and supabase/verification/.
 */
import { describe, it, expect, vi } from 'vitest';
import type { AttemptAssignment } from '@/types';

vi.mock('server-only', () => ({}));

const env = vi.hoisted(() => ({
  db: null as unknown as { client: unknown },
  userId: 'user-1',
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminSupabase: () => env.db.client,
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: env.userId } } }) },
  }),
}));

import { POST as round1Answer } from '@/app/api/round1/answer/route';
import { POST as round2Submit } from '@/app/api/round2/submit/route';
import { POST as round3Answer } from '@/app/api/round3/answer/route';
import { POST as startAttempt } from '@/app/api/attempt/start/route';
import { submitWithRetry } from '@/lib/client/submit';
import { resumeStep } from '@/lib/api/serialize';
import { isSixtySecondGame } from '@/lib/timing';

// ---------------------------------------------------------------------------
// In-memory stand-in for the subset of the Supabase query builder the routes use
// ---------------------------------------------------------------------------
type Row = Record<string, unknown>;
type QueryResult = { data: unknown; error: null; count?: number };

/** A database exception, as start_attempt() raises one. */
class PgError extends Error {}

class FakeSupabase {
  updates: { table: string; rows: number }[] = [];
  rpcCalls: { fn: string; args: Row }[] = [];
  /** Every table a route touched, in order. */
  tablesRead: string[] = [];
  private hold: { table: string; expected: number; waiting: (() => void)[] } | null = null;
  private created = 0;

  constructor(public tables: Record<string, Row[]>) {}

  readonly client = {
    from: (table: string) => {
      this.tablesRead.push(table);
      return new FakeQuery(this, table);
    },
    rpc: async (fn: string, args: Row) => {
      this.rpcCalls.push({ fn, args });
      try {
        return { data: this.runRpc(fn, args), error: null };
      } catch (e) {
        return { data: null, error: { message: (e as Error).message } };
      }
    },
  };

  /** Holds UPDATEs on `table` until `expected` of them have arrived. */
  holdUpdatesUntil(table: string, expected: number) {
    this.hold = { table, expected, waiting: [] };
  }

  async beforeUpdate(table: string) {
    const hold = this.hold;
    if (!hold || hold.table !== table) return;
    await new Promise<void>((release) => {
      hold.waiting.push(release);
      if (hold.waiting.length === hold.expected) hold.waiting.forEach((r) => r());
    });
  }

  rowsWritten(table: string) {
    return this.updates.filter((u) => u.table === table).map((u) => u.rows);
  }

  rpcCount(fn: string) {
    return this.rpcCalls.filter((c) => c.fn === fn).length;
  }

  /**
   * start_attempt(): an existing attempt resumes through
   * get_attempt_assignment(); otherwise settings are read and validated BEFORE
   * anything is written, then exactly round1_image_count images are assigned
   * and the timing is snapshotted onto the attempt.
   */
  runRpc(fn: string, args: Row): unknown {
    if (fn !== 'start_attempt') return null;
    const userId = String(args.p_user_id);
    const existing = this.tables.attempts.find(
      (a) => a.user_id === userId && a.status !== 'invalidated',
    );
    if (existing) return { ...this.assignment(existing), resumed: true };

    const s = this.tables.event_settings.find((r) => r.id === 1);
    if (!s) throw new PgError('SETTINGS_UNAVAILABLE');
    const n = Number(s.round1_image_count);
    const r1 = Number(s.round1_ms_per_image);
    const r2 = Number(s.round2_draw_ms);
    const r3 = Number(s.round3_ms);
    if (!(n * r1 + r2 + r3 === 60_000)) throw new PgError('SETTINGS_UNAVAILABLE');

    const id = `created-attempt-${++this.created}`;
    const attempt: Row = {
      id,
      user_id: userId,
      status: 'in_progress',
      current_round: 1,
      started_at: '2026-09-22T10:00:00.000Z',
      round2_class_id: 1,
      round3_question_id: 'question-day-1',
      is_test: false,
      round1_ms_per_image: r1,
      round2_draw_ms: r2,
      round3_ms: r3,
    };
    this.tables.attempts.push(attempt);
    for (let slot = 1; slot <= n; slot++) {
      const imageId = `${id}-img-${slot}`;
      this.tables.round1_images.push({ id: imageId, label: slot % 2 ? 'real' : 'ai_generated' });
      this.tables.attempt_round1.push(emptySlot(id, slot, imageId));
    }
    this.tables.attempt_round2.push({ attempt_id: id, target_class_id: 1, submitted_at: null, points: null });
    this.tables.attempt_round3.push({ attempt_id: id, question_id: 'question-day-1', guess: null, answered_at: null, points: null });
    return { ...this.assignment(attempt), resumed: false };
  }

  /**
   * get_attempt_assignment(). Derives Round 1 `answered` from selected_answer,
   * which is NULL for a timeout — reproduced deliberately, as the SQL (0003)
   * does. Timing comes from the ATTEMPT row, never from event_settings.
   */
  private assignment(attempt: Row) {
    const r1 = this.tables.attempt_round1.filter((r) => r.attempt_id === attempt.id);
    const r2 = this.tables.attempt_round2.find((r) => r.attempt_id === attempt.id)!;
    const r3 = this.tables.attempt_round3.find((r) => r.attempt_id === attempt.id)!;
    return {
      attempt_id: attempt.id,
      status: attempt.status,
      current_round: attempt.current_round,
      started_at: attempt.started_at,
      timing:
        attempt.round1_ms_per_image == null
          ? null
          : {
              round1_ms_per_image: attempt.round1_ms_per_image,
              round2_draw_ms: attempt.round2_draw_ms,
              round3_ms: attempt.round3_ms,
            },
      round1: [...r1]
        .sort((a, b) => Number(a.slot) - Number(b.slot))
        .map((r) => ({
          slot: r.slot,
          image_id: r.image_id,
          storage_path: `/img/${r.image_id}.webp`,
          answered: r.selected_answer !== null,
        })),
      round2: { class_key: 'cat', display_name: 'CAT', submitted: r2.submitted_at !== null },
      round3: {
        prompt: 'How many?',
        min_value: 0,
        max_value: 40,
        step: 1,
        unit: null,
        answered: r3.answered_at !== null,
      },
    };
  }
}

class FakeQuery implements PromiseLike<QueryResult> {
  private op: 'select' | 'update' | 'insert' = 'select';
  private filters: ((row: Row) => boolean)[] = [];
  private values: Row = {};
  private head = false;
  private returning = false;

  constructor(
    private db: FakeSupabase,
    private table: string,
  ) {}

  select(columns?: string, options?: { head?: boolean }) {
    if (this.op === 'select') this.head = Boolean(options?.head && columns);
    else this.returning = true;
    return this;
  }
  update(values: Row) {
    this.op = 'update';
    this.values = values;
    return this;
  }
  insert(values: Row) {
    this.op = 'insert';
    this.values = values;
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push((r) => r[column] === value);
    return this;
  }
  neq(column: string, value: unknown) {
    this.filters.push((r) => r[column] !== value);
    return this;
  }
  is(column: string, value: null) {
    this.filters.push((r) => (r[column] ?? null) === value);
    return this;
  }
  not(column: string, operator: 'is', value: null) {
    if (operator === 'is') this.filters.push((r) => (r[column] ?? null) !== value);
    return this;
  }
  async maybeSingle() {
    const { data } = await this.execute();
    return { data: (data as Row[])[0] ?? null, error: null };
  }
  async single() {
    const { data } = await this.execute();
    const rows = data as Row[];
    return rows.length === 1
      ? { data: rows[0], error: null }
      : { data: null, error: { message: 'expected one row' } };
  }
  then<A = QueryResult, B = never>(
    onFulfilled?: ((value: QueryResult) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.execute().then(onFulfilled, onRejected);
  }

  private async execute(): Promise<QueryResult> {
    // Every query is a round trip, so concurrent requests interleave.
    await Promise.resolve();
    const rows = (this.db.tables[this.table] ??= []);

    if (this.op === 'insert') {
      rows.push({ ...this.values });
      return { data: null, error: null };
    }

    if (this.op === 'update') {
      await this.db.beforeUpdate(this.table);
      // Filter and write together, as one row-locked statement would.
      const matched = rows.filter((r) => this.filters.every((f) => f(r)));
      for (const r of matched) Object.assign(r, this.values);
      this.db.updates.push({ table: this.table, rows: matched.length });
      return { data: this.returning ? matched.map((r) => ({ ...r })) : null, error: null };
    }

    const matched = rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.head) return { data: null, count: matched.length, error: null };
    return { data: matched.map((r) => ({ ...r })), error: null };
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const ATTEMPT = '3f9c1b2a-4d5e-4f6a-8b9c-0d1e2f3a4b5c';

/** The two production formats. Rounds 2 and 3 are fixed at 12s and 8s. */
const FORMAT = {
  8: { round1_image_count: 8, round1_ms_per_image: 5000 },
  10: { round1_image_count: 10, round1_ms_per_image: 4000 },
} as const;

/** Alternating labels, so odd slots are real and even slots are AI. */
const labelFor = (slot: number) => (slot % 2 ? 'real' : 'ai_generated');

function emptySlot(attemptId: unknown, slot: number, imageId: string): Row {
  return {
    attempt_id: attemptId,
    slot,
    image_id: imageId,
    selected_answer: null,
    correct: null,
    points: null,
    answered_at: null,
    response_time_ms: null,
  };
}

/** One in-progress attempt for user-1, created under the given format. */
function seed(images: 8 | 10 = 8): FakeSupabase {
  const format = FORMAT[images];
  const db = new FakeSupabase({
    attempts: [
      {
        id: ATTEMPT,
        user_id: 'user-1',
        status: 'in_progress',
        current_round: 1,
        started_at: '2026-09-22T09:00:00.000Z',
        round2_class_id: 1,
        round3_question_id: 'question-day-1',
        is_test: false,
        // The snapshot start_attempt() froze onto this attempt.
        round1_ms_per_image: format.round1_ms_per_image,
        round2_draw_ms: 12000,
        round3_ms: 8000,
      },
    ],
    attempt_round1: Array.from({ length: images }, (_, i) => emptySlot(ATTEMPT, i + 1, `img-${i + 1}`)),
    round1_images: Array.from({ length: images }, (_, i) => ({ id: `img-${i + 1}`, label: labelFor(i + 1) })),
    attempt_round2: [{ attempt_id: ATTEMPT, target_class_id: 1, submitted_at: null, points: null }],
    attempt_round3: [
      { attempt_id: ATTEMPT, question_id: 'question-day-1', guess: null, answered_at: null, points: null },
    ],
    round3_question: [{ id: 'question-day-1', correct_answer: '12', min_value: '0', max_value: '40' }],
    event_settings: [
      {
        id: 1,
        challenge_open: true,
        new_games_paused: false,
        entries_closed: false,
        maintenance_message: null,
        ...format,
        round2_draw_ms: 12000,
        round3_ms: 8000,
        human_win_threshold: 600,
        round2_recognition_threshold: 0.55,
        round2_speed_bonus_max: 40,
        round3_scoring_tolerance: '20',
        round3_tolerance_exponent: 1.5,
        leaderboard_display: 'name_and_masked_id',
        collect_college: true,
        abandon_after_minutes: 20,
      },
    ],
    app_events: [],
  });
  env.db = db;
  env.userId = 'user-1';
  return db;
}

type Handler = (req: Request) => Promise<Response>;

function call(handler: Handler, body: unknown) {
  return handler(
    new Request('http://localhost/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

/**
 * A network that delivers every request to the real handler, lets it finish
 * (so the database commit happens), then loses the first `lose` responses.
 */
function lossyNetwork(handler: Handler, lose = 1) {
  const sent: string[] = [];
  const fetchImpl = async (url: string, init: RequestInit) => {
    sent.push(String(init.body));
    const res = await handler(new Request(`http://localhost${url}`, init));
    if (sent.length <= lose) throw new TypeError('Network connection lost');
    return res;
  };
  return { fetchImpl, sent };
}

const noSleep = async () => {};
const row = (db: FakeSupabase, table: string, slot?: number) =>
  db.tables[table].find((r) => r.attempt_id === ATTEMPT && (slot === undefined || r.slot === slot))!;

const bitmap28 = Buffer.from(new Uint8Array(784)).toString('base64');

/** Answers one Round 1 slot through the real route and returns the response data. */
async function answer(slot: number, selectedAnswer: 'real' | 'ai_generated' | null) {
  const res = await call(round1Answer, {
    attemptId: ATTEMPT,
    slot,
    selectedAnswer,
    responseTimeMs: selectedAnswer === null ? 5000 : 2000,
    idempotencyKey: crypto.randomUUID(),
  });
  const json = await res.json();
  expect(json.ok).toBe(true);
  return json.data as { locked: true; roundComplete?: boolean; alreadyAnswered?: boolean };
}

async function resume() {
  const json = await (await call(startAttempt, {})).json();
  expect(json.ok).toBe(true);
  return json.data as AttemptAssignment;
}

// ===========================================================================
// ROUND 1
// ===========================================================================
describe('Round 1 — response lost after the answer committed', () => {
  it('a same-key retry resolves as success, keeps the answer, and writes once', async () => {
    const db = seed();
    const body = {
      attemptId: ATTEMPT,
      slot: 2,
      selectedAnswer: 'ai_generated',
      responseTimeMs: 3100,
      idempotencyKey: crypto.randomUUID(),
    };
    const net = lossyNetwork(round1Answer);

    const result = await submitWithRetry('/api/round1/answer', body, {
      fetchImpl: net.fetchImpl,
      sleep: noSleep,
    });

    expect(result).toEqual({ ok: true, data: { locked: true, alreadyAnswered: true } });
    // The retry was the same logical submission: same answer, same key.
    expect(net.sent).toHaveLength(2);
    expect(net.sent[1]).toBe(net.sent[0]);
    // The committed answer is intact and was written exactly once. No per-slot
    // points: Round 1 is scored once, at completion, from correct / assigned.
    expect(row(db, 'attempt_round1', 2)).toMatchObject({
      selected_answer: 'ai_generated',
      correct: true,
      points: null,
    });
    expect(db.rowsWritten('attempt_round1')).toEqual([1]);
    expect(db.rpcCount('bump_image_stats')).toBe(1);
  });

  it('a lost timeout response resolves the same way and is never correct', async () => {
    const db = seed();
    const body = {
      attemptId: ATTEMPT,
      slot: 1,
      selectedAnswer: null,
      responseTimeMs: 5000,
      idempotencyKey: crypto.randomUUID(),
    };
    const net = lossyNetwork(round1Answer);

    const result = await submitWithRetry('/api/round1/answer', body, {
      fetchImpl: net.fetchImpl,
      sleep: noSleep,
    });

    expect(result.ok).toBe(true);
    expect(row(db, 'attempt_round1', 1)).toMatchObject({
      selected_answer: null,
      correct: false,
      points: null,
    });
    expect(row(db, 'attempt_round1', 1).answered_at).not.toBeNull();
    expect(db.rowsWritten('attempt_round1')).toEqual([1]);
    expect(db.rpcCount('bump_image_stats')).toBe(0);
  });

  it('two copies of the same submission racing past the check still record once', async () => {
    const db = seed();
    const body = {
      attemptId: ATTEMPT,
      slot: 3,
      selectedAnswer: 'real',
      responseTimeMs: 2000,
      idempotencyKey: crypto.randomUUID(),
    };
    // Both requests reach the UPDATE before either writes.
    db.holdUpdatesUntil('attempt_round1', 2);

    const [a, b] = await Promise.all([call(round1Answer, body), call(round1Answer, body)]);
    const bodies = [await a.json(), await b.json()];

    expect(bodies.every((r) => r.ok === true)).toBe(true);
    expect(db.rowsWritten('attempt_round1')).toEqual([1, 0]);
    expect(db.rpcCount('bump_image_stats')).toBe(1);
    expect(row(db, 'attempt_round1', 3).correct).toBe(true);
  });

  it('a later, different submission can never replace the committed answer', async () => {
    const db = seed();
    const first = await call(round1Answer, {
      attemptId: ATTEMPT,
      slot: 4,
      selectedAnswer: 'real',
      responseTimeMs: 2500,
      idempotencyKey: crypto.randomUUID(),
    });
    const second = await call(round1Answer, {
      attemptId: ATTEMPT,
      slot: 4,
      selectedAnswer: 'ai_generated',
      responseTimeMs: 2600,
      idempotencyKey: crypto.randomUUID(),
    });

    expect((await first.json()).data).toEqual({ locked: true, roundComplete: false });
    expect((await second.json()).data).toEqual({ locked: true, alreadyAnswered: true });
    expect(row(db, 'attempt_round1', 4)).toMatchObject({ selected_answer: 'real', correct: false });
    expect(db.rowsWritten('attempt_round1')).toEqual([1]);
  });

  it('never reveals correctness in either the original or the replayed response', async () => {
    seed();
    const body = {
      attemptId: ATTEMPT,
      slot: 2,
      selectedAnswer: 'ai_generated',
      responseTimeMs: 3000,
      idempotencyKey: crypto.randomUUID(),
    };
    const original = JSON.stringify(await (await call(round1Answer, body)).json());
    const replay = JSON.stringify(await (await call(round1Answer, body)).json());

    for (const text of [original, replay]) {
      expect(text).not.toMatch(/correct|points|label|real|ai_generated|score/i);
    }
  });
});

// ===========================================================================
// ROUND 1 — 8- AND 10-IMAGE GAMES
// ===========================================================================
describe('Round 1 — 8- and 10-image games', () => {
  it('slots 9 and 10 of a 10-image game are accepted and recorded normally', async () => {
    const db = seed(10);
    await answer(9, 'real');
    await answer(10, 'ai_generated');

    expect(row(db, 'attempt_round1', 9)).toMatchObject({ selected_answer: 'real', correct: true });
    expect(row(db, 'attempt_round1', 10)).toMatchObject({ selected_answer: 'ai_generated', correct: true });
    expect(db.rpcCount('bump_image_stats')).toBe(2);
  });

  it('a slot the attempt was not assigned is refused, not created', async () => {
    const db = seed(8);
    const res = await call(round1Answer, {
      attemptId: ATTEMPT,
      slot: 9,
      selectedAnswer: 'real',
      responseTimeMs: 2000,
      idempotencyKey: crypto.randomUUID(),
    });

    expect(res.status).toBe(404);
    expect(db.tables.attempt_round1).toHaveLength(8);
    expect(db.rowsWritten('attempt_round1')).toEqual([]);
  });

  it.each([8, 10] as const)(
    '%i images: Round 2 is reached only after EVERY assigned image is answered',
    async (images) => {
      const db = seed(images);
      // Answered out of order, so nothing can depend on a slot number.
      const order = Array.from({ length: images }, (_, i) => i + 1).reverse();
      const last = order.pop()!;

      for (const slot of order) {
        const data = await answer(slot, slot % 3 ? 'real' : null);
        expect(data.roundComplete).toBe(false);
        expect(db.tables.attempts[0].current_round).toBe(1);
      }

      const final = await answer(last, 'ai_generated');
      expect(final.roundComplete).toBe(true);
      expect(db.tables.attempts[0].current_round).toBe(2);
    },
  );

  it('the old fixed count cannot end a longer game early', async () => {
    const db = seed(10);
    for (const slot of [1, 2, 3, 4]) {
      expect((await answer(slot, 'real')).roundComplete).toBe(false);
    }
    expect(db.tables.attempts[0].current_round).toBe(1);
  });

  it('a timeout on slot 10 is recorded as null and still completes the round', async () => {
    const db = seed(10);
    for (let slot = 1; slot <= 9; slot++) await answer(slot, 'real');

    const final = await answer(10, null);

    expect(final.roundComplete).toBe(true);
    expect(row(db, 'attempt_round1', 10)).toMatchObject({ selected_answer: null, correct: false });
    expect(row(db, 'attempt_round1', 10).answered_at).not.toBeNull();
  });

  it('a lost response on the final answer retries safely and advances once', async () => {
    const db = seed(10);
    for (let slot = 1; slot <= 9; slot++) await answer(slot, 'real');
    const net = lossyNetwork(round1Answer);

    const result = await submitWithRetry(
      '/api/round1/answer',
      {
        attemptId: ATTEMPT,
        slot: 10,
        selectedAnswer: 'ai_generated',
        responseTimeMs: 1800,
        idempotencyKey: crypto.randomUUID(),
      },
      { fetchImpl: net.fetchImpl, sleep: noSleep },
    );

    expect(result).toEqual({ ok: true, data: { locked: true, alreadyAnswered: true } });
    expect(row(db, 'attempt_round1', 10).selected_answer).toBe('ai_generated');
    // Slots 1-10 each written once; the round pointer advanced exactly once.
    expect(db.rowsWritten('attempt_round1')).toEqual(Array(10).fill(1));
    expect(db.rowsWritten('attempts')).toEqual([1]);
  });
});

// ===========================================================================
// ROUND 2
// ===========================================================================
describe('Round 2 — response lost after the drawing committed', () => {
  const drawing = (confidence: number, drawTimeMs = 9000) => ({
    attemptId: ATTEMPT,
    targetConfidence: confidence,
    topPredictions: [
      { label: 'cat', confidence },
      { label: 'fish', confidence: 0.1 },
    ],
    drawTimeMs,
    bitmap28,
    idempotencyKey: crypto.randomUUID(),
  });

  it('a same-key retry resolves as success and writes once', async () => {
    const db = seed();
    const body = drawing(0.8);
    const net = lossyNetwork(round2Submit);

    const result = await submitWithRetry('/api/round2/submit', body, {
      fetchImpl: net.fetchImpl,
      sleep: noSleep,
    });

    expect(result).toEqual({ ok: true, data: { locked: true, alreadyAnswered: true } });
    expect(net.sent).toHaveLength(2);
    expect(net.sent[1]).toBe(net.sent[0]);
    expect(row(db, 'attempt_round2').submitted_at).not.toBeNull();
    expect(row(db, 'attempt_round2').target_confidence).toBe(0.8);
    expect(db.rowsWritten('attempt_round2')).toEqual([1]);
  });

  it('two copies racing past the check still score once', async () => {
    const db = seed();
    const body = drawing(0.8);
    db.holdUpdatesUntil('attempt_round2', 2);

    const [a, b] = await Promise.all([call(round2Submit, body), call(round2Submit, body)]);

    expect((await a.json()).ok).toBe(true);
    expect((await b.json()).ok).toBe(true);
    expect(db.rowsWritten('attempt_round2')).toEqual([1, 0]);
  });

  it('a later, different submission cannot replace the committed drawing', async () => {
    const db = seed();
    await call(round2Submit, drawing(0.8));
    const pointsAfterFirst = row(db, 'attempt_round2').points;

    const later = await call(round2Submit, drawing(0.05));

    expect((await later.json()).data).toEqual({ locked: true, alreadyAnswered: true });
    expect(row(db, 'attempt_round2').target_confidence).toBe(0.8);
    expect(row(db, 'attempt_round2').points).toBe(pointsAfterFirst);
  });
});

describe('Round 2 — speed bonus uses the attempt’s frozen timing', () => {
  it('measures against the attempt’s saved 12s, whatever the settings say now', async () => {
    const db = seed();
    // Not a value the real database would allow; it proves the route ignores it.
    db.tables.event_settings[0].round2_draw_ms = 60_000;

    const res = await call(round2Submit, {
      attemptId: ATTEMPT,
      targetConfidence: 0.8,
      topPredictions: [{ label: 'cat', confidence: 0.8 }],
      drawTimeMs: 6000,
      bitmap28,
      idempotencyKey: crypto.randomUUID(),
    });

    expect((await res.json()).ok).toBe(true);
    // Recognised: 210 base + 40 × (12000 − 6000) / 12000 = 230.
    // Against the current 60s setting it would have been 246.
    expect(row(db, 'attempt_round2').points).toBe(230);
  });

  it('refuses an attempt with no timing snapshot rather than scoring it on a guess', async () => {
    const db = seed();
    Object.assign(db.tables.attempts[0], {
      round1_ms_per_image: null,
      round2_draw_ms: null,
      round3_ms: null,
    });

    const res = await call(round2Submit, {
      attemptId: ATTEMPT,
      targetConfidence: 0.8,
      topPredictions: [{ label: 'cat', confidence: 0.8 }],
      drawTimeMs: 6000,
      bitmap28,
      idempotencyKey: crypto.randomUUID(),
    });

    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('TIMING_UNAVAILABLE');
    expect(row(db, 'attempt_round2').submitted_at).toBeNull();
    expect(db.rowsWritten('attempt_round2')).toEqual([]);
  });
});

// ===========================================================================
// ROUND 3
// ===========================================================================
describe('Round 3 — response lost after the guess committed', () => {
  const guess = (value: number) => ({ attemptId: ATTEMPT, guess: value, idempotencyKey: crypto.randomUUID() });

  it('a same-key retry resolves as success and writes once', async () => {
    const db = seed();
    const body = guess(14);
    const net = lossyNetwork(round3Answer);

    const result = await submitWithRetry('/api/round3/answer', body, {
      fetchImpl: net.fetchImpl,
      sleep: noSleep,
    });

    expect(result).toEqual({ ok: true, data: { locked: true, alreadyAnswered: true } });
    expect(net.sent).toHaveLength(2);
    expect(net.sent[1]).toBe(net.sent[0]);
    expect(row(db, 'attempt_round3').guess).toBe(14);
    expect(db.rowsWritten('attempt_round3')).toEqual([1]);
  });

  it('two copies racing past the check still score once', async () => {
    const db = seed();
    const body = guess(14);
    db.holdUpdatesUntil('attempt_round3', 2);

    const [a, b] = await Promise.all([call(round3Answer, body), call(round3Answer, body)]);

    expect((await a.json()).ok).toBe(true);
    expect((await b.json()).ok).toBe(true);
    expect(db.rowsWritten('attempt_round3')).toEqual([1, 0]);
  });

  it('a later, different guess cannot replace the committed one, and nothing leaks', async () => {
    const db = seed();
    const first = await call(round3Answer, guess(14));
    const later = await call(round3Answer, guess(30));

    expect(row(db, 'attempt_round3').guess).toBe(14);
    for (const res of [first, later]) {
      expect(JSON.stringify(await res.json())).not.toMatch(/correct|error|points|12|14|30/i);
    }
  });
});

// ===========================================================================
// ROUND 1 TIMEOUT → REFRESH → RESUME
// ===========================================================================
describe('Round 1 timeout survives a refresh', () => {
  it('the timed-out image is not handed back as unanswered by /api/attempt/start', async () => {
    const db = seed(8);

    // 1–3. Slots 1 and 2 answered normally; slot 3 times out.
    await answer(1, 'real');
    await answer(2, 'ai_generated');
    await answer(3, null);

    const timedOut = row(db, 'attempt_round1', 3);
    expect(timedOut.selected_answer).toBeNull();
    expect(timedOut.answered_at).not.toBeNull();

    // The SQL assignment alone still reports slot 3 as unanswered.
    const sqlView = db.runRpc('start_attempt', { p_user_id: 'user-1' }) as {
      round1: { slot: number; answered: boolean }[];
    };
    expect(sqlView.round1.find((s) => s.slot === 3)?.answered).toBe(false);

    // 4–5. Refresh: the client resumes through /api/attempt/start.
    const assignment = await resume();

    // 6. Slot 3 is answered; slots 4–8 are still to play.
    expect(assignment.round1.find((s) => s.slot === 3)?.answered).toBe(true);
    expect(assignment.round1.filter((s) => !s.answered).map((s) => s.slot)).toEqual([4, 5, 6, 7, 8]);
    expect(resumeStep(assignment)).toBe('round1');
  });

  it('a student whose last image timed out resumes at Round 2, not Round 1', async () => {
    seed(8);
    for (let slot = 1; slot <= 7; slot++) await answer(slot, 'real');
    await answer(8, null);

    const assignment = await resume();

    expect(assignment.round1.every((s) => s.answered)).toBe(true);
    expect(resumeStep(assignment)).toBe('round2');
  });
});

// ===========================================================================
// RESUME ON FROZEN TIMING
// ===========================================================================
describe('Resume uses the attempt’s own frozen timing', () => {
  it.each([
    [8, 5000],
    [10, 4000],
  ] as const)('%i-image game resumed mid-round keeps %i ms per image', async (images, msPerImage) => {
    const db = seed(images);
    await answer(1, 'real');
    await answer(2, null);
    await answer(3, 'ai_generated');
    db.tablesRead.length = 0;

    const assignment = await resume();

    expect(assignment.round1).toHaveLength(images);
    expect(assignment.round1.filter((s) => !s.answered).map((s) => s.slot)).toEqual(
      Array.from({ length: images - 3 }, (_, i) => i + 4),
    );
    expect(assignment.timing).toEqual({ round1MsPerImage: msPerImage, round2DrawMs: 12000, round3Ms: 8000 });
    expect(isSixtySecondGame(assignment.round1.length, assignment.timing)).toBe(true);
    expect(resumeStep(assignment)).toBe('round1');
    // Timing never comes from the live settings on the way back in.
    expect(db.tablesRead).not.toContain('event_settings');
  });

  it('switching the preset after an attempt started changes nothing about that attempt', async () => {
    const db = seed(8);
    await answer(1, 'real');
    await answer(2, 'real');

    // An admin moves the event to 10 × 4 (only possible while no real attempt
    // exists; the stand-in does not enforce the lock).
    Object.assign(db.tables.event_settings[0], FORMAT[10]);

    const assignment = await resume();

    expect(assignment.round1).toHaveLength(8);
    expect(assignment.timing?.round1MsPerImage).toBe(5000);
    expect(isSixtySecondGame(assignment.round1.length, assignment.timing)).toBe(true);
  });

  it('an attempt from before the snapshot resumes with null timing, which is not a playable game', async () => {
    const db = seed(8);
    Object.assign(db.tables.attempts[0], {
      round1_ms_per_image: null,
      round2_draw_ms: null,
      round3_ms: null,
    });

    const assignment = await resume();

    expect(assignment.timing).toBeNull();
    expect(isSixtySecondGame(assignment.round1.length, assignment.timing)).toBe(false);
  });
});

// ===========================================================================
// STARTING A GAME
// ===========================================================================
describe('Starting a game', () => {
  it.each([8, 10] as const)('the %i-image preset creates exactly that many assignments', async (images) => {
    const db = seed(images);
    env.userId = 'user-2';

    const res = await call(startAttempt, { modelReady: true });
    const json = await res.json();
    const assignment = json.data as AttemptAssignment;

    expect(json.ok).toBe(true);
    expect(assignment.resumed).toBe(false);
    expect(assignment.round1).toHaveLength(images);
    const created = db.tables.attempts.find((a) => a.user_id === 'user-2')!;
    expect(db.tables.attempt_round1.filter((r) => r.attempt_id === created.id)).toHaveLength(images);
    // The snapshot on the attempt is what the client receives.
    expect(created).toMatchObject({
      round1_ms_per_image: FORMAT[images].round1_ms_per_image,
      round2_draw_ms: 12000,
      round3_ms: 8000,
    });
    expect(assignment.timing).toEqual({
      round1MsPerImage: FORMAT[images].round1_ms_per_image,
      round2DrawMs: 12000,
      round3Ms: 8000,
    });
    expect(isSixtySecondGame(assignment.round1.length, assignment.timing)).toBe(true);
  });

  it('unavailable settings fail cleanly: no attempt used, and a retry succeeds later', async () => {
    const db = seed();
    env.userId = 'user-2';
    const settings = db.tables.event_settings.splice(0, 1);

    const failed = await call(startAttempt, { modelReady: true });
    const failure = await failed.json();

    expect(failed.status).toBe(409);
    expect(failure.ok).toBe(false);
    expect(failure.error.code).toBe('SETTINGS_UNAVAILABLE');
    expect(failure.error.ref).toMatch(/^ERR-/);
    // Nothing was created, so the student's one official attempt is untouched.
    expect(db.tables.attempts.filter((a) => a.user_id === 'user-2')).toHaveLength(0);
    expect(db.tables.attempt_round1.filter((r) => r.attempt_id !== ATTEMPT)).toHaveLength(0);

    // Settings come back; the same student tries again.
    db.tables.event_settings.push(...settings);
    const retried = await (await call(startAttempt, { modelReady: true })).json();

    expect(retried.ok).toBe(true);
    expect((retried.data as AttemptAssignment).resumed).toBe(false);
    expect(db.tables.attempts.filter((a) => a.user_id === 'user-2')).toHaveLength(1);
  });
});
