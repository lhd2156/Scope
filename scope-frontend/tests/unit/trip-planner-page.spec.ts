import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { STREETS_MAP_STYLE } from '@/services/mapboxLoader';
import { useMapStore } from '@/stores/map';
import type { Trip, TripSpot } from '@/types';

const ORIGINAL_INNER_WIDTH = window.innerWidth;

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

function buildRouteStop(id: string, title: string, dayNumber: number, category: TripSpot['category'] = 'scenic'): TripSpot {
  return {
    spotId: id,
    title,
    latitude: 32 + dayNumber / 100,
    longitude: -97 - dayNumber / 100,
    category,
    dayNumber,
    timeSlot: `${String(8 + dayNumber).padStart(2, '0')}:00`,
    estimatedCost: 25 * dayNumber,
  };
}

function buildRouteLibraryTrip(overrides: Partial<Trip> = {}): Trip {
  const spots = [
    buildRouteStop('start', 'Fort Worth Stockyards', 1, 'culture'),
    buildRouteStop('food', 'Panther City Tacos', 1, 'food'),
    buildRouteStop('park', 'Trinity River Overlook', 1, 'scenic'),
    buildRouteStop('coffee', 'Late Coffee Bar', 2, 'food'),
    buildRouteStop('end', 'Dallas Arts District', 2, 'culture'),
  ];

  return {
    id: 'trip-1',
    title: 'North Texas Night + Food Loop',
    destination: 'Fort Worth, Texas to Dallas, Texas',
    description: '',
    isPublic: true,
    startDate: '2026-05-08',
    endDate: '2026-05-09',
    budget: 340,
    members: [
      { id: 'user-1', displayName: 'Louis Do', status: 'owner' },
      { id: 'user-2', displayName: 'Maya Reed', status: 'viewer' },
    ],
    status: 'planning',
    ...overrides,
    spots: overrides.spots ?? spots,
  };
}

const {
  authStoreMock,
  fetchCurrentProfileMock,
  geocodeMock,
  getPlacePhotoMock,
  listPublicTripsMock,
  routeMock,
  routerReplaceMock,
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
      interests: [],
      homeBase: undefined as string | undefined,
    },
  },
  fetchCurrentProfileMock: vi.fn(),
  geocodeMock: vi.fn().mockResolvedValue({ data: [] }),
  getPlacePhotoMock: vi.fn().mockResolvedValue({ photoUrl: '' }),
  listPublicTripsMock: vi.fn(),
  routeMock: {
    name: 'trip-planner' as string,
    params: {} as Record<string, string>,
    query: {} as Record<string, string>,
  },
  routerReplaceMock: vi.fn().mockResolvedValue(undefined),
  spotsStoreMock: {
    error: '',
    fetchSpot: vi.fn(),
  },
  toastStoreMock: {
    showSuccess: vi.fn(),
    showError: vi.fn(),
  },
  tripsStoreMock: {
    items: [
      {
        id: 'trip-1',
        title: 'North Texas Night + Food Loop',
        destination: 'Fort Worth, TX',
        description: '',
        isPublic: true,
        startDate: '2026-05-08',
        endDate: '2026-05-10',
        budget: 1200,
        spots: [],
        members: [],
        status: 'planning',
      },
      {
        id: 'trip-2',
        title: 'Austin Scenic Sprint',
        destination: 'Austin, TX',
        description: '',
        isPublic: true,
        startDate: '2026-05-15',
        endDate: '2026-05-17',
        budget: 900,
        spots: [],
        members: [],
        status: 'planning',
      },
    ],
    previewItinerary: {
      id: 'itinerary-1',
      destination: 'Fort Worth, TX',
      totalEstimatedCost: 180,
      weatherForecast: 'Sunny, 75F',
      days: [],
    },
    planning: false,
    saving: false,
    error: '',
    fetchTrips: vi.fn().mockResolvedValue(undefined),
    fetchTrip: vi.fn(),
    createTrip: vi.fn().mockResolvedValue({
      id: 'local-trip-1',
      title: 'Untitled trip',
      destination: 'Planning route',
      description: 'Collaborative trip draft from Scope planner.',
      isPublic: false,
      startDate: '2026-04-30',
      endDate: '2026-04-30',
      spots: [],
      members: [{ id: 'user-1', displayName: 'Louis Do', status: 'owner' }],
      status: 'planning',
    }),
    createShareLink: vi.fn().mockResolvedValue({ url: 'https://scope.test/share/local-trip-1' }),
    updateTrip: vi.fn(),
    deleteTrip: vi.fn().mockResolvedValue(undefined),
    inviteMember: vi.fn(),
    updateMemberRole: vi.fn(),
    buildItinerary: vi.fn().mockResolvedValue({
      id: 'itinerary-1',
      destination: 'Fort Worth, TX',
      totalEstimatedCost: 180,
      weatherForecast: 'Sunny, 75F',
      days: [],
    }),
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

import TripPlannerPage from '@/views/TripPlannerPage.vue';

describe('TripPlannerPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    setViewportWidth(1280);
    window.history.pushState({}, '', '/trips/new');
    vi.stubEnv('MODE', 'test');
    vi.stubEnv('VITEST', 'true');
    authStoreMock.currentUser = {
      id: 'user-1',
      username: 'louisdo',
      displayName: 'Louis Do',
      email: 'louis@example.com',
      interests: [],
      homeBase: undefined,
    };
    geocodeMock.mockReset();
    geocodeMock.mockResolvedValue({ data: [] });
    getPlacePhotoMock.mockReset();
    getPlacePhotoMock.mockResolvedValue({ photoUrl: '' });
    listPublicTripsMock.mockReset();
    listPublicTripsMock.mockImplementation(async () => ({ data: tripsStoreMock.items, meta: null }));
    routeMock.name = 'trip-planner';
    routeMock.params = {};
    routeMock.query = {};
    spotsStoreMock.error = '';
    spotsStoreMock.fetchSpot.mockReset();
    spotsStoreMock.fetchSpot.mockResolvedValue(undefined);
    localStorage.clear();
    sessionStorage.clear();
    tripsStoreMock.items = [
      {
        id: 'trip-1',
        title: 'North Texas Night + Food Loop',
        destination: 'Fort Worth, TX',
        description: '',
        isPublic: true,
        startDate: '2026-05-08',
        endDate: '2026-05-10',
        budget: 1200,
        spots: [],
        members: [],
        status: 'planning',
      },
      {
        id: 'trip-2',
        title: 'Austin Scenic Sprint',
        destination: 'Austin, TX',
        description: '',
        isPublic: true,
        startDate: '2026-05-15',
        endDate: '2026-05-17',
        budget: 900,
        spots: [],
        members: [],
        status: 'planning',
      },
    ];
    tripsStoreMock.previewItinerary = {
      id: 'itinerary-1',
      destination: 'Fort Worth, TX',
      totalEstimatedCost: 180,
      weatherForecast: 'Sunny, 75F',
      days: [],
    };
    tripsStoreMock.planning = false;
    tripsStoreMock.saving = false;
    tripsStoreMock.error = '';
    tripsStoreMock.fetchTrips.mockReset();
    tripsStoreMock.fetchTrips.mockResolvedValue(undefined);
    tripsStoreMock.fetchTrip.mockReset();
    tripsStoreMock.createTrip.mockReset();
    tripsStoreMock.createTrip.mockResolvedValue({
      id: 'local-trip-1',
      title: 'Untitled trip',
      destination: 'Planning route',
      description: 'Collaborative trip draft from Scope planner.',
      isPublic: false,
      startDate: '2026-04-30',
      endDate: '2026-04-30',
      spots: [],
      members: [{ id: 'user-1', displayName: 'Louis Do', status: 'owner' }],
      status: 'planning',
    });
    tripsStoreMock.createShareLink.mockReset();
    tripsStoreMock.createShareLink.mockResolvedValue({ url: 'https://scope.test/share/local-trip-1' });
    tripsStoreMock.updateTrip.mockReset();
    tripsStoreMock.updateTrip.mockImplementation(async (id: string, input: Partial<Trip>) => ({
      id,
      title: input.title ?? 'Updated trip',
      destination: input.destination ?? 'Planning route',
      description: input.description ?? '',
      isPublic: input.isPublic ?? false,
      startDate: input.startDate ?? '2026-04-30',
      endDate: input.endDate ?? '2026-04-30',
      budget: input.budget,
      spots: input.spots ?? [],
      members: input.members ?? [{ id: 'user-1', displayName: 'Louis Do', status: 'owner' }],
      status: input.status ?? 'planning',
    }));
    tripsStoreMock.deleteTrip.mockReset();
    tripsStoreMock.deleteTrip.mockResolvedValue(undefined);
    tripsStoreMock.inviteMember.mockReset();
    tripsStoreMock.updateMemberRole.mockReset();
    tripsStoreMock.buildItinerary.mockReset();
    tripsStoreMock.buildItinerary.mockResolvedValue({
      id: 'itinerary-1',
      destination: 'Fort Worth, TX',
      totalEstimatedCost: 180,
      weatherForecast: 'Sunny, 75F',
      days: [],
    });
    fetchCurrentProfileMock.mockReset();
    fetchCurrentProfileMock.mockResolvedValue(undefined);
    routerReplaceMock.mockClear();
    toastStoreMock.showSuccess.mockClear();
    toastStoreMock.showError.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(() => {
    setViewportWidth(ORIGINAL_INNER_WIDTH);
  });

  it('boots the planner workspace and forwards planner submissions to the store', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue', 'initialTitle', 'budgetRange', 'selectedStops', 'suggestedStops', 'submitting', 'mobileWizard', 'mobileActiveStep'],
            emits: ['submit', 'update:draft', 'update:title', 'update:stops', 'wizard-step-change'],
            template: '<button data-test="planner-submit" @click="$emit(\'submit\', initialValue)">Submit planner</button>',
          },
          ItineraryView: {
            props: ['itinerary', 'draft', 'tripTitle', 'members', 'submitting', 'mobileWizard', 'mobileActiveStep'],
            template: '<div data-test="itinerary-stub">{{ itinerary ? itinerary.destination : "No preview" }}</div>',
          },
          TripCard: {
            props: ['trip'],
            template: '<div class="trip-card-stub">{{ trip.title }}</div>',
          },
          TripCollaborationBar: {
            props: ['trip', 'members', 'saveState', 'saving'],
            template: '<div data-test="collaboration-bar-stub" />',
          },
          TripPlannerAiAssist: {
            template: '<div data-test="trip-ai-assist-stub" />',
          },
          TripShareModal: {
            props: ['open', 'trip', 'members', 'shareLink', 'submitting'],
            template: '<div />',
          },
        },
      },
    });

    await flushPromises();

    expect(tripsStoreMock.fetchTrips).not.toHaveBeenCalled();
    expect(tripsStoreMock.buildItinerary).not.toHaveBeenCalled();
    expect(wrapper.find('[data-test="itinerary-stub"]').text()).toContain('No preview');

    await wrapper.get('[data-test="planner-submit"]').trigger('click');
    await flushPromises();

    expect(tripsStoreMock.buildItinerary).toHaveBeenCalledTimes(1);
    expect(tripsStoreMock.createTrip).toHaveBeenCalledTimes(1);
    expect(routerReplaceMock).not.toHaveBeenCalled();
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Itinerary ready',
      message: 'Scope built the preview and saved this trip draft.',
    });
  });

  it('seeds new planner drafts and Scope AI preferences from account vibes', async () => {
    authStoreMock.currentUser.interests = ['nightlife', 'culture', 'unknown', 'other'];

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue'],
            template: '<div data-test="planner-vibes">{{ initialValue.interests.join(",") }}</div>',
          },
          ItineraryView: {
            props: ['draft'],
            template: '<div data-test="itinerary-vibes">{{ draft.interests.join(",") }}<slot name="assistant" /></div>',
          },
          TripCollaborationBar: { template: '<div />' },
          TripPlannerAiAssist: {
            props: ['scopeAiStore'],
            template: '<div data-test="ai-preferred-vibes">{{ scopeAiStore.preferences.preferred_types.join(",") }}</div>',
          },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();

    expect(wrapper.get('[data-test="planner-vibes"]').text()).toBe('nightlife,culture,other');
    expect(wrapper.get('[data-test="itinerary-vibes"]').text()).toContain('nightlife,culture,other');
    expect(wrapper.get('[data-test="ai-preferred-vibes"]').text()).toBe('nightlife,culture');
  });

  it('adds a spot from the Add to Trip query into a new planner draft', async () => {
    routeMock.query = { spot: 'spot-water-gardens' };
    spotsStoreMock.fetchSpot.mockResolvedValue({
      id: 'spot-water-gardens',
      title: 'Fort Worth Water Gardens',
      latitude: 32.7477,
      longitude: -97.3256,
      category: 'scenic',
      city: 'Fort Worth',
      rating: 4.7,
      createdAt: '2026-06-07T00:00:00Z',
      photos: [],
      reviews: [],
    });

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['stops'],
            template: '<div data-test="route-query-stops">{{ stops.length }}|{{ stops[0]?.title }}</div>',
          },
          ItineraryView: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripPlannerAiAssist: { template: '<div />' },
          TripShareModal: { template: '<div />' },
          LazyImage: { template: '<img />' },
        },
      },
    });

    await flushPromises();

    expect(spotsStoreMock.fetchSpot).toHaveBeenCalledWith('spot-water-gardens');
    expect(wrapper.get('[data-test="route-query-stops"]').text()).toBe('1|Fort Worth Water Gardens');
  });

  it('hydrates lean refreshed sessions before applying account vibes to new trip drafts', async () => {
    authStoreMock.currentUser.interests = [];
    authStoreMock.currentUser.homeBase = undefined;
    fetchCurrentProfileMock.mockImplementation(async () => {
      authStoreMock.currentUser = {
        ...authStoreMock.currentUser,
        interests: ['food', 'culture'],
        homeBase: 'Dallas, TX',
      };
      return authStoreMock.currentUser;
    });

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue'],
            template: '<div data-test="planner-vibes">{{ initialValue.interests.join(",") }}</div>',
          },
          ItineraryView: {
            props: ['draft'],
            template: '<div data-test="itinerary-vibes">{{ draft.interests.join(",") }}<slot name="assistant" /></div>',
          },
          TripCollaborationBar: { template: '<div />' },
          TripPlannerAiAssist: {
            props: ['scopeAiStore'],
            template: '<div data-test="ai-preferred-vibes">{{ scopeAiStore.preferences.preferred_types.join(",") }}</div>',
          },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    await nextTick();

    expect(fetchCurrentProfileMock).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[data-test="planner-vibes"]').text()).toBe('food,culture');
    expect(wrapper.get('[data-test="itinerary-vibes"]').text()).toContain('food,culture');
    expect(wrapper.get('[data-test="ai-preferred-vibes"]').text()).toBe('food,culture');
  });

  it('refreshes stale non-empty session vibes before applying account defaults to new trip drafts', async () => {
    authStoreMock.currentUser.interests = ['food', 'culture', 'adventure'];
    fetchCurrentProfileMock.mockImplementation(async () => {
      authStoreMock.currentUser = {
        ...authStoreMock.currentUser,
        interests: ['food', 'scenic', 'hidden-gem'],
        homeBase: 'Fort Worth, TX',
      };
      return authStoreMock.currentUser;
    });

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue'],
            template: '<div data-test="planner-vibes">{{ initialValue.interests.join(",") }}</div>',
          },
          ItineraryView: {
            props: ['draft'],
            template: '<div data-test="itinerary-vibes">{{ draft.interests.join(",") }}<slot name="assistant" /></div>',
          },
          TripCollaborationBar: { template: '<div />' },
          TripPlannerAiAssist: {
            props: ['scopeAiStore'],
            template: '<div data-test="ai-preferred-vibes">{{ scopeAiStore.preferences.preferred_types.join(",") }}</div>',
          },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    await nextTick();

    expect(fetchCurrentProfileMock).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[data-test="planner-vibes"]').text()).toBe('food,scenic');
    expect(wrapper.get('[data-test="itinerary-vibes"]').text()).toContain('food,scenic');
    expect(wrapper.get('[data-test="ai-preferred-vibes"]').text()).toContain('scenic');
  });

  it('renders the compact QA audit summary instead of the heavy planner workspace', async () => {
    window.history.pushState({}, '', '/trips/new?scopeQaSession=authenticated');

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div data-test="planner-stub" />' },
          ItineraryView: { template: '<div data-test="itinerary-stub" />' },
          TripCollaborationBar: { template: '<div data-test="collaboration-stub" />' },
          TripShareModal: { template: '<div />' },
          TripPlannerAiAssist: { template: '<div />' },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('Planner preview');
    expect(wrapper.text()).toContain('Trip brief, route momentum, and itinerary output stay condensed for quick previews.');
    expect(wrapper.text()).toContain('0 planned stops');
    expect(wrapper.text()).toContain('$1,500');
    expect(wrapper.text()).toContain('0 itinerary days');
    expect(wrapper.find('[data-test="planner-stub"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="itinerary-stub"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="collaboration-stub"]').exists()).toBe(false);
    expect(wrapper.find('.featured-routes-panel').exists()).toBe(false);
  });

  it('renders compact featured route cards with useful route data and filters weak drafts', async () => {
    tripsStoreMock.items = [
      buildRouteLibraryTrip(),
      buildRouteLibraryTrip({
        id: 'private-route',
        title: 'Private Draft Route',
        isPublic: false,
      }),
      buildRouteLibraryTrip({
        id: 'empty-route',
        title: 'Empty Public Route',
        spots: [],
      }),
    ];

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: { template: '<div />' },
          LazyImage: {
            props: ['src'],
            template: '<div data-test="featured-route-image">{{ src }}</div>',
          },
          TripCollaborationBar: { template: '<div />' },
          TripPlannerAiAssist: { template: '<div />' },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();

    expect(wrapper.get('.featured-routes-panel').text()).toContain('Featured routes');
    expect(wrapper.get('.featured-routes-panel').text()).toContain('Routes ready to start from');
    expect(wrapper.findAll('[data-test="featured-route-card"]')).toHaveLength(1);
    expect(wrapper.get('[data-test="featured-route-card"]').text()).toContain('2 members');
    expect(wrapper.get('[data-test="featured-route-card"]').text()).toContain('5 stops');
    expect(wrapper.get('[data-test="featured-route-card"]').text()).toContain('2 days');
    expect(wrapper.get('[data-test="featured-route-card"]').text()).toContain('$340');
    expect(wrapper.get('[data-test="featured-route-card"]').text()).toContain('Seed route');
    expect(wrapper.get('.featured-routes-pill').text()).toBe('1 seed route');
    expect(wrapper.get('[data-test="featured-route-card"]').text()).not.toContain('+1 more stop');
    expect(wrapper.text()).not.toContain('Private Draft Route');
    expect(wrapper.text()).not.toContain('Empty Public Route');
  });

  it('shows real public featured routes instead of seed routes once live routes exist', async () => {
    tripsStoreMock.items = [
      buildRouteLibraryTrip(),
      buildRouteLibraryTrip({
        id: 'public-route-1',
        title: 'Real Public Desert Run',
        destination: 'Marfa, Texas to Alpine, Texas',
      }),
    ];

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripPlannerAiAssist: { template: '<div />' },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();

    expect(wrapper.findAll('[data-test="featured-route-card"]')).toHaveLength(1);
    expect(wrapper.get('[data-test="featured-route-card"]').text()).toContain('Real Public Desert Run');
    expect(wrapper.get('[data-test="featured-route-card"]').text()).toContain('Public route');
    expect(wrapper.get('.featured-routes-pill').text()).toBe('1 public route');
    expect(wrapper.text()).not.toContain('North Texas Night + Food Loop');
  });

  it('renders split and single route-library photos without losing trip metadata', async () => {
    const startPhoto = 'https://images.unsplash.com/photo-start?auto=format&fit=crop';
    const endPhoto = 'https://images.unsplash.com/photo-end?auto=format&fit=crop';
    tripsStoreMock.items = [
      buildRouteLibraryTrip({
        id: 'public-split-route',
        title: 'Photo Split Route',
        spots: [
          { ...buildRouteStop('split-start', 'Fort Worth Stockyards', 1, 'culture'), city: 'Fort Worth', photoUrl: startPhoto },
          { ...buildRouteStop('split-food', 'Panther City Tacos', 1, 'food'), city: 'Fort Worth' },
          { ...buildRouteStop('split-park', 'Trinity River Overlook', 1, 'scenic'), city: 'Fort Worth' },
          { ...buildRouteStop('split-coffee', 'Late Coffee Bar', 2, 'food'), city: 'Dallas' },
          { ...buildRouteStop('split-end', 'Dallas Arts District', 2, 'culture'), city: 'Dallas', photoUrl: endPhoto },
        ],
      }),
      buildRouteLibraryTrip({
        id: 'public-single-route',
        title: 'Flexible Santa Fe Loop',
        destination: 'Santa Fe, New Mexico, United States',
        startDate: '',
        endDate: '',
        budget: 0,
        coverImageUrl: 'not-a-url',
        spots: [
          { ...buildRouteStop('santa-fe-plaza', 'Santa Fe Plaza', 1, 'culture'), city: 'Santa Fe' },
          { ...buildRouteStop('canyon-road', 'Canyon Road', 1, 'scenic'), city: 'Santa Fe' },
        ],
      }),
    ];

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: { template: '<div />' },
          LazyImage: {
            props: ['src', 'alt'],
            template: '<img data-test="featured-route-image" :src="src" :alt="alt" />',
          },
          TripCollaborationBar: { template: '<div />' },
          TripPlannerAiAssist: { template: '<div />' },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();

    const cards = wrapper.findAll('[data-test="featured-route-card"]');
    expect(cards).toHaveLength(2);
    expect(cards[0].find('.featured-route-visual').attributes('data-visual-mode')).toBe('split');
    expect(cards[1].find('.featured-route-visual').attributes('data-visual-mode')).toBe('single');
    expect(cards[0].find('.featured-route-visual').attributes('data-hover-role')).toBeUndefined();
    await cards[0].get('[data-test="featured-route-hover-start"]').trigger('mouseenter');
    expect(cards[0].find('.featured-route-visual').attributes('data-hover-role')).toBe('start');
    await cards[0].get('[data-test="featured-route-hover-end"]').trigger('mouseenter');
    expect(cards[0].find('.featured-route-visual').attributes('data-hover-role')).toBe('end');
    await cards[0].get('.featured-route-visual').trigger('mouseleave');
    expect(cards[0].find('.featured-route-visual').attributes('data-hover-role')).toBeUndefined();
    expect(wrapper.findAll('[data-test="featured-route-image"]').map((image) => image.attributes('src'))).toEqual([
      startPhoto,
      endPhoto,
      'not-a-url',
    ]);
    expect(cards[0].text()).toContain('May 8 - May 9');
    expect(cards[0].text()).toContain('$340');
    expect(cards[1].text()).toContain('Flexible dates');
    expect(cards[1].text()).toContain('Budget TBD');
    expect(cards[1].text()).toContain('Santa Fe, New Mexico');
  });

  it('enriches route-library cards with looked-up photos when direct route art is missing', async () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('VITEST', '');
    getPlacePhotoMock
      .mockResolvedValueOnce({ photoUrl: 'https://cdn.scope.test/start.jpg' })
      .mockResolvedValueOnce({ photoUrl: 'https://cdn.scope.test/end.jpg' })
      .mockResolvedValueOnce({ photoUrl: '' });
    tripsStoreMock.items = [buildRouteLibraryTrip({
      id: 'public-photo-lookup',
      title: 'Lookup Photo Route',
      spots: [
        { ...buildRouteStop('lookup-start', 'Lookup Stockyards North', 1, 'culture'), latitude: 32.111, longitude: -97.111, city: 'Fort Worth' },
        { ...buildRouteStop('lookup-food', 'Lookup Taco Garden', 1, 'food'), latitude: 32.222, longitude: -97.222, city: 'Fort Worth' },
        { ...buildRouteStop('lookup-end', 'Lookup Arts Walk', 2, 'culture'), latitude: 32.333, longitude: -96.333, city: 'Dallas' },
      ],
    })];

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: { template: '<div />' },
          LazyImage: {
            props: ['src'],
            template: '<img data-test="lookup-route-image" :src="src" />',
          },
          TripCollaborationBar: { template: '<div />' },
          TripPlannerAiAssist: { template: '<div />' },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    await flushPromises();
    await nextTick();
    await flushPromises();

    expect(getPlacePhotoMock).toHaveBeenCalledTimes(2);
    expect(getPlacePhotoMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Lookup Stockyards North',
      address: 'Fort Worth',
      maxWidthPx: 720,
    }));
    expect(wrapper.findAll('[data-test="lookup-route-image"]').map((image) => image.attributes('src'))).toEqual([
      'https://cdn.scope.test/start.jpg',
      'https://cdn.scope.test/end.jpg',
    ]);

    vi.stubEnv('MODE', 'test');
    vi.stubEnv('VITEST', 'true');
  });

  it('prefers looked-up endpoint photos for seed routes once real place photos return', async () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('VITEST', '');
    getPlacePhotoMock
      .mockResolvedValueOnce({ photoUrl: 'https://cdn.scope.test/real-start.jpg' })
      .mockResolvedValueOnce({ photoUrl: 'https://cdn.scope.test/real-end.jpg' })
      .mockResolvedValueOnce({ photoUrl: 'https://cdn.scope.test/real-single.jpg' });
    tripsStoreMock.items = [buildRouteLibraryTrip({
      id: 'trip-2',
      coverImageUrl: 'https://images.unsplash.com/mock-cover?auto=format',
      spots: [
        { ...buildRouteStop('seed-start', 'Seed Lookup Stockyards', 1, 'culture'), latitude: 33.111, longitude: -98.111, city: 'Fort Worth', photoUrl: 'https://images.unsplash.com/mock-start?auto=format' },
        { ...buildRouteStop('seed-end', 'Seed Lookup Arts Walk', 2, 'culture'), latitude: 33.222, longitude: -96.222, city: 'Dallas', photoUrl: 'https://images.unsplash.com/mock-end?auto=format' },
      ],
    })];

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: { template: '<div />' },
          LazyImage: {
            props: ['src'],
            template: '<img data-test="seed-route-image" :src="src" />',
          },
          TripCollaborationBar: { template: '<div />' },
          TripPlannerAiAssist: { template: '<div />' },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    await flushPromises();
    await nextTick();
    await flushPromises();

    expect(getPlacePhotoMock).toHaveBeenCalledTimes(2);
    expect(wrapper.findAll('[data-test="seed-route-image"]').map((image) => image.attributes('src'))).toEqual([
      'https://cdn.scope.test/real-start.jpg',
      'https://cdn.scope.test/real-end.jpg',
    ]);

    vi.stubEnv('MODE', 'test');
    vi.stubEnv('VITEST', 'true');
  });

  it('deduplicates in-flight route-library photo lookups for repeated route cards', async () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('VITEST', '');
    const resolveLookups: Array<() => void> = [];
    getPlacePhotoMock.mockImplementation(() => new Promise((resolve) => {
      resolveLookups.push(() => resolve({ photoUrl: '' }));
    }));
    const duplicateTrip = buildRouteLibraryTrip({
      id: 'duplicate-photo-route',
      title: 'Duplicate Photo Route',
      coverImageUrl: '',
      spots: [
        { ...buildRouteStop('duplicate-start', 'Duplicate Lookup Start', 1, 'culture'), latitude: 34.111, longitude: -99.111, photoUrl: '' },
        { ...buildRouteStop('duplicate-end', 'Duplicate Lookup End', 2, 'food'), latitude: 34.222, longitude: -96.222, photoUrl: '' },
      ],
    });
    tripsStoreMock.items = [
      duplicateTrip,
      { ...duplicateTrip, title: 'Duplicate Photo Route Copy' },
    ];

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripPlannerAiAssist: { template: '<div />' },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    await nextTick();

    expect(wrapper.findAll('[data-test="featured-route-card"]')).toHaveLength(2);
    expect(getPlacePhotoMock).toHaveBeenCalledTimes(2);

    resolveLookups.forEach((resolveLookup) => resolveLookup());
    await flushPromises();

    vi.stubEnv('MODE', 'test');
    vi.stubEnv('VITEST', 'true');
  });

  it('reuses cached route-library lookup photos instead of refetching on future planner visits', async () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('VITEST', '');
    tripsStoreMock.items = [buildRouteLibraryTrip({
      id: 'public-photo-cache',
      title: 'Cached Photo Route',
      spots: [
        { ...buildRouteStop('cache-start', 'Fort Worth Stockyards', 1, 'culture'), city: 'Fort Worth' },
        { ...buildRouteStop('cache-end', 'Dallas Arts District', 2, 'culture'), city: 'Dallas' },
      ],
    })];
    getPlacePhotoMock
      .mockResolvedValueOnce({ photoUrl: 'https://cdn.scope.test/cache-start.jpg' })
      .mockResolvedValueOnce({ photoUrl: 'https://cdn.scope.test/cache-end.jpg' });

    const mountPlanner = () => mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: { template: '<div />' },
          LazyImage: {
            props: ['src'],
            template: '<img data-test="cached-route-image" :src="src" />',
          },
          TripCollaborationBar: { template: '<div />' },
          TripPlannerAiAssist: { template: '<div />' },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    const firstWrapper = mountPlanner();
    await flushPromises();
    await nextTick();
    await flushPromises();

    expect(getPlacePhotoMock).toHaveBeenCalledTimes(2);
    expect(firstWrapper.findAll('[data-test="cached-route-image"]').map((image) => image.attributes('src'))).toEqual([
      'https://cdn.scope.test/cache-start.jpg',
      'https://cdn.scope.test/cache-end.jpg',
    ]);

    firstWrapper.unmount();
    getPlacePhotoMock.mockClear();

    const secondWrapper = mountPlanner();
    await flushPromises();
    await nextTick();
    await flushPromises();

    expect(getPlacePhotoMock).not.toHaveBeenCalled();
    expect(secondWrapper.findAll('[data-test="cached-route-image"]').map((image) => image.attributes('src'))).toEqual([
      'https://cdn.scope.test/cache-start.jpg',
      'https://cdn.scope.test/cache-end.jpg',
    ]);

    vi.stubEnv('MODE', 'test');
    vi.stubEnv('VITEST', 'true');
  });

  it('keeps mapline route-library cards when photo lookup is skipped for unmappable stops and same endpoints', async () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('VITEST', '');
    tripsStoreMock.items = [buildRouteLibraryTrip({
      id: 'same-endpoint-mapline',
      title: 'Same Endpoint Mapline',
      destination: 'Dallas, Texas to Dallas, TX',
      spots: [
        { ...buildRouteStop('same-start', 'Dallas Arts District', 1, 'culture'), latitude: Number.NaN, longitude: Number.NaN, city: 'Dallas' },
        { ...buildRouteStop('same-end', 'Dallas Arts District', 1, 'food'), latitude: Number.NaN, longitude: Number.NaN, city: 'Dallas' },
      ],
    })];

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue', 'initialTitle', 'stops'],
            template: `
              <div>
                <span data-test="same-endpoint-remix-title">{{ initialTitle }}</span>
                <span data-test="same-endpoint-remix-route">{{ initialValue.destination }} to {{ initialValue.endDestination }}</span>
                <span data-test="same-endpoint-remix-stops">{{ stops.length }}</span>
              </div>
            `,
          },
          ItineraryView: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripPlannerAiAssist: { template: '<div />' },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();

    expect(getPlacePhotoMock).not.toHaveBeenCalled();
    expect(wrapper.get('[data-test="featured-route-card"]').text()).toContain('Dallas, Texas');
    expect(wrapper.get('.featured-route-visual').attributes('data-visual-mode')).toBe('mapline');

    await wrapper.get('[data-test="featured-route-use"]').trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="same-endpoint-remix-title"]').text()).toBe('Same Endpoint Mapline');
    expect(wrapper.get('[data-test="same-endpoint-remix-route"]').text()).toBe('Dallas, Texas to');
    expect(wrapper.get('[data-test="same-endpoint-remix-stops"]').text()).toBe('0');

    vi.stubEnv('MODE', 'test');
    vi.stubEnv('VITEST', 'true');
  });

  it('lazy-loads featured route previews when the sentinel intersects outside eager test mode', async () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('VITEST', '');
    tripsStoreMock.items = [];
    listPublicTripsMock.mockResolvedValueOnce({ data: [buildRouteLibraryTrip()], meta: null });
    let intersectionCallback: IntersectionObserverCallback | null = null;
    const disconnect = vi.fn();
    const originalIntersectionObserver = window.IntersectionObserver;
    class MockIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback;
      }

      observe = vi.fn();
      disconnect = disconnect;
    }
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: MockIntersectionObserver,
    });

    mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripPlannerAiAssist: { template: '<div />' },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    expect(listPublicTripsMock).not.toHaveBeenCalled();

    intersectionCallback?.([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver);
    await flushPromises();
    expect(listPublicTripsMock).not.toHaveBeenCalled();

    intersectionCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    await flushPromises();
    await nextTick();

    expect(listPublicTripsMock).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);

    if (typeof originalIntersectionObserver === 'undefined') {
      Reflect.deleteProperty(window, 'IntersectionObserver');
    } else {
      Object.defineProperty(window, 'IntersectionObserver', {
        configurable: true,
        writable: true,
        value: originalIntersectionObserver,
      });
    }
    vi.stubEnv('MODE', 'test');
    vi.stubEnv('VITEST', 'true');
  });

  it('remixes a featured route card into a new unsaved planner draft', async () => {
    tripsStoreMock.items = [buildRouteLibraryTrip()];

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue', 'initialTitle', 'stops'],
            emits: ['update:draft'],
            template: `
              <div>
                <div data-test="planner-remix-state">
                  {{ initialTitle }}|{{ initialValue.destination }}|{{ initialValue.endDestination }}|{{ initialValue.startDate }}|{{ initialValue.endDate }}|{{ initialValue.groupSize }}|{{ initialValue.budget }}|{{ stops.length }}
                </div>
                <button
                  data-test="planner-set-template-start"
                  @click="$emit('update:draft', { ...initialValue, startDate: '2026-06-10', endDate: '2026-06-10', interests: [...initialValue.interests] })"
                >
                  Set date
                </button>
              </div>
            `,
          },
          ItineraryView: {
            props: ['itinerary'],
            template: '<div data-test="itinerary-remix-state">{{ itinerary ? itinerary.days.length : 0 }}</div>',
          },
          LazyImage: {
            props: ['src'],
            template: '<div>{{ src }}</div>',
          },
          TripCollaborationBar: {
            props: ['trip', 'saveState'],
            template: '<div data-test="remix-save-state">{{ trip ? trip.id : "new" }}|{{ saveState }}</div>',
          },
          TripPlannerAiAssist: { template: '<div />' },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-test="planner-set-template-start"]').trigger('click');
    await nextTick();
    await wrapper.get('[data-test="featured-route-use"]').trigger('click');
    await flushPromises();
    await nextTick();

    expect(wrapper.get('[data-test="planner-remix-state"]').text()).toContain('North Texas Night + Food Loop|Fort Worth Stockyards|Dallas Arts District|2026-06-10|2026-06-11|2|340|3');
    expect(wrapper.get('[data-test="itinerary-remix-state"]').text()).toBe('2');
    expect(wrapper.get('[data-test="remix-save-state"]').text()).toBe('new|unsaved');
    expect(tripsStoreMock.createTrip).not.toHaveBeenCalled();
    expect(tripsStoreMock.updateTrip).not.toHaveBeenCalled();
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Route loaded',
      message: 'North Texas Night + Food Loop is loaded as a new unsaved planner draft.',
    });
  });

  it('loads preset route stops, suggestions, and crew when a known preset destination is entered', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue', 'stops', 'suggestedStops'],
            emits: ['submit'],
            template: `
              <div>
                <span data-test="preset-route-state">{{ initialValue.destination }}|{{ stops.length }}|{{ suggestedStops.length }}</span>
                <button
                  data-test="preset-destination"
                  @click="$emit('submit', { ...initialValue, destination: 'Patagonia', endDestination: '', interests: [...initialValue.interests] })"
                >
                  Patagonia
                </button>
              </div>
            `,
          },
          ItineraryView: { template: '<div><slot name="assistant" /></div>' },
          TripCard: { template: '<div />' },
          TripCollaborationBar: {
            props: ['members'],
            template: '<div data-test="preset-member-count">{{ members.length }}</div>',
          },
          TripPlannerAiAssist: {
            setup(_props, { expose }) {
              expose({ handoffPlannerBrief: vi.fn().mockResolvedValue(true) });
              return {};
            },
            template: '<div />',
          },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    expect(wrapper.get('[data-test="preset-route-state"]').text()).toBe('|0|0');

    await wrapper.get('[data-test="preset-destination"]').trigger('click');
    await flushPromises();
    await nextTick();

    expect(wrapper.get('[data-test="preset-route-state"]').text()).toContain('Patagonia|');
    expect(wrapper.get('[data-test="preset-route-state"]').text()).not.toContain('Patagonia|0|0');
    expect(wrapper.get('[data-test="preset-member-count"]').text()).toBe('4');
  });

  it('remixes a featured route with an existing itinerary while leaving the edit route', async () => {
    routeMock.name = 'trip-edit';
    routeMock.params = { id: 'editing-trip' };
    tripsStoreMock.fetchTrip.mockResolvedValueOnce(buildRouteLibraryTrip({
      id: 'editing-trip',
      isPublic: false,
      members: [{ id: 'user-1', displayName: 'Louis Do', status: 'owner' }],
    }));
    tripsStoreMock.items = [buildRouteLibraryTrip({
      id: 'itinerary-remix-trip',
      title: 'Itinerary Remix Route',
      itinerary: {
        id: 'itinerary-remix',
        destination: 'Fort Worth to Dallas',
        totalEstimatedCost: 75,
        weatherForecast: 'Mild',
        days: [
          {
            dayNumber: 1,
            date: '2026-05-08',
            spots: [
              { ...buildRouteStop('itinerary-start', 'Fort Worth Stockyards', 1, 'culture'), city: 'Fort Worth' },
              { ...buildRouteStop('itinerary-food', 'Panther City Tacos', 1, 'food'), city: 'Fort Worth' },
            ],
          },
        ],
      },
    })];

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: {
            props: ['itinerary'],
            template: '<div data-test="itinerary-remix-preview">{{ itinerary ? itinerary.id + "|" + itinerary.days.length + "|" + itinerary.days[0].spots.length : "none" }}</div>',
          },
          LazyImage: {
            props: ['src'],
            template: '<div>{{ src }}</div>',
          },
          TripCollaborationBar: { template: '<div />' },
          TripPlannerAiAssist: { template: '<div />' },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-test="featured-route-use"]').trigger('click');
    await flushPromises();
    await nextTick();

    expect(routerReplaceMock).toHaveBeenCalledWith({ name: 'trip-planner' });
    expect(wrapper.get('[data-test="itinerary-remix-preview"]').text()).toBe('itinerary-remix|1|2');
  });

  it('hydrates editable trips with split endpoints and itinerary route stops for the map', async () => {
    routeMock.name = 'trip-edit';
    routeMock.params = { id: 'trip-route-1' };
    tripsStoreMock.fetchTrip.mockResolvedValue({
      id: 'trip-route-1',
      title: 'Cr E0270 to I 49',
      destination: 'Cr E0270, Goltry, Oklahoma 73739, United States to I 49',
      description: '',
      isPublic: false,
      startDate: '2026-05-07',
      endDate: '2026-05-07',
      budget: 1500,
      spots: [],
      members: [{ id: 'user-1', displayName: 'Louis Do', status: 'owner' }],
      status: 'planning',
      itinerary: {
        id: 'itinerary-route-1',
        destination: 'I 49',
        totalEstimatedCost: 0,
        weatherForecast: '',
        days: [
          {
            dayNumber: 1,
            date: '2026-05-07',
            spots: [
              {
                spotId: 'route-start',
                title: 'Cr E0270, Goltry',
                latitude: 36.532,
                longitude: -98.153,
                category: 'scenic',
                dayNumber: 1,
                timeSlot: '09:00',
              },
              {
                spotId: 'route-end',
                title: 'I 49',
                latitude: 32.461,
                longitude: -94.036,
                category: 'scenic',
                dayNumber: 1,
                timeSlot: '12:00',
              },
            ],
          },
        ],
      },
    });

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue', 'initialTitle', 'packingChecklistScope'],
            template: '<div data-test="planner-edit-stub">{{ initialTitle }}|{{ initialValue.destination }}|{{ initialValue.endDestination }}|{{ initialValue.destinationLatitude }}|{{ initialValue.endDestinationLongitude }}|{{ packingChecklistScope }}</div>',
          },
          ItineraryView: {
            props: ['draft', 'stops'],
            template: '<div data-test="itinerary-edit-stub">{{ draft.destination }}|{{ draft.endDestination }}|{{ draft.destinationLatitude }}|{{ draft.endDestinationLongitude }}|{{ stops.length }}</div>',
          },
          TripCard: {
            props: ['trip'],
            template: '<div class="trip-card-stub">{{ trip.title }}</div>',
          },
          TripCollaborationBar: {
            props: ['trip', 'members', 'saveState', 'saving'],
            template: '<div data-test="collaboration-bar-stub" />',
          },
          TripPlannerAiAssist: {
            template: '<div data-test="trip-ai-assist-stub" />',
          },
          TripShareModal: {
            props: ['open', 'trip', 'members', 'shareLink', 'submitting'],
            template: '<div />',
          },
        },
      },
    });

    await flushPromises();
    await nextTick();

    expect(tripsStoreMock.fetchTrip).toHaveBeenCalledWith('trip-route-1');
    expect(wrapper.get('[data-test="planner-edit-stub"]').text()).toContain('Cr E0270 to I 49|Cr E0270, Goltry, Oklahoma 73739, United States|I 49|36.532|-94.036|trip:trip-route-1');
    expect(wrapper.get('[data-test="itinerary-edit-stub"]').text()).toContain('Cr E0270, Goltry, Oklahoma 73739, United States|I 49|36.532|-94.036|2');
  });

  it('geocodes missing editable trip endpoint coordinates without blocking a partial hydrate', async () => {
    routeMock.name = 'trip-edit';
    routeMock.params = { id: 'trip-missing-coordinates' };
    tripsStoreMock.fetchTrip.mockResolvedValueOnce({
      id: 'trip-missing-coordinates',
      title: 'Dallas to Marfa',
      destination: 'Dallas, Texas to Marfa, Texas',
      description: '',
      isPublic: false,
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      budget: 900,
      spots: [],
      members: [{ id: 'user-1', displayName: 'Louis Do', status: 'owner' }],
      status: 'planning',
    });
    geocodeMock
      .mockResolvedValueOnce({
        data: [{
          latitude: 32.7767,
          longitude: -96.797,
          placeName: 'Dallas',
          formattedAddress: 'Dallas, Texas, United States',
          country: 'United States',
          countryCode: 'us',
          precision: 'place',
        }],
      })
      .mockResolvedValueOnce({
        data: [{
          latitude: Number.NaN,
          longitude: Number.NaN,
          placeName: 'Marfa',
        }],
      });

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue'],
            template: '<div data-test="editable-missing-coordinates">{{ initialValue.destinationLatitude ?? "" }}|{{ initialValue.destinationLongitude ?? "" }}|{{ initialValue.endDestinationLatitude ?? "" }}|{{ initialValue.endDestinationLongitude ?? "" }}</div>',
          },
          ItineraryView: { template: '<div />' },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripPlannerAiAssist: { template: '<div />' },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    await nextTick();
    await flushPromises();

    expect(geocodeMock).toHaveBeenCalledWith('Dallas, Texas', 1);
    expect(geocodeMock).toHaveBeenCalledWith('Marfa, Texas', 1);
    expect(wrapper.get('[data-test="editable-missing-coordinates"]').text()).toBe('32.7767|-96.797||');
  });

  it('handles missing and failed editable trip loads without changing planner state', async () => {
    routeMock.name = 'trip-edit';
    routeMock.params = { id: 'missing-trip' };
    tripsStoreMock.fetchTrip.mockResolvedValueOnce(null);

    const missingWrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialTitle'],
            template: '<div data-test="missing-trip-title">{{ initialTitle || "blank" }}</div>',
          },
          ItineraryView: { template: '<div />' },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripPlannerAiAssist: { template: '<div />' },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    expect(missingWrapper.get('[data-test="missing-trip-title"]').text()).toBe('blank');
    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Draft unavailable',
      message: '',
    });
    missingWrapper.unmount();
    toastStoreMock.showError.mockClear();

    routeMock.params = { id: 'failed-trip' };
    tripsStoreMock.error = 'Trip load failed.';
    tripsStoreMock.fetchTrip.mockRejectedValueOnce(new Error('load failed'));

    mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: { template: '<div />' },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripPlannerAiAssist: { template: '<div />' },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Draft unavailable',
      message: 'Trip load failed.',
    });
  });

  it('hands the submitted brief into Scope AI when the copilot surface is available', async () => {
    const handoffPlannerBrief = vi.fn().mockResolvedValue(true);
    const focusComposer = vi.fn().mockResolvedValue(undefined);

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            emits: ['submit'],
            template: `
              <button
                data-test="planner-submit"
                @click="$emit('submit', {
                  destination: 'Oklahoma City, Oklahoma',
                  endDestination: 'Dexter, New Mexico',
                  startDate: '2026-05-08',
                  endDate: '2026-05-10',
                  budgetFloor: 500,
                  budget: 1500,
                  interests: ['food', 'scenic'],
                  pace: 'moderate',
                  groupSize: 2,
                })"
              >
                Submit planner
              </button>
            `,
          },
          ItineraryView: {
            template: '<div data-test="itinerary-stub">No preview<slot name="assistant" /></div>',
          },
          TripPlannerAiAssist: {
            setup(_props, { expose }) {
              expose({ handoffPlannerBrief, focusComposer });
              return {};
            },
            template: '<div data-test="trip-ai-assist-stub" />',
          },
          TripCard: {
            template: '<div />',
          },
          TripCollaborationBar: {
            template: '<div data-test="collaboration-bar-stub" />',
          },
          TripShareModal: {
            template: '<div />',
          },
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-test="planner-submit"]').trigger('click');
    await flushPromises();

    expect(handoffPlannerBrief).toHaveBeenCalledWith({
      prompt: expect.stringContaining('Act as Scope Trip Guide for this planner handoff, not as the route copilot chat.'),
    });
    expect(handoffPlannerBrief.mock.calls[0]?.[0].prompt).toContain('Route: Oklahoma City, Oklahoma to Dexter, New Mexico.');
    expect(handoffPlannerBrief.mock.calls[0]?.[0].prompt).toContain('Dates: 2026-05-08 to 2026-05-10 (3 days).');
    expect(handoffPlannerBrief.mock.calls[0]?.[0].prompt).toContain('Vibes: food, scenic.');
    expect(handoffPlannerBrief.mock.calls[0]?.[0].prompt).toContain('for food, choose real restaurants, cafes, food trucks, bakeries, or fast-casual spots');
    expect(tripsStoreMock.buildItinerary).not.toHaveBeenCalled();
    expect(tripsStoreMock.createTrip).not.toHaveBeenCalled();
  });

  it('includes committed route stops in the Scope AI handoff prompt', async () => {
    const handoffPlannerBrief = vi.fn().mockResolvedValue(true);
    tripsStoreMock.items = [buildRouteLibraryTrip({
      id: 'handoff-route',
      spots: [
        { ...buildRouteStop('start', 'Fort Worth Stockyards', 1, 'culture'), city: 'Fort Worth' },
        { ...buildRouteStop('food', 'Panther City Tacos', 1, 'food'), city: 'Fort Worth' },
        { ...buildRouteStop('park', 'Trinity River Overlook', 1, 'scenic'), city: 'Fort Worth' },
        { ...buildRouteStop('coffee', 'Late Coffee Bar', 2, 'food'), city: 'Dallas' },
        { ...buildRouteStop('end', 'Dallas Arts District', 2, 'culture'), city: 'Dallas' },
      ],
    })];

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue'],
            emits: ['submit'],
            template: '<button data-test="planner-submit" @click="$emit(\'submit\', initialValue)">Submit planner</button>',
          },
          ItineraryView: {
            template: '<div><slot name="assistant" /></div>',
          },
          LazyImage: {
            props: ['src'],
            template: '<div>{{ src }}</div>',
          },
          TripPlannerAiAssist: {
            setup(_props, { expose }) {
              expose({ handoffPlannerBrief });
              return {};
            },
            template: '<div />',
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-test="featured-route-use"]').trigger('click');
    await flushPromises();
    await wrapper.get('[data-test="planner-submit"]').trigger('click');
    await flushPromises();

    const prompt = handoffPlannerBrief.mock.calls[0]?.[0].prompt;
    expect(prompt).toContain('Route: Fort Worth Stockyards to Dallas Arts District.');
    expect(prompt).toContain('Existing route stops: 1. Panther City Tacos, Fort Worth, day 1; 2. Trinity River Overlook, Fort Worth, day 1; 3. Late Coffee Bar, Dallas, day 2.');
    expect(prompt).toContain('Budget: $340 to $340.');
  });

  it('asks Scope AI for the missing route endpoint before building', async () => {
    const handoffPlannerBrief = vi.fn().mockResolvedValue(true);

    const mountWithSubmitPayload = async (payload: Record<string, unknown>) => {
      const wrapper = mount(TripPlannerPage, {
        global: {
          stubs: {
            AppShell: { template: '<div><slot /></div>' },
            TripPlanner: {
              emits: ['submit'],
              setup() {
                return { payload };
              },
              template: '<button data-test="planner-submit" @click="$emit(\'submit\', payload)">Submit planner</button>',
            },
            ItineraryView: { template: '<div><slot name="assistant" /></div>' },
            TripPlannerAiAssist: {
              setup(_props, { expose }) {
                expose({ handoffPlannerBrief });
                return {};
              },
              template: '<div />',
            },
            TripCard: { template: '<div />' },
            TripCollaborationBar: { template: '<div />' },
            TripShareModal: { template: '<div />' },
          },
        },
      });

      await flushPromises();
      await wrapper.get('[data-test="planner-submit"]').trigger('click');
      await flushPromises();
      wrapper.unmount();
    };

    await mountWithSubmitPayload({
      destination: 'Dallas, Texas',
      endDestination: '',
      startDate: '2026-06-01',
      endDate: '2026-06-01',
      budgetFloor: 500,
      budget: 1500,
      interests: [],
      pace: 'relaxed',
      groupSize: 1,
    });

    await mountWithSubmitPayload({
      destination: '',
      endDestination: 'Marfa, Texas',
      startDate: '2026-06-01',
      endDate: '2026-06-01',
      budgetFloor: 500,
      budget: 1500,
      interests: [],
      pace: 'relaxed',
      groupSize: 1,
    });

    expect(handoffPlannerBrief.mock.calls[0]?.[0].prompt).toContain('The start is Dallas, Texas. Ask for the final destination before building');
    expect(handoffPlannerBrief.mock.calls[1]?.[0].prompt).toContain('The final destination is Marfa, Texas. Ask for the start location before building');
    expect(tripsStoreMock.buildItinerary).not.toHaveBeenCalled();
  });

  it('opens the inline Scope AI assistant from the trip bar shortcut', async () => {
    const focusComposer = vi.fn().mockResolvedValue(undefined);

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            template: '<div />',
          },
          ItineraryView: {
            template: '<div><slot name="assistant" /></div>',
          },
          TripPlannerAiAssist: {
            setup(_props, { expose }) {
              expose({ focusComposer });
              return {};
            },
            template: '<div data-test="trip-ai-assist-stub" />',
          },
          TripCard: {
            template: '<div />',
          },
          TripCollaborationBar: {
            emits: ['open-ai'],
            template: '<button data-test="bar-ai-shortcut" @click="$emit(\'open-ai\')">Scope AI</button>',
          },
          TripShareModal: {
            template: '<div />',
          },
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-test="bar-ai-shortcut"]').trigger('click');
    await flushPromises();

    expect(focusComposer).toHaveBeenCalledTimes(1);
  });

  it('opens the inline Scope AI assistant from route query parameters on mount', async () => {
    const focusComposer = vi.fn().mockResolvedValue(undefined);
    routeMock.query = { assistant: 'open' };

    mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: {
            template: '<div><slot name="assistant" /></div>',
          },
          TripPlannerAiAssist: {
            setup(_props, { expose }) {
              expose({ focusComposer });
              return {};
            },
            template: '<div />',
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    await nextTick();
    await flushPromises();

    expect(focusComposer).toHaveBeenCalled();
  });

  it('renders Scope AI inside the itinerary slot after the planner handoff without the floating trigger', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            template: '<div data-test="planner-stub" />',
          },
          ItineraryView: {
            template: `
              <section data-test="itinerary-stub">
                <div data-test="itinerary-route-card">Route canvas</div>
                <div data-test="itinerary-ai-slot"><slot name="assistant" /></div>
              </section>
            `,
          },
          TripPlannerAiAssist: {
            template: '<aside data-test="trip-ai-assist-stub">Scope AI inline copilot</aside>',
          },
          TripCard: {
            template: '<div />',
          },
          TripCollaborationBar: {
            template: '<div />',
          },
          TripShareModal: {
            template: '<div />',
          },
        },
      },
    });

    await flushPromises();

    const aiPanel = wrapper.get('[data-test="trip-ai-assist-stub"]');

    expect(aiPanel.text()).toContain('Scope AI inline copilot');
    expect(aiPanel.classes()).toContain('planner-workspace__assistant');
    expect(aiPanel.classes()).toContain('planner-workspace__assistant--inline');
    expect(wrapper.get('[data-test="itinerary-ai-slot"]').text()).toContain('Scope AI inline copilot');
    expect(wrapper.find('[data-test="floating-trip-ai-button"]').exists()).toBe(false);
  });

  it('gives the inline Scope AI panel the roomy day-by-day height state once route points exist', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            template: '<div data-test="planner-stub" />',
          },
          ItineraryView: {
            template: `
              <section data-test="itinerary-stub">
                <div data-test="itinerary-ai-slot"><slot name="assistant" /></div>
              </section>
            `,
          },
          TripPlannerAiAssist: {
            props: ['scopeAiStore'],
            template: `
              <button
                data-test="scope-ai-set-start"
                @click="scopeAiStore.applyActionBlock({ actions: [{ type: 'SET_FIELD', field: 'start', value: 'E1500 Road, Hollis' }] })"
              >
                Set start
              </button>
            `,
          },
          TripCard: {
            template: '<div />',
          },
          TripCollaborationBar: {
            template: '<div />',
          },
          TripShareModal: {
            template: '<div />',
          },
        },
      },
    });

    await flushPromises();

    const aiPanel = wrapper.get('[data-test="scope-ai-set-start"]');
    expect(aiPanel.classes()).toContain('planner-workspace__assistant');
    expect(aiPanel.classes()).toContain('planner-workspace__assistant--inline');
    expect(aiPanel.classes()).not.toContain('planner-workspace__assistant--with-days');

    await aiPanel.trigger('click');
    await flushPromises();

    expect(aiPanel.classes()).toContain('planner-workspace__assistant--with-days');
  });

  it('focuses the itinerary map on a single Scope AI endpoint when only one side resolves', async () => {
    geocodeMock.mockResolvedValueOnce({
      data: [{
        latitude: 35.4676,
        longitude: -97.5164,
        placeName: 'Oklahoma City, Oklahoma',
        formattedAddress: 'Oklahoma City, Oklahoma, United States',
        country: 'United States',
        countryCode: 'us',
        precision: 'place',
      }],
    });

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: {
            props: ['initialMapViewport'],
            template: '<div data-test="single-endpoint-viewport">{{ initialMapViewport.center[0] }},{{ initialMapViewport.center[1] }} / {{ initialMapViewport.zoom }}<slot name="assistant" /></div>',
          },
          TripPlannerAiAssist: {
            props: ['scopeAiStore'],
            template: '<button data-test="ai-start-only" @click="scopeAiStore.applyActionBlock({ actions: [{ type: \'SET_FIELD\', field: \'start\', value: \'Oklahoma City\' }] })">Start only</button>',
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    expect(wrapper.get('[data-test="single-endpoint-viewport"]').text()).toContain('-98.5795,39.8283 / 3.25');

    await wrapper.get('[data-test="ai-start-only"]').trigger('click');
    await flushPromises();
    await nextTick();

    expect(wrapper.get('[data-test="single-endpoint-viewport"]').text()).toContain('-97.5164,35.4676 / 10');
  });

  it('syncs Scope AI traveler edits back into the planner brief', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue'],
            template: '<div data-test="planner-travelers">{{ initialValue.groupSize }}</div>',
          },
          ItineraryView: {
            template: '<div><slot name="assistant" /></div>',
          },
          TripPlannerAiAssist: {
            props: ['scopeAiStore'],
            template: `
              <button
                data-test="scope-ai-two-travelers"
                @click="scopeAiStore.applyActionBlock({ actions: [{ type: 'SET_FIELD', field: 'party_size', value: 2 }] })"
              >
                2 travelers
              </button>
            `,
          },
          TripCard: {
            template: '<div />',
          },
          TripCollaborationBar: {
            template: '<div />',
          },
          TripShareModal: {
            template: '<div />',
          },
        },
      },
    });

    await flushPromises();
    expect(wrapper.get('[data-test="planner-travelers"]').text()).toBe('1');

    await wrapper.get('[data-test="scope-ai-two-travelers"]').trigger('click');
    await flushPromises();
    await nextTick();

    expect(wrapper.get('[data-test="planner-travelers"]').text()).toBe('2');
  });

  it('auto-syncs the planner end date from Day by Day stop days when the user has not locked it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-17T12:00:00'));

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue'],
            template: '<div><span data-test="planner-start-date">{{ initialValue.startDate }}</span><span data-test="planner-end-date">{{ initialValue.endDate }}</span></div>',
          },
          ItineraryView: {
            emits: ['itinerary-stops-update'],
            template: `
              <button
                data-test="day-two-update"
                @click="$emit('itinerary-stops-update', [{ spotId: 'day-two', title: 'Day two stop', latitude: 32, longitude: -97, category: 'scenic', dayNumber: 2 }])"
              >
                Day two
              </button>
            `,
          },
          TripPlannerAiAssist: {
            template: '<div />',
          },
          TripCard: {
            template: '<div />',
          },
          TripCollaborationBar: {
            template: '<div data-test="collaboration-bar-stub" />',
          },
          TripShareModal: {
            template: '<div />',
          },
        },
      },
    });

    await flushPromises();
    expect(wrapper.get('[data-test="planner-start-date"]').text()).toBe('2026-05-17');
    expect(wrapper.get('[data-test="planner-end-date"]').text()).toBe('2026-05-17');

    await wrapper.get('[data-test="day-two-update"]').trigger('click');
    await flushPromises();
    await nextTick();

    expect(wrapper.get('[data-test="planner-end-date"]').text()).toBe('2026-05-18');
  });

  it('preserves a user-chosen end date when Day by Day stop days change', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-17T12:00:00'));

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue'],
            emits: ['update:draft'],
            template: `
              <div>
                <span data-test="planner-end-date">{{ initialValue.endDate }}</span>
                <button
                  data-test="manual-end-date"
                  @click="$emit('update:draft', { ...initialValue, endDestination: initialValue.endDestination ?? '', endDate: '2026-05-20', interests: [...initialValue.interests] })"
                >
                  Manual end
                </button>
              </div>
            `,
          },
          ItineraryView: {
            emits: ['itinerary-stops-update'],
            template: `
              <button
                data-test="day-two-update"
                @click="$emit('itinerary-stops-update', [{ spotId: 'day-two', title: 'Day two stop', latitude: 32, longitude: -97, category: 'scenic', dayNumber: 2 }])"
              >
                Day two
              </button>
            `,
          },
          TripPlannerAiAssist: {
            template: '<div />',
          },
          TripCard: {
            template: '<div />',
          },
          TripCollaborationBar: {
            template: '<div data-test="collaboration-bar-stub" />',
          },
          TripShareModal: {
            template: '<div />',
          },
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-test="manual-end-date"]').trigger('click');
    await flushPromises();
    await nextTick();
    expect(wrapper.get('[data-test="planner-end-date"]').text()).toBe('2026-05-20');

    await wrapper.get('[data-test="day-two-update"]').trigger('click');
    await flushPromises();
    await nextTick();

    expect(wrapper.get('[data-test="planner-end-date"]').text()).toBe('2026-05-20');
  });

  it('lets Scope AI trigger the real itinerary build flow', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue', 'initialTitle', 'stops', 'suggestedStops', 'submitting', 'mobileWizard', 'mobileActiveStep'],
            emits: ['update:draft'],
            template: `
              <button
                data-test="planner-route-update"
                @click="$emit('update:draft', { ...initialValue, destination: 'Oklahoma City, Oklahoma', endDestination: 'Dexter, New Mexico' })"
              >
                Set route
              </button>
            `,
          },
          ItineraryView: {
            props: ['itinerary'],
            template: '<div data-test="itinerary-stub">{{ itinerary ? itinerary.destination : "No preview" }}<slot name="assistant" /></div>',
          },
          TripPlannerAiAssist: {
            emits: ['itinerary-build-request'],
            template: `
              <button
                data-test="ai-build-request"
                @click="$emit('itinerary-build-request', {
                  prompt: 'Tighten this route',
                  reason: 'tighten',
                  handled: false,
                  resolve: () => {},
                  reject: () => {},
                })"
              >
                AI build
              </button>
            `,
          },
          TripCard: {
            template: '<div />',
          },
          TripCollaborationBar: {
            template: '<div data-test="collaboration-bar-stub" />',
          },
          TripShareModal: {
            template: '<div />',
          },
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-test="planner-route-update"]').trigger('click');
    await nextTick();
    await wrapper.get('[data-test="ai-build-request"]').trigger('click');
    await flushPromises();

    expect(tripsStoreMock.buildItinerary).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: 'Oklahoma City, Oklahoma',
        endDestination: 'Dexter, New Mexico',
      }),
      { source: 'user' },
    );
    expect(tripsStoreMock.createTrip).not.toHaveBeenCalled();
    expect(routerReplaceMock).not.toHaveBeenCalled();
  });

  it('keeps an AI-triggered itinerary success in preview mode without autosaving the draft', async () => {
    const resolveRequest = vi.fn();
    const rejectRequest = vi.fn();
    tripsStoreMock.createTrip.mockRejectedValueOnce(new Error('Core is offline'));

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue'],
            emits: ['update:draft'],
            template: `
              <button
                data-test="planner-route-update"
                @click="$emit('update:draft', { ...initialValue, destination: 'Oklahoma City, Oklahoma', endDestination: 'Dexter, New Mexico' })"
              >
                Set route
              </button>
            `,
          },
          ItineraryView: {
            props: ['itinerary'],
            template: '<div data-test="itinerary-stub">{{ itinerary ? itinerary.destination : "No preview" }}<slot name="assistant" /></div>',
          },
          TripPlannerAiAssist: {
            emits: ['itinerary-build-request'],
            template: `
              <button
                data-test="ai-build-request"
                @click="$emit('itinerary-build-request', {
                  prompt: 'Suggest a simple weekend route',
                  reason: 'weekend',
                  handled: false,
                  resolve: resolveRequest,
                  reject: rejectRequest,
                })"
              >
                AI build
              </button>
            `,
            setup() {
              return { resolveRequest, rejectRequest };
            },
          },
          TripCard: {
            template: '<div />',
          },
          TripCollaborationBar: {
            template: '<div data-test="collaboration-bar-stub" />',
          },
          TripShareModal: {
            template: '<div />',
          },
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-test="planner-route-update"]').trigger('click');
    await nextTick();
    await wrapper.get('[data-test="ai-build-request"]').trigger('click');
    await flushPromises();

    expect(tripsStoreMock.buildItinerary).toHaveBeenCalledTimes(1);
    expect(tripsStoreMock.createTrip).not.toHaveBeenCalled();
    expect(routerReplaceMock).not.toHaveBeenCalled();
    expect(resolveRequest).toHaveBeenCalledWith({
      status: 'success',
      routeLabel: 'Oklahoma City, Oklahoma to Dexter, New Mexico',
      stopCount: 0,
      dayCount: 1,
    });
    expect(rejectRequest).not.toHaveBeenCalled();
    expect(toastStoreMock.showError).not.toHaveBeenCalled();
    expect(toastStoreMock.showSuccess).not.toHaveBeenCalledWith(expect.objectContaining({
      title: 'Itinerary refreshed',
    }));
  });

  it('preserves an AI-requested 4-day span when the generated stops are sparse', async () => {
    const resolveRequest = vi.fn();
    const rejectRequest = vi.fn();
    tripsStoreMock.buildItinerary.mockResolvedValueOnce({
      id: 'itinerary-4-day',
      destination: 'North Richland Hills to Arlington',
      totalEstimatedCost: 18,
      weatherForecast: 'Mild',
      days: [
        {
          dayNumber: 1,
          date: '2026-05-08',
          spots: [{
            spotId: 'coffee-1',
            title: 'Route Coffee',
            latitude: 32.8,
            longitude: -97.2,
            category: 'food',
            estimatedCost: 18,
            dayNumber: 1,
          }],
        },
        {
          dayNumber: 2,
          date: '2026-05-09',
          spots: [],
        },
      ],
    });

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue'],
            emits: ['update:draft'],
            template: `
              <div>
                <span data-test="planner-end-date">{{ initialValue.endDate }}</span>
                <button
                  data-test="planner-route-update"
                  @click="$emit('update:draft', {
                    ...initialValue,
                    destination: '5673 Jamaica Circle, North Richland Hills',
                    endDestination: '1205 Oriental Avenue, Arlington',
                    startDate: '2026-05-08',
                    endDate: '2026-05-08',
                    interests: ['food', 'scenic'],
                    pace: 'relaxed',
                    groupSize: 2,
                  })"
                >
                  Set route
                </button>
              </div>
            `,
          },
          ItineraryView: {
            props: ['itinerary'],
            template: '<div><span data-test="preview-day-count">{{ itinerary ? itinerary.days.length : 0 }}</span><slot name="assistant" /></div>',
          },
          TripPlannerAiAssist: {
            emits: ['itinerary-build-request'],
            template: `
              <button
                data-test="ai-build-request"
                @click="$emit('itinerary-build-request', {
                  prompt: 'Build the itinerary from 5673 Jamaica Circle, North Richland Hills to 1205 Oriental Avenue, Arlington',
                  reason: 'build',
                  draftDefaults: {
                    startDate: '2026-05-08',
                    endDate: '2026-05-11',
                    durationDays: 4,
                  },
                  handled: false,
                  resolve: resolveRequest,
                  reject: rejectRequest,
                })"
              >
                AI build
              </button>
            `,
            setup() {
              return { resolveRequest, rejectRequest };
            },
          },
          TripCard: {
            template: '<div />',
          },
          TripCollaborationBar: {
            template: '<div data-test="collaboration-bar-stub" />',
          },
          TripShareModal: {
            template: '<div />',
          },
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-test="planner-route-update"]').trigger('click');
    await nextTick();
    await wrapper.get('[data-test="ai-build-request"]').trigger('click');
    await flushPromises();
    await nextTick();

    expect(tripsStoreMock.buildItinerary).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: '2026-05-08',
        endDate: '2026-05-11',
      }),
      { source: 'user' },
    );
    expect(wrapper.get('[data-test="planner-end-date"]').text()).toBe('2026-05-11');
    expect(wrapper.get('[data-test="preview-day-count"]').text()).toBe('4');
    expect(resolveRequest).toHaveBeenCalledWith({
      status: 'success',
      routeLabel: '5673 Jamaica Circle, North Richland Hills to 1205 Oriental Avenue, Arlington',
      stopCount: 1,
      dayCount: 4,
    });
    expect(rejectRequest).not.toHaveBeenCalled();
  });

  it('rejects an AI itinerary request when the planner build returns no itinerary', async () => {
    const resolveRequest = vi.fn();
    const rejectRequest = vi.fn();
    tripsStoreMock.buildItinerary.mockResolvedValueOnce(null);
    tripsStoreMock.error = 'No route could be generated.';

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: {
            template: '<div><slot name="assistant" /></div>',
          },
          TripPlannerAiAssist: {
            emits: ['itinerary-build-request'],
            template: `
              <button
                data-test="ai-build-null"
                @click="$emit('itinerary-build-request', {
                  prompt: 'Build with food defaults',
                  reason: 'weekend',
                  draftDefaults: {
                    startDate: '2026-06-01',
                    endDate: '2026-06-01',
                    interests: ['food'],
                    pace: 'moderate',
                    groupSize: 2,
                  },
                  handled: false,
                  resolve: resolveRequest,
                  reject: rejectRequest,
                })"
              >
                AI build
              </button>
            `,
            setup() {
              return { resolveRequest, rejectRequest };
            },
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-test="ai-build-null"]').trigger('click');
    await flushPromises();

    expect(tripsStoreMock.buildItinerary).toHaveBeenCalledWith(expect.objectContaining({
      interests: ['food'],
      pace: 'moderate',
      groupSize: 2,
    }), { source: 'user' });
    expect(resolveRequest).not.toHaveBeenCalled();
    expect(rejectRequest).toHaveBeenCalledWith(expect.any(Error));
  });

  it('autosaves the draft after the user starts editing planner input', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue', 'initialTitle', 'stops', 'suggestedStops', 'submitting', 'mobileWizard', 'mobileActiveStep'],
            emits: ['update:title'],
            template: '<button data-test="planner-title-update" @click="$emit(\'update:title\', \'Autosaved weekend\')">Edit title</button>',
          },
          ItineraryView: {
            template: '<div data-test="itinerary-stub" />',
          },
          TripCard: {
            template: '<div />',
          },
          TripCollaborationBar: {
            props: ['saveState'],
            template: '<div data-test="collaboration-save-state">{{ saveState }}</div>',
          },
          TripShareModal: {
            template: '<div />',
          },
        },
      },
    });

    await flushPromises();
    tripsStoreMock.createTrip.mockClear();
    vi.useFakeTimers();

    await wrapper.get('[data-test="planner-title-update"]').trigger('click');
    await nextTick();

    expect(tripsStoreMock.createTrip).not.toHaveBeenCalled();
    expect(wrapper.get('[data-test="collaboration-save-state"]').text()).toBe('unsaved');

    await vi.advanceTimersByTimeAsync(1200);
    await flushPromises();
    await nextTick();
    await flushPromises();
    await nextTick();

    expect(tripsStoreMock.createTrip).toHaveBeenCalledTimes(1);
    expect(tripsStoreMock.createTrip).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Autosaved weekend',
      destination: 'Autosaved weekend',
    }));
    expect(routerReplaceMock).not.toHaveBeenCalled();
  });

  it('keeps manual saves in the new-trip workspace and names route drafts from endpoints', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue'],
            emits: ['update:draft'],
            template: `
              <button
                data-test="planner-route-update"
                @click="$emit('update:draft', {
                  ...initialValue,
                  destination: 'Cubero, New Mexico, United States',
                  endDestination: '1649 Highway 482, Noble, Louisiana 71462, United States',
                })"
              >
                Set route
              </button>
            `,
          },
          ItineraryView: {
            template: '<div />',
          },
          TripCard: {
            template: '<div />',
          },
          TripCollaborationBar: {
            emits: ['save'],
            template: '<button data-test="save-current-draft" @click="$emit(\'save\')">Save now</button>',
          },
          TripShareModal: {
            template: '<div />',
          },
        },
      },
    });

    await flushPromises();
    tripsStoreMock.createTrip.mockClear();
    routerReplaceMock.mockClear();

    await wrapper.get('[data-test="planner-route-update"]').trigger('click');
    await nextTick();
    await wrapper.get('[data-test="save-current-draft"]').trigger('click');
    await flushPromises();

    expect(tripsStoreMock.createTrip).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Cubero to Noble',
      destination: 'Cubero, New Mexico, United States to 1649 Highway 482, Noble, Louisiana 71462, United States',
    }));
    expect(routerReplaceMock).not.toHaveBeenCalled();
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Draft saved',
      message: 'This trip now lives in Trips, and you can keep building here.',
    });
  });

  it('updates existing drafts on manual save and rolls back failed visibility changes', async () => {
    routeMock.name = 'trip-edit';
    routeMock.params = { id: 'existing-trip-1' };
    tripsStoreMock.fetchTrip.mockResolvedValueOnce({
      id: 'existing-trip-1',
      title: 'Existing private route',
      destination: 'Dallas, Texas to Austin, Texas',
      description: '',
      isPublic: false,
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      budget: 1200,
      spots: [
        { ...buildRouteStop('existing-start', 'Dallas, Texas', 1, 'culture'), city: 'Dallas' },
        { ...buildRouteStop('existing-end', 'Austin, Texas', 2, 'scenic'), city: 'Austin' },
      ],
      members: [{ id: 'user-1', displayName: 'Louis Do', status: 'owner' }],
      status: 'planning',
    });

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: { template: '<div />' },
          TripCard: { template: '<div />' },
          TripCollaborationBar: {
            props: ['isPublic'],
            emits: ['save', 'update:is-public'],
            template: `
              <div>
                <span data-test="existing-visibility">{{ isPublic ? 'public' : 'private' }}</span>
                <button data-test="existing-save" @click="$emit('save')">Save</button>
                <button data-test="existing-public" @click="$emit('update:is-public', true)">Public</button>
              </div>
            `,
          },
          TripShareModal: { template: '<div />' },
          TripPlannerAiAssist: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    await nextTick();

    await wrapper.get('[data-test="existing-save"]').trigger('click');
    await flushPromises();
    expect(tripsStoreMock.updateTrip).toHaveBeenCalledWith('existing-trip-1', expect.objectContaining({
      title: 'Existing private route',
      destination: 'Dallas, Texas to Austin, Texas',
    }));

    tripsStoreMock.error = 'Visibility update failed.';
    tripsStoreMock.updateTrip.mockRejectedValueOnce(new Error('visibility failed'));
    await wrapper.get('[data-test="existing-public"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-test="existing-visibility"]').text()).toBe('private');
    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Draft save failed',
      message: 'Visibility update failed.',
    });
  });

  it('lets the user delete the current autosaved draft from the planner bar after in-app confirmation', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue', 'initialTitle', 'stops', 'suggestedStops', 'submitting', 'mobileWizard', 'mobileActiveStep'],
            emits: ['update:title'],
            template: '<button data-test="planner-title-update" @click="$emit(\'update:title\', \'Autosaved weekend\')">Edit title</button>',
          },
          ItineraryView: {
            template: '<div />',
          },
          TripCard: {
            template: '<div />',
          },
          TripCollaborationBar: {
            props: ['trip'],
            emits: ['delete'],
            template: '<button v-if="trip" data-test="delete-current-draft" @click="$emit(\'delete\')">{{ trip.title }}</button>',
          },
          TripShareModal: {
            template: '<div />',
          },
        },
      },
    });

    await flushPromises();
    tripsStoreMock.createTrip.mockClear();
    vi.useFakeTimers();

    await wrapper.get('[data-test="planner-title-update"]').trigger('click');
    await vi.advanceTimersByTimeAsync(1200);
    await flushPromises();
    await nextTick();

    expect(wrapper.find('[data-test="delete-current-draft"]').exists()).toBe(true);

    await wrapper.get('[data-test="delete-current-draft"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-test="planner-delete-dialog"]').text()).toContain('Are you sure');
    expect(tripsStoreMock.deleteTrip).not.toHaveBeenCalled();

    await wrapper.get('[data-test="planner-delete-confirm"]').trigger('click');
    await flushPromises();

    expect(tripsStoreMock.deleteTrip).toHaveBeenCalledWith('local-trip-1');
    expect(routerReplaceMock).toHaveBeenCalledWith({ name: 'trips' });
    expect(wrapper.find('[data-test="delete-current-draft"]').exists()).toBe(false);
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Draft deleted',
      message: 'That autosaved trip draft was removed from your workspace.',
    });
  });

  it('cancels the delete draft confirmation without deleting', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue', 'initialTitle', 'stops', 'suggestedStops', 'submitting', 'mobileWizard', 'mobileActiveStep'],
            emits: ['update:title'],
            template: '<button data-test="planner-title-update" @click="$emit(\'update:title\', \'Autosaved weekend\')">Edit title</button>',
          },
          ItineraryView: {
            template: '<div />',
          },
          TripCard: {
            template: '<div />',
          },
          TripCollaborationBar: {
            props: ['trip'],
            emits: ['delete'],
            template: '<button v-if="trip" data-test="delete-current-draft" @click="$emit(\'delete\')">{{ trip.title }}</button>',
          },
          TripShareModal: {
            template: '<div />',
          },
        },
      },
    });

    await flushPromises();
    vi.useFakeTimers();

    await wrapper.get('[data-test="planner-title-update"]').trigger('click');
    await vi.advanceTimersByTimeAsync(1200);
    await flushPromises();
    await nextTick();

    await wrapper.get('[data-test="delete-current-draft"]').trigger('click');
    await wrapper.get('[data-test="planner-delete-cancel"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-test="planner-delete-dialog"]').exists()).toBe(false);
    expect(tripsStoreMock.deleteTrip).not.toHaveBeenCalled();
    expect(routerReplaceMock).not.toHaveBeenCalledWith({ name: 'trips' });
  });

  it('lets Scope AI save the production-visible draft through the page handler', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: {
            template: '<div><slot name="assistant" /></div>',
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
          TripPlannerAiAssist: {
            props: ['executeTripCommand'],
            template: '<button data-test="ai-save-draft" @click="executeTripCommand({ type: \'save\' })">AI save</button>',
          },
        },
      },
    });

    await flushPromises();
    tripsStoreMock.createTrip.mockClear();

    await wrapper.get('[data-test="ai-save-draft"]').trigger('click');
    await flushPromises();

    expect(tripsStoreMock.createTrip).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Untitled trip',
      destination: 'Planning route',
    }));
  });

  it('lets Scope AI save then open sharing for the current draft', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: {
            template: '<div><slot name="assistant" /></div>',
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: {
            props: ['open'],
            template: '<div data-test="share-modal">{{ open ? "open" : "closed" }}</div>',
          },
          TripPlannerAiAssist: {
            props: ['executeTripCommand'],
            template: '<button data-test="ai-share-draft" @click="executeTripCommand({ type: \'share\' })">AI share</button>',
          },
        },
      },
    });

    await flushPromises();
    tripsStoreMock.createTrip.mockClear();

    await wrapper.get('[data-test="ai-share-draft"]').trigger('click');
    await flushPromises();

    expect(tripsStoreMock.createTrip).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[data-test="share-modal"]').text()).toBe('open');
  });

  it('lets Scope AI invite a registered trip member after saving the draft', async () => {
    tripsStoreMock.inviteMember.mockResolvedValueOnce({
      id: 'local-trip-1',
      title: 'Untitled trip',
      destination: 'Planning route',
      description: '',
      isPublic: false,
      startDate: '2026-04-30',
      endDate: '2026-04-30',
      spots: [],
      members: [
        { id: 'user-1', displayName: 'Louis Do', status: 'owner' },
        { id: 'user-2', displayName: 'Maya Scope', status: 'pending' },
      ],
      status: 'planning',
    });

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: {
            template: '<div><slot name="assistant" /></div>',
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
          TripPlannerAiAssist: {
            props: ['executeTripCommand'],
            template: '<button data-test="ai-invite-member" @click="executeTripCommand({ type: \'invite\', recipient: \'maya@example.com\', role: \'viewer\' })">AI invite</button>',
          },
        },
      },
    });

    await flushPromises();
    tripsStoreMock.createTrip.mockClear();

    await wrapper.get('[data-test="ai-invite-member"]').trigger('click');
    await flushPromises();

    expect(tripsStoreMock.createTrip).toHaveBeenCalledTimes(1);
    expect(tripsStoreMock.inviteMember).toHaveBeenCalledWith('local-trip-1', {
      recipient: 'maya@example.com',
      role: 'viewer',
    });
  });

  it('reports a Scope AI invite failure when saving does not produce a draft id', async () => {
    tripsStoreMock.createTrip.mockResolvedValueOnce(null);

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: {
            template: '<div><slot name="assistant" /></div>',
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
          TripPlannerAiAssist: {
            props: ['executeTripCommand'],
            data() {
              return { resultMessage: '' };
            },
            methods: {
              async invite() {
                const result = await this.executeTripCommand({ type: 'invite', recipient: 'maya@example.com', role: 'viewer' });
                this.resultMessage = result.message;
              },
            },
            template: '<button data-test="ai-invite-no-draft" @click="invite">{{ resultMessage || "Invite" }}</button>',
          },
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-test="ai-invite-no-draft"]').trigger('click');
    await flushPromises();

    expect(tripsStoreMock.inviteMember).not.toHaveBeenCalled();
    expect(wrapper.get('[data-test="ai-invite-no-draft"]').text()).toBe('Scope could not finish that trip document action right now.');
  });

  it('handles share modal invites and member role updates for a saved trip', async () => {
    routeMock.name = 'trip-edit';
    routeMock.params = { id: 'trip-share-1' };

    const ownerMember = { id: 'user-1', displayName: 'Louis Do', status: 'owner' };
    const editorMember = { id: 'user-2', displayName: 'Maya Scope', status: 'editor' };
    const viewerMember = { id: 'user-2', displayName: 'Maya Scope', status: 'viewer' };
    const baseTrip = {
      id: 'trip-share-1',
      title: 'North Texas Night + Food Loop',
      destination: 'Fort Worth, TX',
      description: '',
      isPublic: false,
      startDate: '2026-05-08',
      endDate: '2026-05-10',
      budget: 1200,
      spots: [],
      members: [ownerMember],
      status: 'planning',
    };

    tripsStoreMock.fetchTrip.mockResolvedValueOnce(baseTrip);
    tripsStoreMock.inviteMember.mockResolvedValueOnce({
      ...baseTrip,
      members: [ownerMember, editorMember],
    });
    tripsStoreMock.updateMemberRole.mockResolvedValueOnce({
      ...baseTrip,
      members: [ownerMember, viewerMember],
    });

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: { template: '<div />' },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripPlannerAiAssist: { template: '<div />' },
          TripShareModal: {
            props: ['members'],
            emits: ['invite', 'update-role'],
            template: `
              <div>
                <span data-test="modal-member-count">{{ members.length }}</span>
                <button data-test="modal-invite" @click="$emit('invite', { recipient: 'maya@example.com', role: 'editor' })">Invite</button>
                <button data-test="modal-role" @click="$emit('update-role', { userId: 'user-2', role: 'viewer' })">Viewer</button>
              </div>
            `,
          },
        },
      },
    });

    await flushPromises();
    await nextTick();
    expect(wrapper.get('[data-test="modal-member-count"]').text()).toBe('1');

    await wrapper.get('[data-test="modal-invite"]').trigger('click');
    await flushPromises();
    expect(tripsStoreMock.inviteMember).toHaveBeenCalledWith('trip-share-1', {
      recipient: 'maya@example.com',
      role: 'editor',
    });
    expect(wrapper.get('[data-test="modal-member-count"]').text()).toBe('2');
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Invite queued',
      message: 'maya@example.com can edit this trip when they accept.',
    });

    await wrapper.get('[data-test="modal-role"]').trigger('click');
    await flushPromises();
    expect(tripsStoreMock.updateMemberRole).toHaveBeenCalledWith('trip-share-1', 'user-2', 'viewer');
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Access updated',
      message: 'That crew permission is saved.',
    });

    tripsStoreMock.error = 'Invite API unavailable.';
    tripsStoreMock.inviteMember.mockRejectedValueOnce(new Error('invite failed'));
    await wrapper.get('[data-test="modal-invite"]').trigger('click');
    await flushPromises();
    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Invite failed',
      message: 'Invite API unavailable.',
    });

    tripsStoreMock.error = 'Role API unavailable.';
    tripsStoreMock.updateMemberRole.mockRejectedValueOnce(new Error('role failed'));
    await wrapper.get('[data-test="modal-role"]').trigger('click');
    await flushPromises();
    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Access update failed',
      message: 'Role API unavailable.',
    });
  });

  it('lets Scope AI save an unsaved draft before making it public', async () => {
    tripsStoreMock.createTrip.mockResolvedValueOnce({
      id: 'local-trip-1',
      title: 'Untitled trip',
      destination: 'Planning route',
      description: '',
      isPublic: true,
      startDate: '2026-04-30',
      endDate: '2026-04-30',
      spots: [],
      members: [{ id: 'user-1', displayName: 'Louis Do', status: 'owner' }],
      status: 'planning',
    });

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: {
            template: '<div><slot name="assistant" /></div>',
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: {
            props: ['isPublic'],
            template: '<div data-test="collaboration-visibility">{{ isPublic ? "public" : "private" }}</div>',
          },
          TripShareModal: { template: '<div />' },
          TripPlannerAiAssist: {
            props: ['executeTripCommand'],
            template: '<button data-test="ai-make-public" @click="executeTripCommand({ type: \'visibility\', isPublic: true })">AI public</button>',
          },
        },
      },
    });

    await flushPromises();
    tripsStoreMock.createTrip.mockClear();

    await wrapper.get('[data-test="ai-make-public"]').trigger('click');
    await flushPromises();

    expect(tripsStoreMock.createTrip).toHaveBeenCalledWith(expect.objectContaining({
      isPublic: true,
    }));
    expect(wrapper.get('[data-test="collaboration-visibility"]').text()).toBe('public');
  });

  it('lets Scope AI delete only after the component-level confirmation reaches the page handler', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: {
            template: '<div><slot name="assistant" /></div>',
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
          TripPlannerAiAssist: {
            props: ['executeTripCommand'],
            template: `
              <div>
                <button data-test="ai-save-before-delete" @click="executeTripCommand({ type: 'save' })">AI save</button>
                <button data-test="ai-delete-draft" @click="executeTripCommand({ type: 'delete' })">AI delete</button>
              </div>
            `,
          },
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-test="ai-save-before-delete"]').trigger('click');
    await flushPromises();
    tripsStoreMock.deleteTrip.mockClear();

    await wrapper.get('[data-test="ai-delete-draft"]').trigger('click');
    await flushPromises();

    expect(tripsStoreMock.deleteTrip).toHaveBeenCalledWith('local-trip-1');
    expect(routerReplaceMock).toHaveBeenCalledWith({ name: 'trips' });
  });

  it('reports Scope AI delete failures for saved drafts without clearing the workspace', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: {
            template: '<div><slot name="assistant" /></div>',
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
          TripPlannerAiAssist: {
            props: ['executeTripCommand'],
            data() {
              return { resultMessage: '' };
            },
            methods: {
              async runTripCommand(payload: Record<string, unknown>) {
                const result = await this.executeTripCommand(payload);
                this.resultMessage = result.message;
              },
            },
            template: `
              <div>
                <span data-test="ai-delete-failure-result">{{ resultMessage }}</span>
                <button data-test="ai-save-before-delete-failure" @click="runTripCommand({ type: 'save' })">AI save</button>
                <button data-test="ai-delete-fails" @click="runTripCommand({ type: 'delete' })">AI delete</button>
              </div>
            `,
          },
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-test="ai-save-before-delete-failure"]').trigger('click');
    await flushPromises();

    tripsStoreMock.error = 'Delete API unavailable.';
    tripsStoreMock.deleteTrip.mockRejectedValueOnce(new Error('delete failed'));
    await wrapper.get('[data-test="ai-delete-fails"]').trigger('click');
    await flushPromises();

    expect(routerReplaceMock).not.toHaveBeenCalledWith({ name: 'trips' });
    expect(wrapper.get('[data-test="ai-delete-failure-result"]').text()).toBe('Delete API unavailable.');
    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Draft delete failed',
      message: 'Delete API unavailable.',
    });
  });

  it('reports Scope AI trip document no-ops, failures, and unknown commands', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: {
            template: '<div><slot name="assistant" /></div>',
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
          TripPlannerAiAssist: {
            props: ['executeTripCommand'],
            data() {
              return { resultMessage: '' };
            },
            methods: {
              async runTripCommand(payload: Record<string, unknown>) {
                const result = await this.executeTripCommand(payload);
                this.resultMessage = result.message;
              },
            },
            template: `
              <div>
                <span data-test="trip-command-result">{{ resultMessage }}</span>
                <button data-test="ai-already-private" @click="runTripCommand({ type: 'visibility', isPublic: false })">Already private</button>
                <button data-test="ai-public-fails" @click="runTripCommand({ type: 'visibility', isPublic: true })">Public fails</button>
                <button data-test="ai-save-fails" @click="runTripCommand({ type: 'save' })">Save fails</button>
                <button data-test="ai-unknown-command" @click="runTripCommand({ type: 'archive' })">Unknown</button>
              </div>
            `,
          },
        },
      },
    });

    await flushPromises();
    tripsStoreMock.createTrip.mockClear();

    await wrapper.get('[data-test="ai-already-private"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-test="trip-command-result"]').text()).toBe('This trip is already private.');
    expect(tripsStoreMock.createTrip).not.toHaveBeenCalled();

    tripsStoreMock.error = 'Visibility API unavailable.';
    tripsStoreMock.createTrip.mockRejectedValueOnce(new Error('visibility failed'));
    await wrapper.get('[data-test="ai-public-fails"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-test="trip-command-result"]').text()).toBe('I could not update that trip visibility right now.');

    tripsStoreMock.error = 'Scope Core is offline.';
    tripsStoreMock.createTrip.mockRejectedValueOnce(new Error('offline'));

    await wrapper.get('[data-test="ai-save-fails"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-test="trip-command-result"]').text()).toBe('Scope Core is offline.');

    tripsStoreMock.error = '';
    await wrapper.get('[data-test="ai-unknown-command"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-test="trip-command-result"]').text()).toBe('I could not match that trip document action.');
  });

  it('bridges Scope AI map commands to the itinerary map controls', async () => {
    const runPlannerMapCommand = vi.fn().mockResolvedValue({
      ok: true,
      message: 'Zoomed the planner map in.',
    });

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: {
            template: '<div><slot name="assistant" /></div>',
            setup(_, { expose }) {
              expose({ runPlannerMapCommand });
            },
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
          TripPlannerAiAssist: {
            props: ['executeMapCommand'],
            template: '<button data-test="ai-zoom-map" @click="executeMapCommand({ command: \'zoom_in\' })">AI zoom</button>',
          },
        },
      },
    });

    await flushPromises();

    await wrapper.get('[data-test="ai-zoom-map"]').trigger('click');
    await flushPromises();

    expect(runPlannerMapCommand).toHaveBeenCalledWith('zoom_in');
  });

  it('returns precise Scope AI map feedback when target lookup or map controls are unavailable', async () => {
    geocodeMock
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({
        data: [{
          latitude: 35.155,
          longitude: -101.843,
          placeName: 'Nowhere County',
          formattedAddress: 'Nowhere County, Texas, United States',
          country: 'United States',
          countryCode: 'us',
          precision: 'district',
        }],
      });
    const runPlannerMapCommand = vi.fn().mockResolvedValue(undefined);

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: {
            template: '<div><slot name="assistant" /></div>',
            setup(_, { expose }) {
              expose({ runPlannerMapCommand });
            },
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
          TripPlannerAiAssist: {
            props: ['executeMapCommand'],
            data() {
              return { resultMessage: '' };
            },
            methods: {
              async runMapCommand(payload: Record<string, unknown>) {
                const result = await this.executeMapCommand(payload);
                this.resultMessage = result.message;
              },
            },
            template: `
              <div>
                <span data-test="map-command-result">{{ resultMessage }}</span>
                <button data-test="ai-blank-place" @click="runMapCommand({ command: 'zoom_to_place', query: '   ' })">Blank place</button>
                <button data-test="ai-missing-place" @click="runMapCommand({ command: 'zoom_to_place', query: 'Atlantis' })">Missing place</button>
                <button data-test="ai-unloaded-place" @click="runMapCommand({ command: 'zoom_to_place', query: 'Nowhere County' })">Unloaded place</button>
                <button data-test="ai-unloaded-zoom" @click="runMapCommand({ command: 'zoom_out' })">Unloaded zoom</button>
              </div>
            `,
          },
        },
      },
    });

    await flushPromises();

    await wrapper.get('[data-test="ai-blank-place"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-test="map-command-result"]').text()).toBe('Tell me where to zoom the planner map, like "zoom into Texas."');
    expect(geocodeMock).not.toHaveBeenCalled();

    await wrapper.get('[data-test="ai-missing-place"]').trigger('click');
    await flushPromises();
    expect(geocodeMock).toHaveBeenCalledWith('Atlantis', 5);
    expect(wrapper.get('[data-test="map-command-result"]').text()).toBe('I could not find "Atlantis" on the planner map.');

    await wrapper.get('[data-test="ai-unloaded-place"]').trigger('click');
    await flushPromises();
    expect(geocodeMock).toHaveBeenCalledWith('Nowhere County', 5);
    expect(wrapper.get('[data-test="map-command-result"]').text()).toBe('The planner map is still loading, so I could not run that map command yet.');

    await wrapper.get('[data-test="ai-unloaded-zoom"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-test="map-command-result"]').text()).toBe('The planner map is still loading, so I could not run that map command yet.');
  });

  it('geocodes targeted Scope AI map zoom commands before moving the itinerary map', async () => {
    geocodeMock.mockResolvedValueOnce({
      data: [{
        latitude: -27.9994,
        longitude: 151.1676,
        placeName: 'Texas',
        formattedAddress: 'Texas, Queensland, Australia',
        country: 'Australia',
        countryCode: 'au',
        precision: 'region',
      }, {
        latitude: 29.3838,
        longitude: -94.9027,
        placeName: 'Texas City',
        formattedAddress: 'Texas City, Texas, United States',
        country: 'United States',
        countryCode: 'us',
        precision: 'place',
      }, {
        latitude: 31.9686,
        longitude: -99.9018,
        placeName: 'Texas',
        formattedAddress: 'Texas, United States',
        country: 'United States',
        countryCode: 'us',
        precision: 'region',
      }],
    });
    const runPlannerMapCommand = vi.fn().mockResolvedValue({
      ok: true,
      message: 'Zoomed the planner map to Texas, United States.',
    });

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: {
            template: '<div><slot name="assistant" /></div>',
            setup(_, { expose }) {
              expose({ runPlannerMapCommand });
            },
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
          TripPlannerAiAssist: {
            props: ['executeMapCommand'],
            template: '<button data-test="ai-zoom-to-place" @click="executeMapCommand({ command: \'zoom_to_place\', query: \'texas\' })">AI zoom to Texas</button>',
          },
        },
      },
    });

    await flushPromises();

    await wrapper.get('[data-test="ai-zoom-to-place"]').trigger('click');
    await flushPromises();

    expect(geocodeMock).toHaveBeenCalledWith('texas', 5);
    expect(runPlannerMapCommand).toHaveBeenCalledWith({
      command: 'zoom_to_place',
      query: 'texas',
      target: {
        label: 'Texas, United States',
        latitude: 31.9686,
        longitude: -99.9018,
        precision: 'region',
        zoom: 5.4,
      },
    });
  });

  it('chooses state and city-in-state Scope AI map zoom targets from natural US wording', async () => {
    geocodeMock
      .mockResolvedValueOnce({
        data: [{
          latitude: 33.9237,
          longitude: -84.8408,
          placeName: 'Dallas',
          formattedAddress: 'Dallas, Georgia, United States',
          country: 'United States',
          countryCode: 'us',
          precision: 'place',
        }, {
          latitude: 32.7767,
          longitude: -96.797,
          placeName: 'Dallas',
          formattedAddress: 'Dallas, Texas, United States',
          country: 'United States',
          countryCode: 'us',
          precision: 'place',
        }],
      })
      .mockResolvedValueOnce({
        data: [{
          latitude: 35.1258,
          longitude: -117.9859,
          placeName: 'California City',
          formattedAddress: 'California City, California, United States',
          country: 'United States',
          countryCode: 'us',
          precision: 'place',
        }, {
          latitude: 37.1552,
          longitude: -119.5434,
          placeName: 'California',
          formattedAddress: 'California, United States',
          country: 'United States',
          countryCode: 'us',
          precision: 'region',
        }],
      });
    const runPlannerMapCommand = vi.fn().mockResolvedValue({
      ok: true,
      message: 'Zoomed the planner map.',
    });

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: {
            template: '<div><slot name="assistant" /></div>',
            setup(_, { expose }) {
              expose({ runPlannerMapCommand });
            },
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
          TripPlannerAiAssist: {
            props: ['executeMapCommand'],
            template: `
              <div>
                <button data-test="ai-zoom-city-state" @click="executeMapCommand({ command: 'zoom_to_place', query: 'dallas tx' })">AI zoom to Dallas TX</button>
                <button data-test="ai-zoom-state-of" @click="executeMapCommand({ command: 'zoom_to_place', query: 'state of california' })">AI zoom to state of California</button>
              </div>
            `,
          },
        },
      },
    });

    await flushPromises();

    await wrapper.get('[data-test="ai-zoom-city-state"]').trigger('click');
    await flushPromises();

    expect(geocodeMock).toHaveBeenNthCalledWith(1, 'dallas tx', 5);
    expect(runPlannerMapCommand).toHaveBeenNthCalledWith(1, {
      command: 'zoom_to_place',
      query: 'dallas tx',
      target: {
        label: 'Dallas, Texas, United States',
        latitude: 32.7767,
        longitude: -96.797,
        precision: 'place',
        zoom: 10.5,
      },
    });

    await wrapper.get('[data-test="ai-zoom-state-of"]').trigger('click');
    await flushPromises();

    expect(geocodeMock).toHaveBeenNthCalledWith(2, 'state of california', 5);
    expect(runPlannerMapCommand).toHaveBeenNthCalledWith(2, {
      command: 'zoom_to_place',
      query: 'state of california',
      target: {
        label: 'California, United States',
        latitude: 37.1552,
        longitude: -119.5434,
        precision: 'region',
        zoom: 5.4,
      },
    });
  });

  it('honors an explicit non-US country in targeted Scope AI map zoom commands', async () => {
    geocodeMock.mockResolvedValueOnce({
      data: [{
        latitude: -27.9994,
        longitude: 151.1676,
        placeName: 'Texas',
        formattedAddress: 'Texas, Queensland, Australia',
        country: 'Australia',
        countryCode: 'au',
        precision: 'region',
      }, {
        latitude: 31.9686,
        longitude: -99.9018,
        placeName: 'Texas',
        formattedAddress: 'Texas, United States',
        country: 'United States',
        countryCode: 'us',
        precision: 'region',
      }],
    });
    const runPlannerMapCommand = vi.fn().mockResolvedValue({
      ok: true,
      message: 'Zoomed the planner map to Texas, Queensland, Australia.',
    });

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: {
            template: '<div><slot name="assistant" /></div>',
            setup(_, { expose }) {
              expose({ runPlannerMapCommand });
            },
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
          TripPlannerAiAssist: {
            props: ['executeMapCommand'],
            template: '<button data-test="ai-zoom-to-place" @click="executeMapCommand({ command: \'zoom_to_place\', query: \'texas australia\' })">AI zoom to Texas Australia</button>',
          },
        },
      },
    });

    await flushPromises();

    await wrapper.get('[data-test="ai-zoom-to-place"]').trigger('click');
    await flushPromises();

    expect(geocodeMock).toHaveBeenCalledWith('texas australia', 5);
    expect(runPlannerMapCommand).toHaveBeenCalledWith({
      command: 'zoom_to_place',
      query: 'texas australia',
      target: {
        label: 'Texas, Queensland, Australia',
        latitude: -27.9994,
        longitude: 151.1676,
        precision: 'region',
        zoom: 5.4,
      },
    });
  });

  it('sets country and neighborhood zoom levels and falls back to the query as a map label', async () => {
    geocodeMock
      .mockResolvedValueOnce({
        data: [{
          latitude: 56.1304,
          longitude: -106.3468,
          placeName: 'Canada',
          formattedAddress: 'Canada',
          country: 'Canada',
          countryCode: 'ca',
          precision: 'country',
        }],
      })
      .mockResolvedValueOnce({
        data: [{
          latitude: 32.784,
          longitude: -96.8089,
          country: 'United States',
          countryCode: 'us',
          precision: 'neighborhood',
        }],
      })
      .mockResolvedValueOnce({
        data: [{
          latitude: 29.4241,
          longitude: -98.4936,
          placeName: 'Tiny Landmark',
          formattedAddress: 'Tiny Landmark, San Antonio, Texas, United States',
          country: 'United States',
          countryCode: 'us',
          precision: 'poi',
        }],
      })
      .mockResolvedValueOnce({
        data: [{
          latitude: 35,
          longitude: -100,
          placeName: 'Fallback Symbols',
          formattedAddress: 'Fallback Symbols, United States',
          country: 'United States',
          countryCode: 'us',
          precision: 'region',
        }],
      })
      .mockResolvedValueOnce({
        data: [{
          latitude: 39.8283,
          longitude: -98.5795,
          placeName: 'United States',
          formattedAddress: 'United States',
          country: 'United States',
          countryCode: 'us',
          precision: 'country',
        }],
      });
    const runPlannerMapCommand = vi.fn().mockResolvedValue({
      ok: true,
      message: 'Moved map.',
    });

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: {
            template: '<div><slot name="assistant" /></div>',
            setup(_, { expose }) {
              expose({ runPlannerMapCommand });
            },
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
          TripPlannerAiAssist: {
            props: ['executeMapCommand'],
            template: `
              <div>
                <button data-test="ai-zoom-country" @click="executeMapCommand({ command: 'zoom_to_place', query: 'canada' })">Canada</button>
                <button data-test="ai-zoom-neighborhood" @click="executeMapCommand({ command: 'zoom_to_place', query: 'deep ellum' })">Deep Ellum</button>
                <button data-test="ai-zoom-poi" @click="executeMapCommand({ command: 'zoom_to_place', query: 'tiny landmark' })">Tiny landmark</button>
                <button data-test="ai-zoom-symbols" @click="executeMapCommand({ command: 'zoom_to_place', query: '!!!' })">Symbols</button>
                <button data-test="ai-zoom-usa" @click="executeMapCommand({ command: 'zoom_to_place', query: 'usa' })">USA</button>
              </div>
            `,
          },
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-test="ai-zoom-country"]').trigger('click');
    await flushPromises();
    await wrapper.get('[data-test="ai-zoom-neighborhood"]').trigger('click');
    await flushPromises();
    await wrapper.get('[data-test="ai-zoom-poi"]').trigger('click');
    await flushPromises();
    await wrapper.get('[data-test="ai-zoom-symbols"]').trigger('click');
    await flushPromises();
    await wrapper.get('[data-test="ai-zoom-usa"]').trigger('click');
    await flushPromises();

    expect(runPlannerMapCommand).toHaveBeenNthCalledWith(1, {
      command: 'zoom_to_place',
      query: 'canada',
      target: {
        label: 'Canada',
        latitude: 56.1304,
        longitude: -106.3468,
        precision: 'country',
        zoom: 3.75,
      },
    });
    expect(runPlannerMapCommand).toHaveBeenNthCalledWith(2, {
      command: 'zoom_to_place',
      query: 'deep ellum',
      target: {
        label: 'deep ellum',
        latitude: 32.784,
        longitude: -96.8089,
        precision: 'neighborhood',
        zoom: 12.25,
      },
    });
    expect(runPlannerMapCommand).toHaveBeenNthCalledWith(3, {
      command: 'zoom_to_place',
      query: 'tiny landmark',
      target: {
        label: 'Tiny Landmark, San Antonio, Texas, United States',
        latitude: 29.4241,
        longitude: -98.4936,
        precision: 'poi',
        zoom: 14,
      },
    });
    expect(runPlannerMapCommand).toHaveBeenNthCalledWith(4, expect.objectContaining({
      command: 'zoom_to_place',
      query: '!!!',
      target: expect.objectContaining({
        label: 'Fallback Symbols, United States',
      }),
    }));
    expect(runPlannerMapCommand).toHaveBeenNthCalledWith(5, expect.objectContaining({
      command: 'zoom_to_place',
      query: 'usa',
      target: expect.objectContaining({
        label: 'United States',
        zoom: 3.75,
      }),
    }));
  });

  it('honors global city and country Scope AI map targets instead of forcing US matches', async () => {
    geocodeMock
      .mockResolvedValueOnce({
        data: [{
          latitude: 35.6762,
          longitude: 139.6503,
          placeName: 'Tokyo',
          formattedAddress: 'Tokyo, Japan',
          country: 'Japan',
          countryCode: 'jp',
          precision: 'place',
        }, {
          latitude: 35.5195,
          longitude: -97.6323,
          placeName: 'Tokyo',
          formattedAddress: 'Tokyo, Oklahoma, United States',
          country: 'United States',
          countryCode: 'us',
          precision: 'place',
        }],
      })
      .mockResolvedValueOnce({
        data: [{
          latitude: 33.6609,
          longitude: -95.5555,
          placeName: 'Paris',
          formattedAddress: 'Paris, Texas, United States',
          country: 'United States',
          countryCode: 'us',
          precision: 'place',
        }, {
          latitude: 48.8566,
          longitude: 2.3522,
          placeName: 'Paris',
          formattedAddress: 'Paris, France',
          country: 'France',
          countryCode: 'fr',
          precision: 'place',
        }],
      })
      .mockResolvedValueOnce({
        data: [{
          latitude: 39.8864,
          longitude: -83.4483,
          placeName: 'London',
          formattedAddress: 'London, Ohio, United States',
          country: 'United States',
          countryCode: 'us',
          precision: 'place',
        }, {
          latitude: 51.5072,
          longitude: -0.1276,
          placeName: 'London',
          formattedAddress: 'London, United Kingdom',
          country: 'United Kingdom',
          countryCode: 'gb',
          precision: 'place',
        }],
      });
    const runPlannerMapCommand = vi.fn().mockResolvedValue({
      ok: true,
      message: 'Zoomed the planner map.',
    });

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: {
            template: '<div><slot name="assistant" /></div>',
            setup(_, { expose }) {
              expose({ runPlannerMapCommand });
            },
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
          TripPlannerAiAssist: {
            props: ['executeMapCommand'],
            template: `
              <div>
                <button data-test="ai-zoom-tokyo" @click="executeMapCommand({ command: 'zoom_to_place', query: 'tokyo' })">AI zoom to Tokyo</button>
                <button data-test="ai-zoom-paris-france" @click="executeMapCommand({ command: 'zoom_to_place', query: 'paris france' })">AI zoom to Paris France</button>
                <button data-test="ai-zoom-london-uk" @click="executeMapCommand({ command: 'zoom_to_place', query: 'london uk' })">AI zoom to London UK</button>
              </div>
            `,
          },
        },
      },
    });

    await flushPromises();

    await wrapper.get('[data-test="ai-zoom-tokyo"]').trigger('click');
    await flushPromises();
    expect(runPlannerMapCommand).toHaveBeenNthCalledWith(1, {
      command: 'zoom_to_place',
      query: 'tokyo',
      target: {
        label: 'Tokyo, Japan',
        latitude: 35.6762,
        longitude: 139.6503,
        precision: 'place',
        zoom: 10.5,
      },
    });

    await wrapper.get('[data-test="ai-zoom-paris-france"]').trigger('click');
    await flushPromises();
    expect(runPlannerMapCommand).toHaveBeenNthCalledWith(2, {
      command: 'zoom_to_place',
      query: 'paris france',
      target: {
        label: 'Paris, France',
        latitude: 48.8566,
        longitude: 2.3522,
        precision: 'place',
        zoom: 10.5,
      },
    });

    await wrapper.get('[data-test="ai-zoom-london-uk"]').trigger('click');
    await flushPromises();
    expect(runPlannerMapCommand).toHaveBeenNthCalledWith(3, {
      command: 'zoom_to_place',
      query: 'london uk',
      target: {
        label: 'London, United Kingdom',
        latitude: 51.5072,
        longitude: -0.1276,
        precision: 'place',
        zoom: 10.5,
      },
    });
  });

  it('keeps the blank trip map on a full-USA view even with a saved onboarding home base', async () => {
    authStoreMock.currentUser = {
      ...authStoreMock.currentUser,
      homeBase: 'Austin, TX',
    };
    geocodeMock.mockResolvedValueOnce({
      data: [{
        latitude: 30.2672,
        longitude: -97.7431,
        placeName: 'Austin',
        city: 'Austin',
        country: 'United States',
      }],
    });

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            template: '<div />',
          },
          ItineraryView: {
            props: ['initialMapViewport'],
            template: '<div data-test="planner-map-viewport">{{ initialMapViewport.center[0] }},{{ initialMapViewport.center[1] }} / {{ initialMapViewport.zoom }} / {{ initialMapViewport.style }}</div>',
          },
          TripCard: {
            template: '<div />',
          },
          TripCollaborationBar: {
            template: '<div data-test="collaboration-bar-stub" />',
          },
          TripShareModal: {
            template: '<div />',
          },
        },
      },
    });

    await flushPromises();
    await nextTick();

    expect(geocodeMock).not.toHaveBeenCalledWith('Austin, TX', 1);
    expect(wrapper.get('[data-test="planner-map-viewport"]').text()).toBe(`-98.5795,39.8283 / 3.25 / ${STREETS_MAP_STYLE}`);
  });

  it('prioritizes the current map location as the planner location-search proximity', async () => {
    const mapStore = useMapStore();
    mapStore.setUserLocation([-97.7431, 30.2672]);

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['locationSearchProximity'],
            template: '<div data-test="planner-proximity">{{ locationSearchProximity.label }}|{{ locationSearchProximity.latitude }}|{{ locationSearchProximity.longitude }}</div>',
          },
          ItineraryView: { template: '<div />' },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();

    expect(wrapper.get('[data-test="planner-proximity"]').text()).toBe('current location|30.2672|-97.7431');
  });

  it('uses a saved home-base map anchor as location-search proximity while editing a trip', async () => {
    routeMock.name = 'trip-edit';
    routeMock.params = { id: 'home-anchor-trip' };
    authStoreMock.currentUser = {
      ...authStoreMock.currentUser,
      homeBase: 'Austin, TX',
    };
    geocodeMock.mockResolvedValueOnce({
      data: [{
        latitude: 30.2672,
        longitude: -97.7431,
        placeName: 'Austin',
        formattedAddress: 'Austin, Texas, United States',
        country: 'United States',
        countryCode: 'us',
        precision: 'place',
      }],
    });
    tripsStoreMock.fetchTrip.mockResolvedValueOnce(buildRouteLibraryTrip({
      id: 'home-anchor-trip',
      isPublic: false,
      members: [{ id: 'user-1', displayName: 'Louis Do', status: 'owner' }],
    }));

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['locationSearchProximity'],
            template: `
              <div data-test="planner-home-proximity">
                {{ locationSearchProximity ? locationSearchProximity.label + '|' + locationSearchProximity.latitude + '|' + locationSearchProximity.longitude : 'none' }}
              </div>
            `,
          },
          ItineraryView: {
            props: ['initialMapViewport'],
            template: '<div data-test="planner-home-viewport">{{ initialMapViewport.center[0] }},{{ initialMapViewport.center[1] }} / {{ initialMapViewport.zoom }} / {{ initialMapViewport.style }}</div>',
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
          TripPlannerAiAssist: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    await nextTick();

    expect(geocodeMock).toHaveBeenCalledWith('Austin, TX', 1);
    expect(wrapper.get('[data-test="planner-home-proximity"]').text()).toBe('Austin, TX|30.2672|-97.7431');
    expect(wrapper.get('[data-test="planner-home-viewport"]').text()).toBe(`-97.7431,30.2672 / 9.4 / ${STREETS_MAP_STYLE}`);
  });

  it('switches to the mobile step wizard and advances into the preview step after a successful submit', async () => {
    setViewportWidth(390);

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue', 'initialTitle', 'budgetRange', 'selectedStops', 'suggestedStops', 'submitting', 'mobileWizard', 'mobileActiveStep'],
            emits: ['submit', 'update:draft', 'update:title', 'update:stops', 'wizard-step-change'],
            template: `
              <div data-test="planner-stub">
                <span data-test="planner-stub-layout">{{ mobileWizard }} / {{ mobileActiveStep }}</span>
                <button data-test="planner-step-zero-trigger" @click="$emit('wizard-step-change', 0)">Step 0</button>
                <button data-test="planner-step-2-trigger" @click="$emit('wizard-step-change', 2)">Step 2</button>
                <button data-test="planner-step-2-toggle">Step 2 toggle</button>
                <button data-test="planner-step-4-toggle">Step 4 toggle</button>
                <button data-test="planner-submit" @click="$emit('submit', initialValue)">Submit planner</button>
              </div>
            `,
          },
          ItineraryView: {
            props: ['itinerary', 'draft', 'tripTitle', 'members', 'submitting', 'mobileWizard', 'mobileActiveStep'],
            template: '<div data-test="itinerary-stub">{{ mobileWizard }} / {{ mobileActiveStep }}</div>',
          },
          TripCard: {
            props: ['trip'],
            template: '<div class="trip-card-stub">{{ trip.title }}</div>',
          },
          TripCollaborationBar: {
            template: '<div data-test="collaboration-bar-stub" />',
          },
          TripShareModal: {
            template: '<div />',
          },
        },
      },
    });

    await flushPromises();
    await nextTick();

    expect(wrapper.get('.planner-page').attributes('data-planner-layout')).toBe('mobile-wizard');
    expect(wrapper.text()).toContain('Prep a route the guide can trust');
    expect(wrapper.get('[data-test="planner-stub-layout"]').text()).toBe('true / 1');
    expect(wrapper.get('[data-test="itinerary-stub"]').text()).toBe('true / 1');

    await wrapper.get('[data-test="planner-step-2-trigger"]').trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="itinerary-stub"]').text()).toBe('true / 2');

    await wrapper.get('[data-test="planner-step-zero-trigger"]').trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="itinerary-stub"]').text()).toBe('true / 1');

    await wrapper.get('[data-test="planner-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-test="itinerary-stub"]').text()).toBe('true / 4');
    expect(toastStoreMock.showSuccess).not.toHaveBeenCalledWith({
      title: 'Itinerary refreshed',
      message: 'Scope refreshed the preview and saved this trip draft.',
    });
  });

  it('accepts wizard step events on desktop without requiring mobile step anchors', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            emits: ['wizard-step-change'],
            props: ['mobileWizard', 'mobileActiveStep'],
            template: `
              <div>
                <span data-test="desktop-wizard-state">{{ mobileWizard }} / {{ mobileActiveStep }}</span>
                <button data-test="desktop-step-change" @click="$emit('wizard-step-change', 3)">Step 3</button>
              </div>
            `,
          },
          ItineraryView: {
            props: ['mobileWizard', 'mobileActiveStep'],
            template: '<div data-test="desktop-itinerary-step">{{ mobileWizard }} / {{ mobileActiveStep }}</div>',
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
          TripPlannerAiAssist: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    expect(wrapper.get('[data-test="desktop-wizard-state"]').text()).toBe('false / 1');

    await wrapper.get('[data-test="desktop-step-change"]').trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="desktop-itinerary-step"]').text()).toBe('false / 3');
  });

  it('fills the planner destination when the map picker selects a city', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue'],
            template: `
              <div data-test="planner-draft">
                <span data-test="planner-destination">{{ initialValue.destination }}</span>
                <span data-test="planner-end-destination">{{ initialValue.endDestination }}</span>
                <span data-test="planner-destination-latitude">{{ initialValue.destinationLatitude }}</span>
                <span data-test="planner-destination-longitude">{{ initialValue.destinationLongitude }}</span>
              </div>
            `,
          },
          ItineraryView: {
            emits: ['map-location-select'],
            template: `
              <button
                data-test="map-location-select"
                @click="$emit('map-location-select', { target: 'destination', label: 'Austin, United States', latitude: 30.2672, longitude: -97.7431, city: 'Austin', country: 'United States' })"
              >
                Pick Austin
              </button>
            `,
          },
          TripCard: {
            props: ['trip'],
            template: '<div class="trip-card-stub">{{ trip.title }}</div>',
          },
          TripCollaborationBar: {
            template: '<div data-test="collaboration-bar-stub" />',
          },
          TripShareModal: {
            template: '<div />',
          },
        },
      },
    });

    await flushPromises();
    expect(wrapper.get('[data-test="planner-destination"]').text()).toBe('');

    await wrapper.get('[data-test="map-location-select"]').trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="planner-destination"]').text()).toBe('Austin, United States');
    expect(wrapper.get('[data-test="planner-destination-latitude"]').text()).toBe('30.2672');
    expect(wrapper.get('[data-test="planner-destination-longitude"]').text()).toBe('-97.7431');
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Start city set',
      message: 'Austin, United States was added from the map.',
    });
  });

  it('clears start and end when the itinerary route sequence removes endpoints', async () => {
    authStoreMock.currentUser = {
      ...authStoreMock.currentUser,
      homeBase: 'Austin, TX',
    };
    geocodeMock.mockResolvedValueOnce({
      data: [{
        latitude: 30.2672,
        longitude: -97.7431,
        placeName: 'Austin',
        city: 'Austin',
        country: 'United States',
      }],
    });

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue', 'initialTitle', 'stops'],
            template: `
              <div data-test="planner-draft">
                <span data-test="planner-title">{{ initialTitle }}</span>
                <span data-test="planner-destination">{{ initialValue.destination }}</span>
                <span data-test="planner-end-destination">{{ initialValue.endDestination }}</span>
                <span data-test="planner-destination-latitude">{{ initialValue.destinationLatitude }}</span>
                <span data-test="planner-end-destination-latitude">{{ initialValue.endDestinationLatitude }}</span>
                <span data-test="planner-stop-count">{{ stops.length }}</span>
              </div>
            `,
          },
          ItineraryView: {
            props: ['initialMapViewport', 'itinerary', 'stops'],
            emits: ['map-location-select', 'route-endpoint-remove'],
            template: `
              <div>
                <span data-test="planner-map-viewport">{{ initialMapViewport.center[0] }},{{ initialMapViewport.center[1] }} / {{ initialMapViewport.zoom }}</span>
                <span data-test="planner-preview-state">{{ itinerary ? 'Preview' : 'No preview' }}</span>
                <span data-test="itinerary-stop-count">{{ stops.length }}</span>
                <button
                  data-test="map-location-select-start"
                  @click="$emit('map-location-select', { target: 'destination', label: 'Dallas, United States', latitude: 32.7767, longitude: -96.797, city: 'Dallas', country: 'United States' })"
                >
                  Pick Dallas
                </button>
                <button
                  data-test="map-location-select-end"
                  @click="$emit('map-location-select', { target: 'endDestination', label: 'Austin, United States', latitude: 30.2672, longitude: -97.7431, city: 'Austin', country: 'United States' })"
                >
                  Pick Austin
                </button>
                <button data-test="route-start-remove" @click="$emit('route-endpoint-remove', 'destination')">Remove start</button>
                <button data-test="route-end-remove" @click="$emit('route-endpoint-remove', 'endDestination')">Remove end</button>
              </div>
            `,
          },
          TripCard: {
            props: ['trip'],
            template: '<div class="trip-card-stub">{{ trip.title }}</div>',
          },
          TripCollaborationBar: {
            template: '<div data-test="collaboration-bar-stub" />',
          },
          TripShareModal: {
            template: '<div />',
          },
        },
      },
    });

    await flushPromises();
    await nextTick();
    expect(wrapper.get('[data-test="planner-map-viewport"]').text()).toBe('-98.5795,39.8283 / 3.25');

    await wrapper.get('[data-test="map-location-select-start"]').trigger('click');
    await wrapper.get('[data-test="map-location-select-end"]').trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="planner-destination"]').text()).toBe('Dallas, United States');
    expect(wrapper.get('[data-test="planner-end-destination"]').text()).toBe('Austin, United States');
    expect(wrapper.get('[data-test="planner-title"]').text()).toBe('Dallas to Austin');

    await wrapper.get('[data-test="route-start-remove"]').trigger('click');
    await wrapper.get('[data-test="route-end-remove"]').trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="planner-title"]').text()).toBe('');
    expect(wrapper.get('[data-test="planner-destination"]').text()).toBe('');
    expect(wrapper.get('[data-test="planner-end-destination"]').text()).toBe('');
    expect(wrapper.get('[data-test="planner-destination-latitude"]').text()).toBe('');
    expect(wrapper.get('[data-test="planner-end-destination-latitude"]').text()).toBe('');
    expect(wrapper.get('[data-test="planner-map-viewport"]').text()).toBe('-98.5795,39.8283 / 3.25');
    expect(wrapper.get('[data-test="planner-preview-state"]').text()).toBe('No preview');
    expect(wrapper.get('[data-test="planner-stop-count"]').text()).toBe('0');
    expect(wrapper.get('[data-test="itinerary-stop-count"]').text()).toBe('0');
    expect(tripsStoreMock.previewItinerary).toBeNull();
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Start removed',
      message: 'Dallas, United States was removed from the route.',
    });
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'End removed',
      message: 'Austin, United States was removed from the route.',
    });
  });

  it('adds route stops from the map preview into the planner route order', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['stops'],
            template: '<div data-test="planner-stop-count">{{ stops.length }}</div>',
          },
          ItineraryView: {
            emits: ['route-stop-add'],
            template: `
              <button
                data-test="route-stop-add"
                @click="$emit('route-stop-add', { spotId: 'route-stop-1', title: 'Waco, TX', latitude: 31.5493, longitude: -97.1467, category: 'food', city: 'Waco' })"
              >
                Add stop
              </button>
            `,
          },
          TripCard: {
            props: ['trip'],
            template: '<div class="trip-card-stub">{{ trip.title }}</div>',
          },
          TripCollaborationBar: {
            template: '<div data-test="collaboration-bar-stub" />',
          },
          TripShareModal: {
            template: '<div />',
          },
        },
      },
    });

    await flushPromises();
    expect(wrapper.get('[data-test="planner-stop-count"]').text()).toBe('0');

    await wrapper.get('[data-test="route-stop-add"]').trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="planner-stop-count"]').text()).toBe('1');
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Route stop added',
      message: 'Waco, TX was added between start and end.',
    });
  });

  it('accepts direct planner stop-order updates and marks the draft for autosave', async () => {
    const tripPlannerStub = {
      name: 'TripPlanner',
      props: ['stops'],
      template: '<div data-test="direct-stop-update">{{ stops.map((stop) => stop.title + ":" + stop.timeSlot).join("|") || "empty" }}</div>',
    };

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: tripPlannerStub,
          ItineraryView: { template: '<div />' },
          TripCard: { template: '<div />' },
          TripCollaborationBar: {
            props: ['saveState'],
            template: '<div data-test="direct-stop-save-state">{{ saveState }}</div>',
          },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    expect(wrapper.get('[data-test="direct-stop-update"]').text()).toBe('empty');

    wrapper.findComponent(tripPlannerStub).vm.$emit('update:stops', [
      {
        spotId: 'waco',
        title: 'Waco, TX',
        latitude: 31.5493,
        longitude: -97.1467,
        category: 'food',
        timeSlot: '11:15',
      },
    ]);
    await nextTick();

    expect(wrapper.get('[data-test="direct-stop-update"]').text()).toBe('Waco, TX:11:15');
    expect(wrapper.get('[data-test="direct-stop-save-state"]').text()).toBe('unsaved');
  });

  it('removes and replaces route stops from Scope AI route edits', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['stops'],
            template: '<div data-test="planner-stops">{{ stops.map((stop) => stop.title).join("|") || "empty" }}</div>',
          },
          ItineraryView: {
            template: '<div><slot name="assistant" /></div>',
          },
          TripPlannerAiAssist: {
            emits: ['route-stop-add', 'route-stop-remove', 'route-stops-replace'],
            template: `
              <div>
                <button
                  data-test="ai-add-waco"
                  @click="$emit('route-stop-add', { spotId: 'waco', title: 'Waco, TX', latitude: 31.5493, longitude: -97.1467, category: 'food' })"
                >
                  Add Waco
                </button>
                <button
                  data-test="ai-add-temple"
                  @click="$emit('route-stop-add', { spotId: 'temple', title: 'Temple, TX', latitude: 31.0982, longitude: -97.3428, category: 'scenic' })"
                >
                  Add Temple
                </button>
                <button data-test="ai-remove-missing" @click="$emit('route-stop-remove', 'missing-stop')">Remove missing</button>
                <button data-test="ai-remove-waco" @click="$emit('route-stop-remove', 'waco')">Remove Waco</button>
                <button
                  data-test="ai-replace-one"
                  @click="$emit('route-stops-replace', [{ spotId: 'mineral-wells', title: 'Mineral Wells, TX', latitude: 32.8085, longitude: -98.1128, category: 'scenic' }])"
                >
                  Replace one
                </button>
                <button data-test="ai-clear-route" @click="$emit('route-stops-replace', [])">Clear route</button>
              </div>
            `,
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: {
            template: '<div data-test="collaboration-bar-stub" />',
          },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    expect(wrapper.get('[data-test="planner-stops"]').text()).toBe('empty');

    await wrapper.get('[data-test="ai-add-waco"]').trigger('click');
    await wrapper.get('[data-test="ai-add-temple"]').trigger('click');
    await nextTick();
    expect(wrapper.get('[data-test="planner-stops"]').text()).toBe('Waco, TX|Temple, TX');

    await wrapper.get('[data-test="ai-remove-missing"]').trigger('click');
    await nextTick();
    expect(wrapper.get('[data-test="planner-stops"]').text()).toBe('Waco, TX|Temple, TX');

    await wrapper.get('[data-test="ai-remove-waco"]').trigger('click');
    await nextTick();
    expect(wrapper.get('[data-test="planner-stops"]').text()).toBe('Temple, TX');

    await wrapper.get('[data-test="ai-replace-one"]').trigger('click');
    await nextTick();
    expect(wrapper.get('[data-test="planner-stops"]').text()).toBe('Mineral Wells, TX');
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Route tightened',
      message: '1 committed stop kept in the route.',
    });

    await wrapper.get('[data-test="ai-clear-route"]').trigger('click');
    await nextTick();
    expect(wrapper.get('[data-test="planner-stops"]').text()).toBe('empty');
    expect(tripsStoreMock.previewItinerary).toBeNull();
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Route tightened',
      message: 'The route is cleared for a lean itinerary build.',
    });
  });

  it('averages selected fuel prices into the planner fuel calculator', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['fuelSettings'],
            template: '<div data-test="fuel-price">{{ fuelSettings.gasPricePerGallon ?? "" }}</div>',
          },
          ItineraryView: {
            emits: ['fuel-price-select'],
            template: `
              <div>
                <button data-test="fuel-one" @click="$emit('fuel-price-select', { placeId: 'fuel-1', stationName: 'Fuel One', pricePerGallon: 3.2 })">Fuel one</button>
                <button data-test="fuel-two" @click="$emit('fuel-price-select', { placeId: 'fuel-2', stationName: 'Fuel Two', pricePerGallon: 4 })">Fuel two</button>
              </div>
            `,
          },
          TripCard: {
            template: '<div />',
          },
          TripCollaborationBar: {
            template: '<div data-test="collaboration-bar-stub" />',
          },
          TripShareModal: {
            template: '<div />',
          },
        },
      },
    });

    await flushPromises();

    await wrapper.get('[data-test="fuel-one"]').trigger('click');
    await nextTick();
    expect(wrapper.get('[data-test="fuel-price"]').text()).toBe('3.2');

    await wrapper.get('[data-test="fuel-two"]').trigger('click');
    await nextTick();
    expect(wrapper.get('[data-test="fuel-price"]').text()).toBe('3.6');
  });

  it('sanitizes planner fuel settings and resets selected station prices when fuel type changes', async () => {
    const scrollToFuelSettings = vi.fn();

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['fuelSettings'],
            emits: ['update:fuel-settings'],
            setup(_props, { expose }) {
              expose({ scrollToFuelSettings });
            },
            template: `
              <div>
                <span data-test="fuel-type">{{ fuelSettings.fuelType ?? '' }}</span>
                <span data-test="fuel-mpg">{{ fuelSettings.mpg ?? '' }}</span>
                <span data-test="fuel-price">{{ fuelSettings.gasPricePerGallon ?? '' }}</span>
                <button data-test="planner-fuel-premium" @click="$emit('update:fuel-settings', { mpg: 28, gasPricePerGallon: 4.1, fuelType: 'premium' })">Premium</button>
                <button data-test="planner-fuel-invalid" @click="$emit('update:fuel-settings', { mpg: -1, gasPricePerGallon: 0, fuelType: 'rocket' })">Invalid</button>
              </div>
            `,
          },
          ItineraryView: {
            emits: ['fuel-price-select', 'fuel-type-select', 'fuel-settings-request'],
            template: `
              <div>
                <button data-test="fuel-settings-request" @click="$emit('fuel-settings-request')">Fuel settings</button>
                <button data-test="fuel-invalid" @click="$emit('fuel-price-select', { placeId: ' ', stationName: 'Bad Fuel', pricePerGallon: 3.5 })">Invalid price</button>
                <button data-test="fuel-regular" @click="$emit('fuel-price-select', { placeId: 'fuel-regular', stationName: 'Regular One', pricePerGallon: 3.2, fuelType: 'regular' })">Regular</button>
                <button data-test="fuel-premium" @click="$emit('fuel-price-select', { placeId: 'fuel-premium', stationName: 'Premium One', pricePerGallon: 4, fuelType: 'premium' })">Premium station</button>
                <button data-test="fuel-diesel" @click="$emit('fuel-type-select', 'diesel')">Diesel</button>
              </div>
            `,
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: {
            template: '<div data-test="collaboration-bar-stub" />',
          },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();

    await wrapper.get('[data-test="fuel-settings-request"]').trigger('click');
    expect(scrollToFuelSettings).toHaveBeenCalledTimes(1);

    await wrapper.get('[data-test="fuel-invalid"]').trigger('click');
    await nextTick();
    expect(wrapper.get('[data-test="fuel-price"]').text()).toBe('');

    await wrapper.get('[data-test="fuel-regular"]').trigger('click');
    await wrapper.get('[data-test="fuel-premium"]').trigger('click');
    await nextTick();
    expect(wrapper.get('[data-test="fuel-type"]').text()).toBe('premium');
    expect(wrapper.get('[data-test="fuel-price"]').text()).toBe('3.6');

    await wrapper.get('[data-test="fuel-diesel"]').trigger('click');
    await wrapper.get('[data-test="fuel-regular"]').trigger('click');
    await nextTick();
    expect(wrapper.get('[data-test="fuel-type"]').text()).toBe('regular');
    expect(wrapper.get('[data-test="fuel-price"]').text()).toBe('3.2');

    await wrapper.get('[data-test="planner-fuel-premium"]').trigger('click');
    await wrapper.get('[data-test="planner-fuel-invalid"]').trigger('click');
    await nextTick();
    expect(wrapper.get('[data-test="fuel-type"]').text()).toBe('premium');
    expect(wrapper.get('[data-test="fuel-mpg"]').text()).toBe('');
    expect(wrapper.get('[data-test="fuel-price"]').text()).toBe('');
  });

  it('syncs Scope AI planner actions into the visible route brief and fuel calculator', async () => {
    geocodeMock
      .mockResolvedValueOnce({
        data: [{
          latitude: 32.7767,
          longitude: -96.797,
          placeName: 'Dallas, Texas',
          formattedAddress: 'Dallas, Texas, United States',
          country: 'United States',
          countryCode: 'us',
          precision: 'place',
        }],
      })
      .mockResolvedValueOnce({
        data: [{
          latitude: 30.3095,
          longitude: -104.0206,
          placeName: 'Marfa, Texas',
          formattedAddress: 'Marfa, Texas, United States',
          country: 'United States',
          countryCode: 'us',
          precision: 'place',
        }],
      })
      .mockResolvedValue({ data: [] });

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue', 'initialTitle', 'stops', 'fuelSettings'],
            template: `
              <div>
                <span data-test="ai-title">{{ initialTitle }}</span>
                <span data-test="ai-route">{{ initialValue.destination }} -> {{ initialValue.endDestination }}</span>
                <span data-test="ai-coordinates">{{ initialValue.destinationLatitude ?? '' }},{{ initialValue.destinationLongitude ?? '' }} -> {{ initialValue.endDestinationLatitude ?? '' }},{{ initialValue.endDestinationLongitude ?? '' }}</span>
                <span data-test="ai-budget">{{ initialValue.budgetFloor }}/{{ initialValue.budget }}</span>
                <span data-test="ai-dates">{{ initialValue.startDate }} to {{ initialValue.endDate }}</span>
                <span data-test="ai-preferences">{{ initialValue.pace }}/{{ initialValue.groupSize }}/{{ initialValue.interests.join(',') }}</span>
                <span data-test="ai-fuel">{{ fuelSettings.fuelType ?? '' }}/{{ fuelSettings.mpg ?? '' }}/{{ fuelSettings.gasPricePerGallon ?? '' }}</span>
                <span data-test="ai-stops">{{ stops.length ? stops.map((stop) => stop.title + ':' + stop.category).join('|') : 'none' }}</span>
              </div>
            `,
          },
          ItineraryView: {
            template: '<div><slot name="assistant" /></div>',
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
          TripPlannerAiAssist: {
            props: ['scopeAiStore'],
            setup(props) {
              function applyAiRoute() {
                props.scopeAiStore.applyActionBlock({
                  actions: [
                    { type: 'SET_FIELD', field: 'trip_title', value: 'AI West Texas Loop' },
                    { type: 'SET_FIELD', field: 'start', value: 'Dallas' },
                    { type: 'SET_FIELD', field: 'end', value: 'Marfa' },
                    { type: 'SET_FIELD', field: 'budget_min', value: 900 },
                    { type: 'SET_FIELD', field: 'budget_max', value: 700 },
                    { type: 'SET_FIELD', field: 'date', value: '2026-06-01' },
                    { type: 'SET_FIELD', field: 'end_date', value: '2026-06-04' },
                    { type: 'SET_FIELD', field: 'pace', value: 'standard' },
                    { type: 'SET_FIELD', field: 'theme', value: ['food', 'scenic', 'spa'] },
                    { type: 'SET_FIELD', field: 'party_size', value: 3 },
                    { type: 'SET_FIELD', field: 'fuel_type', value: 'diesel' },
                    { type: 'SET_FIELD', field: 'mpg', value: 28 },
                    { type: 'SET_FIELD', field: 'gas_price', value: 3.79 },
                    {
                      type: 'ADD_STOP',
                      stop: {
                        id: 'abilene',
                        name: 'Abilene Coffee',
                        address: 'Abilene, Texas',
                        type: 'food',
                        estimated_cost: 25,
                        estimated_duration_minutes: 45,
                        notes: 'Midpoint',
                        position: 1,
                        latitude: 32.4487,
                        longitude: -99.7331,
                      },
                    },
                    {
                      type: 'ADD_STOP',
                      stop: {
                        id: 'mystery',
                        name: 'Mystery Stop',
                        address: '',
                        type: 'strange',
                        estimated_cost: 12,
                        estimated_duration_minutes: 20,
                        notes: 'Fallback category',
                        position: 2,
                      },
                    },
                  ],
                });
              }

              function switchToEv() {
                props.scopeAiStore.applyActionBlock({
                  actions: [{ type: 'SET_FIELD', field: 'fuel_type', value: 'ev' }],
                });
              }

              function clearAiRoute() {
                props.scopeAiStore.applyActionBlock({
                  actions: [
                    { type: 'CLEAR_FIELD', field: 'start' },
                    { type: 'CLEAR_FIELD', field: 'end' },
                    { type: 'CLEAR_FIELD', field: 'stops' },
                  ],
                });
              }

              function applyEdgeState() {
                props.scopeAiStore.plannerState.budget_min = 900;
                props.scopeAiStore.plannerState.budget_max = 700;
                props.scopeAiStore.plannerState.start_date = null;
                props.scopeAiStore.plannerState.date = '2026-07-01';
              }

              return { applyAiRoute, switchToEv, clearAiRoute, applyEdgeState };
            },
            template: `
              <div>
                <button data-test="ai-apply-route" @click="applyAiRoute">Apply AI route</button>
                <button data-test="ai-switch-ev" @click="switchToEv">Switch EV</button>
                <button data-test="ai-clear-route" @click="clearAiRoute">Clear AI route</button>
                <button data-test="ai-edge-state" @click="applyEdgeState">Edge state</button>
              </div>
            `,
          },
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-test="ai-apply-route"]').trigger('click');
    await flushPromises();
    await nextTick();
    await flushPromises();
    await nextTick();

    expect(geocodeMock).toHaveBeenCalledWith('Dallas', 1);
    expect(geocodeMock).toHaveBeenCalledWith('Marfa', 1);
    expect(wrapper.get('[data-test="ai-title"]').text()).toBe('AI West Texas Loop');
    expect(wrapper.get('[data-test="ai-route"]').text()).toBe('Dallas, Texas -> Marfa, Texas');
    expect(wrapper.get('[data-test="ai-coordinates"]').text()).toBe('32.7767,-96.797 -> 30.3095,-104.0206');
    expect(wrapper.get('[data-test="ai-budget"]').text()).toBe('700/700');
    expect(wrapper.get('[data-test="ai-dates"]').text()).toBe('2026-06-01 to 2026-06-04');
    expect(wrapper.get('[data-test="ai-preferences"]').text()).toBe('moderate/3/food,scenic');
    expect(wrapper.get('[data-test="ai-fuel"]').text()).toBe('diesel/28/3.79');
    expect(wrapper.get('[data-test="ai-stops"]').text()).toBe('Abilene Coffee:food|Mystery Stop:other');

    await wrapper.get('[data-test="ai-switch-ev"]').trigger('click');
    await nextTick();
    expect(wrapper.get('[data-test="ai-fuel"]').text()).toBe('ev//');

    await wrapper.get('[data-test="ai-clear-route"]').trigger('click');
    await nextTick();
    expect(wrapper.get('[data-test="ai-route"]').text()).toBe('->');
    expect(wrapper.get('[data-test="ai-coordinates"]').text()).toBe(', -> ,');
    expect(wrapper.get('[data-test="ai-stops"]').text()).toBe('none');

    await wrapper.get('[data-test="ai-edge-state"]').trigger('click');
    await nextTick();
    expect(wrapper.get('[data-test="ai-budget"]').text()).toBe('700/700');
    expect(wrapper.get('[data-test="ai-dates"]').text()).toBe('2026-07-01 to 2026-06-04');
  });

  it('normalizes Day by Day itinerary edits back into the planner preview and date span', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00'));

    tripsStoreMock.previewItinerary = {
      id: 'preview-route',
      destination: 'Dallas to Marfa',
      totalEstimatedCost: 0,
      weatherForecast: 'Clear',
      days: [{ dayNumber: 1, date: '2026-06-01', spots: [] }],
    };

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue', 'stops'],
            emits: ['update:draft'],
            template: `
              <div>
                <span data-test="planner-end-date">{{ initialValue.endDate }}</span>
                <span data-test="planner-normalized-stops">{{ stops.map((stop) => stop.title + ':' + stop.dayNumber + ':' + stop.timeSlot).join('|') }}</span>
                <button
                  data-test="set-june-route"
                  @click="$emit('update:draft', { ...initialValue, destination: 'Dallas', endDestination: 'Marfa', startDate: '2026-06-01', endDate: '2026-06-01', interests: [...initialValue.interests] })"
                >
                  Set route
                </button>
              </div>
            `,
          },
          ItineraryView: {
            props: ['itinerary'],
            emits: ['itinerary-stops-update'],
            template: `
              <div>
                <span data-test="preview-summary">{{ itinerary ? itinerary.days.map((day) => day.dayNumber + ':' + day.spots.length).join('|') + '/' + itinerary.totalEstimatedCost : 'none' }}</span>
                <button
                  data-test="timeline-edit"
                  @click="$emit('itinerary-stops-update', [
                    { spotId: 'late-gallery', title: 'Late Gallery', latitude: 30.31, longitude: -104.02, category: 'culture', dayNumber: 3, timeSlot: '7:05', estimatedCost: 30 },
                    { spotId: 'breakfast', title: 'Breakfast', latitude: 31.76, longitude: -106.49, category: 'food', timeSlot: 'not-a-time', estimatedCost: 12 },
                    { spotId: 'sunrise', title: 'Sunrise Pullout', latitude: 31.9, longitude: -103.1, category: 'scenic', dayNumber: 1, timeSlot: '06:30', estimatedCost: 0 }
                  ])"
                >
                  Reorder timeline
                </button>
              </div>
            `,
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
          TripPlannerAiAssist: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-test="set-june-route"]').trigger('click');
    await nextTick();
    expect(wrapper.get('[data-test="planner-end-date"]').text()).toBe('2026-06-01');

    await wrapper.get('[data-test="timeline-edit"]').trigger('click');
    await flushPromises();
    await nextTick();

    expect(wrapper.get('[data-test="planner-end-date"]').text()).toBe('2026-06-03');
    expect(wrapper.get('[data-test="planner-normalized-stops"]').text()).toBe('Sunrise Pullout:1:06:30|Breakfast:1:12:00|Late Gallery:3:07:05');
    expect(wrapper.get('[data-test="preview-summary"]').text()).toBe('1:2|3:1/42');
  });

  it('returns a busy Scope AI itinerary response while a planner build is already running', async () => {
    const resolveRequest = vi.fn();
    const rejectRequest = vi.fn();
    tripsStoreMock.planning = true;

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue'],
            emits: ['update:draft'],
            template: `
              <button
                data-test="planner-route-update"
                @click="$emit('update:draft', { ...initialValue, destination: 'Dallas', endDestination: 'Marfa', startDate: '2026-06-01', endDate: '2026-06-03', interests: [...initialValue.interests] })"
              >
                Set route
              </button>
            `,
          },
          ItineraryView: {
            template: '<div><slot name="assistant" /></div>',
          },
          TripPlannerAiAssist: {
            emits: ['itinerary-build-request'],
            template: `
              <button
                data-test="ai-build-busy"
                @click="$emit('itinerary-build-request', {
                  prompt: 'Build while busy',
                  reason: 'build',
                  handled: false,
                  resolve: resolveRequest,
                  reject: rejectRequest,
                })"
              >
                AI build
              </button>
            `,
            setup() {
              return { resolveRequest, rejectRequest };
            },
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-test="planner-route-update"]').trigger('click');
    await nextTick();
    await wrapper.get('[data-test="ai-build-busy"]').trigger('click');
    await flushPromises();

    expect(tripsStoreMock.buildItinerary).not.toHaveBeenCalled();
    expect(resolveRequest).toHaveBeenCalledWith({
      status: 'busy',
      routeLabel: 'Dallas to Marfa',
      stopCount: 0,
      dayCount: 3,
    });
    expect(rejectRequest).not.toHaveBeenCalled();
  });

  it('retries autosave after the trip store finishes a busy save cycle', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            emits: ['update:title'],
            template: '<button data-test="planner-title-update" @click="$emit(\'update:title\', \'Retry autosave route\')">Edit title</button>',
          },
          ItineraryView: { template: '<div />' },
          TripCard: { template: '<div />' },
          TripCollaborationBar: {
            props: ['saveState'],
            template: '<div data-test="autosave-state">{{ saveState }}</div>',
          },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    tripsStoreMock.createTrip.mockClear();
    vi.useFakeTimers();
    tripsStoreMock.saving = true;

    await wrapper.get('[data-test="planner-title-update"]').trigger('click');
    await nextTick();
    await vi.advanceTimersByTimeAsync(1200);
    await flushPromises();
    expect(tripsStoreMock.createTrip).not.toHaveBeenCalled();
    expect(wrapper.get('[data-test="autosave-state"]').text()).toBe('unsaved');

    tripsStoreMock.saving = false;
    await vi.advanceTimersByTimeAsync(1800);
    await flushPromises();
    await nextTick();

    expect(tripsStoreMock.createTrip).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Retry autosave route',
      destination: 'Retry autosave route',
    }));
  });

  it('keeps autosave unsaved and retries when the first draft save fails', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue'],
            emits: ['update:draft', 'update:title'],
            template: `
              <button
                data-test="planner-title-update"
                @click="
                  $emit('update:draft', {
                    ...initialValue,
                    destination: 'Dallas, TX',
                    endDestination: 'Austin, TX',
                  });
                  $emit('update:title', 'Retry after failure');
                "
              >
                Edit title
              </button>
            `,
          },
          ItineraryView: { template: '<div />' },
          TripCard: { template: '<div />' },
          TripCollaborationBar: {
            props: ['saveState'],
            template: '<div data-test="autosave-failure-state">{{ saveState }}</div>',
          },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    vi.useFakeTimers();
    tripsStoreMock.error = 'Core draft save failed.';
    tripsStoreMock.createTrip.mockRejectedValueOnce(new Error('save failed'));

    await wrapper.get('[data-test="planner-title-update"]').trigger('click');
    await vi.advanceTimersByTimeAsync(1200);
    await flushPromises();
    await nextTick();

    expect(tripsStoreMock.createTrip).toHaveBeenCalledTimes(1);
    expect(tripsStoreMock.error).toBeNull();
    expect(wrapper.get('[data-test="autosave-failure-state"]').text()).toBe('unsaved');

    await vi.advanceTimersByTimeAsync(1800);
    await flushPromises();
    await nextTick();

    expect(tripsStoreMock.createTrip).toHaveBeenCalledTimes(2);
    expect(wrapper.get('[data-test="autosave-failure-state"]').text()).toBe('saved');
  });

  it('schedules a follow-up autosave when draft input changes during an in-flight save', async () => {
    let resolveFirstSave: ((trip: Trip) => void) | null = null;
    tripsStoreMock.createTrip.mockImplementationOnce(() => new Promise<Trip>((resolve) => {
      resolveFirstSave = resolve;
    }));

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            emits: ['update:title'],
            template: `
              <div>
                <button data-test="title-first" @click="$emit('update:title', 'First autosave')">First</button>
                <button data-test="title-second" @click="$emit('update:title', 'Second autosave')">Second</button>
              </div>
            `,
          },
          ItineraryView: { template: '<div />' },
          TripCard: { template: '<div />' },
          TripCollaborationBar: {
            props: ['saveState'],
            template: '<div data-test="autosave-race-state">{{ saveState }}</div>',
          },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    vi.useFakeTimers();

    await wrapper.get('[data-test="title-first"]').trigger('click');
    await vi.advanceTimersByTimeAsync(1200);
    await flushPromises();
    expect(tripsStoreMock.createTrip).toHaveBeenCalledTimes(1);

    await wrapper.get('[data-test="title-second"]').trigger('click');
    resolveFirstSave?.({
      id: 'race-trip-1',
      title: 'First autosave',
      destination: 'Planning route',
      description: '',
      isPublic: false,
      startDate: '2026-04-30',
      endDate: '2026-04-30',
      spots: [],
      members: [{ id: 'user-1', displayName: 'Louis Do', status: 'owner' }],
      status: 'planning',
    });
    await flushPromises();
    await nextTick();

    expect(wrapper.get('[data-test="autosave-race-state"]').text()).toBe('unsaved');

    await vi.advanceTimersByTimeAsync(1200);
    await flushPromises();
    expect(tripsStoreMock.createTrip).toHaveBeenCalledTimes(1);
    expect(tripsStoreMock.updateTrip).toHaveBeenCalledWith('race-trip-1', expect.objectContaining({
      title: 'Second autosave',
    }));
  });

  it('surfaces direct share and delete failures from the collaboration bar', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            emits: ['update:title'],
            template: '<button data-test="planner-title-update" @click="$emit(\'update:title\', \'Draft to delete\')">Edit title</button>',
          },
          ItineraryView: { template: '<div />' },
          TripCard: { template: '<div />' },
          TripCollaborationBar: {
            props: ['trip'],
            emits: ['share', 'delete'],
            template: `
              <div>
                <button data-test="share-current-draft" @click="$emit('share')">Share</button>
                <button v-if="trip" data-test="delete-current-draft" @click="$emit('delete')">Delete</button>
              </div>
            `,
          },
          TripShareModal: {
            props: ['open'],
            template: '<div data-test="share-modal">{{ open ? "open" : "closed" }}</div>',
          },
        },
      },
    });

    await flushPromises();
    tripsStoreMock.createTrip.mockClear();
    tripsStoreMock.error = 'Share API unavailable.';
    tripsStoreMock.createTrip.mockRejectedValueOnce(new Error('share failed'));

    await wrapper.get('[data-test="share-current-draft"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-test="share-modal"]').text()).toBe('closed');
    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Share failed',
      message: 'Share API unavailable.',
    });

    tripsStoreMock.error = '';
    vi.useFakeTimers();
    await wrapper.get('[data-test="planner-title-update"]').trigger('click');
    await vi.advanceTimersByTimeAsync(1200);
    await flushPromises();
    await nextTick();
    expect(wrapper.find('[data-test="delete-current-draft"]').exists()).toBe(true);

    tripsStoreMock.error = 'Delete API unavailable.';
    tripsStoreMock.deleteTrip.mockRejectedValueOnce(new Error('delete failed'));
    await wrapper.get('[data-test="delete-current-draft"]').trigger('click');
    await wrapper.get('[data-test="planner-delete-confirm"]').trigger('click');
    await flushPromises();

    expect(tripsStoreMock.deleteTrip).toHaveBeenCalledWith('local-trip-1');
    expect(routerReplaceMock).not.toHaveBeenCalledWith({ name: 'trips' });
    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Draft delete failed',
      message: 'Delete API unavailable.',
    });
  });

  it('opens direct sharing after saving and ignores document actions that need a saved draft', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div />' },
          ItineraryView: { template: '<div />' },
          TripCard: { template: '<div />' },
          TripCollaborationBar: {
            emits: ['share', 'delete', 'update:isPublic'],
            template: `
              <div>
                <button data-test="direct-share" @click="$emit('share')">Share</button>
                <button data-test="direct-delete-without-draft" @click="$emit('delete')">Delete</button>
                <button data-test="direct-visibility-noop" @click="$emit('update:isPublic', false)">Keep private</button>
              </div>
            `,
          },
          TripShareModal: {
            props: ['open'],
            emits: ['invite', 'update-role'],
            template: `
              <div>
                <span data-test="direct-share-modal">{{ open ? 'open' : 'closed' }}</span>
                <button data-test="direct-invite-without-draft" @click="$emit('invite', { recipient: 'maya@example.com', role: 'viewer' })">Invite</button>
                <button data-test="direct-role-without-draft" @click="$emit('update-role', { userId: 'user-2', role: 'editor' })">Role</button>
              </div>
            `,
          },
          TripPlannerAiAssist: { template: '<div />' },
        },
      },
    });

    await flushPromises();

    await wrapper.get('[data-test="direct-delete-without-draft"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-test="planner-delete-dialog"]').exists()).toBe(false);
    expect(tripsStoreMock.deleteTrip).not.toHaveBeenCalled();

    await wrapper.get('[data-test="direct-visibility-noop"]').trigger('click');
    await flushPromises();
    expect(tripsStoreMock.createTrip).not.toHaveBeenCalled();

    await wrapper.get('[data-test="direct-invite-without-draft"]').trigger('click');
    await flushPromises();
    expect(tripsStoreMock.inviteMember).not.toHaveBeenCalled();

    await wrapper.get('[data-test="direct-role-without-draft"]').trigger('click');
    await flushPromises();
    expect(tripsStoreMock.updateMemberRole).not.toHaveBeenCalled();

    await wrapper.get('[data-test="direct-share"]').trigger('click');
    await flushPromises();

    expect(tripsStoreMock.createTrip).toHaveBeenCalledTimes(1);
    expect(tripsStoreMock.createShareLink).not.toHaveBeenCalled();
    expect(wrapper.get('[data-test="direct-share-modal"]').text()).toBe('open');
  });

  it('lets Scope AI clear an unsaved draft and forward pending packing actions into the planner', async () => {
    const addPackingItem = vi.fn();
    const removePackingItem = vi.fn();

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            setup(_, { expose }) {
              expose({ addPackingItem, removePackingItem, scrollToFuelSettings: vi.fn() });
            },
            template: '<div />',
          },
          ItineraryView: {
            template: '<div><slot name="assistant" /></div>',
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
          TripPlannerAiAssist: {
            props: ['scopeAiStore', 'executeTripCommand'],
            data() {
              return { resultMessage: '' };
            },
            methods: {
              applyPackingActions() {
                this.scopeAiStore.applyActionBlock({
                  actions: [
                    { type: 'ADD_PACKING_ITEM', label: 'Rain shell' },
                    { type: 'REMOVE_PACKING_ITEM', item_id: 'old-hat' },
                  ],
                });
              },
              async deleteDraft() {
                const result = await this.executeTripCommand({ type: 'delete' });
                this.resultMessage = result.message;
              },
            },
            template: `
              <div>
                <span data-test="ai-delete-result">{{ resultMessage }}</span>
                <button data-test="ai-packing-actions" @click="applyPackingActions">Packing</button>
                <button data-test="ai-delete-unsaved" @click="deleteDraft">Delete unsaved</button>
              </div>
            `,
          },
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-test="ai-packing-actions"]').trigger('click');
    await nextTick();

    expect(addPackingItem).toHaveBeenCalledWith('Rain shell');
    expect(removePackingItem).toHaveBeenCalledWith('old-hat');

    await wrapper.get('[data-test="ai-delete-unsaved"]').trigger('click');
    await flushPromises();

    expect(tripsStoreMock.deleteTrip).not.toHaveBeenCalled();
    expect(routerReplaceMock).toHaveBeenCalledWith({ name: 'trips' });
    expect(wrapper.get('[data-test="ai-delete-result"]').text()).toBe('Deleted this trip draft.');
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Draft cleared',
      message: 'That unsaved trip draft was cleared from the planner.',
    });
  });

  it('ignores no-op planner echoes and blank map selections without dirtying the draft', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue'],
            emits: ['update:draft'],
            template: `
              <div>
                <span data-test="noop-destination">{{ initialValue.destination }}</span>
                <button data-test="noop-draft-update" @click="$emit('update:draft', { ...initialValue, interests: [...initialValue.interests] })">Noop</button>
              </div>
            `,
          },
          ItineraryView: {
            emits: ['map-location-select'],
            template: '<button data-test="blank-map-selection" @click="$emit(\'map-location-select\', { target: \'destination\', label: \'   \', latitude: 30.2672, longitude: -97.7431 })">Blank</button>',
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: {
            props: ['saveState'],
            template: '<div data-test="noop-save-state">{{ saveState }}</div>',
          },
          TripShareModal: { template: '<div />' },
          TripPlannerAiAssist: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-test="noop-draft-update"]').trigger('click');
    await wrapper.get('[data-test="blank-map-selection"]').trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="noop-destination"]').text()).toBe('');
    expect(wrapper.get('[data-test="noop-save-state"]').text()).toBe('saved');
    expect(tripsStoreMock.createTrip).not.toHaveBeenCalled();
    expect(toastStoreMock.showSuccess).not.toHaveBeenCalled();
  });

  it('hydrates editable trip end coordinates while tolerating a failed start geocode', async () => {
    routeMock.name = 'trip-edit';
    routeMock.params = { id: 'hydrate-end-trip' };
    tripsStoreMock.fetchTrip.mockResolvedValueOnce(buildRouteLibraryTrip({
      id: 'hydrate-end-trip',
      title: 'Hydrate End Trip',
      destination: 'Broken Start to Clean End',
      spots: [],
      members: [{ id: 'user-1', displayName: 'Louis Do', status: 'owner' }],
      isPublic: false,
    }));
    geocodeMock
      .mockRejectedValueOnce(new Error('start geocode failed'))
      .mockResolvedValueOnce({
        data: [{
          latitude: 44.105,
          longitude: -70.214,
          placeName: 'Clean End',
          formattedAddress: 'Clean End, Maine, United States',
          country: 'United States',
          countryCode: 'us',
          precision: 'place',
        }],
      });

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue'],
            template: `
              <div>
                <span data-test="hydrated-start">{{ initialValue.destinationLatitude ?? '' }},{{ initialValue.destinationLongitude ?? '' }}</span>
                <span data-test="hydrated-end">{{ initialValue.endDestinationLatitude ?? '' }},{{ initialValue.endDestinationLongitude ?? '' }}</span>
              </div>
            `,
          },
          ItineraryView: { template: '<div />' },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
          TripPlannerAiAssist: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    await nextTick();
    await flushPromises();

    expect(tripsStoreMock.fetchTrip).toHaveBeenCalledWith('hydrate-end-trip');
    expect(geocodeMock).toHaveBeenCalledWith('Broken Start', 1);
    expect(geocodeMock).toHaveBeenCalledWith('Clean End', 1);
    expect(wrapper.get('[data-test="hydrated-start"]').text()).toBe(',');
    expect(wrapper.get('[data-test="hydrated-end"]').text()).toBe('44.105,-70.214');
  });

  it('ignores stale home-base map focus when the editable route is cleared first', async () => {
    routeMock.name = 'trip-edit';
    routeMock.params = { id: 'stale-homebase-trip' };
    authStoreMock.currentUser = {
      ...authStoreMock.currentUser,
      homeBase: 'Austin, TX',
    };
    let resolveHomeBaseGeocode: ((value: { data: Array<Record<string, unknown>> }) => void) | null = null;
    geocodeMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveHomeBaseGeocode = resolve;
    }));
    tripsStoreMock.fetchTrip.mockResolvedValueOnce(buildRouteLibraryTrip({
      id: 'stale-homebase-trip',
      isPublic: false,
      members: [{ id: 'user-1', displayName: 'Louis Do', status: 'owner' }],
    }));

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue'],
            emits: ['update:draft'],
            template: `
              <button
                data-test="clear-editable-route"
                @click="$emit('update:draft', { ...initialValue, destination: '', endDestination: '', destinationLatitude: undefined, destinationLongitude: undefined, endDestinationLatitude: undefined, endDestinationLongitude: undefined, interests: [...initialValue.interests] })"
              >
                Clear route
              </button>
            `,
          },
          ItineraryView: {
            props: ['initialMapViewport'],
            template: '<div data-test="stale-homebase-viewport">{{ initialMapViewport.center[0] }},{{ initialMapViewport.center[1] }} / {{ initialMapViewport.zoom }}</div>',
          },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
          TripPlannerAiAssist: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-test="clear-editable-route"]').trigger('click');
    await nextTick();

    resolveHomeBaseGeocode?.({
      data: [{
        latitude: 30.2672,
        longitude: -97.7431,
        placeName: 'Austin',
        formattedAddress: 'Austin, Texas, United States',
        country: 'United States',
        countryCode: 'us',
        precision: 'place',
      }],
    });
    await flushPromises();
    await nextTick();

    expect(geocodeMock).toHaveBeenCalledWith('Austin, TX', 1);
    expect(wrapper.get('[data-test="stale-homebase-viewport"]').text()).toBe('-98.5795,39.8283 / 3.25');
  });

  it('keeps the planner stable when featured route previews fail to load', async () => {
    vi.stubEnv('MODE', 'development');
    vi.stubEnv('VITEST', '');
    const originalIntersectionObserver = window.IntersectionObserver;
    Reflect.deleteProperty(window, 'IntersectionObserver');
    tripsStoreMock.items = [];
    tripsStoreMock.error = 'Featured routes unavailable.';
    listPublicTripsMock.mockRejectedValueOnce(new Error('featured routes failed'));

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: { template: '<div data-test="planner-still-mounted" />' },
          ItineraryView: { template: '<div />' },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
          TripPlannerAiAssist: { template: '<div />' },
        },
      },
    });

    await flushPromises();

    expect(listPublicTripsMock).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[data-test="planner-still-mounted"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="featured-route-card"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Featured routes unavailable.');

    if (typeof originalIntersectionObserver === 'undefined') {
      Reflect.deleteProperty(window, 'IntersectionObserver');
    } else {
      Object.defineProperty(window, 'IntersectionObserver', {
        configurable: true,
        writable: true,
        value: originalIntersectionObserver,
      });
    }
    vi.stubEnv('MODE', 'test');
    vi.stubEnv('VITEST', 'true');
  });

  it('surfaces itinerary generation failures inline and emits an error toast after submit', async () => {
    tripsStoreMock.error = 'Scope could not generate an itinerary right now.';
    tripsStoreMock.buildItinerary.mockRejectedValue(new Error('Planner failed'));

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue', 'initialTitle', 'budgetRange', 'selectedStops', 'suggestedStops', 'submitting', 'mobileWizard', 'mobileActiveStep'],
            emits: ['submit'],
            template: '<button data-test="planner-submit" @click="$emit(\'submit\', initialValue)">Submit planner</button>',
          },
          ItineraryView: { template: '<div />' },
          TripPlannerAiAssist: { template: '<div data-test="trip-ai-assist-stub" />' },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('Scope could not finish part of the planning flow');
    expect(wrapper.text()).toContain('Scope could not generate an itinerary right now.');

    await wrapper.get('[data-test="planner-submit"]').trigger('click');
    await flushPromises();

    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Planner update failed',
      message: 'Scope could not generate an itinerary right now.',
    });
  });

  it('keeps a generated itinerary visible and schedules draft retry when saving the generated draft fails', async () => {
    tripsStoreMock.createTrip.mockRejectedValueOnce(new Error('Core offline'));
    tripsStoreMock.error = 'Core draft save failed.';

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            emits: ['submit'],
            template: `
              <button
                data-test="planner-submit"
                @click="$emit('submit', {
                  destination: 'Dallas, Texas',
                  endDestination: 'Austin, Texas',
                  startDate: '2026-06-01',
                  endDate: '2026-06-02',
                  budgetFloor: 500,
                  budget: 1500,
                  interests: ['food'],
                  pace: 'moderate',
                  groupSize: 2,
                })"
              >
                Submit planner
              </button>
            `,
          },
          ItineraryView: {
            props: ['itinerary'],
            template: '<div data-test="generated-preview">{{ itinerary ? itinerary.destination : "No preview" }}</div>',
          },
          TripPlannerAiAssist: { template: '<div />' },
          TripCard: { template: '<div />' },
          TripCollaborationBar: {
            props: ['saveState'],
            template: '<div data-test="generate-save-state">{{ saveState }}</div>',
          },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-test="planner-submit"]').trigger('click');
    await flushPromises();
    await nextTick();

    expect(wrapper.get('[data-test="generated-preview"]').text()).toBe('Fort Worth, TX');
    expect(wrapper.get('[data-test="generate-save-state"]').text()).toBe('unsaved');
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Itinerary ready',
      message: 'Scope built the preview. Draft save will retry when the backend is ready.',
    });
    expect(toastStoreMock.showError).not.toHaveBeenCalledWith(expect.objectContaining({
      title: 'Planner update failed',
    }));
  });

  it('uses refreshed itinerary copy for subsequent planner generations with save success and retry states', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            emits: ['submit'],
            template: `
              <button
                data-test="planner-submit"
                @click="$emit('submit', {
                  destination: 'Dallas, Texas',
                  endDestination: 'Austin, Texas',
                  startDate: '2026-06-01',
                  endDate: '2026-06-02',
                  budgetFloor: 500,
                  budget: 1500,
                  interests: ['food'],
                  pace: 'moderate',
                  groupSize: 2,
                })"
              >
                Submit planner
              </button>
            `,
          },
          ItineraryView: { template: '<div />' },
          TripPlannerAiAssist: { template: '<div />' },
          TripCard: { template: '<div />' },
          TripCollaborationBar: { template: '<div />' },
          TripShareModal: { template: '<div />' },
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-test="planner-submit"]').trigger('click');
    await flushPromises();
    toastStoreMock.showSuccess.mockClear();

    await wrapper.get('[data-test="planner-submit"]').trigger('click');
    await flushPromises();
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Itinerary refreshed',
      message: 'Scope refreshed the preview and saved this trip draft.',
    });

    toastStoreMock.showSuccess.mockClear();
    tripsStoreMock.updateTrip.mockRejectedValueOnce(new Error('update failed'));
    await wrapper.get('[data-test="planner-submit"]').trigger('click');
    await flushPromises();

    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Itinerary refreshed',
      message: 'Scope refreshed the preview. Draft save will retry when the backend is ready.',
    });
  });
});
