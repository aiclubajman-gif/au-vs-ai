import { screenStyle } from './geometry';
import styles from './HangingScreen.module.css';

const TITLE_SRC = '/arena-tv/logo-au-vs-ai.webp';

/**
 * The big screen hanging under the ring: the painted frame, and on its LED
 * panel the AU vs AI title — breathing glow, a light sweep across the lettering
 * now and then, an LED pixel grid and a slow scan line over everything.
 */
export function HangingScreen({ tagline }: { tagline: string }) {
  return (
    <div className={styles.screen} style={screenStyle()}>
      <div className={styles.halo} aria-hidden="true" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.frame} src="/arena-tv/hanging-screen.webp" alt="" draggable={false} />
      <div className={styles.led}>
        <div className={styles.wash} aria-hidden="true" />
        <h1 className={styles.title}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.titleGlow} src={TITLE_SRC} alt="" aria-hidden="true" draggable={false} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.titleArt} src={TITLE_SRC} alt="AU vs AI" draggable={false} />
          <span className={styles.sheen} aria-hidden="true" />
        </h1>
        <p className={styles.tagline}>{tagline}</p>
        <div className={styles.pixels} aria-hidden="true" />
        <div className={styles.scan} aria-hidden="true" />
      </div>
    </div>
  );
}
