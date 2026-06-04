import {
  geocode,
  searchLocations,
  type GeocodeResult,
  type PlaceSearchResult,
} from '@/services/mapService';
import { calculateHaversineDistanceKm } from '@/utils/geoDistance';
import { sanitizeScopeAiProviderQuery } from '@/services/scopeAiSafety';

interface CoordinatePair {
  latitude: number;
  longitude: number;
}

export type ScopeAiLocationResolutionStatus = 'resolved' | 'ambiguous' | 'not_found';

export interface ScopeAiLocationResolution {
  status: ScopeAiLocationResolutionStatus;
  query: string;
  result: PlaceSearchResult | null;
  candidates: PlaceSearchResult[];
}

export interface ScopeAiLocationResolveOptions {
  proximity?: CoordinatePair | null;
  limit?: number;
  scope?: 'global' | 'route-biased';
}

const SPECIFIC_ADDRESS_PATTERN = /\b\d{1,6}\s+[\w'.-]+(?:\s+[\w'.-]+){0,6}\s+(?:street|st|road|rd|avenue|ave|boulevard|blvd|drive|dr|lane|ln|court|ct|circle|cir|way|parkway|pkwy|highway|hwy|trail|trl|terrace|ter|place|pl|plaza|plz|county road|cr|route)\b/i;
const US_POSTAL_CODE_PATTERN = /\b\d{5}(?:-\d{4})?\b/;
const US_STATE_ALIASES: Record<string, string> = {
  al: 'alabama',
  ak: 'alaska',
  az: 'arizona',
  ar: 'arkansas',
  ca: 'california',
  co: 'colorado',
  ct: 'connecticut',
  de: 'delaware',
  fl: 'florida',
  ga: 'georgia',
  hi: 'hawaii',
  id: 'idaho',
  il: 'illinois',
  in: 'indiana',
  ia: 'iowa',
  ks: 'kansas',
  ky: 'kentucky',
  la: 'louisiana',
  me: 'maine',
  md: 'maryland',
  ma: 'massachusetts',
  mi: 'michigan',
  mn: 'minnesota',
  ms: 'mississippi',
  mo: 'missouri',
  mt: 'montana',
  ne: 'nebraska',
  nv: 'nevada',
  nh: 'new hampshire',
  nj: 'new jersey',
  nm: 'new mexico',
  ny: 'new york',
  nc: 'north carolina',
  nd: 'north dakota',
  oh: 'ohio',
  ok: 'oklahoma',
  or: 'oregon',
  pa: 'pennsylvania',
  ri: 'rhode island',
  sc: 'south carolina',
  sd: 'south dakota',
  tn: 'tennessee',
  tx: 'texas',
  ut: 'utah',
  vt: 'vermont',
  va: 'virginia',
  wa: 'washington',
  wv: 'west virginia',
  wi: 'wisconsin',
  wy: 'wyoming',
  dc: 'district of columbia',
};
const US_STATE_NAMES = new Map(Object.entries(US_STATE_ALIASES).map(([abbreviation, name]) => [name, abbreviation]));
const LOCATION_FILLER_TOKENS = new Set([
  'usa',
  'united',
  'states',
  'america',
]);
const STRONG_ROUTE_BIAS_MAX_DISTANCE_KM = 25;
const STRONG_ROUTE_BIAS_MIN_GAP_KM = 50;
const STRONG_ROUTE_BIAS_MIN_RATIO = 8;

function normalizePlaceText(value: string | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasCoordinatePair(place: PlaceSearchResult): boolean {
  return Number.isFinite(place.latitude) &&
    Number.isFinite(place.longitude) &&
    place.latitude >= -90 &&
    place.latitude <= 90 &&
    place.longitude >= -180 &&
    place.longitude <= 180;
}

function calculateDistanceKm(left: CoordinatePair, right: CoordinatePair): number {
  return calculateHaversineDistanceKm(left, right);
}

function mapGeocodeResultToPlaceSearchResult(result: GeocodeResult): PlaceSearchResult {
  return {
    ...result,
    source: 'mapbox',
  };
}

function getPlaceSearchText(place: PlaceSearchResult): string {
  return normalizePlaceText([
    place.placeName,
    place.formattedAddress,
    place.address,
    place.city,
    place.country,
  ].filter(Boolean).join(' '));
}

function getPlaceRawSearchText(place: PlaceSearchResult): string {
  return [
    place.placeName,
    place.formattedAddress,
    place.address,
    place.city,
    place.country,
  ].filter(Boolean).join(' ');
}

function getQuerySpecificityTokens(query: string): string[] {
  return normalizePlaceText(query)
    .split(' ')
    .filter((token) => token.length > 1);
}

function isSpecificAddressQuery(query: string): boolean {
  return SPECIFIC_ADDRESS_PATTERN.test(query);
}

function extractUsPostalCode(value: string): string | null {
  const match = value.match(US_POSTAL_CODE_PATTERN)?.[0];
  return match ? match.slice(0, 5) : null;
}

function hasMatchingPostalCode(query: string, place: PlaceSearchResult): boolean {
  const queryPostalCode = extractUsPostalCode(query);
  if (!queryPostalCode) {
    return true;
  }

  const placePostalCode = extractUsPostalCode(getPlaceRawSearchText(place));
  return Boolean(placePostalCode && placePostalCode === queryPostalCode);
}

function includesNormalizedPhrase(haystack: string, phrase: string): boolean {
  const normalizedHaystack = ` ${normalizePlaceText(haystack)} `;
  const normalizedPhrase = normalizePlaceText(phrase);
  return Boolean(normalizedPhrase && normalizedHaystack.includes(` ${normalizedPhrase} `));
}

function extractRequiredStateAliases(query: string): string[] {
  const normalizedQuery = normalizePlaceText(query);
  if (!normalizedQuery) {
    return [];
  }

  const queryWords = normalizedQuery.split(' ').filter(Boolean);
  const queryWordSet = new Set(queryWords);
  for (const [abbreviation, stateName] of Object.entries(US_STATE_ALIASES)) {
    if (queryWordSet.has(abbreviation) || includesNormalizedPhrase(normalizedQuery, stateName)) {
      return [abbreviation, stateName];
    }
  }

  return [];
}

function hasMatchingState(query: string, place: PlaceSearchResult): boolean {
  const requiredAliases = extractRequiredStateAliases(query);
  if (!requiredAliases.length) {
    return true;
  }

  const placeText = getPlaceRawSearchText(place);
  return requiredAliases.some((alias) => includesNormalizedPhrase(placeText, alias));
}

function stripStatePostalAndCountry(value: string): string {
  let next = value.replace(US_POSTAL_CODE_PATTERN, ' ');
  for (const [abbreviation, stateName] of Object.entries(US_STATE_ALIASES)) {
    next = next
      .replace(new RegExp(`\\b${abbreviation}\\b`, 'gi'), ' ')
      .replace(new RegExp(`\\b${stateName.replace(/\s+/g, '\\s+')}\\b`, 'gi'), ' ');
  }

  return next
    .replace(/\b(?:usa|u\.s\.a\.|united states(?: of america)?|america)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getAddressMatchText(query: string): string {
  return query.match(SPECIFIC_ADDRESS_PATTERN)?.[0] ?? '';
}

function extractRequiredLocalityTokens(query: string): string[] {
  if (!isSpecificAddressQuery(query)) {
    return [];
  }

  const commaParts = query.split(',').map((part) => part.trim()).filter(Boolean);
  const addressText = getAddressMatchText(query);
  const localitySource = commaParts.length >= 2
    ? commaParts[1] ?? ''
    : query.replace(addressText, ' ');
  const normalizedLocality = normalizePlaceText(stripStatePostalAndCountry(localitySource));
  if (!normalizedLocality) {
    return [];
  }

  return normalizedLocality
    .split(' ')
    .filter((token) => token.length > 2 && !LOCATION_FILLER_TOKENS.has(token) && !US_STATE_ALIASES[token] && !US_STATE_NAMES.has(token));
}

function hasMatchingLocality(query: string, place: PlaceSearchResult): boolean {
  const localityTokens = extractRequiredLocalityTokens(query);
  if (!localityTokens.length) {
    return true;
  }

  const searchWords = new Set(getPlaceSearchText(place).split(' ').filter(Boolean));
  return localityTokens.every((token) => searchWords.has(token));
}

function matchesSpecificAddress(query: string, place: PlaceSearchResult): boolean {
  const tokens = getQuerySpecificityTokens(query);
  if (tokens.length < 2) {
    return false;
  }

  const searchText = getPlaceSearchText(place);
  const houseNumber = tokens.find((token) => /^\d+$/.test(token));
  if (houseNumber && !searchText.split(' ').includes(houseNumber)) {
    return false;
  }

  const streetTokens = tokens.filter((token) => !/^\d+$/.test(token));
  return streetTokens.slice(0, 2).every((token) => searchText.includes(token));
}

function matchesRequiredQuerySpecificity(query: string, place: PlaceSearchResult): boolean {
  if (!hasMatchingPostalCode(query, place)) {
    return false;
  }

  if (!hasMatchingState(query, place)) {
    return false;
  }

  if (!hasMatchingLocality(query, place)) {
    return false;
  }

  if (isSpecificAddressQuery(query) && !matchesSpecificAddress(query, place)) {
    return false;
  }

  return true;
}

function hasTypedRegionalQualifier(query: string): boolean {
  return Boolean(
    extractUsPostalCode(query) ||
    extractRequiredStateAliases(query).length ||
    extractRequiredLocalityTokens(query).length
  );
}

function isExactPlaceMatch(query: string, place: PlaceSearchResult): boolean {
  const normalizedQuery = normalizePlaceText(query);
  if (!normalizedQuery) {
    return false;
  }

  return [
    place.placeName,
    place.formattedAddress?.split(',')[0],
    place.address,
  ].some((value) => normalizePlaceText(value) === normalizedQuery);
}

function isExactRegionalPlaceMatch(query: string, place: PlaceSearchResult): boolean {
  if (!extractRequiredStateAliases(query).length || !hasMatchingState(query, place)) {
    return false;
  }

  const queryLocality = normalizePlaceText(stripStatePostalAndCountry(query));
  if (!queryLocality) {
    return false;
  }

  return [
    place.placeName,
    place.formattedAddress?.split(',')[0],
    place.formattedAddress,
  ].some((value) => normalizePlaceText(stripStatePostalAndCountry(value ?? '')) === queryLocality);
}

function hasStrongRouteBiasedAddressMatch(query: string, first: PlaceSearchResult, second: PlaceSearchResult): boolean {
  if (
    hasTypedRegionalQualifier(query) ||
    !isSpecificAddressQuery(query) ||
    !matchesSpecificAddress(query, first) ||
    !matchesSpecificAddress(query, second) ||
    !Number.isFinite(first.distanceKm) ||
    !Number.isFinite(second.distanceKm)
  ) {
    return false;
  }

  const firstDistance = Math.max(first.distanceKm ?? Number.MAX_SAFE_INTEGER, 0.1);
  const secondDistance = second.distanceKm ?? Number.MAX_SAFE_INTEGER;
  return firstDistance <= STRONG_ROUTE_BIAS_MAX_DISTANCE_KM &&
    secondDistance - firstDistance >= STRONG_ROUTE_BIAS_MIN_GAP_KM &&
    secondDistance / firstDistance >= STRONG_ROUTE_BIAS_MIN_RATIO;
}

function shouldAcceptTopCandidate(query: string, candidates: PlaceSearchResult[]): boolean {
  const [first, second] = candidates;
  if (!first) {
    return false;
  }

  if (!matchesRequiredQuerySpecificity(query, first)) {
    return false;
  }

  if (isSpecificAddressQuery(query) && matchesSpecificAddress(query, first)) {
    if (!second) {
      return true;
    }

    return !matchesRequiredQuerySpecificity(query, second) ||
      hasStrongRouteBiasedAddressMatch(query, first, second);
  }

  if (extractRequiredStateAliases(query).length) {
    const firstExact = isExactPlaceMatch(query, first) || isExactRegionalPlaceMatch(query, first);
    if (!firstExact) {
      return false;
    }

    return !second || !(isExactPlaceMatch(query, second) || isExactRegionalPlaceMatch(query, second));
  }

  if (!second) {
    return true;
  }

  if (isExactPlaceMatch(query, first) && !isExactPlaceMatch(query, second)) {
    return true;
  }

  if (isExactRegionalPlaceMatch(query, first) && !isExactRegionalPlaceMatch(query, second)) {
    return true;
  }

  return false;
}

function sortCandidatesForResolution(candidates: PlaceSearchResult[], hasProximity: boolean): PlaceSearchResult[] {
  if (!hasProximity) {
    return candidates;
  }

  return [...candidates].sort((left, right) => (
    (left.distanceKm ?? Number.MAX_SAFE_INTEGER) - (right.distanceKm ?? Number.MAX_SAFE_INTEGER)
  ));
}

function withCandidateDistances(candidates: PlaceSearchResult[], proximity?: CoordinatePair | null): PlaceSearchResult[] {
  if (!proximity) {
    return candidates;
  }

  return candidates.map((candidate) => ({
    ...candidate,
    distanceKm: Number.isFinite(candidate.distanceKm)
      ? candidate.distanceKm
      : Number(calculateDistanceKm(proximity, {
        latitude: candidate.latitude,
        longitude: candidate.longitude,
      }).toFixed(2)),
  }));
}

function getResolutionCandidates(query: string, candidates: PlaceSearchResult[]): PlaceSearchResult[] {
  const requiredMatches = candidates.filter((candidate) => matchesRequiredQuerySpecificity(query, candidate));
  if (requiredMatches.length || extractUsPostalCode(query) || extractRequiredStateAliases(query).length || extractRequiredLocalityTokens(query).length) {
    return requiredMatches;
  }

  return candidates;
}

export function formatScopeAiResolvedPlaceLabel(place: PlaceSearchResult): string {
  return place.formattedAddress || place.placeName || place.address || 'Pinned location';
}

export async function resolveScopeAiLocationIntent(
  query: string,
  options: ScopeAiLocationResolveOptions = {},
): Promise<ScopeAiLocationResolution> {
  const normalizedQuery = sanitizeScopeAiProviderQuery(query).trim().replace(/[.!?]+$/g, '');
  if (!normalizedQuery) {
    return {
      status: 'not_found',
      query: normalizedQuery,
      result: null,
      candidates: [],
    };
  }

  const limit = Math.max(1, Math.min(Math.round(options.limit ?? 3), 5));
  const shouldUseRouteBias = options.scope !== 'global' &&
    Boolean(options.proximity) &&
    !hasTypedRegionalQualifier(normalizedQuery);
  const response = await searchLocations(normalizedQuery, {
    limit,
    sortByDistance: shouldUseRouteBias,
    ...(shouldUseRouteBias && options.proximity ? {
      proximity: options.proximity,
    } : {}),
  }).catch(() => ({ data: [] as PlaceSearchResult[] }));
  const locationCandidates = sortCandidatesForResolution(
    withCandidateDistances(response.data.filter(hasCoordinatePair), shouldUseRouteBias ? options.proximity : null),
    shouldUseRouteBias,
  ).slice(0, limit);
  const candidates = locationCandidates.length
    ? locationCandidates
    : sortCandidatesForResolution(await geocode(normalizedQuery, limit)
      .then((geocodeResponse) => withCandidateDistances(
        geocodeResponse.data.map(mapGeocodeResultToPlaceSearchResult).filter(hasCoordinatePair),
        shouldUseRouteBias ? options.proximity : null,
      ).slice(0, limit))
      .catch(() => []), shouldUseRouteBias);
  if (!candidates.length) {
    return {
      status: 'not_found',
      query: normalizedQuery,
      result: null,
      candidates: [],
    };
  }

  const resolutionCandidates = getResolutionCandidates(normalizedQuery, candidates);
  if (
    shouldAcceptTopCandidate(normalizedQuery, resolutionCandidates)
  ) {
    return {
      status: 'resolved',
      query: normalizedQuery,
      result: resolutionCandidates[0] ?? null,
      candidates,
    };
  }

  return {
    status: 'ambiguous',
    query: normalizedQuery,
    result: null,
    candidates,
  };
}
