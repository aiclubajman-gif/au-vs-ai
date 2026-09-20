/**
 * Which data the arena TV screen runs on, and when the DEMO DATA badge is
 * allowed to appear.
 *
 * Simulated games are a development and rehearsal aid, never something a
 * visitor should see at the booth. So a deployed screen is live unless someone
 * asks for the demo by name (?source=mock), while `next dev` still opens on the
 * demo — which is what you want when you are working on the screen itself.
 */

export type ArenaSource = 'mock' | 'live';

/**
 * The feed for a /tv request.
 *
 *   ?source=live   the real event, anywhere
 *   ?source=mock   simulated games, anywhere (this is the only way to get them
 *                  in production, and the only way DEMO DATA ever shows there)
 *   (no param)     live in production, simulated games in development
 */
export function arenaSource(
  param: string | string[] | undefined,
  { isProduction }: { isProduction: boolean },
): ArenaSource {
  const asked = Array.isArray(param) ? param[0] : param;
  if (asked === 'live') return 'live';
  if (asked === 'mock' || asked === 'demo') return 'mock';
  return isProduction ? 'live' : 'mock';
}
