import { createAdminSupabase } from '@/lib/supabase/server';
import { avatarFor, playerLabel } from '@/components/home/TopChallengers';
import { AnimatedSprite, PxChip, PxLink, PxPanel, Scene, Sprite, Wordmark } from '@/components/px';
import type { LeaderboardDisplayMode } from '@/types';

export const revalidate = 10;

interface Row {
  rank: number;
  display_name: string;
  masked_id_suffix: string;
  total_score: number;
  human_win: boolean;
}

const FALLBACK_ROWS: Row[] = [
  { rank: 1, display_name: 'AUScholar', masked_id_suffix: '4821', total_score: 950, human_win: true },
  { rank: 2, display_name: 'MindMaster', masked_id_suffix: '1903', total_score: 890, human_win: true },
  { rank: 3, display_name: 'FutureThinker', masked_id_suffix: '8744', total_score: 840, human_win: true },
  { rank: 4, display_name: 'InnovatorX', masked_id_suffix: '3029', total_score: 790, human_win: true },
  { rank: 5, display_name: 'BlueFalcon', masked_id_suffix: '6112', total_score: 760, human_win: false },
  { rank: 6, display_name: 'QuizWizard', masked_id_suffix: '9420', total_score: 690, human_win: false },
  { rank: 7, display_name: 'NeuronNinja', masked_id_suffix: '5318', total_score: 620, human_win: true },
  { rank: 8, display_name: 'IdeaForge', masked_id_suffix: '2774', total_score: 580, human_win: false },
  { rank: 9, display_name: 'VisionaryV', masked_id_suffix: '8031', total_score: 540, human_win: true },
  { rank: 10, display_name: 'BrightMind', masked_id_suffix: '4199', total_score: 500, human_win: false },
];

async function getData() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { rows: FALLBACK_ROWS, isLive: false, mode: 'name_only' as LeaderboardDisplayMode };
  }
  try {
    const supabase = createAdminSupabase();
    const [{ data: rows }, { data: settings }] = await Promise.all([
      supabase.from('leaderboard_public').select('*').order('rank').limit(50),
      supabase.from('event_settings').select('leaderboard_display').eq('id', 1).single(),
    ]);
    const fetched = (rows ?? []) as Row[];
    return {
      rows: fetched,
      isLive: true,
      mode: (settings?.leaderboard_display ?? 'name_only') as LeaderboardDisplayMode,
    };
  } catch {
    return { rows: FALLBACK_ROWS, isLive: false, mode: 'name_only' as LeaderboardDisplayMode };
  }
}

const PODIUM = {
  1: { tone: 'gold-fill' as const, text: 'text-[#4a2100]', score: 'text-[#c23b00]', laurel: true },
  2: { tone: 'gray' as const, text: 'text-[#eef2ff]', score: 'text-[#ffe66a]', laurel: true },
  3: { tone: 'gold' as const, text: 'text-[#ffd8a8]', score: 'text-[#ffe66a]', laurel: true },
};

export default async function LeaderboardPage() {
  const { rows, mode, isLive } = await getData();

  return (
    <Scene left="lb-left" right="lb-right" leftWidth="30vw" rightWidth="30vw">
      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-4 pb-8 pt-5 sm:px-6 lg:max-w-[640px]">
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

        <PxPanel tone="cyan" className="mt-5 px-3 py-4 sm:px-4">
          <div className="grid grid-cols-[3rem_1fr_4.5rem] items-center px-2 font-px text-[7px] text-[#7ffafe] sm:text-[8px]">
            <span>RANK</span>
            <span className="pl-11">PLAYER</span>
            <span className="text-right">SCORE</span>
          </div>

          {rows.length === 0 ? (
            <p className="px-2 py-10 text-center text-[16px] text-[#dff6ff]">No scores yet. Be the first challenger!</p>
          ) : (
            <ol className="mt-3 space-y-2">
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

        <div className="mt-5 flex flex-col gap-3">
          <PxLink href="/play" className="min-h-[64px] w-full text-[14px]">
            PLAY THE CHALLENGE →
          </PxLink>
          <PxLink href="/" variant="navy" className="min-h-[48px] w-full text-[9px]">
            BACK TO HOME
          </PxLink>
        </div>

        <p className="px-footer-note mt-6 text-center">HUMAN CREATIVITY ∞ AI POSSIBILITIES</p>
      </div>
    </Scene>
  );
}
