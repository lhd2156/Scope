import api from '@/services/api';
import { getTrendingSpots } from '@/services/feedService';
import { loadMockData } from '@/services/mockDataLoader';
import { normalizeArrayEnvelopeData, paginateItems, unwrapApiData } from '@/services/serviceUtils';
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
import { rankTrendingSpots } from '@/utils/spotRanking';

const SPOTS_BASE_PATH = '/api/content/spots';
const DEFAULT_RADIUS_KM = 25;
let hasObservedLiveSpotData = false;

export interface NearbySpotFilters {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  page?: number;
  pageSize?: number;
}

interface MockAvatarSanitizerOptions {
  allowGeneratedAvatars?: boolean;
}

function sanitizeSpotEnvelope(
  response: ApiEnvelope<SpotSummary[]>,
  options: MockAvatarSanitizerOptions = {},
): ApiEnvelope<SpotSummary[]> {
  return {
    ...response,
    data: normalizeArrayEnvelopeData(response).map((spot) =>
      sanitizeSpotSummary(spot, { allowGeneratedAuthorAvatar: options.allowGeneratedAvatars }),
    ),
  };
}

function sanitizeSpotDetailEnvelope(
  response: ApiEnvelope<SpotDetail>,
  options: MockAvatarSanitizerOptions = {},
): ApiEnvelope<SpotDetail> {
  return {
    ...response,
    data: sanitizeSpotDetail(response.data, {
      allowGeneratedAuthorAvatar: options.allowGeneratedAvatars,
      allowGeneratedReviewAvatars: options.allowGeneratedAvatars,
    }),
  };
}

function sanitizePhotoEnvelope(response: ApiEnvelope<Photo[]>): ApiEnvelope<Photo[]> {
  return {
    ...response,
    data: normalizeArrayEnvelopeData(response).map((photo) => sanitizePhoto(photo)),
  };
}

function rememberLiveSpotList(spots: SpotSummary[]): void {
  if (spots.length) {
    hasObservedLiveSpotData = true;
  }
}

function rememberLiveSpotDetail(): void {
  hasObservedLiveSpotData = true;
}

function hasSpotDiscoveryFilters(filters: SpotFilters): boolean {
  return Boolean(filters.category || sanitizeSingleLineText(filters.city) || sanitizeSingleLineText(filters.vibe));
}

async function buildMockSpotEnvelope(
  filters: SpotFilters,
  options: { ranked?: boolean } = {},
): Promise<ApiEnvelope<SpotSummary[]>> {
  const { filterSpots } = await loadMockData();
  const filteredSpots = filterSpots(filters);
  const fallbackSpots = options.ranked ? rankTrendingSpots(filteredSpots) : filteredSpots;

  return sanitizeSpotEnvelope(
    paginateItems(fallbackSpots, filters.page ?? 1, filters.pageSize ?? (fallbackSpots.length || 1)),
    { allowGeneratedAvatars: true },
  );
}

async function resolveSpotListEnvelope(
  response: ApiEnvelope<SpotSummary[]>,
  filters: SpotFilters,
  options: { rankedFallback?: boolean } = {},
): Promise<ApiEnvelope<SpotSummary[]>> {
  const sanitizedResponse = sanitizeSpotEnvelope(response);
  rememberLiveSpotList(sanitizedResponse.data);
  const total = sanitizedResponse.meta?.total ?? sanitizedResponse.data.length;
  const isEmptyUnfilteredDiscovery = total === 0 && !hasSpotDiscoveryFilters(filters);

  if (!sanitizedResponse.data.length && (!hasObservedLiveSpotData || isEmptyUnfilteredDiscovery)) {
    return buildMockSpotEnvelope(filters, { ranked: options.rankedFallback });
  }

  return sanitizedResponse;
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

async function updateSpotCollections(
  updatedSpot: SpotDetail,
  options: MockAvatarSanitizerOptions = {},
): Promise<SpotDetail> {
  const { mockSpotDetails, mockSpots } = await loadMockData();
  const sanitizedSpot = sanitizeSpotDetail(updatedSpot, {
    allowGeneratedAuthorAvatar: options.allowGeneratedAvatars,
    allowGeneratedReviewAvatars: options.allowGeneratedAvatars,
  });
  mockSpotDetails[sanitizedSpot.id] = sanitizedSpot;
  const summaryIndex = mockSpots.findIndex((spot) => spot.id === sanitizedSpot.id);

  const updatedSummary: SpotSummary = sanitizeSpotSummary(
    {
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
    },
    { allowGeneratedAuthorAvatar: options.allowGeneratedAvatars },
  );

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
    return resolveSpotListEnvelope(data, sanitizedFilters, { rankedFallback: true });
  } catch {
    return buildMockSpotEnvelope(sanitizedFilters, { ranked: true });
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
    return resolveSpotListEnvelope(data, sanitizedFilters, { rankedFallback: true });
  } catch {
    return buildMockSpotEnvelope(sanitizedFilters, { ranked: true });
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
    const sanitizedResponse = sanitizeSpotEnvelope(data);
    rememberLiveSpotList(sanitizedResponse.data);

    if (sanitizedResponse.data.length || hasObservedLiveSpotData) {
      return sanitizedResponse;
    }
  } catch {
    // The local seed layer below keeps nearby/map discovery populated while
    // the content service has not received its first real pins yet.
  }

  const { mockSpots } = await loadMockData();
  const nearbySpots = mockSpots.filter((spot) => {
    const distance = distanceInKilometers(filters.latitude, filters.longitude, spot.latitude, spot.longitude);
    return distance <= radiusKm;
  });

  return sanitizeSpotEnvelope(
    paginateItems(nearbySpots, filters.page ?? 1, filters.pageSize ?? (nearbySpots.length || 1)),
    { allowGeneratedAvatars: true },
  );
}

export async function listUserSpots(userId: string, page = 1, pageSize = 20): Promise<ApiEnvelope<SpotSummary[]>> {
  try {
    const { data } = await api.get<ApiEnvelope<SpotSummary[]>>(`${SPOTS_BASE_PATH}/user/${userId}`, {
      params: { page, pageSize },
    });
    const sanitizedResponse = sanitizeSpotEnvelope(data);
    rememberLiveSpotList(sanitizedResponse.data);
    return sanitizedResponse;
  } catch {
    const { mockSpots } = await loadMockData();
    const resolvedPageSize = pageSize || mockSpots.length || 1;
    const userSpots = mockSpots.filter((spot) => spot.author?.id === userId);
    return sanitizeSpotEnvelope(paginateItems(userSpots, page, resolvedPageSize), { allowGeneratedAvatars: true });
  }
}

export async function getSpotDetail(spotId: string): Promise<ApiEnvelope<SpotDetail>> {
  try {
    const { data } = await api.get<ApiEnvelope<SpotDetail> | SpotDetail>(`${SPOTS_BASE_PATH}/${spotId}`);
    const sanitizedResponse = sanitizeSpotDetailEnvelope({ data: unwrapApiData(data) });
    rememberLiveSpotDetail();
    return sanitizedResponse;
  } catch {
    const { getSpotById } = await loadMockData();
    const detail = getSpotById(spotId);
    if (!detail) {
      throw new Error(`Spot ${spotId} not found`);
    }
    return sanitizeSpotDetailEnvelope({ data: detail }, { allowGeneratedAvatars: true });
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
    const sanitizedResponse = sanitizeSpotDetailEnvelope({ data: unwrapApiData(data) });
    rememberLiveSpotDetail();
    return sanitizedResponse;
  } catch {
    const { createMockSpot } = await loadMockData();
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
    const sanitizedResponse = sanitizeSpotDetailEnvelope({ data: unwrapApiData(data) });
    rememberLiveSpotDetail();
    return sanitizedResponse;
  } catch {
    const { updateMockSpot } = await loadMockData();
    return sanitizeSpotDetailEnvelope({ data: updateMockSpot(spotId, sanitizedSubmission, sanitizedUser) });
  }
}

export async function deleteSpot(spotId: string): Promise<void> {
  try {
    await api.delete(`${SPOTS_BASE_PATH}/${spotId}`);
  } catch {
    const { mockSpotDetails, mockSpots } = await loadMockData();
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
    const sanitizedResponse = sanitizeSpotDetailEnvelope({ data: unwrapApiData(data) });
    rememberLiveSpotDetail();
    return sanitizedResponse;
  } catch {
    const { getSpotById } = await loadMockData();
    const existingSpot = getSpotById(spotId);
    if (!existingSpot) {
      throw new Error(`Spot ${spotId} not found`);
    }

    const likesCount = existingSpot.liked ? existingSpot.likesCount ?? 0 : (existingSpot.likesCount ?? 0) + 1;
    return sanitizeSpotDetailEnvelope(
      {
        data: await updateSpotCollections(
          {
            ...existingSpot,
            liked: true,
            likesCount,
          },
          { allowGeneratedAvatars: true },
        ),
      },
      { allowGeneratedAvatars: true },
    );
  }
}

export async function unlikeSpot(spotId: string): Promise<ApiEnvelope<SpotDetail>> {
  try {
    const { data } = await api.delete<ApiEnvelope<SpotDetail> | SpotDetail>(`${SPOTS_BASE_PATH}/${spotId}/like`);
    const sanitizedResponse = sanitizeSpotDetailEnvelope({ data: unwrapApiData(data) });
    rememberLiveSpotDetail();
    return sanitizedResponse;
  } catch {
    const { getSpotById } = await loadMockData();
    const existingSpot = getSpotById(spotId);
    if (!existingSpot) {
      throw new Error(`Spot ${spotId} not found`);
    }

    const likesCount = existingSpot.liked ? Math.max(0, (existingSpot.likesCount ?? 1) - 1) : existingSpot.likesCount ?? 0;
    return sanitizeSpotDetailEnvelope(
      {
        data: await updateSpotCollections(
          {
            ...existingSpot,
            liked: false,
            likesCount,
          },
          { allowGeneratedAvatars: true },
        ),
      },
      { allowGeneratedAvatars: true },
    );
  }
}

export async function listSpotPhotos(spotId: string): Promise<ApiEnvelope<Photo[]>> {
  try {
    const { data } = await api.get<ApiEnvelope<Photo[]>>(`${SPOTS_BASE_PATH}/${spotId}/photos`);
    return sanitizePhotoEnvelope(data);
  } catch {
    const { getSpotById } = await loadMockData();
    const spot = getSpotById(spotId);
    if (!spot) {
      throw new Error(`Spot ${spotId} not found`);
    }

    return sanitizePhotoEnvelope({ data: spot.photos });
  }
}
