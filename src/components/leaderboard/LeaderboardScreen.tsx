import { PlateScreen } from '@/components/ui/PlateScreen';
import { YourRankButton } from '@/components/leaderboard/YourRankButton';
import styles from './LeaderboardScreen.module.css';

/**
 * Leaderboard. The plate paints branding, mascot, title, the panel with its
 * column headings, the three podium rows, the lower row lines and avatars, the
 * Your Rank button shell with its icon and arrow, and the footer. Rank, name
 * and score of each row are HTML, one row per painted slot; slots without a
 * player stay empty.
 */
export const LEADERBOARD_PLATE_SRC = '/design/leaderboard/plate.webp';

/** Painted row slots: three podium rows, then eight lower rows. */
export const LEADERBOARD_SLOTS = 11;

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
}

export function LeaderboardScreen({
  rows,
  emptyMessage,
}: {
  rows: LeaderboardEntry[];
  /** Shown in the panel when nobody has finished a game yet. */
  emptyMessage: string;
}) {
  const shown = rows.slice(0, LEADERBOARD_SLOTS);

  return (
    <PlateScreen plateSrc={LEADERBOARD_PLATE_SRC} plateWidth={853} plateHeight={1844} className={styles.page}>
      {/* Title and column headings painted into the plate. */}
      <h1 className="sr-only">Leaderboard</h1>

      {shown.length > 0 ? (
        <ol className={styles.rows}>
          {shown.map((row, i) => (
            <li
              key={`${row.rank}-${i}`}
              className={styles.row}
              data-slot={i + 1}
              data-podium={i < 3 ? i + 1 : undefined}
            >
              <span className={`${styles.rank} tabular`}>
                <span className="sr-only">Rank </span>
                {row.rank}
              </span>
              <span className={styles.name}>{row.name}</span>
              <span className={`${styles.score} tabular`}>
                <span className="sr-only">Score </span>
                {row.score}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.empty}>{emptyMessage}</p>
      )}

      <YourRankButton className={styles.yourRank} labelClassName={styles.yourRankLabel} statusClassName={styles.yourRankStatus} />
    </PlateScreen>
  );
}
