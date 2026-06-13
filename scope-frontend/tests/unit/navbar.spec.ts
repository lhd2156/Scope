import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';

const {
  authStoreMock,
  loadSearchPlaceRecommendationsMock,
  notificationsStoreMock,
  recordSearchPlaceSuggestionClickMock,
  searchContentMock,
  toastStoreMock,
} = vi.hoisted(() => ({
  authStoreMock: {
    isAuthenticated: true,
    error: null as string | null,
    currentUser: null as any,
    logout: vi.fn().mockResolvedValue(undefined),
  },
  loadSearchPlaceRecommendationsMock: vi.fn(),
  notificationsStoreMock: {
    items: [{ id: 'notification-1', title: 'Trip invite', isRead: false }],
    unreadCount: 2,
    loading: false,
    connectionState: 'connected',
    connectionError: null,
    markAllRead: vi.fn(),
    markRead: vi.fn(),
  },
  recordSearchPlaceSuggestionClickMock: vi.fn(),
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

vi.mock('@/services/searchDiscoveryService', () => ({
  loadSearchPlaceRecommendations: loadSearchPlaceRecommendationsMock,
  recordSearchPlaceSuggestionClick: recordSearchPlaceSuggestionClickMock,
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

function buildInteractiveSearchStub() {
  return {
    props: ['modelValue'],
    emits: ['update:modelValue', 'search'],
    template: `
      <form data-test="search-stub" @submit.prevent="$emit('search', modelValue)">
        <input
          ref="input"
          data-test="search-input"
          :value="modelValue"
          @input="$emit('update:modelValue', $event.target.value)"
        />
        <button data-test="search-trigger" type="button" @click="$emit('search', $refs.input.value)">Search</button>
      </form>
    `,
  };
}

describe('Navbar', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      writable: true,
      value: 0,
    });
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1024,
    });
    authStoreMock.isAuthenticated = true;
    authStoreMock.error = null;
    authStoreMock.currentUser = null;
    authStoreMock.logout.mockClear();
    loadSearchPlaceRecommendationsMock.mockReset();
    loadSearchPlaceRecommendationsMock.mockResolvedValue([
      {
        id: 'spot-rec-1',
        title: 'Botanic River Walk',
        description: 'A quiet riverside place with morning light.',
        latitude: 32.749,
        longitude: -97.363,
        category: 'nature',
        city: 'Fort Worth',
        country: 'US',
        rating: 4.7,
        photoUrl: 'https://images.example.com/botanic-river-walk.jpg',
        createdAt: '2026-03-24T14:10:00Z',
        likesCount: 63,
        recommendationReason: 'Popular nature pick with calm energy',
        searchSuggestionSource: 'recommendation',
      },
    ]);
    recordSearchPlaceSuggestionClickMock.mockReset();
    recordSearchPlaceSuggestionClickMock.mockResolvedValue(undefined);
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
          city: 'Fort Worth',
          country: 'US',
          photoUrl: 'https://images.example.com/sunset-rooftop-tacos.jpg',
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
          NotificationDropdown: {
            emits: ['open-change'],
            template: '<button type="button" data-test="notification-stub" @click="$emit(\'open-change\', true)">Notifications</button>',
          },
          ThemeToggle: { template: '<div data-test="theme-toggle-stub">Theme</div>' },
          Avatar: { template: '<div data-test="avatar-stub">Avatar</div>' },
          ScopeIcon: { template: '<span class="icon-stub" />' },
          Transition: false,
        },
      },
    });

    expect(wrapper.find('[data-test="notification-stub"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Louis Do');
    expect(wrapper.get('.profile-chip').text()).toContain('@louisdo');
    expect(wrapper.get('.profile-chip').text()).not.toContain('Chicago, IL');

    await wrapper.get('[data-test="notification-stub"]').trigger('click');
    expect(wrapper.get('.navbar').classes()).toContain('navbar--notifications-open');

    await wrapper.get('[data-test="search-trigger"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/');
    expect(searchContentMock).toHaveBeenCalledWith('rooftop tacos', 'spots', 6, 0);
    expect(wrapper.get('[data-test="quick-search-dropdown"]').text()).toContain('Sunset Rooftop Tacos');
    expect(wrapper.get('[data-test="quick-search-result-photo"]').attributes('src')).toBe('https://images.example.com/sunset-rooftop-tacos.jpg');

    await wrapper.get('.profile-chip').trigger('click');
    expect(wrapper.text()).toContain('Signed in as');
    await wrapper.get('.menu-dropdown button').trigger('click');
    await flushPromises();

    expect(authStoreMock.logout).toHaveBeenCalledTimes(1);
    expect(router.currentRoute.value.fullPath).toBe('/');
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Signed out',
      message: 'Your Scope Trips session is closed for now. Come back anytime to keep exploring.',
    });

    wrapper.unmount();
  });

  it('promotes matching recommendations into quick-search results for short typed queries', async () => {
    authStoreMock.isAuthenticated = false;
    authStoreMock.currentUser = null;
    searchContentMock.mockResolvedValueOnce({
      query: 'ben',
      type: 'spots',
      total: 0,
      offset: 0,
      limit: 6,
      results: [],
    });
    loadSearchPlaceRecommendationsMock.mockResolvedValueOnce([
      {
        id: 'big-bend-window',
        title: 'Big Bend Window Trail',
        description: 'A desert hike with a cinematic canyon finish.',
        latitude: 29.2701,
        longitude: -103.3028,
        category: 'adventure',
        city: 'Big Bend National Park',
        country: 'US',
        rating: 4.9,
        photoUrl: 'https://images.example.com/big-bend-window.jpg',
        createdAt: '2026-03-24T14:10:00Z',
        likesCount: 52,
        vibe: 'desert overlook',
        searchSuggestionSource: 'trending',
      },
      {
        id: 'fort-worth-water',
        title: 'Fort Worth Water Gardens',
        description: 'Terraced pools and shaded plazas.',
        latitude: 32.7477,
        longitude: -97.3268,
        category: 'scenic',
        city: 'Fort Worth',
        country: 'US',
        rating: 4.7,
        createdAt: '2026-03-24T14:10:00Z',
        searchSuggestionSource: 'trending',
      },
    ]);

    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    const wrapper = mount(Navbar, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          SearchBar: buildInteractiveSearchStub(),
          ThemeToggle: { template: '<div>Theme</div>' },
          ScopeIcon: { template: '<span class="icon-stub" />' },
          Transition: false,
        },
      },
    });

    await wrapper.get('[data-test="search-input"]').setValue('ben');
    await wrapper.get('[data-test="search-trigger"]').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    const dropdown = wrapper.get('[data-test="quick-search-dropdown"]');
    expect(dropdown.text()).toContain('Big Bend Window Trail');
    expect(dropdown.text()).not.toContain('No quick matches yet.');
    expect(dropdown.text()).not.toContain('Recommended instead');
    expect(wrapper.get('[data-test="quick-search-result-photo"]').attributes('src')).toBe('https://images.example.com/big-bend-window.jpg');

    wrapper.unmount();
  });

  it('shows recommended places on search focus and opens them directly', async () => {
    authStoreMock.isAuthenticated = true;
    authStoreMock.currentUser = {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      avatarUrl: 'https://images.example.com/avatar.jpg',
      interests: ['nature'],
    };

    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    const wrapper = mount(Navbar, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          SearchBar: buildInteractiveSearchStub(),
          NotificationDropdown: { template: '<div>Notifications</div>' },
          ThemeToggle: { template: '<div>Theme</div>' },
          Avatar: { template: '<div>Avatar</div>' },
          ScopeIcon: { template: '<span class="icon-stub" />' },
          Transition: false,
        },
      },
    });

    await wrapper.get('[data-test="search-input"]').trigger('focusin');
    await flushPromises();

    expect(loadSearchPlaceRecommendationsMock).toHaveBeenCalledWith({
      isAuthenticated: true,
      currentUser: authStoreMock.currentUser,
      limit: 6,
    });
    expect(wrapper.get('[data-test="quick-search-dropdown"]').text()).toContain('Recommended for you');
    expect(wrapper.get('[data-test="quick-search-recommendation"]').text()).toContain('Botanic River Walk');

    await wrapper.get('[data-test="quick-search-recommendation"]').trigger('click');
    await flushPromises();

    expect(recordSearchPlaceSuggestionClickMock).toHaveBeenCalledWith(expect.objectContaining({
      id: 'spot-rec-1',
      searchSuggestionSource: 'recommendation',
    }));
    expect(router.currentRoute.value.fullPath).toBe('/spots/botanic-river-walk-fort-worth');

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
    expect(featureMenu.text()).not.toContain('Scope AI');
    expect(featureMenu.text()).not.toContain('AI Planner');
    expect(featureMenu.text()).toContain('Friends');

    await featureMenu.findAll('[role="menuitem"]')[0].trigger('click');
    await flushPromises();

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
    expect(mobileDrawer.text()).toContain('Take Scope Trips with you');
    expect(mobileDrawer.text()).toContain('Louis Do');
    expect(mobileDrawer.text()).toContain('Profile');
    expect(document.body.style.overflow).toBe('hidden');

    await wrapper.get('.brand').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-test="mobile-drawer"]').exists()).toBe(false);
    expect(document.body.style.overflow).toBe('');

    await mobileToggle.trigger('click');
    await flushPromises();
    await wrapper.get('.navbar__mobile-close').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-test="mobile-drawer"]').exists()).toBe(false);
    expect(document.body.style.overflow).toBe('');

    await mobileToggle.trigger('click');
    await flushPromises();
    const reopenedDrawer = wrapper.get('[data-test="mobile-drawer"]');
    await reopenedDrawer.trigger('keydown', { key: 'Escape' });
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-test="mobile-drawer"]').exists()).toBe(false);
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(mobileToggle.element);

    await mobileToggle.trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-test="mobile-drawer"]').exists()).toBe(true);

    await wrapper.get('.navbar__mobile-link[to="/explore"]').trigger('click');
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

    await wrapper.get('[data-test="mobile-menu-toggle"]').trigger('click');
    await flushPromises();
    await wrapper.get('.navbar__mobile-secondary').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-test="mobile-drawer"]').exists()).toBe(false);

    await router.push('/');
    await router.isReady();
    await wrapper.get('[data-test="mobile-menu-toggle"]').trigger('click');
    await flushPromises();
    await wrapper.get('.navbar__mobile-primary').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-test="mobile-drawer"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it('surfaces quick-search empty and error states and clears stale panels for blank searches', async () => {
    authStoreMock.isAuthenticated = false;
    authStoreMock.currentUser = null;

    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    searchContentMock.mockResolvedValueOnce({
      query: 'hidden gem',
      type: 'spots',
      total: 0,
      offset: 0,
      limit: 6,
      results: [],
    });

    const wrapper = mount(Navbar, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          SearchBar: buildInteractiveSearchStub(),
          ThemeToggle: { template: '<div>Theme</div>' },
          Transition: false,
        },
      },
    });

    const searchInput = wrapper.get('[data-test="search-input"]');
    const searchTrigger = wrapper.get('[data-test="search-trigger"]');

    await searchInput.setValue(' hidden gem ');
    await searchTrigger.trigger('click');
    await flushPromises();

    expect(searchContentMock).toHaveBeenCalledWith('hidden gem', 'spots', 6, 0);
    expect(wrapper.get('[data-test="quick-search-dropdown"]').text()).toContain('No quick matches yet.');

    searchContentMock.mockRejectedValueOnce(new Error('offline'));

    await searchInput.setValue('trailhead');
    await searchTrigger.trigger('click');
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe('Scope Trips could not load quick search right now.');

    await searchInput.setValue('   ');
    await searchTrigger.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(searchContentMock).toHaveBeenCalledTimes(2);

    wrapper.unmount();
  });

  it('ignores stale quick-search responses and opens encoded spot results', async () => {
    authStoreMock.isAuthenticated = true;
    authStoreMock.currentUser = {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      avatarUrl: 'https://images.example.com/avatar.jpg',
    };

    const firstRequest = Promise.withResolvers<any>();
    const secondRequest = Promise.withResolvers<any>();
    searchContentMock
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    const wrapper = mount(Navbar, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          SearchBar: buildInteractiveSearchStub(),
          NotificationDropdown: { template: '<div>Notifications</div>' },
          ThemeToggle: { template: '<div>Theme</div>' },
          Avatar: { template: '<div>Avatar</div>' },
          ScopeIcon: { template: '<span class="icon-stub" />' },
          Transition: false,
        },
      },
    });

    const searchInput = wrapper.get('[data-test="search-input"]');
    const searchTrigger = wrapper.get('[data-test="search-trigger"]');

    await searchInput.setValue('old rooftop');
    await searchTrigger.trigger('click');
    await searchInput.setValue('new rooftop');
    await searchTrigger.trigger('click');

    secondRequest.resolve({
      query: 'new rooftop',
      type: 'spots',
      total: 1,
      offset: 0,
      limit: 6,
      results: [
        {
          id: ' spot 1/2 ',
          name: 'Second Result',
          description: '',
          category: '',
          tags: [''],
          avg_rating: 0,
          review_count: 0,
          _score: 20,
        },
      ],
    });
    await flushPromises();

    firstRequest.resolve({
      query: 'old rooftop',
      type: 'spots',
      total: 1,
      offset: 0,
      limit: 6,
      results: [
        {
          id: 'old-result',
          name: 'Old Result',
          description: '',
          category: 'food',
          tags: [],
          avg_rating: 4.9,
          review_count: 8,
          _score: 10,
        },
      ],
    });
    await flushPromises();

    const dropdownText = wrapper.get('[data-test="quick-search-dropdown"]').text();
    expect(dropdownText).toContain('Second Result');
    expect(dropdownText).toContain('Scope Trips spot');
    expect(dropdownText).not.toContain('Old Result');

    await wrapper.get('[data-test="quick-search-result"]').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(router.currentRoute.value.fullPath).toBe('/spots/second-result');

    wrapper.unmount();
  });

  it('closes malformed quick-search results without navigating away', async () => {
    authStoreMock.isAuthenticated = false;
    authStoreMock.currentUser = null;

    const router = buildRouter();
    await router.push('/explore');
    await router.isReady();

    searchContentMock.mockResolvedValueOnce({
      query: 'nameless',
      type: 'spots',
      total: 1,
      offset: 0,
      limit: 6,
      results: [
        {
          id: '   ',
          name: 'Broken Result',
          description: '',
          category: '',
          tags: [],
          avg_rating: 0,
          review_count: 0,
          _score: 1,
        },
      ],
    });

    const wrapper = mount(Navbar, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          SearchBar: buildInteractiveSearchStub(),
          ThemeToggle: { template: '<div>Theme</div>' },
          ScopeIcon: { template: '<span class="icon-stub" />' },
          Transition: false,
        },
      },
    });

    await wrapper.get('[data-test="search-input"]').setValue('nameless');
    await wrapper.get('[data-test="search-trigger"]').trigger('click');
    await flushPromises();

    await wrapper.get('[data-test="quick-search-result"]').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(router.currentRoute.value.fullPath).toBe('/explore');

    wrapper.unmount();
  });

  it('supports full keyboard navigation through the signed-in feature menu', async () => {
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

    const featureButton = wrapper.get('.feature-menu-button');
    (featureButton.element as HTMLButtonElement).focus();

    await featureButton.trigger('keydown', { key: 'ArrowUp' });
    await flushPromises();

    const featureMenu = wrapper.get('.feature-menu-dropdown');
    const featureItems = featureMenu.findAll('[role="menuitem"]');

    expect(document.activeElement).toBe(featureItems.at(-1)?.element);

    await featureMenu.trigger('keydown', { key: 'Home' });
    expect(document.activeElement).toBe(featureItems[0]?.element);

    await featureMenu.trigger('keydown', { key: 'ArrowUp' });
    expect(document.activeElement).toBe(featureItems.at(-1)?.element);

    await featureMenu.trigger('keydown', { key: 'End' });
    expect(document.activeElement).toBe(featureItems.at(-1)?.element);

    await featureMenu.trigger('keydown', { key: 'ArrowDown' });
    expect(document.activeElement).toBe(featureItems[0]?.element);

    await featureMenu.trigger('keydown', { key: 'Escape' });
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(featureButton.attributes('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(featureButton.element);

    await featureButton.trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(featureButton.attributes('aria-expanded')).toBe('true');

    await featureButton.trigger('keydown', { key: 'Escape' });
    await flushPromises();
    expect(featureButton.attributes('aria-expanded')).toBe('false');

    wrapper.unmount();
  });

  it('supports profile menu boundary keys and signed-out error feedback', async () => {
    authStoreMock.isAuthenticated = true;
    authStoreMock.currentUser = {
      id: 'user-1',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      avatarUrl: 'https://images.example.com/avatar.jpg',
    };
    authStoreMock.logout.mockImplementationOnce(async () => {
      authStoreMock.error = 'Network dropped before the remote session closed.';
    });

    const router = buildRouter();
    await router.push('/settings');
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

    expect(wrapper.get('.profile-chip__copy small').text()).toBe('louis@example.com');

    const profileButton = wrapper.get('.profile-chip');
    (profileButton.element as HTMLButtonElement).focus();

    await profileButton.trigger('keydown', { key: 'ArrowUp' });
    await flushPromises();

    const menuPanel = wrapper.get('.menu-dropdown');
    const menuItems = menuPanel.findAll('[role="menuitem"]');
    expect(document.activeElement).toBe(menuItems.at(-1)?.element);

    await menuPanel.trigger('keydown', { key: 'Home' });
    expect(document.activeElement).toBe(menuItems[0]?.element);

    await menuPanel.trigger('keydown', { key: 'End' });
    expect(document.activeElement).toBe(menuItems.at(-1)?.element);

    await menuPanel.trigger('keydown', { key: 'ArrowUp' });
    expect(document.activeElement).toBe(menuItems[1]?.element);

    await menuPanel.trigger('keydown', { key: 'Escape' });
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(document.activeElement).toBe(profileButton.element);

    await profileButton.trigger('keydown', { key: ' ' });
    await flushPromises();
    await wrapper.get('.menu-dropdown button').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe('/');
    expect(toastStoreMock.showInfo).toHaveBeenCalledWith({
      title: 'Signed out locally',
      message: 'Network dropped before the remote session closed.',
    });
    expect(toastStoreMock.showSuccess).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('traps focus inside the mobile drawer and closes it when desktop navigation returns', async () => {
    authStoreMock.isAuthenticated = true;
    authStoreMock.currentUser = {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      avatarUrl: 'https://images.example.com/avatar.jpg',
      stats: { trips: 1 },
    };

    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    const wrapper = mount(Navbar, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          SearchBar: buildInteractiveSearchStub(),
          NotificationDropdown: { template: '<div>Notifications</div>' },
          ThemeToggle: { template: '<button data-test="theme-toggle-stub">Theme</button>' },
          Avatar: { template: '<div>Avatar</div>' },
          ScopeIcon: { template: '<span class="icon-stub" />' },
          Transition: false,
        },
      },
    });

    const mobileToggle = wrapper.get('[data-test="mobile-menu-toggle"]');
    await mobileToggle.trigger('click');
    await flushPromises();

    const mobileDrawer = wrapper.get('[data-test="mobile-drawer"]');
    expect(mobileDrawer.text()).toContain('1 trip in motion');

    const focusableElements = Array.from(
      mobileDrawer.element.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.tabIndex >= 0);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    lastElement.focus();
    await mobileDrawer.trigger('keydown', { key: 'Tab' });
    expect(document.activeElement).toBe(firstElement);

    firstElement.focus();
    await mobileDrawer.trigger('keydown', { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(lastElement);

    await mobileDrawer.trigger('keydown', { key: 'Home' });
    expect(document.activeElement).toBe(firstElement);

    await mobileDrawer.trigger('keydown', { key: 'End' });
    expect(document.activeElement).toBe(lastElement);

    await mobileDrawer.trigger('keydown', { key: 'ArrowDown' });
    expect(document.activeElement).toBe(firstElement);

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    window.dispatchEvent(new Event('resize'));
    await flushPromises();

    expect(wrapper.find('[data-test="mobile-drawer"]').exists()).toBe(false);
    expect(document.body.style.overflow).toBe('');

    wrapper.unmount();
  });

  it('closes the mobile drawer after opening a mobile quick-search result', async () => {
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
          SearchBar: buildInteractiveSearchStub(),
          NotificationDropdown: { template: '<div>Notifications</div>' },
          ThemeToggle: { template: '<button data-test="theme-toggle-stub">Theme</button>' },
          Avatar: { template: '<div>Avatar</div>' },
          ScopeIcon: { template: '<span class="icon-stub" />' },
          Transition: false,
        },
      },
    });

    await wrapper.get('[data-test="mobile-menu-toggle"]').trigger('click');
    await flushPromises();

    const searchInputs = wrapper.findAll('[data-test="search-input"]');
    const searchTriggers = wrapper.findAll('[data-test="search-trigger"]');
    await searchInputs.at(-1)!.setValue('mobile cafe');
    await searchTriggers.at(-1)!.trigger('click');
    await flushPromises();

    const resultButtons = wrapper.findAll('[data-test="quick-search-result"]');
    await resultButtons.at(-1)!.trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe('/spots/sunset-rooftop-tacos-fort-worth');
    expect(wrapper.find('[data-test="mobile-drawer"]').exists()).toBe(false);
    expect(document.body.style.overflow).toBe('');

    wrapper.unmount();
  });

  it('exercises exposed navbar helper guards and keyboard fallbacks', async () => {
    authStoreMock.isAuthenticated = true;
    authStoreMock.currentUser = {
      id: 'user-1',
      username: 'LOUISDO',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      avatarUrl: 'https://images.example.com/avatar.jpg',
      stats: { trips: 2 },
    };

    const router = buildRouter();
    await router.push('/?q=coffee');
    await router.isReady();

    const wrapper = mount(Navbar, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          SearchBar: buildInteractiveSearchStub(),
          NotificationDropdown: { template: '<div>Notifications</div>' },
          ThemeToggle: { template: '<button data-test="theme-toggle-stub">Theme</button>' },
          Avatar: { template: '<div>Avatar</div>' },
          ScopeIcon: { template: '<span class="icon-stub" />' },
          Transition: false,
        },
      },
    });
    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;

    expect(coverage.formatProfileHandle(' LOUISDO ')).toBe('@louisdo');
    expect(coverage.formatQuickSearchResultMeta({
      id: 'meta',
      name: 'Meta Stop',
      category: '',
      tags: ['  '],
      avg_rating: 0,
      review_count: 0,
    })).toBe('Scope Trips spot');

    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      writable: true,
      value: 64,
    });
    coverage.updateScrollState();
    await wrapper.vm.$nextTick();
    expect(wrapper.get('.navbar').classes()).toContain('navbar--scrolled');

    coverage.handleQuickSearchFocus();
    await coverage.handleSearch('coverage cafe');
    await flushPromises();
    expect(wrapper.get('[data-test="quick-search-dropdown"]').text()).toContain('Sunset Rooftop Tacos');

    await coverage.openFeatureMenu('first');
    await coverage.openFeatureMenu('last');
    wrapper.get('.feature-menu-dropdown').element.focus();
    coverage.moveFeatureMenuFocus(1);
    expect(document.activeElement).toBe(wrapper.get('.feature-menu-dropdown').findAll('[role="menuitem"]').at(0)?.element);
    wrapper.get('.feature-menu-dropdown').element.focus();
    coverage.moveFeatureMenuFocus(-1);
    expect(document.activeElement).toBe(wrapper.get('.feature-menu-dropdown').findAll('[role="menuitem"]').at(-1)?.element);
    coverage.handleFeatureMenuKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    coverage.handleFeatureMenuKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    coverage.handleFeatureMenuKeydown(new KeyboardEvent('keydown', { key: 'Home' }));
    coverage.handleFeatureMenuKeydown(new KeyboardEvent('keydown', { key: 'End' }));
    const featureUnknownKey = new KeyboardEvent('keydown', { key: 'PageDown', cancelable: true });
    coverage.handleFeatureMenuKeydown(featureUnknownKey);
    expect(featureUnknownKey.defaultPrevented).toBe(false);
    coverage.handleFeatureMenuButtonKeydown(new KeyboardEvent('keydown', { key: ' ' }));
    coverage.handleFeatureMenuFocusOut(new FocusEvent('focusout', { relatedTarget: document.body }));

    await coverage.openMenu('first');
    await coverage.openMenu('last');
    wrapper.get('.menu-dropdown').element.focus();
    coverage.moveMenuFocus(1);
    expect(document.activeElement).toBe(wrapper.get('.menu-dropdown').findAll('[role="menuitem"]').at(0)?.element);
    wrapper.get('.menu-dropdown').element.focus();
    coverage.moveMenuFocus(-1);
    expect(document.activeElement).toBe(wrapper.get('.menu-dropdown').findAll('[role="menuitem"]').at(-1)?.element);
    coverage.handleMenuKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    coverage.handleMenuKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    coverage.handleMenuKeydown(new KeyboardEvent('keydown', { key: 'Home' }));
    coverage.handleMenuKeydown(new KeyboardEvent('keydown', { key: 'End' }));
    const menuUnknownKey = new KeyboardEvent('keydown', { key: 'PageDown', cancelable: true });
    coverage.handleMenuKeydown(menuUnknownKey);
    expect(menuUnknownKey.defaultPrevented).toBe(false);
    coverage.handleMenuButtonKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
    coverage.handleMenuFocusOut(new FocusEvent('focusout', { relatedTarget: document.body }));

    await coverage.openMobileMenu('panel');
    await coverage.openMobileMenu('first');
    await coverage.openMobileMenu('last');
    coverage.handleMobileDrawerKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    coverage.handleMobileDrawerKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    coverage.handleMobileDrawerKeydown(new KeyboardEvent('keydown', { key: 'Home' }));
    coverage.handleMobileDrawerKeydown(new KeyboardEvent('keydown', { key: 'End' }));
    coverage.handleMobileDrawerKeydown(new KeyboardEvent('keydown', { key: 'Tab' }));
    coverage.handleMobileDrawerKeydown(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));

    const ignoredGlobalKey = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    coverage.handleGlobalMenuKeydown(ignoredGlobalKey);
    expect(ignoredGlobalKey.defaultPrevented).toBe(false);

    const mobileEscape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    coverage.handleGlobalMenuKeydown(mobileEscape);
    expect(mobileEscape.defaultPrevented).toBe(true);

    await coverage.openFeatureMenu('first');
    const featureEscape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    coverage.handleGlobalMenuKeydown(featureEscape);
    expect(featureEscape.defaultPrevented).toBe(true);

    await coverage.openMenu('first');
    const profileEscape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    coverage.handleGlobalMenuKeydown(profileEscape);
    expect(profileEscape.defaultPrevented).toBe(true);

    document.body.style.overflow = 'auto';
    coverage.setMobileScrollLock(true);
    coverage.setMobileScrollLock(true);
    expect(document.body.style.overflow).toBe('hidden');
    coverage.setMobileScrollLock(false);
    expect(document.body.style.overflow).toBe('auto');
    document.body.style.overflow = '';

    await coverage.handleSearch('   ');
    await flushPromises();
    expect(loadSearchPlaceRecommendationsMock).toHaveBeenCalled();

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1400,
    });
    coverage.handleViewportResize();
    await flushPromises();

    expect(wrapper.find('[data-test="mobile-drawer"]').exists()).toBe(false);

    await coverage.openQuickSearchResult({
      id: 'spot helper',
      name: 'Helper Spot',
      category: 'food',
      tags: [],
      avg_rating: 4.8,
      review_count: 1,
    });
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/spots/helper-spot');

    wrapper.unmount();
  });

  it('covers guest quick-search recommendations, stale requests, and closed-menu keyboard guards', async () => {
    authStoreMock.isAuthenticated = false;
    authStoreMock.currentUser = null;
    loadSearchPlaceRecommendationsMock
      .mockRejectedValueOnce(new Error('recommendation outage'))
      .mockResolvedValueOnce([
        {
          id: 'guest-rec-1',
          title: 'Guest Garden Walk',
          description: 'A quiet first-stop recommendation.',
          latitude: 32.741,
          longitude: -97.35,
          category: 'nature',
          city: 'Fort Worth',
          country: 'US',
          rating: 4.9,
          createdAt: '2026-03-24T14:10:00Z',
          likesCount: 9,
          vibe: 'calm',
          recommendationReason: 'Good guest-mode starter place',
          searchSuggestionSource: 'recommendation',
        },
      ]);

    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    const wrapper = mount(Navbar, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          SearchBar: buildInteractiveSearchStub(),
          NotificationDropdown: { template: '<div>Notifications</div>' },
          ThemeToggle: { template: '<button data-test="theme-toggle-stub">Theme</button>' },
          Avatar: { template: '<div>Avatar</div>' },
          ScopeIcon: { template: '<span class="icon-stub" />' },
          Transition: false,
        },
      },
    });
    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;

    expect(coverage.formatQuickSearchResultMeta({
      id: 'recommendation-meta',
      title: 'Recommendation Meta',
      category: 'Cafe',
      city: 'Fort Worth',
      rating: 4.2,
      reviewCount: 1,
      likesCount: 3,
      vibe: 'bright',
      tags: ['  patio  '],
      source: 'recommendation',
    })).toBe('Cafe / Fort Worth / 4.2 rating');

    const emptyDrawerTab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    coverage.handleMobileDrawerKeydown(emptyDrawerTab);
    expect(emptyDrawerTab.defaultPrevented).toBe(true);

    await coverage.openMobileMenu('panel');
    await flushPromises();
    expect(wrapper.get('[data-test="mobile-drawer"]').text()).toContain('Welcome back to Scope');
    coverage.closeMobileMenu();

    coverage.focusFeatureMenuBoundary('first');
    coverage.focusMenuBoundary('last');
    coverage.moveFeatureMenuFocus(1);
    coverage.moveMenuFocus(-1);

    const featureArrowDown = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
    coverage.handleFeatureMenuButtonKeydown(featureArrowDown);
    expect(featureArrowDown.defaultPrevented).toBe(true);
    await flushPromises();

    const featureEscape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    coverage.handleFeatureMenuButtonKeydown(featureEscape);
    expect(featureEscape.defaultPrevented).toBe(true);
    const featureDefault = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    coverage.handleFeatureMenuButtonKeydown(featureDefault);
    expect(featureDefault.defaultPrevented).toBe(false);

    const menuArrowUp = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true });
    coverage.handleMenuButtonKeydown(menuArrowUp);
    expect(menuArrowUp.defaultPrevented).toBe(true);
    await flushPromises();

    const menuEscape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    coverage.handleMenuButtonKeydown(menuEscape);
    expect(menuEscape.defaultPrevented).toBe(true);
    const menuDefault = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    coverage.handleMenuButtonKeydown(menuDefault);
    expect(menuDefault.defaultPrevented).toBe(false);

    coverage.toggleFeatureMenu();
    await flushPromises();
    coverage.toggleFeatureMenu();
    coverage.toggleMenu();
    await flushPromises();
    coverage.toggleMenu();
    coverage.toggleMobileMenu();
    await flushPromises();
    coverage.toggleMobileMenu();
    await flushPromises();

    const drawerEscape = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    coverage.handleMobileDrawerKeydown(drawerEscape);
    expect(drawerEscape.defaultPrevented).toBe(true);
    const drawerDefault = new KeyboardEvent('keydown', { key: 'PageDown', cancelable: true });
    coverage.handleMobileDrawerKeydown(drawerDefault);
    expect(drawerDefault.defaultPrevented).toBe(false);

    await coverage.handleSearch('   ');
    await flushPromises();
    expect(wrapper.get('[data-test="quick-search-dropdown"]').text()).toContain('temporarily unavailable');
    await coverage.handleSearch('   ');
    await flushPromises();
    expect(wrapper.get('[data-test="quick-search-dropdown"]').text()).toContain('Guest Garden Walk');
    await coverage.handleSearch('   ');
    await flushPromises();
    expect(loadSearchPlaceRecommendationsMock).toHaveBeenCalledTimes(2);

    await coverage.openQuickSearchResult({
      id: 'guest-rec-1',
      title: 'Guest Garden Walk',
      source: 'recommendation',
    });
    await flushPromises();
    expect(recordSearchPlaceSuggestionClickMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'guest-rec-1' }));
    expect(router.currentRoute.value.fullPath).toBe('/spots/guest-garden-walk');

    await coverage.openQuickSearchResult({
      id: '   ',
      title: 'Blank',
      source: 'search',
    });
    await flushPromises();

    type DeferredSearch = {
      promise: Promise<{
        query: string;
        type: string;
        total: number;
        offset: number;
        limit: number;
        results: Array<{
          id: string;
          name: string;
          description: string;
          category: string;
          tags: string[];
          avg_rating: number;
          review_count: number;
          _score: number;
        }>;
      }>;
      resolve: (value: Awaited<DeferredSearch['promise']>) => void;
      reject: (reason?: unknown) => void;
    };
    const createDeferredSearch = (): DeferredSearch => {
      let resolve!: DeferredSearch['resolve'];
      let reject!: DeferredSearch['reject'];
      const promise = new Promise<Awaited<DeferredSearch['promise']>>((innerResolve, innerReject) => {
        resolve = innerResolve;
        reject = innerReject;
      });
      return { promise, resolve, reject };
    };

    const staleSuccess = createDeferredSearch();
    searchContentMock
      .mockImplementationOnce(() => staleSuccess.promise)
      .mockResolvedValueOnce({
        query: 'fresh',
        type: 'spots',
        total: 0,
        offset: 0,
        limit: 6,
        results: [],
      });
    const firstSearch = coverage.handleSearch('stale success');
    const secondSearch = coverage.handleSearch('fresh success');
    staleSuccess.resolve({
      query: 'stale',
      type: 'spots',
      total: 1,
      offset: 0,
      limit: 6,
      results: [
        {
          id: 'stale',
          name: 'Stale Result',
          description: 'Should be ignored.',
          category: 'food',
          tags: [],
          avg_rating: 4,
          review_count: 1,
          _score: 1,
        },
      ],
    });
    await Promise.all([firstSearch, secondSearch]);
    await flushPromises();
    expect(wrapper.find('[data-test="quick-search-result"]').exists()).toBe(false);

    const staleFailure = createDeferredSearch();
    searchContentMock
      .mockImplementationOnce(() => staleFailure.promise)
      .mockResolvedValueOnce({
        query: 'fresh',
        type: 'spots',
        total: 0,
        offset: 0,
        limit: 6,
        results: [],
      });
    const failedSearch = coverage.handleSearch('stale failure');
    const freshSearch = coverage.handleSearch('fresh failure');
    staleFailure.reject(new Error('stale failure'));
    await Promise.all([failedSearch, freshSearch]);
    await flushPromises();
    expect(wrapper.find('[data-test="quick-search-dropdown"]').text()).not.toContain('could not load');

    wrapper.unmount();
  });

  it('renders mobile recommendation loading, fallback, photo, and error states', async () => {
    authStoreMock.isAuthenticated = false;
    authStoreMock.currentUser = null;

    type DeferredRecommendations = {
      promise: Promise<any[]>;
      resolve: (value: any[]) => void;
    };
    const createDeferredRecommendations = (): DeferredRecommendations => {
      let resolve!: DeferredRecommendations['resolve'];
      const promise = new Promise<any[]>((innerResolve) => {
        resolve = innerResolve;
      });
      return { promise, resolve };
    };

    const deferredRecommendations = createDeferredRecommendations();
    loadSearchPlaceRecommendationsMock.mockReturnValueOnce(deferredRecommendations.promise);

    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    const wrapper = mount(Navbar, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          SearchBar: buildInteractiveSearchStub(),
          ThemeToggle: { template: '<button data-test="theme-toggle-stub">Theme</button>' },
          ScopeIcon: { template: '<span class="icon-stub" />' },
          Transition: false,
        },
      },
    });

    await wrapper.get('[data-test="mobile-menu-toggle"]').trigger('click');
    await flushPromises();

    const mobileSearchInput = wrapper.findAll('[data-test="search-input"]').at(-1)!;
    await mobileSearchInput.trigger('focusin');
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-test="quick-search-dropdown"]').text()).toContain('Loading recommended places...');

    deferredRecommendations.resolve([
      {
        id: 'mobile-photo-rec',
        title: 'Mobile Garden Cafe',
        description: 'Coffee by the conservatory.',
        latitude: 32.74,
        longitude: -97.34,
        category: 'food',
        city: 'Fort Worth',
        country: 'US',
        rating: 4.8,
        photoUrl: 'https://images.example.com/mobile-garden-cafe.jpg',
        createdAt: '2026-03-24T14:10:00Z',
        searchSuggestionSource: 'recommendation',
      },
      {
        id: 'mobile-icon-rec',
        title: 'Mobile Quiet Plaza',
        latitude: 32.75,
        longitude: -97.35,
        category: 'scenic',
        createdAt: '2026-03-24T14:10:00Z',
        searchSuggestionSource: 'recommendation',
      },
    ]);
    await flushPromises();
    await wrapper.vm.$nextTick();

    const dropdown = wrapper.get('[data-test="quick-search-dropdown"]');
    expect(dropdown.text()).toContain('Recommended for you');
    expect(dropdown.text()).toContain('2 places');
    expect(dropdown.text()).toContain('Mobile Garden Cafe');
    expect(dropdown.text()).toContain('Mobile Quiet Plaza');
    expect(dropdown.text()).toContain('Strong signal from current Scope Trips places.');
    expect(wrapper.get('[data-test="quick-search-recommendation-photo"]').attributes('src')).toBe(
      'https://images.example.com/mobile-garden-cafe.jpg',
    );

    await wrapper.findAll('[data-test="quick-search-recommendation"]').at(-1)!.trigger('click');
    await flushPromises();
    expect(recordSearchPlaceSuggestionClickMock).toHaveBeenCalledWith(expect.objectContaining({
      id: 'mobile-icon-rec',
      searchSuggestionSource: 'recommendation',
    }));
    expect(router.currentRoute.value.fullPath).toBe('/spots/mobile-quiet-plaza');
    expect(wrapper.find('[data-test="mobile-drawer"]').exists()).toBe(false);

    wrapper.unmount();

    loadSearchPlaceRecommendationsMock.mockRejectedValueOnce(new Error('recommendation outage'));
    const errorRouter = buildRouter();
    await errorRouter.push('/');
    await errorRouter.isReady();

    const errorWrapper = mount(Navbar, {
      attachTo: document.body,
      global: {
        plugins: [errorRouter],
        stubs: {
          SearchBar: buildInteractiveSearchStub(),
          ThemeToggle: { template: '<button data-test="theme-toggle-stub">Theme</button>' },
          ScopeIcon: { template: '<span class="icon-stub" />' },
          Transition: false,
        },
      },
    });

    await errorWrapper.get('[data-test="mobile-menu-toggle"]').trigger('click');
    await flushPromises();
    await errorWrapper.findAll('[data-test="search-input"]').at(-1)!.trigger('focusin');
    await flushPromises();

    expect(errorWrapper.get('[data-test="quick-search-dropdown"]').text()).toContain(
      'Recommended places are temporarily unavailable.',
    );

    errorWrapper.unmount();
  });

  it('covers navbar helper edge cases for fallback profile and lean quick-search data', async () => {
    authStoreMock.isAuthenticated = true;
    authStoreMock.currentUser = {
      id: 'user-lean',
      displayName: 'Lean Traveler',
      avatarUrl: '',
    };

    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    const wrapper = mount(Navbar, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          SearchBar: buildInteractiveSearchStub(),
          NotificationDropdown: { template: '<div>Notifications</div>' },
          ThemeToggle: { template: '<button data-test="theme-toggle-stub">Theme</button>' },
          Avatar: { template: '<div>Avatar</div>' },
          ScopeIcon: { template: '<span class="icon-stub" />' },
          Transition: false,
        },
      },
    });
    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;

    expect(wrapper.get('.profile-chip__copy small').text()).toBe('Traveler profile');

    expect(coverage.formatQuickSearchResultMeta({
      id: 'rich-meta',
      name: 'Rich Meta',
      category: 'food',
      tags: ['food', 'Dallas', 'US', 'late-night'],
      city: 'Dallas',
      country: 'US',
      avg_rating: 4.6,
      review_count: 14,
    })).toBe('food / Dallas, US / 4.6 rating');

    expect(coverage.mapSearchResultToQuickPlace({
      id: ' minimal-search ',
      name: 'Minimal Search',
    })).toEqual({
      id: 'minimal-search',
      title: 'Minimal Search',
      source: 'search',
    });

    expect(coverage.mapSuggestionToQuickPlace({
      id: 'minimal-suggestion',
      title: 'Minimal Suggestion',
      latitude: 1,
      longitude: 2,
      category: 'scenic',
      rating: 0,
      createdAt: '2026-03-24T14:10:00Z',
      searchSuggestionSource: 'trending',
    })).toEqual({
      id: 'minimal-suggestion',
      title: 'Minimal Suggestion',
      category: 'scenic',
      rating: 0,
      source: 'trending',
    });

    expect(coverage.scoreQuickSearchPlace({
      id: 'contains-title',
      title: 'Riverwalk',
      source: 'search',
    }, ['walk'])).toBe(6);
    expect(coverage.scoreQuickSearchPlace({
      id: 'short-miss',
      title: 'Museum',
      city: 'Dallas',
      country: 'US',
      source: 'search',
    }, ['zz'])).toBe(0);
    expect(coverage.scoreQuickSearchPlace({
      id: 'no-rating',
      title: 'Mismatch',
      source: 'search',
    }, ['zz'])).toBe(0);

    const minimalMerge = coverage.mergeQuickSearchPlace(
      { id: 'minimal', title: 'Minimal', source: 'search' },
      { id: 'minimal', title: 'Minimal', source: 'recommendation' },
    );
    expect(minimalMerge).toEqual({ id: 'minimal', title: 'Minimal', source: 'search' });
    expect(coverage.mergeQuickSearchPlaces([
      { id: 'new-search', title: 'New Place', source: 'search' },
      { id: 'new-rec', title: 'Recommended Place', source: 'recommendation' },
    ])).toHaveLength(2);
    expect(coverage.buildQuickSearchPlaceKeys({ id: 'blank-title', title: '   ', source: 'search' })).toEqual([
      'id:blank-title',
    ]);

    await coverage.openQuickSearchResult({
      id: 'unknown-rec',
      title: 'Unknown Rec',
      source: 'recommendation',
    });
    await flushPromises();
    expect(recordSearchPlaceSuggestionClickMock).not.toHaveBeenCalled();
    expect(router.currentRoute.value.fullPath).toBe('/spots/unknown-rec');

    await coverage.openMobileMenu('panel');
    await flushPromises();
    const mobileDrawer = wrapper.get('[data-test="mobile-drawer"]');
    const drawerShiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true });
    mobileDrawer.element.focus();
    coverage.handleMobileDrawerKeydown(drawerShiftTab);
    expect(drawerShiftTab.defaultPrevented).toBe(true);

    wrapper.unmount();
  });

  it('renders lean mobile search fallbacks for query errors and empty matches', async () => {
    authStoreMock.isAuthenticated = false;
    authStoreMock.currentUser = null;
    searchContentMock.mockRejectedValueOnce(new Error('search outage')).mockResolvedValueOnce({
      query: 'nomatch',
      type: 'spots',
      total: 0,
      offset: 0,
      limit: 6,
      results: [],
    });
    loadSearchPlaceRecommendationsMock.mockResolvedValue([
      {
        id: 'mobile-query-rec',
        title: 'Mobile Query Rec',
        description: '',
        latitude: 32.74,
        longitude: -97.34,
        category: 'food',
        rating: 4.5,
        createdAt: '2026-03-24T14:10:00Z',
        searchSuggestionSource: 'recommendation',
      },
    ]);

    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    const wrapper = mount(Navbar, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          SearchBar: buildInteractiveSearchStub(),
          ThemeToggle: { template: '<button data-test="theme-toggle-stub">Theme</button>' },
          ScopeIcon: { template: '<span class="icon-stub" />' },
          Transition: false,
        },
      },
    });
    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;

    await coverage.openMobileMenu('panel');
    await flushPromises();

    const mobileSearchInput = wrapper.findAll('[data-test="search-input"]').at(-1)!;
    await mobileSearchInput.setValue('query failure');
    await coverage.handleSearch('query failure');
    await flushPromises();

    expect(wrapper.get('[data-test="quick-search-dropdown"]').text()).toContain(
      'Scope Trips could not load quick search right now.',
    );

    await mobileSearchInput.setValue('nomatch');
    await coverage.handleSearch('nomatch');
    await flushPromises();

    const dropdown = wrapper.get('[data-test="quick-search-dropdown"]');
    expect(dropdown.text()).toContain('No quick matches yet.');

    wrapper.unmount();
  });

  it('ranks and merges quick-search places without losing provider metadata', async () => {
    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    const wrapper = mount(Navbar, {
      global: {
        plugins: [router],
        stubs: {
          SearchBar: buildInteractiveSearchStub(),
          NotificationDropdown: { template: '<div>Notifications</div>' },
          ThemeToggle: { template: '<button data-test="theme-toggle-stub">Theme</button>' },
          Avatar: { template: '<div>Avatar</div>' },
          ScopeIcon: { template: '<span class="icon-stub" />' },
          Transition: false,
        },
      },
    });
    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    const searchResult = {
      id: ' search-place ',
      name: 'Fort Worth Coffee',
      description: 'Quiet patio and breakfast.',
      category: 'food',
      tags: ['coffee', 'patio'],
      photoUrl: '',
      photo_url: 'https://images.example.com/coffee.jpg',
      avg_rating: 4.8,
      review_count: 17,
      city: 'Fort Worth',
      country: 'US',
      vibe: 'calm',
      _score: 10,
    };
    const recommendation = {
      id: 'recommended-place',
      title: 'Museum Walk',
      description: 'A compact culture stop.',
      latitude: 32.75,
      longitude: -97.33,
      category: 'culture',
      city: 'Fort Worth',
      country: 'US',
      rating: 4.7,
      photoUrl: 'https://images.example.com/museum.jpg',
      likesCount: 22,
      vibe: 'curious',
      recommendationReason: 'Matches your saved galleries.',
      searchSuggestionSource: 'recommendation',
    };

    expect(coverage.mapSearchResultToQuickPlace(searchResult)).toMatchObject({
      id: 'search-place',
      title: 'Fort Worth Coffee',
      description: 'Quiet patio and breakfast.',
      category: 'food',
      tags: ['coffee', 'patio'],
      photoUrl: 'https://images.example.com/coffee.jpg',
      rating: 4.8,
      reviewCount: 17,
      city: 'Fort Worth',
      country: 'US',
      vibe: 'calm',
      source: 'search',
    });
    expect(coverage.mapSuggestionToQuickPlace(recommendation)).toMatchObject({
      id: 'recommended-place',
      title: 'Museum Walk',
      likesCount: 22,
      recommendationReason: 'Matches your saved galleries.',
      source: 'recommendation',
    });
    expect(coverage.normalizeQuickSearchTarget(searchResult).id).toBe('search-place');
    expect(coverage.normalizeQuickSearchTarget(recommendation)).toBe(recommendation);
    expect(coverage.normalizeQuickSearchText('  MIXED Case  ')).toBe('mixed case');
    expect(coverage.tokenizeQuickSearchQuery(' Fort   Worth ')).toEqual(['fort', 'worth']);
    expect(coverage.isShortQuickSearchQuery(['ft'])).toBe(true);
    expect(coverage.isShortQuickSearchQuery(['museum'])).toBe(false);
    expect(coverage.quickSearchTextHasTokenPrefix('fort worth texas', 'wor')).toBe(true);

    const searchablePlace = coverage.mapSearchResultToQuickPlace(searchResult);
    expect(coverage.getQuickSearchHaystack(searchablePlace)).toContain('quiet patio');
    expect(coverage.getQuickSearchHaystack(searchablePlace, { includeDescription: false })).not.toContain('quiet patio');
    expect(coverage.matchesQuickSearchPlace(searchablePlace, [])).toBe(false);
    expect(coverage.matchesQuickSearchPlace(searchablePlace, ['ft'])).toBe(false);
    expect(coverage.matchesQuickSearchPlace(searchablePlace, ['for'])).toBe(true);
    expect(coverage.matchesQuickSearchPlace(searchablePlace, ['quiet', 'breakfast'])).toBe(true);

    expect(coverage.scoreQuickSearchPlace({ ...searchablePlace, title: 'coffee' }, ['coffee'])).toBeGreaterThan(12);
    expect(coverage.scoreQuickSearchPlace(searchablePlace, ['fort'])).toBeGreaterThan(8);
    expect(coverage.scoreQuickSearchPlace(searchablePlace, ['worth'])).toBeGreaterThan(4);
    expect(coverage.scoreQuickSearchPlace(searchablePlace, ['patio'])).toBeGreaterThan(0);
    expect(coverage.scoreQuickSearchPlace(searchablePlace, ['us'])).toBeGreaterThan(0);
    expect(coverage.scoreQuickSearchPlace({ ...searchablePlace, title: 'Museum', city: '', country: '', tags: ['quiet'] }, ['qu'])).toBeGreaterThan(4.8);
    expect(coverage.scoreQuickSearchPlace({ ...searchablePlace, title: 'Museum', city: '', country: '', tags: [] }, ['zz'])).toBe(4.8);

    const merged = coverage.mergeQuickSearchPlace(
      { id: 'shared', title: 'Shared Place', source: 'search' },
      {
        id: 'shared',
        title: 'Shared Place',
        description: 'Provider description',
        category: 'culture',
        tags: ['gallery'],
        photoUrl: 'https://images.example.com/shared.jpg',
        rating: 4.9,
        reviewCount: 31,
        likesCount: 40,
        city: 'Dallas',
        country: 'US',
        vibe: 'creative',
        recommendationReason: 'Strong match',
        source: 'recommendation',
      },
    );
    expect(merged).toMatchObject({
      description: 'Provider description',
      category: 'culture',
      tags: ['gallery'],
      photoUrl: 'https://images.example.com/shared.jpg',
      rating: 4.9,
      reviewCount: 31,
      likesCount: 40,
      city: 'Dallas',
      country: 'US',
      vibe: 'creative',
      recommendationReason: 'Strong match',
    });
    expect(coverage.buildQuickSearchPlaceKeys(merged)).toEqual([
      'id:shared',
      'title:shared place|dallas|us',
    ]);

    const mergedPlaces = coverage.mergeQuickSearchPlaces([
      { id: 'shared', title: 'Shared Place', source: 'search' },
      { ...merged, id: 'shared' },
      { ...merged, id: 'alternate-id' },
      { id: 'unique', title: 'Unique Place', source: 'search' },
    ]);
    expect(mergedPlaces).toHaveLength(2);
    expect(mergedPlaces[0]).toMatchObject({
      id: 'shared',
      description: 'Provider description',
      recommendationReason: 'Strong match',
    });

    wrapper.unmount();
  });

  it('keeps recommendation search, default menu opens, and browser-global fallbacks stable', async () => {
    authStoreMock.isAuthenticated = false;
    authStoreMock.currentUser = null;
    searchContentMock.mockResolvedValue({
      query: 'river',
      type: 'spots',
      total: 0,
      offset: 0,
      limit: 6,
      results: [],
    });
    loadSearchPlaceRecommendationsMock.mockResolvedValue([
      {
        id: 'river-rec',
        title: 'River Garden Walk',
        description: 'Quiet river trail with flowers.',
        latitude: 32.749,
        longitude: -97.363,
        category: 'nature',
        city: 'Fort Worth',
        country: 'US',
        rating: 4.7,
        createdAt: '2026-03-24T14:10:00Z',
        searchSuggestionSource: 'recommendation',
      },
    ]);

    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    const wrapper = mount(Navbar, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          SearchBar: buildInteractiveSearchStub(),
          ThemeToggle: { template: '<button data-test="theme-toggle-stub">Theme</button>' },
          ScopeIcon: { template: '<span class="icon-stub" />' },
          Transition: false,
        },
      },
    });
    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;

    coverage.handleQuickSearchFocus();
    await flushPromises();
    await wrapper.get('[data-test="search-input"]').setValue('river');
    await coverage.handleSearch('river');
    await flushPromises();

    expect(wrapper.get('[data-test="quick-search-dropdown"]').text()).toContain('Quick search');
    expect(wrapper.get('[data-test="quick-search-dropdown"]').text()).toContain('River Garden Walk');

    await coverage.openFeatureMenu();
    await coverage.openMenu();
    expect(coverage.getFeatureMenuItems()).toEqual(expect.any(Array));
    expect(coverage.getMenuItems()).toEqual(expect.any(Array));

    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: undefined,
    });
    coverage.updateScrollState();
    coverage.handleViewportResize();
    if (windowDescriptor) {
      Object.defineProperty(globalThis, 'window', windowDescriptor);
    }

    const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: undefined,
    });
    coverage.moveFeatureMenuFocus(1);
    coverage.moveMenuFocus(-1);
    if (documentDescriptor) {
      Object.defineProperty(globalThis, 'document', documentDescriptor);
    }

    await coverage.openMobileMenu('panel');
    await flushPromises();
    const drawer = wrapper.get('[data-test="mobile-drawer"]');
    drawer.element.focus();
    const tabForward = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    coverage.focusMobileDrawerBoundary('last');
    coverage.handleMobileDrawerKeydown(tabForward);
    expect(tabForward.defaultPrevented).toBe(true);

    wrapper.unmount();
  });

  it('keeps navbar menu focus wrapping and lean quick-search state transitions stable', async () => {
    authStoreMock.isAuthenticated = true;
    authStoreMock.currentUser = {
      id: 'user-focus',
      username: '',
      email: 'focus@example.com',
      displayName: '',
      avatarUrl: '',
    };
    searchContentMock.mockResolvedValue({
      query: 'nomatch',
      type: 'spots',
      total: 0,
      offset: 0,
      limit: 6,
      results: [],
    });
    loadSearchPlaceRecommendationsMock.mockResolvedValue([
      {
        id: 'focus-rec',
        title: 'Focus Recommendation',
        description: '',
        latitude: 32.7,
        longitude: -97.3,
        category: 'food',
        rating: 4.5,
        createdAt: '2026-03-24T14:10:00Z',
        searchSuggestionSource: 'recommendation',
      },
    ]);

    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    const wrapper = mount(Navbar, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          SearchBar: buildInteractiveSearchStub(),
          NotificationDropdown: { template: '<div>Notifications</div>' },
          ThemeToggle: { template: '<button data-test="theme-toggle-stub">Theme</button>' },
          Avatar: { template: '<div>Avatar</div>' },
          ScopeIcon: { template: '<span class="icon-stub" />' },
          Transition: false,
        },
      },
    });
    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;

    expect(wrapper.get('.profile-chip').text()).toContain('focus@example.com');
    expect(coverage.formatProfileHandle('')).toBe('@');
    coverage.handleQuickSearchFocus();
    await flushPromises();
    expect(wrapper.get('[data-test="quick-search-dropdown"]').text()).toContain('Recommended for you');
    await wrapper.get('[data-test="search-input"]').setValue('focus');
    await coverage.handleSearch('focus');
    await flushPromises();
    expect(wrapper.get('[data-test="quick-search-dropdown"]').text()).toContain('Focus Recommendation');
    coverage.closeQuickSearch();

    await coverage.openFeatureMenu('last');
    await flushPromises();
    const featureMenu = wrapper.get('.feature-menu-dropdown');
    expect(document.activeElement).toBe(featureMenu.findAll('[role="menuitem"]').at(-1)?.element);
    const featureArrowDown = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
    coverage.handleFeatureMenuKeydown(featureArrowDown);
    expect(featureArrowDown.defaultPrevented).toBe(true);
    const featureArrowUp = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true });
    coverage.handleFeatureMenuKeydown(featureArrowUp);
    expect(featureArrowUp.defaultPrevented).toBe(true);

    await coverage.openMenu('last');
    await flushPromises();
    const menu = wrapper.get('.menu-dropdown');
    expect(document.activeElement).toBe(menu.findAll('[role="menuitem"]').at(-1)?.element);
    const menuArrowDown = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
    coverage.handleMenuKeydown(menuArrowDown);
    expect(menuArrowDown.defaultPrevented).toBe(true);
    const menuArrowUp = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true });
    coverage.handleMenuKeydown(menuArrowUp);
    expect(menuArrowUp.defaultPrevented).toBe(true);

    await coverage.openMobileMenu('last');
    await flushPromises();
    const mobileDrawer = wrapper.get('[data-test="mobile-drawer"]');
    const mobileBackward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true });
    coverage.focusMobileDrawerBoundary('first');
    coverage.handleMobileDrawerKeydown(mobileBackward);
    expect(mobileBackward.defaultPrevented).toBe(true);
    const mobileForward = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    coverage.focusMobileDrawerBoundary('last');
    coverage.handleMobileDrawerKeydown(mobileForward);
    expect(mobileForward.defaultPrevented).toBe(true);
    const defaultKey = new KeyboardEvent('keydown', { key: 'Home', cancelable: true });
    coverage.handleMobileDrawerKeydown(defaultKey);
    expect(defaultKey.defaultPrevented).toBe(true);
    expect(mobileDrawer.exists()).toBe(true);

    const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: undefined,
    });
    coverage.setMobileScrollLock(true);
    coverage.setMobileScrollLock(false);
    if (documentDescriptor) {
      Object.defineProperty(globalThis, 'document', documentDescriptor);
    }

    wrapper.unmount();
  });
});
