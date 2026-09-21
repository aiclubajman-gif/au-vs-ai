import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
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

/** Shortest gap between a rolling number's writes to the DOM (30 a second). */
const WRITE_INTERVAL_MS = 1000 / 30;

export type RollOptions = { from?: number; delayMs?: number; durationMs?: number };

/**
 * A number that rolls smoothly to `target` whenever it changes, handing each
 * frame's value to `apply` — which writes it straight to the DOM.
 *
 * It restarts from wherever it had got to if the target moves again mid-roll,
 * and `from` makes it roll up from that value when it first appears, starting
 * `delayMs` after mount (so the screen's intro can finish first).
 *
 * The values deliberately never reach React state. Six of these run at once on
 * this screen — the bar, both win totals and all three leaderboard rows — and
 * every finished game sets them all rolling together, so state here meant
 * around 360 component renders a second for a second and a half, every few
 * seconds, for as long as the booth is open. Measured over 10s with the
 * screen's own mock feed (a game every 3.5s) against the same screen on a
 * frozen feed, the rolls cost 1231ms of GPU time against 409ms: three times
 * everything else the arena does put together. That is what the mascot was
 * stuttering through — it is the one thing on the screen whose motion is
 * legible frame by frame, so it is the only place the dropped frames showed.
 *
 * `apply` is read fresh each frame, so a call site may close over whatever it
 * likes without restarting the roll.
 */
export function useRollingNumber(
  target: number,
  apply: (value: number) => void,
  { from = target, delayMs = 0, durationMs = ARENA_TIMING.countUpMs }: RollOptions = {},
): void {
  // Kept current after each commit rather than during render, so the roll
  // always calls the latest `apply` without listing it as a dependency and
  // restarting itself every time a call site re-renders.
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  });

  const current = useRef(from);
  const applied = useRef<number | null>(null);
  const mountedAt = useRef<number | null>(null);

  useEffect(() => {
    // Writing the same number again still invalidates style, and during the
    // intro delay every frame would write the same one.
    let wroteAt = 0;
    const write = (value: number) => {
      if (applied.current === value) return;
      applied.current = value;
      applyRef.current(value);
      wroteAt = performance.now();
    };

    mountedAt.current ??= performance.now();
    const start = Math.max(performance.now(), mountedAt.current + delayMs);
    const origin = current.current;
    if (origin === target) {
      write(target);
      return;
    }
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, Math.max(0, (now - start) / durationMs));
      const next = t >= 1 ? target : origin + (target - origin) * easeOutCubic(t);
      current.current = next;
      /*
       * At most WRITE_HZ writes a second, and always the last one.
       *
       * Every write here moves --human, which the bar's chassis, its well, its
       * two fills, both illuminated outlines and the clash all draw from — so
       * one write is a repaint of the whole bar. At 60 a single score change
       * cost half again as much GPU as the same roll does at 30, and a number
       * easing over a second and a half is not something anyone can see the
       * difference on. The final frame is never skipped, so the bar always
       * comes to rest on the exact share.
       */
      if (t >= 1 || now - wroteAt >= WRITE_INTERVAL_MS) write(next);
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, delayMs, durationMs]);
}

/**
 * The same roll, written into one element's text. Attach the ref to whatever
 * shows the number; `format` turns each frame's value into what it reads.
 *
 * The element must render `format(from ?? target)` on the server, so the first
 * paint already says the right thing and the roll only ever continues it.
 */
export function useRollingText<T extends HTMLElement = HTMLElement>(
  target: number,
  format: (value: number) => string,
  options: RollOptions = {},
): RefObject<T | null> {
  const ref = useRef<T>(null);
  const formatRef = useRef(format);
  useEffect(() => {
    formatRef.current = format;
  });
  useRollingNumber(
    target,
    useCallback((value: number) => {
      const el = ref.current;
      if (!el) return;
      const text = formatRef.current(value);
      // Rounded counts repeat for many frames in a row; skip the no-op writes.
      if (el.textContent !== text) el.textContent = text;
    }, []),
    options,
  );
  return ref;
}

/**
 * Replays the CSS animations already on an element, without remounting it.
 *
 * The alternative is a React key, which throws the node away and builds a new
 * one — and on this screen the nodes that want a replayed animation are the
 * same ones holding a number that is mid-roll, which a remount would reset.
 */
export function restartAnimations(el: Element | null): void {
  if (!el) return;
  for (const animation of el.getAnimations()) {
    animation.cancel();
    animation.play();
  }
}
