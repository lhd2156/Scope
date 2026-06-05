import api from '@/services/api';
import { localFallbackEnabled } from '@/services/demoMode';
import { getTrendingSpots } from '@/services/feedService';
import { loadMockData } from '@/services/mockDataLoader';
import { normalizeArrayEnvelopeData, paginateItems, unwrapApiData } from '@/services/serviceUtils';
import type {
  ApiEnvelope,
  Photo,
  Review,
  SpotDetail,
  SpotFilters,
  SpotFormSubmission,
  SpotSummary,
  UserProfile,
} from '@/types';
import {
  sanitizePhoto,
  sanitizeReview,
  sanitizeSingleLineText,
  sanitizeSpotDetail,
  sanitizeSpotFormSubmission,
  sanitizeSpotSummary,
  sanitizeUserProfile,
} from '@/utils/sanitizers';
import { calculateHaversineDistanceKm } from '@/utils/geoDistance';
import { rankTrendingSpots } from '@/utils/spotRanking';

const SPOTS_BASE_PATH = '/api/content/spots';
const SPOTS_COLLECTION_PATH = `${SPOTS_BASE_PATH}/`;
const PHOTOS_BASE_PATH = '/api/content/photos';
const REVIEWS_BASE_PATH = '/api/content/reviews';
const INTEL_BASE_PATH = '/api/intel';
const DEFAULT_RADIUS_KM = 25;
const SPOT_READ_FALLBACK_ENABLED =
  localFallbackEnabled('VITE', 'ENABLE', 'SPOT', 'MOCK', 'FALLBACK');
const SPOT_WRITE_FALLBACK_ENABLED =
  localFallbackEnabled('VITE', 'ENABLE', 'SPOT', 'LOCAL', 'WRITE', 'FALLBACK');
let hasObservedLiveSpotData = false;

export interface VerifySpotPlaceInput {
  title: string;
  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  latitude: number;
  longitude: number;
  providerPlaceId?: string;
}

export interface VerifySpotPlaceCandidate {
  source: string;
  providerPlaceId?: string;
  providerPlaceName?: string;
  providerPlaceAddress?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  distanceMeters?: number;
  precision?: string;
}

export interface VerifySpotPlaceResult {
  verified: boolean;
  source: string;
  providerPlaceId?: string;
  providerPlaceName?: string;
  providerPlaceAddress?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  distanceMeters?: number | null;
  precision?: string;
  reason?: string;
  candidates: VerifySpotPlaceCandidate[];
}

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

function sanitizeVerifySpotPlaceResult(response: ApiEnvelope<VerifySpotPlaceResult> | VerifySpotPlaceResult): VerifySpotPlaceResult {
  const payload = unwrapApiData(response) as Partial<VerifySpotPlaceResult>;
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];

  return {
    verified: Boolean(payload.verified),
    source: sanitizeSingleLineText(payload.source) || '',
    providerPlaceId: sanitizeSingleLineText(payload.providerPlaceId),
    providerPlaceName: sanitizeSingleLineText(payload.providerPlaceName),
    providerPlaceAddress: sanitizeSingleLineText(payload.providerPlaceAddress),
    city: sanitizeSingleLineText(payload.city),
    country: sanitizeSingleLineText(payload.country),
    postalCode: sanitizeSingleLineText(payload.postalCode),
    distanceMeters: typeof payload.distanceMeters === 'number' ? payload.distanceMeters : null,
    precision: sanitizeSingleLineText(payload.precision),
    reason: sanitizeSingleLineText(payload.reason),
    candidates: candidates.map((candidate) => ({
      source: sanitizeSingleLineText(candidate.source),
      providerPlaceId: sanitizeSingleLineText(candidate.providerPlaceId),
      providerPlaceName: sanitizeSingleLineText(candidate.providerPlaceName),
      providerPlaceAddress: sanitizeSingleLineText(candidate.providerPlaceAddress),
      city: sanitizeSingleLineText(candidate.city),
      country: sanitizeSingleLineText(candidate.country),
      postalCode: sanitizeSingleLineText(candidate.postalCode),
      distanceMeters: typeof candidate.distanceMeters === 'number' ? candidate.distanceMeters : undefined,
      precision: sanitizeSingleLineText(candidate.precision),
    })),
  };
}

function buildSpotComposeFormData(submission: SpotFormSubmission): FormData {
  const formData = new FormData();
  formData.append('spot', JSON.stringify(submission.spot));
  submission.newPhotos.forEach((upload, index) => {
    formData.append('photos', upload.file, upload.file.name);
    formData.append('captions', upload.caption || '');
    formData.append('sortOrders', String(index));
  });
  return formData;
}

export async function verifySpotPlace(input: VerifySpotPlaceInput): Promise<VerifySpotPlaceResult> {
  const { data } = await api.post<ApiEnvelope<VerifySpotPlaceResult> | VerifySpotPlaceResult>(
    `${INTEL_BASE_PATH}/place/verify`,
    {
      title: sanitizeSingleLineText(input.title),
      address: sanitizeSingleLineText(input.address),
      city: sanitizeSingleLineText(input.city),
      country: sanitizeSingleLineText(input.country),
      postalCode: sanitizeSingleLineText(input.postalCode),
      latitude: input.latitude,
      longitude: input.longitude,
      providerPlaceId: sanitizeSingleLineText(input.providerPlaceId),
    },
  );

  return sanitizeVerifySpotPlaceResult(data);
}

export async function uploadSpotPhoto(
  spotId: string,
  upload: Pick<Photo, 'caption'> & { file: File },
  sortOrder: number,
): Promise<ApiEnvelope<Photo>> {
  const formData = new FormData();
  formData.append('spot_id', spotId);
  formData.append('file', upload.file, upload.file.name);
  formData.append('caption', sanitizeSingleLineText(upload.caption));
  formData.append('sort_order', String(sortOrder));

  const { data } = await api.post<ApiEnvelope<Photo> | Photo>(`${PHOTOS_BASE_PATH}/upload`, formData);
  return { data: sanitizePhoto(unwrapApiData(data) as Photo) };
}

export async function createVerifiedSpot(submission: SpotFormSubmission): Promise<ApiEnvelope<SpotDetail>> {
  const { data } = await api.post<ApiEnvelope<SpotDetail> | SpotDetail>(
    `${SPOTS_BASE_PATH}/compose`,
    buildSpotComposeFormData(submission),
  );
  const responseSpot = unwrapApiData(data) as SpotDetail & {
    is_public?: boolean;
    photos?: SpotDetail['photos'];
    reviews?: SpotDetail['reviews'];
  };
  const sanitizedResponse = sanitizeSpotDetailEnvelope({
    data: {
      ...responseSpot,
      isPublic: responseSpot.isPublic ?? responseSpot.is_public ?? submission.spot.isPublic,
      photos: Array.isArray(responseSpot.photos) ? responseSpot.photos : [],
      reviews: Array.isArray(responseSpot.reviews) ? responseSpot.reviews : [],
    } as SpotDetail,
  });
  rememberLiveSpotDetail();
  return sanitizedResponse;
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

  if (
    SPOT_READ_FALLBACK_ENABLED &&
    !sanitizedResponse.data.length &&
    (!hasObservedLiveSpotData || isEmptyUnfilteredDiscovery)
  ) {
    return buildMockSpotEnvelope(filters, { ranked: options.rankedFallback });
  }

  return sanitizedResponse;
}

function distanceInKilometers(
  firstLatitude: number,
  firstLongitude: number,
  secondLatitude: number,
  secondLongitude: number,
): number {
  return calculateHaversineDistanceKm(
    { latitude: firstLatitude, longitude: firstLongitude },
    { latitude: secondLatitude, longitude: secondLongitude },
  );
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
    const { data } = await api.get<ApiEnvelope<SpotSummary[]>>(SPOTS_COLLECTION_PATH, { params: sanitizedFilters });
    return resolveSpotListEnvelope(data, sanitizedFilters, { rankedFallback: true });
  } catch (error) {
    if (!SPOT_READ_FALLBACK_ENABLED) {
      throw error;
    }
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
  } catch (error) {
    if (!SPOT_READ_FALLBACK_ENABLED) {
      throw error;
    }
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

    if (sanitizedResponse.data.length || hasObservedLiveSpotData || !SPOT_READ_FALLBACK_ENABLED) {
      return sanitizedResponse;
    }
  } catch (error) {
    if (!SPOT_READ_FALLBACK_ENABLED) {
      throw error;
    }
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
  } catch (error) {
    if (!SPOT_READ_FALLBACK_ENABLED) {
      throw error;
    }
    const { mockSpots } = await loadMockData();
    const resolvedPageSize = pageSize || mockSpots.length || 1;
    const legacyUserIdPrefix = ['de', 'mo'].join('');
    const legacyPreviewUserId = /^user-\d+$/i.test(userId) ? `${legacyUserIdPrefix}-${userId}` : userId;
    const userSpots = mockSpots.filter((spot) => spot.author?.id === userId || spot.author?.id === legacyPreviewUserId);
    return sanitizeSpotEnvelope(paginateItems(userSpots, page, resolvedPageSize), { allowGeneratedAvatars: true });
  }
}

export async function listSavedSpots(page = 1, pageSize = 12): Promise<ApiEnvelope<SpotSummary[]>> {
  try {
    const { data } = await api.get<ApiEnvelope<SpotSummary[]>>(`${SPOTS_BASE_PATH}/saved`, {
      params: { page, pageSize },
    });
    const sanitizedResponse = sanitizeSpotEnvelope(data);
    rememberLiveSpotList(sanitizedResponse.data);
    return sanitizedResponse;
  } catch (error) {
    if (!SPOT_READ_FALLBACK_ENABLED) {
      throw error;
    }
    const { mockSpots } = await loadMockData();
    const savedSpots = mockSpots.filter((spot) => spot.liked);
    return sanitizeSpotEnvelope(paginateItems(savedSpots, page, pageSize || savedSpots.length || 1), {
      allowGeneratedAvatars: true,
    });
  }
}

export async function getSpotDetail(spotId: string): Promise<ApiEnvelope<SpotDetail>> {
  try {
    const { data } = await api.get<ApiEnvelope<SpotDetail> | SpotDetail>(`${SPOTS_BASE_PATH}/${spotId}`);
    const sanitizedResponse = sanitizeSpotDetailEnvelope({ data: unwrapApiData(data) });
    rememberLiveSpotDetail();
    return sanitizedResponse;
  } catch (error) {
    if (!SPOT_READ_FALLBACK_ENABLED) {
      throw error;
    }
    const { getSpotById } = await loadMockData();
    const detail = getSpotById(spotId);
    if (!detail) {
      throw new Error(`Spot ${spotId} not found`);
    }
    return sanitizeSpotDetailEnvelope({ data: detail }, { allowGeneratedAvatars: true });
  }
}

export async function listSpotReviews(spotId: string): Promise<ApiEnvelope<Review[]>> {
  const { data } = await api.get<ApiEnvelope<Review[]> | Review[]>(`${REVIEWS_BASE_PATH}/spot/${spotId}`);
  const reviews = normalizeArrayEnvelopeData({ data: unwrapApiData(data) as Review[] });

  return {
    data: reviews.map((review) => sanitizeReview({ ...review, spotId } as Review)),
  };
}

export async function createSpotReview(
  spotId: string,
  payload: { rating: number; comment: string },
): Promise<ApiEnvelope<Review>> {
  const { data } = await api.post<ApiEnvelope<Review> | Review>(`${REVIEWS_BASE_PATH}/spot/${spotId}`, {
    rating: payload.rating,
    comment: payload.comment,
  });

  return {
    data: sanitizeReview({ ...(unwrapApiData(data) as Review), spotId } as Review),
  };
}

export async function createSpot(
  submission: SpotFormSubmission,
  currentUser?: UserProfile | null,
): Promise<ApiEnvelope<SpotDetail>> {
  const sanitizedSubmission = sanitizeSpotFormSubmission(submission);
  const sanitizedUser = currentUser ? sanitizeUserProfile(currentUser) : currentUser;

  try {
    return await createVerifiedSpot(sanitizedSubmission);
  } catch (error) {
    if (!SPOT_WRITE_FALLBACK_ENABLED) {
      throw error;
    }
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
    for (const [index, upload] of sanitizedSubmission.newPhotos.entries()) {
      await uploadSpotPhoto(spotId, upload, sanitizedSubmission.existingPhotos.length + index);
    }
    const refreshed = sanitizedSubmission.newPhotos.length
      ? await getSpotDetail(spotId)
      : sanitizeSpotDetailEnvelope({ data: unwrapApiData(data) as SpotDetail });
    const sanitizedResponse = sanitizeSpotDetailEnvelope({ data: refreshed.data });
    rememberLiveSpotDetail();
    return sanitizedResponse;
  } catch (error) {
    if (!SPOT_WRITE_FALLBACK_ENABLED) {
      throw error;
    }
    const { updateMockSpot } = await loadMockData();
    return sanitizeSpotDetailEnvelope({ data: updateMockSpot(spotId, sanitizedSubmission, sanitizedUser) });
  }
}

export async function deleteSpot(spotId: string): Promise<void> {
  try {
    await api.delete(`${SPOTS_BASE_PATH}/${spotId}`);
  } catch (error) {
    if (!SPOT_WRITE_FALLBACK_ENABLED) {
      throw error;
    }
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
  } catch (error) {
    if (!SPOT_WRITE_FALLBACK_ENABLED) {
      throw error;
    }
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
  } catch (error) {
    if (!SPOT_WRITE_FALLBACK_ENABLED) {
      throw error;
    }
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
  } catch (error) {
    if (!SPOT_READ_FALLBACK_ENABLED) {
      throw error;
    }
    const { getSpotById } = await loadMockData();
    const spot = getSpotById(spotId);
    if (!spot) {
      throw new Error(`Spot ${spotId} not found`);
    }

    return sanitizePhotoEnvelope({ data: spot.photos });
  }
}
