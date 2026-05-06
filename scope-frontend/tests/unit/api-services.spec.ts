const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

const axiosPutMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/api', () => ({
  default: apiMock,
}));

vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios');

  return {
    ...actual,
    default: {
      ...actual.default,
      put: axiosPutMock,
    },
  };
});

describe('API service fallbacks', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.put.mockReset();
    apiMock.delete.mockReset();
    axiosPutMock.mockReset();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('does not silently authenticate when login fails and mock fallback is disabled', async () => {
    vi.stubEnv('VITE_ENABLE_AUTH_MOCK_FALLBACK', 'false');
    apiMock.post.mockRejectedValue(new Error('network down'));

    const authService = await import('@/services/authService');

    await expect(
      authService.login({
        email: 'maya@example.com',
        password: 'SecurePass123!',
      }),
    ).rejects.toThrow('network down');
  });

  it('falls back to demo auth only when explicitly enabled for local development', async () => {
    vi.stubEnv('VITE_ENABLE_AUTH_MOCK_FALLBACK', 'true');
    apiMock.post.mockRejectedValue(new Error('network down'));

    const authService = await import('@/services/authService');
    const payload = await authService.login({
      email: 'maya@example.com',
      password: 'SecurePass123!',
    });

    expect(payload.email).toBe('maya@example.com');
    expect(payload.displayName).toBe('Maya');
    expect(payload.accessToken).toMatch(/^demo-access-/);
  });

  it('keeps a display-name login recognizable in local auth fallback', async () => {
    vi.stubEnv('VITE_ENABLE_AUTH_MOCK_FALLBACK', 'true');
    apiMock.post.mockRejectedValue(new Error('network down'));

    const authService = await import('@/services/authService');
    const payload = await authService.login({
      email: 'Jordan Lee',
      password: 'SecurePass123!',
    });

    expect(payload).toMatchObject({
      username: 'jordan-lee',
      displayName: 'Jordan Lee',
    });
    expect(payload.accessToken).toMatch(/^demo-access-/);
  });

  it('falls back to a local auth session when registration is explicitly enabled for frontend testing', async () => {
    vi.stubEnv('VITE_ENABLE_AUTH_MOCK_FALLBACK', 'true');
    apiMock.post.mockRejectedValue(new Error('core api unavailable'));

    const authService = await import('@/services/authService');
    const payload = await authService.register({
      firstName: 'Maya',
      lastName: 'Chen',
      username: 'maya',
      email: 'maya@example.com',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
      dateOfBirth: '1996-04-15',
      acceptedTerms: true,
    });

    expect(payload).toMatchObject({
      username: 'maya',
      email: 'maya@example.com',
      displayName: 'Maya Chen',
    });
    expect(payload.accessToken).toMatch(/^demo-access-/);

    await expect(
      authService.login({
        email: 'maya',
        password: 'SecurePass123!',
      }),
    ).resolves.toMatchObject({
      username: 'maya',
      email: 'maya@example.com',
      displayName: 'Maya Chen',
    });

    await expect(authService.refreshSession({ allowMockFallback: true })).resolves.toMatchObject({
      username: 'maya',
      email: 'maya@example.com',
      displayName: 'Maya Chen',
    });
  });

  it('auto-logs the user in when registration succeeds without returning tokens', async () => {
    apiMock.post
      .mockResolvedValueOnce({
        data: {
          data: {
            id: 'user-9',
            username: 'maya',
            email: 'maya@example.com',
            displayName: 'Maya Chen',
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            id: 'user-9',
            username: 'maya',
            email: 'maya@example.com',
            displayName: 'Maya Chen',
            accessToken: 'registered-access-token',
            refreshToken: 'registered-refresh-token',
          },
        },
      });

    const authService = await import('@/services/authService');
    const payload = await authService.register({
      firstName: 'Maya',
      lastName: 'Chen',
      username: 'maya',
      email: 'maya@example.com',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
      dateOfBirth: '1996-04-15',
      acceptedTerms: true,
    });

    expect(apiMock.post).toHaveBeenNthCalledWith(1, '/api/core/auth/register', {
      username: 'maya',
      displayName: 'Maya Chen',
      email: 'maya@example.com',
      password: 'SecurePass123!',
      dateOfBirth: '1996-04-15',
    });
    expect(apiMock.post).toHaveBeenNthCalledWith(2, '/api/core/auth/login', {
      email: 'maya@example.com',
      password: 'SecurePass123!',
    });
    expect(payload).toMatchObject({
      username: 'maya',
      email: 'maya@example.com',
      accessToken: 'registered-access-token',
      refreshToken: 'registered-refresh-token',
    });
  });

  it('sends the stored refresh token when refreshing a live auth session', async () => {
    const { AUTH_REFRESH_TOKEN_STORAGE_KEY } = await import('@/utils/authSessionStorage');
    sessionStorage.setItem(AUTH_REFRESH_TOKEN_STORAGE_KEY, 'refresh-token-1');
    apiMock.post.mockResolvedValue({
      data: {
        data: {
          id: 'user-2',
          username: 'maya',
          email: 'maya@example.com',
          displayName: 'Maya Chen',
          accessToken: 'access-token-2',
          refreshToken: 'refresh-token-2',
        },
      },
    });

    const authService = await import('@/services/authService');
    const payload = await authService.refreshSession();

    expect(apiMock.post).toHaveBeenCalledWith('/api/core/auth/refresh', {
      refreshToken: 'refresh-token-1',
    });
    expect(payload.accessToken).toBe('access-token-2');
  });

  it('sends the stored refresh token when logging out of a live auth session', async () => {
    const { AUTH_REFRESH_TOKEN_STORAGE_KEY } = await import('@/utils/authSessionStorage');
    sessionStorage.setItem(AUTH_REFRESH_TOKEN_STORAGE_KEY, 'refresh-token-logout');
    apiMock.post.mockResolvedValue({ data: { data: { success: true } } });

    const authService = await import('@/services/authService');
    await authService.logout();

    expect(apiMock.post).toHaveBeenCalledWith('/api/core/auth/logout', {
      refreshToken: 'refresh-token-logout',
    });
  });

  it('does not silently swap to a mock profile when account lookup fails and preview mode is disabled', async () => {
    vi.stubEnv('VITE_ENABLE_AUTH_MOCK_FALLBACK', 'false');
    vi.stubEnv('VITE_ENABLE_USER_MOCK_FALLBACK', 'false');
    apiMock.get.mockRejectedValue(new Error('profile offline'));

    const userService = await import('@/services/userService');

    await expect(userService.getCurrentUserProfile('user-1')).rejects.toThrow('profile offline');
  });

  it('uses the explicit preview fallback for invalid profile payloads when preview mode is enabled', async () => {
    vi.stubEnv('VITE_ENABLE_USER_MOCK_FALLBACK', 'true');
    apiMock.get.mockResolvedValue({ data: '<!doctype html><html></html>' });

    const userService = await import('@/services/userService');
    const response = await userService.getCurrentUserProfile('user-1');

    expect(response.data).toMatchObject({
      id: 'user-1',
      displayName: 'Local preview user',
      username: 'scopedemo',
    });
  });

  it('uses the explicit preview fallback for profile saves when preview mode is enabled', async () => {
    vi.stubEnv('VITE_ENABLE_USER_MOCK_FALLBACK', 'true');
    apiMock.put.mockRejectedValue(new Error('profile offline'));

    const userService = await import('@/services/userService');
    const response = await userService.updateUserProfile('user-1', {
      displayName: 'Louis Scope',
    });

    expect(response.data.displayName).toBe('Louis Scope');
  });

  it('falls back to local spot search for geocoding', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', '');
    apiMock.get.mockRejectedValue(new Error('intel unavailable'));

    const mapService = await import('@/services/mapService');
    const response = await mapService.geocode('Botanic River Walk', 3);

    expect(response.data[0]).toMatchObject({
      placeName: 'Botanic River Walk',
      city: 'Fort Worth',
    });
  });

  it('falls back to local quick search results when content search is unavailable', async () => {
    apiMock.get.mockRejectedValue(new Error('search unavailable'));

    const searchService = await import('@/services/searchService');
    const response = await searchService.searchContent('rooftop tacos', 'spots', 4, 0);

    expect(response.query).toBe('rooftop tacos');
    expect(response.results[0]).toMatchObject({
      id: 'spot-1',
      name: 'Sunset Rooftop Tacos',
      category: 'food',
    });
  });

  it('uses Mapbox geocoding when the Intel geocoder is unavailable and a token exists', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-token');
    apiMock.get.mockRejectedValue(new Error('intel unavailable'));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        features: [
          {
            center: [-97.7431, 30.2672],
            text: 'Austin City Hall',
            place_name: 'Austin City Hall, Austin, Texas, United States',
            place_type: ['poi'],
            context: [
              { id: 'place.1', text: 'Austin' },
              { id: 'country.1', text: 'United States' },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const mapService = await import('@/services/mapService');
    const response = await mapService.geocode('Austin City Hall', 5);

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('mapbox.places/Austin%20City%20Hall.json'));
    expect(response.data[0]).toMatchObject({
      latitude: 30.2672,
      longitude: -97.7431,
      placeName: 'Austin City Hall',
      city: 'Austin',
    });
  });

  it('keeps reverse geocode pins on the exact clicked coordinates', async () => {
    apiMock.get.mockResolvedValue({
      data: {
        data: {
          latitude: 30.2672,
          longitude: -97.7431,
          placeName: 'Zilker Park',
          formattedAddress: 'Zilker Park, Austin, Texas, United States',
          city: 'Austin',
          country: 'United States',
          precision: 'poi',
        },
      },
    });

    const mapService = await import('@/services/mapService');
    const result = await mapService.reverseGeocode(30.26, -97.75);

    expect(result).toMatchObject({
      latitude: 30.26,
      longitude: -97.75,
      placeName: 'Zilker Park',
      city: 'Austin',
    });
  });

  it('does not snap reverse geocode fallback clicks to demo Austin pins', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', '');
    apiMock.get.mockRejectedValue(new Error('intel unavailable'));

    const mapService = await import('@/services/mapService');
    const result = await mapService.reverseGeocode(31.5493, -97.1467);

    expect(result).toMatchObject({
      latitude: 31.5493,
      longitude: -97.1467,
      placeName: 'Pinned location',
      formattedAddress: '31.5493, -97.1467',
      precision: 'coordinate',
    });
  });

  it('uses Mapbox labels for reverse geocoding without moving the clicked pin', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-token');
    apiMock.get.mockRejectedValue(new Error('intel unavailable'));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        features: [
          {
            center: [-97.1467, 31.5493],
            text: 'Waco',
            place_name: 'Waco, Texas, United States',
            place_type: ['place'],
            context: [{ id: 'country.1', text: 'United States' }],
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const mapService = await import('@/services/mapService');
    const result = await mapService.reverseGeocode(31.5493, -97.1467);

    expect(result).toMatchObject({
      latitude: 31.5493,
      longitude: -97.1467,
      placeName: 'Waco',
      country: 'United States',
      precision: 'place',
    });
  });

  it('builds a local presigned target and short-circuits blob uploads', async () => {
    apiMock.get.mockRejectedValue(new Error('s3 unavailable'));
    const createObjectURL = vi.fn(() => 'blob:scope-upload');
    Object.defineProperty(globalThis.URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });

    const s3Service = await import('@/services/s3Service');
    const target = await s3Service.getPresignedUploadTarget({
      fileName: 'cover-photo.webp',
      contentType: 'image/webp',
      sizeBytes: 1024,
    });
    const fileUrl = await s3Service.uploadFileToPresignedTarget(target, new Blob(['scope']));

    expect(target.uploadUrl).toBe('blob:scope-upload');
    expect(fileUrl).toBe('blob:scope-upload');
    expect(axiosPutMock).not.toHaveBeenCalled();
  });

  it('does not silently mask intel failures with mock vibe matches when QA mode is inactive', async () => {
    // The previous revision of intelService swallowed any intel error and
    // returned mock spots -- that made backend outages invisible to the UI.
    // The new contract: in production (no QA session flag), errors from the
    // Intel API must propagate so the caller can render a proper error
    // state. Mock fallback is reserved for QA / demo sessions.
    apiMock.post.mockRejectedValue(new Error('intel unavailable'));

    const intelService = await import('@/services/intelService');

    await expect(
      intelService.vibeMatch({ vibe: 'electric', limit: 2 }),
    ).rejects.toThrow('intel unavailable');
  });

  it('sends production-safe recommendation payloads to Intel', async () => {
    apiMock.post.mockResolvedValue({
      data: {
        data: [
          {
            id: 'spot-1',
            title: 'Botanic River Walk',
            description: 'Quiet path',
            latitude: 32.74,
            longitude: -97.36,
            category: 'nature',
            city: 'Fort Worth',
            rating: 4.8,
            likesCount: 12,
          },
        ],
      },
    });

    const intelService = await import('@/services/intelService');
    const response = await intelService.recommendSpots({
      destination: ' Fort Worth ',
      interests: ['nature'],
      limit: 3,
    });

    expect(apiMock.post).toHaveBeenCalledWith('/api/intel/recommend/spots', {
      interests: ['nature'],
      limit: 3,
    });
    expect(response.data[0]?.title).toBe('Botanic River Walk');
  });

  it('uses the backend description contract for vibe matching', async () => {
    apiMock.post.mockResolvedValue({
      data: {
        data: [
          {
            id: 'spot-2',
            title: 'Sunset Overlook',
            description: 'Golden hour',
            latitude: 32.75,
            longitude: -97.33,
            category: 'scenic',
            city: 'Fort Worth',
            rating: 4.9,
            likesCount: 20,
          },
        ],
      },
    });

    const intelService = await import('@/services/intelService');
    await intelService.vibeMatch({ vibe: '  chill sunset views  ', limit: 2 });

    expect(apiMock.post).toHaveBeenCalledWith('/api/intel/vibe-match', {
      description: 'chill sunset views',
      limit: 2,
    });
  });

  it('unwraps optimized route objects back into map points', async () => {
    apiMock.post.mockResolvedValue({
      data: {
        data: {
          orderedSpots: [
            { spotId: 'point-b', latitude: 31.5493, longitude: -97.1467 },
            { spotId: 'point-a', latitude: 32.7555, longitude: -97.3308 },
          ],
          estimatedDistance: 145.2,
        },
      },
    });

    const intelService = await import('@/services/intelService');
    const response = await intelService.optimizeRoute({
      points: [
        {
          id: 'point-a',
          title: 'Fort Worth',
          latitude: 32.7555,
          longitude: -97.3308,
          category: 'other',
          routeRole: 'start',
        },
        {
          id: 'point-b',
          title: 'Waco',
          latitude: 31.5493,
          longitude: -97.1467,
          category: 'food',
        },
      ],
    });

    expect(apiMock.post).toHaveBeenCalledWith('/api/intel/route/optimize', {
      spots: [
        { spotId: 'point-a', latitude: 32.7555, longitude: -97.3308 },
        { spotId: 'point-b', latitude: 31.5493, longitude: -97.1467 },
      ],
      startLat: 32.7555,
      startLng: -97.3308,
    });
    expect(response.data.map((point) => point.id)).toEqual(['point-b', 'point-a']);
    expect(response.data[0]).toMatchObject({
      title: 'Waco',
      category: 'food',
    });
  });

  it('falls back to mock vibe matches when running inside an Scope QA session', async () => {
    // Preserve the offline/demo story: when the URL carries an scopeQaSession
    // flag (used for Playwright + screenshot flows) the fallback kicks in so
    // automated runs don't require a live Intel service.
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, search: '?scopeQaSession=guest' },
    });
    try {
      apiMock.post.mockRejectedValue(new Error('intel unavailable'));

      const intelService = await import('@/services/intelService');
      const response = await intelService.vibeMatch({ vibe: 'electric', limit: 2 });

      expect(response.data.length).toBeGreaterThanOrEqual(1);
      expect(response.data[0]?.title).toBe('Sunset Rooftop Tacos');
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    }
  });

  it('sanitizes notification payloads received from the API before display', async () => {
    apiMock.get.mockResolvedValue({
      data: {
        data: [
          {
            id: 'notification-xss',
            title: '  Trip <b>member</b> joined\u0000 ',
            body: ' Hello\u0000 traveler\n\n\nSee you soon ',
            isRead: false,
            createdAt: '2026-03-27T03:00:00Z',
            type: ' trip.member.added ',
          },
        ],
        meta: {
          page: 1,
          pageSize: 1,
          total: 1,
          totalPages: 1,
        },
      },
    });

    const feedService = await import('@/services/feedService');
    const response = await feedService.getNotifications(1, 1);

    expect(response.data[0]).toMatchObject({
      title: 'Trip <b>member</b> joined',
      body: 'Hello traveler\n\nSee you soon',
      type: 'trip.member.added',
    });
  });

  it('uses ranked mock pins when live trending has no user pins yet', async () => {
    apiMock.get.mockResolvedValue({
      data: {
        data: [],
      },
    });

    const feedService = await import('@/services/feedService');
    const { mockSpots } = await import('@/services/mockData');
    const { rankTrendingSpots } = await import('@/utils/spotRanking');
    const response = await feedService.getTrendingSpots(4);

    expect(response.data.map((spot) => spot.id)).toEqual(rankTrendingSpots(mockSpots, 4).map((spot) => spot.id));
    expect(response.meta).toMatchObject({
      page: 1,
      pageSize: 4,
      total: 4,
      totalPages: 1,
    });
  });

  it('hydrates spot lists from ranked mocks when live content has no pins yet', async () => {
    apiMock.get.mockResolvedValue({
      data: {
        data: [],
        meta: {
          page: 1,
          pageSize: 8,
          total: 0,
          totalPages: 1,
        },
      },
    });

    const spotService = await import('@/services/spotService');
    const { mockSpots } = await import('@/services/mockData');
    const { rankTrendingSpots } = await import('@/utils/spotRanking');
    const response = await spotService.listSpots({ page: 1, pageSize: 8 });

    expect(response.data.map((spot) => spot.id)).toEqual(rankTrendingSpots(mockSpots).slice(0, 8).map((spot) => spot.id));
    expect(response.meta).toMatchObject({
      page: 1,
      pageSize: 8,
      total: mockSpots.length,
    });
  });

  it('keeps seed pins for empty unfiltered lists even after live pins have been observed', async () => {
    const { mockSpots } = await import('@/services/mockData');
    const { rankTrendingSpots } = await import('@/utils/spotRanking');
    const liveSpot = {
      ...mockSpots[0],
      id: 'live-spot-1',
      title: 'First Live Pin',
    };

    apiMock.get
      .mockResolvedValueOnce({
        data: {
          data: [liveSpot],
          meta: {
            page: 1,
            pageSize: 1,
            total: 1,
            totalPages: 1,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [],
          meta: {
            page: 1,
            pageSize: 8,
            total: 0,
            totalPages: 1,
          },
        },
      });

    const spotService = await import('@/services/spotService');

    await expect(spotService.listSpots({ page: 1, pageSize: 1 })).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'live-spot-1' })],
    });
    const fallbackResponse = await spotService.listSpots({ page: 1, pageSize: 8 });

    expect(fallbackResponse.data.map((spot) => spot.id)).toEqual(rankTrendingSpots(mockSpots).slice(0, 8).map((spot) => spot.id));
  });

  it('does not backfill filtered empty live spot lists after real pins have been observed', async () => {
    const { mockSpots } = await import('@/services/mockData');
    const liveSpot = {
      ...mockSpots[0],
      id: 'live-spot-2',
      title: 'Second Live Pin',
    };

    apiMock.get
      .mockResolvedValueOnce({
        data: {
          data: [liveSpot],
          meta: {
            page: 1,
            pageSize: 1,
            total: 1,
            totalPages: 1,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [],
          meta: {
            page: 1,
            pageSize: 8,
            total: 0,
            totalPages: 1,
          },
        },
      });

    const spotService = await import('@/services/spotService');

    await spotService.listSpots({ page: 1, pageSize: 1 });
    await expect(spotService.listSpots({ category: 'food', page: 1, pageSize: 8 })).resolves.toMatchObject({
      data: [],
    });
  });

  it('hydrates the activity feed from mocks when live feed has no posts yet', async () => {
    apiMock.get.mockResolvedValue({
      data: {
        data: [],
        meta: {
          page: 1,
          pageSize: 3,
          total: 0,
          totalPages: 1,
        },
      },
    });

    const feedService = await import('@/services/feedService');
    const { mockFeed } = await import('@/services/mockData');
    const response = await feedService.getFeed(1, 3);

    expect(response.data).toHaveLength(3);
    expect(response.meta).toMatchObject({
      page: 1,
      pageSize: 3,
      total: mockFeed.length,
    });
  });

  it('hydrates trip lists from mocks when live trips have not been created yet', async () => {
    apiMock.get.mockResolvedValue({
      data: {
        data: [],
        meta: {
          page: 1,
          pageSize: 2,
          total: 0,
          totalPages: 1,
        },
      },
    });

    const tripService = await import('@/services/tripService');
    const { mockTrips } = await import('@/services/mockData');
    const response = await tripService.listTrips(1, 2);

    expect(response.data.map((trip) => trip.id)).toEqual(mockTrips.slice(0, 2).map((trip) => trip.id));
    expect(response.meta).toMatchObject({
      page: 1,
      pageSize: 2,
      total: mockTrips.length,
    });
  });
});
