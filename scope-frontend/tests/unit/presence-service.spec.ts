describe('presence service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.doUnmock('@/services/api');
  });

  it('sends immediate planning heartbeats and throttles follow-up activity', async () => {
    const put = vi.fn().mockResolvedValue({ data: {} });
    vi.doMock('@/services/api', () => ({
      default: { put },
      getAccessToken: vi.fn(() => 'token-123'),
    }));

    const presenceService = await import('@/services/presenceService');

    await presenceService.sendPresenceHeartbeat({
      routeContext: '/trips/new',
      isIdle: true,
    }, { force: true });

    expect(put).toHaveBeenCalledWith('/api/core/presence/heartbeat', {
      status: 'idle',
      routeContext: '/trips/new',
      isIdle: true,
      isPlanning: false,
    });

    await presenceService.sendPresenceHeartbeat({
      routeContext: '/trips/new',
      isPlanning: true,
    });
    expect(put).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(put).toHaveBeenCalledTimes(2);
    expect(put).toHaveBeenLastCalledWith('/api/core/presence/heartbeat', {
      status: 'planning',
      routeContext: '/trips/new',
      isIdle: false,
      isPlanning: true,
    });

    presenceService.stopPendingPresenceWork();
  });

  it('skips heartbeat work until a real bearer session is available', async () => {
    const put = vi.fn().mockResolvedValue({ data: {} });
    const getAccessToken = vi.fn<[], string>()
      .mockReturnValueOnce('')
      .mockReturnValueOnce('scope-qa-token')
      .mockReturnValueOnce('preview-access-token')
      .mockReturnValue('token-123');
    vi.doMock('@/services/api', () => ({
      default: { put },
      getAccessToken,
    }));

    const presenceService = await import('@/services/presenceService');

    await presenceService.sendPresenceHeartbeat({ routeContext: '/trips/new' }, { force: true });
    await presenceService.sendPresenceHeartbeat({ routeContext: '/trips/new' }, { force: true });
    await presenceService.sendPresenceHeartbeat({ routeContext: '/trips/new' }, { force: true });
    expect(put).not.toHaveBeenCalled();

    await presenceService.sendPresenceHeartbeat({ routeContext: '/trips/new' }, { force: true });
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('backs off optional heartbeats after network failures', async () => {
    const put = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ data: {} });
    vi.doMock('@/services/api', () => ({
      default: { put },
      getAccessToken: vi.fn(() => 'token-123'),
    }));

    const presenceService = await import('@/services/presenceService');

    await expect(presenceService.sendPresenceHeartbeat({ routeContext: '/trips/new' }, { force: true }))
      .rejects
      .toThrow('offline');
    await presenceService.sendPresenceHeartbeat({ routeContext: '/trips/new' }, { force: true });
    expect(put).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);
    await presenceService.sendPresenceHeartbeat({ routeContext: '/trips/new' }, { force: true });
    expect(put).toHaveBeenCalledTimes(2);
  });

  it('allows offline heartbeats through backoff and no-ops browser hooks without window', async () => {
    const put = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ data: {} });
    vi.doMock('@/services/api', () => ({
      default: { put },
      getAccessToken: vi.fn(() => 'token-123'),
    }));

    const presenceService = await import('@/services/presenceService');

    await expect(presenceService.sendPresenceHeartbeat({ routeContext: '/trips/new' }, { force: true }))
      .rejects
      .toThrow('offline');

    await expect(presenceService.sendPresenceHeartbeat({
      status: 'offline',
      routeContext: '/trips/new',
    }, { force: true })).resolves.toBeUndefined();

    expect(put).toHaveBeenCalledTimes(2);
    expect(put).toHaveBeenLastCalledWith('/api/core/presence/heartbeat', {
      status: 'offline',
      routeContext: '/trips/new',
      isIdle: false,
      isPlanning: false,
    });

    const originalWindow = window;
    vi.stubGlobal('window', undefined);

    expect(() => presenceService.markPresenceActivity({ status: 'online' })).not.toThrow();
    expect(presenceService.listenForPresenceActivity(vi.fn())()).toBeUndefined();
    expect(() => presenceService.sendPresenceBeacon({ status: 'offline' })).not.toThrow();

    vi.stubGlobal('window', originalWindow);
  });

  it('sends plain online heartbeats and clears backoff after a successful retry', async () => {
    const put = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ data: {} });
    vi.doMock('@/services/api', () => ({
      default: { put },
      getAccessToken: vi.fn(() => 'token-123'),
    }));

    const presenceService = await import('@/services/presenceService');

    await expect(presenceService.sendPresenceHeartbeat({}, { force: true })).rejects.toThrow('offline');
    await vi.advanceTimersByTimeAsync(30_000);
    await presenceService.sendPresenceHeartbeat({}, { force: true });
    await presenceService.sendPresenceHeartbeat({ routeContext: '/map' }, { force: true });

    expect(put).toHaveBeenCalledTimes(3);
    expect(put).toHaveBeenLastCalledWith('/api/core/presence/heartbeat', {
      status: 'online',
      routeContext: '/map',
      isIdle: false,
      isPlanning: false,
    });
  });

  it('dispatches and unsubscribes planner activity events', async () => {
    vi.doMock('@/services/api', () => ({
      default: { put: vi.fn() },
      getAccessToken: vi.fn(),
    }));

    const presenceService = await import('@/services/presenceService');
    const listener = vi.fn();
    const unsubscribe = presenceService.listenForPresenceActivity(listener);

    presenceService.markPlanningActivity('/trips/new');
    expect(listener).toHaveBeenCalledWith({
      status: 'planning',
      routeContext: '/trips/new',
      isPlanning: true,
      immediate: true,
    });

    unsubscribe();
    presenceService.markPresenceActivity({ status: 'online', immediate: true });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('uses keepalive beacons only when an access token is available', async () => {
    const getAccessToken = vi.fn<[], string | null>()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce('token-123')
      .mockReturnValueOnce('token-123')
      .mockReturnValueOnce('scope-qa-token')
      .mockReturnValueOnce('preview-access-token');
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockImplementationOnce(() => {
        throw new Error('navigation is closing');
      });

    vi.stubGlobal('fetch', fetch);
    vi.doMock('@/services/api', () => ({
      default: { put: vi.fn() },
      getAccessToken,
    }));

    const presenceService = await import('@/services/presenceService');

    presenceService.sendPresenceBeacon({ routeContext: '/trips/new' });
    expect(fetch).not.toHaveBeenCalled();

    presenceService.sendPresenceBeacon({ routeContext: '/trips/new', status: 'away' });
    expect(fetch).toHaveBeenCalledWith('/api/core/presence/heartbeat', {
      method: 'PUT',
      keepalive: true,
      headers: {
        Authorization: 'Bearer token-123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'away',
        routeContext: '/trips/new',
        isIdle: false,
        isPlanning: false,
      }),
    });

    expect(() => presenceService.sendPresenceBeacon({
      routeContext: '/trips/new',
      isPlanning: true,
    })).not.toThrow();
    presenceService.sendPresenceBeacon({ routeContext: '/trips/new' });
    presenceService.sendPresenceBeacon({ routeContext: '/trips/new' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
