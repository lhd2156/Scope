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

  it('surfaces a trip detail failure instead of opening stale listed data', async () => {
    const listedTrip = {
      id: 'enw',
      title: 'Evening North West route',
      destination: 'Dallas, TX',
      description: 'Cached workspace draft.',
      isPublic: false,
      startDate: '2026-05-07',
      endDate: '2026-05-07',
      spots: [],
      members: [{ id: 'user-1', displayName: 'Louis Do', status: 'owner' }],
    };

    vi.doMock('@/services/tripService', () => ({
      listTrips: vi.fn().mockResolvedValue({
        data: [listedTrip],
        meta: {
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1,
        },
      }),
      getTripDetail: vi.fn().mockRejectedValue(new Error('Trip enw not found')),
      getTripMembers: vi.fn(),
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
    await expect(store.fetchTrip('enw')).rejects.toThrow('Trip enw not found');

    expect(store.selectedTrip).toBeNull();
    expect(store.error).toBe('Trip enw not found');
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

  it('keeps shared trips, member refreshes, and planner mutations synchronized', async () => {
    const sharedTrip = {
      id: 'trip-shared',
      title: 'Shared Desert Route',
      destination: 'Sedona, AZ',
      description: 'Red rocks and night-sky stops.',
      isPublic: false,
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      spots: [
        {
          spotId: 'spot-a',
          title: 'Cathedral Rock',
          latitude: 34.8252,
          longitude: -111.7885,
          category: 'scenic',
        },
        {
          spotId: 'spot-b',
          title: 'Tlaquepaque Arts Village',
          latitude: 34.8644,
          longitude: -111.7632,
          category: 'culture',
        },
      ],
      members: [{ id: 'user-1', displayName: 'Louis Do', status: 'owner' }],
    };

    const updatedTrip = {
      ...sharedTrip,
      title: 'Shared Desert Route Updated',
      budget: 720,
    };
    const oneStopTrip = {
      ...updatedTrip,
      spots: [sharedTrip.spots[1]],
    };
    const reorderedTrip = {
      ...updatedTrip,
      spots: [...sharedTrip.spots].reverse(),
    };
    const invitedTrip = {
      ...updatedTrip,
      members: [
        ...sharedTrip.members,
        { id: 'user-2', displayName: 'Maya Chen', status: 'editor' },
      ],
    };
    const roleUpdatedTrip = {
      ...invitedTrip,
      members: invitedTrip.members.map((member) =>
        member.id === 'user-2' ? { ...member, status: 'viewer' } : member,
      ),
    };
    const refreshedMembers = [
      { id: 'user-1', displayName: 'Louis Do', status: 'owner' },
      { id: 'user-2', displayName: 'Maya Chen', status: 'viewer' },
    ];

    const getTripMembers = vi.fn().mockResolvedValue({ data: refreshedMembers });
    const updateTrip = vi.fn().mockResolvedValue({ data: updatedTrip });
    const removeTripSpot = vi.fn().mockResolvedValue({ data: oneStopTrip });
    const reorderTripSpots = vi.fn().mockResolvedValue({ data: reorderedTrip });
    const inviteTripMember = vi.fn().mockResolvedValue({ data: invitedTrip });
    const updateTripMemberRole = vi.fn().mockResolvedValue({ data: roleUpdatedTrip });
    const createTripShareLink = vi.fn().mockResolvedValue({
      token: 'share-token',
      path: '/trips/shared/share-token',
      url: 'https://scope.local/trips/shared/share-token',
    });

    vi.doMock('@/services/tripService', () => ({
      listTrips: vi.fn(),
      getTripDetail: vi.fn(),
      getTripByShareToken: vi.fn().mockResolvedValue({ data: sharedTrip }),
      getTripMembers,
      createTrip: vi.fn(),
      updateTrip,
      deleteTrip: vi.fn(),
      addTripSpot: vi.fn(),
      removeTripSpot,
      reorderTripSpots,
      inviteTripMember,
      updateTripMemberRole,
      createTripShareLink,
    }));

    vi.doMock('@/services/intelService', () => ({
      generateItinerary: vi.fn(),
    }));

    const store = await bootstrapTripsStore();

    await store.fetchSharedTrip('share-token');
    expect(store.selectedTrip?.id).toBe('trip-shared');
    expect(store.activeTrip?.title).toBe('Shared Desert Route');
    expect(store.items).toHaveLength(1);

    await store.fetchMembers();
    expect(getTripMembers).toHaveBeenCalledWith('trip-shared');
    expect(store.members).toEqual(refreshedMembers);

    await store.updateTrip('trip-shared', {
      title: 'Shared Desert Route Updated',
      destination: 'Sedona, AZ',
      description: 'Red rocks and night-sky stops.',
      isPublic: false,
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      budget: 720,
    });
    expect(store.selectedTrip?.title).toBe('Shared Desert Route Updated');
    expect(store.items).toHaveLength(1);

    await store.removeSpot('trip-shared', 'spot-a');
    expect(removeTripSpot).toHaveBeenCalledWith('trip-shared', 'spot-a');
    expect(store.selectedTrip?.spots).toEqual(oneStopTrip.spots);

    await store.reorderSpots('trip-shared', {
      spotIds: ['spot-b', 'spot-a'],
    });
    expect(reorderTripSpots).toHaveBeenCalledWith('trip-shared', { spotIds: ['spot-b', 'spot-a'] });
    expect(store.selectedTrip?.spots[0]?.spotId).toBe('spot-b');

    await store.inviteMember('trip-shared', {
      userId: 'user-2',
      role: 'editor',
    });
    expect(inviteTripMember).toHaveBeenCalledWith('trip-shared', { userId: 'user-2', role: 'editor' });
    expect(store.members).toHaveLength(2);

    await store.updateMemberRole('trip-shared', 'user-2', 'viewer');
    expect(updateTripMemberRole).toHaveBeenCalledWith('trip-shared', 'user-2', 'viewer');
    expect(store.members.find((member) => member.id === 'user-2')?.status).toBe('viewer');

    await expect(store.createShareLink('trip-shared')).resolves.toEqual({
      token: 'share-token',
      path: '/trips/shared/share-token',
      url: 'https://scope.local/trips/shared/share-token',
    });
    expect(store.saving).toBe(false);
    expect(store.error).toBeNull();
  });

  it('resets loading flags and records helpful errors across trip planner failures', async () => {
    const rejectWith = (message: string) => vi.fn().mockRejectedValue(new Error(message));
    const generateItinerary = rejectWith('No itinerary for that range');

    vi.doMock('@/services/tripService', () => ({
      listTrips: rejectWith('Trips are offline'),
      getTripDetail: rejectWith('Trip detail is offline'),
      getTripByShareToken: rejectWith('Shared token expired'),
      getTripMembers: rejectWith('Members are offline'),
      createTrip: rejectWith('Create failed'),
      updateTrip: rejectWith('Update failed'),
      deleteTrip: rejectWith('Delete failed'),
      addTripSpot: rejectWith('Add stop failed'),
      removeTripSpot: rejectWith('Remove stop failed'),
      reorderTripSpots: rejectWith('Reorder failed'),
      inviteTripMember: rejectWith('Invite failed'),
      updateTripMemberRole: rejectWith('Role update failed'),
      createTripShareLink: rejectWith('Share link failed'),
    }));

    vi.doMock('@/services/intelService', () => ({
      generateItinerary,
    }));

    const store = await bootstrapTripsStore();

    await expect(store.fetchTrips()).rejects.toThrow('Trips are offline');
    expect(store.error).toBe('Trips are offline');
    expect(store.loading).toBe(false);

    await expect(store.fetchTrip('trip-404')).rejects.toThrow('Trip detail is offline');
    expect(store.selectedTrip).toBeNull();
    expect(store.loading).toBe(false);

    await expect(store.fetchSharedTrip('expired')).rejects.toThrow('Shared token expired');
    expect(store.selectedTrip).toBeNull();
    expect(store.loading).toBe(false);

    await expect(store.fetchMembers()).resolves.toEqual([]);
    expect(store.members).toEqual([]);

    await expect(store.fetchMembers('trip-1')).rejects.toThrow('Members are offline');
    expect(store.error).toBe('Members are offline');
    expect(store.loading).toBe(false);

    await expect(store.createTrip({
      title: 'Broken',
      destination: 'Austin, TX',
      description: '',
      isPublic: false,
      startDate: '2026-05-01',
      endDate: '2026-05-02',
    })).rejects.toThrow('Create failed');
    expect(store.saving).toBe(false);

    await expect(store.updateTrip('trip-1', {
      title: 'Broken',
      destination: 'Austin, TX',
      description: '',
      isPublic: false,
      startDate: '2026-05-01',
      endDate: '2026-05-02',
    })).rejects.toThrow('Update failed');

    await expect(store.deleteTrip('trip-1')).rejects.toThrow('Delete failed');
    await expect(store.addSpot('trip-1', {
      spotId: 'spot-1',
      title: 'Broken stop',
      latitude: 30,
      longitude: -97,
      category: 'food',
    })).rejects.toThrow('Add stop failed');
    await expect(store.removeSpot('trip-1', 'spot-1')).rejects.toThrow('Remove stop failed');
    await expect(store.reorderSpots('trip-1', { spotIds: ['spot-1'] })).rejects.toThrow('Reorder failed');
    await expect(store.inviteMember('trip-1', { userId: 'user-2', role: 'viewer' })).rejects.toThrow('Invite failed');
    await expect(store.updateMemberRole('trip-1', 'user-2', 'editor')).rejects.toThrow('Role update failed');
    await expect(store.createShareLink('trip-1')).rejects.toThrow('Share link failed');
    expect(store.saving).toBe(false);

    await expect(store.buildItinerary({
      destination: 'Austin, TX',
      startDate: '2026-05-01',
      endDate: '2026-05-02',
      budget: 500,
      interests: ['food'],
      pace: 'moderate',
      groupSize: 2,
    })).rejects.toThrow('No itinerary for that range');
    expect(generateItinerary).toHaveBeenCalled();
    expect(store.error).toBe('No itinerary for that range');
    expect(store.planning).toBe(false);
  });
});
