import { createPinia, setActivePinia } from 'pinia';

async function bootstrapSpotsStore() {
  setActivePinia(createPinia());
  const { useSpotsStore } = await import('@/stores/spots');
  return useSpotsStore();
}

describe('spots store API contracts', () => {
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
      listNearbySpots: vi.fn(),
      getSpotDetail: vi.fn(),
      createSpot: vi.fn(),
      updateSpot: vi.fn(),
      deleteSpot: vi.fn(),
      likeSpot: vi.fn(),
      unlikeSpot: vi.fn(),
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
      listNearbySpots: vi.fn(),
      getSpotDetail: vi.fn(),
      createSpot: vi.fn().mockRejectedValue(new Error('Upload pipeline stalled')),
      updateSpot: vi.fn(),
      deleteSpot: vi.fn(),
      likeSpot: vi.fn(),
      unlikeSpot: vi.fn(),
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

  it('tracks pagination, nearby results, and liked spots through the contract layer', async () => {
    const likedSpotDetail = {
      id: 'spot-1',
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
      photoUrl: 'https://example.com/spot.jpg',
      createdAt: '2026-03-29T12:00:00Z',
      liked: true,
      likesCount: 119,
      photos: [],
      reviews: [],
    };

    vi.doMock('@/services/spotService', () => ({
      listSpots: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'spot-1',
            title: 'Sunset Rooftop Tacos',
            latitude: 32.7555,
            longitude: -97.3308,
            category: 'food',
            rating: 4.8,
            createdAt: '2026-03-29T12:00:00Z',
            liked: false,
          },
        ],
        meta: {
          page: 1,
          pageSize: 12,
          total: 1,
          totalPages: 1,
        },
      }),
      listTrendingSpots: vi.fn(),
      listNearbySpots: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'spot-2',
            title: 'Botanic River Walk',
            latitude: 32.749,
            longitude: -97.363,
            category: 'nature',
            rating: 4.7,
            createdAt: '2026-03-28T18:00:00Z',
          },
        ],
        meta: {
          page: 1,
          pageSize: 1,
          total: 1,
          totalPages: 1,
        },
      }),
      getSpotDetail: vi.fn(),
      createSpot: vi.fn(),
      updateSpot: vi.fn(),
      deleteSpot: vi.fn().mockResolvedValue(undefined),
      likeSpot: vi.fn().mockResolvedValue({ data: likedSpotDetail }),
      unlikeSpot: vi.fn(),
    }));

    const store = await bootstrapSpotsStore();

    await store.fetchSpots();
    await store.fetchNearby({ latitude: 32.75, longitude: -97.33, radiusKm: 10 });
    await store.likeSpot('spot-1');

    expect(store.meta).toEqual({
      page: 1,
      pageSize: 12,
      total: 1,
      totalPages: 1,
    });
    expect(store.nearbyMeta).toEqual({
      page: 1,
      pageSize: 1,
      total: 1,
      totalPages: 1,
    });
    expect(store.likedSpots).toHaveLength(1);
    expect(store.selectedSpot?.liked).toBe(true);

    await store.deleteSpot('spot-1');
    expect(store.items).toEqual([]);
    expect(store.selectedSpot).toBeNull();
  });
});
