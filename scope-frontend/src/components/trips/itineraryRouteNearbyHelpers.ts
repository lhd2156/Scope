import { getPlacePhoto, reverseGeocode, type NearbyPlaceBounds, type PlaceSearchResult } from '@/services/mapService';
import type { TravelNearbyCategory, TravelNearbySuggestion } from '@/services/travelNearbyService';
import type { FuelStationPrice, MapNearbyPlacePin, MapPoint, SpotCategory, SpotSummary, TripFuelType } from '@/types';
import { calculateHaversineDistanceKm } from '@/utils/geoDistance';
import { resolveSpotPhotoUrl } from '@/utils/imageFallbacks';
import { getSpotTrendingScore } from '@/utils/spotRanking';

export type RouteNearbyTabId = TravelNearbyCategory;
export type RouteNearbyQueryId =
  | 'recommended'
  | 'stay'
  | 'essentials'
  | 'food'
  | 'coffee'
  | 'nature'
  | 'scenic'
  | 'culture'
  | 'shopping'
  | 'entertainment'
  | 'nightlife'
  | 'custom';
export type RouteNearbyFuelFilterId = TripFuelType;
export type RouteNearbyFuelApiType = 'all' | 'regular' | 'midgrade' | 'premium' | 'diesel';
export type RouteNearbyFuelSortMode = 'closest' | 'best-price';

export interface RouteNearbyQuery {
  id: RouteNearbyQueryId;
  label: string;
  query: string;
  category?: SpotCategory;
  icon?: string;
  placeCategories?: readonly string[];
}

export interface RouteNearbyTab {
  id: RouteNearbyTabId;
  label: string;
  icon?: string;
}

export interface RouteNearbyFuelFilter {
  id: RouteNearbyFuelFilterId;
  label: string;
  icon: string;
  query: string;
  apiFuelType: RouteNearbyFuelApiType;
}

export interface RouteNearbyFuelSortOption {
  id: RouteNearbyFuelSortMode;
  label: string;
}

export interface RouteNearbyRadiusOption {
  id: string;
  label: string;
  radiusKm: number;
}

export interface RouteNearbyAnchor {
  id: string;
  shortLabel: string;
  placeLabel: string;
  latitude: number;
  longitude: number;
  routeRole?: MapPoint['routeRole'];
}

export interface RouteNearbyPlace {
  id: string;
  title: string;
  subtitle: string;
  latitude: number;
  longitude: number;
  category: SpotCategory;
  source: 'scope' | 'discovery' | 'fuel' | 'google';
  kind: RouteNearbyTabId;
  travelCategory?: string;
  anchorId?: string;
  distanceKm?: number;
  rating?: number;
  photoUrl?: string;
  photoAttribution?: string;
  photoAttributionUrl?: string;
  iconName?: string;
  address?: string;
  sourceLabel?: string;
  priceLabel?: string;
  priceValue?: number;
  fuelType?: string;
  recommendationScore?: number;
  recommendationReason?: string;
  isRecommended?: boolean;
}

export interface RouteNearbyFuelPriceSelection {
  placeId: string;
  stationName: string;
  pricePerGallon: number;
  fuelType?: TripFuelType;
}

interface ItineraryRouteNearbyHelperContext {
  getSelectedRouteNearbyTabId: () => RouteNearbyTabId;
  getSelectedRouteNearbyQueryId: () => RouteNearbyQueryId;
  getSelectedRouteNearbyQuery: () => RouteNearbyQuery;
  getSelectedRouteNearbyFuelFilterId: () => RouteNearbyFuelFilterId;
  getSelectedRouteNearbyFuelSortMode: () => RouteNearbyFuelSortMode;
  getSelectedRouteNearbyRadiusId: () => string;
  getRouteNearbyCustomRadiusMiles: () => string;
  getRouteNearbyCustomQuery: () => string;
  getRouteNearbyFuelSearchQuery: () => string;
  getRouteNearbyInterests: () => readonly SpotCategory[];
  getSelectedRouteNearbyAnchor: () => RouteNearbyAnchor | null;
}

const KILOMETERS_PER_MILE = 1.609344;
export const ROUTE_NEARBY_RESULT_LIMIT = 8;
export const ROUTE_NEARBY_MAP_PIN_LIMIT = 36;
export const ROUTE_NEARBY_PHOTO_WIDTH = 320;
export const ROUTE_NEARBY_CUSTOM_RADIUS_ID = 'custom';
export const ROUTE_NEARBY_CUSTOM_RADIUS_MIN_MI = 1;
export const ROUTE_NEARBY_CUSTOM_RADIUS_MAX_MI = 75;
export const ROUTE_NEARBY_CUSTOM_RADIUS_DEFAULT_MI = 40;
export const ROUTE_NEARBY_PROVIDER_RADIUS_LIMIT_KM = 50;
export const ROUTE_NEARBY_RECOMMENDATION_MIN_SCORE = 48;

const routeNearbyFuelTypeIds = new Set<TripFuelType>(['regular', 'midgrade', 'premium', 'diesel', 'ev']);
const routeNearbyRecommendedCategories = new Set<SpotCategory>([
  'food',
  'nature',
  'scenic',
  'culture',
  'shopping',
  'entertainment',
  'nightlife',
  'adventure',
]);

export const routeNearbyQueries: RouteNearbyQuery[] = [
  { id: 'recommended', label: 'Recommended', query: 'scenic food local attraction entertainment', placeCategories: ['tourist_attraction', 'restaurant', 'cafe', 'park', 'museum', 'shopping', 'amusement_park', 'bowling_alley', 'movie_theater'] },
  { id: 'stay', label: 'Stay', query: 'hotel motel campground rv park lodging', category: 'other', icon: 'pin', placeCategories: ['hotel'] },
  { id: 'essentials', label: 'Essentials', query: 'rest stop grocery pharmacy parking auto repair', category: 'other', icon: 'pin', placeCategories: ['parking', 'pharmacy', 'grocery', 'supermarket'] },
  { id: 'food', label: 'Food', query: 'restaurants food', category: 'food', icon: 'food', placeCategories: ['restaurant', 'food_and_drink'] },
  { id: 'coffee', label: 'Coffee', query: 'coffee cafe bakery', category: 'food', icon: 'food', placeCategories: ['coffee', 'cafe'] },
  { id: 'nature', label: 'Outdoors', query: 'park trail nature garden', category: 'nature', icon: 'nature', placeCategories: ['park'] },
  { id: 'scenic', label: 'Views', query: 'scenic viewpoint overlook landmark', category: 'scenic', icon: 'scenic', placeCategories: ['tourist_attraction', 'park'] },
  { id: 'culture', label: 'Culture', query: 'museum landmark culture historic', category: 'culture', icon: 'culture', placeCategories: ['museum', 'tourist_attraction'] },
  { id: 'shopping', label: 'Shopping', query: 'shopping store market mall', category: 'shopping', icon: 'shopping', placeCategories: ['shopping'] },
  { id: 'entertainment', label: 'Entertainment', query: 'entertainment bowling arcade theme park movie theater', category: 'entertainment', icon: 'entertainment', placeCategories: ['amusement_park', 'bowling_alley', 'movie_theater', 'tourist_attraction'] },
  { id: 'nightlife', label: 'Nightlife', query: 'bar live music nightlife', category: 'nightlife', icon: 'nightlife', placeCategories: ['bar'] },
];

export const routeNearbyExtraFilterQueryIds: RouteNearbyQueryId[] = ['coffee', 'nature', 'culture', 'shopping', 'entertainment', 'nightlife'];

export const routeNearbyTabs: RouteNearbyTab[] = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'fuel', label: 'Fuel/EV', icon: 'fuel' },
  { id: 'food', label: 'Food', icon: 'food' },
  { id: 'stay', label: 'Stay', icon: 'pin' },
  { id: 'essentials', label: 'Essentials', icon: 'pin' },
  { id: 'entertainment', label: 'Entertainment', icon: 'entertainment' },
  { id: 'scenic', label: 'Scenic', icon: 'scenic' },
];

export const routeNearbyFuelFilters: RouteNearbyFuelFilter[] = [
  { id: 'regular', label: 'Regular', icon: 'fuel', query: 'gas station', apiFuelType: 'regular' },
  { id: 'midgrade', label: 'Midgrade', icon: 'fuel', query: 'gas station', apiFuelType: 'midgrade' },
  { id: 'premium', label: 'Premium', icon: 'fuel', query: 'gas station premium', apiFuelType: 'premium' },
  { id: 'diesel', label: 'Diesel', icon: 'fuel', query: 'diesel gas station', apiFuelType: 'diesel' },
  { id: 'ev', label: 'EV', icon: 'fuel', query: 'ev charging station', apiFuelType: 'all' },
];

export const routeNearbyFuelSortOptions: RouteNearbyFuelSortOption[] = [
  { id: 'closest', label: 'Closest' },
  { id: 'best-price', label: 'Best price' },
];

export const routeNearbyRadiusOptions: RouteNearbyRadiusOption[] = [
  { id: '5mi', label: '5 mi', radiusKm: 8.05 },
  { id: '10mi', label: '10 mi', radiusKm: 16.09 },
  { id: '20mi', label: '20 mi', radiusKm: 32.19 },
  { id: '30mi', label: '30 mi', radiusKm: 48.28 },
];

export const defaultRouteNearbyRadiusOption = routeNearbyRadiusOptions[2]!;

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function clampRouteNearbyCustomRadiusMilesValue(value: number): number {
  if (!Number.isFinite(value)) {
    return ROUTE_NEARBY_CUSTOM_RADIUS_DEFAULT_MI;
  }

  return Math.min(ROUTE_NEARBY_CUSTOM_RADIUS_MAX_MI, Math.max(ROUTE_NEARBY_CUSTOM_RADIUS_MIN_MI, value));
}

export function formatRouteNearbyRadiusMilesValue(miles: number): string {
  const safeMiles = clampRouteNearbyCustomRadiusMilesValue(miles);
  const formattedMiles = safeMiles.toLocaleString('en-US', {
    maximumFractionDigits: safeMiles < 10 ? 1 : 0,
  });
  return `${formattedMiles} mi`;
}

export function normalizeTripFuelType(value: string | undefined): TripFuelType {
  const normalizedValue = String(value ?? '').trim().toLowerCase();
  return routeNearbyFuelTypeIds.has(normalizedValue as TripFuelType) ? (normalizedValue as TripFuelType) : 'regular';
}

export function cleanRouteNearbyLocationText(value: string | undefined): string {
  return String(value ?? '')
    .replace(/\bUnited States\b/gi, '')
    .replace(/\bUSA\b/gi, '')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*$/g, '')
    .trim();
}

export function normalizeRouteNearbyDedupeText(value: string | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/\b(united states|usa)\b/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function stripRouteNearbyLocationPrefix(value: string): string {
  const cleanedValue = cleanRouteNearbyLocationText(value);
  const dividerMatch = cleanedValue.match(/^(.+?)\s+-\s+(.+)$/);
  if (!dividerMatch) {
    return cleanedValue;
  }

  const [, prefix, detail] = dividerMatch;
  const normalizedPrefix = normalizeRouteNearbyDedupeText(prefix);
  const normalizedDetail = normalizeRouteNearbyDedupeText(detail);
  const looksLikeStreetAddress = /\d|\b(road|rd|street|st|avenue|ave|highway|hwy|drive|dr|lane|ln|boulevard|blvd|parkway|pkwy|way|court|ct|circle|cir)\b/i.test(detail);

  if (looksLikeStreetAddress || (normalizedPrefix && normalizedDetail.includes(normalizedPrefix))) {
    return cleanRouteNearbyLocationText(detail);
  }

  return cleanedValue;
}

export function normalizeRouteNearbyCategory(value: string | undefined, fallback: SpotCategory = 'other'): SpotCategory {
  const normalizedValue = value?.toLowerCase() ?? '';
  if (/(restaurant|food|coffee|cafe|bakery|barbecue|breakfast|lunch|dinner)/.test(normalizedValue)) {
    return 'food';
  }

  if (/(park|trail|nature|garden|wildlife|lake|river)/.test(normalizedValue)) {
    return 'nature';
  }

  if (/(view|scenic|overlook|landmark|lookout)/.test(normalizedValue)) {
    return 'scenic';
  }

  if (/(museum|gallery|culture|historic|monument|art)/.test(normalizedValue)) {
    return 'culture';
  }

  if (/(adventure|climb|bike|kayak|outdoor)/.test(normalizedValue)) {
    return 'adventure';
  }

  if (/(shop|market|store|mall)/.test(normalizedValue)) {
    return 'shopping';
  }

  if (/(entertainment|amusement|theme park|six flags|bowling|arcade|movie|cinema|concert|zoo|aquarium|stadium|arena|escape room|mini golf|laser tag)/.test(normalizedValue)) {
    return 'entertainment';
  }

  if (/(night|music|club|bar)/.test(normalizedValue)) {
    return 'nightlife';
  }

  return fallback;
}

export function normalizeTravelSuggestionCategory(value: string | undefined, fallback: SpotCategory = 'other'): SpotCategory {
  const normalizedValue = value?.toLowerCase() ?? '';
  if (/(food|restaurant|cafe|coffee|bakery)/.test(normalizedValue)) {
    return 'food';
  }

  if (/(nature|park|trail|outdoor)/.test(normalizedValue)) {
    return 'nature';
  }

  if (/(scenic|view|landmark|tourist)/.test(normalizedValue)) {
    return 'scenic';
  }

  if (/(culture|museum|gallery|historic|art)/.test(normalizedValue)) {
    return 'culture';
  }

  if (/(adventure|camp|rv|hike|climb)/.test(normalizedValue)) {
    return 'adventure';
  }

  if (/(shop|market|store|grocery|pharmacy)/.test(normalizedValue)) {
    return 'shopping';
  }

  if (/(entertainment|amusement|theme park|six flags|bowling|arcade|movie|cinema|concert|zoo|aquarium|stadium|arena|escape room|mini golf|laser tag)/.test(normalizedValue)) {
    return 'entertainment';
  }

  if (/(night|bar|music)/.test(normalizedValue)) {
    return 'nightlife';
  }

  return fallback;
}

export function formatRouteNearbyDistance(distanceKm: number | undefined): string {
  if (!Number.isFinite(distanceKm)) {
    return 'nearby';
  }

  const miles = Number(distanceKm) * 0.621371;
  if (miles < 0.1) {
    return '<0.1 mi';
  }

  return `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
}

export function formatTravelCategoryLabel(value: string): string {
  const normalizedValue = value.trim().replace(/[_-]+/g, ' ');
  if (!normalizedValue) {
    return 'Place';
  }

  return normalizedValue
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getRouteNearbyPlaceDedupeKey(place: RouteNearbyPlace): string {
  const titleKey = normalizeRouteNearbyDedupeText(place.title);
  const addressKey = normalizeRouteNearbyDedupeText(place.address || place.subtitle);
  if (addressKey) {
    return `${titleKey}-${addressKey}`;
  }

  return `${titleKey}-${place.latitude.toFixed(3)}-${place.longitude.toFixed(3)}`;
}

export function dedupeRouteNearbyPlaces(places: RouteNearbyPlace[], limit = ROUTE_NEARBY_RESULT_LIMIT): RouteNearbyPlace[] {
  const seenKeys = new Set<string>();
  const dedupedPlaces: RouteNearbyPlace[] = [];

  places.forEach((place) => {
    const key = getRouteNearbyPlaceDedupeKey(place);
    if (seenKeys.has(key)) {
      return;
    }

    seenKeys.add(key);
    dedupedPlaces.push(place);
  });

  return dedupedPlaces.slice(0, limit);
}

export function getFuelTypeLabel(value: string | undefined): string {
  const normalizedValue = normalizeTripFuelType(value);
  return routeNearbyFuelFilters.find((filter) => filter.id === normalizedValue)?.label ?? 'Regular';
}

export function normalizeFuelTypeText(value: string | undefined): string {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

export function isRegularFuelType(value: string | undefined): boolean {
  const normalizedValue = normalizeFuelTypeText(value);
  if (!normalizedValue || /premium|midgrade|diesel|electric|ev|all/.test(normalizedValue)) {
    return false;
  }

  return /\b(regular|unleaded|sp91|sp92|e10)\b/.test(normalizedValue);
}

export function isDieselFuelType(value: string | undefined): boolean {
  return /\bdiesel\b/i.test(value ?? '');
}

export function isMidgradeFuelType(value: string | undefined): boolean {
  const normalizedValue = normalizeFuelTypeText(value);
  if (!normalizedValue || /premium|diesel|electric|ev/.test(normalizedValue)) {
    return false;
  }

  return /\b(midgrade|plus|sp93)\b/.test(normalizedValue);
}

export function isPremiumFuelType(value: string | undefined): boolean {
  return /\b(premium|super|supreme|sp95|sp98)\b/i.test(value ?? '');
}

export function isEvFuelType(value: string | undefined): boolean {
  return /\b(ev|electric|charging|charger|supercharger)\b/i.test(value ?? '');
}

export function isFuelTypeForFilter(value: string | undefined, filterId: RouteNearbyFuelFilterId): boolean {
  if (filterId === 'regular') {
    return isRegularFuelType(value);
  }

  if (filterId === 'midgrade') {
    return isMidgradeFuelType(value);
  }

  if (filterId === 'premium') {
    return isPremiumFuelType(value);
  }

  if (filterId === 'diesel') {
    return isDieselFuelType(value);
  }

  return isEvFuelType(value);
}

export function formatFuelPriceValue(price: number | undefined, currency = 'USD'): string | undefined {
  if (!Number.isFinite(Number(price)) || Number(price) <= 0) {
    return undefined;
  }

  const unitLabel = currency.toUpperCase() === 'USD' ? '/gal' : '/unit';
  try {
    const formattedPrice = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(price));
    return `${formattedPrice}${unitLabel}`;
  } catch {
    return `${Number(price).toFixed(2)} ${currency}${unitLabel}`;
  }
}

export function formatFuelUpdatedAt(value: string | undefined): string {
  if (!value) {
    return '';
  }

  const updatedAt = new Date(value);
  if (Number.isNaN(updatedAt.getTime())) {
    return '';
  }

  return `Updated ${updatedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export function isRouteNearbyStreetLevelAddress(value: string | undefined): boolean {
  const cleanedValue = cleanRouteNearbyLocationText(value);
  return /\d/.test(cleanedValue) && /\b(road|rd|street|st|avenue|ave|highway|hwy|drive|dr|lane|ln|boulevard|blvd|parkway|pkwy|way|court|ct|circle|cir|trail|trl|route|rte|fm)\b/i.test(cleanedValue);
}

function createRouteNearbyRadiusHelpers(context: ItineraryRouteNearbyHelperContext) {
  function clampRouteNearbyCustomRadiusMiles(value: number): number {
    return clampRouteNearbyCustomRadiusMilesValue(value);
  }

  function parseRouteNearbyCustomRadiusMiles(value = context.getRouteNearbyCustomRadiusMiles()): number {
    const trimmedValue = String(value).trim();
    return clampRouteNearbyCustomRadiusMiles(trimmedValue ? Number(trimmedValue) : ROUTE_NEARBY_CUSTOM_RADIUS_DEFAULT_MI);
  }

  function formatRouteNearbyRadiusMiles(miles: number): string {
    return formatRouteNearbyRadiusMilesValue(miles);
  }

  function normalizeRouteNearbyCustomRadiusValue(): string {
    const customMiles = parseRouteNearbyCustomRadiusMiles();
    return customMiles.toLocaleString('en-US', {
      maximumFractionDigits: customMiles < 10 ? 1 : 0,
      useGrouping: false,
    });
  }

  function getRouteNearbyCustomRadiusOption(): RouteNearbyRadiusOption {
    const customMiles = parseRouteNearbyCustomRadiusMiles();
    return {
      id: ROUTE_NEARBY_CUSTOM_RADIUS_ID,
      label: formatRouteNearbyRadiusMiles(customMiles),
      radiusKm: Number((customMiles * KILOMETERS_PER_MILE).toFixed(2)),
    };
  }

  function getSelectedRouteNearbyRadiusOption(radiusId = context.getSelectedRouteNearbyRadiusId()): RouteNearbyRadiusOption {
    if (radiusId === ROUTE_NEARBY_CUSTOM_RADIUS_ID) {
      return getRouteNearbyCustomRadiusOption();
    }

    return routeNearbyRadiusOptions.find((option) => option.id === radiusId) ?? defaultRouteNearbyRadiusOption;
  }

  function getRouteNearbyRadiusTitle(radiusOption: RouteNearbyRadiusOption): string {
    const anchor = context.getSelectedRouteNearbyAnchor();
    return anchor
      ? `Search within ${radiusOption.label} of ${anchor.placeLabel}`
      : `Search within ${radiusOption.label}`;
  }

  function getSelectedRouteNearbyRadiusKm(): number {
    return getSelectedRouteNearbyRadiusOption().radiusKm;
  }

  return {
    clampRouteNearbyCustomRadiusMiles,
    parseRouteNearbyCustomRadiusMiles,
    formatRouteNearbyRadiusMiles,
    normalizeRouteNearbyCustomRadiusValue,
    getRouteNearbyCustomRadiusOption,
    getSelectedRouteNearbyRadiusOption,
    getRouteNearbyRadiusTitle,
    getSelectedRouteNearbyRadiusKm,
  };
}

function createRouteNearbyPlaceHelpers(
  context: ItineraryRouteNearbyHelperContext,
  {
    getSelectedRouteNearbyRadiusKm,
  }: Pick<ReturnType<typeof createRouteNearbyRadiusHelpers>, 'getSelectedRouteNearbyRadiusKm'>,
) {
  function getRouteNearbyPhotoCategory(place: RouteNearbyPlace): SpotCategory {
    const cardCategory = getRouteNearbyCardCategory(place);
    if (cardCategory === 'stay') {
      return 'scenic';
    }

    if (cardCategory === 'essentials' || cardCategory === 'fuel' || cardCategory === 'ev') {
      return 'shopping';
    }

    if (place.category && place.category !== 'other') {
      return place.category;
    }

    const searchableCategory = [
      place.title,
      place.subtitle,
      place.address,
      place.sourceLabel,
    ].filter(Boolean).join(' ').toLowerCase();
    return normalizeRouteNearbyCategory(searchableCategory, 'scenic');
  }

  function getRouteNearbyCardCategory(place: RouteNearbyPlace): string {
    if (place.kind === 'fuel') {
      return normalizeTripFuelType(place.fuelType) === 'ev' || context.getSelectedRouteNearbyFuelFilterId() === 'ev'
        ? 'ev'
        : 'fuel';
    }

    const rawCategory = String(place.travelCategory || place.category || place.kind || '').toLowerCase();
    if (/(stay|hotel|motel|lodging|campground|rv|hostel|resort|inn)/.test(rawCategory)) {
      return 'stay';
    }

    if (/(essential|rest_stop|parking|pharmacy|grocery|supermarket|repair|convenience)/.test(rawCategory)) {
      return 'essentials';
    }

    if (/(food|coffee|restaurant|cafe|bakery)/.test(rawCategory)) {
      return 'food';
    }

    if (/(nature|outdoor|park|trail)/.test(rawCategory)) {
      return 'nature';
    }

    if (/(scenic|view|landmark)/.test(rawCategory)) {
      return 'scenic';
    }

    if (/(culture|museum|gallery|historic|art)/.test(rawCategory)) {
      return 'culture';
    }

    if (/(shopping|shop|market|store|mall)/.test(rawCategory)) {
      return 'shopping';
    }

    if (/(nightlife|night|bar|music|club)/.test(rawCategory)) {
      return 'nightlife';
    }

    if (/(adventure|camp|hike|climb|bike|kayak)/.test(rawCategory)) {
      return 'adventure';
    }

    return place.category === 'other' ? 'place' : place.category;
  }

  function getRouteNearbyPhotoUrl(place: RouteNearbyPlace): string {
    if (place.photoUrl?.trim()) {
      return resolveSpotPhotoUrl(getRouteNearbyPhotoCategory(place), place.photoUrl, ROUTE_NEARBY_PHOTO_WIDTH);
    }

    return '';
  }

  function getRouteNearbyIcon(place: RouteNearbyPlace): string {
    if (place.iconName) {
      return place.iconName;
    }

    if (place.kind === 'fuel') {
      return 'fuel';
    }

    return place.category === 'other' ? 'pin' : place.category;
  }

  function getRouteNearbySourceLabel(place: RouteNearbyPlace): string {
    if (place.source === 'fuel') {
      return 'Fuel';
    }

    if (place.source === 'discovery') {
      return 'Map place';
    }

    if (place.source === 'google') {
      return 'Google';
    }

    return 'Scope';
  }

  function getRouteNearbyDistanceValue(place: RouteNearbyPlace): string {
    return formatRouteNearbyDistance(getRouteNearbyPlaceDistanceKm(place) ?? undefined);
  }

  function getRouteNearbyCategoryLabel(place: RouteNearbyPlace): string {
    if (place.kind === 'fuel') {
      if (context.getSelectedRouteNearbyFuelFilterId() === 'ev') {
        return 'EV';
      }

      return place.fuelType && isFuelTypeForFilter(place.fuelType, context.getSelectedRouteNearbyFuelFilterId())
        ? getFuelTypeLabel(place.fuelType)
        : 'Fuel';
    }

    const category = place.travelCategory && place.travelCategory !== 'recommended'
      ? place.travelCategory
      : place.category;
    return formatTravelCategoryLabel(category || 'place');
  }

  function formatRouteNearbyResultLocation(place: RouteNearbyPlace): string {
    const address = cleanRouteNearbyLocationText(place.address);
    if (address) {
      return address;
    }

    const subtitle = stripRouteNearbyLocationPrefix(place.subtitle);
    if (subtitle) {
      return subtitle;
    }

    return place.kind === 'fuel' ? 'Fuel stop' : 'Near this route';
  }

  function calculateDistanceKm(
    start: Pick<RouteNearbyAnchor, 'latitude' | 'longitude'>,
    end: Pick<RouteNearbyPlace, 'latitude' | 'longitude'>,
  ): number {
    return calculateHaversineDistanceKm(start, end);
  }

  function getRouteNearbyValidationText(place: RouteNearbyPlace): string {
    return [
      place.title,
      place.subtitle,
      place.address,
      place.category,
      place.sourceLabel,
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function hasRouteNearbyTextSignal(place: RouteNearbyPlace, pattern: RegExp): boolean {
    return pattern.test(getRouteNearbyValidationText(place));
  }

  function isRouteNearbyFoodPlace(place: RouteNearbyPlace): boolean {
    if (hasRouteNearbyTextSignal(place, /\b(weigh station|truck scale|inspection station|port of entry|highway patrol|state trooper|sheriff|police|department of transportation|\bdot\b|dmv|courthouse|jail|prison)\b/i)) {
      return false;
    }

    if (place.category === 'food') {
      return true;
    }

    return hasRouteNearbyTextSignal(place, /\b(restaurant|cafe|coffee|bakery|bistro|grill|diner|pizza|burger|taco|bbq|barbecue|kitchen|steak|seafood|sushi|ramen|noodle|breakfast|brunch|ice cream|donut|doughnut|brewery|winery|mcdonald'?s|starbucks|subway|sonic|dairy queen|whataburger|taco bell|kfc|wendy'?s|burger king|chick-fil-a|chipotle|panera|domino'?s|pizza hut|popeyes|arby'?s|ihop|denny'?s|waffle house)\b/i);
  }

  function isRouteNearbyStayPlace(place: RouteNearbyPlace): boolean {
    if (hasRouteNearbyTextSignal(place, /\b(weigh station|truck scale|gas station|fuel|restaurant|cafe|pharmacy|supermarket|police|sheriff|courthouse)\b/i)) {
      return false;
    }

    return (
      (place.category as string) === 'stay' ||
      (place.source !== 'discovery' && place.travelCategory === 'stay') ||
      hasRouteNearbyTextSignal(place, /\b(hotel|motel|lodging|inn|suites|resort|hostel|campground|rv park|bed and breakfast|bnb|lodge|cabin)\b/i)
    );
  }

  function isRouteNearbyEssentialsPlace(place: RouteNearbyPlace): boolean {
    if (hasRouteNearbyTextSignal(place, /\b(weigh station|truck scale|inspection station|port of entry|tourist attraction|museum|gallery|nightclub)\b/i)) {
      return false;
    }

    return (
      (place.category as string) === 'essentials' ||
      (place.source !== 'discovery' && place.travelCategory === 'essentials') ||
      hasRouteNearbyTextSignal(place, /\b(rest stop|rest area|convenience store|supermarket|grocery|pharmacy|parking|car repair|auto repair|urgent care|hospital|bank|atm|market|travel center)\b/i)
    );
  }

  function isRouteNearbyScenicPlace(place: RouteNearbyPlace): boolean {
    if (hasRouteNearbyTextSignal(place, /\b(weigh station|truck scale|gas station|fuel|convenience store|supermarket|pharmacy|parking lot|police|sheriff)\b/i)) {
      return false;
    }

    return (
      place.category === 'scenic' ||
      place.category === 'nature' ||
      place.category === 'culture' ||
      place.category === 'adventure' ||
      (place.source !== 'discovery' && place.travelCategory === 'scenic') ||
      hasRouteNearbyTextSignal(place, /\b(scenic|view|overlook|lookout|vista|park|trail|lake|river|garden|museum|gallery|historic|landmark|monument|tourist attraction|nature|wildlife)\b/i)
    );
  }

  function isRouteNearbyEntertainmentPlace(place: RouteNearbyPlace): boolean {
    if (hasRouteNearbyTextSignal(place, /\b(weigh station|truck scale|gas station|fuel|convenience store|supermarket|pharmacy|parking lot|police|sheriff|courthouse|hospital|clinic)\b/i)) {
      return false;
    }

    return (
      place.category === 'entertainment' ||
      (place.source !== 'discovery' && place.travelCategory === 'entertainment') ||
      hasRouteNearbyTextSignal(place, /\b(entertainment|amusement park|theme park|six flags|bowling|bowling alley|arcade|movie theater|movie theatre|cinema|concert|music venue|stadium|arena|zoo|aquarium|escape room|laser tag|mini golf|carnival|fair)\b/i)
    );
  }

  function isRouteNearbyPlaceValidForSelectedCategory(place: RouteNearbyPlace): boolean {
    if (place.kind === 'fuel') {
      return true;
    }

    const activeCategory = context.getSelectedRouteNearbyTabId() === 'recommended'
      ? context.getSelectedRouteNearbyQueryId()
      : context.getSelectedRouteNearbyTabId();

    if (activeCategory === 'food' || activeCategory === 'coffee') {
      return isRouteNearbyFoodPlace(place);
    }

    if (activeCategory === 'stay') {
      return isRouteNearbyStayPlace(place);
    }

    if (activeCategory === 'essentials') {
      return isRouteNearbyEssentialsPlace(place);
    }

    if (activeCategory === 'scenic' || activeCategory === 'nature' || activeCategory === 'culture') {
      return isRouteNearbyScenicPlace(place);
    }

    if (activeCategory === 'shopping') {
      return hasRouteNearbyTextSignal(place, /\b(shop|shopping|store|market|mall|boutique|outlet)\b/i);
    }

    if (activeCategory === 'entertainment') {
      return isRouteNearbyEntertainmentPlace(place);
    }

    if (activeCategory === 'nightlife') {
      return hasRouteNearbyTextSignal(place, /\b(bar|nightlife|music|club|lounge|brewery|pub)\b/i);
    }

    return !hasRouteNearbyTextSignal(place, /\b(weigh station|truck scale|inspection station|port of entry)\b/i);
  }

  function getRouteNearbyPlaceDistanceKm(place: RouteNearbyPlace): number | null {
    if (Number.isFinite(place.distanceKm)) {
      return Number(place.distanceKm);
    }

    const anchor = context.getSelectedRouteNearbyAnchor();
    if (!anchor || !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) {
      return null;
    }

    return calculateDistanceKm(anchor, place);
  }

  function isWithinSelectedRouteNearbyRadius(place: RouteNearbyPlace): boolean {
    const distanceKm = getRouteNearbyPlaceDistanceKm(place);
    if (!Number.isFinite(distanceKm)) {
      return false;
    }

    return Number(distanceKm) <= getSelectedRouteNearbyRadiusKm() + 0.05;
  }

  function filterRouteNearbyPlacesWithinSelectedRadius(places: RouteNearbyPlace[]): RouteNearbyPlace[] {
    return places
      .filter(isWithinSelectedRouteNearbyRadius)
      .filter(isRouteNearbyPlaceValidForSelectedCategory);
  }

  return {
    getRouteNearbyPhotoCategory,
    getRouteNearbyCardCategory,
    getRouteNearbyPhotoUrl,
    getRouteNearbyIcon,
    getRouteNearbySourceLabel,
    getRouteNearbyDistanceValue,
    getRouteNearbyCategoryLabel,
    formatRouteNearbyResultLocation,
    calculateDistanceKm,
    getRouteNearbyValidationText,
    hasRouteNearbyTextSignal,
    isRouteNearbyFoodPlace,
    isRouteNearbyStayPlace,
    isRouteNearbyEssentialsPlace,
    isRouteNearbyScenicPlace,
    isRouteNearbyEntertainmentPlace,
    isRouteNearbyPlaceValidForSelectedCategory,
    getRouteNearbyPlaceDistanceKm,
    isWithinSelectedRouteNearbyRadius,
    filterRouteNearbyPlacesWithinSelectedRadius,
  };
}

function createRouteNearbySearchAndFuelHelpers(
  context: ItineraryRouteNearbyHelperContext,
  {
    getSelectedRouteNearbyRadiusKm,
  }: Pick<ReturnType<typeof createRouteNearbyRadiusHelpers>, 'getSelectedRouteNearbyRadiusKm'>,
  {
    isWithinSelectedRouteNearbyRadius,
  }: Pick<ReturnType<typeof createRouteNearbyPlaceHelpers>, 'isWithinSelectedRouteNearbyRadius'>,
) {
  function hasLiveFuelPrice(place: RouteNearbyPlace): boolean {
    return (
      place.kind === 'fuel' &&
      context.getSelectedRouteNearbyFuelFilterId() !== 'ev' &&
      place.source === 'fuel' &&
      isFuelTypeForFilter(place.fuelType, context.getSelectedRouteNearbyFuelFilterId()) &&
      Number.isFinite(place.priceValue) &&
      Number(place.priceValue) > 0
    );
  }

  function matchesRouteNearbyFuelSearch(place: RouteNearbyPlace): boolean {
    const query = context.getRouteNearbyFuelSearchQuery().trim().toLowerCase();
    if (!query) {
      return true;
    }

    const haystack = [
      place.title,
      place.subtitle,
      place.address,
      place.fuelType,
      place.priceLabel,
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(query);
  }

  function compareRouteNearbyFuelPlaces(left: RouteNearbyPlace, right: RouteNearbyPlace): number {
    const leftHasPrice = hasLiveFuelPrice(left);
    const rightHasPrice = hasLiveFuelPrice(right);

    if (context.getSelectedRouteNearbyFuelSortMode() === 'best-price') {
      if (leftHasPrice !== rightHasPrice) {
        return leftHasPrice ? -1 : 1;
      }

      if (leftHasPrice && rightHasPrice && left.priceValue !== right.priceValue) {
        return Number(left.priceValue) - Number(right.priceValue);
      }
    }

    const distanceDelta = (left.distanceKm ?? Number.MAX_SAFE_INTEGER) - (right.distanceKm ?? Number.MAX_SAFE_INTEGER);
    if (Math.abs(distanceDelta) > 0.001) {
      return distanceDelta;
    }

    if (leftHasPrice !== rightHasPrice) {
      return leftHasPrice ? -1 : 1;
    }

    return (left.priceValue ?? Number.MAX_SAFE_INTEGER) - (right.priceValue ?? Number.MAX_SAFE_INTEGER);
  }

  function filterAndSortRouteNearbyFuelPlaces(places: RouteNearbyPlace[]): RouteNearbyPlace[] {
    const matchingPlaces = places
      .filter(isWithinSelectedRouteNearbyRadius)
      .filter(matchesRouteNearbyFuelSearch);
    const hasAnyLivePrice = matchingPlaces.some(hasLiveFuelPrice);
    const visiblePlaces = hasAnyLivePrice
      ? matchingPlaces.filter(hasLiveFuelPrice)
      : matchingPlaces;

    return [...visiblePlaces].sort(compareRouteNearbyFuelPlaces);
  }

  function buildRouteNearbySearchQuery(): string {
    if (context.getSelectedRouteNearbyQueryId() === 'custom') {
      return context.getRouteNearbyCustomQuery().trim() || 'places';
    }

    if (context.getSelectedRouteNearbyQueryId() !== 'recommended') {
      return context.getSelectedRouteNearbyQuery().query;
    }

    const interests = context.getRouteNearbyInterests();
    if (interests.length) {
      return `${interests.slice(0, 2).join(' ')} places`;
    }

    return context.getSelectedRouteNearbyQuery().query;
  }

  function getRouteNearbyInterestSet(): Set<SpotCategory> {
    const interests = context.getRouteNearbyInterests();
    return new Set(interests.filter((interest): interest is SpotCategory => Boolean(interest)));
  }

  function buildRouteNearbyBounds(anchor: RouteNearbyAnchor): NearbyPlaceBounds {
    const radiusKm = getSelectedRouteNearbyRadiusKm();
    const latitudeDelta = radiusKm / 111.32;
    const longitudeScale = Math.max(Math.cos((anchor.latitude * Math.PI) / 180), 0.2);
    const longitudeDelta = radiusKm / (111.32 * longitudeScale);

    return {
      west: clampNumber(anchor.longitude - longitudeDelta, -180, 180),
      south: clampNumber(anchor.latitude - latitudeDelta, -90, 90),
      east: clampNumber(anchor.longitude + longitudeDelta, -180, 180),
      north: clampNumber(anchor.latitude + latitudeDelta, -90, 90),
    };
  }

  function getRouteNearbyPlaceCategories(query: RouteNearbyQuery): readonly string[] {
    if (query.id === 'recommended') {
      const interests = getRouteNearbyInterestSet();
      if (!interests.size) {
        return query.placeCategories ?? [];
      }

      const categories = new Set<string>();
      if (interests.has('food')) {
        categories.add('restaurant');
        categories.add('cafe');
      }
      if (interests.has('nature') || interests.has('adventure')) {
        categories.add('park');
      }
      if (interests.has('culture') || interests.has('scenic')) {
        categories.add('tourist_attraction');
        categories.add('museum');
      }
      if (interests.has('shopping')) {
        categories.add('shopping');
      }
      if (interests.has('entertainment')) {
        categories.add('amusement_park');
        categories.add('bowling_alley');
        categories.add('movie_theater');
        categories.add('tourist_attraction');
      }
      if (interests.has('nightlife')) {
        categories.add('bar');
      }

      return categories.size ? [...categories] : query.placeCategories ?? [];
    }

    return query.placeCategories ?? [];
  }

  function getRouteNearbyFuelApiType(): RouteNearbyFuelApiType {
    return routeNearbyFuelFilters.find((filter) => filter.id === context.getSelectedRouteNearbyFuelFilterId())?.apiFuelType ?? 'regular';
  }

  function getRouteNearbyFuelApiSortMode(): 'closest' | 'best_price' {
    return context.getSelectedRouteNearbyFuelSortMode() === 'best-price' ? 'best_price' : 'closest';
  }

  function isRouteNearbyRadiusBeyondProviderLimit(): boolean {
    return getSelectedRouteNearbyRadiusKm() > ROUTE_NEARBY_PROVIDER_RADIUS_LIMIT_KM;
  }

  function getSelectedFuelStationPrice(
    station: FuelStationPrice,
  ): { price: number; currency: string; fuelType: string; updatedAt?: string } | null {
    const filterId = context.getSelectedRouteNearbyFuelFilterId();
    if (filterId === 'ev') {
      return null;
    }

    const exactPrices = Array.isArray(station.prices)
      ? station.prices
        .filter((price) => (
          isFuelTypeForFilter(price.fuelType, filterId) &&
          Number.isFinite(Number(price.price)) &&
          Number(price.price) > 0
        ))
        .map((price) => ({
          price: Number(price.price),
          currency: price.currency || station.currency || 'USD',
          fuelType: price.fuelType,
          updatedAt: price.updatedAt ?? station.updatedAt,
        }))
      : [];

    if (exactPrices.length) {
      return exactPrices.sort((left, right) => left.price - right.price)[0] ?? null;
    }

    if (
      isFuelTypeForFilter(station.fuelType, filterId) &&
      Number.isFinite(Number(station.pricePerUnit)) &&
      Number(station.pricePerUnit) > 0
    ) {
      return {
        price: Number(station.pricePerUnit),
        currency: station.currency || 'USD',
        fuelType: station.fuelType,
        updatedAt: station.updatedAt,
      };
    }

    return null;
  }

  function isStrictFuelPlaceResult(place: PlaceSearchResult, filterId = context.getSelectedRouteNearbyFuelFilterId()): boolean {
    const haystack = [
      place.placeName,
      place.formattedAddress,
      place.address,
      place.category,
      place.precision,
    ].filter(Boolean).join(' ').toLowerCase();

    if (filterId === 'ev') {
      return /\b(ev|electric|charging|charger|supercharger|chargepoint|electrify|tesla)\b/i.test(haystack);
    }

    const hasFuelCategory = /(gas[_\s-]?station|fuel|petrol|service station|filling station|convenience store)/i.test(haystack);
    const hasKnownStationName = /\b(shell|exxon|mobil|chevron|texaco|valero|sunoco|bp|citgo|phillips|conoco|circle k|quiktrip|qt|racetrac|raceway|marathon|murphy|walmart fuel|sam'?s club|7-eleven|speedway)\b/i.test(haystack);
    return hasFuelCategory || hasKnownStationName;
  }

  function shouldIncludeFuelStation(station: FuelStationPrice): boolean {
    const filterId = context.getSelectedRouteNearbyFuelFilterId();
    if (filterId === 'ev') {
      return false;
    }

    return Boolean(getSelectedFuelStationPrice(station)) || isFuelTypeForFilter(station.fuelType, filterId);
  }

  return {
    hasLiveFuelPrice,
    matchesRouteNearbyFuelSearch,
    compareRouteNearbyFuelPlaces,
    filterAndSortRouteNearbyFuelPlaces,
    buildRouteNearbySearchQuery,
    getRouteNearbyInterestSet,
    buildRouteNearbyBounds,
    getRouteNearbyPlaceCategories,
    getRouteNearbyFuelApiType,
    getRouteNearbyFuelApiSortMode,
    isRouteNearbyRadiusBeyondProviderLimit,
    getSelectedFuelStationPrice,
    isStrictFuelPlaceResult,
    shouldIncludeFuelStation,
  };
}

function createRouteNearbyPlaceBuilderHelpers(
  context: ItineraryRouteNearbyHelperContext,
  {
    getSelectedRouteNearbyRadiusKm,
  }: Pick<ReturnType<typeof createRouteNearbyRadiusHelpers>, 'getSelectedRouteNearbyRadiusKm'>,
  {
    calculateDistanceKm,
  }: Pick<ReturnType<typeof createRouteNearbyPlaceHelpers>, 'calculateDistanceKm'>,
  {
    getRouteNearbyInterestSet,
    getSelectedFuelStationPrice,
  }: Pick<
    ReturnType<typeof createRouteNearbySearchAndFuelHelpers>,
    'getRouteNearbyInterestSet' | 'getSelectedFuelStationPrice'
  >,
) {
  function calculateRouteNearbyRecommendationScore(
    input: {
      category: SpotCategory;
      source: RouteNearbyPlace['source'];
      distanceKm?: number;
      rating?: number;
      likesCount?: number;
      createdAt?: string;
    },
  ): number {
    const interests = getRouteNearbyInterestSet();
    const selectedCategory = context.getSelectedRouteNearbyQuery().category;
    const isRecommendedMode = context.getSelectedRouteNearbyQueryId() === 'recommended';
    const hasInterestSignal = interests.size > 0;
    const matchesSelectedCategory = Boolean(selectedCategory && input.category === selectedCategory);
    const matchesInterest = interests.has(input.category);
    const isBroadlyRecommendable = routeNearbyRecommendedCategories.has(input.category);
    const categoryBoost = matchesSelectedCategory ? 34 : selectedCategory ? -18 : 0;
    const interestBoost = matchesInterest
      ? 32
      : isRecommendedMode && hasInterestSignal
        ? -10
        : isBroadlyRecommendable
          ? 8
          : -8;
    const sourceConfidenceBoost = input.source === 'scope' ? 18 : input.source === 'discovery' ? 6 : 0;
    const ratingBoost = Number.isFinite(input.rating)
      ? Math.max(0, Number(input.rating) - 3.2) * 12
      : 0;
    const popularityBoost = Math.min(18, Math.log1p(Math.max(0, input.likesCount ?? 0)) * 4.5);
    const trendBoost = input.createdAt
      ? Math.min(22, getSpotTrendingScore({
          id: 'score',
          title: 'score',
          latitude: 0,
          longitude: 0,
          category: input.category,
          rating: input.rating ?? 0,
          likesCount: input.likesCount,
          createdAt: input.createdAt,
        }))
      : 0;
    const radiusKm = Math.max(1, getSelectedRouteNearbyRadiusKm());
    const distanceKm = Number.isFinite(input.distanceKm) ? Number(input.distanceKm) : radiusKm;
    const distanceBoost = Math.max(0, 24 * (1 - Math.min(distanceKm, radiusKm) / radiusKm));
    const lowPrecisionPenalty = isRecommendedMode && input.category === 'other' ? 12 : 0;

    return Math.max(
      0,
      categoryBoost +
        interestBoost +
        sourceConfidenceBoost +
        ratingBoost +
        popularityBoost +
        trendBoost +
        distanceBoost -
        lowPrecisionPenalty,
    );
  }

  function isStrongRouteNearbyRecommendation(score: number, category: SpotCategory): boolean {
    if (context.getSelectedRouteNearbyQueryId() !== 'recommended') {
      return false;
    }

    if (!routeNearbyRecommendedCategories.has(category)) {
      return false;
    }

    return score >= ROUTE_NEARBY_RECOMMENDATION_MIN_SCORE;
  }

  function buildRouteNearbyRecommendationReason(place: Pick<RouteNearbyPlace, 'source' | 'category' | 'distanceKm' | 'rating'>): string {
    if (place.source === 'scope') {
      const ratingCopy = Number.isFinite(place.rating) ? `${Number(place.rating).toFixed(1)} rating` : 'community signal';
      return `Public Scope pin with ${ratingCopy}`;
    }

    const distanceCopy = formatRouteNearbyDistance(place.distanceKm);
    return `Nearby ${place.category} pick${distanceCopy ? ` within ${distanceCopy}` : ''}`;
  }

  function buildScopeNearbyPlace(spot: SpotSummary, anchor: RouteNearbyAnchor): RouteNearbyPlace {
    const distanceKm = calculateDistanceKm(anchor, spot);
    const recommendationScore = calculateRouteNearbyRecommendationScore({
      category: spot.category,
      source: 'scope',
      distanceKm,
      rating: spot.rating,
      likesCount: spot.likesCount,
      createdAt: spot.createdAt,
    });
    const isRecommended = isStrongRouteNearbyRecommendation(recommendationScore, spot.category);
    return {
      id: `scope-${spot.id}`,
      title: spot.title,
      subtitle: spot.city || 'Location syncing',
      latitude: spot.latitude,
      longitude: spot.longitude,
      category: spot.category,
      source: 'scope',
      kind: context.getSelectedRouteNearbyTabId() === 'fuel' ? 'recommended' : context.getSelectedRouteNearbyTabId(),
      travelCategory: spot.category,
      anchorId: anchor.id,
      distanceKm,
      rating: spot.rating,
      photoUrl: spot.photoUrl?.trim()
        ? resolveSpotPhotoUrl(spot.category, spot.photoUrl, ROUTE_NEARBY_PHOTO_WIDTH)
        : undefined,
      iconName: spot.category === 'other' ? 'pin' : spot.category,
      sourceLabel: isRecommended ? 'Scope AI' : 'Scope',
      recommendationScore,
      recommendationReason: buildRouteNearbyRecommendationReason({
        source: 'scope',
        category: spot.category,
        distanceKm,
        rating: spot.rating,
      }),
      isRecommended,
    };
  }

  function buildDiscoveryNearbyPlace(place: PlaceSearchResult, anchor: RouteNearbyAnchor, options: { kind?: RouteNearbyTabId } = {}): RouteNearbyPlace {
    const isFuel = options.kind === 'fuel';
    const isEvFuelFilter = isFuel && context.getSelectedRouteNearbyFuelFilterId() === 'ev';
    const category = isFuel
      ? 'other'
      : normalizeRouteNearbyCategory(place.category, 'other');
    const distanceKm = Number.isFinite(place.distanceKm)
      ? Number(place.distanceKm)
      : calculateDistanceKm(anchor, { latitude: place.latitude, longitude: place.longitude });
    const recommendationScore = calculateRouteNearbyRecommendationScore({
      category,
      source: 'discovery',
      distanceKm,
    });
    const isRecommended = !isFuel && isStrongRouteNearbyRecommendation(recommendationScore, category);
    const address = cleanRouteNearbyLocationText(place.formattedAddress || place.address);

    return {
      id: `${isFuel ? 'scope-fuel-place' : 'scope-place'}-${place.id || `${place.placeName}-${place.latitude}-${place.longitude}`}`,
      title: place.placeName,
      subtitle: address || place.city || (isFuel ? 'Fuel stop' : 'Map place'),
      latitude: place.latitude,
      longitude: place.longitude,
      category,
      source: 'discovery',
      kind: isFuel ? 'fuel' : context.getSelectedRouteNearbyTabId(),
      travelCategory: isFuel ? 'fuel' : context.getSelectedRouteNearbyTabId(),
      anchorId: anchor.id,
      distanceKm,
      iconName: isFuel ? 'fuel' : category === 'other' ? 'pin' : category,
      address,
      photoUrl: place.photoUrl,
      photoAttribution: place.photoAttribution,
      photoAttributionUrl: place.photoAttributionUrl,
      sourceLabel: isFuel ? (isEvFuelFilter ? 'EV stop' : 'Fuel stop') : place.source === 'mapbox' ? 'Map place' : 'Discovery',
      fuelType: isEvFuelFilter ? 'ev' : undefined,
      recommendationScore,
      recommendationReason: buildRouteNearbyRecommendationReason({
        source: 'discovery',
        category,
        distanceKm,
      }),
      isRecommended,
    };
  }

  function buildFuelNearbyPlace(station: FuelStationPrice, anchor: RouteNearbyAnchor): RouteNearbyPlace | null {
    if (!isFiniteCoordinate(station.latitude) || !isFiniteCoordinate(station.longitude)) {
      return null;
    }

    const latitude = Number(station.latitude);
    const longitude = Number(station.longitude);
    const distanceKm = Number.isFinite(station.distanceKm)
      ? Number(station.distanceKm)
      : calculateDistanceKm(anchor, { latitude, longitude });
    const selectedPrice = getSelectedFuelStationPrice(station);
    const fuelType = selectedPrice?.fuelType ?? station.fuelType;
    const fuelTypeLabel = getFuelTypeLabel(fuelType);
    const updatedLabel = formatFuelUpdatedAt(selectedPrice?.updatedAt ?? station.updatedAt);
    const sourceLabel = updatedLabel || (station.source === 'Google Places' ? 'Google' : station.source || 'Fuel');

    return {
      id: `fuel-${station.id}`,
      title: station.name,
      subtitle: cleanRouteNearbyLocationText(station.address) || station.brand || `${fuelTypeLabel} fuel stop`,
      latitude,
      longitude,
      category: 'other',
      source: 'fuel',
      kind: 'fuel',
      travelCategory: 'fuel',
      anchorId: anchor.id,
      distanceKm,
      iconName: 'fuel',
      address: cleanRouteNearbyLocationText(station.address),
      sourceLabel,
      priceLabel: formatFuelPriceValue(selectedPrice?.price, selectedPrice?.currency),
      priceValue: selectedPrice?.price,
      fuelType,
    };
  }

  function buildTravelNearbyPlace(suggestion: TravelNearbySuggestion): RouteNearbyPlace | null {
    if (!isFiniteCoordinate(suggestion.latitude) || !isFiniteCoordinate(suggestion.longitude)) {
      return null;
    }

    const travelCategory = suggestion.category || context.getSelectedRouteNearbyTabId();
    const isFuel = travelCategory === 'fuel' || context.getSelectedRouteNearbyTabId() === 'fuel';
    const category = isFuel
      ? 'other'
      : normalizeTravelSuggestionCategory(travelCategory, context.getSelectedRouteNearbyQuery().category ?? 'other');
    const isEvFuelFilter = isFuel && context.getSelectedRouteNearbyFuelFilterId() === 'ev';
    const hasExactFuelPrice = (
      isFuel &&
      !isEvFuelFilter &&
      suggestion.source === 'google' &&
      suggestion.sourceLabel === 'Fuel price' &&
      isFuelTypeForFilter(suggestion.fuelType, context.getSelectedRouteNearbyFuelFilterId()) &&
      Number.isFinite(Number(suggestion.priceValue)) &&
      Number(suggestion.priceValue) > 0
    );

    return {
      id: suggestion.id,
      title: suggestion.title,
      subtitle: cleanRouteNearbyLocationText(suggestion.address) || stripRouteNearbyLocationPrefix(suggestion.subtitle || '') || `${formatTravelCategoryLabel(travelCategory)} near the route`,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
      category,
      source: suggestion.source === 'scope' ? 'scope' : 'google',
      kind: isFuel ? 'fuel' : context.getSelectedRouteNearbyTabId(),
      travelCategory,
      anchorId: suggestion.anchorId,
      distanceKm: suggestion.distanceKm,
      rating: suggestion.rating,
      photoUrl: suggestion.photoUrl,
      photoAttribution: suggestion.photoAttribution,
      photoAttributionUrl: suggestion.photoAttributionUrl,
      iconName: isFuel ? 'fuel' : category === 'other' ? 'pin' : category,
      address: cleanRouteNearbyLocationText(suggestion.address),
      sourceLabel: suggestion.sourceLabel ?? (suggestion.source === 'scope' ? 'Scope' : 'Google'),
      priceLabel: isFuel ? (hasExactFuelPrice ? suggestion.priceLabel : undefined) : suggestion.priceLabel,
      priceValue: isFuel && hasExactFuelPrice ? suggestion.priceValue : undefined,
      fuelType: isFuel
        ? isEvFuelFilter
          ? 'ev'
          : hasExactFuelPrice
            ? suggestion.fuelType
            : undefined
        : suggestion.fuelType,
      recommendationReason: suggestion.reason,
      isRecommended: context.getSelectedRouteNearbyTabId() === 'recommended',
    };
  }

  return {
    calculateRouteNearbyRecommendationScore,
    isStrongRouteNearbyRecommendation,
    buildRouteNearbyRecommendationReason,
    buildScopeNearbyPlace,
    buildDiscoveryNearbyPlace,
    buildFuelNearbyPlace,
    buildTravelNearbyPlace,
  };
}

function createRouteNearbyResultHelpers(
  context: ItineraryRouteNearbyHelperContext,
  {
    calculateDistanceKm,
  }: Pick<ReturnType<typeof createRouteNearbyPlaceHelpers>, 'calculateDistanceKm'>,
  {
    hasLiveFuelPrice,
  }: Pick<ReturnType<typeof createRouteNearbySearchAndFuelHelpers>, 'hasLiveFuelPrice'>,
  {
    calculateRouteNearbyRecommendationScore,
  }: Pick<
    ReturnType<typeof createRouteNearbyPlaceBuilderHelpers>,
    'calculateRouteNearbyRecommendationScore'
  >,
) {
  async function enrichRouteNearbyPlace(place: RouteNearbyPlace): Promise<RouteNearbyPlace> {
    if (place.kind === 'fuel') {
      return place;
    }

    const patch: Partial<RouteNearbyPlace> = {};
    let address = cleanRouteNearbyLocationText(place.address);

    if (place.source !== 'scope' && !isRouteNearbyStreetLevelAddress(address)) {
      try {
        const geocoded = await reverseGeocode(place.latitude, place.longitude);
        const geocodedAddress = cleanRouteNearbyLocationText(
          geocoded.formattedAddress || geocoded.address || geocoded.placeName,
        );
        if (isRouteNearbyStreetLevelAddress(geocodedAddress) || (!address && geocodedAddress)) {
          address = geocodedAddress;
          patch.address = geocodedAddress;
          patch.subtitle = geocodedAddress;
        }
      } catch {
        // A photo or address miss should never block nearby stop browsing.
      }
    }

    if (!place.photoUrl?.trim()) {
      try {
        const photoLookup = await getPlacePhoto({
          title: place.title,
          address: address || stripRouteNearbyLocationPrefix(place.subtitle),
          latitude: place.latitude,
          longitude: place.longitude,
          maxWidthPx: ROUTE_NEARBY_PHOTO_WIDTH,
        });
        const photoUrl = photoLookup.photoUrl?.trim();
        if (photoUrl) {
          patch.photoUrl = photoUrl;
          patch.photoAttribution = photoLookup.photoAttribution;
          patch.photoAttributionUrl = photoLookup.photoAttributionUrl;
          patch.sourceLabel = photoLookup.source || place.sourceLabel;
        }
      } catch {
        // Fallback category imagery handles the empty-photo case.
      }
    }

    return Object.keys(patch).length ? { ...place, ...patch } : place;
  }

  async function enrichRouteNearbyPlaces(places: RouteNearbyPlace[]): Promise<RouteNearbyPlace[]> {
    const enrichableLimit = Math.min(places.length, ROUTE_NEARBY_RESULT_LIMIT);
    return Promise.all(
      places.map((place, index) => (index < enrichableLimit ? enrichRouteNearbyPlace(place) : place)),
    );
  }

  function mergeRouteNearbyPlaces(scopePlaces: RouteNearbyPlace[], discoveryPlaces: RouteNearbyPlace[], limit = ROUTE_NEARBY_RESULT_LIMIT): RouteNearbyPlace[] {
    return dedupeRouteNearbyPlaces([...scopePlaces, ...discoveryPlaces], Number.MAX_SAFE_INTEGER)
      .sort((left, right) => {
        if (context.getSelectedRouteNearbyTabId() === 'recommended' && context.getSelectedRouteNearbyQueryId() === 'recommended') {
          const scoreDelta = (right.recommendationScore ?? 0) - (left.recommendationScore ?? 0);
          if (Math.abs(scoreDelta) > 0.001) {
            return scoreDelta;
          }
        }

        if (left.kind !== right.kind) {
          return left.kind === context.getSelectedRouteNearbyTabId() ? -1 : 1;
        }

        if (context.getSelectedRouteNearbyTabId() === 'fuel' && left.kind === 'fuel' && right.kind === 'fuel') {
          const leftHasLivePrice = hasLiveFuelPrice(left);
          const rightHasLivePrice = hasLiveFuelPrice(right);
          if (leftHasLivePrice !== rightHasLivePrice) {
            return leftHasLivePrice ? -1 : 1;
          }
        }

        if (left.source !== right.source) {
          if (left.source === 'scope') return -1;
          if (right.source === 'scope') return 1;
          if (context.getSelectedRouteNearbyTabId() === 'fuel' && left.source === 'fuel') return -1;
          if (context.getSelectedRouteNearbyTabId() === 'fuel' && right.source === 'fuel') return 1;
        }

        return (left.distanceKm ?? Number.MAX_SAFE_INTEGER) - (right.distanceKm ?? Number.MAX_SAFE_INTEGER);
      })
      .slice(0, limit);
  }

  function buildRouteNearbyPlaceFromMapPin(place: MapNearbyPlacePin): RouteNearbyPlace {
    const anchor = context.getSelectedRouteNearbyAnchor();
    const categoryText = [place.category, place.categoryLabel].filter(Boolean).join(' ');
    const fallbackCategory: SpotCategory = /school|college|university|education/i.test(categoryText) ? 'culture' : 'other';
    const category = normalizeRouteNearbyCategory(categoryText, fallbackCategory);
    const distanceKm = anchor ? calculateDistanceKm(anchor, place) : undefined;

    return {
      id: place.id.replace(/^route-nearby-/, ''),
      title: place.title || 'Map place',
      subtitle: cleanRouteNearbyLocationText(place.address) || stripRouteNearbyLocationPrefix(place.subtitle || '') || place.sourceLabel || 'Map place',
      latitude: place.latitude,
      longitude: place.longitude,
      category,
      source: 'discovery',
      kind: place.kind === 'fuel' ? 'fuel' : context.getSelectedRouteNearbyTabId(),
      travelCategory: place.categoryLabel || place.category,
      anchorId: anchor?.id,
      distanceKm,
      iconName: place.iconName,
      address: cleanRouteNearbyLocationText(place.address),
      photoUrl: place.photoUrl,
      sourceLabel: place.kind === 'fuel' ? place.sourceLabel || 'Fuel stop' : place.sourceLabel || 'Map place',
      priceLabel: place.priceLabel,
      recommendationScore: calculateRouteNearbyRecommendationScore({
        category,
        source: 'discovery',
        distanceKm,
      }),
    };
  }

  return {
    enrichRouteNearbyPlace,
    enrichRouteNearbyPlaces,
    mergeRouteNearbyPlaces,
    buildRouteNearbyPlaceFromMapPin,
  };
}

export function createItineraryRouteNearbyHelpers(context: ItineraryRouteNearbyHelperContext) {
  const radiusHelpers = createRouteNearbyRadiusHelpers(context);
  const placeHelpers = createRouteNearbyPlaceHelpers(context, radiusHelpers);
  const searchAndFuelHelpers = createRouteNearbySearchAndFuelHelpers(context, radiusHelpers, placeHelpers);
  const placeBuilderHelpers = createRouteNearbyPlaceBuilderHelpers(
    context,
    radiusHelpers,
    placeHelpers,
    searchAndFuelHelpers,
  );
  const resultHelpers = createRouteNearbyResultHelpers(
    context,
    placeHelpers,
    searchAndFuelHelpers,
    placeBuilderHelpers,
  );

  return {
    clampRouteNearbyCustomRadiusMiles: radiusHelpers.clampRouteNearbyCustomRadiusMiles,
    parseRouteNearbyCustomRadiusMiles: radiusHelpers.parseRouteNearbyCustomRadiusMiles,
    formatRouteNearbyRadiusMiles: radiusHelpers.formatRouteNearbyRadiusMiles,
    normalizeRouteNearbyCustomRadiusValue: radiusHelpers.normalizeRouteNearbyCustomRadiusValue,
    getRouteNearbyCustomRadiusOption: radiusHelpers.getRouteNearbyCustomRadiusOption,
    getSelectedRouteNearbyRadiusOption: radiusHelpers.getSelectedRouteNearbyRadiusOption,
    getRouteNearbyRadiusTitle: radiusHelpers.getRouteNearbyRadiusTitle,
    getRouteNearbyPhotoCategory: placeHelpers.getRouteNearbyPhotoCategory,
    getRouteNearbyCardCategory: placeHelpers.getRouteNearbyCardCategory,
    getRouteNearbyPhotoUrl: placeHelpers.getRouteNearbyPhotoUrl,
    getRouteNearbyIcon: placeHelpers.getRouteNearbyIcon,
    getRouteNearbySourceLabel: placeHelpers.getRouteNearbySourceLabel,
    getRouteNearbyDistanceValue: placeHelpers.getRouteNearbyDistanceValue,
    getRouteNearbyCategoryLabel: placeHelpers.getRouteNearbyCategoryLabel,
    cleanRouteNearbyLocationText,
    stripRouteNearbyLocationPrefix,
    formatRouteNearbyResultLocation: placeHelpers.formatRouteNearbyResultLocation,
    calculateDistanceKm: placeHelpers.calculateDistanceKm,
    normalizeRouteNearbyCategory,
    normalizeTravelSuggestionCategory,
    getRouteNearbyValidationText: placeHelpers.getRouteNearbyValidationText,
    hasRouteNearbyTextSignal: placeHelpers.hasRouteNearbyTextSignal,
    isRouteNearbyFoodPlace: placeHelpers.isRouteNearbyFoodPlace,
    isRouteNearbyStayPlace: placeHelpers.isRouteNearbyStayPlace,
    isRouteNearbyEssentialsPlace: placeHelpers.isRouteNearbyEssentialsPlace,
    isRouteNearbyScenicPlace: placeHelpers.isRouteNearbyScenicPlace,
    isRouteNearbyEntertainmentPlace: placeHelpers.isRouteNearbyEntertainmentPlace,
    isRouteNearbyPlaceValidForSelectedCategory: placeHelpers.isRouteNearbyPlaceValidForSelectedCategory,
    formatRouteNearbyDistance,
    getRouteNearbyPlaceDistanceKm: placeHelpers.getRouteNearbyPlaceDistanceKm,
    formatTravelCategoryLabel,
    isWithinSelectedRouteNearbyRadius: placeHelpers.isWithinSelectedRouteNearbyRadius,
    filterRouteNearbyPlacesWithinSelectedRadius: placeHelpers.filterRouteNearbyPlacesWithinSelectedRadius,
    hasLiveFuelPrice: searchAndFuelHelpers.hasLiveFuelPrice,
    matchesRouteNearbyFuelSearch: searchAndFuelHelpers.matchesRouteNearbyFuelSearch,
    compareRouteNearbyFuelPlaces: searchAndFuelHelpers.compareRouteNearbyFuelPlaces,
    filterAndSortRouteNearbyFuelPlaces: searchAndFuelHelpers.filterAndSortRouteNearbyFuelPlaces,
    buildRouteNearbySearchQuery: searchAndFuelHelpers.buildRouteNearbySearchQuery,
    getRouteNearbyInterestSet: searchAndFuelHelpers.getRouteNearbyInterestSet,
    buildRouteNearbyBounds: searchAndFuelHelpers.buildRouteNearbyBounds,
    getRouteNearbyPlaceCategories: searchAndFuelHelpers.getRouteNearbyPlaceCategories,
    normalizeTripFuelType,
    getFuelTypeLabel,
    normalizeFuelTypeText,
    isRegularFuelType,
    isDieselFuelType,
    isMidgradeFuelType,
    isPremiumFuelType,
    isEvFuelType,
    isFuelTypeForFilter,
    getSelectedFuelStationPrice: searchAndFuelHelpers.getSelectedFuelStationPrice,
    isStrictFuelPlaceResult: searchAndFuelHelpers.isStrictFuelPlaceResult,
    shouldIncludeFuelStation: searchAndFuelHelpers.shouldIncludeFuelStation,
    calculateRouteNearbyRecommendationScore: placeBuilderHelpers.calculateRouteNearbyRecommendationScore,
    isStrongRouteNearbyRecommendation: placeBuilderHelpers.isStrongRouteNearbyRecommendation,
    buildRouteNearbyRecommendationReason: placeBuilderHelpers.buildRouteNearbyRecommendationReason,
    buildScopeNearbyPlace: placeBuilderHelpers.buildScopeNearbyPlace,
    buildDiscoveryNearbyPlace: placeBuilderHelpers.buildDiscoveryNearbyPlace,
    formatFuelPriceValue,
    formatFuelUpdatedAt,
    buildFuelNearbyPlace: placeBuilderHelpers.buildFuelNearbyPlace,
    buildTravelNearbyPlace: placeBuilderHelpers.buildTravelNearbyPlace,
    isRouteNearbyStreetLevelAddress,
    enrichRouteNearbyPlace: resultHelpers.enrichRouteNearbyPlace,
    enrichRouteNearbyPlaces: resultHelpers.enrichRouteNearbyPlaces,
    getRouteNearbyPlaceDedupeKey,
    normalizeRouteNearbyDedupeText,
    dedupeRouteNearbyPlaces,
    mergeRouteNearbyPlaces: resultHelpers.mergeRouteNearbyPlaces,
    buildRouteNearbyPlaceFromMapPin: resultHelpers.buildRouteNearbyPlaceFromMapPin,
    getRouteNearbyFuelApiType: searchAndFuelHelpers.getRouteNearbyFuelApiType,
    getRouteNearbyFuelApiSortMode: searchAndFuelHelpers.getRouteNearbyFuelApiSortMode,
    isRouteNearbyRadiusBeyondProviderLimit: searchAndFuelHelpers.isRouteNearbyRadiusBeyondProviderLimit,
  };
}
