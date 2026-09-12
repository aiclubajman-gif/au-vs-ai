'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Round1Slot } from '@/types';

/**
 * Round 1 — Real or AI?
 *
 * Three images, one at a time. §11 forbids telling the student whether they
 * were right, so the only feedback is a neutral "Answer locked". That is a
 * deliberate product choice: without it, the first group through the booth
 * would leak the answer key to everyone behind them.
 *
 * UI Redesign:
 * - "Real" choice themed in Human Amber/Gold with tactile touch states.
 * - "AI generated" choice themed in Cyber Cyan/Blue with tactile touch states.
 * - 64px+ min touch targets for flawless mobile speed.
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
    <main className="flex min-h-dvh flex-col bg-[var(--color-void)] px-4 py-6 text-white select-none sm:px-6">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-between">
        {/* Top Info Bar */}
        <div>
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
            <span>
              Image <strong className="text-white">{index + 1}</strong> of {pending.length}
            </span>
            <span className="tabular text-sm font-black text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]">
              {seconds}s
            </span>
          </div>

          {/* Countdown Progress Bar */}
          <div
            className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 via-sky-400 to-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.6)] transition-[width] duration-100 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          {/* Header */}
          <div className="mt-5 text-center">
            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-sky-300">
              Round 1 · Real vs AI
            </span>
            <h1 className="mt-2 text-2xl font-black tracking-wide sm:text-3xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              Real or AI Generated?
            </h1>
          </div>

          {/* Image Container with Cyber Frame */}
          <div
            className="relative mt-4 aspect-square w-full overflow-hidden rounded-2xl border border-sky-500/30 p-1"
            style={{
              background: 'linear-gradient(180deg, #09132e 0%, #030818 100%)',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6), inset 0 1px 2px rgba(255, 255, 255, 0.15)',
            }}
          >
            <div className="relative h-full w-full overflow-hidden rounded-xl bg-slate-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.storagePath}
                alt="Is this photograph real or generated by AI?"
                className="h-full w-full object-cover select-none"
                draggable={false}
              />

              {locked && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm animate-fade-in">
                  <div className="h-3 w-3 rounded-full bg-sky-400 animate-ping mb-3" />
                  <p className="text-xl font-black tracking-wider uppercase text-sky-300 drop-shadow-[0_0_12px_rgba(56,189,248,0.8)]">
                    Answer Locked
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Choice Buttons */}
        <div className="mt-6">
          <div className="grid grid-cols-2 gap-3.5">
            {/* REAL BUTTON (HUMAN AMBER / GOLD) */}
            <button
              onClick={() => submit('real')}
              disabled={locked}
              className="flex min-h-[68px] flex-col items-center justify-center rounded-2xl border-2 border-amber-500/50 px-4 py-3 transition-all duration-150 hover:border-amber-400 hover:scale-[1.02] active:scale-95 disabled:opacity-40"
              style={{
                background: 'linear-gradient(180deg, #241708 0%, #120a02 100%)',
                boxShadow:
                  '0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(251, 191, 36, 0.25), 0 0 16px rgba(245, 158, 11, 0.15)',
              }}
            >
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400/80">
                Option 1
              </span>
              <span className="text-xl font-black uppercase tracking-wider text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]">
                Real
              </span>
            </button>

            {/* AI GENERATED BUTTON (CYBER CYAN / BLUE) */}
            <button
              onClick={() => submit('ai_generated')}
              disabled={locked}
              className="flex min-h-[68px] flex-col items-center justify-center rounded-2xl border-2 border-sky-500/50 px-4 py-3 transition-all duration-150 hover:border-cyan-400 hover:scale-[1.02] active:scale-95 disabled:opacity-40"
              style={{
                background: 'linear-gradient(180deg, #0a1e3f 0%, #040e21 100%)',
                boxShadow:
                  '0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(56, 189, 248, 0.25), 0 0 16px rgba(0, 240, 255, 0.15)',
              }}
            >
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400/80">
                Option 2
              </span>
              <span className="text-xl font-black uppercase tracking-wider text-cyan-300 drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]">
                AI Generated
              </span>
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-slate-400">
            Tap fast for speed bonus · Official scores tally at the end
          </p>
        </div>
      </div>
    </main>
  );
}
