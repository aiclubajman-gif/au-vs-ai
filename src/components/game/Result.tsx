'use client';

import { useEffect, useState } from 'react';
import type { PublicAttemptResult } from '@/types';

/**
 * Result screen (§24).
 *
 * Shows total, human/AI verdict, rank and percentile — and nothing else.
 * §22 forbids per-round scores, partly to protect the shared Round 3 answer
 * and partly because a single big number is a better booth moment.
 */
export function Result({
  result,
  returning = false,
}: {
  result: PublicAttemptResult;
  /**
   * True when the student is reopening a finished game rather than having just
   * completed it. Showing the same celebratory screen both ways is confusing:
   * they need to see their score AND understand their attempt is used up.
   */
  returning?: boolean;
}) {
  const [shown, setShown] = useState(returning ? result.totalScore : 0);
  const [screen, setScreen] = useState<1 | 2>(1);

  // Count-up. Respects reduced motion by finishing immediately.
  useEffect(() => {
    // A returning student has seen this number before; counting it up again
    // would pretend they just earned it.
    if (returning) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(result.totalScore);
      return;
    }
    const duration = 1400;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(result.totalScore * eased));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [result.totalScore, returning]);

  if (screen === 2) {
    return (
      <main className="flex min-h-dvh flex-col px-6 py-8">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          <h1 className="text-3xl font-bold">You&apos;re on the leaderboard</h1>
          <p className="mt-4 text-sm leading-relaxed text-[var(--color-muted)]">
            Keep an eye on the AU vs AI screen at the AIDA booth at the end of the Club Fair
            to see the final rankings and winners.
          </p>

          <div className="mt-10 rounded-2xl border border-[var(--color-cyan-dim)] bg-[var(--color-navy)] p-5">
            <h2 className="text-lg font-semibold">Want another chance to win?</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
              Your score is already in the running for the leaderboard prize. Register with
              AIDA and you&apos;re also entered into our subscription raffle.
            </p>
            <a
              href="/register"
              className="mt-5 block w-full rounded-xl bg-[var(--color-cyan)] px-6 py-4 text-center font-semibold text-[var(--color-void)]"
            >
              Register with AIDA
            </a>
          </div>

          <a
            href="/leaderboard"
            className="mt-6 block w-full py-3 text-center text-sm text-[var(--color-muted)]"
          >
            Finish
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col px-6 py-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center text-center">
        {returning && (
          <div className="mb-8 rounded-xl border border-[var(--color-edge)] bg-[var(--color-navy)] px-4 py-3">
            <p className="text-sm font-semibold">You&apos;ve already played</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
              One official attempt per student. This is your final score.
            </p>
          </div>
        )}

        <p className="text-sm tracking-[0.3em] text-[var(--color-cyan-dim)]">
          {returning ? 'YOUR FINAL SCORE' : 'YOUR SCORE'}
        </p>

        <p className="tabular mt-4 text-7xl font-bold leading-none">
          {shown}
          <span className="text-3xl text-[var(--color-muted)]"> / 1000</span>
        </p>

        <p
          className={`mt-6 text-2xl font-bold ${
            result.humanWin ? 'text-[var(--color-win)]' : 'text-[var(--color-lose)]'
          }`}
        >
          {result.humanWin ? 'Human win' : 'AI win'}
        </p>

        <div className="mt-10 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[var(--color-edge)] bg-[var(--color-navy)] px-4 py-4">
            <p className="text-xs text-[var(--color-muted)]">Rank</p>
            <p className="tabular mt-1 text-3xl font-bold">#{result.rank}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-edge)] bg-[var(--color-navy)] px-4 py-4">
            <p className="text-xs text-[var(--color-muted)]">You beat</p>
            <p className="tabular mt-1 text-3xl font-bold">{result.percentileBeaten}%</p>
          </div>
        </div>

        <button
          onClick={() => setScreen(2)}
          className="mt-10 min-h-[60px] w-full rounded-xl bg-[var(--color-cyan)] text-base font-semibold text-[var(--color-void)]"
        >
          {returning ? 'View leaderboard' : 'Next'}
        </button>
      </div>
    </main>
  );
}
