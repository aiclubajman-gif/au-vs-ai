'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { RetryNotice } from '@/components/ui';
import {
  submitWithRetry,
  isRetryable,
  describeSaveFailure,
  type SubmitFailure,
} from '@/lib/client/submit';
import type { Round3Assignment } from '@/types';

interface Round3AnswerBody {
  attemptId: string;
  guess: number;
  idempotencyKey: string;
}

/** Shortest time "Answer locked" is shown before scoring begins. */
const LOCK_MS = 1100;

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
  const [saving, setSaving] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [failure, setFailure] = useState<SubmitFailure | null>(null);
  const startedAt = useRef(0);
  const submitted = useRef(false);
  /** The locked guess. Retries resend exactly this, same key included. */
  const submission = useRef<Round3AnswerBody | null>(null);
  const inFlight = useRef(false);
  const lockedAt = useRef(0);
  const unmounted = useRef(false);

  // The clock starts when the question is first on screen.
  useEffect(() => {
    startedAt.current = Date.now();
    unmounted.current = false;
    return () => {
      unmounted.current = true;
    };
  }, []);

  /** Saves the locked guess and moves on only once the server has it. */
  const save = useCallback(
    async (body: Round3AnswerBody) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSaving(true);
      setFailure(null);

      const result = await submitWithRetry('/api/round3/answer', body, {
        isCancelled: () => unmounted.current,
        onRetry: () => setReconnecting(true),
      });

      inFlight.current = false;
      if (unmounted.current) return;
      setSaving(false);
      setReconnecting(false);

      if (!result.ok) {
        setFailure(result);
        return;
      }

      const wait = Math.max(0, LOCK_MS - (Date.now() - lockedAt.current));
      setTimeout(() => {
        if (!unmounted.current) onComplete();
      }, wait);
    },
    [onComplete],
  );

  const submit = useCallback(() => {
    if (submitted.current) return;
    submitted.current = true;
    lockedAt.current = Date.now();
    setLocked(true);

    const body: Round3AnswerBody = { attemptId, guess, idempotencyKey: crypto.randomUUID() };
    submission.current = body;
    save(body);
  }, [attemptId, guess, save]);

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

        {reconnecting && (
          <p className="mb-3 text-center text-sm text-[var(--color-muted)]">
            Saving… reconnecting
          </p>
        )}

        {failure && (
          <div className="mb-4">
            <RetryNotice
              message={describeSaveFailure(failure, 'answer')}
              refCode={failure.ref}
              retryable={isRetryable(failure)}
              busy={saving}
              onRetry={() => {
                if (submission.current) save(submission.current);
              }}
            />
          </div>
        )}

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
