'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { RetryNotice } from '@/components/ui';
import { submitWithRetry, isRetryable, describeSaveFailure, type SubmitFailure } from '@/lib/client/submit';
import { resolveClassifier, type Prediction } from '@/lib/ml/classifier';
import type { Round2Assignment } from '@/types';

interface Point {
  x: number;
  y: number;
}

interface FinishedDrawing {
  bitmap: Float32Array;
  drawTimeMs: number;
}

interface Round2SubmitBody {
  attemptId: string;
  targetConfidence: number;
  topPredictions: Prediction[];
  drawTimeMs: number;
  bitmap28: string;
  idempotencyKey: string;
}

type Phase = 'drawing' | 'analysing' | 'revealed' | 'analysisFailed';

const CANVAS_SIZE = 280;
const STROKE_WIDTH = 12;
const MAX_DRAW_MS = 60000;
const ANALYSE_MS = 1500;
const REVEAL_MS = 2400;

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
  const [phase, setPhase] = useState<Phase>('drawing');
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [remaining, setRemaining] = useState(drawMs);
  const [saving, setSaving] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [failure, setFailure] = useState<SubmitFailure | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const startedAt = useRef(0);
  const submitted = useRef(false);
  const inFlight = useRef(false);
  const submission = useRef<Round2SubmitBody | null>(null);
  const finished = useRef<FinishedDrawing | null>(null);
  const revealedAt = useRef(0);
  const analysing = useRef(false);
  const unmounted = useRef(false);

  useEffect(() => {
    startedAt.current = Date.now();
    unmounted.current = false;
    return () => {
      unmounted.current = true;
    };
  }, []);

  // Redraw strokes onto canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#070c26';
    ctx.lineWidth = STROKE_WIDTH;

    for (const stroke of strokes) {
      if (stroke.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    }
  }, [strokes]);

  // Convert drawn strokes to 28x28 normalized grayscale float array for ML
  const toBitmap28 = useCallback(() => {
    const out = new Float32Array(784);
    if (strokes.length === 0) return out;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const s of strokes) {
      for (const p of s) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
    }

    const pad = STROKE_WIDTH;
    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;

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
      if (!stroke.length) continue;
      tctx.beginPath();
      tctx.moveTo((stroke[0].x - originX) * scale, (stroke[0].y - originY) * scale);
      for (let i = 1; i < stroke.length; i++) {
        tctx.lineTo((stroke[i].x - originX) * scale, (stroke[i].y - originY) * scale);
      }
      tctx.stroke();
    }

    const pixels = tctx.getImageData(0, 0, 28, 28).data;
    for (let i = 0; i < 784; i++) {
      out[i] = pixels[i * 4] / 255;
    }
    return out;
  }, [strokes]);

  const save = useCallback(
    async (body: Round2SubmitBody) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSaving(true);
      setFailure(null);

      if (attemptId.startsWith('local-')) {
        inFlight.current = false;
        setSaving(false);
        const wait = Math.max(0, REVEAL_MS - (Date.now() - revealedAt.current));
        setTimeout(() => {
          if (!unmounted.current) onComplete();
        }, wait);
        return;
      }

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

      const wait = Math.max(0, REVEAL_MS - (Date.now() - revealedAt.current));
      setTimeout(() => {
        if (!unmounted.current) onComplete();
      }, wait);
    },
    [onComplete]
  );

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
      topPredictions: preds.slice(0, 5),
      drawTimeMs: input.drawTimeMs,
      bitmap28: btoa(String.fromCharCode(...bytes)),
      idempotencyKey: crypto.randomUUID(),
    };

    submission.current = body;
    revealedAt.current = Date.now();
    setPredictions(preds.slice(0, 5));
    setPhase('revealed');
    save(body);
  }, [assignment.classKey, attemptId, save]);

  const submit = useCallback(() => {
    if (submitted.current) return;
    submitted.current = true;
    finished.current = {
      bitmap: toBitmap28(),
      drawTimeMs: Math.min(Date.now() - startedAt.current, MAX_DRAW_MS),
    };
    analyse();
  }, [analyse, toBitmap28]);

  useEffect(() => {
    if (phase !== 'drawing') return;
    const tick = setInterval(() => {
      const left = drawMs - (Date.now() - startedAt.current);
      setRemaining(left);
      if (left <= 0) submit();
    }, 100);
    return () => clearInterval(tick);
  }, [phase, drawMs, submit]);

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
    const p = pointFrom(e.clientX, e.clientY);
    setStrokes((s) => [...s, [p]]);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || phase !== 'drawing') return;
    const p = pointFrom(e.clientX, e.clientY);
    setStrokes((s) => {
      if (!s.length) return s;
      const next = [...s];
      next[next.length - 1] = [...next[next.length - 1], p];
      return next;
    });
  }

  function end() {
    drawing.current = false;
  }

  const seconds = Math.max(0, Math.ceil(remaining/1000));
  const progress = Math.max(0, Math.min(1, remaining / drawMs));

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-[var(--color-px-bg)] text-[var(--color-ink)]">
      {/* Background with circuit glow */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center opacity-30 pointer-events-none"
        style={{ backgroundImage: "url('/backgrounds/circuit-9x16.png')" }}
        aria-hidden="true"
      />
      <div className="arena-bg z-0 opacity-70" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-4 py-5 sm:px-6">
        {/* Top Header & Timer */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <span className="px-chip text-[9px]">ROUND 2 · DRAW VS AI</span>
            {phase === 'drawing' && (
              <span
                className="tabular font-px text-xl text-[var(--color-px-yellow)]"
                style={{ textShadow: '3px 3px 0 #070c26' }}
              >
                {seconds}s
              </span>
            )}
          </div>

          <div
            className="px-timer mt-2.5"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((phase === 'drawing' ? progress : 0) * 100)}
          >
            <div
              className={`fill ${phase === 'drawing' && seconds <= 5 ? 'low' : ''}`}
              style={{ width: `${phase === 'drawing' ? progress * 100 : 0}%` }}
            />
          </div>

          <div className="mt-3 text-center">
            <h1 className="px-title-yellow text-2xl leading-tight">
              DRAW VS AI
            </h1>
            {/* Target Card */}
            <div className="px-panel mx-auto mt-2.5 inline-flex items-center gap-2 px-5 py-2.5 bg-[#0d1440]/90">
              <span className="font-px text-[9px] text-slate-400">DRAW A:</span>
              <span
                className="font-px text-base text-[var(--color-px-yellow)] tracking-wider"
                style={{ textShadow: '2px 2px 0 #070c26' }}
              >
                {assignment.displayName.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Center Drawing Canvas with Grid & Peeking Robot */}
        <div className="relative my-auto w-full">
          {/* Peeking robot sprite on right edge matching Proposed mock/mround2.png */}
          <div className="absolute -right-5 -top-10 z-20 pointer-events-none select-none">
            <img
              src="/sprites/robot-peeking.png"
              alt="AI watching"
              className="pixelated h-20 w-auto drop-shadow-[0_0_12px_rgba(53,224,255,0.7)]"
            />
          </div>

          <div className="px-frame mx-auto w-full">
            <div className="px-gridpaper relative aspect-square w-full overflow-hidden">
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                onPointerDown={start}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={end}
                className="canvas-surface h-full w-full cursor-crosshair"
                aria-label={`Drawing canvas. Draw a ${assignment.displayName}.`}
              />

              {/* Scanning Phase matching Site Pages/09 round 2 scan and result 2.png */}
              {phase === 'analysing' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070c26]/90 px-4 text-center">
                  <div className="relative w-full h-1 bg-[var(--color-px-cyan)] animate-pulse shadow-[0_0_12px_var(--color-px-cyan)] mb-4" />
                  <div className="px-spinner" />
                  <p className="mt-4 font-px text-xs text-[var(--color-px-cyan)] tracking-wider">
                    SCANNING...
                  </p>
                  <p className="mt-2 text-xs text-slate-300">
                    AI ANALYSING YOUR DRAWING...
                  </p>
                  <p className="mt-1 font-mono text-[9px] text-slate-400">
                    ANALYSING SHAPES... PATTERNS... OBJECTS...
                  </p>
                </div>
              )}

              {/* Revealed AI predictions matching mock */}
              {phase === 'revealed' && (
                <div className="absolute inset-0 flex flex-col justify-center gap-2.5 bg-[#070c26]/95 px-5 py-4 overflow-y-auto">
                  <p className="font-px text-[10px] text-[#ffd23e] tracking-wider text-center border-b border-[#2c4ba8]/60 pb-2">
                    AI THINKS:
                  </p>
                  {predictions.slice(0, 4).map((p) => {
                    const isTarget = p.label.toLowerCase() === assignment.classKey.toLowerCase();
                    const pct = Math.round(p.confidence * 100);
                    return (
                      <div key={p.label} className="w-full">
                        <div className="flex justify-between items-center text-xs">
                          <span
                            className={`font-px text-[9px] ${
                              isTarget ? 'text-[var(--color-win)]' : 'text-slate-300'
                            }`}
                          >
                            {p.label.toUpperCase()} {isTarget && '✓'}
                          </span>
                          <span className="tabular font-px text-[10px] text-slate-100">
                            {pct}%
                          </span>
                        </div>
                        <div className="mt-1 h-3 border-2 border-[var(--color-px-ink)] bg-[#0b1236]">
                          <div
                            className="h-full transition-[width] duration-700"
                            style={{
                              width: `${pct}%`,
                              background: isTarget
                                ? 'linear-gradient(180deg,#b0ff9e,var(--color-win))'
                                : 'linear-gradient(180deg,#8ff4ff,var(--color-px-cyan-deep))',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {reconnecting && (
                    <p className="text-center font-px text-[8px] text-slate-300 mt-2">
                      Saving… reconnecting
                    </p>
                  )}
                </div>
              )}

              {phase === 'analysisFailed' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070c26]/92 px-6 text-center">
                  <p className="font-px text-[11px] text-[var(--color-px-red)]">
                    The AI couldn&apos;t analyse your drawing.
                  </p>
                  <p className="mt-3 text-xs leading-relaxed text-slate-300">
                    Your drawing is preserved. Try submitting again.
                  </p>
                  <button
                    onClick={analyse}
                    className="px-btn px-btn-gray mt-4 px-4 py-2.5 text-[9px]"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bottom right cheering human boy matching Proposed mock/mround2.png */}
          <div className="mt-2 flex justify-end px-2 pointer-events-none select-none">
            <img
              src="/sprites/boy-cheer.png"
              alt="Cheering Human"
              className="pixelated h-14 w-auto drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
            />
          </div>
        </div>

        {/* Action Controls: Undo, Clear, SUBMIT */}
        <div className="w-full">
          {failure && (
            <div className="mb-3">
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

          {phase === 'drawing' && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setStrokes((s) => s.slice(0, -1))}
                disabled={strokes.length === 0}
                className="px-btn px-btn-gray min-h-[50px] py-2.5 text-[10px]"
              >
                ↩ UNDO
              </button>
              <button
                onClick={() => setStrokes([])}
                disabled={strokes.length === 0}
                className="px-btn px-btn-gray min-h-[50px] py-2.5 text-[10px]"
              >
                ▱ CLEAR
              </button>
              <button
                onClick={submit}
                disabled={strokes.length === 0}
                className="px-btn px-btn-yellow col-span-2 min-h-[60px] py-3.5 text-xs tracking-wider"
              >
                SUBMIT DRAWING →
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
