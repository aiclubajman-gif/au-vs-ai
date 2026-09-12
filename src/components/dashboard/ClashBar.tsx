'use client';

import React, { useMemo } from 'react';

export interface ClashStats {
  humanTotal: number;
  aiTotal: number;
  humanPercentage: number;
  aiPercentage: number;
}

interface ClashBarProps {
  stats: ClashStats;
  compact?: boolean;
  className?: string;
}

/**
 * ClashBar — The core Humans vs AI dynamic battle meter.
 *
 * Left side: Glowing beveled Amber/Orange "HUMANS" chevron.
 * Right side: Glowing beveled Cyber Cyan/Blue "AI" chevron.
 * Center: Explosive animated collision sparks and lens flare.
 *
 * Dynamic width: The leading team's bar expands proportionally, pushing
 * the collision point into the opponent's territory.
 */
export function ClashBar({ stats, compact = false, className = '' }: ClashBarProps) {
  const { humanTotal, aiTotal, humanPercentage, aiPercentage } = stats;

  // Calculate dynamic split ratio with a safety clamp (20% min to 80% max)
  // so labels are never crushed off-screen.
  const splitPct = useMemo(() => {
    const total = humanTotal + aiTotal;
    if (total <= 0) return 50;
    const rawPct = (humanTotal / total) * 100;
    return Math.max(20, Math.min(80, Math.round(rawPct)));
  }, [humanTotal, aiTotal]);

  const formattedHumanTotal = humanTotal.toLocaleString();
  const formattedAiTotal = aiTotal.toLocaleString();

  return (
    <div className={`relative w-full select-none ${className}`}>
      {/* -------------------------------------------------------------------
          STATS ROW (Top of the bar)
          HUMANS TOTAL vs AI TOTAL
          ------------------------------------------------------------------- */}
      <div className="mb-2 flex items-center justify-between px-2 text-xs font-black tracking-wider uppercase sm:text-base sm:tracking-widest md:text-lg">
        {/* Human Stat */}
        <div className="flex flex-col items-start sm:flex-row sm:items-baseline sm:gap-2">
          <span className="text-[var(--color-muted)]">HUMANS TOTAL:</span>
          <span className="tabular font-black text-[var(--color-human-glow)] text-sm sm:text-xl md:text-2xl drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">
            {formattedHumanTotal}
          </span>
        </div>

        {/* AI Stat */}
        <div className="flex flex-col items-end sm:flex-row sm:items-baseline sm:gap-2">
          <span className="text-[var(--color-muted)]">AI TOTAL:</span>
          <span className="tabular font-black text-[var(--color-ai-cyan)] text-sm sm:text-xl md:text-2xl drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]">
            {formattedAiTotal}
          </span>
        </div>
      </div>

      {/* -------------------------------------------------------------------
          THE MAIN CLASH BAR CONTAINER
          ------------------------------------------------------------------- */}
      <div
        className={`relative flex w-full items-center overflow-visible rounded-2xl p-1 sm:rounded-3xl ${
          compact ? 'h-14 sm:h-16' : 'h-16 sm:h-20 md:h-24'
        }`}
        style={{
          background: 'linear-gradient(180deg, #020617 0%, #090e24 100%)',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.7), 0 0 1px 1px rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* =================================================================
            HUMANS (LEFT BAR)
            ================================================================= */}
        <div
          className="relative flex h-full items-center justify-start overflow-hidden rounded-l-xl pl-4 transition-[width] duration-700 ease-out sm:rounded-l-2xl sm:pl-8"
          style={{
            width: `${splitPct}%`,
            background: 'linear-gradient(180deg, #fbbf24 0%, #ea580c 45%, #991b1b 100%)',
            clipPath: 'polygon(0% 0%, calc(100% - 24px) 0%, 100% 50%, calc(100% - 24px) 100%, 0% 100%)',
            boxShadow: 'inset 0 2px 4px rgba(255, 255, 255, 0.5), inset 0 -3px 6px rgba(0, 0, 0, 0.6), 0 0 24px rgba(245, 158, 11, 0.35)',
          }}
        >
          {/* Subtle metallic bevel highlight */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent" />

          {/* Text: HUMANS */}
          <span
            className={`font-black tracking-wider uppercase italic drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${
              compact
                ? 'text-base sm:text-xl'
                : 'text-lg sm:text-2xl md:text-3xl lg:text-4xl'
            } text-white`}
            style={{
              textShadow: '0 0 12px rgba(254, 240, 138, 0.8), 0 2px 4px rgba(0,0,0,0.9)',
            }}
          >
            HUMANS
          </span>
        </div>

        {/* =================================================================
            AI (RIGHT BAR)
            ================================================================= */}
        <div
          className="relative flex h-full items-center justify-end overflow-hidden rounded-r-xl pr-4 transition-[width] duration-700 ease-out sm:rounded-r-2xl sm:pr-8"
          style={{
            width: `${100 - splitPct}%`,
            background: 'linear-gradient(180deg, #38bdf8 0%, #0284c7 45%, #1e3a8a 100%)',
            clipPath: 'polygon(24px 0%, 100% 0%, 100% 100%, 24px 100%, 0% 50%)',
            boxShadow: 'inset 0 2px 4px rgba(255, 255, 255, 0.5), inset 0 -3px 6px rgba(0, 0, 0, 0.6), 0 0 24px rgba(0, 240, 255, 0.35)',
          }}
        >
          {/* Subtle metallic bevel highlight */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent" />

          {/* Text: AI */}
          <span
            className={`font-black tracking-wider uppercase italic drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${
              compact
                ? 'text-base sm:text-xl'
                : 'text-lg sm:text-2xl md:text-3xl lg:text-4xl'
            } text-white`}
            style={{
              textShadow: '0 0 12px rgba(56, 189, 248, 0.8), 0 2px 4px rgba(0,0,0,0.9)',
            }}
          >
            AI
          </span>
        </div>

        {/* =================================================================
            CENTER CLASH ENERGY (SPARKS & LENS FLARE)
            Follows the exact seam splitPct
            ================================================================= */}
        <div
          className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-700 ease-out z-20"
          style={{ left: `${splitPct}%` }}
        >
          {/* Central Bright Hotspot */}
          <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-full bg-white blur-[4px] animate-clash-pulse" />

          {/* Core White Star */}
          <div className="absolute inset-0 m-auto h-4 w-4 rounded-full bg-white shadow-[0_0_20px_10px_#ffffff]" />

          {/* Dual Flare Rings */}
          <div className="absolute inset-0 m-auto -h-16 -w-16 h-20 w-20 sm:h-28 sm:w-28 rounded-full border border-amber-300/40 blur-[2px] animate-clash-pulse" />

          {/* Rotating Spark Rays */}
          <div className="absolute inset-0 m-auto flex h-24 w-24 sm:h-36 sm:w-36 items-center justify-center animate-spark-rotate">
            {/* Spark Rays */}
            <div className="absolute h-full w-[2px] bg-gradient-to-t from-transparent via-amber-300 to-transparent" />
            <div className="absolute h-[2px] w-full bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
            <div className="absolute h-full w-[1.5px] rotate-45 bg-gradient-to-t from-transparent via-white to-transparent opacity-80" />
            <div className="absolute h-full w-[1.5px] -rotate-45 bg-gradient-to-t from-transparent via-white to-transparent opacity-80" />
            <div className="absolute h-full w-[1px] rotate-[22deg] bg-gradient-to-t from-transparent via-amber-200 to-transparent opacity-60" />
            <div className="absolute h-full w-[1px] -rotate-[22deg] bg-gradient-to-t from-transparent via-cyan-200 to-transparent opacity-60" />
            <div className="absolute h-full w-[1px] rotate-[68deg] bg-gradient-to-t from-transparent via-amber-200 to-transparent opacity-60" />
            <div className="absolute h-full w-[1px] -rotate-[68deg] bg-gradient-to-t from-transparent via-cyan-200 to-transparent opacity-60" />
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------
          PERCENTAGES ROW (Bottom of the bar)
          HUMANS: 66% vs AI: 32%
          ------------------------------------------------------------------- */}
      <div className="mt-2 flex items-center justify-between px-2 text-xs font-black tracking-wider sm:text-base sm:tracking-widest md:text-lg">
        <span className="text-[var(--color-human-glow)] drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]">
          HUMANS: {humanPercentage}%
        </span>
        <span className="text-[var(--color-ai-cyan)] drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]">
          AI: {aiPercentage}%
        </span>
      </div>
    </div>
  );
}
