import api from '@/services/api';
import { getMapboxToken } from '@/services/mapboxLoader';
import { loadMockData } from '@/services/mockDataLoader';
import { paginateItems, unwrapApiData } from '@/services/serviceUtils';
import type { ApiEnvelope } from '@/types';
import { sanitizeSingleLineText } from '@/utils/sanitizers';

const INTEL_BASE_PATH = '/api/intel';
const MAPBOX_GEOCODE_BASE_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const MAPBOX_SEARCHBOX_BASE_URL = 'https://api.mapbox.com/search/searchbox/v1';
const MAPBOX_SEARCHBOX_LOCATION_TYPES = 'poi,address,street,place,city,locality,neighborhood,postcode';
const MAPBOX_GEOCODE_LOCATION_TYPES = 'poi,address,place,locality,neighborhood,postcode';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  placeName: string;
  formattedAddress?: string;
  address?: string;
  city?: string;
  country?: string;
  precision?: string;
}

export interface PlaceSearchResult extends GeocodeResult {
  id?: string;
  category?: string;
  distanceKm?: number;
  source: 'mapbox' | 'mock';
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

function formatCoordinateLabel(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

function calculateDistanceKm(origin: CoordinatePair, destination: CoordinatePair): number {
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function clampCoordinate(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
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
    const boundingBox = buildBoundingBox(options.proximity, options.bboxRadiusKm ?? 80);
    if (boundingBox) {
      url.searchParams.set('bbox', boundingBox);
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
    const boundingBox = buildBoundingBox(options.proximity, options.bboxRadiusKm ?? 80);
    if (boundingBox) {
      url.searchParams.set('bbox', boundingBox);
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

  const response = await fetch(url.toString());
  if (!response.ok) {
    return [];
  }

  const payload = await response.json().catch(() => null) as MapboxGeocodeResponse | null;
  return Array.isArray(payload?.features) ? payload.features as MapboxFeature[] : [];
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

async function geocodeWithMapbox(query: string, limit: number): Promise<GeocodeResult[]> {
  const features = await fetchMapboxFeatures(buildMapboxGeocodeUrl(query, limit));
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
    precision: featureType,
    id: sanitizeSingleLineText(suggestion.mapbox_id as string | null | undefined) || readFlexibleText(properties, 'mapbox_id'),
    category,
    distanceKm: distanceKm === undefined ? undefined : Number(distanceKm.toFixed(2)),
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
    return sanitizeGeocodeEnvelope(data);
  } catch {
    const mapboxResults = await geocodeWithMapbox(sanitizedQuery, limit).catch(() => []);
    if (mapboxResults.length) {
      return { data: mapboxResults };
    }

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
      distanceKm: distanceKm === undefined ? undefined : Number(distanceKm.toFixed(2)),
      source: 'mock',
    }));

  return { data: matchedSpots };
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
  try {
    const { data } = await api.get<ApiEnvelope<GeocodeResult> | GeocodeResult>(`${INTEL_BASE_PATH}/reverse-geocode`, {
      params: { lat: latitude, lng: longitude },
    });
    const result = preserveClickedCoordinates(sanitizeGeocodeResult(unwrapApiData(data)), latitude, longitude);
    if (result.precision === 'fallback') {
      return resolveReverseFallback(latitude, longitude);
    }

    return result;
  } catch {
    return resolveReverseFallback(latitude, longitude);
  }
}
