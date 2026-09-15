import type { ReactNode } from 'react';
import Image from 'next/image';
import styles from './Result.module.css';

/**
 * The frame both result screens share: the plate fitted whole inside the
 * viewport, the blurred copy behind it on tall phones, and a stage that
 * overlays are placed on in artwork pixels (see Result.module.css).
 */
export function ResultStage({
  plateSrc,
  plateWidth,
  plateHeight,
  variant,
  children,
}: {
  plateSrc: string;
  /** The plate's size in artwork pixels; the stylesheet sets the same per variant. */
  plateWidth: number;
  plateHeight: number;
  variant: 'human' | 'ai';
  children: ReactNode;
}) {
  return (
    <main className={styles.page} data-variant={variant}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={plateSrc} alt="" aria-hidden="true" className={styles.backdrop} />
      <div className={styles.stage}>
        <Image
          src={plateSrc}
          alt=""
          aria-hidden="true"
          width={plateWidth}
          height={plateHeight}
          unoptimized
          loading="eager"
          fetchPriority="high"
          draggable={false}
          className={styles.plate}
        />
        {children}
      </div>
    </main>
  );
}

/**
 * A painted button made real. The plate draws the shell, icon and arrow; this
 * is the transparent link over it with the live label. They navigate, so they
 * are links: a screen reader announces where they go.
 */
export function PlateButton({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className: string;
}) {
  return (
    <a href={href} className={`${styles.button} ${className}`}>
      <span className={styles.buttonLabel}>{label}</span>
    </a>
  );
}

/** The one-attempt reminder for a student reopening a finished game. */
export function ResultNotice({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className={styles.notice}>{children}</p>;
}
