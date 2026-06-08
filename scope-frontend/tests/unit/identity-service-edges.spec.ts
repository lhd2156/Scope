import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  default: apiMock,
}));

describe('identity service provider boundaries', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.put.mockReset();
    apiMock.delete.mockReset();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('normalizes sparse friend provider records without test-only service behavior', async () => {
    apiMock.get
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 'connection-by-id',
              presence: 'online',
              cover_photo_url: 'https://images.example.com/cover.jpg',
            },
            {
              user: {
                id: 'friend-user',
                username: 'friend-user',
                email: '',
                displayName: 'Friend User',
                interests: ['nature', 'invalid-category'],
              },
              presence: 'idle',
              sharedTrips: 2,
              mutualFriends: 3,
              favoriteCategories: [],
              lastActiveAt: '2026-06-01T12:00:00.000Z',
            },
            {},
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 'request-by-id',
              user: {
                id: 'request-user',
                username: 'request-user',
                email: '',
                displayName: 'Request User',
              },
              direction: 'incoming',
              createdAt: '2026-06-02T12:00:00.000Z',
            },
            {
              requesterId: 'requester-fallback',
              requestedAt: '2026-06-03T12:00:00.000Z',
              mutualFriends: 4,
            },
            {},
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              user: {
                id: 'suggestion-user',
                username: 'suggestion-user',
                email: '',
                displayName: 'Suggestion User',
                interests: ['culture'],
              },
              sharedInterests: null,
              favoriteCategories: ['food'],
              presence: 'offline',
              reason: 'Nearby traveler',
              score: 'not-a-number',
            },
            { id: 'idle-suggestion', presence: 'hidden' },
            { friendId: 'online-suggestion', presence: 'online' },
            { friendId: 'idle-suggestion', presence: 'idle' },
            {},
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [],
        },
      });

    const friendService = await import('@/services/friendService');

    await expect(friendService.listFriends()).resolves.toMatchObject({
      data: [
        {
          id: 'connection-by-id',
          user: { id: 'connection-by-id', displayName: 'Scope traveler' },
          presence: 'online',
          sharedTrips: 0,
          mutualFriends: 0,
          favoriteCategories: [],
        },
        {
          id: 'friend-friend-user',
          user: { id: 'friend-user' },
          presence: 'idle',
          favoriteCategories: ['nature'],
          lastActiveAt: '2026-06-01T12:00:00.000Z',
        },
        {
          id: 'friend-friend',
          user: { id: 'friend' },
        },
      ],
    });
    await expect(friendService.listPendingFriendRequests()).resolves.toMatchObject({
      data: [
        {
          id: 'request-by-id',
          user: { id: 'request-user' },
          direction: 'incoming',
          createdAt: '2026-06-02T12:00:00.000Z',
          mutualFriends: 0,
        },
        {
          id: 'request-requester-fallback',
          user: { id: 'requester-fallback' },
          direction: 'incoming',
          createdAt: '2026-06-03T12:00:00.000Z',
          mutualFriends: 4,
        },
        {
          id: 'request-request',
          user: { id: 'request' },
        },
      ],
    });
    await expect(friendService.listFriendSuggestions()).resolves.toMatchObject({
      data: [
        {
          id: 'suggestion-user',
          sharedInterests: [],
          favoriteCategories: ['food'],
          presence: 'offline',
          reason: 'Nearby traveler',
          score: undefined,
        },
        { id: 'idle-suggestion', presence: 'hidden' },
        { id: 'online-suggestion', presence: 'online' },
        { id: 'idle-suggestion', presence: 'idle' },
        { id: 'suggestion', user: { id: 'suggestion' } },
      ],
    });

    await friendService.searchFriendCandidates('scope');
    expect(apiMock.get).toHaveBeenLastCalledWith('/api/core/users/search', {
      params: { q: 'scope', page: 1, pageSize: 10 },
    });
  });

  it('keeps friend reads resilient while surfacing friend write failures in tests', async () => {
    const outage = new Error('social API offline');
    apiMock.get.mockRejectedValue(outage);
    apiMock.post.mockRejectedValue(outage);

    const friendService = await import('@/services/friendService');

    await expect(friendService.listFriends()).resolves.toMatchObject({
      data: [],
      meta: { page: 1, pageSize: 50, total: 0, totalPages: 1 },
    });
    await expect(friendService.listPendingFriendRequests()).resolves.toEqual({ data: [], meta: undefined });
    await expect(friendService.listFriendSuggestions()).resolves.toEqual({ data: [], meta: undefined });
    await expect(friendService.sendFriendRequest('user-99')).rejects.toBe(outage);
  });

  it('normalizes sparse live user payloads and preserves profile identity fields', async () => {
    apiMock.get
      .mockResolvedValueOnce({
        data: {
          data: {
            id: 'public-user',
            username: 'public-user',
            displayName: 'Public User',
            profileVisibility: 'public',
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {},
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [],
        },
      });
    apiMock.put.mockResolvedValueOnce({
      data: {
        data: {
          id: 'public-user',
          username: 'public-user',
          displayName: 'Updated User',
          profileVisibility: 'private',
        },
      },
    });

    const userService = await import('@/services/userService');

    await expect(userService.getUserProfile('public-user')).resolves.toMatchObject({
      data: {
        id: 'public-user',
        email: '',
        interests: [],
        showActivityStatus: true,
        profileVisibility: 'public',
      },
    });
    await expect(userService.getUserStats('public-user')).resolves.toEqual({
      data: { spots: 0, trips: 0, friends: 0 },
    });
    await expect(userService.searchUsersLive('scope')).resolves.toMatchObject({ data: [] });
    expect(apiMock.get).toHaveBeenLastCalledWith('/api/core/users/search', {
      params: { q: 'scope', page: 1, pageSize: 10 },
    });
    await expect(userService.updateUserProfile('public-user', {
      displayName: ' Updated User ',
      profileVisibility: 'private',
    })).resolves.toMatchObject({
      data: {
        displayName: 'Updated User',
        profileVisibility: 'private',
      },
    });
  });

  it('uses local user fallback branches without confusing location and display name', async () => {
    vi.stubEnv('VITE_ENABLE_USER_MOCK_FALLBACK', 'true');
    apiMock.get.mockRejectedValue(new Error('profiles offline'));
    apiMock.put.mockRejectedValue(new Error('profiles offline'));
    apiMock.delete.mockRejectedValue(new Error('profiles offline'));

    const userService = await import('@/services/userService');

    await expect(userService.getCurrentUserProfile()).resolves.toMatchObject({
      data: {
        id: 'user-1',
        displayName: 'Scope traveler',
      },
    });

    const { rememberLocalPreviewUser } = await import('@/services/localPreviewUserStorage');
    rememberLocalPreviewUser({
      id: 'local-location-user',
      username: 'location-user',
      email: 'location@example.com',
      displayName: 'Actual Display Name',
      homeBase: 'Dallas, TX',
    });

    await expect(userService.getCurrentUserProfile()).resolves.toMatchObject({
      data: {
        id: 'local-location-user',
        displayName: 'Actual Display Name',
        homeBase: 'Dallas, TX',
      },
    });
    await expect(userService.updateUserProfile('missing-local-user', {
      displayName: 'Missing User',
    })).rejects.toThrow('User missing-local-user not found');
    await expect(userService.searchUsers('scope')).resolves.toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({ id: 'user-1', displayName: 'Scope traveler' }),
      ]),
    });
    await expect(userService.getUserStats('missing-local-user')).resolves.toEqual({
      data: { spots: 0, trips: 0, friends: 0 },
    });
    await expect(userService.deactivateUserProfile('missing-local-user')).resolves.toBeUndefined();
  });

  it('covers defensive user payload and update normalization contracts', async () => {
    const { __userServiceCoverage } = await import('@/services/userService');
    const coverage = __userServiceCoverage!;

    expect(coverage.normalizeProfileVisibility('private')).toBe('private');
    expect(coverage.normalizeProfileVisibility('invalid')).toBe('friends');
    expect(coverage.isUserProfilePayload(null)).toBe(false);
    expect(coverage.isUserProfilePayload({ id: 'user', username: 'name' })).toBe(false);
    expect(() => coverage.unwrapUserProfilePayload({ data: { id: 4 } } as never)).toThrow(
      'Invalid user profile payload',
    );
    expect(coverage.normalizeUserProfilePayload({
      id: 'sparse-user',
      username: 'sparse',
      displayName: 'Sparse User',
      email: 4 as never,
      interests: 'food' as never,
      showActivityStatus: false,
    })).toMatchObject({
      email: '',
      interests: [],
      showActivityStatus: false,
      profileVisibility: 'friends',
    });
    expect(coverage.sanitizeStatsEnvelope({
      data: {
        spots: -2,
        trips: -3,
        friends: -4,
      },
    })).toEqual({
      data: { spots: 0, trips: 0, friends: 0 },
    });
    expect(coverage.sanitizeUpdateInput({
      username: '',
      email: '',
      displayName: '',
      bio: '',
      homeBase: '',
      interests: [' food ', ''],
    })).toEqual({
      interests: ['food'],
    });
  });

  it('covers auth identity normalization and expired refresh-cache pruning', async () => {
    const { __authServiceCoverage } = await import('@/services/authService');
    const coverage = __authServiceCoverage!;

    expect(coverage.slugifyIdentifier('---')).toBe('local-user');
    expect(coverage.titleizeIdentifier(' ... ')).toBe('');
    expect(await coverage.buildLoginFallbackIdentity('')).toEqual({});
    expect(await coverage.buildLoginFallbackIdentity('plain_name')).toMatchObject({
      id: 'local-plain-name',
      username: 'plain-name',
      displayName: 'Plain Name',
    });
    expect(await coverage.buildLoginFallbackIdentity('...')).toMatchObject({
      id: 'local-local-user',
      username: 'local-user',
      displayName: '...',
    });
    expect(await coverage.buildLocalPreviewAuthPayload()).toMatchObject({
      id: 'user-1',
      username: 'scope-user',
    });
    expect(coverage.buildLocalPreviewUserFromRegistration({
      username: ' ',
      displayName: 'Fallback Username',
      email: 'Fallback.Name@example.com',
      password: 'SecurePass123!',
      dateOfBirth: '1996-04-15',
    })).toMatchObject({
      id: 'local-fallback-name',
      username: 'fallback-name',
      displayName: 'Fallback Username',
    });
    expect(coverage.rememberLocalPreviewAuthPayload({
      id: 'display-fallback',
      username: 'display-fallback',
      email: 'display@example.com',
      accessToken: 'access',
      refreshToken: 'refresh',
    })).toMatchObject({
      displayName: 'display-fallback',
    });
    expect(coverage.hasUsableAuthTokens(null)).toBe(false);
    expect(coverage.hasUsableAuthTokens({
      accessToken: ' ',
      refreshToken: 'refresh',
    })).toBe(false);
    expect(coverage.hasUsableAuthTokens({
      accessToken: 'access',
      refreshToken: 'refresh',
    })).toBe(true);

    coverage.recentLiveRefreshSessions.set('expired', {
      payload: {
        id: 'user',
        username: 'user',
        email: 'user@example.com',
        displayName: 'User',
        accessToken: 'access',
        refreshToken: 'refresh',
      },
      expiresAt: 10,
    });
    coverage.recentLiveRefreshSessions.set('fresh', {
      payload: {
        id: 'user',
        username: 'user',
        email: 'user@example.com',
        displayName: 'User',
        accessToken: 'access',
        refreshToken: 'refresh',
      },
      expiresAt: 30,
    });
    coverage.pruneRecentLiveRefreshSessions(20);
    expect(coverage.recentLiveRefreshSessions.has('expired')).toBe(false);
    expect(coverage.recentLiveRefreshSessions.has('fresh')).toBe(true);

    coverage.recentLiveRefreshSessions.set('expired-default', {
      payload: {
        id: 'user',
        username: 'user',
        email: 'user@example.com',
        displayName: 'User',
        accessToken: 'access',
        refreshToken: 'refresh',
      },
      expiresAt: 0,
    });
    coverage.pruneRecentLiveRefreshSessions();
    expect(coverage.recentLiveRefreshSessions.has('expired-default')).toBe(false);

    vi.stubGlobal('crypto', undefined);
    expect(coverage.randomPreviewToken('fallback-token')).toMatch(/^fallback-token-[a-f0-9]+$/);
  });

  it('allows explicitly configured local preview auth in a production-mode build', async () => {
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('VITE_ENABLE_LOCAL_PREVIEW', 'true');
    vi.stubEnv('VITE_LOCAL_PREVIEW_LOGIN_EMAIL', 'preview@scope.test');
    vi.stubEnv('VITE_LOCAL_PREVIEW_LOGIN_PASSWORD', 'PreviewPass123!');

    const authService = await import('@/services/authService');

    await expect(authService.login({
      email: 'preview@scope.test',
      password: 'PreviewPass123!',
    })).resolves.toMatchObject({
      email: 'preview@scope.test',
      accessToken: expect.stringMatching(/^session-access-/),
      refreshToken: expect.stringMatching(/^session-refresh-/),
    });
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('keeps strict auth failures visible and distinguishes preview persistence', async () => {
    const registerError = new Error('registration unavailable');
    apiMock.post.mockRejectedValueOnce(registerError);

    let authService = await import('@/services/authService');
    const registration = {
      firstName: 'Strict',
      lastName: 'User',
      username: 'strict-user',
      email: 'strict@example.com',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
      dateOfBirth: '1996-04-15',
      acceptedTerms: true,
    };

    await expect(authService.register(registration)).rejects.toBe(registerError);

    apiMock.post.mockResolvedValueOnce({
      data: {
        data: {
          id: 'strict-cognito',
          username: 'strict-cognito',
          email: 'strict-cognito@example.com',
          displayName: 'Strict Cognito',
          accessToken: 'strict-access',
          refreshToken: 'strict-refresh',
        },
      },
    });
    await expect(authService.loginWithCognito('strict-token')).resolves.toMatchObject({
      id: 'strict-cognito',
      accessToken: 'strict-access',
    });
    expect(localStorage.getItem('scope.auth.users.v1')).toBeNull();

    vi.resetModules();
    vi.stubEnv('VITE_ENABLE_AUTH_MOCK_FALLBACK', 'true');
    apiMock.post.mockResolvedValueOnce({
      data: {
        data: {
          id: 'preview-persisted-registration',
          username: 'preview-persisted',
          email: 'preview-persisted@example.com',
          displayName: 'Preview Persisted',
          accessToken: 'preview-access',
          refreshToken: 'preview-refresh',
        },
      },
    });
    authService = await import('@/services/authService');
    await expect(authService.register({
      ...registration,
      username: 'preview-persisted',
      email: 'preview-persisted@example.com',
    })).resolves.toMatchObject({
      id: 'preview-persisted-registration',
    });
    expect(localStorage.getItem('scope.auth.users.v1')).toContain('preview-persisted-registration');
  });
});
