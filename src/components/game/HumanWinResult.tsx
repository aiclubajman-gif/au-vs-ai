import type { ReactNode } from 'react';
import { ResultStage, PlateButton, ResultNotice } from '@/components/game/ResultStage';
import styles from './Result.module.css';

/**
 * Human Win — the result screen when the student's total reaches the win
 * threshold.
 *
 * The plate is the finished artwork: mascot (the corrected cutout, with the
 * university name printed correctly on the hoodie), trophy, AI face, wordmark, the
 * HUMANITY +1 headline, the card with its YOUR SCORE / YOUR RANK labels and
 * quote, and both button shells with their icons and arrows. Only the score,
 * rank, standing and button labels are HTML, placed in the gaps the plate
 * leaves for them.
 */
export const HUMAN_WIN_PLATE_SRC = '/design/results/human-win-plate.webp';

export interface HumanWinResultProps {
  scoreText: string;
  /** The maximum total, shown after the slash. */
  scoreMaxText: string;
  rankText: string;
  /** The emphasised standing, e.g. "Top 4%". */
  percentileText: string;
  /** The line under it, e.g. "of challengers". */
  percentileCaption: string;
  leaderboardButtonLabel: string;
  joinButtonLabel: string;
  leaderboardHref: string;
  joinHref: string;
  /** Shown under the buttons, e.g. for a student reopening a finished game. */
  notice?: ReactNode;
}

export function HumanWinResult({
  scoreText,
  scoreMaxText,
  rankText,
  percentileText,
  percentileCaption,
  leaderboardButtonLabel,
  joinButtonLabel,
  leaderboardHref,
  joinHref,
  notice,
}: HumanWinResultProps) {
  return (
    <ResultStage plateSrc={HUMAN_WIN_PLATE_SRC} plateWidth={941} plateHeight={1672} variant="human">
      {/* Headline and card labels are painted into the plate. */}
      <h1 className="sr-only">Humanity plus one. You beat the AI! Creativity still wins.</h1>

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

      <p className={styles.standing}>
        <span className={styles.percentile}>{percentileText}</span>{' '}
        <span className={styles.percentileCaption}>{percentileCaption}</span>
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
