'use client';

import { useEffect, useState } from 'react';
import type { PublicAttemptResult } from '@/types';
import { MAX_TOTAL } from '@/lib/scoring';
import { formatRank, formatPercentile, formatBeaten } from '@/lib/client/result-text';
import { HumanWinResult } from '@/components/game/HumanWinResult';
import { AiWinResult } from '@/components/game/AiWinResult';

/**
 * Result screen (§24).
 *
 * Shows total, human/AI verdict, rank and percentile — and nothing else.
 * §22 forbids per-round scores, partly to protect the shared Round 3 answer
 * and partly because a single big number is a better booth moment.
 *
 * The verdict is the server's `humanWin`; it picks the Human Win or AI Win
 * artwork, and this component feeds either one the same live values.
 */
const LEADERBOARD_HREF = '/leaderboard';
const JOIN_HREF = '/club';

export function Result({
  result,
  returning = false,
}: {
  result: PublicAttemptResult;
  /**
   * True when the student is reopening a finished game rather than having just
   * completed it. Showing the same celebratory screen both ways is confusing:
   * they need to see their score AND understand their attempt is used up.
   */
  returning?: boolean;
}) {
  const [shown, setShown] = useState(returning ? result.totalScore : 0);

  // Count-up. Human-win statistics enter at 1.5s; AI-win keeps its existing
  // immediate 1.4s count. Reduced motion and returning players finish at once.
  useEffect(() => {
    // A returning student has seen this number before; counting it up again
    // would pretend they just earned it.
    if (returning) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    if (reduce) {
      frame = requestAnimationFrame(() => setShown(result.totalScore));
      return () => cancelAnimationFrame(frame);
    }

    const delay = result.humanWin ? 1500 : 0;
    const duration = result.humanWin ? 900 : 1400;
    let timer = 0;
    const startCount = () => {
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setShown(Math.round(result.totalScore * eased));
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };
    if (delay > 0) timer = window.setTimeout(startCount, delay);
    else startCount();
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [result.humanWin, result.totalScore, returning]);

  const shared = {
    scoreText: String(shown),
    scoreMaxText: String(MAX_TOTAL),
    rankText: formatRank(result.rank),
    leaderboardButtonLabel: 'View leaderboard',
    joinButtonLabel: 'Join AIDA',
    leaderboardHref: LEADERBOARD_HREF,
    joinHref: JOIN_HREF,
    notice: returning ? "You've already played · this is your final score" : undefined,
  };

  if (result.humanWin) {
    const standing = formatPercentile(result.percentileBeaten, result.totalPlayers);
    return (
      <HumanWinResult
        {...shared}
        percentileText={standing.text}
        percentileCaption={standing.caption}
        instant={returning}
      />
    );
  }

  return (
    <AiWinResult
      {...shared}
      percentileText={formatBeaten(result.percentileBeaten, result.totalPlayers)}
    />
  );
}
