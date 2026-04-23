import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MAP_STYLE,
  getMapboxToken,
  hasMapboxToken,
  resolveMapboxStyle,
} from '@/services/mapboxLoader';

describe('mapboxLoader helpers', () => {
  beforeEach(() => {
    // Isolate from any ambient VITE_MAPBOX_TOKEN (e.g. injected by the CI build env)
    // so default-parameter fallbacks exercise the "no token configured" path.
    vi.stubEnv('VITE_MAPBOX_TOKEN', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('normalizes configured token values', () => {
    expect(getMapboxToken('  pk.test-token  ')).toBe('pk.test-token');
    expect(getMapboxToken(undefined)).toBe('');
    expect(hasMapboxToken('  pk.live  ')).toBe(true);
    expect(hasMapboxToken('   ')).toBe(false);
  });

  it('resolves css-driven map style when available', () => {
    document.documentElement.style.setProperty('--map-style', 'mapbox://styles/atlas/custom');

    expect(resolveMapboxStyle()).toBe('mapbox://styles/atlas/custom');
  });

  it('falls back to the provided default style when no css override exists', () => {
    document.documentElement.style.removeProperty('--map-style');

    expect(resolveMapboxStyle(DEFAULT_MAP_STYLE)).toBe(DEFAULT_MAP_STYLE);
    expect(resolveMapboxStyle('mapbox://styles/atlas/fallback', null)).toBe('mapbox://styles/atlas/fallback');
  });
});
