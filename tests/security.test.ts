/**
 * Static security audit over the SQL migrations.
 *
 * These tests read the migration files as text. They cannot prove runtime
 * behaviour, but they catch the specific mistakes that are easy to make later
 * under deadline pressure and expensive to notice:
 *
 *   - adding a function without revoking the default PUBLIC EXECUTE grant
 *   - re-adding client read access to a table holding scores or answers
 *   - exposing a Round 3 column through a public view
 *
 * If someone adds a function on 20 September and forgets the revoke, `npm test`
 * fails instead of the hole shipping to the fair.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
const sqlByFile = Object.fromEntries(
  files.map((f) => [f, readFileSync(join(MIGRATIONS_DIR, f), 'utf8')]),
);
const allSql = Object.values(sqlByFile).join('\n');

/** Strip -- line comments so documentation examples aren't parsed as code. */
function stripComments(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');
}

const liveSql = stripComments(allSql);

function declaredFunctions(sql: string): string[] {
  const names = new Set<string>();
  const re = /create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)\s*\(/gi;
    let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) names.add(m[1]);
  return [...names].sort();
}

describe('Migration files', () => {
  it('are present and numbered in order', () => {
    expect(files.length).toBeGreaterThanOrEqual(6);
    expect(files[0]).toMatch(/^0001_/);
    expect(files).toContain('0006_function_permissions.sql');
  });
});

// ===========================================================================
// FUNCTION EXECUTION PERMISSIONS
// ===========================================================================
describe('Function EXECUTE permissions', () => {
  const perms = sqlByFile['0006_function_permissions.sql'];
  const fns = declaredFunctions(liveSql);

  it('finds every function we expect to exist', () => {
    expect(fns).toContain('start_attempt');
    expect(fns).toContain('get_attempt_assignment');
    expect(fns).toContain('get_attempt_result_public');
    expect(fns).toContain('abandon_stale_attempts');
    expect(fns).toContain('is_admin');
    expect(fns).toContain('hook_restrict_au_domain');
    expect(fns).toContain('touch_updated_at');
  });

  it.each(declaredFunctions(liveSql))(
    'revokes PUBLIC execute on %s',
    (fn) => {
      const revokePattern = new RegExp(
        `revoke\\s+all\\s+on\\s+function\\s+public\\.${fn}\\s*\\([^)]*\\)\\s*\\n?\\s*from[^;]*public`,
        'is',
      );
      expect(
        revokePattern.test(perms) || revokePattern.test(liveSql),
        `public.${fn}() has no REVOKE ... FROM public. Postgres grants EXECUTE ` +
          `to PUBLIC by default, so this function is callable by anon and ` +
          `authenticated clients. Add a revoke to 0006_function_permissions.sql.`,
      ).toBe(true);
    },
  );

  it.each(declaredFunctions(liveSql))(
    'revokes anon and authenticated execute on %s',
    (fn) => {
      const re = new RegExp(
        `revoke\\s+all\\s+on\\s+function\\s+public\\.${fn}\\s*\\([^)]*\\)\\s*\\n?\\s*from[^;]*anon[^;]*authenticated`,
        'is',
      );
      expect(re.test(perms) || re.test(liveSql)).toBe(true);
    },
  );

  it('grants the attempt functions only to service_role', () => {
    for (const fn of ['start_attempt', 'get_attempt_assignment', 'get_attempt_result_public']) {
      const re = new RegExp(
        `grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}\\s*\\([^)]*\\)\\s*to\\s+service_role`,
        'i',
      );
      expect(re.test(perms), `${fn} is not granted to service_role`).toBe(true);
    }
  });

  it('never grants execute to anon or authenticated', () => {
    const grants = liveSql.match(/grant\s+execute\s+on\s+function[^;]*;/gi) ?? [];
    for (const g of grants) {
      expect(g).not.toMatch(/\banon\b/i);
      expect(g).not.toMatch(/\bauthenticated\b/i);
    }
  });

  it('keeps the auth hook restricted to supabase_auth_admin', () => {
    expect(perms).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.hook_restrict_au_domain[^;]*to\s+supabase_auth_admin/i,
    );
    const hookGrants =
      liveSql.match(/grant\s+execute\s+on\s+function\s+public\.hook_restrict_au_domain[^;]*;/gi) ?? [];
    for (const g of hookGrants) {
      expect(g).toMatch(/supabase_auth_admin/i);
    }
  });

  it('sets default privileges so future functions are not public', () => {
    expect(perms).toMatch(
      /alter\s+default\s+privileges\s+in\s+schema\s+public\s*\n?\s*revoke\s+execute\s+on\s+functions\s+from\s+public/i,
    );
  });

  it('removes CREATE on the public schema from clients', () => {
    expect(perms).toMatch(/revoke\s+create\s+on\s+schema\s+public\s+from[^;]*public/i);
  });
});

// ===========================================================================
// RLS — NO CLIENT READ ACCESS TO SCORES OR ANSWERS
// ===========================================================================
describe('RLS read exposure', () => {
  const rls = sqlByFile['0004_rls_and_views.sql'];

  function policiesOn(table: string): string[] {
    const re = new RegExp(`create\\s+policy\\s+\\w+\\s+on\\s+public\\.${table}\\b[^;]*;`, 'gi');
    return stripComments(rls).match(re) ?? [];
  }

  it('has NO select policy on attempts (holds all three round scores)', () => {
    expect(policiesOn('attempts')).toHaveLength(0);
  });

  it('has NO policy on round1_images (holds the correct label)', () => {
    expect(policiesOn('round1_images')).toHaveLength(0);
  });

  it('has NO policy on round3_question (holds the correct answer)', () => {
    expect(policiesOn('round3_question')).toHaveLength(0);
  });

  it('has NO policy on any attempt_round table', () => {
    expect(policiesOn('attempt_round1')).toHaveLength(0);
    expect(policiesOn('attempt_round2')).toHaveLength(0);
    expect(policiesOn('attempt_round3')).toHaveLength(0);
  });

  it('has NO policy on event_settings (holds threshold and tolerance)', () => {
    expect(policiesOn('event_settings')).toHaveLength(0);
  });

  it('enables RLS on every gameplay table', () => {
    for (const t of [
      'profiles', 'attempts', 'attempt_round1', 'attempt_round2', 'attempt_round3',
      'round1_images', 'round3_question', 'event_settings', 'admins',
      'dataset_responses', 'dataset_tokens', 'club_registrations',
    ]) {
      expect(rls).toMatch(new RegExp(`alter\\s+table\\s+public\\.${t}\\s+enable\\s+row\\s+level\\s+security`, 'i'));
    }
  });

  it('grants client SELECT only on the intended public views', () => {
    const granted = [...stripComments(rls).matchAll(/grant\s+select\s+on\s+public\.(\w+)\s+to/gi)]
      .map((m) => m[1])
      .sort();
    expect(granted).toEqual([
      'college_participation_public',
      'event_stats_public',
      'leaderboard_public',
      'round1_accuracy_public',
      'round2_recognition_public',
      'score_distribution_public',
    ]);
  });
});

// ===========================================================================
// ROUND 3 SECRECY (§21)
// ===========================================================================
describe('Round 3 secrecy', () => {
  const rls = stripComments(sqlByFile['0004_rls_and_views.sql']);

  it('no public view references the Round 3 tables or answer', () => {
    const views = rls.match(/create\s+or\s+replace\s+view\s+public\.\w+_public[\s\S]*?;/gi) ?? [];
    expect(views.length).toBeGreaterThan(0);
    for (const v of views) {
      expect(v).not.toMatch(/attempt_round3/i);
      expect(v).not.toMatch(/round3_question/i);
      expect(v).not.toMatch(/correct_answer/i);
    }
  });

  it('the result function returns no per-round score', () => {
    const fns = stripComments(sqlByFile['0003_attempt_functions.sql']);
    const body = fns.slice(fns.indexOf('get_attempt_result_public'));
    const returned = body.slice(body.indexOf('jsonb_build_object'), body.indexOf('end;'));
    expect(returned).not.toMatch(/round1_score/);
    expect(returned).not.toMatch(/round2_score/);
    expect(returned).not.toMatch(/round3_score/);
    expect(returned).not.toMatch(/r1_correct_count/);
  });
});

// ===========================================================================
// SCHEMA INVARIANTS
// ===========================================================================
describe('Schema invariants', () => {
  const core = sqlByFile['0001_core_schema.sql'];

  it('enforces one attempt per user with a unique index', () => {
    expect(core).toMatch(/create\s+unique\s+index\s+attempts_one_official_per_user_idx/i);
  });

  it('leaves Round 3 guess nullable so NULL means unanswered', () => {
    const table = core.slice(core.indexOf('create table public.attempt_round3'));
    const guessLine = table.split('\n').find((l) => /^\s*guess\s/.test(l));
    expect(guessLine).toBeDefined();
    expect(guessLine).not.toMatch(/not\s+null/i);
  });

  it('never pre-populates a Round 3 guess at attempt creation', () => {
    const fns = stripComments(sqlByFile['0003_attempt_functions.sql']);
    const insert = fns.match(/insert\s+into\s+public\.attempt_round3[^;]*;/i)?.[0] ?? '';
    expect(insert).not.toMatch(/guess/i);
  });

  it('keeps Round 3 scoring tolerance independent of the slider range', () => {
    const settings = sqlByFile['0002_event_admin_dataset.sql'];
    expect(settings).toMatch(/round3_scoring_tolerance/i);
    expect(settings).toMatch(/round3_scoring_tolerance\s*>\s*0/i);
  });
});

// ===========================================================================
// ADMIN AUTHORIZATION (§30)
// ===========================================================================
describe('Admin route authorization', () => {
  const files = [
    'src/app/api/admin/settings/route.ts',
    'src/app/api/admin/attempt/route.ts',
  ];

  it.each(files)('%s calls requireAdmin before doing anything', (file) => {
    const src = readFileSync(join(process.cwd(), file), 'utf8');
    expect(src).toMatch(/requireAdmin\(\)/);

    // The guard must run before any database client is created, or an
    // unauthorized request could still touch data on its way to being rejected.
    const guardAt = src.indexOf('requireAdmin()');
    const clientAt = src.indexOf('createAdminSupabase()');
    expect(guardAt).toBeGreaterThan(-1);
    if (clientAt > -1) expect(guardAt).toBeLessThan(clientAt);
  });

  it.each(files)('%s rejects with 403, not a redirect', (file) => {
    const src = readFileSync(join(process.cwd(), file), 'utf8');
    // fail('UNAUTHORIZED', messageFor('UNAUTHORIZED'), 403)
    expect(src).toMatch(/fail\(\s*'UNAUTHORIZED'[\s\S]{0,80}?403\s*\)/);
  });

  it.each(files)('%s logs the action for audit', (file) => {
    const src = readFileSync(join(process.cwd(), file), 'utf8');
    expect(src).toMatch(/logAdminAction/);
  });

  it('the admin page checks authorization before fetching data', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/admin/page.tsx'), 'utf8');
    const guardAt = src.indexOf('await requireAdmin()');
    const fetchAt = src.indexOf('createAdminSupabase()');
    expect(guardAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(fetchAt);
  });

  it('admin status comes from the database, never an env var', () => {
    const guard = readFileSync(join(process.cwd(), 'src/lib/api/admin-guard.ts'), 'utf8');
    expect(guard).toMatch(/from\('admins'\)/);
    expect(guard).not.toMatch(/process\.env\.ADMIN/);
  });
});

// ===========================================================================
// LEADERBOARD PRIVACY (§29)
// ===========================================================================
describe('Leaderboard privacy', () => {
  const raw = readFileSync(join(process.cwd(), 'src/app/leaderboard/page.tsx'), 'utf8');

  /**
   * Strip comments before asserting. A comment reading "never render an email"
   * is evidence of care, not a leak — matching on it would make this test fire
   * on the wrong thing.
   */
  const src = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

  it('reads the restricted public view, not the raw tables', () => {
    expect(src).toMatch(/from\('leaderboard_public'\)/);
    expect(src).not.toMatch(/from\('attempts'\)/);
    expect(src).not.toMatch(/from\('profiles'\)/);
  });

  it('never renders an email or a full student id', () => {
    expect(src).not.toMatch(/\bemail\b/i);
    expect(src).not.toMatch(/student_id/);
  });

  it('shows only a masked id suffix', () => {
    expect(src).toMatch(/masked_id_suffix/);
  });

  it('never exposes per-round scores', () => {
    for (const col of ['round1_score', 'round2_score', 'round3_score']) {
      expect(src).not.toContain(col);
    }
  });
});

// ===========================================================================
// ERROR MESSAGING (§46)
// ===========================================================================
describe('Blocked-start messaging', () => {
  const src = readFileSync(
    join(process.cwd(), 'src/components/game/PlayFlow.tsx'),
    'utf8',
  );

  /**
   * A server refusing to start a game is NOT a device problem. Conflating them
   * told students to go find a tablet when the challenge simply was not open
   * yet — sending people away from the booth for no reason.
   */
  it('routes a server refusal to the blocked screen, not the device screen', () => {
    const start = src.indexOf("post('/api/attempt/start'");
    const region = src.slice(start, start + 900);
    expect(region).toMatch(/setStep\('blocked'\)/);
    expect(region).not.toMatch(/setDeviceState\('failed'\)/);
  });

  it('has dedicated copy for every reason start_attempt can refuse', () => {
    for (const code of [
      'CHALLENGE_CLOSED',
      'NEW_GAMES_PAUSED',
      'ROUND1_BANK_TOO_SMALL',
      'ROUND1_BANK_UNBALANCED',
      'NO_ROUND3_QUESTION',
      'NO_DRAWING_CLASSES',
      'PROFILE_REQUIRED',
    ]) {
      expect(src).toContain(`${code}: {`);
    }
  });

  it('only mentions booth tablets when the DEVICE actually failed', () => {
    const copyStart = src.indexOf('const BLOCKED_COPY');
    const copyEnd = src.indexOf('};', copyStart);
    const blockedCopy = src.slice(copyStart, copyEnd);
    expect(blockedCopy).not.toMatch(/tablet/i);
  });

  it('tells the student their attempt is intact when a device fails', () => {
    expect(src).toMatch(/attempt has not been used/i);
  });

  it('shows a reference code only for staff-actionable failures', () => {
    // CHALLENGE_CLOSED is normal, not an error — no scary code for the student.
    const idx = src.indexOf('CHALLENGE_CLOSED: {');
    const block = src.slice(idx, idx + 260);
    expect(block).toMatch(/showRef:\s*false/);

    const idx2 = src.indexOf('NO_ROUND3_QUESTION: {');
    const block2 = src.slice(idx2, idx2 + 260);
    expect(block2).toMatch(/showRef:\s*true/);
  });
});

// ===========================================================================
// STAFF OVERRIDE (§38)
// ===========================================================================
describe('Staff override codes', () => {
  const route = readFileSync(
    join(process.cwd(), 'src/app/api/admin/override/route.ts'),
    'utf8',
  );
  const migration = sqlByFile['0010_staff_override.sql'];

  it('requires an admin', () => {
    const guardAt = route.indexOf('requireAdmin()');
    const clientAt = route.indexOf('createAdminSupabase()');
    expect(guardAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(clientAt);
  });

  it('enforces the AU domain, since createUser bypasses the auth hook', () => {
    expect(route).toMatch(/overrideIssueSchema/);
    const schemas = readFileSync(join(process.cwd(), 'src/lib/validation/index.ts'), 'utf8');
    const idx = schemas.indexOf('overrideIssueSchema');
    expect(schemas.slice(idx, idx + 200)).toMatch(/auEmailSchema/);
  });

  it('uses a REAL Supabase OTP rather than inventing its own', () => {
    expect(route).toMatch(/generateLink/);
    expect(route).toMatch(/email_otp/);
    // No hand-rolled credential generation.
    expect(route).not.toMatch(/Math\.random/);
  });

  it('NEVER stores the issued code (§48)', () => {
    expect(route).toMatch(/code_hash:\s*null/);
    const logCall = route.slice(route.indexOf('logAdminAction'));
    expect(logCall.slice(0, 200)).not.toMatch(/\bcode\b\s*[,}]/);
  });

  it('records who issued it and to whom', () => {
    expect(route).toMatch(/issued_by:\s*auth\.userId/);
    expect(route).toMatch(/logAdminAction/);
  });

  it('marks the account as staff_override, not email_otp', () => {
    expect(route).toMatch(/verification_method:\s*'staff_override'/);
  });

  /**
   * The important one. Prize eligibility must be decided by the database when
   * the attempt is created, not by the admin UI — otherwise a UI bug or a
   * crafted request could hand someone a prize they are not entitled to.
   */
  it('enforces prize eligibility in the DATABASE, not the UI', () => {
    expect(migration).toMatch(/verification_method\s*=\s*'staff_override'/);
    expect(migration).toMatch(/not\s+v_profile\.id_verified/);
    expect(migration).toMatch(/v_prize_ok\s*:=\s*false/);
  });

  it('still passes prize eligibility into the attempt row', () => {
    expect(migration).toMatch(/valid_for_prize/);
    expect(migration).toMatch(/invalid_reason/);
  });

  it('does not weaken the one-attempt guarantee', () => {
    // The unique index is untouched, and the insert still handles the race.
    expect(migration).toMatch(/when unique_violation then/);
    expect(migration).not.toMatch(/drop\s+index\s+attempts_one_official/i);
  });

  it('keeps the function server-only', () => {
    expect(migration).toMatch(
      /revoke all on function public\.start_attempt\(uuid\) from public, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.start_attempt\(uuid\) to service_role/i,
    );
  });
});
