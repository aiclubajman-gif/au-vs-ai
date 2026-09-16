'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import NextImage from 'next/image';
import { RetryNotice } from '@/components/ui';
import { resolveClassifier, type Prediction } from '@/lib/ml/classifier';
import {
  submitWithRetry,
  isRetryable,
  describeSaveFailure,
  type SubmitFailure,
} from '@/lib/client/submit';
import { REVEAL_WINDOW_MS, revealTimeRemaining } from '@/lib/client/reveal-window';
import type { Round2Assignment } from '@/types';
import styles from './Round2.module.css';

/**
 * Round 2 — Draw vs AI.
 *
 * §14: NO live confidence while drawing. The student draws blind, submits, and
 * only then does the AI analyse. Live bars would let someone nudge their sketch
 * toward whatever the model was guessing, which is both unfair and less fun.
 *
 * Strokes are kept as point arrays rather than pixels so undo is exact and the
 * 28x28 export can be re-rasterised cleanly at any size.
 *
 * Two plates: the drawing screen, then the analysis screen, which shows the
 * submitted strokes and the classifier's real top predictions. The plates paint
 * the frames and button bodies; everything that carries state is HTML.
 */

type Stroke = { x: number; y: number }[];
type Phase = 'drawing' | 'analysing' | 'analysisFailed' | 'revealed';

interface Round2SubmitBody {
  attemptId: string;
  targetConfidence: number;
  topPredictions: Prediction[];
  drawTimeMs: number;
  bitmap28: string;
  idempotencyKey: string;
}

export const ROUND2_DRAW_PLATE_SRC = '/design/round2/draw-plate.webp';
export const ROUND2_RESULTS_PLATE_SRC = '/design/round2/results-plate.webp';

/**
 * Stroke coordinate space. The height is the original square canvas's, so the
 * stroke width relative to a drawing, and with it the 28x28 export, is
 * unchanged; the width follows the plate's drawing opening (873u × 733u).
 */
const CANVAS_W = 381;
const CANVAS_H = 320;
/** Backing-store pixels per coordinate unit, so strokes stay sharp on phones. */
const RENDER_SCALE = 2;
const STROKE_WIDTH = 12;
/** Minimum suspense so the reveal reads as a moment, not a flicker. */
const ANALYSE_MS = 900;
/** Ceiling in round2SubmitSchema. A backgrounded tab can otherwise exceed it. */
const MAX_DRAW_MS = 120_000;
/** Prediction rows painted on the analysis plate. */
const RESULT_ROWS = 5;

export function Round2({
  attemptId,
  assignment,
  drawMs,
  onComplete,
}: {
  attemptId: string;
  assignment: Round2Assignment;
  drawMs: number;
  onComplete: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [phase, setPhase] = useState<Phase>('drawing');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [remaining, setRemaining] = useState(drawMs);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [failure, setFailure] = useState<SubmitFailure | null>(null);
  /** When the result was saved — the readout window runs from here. Null until then. */
  const [savedAtMs, setSavedAtMs] = useState<number | null>(null);
  const [autoSeconds, setAutoSeconds] = useState(0);
  const drawing = useRef(false);
  const startedAt = useRef(0);
  const submitted = useRef(false);
  /** The finished drawing, kept so a failed analysis can be retried as-is. */
  const finished = useRef<{ bitmap: Float32Array; drawTimeMs: number } | null>(null);
  /** The scored submission. Retries resend exactly this, same key included. */
  const submission = useRef<Round2SubmitBody | null>(null);
  const analysing = useRef(false);
  const inFlight = useRef(false);
  /** Continue and the reveal timeout share this, so the round ends once. */
  const completed = useRef(false);
  const unmounted = useRef(false);

  // The drawing clock starts when the canvas is first on screen.
  useEffect(() => {
    startedAt.current = Date.now();
    unmounted.current = false;
    return () => {
      unmounted.current = true;
    };
  }, []);

  // ---- rendering -------------------------------------------------------
  // The drawing canvas and the analysis preview share one coordinate space and
  // differ only in CSS size, so the preview is the submitted drawing exactly.
  useEffect(() => {
    paintStrokes(canvasRef.current, strokes);
    paintStrokes(previewRef.current, strokes);
  }, [strokes, phase]);

  /**
   * Converts the drawing into the 28x28 the model expects.
   *
   * The pipeline must match QuickDraw's preprocessing exactly or a good model
   * returns nonsense: crop to the ink's bounding box, pad to a square, add a
   * small margin, then downscale. Skipping the crop is the single most common
   * reason these projects "fail" when the model is actually fine.
   */
  const toBitmap28 = useCallback((): Float32Array => {
    const out = new Float32Array(784);
    if (strokes.length === 0) return out;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of strokes) {
      for (const p of s) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
    }

    const pad = STROKE_WIDTH;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const side = Math.max(maxX - minX, maxY - minY, 1);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const originX = cx - side / 2;
    const originY = cy - side / 2;

    const tmp = document.createElement('canvas');
    tmp.width = 28;
    tmp.height = 28;
    const tctx = tmp.getContext('2d', { willReadFrequently: true });
    if (!tctx) return out;

    const scale = 28 / side;
    tctx.fillStyle = '#000';
    tctx.fillRect(0, 0, 28, 28);
    tctx.strokeStyle = '#fff';
    tctx.lineWidth = Math.max(1.5, STROKE_WIDTH * scale);
    tctx.lineCap = 'round';
    tctx.lineJoin = 'round';

    for (const stroke of strokes) {
      if (stroke.length === 0) continue;
      tctx.beginPath();
      tctx.moveTo((stroke[0].x - originX) * scale, (stroke[0].y - originY) * scale);
      for (let i = 1; i < stroke.length; i++) {
        tctx.lineTo((stroke[i].x - originX) * scale, (stroke[i].y - originY) * scale);
      }
      tctx.stroke();
    }

    const pixels = tctx.getImageData(0, 0, 28, 28).data;
    for (let i = 0; i < 784; i++) out[i] = pixels[i * 4] / 255;
    return out;
  }, [strokes]);

  const finish = useCallback(() => {
    if (completed.current || unmounted.current) return;
    completed.current = true;
    onComplete();
  }, [onComplete]);

  /** Sends the scored drawing and moves on only once the server has it. */
  const save = useCallback(
    async (body: Round2SubmitBody) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSaving(true);
      setFailure(null);

      const result = await submitWithRetry('/api/round2/submit', body, {
        isCancelled: () => unmounted.current,
        onRetry: () => setReconnecting(true),
      });

      inFlight.current = false;
      if (unmounted.current) return;
      setSaving(false);
      setReconnecting(false);

      if (!result.ok) {
        setFailure(result);
        return;
      }

      setSaved(true);
      // The readout window starts HERE — the moment the result is both on
      // screen and saved — never when the classifier returned. A first save
      // that failed and succeeded on retry would otherwise have spent it, and
      // the screen would close the instant Continue lit up.
      setSavedAtMs(Date.now());
      // finish() is guarded by completed.current, so this and the Continue
      // button together still advance the round exactly once.
      setTimeout(finish, REVEAL_WINDOW_MS);
    },
    [finish],
  );

  /**
   * Runs the model on the finished drawing, then reveals and saves.
   *
   * A classifier failure is shown as a retryable state. Submitting empty
   * predictions instead would quietly score the drawing as zero.
   */
  const analyse = useCallback(async () => {
    const input = finished.current;
    if (!input || analysing.current) return;
    analysing.current = true;
    setPhase('analysing');

    const minimum = new Promise((r) => setTimeout(r, ANALYSE_MS));
    let preds: Prediction[] = [];
    try {
      const classifier = await resolveClassifier();
      preds = await classifier.predict(input.bitmap);
    } catch {
      preds = [];
    }
    await minimum;

    analysing.current = false;
    if (unmounted.current) return;

    if (preds.length === 0) {
      setPhase('analysisFailed');
      return;
    }

    const target = preds.find((p) => p.label === assignment.classKey);
    const bytes = new Uint8Array(input.bitmap.map((v) => Math.round(v * 255)));

    const body: Round2SubmitBody = {
      attemptId,
      targetConfidence: target?.confidence ?? 0,
      topPredictions: preds.slice(0, 3),
      drawTimeMs: input.drawTimeMs,
      bitmap28: btoa(String.fromCharCode(...bytes)),
      idempotencyKey: crypto.randomUUID(),
    };
    submission.current = body;

    setPredictions(preds.slice(0, RESULT_ROWS));
    setPhase('revealed');
    save(body);
  }, [assignment.classKey, attemptId, save]);

  const submit = useCallback(() => {
    if (submitted.current) return;
    submitted.current = true;

    // The drawing is frozen here. The AI has not looked at it until now (§14).
    finished.current = {
      bitmap: toBitmap28(),
      drawTimeMs: Math.min(Date.now() - startedAt.current, MAX_DRAW_MS),
    };
    analyse();
  }, [analyse, toBitmap28]);

  // Display only: counts the reveal down so the wait is not a dead pause. The
  // advance itself is the timeout above, not this.
  useEffect(() => {
    if (savedAtMs === null) return;
    const tick = () =>
      setAutoSeconds(
        Math.ceil(revealTimeRemaining(savedAtMs, Date.now(), REVEAL_WINDOW_MS) / 1000),
      );
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [savedAtMs]);

  useEffect(() => {
    if (phase !== 'drawing') return;
    const tick = setInterval(() => {
      const left = drawMs - (Date.now() - startedAt.current);
      setRemaining(left);
      if (left <= 0) submit();
    }, 100);
    return () => clearInterval(tick);
  }, [phase, drawMs, submit]);

  // ---- pointer handling ------------------------------------------------
  /**
   * Reads coordinates from the canvas ref, NOT from e.currentTarget.
   *
   * React nulls `currentTarget` once event dispatch finishes. A functional
   * state updater runs after dispatch, so calling this inside
   * `setStrokes(s => ...)` threw "Cannot read properties of null". The ref is
   * stable for the component's lifetime, so it is safe whenever this is called.
   */
  function pointFrom(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((clientY - rect.top) / rect.height) * CANVAS_H,
    };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    if (phase !== 'drawing') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    // Resolved BEFORE the updater, while the event is still live.
    const p = pointFrom(e.clientX, e.clientY);
    setStrokes((s) => [...s, [p]]);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || phase !== 'drawing') return;
    const p = pointFrom(e.clientX, e.clientY);
    setStrokes((s) => {
      if (s.length === 0) return s;
      const next = [...s];
      next[next.length - 1] = [...next[next.length - 1], p];
      return next;
    });
  }

  function end() {
    drawing.current = false;
  }

  const seconds = Math.max(0, Math.ceil(remaining / 1000));
  const progress = Math.max(0, Math.min(1, remaining / drawMs));
  const isDrawing = phase === 'drawing';
  const plateSrc = isDrawing ? ROUND2_DRAW_PLATE_SRC : ROUND2_RESULTS_PLATE_SRC;
  const name = assignment.displayName;
  const article = /^[aeiou]/i.test(name) ? 'an' : 'a';

  return (
    <main className={styles.page}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={plateSrc} alt="" aria-hidden="true" className={styles.backdrop} />
      <div className={styles.stage}>
        <NextImage
          key={plateSrc}
          src={plateSrc}
          alt=""
          aria-hidden="true"
          width={941}
          height={1672}
          unoptimized
          loading="eager"
          fetchPriority="high"
          draggable={false}
          className={styles.plate}
        />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/design/fun-fact/au-vs-ai-logo.webp"
          alt="AU vs AI"
          width={840}
          height={294}
          className={styles.logo}
          draggable={false}
        />

        <p className={styles.round}>
          <span aria-hidden="true">Round 2 / 3</span>
          <span className="sr-only">Round 2 of 3</span>
        </p>

        {isDrawing ? (
          <>
            <div className={styles.timer} role="timer" aria-label={`${seconds} seconds left`}>
              {/* Redraws the plate's ring band with the real time left. */}
              <svg viewBox="0 0 200 200" className={styles.ring} aria-hidden="true">
                <circle cx="100" cy="100" r={RING_R} className={styles.track} />
                <circle
                  cx="100"
                  cy="100"
                  r={RING_R}
                  className={styles.arc}
                  data-empty={progress <= 0 || undefined}
                  strokeDasharray={RING_C}
                  strokeDashoffset={RING_C * (1 - progress)}
                  transform="rotate(-90 100 100)"
                />
              </svg>
              <span className={`${styles.seconds} tabular`} aria-hidden="true">
                {seconds}
                <span className={styles.unit}>s</span>
              </span>
            </div>

            <h1 className={styles.drawTitle}>
              <span className={styles.drawWord}>Draw</span>
              <span className={styles.vs}>vs</span>
              <span className={styles.aiWord}>AI</span>
            </h1>
            <p className={styles.instruction}>
              Draw the object below in {Math.round(drawMs / 1000)} seconds.
            </p>

            <p className={styles.prompt}>
              <span className={styles.promptLead}>Draw {article}:</span>
              <strong className={styles.promptName}>{name}</strong>
            </p>

            <canvas
              ref={canvasRef}
              width={CANVAS_W * RENDER_SCALE}
              height={CANVAS_H * RENDER_SCALE}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              className={`canvas-surface ${styles.canvas}`}
              aria-label={`Drawing canvas. Draw ${article} ${name}.`}
            />

            {/* The plate paints the three buttons; these are the real, transparent controls over them. */}
            <button
              type="button"
              onClick={() => setStrokes((s) => s.slice(0, -1))}
              disabled={strokes.length === 0}
              className={styles.tool}
              data-tool="undo"
            >
              <UndoIcon className={styles.toolIcon} />
              <span className={styles.toolLabel}>Undo</span>
            </button>
            <button
              type="button"
              onClick={() => setStrokes([])}
              disabled={strokes.length === 0}
              className={styles.tool}
              data-tool="clear"
            >
              <TrashIcon className={styles.toolIcon} />
              <span className={styles.toolLabel}>Clear</span>
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={strokes.length === 0}
              className={styles.submit}
            >
              <SendIcon className={styles.submitIcon} />
              <span className={styles.submitLabel}>Submit drawing</span>
              <ArrowIcon className={styles.submitArrow} />
            </button>
          </>
        ) : (
          <>
            {/* Decorative: the drawing clock stopped when the drawing was submitted. */}
            <p className={styles.frozen}>
              <span className={`${styles.frozenValue} tabular`} aria-hidden="true">
                {seconds}
              </span>
              <span className={styles.frozenUnit} aria-hidden="true">
                Seconds
              </span>
              <span className="sr-only">Submitted with {seconds} seconds left</span>
            </p>

            <h1 className={styles.analysisTitle}>
              <span className={styles.analysisLine}>AI analysing</span>
              <span className={styles.analysisLine}>
                Your <span className={styles.analysisAccent}>drawing…</span>
              </span>
            </h1>
            <p className={styles.tagline}>Turning creativity into possibilities</p>

            <div className={styles.scan} data-phase={phase}>
              <canvas
                ref={previewRef}
                width={CANVAS_W * RENDER_SCALE}
                height={CANVAS_H * RENDER_SCALE}
                className={styles.preview}
                role="img"
                aria-label="Your submitted drawing"
              />
              {phase === 'analysing' && <span className={styles.sweep} aria-hidden="true" />}
              <p className={styles.scanStatus} role="status">
                {phase === 'analysing'
                  ? 'Scanning…'
                  : phase === 'revealed'
                    ? 'Scan complete'
                    : 'Scan failed'}
              </p>
            </div>

            <p className={styles.thinks}>AI thinks:</p>

            <ol className={styles.rows} aria-label="AI predictions">
              {Array.from({ length: RESULT_ROWS }, (_, i) => {
                const p = phase === 'revealed' ? predictions[i] : undefined;
                const isTarget = p?.label === assignment.classKey;
                const percent = p ? Math.round(p.confidence * 100) : null;
                return (
                  <li
                    key={i}
                    className={styles.row}
                    style={{ '--row': i } as React.CSSProperties}
                    data-target={isTarget || undefined}
                    aria-hidden={!p || undefined}
                  >
                    <span className={`${styles.rank} tabular`} aria-hidden="true">
                      {p ? (isTarget ? '✓' : i + 1) : ''}
                    </span>
                    {p && (
                      <span
                        className={styles.label}
                        style={{ '--len': p.label.length } as React.CSSProperties}
                      >
                        {capitalise(p.label)}
                        {isTarget && <span className="sr-only"> (your drawing prompt)</span>}
                      </span>
                    )}
                    {/* Hides the plate's example fill; the live bar is drawn over it. */}
                    <span className={styles.barCover} aria-hidden="true" />
                    <span className={styles.bar} aria-hidden="true">
                      {p && percent ? (
                        <span
                          className={styles.barFill}
                          style={{ '--confidence': Math.min(1, p.confidence) } as React.CSSProperties}
                        />
                      ) : null}
                    </span>
                    {p && <span className={`${styles.percent} tabular`}>{percent}%</span>}
                  </li>
                );
              })}
            </ol>

            {phase === 'analysisFailed' && (
              <div className={styles.failed} role="alert">
                <p className={styles.failedTitle}>The AI couldn&apos;t analyse your drawing.</p>
                <p className={styles.failedText}>
                  Your drawing is still here. Try again, or show this screen to an AIDA team
                  member.
                </p>
                <button type="button" onClick={analyse} className={styles.failedButton}>
                  Try again
                </button>
              </div>
            )}

            {failure && (
              <div className={styles.notice}>
                <RetryNotice
                  message={describeSaveFailure(failure, 'drawing')}
                  refCode={failure.ref}
                  retryable={isRetryable(failure)}
                  busy={saving}
                  onRetry={() => {
                    if (submission.current) save(submission.current);
                  }}
                />
              </div>
            )}

            {/* The plate paints the button; this is the real, transparent control over it. */}
            <button type="button" onClick={finish} disabled={!saved} className={styles.continue}>
              <span className={styles.continueLabel}>
                {reconnecting ? 'Saving… reconnecting' : 'Continue'}
              </span>
              {!reconnecting && <ArrowIcon className={styles.continueArrow} />}
            </button>
            {savedAtMs !== null && (
              <p className={styles.auto}>
                Continues by itself in <span className="tabular">{autoSeconds}</span>s
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}

/** Draws strokes in the shared coordinate space, whatever the canvas's CSS size. */
function paintStrokes(canvas: HTMLCanvasElement | null, strokes: Stroke[]) {
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;

  ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.strokeStyle = '#f4fbff';
  ctx.lineWidth = STROKE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(40, 190, 255, 0.95)';
  ctx.shadowBlur = 6 * RENDER_SCALE;

  // One path, one stroke: the glow is drawn once, however many strokes there are.
  ctx.beginPath();
  for (const stroke of strokes) {
    if (stroke.length === 0) continue;
    ctx.moveTo(stroke[0].x, stroke[0].y);
    // A single tap is a dot: a zero-length segment still gets round caps.
    if (stroke.length === 1) ctx.lineTo(stroke[0].x + 0.01, stroke[0].y);
    for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
  }
  ctx.stroke();
}

function capitalise(label: string) {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Radius of the ring band painted on the plate, in the timer's 200-unit box. */
const RING_R = 72.5;
const RING_C = 2 * Math.PI * RING_R;

function UndoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M17 9 7 19l10 10M8 19h20a13 13 0 0 1 0 26h-6"
        stroke="currentColor"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 52" fill="none" aria-hidden="true">
      <path
        d="M4 11h40M17 11V5h14v6M9 11l2.5 36h25L39 11M19.5 20v19M28.5 20v19"
        stroke="currentColor"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <path
        d="M48 4 4 22l18 7 7 19L48 4ZM48 4 22 29"
        stroke="currentColor"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 32" fill="none" aria-hidden="true">
      <path
        d="M3 16h40M30 3l13 13-13 13"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
