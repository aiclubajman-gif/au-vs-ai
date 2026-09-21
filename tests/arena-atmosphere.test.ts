import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  leadingLight,
  trailingLight,
  watchLead,
  MAX_STRENGTH,
  MIN_STRENGTH,
  NEW_WATCH,
  type LeadWatch,
} from '@/lib/arena/atmosphere';
import { battleShare, leadOf, shareOf, TIE_MARGIN, type ArenaLead, type BattleShare } from '@/lib/arena/types';

const read = (...path: string[]) => readFileSync(join(process.cwd(), ...path), 'utf8').replace(/\r\n/g, '\n');

/** A share written the way the screen shows it: "66/34". */
function share(text: string): BattleShare {
  const [humanPct, aiPct] = text.split('/').map(Number);
  return { humanPct, aiPct };
}

/** Who the arena lights for at that share. */
const lightsFor = (text: string) => leadOf(share(text));

describe('Which way the arena lights', () => {
  it('lights for whoever is clearly ahead', () => {
    expect(lightsFor('66/34')).toBe('human');
    expect(lightsFor('80/20')).toBe('human');
    expect(lightsFor('34/66')).toBe('ai');
    expect(lightsFor('20/80')).toBe('ai');
  });

  it('splits the arena at a dead heat, and around one', () => {
    // The screen has one lead rule, leadOf, and it calls anything inside
    // TIE_MARGIN a dead heat — so a photo finish lights split rather than
    // picking a winner the numbers do not really support.
    expect(lightsFor('50/50')).toBe('tie');
    expect(lightsFor('51/49')).toBe('tie');
    expect(lightsFor('49/51')).toBe('tie');
  });

  it('still calls a dead heat the width the booth signed off on', () => {
    // The test below follows TIE_MARGIN wherever it goes, which is what makes
    // it a test of leadOf rather than of the number. This one is the number:
    // 4 points, so 52/48 splits the arena and 53/47 does not. Widening it
    // would change what a visitor sees at every close score, so it should
    // never move quietly.
    expect(TIE_MARGIN).toBe(4);
    expect(lightsFor('52/48')).toBe('tie');
    expect(lightsFor('53/47')).toBe('human');
  });

  it('calls a dead heat exactly as wide as TIE_MARGIN says, and not a point wider', () => {
    // Written against the constant rather than against 4, so moving it moves
    // this test with it -- and so nothing else can quietly assume a different
    // width. At TIE_MARGIN the arena splits; one point past it, a side leads.
    const atMargin = 50 + TIE_MARGIN / 2;
    expect(lightsFor(`${atMargin}/${100 - atMargin}`)).toBe('tie');
    expect(lightsFor(`${100 - atMargin}/${atMargin}`)).toBe('tie');
    expect(lightsFor(`${atMargin + 1}/${99 - atMargin}`)).toBe('human');
    expect(lightsFor(`${99 - atMargin}/${atMargin + 1}`)).toBe('ai');
  });

  it('follows the win counts, through the one share derived from them', () => {
    // Never a second percentage: the lighting reads the same battleShare the
    // bar fills to and the callouts print.
    expect(leadOf(battleShare(132, 68))).toBe('human');
    expect(leadOf(shareOf({ humanWins: 68, aiWins: 132 }))).toBe('ai');
    expect(leadOf(battleShare(0, 0))).toBe('tie');
  });
});

describe('How hard the arena lights', () => {
  it('lights harder the bigger the lead', () => {
    const close = leadingLight(share('51/49'));
    const house = leadingLight(share('66/34'));
    const runaway = leadingLight(share('80/20'));
    expect(close).toBeLessThan(house);
    expect(house).toBeLessThan(runaway);
  });

  it('reads the margin, not the side: mirrored scores light the same', () => {
    for (const [a, b] of [['66/34', '34/66'], ['80/20', '20/80'], ['51/49', '49/51']]) {
      expect(leadingLight(share(a))).toBe(leadingLight(share(b)));
      expect(trailingLight(share(a))).toBe(trailingLight(share(b)));
    }
  });

  it('stays inside a narrow range, so no score washes the screen out', () => {
    for (let humanPct = 0; humanPct <= 100; humanPct++) {
      const strength = leadingLight({ humanPct, aiPct: 100 - humanPct });
      expect(strength).toBeGreaterThanOrEqual(MIN_STRENGTH);
      expect(strength).toBeLessThanOrEqual(MAX_STRENGTH);
    }
    // A clean sweep is brighter than the house look, not a different screen.
    expect(leadingLight(share('100/0')) / leadingLight(share('66/34'))).toBeLessThan(1.2);
  });

  it('lets a runaway lead lift the room only slightly above the house look', () => {
    // 66/34 is the state the screen was designed at. 80/20 and 20/80 are more
    // of the same room, not another one -- a booth visitor should read them as
    // the same arena burning a little harder, never as a second lighting mode.
    const house = leadingLight(share('66/34'));
    for (const runaway of ['80/20', '20/80', '95/5', '100/0']) {
      const lit = leadingLight(share(runaway));
      expect(lit).toBeGreaterThanOrEqual(house);
      expect(lit / house).toBeLessThan(1.15);
    }
  });

  it('gives a dead heat the gentlest light of all', () => {
    expect(leadingLight(share('50/50'))).toBe(MIN_STRENGTH);
    expect(leadingLight(share('100/0'))).toBe(MAX_STRENGTH);
  });
});

describe('How far the trailing side drops', () => {
  it('takes the side behind further down the bigger the lead', () => {
    const close = trailingLight(share('55/45'));
    const house = trailingLight(share('66/34'));
    const runaway = trailingLight(share('80/20'));
    expect(close).toBeGreaterThan(house);
    expect(house).toBeGreaterThan(runaway);
  });

  it('opens a gap a viewer can read from across the room', () => {
    // The point of the screen is which colour is running the arena, and that
    // is this ratio -- not how bright the room is. A lead should light its own
    // side two to three times the other, and a runaway further still.
    const ratio = (text: string) => leadingLight(share(text)) / trailingLight(share(text));
    expect(ratio('66/34')).toBeGreaterThanOrEqual(2);
    expect(ratio('66/34')).toBeLessThanOrEqual(3.5);
    expect(ratio('80/20')).toBeGreaterThan(ratio('66/34'));
  });

  it('never puts the losing side out', () => {
    // AU vs AI is two colours. An arena lit in one of them is a different
    // screen, so even a clean sweep leaves the other rig burning.
    for (let humanPct = 0; humanPct <= 100; humanPct++) {
      expect(trailingLight({ humanPct, aiPct: 100 - humanPct })).toBeGreaterThan(0.15);
    }
  });
});

/** Plays a run of shares through the watcher and counts the flares. */
function run(shares: string[], { settled = true } = {}) {
  let watch: LeadWatch = NEW_WATCH;
  const seen: LeadWatch[] = [];
  for (const text of shares) {
    watch = watchLead(watch, lightsFor(text), settled);
    seen.push(watch);
  }
  return { watch, seen };
}

describe('When the arena flares', () => {
  it('does not flare at a score that moves without changing the lead', () => {
    const { watch } = run(['66/34', '67/33', '70/30', '80/20']);
    expect(watch.lead).toBe('human');
    expect(watch.sting).toBe(0);
  });

  it('flares once when the lead changes hands', () => {
    const { watch } = run(['66/34', '34/66']);
    expect(watch.lead).toBe('ai');
    expect(watch.sting).toBe(1);
  });

  it('flares when a lead is lost to a dead heat, and again when one is taken', () => {
    const { seen } = run(['66/34', '49/51', '34/66']);
    expect(seen.map((w) => w.lead)).toEqual(['human', 'tie', 'ai']);
    expect(seen.map((w) => w.sting)).toEqual([0, 1, 2]);
  });

  it('holds still through a dead heat that only shuffles about', () => {
    // Every one of these is the same lead state, so the arena crossfades to it
    // once and then simply breathes: no flare on any of the steps.
    const { watch } = run(['49/51', '50/50', '51/49', '52/48']);
    expect(watch.lead).toBe('tie');
    expect(watch.sting).toBe(0);
  });

  it('settles into the first real numbers instead of flaring at them', () => {
    // A live screen opens on an empty board (0/0, a dead heat) and the first
    // answer can say anything. Arriving is not the lead changing hands.
    let watch = watchLead(NEW_WATCH, 'tie', false);
    watch = watchLead(watch, 'ai', true);
    expect(watch).toEqual({ lead: 'ai', sting: 0 });
    watch = watchLead(watch, 'human', true);
    expect(watch).toEqual({ lead: 'human', sting: 1 });
  });

  it('ignores anything shown before real numbers arrive', () => {
    const { watch } = run(['66/34', '20/80', '50/50'], { settled: false });
    expect(watch).toBe(NEW_WATCH);
  });

  it('hands back the very object it was given when nothing has changed', () => {
    // The screen re-renders on every poll. An unchanged lead has to be the
    // same object or React would re-render the arena four times a second.
    const first = watchLead(NEW_WATCH, 'human', true);
    expect(watchLead(first, 'human', true)).toBe(first);
    expect(watchLead(first, 'human', false)).toBe(first);
  });

  it('counts a long run of games as the flares a viewer would actually see', () => {
    const leads: ArenaLead[] = ['human', 'human', 'tie', 'tie', 'ai', 'ai', 'ai', 'human'];
    let watch = NEW_WATCH;
    for (const lead of leads) watch = watchLead(watch, lead, true);
    expect(watch.sting).toBe(3);
  });
});

/*
 * The last two groups are not about numbers but about where they come from.
 *
 * Almost everything on this screen has to agree about one thing -- who is
 * ahead -- and the ways for that to go wrong are not arithmetic bugs. They are
 * a second place that works it out, or a value in a stylesheet that drifts
 * away from the one the tests cover. So these read the source.
 */

describe('One lead rule, and only one', () => {
  const arena = ['types.ts', 'atmosphere.ts', 'from-db.ts', 'mock-feed.ts', 'source.ts'].map((f) => [f, read('src', 'lib', 'arena', f)] as const);
  const tv = ['ArenaLeaderboardTV.tsx', 'BattleBar.tsx', 'Characters.tsx', 'HangingScreen.tsx', 'hooks.ts', 'Leaderboard.tsx', 'LedRing.tsx', 'SideColumn.tsx', 'feeds.ts', 'config.ts', 'geometry.ts'].map((f) => [f, read('src', 'components', 'arena-tv', f)] as const);

  it('defines leadOf once, in types.ts', () => {
    const defined = [...arena, ...tv].filter(([, src]) => /function leadOf\b/.test(src));
    expect(defined.map(([f]) => f)).toEqual(['types.ts']);
  });

  it('keeps TIE_MARGIN in types.ts, where leadOf is', () => {
    // Anywhere else it would be a second definition of "a dead heat".
    const mentions = [...arena, ...tv].filter(([, src]) => src.includes('TIE_MARGIN'));
    expect(mentions.map(([f]) => f)).toEqual(['types.ts']);
  });

  it('never decides a side by comparing the two shares anywhere else', () => {
    // A lead is a comparison of humanPct against aiPct. There is exactly one
    // in the codebase, and it is inside leadOf.
    const compares = /\bhumanPct\b\s*[<>]=?\s*\baiPct\b|\baiPct\b\s*[<>]=?\s*\bhumanPct\b/;
    const guilty = [...arena, ...tv].filter(([, src]) => compares.test(src));
    expect(guilty.map(([f]) => f)).toEqual(['types.ts']);
  });

  it('produces a lead state in exactly one place', () => {
    /*
     * The comparison in leadOf is not the only shape a second lead rule could
     * take -- one written over the win counts, or over two variables called
     * anything at all, would slip past the check above. What it cannot avoid
     * is producing one of the three values.
     *
     * So this is a ledger of every line in the arena that makes a 'human',
     * 'ai' or 'tie' at all. Both of them are leadOf. A third cannot appear
     * without someone having to come here and argue for it.
     */
    const yieldsLead = /(\?|return|=>)\s*'(human|ai|tie)'/;
    const ledger = [...arena, ...tv].flatMap(([file, src]) =>
      src
        .split('\n')
        .filter((line) => yieldsLead.test(line))
        .map((line) => `${file}: ${line.trim()}`),
    );
    expect(ledger).toEqual([
      // leadOf itself: the one rule, both of its branches.
      "types.ts: if (Math.abs(humanPct - aiPct) <= TIE_MARGIN) return 'tie';",
      "types.ts: return humanPct > aiPct ? 'human' : 'ai';",
    ]);
  });

  it('works the lighting out from the share, never from a lead of its own', () => {
    const src = read('src', 'lib', 'arena', 'atmosphere.ts');
    // It is handed the lead (watchLead) and the share (leadingLight,
    // trailingLight); it never derives either.
    expect(src).not.toMatch(/return\s+'(human|ai|tie)'/);
    expect(src).toMatch(/lead: ArenaLead/);
  });

  it('asks for the lead once on the screen itself, and hands that one answer round', () => {
    const src = read('src', 'components', 'arena-tv', 'ArenaLeaderboardTV.tsx');
    expect(src.match(/leadOf\(/g)).toHaveLength(1);
    // Everything that reacts to it reads that one `lead`: the root attribute
    // the stylesheet keys off, the callouts, and the flare's side.
    expect(src).toContain('data-lead={lead}');
    expect(src).toContain('lead={lead}');
    expect(src).toContain("data-side={lead}");
  });
});

describe('What the stylesheet promises about motion', () => {
  /*
   * These values live only in CSS, so nothing else can catch them drifting.
   * They are the approved restraint written down: how deep the arena breathes,
   * how long it takes to change mood, and how long the flare lasts.
   */
  // Comments stripped first: this file is mostly prose about the lighting, and
  // a selector picked up out of a comment would make the matches below depend
  // on how the comments are worded.
  const css = read('src', 'components', 'arena-tv', 'ArenaLeaderboardTV.module.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const seconds = (name: string) => {
    const found = css.match(new RegExp(`--${name}:\\s*([\\d.]+)s`));
    if (!found) throw new Error(`--${name} is not declared any more`);
    return Number(found[1]);
  };
  /** Every rule that sets a breath depth, as selector → depth. */
  const depths = [...css.matchAll(/([^{}]+)\{[^{}]*--breath-depth:\s*([\d.]+)\s*;/g)].map(([, selector, value]) => [selector.trim().replace(/\s+/g, ' '), Number(value)] as const);
  const depthFor = (match: string) => depths.find(([selector]) => selector.includes(match))?.[1];

  it('breathes on five separate clocks, none of them quick', () => {
    const clocks = ['t-breath-rig', 't-breath-haze', 't-breath-bowl', 't-breath-practicals', 't-breath-floor'].map(seconds);
    expect(new Set(clocks).size).toBe(5);
    for (const c of clocks) {
      expect(c).toBeGreaterThanOrEqual(4);
      expect(c).toBeLessThanOrEqual(8);
    }
  });

  it('keeps every breath shallow enough to read as a lamp, not a blink', () => {
    expect(depths.length).toBeGreaterThanOrEqual(4);
    for (const [, depth] of depths) {
      expect(depth).toBeGreaterThan(0);
      // 0.2 would be a lamp dropping to 80% -- past breathing and into pulsing.
      expect(depth).toBeLessThanOrEqual(0.18);
    }
  });

  it('gives the leading side more life than the trailing one, and a dead heat the middle', () => {
    const leading = depthFor(".houseHuman");
    const trailing = depthFor("[data-lead='human'] .houseAi");
    const even = depthFor("[data-lead='tie'] .house");
    expect(leading).toBeDefined();
    expect(trailing).toBeDefined();
    expect(even).toBeDefined();
    expect(leading!).toBeGreaterThan(even!);
    expect(even!).toBeGreaterThan(trailing!);
  });

  it('changes mood as a crossfade of the length the booth was signed off at', () => {
    expect(seconds('t-mood')).toBeGreaterThanOrEqual(1.2);
    expect(seconds('t-mood')).toBeLessThanOrEqual(1.8);
  });

  it('keeps the lead-change flare short, and shorter than the mood it rides on', () => {
    expect(seconds('t-sting')).toBeLessThanOrEqual(1.3);
    expect(seconds('t-sting')).toBeLessThan(seconds('t-mood'));
  });

  it('runs the AI, its bloom and its spill on three different clocks', () => {
    const ai = ['t-ai-pulse', 't-ai-bloom', 't-ai-spill'].map(seconds);
    expect(new Set(ai).size).toBe(3);
    // The surge itself stays inside the 3.5-5.5s the screen was tuned at.
    expect(ai[0]).toBeGreaterThanOrEqual(3.5);
    expect(ai[0]).toBeLessThanOrEqual(5.5);
  });

  it('never lets the AI go dark between surges', () => {
    const characters = read('src', 'components', 'arena-tv', 'Characters.module.css');
    const pulse = characters.slice(characters.indexOf('@keyframes neon-ai'));
    const floor = Number(pulse.match(/100%\s*\{\s*opacity:\s*([\d.]+)/)?.[1] ?? pulse.match(/opacity:\s*([\d.]+)/)?.[1]);
    expect(floor).toBeGreaterThanOrEqual(0.25);
  });
});
