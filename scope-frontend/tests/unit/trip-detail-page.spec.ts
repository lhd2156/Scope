import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';

const { tripsStoreMock } = vi.hoisted(() => ({
  tripsStoreMock: {
    loading: false,
    error: '',
    selectedTrip: {
      id: 'trip-1',
      title: 'North Texas Night + Food Loop',
    },
    fetchTrip: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/stores/trips', () => ({
  useTripsStore: () => tripsStoreMock,
}));

import TripDetailPage from '@/views/TripDetailPage.vue';

describe('TripDetailPage', () => {
  beforeEach(() => {
    tripsStoreMock.error = '';
    tripsStoreMock.selectedTrip = {
      id: 'trip-1',
      title: 'North Texas Night + Food Loop',
    };
    tripsStoreMock.fetchTrip.mockClear();
  });

  it('loads the requested trip id and renders the trip detail surface', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/trips/:id', component: TripDetailPage }],
    });

    await router.push('/trips/trip-1');
    await router.isReady();

    const wrapper = mount(TripDetailPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          TripDetail: {
            props: ['trip'],
            template: '<div data-test="trip-detail-stub">{{ trip.title }}</div>',
          },
        },
      },
    });

    await flushPromises();

    expect(tripsStoreMock.fetchTrip).toHaveBeenCalledWith('trip-1');
    expect(wrapper.find('[data-test="trip-detail-stub"]').text()).toContain('North Texas Night + Food Loop');
  });

  it('surfaces the store error when the trip request fails', async () => {
    tripsStoreMock.error = 'Scope could not load that trip right now.';
    tripsStoreMock.selectedTrip = null;
    tripsStoreMock.fetchTrip.mockRejectedValue(new Error('Trip failed'));

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/trips/:id', component: TripDetailPage }],
    });

    await router.push('/trips/trip-5');
    await router.isReady();

    const wrapper = mount(TripDetailPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          ScopeIcon: { template: '<span class="icon-stub" />' },
          TripDetail: { template: '<div />' },
        },
      },
    });

    await flushPromises();

    expect(wrapper.find('[data-test="empty-state-panel"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Trip unavailable');
    expect(wrapper.text()).toContain('Scope could not load that trip right now.');
    expect(wrapper.text()).toContain('Open planner');
  });
});
