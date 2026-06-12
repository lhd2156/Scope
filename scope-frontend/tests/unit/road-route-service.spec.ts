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

function failingResponse(status: number, payload: unknown = null): Response {
  return {
    ok: false,
    status,
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

  it('falls back across Mapbox optimization profiles before using directions', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-token');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ code: 'NoRoute', message: 'No traffic route' }))
      .mockResolvedValueOnce(jsonResponse({ trips: [{ geometry: { coordinates: [] } }] }))
      .mockResolvedValueOnce(jsonResponse({
        routes: [{
          geometry: {
            coordinates: [
              [-97.3308, 32.7555],
              [-97.34, 32.75],
              [-97.3623, 32.7489],
            ],
          },
          distance: 5000,
          duration: 1000,
        }],
      }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveRoadRoute(routePoints);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/optimized-trips/v1/mapbox/driving-traffic/');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/optimized-trips/v1/mapbox/driving/');
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain('/directions/v5/mapbox/driving-traffic/');
    expect(result.provider).toBe('mapbox-directions');
    expect(result.routeQuality).toBe('mapbox');
  });

  it('returns a redacted local fallback when all remote road strategies fail', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.secret-token');
    const fetchMock = vi.fn(async () => failingResponse(500, null));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveRoadRoute(routePoints);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result.provider).toBe('local-estimate');
    expect(result.routeQuality).toBe('visual-fallback');
    expect(result.routeError).toContain('Route request failed with status 500');
    expect(result.routeError).not.toContain('pk.secret-token');
  });

  it('handles runtime, cache, and waypoint-limit fallbacks deterministically', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', '');
    vi.stubGlobal('fetch', undefined);

    const emptyRuntimeRoute = await resolveRoadRoute([routePoints[0]!]);
    expect(emptyRuntimeRoute.provider).toBe('local-estimate');
    expect(emptyRuntimeRoute.routeError).toBe('Mapbox route unavailable in this runtime.');

    vi.stubGlobal('fetch', vi.fn());
    const uniqueRoutes = await Promise.all(Array.from({ length: 26 }, (_, index) => resolveRoadRoute([
      { id: `start-${index}`, title: 'Start', latitude: 32 + index * 0.001, longitude: -97, category: 'food' },
      { id: `end-${index}`, title: 'End', latitude: 32.5 + index * 0.001, longitude: -97.5, category: 'culture' },
    ])));
    expect(uniqueRoutes.every((route) => route.provider === 'local-estimate')).toBe(true);

    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-token');
    const tooManyPoints = Array.from({ length: 26 }, (_, index): MapPoint => ({
      id: `point-${index}`,
      title: `Point ${index}`,
      latitude: 30 + index * 0.01,
      longitude: -100 + index * 0.01,
      category: 'other',
    }));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveRoadRoute(tooManyPoints, { optimizeOrder: false });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.provider).toBe('local-estimate');
    expect(result.routeError).toBe('Too many points for Mapbox Directions API.');
  });

  it('drops invalid duplicate waypoints and falls back from malformed Mapbox geometry safely', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-token');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        code: 'NoRoute',
        message: '',
        trips: [],
      }))
      .mockResolvedValueOnce(jsonResponse({
        code: 'Ok',
        trips: [{ geometry: { coordinates: { bad: true } } }],
      }))
      .mockResolvedValueOnce(jsonResponse({
        code: 'Ok',
        routes: [{ geometry: { coordinates: [[-97.3308, 32.7555], ['bad', 99], [-97.3623, 32.7489]] } }],
      }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveRoadRoute([
      routePoints[0]!,
      { ...routePoints[1]!, id: routePoints[0]!.id },
      { id: 'bad-latitude', title: 'Bad latitude', latitude: 120, longitude: -97.3, category: 'food' },
      routePoints[2]!,
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.provider).toBe('mapbox-directions');
    expect(result.orderedPoints.map((point) => point.id)).toEqual(['start', 'finish']);
    expect(result.geometry).toEqual([
      [-97.3308, 32.7555],
      [-97.3623, 32.7489],
    ]);
    expect(result.distanceMeters).toBeGreaterThan(0);
  });

  it('keeps remote route edge fallbacks bounded for sparse waypoint and geometry payloads', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-token');

    const noWaypointFetch = vi.fn(async () => jsonResponse({
      code: 'Ok',
      trips: [{
        geometry: {
          coordinates: [
            [-97.3308, 32.7555],
            [-97.34, 32.752],
            [-97.3623, 32.7489],
          ],
        },
      }],
    }));
    vi.stubGlobal('fetch', noWaypointFetch);
    let result = await resolveRoadRoute(routePoints);
    expect(result.provider).toBe('mapbox-optimization');
    expect(result.orderedPoints.map((point) => point.id)).toEqual(['start', 'middle', 'finish']);
    expect(result.distanceMeters).toBeGreaterThan(0);

    clearRoadRouteCache();
    const partialWaypointFetch = vi.fn(async () => jsonResponse({
      code: 'Ok',
      waypoints: [{ waypoint_index: 1 }],
      trips: [{
        geometry: {
          coordinates: [
            [-97.3308, 32.7555],
            [-97.34, 32.752],
            [-97.3623, 32.7489],
          ],
        },
      }],
    }));
    vi.stubGlobal('fetch', partialWaypointFetch);
    result = await resolveRoadRoute(routePoints);
    expect(result.provider).toBe('mapbox-optimization');
    expect(result.orderedPoints.map((point) => point.id)).toEqual(['start', 'middle', 'finish']);

    clearRoadRouteCache();
    const invalidCoordinateFetch = vi.fn(async () => jsonResponse({
      code: 'Ok',
      routes: [{
        geometry: {
          coordinates: [
            [-97.3308, 32.7555],
            [-200, 32.75],
            [-97.3623, 32.7489],
          ],
        },
      }],
    }));
    vi.stubGlobal('fetch', invalidCoordinateFetch);
    result = await resolveRoadRoute(routePoints, { optimizeOrder: false });
    expect(result.provider).toBe('mapbox-directions');
    expect(result.geometry).toEqual([
      [-97.3308, 32.7555],
      [-97.3623, 32.7489],
    ]);
    expect(result.durationSeconds).toBeGreaterThan(0);

    clearRoadRouteCache();
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw 'socket closed';
    }));
    result = await resolveRoadRoute(routePoints);
    expect(result.provider).toBe('local-estimate');
    expect(result.routeError).toBe('Mapbox route unavailable.');

    clearRoadRouteCache();
    const zeroGeometryFetch = vi.fn(async () => jsonResponse({
      code: 'Ok',
      routes: [{
        geometry: {
          coordinates: [
            [-97.3308, 32.7555],
            [-97.3308, 32.7555],
          ],
        },
        distance: -1,
        duration: -1,
      }],
    }));
    vi.stubGlobal('fetch', zeroGeometryFetch);
    result = await resolveRoadRoute(routePoints.slice(0, 2), { optimizeOrder: false });
    expect(result.provider).toBe('mapbox-directions');
    expect(result.distanceMeters).toBeGreaterThan(0);
    expect(result.durationSeconds).toBeGreaterThan(0);
  });
});
