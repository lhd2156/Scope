import {
  buildViewportConvexHull,
  calculateHaversineDistance,
  clusterViewportPoints,
  getScopeWasmModuleInfo,
  pingScopeWasmRuntime,
  resetScopeWasmRuntimeForTests,
} from '@/services/wasmService';

describe('wasmService', () => {
  beforeEach(() => {
    resetScopeWasmRuntimeForTests();
  });

  it('falls back cleanly when compiled wasm assets are unavailable', async () => {
    const moduleInfo = await getScopeWasmModuleInfo();
    const pingValue = await pingScopeWasmRuntime();

    expect(moduleInfo.runtimeMode).toBe('js-fallback');
    expect(moduleInfo.algorithmsReady).toBe(true);
    expect(moduleInfo.status).toContain('JavaScript spatial fallback');
    expect(moduleInfo.fallbackReason).toBeTruthy();
    expect(pingValue).toBe('scope-wasm-js-fallback-ready');
  });

  it('clusters visible points and preserves singleton markers in the viewport', async () => {
    const results = await clusterViewportPoints(
      [
        { id: 'spot-a', latitude: 30.2672, longitude: -97.7431 },
        { id: 'spot-b', latitude: 30.2675, longitude: -97.7427 },
        { id: 'spot-c', latitude: 30.2678, longitude: -97.7434 },
        { id: 'spot-d', latitude: 30.45, longitude: -97.6 },
      ],
      {
        west: -98,
        south: 30,
        east: -97,
        north: 31,
        width: 1200,
        height: 800,
        zoom: 10,
      },
      {
        radiusPx: 72,
        minPoints: 2,
        includeSingles: true,
      },
    );

    expect(results).toHaveLength(2);

    const clusteredEntry = results.find((entry) => entry.clustered);
    const singletonEntry = results.find((entry) => !entry.clustered);

    expect(clusteredEntry).toBeDefined();
    expect(clusteredEntry?.pointCount).toBe(3);
    expect(clusteredEntry?.pointIds).toEqual(['spot-a', 'spot-b', 'spot-c']);
    expect(singletonEntry).toBeDefined();
    expect(singletonEntry?.id).toBe('spot-d');
    expect(singletonEntry?.pointIds).toEqual(['spot-d']);
  });

  it('computes distance and convex hull metadata for visible points', async () => {
    const distance = await calculateHaversineDistance(
      { id: 'origin', latitude: 30.2672, longitude: -97.7431 },
      { id: 'target', latitude: 30.2747, longitude: -97.7404 },
    );

    const hull = await buildViewportConvexHull(
      [
        { id: 'spot-a', latitude: 30.2672, longitude: -97.7431 },
        { id: 'spot-b', latitude: 30.2724, longitude: -97.7302 },
        { id: 'spot-c', latitude: 30.2795, longitude: -97.7494 },
        { id: 'spot-d', latitude: 30.2634, longitude: -97.7358 },
      ],
      {
        west: -98,
        south: 30,
        east: -97,
        north: 31,
        width: 1200,
        height: 800,
        zoom: 10,
      },
    );

    expect(distance.valid).toBe(true);
    expect(distance.fromId).toBe('origin');
    expect(distance.toId).toBe('target');
    expect(distance.miles).toBeGreaterThan(0.5);
    expect(distance.meters).toBeGreaterThan(800);

    expect(hull.valid).toBe(true);
    expect(hull.pointCount).toBe(4);
    expect(hull.hullPointCount).toBeGreaterThanOrEqual(3);
    expect(hull.pointIds).toEqual(['spot-a', 'spot-b', 'spot-c', 'spot-d']);
    expect(hull.hull.length).toBe(hull.hullPointCount);
    expect(hull.areaSquarePx).toBeGreaterThan(0);
    expect(hull.perimeterPx).toBeGreaterThan(0);
  });
});
