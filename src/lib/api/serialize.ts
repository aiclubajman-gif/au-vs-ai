/**
 * Postgres returns snake_case; the app speaks camelCase.
 *
 * Reading `raw.currentRound` off a payload that actually says `current_round`
 * yields undefined rather than throwing, so the mistake surfaces as wrong
 * behaviour instead of an error. That exact bug sent resuming students back to
 * Round 1. Every RPC payload goes through a mapper here, and the mappers are
 * unit tested against real payload shapes.
 */

import type { AttemptAssignment, AttemptTiming, PublicAttemptResult, Round1Slot } from '@/types';

type Raw = Record<string, unknown>;

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

function bool(v: unknown): boolean {
  return v === true;
}

/** A positive whole number of milliseconds, or null. */
function ms(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * The attempt's frozen timing. Unlike every other field here there is NO
 * default: a game played on made-up timing is exactly what the snapshot
 * exists to prevent, so anything incomplete maps to null and is refused.
 */
function toTiming(raw: unknown): AttemptTiming | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Raw;
  const round1MsPerImage = ms(t.round1_ms_per_image);
  const round2DrawMs = ms(t.round2_draw_ms);
  const round3Ms = ms(t.round3_ms);
  if (round1MsPerImage === null || round2DrawMs === null || round3Ms === null) return null;
  return { round1MsPerImage, round2DrawMs, round3Ms };
}

export function toAssignment(raw: unknown): AttemptAssignment {
  const r = (raw ?? {}) as Raw;

  const round1: Round1Slot[] = Array.isArray(r.round1)
    ? (r.round1 as Raw[]).map((s) => ({
        slot: num(s.slot, 1),
        imageId: str(s.image_id),
        storagePath: str(s.storage_path),
        answered: bool(s.answered),
      }))
    : [];

  const r2 = (r.round2 ?? {}) as Raw;
  const r3 = (r.round3 ?? {}) as Raw;

  return {
    attemptId: str(r.attempt_id),
    status: str(r.status, 'in_progress') as AttemptAssignment['status'],
    // The field that caused the resume bug.
    currentRound: num(r.current_round, 1),
    startedAt: str(r.started_at),
    resumed: bool(r.resumed),
    timing: toTiming(r.timing),
    round1,
    round2: {
      classKey: str(r2.class_key),
      displayName: str(r2.display_name),
      submitted: bool(r2.submitted),
    },
    round3: {
      prompt: str(r3.prompt),
      minValue: num(r3.min_value, 0),
      maxValue: num(r3.max_value, 100),
      step: num(r3.step, 1),
      unit: typeof r3.unit === 'string' ? r3.unit : null,
      answered: bool(r3.answered),
    },
  };
}

/**
 * Marks Round 1 slots as answered when the server recorded a submission.
 *
 * get_attempt_assignment() derives `answered` from selected_answer, which is
 * NULL for a timed-out slot. Without this, a student who timed out and then
 * refreshed would be sent back into Round 1. Only ever turns a flag on, so a
 * failed lookup falls back to the database's own view.
 */
export function markAnsweredSlots(a: AttemptAssignment, answeredSlots: number[]): AttemptAssignment {
  if (answeredSlots.length === 0) return a;
  const done = new Set(answeredSlots);
  return {
    ...a,
    round1: a.round1.map((s) => (done.has(s.slot) ? { ...s, answered: true } : s)),
  };
}

export function toResult(raw: unknown): PublicAttemptResult {
  const r = (raw ?? {}) as Raw;
  return {
    attemptId: str(r.attempt_id),
    totalScore: num(r.total_score),
    humanWin: bool(r.human_win),
    rank: num(r.rank, 1),
    percentileBeaten: num(r.percentile_beaten),
    totalPlayers: num(r.total_players),
  };
}

/**
 * Where a resuming student should land.
 *
 * Derived from the frozen server state, never from anything the browser
 * remembers, so closing the tab mid-round cannot rewind progress.
 */
export function resumeStep(a: AttemptAssignment): 'round1' | 'round2' | 'round3' | 'submitting' {
  if (a.status === 'completed') return 'submitting';

  // Per-round flags beat current_round: if every Round 1 slot is answered but
  // the pointer was never advanced (connection dropped at the wrong instant),
  // the student still moves forward rather than replaying answered questions.
  const r1Done = a.round1.length > 0 && a.round1.every((s) => s.answered);

  if (!r1Done) return 'round1';
  if (!a.round2.submitted) return 'round2';
  if (!a.round3.answered) return 'round3';
  return 'submitting';
}
