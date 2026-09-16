'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * The countdown an untimed screen uses to move on by itself. The button calls
 * `advance`, and the countdown ends through the same guard, so a tap in the
 * instant the timer runs out still moves the game forward exactly once. The
 * guard lives in the component instance, which is why each screen needs its
 * own `key` in the play flow.
 *
 * `onDone` is read through a ref: the play flow passes a fresh arrow on every
 * render (the OTP resend cooldown re-renders it each second), and restarting
 * the one-second tick on each of those would stall the countdown.
 *
 * Used by How It Works and the two Fun Facts — the only untimed screens left
 * between rounds now that the generic round interstitials are gone.
 */
export function useAutoAdvance(seconds: number, onDone: () => void) {
  const [remaining, setRemaining] = useState(seconds);
  const done = useRef(false);
  const latestOnDone = useRef(onDone);

  useEffect(() => {
    latestOnDone.current = onDone;
  });

  const advance = useCallback(() => {
    if (done.current) return;
    done.current = true;
    latestOnDone.current();
  }, []);

  useEffect(() => {
    if (remaining <= 0) {
      advance();
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, advance]);

  return { remaining: Math.max(0, remaining), advance };
}
