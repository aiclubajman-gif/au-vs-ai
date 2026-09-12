import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
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

  return (
    <main className="flex min-h-dvh flex-col items-center justify-between px-6 py-10">
      <header className="w-full max-w-md pt-6 text-center">
        <p className="text-xs tracking-[0.35em] text-[var(--color-cyan-dim)]">
          AIDA · AJMAN UNIVERSITY
        </p>
      </header>

      <div className="w-full max-w-md text-center">
        <h1 className="text-6xl font-bold leading-none tracking-tight sm:text-7xl">
          AU <span className="text-[var(--color-cyan)]">vs</span> AI
        </h1>
        <p className="mt-5 text-lg text-[var(--color-muted)]">
          Can you beat AI in 60 seconds?
        </p>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Three rounds. One score. One attempt.
        </p>

        <Link
          href="/play"
          className="mt-10 block w-full rounded-xl bg-[var(--color-cyan)] px-8 py-5 text-lg font-semibold text-[var(--color-void)] transition-colors hover:bg-[var(--color-cyan-bright)]"
        >
          Start challenge
        </Link>
      </div>

      <section className="w-full max-w-md" aria-label="Live event standings">
        {stats ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Humans" value={stats.humanWins} tone="win" />
              <Stat label="AI" value={stats.aiWins} tone="lose" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Stat label="Challengers" value={stats.totalPlayers} />
              <Stat label="Top score" value={stats.topScore} />
            </div>
          </>
        ) : (
          <p className="text-center text-sm text-[var(--color-muted)]">
            The challenge opens at the AIDA booth.
          </p>
        )}

        <nav className="mt-6 grid grid-cols-2 gap-3">
          <Link
            href="/leaderboard"
            className="rounded-lg border border-[var(--color-edge)] py-3 text-center text-sm transition-colors hover:border-[var(--color-cyan-dim)]"
          >
            Leaderboard
          </Link>
          <Link
            href="/club"
            className="rounded-lg border border-[var(--color-edge)] py-3 text-center text-sm transition-colors hover:border-[var(--color-cyan-dim)]"
          >
            Join AIDA
          </Link>
        </nav>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'win' | 'lose';
}) {
  const color =
    tone === 'win'
      ? 'text-[var(--color-win)]'
      : tone === 'lose'
        ? 'text-[var(--color-lose)]'
        : 'text-[var(--color-ink)]';

  return (
    <div className="rounded-lg border border-[var(--color-edge)] bg-[var(--color-navy)] px-4 py-3">
      <p className="text-xs tracking-wider text-[var(--color-muted)]">{label}</p>
      <p className={`tabular mt-1 text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
