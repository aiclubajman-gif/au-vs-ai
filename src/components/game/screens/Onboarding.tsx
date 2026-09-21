'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { OtpInput } from '@/components/game/OtpInput';
import { ErrorBanner, PxButton, PxChip, PxLink, PxPanel, PxStar, Scene, Sprite, Wordmark } from '@/components/px';
import type { College } from '@/types';

export interface ApiError {
  message: string;
  ref?: string;
  code?: string;
}

const STEPS = ['EMAIL', 'OTP', 'PROFILE', 'READY'] as const;

export function Stepper({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="flex items-center justify-center gap-1 font-px text-[7px] sm:gap-2 sm:text-[8px]" aria-label="Sign-in steps">
      {STEPS.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3 | 4;
        const active = n === current;
        const done = n < current;
        return (
          <li key={label} className="flex items-center gap-1 sm:gap-2" aria-current={active ? 'step' : undefined}>
            <span className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-7 w-7 items-center justify-center text-[9px] sm:h-8 sm:w-8 sm:text-[10px] ${
                  active
                    ? 'bg-[#fdc52a] text-[#4a2100] shadow-[inset_0_0_0_3px_#a35a00,0_0_14px_#fdc52a]'
                    : done
                      ? 'bg-[#0b73bd] text-[#dff6ff] shadow-[inset_0_0_0_3px_#7ffafe]'
                      : 'bg-[#010f38] text-[#5f78b8] shadow-[inset_0_0_0_3px_#1e4ea8]'
                }`}
                style={{ clipPath: 'var(--px-corner)', ['--u' as string]: '2px' }}
              >
                {done ? '✓' : n}
              </span>
              <span className={active ? 'text-[#ffe66a]' : done ? 'text-[#7ffafe]' : 'text-[#5f78b8]'}>{label}</span>
            </span>
            {i < STEPS.length - 1 && (
              <span className={`mb-4 h-1 w-5 sm:w-9 ${done ? 'bg-[#7ffafe]' : 'bg-[#1e4ea8]'}`} aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function OnboardingShell({
  step,
  children,
  wide,
}: {
  step?: 1 | 2 | 3 | 4;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Scene left="/art/flanks/r2-left.webp" right="/art/flanks/r2-right.webp" leftWidth="24vw" rightWidth="22vw">
      <div
        className={`mx-auto flex w-full flex-1 flex-col px-4 pb-6 pt-5 sm:px-6 ${wide ? 'max-w-[560px]' : 'max-w-[480px]'}`}
      >
        <header className="flex flex-col items-center gap-2.5">
          <Wordmark name="humans-vs-ai" as="div" className="w-[72%] max-w-[300px]" />
          <PxChip className="text-[7px] sm:text-[8px]">THE 60 SECOND CHALLENGE</PxChip>
        </header>
        {step && (
          <div className="mt-5">
            <Stepper current={step} />
          </div>
        )}
        <div className="my-auto pt-5">{children}</div>
        <p className="mt-6 text-center font-px text-[7px] text-[#9fb3e6]">AIDA CLUB FAIR CHALLENGE · AJMAN UNIVERSITY</p>
      </div>
    </Scene>
  );
}

export function PanelTitle({ children, accent }: { children: ReactNode; accent?: ReactNode }) {
  return (
    <h2 className="text-center font-px text-[15px] leading-relaxed text-[#ffe66a] px-text-outline sm:text-[17px]">
      {children}
      {accent && <span className="text-[#7ffafe]"> {accent}</span>}
    </h2>
  );
}

export function Body({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-center text-[16px] leading-snug text-[#dff6ff] ${className}`}>{children}</p>;
}

function PixelIcon({ kind }: { kind: 'cap' | 'shield' | 'lock' | 'bulb' | 'user' | 'people' | 'college' | 'star' | 'clock' }) {
  const paths: Record<typeof kind, string> = {
    cap: 'M1 4h1v-1h1v-1h6v1h1v1h1v1h-1v1h-1v2h-1v1h-4v-1h-1v-2h-1v-1h-1zM9 5h1v3h-1z',
    shield: 'M2 1h7v5h-1v1h-1v1h-1v1h-1v-1h-1v-1h-1v-1h-1zM4 4h1v1h1v-1h1v1h-1v1h-1v-1h-1z',
    lock: 'M3 1h5v3h1v6h-7v-6h1zM4 2v2h3v-2zM5 6h1v2h-1z',
    bulb: 'M4 0h3v1h1v1h1v3h-1v1h-1v1h-3v-1h-1v-1h-1v-3h1v-1h1zM4 8h3v1h-3zM5 9h1v1h-1z',
    user: 'M4 1h3v3h-3zM2 5h7v4h-7z',
    people: 'M1 2h2v2h-2zM5 1h2v2h-2zM9 2h2v2h-2zM0 5h4v3h-4zM4 4h4v4h-4zM8 5h4v3h-4z',
    college: 'M1 4h9v6h-9zM5 1h1v1h1v1h1v1h-5v-1h1v-1h1zM2 6h1v2h-1zM4 6h1v2h-1zM6 6h1v2h-1zM8 6h1v2h-1z',
    star: 'M5 0h1v2h1v1h2v1h-1v1h-1v1h1v2h-1v-1h-1v-1h-1v1h-1v1h-1v-2h1v-1h-1v-1h-1v-1h2v-1h1z',
    clock: 'M3 0h5v1h1v1h1v5h-1v1h-1v1h-5v-1h-1v-1h-1v-5h1v-1h1zM5 2h1v3h2v1h-3z',
  };
  return (
    <svg viewBox="0 0 12 10" className="h-7 w-7 shrink-0 text-[#7ffafe]" aria-hidden="true" shapeRendering="crispEdges">
      <path fill="currentColor" d={paths[kind]} />
    </svg>
  );
}

function InfoRow({ icon, title, children }: { icon: 'cap' | 'shield' | 'star'; title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <PixelIcon kind={icon} />
      <div>
        <p className="font-px text-[8px] text-[#ffe66a]">{title}</p>
        <p className="mt-1 text-[15px] leading-snug text-[#c7d6ff]">{children}</p>
      </div>
    </div>
  );
}

export function EmailScreen({
  email,
  onEmail,
  valid,
  busy,
  error,
  onSend,
}: {
  email: string;
  onEmail: (v: string) => void;
  valid: boolean;
  busy: boolean;
  error: ApiError | null;
  onSend: () => void;
}) {
  return (
    <OnboardingShell step={1}>
      <PxPanel tone="cyan" className="p-5 sm:p-6">
        <PanelTitle accent="STARTED">LET&apos;S GET</PanelTitle>
        <Body className="mt-3">Enter your Ajman University email to begin the challenge.</Body>

        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            onSend();
          }}
        >
          <label htmlFor="email" className="sr-only">
            AU email
          </label>
          <input
            id="email"
            value={email}
            onChange={(e) => onEmail(e.target.value)}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="202312345@ajmanuni.ac.ae"
            className="px-input"
          />
          <ErrorBanner message={error?.message ?? ''} refCode={error?.ref} />
          <PxButton
            type="submit"
            busy={busy}
            disabled={!valid}
            className="mt-4 min-h-[60px] w-full text-[13px]"
          >
            SEND CODE →
          </PxButton>
        </form>

        <div className="mt-5 space-y-4 border-t-[3px] border-[#1e4ea8] pt-4">
          <InfoRow icon="cap" title="AU STUDENTS ONLY">
            Please use your official Ajman University email address.
          </InfoRow>
          <InfoRow icon="shield" title="ONE OFFICIAL ATTEMPT">
            Each student is allowed one official attempt during the event.
          </InfoRow>
        </div>

        <p className="mt-4 flex items-center justify-center gap-2 text-center text-[13px] text-[#9fb3e6]">
          <PixelIcon kind="lock" />
          Your information is secure and will only be used for this event.
        </p>
      </PxPanel>
    </OnboardingShell>
  );
}

export function OtpScreen({
  email,
  code,
  onCode,
  onVerify,
  busy,
  error,
  cooldown,
  onResend,
  onBack,
}: {
  email: string;
  code: string;
  onCode: (v: string) => void;
  onVerify: (code: string) => void;
  busy: boolean;
  error: ApiError | null;
  cooldown: number;
  onResend: () => void;
  onBack: () => void;
}) {
  const mm = String(Math.floor(cooldown / 60)).padStart(2, '0');
  const ss = String(cooldown % 60).padStart(2, '0');
  return (
    <OnboardingShell step={2}>
      <PxPanel tone="cyan" className="p-5 sm:p-6">
        <PanelTitle>ENTER THE 6-DIGIT CODE</PanelTitle>
        <Body className="mt-3">
          We&apos;ve sent a code to <span className="text-[#ffe66a]">{email}</span>.
        </Body>

        <div className="mt-5">
          <OtpInput value={code} onChange={onCode} onComplete={onVerify} disabled={busy} />
        </div>
        <ErrorBanner message={error?.message ?? ''} refCode={error?.ref} />

        <p className="mt-4 text-center font-px text-[8px] text-[#c7d6ff]">
          {cooldown > 0 ? (
            <>
              RESEND CODE IN <span className="text-[#7ffafe]">{mm}:{ss}</span>
            </>
          ) : (
            <button type="button" onClick={onResend} disabled={busy} className="text-[#ffe66a] underline underline-offset-4">
              RESEND CODE NOW
            </button>
          )}
        </p>

        <PxPanel tone="gold" className="mt-5 p-4">
          <div className="flex items-start gap-3">
            <PixelIcon kind="bulb" />
            <div>
              <p className="font-px text-[9px] text-[#ffe66a]">CODE NOT SHOWING?</p>
              <ul className="mt-2 space-y-1.5 text-[15px] text-[#dff6ff]">
                {['Check Junk and Quarantine', 'Ask the AIDA team for help', 'Check the email is entered correctly'].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 bg-[#7ffafe]" aria-hidden="true" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </PxPanel>

        <PxButton variant="navy" onClick={onBack} className="mt-4 min-h-[52px] w-full text-[10px]">
          BACK TO EMAIL
        </PxButton>
      </PxPanel>
    </OnboardingShell>
  );
}

const GENDERS = ['Male', 'Female', 'Prefer not to say'] as const;
export type Gender = (typeof GENDERS)[number];

export function ProfileScreen({
  fullName,
  onFullName,
  gender,
  onGender,
  collegeId,
  onCollege,
  colleges,
  busy,
  error,
  onContinue,
}: {
  fullName: string;
  onFullName: (v: string) => void;
  gender: Gender;
  onGender: (g: Gender) => void;
  collegeId: string;
  onCollege: (id: string) => void;
  colleges: College[];
  busy: boolean;
  error: ApiError | null;
  onContinue: () => void;
}) {
  return (
    <OnboardingShell step={3}>
      <PxPanel tone="cyan" className="p-5 sm:p-6">
        <PanelTitle accent="PROFILE">SET UP YOUR</PanelTitle>
        <Body className="mt-3">Just a few details to personalize your experience.</Body>

        <form
          className="mt-5 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            onContinue();
          }}
        >
          <div className="flex items-start gap-3">
            <PixelIcon kind="user" />
            <div className="flex-1">
              <label htmlFor="fullName" className="font-px text-[8px] text-[#ffe66a]">
                FULL NAME
              </label>
              <input
                id="fullName"
                value={fullName}
                onChange={(e) => onFullName(e.target.value)}
                type="text"
                autoComplete="name"
                placeholder="Enter your full name"
                className="px-input mt-2"
              />
            </div>
          </div>

          <div className="flex items-start gap-3">
            <PixelIcon kind="people" />
            <div className="flex-1">
              <p className="font-px text-[8px] text-[#ffe66a]">GENDER</p>
              <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Gender">
                {GENDERS.map((g) => (
                  <PxButton
                    key={g}
                    variant={gender === g ? 'cyan' : 'navy'}
                    onClick={() => onGender(g)}
                    className="min-h-[48px] text-[8px]"
                    ariaLabel={g}
                  >
                    {g === 'Prefer not to say' ? 'OTHER' : g.toUpperCase()}
                  </PxButton>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <PixelIcon kind="college" />
            <div className="flex-1">
              <label htmlFor="college" className="font-px text-[8px] text-[#ffe66a]">
                COLLEGE (OPTIONAL)
              </label>
              <select
                id="college"
                value={collegeId}
                onChange={(e) => onCollege(e.target.value)}
                className="px-input px-select mt-2"
              >
                <option value="">Select your college</option>
                {colleges.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <ErrorBanner message={error?.message ?? ''} refCode={error?.ref} />

          <PxButton type="submit" busy={busy} disabled={fullName.trim().length < 2} className="min-h-[60px] w-full text-[13px]">
            CONTINUE →
          </PxButton>
        </form>

        <p className="mt-4 flex items-center justify-center gap-2 text-center text-[13px] text-[#9fb3e6]">
          <PixelIcon kind="lock" />
          Your information will be used for the leaderboard and nothing else.
        </p>
      </PxPanel>
    </OnboardingShell>
  );
}

export interface DeviceChecks {
  modelLoaded: boolean;
  deviceChecked: boolean;
  selfTestPassed: boolean;
}

export function DeviceScreen({
  progress,
  checks,
  error,
  onRetry,
}: {
  progress: number;
  checks: DeviceChecks;
  error: ApiError | null;
  onRetry: () => void;
}) {
  const items = [
    ['Loading model', checks.modelLoaded],
    ['Checking device', checks.deviceChecked],
    ['Running self test', checks.selfTestPassed],
  ] as const;
  return (
    <OnboardingShell step={4}>
      <PxPanel tone="cyan" className="p-5 sm:p-6">
        <PanelTitle accent="DRAWING AI">PREPARING</PanelTitle>
        <Body className="mt-3">Checking if your device can run the drawing round…</Body>

        <div className="relative mx-auto mt-6 flex h-[150px] w-[150px] items-center justify-center">
          <div className="px-ring absolute inset-0" style={{ ['--p' as string]: progress }} aria-hidden="true" />
          <span className="px-num-cyan tabular text-[26px]" aria-live="polite">
            {progress}%
          </span>
        </div>

        <ul className="mt-6 space-y-2">
          {items.map(([label, done]) => (
            <li
              key={label}
              className="flex items-center gap-3 bg-[#010f38] px-4 py-3 text-[16px] text-[#dff6ff] shadow-[inset_0_0_0_3px_#1e4ea8]"
              style={{ clipPath: 'var(--px-corner)' }}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center font-px text-[10px] ${
                  done ? 'bg-[#7dff6a] text-[#0a3a10]' : 'bg-[#1e4ea8] text-[#9fb3e6]'
                }`}
                aria-hidden="true"
              >
                {done ? '✓' : ''}
              </span>
              {label}
              <span className="sr-only">{done ? ' done' : ' pending'}</span>
            </li>
          ))}
          <li
            className="flex items-center gap-3 bg-[#010f38] px-4 py-3 text-[16px] text-[#dff6ff] shadow-[inset_0_0_0_3px_#1e4ea8]"
            style={{ clipPath: 'var(--px-corner)' }}
          >
            {error ? (
              <span className="h-6 w-6 bg-[#ff4d5e]" aria-hidden="true" />
            ) : (
              <span className="px-spinner !h-6 !w-6 !border-[3px]" aria-hidden="true" />
            )}
            {error ? 'Something needs attention' : 'Almost ready…'}
          </li>
        </ul>

        {error ? (
          <>
            <ErrorBanner message={error.message} refCode={error.ref} />
            <PxButton variant="gray" onClick={onRetry} className="mt-3 min-h-[52px] w-full text-[10px]">
              TRY AGAIN
            </PxButton>
          </>
        ) : (
          <p className="mt-5 text-center font-px text-[7px] text-[#9fb3e6]">THIS ONLY TAKES A FEW SECONDS.</p>
        )}
      </PxPanel>
    </OnboardingShell>
  );
}

function RoundCard({
  n,
  title,
  desc,
  seconds,
  sprite,
  tone,
}: {
  n: string;
  title: string;
  desc: string;
  seconds: number;
  sprite: string;
  tone: 'cyan' | 'gold';
}) {
  return (
    <PxPanel tone={tone} className="p-3 sm:p-4">
      <div className="flex items-center gap-3">
        <div className="flex w-12 shrink-0 flex-col items-center">
          <span className="font-px text-[7px] text-[#c7d6ff]">ROUND</span>
          <span className={`px-num-gold text-[22px] ${tone === 'cyan' ? '!text-[#7ffafe]' : ''}`}>{n}</span>
        </div>
        <div
          className="flex h-16 w-16 shrink-0 items-end justify-center overflow-hidden bg-[#010f38] shadow-[inset_0_0_0_3px_#1e4ea8]"
          style={{ clipPath: 'var(--px-corner)' }}
        >
          <Sprite src={sprite} className="h-14 w-auto" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-px text-[10px] leading-relaxed text-[#ffe66a] sm:text-[11px]">{title}</p>
          <p className="mt-1 text-[14px] leading-snug text-[#dff6ff] sm:text-[15px]">{desc}</p>
        </div>
        <div className="flex w-14 shrink-0 flex-col items-center border-l-[3px] border-[#1e4ea8] pl-2">
          <PixelIcon kind="clock" />
          <span className="font-px text-[13px] text-[#7ffafe]">{seconds}</span>
          <span className="font-px text-[6px] text-[#c7d6ff]">SECONDS</span>
        </div>
      </div>
    </PxPanel>
  );
}

export function ReadyScreen({
  timings,
  imageCount,
  onPlay,
}: {
  timings: { round1MsPerImage: number; round2DrawMs: number; round3Ms: number };
  imageCount: number;
  onPlay: () => void;
}) {
  return (
    <OnboardingShell wide>
      <div className="text-center">
        <h2 className="font-px text-[22px] leading-relaxed text-[#ffe66a] px-text-outline sm:text-[26px]">
          HOW IT <span className="text-[#ff9d1b]">WORKS</span>
        </h2>
        <PxChip className="mt-2 text-[7px] sm:text-[8px]">3 ROUNDS · 60 SECONDS · ONE CHALLENGE</PxChip>
      </div>

      <div className="mt-5 space-y-3">
        <RoundCard
          n="01"
          tone="cyan"
          title="SPOT THE FAKE"
          desc="Can you tell what's real and what's AI?"
          seconds={Math.round((timings.round1MsPerImage * imageCount) / 1000)}
          sprite="/sprites/girl-strawhat.png"
        />
        <RoundCard
          n="02"
          tone="gold"
          title="DRAW VS AI"
          desc="You draw a prompt. AI guesses what it is."
          seconds={Math.round(timings.round2DrawMs / 1000)}
          sprite="/sprites/robot-cat.png"
        />
        <RoundCard
          n="03"
          tone="gold"
          title="YOU VS AIDA"
          desc="Take on AIDA with a fun knowledge challenge."
          seconds={Math.round(timings.round3Ms / 1000)}
          sprite="/sprites/mascot-girl-cheer.png"
        />
      </div>

      <PxPanel tone="cyan" className="mt-4 p-4">
        <InfoRow icon="star" title="ONE ATTEMPT ONLY">
          Each challenge can only be played once. Give it your best shot!
        </InfoRow>
      </PxPanel>

      <div className="mt-5 flex items-center justify-center gap-3">
        <PxStar className="h-5 w-5" />
        <PxButton onClick={onPlay} className="min-h-[64px] flex-1 text-[15px]">
          LET&apos;S PLAY →
        </PxButton>
        <PxStar className="h-5 w-5" />
      </div>
    </OnboardingShell>
  );
}

export function NoticeScreen({
  title,
  message,
  refCode,
  sprite,
  action,
}: {
  title: string;
  message: string;
  refCode?: string;
  sprite: string;
  action?: ReactNode;
}) {
  return (
    <OnboardingShell>
      <div className="flex flex-col items-center text-center">
        <Sprite src={sprite} className="px-bob h-36 w-auto" />
        <PxPanel tone="gold" className="mt-4 w-full p-5">
          <h2 className="font-px text-[16px] leading-relaxed text-[#ffe66a] px-text-outline sm:text-[18px]">{title}</h2>
          <Body className="mt-3">{message}</Body>
          {refCode && <p className="mt-3 font-px text-[8px] text-[#7ffafe]">REF {refCode}</p>}
          <div className="mt-5">{action ?? <PxLink href="/" className="min-h-[56px] w-full text-[11px]">BACK TO HOME</PxLink>}</div>
        </PxPanel>
      </div>
    </OnboardingShell>
  );
}

export function LoadingScreen({ label = 'LOADING GAME…' }: { label?: string }) {
  return (
    <main className="px-scene flex items-center justify-center">
      <div className="relative z-10 flex flex-col items-center">
        <div className="px-spinner" />
        <p className="mt-4 font-px text-[9px] text-[#c7d6ff]">{label}</p>
      </div>
    </main>
  );
}

export function ScoringScreen({ retrying }: { retrying: boolean }) {
  return (
    <Scene left="/art/flanks/r2-left.webp" right="/art/flanks/r2-right.webp" leftWidth="24vw" rightWidth="22vw">
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center justify-center px-5 text-center">
        <div className="flex items-end gap-2">
          <Sprite src="/sprites/mascot-boy-cheer.png" className="px-bob h-28 w-auto" />
          <Sprite src="/sprites/robot-1.png" className="px-bob px-bob--delay h-24 w-auto" />
        </div>
        <PxPanel tone="cyan" className="mt-5 w-full p-5">
          <div className="mx-auto px-spinner" />
          <h2 className="mt-4 font-px text-[14px] leading-relaxed text-[#ffe66a] px-text-outline">SCORING YOUR CHALLENGE…</h2>
          <Body className="mt-3">
            {retrying ? 'Connecting to the booth network. Your score is safe.' : 'Calculating accuracy and speed, then checking the leaderboard.'}
          </Body>
        </PxPanel>
      </div>
    </Scene>
  );
}

export function TestModeBar({ onJump }: { onJump: (step: string) => void }) {
  if (process.env.NODE_ENV === 'production') return null;
  return (
    <div className="fixed bottom-2 left-2 z-50 flex flex-wrap gap-1 opacity-60 hover:opacity-100">
      {['email', 'otp', 'profile', 'device', 'ready', 'round1', 'outro1', 'round2', 'round3', 'result', 'blocked'].map((s) => (
        <button key={s} onClick={() => onJump(s)} className="bg-black/70 px-2 py-1 font-px text-[7px] text-white">
          {s}
        </button>
      ))}
      <Link href="/leaderboard" className="bg-black/70 px-2 py-1 font-px text-[7px] text-white">
        board
      </Link>
    </div>
  );
}
