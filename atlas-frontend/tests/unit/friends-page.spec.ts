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
    fetchFeed: vi.fn().mockResolvedValue(undefined),
  },
  notificationsStoreMock: {
    items: [{ id: 'notification-1', title: 'Trip invite', isRead: false }],
    unreadCount: 3,
    loading: false,
    connectionState: 'connected',
    connectionError: null,
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
    expect(wrapper.findAll('.request-card-stub').length).toBeGreaterThan(0);
  });
});
