import type { ReactNode } from 'react';
import Image from 'next/image';
import { AuthStepper, type AuthStepKey } from '@/components/auth/AuthStepper';
import styles from './AuthShell.module.css';

/**
 * Shared frame for the sign-in screens after Email: OTP, Profile and Ready.
 *
 * The plate is artwork only (mascot, AI character, wordmark, tagline, sky,
 * campus). The stepper, the glass card and everything inside it are HTML, laid
 * out in normal flow so a longer error or email address grows the card rather
 * than overflowing a painted frame.
 *
 * Sizes are in artwork pixels through `--u` (see the stylesheet), with pixel
 * floors wherever literal scaling would make text or targets too small.
 */
export const AUTH_PLATE_SRC = '/design/auth/auth-plate-941w.webp';

export function AuthShell({
  step,
  labelledBy,
  children,
}: {
  step: AuthStepKey;
  /** id of the card's heading. */
  labelledBy: string;
  children: ReactNode;
}) {
  return (
    <main className={styles.page}>
      <div className={styles.stage}>
        <Image
          src={AUTH_PLATE_SRC}
          alt=""
          aria-hidden="true"
          width={941}
          height={1672}
          unoptimized
          loading="eager"
          fetchPriority="high"
          draggable={false}
          className={styles.plate}
        />

        <div className={styles.content}>
          {/* The wordmark and tagline are painted into the plate. */}
          <p className="sr-only">AU vs AI. The 60 second challenge.</p>

          <div className={styles.stepper}>
            <AuthStepper current={step} />
          </div>

          <section className={styles.card} aria-labelledby={labelledBy}>
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}

/**
 * One inline message inside an auth card. `hint` is a fixable input problem,
 * `error` is a failed request and may carry a reference code for the team.
 */
export function AuthNotice({
  tone,
  title,
  children,
  refCode,
  id,
}: {
  tone: 'hint' | 'error' | 'ok';
  title?: string;
  children: ReactNode;
  refCode?: string;
  id?: string;
}) {
  return (
    <div id={id} className={styles.notice} data-tone={tone} role={tone === 'error' ? 'alert' : undefined}>
      <AlertIcon className={styles.noticeIcon} />
      <div>
        {title && <p className={styles.noticeTitle}>{title}</p>}
        <p className={styles.noticeBody}>{children}</p>
        {refCode && <p className={styles.noticeRef}>{refCode}</p>}
      </div>
    </div>
  );
}

export function Spinner() {
  return <span className={styles.spinner} aria-hidden="true" />;
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="16.8" r="1.3" fill="currentColor" />
    </svg>
  );
}
