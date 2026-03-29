import { createPinia, setActivePinia } from 'pinia';

async function bootstrapSpotsStore() {
  setActivePinia(createPinia());
  const { useSpotsStore } = await import('@/stores/spots');
  return useSpotsStore();
}

describe('spots store async error handling', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.doUnmock('@/services/spotService');
  });

  it('captures loading errors from list requests', async () => {
    vi.doMock('@/services/spotService', () => ({
      listSpots: vi.fn().mockRejectedValue(new Error('Map content sync failed')),
      listTrendingSpots: vi.fn(),
      getSpotDetail: vi.fn(),
      createSpot: vi.fn(),
      updateSpot: vi.fn(),
    }));

    const store = await bootstrapSpotsStore();

    await expect(store.fetchSpots()).rejects.toThrow('Map content sync failed');

    expect(store.loading).toBe(false);
    expect(store.error).toBe('Map content sync failed');
    expect(store.items).toEqual([]);
  });

  it('captures save errors and clears the saving flag', async () => {
    vi.doMock('@/services/spotService', () => ({
      listSpots: vi.fn(),
      listTrendingSpots: vi.fn(),
      getSpotDetail: vi.fn(),
      createSpot: vi.fn().mockRejectedValue(new Error('Upload pipeline stalled')),
      updateSpot: vi.fn(),
    }));

    const store = await bootstrapSpotsStore();

    await expect(
      store.createSpot({
        spot: {
          title: 'Sunset Rooftop Tacos',
          description: 'Skyline tacos and late-night energy.',
          latitude: 32.7555,
          longitude: -97.3308,
          address: '123 Main St',
          city: 'Fort Worth',
          country: 'US',
          category: 'food',
          vibe: 'electric',
          rating: 4.8,
          visitedAt: '2026-03-29',
          isPublic: true,
        },
        existingPhotos: [],
        newPhotos: [],
      }),
    ).rejects.toThrow('Upload pipeline stalled');

    expect(store.saving).toBe(false);
    expect(store.error).toBe('Upload pipeline stalled');
  });
});
