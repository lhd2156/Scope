import { createPinia, setActivePinia } from 'pinia';

async function bootstrapNotificationsStore() {
  setActivePinia(createPinia());
  const { useNotificationsStore } = await import('@/stores/notifications');
  return useNotificationsStore();
}

describe('notifications store async error handling', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
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
