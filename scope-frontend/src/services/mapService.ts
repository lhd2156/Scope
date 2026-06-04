import api from '@/services/api';
import { getMapboxToken } from '@/services/mapboxLoader';
import { loadMockData } from '@/services/mockDataLoader';
import { paginateItems, unwrapApiData } from '@/services/serviceUtils';
import type { ApiEnvelope } from '@/types';
import { calculateHaversineDistanceKm, degreesToRadians } from '@/utils/geoDistance';
import { sanitizeImageUrl, sanitizeSingleLineText } from '@/utils/sanitizers';

const INTEL_BASE_PATH = '/api/intel';
const MAPBOX_GEOCODE_BASE_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const MAPBOX_SEARCHBOX_BASE_URL = 'https://api.mapbox.com/search/searchbox/v1';
const MAPBOX_SEARCHBOX_LOCATION_TYPES = 'poi,address,street,place,city,locality,neighborhood,postcode';
const MAPBOX_GEOCODE_LOCATION_TYPES = 'poi,address,place,locality,neighborhood,postcode';
const MAPBOX_MAP_TARGET_TYPES = 'country,region,district,place,locality,neighborhood,address,poi,postcode';
const MAPBOX_NEARBY_PLACE_DEFAULT_LIMIT = 72;
const MAPBOX_NEARBY_PLACE_MAX_LIMIT = 160;
const MAPBOX_NEARBY_PLACE_CATEGORY_CONCURRENCY = 5;
const ENABLE_MAP_MOCK_FALLBACK = String(import.meta.env.VITE_ENABLE_MAP_MOCK_FALLBACK ?? '').trim().toLowerCase() === 'true';
const PREFER_CLIENT_REVERSE_GEOCODE = import.meta.env.MODE !== 'test';
const PLACE_PHOTO_LOOKUP_CACHE_LIMIT = 96;
const REVERSE_GEOCODE_CACHE_LIMIT = 160;
const MAPBOX_GEOCODE_FETCH_TIMEOUT_MS = 4500;

const NEARBY_PLACE_CATEGORIES = [
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'food_and_drink', label: 'Food & drink' },
  { id: 'cafe', label: 'Cafe' },
  { id: 'coffee', label: 'Coffee' },
  { id: 'bar', label: 'Bar' },
  { id: 'grocery', label: 'Grocery' },
  { id: 'supermarket', label: 'Supermarket' },
  { id: 'tourist_attraction', label: 'Landmark' },
  { id: 'museum', label: 'Museum' },
  { id: 'park', label: 'Park' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'amusement_park', label: 'Amusement park' },
  { id: 'bowling_alley', label: 'Bowling' },
  { id: 'movie_theater', label: 'Movie theater' },
  { id: 'hotel', label: 'Hotel' },
  { id: 'gas_station', label: 'Gas station' },
  { id: 'parking', label: 'Parking' },
  { id: 'pharmacy', label: 'Pharmacy' },
  { id: 'hospital', label: 'Hospital' },
  { id: 'bank', label: 'Bank' },
  { id: 'atm', label: 'ATM' },
  { id: 'school', label: 'School' },
] as const;

const NEARBY_PLACE_CATEGORY_LABELS = new Map(
  NEARBY_PLACE_CATEGORIES.map((category) => [category.id, category.label]),
);

const placePhotoLookupCache = new Map<string, Promise<PlacePhotoLookupResult>>();
const reverseGeocodeLookupCache = new Map<string, Promise<GeocodeResult>>();

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  placeName: string;
  formattedAddress?: string;
  address?: string;
  city?: string;
  country?: string;
  countryCode?: string;
  postalCode?: string;
  providerPlaceId?: string;
  precision?: string;
}

export interface PlaceSearchResult extends GeocodeResult {
  id?: string;
  category?: string;
  distanceKm?: number;
  photoUrl?: string;
  photoAttribution?: string;
  photoAttributionUrl?: string;
  source: 'mapbox' | 'mock';
}

export interface PlacePhotoLookupOptions {
  title: string;
  address?: string;
  latitude: number;
  longitude: number;
  maxWidthPx?: number;
}

export interface PlacePhotoLookupResult {
  configured: boolean;
  coverage: string;
  photoUrl?: string;
  photoAttribution?: string;
  photoAttributionUrl?: string;
  source: string;
  license?: string;
}

export interface NearbyPlaceBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface NearbyPlaceSearchOptions {
  center: CoordinatePair;
  bounds?: NearbyPlaceBounds | null;
  categories?: readonly string[];
  limit?: number;
}

export interface NearbyPlaceResult extends PlaceSearchResult {
  categoryId?: string;
  categoryLabel?: string;
  photoUrl?: string;
}

export interface PlaceSearchOptions {
  bboxRadiusKm?: number | null;
  limit?: number;
  proximity?: CoordinatePair;
  sortByDistance?: boolean;
  types?: string;
}

export interface LocationSearchOptions extends PlaceSearchOptions {
  preferPoi?: boolean;
}

interface MapboxFeature {
  id?: unknown;
  center?: unknown;
  text?: unknown;
  place_name?: unknown;
  address?: unknown;
  place_type?: unknown;
  context?: unknown;
  properties?: unknown;
  relevance?: unknown;
}

interface MapboxGeocodeResponse {
  features?: unknown;
}

interface MapboxSearchBoxSuggestResponse {
  suggestions?: unknown;
}

interface MapboxSearchBoxSuggestion {
  feature_type?: unknown;
  mapbox_id?: unknown;
  name?: unknown;
  full_address?: unknown;
  place_formatted?: unknown;
  address?: unknown;
  poi_category?: unknown;
  maki?: unknown;
  distance?: unknown;
}

interface MapboxSearchBoxRetrieveResponse {
  features?: unknown;
}

interface MapboxSearchBoxFeature {
  geometry?: {
    coordinates?: unknown;
  };
  properties?: unknown;
}

interface MapboxSearchBoxCategoryResponse {
  features?: unknown;
}

interface MapboxSearchBoxCategoryFeature {
  geometry?: {
    coordinates?: unknown;
  };
  properties?: unknown;
}

interface CoordinatePair {
  latitude: number;
  longitude: number;
}

function sanitizeGeocodeResult(result: GeocodeResult): GeocodeResult {
  const latitude = Number(result.latitude);
  const longitude = Number(result.longitude);
  const formattedAddress = sanitizeSingleLineText(result.formattedAddress);
  const address = sanitizeSingleLineText(result.address);
  const placeName = sanitizeSingleLineText(result.placeName) || formattedAddress || address || 'Pinned location';

  return {
    latitude,
    longitude,
    placeName,
    formattedAddress: formattedAddress || undefined,
    address: address || undefined,
    city: sanitizeSingleLineText(result.city) || undefined,
    country: sanitizeSingleLineText(result.country) || undefined,
    countryCode: sanitizeSingleLineText(result.countryCode)?.toLowerCase() || undefined,
    postalCode: sanitizeSingleLineText(result.postalCode) || undefined,
    providerPlaceId: sanitizeSingleLineText(result.providerPlaceId) || undefined,
    precision: sanitizeSingleLineText(result.precision) || undefined,
  };
}

function hasUsableCoordinates(result: GeocodeResult): boolean {
  return Number.isFinite(result.latitude) && result.latitude >= -90 && result.latitude <= 90 &&
    Number.isFinite(result.longitude) && result.longitude >= -180 && result.longitude <= 180;
}

function isFiniteCoordinatePair(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

function sanitizeGeocodeEnvelope(
  response: ApiEnvelope<GeocodeResult[] | GeocodeResult> | GeocodeResult[] | GeocodeResult,
): ApiEnvelope<GeocodeResult[]> {
  const payload = unwrapApiData(response);
  const results = Array.isArray(payload) ? payload : [payload];

  return {
    ...(typeof response === 'object' && response !== null && 'meta' in response ? { meta: response.meta } : {}),
    data: results.map((result) => sanitizeGeocodeResult(result)).filter(hasUsableCoordinates),
  };
}

function sanitizeExternalUrl(value: unknown): string | undefined {
  const text = sanitizeSingleLineText(value as string | null | undefined);
  if (!text) {
    return undefined;
  }

  try {
    const url = new URL(text, 'https://scope.local');
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function sanitizePlacePhotoLookup(
  response: ApiEnvelope<PlacePhotoLookupResult> | PlacePhotoLookupResult,
): PlacePhotoLookupResult {
  const payload = unwrapApiData(response) as Partial<PlacePhotoLookupResult>;

  return {
    configured: Boolean(payload.configured),
    coverage: sanitizeSingleLineText(payload.coverage) || '',
    photoUrl: sanitizeImageUrl(payload.photoUrl ?? undefined),
    photoAttribution: sanitizeSingleLineText(payload.photoAttribution) || undefined,
    photoAttributionUrl: sanitizeExternalUrl(payload.photoAttributionUrl),
    source: sanitizeSingleLineText(payload.source) || 'Google Places',
    license: sanitizeSingleLineText(payload.license) || undefined,
  };
}

function formatCoordinateLabel(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

function calculateDistanceKm(origin: CoordinatePair, destination: CoordinatePair): number {
  return calculateHaversineDistanceKm(origin, destination);
}

function clampCoordinate(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function toRadians(value: number): number {
  return degreesToRadians(value);
}

function lookupCoordinateKey(value: number): string {
  return Number.isFinite(value) ? value.toFixed(5) : String(value);
}

function getCachedLookup<T>(cache: Map<string, Promise<T>>, key: string): Promise<T> | null {
  const cached = cache.get(key);
  if (!cached) {
    return null;
  }

  cache.delete(key);
  cache.set(key, cached);
  return cached;
}

function setCachedLookup<T>(
  cache: Map<string, Promise<T>>,
  key: string,
  lookup: Promise<T>,
  limit: number,
): Promise<T> {
  cache.set(key, lookup);

  while (cache.size > limit) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    cache.delete(oldestKey);
  }

  return lookup;
}

function buildPlacePhotoLookupCacheKey(options: Required<PlacePhotoLookupOptions>): string {
  return [
    normalizeSearchText(options.title),
    normalizeSearchText(options.address),
    lookupCoordinateKey(options.latitude),
    lookupCoordinateKey(options.longitude),
    String(options.maxWidthPx),
  ].join('|');
}

function buildReverseGeocodeCacheKey(latitude: number, longitude: number): string {
  return `${lookupCoordinateKey(latitude)}|${lookupCoordinateKey(longitude)}`;
}

function buildCoordinateResult(latitude: number, longitude: number): GeocodeResult {
  const coordinateLabel = formatCoordinateLabel(latitude, longitude);
  return sanitizeGeocodeResult({
    latitude,
    longitude,
    placeName: 'Pinned location',
    formattedAddress: coordinateLabel,
    precision: 'coordinate',
  });
}

function readMapboxCoordinate(feature: MapboxFeature, fallback?: CoordinatePair): CoordinatePair | null {
  const center = Array.isArray(feature.center) ? feature.center : [];
  const longitude = Number(center[0]);
  const latitude = Number(center[1]);
  if (isFiniteCoordinatePair(latitude, longitude)) {
    return { latitude, longitude };
  }

  if (fallback && isFiniteCoordinatePair(fallback.latitude, fallback.longitude)) {
    return fallback;
  }

  return null;
}

function readMapboxContextValue(context: unknown, prefixes: string[]): string | undefined {
  if (!Array.isArray(context)) {
    return undefined;
  }

  for (const item of context) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const candidate = item as { id?: unknown; text?: unknown };
    const identifier = sanitizeSingleLineText(candidate.id);
    if (!prefixes.some((prefix) => identifier.startsWith(`${prefix}.`))) {
      continue;
    }

    const value = sanitizeSingleLineText(candidate.text);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function readMapboxContextShortCode(context: unknown, prefixes: string[]): string | undefined {
  if (!Array.isArray(context)) {
    return undefined;
  }

  for (const item of context) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const candidate = item as { id?: unknown; short_code?: unknown };
    const identifier = sanitizeSingleLineText(candidate.id);
    if (!prefixes.some((prefix) => identifier.startsWith(`${prefix}.`))) {
      continue;
    }

    const value = sanitizeSingleLineText(candidate.short_code);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function readMapboxPrecision(feature: MapboxFeature): string | undefined {
  if (!Array.isArray(feature.place_type)) {
    return undefined;
  }

  return sanitizeSingleLineText(feature.place_type[0]) || undefined;
}

function readMapboxProperty(feature: MapboxFeature, propertyName: string): string | undefined {
  const properties = feature.properties;
  if (!properties || typeof properties !== 'object') {
    return undefined;
  }

  return sanitizeSingleLineText((properties as Record<string, unknown>)[propertyName]) || undefined;
}

function readFlexibleProperty(source: unknown, propertyName: string): unknown {
  if (!source || typeof source !== 'object') {
    return undefined;
  }

  return (source as Record<string, unknown>)[propertyName];
}

function readFlexibleText(source: unknown, propertyName: string): string | undefined {
  return sanitizeSingleLineText(readFlexibleProperty(source, propertyName) as string | null | undefined) || undefined;
}

function readFlexibleTextList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSingleLineText(item as string | null | undefined)).filter(Boolean);
  }

  const text = sanitizeSingleLineText(value as string | null | undefined);
  return text ? [text] : [];
}

function readFlexibleImageUrl(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return sanitizeImageUrl(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const imageUrl = readFlexibleImageUrl(item);
      if (imageUrl) {
        return imageUrl;
      }
    }

    return undefined;
  }

  if (!value || typeof value !== 'object') {
    return undefined;
  }

  for (const propertyName of ['url', 'uri', 'href', 'photoUrl', 'photo_url', 'imageUrl', 'image_url', 'thumbnail']) {
    const imageUrl = readFlexibleImageUrl((value as Record<string, unknown>)[propertyName]);
    if (imageUrl) {
      return imageUrl;
    }
  }

  return undefined;
}

function readMapboxFeaturePhotoUrl(properties: unknown): string | undefined {
  for (const propertyName of ['photoUrl', 'photo_url', 'imageUrl', 'image_url', 'thumbnail', 'photo', 'image', 'photos', 'images']) {
    const imageUrl = readFlexibleImageUrl(readFlexibleProperty(properties, propertyName));
    if (imageUrl) {
      return imageUrl;
    }
  }

  return undefined;
}

function mapboxFeatureToGeocodeResult(
  feature: MapboxFeature,
  fallback?: CoordinatePair,
  options: { preserveFallbackCoordinates?: boolean } = {},
): GeocodeResult | null {
  const resolvedCoordinate = options.preserveFallbackCoordinates && fallback
    ? fallback
    : readMapboxCoordinate(feature, fallback);
  if (!resolvedCoordinate) {
    return null;
  }

  const placeName = sanitizeSingleLineText(feature.text) || 'Pinned location';
  const houseNumber = sanitizeSingleLineText(feature.address);
  const formattedAddress = sanitizeSingleLineText(feature.place_name) || placeName;
  const address = [houseNumber, placeName].filter(Boolean).join(' ') || undefined;

  return sanitizeGeocodeResult({
    latitude: resolvedCoordinate.latitude,
    longitude: resolvedCoordinate.longitude,
    placeName,
    formattedAddress,
    address,
    city: readMapboxContextValue(feature.context, ['place', 'locality', 'neighborhood']),
    country: readMapboxContextValue(feature.context, ['country']),
    countryCode: readMapboxContextShortCode(feature.context, ['country']),
    postalCode: readMapboxProperty(feature, 'postcode') ||
      readMapboxProperty(feature, 'postal_code') ||
      readMapboxContextValue(feature.context, ['postcode']),
    providerPlaceId: sanitizeSingleLineText(feature.id) || undefined,
    precision: readMapboxPrecision(feature),
  });
}

function mapboxFeatureToPlaceSearchResult(
  feature: MapboxFeature,
  proximity?: CoordinatePair,
): PlaceSearchResult | null {
  const geocodeResult = mapboxFeatureToGeocodeResult(feature);
  if (!geocodeResult) {
    return null;
  }

  const candidateCoordinate = {
    latitude: geocodeResult.latitude,
    longitude: geocodeResult.longitude,
  };
  const distanceKm = proximity && isFiniteCoordinatePair(proximity.latitude, proximity.longitude)
    ? calculateDistanceKm(proximity, candidateCoordinate)
    : undefined;

  return {
    ...geocodeResult,
    id: sanitizeSingleLineText(feature.id) || undefined,
    category: readMapboxProperty(feature, 'category') || readMapboxProperty(feature, 'maki'),
    photoUrl: readMapboxFeaturePhotoUrl(feature.properties),
    distanceKm: distanceKm === undefined ? undefined : Number(distanceKm.toFixed(2)),
    source: 'mapbox',
  };
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isPoiPrecision(precision?: string): boolean {
  return normalizeSearchText(precision ?? '') === 'poi';
}

function isExactLocationNameMatch(query: string, result: PlaceSearchResult): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return false;
  }

  return [
    result.placeName,
    result.formattedAddress?.split(',')[0],
    result.address,
  ]
    .map((value) => normalizeSearchText(value ?? ''))
    .some((value) => value === normalizedQuery);
}

function sortPlaceResultsByDistance(results: PlaceSearchResult[]): PlaceSearchResult[] {
  return [...results].sort((left, right) => (
    (left.distanceKm ?? Number.MAX_SAFE_INTEGER) - (right.distanceKm ?? Number.MAX_SAFE_INTEGER)
  ));
}

function rankLocationSearchResults(query: string, results: PlaceSearchResult[]): PlaceSearchResult[] {
  const indexedResults = results.map((result, index) => ({ result, index }));
  const hasExactNonPoiMatch = indexedResults.some(({ result }) => (
    !isPoiPrecision(result.precision) && isExactLocationNameMatch(query, result)
  ));

  if (hasExactNonPoiMatch) {
    return indexedResults
      .sort((left, right) => {
        const leftExact = isExactLocationNameMatch(query, left.result) ? 1 : 0;
        const rightExact = isExactLocationNameMatch(query, right.result) ? 1 : 0;
        if (leftExact !== rightExact) {
          return rightExact - leftExact;
        }

        const leftPoi = isPoiPrecision(left.result.precision) ? 1 : 0;
        const rightPoi = isPoiPrecision(right.result.precision) ? 1 : 0;
        if (leftPoi !== rightPoi) {
          return leftPoi - rightPoi;
        }

        return left.index - right.index;
      })
      .map(({ result }) => result);
  }

  if (results.length && results.every((result) => isPoiPrecision(result.precision))) {
    return sortPlaceResultsByDistance(results);
  }

  return results;
}

function isRelevantPlaceSearchResult(query: string, result: PlaceSearchResult): boolean {
  const queryTokens = normalizeSearchText(query)
    .split(/\s+/)
    .filter((token) => token.length > 2);
  if (!queryTokens.length) {
    return true;
  }

  const searchableWords = normalizeSearchText([
    result.placeName,
    result.formattedAddress,
    result.address,
    result.category,
  ].filter(Boolean).join(' '))
    .split(/\s+/)
    .filter(Boolean);

  if (queryTokens.length === 1 && queryTokens[0].length > 3) {
    return searchableWords.includes(queryTokens[0]);
  }

  return queryTokens.every((token) => searchableWords.some((word) => (
    word === token ||
    word.startsWith(token) ||
    token.startsWith(word)
  )));
}

function buildBoundingBox(proximity: CoordinatePair, radiusKm: number): string | null {
  if (!isFiniteCoordinatePair(proximity.latitude, proximity.longitude) || !Number.isFinite(radiusKm) || radiusKm <= 0) {
    return null;
  }

  const latitudeDelta = radiusKm / 111.32;
  const longitudeScale = Math.max(Math.cos(toRadians(proximity.latitude)), 0.2);
  const longitudeDelta = radiusKm / (111.32 * longitudeScale);
  const minLongitude = clampCoordinate(proximity.longitude - longitudeDelta, -180, 180);
  const minLatitude = clampCoordinate(proximity.latitude - latitudeDelta, -90, 90);
  const maxLongitude = clampCoordinate(proximity.longitude + longitudeDelta, -180, 180);
  const maxLatitude = clampCoordinate(proximity.latitude + latitudeDelta, -90, 90);

  return [minLongitude, minLatitude, maxLongitude, maxLatitude].map((coordinate) => coordinate.toFixed(6)).join(',');
}

function hasValidNearbyBounds(bounds: NearbyPlaceBounds | null | undefined): bounds is NearbyPlaceBounds {
  return Boolean(
    bounds &&
    Number.isFinite(bounds.west) &&
    Number.isFinite(bounds.south) &&
    Number.isFinite(bounds.east) &&
    Number.isFinite(bounds.north) &&
    bounds.south >= -90 &&
    bounds.north <= 90 &&
    bounds.south < bounds.north &&
    bounds.west >= -180 &&
    bounds.east <= 180 &&
    bounds.west < bounds.east,
  );
}

function buildNearbyPlaceBoundingBox(bounds: NearbyPlaceBounds | null | undefined): string | null {
  if (!hasValidNearbyBounds(bounds)) {
    return null;
  }

  return [bounds.west, bounds.south, bounds.east, bounds.north]
    .map((coordinate) => coordinate.toFixed(6))
    .join(',');
}

function isCoordinateInsideBounds(coordinate: CoordinatePair, bounds: NearbyPlaceBounds | null | undefined): boolean {
  if (!hasValidNearbyBounds(bounds)) {
    return true;
  }

  return coordinate.longitude >= bounds.west &&
    coordinate.longitude <= bounds.east &&
    coordinate.latitude >= bounds.south &&
    coordinate.latitude <= bounds.north;
}

function sanitizeNearbyPlaceCategoryId(categoryId: string): string {
  return sanitizeSingleLineText(categoryId).toLowerCase().replace(/[^a-z0-9_]/g, '');
}

function getNearbyPlaceCategoryLabel(categoryId: string): string {
  return NEARBY_PLACE_CATEGORY_LABELS.get(categoryId) ?? categoryId
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeNearbyPlaceCategoryIds(categoryIds: readonly string[] | undefined): string[] {
  const requestedCategoryIds = categoryIds?.length
    ? categoryIds
    : NEARBY_PLACE_CATEGORIES.map((category) => category.id);
  return [...new Set(requestedCategoryIds.map(sanitizeNearbyPlaceCategoryId).filter(Boolean))];
}

function clampNearbyPlaceLimit(limit: number | undefined): number {
  return Math.max(1, Math.min(Math.round(limit ?? MAPBOX_NEARBY_PLACE_DEFAULT_LIMIT), MAPBOX_NEARBY_PLACE_MAX_LIMIT));
}

function chunkItems<T>(items: readonly T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

function buildMapboxCategorySearchUrl(
  categoryId: string,
  options: NearbyPlaceSearchOptions,
  limit: number,
): URL | null {
  const token = getMapboxToken();
  if (!token || !isFiniteCoordinatePair(options.center.latitude, options.center.longitude)) {
    return null;
  }

  const url = new URL(`${MAPBOX_SEARCHBOX_BASE_URL}/category/${encodeURIComponent(categoryId)}`);
  url.searchParams.set('access_token', token);
  url.searchParams.set('language', 'en');
  url.searchParams.set('limit', String(Math.max(1, Math.min(limit, 25))));
  url.searchParams.set('proximity', `${options.center.longitude},${options.center.latitude}`);

  const boundingBox = buildNearbyPlaceBoundingBox(options.bounds);
  if (boundingBox) {
    url.searchParams.set('bbox', boundingBox);
  }

  return url;
}

function buildMapboxSearchSessionToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `scope-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function buildMapboxSearchBoxSuggestUrl(query: string, limit: number, sessionToken: string, options: PlaceSearchOptions): URL | null {
  const token = getMapboxToken();
  if (!token) {
    return null;
  }

  const url = new URL(`${MAPBOX_SEARCHBOX_BASE_URL}/suggest`);
  url.searchParams.set('access_token', token);
  url.searchParams.set('session_token', sessionToken);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(Math.max(1, Math.min(limit, 10))));
  url.searchParams.set('language', 'en');
  url.searchParams.set('types', options.types ?? 'poi');

  if (options.proximity && isFiniteCoordinatePair(options.proximity.latitude, options.proximity.longitude)) {
    url.searchParams.set('proximity', `${options.proximity.longitude},${options.proximity.latitude}`);
    if (options.bboxRadiusKm !== null) {
      const boundingBox = buildBoundingBox(options.proximity, options.bboxRadiusKm ?? 80);
      if (boundingBox) {
        url.searchParams.set('bbox', boundingBox);
      }
    }
  }

  return url;
}

function buildMapboxSearchBoxRetrieveUrl(mapboxId: string, sessionToken: string): URL | null {
  const token = getMapboxToken();
  if (!token || !mapboxId) {
    return null;
  }

  const url = new URL(`${MAPBOX_SEARCHBOX_BASE_URL}/retrieve/${encodeURIComponent(mapboxId)}`);
  url.searchParams.set('access_token', token);
  url.searchParams.set('session_token', sessionToken);
  return url;
}

function buildMapboxGeocodeUrl(query: string, limit: number, options: PlaceSearchOptions = {}): URL | null {
  const token = getMapboxToken();
  if (!token) {
    return null;
  }

  const url = new URL(`${MAPBOX_GEOCODE_BASE_URL}/${encodeURIComponent(query)}.json`);
  url.searchParams.set('access_token', token);
  url.searchParams.set('autocomplete', 'true');
  url.searchParams.set('limit', String(Math.max(1, Math.min(limit, 10))));
  url.searchParams.set('types', options.types ?? 'address,poi,place,locality,neighborhood,postcode');
  url.searchParams.set('language', 'en');
  if (options.proximity && isFiniteCoordinatePair(options.proximity.latitude, options.proximity.longitude)) {
    url.searchParams.set('proximity', `${options.proximity.longitude},${options.proximity.latitude}`);
    if (options.bboxRadiusKm !== null) {
      const boundingBox = buildBoundingBox(options.proximity, options.bboxRadiusKm ?? 80);
      if (boundingBox) {
        url.searchParams.set('bbox', boundingBox);
      }
    }
  }
  return url;
}

function buildMapboxReverseGeocodeUrl(latitude: number, longitude: number): URL | null {
  const token = getMapboxToken();
  if (!token) {
    return null;
  }

  const url = new URL(`${MAPBOX_GEOCODE_BASE_URL}/${longitude},${latitude}.json`);
  url.searchParams.set('access_token', token);
  url.searchParams.set('limit', '1');
  url.searchParams.set('types', 'address,poi,place,locality,neighborhood');
  url.searchParams.set('language', 'en');
  return url;
}

async function fetchMapboxFeatures(url: URL | null): Promise<MapboxFeature[]> {
  if (!url || typeof fetch !== 'function') {
    return [];
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller
    ? window.setTimeout(() => controller.abort(), MAPBOX_GEOCODE_FETCH_TIMEOUT_MS)
    : null;

  try {
    const response = await fetch(url.toString(), controller ? { signal: controller.signal } : undefined);
    if (!response.ok) {
      return [];
    }

    const payload = await response.json().catch(() => null) as MapboxGeocodeResponse | null;
    return Array.isArray(payload?.features) ? payload.features as MapboxFeature[] : [];
  } catch {
    return [];
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
}

async function fetchMapboxSearchBoxSuggestions(url: URL | null): Promise<MapboxSearchBoxSuggestion[]> {
  if (!url || typeof fetch !== 'function') {
    return [];
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    return [];
  }

  const payload = await response.json().catch(() => null) as MapboxSearchBoxSuggestResponse | null;
  return Array.isArray(payload?.suggestions) ? payload.suggestions as MapboxSearchBoxSuggestion[] : [];
}

async function fetchMapboxSearchBoxFeature(url: URL | null): Promise<MapboxSearchBoxFeature | null> {
  if (!url || typeof fetch !== 'function') {
    return null;
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null) as MapboxSearchBoxRetrieveResponse | null;
  const features = Array.isArray(payload?.features) ? payload.features as MapboxSearchBoxFeature[] : [];
  return features[0] ?? null;
}

async function fetchMapboxSearchBoxCategoryFeatures(url: URL | null): Promise<MapboxSearchBoxCategoryFeature[]> {
  if (!url || typeof fetch !== 'function') {
    return [];
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    return [];
  }

  const payload = await response.json().catch(() => null) as MapboxSearchBoxCategoryResponse | null;
  return Array.isArray(payload?.features) ? payload.features as MapboxSearchBoxCategoryFeature[] : [];
}

async function geocodeWithMapbox(query: string, limit: number, options: PlaceSearchOptions = {}): Promise<GeocodeResult[]> {
  const features = await fetchMapboxFeatures(buildMapboxGeocodeUrl(query, limit, options));
  return features
    .map((feature) => mapboxFeatureToGeocodeResult(feature))
    .filter((result): result is GeocodeResult => Boolean(result))
    .slice(0, limit);
}

function readSearchBoxFeatureCoordinate(feature: MapboxSearchBoxFeature): CoordinatePair | null {
  const coordinates = Array.isArray(feature.geometry?.coordinates) ? feature.geometry.coordinates : [];
  const longitude = Number(coordinates[0]);
  const latitude = Number(coordinates[1]);
  return isFiniteCoordinatePair(latitude, longitude) ? { latitude, longitude } : null;
}

function mapboxSearchBoxFeatureToPlaceSearchResult(
  suggestion: MapboxSearchBoxSuggestion,
  feature: MapboxSearchBoxFeature,
  proximity?: CoordinatePair,
): PlaceSearchResult | null {
  const coordinate = readSearchBoxFeatureCoordinate(feature);
  if (!coordinate) {
    return null;
  }

  const properties = feature.properties ?? {};
  const placeName = readFlexibleText(properties, 'name') || sanitizeSingleLineText(suggestion.name as string | null | undefined) || 'Pinned location';
  const fullAddress = readFlexibleText(properties, 'full_address') ||
    sanitizeSingleLineText(suggestion.full_address as string | null | undefined) ||
    sanitizeSingleLineText(suggestion.place_formatted as string | null | undefined) ||
    placeName;
  const address = readFlexibleText(properties, 'address') ||
    sanitizeSingleLineText(suggestion.address as string | null | undefined) ||
    undefined;
  const context = readFlexibleProperty(properties, 'context');
  const postalCode = readFlexibleText(properties, 'postcode') ||
    readFlexibleText(properties, 'postal_code') ||
    readFlexibleText(readFlexibleProperty(context, 'postcode'), 'name');
  const featureType = readFlexibleText(properties, 'feature_type') ||
    sanitizeSingleLineText(suggestion.feature_type as string | null | undefined) ||
    'poi';
  const category = [
    ...readFlexibleTextList(readFlexibleProperty(properties, 'poi_category')),
    ...readFlexibleTextList(suggestion.poi_category),
    readFlexibleText(properties, 'maki') || sanitizeSingleLineText(suggestion.maki as string | null | undefined),
  ].filter(Boolean)[0];
  const distanceKm = proximity && isFiniteCoordinatePair(proximity.latitude, proximity.longitude)
    ? calculateDistanceKm(proximity, coordinate)
    : Number(suggestion.distance) > 0
      ? Number(suggestion.distance) / 1000
      : undefined;

  return {
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    placeName,
    formattedAddress: fullAddress,
    address,
    city: readFlexibleText(readFlexibleProperty(context, 'place'), 'name') ||
      readFlexibleText(readFlexibleProperty(context, 'city'), 'name') ||
      readFlexibleText(readFlexibleProperty(context, 'locality'), 'name') ||
      readFlexibleText(readFlexibleProperty(context, 'neighborhood'), 'name'),
    country: readFlexibleText(readFlexibleProperty(context, 'country'), 'name'),
    countryCode: readFlexibleText(readFlexibleProperty(context, 'country'), 'country_code') ||
      readFlexibleText(readFlexibleProperty(context, 'country'), 'short_code'),
    postalCode,
    providerPlaceId: sanitizeSingleLineText(suggestion.mapbox_id as string | null | undefined) || readFlexibleText(properties, 'mapbox_id'),
    precision: featureType,
    id: sanitizeSingleLineText(suggestion.mapbox_id as string | null | undefined) || readFlexibleText(properties, 'mapbox_id'),
    category,
    photoUrl: readMapboxFeaturePhotoUrl(properties) || readMapboxFeaturePhotoUrl(suggestion),
    distanceKm: distanceKm === undefined ? undefined : Number(distanceKm.toFixed(2)),
    source: 'mapbox',
  };
}

function isProviderFallbackResult(result: GeocodeResult): boolean {
  return normalizeSearchText(result.precision ?? '') === 'fallback';
}

function mapboxSearchBoxCategoryFeatureToNearbyPlaceResult(
  categoryId: string,
  feature: MapboxSearchBoxCategoryFeature,
  proximity: CoordinatePair,
): NearbyPlaceResult | null {
  const coordinate = readSearchBoxFeatureCoordinate(feature as MapboxSearchBoxFeature);
  if (!coordinate) {
    return null;
  }

  const properties = feature.properties ?? {};
  const context = readFlexibleProperty(properties, 'context');
  const postalCode = readFlexibleText(properties, 'postcode') ||
    readFlexibleText(properties, 'postal_code') ||
    readFlexibleText(readFlexibleProperty(context, 'postcode'), 'name');
  const categoryLabel = getNearbyPlaceCategoryLabel(categoryId);
  const placeName = readFlexibleText(properties, 'name') ||
    readFlexibleText(properties, 'name_preferred') ||
    categoryLabel ||
    'Nearby place';
  const formattedAddress = readFlexibleText(properties, 'full_address') ||
    [
      readFlexibleText(properties, 'address'),
      readFlexibleText(properties, 'place_formatted'),
    ].filter(Boolean).join(', ') ||
    undefined;
  const category = [
    ...readFlexibleTextList(readFlexibleProperty(properties, 'poi_category')),
    readFlexibleText(properties, 'maki'),
    categoryLabel,
  ].filter(Boolean)[0];
  const distanceKm = calculateDistanceKm(proximity, coordinate);

  return {
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    placeName,
    formattedAddress,
    address: readFlexibleText(properties, 'address') || undefined,
    city: readFlexibleText(readFlexibleProperty(context, 'place'), 'name') ||
      readFlexibleText(readFlexibleProperty(context, 'city'), 'name') ||
      readFlexibleText(readFlexibleProperty(context, 'locality'), 'name') ||
      readFlexibleText(readFlexibleProperty(context, 'neighborhood'), 'name'),
    country: readFlexibleText(readFlexibleProperty(context, 'country'), 'name'),
    postalCode,
    providerPlaceId: readFlexibleText(properties, 'mapbox_id') || undefined,
    precision: readFlexibleText(properties, 'feature_type') || 'poi',
    id: readFlexibleText(properties, 'mapbox_id') || undefined,
    category,
    categoryId,
    categoryLabel,
    photoUrl: readMapboxFeaturePhotoUrl(properties),
    distanceKm: Number(distanceKm.toFixed(2)),
    source: 'mapbox',
  };
}

async function searchPlacesWithSearchBox(query: string, options: PlaceSearchOptions): Promise<PlaceSearchResult[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 6, 10));
  const sessionToken = buildMapboxSearchSessionToken();
  const searchOptions = {
    ...options,
    bboxRadiusKm: options.proximity ? options.bboxRadiusKm ?? 80 : options.bboxRadiusKm,
    types: options.types ?? 'poi',
  };
  const suggestions = await fetchMapboxSearchBoxSuggestions(buildMapboxSearchBoxSuggestUrl(query, limit, sessionToken, searchOptions));
  const results = await Promise.all(suggestions.slice(0, limit).map(async (suggestion) => {
    const mapboxId = sanitizeSingleLineText(suggestion.mapbox_id as string | null | undefined);
    const feature = await fetchMapboxSearchBoxFeature(buildMapboxSearchBoxRetrieveUrl(mapboxId, sessionToken));
    return feature ? mapboxSearchBoxFeatureToPlaceSearchResult(suggestion, feature, options.proximity) : null;
  }));

  const filteredResults = results
    .filter((result): result is PlaceSearchResult => Boolean(result))
    .filter((result) => isRelevantPlaceSearchResult(query, result));

  return (options.sortByDistance === false ? filteredResults : sortPlaceResultsByDistance(filteredResults)).slice(0, limit);
}

async function searchPlacesWithMapbox(query: string, options: PlaceSearchOptions): Promise<PlaceSearchResult[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 6, 10));
  const placeSearchOptions = {
    ...options,
    bboxRadiusKm: options.proximity ? options.bboxRadiusKm ?? 80 : options.bboxRadiusKm,
  };
  const requestedTypes = options.types;
  let features = await fetchMapboxFeatures(buildMapboxGeocodeUrl(query, limit, {
    ...placeSearchOptions,
    types: requestedTypes ?? 'poi',
  }));

  if (!features.length && !requestedTypes) {
    features = await fetchMapboxFeatures(buildMapboxGeocodeUrl(query, limit, {
      ...placeSearchOptions,
      types: 'poi,address,place,locality,neighborhood',
    }));
  }

  if (!features.length && options.proximity && options.bboxRadiusKm !== null) {
    features = await fetchMapboxFeatures(buildMapboxGeocodeUrl(query, limit, {
      ...options,
      bboxRadiusKm: null,
      types: requestedTypes ?? 'poi',
    }));

    if (!features.length && !requestedTypes) {
      features = await fetchMapboxFeatures(buildMapboxGeocodeUrl(query, limit, {
        ...options,
        bboxRadiusKm: null,
        types: 'poi,address,place,locality,neighborhood',
      }));
    }
  }

  const filteredResults = features
    .map((feature) => mapboxFeatureToPlaceSearchResult(feature, options.proximity))
    .filter((result): result is PlaceSearchResult => Boolean(result))
    .filter((result) => isRelevantPlaceSearchResult(query, result));

  return (options.sortByDistance === false ? filteredResults : sortPlaceResultsByDistance(filteredResults)).slice(0, limit);
}

async function searchLocationsWithMapbox(query: string, options: LocationSearchOptions): Promise<PlaceSearchResult[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 6, 10));
  const searchTypes = options.types ?? MAPBOX_GEOCODE_LOCATION_TYPES;
  const features = await fetchMapboxFeatures(buildMapboxGeocodeUrl(query, limit, {
    ...options,
    bboxRadiusKm: options.proximity ? options.bboxRadiusKm ?? 120 : options.bboxRadiusKm,
    types: searchTypes,
  }));

  const filteredResults = features
    .map((feature) => mapboxFeatureToPlaceSearchResult(feature, options.proximity))
    .filter((result): result is PlaceSearchResult => Boolean(result))
    .filter((result) => isRelevantPlaceSearchResult(query, result));

  return (options.sortByDistance === false ? filteredResults : sortPlaceResultsByDistance(filteredResults)).slice(0, limit);
}

async function reverseGeocodeWithMapbox(latitude: number, longitude: number): Promise<GeocodeResult | null> {
  const features = await fetchMapboxFeatures(buildMapboxReverseGeocodeUrl(latitude, longitude));
  const feature = features[0];
  if (!feature) {
    return null;
  }

  return mapboxFeatureToGeocodeResult(feature, { latitude, longitude }, { preserveFallbackCoordinates: true });
}

function preserveClickedCoordinates(result: GeocodeResult, latitude: number, longitude: number): GeocodeResult {
  return sanitizeGeocodeResult({
    ...result,
    latitude,
    longitude,
  });
}

async function resolveReverseFallback(latitude: number, longitude: number): Promise<GeocodeResult> {
  const mapboxResult = await reverseGeocodeWithMapbox(latitude, longitude).catch(() => null);
  return mapboxResult ?? buildCoordinateResult(latitude, longitude);
}

export async function geocode(query: string, limit = 5): Promise<ApiEnvelope<GeocodeResult[]>> {
  const sanitizedQuery = sanitizeSingleLineText(query);

  try {
    const { data } = await api.get<ApiEnvelope<GeocodeResult[] | GeocodeResult> | GeocodeResult[] | GeocodeResult>(`${INTEL_BASE_PATH}/geocode`, {
      params: { q: sanitizedQuery, limit },
    });
    const envelope = sanitizeGeocodeEnvelope(data);
    const providerResults = envelope.data.filter((result) => !isProviderFallbackResult(result));
    if (providerResults.length || !envelope.data.length) {
      return { ...envelope, data: providerResults };
    }
  } catch {
    // Retry against Mapbox below so provider outages never fall into mocked pins.
  }

  const mapboxResults = await geocodeWithMapbox(sanitizedQuery, limit).catch(() => []);
  if (mapboxResults.length) {
    return { data: mapboxResults };
  }

  if (ENABLE_MAP_MOCK_FALLBACK) {
    const { mockSpots } = await loadMockData();
    const normalizedQuery = sanitizedQuery.toLowerCase();
    const matchedSpots = mockSpots
      .filter((spot) => [spot.title, spot.address, spot.city, spot.country].filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery))
      .map<GeocodeResult>((spot) => ({
        latitude: spot.latitude,
        longitude: spot.longitude,
        placeName: spot.title,
        city: spot.city,
        country: spot.country,
      }));

    return sanitizeGeocodeEnvelope(paginateItems(matchedSpots.slice(0, limit), 1, limit));
  }

  return { data: [] };
}

export async function geocodeMapTarget(query: string, limit = 5): Promise<ApiEnvelope<GeocodeResult[]>> {
  const sanitizedQuery = sanitizeSingleLineText(query);
  if (!sanitizedQuery) {
    return { data: [] };
  }

  const mapboxResults = await geocodeWithMapbox(sanitizedQuery, limit, {
    types: MAPBOX_MAP_TARGET_TYPES,
    sortByDistance: false,
  }).catch(() => []);
  if (mapboxResults.length) {
    return { data: mapboxResults };
  }

  return geocode(sanitizedQuery, limit);
}

export async function searchPlaces(query: string, options: PlaceSearchOptions = {}): Promise<ApiEnvelope<PlaceSearchResult[]>> {
  const sanitizedQuery = sanitizeSingleLineText(query);
  const limit = Math.max(1, Math.min(options.limit ?? 6, 10));
  if (!sanitizedQuery) {
    return { data: [] };
  }

  const mapboxResults = await searchPlacesWithSearchBox(sanitizedQuery, { ...options, limit })
    .then((results) => results.length ? results : searchPlacesWithMapbox(sanitizedQuery, { ...options, limit }))
    .catch(() => searchPlacesWithMapbox(sanitizedQuery, { ...options, limit }).catch(() => []));
  if (mapboxResults.length) {
    return { data: mapboxResults };
  }

  if (ENABLE_MAP_MOCK_FALLBACK) {
    const normalizedQuery = sanitizedQuery.toLowerCase();
    const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
    const { mockSpots } = await loadMockData();
    const matchedSpots = mockSpots
      .map((spot) => {
        const haystack = [
          spot.title,
          spot.address,
          spot.city,
          spot.country,
          spot.category,
          spot.vibe,
        ].filter(Boolean).join(' ').toLowerCase();
        const matchesQuery = queryTokens.every((token) => haystack.includes(token));
        const distanceKm = options.proximity && isFiniteCoordinatePair(options.proximity.latitude, options.proximity.longitude)
          ? calculateDistanceKm(options.proximity, { latitude: spot.latitude, longitude: spot.longitude })
          : undefined;

        return { spot, matchesQuery, distanceKm };
      })
      .filter((candidate) => candidate.matchesQuery)
      .sort((left, right) => (left.distanceKm ?? Number.MAX_SAFE_INTEGER) - (right.distanceKm ?? Number.MAX_SAFE_INTEGER))
      .slice(0, limit)
      .map<PlaceSearchResult>(({ spot, distanceKm }) => ({
        latitude: spot.latitude,
        longitude: spot.longitude,
        placeName: spot.title,
        formattedAddress: [spot.address, spot.city, spot.country].filter(Boolean).join(', ') || undefined,
        address: spot.address,
        city: spot.city,
        country: spot.country,
        precision: 'mock',
        id: spot.id,
        category: spot.category,
        photoUrl: spot.photoUrl,
        distanceKm: distanceKm === undefined ? undefined : Number(distanceKm.toFixed(2)),
        source: 'mock',
      }));

    return { data: matchedSpots };
  }

  return { data: [] };
}

function buildDevPlacePhotoUrl(options: Required<PlacePhotoLookupOptions>): URL | null {
  if (!import.meta.env.DEV || import.meta.env.MODE === 'test' || typeof window === 'undefined') {
    return null;
  }

  const url = new URL('/__scope-dev/place-photo', window.location.origin);
  url.searchParams.set('q', options.title);
  url.searchParams.set('lat', String(options.latitude));
  url.searchParams.set('lng', String(options.longitude));
  url.searchParams.set('maxWidthPx', String(options.maxWidthPx));
  if (options.address) {
    url.searchParams.set('address', options.address);
  }

  return url;
}

async function getDevGooglePlacePhoto(options: Required<PlacePhotoLookupOptions>): Promise<PlacePhotoLookupResult | null> {
  const url = buildDevPlacePhotoUrl(options);
  if (!url || typeof fetch !== 'function') {
    return null;
  }

  try {
    const response = await fetch(url, {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      return null;
    }

    return sanitizePlacePhotoLookup(await response.json());
  } catch {
    return null;
  }
}

export async function getPlacePhoto(options: PlacePhotoLookupOptions): Promise<PlacePhotoLookupResult> {
  const requestedMaxWidth = Number(options.maxWidthPx ?? 640);
  const normalizedOptions: Required<PlacePhotoLookupOptions> = {
    title: sanitizeSingleLineText(options.title),
    address: sanitizeSingleLineText(options.address) || '',
    latitude: Number(options.latitude),
    longitude: Number(options.longitude),
    maxWidthPx: Number.isFinite(requestedMaxWidth) ? Math.max(128, Math.min(requestedMaxWidth, 1600)) : 640,
  };

  if (!normalizedOptions.title || !isFiniteCoordinatePair(normalizedOptions.latitude, normalizedOptions.longitude)) {
    return sanitizePlacePhotoLookup({
      configured: false,
      coverage: 'A place name and coordinates are required before loading a photo.',
      source: 'Google Places',
    });
  }

  const cacheKey = buildPlacePhotoLookupCacheKey(normalizedOptions);
  const cachedLookup = getCachedLookup(placePhotoLookupCache, cacheKey);
  if (cachedLookup) {
    return cachedLookup;
  }

  const lookup = (async () => {
    const devPlacePhoto = await getDevGooglePlacePhoto(normalizedOptions);
    if (devPlacePhoto) {
      return devPlacePhoto;
    }

    try {
      const { data } = await api.get<ApiEnvelope<PlacePhotoLookupResult> | PlacePhotoLookupResult>(`${INTEL_BASE_PATH}/place-photo`, {
        params: {
          q: normalizedOptions.title,
          address: normalizedOptions.address || undefined,
          lat: normalizedOptions.latitude,
          lng: normalizedOptions.longitude,
          maxWidthPx: normalizedOptions.maxWidthPx,
        },
      });

      return sanitizePlacePhotoLookup(data);
    } catch {
      return sanitizePlacePhotoLookup({
        configured: false,
        coverage: 'Google Places photo lookup is unavailable right now.',
        source: 'Google Places',
      });
    }
  })();

  return setCachedLookup(placePhotoLookupCache, cacheKey, lookup, PLACE_PHOTO_LOOKUP_CACHE_LIMIT);
}

function buildNearbyPlaceDedupeKey(place: NearbyPlaceResult): string {
  const identifier = sanitizeSingleLineText(place.id);
  if (identifier) {
    return identifier;
  }

  return [
    normalizeSearchText(place.placeName),
    place.latitude.toFixed(5),
    place.longitude.toFixed(5),
  ].join(':');
}

function normalizeNearbyPlaceResults(
  results: NearbyPlaceResult[],
  options: NearbyPlaceSearchOptions,
  limit: number,
): NearbyPlaceResult[] {
  const uniqueResults = new Map<string, NearbyPlaceResult>();

  results
    .filter((place) => hasUsableCoordinates(place))
    .filter((place) => isCoordinateInsideBounds(place, options.bounds))
    .forEach((place) => {
      const dedupeKey = buildNearbyPlaceDedupeKey(place);
      const existingPlace = uniqueResults.get(dedupeKey);
      if (!existingPlace || (place.distanceKm ?? Number.MAX_SAFE_INTEGER) < (existingPlace.distanceKm ?? Number.MAX_SAFE_INTEGER)) {
        uniqueResults.set(dedupeKey, place);
      }
    });

  return [...uniqueResults.values()]
    .sort((left, right) => (
      (left.distanceKm ?? Number.MAX_SAFE_INTEGER) - (right.distanceKm ?? Number.MAX_SAFE_INTEGER)
    ))
    .slice(0, limit);
}

async function searchNearbyPlacesWithMapbox(options: NearbyPlaceSearchOptions, limit: number): Promise<NearbyPlaceResult[]> {
  const categoryIds = normalizeNearbyPlaceCategoryIds(options.categories);
  if (!categoryIds.length || !isFiniteCoordinatePair(options.center.latitude, options.center.longitude)) {
    return [];
  }

  const perCategoryLimit = Math.max(8, Math.min(25, Math.ceil(limit / Math.min(categoryIds.length, 6)) + 2));
  const categoryResults: NearbyPlaceResult[] = [];
  const categoryBatches = chunkItems(categoryIds, MAPBOX_NEARBY_PLACE_CATEGORY_CONCURRENCY);

  for (const categoryBatch of categoryBatches) {
    const batchResults = await Promise.all(categoryBatch.map(async (categoryId) => {
      const features = await fetchMapboxSearchBoxCategoryFeatures(
        buildMapboxCategorySearchUrl(categoryId, options, perCategoryLimit),
      ).catch(() => []);

      return features
        .map((feature) => mapboxSearchBoxCategoryFeatureToNearbyPlaceResult(categoryId, feature, options.center))
        .filter((place): place is NearbyPlaceResult => Boolean(place));
    }));

    categoryResults.push(...batchResults.flat());
  }

  return normalizeNearbyPlaceResults(categoryResults, options, limit);
}

async function searchNearbyPlacesWithMockData(options: NearbyPlaceSearchOptions, limit: number): Promise<NearbyPlaceResult[]> {
  const { mockSpots } = await loadMockData();
  const nearbyPlaces = mockSpots
    .filter((spot) => isFiniteCoordinatePair(spot.latitude, spot.longitude))
    .map<NearbyPlaceResult>((spot) => ({
      latitude: spot.latitude,
      longitude: spot.longitude,
      placeName: spot.title,
      formattedAddress: [spot.address, spot.city, spot.country].filter(Boolean).join(', ') || undefined,
      address: spot.address,
      city: spot.city,
      country: spot.country,
      precision: 'mock',
      id: spot.id,
      category: spot.category,
      categoryId: spot.category,
      categoryLabel: spot.category.charAt(0).toUpperCase() + spot.category.slice(1),
      photoUrl: spot.photoUrl,
      distanceKm: Number(calculateDistanceKm(options.center, { latitude: spot.latitude, longitude: spot.longitude }).toFixed(2)),
      source: 'mock',
    }));

  return normalizeNearbyPlaceResults(nearbyPlaces, options, limit);
}

export async function searchNearbyPlaces(options: NearbyPlaceSearchOptions): Promise<ApiEnvelope<NearbyPlaceResult[]>> {
  if (!isFiniteCoordinatePair(options.center.latitude, options.center.longitude)) {
    return { data: [] };
  }

  const limit = clampNearbyPlaceLimit(options.limit);
  const mapboxResults = await searchNearbyPlacesWithMapbox(options, limit).catch(() => []);
  if (mapboxResults.length) {
    return { data: mapboxResults };
  }

  if (ENABLE_MAP_MOCK_FALLBACK) {
    return { data: await searchNearbyPlacesWithMockData(options, limit).catch(() => []) };
  }

  return { data: [] };
}

export async function searchLocations(query: string, options: LocationSearchOptions = {}): Promise<ApiEnvelope<PlaceSearchResult[]>> {
  const sanitizedQuery = sanitizeSingleLineText(query);
  const limit = Math.max(1, Math.min(options.limit ?? 6, 10));
  if (!sanitizedQuery) {
    return { data: [] };
  }

  const searchBoxResults = await searchPlacesWithSearchBox(sanitizedQuery, {
    ...options,
    limit,
    sortByDistance: false,
    types: options.types ?? MAPBOX_SEARCHBOX_LOCATION_TYPES,
  }).catch(() => []);
  if (searchBoxResults.length) {
    return { data: rankLocationSearchResults(sanitizedQuery, searchBoxResults).slice(0, limit) };
  }

  const poiResults = options.preferPoi === false
    ? []
    : await searchPlacesWithSearchBox(sanitizedQuery, {
      ...options,
      limit,
      sortByDistance: true,
      types: 'poi',
    }).catch(() => []);
  if (poiResults.length) {
    return { data: poiResults };
  }

  const mapboxResults = await searchLocationsWithMapbox(sanitizedQuery, {
    ...options,
    limit,
    sortByDistance: false,
  }).catch(() => []);
  if (mapboxResults.length) {
    return { data: rankLocationSearchResults(sanitizedQuery, mapboxResults).slice(0, limit) };
  }

  const fallbackResults = await searchPlaces(sanitizedQuery, { ...options, limit, types: options.types }).catch(() => ({ data: [] }));
  return { data: fallbackResults.data };
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<GeocodeResult> {
  const cacheKey = buildReverseGeocodeCacheKey(latitude, longitude);
  const cachedLookup = getCachedLookup(reverseGeocodeLookupCache, cacheKey);
  if (cachedLookup) {
    return cachedLookup;
  }

  const lookup = (async () => {
    let triedClientMapbox = false;
    if (PREFER_CLIENT_REVERSE_GEOCODE) {
      triedClientMapbox = true;
      const mapboxResult = await reverseGeocodeWithMapbox(latitude, longitude).catch(() => null);
      if (mapboxResult) {
        return mapboxResult;
      }
    }

    try {
      const { data } = await api.get<ApiEnvelope<GeocodeResult> | GeocodeResult>(`${INTEL_BASE_PATH}/reverse-geocode`, {
        params: { lat: latitude, lng: longitude },
      });
      const result = preserveClickedCoordinates(sanitizeGeocodeResult(unwrapApiData(data)), latitude, longitude);
      if (result.precision === 'fallback') {
        return triedClientMapbox ? buildCoordinateResult(latitude, longitude) : resolveReverseFallback(latitude, longitude);
      }

      return result;
    } catch {
      return triedClientMapbox ? buildCoordinateResult(latitude, longitude) : resolveReverseFallback(latitude, longitude);
    }
  })();

  return setCachedLookup(reverseGeocodeLookupCache, cacheKey, lookup, REVERSE_GEOCODE_CACHE_LIMIT);
}

export const __mapServiceCoverage = import.meta.env.MODE === 'test'
  ? {
      buildBoundingBox,
      buildCoordinateResult,
      buildDevPlacePhotoUrl,
      buildMapboxCategorySearchUrl,
      buildMapboxGeocodeUrl,
      buildMapboxReverseGeocodeUrl,
      buildMapboxSearchBoxRetrieveUrl,
      buildMapboxSearchBoxSuggestUrl,
      buildMapboxSearchSessionToken,
      buildNearbyPlaceBoundingBox,
      buildNearbyPlaceDedupeKey,
      buildPlacePhotoLookupCacheKey,
      buildReverseGeocodeCacheKey,
      calculateDistanceKm,
      chunkItems,
      clampCoordinate,
      clampNearbyPlaceLimit,
      fetchMapboxFeatures,
      fetchMapboxSearchBoxCategoryFeatures,
      fetchMapboxSearchBoxFeature,
      fetchMapboxSearchBoxSuggestions,
      formatCoordinateLabel,
      getCachedLookup,
      getDevGooglePlacePhoto,
      getNearbyPlaceCategoryLabel,
      hasUsableCoordinates,
      hasValidNearbyBounds,
      isCoordinateInsideBounds,
      isExactLocationNameMatch,
      isFiniteCoordinatePair,
      isPoiPrecision,
      isProviderFallbackResult,
      isRelevantPlaceSearchResult,
      lookupCoordinateKey,
      mapboxFeatureToGeocodeResult,
      mapboxFeatureToPlaceSearchResult,
      mapboxSearchBoxCategoryFeatureToNearbyPlaceResult,
      mapboxSearchBoxFeatureToPlaceSearchResult,
      normalizeNearbyPlaceCategoryIds,
      normalizeNearbyPlaceResults,
      normalizeSearchText,
      preserveClickedCoordinates,
      rankLocationSearchResults,
      readFlexibleImageUrl,
      readFlexibleProperty,
      readFlexibleText,
      readFlexibleTextList,
      readMapboxContextShortCode,
      readMapboxContextValue,
      readMapboxCoordinate,
      readMapboxFeaturePhotoUrl,
      readMapboxPrecision,
      readMapboxProperty,
      readSearchBoxFeatureCoordinate,
      sanitizeExternalUrl,
      sanitizeGeocodeEnvelope,
      sanitizeGeocodeResult,
      sanitizeNearbyPlaceCategoryId,
      sanitizePlacePhotoLookup,
      setCachedLookup,
      sortPlaceResultsByDistance,
      toRadians,
    }
  : undefined;
