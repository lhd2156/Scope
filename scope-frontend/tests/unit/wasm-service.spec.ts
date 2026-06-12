import {
  __wasmServiceCoverage,
  buildViewportConvexHull,
  calculateHaversineDistance,
  clusterViewportPoints,
  getScopeWasmModuleInfo,
  lexScopeAiCommandText,
  lexScopeAiCommandTextFallbackForTests,
  lexScopeAiCommandTextWithRuntime,
  pingScopeWasmRuntime,
  preloadScopeWasmRuntime,
  resetScopeWasmRuntimeForTests,
} from '@/services/wasmService';

describe('wasmService', () => {
  beforeEach(() => {
    resetScopeWasmRuntimeForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
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

  it('handles invalid distance inputs, offscreen clusters, and antimeridian viewports', async () => {
    const invalidDistance = await calculateHaversineDistance(
      { id: 'origin', latitude: Number.NaN, longitude: -97.7431 },
      { id: 'target', latitude: 30.2747, longitude: undefined },
    );

    expect(invalidDistance).toEqual({
      valid: false,
      fromId: 'origin',
      toId: 'target',
      kilometers: 0,
      miles: 0,
      meters: 0,
    });

    const zeroSizedViewportClusters = await clusterViewportPoints(
      [{ id: 'hidden', latitude: 10, longitude: 10 }],
      { west: 0, south: 0, east: 20, north: 20, width: 0, height: 400, zoom: 5 },
    );

    expect(zeroSizedViewportClusters).toEqual([]);

    const antimeridianClusters = await clusterViewportPoints(
      [
        { id: 'west-edge', latitude: 0, longitude: 179.8 },
        { id: 'east-edge', latitude: 0.01, longitude: -179.9 },
        { id: 'invalid-row', latitude: undefined, longitude: 181 },
      ],
      { west: 170, south: -10, east: -170, north: 10, width: 1000, height: 500, zoom: 3 },
      { radiusPx: 128, minPoints: 2, includeSingles: false },
    );

    expect(antimeridianClusters).toHaveLength(1);
    expect(antimeridianClusters[0]).toMatchObject({
      clustered: true,
      pointCount: 2,
      pointIds: ['east-edge', 'west-edge'],
    });
  });

  it('normalizes null coordinate inputs and wraps longitudes across repeated worlds', async () => {
    const nullDistance = await calculateHaversineDistance(
      null as never,
      { id: 'target', latitude: 30.2747, longitude: -97.7404 },
    );

    expect(nullDistance).toMatchObject({
      valid: false,
      fromId: 'origin',
      toId: 'target',
      meters: 0,
    });

    const wrappedClusters = await clusterViewportPoints(
      [
        { id: 'wrapped-west', lat: 0, lon: 540.1 },
        { id: 'wrapped-east', lat: 0.01, lng: -540.2 },
        { latitude: 0.02, longitude: 179.95 },
      ],
      { west: 170, south: -10, east: -170, north: 10, width: 1000, height: 500, zoom: 3 },
      { radiusPx: 160, minPoints: 2, includeSingles: true },
    );

    expect(wrappedClusters.flatMap((entry) => entry.pointIds)).toEqual(
      expect.arrayContaining(['wrapped-west', 'wrapped-east', 'point-2']),
    );
  });

  it('records unavailable wasm asset responses before falling back to JavaScript bindings', async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }));

    const wasmService = await import('@/services/wasmService');
    wasmService.resetScopeWasmRuntimeForTests();

    const moduleInfo = await wasmService.getScopeWasmModuleInfo();

    expect(moduleInfo.runtimeMode).toBe('js-fallback');
    expect(moduleInfo.fallbackReason).toContain('404');

    vi.unstubAllGlobals();
  });

  it('falls back when wasm is disabled or asset probing is unavailable', async () => {
    vi.stubEnv('VITE_ENABLE_SCOPE_WASM', 'false');

    await preloadScopeWasmRuntime();
    const disabledInfo = await getScopeWasmModuleInfo();

    expect(disabledInfo.runtimeMode).toBe('js-fallback');
    expect(disabledInfo.fallbackReason).toContain('disabled');

    resetScopeWasmRuntimeForTests();
    vi.stubEnv('VITE_ENABLE_SCOPE_WASM', 'true');
    vi.stubGlobal('fetch', undefined);

    const noFetchInfo = await getScopeWasmModuleInfo();

    expect(noFetchInfo.runtimeMode).toBe('js-fallback');
    expect(noFetchInfo.algorithmsReady).toBe(true);
  });

  it('keeps projected point ordering stable for shared rows, columns, and wrapped worlds', async () => {
    const viewport = {
      west: -98,
      south: 30,
      east: -97,
      north: 31,
      width: 1000,
      height: 600,
      zoom: 8,
    };

    const rowOrderedClusters = await clusterViewportPoints(
      [
        { id: 'east', latitude: 30.5, longitude: -97.2 },
        { id: 'west', latitude: 30.5, longitude: -97.8 },
        { id: 'middle', latitude: 30.5, longitude: -97.5 },
      ],
      viewport,
      { radiusPx: 1, minPoints: 2, includeSingles: true },
    );

    expect(rowOrderedClusters.map((entry) => entry.id)).toEqual(['west', 'middle', 'east']);

    const wrappedWorldClusters = await clusterViewportPoints(
      [
        { id: 'wrapped-east', latitude: 0, longitude: 540.25 },
        { id: 'date-line', latitude: 0, longitude: 180.1 },
      ],
      { west: 170, south: -10, east: -170, north: 10, width: 1000, height: 500, zoom: 3 },
      { radiusPx: 1, minPoints: 2, includeSingles: true },
    );

    expect(wrappedWorldClusters.flatMap((entry) => entry.pointIds)).toEqual(
      expect.arrayContaining(['wrapped-east', 'date-line']),
    );

    const verticalHull = await buildViewportConvexHull(
      [
        { id: 'column-top', latitude: 30.82, longitude: -97.5 },
        { id: 'column-bottom', latitude: 30.18, longitude: -97.5 },
        { id: 'left', latitude: 30.48, longitude: -97.86 },
        { id: 'right', latitude: 30.56, longitude: -97.14 },
        { id: 'interior', latitude: 30.5, longitude: -97.5 },
      ],
      viewport,
    );

    expect(verticalHull.valid).toBe(true);
    expect(verticalHull.hullPointIds).toEqual(expect.arrayContaining(['column-top', 'column-bottom', 'left', 'right']));
    expect(verticalHull.hullPointCount).toBeGreaterThanOrEqual(3);
  });

  it('returns empty and line-style hulls for sparse visible point sets', async () => {
    const emptyHull = await buildViewportConvexHull(
      [
        { id: 'outside', latitude: 50, longitude: -120 },
        { id: 'invalid', latitude: undefined, longitude: -97 },
      ],
      { west: -98, south: 30, east: -97, north: 31, width: 1200, height: 800, zoom: 8 },
    );

    expect(emptyHull).toMatchObject({
      valid: false,
      pointCount: 0,
      hullPointCount: 0,
      pointIds: [],
      hull: [],
    });

    const lineHull = await buildViewportConvexHull(
      [
        { id: 'line-a', latitude: 30.1, longitude: -97.9 },
        { id: 'line-b', latitude: 30.2, longitude: -97.8 },
        { id: 'line-b-duplicate', latitude: 30.2, longitude: -97.8 },
      ],
      { west: -98, south: 30, east: -97, north: 31, width: 1200, height: 800, zoom: 8 },
    );

    expect(lineHull.valid).toBe(true);
    expect(lineHull.hullPointCount).toBeLessThanOrEqual(2);
    expect(lineHull.areaSquarePx).toBe(0);
    expect(lineHull.perimeterPx).toBeGreaterThan(0);
  });

  it('lexes Scope AI map commands into compiler-style command tokens', () => {
    const tokens = lexScopeAiCommandText('map dallas tx zoom in');

    expect(tokens).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'map_keyword', normalized: 'map' }),
      expect.objectContaining({ type: 'zoom_keyword', normalized: 'zoom' }),
      expect.objectContaining({ type: 'zoom_direction', normalized: 'in' }),
      expect.objectContaining({ type: 'place_span', normalized: 'dallas tx' }),
    ]));
  });

  it('lexes sharing, invite, visibility, endpoint, and delete command vocabulary', () => {
    const tokens = lexScopeAiCommandText('share with john@example.com viewer and delete destination');

    expect(tokens).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'document_action', normalized: 'share' }),
      expect.objectContaining({ type: 'email', normalized: 'john@example.com' }),
      expect.objectContaining({ type: 'role', normalized: 'viewer' }),
      expect.objectContaining({ type: 'document_action', normalized: 'delete' }),
      expect.objectContaining({ type: 'endpoint_keyword', normalized: 'destination' }),
    ]));
  });

  it('uses the same lexer contract through the runtime fallback when wasm is unavailable', async () => {
    const message = 'invite @maya editor then switch map dark';
    const syncTokens = lexScopeAiCommandText(message);
    const runtimeTokens = await lexScopeAiCommandTextWithRuntime(message);

    expect(runtimeTokens).toEqual(syncTokens);
    expect(runtimeTokens).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'handle', normalized: '@maya' }),
      expect.objectContaining({ type: 'role', normalized: 'editor' }),
      expect.objectContaining({ type: 'map_style', normalized: 'dark' }),
    ]));
  });

  it('keeps fallback sanitizers and geometry guards bounded for native-style edge outputs', () => {
    const coverage = __wasmServiceCoverage!;

    expect(coverage.normalizeArray({ 0: 'a', 1: 'b', length: 2 })).toEqual(['a', 'b']);
    expect(coverage.sanitizeClusterResult({
      id: 'cluster-1',
      clustered: true,
      pointCount: 2,
      latitude: 30,
      longitude: -97,
      screenX: 10,
      screenY: 20,
      minScreenX: 1,
      minScreenY: 2,
      maxScreenX: 30,
      maxScreenY: 40,
      pointIds: { 0: 'a', 1: 'b', length: 2 },
    })).toMatchObject({ pointIds: ['a', 'b'] });
    expect(coverage.sanitizeHullResult({
      valid: true,
      pointCount: 2,
      hullPointCount: 2,
      latitude: 30,
      longitude: -97,
      screenX: 10,
      screenY: 20,
      minScreenX: 1,
      minScreenY: 2,
      maxScreenX: 30,
      maxScreenY: 40,
      areaSquarePx: 0,
      perimeterPx: 10,
      pointIds: { 0: 'a', length: 1 },
      hullPointIds: { 0: 'a', 1: 'b', length: 2 },
      hull: { 0: { id: 'a', latitude: 30, longitude: -97, screenX: 1, screenY: 2 }, length: 1 },
    })).toMatchObject({ pointIds: ['a'], hullPointIds: ['a', 'b'], hull: [expect.objectContaining({ id: 'a' })] });

    expect(coverage.sanitizeScopeAiLexToken({
      type: 'unknown-token',
      value: ' Route ',
      normalized: undefined,
      start: Number.NaN,
      end: Number.NaN,
    }, 10)).toMatchObject({ type: 'word', value: 'Route', normalized: 'route', start: 0, end: 0 });
    expect(coverage.sanitizeScopeAiLexToken({
      type: 'word',
      value: '',
      normalized: '',
      start: 0,
      end: 0,
    }, 10)).toBeNull();
    expect(coverage.sanitizeScopeAiLexTokens({
      0: { type: 'map_keyword', value: 'Map', normalized: 'MAP', start: -10, end: 99 },
      1: { type: 'word', value: '', normalized: '', start: 0, end: 1 },
      length: 2,
    }, 8)).toEqual([
      expect.objectContaining({ type: 'map_keyword', normalized: 'map', start: 0, end: 8 }),
    ]);

    const projected = [
      { id: 'a', latitude: 30, longitude: -97, worldX: 0, worldY: 0, screenX: 0, screenY: 0 },
      { id: 'b', latitude: 31, longitude: -98, worldX: 0, worldY: 0, screenX: 20, screenY: 0 },
      { id: 'c', latitude: 32, longitude: -99, worldX: 0, worldY: 0, screenX: 10, screenY: 10 },
    ];
    expect(coverage.computeAverageScreenPoint([])).toEqual({ x: 0, y: 0 });
    expect(coverage.computeHullCentroid([])).toEqual({ x: 0, y: 0 });
    expect(coverage.computeHullAreaSquarePx([])).toBe(0);
    expect(coverage.computeHullPerimeterPx([projected[0]])).toBe(0);
    expect(coverage.buildConvexHull(projected)).toHaveLength(3);
    expect(coverage.screenCrossProduct(projected[0], projected[1], projected[2])).toBeGreaterThan(0);

    const viewport = { west: -98, south: 30, east: -97, north: 31, width: 1000, height: 600, zoom: 8 };
    expect(coverage.projectVisiblePoints(
      [{ id: 'outside', latitude: 45, longitude: -120 }],
      coverage.buildProjectionContext(viewport),
    )).toEqual([]);
    expect(coverage.clusterViewportPointsFallback(
      [
        { id: 'single-a', latitude: 30.1, longitude: -97.9 },
        { id: 'single-b', latitude: 30.9, longitude: -97.1 },
      ],
      viewport,
      { radiusPx: 1, minPoints: 3, includeSingles: false },
    )).toEqual([]);
    expect(coverage.buildViewportConvexHullFallback([], viewport)).toMatchObject({ valid: false, pointIds: [] });
    expect(coverage.createFallbackBindings().ping()).toBe('scope-wasm-js-fallback-ready');
    expect(coverage.resolveWasmAssetBasePath()).toContain('/wasm/dist/');
  });

  it.each([
    ['map dallas tx zoom in', [
      ['map_keyword', 'map'],
      ['zoom_keyword', 'zoom'],
      ['zoom_direction', 'in'],
      ['place_span', 'dallas tx'],
    ]],
    ['switch map dark', [
      ['map_control', 'switch'],
      ['map_keyword', 'map'],
      ['map_style', 'dark'],
    ]],
    ['share with john@example.com viewer and delete destination', [
      ['document_action', 'share'],
      ['email', 'john@example.com'],
      ['role', 'viewer'],
      ['document_action', 'delete'],
      ['endpoint_keyword', 'destination'],
    ]],
    ['nvm remove start then invite @maya editor', [
      ['document_action', 'remove'],
      ['endpoint_keyword', 'start'],
      ['document_action', 'invite'],
      ['handle', '@maya'],
      ['role', 'editor'],
    ]],
    ['rename this trip to Tokyo food crawl', [
      ['document_action', 'rename'],
      ['word', 'tokyo'],
      ['place_span', 'tokyo food crawl'],
    ]],
    ['make this trip private and fit route', [
      ['document_action', 'private'],
      ['map_control', 'fit'],
    ]],
    ['zoomigng into dallas tx and remvoe strt', [
      ['zoom_keyword', 'zooming'],
      ['place_span', 'dallas tx'],
      ['document_action', 'remove'],
      ['endpoint_keyword', 'start'],
    ]],
    ['sahre with john@example.com viewer then make it privte', [
      ['document_action', 'share'],
      ['email', 'john@example.com'],
      ['role', 'viewer'],
      ['document_action', 'private'],
    ]],
    ['mpa route fitt then cnfirm delte', [
      ['map_keyword', 'map'],
      ['word', 'route'],
      ['map_control', 'fit'],
      ['document_action', 'confirm'],
      ['document_action', 'delete'],
    ]],
    ['shre with @maya viewer and make it brite map', [
      ['document_action', 'share'],
      ['handle', '@maya'],
      ['role', 'viewer'],
      ['map_style', 'bright'],
      ['map_keyword', 'map'],
    ]],
    ['swtich map drak and shre with @maya viwer', [
      ['map_control', 'switch'],
      ['map_keyword', 'map'],
      ['map_style', 'dark'],
      ['document_action', 'share'],
      ['handle', '@maya'],
      ['role', 'viewer'],
    ]],
    ['toggel map lite then invite @maya edtor', [
      ['map_control', 'toggle'],
      ['map_keyword', 'map'],
      ['map_style', 'light'],
      ['document_action', 'invite'],
      ['handle', '@maya'],
      ['role', 'editor'],
    ]],
  ] as const)('keeps the Scope AI lexer golden corpus stable for "%s"', (message, expectedTokens) => {
    const tokens = lexScopeAiCommandTextFallbackForTests(message);

    for (const [type, normalized] of expectedTokens) {
      expect(tokens).toEqual(expect.arrayContaining([
        expect.objectContaining({ type, normalized }),
      ]));
    }
  });

  it('covers fallback clustering, hull, and token sanitizer boundary branches', () => {
    const coverage = __wasmServiceCoverage!;
    const viewport = { west: -98, south: 30, east: -97, north: 31, width: 1000, height: 600, zoom: 8 };
    const closePoints = [
      { id: 'a', latitude: 30.5, longitude: -97.5 },
      { id: 'b', latitude: 30.5001, longitude: -97.5001 },
      { id: 'c', latitude: 30.5002, longitude: -97.5002 },
    ];

    expect(coverage.normalizeArray({ 0: 'bad', length: 1 })).toEqual(['bad']);
    expect(coverage.sanitizeScopeAiLexToken({
      type: 'place_span',
      value: undefined,
      normalized: '  ',
      start: 3,
      end: 1,
    }, 4)).toBeNull();
    expect(coverage.sanitizeScopeAiLexToken({
      type: 'zoom_direction',
      value: ' In ',
      normalized: undefined,
      start: 1,
      end: 99,
    }, 4)).toMatchObject({
      type: 'zoom_direction',
      value: 'In',
      normalized: 'in',
      start: 1,
      end: 4,
    });

    const clustered = coverage.clusterViewportPointsFallback(closePoints, viewport, {
      radiusPx: 50,
      minPoints: 2,
      includeSingles: true,
    });
    expect(clustered).toEqual(expect.arrayContaining([
      expect.objectContaining({ clustered: true, pointCount: 3 }),
    ]));

    const lineHull = coverage.buildViewportConvexHullFallback([
      { id: 'line-a', latitude: 30.5, longitude: -97.9 },
      { id: 'line-b', latitude: 30.5, longitude: -97.8 },
      { id: 'line-c', latitude: 30.5, longitude: -97.7 },
    ], viewport);
    expect(lineHull.valid).toBe(true);
    expect(lineHull.areaSquarePx).toBe(0);

    const emptyHull = coverage.buildViewportConvexHullFallback([
      { id: 'outside', latitude: 50, longitude: -120 },
    ], viewport);
    expect(emptyHull).toMatchObject({ valid: false, pointIds: [] });
  });
});
