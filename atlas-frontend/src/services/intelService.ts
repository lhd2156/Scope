import api from '@/services/api';
import { buildItineraryPreview, getSpotById, mockSpots, mockTrips } from '@/services/mockData';
import { unwrapApiData } from '@/services/serviceUtils';
import type {
  ApiEnvelope,
  Itinerary,
  MapPoint,
  SpotCategory,
  SpotSummary,
  TripPlannerInput,
} from '@/types';
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

function sanitizeItineraryEnvelope(response: ApiEnvelope<Itinerary>): ApiEnvelope<Itinerary> {
  return {
    ...response,
    data: sanitizeItinerary(response.data),
  };
}

function sanitizeSpotEnvelope(response: ApiEnvelope<SpotSummary[]>): ApiEnvelope<SpotSummary[]> {
  return {
    ...response,
    data: response.data.map((spot) => sanitizeSpotSummary(spot)),
  };
}

function sanitizeMapPointEnvelope(response: ApiEnvelope<MapPoint[]>): ApiEnvelope<MapPoint[]> {
  return {
    ...response,
    data: response.data.map((point) => sanitizeMapPoint(point)),
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
  } catch {
    return sanitizeItineraryEnvelope({ data: buildItineraryPreview(sanitizedInput) });
  }
}

export async function getCachedItinerary(itineraryId: string): Promise<ApiEnvelope<Itinerary>> {
  try {
    const { data } = await api.get<ApiEnvelope<Itinerary> | Itinerary>(`${INTEL_BASE_PATH}/itinerary/${itineraryId}`);
    return sanitizeItineraryEnvelope({ data: unwrapApiData(data) });
  } catch {
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

  try {
    const { data } = await api.post<ApiEnvelope<SpotSummary[]> | SpotSummary[]>(`${INTEL_BASE_PATH}/recommend/spots`, sanitizedInput);
    return sanitizeSpotEnvelope('data' in data ? data : { data });
  } catch {
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

    return sanitizeSpotEnvelope({ data: recommendedSpots });
  }
}

export async function recommendSimilarSpots(spotId: string, limit = 4): Promise<ApiEnvelope<SpotSummary[]>> {
  try {
    const { data } = await api.post<ApiEnvelope<SpotSummary[]> | SpotSummary[]>(
      `${INTEL_BASE_PATH}/recommend/similar/${spotId}`,
      { limit },
    );
    return sanitizeSpotEnvelope('data' in data ? data : { data });
  } catch {
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

    return sanitizeSpotEnvelope({ data: similarSpots });
  }
}

export async function vibeMatch(input: VibeMatchInput): Promise<ApiEnvelope<SpotSummary[]>> {
  const sanitizedInput = {
    ...input,
    vibe: sanitizeSingleLineText(input.vibe),
  };

  try {
    const { data } = await api.post<ApiEnvelope<SpotSummary[]> | SpotSummary[]>(`${INTEL_BASE_PATH}/vibe-match`, sanitizedInput);
    return sanitizeSpotEnvelope('data' in data ? data : { data });
  } catch {
    const normalizedVibe = sanitizedInput.vibe.toLowerCase();
    const matchedSpots = mockSpots
      .filter((spot) => {
        const searchableContent = [spot.vibe, spot.title, spot.description, spot.category].filter(Boolean).join(' ').toLowerCase();
        return searchableContent.includes(normalizedVibe);
      })
      .slice(0, sanitizedInput.limit ?? 4);

    return sanitizeSpotEnvelope({ data: matchedSpots });
  }
}

export async function optimizeRoute(input: RouteOptimizationInput): Promise<ApiEnvelope<MapPoint[]>> {
  const sanitizedInput = {
    ...input,
    points: input.points.map((point) => sanitizeMapPoint(point)),
  };

  try {
    const { data } = await api.post<ApiEnvelope<MapPoint[]> | MapPoint[]>(`${INTEL_BASE_PATH}/route/optimize`, sanitizedInput);
    return sanitizeMapPointEnvelope('data' in data ? data : { data });
  } catch {
    return sanitizeMapPointEnvelope({ data: sortRoutePoints(sanitizedInput.points) });
  }
}
