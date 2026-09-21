'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { resolveClassifier } from '@/lib/ml/classifier';
import { isAuEmail } from '@/lib/client/email';
import { Interstitial, ROUND_INTROS, ROUND_OUTROS } from '@/components/game/Interstitial';
import { Round1 } from '@/components/game/Round1';
import { Round2 } from '@/components/game/Round2';
import { Round3 } from '@/components/game/Round3';
import { Result } from '@/components/game/Result';
import { toResult } from '@/lib/api/serialize';
import { postJson } from '@/lib/client/submit';
import {
  DeviceScreen,
  EmailScreen,
  LoadingScreen,
  NoticeScreen,
  OtpScreen,
  ProfileScreen,
  ReadyScreen,
  ScoringScreen,
  TestModeBar,
  type ApiError,
  type DeviceChecks,
  type Gender,
} from '@/components/game/screens/Onboarding';
import { PxButton, PxLink } from '@/components/px';
import type { College, AttemptAssignment, PublicAttemptResult, EventSettings } from '@/types';

type Step =
  | 'loading' | 'email' | 'otp' | 'profile' | 'device' | 'blocked' | 'failed' | 'ready'
  | 'intro1' | 'round1' | 'outro1'
  | 'intro2' | 'round2' | 'outro2'
  | 'intro3' | 'round3'
  | 'submitting' | 'result' | 'completed';

type PostResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; ref?: string; kind: string } };

const DEV_FALLBACK = process.env.NODE_ENV !== 'production';

async function post<T = unknown>(url: string, body: unknown): Promise<PostResult<T>> {
  const res = await postJson<T>(url, body);
  if (res.ok) return { ok: true, data: res.data };
  return { ok: false, error: { code: res.code, message: res.message, ref: res.ref, kind: res.kind } };
}

function offline(err: { code: string; kind: string }) {
  return DEV_FALLBACK && (err.kind === 'network' || err.kind === 'server');
}

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
    ...LOCAL_REAL_IMAGES.map((p, idx) => ({ id: `local-r-${idx}`, path: p })),
    ...LOCAL_AI_IMAGES.map((p, idx) => ({ id: `local-a-${idx}`, path: p })),
  ].sort(() => Math.random() - 0.5);

  return {
    attemptId: `local-${Date.now()}`,
    status: 'in_progress',
    currentRound: 1,
    startedAt: new Date().toISOString(),
    resumed: false,
    round1: images.map((img, i) => ({ slot: i + 1, imageId: img.id, storagePath: img.path, answered: false })),
    round2: { classKey: 'apple', displayName: 'Apple', submitted: false },
    round3: {
      prompt: 'What % of internet traffic is bots?',
      minValue: 0,
      maxValue: 100,
      step: 1,
      unit: '%',
      answered: false,
    },
  };
}

const BLOCKED_COPY: Record<string, { title: string; body: string; showRef: boolean }> = {
  CHALLENGE_CLOSED: {
    title: 'CHALLENGE NOT OPEN',
    body: 'The challenge is not open yet. Come back to the AIDA booth when the fair starts.',
    showRef: false,
  },
  NEW_GAMES_PAUSED: {
    title: 'CHALLENGE PAUSED',
    body: 'New games are paused for a moment by the AIDA team. Try again shortly.',
    showRef: false,
  },
  PROFILE_REQUIRED: {
    title: 'ONE MORE STEP',
    body: 'Enter your name before starting so your score can go on the leaderboard.',
    showRef: false,
  },
  ROUND1_BANK_TOO_SMALL: {
    title: 'NOT READY YET',
    body: 'The image bank is still being loaded. Show this screen to an AIDA team member.',
    showRef: true,
  },
  ROUND1_BANK_UNBALANCED: {
    title: 'NOT READY YET',
    body: 'The image bank is still being loaded. Show this screen to an AIDA team member.',
    showRef: true,
  },
  NO_DRAWING_CLASSES: {
    title: 'NOT READY YET',
    body: 'The drawing round is not configured. Show this screen to an AIDA team member.',
    showRef: true,
  },
  NO_ROUND3_QUESTION: {
    title: 'NOT READY YET',
    body: 'The final round is not configured. Show this screen to an AIDA team member.',
    showRef: true,
  },
};

const DEVICE_FAILED_MESSAGE =
  "This device can't run the drawing round. Your attempt has not been used, so please try again on one of the AIDA booth tablets.";

const LOCAL_RESULT = (attemptId: string, humanWin: boolean): PublicAttemptResult => ({
  attemptId,
  totalScore: humanWin ? 840 : 620,
  humanWin,
  rank: humanWin ? 1 : 4,
  percentileBeaten: humanWin ? 95 : 61,
  totalPlayers: 180,
});

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
  const [gender, setGender] = useState<Gender>('Male');
  const [collegeId, setCollegeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [deviceProgress, setDeviceProgress] = useState(10);
  const [deviceRun, setDeviceRun] = useState(0);
  const [deviceState, setDeviceState] = useState<'checking' | 'failed'>('checking');
  const [blocked, setBlocked] = useState<{ code: string; ref?: string; message: string } | null>(null);
  const sending = useRef(false);
  const [deviceChecks, setDeviceChecks] = useState<DeviceChecks>({
    modelLoaded: false,
    deviceChecked: false,
    selfTestPassed: false,
  });

  const startDeviceCheck = useCallback(() => {
    setError(null);
    setDeviceState('checking');
    setDeviceProgress(10);
    setDeviceChecks({ modelLoaded: false, deviceChecked: false, selfTestPassed: false });
    setDeviceRun((n) => n + 1);
    setStep('device');
  }, []);

  const loadResult = useCallback(async () => {
    const r = await post('/api/attempt/result', {});
    if (r.ok) {
      setResult(toResult(r.data));
      setReturningPlayer(true);
      setStep('result');
    } else {
      setStep('completed');
    }
  }, []);

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
          await loadResult();
          return;
        }
        if (res.data.needsProfile) setStep('profile');
        else startDeviceCheck();
      } catch {
        if (!cancelled) setStep('email');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadResult, startDeviceCheck]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const emailValid = isAuEmail(email);

  async function sendCode() {
    if (!emailValid) return;
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await post('/api/auth/send-otp', { email: email.trim().toLowerCase() });
      if (res.ok || offline(res.error)) {
        setStep('otp');
        setCooldown(45);
        return;
      }
      setError({ message: res.error.message, ref: res.error.ref, code: res.error.code });
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  const verifyCode = useCallback(
    async (token: string) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      const res = await post<{ needsProfile: boolean }>('/api/auth/verify-otp', {
        email: email.trim().toLowerCase(),
        token: token.trim(),
      });
      setBusy(false);
      if (res.ok) {
        if (res.data.needsProfile) setStep('profile');
        else startDeviceCheck();
        return;
      }
      if (offline(res.error)) {
        setStep('profile');
        return;
      }
      setCode('');
      setError({ message: res.error.message, ref: res.error.ref, code: res.error.code });
    },
    [email, busy, startDeviceCheck]
  );

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
    if (res.ok || offline(res.error)) {
      startDeviceCheck();
      return;
    }
    setError({ message: res.error.message, ref: res.error.ref, code: res.error.code });
  }, [fullName, collegeId, gender, busy, startDeviceCheck]);

  useEffect(() => {
    if (step !== 'device') return;
    let cancelled = false;

    (async () => {
      try {
        const classifier = await resolveClassifier();
        if (cancelled) return;
        setDeviceProgress(40);
        setDeviceChecks((c) => ({ ...c, modelLoaded: true }));
        setDeviceProgress(65);
        setDeviceChecks((c) => ({ ...c, deviceChecked: true }));

        const passed = await classifier.selfTest();
        if (cancelled) return;
        if (passed) {
          setDeviceProgress(90);
          setDeviceChecks((c) => ({ ...c, selfTestPassed: true }));
        } else {
          setDeviceState('failed');
          return;
        }

        const res = await post('/api/attempt/start', { modelReady: true });
        if (cancelled) return;
        if (res.ok) {
          const data = res.data as AttemptAssignment;
          setAssignment(data);
          setDeviceProgress(100);
          setTimeout(() => !cancelled && setStep(data.resumed ? roundStep(data) : 'ready'), 600);
          return;
        }
        const code = res.error.code;
        if (code === 'ALREADY_COMPLETED') {
          await loadResult();
          return;
        }
        if (code === 'UNAUTHORIZED') {
          setStep('email');
          return;
        }
        if (code === 'PROFILE_REQUIRED') {
          setStep('profile');
          return;
        }
        if (!offline(res.error)) {
          setBlocked({ code, ref: res.error.ref, message: res.error.message });
          setStep('blocked');
          return;
        }
        setAssignment(createLocalAssignment());
        setDeviceProgress(100);
        setTimeout(() => !cancelled && setStep('ready'), 600);
      } catch {
        if (!cancelled) setDeviceState('failed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [step, deviceRun, loadResult]);

  const jump = useCallback((s: string) => {
    if (s.startsWith('round') || s.startsWith('outro') || s === 'result' || s === 'ready') {
      setAssignment((a) => a ?? createLocalAssignment());
      if (s === 'result') setResult(LOCAL_RESULT('local-dev', Math.random() > 0.5));
    }
    setError(null);
    setStep(s as Step);
  }, []);

  const devBar = <TestModeBar onJump={jump} />;

  if (step === 'email') {
    return (
      <>
        <EmailScreen
          email={email}
          onEmail={setEmail}
          valid={emailValid}
          busy={busy}
          error={error}
          onSend={sendCode}
          onKeyDown={(e) => {
            if (e.key === 'Enter') sendCode();
          }}
        />
        {devBar}
      </>
    );
  }

  if (step === 'otp') {
    return (
      <>
        <OtpScreen
          email={email}
          code={code}
          onCode={setCode}
          onVerify={verifyCode}
          busy={busy}
          error={error}
          cooldown={cooldown}
          onResend={sendCode}
          onBack={() => {
            setStep('email');
            setCode('');
            setError(null);
          }}
        />
        {devBar}
      </>
    );
  }

  if (step === 'profile') {
    return (
      <>
        <ProfileScreen
          fullName={fullName}
          onFullName={setFullName}
          gender={gender}
          onGender={setGender}
          collegeId={collegeId}
          onCollege={setCollegeId}
          colleges={colleges}
          busy={busy}
          error={error}
          onContinue={saveProfile}
        />
        {devBar}
      </>
    );
  }

  if (step === 'device') {
    return (
      <>
        <DeviceScreen
          progress={deviceProgress}
          checks={deviceChecks}
          error={deviceState === 'failed' ? { message: DEVICE_FAILED_MESSAGE, code: 'MODEL_UNAVAILABLE' } : error}
          onRetry={startDeviceCheck}
        />
        {devBar}
      </>
    );
  }

  if (step === 'ready' && assignment) {
    return (
      <>
        <ReadyScreen timings={timings} imageCount={assignment.round1.length} onPlay={() => setStep('intro1')} />
        {devBar}
      </>
    );
  }

  if (step === 'intro1') {
    return <Interstitial key="intro1" intro={ROUND_INTROS[1]} timerValue={Math.round(timings.round1MsPerImage / 1000)} onDone={() => setStep('round1')} />;
  }

  if (step === 'round1' && assignment) {
    return (
      <>
        <Round1 attemptId={assignment.attemptId} slots={assignment.round1} msPerImage={timings.round1MsPerImage} onComplete={() => setStep('outro1')} />
        {devBar}
      </>
    );
  }

  if (step === 'outro1') {
    return (
      <>
        <Interstitial key="outro1" outro={ROUND_OUTROS[1]} onDone={() => setStep('intro2')} />
        {devBar}
      </>
    );
  }

  if (step === 'intro2') {
    return <Interstitial key="intro2" intro={ROUND_INTROS[2]} timerValue={Math.round(timings.round2DrawMs / 1000)} onDone={() => setStep('round2')} />;
  }

  if (step === 'round2' && assignment) {
    return (
      <>
        <Round2 attemptId={assignment.attemptId} assignment={assignment.round2} drawMs={timings.round2DrawMs} onComplete={() => setStep('outro2')} />
        {devBar}
      </>
    );
  }

  if (step === 'outro2') {
    return (
      <>
        <Interstitial key="outro2" outro={ROUND_OUTROS[2]} onDone={() => setStep('intro3')} />
        {devBar}
      </>
    );
  }

  if (step === 'intro3') {
    return <Interstitial key="intro3" intro={ROUND_INTROS[3]} timerValue={Math.round(timings.round3Ms / 1000)} onDone={() => setStep('round3')} />;
  }

  if (step === 'round3' && assignment) {
    return (
      <>
        <Round3 attemptId={assignment.attemptId} assignment={assignment.round3} durationMs={timings.round3Ms} onComplete={() => setStep('submitting')} />
        {devBar}
      </>
    );
  }

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
    return (
      <>
        <Result result={result} returning={returningPlayer} />
        {devBar}
      </>
    );
  }

  if (step === 'completed') {
    return (
      <NoticeScreen
        title="YOU ALREADY PLAYED"
        message="Your official attempt is complete. Check the leaderboard to see where you landed."
        sprite="/sprites/mascot-boy-shrug.png"
        action={<PxLink href="/leaderboard" className="min-h-[56px] w-full text-[11px]">VIEW LEADERBOARD</PxLink>}
      />
    );
  }

  if (step === 'blocked') {
    const copy = BLOCKED_COPY[blocked?.code ?? ''] ?? {
      title: 'SOMETHING WENT WRONG',
      body: blocked?.message ?? 'Show this screen to an AIDA team member.',
      showRef: true,
    };
    return (
      <>
        <NoticeScreen
          title={copy.title}
          message={copy.body}
          refCode={copy.showRef ? blocked?.ref : undefined}
          sprite={copy.showRef ? '/sprites/confused-humans.png' : '/sprites/robot-peeking.png'}
          action={
            blocked?.code === 'PROFILE_REQUIRED' ? (
              <PxButton onClick={() => setStep('profile')} className="min-h-[56px] w-full text-[11px]">
                ENTER YOUR NAME
              </PxButton>
            ) : undefined
          }
        />
        {devBar}
      </>
    );
  }

  if (step === 'failed') {
    return (
      <NoticeScreen
        title="SOMETHING WENT WRONG"
        message={error?.message ?? 'Show this screen to an AIDA team member.'}
        refCode={error?.ref}
        sprite="/sprites/confused-humans.png"
        action={<PxLink href="/play" className="min-h-[56px] w-full text-[11px]">TRY AGAIN</PxLink>}
      />
    );
  }

  return (
    <>
      <LoadingScreen />
      {devBar}
    </>
  );
}

function roundStep(a: AttemptAssignment): Step {
  if (a.currentRound === 3) return 'intro3';
  if (a.currentRound === 2) return 'intro2';
  return 'intro1';
}

function Submitting({ attemptId, onDone }: { attemptId: string; onDone: (result: PublicAttemptResult) => void }) {
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function trySubmit(n: number) {
      const res = await post('/api/attempt/complete', { attemptId }).catch(() => null);
      if (cancelled) return;
      if (res?.ok) {
        onDone(toResult(res.data));
        return;
      }
      if (attemptId.startsWith('local-')) {
        setTimeout(() => !cancelled && onDone(LOCAL_RESULT(attemptId, Math.random() > 0.4)), 1200);
        return;
      }
      setRetrying(true);
      setTimeout(() => !cancelled && trySubmit(n + 1), Math.min(2000 * (n + 1), 8000));
    }

    trySubmit(0);
    return () => {
      cancelled = true;
    };
  }, [attemptId, onDone]);

  return <ScoringScreen retrying={retrying} />;
}
