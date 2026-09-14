'use client';

import { useEffect, useState } from 'react';
import type { PublicAttemptResult } from '@/types';
import { ArenaFrame } from './ArenaFrame';

/**
 * Result screen (§24).
 *
 * 16-Bit Retro Arcade Redesign:
 * - Matching `humanwin.png` / `mhumanWin.png` and `aiwin.png`.
 * - Human Victory: Golden laurels framing score, jumping human duo (`char-humans-win.png`),
 *   penguins celebration (`mascot-penguins-win.png`), Rank #1 trophy and percentile badges.
 * - AI Victory: Cyber cyan banner, slumping human duo (`char-humans-defeat.png`),
 *   celebrating robots (`robot-dancing-notes.png` / `robot-cheer-arms-up.png`),
 *   shrugging penguins (`mascot-shrug-left.png`, `mascot-shrug-right.png`).
 */
export function Result({
  result,
  returning = false,
}: {
  result: PublicAttemptResult;
  returning?: boolean;
}) {
  const [shown, setShown] = useState(returning ? result.totalScore : 0);
  const [screen, setScreen] = useState<1 | 2>(1);

  // Animated Count-up (respects prefers-reduced-motion)
  useEffect(() => {
    if (returning) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  if (screen === 2) {
    return (
      <ArenaFrame maxWidth="max-w-lg">
        <div className="flex flex-1 flex-col justify-center">
          <div className="text-center">
            <span className="inline-block rounded-md border border-cyan-500/40 bg-cyan-950/40 px-3 py-1 font-pixel text-[9px] uppercase tracking-widest text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.2)]">
              STANDINGS RECORDED
            </span>
            <h1 className="mt-2 font-display text-3xl font-black uppercase tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              You&apos;re On The Leaderboard!
            </h1>
            <p className="mt-2 font-display text-sm text-slate-300">
              Keep an eye on the AU vs AI mega screen at the AIDA booth at the Club Fair to see final rankings and prizes.
            </p>
          </div>

          <div className="pixel-box-cyan mt-6 p-6">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/sprites/badge-crown-gold.png"
                alt="Crown"
                className="pixelated h-8 w-auto"
              />
              <h2 className="font-pixel text-sm uppercase text-amber-300">
                Want to Join AIDA?
              </h2>
            </div>
            <p className="mt-3 font-display text-sm leading-relaxed text-slate-300">
              Your official score is locked in. If you want to build projects, join hackathons, and learn real AI with us, membership is open through Ajman University&apos;s ORS system.
            </p>
            <a
              href="/club"
              className="pixel-btn pixel-btn-amber mt-5 min-h-[52px] w-full text-xs"
            >
              HOW TO JOIN AIDA
            </a>
          </div>

          <a
            href="/leaderboard"
            className="mt-6 block text-center font-display text-sm font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300"
          >
            ← View Live Clash Stadium
          </a>
        </div>
      </ArenaFrame>
    );
  }

  return (
    <ArenaFrame
      maxWidth="max-w-lg"
      leftMascot={isHumanWin ? '/sprites/char-humans-win.png' : '/sprites/char-humans-defeat.png'}
      leftMascotAlt={isHumanWin ? 'Human Victory Celebration' : 'Human Defeat'}
      rightMascot={isHumanWin ? '/sprites/mascot-penguins-win.png' : '/sprites/robot-dancing-notes.png'}
      rightMascotAlt={isHumanWin ? 'Penguin Mascots' : 'AI Dancing Robot'}
    >
      <div className="flex flex-1 flex-col justify-center text-center">
        {/* Returning Player Notice */}
        {returning && (
          <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-950/40 px-4 py-2 font-pixel text-[10px] text-amber-300">
            OFFICIAL ATTEMPT ALREADY COMPLETED · FINAL SCORE
          </div>
        )}

        {/* Victory / Defeat Stadium Banner */}
        <div className="mx-auto">
          {isHumanWin ? (
            <div className="inline-block rounded-xl border-2 border-amber-400/80 bg-gradient-to-r from-amber-600/60 via-amber-500/80 to-yellow-500/60 px-6 py-2 shadow-[0_0_30px_rgba(245,158,11,0.6)]">
              <span className="font-pixel text-lg font-black uppercase tracking-widest text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] sm:text-2xl">
                ★ HUMAN VICTORY! ★
              </span>
            </div>
          ) : (
            <div className="inline-block rounded-xl border-2 border-cyan-400/80 bg-gradient-to-r from-blue-700/60 via-cyan-600/80 to-sky-500/60 px-6 py-2 shadow-[0_0_30px_rgba(0,240,255,0.6)]">
              <span className="font-pixel text-lg font-black uppercase tracking-widest text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] sm:text-2xl">
                ⚡ AI DOMINATION! ⚡
              </span>
            </div>
          )}
        </div>

        {/* Central Characters Celebration Showcase */}
        <div className="relative my-3 flex items-center justify-center">
          {isHumanWin ? (
            <div className="flex items-center justify-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/sprites/char-humans-win.png"
                alt="Human Victory"
                className="pixelated max-h-36 w-auto object-contain sm:max-h-44 drop-shadow-[0_0_20px_rgba(255,190,11,0.5)]"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/sprites/mascot-penguins-win.png"
                alt="Penguin Mascot"
                className="pixelated max-h-32 w-auto object-contain sm:max-h-40 drop-shadow-[0_0_20px_rgba(0,240,255,0.5)]"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/sprites/char-humans-defeat.png"
                alt="Human Defeat"
                className="pixelated max-h-32 w-auto object-contain opacity-90 sm:max-h-36"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/sprites/robot-dancing-notes.png"
                alt="AI Dancing"
                className="pixelated max-h-36 w-auto object-contain sm:max-h-44 drop-shadow-[0_0_25px_rgba(0,240,255,0.7)]"
              />
            </div>
          )}
        </div>

        {/* Score Showcase with Laurel Wreath */}
        <div className="relative mx-auto flex items-center justify-center">
          {isHumanWin && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src="/sprites/badge-laurel-left.png"
              alt="Laurel Left"
              className="pixelated h-20 w-auto sm:h-28 opacity-90 drop-shadow-[0_0_10px_rgba(255,190,11,0.5)]"
            />
          )}

          <div className="px-4">
            <span className="font-pixel text-[10px] uppercase tracking-widest text-slate-400">
              {returning ? 'FINAL SCORE' : 'TOTAL SCORE'}
            </span>
            <div className="tabular font-pixel text-5xl font-black text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.8)] sm:text-7xl">
              {shown}
            </div>
            <span className="font-pixel text-xs font-bold text-slate-400">
              OUT OF 1000 PTS
            </span>
          </div>

          {isHumanWin && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src="/sprites/badge-laurel-right.png"
              alt="Laurel Right"
              className="pixelated h-20 w-auto sm:h-28 opacity-90 drop-shadow-[0_0_10px_rgba(255,190,11,0.5)]"
            />
          )}
        </div>

        {/* Telemetry Badges (Rank and Percentile) */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          {/* Rank Badge Card */}
          <div className="pixel-box flex flex-col items-center justify-center p-3.5">
            <div className="flex items-center gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/sprites/badge-crown-gold.png"
                alt="Crown"
                className="pixelated h-5 w-auto"
              />
              <span className="font-pixel text-[9px] uppercase text-slate-400">
                STADIUM RANK
              </span>
            </div>
            <p className="tabular font-pixel mt-1 text-2xl font-black text-amber-300 drop-shadow-[0_0_12px_rgba(255,190,11,0.6)] sm:text-3xl">
              #{result.rank}
            </p>
          </div>

          {/* Percentile Badge Card */}
          <div className="pixel-box flex flex-col items-center justify-center p-3.5">
            <span className="font-pixel text-[9px] uppercase text-slate-400">
              PLAYERS BEATEN
            </span>
            <p className="tabular font-pixel mt-1 text-2xl font-black text-cyan-300 drop-shadow-[0_0_12px_rgba(0,240,255,0.6)] sm:text-3xl">
              {result.percentileBeaten}%
            </p>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="mt-6">
        <button
          onClick={() => setScreen(2)}
          className={`pixel-btn min-h-[64px] w-full text-sm ${
            isHumanWin ? 'pixel-btn-amber' : 'pixel-btn-cyan'
          }`}
        >
          {returning ? 'VIEW LEADERBOARD' : 'CONTINUE TO STANDINGS'}
        </button>
      </div>
    </ArenaFrame>
  );
}
