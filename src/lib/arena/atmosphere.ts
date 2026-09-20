import type { ArenaLead, BattleShare } from './types';

/**
 * How the arena lights itself for the live score.
 *
 * Which side it lights for is `leadOf` in types.ts — the one lead the whole
 * screen already uses. This file adds the three things the atmosphere needs on
 * top of it, all pure so they can be reasoned about and tested on their own:
 *
 *   leadingLight()   how hard the house lights up for the side in front
 *   trailingLight()  how far down the other side's lights are taken
 *   watchLead()      whether the lead has actually changed hands
 *
 * None of them works out a percentage. All are handed the battle share that
 * battleShare() already derived from the win counts, so the lighting can never
 * disagree with the numbers printed beside it.
 *
 * The two light levels are deliberately separate. A booth TV is read from
 * across a room, so what has to be obvious is not how bright the arena is but
 * which colour is running it — and that is a ratio between the two sides, not
 * one brightness. The leader climbing and the trailer dropping open that ratio
 * from both ends at once.
 */

type Anchor = { margin: number; strength: number };

/** Linear between the anchors, flat outside them. Anchors run low to high. */
function atMargin(anchors: Anchor[], margin: number): number {
  for (let i = 1; i < anchors.length; i++) {
    const lo = anchors[i - 1];
    const hi = anchors[i];
    if (margin > hi.margin) continue;
    const t = Math.min(1, Math.max(0, (margin - lo.margin) / (hi.margin - lo.margin)));
    // Three decimals: enough to be smooth, short enough to keep the inline
    // style stable rather than churning on floating-point dust.
    return Math.round((lo.strength + (hi.strength - lo.strength) * t) * 1000) / 1000;
  }
  return anchors[anchors.length - 1].strength;
}

/**
 * Lead margin (points between the two shares) against how hard the winning
 * side's house lights burn.
 *
 * The range above 66/34 is narrow on purpose: a runaway score is a brighter
 * arena, not a different screen, and the leaderboard and the hanging screen
 * have to stay readable at every one of these values. Most of the difference a
 * viewer actually sees comes from the other side dropping away (below), which
 * costs the readable parts of the screen nothing.
 */
const LEADING: Anchor[] = [
  { margin: 0, strength: 0.9 }, // a dead heat: both rigs up, neither on top
  { margin: 32, strength: 1 }, // 66/34 — the house look
  { margin: 60, strength: 1.08 }, // 80/20 and beyond: as bright as it gets
];

/**
 * The same margin against what is left of the losing side's lights.
 *
 * It never reaches zero: AU vs AI is two colours, and an arena lit in one of
 * them stops being the contest. A quarter of the leader is enough to keep the
 * far practicals and the trailing edge in their own colour while leaving no
 * doubt about which rig is running the room.
 */
const TRAILING: Anchor[] = [
  { margin: 5, strength: 0.42 }, // the first score that is not a dead heat
  { margin: 32, strength: 0.3 }, // 66/34 — the leader reads about 3x this
  { margin: 60, strength: 0.22 }, // 20/80: quieter still, never dark
];

export const MIN_STRENGTH = LEADING[0].strength;
export const MAX_STRENGTH = LEADING[LEADING.length - 1].strength;

const marginOf = ({ humanPct, aiPct }: BattleShare) => Math.abs(humanPct - aiPct);

/**
 * How hard the arena lights for the side in front, as a multiplier the CSS
 * scales that side's lighting layers by (see --mood).
 */
export function leadingLight(share: BattleShare): number {
  return atMargin(LEADING, marginOf(share));
}

/**
 * What the side behind is left with, as the same kind of multiplier (--fade).
 * Only the two lead states use it; a dead heat lights both sides off --mood.
 */
export function trailingLight(share: BattleShare): number {
  return atMargin(TRAILING, marginOf(share));
}

/**
 * What the screen remembers about the lead between renders: who was ahead, and
 * how many times the lead has changed hands since the screen opened.
 */
export type LeadWatch = {
  /** null until real numbers have arrived; the waiting screen is not a reading. */
  lead: ArenaLead | null;
  /** Goes up by one each time the lead changes. The arena flares on each rise. */
  sting: number;
};

export const NEW_WATCH: LeadWatch = { lead: null, sting: 0 };

/**
 * The next thing to remember, given who is ahead now.
 *
 * `settled` is false while the screen is still showing its empty waiting board,
 * so a live feed's first answer arrives as the opening state rather than as a
 * lead change — the arena should not flare at a score it has only just been
 * told. After that a new lead raises the sting count and an unchanged one
 * returns `prev` itself, so a score that moves without changing who is ahead
 * (66/34 to 67/33) costs nothing and flares nothing.
 */
export function watchLead(prev: LeadWatch, lead: ArenaLead, settled: boolean): LeadWatch {
  if (!settled) return prev;
  if (prev.lead === lead) return prev;
  if (prev.lead === null) return { lead, sting: prev.sting };
  return { lead, sting: prev.sting + 1 };
}
