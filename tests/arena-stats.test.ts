import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { battleShare, leadOf, shareOf, TIE_MARGIN, ARENA_TOP_PLAYERS } from '@/lib/arena/types';
import { arenaSource } from '@/lib/arena/source';
import { toArenaStats, type ArenaLeaderboardRow } from '@/lib/arena/from-db';
import { MockArenaFeed } from '@/lib/arena/mock-feed';
import { battleBarView, BattleBar } from '@/components/arena-tv/BattleBar';
import { ArenaLeaderboardTV } from '@/components/arena-tv/ArenaLeaderboardTV';
import { arenaBadge, FEED_BADGE, type FeedStatus } from '@/components/arena-tv/feeds';
import { leaderboardLabel } from '@/lib/leaderboard-label';

const rows: ArenaLeaderboardRow[] = [
  { display_name: 'Ahmed K.', masked_id_suffix: '1234', total_score: 948, completed_at: '2026-09-19T10:00:00.000001+00:00' },
  { display_name: 'Sara M.', masked_id_suffix: '5678', total_score: 921, completed_at: '2026-09-19T10:05:00.000002+00:00' },
  { display_name: 'Khalid S.', masked_id_suffix: '9012', total_score: 887, completed_at: '2026-09-19T10:09:00.000003+00:00' },
  { display_name: 'Fatima A.', masked_id_suffix: '3456', total_score: 862, completed_at: '2026-09-19T10:12:00.000004+00:00' },
];

const ALL_STATUSES: FeedStatus[] = ['demo', 'connecting', 'live', 'offline'];

/** Win counts worth checking a rule against: lopsided, even, tiny, empty. */
const COUNTS: [number, number][] = [
  [0, 0], [1, 0], [0, 1], [1, 1], [1, 2], [2, 1], [132, 68], [68, 132], [211, 135],
  [3, 7], [7, 3], [1, 99], [99, 1], [5, 6], [333, 334], [1000, 1], [17, 0], [0, 23],
];

describe('Arena battle share', () => {
  it('is derived from the win counts and nothing else', () => {
    for (const [humanWins, aiWins] of COUNTS) {
      const totalWins = humanWins + aiWins;
      if (totalWins === 0) continue;
      const { humanPct, aiPct } = battleShare(humanWins, aiWins);
      expect(humanPct).toBe(Math.round((100 * humanWins) / totalWins));
      expect(aiPct).toBe(100 - humanPct);
    }
  });

  it('always sums to 100, however the rounding falls', () => {
    for (const [humanWins, aiWins] of COUNTS) {
      const { humanPct, aiPct } = battleShare(humanWins, aiWins);
      expect(humanPct + aiPct).toBe(100);
    }
    // 1/3 and 2/3 both round to a pair that would sum to 101 taken separately.
    expect(battleShare(1, 2)).toEqual({ humanPct: 33, aiPct: 67 });
    expect(battleShare(2, 1)).toEqual({ humanPct: 67, aiPct: 33 });
  });

  it('matches the totals beside it on the approved reference board', () => {
    expect(battleShare(132, 68)).toEqual({ humanPct: 66, aiPct: 34 });
  });

  it('is an even 50/50 before anyone has played', () => {
    expect(battleShare(0, 0)).toEqual({ humanPct: 50, aiPct: 50 });
    expect(shareOf({ humanWins: 0, aiWins: 0 })).toEqual({ humanPct: 50, aiPct: 50 });
  });

  it('gives a clean sweep its whole share', () => {
    expect(battleShare(17, 0)).toEqual({ humanPct: 100, aiPct: 0 });
    expect(battleShare(0, 23)).toEqual({ humanPct: 0, aiPct: 100 });
  });
});

describe('Arena lead', () => {
  it('lights up for the side ahead', () => {
    expect(leadOf({ humanPct: 66, aiPct: 34 })).toBe('human');
    expect(leadOf({ humanPct: 37, aiPct: 63 })).toBe('ai');
  });

  it('calls a dead heat within the tie margin, on both sides of it', () => {
    expect(leadOf({ humanPct: 50, aiPct: 50 })).toBe('tie');
    expect(leadOf({ humanPct: 52, aiPct: 48 })).toBe('tie');
    expect(leadOf({ humanPct: 48, aiPct: 52 })).toBe('tie');
    const justOver = 50 + TIE_MARGIN / 2 + 1;
    expect(leadOf({ humanPct: justOver, aiPct: 100 - justOver })).toBe('human');
    expect(leadOf({ humanPct: 100 - justOver, aiPct: justOver })).toBe('ai');
  });

  it('follows the win counts, through the share derived from them', () => {
    expect(leadOf(shareOf({ humanWins: 132, aiWins: 68 }))).toBe('human');
    expect(leadOf(shareOf({ humanWins: 68, aiWins: 132 }))).toBe('ai');
    expect(leadOf(shareOf({ humanWins: 100, aiWins: 100 }))).toBe('tie');
    expect(leadOf(shareOf({ humanWins: 0, aiWins: 0 }))).toBe('tie');
  });
});

describe('Live arena stats from the database views', () => {
  it('sends the win counts, and no percentage that could disagree with them', () => {
    const stats = toArenaStats({ human_wins: '6', ai_wins: '3' }, [], 'name_only');
    expect(stats).toEqual({ humanWins: 6, aiWins: 3, topPlayers: [] });
    expect(shareOf(stats)).toEqual({ humanPct: 67, aiPct: 33 });
  });

  it('treats a missing stats row as no games', () => {
    const stats = toArenaStats(null, [], 'name_only');
    expect(stats).toMatchObject({ humanWins: 0, aiWins: 0 });
    expect(shareOf(stats)).toEqual({ humanPct: 50, aiPct: 50 });
  });

  it('keeps only the top players, best first', () => {
    const { topPlayers } = toArenaStats({ human_wins: 1, ai_wins: 1 }, rows, 'name_only');
    expect(topPlayers).toHaveLength(ARENA_TOP_PLAYERS);
    expect(topPlayers.map((p) => p.score)).toEqual([948, 921, 887]);
  });

  it('labels players exactly as the /leaderboard page does, in every display mode', () => {
    for (const mode of ['name_only', 'masked_id_only', 'name_and_masked_id'] as const) {
      const { topPlayers } = toArenaStats({ human_wins: 1, ai_wins: 1 }, rows, mode);
      topPlayers.forEach((p, i) => {
        expect(p.tag ? `${p.name} · ${p.tag}` : p.name).toBe(leaderboardLabel(rows[i], mode));
      });
    }
  });

  it('never puts a hidden name or ID into the row id', () => {
    for (const mode of ['name_only', 'masked_id_only', 'name_and_masked_id'] as const) {
      const { topPlayers } = toArenaStats({ human_wins: 1, ai_wins: 1 }, rows, mode);
      topPlayers.forEach((p, i) => {
        expect(p.id).not.toContain(rows[i].display_name);
        expect(p.id).not.toContain(rows[i].masked_id_suffix);
      });
    }
  });

  it('shows no name at all in masked-ID mode', () => {
    const { topPlayers } = toArenaStats({ human_wins: 1, ai_wins: 1 }, rows, 'masked_id_only');
    expect(topPlayers[0]).toEqual({ id: rows[0].completed_at, name: '••••1234', score: 948 });
  });
});

describe('Mock arena feed', () => {
  it('opens on the approved reference board', () => {
    const s = new MockArenaFeed().snapshot();
    expect(s).toMatchObject({ humanWins: 132, aiWins: 68 });
    expect(shareOf(s)).toEqual({ humanPct: 66, aiPct: 34 });
    expect(s.topPlayers[0].name).toBe('Ahmed Al Nuaimi');
  });

  it('derives its share from its own counts, exactly as the live feed does', () => {
    const feed = new MockArenaFeed(7);
    for (let i = 0; i < 2000; i++) {
      const s = feed.tick();
      const { humanPct, aiPct } = shareOf(s);
      const totalWins = s.humanWins + s.aiWins;
      expect(humanPct).toBe(Math.round((100 * s.humanWins) / totalWins));
      expect(humanPct + aiPct).toBe(100);
    }
  });

  it('stays well-formed however long it runs', () => {
    const feed = new MockArenaFeed(7);
    let prev = feed.snapshot();
    for (let i = 0; i < 2000; i++) {
      const s = feed.tick();
      // Games are played, never unplayed — until a session's counts reset.
      const played = s.humanWins + s.aiWins;
      const reset = played < prev.humanWins + prev.aiWins;
      if (!reset) {
        expect(s.humanWins).toBeGreaterThanOrEqual(prev.humanWins);
        expect(s.aiWins).toBeGreaterThanOrEqual(prev.aiWins);
        expect(played).toBeGreaterThan(prev.humanWins + prev.aiWins);
      }
      expect(played).toBeLessThan(1000);
      expect(s.topPlayers.length).toBeGreaterThanOrEqual(ARENA_TOP_PLAYERS);
      const scores = s.topPlayers.map((p) => p.score);
      expect(scores).toEqual([...scores].sort((a, b) => b - a));
      expect(Math.max(...scores)).toBeLessThanOrEqual(1000);
      expect(new Set(s.topPlayers.map((p) => p.id)).size).toBe(s.topPlayers.length);
      prev = s;
    }
  });

  it('visits every lead state and reshuffles the top three', () => {
    const feed = new MockArenaFeed(11);
    const leads = new Set<string>();
    let reorders = 0;
    let prevTop = feed.snapshot().topPlayers.slice(0, 3).map((p) => p.id).join();
    for (let i = 0; i < 120; i++) {
      const s = feed.tick();
      leads.add(leadOf(shareOf(s)));
      const top = s.topPlayers.slice(0, 3).map((p) => p.id).join();
      if (top !== prevTop) reorders++;
      prevTop = top;
    }
    expect([...leads].sort()).toEqual(['ai', 'human', 'tie']);
    expect(reorders).toBeGreaterThan(10);
  });

  it('jumps straight to a forced lead, counts and share together', () => {
    const feed = new MockArenaFeed();
    for (const lead of ['ai', 'tie', 'human'] as const) {
      const s = feed.force(lead);
      expect(leadOf(shareOf(s))).toBe(lead);
      expect(shareOf(s).humanPct).toBe(Math.round((100 * s.humanWins) / (s.humanWins + s.aiWins)));
    }
  });
});

/** The percentages the markup prints, and the share its lane is filled to. */
function readBar(html: string) {
  const printed = [...html.matchAll(/class="tabular">(\d+)</g)].map((m) => Number(m[1]));
  const fill = Number(/--human:([\d.]+)/.exec(html)?.[1]);
  return { human: printed[0], ai: printed[1], fill };
}

describe('Battle bar', () => {
  it('reads both percentages off the one value it fills to', () => {
    // Every frame of a roll, not just the shares it comes to rest on.
    for (let share = 0; share <= 100; share += 0.25) {
      const { fill, human, ai } = battleBarView(share);
      expect(fill).toBe(share);
      expect(human).toBe(Math.round(share));
      expect(human + ai).toBe(100);
    }
  });

  it('never fills past either end of the lane', () => {
    expect(battleBarView(-20)).toEqual({ fill: 0, human: 0, ai: 100 });
    expect(battleBarView(140)).toEqual({ fill: 100, human: 100, ai: 0 });
  });

  it('fills to the share its own labels print', () => {
    for (const [humanWins, aiWins] of COUNTS) {
      const share = battleShare(humanWins, aiWins);
      const html = renderToStaticMarkup(createElement(BattleBar, { share, intro: null }));
      const { human, ai, fill } = readBar(html);
      expect(human).toBe(share.humanPct);
      expect(ai).toBe(share.aiPct);
      expect(human + ai).toBe(100);
      expect(fill).toBe(human);
    }
  });

  it('opens level at 50/50, lane and labels alike', () => {
    const html = renderToStaticMarkup(
      createElement(BattleBar, { share: battleShare(132, 68) }),
    );
    expect(readBar(html)).toEqual({ human: 50, ai: 50, fill: 50 });
  });

  it('tells a screen reader the real share, mid-roll or not', () => {
    const html = renderToStaticMarkup(createElement(BattleBar, { share: battleShare(132, 68) }));
    expect(html).toContain('aria-label="Battle share: humans 66%, AI 34%"');
  });
});

describe('The DEMO DATA badge', () => {
  it('belongs to simulated games alone: a live screen never carries it', () => {
    for (const status of ALL_STATUSES) {
      expect(arenaBadge('live', status)).not.toBe('demo');
      expect(FEED_BADGE[arenaBadge('live', status)]).not.toBe(FEED_BADGE.demo);
    }
  });

  it('passes a live feed’s own status through', () => {
    expect(arenaBadge('live', 'live')).toBe('live');
    expect(arenaBadge('live', 'connecting')).toBe('connecting');
    expect(arenaBadge('live', 'offline')).toBe('offline');
    expect(arenaBadge('mock', 'connecting')).toBe('demo');
  });

  it('is nowhere in a live screen’s markup, and is on a demo one', () => {
    const live = renderToStaticMarkup(createElement(ArenaLeaderboardTV, { source: 'live' }));
    expect(live.toLowerCase()).not.toContain('demo');
    expect(live).toContain(FEED_BADGE.connecting);

    const mock = renderToStaticMarkup(createElement(ArenaLeaderboardTV, { source: 'mock' }));
    expect(mock).toContain(FEED_BADGE.demo);
  });
});

describe('Which feed a /tv request gets', () => {
  it('runs a deployed screen on the real event', () => {
    expect(arenaSource(undefined, { isProduction: true })).toBe('live');
  });

  it('opens on simulated games in development, so the screen can be worked on', () => {
    expect(arenaSource(undefined, { isProduction: false })).toBe('mock');
  });

  it('gives simulated games in production only when asked for by name', () => {
    expect(arenaSource('mock', { isProduction: true })).toBe('mock');
    expect(arenaSource('live', { isProduction: false })).toBe('live');
    expect(arenaSource(['mock'], { isProduction: true })).toBe('mock');
  });

  it('falls back to the real event on anything it does not recognise', () => {
    expect(arenaSource('', { isProduction: true })).toBe('live');
    expect(arenaSource('LIVE', { isProduction: true })).toBe('live');
    expect(arenaSource('rubbish', { isProduction: true })).toBe('live');
  });
});
