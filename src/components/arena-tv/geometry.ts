import type { CSSProperties } from 'react';

/**
 * Where the art sits on the arena screen, and the maths that lets live content
 * sit exactly on it.
 *
 * Everything is placed on a 1920 x 1080 stage that is scaled to fit the
 * display (see useStageScale), so these are 1080p pixels whatever the TV.
 */
export const STAGE_W = 1920;
export const STAGE_H = 1080;

/*
 * LED ring. led-ring.webp is drawn from a 3840 x 2160 master; RING_FIT is its
 * band's front face measured on that master: the two glowing edge lines were
 * traced and fitted with a cylinder seen in perspective (RMS error 4.6px top,
 * 3.0px bottom — about 1.5px on screen). In the model a point on the band at
 * angle t from the front lands at
 *
 *   x = ox + a·sin t / (1 − r·cos t)      y = oy + b / (1 − r·cos t)
 *
 * with b = bt on the top edge and bb on the bottom one. That is exactly a CSS
 * 3D cylinder of radius a, seen with perspective a / r from (ox, oy), whose
 * band spans oy + bt … oy + bb on the axis plane. Keep in sync with RING in
 * scripts/build-arena-tv-assets.mjs.
 */
const RING_FIT = { ox: 1922, oy: 2454.2, a: 1775.28, r: 0.3203, bt: -1210.7, bb: -868.2 };
const RING_MASTER = { width: 3840, height: 2160 };

/** Ring placement: master pixels × scale, top-left corner on the stage. */
const RING = { scale: 0.33, left: 325.7, top: -200 };

/** Logo panels around the whole ring (a multiple of RING_LOGOS' length, 2). */
export const RING_PANELS = 18;

export function ringStyle(): CSSProperties {
  const k = RING.scale;
  const { ox, oy, a, r, bt, bb } = RING_FIT;
  const radius = a * k;
  return {
    left: RING.left,
    top: RING.top,
    width: RING_MASTER.width * k,
    height: RING_MASTER.height * k,
    '--ring-perspective': `${(a / r) * k}px`,
    '--ring-origin': `${ox * k}px ${oy * k}px`,
    '--ring-axis-x': `${ox * k}px`,
    '--ring-band-top': `${(oy + bt) * k}px`,
    '--ring-band-h': `${(bb - bt) * k}px`,
    '--ring-radius': `${radius}px`,
    // Flat panels whose centres touch the cylinder, edge to edge.
    '--ring-panel-w': `${2 * radius * Math.tan(Math.PI / RING_PANELS)}px`,
    '--ring-step': `${360 / RING_PANELS}deg`,
  } as CSSProperties;
}

/*
 * Hanging screen. hanging-screen.webp comes from a 3840 x 2160 master whose
 * LED panel (inside the glowing edge) is the rectangle below.
 */
const SCREEN_MASTER = { width: 3840, height: 2160, led: { x: 304, y: 466, w: 3232, h: 1020 } };

/** Screen placement: master pixels × scale, top-left corner on the stage. */
const SCREEN = { scale: 0.2352, left: 508.4, top: 152.4 };

export function screenStyle(): CSSProperties {
  const k = SCREEN.scale;
  const { led } = SCREEN_MASTER;
  return {
    left: SCREEN.left,
    top: SCREEN.top,
    width: SCREEN_MASTER.width * k,
    height: SCREEN_MASTER.height * k,
    '--led-x': `${led.x * k}px`,
    '--led-y': `${led.y * k}px`,
    '--led-w': `${led.w * k}px`,
    '--led-h': `${led.h * k}px`,
  } as CSSProperties;
}
