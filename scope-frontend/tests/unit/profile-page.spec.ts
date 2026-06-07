import { flushPromises, mount } from '@vue/test-utils';
import { nextTick, type Component } from 'vue';

const ORIGINAL_INNER_WIDTH = window.innerWidth;

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

const { fixtures, routeMock, routeController, authStoreMock, userStoreMock, listUserSpotsMock, listSavedSpotsMock, listPublicTripsMock } = vi.hoisted(() => ({
  fixtures: {
    profile: {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      homeBase: 'Fort Worth, TX',
      interests: ['food', 'culture'],
    },
    spots: [
      {
        id: 'spot-1',
        title: 'Sunset Rooftop Tacos',
        category: 'food',
        city: 'Fort Worth',
        country: 'US',
        latitude: 32.7555,
        longitude: -97.3308,
        rating: 4.8,
        createdAt: '2026-03-29T03:00:00Z',
      },
      {
        id: 'spot-2',
        title: 'Design District Gallery Row',
        category: 'culture',
        city: 'Dallas',
        country: 'US',
        latitude: 32.7821,
        longitude: -96.8123,
        rating: 4.7,
        createdAt: '2026-03-28T03:00:00Z',
      },
    ],
    savedSpots: [
      {
        id: 'saved-1',
        title: 'Klyde Warren Garden Brunch',
        category: 'food',
        city: 'Dallas',
        country: 'US',
        latitude: 32.7894,
        longitude: -96.8019,
        rating: 4.5,
        createdAt: '2026-03-30T03:00:00Z',
      },
      {
        id: 'saved-2',
        title: 'Lady Bird Skyline Boardwalk',
        category: 'scenic',
        city: 'Austin',
        country: 'US',
        latitude: 30.2592,
        longitude: -97.7397,
        rating: 4.7,
        createdAt: '2026-03-27T03:00:00Z',
      },
    ],
    trips: [
      {
        id: 'trip-1',
        title: 'North Texas Night + Food Loop',
        destination: 'Fort Worth, TX',
        startDate: '2026-03-29',
        endDate: '2026-03-30',
        isPublic: true,
        members: [{ id: 'user-1' }, { id: 'user-2' }],
        spots: [],
      },
    ],
  },
  routeMock: {
    params: {
      id: 'user-1' as string | undefined,
    },
  },
  routeController: {
    current: null as null | { params: { id?: string } },
  },
  authStoreMock: {
    currentUser: {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      interests: ['food', 'culture'],
    },
  },
  userStoreMock: {
    fetchCurrentProfile: vi.fn(),
    fetchProfile: vi.fn(),
  },
  listUserSpotsMock: vi.fn(),
  listSavedSpotsMock: vi.fn(),
  listPublicTripsMock: vi.fn(),
}));

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router');
  const { reactive } = await vi.importActual<typeof import('vue')>('vue');
  const routeState = reactive(routeMock);
  routeController.current = routeState;

  return {
    ...actual,
    useRoute: () => routeState,
  };
});

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

vi.mock('@/stores/user', () => ({
  useUserStore: () => userStoreMock,
}));

vi.mock('@/services/spotService', () => ({
  listSavedSpots: listSavedSpotsMock,
  listUserSpots: listUserSpotsMock,
}));

vi.mock('@/services/tripService', () => ({
  listPublicTrips: listPublicTripsMock,
}));

import ProfilePage from '@/views/ProfilePage.vue';

function profilePageStubs() {
  return {
    AppShell: { template: '<div><slot /></div>' },
    RouterLink: { template: '<a><slot /></a>' },
    SectionHeading: {
      props: ['eyebrow', 'title', 'description'],
      template: '<div data-test="section-heading">{{ title }} {{ description }}</div>',
    },
    ProfileHeader: {
      props: ['user', 'isCurrentUser', 'presence', 'primaryActionLabel', 'primaryActionTo', 'secondaryActionLabel', 'secondaryActionTo'],
      template: `
        <div data-test="profile-header">
          <span>{{ user.displayName }}</span>
          <span data-test="profile-current-user">{{ isCurrentUser ? 'current' : 'other' }}</span>
          <span data-test="profile-primary-action">{{ primaryActionLabel }} {{ typeof primaryActionTo === 'string' ? primaryActionTo : primaryActionTo.path }}</span>
          <span data-test="profile-secondary-action">{{ secondaryActionLabel }} {{ secondaryActionTo }}</span>
          <span data-test="profile-presence">{{ presence && presence.status ? presence.status : 'none' }}</span>
        </div>
      `,
    },
    ProfileStats: {
      props: ['countryCount', 'cityCount', 'tripCount', 'travelDays', 'publicSpotCount', 'averageRating', 'favoriteCategory', 'focusLabel', 'focusCategory'],
      template: `
        <div data-test="profile-stats">
          countries:{{ countryCount }}
          cities:{{ cityCount }}
          trips:{{ tripCount }}
          days:{{ travelDays }}
          pins:{{ publicSpotCount }}
          rating:{{ averageRating }}
          favorite:{{ favoriteCategory || 'none' }}
          focus:{{ focusLabel || 'none' }}
          focus-category:{{ focusCategory || 'none' }}
        </div>
      `,
    },
    ProfileMap: {
      props: ['title', 'description', 'visitedSpots', 'pinnedSpots', 'wishlistSpots', 'showWishlist'],
      template: `
        <div data-test="profile-map">
          {{ title }} - {{ description }}
          visited:{{ visitedSpots ? visitedSpots.length : 0 }}
          pinned:{{ pinnedSpots ? pinnedSpots.length : 0 }}
          wishlist:{{ showWishlist && wishlistSpots ? wishlistSpots.length : 0 }}
        </div>
      `,
    },
    ProfileAdventureCard: { props: ['trip'], template: '<div class="trip-card-stub">{{ trip.title }}</div>' },
    SpotCard: { props: ['spot'], template: '<div class="spot-card-stub">{{ spot.title }}</div>' },
  };
}

function mountProfilePage(component: Component = ProfilePage) {
  return mount(component, {
    global: {
      stubs: profilePageStubs(),
    },
  });
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

describe('ProfilePage', () => {
  beforeEach(() => {
    setViewportWidth(1280);
    routeMock.params = { id: 'user-1' };
    if (routeController.current) {
      routeController.current.params = { id: 'user-1' };
    }
    window.history.pushState({}, '', '/profile/user-1');
    authStoreMock.currentUser = {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      interests: ['food', 'culture'],
    };
    userStoreMock.fetchCurrentProfile.mockReset().mockResolvedValue(fixtures.profile);
    userStoreMock.fetchProfile.mockReset().mockResolvedValue(fixtures.profile);
    listUserSpotsMock.mockReset().mockResolvedValue({
      data: fixtures.spots,
    });
    listSavedSpotsMock.mockReset().mockResolvedValue({
      data: [...fixtures.savedSpots, fixtures.spots[0]],
    });
    listPublicTripsMock.mockReset().mockResolvedValue({
      data: fixtures.trips,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders the redesigned profile workspace with footprint, adventures, and pinboard content', async () => {
    const wrapper = mount(ProfilePage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          RouterLink: { template: '<a><slot /></a>' },
          ProfileHeader: { props: ['user'], template: '<div data-test="profile-header">{{ user.displayName }}</div>' },
          ProfileStats: { props: ['countryCount'], template: '<div data-test="profile-stats">{{ countryCount }}</div>' },
          ProfileMap: {
            props: ['title', 'description', 'visitedSpots', 'pinnedSpots', 'wishlistSpots', 'showWishlist'],
            template: '<div data-test="profile-map">{{ title }} - {{ description }} visited:{{ visitedSpots ? visitedSpots.length : 0 }} pinned:{{ pinnedSpots ? pinnedSpots.length : 0 }} wishlist:{{ showWishlist && wishlistSpots ? wishlistSpots.length : 0 }}</div>',
          },
          ProfileAdventureCard: { props: ['trip'], template: '<div class="trip-card-stub">{{ trip.title }}</div>' },
          SpotCard: { props: ['spot'], template: '<div class="spot-card-stub">{{ spot.title }}</div>' },
        },
      },
    });

    await flushPromises();

    expect(userStoreMock.fetchCurrentProfile).toHaveBeenCalledTimes(1);
    expect(listUserSpotsMock).toHaveBeenCalledWith('user-1', 1, 9);
    expect(listPublicTripsMock).toHaveBeenCalledWith(1, 12);
    expect(wrapper.text()).toContain('Louis Do');
    expect(wrapper.text()).toContain("Louis Do's Scope Map");
    expect(wrapper.text()).toContain('Recent adventures');
    expect(wrapper.text()).toContain('Recent routes, balanced with pins and saves.');
    expect(wrapper.text()).toContain('North Texas Night + Food Loop');
    expect(wrapper.find('[data-test="profile-map"]').text()).toContain("Louis Do's map is built from 2 visited stops, 2 public pins, and 2 wishlist saves.");
    expect(wrapper.find('[data-test="profile-map"]').text()).toContain('visited:2');
    expect(wrapper.find('[data-test="profile-map"]').text()).toContain('pinned:2');
    expect(wrapper.find('[data-test="profile-map"]').text()).toContain('wishlist:2');

    const tabs = wrapper.findAll('button.collection-tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0].text()).toContain('Recent');
    expect(tabs[1].text()).toContain('Pinned');
    expect(tabs[2].text()).toContain('Wishlist');

    await tabs[1].trigger('click');
    expect(wrapper.get('[data-test="profile-collection-rail"]').attributes('data-active-collection')).toBe('pinned');
    expect(wrapper.text()).toContain('Public spots with the clearest taste signal.');
    expect(wrapper.text()).toContain('Sunset Rooftop Tacos');
    expect(wrapper.text()).toContain('Design District Gallery Row');

    await tabs[2].trigger('click');
    expect(wrapper.get('[data-test="profile-collection-rail"]').attributes('data-active-collection')).toBe('wishlist');
    expect(wrapper.text()).toContain('Klyde Warren Garden Brunch');
    expect(wrapper.text()).toContain('Lady Bird Skyline Boardwalk');
  });

  it('renders a reusable skeleton while the profile workspace request is in flight', () => {
    userStoreMock.fetchCurrentProfile.mockReset().mockImplementation(() => new Promise(() => {}));

    const wrapper = mount(ProfilePage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });

    expect(wrapper.find('[data-test="profile-workspace-skeleton"]').exists()).toBe(true);
  });

  it('switches to the stacked mobile profile layout and scrollable adventures rail at the shared breakpoint', async () => {
    setViewportWidth(390);

    const wrapper = mount(ProfilePage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          RouterLink: { template: '<a><slot /></a>' },
          ProfileHeader: { props: ['user'], template: '<div data-test="profile-header">{{ user.displayName }}</div>' },
          ProfileStats: { props: ['countryCount'], template: '<div data-test="profile-stats">{{ countryCount }}</div>' },
          ProfileMap: {
            props: ['title', 'description', 'visitedSpots', 'pinnedSpots', 'wishlistSpots', 'showWishlist'],
            template: '<div data-test="profile-map">{{ title }} - {{ description }} visited:{{ visitedSpots ? visitedSpots.length : 0 }} pinned:{{ pinnedSpots ? pinnedSpots.length : 0 }} wishlist:{{ showWishlist && wishlistSpots ? wishlistSpots.length : 0 }}</div>',
          },
          ProfileAdventureCard: { props: ['trip'], template: '<div class="trip-card-stub">{{ trip.title }}</div>' },
          SpotCard: { props: ['spot'], template: '<div class="spot-card-stub">{{ spot.title }}</div>' },
        },
      },
    });

    await flushPromises();
    await nextTick();

    expect(wrapper.get('.profile-page').attributes('data-profile-layout')).toBe('mobile');
    expect(wrapper.get('[data-test="profile-collection-rail"]').attributes('data-active-collection')).toBe('recent');
    expect(wrapper.findAll('button.collection-tab')).toHaveLength(3);
  });

  it('renders another traveler profile with trip planning actions and no private wishlist', async () => {
    routeMock.params = { id: 'user-2' };
    routeController.current!.params = { id: 'user-2' };
    userStoreMock.fetchProfile.mockResolvedValueOnce({
      ...fixtures.profile,
      id: 'user-2',
      username: 'maya',
      displayName: 'Maya Chen',
      homeBase: 'Lisbon, Portugal',
      interests: ['scenic'],
    });
    listPublicTripsMock.mockResolvedValueOnce({
      data: [
        {
          ...fixtures.trips[0],
          members: [{ id: 'user-2' }],
        },
      ],
    });

    const wrapper = mountProfilePage();

    await flushPromises();

    expect(userStoreMock.fetchProfile).toHaveBeenCalledWith('user-2');
    expect(userStoreMock.fetchCurrentProfile).not.toHaveBeenCalled();
    expect(listSavedSpotsMock).not.toHaveBeenCalled();
    expect(wrapper.get('[data-test="profile-header"]').text()).toContain('Maya Chen');
    expect(wrapper.get('[data-test="profile-current-user"]').text()).toBe('other');
    expect(wrapper.get('[data-test="profile-primary-action"]').text()).toContain('Plan a trip /trips/new');
    expect(wrapper.get('[data-test="profile-secondary-action"]').text()).toContain('Open social graph /friends');
    expect(wrapper.find('[data-test="profile-saved-spots"]').exists()).toBe(false);
  });

  it('ignores stale workspace responses after a fast profile route change', async () => {
    const firstProfile = createDeferred<typeof fixtures.profile>();
    const secondProfile = createDeferred<typeof fixtures.profile>();
    userStoreMock.fetchCurrentProfile.mockReturnValueOnce(firstProfile.promise);
    userStoreMock.fetchProfile.mockReturnValueOnce(secondProfile.promise);

    const wrapper = mountProfilePage();

    await nextTick();
    routeController.current!.params = { id: 'user-2' };
    await nextTick();

    secondProfile.resolve({
      ...fixtures.profile,
      id: 'user-2',
      username: 'maya',
      displayName: 'Maya Chen',
    });
    await flushPromises();

    expect(wrapper.get('[data-test="profile-header"]').text()).toContain('Maya Chen');
    expect(userStoreMock.fetchProfile).toHaveBeenCalledWith('user-2');

    firstProfile.resolve({
      ...fixtures.profile,
      displayName: 'Stale Louis',
    });
    await flushPromises();

    expect(wrapper.get('[data-test="profile-header"]').text()).toContain('Maya Chen');
    expect(wrapper.text()).not.toContain('Stale Louis');
  });

  it('uses trip stops as map highlights when a traveler has no authored public pins', async () => {
    userStoreMock.fetchCurrentProfile.mockResolvedValueOnce({
      ...fixtures.profile,
      interests: ['nature'],
    });
    listUserSpotsMock.mockResolvedValueOnce({ data: [] });
    listSavedSpotsMock.mockResolvedValueOnce({ data: [] });
    listPublicTripsMock.mockResolvedValueOnce({
      data: [
        {
          ...fixtures.trips[0],
          title: 'Boston Reading Weekend',
          destination: 'Boston, MA',
          startDate: '2026-04-10',
          endDate: '2026-04-12',
          members: [{ id: 'user-1' }],
          spots: [
            {
              spotId: 'reading-room',
              title: 'Archive Reading Room',
              latitude: 42.3601,
              longitude: -71.0589,
              category: 'culture',
              city: 'Boston',
              notes: 'quiet focus',
              photoUrl: 'https://images.example.com/reading-room.jpg',
            },
            {
              spotId: 'reading-room',
              title: 'Archive Reading Room Duplicate',
              latitude: 42.3601,
              longitude: -71.0589,
              category: 'culture',
              city: 'Boston',
            },
          ],
        },
      ],
    });

    const wrapper = mountProfilePage();

    await flushPromises();

    expect(wrapper.get('[data-test="profile-map"]').text()).toContain("Louis Do's map is built from 1 visited stop, 0 public pins, and 0 wishlist saves.");
    expect(wrapper.get('[data-test="profile-map"]').text()).toContain('visited:1');
    expect(wrapper.get('[data-test="profile-map"]').text()).toContain('pinned:0');
    expect(wrapper.get('[data-test="profile-stats"]').text()).toContain('pins:0');
    expect(wrapper.get('[data-test="profile-stats"]').text()).toContain('rating:0');
    expect(wrapper.get('[data-test="profile-stats"]').text()).toContain('favorite:nature');
    expect(wrapper.text()).toContain('Boston Reading Weekend');

    const tabs = wrapper.findAll('button.collection-tab');
    await tabs[1].trigger('click');
    expect(wrapper.text()).toContain('No public pins yet');

    await tabs[2].trigger('click');
    expect(wrapper.text()).toContain('No saved spots yet');
  });

  it('uses updated broad profile preferences instead of stale public pins for the focus chip', async () => {
    const allPreferences = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'entertainment', 'scenic', 'other'];
    authStoreMock.currentUser = {
      ...authStoreMock.currentUser,
      interests: allPreferences,
    };
    userStoreMock.fetchCurrentProfile.mockResolvedValueOnce({
      ...fixtures.profile,
      interests: allPreferences,
    });

    const wrapper = mountProfilePage();

    await flushPromises();

    expect(wrapper.get('[data-test="profile-stats"]').text()).toContain('favorite:none');
    expect(wrapper.get('[data-test="profile-stats"]').text()).toContain('focus:All-around focus');
    expect(wrapper.get('[data-test="profile-stats"]').text()).toContain('focus-category:none');
  });

  it('keeps saved trip stops visible in the current profile wishlist', async () => {
    const savedTripStop = {
      id: 'saved-trip-stop',
      title: 'Archive Reading Room',
      category: 'culture',
      city: 'Boston',
      country: 'US',
      latitude: 42.3601,
      longitude: -71.0589,
      rating: 4.6,
      createdAt: '2026-04-10T00:00:00Z',
    };
    listUserSpotsMock.mockResolvedValueOnce({ data: [] });
    listSavedSpotsMock.mockResolvedValueOnce({ data: [savedTripStop] });
    listPublicTripsMock.mockResolvedValueOnce({
      data: [
        {
          ...fixtures.trips[0],
          title: 'Boston Reading Weekend',
          destination: 'Boston, MA',
          startDate: '2026-04-10',
          endDate: '2026-04-12',
          members: [{ id: 'user-1' }],
          spots: [
            {
              spotId: 'saved-trip-stop',
              title: 'Archive Reading Room',
              latitude: 42.3601,
              longitude: -71.0589,
              category: 'culture',
              city: 'Boston',
            },
          ],
        },
      ],
    });

    const wrapper = mountProfilePage();

    await flushPromises();

    expect(wrapper.get('[data-test="profile-map"]').text()).toContain("Louis Do's map is built from 1 visited stop, 0 public pins, and 1 wishlist save.");
    expect(wrapper.get('[data-test="profile-map"]').text()).toContain('wishlist:1');

    const tabs = wrapper.findAll('button.collection-tab');
    await tabs[2].trigger('click');
    expect(wrapper.get('[data-test="profile-collection-rail"]').attributes('data-active-collection')).toBe('wishlist');
    expect(wrapper.text()).toContain('Archive Reading Room');
  });

  it('shows empty route, pin, wishlist, and footprint copy for a quiet current profile', async () => {
    userStoreMock.fetchCurrentProfile.mockResolvedValueOnce({
      ...fixtures.profile,
      interests: [],
    });
    listUserSpotsMock.mockResolvedValueOnce({ data: [] });
    listSavedSpotsMock.mockResolvedValueOnce({ data: [] });
    listPublicTripsMock.mockResolvedValueOnce({ data: [] });

    const wrapper = mountProfilePage();

    await flushPromises();

    expect(wrapper.text()).toContain('No collaborative routes yet');
    const tabs = wrapper.findAll('button.collection-tab');
    await tabs[1].trigger('click');
    expect(wrapper.text()).toContain('No public pins yet');
    await tabs[2].trigger('click');
    expect(wrapper.text()).toContain('No saved spots yet');
    expect(wrapper.get('[data-test="profile-map"]').text()).toContain('Louis Do does not have mapped visits, public pins, or wishlist saves yet.');
    expect(wrapper.get('[data-test="profile-stats"]').text()).toContain('favorite:none');
  });

  it('surfaces partial workspace refresh failures without discarding the loaded profile', async () => {
    listUserSpotsMock.mockRejectedValueOnce(new Error('Pins are delayed'));

    const wrapper = mountProfilePage();

    await flushPromises();

    expect(wrapper.text()).toContain('Partial refresh');
    expect(wrapper.text()).toContain('Pins are delayed');
    expect(wrapper.get('[data-test="profile-header"]').text()).toContain('Louis Do');
    expect(wrapper.text()).toContain('North Texas Night + Food Loop');
  });

  it('prompts for a profile when neither the route nor the active session names a traveler', async () => {
    routeMock.params = {};
    routeController.current!.params = {};
    authStoreMock.currentUser = null as unknown as typeof authStoreMock.currentUser;

    const wrapper = mountProfilePage();

    await flushPromises();

    expect(wrapper.text()).toContain('Choose an Scope explorer to continue.');
    expect(userStoreMock.fetchCurrentProfile).not.toHaveBeenCalled();
    expect(userStoreMock.fetchProfile).not.toHaveBeenCalled();
    expect(listUserSpotsMock).not.toHaveBeenCalled();
  });

  it('shows an error state when the profile contract cannot be loaded', async () => {
    authStoreMock.currentUser = {
      id: 'user-9',
      username: 'maya',
      email: 'maya@example.com',
      displayName: 'Maya Chen',
      interests: ['scenic'],
    };
    userStoreMock.fetchProfile.mockRejectedValueOnce(new Error('Profile offline'));

    const wrapper = mount(ProfilePage, {
      global: {
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('Scope could not open this profile workspace');
    expect(wrapper.text()).toContain('Profile offline');
  });

  it('renders the compact QA profile preview without loading heavy workspace data', async () => {
    window.history.pushState({}, '', '/profile/user-1?scopeQaSession=authenticated');
    vi.resetModules();
    const { default: QaProfilePage } = await import('@/views/ProfilePage.vue');

    const wrapper = mountProfilePage(QaProfilePage);

    await flushPromises();

    expect(wrapper.text()).toContain('Profile preview');
    expect(wrapper.text()).toContain('Louis Do');
    expect(wrapper.text()).toContain('Compact profile summary tuned for fast browsing.');
    expect(wrapper.text()).toContain('Open Friends');
    expect(listUserSpotsMock).not.toHaveBeenCalled();
    expect(listSavedSpotsMock).not.toHaveBeenCalled();
    expect(listPublicTripsMock).not.toHaveBeenCalled();
  });

  it('shows the compact QA profile error state when the preview profile request fails', async () => {
    window.history.pushState({}, '', '/profile/user-1?scopeQaSession=authenticated');
    userStoreMock.fetchCurrentProfile.mockRejectedValueOnce(new Error('Audit profile offline'));
    vi.resetModules();
    const { default: QaProfilePage } = await import('@/views/ProfilePage.vue');

    const wrapper = mountProfilePage(QaProfilePage);

    await flushPromises();

    expect(wrapper.text()).toContain('Scope could not open this profile workspace');
    expect(wrapper.text()).toContain('Audit profile offline');
    expect(listUserSpotsMock).not.toHaveBeenCalled();
  });

  it('renders the profile map immediately when deferred observation is unavailable', async () => {
    vi.stubEnv('MODE', 'development');
    const originalIntersectionObserverDescriptor = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
    Reflect.deleteProperty(window, 'IntersectionObserver');

    try {
      vi.resetModules();
      const { default: FallbackProfilePage } = await import('@/views/ProfilePage.vue');
      const wrapper = mountProfilePage(FallbackProfilePage);

      await flushPromises();
      await nextTick();

      expect('IntersectionObserver' in window).toBe(false);
      expect(wrapper.find('[data-test="profile-map"]').exists()).toBe(true);
      expect(wrapper.find('.profile-map-placeholder').exists()).toBe(false);
    } finally {
      if (originalIntersectionObserverDescriptor) {
        Object.defineProperty(window, 'IntersectionObserver', originalIntersectionObserverDescriptor);
      }
    }
  });

  it('renders the profile map immediately without waiting for viewport intersection', async () => {
    vi.stubEnv('MODE', 'development');
    const originalIntersectionObserverDescriptor = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
    const observers: Array<{
      callback: IntersectionObserverCallback;
      observe: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
    }> = [];

    class FakeIntersectionObserver {
      readonly root = null;
      readonly rootMargin = '320px 0px';
      readonly thresholds = [0];
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      takeRecords = vi.fn(() => []);

      constructor(callback: IntersectionObserverCallback) {
        observers.push({
          callback,
          observe: this.observe,
          disconnect: this.disconnect,
        });
      }
    }

    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: FakeIntersectionObserver,
    });

    try {
      vi.resetModules();
      const { default: DeferredProfilePage } = await import('@/views/ProfilePage.vue');
      const wrapper = mountProfilePage(DeferredProfilePage);

      await flushPromises();
      await nextTick();

      expect(wrapper.find('[data-test="profile-map"]').exists()).toBe(true);
      expect(wrapper.find('.profile-map-placeholder').exists()).toBe(false);
      expect(observers).toHaveLength(0);
    } finally {
      if (originalIntersectionObserverDescriptor) {
        Object.defineProperty(window, 'IntersectionObserver', originalIntersectionObserverDescriptor);
      } else {
        Reflect.deleteProperty(window, 'IntersectionObserver');
      }
    }
  });

  afterAll(() => {
    setViewportWidth(ORIGINAL_INNER_WIDTH);
  });
});
