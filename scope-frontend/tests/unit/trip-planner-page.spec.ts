import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';

const ORIGINAL_INNER_WIDTH = window.innerWidth;

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

const { authStoreMock, geocodeMock, routerReplaceMock, toastStoreMock, tripsStoreMock } = vi.hoisted(() => ({
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
  geocodeMock: vi.fn().mockResolvedValue({ data: [] }),
  routerReplaceMock: vi.fn().mockResolvedValue(undefined),
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
    updateTrip: vi.fn(),
    deleteTrip: vi.fn().mockResolvedValue(undefined),
    inviteMember: vi.fn(),
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

vi.mock('@/services/mapService', async () => {
  const actual = await vi.importActual<typeof import('@/services/mapService')>('@/services/mapService');
  return {
    ...actual,
    geocode: geocodeMock,
  };
});

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router');
  return {
    ...actual,
    useRoute: () => ({
      name: 'trip-planner',
      params: {},
      query: {},
    }),
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
    tripsStoreMock.error = '';
    tripsStoreMock.fetchTrips.mockClear();
    tripsStoreMock.fetchTrip.mockClear();
    tripsStoreMock.createTrip.mockClear();
    tripsStoreMock.updateTrip.mockClear();
    tripsStoreMock.deleteTrip.mockClear();
    tripsStoreMock.inviteMember.mockClear();
    tripsStoreMock.buildItinerary.mockClear();
    tripsStoreMock.buildItinerary.mockResolvedValue({
      id: 'itinerary-1',
      destination: 'Fort Worth, TX',
      totalEstimatedCost: 180,
      weatherForecast: 'Sunny, 75F',
      days: [],
    });
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

  it('hands the submitted brief into Scope AI when the copilot surface is available', async () => {
    const handoffPlannerBrief = vi.fn().mockResolvedValue(undefined);
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
            template: '<div data-test="itinerary-stub">No preview</div>',
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
      prompt: 'Build the itinerary from Oklahoma City, Oklahoma to Dexter, New Mexico using the current route.',
    });
    expect(tripsStoreMock.buildItinerary).not.toHaveBeenCalled();
    expect(tripsStoreMock.createTrip).not.toHaveBeenCalled();
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
            template: '<div data-test="itinerary-stub">{{ itinerary ? itinerary.destination : "No preview" }}</div>',
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
            template: '<div data-test="itinerary-stub">{{ itinerary ? itinerary.destination : "No preview" }}</div>',
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
    });
    expect(rejectRequest).not.toHaveBeenCalled();
    expect(toastStoreMock.showError).not.toHaveBeenCalled();
    expect(toastStoreMock.showSuccess).not.toHaveBeenCalledWith(expect.objectContaining({
      title: 'Itinerary refreshed',
    }));
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
    tripsStoreMock.createTrip.mockClear();
    vi.useFakeTimers();

    await wrapper.get('[data-test="planner-title-update"]').trigger('click');
    await nextTick();

    expect(tripsStoreMock.createTrip).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1200);
    await flushPromises();

    expect(tripsStoreMock.createTrip).toHaveBeenCalledTimes(1);
    expect(tripsStoreMock.createTrip).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Autosaved weekend',
      destination: 'Planning route',
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

  it('lets the user delete the current autosaved draft from the planner bar', async () => {
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

    expect(tripsStoreMock.deleteTrip).toHaveBeenCalledWith('local-trip-1');
    expect(wrapper.find('[data-test="delete-current-draft"]').exists()).toBe(false);
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Draft deleted',
      message: 'That autosaved trip draft was removed from your workspace.',
    });
  });

  it('focuses the blank trip map on the saved onboarding home base', async () => {
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
            template: '<div data-test="planner-map-viewport">{{ initialMapViewport.center[0] }},{{ initialMapViewport.center[1] }} / {{ initialMapViewport.zoom }}</div>',
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

    expect(geocodeMock).toHaveBeenCalledWith('Austin, TX', 1);
    expect(wrapper.get('[data-test="planner-map-viewport"]').text()).toBe('-97.7431,30.2672 / 9.4');
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
    expect(wrapper.text()).toContain('Prep the trip in four focused steps');
    expect(wrapper.get('[data-test="planner-stub-layout"]').text()).toBe('true / 1');
    expect(wrapper.get('[data-test="itinerary-stub"]').text()).toBe('true / 1');

    await wrapper.get('[data-test="planner-step-2-trigger"]').trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="itinerary-stub"]').text()).toBe('true / 2');

    await wrapper.get('[data-test="planner-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-test="itinerary-stub"]').text()).toBe('true / 4');
    expect(toastStoreMock.showSuccess).not.toHaveBeenCalledWith({
      title: 'Itinerary refreshed',
      message: 'Scope refreshed the preview and saved this trip draft.',
    });
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
});
