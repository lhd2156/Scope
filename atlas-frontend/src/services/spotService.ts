import api from '@/services/api';
import { getTrendingSpots } from '@/services/feedService';
import {
  createMockSpot,
  filterSpots,
  getSpotById,
  mockSpotDetails,
  mockSpots,
  updateMockSpot,
} from '@/services/mockData';
import { paginateItems, unwrapApiData } from '@/services/serviceUtils';
import type {
  ApiEnvelope,
  Photo,
  SpotDetail,
  SpotFilters,
  SpotFormSubmission,
  SpotSummary,
  UserProfile,
} from '@/types';
import {
  sanitizePhoto,
  sanitizeSingleLineText,
  sanitizeSpotDetail,
  sanitizeSpotFormSubmission,
  sanitizeSpotSummary,
  sanitizeUserProfile,
} from '@/utils/sanitizers';

const SPOTS_BASE_PATH = '/api/content/spots';
const DEFAULT_RADIUS_KM = 25;

export interface NearbySpotFilters {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  page?: number;
  pageSize?: number;
}

function sanitizeSpotEnvelope(response: ApiEnvelope<SpotSummary[]>): ApiEnvelope<SpotSummary[]> {
  return {
    ...response,
    data: response.data.map((spot) => sanitizeSpotSummary(spot)),
  };
}

function sanitizeSpotDetailEnvelope(response: ApiEnvelope<SpotDetail>): ApiEnvelope<SpotDetail> {
  return {
    ...response,
    data: sanitizeSpotDetail(response.data),
  };
}

function sanitizePhotoEnvelope(response: ApiEnvelope<Photo[]>): ApiEnvelope<Photo[]> {
  return {
    ...response,
    data: response.data.map((photo) => sanitizePhoto(photo)),
  };
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceInKilometers(
  firstLatitude: number,
  firstLongitude: number,
  secondLatitude: number,
  secondLongitude: number,
): number {
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(secondLatitude - firstLatitude);
  const longitudeDelta = toRadians(secondLongitude - firstLongitude);
  const latitudeA = toRadians(firstLatitude);
  const latitudeB = toRadians(secondLatitude);

  const haversineComponent =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversineComponent));
}

function updateSpotCollections(updatedSpot: SpotDetail): SpotDetail {
  const sanitizedSpot = sanitizeSpotDetail(updatedSpot);
  mockSpotDetails[sanitizedSpot.id] = sanitizedSpot;
  const summaryIndex = mockSpots.findIndex((spot) => spot.id === sanitizedSpot.id);

  const updatedSummary: SpotSummary = sanitizeSpotSummary({
    id: sanitizedSpot.id,
    title: sanitizedSpot.title,
    description: sanitizedSpot.description,
    latitude: sanitizedSpot.latitude,
    longitude: sanitizedSpot.longitude,
    address: sanitizedSpot.address,
    city: sanitizedSpot.city,
    country: sanitizedSpot.country,
    category: sanitizedSpot.category,
    vibe: sanitizedSpot.vibe,
    rating: sanitizedSpot.rating,
    photoUrl: sanitizedSpot.photoUrl ?? sanitizedSpot.photos[0]?.url,
    createdAt: sanitizedSpot.createdAt,
    author: sanitizedSpot.author,
    liked: sanitizedSpot.liked,
    likesCount: sanitizedSpot.likesCount,
  });

  if (summaryIndex === -1) {
    mockSpots.unshift(updatedSummary);
  } else {
    mockSpots.splice(summaryIndex, 1, updatedSummary);
  }

  return sanitizedSpot;
}

export async function listSpots(filters: SpotFilters = {}): Promise<ApiEnvelope<SpotSummary[]>> {
  const sanitizedFilters = {
    ...filters,
    city: sanitizeSingleLineText(filters.city),
    vibe: sanitizeSingleLineText(filters.vibe),
  };

  try {
    const { data } = await api.get<ApiEnvelope<SpotSummary[]>>(`${SPOTS_BASE_PATH}`, { params: sanitizedFilters });
    return sanitizeSpotEnvelope(data);
  } catch {
    const filteredSpots = filterSpots(sanitizedFilters);
    return sanitizeSpotEnvelope(
      paginateItems(filteredSpots, sanitizedFilters.page ?? 1, sanitizedFilters.pageSize ?? (filteredSpots.length || 1)),
    );
  }
}

export async function listTrendingSpots(limit = 4): Promise<ApiEnvelope<SpotSummary[]>> {
  return getTrendingSpots(limit);
}

export async function exploreSpots(filters: SpotFilters = {}): Promise<ApiEnvelope<SpotSummary[]>> {
  const sanitizedFilters = {
    ...filters,
    city: sanitizeSingleLineText(filters.city),
    vibe: sanitizeSingleLineText(filters.vibe),
  };

  try {
    const { data } = await api.get<ApiEnvelope<SpotSummary[]>>(`${SPOTS_BASE_PATH}/explore`, { params: sanitizedFilters });
    return sanitizeSpotEnvelope(data);
  } catch {
    const filteredSpots = filterSpots(sanitizedFilters).sort((left, right) => (right.likesCount ?? 0) - (left.likesCount ?? 0));
    return sanitizeSpotEnvelope(
      paginateItems(filteredSpots, sanitizedFilters.page ?? 1, sanitizedFilters.pageSize ?? (filteredSpots.length || 1)),
    );
  }
}

export async function listNearbySpots(filters: NearbySpotFilters): Promise<ApiEnvelope<SpotSummary[]>> {
  const radiusKm = filters.radiusKm ?? DEFAULT_RADIUS_KM;

  try {
    const { data } = await api.get<ApiEnvelope<SpotSummary[]>>(`${SPOTS_BASE_PATH}/nearby`, {
      params: {
        lat: filters.latitude,
        lng: filters.longitude,
        radius: radiusKm,
        page: filters.page,
        pageSize: filters.pageSize,
      },
    });
    return sanitizeSpotEnvelope(data);
  } catch {
    const nearbySpots = mockSpots.filter((spot) => {
      const distance = distanceInKilometers(filters.latitude, filters.longitude, spot.latitude, spot.longitude);
      return distance <= radiusKm;
    });

    return sanitizeSpotEnvelope(paginateItems(nearbySpots, filters.page ?? 1, filters.pageSize ?? (nearbySpots.length || 1)));
  }
}

export async function listUserSpots(userId: string, page = 1, pageSize = mockSpots.length || 1): Promise<ApiEnvelope<SpotSummary[]>> {
  try {
    const { data } = await api.get<ApiEnvelope<SpotSummary[]>>(`${SPOTS_BASE_PATH}/user/${userId}`, {
      params: { page, pageSize },
    });
    return sanitizeSpotEnvelope(data);
  } catch {
    const userSpots = mockSpots.filter((spot) => spot.author?.id === userId);
    return sanitizeSpotEnvelope(paginateItems(userSpots, page, pageSize));
  }
}

export async function getSpotDetail(spotId: string): Promise<ApiEnvelope<SpotDetail>> {
  try {
    const { data } = await api.get<ApiEnvelope<SpotDetail> | SpotDetail>(`${SPOTS_BASE_PATH}/${spotId}`);
    return sanitizeSpotDetailEnvelope({ data: unwrapApiData(data) });
  } catch {
    const detail = getSpotById(spotId);
    if (!detail) {
      throw new Error(`Spot ${spotId} not found`);
    }
    return sanitizeSpotDetailEnvelope({ data: detail });
  }
}

export async function createSpot(
  submission: SpotFormSubmission,
  currentUser?: UserProfile | null,
): Promise<ApiEnvelope<SpotDetail>> {
  const sanitizedSubmission = sanitizeSpotFormSubmission(submission);
  const sanitizedUser = currentUser ? sanitizeUserProfile(currentUser) : currentUser;

  try {
    const { data } = await api.post<ApiEnvelope<SpotDetail> | SpotDetail>(SPOTS_BASE_PATH, sanitizedSubmission.spot);
    return sanitizeSpotDetailEnvelope({ data: unwrapApiData(data) });
  } catch {
    return sanitizeSpotDetailEnvelope({ data: createMockSpot(sanitizedSubmission, sanitizedUser) });
  }
}

export async function updateSpot(
  spotId: string,
  submission: SpotFormSubmission,
  currentUser?: UserProfile | null,
): Promise<ApiEnvelope<SpotDetail>> {
  const sanitizedSubmission = sanitizeSpotFormSubmission(submission);
  const sanitizedUser = currentUser ? sanitizeUserProfile(currentUser) : currentUser;

  try {
    const { data } = await api.put<ApiEnvelope<SpotDetail> | SpotDetail>(`${SPOTS_BASE_PATH}/${spotId}`, sanitizedSubmission.spot);
    return sanitizeSpotDetailEnvelope({ data: unwrapApiData(data) });
  } catch {
    return sanitizeSpotDetailEnvelope({ data: updateMockSpot(spotId, sanitizedSubmission, sanitizedUser) });
  }
}

export async function deleteSpot(spotId: string): Promise<void> {
  try {
    await api.delete(`${SPOTS_BASE_PATH}/${spotId}`);
  } catch {
    const summaryIndex = mockSpots.findIndex((spot) => spot.id === spotId);
    if (summaryIndex >= 0) {
      mockSpots.splice(summaryIndex, 1);
    }

    delete mockSpotDetails[spotId];
  }
}

export async function likeSpot(spotId: string): Promise<ApiEnvelope<SpotDetail>> {
  try {
    const { data } = await api.post<ApiEnvelope<SpotDetail> | SpotDetail>(`${SPOTS_BASE_PATH}/${spotId}/like`, undefined);
    return sanitizeSpotDetailEnvelope({ data: unwrapApiData(data) });
  } catch {
    const existingSpot = getSpotById(spotId);
    if (!existingSpot) {
      throw new Error(`Spot ${spotId} not found`);
    }

    const likesCount = existingSpot.liked ? existingSpot.likesCount ?? 0 : (existingSpot.likesCount ?? 0) + 1;
    return sanitizeSpotDetailEnvelope({
      data: updateSpotCollections({
        ...existingSpot,
        liked: true,
        likesCount,
      }),
    });
  }
}

export async function unlikeSpot(spotId: string): Promise<ApiEnvelope<SpotDetail>> {
  try {
    const { data } = await api.delete<ApiEnvelope<SpotDetail> | SpotDetail>(`${SPOTS_BASE_PATH}/${spotId}/like`);
    return sanitizeSpotDetailEnvelope({ data: unwrapApiData(data) });
  } catch {
    const existingSpot = getSpotById(spotId);
    if (!existingSpot) {
      throw new Error(`Spot ${spotId} not found`);
    }

    const likesCount = existingSpot.liked ? Math.max(0, (existingSpot.likesCount ?? 1) - 1) : existingSpot.likesCount ?? 0;
    return sanitizeSpotDetailEnvelope({
      data: updateSpotCollections({
        ...existingSpot,
        liked: false,
        likesCount,
      }),
    });
  }
}

export async function listSpotPhotos(spotId: string): Promise<ApiEnvelope<Photo[]>> {
  try {
    const { data } = await api.get<ApiEnvelope<Photo[]>>(`${SPOTS_BASE_PATH}/${spotId}/photos`);
    return sanitizePhotoEnvelope(data);
  } catch {
    const spot = getSpotById(spotId);
    if (!spot) {
      throw new Error(`Spot ${spotId} not found`);
    }

    return sanitizePhotoEnvelope({ data: spot.photos });
  }
}
