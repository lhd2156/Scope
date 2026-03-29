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
          displayName: 'Louis Atlas',
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
    }));

    const store = await bootstrapUserStore();
    await store.fetchCurrentProfile();

    expect(store.profile?.displayName).toBe('Louis Atlas');
    expect(store.stats).toEqual({ spots: 42, trips: 8, friends: 126 });
    expect(updateCurrentUser).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1',
        displayName: 'Louis Atlas',
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
});
