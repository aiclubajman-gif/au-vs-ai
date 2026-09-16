'use client';

import { useLayoutEffect, type RefObject } from 'react';

/**
 * The height a phone is actually showing, in CSS pixels.
 *
 * `100dvh`, `100svh` and `innerHeight` each disagree with what Safari paints
 * once its toolbars move, which is what left the full-screen compositions a few
 * pixels taller than the screen and scrolling. The visual viewport is the
 * visible rectangle itself. It is multiplied back by its scale so pinching to
 * zoom (allowed up to 5×) does not shrink the shell to the zoomed-in slice.
 */
export function readAppHeight(): number {
  const vv = window.visualViewport;
  return vv ? vv.height * vv.scale : window.innerHeight;
}

/**
 * Keeps `--app-height` on `ref`'s element equal to the visible viewport height,
 * so a full-screen shell can be exactly as tall as the screen. Until this runs
 * (server render, first paint) the stylesheet's fallback applies.
 */
export function useAppHeight(ref: RefObject<HTMLElement | null>) {
  // Layout effect: set before the first paint, not one frame after it.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const apply = () => el.style.setProperty('--app-height', `${readAppHeight()}px`);
    apply();

    const vv = window.visualViewport;
    vv?.addEventListener('resize', apply);
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    return () => {
      vv?.removeEventListener('resize', apply);
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
    };
  }, [ref]);
}
