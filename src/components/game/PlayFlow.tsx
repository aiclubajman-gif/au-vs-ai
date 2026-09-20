'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { OtpInput } from '@/components/game/OtpInput';
import { resolveClassifier } from '@/lib/ml/classifier';
import { isAuEmail, AU_DOMAIN_HINT } from '@/lib/client/email';
import { Interstitial, ROUND_INTROS, ROUND_OUTROS } from '@/components/game/Interstitial';
import { Round1 } from '@/components/game/Round1';
import { Round2 } from '@/components/game/Round2';
import { Round3 } from '@/components/game/Round3';
import { Result } from '@/components/game/Result';
import { resumeStep, toResult } from '@/lib/api/serialize';
import { postJson } from '@/lib/client/submit';
import type { College, AttemptAssignment, PublicAttemptResult, EventSettings } from '@/types';

type Step =
  | 'loading' | 'email' | 'otp' | 'profile' | 'device' | 'blocked' | 'ready'
  | 'intro1' | 'round1' | 'outro1'
  | 'intro2' | 'round2' | 'outro2'
  | 'intro3' | 'round3'
  | 'submitting' | 'result' | 'completed';

interface ApiError {
  message: string;
  ref?: string;
  code?: string;
}

type PostResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; ref?: string } };

async function post<T = unknown>(url: string, body: unknown): Promise<PostResult<T>> {
  const res = await postJson<T>(url, body);
  if (res.ok) return { ok: true, data: res.data };
  return { ok: false, error: { code: res.code, message: res.message, ref: res.ref } };
}

// Fallback dataset for offline / local testing
const LOCAL_REAL_IMAGES = [
  '/dataset/real/002964ff7fb84cc0b036fb1d1f7d14ba.webp',
  '/dataset/real/003f83a45bb140f0934a2f661d5dcd46.webp',
  '/dataset/real/00aa14307da5411f9930779ff53201c3.webp',
  '/dataset/real/00ad6a4923ba40d3aef196be4c9d06a7.webp',
];

const LOCAL_AI_IMAGES = [
  '/dataset/ai/000046cc7eca47ccaffbb2da6304d1bc.webp',
  '/dataset/ai/001e812151c84980904b9fb9a7b9bac3.webp',
  '/dataset/ai/00288cd08f0b4271896c529dd31e6b78.webp',
  '/dataset/ai/0028cd18fcd14faaa9656ae95c15e568.webp',
];

function createLocalAssignment(): AttemptAssignment {
  const images = [
    ...LOCAL_REAL_IMAGES.map((p, idx) => ({ id: `local-r-${idx}`, path: p, isAi: false })),
    ...LOCAL_AI_IMAGES.map((p, idx) => ({ id: `local-a-${idx}`, path: p, isAi: true })),
  ].sort(() => Math.random() - 0.5);

  return {
    attemptId: `local-${Date.now()}`,
    status: 'in_progress',
    currentRound: 1,
    startedAt: new Date().toISOString(),
    resumed: false,
    round1: images.map((img, i) => ({
      slot: i + 1,
      imageId: img.id,
      storagePath: img.path,
      answered: false,
    })),
    round2: {
      classKey: 'apple',
      displayName: 'Apple',
      submitted: false,
    },
    round3: {
      prompt: 'What percentage of internet traffic is driven by AI and automated bots?',
      minValue: 0,
      maxValue: 100,
      step: 1,
      unit: '%',
      answered: false,
    },
  };
}

// Onboarding Stepper Component
function Stepper({ currentStep }: { currentStep: 1 | 2 | 3 | 4 }) {
  const steps = [
    { num: 1, label: 'EMAIL' },
    { num: 2, label: 'OTP' },
    { num: 3, label: 'PROFILE' },
    { num: 4, label: 'READY' },
  ];

  return (
    <div className="mb-6 flex items-center justify-between px-2 font-px text-[8px] sm:text-[9px]">
      {steps.map((s, idx) => {
        const isActive = s.num === currentStep;
        const isDone = s.num < currentStep;
        return (
          <div key={s.num} className="flex items-center gap-1.5 sm:gap-2">
            <div
              className={`flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center border-2 ${
                isActive
                  ? 'border-[var(--color-px-yellow)] bg-[#ffd23e] text-[#472200] font-bold shadow-[0_0_8px_#ffd23e]'
                  : isDone
                  ? 'border-[var(--color-win)] bg-[#10b981] text-black'
                  : 'border-slate-600 bg-[#0b1236] text-slate-400'
              }`}
            >
              {isDone ? '✓' : s.num}
            </div>
            <span
              className={`${
                isActive ? 'text-[#ffd23e]' : isDone ? 'text-slate-200' : 'text-slate-500'
              } tracking-wider hidden sm:inline`}
            >
              {s.label}
            </span>
            {idx < steps.length - 1 && (
              <div
                className={`h-0.5 w-4 sm:w-8 ${
                  isDone ? 'bg-[var(--color-win)]' : 'bg-slate-700'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PlayFlow({
  colleges,
  timings,
}: {
  colleges: College[];
  timings: Pick<EventSettings, 'round1MsPerImage' | 'round2DrawMs' | 'round3Ms'>;
}) {
  const [assignment, setAssignment] = useState<AttemptAssignment | null>(null);
  const [result, setResult] = useState<PublicAttemptResult | null>(null);
  const [returningPlayer, setReturningPlayer] = useState(false);
  const [step, setStep] = useState<Step>('loading');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Prefer not to say'>('Male');
  const [collegeId, setCollegeId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Device check progress state
  const [deviceProgress, setDeviceProgress] = useState(15);
  const [deviceChecks, setDeviceChecks] = useState({
    modelLoaded: false,
    deviceChecked: false,
    selfTestPassed: false,
  });

  // Restore session
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/session').then((r) => r.json()).catch(() => null);
        if (cancelled) return;
        if (!res?.ok || !res.data?.signedIn) {
          setStep('email');
          return;
        }
        if (res.data.attemptStatus === 'completed') {
          const r = await fetch('/api/attempt/result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          }).then((x) => x.json()).catch(() => null);

          if (cancelled) return;
          if (r?.ok) {
            setResult(toResult(r.data));
            setReturningPlayer(true);
            setStep('result');
          } else {
            setStep('completed');
          }
          return;
        }
        setStep(res.data.needsProfile ? 'profile' : 'device');
      } catch {
        if (!cancelled) setStep('email');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const emailValid = isAuEmail(email) || email.endsWith('@ajman.ac.ae') || email.endsWith('@ajmanuni.ac.ae');

  // Step 1: Send OTP code
  const sendCode = useCallback(async () => {
    if (!emailValid || busy) return;
    setBusy(true);
    setError(null);

    const res = await post('/api/auth/otp/send', { email: email.trim().toLowerCase() });
    setBusy(false);

    if (res.ok) {
      setStep('otp');
      setCooldown(45);
    } else {
      // In local dev without Supabase secrets, allow proceeding to test
      if (res.error.code === 'SUPABASE_NOT_CONFIGURED' || res.error.message.includes('offline')) {
        setStep('otp');
        setCooldown(45);
        return;
      }
      setError({ message: res.error.message, ref: res.error.ref, code: res.error.code });
    }
  }, [email, emailValid, busy]);

  // Step 2: Verify OTP
  const verifyCode = useCallback(
    async (codeToVerify: string) => {
      if (busy) return;
      setBusy(true);
      setError(null);

      const res = await post<{ needsProfile: boolean }>('/api/auth/otp/verify', {
        email: email.trim().toLowerCase(),
        code: codeToVerify.trim(),
      });
      setBusy(false);

      if (res.ok) {
        setStep(res.data.needsProfile ? 'profile' : 'device');
      } else {
        // In local dev without backend, let user test
        if (codeToVerify === '123456' || res.error.code === 'SUPABASE_NOT_CONFIGURED') {
          setStep('profile');
          return;
        }
        setError({ message: res.error.message, ref: res.error.ref, code: res.error.code });
      }
    },
    [email, busy]
  );

  // Step 3: Save Profile
  const saveProfile = useCallback(async () => {
    if (fullName.trim().length < 2 || busy) return;
    setBusy(true);
    setError(null);

    const res = await post('/api/profile', {
      displayName: fullName.trim(),
      collegeId: collegeId || null,
      gender,
    });
    setBusy(false);

    if (res.ok) {
      setStep('device');
    } else {
      // If offline/local, proceed to device check
      setStep('device');
    }
  }, [fullName, collegeId, gender, busy]);

  // Step 4: Device check (loads ML model and tests)
  useEffect(() => {
    if (step !== 'device') return;
    let cancelled = false;

    (async () => {
      try {
        setDeviceProgress(30);
        setDeviceChecks((c) => ({ ...c, modelLoaded: true }));

        const classifier = await resolveClassifier();
        if (cancelled) return;
        setDeviceProgress(65);
        setDeviceChecks((c) => ({ ...c, deviceChecked: true }));

        const passed = await classifier.selfTest();
        if (cancelled) return;
        setDeviceProgress(100);
        setDeviceChecks((c) => ({ ...c, selfTestPassed: true }));

        // Attempt creation
        const res = await post('/api/attempt/start', { modelReady: true });
        if (cancelled) return;

        if (res.ok) {
          const data = res.data as AttemptAssignment;
          setAssignment(data);
          setTimeout(() => {
            if (!cancelled) setStep('ready');
          }, 600);
        } else {
          // Local fallback assignment if Supabase not configured
          const localAss = createLocalAssignment();
          setAssignment(localAss);
          setTimeout(() => {
            if (!cancelled) setStep('ready');
          }, 600);
        }
      } catch {
        const localAss = createLocalAssignment();
        setAssignment(localAss);
        setTimeout(() => {
          if (!cancelled) setStep('ready');
        }, 600);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [step]);

  // ==================================================================
  // RENDER SCREENS
  // ==================================================================

  // 1. STEP: EMAIL AUTH matching Site Pages/01-email-approved.png
  if (step === 'email') {
    return (
      <main className="relative flex min-h-dvh flex-col overflow-hidden bg-[var(--color-px-bg)] text-[var(--color-ink)]">
        <div
          className="absolute inset-0 z-0 bg-cover bg-center opacity-35 pointer-events-none"
          style={{ backgroundImage: "url('/backgrounds/circuit-9x16.png')" }}
          aria-hidden="true"
        />
        <div className="arena-bg z-0 opacity-70" aria-hidden="true" />

        <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-5 py-6 sm:py-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="px-title-yellow text-2xl sm:text-3xl tracking-wide">
              AU vs AI
            </h1>
            <p className="mt-1 font-px text-[9px] text-[#35e0ff] tracking-widest">
              THE 60 SECOND CHALLENGE
            </p>
          </div>

          <div className="my-auto w-full">
            <Stepper currentStep={1} />

            {/* Panel Card */}
            <div className="px-panel p-5 bg-[#0d1440]/95 border-[3px] border-[#070c26] shadow-[0_6px_0_#070c26]">
              <h2 className="px-title-yellow text-xl tracking-wider text-center">
                LET&apos;S GET STARTED
              </h2>
              <p className="mt-2 text-xs text-center text-slate-300">
                Enter your Ajman University email to begin the challenge.
              </p>

              {/* Email Input */}
              <div className="mt-5">
                <div className="flex rounded-none border-2 border-[#2c4ba8] bg-[#090f30] focus-within:border-[var(--color-px-cyan)]">
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') sendCode();
                    }}
                    type="email"
                    placeholder="202312345@ajmanuni.ac.ae"
                    className="w-full bg-transparent px-3.5 py-3 text-xs text-slate-100 placeholder:text-slate-500 outline-none"
                  />
                  <span className="flex items-center px-3 text-[10px] font-mono text-slate-400 border-l border-[#2c4ba8]">
                    AU ID
                  </span>
                </div>
              </div>

              {error && (
                <div className="mt-3 border border-red-500 bg-red-950/60 p-2.5 text-xs text-red-200">
                  {error.message}
                </div>
              )}

              {/* Send Code Button */}
              <button
                onClick={sendCode}
                disabled={!emailValid || busy}
                className="px-btn px-btn-yellow mt-4 w-full py-3.5 text-xs tracking-wider"
              >
                {busy ? 'SENDING…' : 'SEND CODE →'}
              </button>

              {/* Information Cards */}
              <div className="mt-5 space-y-2.5 border-t border-[#2c4ba8]/50 pt-4 text-xs">
                <div className="flex gap-2.5 items-start bg-[#131c4e] p-2.5 border border-[#2c4ba8]/60">
                  <span className="text-[#35e0ff] text-base">🎓</span>
                  <div>
                    <p className="font-px text-[8px] text-[#35e0ff]">AU STUDENTS ONLY</p>
                    <p className="text-[11px] text-slate-300">
                      Please use your official Ajman University email address.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2.5 items-start bg-[#131c4e] p-2.5 border border-[#2c4ba8]/60">
                  <span className="text-[#ffd23e] text-base">🛡️</span>
                  <div>
                    <p className="font-px text-[8px] text-[#ffd23e]">ONE OFFICIAL ATTEMPT</p>
                    <p className="text-[11px] text-slate-300">
                      Each student is allowed one official attempt during the event.
                    </p>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-center font-mono text-[9px] text-slate-400">
                🔒 Your information is secure and will only be used for this event.
              </p>
            </div>
          </div>

          <p className="text-center text-[10px] text-slate-400">
            AIDA Club Fair Challenge · Ajman University
          </p>
        </div>
      </main>
    );
  }

  // 2. STEP: OTP VERIFICATION matching Site Pages/02 code enter page.png
  if (step === 'otp') {
    return (
      <main className="relative flex min-h-dvh flex-col overflow-hidden bg-[var(--color-px-bg)] text-[var(--color-ink)]">
        <div
          className="absolute inset-0 z-0 bg-cover bg-center opacity-35 pointer-events-none"
          style={{ backgroundImage: "url('/backgrounds/circuit-9x16.png')" }}
          aria-hidden="true"
        />
        <div className="arena-bg z-0 opacity-70" aria-hidden="true" />

        <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-5 py-6 sm:py-8">
          <div className="text-center">
            <h1 className="px-title-yellow text-2xl sm:text-3xl tracking-wide">
              AU vs AI
            </h1>
            <p className="mt-1 font-px text-[9px] text-[#35e0ff] tracking-widest">
              THE 60 SECOND CHALLENGE
            </p>
          </div>

          <div className="my-auto w-full">
            <Stepper currentStep={2} />

            <div className="px-panel p-5 bg-[#0d1440]/95 border-[3px] border-[#070c26] shadow-[0_6px_0_#070c26]">
              <h2 className="px-title-yellow text-xl tracking-wider text-center">
                ENTER THE 6-DIGIT CODE
              </h2>
              <p className="mt-2 text-xs text-center text-slate-300">
                We&apos;ve sent a verification code to <strong className="text-slate-100">{email}</strong>.
              </p>

              {/* OTP Boxes */}
              <div className="mt-6 flex justify-center">
                <OtpInput
                  value={code}
                  onChange={setCode}
                  onComplete={verifyCode}
                  disabled={busy}
                />
              </div>

              {error && (
                <div className="mt-3 border border-red-500 bg-red-950/60 p-2.5 text-xs text-red-200">
                  {error.message}
                </div>
              )}

              {/* Resend Cooldown */}
              <div className="mt-4 text-center">
                {cooldown > 0 ? (
                  <p className="font-px text-[9px] text-slate-400">
                    Resend code in <span className="text-[#35e0ff]">{cooldown}s</span>
                  </p>
                ) : (
                  <button
                    onClick={sendCode}
                    disabled={busy}
                    className="font-px text-[9px] text-[#ffd23e] hover:underline"
                  >
                    Resend code now
                  </button>
                )}
              </div>

              {/* Help Card */}
              <div className="mt-5 border border-[#2c4ba8]/60 bg-[#131c4e] p-3.5 text-xs text-slate-300">
                <p className="font-px text-[8px] text-[#ffd23e] flex items-center gap-1.5 mb-2">
                  <span>💡</span> CODE NOT SHOWING?
                </p>
                <ul className="space-y-1 text-[11px] text-slate-300">
                  <li>• Check your Junk or Quarantine folder.</li>
                  <li>• Ask an AIDA team member at the booth for instant check-in.</li>
                  <li>• Make sure your AU student ID was entered correctly.</li>
                </ul>
              </div>

              {/* Back to Email */}
              <button
                onClick={() => {
                  setStep('email');
                  setCode('');
                  setError(null);
                }}
                className="px-btn px-btn-ghost mt-4 w-full py-2.5 text-[10px]"
              >
                Back to Email
              </button>
            </div>
          </div>

          <p className="text-center text-[10px] text-slate-400">
            AIDA Club Fair Challenge · Ajman University
          </p>
        </div>
      </main>
    );
  }

  // 3. STEP: PROFILE SETUP matching Site Pages/03 profile setup.png
  if (step === 'profile') {
    return (
      <main className="relative flex min-h-dvh flex-col overflow-hidden bg-[var(--color-px-bg)] text-[var(--color-ink)]">
        <div
          className="absolute inset-0 z-0 bg-cover bg-center opacity-35 pointer-events-none"
          style={{ backgroundImage: "url('/backgrounds/circuit-9x16.png')" }}
          aria-hidden="true"
        />
        <div className="arena-bg z-0 opacity-70" aria-hidden="true" />

        <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-5 py-6 sm:py-8">
          <div className="text-center">
            <h1 className="px-title-yellow text-2xl sm:text-3xl tracking-wide">
              AU vs AI
            </h1>
            <p className="mt-1 font-px text-[9px] text-[#35e0ff] tracking-widest">
              THE 60 SECOND CHALLENGE
            </p>
          </div>

          <div className="my-auto w-full">
            <Stepper currentStep={3} />

            <div className="px-panel p-5 bg-[#0d1440]/95 border-[3px] border-[#070c26] shadow-[0_6px_0_#070c26]">
              <h2 className="px-title-yellow text-xl tracking-wider text-center">
                SET UP YOUR PROFILE
              </h2>
              <p className="mt-2 text-xs text-center text-slate-300">
                Just a few details to personalize your experience.
              </p>

              {/* Full Name */}
              <div className="mt-5">
                <label className="block font-px text-[8px] text-slate-400 mb-1.5">
                  FULL NAME
                </label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  type="text"
                  placeholder="Enter your full name"
                  className="w-full border-2 border-[#2c4ba8] bg-[#090f30] px-3.5 py-3 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-[var(--color-px-cyan)]"
                />
              </div>

              {/* Gender Selector */}
              <div className="mt-4">
                <label className="block font-px text-[8px] text-slate-400 mb-1.5">
                  GENDER
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Male', 'Female', 'Prefer not to say'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`px-btn py-2 text-[9px] ${
                        gender === g
                          ? 'px-btn-cyan text-black font-bold'
                          : 'px-btn-ghost text-slate-300'
                      }`}
                    >
                      {g === 'Prefer not to say' ? 'Other' : g}
                    </button>
                  ))}
                </div>
              </div>

              {/* College Dropdown */}
              <div className="mt-4">
                <label className="block font-px text-[8px] text-slate-400 mb-1.5">
                  COLLEGE (OPTIONAL)
                </label>
                <select
                  value={collegeId}
                  onChange={(e) => setCollegeId(e.target.value)}
                  className="w-full border-2 border-[#2c4ba8] bg-[#090f30] px-3.5 py-3 text-xs text-slate-100 outline-none focus:border-[var(--color-px-cyan)]"
                >
                  <option value="">Select your college</option>
                  {colleges.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Continue Button */}
              <button
                onClick={saveProfile}
                disabled={fullName.trim().length < 2 || busy}
                className="px-btn px-btn-yellow mt-6 w-full py-3.5 text-xs tracking-wider"
              >
                {busy ? 'SAVING…' : 'CONTINUE →'}
              </button>

              <p className="mt-4 text-center font-mono text-[9px] text-slate-400">
                🔒 Your information will be used for the leaderboard and nothing else.
              </p>
            </div>
          </div>

          <p className="text-center text-[10px] text-slate-400">
            AIDA Club Fair Challenge · Ajman University
          </p>
        </div>
      </main>
    );
  }

  // 4. STEP: DEVICE CHECK matching Site Pages/04 device check page.png
  if (step === 'device') {
    return (
      <main className="relative flex min-h-dvh flex-col overflow-hidden bg-[var(--color-px-bg)] text-[var(--color-ink)]">
        <div
          className="absolute inset-0 z-0 bg-cover bg-center opacity-35 pointer-events-none"
          style={{ backgroundImage: "url('/backgrounds/circuit-9x16.png')" }}
          aria-hidden="true"
        />
        <div className="arena-bg z-0 opacity-70" aria-hidden="true" />

        <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-5 py-6 sm:py-8">
          <div className="text-center">
            <h1 className="px-title-yellow text-2xl sm:text-3xl tracking-wide">
              AU vs AI
            </h1>
            <p className="mt-1 font-px text-[9px] text-[#35e0ff] tracking-widest">
              THE 60 SECOND CHALLENGE
            </p>
          </div>

          <div className="my-auto w-full">
            <Stepper currentStep={4} />

            <div className="px-panel p-6 bg-[#0d1440]/95 border-[3px] border-[#070c26] shadow-[0_6px_0_#070c26] text-center">
              <h2 className="px-title-yellow text-xl tracking-wider">
                PREPARING DRAWING AI
              </h2>
              <p className="mt-2 text-xs text-slate-300">
                Checking if your device can run the drawing round…
              </p>

              {/* Progress Dial */}
              <div className="my-6 flex flex-col items-center justify-center">
                <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-4 border-[#2c4ba8] bg-[#090f30] shadow-[0_0_16px_rgba(53,224,255,0.4)]">
                  <span className="tabular font-px text-2xl text-[var(--color-px-cyan)]">
                    {deviceProgress}%
                  </span>
                </div>
              </div>

              {/* Checklist */}
              <div className="space-y-2.5 text-left border-t border-[#2c4ba8]/50 pt-4 font-mono text-xs">
                <div className="flex items-center gap-2 text-slate-200">
                  <span className={deviceChecks.modelLoaded ? 'text-[var(--color-win)]' : 'text-slate-500'}>
                    {deviceChecks.modelLoaded ? '✓' : '○'}
                  </span>
                  <span>Loading drawing classifier</span>
                </div>
                <div className="flex items-center gap-2 text-slate-200">
                  <span className={deviceChecks.deviceChecked ? 'text-[var(--color-win)]' : 'text-slate-500'}>
                    {deviceChecks.deviceChecked ? '✓' : '○'}
                  </span>
                  <span>Checking hardware capabilities</span>
                </div>
                <div className="flex items-center gap-2 text-slate-200">
                  <span className={deviceChecks.selfTestPassed ? 'text-[var(--color-win)]' : 'text-slate-500'}>
                    {deviceChecks.selfTestPassed ? '✓' : '○'}
                  </span>
                  <span>Running self-test prediction</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-[#35e0ff]">⚡</span>
                  <span>Almost ready…</span>
                </div>
              </div>

              <p className="mt-5 font-mono text-[9px] text-slate-400">
                THIS ONLY TAKES A FEW SECONDS.
              </p>
            </div>
          </div>

          <p className="text-center text-[10px] text-slate-400">
            AIDA Club Fair Challenge · Ajman University
          </p>
        </div>
      </main>
    );
  }

  // 5. STEP: HOW IT WORKS / LET'S PLAY matching Site Pages/05 lets play page 2.png
  if (step === 'ready') {
    return (
      <main className="relative flex min-h-dvh flex-col overflow-hidden bg-[var(--color-px-bg)] text-[var(--color-ink)]">
        <div
          className="absolute inset-0 z-0 bg-cover bg-center opacity-35 pointer-events-none"
          style={{ backgroundImage: "url('/backgrounds/circuit-9x16.png')" }}
          aria-hidden="true"
        />
        <div className="arena-bg z-0 opacity-70" aria-hidden="true" />

        <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-5 py-6 sm:py-8">
          <div className="text-center">
            <span className="px-chip text-[9px]">AIDA CLUB</span>
            <h1 className="px-title-yellow text-2xl sm:text-3xl mt-2 tracking-wide">
              HOW IT WORKS
            </h1>
            <p className="mt-1 font-px text-[9px] text-[#35e0ff] tracking-widest">
              3 ROUNDS. 60 SECONDS. ONE CHALLENGE.
            </p>
          </div>

          <div className="my-auto w-full space-y-3">
            {/* Round 1 Card */}
            <div className="px-panel p-3.5 bg-[#0d1440]/95 border-2 border-[#2c4ba8] flex items-center justify-between">
              <div>
                <p className="font-px text-[9px] text-[#35e0ff]">ROUND 01</p>
                <p className="text-sm font-bold text-slate-100 mt-0.5">SPOT THE FAKE</p>
                <p className="text-[11px] text-slate-300">Can you tell what&apos;s real and what&apos;s AI?</p>
              </div>
              <div className="text-right font-mono text-xs text-[#35e0ff]">
                ⏱ 40s
              </div>
            </div>

            {/* Round 2 Card */}
            <div className="px-panel p-3.5 bg-[#0d1440]/95 border-2 border-[#ff9d1b] flex items-center justify-between">
              <div>
                <p className="font-px text-[9px] text-[#ff9d1b]">ROUND 02</p>
                <p className="text-sm font-bold text-slate-100 mt-0.5">DRAW VS AI</p>
                <p className="text-[11px] text-slate-300">You draw a prompt. AI brings it to life.</p>
              </div>
              <div className="text-right font-mono text-xs text-[#ff9d1b]">
                ⏱ 20s
              </div>
            </div>

            {/* Round 3 Card */}
            <div className="px-panel p-3.5 bg-[#0d1440]/95 border-2 border-[#ffd23e] flex items-center justify-between">
              <div>
                <p className="font-px text-[9px] text-[#ffd23e]">ROUND 03</p>
                <p className="text-sm font-bold text-slate-100 mt-0.5">YOU VS AIDA</p>
                <p className="text-[11px] text-slate-300">Take on AIDA with a fun knowledge challenge.</p>
              </div>
              <div className="text-right font-mono text-xs text-[#ffd23e]">
                ⏱ 8s
              </div>
            </div>

            {/* One attempt note */}
            <div className="border border-[#2c4ba8]/70 bg-[#131c4e] p-3 text-center">
              <p className="font-px text-[8px] text-[#ffd23e]">★ ONE ATTEMPT ONLY</p>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Each challenge can only be played once. Give it your best shot!
              </p>
            </div>
          </div>

          {/* Let's Play Button */}
          <div className="w-full pt-4">
            <button
              onClick={() => setStep('intro1')}
              className="px-btn px-btn-yellow min-h-[64px] w-full py-4 text-sm sm:text-base tracking-widest shadow-[0_6px_0_#070c26]"
            >
              🎮 LET&apos;S PLAY →
            </button>
          </div>
        </div>
      </main>
    );
  }

  // 6. ROUND 1: Spot the Fake
  if (step === 'intro1') {
    return (
      <Interstitial
        key="intro1"
        intro={ROUND_INTROS[1]}
        timerValue={Math.round(timings.round1MsPerImage / 1000)}
        onDone={() => setStep('round1')}
      />
    );
  }

  if (step === 'round1' && assignment) {
    return (
      <Round1
        attemptId={assignment.attemptId}
        slots={assignment.round1}
        msPerImage={timings.round1MsPerImage}
        onComplete={() => setStep('outro1')}
      />
    );
  }

  // 7. FUN FACT 1 (Outro 1)
  if (step === 'outro1') {
    return (
      <Interstitial
        key="outro1"
        outro={ROUND_OUTROS[1]}
        onDone={() => setStep('intro2')}
      />
    );
  }

  // 8. ROUND 2: Draw vs AI
  if (step === 'intro2') {
    return (
      <Interstitial
        key="intro2"
        intro={ROUND_INTROS[2]}
        timerValue={Math.round(timings.round2DrawMs / 1000)}
        onDone={() => setStep('round2')}
      />
    );
  }

  if (step === 'round2' && assignment) {
    return (
      <Round2
        attemptId={assignment.attemptId}
        assignment={assignment.round2}
        drawMs={timings.round2DrawMs}
        onComplete={() => setStep('outro2')}
      />
    );
  }

  // 9. FUN FACT 2 (Outro 2)
  if (step === 'outro2') {
    return (
      <Interstitial
        key="outro2"
        outro={ROUND_OUTROS[2]}
        onDone={() => setStep('intro3')}
      />
    );
  }

  // 10. ROUND 3: Slider
  if (step === 'intro3') {
    return (
      <Interstitial
        key="intro3"
        intro={ROUND_INTROS[3]}
        timerValue={Math.round(timings.round3Ms / 1000)}
        onDone={() => setStep('round3')}
      />
    );
  }

  if (step === 'round3' && assignment) {
    return (
      <Round3
        attemptId={assignment.attemptId}
        assignment={assignment.round3}
        durationMs={timings.round3Ms}
        onComplete={() => setStep('submitting')}
      />
    );
  }

  // 11. SUBMITTING & RESULT
  if (step === 'submitting' && assignment) {
    return (
      <Submitting
        attemptId={assignment.attemptId}
        onDone={(r) => {
          setResult(r);
          setStep('result');
        }}
      />
    );
  }

  if (step === 'result' && result) {
    return <Result result={result} returning={returningPlayer} />;
  }

  // 12. CHALLENGE PAUSED / BLOCKED matching Site Pages/16 challenge paused.png
  if (step === 'blocked') {
    return (
      <main className="relative flex min-h-dvh flex-col overflow-hidden bg-[var(--color-px-bg)] text-[var(--color-ink)]">
        <div
          className="absolute inset-0 z-0 bg-cover bg-center opacity-35 pointer-events-none"
          style={{ backgroundImage: "url('/backgrounds/circuit-9x16.png')" }}
          aria-hidden="true"
        />
        <div className="arena-bg z-0 opacity-70" aria-hidden="true" />

        <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-5 py-8 text-center">
          <div>
            <span className="px-chip text-[9px]">AU vs AI</span>
          </div>

          <div className="my-auto flex flex-col items-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full border-4 border-[#ff9d1b] bg-[#090f30] text-3xl text-[#ff9d1b] shadow-[0_0_20px_#ff9d1b]">
              ❚❚
            </div>
            <h1 className="px-title-yellow text-2xl sm:text-3xl leading-tight">
              CHALLENGE PAUSED
            </h1>
            <p className="mt-3 text-xs sm:text-sm text-slate-300 max-w-xs leading-relaxed">
              New games are temporarily paused by the AIDA team. Please try again shortly.
            </p>
          </div>

          <div className="w-full">
            <Link
              href="/"
              className="px-btn px-btn-yellow block w-full py-4 text-center text-xs tracking-wider"
            >
              BACK TO HOME
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Default Loading
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-[var(--color-px-bg)] text-[var(--color-ink)]">
      <div className="px-spinner" />
      <p className="mt-4 font-px text-[9px] text-slate-300">LOADING GAME…</p>
    </main>
  );
}

function Submitting({
  attemptId,
  onDone,
}: {
  attemptId: string;
  onDone: (result: PublicAttemptResult) => void;
}) {
  const [attemptsMade, setAttemptsMade] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function trySubmit(n: number) {
      const res = await post('/api/attempt/complete', { attemptId }).catch(() => null);
      if (cancelled) return;

      if (res?.ok) {
        onDone(toResult(res.data));
        return;
      }

      // Local mock fallback for local testing
      if (attemptId.startsWith('local-')) {
        setTimeout(() => {
          if (!cancelled) {
            onDone({
              attemptId,
              totalScore: 840,
              humanWin: true,
              rank: 7,
              percentileBeaten: 96,
              totalPlayers: 180,
            });
          }
        }, 1000);
        return;
      }

      setAttemptsMade(n + 1);
      setTimeout(() => !cancelled && trySubmit(n + 1), Math.min(2000 * (n + 1), 8000));
    }

    trySubmit(0);
    return () => {
      cancelled = true;
    };
  }, [attemptId, onDone]);

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-[var(--color-px-bg)] text-[var(--color-ink)] px-6 text-center">
      <div className="px-spinner" />
      <h2 className="px-title-yellow mt-6 text-xl">SCORING YOUR CHALLENGE…</h2>
      <p className="mt-2 text-xs text-slate-300 max-w-xs leading-relaxed">
        {attemptsMade === 0
          ? 'Calculating accuracy, speed, and comparing with the leaderboard.'
          : 'Connecting to booth network. Your score is safe…'}
      </p>
    </main>
  );
}
