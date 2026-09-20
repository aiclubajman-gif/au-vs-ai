import { useSyncExternalStore } from 'react';
import { MockArenaFeed } from '@/lib/arena/mock-feed';
import type { ArenaSource } from '@/lib/arena/source';
import type { ArenaLead, ArenaStats } from '@/lib/arena/types';
import { ARENA_TIMING } from './config';

/**
 * Where the arena screen's numbers come from.
 *
 * A feed is a tiny external store: the screen subscribes, and the feed pushes
 * a new ArenaStats whenever it has one. Two ship here:
 *
 *   createMockFeed()  simulated games on a timer (the default for /tv)
 *   createLiveFeed()  polls /api/arena/stats, which reads the real event
 *
 * To feed the screen from anything else — a websocket, Supabase Realtime, a
 * different endpoint — write another function that returns an ArenaFeed and
 * pick it in ArenaLeaderboardTV. Nothing else on the screen needs to change.
 */

export type FeedStatus = 'demo' | 'connecting' | 'live' | 'offline';

export interface FeedState {
  /** null until a live feed's first answer arrives. */
  stats: ArenaStats | null;
  status: FeedStatus;
}

export interface ArenaFeed {
  subscribe(onChange: () => void): () => void;
  getSnapshot(): FeedState;
  getServerSnapshot(): FeedState;
  /** Demo feeds only: jump to a lead state, or finish a game right now. */
  force?(lead: ArenaLead): void;
  tickNow?(): void;
}

export function useArenaFeed(feed: ArenaFeed): FeedState {
  return useSyncExternalStore(feed.subscribe, feed.getSnapshot, feed.getServerSnapshot);
}

/** What the corner badge reads for each status. */
export const FEED_BADGE: Record<FeedStatus, string> = {
  demo: 'Demo data',
  connecting: 'Connecting',
  live: 'Live',
  offline: 'Offline',
};

/**
 * The status the corner badge shows.
 *
 * DEMO DATA marks simulated games and nothing else: a screen running on the
 * live feed can never carry it, whatever status reaches here. That badge is
 * the one thing on the screen telling a visitor whether the numbers in front
 * of them are real.
 */
export function arenaBadge(source: ArenaSource, status: FeedStatus): FeedStatus {
  if (source === 'mock') return 'demo';
  return status === 'demo' ? 'connecting' : status;
}

/**
 * Store plumbing shared by both feeds: `start` runs while anyone is
 * subscribed and returns its own stop function.
 */
function createStore(initial: FeedState, start: (set: (next: FeedState) => void) => () => void) {
  let state = initial;
  let stop: (() => void) | null = null;
  const listeners = new Set<() => void>();
  const set = (next: FeedState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  return {
    set,
    get: () => state,
    subscribe(onChange: () => void) {
      listeners.add(onChange);
      if (listeners.size === 1) stop = start(set);
      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0) {
          stop?.();
          stop = null;
        }
      };
    },
    getSnapshot: () => state,
    getServerSnapshot: () => initial,
  };
}

export function createMockFeed(intervalMs: number = ARENA_TIMING.mockTickMs): ArenaFeed {
  const mock = new MockArenaFeed();
  const store = createStore({ stats: mock.snapshot(), status: 'demo' }, (set) => {
    const timer = window.setInterval(() => set({ stats: mock.tick(), status: 'demo' }), intervalMs);
    return () => window.clearInterval(timer);
  });
  return {
    subscribe: store.subscribe,
    getSnapshot: store.getSnapshot,
    getServerSnapshot: store.getServerSnapshot,
    force: (lead) => store.set({ stats: mock.force(lead), status: 'demo' }),
    tickNow: () => store.set({ stats: mock.tick(), status: 'demo' }),
  };
}

/**
 * Polls the live endpoint. A failed poll keeps the last good numbers on
 * screen — a TV at a booth should never blank out over one dropped request —
 * and only after several misses in a row does the badge switch to OFFLINE.
 */
export function createLiveFeed(
  url = '/api/arena/stats',
  intervalMs: number = ARENA_TIMING.livePollMs,
): ArenaFeed {
  const store = createStore({ stats: null, status: 'connecting' }, (set) => {
    let active = true;
    let timer = 0;
    let misses = 0;
    let controller: AbortController | null = null;

    const poll = async () => {
      controller = new AbortController();
      try {
        const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
        const body = await res.json();
        if (!res.ok || !body?.ok || !isArenaStats(body.data)) throw new Error(`HTTP ${res.status}`);
        misses = 0;
        set({ stats: body.data, status: 'live' });
      } catch {
        if (!active) return;
        misses++;
        if (misses >= ARENA_TIMING.liveMissesBeforeOffline) set({ stats: store.get().stats, status: 'offline' });
      }
      if (active) timer = window.setTimeout(poll, intervalMs);
    };
    poll();

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller?.abort();
    };
  });
  return {
    subscribe: store.subscribe,
    getSnapshot: store.getSnapshot,
    getServerSnapshot: store.getServerSnapshot,
  };
}

function isArenaStats(v: unknown): v is ArenaStats {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return (
    ['humanWins', 'aiWins'].every((k) => typeof s[k] === 'number' && Number.isFinite(s[k])) &&
    Array.isArray(s.topPlayers)
  );
}
