import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ClashBar } from '@/components/dashboard/ClashBar';
import type { EventStats } from '@/types';

export const revalidate = 10; // §5 — cached aggregate, never a live row count

async function getStats(): Promise<EventStats | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    const supabase = createClient();
    const { data } = await supabase.from('event_stats_public').select('*').single();
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

export default async function Landing() {
  const stats = await getStats();

  const humanWins = stats?.humanWins ?? 0;
  const aiWins = stats?.aiWins ?? 0;
  const totalContests = humanWins + aiWins;
  const humanPercentage =
    totalContests > 0 ? Math.max(0, Math.min(100, Math.round((humanWins / totalContests) * 100))) : 50;
  const aiPercentage = totalContests > 0 ? 100 - humanPercentage : 50;

  const clashStats = {
    humanTotal: humanWins,
    aiTotal: aiWins,
    humanPercentage,
    aiPercentage,
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-between px-5 py-8 text-white select-none sm:px-6 sm:py-10">
      <header className="w-full max-w-md pt-4 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-sky-400">
          AIDA · AJMAN UNIVERSITY
        </p>
      </header>

      <div className="w-full max-w-md text-center">
        <h1 className="text-5xl font-black leading-none tracking-tight sm:text-7xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
          <span className="text-[var(--color-human-gold)] drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">
            AU
          </span>{' '}
          <span className="text-sky-400">vs</span>{' '}
          <span className="text-white drop-shadow-[0_0_20px_rgba(56,189,248,0.5)]">AI</span>
        </h1>

        <p className="mt-5 text-lg font-bold text-slate-200">
          Can you beat AI in 60 seconds?
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Three rounds. One score. One official attempt.
        </p>

        <Link
          href="/play"
          className="mt-8 block w-full rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 px-8 py-4 text-lg font-black uppercase tracking-wider text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_35px_rgba(245,158,11,0.6)] active:scale-95"
        >
          Start Challenge
        </Link>
      </div>

      <section className="mt-8 w-full max-w-md" aria-label="Live event standings">
        {stats ? (
          <div className="space-y-4">
            {/* Live Clash Bar */}
            <ClashBar stats={clashStats} compact={true} />

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-sky-500/20 bg-[#071333]/80 p-3 text-center backdrop-blur-sm">
                <span className="text-xs uppercase tracking-wider text-slate-400">Challengers</span>
                <p className="tabular mt-1 text-2xl font-black text-white">
                  {stats.totalPlayers}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-[#072418]/80 p-3 text-center backdrop-blur-sm">
                <span className="text-xs uppercase tracking-wider text-emerald-300">Top Score</span>
                <p className="tabular mt-1 text-2xl font-black text-emerald-400">
                  {stats.topScore}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-center text-sm text-slate-400">
            The challenge opens at the AIDA booth.
          </p>
        )}

        <nav className="mt-5 grid grid-cols-2 gap-3">
          <Link
            href="/leaderboard"
            className="rounded-xl border border-sky-500/30 bg-[#0a1535]/60 py-3 text-center text-sm font-bold text-sky-300 transition-all hover:border-sky-400 hover:text-white"
          >
            Leaderboard
          </Link>
          <Link
            href="/club"
            className="rounded-xl border border-amber-500/30 bg-[#1c1206]/60 py-3 text-center text-sm font-bold text-amber-300 transition-all hover:border-amber-400 hover:text-white"
          >
            Join AIDA
          </Link>
        </nav>
      </section>
    </main>
  );
}
