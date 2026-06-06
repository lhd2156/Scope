import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';

const { authStoreMock, spotsStoreMock, toastStoreMock } = vi.hoisted(() => ({
  authStoreMock: {
    isAuthenticated: false,
    currentUser: null,
  },
  spotsStoreMock: {
    loading: false,
    saving: false,
    error: '',
    selectedSpot: null,
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

vi.mock('@/utils/qaMode', () => ({
  isScopeQaMode: () => true,
}));

import SpotDetailPage from '@/views/SpotDetailPage.vue';

describe('SpotDetailPage QA audit preview', () => {
  beforeEach(() => {
    spotsStoreMock.fetchSpot.mockClear();
  });

  it('renders the compact audit fixture without loading the full spot detail stack', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/spots/:id', component: SpotDetailPage },
        { path: '/explore', component: { template: '<div>Explore target</div>' } },
      ],
    });

    await router.push('/spots/audit-spot-1');
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
          RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
          StarRatingDisplay: {
            props: ['rating', 'label'],
            template: '<span data-test="rating-display">{{ label }} {{ rating }}</span>',
          },
          SpotDetail: {
            template: '<div data-test="spot-detail-stub" />',
          },
        },
      },
    });

    await flushPromises();

    expect(spotsStoreMock.fetchSpot).not.toHaveBeenCalled();
    expect(wrapper.get('[data-test="spot-detail-audit"]').text()).toContain('Sunset Rooftop Tacos');
    expect(wrapper.text()).toContain('A compact preview that keeps the detail route readable');
    expect(wrapper.text()).toContain('Fort Worth, US');
    expect(wrapper.text()).toContain('Rated 4.8 out of 5');
    expect(wrapper.text()).toContain('Golden Hour Bites');
    expect(wrapper.get('a[href="/explore"]').text()).toBe('Back to explore');
    expect(wrapper.find('[data-test="spot-detail-stub"]').exists()).toBe(false);
  });
});
