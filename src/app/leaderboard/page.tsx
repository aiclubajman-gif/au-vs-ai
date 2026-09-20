import { createAdminSupabase } from '@/lib/supabase/server';
import { LeaderboardScreen, LEADERBOARD_SLOTS } from '@/components/leaderboard/LeaderboardScreen';
import { leaderboardLabel } from '@/lib/leaderboard-label';
import type { LeaderboardDisplayMode } from '@/types';

/**
 * Rendered per request, never cached.
 *
 * A student finishes, taps View Leaderboard and expects to be on it. With ISR
 * they instead got whatever had been rendered up to ten seconds earlier — at
 * the start of an event, the empty "No scores yet" board they had just
 * disproved. This page is eleven rows read by the handful of people standing
 * at one booth, so rendering it on every request costs nothing worth having.
 */
export const dynamic = 'force-dynamic';

interface Row {
  rank: number;
  display_name: string;
  masked_id_suffix: string;
  total_score: number;
  human_win: boolean;
}

async function getData() {
  try {
    const supabase = createAdminSupabase();
    const [{ data: rows }, { data: settings }] = await Promise.all([
      // The plate has a fixed number of painted rows; fetch only those.
      supabase.from('leaderboard_public').select('*').order('rank').limit(LEADERBOARD_SLOTS),
      supabase.from('event_settings').select('leaderboard_display').eq('id', 1).single(),
    ]);
    return {
      rows: (rows ?? []) as Row[],
      mode: (settings?.leaderboard_display ?? 'name_and_masked_id') as LeaderboardDisplayMode,
    };
  } catch {
    return { rows: [] as Row[], mode: 'name_and_masked_id' as LeaderboardDisplayMode };
  }
}

export default async function LeaderboardPage() {
  const { rows, mode } = await getData();

  return (
    <LeaderboardScreen
      rows={rows.map((row) => ({ rank: row.rank, name: leaderboardLabel(row, mode), score: row.total_score }))}
      emptyMessage={'No scores yet.\nThe challenge opens at the AIDA booth.'}
    />
  );
}
