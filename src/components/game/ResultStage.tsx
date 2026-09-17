import type { ReactNode } from 'react';
import { PlateScreen } from '@/components/ui/PlateScreen';
import styles from './Result.module.css';

/**
 * The frame both result screens share: the full-screen plate stage, with the
 * crop band for each variant set in Result.module.css.
 */
export function ResultStage({
  plateSrc,
  plateWidth,
  plateHeight,
  variant,
  children,
}: {
  plateSrc: string;
  /** The plate's size in artwork pixels. */
  plateWidth: number;
  plateHeight: number;
  variant: 'human' | 'ai';
  children: ReactNode;
}) {
  return (
    <PlateScreen
      plateSrc={plateSrc}
      plateWidth={plateWidth}
      plateHeight={plateHeight}
      className={styles.page}
      data-variant={variant}
    >
      {children}
    </PlateScreen>
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
  icon,
}: {
  href: string;
  label: string;
  className: string;
  icon?: 'leaderboard' | 'club';
}) {
  return (
    <a href={href} className={`${styles.button} ${className}`}>
      {icon === 'leaderboard' ? (
        <svg className={styles.buttonIcon} viewBox="0 0 48 48" aria-hidden="true">
          <path d="M6 41h36M10 41V22h9v19M20 41V8h9v33M30 41V16h9v25" />
        </svg>
      ) : null}
      {icon === 'club' ? (
        <svg className={styles.buttonIcon} viewBox="0 0 56 48" aria-hidden="true">
          <circle cx="28" cy="13" r="7" />
          <circle cx="12" cy="19" r="5" />
          <circle cx="44" cy="19" r="5" />
          <path d="M17 42v-6c0-7 5-12 11-12s11 5 11 12v6M3 42v-5c0-6 4-10 9-10 3 0 6 2 7 4M53 42v-5c0-6-4-10-9-10-3 0-6 2-7 4" />
        </svg>
      ) : null}
      <span className={styles.buttonLabel}>{label}</span>
      {icon ? <span className={styles.buttonArrow} aria-hidden="true">→</span> : null}
    </a>
  );
}

/** The one-attempt reminder for a student reopening a finished game. */
export function ResultNotice({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className={styles.notice}>{children}</p>;
}
