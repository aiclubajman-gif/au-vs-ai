import type { ReactNode } from 'react';
import { ResultStage, PlateButton, ResultNotice } from '@/components/game/ResultStage';
import styles from './Result.module.css';

/**
 * AI Win — the result screen when the student's total is below the win
 * threshold.
 *
 * The plate is the finished artwork: mascot, robot, city, wordmark, the AI
 * TAKES THIS ONE headline and its encouragement line, the card with its
 * target, trophy and players tiles and their labels, and both button shells
 * with their icons and arrows. Only the score, rank, share
 * beaten and button labels are HTML, each inside the empty frame the plate
 * paints for it.
 */
export const AI_WIN_PLATE_SRC = '/design/results/ai-win-plate.webp';

export interface AiWinResultProps {
  scoreText: string;
  /** The maximum total, shown after the slash. */
  scoreMaxText: string;
  rankText: string;
  /** The share of players beaten, e.g. "60%", between YOU BEAT and OF PLAYERS. */
  percentileText: string;
  leaderboardButtonLabel: string;
  joinButtonLabel: string;
  leaderboardHref: string;
  joinHref: string;
  /** Shown under the card, e.g. for a student reopening a finished game. */
  notice?: ReactNode;
}

export function AiWinResult({
  scoreText,
  scoreMaxText,
  rankText,
  percentileText,
  leaderboardButtonLabel,
  joinButtonLabel,
  leaderboardHref,
  joinHref,
  notice,
}: AiWinResultProps) {
  return (
    <ResultStage plateSrc={AI_WIN_PLATE_SRC} plateWidth={853} plateHeight={1844} variant="ai">
      {/* Headline, encouragement and card labels are painted into the plate. */}
      <h1 className="sr-only">AI takes this one.</h1>
      <p className="sr-only">A solid effort! Keep going and challenge yourself again.</p>

      <p className={styles.score} data-digits={scoreText.length}>
        <span className="sr-only">Your score: </span>
        <span className={`${styles.scoreValue} tabular`}>{scoreText}</span>
        <span className={styles.scoreMax}>
          <span aria-hidden="true">/ </span>
          <span className="sr-only"> out of </span>
          <span className="tabular">{scoreMaxText}</span>
        </span>
      </p>

      <p className={styles.rank} data-length={rankText.length}>
        <span className="sr-only">Your rank: </span>
        <span className="tabular">{rankText}</span>
      </p>

      <p className={styles.beat}>
        <span className="sr-only">You beat </span>
        <span className="tabular">{percentileText}</span>
        <span className="sr-only"> of players</span>
      </p>

      <PlateButton
        href={leaderboardHref}
        label={leaderboardButtonLabel}
        className={styles.leaderboardButton}
      />
      <PlateButton href={joinHref} label={joinButtonLabel} className={styles.joinButton} />

      <ResultNotice>{notice}</ResultNotice>
    </ResultStage>
  );
}
