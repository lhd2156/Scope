import { reactive } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';

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

import AuthSessionRuntime from '@/components/common/AuthSessionRuntime.vue';

describe('App session edge cases', () => {
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

  it('redirects protected routes to login and pushes a session-expired toast into the global queue', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/friends', name: 'friends', component: { template: '<div>Friends target</div>' }, meta: { requiresAuth: true } },
        { path: '/login', name: 'login', component: { template: '<div>Login target</div>' }, meta: { guestOnly: true } },
      ],
    });

    await router.push('/friends');
    await router.isReady();

    mount(AuthSessionRuntime, {
      global: {
        plugins: [router],
      },
    });

    await flushPromises();

    authState.sessionExpiredMessage = 'Your session expired. Sign in again to keep planning in Scope.';
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe('/login?redirect=/friends&reason=expired');
    expect(toastStoreMock.showError).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Session expired',
      message: 'Your session expired. Sign in again to keep planning in Scope.',
      autoHideMs: 0,
    }));
  });
});
