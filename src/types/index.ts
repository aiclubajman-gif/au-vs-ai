/** AU vs AI — shared domain types. Mirrors supabase/migrations/0001+0002. */

export type AttemptStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'abandoned'
  | 'invalidated';

export type VerificationMethod = 'email_otp' | 'staff_override';

/** Round 1 answer. The student is shown ONE image and picks one of these. */
export type ImageLabel = 'real' | 'ai_generated';

export type LeaderboardDisplayMode = 'name_only' | 'masked_id_only' | 'name_and_masked_id';

/**
 * Every email domain Ajman University issues to students. Both are accepted at
 * sign-in; the first is the one shown in placeholders and hints.
 */
export const AU_EMAIL_DOMAINS = ['ajmanuni.ac.ae', 'ajman.ac.ae'] as const;

/** The domain used in examples and placeholder text. */
export const AU_EMAIL_DOMAIN = AU_EMAIL_DOMAINS[0];

// ---------------------------------------------------------------------------
// Event settings
// ---------------------------------------------------------------------------
export interface EventSettings {
  challengeOpen: boolean;
  newGamesPaused: boolean;
  entriesClosed: boolean;
  maintenanceMessage: string | null;

  round1MsPerImage: number;
  round2DrawMs: number;
  round3Ms: number;

  humanWinThreshold: number;
  round2RecognitionThreshold: number;
  round2SpeedBonusMax: number;
  /** Hidden. Independent of the slider range. A guess this far away scores 0. */
  round3ScoringTolerance: number;
  round3ToleranceExponent: number;

  leaderboardDisplay: LeaderboardDisplayMode;
  collectCollege: boolean;
  abandonAfterMinutes: number;
}

// ---------------------------------------------------------------------------
// The frozen assignment sent to the browser.
// Deliberately contains NO answers, NO labels and NO scores.
// ---------------------------------------------------------------------------
export interface Round1Slot {
  slot: number;
  imageId: string;
  storagePath: string;
  answered: boolean;
}

export interface Round2Assignment {
  classKey: string;
  displayName: string;
  submitted: boolean;
}

export interface Round3Assignment {
  prompt: string;
  /** Slider bounds. Selectable range only — these do NOT affect scoring. */
  minValue: number;
  maxValue: number;
  step: number;
  unit: string | null;
  answered: boolean;
}

export interface AttemptAssignment {
  attemptId: string;
  status: AttemptStatus;
  currentRound: number;
  startedAt: string;
  resumed: boolean;
  round1: Round1Slot[];
  round2: Round2Assignment;
  round3: Round3Assignment;
}

// ---------------------------------------------------------------------------
// Result. §22: round scores are NOT included in what the student receives.
// ---------------------------------------------------------------------------
export interface PublicAttemptResult {
  attemptId: string;
  totalScore: number;
  humanWin: boolean;
  rank: number;
  percentileBeaten: number;
  totalPlayers: number;
}

/** Admin-only view, includes everything hidden from the student. */
export interface AdminAttemptDetail extends PublicAttemptResult {
  userId: string;
  fullName: string;
  studentId: string;
  round1Score: number;
  round2Score: number;
  round3Score: number;
  r1CorrectCount: number;
  elapsedMs: number | null;
  validForPrize: boolean;
  invalidReason: string | null;
  verificationMethod: VerificationMethod;
  idVerified: boolean;
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------
export interface LeaderboardRow {
  rank: number;
  displayName: string;
  maskedIdSuffix: string;
  totalScore: number;
  humanWin: boolean;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export interface EventStats {
  totalPlayers: number;
  humanWins: number;
  aiWins: number;
  topScore: number;
  averageScore: number;
  playingNow: number;
}

export interface College {
  id: number;
  name: string;
}

// ---------------------------------------------------------------------------
// Structured error codes surfaced to the UI (§46)
// ---------------------------------------------------------------------------
export const ERROR_CODES = {
  CHALLENGE_CLOSED: 'CHALLENGE_CLOSED',
  NEW_GAMES_PAUSED: 'NEW_GAMES_PAUSED',
  PROFILE_REQUIRED: 'PROFILE_REQUIRED',
  ALREADY_COMPLETED: 'ALREADY_COMPLETED',
  ATTEMPT_NOT_FOUND: 'ATTEMPT_NOT_FOUND',
  ATTEMPT_NOT_COMPLETED: 'ATTEMPT_NOT_COMPLETED',
  NO_DRAWING_CLASSES: 'NO_DRAWING_CLASSES',
  NO_ROUND3_QUESTION: 'NO_ROUND3_QUESTION',
  ROUND1_BANK_TOO_SMALL: 'ROUND1_BANK_TOO_SMALL',
  ROUND1_BANK_UNBALANCED: 'ROUND1_BANK_UNBALANCED',
  INVALID_DOMAIN: 'INVALID_DOMAIN',
  ROUND_ALREADY_ANSWERED: 'ROUND_ALREADY_ANSWERED',
  MODEL_UNAVAILABLE: 'MODEL_UNAVAILABLE',
  UNAUTHORIZED: 'UNAUTHORIZED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
