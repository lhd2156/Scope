import { reactive } from 'vue';
import type { GeocodeResult, LocationSearchOptions } from '@/services/mapService';

export type LocationFieldKey = 'destination' | 'endDestination';

export interface LocationSearchAnchor {
  latitude: number;
  longitude: number;
}

export interface LocationSuggestionState {
  results: GeocodeResult[];
  loading: boolean;
  open: boolean;
  error: string;
  activeIndex: number;
}

type LocationTimerRegistry = Record<LocationFieldKey, ReturnType<typeof setTimeout> | null>;
type LocationRequestIds = Record<LocationFieldKey, number>;
type LocationSearchResponse = Promise<{ data: GeocodeResult[] }>;
type LocationSearchService = (query: string, options: LocationSearchOptions) => LocationSearchResponse;

interface UseTripPlannerLocationSearchOptions {
  searchLocations: LocationSearchService;
  canUseLocationField: (field: LocationFieldKey) => boolean;
  getLocationFieldValue: (field: LocationFieldKey) => string;
  hasLocationCoordinates: (field: LocationFieldKey) => boolean;
  setLocationFieldValue: (field: LocationFieldKey, value: string) => void;
  clearLocationCoordinates: (field: LocationFieldKey) => void;
  setLocationCoordinates: (field: LocationFieldKey, result: GeocodeResult) => void;
  resolveLocationSearchProximity: (field: LocationFieldKey) => LocationSearchAnchor | undefined;
  resolveLocationSuggestionLabel: (result: GeocodeResult) => string;
  formatLocationSuggestionTitle: (result: GeocodeResult) => string;
  onBlockedLocationField: (field: LocationFieldKey) => void;
  onLocationInput: (field: LocationFieldKey) => void;
}

const LOCATION_FIELDS: LocationFieldKey[] = ['destination', 'endDestination'];
const LOCATION_SEARCH_DEBOUNCE_MS = 260;
const LOCATION_MIN_QUERY_LENGTH = 3;
const LOCATION_BLUR_CLOSE_DELAY_MS = 140;
const LOCATION_SUGGESTION_LIMIT = 6;
const LOCATION_COORDINATE_RESOLUTION_LIMIT = 1;

function createLocationSuggestionState(): LocationSuggestionState {
  return {
    results: [],
    loading: false,
    open: false,
    error: '',
    activeIndex: -1,
  };
}

function createLocationTimerRegistry(): LocationTimerRegistry {
  return {
    destination: null,
    endDestination: null,
  };
}

function createLocationRequestIds(): LocationRequestIds {
  return {
    destination: 0,
    endDestination: 0,
  };
}

function buildLocationSearchOptions(limit: number, proximity: LocationSearchAnchor | undefined): LocationSearchOptions {
  return {
    limit,
    proximity,
  } as LocationSearchOptions;
}

function resetSuggestionState(state: LocationSuggestionState): void {
  Object.assign(state, createLocationSuggestionState());
}

export function clearLocationTimer(timers: LocationTimerRegistry, field: LocationFieldKey): void {
  const timer = timers[field];
  if (timer) {
    clearTimeout(timer);
    timers[field] = null;
  }
}

export function useTripPlannerLocationSearch(options: UseTripPlannerLocationSearchOptions) {
  const locationSuggestions = reactive<Record<LocationFieldKey, LocationSuggestionState>>({
    destination: createLocationSuggestionState(),
    endDestination: createLocationSuggestionState(),
  });
  const locationSearchTimers = createLocationTimerRegistry();
  const locationBlurTimers = createLocationTimerRegistry();
  const locationRequestIds = createLocationRequestIds();

  function resetLocationSuggestionState(field: LocationFieldKey): void {
    clearLocationTimer(locationSearchTimers, field);
    clearLocationTimer(locationBlurTimers, field);
    locationRequestIds[field] += 1;
    resetSuggestionState(locationSuggestions[field]);
  }

  function shouldShowLocationSuggestions(field: LocationFieldKey): boolean {
    if (!options.canUseLocationField(field)) {
      return false;
    }

    const state = locationSuggestions[field];
    return state.open && (
      state.loading ||
      Boolean(state.error) ||
      state.results.length > 0 ||
      options.getLocationFieldValue(field).trim().length >= LOCATION_MIN_QUERY_LENGTH
    );
  }

  function scheduleLocationSearch(field: LocationFieldKey): void {
    const query = options.getLocationFieldValue(field).trim();
    const state = locationSuggestions[field];
    clearLocationTimer(locationSearchTimers, field);

    if (!options.canUseLocationField(field)) {
      state.results = [];
      state.loading = false;
      state.error = '';
      state.activeIndex = -1;
      return;
    }

    if (query.length < LOCATION_MIN_QUERY_LENGTH) {
      state.results = [];
      state.loading = false;
      state.error = '';
      state.activeIndex = -1;
      return;
    }

    state.loading = true;
    locationSearchTimers[field] = setTimeout(() => {
      void runLocationSearch(field, query);
    }, LOCATION_SEARCH_DEBOUNCE_MS);
  }

  async function runLocationSearch(field: LocationFieldKey, query: string): Promise<void> {
    if (!options.canUseLocationField(field)) {
      return;
    }

    const requestId = locationRequestIds[field] + 1;
    locationRequestIds[field] = requestId;
    const state = locationSuggestions[field];

    try {
      const response = await options.searchLocations(
        query,
        buildLocationSearchOptions(LOCATION_SUGGESTION_LIMIT, options.resolveLocationSearchProximity(field)),
      );
      if (locationRequestIds[field] !== requestId || options.getLocationFieldValue(field).trim() !== query) {
        return;
      }

      state.results = response.data;
      state.activeIndex = response.data.length ? 0 : -1;
      state.error = '';
    } catch {
      if (locationRequestIds[field] !== requestId) {
        return;
      }

      state.results = [];
      state.activeIndex = -1;
      state.error = 'Scope could not search places right now.';
    } finally {
      if (locationRequestIds[field] === requestId) {
        state.loading = false;
      }
    }
  }

  function handleLocationFocus(field: LocationFieldKey): void {
    if (!options.canUseLocationField(field)) {
      options.onBlockedLocationField(field);
      return;
    }

    clearLocationTimer(locationBlurTimers, field);
    locationSuggestions[field].open = true;
    scheduleLocationSearch(field);
  }

  function handleLocationBlur(field: LocationFieldKey): void {
    clearLocationTimer(locationBlurTimers, field);
    locationBlurTimers[field] = setTimeout(() => {
      locationSuggestions[field].open = false;
    }, LOCATION_BLUR_CLOSE_DELAY_MS);
  }

  function handleLocationInput(field: LocationFieldKey): void {
    if (!options.canUseLocationField(field)) {
      options.onBlockedLocationField(field);
      return;
    }

    options.clearLocationCoordinates(field);
    locationSuggestions[field].open = true;
    locationSuggestions[field].error = '';
    scheduleLocationSearch(field);
    options.onLocationInput(field);
  }

  function selectLocationSuggestion(field: LocationFieldKey, result: GeocodeResult): void {
    if (!options.canUseLocationField(field)) {
      options.onBlockedLocationField(field);
      return;
    }

    const label = options.resolveLocationSuggestionLabel(result);
    options.setLocationFieldValue(field, label);
    options.setLocationCoordinates(field, result);
    locationSuggestions[field].results = [result];
    locationSuggestions[field].activeIndex = 0;
    locationSuggestions[field].open = false;
    locationSuggestions[field].loading = false;
    locationSuggestions[field].error = '';
  }

  function findMatchingLocationSuggestion(field: LocationFieldKey, query: string): GeocodeResult | undefined {
    const normalizedQuery = query.toLowerCase();
    return locationSuggestions[field].results.find((result) => {
      const title = options.formatLocationSuggestionTitle(result).toLowerCase();
      const label = options.resolveLocationSuggestionLabel(result).toLowerCase();
      return title === normalizedQuery || label === normalizedQuery;
    });
  }

  async function resolveLocationFieldCoordinates(field: LocationFieldKey): Promise<void> {
    if (!options.canUseLocationField(field)) {
      options.onBlockedLocationField(field);
      return;
    }

    const query = options.getLocationFieldValue(field).trim();
    if (query.length < LOCATION_MIN_QUERY_LENGTH || options.hasLocationCoordinates(field)) {
      return;
    }

    clearLocationTimer(locationSearchTimers, field);
    locationSuggestions[field].loading = false;

    let resolvedResult = findMatchingLocationSuggestion(field, query);
    if (!resolvedResult) {
      const response = await options.searchLocations(
        query,
        buildLocationSearchOptions(LOCATION_COORDINATE_RESOLUTION_LIMIT, options.resolveLocationSearchProximity(field)),
      ).catch(() => null);
      resolvedResult = response?.data?.[0];
    }

    if (!resolvedResult || options.getLocationFieldValue(field).trim() !== query) {
      return;
    }

    selectLocationSuggestion(field, resolvedResult);
  }

  async function resolveMissingLocationCoordinates(fields: LocationFieldKey[] = LOCATION_FIELDS): Promise<void> {
    await Promise.all(fields.map((field) => resolveLocationFieldCoordinates(field)));
  }

  function handleLocationKeydown(field: LocationFieldKey, event: KeyboardEvent): void {
    const state = locationSuggestions[field];
    const resultsCount = state.results.length;

    if (event.key === 'Escape') {
      state.open = false;
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      state.open = true;
      state.activeIndex = resultsCount ? (state.activeIndex + 1 + resultsCount) % resultsCount : -1;
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      state.open = true;
      state.activeIndex = resultsCount ? (state.activeIndex - 1 + resultsCount) % resultsCount : -1;
      return;
    }

    if (event.key === 'Enter' && state.open && state.activeIndex >= 0) {
      const selectedResult = state.results[state.activeIndex];
      if (selectedResult) {
        event.preventDefault();
        selectLocationSuggestion(field, selectedResult);
      }
    }
  }

  function disposeLocationSearch(): void {
    LOCATION_FIELDS.forEach((field) => {
      clearLocationTimer(locationSearchTimers, field);
      clearLocationTimer(locationBlurTimers, field);
      locationRequestIds[field] += 1;
    });
  }

  return {
    locationSuggestions,
    resetLocationSuggestionState,
    shouldShowLocationSuggestions,
    scheduleLocationSearch,
    runLocationSearch,
    handleLocationFocus,
    handleLocationBlur,
    handleLocationInput,
    selectLocationSuggestion,
    findMatchingLocationSuggestion,
    resolveLocationFieldCoordinates,
    resolveMissingLocationCoordinates,
    handleLocationKeydown,
    disposeLocationSearch,
  };
}
