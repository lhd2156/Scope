import { flushPromises, mount } from '@vue/test-utils';

const ORIGINAL_INNER_WIDTH = window.innerWidth;

const {
  authStoreMock,
  getDefaultDiscoveryMapViewportMock,
  mapInteractionTrackMock,
  mapStoreMock,
  onboardingStoreMock,
  resolveHomeBaseMapViewportMock,
  resolveRoadRouteMock,
  spotsStoreMock,
  tripsStoreMock,
} = vi.hoisted(() => ({
  authStoreMock: {
    currentUser: null as null | { homeBase?: string },
    isAuthenticated: false,
  },
  getDefaultDiscoveryMapViewportMock: vi.fn(() => ({
    center: [-98.5795, 39.8283] as [number, number],
    zoom: 3.25,
    style: 'mapbox://styles/mapbox/dark-v11',
  })),
  mapInteractionTrackMock: vi.fn(),
  resolveHomeBaseMapViewportMock: vi.fn(),
  resolveRoadRouteMock: vi.fn(async (points: Array<{ id: string; latitude: number; longitude: number }>) => ({
    geometry: points.map((point) => [point.longitude, point.latitude]),
    orderedPoints: points,
    distanceMeters: 4828.032,
    durationSeconds: 1020,
    provider: 'local-estimate',
    profile: 'local',
  })),
  mapStoreMock: {
    viewport: {
      center: [-98.5795, 39.8283] as [number, number],
      zoom: 4.5,
      style: 'mapbox://styles/mapbox/dark-v11',
    },
    activeCategories: ['nightlife', 'nature', 'culture', 'scenic'],
    visibleSpotIds: [],
    visibleSpotIdsMeasured: false,
    selectedSpotId: null as string | null,
    toggleCategory: vi.fn(),
    resetCategories: vi.fn(),
    resetVisibleSpotIds: vi.fn(),
    setSelectedSpotId: vi.fn((spotId: string | null) => {
      mapStoreMock.selectedSpotId = spotId;
    }),
    setCenter: vi.fn(),
    setZoom: vi.fn(),
    setStyle: vi.fn(),
  },
  onboardingStoreMock: {
    isActive: false,
    activeStep: null as null | { routeName: string },
  },
  spotsStoreMock: {
    items: [],
    error: 'This should be hidden in audit mode',
    loading: true,
    selectedSpot: null as null | Record<string, unknown>,
    fetchSpots: vi.fn().mockResolvedValue(undefined),
    fetchSpot: vi.fn().mockResolvedValue(undefined),
  },
  tripsStoreMock: {
    items: [],
    error: 'Trip loading should be hidden in audit mode',
    loading: true,
    fetchTrips: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>();
  return {
    ...actual,
    useRoute: () => ({ query: {} }),
  };
});

vi.mock('@/stores/map', () => ({
  useMapStore: () => mapStoreMock,
}));

vi.mock('@/stores/onboarding', () => ({
  useOnboardingStore: () => onboardingStoreMock,
}));

vi.mock('@/stores/spots', () => ({
  useSpotsStore: () => spotsStoreMock,
}));

vi.mock('@/stores/trips', () => ({
  useTripsStore: () => tripsStoreMock,
}));

vi.mock('@/services/analyticsService', () => ({
  analyticsPageEngagementTracker: {
    recordMapInteraction: mapInteractionTrackMock,
  },
}));

vi.mock('@/services/mapViewportService', () => ({
  getDefaultDiscoveryMapViewport: getDefaultDiscoveryMapViewportMock,
  resolveHomeBaseMapViewport: resolveHomeBaseMapViewportMock,
}));

vi.mock('@/services/roadRouteService', () => ({
  resolveRoadRoute: resolveRoadRouteMock,
}));

vi.mock('@/utils/qaMode', () => ({
  isScopeQaMode: () => true,
}));

import MapPage from '@/views/MapPage.vue';

describe('MapPage QA audit preview', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    mapStoreMock.selectedSpotId = null;
    mapStoreMock.activeCategories = ['nightlife', 'nature', 'culture', 'scenic'];
    mapStoreMock.visibleSpotIds = [];
    mapStoreMock.visibleSpotIdsMeasured = false;
    spotsStoreMock.loading = true;
    tripsStoreMock.loading = true;
    spotsStoreMock.fetchSpots.mockClear();
    spotsStoreMock.fetchSpot.mockClear();
    tripsStoreMock.fetchTrips.mockClear();
    mapStoreMock.setSelectedSpotId.mockClear();
    resolveRoadRouteMock.mockClear();
  });

  afterAll(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: ORIGINAL_INNER_WIDTH,
    });
  });

  it('renders audit fixture spots and route context without loading the normal workspace stores', async () => {
    const wrapper = mount(MapPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          RouterLink: { props: ['to'], template: '<a :href="typeof to === \'string\' ? to : String(to)"><slot /></a>' },
          LazyImage: { props: ['src', 'alt'], template: '<img :src="src" :alt="alt" />' },
          ScopeIcon: { props: ['name', 'label'], template: '<span>{{ label || name }}</span>' },
          StarRatingDisplay: { props: ['rating', 'label'], template: '<span>{{ label }} {{ rating }}</span>' },
          MapView: {
            props: ['spots', 'routePoints', 'routeGeometry', 'selectedSpotId', 'labelMode'],
            template: '<div data-test="map-view-audit">{{ spots.length }} spots / {{ routePoints.length }} points / {{ routeGeometry.length }} coords / {{ selectedSpotId }} / {{ labelMode }}</div>',
          },
        },
      },
    });

    await flushPromises();

    expect(spotsStoreMock.fetchSpots).not.toHaveBeenCalled();
    expect(tripsStoreMock.fetchTrips).not.toHaveBeenCalled();
    expect(spotsStoreMock.fetchSpot).not.toHaveBeenCalled();
    expect(mapStoreMock.setSelectedSpotId).toHaveBeenCalledWith('map-audit-riverfront-lounge');
    expect(wrapper.text()).toContain('Curate the map by mood');
    expect(wrapper.text()).toContain('North Texas Guest Sampler');
    expect(wrapper.text()).toContain('Riverfront Lounge');
    expect(wrapper.text()).toContain('Botanic Loop');
    expect(wrapper.text()).toContain('Crew synced');
    expect(wrapper.text()).toContain('4/9 live');
    expect(wrapper.text()).not.toContain('Temporary issue');
    expect(wrapper.get('[data-test="map-view-audit"]').text()).toContain('4 spots / 0 points');

    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    expect(coverage.workspaceLoading.value).toBe(false);
    expect(coverage.workspaceError.value).toBe('');
    expect(coverage.activeTrip.value.title).toBe('North Texas Guest Sampler');
    expect(coverage.selectedSpot.value.id).toBe('map-audit-riverfront-lounge');
    expect(coverage.mapLabelMode.value).toBe('majorCities');
    expect(coverage.routeTravelerMetric.value).toBe('2 Travelers');

    wrapper.unmount();
  });
});
