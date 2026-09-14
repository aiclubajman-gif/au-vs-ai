import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * Classifier resolution (§8).
 *
 * The mock classifier passes selfTest. If it could stand in for a model that
 * failed to load, an official attempt would start on a device that cannot run
 * Round 2, and the drawing would be scored on made-up confidences. These tests
 * make sure a failed model is a failed device check in production.
 */

const model = vi.hoisted(() => ({
  installed: true,
  loadError: null as Error | null,
}));

vi.mock('@/lib/ml/tfjs-classifier', () => ({
  probeModel: async () =>
    model.installed
      ? { installed: true, reason: 'model + 15 labels found' }
      : { installed: false, reason: 'model.json returned HTTP 404' },
  TfjsClassifier: class {
    readonly kind = 'tfjs' as const;
    ready = false;
    async load() {
      if (model.loadError) throw model.loadError;
      this.ready = true;
    }
    async selfTest() {
      return true;
    }
    async predict() {
      return [{ label: 'cat', confidence: 0.9 }];
    }
  },
}));

/** Module state (the cached instance) must not leak between tests. */
async function freshModule() {
  vi.resetModules();
  return import('@/lib/ml/classifier');
}

afterEach(() => {
  model.installed = true;
  model.loadError = null;
  vi.unstubAllEnvs();
});

describe('resolveClassifier', () => {
  it('uses the real model when it loads', async () => {
    const { resolveClassifier, getClassifier } = await freshModule();
    const c = await resolveClassifier({ allowMock: false });
    expect(c.kind).toBe('tfjs');
    expect(getClassifier()).toBe(c);
  });

  it('fails instead of using the mock when the model is missing', async () => {
    model.installed = false;
    const { resolveClassifier, ClassifierUnavailableError, getClassifierError } = await freshModule();

    await expect(resolveClassifier({ allowMock: false })).rejects.toBeInstanceOf(
      ClassifierUnavailableError,
    );
    expect(getClassifierError()).toMatch(/404/);
  });

  it('fails instead of using the mock when the model exists but will not load', async () => {
    model.loadError = new Error('WebGL context lost');
    const { resolveClassifier, ClassifierUnavailableError } = await freshModule();

    await expect(resolveClassifier({ allowMock: false })).rejects.toBeInstanceOf(
      ClassifierUnavailableError,
    );
  });

  it('never invents a classifier when none was resolved', async () => {
    model.installed = false;
    const { resolveClassifier, getClassifier, ClassifierUnavailableError } = await freshModule();

    await resolveClassifier({ allowMock: false }).catch(() => null);
    expect(() => getClassifier()).toThrow(ClassifierUnavailableError);
  });

  it('does not cache a failure, so "Try again" really retries the model', async () => {
    model.loadError = new Error('network dropped mid-download');
    const { resolveClassifier } = await freshModule();

    await expect(resolveClassifier({ allowMock: false })).rejects.toThrow();

    model.loadError = null;
    const c = await resolveClassifier({ allowMock: false });
    expect(c.kind).toBe('tfjs');
  });

  it('uses the mock only when explicitly allowed', async () => {
    model.installed = false;
    const { resolveClassifier } = await freshModule();
    const c = await resolveClassifier({ allowMock: true });
    expect(c.kind).toBe('mock');
  });

  it('refuses the mock in a production build even if the dev flag is set', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_ALLOW_MOCK_CLASSIFIER', '1');
    model.installed = false;
    const { resolveClassifier, ClassifierUnavailableError } = await freshModule();

    await expect(resolveClassifier()).rejects.toBeInstanceOf(ClassifierUnavailableError);
  });
});

describe('mockClassifierAllowed', () => {
  it('is false in production whatever the flag says', async () => {
    const { mockClassifierAllowed } = await freshModule();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_ALLOW_MOCK_CLASSIFIER', '1');
    expect(mockClassifierAllowed()).toBe(false);
  });

  it('is opt-in in development', async () => {
    const { mockClassifierAllowed } = await freshModule();
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_ALLOW_MOCK_CLASSIFIER', '');
    expect(mockClassifierAllowed()).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_ALLOW_MOCK_CLASSIFIER', '1');
    expect(mockClassifierAllowed()).toBe(true);
  });
});
