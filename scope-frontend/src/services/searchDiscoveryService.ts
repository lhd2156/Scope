import api from '@/services/api';
import {
  recommendSpots,
  submitRecommendationFeedback,
  type RecommendedSpotSummary,
} from '@/services/intelService';
import { LOCAL_PREVIEW_ENABLED } from '@/services/demoMode';
import { loadMockData } from '@/services/mockDataLoader';
import { normalizeArrayEnvelopeData } from '@/services/serviceUtils';
import { shouldUseLocalSearchFallback } from '@/services/searchService';
import type { ApiEnvelope, SpotSummary, UserProfile } from '@/types';
import { sanitizeSpotSummary } from '@/utils/sanitizers';
import { rankTrendingSpots } from '@/utils/spotRanking';
import { normalizeUserVibes } from '@/utils/userPreferenceSignals';

export type SearchPlaceSuggestionSource = 'recommendation' | 'trending';

export interface SearchPlaceSuggestion extends RecommendedSpotSummary {
  searchSuggestionSource: SearchPlaceSuggestionSource;
}

export interface LoadSearchPlaceRecommendationsInput {
  isAuthenticated: boolean;
  currentUser?: UserProfile | null;
  limit?: number;
}

const DEFAULT_SEARCH_RECOMMENDATION_LIMIT = 6;
const FALLBACK_DISCOVERY_POOL_SIZE = 16;

function withSuggestionSource(
  spot: SpotSummary | RecommendedSpotSummary,
  searchSuggestionSource: SearchPlaceSuggestionSource,
): SearchPlaceSuggestion {
  return {
    ...(sanitizeSpotSummary(spot) as RecommendedSpotSummary),
    searchSuggestionSource,
  };
}

async function fetchLiveTrendingPlaces(limit: number): Promise<SearchPlaceSuggestion[]> {
  const { data } = await api.get<ApiEnvelope<SpotSummary[]> | SpotSummary[]>('/api/content/spots/explore', {
    params: {
      page: 1,
      pageSize: Math.max(limit, FALLBACK_DISCOVERY_POOL_SIZE),
    },
  });

  return rankTrendingSpots(normalizeArrayEnvelopeData(data).map((spot) => sanitizeSpotSummary(spot)), limit)
    .map((spot) => withSuggestionSource(spot, 'trending'));
}

async function buildLocalTrendingPlaces(limit: number): Promise<SearchPlaceSuggestion[]> {
  const { mockSpots } = await loadMockData();
  return rankTrendingSpots(mockSpots, limit).map((spot) => withSuggestionSource(spot, 'trending'));
}

export async function loadSearchPlaceRecommendations(
  input: LoadSearchPlaceRecommendationsInput,
): Promise<SearchPlaceSuggestion[]> {
  const limit = Math.max(1, input.limit ?? DEFAULT_SEARCH_RECOMMENDATION_LIMIT);

  if (input.isAuthenticated) {
    try {
      const interests = normalizeUserVibes(input.currentUser?.interests, { includeSurprise: false });
      const response = await recommendSpots({
        interests: interests.length ? interests : undefined,
        limit,
      });

      if (response.data.length) {
        return response.data.map((spot) => withSuggestionSource(spot, 'recommendation'));
      }
    } catch {
      // Fall through to public discovery spots. Search must remain useful even
      // when the private recommender is unavailable for this session.
    }
  }

  try {
    return await fetchLiveTrendingPlaces(limit);
  } catch (error) {
    if (shouldUseLocalSearchFallback() || LOCAL_PREVIEW_ENABLED) {
      return buildLocalTrendingPlaces(limit);
    }

    throw error;
  }
}

export async function recordSearchPlaceSuggestionClick(spot: SearchPlaceSuggestion): Promise<void> {
  if (spot.searchSuggestionSource !== 'recommendation') {
    return;
  }

  await submitRecommendationFeedback({
    spotId: spot.id,
    action: 'click',
  });
}
