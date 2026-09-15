import { createAdminSupabase } from '@/lib/supabase/server';
import { LeaderboardScreen, LEADERBOARD_SLOTS } from '@/components/leaderboard/LeaderboardScreen';
import type { LeaderboardDisplayMode } from '@/types';

export const revalidate = 10;

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

/** §5 — never render a full student ID or email, whatever the mode. */
function label(row: Row, mode: LeaderboardDisplayMode) {
  if (mode === 'name_only') return row.display_name;
  if (mode === 'masked_id_only') return `••••${row.masked_id_suffix}`;
  return `${row.display_name} · ••••${row.masked_id_suffix}`;
}

export default async function LeaderboardPage() {
  const { rows, mode } = await getData();

  return (
    <LeaderboardScreen
      rows={rows.map((row) => ({ rank: row.rank, name: label(row, mode), score: row.total_score }))}
      emptyMessage={'No scores yet.\nThe challenge opens at the AIDA booth.'}
    />
  );
}
