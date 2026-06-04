import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { geocode } from '@/services/mapService';
import {
  formatScopeAiResolvedPlaceLabel,
  resolveScopeAiLocationIntent,
  type ScopeAiLocationResolution,
} from '@/services/scopeAiLocationResolver';
import { sanitizeScopeAiVisibleText } from '@/services/scopeAiSafety';
import type { TripFuelSettings, TripFuelType, TripPlannerInput, TripSpot } from '@/types';

export type ScopeAiPace = 'relaxed' | 'standard' | 'packed';
export type ScopeAiSessionRole = 'user' | 'assistant';
export type ScopeAiFuelType = TripFuelType;

export interface ScopeAiStop {
  id: string;
  name: string;
  address: string;
  type: string;
  estimated_cost: number;
  estimated_duration_minutes: number;
  notes: string;
  position: number;
  latitude?: number;
  longitude?: number;
}

export interface ScopeAiPlannerState {
  title: string | null;
  start: string | null;
  end: string | null;
  startLatitude?: number;
  startLongitude?: number;
  endLatitude?: number;
  endLongitude?: number;
  stops: ScopeAiStop[];
  budget_min: number | null;
  budget_max: number | null;
  pace: ScopeAiPace | null;
  theme: string[];
  start_date: string | null;
  date: string | null;
  end_date: string | null;
  party_size: number | null;
  fuel_type: ScopeAiFuelType | null;
  mpg: number | null;
  gas_price: number | null;
}

export interface ScopeAiPreferences {
  rejected_types: string[];
  preferred_types: string[];
  accept_streak: number;
  undo_counts: Record<string, number>;
}

export interface ScopeAiSessionEntry {
  role: ScopeAiSessionRole;
  content: string;
  actionBlock: ScopeAiActionBlock | null;
}

export interface ScopeAiSetFieldAction {
  type: 'SET_FIELD';
  field: string;
  value: unknown;
}

export interface ScopeAiAddStopAction {
  type: 'ADD_STOP';
  stop: Partial<ScopeAiStop> & {
    name?: string;
    address?: string;
    type?: string;
    estimated_cost?: number;
    estimated_duration_minutes?: number;
    notes?: string;
    position?: number;
  };
}

export interface ScopeAiRemoveStopAction {
  type: 'REMOVE_STOP';
  stop_id: string;
}

export interface ScopeAiReorderStopsAction {
  type: 'REORDER_STOPS';
  new_order: string[];
}

export interface ScopeAiUpdateStopAction {
  type: 'UPDATE_STOP';
  stop_id: string;
  updates: Partial<ScopeAiStop>;
}

export interface ScopeAiClearFieldAction {
  type: 'CLEAR_FIELD';
  field: string;
}

export interface ScopeAiUndoAction {
  type: 'UNDO';
}

export interface ScopeAiAddPackingItemAction {
  type: 'ADD_PACKING_ITEM';
  label: string;
}

export interface ScopeAiRemovePackingItemAction {
  type: 'REMOVE_PACKING_ITEM';
  item_id: string;
}

export interface ScopeAiSearchNearbyFuelAction {
  type: 'SEARCH_NEARBY_FUEL';
  sort_by?: 'closest' | 'best_price';
  radius_km?: number;
  limit?: number;
}

export interface ScopeAiSearchNearbyPlacesAction {
  type: 'SEARCH_NEARBY_PLACES';
  category?: string;
  radius_km?: number;
  limit?: number;
}

export interface ScopeAiSaveTripDraftAction {
  type: 'SAVE_TRIP_DRAFT';
}

export interface ScopeAiRequestDeleteTripDraftAction {
  type: 'REQUEST_DELETE_TRIP_DRAFT';
}

export interface ScopeAiDeleteTripDraftAction {
  type: 'DELETE_TRIP_DRAFT';
}

export interface ScopeAiOpenShareModalAction {
  type: 'OPEN_SHARE_MODAL';
}

export interface ScopeAiInviteTripMemberAction {
  type: 'INVITE_TRIP_MEMBER';
  recipient: string;
  role?: 'editor' | 'viewer';
}

export interface ScopeAiSetTripVisibilityAction {
  type: 'SET_TRIP_VISIBILITY';
  is_public?: boolean;
  isPublic?: boolean;
}

export type ScopeAiMapCommand =
  | 'zoom_in'
  | 'zoom_out'
  | 'zoom_to_place'
  | 'reset_map'
  | 'fit_route'
  | 'locate_user'
  | 'map_style_light'
  | 'map_style_dark';

export interface ScopeAiMapTarget {
  label?: string;
  latitude: number;
  longitude: number;
  zoom?: number;
  precision?: string;
}

export interface ScopeAiMapCommandPayload {
  command: ScopeAiMapCommand;
  query?: string;
  target?: ScopeAiMapTarget;
}

export interface ScopeAiSetMapCommandAction extends ScopeAiMapCommandPayload {
  type: 'SET_MAP_COMMAND';
}

export type ScopeAiAction =
  | ScopeAiSetFieldAction
  | ScopeAiAddStopAction
  | ScopeAiRemoveStopAction
  | ScopeAiReorderStopsAction
  | ScopeAiUpdateStopAction
  | ScopeAiClearFieldAction
  | ScopeAiUndoAction
  | ScopeAiAddPackingItemAction
  | ScopeAiRemovePackingItemAction
  | ScopeAiSearchNearbyFuelAction
  | ScopeAiSearchNearbyPlacesAction
  | ScopeAiSaveTripDraftAction
  | ScopeAiRequestDeleteTripDraftAction
  | ScopeAiDeleteTripDraftAction
  | ScopeAiOpenShareModalAction
  | ScopeAiInviteTripMemberAction
  | ScopeAiSetTripVisibilityAction
  | ScopeAiSetMapCommandAction
  | { type: string; [key: string]: unknown };

export interface ScopeAiActionBlock {
  actions: ScopeAiAction[];
}

export interface ScopeAiActionResolution {
  type: 'endpoint' | 'stop';
  field: 'start' | 'end' | 'stop';
  rawValue: string;
  status: ScopeAiLocationResolution['status'];
  resolvedLabel?: string;
  candidates: string[];
}

export interface ScopeAiActionBlockApplyResult {
  applied: boolean;
  resolutions: ScopeAiActionResolution[];
}

export type ScopeAiPendingContextKind =
  | 'location-resolution'
  | 'weather-location'
  | 'endpoint-candidates'
  | 'place-candidates'
  | 'fuel-results'
  | 'nearby-results'
  | 'itinerary-brief'
  | 'planner-setting'
  | 'explanation';

export interface ScopeAiPendingContextItem {
  label: string;
  value?: string;
  id?: string;
  source?: string;
  latitude?: number;
  longitude?: number;
  meta?: Record<string, unknown>;
}

export interface ScopeAiPendingScopeAiContext {
  kind: ScopeAiPendingContextKind;
  sourcePrompt: string;
  targetField?: string;
  rawValue?: string;
  candidates?: ScopeAiPendingContextItem[];
  results?: ScopeAiPendingContextItem[];
  lastAnswer?: string;
  createdAt: number;
  turnCount: number;
}

export type ScopeAiPendingScopeAiContextInput =
  Omit<ScopeAiPendingScopeAiContext, 'createdAt' | 'turnCount'>
  & Partial<Pick<ScopeAiPendingScopeAiContext, 'createdAt' | 'turnCount'>>;

export type ScopeAiPendingPackingAction =
  | { type: 'add'; label: string }
  | { type: 'remove'; id: string };

const MAX_UNDO_STACK = 20;
const VALID_PACES = new Set<ScopeAiPace>(['relaxed', 'standard', 'packed']);
const VALID_FUEL_TYPES = new Set<ScopeAiFuelType>(['regular', 'midgrade', 'premium', 'diesel', 'ev']);
const ARRAY_FIELDS = new Set(['stops', 'theme']);
const NON_PLANNER_MUTATION_ACTION_TYPES = new Set([
  'UNDO',
  'SEARCH_NEARBY_FUEL',
  'SEARCH_NEARBY_PLACES',
  'SAVE_TRIP_DRAFT',
  'REQUEST_DELETE_TRIP_DRAFT',
  'DELETE_TRIP_DRAFT',
  'OPEN_SHARE_MODAL',
  'INVITE_TRIP_MEMBER',
  'SET_TRIP_VISIBILITY',
  'SET_MAP_COMMAND',
]);
const NULLABLE_FIELDS = new Set([
  'title',
  'start',
  'end',
  'budget_min',
  'budget_max',
  'pace',
  'start_date',
  'date',
  'end_date',
  'party_size',
  'fuel_type',
  'mpg',
  'gas_price',
]);

function createDefaultPlannerState(): ScopeAiPlannerState {
  return {
    title: null,
    start: null,
    end: null,
    stops: [],
    budget_min: null,
    budget_max: null,
    pace: null,
    theme: [],
    start_date: null,
    date: null,
    end_date: null,
    party_size: null,
    fuel_type: null,
    mpg: null,
    gas_price: null,
  };
}

function createDefaultPreferences(): ScopeAiPreferences {
  return {
    rejected_types: [],
    preferred_types: [],
    accept_streak: 0,
    undo_counts: {},
  };
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeVisibleString(value: unknown): string | null {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  return sanitizeScopeAiVisibleText(normalized) || null;
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  const normalized = normalizeNumber(value);
  return normalized === null ? undefined : normalized;
}

function hasGeocodedCoordinates(latitude: unknown, longitude: unknown): latitude is number {
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Number(latitude) >= -90 &&
    Number(latitude) <= 90 &&
    Number(longitude) >= -180 &&
    Number(longitude) <= 180;
}

function normalizePositivePosition(value: unknown, fallback: number): number {
  const normalized = normalizeNumber(value);
  if (normalized === null) {
    return fallback;
  }

  return Math.max(1, Math.round(normalized));
}

function createStopId(stop: Partial<ScopeAiStop>): string {
  const rawId = normalizeString(stop.id);
  if (rawId) {
    return rawId;
  }

  const seed = normalizeString(stop.name) ?? normalizeString(stop.address) ?? 'stop';
  const slug = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'stop';

  return `scope-ai-${slug}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function createStopFromAction(stop: ScopeAiAddStopAction['stop'], fallbackPosition: number): ScopeAiStop {
  return {
    id: createStopId(stop),
    name: normalizeVisibleString(stop.name) ?? 'Suggested stop',
    address: normalizeVisibleString(stop.address) ?? '',
    type: normalizeString(stop.type) ?? 'other',
    estimated_cost: normalizeNumber(stop.estimated_cost) ?? 0,
    estimated_duration_minutes: normalizeNumber(stop.estimated_duration_minutes) ?? 0,
    notes: normalizeVisibleString(stop.notes) ?? '',
    position: normalizePositivePosition(stop.position, fallbackPosition),
    ...(normalizeOptionalNumber(stop.latitude) !== undefined ? { latitude: normalizeOptionalNumber(stop.latitude) } : {}),
    ...(normalizeOptionalNumber(stop.longitude) !== undefined ? { longitude: normalizeOptionalNumber(stop.longitude) } : {}),
  };
}

function reindexStops(stops: ScopeAiStop[]): ScopeAiStop[] {
  return stops.map((stop, index) => ({
    ...stop,
    position: index + 1,
  }));
}

function isActionBlock(value: unknown): value is ScopeAiActionBlock {
  return Boolean(
    value &&
    typeof value === 'object' &&
    Array.isArray((value as ScopeAiActionBlock).actions),
  );
}

function isTrustedProviderResolution(
  resolution: ScopeAiLocationResolution,
): resolution is ScopeAiLocationResolution & { result: NonNullable<ScopeAiLocationResolution['result']> } {
  return resolution.status === 'resolved' &&
    resolution.result !== null &&
    resolution.result.source !== 'mock';
}

function normalizePlannerPace(value: TripPlannerInput['pace']): ScopeAiPace {
  return value === 'moderate' ? 'standard' : value;
}

function normalizePlannerFieldName(field: string): string {
  const fieldMap: Record<string, string> = {
    destination: 'start',
    endDestination: 'end',
    tripTitle: 'title',
    trip_title: 'title',
    startDate: 'start_date',
    start_date: 'start_date',
    endDate: 'end_date',
    end_date: 'end_date',
    groupSize: 'party_size',
    group_size: 'party_size',
    partySize: 'party_size',
    travelers: 'party_size',
    traveller_count: 'party_size',
    traveler_count: 'party_size',
    fuelType: 'fuel_type',
    fuel_type: 'fuel_type',
    mpg: 'mpg',
    gasPricePerGallon: 'gas_price',
    gas_price: 'gas_price',
  };

  return fieldMap[field] ?? field;
}

function mapTripStopToScopeAiStop(stop: TripSpot, index: number): ScopeAiStop {
  return {
    id: stop.spotId,
    name: stop.title,
    address: stop.city ?? '',
    type: stop.category,
    estimated_cost: stop.estimatedCost ?? 0,
    estimated_duration_minutes: stop.duration ?? 0,
    notes: stop.notes ?? '',
    position: index + 1,
    latitude: stop.latitude,
    longitude: stop.longitude,
  };
}

function upsertStringPreference(values: string[], value: string): string[] {
  const normalized = value.trim();
  if (!normalized || values.includes(normalized)) {
    return values;
  }

  return [...values, normalized];
}

export const useScopeAiPlannerStore = defineStore('scopeAiPlanner', () => {
  const plannerState = ref<ScopeAiPlannerState>(createDefaultPlannerState());
  const sessionHistory = ref<ScopeAiSessionEntry[]>([]);
  const preferences = ref<ScopeAiPreferences>(createDefaultPreferences());
  const undoStack = ref<ScopeAiPlannerState[]>([]);
  const pendingPackingActions = ref<ScopeAiPendingPackingAction[]>([]);
  const pendingScopeAiContext = ref<ScopeAiPendingScopeAiContext | null>(null);

  const stateAsJson = computed(() => deepClone(plannerState.value));
  const hasRoute = computed(() => Boolean(
    plannerState.value.start ||
    plannerState.value.end ||
    plannerState.value.stops.length,
  ));

  function snapshotPlannerState(): void {
    undoStack.value = [...undoStack.value, deepClone(plannerState.value)].slice(-MAX_UNDO_STACK);
  }

  function restorePlannerState(snapshot: ScopeAiPlannerState): void {
    plannerState.value = deepClone(snapshot);
  }

  function clearEndpointCoordinates(field: 'start' | 'end'): void {
    if (field === 'start') {
      plannerState.value.startLatitude = undefined;
      plannerState.value.startLongitude = undefined;
      return;
    }

    plannerState.value.endLatitude = undefined;
    plannerState.value.endLongitude = undefined;
  }

  function geocodeEndpointCoordinates(field: 'start' | 'end', query: string): void {
    void geocode(query, 1).then(({ data }) => {
      const result = Array.isArray(data) ? data[0] : null;
      if (!result || !hasGeocodedCoordinates(result.latitude, result.longitude)) {
        return;
      }

      if (plannerState.value[field] !== query) {
        return;
      }

      const resolvedLabel = result.placeName || result.formattedAddress || query;
      if (field === 'start') {
        plannerState.value.start = resolvedLabel;
        plannerState.value.startLatitude = result.latitude;
        plannerState.value.startLongitude = result.longitude;
        return;
      }

      plannerState.value.end = resolvedLabel;
      plannerState.value.endLatitude = result.latitude;
      plannerState.value.endLongitude = result.longitude;
    }).catch(() => {
      // The text update already succeeded; failed geocoding simply leaves the pin unresolved.
    });
  }

  function getEndpointResolutionProximity(field: 'start' | 'end'): { latitude: number; longitude: number } | null {
    if (field === 'start' && hasGeocodedCoordinates(plannerState.value.startLatitude, plannerState.value.startLongitude)) {
      return {
        latitude: Number(plannerState.value.startLatitude),
        longitude: Number(plannerState.value.startLongitude),
      };
    }

    if (field === 'end' && hasGeocodedCoordinates(plannerState.value.endLatitude, plannerState.value.endLongitude)) {
      return {
        latitude: Number(plannerState.value.endLatitude),
        longitude: Number(plannerState.value.endLongitude),
      };
    }

    if (field === 'start' && hasGeocodedCoordinates(plannerState.value.endLatitude, plannerState.value.endLongitude)) {
      return {
        latitude: Number(plannerState.value.endLatitude),
        longitude: Number(plannerState.value.endLongitude),
      };
    }

    if (field === 'end' && hasGeocodedCoordinates(plannerState.value.startLatitude, plannerState.value.startLongitude)) {
      return {
        latitude: Number(plannerState.value.startLatitude),
        longitude: Number(plannerState.value.startLongitude),
      };
    }

    const firstStop = plannerState.value.stops.find((stop) => hasGeocodedCoordinates(stop.latitude, stop.longitude));
    if (firstStop) {
      return {
        latitude: Number(firstStop.latitude),
        longitude: Number(firstStop.longitude),
      };
    }

    return null;
  }

  async function setPlannerEndpointFieldResolved(field: 'start' | 'end', value: unknown): Promise<ScopeAiActionResolution | null> {
    const normalizedValue = normalizeString(value);
    if (!normalizedValue) {
      plannerState.value[field] = null;
      clearEndpointCoordinates(field);
      return null;
    }

    const resolution = await resolveScopeAiLocationIntent(normalizedValue, {
      limit: 3,
      proximity: getEndpointResolutionProximity(field),
    });
    const candidateLabels = resolution.candidates.map(formatScopeAiResolvedPlaceLabel);

    if (resolution.status !== 'resolved' || !resolution.result) {
      return {
        type: 'endpoint',
        field,
        rawValue: normalizedValue,
        status: resolution.status,
        candidates: candidateLabels,
      };
    }

    const resolvedLabel = formatScopeAiResolvedPlaceLabel(resolution.result);
    plannerState.value[field] = resolvedLabel;
    if (field === 'start') {
      plannerState.value.startLatitude = resolution.result.latitude;
      plannerState.value.startLongitude = resolution.result.longitude;
    } else {
      plannerState.value.endLatitude = resolution.result.latitude;
      plannerState.value.endLongitude = resolution.result.longitude;
    }

    return {
      type: 'endpoint',
      field,
      rawValue: normalizedValue,
      status: 'resolved',
      resolvedLabel,
      candidates: candidateLabels,
    };
  }

  function setPlannerField(field: string, value: unknown): void {
    const normalizedField = normalizePlannerFieldName(field);
    if (normalizedField === 'title' || normalizedField === 'end_date') {
      plannerState.value[normalizedField] = normalizedField === 'title'
        ? normalizeVisibleString(value)
        : normalizeString(value);
      return;
    }

    if (normalizedField === 'start' || normalizedField === 'end') {
      const normalizedValue = normalizeVisibleString(value);
      plannerState.value[normalizedField] = normalizedValue;
      if (normalizedValue) {
        geocodeEndpointCoordinates(normalizedField, normalizedValue);
      } else {
        clearEndpointCoordinates(normalizedField);
      }
      return;
    }

    if (normalizedField === 'date' || normalizedField === 'start_date') {
      const normalizedDate = normalizeString(value);
      plannerState.value.start_date = normalizedDate;
      plannerState.value.date = normalizedDate;
      return;
    }

    if (normalizedField === 'budget_min' || normalizedField === 'budget_max') {
      const normalizedValue = normalizeNumber(value);
      const safeBudget = normalizedValue === null ? null : Math.max(0, Math.round(normalizedValue));
      plannerState.value[normalizedField] = safeBudget;

      if (safeBudget !== null && normalizedField === 'budget_min') {
        const currentMax = plannerState.value.budget_max;
        if (currentMax !== null && currentMax < safeBudget) {
          plannerState.value.budget_max = safeBudget;
        }
      }

      if (safeBudget !== null && normalizedField === 'budget_max') {
        const currentMin = plannerState.value.budget_min;
        if (currentMin !== null && currentMin > safeBudget) {
          plannerState.value.budget_min = safeBudget;
        }
      }
      return;
    }

    if (normalizedField === 'party_size') {
      const normalizedValue = normalizeNumber(value);
      plannerState.value.party_size = normalizedValue === null ? null : Math.max(1, Math.round(normalizedValue));
      return;
    }

    if (normalizedField === 'pace') {
      if (value === null || value === undefined || value === '') {
        plannerState.value.pace = null;
        return;
      }

      if (!VALID_PACES.has(value as ScopeAiPace)) {
        throw new Error(`Invalid Scope AI pace: ${String(value)}`);
      }

      plannerState.value.pace = value as ScopeAiPace;
      return;
    }

    if (normalizedField === 'theme') {
      if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
        throw new Error('Scope AI theme must be an array of strings.');
      }

      plannerState.value.theme = value
        .map((entry) => sanitizeScopeAiVisibleText(entry))
        .filter(Boolean);
      return;
    }

    if (normalizedField === 'fuel_type') {
      if (value === null || value === undefined || value === '') {
        plannerState.value.fuel_type = null;
        return;
      }

      if (!VALID_FUEL_TYPES.has(value as ScopeAiFuelType)) {
        throw new Error(`Invalid Scope AI fuel type: ${String(value)}`);
      }

      plannerState.value.fuel_type = value as ScopeAiFuelType;
      if (value === 'ev') {
        plannerState.value.mpg = null;
        plannerState.value.gas_price = null;
      }
      return;
    }

    if (normalizedField === 'mpg') {
      const normalizedValue = normalizeNumber(value);
      plannerState.value.mpg = normalizedValue === null ? null : clampNumber(normalizedValue, 1, 100);
      return;
    }

    if (normalizedField === 'gas_price') {
      const normalizedValue = normalizeNumber(value);
      plannerState.value.gas_price = normalizedValue === null ? null : clampNumber(normalizedValue, 0.01, 20);
      return;
    }

    if (normalizedField === 'stops') {
      if (!Array.isArray(value)) {
        throw new Error('Scope AI stops must be an array.');
      }

      plannerState.value.stops = reindexStops(value as ScopeAiStop[]);
      return;
    }

    throw new Error(`Unknown Scope AI planner field: ${field}`);
  }

  function clearPlannerField(field: string): void {
    const normalizedField = normalizePlannerFieldName(field);

    if (normalizedField === 'stops') {
      plannerState.value.stops = [];
      return;
    }

    if (normalizedField === 'theme') {
      plannerState.value.theme = [];
      return;
    }

    if (NULLABLE_FIELDS.has(normalizedField)) {
      setPlannerField(normalizedField, null);
      return;
    }

    if (ARRAY_FIELDS.has(normalizedField)) {
      setPlannerField(normalizedField, []);
      return;
    }

    throw new Error(`Unknown Scope AI planner field: ${field}`);
  }

  function addStop(stop: ScopeAiAddStopAction['stop']): ScopeAiStop {
    const nextStop = createStopFromAction(stop, plannerState.value.stops.length + 1);
    const insertIndex = Math.max(0, Math.min(nextStop.position - 1, plannerState.value.stops.length));
    const nextStops = [...plannerState.value.stops];
    nextStops.splice(insertIndex, 0, nextStop);
    plannerState.value.stops = reindexStops(nextStops);
    return plannerState.value.stops.find((entry) => entry.id === nextStop.id) ?? nextStop;
  }

  function getStopResolutionProximity(): { latitude: number; longitude: number } | null {
    return getEndpointResolutionProximity('end') ?? getEndpointResolutionProximity('start');
  }

  async function addStopResolved(stop: ScopeAiAddStopAction['stop']): Promise<ScopeAiActionResolution | null> {
    const normalizedStop = createStopFromAction(stop, plannerState.value.stops.length + 1);
    const query = [normalizedStop.address, normalizedStop.name]
      .map(normalizeString)
      .filter(Boolean)
      .join(' ')
      .trim();
    if (!query) {
      return {
        type: 'stop',
        field: 'stop',
        rawValue: normalizedStop.name || 'suggested stop',
        status: 'not_found',
        candidates: [],
      };
    }

    const resolution = await resolveScopeAiLocationIntent(query, {
      limit: 3,
      proximity: getStopResolutionProximity(),
    });
    const candidateLabels = resolution.candidates.map(formatScopeAiResolvedPlaceLabel);
    if (!isTrustedProviderResolution(resolution)) {
      return {
        type: 'stop',
        field: 'stop',
        rawValue: query,
        status: resolution.status === 'resolved' ? 'not_found' : resolution.status,
        candidates: candidateLabels,
      };
    }

    const resolvedLabel = formatScopeAiResolvedPlaceLabel(resolution.result);
    addStop({
      ...normalizedStop,
      name: normalizedStop.name || resolution.result.placeName || resolvedLabel,
      address: resolution.result.formattedAddress || resolution.result.address || normalizedStop.address || resolvedLabel,
      latitude: resolution.result.latitude,
      longitude: resolution.result.longitude,
    });
    return {
      type: 'stop',
      field: 'stop',
      rawValue: query,
      status: 'resolved',
      resolvedLabel,
      candidates: candidateLabels,
    };
  }

  function removeStop(stopId: string): void {
    plannerState.value.stops = reindexStops(
      plannerState.value.stops.filter((stop) => stop.id !== stopId),
    );
  }

  function reorderStops(newOrder: string[]): void {
    const orderIndexById = new Map(newOrder.map((id, index) => [id, index]));
    const orderedStops = [...plannerState.value.stops].sort((left, right) => {
      const leftIndex = orderIndexById.get(left.id);
      const rightIndex = orderIndexById.get(right.id);

      if (leftIndex === undefined && rightIndex === undefined) {
        return left.position - right.position;
      }

      if (leftIndex === undefined) {
        return 1;
      }

      if (rightIndex === undefined) {
        return -1;
      }

      return leftIndex - rightIndex;
    });

    plannerState.value.stops = reindexStops(orderedStops);
  }

  function updateStop(stopId: string, updates: Partial<ScopeAiStop>): void {
    const targetStop = plannerState.value.stops.find((stop) => stop.id === stopId);
    if (!targetStop) {
      return;
    }

    Object.assign(targetStop, updates);
    plannerState.value.stops = reindexStops(plannerState.value.stops);
  }

  function addPendingPackingItem(label: string): void {
    const normalizedLabel = normalizeVisibleString(label);
    if (!normalizedLabel) {
      return;
    }

    pendingPackingActions.value = [
      ...pendingPackingActions.value,
      { type: 'add', label: normalizedLabel },
    ];
  }

  function removePendingPackingItem(itemId: string): void {
    const normalizedItemId = normalizeVisibleString(itemId);
    if (!normalizedItemId) {
      return;
    }

    pendingPackingActions.value = [
      ...pendingPackingActions.value,
      { type: 'remove', id: normalizedItemId },
    ];
  }

  function clearPendingPackingActions(): void {
    pendingPackingActions.value = [];
  }

  function setPendingScopeAiContext(context: ScopeAiPendingScopeAiContextInput): void {
    pendingScopeAiContext.value = {
      ...deepClone(context),
      createdAt: context.createdAt ?? Date.now(),
      turnCount: context.turnCount ?? 0,
    };
  }

  function clearPendingScopeAiContext(_reason?: string): void {
    pendingScopeAiContext.value = null;
  }

  function incrementPendingScopeAiContextTurn(): void {
    const context = pendingScopeAiContext.value;
    if (!context) {
      return;
    }

    const nextTurnCount = context.turnCount + 1;
    if (nextTurnCount >= 3) {
      pendingScopeAiContext.value = null;
      return;
    }

    pendingScopeAiContext.value = {
      ...context,
      turnCount: nextTurnCount,
    };
  }

  function undo(): void {
    const snapshot = undoStack.value.at(-1);
    if (!snapshot) {
      return;
    }

    undoStack.value = undoStack.value.slice(0, -1);
    restorePlannerState(snapshot);
    preferences.value.undo_counts = {
      ...preferences.value.undo_counts,
      last: (preferences.value.undo_counts.last ?? 0) + 1,
    };
  }

  async function geocodeStopCoordinates(stopId: string): Promise<void> {
    const stop = plannerState.value.stops.find((entry) => entry.id === stopId);
    if (!stop) {
      return;
    }

    const query = [stop.address, stop.name].filter(Boolean).join(' ').trim();
    if (!query) {
      return;
    }

    try {
      const response = await geocode(query, 1);
      const result = Array.isArray(response.data) ? response.data[0] : null;
      if (!result || !hasGeocodedCoordinates(result.latitude, result.longitude)) {
        return;
      }

      const currentStop = plannerState.value.stops.find((entry) => entry.id === stopId);
      if (!currentStop) {
        return;
      }

      currentStop.latitude = result.latitude;
      currentStop.longitude = result.longitude;
      if (!currentStop.address && result.formattedAddress) {
        currentStop.address = result.formattedAddress;
      }
    } catch {
      // The stop text update already succeeded; failed geocoding simply leaves the pin unresolved.
    }
  }

  function applyAction(action: ScopeAiAction): ScopeAiStop | null {
    switch (action.type) {
      case 'SET_FIELD':
        setPlannerField(action.field, action.value);
        return null;
      case 'ADD_STOP':
        return addStop(action.stop);
      case 'REMOVE_STOP':
        removeStop(action.stop_id);
        return null;
      case 'REORDER_STOPS':
        reorderStops(action.new_order);
        return null;
      case 'UPDATE_STOP':
        updateStop(action.stop_id, action.updates);
        return null;
      case 'CLEAR_FIELD':
        clearPlannerField(action.field);
        return null;
      case 'UNDO':
        undo();
        return null;
      case 'ADD_PACKING_ITEM':
        addPendingPackingItem(action.label);
        return null;
      case 'REMOVE_PACKING_ITEM':
        removePendingPackingItem(action.item_id);
        return null;
      case 'SEARCH_NEARBY_FUEL':
      case 'SEARCH_NEARBY_PLACES':
      case 'SAVE_TRIP_DRAFT':
      case 'REQUEST_DELETE_TRIP_DRAFT':
      case 'DELETE_TRIP_DRAFT':
      case 'OPEN_SHARE_MODAL':
      case 'INVITE_TRIP_MEMBER':
      case 'SET_TRIP_VISIBILITY':
      case 'SET_MAP_COMMAND':
        return null;
      default:
        throw new Error(`Unknown Scope AI action type: ${action.type}`);
    }
  }

  function applyActionBlock(block: ScopeAiActionBlock | null | undefined): boolean {
    if (!isActionBlock(block) || !block.actions.length) {
      return false;
    }

    if (block.actions.some((action) => !NON_PLANNER_MUTATION_ACTION_TYPES.has(action.type))) {
      snapshotPlannerState();
    }

    const stopsToGeocode: ScopeAiStop[] = [];
    for (const action of block.actions) {
      try {
        const addedStop = applyAction(action);
        if (addedStop) {
          stopsToGeocode.push(addedStop);
        }
      } catch (error) {
        console.error('Scope AI planner action failed', error);
      }
    }

    stopsToGeocode.forEach((stop) => {
      void geocodeStopCoordinates(stop.id);
    });
    return true;
  }

  async function applyActionBlockResolved(block: ScopeAiActionBlock | null | undefined): Promise<ScopeAiActionBlockApplyResult> {
    if (!isActionBlock(block) || !block.actions.length) {
      return {
        applied: false,
        resolutions: [],
      };
    }

    if (block.actions.some((action) => !NON_PLANNER_MUTATION_ACTION_TYPES.has(action.type))) {
      snapshotPlannerState();
    }

    const stopsToGeocode: ScopeAiStop[] = [];
    const resolutions: ScopeAiActionResolution[] = [];
    for (const action of block.actions) {
      try {
        if (action.type === 'SET_FIELD') {
          const normalizedField = normalizePlannerFieldName(action.field);
          if (normalizedField === 'start' || normalizedField === 'end') {
            const resolution = await setPlannerEndpointFieldResolved(normalizedField, action.value);
            if (resolution) {
              resolutions.push(resolution);
            }
            continue;
          }
        }

        if (action.type === 'ADD_STOP') {
          const resolution = await addStopResolved(action.stop);
          if (resolution) {
            resolutions.push(resolution);
          }
          continue;
        }

        const addedStop = applyAction(action);
        if (addedStop) {
          stopsToGeocode.push(addedStop);
        }
      } catch (error) {
        console.error('Scope AI planner action failed', error);
      }
    }

    await Promise.all(stopsToGeocode.map((stop) => geocodeStopCoordinates(stop.id)));
    return {
      applied: true,
      resolutions,
    };
  }

  function addSessionEntry(entry: ScopeAiSessionEntry): void {
    sessionHistory.value = [
      ...sessionHistory.value,
      {
        ...entry,
        actionBlock: entry.actionBlock ? deepClone(entry.actionBlock) : null,
      },
    ];
  }

  function trackRejectedType(type: string): void {
    preferences.value.rejected_types = upsertStringPreference(preferences.value.rejected_types, type);
    preferences.value.accept_streak = 0;
  }

  function trackAcceptedType(type: string): void {
    preferences.value.preferred_types = upsertStringPreference(preferences.value.preferred_types, type);
    preferences.value.accept_streak += 1;
  }

  function seedPreferredTypes(types: readonly string[]): void {
    const rejectedTypes = new Set(preferences.value.rejected_types.map((type) => type.toLowerCase()));
    let nextPreferredTypes = [...preferences.value.preferred_types];

    for (const type of types) {
      const normalizedType = normalizeString(type);
      if (!normalizedType || rejectedTypes.has(normalizedType.toLowerCase())) {
        continue;
      }

      nextPreferredTypes = upsertStringPreference(nextPreferredTypes, normalizedType);
    }

    preferences.value.preferred_types = nextPreferredTypes;
  }

  function hydrateFromPlannerDraft(
    draft: TripPlannerInput,
    stops: TripSpot[],
    title?: string,
    fuelSettings?: TripFuelSettings,
  ): void {
    const startDate = normalizeString(draft.startDate);
    plannerState.value = {
      title: normalizeString(title),
      start: normalizeString(draft.destination),
      end: normalizeString(draft.endDestination),
      startLatitude: normalizeOptionalNumber(draft.destinationLatitude),
      startLongitude: normalizeOptionalNumber(draft.destinationLongitude),
      endLatitude: normalizeOptionalNumber(draft.endDestinationLatitude),
      endLongitude: normalizeOptionalNumber(draft.endDestinationLongitude),
      stops: stops.map(mapTripStopToScopeAiStop),
      budget_min: normalizeNumber(draft.budgetFloor),
      budget_max: normalizeNumber(draft.budget),
      pace: normalizePlannerPace(draft.pace),
      theme: [...draft.interests],
      start_date: startDate,
      date: startDate,
      end_date: normalizeString(draft.endDate),
      party_size: normalizeNumber(draft.groupSize),
      fuel_type: fuelSettings?.fuelType && VALID_FUEL_TYPES.has(fuelSettings.fuelType) ? fuelSettings.fuelType : null,
      mpg: normalizeNumber(fuelSettings?.mpg),
      gas_price: normalizeNumber(fuelSettings?.gasPricePerGallon),
    };
  }

  function resetSession(): void {
    plannerState.value = createDefaultPlannerState();
    sessionHistory.value = [];
    preferences.value = createDefaultPreferences();
    undoStack.value = [];
    pendingPackingActions.value = [];
    pendingScopeAiContext.value = null;
  }

  return {
    plannerState,
    sessionHistory,
    preferences,
    undoStack,
    pendingPackingActions,
    pendingScopeAiContext,
    stateAsJson,
    hasRoute,
    applyActionBlock,
    applyActionBlockResolved,
    addSessionEntry,
    trackRejectedType,
    trackAcceptedType,
    seedPreferredTypes,
    hydrateFromPlannerDraft,
    clearPendingPackingActions,
    setPendingScopeAiContext,
    clearPendingScopeAiContext,
    incrementPendingScopeAiContextTurn,
    resetSession,
  };
});
