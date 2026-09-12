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
 * ChallengerTable — "Top Human Challengers" arena scoreboard
 *
 * Direct match to the target mockup:
 * - Rank 1: Vibrant golden-yellow metallic pill with bold dark lettering & amber glow.
 * - Ranks 2+: Deep cyber-blue metallic bars with glowing blue edges.
 */
export function ChallengerTable({ rows, className = '' }: ChallengerTableProps) {
  return (
    <div className={`relative mx-auto w-full max-w-3xl text-center ${className}`}>
      {/* Title Header */}
      <h2 className="mb-3 text-xl font-black tracking-wide text-white sm:text-2xl md:text-3xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
        Top Human Challengers
      </h2>

      {/* Table Headings */}
      <div className="grid grid-cols-12 px-6 py-1.5 text-xs font-black uppercase tracking-wider text-sky-200 sm:text-sm">
        <div className="col-span-2 text-center">Rank</div>
        <div className="col-span-7 sm:col-span-8 text-left pl-2">Player Name</div>
        <div className="col-span-3 sm:col-span-2 text-right pr-2">Score</div>
      </div>

      {/* Rows */}
      {rows.length === 0 ? (
        <div className="py-6 text-center text-sm text-slate-400">
          No scores yet. The challenge opens at the AIDA booth!
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const isFirst = row.rank === 1;

            if (isFirst) {
              return (
                <div
                  key={`rank-${row.rank}`}
                  className="grid grid-cols-12 items-center rounded-2xl border-2 border-[#fff59d] px-6 py-2.5 sm:py-3 transition-transform hover:scale-[1.01]"
                  style={{
                    background: 'linear-gradient(180deg, #ffeb80 0%, #ffc107 40%, #e09400 85%, #b26a00 100%)',
                    boxShadow:
                      '0 0 28px rgba(255, 193, 7, 0.7), inset 0 2px 3px rgba(255, 255, 255, 0.8), inset 0 -2px 4px rgba(0, 0, 0, 0.6)',
                  }}
                >
                  {/* Rank 1 */}
                  <div className="col-span-2 text-center font-black text-[#020617] text-lg sm:text-2xl">
                    1
                  </div>

                  {/* Player Name */}
                  <div className="col-span-7 sm:col-span-8 truncate text-left pl-2 font-black text-[#020617] text-base sm:text-xl">
                    {row.displayName}{' '}
                    <span className="font-semibold opacity-70 text-xs sm:text-sm">
                      ••••{row.maskedIdSuffix}
                    </span>
                  </div>

                  {/* Score */}
                  <div className="tabular col-span-3 sm:col-span-2 pr-2 text-right font-black text-[#020617] text-lg sm:text-2xl">
                    {row.totalScore}
                  </div>
                </div>
              );
            }

            // Ranks 2+ (Cyber Blue Metallic Bars)
            return (
              <div
                key={`rank-${row.rank}`}
                className="grid grid-cols-12 items-center rounded-xl border border-blue-600 px-6 py-2 sm:py-2.5 transition-transform hover:scale-[1.01]"
                style={{
                  background: 'linear-gradient(180deg, #16408f 0%, #0c2661 50%, #07163c 100%)',
                  boxShadow: '0 6px 18px rgba(0, 0, 0, 0.6), inset 0 1px 2px rgba(96, 165, 250, 0.4)',
                }}
              >
                {/* Rank */}
                <div className="tabular col-span-2 text-center font-black text-sky-300 text-sm sm:text-lg">
                  {row.rank}
                </div>

                {/* Player Name */}
                <div className="col-span-7 sm:col-span-8 truncate text-left pl-2 font-bold text-slate-100 text-sm sm:text-lg">
                  {row.displayName}{' '}
                  <span className="font-normal text-slate-400 text-xs sm:text-sm">
                    ••••{row.maskedIdSuffix}
                  </span>
                </div>

                {/* Score */}
                <div className="tabular col-span-3 sm:col-span-2 pr-2 text-right font-black text-white text-base sm:text-xl">
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
