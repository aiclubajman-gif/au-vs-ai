'use client';

import { useRef, useState, useEffect, type ClipboardEvent, type KeyboardEvent } from 'react';

/**
 * Six-box verification code entry.
 *
 * Behaviours that matter at a crowded booth:
 *   - numeric keyboard on phones (inputMode + pattern)
 *   - autoComplete="one-time-code" so iOS offers the code from Messages/Mail
 *   - pasting the whole code fills every box, however the student pastes it
 *   - typing auto-advances; backspace on an empty box steps back
 *   - arrow keys work, because some students will use a laptop
 *   - submits itself once six digits are present, so there is no "now what"
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete: (code: string) => void;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const digits = value.padEnd(6, ' ').slice(0, 6).split('');

  useEffect(() => {
    if (value.length === 6 && !submitted) {
      setSubmitted(true);
      onComplete(value);
    }
    if (value.length < 6 && submitted) setSubmitted(false);
  }, [value, submitted, onComplete]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  function setDigit(index: number, digit: string) {
    const chars = value.padEnd(6, ' ').split('');
    chars[index] = digit;
    onChange(chars.join('').replace(/\s+$/, '').trimEnd());
  }

  function handleInput(index: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1);
    if (!digit) return;

    setDigit(index, digit);
    if (index < 5) refs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const chars = value.padEnd(6, ' ').split('');

      if (chars[index] && chars[index] !== ' ') {
        chars[index] = ' ';
        onChange(chars.join('').trimEnd());
      } else if (index > 0) {
        chars[index - 1] = ' ';
        onChange(chars.join('').trimEnd());
        refs.current[index - 1]?.focus();
      }
      return;
    }

    if (e.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) refs.current[index + 1]?.focus();
  }

  /** Accepts a pasted code from any box, and tolerates spaces or dashes. */
  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    onChange(pasted);
    const focusIndex = Math.min(pasted.length, 5);
    refs.current[focusIndex]?.focus();
  }

  return (
    <div className="px-otp" role="group" aria-label="Verification code">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={digit.trim()}
          onChange={(e) => handleInput(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          className="tabular disabled:opacity-40"
        />
      ))}
    </div>
  );
}
