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
 * ClashBar — High-Energy Anime-Style Humans vs AI Battle Station
 *
 * Left: Glowing 3D Golden-Orange Chevron with metallic bevel & HUMANS bold italic lettering.
 * Right: Glowing 3D Electric-Cyan Chevron with metallic bevel & AI bold italic lettering.
 * Center: Enormous anime energy beam clash explosion (Dragon Ball / Mecha style) with
 *         crackling gold & blue lightning, rotating rays, and particle shards.
 */
export function ClashBar({ stats, compact = false, className = '' }: ClashBarProps) {
  const { humanTotal, aiTotal, humanPercentage, aiPercentage } = stats;

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
      <div className="mb-2 flex items-center justify-between px-3 text-xs font-black tracking-wider uppercase sm:text-base sm:tracking-widest md:text-lg">
        {/* Human Stat */}
        <div className="flex items-baseline gap-1.5 sm:gap-2">
          <span className="text-white/90">HUMANS TOTAL:</span>
          <span className="tabular font-black text-[var(--color-human-gold)] text-sm sm:text-xl md:text-2xl drop-shadow-[0_0_12px_rgba(255,190,11,0.7)]">
            {formattedHumanTotal}
          </span>
        </div>

        {/* AI Stat */}
        <div className="flex items-baseline gap-1.5 sm:gap-2">
          <span className="text-white/90">AI TOTAL:</span>
          <span className="tabular font-black text-[var(--color-ai-cyan)] text-sm sm:text-xl md:text-2xl drop-shadow-[0_0_12px_rgba(0,240,255,0.7)]">
            {formattedAiTotal}
          </span>
        </div>
      </div>

      {/* -------------------------------------------------------------------
          THE MAIN CLASH BAR CONTAINER
          ------------------------------------------------------------------- */}
      <div
        className={`relative flex w-full items-center overflow-visible ${
          compact ? 'h-14 sm:h-16' : 'h-20 sm:h-24 md:h-28'
        }`}
      >
        {/* =================================================================
            HUMANS (LEFT CHEVRON)
            ================================================================= */}
        <div
          className="relative flex h-full items-center justify-start rounded-l-2xl pl-4 sm:pl-8 md:pl-10 transition-[width] duration-500 ease-out z-10"
          style={{
            width: `${splitPct}%`,
            background: 'linear-gradient(180deg, #ffde59 0%, #ff9100 35%, #e54b00 70%, #9e1a00 100%)',
            clipPath: compact
              ? 'polygon(0% 0%, calc(100% - 20px) 0%, 100% 50%, calc(100% - 20px) 100%, 0% 100%)'
              : 'polygon(0% 0%, calc(100% - 36px) 0%, 100% 50%, calc(100% - 36px) 100%, 0% 100%)',
            boxShadow:
              'inset 0 4px 6px rgba(255, 255, 255, 0.7), inset 0 -4px 8px rgba(0, 0, 0, 0.7), 0 0 35px rgba(255, 145, 0, 0.5)',
            borderTop: '3px solid #fff399',
            borderBottom: '3px solid #661000',
            borderLeft: '3px solid #ffbe0b',
          }}
        >
          {/* Text: HUMANS */}
          <span
            className={`font-black tracking-wider uppercase italic drop-shadow-[0_4px_6px_rgba(0,0,0,0.9)] ${
              compact
                ? 'text-lg sm:text-2xl'
                : 'text-2xl sm:text-4xl md:text-5xl lg:text-6xl'
            } text-white`}
            style={{
              textShadow:
                '0 4px 6px rgba(0,0,0,0.9), 0 0 24px rgba(255, 240, 150, 0.8), -2px -2px 0 #541000, 2px 2px 0 #541000',
            }}
          >
            HUMANS
          </span>
        </div>

        {/* =================================================================
            AI (RIGHT CHEVRON)
            ================================================================= */}
        <div
          className="relative flex h-full items-center justify-end rounded-r-2xl pr-4 sm:pr-8 md:pr-10 transition-[width] duration-500 ease-out z-10"
          style={{
            width: `${100 - splitPct}%`,
            background: 'linear-gradient(180deg, #60efff 0%, #00a2ff 35%, #0051e6 70%, #001f7a 100%)',
            clipPath: compact
              ? 'polygon(20px 0%, 100% 0%, 100% 100%, 20px 100%, 0% 50%)'
              : 'polygon(36px 0%, 100% 0%, 100% 100%, 36px 100%, 0% 50%)',
            boxShadow:
              'inset 0 4px 6px rgba(255, 255, 255, 0.7), inset 0 -4px 8px rgba(0, 0, 0, 0.7), 0 0 35px rgba(0, 162, 255, 0.5)',
            borderTop: '3px solid #c2fbff',
            borderBottom: '3px solid #001247',
            borderRight: '3px solid #00f0ff',
          }}
        >
          {/* Text: AI */}
          <span
            className={`font-black tracking-wider uppercase italic drop-shadow-[0_4px_6px_rgba(0,0,0,0.9)] ${
              compact
                ? 'text-lg sm:text-2xl'
                : 'text-2xl sm:text-4xl md:text-5xl lg:text-6xl'
            } text-white`}
            style={{
              textShadow:
                '0 4px 6px rgba(0,0,0,0.9), 0 0 24px rgba(0, 240, 255, 0.9), -2px -2px 0 #002266, 2px 2px 0 #002266',
            }}
          >
            AI
          </span>
        </div>

        {/* =================================================================
            EPIC ANIME CLASH EXPLOSION AT THE SEAM (Z-INDEX 30)
            Follows the exact seam splitPct
            ================================================================= */}
        <div
          className={`pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-500 ease-out z-30 animate-clash-shockwave ${
            compact ? 'w-[280px] h-[200px]' : 'w-[520px] h-[340px] sm:w-[620px] sm:h-[400px]'
          }`}
          style={{ left: `${splitPct}%` }}
        >
          {/* Rotating starburst flare aura */}
          <div className="absolute inset-0 m-auto h-[75%] w-[75%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.9)_0%,rgba(255,190,11,0.5)_30%,rgba(0,240,255,0.4)_55%,transparent_75%)] mix-blend-screen animate-ray-spin" />

          {/* Epic anime explosion image asset */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/anime_clash_explosion.jpg"
            alt="Clash Explosion"
            className="h-full w-full object-contain mix-blend-screen filter contrast-125 brightness-125 animate-jitter"
          />
        </div>
      </div>

      {/* -------------------------------------------------------------------
          PERCENTAGES ROW (Bottom of the bar)
          HUMANS: 66% vs AI: 32%
          ------------------------------------------------------------------- */}
      <div className="mt-2 flex items-center justify-between px-3 text-xs font-black tracking-wider sm:text-base sm:tracking-widest md:text-lg">
        <span className="text-[var(--color-human-gold)] drop-shadow-[0_0_10px_rgba(255,190,11,0.6)]">
          HUMANS: {humanPercentage}%
        </span>
        <span className="text-[var(--color-ai-cyan)] drop-shadow-[0_0_10px_rgba(0,240,255,0.6)]">
          AI: {aiPercentage}%
        </span>
      </div>
    </div>
  );
}
