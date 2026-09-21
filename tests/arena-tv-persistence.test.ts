import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NEW_WATCH, watchLead, type LeadWatch } from '@/lib/arena/atmosphere';
import { battleShare, leadOf, type ArenaLead } from '@/lib/arena/types';

/*
 * The arena TV screen is left running for hours, and everything on it that
 * carries motion — the mascot video, the LED ring, the AI's channels, the
 * collision canvas — only looks right because it is never rebuilt. A score
 * arrives every few seconds and the lead turns over regularly, so anything
 * that restarts on either of those is something a visitor watches stutter.
 *
 * These are the rules that keep that true, checked where they can be: the
 * lead arithmetic directly, and the component tree by reading it.
 */

const TV = join(process.cwd(), 'src', 'components', 'arena-tv');
const read = (file: string) => readFileSync(join(TV, file), 'utf8').replace(/\r\n/g, '\n');
const components = readdirSync(TV).filter((f) => f.endsWith('.tsx'));

describe('A score or a lead never rebuilds the screen', () => {
  it('keys nothing off the live numbers', () => {
    /*
     * A React key derived from the score throws the element away and builds a
     * new one every time a game finishes. Two used to: the battle bar's burst
     * ring (key={share.humanPct}) and each side's win total (key={wins}),
     * which also reset the number it was in the middle of rolling.
     *
     * This is every key left in the arena, and what each is for. A new one
     * cannot appear without someone coming here to argue for it.
     */
    const keys = components.flatMap((file) =>
      // Balanced enough for a key holding a template literal, which a plain
      // [^}]+ would cut off at the first ${...} it met.
      [...read(file).matchAll(/key=\{((?:[^{}]|\$\{[^{}]*\})*)\}/g)].map((m) => `${file}: ${m[1]}`),
    );

    expect(keys.sort()).toEqual([
      // The one deliberate remount on the screen: a transient flare that plays
      // once per lead change. It is mounted inside the environment, below
      // everything that has to keep running.
      'ArenaLeaderboardTV.tsx: sting',
      // Fixed-length decorative lists; the index IS the identity.
      'ArenaLeaderboardTV.tsx: i',
      'LedRing.tsx: i',
      // The board. Rows are keyed by player, which is the point: a change of
      // order slides the same row to its new rank rather than rewriting it.
      'Leaderboard.tsx: `crown-${rank}`',
      'Leaderboard.tsx: `rank-${rank}`',
      'Leaderboard.tsx: `slot-${i}`',
      'Leaderboard.tsx: entry.id',
      'Leaderboard.tsx: entry.id',
    ].sort());
  });

  it('holds the persistent layers in components a re-render cannot replace', () => {
    // Each of these must be rendered unconditionally and unkeyed: no && in
    // front of it, no key on it. A conditional mount is a remount waiting for
    // whichever state flips it.
    const screen = read('ArenaLeaderboardTV.tsx');
    for (const tag of ['<LedRing />', '<HangingScreen', '<AiFighter />', '<Mascot />', '<BattleBar', '<Leaderboard']) {
      expect(screen).toContain(tag);
      const line = screen.split('\n').find((l) => l.includes(tag)) ?? '';
      expect(line).not.toMatch(/&&|\?|key=/);
    }
  });

  it('gives the collision canvas nothing that could restart it', () => {
    /*
     * ClashFX runs a requestAnimationFrame loop holding every particle in the
     * air. Its effect must depend only on things that never change, and read
     * the score and the lead out of refs — a dependency on either would tear
     * the loop down and rebuild it on every finished game.
     */
    const src = read('ClashFX.tsx');
    // The loop lives in the last effect in the file. It may depend only on a
    // ref and a fixed design number.
    const loop = src.slice(src.lastIndexOf('useEffect(() => {'));
    expect(loop).toContain('requestAnimationFrame');
    expect(/\}, \[shareRef, laneHeight\]\);/.test(loop)).toBe(true);

    // The lead gets its own effect, and all it is allowed to do is note WHEN
    // the lead turned over. It must not be anywhere near the loop.
    const leadEffect = src.slice(src.indexOf('useEffect(() => {'), src.lastIndexOf('useEffect(() => {'));
    expect(leadEffect).toContain('leadChangedAt.current = performance.now()');
    expect(leadEffect).not.toContain('requestAnimationFrame');

    // The live share is read inside the loop, never taken as a prop value that
    // would close over one moment's number.
    expect(loop).toContain('shareRef.current');
    expect(loop).toContain('leadChangedAt.current');
  });

  it('tears the canvas loop and its listeners down when it unmounts', () => {
    // A screen that reloads itself every half hour must not leave a frame loop
    // or a listener behind each time.
    const src = read('ClashFX.tsx');
    const cleanup = src.slice(src.lastIndexOf('return () => {'));
    expect(cleanup).toContain('cancelAnimationFrame(raf)');
    expect(cleanup).toContain("removeEventListener('visibilitychange'");
    expect(cleanup).toContain("removeEventListener('resize'");
    // Every listener it adds is one it removes.
    const added = [...src.matchAll(/addEventListener\('(\w+)'/g)].map((m) => m[1]).sort();
    const removed = [...src.matchAll(/removeEventListener\('(\w+)'/g)].map((m) => m[1]).sort();
    expect(removed).toEqual(added);
  });

  it('rolls counters without putting a frame’s value into React state', () => {
    /*
     * Six counters roll at once after every game. Held in state that was
     * around 360 component renders a second for a second and a half, every few
     * seconds, all day — measured at three times the GPU cost of everything
     * else the screen does put together.
     */
    const hooks = readFileSync(join(TV, 'hooks.ts'), 'utf8');
    const roll = hooks.slice(hooks.indexOf('export function useRollingNumber'));
    expect(roll).not.toMatch(/setState|useState/);
    expect(roll).toContain('requestAnimationFrame');
    expect(roll).toContain('cancelAnimationFrame');
    // And nothing anywhere still reaches for the old state-based counter.
    for (const file of [...components, 'hooks.ts']) {
      expect(readFileSync(join(TV, file), 'utf8')).not.toContain('useCountUp');
    }
  });
});

describe('The collision layer cannot disagree with the score', () => {
  it('derives no share of its own', () => {
    /*
     * The sparks sit exactly where the two fills meet because they are handed
     * the very number the bar filled to. If this file ever worked one out
     * itself — from the win counts, or with a second copy of battleBarView —
     * the contact point could drift off the seam it is supposed to be on.
     */
    const src = read('ClashFX.tsx');
    for (const forbidden of ['humanWins', 'aiWins', 'battleShare', 'shareOf', 'battleBarView', 'humanPct', 'aiPct']) {
      expect(src).not.toContain(forbidden);
    }
  });

  it('is fed from the same write that fills the lane and prints the numbers', () => {
    // One callback sets the lane's --human, both percentages and the value the
    // canvas reads. They are the same number by construction, not by agreement.
    const src = read('BattleBar.tsx');
    const apply = src.slice(src.indexOf('useCallback((value: number)'), src.indexOf('intro ?? {}'));
    expect(apply).toContain('liveShare.current = view.fill');
    expect(apply).toContain("setProperty('--human', String(view.fill))");
    expect(apply).toContain('humanRef.current.textContent = String(view.human)');
    expect(apply).toContain('aiRef.current.textContent = String(view.ai)');
    // And that same ref is what the canvas is given.
    expect(src).toContain('shareRef={liveShare}');
  });
});

describe('Lead changes, including the ones that go straight across', () => {
  /** Walks a run of shares through watchLead the way the screen does. */
  function run(shares: readonly string[]): { leads: ArenaLead[]; stings: number[] } {
    let watch: LeadWatch = NEW_WATCH;
    const leads: ArenaLead[] = [];
    const stings: number[] = [];
    for (const text of shares) {
      const [h, a] = text.split('/').map(Number);
      const lead = leadOf(battleShare(h, a));
      watch = watchLead(watch, lead, true);
      leads.push(lead);
      stings.push(watch.sting);
    }
    return { leads, stings };
  }

  it('turns the lead straight over, HUMAN to AI and back', () => {
    // The transition the booth TV was glitching on: no dead heat in between.
    const there = run(['66/34', '34/66']);
    expect(there.leads).toEqual(['human', 'ai']);
    expect(there.stings).toEqual([0, 1]);

    const back = run(['34/66', '66/34']);
    expect(back.leads).toEqual(['ai', 'human']);
    expect(back.stings).toEqual([0, 1]);
  });

  it('does the same at the extremes', () => {
    expect(run(['80/20', '20/80']).leads).toEqual(['human', 'ai']);
    expect(run(['20/80', '80/20']).leads).toEqual(['ai', 'human']);
    expect(run(['80/20', '20/80']).stings).toEqual([0, 1]);
    expect(run(['20/80', '80/20']).stings).toEqual([0, 1]);
  });

  it('counts a swap through a dead heat as the two changes it is', () => {
    const { leads, stings } = run(['66/34', '50/50', '34/66']);
    expect(leads).toEqual(['human', 'tie', 'ai']);
    expect(stings).toEqual([0, 1, 2]);
  });

  it('does nothing at all when the score moves but the lead does not', () => {
    let watch = watchLead(NEW_WATCH, 'human', true);
    const settled = watch;
    for (const text of ['67/33', '70/30', '75/25', '66/34']) {
      const [h, a] = text.split('/').map(Number);
      watch = watchLead(watch, leadOf(battleShare(h, a)), true);
    }
    // The very same object back, so the screen does not even re-render for it.
    expect(watch).toBe(settled);
    expect(watch.sting).toBe(0);
  });
});
