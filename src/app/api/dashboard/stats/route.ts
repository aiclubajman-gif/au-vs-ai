import { createAdminSupabase } from '@/lib/supabase/server';
import { ok } from '@/lib/api/respond';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createAdminSupabase();

    const [statsRes, leaderboardRes] = await Promise.all([
      supabase.from('event_stats_public').select('*').maybeSingle(),
      supabase
        .from('leaderboard_public')
        .select('rank, display_name, masked_id_suffix, total_score, human_win')
        .order('rank')
        .limit(10),
    ]);

    const statsData = statsRes.data;
    const humanWins = Number(statsData?.human_wins ?? 0);
    const aiWins = Number(statsData?.ai_wins ?? 0);
    const totalPlayers = Number(statsData?.total_players ?? 0);

    const totalContests = humanWins + aiWins;
    const humanPercentage =
      totalContests > 0 ? Math.max(0, Math.min(100, Math.round((humanWins / totalContests) * 100))) : 50;
    const aiPercentage = totalContests > 0 ? 100 - humanPercentage : 50;

    const topChallengers = (leaderboardRes.data ?? []).map((row) => ({
      rank: row.rank,
      displayName: row.display_name,
      maskedIdSuffix: row.masked_id_suffix,
      totalScore: row.total_score,
      humanWin: row.human_win,
    }));

    return ok({
      clash: {
        humanTotal: humanWins,
        aiTotal: aiWins,
        humanPercentage,
        aiPercentage,
      },
      eventStats: {
        totalPlayers,
        humanWins,
        aiWins,
        topScore: Number(statsData?.top_score ?? 0),
        averageScore: Number(statsData?.average_score ?? 0),
        playingNow: Number(statsData?.playing_now ?? 0),
      },
      topChallengers,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return ok({
      clash: {
        humanTotal: 0,
        aiTotal: 0,
        humanPercentage: 50,
        aiPercentage: 50,
      },
      eventStats: {
        totalPlayers: 0,
        humanWins: 0,
        aiWins: 0,
        topScore: 0,
        averageScore: 0,
        playingNow: 0,
      },
      topChallengers: [],
      timestamp: new Date().toISOString(),
    });
  }
}
