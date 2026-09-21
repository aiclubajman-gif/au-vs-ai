'use client';

import { useState, useMemo, useEffect } from 'react';
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

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'completed' | 'in_progress' | 'disqualified' | 'invalidated'
  >('all');
  const [remoteResults, setRemoteResults] = useState<AttemptRow[] | null>(null);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setRemoteResults(null);
      setIsSearchingRemote(false);
      return;
    }

    setIsSearchingRemote(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/attempt?q=${encodeURIComponent(q)}`).then((r) =>
          r.json(),
        );
        if (res.ok && res.data?.attempts) {
          setRemoteResults(res.data.attempts);
        }
      } catch {
        // keep local results on network error
      } finally {
        setIsSearchingRemote(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const combinedAttempts = useMemo(() => {
    if (!remoteResults) return attempts;
    const existingIds = new Set(attempts.map((a) => a.id));
    const newItems = remoteResults.filter((r) => !existingIds.has(r.id));
    return [...newItems, ...attempts];
  }, [attempts, remoteResults]);

  const filteredAttempts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return combinedAttempts.filter((a) => {
      if (statusFilter === 'completed' && a.status !== 'completed') return false;
      if (statusFilter === 'in_progress' && a.status !== 'in_progress') return false;
      if (statusFilter === 'disqualified' && a.validForPrize) return false;
      if (statusFilter === 'invalidated' && a.status !== 'invalidated') return false;

      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.maskedId.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        (a.totalScore !== null && String(a.totalScore).includes(q)) ||
        a.status.toLowerCase().includes(q)
      );
    });
  }, [combinedAttempts, searchQuery, statusFilter]);

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
        : rows.map((r) => (r.id === id ? { ...r, status: 'invalidated', validForPrize: false } : r)),
    );
    setRemoteResults((rows) =>
      rows
        ? action === 'toggle_prize'
          ? rows.map((r) => (r.id === id ? { ...r, validForPrize: res.data.validForPrize } : r))
          : rows.map((r) => (r.id === id ? { ...r, status: 'invalidated', validForPrize: false } : r))
        : null,
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

        {/* ---- Content ---- */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold tracking-wider text-[var(--color-muted)]">
            CONTENT
          </h2>
          <a
            href="/admin/images"
            className="mt-3 flex items-center justify-between rounded-xl border border-[var(--color-edge)] bg-[var(--color-navy)] px-4 py-4 transition-colors hover:border-[var(--color-cyan-dim)]"
          >
            <span>
              <span className="block text-sm font-medium">Review images</span>
              <span className="mt-0.5 block text-xs text-[var(--color-muted)]">
                Judge the bank at phone size. Deactivate bad ones.
              </span>
            </span>
            <span className="text-[var(--color-cyan)]">→</span>
          </a>
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold tracking-wider text-[var(--color-muted)]">
                PLAYER ATTEMPTS
              </h2>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Search by student name, ID suffix, attempt ID, or score. Reset marks an attempt invalid and lets the student play again.
              </p>
            </div>
          </div>

          {/* Search Bar & Filter Controls */}
          <div className="mt-4 space-y-3">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--color-muted)]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by student name, ID (e.g. 4821), attempt ID, score..."
                className="w-full rounded-xl border border-[var(--color-edge)] bg-[var(--color-navy)] py-2.5 pl-9 pr-9 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)]/70 focus:border-[var(--color-cyan)] focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setRemoteResults(null);
                  }}
                  className="absolute inset-y-0 right-3 flex items-center text-xs text-[var(--color-muted)] hover:text-white"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Chips */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'completed', label: 'Completed' },
                  { id: 'in_progress', label: 'In Progress' },
                  { id: 'disqualified', label: 'Disqualified' },
                  { id: 'invalidated', label: 'Reset / Invalid' },
                ] as const
              ).map((chip) => {
                const isSelected = statusFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    onClick={() => setStatusFilter(chip.id)}
                    className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                      isSelected
                        ? 'bg-[var(--color-cyan)] text-[var(--color-void)]'
                        : 'border border-[var(--color-edge)] bg-[var(--color-navy)]/60 text-[var(--color-muted)] hover:border-[var(--color-muted)]'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {/* Results Count & Status */}
            <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
              <span>
                Showing {filteredAttempts.length} of {combinedAttempts.length} attempts
                {searchQuery && ` matching "${searchQuery}"`}
                {statusFilter !== 'all' && ` (${statusFilter})`}
              </span>
              {isSearchingRemote && (
                <span className="text-[var(--color-cyan)] animate-pulse">Searching database...</span>
              )}
            </div>
          </div>

          {/* Attempts List */}
          <div className="mt-3 space-y-2">
            {filteredAttempts.length === 0 && (
              <div className="rounded-xl border border-[var(--color-edge)] bg-[var(--color-navy)]/50 p-6 text-center text-sm text-[var(--color-muted)]">
                {searchQuery ? (
                  <p>No attempts found matching &ldquo;{searchQuery}&rdquo;.</p>
                ) : (
                  <p>No attempts match the selected filter.</p>
                )}
              </div>
            )}
            {filteredAttempts.map((a) => (
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
