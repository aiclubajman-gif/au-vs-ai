'use client';

import { useRef, useEffect, type ClipboardEvent, type KeyboardEvent } from 'react';

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
  const submitted = useRef(false);

  const digits = value.padEnd(6, ' ').slice(0, 6).split('');

  useEffect(() => {
    if (value.length === 6 && !submitted.current) {
      submitted.current = true;
      onComplete(value);
    }
    if (value.length < 6) submitted.current = false;
  }, [value, onComplete]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  function handleInput(index: number, raw: string) {
    const typed = raw.replace(/\D/g, '');
    if (!typed) return;

    const chars = value.padEnd(6, ' ').split('');
    const incoming = typed.length > 1 && chars[index] === typed[0] ? typed.slice(1) : typed;
    let cursor = index;
    for (const d of incoming) {
      if (cursor > 5) break;
      chars[cursor] = d;
      cursor += 1;
    }
    onChange(chars.join('').replace(/\s+$/, ''));
    refs.current[Math.min(cursor, 5)]?.focus();
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
          aria-label={`Digit ${i + 1}`}
          className="tabular disabled:opacity-40"
        />
      ))}
    </div>
  );
}
