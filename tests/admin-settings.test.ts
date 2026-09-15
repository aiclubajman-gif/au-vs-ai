/**
 * POST /api/admin/settings — the Round 1 preset (migration 0015).
 *
 * Runs the real route. The database stand-in applies the two rules the real
 * database enforces on event_settings — only the preset pairs are valid, and
 * the pair cannot change while a non-test attempt that has not been reset
 * exists — so the route's handling of both can be exercised. That the SQL
 * itself enforces them is checked in sixty-second-format.test.ts and
 * supabase/verification/.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AttemptStatus } from '@/types';

vi.mock('server-only', () => ({}));

type Attempt = { is_test: boolean; status: AttemptStatus };

const env = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  attempts: [] as { is_test: boolean; status: string }[],
  updates: [] as Record<string, unknown>[],
  logged: [] as unknown[][],
}));

vi.mock('@/lib/api/admin-guard', () => ({
  requireAdmin: async () => ({ ok: true, userId: 'admin-1', email: 'board@ajmanuni.ac.ae', canRaffle: false }),
  logAdminAction: async (...args: unknown[]) => {
    env.logged.push(args);
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminSupabase: () => ({
    from: (table: string) => ({
      update: (patch: Record<string, unknown>) => ({
        eq: async () => {
          expect(table).toBe('event_settings');
          env.updates.push(patch);
          const next = { ...env.settings, ...patch };
          const pair = [next.round1_image_count, next.round1_ms_per_image].join('/');
          if (pair !== '8/5000' && pair !== '10/4000') {
            return { error: { message: 'new row violates check constraint "event_settings_round1_preset"' } };
          }
          const changed =
            next.round1_image_count !== env.settings.round1_image_count ||
            next.round1_ms_per_image !== env.settings.round1_ms_per_image;
          // guard_round1_format_change(): not is_test and status <> 'invalidated'
          if (changed && env.attempts.some((a) => !a.is_test && a.status !== 'invalidated')) {
            return { error: { message: 'ROUND1_FORMAT_LOCKED' } };
          }
          env.settings = next;
          return { error: null };
        },
      }),
    }),
  }),
}));

import { POST as saveSettings } from '@/app/api/admin/settings/route';
import { isRound1FormatLocked } from '@/lib/api/format-lock';

function post(body: unknown) {
  return saveSettings(
    new Request('http://localhost/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  env.settings = { round1_image_count: 8, round1_ms_per_image: 5000, round2_draw_ms: 12000, round3_ms: 8000 };
  env.attempts = [];
  env.updates = [];
  env.logged = [];
});

describe('Round 1 preset', () => {
  it('10x4 saves 10 images and 4000 ms together, in one update', async () => {
    const res = await post({ round1Preset: '10x4' });

    expect(res.status).toBe(200);
    expect(env.updates).toEqual([{ round1_image_count: 10, round1_ms_per_image: 4000 }]);
    expect(env.settings).toMatchObject({ round1_image_count: 10, round1_ms_per_image: 4000 });
  });

  it('8x5 saves 8 images and 5000 ms together, in one update', async () => {
    env.settings = { ...env.settings, round1_image_count: 10, round1_ms_per_image: 4000 };

    const res = await post({ round1Preset: '8x5' });

    expect(res.status).toBe(200);
    expect(env.updates).toEqual([{ round1_image_count: 8, round1_ms_per_image: 5000 }]);
  });

  it('logs the change for audit', async () => {
    await post({ round1Preset: '10x4' });
    expect(env.logged).toEqual([
      [
        'admin-1',
        'board@ajmanuni.ac.ae',
        'settings_update',
        'event_settings',
        '1',
        { round1_image_count: 10, round1_ms_per_image: 4000 },
      ],
    ]);
  });

  it('test attempts do not lock the format, in any status', async () => {
    env.attempts = [
      { is_test: true, status: 'in_progress' },
      { is_test: true, status: 'abandoned' },
      { is_test: true, status: 'completed' },
    ];
    expect((await post({ round1Preset: '10x4' })).status).toBe(200);
  });

  it('a reset (invalidated) non-test attempt does not lock the format', async () => {
    env.attempts = [
      { is_test: false, status: 'invalidated' },
      { is_test: false, status: 'invalidated' },
      { is_test: true, status: 'completed' },
    ];
    expect((await post({ round1Preset: '10x4' })).status).toBe(200);
    expect(env.settings).toMatchObject({ round1_image_count: 10, round1_ms_per_image: 4000 });
  });

  it.each<AttemptStatus>(['in_progress', 'abandoned', 'completed'])(
    'a %s non-test attempt locks the format, and nothing changes',
    async (status) => {
      env.attempts = [
        { is_test: true, status: 'completed' },
        { is_test: false, status: 'invalidated' },
        { is_test: false, status },
      ];

      const res = await post({ round1Preset: '10x4' });
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.error.code).toBe('ROUND1_FORMAT_LOCKED');
      expect(json.error.message).toMatch(/Round 1 format locked/);
      expect(env.settings).toMatchObject({ round1_image_count: 8, round1_ms_per_image: 5000 });
      expect(env.logged).toEqual([]);
    },
  );
});

// ===========================================================================
// /admin's lock display — the real query, against in-memory attempts
// ===========================================================================
describe('isRound1FormatLocked() — the /admin count', () => {
  /** Applies the eq/neq filters the query builds, like PostgREST would. */
  function db(rows: Attempt[], opts: { error?: boolean } = {}) {
    const filters: { op: 'eq' | 'neq'; column: keyof Attempt; value: unknown }[] = [];
    const query = {
      select: () => query,
      eq: (column: keyof Attempt, value: unknown) => {
        filters.push({ op: 'eq', column, value });
        return query;
      },
      neq: (column: keyof Attempt, value: unknown) => {
        filters.push({ op: 'neq', column, value });
        return query;
      },
      then: (resolve: (r: { count: number | null; error: unknown }) => void) =>
        resolve(
          opts.error
            ? { count: null, error: { message: 'unavailable' } }
            : {
                count: rows.filter((r) =>
                  filters.every((f) => (f.op === 'eq' ? r[f.column] === f.value : r[f.column] !== f.value)),
                ).length,
                error: null,
              },
        ),
    };
    const client = {
      from: (table: string) => {
        expect(table).toBe('attempts');
        return query;
      },
    };
    return { client: client as unknown as SupabaseClient, filters };
  }

  it('asks exactly the database trigger’s question: not is_test and status <> invalidated', async () => {
    const { client, filters } = db([]);
    await isRound1FormatLocked(client);
    expect(filters).toEqual([
      { op: 'eq', column: 'is_test', value: false },
      { op: 'neq', column: 'status', value: 'invalidated' },
    ]);
  });

  it('1. an in-progress non-test attempt locks', async () => {
    expect(await isRound1FormatLocked(db([{ is_test: false, status: 'in_progress' }]).client)).toBe(true);
    expect(await isRound1FormatLocked(db([{ is_test: false, status: 'abandoned' }]).client)).toBe(true);
  });

  it('2. test attempts do not lock', async () => {
    const rows: Attempt[] = [
      { is_test: true, status: 'in_progress' },
      { is_test: true, status: 'abandoned' },
      { is_test: true, status: 'completed' },
    ];
    expect(await isRound1FormatLocked(db(rows).client)).toBe(false);
  });

  it('3. a reset / invalidated non-test attempt does not lock', async () => {
    const rows: Attempt[] = [
      { is_test: false, status: 'invalidated' },
      { is_test: true, status: 'invalidated' },
    ];
    expect(await isRound1FormatLocked(db(rows).client)).toBe(false);
  });

  it('4. a completed non-test attempt locks', async () => {
    const rows: Attempt[] = [
      { is_test: false, status: 'invalidated' },
      { is_test: false, status: 'completed' },
    ];
    expect(await isRound1FormatLocked(db(rows).client)).toBe(true);
  });

  it('shows locked when the count cannot be read', async () => {
    expect(await isRound1FormatLocked(db([], { error: true }).client)).toBe(true);
  });
});

describe('Raw timer values', () => {
  it.each([
    [{ round1MsPerImage: 3000 }],
    [{ round2DrawMs: 20000 }],
    [{ round3Ms: 12000 }],
    [{ round1ImageCount: 10 }],
    [{ round1Preset: '10x4', round1MsPerImage: 5000 }],
    [{ round1Preset: '12x3' }],
  ])('%j is rejected before the database is touched', async (body) => {
    const res = await post(body);

    expect(res.status).toBe(400);
    expect(env.updates).toEqual([]);
    expect(env.logged).toEqual([]);
  });
});
