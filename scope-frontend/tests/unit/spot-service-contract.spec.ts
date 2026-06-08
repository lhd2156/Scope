import type {
  Photo,
  SpotDetail,
  SpotFormSubmission,
  SpotSummary,
} from '@/types';

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
const getTrendingSpotsMock = vi.hoisted(() => vi.fn());
const loadMockDataMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/api', () => ({
  default: apiMock,
}));

vi.mock('@/services/feedService', () => ({
  getTrendingSpots: getTrendingSpotsMock,
}));

vi.mock('@/services/mockDataLoader', () => ({
  loadMockData: loadMockDataMock,
}));

function buildSpotSummary(overrides: Partial<SpotSummary> = {}): SpotSummary {
  return {
    id: 'spot-1',
    title: 'Water Garden',
    latitude: 32.75,
    longitude: -97.33,
    category: 'scenic',
    rating: 4.8,
    likesCount: 4,
    createdAt: '2026-06-08T00:00:00Z',
    ...overrides,
  };
}

function buildSpotDetail(overrides: Partial<SpotDetail> = {}): SpotDetail {
  return {
    ...buildSpotSummary(),
    description: 'A calm downtown stop.',
    photos: [],
    reviews: [],
    ...overrides,
  };
}

function buildSubmission(overrides: Partial<SpotFormSubmission> = {}): SpotFormSubmission {
  return {
    spot: {
      title: 'Water Garden',
      description: 'A calm downtown stop.',
      latitude: 32.75,
      longitude: -97.33,
      address: '100 Main Street',
      city: 'Fort Worth',
      country: 'US',
      category: 'scenic',
      vibe: 'calm',
      rating: 4.8,
      visitedAt: '2026-06-08',
      isPublic: true,
    },
    existingPhotos: [],
    newPhotos: [],
    ...overrides,
  };
}

describe('spot service contracts', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.put.mockReset();
    apiMock.delete.mockReset();
    getTrendingSpotsMock.mockReset();
    loadMockDataMock.mockReset();
  });

  it('normalizes live spot envelopes, media, verification, and mutations', async () => {
    vi.stubEnv('VITE_ENABLE_SPOT_MOCK_FALLBACK', 'false');
    vi.stubEnv('VITE_ENABLE_SPOT_LOCAL_WRITE_FALLBACK', 'false');

    const livePhoto: Photo = {
      id: 'photo-live',
      url: 'https://images.example.com/live.jpg',
      caption: 'Live photo',
    };
    const liveDetail = buildSpotDetail({
      id: 'spot-live',
      photos: [],
      reviews: [],
    });

    apiMock.post
      .mockResolvedValueOnce({
        data: {
          verified: false,
          source: '',
          distanceMeters: 'bad',
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            verified: true,
            source: 'google',
            distanceMeters: 8,
            candidates: [{
              source: 'google',
              providerPlaceName: 'Water Garden',
              distanceMeters: undefined,
            }],
          },
        },
      })
      .mockResolvedValueOnce({ data: livePhoto })
      .mockResolvedValueOnce({ data: { ...livePhoto, id: 'photo-captioned', caption: 'Hero' } })
      .mockResolvedValueOnce({
        data: {
          ...liveDetail,
          isPublic: undefined,
          is_public: false,
          photos: [livePhoto],
          reviews: [],
        },
      })
      .mockResolvedValueOnce({ data: { ...liveDetail, liked: true, likesCount: 5 } });

    apiMock.get
      .mockResolvedValueOnce({ data: { data: [], meta: { total: 0 } } })
      .mockResolvedValueOnce({ data: { data: [buildSpotSummary({ id: 'explore-live' })] } })
      .mockResolvedValueOnce({ data: { data: [buildSpotSummary({ id: 'nearby-live' })] } })
      .mockResolvedValueOnce({ data: { data: [buildSpotSummary({ id: 'user-live' })] } })
      .mockResolvedValueOnce({ data: { data: [buildSpotSummary({ id: 'saved-live', liked: true })] } })
      .mockResolvedValueOnce({ data: { data: liveDetail } })
      .mockResolvedValueOnce({ data: { data: [livePhoto] } });
    apiMock.put.mockResolvedValueOnce({ data: { data: { ...liveDetail, title: 'Updated Water Garden' } } });
    apiMock.delete.mockResolvedValueOnce({ data: { ...liveDetail, liked: false, likesCount: 4 } });
    getTrendingSpotsMock.mockResolvedValue({ data: [buildSpotSummary({ id: 'trending-live' })] });

    const spotService = await import('@/services/spotService');

    await expect(spotService.verifySpotPlace({
      title: ' Water Garden ',
      latitude: 32.75,
      longitude: -97.33,
    })).resolves.toMatchObject({
      verified: false,
      source: '',
      distanceMeters: null,
      candidates: [],
    });
    await expect(spotService.verifySpotPlace({
      title: 'Water Garden',
      latitude: 32.75,
      longitude: -97.33,
    })).resolves.toMatchObject({
      verified: true,
      distanceMeters: 8,
      candidates: [expect.objectContaining({ distanceMeters: undefined })],
    });

    await expect(spotService.uploadSpotPhoto('spot-live', {
      file: new File(['scope'], 'spot.jpg', { type: 'image/jpeg' }),
      caption: '',
    }, 0)).resolves.toMatchObject({
      data: { id: 'photo-live', caption: 'Live photo' },
    });
    await expect(spotService.uploadSpotPhoto('spot-live', {
      file: new File(['scope'], 'hero.jpg', { type: 'image/jpeg' }),
      caption: ' Hero ',
    }, 1)).resolves.toMatchObject({
      data: { id: 'photo-captioned', caption: 'Hero' },
    });

    await expect(spotService.createVerifiedSpot(buildSubmission({
      newPhotos: [
        {
          id: 'upload-empty-caption',
          file: new File(['scope'], 'empty.jpg', { type: 'image/jpeg' }),
          previewUrl: 'blob:empty',
          caption: '',
          mimeType: 'image/jpeg',
          sizeBytes: 5,
        },
        {
          id: 'upload-captioned',
          file: new File(['scope'], 'hero.jpg', { type: 'image/jpeg' }),
          previewUrl: 'blob:hero',
          caption: 'Hero',
          mimeType: 'image/jpeg',
          sizeBytes: 5,
        },
      ],
    }))).resolves.toMatchObject({
      data: {
        id: 'spot-live',
        isPublic: false,
        photos: [expect.objectContaining({ id: 'photo-live' })],
      },
    });
    await expect(spotService.listSpots()).resolves.toMatchObject({ data: [] });
    await expect(spotService.exploreSpots()).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'explore-live' })],
    });
    await expect(spotService.listNearbySpots({
      latitude: 32.75,
      longitude: -97.33,
    })).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'nearby-live' })],
    });
    await expect(spotService.listUserSpots('user-live')).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'user-live' })],
    });
    await expect(spotService.listSavedSpots()).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'saved-live' })],
    });
    await expect(spotService.getSpotDetail('spot-live')).resolves.toMatchObject({
      data: {
        id: 'spot-live',
        photos: [expect.objectContaining({ id: 'photo-live' })],
      },
    });
    await expect(spotService.listTrendingSpots()).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'trending-live' })],
    });
    await expect(spotService.updateSpot('spot-live', buildSubmission())).resolves.toMatchObject({
      data: { title: 'Updated Water Garden' },
    });
    await expect(spotService.likeSpot('spot-live')).resolves.toMatchObject({
      data: { liked: true, likesCount: 5 },
    });
    await expect(spotService.unlikeSpot('spot-live')).resolves.toMatchObject({
      data: { liked: false, likesCount: 4 },
    });
  });

  it('returns empty live nearby data without manufacturing spots when fallback is disabled', async () => {
    vi.stubEnv('VITE_ENABLE_SPOT_MOCK_FALLBACK', 'false');
    apiMock.get.mockResolvedValueOnce({ data: { data: [] } });

    const { listNearbySpots } = await import('@/services/spotService');

    await expect(listNearbySpots({
      latitude: 32.75,
      longitude: -97.33,
    })).resolves.toMatchObject({ data: [] });
    expect(loadMockDataMock).not.toHaveBeenCalled();
  });

  it('sanitizes review list and create envelopes', async () => {
    vi.stubEnv('VITE_ENABLE_SPOT_MOCK_FALLBACK', 'false');
    apiMock.get.mockResolvedValueOnce({
      data: [{
        id: 'review-list',
        user_id: 'reviewer',
        rating: 4,
        comment: ' Listed review ',
      }],
    });
    apiMock.post.mockResolvedValueOnce({
      data: {
        id: 'review-created',
        user_id: 'reviewer',
        rating: 5,
        comment: ' Created review ',
      },
    });

    const { createSpotReview, listSpotReviews } = await import('@/services/spotService');

    await expect(listSpotReviews('spot-review')).resolves.toMatchObject({
      data: [expect.objectContaining({
        id: 'review-list',
        spotId: 'spot-review',
        comment: 'Listed review',
      })],
    });
    await expect(createSpotReview('spot-review', {
      rating: 5,
      comment: 'Created review',
    })).resolves.toMatchObject({
      data: {
        id: 'review-created',
        spotId: 'spot-review',
        comment: 'Created review',
      },
    });
  });

  it('keeps discovery populated through bounded read-only seed fallback', async () => {
    vi.stubEnv('VITE_ENABLE_SPOT_MOCK_FALLBACK', 'true');
    vi.stubEnv('VITE_ENABLE_SPOT_LOCAL_WRITE_FALLBACK', 'false');
    apiMock.get.mockRejectedValue(new Error('content unavailable'));

    const nearby = buildSpotSummary({
      id: 'nearby-seed',
      author: {
        id: 'demo-user-1',
        username: 'demo',
        email: 'demo@example.com',
        displayName: 'Demo User',
        interests: [],
      },
      liked: true,
    });
    const far = buildSpotSummary({
      id: 'far-seed',
      latitude: 40,
      longitude: -100,
    });
    const detail = buildSpotDetail({
      ...nearby,
      photos: [{ id: 'seed-photo', url: '/media/seed.jpg' }],
    });
    const mockSpots = [nearby, far];
    const mockSpotDetails: Record<string, SpotDetail> = {
      [detail.id]: detail,
    };
    loadMockDataMock.mockResolvedValue({
      mockSpots,
      mockSpotDetails,
      filterSpots: vi.fn(() => mockSpots),
      getSpotById: vi.fn((id: string) => mockSpotDetails[id]),
    });

    const spotService = await import('@/services/spotService');

    await expect(spotService.listSpots()).resolves.toMatchObject({
      data: expect.arrayContaining([expect.objectContaining({ id: 'nearby-seed' })]),
    });
    await expect(spotService.exploreSpots()).resolves.toMatchObject({
      data: expect.arrayContaining([expect.objectContaining({ id: 'nearby-seed' })]),
    });
    await expect(spotService.listNearbySpots({
      latitude: 32.75,
      longitude: -97.33,
      pageSize: 0,
    })).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'nearby-seed' })],
    });
    await expect(spotService.listUserSpots('external-user', 1, 0)).resolves.toMatchObject({
      data: [],
    });
    await expect(spotService.listUserSpots('user-1', 1, 0)).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'nearby-seed' })],
    });
    await expect(spotService.listSavedSpots(1, 0)).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'nearby-seed' })],
    });
    await expect(spotService.getSpotDetail('nearby-seed')).resolves.toMatchObject({
      data: { id: 'nearby-seed' },
    });
    await expect(spotService.listSpotPhotos('nearby-seed')).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'seed-photo' })],
    });

    apiMock.get
      .mockResolvedValueOnce({ data: { data: [nearby] } })
      .mockResolvedValueOnce({ data: { data: [] } });
    await expect(spotService.listNearbySpots({
      latitude: 32.75,
      longitude: -97.33,
    })).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'nearby-seed' })],
    });
    await expect(spotService.listNearbySpots({
      latitude: 32.75,
      longitude: -97.33,
    })).resolves.toMatchObject({ data: [] });

    mockSpots.splice(0);
    await expect(spotService.listNearbySpots({
      latitude: 0,
      longitude: 0,
    })).resolves.toMatchObject({ data: [] });
    await expect(spotService.listUserSpots('empty-user', 1, 0)).resolves.toMatchObject({ data: [] });
    await expect(spotService.listSavedSpots(1, 0)).resolves.toMatchObject({ data: [] });
  });

  it('keeps local like counts idempotent and synchronizes mock collections', async () => {
    vi.stubEnv('VITE_ENABLE_SPOT_MOCK_FALLBACK', 'true');
    vi.stubEnv('VITE_ENABLE_SPOT_LOCAL_WRITE_FALLBACK', 'true');
    apiMock.post.mockRejectedValue(new Error('write unavailable'));
    apiMock.delete.mockRejectedValue(new Error('write unavailable'));

    const alreadyLiked = buildSpotDetail({
      id: 'liked-spot',
      liked: true,
      likesCount: undefined,
    });
    const notLiked = buildSpotDetail({
      id: 'unliked-spot',
      liked: false,
      likesCount: undefined,
    });
    const likedWithoutCount = buildSpotDetail({
      id: 'liked-without-count',
      liked: true,
      likesCount: undefined,
    });
    const neverLiked = buildSpotDetail({
      id: 'never-liked',
      liked: false,
      likesCount: undefined,
    });
    const mockSpots = [buildSpotSummary({ id: 'liked-spot', liked: true })];
    const mockSpotDetails: Record<string, SpotDetail> = {
      'liked-spot': alreadyLiked,
      'unliked-spot': notLiked,
      'liked-without-count': likedWithoutCount,
      'never-liked': neverLiked,
    };
    loadMockDataMock.mockResolvedValue({
      mockSpots,
      mockSpotDetails,
      getSpotById: vi.fn((id: string) => mockSpotDetails[id]),
    });

    const spotService = await import('@/services/spotService');

    await expect(spotService.likeSpot('liked-spot')).resolves.toMatchObject({
      data: { liked: true, likesCount: 0 },
    });
    await expect(spotService.likeSpot('unliked-spot')).resolves.toMatchObject({
      data: { liked: true, likesCount: 1 },
    });
    await expect(spotService.unlikeSpot('liked-spot')).resolves.toMatchObject({
      data: { liked: false, likesCount: 0 },
    });
    await expect(spotService.unlikeSpot('unliked-spot')).resolves.toMatchObject({
      data: { liked: false, likesCount: 0 },
    });
    await expect(spotService.unlikeSpot('liked-without-count')).resolves.toMatchObject({
      data: { liked: false, likesCount: 0 },
    });
    await expect(spotService.unlikeSpot('never-liked')).resolves.toMatchObject({
      data: { liked: false, likesCount: 0 },
    });

    expect(mockSpots.some((spot) => spot.id === 'unliked-spot')).toBe(true);
  });
});
