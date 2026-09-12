/**
 * Grants admin access to an AU email.
 *
 * Admin authorization is a database allowlist checked server-side on every
 * request (§30). There is no way to become an admin from the UI, which is the
 * point — a hidden button is not access control.
 *
 * Run:  node --env-file=.env.local scripts/make-admin.mjs you@ajmanuni.ac.ae
 * List: node --env-file=.env.local scripts/make-admin.mjs --list
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', BOLD = '\x1b[1m', RESET = '\x1b[0m';

if (!URL || !SERVICE) {
  console.error(`${RED}Missing Supabase environment variables.${RESET}`);
  process.exit(1);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const arg = process.argv[2]?.trim().toLowerCase();

if (arg === '--list') {
  const { data } = await admin.from('admins').select('email, can_raffle, created_at');
  console.log(`\n  ${BOLD}Current admins${RESET}\n`);
  if (!data?.length) console.log(`  ${DIM}none${RESET}`);
  for (const a of data ?? []) {
    console.log(`  ${a.email}${a.can_raffle ? `  ${DIM}(can run raffle)${RESET}` : ''}`);
  }
  console.log('');
  process.exit(0);
}

if (!arg || !/^[^@\s]+@ajmanuni\.ac\.ae$/.test(arg)) {
  console.error(`\n${RED}Give an Ajman University email.${RESET}`);
  console.error(`Usage: node --env-file=.env.local scripts/make-admin.mjs you@ajmanuni.ac.ae\n`);
  process.exit(1);
}

// The account must exist first, which means they must have signed in once.
const { data: users, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listErr) {
  console.error(`${RED}Could not list users: ${listErr.message}${RESET}`);
  process.exit(1);
}

const user = users.users.find((u) => u.email?.toLowerCase() === arg);

if (!user) {
  console.error(`\n${RED}No account found for ${arg}${RESET}`);
  console.error(`They must sign in at /play at least once before being made an admin.\n`);
  process.exit(1);
}

const { error } = await admin
  .from('admins')
  .upsert({ user_id: user.id, email: arg, can_reset: true, can_raffle: true });

if (error) {
  console.error(`${RED}Failed: ${error.message}${RESET}`);
  process.exit(1);
}

console.log(`\n  ${GREEN}${arg} is now an admin.${RESET}`);
console.log(`  ${DIM}Sign in at /play, then open /admin${RESET}\n`);
