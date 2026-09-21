import Link from 'next/link';
import Image from 'next/image';
import { createAdminSupabase } from '@/lib/supabase/server';
import { ClashBeam } from '@/components/game/ClashBeam';
import type { EventStats, LeaderboardDisplayMode } from '@/types';

export const revalidate = 10;

interface TopRow {
  rank: number;
  display_name: string;
  masked_id_suffix: string;
  total_score: number;
}

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
      s.from('leaderboard_public').select('rank, display_name, masked_id_suffix, total_score').order('rank').limit(5),
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

function formatPlayerLabel(row: TopRow, mode: LeaderboardDisplayMode) {
  if (mode === 'name_only') return row.display_name;
  if (mode === 'masked_id_only') return `••••${row.masked_id_suffix}`;
  return `${row.display_name} · ••••${row.masked_id_suffix}`;
}

export default async function LandingPage() {
  const [stats, board] = await Promise.all([getStats(), getTopChallengers()]);

  const humanWins = stats?.humanWins ?? 142;
  const aiWins = stats?.aiWins ?? 118;

  // Fallback rows matching mock if no database rows yet
  const displayRows = board.rows.length > 0
    ? board.rows
    : [
      { rank: 1, display_name: 'PixelRanger', masked_id_suffix: '4821', total_score: 950 },
      { rank: 2, display_name: 'StarGazer', masked_id_suffix: '1903', total_score: 890 },
      { rank: 3, display_name: 'LeafWalker', masked_id_suffix: '7724', total_score: 840 },
      { rank: 4, display_name: 'OceanDream', masked_id_suffix: '3310', total_score: 790 },
    ];

  return (
    <main className="relative min-h-dvh w-full overflow-x-hidden bg-[var(--color-px-bg)] text-[var(--color-ink)] flex flex-col justify-between">
      {/* Background with clean meadow on left and circuit on right */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: "url('/backgrounds/homepage-clean.png')" }}
        aria-hidden="true"
      />
      <div className="arena-bg z-0 opacity-60" aria-hidden="true" />

      {/* =================================================================== */}
      {/* DESKTOP FLANKS (Humans on left, Robots on right)                    */}
      {/* =================================================================== */}
      <aside
        className="pointer-events-none absolute bottom-8 left-4 z-10 hidden select-none lg:flex flex-col items-start gap-4 xl:left-12 2xl:left-20"
        aria-hidden="true"
      >
        <div className="flex items-end gap-3">
          <img
            src="/sprites/boy.png"
            alt=""
            className="pixelated h-28 w-auto drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] xl:h-36"
          />
          <img
            src="/sprites/girl-strawhat.png"
            alt=""
            className="pixelated h-24 w-auto drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] xl:h-32"
          />
        </div>
        <div className="flex items-end gap-4 ml-6">
          <img
            src="/sprites/boy-cheer.png"
            alt=""
            className="pixelated h-32 w-auto drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] xl:h-40"
          />
          <img
            src="/sprites/girl-cheering.png"
            alt=""
            className="pixelated h-28 w-auto drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] xl:h-36"
          />
        </div>
      </aside>

      <aside
        className="pointer-events-none absolute bottom-8 right-4 z-10 hidden select-none lg:flex flex-col items-end gap-4 xl:right-12 2xl:right-20"
        aria-hidden="true"
      >
        <div className="flex items-end gap-4">
          <img
            src="/sprites/robot-cat.png"
            alt=""
            className="pixelated h-24 w-auto drop-shadow-[0_0_16px_rgba(53,224,255,0.6)] xl:h-32"
          />
          <img
            src="/sprites/robot-1.png"
            alt=""
            className="pixelated h-28 w-auto drop-shadow-[0_0_16px_rgba(53,224,255,0.6)] xl:h-36"
          />
        </div>
        <div className="flex items-end gap-4 mr-6">
          <img
            src="/sprites/robot-arms-raised.png"
            alt=""
            className="pixelated h-32 w-auto drop-shadow-[0_0_16px_rgba(53,224,255,0.7)] xl:h-40"
          />
          <img
            src="/sprites/robot-happy-cheering.png"
            alt=""
            className="pixelated h-28 w-auto drop-shadow-[0_0_16px_rgba(53,224,255,0.6)] xl:h-36"
          />
        </div>
      </aside>

      {/* =================================================================== */}
      {/* HEADER BAR                                                          */}
      {/* =================================================================== */}
      <header className="relative z-20 flex w-full items-center justify-between px-4 py-4 sm:px-8">
        <div className="flex items-center gap-2">
          <span className="px-chip text-[9px] sm:text-[10px]">AIDA</span>
          <span className="text-[11px] font-medium text-slate-300 tracking-wide hidden sm:inline">
            AJMAN UNIVERSITY
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/leaderboard"
            className="px-btn px-btn-ghost px-3 py-2 text-[9px] sm:text-[10px]"
          >
            Leaderboard
          </Link>
          <Link
            href="/club"
            className="px-btn px-btn-cyan px-3 py-2 text-[9px] sm:text-[10px]"
          >
            Join AIDA
          </Link>
        </div>
      </header>

      {/* =================================================================== */}
      {/* CENTER STAGE: TITLE, PLAY BUTTON, DYNAMIC BEAM, LEADERBOARD         */}
      {/* =================================================================== */}
      <div className="relative z-20 mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-2">
        {/* Title */}
        <div className="text-center">
          <h1 className="px-title-yellow text-3xl sm:text-4xl md:text-5xl tracking-wide leading-tight">
            HUMANS vs AI
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 font-semibold tracking-wider">
            THE 60 SECOND CHALLENGE
          </p>
        </div>

        {/* Big PLAY CTA Button */}
        <div className="mt-5 w-full max-w-xs sm:max-w-sm">
          <Link
            href="/play"
            className="px-btn px-btn-yellow block w-full py-4 text-center font-px text-sm sm:text-base tracking-widest shadow-[0_6px_0_#070c26] hover:brightness-110 active:translate-y-1 transition-all"
          >
            PLAY
          </Link>
        </div>

        {/* Dynamic Energy Beam Centerpiece */}
        <div className="mt-4 w-full flex flex-col items-center">
          <ClashBeam
            humanWins={humanWins}
            aiWins={aiWins}
            className="w-full"
            showLabels={true}
          />
        </div>

        {/* Live Score Ticker Chips */}
        <div className="mt-3 flex items-center justify-center gap-3 sm:gap-6 font-px text-[9px] sm:text-[10px]">
          <span className="px-chip text-[#ff9d1b] border-[#ff9d1b]/40">
            HUMAN WINS: {humanWins}
          </span>
          <span className="px-chip text-[#35e0ff] border-[#35e0ff]/40">
            AI WINS: {aiWins}
          </span>
        </div>

        {/* Top Human Challengers Leaderboard Card */}
        <section className="px-panel mt-5 w-full max-w-md p-4 bg-[#0d1440]/90 border-[3px] border-[#070c26] shadow-[0_6px_0_#070c26]">
          <div className="flex items-center justify-between border-b border-[#2c4ba8]/60 pb-2">
            <h2 className="font-px text-[10px] sm:text-xs text-[#ffd23e] tracking-wider flex items-center gap-1.5">
              <span>✦</span> TOP HUMAN CHALLENGERS <span>✦</span>
            </h2>
            <Link
              href="/leaderboard"
              className="text-[9px] font-semibold text-[var(--color-px-cyan)] hover:underline"
            >
              View All →
            </Link>
          </div>

          <div className="mt-3 space-y-2">
            {displayRows.map((row, idx) => {
              const isRank1 = row.rank === 1;
              return (
                <div
                  key={`${row.rank}-${row.masked_id_suffix}`}
                  className={`flex items-center justify-between px-3 py-2 border-2 ${isRank1
                    ? 'bg-[#ffc21b] border-[#472200] text-[#472200] font-bold shadow-[0_2px_0_#472200]'
                    : 'bg-[#131c4e] border-[#070c26] text-slate-100'
                    }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isRank1 ? (
                      <img
                        src="/sprites/badge-crown-gold.png"
                        alt="1st"
                        className="h-4 w-4 pixelated shrink-0"
                      />
                    ) : (
                      <span className="font-px text-[10px] w-4 text-center shrink-0 text-slate-400">
                        {row.rank}
                      </span>
                    )}
                    <span className="truncate text-xs font-semibold">
                      {formatPlayerLabel(row, board.mode)}
                    </span>
                  </div>
                  <span className={`font-px tabular text-xs shrink-0 ${isRank1 ? 'text-[#472200]' : 'text-[var(--color-px-yellow)]'}`}>
                    {row.total_score}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* =================================================================== */}
      {/* FOOTER                                                              */}
      {/* =================================================================== */}
      <footer className="relative z-20 w-full px-4 py-3 text-center text-[10px] text-slate-400">
        <p>AIDA Club Fair Challenge · Ajman University</p>
      </footer>
    </main>
  );
}
