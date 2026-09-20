import type { LeaderboardDisplayMode } from '@/types';

/** The two columns of leaderboard_public that identify a player. */
export interface LeaderboardIdentity {
  display_name: string;
  masked_id_suffix: string;
}

/**
 * How a player appears on any public leaderboard (/leaderboard, the /tv arena
 * screen), per the admin's display setting, as the main label plus an optional
 * secondary tag (the masked ID, when shown next to a name).
 *
 * §5 — never render a full student ID or email, whatever the mode.
 */
export function leaderboardLabelParts(
  row: LeaderboardIdentity,
  mode: LeaderboardDisplayMode,
): { name: string; tag: string | null } {
  if (mode === 'name_only') return { name: row.display_name, tag: null };
  if (mode === 'masked_id_only') return { name: `••••${row.masked_id_suffix}`, tag: null };
  return { name: row.display_name, tag: `••••${row.masked_id_suffix}` };
}

/** The same, as one line: "Ahmed K. · ••••1234". */
export function leaderboardLabel(row: LeaderboardIdentity, mode: LeaderboardDisplayMode): string {
  const { name, tag } = leaderboardLabelParts(row, mode);
  return tag ? `${name} · ${tag}` : name;
}
