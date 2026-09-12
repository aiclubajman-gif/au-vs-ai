'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Round3Assignment } from '@/types';

/**
 * Round 3 — You vs AIDA.
 *
 * §18: every student answers the SAME question, so §21 forbids any feedback at
 * all. No correct answer, no error, no points, not even "close". One leaked
 * hint would travel down the queue in minutes.
 *
 * A slider rather than a keyboard: one thumb gesture, no keyboard covering the
 * screen, no typos, and no way to enter something absurd under time pressure.
 */
export function Round3({
  attemptId,
  assignment,
  durationMs,
  onComplete,
}: {
  attemptId: string;
  assignment: Round3Assignment;
  durationMs: number;
  onComplete: () => void;
}) {
  const mid = Math.round((assignment.minValue + assignment.maxValue) / 2);
  const [guess, setGuess] = useState(mid);
  const [locked, setLocked] = useState(false);
  const [remaining, setRemaining] = useState(durationMs);
  const startedAt = useRef(Date.now());
  const submitted = useRef(false);

  const submit = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    setLocked(true);

    await fetch('/api/round3/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attemptId, guess, idempotencyKey: crypto.randomUUID() }),
    }).catch(() => {});

    setTimeout(onComplete, 1100);
  }, [attemptId, guess, onComplete]);

  useEffect(() => {
    if (locked) return;
    const tick = setInterval(() => {
      const left = durationMs - (Date.now() - startedAt.current);
      setRemaining(left);
      if (left <= 0) submit();
    }, 100);
    return () => clearInterval(tick);
  }, [locked, durationMs, submit]);

  const seconds = Math.max(0, Math.ceil(remaining / 1000));
  const progress = Math.max(0, Math.min(1, remaining / durationMs));

  return (
    <main className="flex min-h-dvh flex-col px-5 py-6">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-muted)]">You vs AIDA</span>
          <span className="tabular font-bold text-[var(--color-cyan)]">{seconds}s</span>
        </div>

        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--color-edge)]">
          <div
            className="h-full bg-[var(--color-cyan)] transition-[width] duration-100 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <p className="text-center text-xl font-semibold leading-relaxed">
            {assignment.prompt}
          </p>

          <p className="tabular mt-10 text-center text-6xl font-bold text-[var(--color-cyan)]">
            {guess}
          </p>
          {assignment.unit && (
            <p className="mt-1 text-center text-sm text-[var(--color-muted)]">
              {assignment.unit}
            </p>
          )}

          <input
            type="range"
            min={assignment.minValue}
            max={assignment.maxValue}
            step={assignment.step}
            value={guess}
            disabled={locked}
            onChange={(e) => setGuess(Number(e.target.value))}
            aria-label="Your guess"
            className="mt-8 w-full accent-[var(--color-cyan)]"
          />

          <div className="mt-2 flex justify-between text-xs text-[var(--color-muted)]">
            <span>{assignment.minValue}</span>
            <span>{assignment.maxValue}</span>
          </div>
        </div>

        <button
          onClick={submit}
          disabled={locked}
          className="min-h-[60px] w-full rounded-xl bg-[var(--color-cyan)] text-base font-semibold text-[var(--color-void)] disabled:opacity-40"
        >
          {locked ? 'Answer locked' : 'Lock answer'}
        </button>
      </div>
    </main>
  );
}
