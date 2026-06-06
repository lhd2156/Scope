const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
const searchUsersMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/api', () => ({
  default: apiMock,
  isApiClientError: (error: unknown) => error instanceof Error && error.name === 'ApiClientError',
}));

vi.mock('@/services/userService', () => ({
  searchUsers: searchUsersMock,
}));

function apiUnavailableError(): Error {
  return Object.assign(new Error('trip API unavailable'), {
    name: 'ApiClientError',
    status: 500,
    isNetworkError: false,
  });
}

describe('tripService behavior fallbacks', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_DEMO_MODE', 'false');
    vi.stubEnv('VITE_ENABLE_TRIP_MOCK_FALLBACK', 'false');
    vi.stubEnv('VITE_ENABLE_TRIP_LOCAL_WRITE_FALLBACK', 'false');
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.put.mockReset();
    apiMock.delete.mockReset();
    searchUsersMock.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('creates local trip drafts with a usable owner, itinerary, and cover when write fallback is explicit', async () => {
    vi.stubEnv('VITE_ENABLE_TRIP_LOCAL_WRITE_FALLBACK', 'true');
    apiMock.post.mockRejectedValue(apiUnavailableError());

    const tripService = await import('@/services/tripService');
    const response = await tripService.createTrip({
      title: '  Planner Draft  ',
      destination: ' Dallas, TX to Austin, TX ',
      description: '  Route from the trip planner.  ',
      isPublic: false,
      startDate: '2026-06-01',
      endDate: '2026-06-02',
      spots: [
        {
          spotId: 'cover-stop',
          title: '  Scenic Coffee Stop  ',
          latitude: 31.5493,
          longitude: -97.1467,
          category: 'food',
          city: 'Waco',
          estimatedCost: 18,
          photoUrl: 'https://images.example.com/coffee.jpg',
        },
      ],
    });

    expect(apiMock.post).toHaveBeenCalledWith('/api/content/trips/', expect.objectContaining({
      title: 'Planner Draft',
      destination: 'Dallas, TX to Austin, TX',
      is_public: false,
      start_date: '2026-06-01',
      end_date: '2026-06-02',
    }));
    expect(response.data).toMatchObject({
      title: 'Planner Draft',
      destination: 'Dallas, TX to Austin, TX',
      currency: 'USD',
      status: 'planning',
      coverImageUrl: 'https://images.example.com/coffee.jpg',
    });
    expect(response.data.members[0]).toEqual(expect.objectContaining({
      id: expect.any(String),
      displayName: expect.any(String),
      status: 'owner',
    }));
    expect(response.data.itinerary?.days[0]?.spots[0]).toMatchObject({
      spotId: 'cover-stop',
      title: 'Scenic Coffee Stop',
      timeSlot: '09:00',
    });
    expect(response.data.itinerary?.totalEstimatedCost).toBe(18);
    expect(JSON.parse(localStorage.getItem('scope.trips.v1') ?? '[]')[0]).toMatchObject({
      id: response.data.id,
      title: 'Planner Draft',
    });
  });

  it('preserves existing local draft members and stops when an update omits them', async () => {
    vi.stubEnv('VITE_ENABLE_TRIP_LOCAL_WRITE_FALLBACK', 'true');
    apiMock.post.mockRejectedValue(apiUnavailableError());
    apiMock.put.mockRejectedValue(apiUnavailableError());

    const tripService = await import('@/services/tripService');
    const created = await tripService.createTrip({
      title: 'First Pass',
      destination: 'Fort Worth, TX',
      isPublic: false,
      startDate: '2026-06-03',
      endDate: '2026-06-04',
      currency: 'usd',
      spots: [
        {
          spotId: 'draft-stop',
          title: 'Museum Stop',
          latitude: 32.748,
          longitude: -97.369,
          category: 'culture',
          city: 'Fort Worth',
        },
      ],
      members: [{ id: 'owner-1', displayName: 'Owner User', status: 'owner' }],
    });

    const updated = await tripService.updateTrip(created.data.id, {
      title: 'Second Pass',
      destination: 'Austin, TX',
      description: 'Updated route shell.',
      isPublic: true,
      startDate: '2026-06-05',
      endDate: '2026-06-07',
      budget: 1200,
    });

    expect(apiMock.put).toHaveBeenCalledWith(
      `/api/content/trips/${created.data.id}`,
      expect.objectContaining({
        title: 'Second Pass',
        is_public: true,
        budget: 1200,
      }),
    );
    expect(updated.data).toMatchObject({
      id: created.data.id,
      title: 'Second Pass',
      destination: 'Austin, TX',
      budget: 1200,
      currency: 'USD',
    });
    expect(updated.data.members).toEqual(created.data.members);
    expect(updated.data.spots).toEqual(created.data.spots);
  });

  it('does not duplicate an existing demo trip member when the same display name is invited again', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true');

    const tripService = await import('@/services/tripService');
    const { mockTrips } = await import('@/services/mockData');
    const trip = mockTrips.find((candidate) => candidate.members.length > 0) ?? mockTrips[0];
    const existingMember = trip.members[0];
    const originalMemberCount = trip.members.length;

    const response = await tripService.inviteTripMember(trip.id, {
      recipient: existingMember.displayName.toUpperCase(),
      role: 'viewer',
    });

    expect(response.data.members).toHaveLength(originalMemberCount);
    expect(response.data.members.find((member) => member.id === existingMember.id)).toMatchObject({
      displayName: existingMember.displayName,
      status: existingMember.status,
    });
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('keeps legacy demo share tokens openable from local share storage when encoded payloads are unavailable', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true');
    vi.stubGlobal('btoa', undefined);
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => 'share-random-id'),
    });

    const tripService = await import('@/services/tripService');
    const { mockTrips } = await import('@/services/mockData');
    const trip = mockTrips[0];

    const shareLink = await tripService.createTripShareLink(trip.id);
    const shared = await tripService.getTripByShareToken(shareLink.token);

    expect(shareLink.token).toContain('share-random-id');
    expect(shared.data.id).toBe(trip.id);
    await expect(tripService.getTripByShareToken('missing-token')).rejects.toThrow('invalid or expired');
    expect(apiMock.get).not.toHaveBeenCalled();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('reuses encoded local share links and tolerates malformed local storage fallbacks', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true');
    localStorage.setItem('scope.trips.v1', '{bad trips');
    localStorage.setItem('scope.trip-shares.v1', '{bad shares');

    const tripService = await import('@/services/tripService');
    const { mockTrips } = await import('@/services/mockData');
    const trip = (mockTrips[1] ?? mockTrips[0])!;

    const firstLink = await tripService.createTripShareLink(trip.id);
    const secondLink = await tripService.createTripShareLink(trip.id);
    const shared = await tripService.getTripByShareToken(firstLink.token);

    expect(firstLink.token).toMatch(/^local-trip-/);
    expect(secondLink.token).toBe(firstLink.token);
    expect(firstLink.url).toContain(firstLink.path);
    expect(shared.data).toMatchObject({
      id: trip.id,
      title: trip.title,
    });

    localStorage.setItem('scope.trip-shares.v1', JSON.stringify({
      'legacy-token': trip.id,
      ignored: 42,
    }));
    const legacy = await tripService.getTripByShareToken('legacy-token');
    expect(legacy.data.id).toBe(trip.id);
  });

  it('supports the full demo trip edit lifecycle for stops, ordering, members, and deletion', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true');

    const tripService = await import('@/services/tripService');
    const created = await tripService.createTrip({
      title: 'Demo planner lifecycle',
      destination: 'Dallas, TX to Austin, TX',
      description: 'Exercise local demo trip editing.',
      isPublic: false,
      startDate: '2026-06-10',
      endDate: '2026-06-12',
      budget: 900,
      spots: [
        {
          spotId: 'stop-alpha',
          title: 'Alpha Coffee',
          latitude: 32.75,
          longitude: -97.33,
          category: 'food',
          city: 'Fort Worth',
          estimatedCost: 12,
        },
      ],
    });

    const withBravo = await tripService.addTripSpot(created.data.id, {
      spotId: 'stop-bravo',
      title: 'Bravo Museum',
      latitude: 31.55,
      longitude: -97.14,
      category: 'culture',
      city: 'Waco',
      estimatedCost: 24,
    });
    expect(withBravo.data.spots.map((spot) => spot.spotId)).toEqual(['stop-alpha', 'stop-bravo']);
    expect(withBravo.data.itinerary?.totalEstimatedCost).toBe(36);

    const reordered = await tripService.reorderTripSpots(created.data.id, {
      orderedSpotIds: ['stop-bravo'],
    });
    expect(reordered.data.spots.map((spot) => spot.spotId)).toEqual(['stop-bravo', 'stop-alpha']);

    const removed = await tripService.removeTripSpot(created.data.id, 'stop-alpha');
    expect(removed.data.spots.map((spot) => spot.spotId)).toEqual(['stop-bravo']);
    expect(removed.data.itinerary?.days[0]?.spots[0]).toMatchObject({
      spotId: 'stop-bravo',
      timeSlot: '09:00',
    });

    const invited = await tripService.inviteTripMember(created.data.id, {
      recipient: 'maya.chen@example.com',
      role: 'viewer',
    });
    const invitedMember = invited.data.members.find((member) => member.displayName === 'Maya Chen');
    expect(invitedMember).toMatchObject({
      status: 'viewer',
      inviteStatus: 'pending',
      presence: 'offline',
    });

    const roleUpdated = await tripService.updateTripMemberRole(created.data.id, invitedMember!.id, 'editor');
    expect(roleUpdated.data.members.find((member) => member.id === invitedMember!.id)).toMatchObject({
      displayName: 'Maya Chen',
      status: 'editor',
    });
    await expect(tripService.updateTripMemberRole(created.data.id, roleUpdated.data.members[0]!.id, 'viewer'))
      .rejects.toThrow('cannot be changed');

    const members = await tripService.getTripMembers(created.data.id);
    expect(members.data.map((member) => member.displayName)).toContain('Maya Chen');

    await tripService.deleteTrip(created.data.id);
    await expect(tripService.getTripDetail(created.data.id)).rejects.toThrow(`Trip ${created.data.id} not found`);
    expect(apiMock.post).not.toHaveBeenCalled();
    expect(apiMock.put).not.toHaveBeenCalled();
    expect(apiMock.delete).not.toHaveBeenCalled();
  });

  it('covers demo trip reads, public lists, share guards, and missing-trip edit guard rails', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true');

    const tripService = await import('@/services/tripService');
    const { mockTrips } = await import('@/services/mockData');
    const trip = mockTrips.find((candidate) => candidate.isPublic) ?? mockTrips[0]!;
    const input = {
      title: 'Missing route',
      destination: 'Nowhere',
      isPublic: false,
      startDate: '2026-06-01',
      endDate: '2026-06-02',
    };
    const spot = {
      spotId: 'missing-stop',
      title: 'Missing Stop',
      latitude: 32.75,
      longitude: -97.33,
      category: 'food' as const,
    };

    await expect(tripService.listTrips(1, 2)).resolves.toMatchObject({
      meta: {
        page: 1,
        pageSize: 2,
      },
    });
    await expect(tripService.listPublicTrips(1, 3)).resolves.toMatchObject({
      meta: {
        page: 1,
        pageSize: 3,
      },
    });
    await expect(tripService.getTripDetail(trip.id)).resolves.toMatchObject({
      data: {
        id: trip.id,
      },
    });

    await expect(tripService.createTripShareLink('missing-trip')).rejects.toThrow('Trip missing-trip not found');
    localStorage.setItem('scope.trip-shares.v1', JSON.stringify({
      'legacy-missing-token': 'missing-trip',
    }));
    await expect(tripService.getTripByShareToken('legacy-missing-token')).rejects.toThrow('could not be found');

    await expect(tripService.updateTrip('missing-trip', input)).rejects.toThrow('Trip missing-trip not found');
    await expect(tripService.addTripSpot('missing-trip', spot)).rejects.toThrow('Trip missing-trip not found');
    await expect(tripService.removeTripSpot('missing-trip', 'missing-stop')).rejects.toThrow('Trip missing-trip not found');
    await expect(tripService.reorderTripSpots('missing-trip', { orderedSpotIds: ['missing-stop'] })).rejects.toThrow('Trip missing-trip not found');
    await expect(tripService.getTripMembers('missing-trip')).rejects.toThrow('Trip missing-trip not found');
    await expect(tripService.inviteTripMember('missing-trip', {
      recipient: 'maya@example.com',
      role: 'viewer',
    })).rejects.toThrow('Trip missing-trip not found');
    await expect(tripService.updateTripMemberRole('missing-trip', 'user-2', 'viewer')).rejects.toThrow('Trip missing-trip not found');

    expect(apiMock.get).not.toHaveBeenCalled();
    expect(apiMock.post).not.toHaveBeenCalled();
    expect(apiMock.put).not.toHaveBeenCalled();
    expect(apiMock.delete).not.toHaveBeenCalled();
  });

  it('normalizes live trip API reads and writes used by the planner workflow', async () => {
    const liveTrip = {
      id: 'live-trip-1',
      title: 'Live Planner Route',
      destination: 'Dallas, TX to Austin, TX',
      description: 'Route saved from /trips/new',
      isPublic: false,
      startDate: '2026-06-15',
      endDate: '2026-06-16',
      budget: 640,
      currency: 'usd',
      status: 'planning',
      coverImageUrl: 'javascript:alert(1)',
      spots: [
        {
          spotId: 'waco-stop',
          title: 'Waco Lunch',
          latitude: 31.5493,
          longitude: -97.1467,
          category: 'food',
          city: 'Waco',
        },
      ],
      members: [
        { id: 'owner-1', displayName: 'Owner One', status: 'owner' },
        { id: 'viewer-1', displayName: 'Viewer One', status: 'viewer' },
      ],
    };
    const createdTrip = { ...liveTrip, id: 'created-trip-1', title: 'Created Route' };
    const updatedTrip = { ...liveTrip, title: 'Updated Route', budget: 900 };

    apiMock.get
      .mockResolvedValueOnce({
        data: {
          data: [liveTrip],
          page: 1,
          pageSize: 12,
          total: 1,
        },
      })
      .mockResolvedValueOnce({ data: liveTrip })
      .mockResolvedValueOnce({ data: { data: [liveTrip.members[1]] } })
      .mockResolvedValueOnce({ data: { trip: updatedTrip } })
      .mockResolvedValueOnce({ data: { data: liveTrip } })
      .mockResolvedValueOnce({ data: { trip: liveTrip } });
    apiMock.post
      .mockResolvedValueOnce({ data: { trip: createdTrip } })
      .mockResolvedValueOnce({ data: { data: { ...liveTrip, spots: [...liveTrip.spots, { spotId: 'museum-stop', title: 'Museum Stop', latitude: 32.75, longitude: -97.36, category: 'culture' }] } } })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ data: { token: 'live-token', path: '' } });
    apiMock.put
      .mockResolvedValueOnce({ data: { trip: updatedTrip } })
      .mockResolvedValueOnce({ data: { data: { ...liveTrip, spots: [...liveTrip.spots].reverse() } } });
    apiMock.delete
      .mockResolvedValueOnce({ data: { data: { ...liveTrip, spots: [] } } })
      .mockResolvedValueOnce(undefined);
    searchUsersMock.mockResolvedValue({
      data: [
        {
          id: 'user-remote-1',
          username: 'maya',
          displayName: 'Maya Chen',
          email: 'maya.chen@example.com',
        },
      ],
    });

    const tripService = await import('@/services/tripService');

    const listed = await tripService.listTrips();
    expect(listed.data).toEqual([
      expect.objectContaining({
        id: 'live-trip-1',
        currency: 'usd',
        coverImageUrl: expect.stringContaining('images.unsplash.com'),
      }),
    ]);

    const detail = await tripService.getTripDetail('live-trip-1');
    expect(detail.data).toMatchObject({
      id: 'live-trip-1',
      title: 'Live Planner Route',
      currency: 'usd',
    });

    const created = await tripService.createTrip({
      title: 'Created Route',
      destination: ' Dallas, TX to Austin, TX ',
      description: ' Created from the planner ',
      isPublic: false,
      startDate: '2026-06-15',
      endDate: '2026-06-16',
      budget: 640,
      currency: 'usd',
      status: 'planning',
      coverImageUrl: 'https://images.example.com/cover.jpg',
      members: [
        { id: 'owner-1', displayName: 'Owner One', status: 'owner' },
        { id: 'viewer-1', displayName: 'Viewer One', status: 'viewer' },
      ],
      spots: liveTrip.spots,
    });
    expect(apiMock.get).toHaveBeenCalledWith('/api/content/trips/', {
      params: { page: 1, pageSize: 12 },
    });
    expect(apiMock.post).toHaveBeenCalledWith('/api/content/trips/', expect.objectContaining({
      title: 'Created Route',
      destination: 'Dallas, TX to Austin, TX',
      currency: 'USD',
      cover_photo_url: 'https://images.example.com/cover.jpg',
      members: [{ user_id: 'viewer-1', role: 'viewer' }],
      spots: [expect.objectContaining({ spot_id: 'waco-stop', sort_order: 0 })],
    }));
    expect(created.data).toMatchObject({ id: 'created-trip-1', title: 'Created Route' });

    const updated = await tripService.updateTrip('live-trip-1', {
      title: 'Updated Route',
      destination: 'Dallas, TX to Austin, TX',
      isPublic: true,
      startDate: '2026-06-15',
      endDate: '2026-06-17',
      budget: 900,
    });
    expect(apiMock.put).toHaveBeenCalledWith('/api/content/trips/live-trip-1', expect.objectContaining({
      title: 'Updated Route',
      is_public: true,
      budget: 900,
    }));
    expect(updated.data.budget).toBe(900);

    await tripService.addTripSpot('live-trip-1', {
      spotId: 'museum-stop',
      title: 'Museum Stop',
      latitude: 32.75,
      longitude: -97.36,
      category: 'culture',
      notes: 'Add from route search',
    });
    await tripService.removeTripSpot('live-trip-1', 'waco-stop');
    await tripService.reorderTripSpots('live-trip-1', { orderedSpotIds: ['museum-stop', 'waco-stop'] });
    const members = await tripService.getTripMembers('live-trip-1');
    expect(members.data).toEqual([expect.objectContaining({ id: 'viewer-1', status: 'viewer' })]);

    await tripService.inviteTripMember('live-trip-1', {
      recipient: 'maya.chen@example.com',
      role: 'editor',
    });
    expect(searchUsersMock).toHaveBeenCalledWith('maya.chen@example.com', 1, 10);
    expect(apiMock.post).toHaveBeenCalledWith('/api/content/trips/live-trip-1/members', {
      user_id: 'user-remote-1',
      role: 'editor',
    });

    await tripService.updateTripMemberRole('live-trip-1', '550e8400-e29b-41d4-a716-446655440000', 'viewer');
    expect(apiMock.post).toHaveBeenCalledWith('/api/content/trips/live-trip-1/members', {
      user_id: '550e8400-e29b-41d4-a716-446655440000',
      role: 'viewer',
    });

    const shareLink = await tripService.createTripShareLink('live-trip-1');
    expect(shareLink).toMatchObject({
      token: 'live-token',
      path: '/trips/shared/live-token',
    });
    expect(shareLink.url).toContain('/trips/shared/live-token');

    const shared = await tripService.getTripByShareToken('live-token');
    expect(shared.data.id).toBe('live-trip-1');

    await tripService.deleteTrip('live-trip-1');
    expect(apiMock.delete).toHaveBeenLastCalledWith('/api/content/trips/live-trip-1');
  });

  it('uses configured mock and local fallbacks only when live trip data is unavailable', async () => {
    vi.stubEnv('VITE_ENABLE_TRIP_MOCK_FALLBACK', 'true');
    vi.stubEnv('VITE_ENABLE_TRIP_LOCAL_WRITE_FALLBACK', 'true');
    apiMock.get.mockResolvedValueOnce({ data: { data: [] } });
    apiMock.post.mockRejectedValue(apiUnavailableError());

    const tripService = await import('@/services/tripService');
    const local = await tripService.createTrip({
      title: 'Local before server',
      destination: 'Wichita Falls, TX',
      isPublic: false,
      startDate: '2026-07-01',
      endDate: '2026-07-02',
    });
    const listed = await tripService.listTrips(1, 6);

    expect(listed.data[0]).toMatchObject({
      id: local.data.id,
      title: 'Local before server',
    });
    expect(listed.data.length).toBeGreaterThan(1);

    apiMock.get.mockResolvedValueOnce({
      data: {
        data: [{ ...local.data, id: 'server-trip-1', title: 'Server Route' }],
      },
    });
    const liveListed = await tripService.listTrips(1, 6);
    expect(liveListed.data.map((trip) => trip.title)).toContain('Server Route');

    apiMock.get.mockRejectedValueOnce(apiUnavailableError());
    const fallbackListed = await tripService.listTrips(1, 6);
    expect(fallbackListed.data.map((trip) => trip.id)).toContain(local.data.id);
  });
});
