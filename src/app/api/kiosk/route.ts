import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase/server';
import type { LeaderboardDisplayMode } from '@/types';

export const dynamic = 'force-dynamic';

export interface KioskRow {
  rank: number;
  display_name: string;
  masked_id_suffix: string;
  total_score: number;
  human_win: boolean;
}

export interface KioskData {
  live: boolean;
  totalPlayers: number;
  humanWins: number;
  aiWins: number;
  playingNow: number;
  topScore: number;
  mode: LeaderboardDisplayMode;
  rows: KioskRow[];
  timings: { round1MsPerImage: number; round2DrawMs: number; round3Ms: number };
  updatedAt: string;
}

const DEFAULT_TIMINGS = { round1MsPerImage: 5000, round2DrawMs: 12000, round3Ms: 8000 };

const EMPTY: KioskData = {
  live: false,
  totalPlayers: 0,
  humanWins: 0,
  aiWins: 0,
  playingNow: 0,
  topScore: 0,
  mode: 'name_only',
  rows: [],
  timings: DEFAULT_TIMINGS,
  updatedAt: new Date(0).toISOString(),
};

const SAMPLE: KioskData = {
  live: true,
  totalPlayers: 64,
  humanWins: 27,
  aiWins: 37,
  playingNow: 3,
  topScore: 950,
  mode: 'name_only',
  rows: [
    { rank: 1, display_name: 'AUScholar', masked_id_suffix: '4821', total_score: 950, human_win: true },
    { rank: 2, display_name: 'MindMaster', masked_id_suffix: '1903', total_score: 890, human_win: true },
    { rank: 3, display_name: 'FutureThinker', masked_id_suffix: '8744', total_score: 840, human_win: true },
    { rank: 4, display_name: 'InnovatorX', masked_id_suffix: '3029', total_score: 790, human_win: true },
    { rank: 5, display_name: 'BlueFalcon', masked_id_suffix: '6112', total_score: 760, human_win: false },
    { rank: 6, display_name: 'QuizWizard', masked_id_suffix: '9420', total_score: 690, human_win: false },
    { rank: 7, display_name: 'NeuronNinja', masked_id_suffix: '5318', total_score: 620, human_win: true },
    { rank: 8, display_name: 'IdeaForge', masked_id_suffix: '2774', total_score: 580, human_win: false },
  ],
  timings: DEFAULT_TIMINGS,
  updatedAt: new Date().toISOString(),
};

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: true, data: process.env.NODE_ENV === 'production' ? EMPTY : SAMPLE });
  }
  try {
    const s = createAdminSupabase();
    const [{ data: stats }, { data: rows }, { data: settings }] = await Promise.all([
      s.from('event_stats_public').select('*').single(),
      s.from('leaderboard_public').select('rank, display_name, masked_id_suffix, total_score, human_win').order('rank').limit(10),
      s.from('event_settings').select('leaderboard_display, round1_ms_per_image, round2_draw_ms, round3_ms').eq('id', 1).single(),
    ]);
    const totalPlayers = stats?.total_players ?? 0;
    const data: KioskData = {
      live: totalPlayers > 0,
      totalPlayers,
      humanWins: stats?.human_wins ?? 0,
      aiWins: stats?.ai_wins ?? 0,
      playingNow: stats?.playing_now ?? 0,
      topScore: stats?.top_score ?? 0,
      mode: (settings?.leaderboard_display ?? 'name_only') as LeaderboardDisplayMode,
      rows: (rows ?? []) as KioskRow[],
      timings: {
        round1MsPerImage: settings?.round1_ms_per_image ?? DEFAULT_TIMINGS.round1MsPerImage,
        round2DrawMs: settings?.round2_draw_ms ?? DEFAULT_TIMINGS.round2DrawMs,
        round3Ms: settings?.round3_ms ?? DEFAULT_TIMINGS.round3Ms,
      },
      updatedAt: new Date().toISOString(),
    };
    return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: true, data: EMPTY });
  }
}
