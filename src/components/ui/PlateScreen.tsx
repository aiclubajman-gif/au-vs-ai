'use client';

import { useRef, type ComponentPropsWithoutRef, type CSSProperties, type ReactNode } from 'react';
import Image from 'next/image';
import { useAppHeight } from '@/lib/client/use-app-height';
import styles from './PlateScreen.module.css';

/**
 * The full-screen shell every plate screen shares.
 *
 * The shell is exactly the visible viewport (see `useAppHeight`) and never
 * scrolls. Inside it the stage carries the plate: on a phone held upright it is
 * always the full width of the screen, and a plate taller than the screen is
 * cropped top and bottom rather than narrowed. Each screen's stylesheet says
 * which band of its plate must stay visible and where the crop falls; see
 * PlateScreen.module.css.
 *
 * Overlays are the children, placed on the stage in artwork pixels (`--u`).
 */
export function PlateScreen({
  plateSrc,
  plateWidth,
  plateHeight,
  className,
  style,
  children,
  ...rest
}: {
  plateSrc: string;
  /** The plate's size in artwork pixels. */
  plateWidth: number;
  plateHeight: number;
  /** The screen's own class: its background and its crop settings. */
  className?: string;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<'main'>, 'className' | 'children'>) {
  const ref = useRef<HTMLElement>(null);
  useAppHeight(ref);

  return (
    <main
      ref={ref}
      className={className ? `${styles.shell} ${className}` : styles.shell}
      style={{ ...style, '--plate-w': plateWidth, '--plate-h': plateHeight } as CSSProperties}
      {...rest}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={plateSrc} alt="" aria-hidden="true" className={styles.backdrop} />
      <div className={styles.stage} data-stage="">
        <Image
          // A new plate replaces the old one outright rather than showing it
          // under the next screen's overlays while it loads.
          key={plateSrc}
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
