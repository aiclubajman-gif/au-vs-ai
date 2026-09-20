import type { CSSProperties } from 'react';
import type { BattleShare } from '@/lib/arena/types';
import { ARENA_TIMING } from './config';
import { useCountUp } from './hooks';
import styles from './BattleBar.module.css';

/** Spark directions around the clash point (dx, dy in px). */
const SPARKS = [
  [-44, -22], [-54, 8], [-34, 27], [42, -24], [52, 6], [32, 29],
] as const;

const clamp = (v: number) => Math.max(0, Math.min(100, v));

/**
 * What the bar draws for a given human share — the whole of it, from one
 * number.
 *
 * `fill` is where the two sides meet, as a percentage of the lane; `human` and
 * `ai` are the percentages printed either side of it. The AI's is the
 * remainder of the human's, never a second measurement, so the pair always
 * reads 100 between them and always agrees with where the bar is filled to —
 * at rest and at every frame of the roll between two shares.
 */
export function battleBarView(humanShare: number) {
  const fill = clamp(humanShare);
  const human = Math.round(fill);
  return { fill, human, ai: 100 - human };
}

/** The arena screen opens level at 50/50 and rolls out once its HUD is in. */
const ARENA_INTRO = { from: 50, delayMs: ARENA_TIMING.introDelayMs };

/**
 * The tug of war: blue drives the lane from the left, orange from the right,
 * and where they meet the clash point flares.
 *
 * The share is derived from the win counts once, up in ArenaLeaderboardTV, and
 * arrives here already worked out. A new one rolls the bar and both numbers
 * there together — they are the same value, read twice — and sets off a burst
 * at the clash.
 *
 * `intro` is the share it opens on before that first roll, and how long it
 * waits before starting; null opens straight on the real share.
 */
export function BattleBar({
  share,
  intro = ARENA_INTRO,
}: {
  share: BattleShare;
  intro?: { from: number; delayMs: number } | null;
}) {
  const rolling = useCountUp(share.humanPct, intro ?? {});
  const { fill, human, ai } = battleBarView(rolling);

  return (
    <section
      className={styles.battle}
      style={{ '--human': fill } as CSSProperties}
      aria-label={`Battle share: humans ${share.humanPct}%, AI ${share.aiPct}%`}
    >
      <p className={`${styles.pct} ${styles.pctHuman}`}>
        <span className="tabular">{human}</span>
        <small>%</small>
      </p>

      <div className={styles.bar}>
        <div className={styles.lane} aria-hidden="true">
          {/* The chassis the lit body is mounted in, pointed past each end. */}
          <div className={styles.shell} />

          {/* The well, and the two fills driven into it from either side. */}
          <div className={styles.track}>
            <div className={`${styles.side} ${styles.sideHuman}`}>
              <span className={styles.body} />
              <span className={styles.chevrons} />
              <span className={styles.bevel} />
              <span className={styles.rails} />
            </div>

            <div className={`${styles.side} ${styles.sideAi}`}>
              <span className={styles.body} />
              <span className={styles.chevrons} />
              <span className={styles.bevel} />
              <span className={styles.rails} />
            </div>

            {/* Each side's colour bleeding a little past the contact point. */}
            <div className={styles.spill} />
          </div>

          {/* The thin illuminated outline: one copy per side, masked in two. */}
          <div className={`${styles.edge} ${styles.edgeHuman}`}>
            <Silhouette />
          </div>
          <div className={`${styles.edge} ${styles.edgeAi}`}>
            <Silhouette />
          </div>

          <div className={styles.clash}>
            <span className={styles.gap} />
            <span className={styles.seam} />
            <span className={styles.flare} />
            {/* Re-mounted on every new share, so each one sets off its own burst. */}
            <span key={share.humanPct} className={styles.burst} />
            {SPARKS.map(([dx, dy], i) => (
              <span
                key={i}
                className={styles.spark}
                data-side={dx < 0 ? 'human' : 'ai'}
                style={{ '--dx': `${dx}px`, '--dy': `${dy}px`, '--delay': `${i * 0.27}s` } as CSSProperties}
              />
            ))}
          </div>
        </div>
      </div>

      <p className={`${styles.pct} ${styles.pctAi}`}>
        <span className="tabular">{ai}</span>
        <small>%</small>
      </p>
    </section>
  );
}

/**
 * The bar's silhouette, stroked: the dark structural shell, and the lit body
 * seated inside it.
 *
 * Drawn once per side and masked to that side's half of the lane, so the
 * outline changes colour exactly where the two fills meet. Stroking it rather
 * than stacking two filled shapes is what keeps the glow honest: the only
 * thing on the bar carrying a drop-shadow is a 2px line, so the bloom hugs the
 * edges instead of turning the whole object into a blurred rectangle.
 *
 * The points are the lane's design pixels, 0,0 at its top-left corner. The CSS
 * cuts the same two shapes with clip-path, so --lane-w, --lane-h and the two
 * --cap values in BattleBar.module.css have to stay in step with them.
 */
function Silhouette() {
  return (
    <svg className={styles.edgeArt} viewBox="-13 -6 710 66" preserveAspectRatio="none">
      <polygon className={styles.edgeShell} points="-13,27 16,-6 668,-6 697,27 668,60 16,60" />
      <polygon className={styles.edgeLit} points="0,27 24,0 660,0 684,27 660,54 24,54" />
    </svg>
  );
}
