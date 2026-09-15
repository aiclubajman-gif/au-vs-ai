/** POST /api/admin/settings — event control and tunables (§41). */
import { createAdminSupabase } from '@/lib/supabase/server';
import { requireAdmin, logAdminAction } from '@/lib/api/admin-guard';
import { settingsUpdateSchema } from '@/lib/validation';
import { ok, fail, messageFor, codeFromPgError } from '@/lib/api/respond';
import { ROUND1_PRESETS } from '@/lib/timing';

const COLUMN: Record<string, string> = {
  challengeOpen: 'challenge_open',
  newGamesPaused: 'new_games_paused',
  entriesClosed: 'entries_closed',
  humanWinThreshold: 'human_win_threshold',
  round2RecognitionThreshold: 'round2_recognition_threshold',
  round3ScoringTolerance: 'round3_scoring_tolerance',
  round3ToleranceExponent: 'round3_tolerance_exponent',
  leaderboardDisplay: 'leaderboard_display',
  collectCollege: 'collect_college',
};

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return fail('UNAUTHORIZED', messageFor('UNAUTHORIZED'), 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail('SERVER_ERROR', messageFor('SERVER_ERROR'), 400);
  }

  const parsed = settingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return fail('VALIDATION', parsed.error.issues[0]?.message ?? 'Invalid value.', 400);
  }

  const { round1Preset, ...rest } = parsed.data;

  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined && COLUMN[key]) patch[COLUMN[key]] = value;
  }

  // A preset sets image count and per-image time together, in the same UPDATE,
  // so the pair can never be half-changed. The database still checks the pair,
  // the 60-second total, and the lock once real games exist (migration 0015).
  if (round1Preset) {
    const preset = ROUND1_PRESETS[round1Preset];
    patch.round1_image_count = preset.imageCount;
    patch.round1_ms_per_image = preset.msPerImage;
  }

  if (Object.keys(patch).length === 0) return ok({ updated: false });

  const admin = createAdminSupabase();
  const { error } = await admin.from('event_settings').update(patch).eq('id', 1);
  if (error) {
    if (codeFromPgError(error) === 'ROUND1_FORMAT_LOCKED') {
      return fail('ROUND1_FORMAT_LOCKED', messageFor('ROUND1_FORMAT_LOCKED'), 409);
    }
    return fail('SERVER_ERROR', error.message, 500);
  }

  await logAdminAction(auth.userId, auth.email, 'settings_update', 'event_settings', '1', patch);

  return ok({ updated: true, patch });
}
