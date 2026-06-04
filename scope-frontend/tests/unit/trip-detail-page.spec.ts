import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';

const { tripsStoreMock } = vi.hoisted(() => ({
  tripsStoreMock: {
    loading: false,
    error: '',
    selectedTrip: null as any,
    fetchTrip: vi.fn().mockResolvedValue(undefined),
    fetchSharedTrip: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/stores/trips', () => ({
  useTripsStore: () => tripsStoreMock,
}));

import TripDetailPage from '@/views/TripDetailPage.vue';

describe('TripDetailPage', () => {
  function buildTrip() {
    return {
      id: 'trip-1',
      title: 'North Texas Night + Food Loop',
      destination: 'Fort Worth, TX',
      description: 'A two-day food and culture loop.',
      isPublic: true,
      startDate: '2026-04-10',
      endDate: '2026-04-12',
      budget: 450,
      currency: 'USD',
      status: 'planning',
      coverImageUrl: 'https://images.example.com/trip.jpg',
      members: [
        {
          id: 'user-1',
          displayName: 'Louis Do',
        },
        {
          id: 'user-2',
          displayName: 'Maya Chen',
        },
      ],
      spots: [
        {
          spotId: 'stockyards',
          title: 'Stockyards Dinner',
          latitude: 32.788,
          longitude: -97.348,
          category: 'food',
          city: 'Fort Worth',
        },
      ],
    };
  }

  async function mountPage(fullPath = '/trips/trip-1') {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/trips/shared/:token?', name: 'trip-share', component: TripDetailPage },
        { path: '/trips/:id', name: 'trip-detail', component: TripDetailPage },
        { path: '/trips', name: 'trip-detail-root', component: TripDetailPage },
      ],
    });

    await router.push(fullPath);
    await router.isReady();

    const wrapper = mount(TripDetailPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          ScopeIcon: { template: '<span class="icon-stub" />' },
          TripDetail: {
            props: ['trip'],
            template: '<div data-test="trip-detail-stub">{{ trip.title }}</div>',
          },
        },
      },
    });

    return { wrapper, router };
  }

  beforeEach(() => {
    window.history.pushState({}, '', '/');
    tripsStoreMock.error = '';
    tripsStoreMock.loading = false;
    tripsStoreMock.selectedTrip = buildTrip();
    tripsStoreMock.fetchTrip.mockReset().mockResolvedValue(undefined);
    tripsStoreMock.fetchSharedTrip.mockReset().mockResolvedValue(undefined);
  });

  it('loads the requested trip id and renders the trip detail surface', async () => {
    const { wrapper } = await mountPage('/trips/trip-1?assistant=open');

    await flushPromises();

    expect(tripsStoreMock.fetchTrip).toHaveBeenCalledWith('trip-1');
    expect(wrapper.find('[data-test="trip-detail-stub"]').text()).toContain('North Texas Night + Food Loop');
    expect(wrapper.find('[data-test="assistant-stub"]').exists()).toBe(false);
  });

  it('surfaces the store error when the trip request fails', async () => {
    tripsStoreMock.error = 'Scope could not load that trip right now.';
    tripsStoreMock.selectedTrip = null;
    tripsStoreMock.fetchTrip.mockRejectedValue(new Error('Trip failed'));

    const { wrapper } = await mountPage('/trips/trip-5');

    await flushPromises();

    expect(wrapper.find('[data-test="trip-detail-empty-state"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="empty-state-panel"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Trip unavailable');
    expect(wrapper.text()).toContain('Scope could not load that trip right now.');
    expect(wrapper.text()).toContain('Open planner');
  });

  it('renders loading and not-found states without a selected trip', async () => {
    tripsStoreMock.loading = true;
    tripsStoreMock.selectedTrip = null;
    const loading = await mountPage('/trips/trip-1');

    expect(loading.wrapper.text()).toContain('Loading route');

    loading.wrapper.unmount();
    tripsStoreMock.loading = false;
    tripsStoreMock.selectedTrip = null;

    const missing = await mountPage('/trips/trip-1');
    await flushPromises();

    expect(missing.wrapper.text()).toContain('Trip not found');
    expect(missing.wrapper.text()).toContain('The requested trip could not be loaded.');
  });

  it('renders the compact trip detail QA preview when the QA session flag is present', async () => {
    window.history.pushState({}, '', '/trips/trip-1?scopeQaSession=authenticated');

    const { wrapper } = await mountPage('/trips/trip-1');

    await flushPromises();

    expect(wrapper.text()).toContain('Trip detail preview');
    expect(wrapper.text()).toContain('North Texas Night + Food Loop');
    expect(wrapper.text()).toContain('Fort Worth, TX');
    expect(wrapper.text()).toContain('2 collaborators');
    expect(wrapper.find('[data-test="trip-detail-stub"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="assistant-stub"]').exists()).toBe(false);
  });

  it('keeps the trip detail page free of the AI assistant even when requested by query', async () => {
    const { wrapper } = await mountPage('/trips/trip-1?ai=open');

    await flushPromises();

    expect(wrapper.find('[data-test="trip-detail-stub"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="assistant-stub"]').exists()).toBe(false);
  });

  it('loads shared trips by token and ignores incomplete trip routes', async () => {
    const shared = await mountPage('/trips/shared/share-token-1');
    await flushPromises();

    expect(tripsStoreMock.fetchSharedTrip).toHaveBeenCalledWith('share-token-1');
    expect(tripsStoreMock.fetchTrip).not.toHaveBeenCalled();

    shared.wrapper.unmount();
    tripsStoreMock.fetchSharedTrip.mockRejectedValueOnce(new Error('share failed'));
    const failedShare = await mountPage('/trips/shared/share-token-2');
    await flushPromises();

    expect(tripsStoreMock.fetchSharedTrip).toHaveBeenCalledWith('share-token-2');

    failedShare.wrapper.unmount();
    tripsStoreMock.fetchSharedTrip.mockClear();
    const missingToken = await mountPage('/trips/shared');
    await flushPromises();

    expect(tripsStoreMock.fetchSharedTrip).not.toHaveBeenCalled();

    missingToken.wrapper.unmount();
    tripsStoreMock.fetchTrip.mockClear();
    await mountPage('/trips');
    await flushPromises();

    expect(tripsStoreMock.fetchTrip).not.toHaveBeenCalled();
  });
});
