'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { RetryNotice } from '@/components/ui';
import { PlateScreen } from '@/components/ui/PlateScreen';
import {
  submitWithRetry,
  isRetryable,
  describeSaveFailure,
  type SubmitFailure,
} from '@/lib/client/submit';
import type { Round3Assignment } from '@/types';
import styles from './Round3.module.css';

interface Round3AnswerBody {
  attemptId: string;
  guess: number;
  idempotencyKey: string;
}

/** Shortest time "Answer locked" is shown before scoring begins. */
const LOCK_MS = 1100;

export const ROUND3_PLATE_SRC = '/design/round3/plate.webp';

/**
 * Round 3 — You vs AIDA.
 *
 * §18: every student answers the SAME question, so §21 forbids any feedback at
 * all. No correct answer, no error, no points, not even "close". One leaked
 * hint would travel down the queue in minutes.
 *
 * A slider rather than a keyboard: one thumb gesture, no keyboard covering the
 * screen, no typos, and no way to enter something absurd under time pressure.
 *
 * The plate paints the background, wordmark, round pill, ring shell, the outer
 * panel and the Lock button; the panel is painted EMPTY, so the question card,
 * value box and slider are drawn in the stylesheet. Everything carrying live
 * data — the countdown, the question, the value, the bounds — is HTML.
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
  /**
   * Decimals come from the question's own step, so a 0.01-step question reads
   * "3.14" and a whole-number one reads "20". The displayed value is always
   * formatted from the slider's value, never from a separate copy.
   */
  const decimals = decimalsOf(assignment.step);
  const mid = snap(
    (assignment.minValue + assignment.maxValue) / 2,
    assignment.minValue,
    assignment.step,
    decimals,
  );

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

  // The clock starts when the question is first on screen. This component is
  // only mounted once the assignment is in hand, so there is no window where
  // the timer runs before the student can answer.
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
  const span = assignment.maxValue - assignment.minValue;
  const fill = span > 0 ? (guess - assignment.minValue) / span : 0;

  return (
    <PlateScreen plateSrc={ROUND3_PLATE_SRC} plateWidth={941} plateHeight={1672} className={styles.page}>
      {/* Round 3 is always the last round, so the plate paints "Round 3 / 3"
          into the tab itself. Only the spoken version is needed here. */}
      <p className="sr-only">Round 3 of 3</p>

      <div className={styles.timer} role="timer" aria-label={`${seconds} seconds left`}>
        {/* Redraws the plate's ring band with the real time left. */}
        <svg viewBox="0 0 200 200" className={styles.ring} aria-hidden="true">
          <circle cx="100" cy="100" r={RING_R} className={styles.track} />
          <circle
            cx="100"
            cy="100"
            r={RING_R}
            className={styles.arc}
            data-empty={progress <= 0 || undefined}
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - progress)}
            transform="rotate(-90 100 100)"
          />
        </svg>
        <span className={`${styles.seconds} tabular`} aria-hidden="true">
          {seconds}
          <span className={styles.unit}>s</span>
        </span>
      </div>

      <h1 className={styles.heading}>
        <span className={styles.you}>You</span>
        <span className={styles.vsWord}>vs</span>
        <span className={styles.aida}>AIDA</span>
      </h1>

      {/* The painted panel is empty; this is the inner question frame. */}
      <div className={styles.card} aria-hidden="true" />

      <p className={styles.question}>{assignment.prompt}</p>

      <div className={styles.valueBox} aria-hidden="true">
        <span className={`${styles.value} tabular`}>{guess.toFixed(decimals)}</span>
      </div>

      {assignment.unit && (
        <p className={styles.unitLabel} aria-hidden="true">
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
        aria-label={
          assignment.unit ? `Your guess, in ${assignment.unit}` : 'Your guess'
        }
        aria-valuetext={
          assignment.unit
            ? `${guess.toFixed(decimals)} ${assignment.unit}`
            : guess.toFixed(decimals)
        }
        className={styles.slider}
        style={{ '--fill': fill } as React.CSSProperties}
      />

      <p className={styles.bounds} aria-hidden="true">
        <span className="tabular">{assignment.minValue}</span>
        <span className="tabular">{assignment.maxValue}</span>
      </p>

      {failure && (
        <div className={styles.notice}>
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

      {/* The plate paints the button; this is the real, transparent control. */}
      <button type="button" onClick={submit} disabled={locked} className={styles.lock}>
        <LockIcon className={styles.lockIcon} />
        <span>{locked ? 'Answer locked' : 'Lock my answer'}</span>
      </button>

      {reconnecting && (
        <p className={styles.status} role="status">
          Saving… reconnecting
        </p>
      )}
    </PlateScreen>
  );
}

/** Radius of the ring band painted on the plate, in the timer's 200-unit box. */
const RING_R = 72.5;
const RING_C = 2 * Math.PI * RING_R;

/** How many decimals a step implies: 1 → 0, 0.01 → 2. */
function decimalsOf(step: number): number {
  const s = String(step);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}

/**
 * The nearest value on the question's own step grid, so the opening value is
 * one the slider can actually hold. For the whole-number questions in use this
 * is the plain midpoint it has always been.
 */
function snap(value: number, min: number, step: number, decimals: number): number {
  if (!(step > 0)) return value;
  return Number((min + Math.round((value - min) / step) * step).toFixed(decimals));
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 44 50" fill="none" aria-hidden="true">
      <rect
        x="4"
        y="20"
        width="36"
        height="26"
        rx="5"
        stroke="currentColor"
        strokeWidth="3.4"
      />
      <path
        d="M13 20v-6a9 9 0 0 1 18 0v6"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <circle cx="22" cy="33" r="3.6" fill="currentColor" />
    </svg>
  );
}
