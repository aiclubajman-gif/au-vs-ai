'use client';

import React, { useMemo } from 'react';
import { VsBeamComponent } from '@/components/vfx/VsBeamComponent';

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
 * Combines:
 * - 3D Metallic Beveled Chevrons with bold italic typography
 * - The self-contained WebGL2/Canvas/CSS VsBeam engine with electric noise boundary and spark bursts
 * - Score-driven API with smooth lerping
 */
export function ClashBar({ stats, compact = false, className = '' }: ClashBarProps) {
  const { humanTotal, aiTotal, humanPercentage, aiPercentage } = stats;

  const splitPct = useMemo(() => {
    const total = humanTotal + aiTotal;
    if (total <= 0) return 50;
    const rawPct = (humanTotal / total) * 100;
    return Math.max(15, Math.min(85, Math.round(rawPct)));
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
          <span className="tabular font-black text-[#ff8c1a] text-sm sm:text-xl md:text-2xl drop-shadow-[0_0_12px_rgba(255,140,26,0.7)]">
            {formattedHumanTotal}
          </span>
        </div>

        {/* AI Stat */}
        <div className="flex items-baseline gap-1.5 sm:gap-2">
          <span className="text-white/90">AI TOTAL:</span>
          <span className="tabular font-black text-[#4d6bff] text-sm sm:text-xl md:text-2xl drop-shadow-[0_0_12px_rgba(77,107,255,0.7)]">
            {formattedAiTotal}
          </span>
        </div>
      </div>

      {/* -------------------------------------------------------------------
          THE MAIN CLASH BAR CONTAINER
          ------------------------------------------------------------------- */}
      <div
        className={`relative flex w-full items-center overflow-visible rounded-2xl p-1 sm:rounded-3xl ${
          compact ? 'h-14 sm:h-16' : 'h-20 sm:h-24 md:h-28'
        }`}
        style={{
          background: 'linear-gradient(180deg, #020617 0%, #090e24 100%)',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.7), 0 0 1px 1px rgba(255, 255, 255, 0.15)',
        }}
      >
        {/* =================================================================
            LAYER A: WEBGL2 SHADER BEAM & 2D CANVAS SPARKS (SELF-CONTAINED)
            ================================================================= */}
        <div className="absolute inset-x-2 inset-y-1 z-20 pointer-events-none">
          <VsBeamComponent
            humanScore={humanTotal}
            aiScore={aiTotal}
            compact={compact}
            humanColor="#ff8c1a"
            aiColor="#4d6bff"
          />
        </div>

        {/* =================================================================
            LAYER B: 3D METALLIC CHEVRONS (BACKGROUND STRUCTURE)
            ================================================================= */}
        <div className="relative flex h-full w-full items-center overflow-hidden rounded-xl sm:rounded-2xl z-10">
          {/* HUMANS (LEFT CHEVRON) */}
          <div
            className="relative flex h-full items-center justify-start pl-4 sm:pl-8 md:pl-10 transition-[width] duration-500 ease-out"
            style={{
              width: `${splitPct}%`,
              background: 'linear-gradient(180deg, rgba(255,190,11,0.4) 0%, rgba(234,88,12,0.6) 50%, rgba(153,27,27,0.8) 100%)',
              clipPath: compact
                ? 'polygon(0% 0%, calc(100% - 18px) 0%, 100% 50%, calc(100% - 18px) 100%, 0% 100%)'
                : 'polygon(0% 0%, calc(100% - 32px) 0%, 100% 50%, calc(100% - 32px) 100%, 0% 100%)',
              borderLeft: '3px solid #ffbe0b',
            }}
          >
            <span
              className={`font-black tracking-wider uppercase italic drop-shadow-[0_4px_6px_rgba(0,0,0,0.9)] ${
                compact ? 'text-base sm:text-xl' : 'text-xl sm:text-3xl md:text-4xl'
              } text-white`}
              style={{
                textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 0 16px rgba(255, 190, 11, 0.8)',
              }}
            >
              HUMANS
            </span>
          </div>

          {/* AI (RIGHT CHEVRON) */}
          <div
            className="relative flex h-full items-center justify-end pr-4 sm:pr-8 md:pr-10 transition-[width] duration-500 ease-out"
            style={{
              width: `${100 - splitPct}%`,
              background: 'linear-gradient(180deg, rgba(56,189,248,0.4) 0%, rgba(2,132,199,0.6) 50%, rgba(30,58,138,0.8) 100%)',
              clipPath: compact
                ? 'polygon(18px 0%, 100% 0%, 100% 100%, 18px 100%, 0% 50%)'
                : 'polygon(32px 0%, 100% 0%, 100% 100%, 32px 100%, 0% 50%)',
              borderRight: '3px solid #00f0ff',
            }}
          >
            <span
              className={`font-black tracking-wider uppercase italic drop-shadow-[0_4px_6px_rgba(0,0,0,0.9)] ${
                compact ? 'text-base sm:text-xl' : 'text-xl sm:text-3xl md:text-4xl'
              } text-white`}
              style={{
                textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 0 16px rgba(0, 240, 255, 0.8)',
              }}
            >
              AI
            </span>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------
          PERCENTAGES ROW (Bottom of the bar)
          HUMANS: 66% vs AI: 32%
          ------------------------------------------------------------------- */}
      <div className="mt-2 flex items-center justify-between px-3 text-xs font-black tracking-wider sm:text-base sm:tracking-widest md:text-lg">
        <span className="text-[#ff8c1a] drop-shadow-[0_0_10px_rgba(255,140,26,0.6)]">
          HUMANS: {humanPercentage}%
        </span>
        <span className="text-[#4d6bff] drop-shadow-[0_0_10px_rgba(77,107,255,0.6)]">
          AI: {aiPercentage}%
        </span>
      </div>
    </div>
  );
}
