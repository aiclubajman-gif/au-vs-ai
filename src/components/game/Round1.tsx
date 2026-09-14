'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { RetryNotice } from '@/components/ui';
import {
  submitWithRetry,
  isRetryable,
  describeSaveFailure,
  type SubmitFailure,
} from '@/lib/client/submit';
import { answerTimeRemaining } from '@/lib/client/answer-window';
import type { Round1Slot } from '@/types';

/**
 * Round 1 — Real or AI?
 *
 * Four images, one at a time. §11 forbids telling the student whether they
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

  return (
    <main className="flex min-h-dvh flex-col px-5 py-6">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-muted)]">
            Image {index + 1} of {pending.length}
          </span>
          <span className="tabular font-bold text-[var(--color-cyan)]">{seconds}s</span>
        </div>

        <div
          className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--color-edge)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div
            className="h-full bg-[var(--color-cyan)] transition-[width] duration-100 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <h1 className="mt-6 text-center text-2xl font-bold">Real or AI?</h1>

        <div className="relative mt-5 aspect-square w-full overflow-hidden rounded-2xl border border-[var(--color-edge)] bg-[var(--color-navy)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={`${current.slot}-${loadTry}`}
            src={current.storagePath}
            alt="Is this photograph real or generated by AI?"
            className={`h-full w-full object-cover ${imageState === 'ready' ? '' : 'invisible'}`}
            draggable={false}
            onLoad={(e) => handleImageLoad(e.currentTarget)}
            onError={(e) => handleImageError(e.currentTarget)}
          />

          {imageState === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--color-edge)] border-t-[var(--color-cyan)]" />
              <p className="mt-4 text-sm text-[var(--color-muted)]">
                Loading image… your time hasn&apos;t started.
              </p>
              {slowLoad && (
                <button
                  onClick={retryImage}
                  className="mt-4 rounded-lg border border-[var(--color-edge)] px-4 py-2 text-sm"
                >
                  Try loading again
                </button>
              )}
            </div>
          )}

          {imageState === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              <p className="text-base font-semibold">This image didn&apos;t load.</p>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Your time hasn&apos;t started.
                {loadTry >= 2 && ' If it keeps failing, show this screen to an AIDA team member.'}
              </p>
              <button
                onClick={retryImage}
                className="mt-4 rounded-lg border border-[var(--color-edge)] px-4 py-2 text-sm"
              >
                Try again
              </button>
            </div>
          )}

          {locked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-void)]/85">
              <p className="text-xl font-bold tracking-wide text-[var(--color-cyan)]">
                Answer locked
              </p>
              {reconnecting && (
                <p className="mt-2 text-sm text-[var(--color-muted)]">Saving… reconnecting</p>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={() => answer('real')}
            disabled={locked || imageState !== 'ready'}
            className="min-h-[64px] rounded-xl border border-[var(--color-edge)] bg-[var(--color-surface)] text-base font-semibold transition-colors hover:border-[var(--color-cyan)] disabled:opacity-40"
          >
            Real
          </button>
          <button
            onClick={() => answer('ai_generated')}
            disabled={locked || imageState !== 'ready'}
            className="min-h-[64px] rounded-xl border border-[var(--color-edge)] bg-[var(--color-surface)] text-base font-semibold transition-colors hover:border-[var(--color-cyan)] disabled:opacity-40"
          >
            AI generated
          </button>
        </div>

        {failure && (
          <RetryNotice
            message={describeSaveFailure(failure, 'answer')}
            refCode={failure.ref}
            retryable={isRetryable(failure)}
            busy={saving}
            onRetry={() => {
              if (submission.current) save(submission.current);
            }}
          />
        )}

        <p className="mt-4 text-center text-xs text-[var(--color-muted)]">
          Your total score comes at the end.
        </p>
      </div>
    </main>
  );
}
