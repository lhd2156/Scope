import { createPinia, setActivePinia } from 'pinia';

async function bootstrapFeedStore() {
  setActivePinia(createPinia());
  const { useFeedStore } = await import('@/stores/feed');
  return useFeedStore();
}

describe('feed store async error handling', () => {
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
    }));

    const store = await bootstrapFeedStore();

    await expect(store.fetchFeed()).rejects.toThrow('Feed service unavailable');

    expect(store.loading).toBe(false);
    expect(store.error).toBe('Feed service unavailable');
    expect(store.items).toEqual([]);
  });
});
