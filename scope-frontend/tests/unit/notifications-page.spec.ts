import { reactive } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';

const routerPush = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const getNotificationPreferences = vi.hoisted(() => vi.fn());
const updateNotificationPreference = vi.hoisted(() => vi.fn());
const enableBrowserPushNotifications = vi.hoisted(() => vi.fn());
const toastStoreMock = vi.hoisted(() => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

const notificationsStoreState = reactive({
  items: [] as Array<{
    id: string;
    title: string;
    body: string;
    isRead: boolean;
    createdAt: string;
    type: string;
    category?: string;
    templateKey?: string;
    actionUrl?: string;
  }>,
  unreadCount: 0,
  loading: false,
  connectionState: 'idle',
  connectionError: null as string | null,
  error: '',
});

const notificationsStoreMock = {
  get items() {
    return notificationsStoreState.items;
  },
  get unreadCount() {
    return notificationsStoreState.unreadCount;
  },
  get loading() {
    return notificationsStoreState.loading;
  },
  get connectionState() {
    return notificationsStoreState.connectionState;
  },
  get connectionError() {
    return notificationsStoreState.connectionError;
  },
  get error() {
    return notificationsStoreState.error;
  },
  fetchNotifications: vi.fn(async () => undefined),
  markAllRead: vi.fn(async () => {
    notificationsStoreState.items = notificationsStoreState.items.map((notification) => ({
      ...notification,
      isRead: true,
    }));
    notificationsStoreState.unreadCount = 0;
  }),
  markRead: vi.fn(async (notificationId: string) => {
    notificationsStoreState.items = notificationsStoreState.items.map((notification) =>
      notification.id === notificationId ? { ...notification, isRead: true } : notification,
    );
    notificationsStoreState.unreadCount = notificationsStoreState.items.filter((notification) => !notification.isRead).length;
    return notificationsStoreState.items.find((notification) => notification.id === notificationId);
  }),
  performAction: vi.fn(async () => undefined),
};

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock('@/services/feedService', () => ({
  getNotificationPreferences,
  updateNotificationPreference,
}));

vi.mock('@/services/pushNotificationService', () => ({
  enableBrowserPushNotifications,
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationsStore: () => notificationsStoreMock,
}));

vi.mock('@/stores/toasts', () => ({
  useToastStore: () => toastStoreMock,
}));

import NotificationsPage from '@/views/NotificationsPage.vue';

function mountPage() {
  return mount(NotificationsPage, {
    global: {
      stubs: {
        AppShell: { template: '<main><slot /></main>' },
        PageHero: {
          props: ['eyebrow', 'title', 'description'],
          template: '<header><h1>{{ title }}</h1><slot name="stats" /><slot name="actions" /></header>',
        },
      },
    },
  });
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    routerPush.mockClear();
    getNotificationPreferences.mockReset();
    updateNotificationPreference.mockReset();
    enableBrowserPushNotifications.mockReset();
    toastStoreMock.showSuccess.mockClear();
    toastStoreMock.showError.mockClear();
    notificationsStoreMock.fetchNotifications.mockClear();
    notificationsStoreMock.markAllRead.mockClear();
    notificationsStoreMock.markRead.mockClear();
    notificationsStoreMock.performAction.mockClear();
    notificationsStoreState.items = [
      {
        id: 'notification-1',
        title: 'Maya sent a friend request',
        body: 'Accept to plan together.',
        isRead: false,
        createdAt: '2026-03-29T10:00:00Z',
        type: 'friend.request',
        category: 'friends',
        actionUrl: '/friends',
      },
      {
        id: 'notification-2',
        title: 'Trip digest',
        body: 'Your crew changed the route.',
        isRead: true,
        createdAt: 'not-a-date',
        type: 'trip.update',
        category: 'trip',
      },
    ];
    notificationsStoreState.unreadCount = 1;
    notificationsStoreState.loading = false;
    notificationsStoreState.connectionState = 'idle';
    notificationsStoreState.connectionError = null;
    notificationsStoreState.error = '';
    getNotificationPreferences.mockResolvedValue({
      data: [
        {
          category: 'trip',
          inAppEnabled: true,
          pushEnabled: false,
          emailEnabled: true,
          digestCadence: 'daily',
          quietHoursStartMinutes: null,
          quietHoursEndMinutes: null,
          timeZoneId: 'UTC',
        },
      ],
    });
    updateNotificationPreference.mockImplementation(async (payload) => payload);
    enableBrowserPushNotifications.mockResolvedValue({ ok: true, message: 'Ready' });
  });

  it('renders, filters, marks, routes, and updates notification preferences', async () => {
    const wrapper = mountPage();
    await flushPromises();

    expect(notificationsStoreMock.fetchNotifications).toHaveBeenCalledWith(true);
    expect(wrapper.text()).toContain('1 unread');
    expect(wrapper.text()).toContain('Maya sent a friend request');
    expect(wrapper.text()).toContain('Trip digest');

    await wrapper.get('[data-test="notifications-filter-friend"]').trigger('click');
    expect(wrapper.text()).toContain('Maya sent a friend request');
    expect(wrapper.text()).not.toContain('Trip digest');

    await wrapper.findAll('.text-button').find((button) => button.text() === 'Accept')!.trigger('click');
    await wrapper.findAll('.text-button').find((button) => button.text() === 'Decline')!.trigger('click');
    await wrapper.findAll('.text-button').find((button) => button.text() === 'Mute type')!.trigger('click');
    expect(notificationsStoreMock.performAction).toHaveBeenCalledWith('notification-1', 'accept_friend_request');
    expect(notificationsStoreMock.performAction).toHaveBeenCalledWith('notification-1', 'decline_friend_request');
    expect(notificationsStoreMock.performAction).toHaveBeenCalledWith('notification-1', 'mute_category');

    await wrapper.get('[data-test="notifications-unread-toggle"] input').setValue(true);
    expect(wrapper.text()).toContain('Maya sent a friend request');

    await wrapper.get('.notification-card__main').trigger('click');
    await flushPromises();
    expect(notificationsStoreMock.markRead).toHaveBeenCalledWith('notification-1');
    expect(routerPush).toHaveBeenCalledWith('/friends');

    await wrapper.findAll('.mini-toggle').find((button) => button.text() === 'Push')!.trigger('click');
    expect(updateNotificationPreference).toHaveBeenCalledWith(expect.objectContaining({
      category: 'trip',
      pushEnabled: true,
      timeZoneId: expect.any(String),
    }));

    await wrapper.get('[data-test="notifications-enable-push"]').trigger('click');
    await flushPromises();
    expect(toastStoreMock.showSuccess).toHaveBeenCalledWith({
      title: 'Push enabled',
      message: 'Ready',
    });
  });

  it('handles direct read actions and delivery channel toggles', async () => {
    const wrapper = mountPage();
    await flushPromises();

    await wrapper.get('[data-test="notifications-mark-all-read"]').trigger('click');
    expect(notificationsStoreMock.markAllRead).toHaveBeenCalled();

    notificationsStoreState.items = notificationsStoreState.items.map((notification) =>
      notification.id === 'notification-1' ? { ...notification, isRead: false } : notification,
    );
    notificationsStoreState.unreadCount = 1;
    await wrapper.vm.$nextTick();

    await wrapper.findAll('.text-button').find((button) => button.text() === 'Mark read')!.trigger('click');
    expect(notificationsStoreMock.markRead).toHaveBeenCalledWith('notification-1');

    await wrapper.findAll('.mini-toggle').find((button) => button.text() === 'In-app')!.trigger('click');
    expect(updateNotificationPreference).toHaveBeenCalledWith(expect.objectContaining({
      category: 'trip',
      inAppEnabled: false,
      timeZoneId: expect.any(String),
    }));

    await flushPromises();
    await wrapper.findAll('.mini-toggle').find((button) => button.text() === 'Email')!.trigger('click');
    expect(updateNotificationPreference).toHaveBeenCalledWith(expect.objectContaining({
      category: 'trip',
      emailEnabled: false,
      timeZoneId: expect.any(String),
    }));
  });

  it('shows loading, error, and empty-state branches', async () => {
    notificationsStoreState.items = [];
    notificationsStoreState.unreadCount = 0;
    notificationsStoreState.loading = true;
    notificationsStoreState.connectionError = null;
    notificationsStoreState.error = '';
    const loadingWrapper = mountPage();
    await flushPromises();
    expect(loadingWrapper.find('.notification-skeleton-stack').exists()).toBe(true);
    expect(loadingWrapper.text()).toContain('Loading');

    notificationsStoreState.loading = false;
    notificationsStoreState.connectionError = 'Realtime inbox disconnected.';
    await loadingWrapper.vm.$nextTick();
    expect(loadingWrapper.get('[role="alert"]').text()).toBe('Realtime inbox disconnected.');

    notificationsStoreState.connectionError = null;
    notificationsStoreState.error = 'Inbox offline';
    await loadingWrapper.vm.$nextTick();
    expect(loadingWrapper.text()).toContain('Inbox offline');

    notificationsStoreState.error = '';
    await loadingWrapper.vm.$nextTick();
    expect(loadingWrapper.find('[data-test="notifications-empty-state"]').text()).toContain('Inbox is clear');
    expect(loadingWrapper.find('[data-test="notifications-empty-state"]').text()).toContain('Trip invite');
    expect(loadingWrapper.find('[data-test="empty-state-panel"]').exists()).toBe(false);

    await loadingWrapper.get('[data-test="notifications-unread-toggle"] input').setValue(true);
    expect(loadingWrapper.find('[data-test="notifications-empty-state"]').text()).toContain('No notifications match');
    await loadingWrapper.get('[data-test="notifications-clear-filters"]').trigger('click');
    expect((loadingWrapper.get('[data-test="notifications-unread-toggle"] input').element as HTMLInputElement).checked).toBe(false);
  });

  it('surfaces push opt-in failures with an error toast', async () => {
    enableBrowserPushNotifications.mockResolvedValueOnce({ ok: false, message: 'Denied' });
    const wrapper = mountPage();
    await flushPromises();

    await wrapper.get('[data-test="notifications-enable-push"]').trigger('click');
    await flushPromises();

    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Push not enabled',
      message: 'Denied',
    });
  });
});
