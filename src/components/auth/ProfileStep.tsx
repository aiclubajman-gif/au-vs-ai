'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { AuthShell, AuthNotice, Spinner } from '@/components/auth/AuthShell';
import type { College } from '@/types';
import shell from './AuthShell.module.css';
import styles from './ProfileStep.module.css';

/**
 * Page 3 of sign-in: the name shown on the leaderboard, and optional college.
 *
 * Only the fields /api/profile accepts. The mockup's gender row is omitted:
 * profiles have no such column. Full validation stays on the server
 * (nameSchema); the client only catches an empty or one-letter name, the same
 * threshold the old screen used.
 */
export function ProfileStep({
  fullName,
  onFullNameChange,
  collegeId,
  onCollegeIdChange,
  colleges,
  onSubmit,
  busy,
  error,
}: {
  fullName: string;
  onFullNameChange: (value: string) => void;
  collegeId: string;
  onCollegeIdChange: (value: string) => void;
  colleges: College[];
  onSubmit: () => void;
  busy: boolean;
  error: { message: string; ref?: string } | null;
}) {
  const ids = useId();
  const titleId = `${ids}-title`;
  const nameId = `${ids}-name`;
  const collegeFieldId = `${ids}-college`;
  const hintId = `${ids}-hint`;
  const nameRef = useRef<HTMLInputElement>(null);
  const [attempted, setAttempted] = useState(false);

  const nameValid = fullName.trim().length >= 2;
  const showHint = attempted && !nameValid;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (!nameValid) {
      setAttempted(true);
      nameRef.current?.focus();
      return;
    }
    onSubmit();
  }

  return (
    <AuthShell step="profile" labelledBy={titleId}>
      <h1 id={titleId} className={shell.title}>
        <span className={shell.human}>Set up your</span> <span className={shell.ai}>profile</span>
      </h1>
      <p className={shell.subtitle}>This is how you&rsquo;ll appear on the leaderboard.</p>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field} data-invalid={showHint || undefined}>
          <PersonIcon className={styles.fieldIcon} />
          <div className={styles.fieldBody}>
            <label className={styles.label} htmlFor={nameId}>
              Full name
            </label>
            <input
              ref={nameRef}
              id={nameId}
              className={styles.control}
              value={fullName}
              onChange={(e) => onFullNameChange(e.target.value)}
              readOnly={busy}
              type="text"
              autoComplete="name"
              autoCapitalize="words"
              enterKeyHint="go"
              maxLength={60}
              placeholder="Enter your full name"
              aria-invalid={showHint || undefined}
              aria-describedby={showHint ? hintId : undefined}
            />
          </div>
        </div>

        {showHint && (
          <AuthNotice tone="hint" id={hintId}>
            Enter your name.
          </AuthNotice>
        )}

        {colleges.length > 0 && (
          <div className={styles.field}>
            <BuildingIcon className={styles.fieldIcon} />
            <div className={styles.fieldBody}>
              <label className={styles.label} htmlFor={collegeFieldId}>
                College <span className={styles.optional}>(optional)</span>
              </label>
              <div className={styles.selectWrap}>
                <select
                  id={collegeFieldId}
                  className={`${styles.control} ${styles.select}`}
                  value={collegeId}
                  onChange={(e) => onCollegeIdChange(e.target.value)}
                  disabled={busy}
                  data-empty={collegeId === '' || undefined}
                >
                  <option value="">Select your college</option>
                  {colleges.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronIcon className={styles.chevron} />
              </div>
            </div>
          </div>
        )}

        {error && (
          <AuthNotice tone="error" title="Couldn’t save" refCode={error.ref}>
            {error.message}
          </AuthNotice>
        )}

        <button
          type="submit"
          className={`${shell.primary} ${styles.submit}`}
          disabled={busy}
          aria-busy={busy}
          data-busy={busy || undefined}
        >
          {busy ? (
            <>
              <Spinner />
              Saving…
            </>
          ) : (
            <>
              Continue
              <ArrowIcon className={shell.buttonIcon} />
            </>
          )}
        </button>
      </form>

      <p className={styles.privacy}>
        <LockIcon className={styles.privacyIcon} />
        <span>Your email stays private and never appears on the leaderboard.</span>
      </p>
    </AuthShell>
  );
}

type IconProps = { className?: string };

function PersonIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 21c.6-4.2 3.8-6.8 8-6.8s7.4 2.6 8 6.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function BuildingIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 21V5.5L12 3l7 2.5V21" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M3 21h18M10 21v-4h4v4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path
        d="M8.5 8h1M11.5 8h1M14.5 8h1M8.5 11h1M11.5 11h1M14.5 11h1M8.5 14h1M14.5 14h1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

function LockIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="11" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" />
      <path d="M12 15v2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
