'use client';

import { useRef, useState, type CSSProperties } from 'react';
import type { ArenaSource } from '@/lib/arena/source';
import { leadOf, shareOf, type ArenaLead, type ArenaStats } from '@/lib/arena/types';
import { BattleBar } from './BattleBar';
import { AiFighter, Mascot } from './Characters';
import { arenaBadge, createLiveFeed, createMockFeed, FEED_BADGE, useArenaFeed, type FeedStatus } from './feeds';
import { HangingScreen } from './HangingScreen';
import { useDemoKeys, useKioskMode, useSelfReload, useStageScale } from './hooks';
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
 * the hanging screen, the two fighters, the crowds, and the live UI.
 *
 * `source` picks the data: 'live' polls /api/arena/stats, 'mock' simulates
 * games. See feeds.ts to plug in anything else.
 *
 * The win counts are the screen's only source of truth. The battle share is
 * worked out from them once, here, and that one pair of numbers is what the
 * bar fills to, what the percentages read, and what decides the lighting — so
 * no two parts of the screen can ever disagree.
 */
export function ArenaLeaderboardTV({ source, className }: { source: ArenaSource; className?: string }) {
  const [feed] = useState(() => (source === 'live' ? createLiveFeed() : createMockFeed()));
  const { stats, status } = useArenaFeed(feed);
  const shown = stats ?? WAITING;
  const share = shareOf(shown);
  const lead = leadOf(share);

  const rootRef = useRef<HTMLElement>(null);
  useStageScale(rootRef);
  useKioskMode(rootRef);
  useSelfReload();
  useDemoKeys(feed);

  return (
    // data-motion: animate even under "reduce motion" (see globals.css).
    <main ref={rootRef} className={`${styles.tv} ${className ?? ''}`} data-lead={lead} data-motion="always">
      <div className={styles.environment} aria-hidden="true">
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
        <div className={`${styles.light} ${styles.lightBlue}`} />
        <div className={`${styles.light} ${styles.lightOrange}`} />
        <div className={`${styles.light} ${styles.lightSplit}`} />
        <div className={`${styles.wash} ${styles.washHuman}`} />
        <div className={`${styles.wash} ${styles.washAi}`} />
        <div className={`${styles.beam} ${styles.beamLeft}`} />
        <div className={`${styles.beam} ${styles.beamRight}`} />
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
          <BattleBar share={share} />
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
