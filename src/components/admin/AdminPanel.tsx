'use client';

import { useState } from 'react';
import { OverrideTool } from '@/components/admin/OverrideTool';

/**
 * Admin console (§41).
 *
 * Layout is deliberate: PAUSE NEW GAMES sits at the top, large and red. The
 * person reaching for it during the fair is stressed and may not be the person
 * who built this. Nothing important is behind a tab.
 */

export interface AdminStats {
  total: number;
  completed: number;
  inProgress: number;
  abandoned: number;
  humanWins: number;
  aiWins: number;
  averageScore: number;
  topScore: number;
  registrations: number;
  datasetResponses: number;
  imageBank: number;
  testImages: number;
}

export interface AdminSettings {
  challengeOpen: boolean;
  newGamesPaused: boolean;
  entriesClosed: boolean;
  humanWinThreshold: number;
  round1MsPerImage: number;
  round2DrawMs: number;
  round3Ms: number;
  round3ScoringTolerance: number;
  round3ToleranceExponent: number;
  round2RecognitionThreshold: number;
}

export interface AttemptRow {
  id: string;
  name: string;
  maskedId: string;
  status: string;
  totalScore: number | null;
  validForPrize: boolean;
  startedAt: string;
}

export function AdminPanel({
  email,
  initialStats,
  initialSettings,
  initialAttempts,
}: {
  email: string;
  initialStats: AdminStats;
  initialSettings: AdminSettings;
  initialAttempts: AttemptRow[];
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [attempts, setAttempts] = useState(initialAttempts);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function patch(change: Partial<AdminSettings>, label: string) {
    setBusy(label);
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(change),
    }).then((r) => r.json());
    setBusy(null);

    if (res.ok) {
      setSettings((s) => ({ ...s, ...change }));
      setNote(`${label} saved`);
      setTimeout(() => setNote(null), 2500);
    } else {
      setNote(res.error?.message ?? 'Failed');
    }
  }

  async function attemptAction(id: string, action: string) {
    if (action !== 'toggle_prize' && !confirm(`${action} this attempt?`)) return;

    setBusy(id);
    const res = await fetch('/api/admin/attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attemptId: id, action }),
    }).then((r) => r.json());
    setBusy(null);

    if (!res.ok) {
      setNote(res.error?.message ?? 'Failed');
      return;
    }

    setAttempts((rows) =>
      action === 'toggle_prize'
        ? rows.map((r) => (r.id === id ? { ...r, validForPrize: res.data.validForPrize } : r))
        : rows.map((r) => (r.id === id ? { ...r, status: 'invalidated' } : r)),
    );
    setNote(`${action} done`);
    setTimeout(() => setNote(null), 2500);
  }

  return (
    <main className="min-h-dvh px-5 py-6">
      <div className="mx-auto w-full max-w-3xl">
        <header className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold">Admin</h1>
          <span className="text-xs text-[var(--color-muted)]">{email}</span>
        </header>

        {note && (
          <p className="mt-3 rounded-lg border border-[var(--color-cyan-dim)] bg-[var(--color-navy)] px-4 py-2 text-sm text-[var(--color-cyan)]">
            {note}
          </p>
        )}

        {/* ---- Emergency control, deliberately first (§41) ---- */}
        <section className="mt-6">
          <button
            onClick={() =>
              patch({ newGamesPaused: !settings.newGamesPaused }, 'Pause state')
            }
            disabled={busy === 'Pause state'}
            className={`min-h-[72px] w-full rounded-xl text-lg font-bold transition-colors ${
              settings.newGamesPaused
                ? 'bg-[var(--color-win)] text-[var(--color-void)]'
                : 'bg-[var(--color-lose)] text-white'
            }`}
          >
            {settings.newGamesPaused ? 'RESUME NEW GAMES' : 'PAUSE NEW GAMES'}
          </button>
          <p className="mt-2 text-center text-xs text-[var(--color-muted)]">
            {settings.newGamesPaused
              ? 'New games are paused. Games already running can still finish.'
              : 'Stops new games starting. Running games finish normally.'}
          </p>
        </section>

        <OverrideTool />

        {/* ---- Event state ---- */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold tracking-wider text-[var(--color-muted)]">
            EVENT
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Toggle
              label="Challenge open"
              hint="Students can start playing"
              on={settings.challengeOpen}
              onClick={() => patch({ challengeOpen: !settings.challengeOpen }, 'Challenge')}
            />
            <Toggle
              label="Entries closed"
              hint="Unlocks Round 3 answer reveal"
              on={settings.entriesClosed}
              onClick={() => patch({ entriesClosed: !settings.entriesClosed }, 'Entries')}
            />
          </div>
        </section>

        {/* ---- Stats ---- */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold tracking-wider text-[var(--color-muted)]">
            LIVE
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Completed" value={initialStats.completed} />
            <Stat label="Playing now" value={initialStats.inProgress} />
            <Stat label="Humans" value={initialStats.humanWins} tone="win" />
            <Stat label="AI" value={initialStats.aiWins} tone="lose" />
            <Stat label="Average" value={initialStats.averageScore} />
            <Stat label="Top score" value={initialStats.topScore} />
            <Stat label="Registered" value={initialStats.registrations} />
            <Stat label="Image bank" value={initialStats.imageBank} />
          </div>

          {initialStats.testImages > 0 && (
            <p className="mt-3 rounded-lg border border-[var(--color-lose)] bg-[var(--color-lose)]/15 px-4 py-3 text-sm">
              <strong className="text-[var(--color-lose)]">
                {initialStats.testImages} placeholder images are live.
              </strong>
              <span className="mt-1 block text-xs text-[var(--color-muted)]">
                Real students would be shown them. Before the fair, run{' '}
                <code className="font-mono">npm run seed:clear</code> and load the real
                image bank.
              </span>
            </p>
          )}

          {initialStats.imageBank < 20 && (
            <p className="mt-3 rounded-lg border border-[var(--color-lose)]/40 bg-[var(--color-lose)]/10 px-4 py-3 text-sm text-[var(--color-lose)]">
              Only {initialStats.imageBank} images in the bank. With four shown per game,
              students standing together will often see the same ones. Aim for 40+.
            </p>
          )}
        </section>

        {/* ---- Scoring ---- */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold tracking-wider text-[var(--color-muted)]">
            SCORING
          </h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Freeze these before the fair opens. Changing the win threshold mid-event does
            not alter results already recorded.
          </p>

          <div className="mt-3 space-y-3">
            <NumberField
              label="Human win threshold"
              hint="Total score at or above this counts as a human win"
              value={settings.humanWinThreshold}
              min={0}
              max={1000}
              step={10}
              onCommit={(v) => patch({ humanWinThreshold: v }, 'Threshold')}
            />
            <NumberField
              label="Round 3 tolerance"
              hint="A guess this far from the answer scores zero"
              value={settings.round3ScoringTolerance}
              min={1}
              max={500}
              step={1}
              onCommit={(v) => patch({ round3ScoringTolerance: v }, 'R3 tolerance')}
            />
            <NumberField
              label="Seconds per image"
              hint="Round 1 time limit per image"
              value={Math.round(settings.round1MsPerImage / 1000)}
              min={3}
              max={30}
              step={1}
              onCommit={(v) => patch({ round1MsPerImage: v * 1000 }, 'R1 timer')}
            />
            <NumberField
              label="Drawing seconds"
              value={Math.round(settings.round2DrawMs / 1000)}
              min={10}
              max={60}
              step={1}
              onCommit={(v) => patch({ round2DrawMs: v * 1000 }, 'R2 timer')}
            />
            <NumberField
              label="Round 3 seconds"
              value={Math.round(settings.round3Ms / 1000)}
              min={5}
              max={30}
              step={1}
              onCommit={(v) => patch({ round3Ms: v * 1000 }, 'R3 timer')}
            />
          </div>
        </section>

        {/* ---- Attempts ---- */}
        <section className="mt-8 pb-12">
          <h2 className="text-sm font-semibold tracking-wider text-[var(--color-muted)]">
            RECENT ATTEMPTS
          </h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Reset marks an attempt invalid and lets the student play again. The original
            is kept for audit, not deleted.
          </p>

          <div className="mt-3 space-y-2">
            {attempts.length === 0 && (
              <p className="text-sm text-[var(--color-muted)]">No attempts yet.</p>
            )}
            {attempts.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-edge)] bg-[var(--color-navy)] px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {a.name} <span className="text-[var(--color-muted)]">••••{a.maskedId}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                    {a.status}
                    {a.totalScore !== null && ` · ${a.totalScore}`}
                    {!a.validForPrize && ' · not prize eligible'}
                  </p>
                </div>

                {a.status !== 'invalidated' && (
                  <>
                    <button
                      onClick={() => attemptAction(a.id, 'toggle_prize')}
                      disabled={busy === a.id}
                      className="rounded-lg border border-[var(--color-edge)] px-3 py-2 text-xs"
                    >
                      {a.validForPrize ? 'Disqualify' : 'Requalify'}
                    </button>
                    <button
                      onClick={() => attemptAction(a.id, 'reset')}
                      disabled={busy === a.id}
                      className="rounded-lg border border-[var(--color-lose)]/50 px-3 py-2 text-xs text-[var(--color-lose)]"
                    >
                      Reset
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Toggle({
  label,
  hint,
  on,
  onClick,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-xl border px-4 py-4 text-left transition-colors ${
        on
          ? 'border-[var(--color-cyan)] bg-[var(--color-navy)]'
          : 'border-[var(--color-edge)] bg-[var(--color-navy)]/50'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span
          className={`text-xs font-bold ${
            on ? 'text-[var(--color-cyan)]' : 'text-[var(--color-muted)]'
          }`}
        >
          {on ? 'ON' : 'OFF'}
        </span>
      </div>
      {hint && <p className="mt-1 text-xs text-[var(--color-muted)]">{hint}</p>}
    </button>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'win' | 'lose' }) {
  const color =
    tone === 'win'
      ? 'text-[var(--color-win)]'
      : tone === 'lose'
        ? 'text-[var(--color-lose)]'
        : '';
  return (
    <div className="rounded-xl border border-[var(--color-edge)] bg-[var(--color-navy)] px-4 py-3">
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className={`tabular mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  min,
  max,
  step,
  onCommit,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const dirty = Number(draft) !== value;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-edge)] bg-[var(--color-navy)] px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-[var(--color-muted)]">{hint}</p>}
      </div>
      <input
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step}
        onChange={(e) => setDraft(e.target.value)}
        aria-label={label}
        className="tabular w-24 rounded-lg border border-[var(--color-edge)] bg-[var(--color-surface)] px-3 py-2 text-right"
      />
      <button
        onClick={() => onCommit(Number(draft))}
        disabled={!dirty || Number.isNaN(Number(draft))}
        className="rounded-lg bg-[var(--color-cyan)] px-4 py-2 text-xs font-semibold text-[var(--color-void)] disabled:opacity-30"
      >
        Save
      </button>
    </div>
  );
}
