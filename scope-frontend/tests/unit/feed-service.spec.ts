const actor = {
  id: 'user-1',
  username: 'louisdo',
  email: 'louis@example.com',
  displayName: 'Louis Do',
};

const feedItem = {
  id: 'feed-1',
  type: 'trip',
  actor,
  title: 'Louis planned Austin breakfast',
  excerpt: 'A morning route.',
  createdAt: '2026-05-20T12:00:00Z',
  targetId: 'trip-1',
};

const olderFeedItem = {
  ...feedItem,
  id: 'feed-0',
  title: 'Older trip plan',
  createdAt: '2026-05-19T12:00:00Z',
};

const notificationItem = {
  id: 'notification-1',
  type: 'trip.member.added',
  title: 'Maya joined',
  body: 'Maya joined your route.',
  isRead: false,
  createdAt: '2026-05-20T13:00:00Z',
};

const spotItem = {
  id: 'spot-1',
  title: 'Sunset overlook',
  description: 'Golden hour view',
  latitude: 30.3,
  longitude: -97.7,
  category: 'scenic',
  city: 'Austin',
  rating: 4.9,
  likesCount: 90,
  createdAt: '2026-05-20T12:00:00Z',
};

function mockData(overrides: Partial<{
  mockFeed: unknown[];
  mockNotifications: unknown[];
  mockSpots: unknown[];
}> = {}) {
  return {
    mockFeed: overrides.mockFeed ?? [olderFeedItem, feedItem],
    mockNotifications: overrides.mockNotifications ?? [notificationItem],
    mockSpots: overrides.mockSpots ?? [spotItem],
  };
}

describe('feed service contracts', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('@/services/api');
    vi.doUnmock('@/services/demoMode');
    vi.doUnmock('@/services/mockDataLoader');
  });

  it('serves demo feed, trending, notifications, and read mutations from mutable fixtures', async () => {
    const fixtures = mockData();
    vi.doMock('@/services/demoMode', () => ({ DEMO_MODE_ENABLED: true }));
    vi.doMock('@/services/api', () => ({
      default: {
        get: vi.fn(),
        put: vi.fn(),
      },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue(fixtures),
    }));

    const feedService = await import('@/services/feedService');

    const feed = await feedService.getFeed(1, 1);
    expect(feed.data).toHaveLength(1);
    expect(feed.data[0]?.id).toBe('feed-1');
    expect(feed.meta).toMatchObject({ page: 1, pageSize: 1, total: 2 });

    const trending = await feedService.getTrendingSpots(1);
    expect(trending.data[0]?.id).toBe('spot-1');

    const notifications = await feedService.getNotifications(1, 1);
    expect(notifications.data[0]?.isRead).toBe(false);

    await expect(feedService.markNotificationRead('notification-1')).resolves.toMatchObject({
      id: 'notification-1',
      isRead: true,
    });
    await expect(feedService.markNotificationRead('missing')).resolves.toBeUndefined();

    await feedService.markAllNotificationsRead();
    expect(fixtures.mockNotifications).toEqual([
      expect.objectContaining({ id: 'notification-1', isRead: true }),
    ]);
  });

  it('uses live feed data once observed and stops replacing later empty live pages with mocks', async () => {
    const get = vi.fn()
      .mockResolvedValueOnce({
        data: {
          data: [feedItem],
          meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [],
          meta: { page: 2, pageSize: 20, total: 1, totalPages: 1 },
        },
      });

    vi.doMock('@/services/demoMode', () => ({ DEMO_MODE_ENABLED: false }));
    vi.doMock('@/services/api', () => ({
      default: { get, put: vi.fn() },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue(mockData()),
    }));

    const feedService = await import('@/services/feedService');

    const firstPage = await feedService.getFeed();
    expect(firstPage.data[0]?.id).toBe('feed-1');

    const secondPage = await feedService.getFeed(2);
    expect(secondPage.data).toEqual([]);
    expect(secondPage.meta).toMatchObject({ page: 2, pageSize: 20 });
  });

  it('falls back for public feed and notification reads while surfacing notification mutation failures', async () => {
    const fixtures = mockData({
      mockNotifications: [
        { ...notificationItem, category: 'trip' },
        {
          ...notificationItem,
          id: 'notification-2',
          title: 'Older notification',
          createdAt: '2026-05-19T12:00:00Z',
        },
      ],
    });
    const get = vi.fn().mockRejectedValue(new Error('content offline'));
    const put = vi.fn().mockRejectedValue(new Error('content offline'));

    vi.doMock('@/services/demoMode', () => ({ DEMO_MODE_ENABLED: false }));
    vi.doMock('@/services/api', () => ({
      default: { get, put },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue(fixtures),
    }));

    const feedService = await import('@/services/feedService');

    await expect(feedService.getFeed(1, 2)).resolves.toMatchObject({
      data: [
        expect.objectContaining({ id: 'feed-1' }),
        expect.objectContaining({ id: 'feed-0' }),
      ],
      meta: expect.objectContaining({ page: 1, pageSize: 2, total: 2 }),
    });
    await expect(feedService.getTrendingSpots(2)).resolves.toMatchObject({
      data: [
        expect.objectContaining({ id: 'spot-1' }),
      ],
    });
    await expect(feedService.getNotifications(1, 2)).resolves.toMatchObject({
      data: [],
      meta: expect.objectContaining({ page: 1, pageSize: 2, total: 0 }),
    });
    await expect(feedService.markNotificationRead('notification-1')).rejects.toThrow('content offline');
    await expect(feedService.markAllNotificationsRead()).rejects.toThrow('content offline');
    expect(fixtures.mockNotifications.every((notification) => Boolean((notification as { isRead?: boolean }).isRead))).toBe(false);
  });

  it('filters demo notifications, performs demo actions, and supplies default preferences', async () => {
    const fixtures = mockData({
      mockNotifications: [
        { ...notificationItem, category: 'trip' },
        {
          ...notificationItem,
          id: 'notification-2',
          category: 'social',
          isRead: true,
          title: 'Already read',
          createdAt: '2026-05-19T12:00:00Z',
        },
        {
          ...notificationItem,
          id: 'notification-3',
          category: 'trip',
          isRead: false,
          title: 'Trip unread',
          createdAt: '2026-05-18T12:00:00Z',
        },
      ],
    });
    vi.doMock('@/services/demoMode', () => ({ DEMO_MODE_ENABLED: true }));
    vi.doMock('@/services/api', () => ({
      default: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue(fixtures),
    }));

    const feedService = await import('@/services/feedService');

    const tripUnread = await feedService.getNotifications(1, 10, { category: 'trip', unread: true });
    expect(tripUnread.data.map((notification) => notification.id)).toEqual(['notification-1', 'notification-3']);

    await expect(feedService.performNotificationAction('notification-3', 'accept_friend_request')).resolves.toEqual({ ok: true });
    expect(fixtures.mockNotifications.find((notification) => notification.id === 'notification-3')).toMatchObject({
      isRead: true,
    });

    await expect(feedService.performNotificationAction('notification-2', 'mute_category')).resolves.toEqual({ ok: true });
    expect(fixtures.mockNotifications.find((notification) => notification.id === 'notification-2')).toMatchObject({
      isRead: true,
    });

    const preferences = await feedService.getNotificationPreferences();
    expect(preferences.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'account', inAppEnabled: true, emailEnabled: true, digestCadence: 'instant' }),
      expect.objectContaining({ category: 'digest', pushEnabled: false, emailEnabled: true, digestCadence: 'daily' }),
      expect.objectContaining({ category: 'general', emailEnabled: false }),
    ]));

    await expect(feedService.updateNotificationPreference({
      category: ' trip ',
      inAppEnabled: true,
      pushEnabled: true,
      emailEnabled: false,
      digestCadence: 'weekly',
      timeZoneId: '',
    })).resolves.toMatchObject({
      category: 'trip',
      pushEnabled: true,
      emailEnabled: false,
      digestCadence: 'weekly',
    });
  });

  it('uses live notification preference, action, and push-subscription endpoints', async () => {
    const get = vi.fn()
      .mockResolvedValueOnce({ data: { data: [] } })
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              category: 'security',
              inAppEnabled: false,
              pushEnabled: true,
              emailEnabled: true,
              digestCadence: 'instant',
              quietHoursStartMinutes: 0,
              quietHoursEndMinutes: 480,
              timeZoneId: 'America/Chicago',
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [notificationItem],
          meta: { page: 2, pageSize: 5, total: 1, totalPages: 1 },
        },
      });
    const put = vi.fn()
      .mockResolvedValueOnce({
        data: {
          data: {
            category: 'security',
            inAppEnabled: true,
            pushEnabled: false,
            emailEnabled: true,
            digestCadence: 'daily',
            quietHoursStartMinutes: null,
            quietHoursEndMinutes: null,
            timeZoneId: 'America/Chicago',
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          category: 'friend',
          inAppEnabled: true,
          pushEnabled: true,
          emailEnabled: false,
          digestCadence: 'instant',
          quietHoursStartMinutes: null,
          quietHoursEndMinutes: null,
          timeZoneId: 'UTC',
        },
      });
    const post = vi.fn()
      .mockResolvedValueOnce({ data: { ok: true, action: 'mute_category' } })
      .mockResolvedValueOnce({ data: { id: 'push-subscription-1' } });

    vi.doMock('@/services/demoMode', () => ({ DEMO_MODE_ENABLED: false }));
    vi.doMock('@/services/api', () => ({
      default: { get, put, post },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue(mockData()),
    }));

    const feedService = await import('@/services/feedService');

    const emptyPreferences = await feedService.getNotificationPreferences();
    expect(emptyPreferences.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'account', inAppEnabled: true }),
      expect.objectContaining({ category: 'digest', digestCadence: 'daily' }),
    ]));

    const livePreferences = await feedService.getNotificationPreferences();
    expect(livePreferences.data).toEqual([
      expect.objectContaining({ category: 'security', inAppEnabled: false, quietHoursEndMinutes: 480 }),
    ]);

    const liveNotifications = await feedService.getNotifications(2, 5, { category: 'trip', unread: true });
    expect(liveNotifications.meta).toMatchObject({ page: 2, pageSize: 5 });
    expect(get).toHaveBeenLastCalledWith('/api/core/notifications', {
      params: { page: 2, pageSize: 5, category: 'trip', unread: true },
    });

    await expect(feedService.updateNotificationPreference({
      category: 'security',
      inAppEnabled: true,
      pushEnabled: false,
      emailEnabled: true,
      digestCadence: 'daily',
      timeZoneId: 'America/Chicago',
    })).resolves.toMatchObject({ category: 'security', digestCadence: 'daily' });

    await expect(feedService.updateNotificationPreference({
      category: 'friend',
      inAppEnabled: true,
      pushEnabled: true,
      emailEnabled: false,
      digestCadence: 'instant',
      timeZoneId: 'UTC',
    })).resolves.toMatchObject({ category: 'friend', pushEnabled: true });

    await expect(feedService.performNotificationAction('notification-1', 'mute_category')).resolves.toEqual({
      ok: true,
      action: 'mute_category',
    });
    expect(post).toHaveBeenCalledWith('/api/core/notifications/notification-1/actions', { action: 'mute_category' });

    await expect(feedService.savePushSubscription({
      endpoint: 'https://push.example/sub',
      p256dh: 'key',
      auth: 'auth',
      userAgent: 'vitest',
    })).resolves.toEqual({ id: 'push-subscription-1' });
    expect(post).toHaveBeenLastCalledWith('/api/core/notifications/push-subscriptions', {
      endpoint: 'https://push.example/sub',
      p256dh: 'key',
      auth: 'auth',
      userAgent: 'vitest',
    });
  });

  it('falls back for notification preference reads while surfacing action failures', async () => {
    const fixtures = mockData({
      mockNotifications: [
        { ...notificationItem, isRead: false },
      ],
    });
    const get = vi.fn().mockRejectedValue(new Error('preferences offline'));
    const post = vi.fn().mockRejectedValue(new Error('actions offline'));

    vi.doMock('@/services/demoMode', () => ({ DEMO_MODE_ENABLED: false }));
    vi.doMock('@/services/api', () => ({
      default: { get, put: vi.fn(), post },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue(fixtures),
    }));

    const feedService = await import('@/services/feedService');

    await expect(feedService.getNotificationPreferences()).resolves.toEqual({
      data: expect.arrayContaining([
        expect.objectContaining({ category: 'account', inAppEnabled: true }),
      ]),
    });
    await expect(feedService.performNotificationAction('notification-1', 'open')).rejects.toThrow('actions offline');
    expect(fixtures.mockNotifications[0]).toMatchObject({ id: 'notification-1', isRead: false });
  });
});
