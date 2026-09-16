'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Round interstitials.
 *
 * Two jobs. Before a round: explain it, so nobody wastes their timer working
 * out what to do — the commonest way a student has a bad game. After a round:
 * one fact that makes the point of the round land, which is the educational
 * payoff for an AI club running a game.
 *
 * These sit OUTSIDE the 60 seconds. The clock only runs during rounds.
 */

export interface RoundIntro {
  eyebrow: string;
  title: string;
  lines: string[];
}

export interface RoundOutro {
  eyebrow: string;
  fact: string;
  source?: string;
}

/**
 * `{n}` is replaced with the configured timer, so copy follows admin settings.
 * Round 1 is introduced by the How It Works screen (HowItWorks.tsx).
 */
export const ROUND_INTROS: Record<2 | 3, RoundIntro> = {
  2: {
    eyebrow: 'ROUND 2 OF 3',
    title: 'Draw vs AI',
    lines: [
      "You'll be given one object to draw.",
      '{n} seconds, using your finger.',
      'The AI only looks once you submit — so draw it your way.',
    ],
  },
  3: {
    eyebrow: 'ROUND 3 OF 3',
    title: 'You vs AIDA',
    lines: [
      'One question about the AIDA board.',
      '{n} seconds to slide to your best guess.',
      'Closer guesses score more. Everyone today gets the same question.',
    ],
  },
};

/** Rounds 1 and 2 end on the Fun Fact screen (FunFact.tsx). */
export const ROUND_OUTROS: Record<3, RoundOutro> = {
  3: {
    eyebrow: 'ALL ROUNDS COMPLETE',
    fact: 'Scoring your game…',
  },
};

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

/**
 * Shown for `seconds`, with a Continue button so a student who reads fast is
 * never made to wait. Auto-advances for anyone who is not looking.
 */
export function Interstitial({
  intro,
  outro,
  seconds = 7,
  timerValue,
  onDone,
}: {
  intro?: RoundIntro;
  outro?: RoundOutro;
  seconds?: number;
  timerValue?: number;
  onDone: () => void;
}) {
  const { remaining, advance } = useAutoAdvance(seconds, onDone);

  const content = intro ?? outro;
  if (!content) return null;

  const isIntro = Boolean(intro);

  return (
    <main className="flex min-h-dvh flex-col px-6 py-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <p className="text-xs tracking-[0.3em] text-[var(--color-cyan-dim)]">
          {content.eyebrow}
        </p>

        {isIntro && intro && (
          <>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight">
              {intro.title}
            </h1>
            <ul className="mt-8 space-y-4">
              {intro.lines.map((line, i) => (
                <li key={i} className="flex gap-3 text-base leading-relaxed">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-cyan)]" />
                  <span>
                    {timerValue != null
                      ? line.replace('{n}', String(timerValue))
                      : line.replace('{n}', '')}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {!isIntro && outro && (
          <p className="mt-6 text-lg leading-relaxed">{outro.fact}</p>
        )}
      </div>

      <div className="mx-auto w-full max-w-md">
        <button
          onClick={advance}
          className="min-h-[60px] w-full rounded-xl bg-[var(--color-cyan)] text-base font-semibold text-[var(--color-void)]"
        >
          {isIntro ? "I'm ready" : 'Continue'}
          <span className="tabular ml-2 opacity-60">{remaining}</span>
        </button>
        <p className="mt-3 text-center text-xs text-[var(--color-muted)]">
          This screen is not timed. Your 60 seconds only counts during rounds.
        </p>
      </div>
    </main>
  );
}
