import type { Metadata } from 'next';
import { Exo_2, Orbitron, Rajdhani } from 'next/font/google';
import { ArenaLeaderboardTV } from '@/components/arena-tv/ArenaLeaderboardTV';
import { arenaSource } from '@/lib/arena/source';

/**
 * /tv — the arena leaderboard for the big screen at the booth (1920 x 1080,
 * scales to any 16:9 display).
 *
 *   /tv               the real event once deployed; simulated games under
 *                     `next dev`, so the screen can be worked on offline
 *   /tv?source=live   the real event, polled from /api/arena/stats
 *   /tv?source=mock   simulated games (badge: DEMO DATA) — the only way to get
 *                     them, or that badge, on a deployed screen
 *
 * On the TV: open it in a browser, press F for full screen.
 */
export const metadata: Metadata = {
  title: 'AU vs AI — Arena',
};

// Self-hosted at build time (next/font), so the TV never waits on Google.
// Only this route loads them; the player screens keep the system font stack.
const orbitron = Orbitron({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-orbitron' });
const exo = Exo_2({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  style: ['normal', 'italic'],
  variable: '--font-exo',
});
const rajdhani = Rajdhani({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-rajdhani' });

export default async function ArenaTVPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string | string[] }>;
}) {
  const { source } = await searchParams;
  const kind = arenaSource(source, { isProduction: process.env.NODE_ENV === 'production' });
  return (
    <ArenaLeaderboardTV
      // A different source is a different feed: remount rather than reuse.
      key={kind}
      source={kind}
      className={`${orbitron.variable} ${exo.variable} ${rajdhani.variable}`}
    />
  );
}
