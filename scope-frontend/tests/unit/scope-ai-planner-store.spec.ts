import { createPinia, setActivePinia } from 'pinia';
import { flushPromises } from '@vue/test-utils';
import { useScopeAiPlannerStore } from '@/stores/scopeAiPlanner';

const geocodeMock = vi.hoisted(() => vi.fn());
const searchLocationsMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/mapService', () => ({
  geocode: geocodeMock,
  searchLocations: searchLocationsMock,
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

describe('scope AI planner store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    geocodeMock.mockReset();
    searchLocationsMock.mockReset();
    geocodeMock.mockResolvedValue({ data: [] });
    searchLocationsMock.mockResolvedValue({ data: [] });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets planner fields from SET_FIELD actions', () => {
    const store = useScopeAiPlannerStore();

    store.applyActionBlock({
      actions: [
        { type: 'SET_FIELD', field: 'start', value: 'Dallas' },
        { type: 'SET_FIELD', field: 'end', value: 'Austin' },
        { type: 'SET_FIELD', field: 'budget_min', value: 300 },
        { type: 'SET_FIELD', field: 'budget_max', value: 900 },
        { type: 'SET_FIELD', field: 'pace', value: 'packed' },
        { type: 'SET_FIELD', field: 'theme', value: ['food', 'scenic'] },
        { type: 'SET_FIELD', field: 'date', value: '2026-05-08' },
        { type: 'SET_FIELD', field: 'end_date', value: '2026-05-10' },
        { type: 'SET_FIELD', field: 'party_size', value: 4 },
      ],
    });

    expect(store.plannerState).toMatchObject({
      start: 'Dallas',
      end: 'Austin',
      budget_min: 300,
      budget_max: 900,
      pace: 'packed',
      theme: ['food', 'scenic'],
      date: '2026-05-08',
      end_date: '2026-05-10',
      party_size: 4,
    });
  });

  it('keeps budget ranges valid when a max-budget action falls below the stored minimum', () => {
    const store = useScopeAiPlannerStore();

    store.applyActionBlock({
      actions: [
        { type: 'SET_FIELD', field: 'budget_min', value: 500 },
        { type: 'SET_FIELD', field: 'budget_max', value: 1500 },
      ],
    });
    store.applyActionBlock({
      actions: [{ type: 'SET_FIELD', field: 'budget_max', value: 400 }],
    });

    expect(store.plannerState.budget_min).toBe(400);
    expect(store.plannerState.budget_max).toBe(400);
  });

  it('clamps negative budget actions to zero and keeps the range ordered', () => {
    const store = useScopeAiPlannerStore();

    store.applyActionBlock({
      actions: [
        { type: 'SET_FIELD', field: 'budget_min', value: 300 },
        { type: 'SET_FIELD', field: 'budget_max', value: -20 },
      ],
    });

    expect(store.plannerState.budget_min).toBe(0);
    expect(store.plannerState.budget_max).toBe(0);
  });

  it('rejects invalid pace values without crashing', () => {
    const store = useScopeAiPlannerStore();

    expect(store.applyActionBlock({
      actions: [{ type: 'SET_FIELD', field: 'pace', value: 'fast' }],
    })).toBe(true);

    expect(store.plannerState.pace).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it.each(['groupSize', 'group_size', 'travelers'])('maps %s aliases to the planner travel party', (field) => {
    const store = useScopeAiPlannerStore();

    store.applyActionBlock({
      actions: [{ type: 'SET_FIELD', field, value: 2 }],
    });

    expect(store.plannerState.party_size).toBe(2);
  });

  it('adds a stop and reindexes positions', () => {
    const store = useScopeAiPlannerStore();

    store.applyActionBlock({
      actions: [
        {
          type: 'ADD_STOP',
          stop: {
            id: 'stop-a',
            name: 'Museum',
            address: '1 Museum Way',
            type: 'culture',
            estimated_cost: 20,
            estimated_duration_minutes: 90,
            notes: 'Main attraction',
            position: 1,
          },
        },
      ],
    });

    expect(store.plannerState.stops).toEqual([
      expect.objectContaining({
        id: 'stop-a',
        name: 'Museum',
        position: 1,
      }),
    ]);
    expect(geocodeMock).toHaveBeenCalledWith('1 Museum Way Museum', 1);
  });

  it('inserts a stop at a specific position', () => {
    const store = useScopeAiPlannerStore();

    store.applyActionBlock({
      actions: [
        { type: 'ADD_STOP', stop: { id: 'a', name: 'A', address: 'A address', type: 'food', estimated_cost: 10, estimated_duration_minutes: 60, notes: '', position: 1 } },
        { type: 'ADD_STOP', stop: { id: 'c', name: 'C', address: 'C address', type: 'scenic', estimated_cost: 0, estimated_duration_minutes: 30, notes: '', position: 2 } },
      ],
    });
    store.applyActionBlock({
      actions: [
        { type: 'ADD_STOP', stop: { id: 'b', name: 'B', address: 'B address', type: 'culture', estimated_cost: 15, estimated_duration_minutes: 45, notes: '', position: 2 } },
      ],
    });

    expect(store.plannerState.stops.map((stop) => `${stop.position}:${stop.id}`)).toEqual(['1:a', '2:b', '3:c']);
  });

  it('removes a stop and reindexes', () => {
    const store = useScopeAiPlannerStore();
    store.applyActionBlock({
      actions: [
        { type: 'ADD_STOP', stop: { id: 'a', name: 'A', address: '', type: 'food', estimated_cost: 0, estimated_duration_minutes: 0, notes: '', position: 1 } },
        { type: 'ADD_STOP', stop: { id: 'b', name: 'B', address: '', type: 'scenic', estimated_cost: 0, estimated_duration_minutes: 0, notes: '', position: 2 } },
      ],
    });

    store.applyActionBlock({ actions: [{ type: 'REMOVE_STOP', stop_id: 'a' }] });

    expect(store.plannerState.stops.map((stop) => `${stop.position}:${stop.id}`)).toEqual(['1:b']);
  });

  it('reorders stops by id', () => {
    const store = useScopeAiPlannerStore();
    store.applyActionBlock({
      actions: [
        { type: 'ADD_STOP', stop: { id: 'a', name: 'A', address: '', type: 'food', estimated_cost: 0, estimated_duration_minutes: 0, notes: '', position: 1 } },
        { type: 'ADD_STOP', stop: { id: 'b', name: 'B', address: '', type: 'scenic', estimated_cost: 0, estimated_duration_minutes: 0, notes: '', position: 2 } },
        { type: 'ADD_STOP', stop: { id: 'c', name: 'C', address: '', type: 'culture', estimated_cost: 0, estimated_duration_minutes: 0, notes: '', position: 3 } },
      ],
    });

    store.applyActionBlock({ actions: [{ type: 'REORDER_STOPS', new_order: ['c', 'a'] }] });

    expect(store.plannerState.stops.map((stop) => `${stop.position}:${stop.id}`)).toEqual(['1:c', '2:a', '3:b']);
  });

  it('merges stop updates', () => {
    const store = useScopeAiPlannerStore();
    store.applyActionBlock({
      actions: [
        { type: 'ADD_STOP', stop: { id: 'a', name: 'A', address: '', type: 'food', estimated_cost: 10, estimated_duration_minutes: 30, notes: '', position: 1 } },
      ],
    });

    store.applyActionBlock({
      actions: [{ type: 'UPDATE_STOP', stop_id: 'a', updates: { notes: 'Updated', estimated_cost: 25 } }],
    });

    expect(store.plannerState.stops[0]).toMatchObject({
      notes: 'Updated',
      estimated_cost: 25,
    });
  });

  it('clears nullable and array fields', () => {
    const store = useScopeAiPlannerStore();
    store.applyActionBlock({
      actions: [
        { type: 'SET_FIELD', field: 'start', value: 'Dallas' },
        { type: 'SET_FIELD', field: 'theme', value: ['food'] },
        { type: 'ADD_STOP', stop: { id: 'a', name: 'A', address: '', type: 'food', estimated_cost: 0, estimated_duration_minutes: 0, notes: '', position: 1 } },
      ],
    });

    store.applyActionBlock({
      actions: [
        { type: 'CLEAR_FIELD', field: 'start' },
        { type: 'CLEAR_FIELD', field: 'theme' },
        { type: 'CLEAR_FIELD', field: 'stops' },
      ],
    });

    expect(store.plannerState.start).toBeNull();
    expect(store.plannerState.theme).toEqual([]);
    expect(store.plannerState.stops).toEqual([]);
  });

  it('reports derived route state and keeps exported planner snapshots immutable', () => {
    const store = useScopeAiPlannerStore();

    expect(store.hasRoute).toBe(false);
    expect(store.applyActionBlock(null)).toBe(false);

    store.applyActionBlock({ actions: [{ type: 'SET_FIELD', field: 'start', value: 'Dallas' }] });
    expect(store.hasRoute).toBe(true);

    const snapshot = store.stateAsJson;
    snapshot.start = 'Mutated';
    expect(store.plannerState.start).toBe('Dallas');

    store.trackAcceptedType(' food ');
    store.trackAcceptedType('food');
    store.trackAcceptedType('   ');
    store.trackRejectedType('nightlife');
    store.trackRejectedType('nightlife');
    store.trackRejectedType('   ');

    expect(store.preferences.preferred_types).toEqual(['food']);
    expect(store.preferences.rejected_types).toEqual(['nightlife']);
    expect(store.preferences.accept_streak).toBe(0);
  });

  it('seeds preferred stop types from account vibes without overriding rejections', () => {
    const store = useScopeAiPlannerStore();

    store.trackRejectedType('nightlife');
    store.seedPreferredTypes(['food', 'scenic', 'food', 'nightlife', '']);

    expect(store.preferences.preferred_types).toEqual(['food', 'scenic']);
    expect(store.preferences.rejected_types).toEqual(['nightlife']);
  });

  it('no-ops empty resolved blocks, undo without history, and endpoint clears with coordinates', async () => {
    const store = useScopeAiPlannerStore();

    expect(await store.applyActionBlockResolved(undefined)).toEqual({
      applied: false,
      resolutions: [],
    });

    store.applyActionBlock({ actions: [{ type: 'UNDO' }] });
    expect(store.preferences.undo_counts.last).toBeUndefined();

    store.hydrateFromPlannerDraft({
      destination: 'Dallas, TX',
      destinationLatitude: 32.7767,
      destinationLongitude: -96.797,
      endDestination: 'Austin, TX',
      endDestinationLatitude: 30.2672,
      endDestinationLongitude: -97.7431,
      startDate: '2026-05-17',
      endDate: '2026-05-19',
      budgetFloor: 500,
      budget: 1500,
      interests: [],
      pace: 'relaxed',
      groupSize: 2,
    }, []);

    const result = await store.applyActionBlockResolved({
      actions: [
        { type: 'SET_FIELD', field: 'start', value: '' },
        { type: 'CLEAR_FIELD', field: 'end' },
      ],
    });

    expect(result).toEqual({ applied: true, resolutions: [] });
    expect(store.plannerState.start).toBeNull();
    expect(store.plannerState.startLatitude).toBeUndefined();
    expect(store.plannerState.end).toBeNull();
    expect(store.plannerState.endLatitude).toBeUndefined();
  });

  it('logs invalid AI field payloads without applying unsafe planner mutations', () => {
    const store = useScopeAiPlannerStore();

    expect(store.applyActionBlock({
      actions: [
        { type: 'SET_FIELD', field: 'theme', value: ['food', 42] },
        { type: 'SET_FIELD', field: 'fuel_type', value: 'rocket' },
        { type: 'SET_FIELD', field: 'stops', value: 'not stops' },
        { type: 'SET_FIELD', field: 'unknown_field', value: 'surprise' },
        { type: 'CLEAR_FIELD', field: 'unknown_field' },
        { type: 'UPDATE_STOP', stop_id: 'missing', updates: { notes: 'No-op' } },
      ],
    })).toBe(true);

    expect(store.plannerState.theme).toEqual([]);
    expect(store.plannerState.fuel_type).toBeNull();
    expect(store.plannerState.stops).toEqual([]);
    expect(console.error).toHaveBeenCalledTimes(5);
  });

  it('ignores stale endpoint geocode responses after Scout AI changes the same field again', async () => {
    const store = useScopeAiPlannerStore();
    const dallasLookup = createDeferred<{ data: Array<{ placeName: string; latitude: number; longitude: number }> }>();
    const austinLookup = createDeferred<{ data: Array<{ formattedAddress: string; latitude: number; longitude: number }> }>();
    geocodeMock
      .mockReturnValueOnce(dallasLookup.promise)
      .mockReturnValueOnce(austinLookup.promise);

    store.applyActionBlock({ actions: [{ type: 'SET_FIELD', field: 'start', value: 'Dallas' }] });
    store.applyActionBlock({ actions: [{ type: 'SET_FIELD', field: 'start', value: 'Austin' }] });

    dallasLookup.resolve({
      data: [{ placeName: 'Dallas, Texas, United States', latitude: 32.7767, longitude: -96.797 }],
    });
    await flushPromises();

    expect(store.plannerState.start).toBe('Austin');
    expect(store.plannerState.startLatitude).toBeUndefined();
    expect(store.plannerState.startLongitude).toBeUndefined();

    austinLookup.resolve({
      data: [{ formattedAddress: 'Austin, Texas, United States', latitude: 30.2672, longitude: -97.7431 }],
    });
    await flushPromises();

    expect(store.plannerState.start).toBe('Austin, Texas, United States');
    expect(store.plannerState.startLatitude).toBe(30.2672);
    expect(store.plannerState.startLongitude).toBe(-97.7431);
  });

  it('clamps Scout AI fuel fields and clears combustion values for EV routes', () => {
    const store = useScopeAiPlannerStore();

    store.applyActionBlock({
      actions: [
        { type: 'SET_FIELD', field: 'fuel_type', value: 'diesel' },
        { type: 'SET_FIELD', field: 'mpg', value: 250 },
        { type: 'SET_FIELD', field: 'gas_price', value: 100 },
      ],
    });

    expect(store.plannerState.fuel_type).toBe('diesel');
    expect(store.plannerState.mpg).toBe(100);
    expect(store.plannerState.gas_price).toBe(20);

    store.applyActionBlock({
      actions: [{ type: 'SET_FIELD', field: 'fuel_type', value: 'ev' }],
    });

    expect(store.plannerState.fuel_type).toBe('ev');
    expect(store.plannerState.mpg).toBeNull();
    expect(store.plannerState.gas_price).toBeNull();
  });

  it('records and clears pending packing edits from Scout AI action blocks', () => {
    const store = useScopeAiPlannerStore();

    store.applyActionBlock({
      actions: [
        { type: 'ADD_PACKING_ITEM', label: '  Rain shell  ' },
        { type: 'ADD_PACKING_ITEM', label: '' },
        { type: 'REMOVE_PACKING_ITEM', item_id: ' sunscreen ' },
        { type: 'REMOVE_PACKING_ITEM', item_id: '' },
      ],
    });

    expect(store.pendingPackingActions).toEqual([
      { type: 'add', label: 'Rain shell' },
      { type: 'remove', id: 'sunscreen' },
    ]);

    store.clearPendingPackingActions();

    expect(store.pendingPackingActions).toEqual([]);
  });

  it('restores the previous planner state on UNDO', () => {
    const store = useScopeAiPlannerStore();
    store.applyActionBlock({ actions: [{ type: 'SET_FIELD', field: 'start', value: 'Dallas' }] });
    store.applyActionBlock({ actions: [{ type: 'SET_FIELD', field: 'end', value: 'Austin' }] });

    store.applyActionBlock({ actions: [{ type: 'UNDO' }] });

    expect(store.plannerState.start).toBe('Dallas');
    expect(store.plannerState.end).toBeNull();
    expect(store.preferences.undo_counts.last).toBe(1);
  });

  it('applies multiple actions in one block', () => {
    const store = useScopeAiPlannerStore();

    store.applyActionBlock({
      actions: [
        { type: 'SET_FIELD', field: 'start', value: 'Dallas' },
        { type: 'SET_FIELD', field: 'end', value: 'Austin' },
        { type: 'ADD_STOP', stop: { id: 'waco', name: 'Waco Stop', address: 'Waco', type: 'food', estimated_cost: 30, estimated_duration_minutes: 60, notes: '', position: 1 } },
      ],
    });

    expect(store.plannerState.start).toBe('Dallas');
    expect(store.plannerState.end).toBe('Austin');
    expect(store.plannerState.stops).toHaveLength(1);
  });

  it('waits for endpoint resolution before applying Scope AI endpoint actions', async () => {
    const store = useScopeAiPlannerStore();
    searchLocationsMock.mockResolvedValueOnce({
      data: [{
        placeName: '100 Example Road',
        formattedAddress: '100 Example Road, Example City, Texas 11111, United States',
        latitude: 39.0001,
        longitude: -96.0001,
        city: 'Example City',
        country: 'United States',
        source: 'mapbox',
      }],
    });

    const result = await store.applyActionBlockResolved({
      actions: [{ type: 'SET_FIELD', field: 'start', value: '100 example road' }],
    });

    expect(searchLocationsMock).toHaveBeenCalledWith('100 example road', expect.objectContaining({
      limit: 3,
      sortByDistance: false,
    }));
    expect(result.resolutions[0]).toMatchObject({
      field: 'start',
      rawValue: '100 example road',
      status: 'resolved',
      resolvedLabel: '100 Example Road, Example City, Texas 11111, United States',
    });
    expect(store.plannerState.start).toBe('100 Example Road, Example City, Texas 11111, United States');
    expect(store.plannerState.startLatitude).toBe(39.0001);
    expect(store.plannerState.startLongitude).toBe(-96.0001);
  });

  it('requires a typed ZIP code to match the provider address before applying an endpoint', async () => {
    const store = useScopeAiPlannerStore();
    searchLocationsMock.mockResolvedValueOnce({
      data: [{
        placeName: '100 Example Road',
        formattedAddress: '100 Example Road, Example City, Texas 11111, United States',
        latitude: 39.0001,
        longitude: -96.0001,
        city: 'Example City',
        country: 'United States',
        source: 'mapbox',
      }],
    });

    const result = await store.applyActionBlockResolved({
      actions: [{ type: 'SET_FIELD', field: 'start', value: '100 Example Road 99999' }],
    });

    expect(result.resolutions[0]).toMatchObject({
      field: 'start',
      rawValue: '100 Example Road 99999',
      status: 'ambiguous',
      candidates: ['100 Example Road, Example City, Texas 11111, United States'],
    });
    expect(store.plannerState.start).toBeNull();
    expect(store.plannerState.startLatitude).toBeUndefined();
  });

  it('does not invent a ZIP when the provider omits it from the resolved address', async () => {
    const store = useScopeAiPlannerStore();
    searchLocationsMock.mockResolvedValueOnce({
      data: [{
        placeName: '5555 Zipless Road',
        formattedAddress: '5555 Zipless Road, Example City, Texas, United States',
        latitude: 39.0100,
        longitude: -96.0100,
        city: 'Example City',
        country: 'United States',
        source: 'mapbox',
      }],
    });

    const result = await store.applyActionBlockResolved({
      actions: [{ type: 'SET_FIELD', field: 'start', value: '5555 Zipless Road' }],
    });

    expect(result.resolutions[0]).toMatchObject({
      field: 'start',
      status: 'resolved',
      resolvedLabel: '5555 Zipless Road, Example City, Texas, United States',
    });
    expect(store.plannerState.start).toBe('5555 Zipless Road, Example City, Texas, United States');
    expect(store.plannerState.start).not.toContain('11111');
  });

  it('requires a provider ZIP when the user typed one and the provider omitted it', async () => {
    const store = useScopeAiPlannerStore();
    searchLocationsMock.mockResolvedValueOnce({
      data: [{
        placeName: '5555 Zipless Road',
        formattedAddress: '5555 Zipless Road, Example City, Texas, United States',
        latitude: 39.0100,
        longitude: -96.0100,
        city: 'Example City',
        country: 'United States',
        source: 'mapbox',
      }],
    });

    const result = await store.applyActionBlockResolved({
      actions: [{ type: 'SET_FIELD', field: 'start', value: '5555 Zipless Road 11111' }],
    });

    expect(result.resolutions[0]).toMatchObject({
      field: 'start',
      status: 'ambiguous',
      candidates: ['5555 Zipless Road, Example City, Texas, United States'],
    });
    expect(store.plannerState.start).toBeNull();
  });

  it('asks for clarification instead of applying ambiguous raw endpoint text', async () => {
    const store = useScopeAiPlannerStore();
    searchLocationsMock.mockResolvedValueOnce({
      data: [
        {
          placeName: 'Example Road',
          formattedAddress: 'Example Road, Houston, Texas, United States',
          latitude: 29.7604,
          longitude: -95.3698,
          source: 'mapbox',
        },
        {
          placeName: 'Example Road',
          formattedAddress: 'Example Road, Arlington, Texas, United States',
          latitude: 32.7357,
          longitude: -97.1081,
          source: 'mapbox',
        },
      ],
    });

    const result = await store.applyActionBlockResolved({
      actions: [{ type: 'SET_FIELD', field: 'start', value: 'example road' }],
    });

    expect(result.resolutions[0]).toMatchObject({
      field: 'start',
      rawValue: 'example road',
      status: 'ambiguous',
    });
    expect(store.plannerState.start).toBeNull();
    expect(store.plannerState.startLatitude).toBeUndefined();
  });

  it('asks for clarification when a specific address has multiple plausible matches', async () => {
    const store = useScopeAiPlannerStore();
    searchLocationsMock.mockResolvedValueOnce({
      data: [
        {
          placeName: '100 Main Street',
          formattedAddress: '100 Main Street, Fort Worth, Texas 76116, United States',
          latitude: 32.7357,
          longitude: -97.3975,
          source: 'mapbox',
        },
        {
          placeName: '100 Main Street',
          formattedAddress: '100 Main Street, Houston, Texas 77030, United States',
          latitude: 29.7041,
          longitude: -95.4018,
          source: 'mapbox',
        },
      ],
    });

    const result = await store.applyActionBlockResolved({
      actions: [{ type: 'SET_FIELD', field: 'end', value: '100 Main Street' }],
    });

    expect(result.resolutions[0]).toMatchObject({
      field: 'end',
      rawValue: '100 Main Street',
      status: 'ambiguous',
      candidates: [
        '100 Main Street, Fort Worth, Texas 76116, United States',
        '100 Main Street, Houston, Texas 77030, United States',
      ],
    });
    expect(store.plannerState.end).toBeNull();
    expect(store.plannerState.endLatitude).toBeUndefined();
  });

  it('uses a strong route-biased provider match for address-only duplicate candidates', async () => {
    const store = useScopeAiPlannerStore();
    store.hydrateFromPlannerDraft({
      destination: '100 Example Road, Example City, Texas 11111, United States',
      destinationLatitude: 39.0001,
      destinationLongitude: -96.0001,
      endDestination: '',
      startDate: '2026-05-17',
      endDate: '2026-05-17',
      budgetFloor: 500,
      budget: 1500,
      interests: [],
      pace: 'relaxed',
      groupSize: 2,
    }, []);
    searchLocationsMock.mockResolvedValueOnce({
      data: [
        {
          placeName: '200 Sample Avenue',
          formattedAddress: '200 Sample Avenue, Example City, Texas 11111, United States',
          latitude: 39.0005,
          longitude: -96.0005,
          distanceKm: 0.6,
          source: 'mapbox',
        },
        {
          placeName: '200 Sample Avenue',
          formattedAddress: '200 Sample Avenue, Other City, Louisiana 22222, United States',
          latitude: 29.984,
          longitude: -90.153,
          distanceKm: 720,
          source: 'mapbox',
        },
      ],
    });

    const result = await store.applyActionBlockResolved({
      actions: [{ type: 'SET_FIELD', field: 'start', value: '200 Sample Ave' }],
    });

    expect(searchLocationsMock).toHaveBeenCalledWith('200 Sample Ave', expect.objectContaining({
      limit: 3,
      proximity: {
        latitude: 39.0001,
        longitude: -96.0001,
      },
    }));
    expect(result.resolutions[0]).toMatchObject({
      field: 'start',
      rawValue: '200 Sample Ave',
      status: 'resolved',
      resolvedLabel: '200 Sample Avenue, Example City, Texas 11111, United States',
    });
    expect(store.plannerState.start).toBe('200 Sample Avenue, Example City, Texas 11111, United States');
    expect(store.plannerState.startLatitude).toBe(39.0005);
    expect(store.plannerState.startLongitude).toBe(-96.0005);
  });

  it('uses typed city state and ZIP to resolve the matching duplicate street address', async () => {
    const store = useScopeAiPlannerStore();
    store.hydrateFromPlannerDraft({
      destination: '100 Example Road, Example City, Texas 11111, United States',
      destinationLatitude: 39.0001,
      destinationLongitude: -96.0001,
      endDestination: '',
      startDate: '2026-05-17',
      endDate: '2026-05-17',
      budgetFloor: 500,
      budget: 1500,
      interests: [],
      pace: 'relaxed',
      groupSize: 2,
    }, []);
    searchLocationsMock.mockResolvedValueOnce({ data: [] });
    geocodeMock.mockResolvedValueOnce({
      data: [
        {
          placeName: '200 Sample Avenue',
          formattedAddress: '200 Sample Avenue, Example City, Texas 11111, United States',
          latitude: 39.0005,
          longitude: -96.0005,
        },
        {
          placeName: '200 Sample Avenue',
          formattedAddress: '200 Sample Avenue, Other City, Louisiana 22222, United States',
          latitude: 29.984,
          longitude: -90.153,
        },
      ],
    });

    const result = await store.applyActionBlockResolved({
      actions: [{ type: 'SET_FIELD', field: 'start', value: '200 Sample Ave, Example City, TX 11111' }],
    });

    expect(result.resolutions[0]).toMatchObject({
      field: 'start',
      rawValue: '200 Sample Ave, Example City, TX 11111',
      status: 'resolved',
      resolvedLabel: '200 Sample Avenue, Example City, Texas 11111, United States',
    });
    expect(store.plannerState.start).toBe('200 Sample Avenue, Example City, Texas 11111, United States');
  });

  it('uses a strong route-biased geocode fallback match for address-only duplicate candidates', async () => {
    const store = useScopeAiPlannerStore();
    store.hydrateFromPlannerDraft({
      destination: '100 Example Road, Example City, Texas 11111, United States',
      destinationLatitude: 39.0001,
      destinationLongitude: -96.0001,
      endDestination: '',
      startDate: '2026-05-17',
      endDate: '2026-05-17',
      budgetFloor: 500,
      budget: 1500,
      interests: [],
      pace: 'relaxed',
      groupSize: 2,
    }, []);
    searchLocationsMock.mockResolvedValueOnce({ data: [] });
    geocodeMock.mockResolvedValueOnce({
      data: [
        {
          placeName: '200 Sample Avenue',
          formattedAddress: '200 Sample Avenue, Example City, Texas 11111, United States',
          latitude: 39.0005,
          longitude: -96.0005,
        },
        {
          placeName: '200 Sample Avenue',
          formattedAddress: '200 Sample Avenue, Other City, Louisiana 22222, United States',
          latitude: 29.984,
          longitude: -90.153,
        },
      ],
    });

    const result = await store.applyActionBlockResolved({
      actions: [{ type: 'SET_FIELD', field: 'start', value: '200 Sample Ave' }],
    });

    expect(result.resolutions[0]).toMatchObject({
      field: 'start',
      rawValue: '200 Sample Ave',
      status: 'resolved',
      resolvedLabel: '200 Sample Avenue, Example City, Texas 11111, United States',
    });
    expect(store.plannerState.start).toBe('200 Sample Avenue, Example City, Texas 11111, United States');
  });

  it('does not apply unresolved endpoint text as a fake place', async () => {
    const store = useScopeAiPlannerStore();

    const result = await store.applyActionBlockResolved({
      actions: [{ type: 'SET_FIELD', field: 'end', value: 'somewhere impossible' }],
    });

    expect(result.resolutions[0]).toMatchObject({
      field: 'end',
      rawValue: 'somewhere impossible',
      status: 'not_found',
    });
    expect(store.plannerState.end).toBeNull();
  });

  it('resolves AI stop actions before adding them to the planner state', async () => {
    const store = useScopeAiPlannerStore();
    searchLocationsMock.mockResolvedValueOnce({
      data: [{
        placeName: 'Museum of the Western Prairie',
        formattedAddress: '1100 Memorial Drive, Altus, Oklahoma 73521, United States',
        latitude: 34.652,
        longitude: -99.306,
        city: 'Altus',
        country: 'United States',
        source: 'mapbox',
      }],
    });

    const result = await store.applyActionBlockResolved({
      actions: [{
        type: 'ADD_STOP',
        stop: {
          name: 'Museum of the Western Prairie',
          address: '1100 Memorial Drive, Altus, Oklahoma',
          type: 'culture',
          estimated_cost: 10,
          estimated_duration_minutes: 60,
          notes: 'Provider-verified stop.',
          position: 1,
        },
      }],
    });

    expect(result.resolutions[0]).toMatchObject({
      type: 'stop',
      field: 'stop',
      status: 'resolved',
      resolvedLabel: '1100 Memorial Drive, Altus, Oklahoma 73521, United States',
    });
    expect(store.plannerState.stops).toHaveLength(1);
    expect(store.plannerState.stops[0]).toMatchObject({
      name: 'Museum of the Western Prairie',
      address: '1100 Memorial Drive, Altus, Oklahoma 73521, United States',
      latitude: 34.652,
      longitude: -99.306,
    });
  });

  it('does not add ADD_STOP actions with model coordinates when provider lookup returns no results', async () => {
    const store = useScopeAiPlannerStore();

    const result = await store.applyActionBlockResolved({
      actions: [{
        type: 'ADD_STOP',
        stop: {
          name: 'Imaginary Overlook',
          address: 'No Provider Match',
          type: 'scenic',
          latitude: 35.123,
          longitude: -97.456,
        },
      }],
    });

    expect(searchLocationsMock).toHaveBeenCalledWith('No Provider Match Imaginary Overlook', expect.objectContaining({
      limit: 3,
    }));
    expect(result.resolutions[0]).toMatchObject({
      type: 'stop',
      field: 'stop',
      rawValue: 'No Provider Match Imaginary Overlook',
      status: 'not_found',
    });
    expect(store.plannerState.stops).toEqual([]);
  });

  it('uses provider coordinates instead of conflicting model coordinates for ADD_STOP actions', async () => {
    const store = useScopeAiPlannerStore();
    searchLocationsMock.mockResolvedValueOnce({
      data: [{
        placeName: 'Provider Plaza',
        formattedAddress: '1 Provider Way, Austin, Texas 78701, United States',
        latitude: 30.2672,
        longitude: -97.7431,
        city: 'Austin',
        country: 'United States',
        source: 'mapbox',
      }],
    });

    const result = await store.applyActionBlockResolved({
      actions: [{
        type: 'ADD_STOP',
        stop: {
          name: 'Provider Plaza',
          address: '1 Provider Way, Austin, TX',
          type: 'culture',
          latitude: 1.2345,
          longitude: 2.3456,
        },
      }],
    });

    expect(result.resolutions[0]).toMatchObject({
      type: 'stop',
      field: 'stop',
      status: 'resolved',
      resolvedLabel: '1 Provider Way, Austin, Texas 78701, United States',
    });
    expect(store.plannerState.stops).toHaveLength(1);
    expect(store.plannerState.stops[0]).toMatchObject({
      address: '1 Provider Way, Austin, Texas 78701, United States',
      latitude: 30.2672,
      longitude: -97.7431,
    });
  });

  it('rejects ADD_STOP actions with conflicting model coordinates when provider results are ambiguous', async () => {
    const store = useScopeAiPlannerStore();
    searchLocationsMock.mockResolvedValueOnce({
      data: [
        {
          placeName: 'Example Road',
          formattedAddress: 'Example Road, Houston, Texas, United States',
          latitude: 29.7604,
          longitude: -95.3698,
          source: 'mapbox',
        },
        {
          placeName: 'Example Road',
          formattedAddress: 'Example Road, Arlington, Texas, United States',
          latitude: 32.7357,
          longitude: -97.1081,
          source: 'mapbox',
        },
      ],
    });

    const result = await store.applyActionBlockResolved({
      actions: [{
        type: 'ADD_STOP',
        stop: {
          name: 'Example Road',
          type: 'scenic',
          latitude: 35.123,
          longitude: -97.456,
        },
      }],
    });

    expect(result.resolutions[0]).toMatchObject({
      type: 'stop',
      field: 'stop',
      rawValue: 'Example Road',
      status: 'ambiguous',
      candidates: [
        'Example Road, Houston, Texas, United States',
        'Example Road, Arlington, Texas, United States',
      ],
    });
    expect(store.plannerState.stops).toEqual([]);
  });

  it('does not trust mock provider fallback results for ADD_STOP verification', async () => {
    const store = useScopeAiPlannerStore();
    searchLocationsMock.mockResolvedValueOnce({
      data: [{
        placeName: 'Mock Stop',
        formattedAddress: 'Mock Stop, Demo City, United States',
        latitude: 35.123,
        longitude: -97.456,
        source: 'mock',
      }],
    });

    const result = await store.applyActionBlockResolved({
      actions: [{
        type: 'ADD_STOP',
        stop: {
          name: 'Mock Stop',
          address: 'Mock Stop',
          type: 'other',
          latitude: 35.123,
          longitude: -97.456,
        },
      }],
    });

    expect(result.resolutions[0]).toMatchObject({
      type: 'stop',
      field: 'stop',
      rawValue: 'Mock Stop Mock Stop',
      status: 'not_found',
      candidates: ['Mock Stop, Demo City, United States'],
    });
    expect(store.plannerState.stops).toEqual([]);
  });

  it('applies non-location actions while leaving ambiguous endpoints unresolved in a mixed block', async () => {
    const store = useScopeAiPlannerStore();
    searchLocationsMock
      .mockResolvedValueOnce({
        data: [
          {
            placeName: 'Example Road',
            formattedAddress: 'Example Road, Houston, Texas, United States',
            latitude: 29.7604,
            longitude: -95.3698,
            source: 'mapbox',
          },
          {
            placeName: 'Example Road',
            formattedAddress: 'Example Road, Arlington, Texas, United States',
            latitude: 32.7357,
            longitude: -97.1081,
            source: 'mapbox',
          },
        ],
      })
      .mockResolvedValueOnce({
        data: [
          {
            placeName: 'Main Street',
            formattedAddress: 'Main Street, Fort Worth, Texas, United States',
            latitude: 32.7555,
            longitude: -97.3308,
            source: 'mapbox',
          },
          {
            placeName: 'Main Street',
            formattedAddress: 'Main Street, Dallas, Texas, United States',
            latitude: 32.7767,
            longitude: -96.797,
            source: 'mapbox',
          },
        ],
      });

    const result = await store.applyActionBlockResolved({
      actions: [
        { type: 'SET_FIELD', field: 'start', value: 'example road' },
        { type: 'SET_FIELD', field: 'budget_max', value: 1200 },
        { type: 'SET_FIELD', field: 'party_size', value: 3 },
        { type: 'SET_FIELD', field: 'end', value: 'main street' },
      ],
    });

    expect(result.resolutions).toEqual([
      expect.objectContaining({
        type: 'endpoint',
        field: 'start',
        status: 'ambiguous',
      }),
      expect.objectContaining({
        type: 'endpoint',
        field: 'end',
        status: 'ambiguous',
      }),
    ]);
    expect(store.plannerState).toMatchObject({
      start: null,
      end: null,
      budget_max: 1200,
      party_size: 3,
    });
    expect(store.plannerState.startLatitude).toBeUndefined();
    expect(store.plannerState.endLatitude).toBeUndefined();
  });

  it('does not add unresolved AI stop actions as fake places', async () => {
    const store = useScopeAiPlannerStore();

    const result = await store.applyActionBlockResolved({
      actions: [{
        type: 'ADD_STOP',
        stop: {
          name: 'Totally Imaginary Stop',
          address: 'Nowhere impossible',
          type: 'other',
        },
      }],
    });

    expect(result.resolutions[0]).toMatchObject({
      type: 'stop',
      field: 'stop',
      status: 'not_found',
    });
    expect(store.plannerState.stops).toEqual([]);
  });

  it('uses the first mapped stop as proximity for unresolved endpoint searches', async () => {
    const store = useScopeAiPlannerStore();
    store.applyActionBlock({
      actions: [{
        type: 'ADD_STOP',
        stop: {
          id: 'waco-stop',
          name: 'Waco Stop',
          address: '',
          type: 'food',
          latitude: 31.5493,
          longitude: -97.1467,
          position: 1,
        },
      }],
    });
    searchLocationsMock.mockResolvedValueOnce({
      data: [{
        placeName: 'Austin',
        formattedAddress: 'Austin, Texas, United States',
        latitude: 30.2672,
        longitude: -97.7431,
        source: 'mapbox',
      }],
    });

    const result = await store.applyActionBlockResolved({
      actions: [{ type: 'SET_FIELD', field: 'end', value: 'Austin' }],
    });

    expect(searchLocationsMock).toHaveBeenCalledWith('Austin', expect.objectContaining({
      proximity: {
        latitude: 31.5493,
        longitude: -97.1467,
      },
    }));
    expect(result.resolutions[0]).toMatchObject({
      field: 'end',
      status: 'resolved',
      resolvedLabel: 'Austin, Texas, United States',
    });
    expect(store.plannerState.endLatitude).toBe(30.2672);
  });

  it('does not add default placeholder stop actions when provider verification finds nothing', async () => {
    const store = useScopeAiPlannerStore();

    const result = await store.applyActionBlockResolved({
      actions: [{
        type: 'ADD_STOP',
        stop: {
          name: '',
          address: '',
          type: 'other',
        },
      }],
    });

    expect(result.resolutions[0]).toMatchObject({
      type: 'stop',
      field: 'stop',
      rawValue: 'Suggested stop',
      status: 'not_found',
      candidates: [],
    });
    expect(searchLocationsMock).toHaveBeenCalledWith('Suggested stop', expect.objectContaining({ limit: 3 }));
    expect(store.plannerState.stops).toEqual([]);
  });

  it('skips invalid actions without crashing', () => {
    const store = useScopeAiPlannerStore();

    expect(store.applyActionBlock({
      actions: [
        { type: 'BOGUS_ACTION' },
        { type: 'SET_FIELD', field: 'start', value: 'Dallas' },
      ],
    })).toBe(true);

    expect(store.plannerState.start).toBe('Dallas');
    expect(console.error).toHaveBeenCalled();
  });

  it('hydrates from planner draft and maps moderate pace to standard', () => {
    const store = useScopeAiPlannerStore();

    store.hydrateFromPlannerDraft({
      destination: 'Fort Worth, TX',
      endDestination: 'Austin, TX',
      startDate: '2026-05-08',
      endDate: '2026-05-10',
      budgetFloor: 500,
      budget: 1500,
      interests: ['food', 'scenic'],
      pace: 'moderate',
      groupSize: 2,
    }, [
      {
        spotId: 'stop-1',
        title: 'Waco Lunch',
        latitude: 31.5493,
        longitude: -97.1467,
        category: 'food',
        estimatedCost: 40,
        duration: 75,
        notes: 'Midpoint meal',
      },
    ]);

    expect(store.plannerState).toMatchObject({
      start: 'Fort Worth, TX',
      end: 'Austin, TX',
      budget_min: 500,
      budget_max: 1500,
      pace: 'standard',
      theme: ['food', 'scenic'],
      date: '2026-05-08',
      party_size: 2,
    });
    expect(store.plannerState.stops[0]).toMatchObject({
      id: 'stop-1',
      name: 'Waco Lunch',
      type: 'food',
      estimated_cost: 40,
      estimated_duration_minutes: 75,
      position: 1,
    });
  });

  it('resets the session to defaults', () => {
    const store = useScopeAiPlannerStore();
    store.applyActionBlock({ actions: [{ type: 'SET_FIELD', field: 'start', value: 'Dallas' }] });
    store.addSessionEntry({ role: 'user', content: 'hello', actionBlock: null });
    store.trackAcceptedType('food');
    store.trackRejectedType('nightlife');
    store.setPendingScopeAiContext({
      kind: 'location-resolution',
      sourcePrompt: 'start at sample road',
      targetField: 'start',
      rawValue: 'sample road',
      candidates: [{ label: 'Sample Road, Example City', value: 'Sample Road, Example City' }],
      lastAnswer: 'Need a city.',
    });

    store.resetSession();

    expect(store.plannerState.start).toBeNull();
    expect(store.plannerState.stops).toEqual([]);
    expect(store.sessionHistory).toEqual([]);
    expect(store.preferences).toEqual({
      rejected_types: [],
      preferred_types: [],
      accept_streak: 0,
      undo_counts: {},
    });
    expect(store.undoStack).toEqual([]);
    expect(store.pendingScopeAiContext).toBeNull();
  });

  it('stores, increments, and expires pending Scope AI follow-up context', () => {
    const store = useScopeAiPlannerStore();

    store.setPendingScopeAiContext({
      kind: 'fuel-results',
      sourcePrompt: 'find fuel nearby',
      targetField: 'fuel',
      results: [{ label: 'Test Fuel - $3.10/gal', value: 'Test Fuel' }],
      lastAnswer: 'Fuel near the route.',
    });

    expect(store.pendingScopeAiContext).toMatchObject({
      kind: 'fuel-results',
      sourcePrompt: 'find fuel nearby',
      turnCount: 0,
    });

    store.incrementPendingScopeAiContextTurn();
    store.incrementPendingScopeAiContextTurn();
    expect(store.pendingScopeAiContext?.turnCount).toBe(2);

    store.incrementPendingScopeAiContextTurn();
    expect(store.pendingScopeAiContext).toBeNull();
  });

  it('covers endpoint proximity fallbacks, nullable field clears, and stop geocode updates', async () => {
    const store = useScopeAiPlannerStore();
    const resolvedPlace = (label: string, latitude: number, longitude: number) => ({
      id: label.toLowerCase().replace(/\s+/g, '-'),
      placeName: label,
      formattedAddress: `${label}, Texas, United States`,
      latitude,
      longitude,
      source: 'mapbox',
      sourceLabel: 'Mapbox',
      providerVerified: true,
    });

    store.plannerState.start = 'Fort Worth';
    store.plannerState.startLatitude = 32.7555;
    store.plannerState.startLongitude = -97.3308;
    searchLocationsMock.mockResolvedValueOnce({ data: [resolvedPlace('Arlington', 32.7357, -97.1081)] });
    await store.applyActionBlockResolved({
      actions: [{ type: 'SET_FIELD', field: 'start', value: 'Arlington' }],
    });
    expect(searchLocationsMock.mock.calls.at(-1)?.[1]).toMatchObject({
      proximity: { latitude: 32.7555, longitude: -97.3308 },
    });

    store.plannerState.end = 'Austin';
    store.plannerState.endLatitude = 30.2672;
    store.plannerState.endLongitude = -97.7431;
    searchLocationsMock.mockResolvedValueOnce({ data: [resolvedPlace('San Marcos', 29.8833, -97.9414)] });
    await store.applyActionBlockResolved({
      actions: [{ type: 'SET_FIELD', field: 'end', value: 'San Marcos' }],
    });
    expect(searchLocationsMock.mock.calls.at(-1)?.[1]).toMatchObject({
      proximity: { latitude: 30.2672, longitude: -97.7431 },
    });

    store.plannerState.startLatitude = undefined;
    store.plannerState.startLongitude = undefined;
    store.plannerState.endLatitude = 30.2672;
    store.plannerState.endLongitude = -97.7431;
    searchLocationsMock.mockResolvedValueOnce({ data: [resolvedPlace('Waco', 31.5493, -97.1467)] });
    await store.applyActionBlockResolved({
      actions: [{ type: 'SET_FIELD', field: 'start', value: 'Waco' }],
    });
    expect(searchLocationsMock.mock.calls.at(-1)?.[1]).toMatchObject({
      proximity: { latitude: 30.2672, longitude: -97.7431 },
    });

    store.plannerState.startLatitude = undefined;
    store.plannerState.startLongitude = undefined;
    store.plannerState.endLatitude = undefined;
    store.plannerState.endLongitude = undefined;
    store.applyActionBlock({
      actions: [{
        type: 'ADD_STOP',
        stop: {
          id: 'midpoint',
          name: 'Midpoint',
          latitude: 31.5,
          longitude: -97.1,
          type: 'food',
        },
      }],
    });
    searchLocationsMock.mockResolvedValueOnce({ data: [resolvedPlace('Dallas', 32.7767, -96.797)] });
    await store.applyActionBlockResolved({
      actions: [{ type: 'SET_FIELD', field: 'end', value: 'Dallas' }],
    });
    expect(searchLocationsMock.mock.calls.at(-1)?.[1]).toMatchObject({
      proximity: { latitude: 31.5, longitude: -97.1 },
    });

    store.applyActionBlock({
      actions: [
        { type: 'SET_FIELD', field: 'pace', value: null },
        { type: 'SET_FIELD', field: 'fuel_type', value: 'ev' },
        { type: 'SET_FIELD', field: 'fuel_type', value: null },
        { type: 'SET_FIELD', field: 'stops', value: [{ id: 'manual', name: 'Manual Stop', position: 3 }] },
        { type: 'CLEAR_FIELD', field: 'stops' },
        { type: 'CLEAR_FIELD', field: 'theme' },
        { type: 'UPDATE_STOP', stop_id: 'missing', updates: { name: 'No-op' } },
      ],
    });
    expect(store.plannerState.pace).toBeNull();
    expect(store.plannerState.fuel_type).toBeNull();
    expect(store.plannerState.stops).toEqual([]);

    geocodeMock.mockResolvedValueOnce({
      data: [{
        placeName: 'Resolved Stop',
        formattedAddress: '100 Resolved Road',
        latitude: 31.9,
        longitude: -97.2,
      }],
    });
    store.applyActionBlock({
      actions: [{
        type: 'ADD_STOP',
        stop: {
          id: 'needs-geocode',
          name: 'Resolved Stop',
          address: '',
          type: 'culture',
        },
      }],
    });
    await flushPromises();
    expect(store.plannerState.stops[0]).toMatchObject({
      latitude: 31.9,
      longitude: -97.2,
      address: '100 Resolved Road',
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    store.applyActionBlock({
      actions: [{ type: 'SET_FIELD', field: 'unknown_field', value: 'bad' }],
    });
    expect(consoleSpy).toHaveBeenCalled();
  });
});
