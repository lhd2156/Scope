import { createPinia, setActivePinia } from 'pinia';

async function bootstrapUserStore() {
  setActivePinia(createPinia());
  const { useUserStore } = await import('@/stores/user');
  return useUserStore();
}

describe('user store API contracts', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.doUnmock('@/services/userService');
    vi.doUnmock('@/stores/auth');
  });

  it('fetches the current profile and syncs the auth store copy', async () => {
    const updateCurrentUser = vi.fn();

    vi.doMock('@/stores/auth', () => ({
      useAuthStore: () => ({
        currentUser: {
          id: 'user-1',
          username: 'louisdo',
          email: 'louis@example.com',
          displayName: 'Louis Do',
          interests: ['food'],
          stats: { spots: 2, trips: 1, friends: 3 },
        },
        updateCurrentUser,
        logout: vi.fn(),
      }),
    }));

    vi.doMock('@/services/userService', () => ({
      getCurrentUserProfile: vi.fn().mockResolvedValue({
        data: {
          id: 'user-1',
          username: 'louisdo',
          email: 'louis@example.com',
          displayName: 'Louis Scope',
          homeBase: 'Fort Worth, TX',
          interests: ['food', 'culture'],
          stats: { spots: 42, trips: 8, friends: 126 },
        },
      }),
      getUserProfile: vi.fn(),
      getUserStats: vi.fn(),
      searchUsers: vi.fn(),
      updateUserProfile: vi.fn(),
      deactivateUserProfile: vi.fn(),
      deleteCurrentUserContent: vi.fn(),
    }));

    const store = await bootstrapUserStore();
    await store.fetchCurrentProfile();

    expect(store.profile?.displayName).toBe('Louis Scope');
    expect(store.stats).toEqual({ spots: 42, trips: 8, friends: 126 });
    expect(updateCurrentUser).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1',
        displayName: 'Louis Scope',
      }),
    );
    expect(store.error).toBeNull();
  });

  it('captures search pagination and saves profile updates through the user contract', async () => {
    const updateCurrentUser = vi.fn();

    vi.doMock('@/stores/auth', () => ({
      useAuthStore: () => ({
        currentUser: {
          id: 'user-2',
          username: 'maya',
          email: 'maya@example.com',
          displayName: 'Maya Chen',
          interests: ['scenic'],
        },
        updateCurrentUser,
        logout: vi.fn(),
      }),
    }));

    vi.doMock('@/services/userService', () => ({
      getCurrentUserProfile: vi.fn(),
      getUserProfile: vi.fn(),
      getUserStats: vi.fn(),
      searchUsers: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'user-3',
            username: 'elijah',
            email: 'elijah@example.com',
            displayName: 'Elijah Brooks',
            interests: ['adventure'],
          },
        ],
        meta: {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
        },
      }),
      updateUserProfile: vi.fn().mockResolvedValue({
        data: {
          id: 'user-2',
          username: 'maya',
          email: 'maya@example.com',
          displayName: 'Maya in Motion',
          homeBase: 'Dallas, TX',
          interests: ['scenic', 'culture'],
        },
      }),
      deactivateUserProfile: vi.fn(),
      deleteCurrentUserContent: vi.fn(),
    }));

    const store = await bootstrapUserStore();

    await store.searchProfiles('elijah');
    expect(store.searchResults).toHaveLength(1);
    expect(store.searchMeta).toEqual({
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });

    await store.saveProfile({
      displayName: 'Maya in Motion',
      homeBase: 'Dallas, TX',
      interests: ['scenic', 'culture'],
    });

    expect(store.profile?.displayName).toBe('Maya in Motion');
    expect(updateCurrentUser).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-2',
        displayName: 'Maya in Motion',
      }),
    );
    expect(store.saving).toBe(false);
  });

  it('loads other profiles, stats, and clears profile context without touching auth when not current user', async () => {
    const updateCurrentUser = vi.fn();

    vi.doMock('@/stores/auth', () => ({
      useAuthStore: () => ({
        currentUser: {
          id: 'user-1',
          username: 'louisdo',
          email: 'louis@example.com',
          displayName: 'Louis Do',
          stats: { spots: 2, trips: 1, friends: 3 },
        },
        updateCurrentUser,
        logout: vi.fn(),
      }),
    }));

    vi.doMock('@/services/userService', () => ({
      getCurrentUserProfile: vi.fn(),
      getUserProfile: vi.fn().mockResolvedValue({
        data: {
          id: 'user-2',
          username: 'maya',
          email: 'maya@example.com',
          displayName: 'Maya Chen',
          stats: { spots: 28, trips: 6, friends: 84 },
        },
      }),
      getUserStats: vi.fn().mockResolvedValue({
        data: { spots: 30, trips: 7, friends: 90 },
      }),
      searchUsers: vi.fn(),
      updateUserProfile: vi.fn(),
      deactivateUserProfile: vi.fn(),
      deleteCurrentUserContent: vi.fn(),
    }));

    const store = await bootstrapUserStore();

    expect(store.isCurrentUserProfile).toBe(true);
    await expect(store.fetchStats('')).resolves.toBeNull();
    expect(store.stats).toEqual({ spots: 2, trips: 1, friends: 3 });

    await store.fetchProfile('user-2');
    expect(store.profile?.id).toBe('user-2');
    expect(store.stats).toEqual({ spots: 28, trips: 6, friends: 84 });
    expect(store.isCurrentUserProfile).toBe(false);
    expect(updateCurrentUser).not.toHaveBeenCalled();

    await store.fetchStats('user-2');
    expect(store.stats).toEqual({ spots: 30, trips: 7, friends: 90 });

    store.clearProfileContext();
    expect(store.profile?.id).toBe('user-1');
    expect(store.stats).toEqual({ spots: 2, trips: 1, friends: 3 });
    expect(store.searchResults).toEqual([]);
    expect(store.searchMeta).toBeNull();
  });

  it('deactivates profiles, removes search results, and logs out the current user when needed', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    const deleteCurrentUserContent = vi.fn().mockResolvedValue(undefined);
    const deactivateUserProfile = vi.fn().mockResolvedValue(undefined);

    vi.doMock('@/stores/auth', () => ({
      useAuthStore: () => ({
        currentUser: {
          id: 'user-1',
          username: 'louisdo',
          email: 'louis@example.com',
          displayName: 'Louis Do',
        },
        updateCurrentUser: vi.fn(),
        logout,
      }),
    }));

    vi.doMock('@/services/userService', () => ({
      getCurrentUserProfile: vi.fn(),
      getUserProfile: vi.fn().mockResolvedValue({
        data: {
          id: 'user-2',
          username: 'maya',
          email: 'maya@example.com',
          displayName: 'Maya Chen',
          stats: { spots: 28, trips: 6, friends: 84 },
        },
      }),
      getUserStats: vi.fn(),
      searchUsers: vi.fn().mockResolvedValue({
        data: [
          { id: 'user-1', username: 'louisdo', email: 'louis@example.com', displayName: 'Louis Do' },
          { id: 'user-2', username: 'maya', email: 'maya@example.com', displayName: 'Maya Chen' },
        ],
      }),
      updateUserProfile: vi.fn(),
      deactivateUserProfile,
      deleteCurrentUserContent,
    }));

    const store = await bootstrapUserStore();

    await store.searchProfiles('scope');
    await store.fetchProfile('user-2');
    await store.deactivateProfile('user-2');

    expect(store.searchResults.map((user) => user.id)).toEqual(['user-1']);
    expect(store.profile?.id).toBe('user-1');
    expect(store.stats).toBeNull();
    expect(logout).not.toHaveBeenCalled();

    await store.deactivateProfile('user-1');
    expect(logout).toHaveBeenCalledTimes(1);
    expect(store.saving).toBe(false);

    await store.deleteCurrentAccount();
    expect(deleteCurrentUserContent).toHaveBeenCalledTimes(1);
    expect(deactivateUserProfile).toHaveBeenLastCalledWith('user-1');
    expect(logout).toHaveBeenCalledTimes(2);
    expect(deleteCurrentUserContent.mock.invocationCallOrder[0]).toBeLessThan(
      deactivateUserProfile.mock.invocationCallOrder.at(-1) ?? Number.MAX_SAFE_INTEGER,
    );
  });

  it('reports profile, stats, search, save, and deactivation failures with stable flags', async () => {
    vi.doMock('@/stores/auth', () => ({
      useAuthStore: () => ({
        currentUser: null,
        updateCurrentUser: vi.fn(),
        logout: vi.fn(),
      }),
    }));

    vi.doMock('@/services/userService', () => ({
      getCurrentUserProfile: vi.fn().mockRejectedValue(new Error('Current profile offline')),
      getUserProfile: vi.fn().mockRejectedValue(new Error('Profile offline')),
      getUserStats: vi.fn().mockRejectedValue(new Error('Stats offline')),
      searchUsers: vi.fn().mockRejectedValue(new Error('Search offline')),
      updateUserProfile: vi.fn().mockRejectedValue(new Error('Save offline')),
      deactivateUserProfile: vi.fn().mockRejectedValue(new Error('Deactivate offline')),
      deleteCurrentUserContent: vi.fn().mockRejectedValue(new Error('Content deletion offline')),
    }));

    const store = await bootstrapUserStore();

    await expect(store.fetchCurrentProfile()).rejects.toThrow('Current profile offline');
    expect(store.loading).toBe(false);
    expect(store.error).toBe('Current profile offline');

    store.clearError();
    expect(store.error).toBeNull();

    await expect(store.fetchProfile('user-404')).rejects.toThrow('Profile offline');
    expect(store.loading).toBe(false);
    expect(store.error).toBe('Profile offline');

    await expect(store.fetchStats('user-404')).rejects.toThrow('Stats offline');
    expect(store.loading).toBe(false);
    expect(store.error).toBe('Stats offline');

    await expect(store.searchProfiles('maya')).rejects.toThrow('Search offline');
    expect(store.loading).toBe(false);
    expect(store.error).toBe('Search offline');

    await expect(store.saveProfile({ displayName: 'Nobody' })).rejects.toThrow('No Scope user is selected');

    await expect(store.saveProfile({ displayName: 'Broken' }, 'user-404')).rejects.toThrow('Save offline');
    expect(store.saving).toBe(false);
    expect(store.error).toBe('Save offline');

    await store.deactivateProfile('');
    await expect(store.deactivateProfile('user-404')).rejects.toThrow('Deactivate offline');
    expect(store.saving).toBe(false);
    expect(store.error).toBe('Deactivate offline');
    await expect(store.deleteCurrentAccount()).rejects.toThrow('No signed-in Scope account is available to delete');
  });
});
