'use client';

import Image from 'next/image';
import { useAutoAdvance } from '@/components/game/Interstitial';
import styles from './FunFact.module.css';

/**
 * Fun Fact — the outro after Round 1 (the `outro1` step).
 *
 * The plate paints the space scene, the glass panel and the button body. The
 * AU vs AI logo, the brain and the mascot are the supplied production assets,
 * and the heading, the fact, the button label and the footer are HTML. The
 * mascot is cut out of its sticker (no border, sign or badges), so it stands in
 * the panel's left column on its own. Untimed like every
 * interstitial: the button and the countdown share one guard, so the game moves
 * on exactly once.
 */
export const FUN_FACT_PLATE_SRC = '/design/fun-fact/plate.webp';

const AUTO_ADVANCE_SECONDS = 7;

export function FunFact({ onDone }: { onDone: () => void }) {
  const { remaining, advance } = useAutoAdvance(AUTO_ADVANCE_SECONDS, onDone);

  return (
    <main className={styles.page}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={FUN_FACT_PLATE_SRC} alt="" aria-hidden="true" className={styles.backdrop} />
      <div className={styles.stage}>
        <Image
          src={FUN_FACT_PLATE_SRC}
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

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/design/fun-fact/au-vs-ai-logo.webp"
          alt="AU vs AI"
          width={840}
          height={294}
          className={styles.logo}
          draggable={false}
        />

        <h1 className={styles.heading}>Fun fact</h1>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/design/fun-fact/brain.png"
          alt=""
          aria-hidden="true"
          className={styles.brain}
          draggable={false}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/design/fun-fact/mascot.webp"
          alt=""
          aria-hidden="true"
          width={567}
          height={691}
          className={styles.mascot}
          draggable={false}
        />

        <div className={styles.fact}>
          <p className={styles.lead}>
            AI mistakes are no
            <br />
            longer limited to
            <br />
            extra fingers&hellip;
          </p>
          <p className={styles.clues}>
            <span className={styles.small}>the hardest clues can be</span>
            <br />
            <strong className={styles.strong}>inconsistent</strong>
            <br />
            <strong className={styles.mark} data-tone="cyan">
              reflections
            </strong>
            <strong className={styles.strong}>,</strong>{' '}
            <strong className={styles.mark} data-tone="orange">
              lighting
            </strong>
            <br />
            <span className={styles.or}>or</span>{' '}
            <strong className={styles.mark} data-tone="yellow">
              text.
            </strong>
          </p>
        </div>

        {/* The plate paints the button; this is the real, transparent control over it. */}
        <button type="button" className={styles.cta} onClick={advance}>
          <span className={styles.ctaLabel}>Next round</span>
          <ArrowIcon className={styles.ctaArrow} />
        </button>
        <p className={styles.auto}>
          Continues by itself in <span className="tabular">{remaining}</span>s
        </p>

        <p className={styles.footer}>
          <span className={styles.rule} aria-hidden="true" />
          <span className={styles.footerText}>
            Same minds. Different possibilities.
            <br />A brighter tomorrow.
          </span>
          <span className={styles.rule} aria-hidden="true" />
        </p>
      </div>
    </main>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 32" fill="none" aria-hidden="true">
      <path
        d="M3 16h40M30 3l13 13-13 13"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
