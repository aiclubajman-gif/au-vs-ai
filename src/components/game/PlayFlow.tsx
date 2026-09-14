'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { OtpInput } from '@/components/game/OtpInput';
import { Screen, Title, Hint, Button, ErrorBanner, Spacer } from '@/components/ui';
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

/**
 * Never throws. A dropped connection or a non-JSON error page comes back as an
 * ordinary failure, so no button is left stuck on "Working…".
 */
async function post<T = unknown>(url: string, body: unknown): Promise<PostResult<T>> {
  const res = await postJson<T>(url, body);
  if (res.ok) return { ok: true, data: res.data };
  return { ok: false, error: { code: res.code, message: res.message, ref: res.ref } };
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

  // Visible resend countdown (§7).
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const emailValid = isAuEmail(email);

  // Synchronous guard shared by the button, the Enter key and "Resend", so
  // repeated presses cannot fire overlapping sends before `busy` re-renders.
  const sending = useRef(false);

  async function sendCode() {
    if (sending.current || !isAuEmail(email)) return;
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

  useEffect(() => {
    if (step !== 'device') return;
    let cancelled = false;

    (async () => {
      setDeviceState('checking');
      try {
        const classifier = await resolveClassifier();
        const passed = await classifier.selfTest();
        if (cancelled) return;
        setDeviceState(passed ? 'ok' : 'failed');

        // §8 — the attempt is only created once the model has proven it runs
        // on THIS device. A student on an unsupported phone keeps their attempt.
        if (passed) {
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
          setAssignment(data);

          if (data.status === 'completed') {
            setStep('completed');
            return;
          }

          // Placement comes from the frozen server state, so a refresh resumes
          // exactly where the student was rather than replaying Round 1.
          const next = resumeStep(data);
          // A fresh game gets the Round 1 explainer. A resuming student goes
          // straight back to their round — they have already read it.
          const landing = data.resumed ? next : 'intro1';
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
      <Screen>
        <Title>Sign in to play</Title>
        <Hint>
          Enter your Ajman University email. We&apos;ll send a 6-digit code. One official
          attempt per student.
        </Hint>

        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') sendCode();
          }}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={AU_DOMAIN_HINT}
          aria-label="Ajman University email"
          className="mt-8 w-full rounded-xl border border-[var(--color-edge)] bg-[var(--color-navy)] px-4 py-4 text-[var(--color-ink)] placeholder:text-[var(--color-muted)]/60 focus:border-[var(--color-cyan)]"
        />

        {email.length > 3 && !emailValid && (
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Must end in @ajmanuni.ac.ae
          </p>
        )}

        <ErrorBanner message={error?.message ?? ''} refCode={error?.ref} />
        <Spacer />

        <p className="mb-4 text-xs leading-relaxed text-[var(--color-muted)]">
          Check your Junk folder if the code doesn&apos;t appear. It can take up to a minute.
        </p>
        <Button onClick={sendCode} disabled={!emailValid} busy={busy}>
          Send code
        </Button>
      </Screen>
    );
  }

  if (step === 'otp') {
    return (
      <Screen>
        <Title>Enter your code</Title>
        <Hint>Sent to {email}.</Hint>

        <OtpInput value={code} onChange={setCode} onComplete={verifyCode} disabled={busy} />
        <ErrorBanner message={error?.message ?? ''} refCode={error?.ref} />

        {/*
          Real finding from testing against an Ajman inbox: codes land in
          Microsoft 365 QUARANTINE, which is a separate place from the Junk
          folder and is not visible in any mail client. Students will never
          find it unless told exactly where to look, so the instructions are
          on screen rather than buried in a volunteer's memory.
        */}
        <details className="mt-6 rounded-lg border border-[var(--color-edge)] bg-[var(--color-navy)] px-4 py-3">
          <summary className="cursor-pointer text-sm text-[var(--color-cyan)]">
            Code hasn&apos;t arrived?
          </summary>
          <ol className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--color-muted)]">
            <li>1. Check your Junk folder.</li>
            <li>
              2. Open your AU email on the web and check Quarantine. It&apos;s separate
              from Junk and your phone app won&apos;t show it.
            </li>
            <li>3. Search your mail for &ldquo;AU vs AI&rdquo;.</li>
            <li>4. Still nothing? Ask an AIDA team member — we can sign you in.</li>
          </ol>
        </details>

        <Spacer />

        <button
          onClick={sendCode}
          disabled={cooldown > 0 || busy}
          className="mb-4 w-full py-3 text-sm text-[var(--color-cyan)] disabled:text-[var(--color-muted)]"
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </button>

        <button
          onClick={() => {
            setStep('email');
            setCode('');
            setError(null);
          }}
          className="w-full py-2 text-sm text-[var(--color-muted)]"
        >
          Use a different email
        </button>
      </Screen>
    );
  }

  if (step === 'profile') {
    return (
      <Screen>
        <Title>Your name</Title>
        <Hint>
          This is what appears on the leaderboard. Your email stays private.
        </Hint>

        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          type="text"
          autoComplete="name"
          placeholder="First and last name"
          aria-label="Your full name"
          className="mt-8 w-full rounded-xl border border-[var(--color-edge)] bg-[var(--color-navy)] px-4 py-4 text-[var(--color-ink)] placeholder:text-[var(--color-muted)]/60 focus:border-[var(--color-cyan)]"
        />

        {colleges.length > 0 && (
          <select
            value={collegeId}
            onChange={(e) => setCollegeId(e.target.value)}
            aria-label="Your college"
            className="mt-3 w-full rounded-xl border border-[var(--color-edge)] bg-[var(--color-navy)] px-4 py-4 text-[var(--color-ink)] focus:border-[var(--color-cyan)]"
          >
            <option value="">College (optional)</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        <ErrorBanner message={error?.message ?? ''} refCode={error?.ref} />
        <Spacer />
        <Button onClick={saveProfile} disabled={fullName.trim().length < 2} busy={busy}>
          Continue
        </Button>
      </Screen>
    );
  }

  if (step === 'device') {
    return (
      <Screen>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {deviceState === 'checking' && (
            <>
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-[var(--color-edge)] border-t-[var(--color-cyan)]" />
              <p className="mt-6 text-sm text-[var(--color-muted)]">
                Getting the drawing round ready…
              </p>
            </>
          )}

          {deviceState === 'ok' && (
            <p className="text-lg font-semibold text-[var(--color-win)]">Ready</p>
          )}

          {deviceState === 'failed' && (
            <>
              <Title>This phone can&apos;t run the drawing round</Title>
              <Hint>
                Round 2 needs features your browser doesn&apos;t support. Ask an AIDA team
                member for a booth tablet.
              </Hint>
              <Hint>
                <strong className="text-[var(--color-ink)]">
                  Your attempt has not been used.
                </strong>{' '}
                You can still play on another device.
              </Hint>

              <div className="mt-8 w-full">
                <Button variant="ghost" onClick={() => window.location.reload()}>
                  Try again
                </Button>
              </div>
            </>
          )}
        </div>
      </Screen>
    );
  }

  if (step === 'blocked') {
    const code = error?.code ?? '';
    const copy = BLOCKED_COPY[code] ?? {
      title: 'Not available right now',
      body: error?.message ?? 'Please ask an AIDA team member.',
      showRef: true,
    };

    return (
      <Screen>
        <div className="flex flex-1 flex-col justify-center text-center">
          <Title>{copy.title}</Title>
          <Hint>{copy.body}</Hint>

          {copy.showRef && error?.ref && (
            <p className="mt-6 font-mono text-xs text-[var(--color-muted)]">{error.ref}</p>
          )}

          <div className="mt-10 space-y-3">
            <Button onClick={() => window.location.reload()}>Try again</Button>
            <Button variant="ghost" onClick={() => (window.location.href = '/leaderboard')}>
              View leaderboard
            </Button>
          </div>
        </div>
      </Screen>
    );
  }

  if (step === 'completed') {
    return (
      <Screen>
        <div className="flex flex-1 flex-col justify-center">
          <Title>You&apos;ve already played</Title>
          <Hint>
            Your official attempt is complete. Check the AIDA booth screen at the end of the
            fair for final rankings.
          </Hint>
          <div className="mt-8">
            <Button variant="ghost" onClick={() => (window.location.href = '/leaderboard')}>
              View leaderboard
            </Button>
          </div>
        </div>
      </Screen>
    );
  }

  // Every interstitial gets its own `key`. They render at the same place in the
  // tree, so without one React reuses the previous screen's instance and its
  // countdown: an outro that timed out would instantly skip the next intro.
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

  if (step === 'outro1') {
    return <Interstitial key="outro1" outro={ROUND_OUTROS[1]} onDone={() => setStep('intro2')} />;
  }

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

  if (step === 'outro2') {
    return <Interstitial key="outro2" outro={ROUND_OUTROS[2]} onDone={() => setStep('intro3')} />;
  }

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

  if (step === 'submitting' && assignment) {
    return <Submitting attemptId={assignment.attemptId} onDone={(r) => { setResult(r); setStep('result'); }} />;
  }

  if (step === 'result' && result) {
    return <Result result={result} returning={returningPlayer} />;
  }

  return (
    <Screen>
      <div className="flex flex-1 flex-col justify-center text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[var(--color-edge)] border-t-[var(--color-cyan)]" />
      </div>
    </Screen>
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
