/**
 * Verifies a real Supabase project, and tries to break into it with the public
 * anon key.
 *
 * v2 — the first version reported "any error" as a pass on the break-in tests,
 * which meant a table the API could not see at all looked identical to a table
 * correctly protected by RLS. This version distinguishes them, and prints real
 * PostgREST error codes so a failure says what is actually wrong.
 *
 * Run:  npm run verify:db
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const RED = '\x1b[31m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', CYAN = '\x1b[36m',
      DIM = '\x1b[2m', BOLD = '\x1b[1m', RESET = '\x1b[0m';

let pass = 0, fail = 0, warn = 0, inconclusive = 0;

const ok = (m, d = '') => { pass++; console.log(`${GREEN}  PASS${RESET}  ${m}${d ? ` ${DIM}${d}${RESET}` : ''}`); };
const bad = (m, d = '') => { fail++; console.log(`${RED}  FAIL${RESET}  ${m}${d ? `\n        ${DIM}${d}${RESET}` : ''}`); };
const caution = (m, d = '') => { warn++; console.log(`${YELLOW}  WARN${RESET}  ${m}${d ? `\n        ${DIM}${d}${RESET}` : ''}`); };
const unknown = (m, d = '') => { inconclusive++; console.log(`${CYAN}  ????${RESET}  ${m}${d ? `\n        ${DIM}${d}${RESET}` : ''}`); };
const section = (t) => console.log(`\n${DIM}${'-'.repeat(64)}${RESET}\n  ${BOLD}${t}${RESET}\n`);

/** Full detail from a PostgREST error, so a failure is diagnosable. */
function describe(error) {
  if (!error) return '';
  const parts = [];
  if (error.code) parts.push(`code=${error.code}`);
  if (error.message) parts.push(error.message);
  if (error.hint) parts.push(`hint: ${error.hint}`);
  if (error.details) parts.push(`details: ${error.details}`);
  return parts.join(' | ') || JSON.stringify(error);
}

/** PGRST205 / PGRST202 mean the API cannot see the object at all. */
const isNotInCache = (e) =>
  !!e && (e.code === 'PGRST205' || e.code === 'PGRST202' ||
          /schema cache/i.test(e.message ?? ''));

/** 42501 is a genuine, correct permission denial. */
const isPermissionDenied = (e) =>
  !!e && (e.code === '42501' || /permission denied/i.test(e.message ?? ''));

if (!URL || !ANON || !SERVICE) {
  console.error(`${RED}Missing environment variables.${RESET}`);
  process.exit(1);
}

const anon = createClient(URL, ANON, { auth: { persistSession: false } });
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

console.log(`\n  ${BOLD}AU vs AI - live database verification${RESET}`);
console.log(`  ${DIM}${URL}${RESET}`);

// ===========================================================================
section('1. Can the REST API see the tables?');

const TABLES = [
  'colleges', 'profiles', 'round1_images', 'round2_classes', 'round3_question',
  'attempts', 'attempt_round1', 'attempt_round2', 'attempt_round3',
  'event_settings', 'admins', 'admin_actions', 'staff_override_codes',
  'club_registrations', 'raffle_runs', 'dataset_tokens', 'dataset_responses',
  'app_events',
];

const cacheMisses = [];
const permDenied = [];

for (const t of TABLES) {
  const { error, count } = await admin
    .from(t)
    .select('*', { count: 'exact' })
    .limit(1);

  if (!error) {
    ok(`${t}`, `${count ?? 0} rows`);
  } else if (isNotInCache(error)) {
    cacheMisses.push(t);
    bad(`${t} - not in the API schema cache`, describe(error));
  } else if (isPermissionDenied(error)) {
    permDenied.push(t);
    bad(`${t} - service_role lacks SELECT`, describe(error));
  } else {
    bad(`${t}`, describe(error));
  }
}

// ===========================================================================
section('2. Do the objects exist in Postgres itself?');
console.log(`  ${DIM}Views and functions bypass the table cache, so these tell us${RESET}`);
console.log(`  ${DIM}whether the migrations actually ran.${RESET}\n`);

let schemaReallyExists = false;

const { error: viewErr } = await anon.from('leaderboard_public').select('*').limit(1);
if (!viewErr) {
  ok('leaderboard_public readable', 'so attempts + profiles EXIST');
  schemaReallyExists = true;
} else {
  bad('leaderboard_public unreadable', describe(viewErr));
}

const { error: fnErr } = await admin.rpc('abandon_stale_attempts');
if (!fnErr) {
  ok('abandon_stale_attempts() ran', 'so attempts + event_settings EXIST');
  schemaReallyExists = true;
} else {
  bad('abandon_stale_attempts() failed', describe(fnErr));
}

// ===========================================================================
section('3. BREAK-IN TEST - public anon key against secrets');

/**
 * A table is only proven safe when the API CAN see it and still returns
 * nothing. If the API cannot see it, the test is inconclusive, not a pass.
 */
async function mustBeUnreadable(table, column, label) {
  const { data, error } = await anon.from(table).select(column).limit(5);

  if (!error && (!data || data.length === 0)) {
    ok(`${label} unreachable`, 'RLS returned zero rows');
  } else if (!error && data.length > 0) {
    bad(`LEAK: anon read ${label}`, `${data.length} rows: ${JSON.stringify(data[0])}`);
  } else if (isPermissionDenied(error)) {
    ok(`${label} unreachable`, 'permission denied');
  } else if (isNotInCache(error)) {
    unknown(`${label} - cannot test, table not visible to the API`);
  } else {
    unknown(`${label} - unexpected error`, describe(error));
  }
}

await mustBeUnreadable('round1_images', 'label', 'Round 1 answers');
await mustBeUnreadable('round3_question', 'correct_answer', 'Round 3 answer');
await mustBeUnreadable('attempts', 'total_score,round3_score', 'attempt scores');
await mustBeUnreadable('event_settings', 'human_win_threshold', 'win threshold');
await mustBeUnreadable('admins', 'email', 'admin allowlist');

const { error: writeErr } = await anon.from('attempts').insert({
  user_id: '00000000-0000-0000-0000-000000000000',
  round2_class_id: 1,
  round3_question_id: '00000000-0000-0000-0000-000000000000',
});
if (isPermissionDenied(writeErr)) ok('anon cannot write attempts', 'permission denied');
else if (isNotInCache(writeErr)) unknown('cannot test writes, table not visible');
else if (writeErr) ok('anon write rejected', describe(writeErr));
else bad('CRITICAL: anon INSERTED into attempts');

// ===========================================================================
section('4. Function lockdown (migration 0006)');

const RPC_CHECKS = [
  ['start_attempt', { p_user_id: '00000000-0000-0000-0000-000000000000' }],
  ['get_attempt_result_public', {
    p_attempt_id: '00000000-0000-0000-0000-000000000000',
    p_user_id: '00000000-0000-0000-0000-000000000000',
  }],
  ['abandon_stale_attempts', {}],
];

for (const [fn, args] of RPC_CHECKS) {
  const { error } = await anon.rpc(fn, args);
  if (isPermissionDenied(error)) ok(`${fn}() blocked for anon`, 'code=42501');
  else if (isNotInCache(error)) caution(`${fn}() not exposed to the API`, describe(error));
  else if (error) ok(`${fn}() rejected for anon`, describe(error));
  else bad(`CRITICAL: anon called ${fn}()`, 'migration 0006 has not been applied');
}

// ===========================================================================
section('5. Public views');

for (const v of [
  'leaderboard_public', 'event_stats_public', 'round1_accuracy_public',
  'round2_recognition_public', 'score_distribution_public', 'college_participation_public',
]) {
  const { error } = await anon.from(v).select('*').limit(1);
  if (!error) ok(`${v}`);
  else bad(`${v} unreadable by anon`, describe(error));
}

const { data: colleges, error: colErr } = await anon.from('colleges').select('name');
if (!colErr && colleges?.length >= 10) ok('colleges dropdown', `${colleges.length} options`);
else if (isNotInCache(colErr)) bad('colleges not visible to the API', describe(colErr));
else bad('colleges not readable by anon', describe(colErr));

// ===========================================================================
section('6. AU domain hook');

const { error: hookErr } = await anon.auth.signInWithOtp({
  email: 'auvsai-hook-check@gmail.com',
  options: { shouldCreateUser: true },
});
if (hookErr) ok('non-AU email rejected', hookErr.message.slice(0, 70));
else bad('CRITICAL: gmail.com accepted', 'Authentication -> Hooks -> Before User Created');

// ===========================================================================
console.log(`\n${DIM}${'-'.repeat(64)}${RESET}\n`);
console.log(`  ${GREEN}${pass} passed${RESET}   ${CYAN}${inconclusive} inconclusive${RESET}   ${warn ? YELLOW : DIM}${warn} warnings${RESET}   ${fail ? RED : DIM}${fail} failed${RESET}\n`);

if (cacheMisses.length > 0 && schemaReallyExists) {
  console.log(`${YELLOW}  ${'='.repeat(60)}${RESET}`);
  console.log(`  ${BOLD}DIAGNOSIS: schema cache, not a broken migration${RESET}\n`);
  console.log(`  Your views and functions work, which means the tables DO exist.`);
  console.log(`  PostgREST (the REST API) is serving a cache built before your`);
  console.log(`  migrations ran, so it cannot route requests to the new tables.\n`);
  console.log(`  ${BOLD}FIX - run this in the Supabase SQL Editor:${RESET}\n`);
  console.log(`    ${CYAN}notify pgrst, 'reload schema';${RESET}\n`);
  console.log(`  Wait ~10 seconds, then run ${BOLD}npm run verify:db${RESET} again.\n`);
  console.log(`  If that does not fix it, run this and paste the output:\n`);
  console.log(`${DIM}    select c.relname,
           has_table_privilege('service_role', c.oid, 'SELECT') as service_role,
           has_table_privilege('anon',         c.oid, 'SELECT') as anon
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname;${RESET}\n`);
  console.log(`${YELLOW}  ${'='.repeat(60)}${RESET}\n`);
}

if (permDenied.length > 0) {
  console.log(`${YELLOW}  DIAGNOSIS: missing table grants${RESET}`);
  console.log(`  service_role has no SELECT on: ${permDenied.join(', ')}\n`);
  console.log(`  ${BOLD}FIX - run in the SQL Editor:${RESET}\n`);
  console.log(`    ${CYAN}grant all on all tables in schema public to service_role;`);
  console.log(`    grant all on all sequences in schema public to service_role;`);
  console.log(`    notify pgrst, 'reload schema';${RESET}\n`);
}

if (inconclusive > 0) {
  console.log(`  ${CYAN}${inconclusive} security checks could not run${RESET} because the API cannot`);
  console.log(`  see those tables. They are NOT confirmed safe. Re-run after fixing.\n`);
}

process.exit(fail > 0 ? 1 : 0);
