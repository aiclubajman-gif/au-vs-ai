import type { CSSProperties } from 'react';
import { RING_PANELS, ringStyle } from './geometry';
import styles from './LedRing.module.css';

/**
 * What the ring's LED band shows, in order, repeated all the way round: the
 * institutional marks only. The AU vs AI lockup is the hanging screen's — the
 * ring stays club and university branding, so the two never compete.
 *
 * RING_PANELS must stay a multiple of this many, or the cycle would break
 * where it wraps.
 */
const RING_LOGOS = [
  { src: '/arena-tv/ring-aida.webp', kind: 'aida' },
  { src: '/arena-tv/ring-ajman-university.webp', kind: 'ajman' },
] as const;

/**
 * The suspended LED ring. The ring itself is the painted art and never moves;
 * its content is a CSS 3D cylinder of logo panels fitted to the painted band
 * (see geometry.ts), turning slowly, so the logos wrap round the curve and
 * foreshorten toward its sides like a real circular screen.
 */
export function LedRing() {
  return (
    <div className={styles.ring} style={ringStyle()} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.frame} src="/arena-tv/led-ring.webp" alt="" draggable={false} />
      <div className={styles.content}>
        <div className={styles.scene}>
          <div className={styles.cylinder}>
            {Array.from({ length: RING_PANELS }, (_, i) => {
              const logo = RING_LOGOS[i % RING_LOGOS.length];
              return (
                <div key={i} className={styles.panel} style={{ '--i': i } as CSSProperties}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={styles.logo} data-kind={logo.kind} src={logo.src} alt="" draggable={false} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
