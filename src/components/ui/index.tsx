'use client';

import type { ReactNode } from 'react';

/**
 * Shared primitives for the game screens.
 *
 * Touch targets are 56px minimum, focus rings stay visible, and every button
 * disables itself while busy so a double-tap in a noisy hall cannot submit
 * twice (§36).
 */

export function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col px-6 py-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">{children}</div>
    </main>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <h1 className="text-3xl font-bold tracking-tight">{children}</h1>;
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">{children}</p>;
}

export function Button({
  children,
  onClick,
  disabled,
  busy,
  variant = 'primary',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: 'primary' | 'ghost';
  type?: 'button' | 'submit';
}) {
  const base =
    'w-full rounded-xl px-6 py-4 text-base font-semibold transition-colors min-h-[56px] disabled:opacity-40 disabled:cursor-not-allowed';
  const styles =
    variant === 'primary'
      ? 'bg-[var(--color-cyan)] text-[var(--color-void)] hover:bg-[var(--color-cyan-bright)]'
      : 'border border-[var(--color-edge)] text-[var(--color-ink)] hover:border-[var(--color-cyan-dim)]';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={`${base} ${styles}`}
      aria-busy={busy}
    >
      {busy ? 'Working…' : children}
    </button>
  );
}

/**
 * Errors get a reference code the student can read aloud to a volunteer, who
 * looks it up in /admin (§46). role="alert" so screen readers announce it.
 */
export function ErrorBanner({ message, refCode }: { message: string; refCode?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mt-5 rounded-lg border border-[var(--color-lose)]/40 bg-[var(--color-lose)]/10 px-4 py-3"
    >
      <p className="text-sm text-[var(--color-lose)]">{message}</p>
      {refCode && (
        <p className="mt-1 font-mono text-xs text-[var(--color-muted)]">{refCode}</p>
      )}
    </div>
  );
}

export function Spacer() {
  return <div className="flex-1" />;
}

/**
 * Shown when a submission could not be saved. A connection problem offers
 * "Try again", which resends the SAME submission. A refusal the server will
 * repeat (signed out, attempt reset) offers a reload instead, which resumes
 * from the server's own record of the game.
 */
export function RetryNotice({
  message,
  refCode,
  retryable,
  onRetry,
  busy,
}: {
  message: string;
  refCode?: string;
  retryable: boolean;
  onRetry: () => void;
  busy?: boolean;
}) {
  return (
    <div>
      <ErrorBanner message={message} refCode={refCode} />
      <div className="mt-3">
        <Button
          variant="ghost"
          busy={busy}
          onClick={retryable ? onRetry : () => window.location.reload()}
        >
          {retryable ? 'Try again' : 'Reload'}
        </Button>
      </div>
    </div>
  );
}
