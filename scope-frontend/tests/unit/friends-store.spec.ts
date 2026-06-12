import { createPinia, setActivePinia } from 'pinia';

async function bootstrapFriendsStore() {
  setActivePinia(createPinia());
  const { useFriendsStore } = await import('@/stores/friends');
  return useFriendsStore();
}

function buildUser(overrides: Record<string, any> = {}) {
  const id = overrides.id ?? 'user-1';
  return {
    id,
    username: overrides.username ?? id,
    email: overrides.email ?? `${id}@example.com`,
    displayName: overrides.displayName ?? 'Scope Traveler',
    interests: overrides.interests ?? ['food'],
    ...overrides,
  };
}

function buildConnection(overrides: Record<string, any> = {}) {
  const user = overrides.user ?? buildUser({ id: overrides.userId ?? 'friend-user' });
  return {
    id: overrides.id ?? `connection-${user.id}`,
    user,
    presence: overrides.presence ?? 'online',
    sharedTrips: overrides.sharedTrips ?? 1,
    mutualFriends: overrides.mutualFriends ?? 2,
    favoriteCategories: overrides.favoriteCategories ?? ['food'],
    lastActiveAt: overrides.lastActiveAt ?? '2026-05-01T12:00:00Z',
  };
}

function buildRequest(overrides: Record<string, any> = {}) {
  const user = overrides.user ?? buildUser({ id: overrides.userId ?? 'request-user' });
  return {
    id: overrides.id ?? `request-${user.id}`,
    user,
    direction: overrides.direction ?? 'incoming',
    createdAt: overrides.createdAt ?? '2026-05-02T12:00:00Z',
    mutualFriends: overrides.mutualFriends ?? 1,
    note: overrides.note,
  };
}

function buildSuggestion(overrides: Record<string, any> = {}) {
  const user = overrides.user ?? buildUser({ id: overrides.userId ?? 'suggestion-user' });
  return {
    id: overrides.id ?? `suggestion-${user.id}`,
    user,
    mutualFriends: overrides.mutualFriends ?? 1,
    sharedInterests: overrides.sharedInterests ?? ['food'],
    favoriteCategories: overrides.favoriteCategories ?? ['food'],
    presence: overrides.presence ?? 'offline',
    reason: overrides.reason ?? 'Shared routes',
    score: overrides.score,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

describe('friends store API contracts', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.doUnmock('@/services/friendService');
  });

  it('fetches the social circle and filters suggestions that are already friends', async () => {
    const connection = buildConnection({ user: buildUser({ id: 'user-friend' }), presence: 'planning' });
    const request = buildRequest({ id: 'request-1' });
    const existingFriendSuggestion = buildSuggestion({ user: connection.user });
    const newSuggestion = buildSuggestion({ user: buildUser({ id: 'user-new' }) });

    vi.doMock('@/services/friendService', () => ({
      listFriends: vi.fn().mockResolvedValue({
        data: [connection],
        meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
      }),
      listPendingFriendRequests: vi.fn().mockResolvedValue({ data: [request] }),
      listFriendSuggestions: vi.fn().mockResolvedValue({ data: [existingFriendSuggestion, newSuggestion] }),
      searchFriendCandidates: vi.fn(),
      sendFriendRequest: vi.fn(),
      acceptFriendRequest: vi.fn(),
      rejectFriendRequest: vi.fn(),
      removeFriend: vi.fn(),
    }));

    const store = await bootstrapFriendsStore();

    await store.fetchAll();

    expect(store.connections).toEqual([connection]);
    expect(store.onlineConnections).toEqual([connection]);
    expect(store.requests).toEqual([request]);
    expect(store.suggestions).toEqual([newSuggestion]);
    expect(store.meta).toEqual({ page: 1, pageSize: 100, total: 1, totalPages: 1 });
    expect(store.isAlreadyFriend('user-friend')).toBe(true);
  });

  it('ranks active friends first, then shared trips and mutual friends', async () => {
    vi.doMock('@/services/friendService', () => ({
      listFriends: vi.fn(),
      listPendingFriendRequests: vi.fn(),
      listFriendSuggestions: vi.fn(),
      searchFriendCandidates: vi.fn(),
      sendFriendRequest: vi.fn(),
      acceptFriendRequest: vi.fn(),
      rejectFriendRequest: vi.fn(),
      removeFriend: vi.fn(),
    }));

    const store = await bootstrapFriendsStore();
    store.connections = [
      buildConnection({
        user: buildUser({ id: 'user-offline-heavy', displayName: 'Offline Heavy' }),
        presence: 'offline',
        sharedTrips: 20,
        mutualFriends: 99,
      }),
      buildConnection({
        user: buildUser({ id: 'user-online-light', displayName: 'Online Light' }),
        presence: 'online',
        sharedTrips: 1,
        mutualFriends: 1,
      }),
      buildConnection({
        user: buildUser({ id: 'user-planning', displayName: 'Planning Friend' }),
        presence: 'planning',
        sharedTrips: 2,
        mutualFriends: 3,
      }),
      buildConnection({
        user: buildUser({ id: 'user-online-shared', displayName: 'Online Shared' }),
        presence: 'online',
        sharedTrips: 4,
        mutualFriends: 1,
      }),
      buildConnection({
        user: buildUser({ id: 'user-offline-old', displayName: 'Offline Old' }),
        presence: 'offline',
        sharedTrips: 0,
        mutualFriends: 0,
        lastActiveAt: '2026-04-01T12:00:00Z',
      }),
      buildConnection({
        user: buildUser({ id: 'user-offline-recent', displayName: 'Offline Recent' }),
        presence: 'offline',
        sharedTrips: 0,
        mutualFriends: 0,
        lastActiveAt: '2026-05-01T12:00:00Z',
      }),
    ];

    expect(store.rankedConnections.map((connection) => connection.user.displayName)).toEqual([
      'Planning Friend',
      'Online Shared',
      'Online Light',
      'Offline Heavy',
      'Offline Recent',
      'Offline Old',
    ]);
    expect(store.onlineConnections.map((connection) => connection.user.displayName)).toEqual([
      'Planning Friend',
      'Online Shared',
      'Online Light',
    ]);
  });

  it('handles invalid activity timestamps and missing pagination metadata', async () => {
    vi.doMock('@/services/friendService', () => ({
      listFriends: vi.fn().mockResolvedValue({
        data: [
          buildConnection({
            user: buildUser({ id: 'user-invalid-date', displayName: 'Invalid Date' }),
            presence: 'offline',
            lastActiveAt: 'not-a-date',
          }),
          buildConnection({
            user: buildUser({ id: 'user-valid-date', displayName: 'Valid Date' }),
            presence: 'offline',
            lastActiveAt: '2026-05-01T12:00:00Z',
          }),
        ],
        meta: undefined,
      }),
      listPendingFriendRequests: vi.fn().mockResolvedValue({ data: [] }),
      listFriendSuggestions: vi.fn().mockResolvedValue({ data: [], meta: undefined }),
      searchFriendCandidates: vi.fn(),
      sendFriendRequest: vi.fn(),
      acceptFriendRequest: vi.fn(),
      rejectFriendRequest: vi.fn(),
      removeFriend: vi.fn(),
    }));

    const store = await bootstrapFriendsStore();

    await store.fetchAll();
    await store.refreshSuggestions();

    expect(store.meta).toBeNull();
    expect(store.rankedConnections.map((connection) => connection.user.displayName)).toEqual([
      'Valid Date',
      'Invalid Date',
    ]);
  });

  it('refreshes friend connections without disturbing requests', async () => {
    const firstConnection = buildConnection({ user: buildUser({ id: 'user-old' }) });
    const nextConnection = buildConnection({ user: buildUser({ id: 'user-new' }), presence: 'planning' });
    const request = buildRequest({ id: 'request-stays' });
    const listFriends = vi.fn().mockResolvedValue({
      data: [nextConnection],
      meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    });

    vi.doMock('@/services/friendService', () => ({
      listFriends,
      listPendingFriendRequests: vi.fn(),
      listFriendSuggestions: vi.fn(),
      searchFriendCandidates: vi.fn(),
      sendFriendRequest: vi.fn(),
      acceptFriendRequest: vi.fn(),
      rejectFriendRequest: vi.fn(),
      removeFriend: vi.fn(),
    }));

    const store = await bootstrapFriendsStore();
    store.connections = [firstConnection];
    store.requests = [request];
    store.suggestions = [buildSuggestion({ user: nextConnection.user }), buildSuggestion({ user: buildUser({ id: 'user-suggestion' }) })];

    await store.refreshConnections();

    expect(listFriends).toHaveBeenCalledWith(1, 100);
    expect(store.connections).toEqual([nextConnection]);
    expect(store.requests).toEqual([request]);
    expect(store.suggestions.map((suggestion) => suggestion.user.id)).toEqual(['user-suggestion']);
    expect(store.meta).toEqual({ page: 1, pageSize: 100, total: 1, totalPages: 1 });
  });

  it('handles suggestion refresh errors without throwing and excludes sent requests', async () => {
    const sentUser = buildUser({ id: 'user-sent' });
    const freshUser = buildUser({ id: 'user-fresh' });

    vi.doMock('@/services/friendService', () => ({
      listFriends: vi.fn(),
      listPendingFriendRequests: vi.fn(),
      listFriendSuggestions: vi.fn()
        .mockResolvedValueOnce({
          data: [
            buildSuggestion({ user: sentUser }),
            buildSuggestion({ user: freshUser }),
          ],
        })
        .mockRejectedValueOnce(new Error('Suggestions offline')),
      searchFriendCandidates: vi.fn(),
      sendFriendRequest: vi.fn(),
      acceptFriendRequest: vi.fn(),
      rejectFriendRequest: vi.fn(),
      removeFriend: vi.fn(),
    }));

    const store = await bootstrapFriendsStore();
    store.sentRequestUserIds = new Set(['user-sent']);

    await store.refreshSuggestions('mutuals');
    expect(store.suggestions.map((suggestion) => suggestion.user.id)).toEqual(['user-fresh']);

    await store.refreshSuggestions('random');
    expect(store.loading).toBe(false);
    expect(store.error).toBe('Suggestions offline');
    store.clearError();
    expect(store.error).toBeNull();
  });

  it('keeps only the latest member search results and clears short searches', async () => {
    const firstSearch = createDeferred<any>();
    const secondSearch = createDeferred<any>();
    const searchFriendCandidates = vi.fn()
      .mockReturnValueOnce(firstSearch.promise)
      .mockReturnValueOnce(secondSearch.promise);

    vi.doMock('@/services/friendService', () => ({
      listFriends: vi.fn(),
      listPendingFriendRequests: vi.fn(),
      listFriendSuggestions: vi.fn(),
      searchFriendCandidates,
      sendFriendRequest: vi.fn(),
      acceptFriendRequest: vi.fn(),
      rejectFriendRequest: vi.fn(),
      removeFriend: vi.fn(),
    }));

    const store = await bootstrapFriendsStore();
    store.connections = [buildConnection({ user: buildUser({ id: 'user-existing' }) })];

    await expect(store.search('m')).resolves.toEqual([]);
    expect(store.searchResults).toEqual([]);
    expect(store.searching).toBe(false);

    const firstPromise = store.search('maya');
    const secondPromise = store.search('noah');

    secondSearch.resolve({
      data: [
        buildUser({ id: 'user-existing' }),
        buildUser({ id: 'user-noah', displayName: 'Noah Now' }),
      ],
    });
    await expect(secondPromise).resolves.toEqual([
      expect.objectContaining({ id: 'user-noah' }),
    ]);

    firstSearch.resolve({ data: [buildUser({ id: 'user-maya', displayName: 'Maya Late' })] });
    await expect(firstPromise).resolves.toEqual([
      expect.objectContaining({ id: 'user-maya' }),
    ]);

    expect(searchFriendCandidates).toHaveBeenNthCalledWith(1, 'maya', 1, 12);
    expect(searchFriendCandidates).toHaveBeenNthCalledWith(2, 'noah', 1, 12);
    expect(store.searchResults.map((user) => user.id)).toEqual(['user-noah']);
    expect(store.searching).toBe(false);
  });

  it('sends friend requests once, removes matching suggestions, and rolls back failures', async () => {
    const sendFriendRequest = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Request offline'));
    const firstUser = buildUser({ id: 'user-first' });
    const failedUser = buildUser({ id: 'user-failed' });

    vi.doMock('@/services/friendService', () => ({
      listFriends: vi.fn(),
      listPendingFriendRequests: vi.fn(),
      listFriendSuggestions: vi.fn(),
      searchFriendCandidates: vi.fn(),
      sendFriendRequest,
      acceptFriendRequest: vi.fn(),
      rejectFriendRequest: vi.fn(),
      removeFriend: vi.fn(),
    }));

    const store = await bootstrapFriendsStore();
    store.connections = [buildConnection({ user: buildUser({ id: 'user-existing' }) })];
    store.suggestions = [
      buildSuggestion({ user: firstUser }),
      buildSuggestion({ user: failedUser }),
    ];

    await store.sendRequest(buildUser({ id: 'user-existing' }));
    expect(sendFriendRequest).not.toHaveBeenCalled();

    await store.sendRequest(firstUser);
    expect(store.hasSentRequestTo('user-first')).toBe(true);
    expect(store.suggestions.map((suggestion) => suggestion.user.id)).toEqual(['user-failed']);

    await store.sendRequest(firstUser);
    expect(sendFriendRequest).toHaveBeenCalledTimes(1);

    await expect(store.sendRequest(failedUser)).rejects.toThrow('Request offline');
    expect(store.hasSentRequestTo('user-failed')).toBe(false);
    expect(store.saving).toBe(false);
    expect(store.error).toBe('Request offline');
  });

  it('accepts, rejects, removes, and reports social mutation failures', async () => {
    const request = buildRequest({ id: 'request-1', user: buildUser({ id: 'user-request' }) });
    const acceptedConnection = buildConnection({ id: 'connection-user-request', user: request.user });
    const acceptFriendRequest = vi.fn()
      .mockResolvedValueOnce(acceptedConnection)
      .mockRejectedValueOnce(new Error('Accept offline'));
    const rejectFriendRequest = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Reject offline'));
    const removeFriend = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Remove offline'));

    vi.doMock('@/services/friendService', () => ({
      listFriends: vi.fn(),
      listPendingFriendRequests: vi.fn(),
      listFriendSuggestions: vi.fn(),
      searchFriendCandidates: vi.fn(),
      sendFriendRequest: vi.fn(),
      acceptFriendRequest,
      rejectFriendRequest,
      removeFriend,
    }));

    const store = await bootstrapFriendsStore();
    store.requests = [request];
    store.suggestions = [buildSuggestion({ user: request.user })];

    await store.acceptRequest('missing-request');
    expect(acceptFriendRequest).not.toHaveBeenCalled();

    await store.acceptRequest('request-1');
    expect(store.requests).toEqual([]);
    expect(store.connections).toEqual([acceptedConnection]);
    expect(store.suggestions).toEqual([]);

    store.requests = [buildRequest({ id: 'request-2' })];
    await store.rejectRequest('request-2');
    expect(store.requests).toEqual([]);

    await store.removeConnection('connection-user-request');
    expect(store.connections).toEqual([]);

    store.requests = [buildRequest({ id: 'request-3' })];
    await expect(store.acceptRequest('request-3')).rejects.toThrow('Accept offline');
    expect(store.saving).toBe(false);
    expect(store.error).toBe('Accept offline');

    await expect(store.rejectRequest('request-3')).rejects.toThrow('Reject offline');
    expect(store.saving).toBe(false);
    expect(store.error).toBe('Reject offline');

    await expect(store.removeConnection('missing-connection')).rejects.toThrow('Remove offline');
    expect(store.saving).toBe(false);
    expect(store.error).toBe('Remove offline');
  });
});
