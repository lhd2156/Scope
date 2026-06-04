import api from '@/services/api';
import { unwrapApiData } from '@/services/serviceUtils';
import type { ApiEnvelope, TripFuelType } from '@/types';
import { sanitizeImageUrl, sanitizeSingleLineText } from '@/utils/sanitizers';

const TRAVEL_NEARBY_BASE_PATH = '/api/intel/travel/nearby';

export type TravelNearbyCategory = 'recommended' | 'fuel' | 'food' | 'stay' | 'essentials' | 'entertainment' | 'scenic' | 'outdoors' | 'shopping' | 'nightlife';

export interface TravelNearbyAnchor {
  id: string;
  placeLabel: string;
  latitude: number;
  longitude: number;
  routeRole?: string;
}

export interface TravelNearbyRoutePoint {
  id?: string;
  title?: string;
  latitude: number;
  longitude: number;
  routeRole?: string;
}

export interface TravelNearbyRequest {
  anchors: TravelNearbyAnchor[];
  routePoints?: TravelNearbyRoutePoint[];
  category: TravelNearbyCategory;
  radiusKm?: number;
  limit?: number;
  interests?: string[];
  pace?: string;
  budgetFloor?: number;
  budgetCeiling?: number;
  startDate?: string;
  endDate?: string;
  fuelType?: TripFuelType | 'all';
  latestIntent?: string;
}

export interface TravelNearbySuggestion {
  id: string;
  placeId?: string | undefined;
  title: string;
  subtitle: string;
  address?: string | undefined;
  latitude: number;
  longitude: number;
  category: string;
  source: 'scope' | 'google';
  sourceLabel?: string | undefined;
  distanceKm?: number | undefined;
  rating?: number | undefined;
  reviewCount?: number | undefined;
  priceLevel?: string | undefined;
  priceLabel?: string | undefined;
  priceValue?: number | undefined;
  fuelType?: string | undefined;
  isOpen?: boolean | null;
  websiteUrl?: string | undefined;
  photoUrl?: string | undefined;
  photoAttribution?: string | undefined;
  photoAttributionUrl?: string | undefined;
  reason?: string | undefined;
  anchorId?: string | undefined;
  anchorLabel?: string | undefined;
}

export interface TravelNearbyResponse {
  configured: boolean;
  coverage: string;
  source: string;
  category: TravelNearbyCategory;
  radiusKm: number;
  suggestions: TravelNearbySuggestion[];
}

function sanitizeFiniteNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function sanitizeTravelNearbySuggestion(rawSuggestion: Partial<TravelNearbySuggestion>): TravelNearbySuggestion | null {
  const latitude = sanitizeFiniteNumber(rawSuggestion.latitude);
  const longitude = sanitizeFiniteNumber(rawSuggestion.longitude);
  const title = sanitizeSingleLineText(rawSuggestion.title);
  if (!title || latitude === undefined || longitude === undefined) {
    return null;
  }

  const source = rawSuggestion.source === 'scope' ? 'scope' : 'google';
  return {
    id: sanitizeSingleLineText(rawSuggestion.id) || `${source}-${title}-${latitude.toFixed(3)}-${longitude.toFixed(3)}`,
    placeId: sanitizeSingleLineText(rawSuggestion.placeId) || undefined,
    title,
    subtitle: sanitizeSingleLineText(rawSuggestion.subtitle) || 'Nearby travel suggestion',
    address: sanitizeSingleLineText(rawSuggestion.address) || undefined,
    latitude,
    longitude,
    category: sanitizeSingleLineText(rawSuggestion.category) || 'other',
    source,
    sourceLabel: sanitizeSingleLineText(rawSuggestion.sourceLabel) || undefined,
    distanceKm: sanitizeFiniteNumber(rawSuggestion.distanceKm),
    rating: sanitizeFiniteNumber(rawSuggestion.rating),
    reviewCount: sanitizeFiniteNumber(rawSuggestion.reviewCount),
    priceLevel: sanitizeSingleLineText(rawSuggestion.priceLevel) || undefined,
    priceLabel: sanitizeSingleLineText(rawSuggestion.priceLabel) || undefined,
    priceValue: sanitizeFiniteNumber(rawSuggestion.priceValue),
    fuelType: sanitizeSingleLineText(rawSuggestion.fuelType) || undefined,
    isOpen: typeof rawSuggestion.isOpen === 'boolean' ? rawSuggestion.isOpen : null,
    websiteUrl: sanitizeSingleLineText(rawSuggestion.websiteUrl) || undefined,
    photoUrl: sanitizeImageUrl(rawSuggestion.photoUrl),
    photoAttribution: sanitizeSingleLineText(rawSuggestion.photoAttribution) || undefined,
    photoAttributionUrl: sanitizeSingleLineText(rawSuggestion.photoAttributionUrl) || undefined,
    reason: sanitizeSingleLineText(rawSuggestion.reason) || undefined,
    anchorId: sanitizeSingleLineText(rawSuggestion.anchorId) || undefined,
    anchorLabel: sanitizeSingleLineText(rawSuggestion.anchorLabel) || undefined,
  };
}

function sanitizeTravelNearbyResponse(response: ApiEnvelope<TravelNearbyResponse> | TravelNearbyResponse): TravelNearbyResponse {
  const payload = unwrapApiData(response) as Partial<TravelNearbyResponse>;
  const category = payload.category && ['recommended', 'fuel', 'food', 'stay', 'essentials', 'entertainment', 'scenic', 'outdoors', 'shopping', 'nightlife'].includes(payload.category)
    ? payload.category
    : 'recommended';

  return {
    configured: Boolean(payload.configured),
    coverage: sanitizeSingleLineText(payload.coverage) || '',
    source: sanitizeSingleLineText(payload.source) || 'Scope + Google Places',
    category,
    radiusKm: sanitizeFiniteNumber(payload.radiusKm) ?? 16.09,
    suggestions: Array.isArray(payload.suggestions)
      ? payload.suggestions
        .map((suggestion) => sanitizeTravelNearbySuggestion(suggestion))
        .filter((suggestion): suggestion is TravelNearbySuggestion => Boolean(suggestion))
      : [],
  };
}

export async function getTravelNearbySuggestions(options: TravelNearbyRequest): Promise<TravelNearbyResponse> {
  const { data } = await api.post<ApiEnvelope<TravelNearbyResponse> | TravelNearbyResponse>(TRAVEL_NEARBY_BASE_PATH, options);
  return sanitizeTravelNearbyResponse(data);
}
