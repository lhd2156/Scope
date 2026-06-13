import { flushPromises, mount } from '@vue/test-utils';

const ORIGINAL_INNER_WIDTH = window.innerWidth;

const {
  authStoreMock,
  getDefaultDiscoveryMapViewportMock,
  mapInteractionTrackMock,
  mapStoreMock,
  onboardingStoreMock,
  routeMock,
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
  routeMock: {
    query: {} as Record<string, unknown>,
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
    fetchSpot: vi.fn().mockResolvedValue(undefined),
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
    useRoute: () => routeMock,
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
    routeMock.query = {};
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
    spotsStoreMock.fetchSpot.mockReset().mockResolvedValue(undefined);
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

  it('keeps the featured route off the map until the card is clicked', async () => {
    const wrapper = mountMapPage();

    await flushPromises();

    const mapViewText = () => wrapper.find('[data-test="map-view-stub"]').text();
    const routeCard = wrapper.get('[data-test="map-featured-route-card"]');

    expect(mapViewText()).toContain('2 spots / 0 route points / 0 route coords /');

    await routeCard.trigger('mouseenter');
    await flushPromises();

    expect(mapViewText()).toContain('2 spots / 0 route points / 0 route coords /');

    await routeCard.trigger('mouseleave');
    await flushPromises();

    expect(mapViewText()).toContain('2 spots / 0 route points / 0 route coords /');

    await routeCard.trigger('click');
    await flushPromises();

    expect(mapViewText()).toContain('2 spots / 2 route points / 2 route coords /');
    expect(mapInteractionTrackMock).toHaveBeenCalledWith('featured_route_pin');

    await routeCard.trigger('mouseleave');
    await flushPromises();

    expect(mapViewText()).toContain('2 spots / 2 route points / 2 route coords /');

    await routeCard.trigger('click');
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

  it('resolves seeded visible spot locations instead of showing placeholder location copy', async () => {
    mapStoreMock.resetVisibleSpotIds.mockImplementation(() => undefined);
    spotsStoreMock.items = [
      {
        id: 'seed-mule-alley-mercantile-row',
        title: 'Mule Alley Mercantile Row',
        description: 'Western storefronts and a walkable stockyards shopping lane.',
        latitude: 32.789,
        longitude: -97.348,
        category: 'shopping',
        rating: 4.6,
        photoUrl: 'https://images.example.com/mule-alley.jpg',
        createdAt: '2026-05-20T00:00:00.000Z',
      },
    ];
    mapStoreMock.visibleSpotIdsMeasured = true;
    mapStoreMock.visibleSpotIds = ['seed-mule-alley-mercantile-row'];
    mapStoreMock.selectedSpotId = null;
    mapStoreMock.activeCategories = ['shopping'];

    const wrapper = mountMapPage();

    await flushPromises();

    const visibleCardText = wrapper.get('.visible-card').text();
    expect(visibleCardText).toContain('Mule Alley Mercantile Row');
    expect(visibleCardText).toContain('Fort Worth, TX');
    expect(wrapper.get('.visible-country-badge').text()).toBe('USA');
    expect(wrapper.get('.selected-country-badge').text()).toBe('USA');
    expect(visibleCardText).not.toContain('Scope location');
  });

  it('shows country badges for seeded visible spots that already have city and region copy', async () => {
    mapStoreMock.resetVisibleSpotIds.mockImplementation(() => undefined);
    spotsStoreMock.items = [
      {
        id: 'seed-pearl-district-market-hall',
        title: 'Pearl District Market Hall',
        description: 'Food hall and river access.',
        latitude: 29.4427,
        longitude: -98.4797,
        category: 'food',
        city: 'San Antonio',
        rating: 4.7,
        photoUrl: 'https://images.example.com/pearl.jpg',
        createdAt: '2026-05-20T00:00:00.000Z',
      },
      {
        id: 'seed-millennium-park-bean-loop',
        title: 'Millennium Park Bean Loop',
        description: 'Public art and skyline framing.',
        latitude: 41.8827,
        longitude: -87.6233,
        category: 'culture',
        city: 'Chicago',
        rating: 4.8,
        photoUrl: 'https://images.example.com/bean.jpg',
        createdAt: '2026-05-20T00:00:00.000Z',
      },
    ];
    mapStoreMock.visibleSpotIdsMeasured = true;
    mapStoreMock.visibleSpotIds = ['seed-pearl-district-market-hall', 'seed-millennium-park-bean-loop'];
    mapStoreMock.selectedSpotId = null;
    mapStoreMock.activeCategories = ['food', 'culture'];

    const wrapper = mountMapPage();

    await flushPromises();

    const visibleItems = wrapper.findAll('button.visible-item');
    expect(visibleItems).toHaveLength(2);
    expect(visibleItems[0].text()).toContain('San Antonio, TX');
    expect(visibleItems[1].text()).toContain('Chicago, IL');
    expect(wrapper.findAll('.visible-country-badge').map((badge) => badge.text())).toEqual(['USA', 'USA']);
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

  it('covers map helper fallbacks, route copy, and mobile sheet branch controls', async () => {
    tripsStoreMock.items = [
      {
        id: 'trip-empty',
        title: '',
        description: '',
        destination: 'Austin · TX',
        coverImageUrl: undefined,
        members: [
          { id: 'user-a', displayName: '  Ada  ' },
          { id: 'user-b', displayName: 'Grace Hopper' },
        ],
        spots: [],
      },
    ];
    tripsStoreMock.loading = true;
    mapStoreMock.activeCategories = [];
    mapStoreMock.visibleSpotIds = [];
    mapStoreMock.visibleSpotIdsMeasured = true;
    mapStoreMock.selectedSpotId = null;

    const wrapper = mountMapPage({ mobile: true });

    await flushPromises();

    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    const read = <T>(entry: T | { value: T }): T => (
      entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry as T
    );
    const write = <T>(entry: { value: T }, value: T) => {
      entry.value = value;
    };

    expect(coverage.clampNumber(-4, 0, 3)).toBe(0);
    expect(coverage.clampNumber(9, 0, 3)).toBe(3);
    expect(coverage.clampNumber(2, 0, 3)).toBe(2);
    expect(coverage.formatCategory('nightlife')).toBe('Nightlife');
    expect(coverage.categoryIconName('other')).toBe('pin');
    expect(coverage.categoryIconName('food')).toBe('food');
    expect(coverage.getSpotPhotoUrl('culture', 'https://images.example.com/culture.jpg')).toBe('https://images.example.com/culture.jpg');
    expect(coverage.getSpotPhotoUrl('culture', '')).toBe(coverage.getFallbackPhoto('culture'));
    expect(coverage.getMemberInitials('  louis   do  extra ')).toBe('LD');
    expect(coverage.getMemberInitials('')).toBe('');
    expect(coverage.formatRouteDuration(Number.NaN)).toBe('ETA pending');
    expect(coverage.formatRouteDuration(45)).toBe('1 min');
    expect(coverage.formatRouteDuration(3600)).toBe('1 hr');
    expect(coverage.formatRouteDuration(3660)).toBe('1 hr 1 min');
    expect(coverage.formatRouteDistance(Number.NaN)).toBe('distance pending');
    expect(coverage.formatRouteDistance(804.672)).toBe('0.5 mi');
    expect(coverage.formatRouteDistance(16_093.44)).toBe('10 mi');

    const noLocationSpot = {
      id: 'spot-no-location',
      title: 'Hidden overlook',
      description: 'Quiet place.',
      latitude: 0,
      longitude: 0,
      category: 'scenic',
      city: '',
      country: '',
      vibe: '',
      rating: 4.4,
      photoUrl: '',
    };
    expect(coverage.formatSpotCityRegion(noLocationSpot)).toBe('Location syncing');
    expect(coverage.formatSpotFullLocation(noLocationSpot)).toBe('Location syncing');
    expect(coverage.formatSpotCountryBadge(null)).toBe('');

    const workspaceSpot = coverage.toWorkspaceSpot({
      id: 'spot-defaults',
      title: 'Defaulted pin',
      latitude: 30,
      longitude: -97,
      category: 'other',
      rating: 4.2,
      createdAt: '2026-06-01T00:00:00.000Z',
      isPublic: true,
    });
    expect(workspaceSpot.description).toContain('Saved Scope spot');
    expect(workspaceSpot.city).toBe('');
    expect(workspaceSpot.country).toBe('');
    expect(workspaceSpot.vibe).toBe('Other');
    expect(workspaceSpot.photoUrl).toBe(coverage.getFallbackPhoto('other'));
    expect(coverage.mergeSpotSources([{ id: 'a' }, { id: 'b' }], null).map((spot: { id: string }) => spot.id)).toEqual(['a', 'b']);
    expect(coverage.mergeSpotSources([{ id: 'a' }, { id: 'b' }], { id: 'a' }).map((spot: { id: string }) => spot.id)).toEqual(['a', 'b']);
    expect(coverage.labelRouteMapPoints([
      { id: 'start', title: 'Start', latitude: 1, longitude: 1, category: 'food' },
      { id: 'middle', title: 'Middle', latitude: 2, longitude: 2, category: 'nature' },
      { id: 'end', title: 'End', latitude: 3, longitude: 3, category: 'scenic' },
    ]).map((point: { routeRole: string; routeLabel: string }) => `${point.routeRole}:${point.routeLabel}`)).toEqual(['start:S', 'stop:2', 'end:E']);
    expect(coverage.isRouteDescriptionPlaceholder('')).toBe(true);
    expect(coverage.isRouteDescriptionPlaceholder('Pick a trip from the planner')).toBe(true);
    expect(coverage.isRouteDescriptionPlaceholder('A real hand-written itinerary note.')).toBe(false);
    expect(coverage.buildRoutePointRequestKey({
      id: 'point-1',
      title: 'Point',
      latitude: 32.123456,
      longitude: -97.654321,
      category: 'food',
    })).toBe('point-1:-97.65432,32.12346');

    expect(read<string>(coverage.routeTitle)).toBe('Loading route preview');
    expect(read<string>(coverage.routeDescription)).toContain('syncing trip context');
    expect(read<string>(coverage.routeDestinationDisplay)).toBe('Austin, TX');
    expect(read<string>(coverage.routeStopMetric)).toBe('0 trip stops');
    expect(read<string>(coverage.routeDriveMetric)).toEqual(expect.any(String));
    expect(read<string>(coverage.routeDistanceMetric)).toEqual(expect.any(String));
    expect(read<string>(coverage.routeTravelerMetric)).toBe('2 Travelers');
    expect(read<string>(coverage.routeHeroPhoto)).toBe(coverage.getFallbackPhoto('adventure'));
    expect(read<Array<{ initials: string }>>(coverage.routeMemberPreview).map((member) => member.initials)).toEqual(['A', 'GH']);
    expect(read<string>(coverage.visibleEmptyTitle)).toBe('No categories selected');
    expect(read<string>(coverage.visibleEmptyDescription)).toContain('Turn on a category');
    expect(read<unknown>(coverage.selectedSpot)).toBeNull();
    expect(read<string>(coverage.mobileSheetHeadline)).toBe('No categories selected');
    expect(read<string>(coverage.mobileSheetDescription)).toContain('0 spots ready to explore');
    expect(read<string>(coverage.mobileSheetAriaLabel)).toBe('Expand map sidebar');
    expect(read<Record<string, string>>(coverage.mobileSheetStyle)['--scope-mobile-sheet-visible']).toBe('9.5rem');
    expect(read<Record<string, string>>(coverage.mapViewStyle)['--scope-map-controls-bottom']).toContain('var(--scope-mobile-sheet-visible)');

    coverage.setMobileSheetState('mid');
    expect(read<string>(coverage.nextMobileSheetState)).toBe('full');
    expect(read<string>(coverage.mobileSheetVisibleHeight)).toContain('58dvh');
    expect(read<string>(coverage.mobileSheetAriaLabel)).toBe('Open full map sidebar');
    coverage.setMobileSheetState('full');
    expect(read<string>(coverage.nextMobileSheetState)).toBe('peek');
    expect(read<string>(coverage.mobileSheetVisibleHeight)).toBe('100%');
    expect(read<string>(coverage.mobileSheetAriaLabel)).toBe('Collapse map sidebar');
    expect(coverage.getAdjacentMobileSheetState(-1)).toBe('mid');
    expect(coverage.getAdjacentMobileSheetState(1)).toBe('full');

    write(coverage.isMobileMapLayout, false);
    expect(read<undefined>(coverage.mobileSheetStyle)).toBeUndefined();
    expect(read<undefined>(coverage.mapViewStyle)).toBeUndefined();
    coverage.handleMobileSheetToggle();
    expect(read<string>(coverage.mobileSheetState)).toBe('full');

    write(coverage.isMobileMapLayout, true);
    coverage.handleMobileSheetToggle();
    expect(read<string>(coverage.mobileSheetState)).toBe('peek');
    coverage.revealMobileSheet();
    expect(read<string>(coverage.mobileSheetState)).toBe('mid');
    coverage.handleMobileSheetDrag({ clientY: 300 } as PointerEvent);
    expect(read<number>(coverage.mobileSheetDragOffset)).toBe(0);

    const dragHandle = document.createElement('button');
    dragHandle.setPointerCapture = vi.fn(() => {
      throw new Error('pointer capture unavailable');
    });
    coverage.startMobileSheetDrag({
      currentTarget: dragHandle,
      pointerId: 17,
      clientY: 300,
    } as PointerEvent);
    expect(read<boolean>(coverage.isDraggingMobileSheet)).toBe(true);
    coverage.handleMobileSheetDrag({ clientY: 0 } as PointerEvent);
    expect(read<number>(coverage.mobileSheetDragOffset)).toBe(-280);
    coverage.finishMobileSheetDrag();
    expect(read<string>(coverage.mobileSheetState)).toBe('full');
    expect(read<boolean>(coverage.ignoreNextMobileSheetClick)).toBe(true);
    coverage.handleMobileSheetToggle();
    expect(read<string>(coverage.mobileSheetState)).toBe('full');
    coverage.cancelMobileSheetDrag();
  });

  it('keeps map previews stable when road ordering and selected visible pins fall back', async () => {
    const visibleSpots = Array.from({ length: 9 }, (_, index) => ({
      id: `visible-${index}`,
      title: `Visible Spot ${index}`,
      description: `Spot ${index}`,
      latitude: 32.7 + index / 100,
      longitude: -97.3 - index / 100,
      category: index % 3 === 0 ? 'food' : index % 3 === 1 ? 'nature' : 'culture',
      city: 'Fort Worth',
      country: 'US',
      vibe: 'steady',
      rating: 4 + index / 10,
      photoUrl: '',
    }));
    spotsStoreMock.items = visibleSpots;
    tripsStoreMock.items = [{
      id: 'trip-source-order',
      title: 'Source Order Route',
      description: '',
      destination: 'Fort Worth, TX',
      members: [],
      spots: [
        {
          spotId: 'visible-5',
          title: 'Source Five',
          latitude: 32.75,
          longitude: -97.35,
          category: 'culture',
          dayNumber: 2,
        },
        {
          spotId: 'visible-2',
          title: 'Source Two',
          latitude: 32.72,
          longitude: -97.32,
          category: 'culture',
          dayNumber: 1,
        },
      ],
    }];
    mapStoreMock.activeCategories = ['food', 'nature', 'culture'];
    mapStoreMock.visibleSpotIds = visibleSpots.map((spot) => spot.id);
    mapStoreMock.visibleSpotIdsMeasured = true;
    mapStoreMock.selectedSpotId = 'missing-selected-pin';
    resolveRoadRouteMock.mockResolvedValueOnce({
      geometry: [[-97, 32]],
      orderedPoints: [{ id: 'external-route-point', latitude: 32, longitude: -97 }],
      distanceMeters: 1_609,
      durationSeconds: 300,
      provider: 'local-estimate',
      profile: 'local',
    });

    const wrapper = mountMapPage();
    await flushPromises();

    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    const read = <T>(entry: T | { value: T }): T => (
      entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry as T
    );

    expect(read<Array<{ spotId: string }>>(coverage.activeRouteStops).map((stop) => stop.spotId)).toEqual([
      'visible-5',
      'visible-2',
    ]);
    expect(read<Array<{ id: string }>>(coverage.visibleSpotPreviews)).toHaveLength(8);
    expect(read<{ id: string } | null>(coverage.selectedSpot)?.id).toBe('visible-0');
    expect(read<string>(coverage.selectedSpotCountryBadge)).toBe('USA');
  });

  it('renders lean spot and route fallback labels without country or vibe badges', async () => {
    spotsStoreMock.items = [
      {
        id: 'lean-spot',
        title: 'Lean Map Pin',
        description: 'A saved pin with sparse location metadata.',
        latitude: 39.7392,
        longitude: -104.9903,
        category: 'scenic',
        city: '',
        country: '',
        vibe: '',
        rating: 4.4,
        photoUrl: '',
      },
    ];
    tripsStoreMock.items = [
      {
        id: 'trip-lean-route',
        title: '',
        description: '',
        destination: '',
        coverImageUrl: '',
        members: [],
        spots: [
          {
            spotId: 'lean-spot',
            title: 'Lean Map Pin',
            latitude: 39.7392,
            longitude: -104.9903,
            category: 'scenic',
          },
          {
            spotId: 'lean-stop-2',
            title: 'Second Sparse Stop',
            latitude: 39.75,
            longitude: -104.98,
            category: 'nature',
          },
        ],
      },
    ];
    mapStoreMock.activeCategories = ['scenic', 'nature'];
    mapStoreMock.visibleSpotIds = ['lean-spot'];
    mapStoreMock.visibleSpotIdsMeasured = true;
    mapStoreMock.selectedSpotId = 'lean-spot';

    const wrapper = mountMapPage({
      mapViewStub: {
        props: ['spots', 'selectedSpotId'],
        template: `
          <button data-test="map-view-lean-select" @click="$emit('spot-select', spots[0])">
            {{ selectedSpotId }} / {{ spots.length }}
          </button>
        `,
      },
    });

    await flushPromises();

    const selectedCard = wrapper.get('[data-test="map-selected-spot-card"]');
    expect(selectedCard.text()).toContain('Lean Map Pin');
    expect(selectedCard.text()).toContain('Location syncing');
    expect(selectedCard.find('.selected-country-badge').exists()).toBe(false);
    expect(selectedCard.find('.selected-spot-card__vibe').exists()).toBe(false);
    expect(wrapper.find('.visible-country-badge').exists()).toBe(false);
    expect(wrapper.find('.route-timeline').text()).toContain('Day 1');

    await wrapper.get('[data-test="map-view-lean-select"]').trigger('click');
    await flushPromises();

    const overlay = wrapper.get('[data-test="map-selected-overlay"]');
    expect(overlay.text()).toContain('Lean Map Pin');
    expect(overlay.text()).toContain('Location syncing');
    expect(overlay.find('.map-selected-overlay__vibe').exists()).toBe(false);
  });

  it('handles small and downward mobile sheet drags without leaving stale click suppression', async () => {
    const wrapper = mountMapPage({ mobile: true });
    await flushPromises();

    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    const read = <T>(entry: T | { value: T }): T => (
      entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry as T
    );

    coverage.setMobileSheetState('mid');
    coverage.startMobileSheetDrag({
      currentTarget: {},
      pointerId: 21,
      clientY: 200,
    } as PointerEvent);
    coverage.handleMobileSheetDrag({ clientY: 206 } as PointerEvent);
    coverage.finishMobileSheetDrag();
    expect(read<string>(coverage.mobileSheetState)).toBe('mid');
    expect(read<boolean>(coverage.ignoreNextMobileSheetClick)).toBe(false);

    coverage.setMobileSheetState('full');
    coverage.startMobileSheetDrag({
      currentTarget: {},
      pointerId: 22,
      clientY: 180,
    } as PointerEvent);
    coverage.handleMobileSheetDrag({ clientY: 310 } as PointerEvent);
    expect(read<number>(coverage.mobileSheetDragOffset)).toBe(130);
    coverage.finishMobileSheetDrag();
    expect(read<string>(coverage.mobileSheetState)).toBe('mid');
    expect(read<boolean>(coverage.ignoreNextMobileSheetClick)).toBe(true);

    coverage.handleMobileSheetToggle();
    expect(read<boolean>(coverage.ignoreNextMobileSheetClick)).toBe(false);
    expect(read<string>(coverage.mobileSheetState)).toBe('mid');

    coverage.handleSidebarKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(read<string>(coverage.mobileSheetState)).toBe('peek');
    coverage.handleSidebarKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(read<string>(coverage.mobileSheetState)).toBe('peek');

    wrapper.unmount();
  });

  it('keeps local preview, selected detail pins, and route ordering stable across empty store fallbacks', async () => {
    const previewSpots = Array.from({ length: 10 }, (_, index) => ({
      id: `preview-${index}`,
      title: `Preview Spot ${index}`,
      description: `Preview ${index}`,
      latitude: 34 + index / 100,
      longitude: -118 - index / 100,
      category: index % 3 === 0 ? 'food' : index % 3 === 1 ? 'nature' : 'culture',
      city: index % 2 === 0 ? 'Los Angeles' : '',
      country: 'US',
      vibe: index % 2 === 0 ? 'bright' : '',
      rating: 4.9 - index / 20,
      photoUrl: '',
    }));
    const previewTrip = {
      id: 'local-preview-route',
      title: '',
      description: '',
      destination: '',
      coverImageUrl: '',
      members: [],
      spots: [
        {
          spotId: 'preview-4',
          title: 'Preview Four',
          latitude: 34.04,
          longitude: -118.04,
          category: 'nature',
          dayNumber: 2,
        },
        {
          spotId: 'preview-1',
          title: 'Preview One',
          latitude: 34.01,
          longitude: -118.01,
          category: 'nature',
          dayNumber: 1,
        },
      ],
    };

    spotsStoreMock.items = [];
    spotsStoreMock.selectedSpot = {
      id: 'detail-selected',
      title: 'Detail Selected',
      description: '',
      latitude: 35,
      longitude: -119,
      category: 'food',
      city: '',
      country: '',
      rating: 4.6,
      photoUrl: undefined,
      photos: [{ url: 'https://images.example.com/detail-photo.jpg' }],
      isPublic: true,
    };
    tripsStoreMock.items = [];
    tripsStoreMock.error = 'Trip errors should stay hidden for guests';
    authStoreMock.isAuthenticated = false;
    mapStoreMock.activeCategories = ['food', 'nature', 'culture'];
    mapStoreMock.visibleSpotIds = [];
    mapStoreMock.visibleSpotIdsMeasured = false;
    mapStoreMock.selectedSpotId = null;

    const wrapper = mountMapPage();
    await flushPromises();

    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    const read = <T>(entry: T | { value: T }): T => (
      entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry as T
    );
    const write = <T>(entry: { value: T }, value: T) => {
      entry.value = value;
    };

    write(coverage.localPreviewSpots, previewSpots);
    write(coverage.localPreviewTrip, previewTrip);
    write(coverage.hasLoadedSpotData, false);
    write(coverage.hasLoadedTripData, false);
    write(coverage.roadRoute, {
      geometry: [[-118.5, 34.5], [-118.6, 34.6]],
      orderedPoints: [
        { id: 'route-point-not-in-source-a', latitude: 34.5, longitude: -118.5 },
        { id: 'route-point-not-in-source-b', latitude: 34.6, longitude: -118.6 },
      ],
      distanceMeters: 0,
      durationSeconds: 0,
      provider: 'local-estimate',
      profile: 'local',
    });
    write(coverage.roadRouteLoading, false);

    expect(read<Array<{ id: string; photoUrl: string }>>(coverage.workspaceSpots)[0]).toMatchObject({
      id: 'detail-selected',
      photoUrl: 'https://images.example.com/detail-photo.jpg',
    });
    expect(read<Array<{ id: string }>>(coverage.mapSpots)[0].id).toBe('detail-selected');
    expect(read<string>(coverage.workspaceError)).toBe('');
    expect(read<{ id: string } | null>(coverage.activeTrip)?.id).toMatch(/local-preview-route|public-featured-route|trip-/);
    expect(read<Array<{ id: string }>>(coverage.visibleSpotPreviews)).toHaveLength(8);
    expect(read<Array<{ id: string }>>(coverage.visibleSpotPreviews)[0].id).toBe('detail-selected');
    expect(read<{ id: string } | null>(coverage.selectedSpot)?.id).toBe('detail-selected');
    expect(read<string>(coverage.selectedSpotPhoto)).toBe('https://images.example.com/detail-photo.jpg');
    expect(read<string>(coverage.selectedSpotLocation)).toBe('Location syncing');
    expect(read<Array<{ spotId: string }>>(coverage.activeRouteStops).map((stop) => stop.spotId)).toEqual([
      'preview-4',
      'preview-1',
    ]);
    expect(read<Array<{ city: string }>>(coverage.routeStopsPreview)[0].city).toBe('Los Angeles');
    expect(read<string>(coverage.routeDriveMetric)).toBe('ETA pending');
    expect(read<string>(coverage.routeDistanceMetric)).toBe('distance pending');
    expect(read<string>(coverage.routeTravelerMetric)).toMatch(/\d+ Travelers?/);
    expect(read<string>(coverage.routeHeroPhoto)).toBe('');

    mapStoreMock.selectedSpotId = 'preview-8';
    mapStoreMock.activeCategories = ['food'];
    write(coverage.localPreviewSpots, [...previewSpots]);
    expect(read<{ id: string } | null>(coverage.selectedSpot)?.id).toBe('detail-selected');

    const sidebar = document.createElement('aside');
    Object.defineProperty(sidebar, 'scrollTop', {
      configurable: true,
      value: 18,
    });
    write(coverage.mapSidebarRef, sidebar);
    write(coverage.isMobileMapLayout, false);
    coverage.syncMapSidebarScrollState();
    expect(read<boolean>(coverage.isMapSidebarScrolled)).toBe(true);
    write(coverage.isMobileMapLayout, true);
    coverage.syncMapSidebarScrollState();
    expect(read<boolean>(coverage.isMapSidebarScrolled)).toBe(false);

    const fetchSpotsCallCount = spotsStoreMock.fetchSpots.mock.calls.length;
    await coverage.syncFocusedMapSpot();
    expect(spotsStoreMock.fetchSpots).toHaveBeenCalledTimes(fetchSpotsCallCount);

    vi.stubEnv('MODE', 'production');
    vi.stubEnv('VITE_ENABLE_LOCAL_PREVIEW', '');
    write(coverage.localPreviewSpots, []);
    write(coverage.localPreviewTrip, null);
    await coverage.loadLocalMapPreviewData();
    expect(read<Array<unknown>>(coverage.localPreviewSpots)).toEqual([]);
    vi.stubEnv('MODE', 'test');
    vi.stubEnv('VITE_ENABLE_LOCAL_PREVIEW', undefined);

    wrapper.unmount();
  });

  it('focuses a map spot from the route query without disturbing route preview state', async () => {
    routeMock.query = { spotId: '  focused-spot  ' };
    spotsStoreMock.fetchSpot.mockResolvedValueOnce(undefined);
    mapStoreMock.selectedSpotId = null;

    const wrapper = mountMapPage();
    await flushPromises();

    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    const read = <T>(entry: T | { value: T }): T => (
      entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry as T
    );

    expect(read<string>(coverage.focusedMapSpotId)).toBe('focused-spot');
    await coverage.syncFocusedMapSpot();
    await flushPromises();

    expect(spotsStoreMock.fetchSpot).toHaveBeenCalledWith('focused-spot');
    expect(mapStoreMock.setSelectedSpotId).toHaveBeenCalledWith('focused-spot');
    expect(read<boolean>(coverage.hasLoadedSpotData)).toBe(true);
    expect(read<string>(coverage.routeTitle)).toBe('North Texas Night + Food Loop');
    expect(read<Array<{ spotId: string }>>(coverage.activeRouteStops).map((stop) => stop.spotId)).toEqual([
      'spot-1',
      'spot-2',
    ]);

    wrapper.unmount();
  });

  it('keeps map-page browser fallbacks and sparse preview states inert', async () => {
    spotsStoreMock.items = [];
    tripsStoreMock.items = [];
    spotsStoreMock.selectedSpot = null;
    tripsStoreMock.loading = false;
    mapStoreMock.activeCategories = ['food'];
    mapStoreMock.visibleSpotIds = [];
    mapStoreMock.visibleSpotIdsMeasured = true;
    mapStoreMock.selectedSpotId = null;
    authStoreMock.currentUser = { homeBase: 'Fort Worth, TX' };
    resolveHomeBaseMapViewportMock.mockResolvedValueOnce(null);

    const wrapper = mountMapPage({ mobile: true });
    await flushPromises();

    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    const read = <T>(entry: T | { value: T }): T => (
      entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry as T
    );
    const write = <T>(entry: { value: T }, value: T) => {
      entry.value = value;
    };

    expect(read<string>(coverage.visibleEmptyTitle)).toBe('No pins match this category mix');
    expect(read<string>(coverage.routeTitle)).toBeTruthy();
    expect(read<string>(coverage.routeDriveMetric)).toEqual(expect.any(String));
    expect(read<string>(coverage.routeDistanceMetric)).toEqual(expect.any(String));
    expect(read<string>(coverage.routeTravelerMetric)).toMatch(/\d+ Travelers?/);

    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: undefined,
    });
    expect(coverage.resolveIsMobileMapLayout()).toBe(false);
    coverage.syncMobileMapLayout();
    coverage.cancelMobileSheetDrag();
    if (windowDescriptor) {
      Object.defineProperty(globalThis, 'window', windowDescriptor);
    }

    write(coverage.isMobileMapLayout, false);
    coverage.startMobileSheetDrag({
      currentTarget: document.createElement('button'),
      pointerId: 32,
      clientY: 200,
    } as PointerEvent);
    expect(read<boolean>(coverage.isDraggingMobileSheet)).toBe(false);

    coverage.handleMobileSheetDrag({ clientY: 240 } as PointerEvent);
    expect(read<number>(coverage.mobileSheetDragOffset)).toBe(0);
    coverage.finishMobileSheetDrag();
    expect(read<boolean>(coverage.ignoreNextMobileSheetClick)).toBe(false);

    write(coverage.roadRoute, {
      geometry: [],
      orderedPoints: [],
      distanceMeters: 0,
      durationSeconds: 0,
      provider: 'local-estimate',
      profile: 'local',
    });
    write(coverage.roadRouteLoading, true);
    expect(read<string>(coverage.routeDriveMetric)).toBe('ETA pending');
    expect(read<string>(coverage.routeDistanceMetric)).toBe('');

    write(coverage.localPreviewTrip, {
      id: 'one-stop-preview',
      title: '',
      description: 'Collaborative trip draft from Scope planner.',
      destination: '',
      members: [{ id: 'solo', displayName: '' }],
      spots: [
        {
          spotId: 'solo-stop',
          title: 'Solo stop',
          latitude: 32.7,
          longitude: -97.3,
          category: 'food',
          timeSlot: undefined,
        },
      ],
    });
    write(coverage.hasLoadedTripData, false);
    expect(read<string>(coverage.routeStopMetric)).toBe('1 trip stop');
    expect(read<string>(coverage.routeTravelerMetric)).toBe('1 Traveler');

    wrapper.unmount();
  });

  it('keeps selected map overlays and route fallback ordering stable when data is sparse', async () => {
    spotsStoreMock.items = Array.from({ length: 10 }, (_, index) => ({
      id: `sparse-map-${index}`,
      title: index === 0 ? 'Alpha Sparse' : `Sparse Map ${index}`,
      description: '',
      latitude: 32.7 + index / 100,
      longitude: -97.3 - index / 100,
      category: index % 2 === 0 ? 'food' : 'culture',
      city: index === 0 ? '' : 'Fort Worth',
      country: index === 0 ? '' : 'US',
      vibe: '',
      rating: index === 0 ? 4.1 : 4.9 - index / 100,
      photoUrl: '',
    }));
    tripsStoreMock.items = [{
      id: 'fallback-order-trip',
      title: '',
      description: 'Pick a trip from the planner.',
      destination: '',
      coverImageUrl: '',
      members: [],
      spots: [
        { spotId: 'sparse-map-3', title: 'Third Source', latitude: 32.73, longitude: -97.33, category: 'culture' },
        { spotId: 'sparse-map-1', title: 'First Source', latitude: 32.71, longitude: -97.31, category: 'culture' },
        { spotId: 'sparse-map-7', title: 'Seventh Source', latitude: 32.77, longitude: -97.37, category: 'culture' },
      ],
    }];
    mapStoreMock.activeCategories = ['food', 'culture'];
    mapStoreMock.visibleSpotIdsMeasured = true;
    mapStoreMock.visibleSpotIds = spotsStoreMock.items.map((spot) => spot.id);
    mapStoreMock.selectedSpotId = 'sparse-map-7';
    resolveRoadRouteMock.mockResolvedValueOnce({
      geometry: [],
      orderedPoints: [
        { id: 'missing-route-id', latitude: 1, longitude: 1 },
      ],
      distanceMeters: 0,
      durationSeconds: 0,
      provider: 'local-estimate',
      profile: 'local',
    });

    const wrapper = mountMapPage({
      mapViewStub: {
        props: ['spots', 'selectedSpotId'],
        template: '<button data-test="map-overlay-select" @click="$emit(\'spot-select\', spots[7])">{{ selectedSpotId }}</button>',
      },
    });
    await flushPromises();

    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    const read = <T>(entry: T | { value: T }): T => (
      entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry as T
    );
    const write = <T>(entry: { value: T }, value: T) => {
      entry.value = value;
    };

    expect(read<Array<{ spotId: string }>>(coverage.activeRouteStops).map((stop) => stop.spotId)).toEqual([
      'sparse-map-3',
      'sparse-map-1',
      'sparse-map-7',
    ]);
    expect(read<Array<{ id: string }>>(coverage.visibleSpotPreviews)).toHaveLength(8);
    expect(read<{ id: string } | null>(coverage.selectedSpot)?.id).toBe('sparse-map-0');
    expect(read<string>(coverage.routeTitle)).toBe('Route preview ready');
    expect(read<string>(coverage.routeDescription)).toContain('live 3-stop route preview');
    expect(read<string>(coverage.routeDestinationDisplay)).toBe('');
    expect(read<string>(coverage.routeTravelerMetric)).toBe('0 Travelers');
    expect(read<string>(coverage.routeHeroPhoto)).toBe('');
    expect(read<string>(coverage.selectedSpotLocation)).toBe('Location syncing');

    await wrapper.get('[data-test="map-overlay-select"]').trigger('click');
    await flushPromises();
    expect(read<string>(coverage.selectedMapOverlayLocation)).toContain('Fort Worth');
    expect(read<string>(coverage.selectedMapOverlayPhoto)).toBeTruthy();

    write(coverage.roadRoute, null);
    write(coverage.roadRouteLoading, true);
    expect(read<string>(coverage.routeDriveMetric)).toBe('Routing roads');
    write(coverage.roadRouteLoading, false);
    expect(read<string>(coverage.routeDriveMetric)).toBe('');

    wrapper.unmount();
  });

  it('keeps map selection fallbacks stable for empty categories and anchored preview lists', async () => {
    spotsStoreMock.items = Array.from({ length: 11 }, (_, index) => ({
      id: `branch-map-${index}`,
      title: index === 4 ? 'Selected Branch Spot' : `Branch Map ${index}`,
      description: '',
      latitude: 32.7 + index / 100,
      longitude: -97.3 - index / 100,
      category: index % 2 === 0 ? 'food' : 'culture',
      city: index === 4 ? 'Dallas' : '',
      country: index === 4 ? 'US' : '',
      vibe: '',
      rating: 4.5,
      photoUrl: '',
    }));
    tripsStoreMock.items = [];
    tripsStoreMock.loading = false;
    mapStoreMock.activeCategories = ['food', 'culture'];
    mapStoreMock.visibleSpotIdsMeasured = true;
    mapStoreMock.visibleSpotIds = spotsStoreMock.items.map((spot) => spot.id);
    mapStoreMock.selectedSpotId = 'branch-map-4';

    const wrapper = mountMapPage();
    await flushPromises();

    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    const read = <T>(entry: T | { value: T }): T => (
      entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry as T
    );
    const write = <T>(entry: { value: T }, value: T) => {
      entry.value = value;
    };

    expect(read<Array<{ id: string }>>(coverage.visibleSpotPreviews)).toHaveLength(8);
    expect(read<string>(coverage.selectedMapOverlayLocation)).toBe('Scope');
    coverage.handleSpotSelect(read<Array<{ id: string }>>(coverage.mapSpots)[0]);
    expect(mapStoreMock.setSelectedSpotId).toHaveBeenLastCalledWith('branch-map-0');

    mapStoreMock.activeCategories = [];
    mapStoreMock.selectedSpotId = null;
    const emptySidebarWrapper = mountMapPage();
    await flushPromises();
    const emptyCoverage = (emptySidebarWrapper.vm as any).__coverage as Record<string, any>;
    const emptyRead = <T>(entry: T | { value: T }): T => (
      entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry as T
    );
    const emptyWrite = <T>(entry: { value: T }, value: T) => {
      entry.value = value;
    };

    emptyWrite(emptyCoverage.mapSidebarRef, null);
    emptyWrite(emptyCoverage.isMobileMapLayout, false);
    emptyCoverage.syncMapSidebarScrollState();
    expect(emptyRead<boolean>(emptyCoverage.isMapSidebarScrolled)).toBe(false);
    expect(emptyRead<null>(emptyCoverage.selectedSpot)).toBeNull();
    expect(emptyRead<string>(emptyCoverage.selectedSpotLocation)).toBe('Scope');
    expect(emptyRead<string>(emptyCoverage.selectedSpotPhoto)).toBeTruthy();

    expect(emptyCoverage.handleFeaturedRouteCardClick()).toBeUndefined();

    wrapper.unmount();
    emptySidebarWrapper.unmount();
  });
});
