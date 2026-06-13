import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import MapView from '@/components/map/MapView.vue';
import { resolveRoadRoute, type RoadRouteSummary } from '@/services/roadRouteService';
import { useMapStore } from '@/stores/map';
import type { MapPoint } from '@/types';

vi.mock('@/services/roadRouteService', () => ({
  resolveRoadRoute: vi.fn(async (points: MapPoint[]) => ({
    geometry: points.map((point) => [point.longitude, point.latitude]),
    orderedPoints: points,
    distanceMeters: 1200,
    durationSeconds: 420,
    provider: 'local-estimate',
    profile: 'local',
  })),
}));

vi.mock('mapbox-gl', () => ({
  default: {
    Marker: class {
      setLngLat() {
        return this;
      }

      addTo() {
        return this;
      }

      remove() {}
    },
    Map: class {},
    LngLatBounds: class {
      extend() {
        return this;
      }
    },
  },
}));

const spots: MapPoint[] = [
  {
    id: 'spot-1',
    title: 'Sunset Rooftop Tacos',
    latitude: 32.7555,
    longitude: -97.3308,
    category: 'food',
    city: 'Fort Worth',
    rating: 4.8,
  },
  {
    id: 'spot-2',
    title: 'Trinity Trails Outlook',
    latitude: 32.7443,
    longitude: -97.3521,
    category: 'scenic',
    city: 'Fort Worth',
    rating: 4.9,
  },
];

function countRoutePathSegments(path: string | undefined): number {
  return path?.match(/\sL\s/g)?.length ?? 0;
}

function getMapCoverage(wrapper: ReturnType<typeof mount>) {
  return (wrapper.vm as unknown as { __coverage: Record<string, any> }).__coverage;
}

describe('MapView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(resolveRoadRoute).mockClear();
  });

  it('renders the fallback experience and syncs visible spot ids when no token is configured', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: spots,
      },
    });

    await nextTick();

    const mapStore = useMapStore();

    expect(wrapper.text()).toContain('Interactive map offline');
    expect(wrapper.text()).toContain('2 pins in view');
    expect(wrapper.text()).toContain('9 filters active');
    expect(wrapper.text()).not.toContain('trip stops');
    expect(wrapper.find('[data-test="map-summary-pins"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="map-summary-filters"]').exists()).toBe(true);
    expect(wrapper.find('.map-canvas').classes()).toContain('is-fallback');
    expect(wrapper.find('[data-test="map-fallback-stage"]').exists()).toBe(true);
    expect(wrapper.findAll('g[data-test^="map-fallback-marker-"]')).toHaveLength(2);
    expect(mapStore.visibleSpotIds).toEqual(['spot-1', 'spot-2']);
    expect(mapStore.visibleSpotIdsMeasured).toBe(true);
  });

  it('fans out same-coordinate fallback markers so live pins remain clickable', async () => {
    const duplicateSpots: MapPoint[] = Array.from({ length: 18 }, (_, index) => ({
      ...spots[0]!,
      id: `duplicate-${index}`,
      title: `Duplicate Water Gardens ${index}`,
      category: 'scenic',
    }));

    const wrapper = mount(MapView, {
      props: {
        spots: duplicateSpots,
        routePoints: [duplicateSpots[0]!],
      },
    });

    await nextTick();

    const hitAreas = wrapper.findAll('.map-fallback__marker-hit-area');
    const positions = hitAreas.map((marker) => `${marker.attributes('cx')}:${marker.attributes('cy')}`);
    const markerGroups = wrapper.findAll('g.map-fallback__marker');

    expect(hitAreas).toHaveLength(duplicateSpots.length);
    expect(new Set(positions).size).toBe(duplicateSpots.length);
    expect(markerGroups.at(-1)?.attributes('data-test')).toBe('map-fallback-marker-duplicate-0');
  });

  it('honors planner map presentation props before the Mapbox runtime is available', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots: [],
        labelMode: 'states',
        mapPresentation: 'native',
        showMapStyleToggle: true,
        showTraffic: true,
        showSummary: false,
      },
    });

    await nextTick();

    expect(wrapper.attributes('data-map-presentation')).toBe('native');
    expect(wrapper.attributes('data-map-style')).toBe('mapbox://styles/mapbox/outdoors-v12');
  });

  it('numbers planner route markers from the full route sequence instead of stale labels', async () => {
    const routePoints: MapPoint[] = [
      {
        id: 'route-start',
        title: 'Tarzan, Texas',
        latitude: 32.3065,
        longitude: -101.9754,
        category: 'scenic',
        routeRole: 'start',
        routeLabel: 'S',
      },
      {
        id: 'route-stop-fort-worth',
        title: 'Fort Worth stop',
        latitude: 32.7555,
        longitude: -97.3308,
        category: 'food',
        routeRole: 'stop',
        routeLabel: '3',
      },
      {
        id: 'route-stop-austin',
        title: 'Austin stop',
        latitude: 30.2672,
        longitude: -97.7431,
        category: 'culture',
        routeRole: 'stop',
        routeLabel: '4',
      },
      {
        id: 'route-end',
        title: 'Garden City, Texas',
        latitude: 31.8646,
        longitude: -101.4812,
        category: 'other',
        routeRole: 'end',
        routeLabel: 'E',
      },
    ];

    const wrapper = mount(MapView, {
      props: {
        spots: routePoints,
        routePoints,
        markerVariant: 'sequence',
        showControls: false,
        showSummary: false,
      },
    });

    await nextTick();

    expect(wrapper.get('[data-test="map-fallback-marker-route-start"] .map-fallback__sequence text').text()).toBe('S');
    expect(wrapper.get('[data-test="map-fallback-marker-route-stop-fort-worth"] .map-fallback__sequence text').text()).toBe('2');
    expect(wrapper.get('[data-test="map-fallback-marker-route-stop-austin"] .map-fallback__sequence text').text()).toBe('3');
    expect(wrapper.get('[data-test="map-fallback-marker-route-end"] .map-fallback__sequence text').text()).toBe('E');
  });

  it('resolves fixed-order road geometry when a route has stops but no supplied geometry', async () => {
    vi.mocked(resolveRoadRoute).mockResolvedValueOnce({
      geometry: [
        [-97.3308, 32.7555],
        [-97.3412, 32.751],
        [-97.3521, 32.7443],
      ],
      orderedPoints: spots,
      distanceMeters: 2600,
      durationSeconds: 540,
      provider: 'mapbox-directions',
      profile: 'mapbox/driving',
    });

    mount(MapView, {
      props: {
        spots,
        routePoints: spots,
      },
    });

    await flushPromises();

    expect(resolveRoadRoute).toHaveBeenCalledWith(spots, { optimizeOrder: false });
  });

  it('can opt into optimized road geometry for planner routes', async () => {
    mount(MapView, {
      props: {
        spots,
        routePoints: spots,
        optimizeRouteOrder: true,
      },
    });

    await flushPromises();

    expect(resolveRoadRoute).toHaveBeenCalledWith(spots, { optimizeOrder: true });
  });

  it('drops stale auto route geometry while a changed route is recalculating', async () => {
    vi.mocked(resolveRoadRoute).mockResolvedValueOnce({
      geometry: [
        [-97.3308, 32.7555],
        [-97.3412, 32.751],
        [-97.3521, 32.7443],
      ],
      orderedPoints: spots,
      distanceMeters: 2600,
      durationSeconds: 540,
      provider: 'mapbox-directions',
      profile: 'mapbox/driving',
    });

    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: spots,
      },
    });

    await flushPromises();

    expect(countRoutePathSegments(wrapper.find('.map-fallback__route path').attributes('d'))).toBe(2);

    let resolveNextRoute: (summary: RoadRouteSummary) => void = () => undefined;
    vi.mocked(resolveRoadRoute).mockImplementationOnce(() => new Promise<RoadRouteSummary>((resolve) => {
      resolveNextRoute = resolve;
    }));

    const changedRoute: MapPoint[] = [
      {
        ...spots[0],
        id: 'spot-3',
        title: 'Changed start',
        latitude: 35.4676,
        longitude: -97.5164,
      },
      {
        ...spots[1],
        id: 'spot-4',
        title: 'Changed end',
        latitude: 36.154,
        longitude: -95.9928,
      },
    ];

    await wrapper.setProps({
      spots: changedRoute,
      routePoints: changedRoute,
    });
    await nextTick();

    expect(countRoutePathSegments(wrapper.find('.map-fallback__route path').attributes('d'))).toBe(1);

    resolveNextRoute({
      geometry: changedRoute.map((point) => [point.longitude, point.latitude]),
      orderedPoints: changedRoute,
      distanceMeters: 1800,
      durationSeconds: 480,
      provider: 'local-estimate',
      profile: 'local',
    });
  });

  it('selects a fallback marker and emits the chosen spot when the static map is used', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
      },
    });

    await nextTick();

    const mapStore = useMapStore();
    const secondMarkerHitArea = wrapper.get('[data-test="map-fallback-marker-hit-spot-2"]');

    await secondMarkerHitArea.trigger('click');
    await nextTick();

    expect(mapStore.selectedSpotId).toBe('spot-2');
    expect(wrapper.emitted('spot-select')).toEqual([[spots[1]]]);
    expect(wrapper.get('[data-test="map-fallback-marker-spot-2"]').classes()).toContain('is-active');
  });

  it('turns fallback marker clicks into map picks while pick mode is active', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        clickToSelect: true,
      },
    });

    await nextTick();

    await wrapper.get('[data-test="map-fallback-marker-hit-spot-2"]').trigger('click');
    await nextTick();

    expect(wrapper.emitted('spot-select')).toBeUndefined();
    expect(wrapper.emitted('interaction')).toEqual([[{ type: 'map_click' }]]);
    expect(wrapper.emitted('map-click')).toEqual([[
      {
        latitude: spots[1]?.latitude,
        longitude: spots[1]?.longitude,
      },
    ]]);
  });

  it('supports keyboard fallback marker selection and fallback canvas map picks', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        clickToSelect: true,
      },
    });

    await nextTick();

    await wrapper.get('[data-test="map-fallback-marker-hit-spot-1"]').trigger('keydown.space');
    await nextTick();

    expect(wrapper.emitted('map-click')?.[0]).toEqual([{
      latitude: spots[0]?.latitude,
      longitude: spots[0]?.longitude,
    }]);

    const fallbackCanvas = wrapper.get('svg.map-fallback__canvas');
    Object.defineProperty(fallbackCanvas.element, 'getScreenCTM', {
      configurable: true,
      value: () => ({
        inverse: () => ({}),
      }),
    });
    Object.defineProperty(fallbackCanvas.element, 'createSVGPoint', {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        matrixTransform: () => ({
          x: 600,
          y: 450,
        }),
      }),
    });

    await fallbackCanvas.trigger('click', {
      clientX: 480,
      clientY: 320,
    });
    await nextTick();

    expect(wrapper.emitted('map-click')?.[1]?.[0]).toEqual({
      latitude: expect.any(Number),
      longitude: expect.any(Number),
    });
    expect(wrapper.emitted('interaction')).toEqual([
      [{ type: 'map_click' }],
      [{ type: 'map_click' }],
    ]);
  });

  it('resets filters, selection, and viewport from the map controls', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: spots,
      },
    });
    const mapStore = useMapStore();
    mapStore.setCenter([-80, 40]);
    mapStore.setZoom(14);
    mapStore.setActiveCategories(['food']);
    mapStore.setVisibleSpotIds(['spot-1']);
    mapStore.setSelectedSpotId('spot-2');

    await wrapper.get('button[aria-label="Reset map"]').trigger('click');
    await nextTick();

    expect(mapStore.viewport.center).toEqual([-98.5795, 39.8283]);
    expect(mapStore.viewport.zoom).toBe(3.25);
    expect(mapStore.activeCategories).toEqual([
      'food',
      'nature',
      'nightlife',
      'culture',
      'adventure',
      'shopping',
      'entertainment',
      'scenic',
      'other',
    ]);
    expect(mapStore.selectedSpotId).toBe('spot-1');
    expect(wrapper.emitted('interaction')).toEqual([[{ type: 'reset_map' }]]);
  });

  it('resets planner starts to the provided base viewport without clearing the start', async () => {
    const baseViewport = {
      center: [2.3522, 48.8566] as [number, number],
      zoom: 2.8,
    };
    const startPoint: MapPoint = {
      id: 'route-start',
      title: 'Paris start',
      latitude: 48.8566,
      longitude: 2.3522,
      category: 'culture',
      routeRole: 'start',
      routeLabel: 'S',
    };
    const wrapper = mount(MapView, {
      props: {
        spots: [startPoint],
        routePoints: [startPoint],
        initialViewport: baseViewport,
        routeVariant: 'planner',
        markerVariant: 'sequence',
      },
    });
    const mapStore = useMapStore();
    mapStore.setCenter([2.3522, 48.8566]);
    mapStore.setZoom(7.2);
    mapStore.setSelectedSpotId('route-start');

    await wrapper.get('button[aria-label="Reset map"]').trigger('click');
    await nextTick();
    await flushPromises();

    expect(mapStore.viewport.center).toEqual(baseViewport.center);
    expect(mapStore.viewport.zoom).toBe(baseViewport.zoom);
    expect(mapStore.selectedSpotId).toBe('route-start');
    expect(wrapper.find('[data-test="map-fallback-marker-route-start"]').exists()).toBe(true);
  });

  it('uses an explicit reset viewport instead of the location-aware initial viewport', async () => {
    const initialViewport = {
      center: [-97.3308, 32.7555] as [number, number],
      zoom: 11,
    };
    const resetViewport = {
      center: [-98.5795, 39.8283] as [number, number],
      zoom: 3.25,
    };
    const wrapper = mount(MapView, {
      props: {
        spots: [],
        initialViewport,
        resetViewport,
      },
    });
    const mapStore = useMapStore();
    mapStore.setCenter(initialViewport.center);
    mapStore.setZoom(15);

    await wrapper.get('button[aria-label="Reset map"]').trigger('click');
    await nextTick();

    expect(mapStore.viewport.center).toEqual(resetViewport.center);
    expect(mapStore.viewport.zoom).toBe(resetViewport.zoom);
  });

  it('reports that planner map commands cannot move the live map while Mapbox is offline', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: spots,
        routeVariant: 'planner',
      },
    });
    const exposed = wrapper.vm as unknown as {
      runPlannerMapCommand: (command: unknown) => Promise<{ ok: boolean; message: string }>;
    };

    await nextTick();

    await expect(exposed.runPlannerMapCommand('zoom_in')).resolves.toEqual({
      ok: false,
      message: 'The live planner map is offline right now, so I could not move the Mapbox view.',
    });
  });

  it('normalizes rendered map features into enriched nearby place pins', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        showNearbyPlaces: true,
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const poiFeature = {
      id: 'qt-fort-worth',
      layer: {
        id: 'poi-label',
        type: 'symbol',
        'source-layer': 'poi_label',
      },
      properties: {
        name: 'QT Travel Center',
        maki: 'fuel',
        house_num: '100',
        street: 'Main Street',
        city: 'Fort Worth',
        state: 'TX',
        postcode: '76102',
      },
      geometry: {
        type: 'Point',
        coordinates: [-97.3308, 32.7555],
      },
    };
    const fallbackLngLat = { lng: -96.8, lat: 32.7 };

    expect(coverage.getMapFeatureCoordinates(poiFeature, fallbackLngLat)).toEqual({
      latitude: 32.7555,
      longitude: -97.3308,
    });
    expect(coverage.buildAddressFromMapFeatureParts(poiFeature)).toBe('100 Main Street, Fort Worth, TX, 76102');
    expect(coverage.getMapFeatureCategory(poiFeature, 'QT Travel Center')).toBe('gas_station');
    expect(coverage.getMapFeatureCategoryLabel(poiFeature, 'QT Travel Center')).toBe('Gas station');

    const pin = coverage.mapRenderedFeatureToNearbyPlacePin(poiFeature, fallbackLngLat);

    expect(pin).toMatchObject({
      id: 'map-feature-qt-fort-worth',
      title: 'QT Travel Center',
      kind: 'fuel',
      category: 'gas_station',
      categoryLabel: 'Gas station',
      address: '100 Main Street, Fort Worth, TX, 76102',
      photoLookupStatus: 'pending',
      sourceLabel: 'Mapbox',
    });
    expect(coverage.mapRenderedFeatureToNearbyPlacePin({
      ...poiFeature,
      layer: { id: 'road-label', type: 'symbol', 'source-layer': 'road_label' },
    }, fallbackLngLat)).toBeNull();

    const cacheKey = coverage.buildMapFeaturePlaceEnrichmentKey(pin);
    coverage.cacheMapFeaturePlaceEnrichment(cacheKey, {
      address: '  100 Main Street, Fort Worth, TX 76102  ',
      subtitle: '  Fort Worth, TX  ',
      photoUrl: '  https://images.example.com/qt.jpg  ',
      photoLookupStatus: 'complete',
      sourceLabel: ' Google Places ',
    });

    const enrichedPin = coverage.applyCachedMapFeaturePlaceEnrichment(pin);
    expect(enrichedPin).toMatchObject({
      address: '100 Main Street, Fort Worth, TX 76102',
      subtitle: 'Fort Worth, TX',
      photoUrl: 'https://images.example.com/qt.jpg',
      sourceLabel: 'Google Places',
    });
    expect(coverage.hasRealMapFeaturePlacePhoto(pin)).toBe(true);
    expect(coverage.hasSettledMapFeaturePlacePhotoLookup(pin)).toBe(true);
    expect(coverage.hasWarmMapFeaturePlaceEnrichment(pin)).toBe(true);
    expect(coverage.isCoordinateLikeAddress('32.7555, -97.3308')).toBe(true);
    expect(coverage.isUsableMapFeatureAddress('100 Main Street')).toBe(true);
    expect(coverage.isUsableMapFeatureGeocodeResult({
      precision: 'rooftop',
      formattedAddress: '100 Main Street',
    })).toBe(true);
    expect(coverage.isUsableMapFeatureGeocodeResult({
      precision: 'coordinate',
      formattedAddress: '32.7555, -97.3308',
    })).toBe(false);
    expect(coverage.isSameMapFeaturePlacePin(pin, {
      ...pin,
      id: 'different-id-same-place',
    })).toBe(true);
  });

  it('deduplicates nearby places and derives category, photo, and attribution metadata', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        showNearbyPlaces: true,
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const coffeePlace = {
      id: 'coffee-1',
      title: 'Starbucks Coffee',
      latitude: 32.7555,
      longitude: -97.3308,
      kind: 'place',
      category: 'restaurant',
      categoryLabel: 'coffee shop',
      address: '100 Main Street',
      distanceLabel: '250 m from center',
    };
    const fuelPlace = {
      id: 'fuel-1',
      title: 'Shell Fuel',
      latitude: 32.756,
      longitude: -97.331,
      kind: 'fuel',
      category: 'fuel',
      categoryLabel: 'Gas station',
      priceLabel: '$3.12',
    };

    expect(coverage.normalizePlaceCategoryText('coffee_shop', 'Fast-Food')).toBe('coffee shop fast food');
    expect(coverage.getPlaceCategoryOverride('ev charging station', 'ChargePoint')).toMatchObject({
      label: 'Gas station',
      kind: 'fuel',
    });
    expect(coverage.formatNearbyPlaceCategory(coffeePlace)).toBe('Coffee');
    expect(coverage.formatNearbyPlaceAddress(coffeePlace)).toBe('100 Main Street');
    expect(coverage.formatNearbyPlaceDistance(coffeePlace)).toBe('250 m from center');
    expect(coverage.getNearbyPlaceKind(coffeePlace)).toBe('food');
    expect(coverage.getNearbyPlaceIconName(coffeePlace)).toBe('food');
    expect(coverage.getNearbyPlaceFallbackPhotoCategory(coffeePlace)).toBe('food');
    expect(coverage.getNearbyPlaceFallbackPhotoCategory(fuelPlace)).toBe('other');
    expect(coverage.getNearbyPlaceInstantFallbackPhotoUrl(coffeePlace)).toContain('images.unsplash.com');
    expect(coverage.normalizeNearbyPlaceAttributionUrl('//maps.google.com/contrib/123')).toMatch(/^http/);
    expect(coverage.normalizeNearbyPlaceAttributionUrl('javascript:alert(1)')).toBeUndefined();
    expect(coverage.buildGoogleMapsAddressUrl(coffeePlace, coffeePlace.address)).toContain('google.com/maps/search');
    expect(coverage.buildNearbyPlaceMarkerSignature(fuelPlace)).toContain('$3.12');
    expect(coverage.mergeNearbyPlacePins([
      coffeePlace,
      { ...coffeePlace },
      fuelPlace,
    ])).toHaveLength(2);

    const searchPin = coverage.mapNearbySearchResultToPin({
      id: 'nearby-live',
      placeName: 'Costco Wholesale',
      latitude: 32.8,
      longitude: -97.4,
      categoryId: 'shopping',
      category: 'wholesale store',
      categoryLabel: 'Retail',
      formattedAddress: '200 Warehouse Way',
      source: 'scope',
      distanceKm: 0.42,
    });

    expect(searchPin).toMatchObject({
      id: 'nearby-live',
      title: 'Costco Wholesale',
      kind: 'place',
      categoryLabel: 'Shopping',
      address: '200 Warehouse Way',
      distanceLabel: '425 m from center',
    });
  });

  it('projects fallback coordinates and builds live viewport marker models', async () => {
    const wrapper = mount(MapView, {
      attachTo: document.body,
      props: {
        spots: [
          ...spots,
          {
            id: 'spot-3',
            title: 'Museum Stop',
            latitude: 32.7557,
            longitude: -97.331,
            category: 'culture',
          },
        ],
        routePoints: spots,
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const mapStore = useMapStore();
    mapStore.setCenter([-97.33, 32.7555]);
    mapStore.setZoom(12);

    const projectionBounds = coverage.buildFallbackViewportBounds();
    const projected = coverage.projectFallbackCoordinate([-97.3308, 32.7555], projectionBounds);
    const unprojected = coverage.unprojectFallbackCoordinate(projected, projectionBounds);

    expect(coverage.clampNumber(20, 1, 10)).toBe(10);
    expect(projected.x).toBeGreaterThan(0);
    expect(projected.y).toBeGreaterThan(0);
    expect(unprojected[0]).toBeCloseTo(-97.3308, 2);
    expect(unprojected[1]).toBeCloseTo(32.7555, 2);
    expect(coverage.buildRouteCoordinateRenderKey([-97.3308123, 32.7555456])).toBe('-97.33081,32.75555');
    expect(coverage.distanceBetweenFallbackPoints({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(coverage.roundMapWeatherCoordinate(32.7555456)).toBe(32.76);
    expect(coverage.mergeUniqueMapPoints(
      [spots[0]!, { ...spots[0]!, title: 'Duplicate ignored' }],
      [spots[1]!, { ...spots[1]!, id: 'invalid-spot', latitude: Number.NaN }],
    ).map((point: MapPoint) => point.id)).toEqual(['spot-1', 'spot-2']);

    const mapCanvas = wrapper.get('.map-canvas').element as HTMLElement;
    Object.defineProperty(mapCanvas, 'clientWidth', {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(mapCanvas, 'clientHeight', {
      configurable: true,
      value: 600,
    });
    const fakeMap = {
      getContainer: () => mapCanvas,
      getZoom: () => 12,
      getBounds: () => ({
        contains: () => true,
      }),
      unproject: ([x, y]: [number, number]) => ({
        lng: -97.36 + x * 0.0001,
        lat: 32.78 - y * 0.0001,
      }),
      project: ([longitude, latitude]: [number, number]) => ({
        x: (longitude + 97.36) / 0.0001,
        y: (32.78 - latitude) / 0.0001,
      }),
    };

    const viewport = coverage.buildViewport(fakeMap);
    expect(viewport).toMatchObject({
      zoom: 12,
      width: expect.any(Number),
      height: expect.any(Number),
    });
    expect(coverage.getVisibleSpotsFromViewport(fakeMap).map((point: MapPoint) => point.id)).toEqual(
      expect.arrayContaining(['spot-1', 'spot-2']),
    );

    const markerState = await coverage.buildViewportMarkerModels(fakeMap);
    expect(markerState.visibleSpotIds).toEqual(expect.arrayContaining(['spot-1', 'spot-2']));
    expect(markerState.visiblePinCount).toBeGreaterThan(0);
    expect(markerState.markers.length).toBeGreaterThan(0);

    const offscreenMarker = {
      kind: 'spot',
      id: 'offscreen',
      spot: { ...spots[0]!, longitude: -120, latitude: 45 },
      distanceLabel: null,
    };
    expect(coverage.isMarkerCoordinateInsideViewport(offscreenMarker, fakeMap, 800, 600)).toBe(false);
  });

  it('renders accessible POI markers and popups for the full nearby-place taxonomy', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        showNearbyPlaces: true,
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const cases = [
      { title: 'Downtown Police', category: 'police', kind: 'civic', label: 'Police' },
      { title: 'Main Street Pharmacy', category: 'drugstore', kind: 'health', label: 'Pharmacy' },
      { title: 'Scope Fuel', category: 'gas station', kind: 'fuel', label: 'Gas station' },
      { title: 'Cinema One', category: 'movie theater', kind: 'entertainment', label: 'Entertainment' },
      { title: 'Daily Coffee', category: 'cafe', kind: 'food', label: 'Coffee' },
      { title: 'City Museum', category: 'museum', kind: 'landmark', label: 'Museum' },
      { title: 'Scope Hotel', category: 'lodging', kind: 'lodging', label: 'Hotel' },
      { title: 'Public Parking', category: 'parking', kind: 'parking', label: 'Parking' },
      { title: 'Quick ATM', category: 'atm', kind: 'finance', label: 'ATM' },
      { title: 'Community Bank', category: 'bank', kind: 'finance', label: 'Bank' },
      { title: 'Market Square', category: 'retail store', kind: 'shopping', label: 'Shopping' },
    ];

    for (const [index, testCase] of cases.entries()) {
      const place = {
        id: `taxonomy-${index}`,
        title: testCase.title,
        latitude: 32.75 + index * 0.001,
        longitude: -97.33 - index * 0.001,
        kind: 'place',
        category: testCase.category,
        categoryLabel: testCase.category,
        address: `${100 + index} Main Street, Fort Worth, TX`,
        distanceLabel: `${index + 1} mi from center`,
      };
      const marker = coverage.buildNearbyPlaceMarkerElement(place);
      const popup = coverage.buildNearbyPlacePopupContent(place);

      expect(marker.root.dataset.placeKind, testCase.title).toBe(testCase.kind);
      expect(marker.button.getAttribute('aria-label'), testCase.title).toContain(testCase.title);
      expect(popup.textContent, testCase.title).toContain(testCase.label);
      expect(popup.querySelector('.nearby-place-popup__address')?.getAttribute('href'), testCase.title)
        .toContain('google.com/maps/search');
      expect(marker.addButton, testCase.title).not.toBeNull();
    }
  });

  it('keeps nearby-place photo attribution and pending addresses truthful', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        showNearbyPlaces: true,
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const attributedPlace = {
      id: 'nearby-attributed',
      title: 'Water Gardens',
      latitude: 32.7478,
      longitude: -97.3255,
      kind: 'place',
      category: 'park',
      categoryLabel: 'Park',
      photoUrl: 'https://images.example.com/water-gardens.jpg',
      photoAttribution: 'Scope Photographer',
      distanceLabel: '0.4 mi from center',
    };
    const attributedPopup = coverage.buildNearbyPlacePopupContent(attributedPlace);
    expect(attributedPopup.querySelector('.nearby-place-popup__attribution')?.textContent)
      .toBe('Photo: Scope Photographer');
    expect(attributedPopup.querySelector<HTMLImageElement>('[data-test="nearby-place-photo"]')?.src)
      .toBe('https://images.example.com/water-gardens.jpg');

    const pendingPlace = {
      id: 'map-feature-pending-address',
      title: 'Pending Map Place',
      latitude: 32.75,
      longitude: -97.33,
      kind: 'place',
      category: 'place',
      photoLookupStatus: 'pending',
      sourceLabel: 'Mapbox',
    };
    const pendingPopup = coverage.buildNearbyPlacePopupContent(pendingPlace, {
      deferFallbackPhoto: true,
    });
    expect(pendingPopup.classList).toContain('nearby-place-popup--without-photo');
    expect(pendingPopup.querySelector('.nearby-place-popup__address--pending')).not.toBeNull();
    expect(pendingPopup.querySelector('[data-test="nearby-place-photo"]')).toBeNull();

    const featurePopup = coverage.buildNearbyPlacePopupContent(pendingPlace, {
      deferFallbackPhoto: true,
      allowInstantFallbackPhoto: true,
      includeCloseButton: true,
    });
    expect(featurePopup.classList).not.toContain('nearby-place-popup--without-photo');
    expect(featurePopup.querySelector('[data-test="nearby-place-photo"]')).not.toBeNull();
    expect(featurePopup.querySelector<HTMLButtonElement>('[data-test="nearby-place-popup-close"]')?.textContent)
      .toBe(String.fromCharCode(215));
    expect(featurePopup.textContent).not.toContain('<span');
  });

  it('coalesces map resizes and supports explicit overlay-free repairs', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const resize = vi.fn();
    const triggerRepaint = vi.fn();
    const fakeMap = { resize, triggerRepaint };
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;
    const callbacks = new Map<number, FrameRequestCallback>();
    let nextFrame = 1;

    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      const handle = nextFrame++;
      callbacks.set(handle, callback);
      return handle;
    });
    window.cancelAnimationFrame = vi.fn((handle: number) => {
      callbacks.delete(handle);
    });

    try {
      coverage.resizeMapToContainer(undefined);
      coverage.resizeMapToContainer(fakeMap, { syncOverlays: false });
      expect(resize).toHaveBeenCalledTimes(1);
      expect(triggerRepaint).toHaveBeenCalledTimes(1);

      coverage.scheduleMapResize(fakeMap, { syncOverlays: false });
      const cancelCountAfterFirstSchedule = vi.mocked(window.cancelAnimationFrame).mock.calls.length;
      coverage.scheduleMapResize(fakeMap, { syncOverlays: false });
      expect(window.cancelAnimationFrame).toHaveBeenCalledTimes(cancelCountAfterFirstSchedule + 1);

      const scheduled = [...callbacks.values()];
      expect(scheduled).toHaveLength(1);
      scheduled[0](performance.now());
      expect(resize).toHaveBeenCalledTimes(2);
      expect(triggerRepaint).toHaveBeenCalledTimes(2);
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame;
      window.cancelAnimationFrame = originalCancelAnimationFrame;
    }
  });

  it('sizes map tile caches for low, typical, and high resource devices', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        routeVariant: 'planner',
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const memoryDescriptor = Object.getOwnPropertyDescriptor(navigator, 'deviceMemory');
    const concurrencyDescriptor = Object.getOwnPropertyDescriptor(navigator, 'hardwareConcurrency');
    const setResources = (memoryGb: number, cores: number) => {
      Object.defineProperty(navigator, 'deviceMemory', {
        configurable: true,
        value: memoryGb,
      });
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        configurable: true,
        value: cores,
      });
    };

    try {
      setResources(4, 4);
      expect(coverage.getMapTileResourceProfile()).toEqual({
        minTileCacheSize: 192,
        maxTileCacheSize: 560,
        prefetchZoomDelta: 1,
      });

      setResources(16, 12);
      expect(coverage.getMapTileResourceProfile()).toEqual({
        minTileCacheSize: 512,
        maxTileCacheSize: 1536,
        prefetchZoomDelta: 3,
      });

      setResources(8, 8);
      expect(coverage.getMapTileResourceProfile()).toEqual({
        minTileCacheSize: 384,
        maxTileCacheSize: 1120,
        prefetchZoomDelta: 3,
      });

      const enable = vi.fn();
      const setZoomRate = vi.fn();
      const setWheelZoomRate = vi.fn();
      coverage.configurePlannerMapGestureSmoothness({
        scrollZoom: { enable, setZoomRate, setWheelZoomRate },
      });
      expect(enable).toHaveBeenCalledWith({ around: 'center' });
      expect(setZoomRate).toHaveBeenCalledWith(expect.any(Number));
      expect(setWheelZoomRate).toHaveBeenCalledWith(expect.any(Number));
      expect(() => coverage.configurePlannerMapGestureSmoothness({
        get scrollZoom() {
          throw new Error('controller unavailable');
        },
      })).not.toThrow();
    } finally {
      if (memoryDescriptor) {
        Object.defineProperty(navigator, 'deviceMemory', memoryDescriptor);
      } else {
        Reflect.deleteProperty(navigator, 'deviceMemory');
      }
      if (concurrencyDescriptor) {
        Object.defineProperty(navigator, 'hardwareConcurrency', concurrencyDescriptor);
      }
    }
  });

  it('builds stable nearby-search bounds and responsive popup anchors', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        showNearbyPlaces: true,
        autoSearchNearbyPlaces: true,
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const mapContainer = wrapper.get('.map-canvas').element as HTMLElement;
    Object.defineProperty(mapContainer, 'clientWidth', { configurable: true, value: 1000 });
    Object.defineProperty(mapContainer, 'clientHeight', { configurable: true, value: 700 });

    expect([
      coverage.getNearbyPlacesLimitForZoom(15),
      coverage.getNearbyPlacesLimitForZoom(13),
      coverage.getNearbyPlacesLimitForZoom(11),
      coverage.getNearbyPlacesLimitForZoom(8),
    ]).toEqual([144, 120, 96, 72]);
    expect([
      coverage.getNearbyPlacesBoundsPaddingRatio(15),
      coverage.getNearbyPlacesBoundsPaddingRatio(13),
      coverage.getNearbyPlacesBoundsPaddingRatio(11),
      coverage.getNearbyPlacesBoundsPaddingRatio(8),
    ]).toEqual([0.18, 0.15, 0.12, 0.08]);

    const bounds = { west: -98, south: 32, east: -97, north: 33 };
    expect(coverage.expandNearbyPlaceBounds(bounds, 15)).toEqual({
      west: -98.18,
      south: 31.82,
      east: -96.82,
      north: 33.18,
    });

    const fakeMap = {
      getZoom: () => 13,
      getCenter: () => ({ lng: -97.5, lat: 32.5 }),
      getBounds: () => ({
        getWest: () => bounds.west,
        getSouth: () => bounds.south,
        getEast: () => bounds.east,
        getNorth: () => bounds.north,
      }),
      project: () => ({ x: 500, y: 350 }),
    };
    expect(coverage.getNearbyPlaceSearchBounds(fakeMap)).toEqual({
      west: -98.15,
      south: 31.85,
      east: -96.85,
      north: 33.15,
    });
    expect(coverage.buildNearbyPlacesViewportSignature(fakeMap)).toContain('-97.500');

    const invalidMap = {
      ...fakeMap,
      getBounds: () => ({
        getWest: () => -97,
        getSouth: () => 33,
        getEast: () => -98,
        getNorth: () => 32,
      }),
    };
    expect(coverage.getNearbyPlaceSearchBounds(invalidMap)).toBeNull();
    expect(coverage.buildNearbyPlacesViewportSignature(invalidMap)).toBe('');

    const place = {
      id: 'nearby-anchor',
      title: 'Anchor Place',
      latitude: 32.75,
      longitude: -97.33,
      kind: 'place',
      category: 'park',
    };
    expect(coverage.resolveMapFeaturePlacePopupAnchor({
      project: () => ({ x: 100, y: 350 }),
    }, place)).toBe('top-left');
    expect(coverage.resolveMapFeaturePlacePopupAnchor({
      project: () => ({ x: 900, y: 100 }),
    }, place)).toBe('top-right');
    expect(coverage.resolveMapFeaturePlacePopupAnchor({
      project: () => ({ x: 500, y: 650 }),
    }, place)).toBe('bottom');
    expect(coverage.resolveMapFeaturePlacePopupAnchor({
      project: () => {
        throw new Error('projection unavailable');
      },
    }, place)).toBe('bottom');
    expect(coverage.isMapFeaturePlacePopupPreciseEnough(fakeMap, place)).toBe(true);
    expect(coverage.isMapFeaturePlacePopupPreciseEnough({
      getZoom: () => 5,
    }, { ...place, id: 'map-feature-low-zoom' })).toBe(false);
    expect(coverage.canRenderNearbyPlaces(fakeMap)).toBe(false);
    expect(coverage.canAutoSearchNearbyPlaces(fakeMap)).toBe(false);
  });

  it('applies Scope fill styling across map surface layer families', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const setPaintProperty = vi.fn();
    const fakeMap = {
      getPaintProperty: vi.fn(() => undefined),
      setPaintProperty,
    };
    const layers = [
      { id: 'background', type: 'background' },
      { id: 'line-road', type: 'line' },
      { id: 'water-fill', type: 'fill' },
      { id: 'landuse-school', type: 'fill' },
      { id: 'landcover-natural', type: 'fill' },
      { id: 'sand-desert', type: 'fill' },
      { id: 'national-park', type: 'fill' },
      { id: 'building-fill', type: 'fill' },
    ];

    for (const layer of layers) {
      coverage.applyScopeFillPresentation(fakeMap, layer, layer.id);
    }

    expect(setPaintProperty).toHaveBeenCalledWith('background', 'background-color', expect.anything());
    expect(setPaintProperty).toHaveBeenCalledWith('water-fill', 'fill-color', expect.anything());
    expect(setPaintProperty).toHaveBeenCalledWith('landuse-school', 'fill-opacity', expect.anything());
    expect(setPaintProperty).toHaveBeenCalledWith('landcover-natural', 'fill-color', expect.anything());
    expect(setPaintProperty).toHaveBeenCalledWith('sand-desert', 'fill-opacity', expect.anything());
    expect(setPaintProperty).toHaveBeenCalledWith('building-fill', 'fill-color', 'rgb(45, 53, 58)');
  });
});
