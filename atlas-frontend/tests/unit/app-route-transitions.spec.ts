import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { h, onMounted, onUnmounted, reactive } from 'vue';

const authState = reactive({
  isAuthenticated: false,
  sessionExpiredMessage: null as string | null,
});

const authStoreMock = {
  hydrateSession: vi.fn().mockResolvedValue(false),
  clearSessionExpiredMessage: vi.fn(() => {
    authState.sessionExpiredMessage = null;
  }),
  get isAuthenticated() {
    return authState.isAuthenticated;
  },
  get sessionExpiredMessage() {
    return authState.sessionExpiredMessage;
  },
};

const notificationsStoreMock = {
  fetchNotifications: vi.fn().mockResolvedValue(undefined),
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
};

const toastStoreMock = {
  showError: vi.fn().mockReturnValue('toast-session-expired'),
  dismissToast: vi.fn(),
};

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationsStore: () => notificationsStoreMock,
}));

vi.mock('@/stores/toasts', () => ({
  useToastStore: () => toastStoreMock,
}));

import App from '@/App.vue';

describe('App route transitions', () => {
  beforeEach(() => {
    authState.isAuthenticated = false;
    authState.sessionExpiredMessage = null;
    authStoreMock.hydrateSession.mockClear();
    authStoreMock.clearSessionExpiredMessage.mockClear();
    notificationsStoreMock.fetchNotifications.mockClear();
    notificationsStoreMock.connect.mockClear();
    notificationsStoreMock.disconnect.mockClear();
    toastStoreMock.showError.mockClear();
    toastStoreMock.dismissToast.mockClear();
  });

  it('keys the route transition by path so query-only updates do not remount the active page', async () => {
    const lifecycle = {
      exploreMounts: 0,
      exploreUnmounts: 0,
    };

    const ExploreTarget = {
      name: 'ExploreTarget',
      setup() {
        onMounted(() => {
          lifecycle.exploreMounts += 1;
        });
        onUnmounted(() => {
          lifecycle.exploreUnmounts += 1;
        });

        return () => h('div', { 'data-test': 'explore-target' }, 'Explore target');
      },
    };

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/explore', name: 'explore', component: ExploreTarget },
        { path: '/map', name: 'map', component: { template: '<div>Map target</div>' } },
      ],
    });

    await router.push({ path: '/explore', query: { q: 'coffee' } });
    await router.isReady();

    const wrapper = mount(App, {
      global: {
        plugins: [router],
        stubs: {
          CookieConsentBanner: { template: '<div data-test="cookie-consent-banner-stub" />' },
          OnboardingOverlay: { template: '<div data-test="onboarding-overlay-stub" />' },
          ToastViewport: { template: '<div data-test="toast-viewport-stub" />' },
        },
      },
    });

    await flushPromises();

    expect(wrapper.find('.route-stage').attributes('data-route-path')).toBe('/explore');
    expect(wrapper.find('.route-stage').attributes('data-route-name')).toBe('explore');
    expect(lifecycle.exploreMounts).toBe(1);
    expect(lifecycle.exploreUnmounts).toBe(0);

    await router.replace({ path: '/explore', query: { q: 'brunch' } });
    await flushPromises();

    expect(wrapper.find('.route-stage').attributes('data-route-path')).toBe('/explore');
    expect(lifecycle.exploreMounts).toBe(1);
    expect(lifecycle.exploreUnmounts).toBe(0);

    await router.push('/map');
    await flushPromises();

    expect(router.currentRoute.value.name).toBe('map');
  });
});
