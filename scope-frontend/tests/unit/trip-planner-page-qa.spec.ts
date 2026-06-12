import { flushPromises, mount } from '@vue/test-utils';

const ORIGINAL_INNER_WIDTH = window.innerWidth;

const {
  authStoreMock,
  fetchCurrentProfileMock,
  geocodeMock,
  getPlacePhotoMock,
  listPublicTripsMock,
  mapStoreMock,
  routeMock,
  routerReplaceMock,
  scopeAiStoreMock,
  spotsStoreMock,
  toastStoreMock,
  tripsStoreMock,
} = vi.hoisted(() => ({
  authStoreMock: {
    currentUser: {
      id: 'user-1',
      username: 'louisdo',
      displayName: 'Louis Do',
      email: 'louis@example.com',
      interests: ['food', 'culture'],
      homeBase: 'Fort Worth, TX',
    },
  },
  fetchCurrentProfileMock: vi.fn().mockResolvedValue(undefined),
  geocodeMock: vi.fn().mockResolvedValue({ data: [] }),
  getPlacePhotoMock: vi.fn().mockResolvedValue({ photoUrl: '' }),
  listPublicTripsMock: vi.fn().mockResolvedValue({ data: [], meta: null }),
  mapStoreMock: {
    userLocation: null as null | [number, number],
    setSelectedSpotId: vi.fn(),
    resetVisibleSpotIds: vi.fn(),
    setCenter: vi.fn(),
    setZoom: vi.fn(),
    setStyle: vi.fn(),
  },
  routeMock: {
    name: 'trip-planner',
    params: {} as Record<string, string>,
    query: {} as Record<string, string>,
    fullPath: '/trips/new',
  },
  routerReplaceMock: vi.fn().mockResolvedValue(undefined),
  scopeAiStoreMock: {
    plannerState: {
      start: '',
      end: '',
      startLatitude: undefined,
      startLongitude: undefined,
      endLatitude: undefined,
      endLongitude: undefined,
      stops: [],
      title: '',
      date: null,
      start_date: null,
      end_date: null,
      budget_min: null,
      budget_max: null,
      party_size: null,
      pace: null,
      theme: [],
      fuel_type: null,
      mpg: null,
      gas_price: null,
    },
    pendingPackingActions: [],
    clearPendingPackingActions: vi.fn(),
    hydrateFromPlannerDraft: vi.fn(),
    seedPreferredTypes: vi.fn(),
  },
  spotsStoreMock: {
    error: '',
    fetchSpot: vi.fn().mockResolvedValue(null),
  },
  toastStoreMock: {
    showSuccess: vi.fn(),
    showError: vi.fn(),
  },
  tripsStoreMock: {
    items: [],
    previewItinerary: {
      id: 'itinerary-audit',
      destination: 'Fort Worth, TX',
      totalEstimatedCost: 0,
      weatherForecast: '',
      days: [],
    },
    planning: false,
    saving: false,
    error: '',
    fetchTrips: vi.fn().mockResolvedValue(undefined),
    fetchTrip: vi.fn().mockResolvedValue(null),
    createTrip: vi.fn(),
    createShareLink: vi.fn(),
    updateTrip: vi.fn(),
    deleteTrip: vi.fn(),
    inviteMember: vi.fn(),
    updateMemberRole: vi.fn(),
    buildItinerary: vi.fn(),
  },
}));

vi.mock('@/stores/toasts', () => ({
  useToastStore: () => toastStoreMock,
}));

vi.mock('@/stores/trips', () => ({
  useTripsStore: () => tripsStoreMock,
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

vi.mock('@/stores/spots', () => ({
  useSpotsStore: () => spotsStoreMock,
}));

vi.mock('@/stores/map', () => ({
  useMapStore: () => mapStoreMock,
}));

vi.mock('@/stores/scopeAiPlanner', () => ({
  useScopeAiPlannerStore: () => scopeAiStoreMock,
}));

vi.mock('@/stores/user', () => ({
  useUserStore: () => ({
    fetchCurrentProfile: fetchCurrentProfileMock,
  }),
}));

vi.mock('@/services/mapService', async () => {
  const actual = await vi.importActual<typeof import('@/services/mapService')>('@/services/mapService');
  return {
    ...actual,
    geocode: geocodeMock,
    geocodeMapTarget: geocodeMock,
    getPlacePhoto: getPlacePhotoMock,
  };
});

vi.mock('@/services/tripService', async () => {
  const actual = await vi.importActual<typeof import('@/services/tripService')>('@/services/tripService');
  return {
    ...actual,
    listPublicTrips: listPublicTripsMock,
  };
});

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router');
  return {
    ...actual,
    useRoute: () => routeMock,
    useRouter: () => ({
      replace: routerReplaceMock,
    }),
  };
});

vi.mock('@/utils/qaMode', () => ({
  isScopeQaMode: () => true,
}));

import TripPlannerPage from '@/views/TripPlannerPage.vue';

describe('TripPlannerPage QA audit preview', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    window.history.pushState({}, '', '/trips/new');
    localStorage.clear();
    sessionStorage.clear();
    routeMock.name = 'trip-planner';
    routeMock.params = {};
    routeMock.query = {};
    routeMock.fullPath = '/trips/new';
    tripsStoreMock.error = '';
    tripsStoreMock.planning = false;
    tripsStoreMock.saving = false;
    tripsStoreMock.previewItinerary = {
      id: 'itinerary-audit',
      destination: 'Fort Worth, TX',
      totalEstimatedCost: 0,
      weatherForecast: '',
      days: [],
    };
    fetchCurrentProfileMock.mockClear();
    listPublicTripsMock.mockClear();
    scopeAiStoreMock.hydrateFromPlannerDraft.mockClear();
    scopeAiStoreMock.seedPreferredTypes.mockClear();
    tripsStoreMock.fetchTrips.mockClear();
    tripsStoreMock.buildItinerary.mockClear();
  });

  afterAll(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: ORIGINAL_INNER_WIDTH,
    });
  });

  it('renders compact planner audit cards and skips the full planner workspace', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripCollaborationBar: { template: '<section data-test="collab-bar-stub" />' },
          TripPlanner: { template: '<section data-test="trip-planner-stub" />' },
          ItineraryView: { template: '<section data-test="itinerary-stub" />' },
          TripPlannerAiAssist: { template: '<section data-test="ai-assist-stub" />' },
          TripCard: { template: '<article data-test="trip-card-stub" />' },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('Planner preview');
    expect(wrapper.text()).toContain('Trip brief, route momentum, and itinerary output stay condensed for quick previews.');
    expect(wrapper.text()).toContain('Destination');
    expect(wrapper.text()).toContain('Budget');
    expect(wrapper.text()).toContain('0 itinerary days');
    expect(wrapper.text()).toContain('0 planned stops');
    expect(wrapper.find('[data-test="trip-planner-stub"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="itinerary-stub"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="ai-assist-stub"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="collab-bar-stub"]').exists()).toBe(false);
    expect(tripsStoreMock.fetchTrips).not.toHaveBeenCalled();
    expect(tripsStoreMock.buildItinerary).not.toHaveBeenCalled();
    expect(fetchCurrentProfileMock).not.toHaveBeenCalled();
    expect(scopeAiStoreMock.seedPreferredTypes).toHaveBeenCalledWith(['food', 'culture']);

    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    expect(coverage.plannerAuditDayCount.value).toBe(0);
    expect(coverage.plannerAuditStopCount.value).toBe(0);
    expect(coverage.plannerAuditBudgetLabel.value).toContain('$');
    expect(coverage.hasAutosavableDraftInput()).toBe(true);
    await coverage.runDraftAutosave();
    expect(tripsStoreMock.createTrip).not.toHaveBeenCalled();
    expect(tripsStoreMock.updateTrip).not.toHaveBeenCalled();

    wrapper.unmount();
  });
});
