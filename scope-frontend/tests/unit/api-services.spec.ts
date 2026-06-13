const { apiMock, getAccessTokenMock } = vi.hoisted(() => ({
  apiMock: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  getAccessTokenMock: vi.fn(() => ''),
}));

const axiosPutMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/api', () => ({
  default: apiMock,
  getAccessToken: getAccessTokenMock,
  isApiClientError: (error: unknown) => error instanceof Error && error.name === 'ApiClientError',
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
    vi.stubEnv('VITE_DEMO_MODE', 'false');
    vi.stubEnv('VITE_ENABLE_LOCAL_PREVIEW', 'false');
    vi.stubEnv('VITE_ENABLE_DEMO_WEATHER', 'false');
    vi.stubEnv('VITE_ENABLE_CLIENT_WEATHER_FALLBACK', 'false');
    vi.stubEnv('VITE_OPENWEATHERMAP_API_KEY', '');
    vi.stubEnv('VITE_ENABLE_AUTH_MOCK_FALLBACK', 'false');
    vi.stubEnv('VITE_ENABLE_USER_MOCK_FALLBACK', 'false');
    vi.stubEnv('VITE_ENABLE_TRIP_MOCK_FALLBACK', 'false');
    vi.stubEnv('VITE_ENABLE_TRIP_LOCAL_WRITE_FALLBACK', 'false');
    vi.stubEnv('VITE_ENABLE_SPOT_MOCK_FALLBACK', 'false');
    vi.stubEnv('VITE_ENABLE_SPOT_LOCAL_WRITE_FALLBACK', 'false');
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.put.mockReset();
    apiMock.delete.mockReset();
    getAccessTokenMock.mockReset();
    getAccessTokenMock.mockReturnValue('');
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

  it('falls back to local preview auth only when explicitly enabled for local development', async () => {
    vi.stubEnv('VITE_ENABLE_AUTH_MOCK_FALLBACK', 'true');
    apiMock.post.mockRejectedValue(new Error('network down'));

    const authService = await import('@/services/authService');
    const payload = await authService.login({
      email: 'maya@example.com',
      password: 'SecurePass123!',
    });

    expect(payload.email).toBe('maya@example.com');
    expect(payload.displayName).toBe('Maya');
    expect(payload.accessToken).toMatch(/^session-access-/);
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
    expect(payload.accessToken).toMatch(/^session-access-/);
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
    expect(payload.accessToken).toMatch(/^session-access-/);

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

  it('persists onboarding preferences for newly registered local-preview accounts', async () => {
    vi.stubEnv('VITE_ENABLE_AUTH_MOCK_FALLBACK', 'true');
    apiMock.post.mockRejectedValue(new Error('core api unavailable'));
    apiMock.get.mockRejectedValue(new Error('profile offline'));
    apiMock.put.mockRejectedValue(new Error('profile offline'));

    const authService = await import('@/services/authService');
    const registered = await authService.register({
      firstName: 'Maya',
      lastName: 'Chen',
      username: 'maya',
      email: 'maya@example.com',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
      dateOfBirth: '1996-04-15',
      acceptedTerms: true,
    });

    expect(registered.id).toBe('local-maya');

    const userService = await import('@/services/userService');
    await expect(userService.updateUserProfile(registered.id, {
      homeBase: ' Dallas, TX ',
      interests: [' food ', 'scenic', ''],
    })).resolves.toMatchObject({
      data: {
        id: 'local-maya',
        username: 'maya',
        email: 'maya@example.com',
        displayName: 'Maya Chen',
        homeBase: 'Dallas, TX',
        interests: ['food', 'scenic'],
      },
    });

    await expect(userService.getCurrentUserProfile(registered.id)).resolves.toMatchObject({
      data: {
        id: 'local-maya',
        username: 'maya',
        email: 'maya@example.com',
        displayName: 'Maya Chen',
        homeBase: 'Dallas, TX',
        interests: ['food', 'scenic'],
      },
    });
    await expect(authService.refreshSession({ allowMockFallback: true })).resolves.toMatchObject({
      id: 'local-maya',
      username: 'maya',
      email: 'maya@example.com',
      displayName: 'Maya Chen',
      homeBase: 'Dallas, TX',
      interests: ['food', 'scenic'],
    });
  });

  it('covers phone-preview auth and Cognito live, fallback, and rejection paths', async () => {
    vi.stubEnv('VITE_ENABLE_AUTH_MOCK_FALLBACK', 'true');
    apiMock.post.mockRejectedValueOnce(new Error('core api unavailable'));

    let authService = await import('@/services/authService');
    const phonePayload = await authService.login({
      email: '(555) 123-4567',
      password: 'SecurePass123!',
    });

    expect(phonePayload).toMatchObject({
      id: 'local-phone-4567',
      username: 'phone-4567',
      displayName: 'Scope traveler',
    });

    apiMock.post.mockResolvedValueOnce({
      data: {
        data: {
          id: 'cognito-user-1',
          username: 'cognito-user',
          email: 'cognito@example.com',
          displayName: 'Cognito User',
          accessToken: 'cognito-access',
          refreshToken: 'cognito-refresh',
        },
      },
    });

    await expect(authService.loginWithCognito('  id-token-live  ')).resolves.toMatchObject({
      username: 'cognito-user',
      accessToken: 'cognito-access',
    });
    expect(apiMock.post).toHaveBeenLastCalledWith('/api/core/auth/oauth/cognito', {
      idToken: 'id-token-live',
    });

    apiMock.post.mockRejectedValueOnce(new Error('cognito unavailable'));
    await expect(authService.loginWithCognito('id-token-fallback')).resolves.toMatchObject({
      username: 'scope-user',
    });

    vi.resetModules();
    vi.stubEnv('VITE_ENABLE_AUTH_MOCK_FALLBACK', 'false');
    const cognitoError = new Error('cognito hard fail');
    apiMock.post.mockRejectedValueOnce(cognitoError);
    authService = await import('@/services/authService');

    await expect(authService.loginWithCognito('id-token-strict')).rejects.toBe(cognitoError);
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

  it('coalesces concurrent live refreshes so rotating tokens are not replayed', async () => {
    const { AUTH_REFRESH_TOKEN_STORAGE_KEY } = await import('@/utils/authSessionStorage');
    const pendingRefresh = Promise.withResolvers<any>();
    sessionStorage.setItem(AUTH_REFRESH_TOKEN_STORAGE_KEY, 'refresh-token-1');
    apiMock.post.mockReturnValueOnce(pendingRefresh.promise);

    const authService = await import('@/services/authService');
    const firstRefresh = authService.refreshSession();
    const secondRefresh = authService.refreshSession();

    await vi.waitFor(() => expect(apiMock.post).toHaveBeenCalledTimes(1));
    pendingRefresh.resolve({
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

    await expect(Promise.all([firstRefresh, secondRefresh])).resolves.toEqual([
      expect.objectContaining({ accessToken: 'access-token-2', refreshToken: 'refresh-token-2' }),
      expect.objectContaining({ accessToken: 'access-token-2', refreshToken: 'refresh-token-2' }),
    ]);
    expect(apiMock.post).toHaveBeenCalledWith('/api/core/auth/refresh', {
      refreshToken: 'refresh-token-1',
    });
  });

  it('reuses a just-rotated live refresh response while storage still has the consumed token', async () => {
    const { AUTH_REFRESH_TOKEN_STORAGE_KEY } = await import('@/utils/authSessionStorage');
    sessionStorage.setItem(AUTH_REFRESH_TOKEN_STORAGE_KEY, 'refresh-token-1');
    apiMock.post.mockResolvedValueOnce({
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
    await expect(authService.refreshSession()).resolves.toMatchObject({
      accessToken: 'access-token-2',
      refreshToken: 'refresh-token-2',
    });
    await expect(authService.refreshSession()).resolves.toMatchObject({
      accessToken: 'access-token-2',
      refreshToken: 'refresh-token-2',
    });

    expect(apiMock.post).toHaveBeenCalledTimes(1);
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

  it('sanitizes successful live login payloads and remembers them only in preview fallback mode', async () => {
    vi.stubEnv('VITE_ENABLE_AUTH_MOCK_FALLBACK', 'true');
    apiMock.post.mockResolvedValueOnce({
      data: {
        data: {
          id: 'live-user-1',
          username: ' live-user ',
          email: ' LIVE@EXAMPLE.COM ',
          displayName: ' Live User ',
          avatarUrl: 'https://images.example.com/live-user.jpg',
          homeBase: ' Dallas, TX ',
          interests: [' food ', 'culture'],
          showActivityStatus: false,
          accessToken: 'live-access-token',
          refreshToken: 'live-refresh-token',
        },
      },
    });

    const authService = await import('@/services/authService');
    const payload = await authService.login({
      email: ' LIVE@EXAMPLE.COM ',
      password: ' SecurePass123! ',
      rememberMe: true,
    });

    expect(apiMock.post).toHaveBeenCalledWith('/api/core/auth/login', {
      email: 'live@example.com',
      password: ' SecurePass123! ',
    });
    expect(payload).toMatchObject({
      id: 'live-user-1',
      username: 'live-user',
      email: 'live@example.com',
      displayName: 'Live User',
      homeBase: 'Dallas, TX',
      interests: ['food', 'culture'],
      showActivityStatus: false,
      accessToken: 'live-access-token',
      refreshToken: 'live-refresh-token',
    });
    expect(localStorage.getItem('scope.auth.users.v1')).toContain('live-user-1');
  });

  it('uses live registration tokens directly and preserves strict refresh errors', async () => {
    apiMock.post.mockResolvedValueOnce({
      data: {
        data: {
          id: 'registered-live-user',
          username: 'registered-live',
          email: 'registered@example.com',
          displayName: 'Registered Live',
          accessToken: 'register-access-token',
          refreshToken: 'register-refresh-token',
        },
      },
    });

    const authService = await import('@/services/authService');
    const registered = await authService.register({
      firstName: 'Registered',
      lastName: 'Live',
      username: ' registered-live ',
      email: ' Registered@Example.com ',
      password: ' SecurePass123! ',
      confirmPassword: ' SecurePass123! ',
      dateOfBirth: '1996-04-15',
      acceptedTerms: true,
    });

    expect(apiMock.post).toHaveBeenCalledTimes(1);
    expect(registered).toMatchObject({
      id: 'registered-live-user',
      username: 'registered-live',
      email: 'registered@example.com',
      accessToken: 'register-access-token',
    });

    const refreshError = new Error('refresh still strict');
    const { persistAuthSessionHint } = await import('@/utils/authSessionStorage');
    persistAuthSessionHint('register-refresh-token');
    apiMock.post.mockRejectedValueOnce(refreshError);
    await expect(authService.refreshSession({ allowMockFallback: false })).rejects.toBe(refreshError);
  });

  it('falls back to the default local preview identity for blank credentials and swallows logout outages', async () => {
    vi.stubEnv('VITE_ENABLE_AUTH_MOCK_FALLBACK', 'true');
    apiMock.post.mockRejectedValue(new Error('core api unavailable'));

    const authService = await import('@/services/authService');

    await expect(authService.login({
      email: '   ',
      password: 'SecurePass123!',
    })).resolves.toMatchObject({
      id: 'user-1',
      username: 'scope-user',
      email: undefined,
    });

    await expect(authService.logout('expired-refresh-token')).resolves.toBeUndefined();
    expect(apiMock.post).toHaveBeenLastCalledWith('/api/core/auth/logout', {
      refreshToken: 'expired-refresh-token',
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
      displayName: 'Scope traveler',
      username: 'scope-showcase',
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

  it('requires the explicit account-deletion confirmation header when erasing current-user content', async () => {
    apiMock.delete.mockResolvedValue({ data: { data: { deleted: true } } });

    const userService = await import('@/services/userService');
    await userService.deleteCurrentUserContent();

    expect(apiMock.delete).toHaveBeenCalledWith('/api/content/users/me', {
      headers: {
        'X-Scope-Account-Deletion': 'confirm',
      },
    });
  });

  it('normalizes live user profiles, handle searches, and stats aliases', async () => {
    apiMock.get
      .mockResolvedValueOnce({
        data: {
          data: {
            id: 'user-live-me',
            username: 'live-me',
            displayName: 'Live Me',
            showActivityStatus: false,
            interests: 'food',
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: 'user-live-profile',
          username: 'maya-live',
          displayName: 'Maya Live',
          email: 'maya@example.com',
          interests: ['food', 'culture'],
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 'user-search-1',
              username: 'maya',
              displayName: 'Maya Search',
              email: 'maya.search@example.com',
              interests: ['scenic'],
            },
          ],
          meta: { page: 1, pageSize: 5, total: 1, totalPages: 1 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            spotsCount: -2,
            tripsCount: 3,
            friendsCount: 4,
          },
        },
      });

    const userService = await import('@/services/userService');

    await expect(userService.getCurrentUserProfile()).resolves.toMatchObject({
      data: {
        id: 'user-live-me',
        email: '',
        interests: [],
        showActivityStatus: false,
      },
    });
    await expect(userService.getUserProfile('user-live-profile')).resolves.toMatchObject({
      data: {
        username: 'maya-live',
        email: 'maya@example.com',
        interests: ['food', 'culture'],
        showActivityStatus: true,
      },
    });
    await expect(userService.searchUsers(' @Maya ', 1, 5)).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'user-search-1', username: 'maya' })],
      meta: { page: 1, pageSize: 5, total: 1, totalPages: 1 },
    });
    await expect(userService.getUserStats('user-live-profile')).resolves.toMatchObject({
      data: { spots: 0, trips: 3, friends: 4 },
    });
    expect(apiMock.get).toHaveBeenNthCalledWith(3, '/api/core/users/search', {
      params: { q: 'Maya', page: 1, pageSize: 5 },
    });
  });

  it('keeps preview user fallback explicit across profile lookup, search, stats, and deactivation', async () => {
    vi.stubEnv('VITE_ENABLE_USER_MOCK_FALLBACK', 'true');
    apiMock.get.mockRejectedValue(new Error('profile offline'));
    apiMock.delete.mockRejectedValue(new Error('delete offline'));

    const userService = await import('@/services/userService');

    await expect(userService.getUserProfile('user-2')).resolves.toMatchObject({
      data: {
        id: 'demo-user-2',
        username: 'maya.chen',
        displayName: 'Maya Chen',
      },
    });
    await expect(userService.searchUsers('@scope-showcase', 1, 5)).resolves.toMatchObject({
      data: expect.arrayContaining([expect.objectContaining({ id: 'user-1', username: 'scope-showcase' })]),
    });
    await expect(userService.searchUsers('@maya.chen', 1, 5)).resolves.toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({
          id: 'demo-user-2',
          avatarUrl: expect.stringContaining('images.pexels.com'),
        }),
      ]),
    });
    await expect(userService.getUserStats('user-1')).resolves.toMatchObject({
      data: expect.objectContaining({
        spots: expect.any(Number),
        trips: expect.any(Number),
        friends: 126,
      }),
    });

    await userService.deactivateUserProfile('demo-user-2');
    await expect(userService.getUserProfile('demo-user-2')).rejects.toThrow('User demo-user-2 not found');
  });

  it('keeps every social mock person profile-resolvable with canonical handles', async () => {
    vi.stubEnv('VITE_ENABLE_USER_MOCK_FALLBACK', 'true');
    vi.stubEnv('VITE_ENABLE_SOCIAL_MOCK_FALLBACK', 'true');
    apiMock.get.mockRejectedValue(new Error('profile offline'));

    const [{ mockFriendConnections, mockFriendRequests }, userService] = await Promise.all([
      import('@/services/socialMockData'),
      import('@/services/userService'),
    ]);
    const socialUsers = [
      ...mockFriendConnections.map((connection) => connection.user),
      ...mockFriendRequests.map((request) => request.user),
    ];

    expect(socialUsers.filter((user) => user.displayName === 'Maya Chen')).toHaveLength(1);
    expect(socialUsers.find((user) => user.displayName === 'Maya Chen')).toMatchObject({
      id: 'demo-user-2',
      username: 'maya.chen',
    });

    await Promise.all(
      socialUsers.map(async (user) => {
        await expect(userService.getUserProfile(user.id)).resolves.toMatchObject({
          data: expect.objectContaining({
            id: user.id,
            username: user.username,
            displayName: user.displayName,
          }),
        });
      }),
    );
  });

  it('sanitizes preview profile updates before mutating the local user catalog', async () => {
    vi.stubEnv('VITE_ENABLE_USER_MOCK_FALLBACK', 'true');
    apiMock.put.mockRejectedValue(new Error('profile offline'));

    const userService = await import('@/services/userService');
    const response = await userService.updateUserProfile('user-1', {
      username: ' Scope Demo ',
      email: '  DEMO@SCOPE.TRAVEL  ',
      displayName: '  Scope Demo  ',
      avatarUrl: 'javascript:alert(1)',
      bio: 'First line\nSecond line<script>',
      homeBase: ' Fort Worth, TX ',
      interests: [' food ', '', ' culture '],
      showActivityStatus: false,
    });

    expect(response.data).toMatchObject({
      username: 'Scope Demo',
      email: 'demo@scope.travel',
      displayName: 'Scope Demo',
      avatarUrl: '',
      bio: 'First line\nSecond line<script>',
      homeBase: 'Fort Worth, TX',
      interests: ['food', 'culture'],
      showActivityStatus: false,
    });
  });

  it('does not hide user profile failures when preview fallback is disabled', async () => {
    vi.stubEnv('VITE_ENABLE_USER_MOCK_FALLBACK', 'false');
    const profileError = new Error('profile offline');
    apiMock.get.mockRejectedValue(profileError);
    apiMock.put.mockRejectedValue(profileError);
    apiMock.delete.mockRejectedValue(profileError);

    const userService = await import('@/services/userService');

    await expect(userService.getUserProfile('user-1')).rejects.toThrow('profile offline');
    await expect(userService.updateUserProfile('user-1', { displayName: 'No fallback' })).rejects.toThrow('profile offline');
    await expect(userService.deactivateUserProfile('user-1')).rejects.toThrow('profile offline');
    await expect(userService.searchUsers('maya')).rejects.toThrow('profile offline');
    await expect(userService.getUserStats('user-1')).rejects.toThrow('profile offline');
  });

  it('normalizes live friend lists, requests, suggestions, and social actions', async () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('VITEST', '');
    vi.stubEnv('VITE_ENABLE_USER_MOCK_FALLBACK', 'false');
    apiMock.get
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              friendshipId: 'friendship-live',
              friendId: 'friend-live',
              user: {
                id: 'friend-live',
                username: 'friend-live',
                displayName: 'Friend Live',
                avatarUrl: 'https://i.pravatar.cc/160?img=32',
                interests: ['food'],
              },
              presence: 'teleporting',
              sharedTrips: -1,
              mutualFriends: '2',
              favoriteCategories: ['food', 'bad-category'],
              since: '2026-05-01T12:00:00Z',
            },
          ],
          meta: { page: 2, pageSize: 3, total: 4, totalPages: 2 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              friendshipId: 'request-live',
              requesterId: 'request-user-live',
              direction: 'outgoing',
              requestedAt: '2026-05-02T12:00:00Z',
              mutualFriends: '3',
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              friendId: 'suggestion-live',
              sharedInterests: [' food ', '', 'culture'],
              favoriteCategories: ['invalid-category'],
              presence: 'planning',
              reason: '',
              score: '7',
            },
          ],
        },
      });
    apiMock.post.mockResolvedValueOnce({ data: { ok: true } });
    apiMock.put
      .mockResolvedValueOnce({
        data: {
          data: {
            friendshipId: 'accepted-live',
            friendId: 'accepted-user',
            presence: 'planning',
            sharedTrips: 1,
          },
        },
      })
      .mockResolvedValueOnce({ data: { ok: true } });
    apiMock.delete.mockResolvedValueOnce({ data: { ok: true } });

    const friendService = await import('@/services/friendService');

    await expect(friendService.listFriends(2, 3)).resolves.toMatchObject({
      data: [
        expect.objectContaining({
          id: 'friendship-live',
          presence: 'offline',
          sharedTrips: 0,
          mutualFriends: 2,
          favoriteCategories: ['food'],
          user: expect.objectContaining({
            id: 'friend-live',
            displayName: 'Friend Live',
            avatarUrl: expect.stringContaining('i.pravatar.cc'),
          }),
        }),
      ],
      meta: { page: 2, pageSize: 3, total: 4, totalPages: 2 },
    });
    await expect(friendService.listPendingFriendRequests()).resolves.toMatchObject({
      data: [
        expect.objectContaining({
          id: 'request-live',
          direction: 'outgoing',
          user: expect.objectContaining({ id: 'request-user-live' }),
        }),
      ],
    });
    await expect(friendService.listFriendSuggestions('vibes', 4)).resolves.toMatchObject({
      data: [
        expect.objectContaining({
          id: 'suggestion-live',
          presence: 'planning',
          sharedInterests: ['food', 'culture'],
          favoriteCategories: [],
          reason: 'Fresh Scope traveler',
          score: 7,
        }),
      ],
    });

    await friendService.sendFriendRequest('user-99');
    await expect(friendService.acceptFriendRequest('request-99')).resolves.toMatchObject({
      id: 'accepted-live',
      presence: 'planning',
      user: expect.objectContaining({ id: 'accepted-user' }),
    });
    await friendService.rejectFriendRequest('request-99');
    await friendService.removeFriend('accepted-live');

    expect(apiMock.get).toHaveBeenNthCalledWith(1, '/api/core/friends', { params: { page: 2, pageSize: 3 } });
    expect(apiMock.get).toHaveBeenNthCalledWith(2, '/api/core/friends/pending');
    expect(apiMock.get).toHaveBeenNthCalledWith(3, '/api/core/friends/suggestions', { params: { mode: 'vibes', limit: 4 } });
    expect(apiMock.post).toHaveBeenCalledWith('/api/core/friends/request/user-99');
    expect(apiMock.put).toHaveBeenNthCalledWith(1, '/api/core/friends/request-99/accept');
    expect(apiMock.put).toHaveBeenNthCalledWith(2, '/api/core/friends/request-99/reject');
    expect(apiMock.delete).toHaveBeenCalledWith('/api/core/friends/accepted-live');
  });

  it('keeps social graph reads empty without mocks while surfacing action failures', async () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('VITEST', '');
    vi.stubEnv('VITE_ENABLE_USER_MOCK_FALLBACK', 'false');
    vi.stubEnv('VITE_ENABLE_SOCIAL_MOCK_FALLBACK', 'false');
    const socialError = new Error('friends offline');
    apiMock.get.mockRejectedValue(socialError);
    apiMock.post.mockRejectedValue(socialError);
    apiMock.put.mockRejectedValue(socialError);
    apiMock.delete.mockRejectedValue(socialError);

    const friendService = await import('@/services/friendService');

    await expect(friendService.listFriends()).resolves.toMatchObject({
      data: [],
      meta: expect.objectContaining({ page: 1, pageSize: 50, total: 0 }),
    });
    await expect(friendService.listPendingFriendRequests()).resolves.toMatchObject({ data: [] });
    await expect(friendService.listFriendSuggestions()).resolves.toMatchObject({ data: [] });
    await expect(friendService.sendFriendRequest('user-99')).rejects.toThrow('friends offline');
    await expect(friendService.acceptFriendRequest('request-99')).rejects.toThrow('friends offline');
    await expect(friendService.rejectFriendRequest('request-99')).rejects.toThrow('friends offline');
    await expect(friendService.removeFriend('friendship-99')).rejects.toThrow('friends offline');
  });

  it('does not use social mock fallbacks even when user preview fallback is enabled', async () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('VITEST', '');
    vi.stubEnv('VITE_ENABLE_USER_MOCK_FALLBACK', 'true');
    vi.stubEnv('VITE_ENABLE_SOCIAL_MOCK_FALLBACK', 'true');
    apiMock.get.mockRejectedValue(new Error('friends offline'));
    apiMock.post.mockRejectedValue(new Error('friends offline'));
    apiMock.put.mockRejectedValue(new Error('friends offline'));
    apiMock.delete.mockRejectedValue(new Error('friends offline'));

    const friendService = await import('@/services/friendService');

    await expect(friendService.listFriends(1, 2)).resolves.toMatchObject({
      data: [],
      meta: expect.objectContaining({ page: 1, pageSize: 2, total: 0 }),
    });
    await expect(friendService.listPendingFriendRequests()).resolves.toMatchObject({ data: [] });
    await expect(friendService.listFriendSuggestions('random', 3)).resolves.toMatchObject({ data: [] });
    await expect(friendService.sendFriendRequest('user-preview')).rejects.toThrow('friends offline');
    await expect(friendService.acceptFriendRequest('missing-request')).rejects.toThrow('friends offline');
    await expect(friendService.rejectFriendRequest('request-preview')).rejects.toThrow('friends offline');
    await expect(friendService.removeFriend('friendship-preview')).rejects.toThrow('friends offline');
  });

  it('normalizes friend handle searches before they reach the live users API', async () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('VITEST', '');
    apiMock.get.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'user-maya',
            username: 'maya',
            email: 'maya@example.com',
            displayName: 'Maya Chen',
            interests: ['food'],
          },
        ],
      },
    });

    const friendService = await import('@/services/friendService');
    const response = await friendService.searchFriendCandidates('  @maya  ', 2, 5);

    expect(response.data[0]).toMatchObject({
      id: 'user-maya',
      username: 'maya',
      displayName: 'Maya Chen',
    });
    expect(apiMock.get).toHaveBeenCalledWith('/api/core/users/search', {
      params: { q: 'maya', page: 2, pageSize: 5 },
    });
  });

  it('keeps seeded social fallback fixtures out of production service fallbacks', async () => {
    vi.stubEnv('VITE_ENABLE_SOCIAL_MOCK_FALLBACK', 'true');
    const friendService = await import('@/services/friendService');
    const { mockFriendRequests } = await import('@/services/socialMockData');

    const [best, mutuals, vibes, random] = await Promise.all([
      friendService.listFriendSuggestions('best', 4),
      friendService.listFriendSuggestions('mutuals', 4),
      friendService.listFriendSuggestions('vibes', 4),
      friendService.listFriendSuggestions('random', 4),
    ]);

    expect(best.data).toEqual([]);
    expect(mutuals.data).toEqual([]);
    expect(vibes.data).toEqual([]);
    expect(random.data).toEqual([]);

    const incomingRequest = mockFriendRequests.find((request) => request.direction === 'incoming');
    expect(incomingRequest).toBeDefined();
    apiMock.put.mockRejectedValueOnce(new Error('friends API offline'));

    await expect(friendService.acceptFriendRequest(incomingRequest!.id)).rejects.toThrow('friends API offline');
  });

  it('uses explicit local spot fallback for geocoding only when preview map fallback is enabled', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', '');
    vi.stubEnv('VITE_ENABLE_MAP_MOCK_FALLBACK', 'true');
    apiMock.get.mockRejectedValue(new Error('intel unavailable'));

    const mapService = await import('@/services/mapService');
    const response = await mapService.geocode('Botanic River Walk', 3);

    expect(response.data[0]).toMatchObject({
      placeName: 'Botanic River Walk',
      city: 'Fort Worth',
    });
  });

  it('does not fabricate local geocoding results when real providers are unavailable', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', '');
    apiMock.get.mockRejectedValue(new Error('intel unavailable'));

    const mapService = await import('@/services/mapService');
    const response = await mapService.geocode('Pizza Hut near me', 3);

    expect(response.data).toEqual([]);
  });

  it('falls back to local quick search results in local preview mode when content search is unavailable', async () => {
    vi.stubEnv('VITE_ENABLE_SEARCH_MOCK_FALLBACK', 'true');
    apiMock.get.mockRejectedValue(new Error('search unavailable'));

    const searchService = await import('@/services/searchService');
    const response = await searchService.searchContent('rooftop tacos', 'spots', 4, 0);

    expect(response.query).toBe('rooftop tacos');
    expect(response.results[0]).toMatchObject({
      name: 'Sunset Rooftop Tacos',
      category: 'food',
    });
  });

  it('fills empty live quick-search responses from local preview search data when enabled', async () => {
    vi.stubEnv('VITE_ENABLE_SEARCH_MOCK_FALLBACK', 'true');
    apiMock.get.mockResolvedValue({
      data: {
        query: 'ben',
        type: 'spots',
        total: 0,
        offset: 0,
        limit: 6,
        results: [],
      },
    });

    const searchService = await import('@/services/searchService');
    const response = await searchService.searchContent('ben', 'spots', 6, 0);

    expect(response.results[0]).toMatchObject({
      name: 'Big Bend Window Trail',
      photoUrl: expect.stringContaining('images.pexels.com'),
    });
  });

  it('filters unrelated fuzzy live hits for short quick-search queries', async () => {
    apiMock.get.mockResolvedValue({
      data: {
        query: 'ben',
        type: 'spots',
        total: 2,
        offset: 0,
        limit: 6,
        results: [
          {
            id: 'live-big-bend',
            name: 'Big Bend Window Trail',
            description: 'Desert canyon overlook',
            category: 'adventure',
            city: 'Big Bend National Park',
            country: 'US',
            avg_rating: 4.9,
            review_count: 12,
            _score: 9,
          },
          {
            id: 'live-sydney',
            name: 'Sydney Opera House Circular Quay',
            description: 'Harbor landmark',
            category: 'scenic',
            city: 'Sydney',
            country: 'AU',
            avg_rating: 4.9,
            review_count: 8,
            _score: 7,
          },
        ],
      },
    });

    const searchService = await import('@/services/searchService');
    const response = await searchService.searchContent('ben', 'spots', 6, 0);

    expect(response.total).toBe(1);
    expect(response.results.map((result) => result.name)).toEqual(['Big Bend Window Trail']);
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

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('mapbox.places/Austin%20City%20Hall.json'),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(response.data[0]).toMatchObject({
      latitude: 30.2672,
      longitude: -97.7431,
      placeName: 'Austin City Hall',
      city: 'Austin',
    });
  });

  it('normalizes sparse Mapbox geocode features without crashing on missing optional context', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-token');
    apiMock.get.mockRejectedValue(new Error('intel unavailable'));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        features: [
          {
            center: ['bad', null],
            text: 'Broken candidate',
            place_name: 'Broken candidate',
            place_type: 'poi',
            context: { place: 'not-array' },
          },
          {
            id: 'poi.1',
            center: [-97.7431, 30.2672],
            text: 'Sparse Cafe',
            place_name: 'Sparse Cafe, Austin, United States',
            place_type: 'poi',
            context: [
              null,
              { id: 'country.1', text: 'United States', short_code: 'us' },
            ],
            properties: null,
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const mapService = await import('@/services/mapService');
    const response = await mapService.geocode('Sparse Cafe', 5);

    expect(response.data).toHaveLength(1);
    expect(response.data[0]).toMatchObject({
      placeName: 'Sparse Cafe',
      latitude: 30.2672,
      longitude: -97.7431,
      country: 'United States',
      countryCode: 'us',
    });
  });

  it('retrieves Mapbox Search Box places with nested photo payloads and distance sorting', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-token');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          suggestions: [
            {
              mapbox_id: 'invalid-coordinate',
              name: 'Invalid coordinate cafe',
              feature_type: 'poi',
            },
            {
              mapbox_id: 'valid-coordinate',
              name: 'Garden Cafe',
              full_address: '100 Garden Ave, Austin, Texas',
              poi_category: ['coffee'],
              distance: 400,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          features: [
            {
              geometry: { coordinates: ['bad', null] },
              properties: { name: 'Invalid coordinate cafe' },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          features: [
            {
              geometry: { coordinates: [-97.7431, 30.2672] },
              properties: {
                name: 'Garden Cafe',
                full_address: '100 Garden Ave, Austin, Texas',
                address: '100 Garden Ave',
                feature_type: 'poi',
                poi_category: ['coffee', 'breakfast'],
                context: {
                  place: { name: 'Austin' },
                  country: { name: 'United States', country_code: 'US' },
                },
                photos: [
                  { url: 'javascript:alert(1)' },
                  { url: 'https://images.example.com/garden.jpg' },
                ],
              },
            },
          ],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const mapService = await import('@/services/mapService');
    const response = await mapService.searchPlaces('Garden Cafe', {
      limit: 3,
      proximity: { latitude: 30.26, longitude: -97.75 },
      bboxRadiusKm: 12,
    });

    expect(response.data).toHaveLength(1);
    expect(response.data[0]).toMatchObject({
      placeName: 'Garden Cafe',
      address: '100 Garden Ave',
      city: 'Austin',
      country: 'United States',
      countryCode: 'US',
      category: 'coffee',
      photoUrl: 'https://images.example.com/garden.jpg',
      source: 'mapbox',
    });
  });

  it('uses broad Mapbox region/country types for planner map target geocoding', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-token');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        features: [
          {
            center: [-99.9018, 31.9686],
            text: 'Texas',
            place_name: 'Texas, United States',
            place_type: ['region'],
            context: [
              { id: 'country.1', text: 'United States', short_code: 'us' },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const mapService = await import('@/services/mapService');
    const response = await mapService.geocodeMapTarget('texas', 5);
    const mapboxUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);

    expect(mapboxUrl.searchParams.get('types')).toContain('region');
    expect(mapboxUrl.searchParams.get('types')).toContain('country');
    expect(response.data[0]).toMatchObject({
      latitude: 31.9686,
      longitude: -99.9018,
      placeName: 'Texas',
      country: 'United States',
      countryCode: 'us',
      precision: 'region',
    });
  });

  it('ignores synthetic Intel geocode fallbacks and retries Mapbox for coordinates', async () => {
    vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test-token');
    apiMock.get.mockResolvedValue({
      data: {
        data: [{
          latitude: 32.7555,
          longitude: -97.3308,
          placeName: 'Pizza Hut near me',
          formattedAddress: 'Pizza Hut near me, USA',
          city: 'Fort Worth',
          country: 'United States',
          precision: 'fallback',
        }],
      },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        features: [
          {
            center: [-96.797, 32.7767],
            text: 'Dallas',
            place_name: 'Dallas, Texas, United States',
            place_type: ['place'],
            context: [
              { id: 'place.1', text: 'Dallas' },
              { id: 'country.1', text: 'United States' },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const mapService = await import('@/services/mapService');
    const response = await mapService.geocode('Dallas, TX', 1);

    expect(response.data[0]).toMatchObject({
      latitude: 32.7767,
      longitude: -96.797,
      placeName: 'Dallas',
      precision: 'place',
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

  it('adds OpenWeatherMap air quality to weather snapshots', async () => {
    vi.stubEnv('VITE_ENABLE_CLIENT_WEATHER_FALLBACK', 'true');
    vi.stubEnv('VITE_OPENWEATHERMAP_API_KEY', 'owm-test-key');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          name: 'Goltry',
          coord: { lat: 36.532, lon: -98.151 },
          main: { temp: 62.4 },
          weather: [{ id: 800, description: 'clear sky', icon: '01n' }],
          wind: { speed: 10.2 },
          dt: 1_762_000_000,
          sys: {
            sunrise: 1_761_980_000,
            sunset: 1_761_999_000,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          list: [
            {
              main: { aqi: 1 },
            },
          ],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const weatherService = await import('@/services/openWeatherMapService');
    const snapshot = await weatherService.getOpenWeatherMapSnapshot({
      label: 'Goltry',
      latitude: 36.532,
      longitude: -98.151,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/data/2.5/air_pollution');
    expect(snapshot).toMatchObject({
      label: 'Goltry',
      temperatureF: 62.4,
      windMph: 10.2,
      provider: 'openweather',
      providerLabel: 'OpenWeatherMap',
      conditionCode: 800,
      iconCode: '01n',
      isDaytime: false,
      airQuality: {
        index: 1,
        label: 'Good',
        scale: 'openweather',
      },
    });
  });

  it('falls back to Open-Meteo when OpenWeatherMap returns malformed weather', async () => {
    vi.stubEnv('VITE_ENABLE_CLIENT_WEATHER_FALLBACK', 'true');
    vi.stubEnv('VITE_OPENWEATHERMAP_API_KEY', 'owm-test-key');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ current: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          current: {
            temperature_2m: 69.2,
            weather_code: 2,
            wind_speed_10m: 11.4,
            is_day: 1,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          current: { us_aqi: 38 },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const weatherService = await import('@/services/openWeatherMapService');
    const snapshot = await weatherService.getOpenWeatherMapSnapshot({
      label: 'Dallas',
      latitude: 32.7767,
      longitude: -96.797,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('api.open-meteo.com/v1/forecast');
    expect(snapshot).toMatchObject({
      label: 'Dallas',
      temperatureF: 69.2,
      windMph: 11.4,
      condition: 'Partly Cloudy',
      provider: 'openmeteo',
      providerLabel: 'Open-Meteo',
      airQuality: {
        index: 38,
        label: 'Good',
        scale: 'us',
      },
    });
  });

  it('rejects unavailable weather instead of fabricating zero values', async () => {
    vi.stubEnv('VITE_ENABLE_CLIENT_WEATHER_FALLBACK', 'true');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ current: {} }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const weatherService = await import('@/services/openWeatherMapService');

    await expect(weatherService.getOpenWeatherMapSnapshot({
      label: 'Dallas',
      latitude: 32.7767,
      longitude: -96.797,
    })).rejects.toThrow('Weather is unavailable right now.');
  });

  it('rejects weather lookups without a label or usable coordinates', async () => {
    const weatherService = await import('@/services/openWeatherMapService');

    await expect(weatherService.getOpenWeatherMapSnapshot({
      label: '   ',
      latitude: Number.NaN,
      longitude: -96.797,
    })).rejects.toThrow('Weather location is missing.');
  });

  it('allows map weather to use public Open-Meteo fallback without a client API key', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          current: {
            temperature_2m: 77.3,
            weather_code: 1,
            wind_speed_10m: 9.4,
            is_day: 1,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          current: { us_aqi: 42 },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const weatherService = await import('@/services/openWeatherMapService');
    const snapshot = await weatherService.getOpenWeatherMapSnapshot({
      label: 'Map center',
      latitude: 32.8343,
      longitude: -97.2289,
      allowPublicFallback: true,
    });

    expect(apiMock.get).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('api.open-meteo.com/v1/forecast');
    expect(snapshot).toMatchObject({
      provider: 'openmeteo',
      providerLabel: 'Open-Meteo',
      temperatureF: 77.3,
      windMph: 9.4,
      airQuality: {
        index: 42,
        label: 'Good',
        scale: 'us',
      },
    });
  });

  it('latches OpenWeatherMap unavailable after auth failures and skips it on later lookups', async () => {
    vi.stubEnv('VITE_ENABLE_CLIENT_WEATHER_FALLBACK', 'true');
    vi.stubEnv('VITE_OPENWEATHERMAP_API_KEY', 'owm-test-key');

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({ message: 'invalid api key' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          current: {
            temperature_2m: 71,
            weather_code: 95,
            wind_speed_10m: 14,
            is_day: false,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          current: { us_aqi: 175 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          current: {
            temperature_2m: 55,
            weather_code: 0,
            wind_speed_10m: 6,
            is_day: 'unknown',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          current: { us_aqi: 350 },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const weatherService = await import('@/services/openWeatherMapService');
    const firstSnapshot = await weatherService.getOpenWeatherMapSnapshot({
      label: 'Dallas',
      latitude: 32.7767,
      longitude: -96.797,
    });
    const secondSnapshot = await weatherService.getOpenWeatherMapSnapshot({
      label: 'Fort Worth',
      latitude: 32.7555,
      longitude: -97.3308,
    });

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('api.openweathermap.org/data/2.5/weather');
    expect(fetchMock.mock.calls.slice(1).every((call) => !String(call[0]).includes('api.openweathermap.org/data/2.5/weather'))).toBe(true);
    expect(firstSnapshot).toMatchObject({
      provider: 'openmeteo',
      condition: 'Thunderstorms',
      isDaytime: false,
      airQuality: {
        index: 175,
        label: 'Unhealthy',
        scale: 'us',
      },
    });
    expect(secondSnapshot).toMatchObject({
      provider: 'openmeteo',
      condition: 'Clear',
      airQuality: {
        index: 350,
        label: 'Hazardous',
        scale: 'us',
      },
    });
    expect(secondSnapshot).not.toHaveProperty('isDaytime');
  });

  it('falls back to Open-Meteo air quality when OpenWeatherMap air pollution is rate limited', async () => {
    vi.stubEnv('VITE_ENABLE_CLIENT_WEATHER_FALLBACK', 'true');
    vi.stubEnv('VITE_OPENWEATHERMAP_API_KEY', 'owm-test-key');

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          name: 'Austin',
          coord: { lat: 30.2672, lon: -97.7431 },
          main: { temp: 84 },
          weather: [{ id: 803, main: 'Clouds', icon: '04d' }],
          wind: { speed: 8 },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: vi.fn().mockResolvedValue({ message: 'rate limited' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          current: { us_aqi: 305 },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const weatherService = await import('@/services/openWeatherMapService');
    const snapshot = await weatherService.getOpenWeatherMapSnapshot({
      label: 'Austin',
      latitude: 30.2672,
      longitude: -97.7431,
    });

    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/data/2.5/air_pollution');
    expect(snapshot).toMatchObject({
      provider: 'openweather',
      providerLabel: 'OpenWeatherMap',
      airQuality: {
        index: 305,
        label: 'Hazardous',
        scale: 'us',
      },
    });
  });

  it('keeps weather live when local weather fallback is not enabled', async () => {
    getAccessTokenMock.mockReturnValue('live-access-token');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    apiMock.get.mockResolvedValue({
      data: {
        data: {
          label: 'North Richland Hills',
          latitude: 32.8343,
          longitude: -97.2289,
          temperatureF: 82.7,
          condition: 'Clear',
          windMph: 11.6,
          provider: 'openmeteo',
          providerLabel: 'Open-Meteo',
          checkedAtIso: '2026-05-19T03:00:00.000Z',
          observedAtIso: '2026-05-19T02:55:00.000Z',
          freshnessSeconds: 300,
          isStale: false,
        },
      },
    });

    const weatherService = await import('@/services/openWeatherMapService');
    const snapshot = await weatherService.getOpenWeatherMapSnapshot({
      label: 'North Richland Hills',
      latitude: 32.8343,
      longitude: -97.2289,
    });

    expect(apiMock.get).toHaveBeenCalledWith('/api/intel/weather/current', {
      params: {
        lat: 32.8343,
        lng: -97.2289,
        q: 'North Richland Hills',
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(snapshot).toMatchObject({
      provider: 'openmeteo',
      providerLabel: 'Open-Meteo',
      temperatureF: 82.7,
      windMph: 11.6,
      freshnessSeconds: 300,
      isStale: false,
    });
    expect(snapshot.checkedAtIso).toBe('2026-05-19T03:00:00.000Z');
  });

  it('uses deterministic local weather only behind the local weather flag', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true');
    vi.stubEnv('VITE_ENABLE_DEMO_WEATHER', 'true');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const weatherService = await import('@/services/openWeatherMapService');
    const snapshot = await weatherService.getOpenWeatherMapSnapshot({
      label: 'North Richland Hills',
      latitude: 32.8343,
      longitude: -97.2289,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(snapshot.provider).toBe('local');
    expect(snapshot.providerLabel).toBe('Scope local weather');
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
        data: {
          matches: [
            {
              id: 'spot-2',
              spotId: 'spot-2',
              title: 'Sunset Overlook',
              description: 'Golden hour',
              latitude: 32.75,
              longitude: -97.33,
              category: 'scenic',
              city: 'Fort Worth',
              rating: 4.9,
              likesCount: 20,
              reason: 'Matches the chill sunset vibe.',
              confidence: 0.88,
            },
          ],
        },
      },
    });

    const intelService = await import('@/services/intelService');
    const response = await intelService.vibeMatch({ vibe: '  chill sunset views  ', limit: 2 });

    expect(apiMock.post).toHaveBeenCalledWith('/api/intel/vibe-match', {
      description: 'chill sunset views',
      limit: 2,
    });
    expect(response.data[0]?.title).toBe('Sunset Overlook');
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

  it('keeps empty initial live trending responses empty when mock fallback is disabled', async () => {
    apiMock.get.mockResolvedValue({
      data: {
        data: [],
      },
    });

    const feedService = await import('@/services/feedService');
    const response = await feedService.getTrendingSpots(4);

    expect(response.data).toEqual([]);
  });

  it('hydrates spot lists from ranked mocks when live content has no pins yet', async () => {
    vi.stubEnv('VITE_ENABLE_SPOT_MOCK_FALLBACK', 'true');
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
    vi.stubEnv('VITE_ENABLE_SPOT_MOCK_FALLBACK', 'true');
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

  it('normalizes backend spot visibility when loading a private spot detail', async () => {
    apiMock.get.mockResolvedValue({
      data: {
        id: 'private-spot',
        title: 'Hidden Favorite',
        latitude: 32.7555,
        longitude: -97.3308,
        category: 'food',
        rating: '4.5',
        created_at: '2026-03-28T00:00:00Z',
        is_public: false,
      },
    });

    const spotService = await import('@/services/spotService');
    const response = await spotService.getSpotDetail('private-spot');

    expect(response.data).toMatchObject({
      id: 'private-spot',
      isPublic: false,
      createdAt: '2026-03-28T00:00:00Z',
      rating: 4.5,
      photos: [],
      reviews: [],
    });
  });

  it('enriches production starter spot detail galleries returned by the API', async () => {
    const starterId = '90000000-0000-0000-0000-000000000008';
    const primaryPhotoUrl = 'https://images.pexels.com/photos/13352638/pexels-photo-13352638.jpeg?auto=compress&cs=tinysrgb&w=1600';
    apiMock.get
      .mockResolvedValueOnce({
        data: {
          data: {
            id: starterId,
            title: 'Big Bend Window Trail',
            description: 'A desert trail with a framed canyon payoff.',
            latitude: 29.2707,
            longitude: -103.3013,
            city: 'Big Bend National Park',
            country: 'US',
            category: 'adventure',
            rating: 4.9,
            photoUrl: primaryPhotoUrl,
            createdAt: '2026-04-02T17:45:00Z',
            photos: [
              {
                id: `${starterId}-photo-1`,
                url: primaryPhotoUrl,
                caption: 'Big Bend Window Trail starter showcase photo.',
              },
            ],
            reviews: [],
          },
        },
      })
      .mockRejectedValueOnce(new Error('photo endpoint unavailable'));

    const spotService = await import('@/services/spotService');
    const response = await spotService.getSpotDetail(starterId);

    expect(response.data.photos).toHaveLength(5);
    expect(response.data.photos.map((photo) => photo.caption)).toContain('Canyon approach before the Window view');
    expect(apiMock.get).toHaveBeenNthCalledWith(1, `/api/content/spots/${starterId}`);
    expect(apiMock.get).toHaveBeenNthCalledWith(2, `/api/content/spots/${starterId}/photos`);
  });

  it('preserves private visibility after create when the API returns the compact create shape', async () => {
    apiMock.post.mockResolvedValue({
      data: {
        data: {
          id: 'created-private-spot',
          title: 'Private Draft',
          latitude: 32.7555,
          longitude: -97.3308,
          category: 'food',
          rating: 4.5,
          createdAt: '2026-03-28T00:00:00Z',
        },
      },
    });

    const spotService = await import('@/services/spotService');
    const response = await spotService.createSpot({
      spot: {
        title: 'Private Draft',
        description: 'Keep this one hidden',
        latitude: 32.7555,
        longitude: -97.3308,
        address: '',
        city: 'Fort Worth',
        country: 'US',
        category: 'food',
        pillars: ['hidden-gem'],
        vibe: 'quiet',
        rating: 4.5,
        visitedAt: '2026-03-28',
        isPublic: false,
      },
      existingPhotos: [],
      newPhotos: [
        {
          file: new File(['private-photo'], 'private.jpg', { type: 'image/jpeg' }),
          caption: '  Quiet corner  ',
        },
      ],
    });

    expect(apiMock.post).toHaveBeenCalledWith('/api/content/spots/compose', expect.any(FormData));
    const formData = apiMock.post.mock.calls[0]?.[1] as FormData;
    expect(JSON.parse(String(formData.get('spot')))).toMatchObject({ isPublic: false, pillars: ['hidden-gem'] });
    expect(formData.get('photos')).toMatchObject({ name: 'private.jpg', type: 'image/jpeg' });
    expect(formData.get('captions')).toBe('Quiet corner');
    expect(formData.get('sortOrders')).toBe('0');
    expect(response.data.isPublic).toBe(false);
  });

  it('falls back to seeded spot discovery and nearby pins when content APIs are unavailable', async () => {
    vi.stubEnv('VITE_ENABLE_SPOT_MOCK_FALLBACK', 'true');
    apiMock.get.mockRejectedValue(new Error('content API unavailable'));

    const spotService = await import('@/services/spotService');
    const { mockSpots } = await import('@/services/mockData');
    const { rankTrendingSpots } = await import('@/utils/spotRanking');

    const listResponse = await spotService.listSpots({ page: 1, pageSize: 3, city: ' Fort Worth ' });
    const exploreResponse = await spotService.exploreSpots({ page: 1, pageSize: 2, vibe: ' calm ' });
    const nearbyResponse = await spotService.listNearbySpots({
      latitude: 32.7555,
      longitude: -97.3308,
      page: 1,
      pageSize: 4,
    });

    expect(apiMock.get).toHaveBeenNthCalledWith(1, '/api/content/spots/', {
      params: expect.objectContaining({ city: 'Fort Worth', page: 1, pageSize: 3 }),
    });
    expect(apiMock.get).toHaveBeenNthCalledWith(2, '/api/content/spots/explore', {
      params: expect.objectContaining({ vibe: 'calm', page: 1, pageSize: 2 }),
    });
    expect(apiMock.get).toHaveBeenNthCalledWith(3, '/api/content/spots/nearby', {
      params: expect.objectContaining({ lat: 32.7555, lng: -97.3308, radius: 25 }),
    });
    expect(listResponse.data.map((spot) => spot.id)).toEqual(
      rankTrendingSpots(mockSpots.filter((spot) => spot.city === 'Fort Worth')).slice(0, 3).map((spot) => spot.id),
    );
    expect(exploreResponse.data.every((spot) => spot.vibe === 'calm')).toBe(true);
    expect(nearbyResponse.data[0]).toMatchObject({ id: 'spot-1', title: 'Sunset Rooftop Tacos' });
  });

  it('loads user and saved spot collections from live APIs and local fallbacks', async () => {
    vi.stubEnv('VITE_ENABLE_SPOT_MOCK_FALLBACK', 'true');
    const liveSpot = {
      id: 'live-user-spot',
      title: 'Live Profile Pin',
      latitude: 32.7555,
      longitude: -97.3308,
      category: 'food',
      rating: 4.2,
      createdAt: '2026-05-01T00:00:00Z',
      author: { id: 'user-live', username: 'live', email: 'live@example.com', displayName: 'Live User' },
      liked: true,
    };
    apiMock.get
      .mockResolvedValueOnce({ data: { data: [liveSpot], meta: { page: 2, pageSize: 5, total: 6, totalPages: 2 } } })
      .mockResolvedValueOnce({ data: { data: [liveSpot], meta: { page: 1, pageSize: 2, total: 1, totalPages: 1 } } })
      .mockRejectedValue(new Error('content API unavailable'));

    const spotService = await import('@/services/spotService');

    await expect(spotService.listUserSpots('user-live', 2, 5)).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'live-user-spot' })],
      meta: { page: 2, pageSize: 5, total: 6, totalPages: 2 },
    });
    await expect(spotService.listSavedSpots(1, 2)).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'live-user-spot', liked: true })],
    });

    const fallbackUserSpots = await spotService.listUserSpots('user-1', 1, 0);
    const fallbackSavedSpots = await spotService.listSavedSpots(1, 0);

    expect(fallbackUserSpots.data.every((spot) => spot.author?.id === 'user-1')).toBe(true);
    expect(fallbackUserSpots.data.length).toBeGreaterThan(0);
    expect(fallbackSavedSpots.data.every((spot) => spot.liked)).toBe(true);
    expect(fallbackSavedSpots.data.length).toBeGreaterThan(0);
  });

  it('uses local spot detail, like, unlike, and photo fallbacks without masking missing pins', async () => {
    vi.stubEnv('VITE_ENABLE_SPOT_MOCK_FALLBACK', 'true');
    vi.stubEnv('VITE_ENABLE_SPOT_LOCAL_WRITE_FALLBACK', 'true');
    apiMock.get.mockRejectedValue(new Error('content API unavailable'));
    apiMock.post.mockRejectedValue(new Error('content API unavailable'));
    apiMock.delete.mockRejectedValue(new Error('content API unavailable'));

    const spotService = await import('@/services/spotService');

    await expect(spotService.getSpotDetail('spot-1')).resolves.toMatchObject({
      data: {
        id: 'spot-1',
        photos: expect.arrayContaining([expect.objectContaining({ caption: 'Rooftop taco spread at sunset' })]),
      },
    });
    await expect(spotService.likeSpot('spot-2')).resolves.toMatchObject({
      data: { id: 'spot-2', liked: true, likesCount: 89 },
    });
    await expect(spotService.unlikeSpot('spot-1')).resolves.toMatchObject({
      data: { id: 'spot-1', liked: false, likesCount: 141 },
    });
    await expect(spotService.listSpotPhotos('spot-1')).resolves.toMatchObject({
      data: expect.arrayContaining([expect.objectContaining({ caption: 'Rooftop taco spread at sunset' })]),
    });

    await expect(spotService.getSpotDetail('missing-spot')).rejects.toThrow('Spot missing-spot not found');
    await expect(spotService.likeSpot('missing-spot')).rejects.toThrow('Spot missing-spot not found');
    await expect(spotService.unlikeSpot('missing-spot')).rejects.toThrow('Spot missing-spot not found');
    await expect(spotService.listSpotPhotos('missing-spot')).rejects.toThrow('Spot missing-spot not found');
  });

  it('does not hide live spot read or social failures when mock fallbacks are disabled', async () => {
    vi.stubEnv('VITE_ENABLE_SPOT_MOCK_FALLBACK', 'false');
    vi.stubEnv('VITE_ENABLE_SPOT_LOCAL_WRITE_FALLBACK', 'false');
    apiMock.get.mockRejectedValue(new Error('content API unavailable'));
    apiMock.post.mockRejectedValue(new Error('write API unavailable'));
    apiMock.delete.mockRejectedValue(new Error('write API unavailable'));

    const spotService = await import('@/services/spotService');

    await expect(spotService.listSpots({ page: 1, pageSize: 3 })).rejects.toThrow('content API unavailable');
    await expect(spotService.exploreSpots({ page: 1, pageSize: 3 })).rejects.toThrow('content API unavailable');
    await expect(spotService.listNearbySpots({ latitude: 32.7555, longitude: -97.3308 })).rejects.toThrow(
      'content API unavailable',
    );
    await expect(spotService.listUserSpots('user-1')).rejects.toThrow('content API unavailable');
    await expect(spotService.listSavedSpots()).rejects.toThrow('content API unavailable');
    await expect(spotService.getSpotDetail('spot-1')).rejects.toThrow('content API unavailable');
    await expect(spotService.listSpotPhotos('spot-1')).rejects.toThrow('content API unavailable');
    await expect(spotService.likeSpot('spot-1')).rejects.toThrow('write API unavailable');
    await expect(spotService.unlikeSpot('spot-1')).rejects.toThrow('write API unavailable');
  });

  it('keeps spot write fallbacks explicit for local preview mode', async () => {
    vi.stubEnv('VITE_ENABLE_SPOT_LOCAL_WRITE_FALLBACK', 'true');
    apiMock.post.mockRejectedValue(new Error('write API unavailable'));
    apiMock.put.mockRejectedValue(new Error('write API unavailable'));
    apiMock.delete.mockRejectedValue(new Error('write API unavailable'));

    const spotService = await import('@/services/spotService');
    const currentUser = {
      id: 'user-1',
      username: 'scope-user',
      email: '',
      displayName: 'Local preview user',
    };
    const submission = {
      spot: {
        title: 'Local Preview Patio',
        description: 'A preview-only patio pin for offline compose flows.',
        latitude: 32.7555,
        longitude: -97.3308,
        address: '401 Houston St',
        city: 'Fort Worth',
        country: 'United States',
        category: 'food' as const,
        vibe: 'electric',
        rating: 4.8,
        visitedAt: '2026-05-01',
        isPublic: true,
      },
      existingPhotos: [],
      newPhotos: [],
    };

    const created = await spotService.createSpot(submission, currentUser);
    const updated = await spotService.updateSpot(created.data.id, {
      ...submission,
      spot: {
        ...submission.spot,
        title: 'Updated Local Preview Patio',
        rating: 4.9,
      },
    }, currentUser);
    await spotService.deleteSpot(created.data.id);

    expect(created.data).toMatchObject({
      title: 'Local Preview Patio',
      author: expect.objectContaining({ id: 'user-1' }),
    });
    expect(updated.data).toMatchObject({
      id: created.data.id,
      title: 'Updated Local Preview Patio',
      rating: 4.9,
    });
  });

  it('does not hide spot write failures when local preview write fallback is disabled', async () => {
    vi.stubEnv('VITE_ENABLE_SPOT_LOCAL_WRITE_FALLBACK', 'false');
    const writeError = new Error('write API unavailable');
    apiMock.post.mockRejectedValue(writeError);
    apiMock.put.mockRejectedValue(writeError);
    apiMock.delete.mockRejectedValue(writeError);

    const spotService = await import('@/services/spotService');
    const submission = {
      spot: {
        title: 'No Fallback Patio',
        description: 'This should stay live-only.',
        latitude: 32.7555,
        longitude: -97.3308,
        address: '401 Houston St',
        city: 'Fort Worth',
        country: 'United States',
        category: 'food' as const,
        vibe: 'electric',
        rating: 4.8,
        visitedAt: '2026-05-01',
        isPublic: true,
      },
      existingPhotos: [],
      newPhotos: [],
    };

    await expect(spotService.createSpot(submission)).rejects.toThrow('write API unavailable');
    await expect(spotService.updateSpot('spot-live-only', submission)).rejects.toThrow('write API unavailable');
    await expect(spotService.deleteSpot('spot-live-only')).rejects.toThrow('write API unavailable');
  });

  it('uses live spot verification and photo upload contracts', async () => {
    apiMock.post
      .mockResolvedValueOnce({
        data: {
          data: {
            verified: true,
            source: 'google-places',
            providerPlaceId: 'places/abc',
            providerPlaceName: 'Kimbell Art Museum',
            providerPlaceAddress: '3333 Camp Bowie Boulevard, Fort Worth, Texas',
            distanceMeters: 24,
            precision: 'rooftop',
            candidates: [
              {
                source: 'google-places',
                providerPlaceId: 'places/abc',
                providerPlaceName: 'Kimbell Art Museum',
                providerPlaceAddress: '3333 Camp Bowie Boulevard, Fort Worth, Texas',
                distanceMeters: 24,
                precision: 'rooftop',
              },
            ],
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            id: 'photo-live-1',
            url: 'https://images.example.com/kimbell.jpg',
            caption: 'Gallery entrance',
            sortOrder: 2,
          },
        },
      });

    const spotService = await import('@/services/spotService');
    const verified = await spotService.verifySpotPlace({
      title: '  Kimbell Art Museum  ',
      address: '3333 Camp Bowie Boulevard',
      city: 'Fort Worth',
      country: 'US',
      postalCode: '',
      latitude: 32.748,
      longitude: -97.365,
      providerPlaceId: ' places/abc ',
    });

    expect(apiMock.post).toHaveBeenNthCalledWith(1, '/api/intel/place/verify', {
      title: 'Kimbell Art Museum',
      address: '3333 Camp Bowie Boulevard',
      city: 'Fort Worth',
      country: 'US',
      postalCode: '',
      latitude: 32.748,
      longitude: -97.365,
      providerPlaceId: 'places/abc',
    });
    expect(verified).toMatchObject({
      verified: true,
      providerPlaceName: 'Kimbell Art Museum',
      candidates: [expect.objectContaining({ providerPlaceId: 'places/abc' })],
    });

    const file = new File(['image-bytes'], 'kimbell.jpg', { type: 'image/jpeg' });
    const uploaded = await spotService.uploadSpotPhoto('spot-live-1', {
      file,
      caption: ' Gallery entrance ',
    }, 2);
    const uploadFormData = apiMock.post.mock.calls[1]?.[1] as FormData;

    expect(apiMock.post.mock.calls[1]?.[0]).toBe('/api/content/photos/upload');
    expect(uploadFormData.get('spot_id')).toBe('spot-live-1');
    expect(uploadFormData.get('file')).toMatchObject({ name: 'kimbell.jpg', type: 'image/jpeg' });
    expect(uploadFormData.get('caption')).toBe('Gallery entrance');
    expect(uploadFormData.get('sort_order')).toBe('2');
    expect(uploaded.data).toMatchObject({
      id: 'photo-live-1',
      url: 'https://images.example.com/kimbell.jpg',
      caption: 'Gallery entrance',
    });
  });

  it('updates live spots, uploads appended photos, and refreshes the detail payload', async () => {
    const updatedSpot = {
      id: 'spot-live-update',
      title: 'Museum Evening',
      description: 'Updated private museum stop',
      latitude: 32.748,
      longitude: -97.365,
      address: '3333 Camp Bowie Boulevard',
      city: 'Fort Worth',
      country: 'US',
      category: 'culture',
      pillars: ['hidden-gem'],
      vibe: 'quiet',
      rating: 4.7,
      isPublic: false,
      photos: [
        { id: 'photo-old', url: 'https://images.example.com/old.jpg', caption: 'Old view', sortOrder: 0 },
        { id: 'photo-new', url: 'https://images.example.com/new.jpg', caption: 'New view', sortOrder: 1 },
      ],
      reviews: [],
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-02T00:00:00Z',
    };
    apiMock.put.mockResolvedValueOnce({ data: { data: { ...updatedSpot, photos: [] } } });
    apiMock.post.mockResolvedValueOnce({
      data: {
        data: { id: 'photo-new', url: 'https://images.example.com/new.jpg', caption: 'New view', sortOrder: 1 },
      },
    });
    apiMock.get.mockResolvedValueOnce({ data: { data: updatedSpot } });

    const spotService = await import('@/services/spotService');
    const file = new File(['photo'], 'museum.jpg', { type: 'image/jpeg' });
    const response = await spotService.updateSpot('spot-live-update', {
      spot: {
        title: ' Museum Evening ',
        description: 'Updated private museum stop',
        latitude: 32.748,
        longitude: -97.365,
        address: '3333 Camp Bowie Boulevard',
        city: 'Fort Worth',
        country: 'US',
        category: 'culture',
        pillars: ['hidden-gem'],
        vibe: 'quiet',
        rating: 4.7,
        visitedAt: '2026-05-02',
        isPublic: false,
      },
      existingPhotos: [
        { id: 'photo-old', url: 'https://images.example.com/old.jpg', caption: 'Old view', sortOrder: 0 },
      ],
      newPhotos: [{ file, caption: ' New view ' }],
    });

    expect(apiMock.put).toHaveBeenCalledWith('/api/content/spots/spot-live-update', expect.objectContaining({
      title: 'Museum Evening',
      isPublic: false,
      pillars: ['hidden-gem'],
    }));
    const photoFormData = apiMock.post.mock.calls[0]?.[1] as FormData;
    expect(apiMock.post.mock.calls[0]?.[0]).toBe('/api/content/photos/upload');
    expect(photoFormData.get('spot_id')).toBe('spot-live-update');
    expect(photoFormData.get('sort_order')).toBe('1');
    expect(apiMock.get).toHaveBeenCalledWith('/api/content/spots/spot-live-update');
    expect(response.data).toMatchObject({
      id: 'spot-live-update',
      title: 'Museum Evening',
      isPublic: false,
    });
    expect(response.data.photos.map((photo) => photo.id)).toEqual(['photo-old', 'photo-new']);
  });

  it('uses live spot like, unlike, photo list, and delete endpoints', async () => {
    const spot = {
      id: 'spot-live-social',
      title: 'Coffee Patio',
      latitude: 32.7555,
      longitude: -97.3308,
      category: 'food',
      rating: 4.4,
      photos: [],
      reviews: [],
      createdAt: '2026-05-01T00:00:00Z',
    };
    apiMock.post.mockResolvedValueOnce({ data: { data: { ...spot, liked: true, likesCount: 9 } } });
    apiMock.delete
      .mockResolvedValueOnce({ data: { data: { ...spot, liked: false, likesCount: 8 } } })
      .mockResolvedValueOnce({ data: { data: { ok: true } } });
    apiMock.get.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'photo-live-social', url: 'https://images.example.com/social.jpg', caption: 'Patio', sortOrder: 0 },
        ],
      },
    });

    const spotService = await import('@/services/spotService');

    await expect(spotService.likeSpot(spot.id)).resolves.toMatchObject({
      data: { liked: true, likesCount: 9 },
    });
    expect(apiMock.post).toHaveBeenLastCalledWith('/api/content/spots/spot-live-social/like', undefined);

    await expect(spotService.unlikeSpot(spot.id)).resolves.toMatchObject({
      data: { liked: false, likesCount: 8 },
    });
    expect(apiMock.delete).toHaveBeenNthCalledWith(1, '/api/content/spots/spot-live-social/like');

    await expect(spotService.listSpotPhotos(spot.id)).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'photo-live-social', caption: 'Patio' })],
    });
    expect(apiMock.get).toHaveBeenLastCalledWith('/api/content/spots/spot-live-social/photos');

    await spotService.deleteSpot(spot.id);
    expect(apiMock.delete).toHaveBeenLastCalledWith('/api/content/spots/spot-live-social');
  });

  it('keeps empty initial activity feed API responses empty when mock fallback is disabled', async () => {
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
    const response = await feedService.getFeed(1, 3);

    expect(response.data).toEqual([]);
    expect(response.meta).toMatchObject({
      page: 1,
      pageSize: 3,
      total: 0,
    });
  });

  it('keeps empty trip API responses empty in production mode', async () => {
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
    const response = await tripService.listTrips(1, 2);

    expect(apiMock.get).toHaveBeenCalledWith('/api/content/trips/', {
      params: { page: 1, pageSize: 2 },
    });
    expect(response.data).toEqual([]);
    expect(response.meta).toMatchObject({
      page: 1,
      pageSize: 2,
      total: 0,
    });
  });

  it('hydrates trip lists from mocks only when the trip mock fallback flag is enabled', async () => {
    vi.stubEnv('VITE_ENABLE_TRIP_MOCK_FALLBACK', 'true');
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

  it('hydrates public trip lists from mocks only when the trip mock fallback flag is enabled', async () => {
    vi.stubEnv('VITE_ENABLE_TRIP_MOCK_FALLBACK', 'true');
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

    const tripService = await import('@/services/tripService');
    const { mockTrips } = await import('@/services/mockData');
    const response = await tripService.listPublicTrips(1, 3, ' user-1 ');
    const publicMockIds = mockTrips.filter((trip) => trip.isPublic).slice(0, 3).map((trip) => trip.id);

    expect(apiMock.get).toHaveBeenCalledWith('/api/content/trips/public', {
      params: { page: 1, pageSize: 3, userId: 'user-1' },
    });
    expect(response.data.map((trip) => trip.id)).toEqual(publicMockIds);
    expect(response.data.every((trip) => trip.isPublic)).toBe(true);
  });

  it('sends sanitized trip create payloads with API spot/member contracts', async () => {
    apiMock.post.mockResolvedValue({
      data: {
        data: {
          trip: {
            id: 'trip-live-created',
            title: 'Live Route',
            destination: 'Austin, TX',
            description: 'Created by the planner.',
            isPublic: false,
            startDate: '2026-05-09',
            endDate: '2026-05-10',
            spots: [],
            members: [],
            currency: 'USD',
            status: 'planning',
            createdAt: '2026-05-01T00:00:00Z',
            updatedAt: '2026-05-01T00:00:00Z',
          },
        },
      },
    });

    const tripService = await import('@/services/tripService');
    const response = await tripService.createTrip({
      title: '  Live Route  ',
      destination: ' Austin, TX ',
      description: 'Created by the planner.\n\n',
      isPublic: false,
      startDate: '2026-05-09',
      endDate: '2026-05-10',
      budget: 1200,
      currency: 'usd',
      status: 'planning',
      coverImageUrl: 'https://images.example.com/cover.jpg',
      spots: [
        {
          spotId: 'spot-1',
          title: '  Breakfast Tacos  ',
          latitude: 30.2672,
          longitude: -97.7431,
          category: 'food',
          city: 'Austin',
          dayNumber: 2,
          notes: 'Start early',
        },
      ],
      members: [
        { id: 'owner-1', displayName: 'Owner User', status: 'owner' },
        { id: 'editor-1', displayName: 'Editor User', status: 'editor' },
        { id: 'viewer-1', displayName: 'Viewer User', status: 'viewer' },
      ],
    });

    expect(apiMock.post).toHaveBeenCalledWith('/api/content/trips/', {
      title: 'Live Route',
      destination: 'Austin, TX',
      description: 'Created by the planner.',
      is_public: false,
      start_date: '2026-05-09',
      end_date: '2026-05-10',
      budget: 1200,
      currency: 'USD',
      status: 'planning',
      cover_photo_url: 'https://images.example.com/cover.jpg',
      spots: [
        {
          spot_id: 'spot-1',
          title: 'Breakfast Tacos',
          latitude: 30.2672,
          longitude: -97.7431,
          category: 'food',
          city: 'Austin',
          day_number: 2,
          sort_order: 0,
          notes: 'Start early',
        },
      ],
      members: [
        { user_id: 'editor-1', role: 'editor' },
        { user_id: 'viewer-1', role: 'viewer' },
      ],
    });
    expect(response.data).toMatchObject({
      id: 'trip-live-created',
      title: 'Live Route',
      destination: 'Austin, TX',
    });
  });

  it('uses live trip APIs for detail, collaboration, share, spot, and delete workflows', async () => {
    const liveTrip = {
      id: 'trip-live-workflow',
      title: 'Live Workflow',
      destination: 'Fort Worth, TX',
      description: 'Production trip workflow.',
      isPublic: true,
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      spots: [
        {
          spotId: 'spot-a',
          title: 'Coffee Stop',
          latitude: 32.7555,
          longitude: -97.3308,
          category: 'food',
          city: 'Fort Worth',
        },
      ],
      members: [
        { id: 'owner-1', displayName: 'Owner User', status: 'owner' },
        { id: 'viewer-1', displayName: 'Viewer User', status: 'viewer' },
      ],
      currency: 'USD',
      status: 'planning',
      createdAt: '2026-05-01T00:00:00Z',
      updatedAt: '2026-05-02T00:00:00Z',
    };
    const mutationInput = {
      title: 'Live Workflow',
      destination: 'Fort Worth, TX',
      description: 'Production trip workflow.',
      isPublic: true,
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      budget: 800,
      currency: 'USD',
      status: 'planning' as const,
      spots: liveTrip.spots,
      members: liveTrip.members,
    };

    const tripService = await import('@/services/tripService');

    apiMock.get.mockResolvedValueOnce({ data: { data: liveTrip } });
    await expect(tripService.getTripDetail(liveTrip.id)).resolves.toMatchObject({
      data: { id: liveTrip.id },
    });
    expect(apiMock.get).toHaveBeenLastCalledWith('/api/content/trips/trip-live-workflow');

    apiMock.put.mockResolvedValueOnce({ data: { data: liveTrip } });
    await expect(tripService.updateTrip(liveTrip.id, mutationInput)).resolves.toMatchObject({
      data: { id: liveTrip.id },
    });
    expect(apiMock.put).toHaveBeenLastCalledWith(
      '/api/content/trips/trip-live-workflow',
      expect.objectContaining({ is_public: true }),
    );

    apiMock.post.mockResolvedValueOnce({ data: { data: liveTrip } });
    await expect(tripService.addTripSpot(liveTrip.id, {
      spotId: 'spot-b',
      title: 'Museum Stop',
      latitude: 32.748,
      longitude: -97.369,
      category: 'culture',
      city: 'Fort Worth',
      dayNumber: 1,
    })).resolves.toMatchObject({ data: { id: liveTrip.id } });
    expect(apiMock.post).toHaveBeenLastCalledWith(
      '/api/content/trips/trip-live-workflow/spots',
      expect.objectContaining({
        spot_id: 'spot-b',
        sort_order: 0,
      }),
    );

    apiMock.delete.mockResolvedValueOnce({ data: { data: { trip: liveTrip } } });
    await expect(tripService.removeTripSpot(liveTrip.id, 'spot-b')).resolves.toMatchObject({
      data: { id: liveTrip.id },
    });
    expect(apiMock.delete).toHaveBeenLastCalledWith('/api/content/trips/trip-live-workflow/spots/spot-b');

    apiMock.put.mockResolvedValueOnce({ data: { data: liveTrip } });
    await expect(tripService.reorderTripSpots(liveTrip.id, {
      orderedSpotIds: ['spot-b', 'spot-a'],
    })).resolves.toMatchObject({ data: { id: liveTrip.id } });
    expect(apiMock.put).toHaveBeenLastCalledWith('/api/content/trips/trip-live-workflow/spots/reorder', {
      spots: [
        { spotId: 'spot-b', sortOrder: 0 },
        { spotId: 'spot-a', sortOrder: 1 },
      ],
    });

    apiMock.get.mockResolvedValueOnce({ data: { data: liveTrip.members } });
    const members = await tripService.getTripMembers(liveTrip.id);
    expect(members.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'owner-1' })]),
    );
    expect(apiMock.get).toHaveBeenLastCalledWith('/api/content/trips/trip-live-workflow/members');

    apiMock.post.mockResolvedValueOnce({ data: { data: { ok: true } } });
    apiMock.get.mockResolvedValueOnce({ data: { data: liveTrip } });
    await expect(tripService.inviteTripMember(liveTrip.id, {
      recipient: '123e4567-e89b-12d3-a456-426614174000',
      role: 'editor',
    })).resolves.toMatchObject({ data: { id: liveTrip.id } });
    expect(apiMock.post).toHaveBeenLastCalledWith('/api/content/trips/trip-live-workflow/members', {
      user_id: '123e4567-e89b-12d3-a456-426614174000',
      role: 'editor',
    });

    const invitedUserId = '123e4567-e89b-42d3-a456-426614174000';
    const invitedDisplayName = 'Scope Live Epsilon Nonfriend';
    apiMock.get.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: invitedUserId,
            username: 'scope-live-epsilon',
            email: 'scope-live-e@example.com',
            displayName: invitedDisplayName,
            interests: [],
          },
        ],
      },
    });
    apiMock.post.mockResolvedValueOnce({ data: { data: { ok: true } } });
    apiMock.get.mockResolvedValueOnce({
      data: {
        data: {
          ...liveTrip,
          members: [
            ...liveTrip.members,
            {
              user_id: invitedUserId,
              role: 'viewer',
              status: 'viewer',
              displayName: `Traveler ${invitedUserId.slice(0, 8)}`,
            },
          ],
        },
      },
    });
    const invited = await tripService.inviteTripMember(liveTrip.id, {
      recipient: 'scope-live-e@example.com',
      role: 'viewer',
    });
    expect(apiMock.get).toHaveBeenCalledWith('/api/core/users/search', {
      params: { q: 'scope-live-e@example.com', page: 1, pageSize: 10 },
    });
    expect(apiMock.post).toHaveBeenLastCalledWith('/api/content/trips/trip-live-workflow/members', {
      user_id: invitedUserId,
      role: 'viewer',
    });
    expect(invited.data.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: invitedUserId, displayName: invitedDisplayName, status: 'viewer' }),
      ]),
    );

    apiMock.post.mockResolvedValueOnce({ data: { data: { ok: true } } });
    apiMock.get.mockResolvedValueOnce({ data: { data: liveTrip } });
    await expect(tripService.updateTripMemberRole(liveTrip.id, 'viewer-1', 'editor')).resolves.toMatchObject({
      data: { id: liveTrip.id },
    });
    expect(apiMock.post).toHaveBeenLastCalledWith('/api/content/trips/trip-live-workflow/members', {
      user_id: 'viewer-1',
      role: 'editor',
    });

    apiMock.post.mockResolvedValueOnce({ data: { data: { token: 'share-token-1' } } });
    await expect(tripService.createTripShareLink(liveTrip.id)).resolves.toMatchObject({
      token: 'share-token-1',
      path: '/trips/shared/share-token-1',
      url: 'http://localhost:3000/trips/shared/share-token-1',
    });
    expect(apiMock.post).toHaveBeenLastCalledWith('/api/content/trips/trip-live-workflow/share');

    apiMock.get.mockResolvedValueOnce({ data: { data: liveTrip } });
    await expect(tripService.getTripByShareToken('share-token-1')).resolves.toMatchObject({
      data: { id: liveTrip.id },
    });
    expect(apiMock.get).toHaveBeenLastCalledWith('/api/content/trips/share/share-token-1');

    apiMock.delete.mockResolvedValueOnce({ data: { data: { ok: true } } });
    await tripService.deleteTrip(liveTrip.id);
    expect(apiMock.delete).toHaveBeenLastCalledWith('/api/content/trips/trip-live-workflow');
  });

  it('rejects trip draft writes when the production trip API is unavailable', async () => {
    const unavailableError = Object.assign(new Error('trip API unavailable'), {
      name: 'ApiClientError',
      status: 500,
      isNetworkError: false,
    });
    apiMock.post.mockRejectedValue(unavailableError);

    const tripService = await import('@/services/tripService');

    await expect(tripService.createTrip({
      title: 'Autosaved route draft',
      destination: 'Dallas, TX to Austin, TX',
      description: 'Local autosave fallback.',
      isPublic: false,
      startDate: '2026-05-09',
      endDate: '2026-05-10',
      budget: 900,
      currency: 'USD',
      status: 'planning',
      spots: [],
      members: [{ id: 'user-1', displayName: 'Louis Do', status: 'owner' }],
    })).rejects.toBe(unavailableError);

    expect(apiMock.post).toHaveBeenCalled();
    expect(localStorage.getItem('scope.trips.v1')).toBeNull();
  });

  it('keeps autosaved trip drafts local only when the write fallback flag is enabled', async () => {
    vi.stubEnv('VITE_ENABLE_TRIP_LOCAL_WRITE_FALLBACK', 'true');
    const unavailableError = Object.assign(new Error('trip API unavailable'), {
      name: 'ApiClientError',
      status: 500,
      isNetworkError: false,
    });
    apiMock.post.mockRejectedValue(unavailableError);

    const tripService = await import('@/services/tripService');
    const response = await tripService.createTrip({
      title: 'Autosaved route draft',
      destination: 'Dallas, TX to Austin, TX',
      description: 'Local autosave fallback.',
      isPublic: false,
      startDate: '2026-05-09',
      endDate: '2026-05-10',
      budget: 900,
      currency: 'USD',
      status: 'planning',
      spots: [
        {
          spotId: 'draft-stop-1',
          title: 'Bishop Arts Dinner',
          latitude: 32.7493,
          longitude: -96.8284,
          category: 'food',
          city: 'Dallas',
          estimatedCost: 42,
        },
      ],
      members: [{ id: 'user-1', displayName: 'Louis Do', status: 'owner' }],
    });

    expect(apiMock.post).toHaveBeenCalled();
    expect(response.data.id).toMatch(/^local-trip-/);
    expect(response.data.title).toBe('Autosaved route draft');
    expect(response.data.itinerary?.days[0]?.spots[0]).toMatchObject({
      spotId: 'draft-stop-1',
      timeSlot: '09:00',
    });
    expect(response.data.itinerary?.totalEstimatedCost).toBe(42);
    expect(JSON.parse(localStorage.getItem('scope.trips.v1') ?? '[]')).toHaveLength(1);
  });

  it('supports demo trip spot, member, share, and delete workflows locally', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true');

    const tripService = await import('@/services/tripService');
    const { mockTrips } = await import('@/services/mockData');
    const trip = mockTrips.find((candidate) => candidate.spots.length >= 2) ?? mockTrips[0];
    const addedSpot = {
      spotId: 'demo-added-stop',
      title: 'Late Night Coffee',
      latitude: 32.7555,
      longitude: -97.3308,
      category: 'food',
      city: 'Fort Worth',
      estimatedCost: 18,
    };

    const added = await tripService.addTripSpot(trip.id, addedSpot);
    expect(added.data.spots.some((spot) => spot.spotId === 'demo-added-stop')).toBe(true);

    const reordered = await tripService.reorderTripSpots(trip.id, {
      orderedSpotIds: [
        'demo-added-stop',
        ...trip.spots.map((spot) => spot.spotId),
      ],
    });
    expect(reordered.data.spots[0]?.spotId).toBe('demo-added-stop');

    const removed = await tripService.removeTripSpot(trip.id, 'demo-added-stop');
    expect(removed.data.spots.some((spot) => spot.spotId === 'demo-added-stop')).toBe(false);

    const members = await tripService.getTripMembers(trip.id);
    expect(members.data.length).toBeGreaterThan(0);

    const invited = await tripService.inviteTripMember(trip.id, {
      recipient: 'new.traveler@example.com',
      role: 'viewer',
      message: 'Join this route.',
    });
    const pendingMember = invited.data.members.find((member) => member.inviteStatus === 'pending');
    expect(pendingMember).toMatchObject({
      displayName: 'New Traveler',
      status: 'viewer',
      presence: 'offline',
    });

    const roleUpdated = await tripService.updateTripMemberRole(trip.id, pendingMember!.id, 'editor');
    expect(roleUpdated.data.members.find((member) => member.id === pendingMember!.id)?.status).toBe('editor');
    await expect(tripService.updateTripMemberRole(trip.id, 'missing-member', 'viewer')).rejects.toThrow(
      'That traveler was not found or cannot be changed.',
    );

    const shareLink = await tripService.createTripShareLink(trip.id);
    const shared = await tripService.getTripByShareToken(shareLink.token);
    expect(shared.data.id).toBe(trip.id);

    await tripService.deleteTrip(trip.id);
    await expect(tripService.getTripDetail(trip.id)).rejects.toThrow(`Trip ${trip.id} not found`);
    expect(apiMock.get).not.toHaveBeenCalled();
    expect(apiMock.post).not.toHaveBeenCalled();
    expect(apiMock.put).not.toHaveBeenCalled();
    expect(apiMock.delete).not.toHaveBeenCalled();
  });

  it('keeps demo trip share links openable outside the owner storage session', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true');

    const tripService = await import('@/services/tripService');
    const { mockTrips } = await import('@/services/mockData');

    const shareLink = await tripService.createTripShareLink(mockTrips[0].id);
    localStorage.clear();
    const response = await tripService.getTripByShareToken(shareLink.token);

    expect(response.data.id).toBe(mockTrips[0].id);
    expect(apiMock.post).not.toHaveBeenCalled();
    expect(apiMock.get).not.toHaveBeenCalled();
  });

  it('tries the intel fuel API and does not fabricate prices on failure when local fuel fallback is disabled', async () => {
    apiMock.get.mockRejectedValue(new Error('intel unavailable'));

    const fuelPriceService = await import('@/services/fuelPriceService');
    const response = await fuelPriceService.getNearbyFuelStations({
      latitude: 32.753521,
      longitude: -97.331527,
      radiusKm: 8,
      fuelType: 'all',
      limit: 4,
    });

    expect(response.configured).toBe(false);
    expect(response.coverage).toContain('Google Places fuel lookup is unavailable');
    expect(response.stations).toEqual([]);
    expect(apiMock.get).toHaveBeenCalledWith('/api/intel/fuel/stations', {
      params: expect.objectContaining({
        fuelType: 'all',
        limit: 4,
        radiusKm: 8,
      }),
    });
  });

  it('loads clicked place photos from the intel Google Places proxy without exposing a browser key', async () => {
    apiMock.get.mockResolvedValue({
      data: {
        data: {
          configured: true,
          coverage: 'Google Places photo coverage for the clicked place when a place photo is available.',
          photoUrl: 'https://lh3.googleusercontent.com/place-photo=s720',
          photoAttribution: "Soulman's BBQ",
          photoAttributionUrl: '//maps.google.com/maps/contrib/123',
          source: 'Google Places',
          license: 'Google Maps Platform',
        },
      },
    });

    const mapService = await import('@/services/mapService');
    const response = await mapService.getPlacePhoto({
      title: "Soulman's BBQ",
      address: '565 West Bedford Euless Road, Hurst, Texas',
      latitude: 32.837,
      longitude: -97.189,
      maxWidthPx: 720,
    });

    expect(response).toMatchObject({
      configured: true,
      photoUrl: 'https://lh3.googleusercontent.com/place-photo=s720',
      photoAttribution: "Soulman's BBQ",
      photoAttributionUrl: 'https://maps.google.com/maps/contrib/123',
      source: 'Google Places',
    });
    expect(apiMock.get).toHaveBeenCalledWith('/api/intel/place-photo', {
      params: expect.objectContaining({
        q: "Soulman's BBQ",
        address: '565 West Bedford Euless Road, Hurst, Texas',
        lat: 32.837,
        lng: -97.189,
        maxWidthPx: 720,
      }),
    });
  });

  it('shares in-flight clicked place photo lookups so hover prefetch and click reuse one response', async () => {
    apiMock.get.mockResolvedValue({
      data: {
        data: {
          configured: true,
          coverage: 'Google Places photo coverage for the clicked place when a place photo is available.',
          photoUrl: 'https://lh3.googleusercontent.com/place-photo=s512',
          photoAttribution: 'Birdville High School',
          source: 'Google Places',
          license: 'Google Maps Platform',
        },
      },
    });

    const mapService = await import('@/services/mapService');
    const options = {
      title: 'Birdville High School',
      address: '9100 Mid Cities Boulevard, North Richland Hills, Texas',
      latitude: 32.861,
      longitude: -97.196,
      maxWidthPx: 512,
    };

    const [prefetched, clicked] = await Promise.all([
      mapService.getPlacePhoto(options),
      mapService.getPlacePhoto({ ...options }),
    ]);

    expect(prefetched.photoUrl).toBe('https://lh3.googleusercontent.com/place-photo=s512');
    expect(clicked.photoUrl).toBe('https://lh3.googleusercontent.com/place-photo=s512');
    expect(apiMock.get).toHaveBeenCalledTimes(1);
  });
});
