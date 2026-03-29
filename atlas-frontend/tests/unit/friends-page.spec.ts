import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';

const { authStoreMock, feedStoreMock, notificationsStoreMock } = vi.hoisted(() => ({
  authStoreMock: {
    currentUser: {
      id: 'user-1',
      displayName: 'Louis Do',
    },
  },
  feedStoreMock: {
    items: [{ id: 'feed-1', title: 'Pinned Sunset Rooftop Tacos' }],
    loading: false,
    error: '',
    fetchFeed: vi.fn().mockResolvedValue(undefined),
  },
  notificationsStoreMock: {
    items: [{ id: 'notification-1', title: 'Trip invite', isRead: false }],
    unreadCount: 3,
    loading: false,
    connectionState: 'connected',
    connectionError: null,
    error: '',
    fetchNotifications: vi.fn().mockResolvedValue(undefined),
    markAllRead: vi.fn(),
    markRead: vi.fn(),
  },
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

vi.mock('@/stores/feed', () => ({
  useFeedStore: () => feedStoreMock,
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationsStore: () => notificationsStoreMock,
}));

import FriendsPage from '@/views/FriendsPage.vue';

describe('FriendsPage', () => {
  beforeEach(() => {
    feedStoreMock.error = '';
    notificationsStoreMock.error = '';
    feedStoreMock.fetchFeed.mockClear();
    notificationsStoreMock.fetchNotifications.mockClear();
  });

  it('renders the social workspace and loads feed plus notification data', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/friends', component: FriendsPage },
        { path: '/profile/:id', component: { template: '<div>Profile target</div>' } },
        { path: '/trips/new', component: { template: '<div>Trip planner target</div>' } },
      ],
    });

    await router.push('/friends');
    await router.isReady();

    const wrapper = mount(FriendsPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          FeedItem: { props: ['item'], template: '<div class="feed-item-stub">{{ item.title }}</div>' },
          FriendList: { template: '<div data-test="friend-list-stub">Friend list</div>' },
          NotificationDropdown: { template: '<div data-test="notification-stub">Notifications</div>' },
          UserCard: { props: ['eyebrow'], template: '<div class="request-card-stub">{{ eyebrow }}</div>' },
        },
      },
    });

    await flushPromises();

    expect(feedStoreMock.fetchFeed).toHaveBeenCalledTimes(1);
    expect(notificationsStoreMock.fetchNotifications).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Louis Do');
    expect(wrapper.text()).toContain('3');
    expect(wrapper.find('[data-test="friend-list-stub"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="notification-stub"]').exists()).toBe(true);
  });

  it('routes to a friend profile when the connection list requests it', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/friends', component: FriendsPage },
        { path: '/profile/:id', component: { template: '<div>Profile target</div>' } },
      ],
    });

    await router.push('/friends');
    await router.isReady();

    const wrapper = mount(FriendsPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          FeedItem: { template: '<div />' },
          FriendList: {
            emits: ['view-profile'],
            template: '<button data-test="open-profile" @click="$emit(\'view-profile\', \'user-3\')">Open</button>',
          },
          NotificationDropdown: { template: '<div />' },
          UserCard: { template: '<div />' },
        },
      },
    });

    await wrapper.get('[data-test="open-profile"]').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe('/profile/user-3');
  });

  it('shows an inline workspace error when feed loading fails', async () => {
    feedStoreMock.error = 'Atlas could not load the activity feed right now.';
    feedStoreMock.fetchFeed.mockRejectedValue(new Error('Feed failed'));

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/friends', component: FriendsPage }],
    });

    await router.push('/friends');
    await router.isReady();

    const wrapper = mount(FriendsPage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          FeedItem: { template: '<div />' },
          FriendList: { template: '<div />' },
          NotificationDropdown: { template: '<div />' },
          UserCard: { template: '<div />' },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('Part of the social workspace is offline');
    expect(wrapper.text()).toContain('Atlas could not load the activity feed right now.');
  });
});
