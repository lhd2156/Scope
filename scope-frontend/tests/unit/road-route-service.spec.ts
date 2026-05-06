import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearRoadRouteCache,
  resolveRoadRoute,
} from '@/services/roadRouteService';
import type { MapPoint } from '@/types';

const routePoints: MapPoint[] = [
  { id: 'start', title: 'Start', latitude: 32.7555, longitude: -97.3308, category: 'food' },
  { id: 'middle', title: 'Middle', latitude: 32.7507, longitude: -97.3511, category: 'culture' },
  { id: 'finish', title: 'Finish', latitude: 32.7489, longitude: -97.3623, category: 'nature' },
];

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: vi.fn(async () => payload),
  } as unknown as Response;
}

describe('roadRouteService', () => {
  beforeEach(() => {
    clearRoadRouteCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    clearRoadRouteCache();
  });

  it('builds a deterministic local driving estimate when Mapbox is not configured', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveRoadRoute(routePoints);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.provider).toBe('local-estimate');
    expect(result.profile).toBe('local');
    expect(result.orderedPoints[0]?.id).toBe('start');
    expect(result.orderedPoints.at(-1)?.id).toBe('finish');
    expect(result.distanceMeters).toBeGreaterThan(0);
    expect(result.durationSeconds).toBeGreaterThan(0);
    expect(result.geometry.length).toBeGreaterThanOrEqual(routePoints.length);
  });

  it('optimizes the local fallback order by nearest middle stop when Mapbox is unavailable', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', '');
    vi.stubGlobal('fetch', vi.fn());
    const unorderedLocalPoints: MapPoint[] = [
      { id: 'start', title: 'Start', latitude: 0, longitude: 0, category: 'other' },
      { id: 'far', title: 'Far stop', latitude: 0, longitude: 10, category: 'other' },
      { id: 'near', title: 'Near stop', latitude: 0, longitude: 1, category: 'other' },
      { id: 'finish', title: 'Finish', latitude: 0, longitude: 11, category: 'other' },
    ];

    const result = await resolveRoadRoute(unorderedLocalPoints);

    expect(result.provider).toBe('local-estimate');
    expect(result.orderedPoints.map((point) => point.id)).toEqual(['start', 'near', 'far', 'finish']);
  });

  it('uses Mapbox optimization geometry, ETA, and waypoint order when available', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-token');
    const fetchMock = vi.fn(async () => jsonResponse({
      code: 'Ok',
      waypoints: [
        { waypoint_index: 0 },
        { waypoint_index: 2 },
        { waypoint_index: 1 },
      ],
      trips: [
        {
          geometry: {
            coordinates: [
              [-97.3308, 32.7555],
              [-97.342, 32.752],
              [-97.3623, 32.7489],
            ],
          },
          distance: 4123,
          duration: 935,
        },
      ],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveRoadRoute(routePoints);
    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedUrl.href).toContain('/optimized-trips/v1/mapbox/driving-traffic/');
    expect(requestedUrl.searchParams.get('geometries')).toBe('geojson');
    expect(requestedUrl.searchParams.get('overview')).toBe('full');
    expect(requestedUrl.searchParams.get('roundtrip')).toBe('false');
    expect(requestedUrl.searchParams.get('source')).toBe('first');
    expect(requestedUrl.searchParams.get('destination')).toBe('last');
    expect(result).toMatchObject({
      provider: 'mapbox-optimization',
      profile: 'mapbox/driving-traffic',
      distanceMeters: 4123,
      durationSeconds: 935,
    });
    expect(result.orderedPoints.map((point) => point.id)).toEqual(['start', 'middle', 'finish']);
    expect(result.geometry).toEqual([
      [-97.3308, 32.7555],
      [-97.342, 32.752],
      [-97.3623, 32.7489],
    ]);
  });

  it('keeps the supplied stop order when fixed-order road geometry is requested', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-token');
    const fetchMock = vi.fn(async () => jsonResponse({
      code: 'Ok',
      routes: [
        {
          geometry: {
            coordinates: [
              [-97.3308, 32.7555],
              [-97.346, 32.751],
              [-97.3623, 32.7489],
            ],
          },
          distance: 3890,
          duration: 825,
        },
      ],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveRoadRoute(routePoints, { optimizeOrder: false });
    const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedUrl.href).toContain('/directions/v5/mapbox/driving-traffic/');
    expect(requestedUrl.href).not.toContain('/optimized-trips/');
    expect(requestedUrl.searchParams.get('roundtrip')).toBeNull();
    expect(result).toMatchObject({
      provider: 'mapbox-directions',
      profile: 'mapbox/driving-traffic',
      distanceMeters: 3890,
      durationSeconds: 825,
    });
    expect(result.orderedPoints.map((point) => point.id)).toEqual(['start', 'middle', 'finish']);
    expect(result.geometry).toEqual([
      [-97.3308, 32.7555],
      [-97.346, 32.751],
      [-97.3623, 32.7489],
    ]);
  });

  it('falls back to full route geometry distance when Mapbox omits distance', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-token');
    const routeGeometry = [
      [-97.3308, 32.7555],
      [-97.346, 32.751],
      [-97.3623, 32.7489],
    ];
    const fetchMock = vi.fn(async () => jsonResponse({
      code: 'Ok',
      routes: [
        {
          geometry: {
            coordinates: routeGeometry,
          },
          duration: 825,
        },
      ],
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveRoadRoute(routePoints, { optimizeOrder: false });

    expect(result.provider).toBe('mapbox-directions');
    expect(result.profile).toBe('mapbox/driving-traffic');
    expect(result.durationSeconds).toBe(825);
    expect(result.distanceMeters).toBeGreaterThan(0);
    expect(result.distanceMeters).not.toBe(routePoints.length);
    expect(result.distanceMeters).toBeGreaterThan(2800);
    expect(result.distanceMeters).toBeLessThan(3600);
  });
});
