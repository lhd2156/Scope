import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';

const { authStoreMock, notificationsStoreMock, searchContentMock, toastStoreMock } = vi.hoisted(() => ({
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
  searchContentMock: vi.fn(),
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

vi.mock('@/services/searchService', () => ({
  searchContent: searchContentMock,
}));

import Navbar from '@/components/common/Navbar.vue';

function buildRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
      { path: '/explore', name: 'explore', component: { template: '<div>Explore</div>' } },
      { path: '/map', name: 'map', component: { template: '<div>Map</div>' } },
      { path: '/spots/new', name: 'spot-create', component: { template: '<div>Create Spot</div>' } },
      { path: '/trips/new', name: 'trip-planner', component: { template: '<div>Trips</div>' } },
      { path: '/ai/ask', name: 'scope-ai', component: { template: '<div>Scope AI</div>' } },
      { path: '/friends', name: 'friends', component: { template: '<div>Friends</div>' } },
      { path: '/profile/:id', name: 'profile', component: { template: '<div>Profile</div>' } },
      { path: '/settings', name: 'settings', component: { template: '<div>Settings</div>' } },
      { path: '/spots/:id', name: 'spot-detail', component: { template: '<div>Spot Detail</div>' } },
      { path: '/login', name: 'login', component: { template: '<div>Login</div>' } },
      { path: '/register', name: 'register', component: { template: '<div>Register</div>' } },
    ],
  });
}

describe('Navbar', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      writable: true,
      value: 0,
    });
    authStoreMock.error = null;
    authStoreMock.currentUser = null;
    authStoreMock.logout.mockClear();
    searchContentMock.mockReset();
    searchContentMock.mockResolvedValue({
      query: 'rooftop tacos',
      type: 'spots',
      total: 1,
      offset: 0,
      limit: 6,
      results: [
        {
          id: 'spot-1',
          name: 'Sunset Rooftop Tacos',
          description: 'Open-air tacos with a downtown skyline.',
          category: 'food',
          tags: ['Fort Worth', 'tacos'],
          avg_rating: 4.8,
          review_count: 42,
          _score: 12,
        },
      ],
    });
    toastStoreMock.showSuccess.mockClear();
    toastStoreMock.showInfo.mockClear();
  });

  it('keeps navbar searches in a quick dropdown and logs authenticated users out through the menu', async () => {
    authStoreMock.isAuthenticated = true;
    authStoreMock.currentUser = {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      avatarUrl: 'https://images.example.com/avatar.jpg',
      homeBase: 'Chicago, IL',
    };

    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    const wrapper = mount(Navbar, {
      attachTo: document.body,
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
          ScopeIcon: { template: '<span class="icon-stub" />' },
          Transition: false,
        },
      },
    });

    expect(wrapper.find('[data-test="notification-stub"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Louis Do');
    expect(wrapper.text()).toContain('Chicago, IL');

    await wrapper.get('[data-test="search-trigger"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/');
    expect(searchContentMock).toHaveBeenCalledWith('rooftop tacos', 'spots', 6, 0);
    expect(wrapper.get('[data-test="quick-search-dropdown"]').text()).toContain('Sunset Rooftop Tacos');

    await wrapper.get('.profile-chip').trigger('click');
    expect(wrapper.text()).toContain('Signed in as');
    await wrapper.get('.menu-dropdown button').trigger('click');
    await flushPromises();

    expect(authStoreMock.logout).toHaveBeenCalledTimes(1);
    expect(router.currentRoute.value.fullPath).toBe('/');
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Signed out',
      message: 'Your Scope session is closed for now. Come back anytime to keep exploring.',
    });

    wrapper.unmount();
  });

  it('renders profile handles lowercase in the chip and profile menu', async () => {
    authStoreMock.isAuthenticated = true;
    authStoreMock.currentUser = {
      id: 'user-1',
      username: 'LOUISDO',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      avatarUrl: 'https://images.example.com/avatar.jpg',
    };

    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    const wrapper = mount(Navbar, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          SearchBar: { template: '<div>Search</div>' },
          NotificationDropdown: { template: '<div>Notifications</div>' },
          ThemeToggle: { template: '<div>Theme</div>' },
          Avatar: { template: '<div>Avatar</div>' },
          ScopeIcon: { template: '<span class="icon-stub" />' },
          Transition: false,
        },
      },
    });

    expect(wrapper.get('.profile-chip__copy small').text()).toBe('@louisdo');

    await wrapper.get('.profile-chip').trigger('click');
    await flushPromises();

    expect(wrapper.get('.menu-dropdown__copy p:last-child').text()).toBe('@louisdo');

    wrapper.unmount();
  });

  it('keeps the create-spot CTA visible and accessible in the navbar chrome', async () => {
    authStoreMock.isAuthenticated = false;
    authStoreMock.currentUser = null;

    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    const wrapper = mount(Navbar, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          SearchBar: { template: '<div>Search</div>' },
          ThemeToggle: { template: '<div>Theme</div>' },
          Transition: false,
        },
      },
    });

    const createSpotLink = wrapper.get('[data-test="create-spot-link"]');
    expect(createSpotLink.text()).toContain('Create');
    expect(createSpotLink.attributes('aria-label')).toBe('Create Spot');

    wrapper.unmount();
  });

  it('keeps signed-in feature links available without crowding the primary nav', async () => {
    authStoreMock.isAuthenticated = true;
    authStoreMock.currentUser = {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      avatarUrl: 'https://images.example.com/avatar.jpg',
      homeBase: 'Fort Worth, TX',
    };

    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    const wrapper = mount(Navbar, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          SearchBar: { template: '<div>Search</div>' },
          NotificationDropdown: { template: '<div>Notifications</div>' },
          ThemeToggle: { template: '<div>Theme</div>' },
          Avatar: { template: '<div>Avatar</div>' },
          ScopeIcon: { template: '<span class="icon-stub" />' },
          Transition: false,
        },
      },
    });

    const primaryNav = wrapper.get('.nav-links');
    expect(primaryNav.text()).toContain('Home');
    expect(primaryNav.text()).toContain('Explore');
    expect(primaryNav.text()).toContain('Map');
    expect(primaryNav.text()).toContain('More');

    await wrapper.get('.feature-menu-button').trigger('click');
    await flushPromises();

    const featureMenu = wrapper.get('.feature-menu-dropdown');
    expect(featureMenu.text()).toContain('Trips');
    expect(featureMenu.text()).toContain('Scope AI');
    expect(featureMenu.text()).not.toContain('AI Planner');
    expect(featureMenu.text()).toContain('Friends');

    wrapper.unmount();
  });

  it('switches from transparent to solid styling after the page scrolls', async () => {
    authStoreMock.isAuthenticated = false;
    authStoreMock.currentUser = null;

    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    const wrapper = mount(Navbar, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          SearchBar: { template: '<div>Search</div>' },
          ThemeToggle: { template: '<div>Theme</div>' },
        },
      },
    });

    expect(wrapper.get('.navbar').classes()).not.toContain('navbar--scrolled');

    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      writable: true,
      value: 96,
    });
    window.dispatchEvent(new Event('scroll'));
    await flushPromises();

    expect(wrapper.get('.navbar').classes()).toContain('navbar--scrolled');

    wrapper.unmount();
  });

  it('opens the profile menu with keyboard controls, cycles items, and restores focus on escape', async () => {
    authStoreMock.isAuthenticated = true;
    authStoreMock.currentUser = {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      avatarUrl: 'https://images.example.com/avatar.jpg',
    };

    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    const wrapper = mount(Navbar, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          SearchBar: { template: '<div>Search</div>' },
          NotificationDropdown: { template: '<div>Notifications</div>' },
          ThemeToggle: { template: '<div>Theme</div>' },
          Avatar: { template: '<div>Avatar</div>' },
          ScopeIcon: { template: '<span class="icon-stub" />' },
          Transition: false,
        },
      },
    });

    const profileButton = wrapper.get('.profile-chip');
    (profileButton.element as HTMLButtonElement).focus();

    await profileButton.trigger('keydown', { key: 'ArrowDown' });
    await flushPromises();

    const menuPanel = wrapper.get('.menu-dropdown');
    const menuLinks = menuPanel.findAll('[role="menuitem"]');

    expect(profileButton.attributes('aria-expanded')).toBe('true');
    expect(menuPanel.attributes('role')).toBe('menu');
    expect(document.activeElement).toBe(menuLinks[0]?.element);

    await menuPanel.trigger('keydown', { key: 'ArrowDown' });
    await flushPromises();
    expect(document.activeElement).toBe(menuLinks[1]?.element);

    (profileButton.element as HTMLButtonElement).focus();
    await profileButton.trigger('keydown', { key: 'Escape' });
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(profileButton.attributes('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(profileButton.element);

    wrapper.unmount();
  });

  it('opens the mobile drawer, locks page scroll, and closes on escape or navigation', async () => {
    authStoreMock.isAuthenticated = true;
    authStoreMock.currentUser = {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      avatarUrl: 'https://images.example.com/avatar.jpg',
      homeBase: 'Chicago, IL',
    };

    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    const wrapper = mount(Navbar, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          SearchBar: {
            emits: ['search'],
            template: '<button data-test="search-trigger" @click="$emit(\'search\', \'patagonia\')">Search</button>',
          },
          NotificationDropdown: { template: '<div data-test="notification-stub">Notifications</div>' },
          ThemeToggle: { template: '<button data-test="theme-toggle-stub">Theme</button>' },
          Avatar: { template: '<div data-test="avatar-stub">Avatar</div>' },
          ScopeIcon: { template: '<span class="icon-stub" />' },
          Transition: false,
        },
      },
    });

    const mobileToggle = wrapper.get('[data-test="mobile-menu-toggle"]');
    await mobileToggle.trigger('click');
    await flushPromises();

    const mobileDrawer = wrapper.get('[data-test="mobile-drawer"]');
    expect(mobileDrawer.text()).toContain('Take Scope with you');
    expect(mobileDrawer.text()).toContain('Louis Do');
    expect(mobileDrawer.text()).toContain('Profile');
    expect(document.body.style.overflow).toBe('hidden');

    await mobileDrawer.trigger('keydown', { key: 'Escape' });
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-test="mobile-drawer"]').exists()).toBe(false);
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(mobileToggle.element);

    await mobileToggle.trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-test="mobile-drawer"]').exists()).toBe(true);

    await router.push('/explore');
    await flushPromises();

    expect(wrapper.find('[data-test="mobile-drawer"]').exists()).toBe(false);
    expect(document.body.style.overflow).toBe('');

    wrapper.unmount();
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
          Transition: false,
        },
      },
    });

    expect(wrapper.text()).toContain('Log in');
    expect(wrapper.text()).toContain('Create account');
    expect(wrapper.find('.feature-menu-button').exists()).toBe(false);
    expect(wrapper.find('.profile-chip').exists()).toBe(false);

    wrapper.unmount();
  });
});
