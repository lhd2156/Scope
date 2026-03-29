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

    const store = await bootstrapNotificationsStore();

    await store.connect();

    expect(store.connectionState).toBe('error');
    expect(store.connectionError).toBe('SignalR handshake failed');
  });
});
