import api from '@/services/api';
import { loadMockData } from '@/services/mockDataLoader';
import { normalizeArrayEnvelopeData, unwrapApiData } from '@/services/serviceUtils';
import type {
  ApiEnvelope,
  Itinerary,
  MapPoint,
  SpotCategory,
  SpotSummary,
  TripPlannerInput,
} from '@/types';
import { isScopeQaMode } from '@/utils/qaMode';
import {
  sanitizeItinerary,
  sanitizeMapPoint,
  sanitizeSingleLineText,
  sanitizeSpotSummary,
  sanitizeTripPlannerInput,
} from '@/utils/sanitizers';

const INTEL_BASE_PATH = '/api/intel';

export interface SpotRecommendationInput {
  destination?: string;
  interests?: SpotCategory[];
  limit?: number;
}

export interface VibeMatchInput {
  vibe: string;
  limit?: number;
}

export interface RouteOptimizationInput {
  points: MapPoint[];
}

interface IntelRouteOptimizationResponse {
  orderedSpots: Array<{
    spotId?: string;
    id?: string;
    latitude: number;
    longitude: number;
  }>;
  estimatedDistance?: number;
}

// Fallback gate: production and unit tests should surface Intel failures, but
// local Vite work needs a useful planner even when the Python/Ollama stack is
// not running. QA / demo sessions keep the same fixture-backed behavior.
function shouldUseMockFallback(): boolean {
  return (
    isScopeQaMode() ||
    import.meta.env.VITE_ENABLE_INTEL_MOCK_FALLBACK === 'true' ||
    (import.meta.env.DEV && !import.meta.env.VITEST)
  );
}

function rethrowIfNotQa(error: unknown): void {
  if (!shouldUseMockFallback()) {
    throw error;
  }
}

function sanitizeItineraryEnvelope(response: ApiEnvelope<Itinerary>): ApiEnvelope<Itinerary> {
  return {
    ...response,
    data: sanitizeItinerary(response.data),
  };
}

function sanitizeSpotEnvelope(
  response: ApiEnvelope<SpotSummary[]>,
  options: { allowGeneratedAuthorAvatar?: boolean } = {},
): ApiEnvelope<SpotSummary[]> {
  return {
    ...response,
    data: normalizeArrayEnvelopeData(response).map((spot) =>
      sanitizeSpotSummary(spot, { allowGeneratedAuthorAvatar: options.allowGeneratedAuthorAvatar }),
    ),
  };
}

function sanitizeMapPointEnvelope(response: ApiEnvelope<MapPoint[]>): ApiEnvelope<MapPoint[]> {
  return {
    ...response,
    data: normalizeArrayEnvelopeData(response).map((point) => sanitizeMapPoint(point)),
  };
}

function scoreSpotRecommendation(
  spot: SpotSummary,
  interests: Set<SpotCategory>,
  destinationQuery: string,
): number {
  const interestBoost = interests.has(spot.category) ? 4 : 0;
  const destinationBoost =
    destinationQuery && spot.city?.toLowerCase().includes(destinationQuery.toLowerCase()) ? 2 : 0;
  const popularityBoost = (spot.likesCount ?? 0) / 100;

  return interestBoost + destinationBoost + spot.rating + popularityBoost;
}

function sortRoutePoints(points: MapPoint[]): MapPoint[] {
  return [...points].sort((left, right) => {
    if (left.longitude !== right.longitude) {
      return left.longitude - right.longitude;
    }

    return left.latitude - right.latitude;
  });
}

export async function generateItinerary(input: TripPlannerInput): Promise<ApiEnvelope<Itinerary>> {
  const sanitizedInput = sanitizeTripPlannerInput(input);

  try {
    const { data } = await api.post<ApiEnvelope<Itinerary> | Itinerary>(`${INTEL_BASE_PATH}/itinerary/generate`, sanitizedInput);
    return sanitizeItineraryEnvelope({ data: unwrapApiData(data) });
  } catch (error) {
    rethrowIfNotQa(error);
    const { buildItineraryPreview } = await loadMockData();
    return sanitizeItineraryEnvelope({ data: buildItineraryPreview(sanitizedInput) });
  }
}

export async function getCachedItinerary(itineraryId: string): Promise<ApiEnvelope<Itinerary>> {
  try {
    const { data } = await api.get<ApiEnvelope<Itinerary> | Itinerary>(`${INTEL_BASE_PATH}/itinerary/${itineraryId}`);
    return sanitizeItineraryEnvelope({ data: unwrapApiData(data) });
  } catch (error) {
    rethrowIfNotQa(error);
    const { mockTrips } = await loadMockData();
    const itinerary = mockTrips.find((trip) => trip.itinerary?.id === itineraryId)?.itinerary;
    if (!itinerary) {
      throw new Error(`Itinerary ${itineraryId} not found`);
    }

    return sanitizeItineraryEnvelope({ data: itinerary });
  }
}

export async function recommendSpots(input: SpotRecommendationInput): Promise<ApiEnvelope<SpotSummary[]>> {
  const sanitizedInput = {
    ...input,
    destination: sanitizeSingleLineText(input.destination),
  };
  const requestPayload = {
    interests: sanitizedInput.interests ?? [],
    limit: sanitizedInput.limit ?? 4,
  };

  try {
    const { data } = await api.post<ApiEnvelope<SpotSummary[]> | SpotSummary[]>(`${INTEL_BASE_PATH}/recommend/spots`, requestPayload);
    return sanitizeSpotEnvelope('data' in data ? data : { data });
  } catch (error) {
    rethrowIfNotQa(error);
    const { mockSpots } = await loadMockData();
    const interests = new Set(sanitizedInput.interests ?? []);
    const limit = sanitizedInput.limit ?? 4;
    const destinationQuery = sanitizedInput.destination ?? '';

    const recommendedSpots = [...mockSpots]
      .sort(
        (left, right) =>
          scoreSpotRecommendation(right, interests, destinationQuery) -
          scoreSpotRecommendation(left, interests, destinationQuery),
      )
      .slice(0, limit);

    return sanitizeSpotEnvelope({ data: recommendedSpots }, { allowGeneratedAuthorAvatar: true });
  }
}

export async function recommendSimilarSpots(spotId: string, limit = 4): Promise<ApiEnvelope<SpotSummary[]>> {
  try {
    const { data } = await api.post<ApiEnvelope<SpotSummary[]> | SpotSummary[]>(
      `${INTEL_BASE_PATH}/recommend/similar/${spotId}`,
      { limit },
    );
    return sanitizeSpotEnvelope('data' in data ? data : { data });
  } catch (error) {
    rethrowIfNotQa(error);
    const { getSpotById, mockSpots } = await loadMockData();
    const sourceSpot = getSpotById(spotId);
    if (!sourceSpot) {
      throw new Error(`Spot ${spotId} not found`);
    }

    const similarSpots = mockSpots
      .filter((spot) => spot.id !== spotId)
      .sort((left, right) => {
        const leftScore = Number(left.category === sourceSpot.category) + Number(left.city === sourceSpot.city);
        const rightScore = Number(right.category === sourceSpot.category) + Number(right.city === sourceSpot.city);
        return rightScore - leftScore;
      })
      .slice(0, limit);

    return sanitizeSpotEnvelope({ data: similarSpots }, { allowGeneratedAuthorAvatar: true });
  }
}

export async function vibeMatch(input: VibeMatchInput): Promise<ApiEnvelope<SpotSummary[]>> {
  const sanitizedInput = {
    ...input,
    vibe: sanitizeSingleLineText(input.vibe),
  };

  try {
    const { data } = await api.post<ApiEnvelope<SpotSummary[]> | SpotSummary[]>(`${INTEL_BASE_PATH}/vibe-match`, {
      description: sanitizedInput.vibe,
      limit: sanitizedInput.limit ?? 4,
    });
    return sanitizeSpotEnvelope('data' in data ? data : { data });
  } catch (error) {
    rethrowIfNotQa(error);
    const { mockSpots } = await loadMockData();
    const normalizedVibe = sanitizedInput.vibe.toLowerCase();
    const matchedSpots = mockSpots
      .filter((spot) => {
        const searchableContent = [spot.vibe, spot.title, spot.description, spot.category].filter(Boolean).join(' ').toLowerCase();
        return searchableContent.includes(normalizedVibe);
      })
      .slice(0, sanitizedInput.limit ?? 4);

    return sanitizeSpotEnvelope({ data: matchedSpots }, { allowGeneratedAuthorAvatar: true });
  }
}

export async function optimizeRoute(input: RouteOptimizationInput): Promise<ApiEnvelope<MapPoint[]>> {
  const sanitizedPoints = input.points.map((point) => sanitizeMapPoint(point));
  const pointById = new Map(sanitizedPoints.map((point) => [point.id, point]));
  const startPoint = sanitizedPoints.find((point) => point.routeRole === 'start') ?? sanitizedPoints[0];
  const requestPayload = {
    spots: sanitizedPoints.map((point) => ({
      spotId: point.id,
      latitude: point.latitude,
      longitude: point.longitude,
    })),
    startLat: startPoint?.latitude,
    startLng: startPoint?.longitude,
  };

  try {
    const { data } = await api.post<ApiEnvelope<IntelRouteOptimizationResponse | MapPoint[]> | IntelRouteOptimizationResponse | MapPoint[]>(
      `${INTEL_BASE_PATH}/route/optimize`,
      requestPayload,
    );
    const payload = unwrapApiData(data);
    const orderedPoints = Array.isArray(payload)
      ? payload
      : (payload.orderedSpots ?? []).map((spot) => {
          const id = spot.spotId ?? spot.id ?? '';
          const original = pointById.get(id);
          return sanitizeMapPoint({
            ...(original ?? {
              id,
              title: id || 'Route point',
              category: 'other' as SpotCategory,
            }),
            id: original?.id ?? id,
            latitude: spot.latitude,
            longitude: spot.longitude,
          });
        });
    return sanitizeMapPointEnvelope({ data: orderedPoints });
  } catch (error) {
    rethrowIfNotQa(error);
    return sanitizeMapPointEnvelope({ data: sortRoutePoints(sanitizedPoints) });
  }
}

export interface RecommendationFeedbackInput {
  spotId: string;
  action: 'click' | 'dismiss';
}

export async function submitRecommendationFeedback(
  input: RecommendationFeedbackInput,
): Promise<void> {
  // Fire-and-forget from the caller's perspective. Failures don't block the
  // UX -- if the audit log misses a row, the ranker still works; it just
  // loses a training signal.
  try {
    await api.post(`${INTEL_BASE_PATH}/recommend/feedback`, input);
  } catch {
    // Swallow: feedback is best-effort and QA mode has no real endpoint.
  }
}
