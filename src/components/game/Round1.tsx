'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { RetryNotice } from '@/components/ui';
import { submitWithRetry, isRetryable, describeSaveFailure, type SubmitFailure } from '@/lib/client/submit';
import { answerTimeRemaining } from '@/lib/client/answer-window';
import type { Round1Slot } from '@/types';

type ImageState = 'loading' | 'ready' | 'error';

interface Round1AnswerBody {
  attemptId: string;
  slot: number;
  selectedAnswer: 'real' | 'ai_generated' | null;
  responseTimeMs: number;
  idempotencyKey: string;
}

const LOCK_MS = 700;
const SLOW_LOAD_MS = 10000;
const MAX_RESPONSE_MS = 120000;

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

  const readyAt = useRef<number | null>(null);
  const answered = useRef(false);
  const inFlight = useRef(false);
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

      const wait = Math.max(0, LOCK_MS - (Date.now() - lockedAt.current));
      setTimeout(() => {
        if (!unmounted.current) advance();
      }, wait);
    },
    [advance]
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
        selectedAnswer: choice,
        responseTimeMs: Math.min(Date.now() - readyAt.current, MAX_RESPONSE_MS),
        idempotencyKey: crypto.randomUUID(),
      };
      submission.current = body;
      save(body);
    },
    [attemptId, current, save]
  );

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
    const decoded = typeof img.decode === 'function' ? img.decode().catch(() => undefined) : Promise.resolve();
    decoded.then(() => {
      requestAnimationFrame(() => {
        if (unmounted.current || !img.isConnected || readyAt.current !== null) return;
        readyAt.current = Date.now();
        setRemaining(msPerImage);
        setImageState('ready');

        // Preload next image
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
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-[var(--color-px-bg)] text-[var(--color-ink)]">
      {/* Background with circuit glow */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center opacity-30 pointer-events-none"
        style={{ backgroundImage: "url('/backgrounds/circuit-9x16.png')" }}
        aria-hidden="true"
      />
      <div className="arena-bg z-0 opacity-70" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-4 py-5 sm:px-6">
        {/* Top Header & Timer Bar */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <span className="px-chip text-[9px]">ROUND 1</span>
            <span
              className="tabular font-px text-xl text-[var(--color-px-yellow)]"
              style={{ textShadow: '3px 3px 0 #070c26' }}
            >
              {seconds}s
            </span>
          </div>

          <div
            className="px-timer mt-2.5"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div
              className={`fill ${seconds <= 3 && !locked ? 'low' : ''}`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          <div className="mt-4 text-center">
            <h1 className="px-title-yellow text-2xl leading-tight sm:text-3xl">
              REAL OR AI?
            </h1>
            <p className="mt-1 font-px text-[9px] tracking-wider text-slate-300">
              IMAGE {index + 1} OF {pending.length}
            </p>
          </div>
        </div>

        {/* Center Frame with Image and Bottom Characters */}
        <div className="my-auto w-full">
          <div className="px-frame mx-auto w-full">
            <div className="relative aspect-square w-full overflow-hidden bg-black">
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
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 px-6 text-center">
                  <div className="px-spinner" />
                  <p className="mt-4 text-xs leading-relaxed text-slate-300 font-medium">
                    Loading image… your time hasn&apos;t started.
                  </p>
                  {slowLoad && (
                    <button
                      onClick={retryImage}
                      className="px-btn px-btn-gray mt-4 px-4 py-2 text-[9px]"
                    >
                      Try loading again
                    </button>
                  )}
                </div>
              )}

              {imageState === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 px-6 text-center">
                  <p className="font-px text-[11px] text-[var(--color-px-red)]">
                    This image didn&apos;t load.
                  </p>
                  <p className="mt-3 text-xs leading-relaxed text-slate-300">
                    Your time hasn&apos;t started.
                  </p>
                  <button
                    onClick={retryImage}
                    className="px-btn px-btn-gray mt-4 px-4 py-2 text-[9px]"
                  >
                    Try again
                  </button>
                </div>
              )}

              {locked && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070c26]/85">
                  <p
                    className="font-px text-base uppercase tracking-wider text-[var(--color-px-cyan)]"
                    style={{ textShadow: '2px 2px 0 #070c26' }}
                  >
                    Answer locked
                  </p>
                  {reconnecting && (
                    <p className="mt-3 font-px text-[8px] text-slate-300">
                      Saving… reconnecting
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Flanking characters under frame matching Proposed mock/mround1.png */}
          <div className="mt-2 flex items-end justify-between px-2 pointer-events-none select-none">
            <img
              src="/sprites/boy.png"
              alt="Human"
              className="pixelated h-14 sm:h-16 w-auto drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
            />
            <img
              src="/sprites/robot-1.png"
              alt="Robot"
              className="pixelated h-14 sm:h-16 w-auto drop-shadow-[0_0_12px_rgba(53,224,255,0.6)]"
            />
          </div>
        </div>

        {/* Action Buttons: REAL vs AI GENERATED */}
        <div className="w-full">
          <div className="grid grid-cols-2 gap-3.5">
            <button
              onClick={() => answer('real')}
              disabled={locked || imageState !== 'ready'}
              className="px-btn px-btn-yellow min-h-[64px] sm:min-h-[72px] py-3 text-sm tracking-wider flex items-center justify-center gap-2"
            >
              <span className="text-base">●</span>
              REAL
            </button>
            <button
              onClick={() => answer('ai_generated')}
              disabled={locked || imageState !== 'ready'}
              className="px-btn px-btn-cyan min-h-[64px] sm:min-h-[72px] py-3 text-[11px] sm:text-xs leading-tight flex items-center justify-center gap-1.5"
            >
              <span className="text-base">✦</span>
              <span>AI<br/>GENERATED</span>
            </button>
          </div>

          {failure && (
            <div className="mt-3">
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

          <p className="mt-3 text-center text-[10px] text-slate-400">
            Answers remain locked until results screen.
          </p>
        </div>
      </div>
    </main>
  );
}
