'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { AuthStepper } from '@/components/auth/AuthStepper';
import { AU_DOMAIN, AU_USERNAME_HINT, composeAuEmail, toEmailLocalPart } from '@/lib/client/email';
import styles from './EmailStep.module.css';

/**
 * Page 1 of sign-in: the student's AU email.
 *
 * The background plate already paints the characters, campus, glass card and
 * the empty frames for the field, button and info box. Everything readable or
 * interactive here is real HTML positioned onto those frames, in artwork pixels
 * (see `--u` in the stylesheet).
 */
export const EMAIL_PLATE_SRC = '/design/auth/email-plate-941w.webp';

export function EmailStep({
  localPart,
  onLocalPartChange,
  onSubmit,
  busy,
  error,
}: {
  /** The part before @ajmanuni.ac.ae, as shown in the box. */
  localPart: string;
  onLocalPartChange: (value: string) => void;
  /** Sends the code. Owns the busy guard, so repeated calls are safe. */
  onSubmit: () => void;
  busy: boolean;
  error: { message: string; ref?: string } | null;
}) {
  const ids = useId();
  const labelId = `${ids}-label`;
  const suffixId = `${ids}-suffix`;
  const messageId = `${ids}-message`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [attempted, setAttempted] = useState(false);

  const valid = composeAuEmail(localPart) !== null;
  const hint = valid ? null : describeProblem(localPart, attempted);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (!valid) {
      setAttempted(true);
      inputRef.current?.focus();
      return;
    }
    onSubmit();
  }

  return (
    <main className={styles.page}>
      <div className={styles.stage}>
        <Image
          src={EMAIL_PLATE_SRC}
          alt=""
          aria-hidden="true"
          width={941}
          height={1670}
          unoptimized
          loading="eager"
          fetchPriority="high"
          draggable={false}
          className={styles.plate}
        />

        <header className={styles.brand}>
          <p className="sr-only">AU vs AI</p>
          <p className={styles.tagline}>The 60 second challenge</p>
        </header>

        <div className={styles.stepper}>
          <AuthStepper current="email" />
        </div>

        <h1 className={styles.headline}>
          <span className={styles.headlineHuman}>Let&rsquo;s get</span>{' '}
          <span className={styles.headlineAi}>started</span>
        </h1>

        <p className={styles.subtitle}>
          Enter your Ajman University email to begin the challenge.
        </p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label className={styles.field} htmlFor={`${ids}-email`}>
            <span id={labelId} className="sr-only">
              Ajman University email, the part before
            </span>
            <MailIcon className={styles.fieldIcon} />
            <input
              ref={inputRef}
              id={`${ids}-email`}
              className={styles.input}
              value={localPart}
              onChange={(e) => onLocalPartChange(toEmailLocalPart(e.target.value))}
              readOnly={busy}
              type="text"
              inputMode="email"
              enterKeyHint="send"
              autoComplete="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={120}
              placeholder={AU_USERNAME_HINT}
              aria-labelledby={`${labelId} ${suffixId}`}
              aria-invalid={hint ? true : undefined}
              aria-describedby={hint || error ? messageId : undefined}
            />
            <span id={suffixId} className={styles.suffix}>
              @{AU_DOMAIN}
            </span>
          </label>

          <button
            type="submit"
            className={styles.cta}
            disabled={busy}
            aria-busy={busy}
            data-busy={busy || undefined}
          >
            {busy ? (
              <>
                <span className={styles.spinner} aria-hidden="true" />
                Sending code…
              </>
            ) : (
              <>
                Send Code
                <ArrowIcon className={styles.ctaIcon} />
              </>
            )}
          </button>
        </form>

        <ul className={styles.info}>
          <li className={styles.infoRow}>
            <CapIcon className={styles.infoIcon} />
            <div>
              <p className={styles.infoTitle}>AU students only</p>
              <p className={styles.infoBody}>
                Please use your official Ajman University email address.
              </p>
            </div>
          </li>
          <li className={styles.infoRow}>
            <ShieldIcon className={styles.infoIcon} />
            <div>
              <p className={styles.infoTitle}>One official attempt</p>
              <p className={styles.infoBody}>
                Each student is allowed one official attempt during the event.
              </p>
            </div>
          </li>
        </ul>

        {/* One slot over the info box for both a typing hint and a send failure.
            A hint about what is in the box right now wins over an older error. */}
        <div id={messageId} className={styles.messageSlot} aria-live="polite">
          {hint ? (
            <div className={styles.message} data-tone="hint">
              <AlertIcon className={styles.messageIcon} />
              <div>
                <p className={styles.messageTitle}>{hint.title}</p>
                <p className={styles.messageBody}>{hint.body}</p>
              </div>
            </div>
          ) : error ? (
            <div className={styles.message} data-tone="error" role="alert">
              <AlertIcon className={styles.messageIcon} />
              <div>
                <p className={styles.messageTitle}>Code not sent</p>
                <p className={styles.messageBody}>{error.message}</p>
                {error.ref && <p className={styles.messageRef}>{error.ref}</p>}
              </div>
            </div>
          ) : null}
        </div>

        <p className={styles.privacy}>
          <LockIcon className={styles.privacyIcon} />
          <span>Your email stays private and never appears on the leaderboard.</span>
        </p>
      </div>
    </main>
  );
}

function describeProblem(localPart: string, attempted: boolean) {
  if (localPart === '') {
    return attempted
      ? { title: 'Email needed', body: 'Enter your AU email to get your code.' }
      : null;
  }
  if (localPart.includes('@')) {
    return {
      title: 'AU email only',
      body: `Type only the part before @${AU_DOMAIN}. We add the rest.`,
    };
  }
  if (/\s/.test(localPart)) {
    return { title: 'Check your email', body: 'Your AU email can’t contain spaces.' };
  }
  return { title: 'Check your email', body: 'That email is too long.' };
}

// ---------------------------------------------------------------------------
// Line icons. Decorative: every one sits next to text that says the same thing.
// ---------------------------------------------------------------------------

type IconProps = { className?: string };

function MailIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="m3.5 6 8.5 7 8.5-7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 12h17m-7-7 7 7-7 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CapIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 40" fill="none" aria-hidden="true">
      <path d="M24 4 3 13l21 9 21-9-21-9Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <path
        d="M11 17v10c0 3 6 7 13 7s13-4 13-7V17"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M43 14v12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="43" cy="29" r="2.5" fill="currentColor" />
    </svg>
  );
}

function ShieldIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 40 46" fill="none" aria-hidden="true">
      <path
        d="M20 3 4 9v12c0 11 7 19 16 22 9-3 16-11 16-22V9L20 3Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="m12.5 23 5.5 5.5 10-11"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="11" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" />
      <path d="M12 15v2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function AlertIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="16.8" r="1.3" fill="currentColor" />
    </svg>
  );
}
