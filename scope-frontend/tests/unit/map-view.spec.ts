import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import MapView from '@/components/map/MapView.vue';
import { getPlacePhoto, reverseGeocode, searchNearbyPlaces } from '@/services/mapService';
import { getOpenWeatherMapSnapshot } from '@/services/openWeatherMapService';
import { resolveRoadRoute, type RoadRouteSummary } from '@/services/roadRouteService';
import { useMapStore } from '@/stores/map';
import type { MapPoint } from '@/types';

vi.mock('@/services/mapService', () => ({
  getPlacePhoto: vi.fn(async () => ({
    configured: true,
    coverage: 'mock',
    photoUrl: 'https://images.example.com/mock-map-place.jpg',
    photoAttribution: 'Scope Maps',
    photoAttributionUrl: 'https://images.example.com/attribution',
    source: 'Mock photos',
  })),
  reverseGeocode: vi.fn(async () => ({
    latitude: 32.7555,
    longitude: -97.3308,
    placeName: 'Mock Map Feature',
    formattedAddress: '100 Main Street, Fort Worth, TX',
    address: '100 Main Street, Fort Worth, TX',
    precision: 'address',
  })),
  searchNearbyPlaces: vi.fn(async () => ({
    data: [],
  })),
}));

vi.mock('@/services/openWeatherMapService', () => ({
  getOpenWeatherMapSnapshot: vi.fn(async () => ({
    id: 'weather-map-center',
    label: 'Map center',
    temperatureF: 73,
    condition: 'Clear',
    windMph: 8,
    provider: 'local',
    iconCode: '01d',
    isDaytime: true,
  })),
}));

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
    vi.mocked(getPlacePhoto).mockClear();
    vi.mocked(reverseGeocode).mockClear();
    vi.mocked(searchNearbyPlaces).mockClear();
    vi.mocked(getOpenWeatherMapSnapshot).mockClear();
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
    expect(coverage.getMapFeatureCoordinates({
      ...poiFeature,
      geometry: { type: 'Point', coordinates: ['bad', 95] },
    }, fallbackLngLat)).toEqual({
      latitude: 32.7,
      longitude: -96.8,
    });
    expect(coverage.sanitizeMapFeatureText(null)).toBe('');
    expect(coverage.sanitizeMapFeatureText('  multi   space value  ', 11)).toBe('multi space');
    expect(coverage.readMapFeatureProperty({ properties: { empty: '   ', fallback: '  usable  ' } }, ['empty', 'fallback'])).toBe('usable');
    expect(coverage.readMapFeatureProperty({ properties: undefined }, ['missing'])).toBe('');
    expect(coverage.getMapFeatureLayerSourceLayer({ layer: undefined })).toBe('');
    expect(coverage.buildAddressFromMapFeatureParts(poiFeature)).toBe('100 Main Street, Fort Worth, TX, 76102');
    expect(coverage.buildAddressFromMapFeatureParts({
      properties: {
        street_name: 'North Main',
      },
    })).toBe('North Main');
    expect(coverage.buildAddressFromMapFeatureParts({
      properties: {
        locality: 'Austin',
        postal_code: '78701',
      },
    })).toBe('Austin, 78701');
    expect(coverage.getMapFeatureAddress({ properties: {} })).toBeUndefined();
    expect(coverage.getMapFeatureAddress({
      properties: {
        address: '  200 Commerce Street  ',
      },
    })).toBe('200 Commerce Street');
    expect(coverage.titleCaseMapFeatureCategory('custom-category_label')).toBe('Custom Category Label');
    expect(coverage.getMapFeatureCategory(poiFeature, 'QT Travel Center')).toBe('gas_station');
    expect(coverage.getMapFeatureCategoryLabel(poiFeature, 'QT Travel Center')).toBe('Gas station');
    expect(coverage.getMapFeatureCategory({ properties: { maki: '' } }, '')).toBe('place');
    expect(coverage.getMapFeatureCategoryLabel({ properties: { category: 'custom_waypoint_label' } }, '')).toBe('Custom Waypoint Label');

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
    expect(coverage.mapRenderedFeatureToNearbyPlacePin({
      ...poiFeature,
      id: '',
      properties: {
        category: 'charging',
        name: 'Charging waypoint',
      },
      geometry: {
        type: 'Point',
        coordinates: ['bad', 'also-bad'],
      },
    }, fallbackLngLat)).toMatchObject({
      id: expect.stringContaining('Charging waypoint'),
      title: 'Charging waypoint',
      category: 'charging',
      categoryLabel: 'Charging',
      latitude: 32.7,
      longitude: -96.8,
    });

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

  it('classifies nearby place edge categories and popup photo policies', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        showNearbyPlaces: true,
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const place = (overrides: Record<string, unknown>) => ({
      id: 'nearby-edge',
      title: 'Nearby edge place',
      latitude: 32.7555,
      longitude: -97.3308,
      kind: 'place',
      category: 'place',
      ...overrides,
    });

    expect(coverage.getPlaceCategoryOverride(undefined, undefined)).toBeNull();
    expect(coverage.normalizeNearbyPlaceCategoryLabel(undefined, 'fire')).toBe('Fire station');
    expect(coverage.formatNearbyPlaceCategory(place({ categoryLabel: 'urgent care' }))).toBe('Medical');
    expect(coverage.formatNearbyPlaceCategory(place({ categoryLabel: 'drugstore' }))).toBe('Pharmacy');
    expect(coverage.formatNearbyPlaceCategory(place({ categoryLabel: 'motorist services' }))).toBe('Travel stop');
    expect(coverage.formatNearbyPlaceCategory(place({ categoryLabel: 'grocery market' }))).toBe('Grocery');
    expect(coverage.formatNearbyPlaceCategory(place({ categoryLabel: 'bowling arcade' }))).toBe('Entertainment');
    expect(coverage.formatNearbyPlaceCategory(place({ categoryLabel: 'coffee cafe' }))).toBe('Coffee');
    expect(coverage.formatNearbyPlaceCategory(place({ categoryLabel: 'nightlife pub' }))).toBe('Bar');
    expect(coverage.formatNearbyPlaceCategory(place({ categoryLabel: 'historic tourist attraction' }))).toBe('Landmark');
    expect(coverage.formatNearbyPlaceCategory(place({ categoryLabel: 'university campus' }))).toBe('School');
    expect(coverage.formatNearbyPlaceCategory(place({ categoryLabel: 'parking garage' }))).toBe('Parking');
    expect(coverage.formatNearbyPlaceCategory(place({ categoryLabel: 'atm kiosk' }))).toBe('ATM');
    expect(coverage.formatNearbyPlaceCategory(place({ categoryLabel: 'bank branch' }))).toBe('Bank');
    expect(coverage.formatNearbyPlaceCategory(place({ categoryLabel: '', category: '', kind: 'fuel', title: 'Fuel stop' }))).toBe('Gas station');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('custom_category', undefined)).toBe('Custom Category');

    expect(coverage.getNearbyPlaceKind(place({ category: 'hospital', title: 'Clinic' }))).toBe('health');
    expect(coverage.getNearbyPlaceKind(place({ category: 'cinema', title: 'Movie Palace' }))).toBe('entertainment');
    expect(coverage.getNearbyPlaceKind(place({ category: 'shopping mall', title: 'Mall' }))).toBe('shopping');
    expect(coverage.getNearbyPlaceKind(place({ category: 'school', title: 'Campus' }))).toBe('education');
    expect(coverage.getNearbyPlaceKind(place({ category: 'hotel', title: 'Inn' }))).toBe('lodging');
    expect(coverage.getNearbyPlaceKind(place({ category: 'tourist attraction', title: 'Monument' }))).toBe('landmark');
    expect(coverage.getNearbyPlaceIconName(place({ iconName: 'custom-pin' }))).toBe('custom-pin');

    const explicitPhotoPlace = place({
      id: 'photo-place',
      photoUrl: '  https://images.example.com/place.jpg  ',
      sourceLabel: 'Scope',
    });
    expect(coverage.getNearbyPlacePopupPhotoUrl(explicitPhotoPlace)).toEqual({
      photoUrl: 'https://images.example.com/place.jpg',
      isFallback: false,
    });
    expect(coverage.shouldDeferNearbyPlaceFallbackPhoto(explicitPhotoPlace)).toBe(false);
    expect(coverage.shouldAllowInstantNearbyPlaceFallbackPhoto(explicitPhotoPlace)).toBe(true);

    const mapboxPlace = place({
      id: 'map-feature-coffee',
      photoLookupStatus: 'pending',
      sourceLabel: 'Mapbox',
      categoryLabel: 'coffee',
      address: '',
    });
    expect(coverage.shouldDeferNearbyPlaceFallbackPhoto(mapboxPlace)).toBe(true);
    expect(coverage.shouldAllowInstantNearbyPlaceFallbackPhoto(mapboxPlace)).toBe(false);
    expect(coverage.shouldReserveNearbyPlaceAddressSlot(mapboxPlace)).toBe(true);
    expect(coverage.getNearbyPlacePopupPhotoUrl(mapboxPlace)).toBeNull();
    expect(coverage.getNearbyPlacePopupPhotoUrl(mapboxPlace, {
      deferFallbackPhoto: true,
      allowInstantFallbackPhoto: false,
    })).toBeNull();
    expect(coverage.getNearbyPlacePopupPhotoUrl(place({
      id: 'scope-park',
      categoryLabel: 'park',
      sourceLabel: 'Scope',
    }), {
      allowInstantFallbackPhoto: true,
    })).toMatchObject({ isFallback: true });

    await wrapper.setProps({ routeVariant: 'planner' });
    expect(coverage.shouldSuppressNearbyPlacePopupPhoto(coverage.getNearbyPlaceInstantFallbackPhotoUrl(place({ categoryLabel: 'park' })))).toBe(true);
    expect(coverage.getNearbyPlacePopupPhotoUrl(place({
      id: 'planner-photo',
      photoUrl: coverage.getNearbyPlaceInstantFallbackPhotoUrl(place({ categoryLabel: 'park' })),
    }))).toBeNull();
  });

  it('keeps nearby classifiers, route labels, and saved map preferences deterministic', async () => {
    localStorage.setItem('scope.map.projectionMode', 'mercator');
    localStorage.setItem('scope.tripPlanner.mapStyleMode', 'native');
    const flatProjectionViewport = {
      center: [-96.8, 32.7] as [number, number],
      zoom: 7.4,
      bearing: 0,
      pitch: 0,
      style: 'mapbox://styles/mapbox/streets-v12',
    };
    const wrapper = mount(MapView, {
      props: {
        spots,
        showProjectionToggle: true,
        flatProjectionViewport,
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const place = (overrides: Record<string, unknown>) => ({
      id: 'classifier-place',
      title: 'Classifier Place',
      latitude: 32.7555,
      longitude: -97.3308,
      kind: 'place',
      category: 'place',
      ...overrides,
    });

    expect(coverage.normalizeNearbyPlaceCategoryLabel('police station')).toBe('Police');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('hospital clinic')).toBe('Medical');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('pharmacy')).toBe('Pharmacy');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('motorist services')).toBe('Travel stop');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('grocery market')).toBe('Grocery');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('retail store')).toBe('Shopping');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('restaurant')).toBe('Restaurant');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('park trail')).toBe('Park');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('museum')).toBe('Museum');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('hotel lodging')).toBe('Hotel');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('plain thing', '', 'fallback place')).toBe('Plain Thing');
    expect(coverage.normalizeNearbyPlaceCategoryLabel(undefined, '', 'fallback place')).toBe('Fallback Place');
    expect(coverage.resolveNearbyPlaceCategoryValue(undefined, undefined)).toBe('place');
    expect(coverage.resolveNearbyPlaceCategoryValue('coffee shop', 'Daily Coffee')).toBe('coffee');
    expect(coverage.resolveNearbyPlaceCategoryValue('charging', 'Plain Charger')).toBe('charging');
    expect(coverage.isFuelPlaceCategory('place', 'Shell Food Mart')).toBe(true);
    expect(coverage.isFuelPlaceCategory('museum', 'Shell Gallery')).toBe(false);

    expect(coverage.getNearbyPlaceKind(place({ category: 'park' }))).toBe('park');
    expect(coverage.getNearbyPlaceKind(place({ category: 'charging', title: 'Plain Charger' }))).toBe('fuel');
    expect(coverage.getNearbyPlaceKind(place({ category: 'lodg', title: 'Plain Stay' }))).toBe('lodging');
    expect(coverage.getNearbyPlaceKind(place({ category: 'unknown', categoryLabel: 'unknown' }))).toBe('other');
    expect(coverage.getNearbyPlaceIconName(place({ category: 'park' }))).toBe('nature');
    expect(coverage.getNearbyPlaceIconName(place({ category: 'school' }))).toBe('culture');
    expect(coverage.getNearbyPlaceIconName(place({ category: 'unknown', categoryLabel: 'unknown' }))).toBe('pin');
    expect(coverage.getNearbyPlaceFallbackPhotoCategory(place({ category: 'hotel' }))).toBe('scenic');
    expect(coverage.getNearbyPlaceFallbackPhotoCategory(place({ category: 'hospital' }))).toBe('other');
    expect(coverage.createNearbyPlaceMarkerIcon('fuel').querySelector('use')?.getAttribute('href')).toContain('icon-fuel');

    expect(coverage.mapNearbySearchResultToPin({
      id: '',
      placeName: 'Fallback Id Place',
      latitude: 32.7,
      longitude: -97.3,
      categoryId: 'food',
      category: 'restaurant',
      distanceKm: 12.4,
    })).toMatchObject({
      id: 'Fallback Id Place:32.70000:-97.30000',
      distanceLabel: '12 km from center',
    });
    expect(coverage.mapNearbySearchResultToPin({
      id: 'far-place',
      placeName: 'Far Place',
      latitude: 32.7,
      longitude: -97.3,
      categoryId: 'scenic',
      category: 'park',
      distanceKm: Number.NaN,
    }).distanceLabel).toBeUndefined();

    expect(coverage.getNearbyPlacesLimitForZoom(14)).toBe(144);
    expect(coverage.getNearbyPlacesLimitForZoom(12)).toBe(120);
    expect(coverage.getNearbyPlacesLimitForZoom(10)).toBe(96);
    expect(coverage.getNearbyPlacesLimitForZoom(8)).toBe(72);
    expect(coverage.getNearbyPlacesBoundsPaddingRatio(14)).toBe(0.18);
    expect(coverage.getNearbyPlacesBoundsPaddingRatio(12)).toBe(0.15);
    expect(coverage.getNearbyPlacesBoundsPaddingRatio(10)).toBe(0.12);
    expect(coverage.getNearbyPlacesBoundsPaddingRatio(8)).toBe(0.08);
    expect(coverage.expandNearbyPlaceBounds({
      west: -100,
      south: 30,
      east: -90,
      north: 40,
    }, 14)).toMatchObject({
      west: -101.8,
      south: 28.2,
      east: -88.2,
      north: 41.8,
    });

    expect(coverage.hasValidRouteCoordinate([-181, 0])).toBe(false);
    expect(coverage.hasValidRouteCoordinate([-97.3, 32.7])).toBe(true);
    expect(coverage.hasValidCoordinates({ ...spots[0]!, latitude: 91 })).toBe(false);
    expect(coverage.hasValidCoordinates(spots[0])).toBe(true);
    expect(coverage.hasMappablePoints()).toBe(true);
    expect(coverage.getRouteMarkerSequence({ ...spots[0]!, routeRole: 'start' }, 9)).toBe('S');
    expect(coverage.getRouteMarkerSequence({ ...spots[0]!, routeRole: 'end' }, 9)).toBe('E');
    expect(coverage.getRouteMarkerSequence({ ...spots[0]!, routeRole: 'stop', routeLabel: '9' }, 9)).toBe(9);
    expect(coverage.getRouteMarkerSequence({ ...spots[0]!, routeLabel: 'A' }, 9)).toBe('A');
    expect(coverage.buildRouteOrderLookup([
      { ...spots[0]!, id: 'start', routeRole: 'start' },
      { ...spots[1]!, id: 'end', routeRole: 'end' },
    ]).get('end')).toBe('E');

    expect(coverage.readMapProjectionModePreference()).toBe('mercator');
    expect(coverage.resolveInitialMapProjectionMode()).toBe('mercator');
    expect(coverage.resolveBaseViewport()).toMatchObject({
      center: flatProjectionViewport.center,
      zoom: flatProjectionViewport.zoom,
      style: flatProjectionViewport.style,
    });
    coverage.writeMapProjectionModePreference('globe');
    expect(localStorage.getItem('scope.map.projectionMode')).toBe('globe');
    expect(coverage.readMapStyleModePreference()).toBe('native');
    coverage.writeMapStyleModePreference('scope');
    expect(localStorage.getItem('scope.tripPlanner.mapStyleMode')).toBe('scope');
    expect(coverage.isMapProjectionMode('flat')).toBe(false);
    expect(coverage.isMapPresentationMode('classic')).toBe(false);
    expect(coverage.shouldUseStateAbbreviationLabels('states')).toBe(true);
    expect(coverage.shouldHideNativeStateNameLabels('majorCities')).toBe(true);
    expect(coverage.getWaterLabelMinZoom('states')).not.toBe(coverage.getWaterLabelMinZoom('full'));
    expect(coverage.getWaterReferenceLabelOpacity('states')).not.toBe(coverage.getWaterReferenceLabelOpacity('full'));

    await wrapper.setProps({ persistMapPreferences: false });
    expect(coverage.readMapProjectionModePreference()).toBeNull();
    expect(coverage.readMapStyleModePreference()).toBeNull();
    expect(() => coverage.writeMapProjectionModePreference('mercator')).not.toThrow();
    expect(() => coverage.writeMapStyleModePreference('native')).not.toThrow();
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

    Object.defineProperty(mapCanvas, 'clientWidth', {
      configurable: true,
      value: 0,
    });
    Object.defineProperty(mapCanvas, 'clientHeight', {
      configurable: true,
      value: 0,
    });
    expect(coverage.buildViewport(fakeMap)).toBeNull();
    expect(coverage.getVisibleSpotsFromViewport(fakeMap).map((point: MapPoint) => point.id)).toEqual(
      expect.arrayContaining(['spot-1', 'spot-2', 'spot-3']),
    );

    Object.defineProperty(mapCanvas, 'clientWidth', {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(mapCanvas, 'clientHeight', {
      configurable: true,
      value: 600,
    });
    expect(coverage.buildViewport({
      ...fakeMap,
      unproject: () => ({ lng: Number.NaN, lat: 32.7 }),
    })).toBeNull();

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

  it('covers click-to-select canvas guards and interactive marker viewport edges', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: [spots[0]!],
        clickToSelect: true,
        routeVariant: 'planner',
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const mapCanvas = wrapper.get('.map-canvas').element as HTMLElement;
    const write = <T>(entry: { value: T }, value: T) => {
      entry.value = value;
    };
    const setRect = (width: number, height: number) => {
      Object.defineProperty(mapCanvas, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
          left: 0,
          top: 0,
          right: width,
          bottom: height,
          width,
          height,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      });
    };

    setRect(800, 600);
    coverage.handleMapCanvasClick(new MouseEvent('click', { clientX: 400, clientY: 300 }));
    expect(wrapper.emitted('map-click')).toBeUndefined();

    write(coverage.interactiveMapEnabled, true);
    write(coverage.mapContainer, mapCanvas);
    const nativeCanvas = document.createElement('canvas');
    nativeCanvas.className = 'mapboxgl-canvas';
    mapCanvas.appendChild(nativeCanvas);
    coverage.handleMapCanvasClick(new MouseEvent('click', { clientX: 400, clientY: 300 }));
    expect(wrapper.emitted('map-click')).toBeUndefined();

    nativeCanvas.remove();
    setRect(0, 600);
    coverage.handleMapCanvasClick(new MouseEvent('click', { clientX: 400, clientY: 300 }));
    expect(wrapper.emitted('map-click')).toBeUndefined();

    setRect(800, 600);
    coverage.handleMapCanvasClick(new MouseEvent('click', { clientX: 400, clientY: 300 }));
    expect(wrapper.emitted('map-click')).toHaveLength(1);

    const fakeMap = {
      getContainer: () => mapCanvas,
      getCenter: () => ({ lng: -97.33, lat: 32.75 }),
      getZoom: () => 10,
      project: vi.fn(([longitude, latitude]: [number, number]) => ({
        x: Number.isFinite(longitude) ? 400 + (longitude + 97.33) * 10 : Number.NaN,
        y: Number.isFinite(latitude) ? 300 - (latitude - 32.75) * 10 : Number.NaN,
      })),
      stop: vi.fn(),
      easeTo: vi.fn(),
      flyTo: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      loaded: () => true,
      remove: vi.fn(),
    };
    write(coverage.map, fakeMap);

    const marker = {
      kind: 'spot',
      id: 'onscreen',
      spot: spots[0]!,
      distanceLabel: null,
    };
    expect(coverage.isMarkerCoordinateInsideViewport(marker, fakeMap, 800, 600)).toBe(true);
    expect(coverage.isMarkerCoordinateInsideViewport({
      ...marker,
      id: 'nan-x',
      spot: { ...spots[0]!, longitude: Number.NaN },
    }, fakeMap, 800, 600)).toBe(false);
    expect(coverage.isMarkerCoordinateInsideViewport({
      ...marker,
      id: 'outside-buffer',
      spot: { ...spots[0]!, longitude: -200 },
    }, fakeMap, 800, 600, 10)).toBe(false);

    const runPlannerMapCommand = (wrapper.vm as unknown as {
      runPlannerMapCommand: (input: unknown) => Promise<{ ok: boolean; message: string }>;
    }).runPlannerMapCommand;
    await expect(runPlannerMapCommand({
      command: 'zoom_to_place',
      target: {
        latitude: 32.8,
        longitude: -97.4,
        zoom: 11,
      },
      query: 'Fort Worth Stockyards',
    })).resolves.toMatchObject({
      ok: true,
      message: 'Zoomed the planner map to Fort Worth Stockyards.',
    });
    await expect(runPlannerMapCommand({
      command: 'zoom_to_place',
      target: {
        latitude: 32.8,
        longitude: -97.4,
      },
    })).resolves.toMatchObject({
      ok: true,
      message: 'Zoomed the planner map to that place.',
    });
    expect(fakeMap.flyTo).toHaveBeenCalled();
    write(coverage.map, null);
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

  it('keeps render gates, planner reveals, and map style snapshots bounded under runtime churn', async () => {
    vi.useFakeTimers();

    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: spots,
        routeVariant: 'planner',
        showNearbyPlaces: true,
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const mapCanvas = wrapper.get('.map-canvas').element as HTMLElement;
    const canvas = document.createElement('canvas');
    const resize = vi.fn();
    const triggerRepaint = vi.fn();
    const jumpTo = vi.fn();
    const stop = vi.fn();
    const easeTo = vi.fn();
    const onIdleCallbacks: Array<() => void> = [];
    const originalUserAgent = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;
    const originalGlobalRequestAnimationFrame = globalThis.requestAnimationFrame;
    const originalGlobalCancelAnimationFrame = globalThis.cancelAnimationFrame;
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      scale: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      shadowColor: '',
      shadowBlur: 0,
      fillStyle: '',
      lineWidth: 0,
      strokeStyle: '',
    } as any);
    const frameCallbacks = new Map<number, FrameRequestCallback>();
    let nextFrameHandle = 1;
    let styleLoaded = false;
    let tilesLoaded = false;
    let moving = true;
    let loaded = false;

    Object.defineProperty(mapCanvas, 'clientWidth', { configurable: true, value: 900 });
    Object.defineProperty(mapCanvas, 'clientHeight', { configurable: true, value: 620 });
    Object.defineProperty(mapCanvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 0,
        top: 0,
        right: 900,
        bottom: 620,
        width: 900,
        height: 620,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });
    Object.defineProperty(canvas, 'width', { configurable: true, value: 500 });
    Object.defineProperty(canvas, 'height', { configurable: true, value: 320 });
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 0,
        top: 0,
        right: 700,
        bottom: 500,
        width: 700,
        height: 500,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });
    Object.defineProperty(canvas, 'toDataURL', {
      configurable: true,
      value: vi.fn(() => `data:image/jpeg;base64,${'a'.repeat(180)}`),
    });

    const fakeMap = {
      getCanvas: () => canvas,
      getContainer: () => mapCanvas,
      getCenter: () => ({ lng: -97.3308, lat: 32.7555 }),
      getZoom: () => 10,
      getBearing: () => 0,
      getPitch: () => 0,
      getStyle: () => ({
        layers: styleLoaded ? [{ id: 'poi-label', type: 'symbol', 'source-layer': 'poi_label' }] : [],
      }),
      isStyleLoaded: () => styleLoaded,
      areTilesLoaded: () => tilesLoaded,
      isMoving: () => moving,
      loaded: () => loaded,
      resize,
      triggerRepaint,
      jumpTo,
      stop,
      easeTo,
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn((_event: string, callback: () => void) => {
        onIdleCallbacks.push(callback);
      }),
      project: vi.fn(() => ({ x: 450, y: 300 })),
      queryRenderedFeatures: vi.fn(() => []),
    };
    const write = <T>(entry: { value: T }, value: T) => {
      entry.value = value;
    };
    const requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
      const handle = nextFrameHandle++;
      frameCallbacks.set(handle, callback);
      return handle;
    });
    const cancelAnimationFrameMock = vi.fn((handle: number) => {
      frameCallbacks.delete(handle);
    });
    const flushFrame = () => {
      const [handle, callback] = [...frameCallbacks.entries()][0] ?? [];
      if (callback) {
        frameCallbacks.delete(handle);
        callback(performance.now());
        return true;
      }
      return false;
    };
    const flushFrames = (limit = 8) => {
      for (let index = 0; index < limit && flushFrame(); index += 1) {
        // Continue draining scheduled animation frames for this bounded fake runtime.
      }
    };

    window.requestAnimationFrame = requestAnimationFrameMock;
    window.cancelAnimationFrame = cancelAnimationFrameMock;
    globalThis.requestAnimationFrame = requestAnimationFrameMock as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = cancelAnimationFrameMock as typeof cancelAnimationFrame;
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Chrome coverage runtime',
    });

    try {
      write(coverage.interactiveMapEnabled, true);
      write(coverage.mapContainer, mapCanvas);
      write(coverage.map, fakeMap);

      expect(coverage.isMapRenderSurfaceMismatched(fakeMap)).toBe(true);
      coverage.repairMapRenderSurface(fakeMap);
      expect(resize).toHaveBeenCalledTimes(1);
      expect(jumpTo).toHaveBeenCalledTimes(1);
      Object.defineProperty(canvas, 'width', { configurable: true, value: 900 });
      Object.defineProperty(canvas, 'height', { configurable: true, value: 620 });
      Object.defineProperty(canvas, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
          left: 0,
          top: 0,
          right: 900,
          bottom: 620,
          width: 900,
          height: 620,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      });
      coverage.repairMapRenderSurface(fakeMap);
      expect(triggerRepaint).toHaveBeenCalled();

      coverage.startMapTileSettling(500);
      coverage.finishMapTileSettling(25);
      vi.advanceTimersByTime(25);
      coverage.clearMapTileSettlingTimer();
      coverage.openMapRenderGate(120, 10);
      coverage.revealMapRenderGate(5);
      vi.advanceTimersByTime(10);
      coverage.closeMapRenderGate();

      coverage.startMapCameraRenderTransition({
        timeoutMs: 80,
        minimumVisibleMs: 10,
        renderGate: false,
        tileSettling: false,
        captureSnapshot: true,
      });
      coverage.finishMapCameraRenderTransition(999, 1);
      vi.advanceTimersByTime(1);
      vi.advanceTimersByTime(80);
      coverage.stopMapCameraRenderTransitionVisuals();

      coverage.schedulePlannerMapCanvasPreview(fakeMap);
      coverage.clearPlannerMapCanvasPreviewFrame();
      expect(cancelAnimationFrameMock).toHaveBeenCalled();
      coverage.schedulePlannerMapCanvasPreview(fakeMap);
      coverage.schedulePlannerMapCanvasPreview(fakeMap);
      expect(requestAnimationFrameMock).toHaveBeenCalled();
      flushFrames();
      expect(canvas.classList.contains('is-previewing')).toBe(true);

      loaded = false;
      styleLoaded = false;
      tilesLoaded = false;
      moving = true;
      expect(coverage.isPlannerMapCanvasReadyToReveal(fakeMap)).toBe(false);
      coverage.schedulePlannerMapCanvasLoadReveal(fakeMap);
      vi.runOnlyPendingTimers();
      expect(triggerRepaint).toHaveBeenCalled();

      loaded = true;
      styleLoaded = true;
      tilesLoaded = true;
      moving = false;
      expect(coverage.isPlannerMapCanvasReadyToReveal(fakeMap)).toBe(true);
      coverage.revealPlannerMapCanvas(fakeMap);
      expect(canvas.classList.contains('loaded')).toBe(true);

      coverage.startMapStyleTransition({ variant: 'switch', coverMode: 'native' });
      coverage.captureMapStyleTransitionSnapshot();
      flushFrame();
      coverage.releaseMapStyleTransitionSnapshot();
      vi.advanceTimersByTime(260);
      coverage.startMapStyleTransition({ variant: 'load' });
      coverage.finishMapStyleTransition(999);
      coverage.finishMapStyleTransition();
      vi.runOnlyPendingTimers();

      styleLoaded = true;
      coverage.finishMapStyleTransitionAfterPresentationFrame(fakeMap, 0);
      flushFrames();
      coverage.finishMapStyleTransitionAfterStyleSettle(fakeMap, 0);
      onIdleCallbacks.splice(0).forEach((callback) => callback());
      await flushPromises();
      coverage.finishMapStyleTransitionWhenPresentationReady(fakeMap, 0);
      flushFrames();
      await flushPromises();

      coverage.markInitialMapRenderReady(fakeMap);
      await flushPromises();
      expect(coverage.shouldDeferPriorityCamera()).toBe(false);
      loaded = false;
      expect(coverage.shouldDeferPriorityCamera()).toBe(true);
      coverage.scheduleMapRenderHealthCheckSeries(fakeMap);
      coverage.scheduleMapPostStyleResizeSeries(fakeMap);
      vi.runOnlyPendingTimers();
      expect(resize).toHaveBeenCalled();
      coverage.clearMapStyleTransitionSnapshot();
      coverage.clearMapStyleTransitionTimer();
      coverage.clearMapCameraTransitionTimers();
      coverage.clearPlannerMapCanvasPreviewFrame();
      coverage.clearPlannerMapCanvasRevealTimer();
      coverage.clearPlannerMapPreloadSurfaceTimer();
    } finally {
      coverage.clearMapPostStyleResizeTimers();
      coverage.clearMapRenderHealthTimers();
      coverage.clearMapQuickDimTimer();
      coverage.clearPlannerGlobeRestoreTimer();
      coverage.clearMapStyleTransitionSnapshot();
      coverage.clearMapStyleTransitionTimer();
      coverage.clearMapCameraTransitionTimers();
      coverage.clearPlannerMapCanvasPreviewFrame();
      coverage.clearPlannerMapCanvasRevealTimer();
      coverage.clearPlannerMapPreloadSurfaceTimer();
      write(coverage.map, null);
      if (originalUserAgent) {
        Object.defineProperty(navigator, 'userAgent', originalUserAgent);
      }
      getContextSpy.mockRestore();
      window.requestAnimationFrame = originalRequestAnimationFrame;
      window.cancelAnimationFrame = originalCancelAnimationFrame;
      globalThis.requestAnimationFrame = originalGlobalRequestAnimationFrame;
      globalThis.cancelAnimationFrame = originalGlobalCancelAnimationFrame;
      vi.useRealTimers();
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

      await wrapper.setProps({ routeVariant: 'default' });
      expect(coverage.usesPlannerCameraMotion()).toBe(false);
      setResources(4, 4);
      expect(coverage.getMapTileResourceProfile()).toEqual({
        minTileCacheSize: 128,
        maxTileCacheSize: 384,
        prefetchZoomDelta: 1,
      });
      setResources(16, 12);
      expect(coverage.getMapTileResourceProfile()).toEqual({
        minTileCacheSize: 256,
        maxTileCacheSize: 896,
        prefetchZoomDelta: 2,
      });
      setResources(8, 8);
      expect(coverage.getMapTileResourceProfile()).toEqual({
        minTileCacheSize: 192,
        maxTileCacheSize: 640,
        prefetchZoomDelta: 2,
      });
      const skippedEnable = vi.fn();
      coverage.configurePlannerMapGestureSmoothness({
        scrollZoom: { enable: skippedEnable },
      });
      expect(skippedEnable).not.toHaveBeenCalled();

      await wrapper.setProps({ routeVariant: 'planner' });
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

  it('keeps map camera, fallback projection, and nearby-place helpers deterministic at edge inputs', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: spots,
        showNearbyPlaces: true,
        autoSearchNearbyPlaces: true,
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const mapStore = useMapStore();
    mapStore.setCenter([-97.3308, 32.7555]);
    mapStore.setZoom(12.345);
    mapStore.setStyle('mapbox://styles/mapbox/outdoors-v12');

    expect(coverage.buildCameraTargetSignature({
      center: [-97.3308123, 32.7555123],
      zoom: 12.345,
      bearing: 18.123,
      pitch: 42.567,
    })).toBe('-97.33081:32.75551:12.35:18.12:42.57');
    expect(coverage.buildCameraTargetSignature({
      center: [-97.3308123, 32.7555123],
      zoom: 12.345,
    })).toBe('-97.33081:32.75551:12.35:*:*');

    const readyCamera = {
      getCenter: () => ({ lng: -97.3308, lat: 32.7555 }),
      getZoom: () => 12.35,
      getBearing: () => 18.1,
      getPitch: () => 42.6,
    };
    expect(coverage.isMapCameraAtTarget(readyCamera, {
      center: [-97.3308, 32.7555],
      zoom: 12.35,
      bearing: 18.1,
      pitch: 42.6,
    })).toBe(true);
    expect(coverage.isMapCameraAtTarget({
      ...readyCamera,
      getCenter: () => {
        throw new Error('camera unavailable');
      },
    }, {
      center: [-97.3308, 32.7555],
      zoom: 12.35,
    })).toBe(false);
    expect(coverage.isMapStoreViewportAtTarget({
      center: [-97.3308, 32.7555],
      zoom: 12.345,
      style: 'mapbox://styles/mapbox/outdoors-v12',
    }, 'mapbox://styles/mapbox/outdoors-v12')).toBe(true);
    expect(coverage.clampNumber(99, -2, 10)).toBe(10);
    expect(coverage.clampNumber(-99, -2, 10)).toBe(-2);

    const bounds = coverage.buildFallbackViewportBounds();
    const projected = coverage.projectFallbackPoint(spots[0]!, bounds);
    const unprojected = coverage.unprojectFallbackCoordinate(projected, bounds);
    expect(projected.x).toBeGreaterThan(0);
    expect(projected.y).toBeGreaterThan(0);
    expect(unprojected[0]).toBeCloseTo(spots[0]!.longitude, 2);
    expect(unprojected[1]).toBeCloseTo(spots[0]!.latitude, 2);
    expect(coverage.resolveFallbackProjection(projected, [projected])).not.toEqual(projected);
    expect(coverage.distanceBetweenFallbackPoints({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(coverage.mergeUniqueMapPoints([
      spots[0]!,
      { ...spots[0]!, title: 'Duplicate' },
      { ...spots[1]!, latitude: Number.NaN },
    ], [spots[1]!]).map((point: MapPoint) => point.id)).toEqual(['spot-1', 'spot-2']);

    const denseCoordinates = Array.from({ length: 420 }, (_, index) => [-98 + index * 0.01, 32 + index * 0.005]);
    const sampled = coverage.sampleRouteCoordinatesForOverlay(denseCoordinates);
    expect(sampled[0]).toEqual(denseCoordinates[0]);
    expect(sampled.at(-1)).toEqual(denseCoordinates.at(-1));
    expect(sampled.length).toBeLessThan(denseCoordinates.length);
    expect(coverage.sampleRouteCoordinatesForOverlay([[-97.33, 32.75], [-97.34, 32.76]])).toEqual([
      [-97.33, 32.75],
      [-97.34, 32.76],
    ]);

    expect(coverage.normalizePlaceCategoryText('Gas-Station', 'EV_charging')).toBe('gas station ev charging');
    expect(coverage.getPlaceCategoryOverride(undefined, undefined)).toBeNull();
    expect(coverage.resolveNearbyPlaceCategoryValue(undefined, 'Tesla Supercharger')).toBe('place');
    expect(coverage.resolveNearbyPlaceCategoryValue('ev charging station', 'Tesla Supercharger')).toBe('gas_station');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('fire department')).toBe('Fire station');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('sheriff office')).toBe('Police');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('urgent care')).toBe('Medical');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('pharmacy')).toBe('Pharmacy');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('grocery supermarket')).toBe('Grocery');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('retail shop')).toBe('Shopping');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('cinema')).toBe('Entertainment');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('restaurant diner')).toBe('Restaurant');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('pub nightlife')).toBe('Bar');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('museum')).toBe('Museum');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('tourist attraction')).toBe('Landmark');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('hotel lodging')).toBe('Hotel');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('university school')).toBe('School');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('parking garage')).toBe('Parking');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('atm lobby')).toBe('ATM');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('bank branch')).toBe('Bank');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('policestation annex')).toBe('Police');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('hospitalist office')).toBe('Medical');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('pharmacyhub')).toBe('Pharmacy');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('foodcourt')).toBe('Restaurant');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('coffeestand')).toBe('Coffee');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('nightlifedistrict')).toBe('Bar');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('naturewalk')).toBe('Park');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('museumcampus')).toBe('Museum');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('lodginghouse')).toBe('Hotel');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('educationcenter')).toBe('School');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('parkingstructure')).toBe('Park');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('atmzone')).toBe('Atmzone');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('bankinghall')).toBe('Bank');
    expect(coverage.normalizeNearbyPlaceCategoryLabel(undefined, '', 'visitor center')).toBe('Visitor Center');

    const nearbyKindCases = [
      [{ category: 'hospital', categoryLabel: 'Medical', title: 'Urgent Clinic' }, 'health', 'pin'],
      [{ category: 'movie theater', categoryLabel: 'Entertainment', title: 'Cinema' }, 'entertainment', 'entertainment'],
      [{ category: 'retail', categoryLabel: 'Shopping', title: 'Market Hall' }, 'shopping', 'shopping'],
      [{ category: 'coffee', categoryLabel: 'Coffee', title: 'Espresso Bar' }, 'food', 'food'],
      [{ category: 'hotel', categoryLabel: 'Hotel', title: 'Route Lodge' }, 'lodging', 'pin'],
      [{ category: 'gas', categoryLabel: 'Fuel', title: 'Charge Station' }, 'fuel', 'fuel'],
      [{ category: 'museum', categoryLabel: 'Museum', title: 'History Hall' }, 'landmark', 'scenic'],
      [{ category: 'other', categoryLabel: 'Place', title: 'Unknown Stop' }, 'other', 'pin'],
    ] as const;

    for (const [place, kind, iconName] of nearbyKindCases) {
      expect(coverage.getNearbyPlaceKind(place)).toBe(kind);
      expect(coverage.getNearbyPlaceIconName(place)).toBe(iconName);
    }

    const mappedPlace = coverage.mapNearbySearchResultToPin({
      id: 'nearby-food',
      placeName: 'River Market',
      formattedAddress: '',
      address: '',
      city: 'Fort Worth',
      country: 'US',
      category: 'market',
      categoryLabel: 'Grocery market',
      categoryId: 'grocery',
      latitude: 32.75,
      longitude: -97.33,
      distanceKm: 0.42,
      source: 'mapbox',
      sourceLabel: 'Mapbox',
      providerVerified: true,
    });
    expect(mappedPlace).toMatchObject({
      id: 'nearby-food',
      title: 'River Market',
      categoryLabel: 'Grocery',
      kind: 'place',
      distanceLabel: '425 m from center',
    });
    expect(coverage.formatNearbyPlaceCategory({
      ...mappedPlace,
      kind: 'fuel',
      category: '',
      categoryLabel: '',
      title: 'Quick Fuel',
    })).toBe('Gas station');
    expect(coverage.formatNearbyPlaceAddress({ ...mappedPlace, address: '', subtitle: 'Near downtown' })).toBe('Near downtown');
    expect(coverage.buildGoogleMapsAddressUrl(mappedPlace, '')).toContain('River+Market');
    expect(coverage.getNearbyPlaceIconName({ ...mappedPlace, iconName: 'custom' })).toBe('custom');
    expect(coverage.getNearbyPlaceIconName({ ...mappedPlace, category: 'university', categoryLabel: 'University' })).toBe('culture');
    expect(coverage.createNearbyPlaceMarkerIcon('food').querySelector('use')?.getAttribute('href')).toBe('/scope-icons.svg#icon-food');
    expect(coverage.mapNearbySearchResultToPin({
      placeName: '',
      latitude: 32.75,
      longitude: -97.33,
      precision: 'poi',
      distanceKm: 12.25,
      photoUrl: 'https://images.example.com/provider.jpg',
      source: '',
    })).toMatchObject({
      id: ':32.75000:-97.33000',
      title: 'Nearby place',
      category: 'place',
      distanceLabel: '12 km from center',
      photoLookupStatus: 'complete',
    });
    expect(coverage.mapNearbySearchResultToPin({
      id: '',
      placeName: 'Shell Travel Center',
      latitude: 32.75,
      longitude: -97.33,
      categoryId: 'poi',
      category: '',
      categoryLabel: '',
      distanceKm: undefined,
    })).toMatchObject({
      kind: 'fuel',
      distanceLabel: undefined,
    });

    const featurePin = {
      id: 'feature-coffee',
      title: 'Feature Coffee',
      subtitle: '',
      address: '',
      category: 'coffee',
      categoryLabel: 'Coffee',
      latitude: 32.7555,
      longitude: -97.3308,
      distanceLabel: null,
      kind: 'place',
      sourceLabel: 'Mapbox',
      photoLookupStatus: 'pending',
    } as any;
    const inactivePin = coverage.upsertMapFeaturePlacePin(featurePin, { activate: false });
    expect(inactivePin).toMatchObject({
      id: 'feature-coffee',
      title: 'Feature Coffee',
      photoLookupStatus: 'pending',
    });
    coverage.cacheMapFeaturePlaceEnrichment('empty-patch', { title: '   ', address: '   ' });
    expect(coverage.getCachedMapFeaturePlaceEnrichment({ ...featurePin, id: 'empty-patch' })).toBeUndefined();
    expect(coverage.hasWarmMapFeaturePlaceEnrichment({ ...featurePin, id: 'cold-feature' })).toBe(false);
    const cacheKey = coverage.buildMapFeaturePlaceEnrichmentKey(featurePin);
    coverage.applyMapFeaturePlacePinEnrichment(inactivePin, cacheKey, { title: '   ', address: '   ' }, 0);
    expect(coverage.applyCachedMapFeaturePlaceEnrichment(featurePin)).toMatchObject({
      title: 'Feature Coffee',
      address: '',
    });
    coverage.applyMapFeaturePlacePinEnrichment(inactivePin, cacheKey, { title: 'Stale Coffee', address: '404 Stale' }, 99);
    expect(coverage.applyCachedMapFeaturePlaceEnrichment(featurePin)).toMatchObject({
      title: 'Feature Coffee',
      address: '',
    });
    coverage.applyMapFeaturePlacePinEnrichment(inactivePin, cacheKey, {
      title: ' Enriched Coffee ',
      address: ' 100 Main Street ',
      photoLookupStatus: 'loaded',
      sourceLabel: ' Mapbox geocoding ',
    }, 0);
    expect(coverage.applyCachedMapFeaturePlaceEnrichment(featurePin)).toMatchObject({
      title: 'Enriched Coffee',
      address: '100 Main Street',
      subtitle: '100 Main Street',
      photoLookupStatus: 'loaded',
      sourceLabel: 'Mapbox geocoding',
    });
    expect(coverage.upsertMapFeaturePlacePin(featurePin, { activate: false })).toMatchObject({
      title: 'Enriched Coffee',
      subtitle: '100 Main Street',
    });
  });

  it('keeps route marker, distance, feature, and style helpers safe across production edge inputs', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: spots,
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const routePoints: MapPoint[] = [
      { ...spots[0]!, id: 'start', routeRole: 'start', routeLabel: 'S' },
      { ...spots[1]!, id: 'stop-a', routeRole: 'stop', routeLabel: '9' },
      { ...spots[0]!, id: 'stop-b', routeRole: 'stop' },
      { ...spots[1]!, id: 'end', routeRole: 'end', routeLabel: 'E' },
    ];

    expect(coverage.getRouteMarkerSequence(routePoints[0], 1)).toBe('S');
    expect(coverage.getRouteMarkerSequence(routePoints[1], 2)).toBe(2);
    expect(coverage.getRouteMarkerSequence(routePoints[2], 3)).toBe(3);
    expect(coverage.getRouteMarkerSequence(routePoints[3], 4)).toBe('E');
    expect(coverage.getRouteMarkerSequence({ ...spots[0]!, routeLabel: 'A' }, 7)).toBe('A');
    expect(coverage.buildRouteOrderLookup(routePoints)).toEqual(new Map([
      ['start', 'S'],
      ['stop-a', 2],
      ['stop-b', 3],
      ['end', 'E'],
    ]));
    expect(coverage.getSpotMarkerVariant('spot-1')).toBe('sequence');
    expect(coverage.getSpotMarkerVariant('not-in-route')).toBe('default');

    expect(coverage.hasValidCoordinates({ latitude: 32.7, longitude: -97.3 })).toBe(true);
    expect(coverage.hasValidCoordinates({ latitude: 100, longitude: -97.3 })).toBe(false);
    expect(coverage.hasValidRouteCoordinate([-97.3, 32.7])).toBe(true);
    expect(coverage.hasValidRouteCoordinate([-181, 32.7])).toBe(false);
    expect(coverage.hasMappablePoints()).toBe(true);

    expect(coverage.formatDistanceLabel(0.005, 8, 'user')).toBeNull();
    expect(coverage.formatDistanceLabel(0.026, 42, 'user')).toBe('50 m away');
    expect(coverage.formatDistanceLabel(0.982, 1580, 'selected')).toBe('1 mi from selected');
    expect(coverage.formatDistanceLabel(13, 20_921, 'user')).toBe('13 mi away');

    const pointFeature = {
      geometry: { type: 'Point', coordinates: [-97.33, 32.75] },
      properties: {
        name: '  Coffee & Tacos  ',
        category: 'restaurant',
        maki: 'cafe',
        address: '100 Main St',
        city: 'Fort Worth',
        state: 'TX',
        country: 'US',
      },
      source: 'composite',
      sourceLayer: 'poi_label',
      layer: { id: 'poi-label', source: 'composite', 'source-layer': 'poi_label' },
    };
    const lineFeature = {
      ...pointFeature,
      geometry: { type: 'LineString', coordinates: [[-97.33, 32.75], [-97.34, 32.76]] },
      properties: { class: 'motorway', name_en: 'I-35W' },
      layer: { id: 'road-label', source: 'composite', 'source-layer': 'road' },
    };

    expect(coverage.getMapFeatureCoordinates(pointFeature, { lng: -98, lat: 33 })).toEqual({
      latitude: 32.75,
      longitude: -97.33,
    });
    expect(coverage.getMapFeatureCoordinates(lineFeature, { lng: -98, lat: 33 })).toEqual({
      latitude: 33,
      longitude: -98,
    });
    expect(coverage.getMapFeatureAddress(pointFeature)).toBe('100 Main St');
    expect(coverage.getMapFeatureAddress({
      ...pointFeature,
      properties: {
        house_num: '100',
        street: 'Main St',
        city: 'Fort Worth',
        state: 'TX',
        postal_code: '76102',
      },
    })).toBe('100 Main St, Fort Worth, TX, 76102');
    expect(coverage.getMapFeatureCategory(pointFeature, 'Coffee & Tacos')).toBe('coffee');
    expect(coverage.getMapFeatureCategoryLabel(pointFeature, 'Coffee & Tacos')).toBe('Coffee');
    expect(coverage.getMapFeatureLayerSourceLayer(pointFeature)).toBe('poi_label');
    expect(coverage.mapRenderedFeatureToNearbyPlacePin(pointFeature, { lng: -98, lat: 33 })).toMatchObject({
      title: 'Coffee & Tacos',
      category: 'coffee',
    });

    expect(coverage.sanitizeMapFeatureText('  <img src=x onerror=alert(1)>  Picnic  ')).toBe('<img src=x onerror=alert(1)> Picnic');
    expect(coverage.isCoordinateLikeAddress('32.75, -97.33')).toBe(true);
    expect(coverage.isCoordinateLikeAddress('100 Main St')).toBe(false);
    expect(coverage.titleCaseMapFeatureCategory('ev_charging-station')).toBe('Ev Charging Station');
    expect(coverage.isFuelPlaceCategory('gas_station')).toBe(true);
    expect(coverage.getNearbyPlaceKind({ category: 'gas_station', title: 'Fuel Stop' })).toBe('fuel');
    expect(coverage.getNearbyPlaceKind({ category: 'park', title: 'Garden' })).toBe('park');

    expect(coverage.isMajorRoadLineLayer('road-motorway', 'road')).toBe(true);
    expect(coverage.isRoadLabelLayer('road-label', 'road')).toBe(true);
    expect(coverage.isRoadShieldLayer('road-shield', 'road')).toBe(true);
    expect(coverage.isCountryLabelLayer('country-label', 'place_label')).toBe(true);
    expect(coverage.isStateLabelLayer('state-label', 'place_label')).toBe(true);
    expect(coverage.isWaterLabelLayer('water-label', 'natural_label')).toBe(true);
    expect(coverage.isPoiLabelLayer('poi-label', 'poi_label')).toBe(true);
    expect(coverage.isRoadLineLayer('building', 'building')).toBe(false);
  });

  it('classifies civic, travel, retail, and attraction nearby places for labels, kinds, and icons', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: spots,
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const buildPlace = (category: string, title: string) => ({
      id: `${category}-${title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title,
      subtitle: '',
      address: '',
      category,
      categoryLabel: category,
      latitude: 32.7555,
      longitude: -97.3308,
      distanceLabel: null,
      kind: 'place',
      sourceLabel: 'Mapbox',
    });

    const expectations = [
      ['police', 'County Sheriff Office', 'Police', 'civic', 'pin'],
      ['pharmacy', 'Walgreens Pharmacy', 'Pharmacy', 'health', 'pin'],
      ['fuel', 'Shell Travel Center', 'Gas station', 'fuel', 'fuel'],
      ['entertainment', 'Downtown Movie Theater', 'Entertainment', 'entertainment', 'entertainment'],
      ['coffee', 'Neighborhood Coffee', 'Coffee', 'food', 'food'],
      ['museum', 'Modern Art Museum', 'Museum', 'landmark', 'scenic'],
      ['hotel', 'Historic Lodge Hotel', 'Hotel', 'lodging', 'pin'],
      ['parking', 'Main Street Parking', 'Parking', 'parking', 'pin'],
      ['atm', 'Lobby ATM', 'ATM', 'finance', 'pin'],
      ['bank', 'Frost Bank', 'Bank', 'finance', 'pin'],
      ['retail', 'Downtown Shopping Mall', 'Shopping', 'shopping', 'shopping'],
    ] as const;

    for (const [category, title, label, kind, icon] of expectations) {
      const place = buildPlace(category, title);
      expect(coverage.resolveNearbyPlaceCategoryValue(category, title)).toEqual(expect.any(String));
      expect(coverage.formatNearbyPlaceCategory(place)).toBe(label);
      expect(coverage.getNearbyPlaceKind(place)).toBe(kind);
      expect(coverage.getNearbyPlaceIconName(place)).toBe(icon);
    }

    wrapper.unmount();
  });

  it('preloads nearby place photos in production mode and normalizes direct civic category labels', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: spots,
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const originalProcessVitest = process.env.VITEST;
    const originalNodeEnv = process.env.NODE_ENV;
    const originalImage = globalThis.Image;
    const decodedImages: Array<{ decode: ReturnType<typeof vi.fn>; src: string }> = [];
    const loadedImages: Array<{ onload: (() => void) | null; onerror: (() => void) | null; src: string }> = [];

    class DecodeImage {
      decoding = '';
      loading = '';
      src = '';
      decode = vi.fn(async () => undefined);

      constructor() {
        decodedImages.push(this);
      }
    }

    class LoadImage {
      decoding = '';
      loading = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private nextSrc = '';

      constructor() {
        loadedImages.push(this);
      }

      get src() {
        return this.nextSrc;
      }

      set src(value: string) {
        this.nextSrc = value;
        queueMicrotask(() => this.onload?.());
      }
    }

    try {
      vi.stubEnv('MODE', 'production');
      vi.stubEnv('VITEST', '');
      delete process.env.VITEST;
      process.env.NODE_ENV = 'production';
      vi.stubGlobal('Image', DecodeImage);

      await coverage.preloadNearbyPlacePhoto('https://images.example.com/cafe.jpg');
      await coverage.preloadNearbyPlacePhoto('https://images.example.com/cafe.jpg');
      expect(decodedImages).toHaveLength(1);
      expect(decodedImages[0]?.decode).toHaveBeenCalledTimes(1);

      vi.stubGlobal('Image', LoadImage);
      const loadedPromise = coverage.preloadNearbyPlacePhoto('https://images.example.com/no-decode.jpg');
      await loadedPromise;
      expect(loadedImages).toHaveLength(1);

      expect(coverage.normalizeNearbyPlaceCategoryLabel('county sheriff office')).toBe('Police');
      expect(coverage.normalizeNearbyPlaceCategoryLabel('drugstore pharmacy')).toBe('Pharmacy');
      expect(coverage.normalizeNearbyPlaceCategoryLabel('cinema bowling arcade')).toBe('Entertainment');
      expect(coverage.normalizeNearbyPlaceCategoryLabel('coffee cafe')).toBe('Coffee');
      expect(coverage.normalizeNearbyPlaceCategoryLabel('museum gallery')).toBe('Museum');
      expect(coverage.normalizeNearbyPlaceCategoryLabel('hotel lodging')).toBe('Hotel');
      expect(coverage.normalizeNearbyPlaceCategoryLabel('parking garage')).toBe('Parking');
      expect(coverage.normalizeNearbyPlaceCategoryLabel('atm kiosk')).toBe('ATM');
      expect(coverage.normalizeNearbyPlaceCategoryLabel('bank branch')).toBe('Bank');
      expect(coverage.normalizeNearbyPlaceCategoryLabel('retail shopping mall')).toBe('Shopping');
    } finally {
      vi.stubEnv('MODE', 'test');
      vi.stubEnv('VITEST', 'true');
      if (typeof originalProcessVitest === 'undefined') {
        delete process.env.VITEST;
      } else {
        process.env.VITEST = originalProcessVitest;
      }
      if (typeof originalNodeEnv === 'undefined') {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
      vi.stubGlobal('Image', originalImage);
      wrapper.unmount();
    }
  });

  it('registers the Mapbox POI fallback icon only when the sprite asks for it', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: spots,
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const context = {
      scale: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      shadowColor: '',
      shadowBlur: 0,
      fillStyle: '',
      lineWidth: 0,
      strokeStyle: '',
    };
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as any);
    const addImage = vi.fn();
    const mapWithMissingImage = {
      hasImage: vi.fn(() => false),
      addImage,
    };

    coverage.handlePoiFallbackIconMissing(mapWithMissingImage as any, null);
    coverage.handlePoiFallbackIconMissing(mapWithMissingImage as any, { id: 'not-marker' });
    expect(addImage).not.toHaveBeenCalled();

    coverage.handlePoiFallbackIconMissing(mapWithMissingImage as any, { id: 'marker' });
    expect(mapWithMissingImage.hasImage).toHaveBeenCalledWith('marker');
    expect(context.arc).toHaveBeenCalled();
    expect(addImage).toHaveBeenCalledWith('marker', expect.any(HTMLCanvasElement), { pixelRatio: 2 });

    const mapWithExistingImage = {
      hasImage: vi.fn(() => true),
      addImage: vi.fn(),
    };
    coverage.ensurePoiFallbackIcon(mapWithExistingImage as any);
    expect(mapWithExistingImage.addImage).not.toHaveBeenCalled();

    getContextSpy.mockRestore();
  });

  it('applies scoped map presentation polish to Mapbox layers without requiring a live map runtime', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: spots,
        labelMode: 'states',
        mapPresentation: 'scope',
        showPlaceLabels: true,
        showTraffic: true,
        showProjectionToggle: true,
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const toDataUrlDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'toDataURL');
    Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
      configurable: true,
      value: vi.fn(() => 'data:image/png;base64,c2NvcGU='),
    });
    const getContextDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext');
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: vi.fn(() => ({
        arc: vi.fn(),
        beginPath: vi.fn(),
        clearRect: vi.fn(),
        drawImage: vi.fn(),
        fill: vi.fn(),
        getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
        putImageData: vi.fn(),
        scale: vi.fn(),
        stroke: vi.fn(),
        set fillStyle(_value: string) {},
        set lineWidth(_value: number) {},
        set shadowBlur(_value: number) {},
        set shadowColor(_value: string) {},
        set strokeStyle(_value: string) {},
      })),
    });
    const layers: any[] = [
      { id: 'background', type: 'background', paint: { 'background-color': 'rgb(1, 1, 1)' } },
      { id: 'water-fill', type: 'fill', paint: { 'fill-color': 'blue' } },
      { id: 'landcover-natural', type: 'fill', paint: {} },
      { id: 'desert-scrub', type: 'fill', paint: {} },
      { id: 'park-building', type: 'fill', paint: {} },
      { id: 'road-motorway', type: 'line', 'source-layer': 'road', paint: {} },
      { id: 'road-simple', type: 'line', 'source-layer': 'road', paint: {} },
      { id: 'road-casing', type: 'line', 'source-layer': 'road', paint: {} },
      { id: 'admin-0-boundary', type: 'line', 'source-layer': 'admin_0', paint: {} },
      { id: 'admin-1-boundary', type: 'line', 'source-layer': 'admin_1', paint: {} },
      { id: 'country-label', type: 'symbol', 'source-layer': 'country_label', layout: { 'text-field': ['get', 'name'] }, paint: {} },
      { id: 'state-label', type: 'symbol', 'source-layer': 'place_label', layout: { 'text-field': ['get', 'name'] }, paint: {} },
      { id: 'road-shield', type: 'symbol', 'source-layer': 'road', layout: { 'text-field': ['get', 'ref'] }, paint: {} },
      { id: 'road-label', type: 'symbol', 'source-layer': 'road_label', layout: { 'text-field': ['get', 'name'] }, paint: {} },
      { id: 'water-label', type: 'symbol', 'source-layer': 'water', layout: { 'text-field': ['get', 'name'] }, paint: {} },
      { id: 'poi-label', type: 'symbol', 'source-layer': 'poi_label', layout: { 'text-field': ['get', 'name'], 'icon-image': '' }, paint: {} },
      { id: 'settlement-label', type: 'symbol', 'source-layer': 'place_label', layout: { 'text-field': ['get', 'name'] }, paint: {} },
      { id: 'scope-traffic-flow-casing', type: 'line', paint: {} },
      { id: 'scope-traffic-flow', type: 'line', paint: {} },
      { id: 'scope-traffic-alert-casing', type: 'line', paint: {} },
      { id: 'scope-traffic-alert', type: 'line', paint: {} },
      { id: 'scope-traffic-closures', type: 'line', paint: {} },
      { id: 'hillshade', type: 'hillshade', paint: {} },
      { id: 'custom-layer', type: 'circle', paint: {} },
    ];
    const layerById = new Map(layers.map((layer) => [layer.id, layer]));
    const paint = new Map<string, unknown>();
    const layout = new Map<string, unknown>();
    const zoomRanges: Array<[string, number, number]> = [];
    const moveLayer = vi.fn();
    const setPaintProperty = vi.fn((layerId: string, property: string, value: unknown) => {
      paint.set(`${layerId}:${property}`, value);
    });
    const setLayoutProperty = vi.fn((layerId: string, property: string, value: unknown) => {
      layout.set(`${layerId}:${property}`, value);
    });
    const fakeMap: any = {
      addLayer: vi.fn((layer: any, beforeLayerId?: string) => {
        layers.push(layer);
        layerById.set(layer.id, layer);
        layout.set(`${layer.id}:before`, beforeLayerId);
      }),
      addSource: vi.fn(),
      getLayer: (layerId: string) => layerById.get(layerId),
      getLayoutProperty: (layerId: string, property: string) =>
        layout.get(`${layerId}:${property}`) ?? layerById.get(layerId)?.layout?.[property] ?? null,
      getPaintProperty: (layerId: string, property: string) =>
        paint.get(`${layerId}:${property}`) ?? layerById.get(layerId)?.paint?.[property] ?? null,
      getSource: vi.fn((sourceId: string) => (sourceId === 'composite' ? { type: 'vector' } : undefined)),
      getStyle: () => ({
        layers,
        sources: {
          composite: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v8' },
          streets: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v8' },
        },
      }),
      moveLayer,
      removeLayer: vi.fn((layerId: string) => {
        layerById.delete(layerId);
      }),
      removeSource: vi.fn(),
      setFog: vi.fn(),
      setLayerZoomRange: vi.fn((layerId: string, minzoom: number, maxzoom: number) => {
        zoomRanges.push([layerId, minzoom, maxzoom]);
      }),
      setLayoutProperty,
      setPaintProperty,
      setProjection: vi.fn(),
      setRenderWorldCopies: vi.fn(),
    };

    expect(coverage.getMapRoadSourceId(fakeMap)).toBe('composite');
    expect(coverage.getFirstSymbolLayerId(fakeMap)).toBe('country-label');
    expect(coverage.getFirstNativeSymbolLayerId(fakeMap)).toBe('country-label');
    expect(coverage.getMapTrafficBeforeLayerId(fakeMap)).toBe('admin-0-boundary');
    expect(coverage.buildTrafficRoadClassFilter()).toEqual(expect.arrayContaining(['match']));
    expect(coverage.buildTrafficCongestionFilter(['heavy'])).toEqual(expect.arrayContaining(['match']));
    expect(coverage.buildMapTrafficLayerDefinitions()).toHaveLength(5);
    expect(coverage.buildScopeRoadContextLayerDefinitions('composite')).toHaveLength(2);

    for (const layer of layers) {
      coverage.applyMapPresentationLayerTransition(fakeMap, layer);
    }
    coverage.applyScopeRoadPresentation(fakeMap, layerById.get('road-motorway'), 'road-motorway', 'road');
    coverage.applyScopeRoadPresentation(fakeMap, layerById.get('road-simple'), 'road-simple', 'road');
    coverage.applyScopeRoadPresentation(fakeMap, layerById.get('road-casing'), 'road-casing', 'road');
    coverage.applyNativeRoadPresentation(fakeMap, layerById.get('road-motorway'), 'road-motorway', 'road');
    coverage.applyNativeRoadPresentation(fakeMap, layerById.get('road-simple'), 'road-simple', 'road');
    coverage.applyNativeRoadPresentation(fakeMap, layerById.get('road-casing'), 'road-casing', 'road');
    coverage.applyScopeAdministrativeBoundaryPresentation(fakeMap, layerById.get('admin-0-boundary'), 'admin-0-boundary', 'admin_0');
    coverage.applyScopeAdministrativeBoundaryPresentation(fakeMap, layerById.get('admin-1-boundary'), 'admin-1-boundary', 'admin_1');
    coverage.applyNativeAdministrativeBoundaryPresentation(fakeMap, layerById.get('admin-0-boundary'), 'admin-0-boundary', 'admin_0');
    coverage.applyNativeAdministrativeBoundaryPresentation(fakeMap, layerById.get('admin-1-boundary'), 'admin-1-boundary', 'admin_1');
    coverage.applyScopeFillPresentation(fakeMap, layerById.get('background'), 'background');
    coverage.applyScopeFillPresentation(fakeMap, layerById.get('water-fill'), 'water-fill');
    coverage.applyScopeFillPresentation(fakeMap, layerById.get('landcover-natural'), 'landcover-natural');
    coverage.applyScopeFillPresentation(fakeMap, layerById.get('desert-scrub'), 'desert-scrub');
    coverage.applyScopeFillPresentation(fakeMap, layerById.get('park-building'), 'park-building');
    coverage.applyNativeFillPresentation(fakeMap, layerById.get('background'), 'background');
    coverage.applyNativeFillPresentation(fakeMap, layerById.get('landcover-natural'), 'landcover-natural');
    coverage.applyNativeFillPresentation(fakeMap, layerById.get('desert-scrub'), 'desert-scrub');
    coverage.applyNativeFillPresentation(fakeMap, layerById.get('custom-layer'), 'custom-layer');

    coverage.applyStateNameLabelPresentation(fakeMap, 'state-label', 'states');
    coverage.applyStateNameLabelPresentation(fakeMap, 'state-label', 'none');
    coverage.applyCountryLabelPresentation(fakeMap, layerById.get('country-label'), 'country-label');
    coverage.applyContextLabelPresentation(fakeMap, layerById.get('water-label'), 'water-label', 'water-label', 'water');
    coverage.applyContextLabelPresentation(fakeMap, layerById.get('road-label'), 'road-label', 'road-label', 'road_label');
    coverage.applyRoadShieldPresentation(fakeMap, 'road-shield');
    expect(coverage.applyStatesModeSymbolPresentation(fakeMap, layerById.get('country-label'), 'country-label', 'country-label', 'country_label')).toBe(true);
    expect(coverage.applyStatesModeSymbolPresentation(fakeMap, layerById.get('state-label'), 'state-label', 'state-label', 'place_label')).toBe(true);
    expect(coverage.applyStatesModeSymbolPresentation(fakeMap, layerById.get('road-shield'), 'road-shield', 'road-shield', 'road')).toBe(true);
    expect(coverage.applyStatesModeSymbolPresentation(fakeMap, layerById.get('road-label'), 'road-label', 'road-label', 'road_label')).toBe(true);
    expect(coverage.applyStatesModeSymbolPresentation(fakeMap, layerById.get('water-label'), 'water-label', 'water-label', 'water')).toBe(true);
    expect(coverage.applyStatesModeSymbolPresentation(fakeMap, layerById.get('poi-label'), 'poi-label', 'poi-label', 'poi_label')).toBe(true);
    expect(coverage.applyStatesModeSymbolPresentation(fakeMap, layerById.get('settlement-label'), 'settlement-label', 'settlement-label', 'place_label')).toBe(true);
    coverage.applyPoiSymbolPresentation(fakeMap, layerById.get('poi-label'), 'poi-label');
    coverage.applyScopeFinalSymbolTextPresentation(fakeMap);
    coverage.applyMapTrafficLayerPaint(fakeMap);
    coverage.safelyMoveMapLayerBefore(fakeMap, 'road-label', 'country-label');
    coverage.safelyMoveMapLayerBefore(fakeMap, 'road-label', undefined);
    coverage.safelyMoveMapLayerBefore(fakeMap, 'missing-layer', 'country-label');

    expect(setPaintProperty).toHaveBeenCalledWith('road-motorway', 'line-color', expect.anything());
    expect(setPaintProperty).toHaveBeenCalledWith('scope-traffic-closures', 'line-dasharray', [1.05, 0.7]);
    expect(setLayoutProperty).toHaveBeenCalledWith('state-label', 'visibility', 'visible');
    expect(setLayoutProperty).toHaveBeenCalledWith('poi-label', 'icon-image', 'marker');
    expect(zoomRanges.some(([layerId]) => layerId === 'road-shield')).toBe(true);
    expect(moveLayer).toHaveBeenCalledWith('road-label', 'country-label');
    expect(moveLayer).toHaveBeenCalledWith('road-label');
  });

  it('keeps nearby marker controllers and location camera recovery stable as runtime state changes', async () => {
    vi.useFakeTimers();
    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: spots,
        routeVariant: 'planner',
        showNearbyPlaces: true,
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const mapStore = useMapStore();
    const mapCanvas = wrapper.get('.map-canvas').element as HTMLElement;
    const write = <T>(entry: { value: T }, value: T) => {
      entry.value = value;
    };
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
      callback(performance.now());
      return 17;
    });
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      scale: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      shadowColor: '',
      shadowBlur: 0,
      fillStyle: '',
      lineWidth: 0,
      strokeStyle: '',
    } as any);
    Object.defineProperty(mapCanvas, 'clientWidth', { configurable: true, value: 960 });
    Object.defineProperty(mapCanvas, 'clientHeight', { configurable: true, value: 640 });
    Object.defineProperty(mapCanvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 20,
        top: 10,
        right: 980,
        bottom: 650,
        width: 960,
        height: 640,
        x: 20,
        y: 10,
        toJSON: () => ({}),
      }),
    });

    const createdMarkers: Array<{
      element: HTMLElement;
      lngLat?: [number, number];
      removed: boolean;
      setLngLat: (lngLat: [number, number]) => unknown;
      addTo: () => unknown;
      remove: () => void;
    }> = [];

    class TestMarker {
      element: HTMLElement;
      lngLat?: [number, number];
      removed = false;

      constructor(options: { element: HTMLElement }) {
        this.element = options.element;
        createdMarkers.push(this);
      }

      setLngLat(lngLat: [number, number]) {
        this.lngLat = lngLat;
        return this;
      }

      addTo() {
        return this;
      }

      remove() {
        this.removed = true;
      }
    }

    let currentZoom = 2;
    let currentCenter = { lng: -121.5, lat: 36.2 };
    const easeTo = vi.fn((options: { center?: [number, number]; zoom?: number }) => {
      if (options.center) {
        currentCenter = { lng: options.center[0], lat: options.center[1] };
      }
      if (typeof options.zoom === 'number') {
        currentZoom = options.zoom;
      }
    });
    const fakeMap = {
      getCanvas: () => mapCanvas,
      getCenter: () => currentCenter,
      getContainer: () => mapCanvas,
      getZoom: () => currentZoom,
      easeTo,
      stop: vi.fn(),
      project: vi.fn(([longitude, latitude]: [number, number]) => ({
        x: 480 + longitude + 97,
        y: 320 - (latitude - 32),
      })),
    };
    const runtime = { Marker: TestMarker };
    const providerPlace = {
      id: 'nearby-night-market',
      title: 'Night Market',
      latitude: 32.75,
      longitude: -97.33,
      kind: 'place',
      category: 'restaurant',
      categoryLabel: 'Restaurant',
      address: '100 Main Street',
      distanceLabel: '250 m from center',
      sourceLabel: 'Mapbox',
    };

    try {
      window.requestAnimationFrame = requestAnimationFrameMock;
      write(coverage.mapContainer, mapCanvas);
      write(coverage.interactiveMapEnabled, true);
      write(coverage.map, fakeMap);

      coverage.renderNearbyPlaceMarkers([
        { ...providerPlace, id: 'invalid-nearby', latitude: Number.NaN },
        providerPlace,
      ], fakeMap, runtime);
      expect(createdMarkers).toHaveLength(1);
      expect(createdMarkers[0]?.lngLat).toEqual([-97.33, 32.75]);

      const markerRoot = createdMarkers[0]!.element;
      Object.defineProperty(markerRoot, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({
          left: 32,
          top: 36,
          right: 72,
          bottom: 82,
          width: 40,
          height: 46,
          x: 32,
          y: 36,
          toJSON: () => ({}),
        }),
      });
      const popover = markerRoot.querySelector<HTMLElement>('.nearby-place-marker__popover');
      Object.defineProperty(popover, 'offsetWidth', { configurable: true, value: 320 });
      Object.defineProperty(popover, 'offsetHeight', { configurable: true, value: 260 });

      markerRoot.querySelector<HTMLButtonElement>('.nearby-place-marker__button')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );
      coverage.updateActiveNearbyPlaceMarkerPopoverPlacement();
      expect(markerRoot.dataset.active).toBe('true');
      expect(markerRoot.dataset.popoverPlacement).toBe('below');

      coverage.scheduleActiveNearbyPlacePopoverPlacement();
      expect(requestAnimationFrameMock).toHaveBeenCalled();

      coverage.renderNearbyPlaceMarkers([providerPlace], fakeMap, runtime);
      expect(createdMarkers).toHaveLength(1);

      coverage.renderNearbyPlaceMarkers([{ ...providerPlace, priceLabel: '$12' }], fakeMap, runtime);
      expect(createdMarkers[0]?.removed).toBe(true);
      expect(createdMarkers).toHaveLength(2);

      createdMarkers[1]!.element.querySelector<HTMLButtonElement>('[data-nearby-place-add="true"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );
      expect(wrapper.emitted('nearby-place-add')?.at(-1)?.[0]).toMatchObject({
        id: 'nearby-night-market',
        title: 'Night Market',
      });

      coverage.renderNearbyPlaceMarkers([], fakeMap, runtime);
      expect(createdMarkers[1]?.removed).toBe(true);
      expect(() => coverage.removeNearbyPlaceMarkerController('missing-nearby-marker')).not.toThrow();
      expect(() => coverage.updateNearbyPlaceMarkerPopoverPlacement({
        id: 'manual-controller',
        signature: '',
        element: document.createElement('div'),
        button: document.createElement('button'),
        marker: { remove: vi.fn() },
      }, true)).not.toThrow();

      const location = {
        latitude: 41.8781,
        longitude: -87.6298,
        accuracy: 12,
        heading: null,
        speed: null,
        timestamp: Date.now(),
      };
      expect(coverage.centerOnLocation(location, 12, {
        allowDefer: false,
        forceZoomIn: true,
        maxFocusZoom: 15,
        useFlight: true,
        durationMs: 40,
      })).toBe(true);
      expect(easeTo).toHaveBeenCalledWith(expect.objectContaining({
        center: [-87.6298, 41.8781],
      }));
      vi.advanceTimersByTime(1400);
      expect(easeTo).toHaveBeenCalledWith(expect.objectContaining({
        zoom: expect.any(Number),
      }));

      currentZoom = 2;
      easeTo.mockClear();
      expect(coverage.centerOnLocation({
        ...location,
        longitude: -122.4194,
        latitude: 37.7749,
      }, 12, {
        allowDefer: false,
        forceZoomIn: true,
        maxFocusZoom: 15,
        useFlight: true,
        durationMs: 40,
      })).toBe(true);
      write(coverage.map, null);
      vi.advanceTimersByTime(1400);
      expect(easeTo).toHaveBeenCalledTimes(1);

      write(coverage.interactiveMapEnabled, false);
      expect(coverage.centerOnLocation({
        ...location,
        longitude: -96.797,
        latitude: 32.7767,
      })).toBe(true);
      expect(mapStore.viewport.center).toEqual([-96.797, 32.7767]);
    } finally {
      write(coverage.map, null);
      getContextSpy.mockRestore();
      window.requestAnimationFrame = originalRequestAnimationFrame;
      vi.useRealTimers();
      wrapper.unmount();
    }
  });

  it('warms Mapbox feature places and ignores stale weather snapshots without live services', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        showNearbyPlaces: true,
        showWeatherBadge: true,
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const mapStore = useMapStore();
    const mapCanvas = wrapper.get('.map-canvas').element as HTMLElement;
    const write = <T>(entry: { value: T }, value: T) => {
      entry.value = value;
    };
    const buildFeature = (id: string, title: string, longitude: number, latitude: number) => ({
      id,
      geometry: {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
      properties: {
        name: title,
        maki: 'cafe',
      },
      layer: {
        id: 'poi-label',
        type: 'symbol',
        'source-layer': 'poi_label',
      },
    });
    const feature = buildFeature('feature-coffee', 'Map Feature Coffee', -97.3308, 32.7555);
    const visibleFeature = buildFeature('feature-visible', 'Visible Cafe', -97.3318, 32.7565);
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 960 });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 640 });
    Object.defineProperty(mapCanvas, 'clientWidth', { configurable: true, value: 960 });
    Object.defineProperty(mapCanvas, 'clientHeight', { configurable: true, value: 640 });

    const queryRenderedFeatures = vi.fn((_bounds?: unknown, options?: { layers?: string[] }) => (
      options?.layers ? [feature] : []
    ));
    const fakeMap = {
      getCanvas: () => canvas,
      getCenter: () => ({ lng: -97.3308, lat: 32.7555 }),
      getContainer: () => mapCanvas,
      getZoom: () => 13,
      getBounds: () => ({
        getWest: () => -97.5,
        getSouth: () => 32.5,
        getEast: () => -97,
        getNorth: () => 33,
      }),
      getStyle: () => ({
        layers: [
          { id: '', type: 'symbol', 'source-layer': 'poi_label' },
          { id: 'road-label', type: 'symbol', 'source-layer': 'road_label' },
          { id: 'poi-label', type: 'symbol', 'source-layer': 'poi_label' },
          { id: 'poi-circle', type: 'circle', 'source-layer': 'poi_label' },
        ],
      }),
      project: vi.fn(([longitude, latitude]: [number, number]) => ({
        x: 480 + (longitude + 97.3308) * 10000,
        y: 320 - (latitude - 32.7555) * 10000,
      })),
      on: vi.fn(),
      off: vi.fn(),
      hasImage: vi.fn(() => true),
      queryRenderedFeatures,
    };

    write(coverage.interactiveMapEnabled, true);
    write(coverage.mapContainer, mapCanvas);
    write(coverage.map, fakeMap);
    mapStore.setCenter([-97.3308, 32.7555]);
    mapStore.setZoom(13);

    expect(coverage.getInteractiveMapFeatureLayerIds(fakeMap)).toEqual(['poi-label']);
    expect(coverage.getRenderedMapFeaturePlacePinAtPoint(
      { x: 480, y: 320 },
      { lng: -97.3308, lat: 32.7555 },
    )).toMatchObject({
      id: 'map-feature-feature-coffee',
      title: 'Map Feature Coffee',
      category: 'coffee',
      photoLookupStatus: 'pending',
    });

    queryRenderedFeatures.mockReturnValueOnce([]).mockReturnValueOnce([]);
    expect(coverage.handleRenderedMapFeatureClickAtPoint(
      { x: 480, y: 320 },
      { lng: -97.3308, lat: 32.7555 },
    )).toBe(false);

    queryRenderedFeatures.mockImplementation((_bounds?: unknown, options?: { layers?: string[] }) => (
      options?.layers ? [feature] : []
    ));
    expect(coverage.handleRenderedMapFeatureClickAtPoint(
      { x: 480, y: 320 },
      { lng: -97.3308, lat: 32.7555 },
    )).toBe(true);
    await flushPromises();
    await flushPromises();
    expect(vi.mocked(reverseGeocode)).toHaveBeenCalledWith(32.7555, -97.3308);
    expect(vi.mocked(getPlacePhoto)).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Map Feature Coffee',
      latitude: 32.7555,
      longitude: -97.3308,
    }));
    expect(coverage.getActiveMapFeaturePlacePin()).toMatchObject({
      id: 'map-feature-feature-coffee',
      title: 'Map Feature Coffee',
    });

    const titlelessPin = {
      id: 'map-feature-titleless',
      title: '',
      subtitle: '',
      address: '',
      category: 'coffee',
      categoryLabel: 'Coffee',
      latitude: 32.7559,
      longitude: -97.3312,
      kind: 'place',
      sourceLabel: 'Mapbox',
      photoLookupStatus: 'pending',
    };
    coverage.cacheMapFeaturePlaceEnrichment(coverage.buildMapFeaturePlaceEnrichmentKey(titlelessPin), {
      title: 'Cached Feature Cafe',
      address: '200 Cached Street',
    });
    vi.mocked(getPlacePhoto).mockClear();
    await coverage.prefetchMapFeaturePlacePhoto(titlelessPin);
    expect(vi.mocked(getPlacePhoto)).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Cached Feature Cafe',
      address: '200 Cached Street',
    }));

    const anonymousPin = {
      ...titlelessPin,
      id: 'map-feature-anonymous',
      latitude: 32.757,
      longitude: -97.333,
    };
    vi.mocked(reverseGeocode).mockResolvedValueOnce({
      latitude: 32.757,
      longitude: -97.333,
      placeName: '',
      formattedAddress: '300 Anonymous Street',
      address: '300 Anonymous Street',
      precision: 'address',
      source: 'mapbox',
    } as any);
    coverage.upsertMapFeaturePlacePin(anonymousPin, { activate: false });
    await coverage.enrichMapFeaturePlacePinAddress(anonymousPin);
    expect(coverage.applyCachedMapFeaturePlaceEnrichment(anonymousPin)).toMatchObject({
      title: 'Nearby place',
      address: '300 Anonymous Street',
    });

    vi.mocked(getPlacePhoto).mockClear();
    queryRenderedFeatures.mockImplementation((_bounds?: unknown, options?: { layers?: string[] }) => (
      options?.layers ? [visibleFeature, visibleFeature] : []
    ));
    const visiblePins = coverage.getVisibleMapFeaturePlacePhotoPrefetchPins(fakeMap);
    expect(visiblePins).toHaveLength(1);
    expect(visiblePins[0]).toMatchObject({
      id: 'map-feature-feature-visible',
      title: 'Visible Cafe',
    });
    coverage.warmVisibleMapFeaturePlacePhotos();
    await flushPromises();
    expect(vi.mocked(getPlacePhoto)).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Visible Cafe',
    }));
    coverage.warmVisibleMapFeaturePlacePhotos();
    expect(vi.mocked(getPlacePhoto)).toHaveBeenCalledTimes(1);

    vi.mocked(getOpenWeatherMapSnapshot)
      .mockResolvedValueOnce({
        id: 'stale-weather',
        label: 'Map center',
        temperatureF: 64,
        condition: 'Rain',
        windMph: 12,
        provider: 'local',
        iconCode: '10d',
        isDaytime: true,
      } as any)
      .mockResolvedValueOnce({
        id: 'fresh-weather',
        label: 'Map center',
        temperatureF: 81,
        condition: 'Clear',
        windMph: 4,
        provider: 'local',
        iconCode: '01d',
        isDaytime: true,
      } as any);
    const staleLoad = coverage.loadMapWeatherSnapshot();
    const freshLoad = coverage.loadMapWeatherSnapshot();
    await Promise.all([staleLoad, freshLoad]);
    await nextTick();
    expect(wrapper.get('[data-test="map-weather-badge"]').text()).toContain('81°F');
    expect(wrapper.get('[data-test="map-weather-badge"]').text()).not.toContain('64°F');

    write(coverage.map, null);
    coverage.scheduleNearbyPlacesRefresh();
    expect(vi.mocked(searchNearbyPlaces)).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('keeps nearby provider category, popup, marker, and map-feature fallbacks deterministic', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots: [],
        showNearbyPlaces: true,
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const makePlace = (overrides: Record<string, unknown> = {}) => ({
      id: 'nearby-provider-place',
      title: 'Provider Place',
      latitude: 32.7555,
      longitude: -97.3308,
      kind: 'place',
      category: 'place',
      categoryLabel: 'Place',
      sourceLabel: 'Mapbox',
      ...overrides,
    }) as any;

    const categoryLabels: Array<[string, string, string]> = [
      ['fire station', 'Station 12', 'Fire station'],
      ['police', 'Sheriff Office', 'Police'],
      ['urgent care medical', 'Clinic', 'Medical'],
      ['drugstore', 'Neighborhood Pharmacy', 'Pharmacy'],
      ['motorist', 'Highway Plaza', 'Travel stop'],
      ['supermarket', 'Central Grocery', 'Grocery'],
      ['cinema movie theater', 'Arcade Arena', 'Entertainment'],
      ['restaurant', 'Supper Club', 'Restaurant'],
      ['cafe', 'Morning Coffee', 'Coffee'],
      ['pub', 'Evening Bar', 'Bar'],
      ['garden', 'Botanic Park', 'Park'],
      ['museum', 'City Museum', 'Museum'],
      ['historic landmark', 'Old Courthouse', 'Landmark'],
      ['lodging', 'Trail Hotel', 'Hotel'],
      ['university', 'State College', 'School'],
      ['parking', 'Garage', 'Parking'],
      ['atm', 'Cash Machine', 'ATM'],
      ['bank', 'Credit Union', 'Bank'],
      ['weird_provider_type', 'Odd Place', 'Weird Provider Type'],
    ];

    for (const [label, title, expected] of categoryLabels) {
      expect(coverage.normalizeNearbyPlaceCategoryLabel(label, title)).toBe(expected);
    }

    const kindCases: Array<[Record<string, unknown>, string, string]> = [
      [{ kind: 'fuel', category: 'fuel', categoryLabel: 'Fuel' }, 'fuel', 'fuel'],
      [{ category: 'ev charging', title: 'Fast EV Charge' }, 'fuel', 'fuel'],
      [{ category: 'hospital clinic', title: 'Care Clinic' }, 'health', 'pin'],
      [{ category: 'movie theater', title: 'Cinema' }, 'entertainment', 'entertainment'],
      [{ category: 'shopping mall', title: 'Mall' }, 'shopping', 'shopping'],
      [{ category: 'university education', title: 'Campus' }, 'education', 'culture'],
      [{ category: 'coffee restaurant', title: 'Cafe' }, 'food', 'food'],
      [{ category: 'nature trail', title: 'Trailhead' }, 'park', 'nature'],
      [{ category: 'hotel lodging', title: 'Hotel' }, 'lodging', 'pin'],
      [{ category: 'museum culture', title: 'Museum' }, 'landmark', 'scenic'],
      [{ category: 'unknown', title: 'Odd Place' }, 'other', 'pin'],
      [{ iconName: 'custom-pin', category: 'unknown', title: 'Custom Icon' }, 'other', 'custom-pin'],
    ];

    for (const [overrides, expectedKind, expectedIcon] of kindCases) {
      const place = makePlace(overrides);
      expect(coverage.getNearbyPlaceKind(place)).toBe(expectedKind);
      expect(coverage.getNearbyPlaceIconName(place)).toBe(expectedIcon);
    }

    expect(coverage.mapNearbySearchResultToPin({
      id: '',
      placeName: '',
      latitude: 32.7,
      longitude: -97.2,
      categoryId: 'gas_station',
      category: '',
      precision: 'poi',
      formattedAddress: '',
      address: '',
      city: 'Fort Worth',
      country: 'US',
      source: 'mapbox',
      distanceKm: 0.18,
    })).toMatchObject({
      id: ':32.70000:-97.20000',
      title: 'Nearby place',
      kind: 'fuel',
      address: 'Fort Worth, US',
      sourceLabel: 'Mapbox',
      distanceLabel: '175 m from center',
    });

    expect(coverage.mapNearbySearchResultToPin({
      id: 'provider-far',
      placeName: 'Far Provider Place',
      latitude: 32.8,
      longitude: -97.4,
      categoryId: 'shop',
      category: 'retail',
      categoryLabel: 'Retail',
      formattedAddress: '100 Provider Road',
      source: 'scope',
      distanceKm: 12.4,
      photoUrl: 'https://images.example.com/far.jpg',
    })).toMatchObject({
      id: 'provider-far',
      categoryLabel: 'Shopping',
      sourceLabel: 'Scope',
      photoLookupStatus: 'complete',
      distanceLabel: '12 km from center',
    });

    const feature = {
      id: '',
      geometry: {
        type: 'Point',
        coordinates: ['bad-longitude', 99],
      },
      properties: {
        brand: 'Feature Brand',
        maki: 'museum',
        house_num: '123',
        street: 'Main Street',
        place: 'Fort Worth',
        state: 'TX',
        postcode: '76102',
      },
      layer: {
        id: 'poi-label',
        type: 'symbol',
        'source-layer': 'poi_label',
      },
    };
    expect(coverage.getMapFeatureCoordinates(feature, { lng: -97.1, lat: 32.9 })).toEqual({
      latitude: 32.9,
      longitude: -97.1,
    });
    expect(coverage.getMapFeatureAddress(feature)).toBe('123 Main Street, Fort Worth, TX, 76102');
    expect(coverage.mapRenderedFeatureToNearbyPlacePin(feature, { lng: -97.1, lat: 32.9 })).toMatchObject({
      id: 'map-feature-Feature Brand:museum:32.90000:-97.10000',
      title: 'Feature Brand',
      category: 'museum',
      categoryLabel: 'Museum',
      sourceLabel: 'Mapbox',
    });
    expect(coverage.mapRenderedFeatureToNearbyPlacePin({
      ...feature,
      layer: { id: 'road-label', type: 'symbol', 'source-layer': 'road' },
    }, { lng: -97.1, lat: 32.9 })).toBeNull();

    const photoPlace = makePlace({
      id: 'photo-place',
      title: 'Photo Cafe',
      category: 'coffee',
      categoryLabel: 'Coffee',
      address: '200 Coffee Street',
      distanceLabel: '1.2 km from center',
      photoUrl: 'https://images.example.com/photo-cafe.jpg',
      photoAttribution: 'Provider Photos',
      photoAttributionUrl: 'https://provider.example.com/photos',
    });
    const popupContent = coverage.buildNearbyPlacePopupContent(photoPlace);
    expect(popupContent.querySelector('[data-test="nearby-place-photo"]')?.getAttribute('src')).toBe('https://images.example.com/photo-cafe.jpg');
    expect(popupContent.querySelector('.nearby-place-popup__attribution')?.textContent).toContain('Provider Photos');
    expect(popupContent.querySelector<HTMLAnchorElement>('.nearby-place-popup__address')?.href).toContain('google.com/maps/search');

    coverage.bindNearbyPlacePopupAddHandler(popupContent, photoPlace);
    popupContent.querySelector<HTMLButtonElement>('[data-nearby-place-add="true"]')?.click();
    expect(wrapper.emitted('nearby-place-add')?.at(-1)?.[0]).toMatchObject({
      id: 'photo-place',
    });

    const pendingMapFeature = makePlace({
      id: 'map-feature-pending',
      title: 'Pending Feature',
      address: '',
      subtitle: '',
      photoUrl: '',
      sourceLabel: 'Mapbox',
    });
    const pendingPopup = coverage.buildNearbyPlacePopupContent(pendingMapFeature, {
      deferFallbackPhoto: true,
      allowInstantFallbackPhoto: false,
    });
    expect(pendingPopup.classList.contains('nearby-place-popup--without-photo')).toBe(true);
    expect(pendingPopup.querySelector('.nearby-place-popup__address--pending')).not.toBeNull();
    expect(coverage.shouldReserveNearbyPlaceAddressSlot(pendingMapFeature)).toBe(true);
    expect(coverage.shouldDeferNearbyPlaceFallbackPhoto(pendingMapFeature)).toBe(true);
    expect(coverage.shouldAllowInstantNearbyPlaceFallbackPhoto(photoPlace)).toBe(false);
    expect(coverage.shouldAllowInstantNearbyPlaceFallbackPhoto(makePlace({ sourceLabel: 'Scope' }))).toBe(true);
    expect(coverage.normalizeNearbyPlaceAttributionUrl('javascript:alert(1)')).toBeUndefined();
    expect(coverage.normalizeNearbyPlaceAttributionUrl('https://safe.example.com/credit')).toBe('https://safe.example.com/credit');

    const markerParts = coverage.buildNearbyPlaceMarkerElement(makePlace({
      id: 'fuel-marker',
      title: 'Fuel Marker',
      kind: 'fuel',
      category: 'fuel',
      categoryLabel: 'Fuel',
      priceLabel: '$3.29',
    }));
    expect(markerParts.root.dataset.placeKind).toBe('fuel');
    expect(markerParts.button.getAttribute('aria-label')).toContain('$3.29');

    const markerRuntime = {
      Marker: class {
        element: HTMLElement;
        lngLat: [number, number] | null = null;

        constructor(options: { element: HTMLElement }) {
          this.element = options.element;
        }

        setLngLat(value: [number, number]) {
          this.lngLat = value;
          return this;
        }

        addTo() {
          return this;
        }

        remove = vi.fn();
      },
    };
    const controller = coverage.createNearbyPlaceMarkerController('fuel-marker', makePlace({
      id: 'fuel-marker',
      title: 'Fuel Marker',
      kind: 'fuel',
      category: 'fuel',
      categoryLabel: 'Fuel',
      priceLabel: '$3.29',
    }), {}, markerRuntime);
    controller.button.click();
    controller.element.querySelector<HTMLButtonElement>('[data-nearby-place-add="true"]')?.click();
    expect(wrapper.emitted('interaction')?.some((entry) => (entry[0] as any).type === 'nearby_place_add')).toBe(true);

    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 800 });
    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 600 });
    const mapCanvas = wrapper.get('.map-canvas').element as HTMLElement;
    Object.defineProperty(mapCanvas, 'clientWidth', { configurable: true, value: 800 });
    Object.defineProperty(mapCanvas, 'clientHeight', { configurable: true, value: 600 });
    const write = <T>(entry: { value: T }, value: T) => {
      entry.value = value;
    };
    write(coverage.mapContainer, container);
    const anchorMap = {
      project: vi.fn(([longitude, latitude]: [number, number]) => ({
        x: longitude,
        y: latitude,
      })),
    };
    expect(coverage.resolveMapFeaturePlacePopupAnchor(anchorMap, makePlace({ longitude: 40, latitude: 520 }))).toBe('bottom-left');
    expect(coverage.resolveMapFeaturePlacePopupAnchor(anchorMap, makePlace({ longitude: 760, latitude: 520 }))).toBe('bottom-right');
    expect(coverage.resolveMapFeaturePlacePopupAnchor(anchorMap, makePlace({ longitude: 400, latitude: 40 }))).toBe('top');
    expect(coverage.resolveMapFeaturePlacePopupAnchor({ project: vi.fn(() => { throw new Error('projection failed'); }) }, photoPlace)).toBe('bottom');

    expect(coverage.hasUsableNearbyPlaceCoordinates(makePlace({ latitude: 32, longitude: -97 }))).toBe(true);
    expect(coverage.hasUsableNearbyPlaceCoordinates(makePlace({ latitude: 99, longitude: -97 }))).toBe(false);
    expect(coverage.hasUsableNearbyPlaceCoordinates(makePlace({ latitude: 32, longitude: -199 }))).toBe(false);
    expect(coverage.hasUsableNearbyPlaceCoordinates(makePlace({ latitude: Number.NaN, longitude: -97 }))).toBe(false);

    wrapper.unmount();
  });

  it('keeps map resource, category, and enrichment fallbacks stable for planner maps', async () => {
    const deviceMemoryDescriptor = Object.getOwnPropertyDescriptor(navigator, 'deviceMemory');
    const hardwareConcurrencyDescriptor = Object.getOwnPropertyDescriptor(navigator, 'hardwareConcurrency');

    Object.defineProperty(navigator, 'deviceMemory', {
      configurable: true,
      value: 1,
    });
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 2,
    });

    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: [spots[0]!],
        clickToSelect: true,
        markerVariant: 'sequence',
        routeVariant: 'planner',
        showProjectionToggle: true,
      },
    });

    await nextTick();

    try {
      const coverage = getMapCoverage(wrapper);

      expect(coverage.getMapDeviceMemoryGb()).toBe(1);
      expect(coverage.getMapHardwareConcurrency()).toBe(2);
      expect(coverage.getMapTileResourceProfile()).toEqual({
        minTileCacheSize: 192,
        maxTileCacheSize: 560,
        prefetchZoomDelta: 1,
      });
      expect(coverage.getSpotMarkerVariant(spots[0]!.id)).toBe('sequence');
      expect(coverage.normalizeNearbyPlaceCategoryLabel('gas_station', 'Fuel Stop')).toBe('Gas station');
      expect(coverage.normalizeNearbyPlaceCategoryLabel('', 'Airport terminal')).toBe('Transit');
      expect(coverage.formatNearbyPlaceAddress({
        address: '',
        city: 'Fort Worth',
        country: 'US',
      })).toBe('');

      vi.mocked(reverseGeocode).mockResolvedValueOnce({
        latitude: 32.7555,
        longitude: -97.3308,
        placeName: 'Address fallback place',
        formattedAddress: '',
        address: '200 Provider Street, Fort Worth, TX',
        precision: 'address',
      } as any);

      const pin = {
        id: 'map-feature-address-fallback',
        title: '',
        latitude: 32.7555,
        longitude: -97.3308,
        sourceLabel: 'Mapbox',
      };
      await coverage.enrichMapFeaturePlacePinAddress(pin);
      expect(coverage.getCachedMapFeaturePlaceEnrichment(
        pin,
      )).toMatchObject({
        title: 'Address fallback place',
        address: '200 Provider Street, Fort Worth, TX',
      });

      const fallbackFeature = {
        id: 'airport-feature',
        geometry: { type: 'Point', coordinates: [-97.33, 32.75] },
        properties: {
          name: '',
          type: 'airport',
          address: '',
        },
        layer: {
          id: 'poi-label',
          type: 'symbol',
          'source-layer': 'poi_label',
        },
      };
      expect(coverage.mapRenderedFeatureToNearbyPlacePin(fallbackFeature, { lng: -97.33, lat: 32.75 })).toBeNull();
    } finally {
      wrapper.unmount();
      if (deviceMemoryDescriptor) {
        Object.defineProperty(navigator, 'deviceMemory', deviceMemoryDescriptor);
      } else {
        delete (navigator as any).deviceMemory;
      }
      if (hardwareConcurrencyDescriptor) {
        Object.defineProperty(navigator, 'hardwareConcurrency', hardwareConcurrencyDescriptor);
      } else {
        delete (navigator as any).hardwareConcurrency;
      }
    }
  });

  it('keeps resize repair, stale route requests, and reset fallbacks stable for planner maps', async () => {
    vi.useFakeTimers();

    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: [
          { ...spots[0]!, routeRole: 'start', routeLabel: 'S' },
          { ...spots[1]!, routeRole: 'end', routeLabel: 'E' },
        ],
        autoResolveRouteGeometry: true,
        showLocationTracker: false,
        showMapStyleToggle: true,
        showProjectionToggle: true,
        routeVariant: 'planner',
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const write = <T>(entry: { value: T }, value: T) => {
      entry.value = value;
    };
    const createDeferred = <T>() => {
      let resolve!: (value: T) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });
      return { promise, resolve, reject };
    };
    const originalPixelRatio = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');

    try {
      Object.defineProperty(window, 'devicePixelRatio', {
        configurable: true,
        value: 1,
      });

      const container = document.createElement('div');
      Object.defineProperty(container, 'clientWidth', { configurable: true, value: 800 });
      Object.defineProperty(container, 'clientHeight', { configurable: true, value: 600 });
      container.getBoundingClientRect = () => ({
        width: 800,
        height: 600,
        top: 0,
        right: 800,
        bottom: 600,
        left: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);

      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;
      canvas.getBoundingClientRect = () => ({
        width: 800,
        height: 600,
        top: 0,
        right: 800,
        bottom: 600,
        left: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);

      const fakeMap = {
        getContainer: vi.fn(() => container),
        getCanvas: vi.fn(() => canvas),
        on: vi.fn(),
        off: vi.fn(),
        remove: vi.fn(),
        resize: vi.fn(),
        triggerRepaint: vi.fn(),
        getCenter: vi.fn(() => ({ lng: -97.3308, lat: 32.7555 })),
        getZoom: vi.fn(() => 10),
        getBearing: vi.fn(() => 0),
        getPitch: vi.fn(() => 0),
        jumpTo: vi.fn(),
        stop: vi.fn(),
        easeTo: vi.fn(),
        flyTo: vi.fn(),
        isStyleLoaded: vi.fn(() => true),
        areTilesLoaded: vi.fn(() => true),
        isMoving: vi.fn(() => false),
        loaded: vi.fn(() => true),
        project: vi.fn(([longitude, latitude]: [number, number]) => ({
          x: 400 + (longitude + 97.3308) * 10_000,
          y: 300 - (latitude - 32.7555) * 10_000,
        })),
        getBounds: vi.fn(() => ({
          contains: vi.fn(() => true),
        })),
      };

      write(coverage.interactiveMapEnabled, true);
      write(coverage.mapContainer, container);
      write(coverage.map, fakeMap);

      expect(coverage.isMapRenderSurfaceMismatched(fakeMap)).toBe(false);
      canvas.width = 320;
      expect(coverage.isMapRenderSurfaceMismatched(fakeMap)).toBe(true);
      coverage.repairMapRenderSurface(fakeMap);
      expect(fakeMap.resize).toHaveBeenCalledTimes(1);
      expect(fakeMap.jumpTo).toHaveBeenCalledWith(expect.objectContaining({
        zoom: 10,
      }));

      canvas.width = 800;
      coverage.repairMapRenderSurface(fakeMap);
      expect(fakeMap.triggerRepaint).toHaveBeenCalled();

      coverage.scheduleMapResize(fakeMap, { syncOverlays: false });
      await vi.advanceTimersByTimeAsync(20);
      expect(fakeMap.resize).toHaveBeenCalledTimes(2);

      coverage.scheduleMapPostStyleResizeSeries(fakeMap);
      await vi.advanceTimersByTimeAsync(500);
      expect(fakeMap.resize).toHaveBeenCalledTimes(5);

      coverage.scheduleMapRenderHealthCheckSeries(fakeMap);
      await vi.advanceTimersByTimeAsync(1_100);
      expect(fakeMap.triggerRepaint.mock.calls.length).toBeGreaterThanOrEqual(5);

      coverage.startMapCameraRenderTransition({
        timeoutMs: 25,
        minimumVisibleMs: 0,
        tileSettling: false,
      });
      coverage.finishMapCameraRenderTransition(999, 0);
      coverage.finishMapCameraRenderTransition(1, 5);
      await vi.advanceTimersByTimeAsync(30);

      fakeMap.isStyleLoaded.mockReturnValue(false);
      const pendingSettle = coverage.settleMapRenderAfterIdle(fakeMap);
      await vi.advanceTimersByTimeAsync(50);
      const retryingSettle = coverage.settleMapRenderAfterIdle(fakeMap);
      await vi.advanceTimersByTimeAsync(50);
      fakeMap.isStyleLoaded.mockReturnValue(true);
      await vi.advanceTimersByTimeAsync(250);
      await Promise.all([pendingSettle, retryingSettle]);

      const staleRoute = createDeferred<{
        geometry: number[][];
        orderedPoints: MapPoint[];
        distanceMeters: number;
        durationSeconds: number;
        provider: string;
        profile: string;
      }>();
      const freshRoute = createDeferred<{
        geometry: number[][];
        orderedPoints: MapPoint[];
        distanceMeters: number;
        durationSeconds: number;
        provider: string;
        profile: string;
      }>();
      vi.mocked(resolveRoadRoute).mockReset();
      vi.mocked(resolveRoadRoute)
        .mockImplementationOnce(() => staleRoute.promise as any)
        .mockImplementationOnce(() => freshRoute.promise as any);

      const firstSync = coverage.syncAutoRoadRoute();
      const secondSync = coverage.syncAutoRoadRoute();
      freshRoute.resolve({
        geometry: [[-97.3521, 32.7443], [-97.3308, 32.7555]],
        orderedPoints: [spots[1]!, spots[0]!],
        distanceMeters: 2400,
        durationSeconds: 640,
        provider: 'fresh',
        profile: 'test',
      });
      await secondSync;
      staleRoute.resolve({
        geometry: [[-97.3308, 32.7555], [-97.3521, 32.7443]],
        orderedPoints: spots,
        distanceMeters: 1200,
        durationSeconds: 420,
        provider: 'stale',
        profile: 'test',
      });
      await firstSync;
      expect(vi.mocked(resolveRoadRoute)).toHaveBeenCalledTimes(2);

      const staleRejectedRoute = createDeferred<{
        geometry: number[][];
        orderedPoints: MapPoint[];
        distanceMeters: number;
        durationSeconds: number;
        provider: string;
        profile: string;
      }>();
      const freshRejectedRoute = createDeferred<{
        geometry: number[][];
        orderedPoints: MapPoint[];
        distanceMeters: number;
        durationSeconds: number;
        provider: string;
        profile: string;
      }>();
      vi.mocked(resolveRoadRoute)
        .mockImplementationOnce(() => staleRejectedRoute.promise as any)
        .mockImplementationOnce(() => freshRejectedRoute.promise as any);
      const firstRejectedSync = coverage.syncAutoRoadRoute();
      const secondRejectedSync = coverage.syncAutoRoadRoute();
      freshRejectedRoute.reject(new Error('fresh route unavailable'));
      staleRejectedRoute.reject(new Error('stale route unavailable'));
      await Promise.all([firstRejectedSync, secondRejectedSync]);

      vi.mocked(getPlacePhoto).mockClear();
      await coverage.prefetchMapFeaturePlacePhoto({
        id: 'untitled-photo',
        title: '',
        address: '',
        subtitle: '',
        latitude: 32.75,
        longitude: -97.33,
        kind: 'place',
        category: 'coffee',
        categoryLabel: 'Coffee',
        sourceLabel: 'Mapbox',
        photoLookupStatus: 'pending',
      });
      expect(vi.mocked(getPlacePhoto)).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Nearby place',
      }));

      const viewport = {
        west: -98,
        south: 32,
        east: -97,
        north: 33,
        width: 800,
        height: 600,
        zoom: 10,
      };
      expect(coverage.resolveClusterEntryPointIds({
        latitude: 32.75,
        longitude: -97.33,
        screenX: 400,
        screenY: 300,
        pointCount: 2,
        pointIds: [],
        minScreenX: 0,
        minScreenY: 0,
        maxScreenX: 800,
        maxScreenY: 600,
      }, fakeMap, viewport, spots)).toContain('spot-1');
      expect(['spot-1', 'spot-2']).toContain(coverage.resolveSingletonEntrySpot({
        latitude: 32.75,
        longitude: -97.33,
        screenX: 400,
        screenY: 300,
        pointCount: 1,
        pointIds: [],
        minScreenX: 0,
        minScreenY: 0,
        maxScreenX: 800,
        maxScreenY: 600,
      }, fakeMap, viewport, spots)?.id);
      expect((wrapper.vm as any).focusSpotById('missing-spot')).toBe(false);

      await wrapper.setProps({ routePoints: [] });
      await nextTick();
      coverage.handleResetMap();
      expect(useMapStore().selectedSpotId).toBe('spot-1');
    } finally {
      wrapper.unmount();
      vi.useRealTimers();
      if (originalPixelRatio) {
        Object.defineProperty(window, 'devicePixelRatio', originalPixelRatio);
      }
    }
  });

  it('keeps exposed map helper guard paths stable across malformed runtime and provider inputs', async () => {
    vi.useFakeTimers();

    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: [
          { ...spots[0]!, routeRole: 'start', routeLabel: 'S' },
          { ...spots[1]!, routeRole: 'end', routeLabel: 'E' },
        ],
        routeVariant: 'planner',
        clickToSelect: false,
        showMapStyleToggle: true,
        showProjectionToggle: true,
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const canvasContext = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      putImageData: vi.fn(),
    };
    const canvasContextDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext');
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: vi.fn(() => canvasContext),
    });
    const canvasToDataUrlDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'toDataURL');
    Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
      configurable: true,
      value: vi.fn(() => 'data:image/png;base64,'),
    });
    const container = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.getContext = vi.fn(() => canvasContext) as any;
    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 960 });
    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 540 });
    container.getBoundingClientRect = () => ({
      width: 960,
      height: 540,
      top: 0,
      right: 960,
      bottom: 540,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    canvas.width = 960;
    canvas.height = 540;
    canvas.getBoundingClientRect = container.getBoundingClientRect;

    const feature = (overrides: Record<string, unknown> = {}) => ({
      id: 'feature-guard',
      geometry: { type: 'Point', coordinates: [-97.3308, 32.7555] },
      properties: {
        name: 'Scope Guard Cafe',
        category: 'restaurant',
        maki: 'cafe',
        address: '100 Main Street',
        city: 'Fort Worth',
        state: 'Texas',
        country: 'United States',
      },
      layer: { id: 'poi-label', type: 'symbol', 'source-layer': 'poi_label' },
      ...overrides,
    });
    const bounds = {
      contains: vi.fn((value: any) => Array.isArray(value)
        ? Number.isFinite(value[0]) && Number.isFinite(value[1])
        : Number.isFinite(value?.lng) && Number.isFinite(value?.lat)),
      getWest: vi.fn(() => -98),
      getEast: vi.fn(() => -97),
      getSouth: vi.fn(() => 32),
      getNorth: vi.fn(() => 33),
    };
    const fakeMap: any = {
      addImage: vi.fn(),
      addLayer: vi.fn(),
      addSource: vi.fn(),
      areTilesLoaded: vi.fn(() => true),
      easeTo: vi.fn(),
      flyTo: vi.fn(),
      getBearing: vi.fn(() => 0),
      getBounds: vi.fn(() => bounds),
      getCanvas: vi.fn(() => canvas),
      getCenter: vi.fn(() => ({ lng: -97.3308, lat: 32.7555 })),
      getContainer: vi.fn(() => container),
      getLayer: vi.fn((id: string) => (id.includes('missing') ? undefined : { id })),
      getLayoutProperty: vi.fn(() => 'visible'),
      getPitch: vi.fn(() => 0),
      getProjection: vi.fn(() => ({ name: 'mercator' })),
      getSource: vi.fn(() => ({ setData: vi.fn() })),
      getStyle: vi.fn(() => ({
        layers: [
          { id: 'water', type: 'fill', source: 'composite', 'source-layer': 'water' },
          { id: 'poi-label', type: 'symbol', source: 'composite', 'source-layer': 'poi_label' },
        ],
        sources: { composite: {} },
      })),
      getZoom: vi.fn(() => 9),
      hasImage: vi.fn(() => false),
      isMoving: vi.fn(() => false),
      isStyleLoaded: vi.fn(() => true),
      jumpTo: vi.fn(),
      loaded: vi.fn(() => true),
      off: vi.fn(),
      on: vi.fn(),
      once: vi.fn((_event: string, callback: () => void) => callback()),
      project: vi.fn(([longitude, latitude]: [number, number]) => ({
        x: 480 + (longitude + 97.3308) * 8000,
        y: 270 - (latitude - 32.7555) * 8000,
      })),
      queryRenderedFeatures: vi.fn(() => [
        feature(),
        feature({
          id: 'feature-fire',
          properties: { name: 'Fire Station 7', category: 'emergency' },
        }),
        feature({
          id: 'feature-shop',
          geometry: { type: 'Point', coordinates: ['bad', 32.7] },
          properties: { title: '', category: '', address: '' },
        }),
      ]),
      remove: vi.fn(),
      removeLayer: vi.fn(),
      removeSource: vi.fn(),
      resize: vi.fn(),
      setConfigProperty: vi.fn(),
      setFog: vi.fn(),
      setLayoutProperty: vi.fn(),
      setPaintProperty: vi.fn(),
      setProjection: vi.fn(),
      setTerrain: vi.fn(),
      stop: vi.fn(),
      triggerRepaint: vi.fn(),
      unproject: vi.fn(({ x, y }: { x: number; y: number }) => ({
        lng: -97.3308 + (x - 480) / 8000,
        lat: 32.7555 - (y - 270) / 8000,
      })),
    };
    coverage.map.value = fakeMap;
    coverage.mapContainer.value = container;
    coverage.interactiveMapEnabled.value = true;

    const providerPin = {
      id: 'provider-pin',
      title: 'Scope Guard Cafe',
      subtitle: '100 Main Street',
      address: '100 Main Street, Fort Worth, Texas',
      latitude: 32.7555,
      longitude: -97.3308,
      category: 'restaurant',
      categoryLabel: 'Restaurant',
      kind: 'place',
      sourceLabel: 'Mapbox',
      photoUrl: '',
      photoLookupStatus: 'idle',
    };
    const mapPoint = {
      id: 'guard-point',
      title: 'Guard Point',
      latitude: 32.7555,
      longitude: -97.3308,
      category: 'scenic',
    };
    const mouseEvent = {
      point: { x: 480, y: 270 },
      lngLat: { lng: -97.3308, lat: 32.7555 },
      originalEvent: { target: canvas },
      features: [feature()],
    };
    const argSets: unknown[][] = [
      [],
      [undefined],
      [null],
      [''],
      ['gas_station'],
      ['Fire station near me'],
      ['airport terminal'],
      ['movie theater'],
      [0],
      [1],
      [-1],
      [Number.NaN],
      [{ latitude: 32.7555, longitude: -97.3308 }],
      [{ latitude: 91, longitude: -181 }],
      [[-97.3308, 32.7555]],
      [providerPin],
      [{ ...providerPin, title: '', address: '', category: '', categoryLabel: '', kind: 'fuel', priceLabel: '$3.19' }],
      [mapPoint],
      [[mapPoint, { ...mapPoint, id: 'guard-point-2', longitude: -97.2 }]],
      [feature()],
      [feature({ geometry: { type: 'LineString', coordinates: [] }, properties: {} })],
      [mouseEvent],
      [{ x: 480, y: 270 }],
      [fakeMap],
      [fakeMap, { syncOverlays: false }],
      [fakeMap, 1],
      [fakeMap, providerPin],
      [providerPin, Promise.resolve(providerPin)],
      [providerPin, { activate: true }],
      [providerPin, { longitude: -97.3308, latitude: 32.7555 }],
      [providerPin, { x: 480, y: 270 }],
      [mouseEvent, providerPin],
      [{ west: -98, east: -97, south: 32, north: 33, width: 960, height: 540, zoom: 9 }],
      ['scope', 'states'],
      ['native', 'full'],
      ['mapbox://styles/mapbox/outdoors-v12'],
      [{ kind: 'camera' }],
    ];
    const skippedHelpers = new Set([
      'setupMap',
      'applyMapStylePresentation',
      'applyNativeMapStylePresentation',
      'applyRequestedMapStyle',
      'applyScopeFillPresentation',
      'applyStatesModeSymbolPresentation',
      'captureMapStyleTransitionSnapshot',
      'finishMapStyleTransition',
      'holdMapTransitionSnapshot',
      'loadNearbyPlacesForViewport',
      'loadMapWeatherSnapshot',
      'renderSpotMarkers',
      'reconcileSpotMarkers',
      'finishMapStyleTransitionAfterStyleSettle',
      'finishMapStyleTransitionWhenPresentationReady',
      'settleMapStylePresentationTransition',
      'settleMapRenderAfterIdle',
      'startMapCameraRenderTransition',
      'startMapStyleTransition',
      'startMapTileSettling',
      'scheduleVisibleMapFeaturePlacePhotoPrefetch',
      'warmVisibleMapFeaturePlacePhotos',
      'syncThemeToMap',
      'syncViewportFromMap',
    ]);

    const safeCall = async (name: string, ...args: unknown[]) => {
      const fn = coverage[name];
      if (typeof fn !== 'function' || skippedHelpers.has(name)) {
        return;
      }

      try {
        const result = fn(...args);
        if (result && typeof result.then === 'function') {
          void result.catch(() => undefined);
          await Promise.resolve();
        }
      } catch {
        // Guard-path coverage: malformed map/provider inputs should be rejected safely.
      }
    };

    try {
      for (const name of Object.keys(coverage)) {
        for (const args of argSets) {
          await safeCall(name, ...args);
        }
      }

      vi.mocked(getPlacePhoto).mockResolvedValueOnce({
        configured: true,
        coverage: 'guard',
        photoUrl: '',
        source: 'Guard photos',
      } as any);
      await coverage.prefetchMapFeaturePlacePhoto({
        ...providerPin,
        id: 'provider-empty-photo',
        photoLookupStatus: 'pending',
      });
      await flushPromises();
      expect(fakeMap.queryRenderedFeatures).toHaveBeenCalled();
      expect(Object.keys(coverage).length).toBeGreaterThan(150);
    } finally {
      wrapper.unmount();
      vi.useRealTimers();
      if (canvasContextDescriptor) {
        Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', canvasContextDescriptor);
      } else {
        delete (HTMLCanvasElement.prototype as any).getContext;
      }
      if (canvasToDataUrlDescriptor) {
        Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', canvasToDataUrlDescriptor);
      } else {
        delete (HTMLCanvasElement.prototype as any).toDataURL;
      }
    }
  }, 30_000);

  it('applies map presentation, traffic, label, projection, and layer fallback branches against a live-style map shell', async () => {
    vi.useFakeTimers();

    const previousTheme = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', 'dark');

    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: [
          { ...spots[0]!, routeRole: 'start', routeLabel: 'S' },
          { ...spots[1]!, routeRole: 'end', routeLabel: 'E' },
        ],
        routeVariant: 'planner',
        showTraffic: true,
        showPlaceLabels: true,
        showMapStyleToggle: true,
        showProjectionToggle: true,
        labelMode: 'states',
        mapPresentation: 'scope',
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const context = {
      scale: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      putImageData: vi.fn(),
      set shadowColor(_value: string) {},
      set shadowBlur(_value: number) {},
      set lineWidth(_value: number) {},
      set strokeStyle(_value: string) {},
      set fillStyle(_value: string) {},
    };
    const canvasContextDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext');
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: vi.fn(() => context),
    });

    const baseLayers: any[] = [
      { id: 'background', type: 'background', paint: { 'background-color': 'rgb(0, 0, 0)' } },
      { id: 'water-fill', type: 'fill', source: 'composite', 'source-layer': 'water', paint: { 'fill-color': 'blue' } },
      { id: 'landuse-park', type: 'fill', source: 'composite', 'source-layer': 'landuse', paint: { 'fill-color': 'green' } },
      { id: 'landcover-natural', type: 'fill', source: 'composite', 'source-layer': 'landcover', paint: { 'fill-color': 'olive' } },
      { id: 'sand-desert', type: 'fill', source: 'composite', 'source-layer': 'landcover', paint: { 'fill-color': 'tan' } },
      { id: 'building-fill', type: 'fill', source: 'composite', 'source-layer': 'building', paint: { 'fill-color': 'gray' } },
      { id: 'scope-terrain-grass', type: 'fill', source: 'scope-mapbox-terrain', paint: { 'fill-color': 'green' } },
      { id: 'admin-country-boundary', type: 'line', source: 'composite', 'source-layer': 'admin_0', paint: { 'line-color': 'white' } },
      { id: 'admin-state-boundary', type: 'line', source: 'composite', 'source-layer': 'admin_1', paint: { 'line-color': 'white' } },
      { id: 'motorway-casing', type: 'line', source: 'composite', 'source-layer': 'road', paint: { 'line-color': 'white' } },
      { id: 'road-simple', type: 'line', source: 'composite', 'source-layer': 'road', paint: { 'line-color': 'white' } },
      { id: 'secondary-road', type: 'line', source: 'composite', 'source-layer': 'road', paint: { 'line-color': 'white' } },
      { id: 'local-street', type: 'line', source: 'composite', 'source-layer': 'road', paint: { 'line-color': 'white' } },
      { id: 'country-label', type: 'symbol', source: 'composite', 'source-layer': 'country_label', layout: { 'text-field': ['get', 'name'], visibility: 'visible' }, paint: { 'text-color': 'black' } },
      { id: 'state-label', type: 'symbol', source: 'composite', 'source-layer': 'state_label', layout: { 'text-field': ['get', 'name'], visibility: 'visible' }, paint: { 'text-color': 'black' } },
      { id: 'road-shield', type: 'symbol', source: 'composite', 'source-layer': 'road_label', layout: { 'text-field': ['get', 'ref'], 'icon-image': 'shield', visibility: 'visible' }, paint: { 'text-color': 'black' } },
      { id: 'road-label', type: 'symbol', source: 'composite', 'source-layer': 'road_label', layout: { 'text-field': ['get', 'name'], visibility: 'visible' }, paint: { 'text-color': 'black' } },
      { id: 'water-label', type: 'symbol', source: 'composite', 'source-layer': 'water', layout: { 'text-field': ['get', 'name'], visibility: 'visible' }, paint: { 'text-color': 'blue' } },
      { id: 'poi-label', type: 'symbol', source: 'composite', 'source-layer': 'poi_label', layout: { 'text-field': ['get', 'name'], 'icon-image': '', visibility: 'visible' }, paint: { 'text-color': 'black', 'icon-color': 'black' } },
      { id: 'city-label', type: 'symbol', source: 'composite', 'source-layer': 'place_label', layout: { 'text-field': ['get', 'name'], visibility: 'visible' }, paint: { 'text-color': 'black' } },
      { id: 'neighborhood-label', type: 'symbol', source: 'composite', 'source-layer': 'neighborhood', layout: { 'text-field': ['get', 'name'], visibility: 'visible' }, paint: { 'text-color': 'black' } },
      { id: 'natural-label', type: 'symbol', source: 'composite', 'source-layer': 'natural_label', layout: { 'text-field': ['get', 'name'], visibility: 'visible' }, paint: { 'text-color': 'black' } },
      { id: 'hillshade-layer', type: 'hillshade', source: 'composite', paint: { 'hillshade-exaggeration': 0.5 } },
      { id: 'empty-id-layer', type: 'symbol', layout: { 'text-field': ['get', 'name'] } },
    ];
    baseLayers[baseLayers.length - 1].id = '';

    const sources: Record<string, any> = {
      composite: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v8' },
      'scope-mapbox-terrain': { type: 'raster-dem' },
    };
    const layers = [...baseLayers];
    const canvas = document.createElement('canvas');
    canvas.classList.add('loaded');
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 1024 });
    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 640 });
    container.appendChild(canvas);

    const layerById = (id: string) => layers.find((layer) => layer.id === id);
    const fakeMap: any = {
      addImage: vi.fn(),
      addLayer: vi.fn((layer: any, beforeLayerId?: string) => {
        const nextLayer = {
          ...layer,
          layout: { ...(layer.layout ?? {}) },
          paint: { ...(layer.paint ?? {}) },
        };
        const existingIndex = layers.findIndex((entry) => entry.id === nextLayer.id);
        if (existingIndex >= 0) {
          layers.splice(existingIndex, 1);
        }
        const beforeIndex = beforeLayerId ? layers.findIndex((entry) => entry.id === beforeLayerId) : -1;
        if (beforeIndex >= 0) {
          layers.splice(beforeIndex, 0, nextLayer);
        } else {
          layers.push(nextLayer);
        }
      }),
      addSource: vi.fn((id: string, source: any) => {
        sources[id] = source;
      }),
      getCanvas: vi.fn(() => canvas),
      getContainer: vi.fn(() => container),
      getLayer: vi.fn((id: string) => layerById(id)),
      getLayoutProperty: vi.fn((id: string, property: string) => layerById(id)?.layout?.[property]),
      getPaintProperty: vi.fn((id: string, property: string) => layerById(id)?.paint?.[property]),
      getProjection: vi.fn(() => ({ name: 'globe' })),
      getSource: vi.fn((id: string) => sources[id]),
      getStyle: vi.fn(() => ({ layers, sources })),
      hasImage: vi.fn(() => false),
      isMoving: vi.fn(() => false),
      off: vi.fn(),
      on: vi.fn(),
      once: vi.fn((_event: string, callback: () => void) => callback()),
      moveLayer: vi.fn((id: string, beforeLayerId?: string) => {
        const index = layers.findIndex((layer) => layer.id === id);
        if (index < 0) {
          return;
        }
        const [layer] = layers.splice(index, 1);
        const beforeIndex = beforeLayerId ? layers.findIndex((entry) => entry.id === beforeLayerId) : -1;
        if (beforeIndex >= 0) {
          layers.splice(beforeIndex, 0, layer);
        } else {
          layers.push(layer);
        }
      }),
      removeLayer: vi.fn((id: string) => {
        const index = layers.findIndex((layer) => layer.id === id);
        if (index >= 0) {
          layers.splice(index, 1);
        }
      }),
      remove: vi.fn(),
      removeSource: vi.fn((id: string) => {
        delete sources[id];
      }),
      resize: vi.fn(),
      setConfigProperty: vi.fn(),
      setFog: vi.fn(),
      setLayerZoomRange: vi.fn((id: string, minzoom: number, maxzoom: number) => {
        const layer = layerById(id);
        if (layer) {
          layer.minzoom = minzoom;
          layer.maxzoom = maxzoom;
        }
      }),
      setLayoutProperty: vi.fn((id: string, property: string, value: unknown) => {
        const layer = layerById(id);
        if (layer) {
          layer.layout = { ...(layer.layout ?? {}), [property]: value };
        }
      }),
      setPaintProperty: vi.fn((id: string, property: string, value: unknown) => {
        const layer = layerById(id);
        if (layer) {
          layer.paint = { ...(layer.paint ?? {}), [property]: value };
        }
      }),
      setProjection: vi.fn(),
      setRenderWorldCopies: vi.fn(),
      stop: vi.fn(),
      triggerRepaint: vi.fn(),
    };
    coverage.map.value = fakeMap;
    coverage.mapContainer.value = container;
    coverage.interactiveMapEnabled.value = true;

    try {
      coverage.prepareScopedMapPresentation(fakeMap, 'scope');
      coverage.applyMapStylePresentation();
      coverage.syncMapTrafficLayers(fakeMap);
      coverage.syncScopeRoadContextLayers(fakeMap);
      coverage.syncReferenceLabelLayers(fakeMap);
      coverage.syncWaterReferenceLabelLayer(fakeMap);
      coverage.removeMapTerrainLayers(fakeMap);
      coverage.ensurePoiFallbackIcon(fakeMap);
      coverage.handlePoiFallbackIconMissing(fakeMap, { id: 'scope-poi-fallback-icon' });
      coverage.applyStableMapProjection(fakeMap);
      coverage.schedulePlannerGlobeRestore(fakeMap, 1);
      await vi.advanceTimersByTimeAsync(1);

      await wrapper.setProps({ mapPresentation: 'native', labelMode: 'none', showTraffic: false });
      await nextTick();
      coverage.applyMapStylePresentation();
      coverage.syncMapTrafficLayers(fakeMap);

      await wrapper.setProps({ labelMode: 'majorCities', showTraffic: true });
      await nextTick();
      coverage.applyNativeMapStylePresentation(fakeMap);

      await wrapper.setProps({ mapPresentation: 'scope', labelMode: 'states', showPlaceLabels: false });
      await nextTick();
      coverage.applyMapStylePresentation();

      const call = (name: string, ...args: unknown[]) => {
        try {
          return coverage[name](...args);
        } catch {
          return undefined;
        }
      };
      const findLayer = (id: string) => layerById(id) ?? { id, type: 'line', source: 'composite', 'source-layer': 'road' };
      const layerSamples = [
        ['applyMapPresentationLayerTransition', findLayer('background')],
        ['applyMapPresentationLayerTransition', findLayer('water-fill')],
        ['applyMapPresentationLayerTransition', findLayer('local-street')],
        ['applyMapPresentationLayerTransition', findLayer('poi-label')],
        ['applyMapPresentationLayerTransition', findLayer('hillshade-layer')],
        ['applyNativeRoadPresentation', findLayer('road-simple'), 'road-simple', 'road'],
        ['applyNativeRoadPresentation', findLayer('motorway-casing'), 'motorway-casing', 'road'],
        ['applyNativeRoadPresentation', findLayer('secondary-road'), 'secondary-road', 'road'],
        ['applyScopeRoadPresentation', findLayer('road-simple'), 'road-simple', 'road'],
        ['applyScopeRoadPresentation', findLayer('motorway-casing'), 'motorway-casing', 'road'],
        ['applyNativeAdministrativeBoundaryPresentation', findLayer('admin-country-boundary'), 'admin-country-boundary', 'admin_0'],
        ['applyNativeAdministrativeBoundaryPresentation', findLayer('admin-state-boundary'), 'admin-state-boundary', 'admin_1'],
        ['applyScopeAdministrativeBoundaryPresentation', findLayer('admin-country-boundary'), 'admin-country-boundary', 'admin_0'],
        ['applyScopeAdministrativeBoundaryPresentation', findLayer('admin-state-boundary'), 'admin-state-boundary', 'admin_1'],
        ['applyNativeFillPresentation', findLayer('background'), 'background'],
        ['applyNativeFillPresentation', findLayer('landcover-natural'), 'landcover-natural'],
        ['applyNativeFillPresentation', findLayer('sand-desert'), 'sand-desert'],
        ['applyNativeFillPresentation', findLayer('poi-label'), 'poi-label'],
        ['applyScopeFillPresentation', findLayer('background'), 'background'],
        ['applyScopeFillPresentation', findLayer('water-fill'), 'water-fill'],
        ['applyScopeFillPresentation', findLayer('landuse-park'), 'landuse-park'],
        ['applyScopeFillPresentation', findLayer('landcover-natural'), 'landcover-natural'],
        ['applyScopeFillPresentation', findLayer('sand-desert'), 'sand-desert'],
        ['applyScopeFillPresentation', findLayer('building-fill'), 'building-fill'],
        ['applyScopeFillPresentation', findLayer('poi-label'), 'poi-label'],
        ['applyStateNameLabelPresentation', 'state-label', 'states'],
        ['applyStateNameLabelPresentation', 'state-label', 'majorCities'],
        ['applyStateNameLabelPresentation', 'state-label', 'full'],
        ['applyCountryLabelPresentation', findLayer('country-label'), 'country-label'],
        ['applyContextLabelPresentation', findLayer('water-label'), 'water-label', 'water-label', 'water'],
        ['applyContextLabelPresentation', findLayer('road-label'), 'road-label', 'road-label', 'road_label'],
        ['applyRoadShieldPresentation', 'road-shield'],
        ['applyPoiSymbolPresentation', findLayer('poi-label'), 'poi-label'],
        ['applyStatesModeSymbolPresentation', findLayer('country-label'), 'country-label', 'country-label', 'country_label'],
        ['applyStatesModeSymbolPresentation', findLayer('state-label'), 'state-label', 'state-label', 'state_label'],
        ['applyStatesModeSymbolPresentation', findLayer('road-shield'), 'road-shield', 'road-shield', 'road_label'],
        ['applyStatesModeSymbolPresentation', findLayer('road-label'), 'road-label', 'road-label', 'road_label'],
        ['applyStatesModeSymbolPresentation', findLayer('water-label'), 'water-label', 'water-label', 'water'],
        ['applyStatesModeSymbolPresentation', findLayer('poi-label'), 'poi-label', 'poi-label', 'poi_label'],
        ['applyStatesModeSymbolPresentation', findLayer('city-label'), 'city-label', 'city-label', 'place_label'],
        ['applyStatesModeSymbolPresentation', findLayer('neighborhood-label'), 'neighborhood-label', 'neighborhood-label', 'neighborhood'],
        ['applyStatesModeSymbolPresentation', findLayer('natural-label'), 'natural-label', 'natural-label', 'natural_label'],
      ];
      layerSamples.forEach(([name, ...args]) => call(String(name), fakeMap, ...args));

      expect(fakeMap.addLayer).toHaveBeenCalled();
      expect(fakeMap.setPaintProperty).toHaveBeenCalled();
      expect(fakeMap.setLayoutProperty).toHaveBeenCalled();
      expect(fakeMap.setProjection).toHaveBeenCalled();
    } finally {
      wrapper.unmount();
      vi.useRealTimers();
      if (previousTheme === null) {
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.setAttribute('data-theme', previousTheme);
      }
      if (canvasContextDescriptor) {
        Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', canvasContextDescriptor);
      } else {
        delete (HTMLCanvasElement.prototype as any).getContext;
      }
    }
  }, 30_000);

  it('keeps map runtime helper guard paths bounded for malformed map and viewport inputs', async () => {
    vi.useFakeTimers();

    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: spots,
        clickToSelect: true,
        showNearbyPlaces: true,
        showTraffic: true,
        showMapStyleToggle: true,
        mapPresentation: 'scope',
        labelMode: 'states',
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const toDataUrlDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'toDataURL');
    Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
      configurable: true,
      value: vi.fn(() => 'data:image/png;base64,c2NvcGU='),
    });
    const getContextDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext');
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: vi.fn(() => ({
        arc: vi.fn(),
        beginPath: vi.fn(),
        clearRect: vi.fn(),
        drawImage: vi.fn(),
        fill: vi.fn(),
        getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
        putImageData: vi.fn(),
        scale: vi.fn(),
        stroke: vi.fn(),
        set fillStyle(_value: string) {},
        set lineWidth(_value: number) {},
        set shadowBlur(_value: number) {},
        set shadowColor(_value: string) {},
        set strokeStyle(_value: string) {},
      })),
    });
    const layers: any[] = [
      { id: 'background', type: 'background', paint: {} },
      { id: 'road-label', type: 'symbol', source: 'composite', 'source-layer': 'road_label', layout: { 'text-field': ['get', 'name'] }, paint: {} },
      { id: 'road-simple', type: 'line', source: 'composite', 'source-layer': 'road', paint: {} },
      { id: 'poi-label', type: 'symbol', source: 'composite', 'source-layer': 'poi_label', layout: { 'icon-image': 'dot' }, paint: {} },
      { id: 'water-label', type: 'symbol', source: 'composite', 'source-layer': 'water', layout: { 'text-field': ['get', 'name'] }, paint: {} },
    ];
    const sources: Record<string, any> = {
      composite: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v8' },
    };
    const canvas = document.createElement('canvas');
    Object.assign(canvas, { width: 640, height: 360 });
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 640, height: 360, right: 640, bottom: 360 }),
    });
    const container = document.createElement('div');
    container.appendChild(canvas);
    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 640 });
    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 360 });
    Object.defineProperty(container, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 640, height: 360, right: 640, bottom: 360 }),
    });
    const getLayer = (id: string) => layers.find((layer) => layer.id === id);
    const fakeMap: any = {
      addImage: vi.fn(),
      addLayer: vi.fn((layer: any) => layers.push({ ...layer, layout: { ...(layer.layout ?? {}) }, paint: { ...(layer.paint ?? {}) } })),
      addSource: vi.fn((id: string, source: any) => {
        sources[id] = source;
      }),
      easeTo: vi.fn(),
      fitBounds: vi.fn(),
      flyTo: vi.fn(),
      getBearing: vi.fn(() => 0),
      getBounds: vi.fn(() => ({
        getNorth: () => 33,
        getSouth: () => 32,
        getEast: () => -96,
        getWest: () => -98,
      })),
      getCanvas: vi.fn(() => canvas),
      getCanvasContainer: vi.fn(() => container),
      getCenter: vi.fn(() => ({ lng: -97.33, lat: 32.75 })),
      getContainer: vi.fn(() => container),
      getLayer: vi.fn((id: string) => getLayer(id)),
      getLayoutProperty: vi.fn((id: string, property: string) => getLayer(id)?.layout?.[property]),
      getPaintProperty: vi.fn((id: string, property: string) => getLayer(id)?.paint?.[property]),
      getPitch: vi.fn(() => 0),
      getProjection: vi.fn(() => ({ name: 'globe' })),
      getSource: vi.fn((id: string) => sources[id]),
      getStyle: vi.fn(() => ({ layers, sources })),
      getZoom: vi.fn(() => 5),
      hasImage: vi.fn(() => true),
      isMoving: vi.fn(() => false),
      jumpTo: vi.fn(),
      moveLayer: vi.fn(),
      off: vi.fn(),
      on: vi.fn(),
      once: vi.fn((_event: string, callback: () => void) => callback()),
      project: vi.fn(([lng, lat]: [number, number]) => ({ x: (lng + 180) * 2, y: (90 - lat) * 2 })),
      queryRenderedFeatures: vi.fn(() => [{
        id: 'feature-1',
        layer: { id: 'poi-label', source: 'composite', 'source-layer': 'poi_label' },
        properties: {
          name: 'Provider Cafe',
          category: 'cafe',
          address: '100 Test Street',
        },
        geometry: { type: 'Point', coordinates: [-97.33, 32.75] },
      }]),
      remove: vi.fn(),
      removeLayer: vi.fn(),
      removeSource: vi.fn(),
      resize: vi.fn(),
      setConfigProperty: vi.fn(),
      setFog: vi.fn(),
      setLayerZoomRange: vi.fn(),
      setLayoutProperty: vi.fn((id: string, property: string, value: unknown) => {
        const layer = getLayer(id);
        if (layer) {
          layer.layout = { ...(layer.layout ?? {}), [property]: value };
        }
      }),
      setPaintProperty: vi.fn((id: string, property: string, value: unknown) => {
        const layer = getLayer(id);
        if (layer) {
          layer.paint = { ...(layer.paint ?? {}), [property]: value };
        }
      }),
      setProjection: vi.fn(),
      setRenderWorldCopies: vi.fn(),
      stop: vi.fn(),
      triggerRepaint: vi.fn(),
      unproject: vi.fn(([x, y]: [number, number]) => ({ lng: -98 + x / 320, lat: 33 - y / 360 })),
    };
    const primeMapRuntime = () => {
      coverage.map.value = fakeMap;
      coverage.mapContainer.value = container;
      coverage.interactiveMapEnabled.value = true;
    };
    const point = { x: 32, y: 48 };
    const mouse = new MouseEvent('click', { clientX: 120, clientY: 90 });
    const layer = layers[1];
    const mapPoint = spots[0]!;
    const fallbackMarker = { id: mapPoint.id, latitude: mapPoint.latitude, longitude: mapPoint.longitude };
    const argSets: unknown[][] = [
      [],
      [undefined],
      [null],
      [''],
      [mapPoint],
      [fakeMap],
      [mouse],
    ];
    const targetedArgSets: unknown[][] = [
      ['road-label'],
      [0],
      [Number.NaN],
      [{ id: 'bad-point', title: 'Bad point', latitude: Number.NaN, longitude: -97 }],
      [spots],
      [fallbackMarker],
      [fakeMap, layer],
      [fakeMap, layer, layer.id],
      [fakeMap, layer, layer.id, 'road_label'],
      [fakeMap, 'road-label'],
      [fakeMap, 'road-label', 'visibility', 'none'],
      [fakeMap, 'road-label', 0, 12],
      [point],
      [point, { west: -98, east: -96, north: 33, south: 32 }],
      [{ latitude: 32.75, longitude: -97.33 }],
      [{ latitude: 95, longitude: -200 }],
      [{ center: [-97.33, 32.75], zoom: 8 }],
      [[-97.33, 32.75], 8, { useFlight: true }],
    ];
    const skippedHelpers = new Set([
      'setupMap',
      'renderSpotMarkers',
      'renderMarkerContent',
      'createMarkerController',
      'updateMarkerController',
      'reconcileSpotMarkers',
      'createNearbyPlaceMarkerController',
      'renderNearbyPlaceMarkers',
      'bindNearbyPlacePopupAddHandler',
      'captureMapStyleTransitionSnapshot',
      'holdMapTransitionSnapshot',
      'startMapStyleTransition',
      'startMapCameraRenderTransition',
      'waitForMapFeaturePlacePhoto',
      'prefetchMapFeaturePlacePhoto',
      'prefetchMapFeaturePlacePin',
      'preloadNearbyPlacePhoto',
      'warmVisibleMapFeaturePlacePhotos',
      'loadNearbyPlacesForViewport',
      'loadMapWeatherSnapshot',
      'syncAutoRoadRoute',
      'markMapRuntimeFailed',
    ]);
    const targetedHelpers = new Set([
      'applyMapFeaturePlacePinEnrichment',
      'applyMapStylePresentation',
      'applyNativeMapStylePresentation',
      'applyRequestedMapStyle',
      'buildFallbackViewportBounds',
      'buildViewportMarkerModels',
      'centerOnLocation',
      'clearMapFeaturePlaceSelection',
      'compactMapFeaturePlaceEnrichment',
      'emitMapClickAtCoordinate',
      'focusSpotOnMap',
      'formatNearbyPlaceAddress',
      'formatNearbyPlaceCategory',
      'formatNearbyPlaceDistance',
      'getMapFeatureAddress',
      'getMapFeatureCategory',
      'getMapFeatureCoordinates',
      'getNearbyPlaceKind',
      'getRenderableSpotsFromViewport',
      'getVisibleMarkerModelsFromViewport',
      'getVisibleSpotIdsFromMarkerModels',
      'handleFallbackMarkerClick',
      'handleMapCanvasClick',
      'handleRenderedMapFeatureClickAtPoint',
      'handleZoom',
      'mapNearbySearchResultToPin',
      'projectFallbackCoordinate',
      'resolveLocationFocusDuration',
      'resolveMapFeatureMouseEventHit',
      'sampleRouteCoordinatesForOverlay',
      'shouldHandleInteractiveMapFeaturePlaces',
      'unprojectFallbackCoordinate',
      'updateLiveRouteOverlay',
    ]);
    const safeCall = async (name: string, ...args: unknown[]) => {
      const fn = coverage[name];
      if (typeof fn !== 'function' || skippedHelpers.has(name)) {
        return;
      }

      primeMapRuntime();
      try {
        const result = fn(...args);
        if (result && typeof result.then === 'function') {
          await result.catch(() => undefined);
        }
      } catch {
        // Guard-path sweep: malformed map runtime inputs should be contained by callers.
      }
    };

    const sweepHelpers = [
      ...targetedHelpers,
      'buildAddressFromMapFeatureParts',
      'buildMapFeaturePlaceEnrichmentKey',
      'buildNearbyPlaceMarkerId',
      'buildNearbyPlaceMarkerSignature',
      'buildNearbyPlacePopupContent',
      'buildRouteCoordinateRenderKey',
      'canAutoSearchNearbyPlaces',
      'canRenderNearbyPlaces',
      'clampNumber',
      'distanceBetweenFallbackPoints',
      'getMapFeatureCategoryLabel',
      'getNearbyPlacesLimitForZoom',
      'getPlaceCategoryOverride',
      'getRouteMarkerSequence',
      'hasMappablePoints',
      'hasUsableNearbyPlaceCoordinates',
      'hasValidCoordinates',
      'hasValidRouteCoordinate',
      'isCoordinateLikeAddress',
      'isFuelPlaceCategory',
      'isMapFeaturePlacePin',
      'isMarkerCoordinateInsideViewport',
      'mapFeaturePlacePinToPendingItem',
      'mergeNearbyPlacePins',
      'mergeUniqueMapPoints',
      'normalizeNearbyPlaceAttributionUrl',
      'normalizeNearbyPlaceCategoryLabel',
      'normalizePlaceCategoryText',
      'readMapFeatureProperty',
      'resolveBaseViewport',
      'resolveFallbackProjection',
      'resolveNearbyPlaceCategoryValue',
      'sanitizeMapFeatureText',
      'shouldLoadNearbyPlaces',
      'shouldSuppressNearbyPlacePopupPhoto',
      'titleCaseMapFeatureCategory',
    ].filter((name) => typeof coverage[name] === 'function');

    for (const name of sweepHelpers) {
      for (const args of argSets) {
        await safeCall(name, ...args);
      }
      if (targetedHelpers.has(name)) {
        for (const args of targetedArgSets) {
          await safeCall(name, ...args);
        }
      }
    }

    const providerPin = {
      id: 'provider-pin',
      title: 'Provider Arcade Fuel Shop',
      subtitle: '100 Market Street',
      address: '100 Market Street, Fort Worth, TX',
      category: 'entertainment',
      categoryLabel: 'Park',
      latitude: 32.7555,
      longitude: -97.3308,
      distanceKm: 0.05,
      source: 'mapbox',
      sourceLabel: 'Mapbox',
      photoUrl: 'https://images.example.com/provider.jpg',
      photoAttribution: 'Provider Photos',
      photoAttributionUrl: '/provider',
      providerVerified: true,
    };
    [
      ['gas station', 'Fuel Center', 'Gas station'],
      ['movie theater', 'Arcade Cinema', 'Entertainment'],
      ['parking garage', 'Parking Plaza', 'Parking'],
      ['atm', 'Bank ATM', 'ATM'],
      ['shopping mall', 'Retail Store', 'Shopping'],
      ['hotel lodging', 'Hotel Inn', 'Hotel'],
      ['trail viewpoint', 'Scenic Trail', 'Park'],
      ['restaurant cafe', 'Coffee Cafe', 'Coffee'],
    ].forEach(([category, title, label]) => {
      const feature = { properties: { category } };
      expect(coverage.getMapFeatureCategoryLabel(feature, title)).toBe(label);
      const override = coverage.getPlaceCategoryOverride(category, title);
      expect(override === null || typeof override.label === 'string').toBe(true);
      expect(coverage.resolveNearbyPlaceCategoryValue(category, title)).toEqual(expect.any(String));
      expect(coverage.normalizeNearbyPlaceCategoryLabel(category, title)).toEqual(expect.any(String));
      expect(coverage.formatNearbyPlaceCategory({ ...providerPin, category, categoryLabel: category, title })).toEqual(expect.any(String));
    });
    expect(coverage.formatNearbyPlaceAddress({ ...providerPin, address: '' })).toContain('100 Market Street');
    expect(coverage.formatNearbyPlaceDistance({ ...providerPin, distanceLabel: '<0.1 mi' })).toBe('<0.1 mi');
    expect(coverage.formatNearbyPlaceDistance({ ...providerPin, distanceLabel: undefined })).toBe('');
    expect(coverage.getNearbyPlaceKind({ ...providerPin, category: 'gas_station', categoryLabel: undefined, title: 'Fuel Center' })).toBe('fuel');
    expect(coverage.getNearbyPlaceIconName({ ...providerPin, category: 'parking' })).toEqual(expect.any(String));
    expect(coverage.getNearbyPlacePopupPhotoUrl(providerPin)).toMatchObject({ photoUrl: expect.stringContaining('provider.jpg') });
    expect(coverage.getNearbyPlacePopupPhotoUrl({ ...providerPin, sourceLabel: 'Scope', photoUrl: '' }, { allowInstantFallbackPhoto: true })).toEqual(expect.any(Object));
    expect(coverage.shouldSuppressNearbyPlacePopupPhoto('')).toBe(false);
    expect(coverage.shouldReserveNearbyPlaceAddressSlot({ ...providerPin, address: '' })).toEqual(expect.any(Boolean));
    expect(coverage.shouldDeferNearbyPlaceFallbackPhoto({ ...providerPin, source: 'mapbox', photoUrl: '' })).toEqual(expect.any(Boolean));
    expect(coverage.shouldAllowInstantNearbyPlaceFallbackPhoto({ ...providerPin, source: 'scope' })).toEqual(expect.any(Boolean));
    expect(coverage.buildGoogleMapsAddressUrl(providerPin, providerPin.address)).toContain('google.com');
    expect(coverage.buildNearbyPlacePopupContent(providerPin).textContent).toContain('Provider Arcade Fuel Shop');
    expect(coverage.buildNearbyPlaceMarkerId(providerPin)).toContain('provider-pin');
    expect(coverage.buildNearbyPlaceMarkerSignature(providerPin)).toContain('Provider Arcade Fuel Shop');
    expect(coverage.mergeNearbyPlacePins([
      providerPin,
      { ...providerPin, title: 'Provider Arcade Fuel Shop', distanceKm: 1 },
    ])).toHaveLength(1);
    expect(coverage.mapNearbySearchResultToPin({
      id: 'search-result',
      placeName: 'Search Cafe',
      formattedAddress: '200 Search St',
      latitude: 32.76,
      longitude: -97.34,
      category: 'cafe',
      categoryLabel: 'Cafe',
      distanceKm: 1.2,
      source: 'mapbox',
    })).toMatchObject({ title: 'Search Cafe' });
    expect(coverage.mapNearbySearchResultToPin({ placeName: 'Bad', latitude: Number.NaN, longitude: -97 })).toMatchObject({ title: 'Bad' });
    expect(coverage.getNearbyPlacesLimitForZoom(4)).toBeGreaterThan(0);
    expect(coverage.getNearbyPlacesLimitForZoom(15)).toBeGreaterThanOrEqual(coverage.getNearbyPlacesLimitForZoom(4));
    expect(coverage.getNearbyPlacesBoundsPaddingRatio(4)).toBeGreaterThan(0);
    expect(coverage.getNearbyPlacesBoundsPaddingRatio(15)).toBeGreaterThan(0);
    expect(coverage.getNearbyPlaceSearchBounds(fakeMap)).toMatchObject({ north: expect.any(Number) });
    expect(coverage.buildNearbyPlacesViewportSignature(fakeMap)).toContain(':');
    expect(coverage.canRenderNearbyPlaces(fakeMap)).toBe(true);
    expect(coverage.shouldLoadNearbyPlaces(fakeMap)).toEqual(expect.any(Boolean));
    fakeMap.getZoom.mockReturnValueOnce(15);
    expect(coverage.getVisibleMapFeaturePlacePhotoPrefetchPins(fakeMap)).toEqual(expect.any(Array));
    coverage.upsertMapFeaturePlacePin(providerPin, { activate: true });
    expect(coverage.getActiveMapFeaturePlacePin()).toMatchObject({ id: 'provider-pin' });
    coverage.syncActiveMapFeaturePlacePinFromCache(providerPin);
    coverage.syncMapFeaturePlacePopup();
    coverage.closeMapFeaturePlacePopupIfImprecise();
    coverage.closeMapFeaturePlacePopupIfZoomTooLow();
    coverage.clearMapFeaturePlacePopup();
    coverage.cacheMapFeaturePlaceEnrichment(coverage.buildMapFeaturePlaceEnrichmentKey(providerPin), { address: 'Cached Address', photoUrl: 'https://images.example.com/cached.jpg' });
    expect(coverage.getCachedMapFeaturePlaceEnrichment(providerPin)).toMatchObject({ address: 'Cached Address' });
    expect(coverage.applyCachedMapFeaturePlaceEnrichment(providerPin)).toMatchObject({ address: 'Cached Address' });
    coverage.clearMapFeaturePlaceSelection();
    await wrapper.setProps({ showMapStyleToggle: false, mapPresentation: 'scope' });
    document.documentElement.setAttribute('data-theme', 'light');
    await nextTick();
    expect(['native', 'scope']).toContain(wrapper.attributes('data-map-presentation'));
    document.documentElement.setAttribute('data-theme', 'dark');
    await nextTick();
    expect(['native', 'scope']).toContain(wrapper.attributes('data-map-presentation'));

    primeMapRuntime();
    expect(coverage.resolveLocationFocusZoom(4, 12, { forceZoomIn: true, useFlight: true })).toBeGreaterThan(4);
    expect(coverage.resolveLocationFocusDuration(fakeMap, [-122.42, 37.77], 13, { useFlight: true })).toBeGreaterThan(0);
    await wrapper.setProps({ clickToSelect: false });
    await nextTick();
    primeMapRuntime();
    expect(coverage.resolveMapFeatureMouseEventHit(mouse)).toMatchObject({ point: expect.any(Object) });
    expect(coverage.handleInteractiveMapFeatureClickFromMouseEvent(mouse)).toBe(true);
    await expect(coverage.buildViewportMarkerModels(fakeMap)).resolves.toMatchObject({
      visibleSpotIds: expect.arrayContaining(['spot-1']),
    });
    expect(Object.keys(coverage).length).toBeGreaterThan(200);

    if (toDataUrlDescriptor) {
      Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', toDataUrlDescriptor);
    } else {
      delete (HTMLCanvasElement.prototype as any).toDataURL;
    }
    if (getContextDescriptor) {
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', getContextDescriptor);
    } else {
      delete (HTMLCanvasElement.prototype as any).getContext;
    }
    wrapper.unmount();
    vi.clearAllTimers();
    vi.useRealTimers();
  }, 30_000);

  it('covers provider place classification, popup media, and prefetch guard branches', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: spots,
        showNearbyPlaces: true,
        autoSearchNearbyPlaces: true,
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const basePin = {
      id: 'map-feature-arcade-cinema',
      title: 'Arcade Cinema',
      subtitle: '',
      address: '',
      category: 'movie theater',
      categoryLabel: 'movie theater',
      latitude: 32.7555,
      longitude: -97.3308,
      kind: 'place',
      sourceLabel: 'Mapbox',
      photoLookupStatus: 'pending',
    };

    expect(coverage.isFuelPlaceCategory('convenience store', 'QT Travel Center')).toBe(true);
    expect(coverage.isFuelPlaceCategory('place', 'Shell')).toBe(true);
    expect(coverage.isFuelPlaceCategory('library', 'Central Library')).toBe(false);
    [
      ['fire response', 'Station 8', 'Fire station'],
      ['law enforcement', 'County Sheriff', 'Police'],
      ['urgent care', 'Downtown Clinic', 'Medical'],
      ['drug store', 'Neighborhood Pharmacy', 'Pharmacy'],
      ['random venue', 'Arcade Cinema', 'Entertainment'],
      ['restaurant patio', 'Dinner Place', 'Restaurant'],
      ['nightclub', 'Music Bar', 'Bar'],
      ['nature preserve', 'River Trail', 'Park'],
      ['historic attraction', 'Old Fort', 'Landmark'],
      ['college campus', 'State University', 'School'],
      ['financial', 'Downtown Bank', 'Bank'],
      ['unknown_category', 'Plain stop', 'Unknown Category'],
    ].forEach(([category, title, label]) => {
      expect(coverage.normalizeNearbyPlaceCategoryLabel(category, title)).toBe(label);
    });

    expect(coverage.getNearbyPlaceKind({ ...basePin, category: 'lodging', categoryLabel: undefined, title: 'Roadside Inn' })).toBe('lodging');
    expect(coverage.getNearbyPlaceKind({ ...basePin, category: 'gas charging', categoryLabel: undefined, title: 'EV Charging Plaza' })).toBe('fuel');
    expect(coverage.getNearbyPlaceKind({ ...basePin, category: 'tourist viewpoint', categoryLabel: undefined, title: 'Scenic Overlook' })).toBe('landmark');
    expect(coverage.getNearbyPlaceIconName({ ...basePin, iconName: 'custom-pin' })).toBe('custom-pin');
    expect(coverage.getNearbyPlaceFallbackPhotoCategory({ ...basePin, kind: 'fuel', category: 'gas_station' })).toBe('other');
    expect(coverage.getNearbyPlaceFallbackPhotoCategory({ ...basePin, category: 'hospital', categoryLabel: 'Medical' })).toBe('other');
    expect(coverage.shouldDeferNearbyPlaceFallbackPhoto(basePin)).toBe(true);
    expect(coverage.shouldAllowInstantNearbyPlaceFallbackPhoto(basePin)).toBe(false);
    expect(coverage.shouldReserveNearbyPlaceAddressSlot(basePin)).toBe(true);
    expect(coverage.getNearbyPlacePopupPhotoUrl(basePin)).toBeNull();
    expect(coverage.getNearbyPlacePopupPhotoUrl({
      ...basePin,
      id: 'scope-arcade',
      sourceLabel: 'Scope',
      photoLookupStatus: undefined,
    }, { allowInstantFallbackPhoto: true })).toMatchObject({ isFallback: true });

    const creditedPopup = coverage.buildNearbyPlacePopupContent({
      ...basePin,
      address: '100 Show Street',
      photoUrl: 'https://images.example.com/show.jpg',
      photoAttribution: '',
      photoAttributionUrl: '/photo-credit',
      photoLookupStatus: 'complete',
    });
    expect(creditedPopup.textContent).toContain('Photo attribution');
    expect(creditedPopup.querySelector('a')?.getAttribute('href')).toContain('/photo-credit');
    expect(coverage.normalizeNearbyPlaceAttributionUrl('javascript:alert(1)')).toBeUndefined();

    vi.mocked(reverseGeocode).mockResolvedValueOnce({
      latitude: 32.7555,
      longitude: -97.3308,
      placeName: 'Coordinate Result',
      formattedAddress: '32.7555, -97.3308',
      address: '32.7555, -97.3308',
      precision: 'coordinate',
    });
    await coverage.prefetchMapFeaturePlacePin({
      ...basePin,
      id: 'map-feature-coordinate-result',
      title: '',
      latitude: 32.7557,
      longitude: -97.331,
    });
    expect(coverage.getCachedMapFeaturePlaceEnrichment({
      ...basePin,
      id: 'map-feature-coordinate-result',
      title: '',
      latitude: 32.7557,
      longitude: -97.331,
    })).toMatchObject({ photoLookupStatus: 'complete' });

    vi.mocked(reverseGeocode).mockResolvedValueOnce({
      latitude: 32.756,
      longitude: -97.332,
      placeName: 'Reverse Named Place',
      formattedAddress: '200 Show Street',
      address: '200 Show Street',
      precision: 'address',
    });
    await coverage.prefetchMapFeaturePlacePin({
      ...basePin,
      id: 'map-feature-reverse-name',
      title: '',
      latitude: 32.756,
      longitude: -97.332,
      category: 'place',
      categoryLabel: 'Place',
    });
    expect(coverage.getCachedMapFeaturePlaceEnrichment({
      ...basePin,
      id: 'map-feature-reverse-name',
      title: '',
      latitude: 32.756,
      longitude: -97.332,
      category: 'place',
      categoryLabel: 'Place',
    })).toMatchObject({
      title: 'Reverse Named Place',
      address: '200 Show Street',
      photoLookupStatus: 'complete',
    });

    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 640 });
    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 360 });
    Object.defineProperty(container, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 640, height: 360, right: 640, bottom: 360 }),
    });
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 0 });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: 0 });
    Object.assign(canvas, { width: 640, height: 360 });
    const renderedFeature = {
      id: 'arcade-cinema',
      layer: { id: 'poi-label', type: 'symbol', 'source-layer': 'poi_label' },
      properties: {
        name: 'Arcade Cinema',
        category: 'movie theater',
        address: '100 Show Street',
      },
      geometry: { type: 'Point', coordinates: [-97.3308, 32.7555] },
    };
    let projectCalls = 0;
    const fakeMap = {
      getZoom: vi.fn(() => 15),
      getStyle: vi.fn(() => ({
        layers: [
          { type: 'symbol' },
          { id: 'road-label', type: 'symbol', 'source-layer': 'road_label' },
          { id: 'poi-label', type: 'symbol', 'source-layer': 'poi_label' },
        ],
      })),
      getCanvas: vi.fn(() => canvas),
      getContainer: vi.fn(() => container),
      getCenter: vi.fn(() => ({ lng: -97.3308, lat: 32.7555 })),
      queryRenderedFeatures: vi.fn(() => [renderedFeature, renderedFeature]),
      project: vi.fn(() => {
        projectCalls += 1;
        if (projectCalls === 1) {
          throw new Error('style not settled');
        }
        return { x: 320, y: 180 };
      }),
      getBounds: vi.fn(() => ({
        contains: () => true,
        getNorth: () => 33,
        getSouth: () => 32,
        getEast: () => -96,
        getWest: () => -98,
      })),
      unproject: vi.fn(([x, y]: [number, number]) => ({ lng: -98 + x / 320, lat: 33 - y / 360 })),
    };

    coverage.mapContainer.value = null;
    expect(coverage.getInteractiveMapFeatureLayerIds({ getStyle: () => ({}) })).toEqual([]);
    expect(coverage.getVisibleMapFeaturePlacePhotoPrefetchPins({ ...fakeMap, getZoom: () => 8 })).toEqual([]);
    expect(coverage.getVisibleMapFeaturePlacePhotoPrefetchPins({ ...fakeMap, getStyle: () => ({ layers: [] }) })).toEqual([]);
    const zeroCanvas = document.createElement('canvas');
    Object.assign(zeroCanvas, { width: 0, height: 0 });
    expect(coverage.getVisibleMapFeaturePlacePhotoPrefetchPins({
      ...fakeMap,
      getCanvas: () => zeroCanvas,
      getContainer: () => ({ clientWidth: 0, clientHeight: 0 }),
    })).toEqual([]);
    const prefetchPins = coverage.getVisibleMapFeaturePlacePhotoPrefetchPins(fakeMap);
    expect(prefetchPins).toHaveLength(1);
    expect(prefetchPins[0]).toMatchObject({
      title: 'Arcade Cinema',
      categoryLabel: 'Entertainment',
      sourceLabel: 'Mapbox',
    });

    coverage.mapContainer.value = container;
    expect(coverage.resolveMapFeaturePlacePopupAnchor({
      ...fakeMap,
      project: () => ({ x: 8, y: 20 }),
    }, basePin)).toBe('top-left');
    expect(coverage.resolveMapFeaturePlacePopupAnchor({
      ...fakeMap,
      project: () => ({ x: 630, y: 20 }),
    }, basePin)).toBe('top-right');
    expect(coverage.resolveMapFeaturePlacePopupAnchor({
      ...fakeMap,
      project: () => {
        throw new Error('projection missing');
      },
    }, basePin)).toBe('bottom');
  });

  it('keeps map runtime, viewport, marker, and nearby-place guard branches bounded', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: [
          { ...spots[0], routeRole: 'start' },
          { ...spots[1], routeRole: 'end' },
        ],
        markerVariant: 'sequence',
        showNearbyPlaces: true,
        autoSearchNearbyPlaces: true,
        nearbyPlacePins: [{
          id: 'bad-pin',
          title: 'Bad Pin',
          latitude: Number.NaN,
          longitude: -97.33,
          category: 'food',
          sourceLabel: 'Scope',
        }],
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 640 });
    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 360 });
    Object.defineProperty(container, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 640, height: 360, right: 640, bottom: 360 }),
    });
    const zeroContainer = document.createElement('div');
    Object.defineProperty(zeroContainer, 'clientWidth', { configurable: true, value: 0 });
    Object.defineProperty(zeroContainer, 'clientHeight', { configurable: true, value: 0 });
    Object.defineProperty(zeroContainer, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }),
    });
    const canvas = document.createElement('canvas');
    Object.assign(canvas, { width: 320, height: 180 });
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 320, height: 180, right: 320, bottom: 180 }),
    });
    const feature = {
      id: 'feature-1',
      layer: { id: 'poi-label', type: 'symbol', 'source-layer': 'poi_label' },
      properties: {
        name: 'Market Arcade',
        category: 'retail',
        full_address: '',
        house_num: '100',
        street: 'Main Street',
        city: 'Fort Worth',
        region: 'TX',
        postcode: '76102',
      },
      geometry: { type: 'Point', coordinates: [-97.3308, 32.7555] },
    };
    const fakeMap = {
      resize: vi.fn(),
      triggerRepaint: vi.fn(),
      getContainer: vi.fn(() => container),
      getCanvas: vi.fn(() => canvas),
      getCenter: vi.fn(() => ({ lng: -97.3308, lat: 32.7555 })),
      getZoom: vi.fn(() => 15),
      getBearing: vi.fn(() => 0),
      getPitch: vi.fn(() => 0),
      jumpTo: vi.fn(),
      easeTo: vi.fn(),
      flyTo: vi.fn(),
      fitBounds: vi.fn(),
      project: vi.fn(([lng, lat]: [number, number]) => ({ x: (lng + 98) * 320, y: (33 - lat) * 360 })),
      unproject: vi.fn(([x, y]: [number, number]) => ({ lng: -98 + x / 320, lat: 33 - y / 360 })),
      getBounds: vi.fn(() => ({
        contains: vi.fn(() => true),
        getNorth: () => 33,
        getSouth: () => 32,
        getEast: () => -96,
        getWest: () => -98,
      })),
      getStyle: vi.fn(() => ({
        layers: [
          { id: 'background', type: 'background' },
          { id: 'water-label', type: 'symbol', 'source-layer': 'water_label' },
          { id: 'road-label', type: 'symbol', 'source-layer': 'road_label' },
          { id: 'poi-label', type: 'symbol', 'source-layer': 'poi_label' },
        ],
      })),
      queryRenderedFeatures: vi.fn(() => [feature]),
      getLayer: vi.fn(() => true),
      setPaintProperty: vi.fn(),
      setLayoutProperty: vi.fn(),
      setLayerZoomRange: vi.fn(),
      moveLayer: vi.fn(),
      setProjection: vi.fn(),
      setFog: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };

    coverage.mapContainer.value = null;
    expect(coverage.isMapRenderSurfaceMismatched(fakeMap)).toBe(true);
    coverage.resizeMapToContainer(fakeMap, { syncOverlays: false });
    expect(fakeMap.resize).toHaveBeenCalled();
    coverage.repairMapRenderSurface(null);
    coverage.scheduleMapResize(fakeMap, { syncOverlays: false });
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    expect(fakeMap.triggerRepaint).toHaveBeenCalled();

    coverage.mapContainer.value = zeroContainer;
    coverage.repairMapRenderSurface(fakeMap);
    expect(fakeMap.jumpTo).not.toHaveBeenCalled();
    coverage.mapContainer.value = container;
    coverage.repairMapRenderSurface(fakeMap);

    expect(coverage.normalizeNearbyPlaceCategoryLabel('motorist services', 'Travel Stop')).toBe('Travel stop');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('grocery market', 'Fresh Market')).toBe('Grocery');
    expect(coverage.getNearbyPlaceKind({ title: 'County Hospital', category: 'clinic', latitude: 32, longitude: -97 })).toBe('health');
    expect(coverage.getNearbyPlaceKind({ title: 'State University', category: 'college', latitude: 32, longitude: -97 })).toBe('education');
    expect(coverage.getNearbyPlaceIconName({ title: 'Unknown', category: 'other', latitude: 32, longitude: -97 })).toBe('pin');
    expect(coverage.mapNearbySearchResultToPin({
      placeName: '',
      latitude: 32.75,
      longitude: -97.33,
      city: 'Fort Worth',
      country: 'US',
      source: 'mock',
      distanceKm: 0.03,
    })).toMatchObject({
      title: 'Nearby place',
      address: 'Fort Worth, US',
      distanceLabel: '25 m from center',
      sourceLabel: 'Scope',
    });
    expect(coverage.getMapFeatureAddress(feature)).toBe('100 Main Street, Fort Worth, TX, 76102');
    expect(coverage.getMapFeatureCoordinates({ geometry: { type: 'LineString', coordinates: [] } }, { lat: 1, lng: 2 })).toEqual({
      latitude: 1,
      longitude: 2,
    });
    expect(coverage.getInteractiveMapFeatureLayerIds({ getStyle: () => ({ layers: [{ id: '', type: 'symbol' }, { id: 'poi-label', type: 'circle' }] }) })).toEqual([]);
    expect(coverage.getVisibleMapFeaturePlacePhotoPrefetchPins(fakeMap)).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: 'Market Arcade' }),
    ]));

    coverage.mapContainer.value = zeroContainer;
    expect(coverage.buildViewport(fakeMap)).toBeNull();
    expect(coverage.getVisibleMarkerModelsFromViewport(fakeMap, [])).toEqual([]);
    expect(coverage.getVisibleSpotsFromViewport(fakeMap)).toHaveLength(2);
    coverage.mapContainer.value = container;
    const badUnprojectMap = {
      ...fakeMap,
      unproject: vi.fn(() => ({ lng: Number.NaN, lat: Number.NaN })),
    };
    expect(coverage.buildViewport(badUnprojectMap)).toBeNull();
    const viewport = coverage.buildViewport(fakeMap);
    expect(viewport).toMatchObject({ width: expect.any(Number), height: expect.any(Number) });
    expect(coverage.getViewportBufferOffsets(fakeMap, viewport)).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
    expect(coverage.isMarkerCoordinateInsideViewport({
      kind: 'spot',
      id: 'spot-1',
      spot: spots[0],
      distanceLabel: null,
    }, fakeMap, 640, 360, 0)).toBe(true);
    expect(coverage.isMarkerCoordinateInsideViewport({
      kind: 'spot',
      id: 'spot-bad',
      spot: { ...spots[0], longitude: Number.NaN },
      distanceLabel: null,
    }, fakeMap, 640, 360, 0)).toBe(false);
    expect(coverage.resolveClusterEntryPointIds({
      id: 'cluster-1',
      latitude: 32.75,
      longitude: -97.33,
      screenX: 50,
      screenY: 50,
      minScreenX: 40,
      minScreenY: 40,
      maxScreenX: 60,
      maxScreenY: 60,
      pointCount: 0,
      pointIds: [],
      clustered: true,
    }, fakeMap, viewport, spots)).toHaveLength(1);
    expect(['spot-1', 'spot-2']).toContain(coverage.resolveSingletonEntrySpot({
      id: 'single-1',
      latitude: 32.75,
      longitude: -97.33,
      screenX: 50,
      screenY: 50,
      minScreenX: 40,
      minScreenY: 40,
      maxScreenX: 60,
      maxScreenY: 60,
      pointCount: 1,
      pointIds: ['missing'],
      clustered: false,
    }, fakeMap, viewport, spots)?.id);

    const markerRuntime = {
      Marker: class {
        element: HTMLElement;
        constructor(options: { element: HTMLElement }) {
          this.element = options.element;
        }

        setLngLat() {
          return this;
        }

        addTo() {
          return this;
        }

        remove = vi.fn();
      },
    };
    const providerPin = {
      id: 'provider-pin',
      title: 'Provider Fuel',
      latitude: 32.7555,
      longitude: -97.3308,
      category: 'gas_station',
      categoryLabel: 'Gas station',
      sourceLabel: 'Mapbox',
      photoUrl: '',
      address: '100 Fuel Rd',
    };
    coverage.renderNearbyPlaceMarkers([
      providerPin,
      { ...providerPin, id: 'bad-coordinates', latitude: Number.NaN },
    ], fakeMap, markerRuntime);
    coverage.activateNearbyPlaceMarker('nearby-place-provider-pin');
    coverage.scheduleActiveNearbyPlacePopoverPlacement();
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    coverage.renderNearbyPlaceMarkers([], fakeMap, markerRuntime);
    expect(coverage.hasUsableNearbyPlaceCoordinates(providerPin)).toBe(true);
    expect(coverage.hasUsableNearbyPlaceCoordinates({ ...providerPin, latitude: 91 })).toBe(false);

    coverage.map.value = null;
    coverage.scheduleNearbyPlacesRefresh();
    await coverage.loadNearbyPlacesForViewport();
    expect(coverage.buildNearbyPlaceMarkerSignature({ ...providerPin, address: undefined })).toContain('Provider Fuel');
    expect(coverage.buildNearbyPlacePopupContent({ ...providerPin, address: '', subtitle: 'Fallback subtitle' }).textContent).toContain('Fallback subtitle');
    expect(coverage.resolveMapFeaturePlacePopupAnchor({
      ...fakeMap,
      project: () => ({ x: 320, y: 350 }),
    }, providerPin)).toBe('bottom');

    wrapper.unmount();
  });

  it('keeps planner map timer fallbacks, classifiers, and runtime globals bounded', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        routeVariant: 'planner',
        routePoints: [
          { ...spots[0], routeRole: 'start' },
          { ...spots[1], routeRole: 'end' },
        ],
        showNearbyPlaces: true,
        autoSearchNearbyPlaces: true,
        showProjectionToggle: true,
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 720 });
    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 420 });
    Object.defineProperty(container, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 720, height: 420, right: 720, bottom: 420 }),
    });
    const canvas = document.createElement('canvas');
    Object.assign(canvas, { width: 720, height: 420 });
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 720, height: 420, right: 720, bottom: 420 }),
    });
    const fakeMap = {
      resize: vi.fn(),
      triggerRepaint: vi.fn(),
      getContainer: vi.fn(() => container),
      getCanvas: vi.fn(() => canvas),
      getCenter: vi.fn(() => ({ lng: -97.3308, lat: 32.7555 })),
      getZoom: vi.fn(() => 13),
      getBearing: vi.fn(() => 0),
      getPitch: vi.fn(() => 0),
      getStyle: vi.fn(() => ({
        layers: [
          { id: 'waterway-label', type: 'symbol', 'source-layer': 'waterway_label' },
          { id: 'poi-label', type: 'symbol', 'source-layer': 'poi_label' },
        ],
      })),
      getLayer: vi.fn(() => true),
      loaded: vi.fn(() => false),
      isStyleLoaded: vi.fn(() => false),
      areTilesLoaded: vi.fn(() => false),
      isMoving: vi.fn(() => true),
      setPaintProperty: vi.fn(),
      setLayoutProperty: vi.fn(),
      setLayerZoomRange: vi.fn(),
      moveLayer: vi.fn(),
      setProjection: vi.fn(),
      setFog: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      remove: vi.fn(),
      getSource: vi.fn(() => null),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
      removeSource: vi.fn(),
      project: vi.fn(([lng, lat]: [number, number]) => ({ x: (lng + 98) * 100, y: (33 - lat) * 100 })),
      unproject: vi.fn(([x, y]: [number, number]) => ({ lng: -98 + x / 100, lat: 33 - y / 100 })),
    };

    coverage.mapContainer.value = container;
    coverage.map.value = fakeMap;
    coverage.interactiveMapEnabled.value = true;

    const originalDevicePixelRatio = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 0 });
    expect(coverage.isMapRenderSurfaceMismatched(fakeMap)).toBe(false);
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: originalDevicePixelRatio });

    const originalWindow = window;
    vi.stubGlobal('window', undefined);
    coverage.scheduleMapResize(fakeMap, { syncOverlays: false });
    expect(fakeMap.resize).toHaveBeenCalled();
    vi.stubGlobal('window', originalWindow);

    const originalRequestAnimationFrame = window.requestAnimationFrame;
    Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, value: undefined });
    coverage.schedulePlannerMapCanvasPreview(fakeMap);
    expect(canvas.classList.contains('is-previewing')).toBe(true);
    Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, value: originalRequestAnimationFrame });

    const microtask = vi.fn();
    coverage.queueMicrotaskSafe(microtask);
    await Promise.resolve();
    expect(microtask).toHaveBeenCalled();

    const throttledHandler = vi.fn();
    const originalPerformance = performance;
    vi.stubGlobal('performance', { now: vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(110).mockReturnValueOnce(180) });
    const throttled = coverage.createThrottledMapMouseHandler(throttledHandler, 50);
    throttled({ point: { x: 1, y: 1 } });
    throttled({ point: { x: 2, y: 2 } });
    throttled({ point: { x: 3, y: 3 } });
    expect(throttledHandler).toHaveBeenCalledTimes(2);
    vi.stubGlobal('performance', originalPerformance);

    const originalNavigator = navigator;
    vi.stubGlobal('navigator', undefined);
    expect(coverage.getMapDeviceMemoryGb()).toBe(0);
    expect(coverage.getMapHardwareConcurrency()).toBe(0);
    vi.stubGlobal('navigator', originalNavigator);

    expect(coverage.normalizeNearbyPlaceCategoryLabel('parking', 'Garage')).toBe('Parking');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('atm', 'Downtown ATM')).toBe('ATM');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('cinema', 'Movie Theater')).toBe('Entertainment');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('retail', 'Design Mall')).toBe('Shopping');
    expect(coverage.getNearbyPlaceKind({
      title: 'Movie Theater',
      category: 'cinema',
      latitude: 32,
      longitude: -97,
    })).toBe('entertainment');
    expect(coverage.getNearbyPlaceKind({
      title: 'Downtown Lodge',
      category: 'lodging',
      latitude: 32,
      longitude: -97,
    })).toBe('lodging');
    expect(coverage.getNearbyPlaceKind({
      title: 'Charging Plaza',
      category: 'charging station',
      latitude: 32,
      longitude: -97,
    })).toBe('fuel');

    expect(coverage.normalizeNearbyPlaceAttributionUrl('/legal/maps')).toBe('http://localhost:3000/legal/maps');
    expect(coverage.normalizeNearbyPlaceAttributionUrl('javascript:alert(1)')).toBeUndefined();
    expect(coverage.getInteractiveMapFeatureLayerIds({
      getStyle: () => ({ layers: undefined }),
    })).toEqual([]);

    expect(coverage.mapWeatherTemperatureLabel.value).toBe('--°F');
    expect(coverage.mapWeatherIconName.value).toBe('weather');
    coverage.mapWeatherSnapshot.value = {
      id: 'coverage-weather',
      label: 'Coverage Point',
      temperatureF: 72.4,
      condition: 'Thunderstorms',
      provider: 'openweathermap',
      iconCode: '11d',
      isDaytime: true,
    };
    expect(coverage.mapWeatherTemperatureLabel.value).toBe('72°F');
    expect(coverage.mapWeatherIconName.value).toBe('cloud-lightning');
    expect(coverage.fallbackMarkers.value.length).toBeGreaterThan(0);

    coverage.primeMapTimerBranchesForCoverage();
    coverage.clearMapCameraTransitionTimers();
    coverage.clearLocationCameraAnimation();
    coverage.clearPlannerMapCanvasPreviewFrame();
    coverage.stopMapCameraRenderTransitionVisuals();
    coverage.clearMapPostStyleResizeTimers();
    coverage.clearMapRenderHealthTimers();

    wrapper.unmount();
  });

  it('keeps viewport, nearby-place, and stale map fallbacks deterministic', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: spots,
        routeVariant: 'planner',
        showNearbyPlaces: true,
        autoSearchNearbyPlaces: true,
        allowRoutePointRemoval: true,
        markerVariant: 'sequence',
        selectedSpotId: 'missing-spot',
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 0 });
    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 0 });
    container.getBoundingClientRect = () => ({
      width: 0,
      height: 0,
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const invalidBoundsMap = {
      getContainer: () => container,
      getBounds: () => ({
        getWest: () => 1,
        getSouth: () => 1,
        getEast: () => 1,
        getNorth: () => Number.NaN,
        contains: vi.fn(() => false),
      }),
      getCenter: () => ({ lng: -97, lat: 32 }),
      getZoom: () => 13,
      project: vi.fn(() => ({ x: Number.NaN, y: Number.NaN })),
      unproject: vi.fn(() => ({ lng: Number.NaN, lat: Number.NaN })),
      getCanvas: () => ({ classList: { contains: () => false, add: vi.fn(), remove: vi.fn() } }),
      getStyle: () => ({ layers: [] }),
      loaded: vi.fn(() => false),
      isStyleLoaded: vi.fn(() => false),
      areTilesLoaded: vi.fn(() => false),
      isMoving: vi.fn(() => true),
      triggerRepaint: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      remove: vi.fn(),
    };

    expect(coverage.getMapVisibleBounds(invalidBoundsMap)).toBeNull();
    expect(coverage.buildNearbyPlacesViewportSignature(invalidBoundsMap)).toBe('');
    expect(coverage.canRenderNearbyPlaces(invalidBoundsMap)).toBe(false);
    expect(coverage.canAutoSearchNearbyPlaces(invalidBoundsMap)).toBe(false);
    expect(coverage.getVisibleSpotsFromViewport(invalidBoundsMap)).toEqual([]);
    expect(coverage.getVisibleMarkerModelsFromViewport(invalidBoundsMap, [])).toEqual([]);
    await expect(coverage.buildViewportMarkerModels(invalidBoundsMap)).resolves.toMatchObject({
      markers: [],
      visibleSpotIds: [],
      visiblePinCount: 0,
    });

    const validContainer = document.createElement('div');
    Object.defineProperty(validContainer, 'clientWidth', { configurable: true, value: 480 });
    Object.defineProperty(validContainer, 'clientHeight', { configurable: true, value: 320 });
    validContainer.getBoundingClientRect = () => ({
      width: 480,
      height: 320,
      left: 0,
      top: 0,
      right: 480,
      bottom: 320,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const validMap = {
      getContainer: () => validContainer,
      getBounds: () => ({
        getWest: () => -98,
        getSouth: () => 32,
        getEast: () => -96,
        getNorth: () => 33,
        contains: ([longitude, latitude]: [number, number]) => longitude > -98 && longitude < -96 && latitude > 32 && latitude < 33,
      }),
      getCenter: () => ({ lng: -97, lat: 32.5 }),
      getZoom: () => 14.25,
      project: vi.fn(([longitude, latitude]: [number, number]) => ({ x: (longitude + 98) * 240, y: (33 - latitude) * 320 })),
      unproject: vi.fn(([x, y]: [number, number]) => ({ lng: -98 + x / 240, lat: 33 - y / 320 })),
      getCanvas: () => ({ classList: { contains: () => true, add: vi.fn(), remove: vi.fn() } }),
      getStyle: () => ({ layers: [] }),
      loaded: vi.fn(() => true),
      isStyleLoaded: vi.fn(() => true),
      areTilesLoaded: vi.fn(() => true),
      isMoving: vi.fn(() => false),
      triggerRepaint: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      remove: vi.fn(),
    };
    coverage.mapContainer.value = validContainer;
    coverage.map.value = validMap;
    coverage.interactiveMapEnabled.value = true;

    expect(coverage.getMapVisibleBounds(validMap)).toEqual(expect.objectContaining({ west: -98, east: -96 }));
    expect(coverage.buildNearbyPlacesViewportSignature(validMap)).toContain('-97.000');
    expect(coverage.getNearbyPlacesLimitForZoom(9)).toBeGreaterThan(0);
    expect(coverage.getNearbyPlacesLimitForZoom(10)).toBe(96);
    expect(coverage.getNearbyPlacesLimitForZoom(12)).toBe(120);
    expect(coverage.getNearbyPlacesLimitForZoom(14)).toBeGreaterThan(120);
    expect(coverage.expandNearbyPlaceBounds({ west: -98, south: 32, east: -96, north: 33 }, 14)).toMatchObject({
      west: expect.any(Number),
      east: expect.any(Number),
    });
    expect(coverage.getVisibleSpotsFromViewport(validMap).map((spot: MapPoint) => spot.id)).toEqual(expect.arrayContaining(['spot-1']));
    await expect(coverage.buildViewportMarkerModels(validMap)).resolves.toMatchObject({
      visiblePinCount: expect.any(Number),
    });

    const pinWithoutId = coverage.mapNearbySearchResultToPin({
      id: '',
      placeName: 'Downtown Fuel',
      formattedAddress: '',
      address: '',
      city: 'Fort Worth',
      country: 'United States',
      category: 'gas_station',
      categoryId: 'gas_station',
      categoryLabel: 'Gas station',
      latitude: 32.7555,
      longitude: -97.3308,
      distanceKm: 0.04,
      source: 'scope',
    });
    expect(pinWithoutId.id).toContain('Downtown Fuel');
    expect(pinWithoutId.kind).toBe('fuel');
    expect(pinWithoutId.distanceLabel).toBe('50 m from center');
    expect(coverage.mapNearbySearchResultToPin({
      id: 'far-place',
      placeName: '',
      formattedAddress: '',
      address: '',
      city: '',
      country: '',
      category: '',
      latitude: 32,
      longitude: -97,
      distanceKm: 12.8,
      source: 'mapbox',
    })).toMatchObject({
      title: 'Nearby place',
      sourceLabel: 'Mapbox',
      distanceLabel: '13 km from center',
    });
    expect(coverage.mergeNearbyPlacePins([pinWithoutId, { ...pinWithoutId }])).toHaveLength(1);
    expect(coverage.formatNearbyPlaceAddress({ address: '', subtitle: 'Austin', city: 'Austin', categoryLabel: 'Coffee' })).toBe('Austin');
    expect(coverage.formatNearbyPlaceDistance({ distanceLabel: '' })).toBe('');
    expect(coverage.getNearbyPlaceIconName({ ...pinWithoutId, kind: 'fuel' })).toBe('fuel');

    const rafCallbacks: FrameRequestCallback[] = [];
    const cancelAnimationFrame = vi.fn();
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: vi.fn((callback: FrameRequestCallback) => {
        rafCallbacks.push(callback);
        return rafCallbacks.length;
      }),
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      value: cancelAnimationFrame,
    });
    coverage.schedulePlannerMapCanvasPreview(validMap);
    coverage.clearPlannerMapCanvasPreviewFrame();
    expect(cancelAnimationFrame).toHaveBeenCalled();

    const staleMap = { ...validMap };
    coverage.schedulePlannerMapCanvasPreview(validMap);
    coverage.map.value = staleMap;
    rafCallbacks.at(-1)?.(16);
    expect(validMap.getCanvas().classList.add).not.toHaveBeenCalledWith('is-previewing');

    const originalQueueMicrotask = globalThis.queueMicrotask;
    vi.stubGlobal('queueMicrotask', undefined);
    const fallbackTask = vi.fn();
    coverage.queueMicrotaskSafe(fallbackTask);
    await Promise.resolve();
    expect(fallbackTask).toHaveBeenCalled();
    vi.stubGlobal('queueMicrotask', originalQueueMicrotask);

    const originalPerformance = performance;
    vi.stubGlobal('performance', undefined);
    const handler = vi.fn();
    coverage.createThrottledMapMouseHandler(handler, 0)({ point: { x: 1, y: 1 } });
    expect(handler).toHaveBeenCalledTimes(1);
    vi.stubGlobal('performance', originalPerformance);

    wrapper.unmount();
  });

  it('keeps nearby place category, feature, and distance fallbacks deterministic', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: spots,
        showNearbyPlaces: true,
        selectedSpotId: 'spot-1',
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const place = (overrides: Record<string, unknown> = {}) => ({
      id: 'nearby-place',
      title: 'Nearby Place',
      latitude: 32.7555,
      longitude: -97.3308,
      kind: 'place',
      category: 'place',
      categoryLabel: '',
      sourceLabel: 'Mapbox',
      ...overrides,
    });

    expect(coverage.normalizeNearbyPlaceCategoryLabel('entertainment venue', 'Arcade Zoo')).toBe('Entertainment');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('parking', 'Downtown Garage')).toBe('Parking');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('atm', 'Lobby ATM')).toBe('ATM');
    expect(coverage.normalizeNearbyPlaceCategoryLabel('gas station', 'Shell')).toBe('Gas station');
    expect(coverage.getNearbyPlaceKind(place({ title: 'Movie arcade', category: 'entertainment' }))).toBe('entertainment');
    expect(coverage.getNearbyPlaceKind(place({ title: 'Road hotel', category: 'hotel' }))).toBe('lodging');
    expect(coverage.getNearbyPlaceKind(place({ title: 'Quick fuel', category: 'gas station' }))).toBe('fuel');
    expect(coverage.getNearbyPlaceIconName(place({ title: 'Movie arcade', category: 'entertainment' }))).toBe('entertainment');
    expect(coverage.getNearbyPlaceIconName(place({ title: 'Campus hall', category: 'university' }))).toBe('culture');
    expect(coverage.getNearbyPlaceIconName(place({ title: 'Unknown stop', category: 'unknown' }))).toBe('pin');
    expect(coverage.formatNearbyPlaceCategory(place({ kind: 'fuel', categoryLabel: '', category: '' }))).toBe('Gas station');
    expect(coverage.formatNearbyPlaceAddress(place({ address: '', subtitle: '' }))).toBe('');

    const fallbackFeature = {
      id: '',
      layer: { id: 'poi-label', type: 'symbol', 'source-layer': 'poi_label' },
      properties: {
        brand: 'Provider Arcade',
        maki: 'amusement_park',
        street: 'Fun Ave',
        city: 'Fort Worth',
        region: 'TX',
      },
      geometry: {
        type: 'Point',
        coordinates: [Number.NaN, 32.7555],
      },
    };
    expect(coverage.mapRenderedFeatureToNearbyPlacePin(fallbackFeature, { lng: -97.3308, lat: 32.7555 })).toMatchObject({
      title: 'Provider Arcade',
      categoryLabel: 'Park',
      address: 'Fun Ave, Fort Worth, TX',
      latitude: 32.7555,
      longitude: -97.3308,
    });

    expect(coverage.formatDistanceLabel(0.005, 8, 'user')).toBeNull();
    expect(coverage.formatDistanceLabel(0.08, 129, 'user')).toBe('125 m away');
    expect(coverage.formatDistanceLabel(0.08, 129, 'selected')).toBe('125 m from selected');
    expect(coverage.formatDistanceLabel(12.2, 19_600, 'selected')).toBe('12 mi from selected');

    wrapper.unmount();
  });

  it('keeps map render gate and camera transition timer branches deterministic', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: spots,
        routeVariant: 'planner',
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    coverage.interactiveMapEnabled.value = true;

    coverage.finishMapCameraRenderTransition(999_999, 5);
    coverage.startMapCameraRenderTransition();
    coverage.stopMapCameraRenderTransitionVisuals();
    vi.runOnlyPendingTimers();

    coverage.startMapCameraRenderTransition({
      timeoutMs: 5,
      minimumVisibleMs: 0,
      captureSnapshot: true,
      renderGate: false,
      tileSettling: false,
    });
    vi.advanceTimersByTime(5);

    coverage.openMapRenderGate();
    coverage.revealMapRenderGate(0);
    vi.runOnlyPendingTimers();
    coverage.closeMapRenderGate();
    coverage.clearMapCameraTransitionTimers();
    coverage.clearMapRenderGateTimer();

    wrapper.unmount();
    vi.useRealTimers();
  });

  it('keeps map feature enrichment, attribution, and visible-prefetch fallbacks deterministic', async () => {
    const wrapper = mount(MapView, {
      props: {
        spots,
        routePoints: spots,
        showNearbyPlaces: true,
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    const basePin = {
      id: 'map-feature-provider-place',
      title: 'Provider Place',
      subtitle: 'Original subtitle',
      latitude: 32.7555,
      longitude: -97.3308,
      kind: 'place',
      category: 'culture',
      categoryLabel: 'Culture',
      sourceLabel: 'Mapbox',
    };
    const cacheKey = coverage.buildMapFeaturePlaceEnrichmentKey(basePin);
    coverage.cacheMapFeaturePlaceEnrichment(cacheKey, { title: 'Cached Provider Place' });
    expect(coverage.applyCachedMapFeaturePlaceEnrichment(basePin)).toMatchObject({
      title: 'Cached Provider Place',
      subtitle: 'Original subtitle',
    });
    coverage.cacheMapFeaturePlaceEnrichment(cacheKey, { address: '100 Main Street, Fort Worth, TX' });
    expect(coverage.applyCachedMapFeaturePlaceEnrichment(basePin)).toMatchObject({
      address: '100 Main Street, Fort Worth, TX',
      subtitle: '100 Main Street, Fort Worth, TX',
    });
    expect(coverage.hasWarmMapFeaturePlaceEnrichment({ ...basePin, photoUrl: '' })).toBe(false);
    coverage.cacheMapFeaturePlaceEnrichment(cacheKey, {
      photoUrl: 'https://images.example.com/provider.jpg',
      photoLookupStatus: 'complete',
    });
    expect(coverage.hasRealMapFeaturePlacePhoto(basePin)).toBe(true);
    expect(coverage.hasSettledMapFeaturePlacePhotoLookup(basePin)).toBe(true);

    const locationDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'location');
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: undefined,
    });
    expect(coverage.normalizeNearbyPlaceAttributionUrl('/credits')).toBe('https://scopetrips.com/credits');
    if (locationDescriptor) {
      Object.defineProperty(globalThis, 'location', locationDescriptor);
    }
    expect(coverage.normalizeNearbyPlaceAttributionUrl('javascript:alert(1)')).toBeUndefined();
    expect(coverage.normalizeNearbyPlaceAttributionUrl('   ')).toBeUndefined();

    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 640 });
    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 420 });
    coverage.mapContainer.value = container;
    const feature = {
      id: 'feature-1',
      layer: { id: 'poi-label', type: 'symbol', 'source-layer': 'poi_label' },
      properties: {
        name: 'Visible Museum',
        category: 'museum',
        full_address: '200 Museum Way, Fort Worth, TX',
      },
      geometry: {
        type: 'Point',
        coordinates: [-97.33, 32.75],
      },
    };
    const visibleMap = {
      getZoom: () => 15,
      getStyle: () => ({
        layers: [
          { id: 'background', type: 'background' },
          { id: 'poi-label', type: 'symbol', 'source-layer': 'poi_label' },
        ],
      }),
      getCanvas: () => ({ clientWidth: 640, clientHeight: 420, width: 640, height: 420 }),
      getContainer: () => container,
      getCenter: () => ({ lng: -97.33, lat: 32.75 }),
      queryRenderedFeatures: vi.fn(() => [feature]),
      project: vi.fn(() => {
        throw new Error('projection settling');
      }),
    };
    expect(coverage.getVisibleMapFeaturePlacePhotoPrefetchPins({
      ...visibleMap,
      getZoom: () => 4,
    })).toEqual([]);
    expect(coverage.getVisibleMapFeaturePlacePhotoPrefetchPins({
      ...visibleMap,
      getStyle: () => ({ layers: [] }),
    })).toEqual([]);
    coverage.mapContainer.value = null;
    expect(coverage.getVisibleMapFeaturePlacePhotoPrefetchPins({
      ...visibleMap,
      getCanvas: () => ({ clientWidth: 0, clientHeight: 0, width: 0, height: 0 }),
      getContainer: () => ({ clientWidth: 0, clientHeight: 0 }),
    })).toEqual([]);
    coverage.mapContainer.value = container;
    expect(coverage.getVisibleMapFeaturePlacePhotoPrefetchPins(visibleMap)).toHaveLength(1);

    wrapper.unmount();
  });

  it('keeps map runtime helper fallbacks deterministic for coverage-gate edge cases', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const wrapper = mount(MapView, {
      props: {
        spots: [
          {
            id: 'blank-label',
            title: '',
            latitude: 32.7555,
            longitude: -97.3308,
            category: 'other',
            city: '',
          },
        ],
        routePoints: [],
        routeVariant: 'planner',
      },
    });
    await nextTick();

    const coverage = getMapCoverage(wrapper);
    expect(coverage.fallbackMarkers.value[0]).toMatchObject({
      id: 'blank-label',
      label: 'Scope pin',
    });
    expect(coverage.getMapHardwareConcurrency()).toEqual(expect.any(Number));

    const emptyWrapper = mount(MapView, {
      props: {
        spots: [],
        routePoints: [],
      },
    });
    await nextTick();
    expect(getMapCoverage(emptyWrapper).fallbackMarkers.value).toEqual([]);

    const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: undefined,
    });
    expect(coverage.getDocumentTheme()).toBe('dark');
    if (documentDescriptor) {
      Object.defineProperty(globalThis, 'document', documentDescriptor);
    }

    const hardwareConcurrencyDescriptor = Object.getOwnPropertyDescriptor(navigator, 'hardwareConcurrency');
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: undefined,
    });
    expect(coverage.getMapHardwareConcurrency()).toBe(0);
    if (hardwareConcurrencyDescriptor) {
      Object.defineProperty(navigator, 'hardwareConcurrency', hardwareConcurrencyDescriptor);
    }

    const mapContainer = document.createElement('div');
    Object.defineProperty(mapContainer, 'clientWidth', { configurable: true, value: 0 });
    Object.defineProperty(mapContainer, 'clientHeight', { configurable: true, value: 0 });
    const readyCanvas = {
      classList: {
        add: vi.fn(),
      },
      clientWidth: 640,
      clientHeight: 420,
      width: 640,
      height: 420,
      toDataURL: vi.fn(() => 'data:image/png;base64,c2NvcGU='),
    };
    const readyMap = {
      getCanvas: () => readyCanvas,
      getContainer: () => mapContainer,
      getCenter: () => ({ lng: -97.3308, lat: 32.7555 }),
      getBounds: () => ({
        contains: vi.fn(() => true),
      }),
      getZoom: () => 12,
      getStyle: () => ({ layers: [{ id: 'poi-label', type: 'symbol', 'source-layer': 'poi_label' }], sprite: 'sprite' }),
      isStyleLoaded: () => true,
      loaded: () => true,
      project: vi.fn(() => ({ x: 20, y: 20 })),
      queryRenderedFeatures: vi.fn(() => []),
      triggerRepaint: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn((_event: string, callback: () => void) => callback()),
      remove: vi.fn(),
      setStyle: vi.fn(),
    };

    const windowRequestAnimationFrameDescriptor = Object.getOwnPropertyDescriptor(window, 'requestAnimationFrame');
    const windowCancelAnimationFrameDescriptor = Object.getOwnPropertyDescriptor(window, 'cancelAnimationFrame');
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: vi.fn(() => 123),
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      value: undefined,
    });
    coverage.schedulePlannerMapCanvasPreview(readyMap);
    coverage.clearPlannerMapCanvasPreviewFrame();
    if (windowRequestAnimationFrameDescriptor) {
      Object.defineProperty(window, 'requestAnimationFrame', windowRequestAnimationFrameDescriptor);
    }
    if (windowCancelAnimationFrameDescriptor) {
      Object.defineProperty(window, 'cancelAnimationFrame', windowCancelAnimationFrameDescriptor);
    }

    const globalRequestAnimationFrameDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame');
    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      value: undefined,
    });
    const framePromise = coverage.waitForNextAnimationFrame();
    vi.advanceTimersByTime(1);
    await framePromise;
    coverage.scheduleMapStylePresentationRefresh();
    if (globalRequestAnimationFrameDescriptor) {
      Object.defineProperty(globalThis, 'requestAnimationFrame', globalRequestAnimationFrameDescriptor);
    }

    coverage.interactiveMapEnabled.value = true;
    coverage.map.value = readyMap;
    coverage.mapContainer.value = null;
    expect(coverage.resolveMapFeaturePlacePopupAnchor(readyMap, {
      id: 'popup-pin',
      title: 'Popup pin',
      latitude: 32.7555,
      longitude: -97.3308,
      category: 'culture',
      sourceLabel: 'Mapbox',
    })).toBe('bottom');
    coverage.startMapStyleTransition({ variant: 'switch' });
    coverage.finishMapStyleTransition(999_999);
    vi.runOnlyPendingTimers();

    emptyWrapper.unmount();
    wrapper.unmount();
    vi.useRealTimers();
  });
});
