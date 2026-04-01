import { flushPromises, mount } from '@vue/test-utils';

const ORIGINAL_INNER_WIDTH = window.innerWidth;

const { mapInteractionTrackMock, mapStoreMock, onboardingStoreMock, spotsStoreMock, tripsStoreMock } = vi.hoisted(() => ({
  mapInteractionTrackMock: vi.fn(),
  mapStoreMock: {
    activeCategories: ['food', 'nature'],
    visibleSpotIds: ['spot-1', 'spot-2'],
    selectedSpotId: 'spot-1',
    toggleCategory: vi.fn(),
    resetCategories: vi.fn(),
    setSelectedSpotId: vi.fn(),
    setCenter: vi.fn(),
    setZoom: vi.fn(),
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
        ],
      },
    ],
    error: '',
    loading: false,
    fetchTrips: vi.fn().mockResolvedValue(undefined),
  },
}));

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
        MapView: options?.mapViewStub ?? {
          props: ['spots', 'routePoints', 'selectedSpotId'],
          template: '<div data-test="map-view-stub">{{ spots.length }} spots / {{ routePoints.length }} route points / {{ selectedSpotId }}</div>',
        },
      },
    },
  });
}

describe('MapPage', () => {
  beforeEach(() => {
    spotsStoreMock.error = '';
    spotsStoreMock.loading = false;
    tripsStoreMock.error = '';
    tripsStoreMock.loading = false;
    mapStoreMock.activeCategories = ['food', 'nature'];
    mapStoreMock.visibleSpotIds = ['spot-1', 'spot-2'];
    mapStoreMock.selectedSpotId = 'spot-1';
    onboardingStoreMock.isActive = false;
    onboardingStoreMock.activeStep = null;
    mapInteractionTrackMock.mockReset();
    mapStoreMock.toggleCategory.mockReset();
    mapStoreMock.resetCategories.mockReset();
    mapStoreMock.setSelectedSpotId.mockReset().mockImplementation((spotId: string) => {
      mapStoreMock.selectedSpotId = spotId;
    });
    mapStoreMock.setCenter.mockReset();
    mapStoreMock.setZoom.mockReset();
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
    expect(tripsStoreMock.fetchTrips).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Curate the map by mood');
    expect(wrapper.text()).toContain('North Texas Night + Food Loop');
    expect(wrapper.text()).toContain('Featured spot');
    expect(wrapper.text()).toContain('Sunset Rooftop Tacos');
    expect(wrapper.find('[data-test="map-view-stub"]').text()).toContain('2 spots / 1 route points / spot-1');

    const activeChip = wrapper.get('button.filter-chip.badge-food');
    const inactiveChip = wrapper.get('button.filter-chip.badge-nightlife');

    expect(activeChip.classes()).not.toContain('is-inactive');
    expect(inactiveChip.classes()).toContain('is-inactive');

    await activeChip.trigger('click');
    await wrapper.get('button.visible-item').trigger('click');
    await wrapper.get('button.text-link').trigger('click');

    expect(mapStoreMock.toggleCategory).toHaveBeenCalledWith('food');
    expect(mapStoreMock.setSelectedSpotId).toHaveBeenCalledWith('spot-1');
    expect(mapStoreMock.setCenter).toHaveBeenCalledWith([-97.3308, 32.7555]);
    expect(mapStoreMock.setZoom).toHaveBeenCalledWith(12);
    expect(mapStoreMock.resetCategories).toHaveBeenCalledTimes(1);
    expect(mapInteractionTrackMock).toHaveBeenNthCalledWith(1, 'category_toggle');
    expect(mapInteractionTrackMock).toHaveBeenNthCalledWith(2, 'visible_spot_focus');
    expect(mapInteractionTrackMock).toHaveBeenNthCalledWith(3, 'category_reset');
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

    expect(mapInteractionTrackMock).toHaveBeenLastCalledWith('fit_route');

    await wrapper.get('[data-test="map-mobile-sheet-toggle"]').trigger('click');

    expect(getSheetState()).toBe('full');
  });

  it('opens the mobile sheet fully during the map onboarding step so filters stay visible', async () => {
    onboardingStoreMock.isActive = true;
    onboardingStoreMock.activeStep = { routeName: 'map' };

    const wrapper = mountMapPage({ mobile: true });

    await flushPromises();

    expect(wrapper.get('[data-test="map-mobile-sheet"]').attributes('data-sheet-state')).toBe('full');
    expect(wrapper.get('[data-onboarding-target="map-filters"]').exists()).toBe(true);
  });

  it('shows a workspace error panel when route data fails to load', async () => {
    tripsStoreMock.error = 'Atlas could not load trips right now.';
    tripsStoreMock.fetchTrips.mockRejectedValue(new Error('Trips failed'));

    const wrapper = mountMapPage();

    await flushPromises();

    expect(wrapper.text()).toContain('Part of the map workspace could not be loaded');
    expect(wrapper.text()).toContain('Atlas could not load trips right now.');
  });
});
