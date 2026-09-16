import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Backend selection for the real model (§8).
 *
 * tf.setBackend RESOLVES FALSE when a backend cannot start — it only throws for
 * a name that was never registered — and a WebGL context that starts can still
 * fail on the first real GPU work, which happens in the warm-up. Both cases
 * used to escape as "this phone can't run the drawing AI" on devices where CPU
 * would have worked, costing the student their one game for no reason.
 */

const gl = vi.hoisted(() => ({
  /** What setBackend('webgl') resolves to. */
  webglSelectable: true,
  /** Whether the warm-up inference throws on webgl. */
  webglWarmupFails: false,
  cpuSelectable: true,
  cpuWarmupFails: false,
  current: 'none' as string,
  modelsCreated: 0,
  modelsDisposed: 0,
}));

vi.mock('@tensorflow/tfjs', () => {
  const selectable = (name: string) =>
    name === 'webgl' ? gl.webglSelectable : gl.cpuSelectable;

  const makeTensor = () => ({ dispose: () => {}, dataSync: () => new Float32Array(15) });

  return {
    setBackend: async (name: string) => {
      if (!selectable(name)) return false;
      gl.current = name;
      return true;
    },
    ready: async () => {},
    getBackend: () => gl.current,
    zeros: () => makeTensor(),
    tensor: () => makeTensor(),
    tidy: (fn: () => unknown) => fn(),
    loadLayersModel: async () => {
      gl.modelsCreated++;
      return {
        dispose: () => {
          gl.modelsDisposed++;
        },
        predict: () => {
          const failing =
            (gl.current === 'webgl' && gl.webglWarmupFails) ||
            (gl.current === 'cpu' && gl.cpuWarmupFails);
          // A shader that will not link surfaces here, not in setBackend.
          if (failing) throw new Error('Failed to link vertex and fragment shaders');
          return makeTensor();
        },
      };
    },
  };
});

async function freshClassifier() {
  vi.resetModules();
  const mod = await import('@/lib/ml/tfjs-classifier');
  return new mod.TfjsClassifier();
}

beforeEach(() => {
  gl.webglSelectable = true;
  gl.webglWarmupFails = false;
  gl.cpuSelectable = true;
  gl.cpuWarmupFails = false;
  gl.current = 'none';
  gl.modelsCreated = 0;
  gl.modelsDisposed = 0;
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify(['cat', 'sun'])));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TfjsClassifier backend selection', () => {
  it('uses WebGL when it works', async () => {
    const c = await freshClassifier();
    await c.load();
    expect(c.ready).toBe(true);
    expect(c.backend).toBe('webgl');
  });

  it('falls back to CPU when setBackend resolves false instead of throwing', async () => {
    gl.webglSelectable = false;
    const c = await freshClassifier();
    await c.load();
    expect(c.ready).toBe(true);
    expect(c.backend).toBe('cpu');
  });

  it('falls back to CPU when WebGL starts but fails during the warm-up', async () => {
    gl.webglWarmupFails = true;
    const c = await freshClassifier();
    await c.load();
    expect(c.ready).toBe(true);
    expect(c.backend).toBe('cpu');
  });

  it('does not leak the model from the failed WebGL attempt', async () => {
    gl.webglWarmupFails = true;
    const c = await freshClassifier();
    await c.load();
    expect(gl.modelsCreated).toBe(2);
    expect(gl.modelsDisposed).toBe(1);
  });

  it('predicts normally after falling back to CPU', async () => {
    gl.webglWarmupFails = true;
    const c = await freshClassifier();
    const preds = await c.predict(new Float32Array(784));
    expect(preds.map((p) => p.label).sort()).toEqual(['cat', 'sun']);
    expect(preds.every((p) => Number.isFinite(p.confidence))).toBe(true);
  });

  it('passes its self-test on the CPU fallback, so the device is not refused', async () => {
    gl.webglWarmupFails = true;
    const c = await freshClassifier();
    // selfTest needs a DOM canvas; the load path is what this asserts.
    await c.load();
    expect(c.backend).toBe('cpu');
    expect(c.ready).toBe(true);
  });

  it('fails only when BOTH backends fail, and names each reason', async () => {
    gl.webglWarmupFails = true;
    gl.cpuSelectable = false;
    const c = await freshClassifier();
    await expect(c.load()).rejects.toThrow(/webgl failed .*cpu also failed/);
    expect(c.ready).toBe(false);
  });
});
