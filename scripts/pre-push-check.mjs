/**
 * Run before the first push, and before any deploy.
 *
 * Two classes of mistake this catches:
 *
 *   1. Secrets going INTO git. The service role key bypasses every security
 *      rule in the database. On a public repo that is game over; on a private
 *      repo with a collaborator it is still a key you can never un-share.
 *
 *   2. Things that must go into git but are easy to exclude by accident —
 *      chiefly the trained model. Vercel builds from git, so an ignored .bin
 *      means the deployed site silently scores every student with the mock
 *      classifier while looking perfectly fine.
 *
 * Run:  node scripts/pre-push-check.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RED = '\x1b[31m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m',
      DIM = '\x1b[2m', BOLD = '\x1b[1m', RESET = '\x1b[0m';

let problems = 0;
let warnings = 0;

const ok = (m) => console.log(`${GREEN}  PASS${RESET}  ${m}`);
const bad = (m, d) => { problems++; console.log(`${RED}  FAIL${RESET}  ${m}${d ? `\n        ${DIM}${d}${RESET}` : ''}`); };
const warn = (m, d) => { warnings++; console.log(`${YELLOW}  WARN${RESET}  ${m}${d ? `\n        ${DIM}${d}${RESET}` : ''}`); };

console.log(`\n  ${BOLD}Pre-push safety check${RESET}\n`);

// ---------------------------------------------------------------------------
function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    return null;
  }
}

if (!existsSync(join(process.cwd(), '.git'))) {
  console.log(`${YELLOW}  No git repository yet.${RESET}`);
  console.log(`  Run ${BOLD}git init${RESET} first, then run this again.\n`);
  process.exit(1);
}

const tracked = (git('ls-files') ?? '').split('\n').filter(Boolean);
console.log(`  ${DIM}${tracked.length} files tracked by git${RESET}\n`);

// ---------------------------------------------------------------------------
// 1. Secrets must not be tracked
// ---------------------------------------------------------------------------
console.log(`  ${BOLD}Secrets${RESET}`);

const ENV_FILES = ['.env', '.env.local', '.env.production', '.env.development'];
const leakedEnv = tracked.filter((f) => ENV_FILES.includes(f));

if (leakedEnv.length > 0) {
  bad(`environment file is tracked: ${leakedEnv.join(', ')}`,
      `Run: git rm --cached ${leakedEnv.join(' ')}  then commit`);
} else {
  ok('no .env files tracked');
}

/**
 * Patterns that indicate a real credential rather than a placeholder.
 * Supabase legacy keys are JWTs (eyJ...), newer ones are sb_secret_ /
 * sb_publishable_. Resend keys are re_.
 */
const SECRET_PATTERNS = [
  { name: 'Supabase service_role JWT', re: /eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}/ },
  { name: 'Supabase secret key', re: /sb_secret_[A-Za-z0-9_-]{15,}/ },
  { name: 'Resend API key', re: /\bre_[A-Za-z0-9]{20,}/ },
];

const SKIP_SCAN = [/package-lock\.json$/, /\.bin$/, /\.svg$/, /\.ico$/, /\.ipynb$/];

let found = 0;
for (const file of tracked) {
  if (SKIP_SCAN.some((r) => r.test(file))) continue;
  let content;
  try {
    content = readFileSync(join(process.cwd(), file), 'utf8');
  } catch {
    continue;
  }
  for (const { name, re } of SECRET_PATTERNS) {
    const hit = content.match(re);
    if (hit) {
      found++;
      bad(`${name} found in ${file}`,
          `starts with: ${hit[0].slice(0, 18)}…  — remove it, then ROTATE the key`);
    }
  }
}
if (found === 0) ok('no credentials found in tracked files');

// .env.example must stay a template
if (existsSync('.env.example')) {
  const example = readFileSync('.env.example', 'utf8');
  const filled = SECRET_PATTERNS.some(({ re }) => re.test(example));
  if (filled) bad('.env.example contains a real key');
  else ok('.env.example is still a template');
}

// ---------------------------------------------------------------------------
// 2. Things that MUST be committed
// ---------------------------------------------------------------------------
console.log(`\n  ${BOLD}Deploy requirements${RESET}`);

const modelJson = 'public/models/quickdraw/model.json';
const hasModelDir = existsSync(join(process.cwd(), modelJson));

if (!hasModelDir) {
  warn('no trained model present locally', 'the deployed site will use the mock classifier');
} else {
  const modelTracked = tracked.includes(modelJson);
  const binTracked = tracked.some((f) => f.startsWith('public/models/quickdraw/') && f.endsWith('.bin'));
  const labelsTracked = tracked.includes('public/models/quickdraw/labels.json');

  if (!modelTracked) {
    bad('model.json is NOT tracked', 'git add -f public/models/quickdraw/model.json');
  } else ok('model.json tracked');

  if (!binTracked) {
    bad('no model .bin weights tracked',
        'Vercel builds from git — students would silently get the mock.\n        git add -f public/models/quickdraw/*.bin');
  } else ok('model weights tracked');

  if (!labelsTracked) {
    bad('labels.json is NOT tracked', 'predictions would be mislabelled');
  } else ok('labels.json tracked');
}

const migrations = tracked.filter((f) => f.startsWith('supabase/migrations/'));
if (migrations.length >= 10) ok(`${migrations.length} migrations tracked`);
else warn(`only ${migrations.length} migrations tracked`, 'expected 10 or more');

// ---------------------------------------------------------------------------
// 3. Build health
// ---------------------------------------------------------------------------
console.log(`\n  ${BOLD}Build health${RESET}`);

try {
  execSync('npm test', { stdio: 'pipe' });
  ok('tests pass');
} catch {
  bad('tests are failing', 'run: npm test');
}

try {
  execSync('npx tsc --noEmit', { stdio: 'pipe' });
  ok('typecheck clean');
} catch {
  bad('typecheck failing', 'run: npx tsc --noEmit');
}

// ---------------------------------------------------------------------------
console.log(`\n${DIM}${'-'.repeat(60)}${RESET}\n`);

if (problems > 0) {
  console.log(`  ${RED}${problems} problem(s). Do not push yet.${RESET}\n`);
  if (found > 0) {
    console.log(`  ${BOLD}If a key was committed, rotating it is not optional.${RESET}`);
    console.log(`  Removing the file does not remove it from git history.`);
    console.log(`  Supabase: Project Settings -> API Keys -> roll the key.\n`);
  }
  process.exit(1);
}

if (warnings > 0) {
  console.log(`  ${YELLOW}${warnings} warning(s)${RESET} — safe to push, but read them.\n`);
} else {
  console.log(`  ${GREEN}Safe to push.${RESET}\n`);
}
