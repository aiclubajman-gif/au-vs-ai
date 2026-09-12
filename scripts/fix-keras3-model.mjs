/**
 * Makes a Keras 3 export loadable by TensorFlow.js.
 *
 * Keras 3 renamed several fields in the saved model config. tensorflowjs
 * converter passes them through unchanged, and tfjs 4.x then rejects the model
 * with errors like:
 *
 *   "An InputLayer should be passed either a `batchInputShape` or an
 *    `inputShape`."
 *
 * The weights are perfectly fine — only the metadata field names differ. This
 * rewrites them in place rather than forcing a retrain.
 *
 * Fixes applied:
 *   1. InputLayer  batch_shape        -> batch_input_shape
 *   2. dtype given as a DTypePolicy object -> plain string ("float32")
 *   3. Strips Keras 3 bookkeeping keys tfjs does not understand
 *
 * Run:  node scripts/fix-keras3-model.mjs
 * Safe to run twice; already-correct files are left alone.
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const GREEN = '\x1b[32m', RED = '\x1b[31m', YELLOW = '\x1b[33m',
      DIM = '\x1b[2m', BOLD = '\x1b[1m', RESET = '\x1b[0m';

const MODEL_PATH = join(process.cwd(), 'public', 'models', 'quickdraw', 'model.json');

if (!existsSync(MODEL_PATH)) {
  console.error(`\n${RED}No model at ${MODEL_PATH}${RESET}`);
  console.error(`Train it first with notebooks/train_drawing_model.ipynb\n`);
  process.exit(1);
}

console.log(`\n  ${BOLD}Patching Keras 3 model for TensorFlow.js${RESET}\n`);

const model = JSON.parse(readFileSync(MODEL_PATH, 'utf8'));

let inputLayersFixed = 0;
let dtypesFixed = 0;
let keysStripped = 0;

/** Keras 3 emits dtype as a policy object; tfjs wants a plain string. */
function normalizeDtype(config) {
  if (config && typeof config.dtype === 'object' && config.dtype !== null) {
    const name =
      config.dtype?.config?.name ??
      config.dtype?.name ??
      'float32';
    config.dtype = typeof name === 'string' ? name : 'float32';
    dtypesFixed++;
  }
}

/** Bookkeeping keys that mean nothing to tfjs and can confuse older versions. */
const STRIP = ['module', 'registered_name', 'build_config', 'compile_config'];

function walk(node) {
  if (Array.isArray(node)) {
    node.forEach(walk);
    return;
  }
  if (!node || typeof node !== 'object') return;

  if (node.class_name === 'InputLayer' && node.config) {
    if (node.config.batch_shape && !node.config.batch_input_shape) {
      node.config.batch_input_shape = node.config.batch_shape;
      delete node.config.batch_shape;
      inputLayersFixed++;
    }
  }

  if (node.config && typeof node.config === 'object') {
    normalizeDtype(node.config);
  }

  for (const key of STRIP) {
    if (key in node) {
      delete node[key];
      keysStripped++;
    }
  }

  for (const value of Object.values(node)) walk(value);
}

walk(model.modelTopology ?? model);

const changed = inputLayersFixed + dtypesFixed + keysStripped > 0;

if (!changed) {
  console.log(`  ${GREEN}Nothing to fix — this model is already TFJS-compatible.${RESET}`);
  console.log(`  ${DIM}If it still fails to load, the problem is elsewhere.${RESET}\n`);
  process.exit(0);
}

// Keep the original so a bad patch is recoverable.
const backup = MODEL_PATH.replace(/\.json$/, '.original.json');
if (!existsSync(backup)) {
  copyFileSync(MODEL_PATH, backup);
  console.log(`  ${DIM}backup saved: model.original.json${RESET}\n`);
}

writeFileSync(MODEL_PATH, JSON.stringify(model));

console.log(`  ${GREEN}InputLayer shapes renamed:${RESET}  ${inputLayersFixed}`);
console.log(`  ${GREEN}dtype policies flattened:${RESET}   ${dtypesFixed}`);
console.log(`  ${GREEN}Keras 3 keys stripped:${RESET}      ${keysStripped}`);

console.log(`\n  ${BOLD}Done.${RESET} Restart the dev server and hard-refresh /debug/draw.`);
console.log(`  ${DIM}It should now read: Classifier: tfjs — real model loaded${RESET}\n`);

if (inputLayersFixed === 0) {
  console.log(`  ${YELLOW}Note:${RESET} no InputLayer needed renaming, which was the reported`);
  console.log(`  error. If loading still fails, paste the new message.\n`);
}
