'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { resolveClassifier, getResolutionNote, type Prediction, type Classifier } from '@/lib/ml/classifier';

/**
 * Preprocessing debug page.
 *
 * The usual reason a QuickDraw model "doesn't work" is not the model — it is a
 * mismatch between what the canvas sends and what the model was trained on.
 * This page shows the actual 28x28 the model receives, magnified, so that can
 * be checked by eye against the training samples in the notebook.
 *
 * Not linked from anywhere in the game. Development tool only.
 */

type Stroke = { x: number; y: number }[];
const SIZE = 320;
const STROKE_WIDTH = 12;

export function DebugDraw() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [preds, setPreds] = useState<Prediction[]>([]);
  const [classifier, setClassifier] = useState<Classifier | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ms, setMs] = useState(0);
  const [note, setNote] = useState('loading…');
  const drawing = useRef(false);

  useEffect(() => {
    resolveClassifier().then((c) => {
      setClassifier(c);
      setNote(getResolutionNote());
    });
  }, []);

  const redraw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = STROKE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of strokes) {
      if (s.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(s[0].x, s[0].y);
      for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y);
      ctx.stroke();
    }
  }, [strokes]);

  useEffect(redraw, [redraw]);

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
    const originX = (minX + maxX) / 2 - side / 2;
    const originY = (minY + maxY) / 2 - side / 2;

    const tmp = document.createElement('canvas');
    tmp.width = 28; tmp.height = 28;
    const tctx = tmp.getContext('2d', { willReadFrequently: true });
    if (!tctx) return out;

    const scale = 28 / side;
    tctx.fillStyle = '#000';
    tctx.fillRect(0, 0, 28, 28);
    tctx.strokeStyle = '#fff';
    tctx.lineWidth = Math.max(1.5, STROKE_WIDTH * scale);
    tctx.lineCap = 'round';
    tctx.lineJoin = 'round';

    for (const s of strokes) {
      if (s.length === 0) continue;
      tctx.beginPath();
      tctx.moveTo((s[0].x - originX) * scale, (s[0].y - originY) * scale);
      for (let i = 1; i < s.length; i++) {
        tctx.lineTo((s[i].x - originX) * scale, (s[i].y - originY) * scale);
      }
      tctx.stroke();
    }

    const data = tctx.getImageData(0, 0, 28, 28);
    for (let i = 0; i < 784; i++) out[i] = data.data[i * 4] / 255;

    // Magnified preview of exactly what the model sees.
    const pv = previewRef.current?.getContext('2d');
    if (pv) {
      pv.imageSmoothingEnabled = false;
      pv.clearRect(0, 0, 224, 224);
      pv.drawImage(tmp, 0, 0, 224, 224);
    }

    return out;
  }, [strokes]);

  async function run() {
    if (!classifier) return;
    const bitmap = toBitmap28();
    const t0 = performance.now();
    const result = await classifier.predict(bitmap);
    setMs(Math.round(performance.now() - t0));
    setPreds(result.slice(0, 5));
  }

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * SIZE, y: ((e.clientY - r.top) / r.height) * SIZE };
  }

  return (
    <main className="min-h-dvh px-6 py-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold">Preprocessing debug</h1>
        <div className="mt-3 rounded-lg border border-[var(--color-edge)] bg-[var(--color-navy)] px-4 py-3">
          <p className="text-sm">
            Classifier:{' '}
            <span
              className={`font-mono font-semibold ${
                classifier?.kind === 'tfjs'
                  ? 'text-[var(--color-win)]'
                  : 'text-[var(--color-lose)]'
              }`}
            >
              {classifier ? classifier.kind : 'loading…'}
            </span>
          </p>
          <p className="mt-1 font-mono text-xs leading-relaxed text-[var(--color-muted)]">
            {note}
          </p>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-[var(--color-muted)]">
              Draw here
            </p>
            <canvas
              ref={canvasRef}
              width={SIZE}
              height={SIZE}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                drawing.current = true;
                const p = point(e);
                setStrokes((s) => [...s, [p]]);
              }}
              onPointerMove={(e) => {
                if (!drawing.current) return;
                const p = point(e);
                setStrokes((s) => {
                  if (!s.length) return s;
                  const n = [...s];
                  n[n.length - 1] = [...n[n.length - 1], p];
                  return n;
                });
              }}
              onPointerUp={() => {
                drawing.current = false;
                run();
              }}
              className="canvas-surface aspect-square w-full rounded-xl border border-[var(--color-edge)] bg-[var(--color-navy)]"
            />
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-[var(--color-muted)]">
              What the model sees (28×28)
            </p>
            <canvas
              ref={previewRef}
              width={224}
              height={224}
              className="aspect-square w-full rounded-xl border border-[var(--color-edge)] bg-black"
            />
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              Compare against the training samples in section 2 of the notebook. They should
              look like the same kind of picture.
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => { setStrokes([]); setPreds([]); }}
            className="rounded-lg border border-[var(--color-edge)] px-5 py-3 text-sm"
          >
            Clear
          </button>
          <button
            onClick={run}
            className="rounded-lg bg-[var(--color-cyan)] px-5 py-3 text-sm font-semibold text-[var(--color-void)]"
          >
            Classify
          </button>
          {ms > 0 && (
            <span className="self-center text-sm text-[var(--color-muted)]">{ms}ms</span>
          )}
        </div>

        <div className="mt-6 space-y-2">
          {preds.map((p) => (
            <div key={p.label}>
              <div className="flex justify-between text-sm">
                <span>{p.label}</span>
                <span className="tabular">{(p.confidence * 100).toFixed(1)}%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--color-edge)]">
                <div
                  className="h-full bg-[var(--color-cyan)]"
                  style={{ width: `${p.confidence * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
