/**
 * Asks Resend directly why mail is not arriving.
 *
 * The most common cause of "Supabase accepted it but nothing arrived" is that
 * the sending domain is not fully verified. Until every DNS record is verified,
 * Resend restricts sending to the address that owns the Resend account — so a
 * send to a student address is rejected, while Supabase still reports success
 * because it handed the message off without waiting for the verdict.
 *
 * Run:  npm run check:resend
 * Needs RESEND_API_KEY in .env.local (Resend dashboard -> API Keys).
 */
const KEY = process.env.RESEND_API_KEY;

const RED = '\x1b[31m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', CYAN = '\x1b[36m',
      DIM = '\x1b[2m', BOLD = '\x1b[1m', RESET = '\x1b[0m';

if (!KEY) {
  console.error(`\n${RED}RESEND_API_KEY is not set.${RESET}\n`);
  console.error(`  1. Go to resend.com -> API Keys`);
  console.error(`  2. Copy your key (starts with re_)`);
  console.error(`  3. Add this line to .env.local:\n`);
  console.error(`       ${CYAN}RESEND_API_KEY=re_xxxxxxxxxxxx${RESET}\n`);
  console.error(`  This is the same key you put in Supabase's SMTP password field.\n`);
  process.exit(1);
}

console.log(`\n  ${BOLD}Resend diagnostics${RESET}\n`);

const res = await fetch('https://api.resend.com/domains', {
  headers: { Authorization: `Bearer ${KEY}` },
});

if (!res.ok) {
  const body = await res.text();
  console.log(`  ${RED}Resend rejected the API key${RESET} (HTTP ${res.status})`);
  console.log(`  ${DIM}${body}${RESET}\n`);
  if (res.status === 401) {
    console.log(`  The key is wrong or was revoked. Create a new one at`);
    console.log(`  resend.com -> API Keys, and update BOTH .env.local and the`);
    console.log(`  SMTP password field in Supabase.\n`);
  }
  process.exit(1);
}

const { data: domains = [] } = await res.json();

if (domains.length === 0) {
  console.log(`  ${RED}No domains registered in Resend.${RESET}\n`);
  console.log(`  Without a verified domain, Resend will only deliver to the email`);
  console.log(`  address that owns your Resend account. Every send to a student`);
  console.log(`  address is silently dropped.\n`);
  console.log(`  ${BOLD}Fix:${RESET} resend.com -> Domains -> Add Domain -> auth.auvsai.com\n`);
  process.exit(1);
}

let allGood = true;

for (const d of domains) {
  const verified = d.status === 'verified';
  const mark = verified ? `${GREEN}verified${RESET}` : `${RED}${d.status}${RESET}`;
  console.log(`  ${BOLD}${d.name}${RESET}  ${mark}  ${DIM}region ${d.region ?? 'n/a'}${RESET}`);

  if (!verified) allGood = false;

  for (const r of d.records ?? []) {
    const rverified = r.status === 'verified';
    if (!rverified) allGood = false;
    const icon = rverified ? `${GREEN}  ok  ${RESET}` : `${RED} MISS ${RESET}`;
    console.log(`   ${icon} ${r.record}  ${DIM}${r.type}  ${String(r.name).slice(0, 44)}${RESET}`);
    if (!rverified) {
      console.log(`          ${DIM}expected value: ${String(r.value).slice(0, 70)}${RESET}`);
    }
  }
  console.log('');
}

if (allGood) {
  console.log(`  ${GREEN}All DNS records verified.${RESET}\n`);
  console.log(`  So Resend CAN send. If mail still is not arriving, the message`);
  console.log(`  either never reached Resend, or Ajman's mail server took it and`);
  console.log(`  filed it somewhere.\n`);
  console.log(`  ${BOLD}Check next, in this order:${RESET}\n`);
  console.log(`   1. ${CYAN}resend.com -> Logs${RESET}`);
  console.log(`      An entry for your address means Supabase reached Resend.`);
  console.log(`      Status tells you the rest: Delivered, Bounced, or Complained.`);
  console.log(`      ${DIM}NO entry at all = Supabase is not actually using Resend.${RESET}\n`);
  console.log(`   2. ${CYAN}Supabase -> Logs -> Auth Logs${RESET}`);
  console.log(`      Filter for the last few minutes. An SMTP error appears here.\n`);
  console.log(`   3. ${CYAN}Supabase -> Authentication -> Emails -> SMTP Settings${RESET}`);
  console.log(`      Confirm "Enable Custom SMTP" is ON and the fields saved.`);
  console.log(`      ${DIM}The toggle can look on while the values were never stored.${RESET}\n`);
} else {
  console.log(`${YELLOW}  ${'='.repeat(60)}${RESET}`);
  console.log(`  ${BOLD}THIS IS ALMOST CERTAINLY YOUR PROBLEM${RESET}\n`);
  console.log(`  Your domain is not fully verified. Until every record above shows`);
  console.log(`  verified, Resend only delivers to the address that owns your`);
  console.log(`  Resend account. Sends to student addresses are rejected.\n`);
  console.log(`  Supabase still reported success because it handed the message to`);
  console.log(`  SMTP and did not wait to hear whether it was accepted.\n`);
  console.log(`  ${BOLD}Fix:${RESET} add the missing records at Namecheap ->`);
  console.log(`  Domain List -> auvsai.com -> Manage -> Advanced DNS.`);
  console.log(`  Then Resend -> Domains -> Verify. Allow up to an hour.\n`);
  console.log(`${YELLOW}  ${'='.repeat(60)}${RESET}\n`);
}
