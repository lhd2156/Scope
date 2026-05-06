import { createPinia, setActivePinia } from 'pinia';

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
      getTrendingSpots: vi.fn(),
    }));

    const store = await bootstrapFeedStore();

    await expect(store.fetchFeed()).rejects.toThrow('Feed service unavailable');

    expect(store.loading).toBe(false);
    expect(store.error).toBe('Feed service unavailable');
    expect(store.items).toEqual([]);
  });

  it('stores feed pagination and trending spot data from the service contracts', async () => {
    vi.doMock('@/services/feedService', () => ({
      getFeed: vi.fn().mockResolvedValue({
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

    expect(store.meta).toEqual({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    });
    expect(store.trendingSpots).toHaveLength(1);
    expect(store.trendingLoading).toBe(false);
    expect(store.trendingError).toBeNull();
  });
});
