/**
 * AU vs AI — authoritative scoring.
 *
 * Every function here is pure and deterministic. These run on the server only.
 * A client-submitted score is never trusted; the server recomputes from stored
 * round records (§9).
 *
 * Total = 1000
 *   Round 1  500   share of assigned images judged correctly, no speed bonus (§12)
 *   Round 2  250   recognition + partial credit + small speed bonus (§16)
 *   Round 3  250   distance from the shared answer (§20)
 */

export const MAX_ROUND1 = 500;
export const MAX_ROUND2 = 250;
export const MAX_ROUND3 = 250;
export const MAX_TOTAL = 1000;

// ---------------------------------------------------------------------------
// ROUND 1
// ---------------------------------------------------------------------------

/**
 * Whether a Round 1 selection matches the image's true label.
 *
 * `null` means the timer ran out with nothing chosen. It is never correct,
 * whatever the image is — a timeout must not be scored as if the student had
 * picked either answer.
 */
export function isRound1Correct(
  selected: 'real' | 'ai_generated' | null,
  label: 'real' | 'ai_generated',
): boolean {
  return selected !== null && selected === label;
}

/**
 * Round 1 score: round(500 × correct / assigned), rounding halves up.
 *
 * Mirrors complete_attempt() (migration 0015), which is where the score is
 * actually recorded, once, at the end of the game. There are no per-slot
 * points: 500 does not divide evenly by 8, and splitting it 63/62 across
 * shuffled slots would let two students with the same number right score
 * differently. Only the counts matter.
 *
 *   4 images  125 per correct answer (identical to the old per-slot scoring)
 *   8 images  0, 63, 125, 188, 250, 313, 375, 438, 500
 *   10 images 50 per correct answer
 *
 * Unanswered and timed-out images count as assigned but not correct.
 * Integer arithmetic, so a half is never lost to floating point.
 */
export function scoreRound1(correct: number, assigned: number): number {
  if (!Number.isInteger(assigned) || assigned < 1) {
    throw new RangeError(`Round 1 assigned images must be a positive integer, received ${assigned}`);
  }
  if (!Number.isInteger(correct) || correct < 0 || correct > assigned) {
    throw new RangeError(`Round 1 correct answers must be 0-${assigned}, received ${correct}`);
  }
  return Math.floor((2 * MAX_ROUND1 * correct + assigned) / (2 * assigned));
}

// ---------------------------------------------------------------------------
// ROUND 2
// ---------------------------------------------------------------------------

export interface Round2Config {
  /** Confidence at or above which the drawing counts as recognised. */
  recognitionThreshold: number;
  /** Maximum speed bonus available on a successful recognition. */
  speedBonusMax: number;
  /** Full drawing time allowed, ms. */
  drawTimeMs: number;
}

export interface Round2Input {
  /** Model confidence on the ASSIGNED target class, 0-1. */
  targetConfidence: number;
  /** Time from round start to submission, ms. */
  drawTimeMs: number;
}

export const ROUND2_BASE_POINTS = 210;
/**
 * Ceiling for an unrecognised near-miss. Deliberately below ROUND2_BASE_POINTS
 * so a successful recognition ALWAYS beats a near-miss (§16).
 */
export const ROUND2_NEAR_MISS_CAP = 120;

export interface Round2Result {
  points: number;
  recognized: boolean;
}

/**
 * Round 2 scoring.
 *
 * Recognised:   210 base + up to `speedBonusMax` for submitting early.
 * Not recognised: proportional credit, capped at 120.
 *
 * The speed bonus is small and only applies on success, so a fast phone cannot
 * out-earn a slower one by more than the cap (§16).
 */
export function scoreRound2(input: Round2Input, config: Round2Config): Round2Result {
  const confidence = clamp01(input.targetConfidence);
  const threshold = clamp01(config.recognitionThreshold);

  if (threshold <= 0) {
    throw new RangeError('recognitionThreshold must be greater than 0');
  }

  const recognized = confidence >= threshold;

  if (!recognized) {
    const partial = Math.round(ROUND2_BASE_POINTS * (confidence / threshold));
    return {
      points: clampInt(Math.min(partial, ROUND2_NEAR_MISS_CAP), 0, MAX_ROUND2),
      recognized: false,
    };
  }

  const elapsed = Math.max(0, input.drawTimeMs);
  const remainingFraction =
    config.drawTimeMs > 0 ? Math.max(0, (config.drawTimeMs - elapsed) / config.drawTimeMs) : 0;

  const bonus = Math.round(config.speedBonusMax * remainingFraction);
  const points = ROUND2_BASE_POINTS + bonus;

  return { points: clampInt(points, 0, MAX_ROUND2), recognized: true };
}

// ---------------------------------------------------------------------------
// ROUND 3
// ---------------------------------------------------------------------------

export interface Round3Config {
  correctAnswer: number;
  /**
   * HIDDEN difficulty dial (§20). A guess further than this from the answer
   * scores exactly zero. Independent of the slider range: min/max bound what a
   * student can select, this alone controls how hard the round is.
   */
  tolerance: number;
  /** Curve sharpness. 1 = linear; >1 punishes distance more steeply. */
  toleranceExponent: number;
}

/**
 * Clamp a guess to the slider's selectable range.
 *
 * Deliberately separate from scoreRound3. The slider range is an INPUT
 * VALIDATION concern — it stops a malformed client sending 10^9. It must not
 * influence the scoring curve, which is what the old range-normalised formula
 * did (widening the slider silently made the round easier).
 */
export function clampGuessToRange(guess: number, minValue: number, maxValue: number): number {
  if (!(maxValue > minValue)) {
    throw new RangeError('Round 3 maxValue must exceed minValue');
  }
  if (!Number.isFinite(guess)) {
    throw new RangeError('Round 3 guess must be a finite number');
  }
  return Math.min(Math.max(guess, minValue), maxValue);
}

/**
 * Round 3 scoring.
 *
 *   score = 250 * max(0, 1 - |guess - answer| / tolerance) ^ exponent
 *
 * Properties this guarantees:
 *   - exact answer scores 250
 *   - a guess `tolerance` away or further scores exactly 0
 *   - well-behaved when the correct answer is 0 (nothing divides by the answer)
 *   - monotonic and symmetric around the answer
 *
 * Call clampGuessToRange first if the guess came from a client.
 */
export function scoreRound3(guess: number, config: Round3Config): number {
  const { correctAnswer, tolerance, toleranceExponent } = config;

  if (!Number.isFinite(guess)) {
    throw new RangeError('Round 3 guess must be a finite number');
  }
  if (!(tolerance > 0) || !Number.isFinite(tolerance)) {
    throw new RangeError('Round 3 tolerance must be a positive finite number');
  }
  if (!(toleranceExponent > 0)) {
    throw new RangeError('toleranceExponent must be greater than 0');
  }

  const error = Math.abs(guess - correctAnswer);
  const closeness = Math.max(0, 1 - error / tolerance);
  const points = MAX_ROUND3 * Math.pow(closeness, toleranceExponent);

  return clampInt(Math.round(points), 0, MAX_ROUND3);
}

export function round3AbsError(guess: number, correctAnswer: number): number {
  return Math.abs(guess - correctAnswer);
}

// ---------------------------------------------------------------------------
// TOTAL
// ---------------------------------------------------------------------------

export interface TotalInput {
  round1Score: number;
  round2Score: number;
  round3Score: number;
}

/** Server-side total. Each round is clamped to its own ceiling first (§9). */
export function calculateTotal(input: TotalInput): number {
  const r1 = clampInt(input.round1Score, 0, MAX_ROUND1);
  const r2 = clampInt(input.round2Score, 0, MAX_ROUND2);
  const r3 = clampInt(input.round3Score, 0, MAX_ROUND3);
  return r1 + r2 + r3;
}

/** §23 — threshold is frozen before the event and stored on the attempt. */
export function isHumanWin(totalScore: number, threshold: number): boolean {
  return totalScore >= threshold;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), 1);
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(Math.round(n), min), max);
}
