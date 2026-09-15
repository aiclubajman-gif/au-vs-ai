/**
 * AU vs AI — the 60-second format.
 *
 * The database is the authority: migration 0015 only admits these two Round 1
 * presets, fixes Rounds 2 and 3, and requires the game to total 60 seconds.
 * start_attempt() snapshots the timing onto each attempt, and the game plays
 * from that snapshot alone.
 *
 * This module mirrors those rules for the two places that need them before
 * the database is involved: the admin API, which accepts a preset name rather
 * than raw milliseconds, and the play flow, which refuses to start a game that
 * does not add up.
 */
import type { AttemptTiming } from '@/types';

export const GAME_TOTAL_MS = 60_000;

/** Upper bound of attempt_round1.slot. */
export const ROUND1_MAX_IMAGES = 10;

/** Must match event_settings_round1_preset in 0015 (tests enforce this). */
export const ROUND1_PRESETS = {
  '8x5': { imageCount: 8, msPerImage: 5_000 },
  '10x4': { imageCount: 10, msPerImage: 4_000 },
} as const;

export type Round1Preset = keyof typeof ROUND1_PRESETS;

export const ROUND1_PRESET_KEYS = Object.keys(ROUND1_PRESETS) as [Round1Preset, ...Round1Preset[]];

/** The preset a stored image count and per-image time correspond to, if any. */
export function round1PresetFor(imageCount: number, msPerImage: number): Round1Preset | null {
  return (
    ROUND1_PRESET_KEYS.find(
      (key) =>
        ROUND1_PRESETS[key].imageCount === imageCount && ROUND1_PRESETS[key].msPerImage === msPerImage,
    ) ?? null
  );
}

const isPositiveInt = (n: unknown): n is number => Number.isInteger(n) && (n as number) > 0;

/**
 * Whether an assignment is a complete, exactly-60-second game: every image's
 * time plus both later rounds. A missing snapshot is never a game.
 */
export function isSixtySecondGame(
  imageCount: number,
  timing: AttemptTiming | null | undefined,
): timing is AttemptTiming {
  if (!timing) return false;
  if (!isPositiveInt(imageCount) || imageCount > ROUND1_MAX_IMAGES) return false;

  const { round1MsPerImage, round2DrawMs, round3Ms } = timing;
  if (![round1MsPerImage, round2DrawMs, round3Ms].every(isPositiveInt)) return false;

  return imageCount * round1MsPerImage + round2DrawMs + round3Ms === GAME_TOTAL_MS;
}
