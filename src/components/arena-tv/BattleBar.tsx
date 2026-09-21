import { useCallback, useRef, type CSSProperties } from 'react';
import type { ArenaLead, BattleShare } from '@/lib/arena/types';
import { ClashFX } from './ClashFX';
import { ARENA_TIMING } from './config';
import { useRollingNumber } from './hooks';
import styles from './BattleBar.module.css';

/** The lane's design height; the collision layer is drawn against it. */
const LANE_H = 54;

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
  lead,
  intro = ARENA_INTRO,
}: {
  share: BattleShare;
  lead: ArenaLead;
  intro?: { from: number; delayMs: number } | null;
}) {
  const opening = battleBarView(intro ? intro.from : share.humanPct);

  const rootRef = useRef<HTMLElement>(null);
  const humanRef = useRef<HTMLSpanElement>(null);
  const aiRef = useRef<HTMLSpanElement>(null);
  /*
   * The one live share, and the only one. The roll writes it here, the lane
   * fills to it through --human, the two percentages are read off it, and the
   * collision layer takes the very same number — so nothing on the bar can
   * ever be drawing one figure while the numbers beside it read another.
   */
  const liveShare = useRef(opening.fill);

  useRollingNumber(
    share.humanPct,
    useCallback((value: number) => {
      const view = battleBarView(value);
      liveShare.current = view.fill;
      rootRef.current?.style.setProperty('--human', String(view.fill));
      if (humanRef.current) humanRef.current.textContent = String(view.human);
      if (aiRef.current) aiRef.current.textContent = String(view.ai);
    }, []),
    intro ?? {},
  );

  return (
    <section
      ref={rootRef}
      className={styles.battle}
      style={{ '--human': opening.fill } as CSSProperties}
      aria-label={`Battle share: humans ${share.humanPct}%, AI ${share.aiPct}%`}
    >
      <p className={`${styles.pct} ${styles.pctHuman}`}>
        <span ref={humanRef} className="tabular">
          {opening.human}
        </span>
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

          {/* The hard dark gap the two colours never cross. Everything else at
              the contact point — the core, its bloom and the sparks — is drawn
              by the collision layer over the top. */}
          <div className={styles.clash}>
            <span className={styles.gap} />
          </div>

          {/* Mounted once and never re-keyed: score changes and lead changes
              are read from refs inside it, so neither can restart the canvas
              or lose the particles already in the air. */}
          <ClashFX shareRef={liveShare} lead={lead} laneHeight={LANE_H} />
        </div>
      </div>

      <p className={`${styles.pct} ${styles.pctAi}`}>
        <span ref={aiRef} className="tabular">
          {opening.ai}
        </span>
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
