/**
 * AU vs AI — Seed Round 1 images from the GenImg dataset.
 *
 * Reads public/dataset/ai and public/dataset/real and registers all images
 * in public.round1_images.
 *
 * Run:
 *   node --env-file=.env.local scripts/seed-dataset.mjs
 *
 * Options:
 *   --sql       Generate supabase/migrations/0011_seed_round1_dataset.sql
 *   --clear     Remove existing non-test images from round1_images
 *   --dry-run   Count and validate images without inserting into DB
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const AI_DIR = path.join(ROOT, 'public', 'dataset', 'ai');
const REAL_DIR = path.join(ROOT, 'public', 'dataset', 'real');
const SQL_PATH = path.join(ROOT, 'supabase', 'migrations', '0011_seed_round1_dataset.sql');

const BATCH_SIZE = 500;

const GREEN = '\x1b[32m', RED = '\x1b[31m', YELLOW = '\x1b[33m',
      DIM = '\x1b[2m', BOLD = '\x1b[1m', RESET = '\x1b[0m';

const generateSqlOnly = process.argv.includes('--sql');
const clearExisting = process.argv.includes('--clear');
const dryRun = process.argv.includes('--dry-run');

console.log(`\n  ${BOLD}AU vs AI — Round 1 Dataset Seeder${RESET}\n`);

if (!fs.existsSync(AI_DIR) || !fs.existsSync(REAL_DIR)) {
  console.error(`  ${RED}Error: Dataset directories not found at public/dataset/ai and public/dataset/real${RESET}`);
  process.exit(1);
}

const aiFiles = fs.readdirSync(AI_DIR).filter((f) => f.endsWith('.webp'));
const realFiles = fs.readdirSync(REAL_DIR).filter((f) => f.endsWith('.webp'));

console.log(`  Found ${GREEN}${aiFiles.length}${RESET} AI images in public/dataset/ai/`);
console.log(`  Found ${GREEN}${realFiles.length}${RESET} Real images in public/dataset/real/`);
console.log(`  Total: ${BOLD}${aiFiles.length + realFiles.length}${RESET} images\n`);

const rows = [
  ...aiFiles.map((f) => ({
    storage_path: `/dataset/ai/${f}`,
    label: 'ai_generated',
    active: true,
    is_test: false,
  })),
  ...realFiles.map((f) => ({
    storage_path: `/dataset/real/${f}`,
    label: 'real',
    active: true,
    is_test: false,
  })),
];

// ---------------------------------------------------------------------------
// 1. Generate SQL migration if requested
// ---------------------------------------------------------------------------
if (generateSqlOnly) {
  console.log(`  Writing SQL migration to ${SQL_PATH}...`);
  const valuesSql = rows
    .map((r) => `  ('${r.storage_path}', '${r.label}', true, false)`)
    .join(',\n');

  const sqlContent = `-- ============================================================================
-- AU vs AI — 0011 Seed Round 1 GenImg Dataset
--
-- Seeds ${aiFiles.length} AI generated images and ${realFiles.length} Real images from the GenImg dataset.
-- Storage paths are relative to /public, served statically at /dataset/...
-- ============================================================================

create unique index if not exists round1_images_storage_path_idx
  on public.round1_images(storage_path);

insert into public.round1_images (storage_path, label, active, is_test)
values
${valuesSql}
on conflict (storage_path) do nothing;
`;

  fs.writeFileSync(SQL_PATH, sqlContent, 'utf-8');
  console.log(`  ${GREEN}Wrote 0011_seed_round1_dataset.sql successfully.${RESET}\n`);
  process.exit(0);
}

if (dryRun) {
  console.log(`  ${YELLOW}Dry-run complete. No database changes made.${RESET}\n`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 2. Direct Supabase seeding
// ---------------------------------------------------------------------------
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SERVICE) {
  console.log(`  ${YELLOW}NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.${RESET}`);
  console.log(`  Tip: use ${BOLD}--sql${RESET} to generate a SQL migration file instead:\n`);
  console.log(`    node scripts/seed-dataset.mjs --sql\n`);
  process.exit(0);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

if (clearExisting) {
  console.log(`  Clearing non-test Round 1 images...`);
  const { error: clearError } = await admin
    .from('round1_images')
    .delete()
    .eq('is_test', false);

  if (clearError) {
    console.error(`  ${RED}Failed to clear images:${RESET} ${clearError.message}`);
    process.exit(1);
  }
  console.log(`  ${GREEN}Cleared existing non-test images.${RESET}`);
}

console.log(`  Inserting ${rows.length} images in batches of ${BATCH_SIZE}...`);

let inserted = 0;
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);
  const { error } = await admin
    .from('round1_images')
    .upsert(batch, { onConflict: 'storage_path', ignoreDuplicates: true });

  if (error) {
    console.error(`  ${RED}Batch failed at index ${i}:${RESET} ${error.message}`);
    process.exit(1);
  }
  inserted += batch.length;
  process.stdout.write(`  Inserted ${inserted} / ${rows.length}...\r`);
}

console.log(`\n  ${GREEN}Successfully seeded ${inserted} images into round1_images!${RESET}\n`);
