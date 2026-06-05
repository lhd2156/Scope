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
    vi.stubEnv('VITE_DEMO_MODE', 'false');
    vi.stubEnv('VITE_ENABLE_AUTH_MOCK_FALLBACK', 'false');
    delete (window as Window & { __SCOPE_VISUAL_QA__?: boolean }).__SCOPE_VISUAL_QA__;

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

  it('uses the configured API origin for production notification hub connections', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.scopetrips.com');
    vi.resetModules();

    const { startNotificationStream } = await import('@/services/signalrService');

    await startNotificationStream({
      accessTokenFactory: () => 'demo-token',
      onNotification: vi.fn(),
      onStateChange: vi.fn(),
      onError: vi.fn(),
    });

    expect(signalrMock.builder.withUrl).toHaveBeenCalledWith(
      'https://api.scopetrips.com/api/core/hubs/notifications',
      expect.objectContaining({
        accessTokenFactory: expect.any(Function),
      }),
    );
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

  it('disables the realtime bridge when demo mode is enabled', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true');
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
    (window as Window & { __SCOPE_VISUAL_QA__?: boolean }).__SCOPE_VISUAL_QA__ = true;

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

  it('reports already connected and reconnecting hub states without starting again', async () => {
    const { startNotificationStream } = await import('@/services/signalrService');
    const onStateChange = vi.fn();
    const onError = vi.fn();

    signalrMock.connection.state = 'Connected';
    await startNotificationStream({
      accessTokenFactory: () => 'demo-token',
      onNotification: vi.fn(),
      onStateChange,
      onError,
    });

    expect(signalrMock.connection.start).not.toHaveBeenCalled();
    expect(onStateChange).toHaveBeenLastCalledWith('connected');
    expect(onError).toHaveBeenLastCalledWith(null);

    signalrMock.connection.state = 'Reconnecting';
    await startNotificationStream({
      accessTokenFactory: () => 'demo-token',
      onNotification: vi.fn(),
      onStateChange,
      onError,
    });

    expect(signalrMock.connection.start).not.toHaveBeenCalled();
    expect(onStateChange).toHaveBeenLastCalledWith('reconnecting');
  });

  it('surfaces reconnect lifecycle errors and clears them after reconnect', async () => {
    const { startNotificationStream } = await import('@/services/signalrService');
    const onStateChange = vi.fn();
    const onError = vi.fn();

    await startNotificationStream({
      accessTokenFactory: () => 'demo-token',
      onNotification: vi.fn(),
      onStateChange,
      onError,
    });

    const reconnectingHandler = signalrMock.connection.onreconnecting.mock.calls[0]?.[0];
    const reconnectedHandler = signalrMock.connection.onreconnected.mock.calls[0]?.[0];
    const closeHandler = signalrMock.connection.onclose.mock.calls[0]?.[0];

    reconnectingHandler?.(new Error('network wobble'));
    expect(onStateChange).toHaveBeenLastCalledWith('reconnecting');
    expect(onError).toHaveBeenLastCalledWith('network wobble');

    reconnectedHandler?.();
    expect(onStateChange).toHaveBeenLastCalledWith('connected');
    expect(onError).toHaveBeenLastCalledWith(null);

    closeHandler?.('closed by server');
    expect(onStateChange).toHaveBeenLastCalledWith('disconnected');
    expect(onError).toHaveBeenLastCalledWith('closed by server');
  });

  it('deduplicates concurrent starts and reports startup failures', async () => {
    let rejectStart: (error: Error) => void = () => undefined;
    signalrMock.connection.start.mockImplementationOnce(() => new Promise<void>((_, reject) => {
      rejectStart = reject;
    }));

    const { startNotificationStream, stopNotificationStream } = await import('@/services/signalrService');
    const onStateChange = vi.fn();
    const onError = vi.fn();

    const options = {
      accessTokenFactory: () => 'demo-token',
      onNotification: vi.fn(),
      onStateChange,
      onError,
    };

    const firstStart = startNotificationStream(options);
    const secondStart = startNotificationStream(options);

    expect(signalrMock.connection.start).toHaveBeenCalledTimes(1);

    const startResults = Promise.allSettled([firstStart, secondStart]);
    rejectStart(new Error('hub refused'));
    const results = await startResults;
    expect(results).toHaveLength(2);
    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(results.map((result) => (result as PromiseRejectedResult).reason.message)).toEqual([
      'hub refused',
      'hub refused',
    ]);
    expect(onStateChange).toHaveBeenLastCalledWith('disconnected');
    expect(onError).toHaveBeenLastCalledWith('hub refused');

    await stopNotificationStream();
    expect(onStateChange).toHaveBeenLastCalledWith('idle');
    expect(onError).toHaveBeenLastCalledWith(null);
  });
});
