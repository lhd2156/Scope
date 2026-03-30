import { flushPromises, mount } from '@vue/test-utils';

const { mapStoreMock, spotsStoreMock, tripsStoreMock } = vi.hoisted(() => ({
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

vi.mock('@/stores/spots', () => ({
  useSpotsStore: () => spotsStoreMock,
}));

vi.mock('@/stores/trips', () => ({
  useTripsStore: () => tripsStoreMock,
}));

import MapPage from '@/views/MapPage.vue';

describe('MapPage', () => {
  beforeEach(() => {
    spotsStoreMock.error = '';
    spotsStoreMock.loading = false;
    tripsStoreMock.error = '';
    tripsStoreMock.loading = false;
    mapStoreMock.activeCategories = ['food', 'nature'];
    mapStoreMock.toggleCategory.mockClear();
    mapStoreMock.resetCategories.mockClear();
    mapStoreMock.setSelectedSpotId.mockClear();
    mapStoreMock.setCenter.mockClear();
    mapStoreMock.setZoom.mockClear();
    spotsStoreMock.fetchSpots.mockClear();
    tripsStoreMock.fetchTrips.mockClear();
  });

  it('loads the premium sidebar workspace with category chips, route preview, and selected spot details', async () => {
    const wrapper = mount(MapPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          MapView: {
            props: ['spots', 'routePoints', 'selectedSpotId'],
            template: '<div data-test="map-view-stub">{{ spots.length }} spots / {{ routePoints.length }} route points / {{ selectedSpotId }}</div>',
          },
        },
      },
    });

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

    await wrapper.get('button.visible-item').trigger('click');

    expect(mapStoreMock.setSelectedSpotId).toHaveBeenCalledWith('spot-1');
    expect(mapStoreMock.setCenter).toHaveBeenCalledWith([-97.3308, 32.7555]);
    expect(mapStoreMock.setZoom).toHaveBeenCalledWith(12);
  });

  it('shows a workspace error panel when route data fails to load', async () => {
    tripsStoreMock.error = 'Atlas could not load trips right now.';
    tripsStoreMock.fetchTrips.mockRejectedValue(new Error('Trips failed'));

    const wrapper = mount(MapPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          MapView: { template: '<div />' },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('Part of the map workspace could not be loaded');
    expect(wrapper.text()).toContain('Atlas could not load trips right now.');
  });
});
