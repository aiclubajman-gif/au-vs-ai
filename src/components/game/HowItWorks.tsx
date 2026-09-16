'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import { useAutoAdvance } from '@/components/game/auto-advance';
import styles from './HowItWorks.module.css';

/**
 * How It Works — the explainer before Round 1 (the `intro1` step).
 *
 * The plate is the finished artwork: characters, AIDA logo, wordmark, the HOW
 * IT WORKS title, every neon frame, the stopwatch icons and the CTA body. The
 * HTML only fills the slots the plate leaves empty, in artwork pixels (see the
 * stylesheet), so it stays registered to the frames at any phone size.
 *
 * Every time shown is from the event settings and this student's assignment.
 * Round 1's figure is the whole round: images assigned × seconds per image.
 */
export const HOW_IT_WORKS_PLATE_SRC = '/design/how-it-works/plate.webp';

/** Longer than the round interstitials: there is more to read here. */
const AUTO_ADVANCE_SECONDS = 12;

export function HowItWorks({
  round1Images,
  round1MsPerImage,
  round2DrawMs,
  round3Ms,
  onDone,
}: {
  round1Images: number;
  round1MsPerImage: number;
  round2DrawMs: number;
  round3Ms: number;
  onDone: () => void;
}) {
  const { remaining, advance } = useAutoAdvance(AUTO_ADVANCE_SECONDS, onDone);

  const perImage = Math.round(round1MsPerImage / 1000);
  const round1 = round1Images * perImage;
  const round2 = Math.round(round2DrawMs / 1000);
  const round3 = Math.round(round3Ms / 1000);

  const rounds: RoundCard[] = [
    {
      n: 1,
      thumb: '/design/how-it-works/round-1.webp',
      title: <>Spot the fake</>,
      body: (
        <>
          Can you tell what&rsquo;s real
          <br />
          and what&rsquo;s AI?
        </>
      ),
      seconds: round1,
      spoken: `${round1Images} images, ${perImage} seconds each`,
    },
    {
      n: 2,
      thumb: '/design/how-it-works/round-2.webp',
      title: (
        <>
          Draw <span className={styles.vs}>vs</span> AI
        </>
      ),
      body: (
        <>
          Draw the prompt. Can the
          <br />
          AI tell what it is?
        </>
      ),
      seconds: round2,
      spoken: `${round2} seconds to draw`,
    },
    {
      n: 3,
      thumb: '/design/how-it-works/round-3.webp',
      title: (
        <>
          You <span className={styles.vs}>vs</span> AIDA
        </>
      ),
      body: (
        <>
          Take on AIDA with a fun
          <br />
          knowledge challenge.
        </>
      ),
      seconds: round3,
      spoken: `${round3} seconds to answer`,
    },
  ];

  return (
    <main className={styles.page}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={HOW_IT_WORKS_PLATE_SRC} alt="" aria-hidden="true" className={styles.backdrop} />
      <div className={styles.stage}>
        <Image
          src={HOW_IT_WORKS_PLATE_SRC}
          alt=""
          aria-hidden="true"
          width={941}
          height={1672}
          unoptimized
          loading="eager"
          fetchPriority="high"
          draggable={false}
          className={styles.plate}
        />

        {/* Logo, wordmark and title are painted into the plate. */}
        <h1 className="sr-only">AU vs AI. How it works.</h1>

        <p className={styles.summary}>
          3 rounds. <span className="tabular">{round1 + round2 + round3}</span> seconds.
        </p>
        <p className={styles.tagline} aria-hidden="true">
          Human creativity <span className={styles.times}>×</span> AI possibilities
        </p>

        <ol className={styles.rounds}>
          {rounds.map((r) => (
            <li key={r.n} className={styles.round} data-round={r.n}>
              <p className={styles.number}>
                <span className={styles.numberLabel}>Round</span>
                <span className={styles.numberValue}>{String(r.n).padStart(2, '0')}</span>
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.thumb} alt="" className={styles.thumb} draggable={false} />
              <div className={styles.copy}>
                <h2 className={styles.title}>{r.title}</h2>
                <p className={styles.body}>{r.body}</p>
              </div>
              <p className={styles.time}>
                <span className={`${styles.seconds} tabular`} aria-hidden="true">
                  {r.seconds}
                </span>
                <span className={styles.secondsLabel} aria-hidden="true">
                  Seconds
                </span>
                <span className="sr-only">{`${r.seconds} seconds: ${r.spoken}.`}</span>
              </p>
            </li>
          ))}
        </ol>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/design/how-it-works/one-attempt-star.png"
          alt=""
          aria-hidden="true"
          className={styles.star}
          draggable={false}
        />
        <div className={styles.attempt}>
          <p className={styles.attemptTitle}>One attempt only</p>
          <p className={styles.attemptBody}>
            Each challenge can only be played once.
            <br />
            Give it your best shot!
          </p>
        </div>

        {/* The plate paints the button; this is the real, transparent control over it. */}
        <button type="button" className={styles.cta} onClick={advance}>
          <GamepadIcon className={styles.ctaIcon} />
          <span className={styles.ctaLabel}>Let&rsquo;s play</span>
          <ArrowIcon className={styles.ctaArrow} />
        </button>
        <p className={styles.auto}>
          Starts by itself in <span className="tabular">{remaining}</span>s
        </p>
      </div>
    </main>
  );
}

interface RoundCard {
  n: 1 | 2 | 3;
  thumb: string;
  title: ReactNode;
  body: ReactNode;
  seconds: number;
  /** Timing as a screen reader should hear it. */
  spoken: string;
}

function GamepadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 44" fill="none" aria-hidden="true">
      <path
        d="M19 4h26c8.4 0 12.8 6 14.4 16.8 1.6 11.2-.6 17.2-5.8 17.2-4.6 0-7.2-5.6-10.6-9H21c-3.4 3.4-6 9-10.6 9-5.2 0-7.4-6-5.8-17.2C6.2 10 10.6 4 19 4Z"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinejoin="round"
      />
      <path d="M20 13v10M15 18h10" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="43" cy="14" r="2.6" fill="currentColor" />
      <circle cx="49" cy="20" r="2.6" fill="currentColor" />
      <circle cx="37" cy="20" r="2.6" fill="currentColor" />
      <circle cx="43" cy="26" r="2.6" fill="currentColor" />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 32" fill="none" aria-hidden="true">
      <path
        d="M3 16h40M30 3l13 13-13 13"
        stroke="currentColor"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
