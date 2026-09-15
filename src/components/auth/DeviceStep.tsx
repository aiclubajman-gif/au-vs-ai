'use client';

import { useId } from 'react';
import { AuthShell, Spinner } from '@/components/auth/AuthShell';
import shell from './AuthShell.module.css';
import styles from './DeviceStep.module.css';

/**
 * Page 4 of sign-in: can this device run the drawing round?
 *
 * Every mark on this screen follows a real milestone in PlayFlow's device
 * check, in order: the classifier resolved, its hidden self-test passed, and
 * the server created (or resumed) the attempt. There is no percentage because
 * the model load reports none; the ring fills by completed stages.
 */
export type DeviceStage = 'model' | 'selftest' | 'start' | 'done';

const STAGES: { key: Exclude<DeviceStage, 'done'>; label: string }[] = [
  { key: 'model', label: 'Loading the drawing model' },
  { key: 'selftest', label: 'Testing this device' },
  { key: 'start', label: 'Starting your game' },
];

export function DeviceStep({
  state,
  stage,
  onRetry,
}: {
  state: 'checking' | 'ok' | 'failed';
  /** The stage in progress, or the one that failed. */
  stage: DeviceStage;
  onRetry: () => void;
}) {
  const ids = useId();
  const titleId = `${ids}-title`;
  const failed = state === 'failed';
  const done = stage === 'done';
  const completed = done ? STAGES.length : STAGES.findIndex((s) => s.key === stage);

  const deviceCheck = failed && stage !== 'start' ? 'failed' : completed >= 2 ? 'done' : 'current';
  const start = done ? 'done' : stage === 'start' ? (failed ? 'failed' : 'current') : 'upcoming';

  return (
    <AuthShell step="ready" labelledBy={titleId}>
      <ol className={styles.phases} aria-label="Before you play">
        <Phase n={1} label="Device check" state={deviceCheck} />
        <li className={styles.phaseLine} data-lit={completed >= 2 || undefined} aria-hidden="true" />
        <Phase n={2} label="Start" state={start} />
      </ol>

      {failed ? (
        <>
          <h1 id={titleId} className={`${shell.title} ${styles.title}`}>
            <span className={shell.human}>This phone can&rsquo;t run</span>{' '}
            <span className={shell.ai}>the drawing AI</span>
          </h1>
          <p className={shell.subtitle}>
            Round 2 needs features your browser doesn&rsquo;t support. Ask an AIDA team member
            for a booth tablet.
          </p>
        </>
      ) : (
        <>
          <h1 id={titleId} className={`${shell.title} ${styles.title}`}>
            {done ? (
              <>
                <span className={shell.human}>Drawing</span> <span className={shell.ai}>AI ready</span>
              </>
            ) : (
              <>
                <span className={shell.human}>Preparing</span>{' '}
                <span className={styles.titleLine}>
                  <span className={shell.human}>Drawing</span> <span className={shell.ai}>AI</span>
                </span>
              </>
            )}
          </h1>
          <p className={shell.subtitle}>
            {done
              ? 'All set. Here we go…'
              : 'Checking that your device can run the drawing round…'}
          </p>
          <ProgressRing completed={completed} total={STAGES.length} done={done} />
        </>
      )}

      <ul className={`${shell.frame} ${styles.stages}`}>
        {STAGES.map((s, i) => {
          const rowState =
            i < completed ? 'done' : i === completed ? (failed ? 'failed' : 'active') : 'pending';
          return (
            <li key={s.key} className={styles.stage} data-state={rowState}>
              <StageMark state={rowState} />
              <span>{s.label}</span>
              <span className="sr-only">
                {rowState === 'done'
                  ? ', done'
                  : rowState === 'active'
                    ? ', in progress'
                    : rowState === 'failed'
                      ? ', failed'
                      : ', waiting'}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="sr-only" aria-live="polite">
        {failed
          ? 'This device cannot run the drawing round. Your attempt has not been used.'
          : done
            ? 'Ready. Starting the game.'
            : STAGES[completed]?.label}
      </p>

      {failed ? (
        <>
          <p className={styles.safe}>
            <strong>Your attempt has not been used.</strong> You can still play on another device.
          </p>
          <button type="button" className={`${shell.secondary} ${styles.retry}`} onClick={onRetry}>
            Try again
          </button>
        </>
      ) : (
        <p className={styles.footnote}>
          <span>{done ? 'Starting now' : 'This only takes a few seconds'}</span>
        </p>
      )}
    </AuthShell>
  );
}

function Phase({
  n,
  label,
  state,
}: {
  n: number;
  label: string;
  state: 'done' | 'current' | 'upcoming' | 'failed';
}) {
  return (
    <li className={styles.phase} data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
      <span className={styles.phaseRing} aria-hidden="true">
        {state === 'done' ? <CheckGlyph /> : n}
      </span>
      <span className={styles.phaseLabel}>{label}</span>
    </li>
  );
}

function ProgressRing({ completed, total, done }: { completed: number; total: number; done: boolean }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const filled = (completed / total) * c;

  return (
    <div className={styles.ring} aria-hidden="true">
      <svg viewBox="0 0 100 100" className={styles.ringSvg}>
        <circle cx="50" cy="50" r={r} className={styles.ringTrack} />
        <circle
          cx="50"
          cy="50"
          r={r}
          className={styles.ringFill}
          strokeDasharray={`${filled} ${c}`}
          transform="rotate(-90 50 50)"
        />
        {!done && (
          <g className={styles.ringSweep}>
            <circle cx="50" cy="50" r={r} strokeDasharray={`${c * 0.12} ${c}`} />
          </g>
        )}
      </svg>
      <span className={styles.ringCenter}>
        {done ? (
          <CheckGlyph />
        ) : (
          <>
            <span className={styles.ringCount}>
              {completed}/{total}
            </span>
            <span className={styles.ringCaption}>steps</span>
          </>
        )}
      </span>
    </div>
  );
}

function StageMark({ state }: { state: 'done' | 'active' | 'failed' | 'pending' }) {
  if (state === 'active') {
    return (
      <span className={styles.mark}>
        <Spinner />
      </span>
    );
  }
  return (
    <svg className={styles.mark} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
      {state === 'done' && (
        <path
          d="m7.5 12.3 3 3 6-6.3"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {state === 'failed' && (
        <path d="m8.5 8.5 7 7m0-7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      )}
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="1em" height="1em">
      <path
        d="m5.5 12.5 4 4 9-9.5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
