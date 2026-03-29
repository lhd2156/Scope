import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';

const { authStoreMock, spotsStoreMock } = vi.hoisted(() => ({
  authStoreMock: {
    isAuthenticated: true,
  },
  spotsStoreMock: {
    loading: false,
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
      photos: [],
    },
    fetchSpot: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

vi.mock('@/stores/spots', () => ({
  useSpotsStore: () => spotsStoreMock,
}));

import SpotDetailPage from '@/views/SpotDetailPage.vue';

describe('SpotDetailPage', () => {
  beforeEach(() => {
    spotsStoreMock.fetchSpot.mockClear();
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
});
