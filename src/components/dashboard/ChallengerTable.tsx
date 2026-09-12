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
 * ChallengerTable — The "Top Human Challengers" glassmorphic leaderboard.
 *
 * Rank 1: Glowing golden-amber badge pill matching the mockup.
 * Ranks 2+: Deep cyber-blue pill rows with glowing cyan borders.
 * Responsive: Works seamlessly on both 1080p/4K TVs and 360px+ mobile phones.
 */
export function ChallengerTable({ rows, className = '' }: ChallengerTableProps) {
  return (
    <div className={`cyber-card relative w-full overflow-hidden rounded-2xl p-4 sm:rounded-3xl sm:p-6 md:p-8 ${className}`}>
      {/* Title Header */}
      <h2 className="mb-4 text-center text-lg font-black tracking-wide text-white sm:text-2xl md:text-3xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
        Top Human Challengers
      </h2>

      {/* Table Headings */}
      <div className="grid grid-cols-12 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-300 sm:text-sm md:text-base">
        <div className="col-span-2 text-center">Rank</div>
        <div className="col-span-7 sm:col-span-8 pl-2">Player Name</div>
        <div className="col-span-3 sm:col-span-2 text-right pr-2">Score</div>
      </div>

      {/* Rows */}
      {rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">
          No scores yet. The challenge opens at the AIDA booth!
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-2.5">
          {rows.map((row) => {
            const isFirst = row.rank === 1;

            if (isFirst) {
              return (
                <div
                  key={`rank-${row.rank}`}
                  className="grid grid-cols-12 items-center rounded-xl px-4 py-2.5 sm:rounded-2xl sm:py-3.5 transition-transform hover:scale-[1.01]"
                  style={{
                    background: 'linear-gradient(180deg, #fef08a 0%, #f59e0b 50%, #d97706 100%)',
                    boxShadow: '0 0 20px rgba(245, 158, 11, 0.55), inset 0 1px 2px rgba(255, 255, 255, 0.6)',
                  }}
                >
                  {/* Rank 1 Badge */}
                  <div className="col-span-2 text-center">
                    <span className="inline-flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-amber-950/25 text-amber-950 font-black text-sm sm:text-lg">
                      1
                    </span>
                  </div>

                  {/* Player Name */}
                  <div className="col-span-7 sm:col-span-8 truncate pl-2 font-black text-slate-950 text-sm sm:text-lg md:text-xl">
                    {row.displayName}{' '}
                    <span className="font-normal opacity-70 text-xs sm:text-sm">
                      ••••{row.maskedIdSuffix}
                    </span>
                  </div>

                  {/* Score */}
                  <div className="tabular col-span-3 sm:col-span-2 pr-2 text-right font-black text-slate-950 text-base sm:text-xl md:text-2xl">
                    {row.totalScore}
                  </div>
                </div>
              );
            }

            // Ranks 2+ (Cyber Blue Pills)
            return (
              <div
                key={`rank-${row.rank}`}
                className="grid grid-cols-12 items-center rounded-xl border border-sky-500/30 px-4 py-2 sm:rounded-2xl sm:py-3 transition-transform hover:scale-[1.01]"
                style={{
                  background: 'linear-gradient(180deg, #0d2253 0%, #071333 100%)',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(56, 189, 248, 0.2)',
                }}
              >
                {/* Rank */}
                <div className="tabular col-span-2 text-center font-bold text-sky-400 text-sm sm:text-base md:text-lg">
                  {row.rank}
                </div>

                {/* Player Name */}
                <div className="col-span-7 sm:col-span-8 truncate pl-2 font-bold text-slate-100 text-sm sm:text-base md:text-lg">
                  {row.displayName}{' '}
                  <span className="font-normal text-slate-400 text-xs sm:text-sm">
                    ••••{row.maskedIdSuffix}
                  </span>
                </div>

                {/* Score */}
                <div className="tabular col-span-3 sm:col-span-2 pr-2 text-right font-black text-white text-sm sm:text-lg md:text-xl">
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
