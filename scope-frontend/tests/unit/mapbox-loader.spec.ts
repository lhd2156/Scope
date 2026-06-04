import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MAP_STYLE,
  getMapboxToken,
  hasMapboxToken,
  resolveMapboxStyle,
} from '@/services/mapboxLoader';

async function loadMapboxLoaderWithRuntime(runtime: Record<string, unknown>, hardwareConcurrency?: number) {
  vi.resetModules();
  vi.doMock('mapbox-gl/dist/mapbox-gl.css', () => ({}));
  vi.doMock('mapbox-gl', () => ({
    default: runtime,
  }));
  vi.doMock('mapbox-gl/dist/mapbox-gl-csp', () => ({
    default: runtime,
  }));
  vi.doMock('mapbox-gl/dist/mapbox-gl-csp-worker.js?url', () => ({
    default: '/mapbox-gl-csp-worker.js',
  }));
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    configurable: true,
    value: hardwareConcurrency,
  });
  return import('@/services/mapboxLoader');
}

describe('mapboxLoader helpers', () => {
  beforeEach(() => {
    // Isolate from any ambient VITE_MAPBOX_TOKEN (e.g. injected by the CI build env)
    // so default-parameter fallbacks exercise the "no token configured" path.
    vi.stubEnv('VITE_MAPBOX_TOKEN', '');
  });

  afterEach(() => {
    vi.doUnmock('mapbox-gl');
    vi.doUnmock('mapbox-gl/dist/mapbox-gl-csp');
    vi.doUnmock('mapbox-gl/dist/mapbox-gl.css');
    vi.doUnmock('mapbox-gl/dist/mapbox-gl-csp-worker.js?url');
    vi.unstubAllEnvs();
  });

  it('normalizes configured token values', () => {
    expect(getMapboxToken('  pk.test-token  ')).toBe('pk.test-token');
    expect(getMapboxToken(undefined)).toBe('');
    expect(hasMapboxToken('  pk.live  ')).toBe(true);
    expect(hasMapboxToken('   ')).toBe(false);
  });

  it('resolves css-driven map style when available', () => {
    document.documentElement.style.setProperty('--map-style', 'mapbox://styles/scope/custom');

    expect(resolveMapboxStyle()).toBe('mapbox://styles/scope/custom');

    document.documentElement.style.setProperty('--map-style', "'mapbox://styles/scope/quoted'");

    expect(resolveMapboxStyle()).toBe('mapbox://styles/scope/quoted');
  });

  it('falls back to the provided default style when no css override exists', () => {
    document.documentElement.style.removeProperty('--map-style');

    expect(resolveMapboxStyle(DEFAULT_MAP_STYLE)).toBe(DEFAULT_MAP_STYLE);
    expect(resolveMapboxStyle('mapbox://styles/scope/fallback', null)).toBe('mapbox://styles/scope/fallback');
  });

  it('loads, tunes, and tokenizes the Mapbox runtime for the current device', async () => {
    const runtime = {
      accessToken: '',
      workerCount: 0,
    };
    const { loadConfiguredMapboxRuntime } = await loadMapboxLoaderWithRuntime(runtime, 6);

    await expect(loadConfiguredMapboxRuntime(' pk.live-token ')).resolves.toBe(runtime);

    expect(runtime).toMatchObject({
      accessToken: 'pk.live-token',
      workerCount: 3,
    });
  });

  it('prewarms only when a token is configured and treats prewarm failures as non-fatal', async () => {
    const prewarm = vi.fn(() => {
      throw new Error('prewarm unavailable');
    });
    const runtime = {
      accessToken: '',
      workerCount: 0,
      prewarm,
    };
    const { prewarmConfiguredMapboxRuntime } = await loadMapboxLoaderWithRuntime(runtime, 12);

    await expect(prewarmConfiguredMapboxRuntime('   ')).resolves.toBeNull();
    await expect(prewarmConfiguredMapboxRuntime('pk.prewarm')).resolves.toBe(runtime);

    expect(runtime).toMatchObject({
      accessToken: 'pk.prewarm',
      workerCount: 4,
    });
    expect(prewarm).toHaveBeenCalledTimes(1);
  });

  it('keeps low-power and non-tunable runtimes conservative', async () => {
    const lowPowerRuntime = {
      accessToken: '',
      workerCount: 0,
    };
    let loader = await loadMapboxLoaderWithRuntime(lowPowerRuntime, 2);
    await loader.loadConfiguredMapboxRuntime('pk.low');
    expect(lowPowerRuntime.workerCount).toBe(2);

    const nonTunableRuntime = {
      accessToken: '',
    };
    loader = await loadMapboxLoaderWithRuntime(nonTunableRuntime, Number.NaN);
    await loader.loadConfiguredMapboxRuntime('pk.basic');
    expect(nonTunableRuntime.accessToken).toBe('pk.basic');
  });
});
