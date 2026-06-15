import {
  TRIP_PLANNER_BUDGET_BOUNDS as budgetBounds,
  TRIP_PLANNER_CALENDAR_DATE_PATTERN as calendarDatePattern,
  TRIP_PLANNER_FALLBACK_TIME_SLOTS as fallbackTimeSlots,
} from '@/config/tripPlannerConfig';
import type { GeocodeResult, PlaceSearchResult } from '@/services/mapService';
import type { WeatherSnapshot } from '@/services/openWeatherMapService';
import type { TripFuelSettings, TripFuelType, TripSpot } from '@/types';

export interface PackingChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  custom?: boolean;
}

export interface NormalizedBudgetRange {
  min: number;
  max: number;
  step: number;
}

export const BUDGET_STEP_AMOUNT = 100;
export const PACKING_CHECKLIST_STORAGE_KEY_PREFIX = 'scope-trip-planner-packing-checklist';
export const PACKING_CHECKLIST_DRAFT_SCOPE_PREFIX = 'draft:';
export const FUEL_MPG_MIN = 1;
export const FUEL_MPG_MAX = 200;
export const FUEL_GAS_PRICE_MIN = 0.01;
export const FUEL_GAS_PRICE_MAX = 20;

export const fuelTypeOptions: Array<{ id: TripFuelType; label: string; icon: string }> = [
  { id: 'regular', label: 'Regular', icon: 'fuel' },
  { id: 'midgrade', label: 'Midgrade', icon: 'fuel' },
  { id: 'premium', label: 'Premium', icon: 'fuel' },
  { id: 'diesel', label: 'Diesel', icon: 'fuel' },
  { id: 'ev', label: 'EV', icon: 'fuel' },
];

const DEFAULT_PACKING_ITEMS: PackingChecklistItem[] = [
  { id: 'license-registration', label: 'Driver license and registration', checked: false },
  { id: 'chargers-cables', label: 'Phone chargers and cables', checked: false },
  { id: 'water-snacks', label: 'Water and road snacks', checked: false },
  { id: 'first-aid', label: 'First aid kit', checked: false },
  { id: 'sunglasses', label: 'Sunglasses', checked: false },
  { id: 'emergency-kit', label: 'Emergency roadside kit', checked: false },
];

const weatherCheckedAtFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

export function getLocationSegments(label: string): string[] {
  return label
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function getLocationRegionHint(label: string): string {
  const segments = getLocationSegments(label);
  if (/\d/.test(segments[0] ?? '')) {
    return segments.length > 2 ? segments.slice(2).join(', ') : '';
  }

  return segments.length > 1 ? segments.slice(1).join(', ') : '';
}

export function getLikelyCityLabel(label: string): string {
  const segments = getLocationSegments(label);
  if (segments.length <= 1) {
    return label.trim();
  }

  const lastSegment = segments[segments.length - 1] ?? '';
  const firstSegment = segments[0] ?? '';
  if (/\d/.test(firstSegment)) {
    return segments.length > 2 ? segments[segments.length - 2] ?? lastSegment : lastSegment;
  }

  return firstSegment;
}

export function buildWeatherSearchLabels(label: string, pairedLabel: string): string[] {
  const cityLabel = getLikelyCityLabel(label);
  const regionHint = getLocationRegionHint(label) || getLocationRegionHint(pairedLabel);
  const labels = [
    regionHint && cityLabel ? `${cityLabel}, ${regionHint}` : '',
    cityLabel,
  ];
  const seenLabels = new Set<string>();

  return labels.filter((candidate) => {
    const normalizedCandidate = candidate.trim().toLowerCase();
    if (!normalizedCandidate || normalizedCandidate === label.trim().toLowerCase() || seenLabels.has(normalizedCandidate)) {
      return false;
    }

    seenLabels.add(normalizedCandidate);
    return true;
  });
}

export function formatRouteEndpointLabel(value: string | undefined): string {
  const parts = (value ?? '').split(',').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) {
    return '';
  }

  const [primary = '', locality = ''] = parts;
  return locality ? `${primary}, ${locality}` : primary;
}

export function normalizePackingItem(item: Partial<PackingChecklistItem>, fallbackIndex: number): PackingChecklistItem | null {
  const label = item.label?.trim();
  if (!label) {
    return null;
  }

  return {
    id: item.id?.trim() || `packing-item-${fallbackIndex}`,
    label,
    checked: Boolean(item.checked),
    custom: Boolean(item.custom),
  };
}

export function cloneDefaultPackingItems(): PackingChecklistItem[] {
  return DEFAULT_PACKING_ITEMS.map((item) => ({ ...item }));
}

export function normalizePackingChecklistScope(scope: string | undefined): string {
  const normalizedScope = (scope ?? '').trim().replace(/\s+/g, '-').slice(0, 120);
  return normalizedScope || `${PACKING_CHECKLIST_DRAFT_SCOPE_PREFIX}standalone`;
}

export function isDraftPackingChecklistScope(scope: string | undefined): boolean {
  return normalizePackingChecklistScope(scope).startsWith(PACKING_CHECKLIST_DRAFT_SCOPE_PREFIX);
}

export function getPackingChecklistStorageKey(scope: string | undefined): string {
  return `${PACKING_CHECKLIST_STORAGE_KEY_PREFIX}:${normalizePackingChecklistScope(scope)}`;
}

export function parseFuelNumber(value: string): number | undefined {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return undefined;
  }

  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

export function parseBoundedFuelNumber(value: string, min: number, max: number): number | undefined {
  const parsedValue = parseFuelNumber(value);
  return parsedValue !== undefined && parsedValue >= min && parsedValue <= max ? parsedValue : undefined;
}

export function formatFuelLimit(value: number): string {
  return value >= 1
    ? value.toLocaleString('en-US', { maximumFractionDigits: 0 })
    : value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function getFuelInputError(value: string, label: string, min: number, max: number, maxLabel = formatFuelLimit(max)): string {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return '';
  }

  const parsedValue = Number(normalizedValue);
  if (!Number.isFinite(parsedValue)) {
    return `${label} needs a number.`;
  }

  if (parsedValue < min) {
    return `${label} must be at least ${formatFuelLimit(min)}.`;
  }

  if (parsedValue > max) {
    return `${label} must be ${maxLabel} or less.`;
  }

  return '';
}

export function formatFuelInputValue(value: number | undefined): string {
  return Number.isFinite(value) && Number(value) > 0 ? String(value) : '';
}

export function normalizeTripFuelType(value: TripFuelSettings['fuelType'] | undefined): TripFuelType {
  return fuelTypeOptions.some((option) => option.id === value) ? (value as TripFuelType) : 'regular';
}

export function formatWeatherTemperature(value: number): string {
  return `${Math.round(value)}\u00b0F`;
}

export function formatWeatherWind(value: number): string {
  return `${Math.round(value)} mph`;
}

export function formatWeatherAirQuality(airQuality: WeatherSnapshot['airQuality'] | null): string {
  if (!airQuality) {
    return '';
  }

  return airQuality.scale === 'us'
    ? `${airQuality.index} ${airQuality.label}`
    : airQuality.label;
}

export function formatWeatherCheckedAt(value: string): string {
  const checkedAt = new Date(value);
  if (Number.isNaN(checkedAt.getTime())) {
    return 'just now';
  }

  return weatherCheckedAtFormatter.format(checkedAt);
}

export function isFallbackWeatherSnapshot(snapshot: WeatherSnapshot): boolean {
  return snapshot.provider === 'openmeteo' || /fallback|demo/i.test(snapshot.providerLabel ?? '');
}

export function formatWeatherProvider(snapshot: WeatherSnapshot): string {
  return snapshot.providerLabel ?? snapshot.provider ?? 'Scope weather';
}

export function getWeatherCheckedTimestamp(snapshot: WeatherSnapshot): string {
  return snapshot.checkedAtIso ?? snapshot.observedAtIso ?? '';
}

export function formatWeatherLocationLabel(label: string): string {
  const parts = label
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return 'Route point';
  }

  const firstPart = parts[0] ?? '';
  const firstPartLooksLikeAddress = /\d|\b(road|rd|street|st|avenue|ave|drive|dr|lane|ln|boulevard|blvd|highway|hwy|route|county|private)\b/i
    .test(firstPart);
  if (firstPartLooksLikeAddress && parts.length > 1) {
    return parts[1] ?? firstPart;
  }

  return firstPart;
}

export function normalizeCoordinate(value: number | undefined, minimum: number, maximum: number): number | undefined {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < minimum || numericValue > maximum) {
    return undefined;
  }

  return numericValue;
}

export function isCoordinatePair(latitude: number | undefined, longitude: number | undefined): latitude is number {
  return (
    normalizeCoordinate(latitude, -90, 90) !== undefined &&
    normalizeCoordinate(longitude, -180, 180) !== undefined
  );
}

export function formatLocationSuggestionTitle(result: GeocodeResult): string {
  if (result.precision === 'poi' && result.placeName) {
    return result.placeName;
  }

  return result.formattedAddress || result.address || result.placeName || 'Pinned location';
}

export function formatLocationSuggestionMeta(result: GeocodeResult): string {
  const placeResult = result as PlaceSearchResult;
  const isPoiResult = result.precision === 'poi';
  const details = [
    placeResult.distanceKm === undefined ? '' : `${formatDistanceMiles(placeResult.distanceKm)} away`,
    [result.city, result.country].filter(Boolean).join(', '),
    isPoiResult ? placeResult.category : '',
  ].filter(Boolean);

  if (details.length) {
    return details.join(' - ');
  }

  const cityCountry = [result.city, result.country].filter(Boolean).join(', ');
  if (cityCountry) {
    return cityCountry;
  }

  return `${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`;
}

export function formatLocationSuggestionBadge(result: GeocodeResult, index: number): string {
  const placeResult = result as PlaceSearchResult;
  if (index === 0 && result.precision === 'poi' && placeResult.distanceKm !== undefined) {
    return 'Closest';
  }

  return index === 0 ? 'Best match' : '';
}

export function formatDistanceMiles(distanceKm: number): string {
  const miles = distanceKm * 0.621371;
  if (miles < 10) {
    return `${miles.toFixed(1)} mi`;
  }

  return `${Math.round(miles).toLocaleString('en-US')} mi`;
}

export function resolveLocationSuggestionLabel(result: GeocodeResult): string {
  return formatLocationSuggestionTitle(result).slice(0, 160);
}

export function normalizeBudgetRange(range?: [number, number]): NormalizedBudgetRange {
  const minimum = Number(range?.[0] ?? budgetBounds.min);
  const maximum = Number(range?.[1] ?? budgetBounds.max);
  const normalizedMinimum = Math.max(0, Math.min(minimum, maximum));
  const normalizedMaximum = Math.max(normalizedMinimum + budgetBounds.step, Math.max(minimum, maximum));

  return {
    min: normalizedMinimum,
    max: normalizedMaximum,
    step: budgetBounds.step,
  };
}

export function normalizeBudgetValue(value: number | undefined, fallback = 0): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, Math.round(numericValue)) : fallback;
}

export function normalizeStops(stops: TripSpot[]): TripSpot[] {
  return stops.map((stop, index) => ({
    ...stop,
    dayNumber: index + 1,
    timeSlot: stop.timeSlot ?? fallbackTimeSlots[index % fallbackTimeSlots.length] ?? '20:00',
  }));
}

export function toCalendarDayNumber(value: string): number {
  const matched = calendarDatePattern.exec(value);
  if (!matched) {
    return Number.NaN;
  }

  const [, year, month, day] = matched;
  const parsedDate = new Date(Number(year), Number(month) - 1, Number(day));

  if (
    parsedDate.getFullYear() !== Number(year) ||
    parsedDate.getMonth() !== Number(month) - 1 ||
    parsedDate.getDate() !== Number(day)
  ) {
    return Number.NaN;
  }

  return Date.UTC(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate()) / (24 * 60 * 60 * 1000);
}
