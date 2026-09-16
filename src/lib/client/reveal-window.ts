/**
 * How long the Round 2 analysis screen stays up once the result lands.
 *
 * Sibling of answer-window.ts, and the same rule: a student's time is measured
 * from the moment the thing is actually usable, never from the moment the code
 * happened to reach that line.
 *
 * The predictions become usable only when they are BOTH on screen and saved —
 * Continue stays disabled until the save lands. Anchoring on the classifier's
 * return instead meant that a first save which failed and then succeeded on
 * retry, or one that was merely slow, had already spent the window: the
 * remaining wait came out at zero and the analysis screen vanished the instant
 * it became usable.
 *
 * Nothing here reaches the Round 2 score, the drawing clock or the speed
 * bonus. drawTimeMs is frozen when the drawing is submitted, long before this.
 */

/** Approved readout length for the Round 2 analysis screen. */
export const REVEAL_WINDOW_MS = 7_000;

/**
 * Time left on the readout window.
 *
 * `savedAt` is when the result became both visible and persisted, or null
 * while it is still unsaved — until then the whole window is still ahead,
 * however long the saving has taken or how many times it had to be retried.
 */
export function revealTimeRemaining(
  savedAt: number | null,
  now: number,
  windowMs: number,
): number {
  if (savedAt === null) return windowMs;
  return Math.max(0, windowMs - (now - savedAt));
}
