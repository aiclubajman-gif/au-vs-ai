/**
 * The 60-second format (migration 0015).
 *
 * The database is the authority, but there is no Postgres in this test run, so
 * the migration is checked as text — the same approach security.test.ts takes.
 * These tests pin the specific rules that make a non-60-second game impossible
 * and prove the TypeScript mirror agrees with the SQL it mirrors.
 *
 * What text cannot prove — that the constraints and trigger actually fire —
 * is exercised by supabase/verification/0015_sixty_second_format_checks.sql,
 * which runs a copy of this migration against the real database inside a
 * transaction and rolls it back, before the migration is applied.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GAME_TOTAL_MS,
  ROUND1_MAX_IMAGES,
  ROUND1_PRESETS,
  ROUND1_PRESET_KEYS,
  round1PresetFor,
  isSixtySecondGame,
} from '@/lib/timing';

const MIGRATION = '0015_sixty_second_format.sql';

const read = (...path: string[]) => readFileSync(join(process.cwd(), ...path), 'utf8').replace(/\r\n/g, '\n');

const raw = read('supabase', 'migrations', MIGRATION);

/** Drops -- comments (whole-line and trailing) so prose cannot satisfy a check. */
const stripComments = (text: string) =>
  text
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');

const sql = stripComments(raw);

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Top-level statements in order, squashed. Semicolons inside $$ bodies do not split. */
function statementsOf(text: string): string[] {
  const out: string[] = [];
  let current = '';
  let inBody = false;
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith('$$', i)) {
      inBody = !inBody;
      current += '$$';
      i++;
    } else if (text[i] === ';' && !inBody) {
      if (current.trim()) out.push(squash(current));
      current = '';
    } else {
      current += text[i];
    }
  }
  if (current.trim()) out.push(squash(current));
  return out;
}

/** The body of `create or replace function public.<name>` up to its closing $$. */
function functionBody(name: string): string {
  const start = sql.search(new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\(`, 'i'));
  if (start < 0) throw new Error(`function ${name} not found in ${MIGRATION}`);
  const open = sql.indexOf('$$', start);
  const close = sql.indexOf('$$', open + 2);
  return sql.slice(open + 2, close);
}

/** The text of one named CHECK constraint. */
function constraint(name: string): string {
  const at = sql.indexOf(`add constraint ${name} check`);
  if (at < 0) throw new Error(`constraint ${name} not found in ${MIGRATION}`);
  let depth = 0;
  let i = sql.indexOf('(', at);
  const from = i;
  for (; i < sql.length; i++) {
    if (sql[i] === '(') depth++;
    if (sql[i] === ')' && --depth === 0) break;
  }
  return squash(sql.slice(from + 1, i));
}

// The fixed values the database requires for Rounds 2 and 3.
const round2Fixed = Number(constraint('event_settings_round2_fixed').match(/round2_draw_ms = (\d+)/)![1]);
const round3Fixed = Number(constraint('event_settings_round3_fixed').match(/round3_ms = (\d+)/)![1]);

// ===========================================================================
// THE INVARIANT
// ===========================================================================
describe('60-second invariant', () => {
  it('Rounds 2 and 3 are fixed at 12s and 8s', () => {
    expect(round2Fixed).toBe(12_000);
    expect(round3Fixed).toBe(8_000);
  });

  it('the database allows exactly the presets the app offers, and no others', () => {
    const preset = constraint('event_settings_round1_preset');
    const pairs = [...preset.matchAll(/round1_image_count = (\d+) and round1_ms_per_image = (\d+)/g)].map(
      (m) => [Number(m[1]), Number(m[2])],
    );
    expect(pairs).toEqual(ROUND1_PRESET_KEYS.map((k) => [ROUND1_PRESETS[k].imageCount, ROUND1_PRESETS[k].msPerImage]));
    // Only OR between the pairs: nothing else can satisfy the constraint.
    expect(preset.replace(/\(round1_image_count = \d+ and round1_ms_per_image = \d+\)/g, 'P')).toBe('P or P');
  });

  it.each(ROUND1_PRESET_KEYS)('preset %s: Round 1 is 40s and the game is exactly 60s', (key) => {
    const { imageCount, msPerImage } = ROUND1_PRESETS[key];
    expect(imageCount * msPerImage).toBe(40_000);
    expect(imageCount * msPerImage + round2Fixed + round3Fixed).toBe(GAME_TOTAL_MS);
  });

  it('there are exactly two presets: 8 × 5s and 10 × 4s', () => {
    expect(ROUND1_PRESETS).toEqual({
      '8x5': { imageCount: 8, msPerImage: 5000 },
      '10x4': { imageCount: 10, msPerImage: 4000 },
    });
  });

  it('the database also requires the total itself to be 60000 ms', () => {
    expect(constraint('event_settings_sixty_seconds')).toBe(
      'round1_image_count * round1_ms_per_image + round2_draw_ms + round3_ms = 60000',
    );
  });

  it('new column defaults make the 8 × 5s preset', () => {
    const s = squash(sql);
    expect(s).toMatch(/alter column round1_image_count set default 8,/);
    expect(s).toMatch(/alter column round1_image_count set not null,/);
    expect(s).toMatch(/alter column round1_ms_per_image set default 5000,/);
    expect(s).toMatch(/alter column round2_draw_ms set default 12000,/);
    expect(s).toMatch(/alter column round3_ms set default 8000;/);
  });

  it('Round 1 slots may run from 1 to 10, matching the app', () => {
    expect(squash(sql)).toMatch(/add constraint attempt_round1_slot_range check \(slot between 1 and 10\)/);
    expect(ROUND1_MAX_IMAGES).toBe(10);
  });
});

// ===========================================================================
// MIGRATING THE LIVE SETTINGS ROW
//
// Regression guard for an ordering mistake: adding round1_image_count as
// NOT NULL DEFAULT 8 fills the existing row with 8, so a later
// "update ... where round1_image_count is null" never runs, the row keeps
// 8000 / 20000 / 8000, and the CHECK constraints fail the whole migration.
//
// The event_settings statements are replayed here, in file order, against the
// row as the database holds it today.
// ===========================================================================
describe('0015 migrates the live settings row before constraining it', () => {
  type Row = Record<string, number | null>;

  const statements = statementsOf(sql);
  const indexOf = (re: RegExp) => {
    const at = statements.findIndex((s) => re.test(s));
    if (at < 0) throw new Error(`no statement matches ${re}`);
    return at;
  };

  const SETTINGS_CONSTRAINTS = [
    'event_settings_round1_preset',
    'event_settings_round2_fixed',
    'event_settings_round3_fixed',
    'event_settings_sixty_seconds',
  ];

  const addColumnAt = indexOf(/^alter table public\.event_settings add column if not exists round1_image_count\b/);
  const initUpdates = statements.filter((s) => /^update public\.event_settings\b/.test(s));
  const initUpdateAt = indexOf(/^update public\.event_settings\b/);
  const defaultAt = indexOf(/alter column round1_image_count set default 8\b/);
  const notNullAt = indexOf(/alter column round1_image_count set not null\b/);
  const firstCheckAt = indexOf(/add constraint event_settings_\w+ check\b/);
  const triggerAt = indexOf(/^create trigger event_settings_round1_format_lock\b/);

  /**
   * A SQL boolean expression made of =, and, or, is [not] null, *, + over
   * integers, as a JS predicate that is true exactly when SQL says TRUE. With
   * no NOT and no <>, a NULL comparison can be read as false without changing
   * which rows come out TRUE. Anything else fails to compile, loudly.
   */
  function sqlIsTrue(expr: string): (row: Row) => boolean {
    const js = squash(expr)
      .replace(/<>|!=|\bnot\b(?! null)/g, (m) => {
        throw new Error(`unsupported SQL in test predicate: ${m}`);
      })
      .replace(/\b[a-z_][a-z0-9_]*\b/g, (id) => (['and', 'or', 'is', 'not', 'null'].includes(id) ? id : `r.${id}`))
      .replace(/ is not null\b/g, ' !== null')
      .replace(/ is null\b/g, ' === null')
      .replace(/\band\b/g, '&&')
      .replace(/\bor\b/g, '||')
      .replace(/ = /g, ' === ');
    return new Function('r', `return (${js}) === true;`) as (row: Row) => boolean;
  }

  /** The first-run UPDATE: what it sets, and which rows it selects. */
  const init = (() => {
    const m = initUpdates[0].match(/^update public\.event_settings set (.+?) where (.+)$/);
    if (!m) throw new Error('first-run update has no WHERE clause');
    const set: Row = Object.fromEntries(
      m[1].split(/\s*,\s*/).map((pair) => {
        const [column, value] = pair.split(/\s*=\s*/);
        return [column, Number(value)];
      }),
    );
    const where = m[2];
    const notTrue = where.match(/^\((.+)\) is not true$/);
    const selects = notTrue
      ? ((inner) => (row: Row) => !inner(row))(sqlIsTrue(notTrue[1]))
      : sqlIsTrue(where);
    return { set, where, selects };
  })();

  const satisfiesChecks = (row: Row) => SETTINGS_CONSTRAINTS.every((name) => sqlIsTrue(constraint(name))(row));

  /** Replays a → b → c → d on one row, throwing where Postgres would fail. */
  function migrateSettingsRow(before: Row): Row {
    const row: Row = { ...before };
    if (!('round1_image_count' in row)) {
      // ADD COLUMN fills existing rows with the column default, if it has one.
      const def = statements[addColumnAt].match(/\bdefault (\d+)/);
      row.round1_image_count = def ? Number(def[1]) : null;
    }
    if (init.selects(row)) Object.assign(row, init.set);
    if (row.round1_image_count === null) throw new Error('SET NOT NULL fails: round1_image_count is null');
    for (const name of SETTINGS_CONSTRAINTS) {
      if (!sqlIsTrue(constraint(name))(row)) {
        throw new Error(`${name} rejects ${JSON.stringify(row)}`);
      }
    }
    return row;
  }

  /** The row as 0009 left it: the live values this migration must handle. */
  const live: Row = (() => {
    const m = squash(stripComments(read('supabase', 'migrations', '0009_four_round1_images.sql'))).match(
      /update public\.event_settings set round1_ms_per_image = (\d+), round2_draw_ms = (\d+), round3_ms = (\d+) where id = 1;/,
    );
    if (!m) throw new Error('0009 timing update not found');
    return { id: 1, round1_ms_per_image: Number(m[1]), round2_draw_ms: Number(m[2]), round3_ms: Number(m[3]) };
  })();

  it('the live row today is 8000 / 20000 / 8000', () => {
    expect(live).toEqual({ id: 1, round1_ms_per_image: 8000, round2_draw_ms: 20000, round3_ms: 8000 });
  });

  it('a. adds round1_image_count nullable, with no default and no constraint', () => {
    expect(statements[addColumnAt]).toBe(
      'alter table public.event_settings add column if not exists round1_image_count smallint',
    );
  });

  it('b. rewrites the row before anything relies on it: default, NOT NULL, CHECKs, lock', () => {
    expect(initUpdates).toHaveLength(1);
    expect(addColumnAt).toBeLessThan(initUpdateAt);
    expect(initUpdateAt).toBeLessThan(defaultAt);
    expect(initUpdateAt).toBeLessThan(notNullAt);
    expect(notNullAt).toBeLessThan(firstCheckAt);
    expect(firstCheckAt).toBeLessThan(triggerAt);
    // Nothing between adding the column and the update touches it.
    for (const s of statements.slice(addColumnAt + 1, initUpdateAt)) {
      expect(s).not.toMatch(/round1_image_count/);
    }
  });

  it('b. sets exactly 8 × 5000 / 12000 / 8000', () => {
    expect(init.set).toEqual({
      round1_image_count: 8,
      round1_ms_per_image: 5000,
      round2_draw_ms: 12000,
      round3_ms: 8000,
    });
    expect(satisfiesChecks(init.set)).toBe(true);
  });

  it('b. selects rows by "not a valid format", never by the new column being NULL', () => {
    expect(init.where).not.toMatch(/is null/);
    expect(init.where).toBe(
      `( (${constraint('event_settings_round1_preset')}) and ${constraint('event_settings_round2_fixed')} and ${constraint('event_settings_round3_fixed')} ) is not true`,
    );
  });

  it('b. selects every row the CHECKs would reject, and no row they accept', () => {
    for (const count of [null, 4, 8, 10])
      for (const ms of [4000, 5000, 6000, 8000])
        for (const r2 of [12000, 20000])
          for (const r3 of [8000, 12000]) {
            const row = { round1_image_count: count, round1_ms_per_image: ms, round2_draw_ms: r2, round3_ms: r3 };
            const valid = count !== null && satisfiesChecks(row);
            expect(init.selects(row), JSON.stringify(row)).toBe(!valid);
          }
  });

  it('the live 8000 / 20000 / 8000 row migrates to 8 × 5000 / 12000 / 8000', () => {
    expect(migrateSettingsRow(live)).toEqual({
      id: 1,
      round1_image_count: 8,
      round1_ms_per_image: 5000,
      round2_draw_ms: 12000,
      round3_ms: 8000,
    });
  });

  it('it still migrates if round1_image_count already reads 8 (the default-first mistake)', () => {
    expect(migrateSettingsRow({ ...live, round1_image_count: 8 })).toMatchObject(init.set);
    expect(migrateSettingsRow({ ...live, round1_image_count: 10 })).toMatchObject(init.set);
    expect(migrateSettingsRow({ ...live, round1_image_count: null })).toMatchObject(init.set);
  });

  it('a re-run leaves a valid preset alone, so it cannot undo 10 × 4 or trip the lock', () => {
    const tenByFour = { id: 1, round1_image_count: 10, round1_ms_per_image: 4000, round2_draw_ms: 12000, round3_ms: 8000 };
    expect(init.selects(tenByFour)).toBe(false);
    expect(migrateSettingsRow(tenByFour)).toEqual(tenByFour);
  });

  it('the replay itself catches the mistake it guards against', () => {
    // Same shape as the broken version: NOT NULL DEFAULT 8, then "where ... is null".
    const broken = (row: Row): Row => {
      const next = { ...row, round1_image_count: 8 };
      if (sqlIsTrue('id = 1 and round1_image_count is null')(next)) Object.assign(next, init.set);
      return next;
    };
    const after = broken(live);
    expect(after).toMatchObject({ round1_image_count: 8, round1_ms_per_image: 8000, round2_draw_ms: 20000 });
    expect(satisfiesChecks(after)).toBe(false);
  });

  it('8 × 5s and 10 × 4s satisfy every settings CHECK; arbitrary timings do not', () => {
    const row = (n: number, ms: number, r2: number, r3: number) => ({
      round1_image_count: n,
      round1_ms_per_image: ms,
      round2_draw_ms: r2,
      round3_ms: r3,
    });
    expect(satisfiesChecks(row(8, 5000, 12000, 8000))).toBe(true);
    expect(satisfiesChecks(row(10, 4000, 12000, 8000))).toBe(true);
    for (const bad of [
      row(8, 8000, 20000, 8000), // today's timings
      row(4, 8000, 20000, 8000), // the old format, also 60s
      row(8, 4000, 12000, 8000),
      row(10, 5000, 12000, 8000),
      row(8, 5000, 13000, 8000),
      row(8, 5000, 12000, 9000),
      row(10, 4000, 12000, 7000), // 59s
      row(6, 5000, 12000, 18000), // 60s, but not a preset
    ]) {
      expect(satisfiesChecks(bad), JSON.stringify(bad)).toBe(false);
    }
  });
});

describe('Client-side 60-second check', () => {
  const timing = (round1MsPerImage: number) => ({ round1MsPerImage, round2DrawMs: 12000, round3Ms: 8000 });

  it('accepts both presets', () => {
    expect(isSixtySecondGame(8, timing(5000))).toBe(true);
    expect(isSixtySecondGame(10, timing(4000))).toBe(true);
  });

  it('rejects an image count that does not match its per-image time', () => {
    expect(isSixtySecondGame(10, timing(5000))).toBe(false);
    expect(isSixtySecondGame(8, timing(4000))).toBe(false);
    expect(isSixtySecondGame(4, timing(5000))).toBe(false);
  });

  it('rejects missing, partial or nonsensical timing', () => {
    expect(isSixtySecondGame(8, null)).toBe(false);
    expect(isSixtySecondGame(8, undefined)).toBe(false);
    expect(isSixtySecondGame(0, timing(5000))).toBe(false);
    expect(isSixtySecondGame(11, { round1MsPerImage: 4000, round2DrawMs: 8000, round3Ms: 8000 })).toBe(false);
    expect(isSixtySecondGame(8, { round1MsPerImage: 5000, round2DrawMs: 20000, round3Ms: 0 })).toBe(false);
    expect(isSixtySecondGame(8, { round1MsPerImage: 5000.5, round2DrawMs: 11996, round3Ms: 8000 })).toBe(false);
    expect(isSixtySecondGame(8, { round1MsPerImage: NaN, round2DrawMs: 12000, round3Ms: 8000 })).toBe(false);
  });

  it('names the preset a stored pair belongs to', () => {
    expect(round1PresetFor(8, 5000)).toBe('8x5');
    expect(round1PresetFor(10, 4000)).toBe('10x4');
    expect(round1PresetFor(4, 8000)).toBeNull();
    expect(round1PresetFor(10, 5000)).toBeNull();
  });
});

// ===========================================================================
// ATTEMPT SNAPSHOT
// ===========================================================================
describe('Attempt timing snapshot', () => {
  it('attempts gain three timing columns that are all set or all null', () => {
    const s = squash(sql);
    for (const col of ['round1_ms_per_image', 'round2_draw_ms', 'round3_ms']) {
      expect(s).toContain(`add column if not exists ${col} integer`);
    }
    expect(s).toMatch(
      /add constraint attempts_timing_snapshot check \( \(round1_ms_per_image is null and round2_draw_ms is null and round3_ms is null\) or \(round1_ms_per_image is not null and round2_draw_ms is not null and round3_ms is not null and round1_ms_per_image > 0 and round2_draw_ms > 0 and round3_ms > 0\) \)/,
    );
  });

  it('does not duplicate the image count onto attempts', () => {
    expect(sql).not.toMatch(/alter table public\.attempts[^;]*round1_image_count/i);
  });

  it('get_attempt_assignment returns the ATTEMPT’s timing, never the settings', () => {
    const body = squash(functionBody('get_attempt_assignment'));
    expect(body).toContain(
      "'timing', case when v_attempt.round1_ms_per_image is null then null else jsonb_build_object( 'round1_ms_per_image', v_attempt.round1_ms_per_image, 'round2_draw_ms', v_attempt.round2_draw_ms, 'round3_ms', v_attempt.round3_ms )",
    );
    expect(body).not.toMatch(/event_settings/);
  });
});

// ===========================================================================
// start_attempt
// ===========================================================================
describe('start_attempt()', () => {
  const body = functionBody('start_attempt');
  const flat = squash(body);
  const firstWrite = body.search(/insert\s+into\s+public\.attempts/i);
  const resumeReturn = body.indexOf("jsonb_build_object('resumed', true)");
  const settingsRead = body.search(/from\s+public\.event_settings\s+where\s+id\s*=\s*1\s+for\s+share/i);

  it('resumes an existing attempt before reading settings at all', () => {
    expect(resumeReturn).toBeGreaterThan(-1);
    expect(settingsRead).toBeGreaterThan(resumeReturn);
  });

  it('reads settings FOR SHARE, so a concurrent preset change cannot interleave', () => {
    expect(settingsRead).toBeGreaterThan(-1);
  });

  it('raises SETTINGS_UNAVAILABLE for missing or non-60-second settings BEFORE writing anything', () => {
    const raises = [...body.matchAll(/raise exception 'SETTINGS_UNAVAILABLE'/g)].map((m) => m.index!);
    expect(raises).toHaveLength(2);
    for (const at of raises) expect(at).toBeLessThan(firstWrite);
    expect(flat).toMatch(/if not found then raise exception 'SETTINGS_UNAVAILABLE'/);
    expect(flat).toMatch(
      /or v_image_count \* v_settings\.round1_ms_per_image \+ v_settings\.round2_draw_ms \+ v_settings\.round3_ms <> 60000 then raise exception 'SETTINGS_UNAVAILABLE'/,
    );
  });

  it('assigns exactly the configured image count, with no leftover fixed 4', () => {
    expect(flat).toContain('v_image_count := v_settings.round1_image_count;');
    expect(flat).toMatch(/if v_real_avail \+ v_ai_avail < v_image_count then raise exception 'ROUND1_BANK_TOO_SMALL'/);
    expect(flat).toMatch(
      /if coalesce\(array_length\(v_image_ids, 1\), 0\) <> v_image_count then raise exception 'ROUND1_BANK_UNBALANCED'/,
    );
    expect(flat).not.toMatch(/< 4\b|\b4 - |least\(v_want_real, v_real_avail, 3\)/);
  });

  it('keeps the label mix inside the shared 25–75% bounds and shuffles slot order', () => {
    expect(flat).toMatch(/from public\.round1_real_bounds\(v_image_count, v_real_avail, v_ai_avail\)/);
    expect(flat).toMatch(/if v_real_min > v_real_max then raise exception 'ROUND1_BANK_UNBALANCED'/);
    expect(flat).toMatch(/v_want_ai := v_image_count - v_want_real;/);
    expect(flat).toMatch(/array_agg\(id order by random\(\)\)/);
  });

  it('snapshots all three timings onto the attempt it creates', () => {
    expect(flat).toMatch(
      /insert into public\.attempts \( user_id, status, round2_class_id, round3_question_id, current_round, is_test, valid_for_prize, invalid_reason, round1_ms_per_image, round2_draw_ms, round3_ms \) values \( p_user_id, 'in_progress', v_class_id, v_question_id, 1, coalesce\(v_profile\.is_test, false\), v_prize_ok, v_invalid_note, v_settings\.round1_ms_per_image, v_settings\.round2_draw_ms, v_settings\.round3_ms \)/,
    );
  });
});

describe('round1_real_bounds() — the 25–75% label band', () => {
  const flat = squash(functionBody('round1_real_bounds'));

  it('allows between a quarter and three quarters real, narrowed by supply', () => {
    expect(flat).toBe(
      'select greatest(ceil(p_image_count / 4.0)::integer, p_image_count - p_ai_avail), least(p_image_count - ceil(p_image_count / 4.0)::integer, p_real_avail);',
    );
  });

  // The same arithmetic, to show what the SQL means for the two presets.
  const bounds = (n: number, real: number, ai: number) => [
    Math.max(Math.ceil(n / 4), n - ai),
    Math.min(n - Math.ceil(n / 4), real),
  ];

  it('a healthy bank gives 2–6 real of 8 and 3–7 real of 10', () => {
    expect(bounds(8, 50, 50)).toEqual([2, 6]);
    expect(bounds(10, 50, 50)).toEqual([3, 7]);
    expect(bounds(4, 50, 50)).toEqual([1, 3]);
  });

  it('a bank that cannot fill the preset has no valid split', () => {
    const fillable = (n: number, real: number, ai: number) => {
      const [lo, hi] = bounds(n, real, ai);
      return lo <= hi;
    };
    expect(fillable(10, 2, 2)).toBe(false); // four usable images
    expect(fillable(10, 7, 2)).toBe(false); // too few AI for 3 of 10
    expect(fillable(10, 3, 7)).toBe(true);
    expect(fillable(8, 2, 6)).toBe(true);
    expect(fillable(8, 4, 3)).toBe(false); // seven images
  });
});

// ===========================================================================
// SCORING, BANK HEALTH, LOCK
// ===========================================================================
describe('complete_attempt() — Round 1 from correct / assigned', () => {
  const flat = squash(functionBody('complete_attempt'));

  it('counts assigned and correct rows, and scores round(500 × correct / assigned)', () => {
    expect(flat).toMatch(
      /select count\(\*\), count\(\*\) filter \(where correct\) into v_r1_assigned, v_r1_correct from public\.attempt_round1 where attempt_id = p_attempt_id;/,
    );
    expect(flat).toMatch(/when v_r1_assigned > 0 then round\(500\.0 \* v_r1_correct \/ v_r1_assigned\)::integer/);
  });

  it('no longer sums per-slot points', () => {
    expect(flat).not.toMatch(/sum\(points\)/);
  });

  it('still returns a completed attempt’s stored result instead of rescoring', () => {
    expect(flat).toMatch(
      /if v_attempt\.status = 'completed' then return public\.get_attempt_result_public\(p_attempt_id, p_user_id\);/,
    );
  });
});

describe('round1_bank_health() — judged on the current preset', () => {
  const flat = squash(functionBody('round1_bank_health'));

  it('reports playability for the selected image count, with the same bounds as play', () => {
    expect(flat).toContain("'images_per_game', s.round1_image_count");
    expect(flat).toContain("'playable', coalesce((select can_fill from fill where n = s.round1_image_count), false)");
    expect(flat).toMatch(/lateral public\.round1_real_bounds\(n, bank\.real_count, bank\.ai_count\)/);
    expect(flat).not.toMatch(/>= 4/);
  });

  it('reports both presets, so /admin can show whether a switch would work', () => {
    expect(flat).toContain('(values (8), (10)) as presets(n)');
    expect(flat).toContain("'playable_by_image_count', (select jsonb_object_agg(n::text, can_fill) from fill)");
  });
});

describe('Round 1 format lock', () => {
  const flat = squash(functionBody('guard_round1_format_change'));

  it('refuses a preset change while any non-test attempt that has not been reset exists', () => {
    expect(flat).toMatch(
      /if \(new\.round1_image_count, new\.round1_ms_per_image\) is distinct from \(old\.round1_image_count, old\.round1_ms_per_image\) and exists \( select 1 from public\.attempts where not is_test and status <> 'invalidated' \) then raise exception 'ROUND1_FORMAT_LOCKED'/,
    );
  });

  it("'invalidated' is the status /admin's Reset and Invalidate write, and the only one excluded", () => {
    const route = read('src', 'app', 'api', 'admin', 'attempt', 'route.ts');
    expect(route).toMatch(/if \(action === 'reset' \|\| action === 'invalidate'\) \{\s+const \{ error \} = await admin\s+\.from\('attempts'\)\s+\.update\(\{\s+status: 'invalidated',/);
    expect(flat.match(/status <> '(\w+)'/g)).toEqual(["status <> 'invalidated'"]);
  });

  // The lock's premise: a reset attempt cannot mix formats anywhere public.
  it('reset attempts are excluded from the leaderboard, rank and event totals', () => {
    const views = squash(stripComments(read('supabase', 'migrations', '0004_rls_and_views.sql')));
    expect(views).toMatch(/create or replace view public\.leaderboard_public as .*? where a\.status = 'completed' and not a\.is_test and not p\.is_test;/);
    expect(views).toMatch(/create or replace view public\.score_distribution_public as .*? where a\.status = 'completed' and not a\.is_test group by 1/);
    expect(views).toMatch(/create or replace view public\.college_participation_public as .*? where a\.status = 'completed' and not a\.is_test and not p\.is_test/);
    const eventStats = views.match(/create or replace view public\.event_stats_public as (.*?);/)![1];
    for (const filter of eventStats.match(/filter \( ?where [^)]*\)/g)!) {
      expect(filter).toMatch(/a\.status = '(completed|in_progress)'/);
    }

    const functions0003 = squash(stripComments(read('supabase', 'migrations', '0003_attempt_functions.sql')));
    const resultFn = functions0003.match(/create or replace function public\.get_attempt_result_public\(.*?\$\$(.*?)\$\$/)![1];
    expect(resultFn.match(/from public\.attempts( a)? where (a\.)?status = 'completed' and not (a\.)?is_test/g)).toHaveLength(3);
  });

  it('runs on every update of either preset column', () => {
    expect(squash(sql)).toMatch(
      /create trigger event_settings_round1_format_lock before update of round1_image_count, round1_ms_per_image on public\.event_settings for each row execute function public\.guard_round1_format_change\(\);/,
    );
  });

  it('the first-run preset update happens before the lock exists', () => {
    expect(sql.indexOf('update public.event_settings')).toBeLessThan(sql.indexOf('create trigger'));
  });
});

// ===========================================================================
// THE REAL-DATABASE REHEARSAL (supabase/verification)
// ===========================================================================
describe('0015 verification script', () => {
  const script = read('supabase', 'verification', '0015_sixty_second_format_checks.sql');
  const statements = statementsOf(stripComments(script));

  it('carries a byte-for-byte copy of the migration, so it rehearses exactly what will be applied', () => {
    const begin = '-- >>>>>>>> BEGIN VERBATIM COPY OF supabase/migrations/0015_sixty_second_format.sql\n';
    const end = '-- <<<<<<<< END VERBATIM COPY OF supabase/migrations/0015_sixty_second_format.sql\n';
    const from = script.indexOf(begin);
    const to = script.indexOf(end);
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    expect(script.slice(from + begin.length, to)).toBe(raw.endsWith('\n') ? raw : `${raw}\n`);
  });

  it('opens a transaction, records the settings, then runs the migration, then the checks', () => {
    expect(statements[0]).toBe('begin');
    expect(statements[1]).toMatch(/^do \$\$ begin perform set_config\( 'verify_0015\.settings_before'/);
    expect(statements[2]).toBe('alter table public.event_settings add column if not exists round1_image_count smallint');
    expect(statements.at(-3)).toMatch(/^do \$\$ declare/);
  });

  it('ends cleanly: a VERIFIED row, then an intentional ROLLBACK — no error is expected', () => {
    expect(statements.at(-2)).toBe(
      "select '0015 VERIFIED: all checks passed' as result, current_setting('verify_0015.summary') as details",
    );
    expect(statements.at(-1)).toBe('rollback');
    expect(statements.filter((s) => /^(commit|end|rollback)\b/.test(s))).toEqual(['rollback']);
    expect(script).not.toMatch(/raise exception '0015 VERIFIED/);
  });

  it('undoes its temporary data inside the checks, and only a failed check escapes', () => {
    const checks = statements.at(-3)!;
    expect(checks).toMatch(
      /raise exception using errcode = 'VR015', message = 'undo temporary check data'; exception when sqlstate 'VR015' then raise notice '[^']*'; end; perform set_config\('verify_0015\.summary', v_summary, true\); end; \$\$$/,
    );
    expect(checks).not.toMatch(/when others/);
  });

  it('checks the live row migrated to 8 × 5000 / 12000 / 8000 and the constraints were validated', () => {
    const checks = statements.at(-3)!;
    expect(checks).toMatch(
      /if not v_applied then if \(v_settings\.round1_image_count, v_settings\.round1_ms_per_image, v_settings\.round2_draw_ms, v_settings\.round3_ms\) is distinct from \(8, 5000, 12000, 8000\) then raise exception '0015 CHECK FAILED/,
    );
    expect(checks).toMatch(/and convalidated/);
  });

  it('exercises the lock for in progress, abandoned, reset and completed non-test attempts', () => {
    const checks = statements.at(-3)!;
    for (const note of [
      'ok in-progress non-test attempt: preset change refused',
      'ok abandoned non-test attempt: preset change refused',
      'ok reset (invalidated) non-test attempt: preset change allowed',
      'ok completed non-test attempt: preset change refused, other settings still editable',
      'with only test and reset attempts present',
    ]) {
      expect(checks).toContain(note);
    }
  });
});

describe('0015 permissions', () => {
  const s = squash(sql);

  it.each([
    'round1_real_bounds(integer, integer, integer)',
    'start_attempt(uuid)',
    'get_attempt_assignment(uuid)',
    'complete_attempt(uuid, uuid)',
    'round1_bank_health()',
  ])('%s is server-only', (fn) => {
    const escaped = fn.replace(/[()]/g, '\\$&');
    expect(s).toMatch(new RegExp(`revoke all on function public\\.${escaped} from public, anon, authenticated;`));
    expect(s).toMatch(new RegExp(`grant execute on function public\\.${escaped} to service_role;`));
  });

  it('the trigger function is not callable by clients or granted to anyone', () => {
    expect(s).toMatch(/revoke all on function public\.guard_round1_format_change\(\) from public, anon, authenticated;/);
    expect(s).not.toMatch(/grant execute on function public\.guard_round1_format_change/);
  });
});
