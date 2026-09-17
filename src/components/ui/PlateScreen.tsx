'use client';

import {
  useLayoutEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import Image from 'next/image';
import { readAppHeight, useAppHeight } from '@/lib/client/use-app-height';
import styles from './PlateScreen.module.css';

/**
 * The full-screen shell every plate screen shares.
 *
 * The shell is exactly the visible viewport (see `useAppHeight`) and does not
 * scroll. Inside it the stage carries the plate: on a phone held upright it is
 * always the full width of the screen, and a plate taller than the screen is
 * cropped top and bottom rather than narrowed. Each screen's stylesheet says
 * which band of its plate must stay visible and where the crop falls; see
 * PlateScreen.module.css. Only a screen that sets `--keep-give` can scroll, and
 * only on a phone too short for its band (see `useScrollWhenTooShort`).
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
  const stageRef = useRef<HTMLDivElement>(null);
  useAppHeight(ref);
  useScrollWhenTooShort(ref, stageRef, plateWidth, plateHeight);

  return (
    <main
      ref={ref}
      className={className ? `${styles.shell} ${className}` : styles.shell}
      style={{ ...style, '--plate-w': plateWidth, '--plate-h': plateHeight } as CSSProperties}
      {...rest}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={plateSrc} alt="" aria-hidden="true" className={styles.backdrop} />
      <div ref={stageRef} className={styles.stage} data-stage="">
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

/**
 * Marks the shell `data-scroll` while the visible viewport is too short for its
 * keep band even after the bottom has given up `--keep-give`, so the screen
 * scrolls rather than lose the top of the band. Screens without `--keep-give`
 * are never marked. Checked on the same events as `useAppHeight`, after it.
 */
function useScrollWhenTooShort(
  ref: RefObject<HTMLElement | null>,
  stageRef: RefObject<HTMLDivElement | null>,
  plateWidth: number,
  plateHeight: number,
) {
  useLayoutEffect(() => {
    const shell = ref.current;
    const stage = stageRef.current;
    if (!shell || !stage) return;

    const style = getComputedStyle(shell);
    const read = (name: string, fallback: number) => {
      const value = parseFloat(style.getPropertyValue(name));
      return Number.isFinite(value) ? value : fallback;
    };

    const apply = () => {
      const give = read('--keep-give', 0);
      if (give <= 0) {
        shell.removeAttribute('data-scroll');
        return;
      }
      // Both in CSS pixels: what must show, and what the screen shows.
      const u = stage.getBoundingClientRect().width / plateWidth;
      const band = (read('--keep-bottom', plateHeight) - give - read('--keep-top', 0)) * u;
      shell.toggleAttribute('data-scroll', band > readAppHeight() + 0.5);
    };
    apply();

    const vv = window.visualViewport;
    vv?.addEventListener('resize', apply);
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    return () => {
      vv?.removeEventListener('resize', apply);
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
    };
  }, [ref, stageRef, plateWidth, plateHeight]);
}
