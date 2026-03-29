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

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationsStore: () => notificationsStoreMock,
}));

import App from '@/App.vue';

describe('App session edge cases', () => {
  beforeEach(() => {
    authState.isAuthenticated = false;
    authState.sessionExpiredMessage = null;
    authStoreMock.hydrateSession.mockClear();
    authStoreMock.clearSessionExpiredMessage.mockClear();
    notificationsStoreMock.fetchNotifications.mockClear();
    notificationsStoreMock.connect.mockClear();
    notificationsStoreMock.disconnect.mockClear();
  });

  it('redirects protected routes to login and shows a session-expired toast', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/friends', name: 'friends', component: { template: '<div>Friends target</div>' }, meta: { requiresAuth: true } },
        { path: '/login', name: 'login', component: { template: '<div>Login target</div>' }, meta: { guestOnly: true } },
      ],
    });

    await router.push('/friends');
    await router.isReady();

    const wrapper = mount(App, {
      global: {
        plugins: [router],
        stubs: {
          Toast: {
            props: ['open', 'title', 'message'],
            emits: ['close'],
            template: '<div v-if="open" data-test="toast-stub">{{ title }} {{ message }}</div>',
          },
        },
      },
    });

    authState.sessionExpiredMessage = 'Your session expired. Sign in again to keep planning in Atlas.';
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe('/login?redirect=/friends&reason=expired');
    expect(wrapper.find('[data-test="toast-stub"]').text()).toContain('Session expired');
    expect(wrapper.find('[data-test="toast-stub"]').text()).toContain('Your session expired. Sign in again to keep planning in Atlas.');
  });
});
