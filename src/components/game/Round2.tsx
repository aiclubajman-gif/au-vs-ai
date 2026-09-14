'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { getClassifier, type Prediction } from '@/lib/ml/classifier';
import type { Round2Assignment } from '@/types';
import { ArenaFrame } from './ArenaFrame';

/**
 * Round 2 — Draw vs AI.
 *
 * 16-Bit Retro Arcade Redesign:
 * - ArenaFrame stadium frame with meadow & circuit flanks.
 * - Peeking Robot mascot (`/sprites/robot-peek.png`) watching the student draw.
 * - Tactile 3D retro arcade buttons for "UNDO", "CLEAR", and "SUBMIT".
 * - Retro radar scanner animation during "AI ANALYSING SKETCH...".
 * - Neon confidence bars with target match checkmark during the reveal.
 * - NO live confidence bars while drawing (§14).
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

    // Suspense pause so the reveal moment feels earned
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
    <ArenaFrame
      leftMascot="/sprites/char-boy-cheer.png"
      leftMascotAlt="Cheering Boy Avatar"
      rightMascot="/sprites/robot-peek.png"
      rightMascotAlt="Peeking Robot AI"
    >
      {/* Top Header & Telemetry */}
      <div>
        {/* Status Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Mobile Mascot Avatar */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sprites/char-boy-cheer.png"
              alt="Avatar"
              className="pixelated h-8 w-auto lg:hidden"
            />
            <span className="font-pixel text-[10px] tracking-wider text-slate-400">
              ROUND 2 · DRAW
            </span>
          </div>

          <div className="flex items-center gap-2">
            {phase === 'drawing' && (
              <span className="pixel-timer tabular text-xs font-bold">
                {seconds.toString().padStart(2, '0')}s
              </span>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sprites/robot-peek.png"
              alt="Robot"
              className="pixelated h-8 w-auto lg:hidden"
            />
          </div>
        </div>

        {/* Progress Bar */}
        <div
          className="mt-2.5 h-2 w-full overflow-hidden rounded-full border border-slate-700/60 bg-slate-900/80 p-0.5"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 via-sky-400 to-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.7)] transition-[width] duration-100 ease-linear"
            style={{ width: `${phase === 'drawing' ? progress * 100 : 0}%` }}
          />
        </div>

        {/* Prompt Banner */}
        <div className="mt-4 text-center">
          <span className="inline-block rounded-md border border-cyan-500/40 bg-cyan-950/40 px-3 py-1 font-silkscreen text-[10px] uppercase tracking-widest text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.2)]">
            QUICKDRAW CHALLENGE
          </span>
          <h1 className="mt-2 font-pixel text-base sm:text-xl font-bold uppercase tracking-wider text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
            Draw a <span className="text-cyan-400 underline decoration-cyan-500/50 underline-offset-4">{assignment.displayName}</span>
          </h1>
        </div>

        {/* Canvas Surface with Peeking Robot Accent */}
        <div className="relative mt-3.5 sm:mt-4">
          {/* Peeking Robot Accent Badge */}
          <div className="absolute -right-3 -top-10 z-20 hidden sm:block animate-float">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sprites/robot-peek.png"
              alt="Peeking Robot"
              className="pixelated h-16 w-auto drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
            />
          </div>

          <div className="pixel-box relative aspect-square w-full overflow-hidden p-1.5">
            <div className="relative h-full w-full overflow-hidden rounded-lg bg-[#050b1d]">
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

              {/* Analysing Radar State */}
              {phase === 'analysing' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#02050e]/92 backdrop-blur-sm animate-fade-in">
                  <div className="relative flex items-center justify-center">
                    <div className="h-14 w-14 animate-ping rounded-full border border-cyan-400 opacity-60" />
                    <div className="absolute h-10 w-10 animate-spin rounded-full border-2 border-cyan-500/20 border-t-cyan-400" />
                  </div>
                  <p className="mt-4 font-pixel text-xs tracking-wider uppercase text-cyan-300 drop-shadow-[0_0_12px_rgba(0,240,255,0.8)]">
                    AI IS SCANNING SKETCH...
                  </p>
                  <p className="mt-1 font-display text-xs text-slate-400">
                    Extracting neural weights
                  </p>
                </div>
              )}

              {/* Revealed State with Top Predictions */}
              {phase === 'revealed' && (
                <div className="absolute inset-0 flex flex-col justify-center gap-3 bg-[#02050e]/95 px-6 animate-fade-in">
                  <p className="text-center font-pixel text-[10px] uppercase tracking-widest text-slate-400">
                    AI PREDICTION RESULTS
                  </p>
                  {predictions.map((p) => {
                    const isTarget = p.label === assignment.classKey;
                    return (
                      <div
                        key={p.label}
                        className={`rounded-lg border p-2.5 transition-all ${
                          isTarget
                            ? 'border-emerald-500/60 bg-emerald-950/40 shadow-[0_0_16px_rgba(16,185,129,0.3)]'
                            : 'border-slate-800 bg-slate-900/50'
                        }`}
                      >
                        <div className="flex justify-between font-silkscreen text-xs font-bold">
                          <span
                            className={
                              isTarget
                                ? 'font-bold uppercase tracking-wider text-emerald-300'
                                : 'text-slate-400'
                            }
                          >
                            {p.label.toUpperCase()}
                            {isTarget && ' ✓ TARGET MATCH'}
                          </span>
                          <span className="tabular font-pixel text-xs font-bold text-white">
                            {Math.round(p.confidence * 100)}%
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full transition-[width] duration-700 ease-out"
                            style={{
                              width: `${p.confidence * 100}%`,
                              background: isTarget
                                ? 'linear-gradient(90deg, #10b981, #34d399)'
                                : 'linear-gradient(90deg, #0284c7, #38bdf8)',
                              boxShadow: isTarget
                                ? '0 0 10px rgba(16,185,129,0.8)'
                                : '0 0 10px rgba(56,189,248,0.5)',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {predictions.length === 0 && (
                    <p className="text-center font-display text-sm text-slate-400">
                      The AI couldn&apos;t identify this drawing in time.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons (Tactile 3D Retro Arcade) */}
      <div className="mt-4 sm:mt-6">
        {phase === 'drawing' ? (
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
            <button
              onClick={() => setStrokes((s) => s.slice(0, -1))}
              disabled={strokes.length === 0}
              className="pixel-btn pixel-btn-dark min-h-[56px] text-xs"
            >
              UNDO
            </button>
            <button
              onClick={() => setStrokes([])}
              disabled={strokes.length === 0}
              className="pixel-btn pixel-btn-dark min-h-[56px] text-xs"
            >
              CLEAR
            </button>
            <button
              onClick={submit}
              disabled={strokes.length === 0}
              className="pixel-btn pixel-btn-cyan min-h-[56px] text-xs"
            >
              SUBMIT
            </button>
          </div>
        ) : (
          <div className="flex min-h-[56px] items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-950/30">
            <span className="font-pixel text-xs tracking-wider uppercase text-cyan-300">
              {phase === 'analysing' ? 'CLASSIFYING...' : 'ROUND COMPLETE!'}
            </span>
          </div>
        )}
      </div>
    </ArenaFrame>
  );
}
