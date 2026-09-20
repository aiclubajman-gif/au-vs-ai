/**
 * The data the arena TV screen (/tv) shows. Everything on that screen that
 * changes is drawn from one ArenaStats; the art around it never changes.
 *
 * Whatever feeds the screen — the mock feed, /api/arena/stats, or anything you
 * wire up later — only has to produce this shape.
 */

export type LeaderboardEntry = {
  /** Stable per player: rows animate to their new place by id. */
  id: string;
  name: string;
  score: number;
  /** Optional smaller second label after the name, e.g. a masked ID "••••1234". */
  tag?: string;
};

export type ArenaStats = {
  /**
   * Games won by the student (human) and by the AI. These two counts are the
   * only source of truth on the screen: every percentage, the battle bar's
   * fill and which side the arena lights up for are derived from them by
   * battleShare() below. Nothing stores a percentage of its own, so the shown
   * share can never disagree with the shown totals.
   */
  humanWins: number;
  aiWins: number;
  /** Best first. The screen shows the first ARENA_TOP_PLAYERS. */
  topPlayers: LeaderboardEntry[];
};

/** Share of the battle each side holds, as whole percentages summing to 100. */
export type BattleShare = {
  humanPct: number;
  aiPct: number;
};

/** Who the arena lights up for. */
export type ArenaLead = 'human' | 'ai' | 'tie';

/** Rows on the TV leaderboard. */
export const ARENA_TOP_PLAYERS = 3;

/**
 * Within this many points of each other the arena reads as a dead heat
 * (split blue/orange lighting) rather than one side leading. 4 → 52/48.
 */
export const TIE_MARGIN = 4;

export function leadOf({ humanPct, aiPct }: BattleShare): ArenaLead {
  if (Math.abs(humanPct - aiPct) <= TIE_MARGIN) return 'tie';
  return humanPct > aiPct ? 'human' : 'ai';
}

/**
 * Battle share from win counts — the one place percentages are worked out.
 *
 *   humanPct = humanWins / (humanWins + aiWins) * 100,  aiPct = 100 - humanPct
 *
 * Rounded to whole percent for display, and the AI's share is taken as the
 * remainder so the two always sum to 100 however the rounding falls. No games
 * yet is an even 50/50, not 0/0.
 */
export function battleShare(humanWins: number, aiWins: number): BattleShare {
  const totalWins = humanWins + aiWins;
  if (totalWins <= 0) return { humanPct: 50, aiPct: 50 };
  const humanPct = Math.round((100 * humanWins) / totalWins);
  return { humanPct, aiPct: 100 - humanPct };
}

/** The battle share of a whole snapshot. */
export function shareOf({ humanWins, aiWins }: Pick<ArenaStats, 'humanWins' | 'aiWins'>): BattleShare {
  return battleShare(humanWins, aiWins);
}
