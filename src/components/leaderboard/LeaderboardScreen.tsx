import type { CSSProperties } from 'react';
import { PlateScreen } from '@/components/ui/PlateScreen';
import { RowsViewport } from '@/components/leaderboard/RowsViewport';
import { YourRankButton } from '@/components/leaderboard/YourRankButton';
import styles from './LeaderboardScreen.module.css';

/**
 * Leaderboard. The plate paints branding, mascot, title, the panel with its
 * column headings, the three podium rows, the lower row lines and avatars, the
 * Your Rank button shell with its icon and arrow, and the footer. Rank, name
 * and score of each row are HTML, one row per painted slot; slots without a
 * player stay empty.
 *
 * On a phone too short for the whole board, the header stays where it is
 * painted, Your Rank is pinned to the bottom of the screen and the rows scroll
 * between them (see LeaderboardScreen.module.css).
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
    <PlateScreen
      plateSrc={LEADERBOARD_PLATE_SRC}
      plateWidth={853}
      plateHeight={1844}
      className={styles.page}
      // The short layout draws the rows' panel and Your Rank from the plate.
      style={{ '--plate-image': `url("${LEADERBOARD_PLATE_SRC}")` } as CSSProperties}
    >
      {/* Title and column headings painted into the plate. */}
      <h1 className="sr-only">Leaderboard</h1>

      <RowsViewport className={styles.board}>
        <div className={styles.boardPlate} aria-hidden="true" />
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
      </RowsViewport>
      <div className={styles.fades} aria-hidden="true" />

      <div className={styles.footer}>
        <YourRankButton className={styles.yourRank} labelClassName={styles.yourRankLabel} statusClassName={styles.yourRankStatus} />
      </div>
    </PlateScreen>
  );
}
