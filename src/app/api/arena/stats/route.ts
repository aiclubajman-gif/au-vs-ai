/**
 * GET /api/arena/stats
 *
 * The live feed for the arena TV screen (/tv?source=live): wins per side, the
 * battle share, and the top of the leaderboard, as one ArenaStats.
 *
 * Everything here is already public — the same aggregates and names the
 * /leaderboard page renders — and the screen polls it every few seconds. A
 * short shared cache lets the CDN answer those polls, so however many screens
 * or curious visitors hit it, the database sees about one read per two seconds.
 */
import { createAdminSupabase } from '@/lib/supabase/server';
import { fail, ok } from '@/lib/api/respond';
import { toArenaStats, type ArenaLeaderboardRow, type EventStatsRow } from '@/lib/arena/from-db';
import { ARENA_TOP_PLAYERS } from '@/lib/arena/types';
import type { LeaderboardDisplayMode } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createAdminSupabase();
    const [stats, rows, settings] = await Promise.all([
      supabase.from('event_stats_public').select('human_wins, ai_wins').single(),
      supabase
        .from('leaderboard_public')
        .select('display_name, masked_id_suffix, total_score, completed_at')
        .order('rank')
        .limit(ARENA_TOP_PLAYERS),
      supabase.from('event_settings').select('leaderboard_display').eq('id', 1).single(),
    ]);
    if (stats.error || rows.error) {
      return fail('SERVER_ERROR', 'Arena stats are unavailable.', 503);
    }

    const response = ok(
      toArenaStats(
        stats.data as EventStatsRow,
        (rows.data ?? []) as ArenaLeaderboardRow[],
        (settings.data?.leaderboard_display ?? 'name_and_masked_id') as LeaderboardDisplayMode,
      ),
    );
    response.headers.set('Cache-Control', 'public, s-maxage=2, stale-while-revalidate=10');
    return response;
  } catch {
    return fail('SERVER_ERROR', 'Arena stats are unavailable.', 503);
  }
}
