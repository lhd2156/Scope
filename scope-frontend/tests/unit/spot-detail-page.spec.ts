import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';

const { authStoreMock, spotsStoreMock, toastStoreMock } = vi.hoisted(() => ({
  authStoreMock: {
    isAuthenticated: true,
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

import SpotDetailPage from '@/views/SpotDetailPage.vue';

describe('SpotDetailPage', () => {
  beforeEach(() => {
    spotsStoreMock.error = '';
    spotsStoreMock.saving = false;
    spotsStoreMock.fetchSpot.mockReset();
    spotsStoreMock.fetchSpot.mockResolvedValue(undefined);
    spotsStoreMock.deleteSpot.mockReset();
    spotsStoreMock.deleteSpot.mockResolvedValue(undefined);
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
});
