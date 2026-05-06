import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

async function bootstrapTripsStore() {
  setActivePinia(createPinia());
  const { useTripsStore } = await import('@/stores/trips');
  return useTripsStore();
}

describe('trips store API contracts', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.doUnmock('@/services/analyticsService');
    vi.doUnmock('@/services/tripService');
    vi.doUnmock('@/services/intelService');
  });

  it('captures list pagination and trip members from the contract layer', async () => {
    vi.doMock('@/services/tripService', () => ({
      listTrips: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'trip-1',
            title: 'North Texas Weekend',
            destination: 'Fort Worth, TX',
            description: 'Food and skyline route.',
            isPublic: true,
            startDate: '2026-04-01',
            endDate: '2026-04-03',
            spots: [],
            members: [{ id: 'user-1', displayName: 'Louis Do', status: 'owner' }],
          },
        ],
        meta: {
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1,
        },
      }),
      getTripDetail: vi.fn(),
      getTripMembers: vi.fn().mockResolvedValue({
        data: [
          { id: 'user-1', displayName: 'Louis Do', status: 'owner' },
          { id: 'user-2', displayName: 'Maya Chen', status: 'member' },
        ],
      }),
      createTrip: vi.fn(),
      updateTrip: vi.fn(),
      deleteTrip: vi.fn(),
      addTripSpot: vi.fn(),
      removeTripSpot: vi.fn(),
      reorderTripSpots: vi.fn(),
      inviteTripMember: vi.fn(),
    }));

    vi.doMock('@/services/intelService', () => ({
      generateItinerary: vi.fn(),
    }));

    const store = await bootstrapTripsStore();

    await store.fetchTrips();
    expect(store.items).toHaveLength(1);
    expect(store.meta).toEqual({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });

    await store.fetchMembers('trip-1');
    expect(store.members).toHaveLength(2);
    expect(store.loading).toBe(false);
  });

  it('supports create, add-spot, and delete flows through trip contract actions', async () => {
    const createdTrip = {
      id: 'trip-9',
      title: 'Austin Sprint',
      destination: 'Austin, TX',
      description: 'Fast culture loop.',
      isPublic: true,
      startDate: '2026-05-01',
      endDate: '2026-05-02',
      spots: [],
      members: [{ id: 'user-2', displayName: 'Maya Chen', status: 'owner' }],
    };

    vi.doMock('@/services/tripService', () => ({
      listTrips: vi.fn(),
      getTripDetail: vi.fn(),
      getTripMembers: vi.fn(),
      createTrip: vi.fn().mockResolvedValue({ data: createdTrip }),
      updateTrip: vi.fn(),
      deleteTrip: vi.fn().mockResolvedValue(undefined),
      addTripSpot: vi.fn().mockResolvedValue({
        data: {
          ...createdTrip,
          spots: [
            {
              spotId: 'spot-1',
              title: 'Sunset Rooftop Tacos',
              latitude: 32.7555,
              longitude: -97.3308,
              category: 'food',
            },
          ],
        },
      }),
      removeTripSpot: vi.fn(),
      reorderTripSpots: vi.fn(),
      inviteTripMember: vi.fn(),
    }));

    vi.doMock('@/services/intelService', () => ({
      generateItinerary: vi.fn(),
    }));

    const store = await bootstrapTripsStore();

    await store.createTrip({
      title: 'Austin Sprint',
      destination: 'Austin, TX',
      description: 'Fast culture loop.',
      isPublic: true,
      startDate: '2026-05-01',
      endDate: '2026-05-02',
    });
    expect(store.selectedTrip?.id).toBe('trip-9');

    await store.addSpot('trip-9', {
      spotId: 'spot-1',
      title: 'Sunset Rooftop Tacos',
      latitude: 32.7555,
      longitude: -97.3308,
      category: 'food',
    });
    expect(store.selectedTrip?.spots).toHaveLength(1);

    await store.deleteTrip('trip-9');
    expect(store.items).toEqual([]);
    expect(store.selectedTrip).toBeNull();
    expect(store.saving).toBe(false);
  });

  it('tracks trip creation plus user-triggered itinerary generation through analytics helpers', async () => {
    const trackTripCreate = vi.fn();
    const trackItineraryGenerate = vi.fn();

    vi.doMock('@/services/analyticsService', () => ({
      trackTripCreate,
      trackItineraryGenerate,
    }));

    vi.doMock('@/services/tripService', () => ({
      listTrips: vi.fn(),
      getTripDetail: vi.fn(),
      getTripMembers: vi.fn(),
      createTrip: vi.fn().mockResolvedValue({
        data: {
          id: 'trip-4',
          title: 'Austin Sprint',
          destination: 'Austin, TX',
          description: 'Fast culture loop.',
          isPublic: true,
          startDate: '2026-05-01',
          endDate: '2026-05-02',
          budget: 640,
          spots: [
            {
              spotId: 'spot-1',
              title: 'Sunset Rooftop Tacos',
              latitude: 32.7555,
              longitude: -97.3308,
              category: 'food',
            },
          ],
          members: [
            { id: 'user-1', displayName: 'Louis Do', status: 'owner' },
            { id: 'user-2', displayName: 'Maya Chen', status: 'member' },
          ],
        },
      }),
      updateTrip: vi.fn(),
      deleteTrip: vi.fn(),
      addTripSpot: vi.fn(),
      removeTripSpot: vi.fn(),
      reorderTripSpots: vi.fn(),
      inviteTripMember: vi.fn(),
    }));

    vi.doMock('@/services/intelService', () => ({
      generateItinerary: vi.fn().mockResolvedValue({
        data: {
          id: 'itinerary-2',
          destination: 'Austin, TX',
          totalEstimatedCost: 420,
          weatherForecast: 'Sunny',
          days: [
            {
              dayNumber: 1,
              date: '2026-05-01',
              spots: [
                {
                  spotId: 'spot-1',
                  title: 'Sunset Rooftop Tacos',
                  latitude: 32.7555,
                  longitude: -97.3308,
                  category: 'food',
                },
                {
                  spotId: 'spot-2',
                  title: 'South Congress',
                  latitude: 30.25,
                  longitude: -97.75,
                  category: 'culture',
                },
              ],
            },
          ],
        },
      }),
    }));

    const store = await bootstrapTripsStore();

    await store.createTrip({
      title: 'Austin Sprint',
      destination: 'Austin, TX',
      description: 'Fast culture loop.',
      isPublic: true,
      startDate: '2026-05-01',
      endDate: '2026-05-02',
      budget: 640,
      spots: [
        {
          spotId: 'spot-1',
          title: 'Sunset Rooftop Tacos',
          latitude: 32.7555,
          longitude: -97.3308,
          category: 'food',
        },
      ],
      members: [
        { id: 'user-1', displayName: 'Louis Do', status: 'owner' },
        { id: 'user-2', displayName: 'Maya Chen', status: 'member' },
      ],
    });
    await flushPromises();

    expect(trackTripCreate).toHaveBeenCalledWith(expect.objectContaining({
      tripId: 'trip-4',
      destination: 'Austin, TX',
      stopCount: 1,
      memberCount: 2,
      isPublic: true,
      budget: 640,
      routeName: 'trip-planner',
    }));

    await store.buildItinerary({
      destination: 'Austin, TX',
      startDate: '2026-05-01',
      endDate: '2026-05-02',
      budget: 640,
      interests: ['food', 'culture'],
      pace: 'packed',
      groupSize: 2,
    }, { source: 'auto' });
    await flushPromises();

    expect(trackItineraryGenerate).not.toHaveBeenCalled();

    await store.buildItinerary({
      destination: 'Austin, TX',
      startDate: '2026-05-01',
      endDate: '2026-05-02',
      budget: 640,
      interests: ['food', 'culture'],
      pace: 'packed',
      groupSize: 2,
    });
    await flushPromises();

    expect(trackItineraryGenerate).toHaveBeenCalledWith(expect.objectContaining({
      itineraryId: 'itinerary-2',
      destination: 'Austin, TX',
      dayCount: 1,
      stopCount: 2,
      totalEstimatedCost: 420,
      budget: 640,
      groupSize: 2,
      interestCount: 2,
      pace: 'packed',
      routeName: 'trip-planner',
      source: 'user',
    }));
  });
});
