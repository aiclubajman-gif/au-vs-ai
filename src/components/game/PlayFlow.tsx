'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { preload } from 'react-dom';
import { EmailStep, EMAIL_PLATE_SRC } from '@/components/auth/EmailStep';
import { AUTH_PLATE_SRC } from '@/components/auth/AuthShell';
import { OtpStep } from '@/components/auth/OtpStep';
import { ProfileStep } from '@/components/auth/ProfileStep';
import { DeviceStep, type DeviceStage } from '@/components/auth/DeviceStep';
import { Screen } from '@/components/ui';
import { resolveClassifier } from '@/lib/ml/classifier';
import { composeAuEmail } from '@/lib/client/email';
import { Interstitial, ROUND_INTROS, ROUND_OUTROS } from '@/components/game/Interstitial';
import { HowItWorks } from '@/components/game/HowItWorks';
import { FunFact } from '@/components/game/FunFact';
import { Round1 } from '@/components/game/Round1';
import { Round2 } from '@/components/game/Round2';
import { Round3 } from '@/components/game/Round3';
import { Result } from '@/components/game/Result';
import { HUMAN_WIN_PLATE_SRC } from '@/components/game/HumanWinResult';
import { AI_WIN_PLATE_SRC } from '@/components/game/AiWinResult';
import { AlreadyPlayed } from '@/components/game/AlreadyPlayed';
import { SomethingWentWrong } from '@/components/game/SomethingWentWrong';
import { ChallengePaused } from '@/components/game/ChallengePaused';
import { formatRank, formatTopShare } from '@/lib/client/result-text';
import { resumeStep, toResult } from '@/lib/api/serialize';
import { postJson } from '@/lib/client/submit';
import { isSixtySecondGame } from '@/lib/timing';
import type { College, AttemptAssignment, PublicAttemptResult } from '@/types';

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

/**
 * Never throws. A dropped connection or a non-JSON error page comes back as an
 * ordinary failure, so no button is left stuck on "Working…".
 */
async function post<T = unknown>(url: string, body: unknown): Promise<PostResult<T>> {
  const res = await postJson<T>(url, body);
  if (res.ok) return { ok: true, data: res.data };
  return { ok: false, error: { code: res.code, message: res.message, ref: res.ref } };
}

export function PlayFlow({ colleges }: { colleges: College[] }) {
  const [assignment, setAssignment] = useState<AttemptAssignment | null>(null);
  const [result, setResult] = useState<PublicAttemptResult | null>(null);
  const [returningPlayer, setReturningPlayer] = useState(false);
  const [step, setStep] = useState<Step>('loading');
  // The student types only the part before @ajmanuni.ac.ae. Everything that
  // talks to the API (send, resend, verify) uses the composed full address.
  const [emailLocal, setEmailLocal] = useState('');
  const email = composeAuEmail(emailLocal) ?? '';
  const [code, setCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [collegeId, setCollegeId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Restore an existing session on mount. A refresh mid-game resumes rather
  // than sending the student back through email and OTP.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/session').then((r) => r.json());
        if (cancelled) return;
        if (!res.ok || !res.data.signedIn) {
          setStep('email');
          return;
        }
        if (res.data.attemptStatus === 'completed') {
          // Show the actual score, not a bare "already played" (§7). A student
          // who reopens the link wants to see how they did and their rank.
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

  // A student whose attempt is already finished but who arrived without their
  // result (signed in again, refused a new game, or the restore read failed)
  // still sees the real result, loaded the same way as a restored session.
  useEffect(() => {
    if (step !== 'completed' || result) return;
    let cancelled = false;
    post('/api/attempt/result', {}).then((r) => {
      if (cancelled || !r.ok) return;
      setResult(toResult(r.data));
      setReturningPlayer(true);
      setStep('result');
    });
    return () => {
      cancelled = true;
    };
  }, [step, result]);

  // Visible resend countdown (§7).
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Most visitors land on the email screen, so start fetching its artwork while
  // the session check runs rather than after it.
  preload(EMAIL_PLATE_SRC, { as: 'image', fetchPriority: 'high' });
  // OTP, Profile and Ready share one plate; have it cached before the code arrives.
  preload(AUTH_PLATE_SRC, { as: 'image', fetchPriority: 'low' });
  // Which result plate is needed is only known once scoring returns, so fetch
  // both during the last round and the score is never revealed on a bare page.
  if (step === 'round3' || step === 'submitting') {
    preload(HUMAN_WIN_PLATE_SRC, { as: 'image', fetchPriority: 'low' });
    preload(AI_WIN_PLATE_SRC, { as: 'image', fetchPriority: 'low' });
  }

  // Synchronous guard shared by the button, the Enter key and "Resend", so
  // repeated presses cannot fire overlapping sends before `busy` re-renders.
  const sending = useRef(false);

  async function sendCode() {
    if (sending.current || !email) return;
    sending.current = true;
    setBusy(true);
    setError(null);

    try {
      const res = await post<{ cooldownMs?: number }>('/api/auth/send-otp', { email });
      if (!res.ok) {
        setError({ message: res.error.message, ref: res.error.ref });
        return;
      }
      setCooldown(Math.ceil((res.data.cooldownMs ?? 60000) / 1000));
      setStep('otp');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  const verifyCode = useCallback(
    async (entered: string) => {
      setBusy(true);
      setError(null);

      try {
        const res = await post<{ needsProfile: boolean; attemptStatus: string }>(
          '/api/auth/verify-otp',
          { email, token: entered },
        );

        if (!res.ok) {
          setError({ message: res.error.message, ref: res.error.ref });
          setCode('');
          return;
        }

        if (res.data.attemptStatus === 'completed') {
          setStep('completed');
          return;
        }
        setStep(res.data.needsProfile ? 'profile' : 'device');
      } finally {
        setBusy(false);
      }
    },
    [email],
  );

  async function saveProfile() {
    setBusy(true);
    setError(null);

    try {
      const res = await post('/api/profile', {
        fullName,
        collegeId: collegeId ? Number(collegeId) : null,
      });

      if (!res.ok) {
        setError({ message: res.error.message, ref: res.error.ref });
        return;
      }
      setStep('device');
    } finally {
      setBusy(false);
    }
  }

  // ------------------------------------------------------------------
  // §8 — the device check. The model must load AND pass a hidden test
  // inference before an official attempt exists. A student whose phone
  // cannot run it is sent to a booth tablet with their attempt intact.
  // ------------------------------------------------------------------
  const [deviceState, setDeviceState] = useState<'checking' | 'ok' | 'failed'>('checking');
  // Which milestone the check has reached, for the progress display only.
  const [deviceStage, setDeviceStage] = useState<DeviceStage>('model');

  useEffect(() => {
    if (step !== 'device') return;
    let cancelled = false;

    (async () => {
      setDeviceState('checking');
      setDeviceStage('model');
      try {
        const classifier = await resolveClassifier();
        if (!cancelled) setDeviceStage('selftest');
        const passed = await classifier.selfTest();
        if (cancelled) return;
        setDeviceState(passed ? 'ok' : 'failed');

        // §8 — the attempt is only created once the model has proven it runs
        // on THIS device. A student on an unsupported phone keeps their attempt.
        if (passed) {
          setDeviceStage('start');
          const res = await post('/api/attempt/start', { modelReady: true });
          if (cancelled) return;

          if (!res.ok) {
            // The device passed its check — this is the SERVER declining to
            // create an attempt (challenge closed, paused, content missing).
            // Showing "use a booth tablet" here would blame the wrong thing.
            setError({
              message: res.error.message,
              ref: res.error.ref,
              code: res.error.code,
            });
            setStep('blocked');
            return;
          }
          const data = res.data as AttemptAssignment;

          if (data.status === 'completed') {
            setAssignment(data);
            setStep('completed');
            return;
          }

          // The only way into a round. The timing frozen on the attempt must
          // make a complete 60-second game with the images it was assigned;
          // anything else (e.g. an attempt from before the snapshot existed)
          // is refused here rather than played on made-up timing.
          if (!isSixtySecondGame(data.round1.length, data.timing)) {
            setError({
              message: 'This game cannot be played in its current state.',
              code: 'TIMING_UNAVAILABLE',
            });
            setStep('blocked');
            return;
          }
          setAssignment(data);

          // Placement comes from the frozen server state, so a refresh resumes
          // exactly where the student was rather than replaying Round 1.
          const next = resumeStep(data);
          // A fresh game gets the Round 1 explainer. A resuming student goes
          // straight back to their round — they have already read it.
          const landing = data.resumed ? next : 'intro1';
          setDeviceStage('done');
          setTimeout(() => {
            if (!cancelled) setStep(landing as Step);
          }, 500);
        }
      } catch {
        if (!cancelled) setDeviceState('failed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [step]);

  // ==================================================================
  if (step === 'loading') {
    return (
      <Screen>
        <div className="flex flex-1 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--color-edge)] border-t-[var(--color-cyan)]" />
        </div>
      </Screen>
    );
  }

  if (step === 'email') {
    return (
      <EmailStep
        localPart={emailLocal}
        onLocalPartChange={setEmailLocal}
        onSubmit={sendCode}
        busy={busy}
        error={error}
      />
    );
  }

  if (step === 'otp') {
    return (
      <OtpStep
        email={email}
        code={code}
        onCodeChange={setCode}
        onComplete={verifyCode}
        onResend={sendCode}
        onBack={() => {
          setStep('email');
          setCode('');
          setError(null);
        }}
        cooldown={cooldown}
        busy={busy}
        error={error}
      />
    );
  }

  if (step === 'profile') {
    return (
      <ProfileStep
        fullName={fullName}
        onFullNameChange={setFullName}
        collegeId={collegeId}
        onCollegeIdChange={setCollegeId}
        colleges={colleges}
        onSubmit={saveProfile}
        busy={busy}
        error={error}
      />
    );
  }

  if (step === 'device') {
    return (
      <DeviceStep
        state={deviceState}
        stage={deviceStage}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (step === 'blocked') {
    const code = error?.code ?? '';
    // The pause is enforced by start_attempt(); this only picks the screen.
    if (code === 'NEW_GAMES_PAUSED') return <ChallengePaused homeHref="/" />;

    const copy = BLOCKED_COPY[code] ?? {
      title: 'Not available right now',
      body: error?.message ?? 'Please ask an AIDA team member.',
      showRef: true,
    };
    // Only a request that never reached the API is described as a connection
    // problem; every refusal keeps its own explanation.
    const offline = code === 'NETWORK' || code === 'BAD_RESPONSE';

    return (
      <SomethingWentWrong
        lead={
          offline
            ? "We couldn't complete your request right now.\nPlease check your connection and try again."
            : "We couldn't start your game right now."
        }
        cardTitle={offline ? 'No internet connection?' : copy.title}
        cardBody={offline ? 'Check your network or try again in a few moments.' : copy.body}
        icon={offline ? 'offline' : 'alert'}
        reference={copy.showRef ? error?.ref : undefined}
        onRetry={() => window.location.reload()}
        homeHref="/"
      />
    );
  }

  if (step === 'completed') {
    // The result is loading (see the effect above) or could not be read.
    return <AlreadyPlayedScreen result={null} />;
  }

  // Every timer below comes from the attempt's own frozen snapshot, which the
  // device step has already checked adds up to 60 seconds.
  const timing = assignment?.timing ?? null;

  // Every interstitial gets its own `key`. They render at the same place in the
  // tree, so without one React reuses the previous screen's instance and its
  // countdown: an outro that timed out would instantly skip the next intro.
  if (step === 'intro1' && assignment && timing) {
    return (
      <HowItWorks
        key="intro1"
        round1Images={assignment.round1.length}
        round1MsPerImage={timing.round1MsPerImage}
        round2DrawMs={timing.round2DrawMs}
        round3Ms={timing.round3Ms}
        onDone={() => setStep('round1')}
      />
    );
  }

  if (step === 'round1' && assignment && timing) {
    return (
      <Round1
        attemptId={assignment.attemptId}
        slots={assignment.round1}
        msPerImage={timing.round1MsPerImage}
        onComplete={() => setStep('outro1')}
      />
    );
  }

  if (step === 'outro1') {
    return <FunFact key="outro1" onDone={() => setStep('intro2')} />;
  }

  if (step === 'intro2' && timing) {
    return (
      <Interstitial
        key="intro2"
        intro={ROUND_INTROS[2]}
        timerValue={Math.round(timing.round2DrawMs / 1000)}
        onDone={() => setStep('round2')}
      />
    );
  }

  if (step === 'round2' && assignment && timing) {
    return (
      <Round2
        attemptId={assignment.attemptId}
        assignment={assignment.round2}
        drawMs={timing.round2DrawMs}
        onComplete={() => setStep('outro2')}
      />
    );
  }

  if (step === 'outro2') {
    return <Interstitial key="outro2" outro={ROUND_OUTROS[2]} onDone={() => setStep('intro3')} />;
  }

  if (step === 'intro3' && timing) {
    return (
      <Interstitial
        key="intro3"
        intro={ROUND_INTROS[3]}
        timerValue={Math.round(timing.round3Ms / 1000)}
        onDone={() => setStep('round3')}
      />
    );
  }

  if (step === 'round3' && assignment && timing) {
    return (
      <Round3
        attemptId={assignment.attemptId}
        assignment={assignment.round3}
        durationMs={timing.round3Ms}
        onComplete={() => setStep('submitting')}
      />
    );
  }

  if (step === 'submitting' && assignment) {
    return <Submitting attemptId={assignment.attemptId} onDone={(r) => { setResult(r); setStep('result'); }} />;
  }

  if (step === 'result' && result) {
    // A student reopening a finished game sees Already Played with their
    // result; one who has just finished sees the Human Win / AI Win reveal.
    if (returningPlayer) return <AlreadyPlayedScreen result={result} />;
    return <Result result={result} />;
  }

  return (
    <Screen>
      <div className="flex flex-1 flex-col justify-center text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[var(--color-edge)] border-t-[var(--color-cyan)]" />
      </div>
    </Screen>
  );
}

function AlreadyPlayedScreen({ result }: { result: PublicAttemptResult | null }) {
  return (
    <AlreadyPlayed
      scoreText={result ? String(result.totalScore) : '—'}
      rankText={result ? formatRank(result.rank) : '—'}
      playerCountText={result && result.totalPlayers > 0 ? String(result.totalPlayers) : '—'}
      topShareText={result ? formatTopShare(result.percentileBeaten, result.totalPlayers) : '—'}
      leaderboardHref="/leaderboard"
      joinHref="/club"
      homeHref="/"
    />
  );
}

/**
 * What a student sees when the server declines to start a game.
 *
 * Each case is written for the person actually standing at the booth: it says
 * what happened, whether it is their problem, and what to do next. A generic
 * error here sends students away thinking the game is broken.
 */
const BLOCKED_COPY: Record<string, { title: string; body: string; showRef: boolean }> = {
  CHALLENGE_CLOSED: {
    title: 'Not open yet',
    body: 'The challenge opens at the AIDA booth during the Club Fair. Come and find us on 22-23 September.',
    showRef: false,
  },
  NEW_GAMES_PAUSED: {
    title: 'Paused for a moment',
    body: "We've paused new games briefly. Wait a few seconds and try again, or ask an AIDA team member.",
    showRef: false,
  },
  ROUND1_BANK_TOO_SMALL: {
    title: 'Not ready yet',
    body: 'The challenge is still being set up. Please show this screen to an AIDA team member.',
    showRef: true,
  },
  ROUND1_BANK_UNBALANCED: {
    title: 'Not ready yet',
    body: 'The challenge is still being set up. Please show this screen to an AIDA team member.',
    showRef: true,
  },
  // start_attempt() refused before creating anything, so nothing was used up.
  SETTINGS_UNAVAILABLE: {
    title: 'Not available right now',
    body: "We couldn't load the game settings. Your attempt has not been used. Try again in a moment.",
    showRef: true,
  },
  TIMING_UNAVAILABLE: {
    title: 'Not ready yet',
    body: 'This game was set up in an older format and cannot be played. Please show this screen to an AIDA team member.',
    showRef: true,
  },
  NO_ROUND3_QUESTION: {
    title: 'Not ready yet',
    body: 'The final round is still being set up. Please show this screen to an AIDA team member.',
    showRef: true,
  },
  NO_DRAWING_CLASSES: {
    title: 'Not ready yet',
    body: 'The drawing round is still being set up. Please show this screen to an AIDA team member.',
    showRef: true,
  },
  PROFILE_REQUIRED: {
    title: 'Almost there',
    body: 'We need your name before you can start. Refresh and try again.',
    showRef: false,
  },
};

/**
 * Final submission with retry (§40).
 *
 * complete_attempt() is idempotent, so retrying after a dropped connection
 * returns the existing result rather than rescoring. A student's finished game
 * is never thrown away because the venue wifi blinked.
 */
function Submitting({
  attemptId,
  onDone,
}: {
  attemptId: string;
  onDone: (r: PublicAttemptResult) => void;
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

      setAttemptsMade(n + 1);
      setTimeout(() => !cancelled && trySubmit(n + 1), Math.min(2000 * (n + 1), 8000));
    }

    trySubmit(0);
    return () => {
      cancelled = true;
    };
  }, [attemptId, onDone]);

  return (
    <Screen>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-[var(--color-edge)] border-t-[var(--color-cyan)]" />
        <p className="mt-6 text-sm text-[var(--color-muted)]">
          {attemptsMade === 0
            ? 'Scoring your game…'
            : 'Connection lost. Your result is safe — reconnecting…'}
        </p>
      </div>
    </Screen>
  );
}
