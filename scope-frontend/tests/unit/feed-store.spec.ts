import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';

async function bootstrapFeedStore() {
  setActivePinia(createPinia());
  const { useFeedStore } = await import('@/stores/feed');
  return useFeedStore();
}

describe('feed store API contracts', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.doUnmock('@/services/feedService');
  });

  it('captures a user-safe error and resets loading when feed fetch fails', async () => {
    vi.doMock('@/services/feedService', () => ({
      getFeed: vi.fn().mockRejectedValue(new Error('Feed service unavailable')),
      getHomeActivityFeed: vi.fn().mockRejectedValue(new Error('Feed service unavailable')),
      getTrendingSpots: vi.fn(),
    }));

    const store = await bootstrapFeedStore();

    await expect(store.fetchFeed()).rejects.toThrow('Feed service unavailable');

    expect(store.loading).toBe(false);
    expect(store.error).toBe('Feed service unavailable');
    expect(store.items).toEqual([]);
  });

  it('stores feed pagination and trending spot data from the service contracts', async () => {
    const getFeed = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'feed-1',
          type: 'spot',
          actor: {
            id: 'user-1',
            username: 'louisdo',
            email: 'louis@example.com',
            displayName: 'Louis Do',
            interests: ['food'],
          },
          title: 'Louis pinned a new taco stop',
          excerpt: 'Fresh late-night route intel.',
          createdAt: '2026-03-29T13:00:00Z',
          targetId: 'spot-1',
        },
      ],
      meta: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
    });
    vi.doMock('@/services/feedService', () => ({
      getFeed,
      getHomeActivityFeed: vi.fn().mockResolvedValue({
        data: [],
        meta: null,
      }),
      getTrendingSpots: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'spot-1',
            title: 'Sunset Rooftop Tacos',
            latitude: 32.7555,
            longitude: -97.3308,
            category: 'food',
            rating: 4.8,
            createdAt: '2026-03-26T20:00:00Z',
          },
        ],
      }),
    }));

    const store = await bootstrapFeedStore();

    await store.fetchFeed();
    await store.fetchTrendingSpots();
    const cachedItems = await store.fetchFeed();

    expect(store.meta).toEqual({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
    expect(store.trendingSpots).toHaveLength(1);
    expect(store.trendingLoading).toBe(false);
    expect(store.trendingError).toBeNull();
    expect(cachedItems).toBe(store.items);
    expect(getFeed).toHaveBeenCalledTimes(1);
  });

  it('forces feed reloads and surfaces trending spot failures safely', async () => {
    const getFeed = vi.fn()
      .mockResolvedValueOnce({ data: [{ id: 'feed-old' }], meta: null })
      .mockResolvedValueOnce({ data: [{ id: 'feed-new' }], meta: undefined });
    const getHomeActivityFeed = vi.fn().mockResolvedValue({ data: [], meta: null });
    vi.doMock('@/services/feedService', () => ({
      getFeed,
      getHomeActivityFeed,
      getTrendingSpots: vi.fn().mockRejectedValue(new Error('Trending service unavailable')),
    }));

    const store = await bootstrapFeedStore();

    await store.fetchFeed(false, 1, 10);
    await store.fetchFeed(true, 2, 5);
    await expect(store.fetchTrendingSpots(8)).rejects.toThrow('Trending service unavailable');

    expect(getFeed).toHaveBeenNthCalledWith(1, 1, 10);
    expect(getFeed).toHaveBeenNthCalledWith(2, 2, 5);
    expect(store.items).toEqual([{ id: 'feed-new' }]);
    expect(store.meta).toBeNull();
    expect(store.trendingLoading).toBe(false);
    expect(store.trendingError).toBe('Trending service unavailable');
  });

  it('loads the home activity rail through the starter activity service', async () => {
    const getHomeActivityFeed = vi.fn().mockResolvedValue({
      data: [{ id: 'home-feed-1' }],
      meta: { page: 1, pageSize: 6, total: 1, totalPages: 1 },
    });
    const getFeed = vi.fn().mockResolvedValue({ data: [{ id: 'private-feed-1' }], meta: null });
    vi.doMock('@/services/feedService', () => ({
      getFeed,
      getHomeActivityFeed,
      getTrendingSpots: vi.fn(),
    }));

    const store = await bootstrapFeedStore();

    await store.fetchHomeActivityFeed(false, 1, 6);

    expect(getHomeActivityFeed).toHaveBeenCalledWith(1, 6);
    expect(getFeed).not.toHaveBeenCalled();
    expect(store.items).toEqual([{ id: 'home-feed-1' }]);
    expect(store.meta).toMatchObject({ page: 1, pageSize: 6, total: 1 });
  });

  it('keeps the signed-in actor identity fresh after profile changes', async () => {
    vi.doMock('@/services/feedService', () => ({
      getFeed: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'feed-review-current-user',
            type: 'review',
            actor: {
              id: 'user-auth',
              username: 'traveler-user-auth',
              email: '',
              displayName: 'Traveler user-auth',
              interests: [],
              avatarUrl: '',
            },
            title: 'Traveler user-auth reviewed Sunset Rooftop Tacos',
            excerpt: '5/5: Identity should follow settings.',
            createdAt: '2026-03-29T13:00:00Z',
            targetId: 'spot-1',
          },
        ],
        meta: null,
      }),
      getHomeActivityFeed: vi.fn().mockResolvedValue({ data: [], meta: null }),
      getTrendingSpots: vi.fn(),
    }));

    const store = await bootstrapFeedStore();
    const { useAuthStore } = await import('@/stores/auth');
    const authStore = useAuthStore();
    authStore.currentUser = {
      id: 'user-auth',
      username: 'launch-ready',
      email: 'launch-ready@example.com',
      displayName: 'Launch Ready Louis',
      interests: ['food'],
      avatarUrl: 'https://images.example.com/avatar-updated.jpg',
    };

    await store.fetchFeed();

    expect(store.items[0].actor).toMatchObject({
      id: 'user-auth',
      username: 'launch-ready',
      displayName: 'Launch Ready Louis',
      avatarUrl: 'https://images.example.com/avatar-updated.jpg',
    });
    expect(store.items[0].title).toBe('Launch Ready Louis reviewed Sunset Rooftop Tacos');

    authStore.currentUser = {
      ...authStore.currentUser,
      displayName: 'Public Launch Louis',
      avatarUrl: 'https://images.example.com/avatar-public.jpg',
    };
    await nextTick();

    expect(store.items[0].actor.displayName).toBe('Public Launch Louis');
    expect(store.items[0].actor.avatarUrl).toBe('https://images.example.com/avatar-public.jpg');
    expect(store.items[0].title).toBe('Public Launch Louis reviewed Sunset Rooftop Tacos');
  });
});
