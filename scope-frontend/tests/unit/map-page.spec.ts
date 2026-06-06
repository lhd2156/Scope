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
    isAuthenticated: true,
  },
  getDefaultDiscoveryMapViewportMock: vi.fn(() => ({
    center: [-98.5795, 39.8283] as [number, number],
    zoom: 3.25,
    style: 'mapbox://styles/mapbox/dark-v11',
  })),
  resolveHomeBaseMapViewportMock: vi.fn(),
  mapInteractionTrackMock: vi.fn(),
  resolveRoadRouteMock: vi.fn(async (points: Array<{ id: string; latitude: number; longitude: number }>) => ({
    geometry: points.map((point) => [point.longitude, point.latitude]),
    orderedPoints: points,
    distanceMeters: 3218.688,
    durationSeconds: 780,
    provider: 'local-estimate',
    profile: 'local',
  })),
  mapStoreMock: {
    viewport: {
      center: [-98.5795, 39.8283] as [number, number],
      zoom: 3.25,
      style: 'mapbox://styles/mapbox/dark-v11',
    },
    activeCategories: ['food', 'nature'],
    visibleSpotIds: ['spot-1', 'spot-2'],
    visibleSpotIdsMeasured: true,
    selectedSpotId: 'spot-1',
    toggleCategory: vi.fn(),
    resetCategories: vi.fn(),
    resetVisibleSpotIds: vi.fn(),
    setSelectedSpotId: vi.fn(),
    setCenter: vi.fn(),
    setZoom: vi.fn(),
    setStyle: vi.fn(),
  },
  onboardingStoreMock: {
    isActive: false,
    activeStep: null as null | { routeName: string },
  },
  spotsStoreMock: {
    items: [
      {
        id: 'spot-1',
        title: 'Sunset Rooftop Tacos',
        description: 'Skyline tacos and late-night energy.',
        latitude: 32.7555,
        longitude: -97.3308,
        category: 'food',
        city: 'Fort Worth',
        country: 'US',
        vibe: 'electric',
        rating: 4.8,
        photoUrl: 'https://images.example.com/spot-1.jpg',
      },
      {
        id: 'spot-2',
        title: 'Botanic River Walk',
        description: 'Greenway loop with river views.',
        latitude: 32.749,
        longitude: -97.363,
        category: 'nature',
        city: 'Fort Worth',
        country: 'US',
        vibe: 'calm',
        rating: 4.7,
        photoUrl: 'https://images.example.com/spot-2.jpg',
      },
    ],
    error: '',
    loading: false,
    selectedSpot: null as null | Record<string, unknown>,
    fetchSpots: vi.fn().mockResolvedValue(undefined),
  },
  tripsStoreMock: {
    items: [
      {
        id: 'trip-1',
        title: 'North Texas Night + Food Loop',
        description: 'Two days of tacos and skyline views.',
        destination: 'Fort Worth, TX',
        coverImageUrl: 'https://images.example.com/trip-cover.jpg',
        members: [
          { id: 'user-1', displayName: 'Louis Do' },
          { id: 'user-2', displayName: 'Maya Chen' },
        ],
        spots: [
          {
            spotId: 'spot-1',
            title: 'Sunset Rooftop Tacos',
            latitude: 32.7555,
            longitude: -97.3308,
            category: 'food',
            dayNumber: 1,
            timeSlot: '11:00',
          },
          {
            spotId: 'spot-2',
            title: 'Botanic River Walk',
            latitude: 32.749,
            longitude: -97.363,
            category: 'nature',
            dayNumber: 1,
            timeSlot: '13:00',
          },
        ],
      },
    ],
    error: '',
    loading: false,
    fetchTrips: vi.fn().mockResolvedValue(undefined),
  },
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function dispatchPointerEvent(type: string, options: { clientY?: number; pointerId?: number } = {}) {
  const event = new Event(type) as PointerEvent;
  Object.defineProperty(event, 'clientY', {
    configurable: true,
    value: options.clientY ?? 0,
  });
  Object.defineProperty(event, 'pointerId', {
    configurable: true,
    value: options.pointerId ?? 1,
  });
  window.dispatchEvent(event);
}

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

import MapPage from '@/views/MapPage.vue';

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

function mountMapPage(options?: {
  mobile?: boolean;
  mapViewStub?: { props?: string[]; template: string };
}) {
  setViewportWidth(options?.mobile ? 390 : 1280);

  return mount(MapPage, {
    global: {
      stubs: {
        AppShell: { template: '<div><slot /></div>' },
        RouterLink: {
          props: ['to'],
          template: '<a :href="typeof to === \'string\' ? to : String(to)"><slot /></a>',
        },
        MapView: options?.mapViewStub ?? {
          props: ['spots', 'routePoints', 'routeGeometry', 'selectedSpotId', 'labelMode'],
          template: '<div data-test="map-view-stub">{{ spots.length }} spots / {{ routePoints.length }} route points / {{ routeGeometry.length }} route coords / {{ selectedSpotId }} / {{ labelMode }}</div>',
        },
      },
    },
  });
}

describe('MapPage', () => {
  beforeEach(() => {
    spotsStoreMock.items = [
      {
        id: 'spot-1',
        title: 'Sunset Rooftop Tacos',
        description: 'Skyline tacos and late-night energy.',
        latitude: 32.7555,
        longitude: -97.3308,
        category: 'food',
        city: 'Fort Worth',
        country: 'US',
        vibe: 'electric',
        rating: 4.8,
        photoUrl: 'https://images.example.com/spot-1.jpg',
      },
      {
        id: 'spot-2',
        title: 'Botanic River Walk',
        description: 'Greenway loop with river views.',
        latitude: 32.749,
        longitude: -97.363,
        category: 'nature',
        city: 'Fort Worth',
        country: 'US',
        vibe: 'calm',
        rating: 4.7,
        photoUrl: 'https://images.example.com/spot-2.jpg',
      },
    ];
    tripsStoreMock.items = [
      {
        id: 'trip-1',
        title: 'North Texas Night + Food Loop',
        description: 'Two days of tacos and skyline views.',
        destination: 'Fort Worth, TX',
        coverImageUrl: 'https://images.example.com/trip-cover.jpg',
        members: [
          { id: 'user-1', displayName: 'Louis Do' },
          { id: 'user-2', displayName: 'Maya Chen' },
        ],
        spots: [
          {
            spotId: 'spot-1',
            title: 'Sunset Rooftop Tacos',
            latitude: 32.7555,
            longitude: -97.3308,
            category: 'food',
            dayNumber: 1,
            timeSlot: '11:00',
          },
          {
            spotId: 'spot-2',
            title: 'Botanic River Walk',
            latitude: 32.749,
            longitude: -97.363,
            category: 'nature',
            dayNumber: 1,
            timeSlot: '13:00',
          },
        ],
      },
    ];
    spotsStoreMock.error = '';
    spotsStoreMock.loading = false;
    spotsStoreMock.selectedSpot = null;
    tripsStoreMock.error = '';
    tripsStoreMock.loading = false;
    mapStoreMock.activeCategories = ['food', 'nature'];
    mapStoreMock.visibleSpotIds = ['spot-1', 'spot-2'];
    mapStoreMock.visibleSpotIdsMeasured = true;
    mapStoreMock.selectedSpotId = 'spot-1';
    mapStoreMock.viewport = {
      center: [-98.5795, 39.8283],
      zoom: 3.25,
      style: 'mapbox://styles/mapbox/dark-v11',
    };
    authStoreMock.currentUser = null;
    authStoreMock.isAuthenticated = true;
    onboardingStoreMock.isActive = false;
    onboardingStoreMock.activeStep = null;
    getDefaultDiscoveryMapViewportMock.mockReset().mockReturnValue({
      center: [-98.5795, 39.8283],
      zoom: 3.25,
      style: 'mapbox://styles/mapbox/dark-v11',
    });
    resolveHomeBaseMapViewportMock.mockReset().mockResolvedValue(null);
    mapInteractionTrackMock.mockReset();
    mapStoreMock.toggleCategory.mockReset();
    mapStoreMock.resetCategories.mockReset();
    mapStoreMock.resetVisibleSpotIds.mockReset().mockImplementation(() => {
      mapStoreMock.visibleSpotIds = [];
      mapStoreMock.visibleSpotIdsMeasured = false;
    });
    mapStoreMock.setSelectedSpotId.mockReset().mockImplementation((spotId: string | null) => {
      mapStoreMock.selectedSpotId = spotId;
    });
    mapStoreMock.setCenter.mockReset();
    mapStoreMock.setZoom.mockReset();
    mapStoreMock.setStyle.mockReset();
    resolveRoadRouteMock.mockClear();
    resolveRoadRouteMock.mockImplementation(async (points: Array<{ id: string; latitude: number; longitude: number }>) => ({
      geometry: points.map((point) => [point.longitude, point.latitude]),
      orderedPoints: points,
      distanceMeters: 3218.688,
      durationSeconds: 780,
      provider: 'local-estimate',
      profile: 'local',
    }));
    spotsStoreMock.fetchSpots.mockReset().mockResolvedValue(undefined);
    tripsStoreMock.fetchTrips.mockReset().mockResolvedValue(undefined);
    setViewportWidth(1280);
  });

  afterAll(() => {
    setViewportWidth(ORIGINAL_INNER_WIDTH);
  });

  it('loads the premium sidebar workspace with category chips, route preview, and selected spot details', async () => {
    const wrapper = mountMapPage();

    await flushPromises();

    expect(spotsStoreMock.fetchSpots).toHaveBeenCalledTimes(1);
    expect(spotsStoreMock.fetchSpots).toHaveBeenCalledWith({ page: 1, pageSize: 96 });
    expect(tripsStoreMock.fetchTrips).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Curate the map by mood');
    expect(wrapper.text()).toContain('North Texas Night + Food Loop');
    expect(wrapper.text()).toContain('13 min');
    expect(wrapper.text()).toContain('2 mi');
    expect(wrapper.text()).not.toContain('13 min drive - 2 mi');
    expect(wrapper.text()).toContain('Featured spot');
    expect(wrapper.text()).toContain('Sunset Rooftop Tacos');
    expect(wrapper.find('.route-preview-path-line').exists()).toBe(false);
    expect(wrapper.findAll('.route-timeline-stop')).toHaveLength(2);
    expect(wrapper.find('.route-timeline').text()).toContain('Day 1');
    expect(wrapper.find('.route-timeline').text()).toContain('11:00');
    expect(wrapper.find('[data-test="map-view-stub"]').text()).toContain('2 spots / 0 route points / 0 route coords /');
    expect(wrapper.find('[data-test="map-view-stub"]').text()).toContain('states');
    expect(mapStoreMock.setSelectedSpotId).toHaveBeenCalledWith(null);
    expect(mapStoreMock.resetVisibleSpotIds).toHaveBeenCalledTimes(1);
    expect(mapStoreMock.resetCategories).toHaveBeenCalledTimes(1);

    const activeChip = wrapper.get('button.filter-chip.badge-food');
    const inactiveChip = wrapper.get('button.filter-chip.badge-nightlife');

    expect(activeChip.classes()).not.toContain('is-inactive');
    expect(inactiveChip.classes()).toContain('is-inactive');

    await activeChip.trigger('click');
    await wrapper.get('button.visible-item').trigger('click');
    await wrapper.get('button.sidebar-reset-button').trigger('click');
    await flushPromises();

    expect(mapStoreMock.toggleCategory).toHaveBeenCalledWith('food');
    expect(mapStoreMock.setSelectedSpotId).toHaveBeenCalledWith('spot-1');
    expect(mapStoreMock.setCenter).toHaveBeenCalledWith([-97.3308, 32.7555]);
    expect(mapStoreMock.setZoom).toHaveBeenCalledWith(12);
    expect(mapStoreMock.resetCategories).toHaveBeenCalledTimes(2);
    expect(mapInteractionTrackMock).toHaveBeenNthCalledWith(1, 'category_toggle');
    expect(mapInteractionTrackMock).toHaveBeenNthCalledWith(2, 'visible_spot_focus');
    expect(mapInteractionTrackMock).toHaveBeenNthCalledWith(3, 'category_reset');
  });

  it('keeps the featured route off the map until it is previewed or pinned', async () => {
    const wrapper = mountMapPage();

    await flushPromises();

    const mapViewText = () => wrapper.find('[data-test="map-view-stub"]').text();
    const routeCard = wrapper.get('[data-test="map-featured-route-card"]');

    expect(mapViewText()).toContain('2 spots / 0 route points / 0 route coords /');

    await routeCard.trigger('mouseenter');
    await flushPromises();

    expect(mapViewText()).toContain('2 spots / 2 route points / 2 route coords /');

    await routeCard.trigger('mouseleave');
    await flushPromises();

    expect(mapViewText()).toContain('2 spots / 0 route points / 0 route coords /');

    await wrapper.get('[data-test="map-featured-route-toggle"]').trigger('click');
    await flushPromises();

    expect(mapViewText()).toContain('2 spots / 2 route points / 2 route coords /');
    expect(mapInteractionTrackMock).toHaveBeenCalledWith('featured_route_pin');

    await routeCard.trigger('mouseleave');
    await flushPromises();

    expect(mapViewText()).toContain('2 spots / 2 route points / 2 route coords /');

    await wrapper.get('[data-test="map-featured-route-toggle"]').trigger('click');
    await flushPromises();

    expect(mapViewText()).toContain('2 spots / 0 route points / 0 route coords /');
    expect(mapInteractionTrackMock).toHaveBeenCalledWith('featured_route_unpin');
  });

  it('uses full map labels when the viewport is already focused on a city-scale map', async () => {
    mapStoreMock.viewport = {
      ...mapStoreMock.viewport,
      zoom: 7,
    };

    const wrapper = mountMapPage();

    await flushPromises();

    expect(wrapper.find('[data-test="map-view-stub"]').text()).toContain('full');
  });

  it('scopes visible pins from measured map ids and cleans duplicated country labels', async () => {
    mapStoreMock.resetVisibleSpotIds.mockImplementation(() => undefined);
    spotsStoreMock.items = [
      {
        id: 'spot-paris',
        title: 'Canal Picnic Steps',
        description: 'A riverside pause after the gallery loop.',
        latitude: 48.8566,
        longitude: 2.3522,
        category: 'culture',
        city: 'Paris',
        country: 'France',
        vibe: 'slow art afternoon',
        rating: 4.9,
        photoUrl: '',
      },
      {
        id: 'spot-hidden',
        title: 'Hidden Outside Bounds',
        description: 'Should stay outside the measured map viewport.',
        latitude: 41.8781,
        longitude: -87.6298,
        category: 'food',
        city: 'Chicago',
        country: 'US',
        vibe: 'tasting menu',
        rating: 4.8,
        photoUrl: '',
      },
    ];
    spotsStoreMock.selectedSpot = {
      id: 'spot-paris',
      title: 'Canal Picnic Steps',
      description: 'A riverside pause after the gallery loop.',
      latitude: 48.8566,
      longitude: 2.3522,
      address: '10 Quai de Valmy',
      city: 'Paris',
      country: 'France',
      category: 'culture',
      vibe: 'slow art afternoon',
      rating: 4.9,
      photoUrl: '',
      photos: [],
      reviews: [],
      createdAt: '2026-05-20T00:00:00.000Z',
      isPublic: true,
    };
    mapStoreMock.visibleSpotIdsMeasured = true;
    mapStoreMock.visibleSpotIds = ['spot-paris'];
    mapStoreMock.selectedSpotId = 'spot-hidden';
    mapStoreMock.activeCategories = ['culture'];

    const wrapper = mountMapPage();

    await flushPromises();

    expect(wrapper.findAll('button.visible-item')).toHaveLength(1);
    expect(wrapper.text()).toContain('Canal Picnic Steps');
    expect(wrapper.text()).not.toContain('Hidden Outside Bounds');
    expect(wrapper.text()).toContain('Paris');
    expect(wrapper.text()).not.toContain('Paris, FranceFrance');
    expect(wrapper.get('[data-test="map-selected-spot-card"]').text()).toContain('Canal Picnic Steps');
    expect(wrapper.find('[data-test="map-view-stub"]').text()).toContain('2 spots');
  });

  it('renders measured-empty mobile summary copy without selecting a hidden spot', async () => {
    mapStoreMock.resetVisibleSpotIds.mockImplementation(() => undefined);
    mapStoreMock.visibleSpotIdsMeasured = true;
    mapStoreMock.visibleSpotIds = [];
    mapStoreMock.selectedSpotId = 'spot-1';

    const wrapper = mountMapPage({ mobile: true });

    await flushPromises();

    expect(wrapper.text()).toContain('0 spots ready to explore');
    expect(wrapper.get('[data-test="map-mobile-sheet-toggle"]').text()).toContain('0 spots ready to explore');
    expect(wrapper.find('[data-test="map-selected-spot-card"]').exists()).toBe(false);
  });

  it('syncs and ignores stale preferred-location map viewports', async () => {
    authStoreMock.currentUser = { homeBase: 'Chicago, IL' };
    resolveHomeBaseMapViewportMock.mockResolvedValueOnce({
      center: [-87.6298, 41.8781],
      zoom: 10,
      style: 'mapbox://styles/mapbox/light-v11',
    });

    mountMapPage();
    await flushPromises();

    expect(resolveHomeBaseMapViewportMock).toHaveBeenCalledWith('Chicago, IL');
    expect(mapStoreMock.setCenter).toHaveBeenCalledWith([-87.6298, 41.8781]);
    expect(mapStoreMock.setZoom).toHaveBeenCalledWith(10);
    expect(mapStoreMock.setStyle).toHaveBeenCalledWith('mapbox://styles/mapbox/light-v11');

    const staleViewport = createDeferred<{
      center: [number, number];
      zoom: number;
      style: string;
    } | null>();
    authStoreMock.currentUser = { homeBase: 'Austin, TX' };
    resolveHomeBaseMapViewportMock.mockReturnValueOnce(staleViewport.promise);
    mapStoreMock.setCenter.mockClear();

    const wrapper = mountMapPage();
    await flushPromises();

    wrapper.unmount();
    staleViewport.resolve({
      center: [-97.7431, 30.2672],
      zoom: 11,
      style: 'mapbox://styles/mapbox/outdoors-v12',
    });
    await flushPromises();

    expect(mapStoreMock.setCenter).not.toHaveBeenCalledWith([-97.7431, 30.2672]);
  });

  it('formats long and pending road-route metrics without collapsing the route card', async () => {
    resolveRoadRouteMock.mockResolvedValueOnce({
      geometry: [[-97.3308, 32.7555], [-97.363, 32.749]],
      orderedPoints: [
        { id: 'spot-1', latitude: 32.7555, longitude: -97.3308 },
        { id: 'spot-2', latitude: 32.749, longitude: -97.363 },
      ],
      distanceMeters: 19312.128,
      durationSeconds: 8100,
      provider: 'local-estimate',
      profile: 'local',
    });
    const longRouteWrapper = mountMapPage();

    await flushPromises();

    expect(longRouteWrapper.text()).toContain('2 hr 15 min');
    expect(longRouteWrapper.text()).toContain('12 mi');

    resolveRoadRouteMock.mockResolvedValueOnce({
      geometry: [[-97.3308, 32.7555], [-97.363, 32.749]],
      orderedPoints: [
        { id: 'spot-1', latitude: 32.7555, longitude: -97.3308 },
        { id: 'spot-2', latitude: 32.749, longitude: -97.363 },
      ],
      distanceMeters: 0,
      durationSeconds: 0,
      provider: 'local-estimate',
      profile: 'local',
    });
    const pendingRouteWrapper = mountMapPage();

    await flushPromises();

    expect(pendingRouteWrapper.text()).toContain('ETA pending');
    expect(pendingRouteWrapper.text()).toContain('distance pending');
  });

  it('renders focused one-stop and empty active route states from planner placeholders', async () => {
    tripsStoreMock.items = [
      {
        ...tripsStoreMock.items[0],
        description: 'Collaborative trip draft from Scope planner.',
        members: [{ id: 'user-solo', displayName: 'Solo Traveler' }],
        spots: [tripsStoreMock.items[0].spots[0]],
      },
    ];
    const oneStopWrapper = mountMapPage();

    await flushPromises();

    expect(resolveRoadRouteMock).not.toHaveBeenCalled();
    expect(oneStopWrapper.text()).toContain('A focused route preview around Fort Worth, TX');
    expect(oneStopWrapper.text()).toContain('1 trip stop');
    expect(oneStopWrapper.find('.route-preview-path-line').exists()).toBe(false);
    expect(oneStopWrapper.findAll('.route-timeline-stop')).toHaveLength(1);
    expect(oneStopWrapper.find('[data-test="map-view-stub"]').text()).toContain('0 route points');

    tripsStoreMock.items = [
      {
        ...tripsStoreMock.items[0],
        description: 'Planner previews land here.',
        spots: [],
      },
    ];
    const emptyActiveRouteWrapper = mountMapPage();

    await flushPromises();

    expect(emptyActiveRouteWrapper.text()).toContain('Route details coming together');
    expect(emptyActiveRouteWrapper.text()).toContain('Open planner');
  });

  it('uses loading and generated copy for planner placeholder descriptions', async () => {
    tripsStoreMock.items = [
      {
        ...tripsStoreMock.items[0],
        description: 'Pick a trip from the planner',
      },
    ];
    tripsStoreMock.loading = true;

    const loadingWrapper = mountMapPage();

    await flushPromises();

    expect(loadingWrapper.text()).toContain('Scope is syncing trip context into the map workspace.');

    tripsStoreMock.loading = false;
    tripsStoreMock.items = [
      {
        ...tripsStoreMock.items[0],
        description: 'Planner previews land here.',
      },
    ];

    const generatedWrapper = mountMapPage();

    await flushPromises();

    expect(generatedWrapper.text()).toContain('A live 2-stop route preview around Fort Worth, TX');
  });

  it('renders plain centered empty states when no trip preview or visible pins are available yet', async () => {
    tripsStoreMock.items = [
      {
        ...tripsStoreMock.items[0],
        spots: [],
      },
    ];
    mapStoreMock.visibleSpotIds = [];
    mapStoreMock.visibleSpotIdsMeasured = true;
    mapStoreMock.activeCategories = [];
    mapStoreMock.selectedSpotId = '';

    const wrapper = mountMapPage();

    await flushPromises();

    expect(wrapper.find('[data-test="map-route-empty-state"]').classes()).toContain('map-plain-empty-state');
    expect(wrapper.find('[data-test="map-sidebar-empty-state"]').classes()).toContain('map-plain-empty-state');
    expect(wrapper.findAll('[data-test="empty-state-panel"]')).toHaveLength(0);
    expect(wrapper.findAll('[data-test="empty-state-artwork"]')).toHaveLength(0);
    expect(wrapper.text()).toContain('Route details coming together');
    expect(wrapper.text()).toContain('No categories selected');
    expect(wrapper.get('[data-test="map-empty-route-cta"]').attributes('href')).toContain('/trips/new');

    await wrapper.get('[data-test="map-empty-reset-categories"]').trigger('click');
    await flushPromises();

    expect(mapStoreMock.resetCategories).toHaveBeenCalledTimes(2);
    expect(mapInteractionTrackMock).toHaveBeenCalledWith('category_reset');
  });

  it('clears stale measured viewport state before the map measures current pins', async () => {
    mapStoreMock.visibleSpotIds = [];
    mapStoreMock.visibleSpotIdsMeasured = true;
    mapStoreMock.selectedSpotId = '';

    const wrapper = mountMapPage();

    await flushPromises();

    expect(mapStoreMock.resetVisibleSpotIds).toHaveBeenCalledTimes(1);
    expect(wrapper.findAll('button.visible-item')).toHaveLength(2);
    expect(wrapper.text()).not.toContain('No pins match this category mix');
  });

  it('curates eight visible spot previews after stale selection is cleared', async () => {
    const categoryOrder = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'entertainment', 'scenic', 'other'] as const;
    spotsStoreMock.items = Array.from({ length: 12 }, (_, index) => {
      const category = categoryOrder[index % categoryOrder.length];
      return {
        id: `spot-curated-${index + 1}`,
        title: `Curated Spot ${index + 1}`,
        description: 'Balanced sidebar preview spot.',
        latitude: 30 + index,
        longitude: -97 - index,
        category,
        city: index === 0 ? 'Big Bend National Park' : 'Austin',
        country: 'US',
        vibe: 'curated',
        rating: 4.9 - (index * 0.01),
        photoUrl: `https://images.example.com/spot-curated-${index + 1}.jpg`,
      };
    });
    mapStoreMock.activeCategories = [...categoryOrder];
    mapStoreMock.visibleSpotIds = spotsStoreMock.items.map((spot) => spot.id);
    mapStoreMock.selectedSpotId = 'spot-curated-11';

    const wrapper = mountMapPage();

    await flushPromises();

    const visibleItems = wrapper.findAll('button.visible-item');
    expect(wrapper.text()).toContain('12 spots ready to explore');
    expect(visibleItems).toHaveLength(8);
    expect(visibleItems[0].text()).toContain('Curated Spot 1');
    expect(visibleItems[0].text()).not.toContain('USAUSA');
  });

  it('keeps a newly created selected spot in the map source even when it is outside the loaded page', async () => {
    spotsStoreMock.items = [spotsStoreMock.items[0]];
    spotsStoreMock.selectedSpot = {
      id: 'spot-created',
      title: 'Fresh Map Pin',
      description: 'Newly saved spot from the composer.',
      latitude: 30.2672,
      longitude: -97.7431,
      address: '100 Congress Ave',
      city: 'Austin',
      country: 'US',
      category: 'scenic',
      vibe: 'golden hour',
      rating: 4.9,
      photoUrl: 'https://images.example.com/spot-created.jpg',
      photos: [],
      reviews: [],
      createdAt: '2026-05-20T00:00:00.000Z',
      isPublic: true,
    };

    const wrapper = mountMapPage();

    await flushPromises();

    expect(wrapper.find('[data-test="map-view-stub"]').text()).toContain('2 spots');
  });

  it('switches to a mobile bottom-sheet sidebar and reveals it after selecting a map pin', async () => {
    const wrapper = mountMapPage({
      mobile: true,
      mapViewStub: {
        props: ['spots', 'routePoints', 'selectedSpotId'],
        template: `
          <div>
            <button data-test="map-view-mobile-select" @click="$emit('spot-select', spots[1])">
              {{ selectedSpotId }} / {{ spots.length }}
            </button>
            <button data-test="map-view-mobile-interaction" @click="$emit('interaction', { type: 'fit_route' })">
              Emit map interaction
            </button>
          </div>
        `,
      },
    });

    await flushPromises();

    const getSheetState = () => wrapper.get('[data-test="map-mobile-sheet"]').attributes('data-sheet-state');

    expect(getSheetState()).toBe('peek');
    expect(wrapper.get('[data-test="map-mobile-sheet-toggle"]').attributes('aria-expanded')).toBe('false');

    await wrapper.get('[data-test="map-view-mobile-select"]').trigger('click');
    await flushPromises();

    expect(mapStoreMock.setSelectedSpotId).toHaveBeenLastCalledWith('spot-2');
    expect(mapInteractionTrackMock).toHaveBeenCalledWith('spot_select');
    expect(getSheetState()).toBe('mid');
    expect(wrapper.text()).toContain('Botanic River Walk');

    await wrapper.get('[data-test="map-view-mobile-interaction"]').trigger('click');
    await flushPromises();

    expect(mapInteractionTrackMock).toHaveBeenLastCalledWith('fit_route');

    await wrapper.get('[data-test="map-mobile-sheet-toggle"]').trigger('click');

    expect(getSheetState()).toBe('full');
  });

  it('supports mobile sheet drag, ignored post-drag taps, and Escape collapse', async () => {
    const wrapper = mountMapPage({ mobile: true });

    await flushPromises();

    const sheet = wrapper.get('[data-test="map-mobile-sheet"]');
    const toggle = wrapper.get('[data-test="map-mobile-sheet-toggle"]');
    const getSheetState = () => sheet.attributes('data-sheet-state');
    const originalSetPointerCapture = HTMLElement.prototype.setPointerCapture;
    const setPointerCaptureSpy = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: setPointerCaptureSpy,
    });

    expect(getSheetState()).toBe('peek');

    await toggle.trigger('pointerdown', { clientY: 320, pointerId: 9 });
    expect(setPointerCaptureSpy).toHaveBeenCalledWith(9);
    dispatchPointerEvent('pointermove', { clientY: 190, pointerId: 9 });
    await flushPromises();
    expect(sheet.attributes('style')).toContain('--scope-mobile-sheet-drag-offset: -130px');

    dispatchPointerEvent('pointerup', { clientY: 190, pointerId: 9 });
    await flushPromises();
    expect(getSheetState()).toBe('mid');

    await toggle.trigger('click');
    expect(getSheetState()).toBe('mid');

    await toggle.trigger('click');
    expect(getSheetState()).toBe('full');

    await toggle.trigger('pointerdown', { clientY: 180, pointerId: 10 });
    dispatchPointerEvent('pointermove', { clientY: 300, pointerId: 10 });
    dispatchPointerEvent('pointerup', { clientY: 300, pointerId: 10 });
    await flushPromises();
    expect(getSheetState()).toBe('mid');

    await sheet.trigger('keydown', { key: 'Escape' });
    expect(getSheetState()).toBe('peek');

    setPointerCaptureSpy.mockImplementation(() => {
      throw new Error('pointer capture unavailable');
    });
    await toggle.trigger('pointerdown', { clientY: 220, pointerId: 11 });
    dispatchPointerEvent('pointercancel', { clientY: 220, pointerId: 11 });

    setViewportWidth(900);
    window.dispatchEvent(new Event('resize'));
    await toggle.trigger('pointerdown', { clientY: 220, pointerId: 12 });
    await toggle.trigger('click');
    await flushPromises();
    expect(sheet.attributes('data-sheet-state')).toBe('desktop');

    if (originalSetPointerCapture) {
      Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
        configurable: true,
        value: originalSetPointerCapture,
      });
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'setPointerCapture');
    }
  });

  it('opens the mobile sheet fully during the map onboarding step so filters stay visible', async () => {
    onboardingStoreMock.isActive = true;
    onboardingStoreMock.activeStep = { routeName: 'map' };

    const wrapper = mountMapPage({ mobile: true });

    await flushPromises();

    expect(wrapper.get('[data-test="map-mobile-sheet"]').attributes('data-sheet-state')).toBe('full');
    expect(wrapper.get('[data-onboarding-target="map-filters"]').exists()).toBe(true);
  });

  it('opens and dismisses the desktop selected map overlay from map pin selection', async () => {
    const wrapper = mountMapPage({
      mapViewStub: {
        props: ['spots', 'selectedSpotId'],
        template: `
          <button data-test="map-view-desktop-select" @click="$emit('spot-select', spots[1])">
            {{ selectedSpotId }} / {{ spots.length }}
          </button>
        `,
      },
    });

    await flushPromises();

    expect(wrapper.find('[data-test="map-selected-overlay"]').exists()).toBe(false);

    await wrapper.get('[data-test="map-view-desktop-select"]').trigger('click');
    await flushPromises();

    expect(mapStoreMock.setSelectedSpotId).toHaveBeenLastCalledWith('spot-2');
    expect(wrapper.get('[data-test="map-selected-overlay"]').text()).toContain('Botanic River Walk');
    expect(mapInteractionTrackMock).toHaveBeenCalledWith('spot_select');

    await wrapper.get('.map-selected-overlay__close').trigger('click');
    await flushPromises();

    expect(mapStoreMock.setSelectedSpotId).toHaveBeenLastCalledWith(null);
    expect(mapInteractionTrackMock).toHaveBeenCalledWith('spot_preview_dismiss');
  });

  it('keeps map page camera control click-driven instead of auto-locating on load', async () => {
    const wrapper = mountMapPage({
      mapViewStub: {
        props: ['autoLocateOnLoad'],
        template: '<div data-test="map-view-auto-locate">{{ String(autoLocateOnLoad) }}</div>',
      },
    });

    await flushPromises();

    expect(wrapper.get('[data-test="map-view-auto-locate"]').text()).toBe('false');
  });

  it('keeps route order stable when road-route lookup fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    resolveRoadRouteMock.mockRejectedValueOnce(new Error('route service unavailable'));

    const wrapper = mountMapPage();

    await flushPromises();

    expect(warnSpy).toHaveBeenCalledWith(
      '[scope-map] Road route resolution failed; keeping stop order stable.',
      expect.any(Error),
    );
    expect(wrapper.find('[data-test="map-view-stub"]').text()).toContain('0 route points / 0 route coords');
    expect(wrapper.text()).not.toContain('13 min');

    warnSpy.mockRestore();
  });

  it('ignores stale road-route results after the map page unmounts', async () => {
    const routeRequest = createDeferred<{
      geometry: number[][];
      orderedPoints: Array<{ id: string; latitude: number; longitude: number }>;
      distanceMeters: number;
      durationSeconds: number;
      provider: string;
      profile: string;
    }>();
    resolveRoadRouteMock.mockReturnValueOnce(routeRequest.promise);

    const wrapper = mountMapPage();
    await flushPromises();

    expect(resolveRoadRouteMock).toHaveBeenCalledTimes(1);

    wrapper.unmount();
    routeRequest.resolve({
      geometry: [[-97.3308, 32.7555], [-97.363, 32.749]],
      orderedPoints: [
        { id: 'spot-1', latitude: 32.7555, longitude: -97.3308 },
        { id: 'spot-2', latitude: 32.749, longitude: -97.363 },
      ],
      distanceMeters: 3218.688,
      durationSeconds: 780,
      provider: 'local-estimate',
      profile: 'local',
    });
    await flushPromises();

    const failedRouteRequest = createDeferred<{
      geometry: number[][];
      orderedPoints: Array<{ id: string; latitude: number; longitude: number }>;
      distanceMeters: number;
      durationSeconds: number;
      provider: string;
      profile: string;
    }>();
    resolveRoadRouteMock.mockReturnValueOnce(failedRouteRequest.promise);
    const secondWrapper = mountMapPage();
    await flushPromises();

    secondWrapper.unmount();
    failedRouteRequest.reject(new Error('stale route failed'));
    await flushPromises();
  });

  it('shows a workspace error panel when route data fails to load', async () => {
    tripsStoreMock.error = 'Scope could not load trips right now.';
    tripsStoreMock.fetchTrips.mockRejectedValue(new Error('Trips failed'));

    const wrapper = mountMapPage();

    await flushPromises();

    expect(wrapper.text()).toContain('Part of the map workspace could not be loaded');
    expect(wrapper.text()).toContain('Scope could not load trips right now.');
  });
});
