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
 */
import { describe, it, expect, vi } from 'vitest';
import type { AttemptAssignment } from '@/types';

vi.mock('server-only', () => ({}));

const env = vi.hoisted(() => ({
  db: null as unknown as { client: unknown },
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminSupabase: () => env.db.client,
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
  }),
}));

import { POST as round1Answer } from '@/app/api/round1/answer/route';
import { POST as round2Submit } from '@/app/api/round2/submit/route';
import { POST as round3Answer } from '@/app/api/round3/answer/route';
import { POST as startAttempt } from '@/app/api/attempt/start/route';
import { submitWithRetry } from '@/lib/client/submit';
import { resumeStep } from '@/lib/api/serialize';

// ---------------------------------------------------------------------------
// In-memory stand-in for the subset of the Supabase query builder the routes use
// ---------------------------------------------------------------------------
type Row = Record<string, unknown>;
type QueryResult = { data: unknown; error: null; count?: number };

class FakeSupabase {
  updates: { table: string; rows: number }[] = [];
  rpcCalls: { fn: string; args: Row }[] = [];
  private hold: { table: string; expected: number; waiting: (() => void)[] } | null = null;

  constructor(public tables: Record<string, Row[]>) {}

  readonly client = {
    from: (table: string) => new FakeQuery(this, table),
    rpc: async (fn: string, args: Row) => {
      this.rpcCalls.push({ fn, args });
      return { data: this.runRpc(fn, args), error: null };
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
   * start_attempt() for an existing attempt returns get_attempt_assignment().
   * That SQL (0003) derives Round 1 `answered` from selected_answer, which is
   * NULL for a timeout — reproduced here deliberately.
   */
  runRpc(fn: string, args: Row): unknown {
    if (fn !== 'start_attempt') return null;
    const attempt = this.tables.attempts.find(
      (a) => a.user_id === args.p_user_id && a.status !== 'invalidated',
    )!;
    const r1 = this.tables.attempt_round1.filter((r) => r.attempt_id === attempt.id);
    const r2 = this.tables.attempt_round2.find((r) => r.attempt_id === attempt.id)!;
    const r3 = this.tables.attempt_round3.find((r) => r.attempt_id === attempt.id)!;
    return {
      attempt_id: attempt.id,
      status: attempt.status,
      current_round: attempt.current_round,
      started_at: attempt.started_at,
      resumed: true,
      round1: r1
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
const LABELS = ['real', 'ai_generated', 'real', 'ai_generated'] as const;

function seed(): FakeSupabase {
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
      },
    ],
    attempt_round1: LABELS.map((_, i) => ({
      attempt_id: ATTEMPT,
      slot: i + 1,
      image_id: `img-${i + 1}`,
      selected_answer: null,
      correct: null,
      points: null,
      answered_at: null,
      response_time_ms: null,
    })),
    round1_images: LABELS.map((label, i) => ({ id: `img-${i + 1}`, label })),
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
        round1_ms_per_image: 8000,
        round2_draw_ms: 20000,
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
    // The committed answer is intact and was written exactly once.
    expect(row(db, 'attempt_round1', 2)).toMatchObject({
      selected_answer: 'ai_generated',
      correct: true,
      points: 125,
    });
    expect(db.rowsWritten('attempt_round1')).toEqual([1]);
    expect(db.rpcCount('bump_image_stats')).toBe(1);
  });

  it('a lost timeout response resolves the same way and still scores zero', async () => {
    const db = seed();
    const body = {
      attemptId: ATTEMPT,
      slot: 1,
      selectedAnswer: null,
      responseTimeMs: 8000,
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
      points: 0,
    });
    expect(row(db, 'attempt_round1', 1).answered_at).not.toBeNull();
    expect(db.rowsWritten('attempt_round1')).toEqual([1]);
    expect(db.rpcCount('bump_image_stats')).toBe(0);
  });

  it('two copies of the same submission racing past the check still score once', async () => {
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
    expect(row(db, 'attempt_round1', 3).points).toBe(125);
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
    expect(row(db, 'attempt_round1', 4)).toMatchObject({ selected_answer: 'real', correct: false, points: 0 });
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
      expect(text).not.toMatch(/correct|points|label|real|ai_generated/i);
    }
  });
});

// ===========================================================================
// ROUND 2
// ===========================================================================
describe('Round 2 — response lost after the drawing committed', () => {
  const drawing = (confidence: number) => ({
    attemptId: ATTEMPT,
    targetConfidence: confidence,
    topPredictions: [
      { label: 'cat', confidence },
      { label: 'fish', confidence: 0.1 },
    ],
    drawTimeMs: 9000,
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
  async function answer(slot: number, selectedAnswer: 'real' | 'ai_generated' | null) {
    const res = await call(round1Answer, {
      attemptId: ATTEMPT,
      slot,
      selectedAnswer,
      responseTimeMs: selectedAnswer === null ? 8000 : 2000,
      idempotencyKey: crypto.randomUUID(),
    });
    expect((await res.json()).ok).toBe(true);
  }

  it('the timed-out image is not handed back as unanswered by /api/attempt/start', async () => {
    const db = seed();

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
    const res = await call(startAttempt, {});
    const json = await res.json();
    expect(json.ok).toBe(true);
    const assignment = json.data as AttemptAssignment;

    // 6. Slot 3 is answered; only slot 4 is still to play.
    expect(assignment.round1.find((s) => s.slot === 3)?.answered).toBe(true);
    expect(assignment.round1.filter((s) => !s.answered).map((s) => s.slot)).toEqual([4]);
    expect(resumeStep(assignment)).toBe('round1');
  });

  it('a student whose last image timed out resumes at Round 2, not Round 1', async () => {
    seed();
    await answer(1, 'real');
    await answer(2, 'real');
    await answer(3, 'ai_generated');
    await answer(4, null);

    const json = await (await call(startAttempt, {})).json();
    const assignment = json.data as AttemptAssignment;

    expect(assignment.round1.every((s) => s.answered)).toBe(true);
    expect(resumeStep(assignment)).toBe('round2');
  });
});
