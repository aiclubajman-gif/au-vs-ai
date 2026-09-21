import { createAdminSupabase } from '@/lib/supabase/server';
import type { LeaderboardDisplayMode } from '@/types';

export const revalidate = 10;

interface Row {
  rank: number;
  display_name: string;
  masked_id_suffix: string;
  total_score: number;
  human_win: boolean;
}

const FALLBACK_ROWS: Row[] = [
  { rank: 1, display_name: 'AUScholar', masked_id_suffix: '4821', total_score: 950, human_win: true },
  { rank: 2, display_name: 'MindMaster', masked_id_suffix: '1903', total_score: 890, human_win: true },
  { rank: 3, display_name: 'FutureThinker', masked_id_suffix: '8744', total_score: 840, human_win: true },
  { rank: 4, display_name: 'InnovatorX', masked_id_suffix: '3029', total_score: 790, human_win: true },
  { rank: 5, display_name: 'BlueFalcon', masked_id_suffix: '6112', total_score: 760, human_win: false },
  { rank: 6, display_name: 'QuizWizard', masked_id_suffix: '9420', total_score: 690, human_win: false },
  { rank: 7, display_name: 'NeuronNinja', masked_id_suffix: '5318', total_score: 620, human_win: true },
  { rank: 8, display_name: 'IdeaForge', masked_id_suffix: '2774', total_score: 580, human_win: false },
  { rank: 9, display_name: 'VisionaryV', masked_id_suffix: '8031', total_score: 540, human_win: true },
  { rank: 10, display_name: 'BrightMind', masked_id_suffix: '4199', total_score: 500, human_win: false },
];

async function getData() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      rows: FALLBACK_ROWS,
      isLive: false,
      mode: 'name_only' as LeaderboardDisplayMode,
      avatarMap: {} as Record<string, string>,
    };
  }
  try {
    const supabase = createAdminSupabase();

    const [
      { data: rows },
      { data: settings },
      { data: avatarEvents },
    ] = await Promise.all([
      supabase.from('leaderboard_public').select('*').order('rank').limit(50),
      supabase.from('event_settings').select('leaderboard_display').eq('id', 1).single(),
      supabase
        .from('app_events')
        .select('details')
        .eq('event', 'avatar_selected')
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

    const avatarMap: Record<string, string> = {};
    if (avatarEvents) {
      for (const ev of avatarEvents) {
        const d = ev.details as {
          avatarId?: string;
          displayName?: string;
          maskedIdSuffix?: string;
        } | null;
        if (!d?.avatarId) continue;
        if (d.maskedIdSuffix && d.displayName) {
          const fullKey = d.maskedIdSuffix + d.displayName;
          if (!avatarMap[fullKey]) avatarMap[fullKey] = d.avatarId;
        }
        if (d.displayName && !avatarMap[d.displayName]) {
          avatarMap[d.displayName] = d.avatarId;
        }
      }
    }

    const fetched = (rows ?? []) as Row[];
    return {
      rows: fetched,
      isLive: true,
      mode: (settings?.leaderboard_display ?? 'name_only') as LeaderboardDisplayMode,
      avatarMap,
    };
  } catch {
    return {
      rows: FALLBACK_ROWS,
      isLive: false,
      mode: 'name_only' as LeaderboardDisplayMode,
      avatarMap: {} as Record<string, string>,
    };
  }
}

import { LeaderboardView, type LeaderboardRow } from '@/components/leaderboard/LeaderboardView';

export default async function LeaderboardPage() {
  const { rows, mode, isLive, avatarMap } = await getData();

  return (
    <LeaderboardView
      rows={rows as LeaderboardRow[]}
      mode={mode}
      isLive={isLive}
      avatarMap={avatarMap}
    />
  );
}
