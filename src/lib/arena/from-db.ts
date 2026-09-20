import { leaderboardLabelParts } from '@/lib/leaderboard-label';
import type { LeaderboardDisplayMode } from '@/types';
import { ARENA_TOP_PLAYERS, type ArenaStats } from './types';

/** The event_stats_public columns the arena uses (bigint counts may arrive as strings). */
export interface EventStatsRow {
  human_wins: number | string | null;
  ai_wins: number | string | null;
}

/** The leaderboard_public columns the arena uses. */
export interface ArenaLeaderboardRow {
  display_name: string;
  masked_id_suffix: string;
  total_score: number;
  completed_at: string;
}

const count = (v: number | string | null | undefined) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/**
 * Live database rows → what the arena screen shows.
 *
 * Only the win counts travel: the battle share the screen draws is derived
 * from them there (battleShare), so a percentage can never be sent that
 * disagrees with the totals beside it. Leaderboard
 * names follow the admin's display setting exactly as /leaderboard does. The
 * row id is when the player finished (microsecond timestamps, one attempt per
 * student): stable, so rows can slide to a new rank, and it carries neither
 * the name nor any part of the student ID, whichever of those the display
 * setting hides.
 */
export function toArenaStats(
  stats: EventStatsRow | null,
  rows: ArenaLeaderboardRow[],
  mode: LeaderboardDisplayMode,
): ArenaStats {
  return {
    humanWins: count(stats?.human_wins),
    aiWins: count(stats?.ai_wins),
    topPlayers: rows.slice(0, ARENA_TOP_PLAYERS).map((row, i) => {
      const { name, tag } = leaderboardLabelParts(row, mode);
      return {
        id: row.completed_at || `rank-${i + 1}`,
        name,
        score: row.total_score,
        ...(tag ? { tag } : {}),
      };
    }),
  };
}
