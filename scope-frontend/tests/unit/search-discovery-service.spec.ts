import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
}));

const recommendSpotsMock = vi.hoisted(() => vi.fn());
const submitRecommendationFeedbackMock = vi.hoisted(() => vi.fn());
const loadMockDataMock = vi.hoisted(() => vi.fn());
const shouldUseLocalSearchFallbackMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/api', () => ({
  default: apiMock,
}));

vi.mock('@/services/intelService', () => ({
  recommendSpots: recommendSpotsMock,
  submitRecommendationFeedback: submitRecommendationFeedbackMock,
}));

vi.mock('@/services/demoMode', () => ({
  DEMO_MODE_ENABLED: false,
  LOCAL_PREVIEW_ENABLED: false,
}));

vi.mock('@/services/mockDataLoader', () => ({
  loadMockData: loadMockDataMock,
}));

vi.mock('@/services/searchService', () => ({
  shouldUseLocalSearchFallback: shouldUseLocalSearchFallbackMock,
}));

describe('search discovery recommendations', () => {
  beforeEach(() => {
    vi.resetModules();
    apiMock.get.mockReset();
    recommendSpotsMock.mockReset();
    submitRecommendationFeedbackMock.mockReset();
    loadMockDataMock.mockReset();
    shouldUseLocalSearchFallbackMock.mockReset();
  });

  it('uses authenticated recommender results and records recommendation clicks only', async () => {
    recommendSpotsMock.mockResolvedValue({
      data: [
        {
          id: 'spot-recommended',
          title: 'Chef Counter',
          city: 'Dallas',
          country: 'US',
          category: 'food',
          rating: 4.9,
          latitude: 32.78,
          longitude: -96.8,
        },
      ],
    });
    submitRecommendationFeedbackMock.mockResolvedValue(undefined);

    const {
      loadSearchPlaceRecommendations,
      recordSearchPlaceSuggestionClick,
    } = await import('@/services/searchDiscoveryService');

    const recommendations = await loadSearchPlaceRecommendations({
      isAuthenticated: true,
      currentUser: {
        id: 'user-1',
        username: 'maya',
        email: 'maya@example.com',
        displayName: 'Maya',
        interests: [' food ', 'surprise'],
      },
      limit: 2,
    });

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]).toMatchObject({
      id: 'spot-recommended',
      title: 'Chef Counter',
      searchSuggestionSource: 'recommendation',
    });
    expect(recommendSpotsMock).toHaveBeenCalledWith({
      interests: ['food'],
      limit: 2,
    });

    await recordSearchPlaceSuggestionClick(recommendations[0]);
    await recordSearchPlaceSuggestionClick({
      ...recommendations[0],
      searchSuggestionSource: 'trending',
    });

    expect(submitRecommendationFeedbackMock).toHaveBeenCalledTimes(1);
    expect(submitRecommendationFeedbackMock).toHaveBeenCalledWith({
      spotId: 'spot-recommended',
      action: 'click',
    });
  });

  it('falls back from an empty recommender response to live trending places', async () => {
    recommendSpotsMock.mockResolvedValue({ data: [] });
    apiMock.get.mockResolvedValue({
      data: {
        data: [
          {
            id: 'spot-live-low',
            title: 'Quiet Gallery',
            city: 'Fort Worth',
            country: 'US',
            category: 'culture',
            rating: 4.1,
            likesCount: 5,
            latitude: 32.75,
            longitude: -97.33,
          },
          {
            id: 'spot-live-high',
            title: 'River Patio',
            city: 'Fort Worth',
            country: 'US',
            category: 'food',
            rating: 4.9,
            likesCount: 120,
            latitude: 32.76,
            longitude: -97.34,
          },
        ],
      },
    });

    const { loadSearchPlaceRecommendations } = await import('@/services/searchDiscoveryService');

    const suggestions = await loadSearchPlaceRecommendations({
      isAuthenticated: true,
      currentUser: {
        id: 'user-1',
        username: 'maya',
        email: 'maya@example.com',
        displayName: 'Maya',
        interests: [],
      },
      limit: 1,
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      id: 'spot-live-high',
      searchSuggestionSource: 'trending',
    });
    expect(apiMock.get).toHaveBeenCalledWith('/api/content/spots/explore', {
      params: {
        page: 1,
        pageSize: 16,
      },
    });
  });

  it('uses local trending discovery only when search fallback is explicitly enabled', async () => {
    recommendSpotsMock.mockRejectedValue(new Error('recommender offline'));
    apiMock.get.mockRejectedValue(new Error('content offline'));
    shouldUseLocalSearchFallbackMock.mockReturnValue(true);
    loadMockDataMock.mockResolvedValue({
      mockSpots: [
        {
          id: 'mock-low',
          title: 'Low Signal',
          city: 'Austin',
          country: 'US',
          category: 'other',
          rating: 3.5,
          likesCount: 2,
          latitude: 30.27,
          longitude: -97.74,
        },
        {
          id: 'mock-high',
          title: 'Mock River Walk',
          city: 'Austin',
          country: 'US',
          category: 'scenic',
          rating: 4.8,
          likesCount: 88,
          latitude: 30.28,
          longitude: -97.75,
        },
      ],
    });

    const { loadSearchPlaceRecommendations } = await import('@/services/searchDiscoveryService');

    const suggestions = await loadSearchPlaceRecommendations({
      isAuthenticated: true,
      limit: 0,
    });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      id: 'mock-high',
      searchSuggestionSource: 'trending',
    });
    expect(loadMockDataMock).toHaveBeenCalledTimes(1);
  });

  it('rethrows live discovery failures when local fallback is disabled', async () => {
    apiMock.get.mockRejectedValue(new Error('content offline'));
    shouldUseLocalSearchFallbackMock.mockReturnValue(false);

    const { loadSearchPlaceRecommendations } = await import('@/services/searchDiscoveryService');

    await expect(loadSearchPlaceRecommendations({
      isAuthenticated: false,
      limit: 3,
    })).rejects.toThrow('content offline');
  });
});
