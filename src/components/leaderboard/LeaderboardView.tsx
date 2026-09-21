'use client';

import { useState, useEffect } from 'react';
import { avatarFor, playerLabel } from '@/components/home/TopChallengers';
import {
  getStoredAvatar,
  getStoredGender,
  getAvatarSrc,
  type Gender,
} from '@/lib/avatars';
import { ChangeAvatarModal } from '@/components/leaderboard/ChangeAvatarModal';
import { AnimatedSprite, PxButton, PxChip, PxLink, PxPanel, Scene, Sprite, Wordmark } from '@/components/px';
import type { LeaderboardDisplayMode } from '@/types';

export interface LeaderboardRow {
  rank: number;
  display_name: string;
  masked_id_suffix: string;
  total_score: number;
  human_win: boolean;
}

const PODIUM = {
  1: { tone: 'gold-fill' as const, text: 'text-[#4a2100]', score: 'text-[#c23b00]', laurel: true },
  2: { tone: 'gray' as const, text: 'text-[#eef2ff]', score: 'text-[#ffe66a]', laurel: true },
  3: { tone: 'gold' as const, text: 'text-[#ffd8a8]', score: 'text-[#ffe66a]', laurel: true },
};

export function LeaderboardView({
  rows,
  mode,
  isLive,
}: {
  rows: LeaderboardRow[];
  mode: LeaderboardDisplayMode;
  isLive: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [currentAvatar, setCurrentAvatar] = useState('avatar_boy_1');
  const [currentGender, setCurrentGender] = useState<Gender>('Male');

  useEffect(() => {
    setCurrentAvatar(getStoredAvatar());
    setCurrentGender(getStoredGender());

    const handleAvatarChanged = () => {
      setCurrentAvatar(getStoredAvatar());
      setCurrentGender(getStoredGender());
    };

    window.addEventListener('au_vs_ai_avatar_changed', handleAvatarChanged);
    return () => window.removeEventListener('au_vs_ai_avatar_changed', handleAvatarChanged);
  }, []);

  return (
    <Scene left="lb-left" right="lb-right" leftWidth="30vw" rightWidth="30vw">
      <div className="mx-auto flex min-h-0 w-full max-w-[560px] flex-1 flex-col px-4 pb-5 pt-5 sm:px-6 lg:max-w-[640px]">
        <header className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <Wordmark name="humans-vs-ai" as="div" className="w-[86%] max-w-[300px]" />
            <PxChip className="mt-2 text-[7px] sm:text-[8px]">THE 60 SECOND CHALLENGE</PxChip>
            <h1 className="mt-4 font-px text-[20px] text-[#7ffafe] px-text-outline sm:text-[24px]">LEADERBOARD</h1>
            <p className="mt-2 font-px text-[7px] leading-relaxed text-[#c7d6ff] sm:text-[8px]">
              BRIGHTER MINDS · HIGHER SCORES
            </p>
          </div>
          <div className="relative shrink-0">
            <AnimatedSprite name="mascot-girl-cheer" speed="0.8s" className="h-32 sm:h-40" />
            <Sprite src="/sprites/trophy.png" className="px-bob absolute -right-2 top-2 h-12 w-12" />
          </div>
        </header>

        {/* Player Avatar Bar with Change Avatar Action */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-[#1e4ea8] bg-[#07163a]/90 p-2.5 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#ffe66a]/60 bg-[#0c2a66] p-0.5 shadow-inner">
              <img
                src={getAvatarSrc(currentAvatar)}
                alt="Your Avatar"
                className="h-full w-full object-contain pixelated"
              />
            </div>
            <div>
              <span className="block font-px text-[7px] text-[#9fb3e6]">YOUR AVATAR</span>
              <span className="block font-px text-[9px] text-[#ffe66a]">
                {currentGender.toUpperCase()} · STYLE {currentAvatar.slice(-1)}
              </span>
            </div>
          </div>
          <PxButton
            variant="cyan"
            onClick={() => setModalOpen(true)}
            className="min-h-[38px] px-3.5 text-[8px]"
          >
            CHANGE AVATAR ⚙
          </PxButton>
        </div>

        <PxPanel tone="cyan" className="mt-4 flex min-h-0 flex-1 flex-col px-3 py-4 sm:px-4">
          <div className="grid grid-cols-[3rem_1fr_4.5rem] items-center px-2 font-px text-[7px] text-[#7ffafe] sm:text-[8px]">
            <span>RANK</span>
            <span className="pl-11">PLAYER</span>
            <span className="text-right">SCORE</span>
          </div>

          {rows.length === 0 ? (
            <p className="px-2 py-10 text-center text-[16px] text-[#dff6ff]">No scores yet. Be the first challenger!</p>
          ) : (
            <ol className="px-scroll mt-3 flex-1 space-y-2">
              {rows.map((row) => {
                const podium = PODIUM[row.rank as 1 | 2 | 3];
                const inner = (
                  <div className="grid grid-cols-[3rem_1fr_4.5rem] items-center gap-2 px-2 py-2">
                    <span className={`flex items-center justify-center font-px text-[12px] sm:text-[13px] ${podium ? podium.text : 'text-[#dff6ff]'}`}>
                      {row.rank === 1 ? <Sprite src="/sprites/badge-crown-gold.png" className="h-6 w-6" alt="1st" /> : row.rank}
                    </span>
                    <span className="flex min-w-0 items-center gap-3">
                      <Sprite src={avatarFor(row.masked_id_suffix + row.display_name)} className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
                      <span className={`truncate font-px text-[10px] sm:text-[11px] ${podium ? podium.text : 'text-[#dff6ff]'}`}>
                        {playerLabel(row, mode)}
                      </span>
                      {row.human_win && (
                        <span className="hidden shrink-0 font-px text-[6px] text-[#7dff6a] sm:inline" aria-label="Human win">
                          WIN
                        </span>
                      )}
                    </span>
                    <span className={`tabular text-right font-px text-[13px] sm:text-[14px] ${podium ? podium.score : 'text-[#ffe66a]'}`}>
                      {row.total_score}
                    </span>
                  </div>
                );
                return (
                  <li key={`${row.rank}-${row.masked_id_suffix}`}>
                    {podium ? (
                      <PxPanel tone={podium.tone}>{inner}</PxPanel>
                    ) : (
                      <div className="border-b-[3px] border-[#1e4ea8]/60">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </PxPanel>

        {!isLive && (
          <p className="mt-3 text-center font-px text-[7px] text-[#9fb3e6]">SAMPLE DATA · LIVE SCORES APPEAR DURING THE EVENT</p>
        )}

        <div className="mt-4 flex flex-col gap-3">
          <PxButton
            variant="gold"
            onClick={() => setModalOpen(true)}
            className="min-h-[52px] w-full text-[11px]"
          >
            CHANGE AVATAR ⚙
          </PxButton>
          <PxLink href="/play" className="min-h-[60px] w-full text-[14px]">
            PLAY THE CHALLENGE →
          </PxLink>
          <PxLink href="/" variant="navy" className="min-h-[48px] w-full text-[9px]">
            BACK TO HOME
          </PxLink>
        </div>

        <p className="px-footer-note mt-4 text-center">HUMAN CREATIVITY ∞ AI POSSIBILITIES</p>
      </div>

      <ChangeAvatarModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={(newAvatar, newGender) => {
          setCurrentAvatar(newAvatar);
          setCurrentGender(newGender);
        }}
      />
    </Scene>
  );
}
