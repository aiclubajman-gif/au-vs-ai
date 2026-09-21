'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatedSprite, PxButton, PxPanel, PxStar, PxTimer, RetryNotice, Scene, Wordmark } from '@/components/px';
import { submitWithRetry, isRetryable, describeSaveFailure, localSave, type SubmitFailure } from '@/lib/client/submit';
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

      const result = await (attemptId.startsWith('local-')
        ? localSave()
        : submitWithRetry('/api/round2/submit', body, {
            isCancelled: () => unmounted.current,
            onRetry: () => setReconnecting(true),
          }));

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
    [attemptId, onComplete]
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

  const seconds = Math.max(0, Math.ceil(remaining / 1000));
  const progress = Math.max(0, Math.min(1, remaining / drawMs));
  const drawingPhase = phase === 'drawing';

  return (
    <Scene left="/art/flanks/r2-left.webp" right="/art/flanks/r2-right.webp" leftWidth="30vw" rightWidth="30vw">
      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-4 pb-5 pt-4 sm:px-6 lg:max-w-[600px]">
        <div className="flex items-center justify-center gap-3">
          <TickMarks />
          <Wordmark name="draw-vs-ai" priority className="w-[68%] max-w-[380px]" />
          <TickMarks flip />
        </div>

        <PxPanel tone="gold" className="mt-3 py-2.5">
          <div className="flex items-center justify-center gap-4">
            <PxStar className="h-4 w-4" color="#7ffafe" />
            <h2 className="px-num-gold text-[24px] uppercase sm:text-[28px]">{assignment.displayName}</h2>
            <PxStar className="h-4 w-4" color="#7ffafe" />
          </div>
        </PxPanel>

        <div className="mt-3 flex items-center gap-3">
          <ClockIcon />
          <span className="px-num-gold tabular w-[3.2em] text-[20px]" aria-live="off">
            {seconds}s
          </span>
          <PxTimer progress={drawingPhase ? progress : 0} low={drawingPhase && seconds <= 5} className="flex-1" />
        </div>

        <div className="relative my-auto py-5 lg:py-4">
          <div className="px-frame px-frame--gold mx-auto w-full max-w-[420px] lg:max-w-[440px]">
            <div className="relative aspect-square w-full overflow-hidden px-gridpaper">
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                className="canvas-surface block h-full w-full cursor-crosshair"
                onPointerDown={start}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={end}
                onPointerLeave={end}
                role="img"
                aria-label={`Drawing canvas. Draw a ${assignment.displayName}.`}
              />

              {phase === 'analysing' && (
                <div className="absolute inset-0 overflow-hidden bg-[#010f38]/70">
                  <div className="px-scanline" aria-hidden="true" />
                  <div className="absolute inset-x-0 bottom-4 flex flex-col items-center">
                    <p className="font-px text-[11px] text-[#7ffafe] px-text-outline">AI ANALYSING…</p>
                    <p className="mt-2 font-px text-[7px] text-[#dff6ff]">SHAPES · PATTERNS · OBJECTS</p>
                  </div>
                </div>
              )}

              {phase === 'revealed' && (
                <div className="absolute inset-0 flex flex-col justify-center gap-2 overflow-y-auto bg-[#010f38]/95 px-4 py-4">
                  <p className="text-center font-px text-[10px] text-[#ffe66a] px-text-outline">AI THINKS:</p>
                  {predictions.slice(0, 5).map((p, i) => {
                    const isTarget = p.label.toLowerCase() === assignment.classKey.toLowerCase();
                    const pct = Math.round(p.confidence * 100);
                    return (
                      <div
                        key={p.label}
                        className={`px-rise flex items-center gap-2 px-2.5 py-1.5 ${isTarget ? 'bg-[#0b73bd]/50 shadow-[inset_0_0_0_2px_#7ffafe]' : 'bg-[#01285a] shadow-[inset_0_0_0_2px_#1e4ea8]'}`}
                        style={{ clipPath: 'var(--px-corner)', animationDelay: `${i * 90}ms` }}
                      >
                        <span className={`w-[38%] truncate font-px text-[8px] ${isTarget ? 'text-[#7dff6a]' : 'text-[#dff6ff]'}`}>
                          {p.label.toUpperCase()}
                        </span>
                        <div className="h-3 flex-1 bg-[#010f38] shadow-[inset_0_0_0_2px_#1e4ea8]">
                          <div
                            className="h-full transition-[width] duration-700"
                            style={{ width: `${pct}%`, background: isTarget ? 'linear-gradient(180deg,#b0ff9e,#7dff6a)' : 'linear-gradient(180deg,#8ae9ff,#02a6f9)' }}
                          />
                        </div>
                        <span className="tabular w-[3em] text-right font-px text-[9px] text-[#ffe66a]">{pct}%</span>
                      </div>
                    );
                  })}
                  {reconnecting && <p className="mt-1 text-center font-px text-[7px] text-[#c7d6ff]">SAVING… RECONNECTING</p>}
                </div>
              )}

              {phase === 'analysisFailed' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#010f38]/92 px-6 text-center">
                  <p className="font-px text-[11px] text-[#ff8a96]">THE AI COULDN&apos;T ANALYSE YOUR DRAWING.</p>
                  <p className="mt-3 text-[15px] text-[#dff6ff]">Your drawing is preserved. Try submitting again.</p>
                  <PxButton variant="gray" onClick={analyse} className="mt-4 min-h-[44px] px-4 text-[9px]">
                    TRY AGAIN
                  </PxButton>
                </div>
              )}
            </div>
          </div>

          <AnimatedSprite
            name="robot-peek"
            speed="1.6s"
            className="absolute -right-4 top-[14%] h-[120px] drop-shadow-[0_0_14px_rgba(0,187,252,0.6)] sm:h-[136px] lg:hidden"
          />
        </div>

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

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-[1fr_1fr_1.6fr]">
          <PxButton variant="gray" onClick={() => setStrokes((s) => s.slice(0, -1))} disabled={!drawingPhase || strokes.length === 0} className="min-h-[56px] text-[11px]">
            <UndoIcon />
            UNDO
          </PxButton>
          <PxButton variant="gray" onClick={() => setStrokes([])} disabled={!drawingPhase || strokes.length === 0} className="min-h-[56px] text-[11px]">
            <TrashIcon />
            CLEAR
          </PxButton>
          <PxButton onClick={submit} disabled={!drawingPhase || strokes.length === 0} className="col-span-2 min-h-[64px] text-[18px] lg:col-span-1">
            SUBMIT
          </PxButton>
        </div>

        <AnimatedSprite name="boy-cheer" speed="0.7s" className="pointer-events-none absolute bottom-2 right-3 h-[84px] lg:hidden" />
      </div>
    </Scene>
  );
}

function TickMarks({ flip }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 12 14" className={`h-7 w-6 shrink-0 ${flip ? '-scale-x-100' : ''}`} aria-hidden="true" shapeRendering="crispEdges">
      <path fill="#ffe66a" d="M0 8h2v2H0zM2 6h2v2H2zM4 4h2v2H4zM4 11h2v2H4zM6 9h2v2H6zM8 7h2v2H8zM2 1h2v2H2zM4 0h2v1H4z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 12 12" className="h-6 w-6 shrink-0" aria-hidden="true" shapeRendering="crispEdges">
      <path fill="#ffe66a" d="M4 0h4v1h2v1h1v2h1v4h-1v2h-1v1h-2v1H4v-1H2v-1H1V8H0V4h1V2h1V1h2z" />
      <path fill="#041030" d="M4 2h4v1h1v1h1v4H9v1H8v1H4V9H3V8H2V4h1V3h1z" />
      <path fill="#ffe66a" d="M5 3h2v3h2v2H5z" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 12 10" className="h-5 w-6" aria-hidden="true" shapeRendering="crispEdges">
      <path fill="currentColor" d="M4 0h1v1H4zM3 1h1v1H3zM2 2h1v1H2zM1 3h1v1H1zM2 4h1v1H2zM3 5h1v1H3zM4 6h1v1H4zM2 3h7v1H2zM9 4h1v1H9zM10 5h1v3h-1zM9 8h1v1H9zM4 8h5v1H4z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 10 12" className="h-5 w-5" aria-hidden="true" shapeRendering="crispEdges">
      <path fill="currentColor" d="M4 0h2v1H4zM1 1h8v2H1zM2 3h6v9H2zM3 5h1v5H3zM6 5h1v5H6z" />
      <path fill="#dfe5f3" d="M3 5h1v5H3zM6 5h1v5H6z" />
    </svg>
  );
}
