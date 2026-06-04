const itineraryFixture = {
  id: 'itinerary-1',
  destination: 'Austin, TX',
  totalEstimatedCost: 240,
  weatherForecast: 'Clear skies',
  days: [
    {
      dayNumber: 1,
      date: '2026-05-21',
      spots: [
        {
          spotId: 'spot-a',
          title: 'Morning tacos',
          latitude: 30.2666,
          longitude: -97.7333,
          category: 'food',
          estimatedCost: 24,
        },
      ],
    },
  ],
};

const foodSpot = {
  id: 'spot-a',
  title: 'Morning tacos',
  description: 'Breakfast patio',
  latitude: 30.2666,
  longitude: -97.7333,
  category: 'food',
  city: 'Austin',
  rating: 4.8,
  likesCount: 220,
  vibe: 'bright breakfast',
  createdAt: '2026-05-20T12:00:00Z',
};

const scenicSpot = {
  id: 'spot-b',
  title: 'Sunset overlook',
  description: 'Hill country view',
  latitude: 30.31,
  longitude: -97.78,
  category: 'scenic',
  city: 'Austin',
  rating: 4.6,
  likesCount: 80,
  vibe: 'golden scenic',
  createdAt: '2026-05-20T13:00:00Z',
};

describe('intel service contracts', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.doUnmock('@/services/api');
    vi.doUnmock('@/services/mockDataLoader');
    vi.doUnmock('@/services/spotService');
    vi.unstubAllEnvs();
  });

  it('normalizes live itinerary, recommendation, route, and feedback payloads', async () => {
    const apiPost = vi.fn(async (url: string, payload?: unknown) => {
      if (url.endsWith('/itinerary/generate')) {
        return { data: itineraryFixture };
      }

      if (url.endsWith('/recommend/similar/spot-a')) {
        return { data: [scenicSpot] };
      }

      if (url.endsWith('/route/optimize')) {
        return {
          data: [
            {
              id: 'point-b',
              title: 'Second stop',
              latitude: 30.3,
              longitude: -97.7,
              category: 'culture',
            },
            {
              id: 'point-a',
              title: 'First stop',
              latitude: 30.2,
              longitude: -97.8,
              category: 'food',
            },
          ],
        };
      }

      if (url.endsWith('/recommend/feedback')) {
        expect(payload).toEqual({ spotId: 'spot-a', action: 'click' });
        return { data: {} };
      }

      throw new Error(`Unexpected POST ${url}`);
    });
    const apiGet = vi.fn().mockResolvedValue({
      data: { data: itineraryFixture },
    });

    vi.doMock('@/services/api', () => ({
      default: {
        get: apiGet,
        post: apiPost,
      },
    }));

    const intelService = await import('@/services/intelService');

    const itinerary = await intelService.generateItinerary({
      destination: ' Austin, TX ',
      startDate: '2026-05-21',
      endDate: '2026-05-21',
      budget: 500,
      interests: ['food'],
      pace: 'moderate',
      groupSize: 2,
    });
    expect(apiPost).toHaveBeenCalledWith('/api/intel/itinerary/generate', expect.objectContaining({
      destination: 'Austin, TX',
      budget: 500,
    }));
    expect(itinerary.data.destination).toBe('Austin, TX');

    await expect(intelService.getCachedItinerary('itinerary-1')).resolves.toMatchObject({
      data: {
        id: 'itinerary-1',
        destination: 'Austin, TX',
      },
    });
    expect(apiGet).toHaveBeenCalledWith('/api/intel/itinerary/itinerary-1');

    const similar = await intelService.recommendSimilarSpots('spot-a', 1);
    expect(similar.data[0]?.id).toBe('spot-b');

    const optimized = await intelService.optimizeRoute({
      points: [
        {
          id: 'point-a',
          title: 'First stop',
          latitude: 30.2,
          longitude: -97.8,
          category: 'food',
          routeRole: 'start',
        },
        {
          id: 'point-b',
          title: 'Second stop',
          latitude: 30.3,
          longitude: -97.7,
          category: 'culture',
        },
      ],
    });
    expect(optimized.data.map((point) => point.id)).toEqual(['point-b', 'point-a']);

    await expect(intelService.submitRecommendationFeedback({
      spotId: 'spot-a',
      action: 'click',
    })).resolves.toBeUndefined();
  });

  it('uses explicit fallback data for offline planner recommendations and routes', async () => {
    vi.stubEnv('VITE_ENABLE_INTEL_MOCK_FALLBACK', 'true');

    vi.doMock('@/services/api', () => ({
      default: {
        get: vi.fn().mockRejectedValue(new Error('intel offline')),
        post: vi.fn().mockRejectedValue(new Error('intel offline')),
      },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue({
        buildItineraryPreview: vi.fn().mockReturnValue(itineraryFixture),
        mockTrips: [
          {
            id: 'trip-a',
            itinerary: itineraryFixture,
          },
        ],
        mockSpots: [foodSpot, scenicSpot],
        getSpotById: (spotId: string) => [foodSpot, scenicSpot].find((spot) => spot.id === spotId),
      }),
    }));

    const intelService = await import('@/services/intelService');

    const fallbackItinerary = await intelService.generateItinerary({
      destination: 'Austin',
      startDate: '2026-05-21',
      endDate: '2026-05-21',
      budget: 500,
      interests: ['food'],
      pace: 'slow',
      groupSize: 2,
    });
    expect(fallbackItinerary.data).toMatchObject({
      id: 'itinerary-1',
      destination: 'Austin, TX',
    });

    await expect(intelService.getCachedItinerary('itinerary-1')).resolves.toMatchObject({
      data: {
        id: 'itinerary-1',
        destination: 'Austin, TX',
      },
    });
    await expect(intelService.getCachedItinerary('missing')).rejects.toThrow('Itinerary missing not found');

    const recommended = await intelService.recommendSpots({
      destination: 'Austin',
      interests: ['food'],
      limit: 1,
    });
    expect(recommended.data[0]?.id).toBe('spot-a');

    const similar = await intelService.recommendSimilarSpots('spot-a', 1);
    expect(similar.data[0]?.id).toBe('spot-b');
    await expect(intelService.recommendSimilarSpots('unknown', 1)).rejects.toThrow('Spot unknown not found');

    const vibe = await intelService.vibeMatch({ vibe: 'scenic', limit: 1 });
    expect(vibe.data[0]?.id).toBe('spot-b');

    const optimized = await intelService.optimizeRoute({
      points: [
        {
          id: 'east',
          title: 'East stop',
          latitude: 31,
          longitude: -96,
          category: 'food',
        },
        {
          id: 'west',
          title: 'West stop',
          latitude: 30,
          longitude: -98,
          category: 'scenic',
        },
      ],
    });
    expect(optimized.data.map((point) => point.id)).toEqual(['west', 'east']);

    await expect(intelService.submitRecommendationFeedback({
      spotId: 'spot-a',
      action: 'dismiss',
    })).resolves.toBeUndefined();
  });

  it('hydrates production recommendation envelopes into real spot summaries', async () => {
    const apiPost = vi.fn().mockResolvedValue({
      data: {
        data: {
          recommendations: [
            {
              spotId: 'spot-b',
              title: 'Backend title before hydration',
              category: 'scenic',
              score: 0.91,
              reason: 'Popular scenic pick with a golden vibe',
              signalBreakdown: { popularity: 0.4, quality: 0.3 },
            },
          ],
        },
      },
    });
    const getSpotDetail = vi.fn().mockResolvedValue({ data: scenicSpot });

    vi.doMock('@/services/api', () => ({
      default: {
        post: apiPost,
      },
    }));
    vi.doMock('@/services/spotService', () => ({
      getSpotDetail,
    }));

    const intelService = await import('@/services/intelService');
    const response = await intelService.recommendSpots({
      interests: ['scenic'],
      limit: 1,
    });

    expect(apiPost).toHaveBeenCalledWith('/api/intel/recommend/spots', {
      interests: ['scenic'],
      limit: 1,
    });
    expect(getSpotDetail).toHaveBeenCalledWith('spot-b');
    expect(response.data[0]).toMatchObject({
      id: 'spot-b',
      title: 'Sunset overlook',
      recommendationReason: 'Popular scenic pick with a golden vibe',
      recommendationScore: 0.91,
      recommendationSignalBreakdown: {
        popularity: 0.4,
        quality: 0.3,
      },
    });
  });

  it('falls back recommendation hydration and maps object route optimization payloads', async () => {
    const apiPost = vi.fn(async (url: string) => {
      if (url.endsWith('/recommend/spots')) {
        return {
          data: {
            recommendations: [
              {
                reason: 'No spot id should be dropped',
              },
              {
                spotId: 'fallback-spot',
                title: '',
                category: '',
                score: 'not-a-number',
                reason: '  Curated fallback pick  ',
                signalBreakdown: {
                  quality: 0.3,
                  ignored: 'bad',
                  ' ': 0.9,
                },
              },
            ],
          },
        };
      }

      if (url.endsWith('/route/optimize')) {
        return {
          data: {
            data: {
              orderedSpots: [
                {
                  spotId: 'known',
                  latitude: 30.3,
                  longitude: -97.7,
                },
                {
                  id: 'backend-only',
                  latitude: 30.4,
                  longitude: -97.8,
                },
                {
                  latitude: 30.5,
                  longitude: -97.9,
                },
              ],
            },
          },
        };
      }

      if (url.endsWith('/vibe-match')) {
        return { data: { data: {} } };
      }

      throw new Error(`Unexpected POST ${url}`);
    });
    const getSpotDetail = vi.fn().mockRejectedValue(new Error('detail unavailable'));

    vi.doMock('@/services/api', () => ({
      default: {
        post: apiPost,
      },
    }));
    vi.doMock('@/services/spotService', () => ({
      getSpotDetail,
    }));

    const intelService = await import('@/services/intelService');

    const recommendations = await intelService.recommendSpots({
      interests: ['scenic'],
      limit: 2,
    });
    expect(getSpotDetail).toHaveBeenCalledWith('fallback-spot');
    expect(recommendations.data).toEqual([
      expect.objectContaining({
        id: 'fallback-spot',
        title: 'Recommended spot',
        category: 'other',
        recommendationReason: 'Curated fallback pick',
        recommendationScore: undefined,
        recommendationSignalBreakdown: {
          quality: 0.3,
        },
      }),
    ]);

    const optimized = await intelService.optimizeRoute({
      points: [
        {
          id: 'known',
          title: 'Known route point',
          latitude: 30.1,
          longitude: -97.5,
          category: 'food',
        },
      ],
    });
    expect(optimized.data).toEqual([
      expect.objectContaining({
        id: 'known',
        title: 'Known route point',
        latitude: 30.3,
        longitude: -97.7,
      }),
      expect.objectContaining({
        id: 'backend-only',
        title: 'backend-only',
        category: 'other',
        latitude: 30.4,
        longitude: -97.8,
      }),
      expect.objectContaining({
        id: '',
        title: 'Route point',
        category: 'other',
        latitude: 30.5,
        longitude: -97.9,
      }),
    ]);

    await expect(intelService.vibeMatch({ vibe: 'quiet' })).resolves.toEqual({ data: [] });
  });
});
