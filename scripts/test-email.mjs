/**
 * Sends a REAL verification code to a REAL Ajman University inbox.
 *
 * This is the single most important test before the fair. Supabase's built-in
 * sender only delivers to your own organisation's members and is capped at 2
 * messages/hour, so if custom SMTP is not wired up correctly, students receive
 * nothing at all — and you would discover that on 22 September.
 *
 * Run:  npm run test:email -- 202310421@ajmanuni.ac.ae
 */
import { createClient } from '@supabase/supabase-js';

const RED = '\x1b[31m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', DIM = '\x1b[2m', BOLD = '\x1b[1m', RESET = '\x1b[0m';

const email = process.argv[2]?.trim().toLowerCase();
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!email) {
  console.error(`\n${RED}No email given.${RESET}`);
  console.error(`Usage:  npm run test:email -- 202310421@ajmanuni.ac.ae\n`);
  process.exit(1);
}

if (!/^[^@\s]+@ajmanuni\.ac\.ae$/.test(email)) {
  console.error(`\n${RED}Not an Ajman University address.${RESET}`);
  console.error(`This test must use a real @ajmanuni.ac.ae inbox — university mail`);
  console.error(`filters are exactly what we are testing.\n`);
  process.exit(1);
}

if (!URL || !ANON) {
  console.error(`\n${RED}Missing Supabase environment variables.${RESET}\n`);
  process.exit(1);
}

const supabase = createClient(URL, ANON, { auth: { persistSession: false } });

console.log(`\n  ${BOLD}Email delivery test${RESET}`);
console.log(`  ${DIM}to ${email}${RESET}\n`);

const started = Date.now();
const { error } = await supabase.auth.signInWithOtp({
  email,
  options: { shouldCreateUser: true },
});
const elapsed = Date.now() - started;

if (error) {
  console.log(`  ${RED}REQUEST FAILED${RESET} after ${elapsed}ms`);
  console.log(`  ${DIM}${error.message}${RESET}\n`);

  const m = error.message.toLowerCase();
  if (m.includes('rate') || m.includes('limit') || error.status === 429) {
    console.log(`  ${YELLOW}This is a RATE LIMIT.${RESET}`);
    console.log(`  Supabase Dashboard -> Authentication -> Rate Limits`);
    console.log(`  Custom SMTP starts at 30 emails/hour. Raise it to 300-500.`);
    console.log(`  ${DIM}Note: failed attempts consume quota even when no mail is sent.${RESET}\n`);
  } else if (m.includes('smtp') || m.includes('send')) {
    console.log(`  ${YELLOW}This looks like an SMTP problem.${RESET}`);
    console.log(`  Check Authentication -> Emails -> SMTP Settings:`);
    console.log(`    Host      smtp.resend.com`);
    console.log(`    Port      465`);
    console.log(`    Username  resend`);
    console.log(`    Password  your Resend API key`);
    console.log(`    Sender    no-reply@auth.auvsai.com`);
    console.log(`  And confirm the domain is Verified in the Resend dashboard.\n`);
  } else if (m.includes('hook') || m.includes('403') || m.includes('denied')) {
    console.log(`  ${YELLOW}The Before User Created hook may be rejecting this.${RESET}`);
    console.log(`  It should allow @ajmanuni.ac.ae. Check the function is selected`);
    console.log(`  under Authentication -> Hooks.\n`);
  }
  process.exit(1);
}

console.log(`  ${GREEN}Request accepted${RESET} in ${elapsed}ms`);
console.log(`  ${DIM}Supabase handed the message to Resend.${RESET}\n`);

console.log(`  ${BOLD}Now check the inbox and answer these:${RESET}\n`);
console.log(`   1. Did it arrive at all?`);
console.log(`   2. How long did it take?        ${DIM}over 60s is a problem${RESET}`);
console.log(`   3. Inbox or Junk?               ${DIM}Junk means DNS or reputation${RESET}`);
console.log(`   4. Is it a 6-DIGIT CODE?        ${DIM}a clickable link means the${RESET}`);
console.log(`      ${DIM}                            template is missing {{ .Token }}${RESET}`);
console.log(`   5. Does the sender look right?  ${DIM}no-reply@auth.auvsai.com${RESET}\n`);

console.log(`  ${YELLOW}If it landed in Junk:${RESET}`);
console.log(`  Resend -> Domains -> confirm SPF, DKIM and DMARC are all Verified.`);
console.log(`  Then send a few messages a day to board members before the fair so`);
console.log(`  the domain is not brand new when 300 students hit it at once.\n`);

console.log(`  ${YELLOW}If you got a link instead of a code:${RESET}`);
console.log(`  Supabase -> Authentication -> Emails -> Templates -> Magic Link`);
console.log(`  The body must contain {{ .Token }}. This is the single easiest`);
console.log(`  thing to miss and it breaks the whole flow.\n`);
