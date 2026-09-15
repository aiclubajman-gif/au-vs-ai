'use client';

import Image from 'next/image';
import styles from './StatusScreen.module.css';

/**
 * Something Went Wrong — shown when the server declines to start a game for
 * any reason other than a pause (the `blocked` step).
 *
 * The plate paints the logo, warning sign, scene, title, the empty card and
 * the Try Again button shell. The lead, the card's icon and copy, the button
 * contents and Back to Home are HTML, so each refusal keeps its own accurate
 * explanation.
 */
export const ERROR_PLATE_SRC = '/design/error/plate.webp';

export interface SomethingWentWrongProps {
  /** One or two short lines under the title. */
  lead: string;
  cardTitle: string;
  cardBody: string;
  icon: 'offline' | 'alert';
  /** Support reference, for failures staff need to look up. */
  reference?: string;
  onRetry: () => void;
  homeHref: string;
}

export function SomethingWentWrong({
  lead,
  cardTitle,
  cardBody,
  icon,
  reference,
  onRetry,
  homeHref,
}: SomethingWentWrongProps) {
  return (
    <main className={styles.page}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ERROR_PLATE_SRC} alt="" aria-hidden="true" className={styles.backdrop} />
      <div className={styles.stage}>
        <Image
          src={ERROR_PLATE_SRC}
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

        {/* Title painted into the plate. */}
        <h1 className="sr-only">Something went wrong</h1>

        <div role="alert">
          <p className={styles.errorLead}>{lead}</p>
          <div className={styles.errorCard}>
            {icon === 'offline' ? (
              <OfflineIcon className={styles.errorIcon} />
            ) : (
              <AlertIcon className={styles.errorIcon} />
            )}
            <div className={styles.errorCopy}>
              <p className={styles.errorTitle}>{cardTitle}</p>
              <p className={styles.errorBody}>{cardBody}</p>
            </div>
          </div>
        </div>
        {reference && (
          <p className={styles.errorRef}>
            Reference <span className="tabular">{reference}</span>
          </p>
        )}

        <button type="button" className={styles.retry} onClick={onRetry}>
          <RetryIcon className={styles.retryIcon} />
          <span className={styles.ctaLabel}>Try again</span>
        </button>

        <a href={homeHref} className={styles.errorHome}>
          <ChevronIcon className={styles.chevron} />
          <span>Back to Home</span>
        </a>
      </div>
    </main>
  );
}

function OfflineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" aria-hidden="true">
      <path d="M5 18.5a27 27 0 0 1 38 0M11 25a18 18 0 0 1 26 0M17 31.5a9.5 9.5 0 0 1 14 0" />
      <circle cx="24" cy="38" r="2.6" fill="currentColor" stroke="none" />
      <path d="M10 8l30 34" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" aria-hidden="true">
      <circle cx="24" cy="24" r="19" />
      <path d="M24 13v14" />
      <circle cx="24" cy="34" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function RetryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M39 24a15 15 0 1 1-4.4-10.6" />
      <path d="M36 5v9h-9" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 4l-8 8 8 8" />
    </svg>
  );
}
