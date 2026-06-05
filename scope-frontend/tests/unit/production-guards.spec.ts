describe('production guard rails', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('blocks local preview mock data in production builds unless preview is explicit', async () => {
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('VITE_ENABLE_LOCAL_PREVIEW', 'false');

    const { loadMockData } = await import('@/services/mockDataLoader');

    await expect(loadMockData()).rejects.toThrow('Local preview data is not available in this production build.');
  });

  it('allows mock data only for an explicit production local-preview build', async () => {
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('VITE_ENABLE_LOCAL_PREVIEW', 'true');

    const { loadMockData } = await import('@/services/mockDataLoader');
    const data = await loadMockData();

    expect(data.mockSpots.length).toBeGreaterThan(0);
    expect(data.mockTrips.length).toBeGreaterThan(0);
  });

  it('filters projected map points by finite viewport bounds', async () => {
    const {
      getMapPointsInsideViewport,
      isProjectedPointInsideViewport,
    } = await import('@/components/map/mapViewportVisibility');
    const points = [
      { id: 'inside', title: 'Inside', latitude: 0, longitude: 0 },
      { id: 'outside', title: 'Outside', latitude: 1, longitude: 1 },
    ];

    expect(isProjectedPointInsideViewport({ x: Number.NaN, y: 10 }, { width: 100, height: 100 })).toBe(false);
    expect(isProjectedPointInsideViewport({ x: -5, y: 50 }, { width: 100, height: 100 }, -10)).toBe(false);
    expect(isProjectedPointInsideViewport({ x: -5, y: 50 }, { width: 100, height: 100 }, 10)).toBe(true);
    expect(getMapPointsInsideViewport(points, { width: 100, height: 100 }, (point) => (
      point.id === 'inside' ? { x: 50, y: 50 } : { x: 150, y: 150 }
    ))).toEqual([points[0]]);
  });
});
