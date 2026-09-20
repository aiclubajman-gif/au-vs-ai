import { battleShare, type ArenaLead, type ArenaStats, type LeaderboardEntry } from './types';

/**
 * Stand-in data for the arena TV screen, so it can be previewed — and its
 * animations seen — before it is pointed at the real game.
 *
 * Games are the only thing it moves: every tick some finish, always for one
 * side, so the two win counts only ever climb. The battle share the screen
 * draws is then worked out from those counts exactly as it is for the real
 * event (battleShare), which is why the demo can never show a percentage that
 * disagrees with its totals.
 *
 * How many games a tick plays follows a loop of scenarios (humans lead → dead
 * heat → AI leads → dead heat): enough to pull the share toward that
 * scenario's target, so every lighting state shows up within a minute or two
 * instead of the hundreds of single games it would really take. Now and then a
 * new challenger breaks into the top three.
 *
 * It is plain, seeded and synchronous; the screen drives it with a timer (see
 * createMockFeed in src/components/arena-tv/feeds.ts).
 */

const FIRST_NAMES = [
  'Ahmed', 'Sara', 'Khalid', 'Fatima', 'Omar', 'Mariam', 'Yousef', 'Noura', 'Hamdan', 'Aisha',
  'Rashid', 'Latifa', 'Saeed', 'Hessa', 'Majid', 'Reem', 'Sultan', 'Shamma', 'Faisal', 'Alya',
];
const FAMILY_NAMES = [
  'Al Nuaimi', 'Al Mahmoud', 'Al Shamsi', 'Al Ali', 'Al Mansoori', 'Al Hashimi', 'Al Marzouqi',
  'Al Suwaidi', 'Al Ketbi', 'Al Dhaheri', 'Al Falasi', 'Al Zaabi', 'Al Kaabi', 'Al Mheiri',
];

/** The opening board, matching the approved reference art (132/68 → 66/34). */
const OPENING: ArenaStats = {
  humanWins: 132,
  aiWins: 68,
  topPlayers: [
    { id: 'mock-1', name: 'Ahmed Al Nuaimi', score: 948 },
    { id: 'mock-2', name: 'Sara Al Mahmoud', score: 921 },
    { id: 'mock-3', name: 'Khalid Al Shamsi', score: 887 },
    { id: 'mock-4', name: 'Fatima Al Ali', score: 862 },
    { id: 'mock-5', name: 'Omar Al Mansoori', score: 840 },
  ],
};

/** Where the battle share heads, and for how many ticks, in a loop. */
const SCENARIOS: { lead: ArenaLead; humanPct: number; ticks: number }[] = [
  { lead: 'human', humanPct: 66, ticks: 8 },
  { lead: 'tie', humanPct: 51, ticks: 6 },
  { lead: 'ai', humanPct: 37, ticks: 8 },
  { lead: 'tie', humanPct: 49, ticks: 6 },
];

/** Games one tick may play. At least one, or nothing would be happening. */
const GAMES_PER_TICK = { min: 1, max: 12 };

/**
 * Past this many games the demo starts a fresh session (back to the opening
 * counts). Pulling the share about costs games, so without this the totals
 * would run away from the three or four digits the TV is laid out for.
 */
const MAX_TOTAL_WINS = 900;

/** The board resets once the third-best score passes this; scores top out at 1000. */
const SATURATED = 985;
const BOARD_SIZE = 8;

/** Small seeded PRNG (mulberry32), so a seed gives the same run every time. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * The games one side still has to win for its share to reach `targetPct`, and
 * which side those are. Only ever wins for the side that is short of the
 * target, so neither count can go backwards.
 */
function gamesToReach(humanWins: number, aiWins: number, targetPct: number) {
  const total = humanWins + aiWins;
  const p = clamp(targetPct, 1, 99) / 100;
  const humanWon = humanWins < p * total;
  const games = humanWon ? (p * total - humanWins) / (1 - p) : humanWins / p - total;
  return { humanWon, games: clamp(Math.round(games), GAMES_PER_TICK.min, GAMES_PER_TICK.max) };
}

export class MockArenaFeed {
  private readonly rand: () => number;
  private stats: ArenaStats;
  private scenario = 0;
  private ticksLeft = SCENARIOS[0].ticks;
  private nextId = OPENING.topPlayers.length + 1;

  constructor(seed = 20260919) {
    this.rand = prng(seed);
    this.stats = structuredClone(OPENING);
  }

  snapshot(): ArenaStats {
    return this.stats;
  }

  /** The share the screen draws for the current counts. */
  share() {
    return battleShare(this.stats.humanWins, this.stats.aiWins);
  }

  /** The next games finish. Returns the new stats (a new object every time). */
  tick(): ArenaStats {
    if (--this.ticksLeft <= 0) {
      this.scenario = (this.scenario + 1) % SCENARIOS.length;
      this.ticksLeft = SCENARIOS[this.scenario].ticks;
    }
    const s = this.stats;
    // A demo left running would drift into five-figure totals: new session.
    const from = s.humanWins + s.aiWins >= MAX_TOTAL_WINS ? OPENING : s;

    const target = SCENARIOS[this.scenario].humanPct + this.int(-1, 1);
    const { humanWon, games } = gamesToReach(from.humanWins, from.aiWins, target);

    this.stats = {
      humanWins: from.humanWins + (humanWon ? games : 0),
      aiWins: from.aiWins + (humanWon ? 0 : games),
      topPlayers: this.nextBoard(s.topPlayers),
    };
    return this.stats;
  }

  /**
   * Jumps straight to a lead state and stays there for a scenario's worth of
   * ticks (the demo keys H / A / T on the screen).
   *
   * This one rewrites the win counts rather than playing the games out: a key
   * press is meant to land instantly, and crossing to the far scenario
   * honestly would take hundreds of games. The counts stay the source of truth
   * either way — the screen derives its percentages from whatever they now say.
   */
  force(lead: ArenaLead): ArenaStats {
    this.scenario = SCENARIOS.findIndex((sc) => sc.lead === lead);
    this.ticksLeft = SCENARIOS[this.scenario].ticks;
    const total = this.stats.humanWins + this.stats.aiWins;
    const humanWins = Math.round((total * SCENARIOS[this.scenario].humanPct) / 100);
    this.stats = { ...this.stats, humanWins, aiWins: total - humanWins };
    return this.stats;
  }

  private nextBoard(board: LeaderboardEntry[]): LeaderboardEntry[] {
    if ((board[2]?.score ?? 0) >= SATURATED) {
      // The board has filled up: start a fresh "session" from the opening scores.
      const fresh: LeaderboardEntry[] = [];
      for (const p of OPENING.topPlayers) fresh.push({ ...p, id: `mock-${this.nextId++}`, name: this.name(fresh) });
      return fresh;
    }
    // About one tick in four, a new challenger lands in the top three.
    if (this.rand() >= 0.27) return board;
    const third = board[2]?.score ?? 800;
    const first = board[0]?.score ?? 900;
    const score = Math.min(1000, this.int(third + 1, Math.max(third + 2, first + 14)));
    const entry = { id: `mock-${this.nextId++}`, name: this.name(board), score };
    return [...board, entry].sort((a, b) => b.score - a.score).slice(0, BOARD_SIZE);
  }

  /** A random name, avoiding anyone already on `board` when it can. */
  private name(board: LeaderboardEntry[]) {
    let name = '';
    for (let tries = 0; tries < 6; tries++) {
      name = `${FIRST_NAMES[this.int(0, FIRST_NAMES.length - 1)]} ${FAMILY_NAMES[this.int(0, FAMILY_NAMES.length - 1)]}`;
      if (!board.some((p) => p.name === name)) break;
    }
    return name;
  }

  /** Integer in [min, max]. */
  private int(min: number, max: number) {
    return min + Math.floor(this.rand() * (max - min + 1));
  }
}
