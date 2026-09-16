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
import { answerTimeRemaining } from '@/lib/client/answer-window';
import type { Round1Slot } from '@/types';
import styles from './Round1.module.css';

/**
 * Round 1 — Spot the Fake (real or AI?)
 *
 * The assigned images, one at a time. §11 forbids telling the student whether they
 * were right, so the only feedback is a neutral "Answer locked". That is a
 * deliberate product choice: without it, the first group through the booth
 * would leak the answer key to everyone behind them.
 *
 * Each image's timer starts only once that image is decoded and visible, so a
 * slow download on venue wifi never eats into the answering time. The round
 * only moves on once the server has acknowledged the answer.
 */

type ImageState = 'loading' | 'ready' | 'error';

interface Round1AnswerBody {
  attemptId: string;
  slot: number;
  selectedAnswer: 'real' | 'ai_generated' | null;
  responseTimeMs: number;
  idempotencyKey: string;
}

/** Shortest time the neutral "Answer locked" overlay is shown. */
const LOCK_MS = 700;
/** After this long without the image, offer a manual retry. */
const SLOW_LOAD_MS = 10_000;
/** Ceiling in round1SubmitSchema. A backgrounded tab can otherwise exceed it. */
const MAX_RESPONSE_MS = 120_000;

export function Round1({
  attemptId,
  slots,
  msPerImage,
  onComplete,
}: {
  attemptId: string;
  slots: Round1Slot[];
  msPerImage: number;
  onComplete: () => void;
}) {
  const pending = slots.filter((s) => !s.answered);
  const [index, setIndex] = useState(0);
  const [imageState, setImageState] = useState<ImageState>('loading');
  const [loadTry, setLoadTry] = useState(0);
  const [slowLoad, setSlowLoad] = useState(false);
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [failure, setFailure] = useState<SubmitFailure | null>(null);
  const [remaining, setRemaining] = useState(msPerImage);

  /** When the current image became visible. null while it is loading. */
  const readyAt = useRef<number | null>(null);
  /** Synchronous guard: a double tap in the same frame cannot answer twice. */
  const answered = useRef(false);
  /** One save request chain at a time, including manual retries. */
  const inFlight = useRef(false);
  /** The answer being saved. Retries resend exactly this, same key included. */
  const submission = useRef<Round1AnswerBody | null>(null);
  const lockedAt = useRef(0);
  const unmounted = useRef(false);

  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
    };
  }, []);

  const current = pending[index];

  const advance = useCallback(() => {
    if (index + 1 >= pending.length) {
      onComplete();
      return;
    }
    readyAt.current = null;
    answered.current = false;
    submission.current = null;
    setIndex((i) => i + 1);
    setImageState('loading');
    setLoadTry(0);
    setSlowLoad(false);
    setLocked(false);
    setFailure(null);
    setRemaining(msPerImage);
  }, [index, pending.length, msPerImage, onComplete]);

  const save = useCallback(
    async (body: Round1AnswerBody) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSaving(true);
      setFailure(null);

      const result = await submitWithRetry('/api/round1/answer', body, {
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

      // The response says nothing about correctness, and nothing is shown.
      const wait = Math.max(0, LOCK_MS - (Date.now() - lockedAt.current));
      setTimeout(() => {
        if (!unmounted.current) advance();
      }, wait);
    },
    [advance],
  );

  const answer = useCallback(
    (choice: 'real' | 'ai_generated' | null) => {
      if (!current || answered.current || readyAt.current === null) return;
      answered.current = true;
      lockedAt.current = Date.now();
      setLocked(true);

      const body: Round1AnswerBody = {
        attemptId,
        slot: current.slot,
        // A timeout is sent as null: no selection, so it can never score as
        // either answer.
        selectedAnswer: choice,
        responseTimeMs: Math.min(Date.now() - readyAt.current, MAX_RESPONSE_MS),
        idempotencyKey: crypto.randomUUID(),
      };
      submission.current = body;
      save(body);
    },
    [attemptId, current, save],
  );

  // Countdown. Runs only while the image is visible and unanswered, and
  // auto-submits a timeout so a distracted student cannot stall the queue.
  useEffect(() => {
    if (locked || imageState !== 'ready') return;
    const tick = setInterval(() => {
      const left = answerTimeRemaining(readyAt.current, Date.now(), msPerImage);
      setRemaining(left);
      if (left <= 0) answer(null);
    }, 100);
    return () => clearInterval(tick);
  }, [locked, imageState, msPerImage, answer]);

  useEffect(() => {
    if (imageState !== 'loading') return;
    const t = setTimeout(() => setSlowLoad(true), SLOW_LOAD_MS);
    return () => clearTimeout(t);
  }, [imageState, index, loadTry]);

  function handleImageLoad(img: HTMLImageElement) {
    const decoded =
      typeof img.decode === 'function' ? img.decode().catch(() => undefined) : Promise.resolve();

    decoded.then(() => {
      requestAnimationFrame(() => {
        // A retried or already-replaced image element is detached; ignore it.
        if (unmounted.current || !img.isConnected || readyAt.current !== null) return;
        readyAt.current = Date.now();
        setRemaining(msPerImage);
        setImageState('ready');

        // Warm only the NEXT image, never the whole round.
        const next = pending[index + 1];
        if (next) {
          const preload = new Image();
          preload.decoding = 'async';
          preload.src = next.storagePath;
        }
      });
    });
  }

  function handleImageError(img: HTMLImageElement) {
    if (!img.isConnected) return;
    setImageState('error');
  }

  function retryImage() {
    setSlowLoad(false);
    setImageState('loading');
    setLoadTry((n) => n + 1);
  }

  if (!current) return null;

  const progress = Math.max(0, Math.min(1, remaining / msPerImage));
  const seconds = Math.max(0, Math.ceil(remaining / 1000));
  // Counted across the whole assignment, so a resumed round still reads
  // "Image 3 of 4" rather than restarting at 1.
  const total = slots.length;
  const position = total - pending.length + index + 1;

  return (
    <PlateScreen plateSrc={ROUND1_PLATE_SRC} plateWidth={941} plateHeight={1672} className={styles.page}>
      {/* The AU vs AI wordmark, the frames and the button bodies are painted. */}
      <p className={styles.round}>
        <span aria-hidden="true">Round 1 / 3</span>
        <span className="sr-only">Round 1 of 3</span>
      </p>

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

      <h1 className={styles.title}>Spot the fake</h1>
      <p className={styles.count}>
        Image {position} of {total}
      </p>

      <div className={styles.frame}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={`${current.slot}-${loadTry}`}
          src={current.storagePath}
          alt="Is this photograph real or generated by AI?"
          className={`${styles.image} ${imageState === 'ready' ? '' : 'invisible'}`}
          draggable={false}
          onLoad={(e) => handleImageLoad(e.currentTarget)}
          onError={(e) => handleImageError(e.currentTarget)}
        />

        {imageState === 'loading' && (
          <div className={styles.overlay}>
            <span className={styles.spinner} aria-hidden="true" />
            <p className={styles.overlayText}>Loading image… your time hasn&apos;t started.</p>
            {slowLoad && (
              <button type="button" onClick={retryImage} className={styles.overlayButton}>
                Try loading again
              </button>
            )}
          </div>
        )}

        {imageState === 'error' && (
          <div className={styles.overlay}>
            <p className={styles.overlayTitle}>This image didn&apos;t load.</p>
            <p className={styles.overlayText}>
              Your time hasn&apos;t started.
              {loadTry >= 2 && ' If it keeps failing, show this screen to an AIDA team member.'}
            </p>
            <button type="button" onClick={retryImage} className={styles.overlayButton}>
              Try again
            </button>
          </div>
        )}

        {locked && (
          <div className={`${styles.overlay} ${styles.locked}`} role="status">
            <p className={styles.lockedText}>Answer locked</p>
            {reconnecting && <p className={styles.overlayText}>Saving… reconnecting</p>}
          </div>
        )}

        {failure && (
          <div className={styles.retry}>
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
      </div>

      {/* The plate paints both buttons; these are the real, transparent controls over them. */}
      <button
        type="button"
        onClick={() => answer('real')}
        disabled={locked || imageState !== 'ready'}
        className={styles.choice}
        data-choice="real"
      >
        <RealIcon className={styles.choiceIcon} />
        <span className={styles.choiceLabel}>Real</span>
      </button>
      <button
        type="button"
        onClick={() => answer('ai_generated')}
        disabled={locked || imageState !== 'ready'}
        className={styles.choice}
        data-choice="ai"
      >
        <SparkleIcon className={styles.choiceIcon} />
        <span className={styles.choiceLabel}>AI generated</span>
      </button>
    </PlateScreen>
  );
}

const ROUND1_PLATE_SRC = '/design/round1/plate.webp';

/** Radius of the ring band painted on the plate, in the timer's 200-unit box. */
const RING_R = 72.5;
const RING_C = 2 * Math.PI * RING_R;

function RealIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id="round1-real-dot" cx="42%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#9fd8ff" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="42" fill="none" stroke="#26c6ff" strokeWidth="6" />
      <circle cx="50" cy="50" r="20" fill="url(#round1-real-dot)" />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  // Four-point stars: centre (x, y), radius r.
  const star = (x: number, y: number, r: number) => {
    const k = r * 0.2;
    return (
      `M${x} ${y - r}Q${x + k} ${y - k} ${x + r} ${y}Q${x + k} ${y + k} ${x} ${y + r}` +
      `Q${x - k} ${y + k} ${x - r} ${y}Q${x - k} ${y - k} ${x} ${y - r}Z`
    );
  };
  return (
    <svg className={className} viewBox="0 0 110 110" aria-hidden="true">
      <path d={`${star(38, 36, 30)}${star(88, 50, 17)}${star(60, 84, 24)}`} fill="#ffd7a1" />
    </svg>
  );
}
