/**
 * TensorFlow.js classifier for Round 2.
 *
 * Loads the model produced by notebooks/train_drawing_model.ipynb from
 * /public/models/quickdraw/. Labels are read from labels.json rather than
 * hardcoded, so retraining with a different class list cannot silently
 * mislabel every prediction.
 *
 * tfjs is imported dynamically so its ~1MB never lands in the initial bundle.
 * The sign-in screens must load fast on venue wifi; the model only needs to be
 * there by the time the device check runs.
 */

import type { Classifier, Prediction } from './classifier';

const MODEL_URL = process.env.NEXT_PUBLIC_MODEL_URL ?? '/models/quickdraw/model.json';
const LABELS_URL = MODEL_URL.replace(/model\.json$/, 'labels.json');

type TfModule = typeof import('@tensorflow/tfjs');
type TfGraphModel = Awaited<ReturnType<TfModule['loadLayersModel']>>;

export class TfjsClassifier implements Classifier {
  readonly kind = 'tfjs' as const;

  private tf: TfModule | null = null;
  private model: TfGraphModel | null = null;
  private labels: string[] = [];
  private loading: Promise<void> | null = null;
  private _ready = false;
  private _backend = 'none';

  get ready() {
    return this._ready;
  }

  get classLabels(): string[] {
    return this.labels;
  }

  /** The backend that actually ran the warm-up. Surfaced on /debug/draw. */
  get backend(): string {
    return this._backend;
  }

  async load(): Promise<void> {
    if (this._ready) return;
    // Concurrent callers share one download rather than racing.
    if (this.loading) return this.loading;

    this.loading = (async () => {
      const tf = await import('@tensorflow/tfjs');
      this.tf = tf;

      // WebGL is far faster, but plenty of older Android browsers expose a
      // context that initialises and then fails on the first real GPU work:
      // a shader that will not link, a context lost on a backgrounded tab, an
      // out-of-memory. That failure surfaces in the warm-up below, not in
      // setBackend, so the whole load — backend, weights and warm-up — is
      // retried on CPU. Without this a perfectly usable phone is told it
      // cannot run the drawing round and sent to a booth tablet.
      try {
        await this.initOn(tf, 'webgl');
      } catch (err) {
        this.releaseModel();
        try {
          await this.initOn(tf, 'cpu');
        } catch (cpuErr) {
          const first = err instanceof Error ? err.message : 'unknown';
          const second = cpuErr instanceof Error ? cpuErr.message : 'unknown';
          throw new Error(`webgl failed (${first}); cpu also failed (${second})`);
        }
      }

      this._ready = true;
    })();

    try {
      await this.loading;
    } finally {
      this.loading = null;
    }
  }

  /**
   * Selects a backend and loads the model on it, warm-up included.
   *
   * tf.setBackend RESOLVES FALSE when a backend fails to initialise — it only
   * throws for a name that was never registered — so the boolean has to be
   * checked. Treating it as throw-on-failure is why the old CPU fallback never
   * ran on the devices it was written for.
   */
  private async initOn(tf: TfModule, backend: 'webgl' | 'cpu'): Promise<void> {
    const selected = await tf.setBackend(backend).catch(() => false);
    if (!selected) throw new Error(`${backend} backend is not available`);
    await tf.ready();

    if (tf.getBackend() !== backend) {
      throw new Error(`asked for ${backend} but got ${tf.getBackend()}`);
    }

    const [model, labelsRes] = await Promise.all([
      tf.loadLayersModel(MODEL_URL),
      fetch(LABELS_URL),
    ]);

    this.model = model;
    this.labels = await labelsRes.json();

    if (!Array.isArray(this.labels) || this.labels.length === 0) {
      throw new Error('labels.json is missing or empty');
    }

    // One warm-up pass. The first inference compiles shaders and can take
    // hundreds of milliseconds; doing it here means the student's actual
    // submission is fast — and it is where a broken WebGL context finally
    // admits it, while there is still time to fall back.
    const warm = tf.zeros([1, 28, 28, 1]);
    const out = model.predict(warm) as { dispose: () => void };
    out.dispose();
    warm.dispose();

    this._backend = backend;
  }

  /** Drops a model from a failed attempt so the retry does not leak it. */
  private releaseModel(): void {
    try {
      this.model?.dispose();
    } catch {
      // A model that failed mid-load may not dispose cleanly. Nothing to do.
    }
    this.model = null;
    this.labels = [];
  }

  async selfTest(): Promise<boolean> {
    try {
      if (typeof document === 'undefined') return false;

      // Canvas readback is the capability Round 2 actually depends on.
      const canvas = document.createElement('canvas');
      canvas.width = 28;
      canvas.height = 28;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return false;
      ctx.fillRect(0, 0, 4, 4);
      if (ctx.getImageData(0, 0, 28, 28).data.length !== 28 * 28 * 4) return false;

      await this.load();

      const probe = new Float32Array(784);
      probe[400] = 1;
      const result = await this.predict(probe);
      return result.length > 0 && result.every((p) => Number.isFinite(p.confidence));
    } catch {
      return false;
    }
  }

  async predict(bitmap28: Float32Array): Promise<Prediction[]> {
    if (!this._ready) await this.load();
    if (!this.tf || !this.model) return [];

    const tf = this.tf;

    // tidy() disposes intermediate tensors. Without it, a student drawing for
    // twenty seconds leaks GPU memory on every inference.
    const scores = tf.tidy(() => {
      const input = tf.tensor(bitmap28, [1, 28, 28, 1]);
      const output = this.model!.predict(input) as ReturnType<TfModule['tensor']>;
      return output.dataSync();
    });

    return this.labels
      .map((label, i) => ({ label, confidence: scores[i] ?? 0 }))
      .sort((a, b) => b.confidence - a.confidence);
  }
}

export interface ModelProbe {
  installed: boolean;
  /** Human-readable explanation, surfaced on /debug/draw. */
  reason: string;
}

/**
 * Checks whether a real exported model is present.
 *
 * Uses GET rather than HEAD: Next's dev server does not reliably answer HEAD
 * for files in /public, so a HEAD probe reported "missing" for a model that was
 * sitting right there. The file is ~20KB and the browser caches it, so tfjs
 * reuses this fetch rather than downloading twice.
 */
export async function probeModel(): Promise<ModelProbe> {
  try {
    const res = await fetch(MODEL_URL, { cache: 'force-cache' });

    if (!res.ok) {
      return {
        installed: false,
        reason: `model.json returned HTTP ${res.status}. Expected it at public${MODEL_URL}`,
      };
    }

    const json = await res.json();

    // Guard against a truncated or wrong-format file looking like success.
    if (!json.modelTopology && !json.format) {
      return { installed: false, reason: 'model.json is not a TensorFlow.js model file' };
    }

    const labelsRes = await fetch(LABELS_URL, { cache: 'force-cache' });
    if (!labelsRes.ok) {
      return { installed: false, reason: 'labels.json is missing next to model.json' };
    }

    const labels = await labelsRes.json();
    if (!Array.isArray(labels) || labels.length === 0) {
      return { installed: false, reason: 'labels.json is empty or not an array' };
    }

    return { installed: true, reason: `model + ${labels.length} labels found` };
  } catch (err) {
    return {
      installed: false,
      reason: err instanceof Error ? err.message : 'unknown error probing the model',
    };
  }
}
