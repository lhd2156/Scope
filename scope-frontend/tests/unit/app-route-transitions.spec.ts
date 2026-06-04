import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { h, onMounted, onUnmounted, reactive } from 'vue';
import { ANALYTICS_CONSENT_STORAGE_KEY } from '@/utils/analyticsConsent';
import { clearStoredAuthSessionHint, persistAuthSessionHint } from '@/utils/authSessionStorage';

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

const onboardingStoreMock = {
  isActive: false,
  hasCompleted: true,
};

const toastStoreMock = {
  hasToasts: false,
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

vi.mock('@/stores/onboarding', () => ({
  useOnboardingStore: () => onboardingStoreMock,
}));

import App from '@/App.vue';

describe('App route transitions', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    authState.isAuthenticated = false;
    authState.sessionExpiredMessage = null;
    onboardingStoreMock.isActive = false;
    onboardingStoreMock.hasCompleted = true;
    toastStoreMock.hasToasts = false;
    authStoreMock.hydrateSession.mockClear();
    authStoreMock.clearSessionExpiredMessage.mockClear();
    notificationsStoreMock.fetchNotifications.mockClear();
    notificationsStoreMock.connect.mockClear();
    notificationsStoreMock.disconnect.mockClear();
    toastStoreMock.showError.mockClear();
    toastStoreMock.dismissToast.mockClear();
  });

  afterEach(() => {
    clearStoredAuthSessionHint();
    localStorage.clear();
    sessionStorage.clear();
    delete document.documentElement.dataset.scopeQa;
    delete (window as Window & { __SCOPE_VISUAL_QA__?: boolean }).__SCOPE_VISUAL_QA__;
  });

  function mountAppWithRouter(router: ReturnType<typeof createRouter>) {
    return mount(App, {
      global: {
        plugins: [router],
        stubs: {
          AuthSessionRuntime: { template: '<div data-test="auth-session-runtime-stub" />' },
          CookieConsentBanner: { template: '<div data-test="cookie-consent-banner-stub" />' },
          OnboardingOverlay: { template: '<div data-test="onboarding-overlay-stub" />' },
          ToastViewport: { template: '<div data-test="toast-viewport-stub" />' },
        },
      },
    });
  }

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

    const wrapper = mountAppWithRouter(router);

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

  it('boots global overlays from route auth, onboarding, consent, and toast state', async () => {
    onboardingStoreMock.isActive = true;
    toastStoreMock.hasToasts = true;
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/settings',
          name: 'settings',
          component: { template: '<div>Settings target</div>' },
          meta: { requiresAuth: true },
        },
      ],
    });

    await router.push('/settings');
    await router.isReady();

    const wrapper = mountAppWithRouter(router);
    await flushPromises();

    expect(wrapper.find('[data-test="auth-session-runtime-stub"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="onboarding-overlay-stub"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="cookie-consent-banner-stub"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="toast-viewport-stub"]').exists()).toBe(true);
  });

  it('uses stored session hints and analytics choices on public routes', async () => {
    localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, 'denied');
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/explore',
          name: 'explore',
          component: { template: '<div>Explore target</div>' },
        },
      ],
    });

    await router.push('/explore');
    await router.isReady();

    const wrapper = mountAppWithRouter(router);
    await flushPromises();

    expect(wrapper.find('[data-test="auth-session-runtime-stub"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="cookie-consent-banner-stub"]').exists()).toBe(false);

    persistAuthSessionHint('refresh-token-app', { persistence: 'session' });
    await flushPromises();

    expect(wrapper.find('[data-test="auth-session-runtime-stub"]').exists()).toBe(true);
  });

  it('suppresses onboarding and cookie consent surfaces during Scope QA routes', async () => {
    onboardingStoreMock.isActive = true;
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/explore',
          name: 'explore',
          component: { template: '<div>Explore target</div>' },
        },
      ],
    });

    await router.push('/explore?scopeQaSession=guest');
    await router.isReady();

    const wrapper = mountAppWithRouter(router);
    await flushPromises();

    expect(wrapper.find('[data-test="onboarding-overlay-stub"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="cookie-consent-banner-stub"]').exists()).toBe(false);
    expect(document.documentElement.dataset.scopeQa).toBe('true');
  });

  it('falls back to path-based route labels and treats storage failures as no consent choice', async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/anonymous',
          component: { template: '<div>Anonymous target</div>' },
        },
      ],
    });

    await router.push('/anonymous');
    await router.isReady();

    const wrapper = mountAppWithRouter(router);
    await flushPromises();

    expect(wrapper.find('.route-stage').attributes('data-route-name')).toBe('/anonymous');
    expect(wrapper.find('[data-test="cookie-consent-banner-stub"]').exists()).toBe(true);

    getItemSpy.mockRestore();
  });
});
