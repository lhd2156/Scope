import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { useFriendsStore } from '@/stores/friends';
import { useNotificationsStore } from '@/stores/notifications';
import type { FriendConnection, FriendRequest, FriendSuggestion, SpotCategory, UserProfile } from '@/types';

const trackFriendAddMock = vi.hoisted(() => vi.fn());
const searchUsersMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/analyticsService', () => ({
  trackFriendAdd: trackFriendAddMock,
}));

vi.mock('@/services/userService', () => ({
  searchUsers: searchUsersMock,
  searchUsersLive: searchUsersMock,
}));

vi.mock('@/services/socialMockData', () => ({
  demoFriendConnections: [],
  demoFriendRequests: [],
  mockFriendConnections: [],
  mockFriendRequests: [],
}));

import FriendsPage from '@/views/FriendsPage.vue';

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/friends', component: FriendsPage },
      { path: '/profile/:id', component: { template: '<div>Profile target</div>' } },
    ],
  });
}

const globalStubs = {
  AppShell: { template: '<div><slot /></div>' },
  ScopeIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
  Avatar: { props: ['name'], template: '<div class="avatar-stub">{{ name }}</div>' },
  LazyImage: { props: ['src', 'alt'], template: '<img class="lazy-image-stub" :src="src" :alt="alt" />' },
};

function buildUser(overrides: Partial<UserProfile> = {}): UserProfile {
  const id = overrides.id ?? 'user-seed';
  return {
    id,
    username: overrides.username ?? id,
    email: overrides.email ?? `${id}@example.com`,
    displayName: overrides.displayName ?? 'Seed Traveler',
    avatarUrl: overrides.avatarUrl,
    homeBase: overrides.homeBase,
    interests: overrides.interests ?? ['food', 'culture'],
    stats: overrides.stats,
    bio: overrides.bio,
    showActivityStatus: overrides.showActivityStatus,
  };
}

function buildConnection(overrides: Partial<FriendConnection> & { user?: UserProfile } = {}): FriendConnection {
  const user = overrides.user ?? buildUser({ id: overrides.id ? `${overrides.id}-user` : 'friend-user' });
  return {
    id: overrides.id ?? `connection-${user.id}`,
    user,
    presence: overrides.presence ?? 'online',
    sharedTrips: overrides.sharedTrips ?? 2,
    mutualFriends: overrides.mutualFriends ?? 3,
    favoriteCategories: overrides.favoriteCategories ?? categoriesForUserSeed(user),
    nextAdventure: overrides.nextAdventure,
    lastActiveAt: overrides.lastActiveAt ?? '2026-05-01T12:00:00Z',
  };
}

function buildRequest(overrides: Partial<FriendRequest> & { user?: UserProfile } = {}): FriendRequest {
  const user = overrides.user ?? buildUser({ id: overrides.id ? `${overrides.id}-user` : 'request-user' });
  return {
    id: overrides.id ?? `request-${user.id}`,
    user,
    direction: overrides.direction ?? 'incoming',
    createdAt: overrides.createdAt ?? '2026-05-03T09:00:00Z',
    mutualFriends: overrides.mutualFriends ?? 1,
    note: overrides.note,
  };
}

function buildSuggestion(overrides: Partial<FriendSuggestion> & { user?: UserProfile } = {}): FriendSuggestion {
  const user = overrides.user ?? buildUser({ id: overrides.id ? `${overrides.id}-user` : 'suggestion-user' });
  return {
    id: overrides.id ?? `suggestion-${user.id}`,
    user,
    mutualFriends: overrides.mutualFriends ?? 2,
    sharedInterests: overrides.sharedInterests ?? ['food'],
    favoriteCategories: overrides.favoriteCategories ?? categoriesForUserSeed(user),
    presence: overrides.presence ?? 'offline',
    reason: overrides.reason ?? 'Shared food routes nearby',
    score: overrides.score,
  };
}

function categoriesForUserSeed(user: UserProfile): SpotCategory[] {
  const categories = user.interests.filter((interest): interest is SpotCategory =>
    ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'entertainment', 'scenic', 'other'].includes(interest),
  );
  return categories.length ? categories : ['other'];
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

async function mountFriendsPageWithSeed(seed: {
  connections?: FriendConnection[];
  requests?: FriendRequest[];
  suggestions?: FriendSuggestion[];
  searchResults?: UserProfile[];
}, routePath = '/friends') {
  const pinia = createPinia();
  setActivePinia(pinia);
  const friendsStore = useFriendsStore();
  const notificationsStore = useNotificationsStore();
  friendsStore.connections = seed.connections ?? [];
  friendsStore.requests = seed.requests ?? [];
  friendsStore.suggestions = seed.suggestions ?? [];
  friendsStore.searchResults = seed.searchResults ?? [];
  friendsStore.sentRequestUserIds = new Set();
  friendsStore.error = null;
  friendsStore.fetchAll = vi.fn().mockResolvedValue(undefined);

  const router = createTestRouter();
  await router.push(routePath);
  await router.isReady();

  const wrapper = mount(FriendsPage, {
    global: {
      plugins: [router, pinia],
      stubs: globalStubs,
    },
  });

  await flushPromises();

  return { wrapper, router, friendsStore, notificationsStore };
}

describe('FriendsPage', () => {
  beforeEach(() => {
    searchUsersMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    trackFriendAddMock.mockReset();
    delete (window as Window & { __SCOPE_ENABLE_FRIENDS_PRESENCE_REFRESH__?: boolean }).__SCOPE_ENABLE_FRIENDS_PRESENCE_REFRESH__;
  });

  it('renders an empty travel circle for brand-new accounts and prompts the main people search', () => {
    const router = createTestRouter();
    const wrapper = mount(FriendsPage, {
      global: {
        plugins: [router, createPinia()],
        stubs: globalStubs,
      },
    });

    expect(wrapper.findAll('[data-test="friend-card"]')).toHaveLength(0);
    expect(wrapper.findAll('[data-test="request-card"]')).toHaveLength(0);
    expect(wrapper.findAll('[data-test="suggestion-card"]')).toHaveLength(0);
    expect(wrapper.get('[data-test="tab-all"]').text()).toContain('0');
    expect(wrapper.get('[data-test="tab-requests"]').text()).toContain('0');
    expect(wrapper.text()).toContain('Your travel circle is still forming');
    expect(wrapper.text()).toContain('@handle');
    expect(wrapper.get('[data-test="main-people-search"]').exists()).toBe(true);
  });

  it('renders a populated friend grid, online filter, and profile navigation', async () => {
    const connections = [
      buildConnection({
        id: 'connection-planning',
        user: buildUser({ id: 'user-planning', username: 'maya.routes', displayName: 'Maya Routes', homeBase: 'Dallas, TX', interests: ['food', 'culture'] }),
        presence: 'planning',
        nextAdventure: 'Mapping a late-night taco crawl.',
      }),
      buildConnection({
        id: 'connection-online',
        user: buildUser({ id: 'user-online', username: 'noah.now', displayName: 'Noah Now', homeBase: 'Austin, TX', interests: ['nature'] }),
        presence: 'online',
        favoriteCategories: ['nature'],
      }),
      buildConnection({
        id: 'connection-idle',
        user: buildUser({ id: 'user-idle', username: 'ivy.idle', displayName: 'Ivy Idle', homeBase: 'Santa Fe, NM', interests: ['shopping'] }),
        presence: 'idle',
        favoriteCategories: ['shopping'],
      }),
      buildConnection({
        id: 'connection-offline',
        user: buildUser({ id: 'user-offline', username: 'owen.off', displayName: 'Owen Offline', interests: ['unknown-vibe'] }),
        presence: 'offline',
        favoriteCategories: ['other'],
        nextAdventure: '',
        lastActiveAt: '2026-05-04T12:00:00Z',
      }),
      buildConnection({
        id: 'connection-hidden',
        user: buildUser({ id: 'user-hidden', username: 'hannah.hidden', displayName: 'Hannah Hidden', homeBase: 'Denver, CO', interests: ['nightlife'] }),
        presence: 'hidden',
        favoriteCategories: ['nightlife'],
      }),
    ];

    const { wrapper, router, friendsStore } = await mountFriendsPageWithSeed({ connections });

    expect(wrapper.findAll('[data-test="friend-card"]')).toHaveLength(5);
    expect(wrapper.get('[data-test="friends-online-rail"]').text()).toContain('2 active friends');
    expect(wrapper.get('[data-test="friends-online-rail"]').text()).toContain('Online or planning');
    expect(wrapper.get('[data-test="network-panel"]').text()).toContain('5 of 5 friends shown');
    expect(wrapper.get('[data-test="tab-all"]').text()).toContain('5');
    expect(wrapper.get('[data-test="tab-online"]').text()).toContain('2');
    expect(wrapper.text()).toContain('Planning a trip');
    expect(wrapper.text()).toContain('Online now');
    expect(wrapper.text()).toContain('Idle');
    expect(wrapper.text()).toContain('Active May 4');
    expect(wrapper.text()).toContain('Activity hidden');
    expect(wrapper.text()).toContain('Ready for the next itinerary.');
    expect(wrapper.text()).toContain('Scope traveler');

    await wrapper.get('[data-test="online-rail-user-online"]').trigger('click');
    await flushPromises();
    await router.isReady();
    expect(router.currentRoute.value.path).toBe('/profile/user-online');
    await router.push('/friends');
    await router.isReady();

    friendsStore.removeConnection = vi.fn(async (connectionId: string) => {
      friendsStore.connections = friendsStore.connections.filter((connection) => connection.id !== connectionId);
    });
    await wrapper.get('[data-test="remove-friend-connection-idle"]').trigger('click');
    await flushPromises();
    expect(friendsStore.removeConnection).toHaveBeenCalledWith('connection-idle');
    expect(wrapper.get('[data-test="network-panel"]').text()).toContain('4 of 4 friends shown');

    await wrapper.get('[data-test="view-profile-user-online"]').trigger('click');
    await flushPromises();
    await router.isReady();
    expect(router.currentRoute.value.path).toBe('/profile/user-online');

    await wrapper.get('[data-test="tab-online"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-test="network-panel"]').text()).toContain('Friends online now');
    const onlineFriendCards = wrapper.findAll('[data-test="friend-card"]');
    const onlineFriendCardText = onlineFriendCards.map((card) => card.text()).join(' ');
    expect(onlineFriendCards).toHaveLength(2);
    expect(onlineFriendCardText).toContain('Maya Routes');
    expect(onlineFriendCardText).toContain('Noah Now');
    expect(onlineFriendCardText).not.toContain('Ivy Idle');
  });

  it('prioritizes active shared friends and paginates larger friend grids', async () => {
    const connections = [
      buildConnection({
        id: 'connection-offline-mutual',
        user: buildUser({ id: 'user-offline-mutual', username: 'offline.mutual', displayName: 'Offline Mutual', interests: ['culture'] }),
        presence: 'offline',
        sharedTrips: 12,
        mutualFriends: 80,
      }),
      buildConnection({
        id: 'connection-online-low',
        user: buildUser({ id: 'user-online-low', username: 'online.low', displayName: 'Online Low', interests: ['food'] }),
        presence: 'online',
        sharedTrips: 1,
        mutualFriends: 1,
      }),
      buildConnection({
        id: 'connection-planning-high',
        user: buildUser({ id: 'user-planning-high', username: 'planning.high', displayName: 'Planning High', interests: ['nature'] }),
        presence: 'planning',
        sharedTrips: 2,
        mutualFriends: 4,
      }),
      buildConnection({
        id: 'connection-online-shared',
        user: buildUser({ id: 'user-online-shared', username: 'online.shared', displayName: 'Online Shared', interests: ['nightlife'] }),
        presence: 'online',
        sharedTrips: 4,
        mutualFriends: 2,
      }),
      buildConnection({
        id: 'connection-idle',
        user: buildUser({ id: 'user-page-idle', username: 'page.idle', displayName: 'Page Idle', interests: ['shopping'] }),
        presence: 'idle',
      }),
      buildConnection({
        id: 'connection-offline-a',
        user: buildUser({ id: 'user-offline-a', username: 'offline.a', displayName: 'Offline A', interests: ['scenic'] }),
        presence: 'offline',
        mutualFriends: 5,
      }),
      buildConnection({
        id: 'connection-offline-b',
        user: buildUser({ id: 'user-offline-b', username: 'offline.b', displayName: 'Offline B', interests: ['scenic'] }),
        presence: 'offline',
        mutualFriends: 4,
      }),
    ];

    const { wrapper } = await mountFriendsPageWithSeed({ connections });
    const firstPageCards = wrapper.findAll('[data-test="friend-card"]').map((card) => card.text());

    expect(wrapper.get('[data-test="network-panel"]').text()).toContain('6 of 7 friends shown - page 1 of 2');
    expect(wrapper.get('[data-test="friends-page-status"]').text()).toContain('Page 1 of 2');
    expect(firstPageCards[0]).toContain('Planning High');
    expect(firstPageCards[1]).toContain('Online Shared');
    expect(firstPageCards[2]).toContain('Online Low');
    expect(firstPageCards[3]).toContain('Page Idle');
    expect(firstPageCards[4]).toContain('Offline Mutual');
    expect(firstPageCards.join(' ')).not.toContain('Offline B');

    await wrapper.get('[data-test="friends-page-next"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-test="friends-page-status"]').text()).toContain('Page 2 of 2');
    expect(wrapper.get('[data-test="network-panel"]').text()).toContain('1 of 7 friends shown - page 2 of 2');
    expect(wrapper.findAll('[data-test="friend-card"]')).toHaveLength(1);
    expect(wrapper.get('[data-test="friend-card"]').text()).toContain('Offline B');

    await wrapper.get('[data-test="friends-page-prev"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-test="friends-page-status"]').text()).toContain('Page 1 of 2');
    expect(wrapper.findAll('[data-test="friend-card"]').map((card) => card.text()).join(' ')).toContain('Planning High');
  });

  it('reviews incoming friend requests and records accept or decline outcomes', async () => {
    const requestOne = buildRequest({
      id: 'request-maya',
      user: buildUser({ id: 'user-maya', username: 'maya.req', displayName: 'Maya Request', homeBase: 'Dallas, TX', interests: ['food'] }),
      note: '',
      mutualFriends: 4,
    });
    const requestTwo = buildRequest({
      id: 'request-noah',
      user: buildUser({ id: 'user-noah', username: 'noah.req', displayName: 'Noah Request', homeBase: 'Austin, TX', interests: ['scenic'] }),
      note: 'Let us map a hill country route.',
      mutualFriends: 2,
    });
    const { wrapper, friendsStore, notificationsStore } = await mountFriendsPageWithSeed({
      requests: [requestOne, requestTwo],
    });
    const addNotificationSpy = vi.spyOn(notificationsStore, 'addNotification');
    friendsStore.acceptRequest = vi.fn(async (requestId: string) => {
      const request = friendsStore.requests.find((entry) => entry.id === requestId);
      if (!request) {
        return;
      }
      friendsStore.requests = friendsStore.requests.filter((entry) => entry.id !== requestId);
      friendsStore.connections = [
        buildConnection({
          id: `connection-${request.user.id}`,
          user: request.user,
          presence: 'online',
          mutualFriends: request.mutualFriends,
          favoriteCategories: categoriesForUserSeed(request.user),
        }),
        ...friendsStore.connections,
      ];
    });
    friendsStore.rejectRequest = vi.fn(async (requestId: string) => {
      friendsStore.requests = friendsStore.requests.filter((entry) => entry.id !== requestId);
    });

    await wrapper.get('[data-test="tab-requests"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-test="network-panel"]').text()).toContain('Pending requests');
    expect(wrapper.findAll('[data-test="request-card"]')).toHaveLength(2);
    expect(wrapper.text()).toContain('Ready to plan a route together.');
    expect(wrapper.text()).toContain('Let us map a hill country route.');

    await wrapper.get('[data-test="accept-request-request-maya"]').trigger('click');
    await flushPromises();

    expect(friendsStore.acceptRequest).toHaveBeenCalledWith('request-maya');
    expect(addNotificationSpy).toHaveBeenCalledWith(expect.objectContaining({
      title: 'New Scope friend',
      body: expect.stringContaining('Maya Request'),
      type: 'friend.accepted',
    }));
    expect(trackFriendAddMock).toHaveBeenCalledWith(expect.objectContaining({
      source: 'request',
      requestId: 'request-maya',
      userId: 'user-maya',
      mutualFriends: 4,
    }));
    expect(wrapper.get('[data-test="tab-all"]').attributes('aria-selected')).toBe('true');

    await wrapper.get('[data-test="tab-requests"]').trigger('click');
    await wrapper.get('[data-test="decline-request-request-noah"]').trigger('click');
    await flushPromises();

    expect(friendsStore.rejectRequest).toHaveBeenCalledWith('request-noah');
    expect(wrapper.get('[data-test="tab-all"]').attributes('aria-selected')).toBe('true');
    expect(wrapper.get('[data-test="tab-requests"]').text()).toContain('0');
  });

  it('opens the requests tab from a notification deep link', async () => {
    const request = buildRequest({
      id: 'request-deep-link',
      user: buildUser({ id: 'user-deep-link', username: 'deep.link', displayName: 'Deep Link', interests: ['culture'] }),
    });
    const { wrapper } = await mountFriendsPageWithSeed({
      requests: [request],
    }, '/friends?tab=requests');

    expect(wrapper.get('[data-test="tab-requests"]').attributes('aria-selected')).toBe('true');
    expect(wrapper.get('[data-test="network-panel"]').text()).toContain('Pending requests');
    expect(wrapper.findAll('[data-test="request-card"]')).toHaveLength(1);
  });

  it('renders discover suggestions, filters existing friends, and removes sent requests', async () => {
    const existingFriend = buildUser({ id: 'user-existing', username: 'existing.friend', displayName: 'Existing Friend', interests: ['culture'] });
    const candidate = buildUser({ id: 'user-discover', username: 'discover.traveler', displayName: 'Discover Traveler', homeBase: 'Portland, OR', interests: ['nature', 'scenic'] });
    const { wrapper, friendsStore, router } = await mountFriendsPageWithSeed({
      connections: [buildConnection({ user: existingFriend, presence: 'online' })],
      suggestions: [
        buildSuggestion({ id: 'suggestion-existing', user: existingFriend, reason: 'Already connected' }),
        buildSuggestion({
          id: 'suggestion-discover',
          user: candidate,
          reason: 'Shared trail itineraries',
          mutualFriends: 1,
          sharedInterests: [],
          favoriteCategories: ['nature', 'scenic'],
        }),
      ],
    });
    friendsStore.sendRequest = vi.fn(async (user: UserProfile) => {
      friendsStore.sentRequestUserIds = new Set([...friendsStore.sentRequestUserIds, user.id]);
      friendsStore.suggestions = friendsStore.suggestions.filter((suggestion) => suggestion.user.id !== user.id);
    });

    await wrapper.get('[data-test="tab-discover"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-test="network-panel"]').text()).toContain('Best suggested travelers');
    expect(wrapper.findAll('[data-test="discover-card"]')).toHaveLength(1);
    expect(wrapper.text()).toContain('Discover Traveler');
    expect(wrapper.text()).toContain('Shared trail itineraries');
    expect(wrapper.text()).toContain('1 mutual friend');
    expect(wrapper.text()).toContain('Fresh vibe match');

    friendsStore.refreshSuggestions = vi.fn(async () => undefined);
    await wrapper.findAll('.discover-mode-row__button').find((button) => button.text() === 'Vibes')!.trigger('click');
    await flushPromises();
    expect(friendsStore.refreshSuggestions).toHaveBeenCalledWith('vibes');

    await wrapper.get('[data-test="view-discover-user-discover"]').trigger('click');
    await flushPromises();
    await router.isReady();
    expect(router.currentRoute.value.path).toBe('/profile/user-discover');
    await router.push('/friends');
    await router.isReady();
    await wrapper.get('[data-test="tab-discover"]').trigger('click');

    await wrapper.get('[data-test="send-request-user-discover"]').trigger('click');
    await flushPromises();

    expect(friendsStore.sendRequest).toHaveBeenCalledWith(candidate);
    expect(wrapper.find('[data-test="discover-card"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('No suggestions yet');
  });

  it('surfaces send-request failures from the main people search', async () => {
    vi.useFakeTimers();
    const candidate = buildUser({
      id: 'user-fail-send',
      username: 'fail.send',
      displayName: 'Fail Send',
      homeBase: 'Chicago, IL',
      interests: ['food'],
    });
    searchUsersMock.mockResolvedValue({
      data: [candidate],
      meta: { page: 1, pageSize: 1, total: 1, totalPages: 1 },
    });
    const { wrapper, friendsStore } = await mountFriendsPageWithSeed({});
    friendsStore.sendRequest = vi.fn(async () => {
      friendsStore.error = 'Request API unavailable.';
      throw new Error('request failed');
    });

    await wrapper.get('input[aria-label="Search friends and Scope members"]').setValue('fail');
    await vi.advanceTimersByTimeAsync(650);
    await flushPromises();

    await wrapper.get('[data-test="send-request-user-fail-send"]').trigger('click');
    await flushPromises();

    expect(friendsStore.sendRequest).toHaveBeenCalledWith(candidate);
    expect(wrapper.get('[data-test="find-people-error"]').text()).toContain('Request API unavailable.');
    expect(trackFriendAddMock).toHaveBeenCalledWith(expect.objectContaining({
      source: 'search',
      userId: 'user-fail-send',
    }));
  });

  it('opens profiles from keyboard across friends, requests, discover cards, and search results', async () => {
    vi.useFakeTimers();
    const requestUser = buildUser({ id: 'user-key-request', username: 'key.request', displayName: 'Key Request', interests: ['food'] });
    const discoverUser = buildUser({ id: 'user-key-discover', username: 'key.discover', displayName: 'Key Discover', interests: ['scenic'] });
    const searchUser = buildUser({ id: 'user-key-search', username: 'key.search', displayName: 'Key Search', interests: ['culture'] });
    searchUsersMock.mockResolvedValue({
      data: [searchUser],
      meta: { page: 1, pageSize: 1, total: 1, totalPages: 1 },
    });
    const { wrapper, router } = await mountFriendsPageWithSeed({
      connections: [buildConnection({
        user: buildUser({ id: 'user-key-friend', username: 'key.friend', displayName: 'Key Friend', interests: ['nightlife'] }),
        presence: 'online',
      })],
      requests: [buildRequest({ id: 'request-key', user: requestUser })],
      suggestions: [buildSuggestion({ id: 'suggestion-key', user: discoverUser })],
    });

    await wrapper.get('[data-test="friend-card"]').trigger('keydown.space');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/profile/user-key-friend');

    await router.push('/friends');
    await router.isReady();
    await wrapper.get('input[aria-label="Search friends and Scope members"]').setValue('key.friend');
    await vi.advanceTimersByTimeAsync(650);
    await flushPromises();
    await wrapper.get('[data-test="friend-search-results"] [data-test="friend-card"]').trigger('keydown.space');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/profile/user-key-friend');

    await router.push('/friends');
    await router.isReady();
    await wrapper.get('input[aria-label="Search friends and Scope members"]').setValue('');
    await vi.advanceTimersByTimeAsync(650);
    await flushPromises();
    await wrapper.get('[data-test="tab-requests"]').trigger('click');
    await wrapper.get('[data-test="request-card"]').trigger('keydown.space');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/profile/user-key-request');

    await router.push('/friends');
    await router.isReady();
    await wrapper.get('[data-test="tab-discover"]').trigger('click');
    await wrapper.get('[data-test="discover-card"]').trigger('keydown.space');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/profile/user-key-discover');

    await router.push('/friends');
    await router.isReady();
    await wrapper.get('input[aria-label="Search friends and Scope members"]').setValue('key.search');
    await vi.advanceTimersByTimeAsync(650);
    await flushPromises();
    await wrapper.get('[data-test="suggestion-card"]').trigger('keydown.space');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/profile/user-key-search');
  });

  it('opens profiles from card-level clicks across friends, requests, and discover suggestions', async () => {
    const requestUser = buildUser({ id: 'user-click-request', username: 'click.request', displayName: 'Click Request', interests: ['food'] });
    const discoverUser = buildUser({ id: 'user-click-discover', username: 'click.discover', displayName: 'Click Discover', interests: ['scenic'] });
    const { wrapper, router } = await mountFriendsPageWithSeed({
      connections: [buildConnection({
        user: buildUser({ id: 'user-click-friend', username: 'click.friend', displayName: 'Click Friend', interests: ['nightlife'] }),
        presence: 'online',
      })],
      requests: [buildRequest({ id: 'request-click', user: requestUser })],
      suggestions: [buildSuggestion({ id: 'suggestion-click', user: discoverUser })],
    });

    await wrapper.get('[data-test="friend-card"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/profile/user-click-friend');

    await router.push('/friends');
    await router.isReady();
    await wrapper.get('[data-test="tab-requests"]').trigger('click');
    await wrapper.get('[data-test="request-card"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/profile/user-click-request');

    await router.push('/friends');
    await router.isReady();
    await wrapper.get('[data-test="tab-discover"]').trigger('click');
    await wrapper.get('[data-test="discover-card"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/profile/user-click-discover');
  });

  it('shows filtered empty states, short-query cleanup, and already-friend search labels', async () => {
    vi.useFakeTimers();
    const existingUser = buildUser({ id: 'user-filter-existing', username: 'filter.existing', displayName: 'Filter Existing', interests: ['food'] });
    const candidate = buildUser({ id: 'user-filter-candidate', username: 'filter.candidate', displayName: 'Filter Candidate', interests: ['culture'] });
    searchUsersMock.mockResolvedValue({
      data: [candidate],
      meta: { page: 1, pageSize: 1, total: 1, totalPages: 1 },
    });
    const { wrapper, friendsStore } = await mountFriendsPageWithSeed({
      connections: [buildConnection({
        user: existingUser,
        presence: 'offline',
        lastActiveAt: '',
        nextAdventure: '',
      })],
      requests: [buildRequest({
        id: 'request-filter',
        user: buildUser({ id: 'user-filter-request', username: 'filter.request', displayName: 'Filter Request', interests: ['scenic'] }),
      })],
    });

    expect(wrapper.text()).toContain('Offline');

    await wrapper.get('input[aria-label="Search friends and Scope members"]').setValue('z');
    await wrapper.get('input[aria-label="Search friends and Scope members"]').setValue('#');
    await vi.advanceTimersByTimeAsync(650);
    await flushPromises();

    expect(searchUsersMock).not.toHaveBeenCalled();
    expect(friendsStore.searchResults).toEqual([]);
    expect(wrapper.text()).toContain('No friends match that search');
    expect(wrapper.text()).toContain('Adjust the search or switch tabs to reveal more of your Scope network.');

    await wrapper.findAll('button').find((button) => button.text() === 'Clear search')!.trigger('click');
    await flushPromises();
    expect(wrapper.get('input[aria-label="Search friends and Scope members"]').element).toHaveProperty('value', '');

    await wrapper.get('input[aria-label="Search friends and Scope members"]').setValue('#');
    await vi.advanceTimersByTimeAsync(650);
    await flushPromises();

    await wrapper.get('[data-test="tab-requests"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('No requests match that search');
    expect(wrapper.text()).toContain('Try another city, name, or vibe to surface the right incoming requests.');

    await wrapper.get('input[aria-label="Search friends and Scope members"]').setValue('filter.candidate');
    await vi.advanceTimersByTimeAsync(650);
    await flushPromises();
    expect(wrapper.find('[data-test="suggestion-card"]').exists()).toBe(true);

    friendsStore.connections = [
      ...friendsStore.connections,
      buildConnection({ user: candidate, presence: 'online' }),
    ];
    await flushPromises();

    expect(wrapper.get('[data-test="friend-search-results"]').text()).toContain('Filter Candidate');
    expect(wrapper.find('[data-test="send-request-user-filter-candidate"]').exists()).toBe(false);
  });

  it('shows discover loading copy and request action failures without losing the page', async () => {
    const request = buildRequest({
      id: 'request-failure',
      user: buildUser({ id: 'user-request-failure', username: 'request.failure', displayName: 'Request Failure', interests: ['food'] }),
    });
    const { wrapper, friendsStore } = await mountFriendsPageWithSeed({ requests: [request] });

    friendsStore.loading = true;
    await wrapper.get('[data-test="tab-discover"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Loading suggested travelers');
    expect(wrapper.text()).toContain('Scope is checking mutuals, shared interests, and nearby route overlap.');

    friendsStore.loading = false;
    friendsStore.acceptRequest = vi.fn(async () => {
      friendsStore.error = 'Accept API unavailable.';
      throw new Error('accept failed');
    });
    friendsStore.rejectRequest = vi.fn(async () => {
      friendsStore.error = 'Decline API unavailable.';
      throw new Error('decline failed');
    });

    await wrapper.get('[data-test="tab-requests"]').trigger('click');
    await wrapper.get('[data-test="accept-request-request-failure"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-test="find-people-error"]').text()).toContain('Accept API unavailable.');

    await wrapper.get('[data-test="decline-request-request-failure"]').trigger('click');
    await flushPromises();
    expect(wrapper.get('[data-test="find-people-error"]').text()).toContain('Decline API unavailable.');
  });

  it('surfaces social-circle load failures on mount', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const friendsStore = useFriendsStore();
    friendsStore.error = 'Circle API unavailable.';
    friendsStore.fetchAll = vi.fn().mockRejectedValue(new Error('load failed'));
    const router = createTestRouter();
    await router.push('/friends');
    await router.isReady();

    const wrapper = mount(FriendsPage, {
      global: {
        plugins: [router, pinia],
        stubs: globalStubs,
      },
    });

    await flushPromises();

    expect(friendsStore.fetchAll).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[data-test="find-people-error"]').text()).toContain('Circle API unavailable.');
  });

  it('refreshes friend presence on intervals and visible-tab returns', async () => {
    vi.useFakeTimers();
    (window as Window & { __SCOPE_ENABLE_FRIENDS_PRESENCE_REFRESH__?: boolean }).__SCOPE_ENABLE_FRIENDS_PRESENCE_REFRESH__ = true;

    const { wrapper, friendsStore } = await mountFriendsPageWithSeed({
      connections: [buildConnection({ user: buildUser({ id: 'user-presence', displayName: 'Presence Friend' }) })],
    });
    friendsStore.refreshConnections = vi.fn().mockResolvedValue(undefined);

    await vi.advanceTimersByTimeAsync(45_000);
    await flushPromises();
    expect(friendsStore.refreshConnections).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await flushPromises();
    expect(friendsStore.refreshConnections).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    friendsStore.refreshConnections = vi.fn().mockRejectedValue(new Error('presence refresh failed'));
    document.dispatchEvent(new Event('visibilitychange'));
    await flushPromises();
    expect(friendsStore.refreshConnections).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it('keeps the newest member search when slower requests settle late', async () => {
    vi.useFakeTimers();
    const alphaUser = buildUser({ id: 'user-alpha', username: 'alpha.route', displayName: 'Alpha Route', interests: ['food'] });
    const betaUser = buildUser({ id: 'user-beta', username: 'beta.route', displayName: 'Beta Route', interests: ['culture'] });
    type SearchEnvelope = {
      data: UserProfile[];
      meta: { page: number; pageSize: number; total: number; totalPages: number };
    };
    const alphaSearch = createDeferred<SearchEnvelope>();
    const betaSearch = createDeferred<SearchEnvelope>();
    searchUsersMock.mockImplementation((query: string) => {
      if (query === 'alpha') {
        return alphaSearch.promise;
      }

      return betaSearch.promise;
    });
    const { wrapper, friendsStore } = await mountFriendsPageWithSeed({});
    const input = wrapper.get('input[aria-label="Search friends and Scope members"]');

    await input.setValue('alpha');
    await vi.advanceTimersByTimeAsync(650);
    await flushPromises();
    await input.setValue('beta');
    await vi.advanceTimersByTimeAsync(650);
    await flushPromises();

    betaSearch.resolve({
      data: [betaUser],
      meta: { page: 1, pageSize: 1, total: 1, totalPages: 1 },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('Beta Route');

    alphaSearch.resolve({
      data: [alphaUser],
      meta: { page: 1, pageSize: 1, total: 1, totalPages: 1 },
    });
    await flushPromises();

    expect(friendsStore.searchResults).toEqual([betaUser]);
    expect(wrapper.text()).toContain('Beta Route');
    expect(wrapper.text()).not.toContain('Alpha Route');
  });

  it('ignores stale member-search failures after a newer query succeeds', async () => {
    vi.useFakeTimers();
    const betaUser = buildUser({ id: 'user-beta-ok', username: 'beta.ok', displayName: 'Beta Ok', interests: ['scenic'] });
    type SearchEnvelope = {
      data: UserProfile[];
      meta: { page: number; pageSize: number; total: number; totalPages: number };
    };
    const alphaSearch = createDeferred<SearchEnvelope>();
    const betaSearch = createDeferred<SearchEnvelope>();
    searchUsersMock.mockImplementation((query: string) => {
      if (query === 'alpha-fail') {
        return alphaSearch.promise;
      }

      return betaSearch.promise;
    });
    const { wrapper, friendsStore } = await mountFriendsPageWithSeed({});
    const input = wrapper.get('input[aria-label="Search friends and Scope members"]');

    await input.setValue('alpha-fail');
    await vi.advanceTimersByTimeAsync(650);
    await flushPromises();
    await input.setValue('beta-ok');
    await vi.advanceTimersByTimeAsync(650);
    await flushPromises();

    betaSearch.resolve({
      data: [betaUser],
      meta: { page: 1, pageSize: 1, total: 1, totalPages: 1 },
    });
    await flushPromises();
    alphaSearch.reject(new Error('stale search failed'));
    await flushPromises();

    expect(wrapper.text()).toContain('Beta Ok');
    expect(wrapper.find('[data-test="find-people-error"]').exists()).toBe(false);
    expect(friendsStore.error).toBeNull();
  });

  it('ignores stale action buttons for people who are no longer actionable', async () => {
    vi.useFakeTimers();
    const candidate = buildUser({ id: 'user-stale-action', username: 'stale.action', displayName: 'Stale Action', interests: ['food'] });
    const request = buildRequest({
      id: 'request-stale-action',
      user: buildUser({ id: 'user-stale-request', username: 'stale.request', displayName: 'Stale Request', interests: ['nature'] }),
    });
    searchUsersMock.mockResolvedValue({
      data: [candidate],
      meta: { page: 1, pageSize: 1, total: 1, totalPages: 1 },
    });
    const { wrapper, friendsStore, notificationsStore } = await mountFriendsPageWithSeed({ requests: [request] });
    const addNotificationSpy = vi.spyOn(notificationsStore, 'addNotification');
    friendsStore.sendRequest = vi.fn(async () => undefined);
    friendsStore.acceptRequest = vi.fn(async () => undefined);

    await wrapper.get('input[aria-label="Search friends and Scope members"]').setValue('stale.action');
    await vi.advanceTimersByTimeAsync(650);
    await flushPromises();
    const sendButton = wrapper.get('[data-test="send-request-user-stale-action"]');
    friendsStore.connections = [buildConnection({ user: candidate })];
    await sendButton.trigger('click');
    await flushPromises();

    expect(friendsStore.sendRequest).not.toHaveBeenCalled();
    expect(trackFriendAddMock).not.toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-stale-action' }));

    await wrapper.get('input[aria-label="Search friends and Scope members"]').setValue('');
    await vi.advanceTimersByTimeAsync(650);
    await flushPromises();
    await wrapper.get('[data-test="tab-requests"]').trigger('click');
    await flushPromises();
    const acceptButton = wrapper.get('[data-test="accept-request-request-stale-action"]');
    friendsStore.requests = [];
    await acceptButton.trigger('click');
    await flushPromises();

    expect(friendsStore.acceptRequest).not.toHaveBeenCalled();
    expect(addNotificationSpy).not.toHaveBeenCalled();
  });

  it('searches real Scope members and sends a friend request', async () => {
    vi.useFakeTimers();

    const priya = {
      id: 'user-6',
      username: 'priya.nair',
      email: 'priya@example.com',
      displayName: 'Priya Nair',
      avatarUrl: 'https://example.com/priya.png',
      homeBase: 'Houston, TX',
      interests: ['food', 'culture'],
    };

    searchUsersMock.mockResolvedValue({
      data: [priya],
      meta: { page: 1, pageSize: 1, total: 1, totalPages: 1 },
    });

    const router = createTestRouter();
    const wrapper = mount(FriendsPage, {
      global: {
        plugins: [router, createPinia()],
        stubs: globalStubs,
      },
    });

    await wrapper.get('input[aria-label="Search friends and Scope members"]').setValue('@priya');
    // SearchBar debounces (300ms) before emitting, then FriendsPage debounces (280ms) before calling the API.
    await vi.advanceTimersByTimeAsync(650);
    await flushPromises();

    expect(searchUsersMock).toHaveBeenCalledWith('priya', 1, expect.any(Number));
    const results = wrapper.findAll('[data-test="suggestion-card"]');
    expect(results).toHaveLength(1);
    expect(wrapper.text()).toContain('Priya Nair');
    expect(wrapper.text()).toContain('@priya.nair');

    const sendButton = wrapper.get('[data-test="send-request-user-6"]');
    expect(sendButton.text()).toContain('Send request');

    await sendButton.trigger('click');
    // Flush the dynamic analytics import chain before asserting the tracking call.
    await flushPromises();
    await flushPromises();

    expect(sendButton.text()).toContain('Request sent');
    expect((sendButton.element as HTMLButtonElement).disabled).toBe(true);
    expect(trackFriendAddMock).toHaveBeenCalledWith(expect.objectContaining({
      routeName: 'friends',
      source: 'search',
      userId: 'user-6',
    }));
  });

  it('shows a helpful empty state when search returns no results', async () => {
    vi.useFakeTimers();

    searchUsersMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 0, total: 0, totalPages: 1 },
    });

    const router = createTestRouter();
    const wrapper = mount(FriendsPage, {
      global: {
        plugins: [router, createPinia()],
        stubs: globalStubs,
      },
    });

    await wrapper.get('input[aria-label="Search friends and Scope members"]').setValue('nobody-here');
    await vi.advanceTimersByTimeAsync(650);
    await flushPromises();

    expect(wrapper.text()).toContain('No Scope members matched');
  });

  it('surfaces an API failure message without crashing the page', async () => {
    vi.useFakeTimers();

    searchUsersMock.mockRejectedValue(new Error('network down'));

    const router = createTestRouter();
    const wrapper = mount(FriendsPage, {
      global: {
        plugins: [router, createPinia()],
        stubs: globalStubs,
      },
    });

    await wrapper.get('input[aria-label="Search friends and Scope members"]').setValue('priya');
    await vi.advanceTimersByTimeAsync(650);
    await flushPromises();

    expect(wrapper.get('[data-test="find-people-error"]').text()).toContain('member search');
  });
});
