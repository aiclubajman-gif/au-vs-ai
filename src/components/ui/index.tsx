'use client';

import type { ReactNode } from 'react';
import { ArenaFrame } from '@/components/game/ArenaFrame';

/**
 * Shared primitives for the game screens — 16-bit retro arcade edition.
 *
 * Touch targets are 56px minimum, focus rings stay visible, and every button
 * disables itself while busy so a double-tap in a noisy hall cannot submit
 * twice (§36).
 */

export function Screen({ children }: { children: ReactNode }) {
  return (
    <ArenaFrame>
      <div className="flex flex-1 flex-col justify-center">{children}</div>
    </ArenaFrame>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return (
    <h1 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
      {children}
    </h1>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 font-display text-sm leading-relaxed text-slate-300">
      {children}
    </p>
  );
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
  const isPrimary = variant === 'primary';
  const styles = isPrimary ? 'pixel-btn-amber text-sm' : 'pixel-btn-dark text-xs';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={`pixel-btn min-h-[58px] w-full ${styles}`}
      aria-busy={busy}
    >
      {busy ? (
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-200 animate-ping" />
          WORKING...
        </span>
      ) : (
        children
      )}
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
      className="mt-5 rounded-xl border-2 border-rose-500/60 bg-rose-950/40 p-4 shadow-[0_0_16px_rgba(244,63,94,0.3)]"
    >
      <p className="font-display text-sm font-semibold text-rose-300">{message}</p>
      {refCode && (
        <p className="mt-1 font-pixel text-[9px] text-rose-400 opacity-80">{refCode}</p>
      )}
    </div>
  );
}

export function Spacer() {
  return <div className="flex-1" />;
}
