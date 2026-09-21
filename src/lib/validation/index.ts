/** AU vs AI — input validation (§39). Every server route validates with these. */

import { z } from 'zod';
import { ROUND1_SLOTS } from '@/lib/scoring';
import { AU_EMAIL_DOMAIN } from '@/types';

// ---------------------------------------------------------------------------
// AU email (§3)
// ---------------------------------------------------------------------------

const AU_EMAIL_PATTERN = new RegExp(
  `^[^@\\s]+@${AU_EMAIL_DOMAIN.replace(/\./g, '\\.')}$`,
);

/** Lowercase and trim. Always call before validating or storing. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isAuEmail(raw: string): boolean {
  return AU_EMAIL_PATTERN.test(normalizeEmail(raw));
}

/**
 * Student ID is the local part of the AU email (§5).
 * '202310421@ajmanuni.ac.ae' -> '202310421'
 */
export function extractStudentId(email: string): string {
  return normalizeEmail(email).split('@')[0];
}

/** Last four characters, for the leaderboard's masked suffix. */
export function maskStudentId(studentId: string): string {
  return studentId.slice(-4);
}

export const auEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5)
  .max(120)
  .refine((v) => AU_EMAIL_PATTERN.test(v), {
    message: 'Use your Ajman University email address to play.',
  });

// ---------------------------------------------------------------------------
// Name (§4)
// ---------------------------------------------------------------------------

/**
 * Deliberately small and conservative. This list is checked against the
 * whole name and against each word, and it is easier to extend from the
 * admin panel than to get perfect here.
 */
const BLOCKED_NAME_TERMS = [
  'admin', 'administrator', 'moderator', 'aida', 'official', 'test',
  'null', 'undefined', 'anonymous',
];

export const nameSchema = z
  .string()
  .trim()
  .min(2, { message: 'Enter your name.' })
  .max(60, { message: 'That name is too long.' })
  // Letters (incl. Arabic), spaces, hyphens, apostrophes and dots only.
  .regex(/^[\p{L}][\p{L}\s'.-]*$/u, { message: 'Use letters only.' })
  .refine((v) => !v.includes('@'), { message: "Don't use your email as your name." })
  .refine(
    (v) => {
      const lower = v.toLowerCase();
      return !BLOCKED_NAME_TERMS.some(
        (t) => lower === t || lower.split(/\s+/).includes(t),
      );
    },
    { message: 'Please enter your real name.' },
  );

// ---------------------------------------------------------------------------
// Gameplay submissions
// ---------------------------------------------------------------------------

export const otpSchema = z.string().trim().regex(/^\d{6}$/, {
  message: 'Enter the 6-digit code.',
});

export const profileSetupSchema = z.object({
  fullName: nameSchema,
  collegeId: z.number().int().positive().nullable().optional(),
});

export const round1SubmitSchema = z.object({
  attemptId: z.uuid(),
  slot: z.number().int().min(1).max(ROUND1_SLOTS),
  /** null = the timer ran out with no choice made. Scores zero. */
  selectedAnswer: z.enum(['real', 'ai_generated']).nullable(),
  responseTimeMs: z.number().int().min(0).max(120_000),
  idempotencyKey: z.uuid(),
});

export const round2SubmitSchema = z.object({
  attemptId: z.uuid(),
  /** Confidence on the ASSIGNED class. Server re-clamps regardless. */
  targetConfidence: z.number().min(0).max(1),
  topPredictions: z
    .array(z.object({ label: z.string().max(40), confidence: z.number().min(0).max(1) }))
    .max(5),
  drawTimeMs: z.number().int().min(0).max(120_000),
  /** 784 bytes, base64. §17 — the normalized bitmap only, not the raw drawing. */
  bitmap28: z.string().max(2048).optional(),
  idempotencyKey: z.uuid(),
});

export const round3SubmitSchema = z.object({
  attemptId: z.uuid(),
  guess: z.number().finite(),
  idempotencyKey: z.uuid(),
});

// ---------------------------------------------------------------------------
// Club registration (§27) — consent must be explicitly true
// ---------------------------------------------------------------------------

export const INTEREST_OPTIONS = [
  'Learn AI',
  'Data Science',
  'Build Projects',
  'Hackathons / Competitions',
  'Research',
  'Networking',
  'Organize Events',
  'Teach / Mentor',
] as const;

export const registrationSchema = z.object({
  fullName: nameSchema,
  contactEmail: z.email().max(120),
  phone: z.string().trim().max(30).optional().nullable(),
  collegeId: z.number().int().positive().nullable().optional(),
  studyYear: z.string().trim().max(30).optional().nullable(),
  interests: z.array(z.enum(INTEREST_OPTIONS)).max(8),
  consentComms: z.literal(true, {
    message: 'Tick the box to join AIDA.',
  }),
  consentRaffle: z.boolean(),
});

// ---------------------------------------------------------------------------
// Anonymous dataset (§32) — no identifying fields exist in this schema at all
// ---------------------------------------------------------------------------

export const datasetSubmitSchema = z.object({
  token: z.string().min(16).max(128),
  answers: z.record(z.string().max(40), z.string().max(60)),
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export const overrideIssueSchema = z.object({
  email: auEmailSchema,
  idVerified: z.boolean(),
});

export const settingsUpdateSchema = z.object({
  challengeOpen: z.boolean().optional(),
  newGamesPaused: z.boolean().optional(),
  entriesClosed: z.boolean().optional(),
  humanWinThreshold: z.number().int().min(0).max(1000).optional(),
  round2RecognitionThreshold: z.number().min(0.01).max(1).optional(),
  round3ScoringTolerance: z.number().positive().finite().max(1_000_000).optional(),
  round3ToleranceExponent: z.number().min(0.1).max(6).optional(),
  round1MsPerImage: z.number().int().min(1000).max(60_000).optional(),
  round2DrawMs: z.number().int().min(5000).max(120_000).optional(),
  round3Ms: z.number().int().min(3000).max(60_000).optional(),
  leaderboardDisplay: z
    .enum(['name_only', 'masked_id_only', 'name_and_masked_id'])
    .optional(),
  collectCollege: z.boolean().optional(),
});
