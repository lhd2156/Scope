import type { SpotCategory, Trip, TripFuelSettings, TripFuelType, TripPlannerInput, TripSpot } from '@/types';

export type PlannerMobileStep = 1 | 2 | 3 | 4;
export type PlannerMapPickTarget = 'destination' | 'endDestination';

export interface MobileWizardStep {
  number: PlannerMobileStep;
  label: string;
  description: string;
}

export type RouteLibraryPhotoRole = 'single' | 'start' | 'end';
export type RouteLibrarySplitHoverRole = Extract<RouteLibraryPhotoRole, 'start' | 'end'>;

export interface RouteLibraryPhotoCacheEntry {
  photoUrl: string;
  savedAt: number;
}

export interface RouteLibraryVisualImage {
  key: string;
  src: string;
  alt: string;
}

export interface RouteLibraryStopPreview {
  id: string;
  title: string;
  meta: string;
  category: SpotCategory;
}

export interface RouteLibraryCard {
  id: string;
  trip: Trip;
  title: string;
  routeLabel: string;
  dateLabel: string;
  statusLabel: 'Seed route' | 'Public route';
  memberLabel: string;
  stopLabel: string;
  dayLabel: string;
  budgetLabel: string;
  stopPreview: RouteLibraryStopPreview[];
  remainingStopCount: number;
  visualImages: RouteLibraryVisualImage[];
  visualMode: 'split' | 'single' | 'mapline';
  visualCategories: SpotCategory[];
}

export const TRIP_PLANNER_MOBILE_BREAKPOINT = 640;
export const PLANNER_USA_MAP_ZOOM = 3.25;
export const SCOPE_AI_ENDPOINT_FOCUS_ZOOM = 10;
export const TRIP_PLANNER_AUTOSAVE_DEBOUNCE_MS = 1_200;
export const TRIP_PLANNER_AUTOSAVE_RETRY_MS = 1_800;
export const DEFAULT_BUDGET_FLOOR = 500;
export const DEFAULT_BUDGET_CEILING = 1500;
export const DEFAULT_ITINERARY_TIME_SLOTS = ['09:00', '12:00', '15:00', '18:30'];
export const ROUTE_LIBRARY_CARD_LIMIT = 3;
export const ROUTE_LIBRARY_FETCH_LIMIT = ROUTE_LIBRARY_CARD_LIMIT * 4;
export const ROUTE_LIBRARY_STOP_PREVIEW_LIMIT = 4;
export const ROUTE_LIBRARY_PHOTO_WIDTH = 720;
export const ROUTE_LIBRARY_PHOTO_CACHE_STORAGE_KEY = 'scope.routeLibraryPhotoLookupCache.v1';
export const ROUTE_LIBRARY_PHOTO_CACHE_LIMIT = 120;
export const SCOPE_AI_PLANNER_INTEREST_CATEGORIES: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'entertainment', 'scenic'];
export const SCOPE_AI_PLANNER_SPOT_CATEGORIES = new Set<SpotCategory>([
  ...SCOPE_AI_PLANNER_INTEREST_CATEGORIES,
  'other',
]);

export const ROUTE_LIBRARY_CATEGORY_LABELS: Record<SpotCategory, string> = {
  food: 'Food',
  nature: 'Nature',
  nightlife: 'Nightlife',
  culture: 'Culture',
  adventure: 'Adventure',
  shopping: 'Shopping',
  entertainment: 'Entertainment',
  scenic: 'Scenic',
  other: 'Stop',
};

export const ROUTE_LIBRARY_SPLIT_FALLBACK_CATEGORIES: SpotCategory[] = [
  'scenic',
  'adventure',
  'nature',
  'food',
  'culture',
  'nightlife',
  'entertainment',
  'shopping',
  'other',
];

export const mobileWizardSteps: MobileWizardStep[] = [
  { number: 1, label: 'Brief', description: 'Start, final destination, dates, travelers, and budget range.' },
  { number: 2, label: 'Route', description: 'Stop order and endpoint stack the guide will use.' },
  { number: 3, label: 'Guide', description: 'Pace, interests, and the route guide brief.' },
  { number: 4, label: 'Preview', description: 'Live route, timeline, and day-by-day cost view.' },
];

export function getCurrentDateInputValue(): string {
  const today = new Date();
  return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
}

export function formatPlannerBudgetValue(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

export function sanitizePositiveFuelValue(value: number | undefined): number | undefined {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : undefined;
}

export function sanitizeFuelType(value: TripFuelSettings['fuelType'] | undefined): TripFuelType | undefined {
  const normalizedValue = String(value ?? '').trim().toLowerCase();
  return ['regular', 'midgrade', 'premium', 'diesel', 'ev'].includes(normalizedValue)
    ? (normalizedValue as TripFuelType)
    : undefined;
}

export function roundFuelPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isCoordinatePair(latitude: number | undefined, longitude: number | undefined): boolean {
  return Number.isFinite(latitude) && Number(latitude) >= -90 && Number(latitude) <= 90 &&
    Number.isFinite(longitude) && Number(longitude) >= -180 && Number(longitude) <= 180;
}

export interface PlannerDraftAutosaveSnapshot {
  title: string;
  draft: TripPlannerInput;
  stops: TripSpot[];
  isPublic: boolean;
  todayDateInput?: string;
  previewStopCount?: number;
}

export function hasAutosavablePlannerDraftInput(snapshot: PlannerDraftAutosaveSnapshot): boolean {
  const { title, draft, stops, isPublic, todayDateInput = '' } = snapshot;
  return Boolean(
    title.trim()
    || draft.destination.trim()
    || draft.endDestination?.trim()
    || isCoordinatePair(draft.destinationLatitude, draft.destinationLongitude)
    || isCoordinatePair(draft.endDestinationLatitude, draft.endDestinationLongitude)
    || stops.length
    || draft.interests.length
    || draft.pace !== 'relaxed'
    || draft.groupSize !== 1
    || draft.startDate !== todayDateInput
    || draft.endDate !== todayDateInput
    || (draft.budgetFloor ?? DEFAULT_BUDGET_FLOOR) !== DEFAULT_BUDGET_FLOOR
    || draft.budget !== DEFAULT_BUDGET_CEILING
    || isPublic
  );
}

export function hasAutosavablePlannerRouteContent(snapshot: Pick<PlannerDraftAutosaveSnapshot, 'draft' | 'stops' | 'previewStopCount'>): boolean {
  const { draft, stops, previewStopCount = 0 } = snapshot;
  return Boolean(
    draft.destination.trim()
    || draft.endDestination?.trim()
    || isCoordinatePair(draft.destinationLatitude, draft.destinationLongitude)
    || isCoordinatePair(draft.endDestinationLatitude, draft.endDestinationLongitude)
    || stops.length
    || previewStopCount
  );
}

export function buildPlannerDraftAutosaveSignature(snapshot: Pick<PlannerDraftAutosaveSnapshot, 'title' | 'draft' | 'stops' | 'isPublic'>): string {
  const { title, draft, stops, isPublic } = snapshot;
  return JSON.stringify({
    title: title.trim(),
    destination: draft.destination.trim(),
    endDestination: draft.endDestination?.trim() ?? '',
    destinationLatitude: draft.destinationLatitude ?? null,
    destinationLongitude: draft.destinationLongitude ?? null,
    endDestinationLatitude: draft.endDestinationLatitude ?? null,
    endDestinationLongitude: draft.endDestinationLongitude ?? null,
    startDate: draft.startDate,
    endDate: draft.endDate,
    budgetFloor: draft.budgetFloor ?? DEFAULT_BUDGET_FLOOR,
    budget: draft.budget,
    interests: [...draft.interests].sort(),
    pace: draft.pace,
    groupSize: draft.groupSize,
    isPublic,
    stops: stops.map((stop) => ({
      spotId: stop.spotId,
      title: stop.title,
      timeSlot: stop.timeSlot ?? '',
      duration: stop.duration ?? null,
      latitude: stop.latitude,
      longitude: stop.longitude,
      category: stop.category,
      estimatedCost: stop.estimatedCost ?? null,
      photoUrl: stop.photoUrl ?? '',
      city: stop.city ?? '',
      dayNumber: stop.dayNumber ?? null,
      notes: stop.notes ?? '',
    })),
  });
}

export function getGeneratedTitleEndpoint(value: string | undefined): string {
  const parts = (value ?? '').split(',').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) {
    return '';
  }

  const [primary = '', locality = ''] = parts;
  const primaryLooksLikeAddress = /^\d/.test(primary) || /\b(highway|hwy|road|rd|street|st|avenue|ave|boulevard|blvd|drive|dr)\b/i.test(primary);
  return primaryLooksLikeAddress && locality ? locality : primary;
}

export function buildGeneratedDraftTitle(draft: Pick<TripPlannerInput, 'destination' | 'endDestination'>): string {
  const start = getGeneratedTitleEndpoint(draft.destination);
  const end = getGeneratedTitleEndpoint(draft.endDestination);
  const generatedTitle = start && end && start.toLowerCase() !== end.toLowerCase()
    ? `${start} to ${end}`
    : start || end
      ? `${start || end} itinerary`
      : 'Untitled trip';

  return generatedTitle.length > 80 ? `${generatedTitle.slice(0, 77).trim()}...` : generatedTitle;
}

export function buildVisibleGeneratedDraftTitle(draft: Pick<TripPlannerInput, 'destination' | 'endDestination'>): string {
  const generatedTitle = buildGeneratedDraftTitle(draft);
  return generatedTitle === 'Untitled trip' ? '' : generatedTitle;
}

export function normalizePlannerTitleForCompare(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function buildGeneratedTitleCandidates(draft: Pick<TripPlannerInput, 'destination' | 'endDestination'>): string[] {
  const start = getGeneratedTitleEndpoint(draft.destination);
  const end = getGeneratedTitleEndpoint(draft.endDestination);
  const fullStart = draft.destination.trim();
  const fullEnd = draft.endDestination?.trim() ?? '';
  const candidates = [
    buildGeneratedDraftTitle(draft),
    buildVisibleGeneratedDraftTitle(draft),
    start && end ? `${start} to ${end}` : '',
    fullStart && fullEnd ? `${fullStart} to ${fullEnd}` : '',
    start ? `${start} itinerary` : '',
    end ? `${end} itinerary` : '',
    start ? `${start} trip` : '',
    end ? `${end} trip` : '',
    'Untitled trip',
  ];

  return [...new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean))];
}

export function isGeneratedPlannerTitleForDraft(title: string, draft: Pick<TripPlannerInput, 'destination' | 'endDestination'>): boolean {
  const normalizedTitle = normalizePlannerTitleForCompare(title);
  if (!normalizedTitle) {
    return true;
  }

  return buildGeneratedTitleCandidates(draft).some((candidate) =>
    normalizePlannerTitleForCompare(candidate) === normalizedTitle,
  );
}

export function splitRouteDestinationLabel(destination: string): { start: string; end: string } {
  const normalizedDestination = destination.trim();
  const routeParts = normalizedDestination.split(/\s*(?:\bto\b|\+|\u2192|->)\s*/i).map((part) => part.trim()).filter(Boolean);

  if (routeParts.length < 2) {
    return {
      start: normalizedDestination,
      end: '',
    };
  }

  return {
    start: routeParts.slice(0, -1).join(' to '),
    end: routeParts[routeParts.length - 1] ?? '',
  };
}

export function compareRecentTrips(left: Trip, right: Trip): number {
  const leftTime = Date.parse(left.updatedAt || left.createdAt || left.startDate);
  const rightTime = Date.parse(right.updatedAt || right.createdAt || right.startDate);
  return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
}

export function normalizeRouteLibraryImageKey(imageUrl: string): string {
  const normalizedImageUrl = imageUrl.trim();
  if (!normalizedImageUrl) {
    return '';
  }

  try {
    const url = new URL(normalizedImageUrl);
    return url.hostname === 'images.unsplash.com'
      ? `${url.origin}${url.pathname}`
      : normalizedImageUrl;
  } catch {
    return normalizedImageUrl;
  }
}

export function isRepeatedRouteLibraryImage(imageUrl: string, repeatedImageKeys: Set<string>): boolean {
  return repeatedImageKeys.has(normalizeRouteLibraryImageKey(imageUrl));
}

export function formatRouteLibraryCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatRouteLibraryDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

export function formatRouteLibraryDateLabel(trip: Pick<Trip, 'startDate' | 'endDate'>): string {
  const startDate = formatRouteLibraryDate(trip.startDate);
  const endDate = formatRouteLibraryDate(trip.endDate);
  return startDate && endDate && startDate !== endDate ? `${startDate} - ${endDate}` : startDate || endDate || 'Flexible dates';
}

export function formatRouteLibraryBudgetLabel(trip: Pick<Trip, 'budget'>): string {
  return Number.isFinite(trip.budget) && Number(trip.budget) > 0
    ? formatPlannerBudgetValue(Number(trip.budget))
    : 'Budget TBD';
}

export function formatRouteLibraryCategory(category: SpotCategory): string {
  return ROUTE_LIBRARY_CATEGORY_LABELS[category] ?? 'Stop';
}

export function getRouteLibraryStopLocation(stop: TripSpot): string {
  return stop.city?.trim() || stop.title.trim();
}

export function compactRouteLibraryLocation(value: string): string {
  return value
    .trim()
    .replace(/\s*,?\s*(United States|USA)$/i, '')
    .replace(/\s+/g, ' ');
}

export function normalizeRouteLibraryLocation(value: string): string {
  return compactRouteLibraryLocation(value)
    .toLowerCase()
    .replace(/\b(texas|tx|oklahoma|ok|new mexico|nm|united states|usa)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function getRouteLibraryEndpointLabels(trip: Pick<Trip, 'destination'>, stops: TripSpot[]): { start: string; end: string; routeLabel: string } {
  const destinationParts = splitRouteDestinationLabel(trip.destination);
  const firstStop = stops[0];
  const lastStop = stops[stops.length - 1];
  const start = compactRouteLibraryLocation(destinationParts.start || (firstStop ? getRouteLibraryStopLocation(firstStop) : trip.destination));
  const end = compactRouteLibraryLocation(destinationParts.end || (lastStop ? getRouteLibraryStopLocation(lastStop) : ''));
  const normalizedStart = normalizeRouteLibraryLocation(start);
  const normalizedEnd = normalizeRouteLibraryLocation(end);

  if (!destinationParts.end && trip.destination.trim()) {
    return {
      start,
      end: '',
      routeLabel: compactRouteLibraryLocation(trip.destination),
    };
  }

  if (!end || normalizedStart === normalizedEnd) {
    return {
      start,
      end: '',
      routeLabel: start || compactRouteLibraryLocation(trip.destination),
    };
  }

  return {
    start,
    end,
    routeLabel: `${start} to ${end}`,
  };
}

export function normalizeRouteLibraryPhotoCacheText(value: string | undefined): string {
  return compactRouteLibraryLocation(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function formatRouteLibraryPhotoCoordinate(value: number | undefined): string {
  return Number.isFinite(value) ? Number(value).toFixed(5) : '';
}

export function buildRouteLibraryPhotoCacheKey(stop: TripSpot | undefined): string {
  if (!stop || !isCoordinatePair(stop.latitude, stop.longitude)) {
    return '';
  }

  return [
    normalizeRouteLibraryPhotoCacheText(stop.title),
    normalizeRouteLibraryPhotoCacheText(stop.city),
    formatRouteLibraryPhotoCoordinate(stop.latitude),
    formatRouteLibraryPhotoCoordinate(stop.longitude),
    String(ROUTE_LIBRARY_PHOTO_WIDTH),
  ].join('|');
}

export function isSeedRouteLibraryTrip(trip: Pick<Trip, 'id'>): boolean {
  return /^trip-\d+$/i.test(trip.id);
}

export function shouldPreferRouteLibraryLookupPhoto(trip: Pick<Trip, 'id'>): boolean {
  return isSeedRouteLibraryTrip(trip);
}

export function getRouteLibraryVisualCategories(stops: TripSpot[]): SpotCategory[] {
  const categories = stops.map((stop) => stop.category).filter((category, index, all) => all.indexOf(category) === index);
  return (categories.length ? categories : ['scenic']).slice(0, 4);
}
