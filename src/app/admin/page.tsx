import { requireAdmin } from '@/lib/api/admin-guard';
import { createAdminSupabase } from '@/lib/supabase/server';
import { isRound1FormatLocked } from '@/lib/api/format-lock';
import {
  AdminPanel,
  type AdminStats,
  type AdminSettings,
  type AttemptRow,
  type BankHealth,
} from '@/components/admin/AdminPanel';

export const dynamic = 'force-dynamic';

/**
 * Access is decided here, on the server, before any data is fetched. An
 * unauthorized visitor gets a plain message and no data whatsoever — not a
 * hidden UI (§30).
 */
export default async function AdminPage() {
  const auth = await requireAdmin();

  if (!auth.ok) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-bold">Not authorised</h1>
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            This page is for AIDA board members. Sign in at /play with an approved
            account.
          </p>
        </div>
      </main>
    );
  }

  const supabase = createAdminSupabase();

  const [
    { data: settingsRow },
    { data: attemptRows },
    { count: registrations },
    { count: datasetCount },
    { count: imageBank },
  ] = await Promise.all([
    supabase.from('event_settings').select('*').eq('id', 1).single(),
    supabase
      .from('attempts')
      .select('id, status, total_score, valid_for_prize, started_at, user_id, is_test')
      .order('started_at', { ascending: false })
      .limit(40),
    supabase.from('club_registrations').select('id', { count: 'exact', head: true }),
    supabase.from('dataset_responses').select('id', { count: 'exact', head: true }),
    supabase.from('round1_images').select('id', { count: 'exact', head: true }).eq('active', true),
  ]);

  // Placeholder images are active and would be served to real students.
  // Surfaced loudly rather than left to be remembered on the day.
  const { count: testImages } = await supabase
    .from('round1_images')
    .select('id', { count: 'exact', head: true })
    .eq('active', true)
    .eq('is_test', true);

  const rows = attemptRows ?? [];
  const userIds = [...new Set(rows.map((r) => r.user_id))];

  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id, full_name, student_id').in('id', userIds)
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const real = rows.filter((r) => !r.is_test);
  const completed = real.filter((r) => r.status === 'completed');

  const stats: AdminStats = {
    total: real.length,
    completed: completed.length,
    inProgress: real.filter((r) => r.status === 'in_progress').length,
    abandoned: real.filter((r) => r.status === 'abandoned').length,
    humanWins: 0,
    aiWins: 0,
    averageScore: completed.length
      ? Math.round(completed.reduce((s, r) => s + (r.total_score ?? 0), 0) / completed.length)
      : 0,
    topScore: completed.reduce((m, r) => Math.max(m, r.total_score ?? 0), 0),
    registrations: registrations ?? 0,
    datasetResponses: datasetCount ?? 0,
    imageBank: imageBank ?? 0,
    testImages: testImages ?? 0,
  };

  // Humans vs AI comes from the aggregate view so it counts the whole event,
  // not just the 40 most recent attempts shown below.
  const { data: eventStats } = await supabase
    .from('event_stats_public')
    .select('human_wins, ai_wins')
    .single();
  stats.humanWins = eventStats?.human_wins ?? 0;
  stats.aiWins = eventStats?.ai_wins ?? 0;

  const formatLocked = await isRound1FormatLocked(supabase);

  const { data: healthRow } = await supabase.rpc('round1_bank_health');
  const bankHealth: BankHealth | null = healthRow
    ? {
        active: healthRow.active,
        real: healthRow.real,
        ai: healthRow.ai,
        imagesPerGame: healthRow.images_per_game ?? null,
        playable: healthRow.playable === true,
        playableByImageCount: healthRow.playable_by_image_count ?? {},
      }
    : null;

  const settings: AdminSettings = {
    challengeOpen: settingsRow.challenge_open,
    newGamesPaused: settingsRow.new_games_paused,
    entriesClosed: settingsRow.entries_closed,
    humanWinThreshold: settingsRow.human_win_threshold,
    round1ImageCount: settingsRow.round1_image_count,
    round1MsPerImage: settingsRow.round1_ms_per_image,
    round2DrawMs: settingsRow.round2_draw_ms,
    round3Ms: settingsRow.round3_ms,
    round3ScoringTolerance: Number(settingsRow.round3_scoring_tolerance),
    round3ToleranceExponent: settingsRow.round3_tolerance_exponent,
    round2RecognitionThreshold: settingsRow.round2_recognition_threshold,
  };

  const attempts: AttemptRow[] = rows.map((r) => {
    const p = profileMap.get(r.user_id);
    return {
      id: r.id,
      name: p?.full_name ?? 'Unknown',
      maskedId: (p?.student_id ?? '').slice(-4),
      status: r.status,
      totalScore: r.total_score,
      validForPrize: r.valid_for_prize,
      startedAt: r.started_at,
    };
  });

  return (
    <AdminPanel
      email={auth.email}
      initialStats={stats}
      initialSettings={settings}
      initialAttempts={attempts}
      initialFormatLocked={formatLocked}
      bankHealth={bankHealth}
    />
  );
}
