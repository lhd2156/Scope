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

  it('renders every realtime and notification category state', async () => {
    notificationsStoreState.items = [
      { id: 'trip', title: 'Trip', body: 'Trip', isRead: true, createdAt: '2026-01-01T10:00:00Z', type: 'trip.updated' },
      { id: 'friend', title: 'Friend', body: 'Friend', isRead: true, createdAt: '2026-01-01T10:00:00Z', type: 'friend.request' },
      { id: 'social', title: 'Social', body: 'Social', isRead: true, createdAt: '2026-01-01T10:00:00Z', type: 'spot.reviewed', category: 'general' },
      { id: 'comment', title: 'Comment', body: 'Comment', isRead: true, createdAt: '2026-01-01T10:00:00Z', type: 'comment.created' },
      { id: 'mention', title: 'Mention', body: 'Mention', isRead: true, createdAt: '2026-01-01T10:00:00Z', type: 'mention.created' },
      { id: 'route', title: 'Route', body: 'Route', isRead: true, createdAt: '2026-01-01T10:00:00Z', type: 'intel_route_ready' },
      { id: 'weather', title: 'Weather', body: 'Weather', isRead: true, createdAt: '2026-01-01T10:00:00Z', type: 'weather.alert' },
      { id: 'security', title: 'Security', body: 'Security', isRead: true, createdAt: '2026-01-01T10:00:00Z', type: 'security.login' },
      { id: 'account', title: 'Account', body: 'Account', isRead: true, createdAt: '2026-01-01T10:00:00Z', type: 'profile.updated' },
      { id: 'system', title: 'System', body: 'System', isRead: true, createdAt: '2026-01-01T10:00:00Z', type: 'system.maintenance' },
      { id: 'friends-alias', title: 'Friends alias', body: 'Friends', isRead: true, createdAt: '2026-01-01T10:00:00Z', type: 'custom.event', category: 'friends' },
      { id: 'trips-alias', title: 'Trips alias', body: 'Trips', isRead: true, createdAt: '2026-01-01T10:00:00Z', type: 'custom.event', category: 'trips' },
      { id: 'comments-alias', title: 'Comments alias', body: 'Comments', isRead: true, createdAt: '2026-01-01T10:00:00Z', type: 'custom.event', category: 'comments' },
      { id: 'mentions-alias', title: 'Mentions alias', body: 'Mentions', isRead: true, createdAt: '2026-01-01T10:00:00Z', type: 'custom.event', category: 'mentions' },
      { id: 'routes-alias', title: 'Routes alias', body: 'Routes', isRead: true, createdAt: '2026-01-01T10:00:00Z', type: 'custom.event', category: 'routes' },
      { id: 'spots-alias', title: 'Spots alias', body: 'Spots', isRead: true, createdAt: '2026-01-01T10:00:00Z', type: 'custom.event', category: 'spots' },
      { id: 'systems-alias', title: 'Systems alias', body: 'Systems', isRead: true, createdAt: '2026-01-01T10:00:00Z', type: 'custom.event', category: 'systems' },
      { id: 'general', title: 'General', body: 'General', isRead: true, createdAt: '2026-01-01T10:00:00Z', type: '' },
      { id: 'custom-type', title: 'Custom type', body: 'Custom type', isRead: true, createdAt: '2026-01-01T10:00:00Z', type: 'custom.event' },
      { id: 'custom', title: 'Custom', body: 'Custom', isRead: true, createdAt: '2026-01-01T10:00:00Z', type: 'custom.event', category: 'Custom Alerts' },
    ];
    notificationsStoreState.unreadCount = 0;
    const wrapper = mountPage();
    await flushPromises();

    for (const category of [
      'trip',
      'friend',
      'social',
      'comment',
      'mention',
      'route',
      'weather',
      'security',
      'account',
      'system',
      'general',
      'custom-alerts',
    ]) {
      expect(wrapper.find(`[data-test="notifications-filter-${category}"]`).exists()).toBe(true);
    }
    expect(wrapper.text()).toContain('Custom Alerts');

    const stateLabels: Array<[string, string]> = [
      ['connected', 'Realtime connected'],
      ['connecting', 'Realtime connecting'],
      ['reconnecting', 'Realtime reconnecting'],
      ['disconnected', 'Realtime offline'],
      ['error', 'Realtime paused'],
      ['idle', 'Realtime ready'],
    ];
    for (const [state, label] of stateLabels) {
      notificationsStoreState.connectionState = state;
      await wrapper.vm.$nextTick();
      expect(wrapper.text()).toContain(label);
    }
  });

  it('formats delivery cadences and quiet-hour boundaries', async () => {
    getNotificationPreferences.mockResolvedValueOnce({
      data: [
        {
          category: 'trip',
          inAppEnabled: true,
          pushEnabled: true,
          emailEnabled: true,
          digestCadence: 'instant',
          quietHoursStartMinutes: -10,
          quietHoursEndMinutes: 1500,
          timeZoneId: 'UTC',
        },
        {
          category: 'friend',
          inAppEnabled: false,
          pushEnabled: false,
          emailEnabled: false,
          digestCadence: 'off',
          quietHoursStartMinutes: null,
          quietHoursEndMinutes: null,
          timeZoneId: 'UTC',
        },
        {
          category: 'custom alerts',
          inAppEnabled: true,
          pushEnabled: false,
          emailEnabled: false,
          digestCadence: 'weekly',
          quietHoursStartMinutes: 60,
          quietHoursEndMinutes: 120,
          timeZoneId: 'UTC',
        },
      ],
    });

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('Instant delivery');
    expect(wrapper.text()).toContain('Digest off');
    expect(wrapper.text()).toContain('Weekly cadence');
    expect(wrapper.text()).toContain('No quiet hours');
    expect(wrapper.text()).toContain('Quiet');
    expect(wrapper.text()).toContain('3 categories configured');
    expect(wrapper.find('.delivery-meter').text()).toContain('2');
  });

  it('surfaces preference, inbox action, and notification open failures', async () => {
    notificationsStoreMock.fetchNotifications.mockRejectedValueOnce(new Error('inbox unavailable'));
    getNotificationPreferences.mockRejectedValueOnce(new Error('preferences unavailable'));
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('preferences unavailable');
    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Notification action failed',
      message: 'inbox unavailable',
    });

    toastStoreMock.showError.mockClear();
    getNotificationPreferences.mockResolvedValueOnce({
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
    const preferenceWrapper = mountPage();
    await flushPromises();
    updateNotificationPreference.mockRejectedValueOnce(new Error('preference offline'));
    await preferenceWrapper.findAll('.mini-toggle').find((button) => button.text() === 'Push')!.trigger('click');
    await flushPromises();
    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Preference not saved',
      message: 'preference offline',
    });

    toastStoreMock.showError.mockClear();
    notificationsStoreMock.markRead.mockRejectedValueOnce(new Error('read failed'));
    await preferenceWrapper.get('.notification-card__main').trigger('click');
    await flushPromises();
    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Notification not opened',
      message: 'read failed',
    });
  });

  it('does not route unsafe or empty notification targets', async () => {
    notificationsStoreState.items = [
      {
        id: 'unsafe',
        title: 'Unsafe target',
        body: 'Should stay in Scope.',
        isRead: true,
        createdAt: '2026-01-01T10:00:00Z',
        type: 'system.alert',
        actionUrl: 'https://malicious.example/phish',
      },
    ];
    notificationsStoreState.unreadCount = 0;
    const wrapper = mountPage();
    await flushPromises();

    await wrapper.get('.notification-card__main').trigger('click');
    await flushPromises();

    expect(notificationsStoreMock.markRead).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });
});
