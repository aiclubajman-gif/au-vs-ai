'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { RetryNotice } from '@/components/ui';
import { submitWithRetry, isRetryable, describeSaveFailure, type SubmitFailure } from '@/lib/client/submit';
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
    [onComplete]
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
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-[var(--color-px-bg)] text-[var(--color-ink)]">
      {/* Background with circuit glow */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center opacity-30 pointer-events-none"
        style={{ backgroundImage: "url('/backgrounds/circuit-9x16.png')" }}
        aria-hidden="true"
      />
      <div className="arena-bg z-0 opacity-70" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-4 py-5 sm:px-6">
        {/* Header & Timer Bar */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <span className="px-chip text-[9px]">ROUND 3 · AI KNOWLEDGE</span>
            <span
              className="tabular font-px text-xl text-[var(--color-px-yellow)]"
              style={{ textShadow: '3px 3px 0 #070c26' }}
            >
              {seconds}s
            </span>
          </div>

          <div className="px-timer mt-2.5">
            <div
              className={`fill ${seconds <= 3 && !locked ? 'low' : ''}`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          <h1 className="mt-4 text-center text-xl leading-tight sm:text-2xl">
            <span className="px-title-cyan">AI</span>{' '}
            <span className="px-title-yellow">KNOWLEDGE</span>
          </h1>
        </div>

        {/* Question Panel & Giant Numeric Display */}
        <div className="my-auto flex flex-col justify-center w-full">
          <div className="px-panel px-5 py-4 text-center text-xs sm:text-sm font-semibold leading-relaxed text-slate-100 bg-[#0d1440]/90">
            {assignment.prompt}
          </div>

          <p
            className="tabular mt-8 text-center font-px text-5xl sm:text-6xl text-[var(--color-px-cyan)] tracking-wider"
            style={{
              textShadow: '4px 4px 0 #070c26, 0 0 28px rgba(53,224,255,.45)',
            }}
          >
            {guess}
            {assignment.unit ?? ''}
          </p>

          {/* Characters on top of slider matching Proposed mock/mround3.png */}
          <div className="mt-6 flex items-end justify-between px-3 select-none pointer-events-none">
            <img
              src="/sprites/boy-confused.png"
              alt="Puzzled student"
              className="pixelated h-16 w-auto drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
            />
            <img
              src="/sprites/robot-smirking.png"
              alt="Smug robot"
              className="pixelated h-16 w-auto drop-shadow-[0_0_12px_rgba(53,224,255,0.6)]"
            />
          </div>

          {/* Approved Custom Slider Component exactly as built in pixel-redesign */}
          <div className="relative mt-2 w-full">
            <input
              type="range"
              min={assignment.minValue}
              max={assignment.maxValue}
              step={assignment.step}
              value={guess}
              disabled={locked}
              onChange={(e) => setGuess(Number(e.target.value))}
              aria-label="Your guess"
              className="px-slider w-full"
              style={{
                backgroundImage: `repeating-linear-gradient(90deg,transparent 0 14px,rgba(7,12,38,.45) 14px 17px),linear-gradient(90deg,var(--color-px-cyan-deep) ${pct}%,var(--color-px-deep) ${pct}%)`,
              }}
            />
            <div className="mt-2 flex justify-between font-px text-[9px] text-slate-400 px-1">
              <span>{assignment.minValue}</span>
              <span>{assignment.maxValue}</span>
            </div>
          </div>
        </div>

        {/* Lock In Button */}
        <div className="w-full">
          {reconnecting && (
            <p className="mb-2 text-center font-px text-[8px] text-slate-300">
              Saving… reconnecting
            </p>
          )}
          {failure && (
            <div className="mb-3">
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
            className="px-btn px-btn-yellow min-h-[64px] w-full py-4 text-xs tracking-wider flex items-center justify-center gap-2"
          >
            <span>🔒</span>
            {locked ? 'ANSWER LOCKED' : 'LOCK IN'}
          </button>
          <p className="mt-2 text-center text-[10px] text-slate-400">
            Answers remain locked until results screen.
          </p>
        </div>
      </div>
    </main>
  );
}
