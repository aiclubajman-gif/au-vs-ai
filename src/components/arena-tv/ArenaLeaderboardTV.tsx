'use client';

import { useRef, useState, type CSSProperties } from 'react';
import { leadingLight, trailingLight } from '@/lib/arena/atmosphere';
import type { ArenaSource } from '@/lib/arena/source';
import { leadOf, shareOf, type ArenaLead, type ArenaStats } from '@/lib/arena/types';
import { BattleBar } from './BattleBar';
import { AiFighter, Mascot } from './Characters';
import { arenaBadge, createLiveFeed, createMockFeed, FEED_BADGE, useArenaFeed, type FeedStatus } from './feeds';
import { HangingScreen } from './HangingScreen';
import { useDemoKeys, useKioskMode, useLeadChanges, useSelfReload, useStageScale } from './hooks';
import { Leaderboard } from './Leaderboard';
import { LedRing } from './LedRing';
import { SideColumn } from './SideColumn';
import styles from './ArenaLeaderboardTV.module.css';

/** Shown until a live feed's first answer: an even, empty arena (0/0 → 50/50). */
const WAITING: ArenaStats = { humanWins: 0, aiWins: 0, topPlayers: [] };

const TAGLINE = 'Can you beat AI in 60 seconds?';

/**
 * The arena TV screen: a layered stadium scene around live stats.
 *
 * Layers, back to front: the arena photo and its lighting (outside the stage,
 * so they fill any screen shape), then on the 1920 x 1080 stage the LED ring,
 * the hanging screen, the two fighters, the crowds, and the live UI. Every
 * lighting layer lives in the environment, which is painted before the stage
 * and blends only with itself, so no amount of arena light can wash out a
 * number standing on it.
 *
 * `source` picks the data: 'live' polls /api/arena/stats, 'mock' simulates
 * games. See feeds.ts to plug in anything else.
 *
 * The win counts are the screen's only source of truth. The battle share is
 * worked out from them once, here, and that one pair of numbers is what the
 * bar fills to, what the percentages read, and what decides the lighting — so
 * no two parts of the screen can ever disagree. The arena takes four things
 * from that one share: who to light for (leadOf), how hard its rig burns and
 * how far the other side's is taken down (leadingLight / trailingLight, both
 * from the size of the lead), and whether the lead has just changed hands,
 * which is the only thing that makes the arena flare.
 */
export function ArenaLeaderboardTV({ source, className }: { source: ArenaSource; className?: string }) {
  const [feed] = useState(() => (source === 'live' ? createLiveFeed() : createMockFeed()));
  const { stats, status } = useArenaFeed(feed);
  const shown = stats ?? WAITING;
  const share = shareOf(shown);
  const lead = leadOf(share);
  const mood = leadingLight(share);
  const fade = trailingLight(share);
  // stats === null is the waiting board, not a reading: the arena settles into
  // the first real numbers rather than flaring at them.
  const sting = useLeadChanges(lead, stats !== null);

  const rootRef = useRef<HTMLElement>(null);
  useStageScale(rootRef);
  useKioskMode(rootRef);
  useSelfReload();
  useDemoKeys(feed);

  return (
    // data-motion: animate even under "reduce motion" (see globals.css).
    <main ref={rootRef} className={`${styles.tv} ${className ?? ''}`} data-lead={lead} data-motion="always">
      {/* --mood is the winning side's house lights, --fade what is left of the
          other side's; both come from the size of the lead. The arena photo
          itself never moves or changes: only the light on it does. */}
      <div className={styles.environment} aria-hidden="true" style={{ '--mood': mood, '--fade': fade } as CSSProperties}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.arena}
          src="/arena-tv/arena-base-1920.webp"
          srcSet="/arena-tv/arena-base-1920.webp 1920w, /arena-tv/arena-base-3840.webp 3840w"
          sizes="100vw"
          alt=""
          fetchPriority="high"
          draggable={false}
        />
        {/* Fixed: the colour and a little of the brightness out of the room,
            so amber has a chance of beating a photo shot under blue light. */}
        <div className={styles.neutral} />
        <div className={styles.dim} />
        {/* Then the lamps, brightness first and colour after -- a gel sits on
            the lamp, so the light has to arrive already coloured. One element
            per lighting zone, always these five and in this order (the CSS
            picks them out by position): rig and wall / haze / seating bowl /
            barrier practicals / floor pool. The wrapper crossfades with the
            lead, each zone breathes on its own clock, and the two opacities
            multiply. */}
        <div className={`${styles.house} ${styles.houseHuman}`}>
          <Zones />
        </div>
        <div className={`${styles.house} ${styles.houseAi}`}>
          <Zones />
        </div>
        {/* The same lamps again over the other half, for whoever is ahead: a
            house rig that has taken the room has taken all of it. */}
        <div className={`${styles.far} ${styles.farHuman}`}>
          <Zones />
        </div>
        <div className={`${styles.far} ${styles.farAi}`}>
          <Zones />
        </div>
        <div className={`${styles.beam} ${styles.beamLeft}`} />
        <div className={`${styles.beam} ${styles.beamRight}`} />
        {/* Over every lamp above: the leader's colour across the whole room,
            then each side's own half. */}
        <div className={`${styles.flood} ${styles.floodHuman}`} />
        <div className={`${styles.flood} ${styles.floodAi}`} />
        <div className={`${styles.gel} ${styles.gelHuman}`} />
        <div className={`${styles.gel} ${styles.gelAi}`} />
        {sting > 0 && (
          // Keyed by the count, so each change of lead plays the flare exactly
          // once. Nothing else on the screen is keyed: the ring, the fighters
          // and the board keep running straight through it. It sits above the
          // gels because it has to arrive before them: the room takes 1.6s to
          // crossfade, and for that moment the surge IS the new leader's
          // colour, in a room still lit in the old one.
          <div key={sting} className={styles.sting} data-side={lead}>
            <i />
            <i />
            <i />
          </div>
        )}
        <div className={styles.vignette} />
      </div>

      <div className={styles.stage}>
        <div className={styles.rig}>
          <LedRing />
          <HangingScreen tagline={TAGLINE} />
        </div>

        <AiFighter />
        <Mascot />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={`${styles.crowd} ${styles.crowdLeft}`} src="/arena-tv/crowd-left.webp" alt="" aria-hidden="true" draggable={false} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={`${styles.crowd} ${styles.crowdRight}`} src="/arena-tv/crowd-right.webp" alt="" aria-hidden="true" draggable={false} />

        <Motes />

        <Callout side="human" lead={lead} pct={share.humanPct} />
        <Callout side="ai" lead={lead} pct={share.aiPct} />

        <div className={styles.hud}>
          <BattleBar share={share} lead={lead} />
          <SideColumn side="human" wins={shown.humanWins} slogan={['Real minds', 'Real impact']} />
          <Leaderboard players={shown.topPlayers} />
          <SideColumn side="ai" wins={shown.aiWins} slogan={['AI powers', 'possibilities']} />
        </div>

        <FeedBadge source={source} status={status} />
      </div>
    </main>
  );
}

/**
 * One lamp per lighting zone, in the order the CSS expects: rig and wall,
 * haze, seating bowl, barrier practicals, floor pool. They carry no markup of
 * their own -- every gradient, clock and breath is in the stylesheet, which is
 * the only place that knows where the light in this photograph falls.
 *
 * Five plain elements rather than one, because a room does not brighten all at
 * once: each takes its own duration and its own phase, so the arena settles by
 * zones the way a venue does.
 */
function Zones() {
  return (
    <>
      <i />
      <i />
      <i />
      <i />
      <i />
    </>
  );
}

/**
 * The slanted shout over each fighter. The side in front says so ("HUMANITY
 * LEADS" / "AI LEADS"); otherwise it shows that side's share. Both versions
 * are always rendered and crossfade when the lead changes hands.
 */
function Callout({ side, lead, pct }: { side: 'human' | 'ai'; lead: ArenaLead; pct: number }) {
  const leading = lead === side;
  const shout = side === 'human' ? ['Humanity', 'leads'] : ['AI', 'leads'];
  const share = [side === 'human' ? 'AU' : 'AI', `${pct}%`];
  return (
    <div className={styles.callout} data-side={side}>
      <p className={styles.calloutText} data-active={leading} aria-hidden={!leading}>
        <span>{shout[0]}</span>
        <span>{shout[1]}</span>
      </p>
      <p className={styles.calloutText} data-active={!leading} aria-hidden={leading}>
        <span>{share[0]}</span>
        <span>{share[1]}</span>
      </p>
    </div>
  );
}

/**
 * The corner badge saying where the numbers come from. Only a screen running
 * on simulated games says DEMO DATA (see arenaBadge).
 */
function FeedBadge({ source, status }: { source: ArenaSource; status: FeedStatus }) {
  const shown = arenaBadge(source, status);
  return (
    <p className={styles.badge} data-status={shown}>
      <i aria-hidden="true" />
      {FEED_BADGE[shown]}
    </p>
  );
}

/**
 * Dust drifting up through the spotlights. Positions come from a fixed seed so
 * the server and the browser render the same ones.
 */
const MOTES = (() => {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: 26 }, () => ({
    '--x': `${Math.round(120 + rand() * 1680)}px`,
    '--y': `${Math.round(120 + rand() * 520)}px`,
    '--size': `${(1.5 + rand() * 2.5).toFixed(1)}px`,
    '--drift': `${Math.round(-40 + rand() * 80)}px`,
    '--rise': `${Math.round(90 + rand() * 120)}px`,
    '--duration': `${(9 + rand() * 9).toFixed(1)}s`,
    '--delay': `${(-rand() * 18).toFixed(1)}s`,
  }));
})();

function Motes() {
  return (
    <div className={styles.motes} aria-hidden="true">
      {MOTES.map((style, i) => (
        <i key={i} style={style as CSSProperties} />
      ))}
    </div>
  );
}
