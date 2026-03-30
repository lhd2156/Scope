import { flushPromises, mount } from '@vue/test-utils';

const { toastStoreMock, tripsStoreMock } = vi.hoisted(() => ({
  toastStoreMock: {
    showSuccess: vi.fn(),
    showError: vi.fn(),
  },
  tripsStoreMock: {
    items: [
      { id: 'trip-1', title: 'North Texas Night + Food Loop' },
      { id: 'trip-2', title: 'Austin Scenic Sprint' },
    ],
    previewItinerary: {
      id: 'itinerary-1',
      destination: 'Fort Worth, TX',
      totalEstimatedCost: 180,
      weatherForecast: 'Sunny, 75F',
      days: [],
    },
    planning: false,
    error: '',
    fetchTrips: vi.fn().mockResolvedValue(undefined),
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

import TripPlannerPage from '@/views/TripPlannerPage.vue';

describe('TripPlannerPage', () => {
  beforeEach(() => {
    tripsStoreMock.error = '';
    tripsStoreMock.fetchTrips.mockClear();
    tripsStoreMock.buildItinerary.mockClear();
    tripsStoreMock.buildItinerary.mockResolvedValue({
      id: 'itinerary-1',
      destination: 'Fort Worth, TX',
      totalEstimatedCost: 180,
      weatherForecast: 'Sunny, 75F',
      days: [],
    });
    toastStoreMock.showSuccess.mockClear();
    toastStoreMock.showError.mockClear();
  });

  it('boots the planner workspace and forwards planner submissions to the store', async () => {
    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue', 'initialTitle', 'budgetRange', 'selectedStops', 'suggestedStops', 'submitting'],
            emits: ['submit', 'update:title', 'update:stops'],
            template: '<button data-test="planner-submit" @click="$emit(\'submit\', initialValue)">Submit planner</button>',
          },
          ItineraryView: {
            props: ['itinerary', 'tripTitle', 'members', 'submitting'],
            template: '<div data-test="itinerary-stub">{{ tripTitle }} · {{ itinerary.destination }}</div>',
          },
          TripCard: {
            props: ['trip'],
            template: '<div class="trip-card-stub">{{ trip.title }}</div>',
          },
        },
      },
    });

    await flushPromises();

    expect(tripsStoreMock.fetchTrips).toHaveBeenCalledTimes(1);
    expect(tripsStoreMock.buildItinerary).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Reference trips');
    expect(wrapper.find('[data-test="itinerary-stub"]').text()).toContain('Fort Worth, TX');
    expect(wrapper.findAll('.trip-card-stub')).toHaveLength(2);

    await wrapper.get('[data-test="planner-submit"]').trigger('click');
    await flushPromises();

    expect(tripsStoreMock.buildItinerary).toHaveBeenCalledTimes(2);
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Itinerary refreshed',
      message: 'Atlas refreshed your itinerary preview.',
    });
  });

  it('surfaces itinerary generation failures inline and emits an error toast after submit', async () => {
    tripsStoreMock.error = 'Atlas could not generate an itinerary right now.';
    tripsStoreMock.buildItinerary.mockRejectedValue(new Error('Planner failed'));

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue', 'initialTitle', 'budgetRange', 'selectedStops', 'suggestedStops', 'submitting'],
            emits: ['submit'],
            template: '<button data-test="planner-submit" @click="$emit(\'submit\', initialValue)">Submit planner</button>',
          },
          ItineraryView: { template: '<div />' },
          TripCard: { template: '<div />' },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('Atlas could not finish part of the planning flow');
    expect(wrapper.text()).toContain('Atlas could not generate an itinerary right now.');

    await wrapper.get('[data-test="planner-submit"]').trigger('click');
    await flushPromises();

    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Planner update failed',
      message: 'Atlas could not generate an itinerary right now.',
    });
  });
});
