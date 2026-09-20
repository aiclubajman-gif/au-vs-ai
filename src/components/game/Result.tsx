'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { PublicAttemptResult } from '@/types';

export function Result({
  result,
  returning = false,
}: {
  result: PublicAttemptResult;
  returning?: boolean;
}) {
  const [shown, setShown] = useState(returning ? result.totalScore : 0);

  useEffect(() => {
    if (returning) return;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(result.totalScore);
      return;
    }

    const duration = 1400;
    const start = performance.now();
    let frame = 0;

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(result.totalScore * eased));
      if (t < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [result.totalScore, returning]);

  const isHumanWin = result.humanWin;

  // Returning player screen matching Site Pages/14 you already played.png
  if (returning) {
    return (
      <main className="relative flex min-h-dvh flex-col overflow-hidden bg-[var(--color-px-bg)] text-[var(--color-ink)]">
        <div
          className="absolute inset-0 z-0 bg-cover bg-center opacity-30 pointer-events-none"
          style={{ backgroundImage: "url('/backgrounds/circuit-9x16.png')" }}
          aria-hidden="true"
        />
        <div className="arena-bg z-0 opacity-70" aria-hidden="true" />

        <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-5 py-6 sm:py-8 text-center">
          <div className="flex items-center justify-between">
            <span className="px-chip text-[9px]">AU vs AI</span>
            <span className="font-px text-[9px] text-[#ffd23e]">OFFICIAL ATTEMPT</span>
          </div>

          <div className="my-auto flex flex-col items-center">
            {/* Mascot with You Already Played speech bubble */}
            <div className="relative mb-2 flex items-center justify-center">
              <img
                src="/sprites/mascot-girl-cheer.png"
                alt="AIDA Mascot"
                className="pixelated h-32 w-auto drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
              />
            </div>

            <h1 className="px-title-yellow text-2xl sm:text-3xl leading-tight">
              YOU&apos;VE ALREADY PLAYED
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-300 max-w-xs leading-relaxed">
              Your official attempt is complete. Thank you for being part of AU vs AI.
            </p>

            {/* Score & Rank Card */}
            <div className="px-panel mt-5 w-full p-4 bg-[#0d1440]/90 border-[3px] border-[#070c26]">
              <p className="font-px text-[9px] text-[#ffd23e] tracking-wider border-b border-[#2c4ba8]/60 pb-2">
                YOUR RESULT
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#131c4e] p-2 border border-[#2c4ba8]">
                  <p className="font-px text-[8px] text-slate-400">SCORE</p>
                  <p className="tabular font-px text-sm sm:text-base text-[#ffd23e] mt-1">
                    {result.totalScore}
                  </p>
                </div>
                <div className="bg-[#131c4e] p-2 border border-[#2c4ba8]">
                  <p className="font-px text-[8px] text-slate-400">RANK</p>
                  <p className="tabular font-px text-sm sm:text-base text-[#35e0ff] mt-1">
                    #{result.rank}
                  </p>
                </div>
                <div className="bg-[#131c4e] p-2 border border-[#2c4ba8]">
                  <p className="font-px text-[8px] text-slate-400">BEAT</p>
                  <p className="tabular font-px text-sm sm:text-base text-[var(--color-win)] mt-1">
                    {result.percentileBeaten}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full space-y-3 pt-4">
            <Link
              href="/leaderboard"
              className="px-btn px-btn-cyan block w-full py-3.5 text-center text-xs tracking-wider"
            >
              VIEW LEADERBOARD →
            </Link>
            <Link
              href="/club"
              className="px-btn px-btn-yellow block w-full py-3.5 text-center text-xs tracking-wider"
            >
              JOIN AIDA →
            </Link>
            <Link
              href="/"
              className="block text-center font-px text-[9px] text-slate-400 hover:text-slate-200 pt-1"
            >
              &lt; Back to Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // HUMAN WIN Screen
  if (isHumanWin) {
    return (
      <main className="relative flex min-h-dvh flex-col overflow-hidden bg-[var(--color-px-bg)] text-[var(--color-ink)]">
        <div
          className="absolute inset-0 z-0 bg-cover bg-center opacity-30 pointer-events-none"
          style={{ backgroundImage: "url('/backgrounds/circuit-9x16.png')" }}
          aria-hidden="true"
        />
        <div className="arena-bg z-0 opacity-70" aria-hidden="true" />
        <div className="px-confetti" aria-hidden="true" />

        <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-5 py-6 sm:py-8 text-center">
          <div className="flex items-center justify-between">
            <span className="px-chip text-[9px]">AU vs AI</span>
            <span className="font-px text-[9px] text-[var(--color-win)]">VICTORY</span>
          </div>

          <div className="my-auto flex flex-col items-center">
            {/* Top Crown and Title */}
            <div className="flex items-center justify-center gap-2 mb-1">
              <img
                src="/sprites/badge-crown-gold.png"
                alt="Crown"
                className="h-6 w-6 pixelated"
              />
            </div>
            <h1 className="px-title-yellow text-3xl sm:text-4xl leading-tight tracking-wider">
              HUMAN WIN
            </h1>
            <p className="mt-1 font-px text-[9px] sm:text-[10px] text-[#ffd23e] tracking-wider">
              HUMANITY +1 YOU BEAT THE AI!
            </p>

            {/* Score box flanked by cheering mascots matching Proposed mock/mhumanWin.png */}
            <div className="relative mt-6 w-full flex items-center justify-center">
              {/* Left Cheer Mascot */}
              <div className="absolute -left-3 bottom-0 select-none pointer-events-none">
                <img
                  src="/sprites/mascot-boy-cheer.png"
                  alt="Cheering Mascot"
                  className="pixelated h-24 sm:h-28 w-auto drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]"
                />
              </div>

              {/* Center Score Frame */}
              <div className="px-frame z-10 px-8 py-5 bg-[#0d1440]/95 border-[3px] border-[#070c26] shadow-[0_6px_0_#070c26] min-w-[200px]">
                <p className="font-px text-[9px] text-slate-400">YOUR SCORE</p>
                <p
                  className="tabular mt-2 font-px text-4xl sm:text-5xl text-[#ffd23e]"
                  style={{ textShadow: '4px 4px 0 #070c26' }}
                >
                  {shown}
                </p>
                <p className="font-px text-[10px] text-slate-400 mt-1">/1000</p>
              </div>

              {/* Right Cheer Mascot */}
              <div className="absolute -right-3 bottom-0 select-none pointer-events-none">
                <img
                  src="/sprites/mascot-girl-cheer.png"
                  alt="Cheering Mascot"
                  className="pixelated h-24 sm:h-28 w-auto drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]"
                />
              </div>
            </div>

            {/* Rank and Percentile Badges */}
            <div className="mt-6 grid grid-cols-2 gap-3 w-full">
              <div className="px-panel px-3 py-3.5 bg-[#0d1440]/90 border-2 border-[#ffd23e]/50 flex flex-col items-center">
                <span className="font-px text-[8px] text-slate-400">YOUR RANK</span>
                <span
                  className="tabular mt-1 font-px text-base sm:text-lg text-[#ffd23e]"
                  style={{ textShadow: '2px 2px 0 #070c26' }}
                >
                  #{result.rank}
                </span>
              </div>
              <div className="px-panel px-3 py-3.5 bg-[#0d1440]/90 border-2 border-[var(--color-px-cyan)]/50 flex flex-col items-center">
                <span className="font-px text-[8px] text-slate-400">YOU BEAT</span>
                <span
                  className="tabular mt-1 font-px text-base sm:text-lg text-[var(--color-px-cyan)]"
                  style={{ textShadow: '2px 2px 0 #070c26' }}
                >
                  {result.percentileBeaten}%
                </span>
              </div>
            </div>

            {/* Motivational Quote */}
            <p className="mt-4 font-mono text-[10px] text-slate-300 italic">
              &ldquo;A brighter tomorrow still belongs to human minds.&rdquo;
            </p>
          </div>

          {/* Action CTAs */}
          <div className="w-full space-y-3 pt-4">
            <Link
              href="/leaderboard"
              className="px-btn px-btn-yellow block w-full py-3.5 text-center text-xs tracking-wider"
            >
              VIEW LEADERBOARD →
            </Link>
            <Link
              href="/club"
              className="px-btn px-btn-cyan block w-full py-3.5 text-center text-xs tracking-wider"
            >
              JOIN AIDA →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // AI WIN Screen matching Proposed mock/M_Ai_win.jpeg
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-[var(--color-px-bg)] text-[var(--color-ink)]">
      <div
        className="absolute inset-0 z-0 bg-cover bg-center opacity-30 pointer-events-none"
        style={{ backgroundImage: "url('/backgrounds/circuit-9x16.png')" }}
        aria-hidden="true"
      />
      <div className="arena-bg z-0 opacity-70" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-5 py-6 sm:py-8 text-center">
        <div className="flex items-center justify-between">
          <span className="px-chip text-[9px]">AU vs AI</span>
          <span className="font-px text-[9px] text-[var(--color-px-cyan)]">AI DEFEAT</span>
        </div>

        <div className="my-auto flex flex-col items-center">
          {/* Cheering robot sprite above title */}
          <div className="mb-2 flex items-center justify-center select-none pointer-events-none">
            <img
              src="/sprites/robot-arms-raised.png"
              alt="Victor Robot"
              className="pixelated h-20 w-auto drop-shadow-[0_0_16px_rgba(53,224,255,0.8)]"
            />
          </div>

          <h1 className="px-title-cyan text-3xl sm:text-4xl leading-tight tracking-wider">
            AI WIN
          </h1>
          <p className="mt-1 font-px text-[9px] sm:text-[10px] text-[#35e0ff] tracking-wider">
            AI TAKES THIS ONE
          </p>

          {/* Score Box flanked by shrugging mascots */}
          <div className="relative mt-6 w-full flex items-center justify-center">
            {/* Left Shrug Mascot */}
            <div className="absolute -left-3 bottom-0 select-none pointer-events-none">
              <img
                src="/sprites/mascot-boy-shrug.png"
                alt="Shrug Mascot"
                className="pixelated h-24 sm:h-28 w-auto drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]"
              />
            </div>

            {/* Center Score Frame */}
            <div className="px-frame z-10 px-8 py-5 bg-[#0d1440]/95 border-[3px] border-[#070c26] shadow-[0_6px_0_#070c26] min-w-[200px]">
              <p className="font-px text-[9px] text-slate-400">YOUR SCORE</p>
              <p
                className="tabular mt-2 font-px text-4xl sm:text-5xl text-[var(--color-px-cyan)]"
                style={{ textShadow: '4px 4px 0 #070c26' }}
              >
                {shown}
              </p>
              <p className="font-px text-[10px] text-slate-400 mt-1">/1000</p>
            </div>

            {/* Right Shrug Mascot */}
            <div className="absolute -right-3 bottom-0 select-none pointer-events-none">
              <img
                src="/sprites/mascot-girl-idk.png"
                alt="Shrug Mascot"
                className="pixelated h-24 sm:h-28 w-auto drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]"
              />
            </div>
          </div>

          {/* Badges */}
          <div className="mt-6 grid grid-cols-2 gap-3 w-full">
            <div className="px-panel px-3 py-3.5 bg-[#0d1440]/90 border-2 border-slate-600 flex flex-col items-center">
              <span className="font-px text-[8px] text-slate-400">YOUR RANK</span>
              <span
                className="tabular mt-1 font-px text-base sm:text-lg text-slate-200"
                style={{ textShadow: '2px 2px 0 #070c26' }}
              >
                #{result.rank}
              </span>
            </div>
            <div className="px-panel px-3 py-3.5 bg-[#0d1440]/90 border-2 border-[var(--color-px-cyan)]/50 flex flex-col items-center">
              <span className="font-px text-[8px] text-slate-400">YOU BEAT</span>
              <span
                className="tabular mt-1 font-px text-base sm:text-lg text-[var(--color-px-cyan)]"
                style={{ textShadow: '2px 2px 0 #070c26' }}
              >
                {result.percentileBeaten}%
              </span>
            </div>
          </div>

          {/* Sad human on floating island */}
          <div className="mt-4 flex flex-col items-center select-none pointer-events-none">
            <div className="relative">
              <img
                src="/sprites/ai-win-island.png"
                alt=""
                className="pixelated h-14 w-auto drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]"
              />
              <img
                src="/sprites/boy-sad-sitting.png"
                alt="Sad Student"
                className="pixelated h-12 w-auto absolute bottom-5 left-1/2 -translate-x-1/2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
              />
            </div>
          </div>
        </div>

        {/* Action CTAs */}
        <div className="w-full space-y-3 pt-3">
          <Link
            href="/leaderboard"
            className="px-btn px-btn-cyan block w-full py-3.5 text-center text-xs tracking-wider"
          >
            VIEW LEADERBOARD →
          </Link>
          <Link
            href="/club"
            className="px-btn px-btn-yellow block w-full py-3.5 text-center text-xs tracking-wider"
          >
            JOIN AIDA →
          </Link>
        </div>
      </div>
    </main>
  );
}
