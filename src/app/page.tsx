import Link from 'next/link';
import { createAdminSupabase } from '@/lib/supabase/server';
import { ClashBeam } from '@/components/game/ClashBeam';
import { TopChallengers, type TopRow } from '@/components/home/TopChallengers';
import { AnimatedSprite, Backdrop, Flank, PxChip, PxLink, PxStar, Wordmark } from '@/components/px';
import type { EventStats, LeaderboardDisplayMode } from '@/types';

export const revalidate = 10;

const FALLBACK_ROWS: TopRow[] = [
  { rank: 1, display_name: 'PixelRanger', masked_id_suffix: '4821', total_score: 950 },
  { rank: 2, display_name: 'StarGazer', masked_id_suffix: '1903', total_score: 890 },
  { rank: 3, display_name: 'LeafWalker', masked_id_suffix: '7724', total_score: 840 },
  { rank: 4, display_name: 'OceanDream', masked_id_suffix: '3310', total_score: 790 },
];

async function getStats(): Promise<EventStats | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const { data } = await createAdminSupabase().from('event_stats_public').select('*').single();
    if (!data) return null;
    return {
      totalPlayers: data.total_players ?? 0,
      humanWins: data.human_wins ?? 0,
      aiWins: data.ai_wins ?? 0,
      topScore: data.top_score ?? 0,
      averageScore: data.average_score ?? 0,
      playingNow: data.playing_now ?? 0,
    };
  } catch {
    return null;
  }
}

async function getTopChallengers(): Promise<{ rows: TopRow[]; mode: LeaderboardDisplayMode }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { rows: [], mode: 'name_and_masked_id' };
  }
  try {
    const s = createAdminSupabase();
    const [{ data: rows }, { data: settings }] = await Promise.all([
      s.from('leaderboard_public').select('rank, display_name, masked_id_suffix, total_score').order('rank').limit(4),
      s.from('event_settings').select('leaderboard_display').eq('id', 1).single(),
    ]);
    return {
      rows: (rows ?? []) as TopRow[],
      mode: (settings?.leaderboard_display ?? 'name_and_masked_id') as LeaderboardDisplayMode,
    };
  } catch {
    return { rows: [], mode: 'name_and_masked_id' };
  }
}

export default async function LandingPage() {
  const [stats, board] = await Promise.all([getStats(), getTopChallengers()]);
  const humanWins = stats?.humanWins ?? 142;
  const aiWins = stats?.aiWins ?? 118;
  const rows = board.rows.length > 0 ? board.rows : FALLBACK_ROWS;

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-[#01174d]">
      <div
        className="pixelated absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/backgrounds/homepage-clean.png')" }}
        aria-hidden="true"
      />
      <Flank name="home-humans" side="left" cap="36vw" />
      <Flank name="home-robots" side="right" cap="34vw" />

      <Backdrop leaves />

      <header className="relative z-20 flex items-center justify-between px-4 pt-3 sm:px-6">
        <PxChip className="text-[9px] sm:text-[10px]">AIDA</PxChip>
        <nav className="flex items-center gap-2" aria-label="Site">
          <Link href="/leaderboard" className="px-chip text-[8px] sm:text-[9px]">
            LEADERBOARD
          </Link>
          <Link href="/club" className="px-chip px-chip--gold text-[8px] sm:text-[9px]">
            JOIN AIDA
          </Link>
        </nav>
      </header>

      <div className="px-scroll relative z-20 mx-auto flex w-full max-w-[1100px] flex-1 flex-col items-center px-4 pb-6 pt-2 sm:px-8 lg:pt-0">
        <Wordmark
          name="humans-vs-ai"
          priority
          className="mx-auto mt-1 w-[92%] max-w-[420px] drop-shadow-[0_6px_0_rgba(0,0,0,0.35)] sm:max-w-[560px] lg:max-w-[640px]"
        />

        <div className="mt-4 flex items-end gap-3 sm:mt-5">
          <AnimatedSprite name="boy-cheer" speed="0.8s" className="h-20 lg:hidden" />
          <PxStar className="mb-5 h-5 w-5 drop-shadow-[2px_2px_0_#041030]" />
          <PxLink
            href="/play"
            className="min-h-[60px] w-[200px] text-[16px] sm:w-[240px] sm:text-[18px]"
            labelClassName="text-[#1b1a5c]"
          >
            PLAY
          </PxLink>
          <PxStar className="mb-5 h-5 w-5 drop-shadow-[2px_2px_0_#041030]" />
          <AnimatedSprite name="robot-1" speed="1.2s" className="h-20 drop-shadow-[0_0_12px_rgba(0,187,252,0.6)] lg:hidden" />
        </div>

        <ClashBeam
          humanWins={humanWins}
          aiWins={aiWins}
          className="mt-2 w-full max-w-[420px] sm:max-w-[640px] lg:mt-3 lg:max-w-[780px]"
        />

        <TopChallengers
          rows={rows}
          mode={board.mode}
          className="mt-3 w-full max-w-[520px] lg:-mt-2"
        />
      </div>

      <footer className="px-footer-note relative z-20 pb-4 text-center">AIDA CLUB FAIR CHALLENGE · AJMAN UNIVERSITY</footer>
    </main>
  );
}
