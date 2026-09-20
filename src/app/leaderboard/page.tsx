import Link from 'next/link';
import Image from 'next/image';
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

// Fallback demo rows to show when the database is empty or running offline
const FALLBACK_ROWS: Row[] = [
  { rank: 1, display_name: 'AUScholar', masked_id_suffix: '4821', total_score: 2500, human_win: true },
  { rank: 2, display_name: 'MindMaster', masked_id_suffix: '1903', total_score: 1800, human_win: true },
  { rank: 3, display_name: 'FutureThinker', masked_id_suffix: '8744', total_score: 1250, human_win: true },
  { rank: 4, display_name: 'InnovatorX', masked_id_suffix: '3029', total_score: 980, human_win: true },
  { rank: 5, display_name: 'BlueFalcon', masked_id_suffix: '6112', total_score: 760, human_win: false },
  { rank: 6, display_name: 'QuizWizard', masked_id_suffix: '9420', total_score: 690, human_win: false },
  { rank: 7, display_name: 'NeuronNinja', masked_id_suffix: '5318', total_score: 620, human_win: true },
  { rank: 8, display_name: 'IdeaForge', masked_id_suffix: '2774', total_score: 580, human_win: false },
  { rank: 9, display_name: 'VisionaryV', masked_id_suffix: '8031', total_score: 540, human_win: true },
  { rank: 10, display_name: 'BrightMind', masked_id_suffix: '4199', total_score: 500, human_win: false },
];

async function getData() {
  try {
    const supabase = createAdminSupabase();
    const [{ data: rows }, { data: settings }] = await Promise.all([
      supabase.from('leaderboard_public').select('*').order('rank').limit(50),
      supabase.from('event_settings').select('leaderboard_display').eq('id', 1).single(),
    ]);
    const fetchedRows = (rows ?? []) as Row[];
    return {
      rows: fetchedRows.length > 0 ? fetchedRows : FALLBACK_ROWS,
      isLive: fetchedRows.length > 0,
      mode: (settings?.leaderboard_display ?? 'name_only') as LeaderboardDisplayMode,
    };
  } catch {
    return { rows: FALLBACK_ROWS, isLive: false, mode: 'name_only' as LeaderboardDisplayMode };
  }
}

/** §5 — never render a full student ID or email, whatever the mode. */
function label(row: Row, mode: LeaderboardDisplayMode) {
  if (mode === 'name_only') return row.display_name;
  if (mode === 'masked_id_only') return `••••${row.masked_id_suffix}`;
  return `${row.display_name} · ••••${row.masked_id_suffix}`;
}

export default async function LeaderboardPage() {
  const { rows, mode, isLive } = await getData();

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#05060f] px-4 py-8 text-white">
      {/* Background Cosmic Atmosphere */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-40">
        <Image
          src="/backgrounds/homepage-clean.png"
          alt="Arena Background"
          fill
          priority
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#05060f]/80 via-transparent to-[#05060f]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-xl lg:max-w-3xl">
        {/* Header Section matching Site Pages/17 */}
        <header className="relative mb-6 flex flex-col items-center text-center">
          {/* Top Logo */}
          <div className="inline-block">
            <h2 className="font-['Press_Start_2P',monospace] text-base tracking-wider text-[#00e5ff] drop-shadow-[0_0_12px_rgba(0,229,255,0.7)] sm:text-lg">
              AU <span className="text-white text-xs">VS</span> <span className="text-[#ff3b30] drop-shadow-[0_0_12px_rgba(255,59,48,0.7)]">AI</span>
            </h2>
            <p className="mt-1 font-['Press_Start_2P',monospace] text-[8px] uppercase tracking-[0.25em] text-[#8fa0c0]">
              The 60 Second Challenge
            </p>
          </div>

          {/* Cheering Mascot with Trophy on top right */}
          <div className="absolute -top-3 right-0 sm:right-4 flex items-center gap-1">
            <div className="relative h-16 w-16 sm:h-20 sm:w-20 animate-bounce" style={{ animationDuration: '3s' }}>
              <Image
                src="/sprites/mascot-girl-cheer.png"
                alt="AIDA Mascot"
                fill
                className="object-contain drop-shadow-[0_0_15px_rgba(0,229,255,0.5)]"
              />
            </div>
            <div className="relative -ml-3 h-10 w-10 sm:h-12 sm:w-12">
              <Image
                src="/sprites/trophy.png"
                alt="Trophy"
                fill
                className="object-contain drop-shadow-[0_0_12px_rgba(255,215,0,0.8)]"
              />
            </div>
          </div>

          {/* Title */}
          <h1 className="mt-6 font-['Press_Start_2P',monospace] text-2xl font-black uppercase tracking-wider text-white drop-shadow-[0_0_18px_rgba(0,229,255,0.8)] sm:text-3xl">
            LEADERBOARD
          </h1>
          <p className="mt-2 text-xs font-semibold tracking-[0.2em] text-[#00e5ff] uppercase">
            Brighter Minds • Higher Scores
          </p>

          {!isLive && (
            <span className="mt-2 rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 py-0.5 text-[10px] text-yellow-300">
              Demo Standings (Challenge opens at booth)
            </span>
          )}
        </header>

        {/* Main Card Container */}
        <section className="relative rounded-2xl border-2 border-[#00e5ff]/60 bg-[#080d24]/90 p-4 shadow-[0_0_25px_rgba(0,229,255,0.25)] backdrop-blur-md sm:p-6">
          {/* Table Column Headers */}
          <div className="mb-3 flex items-center px-4 font-['Press_Start_2P',monospace] text-[9px] uppercase tracking-wider text-[#6880aa]">
            <span className="w-14 text-center">RANK</span>
            <span className="flex-1 pl-4">PLAYER</span>
            <span className="w-20 text-right">SCORE</span>
          </div>

          {/* Rows List */}
          <div className="space-y-2.5">
            {rows.map((row) => {
              const isFirst = row.rank === 1;
              const isSecond = row.rank === 2;
              const isThird = row.rank === 3;
              const isPodium = isFirst || isSecond || isThird;

              return (
                <div
                  key={`${row.rank}-${row.masked_id_suffix}`}
                  className={`relative flex items-center rounded-xl px-3.5 py-3 transition-all ${
                    isFirst
                      ? 'border-2 border-[#ffb300] bg-gradient-to-r from-[#ffb300]/25 via-[#ff9100]/15 to-[#ffb300]/20 shadow-[0_0_18px_rgba(255,179,0,0.35)]'
                      : isSecond
                      ? 'border-2 border-[#70b8ff] bg-gradient-to-r from-[#70b8ff]/20 via-[#448aff]/15 to-[#70b8ff]/20 shadow-[0_0_16px_rgba(112,184,255,0.3)]'
                      : isThird
                      ? 'border-2 border-[#cd7f32] bg-gradient-to-r from-[#cd7f32]/20 via-[#cd7f32]/10 to-[#cd7f32]/15 shadow-[0_0_14px_rgba(205,127,50,0.25)]'
                      : 'border border-[#1a2b54] bg-[#0c1538]/70 hover:border-[#00e5ff]/40'
                  }`}
                >
                  {/* Rank Column */}
                  <div className="relative flex w-14 shrink-0 items-center justify-center">
                    {isPodium ? (
                      <div className="relative flex h-9 w-9 items-center justify-center">
                        <Image
                          src="/sprites/laurel-cleaned.png"
                          alt="Laurel"
                          fill
                          className={`object-contain ${
                            isFirst
                              ? 'filter-[sepia(1)_saturate(5)_hue-rotate(5deg)]'
                              : isSecond
                              ? 'filter-[grayscale(1)_brightness(1.4)]'
                              : 'filter-[sepia(0.8)_saturate(2)_hue-rotate(330deg)]'
                          }`}
                        />
                        <span
                          className={`relative z-10 font-['Press_Start_2P',monospace] text-xs font-bold ${
                            isFirst ? 'text-[#ffe57f]' : isSecond ? 'text-[#ffffff]' : 'text-[#ffcc80]'
                          }`}
                        >
                          {row.rank}
                        </span>
                      </div>
                    ) : (
                      <span className="font-['Press_Start_2P',monospace] text-xs font-bold text-[#8fa0c0]">
                        {row.rank}
                      </span>
                    )}
                  </div>

                  {/* Player Column */}
                  <div className="flex min-w-0 flex-1 items-center gap-3 pl-2">
                    {/* User Avatar Circle */}
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                        isFirst
                          ? 'border-[#ffb300] bg-[#ffb300]/20 text-[#ffe57f]'
                          : isSecond
                          ? 'border-[#70b8ff] bg-[#70b8ff]/20 text-[#70b8ff]'
                          : isThird
                          ? 'border-[#cd7f32] bg-[#cd7f32]/20 text-[#ffcc80]'
                          : 'border-[#223a6b] bg-[#121e42] text-[#8fa0c0]'
                      }`}
                    >
                      <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                        <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                      </svg>
                    </div>

                    {/* Player Name */}
                    <div className="min-w-0 flex-1 truncate">
                      <span
                        className={`block truncate text-sm font-bold tracking-wide ${
                          isFirst ? 'text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]' : 'text-slate-100'
                        }`}
                      >
                        {label(row, mode)}
                      </span>
                      {row.human_win && (
                        <span className="inline-block text-[9px] font-semibold text-[#00e5ff] tracking-wider">
                          HUMAN ADVANTAGE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score Column */}
                  <div className="w-20 shrink-0 text-right">
                    <span
                      className={`font-['Press_Start_2P',monospace] text-sm font-bold sm:text-base ${
                        isFirst
                          ? 'text-[#ffea00] drop-shadow-[0_0_8px_rgba(255,234,0,0.8)]'
                          : isSecond
                          ? 'text-[#e0f7fa] drop-shadow-[0_0_8px_rgba(224,247,250,0.8)]'
                          : isThird
                          ? 'text-[#ffb74d] drop-shadow-[0_0_6px_rgba(255,183,77,0.7)]'
                          : 'text-[#00e5ff]'
                      }`}
                    >
                      {row.total_score}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Button matching Site Pages/17 */}
          <div className="mt-6">
            <Link
              href="/play"
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#00b0ff] to-[#0081cb] py-3.5 font-['Press_Start_2P',monospace] text-xs uppercase tracking-wider text-white shadow-[0_0_20px_rgba(0,176,255,0.6)] transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(0,176,255,0.9)] active:scale-[0.98]"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M4 19h4v-7H4v7zm6 0h4V5h-4v14zm6 0h4v-3h-4v3z" />
              </svg>
              <span>PLAY &amp; CLAIM YOUR RANK →</span>
            </Link>
          </div>
        </section>

        {/* Footer info matching mock */}
        <div className="mt-8 flex flex-col items-center gap-4 text-center">
          <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.25em] text-[#6b82a8] uppercase">
            <span>HUMAN CREATIVITY</span>
            <span className="text-sm text-[#00e5ff]">♾️</span>
            <span>AI POSSIBILITIES</span>
          </p>

          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="font-['Press_Start_2P',monospace] text-[10px] text-[#00e5ff] underline underline-offset-4 hover:text-white"
            >
              ← BACK HOME
            </Link>
            <Link
              href="/club"
              className="font-['Press_Start_2P',monospace] text-[10px] text-[#ffcc00] underline underline-offset-4 hover:text-white"
            >
              JOIN AIDA →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
