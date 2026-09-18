'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import Image from 'next/image';
import { ResultStage, PlateButton, ResultNotice } from '@/components/game/ResultStage';
import styles from './Result.module.css';

/** Human-win artwork is deliberately split so the characters can perform. */
export const HUMAN_WIN_PLATE_SRC = '/design/results/human-win-clean.webp';
export const HUMAN_WIN_LOGO_SRC = '/design/results/human-win-logo.webp';
export const HUMAN_WIN_FOREGROUND_SRC = '/design/results/human-win-foreground.webp';
export const HUMAN_WIN_MASCOT_VIDEO_SRC = '/design/results/human-win-mascot.webm';
export const HUMAN_WIN_AI_VIDEO_SRC = '/design/results/human-win-ai.webm';

export const HUMAN_WIN_MASCOT_POSTER_SRC = '/design/results/human-win-mascot-final.webp';
export const HUMAN_WIN_AI_POSTER_SRC = '/design/results/human-win-ai-final.webp';
const CHARACTER_START_MS = 600;

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
  /** Returning players skip the entrance sequence and see the completed state. */
  instant?: boolean;
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
  instant = false,
  notice,
}: HumanWinResultProps) {
  const mascotRef = useRef<HTMLVideoElement>(null);
  const aiRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videos = [mascotRef.current, aiRef.current].filter(
      (video): video is HTMLVideoElement => video !== null,
    );
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (instant || reducedMotion) {
      videos.forEach(showFinalFrame);
      return () => videos.forEach((video) => video.pause());
    }

    const timer = window.setTimeout(() => {
      videos.forEach((video) => {
        video.currentTime = 0;
        void video.play().catch(() => showFinalFrame(video));
      });
    }, CHARACTER_START_MS);

    return () => {
      window.clearTimeout(timer);
      videos.forEach((video) => video.pause());
    };
  }, [instant]);

  return (
    <ResultStage plateSrc={HUMAN_WIN_PLATE_SRC} plateWidth={941} plateHeight={1672} variant="human">
      <div className={styles.humanComposition} data-intro={instant ? 'complete' : 'animate'}>
        {/* Logo and the trophy baked into the clean plate are visible first. */}
        <Image
          className={styles.humanLogo}
          src={HUMAN_WIN_LOGO_SRC}
          alt="AU vs AI — The 60 Second Challenge"
          width={1024}
          height={342}
          unoptimized
          priority
          draggable={false}
        />
        <p className={styles.humanLogoTagline} aria-hidden="true">The 60 Second Challenge</p>

        <video
          ref={mascotRef}
          className={`${styles.characterVideo} ${styles.mascotVideo}`}
          src={HUMAN_WIN_MASCOT_VIDEO_SRC}
          poster={HUMAN_WIN_MASCOT_POSTER_SRC}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-hidden="true"
          tabIndex={-1}
          onEnded={(event) => event.currentTarget.pause()}
        />
        <video
          ref={aiRef}
          className={`${styles.characterVideo} ${styles.defeatedAiVideo}`}
          src={HUMAN_WIN_AI_VIDEO_SRC}
          poster={HUMAN_WIN_AI_POSTER_SRC}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-hidden="true"
          tabIndex={-1}
          onEnded={(event) => event.currentTarget.pause()}
        />

        <Image
          className={styles.humanForeground}
          src={HUMAN_WIN_FOREGROUND_SRC}
          alt=""
          aria-hidden="true"
          width={941}
          height={1672}
          unoptimized
          priority
          draggable={false}
        />

        <h1 className={styles.humanityHeadline}>Humanity +1</h1>

        <div className={styles.verdictReveal}>
          <p className={styles.verdict}>You beat the AI!</p>
          <p className={styles.verdictSubtitle}>Creativity still wins.</p>
        </div>

        <div className={styles.statsReveal}>
          <section className={styles.humanStatsPanel} aria-label="Your result">
            <p className={styles.scoreLabel}>Your score</p>
            <p className={styles.rankLabel}>Your rank</p>
            <span className={styles.statsDivider} aria-hidden="true" />
            <span className={styles.quoteDivider} aria-hidden="true" />
            <p className={styles.resultQuote}>
              <svg className={styles.quoteIcon} viewBox="0 0 48 48" aria-hidden="true">
                <path d="M12 7h24v7c0 8-5 14-12 14S12 22 12 14V7ZM12 11H7v4c0 5 3 8 8 9M36 11h5v4c0 5-3 8-8 9M24 28v7M16 41h16M19 35h10v6" />
              </svg>
              <span>“A brighter tomorrow still belongs to human minds.”</span>
            </p>
          </section>

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
        </div>

        <div className={styles.actionsReveal}>
          <PlateButton
            href={leaderboardHref}
            label={leaderboardButtonLabel}
            className={styles.leaderboardButton}
            icon="leaderboard"
          />
          <PlateButton
            href={joinHref}
            label={joinButtonLabel}
            className={styles.joinButton}
            icon="club"
          />

          <ResultNotice>{notice}</ResultNotice>
          <p className={styles.humanFooter}>
            <span aria-hidden="true" />
            More minds. A brighter tomorrow.
            <span aria-hidden="true" />
          </p>
        </div>
      </div>
    </ResultStage>
  );
}

function showFinalFrame(video: HTMLVideoElement) {
  const seek = () => {
    if (!Number.isFinite(video.duration)) return;
    video.currentTime = Math.max(0, video.duration - 1 / 30);
    video.pause();
  };

  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) seek();
  else video.addEventListener('loadedmetadata', seek, { once: true });
}
