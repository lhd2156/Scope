import api from '@/services/api';
import { LOCAL_PREVIEW_ENABLED, localFallbackEnabled } from '@/services/demoMode';
import { loadMockData } from '@/services/mockDataLoader';
import type { SpotSummary } from '@/types';
import { isScopeQaMode } from '@/utils/qaMode';

export interface SearchResult {
  id: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  city?: string;
  country?: string;
  vibe?: string;
  photoUrl?: string;
  photo_url?: string;
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
const LOCAL_SEARCH_FALLBACK_DELAY_MS = 180;

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
  city?: string | undefined;
  country?: string | undefined;
  vibe?: string | undefined;
  address?: string | undefined;
  photoUrl?: string | undefined;
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

function buildSearchHaystack(seed: LocalSearchSeed, options: { includeAddress?: boolean; includeDescription?: boolean } = {}): string {
  const includeAddress = options.includeAddress ?? true;
  const includeDescription = options.includeDescription ?? true;

  return [
    seed.name,
    includeDescription ? seed.description : undefined,
    seed.category,
    seed.city,
    seed.country,
    seed.vibe,
    includeAddress ? seed.address : undefined,
    ...(seed.tags ?? []),
  ].map(normalizeSearchText).filter(Boolean).join(' ');
}

function textHasTokenPrefix(text: string, token: string): boolean {
  return text.split(/[^a-z0-9]+/).some((word) => word.startsWith(token));
}

function matchesSearchQuery(seed: LocalSearchSeed, queryTokens: readonly string[]): boolean {
  if (!queryTokens.length) {
    return false;
  }

  const requirePrefixMatch = shouldFilterShortQueryResults(queryTokens);
  const haystack = buildSearchHaystack(seed, {
    includeAddress: !requirePrefixMatch,
    includeDescription: !requirePrefixMatch,
  });
  return queryTokens.every((token) => (
    requirePrefixMatch ? textHasTokenPrefix(haystack, token) : haystack.includes(token)
  ));
}

function scoreLocalSearchResult(seed: LocalSearchSeed, queryTokens: readonly string[]): number {
  const title = normalizeSearchText(seed.name);
  const haystack = buildSearchHaystack(seed);
  const titleScore = queryTokens.reduce((score, token) => {
    if (title === token) {
      return score + 8;
    }

    if (title.startsWith(token) || title.split(/\s+/).some((word) => word.startsWith(token))) {
      return score + 5;
    }

    return score + (title.includes(token) ? 3 : 0);
  }, 0);
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
    ...(seed.city ? { city: seed.city } : {}),
    ...(seed.country ? { country: seed.country } : {}),
    ...(seed.vibe ? { vibe: seed.vibe } : {}),
    ...(seed.photoUrl ? { photoUrl: seed.photoUrl } : {}),
    ...(seed.location ? { location: seed.location } : {}),
    ...(typeof seed.avg_rating === 'number' ? { avg_rating: seed.avg_rating } : {}),
    ...(typeof seed.review_count === 'number' ? { review_count: seed.review_count } : {}),
    _score: scoreLocalSearchResult(seed, queryTokens),
  };
}

function buildShortQueryResultHaystack(result: SearchResult): string {
  return [
    result.name,
    result.category,
    result.city,
    result.country,
    result.vibe,
    ...(result.tags ?? []),
  ].map(normalizeSearchText).filter(Boolean).join(' ');
}

function shouldFilterShortQueryResults(queryTokens: readonly string[]): boolean {
  return queryTokens.some((token) => token.length > 0 && token.length <= 3);
}

function filterShortQueryResults(response: SearchResponse): SearchResponse {
  const queryTokens = tokenizeSearchQuery(response.query);

  if (!shouldFilterShortQueryResults(queryTokens)) {
    return response;
  }

  const results = response.results.filter((result) => {
    const haystack = buildShortQueryResultHaystack(result);
    return queryTokens.every((token) => textHasTokenPrefix(haystack, token));
  });

  return {
    ...response,
    total: results.length,
    results,
  };
}

function mergeLocalSearchSpotCatalogs(primarySpots: SpotSummary[], supplementalSpots: SpotSummary[]): SpotSummary[] {
  const mergedSpots = new Map<string, SpotSummary>();

  for (const spot of [...primarySpots, ...supplementalSpots]) {
    if (!spot.id) {
      continue;
    }

    mergedSpots.set(spot.id, {
      ...mergedSpots.get(spot.id),
      ...spot,
    });
  }

  return Array.from(mergedSpots.values());
}

async function loadSupplementalDemoSearchSpots(): Promise<SpotSummary[]> {
  try {
    const { demoSpots } = await import('@/mock');
    return demoSpots;
  } catch {
    return [];
  }
}

function waitForLocalSearchFallbackDelay(): Promise<null> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(null), LOCAL_SEARCH_FALLBACK_DELAY_MS);
  });
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
    const searchSpots = mergeLocalSearchSpotCatalogs(mockSpots, await loadSupplementalDemoSearchSpots());
    seeds.push(...searchSpots.map((spot) => ({
      id: spot.id,
      name: spot.title,
      description: spot.description,
      category: spot.category,
      tags: [spot.city, spot.country, spot.vibe, spot.category, ...(spot.pillars ?? [])].filter((value): value is string => Boolean(value?.trim())),
      city: spot.city,
      country: spot.country,
      vibe: spot.vibe,
      address: spot.address,
      photoUrl: spot.photoUrl,
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
  const queryTokens = tokenizeSearchQuery(query);
  const canUseLocalFallback = shouldUseLocalSearchFallback();
  const fallbackResponsePromise = canUseLocalFallback
    ? buildLocalSearchResponse(query, type, limit, offset).catch(() => null)
    : null;
  let resolvedFallbackResponse: SearchResponse | null | undefined;

  async function getFallbackResponse(): Promise<SearchResponse | null> {
    if (!fallbackResponsePromise) {
      return null;
    }

    if (resolvedFallbackResponse !== undefined) {
      return resolvedFallbackResponse;
    }

    resolvedFallbackResponse = await fallbackResponsePromise;
    return resolvedFallbackResponse;
  }

  if (canUseLocalFallback && shouldFilterShortQueryResults(queryTokens)) {
    const fallbackResponse = await getFallbackResponse();

    if (fallbackResponse?.results.length) {
      return fallbackResponse;
    }
  }

  const liveSearchPromise = api.get<SearchResponse>('/api/content/search', {
    params: { q: query, type, limit, offset },
  }).then(({ data }) => filterShortQueryResults(data));

  try {
    const response = canUseLocalFallback
      ? await Promise.race([liveSearchPromise, waitForLocalSearchFallbackDelay()])
      : await liveSearchPromise;

    if (!response) {
      const fallbackResponse = await getFallbackResponse();
      return fallbackResponse?.results.length
        ? fallbackResponse
        : await liveSearchPromise;
    }

    if (canUseLocalFallback && !response.results.length) {
      const fallbackResponse = await getFallbackResponse();
      if (fallbackResponse?.results.length) {
        return fallbackResponse;
      }
    }

    return response;
  } catch (error) {
    const fallbackResponse = await getFallbackResponse();

    if (!fallbackResponse) {
      throw error;
    }

    return fallbackResponse;
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
