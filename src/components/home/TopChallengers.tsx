import Link from 'next/link';
import { Sprite } from '@/components/px';
import type { LeaderboardDisplayMode } from '@/types';

export interface TopRow {
  rank: number;
  display_name: string;
  masked_id_suffix: string;
  total_score: number;
}

import { resolveAvatar } from '@/lib/avatars';

export function avatarFor(seed: string) {
  return resolveAvatar(seed);
}

export function playerLabel(row: TopRow, mode: LeaderboardDisplayMode) {
  if (mode === 'name_only') return row.display_name;
  if (mode === 'masked_id_only') return `••••${row.masked_id_suffix}`;
  return row.display_name;
}

const NAME_TONES = ['text-[#ffe66a]', 'text-[#7ffafe]', 'text-[#7ffafe]', 'text-[#7ffafe]'];

export function TopChallengers({
  rows,
  mode,
  className = '',
}: {
  rows: TopRow[];
  mode: LeaderboardDisplayMode;
  className?: string;
}) {
  return (
    <section className={`px-panel ${className}`} aria-labelledby="top-challengers">
      <div className="px-4 pb-3 pt-4 sm:px-5">
        <h2
          id="top-challengers"
          className="flex items-center justify-center gap-2 font-px text-[10px] text-[#ffe66a] px-text-outline sm:text-[12px]"
        >
          <span aria-hidden="true">✦</span>
          TOP HUMAN CHALLENGERS
          <span aria-hidden="true">✦</span>
        </h2>

        <ol className="mt-3 space-y-1.5">
          {rows.map((row) => {
            const first = row.rank === 1;
            return (
              <li
                key={`${row.rank}-${row.masked_id_suffix}`}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 sm:gap-3 ${
                  first ? 'bg-[#fed82c] shadow-[inset_0_0_0_3px_#a35a00]' : ''
                }`}
                style={{ clipPath: 'var(--px-corner)' }}
              >
                <span
                  className={`w-7 shrink-0 text-center font-px text-[11px] sm:text-[13px] ${
                    first ? 'text-[#4a2100]' : 'text-[#dff6ff]'
                  }`}
                >
                  {first ? (
                    <Sprite src="/sprites/badge-crown-gold.png" alt="1st" className="mx-auto h-5 w-5" />
                  ) : (
                    row.rank
                  )}
                </span>
                <Sprite
                  src={avatarFor(row.masked_id_suffix + row.display_name)}
                  className="h-7 w-7 shrink-0 sm:h-8 sm:w-8"
                />
                <span
                  className={`min-w-0 flex-1 truncate font-px text-[10px] sm:text-[12px] ${
                    first ? 'text-[#2a1200]' : NAME_TONES[row.rank - 1] ?? 'text-[#7ffafe]'
                  }`}
                >
                  {playerLabel(row, mode)}
                </span>
                <span
                  className={`tabular shrink-0 font-px text-[11px] sm:text-[13px] ${
                    first ? 'text-[#c23b00]' : 'text-[#ffe66a]'
                  }`}
                >
                  {row.total_score}
                </span>
              </li>
            );
          })}
        </ol>

        <Link
          href="/leaderboard"
          className="mt-3 block text-center font-px text-[8px] text-[#7ffafe] underline-offset-4 hover:underline sm:text-[9px]"
        >
          VIEW FULL LEADERBOARD →
        </Link>
      </div>
    </section>
  );
}
