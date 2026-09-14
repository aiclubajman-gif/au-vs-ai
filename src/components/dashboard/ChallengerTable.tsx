'use client';

import React from 'react';

export interface ChallengerRow {
  rank: number;
  displayName: string;
  maskedIdSuffix: string;
  totalScore: number;
}

interface ChallengerTableProps {
  rows: ChallengerRow[];
  className?: string;
}

/**
 * ChallengerTable — 16-Bit Retro Arcade Leaderboard
 *
 * Matching `Homepage.png` mockup:
 * - Rank 1: Vibrant golden-yellow metallic pill with pixel crown badge (`badge-crown-gold.png`).
 * - Ranks 2+: Deep cyber-blue metallic bars with glowing blue edges.
 */
export function ChallengerTable({ rows, className = '' }: ChallengerTableProps) {
  return (
    <div className={`relative mx-auto w-full max-w-3xl text-center ${className}`}>
      {/* Title Header */}
      <h2 className="mb-3 font-display text-xl font-black uppercase tracking-wider text-white sm:text-2xl md:text-3xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
        Top Human Challengers
      </h2>

      {/* Table Headings */}
      <div className="grid grid-cols-12 px-6 py-1.5 font-pixel text-[10px] uppercase tracking-wider text-sky-300 sm:text-xs">
        <div className="col-span-2 text-center">Rank</div>
        <div className="col-span-7 sm:col-span-8 text-left pl-2">Challenger</div>
        <div className="col-span-3 sm:col-span-2 text-right pr-2">Score</div>
      </div>

      {/* Rows */}
      {rows.length === 0 ? (
        <div className="py-6 text-center font-display text-sm text-slate-400">
          No scores yet. The challenge opens live at the AIDA booth!
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const isFirst = row.rank === 1;

            if (isFirst) {
              return (
                <div
                  key={`rank-${row.rank}`}
                  className="grid grid-cols-12 items-center rounded-2xl border-2 border-[#fff59d] px-4 py-2.5 sm:px-6 sm:py-3 transition-transform hover:scale-[1.01]"
                  style={{
                    background: 'linear-gradient(180deg, #ffeb80 0%, #ffc107 40%, #e09400 85%, #b26a00 100%)',
                    boxShadow:
                      '0 0 28px rgba(255, 193, 7, 0.7), inset 0 2px 3px rgba(255, 255, 255, 0.8), inset 0 -2px 4px rgba(0, 0, 0, 0.6)',
                  }}
                >
                  {/* Rank 1 with Crown */}
                  <div className="col-span-2 flex items-center justify-center gap-1 font-pixel text-base font-black text-[#020617] sm:text-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/sprites/badge-crown-gold.png"
                      alt="1st Place Crown"
                      className="pixelated h-5 w-auto drop-shadow-sm"
                    />
                    <span>1</span>
                  </div>

                  {/* Player Name */}
                  <div className="col-span-7 sm:col-span-8 truncate text-left pl-2 font-display text-base font-black text-[#020617] sm:text-xl">
                    {row.displayName}{' '}
                    <span className="font-semibold opacity-70 text-xs sm:text-sm">
                      ••••{row.maskedIdSuffix}
                    </span>
                  </div>

                  {/* Score */}
                  <div className="tabular col-span-3 sm:col-span-2 pr-2 text-right font-pixel text-base font-black text-[#020617] sm:text-xl">
                    {row.totalScore}
                  </div>
                </div>
              );
            }

            // Ranks 2+ (Cyber Blue Metallic Bars)
            return (
              <div
                key={`rank-${row.rank}`}
                className="grid grid-cols-12 items-center rounded-xl border border-blue-600 px-4 py-2 sm:px-6 sm:py-2.5 transition-transform hover:scale-[1.01]"
                style={{
                  background: 'linear-gradient(180deg, #16408f 0%, #0c2661 50%, #07163c 100%)',
                  boxShadow: '0 6px 18px rgba(0, 0, 0, 0.6), inset 0 1px 2px rgba(96, 165, 250, 0.4)',
                }}
              >
                {/* Rank */}
                <div className="tabular col-span-2 text-center font-pixel text-xs font-black text-sky-300 sm:text-sm">
                  #{row.rank}
                </div>

                {/* Player Name */}
                <div className="col-span-7 sm:col-span-8 truncate text-left pl-2 font-display text-sm font-bold text-slate-100 sm:text-lg">
                  {row.displayName}{' '}
                  <span className="font-normal text-slate-400 text-xs sm:text-sm">
                    ••••{row.maskedIdSuffix}
                  </span>
                </div>

                {/* Score */}
                <div className="tabular col-span-3 sm:col-span-2 pr-2 text-right font-pixel text-sm font-black text-white sm:text-lg">
                  {row.totalScore}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
