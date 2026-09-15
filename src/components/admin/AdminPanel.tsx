'use client';

import { useState } from 'react';
import { OverrideTool } from '@/components/admin/OverrideTool';
import {
  ROUND1_PRESETS,
  ROUND1_PRESET_KEYS,
  round1PresetFor,
  type Round1Preset,
} from '@/lib/timing';

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
  /** Read-only here; changed only through a Round 1 preset. */
  round1ImageCount: number;
  round1MsPerImage: number;
  /** Fixed by the database for this event. Displayed, never edited. */
  round2DrawMs: number;
  round3Ms: number;
  round3ScoringTolerance: number;
  round3ToleranceExponent: number;
  round2RecognitionThreshold: number;
}

/** round1_bank_health(), judged against the current Round 1 preset. */
export interface BankHealth {
  active: number;
  real: number;
  ai: number;
  imagesPerGame: number | null;
  playable: boolean;
  /** Whether the bank could fill a game of each preset's size, keyed by count. */
  playableByImageCount: Record<string, boolean>;
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
  initialFormatLocked,
  bankHealth,
}: {
  email: string;
  initialStats: AdminStats;
  initialSettings: AdminSettings;
  initialAttempts: AttemptRow[];
  initialFormatLocked: boolean;
  bankHealth: BankHealth | null;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [attempts, setAttempts] = useState(initialAttempts);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [formatLocked, setFormatLocked] = useState(initialFormatLocked);

  const currentPreset = round1PresetFor(settings.round1ImageCount, settings.round1MsPerImage);
  const imagesPerGame = settings.round1ImageCount;
  const round1Seconds = (settings.round1ImageCount * settings.round1MsPerImage) / 1000;
  const round2Seconds = settings.round2DrawMs / 1000;
  const round3Seconds = settings.round3Ms / 1000;

  async function setRound1Preset(preset: Round1Preset) {
    if (preset === currentPreset || formatLocked) return;
    const { imageCount, msPerImage } = ROUND1_PRESETS[preset];
    if (!confirm(`Switch Round 1 to ${imageCount} images × ${msPerImage / 1000} seconds?`)) return;

    const label = 'Round 1 format';
    setBusy(label);
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ round1Preset: preset }),
    })
      .then((r) => r.json())
      .catch(() => null);
    setBusy(null);

    if (res?.ok) {
      setSettings((s) => ({ ...s, round1ImageCount: imageCount, round1MsPerImage: msPerImage }));
      setNote(`${label} saved`);
      setTimeout(() => setNote(null), 2500);
      return;
    }
    if (res?.error?.code === 'ROUND1_FORMAT_LOCKED') setFormatLocked(true);
    setNote(res?.error?.message ?? 'Failed');
  }

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

        {/* ---- Game format: always 60 seconds (§10, migration 0015) ---- */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold tracking-wider text-[var(--color-muted)]">
            GAME FORMAT
          </h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Every game is exactly 60 seconds. Only the way Round 1 fills its time can change,
            and only before any real game has been played.
          </p>

          <fieldset className="mt-3" disabled={formatLocked || busy === 'Round 1 format'}>
            <legend className="text-sm font-medium">Round 1 format</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {ROUND1_PRESET_KEYS.map((key) => {
                const { imageCount, msPerImage } = ROUND1_PRESETS[key];
                const selected = currentPreset === key;
                const bankCanFill = bankHealth?.playableByImageCount[String(imageCount)];
                return (
                  <label
                    key={key}
                    className={`flex items-start gap-3 rounded-xl border px-4 py-4 transition-colors ${
                      selected
                        ? 'border-[var(--color-cyan)] bg-[var(--color-navy)]'
                        : 'border-[var(--color-edge)] bg-[var(--color-navy)]/50'
                    } ${formatLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                  >
                    <input
                      type="radio"
                      name="round1-format"
                      value={key}
                      checked={selected}
                      onChange={() => setRound1Preset(key)}
                      className="mt-1 accent-[var(--color-cyan)]"
                    />
                    <span>
                      <span className="block text-sm font-medium">
                        {imageCount} images × {msPerImage / 1000} seconds
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--color-muted)]">
                        {(imageCount * msPerImage) / 1000} seconds total
                      </span>
                      {bankCanFill === false && (
                        <span className="mt-1 block text-xs text-[var(--color-lose)]">
                          The image bank cannot fill {imageCount} images yet
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {formatLocked && (
            <p className="mt-3 rounded-lg border border-[var(--color-edge)] bg-[var(--color-navy)] px-4 py-3 text-sm">
              <strong>Round 1 format locked</strong>
              <span className="mt-1 block text-xs text-[var(--color-muted)]">
                Games have already been played under this format. Changing image count would
                make leaderboard comparisons unfair.
              </span>
            </p>
          )}

          <div className="mt-3 grid grid-cols-3 gap-3">
            <FixedTime label="Round 2" seconds={round2Seconds} />
            <FixedTime label="Round 3" seconds={round3Seconds} />
            <FixedTime label="Total" seconds={round1Seconds + round2Seconds + round3Seconds} />
          </div>

          {bankHealth === null ? (
            <p className="mt-3 text-xs text-[var(--color-muted)]">Image bank health unavailable.</p>
          ) : bankHealth.playable ? (
            <p className="mt-3 text-xs text-[var(--color-muted)]">
              Image bank ready for {imagesPerGame} images per game ({bankHealth.real} real,{' '}
              {bankHealth.ai} AI active).
            </p>
          ) : (
            <p className="mt-3 rounded-lg border border-[var(--color-lose)] bg-[var(--color-lose)]/15 px-4 py-3 text-sm">
              <strong className="text-[var(--color-lose)]">
                Not playable with {imagesPerGame} images per game.
              </strong>
              <span className="mt-1 block text-xs text-[var(--color-muted)]">
                Needs at least {imagesPerGame} active images, with at least{' '}
                {Math.ceil(imagesPerGame / 4)} real and {Math.ceil(imagesPerGame / 4)} AI. Now:{' '}
                {bankHealth.real} real, {bankHealth.ai} AI. New games will be refused until this
                is fixed.
              </span>
            </p>
          )}
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

          {initialStats.imageBank < imagesPerGame * 5 && (
            <p className="mt-3 rounded-lg border border-[var(--color-lose)]/40 bg-[var(--color-lose)]/10 px-4 py-3 text-sm text-[var(--color-lose)]">
              Only {initialStats.imageBank} images in the bank. With {imagesPerGame} shown per
              game, students standing together will often see the same ones. Aim for{' '}
              {imagesPerGame * 10}+.
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

function FixedTime({ label, seconds }: { label: string; seconds: number }) {
  return (
    <div className="rounded-xl border border-[var(--color-edge)] bg-[var(--color-navy)]/50 px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-[var(--color-muted)]">{label}</p>
      <p className="mt-1 text-sm">
        <span className="tabular text-lg font-bold">{seconds}</span> seconds
      </p>
    </div>
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
