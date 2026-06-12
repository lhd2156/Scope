import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

async function bootstrapSpotsStore() {
  setActivePinia(createPinia());
  const { useSpotsStore } = await import('@/stores/spots');
  return useSpotsStore();
}

function buildSpotDetail(overrides: Record<string, any> = {}) {
  return {
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
    liked: false,
    likesCount: 0,
    photos: [],
    reviews: [],
    ...overrides,
  };
}

describe('spots store API contracts', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.doUnmock('@/services/analyticsService');
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

  it('tracks successful spot creation through the analytics abstraction', async () => {
    const createdSpot = {
      id: 'spot-77',
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
      liked: false,
      likesCount: 0,
      photos: [],
      reviews: [],
    };
    const trackSpotCreate = vi.fn();

    vi.doMock('@/services/analyticsService', () => ({
      trackSpotCreate,
    }));

    vi.doMock('@/services/spotService', () => ({
      listSpots: vi.fn(),
      listTrendingSpots: vi.fn(),
      listNearbySpots: vi.fn(),
      getSpotDetail: vi.fn(),
      createSpot: vi.fn().mockResolvedValue({ data: createdSpot }),
      updateSpot: vi.fn(),
      deleteSpot: vi.fn(),
      likeSpot: vi.fn(),
      unlikeSpot: vi.fn(),
    }));

    const store = await bootstrapSpotsStore();

    await store.createSpot({
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
      newPhotos: [
        {
          id: 'upload-1',
          file: new File(['photo'], 'sunset.jpg', { type: 'image/jpeg' }),
          previewUrl: 'blob:scope-test',
          caption: 'Skyline glow',
          mimeType: 'image/jpeg',
          sizeBytes: 2048,
        },
      ],
    });
    await flushPromises();

    expect(store.selectedSpot?.id).toBe('spot-77');
    expect(trackSpotCreate).toHaveBeenCalledWith(expect.objectContaining({
      spotId: 'spot-77',
      category: 'food',
      city: 'Fort Worth',
      photoCount: 1,
      isPublic: true,
      routeName: 'spot-create',
    }));
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

  it('loads trending spots, featured spots, and selected spot details through the service layer', async () => {
    const trendingSpot = {
      id: 'spot-trending',
      title: 'Trinity Bluff Sunrise',
      latitude: 32.7551,
      longitude: -97.3524,
      category: 'scenic',
      rating: 4.9,
      createdAt: '2026-03-16T11:20:00Z',
      liked: true,
    };
    const detail = buildSpotDetail({
      id: 'spot-detail',
      title: 'Botanic River Walk',
      category: 'nature',
      photos: [{ id: 'photo-1', url: 'https://example.com/photo.jpg', caption: 'Garden', sortOrder: 0 }],
    });

    vi.doMock('@/services/spotService', () => ({
      listSpots: vi.fn(),
      listTrendingSpots: vi.fn().mockResolvedValue({ data: [trendingSpot] }),
      listNearbySpots: vi.fn(),
      getSpotDetail: vi.fn().mockResolvedValue({ data: detail }),
      createSpot: vi.fn(),
      updateSpot: vi.fn(),
      deleteSpot: vi.fn(),
      likeSpot: vi.fn(),
      unlikeSpot: vi.fn(),
    }));

    const store = await bootstrapSpotsStore();

    await expect(store.fetchTrending(1)).resolves.toEqual([trendingSpot]);
    expect(store.trending).toEqual([trendingSpot]);
    expect(store.featuredSpots[0]?.id).toBe('spot-trending');

    await expect(store.fetchSpot('spot-detail')).resolves.toMatchObject({ id: 'spot-detail' });
    expect(store.selectedSpot).toMatchObject({ id: 'spot-detail', title: 'Botanic River Walk' });
    expect(store.loading).toBe(false);
  });

  it('reconciles updated details against active filters, trending, nearby, and selected state', async () => {
    const listedFoodSpot = {
      id: 'spot-1',
      title: 'Sunset Rooftop Tacos',
      latitude: 32.7555,
      longitude: -97.3308,
      category: 'food',
      city: 'Fort Worth',
      rating: 4.8,
      createdAt: '2026-03-29T12:00:00Z',
    };
    const updatedNatureSpot = buildSpotDetail({
      id: 'spot-1',
      title: 'Updated Garden',
      category: 'nature',
      city: 'Austin',
      liked: true,
      likesCount: 7,
    });

    vi.doMock('@/services/spotService', () => ({
      listSpots: vi.fn().mockResolvedValue({ data: [listedFoodSpot] }),
      listTrendingSpots: vi.fn().mockResolvedValue({ data: [listedFoodSpot] }),
      listNearbySpots: vi.fn().mockResolvedValue({ data: [listedFoodSpot] }),
      getSpotDetail: vi.fn(),
      createSpot: vi.fn(),
      updateSpot: vi.fn().mockResolvedValue({ data: updatedNatureSpot }),
      deleteSpot: vi.fn(),
      likeSpot: vi.fn().mockResolvedValue({ data: updatedNatureSpot }),
      unlikeSpot: vi.fn().mockResolvedValue({ data: buildSpotDetail({ id: 'spot-1', liked: false, likesCount: 6 }) }),
    }));

    const store = await bootstrapSpotsStore();

    await store.fetchSpots({ category: 'food', page: 1, pageSize: 12 });
    await store.fetchTrending();
    await store.fetchNearby({ latitude: 32.7555, longitude: -97.3308 });

    await store.updateSpot('spot-1', {
      spot: {
        title: 'Updated Garden',
        description: 'A filtered-out nature spot.',
        latitude: 30.2674,
        longitude: -97.7485,
        address: '705 Congress Ave',
        city: 'Austin',
        country: 'US',
        category: 'nature',
        vibe: 'curated',
        rating: 4.7,
        visitedAt: '2026-05-01',
        isPublic: true,
      },
      existingPhotos: [],
      newPhotos: [],
    });

    expect(store.items).toEqual([]);
    expect(store.trending[0]).toMatchObject({ id: 'spot-1', title: 'Updated Garden', category: 'nature' });
    expect(store.nearby[0]).toMatchObject({ id: 'spot-1', title: 'Updated Garden', category: 'nature' });
    expect(store.likedSpots.map((spot) => spot.id)).toEqual(['spot-1']);

    await store.toggleLike('spot-1');
    expect(store.selectedSpot?.liked).toBe(false);
  });

  it('uses item, selected-detail, and nearby fallbacks for featured, liked, and toggle flows', async () => {
    const listedSpot = {
      id: 'listed-1',
      title: 'Listed Food Hall',
      description: 'A ranked listed place.',
      latitude: 32.7555,
      longitude: -97.3308,
      category: 'food',
      city: 'Fort Worth',
      vibe: 'electric',
      rating: 4.9,
      liked: false,
      createdAt: '2026-03-29T12:00:00Z',
    };
    const nearbyLikedSpot = {
      id: 'nearby-liked',
      title: 'Nearby Saved Garden',
      description: 'Liked from nearby results.',
      latitude: 32.749,
      longitude: -97.363,
      category: 'nature',
      city: 'Fort Worth',
      vibe: 'calm',
      rating: 4.7,
      liked: true,
      createdAt: '2026-03-28T18:00:00Z',
    };
    const selectedLikedDetail = buildSpotDetail({
      id: 'selected-liked',
      title: 'Selected Liked Gallery',
      photoUrl: undefined,
      photos: [{ id: 'photo-selected', url: 'https://example.com/selected-gallery.jpg', caption: 'Gallery', sortOrder: 0 }],
      liked: true,
      likesCount: 5,
    });
    const unlikeSpot = vi.fn().mockResolvedValue({
      data: buildSpotDetail({ id: 'nearby-liked', liked: false, likesCount: 2 }),
    });
    const likeSpot = vi.fn().mockResolvedValue({
      data: buildSpotDetail({ id: 'unknown-new-like', liked: true, likesCount: 1 }),
    });

    vi.doMock('@/services/spotService', () => ({
      listSpots: vi.fn().mockResolvedValue({ data: [listedSpot] }),
      listTrendingSpots: vi.fn().mockResolvedValue({ data: [] }),
      listNearbySpots: vi.fn().mockResolvedValue({ data: [nearbyLikedSpot] }),
      getSpotDetail: vi.fn().mockResolvedValue({ data: selectedLikedDetail }),
      createSpot: vi.fn(),
      updateSpot: vi.fn(),
      deleteSpot: vi.fn(),
      likeSpot,
      unlikeSpot,
    }));

    const store = await bootstrapSpotsStore();

    await store.fetchSpots({ city: 'Fort', vibe: 'electric' });
    await store.fetchTrending();
    expect(store.featuredSpots[0]?.id).toBe('listed-1');

    await store.fetchNearby({ latitude: 32.75, longitude: -97.33 });
    await store.fetchSpot('selected-liked');
    expect(store.selectedSpot?.photoUrl).toBeUndefined();
    expect(store.likedSpots.map((spot) => spot.id)).toEqual(expect.arrayContaining([
      'nearby-liked',
      'selected-liked',
    ]));
    expect(store.likedSpots.find((spot) => spot.id === 'selected-liked')?.photoUrl).toBe('https://example.com/selected-gallery.jpg');

    await store.toggleLike('nearby-liked');
    expect(unlikeSpot).toHaveBeenCalledWith('nearby-liked');

    await store.toggleLike('unknown-new-like');
    expect(likeSpot).toHaveBeenCalledWith('unknown-new-like');
  });

  it('captures read and mutation failures without leaving loading flags behind', async () => {
    vi.doMock('@/services/spotService', () => ({
      listSpots: vi.fn(),
      listTrendingSpots: vi.fn().mockRejectedValue(new Error('Trending offline')),
      listNearbySpots: vi.fn().mockRejectedValue(new Error('Nearby offline')),
      getSpotDetail: vi.fn().mockRejectedValue(new Error('Detail offline')),
      createSpot: vi.fn(),
      updateSpot: vi.fn().mockRejectedValue(new Error('Update offline')),
      deleteSpot: vi.fn().mockRejectedValue(new Error('Delete offline')),
      likeSpot: vi.fn().mockRejectedValue(new Error('Like offline')),
      unlikeSpot: vi.fn().mockRejectedValue(new Error('Unlike offline')),
    }));

    const store = await bootstrapSpotsStore();

    await expect(store.fetchTrending()).rejects.toThrow('Trending offline');
    expect(store.loading).toBe(false);
    expect(store.error).toBe('Trending offline');

    await expect(store.fetchNearby({ latitude: 32.75, longitude: -97.33 })).rejects.toThrow('Nearby offline');
    expect(store.loading).toBe(false);
    expect(store.error).toBe('Nearby offline');

    await expect(store.fetchSpot('spot-404')).rejects.toThrow('Detail offline');
    expect(store.selectedSpot).toBeNull();
    expect(store.loading).toBe(false);
    expect(store.error).toBe('Detail offline');

    await expect(store.updateSpot('spot-1', {
      spot: {
        title: 'Broken Update',
        description: 'Nope.',
        latitude: 32.7555,
        longitude: -97.3308,
        address: '',
        city: 'Fort Worth',
        country: 'US',
        category: 'food',
        vibe: 'electric',
        rating: 4.8,
        visitedAt: '2026-05-01',
        isPublic: true,
      },
      existingPhotos: [],
      newPhotos: [],
    })).rejects.toThrow('Update offline');
    expect(store.saving).toBe(false);
    expect(store.error).toBe('Update offline');

    await expect(store.deleteSpot('spot-1')).rejects.toThrow('Delete offline');
    expect(store.saving).toBe(false);
    expect(store.error).toBe('Delete offline');

    await expect(store.likeSpot('spot-1')).rejects.toThrow('Like offline');
    expect(store.saving).toBe(false);
    expect(store.error).toBe('Like offline');

    await expect(store.unlikeSpot('spot-1')).rejects.toThrow('Unlike offline');
    expect(store.saving).toBe(false);
    expect(store.error).toBe('Unlike offline');
  });
});
