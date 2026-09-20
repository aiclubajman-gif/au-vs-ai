/**
 * Arena TV screen — the JavaScript-side timing knobs.
 *
 * The looping animations (ring spin, mascot bob, AI pulse, ...) are CSS and
 * their durations live together at the top of ArenaLeaderboardTV.module.css
 * (`--t-*`). The timings below are the ones code has to know.
 */
export const ARENA_TIMING = {
  /** Mock feed: one simulated game finishes this often. */
  mockTickMs: 3500,
  /** Live feed: how often /api/arena/stats is polled. */
  livePollMs: 4000,
  /** Live feed: misses in a row before the badge says OFFLINE (last data stays up). */
  liveMissesBeforeOffline: 3,
  /** Counters (percentages, wins, scores) roll to a new value over this long. */
  countUpMs: 1400,
  /** On load, counters wait this long (for the HUD to fade in), then roll up. */
  introDelayMs: 1000,
  /** A leaderboard row pushed out of the top three fades for this long. */
  rowExitMs: 700,
  /** The mouse pointer hides after this long without moving. */
  cursorHideMs: 2500,
  /** The page reloads itself this often (only when the server answers). */
  selfReloadMs: 30 * 60 * 1000,
} as const;
