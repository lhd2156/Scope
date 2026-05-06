import { createPinia, setActivePinia } from 'pinia';

async function bootstrapNotificationsStore() {
  setActivePinia(createPinia());
  const { useNotificationsStore } = await import('@/stores/notifications');
  return useNotificationsStore();
}

const unreadNotificationFixtures = [
  {
    id: 'notification-1',
    title: 'Trip member joined',
    body: 'Aisha joined North Texas Night + Food Loop and synced the dinner shortlist.',
    isRead: false,
    createdAt: '2026-03-27T03:00:00Z',
    type: 'trip.member.added',
  },
  {
    id: 'notification-2',
    title: 'Review posted',
    body: 'Maya left a new 4.8-star review on Trinity Bluff Sunrise.',
    isRead: false,
    createdAt: '2026-03-26T15:20:00Z',
    type: 'spot.reviewed',
  },
];

describe('notifications store async error handling', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.doUnmock('@/services/feedService');
    vi.doUnmock('@/services/signalrService');
    vi.doUnmock('@/stores/auth');
    vi.doUnmock('@/stores/toasts');
  });

  it('captures fetch failures without leaving the store loading', async () => {
    vi.doMock('@/services/feedService', () => ({
      getNotifications: vi.fn().mockRejectedValue(new Error('Notification API offline')),
      markNotificationRead: vi.fn(),
      markAllNotificationsRead: vi.fn(),
    }));

    vi.doMock('@/services/signalrService', () => ({
      startNotificationStream: vi.fn(),
      stopNotificationStream: vi.fn(),
    }));

    vi.doMock('@/stores/auth', () => ({
      useAuthStore: () => ({ isAuthenticated: false, token: '' }),
    }));

    vi.doMock('@/stores/toasts', () => ({
      useToastStore: () => ({ showInfo: vi.fn(), showError: vi.fn() }),
    }));

    const store = await bootstrapNotificationsStore();

    await expect(store.fetchNotifications()).rejects.toThrow('Notification API offline');

    expect(store.loading).toBe(false);
    expect(store.error).toBe('Notification API offline');
  });

  it('keeps a single read notification read when fallback data is fetched again', async () => {
    const getNotifications = vi.fn().mockResolvedValue({
      data: unreadNotificationFixtures,
    });
    const markNotificationRead = vi.fn().mockResolvedValue({
      ...unreadNotificationFixtures[0]!,
      isRead: true,
    });

    vi.doMock('@/services/feedService', () => ({
      getNotifications,
      markNotificationRead,
      markAllNotificationsRead: vi.fn(),
    }));

    vi.doMock('@/services/signalrService', () => ({
      startNotificationStream: vi.fn(),
      stopNotificationStream: vi.fn(),
    }));

    vi.doMock('@/stores/auth', () => ({
      useAuthStore: () => ({
        isAuthenticated: true,
        token: 'secure-token',
        currentUser: { id: 'user-1', email: 'demo@scope.travel', username: 'scopedemo' },
      }),
    }));

    vi.doMock('@/stores/toasts', () => ({
      useToastStore: () => ({ showInfo: vi.fn(), showError: vi.fn() }),
    }));

    const store = await bootstrapNotificationsStore();

    await store.fetchNotifications();
    expect(store.unreadCount).toBe(2);

    await store.markRead(' notification-1 ');
    expect(markNotificationRead).toHaveBeenCalledWith('notification-1');
    expect(store.unreadCount).toBe(1);

    setActivePinia(createPinia());
    const { useNotificationsStore } = await import('@/stores/notifications');
    const freshStore = useNotificationsStore();

    await freshStore.fetchNotifications();

    expect(freshStore.items.find((notification) => notification.id === 'notification-1')?.isRead).toBe(true);
    expect(freshStore.items.find((notification) => notification.id === 'notification-2')?.isRead).toBe(false);
    expect(freshStore.unreadCount).toBe(1);
  });

  it('keeps mark-all reads across a fresh store even if the same fallback data is still unread', async () => {
    vi.doMock('@/services/feedService', () => ({
      getNotifications: vi.fn().mockResolvedValue({
        data: unreadNotificationFixtures,
      }),
      markNotificationRead: vi.fn(),
      markAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
    }));

    vi.doMock('@/services/signalrService', () => ({
      startNotificationStream: vi.fn(),
      stopNotificationStream: vi.fn(),
    }));

    vi.doMock('@/stores/auth', () => ({
      useAuthStore: () => ({
        isAuthenticated: true,
        token: 'secure-token',
        currentUser: { id: 'user-1', email: 'demo@scope.travel', username: 'scopedemo' },
      }),
    }));

    vi.doMock('@/stores/toasts', () => ({
      useToastStore: () => ({ showInfo: vi.fn(), showError: vi.fn() }),
    }));

    const store = await bootstrapNotificationsStore();

    await store.fetchNotifications();
    expect(store.unreadCount).toBe(2);

    await store.markAllRead();
    expect(store.unreadCount).toBe(0);

    setActivePinia(createPinia());
    const { useNotificationsStore } = await import('@/stores/notifications');
    const freshStore = useNotificationsStore();

    await freshStore.fetchNotifications();

    expect(freshStore.items.every((notification) => notification.isRead)).toBe(true);
    expect(freshStore.unreadCount).toBe(0);
  });

  it('refetches notifications when the authenticated user changes', async () => {
    let currentUser = { id: 'user-1', email: 'one@example.com', username: 'one' };
    const getNotifications = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            ...unreadNotificationFixtures[0]!,
            id: 'notification-user-1',
            title: 'User one update',
          },
        ],
      })
      .mockResolvedValueOnce({
        data: [
          {
            ...unreadNotificationFixtures[0]!,
            id: 'notification-user-2',
            title: 'User two update',
          },
        ],
      });

    vi.doMock('@/services/feedService', () => ({
      getNotifications,
      markNotificationRead: vi.fn(),
      markAllNotificationsRead: vi.fn(),
    }));

    vi.doMock('@/services/signalrService', () => ({
      startNotificationStream: vi.fn(),
      stopNotificationStream: vi.fn(),
    }));

    vi.doMock('@/stores/auth', () => ({
      useAuthStore: () => ({
        isAuthenticated: true,
        token: 'secure-token',
        currentUser,
      }),
    }));

    vi.doMock('@/stores/toasts', () => ({
      useToastStore: () => ({ showInfo: vi.fn(), showError: vi.fn() }),
    }));

    const store = await bootstrapNotificationsStore();

    await store.fetchNotifications();
    expect(store.items[0].id).toBe('notification-user-1');

    currentUser = { id: 'user-2', email: 'two@example.com', username: 'two' };
    await store.fetchNotifications();

    expect(getNotifications).toHaveBeenCalledTimes(2);
    expect(store.items[0].id).toBe('notification-user-2');
  });

  it('captures realtime connection errors from the SignalR bridge', async () => {
    vi.doMock('@/services/feedService', () => ({
      getNotifications: vi.fn(),
      markNotificationRead: vi.fn(),
      markAllNotificationsRead: vi.fn(),
    }));

    vi.doMock('@/services/signalrService', () => ({
      startNotificationStream: vi.fn().mockRejectedValue(new Error('SignalR handshake failed')),
      stopNotificationStream: vi.fn(),
    }));

    vi.doMock('@/stores/auth', () => ({
      useAuthStore: () => ({ isAuthenticated: true, token: 'secure-token' }),
    }));

    vi.doMock('@/stores/toasts', () => ({
      useToastStore: () => ({ showInfo: vi.fn(), showError: vi.fn() }),
    }));

    const store = await bootstrapNotificationsStore();

    await store.connect();

    expect(store.connectionState).toBe('error');
    expect(store.connectionError).toBe('SignalR handshake failed');
  });

  it('keeps the realtime status idle when the bridge clears errors without opening a live connection', async () => {
    vi.doMock('@/services/feedService', () => ({
      getNotifications: vi.fn(),
      markNotificationRead: vi.fn(),
      markAllNotificationsRead: vi.fn(),
    }));

    vi.doMock('@/services/signalrService', () => ({
      startNotificationStream: vi.fn().mockImplementation(async (options) => {
        options.onStateChange?.('idle');
        options.onError?.(null);
      }),
      stopNotificationStream: vi.fn(),
    }));

    vi.doMock('@/stores/auth', () => ({
      useAuthStore: () => ({ isAuthenticated: true, token: 'secure-token' }),
    }));

    vi.doMock('@/stores/toasts', () => ({
      useToastStore: () => ({ showInfo: vi.fn(), showError: vi.fn() }),
    }));

    const store = await bootstrapNotificationsStore();

    await store.connect();

    expect(store.connectionState).toBe('idle');
    expect(store.connectionError).toBeNull();
  });

  it('adds realtime notifications to the inbox and shows a toast for the incoming update', async () => {
    const toastStoreMock = {
      showInfo: vi.fn(),
      showError: vi.fn(),
    };
    let streamOptions: { onNotification: (notification: any) => void } | null = null;

    vi.doMock('@/services/feedService', () => ({
      getNotifications: vi.fn(),
      markNotificationRead: vi.fn(),
      markAllNotificationsRead: vi.fn(),
    }));

    vi.doMock('@/services/signalrService', () => ({
      startNotificationStream: vi.fn().mockImplementation(async (options) => {
        streamOptions = options;
      }),
      stopNotificationStream: vi.fn(),
    }));

    vi.doMock('@/stores/auth', () => ({
      useAuthStore: () => ({ isAuthenticated: true, token: 'secure-token' }),
    }));

    vi.doMock('@/stores/toasts', () => ({
      useToastStore: () => toastStoreMock,
    }));

    const store = await bootstrapNotificationsStore();

    await store.connect();
    streamOptions?.onNotification({
      id: 'notification-1',
      title: 'Trip invite',
      body: 'Maya invited you to Sunset Loop.',
      isRead: false,
      createdAt: '2026-03-29T20:00:00Z',
      type: 'trip-invite',
    });

    expect(store.items).toHaveLength(1);
    expect(store.items[0].title).toBe('Trip invite');
    expect(toastStoreMock.showInfo).toHaveBeenCalledWith({
      title: 'Trip invite',
      message: 'Maya invited you to Sunset Loop.',
      autoHideMs: 5000,
    });
  });
});
