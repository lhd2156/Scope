import { reactive } from 'vue';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
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

const presenceHarness = vi.hoisted(() => {
  const state: { activityHandler: ((detail?: Record<string, unknown>) => void) | null } = {
    activityHandler: null,
  };
  const removePresenceActivityListenerMock = vi.fn();
  const presenceServiceMock = {
    listenForPresenceActivity: vi.fn((handler: (detail?: Record<string, unknown>) => void) => {
      state.activityHandler = handler;
      return removePresenceActivityListenerMock;
    }),
    sendPresenceBeacon: vi.fn(),
    sendPresenceHeartbeat: vi.fn().mockResolvedValue(undefined),
    stopPendingPresenceWork: vi.fn(),
  };
  const cancelNotificationBootMock = vi.fn();
  const scheduleNonCriticalTaskMock = vi.fn((task: () => void | Promise<void>) => {
    void task();
    return cancelNotificationBootMock;
  });

  return {
    cancelNotificationBootMock,
    presenceServiceMock,
    removePresenceActivityListenerMock,
    scheduleNonCriticalTaskMock,
    state,
  };
});

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

vi.mock('@/services/demoMode', () => ({
  AUTH_MOCK_FALLBACK_ENABLED: false,
}));

vi.mock('@/services/presenceService', () => presenceHarness.presenceServiceMock);

vi.mock('@/utils/scheduleNonCriticalTask', () => ({
  scheduleNonCriticalTask: presenceHarness.scheduleNonCriticalTaskMock,
}));

import AuthSessionRuntime from '@/components/common/AuthSessionRuntime.vue';

describe('App session edge cases', () => {
  const mountedWrappers: VueWrapper[] = [];

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
    presenceHarness.state.activityHandler = null;
    presenceHarness.removePresenceActivityListenerMock.mockClear();
    presenceHarness.presenceServiceMock.listenForPresenceActivity.mockClear();
    presenceHarness.presenceServiceMock.sendPresenceBeacon.mockClear();
    presenceHarness.presenceServiceMock.sendPresenceHeartbeat.mockClear();
    presenceHarness.presenceServiceMock.stopPendingPresenceWork.mockClear();
    presenceHarness.scheduleNonCriticalTaskMock.mockClear();
    presenceHarness.scheduleNonCriticalTaskMock.mockImplementation((task: () => void | Promise<void>) => {
      void task();
      return presenceHarness.cancelNotificationBootMock;
    });
    presenceHarness.cancelNotificationBootMock.mockClear();
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
  });

  afterEach(() => {
    mountedWrappers.splice(0).forEach((wrapper) => {
      wrapper.unmount();
    });
    vi.useRealTimers();
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

    const wrapper = mount(AuthSessionRuntime, {
      global: {
        plugins: [router],
      },
    });
    mountedWrappers.push(wrapper);

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

  it('boots notifications and presence for authenticated planning routes', async () => {
    authState.isAuthenticated = true;
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/trips/new', name: 'trip-planner', component: { template: '<div>Planner target</div>' } },
        { path: '/explore', name: 'explore', component: { template: '<div>Explore target</div>' } },
      ],
    });

    await router.push('/trips/new');
    await router.isReady();

    const wrapper = mount(AuthSessionRuntime, {
      global: {
        plugins: [router],
      },
    });
    mountedWrappers.push(wrapper);
    await flushPromises();

    expect(authStoreMock.hydrateSession).toHaveBeenCalledTimes(1);
    expect(presenceHarness.scheduleNonCriticalTaskMock).toHaveBeenCalledWith(expect.any(Function), {
      delayMs: 1_600,
      timeoutMs: 4_000,
    });
    expect(notificationsStoreMock.fetchNotifications).toHaveBeenCalledTimes(1);
    expect(notificationsStoreMock.connect).toHaveBeenCalledTimes(1);
    expect(presenceHarness.presenceServiceMock.listenForPresenceActivity).toHaveBeenCalledTimes(1);
    expect(presenceHarness.presenceServiceMock.sendPresenceHeartbeat).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'planning',
        routeContext: 'trip-planner',
        isIdle: false,
        isPlanning: true,
      }),
      { force: true },
    );

    presenceHarness.presenceServiceMock.sendPresenceHeartbeat.mockClear();
    await router.push('/explore');
    await flushPromises();

    expect(presenceHarness.presenceServiceMock.sendPresenceHeartbeat).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'online',
        routeContext: 'explore',
        isPlanning: false,
      }),
      { force: true },
    );

    presenceHarness.presenceServiceMock.sendPresenceHeartbeat.mockClear();
    presenceHarness.state.activityHandler?.({ routeContext: 'manual-planning', isPlanning: true, immediate: true });
    await flushPromises();

    expect(presenceHarness.presenceServiceMock.sendPresenceHeartbeat).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'planning',
        routeContext: 'manual-planning',
        isIdle: false,
        isPlanning: true,
      }),
      { force: true },
    );
  });

  it('marks presence idle/active through visibility changes and sends offline cleanup', async () => {
    authState.isAuthenticated = true;
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/map', name: 'map', component: { template: '<div>Map target</div>' } },
      ],
    });

    await router.push('/map');
    await router.isReady();

    const wrapper = mount(AuthSessionRuntime, {
      global: {
        plugins: [router],
      },
    });
    mountedWrappers.push(wrapper);
    await flushPromises();

    presenceHarness.presenceServiceMock.sendPresenceHeartbeat.mockClear();
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await flushPromises();

    expect(presenceHarness.presenceServiceMock.sendPresenceHeartbeat).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'idle',
        routeContext: 'map',
        isIdle: true,
      }),
      { force: true },
    );

    presenceHarness.presenceServiceMock.sendPresenceHeartbeat.mockClear();
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await flushPromises();

    expect(presenceHarness.presenceServiceMock.sendPresenceHeartbeat).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'online',
        routeContext: 'map',
        isIdle: false,
      }),
      { force: true },
    );

    window.dispatchEvent(new Event('beforeunload'));
    expect(presenceHarness.presenceServiceMock.sendPresenceBeacon).toHaveBeenCalledWith({
      status: 'offline',
      routeContext: 'map',
      isIdle: true,
    });

    presenceHarness.presenceServiceMock.sendPresenceHeartbeat.mockClear();
    wrapper.unmount();
    mountedWrappers.pop();
    await flushPromises();

    expect(presenceHarness.removePresenceActivityListenerMock).toHaveBeenCalledTimes(1);
    expect(presenceHarness.presenceServiceMock.stopPendingPresenceWork).toHaveBeenCalled();
    expect(notificationsStoreMock.disconnect).toHaveBeenCalled();
    expect(presenceHarness.presenceServiceMock.sendPresenceHeartbeat).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'offline',
        isIdle: true,
      }),
      { force: true },
    );
  });

  it('disconnects realtime notifications and presence when auth flips to guest', async () => {
    authState.isAuthenticated = true;
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/friends', name: 'friends', component: { template: '<div>Friends target</div>' } },
      ],
    });

    await router.push('/friends');
    await router.isReady();

    const wrapper = mount(AuthSessionRuntime, {
      global: {
        plugins: [router],
      },
    });
    mountedWrappers.push(wrapper);
    await flushPromises();

    notificationsStoreMock.disconnect.mockClear();
    presenceHarness.presenceServiceMock.sendPresenceHeartbeat.mockClear();

    authState.isAuthenticated = false;
    await flushPromises();

    expect(notificationsStoreMock.disconnect).toHaveBeenCalledTimes(1);
    expect(presenceHarness.presenceServiceMock.stopPendingPresenceWork).toHaveBeenCalled();
    expect(presenceHarness.presenceServiceMock.sendPresenceHeartbeat).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'offline',
        routeContext: 'friends',
        isIdle: true,
      }),
      { force: true },
    );
  });

  it('disconnects realtime stores without an offline heartbeat when QA mode disables runtime', async () => {
    window.history.pushState({}, '', '/friends');
    authState.isAuthenticated = true;
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/friends', name: 'friends', component: { template: '<div>Friends target</div>' } },
      ],
    });

    await router.push('/friends');
    await router.isReady();

    const wrapper = mount(AuthSessionRuntime, {
      global: {
        plugins: [router],
      },
    });
    mountedWrappers.push(wrapper);
    await flushPromises();

    expect(notificationsStoreMock.fetchNotifications).toHaveBeenCalledTimes(1);
    expect(notificationsStoreMock.connect).toHaveBeenCalledTimes(1);

    notificationsStoreMock.disconnect.mockClear();
    presenceHarness.presenceServiceMock.sendPresenceHeartbeat.mockClear();
    window.history.pushState({}, '', '/friends?scopeQaSession=authenticated');
    authState.isAuthenticated = false;
    await flushPromises();

    expect(notificationsStoreMock.disconnect).toHaveBeenCalledTimes(1);
    expect(presenceHarness.presenceServiceMock.stopPendingPresenceWork).toHaveBeenCalled();
    expect(presenceHarness.presenceServiceMock.sendPresenceHeartbeat).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: 'offline' }),
      { force: true },
    );

    window.history.pushState({}, '', '/friends');
  });

  it('moves authenticated presence from idle back to active and keeps heartbeats running', async () => {
    vi.useFakeTimers();
    authState.isAuthenticated = true;
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/explore', name: 'explore', component: { template: '<div>Explore target</div>' } },
      ],
    });

    await router.push('/explore');
    await router.isReady();

    const wrapper = mount(AuthSessionRuntime, {
      global: {
        plugins: [router],
      },
    });
    mountedWrappers.push(wrapper);
    await flushPromises();

    presenceHarness.presenceServiceMock.sendPresenceHeartbeat.mockClear();
    vi.advanceTimersByTime(120_000);
    await flushPromises();

    expect(presenceHarness.presenceServiceMock.sendPresenceHeartbeat).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'idle',
        routeContext: 'explore',
        isIdle: true,
        isPlanning: false,
      }),
      { force: true },
    );

    presenceHarness.presenceServiceMock.sendPresenceHeartbeat.mockClear();
    window.dispatchEvent(new Event('pointerdown'));
    await flushPromises();

    expect(presenceHarness.presenceServiceMock.sendPresenceHeartbeat).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'online',
        routeContext: 'explore',
        isIdle: false,
        isPlanning: false,
      }),
      { force: true },
    );

    presenceHarness.presenceServiceMock.sendPresenceHeartbeat.mockClear();
    vi.advanceTimersByTime(60_000);
    await flushPromises();

    expect(presenceHarness.presenceServiceMock.sendPresenceHeartbeat.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        status: 'online',
        routeContext: 'explore',
      }),
    );
  });

  it('keeps session-expired routing on login-like routes and replaces repeated toasts', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/register', name: 'register', component: { template: '<div>Register target</div>' } },
        { path: '/login', name: 'login', component: { template: '<div>Login target</div>' } },
      ],
    });

    await router.push('/register');
    await router.isReady();

    const wrapper = mount(AuthSessionRuntime, {
      global: {
        plugins: [router],
      },
    });
    mountedWrappers.push(wrapper);
    await flushPromises();

    authState.sessionExpiredMessage = 'Sign in again before creating your account.';
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe('/register');
    expect(toastStoreMock.showError).toHaveBeenCalledTimes(1);
    expect(authStoreMock.clearSessionExpiredMessage).toHaveBeenCalledTimes(1);

    authState.sessionExpiredMessage = 'Sign in again before creating your account.';
    await flushPromises();

    expect(toastStoreMock.showError).toHaveBeenCalledTimes(2);
    expect(toastStoreMock.dismissToast).toHaveBeenCalledWith('toast-session-expired', {
      invokeOnClose: true,
    });

    const onClose = toastStoreMock.showError.mock.calls[1]?.[0].onClose;
    onClose?.();
    authState.sessionExpiredMessage = 'This session timed out.';
    await flushPromises();

    expect(toastStoreMock.showError).toHaveBeenCalledTimes(3);
  });
});
