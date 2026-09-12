'use client';

import { useState } from 'react';

/**
 * Booth tool for the student whose code never arrived (§38).
 *
 * Designed to be used standing up, in a noisy hall, possibly by a volunteer who
 * did not build this. The ID-check box is unticked by default and the
 * consequence of leaving it unticked is stated in plain words, because the
 * person clicking is deciding whether someone can win a prize.
 */
export function OverrideTool() {
  const [email, setEmail] = useState('');
  const [idChecked, setIdChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{
    code: string;
    email: string;
    prizeEligible: boolean;
    expiresInMinutes: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const valid = /^[^@\s]+@ajmanuni\.ac\.ae$/.test(email.trim().toLowerCase());

  async function issue() {
    setBusy(true);
    setError(null);
    setIssued(null);

    const res = await fetch('/api/admin/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), idVerified: idChecked }),
    }).then((r) => r.json());

    setBusy(false);

    if (!res.ok) {
      setError(res.error?.message ?? 'Could not generate a code.');
      return;
    }
    setIssued(res.data);
  }

  function reset() {
    setIssued(null);
    setEmail('');
    setIdChecked(false);
    setError(null);
  }

  if (issued) {
    return (
      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wider text-[var(--color-muted)]">
          CODE ISSUED
        </h2>

        <div className="mt-3 rounded-xl border border-[var(--color-cyan)] bg-[var(--color-navy)] p-6 text-center">
          <p className="text-xs text-[var(--color-muted)]">Read this to the student</p>
          <p className="tabular mt-3 text-5xl font-bold tracking-[0.2em] text-[var(--color-cyan)]">
            {issued.code}
          </p>
          <p className="mt-4 text-sm">{issued.email}</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Expires in about {issued.expiresInMinutes} minutes. Works once.
          </p>

          <p
            className={`mt-4 text-sm font-semibold ${
              issued.prizeEligible ? 'text-[var(--color-win)]' : 'text-[var(--color-lose)]'
            }`}
          >
            {issued.prizeEligible
              ? 'Prize eligible — ID was checked'
              : 'NOT prize eligible — no ID check'}
          </p>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-[var(--color-muted)]">
          Tell the student to enter their AU email at the start screen as normal, then type
          this code instead of waiting for the email.
        </p>

        <button
          onClick={reset}
          className="mt-4 w-full rounded-xl border border-[var(--color-edge)] py-3 text-sm"
        >
          Issue another
        </button>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold tracking-wider text-[var(--color-muted)]">
        OVERRIDE CODE
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
        For a student whose verification email never arrived. Generates a real code without
        sending any email.
      </p>

      <div className="mt-3 space-y-3">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          inputMode="email"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="202312345@ajmanuni.ac.ae"
          aria-label="Student AU email"
          className="w-full rounded-xl border border-[var(--color-edge)] bg-[var(--color-navy)] px-4 py-4 placeholder:text-[var(--color-muted)]/60 focus:border-[var(--color-cyan)]"
        />

        {email.length > 3 && !valid && (
          <p className="text-xs text-[var(--color-muted)]">Must end in @ajmanuni.ac.ae</p>
        )}

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--color-edge)] bg-[var(--color-navy)] px-4 py-4">
          <input
            type="checkbox"
            checked={idChecked}
            onChange={(e) => setIdChecked(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-cyan)]"
          />
          <span className="text-sm">
            I checked this student&apos;s AU ID card
            <span className="mt-1 block text-xs text-[var(--color-muted)]">
              {idChecked
                ? 'They can win prizes.'
                : 'Leave unticked and they can play, but cannot win a prize. This cannot be undone from this screen.'}
            </span>
          </span>
        </label>

        {error && (
          <p className="rounded-lg border border-[var(--color-lose)]/40 bg-[var(--color-lose)]/10 px-4 py-3 text-sm text-[var(--color-lose)]">
            {error}
          </p>
        )}

        <button
          onClick={issue}
          disabled={!valid || busy}
          className="min-h-[56px] w-full rounded-xl bg-[var(--color-cyan)] font-semibold text-[var(--color-void)] disabled:opacity-30"
        >
          {busy ? 'Generating…' : 'Generate code'}
        </button>
      </div>
    </section>
  );
}
