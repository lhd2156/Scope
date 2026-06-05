import api from '@/services/api';
import { LOCAL_PREVIEW_ENABLED, localFallbackEnabled } from '@/services/demoMode';
import { loadMockData } from '@/services/mockDataLoader';
import { isScopeQaMode } from '@/utils/qaMode';

export interface SearchResult {
  id: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  location?: { lat: number; lon: number };
  avg_rating?: number;
  review_count?: number;
  _score: number;
  _highlights?: Record<string, string[]>;
  _distance_km?: number;
}

export interface SearchResponse {
  query: string;
  type: string;
  total: number;
  offset: number;
  limit: number;
  results: SearchResult[];
}

export interface GeoSearchResponse {
  center: { lat: number; lon: number };
  radius: string;
  total: number;
  results: SearchResult[];
}

type SearchContentType = 'spots' | 'reviews' | 'trips';

export function shouldUseLocalSearchFallback(): boolean {
  return (
    LOCAL_PREVIEW_ENABLED ||
    localFallbackEnabled('VITE', 'ENABLE', 'SEARCH', 'MOCK', 'FALLBACK') ||
    (import.meta.env.MODE !== 'production' && isScopeQaMode())
  );
}

interface LocalSearchSeed {
  id: string;
  name: string;
  description?: string | undefined;
  category?: string | undefined;
  tags?: string[] | undefined;
  location?: { lat: number; lon: number } | undefined;
  avg_rating?: number | undefined;
  review_count?: number | undefined;
}

function normalizeSearchText(value: string | number | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

function tokenizeSearchQuery(query: string): string[] {
  return normalizeSearchText(query).split(/\s+/).filter(Boolean);
}

function buildSearchHaystack(seed: LocalSearchSeed): string {
  return [
    seed.name,
    seed.description,
    seed.category,
    ...(seed.tags ?? []),
  ].map(normalizeSearchText).filter(Boolean).join(' ');
}

function matchesSearchQuery(seed: LocalSearchSeed, queryTokens: readonly string[]): boolean {
  if (!queryTokens.length) {
    return false;
  }

  const haystack = buildSearchHaystack(seed);
  return queryTokens.every((token) => haystack.includes(token));
}

function scoreLocalSearchResult(seed: LocalSearchSeed, queryTokens: readonly string[]): number {
  const title = normalizeSearchText(seed.name);
  const haystack = buildSearchHaystack(seed);
  const titleScore = queryTokens.reduce((score, token) => score + (title.includes(token) ? 3 : 0), 0);
  const bodyScore = queryTokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
  const ratingScore = seed.avg_rating ?? 0;
  const reviewScore = Math.min(seed.review_count ?? 0, 250) / 100;

  return titleScore + bodyScore + ratingScore + reviewScore;
}

function toSearchResult(seed: LocalSearchSeed, queryTokens: readonly string[]): SearchResult {
  const tags = seed.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [];
  return {
    id: seed.id,
    name: seed.name,
    ...(seed.description ? { description: seed.description } : {}),
    ...(seed.category ? { category: seed.category } : {}),
    ...(tags.length ? { tags } : {}),
    ...(seed.location ? { location: seed.location } : {}),
    ...(typeof seed.avg_rating === 'number' ? { avg_rating: seed.avg_rating } : {}),
    ...(typeof seed.review_count === 'number' ? { review_count: seed.review_count } : {}),
    _score: scoreLocalSearchResult(seed, queryTokens),
  };
}

async function buildLocalSearchResponse(
  query: string,
  type: SearchContentType,
  limit: number,
  offset: number,
): Promise<SearchResponse> {
  const queryTokens = tokenizeSearchQuery(query);
  const normalizedLimit = Math.max(1, limit);
  const normalizedOffset = Math.max(0, offset);
  const { mockSpotDetails, mockSpots, mockTrips } = await loadMockData();
  const seeds: LocalSearchSeed[] = [];

  if (type === 'spots') {
    seeds.push(...mockSpots.map((spot) => ({
      id: spot.id,
      name: spot.title,
      description: spot.description,
      category: spot.category,
      tags: [spot.city, spot.country, spot.vibe, spot.category].filter((value): value is string => Boolean(value?.trim())),
      location: { lat: spot.latitude, lon: spot.longitude },
      avg_rating: spot.rating,
      review_count: spot.likesCount,
    })));
  }

  if (type === 'trips') {
    seeds.push(...mockTrips.map((trip) => ({
      id: trip.id,
      name: trip.title,
      description: trip.description,
      category: 'trip',
      tags: [trip.destination, trip.status, trip.currency].filter((value): value is string => Boolean(value?.trim())),
      review_count: trip.members.length,
    })));
  }

  if (type === 'reviews') {
    seeds.push(...Object.values(mockSpotDetails).flatMap((spot) =>
      spot.reviews.map((review) => ({
        id: review.id,
        name: `${spot.title} review`,
        description: review.comment,
        category: spot.category,
        tags: [spot.city, spot.country, review.user.displayName, 'review'].filter((value): value is string => Boolean(value?.trim())),
        location: { lat: spot.latitude, lon: spot.longitude },
        avg_rating: review.rating,
      })),
    ));
  }

  const results = seeds
    .filter((seed) => matchesSearchQuery(seed, queryTokens))
    .map((seed) => toSearchResult(seed, queryTokens))
    .sort((left, right) => right._score - left._score);

  return {
    query,
    type,
    total: results.length,
    offset: normalizedOffset,
    limit: normalizedLimit,
    results: results.slice(normalizedOffset, normalizedOffset + normalizedLimit),
  };
}

export async function searchContent(
  query: string,
  type: SearchContentType = 'spots',
  limit = 20,
  offset = 0,
): Promise<SearchResponse> {
  try {
    const { data } = await api.get<SearchResponse>('/api/content/search', {
      params: { q: query, type, limit, offset },
    });
    return data;
  } catch (error) {
    if (!shouldUseLocalSearchFallback()) {
      throw error;
    }

    return buildLocalSearchResponse(query, type, limit, offset);
  }
}

export async function searchNearby(
  lat: number,
  lon: number,
  radiusKm = 10,
  limit = 20,
): Promise<GeoSearchResponse> {
  const { data } = await api.get<GeoSearchResponse>('/api/content/search/nearby', {
    params: { lat, lon, radius: `${radiusKm}km`, limit },
  });
  return data;
}
