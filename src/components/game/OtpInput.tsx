'use client';

import { useRef, useEffect, type ClipboardEvent, type KeyboardEvent } from 'react';

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
  groupClassName = 'mt-8 flex justify-between gap-2',
  inputClassName = 'tabular h-16 w-full rounded-xl border border-[var(--color-edge)] bg-[var(--color-navy)] text-center text-2xl font-bold text-[var(--color-ink)] transition-colors focus:border-[var(--color-cyan)] disabled:opacity-40',
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete: (code: string) => void;
  disabled?: boolean;
  /** Replace the default look; behaviour is unchanged. */
  groupClassName?: string;
  inputClassName?: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  // A ref, not state: nothing renders it, and as state it re-rendered the whole
  // input on submit for no visible reason (react-hooks/set-state-in-effect).
  const submitted = useRef(false);

  const digits = value.padEnd(6, ' ').slice(0, 6).split('');

  useEffect(() => {
    if (value.length === 6 && !submitted.current) {
      submitted.current = true;
      onComplete(value);
    }
    // Cleared after a rejected code, so the next six digits submit again.
    if (value.length < 6) submitted.current = false;
  }, [value, onComplete]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  // A rejected code is cleared while the boxes are disabled, which drops focus.
  // Put the cursor back in the first box so the student can simply retype.
  const wasDisabled = useRef(disabled);
  useEffect(() => {
    if (wasDisabled.current && !disabled && value === '') refs.current[0]?.focus();
    wasDisabled.current = disabled;
  }, [disabled, value]);

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
    <div className={groupClassName} role="group" aria-label="Verification code">
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
          // A single space keeps :placeholder-shown usable for styling empty
          // boxes without a screen reader announcing a placeholder glyph.
          placeholder=" "
          aria-label={`Digit ${i + 1}`}
          className={inputClassName}
        />
      ))}
    </div>
  );
}
