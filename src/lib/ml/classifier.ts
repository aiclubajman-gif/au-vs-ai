/**
 * Drawing classifier interface.
 *
 * Round 2 sits behind this interface so the real TensorFlow.js model can drop
 * in on 11 September without touching any game code. Until then the mock lets
 * the full flow — including the §8 device check — work end to end.
 *
 * The device check is the reason this exists before the model does: we must be
 * able to ask "can this phone run the drawing round?" BEFORE an official
 * attempt is created, so a student on an incompatible device is sent to a
 * booth tablet instead of burning their one game.
 */

export interface Prediction {
  label: string;
  confidence: number;
}

export interface Classifier {
  /** Loads weights. Safe to call repeatedly; the result is cached. */
  load(): Promise<void>;
  /** Runs a hidden test inference to prove the device can actually do this. */
  selfTest(): Promise<boolean>;
  /** Classifies a 28x28 grayscale bitmap, 784 values in 0..1. */
  predict(bitmap28: Float32Array): Promise<Prediction[]>;
  readonly ready: boolean;
  readonly kind: 'mock' | 'tfjs';
}

/** The 15 classes seeded in migration 0005. Must match the model's outputs. */
export const CLASSES = [
  'bicycle', 'cat', 'fish', 'car', 'tree', 'cup', 'star', 'umbrella',
  'clock', 'airplane', 'apple', 'house', 'key', 'ladder', 'sun',
] as const;

export type ClassKey = (typeof CLASSES)[number];

/**
 * Stand-in classifier. Returns plausible-looking confidences derived from the
 * bitmap so the UI can be built and judged, without pretending to be accurate.
 *
 * It deliberately still exercises the real failure path: if the browser has no
 * canvas or typed-array support, selfTest() returns false and the device check
 * correctly refuses to start an attempt.
 */
export class MockClassifier implements Classifier {
  readonly kind = 'mock' as const;
  private _ready = false;

  get ready() {
    return this._ready;
  }

  async load(): Promise<void> {
    if (this._ready) return;
    // Simulates a real weight download so loading states get exercised.
    await new Promise((r) => setTimeout(r, 400));
    this._ready = true;
  }

  async selfTest(): Promise<boolean> {
    try {
      if (typeof document === 'undefined') return false;

      // The genuine capability check: can this browser rasterize a canvas and
      // read pixels back? Old and locked-down browsers fail here, which is
      // exactly the case the booth tablets exist for.
      const canvas = document.createElement('canvas');
      canvas.width = 28;
      canvas.height = 28;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return false;

      ctx.fillRect(0, 0, 4, 4);
      const pixels = ctx.getImageData(0, 0, 28, 28);
      if (!pixels || pixels.data.length !== 28 * 28 * 4) return false;

      await this.load();
      const probe = new Float32Array(784);
      const result = await this.predict(probe);
      return result.length > 0;
    } catch {
      return false;
    }
  }

  async predict(bitmap28: Float32Array): Promise<Prediction[]> {
    if (!this._ready) await this.load();

    let ink = 0;
    for (let i = 0; i < bitmap28.length; i++) ink += bitmap28[i];
    const density = Math.min(1, ink / 160);

    const scores = CLASSES.map((label, i) => {
      const wobble = Math.abs(Math.sin((ink + 1) * (i + 3) * 0.7));
      return { label, confidence: wobble * density };
    });

    const total = scores.reduce((s, p) => s + p.confidence, 0) || 1;
    return scores
      .map((p) => ({ label: p.label, confidence: p.confidence / total }))
      .sort((a, b) => b.confidence - a.confidence);
  }
}

let instance: Classifier | null = null;
let resolving: Promise<Classifier> | null = null;
let lastError: string | null = null;

/**
 * Why the real model was not used, if it was not. Surfaced on /debug/draw so a
 * silent fallback to the mock is diagnosable instead of mysterious.
 */
export function getClassifierError(): string | null {
  return lastError;
}
let resolutionNote = 'not resolved yet';

/** Why the current classifier was chosen. Shown on /debug/draw. */
export function getResolutionNote(): string {
  return resolutionNote;
}

/**
 * Returns the real TensorFlow.js classifier when an exported model is present
 * at /models/quickdraw/model.json, and the mock otherwise.
 *
 * This is what lets the game be fully playable before the model exists, and
 * upgrade the moment it is dropped in — no code change, no flag to remember to
 * flip on fair day.
 */
export async function resolveClassifier(): Promise<Classifier> {
  if (instance) return instance;
  if (resolving) return resolving;

  resolving = (async () => {
    try {
      const { probeModel, TfjsClassifier } = await import('./tfjs-classifier');
      const probe = await probeModel();

      if (probe.installed) {
        try {
          const real = new TfjsClassifier();
          await real.load();
          instance = real;
          resolutionNote = probe.reason;
          return real;
        } catch (err) {
          // The model exists but will not load on this device — a corrupt
          // download, or a browser without a usable backend.
          resolutionNote = `model found but failed to load: ${
            err instanceof Error ? err.message : 'unknown'
          }`;
        }
      } else {
        resolutionNote = probe.reason;
      }
    } catch (err) {
      resolutionNote = `probe failed: ${err instanceof Error ? err.message : 'unknown'}`;
    }

    // Falling back to the mock. A missing or broken model must never stop a
    // student from playing.
    instance = new MockClassifier();
    return instance;
  })();

  try {
    return await resolving;
  } finally {
    resolving = null;
  }
}

/** Synchronous accessor for code paths that already awaited resolveClassifier. */
export function getClassifier(): Classifier {
  if (!instance) instance = new MockClassifier();
  return instance;
}
