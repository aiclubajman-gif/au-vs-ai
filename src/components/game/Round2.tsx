'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { getClassifier, type Prediction } from '@/lib/ml/classifier';
import type { Round2Assignment } from '@/types';

/**
 * Round 2 — Draw vs AI.
 *
 * §14: NO live confidence while drawing. The student draws blind, submits, and
 * only then does the AI analyse. Live bars would let someone nudge their sketch
 * toward whatever the model was guessing, which is both unfair and less fun.
 *
 * Strokes are kept as point arrays rather than pixels so undo is exact and the
 * 28x28 export can be re-rasterised cleanly at any size.
 */

type Stroke = { x: number; y: number }[];
type Phase = 'drawing' | 'analysing' | 'revealed';

const CANVAS_SIZE = 320;
const STROKE_WIDTH = 12;

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
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [phase, setPhase] = useState<Phase>('drawing');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [remaining, setRemaining] = useState(drawMs);
  const drawing = useRef(false);
  const startedAt = useRef(Date.now());
  const submitted = useRef(false);

  // ---- rendering -------------------------------------------------------
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = STROKE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of strokes) {
      if (stroke.length < 2) {
        if (stroke.length === 1) {
          ctx.beginPath();
          ctx.arc(stroke[0].x, stroke[0].y, STROKE_WIDTH / 2, 0, Math.PI * 2);
          ctx.fillStyle = '#f8fafc';
          ctx.fill();
        }
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
      ctx.stroke();
    }
  }, [strokes]);

  useEffect(redraw, [redraw]);

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

  const submit = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    setPhase('analysing');

    const drawTimeMs = Date.now() - startedAt.current;
    const bitmap = toBitmap28();

    let preds: Prediction[] = [];
    try {
      preds = await getClassifier().predict(bitmap);
    } catch {
      preds = [];
    }

    const target = preds.find((p) => p.label === assignment.classKey);
    const bytes = new Uint8Array(bitmap.map((v) => Math.round(v * 255)));
    const b64 = btoa(String.fromCharCode(...bytes));

    // Minimum suspense so the reveal reads as a moment, not a flicker.
    await new Promise((r) => setTimeout(r, 900));

    setPredictions(preds.slice(0, 3));
    setPhase('revealed');

    await fetch('/api/round2/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attemptId,
        targetConfidence: target?.confidence ?? 0,
        topPredictions: preds.slice(0, 3),
        drawTimeMs,
        bitmap28: b64,
        idempotencyKey: crypto.randomUUID(),
      }),
    }).catch(() => {});

    setTimeout(onComplete, 2600);
  }, [assignment.classKey, attemptId, onComplete, toBitmap28]);

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
      x: ((clientX - rect.left) / rect.width) * CANVAS_SIZE,
      y: ((clientY - rect.top) / rect.height) * CANVAS_SIZE,
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

  return (
    <main className="flex min-h-dvh flex-col px-5 py-6">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-muted)]">Draw vs AI</span>
          {phase === 'drawing' && (
            <span className="tabular font-bold text-[var(--color-cyan)]">{seconds}s</span>
          )}
        </div>

        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--color-edge)]">
          <div
            className="h-full bg-[var(--color-cyan)] transition-[width] duration-100 ease-linear"
            style={{ width: `${phase === 'drawing' ? progress * 100 : 0}%` }}
          />
        </div>

        <h1 className="mt-6 text-center text-3xl font-bold">
          Draw a <span className="text-[var(--color-cyan)]">{assignment.displayName}</span>
        </h1>

        <div className="relative mt-5 aspect-square w-full overflow-hidden rounded-2xl border border-[var(--color-edge)] bg-[var(--color-navy)]">
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            className="canvas-surface h-full w-full"
            aria-label={`Drawing canvas. Draw a ${assignment.displayName}.`}
          />

          {phase === 'analysing' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-void)]/90">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--color-edge)] border-t-[var(--color-cyan)]" />
              <p className="mt-4 text-sm text-[var(--color-muted)]">
                AI is analysing your drawing…
              </p>
            </div>
          )}

          {phase === 'revealed' && (
            <div className="absolute inset-0 flex flex-col justify-center gap-3 bg-[var(--color-void)]/93 px-6">
              {predictions.map((p) => {
                const isTarget = p.label === assignment.classKey;
                return (
                  <div key={p.label}>
                    <div className="flex justify-between text-sm">
                      <span
                        className={
                          isTarget
                            ? 'font-bold text-[var(--color-win)]'
                            : 'text-[var(--color-muted)]'
                        }
                      >
                        {p.label.toUpperCase()}
                        {isTarget && ' ✓'}
                      </span>
                      <span className="tabular text-sm">
                        {Math.round(p.confidence * 100)}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--color-edge)]">
                      <div
                        className="h-full rounded-full transition-[width] duration-700"
                        style={{
                          width: `${p.confidence * 100}%`,
                          background: isTarget
                            ? 'var(--color-win)'
                            : 'var(--color-cyan-dim)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {predictions.length === 0 && (
                <p className="text-center text-sm text-[var(--color-muted)]">
                  The AI couldn&apos;t read that one.
                </p>
              )}
            </div>
          )}
        </div>

        {phase === 'drawing' && (
          <div className="mt-5 grid grid-cols-3 gap-3">
            <button
              onClick={() => setStrokes((s) => s.slice(0, -1))}
              disabled={strokes.length === 0}
              className="min-h-[52px] rounded-xl border border-[var(--color-edge)] text-sm disabled:opacity-30"
            >
              Undo
            </button>
            <button
              onClick={() => setStrokes([])}
              disabled={strokes.length === 0}
              className="min-h-[52px] rounded-xl border border-[var(--color-edge)] text-sm disabled:opacity-30"
            >
              Clear
            </button>
            <button
              onClick={submit}
              disabled={strokes.length === 0}
              className="min-h-[52px] rounded-xl bg-[var(--color-cyan)] text-sm font-semibold text-[var(--color-void)] disabled:opacity-30"
            >
              Submit
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
