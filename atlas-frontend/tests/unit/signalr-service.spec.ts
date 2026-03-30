const signalrMock = vi.hoisted(() => ({
  connection: {
    state: 'Disconnected',
    start: vi.fn(),
    stop: vi.fn(),
    on: vi.fn(),
    onreconnecting: vi.fn(),
    onreconnected: vi.fn(),
    onclose: vi.fn(),
  },
  builder: {
    withUrl: vi.fn(),
    withAutomaticReconnect: vi.fn(),
    configureLogging: vi.fn(),
    build: vi.fn(),
  },
}));

vi.mock('@microsoft/signalr', () => ({
  HubConnectionBuilder: class {
    withUrl(...args: unknown[]) {
      signalrMock.builder.withUrl(...args);
      return this;
    }

    withAutomaticReconnect(...args: unknown[]) {
      signalrMock.builder.withAutomaticReconnect(...args);
      return this;
    }

    configureLogging(...args: unknown[]) {
      signalrMock.builder.configureLogging(...args);
      return this;
    }

    build() {
      return signalrMock.builder.build();
    }
  },
  HubConnectionState: {
    Disconnected: 'Disconnected',
    Connected: 'Connected',
    Reconnecting: 'Reconnecting',
  },
  LogLevel: {
    Information: 2,
    Warning: 3,
  },
}));

describe('signalrService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    delete (window as Window & { __ATLAS_VISUAL_QA__?: boolean }).__ATLAS_VISUAL_QA__;

    signalrMock.connection.state = 'Disconnected';
    signalrMock.connection.start.mockReset().mockImplementation(async () => {
      signalrMock.connection.state = 'Connected';
    });
    signalrMock.connection.stop.mockReset().mockImplementation(async () => {
      signalrMock.connection.state = 'Disconnected';
    });
    signalrMock.connection.on.mockReset();
    signalrMock.connection.onreconnecting.mockReset();
    signalrMock.connection.onreconnected.mockReset();
    signalrMock.connection.onclose.mockReset();

    signalrMock.builder.withUrl.mockReset();
    signalrMock.builder.withAutomaticReconnect.mockReset();
    signalrMock.builder.configureLogging.mockReset();
    signalrMock.builder.build.mockReset().mockReturnValue(signalrMock.connection);
  });

  it('builds and starts the notification hub with JWT auth', async () => {
    const { startNotificationStream } = await import('@/services/signalrService');
    const onNotification = vi.fn();
    const onStateChange = vi.fn();

    await startNotificationStream({
      accessTokenFactory: () => 'demo-token',
      onNotification,
      onStateChange,
      onError: vi.fn(),
    });

    expect(signalrMock.builder.withUrl).toHaveBeenCalledWith(
      '/api/core/hubs/notifications',
      expect.objectContaining({
        accessTokenFactory: expect.any(Function),
      }),
    );
    expect(signalrMock.builder.withAutomaticReconnect).toHaveBeenCalledWith([0, 2000, 10000, 30000]);
    expect(signalrMock.connection.start).toHaveBeenCalledTimes(1);
    expect(onStateChange.mock.calls.map(([state]) => state)).toEqual(['connecting', 'connected']);

    const notificationHandler = signalrMock.connection.on.mock.calls.find(([eventName]) => eventName === 'NotificationReceived')?.[1];
    notificationHandler?.({
      id: 'notification-live-1',
      title: 'Route updated',
      body: 'A collaborator moved one stop in your itinerary.',
      isRead: false,
      createdAt: '2026-03-29T06:10:00Z',
      type: 'trip.updated',
    });

    expect(onNotification).toHaveBeenCalledWith({
      id: 'notification-live-1',
      title: 'Route updated',
      body: 'A collaborator moved one stop in your itinerary.',
      isRead: false,
      createdAt: '2026-03-29T06:10:00Z',
      type: 'trip.updated',
    });
  });

  it('stays idle when there is no access token', async () => {
    const { startNotificationStream } = await import('@/services/signalrService');
    const onStateChange = vi.fn();

    await startNotificationStream({
      accessTokenFactory: () => '   ',
      onNotification: vi.fn(),
      onStateChange,
      onError: vi.fn(),
    });

    expect(signalrMock.connection.start).not.toHaveBeenCalled();
    expect(onStateChange).toHaveBeenCalledWith('idle');
  });

  it('disables the realtime bridge when mock auth fallback is enabled', async () => {
    vi.stubEnv('VITE_ENABLE_AUTH_MOCK_FALLBACK', 'true');
    vi.resetModules();

    const { startNotificationStream } = await import('@/services/signalrService');
    const onStateChange = vi.fn();
    const onError = vi.fn();

    await startNotificationStream({
      accessTokenFactory: () => 'demo-token',
      onNotification: vi.fn(),
      onStateChange,
      onError,
    });

    expect(signalrMock.builder.build).not.toHaveBeenCalled();
    expect(signalrMock.connection.start).not.toHaveBeenCalled();
    expect(onStateChange).toHaveBeenCalledWith('idle');
    expect(onError).toHaveBeenCalledWith(null);
  });

  it('disables the realtime bridge during visual qa sessions', async () => {
    vi.resetModules();
    (window as Window & { __ATLAS_VISUAL_QA__?: boolean }).__ATLAS_VISUAL_QA__ = true;

    const { startNotificationStream } = await import('@/services/signalrService');
    const onStateChange = vi.fn();
    const onError = vi.fn();

    await startNotificationStream({
      accessTokenFactory: () => 'demo-token',
      onNotification: vi.fn(),
      onStateChange,
      onError,
    });

    expect(signalrMock.builder.build).not.toHaveBeenCalled();
    expect(signalrMock.connection.start).not.toHaveBeenCalled();
    expect(onStateChange).toHaveBeenCalledWith('idle');
    expect(onError).toHaveBeenCalledWith(null);
  });

  it('stops the active hub connection cleanly', async () => {
    const { startNotificationStream, stopNotificationStream } = await import('@/services/signalrService');
    const onStateChange = vi.fn();

    await startNotificationStream({
      accessTokenFactory: () => 'demo-token',
      onNotification: vi.fn(),
      onStateChange,
      onError: vi.fn(),
    });
    await stopNotificationStream();

    expect(signalrMock.connection.stop).toHaveBeenCalledTimes(1);
    expect(onStateChange.mock.calls.at(-1)?.[0]).toBe('idle');
  });
});
