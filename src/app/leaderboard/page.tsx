import Link from 'next/link';
import { createAdminSupabase } from '@/lib/supabase/server';
import { ClashBar } from '@/components/dashboard/ClashBar';
import type { LeaderboardDisplayMode } from '@/types';

export const revalidate = 5;

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
    const [{ data: rows }, { data: settings }, { data: stats }] = await Promise.all([
      supabase.from('leaderboard_public').select('*').order('rank').limit(50),
      supabase.from('event_settings').select('leaderboard_display').eq('id', 1).single(),
      supabase.from('event_stats_public').select('human_wins, ai_wins, total_players').maybeSingle(),
    ]);

    const humanWins = Number(stats?.human_wins ?? 0);
    const aiWins = Number(stats?.ai_wins ?? 0);
    const totalContests = humanWins + aiWins;
    const humanPercentage =
      totalContests > 0 ? Math.max(0, Math.min(100, Math.round((humanWins / totalContests) * 100))) : 50;
    const aiPercentage = totalContests > 0 ? 100 - humanPercentage : 50;

    return {
      rows: (rows ?? []) as Row[],
      mode: (settings?.leaderboard_display ?? 'name_and_masked_id') as LeaderboardDisplayMode,
      clash: {
        humanTotal: humanWins,
        aiTotal: aiWins,
        humanPercentage,
        aiPercentage,
      },
    };
  } catch {
    return {
      rows: [] as Row[],
      mode: 'name_and_masked_id' as LeaderboardDisplayMode,
      clash: { humanTotal: 0, aiTotal: 0, humanPercentage: 50, aiPercentage: 50 },
    };
  }
}

/** §5 — never render a full student ID or email, whatever the mode. */
function label(row: Row, mode: LeaderboardDisplayMode) {
  if (mode === 'name_only') return row.display_name;
  if (mode === 'masked_id_only') return `••••${row.masked_id_suffix}`;
  return `${row.display_name} · ••••${row.masked_id_suffix}`;
}

export default async function LeaderboardPage() {
  const { rows, mode, clash } = await getData();

  return (
    <main className="min-h-dvh bg-[var(--color-void)] px-4 py-6 text-white sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-xl">
        {/* Header Branding */}
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-400">
            AIDA · AU vs AI
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-wider uppercase italic sm:text-4xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            <span className="text-[var(--color-human-gold)]">HUMANS</span>{' '}
            <span className="text-sky-400">vs</span>{' '}
            <span className="text-white">AI</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Official booth rankings · Updated continuously
          </p>
        </div>

        {/* Dynamic Clash Bar (Mobile Compact) */}
        <div className="mt-5">
          <ClashBar stats={clash} compact={true} />
        </div>

        {/* Leaderboard Table Container */}
        <div className="cyber-card mt-6 rounded-2xl p-4 sm:rounded-3xl sm:p-6">
          <h2 className="mb-4 text-center text-lg font-black tracking-wide text-white sm:text-xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            Top Human Challengers
          </h2>

          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No scores yet. The challenge opens at the AIDA booth.
            </p>
          ) : (
            <ol className="space-y-2">
              {rows.map((row) => {
                const isRank1 = row.rank === 1;
                const isRank2 = row.rank === 2;
                const isRank3 = row.rank === 3;

                // Rank 1 — Gold Pill
                if (isRank1) {
                  return (
                    <li
                      key={`${row.rank}-${row.masked_id_suffix}`}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 sm:rounded-2xl transition-transform hover:scale-[1.01]"
                      style={{
                        background: 'linear-gradient(180deg, #fef08a 0%, #f59e0b 50%, #d97706 100%)',
                        boxShadow:
                          '0 0 20px rgba(245, 158, 11, 0.55), inset 0 1px 2px rgba(255, 255, 255, 0.6)',
                      }}
                    >
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-950/20 text-center text-base font-black text-amber-950">
                        1
                      </span>
                      <span className="min-w-0 flex-1 truncate font-black text-slate-950 text-sm sm:text-base">
                        {label(row, mode)}
                      </span>
                      <span className="shrink-0 rounded-md bg-amber-950/15 px-2 py-0.5 text-[10px] font-black uppercase text-amber-950">
                        {row.human_win ? 'AU WIN' : 'AI'}
                      </span>
                      <span className="tabular shrink-0 text-right font-black text-slate-950 text-base sm:text-lg">
                        {row.total_score}
                      </span>
                    </li>
                  );
                }

                // Rank 2 & 3 — Silver & Bronze Metallic Pills
                if (isRank2 || isRank3) {
                  const bg = isRank2
                    ? 'linear-gradient(180deg, #f1f5f9 0%, #cbd5e1 50%, #64748b 100%)'
                    : 'linear-gradient(180deg, #ffedd5 0%, #fb923c 50%, #9a3412 100%)';
                  const textColor = isRank2 ? 'text-slate-900' : 'text-amber-950';

                  return (
                    <li
                      key={`${row.rank}-${row.masked_id_suffix}`}
                      className="flex items-center gap-3 rounded-xl px-4 py-2.5 sm:rounded-2xl transition-transform hover:scale-[1.01]"
                      style={{
                        background: bg,
                        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.5), inset 0 1px 2px rgba(255, 255, 255, 0.5)',
                      }}
                    >
                      <span className={`tabular w-7 shrink-0 text-center text-sm font-black ${textColor}`}>
                        {row.rank}
                      </span>
                      <span className={`min-w-0 flex-1 truncate font-bold text-sm sm:text-base ${textColor}`}>
                        {label(row, mode)}
                      </span>
                      <span className={`shrink-0 rounded-md bg-black/10 px-2 py-0.5 text-[10px] font-black uppercase ${textColor}`}>
                        {row.human_win ? 'AU WIN' : 'AI'}
                      </span>
                      <span className={`tabular shrink-0 text-right font-black text-base ${textColor}`}>
                        {row.total_score}
                      </span>
                    </li>
                  );
                }

                // Ranks 4+ — Cyber Blue Pills
                return (
                  <li
                    key={`${row.rank}-${row.masked_id_suffix}`}
                    className="flex items-center gap-3 rounded-xl border border-sky-500/25 px-4 py-2.5 sm:rounded-2xl transition-transform hover:scale-[1.01]"
                    style={{
                      background: 'linear-gradient(180deg, #0d2253 0%, #071333 100%)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(56, 189, 248, 0.2)',
                    }}
                  >
                    <span className="tabular w-7 shrink-0 text-center text-sm font-bold text-sky-400">
                      {row.rank}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-100">
                      {label(row, mode)}
                    </span>
                    <span
                      className={`shrink-0 text-[10px] font-bold ${
                        row.human_win ? 'text-amber-400' : 'text-sky-400'
                      }`}
                    >
                      {row.human_win ? 'AU WIN' : 'AI'}
                    </span>
                    <span className="tabular shrink-0 text-right font-bold text-white text-sm sm:text-base">
                      {row.total_score}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Action Navigation */}
        <div className="mt-8 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex-1 rounded-xl border border-slate-700 bg-slate-900/60 py-3.5 text-center text-sm font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
          >
            ← Back Home
          </Link>
          <Link
            href="/play"
            className="flex-1 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 py-3.5 text-center text-sm font-black text-slate-950 shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-transform hover:scale-[1.02] active:scale-95"
          >
            Play Challenge →
          </Link>
        </div>
      </div>
    </main>
  );
}
