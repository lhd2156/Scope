import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';

const { authStoreMock, listSpotsMock, logInteractionMock, spotsStoreMock, toastStoreMock } = vi.hoisted(() => ({
  authStoreMock: {
    isAuthenticated: true,
    hasHydratedSession: true,
    currentUser: {
      id: 'user-1',
    },
  },
  spotsStoreMock: {
    loading: false,
    saving: false,
    error: '',
    selectedSpot: {
      id: 'spot-1',
      title: 'Sunset Rooftop Tacos',
      description: 'Skyline tacos and late-night energy.',
      latitude: 32.7555,
      longitude: -97.3308,
      category: 'food',
      city: 'Fort Worth',
      country: 'US',
      rating: 4.8,
      createdAt: '2026-03-29T00:00:00Z',
      author: {
        id: 'user-1',
      },
      photos: [],
    },
    fetchSpot: vi.fn().mockResolvedValue(undefined),
    deleteSpot: vi.fn().mockResolvedValue(undefined),
  },
  toastStoreMock: {
    showSuccess: vi.fn(),
    showError: vi.fn(),
  },
  listSpotsMock: vi.fn(),
  logInteractionMock: vi.fn(),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

vi.mock('@/stores/spots', () => ({
  useSpotsStore: () => spotsStoreMock,
}));

vi.mock('@/stores/toasts', () => ({
  useToastStore: () => toastStoreMock,
}));

vi.mock('@/services/spotService', () => ({
  listSpots: listSpotsMock,
}));

vi.mock('@/services/interactionService', () => ({
  logInteraction: logInteractionMock,
}));

import SpotDetailPage from '@/views/SpotDetailPage.vue';

function buildSpot(overrides: Record<string, unknown> = {}) {
  return {
    id: 'spot-1',
    title: 'Sunset Rooftop Tacos',
    description: 'Skyline tacos and late-night energy.',
    latitude: 32.7555,
    longitude: -97.3308,
    category: 'food',
    city: 'Fort Worth',
    country: 'US',
    rating: 4.8,
    createdAt: '2026-03-29T00:00:00Z',
    author: {
      id: 'user-1',
    },
    photos: [],
    userId: 'user-1',
    ...overrides,
  };
}

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

async function mountSpotDetailPage(path = '/spots/spot-1') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/spots', component: SpotDetailPage },
      { path: '/spots/:id', component: SpotDetailPage },
      { path: '/explore', component: { template: '<div>Explore target</div>' } },
    ],
  });

  await router.push(path);
  await router.isReady();

  const wrapper = mount(SpotDetailPage, {
    global: {
      plugins: [router],
      stubs: {
        AppShell: { template: '<div><slot /></div>' },
        LoadingSpinner: { template: '<div>Loading</div>' },
        Modal: {
          props: ['open'],
          emits: ['close'],
          template: '<div v-if="open" data-test="spot-delete-modal-shell"><button type="button" data-test="modal-close" @click="$emit(\'close\')">Close modal</button><slot /></div>',
        },
        SpotDetail: {
          props: ['spot'],
          template: '<div data-test="spot-detail-stub">{{ spot?.title }}</div>',
        },
      },
    },
  });

  await flushPromises();

  return { router, wrapper };
}

describe('SpotDetailPage', () => {
  beforeEach(() => {
    authStoreMock.isAuthenticated = true;
    authStoreMock.hasHydratedSession = true;
    authStoreMock.currentUser = {
      id: 'user-1',
    };
    spotsStoreMock.loading = false;
    spotsStoreMock.error = '';
    spotsStoreMock.saving = false;
    spotsStoreMock.selectedSpot = buildSpot();
    spotsStoreMock.fetchSpot.mockReset();
    spotsStoreMock.fetchSpot.mockImplementation(async () => spotsStoreMock.selectedSpot);
    spotsStoreMock.deleteSpot.mockReset();
    spotsStoreMock.deleteSpot.mockResolvedValue(undefined);
    listSpotsMock.mockReset();
    listSpotsMock.mockResolvedValue({
      data: [
        buildSpot(),
        buildSpot({
          id: 'spot-2',
          title: 'Recovered production spot',
        }),
      ],
    });
    logInteractionMock.mockReset();
    toastStoreMock.showSuccess.mockClear();
    toastStoreMock.showError.mockClear();
  });

  it('loads the requested spot and exposes the edit action for authenticated users', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/spots/:id', component: SpotDetailPage }],
    });

    await router.push('/spots/spot-1');
    await router.isReady();

    const wrapper = mount(SpotDetailPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          LoadingSpinner: { template: '<div>Loading</div>' },
          Modal: {
            props: ['open'],
            emits: ['close'],
            template: '<div v-if="open"><slot /></div>',
          },
          SpotDetail: {
            props: ['spot'],
            template: '<div data-test="spot-detail-stub">{{ spot.title }}</div>',
          },
        },
      },
    });

    await flushPromises();

    expect(spotsStoreMock.fetchSpot).toHaveBeenCalledWith('spot-1');
    expect(wrapper.find('[data-test="spot-detail-stub"]').text()).toContain('Sunset Rooftop Tacos');
    expect(wrapper.text()).toContain('Edit this spot');
  });

  it('replaces raw named detail routes with polished spot slugs', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/spots/:id', name: 'spot-detail', component: SpotDetailPage }],
    });

    await router.push('/spots/spot-1');
    await router.isReady();

    mount(SpotDetailPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          LoadingSpinner: { template: '<div>Loading</div>' },
          Modal: {
            props: ['open'],
            emits: ['close'],
            template: '<div v-if="open"><slot /></div>',
          },
          SpotDetail: {
            props: ['spot'],
            template: '<div data-test="spot-detail-stub">{{ spot?.title }}</div>',
          },
        },
      },
    });

    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe('/spots/sunset-rooftop-tacos-fort-worth');
    expect(logInteractionMock).toHaveBeenCalledWith({
      spotId: 'spot-1',
      type: 'view',
      context: { source: 'detail' },
    });
  });

  it('loads uuid-like route ids directly before replacing them with readable slugs', async () => {
    const uuidSpotId = '90000000-0000-0000-0000-000000000003';
    spotsStoreMock.selectedSpot = null;
    spotsStoreMock.fetchSpot.mockImplementation(async (spotId: string) => {
      const nextSpot = buildSpot({
        id: spotId,
        title: 'UUID River Walk',
        city: 'San Antonio',
      });
      spotsStoreMock.selectedSpot = nextSpot;
      return nextSpot;
    });

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/spots/:id', name: 'spot-detail', component: SpotDetailPage }],
    });

    await router.push(`/spots/${uuidSpotId}`);
    await router.isReady();

    mount(SpotDetailPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          LoadingSpinner: { template: '<div>Loading</div>' },
          Modal: {
            props: ['open'],
            emits: ['close'],
            template: '<div v-if="open"><slot /></div>',
          },
          SpotDetail: {
            props: ['spot'],
            template: '<div data-test="spot-detail-stub">{{ spot?.title }}</div>',
          },
        },
      },
    });

    await flushPromises();

    expect(listSpotsMock).not.toHaveBeenCalled();
    expect(spotsStoreMock.fetchSpot).toHaveBeenCalledWith(uuidSpotId);
    expect(router.currentRoute.value.fullPath).toBe('/spots/uuid-river-walk-san-antonio');
  });

  it('confirms creator-side deletion, routes back to explore, and emits a success toast', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/spots/:id', component: SpotDetailPage },
        { path: '/explore', component: { template: '<div>Explore target</div>' } },
      ],
    });

    await router.push('/spots/spot-1');
    await router.isReady();

    const wrapper = mount(SpotDetailPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          LoadingSpinner: { template: '<div>Loading</div>' },
          Modal: {
            props: ['open'],
            emits: ['close'],
            template: '<div v-if="open"><slot /></div>',
          },
          SpotDetail: {
            props: ['spot'],
            template: '<div data-test="spot-detail-stub">{{ spot.title }}</div>',
          },
        },
      },
    });

    await flushPromises();

    await wrapper.get('button.action-link--danger').trigger('click');
    await flushPromises();
    await wrapper.get('button.delete-button').trigger('click');
    await flushPromises();

    expect(spotsStoreMock.deleteSpot).toHaveBeenCalledWith('spot-1');
    expect(router.currentRoute.value.fullPath).toBe('/explore');
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Spot deleted',
      message: 'Scope removed the pin from the current workspace.',
    });
  });

  it('surfaces the store error when the spot fetch fails', async () => {
    spotsStoreMock.fetchSpot.mockImplementation(async () => {
      spotsStoreMock.error = 'Scope could not load that spot right now.';
      throw new Error('Spot failed');
    });

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/spots/:id', component: SpotDetailPage }],
    });

    await router.push('/spots/spot-9');
    await router.isReady();

    const wrapper = mount(SpotDetailPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          LoadingSpinner: { template: '<div>Loading</div>' },
          Modal: {
            props: ['open'],
            emits: ['close'],
            template: '<div v-if="open"><slot /></div>',
          },
          SpotDetail: { template: '<div />' },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('That pin is temporarily unavailable');
    expect(wrapper.text()).toContain('Scope could not load that spot right now.');
  });

  it('does not let a stale failed detail request override a newer successful load', async () => {
    const staleLoad = deferred();
    const latestLoad = deferred();

    spotsStoreMock.selectedSpot = null;
    spotsStoreMock.fetchSpot.mockImplementation((spotId: string) => {
      if (spotId === 'spot-1') {
        return staleLoad.promise;
      }

      if (spotId === 'spot-2') {
        return latestLoad.promise.then(() => {
          const latestSpot = buildSpot({
            id: 'spot-2',
            title: 'Recovered production spot',
          });
          spotsStoreMock.selectedSpot = latestSpot;
          return latestSpot;
        });
      }

      return Promise.resolve();
    });

    const { router, wrapper } = await mountSpotDetailPage('/spots/spot-1');

    await router.push('/spots/spot-2');
    await flushPromises();

    const staleLoadHandled = staleLoad.promise.catch(() => undefined);
    staleLoad.reject(new Error('stale 404'));
    await staleLoadHandled;
    await flushPromises();

    spotsStoreMock.selectedSpot = buildSpot({
      id: 'spot-2',
      title: 'Recovered production spot',
    });
    latestLoad.resolve();
    await flushPromises();
    await wrapper.vm.$forceUpdate();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).not.toContain('Missing spot');
    expect(wrapper.find('[data-test="spot-detail-stub"]').exists()).toBe(true);
  });

  it('renders the loading state while the detail request is still in flight', async () => {
    spotsStoreMock.loading = true;
    spotsStoreMock.selectedSpot = null;

    const { wrapper } = await mountSpotDetailPage();

    expect(wrapper.text()).toContain('Pulling the full spot profile');
    expect(wrapper.text()).toContain('Scope is syncing gallery, review, and location data for this stop.');
    expect(wrapper.text()).toContain('Loading');
  });

  it('hides creator tools for signed-out visitors while keeping the detail readable', async () => {
    authStoreMock.isAuthenticated = false;

    const { wrapper } = await mountSpotDetailPage();

    expect(wrapper.find('[data-test="spot-detail-creator-tools"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="spot-detail-stub"]').text()).toContain('Sunset Rooftop Tacos');
  });

  it('hides creator tools when live spot payloads omit the owner identity', async () => {
    spotsStoreMock.selectedSpot = buildSpot({ author: undefined, userId: undefined });

    const { wrapper } = await mountSpotDetailPage();

    expect(wrapper.find('[data-test="spot-detail-creator-tools"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="spot-detail-stub"]').text()).toContain('Sunset Rooftop Tacos');
  });

  it('keeps the delete confirmation open while saving and closes it once saving finishes', async () => {
    const { wrapper } = await mountSpotDetailPage();

    await wrapper.get('button.action-link--danger').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-test="spot-delete-modal"]').exists()).toBe(true);

    spotsStoreMock.saving = true;
    await wrapper.get('[data-test="modal-close"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-test="spot-delete-modal"]').exists()).toBe(true);

    spotsStoreMock.saving = false;
    await wrapper.get('[data-test="modal-close"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-test="spot-delete-modal"]').exists()).toBe(false);
  });

  it('shows delete failure feedback without routing away from the spot', async () => {
    spotsStoreMock.deleteSpot.mockImplementation(async () => {
      spotsStoreMock.error = 'Scope could not remove that spot right now.';
      throw new Error('Delete failed');
    });

    const { router, wrapper } = await mountSpotDetailPage();

    await wrapper.get('button.action-link--danger').trigger('click');
    await flushPromises();
    await wrapper.get('button.delete-button').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe('/spots/spot-1');
    expect(wrapper.text()).toContain('Scope could not remove that spot right now.');
    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Delete failed',
      message: 'Scope could not remove that spot right now.',
    });
  });

  it('shows the missing spot state when the route has no spot id', async () => {
    const { wrapper } = await mountSpotDetailPage('/spots');

    expect(spotsStoreMock.fetchSpot).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('That pin could not be found');
    expect(wrapper.text()).toContain('The requested spot may have moved, been removed, or not synced yet.');
  });
});
