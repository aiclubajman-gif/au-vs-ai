'use client';

import { useEffect, useRef, type RefObject } from 'react';
import type { ArenaLead } from '@/lib/arena/types';
import styles from './ClashFX.module.css';

/**
 * Where the two fills grind against each other: the contact core, and the
 * sparks it throws.
 *
 * One small canvas, not a pile of DOM particles — this screen runs for hours
 * and the elements this replaces (a ring re-mounted on every new share and six
 * spark spans on infinite CSS loops) were both a constant animation cost and a
 * node churned on every finished game.
 *
 * It takes the seam's position from `shareRef`, which is the SAME rolling
 * number the bar fills to and the percentages print — written each frame by
 * BattleBar's roll (see useRollingNumber). Nothing here works out a share of
 * its own, so the contact point cannot land anywhere but exactly where the two
 * fills meet, at rest and at every frame of a roll.
 *
 * Three things make it emit:
 *   idle        a few embers, so the contact point is alive between games
 *   movement    the seam actually travelling — a grinding burst, scaled to
 *               how fast it is moving
 *   lead change one short surge as the lead crosses over
 *
 * THE CANVAS RIDES THE SEAM, carried along the lane by CSS off the same
 * --human the fills use, rather than spanning the lane with the contact point
 * drawn wherever the share says. Everything drawn here lives within a few
 * dozen pixels of the contact point, so a full-lane canvas was four times the
 * pixels cleared and redrawn every frame for the same picture.
 *
 * Because the window moves, particles already in the air are pushed back by
 * however far it travelled, or they would ride along with the seam instead of
 * being left behind by it.
 */

/** The particle pool. Fixed size: nothing is allocated once this is running. */
const MAX_PARTICLES = 260;

/*
 * Sparks are stroked in batches sharing a colour, a brightness step and a
 * width, so the canvas calls per frame are bounded by the number of batches
 * rather than by how many sparks are in the air.
 */
const FADES = 4;
const WIDTHS = 3;
const MIN_SIZE = 1.2;
const MAX_SIZE = 3.3;
const SIZE_STEP = (MAX_SIZE - MIN_SIZE) / WIDTHS;

/** Device pixels per CSS pixel, capped — a 4K booth screen is still only a bar. */
const MAX_DPR = 2;

/** How much of a spark's travel its trail shows, in seconds. */
const TRAIL_MS = 0.07;

/**
 * Shortest gap between drawn frames. The contact point runs at 30 whatever it
 * is doing, and only the brief surge as the lead turns over is worth every
 * frame — see the note in the loop.
 */
const DRAW_STEP = 1 / 30;

/**
 * Hottest at the contact point, each side's own colour away from it. Kept as
 * finished strings: a fresh `rgba(...)` per particle per frame is several
 * hundred colours a second to parse, and the fade rides globalAlpha instead.
 */
const INK = ['rgb(120,214,255)', 'rgb(255,252,236)', 'rgb(255,158,58)'] as const;
const BUCKETS = INK.length * FADES * WIDTHS;
const HUMAN_INK = 0;
const HOT_INK = 1;
const AI_INK = 2;
const FLECK_INK = 'rgb(255,246,214)';

export function ClashFX({
  shareRef,
  lead,
  laneHeight,
}: {
  /** The bar's live share, 0-100, written every frame by BattleBar's roll. */
  shareRef: RefObject<number>;
  lead: ArenaLead;
  /** The lane's design height, so the core is drawn exactly its height. */
  laneHeight: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // When the lead last changed hands, in the loop's own clock. The loop reads
  // this rather than closing over `lead`, so a new lead never restarts it.
  const leadChangedAt = useRef(0);
  const firstLead = useRef(lead);

  useEffect(() => {
    // The opening lead is not a change: the bar should not fire on load.
    if (lead === firstLead.current) return;
    firstLead.current = lead;
    leadChangedAt.current = performance.now();
  }, [lead]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    /*
     * Full motion unless the display asked for less AND the screen has not
     * claimed the kiosk exemption — the booth TV sets data-motion="always"
     * because a kiosk PC with "reduce motion" left on must still animate (see
     * globals.css). Reduced motion thins the sparks out rather than stopping:
     * a dead contact point reads as a broken screen.
     */
    const quiet =
      !canvas.closest('[data-motion="always"]') &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const emissionScale = quiet ? 0.25 : 1;

    // Particle state as parallel arrays: no per-frame objects, no garbage.
    const px = new Float32Array(MAX_PARTICLES);
    const py = new Float32Array(MAX_PARTICLES);
    const vx = new Float32Array(MAX_PARTICLES);
    const vy = new Float32Array(MAX_PARTICLES);
    const life = new Float32Array(MAX_PARTICLES); // seconds remaining
    const span = new Float32Array(MAX_PARTICLES); // seconds it started with
    const size = new Float32Array(MAX_PARTICLES);
    const ink = new Uint8Array(MAX_PARTICLES); // index into INK
    // Which draw batch each particle falls into this frame; -1 when dead.
    const bucket = new Int8Array(MAX_PARTICLES);
    let cursor = 0;

    let width = 0;
    let height = 0;
    let seamX = 0;
    let midY = 0;
    let laneWidth = 1;
    let dprScale = 1;
    const coreH = laneHeight + 26;

    /*
     * The three gradients of the core, built once. They can be, because the
     * canvas is fixed on the seam and so the core is always at the same place
     * in it — and because every stop in all three scales with the same `heat`,
     * so the core's whole brightness rides globalAlpha instead.
     */
    let bleed: CanvasGradient | null = null;
    let bloom: CanvasGradient | null = null;
    let shoulder: CanvasGradient | null = null;

    const buildGradients = () => {
      // Each side's colour driven into the other's, kept narrow: the brief is
      // a contact point, not a flare, and this is additive over the brightest
      // object on the screen.
      bleed = ctx.createLinearGradient(seamX - 22, 0, seamX + 22, 0);
      bleed.addColorStop(0, 'rgba(40,150,255,0)');
      bleed.addColorStop(0.3, 'rgba(70,185,255,0.42)');
      bleed.addColorStop(0.5, 'rgba(255,255,255,0.5)');
      bleed.addColorStop(0.7, 'rgba(255,160,55,0.42)');
      bleed.addColorStop(1, 'rgba(255,120,25,0)');

      // A gradient rather than a shadowBlur: a blur filter every frame is the
      // one thing this canvas must never do.
      bloom = ctx.createRadialGradient(seamX, midY, 0, seamX, midY, 21);
      bloom.addColorStop(0, 'rgba(255,255,255,0.8)');
      bloom.addColorStop(0.4, 'rgba(226,245,255,0.26)');
      bloom.addColorStop(1, 'rgba(190,225,255,0)');

      // The contact line's shoulder, carrying heat a little past the lane top
      // and bottom and fading out rather than ending on a cut.
      shoulder = ctx.createLinearGradient(0, midY - coreH / 2, 0, midY + coreH / 2);
      shoulder.addColorStop(0, 'rgba(200,238,255,0)');
      shoulder.addColorStop(0.16, 'rgba(232,248,255,0.7)');
      shoulder.addColorStop(0.5, 'rgba(255,255,255,0.95)');
      shoulder.addColorStop(0.84, 'rgba(232,248,255,0.7)');
      shoulder.addColorStop(1, 'rgba(200,238,255,0)');
    };

    /** Match the backing store to what the element really covers on screen. */
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      laneWidth = canvas.parentElement?.clientWidth || width;
      seamX = width / 2;
      midY = height / 2;
      // getBoundingClientRect is post-transform, so this already accounts for
      // the stage's scale: a 4K screen gets a sharper bar, not a stretched one.
      dprScale = Math.min(MAX_DPR, (window.devicePixelRatio || 1) * (rect.width / (width || rect.width)));
      const backingW = Math.round(width * dprScale);
      const backingH = Math.round(height * dprScale);
      if (canvas.width !== backingW || canvas.height !== backingH) {
        canvas.width = backingW;
        canvas.height = backingH;
      }
      ctx.setTransform(dprScale, 0, 0, dprScale, 0, 0);
      // A resized backing store drops everything the context held, gradients
      // included, so they are rebuilt against the new geometry here.
      buildGradients();
    };
    resize();
    window.addEventListener('resize', resize);

    const spawn = (speed: number, spread: number, which: number) => {
      const i = cursor;
      cursor = (cursor + 1) % MAX_PARTICLES;
      // Perpendicular to the bar by default: up and down, with a little
      // sideways ricochet. Almost nothing travels along the lane, because two
      // forces meeting head-on throw material out of the seam, not down it.
      const up = Math.random() < 0.5 ? -1 : 1;
      const angle = up * (Math.PI / 2) + (Math.random() - 0.5) * spread;
      const v = speed * (0.55 + Math.random() * 0.75);
      px[i] = seamX + (Math.random() - 0.5) * 2.5;
      py[i] = midY + (Math.random() - 0.5) * laneHeight * 0.8;
      vx[i] = Math.cos(angle) * v * 0.55;
      vy[i] = Math.sin(angle) * v;
      span[i] = life[i] = 0.2 + Math.random() * 0.4;
      size[i] = MIN_SIZE + Math.random() * (MAX_SIZE - MIN_SIZE);
      ink[i] = which;
    };

    let raf = 0;
    let last = performance.now();
    let lastShare = shareRef.current ?? 50;
    let emberDebt = 0;
    // Time and seam travel banked since the last frame that was actually drawn.
    let banked = 0;
    let bankedShift = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // Clamped: a tab returning from the background must not integrate one
      // huge step and fling every particle off the bar.
      banked += Math.min(0.05, (now - last) / 1000);
      last = now;

      const share = shareRef.current ?? lastShare;
      // Design px the seam has travelled since the last drawn frame: what
      // "grinding" is measured in, and how far the sparks already in the air
      // have to be pushed back.
      bankedShift += ((share - lastShare) / 100) * laneWidth;
      lastShare = share;

      const sinceLead = now - leadChangedAt.current;
      // One short surge as the lead crosses over, then back to idle.
      const leadSurge = leadChangedAt.current > 0 && sinceLead < 520 ? 1 - sinceLead / 520 : 0;

      /*
       * 30 frames a second, not 60. Redrawing this canvas costs the GPU the
       * same whatever is on it — the price is per frame drawn, not per pixel,
       * and shrinking the canvas fourfold changed nothing — so the rate is the
       * only lever that matters. At 30 the sparks are still streaks with a
       * motion trail and nobody can tell; at 60 a single score change cost
       * half again as much GPU as the whole rest of the roll.
       *
       * The one exception is the surge as the lead turns over: half a second,
       * the hardest thing the bar ever does, and the moment a visitor is most
       * likely to be looking straight at it.
       */
      if (leadSurge === 0 && banked < DRAW_STEP) return;

      const dt = banked;
      const shift = bankedShift;
      const travel = Math.abs(shift);
      banked = 0;
      bankedShift = 0;

      /* ---- emit ---- */

      // Idle embers: sparse, and fractional rates are carried between frames
      // so a slow trickle still arrives instead of rounding away to nothing.
      emberDebt += dt * 34 * emissionScale;
      // Grinding: the faster the seam travels, the more it throws.
      emberDebt += Math.min(travel * 4.2, 14) * emissionScale;
      emberDebt += leadSurge * dt * 200 * emissionScale;
      while (emberDebt >= 1) {
        emberDebt -= 1;
        const grinding = travel > 0.04 || leadSurge > 0;
        // Fast enough to clear the lit bar and be seen against the dark above
        // and below it: a spark that dies inside the fill is a spark nobody
        // sees, because the fill is the brightest thing on the screen.
        const speed = grinding ? 210 + leadSurge * 170 : 128;
        const spread = grinding ? 1.15 : 0.72;
        // Most sparks are white-hot at the contact point; the rest take the
        // colour of the side they were torn from.
        const roll = Math.random();
        spawn(speed, spread, roll < 0.46 ? HOT_INK : roll < 0.73 ? HUMAN_INK : AI_INK);
      }

      /* ---- move ---- */

      ctx.clearRect(0, 0, width, height);
      // Sparks are light: they add, never occlude.
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';

      for (let i = 0; i < MAX_PARTICLES; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        if (life[i] <= 0) continue;
        // Back by however far the window moved, so a spark stays where it was
        // thrown instead of being carried along by the seam that threw it.
        px[i] += vx[i] * dt - shift;
        py[i] += vy[i] * dt;
        vy[i] += 340 * dt; // gravity: they arc over and fall back
        vx[i] *= 1 - 2.4 * dt; // and lose their sideways push quickly
      }

      /* ---- draw, batched ---- */

      /*
       * Every spark sharing a colour, a brightness step and a width is stroked
       * in ONE path. Drawn individually — beginPath, moveTo, lineTo, stroke
       * per particle — a full pool is over a thousand canvas calls a frame,
       * and a full pool is exactly what a moving seam produces, so the bar
       * cost most while it was doing the thing it exists to show.
       *
       * The price is that alpha and width come in steps rather than smoothly.
       * On something that lives a third of a second and is two pixels wide,
       * that is not a difference anybody can see.
       */
      for (let i = 0; i < MAX_PARTICLES; i++) {
        if (life[i] <= 0) {
          bucket[i] = -1;
          continue;
        }
        const t = life[i] / span[i];
        const fade = Math.min(FADES - 1, (t * FADES) | 0);
        const wide = Math.min(WIDTHS - 1, ((size[i] - MIN_SIZE) / SIZE_STEP) | 0);
        bucket[i] = (ink[i] * FADES + fade) * WIDTHS + wide;
      }

      for (let bkt = 0; bkt < BUCKETS; bkt++) {
        let open = false;
        for (let i = 0; i < MAX_PARTICLES; i++) {
          if (bucket[i] !== bkt) continue;
          if (!open) {
            ctx.beginPath();
            open = true;
          }
          // The trail is the last TRAIL_MS of travel, not the last frame's —
          // one frame is two or three pixels, which reads as a dot however
          // fast the spark is actually moving.
          ctx.moveTo(px[i] - vx[i] * TRAIL_MS, py[i] - vy[i] * TRAIL_MS);
          ctx.lineTo(px[i], py[i]);
        }
        if (!open) continue;
        const wide = bkt % WIDTHS;
        // Mid-step, so a batch sits in the middle of the range it stands for.
        const t = ((((bkt / WIDTHS) | 0) % FADES) + 0.5) / FADES;
        ctx.strokeStyle = INK[(bkt / (WIDTHS * FADES)) | 0];
        ctx.globalAlpha = Math.min(1, t * 1.25);
        ctx.lineWidth = (MIN_SIZE + (wide + 0.5) * SIZE_STEP) * (0.45 + t * 0.55);
        ctx.stroke();
      }

      /* ---- the contact core ---- */

      // A flicker with no period a viewer can latch onto, so the seam looks
      // worked rather than animated.
      const flicker = 0.86 + 0.14 * Math.sin(now / 47) * Math.sin(now / 113);
      const heat = Math.min(1, flicker + leadSurge * 0.4 + Math.min(travel * 0.05, 0.14));

      ctx.globalAlpha = heat;
      ctx.fillStyle = bleed!;
      ctx.fillRect(seamX - 22, midY - coreH / 2, 44, coreH);
      ctx.fillStyle = bloom!;
      ctx.fillRect(seamX - 21, midY - 21, 42, 42);
      ctx.fillStyle = shoulder!;
      ctx.fillRect(seamX - 1.6, midY - coreH / 2, 3.2, coreH);
      // The white core inside the shoulder, which never blows out.
      ctx.globalAlpha = heat * 0.95;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(seamX - 0.5, midY - laneHeight / 2, 1, laneHeight);

      // Grinding flecks: a couple of hot points jittering along the contact
      // itself, so the two faces read as scraping rather than merely touching.
      ctx.fillStyle = FLECK_INK;
      const flecks = 2 + Math.round(Math.min(travel * 0.7, 3) + leadSurge * 3);
      for (let f = 0; f < flecks; f++) {
        ctx.globalAlpha = (0.3 + Math.random() * 0.55) * heat;
        ctx.fillRect(
          seamX - 1.4 + Math.random() * 2.8,
          midY + (Math.random() - 0.5) * laneHeight * 0.92,
          1.4 + Math.random() * 1.4,
          1.2,
        );
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    // rAF is already parked while the tab is hidden; this also drops the
    // backlog so the first frame back does not arrive with a huge dt.
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', resize);
    };
    // laneHeight is a fixed design number and shareRef is a stable ref. Neither
    // the lead nor the share may restart this loop — they are read from refs.
  }, [shareRef, laneHeight]);

  return <canvas ref={canvasRef} className={styles.clash} aria-hidden="true" />;
}
