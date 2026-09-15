import Image from 'next/image';
import styles from './StatusScreen.module.css';

/**
 * Challenge Paused — shown when the server refuses to start a game with
 * NEW_GAMES_PAUSED. The pause itself is enforced by start_attempt(); this is
 * only what the student sees.
 *
 * The plate paints everything but the button's contents: logo, menu glyph
 * (decorative; this screen has no menu), characters, pause sign, campus,
 * title, explanation and the button shell.
 */
export const PAUSED_PLATE_SRC = '/design/paused/plate.webp';

export function ChallengePaused({ homeHref }: { homeHref: string }) {
  return (
    <main className={styles.page}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={PAUSED_PLATE_SRC} alt="" aria-hidden="true" className={styles.backdrop} />
      <div className={styles.stage}>
        <Image
          src={PAUSED_PLATE_SRC}
          alt=""
          aria-hidden="true"
          width={853}
          height={1844}
          unoptimized
          loading="eager"
          fetchPriority="high"
          draggable={false}
          className={styles.plate}
        />

        {/* Title and explanation painted into the plate. */}
        <h1 className="sr-only">Challenge paused</h1>
        <p className="sr-only" role="status">
          New games are temporarily paused by the AIDA team. Please try again shortly.
        </p>

        <a href={homeHref} className={styles.pausedHome}>
          <HomeIcon className={styles.homeIcon} />
          <span className={styles.ctaLabel}>Back to Home</span>
        </a>
      </div>
    </main>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 22 24 7l18 15" />
      <path d="M11 18v23h9V30h8v11h9V18" />
    </svg>
  );
}
