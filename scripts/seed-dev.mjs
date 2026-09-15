/**
 * Seeds enough data to PLAY the game locally before real content exists.
 *
 * Everything it creates is flagged is_test = true, so seeded images and
 * attempts are excluded from the leaderboard and every dashboard aggregate by
 * default. That makes the nightmare scenario — a fake entry sitting at #3 on
 * the booth TV in front of a queue — structurally impossible rather than
 * something we have to remember to clean up.
 *
 * Run:    node --env-file=.env.local scripts/seed-dev.mjs
 * Clear:  node --env-file=.env.local scripts/seed-dev.mjs --clear
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const GREEN = '\x1b[32m', RED = '\x1b[31m', YELLOW = '\x1b[33m',
      DIM = '\x1b[2m', BOLD = '\x1b[1m', RESET = '\x1b[0m';

if (!URL || !SERVICE) {
  console.error(`${RED}Missing Supabase environment variables.${RESET}`);
  process.exit(1);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const clearing = process.argv.includes('--clear');

if (clearing) {
  console.log(`\n  ${BOLD}Clearing development data${RESET}\n`);

  /**
   * DEACTIVATE rather than delete.
   *
   * attempt_round1.image_id references round1_images, so deleting an image
   * that appeared in any past attempt is rejected by the foreign key. An
   * earlier version ignored that error and reported "removed 0" while the
   * placeholders stayed live — the exact silent failure this is guarding now.
   *
   * Deactivating is also the better outcome: start_attempt only ever selects
   * active images, so the placeholders stop being served while the history of
   * what was shown during testing stays intact.
   */
  const { data: deactivated, error: imgErr } = await admin
    .from('round1_images')
    .update({ active: false })
    .eq('is_test', true)
    .select('id');

  if (imgErr) {
    console.log(`  ${RED}failed to deactivate placeholders:${RESET} ${imgErr.message}`);
    process.exit(1);
  }
  console.log(`  deactivated ${deactivated?.length ?? 0} placeholder images`);

  // Test attempts must go first, or they keep referencing the placeholders.
  const { data: testAttempts, error: attErr } = await admin
    .from('attempts')
    .delete()
    .eq('is_test', true)
    .select('id');

  if (attErr) {
    console.log(`  ${YELLOW}could not remove test attempts:${RESET} ${attErr.message}`);
  } else {
    console.log(`  removed ${testAttempts?.length ?? 0} test attempts`);
  }

  await admin.from('event_settings').update({ challenge_open: false }).eq('id', 1);

  // Verify, rather than assume. This is the check that was missing.
  const { data: health } = await admin.rpc('round1_bank_health');

  console.log('');
  if (health) {
    console.log(`  ${BOLD}Bank now${RESET}`);
    console.log(`    active         ${health.active}`);
    console.log(`    real / ai      ${health.real} / ${health.ai}`);
    console.log(`    per game       ${health.images_per_game ?? 'unknown'}`);
    console.log(`    placeholders   ${health.placeholders === 0
      ? `${GREEN}0${RESET}`
      : `${RED}${health.placeholders} STILL LIVE${RESET}`}`);
    console.log(`    playable       ${health.playable ? `${GREEN}yes${RESET}` : `${RED}no${RESET}`}`);
  }

  console.log(`\n  ${YELLOW}The challenge is now CLOSED.${RESET}`);
  console.log(`  Reopen it from /admin when you want students to play.\n`);
  process.exit(0);
}

console.log(`\n  ${BOLD}Seeding development data${RESET}\n`);

// ---------------------------------------------------------------------------
// Placeholder Round 1 images.
//
// Six real, six AI: enough for either Round 1 preset, since start_attempt()
// keeps every game 25-75% real (a 10-image game needs 3 of each, at most 7 of
// either). The SVGs live in /public/game-assets/placeholder and
// are visually obvious placeholders — nobody could mistake one for content.
// ---------------------------------------------------------------------------
const { count: existing } = await admin
  .from('round1_images')
  .select('id', { count: 'exact', head: true })
  .eq('is_test', true);

if ((existing ?? 0) > 0) {
  console.log(`  ${DIM}${existing} placeholder images already present, skipping${RESET}`);
} else {
  const rows = [];
  for (let i = 1; i <= 12; i++) {
    const isReal = i <= 6;
    rows.push({
      storage_path: `/game-assets/placeholder/${String(i).padStart(2, '0')}.svg`,
      label: isReal ? 'real' : 'ai_generated',
      explanation: 'Placeholder. Replace with a real image and its giveaway detail.',
      active: true,
      is_test: true,
    });
  }

  const { error } = await admin.from('round1_images').insert(rows);
  if (error) {
    console.error(`  ${RED}Failed to insert images:${RESET} ${error.message}`);
    process.exit(1);
  }
  console.log(`  ${GREEN}12 placeholder images${RESET} (6 real, 6 AI)`);
}

// ---------------------------------------------------------------------------
// Round 3 needs exactly one active question or start_attempt() refuses.
// ---------------------------------------------------------------------------
const { data: activeQ } = await admin
  .from('round3_question')
  .select('id, prompt')
  .eq('active', true)
  .maybeSingle();

if (activeQ) {
  console.log(`  ${DIM}Round 3 question already active${RESET}`);
} else {
  const { data: anyQ } = await admin
    .from('round3_question')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (anyQ) {
    await admin.from('round3_question').update({ active: true }).eq('id', anyQ.id);
    console.log(`  ${GREEN}Round 3 question activated${RESET}`);
    console.log(`  ${YELLOW}Set the real answer in /admin before the fair.${RESET}`);
  } else {
    console.error(`  ${RED}No Round 3 question found. Re-run migration 0005.${RESET}`);
  }
}

// ---------------------------------------------------------------------------
// Open the challenge so attempts can start locally.
// ---------------------------------------------------------------------------
await admin
  .from('event_settings')
  .update({ challenge_open: true, new_games_paused: false })
  .eq('id', 1);
console.log(`  ${GREEN}Challenge opened${RESET} ${DIM}(local testing)${RESET}`);

console.log(`\n  ${BOLD}Ready to play.${RESET}  npm run dev  ->  localhost:3000/play\n`);
console.log(`  ${YELLOW}Before the fair:${RESET}`);
console.log(`   - node --env-file=.env.local scripts/seed-dev.mjs --clear`);
console.log(`   - load the real image bank`);
console.log(`   - set the real Round 3 answer`);
console.log(`   - reopen the challenge from /admin\n`);
