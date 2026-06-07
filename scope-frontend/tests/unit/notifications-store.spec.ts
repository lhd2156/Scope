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
    vi.restoreAllMocks();
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

  it('drops stale notification results if the read scope changes while loading', async () => {
    let currentUser = { id: 'user-1', email: 'one@example.com', username: 'one' };
    let resolveFetch!: (value: { data: typeof unreadNotificationFixtures }) => void;
    const getNotifications = vi.fn(() => new Promise<{ data: typeof unreadNotificationFixtures }>((resolve) => {
      resolveFetch = resolve;
    }));

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
    const pendingFetch = store.fetchNotifications();

    currentUser = { id: 'user-2', email: 'two@example.com', username: 'two' };
    resolveFetch({ data: unreadNotificationFixtures });
    await pendingFetch;

    expect(store.items).toEqual([]);
    expect(store.hasLoaded).toBe(false);
    expect(store.loading).toBe(false);
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

  it('normalizes incomplete notifications, caches loaded scopes, and supports forced refreshes', async () => {
    const getNotifications = vi.fn()
      .mockResolvedValueOnce({
        data: [
          {
            id: '',
            title: '  Untitled update  ',
            body: 'Fallback id needed',
            isRead: false,
            createdAt: 'not-a-date',
            type: 'trip invite',
          },
          {
            id: 'notification-newer',
            title: 'Newer update',
            body: 'Sort me first',
            isRead: false,
            createdAt: '2026-03-29T20:00:00Z',
            type: 'trip.member.added',
          },
        ],
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'notification-forced',
            title: 'Forced refresh',
            body: 'A forced fetch bypasses the cache.',
            isRead: false,
            createdAt: '2026-03-30T20:00:00Z',
            type: 'trip.member.added',
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
        currentUser: { id: 'User 1 / Demo', email: 'demo@scope.travel', username: 'scopedemo' },
      }),
    }));

    vi.doMock('@/stores/toasts', () => ({
      useToastStore: () => ({ showInfo: vi.fn(), showError: vi.fn() }),
    }));

    const store = await bootstrapNotificationsStore();

    await store.fetchNotifications();

    expect(store.items[0].id).toBe('notification-newer');
    expect(store.items[1].id).toContain('notification-trip-invite-not-a-date-untitled-update');
    expect(store.items[1].title).toBe('Untitled update');

    await store.fetchNotifications();
    expect(getNotifications).toHaveBeenCalledTimes(1);

    await store.fetchNotifications(true);
    expect(getNotifications).toHaveBeenCalledTimes(2);
    expect(store.items[0].id).toBe('notification-forced');
  });

  it('keeps guest realtime idle and records disconnect errors without leaving a live state', async () => {
    const startNotificationStream = vi.fn();
    const stopNotificationStream = vi.fn().mockRejectedValue(new Error('Stop failed'));

    vi.doMock('@/services/feedService', () => ({
      getNotifications: vi.fn(),
      markNotificationRead: vi.fn(),
      markAllNotificationsRead: vi.fn(),
    }));

    vi.doMock('@/services/signalrService', () => ({
      startNotificationStream,
      stopNotificationStream,
    }));

    vi.doMock('@/stores/auth', () => ({
      useAuthStore: () => ({ isAuthenticated: false, token: '' }),
    }));

    vi.doMock('@/stores/toasts', () => ({
      useToastStore: () => ({ showInfo: vi.fn(), showError: vi.fn() }),
    }));

    const store = await bootstrapNotificationsStore();

    await store.connect();
    expect(startNotificationStream).not.toHaveBeenCalled();
    expect(store.connectionState).toBe('idle');
    expect(store.connectionError).toBeNull();

    await store.disconnect();
    expect(stopNotificationStream).toHaveBeenCalledTimes(1);
    expect(store.connectionState).toBe('idle');
    expect(store.connectionError).toBe('Stop failed');
  });

  it('rolls back failed read mutations and reports toast errors', async () => {
    const toastStoreMock = {
      showInfo: vi.fn(),
      showError: vi.fn(),
    };
    const markNotificationRead = vi.fn().mockRejectedValue(new Error('Read failed'));
    const markAllNotificationsRead = vi.fn().mockRejectedValue(new Error('Read all failed'));

    vi.doMock('@/services/feedService', () => ({
      getNotifications: vi.fn().mockResolvedValue({ data: unreadNotificationFixtures }),
      markNotificationRead,
      markAllNotificationsRead,
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
      useToastStore: () => toastStoreMock,
    }));

    const store = await bootstrapNotificationsStore();

    await store.fetchNotifications();
    await store.markRead('   ');
    await store.markRead('missing-notification');
    expect(markNotificationRead).not.toHaveBeenCalled();

    await store.markRead('notification-1');
    expect(store.items.find((notification) => notification.id === 'notification-1')?.isRead).toBe(false);
    expect(store.error).toBe('Read failed');
    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Notification update failed',
      message: 'Read failed',
    });

    await store.markAllRead();
    expect(store.items.some((notification) => !notification.isRead)).toBe(true);
    expect(store.error).toBe('Read all failed');
    expect(toastStoreMock.showError).toHaveBeenLastCalledWith({
      title: 'Notification update failed',
      message: 'Read all failed',
    });
  });

  it('dedupes realtime notifications while preserving local read state', async () => {
    vi.doMock('@/services/feedService', () => ({
      getNotifications: vi.fn(),
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
        currentUser: { id: 'user-1', email: 'demo@scope.travel', username: 'scopedemo' },
      }),
    }));

    vi.doMock('@/stores/toasts', () => ({
      useToastStore: () => ({ showInfo: vi.fn(), showError: vi.fn() }),
    }));

    const store = await bootstrapNotificationsStore();

    store.addNotification({
      id: 'notification-1',
      title: 'Read once',
      body: 'Already handled',
      isRead: true,
      createdAt: '2026-03-29T20:00:00Z',
      type: 'trip.member.added',
    });
    store.addNotification({
      id: 'notification-1',
      title: 'Read once updated',
      body: 'Duplicate realtime payload',
      isRead: false,
      createdAt: '2026-03-29T21:00:00Z',
      type: 'trip.member.added',
    });

    expect(store.items).toHaveLength(1);
    expect(store.items[0]).toMatchObject({
      id: 'notification-1',
      title: 'Read once updated',
      isRead: true,
    });
    expect(store.unreadCount).toBe(0);
  });

  it('persists already-read notification ids without re-calling the read-all endpoint', async () => {
    const markAllNotificationsRead = vi.fn();

    vi.doMock('@/services/feedService', () => ({
      getNotifications: vi.fn(),
      markNotificationRead: vi.fn(),
      markAllNotificationsRead,
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

    store.addNotification({
      ...unreadNotificationFixtures[0]!,
      isRead: true,
    });
    await store.markAllRead();

    expect(markAllNotificationsRead).not.toHaveBeenCalled();
    expect(store.items.every((notification) => notification.isRead)).toBe(true);
  });

  it('performs optimistic notification actions, removes handled friend requests, and persists handled ids', async () => {
    const performNotificationAction = vi.fn().mockResolvedValue({ ok: true });

    vi.doMock('@/services/feedService', () => ({
      getNotifications: vi.fn().mockResolvedValue({ data: unreadNotificationFixtures }),
      markNotificationRead: vi.fn(),
      markAllNotificationsRead: vi.fn(),
      performNotificationAction,
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
    await store.performAction(' notification-1 ', ' accept_friend_request ');
    await store.performAction('notification-2', 'decline_friend_request');
    await store.performAction('', 'open');
    await store.performAction('notification-1', '   ');

    expect(performNotificationAction).toHaveBeenCalledTimes(2);
    expect(performNotificationAction).toHaveBeenNthCalledWith(1, 'notification-1', 'accept_friend_request');
    expect(performNotificationAction).toHaveBeenNthCalledWith(2, 'notification-2', 'decline_friend_request');
    expect(store.items).toHaveLength(0);

    setActivePinia(createPinia());
    const { useNotificationsStore } = await import('@/stores/notifications');
    const freshStore = useNotificationsStore();
    await freshStore.fetchNotifications();

    expect(freshStore.items.every((notification) => notification.isRead)).toBe(true);
  });

  it('rolls back failed notification actions and reports the error toast', async () => {
    const toastStoreMock = {
      showInfo: vi.fn(),
      showError: vi.fn(),
    };
    const performNotificationAction = vi.fn().mockRejectedValue(new Error('Action failed'));

    vi.doMock('@/services/feedService', () => ({
      getNotifications: vi.fn().mockResolvedValue({ data: unreadNotificationFixtures }),
      markNotificationRead: vi.fn(),
      markAllNotificationsRead: vi.fn(),
      performNotificationAction,
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
      useToastStore: () => toastStoreMock,
    }));

    const store = await bootstrapNotificationsStore();

    await store.fetchNotifications();
    await store.performAction('notification-1', 'open');

    expect(store.items.find((notification) => notification.id === 'notification-1')?.isRead).toBe(false);
    expect(store.error).toBe('Action failed');
    expect(toastStoreMock.showError).toHaveBeenCalledWith({
      title: 'Notification action failed',
      message: 'Action failed',
    });
  });

  it('applies realtime state callbacks and falls back to default toast copy', async () => {
    const toastStoreMock = {
      showInfo: vi.fn(),
      showError: vi.fn(),
    };
    let streamOptions: {
      onNotification: (notification: any) => void;
      onStateChange: (state: string) => void;
      onError: (message: string | null) => void;
    } | null = null;

    vi.doMock('@/services/feedService', () => ({
      getNotifications: vi.fn(),
      markNotificationRead: vi.fn(),
      markAllNotificationsRead: vi.fn(),
      performNotificationAction: vi.fn(),
    }));

    vi.doMock('@/services/signalrService', () => ({
      startNotificationStream: vi.fn().mockImplementation(async (options) => {
        streamOptions = options;
      }),
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
      useToastStore: () => toastStoreMock,
    }));

    const store = await bootstrapNotificationsStore();

    await store.connect();
    streamOptions?.onStateChange('connected');
    expect(store.connectionState).toBe('connected');
    expect(store.isRealtimeConnected).toBe(true);

    streamOptions?.onError('Transport lost');
    expect(store.connectionState).toBe('error');
    expect(store.connectionError).toBe('Transport lost');

    streamOptions?.onNotification({
      id: 'notification-default-toast',
      title: '',
      body: '',
      isRead: false,
      createdAt: '2026-03-30T20:00:00Z',
      type: 'trip.member.added',
    });

    expect(toastStoreMock.showInfo).toHaveBeenCalledWith({
      title: 'Scope update',
      message: 'A fresh Scope notification just landed in your inbox.',
      autoHideMs: 5000,
    });
  });

  it('does not call mark-all when the inbox has no notification ids', async () => {
    const markAllNotificationsRead = vi.fn();

    vi.doMock('@/services/feedService', () => ({
      getNotifications: vi.fn(),
      markNotificationRead: vi.fn(),
      markAllNotificationsRead,
      performNotificationAction: vi.fn(),
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

    await store.markAllRead();

    expect(markAllNotificationsRead).not.toHaveBeenCalled();
  });

  it('trims the persisted read-id ledger to the newest notification ids', async () => {
    vi.doMock('@/services/feedService', () => ({
      getNotifications: vi.fn(),
      markNotificationRead: vi.fn(),
      markAllNotificationsRead: vi.fn(),
      performNotificationAction: vi.fn(),
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

    for (let index = 0; index < 502; index += 1) {
      store.addNotification({
        id: `read-${index}`,
        title: `Read ${index}`,
        body: 'Already read',
        isRead: true,
        createdAt: `2026-03-30T20:${String(index % 60).padStart(2, '0')}:00Z`,
        type: 'trip.member.added',
      });
    }

    const persistedValue = localStorage.getItem('scope-notification-read-state-v1:user-1');
    const persisted = JSON.parse(persistedValue ?? '{}') as { readIds: string[] };

    expect(persisted.readIds).toHaveLength(500);
    expect(persisted.readIds[0]).toBe('read-2');
    expect(persisted.readIds.at(-1)).toBe('read-501');
  });

  it('ignores stale or malformed stored read state and keeps working through storage failures', async () => {
    const storageKey = 'scope-notification-read-state-v1:user-1';
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('remove blocked');
    });
    const markNotificationRead = vi.fn().mockResolvedValue(undefined);

    localStorage.setItem(storageKey, JSON.stringify({ version: 999, readIds: ['notification-1'] }));

    vi.doMock('@/services/feedService', () => ({
      getNotifications: vi.fn().mockResolvedValue({ data: unreadNotificationFixtures }),
      markNotificationRead,
      markAllNotificationsRead: vi.fn(),
      performNotificationAction: vi.fn(),
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
    expect(removeItemSpy).toHaveBeenCalledWith(storageKey);
    expect(store.items.find((notification) => notification.id === 'notification-1')?.isRead).toBe(false);

    removeItemSpy.mockRestore();
    localStorage.setItem(storageKey, '{not-json');
    await store.fetchNotifications(true);
    expect(localStorage.getItem(storageKey)).toBe(JSON.stringify({ version: 1, readIds: [] }));

    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
      throw new Error('get blocked');
    });
    await store.fetchNotifications(true);
    expect(getItemSpy).toHaveBeenCalledWith(storageKey);

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    await store.markRead('notification-1');

    expect(markNotificationRead).toHaveBeenCalledWith('notification-1');
    expect(store.items.find((notification) => notification.id === 'notification-1')?.isRead).toBe(true);
    setItemSpy.mockRestore();
  });
});
