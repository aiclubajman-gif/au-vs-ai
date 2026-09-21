/**
 * Builds the arena TV screen's web assets (public/arena-tv/) from the design
 * masters.
 *
 *   node scripts/build-arena-tv-assets.mjs [--src <dir>] [--preview <dir>]
 *
 * --src      folder holding the masters below (default: design-source/arena-tv,
 *            which is git-ignored like every other design master).
 * --preview  also write each layer composited on magenta, to eyeball alpha.
 *
 * Masters (copy from design/Design/pages/final/TV and design/Design/assets/logos):
 *   arena_base_neutral.png          arena-base-neutral.png
 *   crowd_flags_{left,right}.png
 *   led_ring_blank.png              led-ring-blank.png
 *   main_hanging_screen_blank.png   main-hanging-screen-blank.png
 *   mascot_left_tall.png            the full-length mascot cut-out
 *   ai_right.png                    ai-right.png
 *   logo_{au_vs_ai,aida,ajman_university}.png
 *
 * The supplied art needs three repairs, all done here so they survive a
 * re-export:
 *   1. led_ring_blank and main_hanging_screen_blank have a transparency
 *      checkerboard painted INTO them between the truss members and behind the
 *      top rail. It is keyed out (light, neutral, in blocks — see keyChecker).
 *   2. The background remover also punched holes in the ring band's two glowing
 *      edge lines (their brightest pixels read as "white"). The colour survived,
 *      only alpha was lost, so alpha is restored along those lines.
 *   3. Character cut-outs carry stray specks from the background removal;
 *      islands too small to be part of the figure are dropped.
 *
 * It also derives the "emissive" layers — just the glowing lines of the AI's
 * armour and the mascot's headphones/hoodie — which the page pulses on top of
 * the untouched character art. The AI gets two of them: the glow it gives off,
 * and the channels themselves, which mask the current travelling through it.
 *
 * sharp is not a direct dependency; it is installed with next.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};

const SRC = path.resolve(arg('--src', 'design-source/arena-tv'));
const OUT = path.resolve('public/arena-tv');
const PREVIEW = arg('--preview', null);

const WEBP = { quality: 86, alphaQuality: 90, effort: 6, smartSubsample: true };

fs.mkdirSync(OUT, { recursive: true });
if (PREVIEW) fs.mkdirSync(PREVIEW, { recursive: true });

const src = (name) => path.join(SRC, name);

/** RGBA pixels of a master. `failOn: 'none'` lets the truncated mascot decode. */
async function load(name) {
  const { data, info } = await sharp(src(name), { failOn: 'none' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function toSharp(img) {
  return sharp(img.data, { raw: { width: img.width, height: img.height, channels: 4 } });
}

async function write(img, file, { width, format = 'webp', webp } = {}) {
  let pipeline = toSharp(img);
  if (width && width !== img.width) pipeline = pipeline.resize({ width, kernel: 'lanczos3' });
  const buf =
    format === 'png'
      ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
      : await pipeline.webp({ ...WEBP, ...webp }).toBuffer();
  fs.writeFileSync(path.join(OUT, file), buf);
  const meta = await sharp(buf).metadata();
  console.log(`${file.padEnd(28)} ${meta.width}x${meta.height}  ${(buf.length / 1024).toFixed(0)} KB`);

  if (PREVIEW && meta.hasAlpha) {
    const pw = Math.min(1600, meta.width);
    const small = await sharp(buf).resize({ width: pw }).png().toBuffer();
    const sm = await sharp(small).metadata();
    await sharp({ create: { width: sm.width, height: sm.height, channels: 3, background: '#ff00ff' } })
      .composite([{ input: small }])
      .png()
      .toFile(path.join(PREVIEW, file.replace(/\.\w+$/, '.png')));
  }
}

/** Connected components (4-neighbour) of `mask`; returns labels and sizes. */
function components(mask, width, height) {
  const labels = new Int32Array(width * height);
  const sizes = [0];
  const stack = new Int32Array(width * height);
  let next = 1;
  let top = 0;
  const visit = (q) => {
    if (mask[q] && !labels[q]) {
      labels[q] = next;
      stack[top++] = q;
    }
  };
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    let size = 0;
    visit(start);
    while (top) {
      const p = stack[--top];
      size++;
      const x = p % width;
      const y = (p - x) / width;
      if (x > 0) visit(p - 1);
      if (x < width - 1) visit(p + 1);
      if (y > 0) visit(p - width);
      if (y < height - 1) visit(p + width);
    }
    sizes.push(size);
    next++;
  }
  return { labels, sizes };
}

/**
 * Keys out a checkerboard painted into the art. Its squares are light and
 * neutral (≈ 250 and ≈ 205 grey). Two things share that colour and must stay:
 * a lone metal highlight (too small to be a square) and the white-hot cores of
 * the lamps. A light region is checker when either
 *   - its rim is mostly dark or transparent (it shows through gaps in the
 *     truss; a lamp core fades out through bright glow instead), or
 *   - it holds both checker levels, grey and white, in real amounts (a lamp
 *     core is white fading through colour, with almost no neutral grey).
 * Then a 2px defringe fades the anti-aliased seam between checker and truss.
 */
function keyChecker(img, { minRegion = 40 } = {}) {
  const { data, width, height } = img;
  const n = width * height;
  const light = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (!data[i + 3]) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn <= 16 && mn >= 165) light[p] = 1;
  }
  const { labels, sizes } = components(light, width, height);

  // Per region: rim census (outside neighbours that are dark or clear) and
  // how many of its pixels sit on each checker level.
  const rim = new Int32Array(sizes.length);
  const darkRim = new Int32Array(sizes.length);
  const grey = new Int32Array(sizes.length);
  const white = new Int32Array(sizes.length);
  for (let p = 0; p < n; p++) {
    const l = labels[p];
    if (!l) continue;
    const v = data[p * 4 + 1];
    if (v >= 175 && v <= 222) grey[l]++;
    else if (v >= 238) white[l]++;
    const x = p % width;
    for (const q of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width]) {
      if (q < 0 || q >= n || labels[q] === l) continue;
      rim[l]++;
      const j = q * 4;
      const mx = Math.max(data[j], data[j + 1], data[j + 2]);
      const mn = Math.min(data[j], data[j + 1], data[j + 2]);
      // Mid greys count as dark: they are the anti-aliased step down to truss.
      if (data[j + 3] < 128 || mx < 130 || (mx - mn <= 32 && mx < 200)) darkRim[l]++;
    }
  }
  const isChecker = (l) =>
    sizes[l] >= minRegion &&
    (darkRim[l] >= rim[l] * 0.5 ||
      (sizes[l] >= 150 && grey[l] >= sizes[l] * 0.15 && white[l] >= sizes[l] * 0.15));

  const keyed = new Uint8Array(n);
  let count = 0;
  for (let p = 0; p < n; p++) {
    if (labels[p] && isChecker(labels[p])) {
      keyed[p] = 1;
      data[p * 4 + 3] = 0;
      count++;
    }
  }
  // Defringe: pale, near-neutral pixels touching the keyed area are mostly checker.
  for (let pass = 0; pass < 2; pass++) {
    const edge = [];
    for (let p = 0; p < n; p++) {
      if (keyed[p] || !data[p * 4 + 3]) continue;
      const x = p % width;
      const touching =
        (x > 0 && keyed[p - 1]) ||
        (x < width - 1 && keyed[p + 1]) ||
        (p >= width && keyed[p - width]) ||
        (p < n - width && keyed[p + width]);
      if (!touching) continue;
      const i = p * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx - mn > 32 || mn < 90) continue;
      const keep = Math.min(1, Math.max(0, (165 - mn) / 75));
      data[i + 3] = Math.round(data[i + 3] * keep);
      edge.push(p);
    }
    for (const p of edge) keyed[p] = 1;
  }
  return count;
}

/** Drops specks: opaque islands smaller than `minSize` pixels. */
function removeIslands(img, minSize) {
  const { data, width, height } = img;
  const n = width * height;
  const solid = new Uint8Array(n);
  for (let p = 0; p < n; p++) solid[p] = data[p * 4 + 3] > 8 ? 1 : 0;
  const { labels, sizes } = components(solid, width, height);
  let removed = 0;
  for (let p = 0; p < n; p++) {
    if (labels[p] && sizes[labels[p]] < minSize) {
      data[p * 4 + 3] = 0;
      removed++;
    }
  }
  return removed;
}

/*
 * The ring band's front face, measured on led_ring_blank.png (3840 x 2160) by
 * tracing its two glowing edge lines and least-squares fitting a cylinder seen
 * in perspective (RMS error 4.6px top, 3.0px bottom). Must match RING in
 * src/components/arena-tv/geometry.ts.
 */
const RING = { ox: 1922, oy: 2454.2, a: 1775.28, r: 0.3203, bt: -1210.7, bb: -868.2 };

/** y of the band's top and bottom edge in every column of the ring master. */
function ringEdges(width) {
  const { ox, oy, a, r, bt, bb } = RING;
  const ts = Math.acos(r);
  const top = new Float64Array(width);
  const bottom = new Float64Array(width);
  for (let x = 0; x < width; x++) {
    let lo = -ts, hi = ts;
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      if ((a * Math.sin(mid)) / (1 - r * Math.cos(mid)) < x - ox) lo = mid;
      else hi = mid;
    }
    const d = 1 - r * Math.cos((lo + hi) / 2);
    top[x] = oy + bt / d;
    bottom[x] = oy + bb / d;
  }
  return { top, bottom };
}

/** Restores alpha the background remover stripped from the band's edge lines. */
function fillBandEdgeHoles(img) {
  const { data, width, height } = img;
  const { top, bottom } = ringEdges(width);
  let filled = 0;
  for (let x = 60; x < width - 55; x++) {
    for (const edge of [top[x], bottom[x]]) {
      for (let y = Math.round(edge - 14); y <= Math.round(edge + 14); y++) {
        if (y < 0 || y >= height) continue;
        const i = (y * width + x) * 4;
        if (data[i + 3] >= 250) continue;
        // Only a gap with solid band both above and below is a hole.
        let above = false, below = false;
        for (let k = 1; k <= 8 && !(above && below); k++) {
          if (y - k >= 0 && data[((y - k) * width + x) * 4 + 3] >= 250) above = true;
          if (y + k < height && data[((y + k) * width + x) * 4 + 3] >= 250) below = true;
        }
        if (!above || !below) continue;
        if (data[i] + data[i + 1] + data[i + 2] < 60) {
          // No usable colour: borrow the brighter vertical neighbour.
          const up = ((y - 1) * width + x) * 4, dn = ((y + 1) * width + x) * 4;
          const from = data[up] + data[up + 1] + data[up + 2] > data[dn] + data[dn + 1] + data[dn + 2] ? up : dn;
          data[i] = data[from]; data[i + 1] = data[from + 1]; data[i + 2] = data[from + 2];
        }
        data[i + 3] = 255;
        filled++;
      }
    }
  }
  return filled;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * A layer holding only the glowing lines of `img`: `weight(r, g, b)` says how
 * much each pixel glows (0-1); its colour is pushed toward `core` so the pulse
 * reads as the line heating up rather than the art getting a flat tint.
 */
function emissive(img, weight, core, { minAlpha = 0.04 } = {}) {
  const { data, width, height } = img;
  const out = Buffer.alloc(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    const w = clamp01(weight(data[i], data[i + 1], data[i + 2])) * (data[i + 3] / 255);
    if (w < minAlpha) continue;
    out[i] = Math.round(data[i] + (core[0] - data[i]) * w * 0.6);
    out[i + 1] = Math.round(data[i + 1] + (core[1] - data[i + 1]) * w * 0.6);
    out[i + 2] = Math.round(data[i + 2] + (core[2] - data[i + 2]) * w * 0.6);
    out[i + 3] = Math.round(w * 255);
  }
  return { data: out, width, height };
}

/* -- The AI's emissive channels ---------------------------------------------
 *
 * Colour alone cannot find them. The whole figure is rim-lit in the same
 * orange the channels are made of, so "bright and orange" selects the armour's
 * every contour, the skull's outline and the profile of the face along with
 * the circuitry — an edge trace of the fighter rather than its wiring. Two
 * things tell a channel from a lit edge, and neither is a colour:
 *
 *   inside   A channel is cut into the armour, so it sits well inside the
 *            cut-out. Rim light lies along the cut-out's own boundary, and
 *            dies with a distance transform.
 *   line     A channel is a thin bright line with darker armour on both sides.
 *            A lit edge, a bevel or the sheen across the top of the helmet has
 *            armour on one side only, and fades on the other. Sampling both
 *            ways along four axes separates them — but only where both samples
 *            are still on the figure, or the transparent side of a rim would
 *            read as the darker one and every outline would pass.
 *
 * The line test is applied per connected region rather than per pixel: a
 * channel's own core, where two channels meet, and the few pixels either side
 * of a fork are all legitimately flat, and cutting them individually leaves
 * the circuitry dashed. Judging the whole region keeps each line continuous.
 */

/** Distance, in pixels, from every opaque pixel to the nearest clear one. */
function innerDistance(img) {
  const { data, width, height } = img;
  const n = width * height;
  // Chamfer 3-4, in thirds of a pixel, in two sweeps.
  const dist = new Float32Array(n);
  for (let p = 0; p < n; p++) dist[p] = data[p * 4 + 3] > 40 ? Infinity : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : dist[y * width + x]);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!dist[p]) continue;
      dist[p] = Math.min(dist[p], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4);
    }
  for (let y = height - 1; y >= 0; y--)
    for (let x = width - 1; x >= 0; x--) {
      const p = y * width + x;
      if (!dist[p]) continue;
      dist[p] = Math.min(dist[p], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4);
    }
  for (let p = 0; p < n; p++) dist[p] /= 3;
  return dist;
}

const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/**
 * Everything about the figure that both mask passes need, measured once:
 * how far inside the cut-out each pixel is, how much orange it puts out, and
 * how far it stands above the armour on either side of it.
 */
function channelField(img, { reach = 8 } = {}) {
  const { data, width, height } = img;
  const n = width * height;
  const dist = innerDistance(img);
  // Orange output: red past what a neutral highlight of the same blue would
  // carry. Skin and the white-metal specular both hold too much blue to score.
  const emit = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (data[i + 3] < 16) continue;
    emit[p] = Math.max(0, data[i] - data[i + 2] * 0.6) * (data[i + 3] / 255);
  }
  const r = Math.round((reach * width) / 1000);
  const axes = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  /** How far p rises above the armour `r` away on both sides, at its best angle. */
  const ridge = (p) => {
    const x = p % width;
    const y = (p - x) / width;
    let best = 0;
    for (const [ux, uy] of axes) {
      const ax = x + ux * r, ay = y + uy * r, bx = x - ux * r, by = y - uy * r;
      if (ax < 0 || ay < 0 || ax >= width || ay >= height) continue;
      if (bx < 0 || by < 0 || bx >= width || by >= height) continue;
      const pa = ay * width + ax, pb = by * width + bx;
      // Off the figure on either side: this is a silhouette, not a line.
      if (data[pa * 4 + 3] < 40 || data[pb * 4 + 3] < 40) continue;
      const drop = Math.min(emit[p] - emit[pa], emit[p] - emit[pb]);
      if (drop > best) best = drop;
    }
    return best;
  };
  return { dist, ridge, scale: width / 1000 };
}

/**
 * One emissive layer: the pixels that pass `weight`, are far enough inside the
 * cut-out, and belong to a region that reads as a line. `core` tints it toward
 * the colour the channel runs at; passing null leaves it white, for a layer
 * that is only ever used as a mask.
 *
 * Every length is quoted per 1000px of width and scaled to the master, so a
 * re-export at another size selects the same lines.
 */
function channels(img, field, weight, core, { edge, floor, minRegion, minLine, lineAt = 18 } = {}) {
  const { data, width, height } = img;
  const { dist, ridge, scale } = field;
  const n = width * height;
  const w = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (data[i + 3] < 16) continue;
    const colour = clamp01(weight(data[i], data[i + 1], data[i + 2]));
    if (colour <= 0) continue;
    const inside = smoothstep(edge[0] * scale, edge[1] * scale, dist[p]);
    if (inside <= 0) continue;
    // The floor is what stops a faint wash of near-misses from filling the
    // gaps between the channels back in.
    const v = clamp01((colour * inside * (data[i + 3] / 255) - floor) / (1 - floor));
    if (v > 0) w[p] = v;
  }

  const mask = new Uint8Array(n);
  for (let p = 0; p < n; p++) mask[p] = w[p] > 0 ? 1 : 0;
  const { labels, sizes } = components(mask, width, height);
  const lines = new Int32Array(sizes.length);
  for (let p = 0; p < n; p++) if (labels[p] && ridge(p) >= lineAt) lines[labels[p]]++;
  const keep = new Uint8Array(sizes.length);
  for (let l = 1; l < sizes.length; l++) {
    keep[l] = sizes[l] >= minRegion * scale * scale && lines[l] / sizes[l] >= minLine ? 1 : 0;
  }

  const out = Buffer.alloc(n * 4);
  let kept = 0;
  for (let p = 0; p < n; p++) {
    if (!labels[p] || !keep[labels[p]]) continue;
    const i = p * 4;
    const a = w[p];
    if (core) {
      out[i] = Math.round(data[i] + (core[0] - data[i]) * a * 0.6);
      out[i + 1] = Math.round(data[i + 1] + (core[1] - data[i + 1]) * a * 0.6);
      out[i + 2] = Math.round(data[i + 2] + (core[2] - data[i + 2]) * a * 0.6);
    } else {
      out[i] = out[i + 1] = out[i + 2] = 255;
    }
    out[i + 3] = Math.round(a * 255);
    kept++;
  }
  const regions = keep.reduce((a, b) => a + b, 0);
  return { layer: { data: out, width, height }, kept, regions, total: sizes.length - 1 };
}

// ---------------------------------------------------------------------------

// Background: two sizes, picked by the browser with srcset (1080p vs 4K).
{
  const base = await load('arena_base_neutral.png');
  await write(base, 'arena-base-3840.webp');
  await write(base, 'arena-base-1920.webp', { width: 1920 });
}

{
  const ring = await load('led_ring_blank.png');
  console.log('  ring: keyed', keyChecker(ring), 'checker px, filled', fillBandEdgeHoles(ring), 'edge holes');
  await write(ring, 'led-ring.webp', { width: 2560 });
}

{
  const screen = await load('main_hanging_screen_blank.png');
  console.log('  screen: keyed', keyChecker(screen), 'checker px');
  await write(screen, 'hanging-screen.webp', { width: 2048 });
}

{
  // The screen sizes the mascot by width and lets its height follow, so a
  // taller master drops straight in: nothing here depends on its aspect.
  const mascot = await load('mascot_left_tall.png');
  console.log('  mascot: removed', removeIslands(mascot, 400), 'speck px');
  await write(mascot, 'mascot.webp', { width: 1600 });
  // Neon: saturated electric blue, or the near-white cores of the headphone
  // ring and heartbeat line. White feathers are excluded by requiring a blue
  // cast strong enough that red sits well under blue.
  const glow = emissive(
    mascot,
    (r, g, b) => clamp01((b - 200) / 40) * clamp01((b - r - 110) / 60) * clamp01((g - 40) / 80),
    [150, 225, 255],
  );
  await write(glow, 'mascot-glow.webp', { width: 1000 });
}

{
  const ai = await load('ai_right.png');
  console.log('  ai: removed', removeIslands(ai, 400), 'speck px');
  await write(ai, 'ai.webp', { width: 1600 });

  const field = channelField(ai);
  /*
   * Two passes over the same channels, at two widths. The glow is the light
   * the armour actually gives off — the line and the first of its falloff —
   * and is what the page pulses. The veins layer is the line alone, and is
   * only ever a mask: it is where the travelling fronts are allowed to put
   * their current, so a front tracks the circuitry instead of washing across
   * the halo around it. Anything looser than these belongs to the still art,
   * which neither layer touches.
   */
  const glow = channels(
    ai,
    field,
    (r, g, b) => clamp01((r - 214) / 32) * clamp01((r - b - 84) / 56) * clamp01((g - 38) / 58),
    [255, 214, 140],
    { edge: [9, 20], floor: 0.07, minRegion: 45, minLine: 0.34 },
  );
  console.log(`  ai glow:  ${glow.kept} px, ${glow.regions}/${glow.total} regions`);
  await write(glow.layer, 'ai-glow.webp', { width: 1000 });

  const veins = channels(
    ai,
    field,
    (r, g, b) => clamp01((r - 238) / 14) * clamp01((r - b - 104) / 46) * clamp01((g - 46) / 58),
    null,
    { edge: [8, 17], floor: 0.1, minRegion: 55, minLine: 0.42 },
  );
  console.log(`  ai veins: ${veins.kept} px, ${veins.regions}/${veins.total} regions`);
  // A mask, so only its alpha is ever read: keep that crisp, and let the flat
  // white it carries cost almost nothing.
  await write(veins.layer, 'ai-veins.webp', { width: 1000, webp: { alphaQuality: 100 } });
}

for (const [from, to] of [
  ['crowd_flags_left.png', 'crowd-left.webp'],
  ['crowd_flags_right.png', 'crowd-right.webp'],
]) {
  const crowd = await load(from);
  removeIslands(crowd, 200);
  await write(crowd, to, { width: 1280 });
}

// Logos: the AU vs AI lockup for the hanging screen, and the two
// institutional marks the LED ring cycles (the lockup is not on the ring).
await write(await load('logo_au_vs_ai.png'), 'logo-au-vs-ai.webp', { width: 1400 });
await write(await load('logo_aida.png'), 'ring-aida.webp', { width: 640 });
await write(await load('logo_ajman_university.png'), 'ring-ajman-university.webp', { width: 560 });
