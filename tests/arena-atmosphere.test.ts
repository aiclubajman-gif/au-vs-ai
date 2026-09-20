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
import { battleShare, leadOf, shareOf, type ArenaLead, type BattleShare } from '@/lib/arena/types';

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
