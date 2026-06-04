import { beforeEach, describe, expect, it, vi } from 'vitest';

const geocodeMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/mapService', () => ({
  geocode: geocodeMock,
}));

describe('map viewport service', () => {
  beforeEach(() => {
    geocodeMock.mockReset();
  });

  it('returns cloned default discovery viewports', async () => {
    const {
      getDefaultDiscoveryMapViewport,
      getUnitedStatesMapViewport,
    } = await import('@/services/mapViewportService');

    const first = getDefaultDiscoveryMapViewport();
    const second = getUnitedStatesMapViewport();
    first.center[0] = 0;

    expect(second.center[0]).not.toBe(0);
    expect(second.zoom).toBeGreaterThan(0);
  });

  it('resolves a sanitized home-base geocode result into a locality viewport', async () => {
    geocodeMock.mockResolvedValue({
      data: [
        {
          latitude: 32.7555,
          longitude: -97.3308,
        },
      ],
    });

    const { resolveHomeBaseMapViewport } = await import('@/services/mapViewportService');

    await expect(resolveHomeBaseMapViewport('  Fort Worth\nTX  ')).resolves.toMatchObject({
      center: [-97.3308, 32.7555],
    });
    expect(geocodeMock).toHaveBeenCalledWith('Fort Worth TX', 1);
  });

  it('rejects empty, missing, and invalid home-base coordinates', async () => {
    const { resolveHomeBaseMapViewport } = await import('@/services/mapViewportService');

    await expect(resolveHomeBaseMapViewport('   ')).resolves.toBeNull();

    geocodeMock.mockResolvedValueOnce({ data: [] });
    await expect(resolveHomeBaseMapViewport('Unknown')).resolves.toBeNull();

    geocodeMock.mockResolvedValueOnce({
      data: [{ latitude: 95, longitude: -97 }],
    });
    await expect(resolveHomeBaseMapViewport('Bad latitude')).resolves.toBeNull();

    geocodeMock.mockResolvedValueOnce({
      data: [{ latitude: 32, longitude: -190 }],
    });
    await expect(resolveHomeBaseMapViewport('Bad longitude')).resolves.toBeNull();
  });
});
