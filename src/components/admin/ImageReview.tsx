'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * Image review — built to be used on a phone.
 *
 * The point is to judge images at the size students actually see them, one at a
 * time, without burning your own official attempt. The label is hidden until
 * you commit to a guess, because knowing the answer makes it impossible to
 * judge whether an image is too easy.
 *
 * It also tracks how you score. Somewhere around 60-75% means the round works.
 * At 95% it is too easy to be interesting; at 50% the leaderboard is measuring
 * luck rather than skill.
 */

export interface ReviewImage {
  id: string;
  storagePath: string;
  label: 'real' | 'ai_generated';
  active: boolean;
  explanation: string | null;
  timesShown: number;
  timesCorrect: number;
}

export function ImageReview({
  images,
  includeInactive = false,
}: {
  images: ReviewImage[];
  includeInactive?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState<'real' | 'ai_generated' | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [items, setItems] = useState(images);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const current = items[index];

  if (!current) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">No images</h1>
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            Load the bank with <code className="font-mono">npm run load:images</code>.
          </p>
          <Link href="/admin" className="mt-6 block text-sm text-[var(--color-cyan)]">
            Back to admin
          </Link>
        </div>
      </main>
    );
  }

  const revealed = guess !== null;
  const wasRight = guess === current.label;
  const accuracy = score.total > 0 ? Math.round((score.right / score.total) * 100) : null;

  function submitGuess(g: 'real' | 'ai_generated') {
    if (revealed) return;
    setGuess(g);
    setScore((s) => ({
      right: s.right + (g === current.label ? 1 : 0),
      total: s.total + 1,
    }));
  }

  function next() {
    setGuess(null);
    setNote(null);
    setIndex((i) => Math.min(i + 1, items.length - 1));
  }

  async function toggleActive() {
    setBusy(true);
    const res = await fetch('/api/admin/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageId: current.id, action: 'toggle_active' }),
    }).then((r) => r.json());
    setBusy(false);

    if (!res.ok) {
      setNote(res.error?.message ?? 'Failed');
      return;
    }
    if (!res.data.active && !includeInactive) {
      // Remove it from this sitting entirely. Leaving a deactivated image in
      // the queue invites judging something students will never see.
      setItems((list) => list.filter((it) => it.id !== current.id));
      setGuess(null);
      setIndex((i) => Math.min(i, Math.max(0, items.length - 2)));
      return;
    }

    setItems((list) =>
      list.map((it) => (it.id === current.id ? { ...it, active: res.data.active } : it)),
    );
  }

  // Real students' accuracy on this image, once enough have seen it.
  const studentRate =
    current.timesShown >= 5
      ? Math.round((current.timesCorrect / current.timesShown) * 100)
      : null;

  return (
    <main className="min-h-dvh px-4 py-5">
      <div className="mx-auto w-full max-w-md">
        <header className="flex items-center justify-between">
          <Link href="/admin" className="text-sm text-[var(--color-cyan)]">
            ← Admin
          </Link>
          <span className="tabular text-xs text-[var(--color-muted)]">
            {index + 1} / {items.length}
          </span>
        </header>

        {/*
          The composition of this sample, stated up front. A sample that is all
          one label means the query is biased, not that the bank is broken —
          which is exactly the confusion this caused once already.
        */}
        <p className="mt-2 text-center text-xs text-[var(--color-muted)]">
          This sample: {items.filter((i) => i.label === 'real').length} real ·{' '}
          {items.filter((i) => i.label === 'ai_generated').length} AI
          {includeInactive && ' · including deactivated'}
        </p>

        <p className="mt-1 text-center text-xs">
          <a
            href={includeInactive ? '/admin/images' : '/admin/images?all=1'}
            className="text-[var(--color-cyan)] underline underline-offset-2"
          >
            {includeInactive ? 'Show only active' : 'Show deactivated too'}
          </a>
        </p>

        {accuracy !== null && (
          <div className="mt-3 rounded-lg border border-[var(--color-edge)] bg-[var(--color-navy)] px-4 py-2">
            <p className="text-xs text-[var(--color-muted)]">
              You: <span className="tabular font-bold text-[var(--color-ink)]">{accuracy}%</span>{' '}
              ({score.right}/{score.total})
              {score.total >= 10 && (
                <span className="ml-2">
                  {accuracy >= 90
                    ? '— too easy for a challenge'
                    : accuracy <= 55
                      ? '— close to guessing'
                      : '— good difficulty'}
                </span>
              )}
            </p>
          </div>
        )}

        <div
          className={`relative mt-4 aspect-square w-full overflow-hidden rounded-2xl border-2 bg-[var(--color-navy)] ${
            revealed
              ? wasRight
                ? 'border-[var(--color-win)]'
                : 'border-[var(--color-lose)]'
              : 'border-[var(--color-edge)]'
          }`}
        >
          <img
            src={current.storagePath}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
          {!current.active && (
            <div className="absolute left-3 top-3 rounded-md bg-[var(--color-void)]/90 px-2 py-1 text-xs font-bold text-[var(--color-lose)]">
              DEACTIVATED
            </div>
          )}
        </div>

        {!revealed ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => submitGuess('real')}
              className="min-h-[60px] rounded-xl border border-[var(--color-edge)] bg-[var(--color-surface)] font-semibold"
            >
              Real
            </button>
            <button
              onClick={() => submitGuess('ai_generated')}
              className="min-h-[60px] rounded-xl border border-[var(--color-edge)] bg-[var(--color-surface)] font-semibold"
            >
              AI generated
            </button>
          </div>
        ) : (
          <>
            <div className="mt-4 text-center">
              <p
                className={`text-lg font-bold ${
                  wasRight ? 'text-[var(--color-win)]' : 'text-[var(--color-lose)]'
                }`}
              >
                {wasRight ? 'You were right' : 'You were wrong'}
              </p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                This image is{' '}
                <strong className="text-[var(--color-ink)]">
                  {current.label === 'real' ? 'REAL' : 'AI GENERATED'}
                </strong>
              </p>
              {studentRate !== null && (
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  Students get this right {studentRate}% of the time ({current.timesShown}{' '}
                  shown)
                  {studentRate >= 95 && ' — too easy'}
                  {studentRate <= 30 && ' — nearly nobody gets it'}
                </p>
              )}
            </div>

            {note && (
              <p className="mt-3 rounded-lg border border-[var(--color-lose)]/40 bg-[var(--color-lose)]/10 px-4 py-2 text-sm text-[var(--color-lose)]">
                {note}
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={toggleActive}
                disabled={busy}
                className="min-h-[52px] rounded-xl border border-[var(--color-edge)] text-sm disabled:opacity-40"
              >
                {current.active ? 'Deactivate' : 'Reactivate'}
              </button>
              <button
                onClick={next}
                disabled={index >= items.length - 1}
                className="min-h-[52px] rounded-xl bg-[var(--color-cyan)] text-sm font-semibold text-[var(--color-void)] disabled:opacity-40"
              >
                Next image
              </button>
            </div>
          </>
        )}

        <p className="mt-6 text-center text-xs leading-relaxed text-[var(--color-muted)]">
          Guess before the answer shows — otherwise you can&apos;t tell whether an image is
          too easy. Deactivate anything broken, mislabelled, or obviously giveaway.
        </p>
      </div>
    </main>
  );
}
