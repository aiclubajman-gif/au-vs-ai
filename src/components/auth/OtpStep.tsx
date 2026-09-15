'use client';

import { useId } from 'react';
import { OtpInput } from '@/components/game/OtpInput';
import { AuthShell, AuthNotice, Spinner } from '@/components/auth/AuthShell';
import shell from './AuthShell.module.css';
import styles from './OtpStep.module.css';

/**
 * Page 2 of sign-in: the 6-digit code.
 *
 * Presentation only. Entry, paste, auto-submit and backspace live in OtpInput;
 * verify, resend (with its guard) and the cooldown live in PlayFlow.
 */
export function OtpStep({
  email,
  code,
  onCodeChange,
  onComplete,
  onResend,
  onBack,
  cooldown,
  busy,
  error,
}: {
  /** The full address the code was sent to. */
  email: string;
  code: string;
  onCodeChange: (next: string) => void;
  onComplete: (code: string) => void;
  onResend: () => void;
  onBack: () => void;
  /** Seconds until Resend is allowed. */
  cooldown: number;
  busy: boolean;
  error: { message: string; ref?: string } | null;
}) {
  const ids = useId();
  const titleId = `${ids}-title`;
  // A full code while busy is a verify in flight; otherwise busy is a resend.
  const verifying = busy && code.length === 6;

  return (
    <AuthShell step="otp" labelledBy={titleId}>
      <h1 id={titleId} className={shell.title}>
        <span className={shell.human}>Enter the 6-digit code</span>
      </h1>
      <p className={shell.subtitle}>
        We&rsquo;ve sent a code to {email ? <strong>{email}</strong> : 'your email'}.
      </p>

      <OtpInput
        value={code}
        onChange={onCodeChange}
        onComplete={onComplete}
        disabled={busy}
        groupClassName={styles.boxes}
        inputClassName={styles.box}
      />

      {error && (
        <AuthNotice tone="error" title="Code not accepted" refCode={error.ref}>
          {error.message}
        </AuthNotice>
      )}

      {/* Speaks on state changes only, never on each countdown tick. */}
      <p className="sr-only" aria-live="polite">
        {verifying
          ? 'Checking your code'
          : busy
            ? 'Sending a new code'
            : cooldown === 0
              ? 'You can resend the code now'
              : ''}
      </p>

      <div className={styles.resend}>
        {verifying ? (
          <p className={styles.status}>
            <Spinner />
            Checking your code…
          </p>
        ) : busy ? (
          <p className={styles.status}>
            <Spinner />
            Sending a new code…
          </p>
        ) : cooldown > 0 ? (
          <p className={styles.status}>
            Resend code in <span className={styles.countdown}>{formatClock(cooldown)}</span>
          </p>
        ) : (
          <button type="button" className={styles.resendButton} onClick={onResend}>
            Resend code
          </button>
        )}
      </div>

      {/*
        Real finding from testing against an Ajman inbox: codes land in
        Microsoft 365 QUARANTINE, which is separate from Junk and invisible in
        phone mail apps. Students won't find it unless told where to look.
      */}
      <div className={`${shell.frame} ${styles.help}`}>
        <BulbIcon className={styles.bulb} />
        <span className={styles.helpDivider} aria-hidden="true" />
        <div className={styles.helpText}>
          <h2 className={styles.helpTitle}>Code not showing?</h2>
          <ul className={styles.helpList}>
            <li>
              <CheckIcon className={styles.check} />
              Check your Junk folder
            </li>
            <li>
              <CheckIcon className={styles.check} />
              Check Quarantine in AU web mail
            </li>
            <li>
              <CheckIcon className={styles.check} />
              Ask the AIDA team for help
            </li>
          </ul>
        </div>
      </div>

      <button type="button" className={`${shell.secondary} ${styles.back}`} onClick={onBack}>
        Back to Email
      </button>
    </AuthShell>
  );
}

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

type IconProps = { className?: string };

function BulbIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M24 12a10 10 0 0 0-6 18c1.3 1 2 2.3 2 3.8V35h8v-1.2c0-1.5.7-2.8 2-3.8a10 10 0 0 0-6-18Z"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path d="M20 39h8M21.5 43h5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path
        d="M24 3v4M8.5 9.5l2.8 2.8M39.5 9.5l-2.8 2.8M3 24h4M41 24h4"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path
        d="m7.5 12.3 3 3 6-6.3"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
