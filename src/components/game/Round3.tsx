'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { PxButton, PxChip, PxPanel, PxTimer, RetryNotice, Scene, Sprite, Wordmark } from '@/components/px';
import { submitWithRetry, isRetryable, describeSaveFailure, localSave, type SubmitFailure } from '@/lib/client/submit';
import type { Round3Assignment } from '@/types';

interface Round3AnswerBody {
  attemptId: string;
  guess: number;
  idempotencyKey: string;
}

const LOCK_MS = 1100;

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
  const submission = useRef<Round3AnswerBody | null>(null);
  const inFlight = useRef(false);
  const lockedAt = useRef(0);
  const unmounted = useRef(false);

  useEffect(() => {
    startedAt.current = Date.now();
    unmounted.current = false;
    return () => {
      unmounted.current = true;
    };
  }, []);

  const save = useCallback(
    async (body: Round3AnswerBody) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSaving(true);
      setFailure(null);

      const result = await (attemptId.startsWith('local-')
        ? localSave()
        : submitWithRetry('/api/round3/answer', body, {
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
        if (!unmounted.current) onComplete();
      }, wait);
    },
    [attemptId, onComplete]
  );

  const submit = useCallback(() => {
    if (submitted.current) return;
    submitted.current = true;
    lockedAt.current = Date.now();
    setLocked(true);

    const body: Round3AnswerBody = {
      attemptId,
      guess,
      idempotencyKey: crypto.randomUUID(),
    };
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
  const pct = span > 0 ? ((guess - assignment.minValue) / span) * 100 : 0;

  return (
    <Scene left="/art/flanks/r3-left.webp" right="/art/flanks/r3-right.webp" leftWidth="18vw" rightWidth="18vw">
      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-4 pb-5 pt-4 sm:px-6 lg:max-w-[680px]">
        <div className="flex lg:justify-center">
          <PxChip className="text-[9px]">ROUND 3</PxChip>
        </div>

        <div className="mt-2 flex items-end gap-4 lg:flex-col lg:items-center lg:gap-2">
          <Wordmark name="ai-knowledge" priority className="min-w-0 flex-1 lg:w-[62%] lg:flex-none" />
          <div className="flex w-[34%] shrink-0 flex-col items-center gap-1 lg:w-[80%]">
            <span className="px-num-gold tabular text-[16px] lg:text-[20px]" aria-live="off">
              {seconds}s
            </span>
            <PxTimer progress={progress} low={seconds <= 3 && !locked} className="w-full" />
          </div>
        </div>

        <PxPanel tone="cyan" className="mt-4 px-4 py-4 lg:mt-5">
          <p className="text-center font-px text-[11px] leading-loose text-[#f4f6ff] px-text-outline sm:text-[12px] lg:text-[14px]">
            {assignment.prompt.toUpperCase()}
          </p>
        </PxPanel>

        <div className="my-auto flex flex-col items-center py-4">
          <output htmlFor="guess" className="px-num-cyan tabular text-[72px] sm:text-[88px] lg:text-[104px]" aria-live="polite">
            {guess}
            {assignment.unit}
          </output>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute inset-x-0 -top-[84px] flex items-end justify-between px-1 lg:hidden">
            <Sprite src="/sprites/boy-confused.png" className="px-bob h-[84px] w-auto" />
            <Sprite src="/sprites/robot-smirking.png" className="px-bob px-bob--delay h-[84px] w-auto drop-shadow-[0_0_12px_rgba(0,187,252,0.5)]" />
          </div>

          <div className="hidden justify-between px-1 font-px text-[12px] text-[#dff6ff] px-text-outline lg:flex">
            <span>{assignment.minValue}</span>
            <span>{assignment.maxValue}</span>
          </div>
          <div className="px-slider-wrap lg:mt-1">
            <div className="px-slider-track">
              <div className="px-slider-fill" style={{ width: `calc(${pct}% - 3px)` }} />
            </div>
            <input
              id="guess"
              className="px-slider"
              type="range"
              min={assignment.minValue}
              max={assignment.maxValue}
              step={assignment.step}
              value={guess}
              disabled={locked}
              onChange={(e) => setGuess(Number(e.target.value))}
              aria-label={assignment.prompt}
              aria-valuetext={`${guess}${assignment.unit}`}
            />
          </div>
          <div className="mt-2 flex justify-between px-1 font-px text-[12px] text-[#dff6ff] px-text-outline lg:hidden">
            <span>{assignment.minValue}</span>
            <span>{assignment.maxValue}</span>
          </div>
        </div>

        <div className="mt-6 lg:mt-5">
          <PxButton
            onClick={submit}
            disabled={locked}
            whiteText
            className="min-h-[84px] w-full text-[26px] sm:text-[28px] lg:min-h-[76px]"
          >
            {locked ? 'LOCKED' : 'LOCK IN'}
          </PxButton>
          {locked && reconnecting && <p className="mt-2 text-center font-px text-[8px] text-[#c7d6ff]">SAVING… RECONNECTING</p>}
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
      </div>
    </Scene>
  );
}
