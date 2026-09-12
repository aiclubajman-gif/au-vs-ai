import Link from 'next/link';
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

async function getData() {
  try {
    const supabase = createAdminSupabase();
    const [{ data: rows }, { data: settings }] = await Promise.all([
      supabase.from('leaderboard_public').select('*').order('rank').limit(50),
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
    <main className="min-h-dvh px-5 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {rows.length > 0
              ? `Top ${rows.length} of the challenge`
              : 'No scores yet. The challenge opens at the AIDA booth.'}
          </p>
        </div>

        {rows.length > 0 && (
          <ol className="mt-8 space-y-2">
            {rows.map((row) => {
              const podium = row.rank <= 3;
              return (
                <li
                  key={`${row.rank}-${row.masked_id_suffix}`}
                  className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${
                    podium
                      ? 'border-[var(--color-cyan-dim)] bg-[var(--color-navy)]'
                      : 'border-[var(--color-edge)] bg-[var(--color-navy)]/60'
                  }`}
                >
                  <span
                    className={`tabular w-8 shrink-0 text-center text-lg font-bold ${
                      podium ? 'text-[var(--color-cyan)]' : 'text-[var(--color-muted)]'
                    }`}
                  >
                    {row.rank}
                  </span>

                  <span className="min-w-0 flex-1 truncate text-sm">{label(row, mode)}</span>

                  <span
                    aria-label={row.human_win ? 'Human win' : 'AI win'}
                    className={`shrink-0 text-xs ${
                      row.human_win ? 'text-[var(--color-win)]' : 'text-[var(--color-muted)]'
                    }`}
                  >
                    {row.human_win ? 'HUMAN' : 'AI'}
                  </span>

                  <span className="tabular w-14 shrink-0 text-right font-bold">
                    {row.total_score}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        <Link
          href="/"
          className="mt-8 block text-center text-sm text-[var(--color-cyan)] underline underline-offset-4"
        >
          Back
        </Link>
      </div>
    </main>
  );
}
