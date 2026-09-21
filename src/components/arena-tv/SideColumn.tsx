import { useEffect, useRef } from 'react';
import { ARENA_TIMING } from './config';
import { restartAnimations, useRollingText } from './hooks';
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
  const countRef = useRollingText<HTMLSpanElement>(wins, formatCount, {
    from: 0,
    delayMs: ARENA_TIMING.introDelayMs,
    durationMs: 1800,
  });
  // The kick replays on each new win by restarting the animation in place.
  // Keying this span instead would rebuild the very node the count is rolling
  // in, which snapped the number back to where the last render left it.
  const firstWins = useRef(wins);
  useEffect(() => {
    if (wins === firstWins.current) return;
    restartAnimations(countRef.current);
  }, [wins, countRef]);

  return (
    <section className={styles.column} data-side={side}>
      <h2 className={styles.label}>Total wins</h2>
      <p className={styles.wins}>
        <Trophy side={side} className={styles.trophy} />
        <span ref={countRef} className={`${styles.count} tabular`}>
          {formatCount(0)}
        </span>
      </p>
      <p className={styles.slogan}>
        <span>{slogan[0]}</span>
        <span>{slogan[1]}</span>
      </p>
    </section>
  );
}
