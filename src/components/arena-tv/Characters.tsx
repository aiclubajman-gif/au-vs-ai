import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import styles from './Characters.module.css';

/*
 * The two fighters. Each is the untouched character art plus an "emissive"
 * layer holding only its glowing lines (made by the asset build), blended on
 * top and pulsed — so the neon brightens and dims without redrawing anything.
 * Motion is split across nested wrappers (entrance → float → sway) so the
 * animations never fight over one transform.
 *
 * The mascot has a second, better form: mascot.webm, the same artwork with the
 * character actually moving. It takes over once it is really playing, and the
 * still one stays behind it for everything else (see useMascotMotion).
 */

/** The mascot's still cut-out: what the screen opens on, and its fallback. */
const MASCOT_STILL = '/arena-tv/mascot.webp';
/** The same character, animated, with real transparency. Decorative; muted. */
const MASCOT_MOTION = '/arena-tv/mascot.webm';

export const Mascot = memo(function Mascot() {
  const { videoRef, showing, wanted, onPlaying, onFailed } = useMascotMotion();
  return (
    <div className={styles.mascot} data-mascot={showing} aria-hidden="true">
      {/* The light the mascot throws behind it; the same on both paths. */}
      <div className={styles.aura} />
      <div className={styles.float}>
        <div className={styles.sway}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.art} src={MASCOT_STILL} alt="" draggable={false} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.neon} src="/arena-tv/mascot-glow.webp" alt="" draggable={false} />
          <span className={styles.sheen} />
        </div>
      </div>
      {wanted && (
        <video
          ref={videoRef}
          className={styles.video}
          poster={MASCOT_STILL}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          controls={false}
          disablePictureInPicture
          tabIndex={-1}
          aria-hidden="true"
          onPlaying={onPlaying}
          onError={onFailed}
        >
          <source src={MASCOT_MOTION} type="video/webm" onError={onFailed} />
        </video>
      )}
    </div>
  );
});

/**
 * Which mascot the screen is showing, and when it changes.
 *
 * It opens on the still cut-out and only crosses to the video once that is
 * genuinely playing, so nothing ever flashes through an empty mascot. The move
 * happens once: if the video later fails it goes back to the still one for
 * good, and there is no other way back, so the two never trade places on a
 * screen that is left running.
 *
 * Nothing is fetched or decoded on the server, nor on a display that has asked
 * for less motion — there the video element is simply never created and the
 * approved still mascot is the whole of it.
 */
function useMascotMotion() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const allowed = useSyncExternalStore(watchMotionPreference, motionAllowed, motionAllowedOnServer);
  const [showing, setShowing] = useState<'still' | 'video'>('still');
  const [failed, setFailed] = useState(false);
  const wanted = allowed && !failed;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // It carries an audio track it must never play, whatever the markup did.
    video.muted = true;
    // autoPlay has usually started it already; this covers a browser that
    // wants the call made outright. Where it is refused, `playing` never fires
    // and the still mascot simply stays up.
    video.play().catch(() => {});
  }, [wanted]);

  const onFailed = useCallback(() => {
    setFailed(true);
    setShowing('still');
  }, []);

  return { videoRef, wanted, showing, onPlaying: useCallback(() => setShowing('video'), []), onFailed };
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function watchMotionPreference(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

const motionAllowed = () => !window.matchMedia(REDUCED_MOTION).matches;

/** No display to ask on the server, so the markup it sends is the still one. */
const motionAllowedOnServer = () => false;

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
