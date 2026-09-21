'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { PxButton, PxChip, PxTimer, RetryNotice, Scene, Sprite, Wordmark } from '@/components/px';
import { submitWithRetry, isRetryable, describeSaveFailure, localSave, type SubmitFailure } from '@/lib/client/submit';
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

      const result = await (attemptId.startsWith('local-')
        ? localSave()
        : submitWithRetry('/api/round1/answer', body, {
            isCancelled: () => unmounted.current,
            onRetry: () => setReconnecting(true),
          }));

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
    [attemptId, advance]
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
  const active = imageState === 'ready' && !locked;

  return (
    <Scene left="/sprites/round1-left-flank.png" right="/art/flanks/r1-right.webp" leftWidth="26vw" rightWidth="20vw">
      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-4 pb-5 pt-4 sm:px-6 lg:max-w-[640px]">
        <div className="flex justify-center lg:hidden">
          <PxChip className="text-[9px]">ROUND 1</PxChip>
        </div>

        <div className="mt-3 flex items-center gap-3 lg:mt-0 lg:flex-col lg:gap-1">
          <Wordmark name="real-or-ai" priority className="min-w-0 flex-1 lg:w-[70%] lg:flex-none" />
          <span className="px-num-gold tabular shrink-0 text-[30px] sm:text-[34px] lg:hidden" aria-live="off">
            {seconds}s
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between lg:mt-3 lg:px-2">
          <p className="font-px text-[10px] text-[#dff6ff] px-text-outline sm:text-[11px]">
            IMAGE {index + 1} OF {pending.length}
          </p>
          <span className="px-num-gold tabular hidden text-[28px] lg:block" aria-live="off">
            {seconds}s
          </span>
        </div>

        <PxTimer progress={progress} low={seconds <= 3 && active} className="mt-2" />

        <div className="relative my-auto py-6 lg:py-4">
          <div className={`px-frame mx-auto w-full max-w-[420px] lg:max-w-[440px] ${active ? 'px-glow-pulse' : ''}`}>
            <div className="relative aspect-square w-full overflow-hidden bg-[#010f38]">
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
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#010f38]/80 px-6 text-center">
                  <div className="px-spinner" />
                  <p className="mt-4 text-[15px] leading-snug text-[#dff6ff]">Loading image… your time hasn&apos;t started.</p>
                  {slowLoad && (
                    <PxButton variant="gray" onClick={retryImage} className="mt-4 min-h-[44px] px-4 text-[9px]">
                      TRY LOADING AGAIN
                    </PxButton>
                  )}
                </div>
              )}

              {imageState === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#010f38]/90 px-6 text-center">
                  <p className="font-px text-[11px] text-[#ff8a96]">THIS IMAGE DIDN&apos;T LOAD.</p>
                  <p className="mt-3 text-[15px] text-[#dff6ff]">Your time hasn&apos;t started.</p>
                  <PxButton variant="gray" onClick={retryImage} className="mt-4 min-h-[44px] px-4 text-[9px]">
                    TRY AGAIN
                  </PxButton>
                </div>
              )}

              {locked && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#010f38]/85">
                  <p className="px-pop font-px text-[16px] uppercase text-[#7ffafe] px-text-outline">Answer locked</p>
                  {reconnecting && <p className="mt-3 font-px text-[8px] text-[#c7d6ff]">SAVING… RECONNECTING</p>}
                </div>
              )}
            </div>
          </div>

          <Sprite
            src="/sprites/boy.png"
            className="px-bob absolute bottom-2 left-0 h-[88px] w-auto drop-shadow-[0_4px_0_rgba(0,0,0,0.5)] sm:h-[100px] lg:hidden"
          />
          <Sprite
            src="/sprites/robot-1.png"
            className="px-bob px-bob--delay absolute bottom-2 right-0 h-[84px] w-auto drop-shadow-[0_0_14px_rgba(0,187,252,0.6)] sm:h-[96px] lg:hidden"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <PxButton
            onClick={() => answer('real')}
            disabled={!active}
            className="min-h-[96px] text-[20px] sm:min-h-[104px] sm:text-[22px] lg:min-h-[76px]"
            labelClassName="text-[#1b1a5c]"
          >
            REAL
          </PxButton>
          <PxButton
            variant="cyan"
            onClick={() => answer('ai_generated')}
            disabled={!active}
            className="min-h-[96px] text-[14px] sm:min-h-[104px] sm:text-[16px] lg:min-h-[76px]"
            labelClassName="flex-col gap-1 leading-relaxed text-[#032846]"
          >
            <span>AI</span>
            <span>GENERATED</span>
          </PxButton>
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
      </div>
    </Scene>
  );
}
