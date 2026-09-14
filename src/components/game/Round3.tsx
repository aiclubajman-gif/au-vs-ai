'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Round3Assignment } from '@/types';
import { ArenaFrame } from './ArenaFrame';

/**
 * Round 3 — You vs AIDA.
 *
 * 16-Bit Retro Arcade Redesign:
 * - ArenaFrame stadium frame with meadow & circuit flanks.
 * - Puzzled Boy sprite (`/sprites/char-boy-puzzled.png`) on human side (0%).
 * - Thinking Robot sprite (`/sprites/robot-thinking.png`) on AI side (100%).
 * - Giant glowing numerical display in retro pixel font.
 * - Tactile 3D retro arcade "LOCK ANSWER" button.
 * - Auto-locks on timer expiry.
 * - §21: No correctness reveals during gameplay.
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
    <ArenaFrame
      leftMascot="/sprites/char-boy-puzzled.png"
      leftMascotAlt="Puzzled Boy Avatar"
      rightMascot="/sprites/robot-thinking.png"
      rightMascotAlt="Thinking Robot AI"
    >
      {/* Top Header & Telemetry */}
      <div>
        {/* Status Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Mobile Mascot Avatar */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sprites/char-boy-puzzled.png"
              alt="Avatar"
              className="pixelated h-8 w-auto lg:hidden"
            />
            <span className="font-pixel text-[10px] tracking-wider text-slate-400">
              ROUND 3 · GUESS
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="pixel-timer tabular text-xs font-bold">
              {seconds.toString().padStart(2, '0')}s
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sprites/robot-thinking.png"
              alt="Robot"
              className="pixelated h-8 w-auto lg:hidden"
            />
          </div>
        </div>

        {/* Progress Bar */}
        <div
          className="mt-2.5 h-2 w-full overflow-hidden rounded-full border border-slate-700/60 bg-slate-900/80 p-0.5"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 via-sky-400 to-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.7)] transition-[width] duration-100 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {/* Title Banner */}
        <div className="mt-4 text-center">
          <span className="inline-block rounded-md border border-cyan-500/40 bg-cyan-950/40 px-3 py-1 font-silkscreen text-[10px] uppercase tracking-widest text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.2)]">
            FINAL ROUND · YOU VS AIDA
          </span>
          <h1 className="mt-2 font-pixel text-base sm:text-lg font-bold uppercase tracking-wider text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
            Knowledge Estimator
          </h1>
        </div>

        {/* Question & Guess Card */}
        <div className="pixel-box relative mt-3.5 flex flex-col items-center justify-center p-6 text-center sm:mt-4">
          <p className="font-silkscreen text-xs sm:text-sm font-bold leading-relaxed text-slate-100">
            {assignment.prompt}
          </p>

          {/* Giant Glowing Digital Readout */}
          <div className="my-6 flex flex-col items-center justify-center">
            <div className="tabular font-pixel text-5xl font-black tracking-tight text-cyan-400 drop-shadow-[0_0_24px_rgba(0,240,255,0.8)] sm:text-6xl">
              {guess}
              {assignment.unit && (
                <span className="ml-1 text-2xl sm:text-3xl text-cyan-200">
                  {assignment.unit}
                </span>
              )}
            </div>
            <span className="mt-2 font-pixel text-[9px] uppercase tracking-widest text-slate-400">
              YOUR ESTIMATE
            </span>
          </div>

          {/* Slider with Mascot Flanks */}
          <div className="w-full">
            <div className="flex items-center justify-between px-1 mb-2">
              {/* Left Puzzled Boy Icon */}
              <div className="flex items-center gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/sprites/char-boy-puzzled.png"
                  alt="Low guess"
                  className="pixelated h-6 w-auto"
                />
                <span className="font-pixel text-[10px] text-slate-400">
                  {assignment.minValue}
                  {assignment.unit ?? ''}
                </span>
              </div>

              {/* Right Thinking Robot Icon */}
              <div className="flex items-center gap-1">
                <span className="font-pixel text-[10px] text-slate-400">
                  {assignment.maxValue}
                  {assignment.unit ?? ''}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/sprites/robot-thinking.png"
                  alt="High guess"
                  className="pixelated h-6 w-auto"
                />
              </div>
            </div>

            <input
              type="range"
              min={assignment.minValue}
              max={assignment.maxValue}
              step={assignment.step}
              value={guess}
              disabled={locked}
              onChange={(e) => setGuess(Number(e.target.value))}
              aria-label="Your guess"
              className="h-3 w-full cursor-pointer appearance-none rounded-lg bg-slate-900 border border-slate-700 accent-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.4)]"
            />
          </div>
        </div>
      </div>

      {/* Action Button (Tactile 3D Retro Arcade) */}
      <div className="mt-4 sm:mt-6">
        <button
          onClick={submit}
          disabled={locked}
          className="pixel-btn pixel-btn-cyan min-h-[64px] w-full"
        >
          {locked ? (
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-200 animate-ping" />
              ANSWER LOCKED
            </span>
          ) : (
            'LOCK ANSWER'
          )}
        </button>

        <p className="mt-3.5 text-center font-display text-xs text-slate-400">
          Closer estimates score higher points · No hints until final results
        </p>
      </div>
    </ArenaFrame>
  );
}
