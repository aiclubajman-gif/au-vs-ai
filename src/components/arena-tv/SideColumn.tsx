import { ARENA_TIMING } from './config';
import { useCountUp } from './hooks';
import { Trophy } from './icons';
import styles from './SideColumn.module.css';

const formatCount = (n: number) => Math.round(n).toLocaleString('en-US');

/**
 * One side's column beside the leaderboard: its total wins (rolling up, with a
 * kick each time the count goes up) and its slogan panel.
 */
export function SideColumn({
  side,
  wins,
  slogan,
}: {
  side: 'human' | 'ai';
  wins: number;
  slogan: readonly [string, string];
}) {
  const shown = useCountUp(wins, { from: 0, delayMs: ARENA_TIMING.introDelayMs, durationMs: 1800 });
  return (
    <section className={styles.column} data-side={side}>
      <h2 className={styles.label}>Total wins</h2>
      <p className={styles.wins}>
        <Trophy side={side} className={styles.trophy} />
        {/* Re-mounted on each new win so the kick animation replays. */}
        <span key={wins} className={`${styles.count} tabular`}>
          {formatCount(shown)}
        </span>
      </p>
      <p className={styles.slogan}>
        <span>{slogan[0]}</span>
        <span>{slogan[1]}</span>
      </p>
    </section>
  );
}
