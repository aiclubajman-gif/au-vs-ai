import { CLUB } from '@/lib/club';
import { PxChip, PxLink, PxPanel, PxStar, Scene, Sprite, Wordmark } from '@/components/px';

export const metadata = {
  title: 'Join AIDA — AI & Data Science Club',
  description: 'About the AI & Data Science Club at Ajman University, and how to join.',
};

export default function ClubPage() {
  return (
    <Scene left="/art/flanks/r2-left.webp" right="/art/flanks/lb-right.webp" leftWidth="24vw" rightWidth="24vw">
      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-4 pb-8 pt-5 sm:px-6">
        <header className="flex flex-col items-center text-center">
          <Wordmark name="humans-vs-ai" as="div" className="w-[72%] max-w-[300px]" />
          <PxChip className="mt-2 text-[7px] sm:text-[8px]">{CLUB.name.toUpperCase()}</PxChip>

          <div className="mt-5 flex items-end justify-center gap-3">
            <Sprite src="/sprites/mascot-boy-cheer.png" className="px-cheer h-28 w-auto sm:h-36" />
            <div className="pb-4">
              <h1 className="font-px text-[26px] text-[#ffe66a] px-text-outline sm:text-[32px]">JOIN</h1>
              <h1 className="font-px text-[26px] text-[#7ffafe] px-text-outline sm:text-[32px]">AIDA</h1>
            </div>
            <Sprite src="/sprites/mascot-girl-cheer.png" className="px-cheer h-28 w-auto sm:h-36" style={{ animationDelay: '-0.35s' }} />
          </div>
        </header>

        <PxPanel tone="cyan" className="mt-4 p-5">
          {CLUB.about.map((line) => (
            <p key={line} className="text-[16px] leading-snug text-[#dff6ff] [&+&]:mt-3">
              {line}
            </p>
          ))}
        </PxPanel>

        <PxPanel tone="gold" className="mt-4 p-5">
          <h2 className="flex items-center justify-center gap-2 font-px text-[11px] text-[#ffe66a] px-text-outline">
            <PxStar className="h-4 w-4" />
            HOW TO JOIN
            <PxStar className="h-4 w-4" />
          </h2>
          <ol className="mt-4 space-y-3">
            {CLUB.ors.steps.map((step, i) => (
              <li key={step} className="flex items-start gap-3 text-[16px] leading-snug text-[#dff6ff]">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-[#fdc52a] font-px text-[10px] text-[#4a2100] shadow-[inset_0_0_0_3px_#a35a00]">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <a href={CLUB.ors.url} target="_blank" rel="noreferrer" className="px-btn mt-5 min-h-[60px] w-full text-[13px]">
            <span className="px-btn__face" aria-hidden="true" />
            <span className="px-btn__label">OPEN ORS →</span>
          </a>
        </PxPanel>

        <PxPanel tone="cyan" className="mt-4 p-5">
          <h2 className="text-center font-px text-[11px] text-[#7ffafe] px-text-outline">FOLLOW THE CLUB</h2>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {CLUB.socials.map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noreferrer" className="px-btn px-btn--navy min-h-[56px] text-[8px]">
                <span className="px-btn__face" aria-hidden="true" />
                <span className="px-btn__label flex-col gap-1">
                  <span>{s.label.toUpperCase()}</span>
                  <span className="font-body text-[13px] normal-case">{s.handle}</span>
                </span>
              </a>
            ))}
          </div>
          <p className="mt-4 text-center font-body text-[15px] text-[#c7d6ff]">{CLUB.email}</p>
        </PxPanel>

        <div className="mt-5 flex flex-col gap-3">
          <PxLink href="/play" className="min-h-[60px] w-full text-[13px]">
            PLAY THE CHALLENGE →
          </PxLink>
          <PxLink href="/" variant="navy" className="min-h-[48px] w-full text-[9px]">
            BACK TO HOME
          </PxLink>
        </div>
      </div>
    </Scene>
  );
}
