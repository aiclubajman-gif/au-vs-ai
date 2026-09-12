import 'server-only';

import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server';
import type { EventSettings } from '@/types';

/**
 * Shared guards for every gameplay route.
 *
 * Each round route must independently prove: the caller is signed in, the
 * attempt belongs to them, and it is still in progress. None of that can be
 * inferred from the request body, because the body comes from the student's
 * phone (§39).
 */

export interface AttemptRow {
  id: string;
  user_id: string;
  status: string;
  current_round: number;
  started_at: string;
  round2_class_id: number;
  round3_question_id: string;
  round1_score: number | null;
  round2_score: number | null;
  round3_score: number | null;
  total_score: number | null;
  is_test: boolean;
}

export type GuardResult =
  | { ok: true; userId: string; attempt: AttemptRow }
  | { ok: false; code: string; status: number };

export async function requireOwnedAttempt(attemptId: string): Promise<GuardResult> {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) return { ok: false, code: 'UNAUTHORIZED', status: 401 };

  const admin = createAdminSupabase();
  const { data: attempt } = await admin
    .from('attempts')
    .select(
      'id, user_id, status, current_round, started_at, round2_class_id, round3_question_id, round1_score, round2_score, round3_score, total_score, is_test',
    )
    .eq('id', attemptId)
    .maybeSingle();

  if (!attempt) return { ok: false, code: 'ATTEMPT_NOT_FOUND', status: 404 };

  // Ownership is checked server-side; a student cannot submit into another
  // student's attempt by guessing its id.
  if (attempt.user_id !== auth.user.id) {
    return { ok: false, code: 'UNAUTHORIZED', status: 403 };
  }

  return { ok: true, userId: auth.user.id, attempt: attempt as AttemptRow };
}

/** Loads the single settings row and maps it to camelCase. */
export async function loadSettings(): Promise<EventSettings> {
  const admin = createAdminSupabase();
  const { data } = await admin.from('event_settings').select('*').eq('id', 1).single();

  return {
    challengeOpen: data.challenge_open,
    newGamesPaused: data.new_games_paused,
    entriesClosed: data.entries_closed,
    maintenanceMessage: data.maintenance_message,
    round1MsPerImage: data.round1_ms_per_image,
    round2DrawMs: data.round2_draw_ms,
    round3Ms: data.round3_ms,
    humanWinThreshold: data.human_win_threshold,
    round2RecognitionThreshold: data.round2_recognition_threshold,
    round2SpeedBonusMax: data.round2_speed_bonus_max,
    round3ScoringTolerance: Number(data.round3_scoring_tolerance),
    round3ToleranceExponent: data.round3_tolerance_exponent,
    leaderboardDisplay: data.leaderboard_display,
    collectCollege: data.collect_college,
    abandonAfterMinutes: data.abandon_after_minutes,
  };
}
