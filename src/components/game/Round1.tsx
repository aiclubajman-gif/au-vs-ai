'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Round1Slot } from '@/types';
import { ArenaFrame } from './ArenaFrame';

/**
 * Round 1 — Real or AI?
 *
 * 16-Bit Retro Arcade Redesign:
 * - High-voltage arena frame with retro digital timer and progress bar.
 * - Pixelated character mascots: Boy Redcap (Human Team) & Monitor Robot (AI Team).
 * - Tactile 3D retro arcade buttons for "REAL" (Amber/Gold) and "AI GENERATED" (Cyber Cyan).
 * - Neutral "ANSWER LOCKED" modal overlay (§11 - no live correct/wrong reveals).
 * - Auto-submits when countdown timer runs out.
 */
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
  const [locked, setLocked] = useState(false);
  const [remaining, setRemaining] = useState(msPerImage);
  const startedAt = useRef(Date.now());
  const submitting = useRef(false);

  const current = pending[index];

  const submit = useCallback(
    async (answer: 'real' | 'ai_generated' | null) => {
      if (submitting.current || !current) return;
      submitting.current = true;
      setLocked(true);

      const responseTimeMs = Date.now() - startedAt.current;

      // A timeout still posts, as a wrong answer, so the slot is never left
      // unanswered and the total always adds up.
      await fetch('/api/round1/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          slot: current.slot,
          selectedAnswer: answer ?? 'real',
          responseTimeMs,
          idempotencyKey: crypto.randomUUID(),
        }),
      }).catch(() => {});

      setTimeout(() => {
        submitting.current = false;
        if (index + 1 >= pending.length) {
          onComplete();
        } else {
          setIndex((i) => i + 1);
          setLocked(false);
          setRemaining(msPerImage);
          startedAt.current = Date.now();
        }
      }, 700);
    },
    [attemptId, current, index, pending.length, msPerImage, onComplete],
  );

  // Countdown. Auto-submits when it runs out so a distracted student cannot
  // stall the queue behind them.
  useEffect(() => {
    if (locked) return;
    const tick = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      const left = msPerImage - elapsed;
      setRemaining(left);
      if (left <= 0) submit(null);
    }, 100);
    return () => clearInterval(tick);
  }, [locked, msPerImage, submit]);

  if (!current) return null;

  const progress = Math.max(0, Math.min(1, remaining / msPerImage));
  const seconds = Math.max(0, Math.ceil(remaining / 1000));

  return (
    <ArenaFrame
      leftMascot="/sprites/char-boy-redcap.png"
      leftMascotAlt="Boy Redcap Challenger"
      rightMascot="/sprites/robot-monitor-standing.png"
      rightMascotAlt="Monitor Robot AI"
    >
      {/* Top Header & Telemetry */}
      <div>
        {/* Status Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Mobile Mascot Avatar */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sprites/char-boy-redcap.png"
              alt="Avatar"
              className="pixelated h-8 w-auto lg:hidden"
            />
            <span className="font-pixel text-[10px] tracking-wider text-slate-400">
              IMAGE <strong className="text-white">{index + 1}</strong>/{pending.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="pixel-timer tabular text-xs font-bold">
              {seconds.toString().padStart(2, '0')}s
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sprites/robot-monitor-standing.png"
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
          <span className="inline-block rounded-md border border-cyan-500/40 bg-cyan-950/40 px-3 py-1 font-pixel text-[9px] uppercase tracking-widest text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.2)]">
            ROUND 1 · REAL OR AI?
          </span>
          <h1 className="mt-2 font-display text-2xl font-black uppercase tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] sm:text-3xl">
            Real or AI Generated?
          </h1>
        </div>

        {/* Image Container with 16-Bit Retro Frame */}
        <div className="pixel-box relative mt-3.5 aspect-square w-full overflow-hidden p-1.5 sm:mt-4">
          <div className="relative h-full w-full overflow-hidden rounded-lg bg-slate-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.storagePath}
              alt="Is this photograph real or generated by AI?"
              className="h-full w-full object-cover select-none"
              draggable={false}
            />

            {/* Neutral Answer Locked Overlay */}
            {locked && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm animate-fade-in">
                <div className="h-3 w-3 rounded-full bg-cyan-400 animate-ping mb-3" />
                <p className="font-pixel text-sm tracking-wider uppercase text-cyan-300 drop-shadow-[0_0_12px_rgba(0,240,255,0.9)]">
                  ANSWER LOCKED
                </p>
                <p className="mt-2 font-display text-xs text-slate-400 uppercase tracking-widest">
                  Transmitting score...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Choice Buttons (Tactile 3D Retro Arcade) */}
      <div className="mt-4 sm:mt-6">
        <div className="grid grid-cols-2 gap-3.5">
          {/* REAL BUTTON (AMBER / GOLD) */}
          <button
            onClick={() => submit('real')}
            disabled={locked}
            className="pixel-btn pixel-btn-amber min-h-[64px] flex-col px-3 py-3"
          >
            <span className="font-pixel text-[8px] uppercase tracking-wider opacity-80">
              Option 1
            </span>
            <span className="font-pixel text-base uppercase tracking-wider sm:text-lg">
              REAL
            </span>
          </button>

          {/* AI GENERATED BUTTON (CYBER CYAN / BLUE) */}
          <button
            onClick={() => submit('ai_generated')}
            disabled={locked}
            className="pixel-btn pixel-btn-cyan min-h-[64px] flex-col px-3 py-3"
          >
            <span className="font-pixel text-[8px] uppercase tracking-wider opacity-80">
              Option 2
            </span>
            <span className="font-pixel text-base uppercase tracking-wider sm:text-lg">
              AI GENERATED
            </span>
          </button>
        </div>

        <p className="mt-3.5 text-center font-display text-xs text-slate-400">
          ⚡ Fast answer = speed bonus · Scores revealed at the end
        </p>
      </div>
    </ArenaFrame>
  );
}
