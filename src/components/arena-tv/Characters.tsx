import styles from './Characters.module.css';

/*
 * The two fighters. Each is the untouched character art plus an "emissive"
 * layer holding only its glowing lines (made by the asset build), blended on
 * top and pulsed — so the neon brightens and dims without redrawing anything.
 * Motion is split across nested wrappers (entrance → float → sway) so the
 * animations never fight over one transform.
 */

export function Mascot() {
  return (
    <div className={styles.mascot} aria-hidden="true">
      <div className={styles.float}>
        <div className={styles.sway}>
          <div className={styles.aura} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.art} src="/arena-tv/mascot.webp" alt="" draggable={false} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.neon} src="/arena-tv/mascot-glow.webp" alt="" draggable={false} />
          <span className={styles.sheen} />
        </div>
      </div>
    </div>
  );
}

export function AiFighter() {
  return (
    <div className={styles.ai} aria-hidden="true">
      <div className={styles.drift}>
        <div className={styles.aura} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.art} src="/arena-tv/ai.webp" alt="" draggable={false} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={`${styles.neon} ${styles.bloom}`} src="/arena-tv/ai-glow.webp" alt="" draggable={false} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.neon} src="/arena-tv/ai-glow.webp" alt="" draggable={false} />
      </div>
    </div>
  );
}
