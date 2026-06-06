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
    expect(wrapper.text()).toContain('Chicago, IL');

    await wrapper.get('[data-test="notification-stub"]').trigger('click');
    expect(wrapper.get('.navbar').classes()).toContain('navbar--notifications-open');

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
      message: 'Your Scope Trips session is closed for now. Come back anytime to keep exploring.',
    });

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

    expect(router.currentRoute.value.fullPath).toBe('/spots/sunset-rooftop-tacos');
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
    coverage.handleFeatureMenuKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    coverage.handleFeatureMenuKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    coverage.handleFeatureMenuKeydown(new KeyboardEvent('keydown', { key: 'Home' }));
    coverage.handleFeatureMenuKeydown(new KeyboardEvent('keydown', { key: 'End' }));
    coverage.handleFeatureMenuButtonKeydown(new KeyboardEvent('keydown', { key: ' ' }));
    coverage.handleFeatureMenuFocusOut(new FocusEvent('focusout', { relatedTarget: document.body }));

    await coverage.openMenu('first');
    await coverage.openMenu('last');
    coverage.handleMenuKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    coverage.handleMenuKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    coverage.handleMenuKeydown(new KeyboardEvent('keydown', { key: 'Home' }));
    coverage.handleMenuKeydown(new KeyboardEvent('keydown', { key: 'End' }));
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
    })).toBe('Cafe / Fort Worth / 4.2 rating / 1 review / 3 saves / bright /   patio  ');

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
});
