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
});
