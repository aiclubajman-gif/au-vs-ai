import { useEffect, useState, type CSSProperties } from 'react';
import { ARENA_TOP_PLAYERS, type LeaderboardEntry } from '@/lib/arena/types';
import { ARENA_TIMING } from './config';
import { useRollingText } from './hooks';
import { Crown } from './icons';
import styles from './Leaderboard.module.css';

const formatScore = (n: number) => Math.round(n).toLocaleString('en-US');

/**
 * The top challengers. Every row is keyed by player, and sits at its rank by
 * transform, so a change of order slides rows to their new places instead of
 * rewriting them in place. Someone pushed out of the top three drops out of
 * the bottom and fades; a newcomer slides in. Empty ranks (early in the day)
 * show a placeholder rather than collapsing the panel.
 */
export function Leaderboard({ players }: { players: LeaderboardEntry[] }) {
  const top = players.slice(0, ARENA_TOP_PLAYERS);
  const exiting = useExitingRows(top);

  return (
    <section className={styles.board} aria-label="Leaderboard">
      <h2 className={styles.title}>Leaderboard</h2>
      <ol className={styles.rows}>
        {Array.from({ length: ARENA_TOP_PLAYERS }, (_, i) => (
          <li
            key={`slot-${i}`}
            className={styles.placeholder}
            style={{ '--slot': i } as CSSProperties}
            aria-hidden={i < top.length}
            data-filled={i < top.length}
          >
            <span className={styles.rank}>{i + 1}</span>
            <span className={styles.waiting}>Awaiting challenger</span>
          </li>
        ))}
        {/* One keyed list, so a row pushed out keeps its identity and slides away. */}
        {[
          ...top.map((entry, i) => <Row key={entry.id} entry={entry} rank={i + 1} />),
          ...exiting.map((entry) => <Row key={entry.id} entry={entry} rank={ARENA_TOP_PLAYERS + 1} leaving />),
        ]}
      </ol>
    </section>
  );
}

function Row({ entry, rank, leaving = false }: { entry: LeaderboardEntry; rank: number; leaving?: boolean }) {
  // A newcomer's score rolls up from nothing once its row has slid in. The
  // value is written straight into the span rather than held in state: every
  // finished game rolls all three rows at once (see useRollingNumber).
  const scoreRef = useRollingText<HTMLSpanElement>(entry.score, formatScore, { from: 0, delayMs: 400 });
  return (
    <li
      className={styles.row}
      style={{ '--slot': rank - 1 } as CSSProperties}
      data-rank={rank}
      data-leaving={leaving || undefined}
      aria-hidden={leaving || undefined}
    >
      {/* Keyed by rank: a new rank pops the badge and crown in fresh. */}
      <span key={`rank-${rank}`} className={styles.rank}>
        {Math.min(rank, ARENA_TOP_PLAYERS)}
      </span>
      <span key={`crown-${rank}`} className={styles.crownCell}>
        <Crown rank={Math.min(rank, ARENA_TOP_PLAYERS)} className={styles.crown} />
      </span>
      <span className={styles.who}>
        <span className={styles.name}>{entry.name}</span>
        {entry.tag && <span className={styles.tag}>{entry.tag}</span>}
      </span>
      <span ref={scoreRef} className={`${styles.score} tabular`}>
        {formatScore(0)}
      </span>
    </li>
  );
}

const sameRows = (a: LeaderboardEntry[], b: LeaderboardEntry[]) =>
  a.length === b.length &&
  a.every((p, i) => p.id === b[i].id && p.score === b[i].score && p.name === b[i].name && p.tag === b[i].tag);

/**
 * Rows that just left the top three, kept for one exit animation. Derived
 * while rendering (React's pattern for state that follows props), then
 * cleared by a timer.
 */
function useExitingRows(top: LeaderboardEntry[]) {
  const [previous, setPrevious] = useState(top);
  const [exiting, setExiting] = useState<LeaderboardEntry[]>([]);

  if (!sameRows(previous, top)) {
    const ids = new Set(top.map((p) => p.id));
    const gone = previous.filter((p) => !ids.has(p.id));
    setPrevious(top);
    if (gone.length > 0 || exiting.some((p) => ids.has(p.id))) {
      setExiting([...exiting.filter((p) => !ids.has(p.id)), ...gone]);
    }
  }

  useEffect(() => {
    if (exiting.length === 0) return;
    const timer = window.setTimeout(() => setExiting([]), ARENA_TIMING.rowExitMs);
    return () => window.clearTimeout(timer);
  }, [exiting]);

  return exiting;
}
