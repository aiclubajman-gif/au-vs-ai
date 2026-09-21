'use client';

import { useEffect, useState } from 'react';
import { PxChip, PxLink, PxPanel, Scene, Sprite, Wordmark } from '@/components/px';
import type { PublicAttemptResult } from '@/types';

function useCountUp(target: number, skip: boolean) {
  const [shown, setShown] = useState(skip ? target : 0);
  useEffect(() => {
    if (skip) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(target);
      return;
    }
    const duration = 1400;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, skip]);
  return shown;
}

function TrophyIcon({ silver }: { silver?: boolean }) {
  return <Sprite src="/sprites/trophy.png" className={`h-8 w-8 ${silver ? 'grayscale brightness-125' : ''}`} />;
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 12 8" className="h-7 w-9 shrink-0" aria-hidden="true" shapeRendering="crispEdges">
      <path fill="#7ffafe" d="M1 1h2v2H1zM5 0h2v2H5zM9 1h2v2H9zM0 4h4v3H0zM4 3h4v4H4zM8 4h4v3H8z" />
    </svg>
  );
}

export function Result({ result, returning = false }: { result: PublicAttemptResult; returning?: boolean }) {
  const shown = useCountUp(result.totalScore, returning);
  const win = result.humanWin;

  const rankPanel = (
    <PxPanel tone={win ? 'gold-fill' : 'gray'} className="flex-1 px-4 py-3">
      <div className="flex items-center justify-center gap-3">
        <TrophyIcon silver={!win} />
        <span className={`font-px text-[14px] px-text-outline sm:text-[16px] ${win ? 'text-[#fff4c2]' : 'text-[#eef2ff]'}`}>
          RANK #{result.rank}
        </span>
      </div>
    </PxPanel>
  );

  const beatPanel = (
    <PxPanel tone={win ? 'cyan' : 'cyan-fill'} className="flex-1 px-4 py-3">
      <div className="flex items-center justify-center gap-3">
        <PeopleIcon />
        <span className={`font-px text-[10px] leading-relaxed sm:text-[11px] ${win ? 'text-[#7ffafe]' : 'text-[#032846]'}`}>
          BEAT {result.percentileBeaten}%
          <br />
          OF PLAYERS
        </span>
      </div>
    </PxPanel>
  );

  const scorePanel = (
    <PxPanel tone="cyan" className="w-full px-5 py-5 sm:py-6">
      <div className="flex items-center justify-center gap-3 sm:gap-5">
        {win && <Sprite src="/sprites/laurel-cleaned.png" className="px-pop h-16 w-auto sm:h-20" />}
        <div className="flex flex-col items-center">
          <span className={`${win ? 'px-num-gold' : 'px-num-cyan'} tabular text-[64px] leading-none sm:text-[80px] lg:text-[88px]`} aria-live="polite">
            {shown}
          </span>
          <span className={`mt-3 font-px text-[16px] sm:text-[20px] ${win ? 'text-[#7ffafe]' : 'text-[#7ffafe]'} px-text-outline`}>/1000</span>
        </div>
        {win && <Sprite src="/sprites/laurel-cleaned.png" className="px-pop h-16 w-auto -scale-x-100 sm:h-20" />}
      </div>
    </PxPanel>
  );

  const cta = (
    <div className="flex flex-col items-center gap-3">
      <PxLink href="/leaderboard" className="min-h-[72px] w-full text-[18px] sm:text-[20px]" labelClassName="text-[#4a2100]">
        VIEW LEADERBOARD →
      </PxLink>
      <PxLink href="/club" variant="navy" className="min-h-[48px] w-full text-[10px]">
        JOIN AIDA
      </PxLink>
    </div>
  );

  return (
    <Scene
      left={win ? '/art/flanks/hw-left.webp' : '/art/flanks/aw-left.webp'}
      right={win ? '/art/flanks/hw-right.webp' : '/art/flanks/aw-right.webp'}
      leftWidth={win ? '24vw' : '22vw'}
      rightWidth={win ? '26vw' : '20vw'}
    >
      <div className={`px-confetti ${win ? '' : 'px-confetti--cyan'}`} aria-hidden="true" />

      <div className="relative mx-auto flex w-full max-w-[520px] flex-1 flex-col px-4 pb-6 pt-5 sm:px-6 lg:max-w-[640px]">
        {returning && (
          <div className="mb-3 flex justify-center">
            <PxChip tone="gold" className="text-[8px]">YOUR OFFICIAL RESULT</PxChip>
          </div>
        )}

        <div className="relative flex justify-center">
          <div className={`px-rays ${win ? '' : 'px-rays--cyan'}`} aria-hidden="true" />
          {win ? (
            <>
              <Wordmark name="human-win-stacked" priority className="relative w-[64%] max-w-[300px] lg:hidden" />
              <Wordmark name="human-win" priority className="relative hidden w-[88%] lg:block" />
            </>
          ) : (
            <Wordmark name="ai-win" priority className="relative w-[70%] max-w-[300px] lg:w-[60%] lg:max-w-none" />
          )}
        </div>

        {!win && (
          <div className="mt-2 flex justify-center lg:hidden">
            <Sprite src="/sprites/robot-arms-raised.png" className="px-cheer h-28 w-auto drop-shadow-[0_0_16px_rgba(0,187,252,0.6)]" />
          </div>
        )}

        <div className="relative mt-3 lg:mt-4">
          {!win && (
            <>
              <Sprite src="/sprites/mascot-boy-shrug.png" className="px-slump absolute -left-2 bottom-0 z-10 h-28 w-auto sm:h-32 lg:-left-36 lg:h-44" />
              <Sprite src="/sprites/mascot-girl-idk.png" className="px-slump absolute -right-2 bottom-0 z-10 h-28 w-auto sm:h-32 lg:-right-36 lg:h-44" />
            </>
          )}
          <div className={!win ? 'px-16 sm:px-20 lg:px-0' : ''}>{scorePanel}</div>
        </div>

        {win && (
          <div className="relative mt-3 flex justify-center lg:hidden">
            <Sprite src="/art/island-human-win.webp" className="px-float h-44 w-auto sm:h-52" />
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3 lg:flex-row">
          {rankPanel}
          {beatPanel}
        </div>

        {win && (
          <div className="mt-3 flex items-end justify-center gap-4 lg:hidden">
            <Sprite src="/sprites/mascot-boy-cheer.png" className="px-cheer h-28 w-auto" />
            <Sprite src="/sprites/mascot-girl-cheer.png" className="px-cheer h-24 w-auto" style={{ animationDelay: '-0.35s' }} />
          </div>
        )}

        {!win && (
          <div className="mt-3 flex justify-center lg:hidden">
            <Sprite src="/sprites/ai-win-island.png" className="px-float h-40 w-auto" />
          </div>
        )}

        <div className="mt-5 lg:mt-6">{cta}</div>
      </div>
    </Scene>
  );
}
