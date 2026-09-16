import { PlateScreen } from '@/components/ui/PlateScreen';
import styles from './AlreadyPlayed.module.css';

/**
 * You've Already Played — shown to a student whose official attempt is
 * complete, with their final result.
 *
 * The plate is the finished artwork: logo, mascot sticker, headline, the
 * explanation, the YOUR RESULT panel with its icons, labels, captions and
 * dividers, both button shells and the Back chevron. The values, button
 * contents and the Back to Home label are HTML.
 *
 * Every value is the server's public result; a dash stands in when it could
 * not be loaded.
 */
export const ALREADY_PLAYED_PLATE_SRC = '/design/already-played/plate.webp';

export interface AlreadyPlayedProps {
  scoreText: string;
  rankText: string;
  /** Total players, between OUT OF and PLAYERS. */
  playerCountText: string;
  /** e.g. "7%", under TOP. */
  topShareText: string;
  leaderboardHref: string;
  joinHref: string;
  homeHref: string;
}

export function AlreadyPlayed({
  scoreText,
  rankText,
  playerCountText,
  topShareText,
  leaderboardHref,
  joinHref,
  homeHref,
}: AlreadyPlayedProps) {
  return (
    <PlateScreen plateSrc={ALREADY_PLAYED_PLATE_SRC} plateWidth={853} plateHeight={1844} className={styles.page}>
      {/* Headline, explanation and panel labels are painted into the plate. */}
      <h1 className="sr-only">You&apos;ve already played</h1>
      <p className="sr-only">
        Your official attempt is complete. Thank you for being part of AU vs AI. You can only
        play once, but your impact goes far beyond a score.
      </p>

      <p className={styles.value} data-col="score">
        <span className="sr-only">Score: </span>
        <span className="tabular">{scoreText}</span>
      </p>
      <p className={styles.value} data-col="rank">
        <span className="sr-only">Rank: </span>
        <span className="tabular">{rankText}</span>
      </p>
      <p className={styles.count}>
        <span className="sr-only">out of </span>
        <span className="tabular">{playerCountText}</span>
        <span className="sr-only"> players</span>
      </p>
      <p className={styles.value} data-col="top">
        <span className="sr-only">You&apos;re in the top </span>
        <span className="tabular">{topShareText}</span>
        <span className="sr-only"> of all players</span>
      </p>

      <a href={leaderboardHref} className={styles.button} data-button="leaderboard">
        <span className={styles.buttonRow}>
          <BarsIcon className={styles.icon} />
          <span className={styles.buttonLabel}>View leaderboard</span>
          <ArrowIcon className={styles.arrow} />
        </span>
      </a>

      <a href={joinHref} className={styles.button} data-button="join">
        <span className={styles.buttonRow}>
          <GiftIcon className={styles.icon} />
          <span className={styles.buttonLabel}>Join AIDA</span>
          <ArrowIcon className={styles.arrow} />
        </span>
        <span className={styles.buttonCaption}>
          Get updates, future challenges,
          <br />
          exclusive content and more.
        </span>
      </a>

      {/* The chevron is painted; the link covers it and the label. */}
      <a href={homeHref} className={styles.home}>
        <span className={styles.homeLabel}>Back to Home</span>
      </a>
    </PlateScreen>
  );
}

function BarsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="currentColor" aria-hidden="true">
      <rect x="5" y="22" width="7" height="14" rx="1.5" />
      <rect x="16.5" y="14" width="7" height="22" rx="1.5" />
      <rect x="28" y="5" width="7" height="31" rx="1.5" />
    </svg>
  );
}

function GiftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="15" width="30" height="8" rx="1.5" />
      <path d="M8 23v13h24V23M20 15v21" />
      <path d="M20 15c-2-6-10-9-11-4 0 3 5 4 11 4ZM20 15c2-6 10-9 11-4 0 3-5 4-11 4Z" />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 32" fill="none" aria-hidden="true">
      <path d="M3 16h40M30 3l13 13-13 13" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
