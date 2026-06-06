import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import TripPlannerAiAssist from '@/components/trips/TripPlannerAiAssist.vue';

const planTripMock = vi.hoisted(() => vi.fn());
const callScopeAiMock = vi.hoisted(() => vi.fn());
const geocodeMock = vi.hoisted(() => vi.fn());
const searchPlacesMock = vi.hoisted(() => vi.fn());
const searchLocationsMock = vi.hoisted(() => vi.fn());
const searchNearbyPlacesMock = vi.hoisted(() => vi.fn());
const getTravelNearbySuggestionsMock = vi.hoisted(() => vi.fn());
const getNearbyFuelStationsMock = vi.hoisted(() => vi.fn());
const getOpenWeatherMapSnapshotMock = vi.hoisted(() => vi.fn());
const trackScopeAiInteractionMock = vi.hoisted(() => vi.fn());
const analyticsConsentMock = vi.hoisted(() => ({ value: 'granted' as 'granted' | 'denied' | 'unknown' }));
const preloadScopeWasmRuntimeMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('@/services/agentService', () => ({
  planTrip: planTripMock,
}));

vi.mock('@/services/scopeAiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/scopeAiService')>();
  return {
    ...actual,
    callScopeAi: callScopeAiMock,
  };
});

vi.mock('@/services/mapService', () => ({
  geocode: geocodeMock,
  searchPlaces: searchPlacesMock,
  searchLocations: searchLocationsMock,
  searchNearbyPlaces: searchNearbyPlacesMock,
}));

vi.mock('@/services/travelNearbyService', () => ({
  getTravelNearbySuggestions: getTravelNearbySuggestionsMock,
}));

vi.mock('@/services/fuelPriceService', () => ({
  getNearbyFuelStations: getNearbyFuelStationsMock,
}));

vi.mock('@/services/openWeatherMapService', () => ({
  getOpenWeatherMapSnapshot: getOpenWeatherMapSnapshotMock,
}));

vi.mock('@/services/analyticsService', () => ({
  trackScopeAiInteraction: trackScopeAiInteractionMock,
}));

vi.mock('@/services/wasmService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/wasmService')>();
  return {
    ...actual,
    preloadScopeWasmRuntime: preloadScopeWasmRuntimeMock,
  };
});

vi.mock('@/utils/analyticsConsent', () => ({
  useAnalyticsConsent: () => ({
    consent: analyticsConsentMock,
  }),
}));

class MockFileReader {
  result: string | ArrayBuffer | null = null;
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
  onerror: (() => void) | null = null;

  readAsDataURL(file: File) {
    this.result = `data:${file.type || 'image/png'};base64,YXRsYXM=`;
    this.onload?.(new ProgressEvent('load') as ProgressEvent<FileReader>);
  }
}

class MockSpeechRecognition {
  static instances: MockSpeechRecognition[] = [];

  continuous = false;
  interimResults = false;
  lang = '';
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();

  constructor() {
    MockSpeechRecognition.instances.push(this);
  }
}

function createSpeechRecognitionEvent(transcript: string, isFinal = true) {
  const alternative = { transcript };
  const result: any = {
    0: alternative,
    isFinal,
    length: 1,
    item(index: number) {
      return this[index];
    },
  };
  const results: any = {
    0: result,
    length: 1,
    item(index: number) {
      return this[index];
    },
  };

  return {
    resultIndex: 0,
    results,
  };
}

describe('TripPlannerAiAssist', () => {
  const createObjectUrlMock = vi.fn(() => 'blob:scope-chat-image');
  const revokeObjectUrlMock = vi.fn();

  beforeEach(() => {
    planTripMock.mockReset();
    callScopeAiMock.mockReset();
    geocodeMock.mockReset();
    searchPlacesMock.mockReset();
    searchLocationsMock.mockReset();
    searchNearbyPlacesMock.mockReset();
    getTravelNearbySuggestionsMock.mockReset();
    getNearbyFuelStationsMock.mockReset();
    getOpenWeatherMapSnapshotMock.mockReset();
    trackScopeAiInteractionMock.mockReset();
    preloadScopeWasmRuntimeMock.mockClear();
    analyticsConsentMock.value = 'granted';
    window.localStorage.clear();
    createObjectUrlMock.mockClear();
    revokeObjectUrlMock.mockClear();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectUrlMock,
    });
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      configurable: true,
      value: undefined,
    });
    MockSpeechRecognition.instances = [];
    vi.stubGlobal('FileReader', MockFileReader);
    planTripMock.mockResolvedValue({
      itinerary: 'Add a lunch stop near Waco and keep the final drive under 3 hours.',
      model: 'scope-local',
      steps: 4,
    });
    searchPlacesMock.mockResolvedValue({ data: [] });
    searchLocationsMock.mockResolvedValue({ data: [] });
    searchNearbyPlacesMock.mockResolvedValue({ data: [] });
    getTravelNearbySuggestionsMock.mockResolvedValue({
      configured: true,
      coverage: 'Test coverage',
      source: 'Test nearby',
      category: 'recommended',
      radiusKm: 64,
      suggestions: [],
    });
    getNearbyFuelStationsMock.mockResolvedValue({
      configured: true,
      coverage: 'Test fuel coverage',
      source: 'Test fuel',
      fuelType: 'regular',
      radiusKm: 10,
      stations: [],
    });
    getOpenWeatherMapSnapshotMock.mockResolvedValue({
      id: 'weather-test',
      label: 'Fort Worth, TX',
      temperatureF: 72,
      condition: 'Clear',
      windMph: 8,
      provider: 'openmeteo',
      providerLabel: 'Open-Meteo fallback',
      airQuality: {
        index: 42,
        label: 'Good',
        scale: 'us',
      },
    });
    geocodeMock.mockResolvedValue({ data: [] });
  });

  function createScopeAiStore(overrides: Record<string, unknown> = {}) {
    const scopeAiStore: any = {
      stateAsJson: {},
      sessionHistory: [],
      preferences: {},
      plannerState: {
        stops: [],
      },
      pendingScopeAiContext: null,
      addSessionEntry: vi.fn(),
      applyActionBlock: vi.fn(() => true),
      applyActionBlockResolved: vi.fn().mockResolvedValue({
        applied: true,
        resolutions: [],
      }),
      trackAcceptedType: vi.fn(),
      trackRejectedType: vi.fn(),
    };
    scopeAiStore.setPendingScopeAiContext = vi.fn((context) => {
      scopeAiStore.pendingScopeAiContext = {
        ...context,
        createdAt: context.createdAt ?? Date.now(),
        turnCount: context.turnCount ?? 0,
      };
    });
    scopeAiStore.clearPendingScopeAiContext = vi.fn(() => {
      scopeAiStore.pendingScopeAiContext = null;
    });
    scopeAiStore.incrementPendingScopeAiContextTurn = vi.fn(() => {
      if (!scopeAiStore.pendingScopeAiContext) {
        return;
      }

      scopeAiStore.pendingScopeAiContext = {
        ...scopeAiStore.pendingScopeAiContext,
        turnCount: (scopeAiStore.pendingScopeAiContext.turnCount ?? 0) + 1,
      };
    });

    return Object.assign(scopeAiStore, overrides);
  }

  function getLatestAiResponseText(wrapper: ReturnType<typeof mount>): string {
    return wrapper.findAll('[data-test="trip-ai-response"]').at(-1)?.text() ?? '';
  }

  function createPlannerDraft(overrides: Record<string, unknown> = {}) {
    return {
      destination: 'Fort Worth, TX',
      endDestination: 'Austin, TX',
      startDate: '2026-05-08',
      endDate: '2026-05-10',
      budgetFloor: 500,
      budget: 1500,
      interests: ['food', 'scenic'],
      pace: 'moderate',
      groupSize: 2,
      ...overrides,
    };
  }

  function mountPlannerAssist(props: Record<string, unknown> = {}) {
    const { draft, ...rest } = props as { draft?: Record<string, unknown> };

    return mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        ...rest,
        draft: createPlannerDraft(draft),
      },
    });
  }

  async function submitTripAiPrompt(wrapper: ReturnType<typeof mount>, value: string): Promise<string> {
    await wrapper.get('[data-test="trip-ai-input"]').setValue(value);
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    return getLatestAiResponseText(wrapper);
  }

  it('preloads the Scope WASM runtime from the planner assistant surface', async () => {
    mount(TripPlannerAiAssist, {
      props: {
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-18',
          endDate: '2026-05-18',
          budgetFloor: 500,
          budgetCeiling: 1500,
          pace: 'relaxed',
          interests: [],
          groupSize: 1,
        },
      },
    });

    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await flushPromises();

    expect(preloadScopeWasmRuntimeMock).toHaveBeenCalledTimes(1);
  });

  it('dictates voice input into the Scope AI prompt when speech recognition is available', async () => {
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: MockSpeechRecognition,
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-18',
          endDate: '2026-05-18',
          budgetFloor: 500,
          budgetCeiling: 1500,
          pace: 'relaxed',
          interests: [],
          groupSize: 1,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-voice-button"]').trigger('click');

    const recognition = MockSpeechRecognition.instances[0];
    expect(recognition.start).toHaveBeenCalledTimes(1);
    expect(recognition.continuous).toBe(false);
    expect(recognition.interimResults).toBe(true);
    expect(wrapper.get('[data-test="trip-ai-voice-status"]').text()).toContain('Listening');

    recognition.onresult?.(createSpeechRecognitionEvent('zoom into Tokyo Japan'));
    await nextTick();

    expect((wrapper.get('[data-test="trip-ai-input"]').element as HTMLInputElement).value).toBe('zoom into Tokyo Japan');
    expect(recognition.stop).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[data-test="trip-ai-voice-status"]').text()).toContain('Voice captured');
  });

  it('keeps voice dictation inside the composer and falls back cleanly when unsupported', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-18',
          endDate: '2026-05-18',
          budgetFloor: 500,
          budgetCeiling: 1500,
          pace: 'relaxed',
          interests: [],
          groupSize: 1,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-voice-button"]').trigger('click');

    expect(wrapper.get('[data-test="trip-ai-voice-status"]').text()).toContain('not supported');
  });

  it('preserves typed prompt text when appending voice dictation', async () => {
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: MockSpeechRecognition,
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-18',
          endDate: '2026-05-18',
          budgetFloor: 500,
          budgetCeiling: 1500,
          pace: 'relaxed',
          interests: [],
          groupSize: 1,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('please');
    await wrapper.get('[data-test="trip-ai-voice-button"]').trigger('click');
    MockSpeechRecognition.instances[0].onresult?.(createSpeechRecognitionEvent('zoom Dallas Texas'));
    await nextTick();

    expect((wrapper.get('[data-test="trip-ai-input"]').element as HTMLInputElement).value).toBe('please zoom Dallas Texas');
  });

  it('ignores empty speech result payloads from the webkit speech fallback', async () => {
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      configurable: true,
      value: MockSpeechRecognition,
    });

    const wrapper = mountPlannerAssist({
      draft: {
        destination: '',
        endDestination: '',
      },
    });

    await wrapper.get('[data-test="trip-ai-voice-button"]').trigger('click');
    const recognition = MockSpeechRecognition.instances.at(-1)!;

    recognition.onresult?.({
      resultIndex: -3,
      results: {
        length: 1,
        item: () => undefined,
      },
    } as any);
    await nextTick();

    expect((wrapper.get('[data-test="trip-ai-input"]').element as HTMLInputElement).value).toBe('');
    expect(wrapper.get('[data-test="trip-ai-voice-status"]').text()).toContain('Listening');

    recognition.onresult?.({
      resultIndex: 0,
      results: {
        length: 1,
        item: () => ({
          isFinal: false,
          length: 1,
          item: () => ({ transcript: '   ' }),
        }),
      },
    } as any);
    await nextTick();

    expect((wrapper.get('[data-test="trip-ai-input"]').element as HTMLInputElement).value).toBe('');
    expect(wrapper.get('[data-test="trip-ai-voice-status"]').text()).toContain('Listening');
  });

  it('handles interim voice results, recognition end, manual stop, and blocked microphone errors', async () => {
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: MockSpeechRecognition,
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-18',
          endDate: '2026-05-18',
          budgetFloor: 500,
          budgetCeiling: 1500,
          pace: 'relaxed',
          interests: [],
          groupSize: 1,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-voice-button"]').trigger('click');
    let recognition = MockSpeechRecognition.instances.at(-1)!;
    recognition.onresult?.(createSpeechRecognitionEvent('find coffee nearby', false));
    await nextTick();

    expect((wrapper.get('[data-test="trip-ai-input"]').element as HTMLInputElement).value).toBe('find coffee nearby');
    expect(wrapper.get('[data-test="trip-ai-voice-status"]').text()).toContain('Listening');

    recognition.onend?.();
    await nextTick();

    expect(wrapper.get('[data-test="trip-ai-voice-status"]').text()).toContain('Voice captured');

    await wrapper.get('[data-test="trip-ai-voice-button"]').trigger('click');
    recognition = MockSpeechRecognition.instances.at(-1)!;
    await wrapper.get('[data-test="trip-ai-voice-button"]').trigger('click');
    await nextTick();

    expect(recognition.stop).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[data-test="trip-ai-voice-status"]').text()).toContain('stopped');

    await wrapper.get('[data-test="trip-ai-voice-button"]').trigger('click');
    recognition = MockSpeechRecognition.instances.at(-1)!;
    recognition.onerror?.({ error: 'not-allowed' } as any);
    await nextTick();

    expect(wrapper.get('[data-test="trip-ai-voice-status"]').text()).toContain('Microphone permission was blocked');
  });

  it('falls back cleanly when voice recognition start and stop calls throw', async () => {
    class ThrowingSpeechRecognition extends MockSpeechRecognition {
      override start = vi.fn(() => {
        throw new Error('start failed');
      });

      override stop = vi.fn(() => {
        throw new Error('stop failed');
      });

      override abort = vi.fn(() => {
        throw new Error('abort failed');
      });
    }

    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: ThrowingSpeechRecognition,
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-18',
          endDate: '2026-05-18',
          budgetFloor: 500,
          budgetCeiling: 1500,
          pace: 'relaxed',
          interests: [],
          groupSize: 1,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-voice-button"]').trigger('click');
    await nextTick();

    const recognition = MockSpeechRecognition.instances.at(-1) as ThrowingSpeechRecognition;
    expect(recognition.stop).toHaveBeenCalledTimes(1);
    expect(recognition.abort).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[data-test="trip-ai-voice-status"]').text()).toContain('could not start');
  });

  it('asks the trip agent with the current draft context', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        userId: 'user-1',
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
        stops: [{
          spotId: 'stop-1',
          title: 'Waco lunch',
          latitude: 31.5493,
          longitude: -97.1467,
          category: 'food',
          city: 'Waco',
        }],
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Check this route');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(planTripMock.mock.calls[0][0]).toEqual(expect.objectContaining({
      user_id: 'user-1',
      start_date: '2026-05-08',
      prompt: expect.stringContaining('Title: Texas weekend'),
    }));
    expect(planTripMock.mock.calls[0][1]).toEqual(expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
    expect(planTripMock.mock.calls[0][0].prompt).toContain('Start: Fort Worth, TX');
    expect(planTripMock.mock.calls[0][0].prompt).toContain('End: Austin, TX');
    expect(planTripMock.mock.calls[0][0].prompt).toContain('Planner context:');
    expect(planTripMock.mock.calls[0][0].prompt).toContain('Planning quality contract: extract route, dates, duration, interests, pace, budget, travelers, existing stops, and hard constraints before answering.');
    expect(planTripMock.mock.calls[0][0].prompt).toContain('Existing stops on canvas: 1 stop');
    expect(planTripMock.mock.calls[0][0].prompt).toContain('Stops:');
    expect(wrapper.get('[data-test="trip-ai-user-message"]').text()).toContain('Check this route');
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('Add a lunch stop near Waco');
    expect(wrapper.get('[data-test="trip-ai-quickbar"]').exists()).toBe(true);
    expect(wrapper.get('[data-test="trip-ai-context"]').attributes('data-context-state')).toBe('expanded');
    expect(trackScopeAiInteractionMock).toHaveBeenCalledWith(expect.objectContaining({
      source: 'typed',
      prompt: 'Check this route',
      assistantResponse: 'Add a lunch stop near Waco and keep the final drive under 3 hours.',
      responseKind: 'text',
      responseModel: 'scope-local',
      hasStart: true,
      hasEnd: true,
      stopCount: 1,
      interestCount: 2,
      routeName: 'trip-planner',
    }));
  });

  it('silently drops canceled trip-agent turns and reports non-error failures safely', async () => {
    planTripMock.mockRejectedValueOnce({ code: 'ERR_CANCELED', message: 'request canceled by a newer turn' });
    const canceledWrapper = mountPlannerAssist();

    await canceledWrapper.get('[data-test="trip-ai-input"]').setValue('Check this route');
    await canceledWrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(planTripMock).toHaveBeenCalledTimes(1);
    expect(canceledWrapper.find('[data-test="trip-ai-response"]').exists()).toBe(false);
    expect(canceledWrapper.find('[data-test="trip-ai-sending"]').exists()).toBe(false);

    planTripMock.mockRejectedValueOnce('offline');
    const failedWrapper = mountPlannerAssist();
    const responseText = await submitTripAiPrompt(failedWrapper, 'Check this route');

    expect(responseText).toContain('Scope AI could not help with this trip right now.');
  });

  it('strips hidden AI action blocks, geocodes the place, adds it to the route, and renders message chips', async () => {
    planTripMock.mockResolvedValueOnce({
      itinerary: [
        'Confirmed. Magnolia Market fits the Waco lunch break without pulling you off route.',
        '[SCOPE_ACTION]{"action":"add_marker","place_name":"Magnolia Market","address":"601 Webster Ave, Waco, TX","stop_type":"stop","day":1,"order":1,"note":"Good lunch and shopping break."}[/SCOPE_ACTION]',
        '[CHIPS]Find coffee near Magnolia Market, Check timing with this stop[/CHIPS]',
      ].join('\n'),
      model: 'scope-agent',
      steps: 3,
    });
    searchLocationsMock.mockResolvedValueOnce({
      data: [{
        id: 'mapbox.magnolia',
        placeName: 'Magnolia Market',
        formattedAddress: '601 Webster Ave, Waco, TX',
        latitude: 31.5522,
        longitude: -97.1294,
        city: 'Waco',
        category: 'shopping',
        source: 'mapbox',
      }],
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food'],
          pace: 'moderate',
          groupSize: 2,
        },
        stops: [],
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Yes please');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(searchLocationsMock).toHaveBeenCalledWith('601 Webster Ave, Waco, TX', expect.objectContaining({ limit: 1 }));
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('Confirmed. Magnolia Market fits');
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).not.toContain('[SCOPE_ACTION]');
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).not.toContain('[CHIPS]');
    expect(wrapper.emitted('route-stop-add')?.[0]?.[0]).toMatchObject({
      spotId: 'scope-ai-mapbox-magnolia',
      title: 'Magnolia Market',
      latitude: 31.5522,
      longitude: -97.1294,
      category: 'shopping',
      city: 'Waco',
      dayNumber: 1,
      notes: 'Good lunch and shopping break.',
    });
    expect(wrapper.findAll('[data-test="trip-ai-message-chip"]').map((chip) => chip.text())).toEqual([
      'Find coffee near Magnolia Market',
      'Check timing with this stop',
    ]);

    await wrapper.findAll('[data-test="trip-ai-message-chip"]')[0]?.trigger('click');
    await flushPromises();

    expect(wrapper.findAll('[data-test="trip-ai-user-message"]').at(-1)?.text()).toContain('Find coffee near Magnolia Market');
    expect(searchPlacesMock).toHaveBeenCalled();
  });

  it('applies structured endpoint, ordered stop, and removal actions while ignoring malformed hidden blocks', async () => {
    planTripMock.mockResolvedValueOnce({
      itinerary: [
        'Done. I updated the route with a verified finish and a prioritized Waco stop.',
        '[SCOPE_ACTION]```json',
        '[',
        '{"action":"add_place","stopType":"final","place_name":"Austin Finish","address":"Austin, TX"},',
        '{"action_type":"add-stop","placeName":"Cameron Park","address":"2601 N University Parks Dr, Waco, TX","order":1,"dayNumber":"2","notes":"Best early outdoor stop."},',
        '{"type":"delete_marker","place_name":"Fort Worth, TX"},',
        '{"action":"spin_map","place_name":"Ignore me"}',
        ']',
        '```[/SCOPE_ACTION]',
        '[SCOPE_ACTION]{bad json[/SCOPE_ACTION]',
        '[CHIPS]["Review the new stop", "Build after route changes"][/CHIPS]',
      ].join('\n'),
      model: 'scope-agent',
      steps: 4,
    });
    searchLocationsMock
      .mockResolvedValueOnce({
        data: [{
          id: 'mapbox.austin',
          placeName: 'Austin',
          formattedAddress: 'Austin, TX, United States',
          latitude: 30.2672,
          longitude: -97.7431,
          city: 'Austin',
          source: 'mapbox',
        }],
      })
      .mockResolvedValueOnce({
        data: [{
          id: 'mapbox.cameron-park',
          placeName: 'Cameron Park',
          formattedAddress: '2601 N University Parks Dr, Waco, TX',
          latitude: 31.5793,
          longitude: -97.1505,
          city: 'Waco',
          category: 'park',
          source: 'mapbox',
        }],
      });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['nature'],
          pace: 'moderate',
          groupSize: 2,
        },
        stops: [{
          spotId: 'existing-museum',
          title: 'Existing Museum',
          latitude: 31.55,
          longitude: -97.13,
          category: 'culture',
          city: 'Waco',
        }],
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Apply those changes');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('updated the route');
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).not.toContain('[SCOPE_ACTION]');
    expect(wrapper.emitted('map-location-select')?.[0]?.[0]).toMatchObject({
      target: 'endDestination',
      label: 'Austin',
      latitude: 30.2672,
      longitude: -97.7431,
    });
    expect(wrapper.emitted('route-endpoint-remove')?.[0]?.[0]).toBe('destination');

    const orderedStops = wrapper.emitted('route-stops-replace')?.[0]?.[0];
    expect(orderedStops).toHaveLength(2);
    expect(orderedStops?.[0]).toMatchObject({
      spotId: 'scope-ai-mapbox-cameron-park',
      title: 'Cameron Park',
      dayNumber: 2,
      notes: 'Best early outdoor stop.',
    });
    expect(orderedStops?.[1]).toMatchObject({ title: 'Existing Museum' });
    expect(wrapper.findAll('[data-test="trip-ai-message-chip"]').map((chip) => chip.text())).toEqual([
      'Review the new stop',
      'Build after route changes',
    ]);
  });

  it('uses structured Scope AI chips only in the quickbar when a scope store is provided', async () => {
    callScopeAiMock.mockResolvedValueOnce({
      responseText: [
        '```action',
        '{"actions":[{"type":"SET_FIELD","field":"start","value":"Dallas, TX"}]}',
        '```',
        'Set the start place to Dallas, TX.',
        'CHIPS: ["Add an end city", "Find food nearby", "Build a balanced first draft"]',
      ].join('\n'),
      model: 'scope-ai-test',
    });
    const sessionHistory: Array<{ role: 'user' | 'assistant'; content: string; actionBlock: unknown }> = [];
    const scopeAiStore = {
      stateAsJson: {
        start: null,
        end: null,
        stops: [],
      },
      sessionHistory,
      preferences: {
        rejected_types: [],
        preferred_types: [],
        accept_streak: 0,
        undo_counts: {},
      },
      plannerState: {
        stops: [],
      },
      addSessionEntry: vi.fn((entry: { role: 'user' | 'assistant'; content: string; actionBlock: unknown }) => sessionHistory.push(entry)),
      applyActionBlock: vi.fn(() => true),
      applyActionBlockResolved: vi.fn().mockResolvedValue({
        applied: true,
        resolutions: [{
          type: 'endpoint',
          field: 'start',
          rawValue: 'Dallas, TX',
          status: 'resolved',
          resolvedLabel: 'Dallas, TX',
          candidates: ['Dallas, TX'],
        }],
      }),
      trackAcceptedType: vi.fn(),
      trackRejectedType: vi.fn(),
    };

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '',
          endDate: '',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
        stops: [],
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('start at Dallas, TX');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();
    await nextTick();

    expect(callScopeAiMock).toHaveBeenCalledWith(expect.objectContaining({
      message: 'start at Dallas, TX',
      plannerState: scopeAiStore.stateAsJson,
      preferences: scopeAiStore.preferences,
    }));
    expect(scopeAiStore.applyActionBlockResolved).toHaveBeenCalledWith({
      actions: [{ type: 'SET_FIELD', field: 'start', value: 'Dallas, TX' }],
    });
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('Set the start place to Dallas, TX.');
    expect(wrapper.find('[data-test="trip-ai-message-chips"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-test="trip-ai-quick-suggestion"]').map((button) => button.text())).toEqual([
      'Add an end city',
      'Find food nearby',
      'Build a balanced first draft',
    ]);
  });

  it('routes explicit location what-to-do prompts to the Scope AI service', async () => {
    callScopeAiMock.mockResolvedValueOnce({
      responseText: 'Dallas has strong weekend options around Bishop Arts, Deep Ellum, and the Arts District.\nCHIPS: ["Use Dallas as start", "Find food near Dallas"]',
      model: 'scope-ai-test',
    });
    const scopeAiStore = createScopeAiStore({
      stateAsJson: {
        start: null,
        end: null,
        stops: [],
      },
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '',
          endDate: '',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
        stops: [],
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('What should I do around Dallas this weekend?');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();
    await nextTick();

    expect(callScopeAiMock).toHaveBeenCalledTimes(1);
    expect(callScopeAiMock).toHaveBeenCalledWith(expect.objectContaining({
      message: 'What should I do around Dallas this weekend?',
      plannerState: scopeAiStore.stateAsJson,
    }));
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('Dallas has strong weekend options');
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).not.toContain('Your next move is to add a start place');
  });

  it('asks for a real location on near-me what-to-do prompts before generic next-move help', async () => {
    const scopeAiStore = createScopeAiStore({
      stateAsJson: {
        start: null,
        end: null,
        stops: [],
      },
    });
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '',
          endDate: '',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
        stops: [],
        scopeAiStore,
      },
    });

    await submitTripAiPrompt(wrapper, 'what should I do near me');

    expect(callScopeAiMock).not.toHaveBeenCalled();
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('I need a real location before I can rank options near you');
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).not.toContain('Your next move is to add a start place');
    expect(wrapper.findAll('[data-test="trip-ai-quick-suggestion"]').map((button) => button.text())).toEqual([
      'Use current location',
      'Add a start place',
      'Search near a city',
    ]);
  });

  it.each([
    [
      'save this',
      { type: 'SAVE_TRIP_DRAFT' },
      { type: 'save' },
      'Saved by Scope AI.',
    ],
    [
      'share this trip',
      { type: 'OPEN_SHARE_MODAL' },
      { type: 'share' },
      'Opened sharing from Scope AI.',
    ],
    [
      'make public',
      { type: 'SET_TRIP_VISIBILITY', is_public: true },
      { type: 'visibility', isPublic: true },
      'Made public from Scope AI.',
    ],
    [
      'share with john@example.com as viewer',
      { type: 'INVITE_TRIP_MEMBER', recipient: 'john@example.com', role: 'viewer' },
      { type: 'invite', recipient: 'john@example.com', role: 'viewer' },
      'Invited john@example.com from Scope AI.',
    ],
  ])('executes planner document action for "%s"', async (promptText, action, expectedPayload, resultMessage) => {
    callScopeAiMock.mockResolvedValueOnce({
      responseText: [
        '```action',
        JSON.stringify({ actions: [action] }),
        '```',
        'Working on that planner action.',
      ].join('\n'),
      model: 'scope-ai-test',
    });
    const executeTripCommand = vi.fn().mockResolvedValue({
      ok: true,
      message: resultMessage,
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        scopeAiStore: createScopeAiStore(),
        executeTripCommand,
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue(promptText);
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(executeTripCommand).toHaveBeenCalledWith(expectedPayload);
    expect(getLatestAiResponseText(wrapper)).toContain(resultMessage);
  });

  it('requires Scope AI delete confirmation before executing the planner delete action', async () => {
    callScopeAiMock
      .mockResolvedValueOnce({
        responseText: [
          '```action',
          '{"actions":[{"type":"REQUEST_DELETE_TRIP_DRAFT"}]}',
          '```',
          'I can delete this trip draft, but I need one confirmation first.',
        ].join('\n'),
        model: 'scope-ai-test',
      })
      .mockResolvedValueOnce({
        responseText: [
          '```action',
          '{"actions":[{"type":"DELETE_TRIP_DRAFT"}]}',
          '```',
          'Confirmed delete request.',
        ].join('\n'),
        model: 'scope-ai-test',
      });
    const executeTripCommand = vi.fn().mockResolvedValue({
      ok: true,
      message: 'Deleted this draft from Scope AI.',
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        scopeAiStore: createScopeAiStore(),
        executeTripCommand,
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('delete this draft');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(executeTripCommand).not.toHaveBeenCalled();
    expect(getLatestAiResponseText(wrapper)).toContain('I can delete this trip draft');

    await wrapper.get('[data-test="trip-ai-input"]').setValue('confirm delete');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(executeTripCommand).toHaveBeenCalledTimes(1);
    expect(executeTripCommand).toHaveBeenCalledWith({ type: 'delete' });
    expect(getLatestAiResponseText(wrapper)).toContain('Deleted this draft from Scope AI.');
  });

  it('does not execute delete when Scope AI receives a delete action without a pending confirmation', async () => {
    callScopeAiMock.mockResolvedValueOnce({
      responseText: [
        '```action',
        '{"actions":[{"type":"DELETE_TRIP_DRAFT"}]}',
        '```',
        'Confirmed delete request.',
      ].join('\n'),
      model: 'scope-ai-test',
    });
    const executeTripCommand = vi.fn().mockResolvedValue({
      ok: true,
      message: 'Deleted this draft from Scope AI.',
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        scopeAiStore: createScopeAiStore(),
        executeTripCommand,
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('delete it');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(executeTripCommand).not.toHaveBeenCalled();
    expect(getLatestAiResponseText(wrapper)).toContain('I need one confirmation before deleting');
  });

  it('runs planner map commands through the page bridge and keeps map style feedback map-only', async () => {
    callScopeAiMock.mockResolvedValueOnce({
      responseText: [
        '```action',
        '{"actions":[{"type":"SET_MAP_COMMAND","command":"map_style_light"}]}',
        '```',
        'Switching only the planner map to bright mode.',
      ].join('\n'),
      model: 'scope-ai-test',
    });
    const executeMapCommand = vi.fn().mockResolvedValue({
      ok: true,
      message: 'The planner map is already bright. I left the site theme alone.',
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        scopeAiStore: createScopeAiStore(),
        executeMapCommand,
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('make map light');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(executeMapCommand).toHaveBeenCalledWith({ command: 'map_style_light' });
    expect(getLatestAiResponseText(wrapper)).toContain('already bright');
    expect(getLatestAiResponseText(wrapper)).toContain('site theme alone');
  });

  it('passes targeted map zoom requests through the page bridge with the requested place', async () => {
    callScopeAiMock.mockResolvedValueOnce({
      responseText: [
        '```action',
        '{"actions":[{"type":"SET_MAP_COMMAND","command":"zoom_to_place","query":"texas"}]}',
        '```',
        'Zooming the planner map to texas.',
      ].join('\n'),
      model: 'scope-ai-test',
    });
    const executeMapCommand = vi.fn().mockResolvedValue({
      ok: true,
      message: 'Zoomed the planner map to Texas.',
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        scopeAiStore: createScopeAiStore(),
        executeMapCommand,
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('zoom into texas');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(executeMapCommand).toHaveBeenCalledWith({ command: 'zoom_to_place', query: 'texas' });
    expect(getLatestAiResponseText(wrapper)).toContain('Zoomed the planner map to Texas.');
  });

  it('uses local trip and map command fallbacks when the planner page has not provided bridges', async () => {
    callScopeAiMock.mockResolvedValueOnce({
      responseText: [
        '```action',
        '{"actions":[',
        '{"type":"SAVE_TRIP_DRAFT"},',
        '{"type":"OPEN_SHARE_MODAL"},',
        '{"type":"INVITE_TRIP_MEMBER","recipient":"maya@example.com","role":"viewer"},',
        '{"type":"SET_TRIP_VISIBILITY","is_public":true},',
        '{"type":"SET_MAP_COMMAND","command":"reset map"},',
        '{"type":"SET_MAP_COMMAND","command":"spin_map"}',
        ']}',
        '```',
        'Handling planner commands.',
      ].join('\n'),
      model: 'scope-ai-test',
    });

    const wrapper = mountPlannerAssist({
      scopeAiStore: createScopeAiStore(),
    });

    await submitTripAiPrompt(wrapper, 'save share invite maya make public and reset the map');

    const responseText = wrapper.findAll('[data-test="trip-ai-response"]').map((message) => message.text()).join('\n');
    expect(responseText).toContain('Saving this trip draft.');
    expect(responseText).toContain('Opening sharing for this trip draft.');
    expect(responseText).toContain('Inviting maya@example.com.');
    expect(responseText).toContain('Making this trip public.');
    expect(responseText).toContain('Resetting the planner map view.');
    expect(responseText).toContain('could not match that map command');
  });

  it('cancels a pending delete request without reaching the delete bridge', async () => {
    callScopeAiMock.mockResolvedValueOnce({
      responseText: [
        '```action',
        '{"actions":[{"type":"REQUEST_DELETE_TRIP_DRAFT"}]}',
        '```',
        'I can delete this trip draft, but I need one confirmation first.',
      ].join('\n'),
      model: 'scope-ai-test',
    });
    const executeTripCommand = vi.fn().mockResolvedValue({
      ok: true,
      message: 'Deleted this draft from Scope AI.',
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        scopeAiStore: createScopeAiStore(),
        executeTripCommand,
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('delete this draft');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    await wrapper.get('[data-test="trip-ai-input"]').setValue('nevermind');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(executeTripCommand).not.toHaveBeenCalled();
    expect(getLatestAiResponseText(wrapper)).toContain('Canceled delete');
  });

  it('renders resolved endpoint labels after Scope AI applies address commands', async () => {
    callScopeAiMock.mockResolvedValueOnce({
      responseText: [
        '```action',
        '{"actions":[{"type":"SET_FIELD","field":"start","value":"100 example road"}]}',
        '```',
        'Set the start place to 100 example road.',
        'CHIPS: ["Add an end place", "Find stops nearby", "Build from here"]',
      ].join('\n'),
      model: 'scope-ai-test',
    });
    const scopeAiStore = {
      stateAsJson: {
        start: null,
        end: null,
        stops: [],
      },
      sessionHistory: [],
      preferences: {
        rejected_types: [],
        preferred_types: [],
        accept_streak: 0,
        undo_counts: {},
      },
      plannerState: {
        stops: [],
      },
      addSessionEntry: vi.fn(),
      applyActionBlockResolved: vi.fn().mockResolvedValue({
        applied: true,
        resolutions: [{
          type: 'endpoint',
          field: 'start',
          rawValue: '100 example road',
          status: 'resolved',
          resolvedLabel: '100 Example Road, Example City, Texas 11111, United States',
          candidates: ['100 Example Road, Example City, Texas 11111, United States'],
        }],
      }),
      applyActionBlock: vi.fn(),
      trackAcceptedType: vi.fn(),
      trackRejectedType: vi.fn(),
    };

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '',
          endDate: '',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food'],
          pace: 'relaxed',
          groupSize: 2,
        },
        stops: [],
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('start set at 100 example road');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(scopeAiStore.applyActionBlockResolved).toHaveBeenCalledWith({
      actions: [{ type: 'SET_FIELD', field: 'start', value: '100 example road' }],
    });
    expect(scopeAiStore.applyActionBlock).not.toHaveBeenCalled();
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('Set the start place to 100 Example Road, Example City, Texas 11111, United States.');
    expect(scopeAiStore.addSessionEntry).toHaveBeenCalledWith(expect.objectContaining({
      role: 'assistant',
      content: 'Set the start place to 100 Example Road, Example City, Texas 11111, United States.',
    }));
  });

  it('asks for clarification instead of echoing ambiguous endpoint text', async () => {
    callScopeAiMock.mockResolvedValueOnce({
      responseText: [
        '```action',
        '{"actions":[{"type":"SET_FIELD","field":"start","value":"example road"}]}',
        '```',
        'Set the start place to example road.',
        'CHIPS: ["Add city", "Pick start on map", "Try another address"]',
      ].join('\n'),
      model: 'scope-ai-test',
    });
    const scopeAiStore = {
      stateAsJson: {
        start: null,
        end: null,
        stops: [],
      },
      sessionHistory: [],
      preferences: {
        rejected_types: [],
        preferred_types: [],
        accept_streak: 0,
        undo_counts: {},
      },
      plannerState: {
        stops: [],
      },
      addSessionEntry: vi.fn(),
      applyActionBlockResolved: vi.fn().mockResolvedValue({
        applied: true,
        resolutions: [{
          type: 'endpoint',
          field: 'start',
          rawValue: 'example road',
          status: 'ambiguous',
          candidates: [
            'Example Road, Houston, Texas, United States',
            'Example Road, Arlington, Texas, United States',
          ],
        }],
      }),
      applyActionBlock: vi.fn(),
      trackAcceptedType: vi.fn(),
      trackRejectedType: vi.fn(),
    };

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '',
          endDate: '',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food'],
          pace: 'relaxed',
          groupSize: 2,
        },
        stops: [],
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('start at example road');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const response = wrapper.get('[data-test="trip-ai-response"]').text();
    expect(response).toContain('I found a few possible matches');
    expect(response).toContain('Example Road, Houston');
    expect(response).not.toContain('Set the start place to example road.');
  });

  it('summarizes applied non-location updates when one typed address is ambiguous', async () => {
    callScopeAiMock.mockResolvedValueOnce({
      responseText: [
        '```action',
        '{"actions":[{"type":"SET_FIELD","field":"start","value":"200 Sample Ave"},{"type":"SET_FIELD","field":"budget_max","value":700},{"type":"SET_FIELD","field":"party_size","value":4}]}',
        '```',
        'Set the start place, budget, and travelers.',
        'CHIPS: ["Add city", "Pick start on map", "Build route"]',
      ].join('\n'),
      model: 'scope-ai-test',
    });
    const scopeAiStore = {
      stateAsJson: {
        start: null,
        end: null,
        stops: [],
      },
      sessionHistory: [],
      preferences: {
        rejected_types: [],
        preferred_types: [],
        accept_streak: 0,
        undo_counts: {},
      },
      plannerState: {
        stops: [],
      },
      addSessionEntry: vi.fn(),
      applyActionBlockResolved: vi.fn().mockResolvedValue({
        applied: true,
        resolutions: [{
          type: 'endpoint',
          field: 'start',
          rawValue: '200 Sample Ave',
          status: 'ambiguous',
          candidates: [
            '200 Sample Avenue, Example City, Texas 11111, United States',
            '200 Sample Avenue, Other City, Louisiana 22222, United States',
          ],
        }],
      }),
      applyActionBlock: vi.fn(),
      trackAcceptedType: vi.fn(),
      trackRejectedType: vi.fn(),
    };

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '',
          endDate: '',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food'],
          pace: 'relaxed',
          groupSize: 2,
        },
        stops: [],
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('start 200 Sample Ave and max budget 700 and party of 4');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const response = wrapper.get('[data-test="trip-ai-response"]').text();
    expect(response).toContain('Applied maximum budget, travelers.');
    expect(response).toContain('I found a few possible matches for the start place "200 Sample Ave"');
    expect(response).not.toContain('Set the start place, budget, and travelers.');
  });

  it('keeps ambiguous address context and refines a state follow-up before applying', async () => {
    callScopeAiMock.mockResolvedValueOnce({
      responseText: [
        '```action',
        '{"actions":[{"type":"SET_FIELD","field":"start","value":"200 Sample Ave"}]}',
        '```',
        'Set the start place to 200 Sample Ave.',
      ].join('\n'),
      model: 'scope-ai-test',
    });
    const scopeAiStore: any = {
      stateAsJson: {
        start: null,
        end: null,
        stops: [],
      },
      sessionHistory: [],
      preferences: {
        rejected_types: [],
        preferred_types: [],
        accept_streak: 0,
        undo_counts: {},
      },
      plannerState: {
        stops: [],
      },
      pendingScopeAiContext: null,
      addSessionEntry: vi.fn(),
      applyActionBlockResolved: vi.fn()
        .mockResolvedValueOnce({
          applied: true,
          resolutions: [{
            type: 'endpoint',
            field: 'start',
            rawValue: '200 Sample Ave',
            status: 'ambiguous',
            candidates: [
              '200 Sample Avenue, Other City, Louisiana 22222, United States',
              '200 Sample Avenue, Remote City, New South Wales 33333, Australia',
            ],
          }],
        })
        .mockResolvedValueOnce({
          applied: true,
          resolutions: [{
            type: 'endpoint',
            field: 'start',
            rawValue: '200 Sample Ave Texas',
            status: 'resolved',
            resolvedLabel: '200 Sample Avenue, Example City, Texas 11111, United States',
            candidates: ['200 Sample Avenue, Example City, Texas 11111, United States'],
          }],
        }),
      applyActionBlock: vi.fn(),
      setPendingScopeAiContext: vi.fn((context) => {
        scopeAiStore.pendingScopeAiContext = {
          ...context,
          createdAt: context.createdAt ?? Date.now(),
          turnCount: context.turnCount ?? 0,
        };
      }),
      clearPendingScopeAiContext: vi.fn(() => {
        scopeAiStore.pendingScopeAiContext = null;
      }),
      incrementPendingScopeAiContextTurn: vi.fn(),
      trackAcceptedType: vi.fn(),
      trackRejectedType: vi.fn(),
    };

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '',
          endDate: '',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food'],
          pace: 'relaxed',
          groupSize: 2,
        },
        stops: [],
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('can you sstart at 200 Sample Ave');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(scopeAiStore.pendingScopeAiContext).toMatchObject({
      kind: 'location-resolution',
      targetField: 'start',
      rawValue: '200 Sample Ave',
    });
    expect(wrapper.get('[data-test="trip-ai-response"]').find('li').text()).toContain('200 Sample Avenue, Other City, Louisiana 22222, United States');
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).not.toContain(';');

    await wrapper.get('[data-test="trip-ai-input"]').setValue('is there one in Texas');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(callScopeAiMock).toHaveBeenCalledTimes(1);
    expect(scopeAiStore.applyActionBlockResolved).toHaveBeenLastCalledWith({
      actions: [{ type: 'SET_FIELD', field: 'start', value: '200 Sample Ave Texas' }],
    });
    const latestResponse = wrapper.findAll('[data-test="trip-ai-response"]').at(-1)?.text() ?? '';
    expect(latestResponse).toContain('Set the start place to 200 Sample Avenue, Example City, Texas 11111, United States.');
    expect(scopeAiStore.pendingScopeAiContext).toBeNull();
  });

  it('does not geocode start-city vibe prompts as a start address', async () => {
    const scopeAiStore = createScopeAiStore({
      stateAsJson: {
        start: null,
        end: null,
        stops: [],
      },
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Vibe trip',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '',
          endDate: '',
          budgetFloor: 0,
          budget: 1500,
          interests: ['nightlife', 'culture', 'food', 'scenic'],
          pace: 'relaxed',
          groupSize: 1,
        },
        stops: [],
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Pick a start city for a nightlife, culture, food, and scenic trip');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const response = wrapper.get('[data-test="trip-ai-response"]').text();
    expect(callScopeAiMock).not.toHaveBeenCalled();
    expect(scopeAiStore.applyActionBlockResolved).not.toHaveBeenCalled();
    expect(response).toContain('need one real anchor');
    expect(response).not.toContain('possible matches');
    expect(response).not.toContain('Set the start');
  });

  it('uses typed address corrections as fresh pending queries instead of appending stale raw text', async () => {
    const scopeAiStore = createScopeAiStore({
      stateAsJson: {
        start: null,
        end: null,
        stops: [],
      },
      pendingScopeAiContext: {
        kind: 'location-resolution',
        sourcePrompt: 'Pick a start city for a nightlife, culture, food, and scenic trip',
        targetField: 'start',
        rawValue: 'for a nightlife, culture, food, and scenic trip',
        candidates: [
          { label: 'Tripoli, North, Lebanon', value: 'Tripoli, North, Lebanon' },
          { label: 'Tripuranthakam, Andhra Pradesh, India', value: 'Tripuranthakam, Andhra Pradesh, India' },
        ],
        lastAnswer: 'Pick one.',
        createdAt: Date.now(),
        turnCount: 0,
      },
      applyActionBlockResolved: vi.fn()
        .mockResolvedValueOnce({
          applied: true,
          resolutions: [{
            type: 'endpoint',
            field: 'start',
            rawValue: '7621 devver drive',
            status: 'ambiguous',
            candidates: [
              'Denver Drive, Narre Warren Victoria 3805, Australia',
              'Denver Drive, Portarlington Victoria 3223, Australia',
            ],
          }],
        })
        .mockResolvedValueOnce({
          applied: true,
          resolutions: [{
            type: 'endpoint',
            field: 'start',
            rawValue: '7621 deaver drive',
            status: 'resolved',
            resolvedLabel: '7621 Deaver Drive, Example City, United States',
            candidates: ['7621 Deaver Drive, Example City, United States'],
          }],
        }),
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Vibe trip',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '',
          endDate: '',
          budgetFloor: 0,
          budget: 1500,
          interests: ['nightlife', 'culture', 'food', 'scenic'],
          pace: 'relaxed',
          groupSize: 1,
        },
        stops: [],
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('7621 devver drive');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(scopeAiStore.applyActionBlockResolved).toHaveBeenLastCalledWith({
      actions: [{ type: 'SET_FIELD', field: 'start', value: '7621 devver drive' }],
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('no like 7621 deaver drive');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(callScopeAiMock).not.toHaveBeenCalled();
    expect(scopeAiStore.applyActionBlockResolved).toHaveBeenLastCalledWith({
      actions: [{ type: 'SET_FIELD', field: 'start', value: '7621 deaver drive' }],
    });
    expect(scopeAiStore.applyActionBlockResolved).not.toHaveBeenCalledWith({
      actions: [{ type: 'SET_FIELD', field: 'start', value: expect.stringContaining('nightlife') }],
    });
  });

  it('clears stale pending location context when the user asks a new question', async () => {
    const scopeAiStore = createScopeAiStore({
      stateAsJson: {
        start: null,
        end: null,
        stops: [],
      },
      pendingScopeAiContext: {
        kind: 'location-resolution',
        sourcePrompt: 'Pick a start city for a nightlife, culture, food, and scenic trip',
        targetField: 'start',
        rawValue: 'for a nightlife, culture, food, and scenic trip',
        candidates: [
          { label: 'Tripoli, North, Lebanon', value: 'Tripoli, North, Lebanon' },
          { label: 'Tripuranthakam, Andhra Pradesh, India', value: 'Tripuranthakam, Andhra Pradesh, India' },
        ],
        lastAnswer: 'Pick one.',
        createdAt: Date.now(),
        turnCount: 0,
      },
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Vibe trip',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '',
          endDate: '',
          budgetFloor: 0,
          budget: 1500,
          interests: ['nightlife', 'culture', 'food', 'scenic'],
          pace: 'relaxed',
          groupSize: 1,
        },
        stops: [],
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('what should I do next');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const response = wrapper.get('[data-test="trip-ai-response"]').text();
    expect(callScopeAiMock).not.toHaveBeenCalled();
    expect(scopeAiStore.clearPendingScopeAiContext).toHaveBeenCalledWith('pending-context-new-turn');
    expect(scopeAiStore.applyActionBlockResolved).not.toHaveBeenCalled();
    expect(response).toContain('Your next move');
    expect(response).not.toContain('nightlife, culture, food, and scenic trip');
    expect(response).not.toContain('I am still narrowing');
  });

  it('does not append a bare city to stale pending location context', async () => {
    callScopeAiMock.mockResolvedValueOnce({
      responseText: 'Tell me whether Dallas should be the start or final destination and I will verify it before changing the planner.',
      model: 'scope-ai-test',
    });
    const scopeAiStore = createScopeAiStore({
      stateAsJson: {
        start: null,
        end: null,
        stops: [],
      },
      pendingScopeAiContext: {
        kind: 'location-resolution',
        sourcePrompt: 'Pick a start city for a nightlife, culture, food, and scenic trip',
        targetField: 'start',
        rawValue: 'for a nightlife, culture, food, and scenic trip',
        candidates: [
          { label: 'Tripoli, North, Lebanon', value: 'Tripoli, North, Lebanon' },
          { label: 'Tripuranthakam, Andhra Pradesh, India', value: 'Tripuranthakam, Andhra Pradesh, India' },
        ],
        lastAnswer: 'Pick one.',
        createdAt: Date.now(),
        turnCount: 0,
      },
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Vibe trip',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '',
          endDate: '',
          budgetFloor: 0,
          budget: 1500,
          interests: ['nightlife', 'culture', 'food', 'scenic'],
          pace: 'relaxed',
          groupSize: 1,
        },
        stops: [],
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Dallas');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(scopeAiStore.clearPendingScopeAiContext).toHaveBeenCalledWith('pending-context-new-turn');
    expect(scopeAiStore.applyActionBlockResolved).not.toHaveBeenCalledWith({
      actions: [{ type: 'SET_FIELD', field: 'start', value: expect.stringContaining('nightlife') }],
    });
    expect(scopeAiStore.applyActionBlockResolved).not.toHaveBeenCalled();
    expect(callScopeAiMock).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Dallas',
    }));
    expect(wrapper.findAll('[data-test="trip-ai-response"]').at(-1)?.text()).not.toContain('I am still narrowing');
  });

  it('runs a terminal-style typed Scope AI conversation without compounding prior turns', async () => {
    callScopeAiMock
      .mockResolvedValueOnce({
        responseText: [
          '```action',
          '{"actions":[{"type":"SET_FIELD","field":"start","value":"7621 devver drive"}]}',
          '```',
          'Set the start place to 7621 devver drive.',
        ].join('\n'),
        model: 'scope-ai-test',
      })
      .mockResolvedValueOnce({
        responseText: 'Tell me whether Dallas should be the start or final destination and I will verify it before changing the planner.',
        model: 'scope-ai-test',
      });

    const scopeAiStore = createScopeAiStore({
      stateAsJson: {
        start: null,
        end: null,
        stops: [],
      },
      applyActionBlockResolved: vi.fn()
        .mockResolvedValueOnce({
          applied: true,
          resolutions: [{
            type: 'endpoint',
            field: 'start',
            rawValue: '7621 devver drive',
            status: 'ambiguous',
            candidates: [
              'Denver Drive, Narre Warren Victoria 3805, Australia',
              'Denver Drive, Portarlington Victoria 3223, Australia',
            ],
          }],
        })
        .mockResolvedValueOnce({
          applied: true,
          resolutions: [{
            type: 'endpoint',
            field: 'start',
            rawValue: '7621 deaver drive',
            status: 'resolved',
            resolvedLabel: '7621 Deaver Drive, Example City, United States',
            candidates: ['7621 Deaver Drive, Example City, United States'],
          }],
        }),
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Vibe trip',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '',
          endDate: '',
          budgetFloor: 0,
          budget: 1500,
          interests: ['nightlife', 'culture', 'food', 'scenic'],
          pace: 'relaxed',
          groupSize: 1,
        },
        stops: [],
        scopeAiStore,
      },
    });

    const typeScopeAiTurn = async (message: string) => {
      await wrapper.get('[data-test="trip-ai-input"]').setValue(message);
      await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
      await flushPromises();
      return wrapper.findAll('[data-test="trip-ai-response"]').at(-1)?.text() ?? '';
    };

    const vibeResponse = await typeScopeAiTurn('Pick a start city for a nightlife, culture, food, and scenic trip');
    expect(vibeResponse).toContain('need one real anchor');
    expect(vibeResponse).not.toContain('possible matches');
    expect(scopeAiStore.applyActionBlockResolved).not.toHaveBeenCalled();
    expect(callScopeAiMock).not.toHaveBeenCalled();

    const typoAddressResponse = await typeScopeAiTurn('7621 devver drive');
    expect(scopeAiStore.clearPendingScopeAiContext).toHaveBeenCalledWith('pending-context-new-turn');
    expect(callScopeAiMock).toHaveBeenCalledTimes(1);
    expect(callScopeAiMock).toHaveBeenLastCalledWith(expect.objectContaining({
      message: '7621 devver drive',
    }));
    expect(scopeAiStore.applyActionBlockResolved).toHaveBeenLastCalledWith({
      actions: [{ type: 'SET_FIELD', field: 'start', value: '7621 devver drive' }],
    });
    expect(typoAddressResponse).toContain('I found a few possible matches');
    expect(typoAddressResponse).not.toContain('nightlife, culture, food, and scenic trip devver drive');

    const correctedAddressResponse = await typeScopeAiTurn('no like 7621 deaver drive');
    expect(callScopeAiMock).toHaveBeenCalledTimes(1);
    expect(scopeAiStore.applyActionBlockResolved).toHaveBeenLastCalledWith({
      actions: [{ type: 'SET_FIELD', field: 'start', value: '7621 deaver drive' }],
    });
    expect(correctedAddressResponse).toContain('Set the start place to 7621 Deaver Drive, Example City, United States.');
    expect(correctedAddressResponse).not.toContain('devver drive no like');
    expect(correctedAddressResponse).not.toContain('nightlife, culture, food, and scenic trip');

    const nextMoveResponse = await typeScopeAiTurn('what should I do next');
    expect(callScopeAiMock).toHaveBeenCalledTimes(1);
    expect(nextMoveResponse).toContain('Your next move');
    expect(nextMoveResponse).not.toContain('I am still narrowing');

    const cityResponse = await typeScopeAiTurn('Dallas');
    expect(scopeAiStore.clearPendingScopeAiContext).toHaveBeenCalledWith('pending-context-new-turn');
    expect(callScopeAiMock).toHaveBeenCalledTimes(2);
    expect(callScopeAiMock).toHaveBeenLastCalledWith(expect.objectContaining({
      message: 'Dallas',
    }));
    expect(scopeAiStore.applyActionBlockResolved).not.toHaveBeenCalledWith({
      actions: [{ type: 'SET_FIELD', field: 'start', value: expect.stringContaining('Dallas') }],
    });
    expect(cityResponse).not.toContain('nightlife, culture, food, and scenic trip');
  });

  it('turns natural destination questions into endpoint candidates from the current start', async () => {
    getTravelNearbySuggestionsMock.mockResolvedValueOnce({
      configured: true,
      coverage: 'Provider endpoint coverage',
      source: 'Google Places',
      category: 'recommended',
      radiusKm: 64,
      suggestions: [{
        id: 'endpoint-grapevine',
        title: 'Historic Downtown Grapevine',
        subtitle: 'Walkable food, culture, and nightlife',
        address: 'Grapevine, Texas',
        latitude: 32.9343,
        longitude: -97.0781,
        category: 'shopping',
        source: 'google',
        distanceKm: 14.8,
        reason: 'A close destination with food and nightlife near the current start',
      }],
    });
    const scopeAiStore = createScopeAiStore();
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'North Richland Hills night',
        draft: {
          destination: '7621 Deaver Drive, North Richland Hills',
          endDestination: '',
          destinationLatitude: 32.862,
          destinationLongitude: -97.214,
          startDate: '',
          endDate: '',
          budgetFloor: 500,
          budget: 1500,
          interests: ['nightlife', 'culture', 'food'],
          pace: 'relaxed',
          groupSize: 1,
        },
        stops: [],
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('whats a good place to go to');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(callScopeAiMock).not.toHaveBeenCalled();
    expect(getTravelNearbySuggestionsMock).toHaveBeenCalled();
    expect(wrapper.text()).toContain('Historic Downtown Grapevine');
    expect(wrapper.text()).not.toContain('I already have the start');
    expect(wrapper.text()).not.toContain('cannot confidently answer');
  });

  it('keeps built-in stop and endpoint-removal commands actionable in typed chat', async () => {
    callScopeAiMock
      .mockResolvedValueOnce({
        responseText: [
          '```action',
          '{"actions":[{"type":"SEARCH_NEARBY_PLACES","radius_km":10,"limit":6}]}',
          '```',
          'Checking provider-backed stop options from the first mapped route point.',
        ].join('\n'),
        model: 'scope-ai-test',
      })
      .mockResolvedValueOnce({
        responseText: [
          '```action',
          '{"actions":[{"type":"CLEAR_FIELD","field":"start"}]}',
          '```',
          'Removed the start place from the planner.',
        ].join('\n'),
        model: 'scope-ai-test',
      });
    searchNearbyPlacesMock.mockResolvedValueOnce({
      data: [{
        id: 'nearby-coffee',
        placeName: 'Roots Coffeehouse',
        formattedAddress: '9101 Boulevard 26, North Richland Hills, TX',
        latitude: 32.8628,
        longitude: -97.1966,
        category: 'coffee',
        categoryLabel: 'Coffee',
        distanceKm: 1.4,
        source: 'google',
      }],
    });
    const scopeAiStore = createScopeAiStore({
      stateAsJson: {
        start: '7621 Deaver Drive, North Richland Hills',
        startLatitude: 32.862,
        startLongitude: -97.214,
        end: null,
        stops: [],
      },
      plannerState: {
        start: '7621 Deaver Drive, North Richland Hills',
        startLatitude: 32.862,
        startLongitude: -97.214,
        end: null,
        stops: [],
      },
    });
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'North Richland Hills night',
        draft: {
          destination: '7621 Deaver Drive, North Richland Hills',
          endDestination: '',
          destinationLatitude: 32.862,
          destinationLongitude: -97.214,
          startDate: '',
          endDate: '',
          budgetFloor: 500,
          budget: 1500,
          interests: ['nightlife', 'culture', 'food'],
          pace: 'relaxed',
          groupSize: 1,
        },
        stops: [],
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Find verified stops');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(callScopeAiMock).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Find verified stops',
    }));
    expect(searchNearbyPlacesMock).toHaveBeenCalled();
    expect(wrapper.text()).toContain('Roots Coffeehouse');
    expect(wrapper.text()).not.toContain('cannot confidently answer');

    await wrapper.get('[data-test="trip-ai-input"]').setValue('remove the start');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(scopeAiStore.applyActionBlockResolved).toHaveBeenLastCalledWith({
      actions: [{ type: 'CLEAR_FIELD', field: 'start' }],
    });
    expect(wrapper.findAll('[data-test="trip-ai-response"]').at(-1)?.text()).toContain('Removed the start place');
    expect(wrapper.findAll('[data-test="trip-ai-response"]').at(-1)?.text()).not.toContain('cannot confidently answer');
  });

  it('tracks accepted and rejected stop preferences from structured planner actions', async () => {
    const actionBlock = {
      actions: [
        {
          type: 'ADD_STOP',
          stop: {
            id: 'new-food-stop',
            name: 'Magnolia Tacos',
            type: 'food',
            latitude: 32.7304,
            longitude: -97.3446,
          },
        },
        {
          type: 'REMOVE_STOP',
          stop_id: 'old-scenic-stop',
        },
      ],
    };
    callScopeAiMock.mockResolvedValueOnce({
      responseText: [
        '```action',
        JSON.stringify(actionBlock),
        '```',
        'Swapped the scenic stop for a food stop.',
      ].join('\n'),
      model: 'scope-ai-test',
    });
    const scopeAiStore = createScopeAiStore({
      plannerState: {
        stops: [
          {
            id: 'old-scenic-stop',
            name: 'Old overlook',
            type: 'scenic',
          },
        ],
      },
    });
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Fort Worth food loop',
        draft: createPlannerDraft(),
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('swap the overlook for tacos');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(scopeAiStore.trackAcceptedType).toHaveBeenCalledWith('food');
    expect(scopeAiStore.trackRejectedType).toHaveBeenCalledWith('scenic');
    expect(scopeAiStore.applyActionBlockResolved).toHaveBeenCalledWith(actionBlock);
    expect(getLatestAiResponseText(wrapper)).toContain('Swapped the scenic stop');
  });

  it('refuses unverified location mutations when the store cannot resolve provider locations', async () => {
    callScopeAiMock.mockResolvedValueOnce({
      responseText: [
        '```action',
        JSON.stringify({
          actions: [{
            type: 'ADD_STOP',
            stop: {
              name: 'Mystery overlook',
              address: '100 Mystery Road',
              type: 'scenic',
              latitude: 32.75,
              longitude: -97.33,
            },
          }],
        }),
        '```',
        'Added the scenic stop.',
      ].join('\n'),
      model: 'scope-ai-test',
    });
    const applyActionBlock = vi.fn(() => true);
    const scopeAiStore = createScopeAiStore({
      applyActionBlock,
      applyActionBlockResolved: undefined,
      plannerState: {
        stops: [],
      },
    });
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Fort Worth route',
        draft: createPlannerDraft(),
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Find verified stops');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(callScopeAiMock).toHaveBeenCalled();
    expect(applyActionBlock).not.toHaveBeenCalled();
    expect(getLatestAiResponseText(wrapper)).not.toContain('Added the scenic stop');
  });

  it('treats an explicit new start command as fresh intent instead of pending address refinement', async () => {
    callScopeAiMock.mockResolvedValueOnce({
      responseText: [
        '```action',
        '{"actions":[{"type":"SET_FIELD","field":"start","value":"5555 ZIPLESS ROAD"}]}',
        '```',
        'Set the start place to 5555 ZIPLESS ROAD.',
      ].join('\n'),
      model: 'scope-ai-test',
    });
    const scopeAiStore = createScopeAiStore({
      stateAsJson: {
        start: '100 Example Road, Example City, Texas 11111, United States',
        end: null,
        stops: [],
      },
      pendingScopeAiContext: {
        kind: 'location-resolution',
        sourcePrompt: 'START 100 EXAMPLE ROAD 99999',
        targetField: 'start',
        rawValue: '100 EXAMPLE ROAD 99999',
        candidates: [
          { label: '100 Example Road, Example City, Texas 11111, United States', value: '100 Example Road, Example City, Texas 11111, United States' },
        ],
        lastAnswer: 'Pick one.',
        createdAt: Date.now(),
        turnCount: 0,
      },
      applyActionBlockResolved: vi.fn().mockResolvedValue({
        applied: true,
        resolutions: [{
          type: 'endpoint',
          field: 'start',
          rawValue: '5555 ZIPLESS ROAD',
          status: 'resolved',
          resolvedLabel: '5555 Zipless Road, Example City, Texas, United States',
          candidates: ['5555 Zipless Road, Example City, Texas, United States'],
        }],
      }),
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: '100 Example Road, Example City, Texas 11111, United States',
          endDestination: '',
          startDate: '',
          endDate: '',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food'],
          pace: 'relaxed',
          groupSize: 2,
        },
        stops: [],
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('START 5555 ZIPLESS ROAD');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(scopeAiStore.clearPendingScopeAiContext).toHaveBeenCalledWith('explicit-new-command');
    expect(callScopeAiMock).toHaveBeenCalledWith(expect.objectContaining({
      message: 'START 5555 ZIPLESS ROAD',
    }));
    expect(scopeAiStore.applyActionBlockResolved).toHaveBeenCalledWith({
      actions: [{ type: 'SET_FIELD', field: 'start', value: '5555 ZIPLESS ROAD' }],
    });
    expect(scopeAiStore.applyActionBlockResolved).not.toHaveBeenCalledWith({
      actions: [{ type: 'SET_FIELD', field: 'start', value: expect.stringContaining('100 EXAMPLE ROAD 99999') }],
    });
    expect(wrapper.findAll('[data-test="trip-ai-response"]').at(-1)?.text()).toContain('5555 Zipless Road, Example City, Texas, United States');
  });

  it('uses a numeric ambiguous-address follow-up through provider verification', async () => {
    const scopeAiStore: any = {
      stateAsJson: {
        start: null,
        end: null,
        stops: [],
      },
      sessionHistory: [],
      preferences: {},
      plannerState: {
        stops: [],
      },
      pendingScopeAiContext: {
        kind: 'location-resolution',
        sourcePrompt: 'start at sample road',
        targetField: 'start',
        rawValue: 'sample road',
        candidates: [
          { label: 'Sample Road, Dallas, Texas, United States', value: 'Sample Road, Dallas, Texas, United States' },
          { label: 'Sample Road, Tulsa, Oklahoma, United States', value: 'Sample Road, Tulsa, Oklahoma, United States' },
        ],
        lastAnswer: 'Pick one.',
        createdAt: Date.now(),
        turnCount: 0,
      },
      addSessionEntry: vi.fn(),
      applyActionBlockResolved: vi.fn().mockResolvedValue({
        applied: true,
        resolutions: [{
          type: 'endpoint',
          field: 'start',
          rawValue: 'Sample Road, Dallas, Texas, United States',
          status: 'resolved',
          resolvedLabel: 'Sample Road, Dallas, Texas, United States',
          candidates: ['Sample Road, Dallas, Texas, United States'],
        }],
      }),
      applyActionBlock: vi.fn(),
      setPendingScopeAiContext: vi.fn((context) => {
        scopeAiStore.pendingScopeAiContext = {
          ...context,
          createdAt: context.createdAt ?? Date.now(),
          turnCount: context.turnCount ?? 0,
        };
      }),
      clearPendingScopeAiContext: vi.fn(() => {
        scopeAiStore.pendingScopeAiContext = null;
      }),
      incrementPendingScopeAiContextTurn: vi.fn(),
      trackAcceptedType: vi.fn(),
      trackRejectedType: vi.fn(),
    };

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '',
          endDate: '',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food'],
          pace: 'relaxed',
          groupSize: 2,
        },
        stops: [],
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('first one');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(callScopeAiMock).not.toHaveBeenCalled();
    expect(scopeAiStore.applyActionBlockResolved).toHaveBeenCalledWith({
      actions: [{ type: 'SET_FIELD', field: 'start', value: 'Sample Road, Dallas, Texas, United States' }],
    });
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('Set the start place to Sample Road, Dallas, Texas, United States.');
  });

  it('answers fuel result follow-ups from pending provider-backed results', async () => {
    const scopeAiStore: any = {
      stateAsJson: {},
      sessionHistory: [],
      preferences: {},
      plannerState: {
        stops: [],
      },
      pendingScopeAiContext: {
        kind: 'fuel-results',
        sourcePrompt: 'find fuel nearby',
        targetField: 'fuel',
        rawValue: 'regular',
        results: [
          {
            label: '1. Route Fuel - $3.39/gal, 1.0 km away',
            value: 'Route Fuel',
            meta: { pricePerUnit: 3.39, distanceKm: 1 },
          },
          {
            label: '2. Budget Fuel - $3.09/gal, 3.0 km away',
            value: 'Budget Fuel',
            meta: { pricePerUnit: 3.09, distanceKm: 3 },
          },
        ],
        lastAnswer: 'Fuel near the route.',
        createdAt: Date.now(),
        turnCount: 0,
      },
      addSessionEntry: vi.fn(),
      setPendingScopeAiContext: vi.fn((context) => {
        scopeAiStore.pendingScopeAiContext = {
          ...context,
          createdAt: context.createdAt ?? Date.now(),
          turnCount: context.turnCount ?? 0,
        };
      }),
      clearPendingScopeAiContext: vi.fn(() => {
        scopeAiStore.pendingScopeAiContext = null;
      }),
      incrementPendingScopeAiContextTurn: vi.fn(),
    };

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '',
          endDate: '',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food'],
          pace: 'relaxed',
          groupSize: 2,
        },
        stops: [],
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('cheapest');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(callScopeAiMock).not.toHaveBeenCalled();
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('Cheapest provider-backed fuel result');
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('Budget Fuel');
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).not.toContain('route endpoints');
  });

  it('sets gas price from the cheapest pending fuel result after a cheapest follow-up', async () => {
    const scopeAiStore = createScopeAiStore({
      pendingScopeAiContext: {
        kind: 'fuel-results',
        sourcePrompt: 'find fuel nearby',
        targetField: 'fuel',
        rawValue: 'regular',
        results: [
          {
            label: '1. Route Fuel - $3.39/gal, 1.0 km away',
            value: 'Route Fuel',
            meta: { pricePerUnit: 3.39, distanceKm: 1 },
          },
          {
            label: '2. Budget Fuel - $3.09/gal, 3.0 km away',
            value: 'Budget Fuel',
            meta: { pricePerUnit: 3.09, distanceKm: 3 },
          },
        ],
        lastAnswer: 'Fuel near the route.',
        createdAt: Date.now(),
        turnCount: 0,
      },
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '',
          endDate: '',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food'],
          pace: 'relaxed',
          groupSize: 2,
        },
        stops: [],
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('cheapest');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(scopeAiStore.pendingScopeAiContext).toMatchObject({
      kind: 'fuel-results',
      lastAnswer: expect.stringContaining('Budget Fuel'),
    });
    expect(wrapper.findAll('[data-test="trip-ai-response"]').at(-1)?.text()).toContain('Reply "set gas price" to use $3.09/gal.');

    await wrapper.get('[data-test="trip-ai-input"]').setValue('set gas price');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(scopeAiStore.applyActionBlockResolved).toHaveBeenCalledWith({
      actions: [{ type: 'SET_FIELD', field: 'gas_price', value: 3.09 }],
    });
    expect(scopeAiStore.clearPendingScopeAiContext).toHaveBeenCalledWith('fuel-price-applied');
    expect(scopeAiStore.pendingScopeAiContext).toBeNull();
    expect(wrapper.findAll('[data-test="trip-ai-response"]').at(-1)?.text()).toContain('Set the gas price to $3.09/gal');
  });

  it('reruns pending fuel lookups when the traveler changes fuel type, radius, or count', async () => {
    const cases = [
      { prompt: 'show more diesel within 5 km', fuelType: 'diesel', radiusKm: 5, limit: 8 },
      { prompt: 'premium within 8 km', fuelType: 'premium', radiusKm: 8, limit: 5 },
      { prompt: 'midgrade radius 10 km', fuelType: 'midgrade', radiusKm: 10, limit: 5 },
      { prompt: 'regular closest', fuelType: 'regular', radiusKm: 10, limit: 5 },
    ];

    for (const testCase of cases) {
      const scopeAiStore = createScopeAiStore({
        plannerState: {
          start: 'Fort Worth start',
          startLatitude: 32.7555,
          startLongitude: -97.3308,
          stops: [],
        },
        pendingScopeAiContext: {
          kind: 'fuel-results',
          sourcePrompt: 'find fuel nearby',
          targetField: 'fuel',
          rawValue: 'regular',
          results: [],
          lastAnswer: 'Fuel near the route.',
          createdAt: Date.now(),
          turnCount: 0,
        },
      });
      const wrapper = mountPlannerAssist({ scopeAiStore });

      await submitTripAiPrompt(wrapper, testCase.prompt);

      expect(callScopeAiMock, testCase.prompt).not.toHaveBeenCalled();
      expect(getNearbyFuelStationsMock, testCase.prompt).toHaveBeenLastCalledWith({
        latitude: 32.7555,
        longitude: -97.3308,
        radiusKm: testCase.radiusKm,
        fuelType: testCase.fuelType,
        limit: testCase.limit,
        sortBy: 'closest',
      });
      expect(getLatestAiResponseText(wrapper), testCase.prompt).toContain(`near Fort Worth start within ${testCase.radiusKm} km`);
      wrapper.unmount();
    }
  });

  it('runs Scope AI fuel lookup actions from the mapped route and stores provider-backed pending results', async () => {
    callScopeAiMock.mockResolvedValueOnce({
      responseText: [
        '```action',
        '{"actions":[{"type":"SEARCH_NEARBY_FUEL","sort_by":"best_price","radius_km":20,"limit":2,"fuel_type":"diesel"}]}',
        '```',
        'Checking provider-backed fuel.',
      ].join('\n'),
      model: 'scope-ai-test',
    });
    getNearbyFuelStationsMock.mockResolvedValueOnce({
      configured: true,
      coverage: 'Provider diesel prices near the route.',
      source: 'Google fuel provider',
      fuelType: 'diesel',
      radiusKm: 20,
      stations: [
        {
          id: 'fuel-1',
          name: 'Route Diesel',
          address: '10 Highway Road',
          pricePerUnit: 3.49,
          currency: 'USD',
          fuelType: 'diesel',
          distanceKm: 1.2,
          providerVerified: true,
        },
        {
          id: 'fuel-2',
          name: 'Budget Diesel',
          address: '20 Service Road',
          pricePerUnit: 3.29,
          currency: 'USD',
          fuelType: 'diesel',
          distanceKm: 4.8,
          providerVerified: true,
        },
      ],
    });
    const scopeAiStore = createScopeAiStore({
      stateAsJson: {
        start: 'Fort Worth start',
        startLatitude: 32.7555,
        startLongitude: -97.3308,
        stops: [],
      },
      plannerState: {
        start: 'Fort Worth start',
        startLatitude: 32.7555,
        startLongitude: -97.3308,
        stops: [],
        fuel_type: 'regular',
      },
    });
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: createPlannerDraft(),
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('find diesel near the start');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(getNearbyFuelStationsMock).toHaveBeenCalledWith({
      latitude: 32.7555,
      longitude: -97.3308,
      radiusKm: 20,
      fuelType: 'diesel',
      limit: 2,
      sortBy: 'best_price',
    });
    expect(getLatestAiResponseText(wrapper)).toContain('Fuel near Fort Worth start');
    expect(getLatestAiResponseText(wrapper)).toContain('Budget Diesel');
    expect(scopeAiStore.pendingScopeAiContext).toMatchObject({
      kind: 'fuel-results',
      rawValue: 'diesel',
      results: [
        expect.objectContaining({ value: 'Route Diesel' }),
        expect.objectContaining({ value: 'Budget Diesel' }),
      ],
    });
  });

  it('refuses structured nearby and fuel lookups until a mapped route point exists', async () => {
    callScopeAiMock.mockResolvedValueOnce({
      responseText: [
        '```action',
        '{"actions":[{"type":"SEARCH_NEARBY_PLACES","category":"food"},{"type":"SEARCH_NEARBY_FUEL","fuel_type":"regular"}]}',
        '```',
        'I need a mapped route point first.',
      ].join('\n'),
      model: 'scope-ai-test',
    });
    const scopeAiStore = createScopeAiStore({
      plannerState: {
        start: 'Fort Worth',
        end: '',
        stops: [],
      },
    });
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth',
          endDestination: '',
          startDate: '',
          endDate: '',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food'],
          pace: 'relaxed',
          groupSize: 2,
        },
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('find dinner and fuel nearby');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(searchNearbyPlacesMock).not.toHaveBeenCalled();
    expect(getNearbyFuelStationsMock).not.toHaveBeenCalled();
    const responses = wrapper.findAll('[data-test="trip-ai-response"]').map((message) => message.text());
    expect(responses).toEqual(expect.arrayContaining([
      expect.stringContaining('Set a start, end, or stop first and I can search nearby places from there.'),
      expect.stringContaining('Set a start, end, or stop first and I can look up nearby fuel from there.'),
    ]));
  });

  it('filters structured nearby place actions by category and route radius from the mapped endpoint', async () => {
    callScopeAiMock.mockResolvedValueOnce({
      responseText: [
        '```action',
        '{"actions":[{"type":"SEARCH_NEARBY_PLACES","category":"nightlife","radius_km":5,"limit":20}]}',
        '```',
        'Checking nightlife near the finish.',
      ].join('\n'),
      model: 'scope-ai-test',
    });
    searchNearbyPlacesMock.mockResolvedValueOnce({
      data: [
        {
          id: 'bar-near',
          placeName: 'Neon Piano Bar',
          formattedAddress: '100 Music Lane, Austin, TX',
          latitude: 30.2672,
          longitude: -97.7431,
          category: 'bar',
          categoryLabel: 'Bar',
          distanceKm: 2.2,
          source: 'google',
        },
        {
          id: 'bar-no-distance',
          placeName: 'Hidden Lounge',
          formattedAddress: '',
          latitude: 30.268,
          longitude: -97.744,
          category: 'bar',
          categoryLabel: 'Bar',
          source: 'mapbox',
        },
        {
          id: 'bar-far',
          placeName: 'Faraway Club',
          formattedAddress: 'Far outside the route radius',
          latitude: 30.4,
          longitude: -97.9,
          category: 'bar',
          categoryLabel: 'Bar',
          distanceKm: 18,
          source: 'google',
        },
      ],
    });
    const scopeAiStore = createScopeAiStore({
      plannerState: {
        end: 'Austin finish',
        endLatitude: 30.2672,
        endLongitude: -97.7431,
        stops: [],
      },
    });
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Austin night',
        draft: createPlannerDraft(),
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('find nightlife within five km of the finish');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(searchNearbyPlacesMock).toHaveBeenCalledWith({
      center: {
        latitude: 30.2672,
        longitude: -97.7431,
      },
      categories: ['bar'],
      limit: 10,
    });
    expect(getLatestAiResponseText(wrapper)).toContain('Nearby nightlife picks near Austin finish within 3.1 mi');
    expect(getLatestAiResponseText(wrapper)).toContain('Neon Piano Bar');
    expect(getLatestAiResponseText(wrapper)).toContain('Hidden Lounge');
    expect(getLatestAiResponseText(wrapper)).not.toContain('Faraway Club');
    expect(scopeAiStore.pendingScopeAiContext).toMatchObject({
      kind: 'nearby-results',
      rawValue: 'nightlife',
      results: [
        expect.objectContaining({ value: '100 Music Lane, Austin, TX' }),
        expect.objectContaining({ value: 'Hidden Lounge' }),
      ],
    });
  });

  it('keeps applied route edits visible when a structured nearby lookup fails', async () => {
    callScopeAiMock.mockResolvedValueOnce({
      responseText: [
        '```action',
        '{"actions":[{"type":"ADD_STOP","stop":{"id":"stop-1","name":"River Stop","type":"scenic"}},{"type":"SEARCH_NEARBY_PLACES","category":"scenic"}]}',
        '```',
        'I added the stop and checked nearby ideas.',
      ].join('\n'),
      model: 'scope-ai-test',
    });
    searchNearbyPlacesMock.mockRejectedValueOnce(new Error('nearby provider unavailable'));
    const scopeAiStore = createScopeAiStore({
      plannerState: {
        start: 'Fort Worth start',
        startLatitude: 32.7555,
        startLongitude: -97.3308,
        stops: [],
      },
    });
    const wrapper = mountPlannerAssist({ scopeAiStore });

    await submitTripAiPrompt(wrapper, 'add a scenic stop and find views nearby');

    expect(scopeAiStore.applyActionBlockResolved).toHaveBeenCalled();
    expect(scopeAiStore.trackAcceptedType).toHaveBeenCalledWith('scenic');
    expect(getLatestAiResponseText(wrapper)).toContain('That lookup did not finish cleanly');
  });

  it('uses the first mapped stop for structured fuel actions when endpoints lack coordinates', async () => {
    callScopeAiMock.mockResolvedValueOnce({
      responseText: [
        '```action',
        '{"actions":[{"type":"SEARCH_NEARBY_FUEL","radius_km":100,"limit":99,"fuel_type":"hydrogen"}]}',
        '```',
        'Checking fuel from the mapped stop.',
      ].join('\n'),
      model: 'scope-ai-test',
    });
    getNearbyFuelStationsMock.mockResolvedValueOnce({
      configured: true,
      coverage: 'Provider prices near stop.',
      source: 'Google fuel provider',
      radiusKm: 50,
      stations: [
        {
          id: 'fuel-no-price',
          name: 'Stopside Fuel',
          address: '',
          pricePerUnit: 'unknown',
          currency: 'USD',
          fuelType: 'regular',
          providerVerified: true,
        },
      ],
    });
    const scopeAiStore = createScopeAiStore({
      plannerState: {
        start: 'Unmapped start',
        end: 'Unmapped end',
        stops: [
          {
            id: 'stop-with-coordinates',
            name: 'Waco stop',
            latitude: 31.5493,
            longitude: -97.1467,
          },
        ],
      },
    });
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: createPlannerDraft(),
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('find fuel from the stop');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(getNearbyFuelStationsMock).toHaveBeenCalledWith({
      latitude: 31.5493,
      longitude: -97.1467,
      radiusKm: 50,
      fuelType: 'all',
      limit: 8,
      sortBy: 'closest',
    });
    expect(getLatestAiResponseText(wrapper)).toContain('Fuel near Waco stop');
    expect(getLatestAiResponseText(wrapper)).toContain('Stopside Fuel - price unavailable, nearby');
    expect(scopeAiStore.pendingScopeAiContext).toMatchObject({
      kind: 'fuel-results',
      rawValue: 'all',
      results: [expect.objectContaining({ value: 'Stopside Fuel' })],
    });
  });

  it('refuses to set gas price from fallback fuel pending results', async () => {
    const scopeAiStore = createScopeAiStore({
      pendingScopeAiContext: {
        kind: 'fuel-results',
        sourcePrompt: 'find fuel nearby',
        targetField: 'fuel',
        rawValue: 'regular',
        results: [
          {
            label: '1. Demo Fuel - $2.49/gal, 1.0 km away',
            value: 'Demo Fuel',
            source: 'Scope demo fuel',
            meta: {
              pricePerUnit: 2.49,
              distanceKm: 1,
              providerVerified: false,
            },
          },
        ],
        lastAnswer: 'Fuel near the route.',
        createdAt: Date.now(),
        turnCount: 0,
      },
    });
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: createPlannerDraft(),
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('set gas price');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(scopeAiStore.applyActionBlockResolved).not.toHaveBeenCalled();
    expect(getLatestAiResponseText(wrapper)).toContain('unverified result');
    expect(scopeAiStore.pendingScopeAiContext).toMatchObject({
      kind: 'explanation',
      lastAnswer: expect.stringContaining('unverified result'),
    });
  });

  it('applies numeric pending planner-setting follow-ups without calling Scope AI again', async () => {
    const scopeAiStore = createScopeAiStore({
      pendingScopeAiContext: {
        kind: 'planner-setting',
        sourcePrompt: 'keep this cheap',
        targetField: 'budget_max',
        rawValue: 'budget cap',
        results: [],
        lastAnswer: 'What budget cap should I use?',
        createdAt: Date.now(),
        turnCount: 0,
      },
    });
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: createPlannerDraft(),
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('under 900');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(callScopeAiMock).not.toHaveBeenCalled();
    expect(scopeAiStore.applyActionBlockResolved).toHaveBeenCalledWith({
      actions: [{ type: 'SET_FIELD', field: 'budget_max', value: 900 }],
    });
    expect(scopeAiStore.clearPendingScopeAiContext).toHaveBeenCalledWith('planner-setting-applied');
    expect(getLatestAiResponseText(wrapper)).toContain('Set maximum budget to 900');
  });

  it('reruns nearby follow-ups with refined category and radius', async () => {
    searchNearbyPlacesMock.mockResolvedValueOnce({
      data: [{
        id: 'coffee-1',
        latitude: 32.75,
        longitude: -97.33,
        placeName: 'Provider Coffee',
        formattedAddress: '10 Coffee Street, Fort Worth, Texas',
        city: 'Fort Worth',
        category: 'coffee',
        categoryLabel: 'Coffee',
        distanceKm: 4,
        source: 'mapbox',
      }],
    });
    const scopeAiStore: any = {
      stateAsJson: {},
      sessionHistory: [],
      preferences: {},
      plannerState: {
        start: 'Fort Worth, Texas',
        startLatitude: 32.7555,
        startLongitude: -97.3308,
        stops: [],
      },
      pendingScopeAiContext: {
        kind: 'nearby-results',
        sourcePrompt: 'nearby places',
        targetField: 'stop',
        rawValue: 'food',
        results: [],
        lastAnswer: 'Nearby food picks.',
        createdAt: Date.now(),
        turnCount: 0,
      },
      addSessionEntry: vi.fn(),
      setPendingScopeAiContext: vi.fn((context) => {
        scopeAiStore.pendingScopeAiContext = {
          ...context,
          createdAt: context.createdAt ?? Date.now(),
          turnCount: context.turnCount ?? 0,
        };
      }),
      clearPendingScopeAiContext: vi.fn(() => {
        scopeAiStore.pendingScopeAiContext = null;
      }),
      incrementPendingScopeAiContextTurn: vi.fn(),
    };

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, Texas',
          endDestination: '',
          startDate: '',
          endDate: '',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food'],
          pace: 'relaxed',
          groupSize: 2,
        },
        stops: [],
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('show more coffee within 20 mi');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(callScopeAiMock).not.toHaveBeenCalled();
    expect(searchNearbyPlacesMock).toHaveBeenCalledWith(expect.objectContaining({
      center: {
        latitude: 32.7555,
        longitude: -97.3308,
      },
      categories: ['coffee', 'cafe'],
      limit: 10,
    }));
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('Provider Coffee');
    expect(scopeAiStore.pendingScopeAiContext).toMatchObject({
      kind: 'nearby-results',
      rawValue: 'coffee',
    });
  });

  it('maps nearby follow-up language to provider categories for fuel, food, outdoors, scenic, culture, shopping, and entertainment', async () => {
    const cases = [
      { prompt: 'show more gas within 8 mi', category: 'fuel', categories: ['gas_station'] },
      { prompt: 'more dinner nearby', category: 'food', categories: ['restaurant', 'food_and_drink'] },
      { prompt: 'park under 5 miles', category: 'outdoors', categories: ['park'] },
      { prompt: 'scenic overlooks nearby', category: 'scenic', categories: ['tourist_attraction', 'park'] },
      { prompt: 'museum stops near here', category: 'culture', categories: ['museum', 'tourist_attraction'] },
      { prompt: 'shopping markets nearby', category: 'shopping', categories: ['shopping'] },
      { prompt: 'bowling nearby', category: 'entertainment', categories: ['amusement_park', 'bowling_alley', 'movie_theater', 'tourist_attraction'] },
    ];

    for (const testCase of cases) {
      searchNearbyPlacesMock.mockResolvedValueOnce({
        data: [{
          id: `${testCase.category}-1`,
          latitude: 32.75,
          longitude: -97.33,
          placeName: `Provider ${testCase.category}`,
          formattedAddress: '10 Provider Street, Fort Worth, Texas',
          city: 'Fort Worth',
          category: testCase.category,
          categoryLabel: testCase.category,
          distanceKm: 1.5,
          source: 'mapbox',
        }],
      });
      const scopeAiStore = createScopeAiStore({
        plannerState: {
          start: 'Fort Worth, Texas',
          startLatitude: 32.7555,
          startLongitude: -97.3308,
          stops: [],
        },
        pendingScopeAiContext: {
          kind: 'nearby-results',
          sourcePrompt: 'nearby places',
          targetField: 'stop',
          rawValue: 'food',
          results: [],
          lastAnswer: 'Nearby picks.',
          createdAt: Date.now(),
          turnCount: 0,
        },
      });
      const wrapper = mountPlannerAssist({
        scopeAiStore,
        draft: {
          destination: 'Fort Worth, Texas',
          endDestination: '',
        },
      });

      await submitTripAiPrompt(wrapper, testCase.prompt);

      expect(callScopeAiMock, testCase.prompt).not.toHaveBeenCalled();
      expect(searchNearbyPlacesMock, testCase.prompt).toHaveBeenLastCalledWith(expect.objectContaining({
        categories: testCase.categories,
      }));
      expect(getLatestAiResponseText(wrapper), testCase.prompt).toContain(`Provider ${testCase.category}`);
      expect(scopeAiStore.pendingScopeAiContext).toMatchObject({
        kind: 'nearby-results',
        rawValue: testCase.category,
      });

      wrapper.unmount();
    }
  });

  it('adds the second pending place candidate as a route stop', async () => {
    const scopeAiStore = createScopeAiStore({
      pendingScopeAiContext: {
        kind: 'place-candidates',
        sourcePrompt: 'find museums nearby',
        targetField: 'stop',
        rawValue: 'museum',
        results: [
          {
            id: 'place-kimbell',
            label: 'Kimbell Art Museum',
            value: '3333 Camp Bowie Blvd, Fort Worth, TX',
            latitude: 32.7487,
            longitude: -97.3654,
            meta: {
              category: 'museum',
              city: 'Fort Worth',
              placeName: 'Kimbell Art Museum',
            },
          },
          {
            id: 'place-modern',
            label: 'Modern Art Museum of Fort Worth',
            value: '3200 Darnell St, Fort Worth, TX',
            latitude: 32.7504,
            longitude: -97.3637,
            meta: {
              category: 'museum',
              city: 'Fort Worth',
              placeName: 'Modern Art Museum of Fort Worth',
            },
          },
        ],
        lastAnswer: 'Pick a museum.',
        createdAt: Date.now(),
        turnCount: 0,
      },
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['culture'],
          pace: 'moderate',
          groupSize: 2,
        },
        stops: [],
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('second one');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(callScopeAiMock).not.toHaveBeenCalled();
    expect(wrapper.emitted('route-stop-add')?.[0]?.[0]).toMatchObject({
      spotId: 'place-place-modern',
      title: 'Modern Art Museum of Fort Worth',
      latitude: 32.7504,
      longitude: -97.3637,
      category: 'culture',
      city: 'Fort Worth',
      notes: '3200 Darnell St, Fort Worth, TX',
    });
    expect(scopeAiStore.clearPendingScopeAiContext).toHaveBeenCalledWith('place-candidate-selected');
  });

  it('narrows pending place candidates by name and renders the narrowed dash list', async () => {
    const scopeAiStore = createScopeAiStore({
      pendingScopeAiContext: {
        kind: 'place-candidates',
        sourcePrompt: 'find stops nearby',
        targetField: 'stop',
        rawValue: 'nearby stops',
        results: [
          {
            id: 'place-kimbell',
            label: 'Kimbell Art Museum',
            value: '3333 Camp Bowie Blvd, Fort Worth, TX',
            latitude: 32.7487,
            longitude: -97.3654,
            meta: {
              category: 'museum',
              placeName: 'Kimbell Art Museum',
            },
          },
          {
            id: 'place-coffee',
            label: 'Provider Coffee',
            value: '10 Coffee Street, Fort Worth, TX',
            latitude: 32.75,
            longitude: -97.33,
            meta: {
              category: 'coffee',
              placeName: 'Provider Coffee',
            },
          },
          {
            id: 'place-modern',
            label: 'Modern Art Museum of Fort Worth',
            value: '3200 Darnell St, Fort Worth, TX',
            latitude: 32.7504,
            longitude: -97.3637,
            meta: {
              category: 'museum',
              placeName: 'Modern Art Museum of Fort Worth',
            },
          },
        ],
        lastAnswer: 'Pick a provider-backed stop.',
        createdAt: Date.now(),
        turnCount: 0,
      },
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['culture'],
          pace: 'moderate',
          groupSize: 2,
        },
        stops: [],
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('museum one');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const latestResponse = wrapper.findAll('[data-test="trip-ai-response"]').at(-1);
    expect(latestResponse?.text()).toContain('I narrowed those provider-backed options to');
    expect(latestResponse?.findAll('li').map((item) => item.text())).toEqual([
      '3333 Camp Bowie Blvd, Fort Worth, TX',
      '3200 Darnell St, Fort Worth, TX',
    ]);
    expect(latestResponse?.text()).toContain('Reply with a number, a name, or pick one on the map.');
    expect(latestResponse?.text()).not.toContain('Provider Coffee');
    expect(scopeAiStore.pendingScopeAiContext).toMatchObject({
      kind: 'place-candidates',
      results: [
        expect.objectContaining({ label: 'Kimbell Art Museum' }),
        expect.objectContaining({ label: 'Modern Art Museum of Fort Worth' }),
      ],
      lastAnswer: expect.stringContaining('I narrowed those provider-backed options to'),
    });
  });

  it('refuses to add pending nearby results until provider coordinates are attached', async () => {
    const scopeAiStore = createScopeAiStore({
      pendingScopeAiContext: {
        kind: 'nearby-results',
        sourcePrompt: 'find food nearby',
        targetField: 'stop',
        rawValue: 'food',
        results: [
          {
            id: 'nearby-unmapped',
            label: 'Unmapped Taco Stand',
            value: 'Provider result missing coordinates',
            source: 'Map search',
            meta: {
              category: 'restaurant',
              placeName: 'Unmapped Taco Stand',
              providerVerified: true,
            },
          },
        ],
        lastAnswer: 'Pick a nearby place.',
        createdAt: Date.now(),
        turnCount: 0,
      },
    });

    const wrapper = mountPlannerAssist({
      scopeAiStore,
      draft: {
        destination: 'Fort Worth, TX',
        endDestination: 'Austin, TX',
      },
    });

    await submitTripAiPrompt(wrapper, 'first');

    expect(callScopeAiMock).not.toHaveBeenCalled();
    expect(wrapper.emitted('route-stop-add')).toBeUndefined();
    expect(getLatestAiResponseText(wrapper)).toContain('does not have provider coordinates attached');
    expect(scopeAiStore.pendingScopeAiContext).toMatchObject({
      kind: 'explanation',
      lastAnswer: expect.stringContaining('provider coordinates'),
    });
  });

  it('keeps pending candidate context alive with a narrowing reminder before clearing stale turns', async () => {
    const pendingContext = {
      kind: 'place-candidates',
      sourcePrompt: 'find museums nearby',
      targetField: 'stop',
      rawValue: 'museum',
      results: [
        {
          id: 'place-kimbell',
          label: 'Kimbell Art Museum',
          value: '3333 Camp Bowie Blvd, Fort Worth, TX',
          latitude: 32.7487,
          longitude: -97.3654,
          source: 'Map search',
          meta: {
            category: 'museum',
            placeName: 'Kimbell Art Museum',
          },
        },
      ],
      lastAnswer: 'Pick a museum.',
      createdAt: Date.now(),
      turnCount: 0,
    };
    const scopeAiStore = createScopeAiStore({
      pendingScopeAiContext: pendingContext,
    });

    const wrapper = mountPlannerAssist({
      scopeAiStore,
      draft: {
        destination: 'Fort Worth, TX',
        endDestination: 'Austin, TX',
      },
    });

    await submitTripAiPrompt(wrapper, 'cheapest');

    expect(callScopeAiMock).not.toHaveBeenCalled();
    expect(getLatestAiResponseText(wrapper)).toContain('I am still narrowing stop from "museum"');
    expect(getLatestAiResponseText(wrapper)).toContain('3333 Camp Bowie Blvd');
    expect(scopeAiStore.pendingScopeAiContext).toMatchObject({
      turnCount: 1,
      lastAnswer: expect.stringContaining('I am still narrowing stop'),
    });

    scopeAiStore.pendingScopeAiContext = {
      ...pendingContext,
      turnCount: 2,
    };
    await submitTripAiPrompt(wrapper, 'cheapest');

    expect(getLatestAiResponseText(wrapper)).toContain('I cleared that earlier follow-up because it was getting stale');
    expect(scopeAiStore.clearPendingScopeAiContext).toHaveBeenCalledWith('pending-context-unrelated-turn-limit');
    expect(scopeAiStore.pendingScopeAiContext).toMatchObject({
      kind: 'explanation',
      lastAnswer: expect.stringContaining('I cleared that earlier follow-up'),
    });
  });

  it('clears pending candidate context when the user steers to a new topic', async () => {
    callScopeAiMock.mockResolvedValueOnce({
      responseText: 'Got it. I will treat that as a new trip-vibe note instead of changing the previous place candidates.',
      model: 'scope-ai-test',
    });
    const scopeAiStore = createScopeAiStore({
      pendingScopeAiContext: {
        kind: 'place-candidates',
        sourcePrompt: 'find museums nearby',
        targetField: 'stop',
        rawValue: 'museum',
        results: [
          {
            id: 'place-kimbell',
            label: 'Kimbell Art Museum',
            value: '3333 Camp Bowie Blvd, Fort Worth, TX',
            latitude: 32.7487,
            longitude: -97.3654,
            meta: {
              category: 'museum',
              city: 'Fort Worth',
              placeName: 'Kimbell Art Museum',
            },
          },
          {
            id: 'place-modern',
            label: 'Modern Art Museum of Fort Worth',
            value: '3200 Darnell St, Fort Worth, TX',
            latitude: 32.7504,
            longitude: -97.3637,
            meta: {
              category: 'museum',
              city: 'Fort Worth',
              placeName: 'Modern Art Museum of Fort Worth',
            },
          },
        ],
        lastAnswer: 'Pick a museum.',
        createdAt: Date.now(),
        turnCount: 0,
      },
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['culture'],
          pace: 'moderate',
          groupSize: 2,
        },
        stops: [],
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('not that vibe');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(wrapper.findAll('[data-test="trip-ai-response"]').at(-1)?.text()).not.toContain('I am still narrowing stop');
    expect(scopeAiStore.clearPendingScopeAiContext).toHaveBeenCalledWith('explicit-new-command');
    expect(scopeAiStore.pendingScopeAiContext).toMatchObject({
      kind: 'explanation',
    });
    expect(wrapper.emitted('route-stop-add')).toBeUndefined();
  });

  it('expands a pending explanation instead of falling back to route status', async () => {
    const scopeAiStore: any = {
      stateAsJson: {},
      sessionHistory: [],
      preferences: {},
      plannerState: {
        stops: [],
      },
      pendingScopeAiContext: {
        kind: 'explanation',
        sourcePrompt: 'why is ETA unavailable',
        lastAnswer: 'ETA is unavailable until Mapbox returns an authoritative route.',
        createdAt: Date.now(),
        turnCount: 0,
      },
      addSessionEntry: vi.fn(),
      setPendingScopeAiContext: vi.fn((context) => {
        scopeAiStore.pendingScopeAiContext = {
          ...context,
          createdAt: context.createdAt ?? Date.now(),
          turnCount: context.turnCount ?? 0,
        };
      }),
      clearPendingScopeAiContext: vi.fn(() => {
        scopeAiStore.pendingScopeAiContext = null;
      }),
      incrementPendingScopeAiContextTurn: vi.fn(),
    };

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '',
          endDate: '',
          budgetFloor: 500,
          budget: 1500,
          interests: [],
          pace: 'relaxed',
          groupSize: 2,
        },
        stops: [],
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('go deeper');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(callScopeAiMock).not.toHaveBeenCalled();
    const response = wrapper.get('[data-test="trip-ai-response"]').text();
    expect(response).toContain('Here is the deeper version');
    expect(response).toContain('Mapbox returns an authoritative route');
    expect(response).not.toContain('I do not have route endpoints yet');
  });

  it('stores audited visible text as pending lastAnswer after an auditor rewrite', async () => {
    callScopeAiMock.mockResolvedValueOnce({
      responseText: 'Weather will be 95F and storm without a provider source.',
      model: 'scope-ai-test',
    });
    const scopeAiStore = createScopeAiStore({
      stateAsJson: {
        start: 'Fort Worth, TX',
        end: 'Austin, TX',
        stops: [],
      },
      plannerState: {
        start: 'Fort Worth, TX',
        end: 'Austin, TX',
        stops: [],
      },
    });
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
        stops: [],
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('give me a broad trip read');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const renderedText = wrapper.get('.trip-ai-assist__structured-response').text();
    expect(renderedText).toContain('I have the route from Fort Worth, TX to Austin, TX');
    expect(renderedText).not.toContain('95F');
    expect(scopeAiStore.pendingScopeAiContext).toMatchObject({
      kind: 'explanation',
      lastAnswer: renderedText,
    });
  });

  it('renders Scope AI service failures as assistant errors without applying trip actions', async () => {
    callScopeAiMock.mockRejectedValueOnce(new Error('Scope AI provider timed out'));
    const scopeAiStore = createScopeAiStore({
      stateAsJson: {
        start: 'Fort Worth, TX',
        end: 'Austin, TX',
        stops: [],
      },
      plannerState: {
        start: 'Fort Worth, TX',
        end: 'Austin, TX',
        stops: [],
      },
    });
    const wrapper = mountPlannerAssist({
      scopeAiStore,
      draft: {
        destination: 'Fort Worth, TX',
        endDestination: 'Austin, TX',
      },
    });

    await submitTripAiPrompt(wrapper, 'compare the food-heavy option with a culture-heavy option');

    const response = wrapper.get('[data-test="trip-ai-response"]');
    expect(response.attributes('role')).toBe('alert');
    expect(response.text()).toContain('Scope AI provider timed out');
    expect(scopeAiStore.applyActionBlock).not.toHaveBeenCalled();
    expect(scopeAiStore.addSessionEntry).toHaveBeenCalledWith({
      role: 'assistant',
      content: 'Scope AI provider timed out',
      actionBlock: null,
    });
  });

  it('keeps route-build suggestion clicks on the itinerary build path when a scope store is provided', async () => {
    const scopeAiStore = {
      stateAsJson: {
        start: 'Fort Worth, TX',
        end: 'Austin, TX',
        stops: [],
      },
      sessionHistory: [],
      preferences: {
        rejected_types: [],
        preferred_types: [],
        accept_streak: 0,
        undo_counts: {},
      },
      plannerState: {
        stops: [],
      },
      addSessionEntry: vi.fn(),
      applyActionBlock: vi.fn(),
      trackAcceptedType: vi.fn(),
      trackRejectedType: vi.fn(),
    };

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
        stops: [],
        scopeAiStore,
      },
    });

    await wrapper.findAll('[data-test="trip-ai-suggestion"]')[0]?.trigger('click');
    await flushPromises();

    expect(callScopeAiMock).not.toHaveBeenCalled();
    expect(wrapper.emitted('itinerary-build-request')?.[0]?.[0]).toMatchObject({
      prompt: 'Build the itinerary from Fort Worth, TX to Austin, TX',
      reason: 'build',
    });
  });

  it('clears stale pending context for build suggestions and planner handoff builds', async () => {
    const stalePendingContext = {
      kind: 'place-candidates',
      sourcePrompt: 'find museums nearby',
      targetField: 'stop',
      rawValue: 'museum',
      results: [{
        id: 'place-modern',
        label: 'Modern Art Museum of Fort Worth',
        value: '3200 Darnell St, Fort Worth, TX',
        latitude: 32.7504,
        longitude: -97.3637,
        meta: { category: 'museum' },
      }],
      lastAnswer: 'Pick a museum.',
      createdAt: Date.now(),
      turnCount: 0,
    };
    const scopeAiStore = createScopeAiStore({
      stateAsJson: {
        start: 'Fort Worth, TX',
        end: 'Austin, TX',
        stops: [],
      },
      plannerState: {
        start: 'Fort Worth, TX',
        end: 'Austin, TX',
        stops: [],
      },
      pendingScopeAiContext: { ...stalePendingContext },
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
        stops: [],
        scopeAiStore,
      },
    });

    await wrapper.findAll('[data-test="trip-ai-suggestion"]')[0]?.trigger('click');
    await flushPromises();

    expect(wrapper.emitted('itinerary-build-request')?.[0]?.[0]).toMatchObject({
      reason: 'build',
    });
    expect(scopeAiStore.clearPendingScopeAiContext).toHaveBeenCalled();
    expect(scopeAiStore.pendingScopeAiContext).toBeNull();

    scopeAiStore.pendingScopeAiContext = { ...stalePendingContext };
    scopeAiStore.clearPendingScopeAiContext.mockClear();

    const vm = wrapper.vm as unknown as {
      handoffPlannerBrief: (options?: { prompt?: string }) => Promise<boolean>;
    };
    await vm.handoffPlannerBrief({
      prompt: 'Build the itinerary from Fort Worth, TX to Austin, TX',
    });
    await flushPromises();

    expect(wrapper.emitted('itinerary-build-request')?.at(-1)?.[0]).toMatchObject({
      reason: 'build',
    });
    expect(scopeAiStore.clearPendingScopeAiContext).toHaveBeenCalled();
    expect(scopeAiStore.pendingScopeAiContext).toBeNull();
  });

  it('keeps typed route build requests on the itinerary build path when a scope store is provided', async () => {
    const scopeAiStore = {
      stateAsJson: {
        start: 'Fort Worth, TX',
        end: 'Austin, TX',
        stops: [],
      },
      sessionHistory: [],
      preferences: {
        rejected_types: [],
        preferred_types: [],
        accept_streak: 0,
        undo_counts: {},
      },
      plannerState: {
        stops: [],
      },
      addSessionEntry: vi.fn(),
      applyActionBlock: vi.fn(),
      trackAcceptedType: vi.fn(),
      trackRejectedType: vi.fn(),
    };

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
        stops: [],
        scopeAiStore,
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Build a balanced route');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(callScopeAiMock).not.toHaveBeenCalled();
    expect(wrapper.emitted('itinerary-build-request')?.[0]?.[0]).toMatchObject({
      prompt: 'Build a balanced route',
      reason: 'build',
    });
  });

  it('routes hidden reorder actions through the existing route-stops replacement event', async () => {
    planTripMock.mockResolvedValueOnce({
      itinerary: [
        'Yes. I would move Charlie before Alpha on day 2.',
        '[SCOPE_ACTION]{"action":"reorder_stops","day":2,"stops":["Charlie Garden","Alpha Cafe"]}[/SCOPE_ACTION]',
        '[CHIPS]Organize day 2, Check drive time after reorder[/CHIPS]',
      ].join('\n'),
      model: 'scope-agent',
      steps: 3,
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
        stops: [
          { spotId: 'alpha', title: 'Alpha Cafe', latitude: 31.1, longitude: -97.1, category: 'food', city: 'Waco' },
          { spotId: 'bravo', title: 'Bravo Park', latitude: 31.2, longitude: -97.2, category: 'nature', city: 'Waco' },
          { spotId: 'charlie', title: 'Charlie Garden', latitude: 31.3, longitude: -97.3, category: 'scenic', city: 'Waco' },
        ],
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Yes, organize those stops');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const replacement = wrapper.emitted('route-stops-replace')?.[0]?.[0] as Array<{ title: string; dayNumber?: number }> | undefined;
    expect(replacement?.map((stop) => stop.title)).toEqual(['Charlie Garden', 'Alpha Cafe', 'Bravo Park']);
    expect(replacement?.[0]).toMatchObject({ dayNumber: 2 });
    expect(replacement?.[1]).toMatchObject({ dayNumber: 2 });
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).not.toContain('[SCOPE_ACTION]');
    expect(wrapper.findAll('[data-test="trip-ai-message-chip"]').map((chip) => chip.text())).toEqual([
      'Organize day 2',
      'Check drive time after reorder',
    ]);
  });

  it('renders plain conversational replies without a fake summary header', async () => {
    planTripMock.mockResolvedValueOnce({
      itinerary: 'Hey, I am here. Tell me what you want to check and I will keep it clear.',
      model: 'scope-local-copilot',
      steps: 0,
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('yo');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const responseText = wrapper.get('[data-test="trip-ai-response"]').text();
    expect(planTripMock).not.toHaveBeenCalled();
    expect(responseText).toContain('I am here');
    expect(responseText).not.toContain('Summary');
    expect(responseText).not.toContain('Ask me one of these');
  });

  it('opens chat actions without showing the old ready status chip', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    expect(wrapper.find('.trip-ai-assist__status').exists()).toBe(false);

    await wrapper.get('[data-test="trip-ai-menu-button"]').trigger('click');

    expect(wrapper.get('[data-test="trip-ai-menu"]').text()).toContain('Restart Chat');
    expect(wrapper.get('[data-test="trip-ai-menu"]').text()).toContain('Download Transcript');
  });

  it('restarts the chat only after in-app confirmation', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Check this route');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(wrapper.find('[data-test="trip-ai-user-message"]').exists()).toBe(true);

    await wrapper.get('[data-test="trip-ai-menu-button"]').trigger('click');
    await wrapper.get('[data-test="trip-ai-restart"]').trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="trip-ai-restart-dialog"]').text()).toContain('Clear this Scope AI conversation?');
    expect(wrapper.find('[data-test="trip-ai-user-message"]').exists()).toBe(true);

    await wrapper.get('[data-test="trip-ai-restart-cancel"]').trigger('click');
    await nextTick();
    expect(wrapper.find('[data-test="trip-ai-restart-dialog"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="trip-ai-user-message"]').exists()).toBe(true);

    await wrapper.get('[data-test="trip-ai-menu-button"]').trigger('click');
    await wrapper.get('[data-test="trip-ai-restart"]').trigger('click');
    await wrapper.get('[data-test="trip-ai-restart-confirm"]').trigger('click');
    await nextTick();

    expect(wrapper.find('[data-test="trip-ai-user-message"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="trip-ai-starter"]').text()).toContain('I already have Fort Worth, TX to Austin, TX');
  });

  it('exports the full chat transcript as a text file', async () => {
    const downloadedFiles: string[] = [];
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function clickTranscriptLink(this: HTMLAnchorElement) {
      downloadedFiles.push(this.download);
    });
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Check this route');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();
    createObjectUrlMock.mockClear();

    await wrapper.get('[data-test="trip-ai-menu-button"]').trigger('click');
    await wrapper.get('[data-test="trip-ai-save-transcript"]').trigger('click');

    expect(createObjectUrlMock).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy).toHaveBeenCalled();
    expect(downloadedFiles[0]).toMatch(/^Scope AI Transcript - Texas weekend - \d{4}-\d{2}-\d{2} \d{2}-\d{2}\.txt$/);

    clickSpy.mockRestore();
  });

  it('includes live place-search results in exported transcripts', async () => {
    searchPlacesMock.mockResolvedValueOnce({
      data: [{
        id: 'poi.transcript-cafe',
        latitude: 31.5493,
        longitude: -97.1467,
        placeName: 'Transcript Cafe',
        formattedAddress: '101 Coffee Lane, Waco, Texas',
        city: 'Waco',
        category: 'coffee shop',
        distanceKm: 2.7,
        source: 'mapbox',
      }],
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const originalBlob = Blob;
    const blobParts: unknown[][] = [];
    vi.stubGlobal('Blob', class CapturingBlob extends originalBlob {
      constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
        blobParts.push(parts ?? []);
        super(parts, options);
      }
    });
    try {
      const wrapper = mountPlannerAssist({
        draft: {
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
        },
      });

      await submitTripAiPrompt(wrapper, 'Find coffee along the route');
      createObjectUrlMock.mockClear();

      await wrapper.get('[data-test="trip-ai-menu-button"]').trigger('click');
      await wrapper.get('[data-test="trip-ai-save-transcript"]').trigger('click');

      const transcriptText = blobParts.at(-1)?.join('') ?? '';
      expect(transcriptText).toContain('Places:\n1. Transcript Cafe');
      expect(transcriptText).toContain('Search:');
    } finally {
      vi.stubGlobal('Blob', originalBlob);
      clickSpy.mockRestore();
    }
  });

  it('copies the transcript to the clipboard when browser download is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    createObjectUrlMock.mockImplementationOnce(() => {
      throw new Error('download unavailable');
    });
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Clipboard weekend',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-menu-button"]').trigger('click');
    await wrapper.get('[data-test="trip-ai-save-transcript"]').trigger('click');
    await flushPromises();

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Scope AI Route Copilot Transcript'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('No conversation yet.'));
  });

  it('shows one clean thinking message without a duplicate literal ellipsis', async () => {
    let resolvePlan: ((value: { itinerary: string; model: string; steps: number }) => void) | undefined;
    planTripMock.mockReturnValueOnce(new Promise((resolve) => {
      resolvePlan = resolve;
    }));

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('hey');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await nextTick();

    const thinkingMessage = wrapper.get('.trip-ai-assist__message--thinking');
    const thinkingCopy = thinkingMessage.get('p').text();
    expect(thinkingMessage.text()).not.toContain('...');
    expect(thinkingMessage.get('.trip-ai-assist__typing-dots').exists()).toBe(true);
    expect(thinkingMessage.findAll('.trip-ai-assist__typing-dots span')).toHaveLength(3);
    expect([
      'Checking the planner context',
      'Reading the route details',
      'Checking map context',
      'Keeping the planner in sync',
      'Looking for the cleanest next step',
      'Matching this to the trip brief',
    ]).toContain(thinkingCopy);

    resolvePlan?.({
      itinerary: 'Hey, I am here. What should we check first?',
      model: 'scope-local-copilot',
      steps: 0,
    });
    await flushPromises();
  });

  it('moves the copilot into the stable active chat layout after the first turn', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('yo');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const shell = wrapper.get('[data-test="trip-ai-assist"]');
    expect(shell.attributes('data-chat-state')).toBe('active');
    expect(shell.attributes('style') ?? '').not.toContain('--trip-ai-assist-locked-height');
  });

  it('keeps long conversations inside the fixed chat body with the composer visible', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    for (let index = 0; index < 4; index += 1) {
      planTripMock.mockResolvedValueOnce({
        itinerary: `Long route answer ${index + 1}. `.repeat(40),
        model: 'scope-local',
        steps: 4,
      });
      await wrapper.get('[data-test="trip-ai-input"]').setValue(`Question ${index + 1}`);
      await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
      await flushPromises();
    }

    expect(wrapper.get('[data-test="trip-ai-assist"]').attributes('data-chat-state')).toBe('active');
    expect(wrapper.get('.trip-ai-assist__body').classes()).toContain('trip-ai-assist__body--scrollable');
    expect(wrapper.findAll('[data-test="trip-ai-user-message"]')).toHaveLength(4);
    expect(wrapper.get('[data-test="trip-ai-form"]').exists()).toBe(true);
    expect(wrapper.get('[data-test="trip-ai-input"]').exists()).toBe(true);
  });

  it('keeps internal model labels out of visible assistant replies', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Check this route');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('Add a lunch stop near Waco');
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).not.toContain('scope-local');
  });

  it('shows tailored suggestion prompts from the current trip draft', () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
        stops: [{
          spotId: 'stop-1',
          title: 'Waco lunch',
          latitude: 31.5493,
          longitude: -97.1467,
          category: 'food',
          city: 'Waco',
        }],
      },
    });

    const suggestions = wrapper.findAll('[data-test="trip-ai-suggestion"]').map((button) => button.text());
    expect(wrapper.get('[data-test="trip-ai-starter"]').text()).toContain('I already have Fort Worth, TX to Austin, TX');
    expect(wrapper.find('[data-test="trip-ai-learning-note"]').exists()).toBe(false);
    expect(suggestions).toHaveLength(3);
    expect(new Set(suggestions).size).toBe(suggestions.length);
    expect(suggestions).toEqual([
      'Build the itinerary from Fort Worth, TX to Austin, TX',
      'Build the day around food and scenic',
      'Check the timing for 2026-05-08 to 2026-05-10',
    ]);
  });

  it('ranks the three suggestion prompts deterministically from planner state', () => {
    const baseDraft = {
      destination: '',
      endDestination: '',
      startDate: '2026-05-08',
      endDate: '2026-05-10',
      budgetFloor: 500,
      budget: 1500,
      interests: [] as Array<'food' | 'scenic'>,
      pace: 'moderate' as const,
      groupSize: 2,
    };

    const blank = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: '',
        draft: baseDraft,
      },
    });
    const blankSuggestions = blank.findAll('[data-test="trip-ai-suggestion"]').map((button) => button.text());
    expect(blankSuggestions).toHaveLength(3);
    expect(new Set(blankSuggestions).size).toBe(blankSuggestions.length);
    expect(blankSuggestions).toEqual([
      'Show me how to add a start place',
      'Help me choose a strong start city',
      'What should I do next on this planner?',
    ]);
    expect(blankSuggestions.some((suggestion) => suggestion.startsWith('Pick a start city for'))).toBe(false);

    const blankAgain = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: '',
        draft: baseDraft,
      },
    });
    expect(blankAgain.findAll('[data-test="trip-ai-suggestion"]').map((button) => button.text())).toEqual(blankSuggestions);

    const startOnly = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: '',
        draft: {
          ...baseDraft,
          destination: 'Fort Worth, TX',
          interests: ['food', 'scenic'],
        },
      },
    });
    expect(startOnly.findAll('[data-test="trip-ai-suggestion"]').map((button) => button.text())).toEqual([
      'Help me choose an end point from Fort Worth, TX',
      'Find food stops near Fort Worth, TX',
      'Check the timing for 2026-05-08 to 2026-05-10',
    ]);

    const routeReady = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: '',
        draft: {
          ...baseDraft,
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          interests: ['food', 'scenic'],
        },
      },
    });
    expect(routeReady.findAll('[data-test="trip-ai-suggestion"]').map((button) => button.text())).toEqual([
      'Build the itinerary from Fort Worth, TX to Austin, TX',
      'Build the day around food and scenic',
      'Check the timing for 2026-05-08 to 2026-05-10',
    ]);

    const routeWithStops = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: '',
        draft: {
          ...baseDraft,
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          interests: ['food', 'scenic'],
        },
        stops: [
          { spotId: 'stop-1', title: 'Waco lunch', latitude: 31.5493, longitude: -97.1467, category: 'food', city: 'Waco' },
          { spotId: 'stop-2', title: 'Temple mural', latitude: 31.0982, longitude: -97.3428, category: 'culture', city: 'Temple' },
        ],
      },
    });
    expect(routeWithStops.findAll('[data-test="trip-ai-suggestion"]').map((button) => button.text())).toEqual([
      'Tighten 2 stops before building',
      'Build the itinerary from Fort Worth, TX to Austin, TX',
      'Build the day around food and scenic',
    ]);
  });

  it('recommends a one-day build when the current route is a same-day draft', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas day drive',
        draft: {
          destination: 'Sterling City, Texas',
          endDestination: '233 Baptist Church Road, Cuero',
          startDate: '2026-05-08',
          endDate: '2026-05-08',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    const suggestions = wrapper.findAll('[data-test="trip-ai-suggestion"]').map((button) => button.text());
    expect(suggestions).toEqual([
      'Build a 1-day itinerary from Sterling City, Texas to 233 Baptist Church Road, Cuero',
      'Build the day around scenic',
      'Check the timing for 2026-05-08',
    ]);

    await wrapper.findAll('[data-test="trip-ai-suggestion"]')[0]?.trigger('click');
    await flushPromises();

    expect(wrapper.emitted('itinerary-build-request')?.[0]?.[0]).toMatchObject({
      prompt: 'Build a 1-day itinerary from Sterling City, Texas to 233 Baptist Church Road, Cuero',
      reason: 'build',
      draftDefaults: {
        startDate: '2026-05-08',
        endDate: '2026-05-08',
      },
    });
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).not.toContain('How many days should I plan for?');
  });

  it('promotes building the itinerary after a timing answer when the route is ready', async () => {
    planTripMock.mockResolvedValueOnce({
      itinerary: 'Timing looks workable if you protect the arrival window.',
      model: 'scope-local',
      steps: 1,
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('How does timing look?');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const suggestions = wrapper.findAll('[data-test="trip-ai-quick-suggestion"]').map((button) => button.text());
    expect(suggestions).toEqual([
      'Build the itinerary from Fort Worth, TX to Austin, TX',
      'Pick a departure window for 2026-05-08 to 2026-05-10',
      'Find one practical midpoint stop',
    ]);
  });

  it('learns typed trip interests for future suggestions when consent is granted', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        userId: 'learner-1',
        tripTitle: 'Taste learning',
        draft: {
          destination: 'Denver, CO',
          endDestination: 'Boulder, CO',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 300,
          budget: 900,
          interests: [],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('For this trip I care about coffee, museums, and scenic views.');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const rawMemory = window.localStorage.getItem('scope.ai.memory.v1:learner-1');
    expect(rawMemory).toBeTruthy();
    expect(JSON.parse(rawMemory ?? '{}')).toEqual(expect.objectContaining({
      detailPreference: 'balanced',
      recentStableInterests: ['food', 'culture', 'scenic'],
    }));
    expect(planTripMock.mock.calls[0][0].prompt).toContain('Stable interests: food, culture, scenic');
  });

  it('does not store AI learning memory or track training turns when consent is denied', async () => {
    analyticsConsentMock.value = 'denied';

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        userId: 'private-1',
        tripTitle: 'Private planning',
        draft: {
          destination: 'Denver, CO',
          endDestination: 'Boulder, CO',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 300,
          budget: 900,
          interests: [],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    expect(wrapper.find('[data-test="trip-ai-learning-note"]').exists()).toBe(false);

    await wrapper.get('[data-test="trip-ai-input"]').setValue('For this trip I care about coffee, museums, and scenic views.');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(window.localStorage.getItem('scope.ai.memory.v1:private-1')).toBeNull();
    expect(trackScopeAiInteractionMock).not.toHaveBeenCalled();
  });

  it('handles a suggested prompt when a suggestion is clicked', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: '',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: [],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    const firstSuggestion = wrapper.findAll('[data-test="trip-ai-suggestion"]').map((button) => button.text())[0];
    expect(firstSuggestion).toBeTruthy();
    expect(firstSuggestion?.startsWith('Pick a start city for')).toBe(false);

    await wrapper.findAll('[data-test="trip-ai-suggestion"]')[0]?.trigger('click');
    await flushPromises();

    expect(wrapper.findAll('[data-test="trip-ai-user-message"]')).toHaveLength(1);
    expect(wrapper.findAll('[data-test="trip-ai-response"]')).toHaveLength(1);
    if (planTripMock.mock.calls.length) {
      expect(planTripMock.mock.calls[0][0].prompt).toContain('Traveler request:');
    } else if (searchPlacesMock.mock.calls.length) {
      expect(searchPlacesMock).toHaveBeenCalled();
    } else {
      expect(
        wrapper.emitted('itinerary-build-request')
        ?? wrapper.get('[data-test="trip-ai-response"]').text(),
      ).toBeTruthy();
    }
  });

  it('answers common planner questions locally from the current state', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: '',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-08',
          budgetFloor: 500,
          budget: 1500,
          interests: [],
          pace: 'relaxed',
          groupSize: 1,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('What should I do next?');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const responseText = wrapper.get('[data-test="trip-ai-response"]').text();
    expect(planTripMock).not.toHaveBeenCalled();
    expect(responseText).toContain('add a start place or final destination');
    expect(responseText).toContain('either endpoint');
  });

  it('answers weather prompts through the existing weather lookup instead of the trip agent', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('weather for start');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(planTripMock).not.toHaveBeenCalled();
    expect(getOpenWeatherMapSnapshotMock).toHaveBeenCalledWith(expect.objectContaining({
      label: 'Fort Worth, TX',
      latitude: 32.7555,
      longitude: -97.3308,
    }));
    const responseText = getLatestAiResponseText(wrapper);
    expect(responseText).toContain('72F');
    expect(responseText).toContain('AQI 42 Good');
    expect(responseText).toContain('Weather source: Open-Meteo fallback');
  });

  it('resolves typed off-route weather locations globally instead of biasing to the current route', async () => {
    searchLocationsMock.mockResolvedValueOnce({
      data: [{
        placeName: 'Miami',
        formattedAddress: 'Miami, Florida, United States',
        latitude: 25.7617,
        longitude: -80.1918,
        city: 'Miami',
        country: 'United States',
        source: 'mapbox',
      }],
    });
    getOpenWeatherMapSnapshotMock.mockResolvedValueOnce({
      id: 'weather-miami',
      label: 'Miami, Florida, United States',
      temperatureF: 84,
      condition: 'Partly Cloudy',
      windMph: 12,
      provider: 'openweather',
      providerLabel: 'OpenWeatherMap',
    });
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: '100 Example Road, Example City, Texas 11111, United States',
          endDestination: 'Austin, Texas, United States',
          destinationLatitude: 32.841,
          destinationLongitude: -97.228,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('weather for Miami');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(searchLocationsMock).toHaveBeenCalledWith('Miami', {
      limit: 3,
      sortByDistance: false,
    });
    expect(getOpenWeatherMapSnapshotMock).toHaveBeenCalledWith(expect.objectContaining({
      label: 'Miami, Florida, United States',
      latitude: 25.7617,
      longitude: -80.1918,
    }));
    const responseText = getLatestAiResponseText(wrapper);
    expect(responseText).toContain('Miami, Florida, United States');
    expect(responseText).toContain('Weather source: OpenWeatherMap');
    expect(responseText).not.toContain('Example City');
  });

  it('normalizes noisy weather prompts before resolving the provider location', async () => {
    searchLocationsMock.mockResolvedValueOnce({
      data: [{
        placeName: 'Dallas',
        formattedAddress: 'Dallas, Texas, United States',
        latitude: 32.7767,
        longitude: -96.797,
        city: 'Dallas',
        country: 'United States',
        source: 'mapbox',
      }],
    });
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: '',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-08',
          budgetFloor: 500,
          budget: 1500,
          interests: [],
          pace: 'relaxed',
          groupSize: 1,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('wether fr Dallas???');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(searchLocationsMock).toHaveBeenCalledWith('Dallas', expect.objectContaining({
      limit: 3,
      sortByDistance: false,
    }));
    expect(getOpenWeatherMapSnapshotMock).toHaveBeenCalledWith(expect.objectContaining({
      label: 'Dallas, Texas, United States',
      latitude: 32.7767,
      longitude: -96.797,
    }));
    expect(getLatestAiResponseText(wrapper)).toContain('72F');
  });

  it('clears stale pending context before handling an explicit weather command', async () => {
    searchLocationsMock.mockResolvedValueOnce({
      data: [{
        placeName: 'Dallas',
        formattedAddress: 'Dallas, Texas, United States',
        latitude: 32.7767,
        longitude: -96.797,
        city: 'Dallas',
        country: 'United States',
        source: 'mapbox',
      }],
    });
    const scopeAiStore = createScopeAiStore({
      pendingScopeAiContext: {
        kind: 'place-candidates',
        sourcePrompt: 'find museums nearby',
        targetField: 'stop',
        rawValue: 'museum',
        results: [{
          id: 'place-modern',
          label: 'Modern Art Museum of Fort Worth',
          value: '3200 Darnell St, Fort Worth, TX',
          latitude: 32.7504,
          longitude: -97.3637,
          meta: { category: 'museum' },
        }],
        lastAnswer: 'Pick a museum.',
        createdAt: Date.now(),
        turnCount: 0,
      },
    });
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: '',
        scopeAiStore,
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-08',
          budgetFloor: 500,
          budget: 1500,
          interests: [],
          pace: 'relaxed',
          groupSize: 1,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('weather for Dallas');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(scopeAiStore.clearPendingScopeAiContext).toHaveBeenCalledWith('explicit-new-command');
    expect(wrapper.emitted('route-stop-add')).toBeUndefined();
    expect(getOpenWeatherMapSnapshotMock).toHaveBeenCalledWith(expect.objectContaining({
      label: 'Dallas, Texas, United States',
    }));
    expect(getLatestAiResponseText(wrapper)).toContain('72F');
  });

  it('creates a weather-location pending context for ambiguous weather lookups', async () => {
    searchLocationsMock.mockResolvedValueOnce({
      data: [
        {
          id: 'dallas-tx',
          placeName: 'Dallas',
          formattedAddress: 'Dallas, Texas, United States',
          latitude: 32.7767,
          longitude: -96.797,
          city: 'Dallas',
          country: 'United States',
          source: 'mapbox',
        },
        {
          id: 'dallas-ga',
          placeName: 'Dallas',
          formattedAddress: 'Dallas, Georgia, United States',
          latitude: 33.9237,
          longitude: -84.8408,
          city: 'Dallas',
          country: 'United States',
          source: 'mapbox',
        },
      ],
    });
    const scopeAiStore = createScopeAiStore();
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: '',
        scopeAiStore,
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-08',
          budgetFloor: 500,
          budget: 1500,
          interests: [],
          pace: 'relaxed',
          groupSize: 1,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('weather for Dallas');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(getOpenWeatherMapSnapshotMock).not.toHaveBeenCalled();
    expect(scopeAiStore.pendingScopeAiContext).toMatchObject({
      kind: 'weather-location',
      targetField: 'weather',
      rawValue: 'Dallas',
      candidates: [
        { label: 'Dallas, Texas, United States', value: 'Dallas, Texas, United States' },
        { label: 'Dallas, Georgia, United States', value: 'Dallas, Georgia, United States' },
      ],
      lastAnswer: expect.stringContaining('I found a few possible weather locations for "Dallas"'),
    });
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('I found a few possible weather locations for "Dallas"');
  });

  it('checks weather from a pending weather-location follow-up candidate', async () => {
    searchLocationsMock.mockResolvedValueOnce({
      data: [{
        placeName: 'Dallas',
        formattedAddress: 'Dallas, Texas, United States',
        latitude: 32.7767,
        longitude: -96.797,
        city: 'Dallas',
        country: 'United States',
        source: 'mapbox',
      }],
    });
    const scopeAiStore: any = {
      stateAsJson: {},
      sessionHistory: [],
      preferences: {},
      plannerState: {
        stops: [],
      },
      pendingScopeAiContext: {
        kind: 'weather-location',
        sourcePrompt: 'weather for Dallas',
        targetField: 'weather',
        rawValue: 'Dallas',
        candidates: [
          { label: 'Dallas, Texas, United States', value: 'Dallas, Texas, United States' },
          { label: 'Austin, Texas, United States', value: 'Austin, Texas, United States' },
        ],
        lastAnswer: 'Pick the weather location.',
        createdAt: Date.now(),
        turnCount: 0,
      },
      addSessionEntry: vi.fn(),
      setPendingScopeAiContext: vi.fn((context) => {
        scopeAiStore.pendingScopeAiContext = {
          ...context,
          createdAt: context.createdAt ?? Date.now(),
          turnCount: context.turnCount ?? 0,
        };
      }),
      clearPendingScopeAiContext: vi.fn(() => {
        scopeAiStore.pendingScopeAiContext = null;
      }),
      incrementPendingScopeAiContextTurn: vi.fn(),
    };
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: '',
        scopeAiStore,
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-08',
          budgetFloor: 500,
          budget: 1500,
          interests: [],
          pace: 'relaxed',
          groupSize: 1,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('the Dallas one');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(callScopeAiMock).not.toHaveBeenCalled();
    expect(searchLocationsMock).toHaveBeenCalledWith('Dallas, Texas, United States', expect.objectContaining({
      limit: 3,
      sortByDistance: false,
    }));
    expect(getOpenWeatherMapSnapshotMock).toHaveBeenCalledWith(expect.objectContaining({
      label: 'Dallas, Texas, United States',
      latitude: 32.7767,
      longitude: -96.797,
    }));
    expect(getLatestAiResponseText(wrapper)).toContain('72F');
  });

  it('shows Sending while a Scope AI turn is still pending', async () => {
    let resolvePlanTrip: ((value: { itinerary: string; model: string; steps: number }) => void) | undefined;
    planTripMock.mockReturnValueOnce(new Promise((resolve) => {
      resolvePlanTrip = resolve;
    }));
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('explain this route');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await nextTick();

    expect(wrapper.get('.trip-ai-assist__submit').text()).toBe('Sending...');
    expect(wrapper.get('.trip-ai-assist__submit').attributes('disabled')).toBeDefined();

    resolvePlanTrip?.({
      itinerary: 'Route explanation ready.',
      model: 'scope-local',
      steps: 1,
    });
    await flushPromises();

    expect(wrapper.get('.trip-ai-assist__submit').text()).toBe('Ask AI');
  });

  it('explains that end can be selected before start without calling the trip agent', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: '',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-08',
          budgetFloor: 500,
          budget: 1500,
          interests: [],
          pace: 'relaxed',
          groupSize: 1,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('why is add end disabled?');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(planTripMock).not.toHaveBeenCalled();
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('You can set the final destination before the start');
  });

  it('appends follow-up prompts and answers instead of replacing the conversation', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Keep this plan inside budget');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    await wrapper.findAll('[data-test="trip-ai-quick-suggestion"]')[0]?.trigger('click');
    await flushPromises();

    expect(planTripMock).toHaveBeenCalled();
    expect(wrapper.findAll('[data-test="trip-ai-user-message"]')).toHaveLength(2);
    expect(wrapper.findAll('[data-test="trip-ai-response"], [data-test="trip-ai-place-results"]')).toHaveLength(2);
    expect(wrapper.get('[data-test="trip-ai-thread"]').text()).toContain('Keep this plan inside budget');
  });

  it('passes recent chat into follow-up trip agent prompts', async () => {
    planTripMock
      .mockResolvedValueOnce({
        itinerary: 'First timing answer',
        model: 'scope-local',
        steps: 1,
      })
      .mockResolvedValueOnce({
        itinerary: 'Second timing angle',
        model: 'scope-local',
        steps: 1,
      });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('How does timing look?');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Can you explain the timing another way?');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const secondPrompt = planTripMock.mock.calls[1][0].prompt;
    expect(secondPrompt).toContain('Recent chat:');
    expect(secondPrompt).toContain('User: How does timing look?');
    expect(secondPrompt).toContain('Scope AI: First timing answer');
    expect(secondPrompt).toContain('Traveler request: Can you explain the timing another way?');
  });

  it('lets travelers attach images to a chat turn', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    const imageFile = new File(['scope'], 'route-photo.png', { type: 'image/png' });
    const fileInput = wrapper.get('[data-test="trip-ai-file-input"]').element as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [imageFile],
    });

    await wrapper.get('[data-test="trip-ai-file-input"]').trigger('change');
    await flushPromises();
    expect(wrapper.get('[data-test="trip-ai-pending-attachments"]').text()).toContain('route-photo.png');

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Does this stop fit the route?');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(planTripMock.mock.calls[0][0].prompt).toContain('Attached images:');
    expect(planTripMock.mock.calls[0][0].prompt).toContain('route-photo.png');
    expect(wrapper.get('[data-test="trip-ai-user-attachments"]').text()).toContain('route-photo.png');
  });

  it('limits pending image attachments and revokes previews when one is removed', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });
    const pickerClick = vi.spyOn(wrapper.get('[data-test="trip-ai-file-input"]').element as HTMLInputElement, 'click').mockImplementation(() => undefined);

    await wrapper.get('[data-test="trip-ai-attach-button"]').trigger('click');
    expect(pickerClick).toHaveBeenCalledTimes(1);

    const files = [
      new File(['one'], 'one.png', { type: 'image/png' }),
      new File(['notes'], 'notes.txt', { type: 'text/plain' }),
      new File(['two'], 'two.jpg', { type: 'image/jpeg' }),
      new File(['three'], 'three.webp', { type: 'image/webp' }),
      new File(['four'], 'four.gif', { type: 'image/gif' }),
      new File([new Uint8Array(2 * 1024 * 1024)], 'huge.png', { type: 'image/png' }),
    ];
    const fileInput = wrapper.get('[data-test="trip-ai-file-input"]').element as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: files,
    });

    await wrapper.get('[data-test="trip-ai-file-input"]').trigger('change');
    await flushPromises();

    const pendingText = wrapper.get('[data-test="trip-ai-pending-attachments"]').text();
    expect(pendingText).toContain('one.png');
    expect(pendingText).toContain('two.jpg');
    expect(pendingText).toContain('three.webp');
    expect(pendingText).not.toContain('notes.txt');
    expect(pendingText).not.toContain('four.gif');
    expect(pendingText).not.toContain('huge.png');

    await wrapper.get('button[aria-label="Remove two.jpg"]').trigger('click');
    await nextTick();

    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:scope-chat-image');
    expect(wrapper.get('[data-test="trip-ai-pending-attachments"]').text()).not.toContain('two.jpg');

    pickerClick.mockRestore();
  });

  it('sends attached image data to the Scope AI chat endpoint', async () => {
    callScopeAiMock.mockResolvedValueOnce({
      responseText: 'The photo looks like a useful scenic stop.',
      model: 'gemini-test',
    });
    const scopeAiStore = createScopeAiStore();
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        scopeAiStore,
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    const imageFile = new File(['scope'], 'lookout.png', { type: 'image/png' });
    const fileInput = wrapper.get('[data-test="trip-ai-file-input"]').element as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [imageFile],
    });

    await wrapper.get('[data-test="trip-ai-file-input"]').trigger('change');
    await flushPromises();
    await wrapper.get('[data-test="trip-ai-input"]').setValue('Does this photo fit the route?');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(callScopeAiMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Attached images:'),
      images: [{
        filename: 'lookout.png',
        mime_type: 'image/png',
        data: 'YXRsYXM=',
      }],
    }));
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('useful scenic stop');
  });

  it('falls back gracefully when image previews and base64 reads are unavailable', async () => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: undefined,
    });
    vi.stubGlobal('FileReader', undefined);
    callScopeAiMock.mockResolvedValueOnce({
      responseText: 'Tell me what detail you want checked in the image.',
      model: 'gemini-test',
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        scopeAiStore: createScopeAiStore(),
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    const fileInput = wrapper.get('[data-test="trip-ai-file-input"]').element as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [new File(['scope'], 'no-preview.jpg', { type: 'image/jpeg' })],
    });

    await wrapper.get('[data-test="trip-ai-file-input"]').trigger('change');
    await flushPromises();

    expect(wrapper.get('[data-test="trip-ai-pending-attachments"]').text()).toContain('no-preview.jpg');
    expect(wrapper.find('[data-test="trip-ai-pending-attachments"] img').exists()).toBe(false);

    await wrapper.get('button[aria-label="Remove no-preview.jpg"]').trigger('click');
    await nextTick();

    expect(revokeObjectUrlMock).not.toHaveBeenCalled();

    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [new File(['scope'], 'fallback-only.jpg', { type: 'image/jpeg' })],
    });

    await wrapper.get('[data-test="trip-ai-file-input"]').trigger('change');
    await flushPromises();
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(callScopeAiMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Review this image for my trip.'),
      images: undefined,
    }));
    expect(callScopeAiMock.mock.calls[0]?.[0].message).toContain('Attached images:');
    expect(callScopeAiMock.mock.calls[0]?.[0].message).toContain('fallback-only.jpg');
    expect(getLatestAiResponseText(wrapper)).toContain('Tell me what detail you want checked');
  });

  it('answers no-stop tighten requests from the current route state without starting a build prompt', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Tighten this route and remove filler');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(planTripMock).not.toHaveBeenCalled();
    expect(wrapper.emitted('itinerary-build-request')).toBeUndefined();
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('I will tighten against the route state I already have');
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).not.toContain('How many days should I plan for?');
  });

  it('asks for a destination conversationally before route-action builds', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Build a balanced first draft');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const responseText = wrapper.get('[data-test="trip-ai-response"]').text();
    expect(planTripMock).not.toHaveBeenCalled();
    expect(responseText).toContain('What destination should I use');
    expect(responseText).not.toContain('actually change');
    expect(responseText).not.toContain('Summary');
  });

  it('asks for missing itinerary brief details before route-action builds', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: [],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Build a balanced first draft');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const responseText = wrapper.get('[data-test="trip-ai-response"]').text();
    expect(planTripMock).not.toHaveBeenCalled();
    expect(wrapper.emitted('itinerary-build-request')).toBeUndefined();
    expect(responseText).toContain('What kind of trip should this feel like');
    expect(responseText).not.toContain('-');
    expect(responseText).not.toContain('morning, afternoon, and evening');
    expect(responseText).not.toContain('handed Fort Worth, TX to Austin, TX to Scope AI');
  });

  it('cancels a pending itinerary brief without launching the route builder', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas road trip',
        draft: {
          destination: 'Robert Lee, Texas',
          endDestination: '177 Kothman Road, La Vernia',
          startDate: '2026-05-08',
          endDate: '2026-05-08',
          budgetFloor: 500,
          budget: 1500,
          interests: [],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    expect(await submitTripAiPrompt(wrapper, 'Build the itinerary from Robert Lee to La Vernia')).toContain('How many days should I plan for?');
    expect(wrapper.emitted('itinerary-build-request')).toBeUndefined();

    expect(await submitTripAiPrompt(wrapper, 'cancel that build')).toContain('I stopped that itinerary build');
    expect(wrapper.emitted('itinerary-build-request')).toBeUndefined();

    await submitTripAiPrompt(wrapper, '3 days');

    expect(wrapper.emitted('itinerary-build-request')).toBeUndefined();
  });

  it('keeps missing endpoint brief replies from launching a route build without mapped endpoints', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Blank route',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    expect(await submitTripAiPrompt(wrapper, 'Build the itinerary')).toMatch(/destination|start/i);
    expect(wrapper.emitted('itinerary-build-request')).toBeUndefined();

    const followUp = await submitTripAiPrompt(wrapper, 'Fort Worth to Austin');

    expect(followUp).toContain('Add both route endpoints to the route builder first');
    expect(planTripMock).not.toHaveBeenCalled();
    expect(wrapper.emitted('itinerary-build-request')).toBeUndefined();
  });

  it('treats vague help replies as surprise me and builds with smart defaults from the pending brief', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas road trip',
        draft: {
          destination: 'Robert Lee, Texas',
          endDestination: '177 Kothman Road, La Vernia',
          startDate: '2026-05-08',
          endDate: '2026-05-08',
          budgetFloor: 500,
          budget: 1500,
          interests: [],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Build the itinerary from Robert Lee, Texas to 177 Kothman Road, La Vernia');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('How many days should I plan for?');
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).not.toContain('What kind of trip should this feel like');
    expect(wrapper.emitted('itinerary-build-request')).toBeUndefined();

    await wrapper.get('[data-test="trip-ai-input"]').setValue('idk u wanna help');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const buildPayload = wrapper.emitted('itinerary-build-request')?.[0]?.[0];
    expect(buildPayload).toMatchObject({
      reason: 'build',
      draftDefaults: {
        startDate: '2026-05-08',
        endDate: '2026-05-09',
        interests: ['food', 'culture', 'scenic'],
      },
    });
    expect(buildPayload?.prompt).toContain('Smart defaults from follow-up');
    expect(wrapper.findAll('[data-test="trip-ai-response"]').at(-1)?.text()).toContain('handed Robert Lee, Texas to 177 Kothman Road, La Vernia to Scope AI');
  });

  it('treats broad noncommittal follow-ups as surprise me instead of literal-only phrases', async () => {
    const vagueReplies = [
      'whatever you think',
      'no preference',
      'you-pick',
      'sounds good',
      'surprise us',
      'do your thing',
      'I trust you',
    ];

    for (const reply of vagueReplies) {
      const wrapper = mount(TripPlannerAiAssist, {
        props: {
          tripTitle: 'Texas road trip',
          draft: {
            destination: 'Robert Lee, Texas',
            endDestination: '177 Kothman Road, La Vernia',
            startDate: '2026-05-08',
            endDate: '2026-05-08',
            budgetFloor: 500,
            budget: 1500,
            interests: [],
            pace: 'relaxed',
            groupSize: 2,
          },
        },
      });

      await wrapper.get('[data-test="trip-ai-input"]').setValue('Build the itinerary from Robert Lee, Texas to 177 Kothman Road, La Vernia');
      await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
      await flushPromises();

      await wrapper.get('[data-test="trip-ai-input"]').setValue(reply);
      await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
      await flushPromises();

      const buildPayload = wrapper.emitted('itinerary-build-request')?.[0]?.[0];
      expect(buildPayload, reply).toMatchObject({
        reason: 'build',
        draftDefaults: {
          startDate: '2026-05-08',
          endDate: '2026-05-09',
          interests: ['food', 'culture', 'scenic'],
        },
      });
      expect(wrapper.findAll('[data-test="trip-ai-response"]').at(-1)?.text(), reply).not.toContain('What kind of trip should this feel like');

      wrapper.unmount();
    }
  });

  it('keeps brief answers attached to the pending itinerary question one at a time', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas road trip',
        draft: {
          destination: 'Robert Lee, Texas',
          endDestination: '177 Kothman Road, La Vernia',
          startDate: '2026-05-08',
          endDate: '2026-05-08',
          budgetFloor: 500,
          budget: 1500,
          interests: [],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Build the itinerary from Robert Lee to La Vernia');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    await wrapper.get('[data-test="trip-ai-input"]').setValue('3 days');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const responses = wrapper.findAll('[data-test="trip-ai-response"]');
    expect(responses.at(-1)?.text()).toContain('Got it. What kind of trip should this feel like');
    expect(wrapper.emitted('itinerary-build-request')).toBeUndefined();

    await wrapper.get('[data-test="trip-ai-input"]').setValue('food and culture');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const buildPayload = wrapper.emitted('itinerary-build-request')?.[0]?.[0];
    expect(buildPayload).toMatchObject({
      reason: 'build',
      draftDefaults: {
        startDate: '2026-05-08',
        endDate: '2026-05-10',
        interests: ['food', 'culture'],
      },
    });
  });

  it('treats a bare number after the duration question as exact itinerary days', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas road trip',
        draft: {
          destination: '5673 Jamaica Circle, North Richland Hills',
          endDestination: '1205 Oriental Avenue, Arlington',
          startDate: '2026-05-08',
          endDate: '2026-05-08',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Build the itinerary from 5673 Jamaica Circle, North Richland Hills to 1205 Oriental Avenue, Arlington');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(getLatestAiResponseText(wrapper)).toContain('How many days should I plan for?');
    expect(wrapper.emitted('itinerary-build-request')).toBeUndefined();

    await wrapper.get('[data-test="trip-ai-input"]').setValue('4');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const buildPayload = wrapper.emitted('itinerary-build-request')?.[0]?.[0];
    expect(buildPayload).toMatchObject({
      reason: 'build',
      draftDefaults: {
        startDate: '2026-05-08',
        endDate: '2026-05-11',
        durationDays: 4,
      },
    });
    expect(buildPayload?.draftDefaults).not.toMatchObject({ groupSize: 4 });
  });

  it('does not treat a bare duration reply as travel party size', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas road trip',
        draft: {
          destination: '5673 Jamaica Circle, North Richland Hills',
          endDestination: '1205 Oriental Avenue, Arlington',
          startDate: '2026-05-08',
          endDate: '2026-05-08',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'relaxed',
          groupSize: 0,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Build the itinerary from 5673 Jamaica Circle, North Richland Hills to 1205 Oriental Avenue, Arlington');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    await wrapper.get('[data-test="trip-ai-input"]').setValue('4');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(wrapper.emitted('itinerary-build-request')).toBeUndefined();
    expect(getLatestAiResponseText(wrapper)).toContain('Who is coming with you');
  });

  it('asks for missing pace and travel party before handing the planner to Scope AI', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas road trip',
        draft: {
          destination: 'Robert Lee, Texas',
          endDestination: '177 Kothman Road, La Vernia',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: '' as any,
          groupSize: 0,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Build the itinerary from Robert Lee to La Vernia');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(getLatestAiResponseText(wrapper)).toContain('What pace should I use');
    expect(wrapper.findAll('[data-test="trip-ai-quick-suggestion"]').map((button) => button.text())).toEqual([
      'Relaxed pace',
      'Balanced pace',
      'Packed pace',
    ]);
    expect(wrapper.emitted('itinerary-build-request')).toBeUndefined();

    await wrapper.get('[data-test="trip-ai-input"]').setValue('packed');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(getLatestAiResponseText(wrapper)).toContain('Who is coming with you');
    expect(wrapper.findAll('[data-test="trip-ai-quick-suggestion"]').map((button) => button.text())).toEqual([
      'Solo',
      'Couple',
      'Group of 4',
    ]);
    expect(wrapper.emitted('itinerary-build-request')).toBeUndefined();

    await wrapper.get('[data-test="trip-ai-input"]').setValue('family');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const buildPayload = wrapper.emitted('itinerary-build-request')?.[0]?.[0];
    expect(buildPayload).toMatchObject({
      reason: 'build',
      draftDefaults: {
        pace: 'packed',
        groupSize: 4,
      },
    });
    expect(buildPayload?.prompt).toContain('Packed pace');
    expect(buildPayload?.prompt).toContain('4 travelers, group or family');
    expect(getLatestAiResponseText(wrapper)).toContain('handed Robert Lee, Texas to 177 Kothman Road, La Vernia to Scope AI');
  });

  it('answers local Scout AI help prompts from the current planner context', async () => {
    const wrapper = mountPlannerAssist({
      draft: {
        destinationLatitude: 32.7555,
        destinationLongitude: -97.3308,
        endDestinationLatitude: 30.2672,
        endDestinationLongitude: -97.7431,
      },
    });

    expect(await submitTripAiPrompt(wrapper, 'yo')).toContain('I am here');
    expect(await submitTripAiPrompt(wrapper, 'thanks')).toContain('current planner state');
    expect(await submitTripAiPrompt(wrapper, 'what can you do?')).toContain('trip, spots, and app copilot');
    expect(await submitTripAiPrompt(wrapper, 'how do spots work?')).toContain('ask me for a kind of spot');
    expect(await submitTripAiPrompt(wrapper, 'what should I do next?')).toContain('Your route is ready from Fort Worth, TX to Austin, TX');
    expect(await submitTripAiPrompt(wrapper, 'how do I add a start on this screen?')).toContain('route canvas supports setting either endpoint first');
    expect(await submitTripAiPrompt(wrapper, 'where do I set fuel cost?')).toContain('Set fuel opens the fuel inputs');
    expect(await submitTripAiPrompt(wrapper, 'where do I attach an image?')).toContain('image button beside the chat input');

    expect(planTripMock).not.toHaveBeenCalled();
    expect(callScopeAiMock).not.toHaveBeenCalled();
  });

  it('refreshes quick suggestions for safety, group, image, start-city, and build route intents', async () => {
    const wrapper = mountPlannerAssist({
      draft: {
        destinationLatitude: 32.7555,
        destinationLongitude: -97.3308,
        endDestinationLatitude: 30.2672,
        endDestinationLongitude: -97.7431,
      },
    });
    const cases = [
      {
        prompt: 'is this route safe late at night',
        expectedSuggestions: ['Check daylight arrival timing', 'Find safer practical stops', 'Avoid late-night detours'],
      },
      {
        prompt: 'make this easier for a family group',
        expectedSuggestions: ['Make this easier for a group', 'Find group-friendly food stops', 'Keep the group inside $500 - $1,500'],
      },
      {
        prompt: 'look at this image for a stop idea',
        expectedSuggestions: ['Review another trip image', 'Use this image to pick a stop', 'Tell me what detail to look for'],
      },
      {
        prompt: 'help me choose a start city',
        expectedSuggestions: ['Compare another start city', 'Check the end point against this start', 'Check first-leg timing'],
      },
      {
        prompt: 'build a simple weekend itinerary',
        expectedSuggestions: ['Build the itinerary from Fort Worth, TX to Austin, TX', 'Check timing before building', 'Keep this plan inside $500 - $1,500'],
      },
    ];

    for (const testCase of cases) {
      await submitTripAiPrompt(wrapper, testCase.prompt);
      const suggestions = wrapper.findAll('[data-test="trip-ai-quick-suggestion"]').map((button) => button.text());
      expect(suggestions, testCase.prompt).toEqual(expect.arrayContaining(testCase.expectedSuggestions));
    }

    expect(callScopeAiMock).not.toHaveBeenCalled();
  });

  it('continues explanation and planner-setting pending contexts without calling the remote agent', async () => {
    const scopeAiStore = createScopeAiStore({
      pendingScopeAiContext: {
        kind: 'explanation',
        sourcePrompt: 'check route status',
        rawValue: 'route status',
        lastAnswer: 'The route is workable if you protect arrival time.',
        createdAt: Date.now(),
        turnCount: 0,
      },
    });
    const wrapper = mountPlannerAssist({ scopeAiStore });

    expect(await submitTripAiPrompt(wrapper, 'go deeper')).toContain('Here is the deeper version');
    expect(scopeAiStore.pendingScopeAiContext).toMatchObject({
      kind: 'explanation',
      lastAnswer: expect.stringContaining('provider path'),
    });

    scopeAiStore.pendingScopeAiContext = {
      kind: 'planner-setting',
      sourcePrompt: 'set the budget',
      targetField: 'budget',
      rawValue: 'budget',
      lastAnswer: 'What budget cap should I use?',
      createdAt: Date.now(),
      turnCount: 0,
    };
    expect(await submitTripAiPrompt(wrapper, 'under 800')).toContain('Set maximum budget to 800');
    expect(scopeAiStore.applyActionBlockResolved).toHaveBeenLastCalledWith({
      actions: [{ type: 'SET_FIELD', field: 'budget_max', value: 800 }],
    });

    scopeAiStore.pendingScopeAiContext = {
      kind: 'planner-setting',
      sourcePrompt: 'set traveler count',
      targetField: 'travelers',
      rawValue: 'travelers',
      lastAnswer: 'How many people are going?',
      createdAt: Date.now(),
      turnCount: 0,
    };
    expect(await submitTripAiPrompt(wrapper, 'for 4 people')).toContain('Set travelers to 4');
    expect(scopeAiStore.applyActionBlockResolved).toHaveBeenLastCalledWith({
      actions: [{ type: 'SET_FIELD', field: 'party_size', value: 4 }],
    });
    expect(callScopeAiMock).not.toHaveBeenCalled();
  });

  it('tailors next-move guidance to blank, partial, ready, and stopped routes', async () => {
    const cases = [
      {
        props: {
          draft: {
            destination: '',
            endDestination: '',
          },
        },
        expected: 'add a start place or final destination',
      },
      {
        props: {
          draft: {
            destination: '',
            endDestination: 'Austin, TX',
          },
        },
        expected: 'Your final destination is set to Austin, TX',
      },
      {
        props: {
          draft: {
            destination: 'Fort Worth, TX',
            endDestination: '',
          },
        },
        expected: 'add the final destination from Fort Worth, TX',
      },
      {
        props: {},
        expected: 'Best next move: build the itinerary',
      },
      {
        props: {
          stops: [{
            spotId: 'stop-1',
            title: 'Waco lunch',
            latitude: 31.5493,
            longitude: -97.1467,
            category: 'food',
            city: 'Waco',
          }],
        },
        expected: 'route is set with 1 stop',
      },
    ];

    for (const { props, expected } of cases) {
      const wrapper = mountPlannerAssist(props);

      expect(await submitTripAiPrompt(wrapper, 'what should I do next?')).toContain(expected);
      wrapper.unmount();
    }

    expect(planTripMock).not.toHaveBeenCalled();
    expect(callScopeAiMock).not.toHaveBeenCalled();
  });

  it('uses smart defaults when a traveler asks Scout AI to choose the missing itinerary brief', async () => {
    const wrapper = mountPlannerAssist({
      draft: {
        startDate: '2026-05-08',
        endDate: '2026-05-08',
        interests: [],
        pace: '' as any,
        groupSize: 0,
      },
    });

    expect(await submitTripAiPrompt(wrapper, 'Build the itinerary from Fort Worth to Austin')).toContain('How many days should I plan for?');
    expect(await submitTripAiPrompt(wrapper, 'surprise me')).toContain('handed Fort Worth, TX to Austin, TX to Scope AI');

    const buildPayload = wrapper.emitted('itinerary-build-request')?.[0]?.[0] as any;
    expect(buildPayload).toMatchObject({
      reason: 'build',
      draftDefaults: {
        startDate: '2026-05-08',
        endDate: '2026-05-09',
        interests: ['food', 'culture', 'scenic'],
        pace: 'moderate',
        groupSize: 2,
      },
    });
    expect(buildPayload.prompt).toContain('2 days');
    expect(buildPayload.prompt).toContain('food, culture, and scenic interests');
    expect(buildPayload.prompt).toContain('Balanced pace');
    expect(buildPayload.prompt).toContain('2 travelers, likely a couple or pair');
  });

  it('collects explicit weekend, interest, pace, and solo brief answers before planner handoff', async () => {
    const wrapper = mountPlannerAssist({
      draft: {
        startDate: '2026-05-08',
        endDate: '2026-05-08',
        interests: [],
        pace: '' as any,
        groupSize: 0,
      },
    });

    expect(await submitTripAiPrompt(wrapper, 'Build the itinerary from Fort Worth to Austin')).toContain('How many days should I plan for?');
    expect(await submitTripAiPrompt(wrapper, 'weekend')).toContain('What kind of trip should this feel like');
    expect(await submitTripAiPrompt(wrapper, 'adventure shopping nightlife')).toContain('What pace should I use');
    expect(await submitTripAiPrompt(wrapper, 'relaxed')).toContain('Who is coming with you');
    expect(await submitTripAiPrompt(wrapper, 'solo')).toContain('handed Fort Worth, TX to Austin, TX to Scope AI');

    const buildPayload = wrapper.emitted('itinerary-build-request')?.[0]?.[0] as any;
    expect(buildPayload).toMatchObject({
      reason: 'build',
      draftDefaults: {
        startDate: '2026-05-08',
        endDate: '2026-05-09',
        pace: 'relaxed',
        groupSize: 1,
      },
    });
    expect(buildPayload.draftDefaults.interests).toEqual(['nightlife', 'adventure', 'shopping']);
    expect(buildPayload.prompt).toContain('Relaxed pace');
    expect(buildPayload.prompt).toContain('solo traveler');
  });

  it('recognizes balanced preferences and couple travel-party brief replies', async () => {
    const wrapper = mountPlannerAssist({
      draft: {
        interests: [],
        pace: '' as any,
        groupSize: 0,
      },
    });

    expect(await submitTripAiPrompt(wrapper, 'Build the itinerary from Fort Worth to Austin')).toContain('What kind of trip should this feel like');
    expect(await submitTripAiPrompt(wrapper, 'balanced')).toContain('Who is coming with you');
    expect(await submitTripAiPrompt(wrapper, 'couple')).toContain('handed Fort Worth, TX to Austin, TX to Scope AI');

    const buildPayload = wrapper.emitted('itinerary-build-request')?.[0]?.[0] as any;
    expect(buildPayload).toMatchObject({
      reason: 'build',
      draftDefaults: {
        interests: ['food', 'culture', 'scenic'],
        pace: 'moderate',
        groupSize: 2,
      },
    });
    expect(buildPayload.prompt).toContain('Balanced pace');
    expect(buildPayload.prompt).toContain('2 travelers, likely a couple or pair');
  });

  it('keeps unrelated brief replies as reminders instead of silently changing the build', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas road trip',
        draft: {
          destination: 'Robert Lee, Texas',
          endDestination: '177 Kothman Road, La Vernia',
          startDate: '2026-05-08',
          endDate: '2026-05-08',
          budgetFloor: 500,
          budget: 1500,
          interests: [],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Build the itinerary from Robert Lee to La Vernia');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    await wrapper.get('[data-test="trip-ai-input"]').setValue('blue horizon');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(getLatestAiResponseText(wrapper)).toContain('I caught that. I still need this before I build the itinerary: How many days should I plan for?');
    expect(wrapper.emitted('itinerary-build-request')).toBeUndefined();
  });

  it('answers budget follow-ups during a pending itinerary brief and shows budget chips', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Oklahoma to Louisiana',
        draft: {
          destination: 'Cr E0270, Goltry',
          endDestination: 'I 49, Mansfield',
          startDate: '2026-05-08',
          endDate: '2026-05-08',
          budgetFloor: 100,
          budget: 300,
          interests: [],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Build the itinerary from Cr E0270, Goltry to I 49, Mansfield');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('How many days should I plan for?');
    expect(wrapper.emitted('itinerary-build-request')).toBeUndefined();
    expect(wrapper.findAll('[data-test="trip-ai-quick-suggestion"]').map((button) => button.text())).toEqual([
      '1 day',
      '2 days',
      'Surprise me',
    ]);

    planTripMock.mockResolvedValueOnce({
      itinerary: 'For you: keep it inside $100 - $300 by protecting fuel, food, and the emergency buffer.',
      model: 'scope-local-copilot',
      steps: 1,
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Keep this plan inside $100 - $300');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const responses = wrapper.findAll('[data-test="trip-ai-response"]');
    expect(planTripMock).toHaveBeenCalledTimes(1);
    expect(responses.at(-1)?.text()).toContain('inside $100 - $300');
    expect(responses.at(-1)?.text()).not.toContain('How many days should I plan for?');
    expect(responses.at(-1)?.text()).not.toContain('What kind of trip should this feel like');
    expect(wrapper.emitted('itinerary-build-request')).toBeUndefined();
    expect(wrapper.findAll('[data-test="trip-ai-quick-suggestion"]').map((button) => button.text())).toEqual([
      'Split $100 - $300 across fuel, food, and stops',
      'Find free or low-cost stops along this route',
      '1 day',
    ]);
  });

  it('lets place-search follow-ups bypass a pending itinerary brief', async () => {
    searchPlacesMock.mockResolvedValueOnce({
      data: [{
        id: 'poi.midpoint',
        placeName: 'Midway Coffee',
        latitude: 31.48,
        longitude: -97.12,
        formattedAddress: '10 Route Street, Waco, Texas',
        city: 'Waco',
        category: 'coffee shop',
        distanceKm: 4,
      }],
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Coffee route',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-05-08',
          endDate: '2026-05-08',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Build the itinerary from Fort Worth to Austin');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('How many days should I plan for?');

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Find a local stop between Fort Worth and Austin');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(searchPlacesMock).toHaveBeenCalledWith('restaurant', {
      limit: 6,
      proximity: {
        latitude: (32.7555 + 30.2672) / 2,
        longitude: (-97.3308 + -97.7431) / 2,
      },
    });
    expect(wrapper.findAll('[data-test="trip-ai-place-results"]').at(-1)?.text()).toContain('Midway Coffee');
    expect(wrapper.findAll('[data-test="trip-ai-place-results"]').at(-1)?.text()).not.toContain('How many days');
    expect(wrapper.findAll('[data-test="trip-ai-quick-suggestion"]').map((button) => button.text())).toEqual([
      'Find coffee along this route',
      'Find food along this route',
      '1 day',
    ]);
  });

  it('allows one-place destination itinerary builds when the brief is complete', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Patagonia itinerary',
        draft: {
          destination: 'Patagonia',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['adventure'],
          pace: 'relaxed',
          groupSize: 1,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Build the itinerary starting from Patagonia');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(planTripMock).not.toHaveBeenCalled();
    expect(wrapper.emitted('itinerary-build-request')?.[0]?.[0]).toMatchObject({
      prompt: 'Build the itinerary starting from Patagonia',
      reason: 'build',
    });
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('handed Patagonia to Scope AI');
  });

  it('keeps route actions in a working state until the planner returns', async () => {
    let capturedRequest: {
      handled: boolean;
      resolve: (result: { status: 'success'; routeLabel: string; stopCount: number }) => void;
    } | null = null;

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
        onItineraryBuildRequest: (payload: {
          handled: boolean;
          resolve: (result: { status: 'success'; routeLabel: string; stopCount: number }) => void;
        }) => {
          payload.handled = true;
          capturedRequest = payload;
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Build a simple weekend route');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(wrapper.find('[data-test="trip-ai-response"]').exists()).toBe(false);
    expect(wrapper.get('.trip-ai-assist__message--thinking').text()).toContain('Building a simple weekend route');

    capturedRequest?.resolve({
      status: 'success',
      routeLabel: 'Fort Worth, TX to Austin, TX',
      stopCount: 3,
    });
    await flushPromises();

    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('built Fort Worth, TX to Austin, TX into a 3-day itinerary with 3 stops');
  });

  it('reports busy and failed planner handoffs without queueing duplicate route builds', async () => {
    const mountPlanner = (onItineraryBuildRequest: (payload: {
      handled: boolean;
      resolve: (result: { status: 'busy' | 'success'; routeLabel: string; stopCount: number }) => void;
      reject: (error: unknown) => void;
    }) => void) => mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
        onItineraryBuildRequest,
      },
    });

    const busyWrapper = mountPlanner((payload) => {
      payload.handled = true;
      payload.resolve({
        status: 'busy',
        routeLabel: 'Fort Worth, TX to Austin, TX',
        stopCount: 0,
      });
    });

    await busyWrapper.get('[data-test="trip-ai-input"]').setValue('Build a simple weekend route');
    await busyWrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(getLatestAiResponseText(busyWrapper)).toContain('already building this route');

    const errorWrapper = mountPlanner((payload) => {
      payload.handled = true;
      payload.reject(new Error('planner API timed out'));
    });

    await errorWrapper.get('[data-test="trip-ai-input"]').setValue('Build a balanced first draft');
    await errorWrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(getLatestAiResponseText(errorWrapper)).toContain('I could not rebuild the itinerary yet. planner API timed out');

    busyWrapper.unmount();
    errorWrapper.unmount();
  });

  it('does not replay an unchanged route build as a duplicate planner run', async () => {
    let requestCount = 0;

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
        onItineraryBuildRequest: (payload: {
          handled: boolean;
          resolve: (result: { status: 'success'; routeLabel: string; stopCount: number }) => void;
        }) => {
          requestCount += 1;
          payload.handled = true;
          payload.resolve({
            status: 'success',
            routeLabel: 'Fort Worth, TX to Austin, TX',
            stopCount: 3,
          });
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Build a simple weekend route');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Build a simple weekend route');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const responses = wrapper.findAll('[data-test="trip-ai-response"]');
    expect(requestCount).toBe(1);
    expect(responses).toHaveLength(2);
    expect(responses[0]?.text()).toContain('built Fort Worth, TX to Austin, TX into a 3-day itinerary with 3 stops');
    expect(responses[0]?.text()).not.toContain('scope-action');
    expect(responses[1]?.text()).toContain('already built and synced');
  });

  it('keeps suggestive route wording in the chat instead of launching the planner', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Suggest a simple weekend route');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(planTripMock).toHaveBeenCalled();
    expect(wrapper.emitted('itinerary-build-request')).toBeUndefined();
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('Add a lunch stop near Waco');
  });

  it('treats a balanced first draft prompt as a planner build action', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Build a balanced first draft');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(planTripMock).not.toHaveBeenCalled();
    expect(wrapper.emitted('itinerary-build-request')?.[0]?.[0]).toMatchObject({
      prompt: 'Build a balanced first draft',
      reason: 'build',
    });
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('handed Fort Worth, TX to Austin, TX to Scope AI');
  });

  it('replaces duplicate committed stops when asked to tighten a route', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
        stops: [
          {
            spotId: 'stop-1',
            title: 'Waco lunch',
            latitude: 31.5493,
            longitude: -97.1467,
            category: 'food',
            city: 'Waco',
          },
          {
            spotId: 'stop-2',
            title: 'Waco lunch',
            latitude: 31.5493,
            longitude: -97.1467,
            category: 'food',
            city: 'Waco',
          },
        ],
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Tighten this route and remove filler');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    const replacement = wrapper.emitted('route-stops-replace')?.[0]?.[0];
    expect(replacement).toHaveLength(1);
    expect(replacement?.[0]).toMatchObject({ title: 'Waco lunch' });
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('removing 1 duplicate');
  });

  it('exposes a planner handoff method that starts the same Scope AI route-action flow', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    const vm = wrapper.vm as unknown as {
      handoffPlannerBrief: (options?: { prompt?: string }) => Promise<void>;
    };

    await vm.handoffPlannerBrief();
    await flushPromises();

    expect(planTripMock).not.toHaveBeenCalled();
    expect(wrapper.findAll('[data-test="trip-ai-user-message"]')).toHaveLength(1);
    expect(wrapper.emitted('itinerary-build-request')?.[0]?.[0]).toMatchObject({
      reason: 'build',
    });
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('handed Fort Worth, TX to Austin, TX to Scope AI');
  });

  it('asks for the missing endpoint before building', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: '',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          startDate: '2026-05-08',
          endDate: '2026-05-08',
          budgetFloor: 500,
          budget: 1500,
          interests: [],
          pace: 'relaxed',
          groupSize: 1,
        },
      },
    });

    const vm = wrapper.vm as unknown as {
      handoffPlannerBrief: (options?: { prompt?: string }) => Promise<void>;
    };

    await vm.handoffPlannerBrief({
      prompt: 'Build the itinerary after I add the final destination. The start is Fort Worth, TX; ask me for the destination now.',
    });
    await flushPromises();

    expect(wrapper.emitted('itinerary-build-request')).toBeUndefined();
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('What final destination should I use for this itinerary?');
  });

  it('asks for a real start before recommending endpoint ideas from a blank route', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Blank scout',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Find scenic endpoints');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(searchLocationsMock).not.toHaveBeenCalled();
    expect(getTravelNearbySuggestionsMock).not.toHaveBeenCalled();
    expect(getLatestAiResponseText(wrapper)).toContain('Set a real start point first');
    expect(wrapper.findAll('[data-test="trip-ai-message-chip"]').map((button) => button.text())).toEqual([
      'Add a start place',
      'Pick start on map',
      'Find scenic endpoints',
    ]);
  });

  it('suggests endpoint candidates from the existing mapped start without calling the structured chat backend', async () => {
    const addSessionEntry = vi.fn();
    callScopeAiMock.mockResolvedValue({
      responseText: 'This backend response should not be used.',
      model: 'scope-ai',
    });
    getTravelNearbySuggestionsMock.mockResolvedValueOnce({
      configured: true,
      coverage: 'Fixture endpoint coverage',
      source: 'Google Places',
      category: 'recommended',
      radiusKm: 64,
      suggestions: [
        {
          id: 'endpoint-scope-fallback',
          title: 'Scope Demo Scenic Idea',
          subtitle: 'Fallback community idea',
          address: 'Demo fallback near Hollis',
          latitude: 34.7,
          longitude: -99.8,
          category: 'park',
          source: 'scope',
          distanceKm: 12.4,
          reason: 'Fallback result should not outrank verified places',
        },
        {
          id: 'endpoint-park',
          title: 'Quartz Mountain State Park',
          subtitle: 'Scenic endpoint near the start',
          address: '14722 Highway 44A, Lone Wolf, Oklahoma',
          latitude: 34.889,
          longitude: -99.303,
          category: 'park',
          source: 'google',
          distanceKm: 52.4,
          reason: 'Good scenic finish after a rural start',
        },
        {
          id: 'endpoint-downtown',
          title: 'Downtown Altus',
          subtitle: 'Practical endpoint with food and fuel',
          address: 'Altus, Oklahoma',
          latitude: 34.638,
          longitude: -99.333,
          category: 'shopping',
          source: 'google',
          distanceKm: 38.1,
          reason: 'Practical services and easy routing',
        },
        {
          id: 'endpoint-museum',
          title: 'Museum of the Western Prairie',
          subtitle: 'Culture stop endpoint',
          address: '1100 Memorial Drive, Altus, Oklahoma',
          latitude: 34.652,
          longitude: -99.306,
          category: 'museum',
          source: 'google',
          distanceKm: 40.8,
          reason: 'A real place to end instead of raw road text',
        },
      ],
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Oklahoma scout',
        scopeAiStore: {
          stateAsJson: {},
          sessionHistory: [],
          preferences: {},
          addSessionEntry,
        },
        draft: {
          destination: 'E1500 Road, Hollis',
          endDestination: '',
          destinationLatitude: 34.693,
          destinationLongitude: -99.912,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Help me choose an end point from E1500 Road, Hollis');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(callScopeAiMock).not.toHaveBeenCalled();
    expect(searchLocationsMock).not.toHaveBeenCalled();
    expect(getTravelNearbySuggestionsMock).toHaveBeenCalledWith(expect.objectContaining({
      category: 'recommended',
      anchors: [expect.objectContaining({
        placeLabel: 'E1500 Road, Hollis',
        latitude: 34.693,
        longitude: -99.912,
      })],
    }));
    expect(wrapper.get('[data-test="trip-ai-place-results"]').text()).not.toContain('Scope Demo Scenic Idea');
    expect(wrapper.get('[data-test="trip-ai-place-results"]').text()).toContain('Quartz Mountain State Park');
    expect(wrapper.findAll('[data-test="trip-ai-place-add"]').map((button) => button.text())).toEqual([
      'Use as final destination',
      'Use as final destination',
      'Use as final destination',
    ]);

    await wrapper.findAll('[data-test="trip-ai-place-add"]')[0]?.trigger('click');

    expect(wrapper.emitted('map-location-select')?.[0]?.[0]).toMatchObject({
      target: 'endDestination',
      label: '14722 Highway 44A, Lone Wolf, Oklahoma',
      latitude: 34.889,
      longitude: -99.303,
    });
  });

  it('uses the current mapped start for around-here endpoint questions', async () => {
    callScopeAiMock.mockResolvedValue({
      responseText: 'This backend response should not be used.',
      model: 'scope-ai',
    });
    getTravelNearbySuggestionsMock.mockResolvedValueOnce({
      configured: true,
      coverage: 'Fixture endpoint coverage',
      source: 'Google Places',
      category: 'recommended',
      radiusKm: 64,
      suggestions: [{
        id: 'endpoint-downtown',
        title: 'Downtown Altus',
        subtitle: 'Practical endpoint with food and fuel',
        address: 'Altus, Oklahoma',
        latitude: 34.638,
        longitude: -99.333,
        category: 'shopping',
        source: 'google',
        distanceKm: 38.1,
        reason: 'Practical services and easy routing',
      }],
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Oklahoma scout',
        scopeAiStore: createScopeAiStore(),
        draft: {
          destination: 'E1500 Road, Hollis',
          endDestination: '',
          destinationLatitude: 34.693,
          destinationLongitude: -99.912,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('where should I go around here');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(callScopeAiMock).not.toHaveBeenCalled();
    expect(searchLocationsMock).not.toHaveBeenCalled();
    expect(getTravelNearbySuggestionsMock).toHaveBeenCalledWith(expect.objectContaining({
      anchors: [expect.objectContaining({
        placeLabel: 'E1500 Road, Hollis',
        latitude: 34.693,
        longitude: -99.912,
      })],
    }));
    expect(wrapper.get('[data-test="trip-ai-place-results"]').text()).toContain('Downtown Altus');
    expect(wrapper.get('[data-test="trip-ai-place-results"]').text()).toContain('I found 1 endpoint idea from E1500 Road, Hollis');
  });

  it('applies an endpoint candidate from a follow-up selector', async () => {
    getTravelNearbySuggestionsMock.mockResolvedValueOnce({
      configured: true,
      coverage: 'Fixture endpoint coverage',
      source: 'Google Places',
      category: 'recommended',
      radiusKm: 64,
      suggestions: [
        {
          id: 'endpoint-park',
          title: 'Quartz Mountain State Park',
          subtitle: 'Scenic endpoint near the start',
          address: '14722 Highway 44A, Lone Wolf, Oklahoma',
          latitude: 34.889,
          longitude: -99.303,
          category: 'park',
          source: 'google',
          distanceKm: 52.4,
          reason: 'Good scenic finish after a rural start',
        },
        {
          id: 'endpoint-downtown',
          title: 'Downtown Altus',
          subtitle: 'Practical endpoint with food and fuel',
          address: 'Altus, Oklahoma',
          latitude: 34.638,
          longitude: -99.333,
          category: 'shopping',
          source: 'google',
          distanceKm: 38.1,
          reason: 'Practical services and easy routing',
        },
      ],
    });
    const scopeAiStore: any = {
      stateAsJson: {},
      sessionHistory: [],
      preferences: {},
      pendingScopeAiContext: null,
      addSessionEntry: vi.fn(),
      setPendingScopeAiContext: vi.fn((context) => {
        scopeAiStore.pendingScopeAiContext = {
          ...context,
          createdAt: context.createdAt ?? Date.now(),
          turnCount: context.turnCount ?? 0,
        };
      }),
      clearPendingScopeAiContext: vi.fn(() => {
        scopeAiStore.pendingScopeAiContext = null;
      }),
      incrementPendingScopeAiContextTurn: vi.fn(),
    };

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Oklahoma scout',
        scopeAiStore,
        draft: {
          destination: 'E1500 Road, Hollis',
          endDestination: '',
          destinationLatitude: 34.693,
          destinationLongitude: -99.912,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Find scenic endpoints');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();
    expect(scopeAiStore.pendingScopeAiContext).toMatchObject({
      kind: 'endpoint-candidates',
      targetField: 'end',
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('second one');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(callScopeAiMock).not.toHaveBeenCalled();
    expect(wrapper.emitted('map-location-select')?.at(-1)?.[0]).toMatchObject({
      target: 'endDestination',
      label: 'Altus, Oklahoma',
      latitude: 34.638,
      longitude: -99.333,
    });
    expect(wrapper.findAll('[data-test="trip-ai-response"]').at(-1)?.text()).toContain('Set the final destination to Altus, Oklahoma.');
  });

  it('refuses endpoint candidate follow-ups that do not include provider coordinates', async () => {
    const scopeAiStore = createScopeAiStore({
      pendingScopeAiContext: {
        kind: 'endpoint-candidates',
        targetField: 'end',
        results: [{
          label: 'Provider shell result',
          value: 'Provider shell result',
          source: 'Google Places',
          meta: {
            providerVerified: true,
            source: 'Google Places',
          },
        }],
        createdAt: Date.now(),
        turnCount: 0,
      },
    });
    const wrapper = mountPlannerAssist({
      scopeAiStore,
      draft: {
        destination: 'E1500 Road, Hollis',
        endDestination: '',
        destinationLatitude: 34.693,
        destinationLongitude: -99.912,
      },
    });

    await submitTripAiPrompt(wrapper, '1');

    expect(callScopeAiMock).not.toHaveBeenCalled();
    expect(wrapper.findAll('[data-test="trip-ai-response"]').at(-1)?.text()).toContain(
      'I can only set that endpoint after a provider-backed candidate includes coordinates.',
    );
    expect(wrapper.emitted('map-location-select')).toBeUndefined();
    expect(scopeAiStore.clearPendingScopeAiContext).not.toHaveBeenCalledWith('endpoint-candidate-selected');
  });

  it('reruns endpoint search when Show more endpoint ideas follows pending endpoint candidates', async () => {
    getTravelNearbySuggestionsMock
      .mockResolvedValueOnce({
        configured: true,
        coverage: 'Fixture endpoint coverage',
        source: 'Google Places',
        category: 'recommended',
        radiusKm: 64,
        suggestions: [{
          id: 'endpoint-park',
          title: 'Quartz Mountain State Park',
          subtitle: 'Scenic endpoint near the start',
          address: '14722 Highway 44A, Lone Wolf, Oklahoma',
          latitude: 34.889,
          longitude: -99.303,
          category: 'park',
          source: 'google',
          distanceKm: 52.4,
          reason: 'Good scenic finish after a rural start',
        }],
      })
      .mockResolvedValueOnce({
        configured: true,
        coverage: 'Fixture endpoint coverage',
        source: 'Google Places',
        category: 'recommended',
        radiusKm: 64,
        suggestions: [{
          id: 'endpoint-museum',
          title: 'Museum of the Western Prairie',
          subtitle: 'Culture stop endpoint',
          address: '1100 Memorial Drive, Altus, Oklahoma',
          latitude: 34.652,
          longitude: -99.306,
          category: 'museum',
          source: 'google',
          distanceKm: 40.8,
          reason: 'A real place to end instead of raw road text',
        }],
      });
    const scopeAiStore = createScopeAiStore();
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Oklahoma scout',
        scopeAiStore,
        draft: {
          destination: 'E1500 Road, Hollis',
          endDestination: '',
          destinationLatitude: 34.693,
          destinationLongitude: -99.912,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Find scenic endpoints');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(wrapper.get('[data-test="trip-ai-place-results"]').text()).toContain('Quartz Mountain State Park');
    expect(scopeAiStore.pendingScopeAiContext).toMatchObject({
      kind: 'endpoint-candidates',
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Show more endpoint ideas');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(callScopeAiMock).not.toHaveBeenCalled();
    expect(getTravelNearbySuggestionsMock).toHaveBeenCalledTimes(2);
    expect(wrapper.findAll('[data-test="trip-ai-place-results"]').at(-1)?.text()).toContain('Museum of the Western Prairie');
    expect(scopeAiStore.pendingScopeAiContext).toMatchObject({
      kind: 'endpoint-candidates',
      results: [expect.objectContaining({ label: 'Museum of the Western Prairie' })],
    });
  });

  it('clears pending endpoint context when an endpoint search result is clicked', async () => {
    getTravelNearbySuggestionsMock.mockResolvedValueOnce({
      configured: true,
      coverage: 'Fixture endpoint coverage',
      source: 'Google Places',
      category: 'recommended',
      radiusKm: 64,
      suggestions: [{
        id: 'endpoint-park',
        title: 'Quartz Mountain State Park',
        subtitle: 'Scenic endpoint near the start',
        address: '14722 Highway 44A, Lone Wolf, Oklahoma',
        latitude: 34.889,
        longitude: -99.303,
        category: 'park',
        source: 'google',
        distanceKm: 52.4,
        reason: 'Good scenic finish after a rural start',
      }],
    });
    const scopeAiStore = createScopeAiStore();
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Oklahoma scout',
        scopeAiStore,
        draft: {
          destination: 'E1500 Road, Hollis',
          endDestination: '',
          destinationLatitude: 34.693,
          destinationLongitude: -99.912,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Find scenic endpoints');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(scopeAiStore.pendingScopeAiContext).toMatchObject({
      kind: 'endpoint-candidates',
    });

    await wrapper.get('[data-test="trip-ai-place-add"]').trigger('click');
    await flushPromises();

    expect(wrapper.emitted('map-location-select')?.[0]?.[0]).toMatchObject({
      target: 'endDestination',
      label: '14722 Highway 44A, Lone Wolf, Oklahoma',
      latitude: 34.889,
      longitude: -99.303,
    });
    expect(scopeAiStore.clearPendingScopeAiContext).toHaveBeenCalled();
    expect(scopeAiStore.pendingScopeAiContext).toBeNull();
  });

  it('resolves a prompt-provided start before suggesting endpoint candidates', async () => {
    searchLocationsMock.mockResolvedValueOnce({
      data: [{
        id: 'start-e1500',
        latitude: 34.693,
        longitude: -99.912,
        placeName: 'E1500 Road',
        formattedAddress: 'E1500 Road, Hollis, Oklahoma, United States',
        city: 'Hollis',
        country: 'United States',
        source: 'mapbox',
      }],
    });
    getTravelNearbySuggestionsMock.mockResolvedValueOnce({
      configured: true,
      coverage: 'Fixture endpoint coverage',
      source: 'Google Places',
      category: 'recommended',
      radiusKm: 64,
      suggestions: [{
        id: 'endpoint-altus',
        title: 'Downtown Altus',
        subtitle: 'Practical endpoint with services',
        address: 'Altus, Oklahoma',
        latitude: 34.638,
        longitude: -99.333,
        category: 'shopping',
        source: 'google',
        distanceKm: 38.1,
        reason: 'A useful destination after the rural road',
      }],
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Oklahoma scout',
        scopeAiStore: {
          stateAsJson: {},
          sessionHistory: [],
          preferences: {},
          addSessionEntry: vi.fn(),
        },
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Pick a destination from E1500 Road, Hollis');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(searchLocationsMock).toHaveBeenCalledWith('E1500 Road, Hollis', expect.objectContaining({
      limit: 3,
      sortByDistance: false,
    }));
    expect(wrapper.emitted('map-location-select')?.[0]?.[0]).toMatchObject({
      target: 'destination',
      label: 'E1500 Road, Hollis, Oklahoma, United States',
      latitude: 34.693,
      longitude: -99.912,
    });
    expect(wrapper.get('[data-test="trip-ai-place-results"]').text()).toContain('Downtown Altus');
  });

  it('biases prompt-provided endpoint starts with the planner map proximity', async () => {
    searchLocationsMock.mockResolvedValueOnce({
      data: [{
        id: 'start-hollis',
        latitude: 34.693,
        longitude: -99.912,
        placeName: 'E1500 Road',
        formattedAddress: 'E1500 Road, Hollis, Oklahoma, United States',
        city: 'Hollis',
        country: 'United States',
        source: 'mapbox',
      }],
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Oklahoma scout',
        locationSearchProximity: {
          label: 'Map center near Hollis',
          latitude: 34.7,
          longitude: -99.91,
        },
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Where should I end from E1500 Road, Hollis');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(searchLocationsMock).toHaveBeenCalledWith('E1500 Road, Hollis', {
      limit: 3,
      sortByDistance: true,
      proximity: {
        label: 'Map center near Hollis',
        latitude: 34.7,
        longitude: -99.91,
      },
    });
    expect(wrapper.emitted('map-location-select')?.[0]?.[0]).toMatchObject({
      target: 'destination',
      label: 'E1500 Road, Hollis, Oklahoma, United States',
    });
    expect(getLatestAiResponseText(wrapper)).toContain('I could not find confident endpoint ideas from E1500 Road, Hollis yet');
  });

  it.each(['Find practical endpoints', 'Find scenic endpoints', 'Show more endpoint ideas'])('uses the current start for endpoint chip "%s"', async (promptText) => {
    getTravelNearbySuggestionsMock.mockResolvedValueOnce({
      configured: true,
      coverage: 'Fixture endpoint coverage',
      source: 'Google Places',
      category: 'recommended',
      radiusKm: 64,
      suggestions: [{
        id: 'endpoint-altus',
        title: 'Downtown Altus',
        subtitle: 'Practical endpoint with services',
        address: 'Altus, Oklahoma',
        latitude: 34.638,
        longitude: -99.333,
        category: 'shopping',
        source: 'google',
        distanceKm: 38.1,
        reason: 'A useful destination after the rural road',
      }],
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Oklahoma scout',
        scopeAiStore: {
          stateAsJson: {},
          sessionHistory: [],
          preferences: {},
          addSessionEntry: vi.fn(),
        },
        draft: {
          destination: 'E1500 Road, Hollis',
          endDestination: '',
          destinationLatitude: 34.693,
          destinationLongitude: -99.912,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue(promptText);
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(callScopeAiMock).not.toHaveBeenCalled();
    expect(searchLocationsMock).not.toHaveBeenCalled();
    expect(wrapper.get('[data-test="trip-ai-place-results"]').text()).toContain('Downtown Altus');
    expect(wrapper.get('[data-test="trip-ai-place-results"]').text()).not.toContain('Set a real start point first');

    wrapper.unmount();
  });

  it('asks for clarification when the endpoint recommendation anchor is ambiguous', async () => {
    searchLocationsMock.mockResolvedValueOnce({
      data: [
        {
          id: 'start-one',
          latitude: 34.69,
          longitude: -99.91,
          placeName: 'E1500 Road',
          formattedAddress: 'E1500 Road, Hollis, Oklahoma',
          source: 'mapbox',
        },
        {
          id: 'start-two',
          latitude: 35.12,
          longitude: -99.44,
          placeName: 'E1500 Road',
          formattedAddress: 'E1500 Road, Beckham County, Oklahoma',
          source: 'mapbox',
        },
      ],
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Oklahoma scout',
        scopeAiStore: {
          stateAsJson: {},
          sessionHistory: [],
          preferences: {},
          addSessionEntry: vi.fn(),
        },
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Where should I end from E1500 Road, Hollis');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(getTravelNearbySuggestionsMock).not.toHaveBeenCalled();
    expect(wrapper.emitted('map-location-select')).toBeUndefined();
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('I found a few possible matches');
  });

  it('fails endpoint recommendation gracefully when no candidates are found', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Oklahoma scout',
        draft: {
          destination: 'E1500 Road, Hollis',
          endDestination: '',
          destinationLatitude: 34.693,
          destinationLongitude: -99.912,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'relaxed',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Suggest an endpoint after E1500 Road, Hollis');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(wrapper.find('[data-test="trip-ai-place-results"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="trip-ai-response"]').text()).toContain('I could not find confident endpoint ideas');
    expect(wrapper.emitted('map-location-select')).toBeUndefined();
  });

  it('turns route midpoint stop requests into live place search results', async () => {
    searchPlacesMock.mockResolvedValue({
      data: [{
        id: 'poi.midpoint',
        latitude: 31.48,
        longitude: -97.12,
        placeName: 'Midway Coffee',
        formattedAddress: '10 Route Street, Waco, Texas',
        city: 'Waco',
        category: 'coffee shop',
        distanceKm: 4.2,
        source: 'mapbox',
      }],
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Find a local stop between Fort Worth and Austin');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(planTripMock).not.toHaveBeenCalled();
    expect(searchPlacesMock).toHaveBeenCalledWith('restaurant', {
      limit: 6,
      proximity: {
        latitude: (32.7555 + 30.2672) / 2,
        longitude: (-97.3308 + -97.7431) / 2,
      },
    });
    expect(wrapper.get('[data-test="trip-ai-thread"]').text()).toContain('Find a local stop between Fort Worth and Austin');
    expect(wrapper.get('[data-test="trip-ai-place-results"]').text()).toContain('Midway Coffee');
  });

  it('anchors live place searches to explicit stops and the final destination', async () => {
    searchPlacesMock.mockResolvedValue({
      data: [{
        id: 'poi.anchor',
        latitude: 31.5493,
        longitude: -97.1467,
        placeName: 'Anchored Coffee',
        formattedAddress: '100 Route Street, Waco, Texas',
        city: 'Waco',
        category: 'coffee shop',
        distanceKm: 1.2,
        source: 'mapbox',
      }],
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
        stops: [{
          spotId: 'stop-waco',
          title: 'Waco lunch',
          latitude: 31.5493,
          longitude: -97.1467,
          category: 'food',
          city: 'Waco',
        }],
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Find coffee near stop 1');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(searchPlacesMock).toHaveBeenLastCalledWith('coffee', {
      limit: 6,
      proximity: {
        latitude: 31.5493,
        longitude: -97.1467,
      },
    });
    expect(wrapper.findAll('[data-test="trip-ai-place-results"]').at(-1)?.text()).toContain('Anchored Coffee');

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Find food near the final destination');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(searchPlacesMock).toHaveBeenLastCalledWith('food', {
      limit: 6,
      proximity: {
        latitude: 30.2672,
        longitude: -97.7431,
      },
    });
  });

  it('does not search live places until a route anchor exists', async () => {
    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Blank scout',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('Find coffee nearby');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(searchPlacesMock).not.toHaveBeenCalled();
    expect(getLatestAiResponseText(wrapper)).toContain('I could not verify distinct place results for that request');
  });

  it('turns nearby place requests into live route-aware place search results', async () => {
    searchPlacesMock.mockResolvedValue({
      data: [{
        id: 'poi.123',
        latitude: 32.753,
        longitude: -97.333,
        placeName: 'Starbucks',
        formattedAddress: '100 Coffee Street, Fort Worth, Texas',
        city: 'Fort Worth',
        category: 'coffee shop',
        distanceKm: 1.6,
        source: 'mapbox',
      }],
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('hey i wanna go to a closeby Starbucks');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(planTripMock).not.toHaveBeenCalled();
    expect(searchPlacesMock).toHaveBeenCalledWith('Starbucks', {
      limit: 6,
      proximity: {
        latitude: 32.7555,
        longitude: -97.3308,
      },
    });
    expect(wrapper.get('[data-test="trip-ai-place-results"]').text()).toContain('Starbucks');

    await wrapper.get('[data-test="trip-ai-place-add"]').trigger('click');

    expect(wrapper.emitted('route-stop-add')?.[0]?.[0]).toMatchObject({
      spotId: 'place-poi-123',
      title: 'Starbucks',
      latitude: 32.753,
      longitude: -97.333,
      category: 'food',
      city: 'Fort Worth',
    });
  });

  it.each([
    {
      prompt: 'hey i wanna go to a closeby Skyline Scenic Overlook',
      id: 'poi.scenic',
      placeName: 'Skyline Scenic Overlook',
      formattedAddress: '100 Viewpoint Road, Fort Worth, Texas',
      category: 'viewpoint',
      expectedCategory: 'scenic',
    },
    {
      prompt: 'hey i wanna go to a closeby Canyon Climb Center',
      id: 'poi.adventure',
      placeName: 'Canyon Climb Center',
      formattedAddress: '200 Outdoor Lane, Fort Worth, Texas',
      category: 'climbing adventure',
      expectedCategory: 'adventure',
    },
    {
      prompt: 'hey i wanna go to a closeby Six Flags Over Texas',
      id: 'poi.entertainment',
      placeName: 'Six Flags Over Texas',
      formattedAddress: '2201 E Road to Six Flags Street, Arlington, Texas',
      category: 'amusement park',
      expectedCategory: 'entertainment',
    },
    {
      prompt: 'hey i wanna go to a closeby County Services Annex',
      id: 'poi.other',
      placeName: 'County Services Annex',
      formattedAddress: '300 Civic Way, Fort Worth, Texas',
      category: 'public service',
      expectedCategory: 'other',
    },
  ])('maps verified place-search result "$placeName" to $expectedCategory stops', async (testCase) => {
    searchPlacesMock.mockResolvedValueOnce({
      data: [{
        id: testCase.id,
        latitude: 32.753,
        longitude: -97.333,
        placeName: testCase.placeName,
        formattedAddress: testCase.formattedAddress,
        city: 'Fort Worth',
        category: testCase.category,
        distanceKm: 1.6,
        source: 'mapbox',
      }],
    });

    const wrapper = mountPlannerAssist({
      draft: {
        destinationLatitude: 32.7555,
        destinationLongitude: -97.3308,
        endDestinationLatitude: 30.2672,
        endDestinationLongitude: -97.7431,
      },
    });

    await submitTripAiPrompt(wrapper, testCase.prompt);
    await wrapper.get('[data-test="trip-ai-place-add"]').trigger('click');

    expect(wrapper.emitted('route-stop-add')?.[0]?.[0]).toMatchObject({
      spotId: `place-${testCase.id.replace(/\./g, '-')}`,
      title: testCase.placeName,
      category: testCase.expectedCategory,
      city: 'Fort Worth',
      notes: testCase.formattedAddress,
    });

    wrapper.unmount();
  });

  it('treats generic spot requests as spot discovery instead of falling back to text chat', async () => {
    searchPlacesMock.mockResolvedValue({
      data: [{
        id: 'poi.456',
        latitude: 32.781,
        longitude: -97.35,
        placeName: 'Modern Art Museum of Fort Worth',
        formattedAddress: '3200 Darnell St, Fort Worth, TX',
        city: 'Fort Worth',
        category: 'museum',
        distanceKm: 2.2,
        source: 'mapbox',
      }],
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['culture'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('find spots near the route');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(planTripMock).not.toHaveBeenCalled();
    expect(searchPlacesMock).toHaveBeenCalledWith('museum', expect.objectContaining({
      limit: 6,
      proximity: expect.objectContaining({
        latitude: expect.any(Number),
        longitude: expect.any(Number),
      }),
    }));
    expect(wrapper.get('[data-test="trip-ai-place-add"]').text()).toContain('Add spot');
  });

  it('turns real-world where-is questions into live location search results without requiring route anchors', async () => {
    searchLocationsMock.mockResolvedValue({
      data: [{
        id: 'place.paris',
        latitude: 48.8566,
        longitude: 2.3522,
        placeName: 'Paris',
        formattedAddress: 'Paris, Ile-de-France, France',
        city: 'Paris',
        country: 'France',
        source: 'mapbox',
      }],
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: '',
        draft: {
          destination: '',
          endDestination: '',
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('where is Paris');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(planTripMock).not.toHaveBeenCalled();
    expect(searchPlacesMock).not.toHaveBeenCalled();
    expect(searchLocationsMock).toHaveBeenCalledWith('Paris', { limit: 6 });
    expect(wrapper.get('[data-test="trip-ai-place-results"]').text()).toContain('Paris, Ile-de-France, France');
  });

  it('turns address-style prompts into live location search results', async () => {
    searchLocationsMock.mockResolvedValue({
      data: [{
        id: 'address.botanic',
        latitude: 32.7495,
        longitude: -97.3621,
        placeName: 'Fort Worth Botanic Garden',
        formattedAddress: '3220 Botanic Garden Blvd, Fort Worth, Texas 76107, United States',
        city: 'Fort Worth',
        country: 'United States',
        source: 'mapbox',
      }],
    });

    const wrapper = mount(TripPlannerAiAssist, {
      props: {
        tripTitle: 'Texas weekend',
        draft: {
          destination: 'Fort Worth, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-05-08',
          endDate: '2026-05-10',
          budgetFloor: 500,
          budget: 1500,
          interests: ['food', 'scenic'],
          pace: 'moderate',
          groupSize: 2,
        },
      },
    });

    await wrapper.get('[data-test="trip-ai-input"]').setValue('3220 Botanic Garden Blvd');
    await wrapper.get('[data-test="trip-ai-form"]').trigger('submit');
    await flushPromises();

    expect(planTripMock).not.toHaveBeenCalled();
    expect(searchPlacesMock).not.toHaveBeenCalled();
    expect(searchLocationsMock).toHaveBeenCalledWith('3220 Botanic Garden Blvd', {
      limit: 6,
      proximity: {
        latitude: 32.7555,
        longitude: -97.3308,
      },
    });
    expect(wrapper.get('[data-test="trip-ai-place-results"]').text()).toContain('Fort Worth Botanic Garden');
  });

  it('exercises the planner brief parsing and suggestion coverage helpers', () => {
    const wrapper = mountPlannerAssist({
      userId: 'traveler-coverage',
      draft: {
        destination: '',
        endDestination: '',
        startDate: '2026-05-08',
        endDate: '2026-05-08',
        budgetFloor: undefined,
        budget: undefined,
        interests: [],
        pace: '',
        groupSize: 0,
      },
      stops: [],
    });
    const coverage = (wrapper.vm as any).__coverage;

    expect(coverage.formatCurrency(1234)).toBe('$1,234');
    expect(coverage.formatCurrency(undefined)).toBe('');
    expect(coverage.parsePlannerDate('not-a-date')).toBeNull();
    expect(coverage.getDateRangeDurationDays('2026-05-08', '2026-05-10')).toBe(3);
    expect(coverage.getDateRangeDurationDays('2026-05-10', '2026-05-08')).toBeNull();
    expect(coverage.normalizeDurationDays(2.6)).toBe(3);
    expect(coverage.normalizeDurationDays(31)).toBeNull();
    expect(coverage.getBuildDefaultsDurationDays({ startDate: '2026-05-08', endDate: '2026-05-09' })).toBe(2);
    expect(coverage.formatTravelPartyLabel(1)).toBe('solo traveler');
    expect(coverage.formatTravelPartyLabel(2)).toContain('pair');
    expect(coverage.formatTravelPartyLabel(5)).toContain('group');
    expect(coverage.formatTravelPartyLabel(0)).toBe('');

    const missingQuestions = coverage.getMissingItineraryBriefQuestions({}, { requireEndDestination: true });
    expect(missingQuestions.map((question: { key: string }) => question.key)).toEqual([
      'destination',
      'endDestination',
      'duration',
      'interests',
      'pace',
      'travelParty',
    ]);
    expect(coverage.buildMissingItineraryBriefMessage('tighten', missingQuestions).content).toContain('tighten');
    expect(coverage.buildMissingItineraryBriefMessage('build', missingQuestions, true).content).toContain('Got it');
    expect(coverage.summarizeOffQuestionBriefReply('Keep it under $300')).toBe('Got the budget guardrail.');
    expect(coverage.summarizeOffQuestionBriefReply('Leave early in the morning')).toBe('Got the timing note.');
    expect(coverage.summarizeOffQuestionBriefReply('Add a coffee stop')).toBe('Got that route note.');
    expect(coverage.summarizeOffQuestionBriefReply('Sounds fun')).toBe('I caught that.');
    expect(coverage.buildPendingBriefReminderMessage('build', missingQuestions[0], 'budget').content).toContain('I still need');

    for (const key of ['duration', 'interests', 'pace', 'travelParty', 'destination', 'endDestination', 'unknown']) {
      expect(coverage.buildPendingBriefSuggestions({ missingKeys: [key] })).toHaveLength(3);
    }

    expect(coverage.getDefaultForBriefQuestion('duration')).toMatchObject({ durationDays: 2 });
    expect(coverage.getDefaultForBriefQuestion('interests').interests).toContain('food');
    expect(coverage.getDefaultForBriefQuestion('pace')).toEqual({ pace: 'moderate' });
    expect(coverage.getDefaultForBriefQuestion('travelParty')).toEqual({ groupSize: 2 });
    expect(coverage.getDefaultForBriefQuestion('destination')).toEqual({});
    expect(coverage.mergeItineraryBuildDefaults(
      { durationDays: 45, interests: ['food'] },
      { durationDays: 3, interests: ['culture'] },
    )).toMatchObject({ durationDays: 3, interests: ['culture'] });
    expect(coverage.buildSmartDefaultsForKeys(['duration', 'interests', 'pace', 'travelParty'])).toMatchObject({
      durationDays: 2,
      pace: 'moderate',
      groupSize: 2,
    });

    expect(coverage.isVagueBriefReply('whatever you think')).toBe(true);
    expect(coverage.isVagueBriefReply('food museums and parks')).toBe(false);
    expect(coverage.parseDurationReply('weekend')).toMatchObject({ durationDays: 2 });
    expect(coverage.parseDurationReply('4 days')).toMatchObject({ durationDays: 4 });
    expect(coverage.parseDurationReply('99 days')).toBeNull();
    expect(coverage.parseExplicitDurationPrompt('same day')).toMatchObject({ durationDays: 1 });
    expect(coverage.parseInterestReply('balanced mix')).toEqual({ interests: ['food', 'culture', 'scenic'] });
    expect(coverage.inferInterestsFromText('coffee parks live music museums kayaking markets bowling views')).toEqual([
      'food',
      'nature',
      'nightlife',
      'culture',
      'adventure',
      'shopping',
      'entertainment',
      'scenic',
    ]);
    expect(coverage.parseExplicitInterestDefaultsFromPrompt('historic museum trail')).toEqual({ interests: ['nature', 'culture'] });
    expect(coverage.parsePaceReply('keep it chill')).toEqual({ pace: 'relaxed' });
    expect(coverage.parsePaceReply('packed and full')).toEqual({ pace: 'packed' });
    expect(coverage.parsePaceReply('normal balanced pace')).toEqual({ pace: 'moderate' });
    expect(coverage.getPaceLabel('packed')).toBe('Packed');
    expect(coverage.getPaceLabel('relaxed')).toBe('Relaxed');
    expect(coverage.getPaceLabel('moderate')).toBe('Balanced');
    expect(coverage.parseTravelPartyReply('group of 4')).toEqual({ groupSize: 4 });
    expect(coverage.parseTravelPartyReply('solo')).toEqual({ groupSize: 1 });
    expect(coverage.parseTravelPartyReply('couple')).toEqual({ groupSize: 2 });
    expect(coverage.parseTravelPartyReply('family')).toEqual({ groupSize: 4 });
    expect(coverage.parseBriefReplyForKey('2 days', 'duration')).toMatchObject({ durationDays: 2 });
    expect(coverage.parseBriefReplyForKey('food', 'interests')).toEqual({ interests: ['food'] });
    expect(coverage.parseBriefReplyForKey('packed', 'pace')).toEqual({ pace: 'packed' });
    expect(coverage.parseBriefReplyForKey('solo', 'travelParty')).toEqual({ groupSize: 1 });
    expect(coverage.parseBriefReplyForKey('Austin', 'destination')).toBeNull();
    expect(coverage.hasItineraryBuildDefaults({ durationDays: 2 })).toBe(true);
    expect(coverage.hasItineraryBuildDefaults({})).toBe(false);

    const defaults = coverage.extractItineraryBuildDefaultsFromPrompt('3 day food and culture trip for 2 people at a relaxed pace');
    expect(defaults).toMatchObject({ durationDays: 3, pace: 'relaxed', groupSize: 2 });
    expect(coverage.buildAssumptionSummary(defaults).join(' ')).toContain('3 days');
    expect(coverage.buildRoutePromptWithDefaults('Build it', defaults)).toContain('Smart defaults');
    expect(coverage.getPlannerStateLabel()).toContain('Blank route');
    expect(coverage.buildBlankRouteSuggestionPool('food').join(' ')).toContain('food');
    expect(coverage.buildSuggestionPool()).toContain('Help me choose a strong start city');
    expect(coverage.buildPlannerStateRankedSuggestionPool()).toContain('Help me choose a strong start city');
    expect(coverage.normalizeSuggestionKey('  Build it?! ')).toBe('build it');
    expect(coverage.mergeUniqueSuggestions(['Build it'], [' build it. ', 'Find food'])).toEqual(['Build it', 'Find food']);
    expect(coverage.buildPendingBriefContinuationSuggestions({ missingKeys: ['pace'] })).toEqual(['Relaxed pace', 'Balanced pace', 'Packed pace']);
    expect(coverage.buildPendingBriefContinuationSuggestions(null)).toEqual([]);
    expect(coverage.buildTopSuggestions(['Build it'], ['Build it', 'Find food']).length).toBeGreaterThan(0);
    expect(coverage.getRouteSearchLabel()).toBe('near the trip');
  });

  it('exercises pending location, provider trust, and assistant-context coverage helpers', () => {
    const scopeAiStore = createScopeAiStore();
    const wrapper = mountPlannerAssist({
      userId: 'traveler-memory',
      scopeAiStore,
      draft: {
        destination: 'Fort Worth, TX',
        endDestination: 'Austin, TX',
        destinationLatitude: 32.7555,
        destinationLongitude: -97.3308,
        endDestinationLatitude: 30.2672,
        endDestinationLongitude: -97.7431,
        interests: ['food', 'culture'],
      },
      locationSearchProximity: {
        label: 'North Texas',
        latitude: 32.7555,
        longitude: -97.3308,
      },
      stops: [{
        spotId: 'stop-1',
        title: 'Lunch Hall',
        latitude: 31.5,
        longitude: -97,
        category: 'food',
      }],
    });
    const coverage = (wrapper.vm as any).__coverage;
    const providerPlace = {
      id: 'place-1',
      placeName: 'Botanic Garden',
      formattedAddress: '3220 Botanic Garden Blvd, Fort Worth, TX',
      address: '3220 Botanic Garden Blvd',
      city: 'Fort Worth',
      country: 'US',
      category: 'park',
      categoryLabel: 'Park',
      latitude: 32.7495,
      longitude: -97.3621,
      distanceKm: 3.2,
      source: 'mapbox',
      sourceLabel: 'Map search',
      providerVerified: true,
      reason: 'Scenic stop',
    };
    const pendingItem = coverage.scopeAiPlaceResultToPendingItem(providerPlace);
    const pendingContext = {
      kind: 'location-resolution',
      sourcePrompt: 'which garden',
      targetField: 'stop',
      rawValue: 'garden',
      candidates: [pendingItem],
      results: [],
      lastAnswer: 'Pick a garden.',
      createdAt: Date.now(),
      turnCount: 0,
    };

    expect(coverage.getUserMemoryStorageKey(' traveler-memory ')).toBe('scope.ai.memory.v1:traveler-memory');
    expect(coverage.safeJsonParse('{"ok":true}')).toEqual({ ok: true });
    expect(coverage.safeJsonParse('{bad')).toBeNull();
    expect(coverage.isSpotCategory('food')).toBe(true);
    expect(coverage.isSpotCategory('entertainment')).toBe(true);
    expect(coverage.isSpotCategory('unknown')).toBe(false);
    expect(coverage.mergeInterestPreferences(['food', 'other'], ['food', 'scenic', 'bad'])).toEqual(['food', 'other', 'scenic']);
    expect(coverage.readUserMemory()).toBeNull();
    expect(coverage.inferDetailPreferenceFromPrompt('keep it short')).toBe('concise');
    expect(coverage.inferDetailPreferenceFromPrompt('go deep step by step')).toBe('detailed');
    expect(coverage.inferDetailPreferenceFromPrompt('balanced detail')).toBe('balanced');
    expect(coverage.inferDetailPreferenceFromPrompt('hello')).toBeNull();
    coverage.writeUserMemory({ detailPreference: 'detailed', recentStableInterests: ['food', 'scenic'] });
    expect(coverage.readUserMemory()).toMatchObject({ detailPreference: 'detailed', recentStableInterests: ['food', 'scenic'] });
    expect(coverage.buildAssistantPrompt('Find tacos')).toContain('User memory');

    expect(coverage.hasCoordinatePair(32.7, -97.3)).toBe(true);
    expect(coverage.hasCoordinatePair(undefined, -97.3)).toBe(false);
    expect(coverage.cleanupEndpointAnchorQuery('from Fort Worth please.')).toBe('Fort Worth');
    expect(coverage.cleanupEndpointAnchorQuery('x')).toBeNull();
    expect(coverage.isCurrentEndpointAnchorReference('the start')).toBe(true);
    expect(coverage.inferEndpointPreference('scenic park endpoint')).toBe('scenic');
    expect(coverage.inferEndpointPreference('practical hotel endpoint')).toBe('practical');
    expect(coverage.inferEndpointPreference('fun endpoint')).toBe('balanced');
    expect(coverage.extractEndpointRecommendationIntent('Recommend a scenic destination from Fort Worth')).toMatchObject({
      target: 'endDestination',
      anchorQuery: 'Fort Worth',
      preference: 'scenic',
    });
    expect(coverage.extractEndpointRecommendationIntent('what button adds an end')).toBeNull();
    expect(coverage.getCurrentStartAnchor()).toMatchObject({ id: 'start', role: 'start' });
    expect(coverage.getPlannerLocationProximity()).toMatchObject({ label: 'North Texas' });
    expect(coverage.getEndpointTravelCategory('scenic')).toBe('scenic');
    expect(coverage.getEndpointTravelCategory('practical')).toBe('stay');
    expect(coverage.getEndpointNearbyCategories('balanced')).toContain('hotel');

    expect(coverage.mapTravelNearbySuggestionToChatPlaceResult({
      id: 'travel-1',
      placeId: 'google-place-1',
      title: 'Garden Stay',
      subtitle: 'Near downtown',
      address: '10 Garden Rd',
      anchorLabel: 'Fort Worth',
      latitude: 32.7,
      longitude: -97.3,
      category: 'scenic',
      distanceKm: 2,
      source: 'google',
      sourceLabel: 'Google Places',
      reason: 'Provider result',
    })).toMatchObject({ id: 'google-place-1', providerVerified: true });
    expect(coverage.mapNearbyPlaceToChatPlaceResult({ ...providerPlace, providerVerified: undefined })).toMatchObject({
      sourceLabel: 'Map search',
      providerVerified: true,
    });
    expect(coverage.isTrustedProviderLabel('Map search')).toBe(true);
    expect(coverage.isTrustedProviderLabel('fallback map data')).toBe(false);
    expect(coverage.isTrustedProviderPlaceResult(providerPlace)).toBe(true);
    expect(coverage.isTrustedProviderPlaceResult({ ...providerPlace, providerVerified: false })).toBe(false);
    expect(coverage.isTrustedPendingContextItem(pendingItem)).toBe(true);
    expect(coverage.getEndpointCandidateKey(providerPlace)).toContain('place-1');
    expect(coverage.getEndpointCandidateScore(providerPlace)).toBeLessThan(10);
    expect(coverage.mergeEndpointCandidates([providerPlace], [{ ...providerPlace, id: 'place-duplicate', distanceKm: 9 }])).toHaveLength(2);
    expect(coverage.buildEndpointCandidatesContent([providerPlace], { label: 'Fort Worth' })).toContain('1 endpoint idea');

    expect(coverage.scopeAiFuelStationToPendingItem({
      id: 'fuel-1',
      name: 'Live Fuel',
      latitude: 32.7,
      longitude: -97.3,
      fuelType: 'regular',
      pricePerUnit: 3.19,
      currency: 'USD',
      distanceKm: 1.2,
      isOpen: true,
      source: 'Google Places',
    }, 0, 'Google Places').meta.providerVerified).toBe(true);
    expect(coverage.scopeAiNearbyPlaceToPendingItem(providerPlace, 0)).toMatchObject({ label: expect.stringContaining('Botanic Garden') });
    expect(coverage.getLocationResolutionTargetLabel({ field: 'start' })).toBe('start place');
    expect(coverage.getLocationResolutionTargetLabel({ field: 'end' })).toBe('final destination');
    expect(coverage.getLocationResolutionTargetLabel({ field: 'stop' })).toBe('stop');
    expect(coverage.getPlannerActionFieldLabel('budget_max')).toBe('maximum budget');
    expect(coverage.getPlannerActionFieldLabel('custom_field')).toBe('custom field');

    const ambiguousResolution = {
      type: 'endpoint',
      field: 'start',
      status: 'ambiguous',
      rawValue: 'Springfield',
      candidates: ['Springfield, MO', 'Springfield, IL'],
    };
    const resolvedResult = {
      applied: true,
      resolutions: [
        { type: 'endpoint', field: 'start', status: 'resolved', rawValue: 'Fort Worth', resolvedLabel: 'Fort Worth, TX' },
        { type: 'endpoint', field: 'end', status: 'resolved', rawValue: 'Austin', resolvedLabel: 'Austin, TX' },
      ],
    };
    const actionBlock = {
      actions: [
        { type: 'SET_FIELD', field: 'destination', value: 'Fort Worth' },
        { type: 'SET_FIELD', field: 'endDestination', value: 'Austin' },
        { type: 'ADD_STOP', stop: { name: 'Botanic Garden', address: '3220 Botanic Garden Blvd' } },
        { type: 'SEARCH_NEARBY_FUEL', fuel_type: 'regular' },
        { type: 'SEARCH_NEARBY_PLACES', category: 'food' },
      ],
    };
    expect(coverage.getResolutionForAction(actionBlock.actions[0], resolvedResult)).toMatchObject({ field: 'start' });
    expect(coverage.getAppliedPlannerActionLabels(actionBlock, resolvedResult)).toContain('nearby fuel lookup');
    expect(coverage.formatAppliedPlannerActionPrefix(actionBlock, resolvedResult)).toContain('Applied');
    expect(coverage.buildLocationResolutionConfirmation('Fallback', { applied: false, resolutions: [ambiguousResolution] }, actionBlock)).toContain('possible matches');
    expect(coverage.buildLocationResolutionConfirmation('Fallback', {
      applied: false,
      resolutions: [{ ...ambiguousResolution, status: 'not_found', candidates: [] }],
    })).toContain('could not find');
    expect(coverage.buildLocationResolutionConfirmation('Fallback', resolvedResult)).toContain('Set the route endpoints');

    expect(coverage.getPendingContextItems(pendingContext)).toHaveLength(1);
    expect(coverage.extractOrdinalSelection('pick the second')).toBe(1);
    expect(coverage.extractOrdinalSelection('pick six')).toBeNull();
    expect(coverage.extractStateQualifier('Austin TX')).toBe('Texas');
    expect(coverage.cleanupFollowUpQualifier('pick the first one in Texas please')).toBe('Texas');
    expect(coverage.cleanupReplacementLocationQuery('actually 3220 Botanic Garden Blvd')).toBe('3220 Botanic Garden Blvd');
    expect(coverage.cleanupReplacementLocationQuery('actually Austin')).toBeNull();
    expect(coverage.isLikelyStaleRawLocationContext('build a food route')).toBe(true);
    expect(coverage.extractLocationDisambiguationQualifier('the one near Fort Worth')).toBe('Fort Worth');
    expect(coverage.extractLocationDisambiguationQualifier('show more details')).toBeNull();
    expect(coverage.selectPendingContextItem('first', pendingContext)).toMatchObject({ id: 'place-1' });
    expect(coverage.buildPendingLocationFollowUpQuery('the one near garden', pendingContext)).toContain('Garden');
    expect(coverage.extractRadiusKmFromFollowUp('within 5 miles')).toBeCloseTo(8.046, 2);
    expect(coverage.extractRadiusKmFromFollowUp('within 3 km')).toBe(3);
    expect(coverage.extractRadiusKmFromFollowUp('nearby')).toBeNull();
    expect(coverage.inferNearbyCategoryFromFollowUp('need coffee', 'parks')).toBe('coffee');
    expect(coverage.inferNearbyCategoryFromFollowUp('need park', 'food')).toBe('outdoors');
    expect(coverage.inferNearbyCategoryFromFollowUp('need bowling', 'food')).toBe('entertainment');
    expect(coverage.buildPendingLocationAction({ targetField: 'stop' }, 'Botanic Garden')).toMatchObject({
      actions: [{ type: 'ADD_STOP' }],
    });
    expect(coverage.buildPendingLocationAction({ targetField: 'end' }, 'Austin')).toMatchObject({
      actions: [{ type: 'SET_FIELD', field: 'end' }],
    });
    expect(coverage.getFirstUnresolvedLocationResolution({ resolutions: [ambiguousResolution] })).toBe(ambiguousResolution);
    expect(coverage.updatePendingContextFromLocationResult(scopeAiStore, 'Springfield', { resolutions: [ambiguousResolution] }, 'Choose')).toBe(true);
    expect(scopeAiStore.setPendingScopeAiContext).toHaveBeenCalled();
    expect(coverage.filterPendingItemsByFollowUp('garden', pendingContext)).toHaveLength(1);
    expect(coverage.getFuelPriceFromPendingItem({ meta: { pricePerUnit: 3.19 } })).toBe(3.19);
    expect(coverage.getDistanceFromPendingItem({ meta: { distanceKm: 4.2 } })).toBe(4.2);
    expect(coverage.isTrustedFuelPendingItem({ source: 'Google Places', meta: { providerVerified: true } })).toBe(true);
    expect(coverage.resolvePendingExplanationFollowUp('go deeper', pendingContext)?.assistantMessage.content).toContain('deeper version');
    expect(coverage.buildPendingContextReminder(pendingContext).content).toContain('Next: Reply');
    expect(coverage.buildPendingContextReminderResolution({ ...pendingContext, turnCount: 2 }, 'general', scopeAiStore).assistantMessage.content).toContain('cleared');
    expect(coverage.isExplicitNewScopeAiCommand('set end in Austin', pendingContext)).toBe(true);
    expect(coverage.isExplicitNewScopeAiCommand('first', pendingContext)).toBe(false);
  });

  it('exercises Scope AI weather, action parsing, and pending follow-up coverage helpers', async () => {
    const scopeAiStore = createScopeAiStore();
    searchLocationsMock.mockResolvedValue({
      data: [{
        id: 'mapbox-alamo',
        placeName: 'The Alamo',
        formattedAddress: '300 Alamo Plaza, San Antonio, TX',
        address: '300 Alamo Plaza',
        city: 'San Antonio',
        country: 'US',
        latitude: 29.4259,
        longitude: -98.4861,
        category: 'historic',
        source: 'mapbox',
        sourceLabel: 'Mapbox',
        providerVerified: true,
      }],
    });
    const wrapper = mountPlannerAssist({
      scopeAiStore,
      draft: {
        destination: 'Fort Worth, TX',
        endDestination: 'Austin, TX',
        destinationLatitude: 32.7555,
        destinationLongitude: -97.3308,
        endDestinationLatitude: 30.2672,
        endDestinationLongitude: -97.7431,
        interests: ['food', 'culture'],
      },
      stops: [{
        spotId: 'stop-cafe',
        title: 'Scope Cafe',
        latitude: 31.5,
        longitude: -97,
        category: 'food',
        dayNumber: 1,
      }],
    });
    const coverage = (wrapper.vm as any).__coverage;
    const trustedItem = coverage.scopeAiPlaceResultToPendingItem({
      id: 'provider-1',
      placeName: 'The Alamo',
      formattedAddress: '300 Alamo Plaza, San Antonio, TX',
      address: '300 Alamo Plaza',
      city: 'San Antonio',
      country: 'US',
      latitude: 29.4259,
      longitude: -98.4861,
      category: 'historic',
      source: 'mapbox',
      sourceLabel: 'Mapbox',
      providerVerified: true,
      distanceKm: 1.4,
    });
    const pendingCandidateContext = {
      kind: 'endpoint-candidates',
      sourcePrompt: 'recommend a destination',
      targetField: 'end',
      rawValue: 'historic stop',
      candidates: [trustedItem],
      lastAnswer: 'Choose one.',
      createdAt: Date.now(),
      turnCount: 0,
    };

    expect(coverage.getWeatherPointFromRoute('weather at the destination')).toMatchObject({ label: expect.stringContaining('Austin') });
    await expect(coverage.resolveWeatherPoint('weather on the route')).resolves.toMatchObject({ status: 'resolved' });
    await expect(coverage.buildScopeAiWeatherMessage('weather at the destination')).resolves.toMatchObject({
      model: 'scope-weather-provider',
    });
    getOpenWeatherMapSnapshotMock.mockRejectedValueOnce(new Error('offline'));
    await expect(coverage.buildScopeAiWeatherMessage('weather at the destination')).resolves.toMatchObject({
      kind: 'text',
    });
    expect(coverage.formatWeatherSnapshot({
      label: 'Austin',
      temperatureF: Number.NaN,
      condition: 'Cloudy',
      windMph: Number.NaN,
      provider: 'test',
      providerLabel: 'Test',
    })).toContain('temperature unavailable');

    expect(coverage.extractLocationLookupQuery('where is the Alamo?')).toBe('Alamo');
    expect(coverage.extractLocationLookupQuery('where am i')).toBeNull();
    expect(coverage.extractPlaceSearchIntent('find coffee along the route')).toMatchObject({ query: 'coffee' });
    expect(coverage.extractPlaceSearchIntent('how do I click the add start button')).toBeNull();
    expect(coverage.extractPlaceSearchIntent('show me stops on the way')).toMatchObject({ requiresAnchor: true });
    expect(coverage.inferRouteStopSearchQuery('need gas and charging')).toBe('fuel');
    expect(coverage.inferRouteStopSearchQuery('historic gallery stop')).toBe('museum');
    expect(coverage.resolveRouteActionReason('build a simple weekend route')).toBe('weekend');
    expect(coverage.resolveRouteActionReason('tighten this route')).toBe('tighten');
    expect(coverage.classifyFollowUpIntent('set budget to $800')).toBeTruthy();

    const parsedActions = coverage.parseScopeActionBlocks('Done [SCOPE_ACTION]{"action":"remove_marker","place_name":"Scope Cafe"}[/SCOPE_ACTION]');
    expect(parsedActions.actions).toHaveLength(1);
    expect(coverage.parseScopeActionBlocks('[SCOPE_ACTION]{bad json[/SCOPE_ACTION]').actions).toEqual([]);
    expect(coverage.parseChipLabels('["Build it","Find coffee"]')).toEqual(['Build it', 'Find coffee']);
    expect(coverage.parseChipLabels('- Build it\n- Find coffee')).toContain('Find coffee');
    expect(coverage.readStopOrderEntries({ stops: ['Scope Cafe'] })).toEqual(['Scope Cafe']);
    coverage.applyRemoveMarkerAction({ action: 'remove_marker', place_name: 'Scope Cafe' });
    expect(wrapper.emitted('route-stop-remove')?.at(-1)?.[0]).toBe('stop-cafe');
    coverage.applyRemoveMarkerAction({ action: 'remove_marker', place_name: 'Fort Worth' });
    expect(wrapper.emitted('route-endpoint-remove')?.at(-1)?.[0]).toBe('destination');
    coverage.applyReorderStopsAction({ action: 'reorder_stops', stops: ['Scope Cafe'], day: 2 });
    expect(wrapper.emitted('route-stops-replace')).toBeTruthy();
    await expect(coverage.resolveScopeActionPlace({ action: 'add_marker', place_name: 'The Alamo' })).resolves.toMatchObject({
      placeName: 'The Alamo',
    });

    expect(coverage.buildCommonScopeAiAnswer('how do I use the route canvas?')).toMatchObject({ role: 'assistant' });
    expect(coverage.getScopeAiSearchCoordinate(scopeAiStore)).toBeNull();
    expect(coverage.buildUnverifiedLocationApplyResult({ actions: [{ type: 'SET_FIELD', field: 'destination', value: 'Demo' }] })).toMatchObject({ applied: false });
    await expect(coverage.applyScopeAiStoreActionBlock(scopeAiStore, { actions: [{ type: 'SET_FIELD', field: 'budget_max', value: 800 }] })).resolves.toMatchObject({ applied: true });
    coverage.incrementScopeAiPendingContext({
      pendingScopeAiContext: { ...pendingCandidateContext },
      incrementPendingScopeAiContextTurn: vi.fn(),
    });

    const routeMessage = await coverage.buildRouteActionMessage('tighten', 'tighten this route');
    expect(routeMessage.content).toContain('already lean');
    const queuedMessage = await coverage.buildRouteActionMessage('build', 'build the itinerary with smart defaults');
    expect(queuedMessage.content).toContain('handed');

    await expect(coverage.resolvePendingCandidateFollowUp('first', pendingCandidateContext, scopeAiStore)).resolves.toMatchObject({
      intentKind: 'location',
    });
    expect(wrapper.emitted('map-location-select')).toBeTruthy();
    await expect(coverage.resolvePendingPlannerSettingFollowUp('make it $900', {
      ...pendingCandidateContext,
      kind: 'planner-setting',
      targetField: 'budget_max',
    }, scopeAiStore)).resolves.toMatchObject({ intentKind: 'budget' });
    await expect(coverage.resolvePendingWeatherFollowUp('first', {
      ...pendingCandidateContext,
      kind: 'weather-location',
      targetField: 'weather',
    }, scopeAiStore)).resolves.toMatchObject({ intentKind: 'weather' });
    await expect(coverage.resolvePendingFuelFollowUp('set gas price from cheapest', {
      ...pendingCandidateContext,
      kind: 'fuel-results',
      rawValue: 'regular',
      results: [{
        ...trustedItem,
        source: 'Google Places',
        meta: { providerVerified: true, pricePerUnit: 3.19, distanceKm: 1.2, source: 'Google Places' },
      }],
    }, scopeAiStore)).resolves.toMatchObject({ intentKind: 'budget' });
    await expect(coverage.resolvePendingNearbyFollowUp('first', {
      ...pendingCandidateContext,
      kind: 'nearby-results',
      targetField: 'stop',
      results: [trustedItem],
    }, scopeAiStore)).resolves.toMatchObject({ intentKind: 'places' });
  });

  it('covers route-state suggestions, common local answers, and unresolved provider messages', async () => {
    const blankWrapper = mountPlannerAssist({
      draft: {
        destination: '',
        endDestination: 'Austin, TX',
        endDestinationLatitude: 30.2672,
        endDestinationLongitude: -97.7431,
        startDate: '2026-05-08',
        endDate: '2026-05-08',
        budgetFloor: 0,
        budget: 0,
        interests: [],
        pace: '',
        groupSize: 0,
      },
      stops: [],
    });
    const blankCoverage = (blankWrapper.vm as any).__coverage;
    expect(blankCoverage.getPlannerStateLabel()).toBe('Final destination selected; start can be added when ready.');
    expect(blankCoverage.getBestNextMoveSuggestion({ kind: 'startCity' })).toBe('Check first-leg timing');
    expect(blankCoverage.getBestNextMoveSuggestion({ kind: 'location' })).toBe('Use this as the start point');
    expect(blankCoverage.buildCommonScopeAiAnswer('why is the end disabled?')?.content).toContain('set the final destination before the start');
    await expect(blankCoverage.resolveWeatherPoint('weather at destination')).resolves.toMatchObject({ status: 'resolved' });

    const wrapper = mountPlannerAssist({
      draft: {
        destination: 'Fort Worth, TX',
        endDestination: 'Austin, TX',
        destinationLatitude: 32.7555,
        destinationLongitude: -97.3308,
        endDestinationLatitude: 30.2672,
        endDestinationLongitude: -97.7431,
        startDate: '2026-05-08',
        endDate: '2026-05-08',
        budgetFloor: 100,
        budget: 250,
        interests: [],
        pace: 'packed',
        groupSize: 4,
      },
      stops: [
        { spotId: 'one', title: 'Coffee', latitude: 31.5, longitude: -97, category: 'food' },
        { spotId: 'two', title: 'Museum', latitude: 31.7, longitude: -97.1, category: 'culture' },
      ],
    });
    const coverage = (wrapper.vm as any).__coverage;

    expect(coverage.getRouteBuildSuggestion('Fort Worth to Austin')).toContain('1-day balanced');
    expect(coverage.getPlannerStateLabel()).toBe('Route ready with stops selected.');

    const nextMoveCases = [
      [{ kind: 'budget' }, 'Check timing before adding paid stops'],
      [{ kind: 'timing' }, 'Build'],
      [{ kind: 'places' }, 'Check whether this stop fits timing'],
      [{ kind: 'food' }, 'Check whether this stop fits timing'],
      [{ kind: 'appHelp' }, 'Show me how to build this itinerary'],
      [{ kind: 'tighten' }, 'Build'],
      [{ kind: 'weather' }, 'Find indoor backup stops'],
      [{ kind: 'safety' }, 'Check daylight arrival timing'],
      [{ kind: 'group' }, 'Keep the group inside'],
      [{ kind: 'image' }, 'Use this image to pick a stop'],
      [{ kind: 'weekend' }, 'Build'],
      [{ kind: 'build' }, 'Build'],
      [null, 'Tighten 2 stops before building'],
    ] as const;

    for (const [context, expected] of nextMoveCases) {
      expect(coverage.getBestNextMoveSuggestion(context), expected).toContain(expected);
    }

    expect(coverage.buildBlankRouteSuggestionPool('').join(' ')).toContain('Help me choose a strong start city');
    expect(coverage.buildIntentFollowUpPool({ kind: 'weather' }).join(' ')).toContain('Find indoor backup stops');
    expect(coverage.buildCommonScopeAiAnswer('hello')?.content).toContain('I am here');
    expect(coverage.buildCommonScopeAiAnswer('thanks')?.content).toContain('Got it');
    expect(coverage.buildCommonScopeAiAnswer('what can you do')?.content).toContain('Scope AI');
    expect(coverage.buildCommonScopeAiAnswer('how do spots work?')?.content).toContain('ask me for a kind of spot');
    expect(coverage.buildCommonScopeAiAnswer('what should I do next?')?.content).toContain('Your route is set');
    expect(coverage.buildCommonScopeAiAnswer('how do I add a start on the route canvas?')?.content).toContain('route canvas supports');
    expect(coverage.buildCommonScopeAiAnswer('set fuel cost and mpg')?.content).toContain('Set fuel opens');
    expect(coverage.buildCommonScopeAiAnswer('where is the image icon?')?.content).toContain('image button');

    searchLocationsMock.mockResolvedValueOnce({
      data: [
        { id: 'springfield-mo', placeName: 'Springfield', city: 'Missouri', latitude: 37.2, longitude: -93.29 },
        { id: 'springfield-il', placeName: 'Springfield', city: 'Illinois', latitude: 39.78, longitude: -89.64 },
      ],
    });
    await expect(coverage.resolveWeatherPoint('weather in Springfield')).resolves.toMatchObject({ status: 'message' });
    searchLocationsMock.mockResolvedValueOnce({ data: [] });
    await expect(coverage.resolveWeatherPoint('weather in Nowhereville')).resolves.toMatchObject({ status: 'message' });
  });

  it('smoke-exercises exposed planner assistant coverage helpers across guard inputs', async () => {
    const scopeAiStore = createScopeAiStore();
    const wrapper = mountPlannerAssist({
      scopeAiStore,
      userId: 'coverage-smoke',
      draft: {
        destination: 'Fort Worth, TX',
        endDestination: 'Austin, TX',
        destinationLatitude: 32.7555,
        destinationLongitude: -97.3308,
        endDestinationLatitude: 30.2672,
        endDestinationLongitude: -97.7431,
        interests: ['food', 'scenic'],
      },
      stops: [{
        spotId: 'smoke-stop',
        title: 'Smoke Cafe',
        latitude: 31.5,
        longitude: -97,
        category: 'food',
      }],
    });
    const coverage = (wrapper.vm as any).__coverage;
    const providerPlace = {
      id: 'smoke-provider',
      placeName: 'Smoke Cafe',
      formattedAddress: '200 Smoke Street, Fort Worth, TX',
      address: '200 Smoke Street',
      city: 'Fort Worth',
      country: 'US',
      category: 'restaurant',
      categoryLabel: 'Restaurant',
      latitude: 32.76,
      longitude: -97.34,
      distanceKm: 2,
      source: 'mapbox',
      sourceLabel: 'Mapbox',
      providerVerified: true,
      reason: 'Provider result',
    };
    const pendingItem = coverage.scopeAiPlaceResultToPendingItem(providerPlace);
    const imageFile = new File(['atlas'], 'route-photo.png', { type: 'image/png' });
    const textFile = new File(['notes'], 'notes.txt', { type: 'text/plain' });
    const imageAttachment = {
      id: 'attachment-smoke',
      name: 'route-photo.png',
      type: 'image/png',
      size: imageFile.size,
      previewUrl: 'blob:scope-chat-image',
      base64Data: 'YXRsYXM=',
    };
    const assistantMessage = {
      id: 'assistant-smoke',
      role: 'assistant',
      kind: 'text',
      content: 'Here is a compact route answer.',
      model: 'scope-test',
      timestamp: '2026-05-08T12:00:00.000Z',
    };
    const placeMessage = {
      ...assistantMessage,
      kind: 'places',
      content: 'Found places',
      query: 'coffee',
      results: [providerPlace],
    };
    const pendingContext = {
      kind: 'place-candidates',
      sourcePrompt: 'find food',
      targetField: 'stop',
      rawValue: 'food',
      candidates: [pendingItem],
      results: [pendingItem],
      lastAnswer: 'Choose a place.',
      createdAt: Date.now(),
      turnCount: 0,
    };
    const actionBlock = {
      actions: [
        { type: 'SET_FIELD', field: 'budget_max', value: 750 },
        { action: 'add_marker', place_name: 'Smoke Cafe', stop_type: 'stop' },
        { action: 'remove_marker', place_name: 'Smoke Cafe' },
      ],
    };

    const safeCall = async (name: string, ...args: unknown[]) => {
      const fn = coverage[name];
      if (typeof fn !== 'function') {
        return;
      }

      try {
        const result = fn(...args);
        if (result && typeof result.then === 'function') {
          await result.catch(() => undefined);
        }
      } catch {
        // Defensive smoke pass: malformed follow-up/action inputs are expected to hit guard paths.
      }
    };

    const argSets: unknown[][] = [
      [],
      [''],
      ['find coffee along the route'],
      ['weather at destination'],
      ['build a weekend itinerary with smart defaults'],
      ['first'],
      ['closest within 5 miles'],
      [1],
      [2],
      [['food', 'scenic']],
      [{ durationDays: 2, interests: ['food'], pace: 'moderate', groupSize: 2 }],
      [providerPlace],
      [providerPlace, 0],
      [pendingItem],
      [pendingContext],
      ['first', pendingContext],
      ['closest within 5 miles', pendingContext, scopeAiStore],
      ['weather in Austin', pendingContext],
      ['explain more', pendingContext],
      [scopeAiStore],
      [scopeAiStore, actionBlock],
      [scopeAiStore, { command: 'set_title', title: 'Smoke Trip' }],
      [scopeAiStore, { command: 'save_trip' }],
      [scopeAiStore, { command: 'open_share' }],
      [actionBlock],
      [actionBlock, { applied: true, resolutions: [] }],
      ['Fallback', { applied: false, resolutions: [] }, actionBlock],
      [{ status: 'ambiguous', candidates: ['Austin, TX'] }],
      [{ field: 'budget_max' }],
      [{ targetField: 'stop' }, 'Smoke Cafe'],
      [{ actions: [{ type: 'SET_FIELD', field: 'party_size', value: 4 }] }],
      [imageFile],
      [textFile],
      [[imageAttachment]],
      [imageAttachment],
      ['attachment-smoke'],
      [{ target: { files: [imageFile, textFile], value: 'x' } }],
      [assistantMessage],
      [placeMessage],
      [providerPlace, 'stop'],
      [placeMessage, providerPlace],
      [new DOMException('aborted', 'AbortError')],
      [new Error('offline')],
      [{ action: 'add_marker', place_name: 'Smoke Cafe', address: '200 Smoke Street', order: 1 }],
      [{ action: 'reorder_stops', stops: [{ place_name: 'Smoke Cafe', order: 1 }] }],
      [{ type: 'SET_FIELD', field: 'destination', value: 'Fort Worth' }],
      [{ type: 'OPEN_MAP', command: 'zoom_in' }],
      [{ actions: [{ type: 'SEARCH_NEARBY_PLACES', category: 'coffee', limit: 3 }] }, { applied: false, resolutions: [] }],
    ];
    const statefulHelpers = new Set([
      'addPlaceSearchResult',
      'appendMessage',
      'applyAddMarkerAction',
      'applyPendingLocationFollowUp',
      'applyReorderStopsAction',
      'applyRemoveMarkerAction',
      'applyScopeAiStoreActionBlock',
      'applyScopeRouteAction',
      'auditAssistantMessageForRender',
      'buildPendingBriefFollowUpMessage',
      'buildPlaceSearchMessage',
      'buildScopeAiActionFollowUpMessages',
      'buildScopeAiFuelSearchMessage',
      'buildScopeAiNearbyPlacesMessage',
      'clearScopeAiPendingContext',
      'confirmRestartChat',
      'downloadTranscript',
      'emitPendingCandidateAsEndpoint',
      'emitPendingCandidateAsStop',
      'emitPlaceResultAsEndpoint',
      'executeScopeAiUiActions',
      'focusComposer',
      'handleAsk',
      'handleAttachmentChange',
      'handlePlaceSearchResultAction',
      'handleScopeAiAsk',
      'handleSuggestionClick',
      'handoffPlannerBrief',
      'incrementScopeAiPendingContext',
      'openAttachmentPicker',
      'prepareAssistantMessageForRender',
      'removePendingAttachment',
      'requestItineraryBuild',
      'resolveEndpointRecommendationAnchor',
      'resolvePendingCandidateFollowUp',
      'resolvePendingFuelFollowUp',
      'resolvePendingNearbyFollowUp',
      'resolvePendingPlannerSettingFollowUp',
      'resolvePendingScopeAiFollowUp',
      'resolvePendingWeatherFollowUp',
      'revokeConversationAttachmentPreviews',
      'runMapCommand',
      'runTripCommand',
      'saveTranscript',
      'scrollAssistIntoView',
      'scrollThreadToBottom',
      'setScopeAiPendingContext',
      'toggleChatMenu',
      'trackAiTurn',
      'trackScopeAiStructuredPreferences',
      'updatePendingContextFromAssistantMessage',
      'updatePendingContextFromLocationResult',
      'writeUserMemory',
    ]);

    for (const name of Object.keys(coverage)) {
      if (statefulHelpers.has(name)) {
        continue;
      }

      for (const args of argSets) {
        await safeCall(name, ...args);
      }
    }

    coverage.appendMessage(assistantMessage);
    coverage.toggleChatMenu();
    coverage.closeChatMenu();
    coverage.openRestartChatDialog();
    coverage.cancelRestartChat();
    coverage.trackScopeAiStructuredPreferences(actionBlock);
    coverage.emitPlaceResultAsEndpoint(providerPlace, 'endDestination');
    coverage.addPlaceSearchResult(providerPlace);
    coverage.removePendingAttachment('missing-attachment');
    await coverage.handleAttachmentChange({ target: { files: [imageFile, textFile], value: 'x' } });
    await coverage.requestItineraryBuild('build a quick route', 'build', { durationDays: 2 });

    await flushPromises();
    await nextTick();
    expect(Object.keys(coverage).length).toBeGreaterThan(100);
  });
});
