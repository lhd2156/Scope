import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';

const { authStoreMock, notificationsStoreMock, toastStoreMock } = vi.hoisted(() => ({
  authStoreMock: {
    isAuthenticated: true,
    error: null as string | null,
    currentUser: null as any,
    logout: vi.fn().mockResolvedValue(undefined),
  },
  notificationsStoreMock: {
    items: [{ id: 'notification-1', title: 'Trip invite', isRead: false }],
    unreadCount: 2,
    loading: false,
    connectionState: 'connected',
    connectionError: null,
    markAllRead: vi.fn(),
    markRead: vi.fn(),
  },
  toastStoreMock: {
    showSuccess: vi.fn(),
    showInfo: vi.fn(),
  },
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationsStore: () => notificationsStoreMock,
}));

vi.mock('@/stores/toasts', () => ({
  useToastStore: () => toastStoreMock,
}));

import Navbar from '@/components/common/Navbar.vue';

function buildRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
      { path: '/explore', name: 'explore', component: { template: '<div>Explore</div>' } },
      { path: '/map', name: 'map', component: { template: '<div>Map</div>' } },
      { path: '/trips/new', name: 'trip-planner', component: { template: '<div>Trips</div>' } },
      { path: '/friends', name: 'friends', component: { template: '<div>Friends</div>' } },
      { path: '/profile/:id', name: 'profile', component: { template: '<div>Profile</div>' } },
      { path: '/settings', name: 'settings', component: { template: '<div>Settings</div>' } },
      { path: '/login', name: 'login', component: { template: '<div>Login</div>' } },
      { path: '/register', name: 'register', component: { template: '<div>Register</div>' } },
    ],
  });
}

describe('Navbar', () => {
  beforeEach(() => {
    authStoreMock.error = null;
    authStoreMock.logout.mockClear();
    toastStoreMock.showSuccess.mockClear();
    toastStoreMock.showInfo.mockClear();
  });

  it('routes searches to explore and logs authenticated users out through the menu', async () => {
    authStoreMock.isAuthenticated = true;
    authStoreMock.currentUser = {
      id: 'user-1',
      displayName: 'Louis Do',
      avatarUrl: 'https://images.example.com/avatar.jpg',
    };

    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    const wrapper = mount(Navbar, {
      global: {
        plugins: [router],
        stubs: {
          SearchBar: {
            emits: ['search'],
            template: '<button data-test="search-trigger" @click="$emit(\'search\', \'rooftop tacos\')">Search</button>',
          },
          NotificationDropdown: { template: '<div data-test="notification-stub">Notifications</div>' },
          ThemeToggle: { template: '<div data-test="theme-toggle-stub">Theme</div>' },
          Avatar: { template: '<div data-test="avatar-stub">Avatar</div>' },
          AtlasIcon: { template: '<span class="icon-stub" />' },
        },
      },
    });

    expect(wrapper.find('[data-test="notification-stub"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Louis Do');

    await wrapper.get('[data-test="search-trigger"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/explore?q=rooftop+tacos');

    await wrapper.get('.profile-chip').trigger('click');
    await wrapper.get('.menu-dropdown button').trigger('click');
    await flushPromises();

    expect(authStoreMock.logout).toHaveBeenCalledTimes(1);
    expect(router.currentRoute.value.fullPath).toBe('/');
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Signed out',
      message: 'Your Atlas session is closed for now. Come back anytime to keep exploring.',
    });
  });

  it('shows guest actions when no authenticated user is present', async () => {
    authStoreMock.isAuthenticated = false;
    authStoreMock.currentUser = null;

    const router = buildRouter();
    await router.push('/login');
    await router.isReady();

    const wrapper = mount(Navbar, {
      global: {
        plugins: [router],
        stubs: {
          SearchBar: { template: '<div>Search</div>' },
          ThemeToggle: { template: '<div data-test="theme-toggle-stub">Theme</div>' },
        },
      },
    });

    expect(wrapper.text()).toContain('Log in');
    expect(wrapper.text()).toContain('Create account');
    expect(wrapper.find('.profile-chip').exists()).toBe(false);
  });
});
