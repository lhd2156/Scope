import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';

const ORIGINAL_INNER_WIDTH = window.innerWidth;

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

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
    setViewportWidth(1280);
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
            emits: ['submit', 'update:title', 'update:stops', 'wizard-step-change'],
            template: '<button data-test="planner-submit" @click="$emit(\'submit\', initialValue)">Submit planner</button>',
          },
          ItineraryView: {
            props: ['itinerary', 'tripTitle', 'members', 'submitting', 'mobileWizard', 'mobileActiveStep'],
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

  it('switches to the mobile step wizard and advances into the preview step after a successful submit', async () => {
    setViewportWidth(390);

    const wrapper = mount(TripPlannerPage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripPlanner: {
            props: ['initialValue', 'initialTitle', 'budgetRange', 'selectedStops', 'suggestedStops', 'submitting', 'mobileWizard', 'mobileActiveStep'],
            emits: ['submit', 'update:title', 'update:stops', 'wizard-step-change'],
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
            props: ['itinerary', 'tripTitle', 'members', 'submitting', 'mobileWizard', 'mobileActiveStep'],
            template: '<div data-test="itinerary-stub">{{ mobileWizard }} / {{ mobileActiveStep }}</div>',
          },
          TripCard: {
            props: ['trip'],
            template: '<div class="trip-card-stub">{{ trip.title }}</div>',
          },
        },
      },
    });

    await flushPromises();
    await nextTick();

    expect(wrapper.get('.planner-page').attributes('data-planner-layout')).toBe('mobile-wizard');
    expect(wrapper.text()).toContain('Plan the trip in four focused steps');
    expect(wrapper.get('[data-test="planner-stub-layout"]').text()).toBe('true / 1');
    expect(wrapper.get('[data-test="itinerary-stub"]').text()).toBe('true / 1');

    await wrapper.get('[data-test="planner-step-2-trigger"]').trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="itinerary-stub"]').text()).toBe('true / 2');

    await wrapper.get('[data-test="planner-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-test="itinerary-stub"]').text()).toBe('true / 4');
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
            props: ['initialValue', 'initialTitle', 'budgetRange', 'selectedStops', 'suggestedStops', 'submitting', 'mobileWizard', 'mobileActiveStep'],
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
