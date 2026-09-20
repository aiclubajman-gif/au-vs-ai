import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { NEW_WATCH, watchLead, type LeadWatch } from '@/lib/arena/atmosphere';
import type { ArenaLead } from '@/lib/arena/types';
import type { ArenaFeed } from './feeds';
import { ARENA_TIMING } from './config';
import { STAGE_H, STAGE_W } from './geometry';

/**
 * Scales the 1920 x 1080 stage to fit the window (letterboxed, never cropped)
 * by setting --stage-scale on `ref`. data-ready flips once it is measured so
 * the first frame never shows the unscaled stage.
 */
export function useStageScale(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
      el.style.setProperty('--stage-scale', String(scale));
      el.dataset.ready = 'true';
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [ref]);
}

/**
 * Things a screen left running at a booth needs: it keeps the display awake,
 * hides the mouse pointer when it is still, F (or a double-click) toggles full
 * screen, and it reloads itself every so often (see useSelfReload).
 */
export function useKioskMode(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let lock: WakeLockSentinel | null = null;
    const keepAwake = async () => {
      if (document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        // Not allowed here (no user gesture yet, or an old browser): the OS
        // sleep setting then decides, which is fine for a preview.
      }
    };
    keepAwake();
    document.addEventListener('visibilitychange', keepAwake);

    let hideTimer = 0;
    const showCursor = () => {
      el.dataset.cursor = 'visible';
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => (el.dataset.cursor = 'hidden'), ARENA_TIMING.cursorHideMs);
    };
    showCursor();
    window.addEventListener('pointermove', showCursor);

    const toggleFullscreen = () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else document.documentElement.requestFullscreen().catch(() => {});
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    };
    window.addEventListener('keydown', onKey);
    el.addEventListener('dblclick', toggleFullscreen);

    return () => {
      document.removeEventListener('visibilitychange', keepAwake);
      lock?.release().catch(() => {});
      window.removeEventListener('pointermove', showCursor);
      window.clearTimeout(hideTimer);
      window.removeEventListener('keydown', onKey);
      el.removeEventListener('dblclick', toggleFullscreen);
    };
  }, [ref]);
}

/**
 * Reloads the page every ARENA_TIMING.selfReloadMs, so a TV left on all day
 * picks up a new deploy and sheds anything a long-running tab accumulates
 * (the booth runbook promises this). It first checks the server answers:
 * reloading while the network is down would swap the arena for the browser's
 * offline page, which never comes back on its own.
 */
export function useSelfReload() {
  useEffect(() => {
    let timer = 0;
    const attempt = async () => {
      try {
        const res = await fetch(window.location.href, { method: 'HEAD', cache: 'no-store' });
        if (res.ok) {
          window.location.reload();
          return;
        }
      } catch {
        // Offline: keep showing the last good screen and try again shortly.
      }
      timer = window.setTimeout(attempt, 60_000);
    };
    timer = window.setTimeout(attempt, ARENA_TIMING.selfReloadMs);
    return () => window.clearTimeout(timer);
  }, []);
}

/**
 * Demo keys, mock feed only: H / A / T jump to humans leading, AI leading or a
 * dead heat; N finishes a game now. Handy for showing the lighting states.
 */
export function useDemoKeys(feed: ArenaFeed) {
  useEffect(() => {
    if (!feed.force) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'h') feed.force?.('human');
      else if (key === 'a') feed.force?.('ai');
      else if (key === 't') feed.force?.('tie');
      else if (key === 'n') feed.tickNow?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [feed]);
}

/**
 * Counts the times the lead has changed hands, for the arena's flare when it
 * does. The count is the flare's React key: a new one plays the flare once,
 * and the same one leaves the element alone, so scores that move without
 * changing who is ahead pass by without an arena response.
 *
 * `settled` is false until real numbers have arrived (see watchLead). Nothing
 * here runs on a timer or listens to anything: it only reacts to a lead the
 * screen has already derived, and watchLead hands back the very same object
 * when nothing has changed, so an unchanged lead does not even re-render.
 */
export function useLeadChanges(lead: ArenaLead, settled: boolean): number {
  const [watch, setWatch] = useState<LeadWatch>(NEW_WATCH);
  const next = watchLead(watch, lead, settled);
  // Adjusted while rendering rather than in an effect, so the flare mounts in
  // the same commit as the lighting it belongs to: React drops this render and
  // redoes it with the new count before anything reaches the screen. An
  // unchanged lead gives back the same object, so this is the quiet path.
  if (next !== watch) setWatch(next);
  return next.sting;
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * A number that rolls smoothly to `target` whenever it changes, restarting
 * from wherever it had got to if the target moves again mid-roll.
 *
 * `from` makes it roll up from that value when it first appears, starting
 * `delayMs` after mount (so the screen's intro can finish first).
 */
export function useCountUp(
  target: number,
  {
    from = target,
    delayMs = 0,
    durationMs = ARENA_TIMING.countUpMs,
  }: { from?: number; delayMs?: number; durationMs?: number } = {},
): number {
  const [value, setValue] = useState(from);
  const current = useRef(from);
  const mountedAt = useRef<number | null>(null);

  useEffect(() => {
    mountedAt.current ??= performance.now();
    const start = Math.max(performance.now(), mountedAt.current + delayMs);
    const origin = current.current;
    if (origin === target) return;
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, Math.max(0, (now - start) / durationMs));
      const next = t >= 1 ? target : origin + (target - origin) * easeOutCubic(t);
      current.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, delayMs, durationMs]);

  return value;
}
