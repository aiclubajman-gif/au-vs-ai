/**
 * Result screen copy, built from the public result exactly as the server
 * returns it (get_attempt_result_public). Presentation only: nothing here
 * ranks, scores or rounds differently from the database.
 */

export function formatRank(rank: number): string {
  return `#${rank}`;
}

/**
 * The share of other players scored below, for "YOU BEAT __ OF PLAYERS" on the
 * AI Win screen. The first player of the event has nobody to have beaten, so
 * they see a dash rather than a discouraging "0%".
 */
export function formatBeaten(percentileBeaten: number, totalPlayers: number): string {
  if (totalPlayers <= 1) return '—';
  return `${Math.min(100, Math.max(0, Math.round(percentileBeaten)))}%`;
}

/**
 * "Top X%" as a bare figure, for the TOP column of the Already Played screen:
 * the share of the other players at or above this student, never "0%". Same
 * figure the Human Win screen shows; a dash when there is nobody to compare.
 */
export function formatTopShare(percentileBeaten: number, totalPlayers: number): string {
  if (totalPlayers <= 1) return '—';
  return `${Math.min(100, Math.max(1, 100 - Math.round(percentileBeaten)))}%`;
}

export interface PercentileCopy {
  /** The emphasised line, e.g. "Top 4%". */
  text: string;
  /** The line under it, e.g. "of challengers". */
  caption: string;
}

/**
 * The standing under the rank on the Human Win screen.
 *
 * `percentileBeaten` is the share of the other challengers who scored lower,
 * so 100 minus it is the share at or above this student: "Top 4%". That only
 * reads as praise in the top half; below it "Top 88%" says nothing useful, so
 * the line becomes a plain count instead ("#120 of 175 challengers"). The
 * first challenger of the event has nobody to be compared with.
 */
export function formatPercentile(percentileBeaten: number, totalPlayers: number): PercentileCopy {
  if (totalPlayers <= 1) return { text: 'First', caption: 'challenger' };

  const top = Math.min(100, Math.max(1, 100 - Math.round(percentileBeaten)));
  if (top <= 50) return { text: `Top ${top}%`, caption: 'of challengers' };
  return { text: `Of ${totalPlayers}`, caption: 'challengers' };
}
