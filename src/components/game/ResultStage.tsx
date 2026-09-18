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
