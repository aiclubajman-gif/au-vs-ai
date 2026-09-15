/**
 * Uniform API responses (§46).
 *
 * Every failure carries a short reference code the student can read aloud to a
 * booth volunteer, who looks it up in /admin. "It broke" becomes diagnosable.
 */
import { NextResponse } from 'next/server';
import type { ErrorCode } from '@/types';

export function refCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `ERR-${out}`;
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(code: ErrorCode | string, message: string, status = 400, ref?: string) {
  return NextResponse.json(
    { ok: false, error: { code, message, ref: ref ?? refCode() } },
    { status },
  );
}

/** Messages students actually see. Plain, non-apologetic, actionable (§46). */
export const MESSAGES: Record<string, string> = {
  CHALLENGE_CLOSED: 'The challenge is not open yet.',
  NEW_GAMES_PAUSED: 'New games are paused for a moment. Try again shortly.',
  PROFILE_REQUIRED: 'Enter your name before starting.',
  ALREADY_COMPLETED: 'Your official attempt is already complete.',
  ATTEMPT_NOT_FOUND: 'That game could not be found.',
  ATTEMPT_NOT_COMPLETED: 'That game is still in progress.',
  NO_DRAWING_CLASSES: 'The drawing round is not configured. Show this to an AIDA team member.',
  NO_ROUND3_QUESTION: 'The final round is not configured. Show this to an AIDA team member.',
  ROUND1_BANK_TOO_SMALL: 'The question bank is not ready. Show this to an AIDA team member.',
  ROUND1_BANK_UNBALANCED: 'The question bank is not ready. Show this to an AIDA team member.',
  SETTINGS_UNAVAILABLE:
    "The game settings couldn't be loaded. Your attempt has not been used — try again in a moment.",
  TIMING_UNAVAILABLE:
    'This game was set up before the current format and cannot be played. Show this to an AIDA team member.',
  ROUND1_FORMAT_LOCKED:
    'Round 1 format locked. Games have already been played under this format.',
  INVALID_DOMAIN: 'Use your Ajman University email address to play.',
  MODEL_UNAVAILABLE:
    "This device can't run the drawing challenge. Please use one of the AIDA booth tablets.",
  UNAUTHORIZED: 'You are not signed in.',
  RATE_LIMITED: 'Too many tries. Wait a moment and try again.',
  OTP_INVALID: 'That code is not right. Check and try again.',
  OTP_LOCKED: 'Too many wrong codes. Wait 15 minutes or ask an AIDA team member.',
  EMAIL_SEND_FAILED:
    "We couldn't send your code. Try again, or ask an AIDA team member for help.",
  SERVER_ERROR: 'Something went wrong. Show this screen to an AIDA team member.',
};

export function messageFor(code: string): string {
  return MESSAGES[code] ?? MESSAGES.SERVER_ERROR;
}

/** Maps a Postgres exception message onto our error codes. */
export function codeFromPgError(err: unknown): string {
  const raw =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message: unknown }).message)
      : '';
  const known = Object.keys(MESSAGES).find((c) => raw.includes(c));
  return known ?? 'SERVER_ERROR';
}
