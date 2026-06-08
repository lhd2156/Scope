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

function mockDemoMode(enabled: boolean, fallbackEnabled = enabled) {
  return {
    DEMO_MODE_ENABLED: enabled,
    LOCAL_PREVIEW_ENABLED: enabled,
    localFallbackEnabled: () => fallbackEnabled,
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
    vi.restoreAllMocks();
  });

  it('serves demo feed, trending, notifications, and read mutations from mutable fixtures', async () => {
    const fixtures = mockData();
    vi.doMock('@/services/demoMode', () => mockDemoMode(true));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue(''),
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

    vi.doMock('@/services/demoMode', () => mockDemoMode(false));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue('live-access-token'),
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

  it('curates the public starter activity feed down to six ranked social-proof items', async () => {
    const actorIds = [
      '11111111111111111111111111111111',
      '22222222222222222222222222222222',
      '33333333333333333333333333333333',
      '44444444444444444444444444444441',
      '55555555555555555555555555555551',
      '66666666666666666666666666666661',
      '77777777777777777777777777777771',
      '88888888888888888888888888888881',
    ];
    const ratings = [4.6, 4.9, 5, 4.7, 4.2, 4.8, 4.5, 4.4];
    const spots = actorIds.map((userId, index) => ({
      id: `spot-${index + 1}`,
      title: `Starter spot ${index + 1}`,
      description: `Starter description ${index + 1}`,
      latitude: 32 + index,
      longitude: -97 - index,
      category: 'scenic',
      city: 'Austin',
      rating: ratings[index],
      photoUrl: `https://images.example.com/spot-${index + 1}.jpg`,
      createdAt: `2026-05-${String(index + 1).padStart(2, '0')}T12:00:00Z`,
      userId,
    }));
    const get = vi.fn((path: string) => {
      if (path === '/api/content/feed/trending') {
        return Promise.resolve({ data: { data: spots } });
      }

      const spotId = path.split('/').pop() ?? '';
      const spotIndex = spots.findIndex((spot) => spot.id === spotId);
      return Promise.resolve({
        data: {
          data: [
            {
              id: `review-${spotId}`,
              spot_id: spotId,
              user_id: spots[spotIndex]?.userId,
              rating: ratings[spotIndex] ?? 4,
              comment: `Useful starter review for ${spotId} with enough detail to rank well.`,
              created_at: `2026-06-${String(spotIndex + 1).padStart(2, '0')}T12:00:00Z`,
            },
          ],
        },
      });
    });

    vi.doMock('@/services/demoMode', () => mockDemoMode(false, false));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue(''),
      default: { get, put: vi.fn() },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue(mockData()),
    }));

    const feedService = await import('@/services/feedService');

    const feed = await feedService.getFeed(1, 20);
    const actorNames = feed.data.map((item) => item.actor.displayName);

    expect(feed.data).toHaveLength(6);
    expect(feed.meta).toMatchObject({ page: 1, pageSize: 20, total: 6, totalPages: 1 });
    expect(new Set(feed.data.map((item) => item.targetId)).size).toBe(6);
    expect(actorNames).toContain('Maya Chen');
    expect(feed.data.find((item) => item.actor.displayName === 'Maya Chen')?.actor.avatarUrl).toContain('1239291');
    expect(feed.data.find((item) => item.actor.displayName === 'Elijah Brooks')?.actor.avatarUrl).toContain('220453');
  });

  it('builds public starter activity from public spots and matching reviews when feed trending is unavailable', async () => {
    const get = vi.fn()
      .mockRejectedValueOnce(new Error('feed trending unavailable'))
      .mockResolvedValueOnce({
        data: {
          data: [spotItem],
          meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              id: 'review-1',
              user_id: '22222222-2222-2222-2222-222222222222',
              rating: '4.7',
              comment: 'The same place I would save from the map.',
              created_at: '2026-06-03T12:00:00Z',
            },
          ],
        },
      });

    vi.doMock('@/services/demoMode', () => mockDemoMode(false, false));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue(''),
      default: { get, put: vi.fn() },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockRejectedValue(new Error('mock data disabled')),
    }));

    const feedService = await import('@/services/feedService');
    const feed = await feedService.getFeed(1, 6);

    expect(get).toHaveBeenNthCalledWith(1, '/api/content/feed/trending', { params: { limit: 10 } });
    expect(get).toHaveBeenNthCalledWith(2, '/api/content/spots/', { params: { page: 1, pageSize: 10 } });
    expect(get).toHaveBeenNthCalledWith(3, '/api/content/reviews/spot/spot-1');
    expect(feed.data).toHaveLength(1);
    expect(feed.data[0]).toMatchObject({
      type: 'review',
      actor: expect.objectContaining({ displayName: 'Maya Chen' }),
      title: 'Maya Chen reviewed Sunset overlook',
      excerpt: '4.7/5: The same place I would save from the map.',
      targetPath: '/spots/sunset-overlook-austin',
    });
  });

  it('uses starter public activity for the home rail even when an account token exists', async () => {
    const starterSpot = {
      ...spotItem,
      id: 'home-spot-1',
      title: 'Home Starter Spot',
      userId: '22222222-2222-2222-2222-222222222222',
    };
    const get = vi.fn((path: string) => {
      if (path === '/api/content/feed/trending') {
        return Promise.resolve({ data: { data: [starterSpot] } });
      }

      return Promise.resolve({
        data: {
          data: [
            {
              id: 'home-review-1',
              user_id: '22222222-2222-2222-2222-222222222222',
              rating: '4.8',
              comment: 'Starter activity should stay consistent on the homepage.',
              created_at: '2026-06-03T12:00:00Z',
            },
          ],
        },
      });
    });

    vi.doMock('@/services/demoMode', () => mockDemoMode(false, false));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue('live-access-token'),
      default: { get, put: vi.fn() },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockRejectedValue(new Error('mock data disabled')),
    }));

    const feedService = await import('@/services/feedService');
    const feed = await feedService.getHomeActivityFeed(1, 6);

    expect(get).not.toHaveBeenCalledWith('/api/content/feed/', expect.anything());
    expect(get).toHaveBeenCalledWith('/api/content/feed/trending', { params: { limit: 10 } });
    expect(feed.data[0]).toMatchObject({
      type: 'review',
      title: 'Maya Chen reviewed Home Starter Spot',
    });
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

    vi.doMock('@/services/demoMode', () => mockDemoMode(false, true));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue(''),
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

  it('surfaces notification read failures when production fallback is disabled', async () => {
    const get = vi.fn().mockRejectedValue(new Error('notifications offline'));

    vi.doMock('@/services/demoMode', () => mockDemoMode(false, false));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue(''),
      default: { get, put: vi.fn(), post: vi.fn() },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue(mockData()),
    }));

    const feedService = await import('@/services/feedService');

    await expect(feedService.getNotifications()).rejects.toThrow('notifications offline');
  });

  it('returns an empty public starter feed instead of mocks when read fallback is disabled', async () => {
    const get = vi.fn().mockResolvedValue({ data: { data: [] } });

    vi.doMock('@/services/demoMode', () => mockDemoMode(false, false));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue(''),
      default: { get, put: vi.fn(), post: vi.fn() },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue(mockData()),
    }));

    const feedService = await import('@/services/feedService');

    await expect(feedService.getFeed(1, 9)).resolves.toMatchObject({
      data: [],
      meta: { page: 1, pageSize: 9, total: 0, totalPages: 1 },
    });
    expect(get).toHaveBeenCalledWith('/api/content/feed/trending', { params: { limit: 10 } });
    expect(get).toHaveBeenCalledWith('/api/content/spots/', { params: { page: 1, pageSize: 10 } });
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
    vi.doMock('@/services/demoMode', () => mockDemoMode(true));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue(''),
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

    vi.doMock('@/services/demoMode', () => mockDemoMode(false, true));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue('live-access-token'),
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

    vi.doMock('@/services/demoMode', () => mockDemoMode(false, true));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue(''),
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

  it('surfaces notification preference failures when production fallback is disabled', async () => {
    const get = vi.fn().mockRejectedValue(new Error('preferences offline'));

    vi.doMock('@/services/demoMode', () => mockDemoMode(false, false));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue('live-access-token'),
      default: { get, put: vi.fn(), post: vi.fn() },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue(mockData()),
    }));

    const feedService = await import('@/services/feedService');

    await expect(feedService.getNotificationPreferences()).rejects.toThrow('preferences offline');
  });

  it('normalizes alternate review wire fields and fills duplicate starter actors', async () => {
    const spots = Array.from({ length: 8 }, (_, index) => ({
      ...spotItem,
      id: `alternate-spot-${index + 1}`,
      title: `Alternate spot ${index + 1}`,
      createdAt: `2026-05-${String(index + 1).padStart(2, '0')}T12:00:00Z`,
      userId: undefined,
    }));
    const get = vi.fn((path: string) => {
      if (path === '/api/content/feed/trending') {
        return Promise.resolve({ data: { data: spots } });
      }

      const index = Number(path.split('-').pop()) - 1;
      return Promise.resolve({
        data: {
          data: [
            {
              id: index === 0 ? '' : `alternate-review-${index + 1}`,
              userId: index === 0 ? 'custom-user-12345678' : undefined,
              user: index === 1 ? { id: 'custom-user-12345678' } : undefined,
              rating: 'not-a-rating',
              comment: '',
              createdAt: index === 0 ? '2026-06-01T12:00:00Z' : undefined,
            },
          ],
        },
      });
    });

    vi.doMock('@/services/demoMode', () => mockDemoMode(false, false));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue(''),
      default: { get, put: vi.fn(), post: vi.fn() },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue(mockData()),
    }));

    const feedService = await import('@/services/feedService');
    const feed = await feedService.getFeed(1, 20);

    expect(feed.data).toHaveLength(6);
    expect(feed.data.some((item) => item.actor.displayName.startsWith('Traveler '))).toBe(true);
    expect(feed.data.some((item) => item.excerpt.startsWith('Review rating for'))).toBe(true);
    expect(new Set(feed.data.map((item) => item.actor.id)).size).toBeLessThan(feed.data.length);
  });

  it('applies the configured home starter-feed outage policy', async () => {
    vi.doMock('@/services/demoMode', () => mockDemoMode(false, true));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue('live-access-token'),
      default: {
        get: vi.fn().mockRejectedValue(new Error('starter offline')),
        put: vi.fn(),
        post: vi.fn(),
      },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue(mockData()),
    }));

    const fallbackFeedService = await import('@/services/feedService');
    await expect(fallbackFeedService.getHomeActivityFeed(1, 1)).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'feed-1' })],
    });

    vi.resetModules();
    vi.doMock('@/services/demoMode', () => mockDemoMode(false, false));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue('live-access-token'),
      default: {
        get: vi.fn().mockResolvedValue({ data: { data: [] } }),
        put: vi.fn(),
        post: vi.fn(),
      },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue(mockData()),
    }));

    const strictEmptyFeedService = await import('@/services/feedService');
    await expect(strictEmptyFeedService.getHomeActivityFeed(1, 4)).resolves.toMatchObject({
      data: [],
      meta: { page: 1, pageSize: 4, total: 0, totalPages: 1 },
    });
  });

  it('surfaces strict home and private feed failures', async () => {
    const get = vi.fn().mockRejectedValue(new Error('feed unavailable'));
    vi.doMock('@/services/demoMode', () => mockDemoMode(false, false));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue('live-access-token'),
      default: { get, put: vi.fn(), post: vi.fn() },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue(mockData()),
    }));

    const feedService = await import('@/services/feedService');

    await expect(feedService.getHomeActivityFeed()).rejects.toThrow('feed unavailable');
    await expect(feedService.getFeed()).rejects.toThrow('feed unavailable');
  });

  it('remembers observed live trending data across a later empty response', async () => {
    const get = vi.fn()
      .mockResolvedValueOnce({ data: { data: [spotItem] } })
      .mockResolvedValueOnce({ data: { data: [] } });
    vi.doMock('@/services/demoMode', () => mockDemoMode(false, true));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue('live-access-token'),
      default: { get, put: vi.fn(), post: vi.fn() },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue(mockData()),
    }));

    const feedService = await import('@/services/feedService');

    await expect(feedService.getTrendingSpots(4)).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'spot-1' })],
    });
    await expect(feedService.getTrendingSpots(4)).resolves.toMatchObject({ data: [] });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('filters read demo notifications and accepts both live read response shapes', async () => {
    const fixtures = mockData({
      mockNotifications: [
        { ...notificationItem, id: 'unread', isRead: false },
        { ...notificationItem, id: 'read', isRead: true },
      ],
    });
    vi.doMock('@/services/demoMode', () => mockDemoMode(true));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue(''),
      default: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue(fixtures),
    }));

    const demoFeedService = await import('@/services/feedService');
    const readNotifications = await demoFeedService.getNotifications(1, 10, { unread: false });
    expect(readNotifications.data.map((notification) => notification.id)).toEqual(['read']);

    vi.resetModules();
    const put = vi.fn()
      .mockResolvedValueOnce({ data: { data: { ...notificationItem, id: 'wrapped', isRead: true } } })
      .mockResolvedValueOnce({ data: { ...notificationItem, id: 'raw', isRead: true } });
    vi.doMock('@/services/demoMode', () => mockDemoMode(false, false));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue('live-access-token'),
      default: { get: vi.fn(), put, post: vi.fn() },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue(mockData()),
    }));

    const liveFeedService = await import('@/services/feedService');
    await expect(liveFeedService.markNotificationRead('wrapped')).resolves.toMatchObject({ id: 'wrapped' });
    await expect(liveFeedService.markNotificationRead('raw')).resolves.toMatchObject({ id: 'raw' });
  });

  it('uses stable minimum pagination and UTC defaults for empty demo fixtures', async () => {
    const fixtures = mockData();
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      locale: 'en-US',
      calendar: 'gregory',
      numberingSystem: 'latn',
      timeZone: '',
    });
    vi.doMock('@/services/demoMode', () => mockDemoMode(true));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue(''),
      default: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue(fixtures),
    }));

    const feedService = await import('@/services/feedService');

    const sizedFromFeed = await feedService.getHomeActivityFeed(1, 0);
    expect(sizedFromFeed.meta).toMatchObject({ pageSize: 2, total: 2 });

    const sizedFromNotifications = await feedService.getNotifications(1, 0);
    expect(sizedFromNotifications.meta).toMatchObject({ pageSize: 1, total: 1 });

    fixtures.mockFeed.splice(0);
    fixtures.mockNotifications.splice(0);

    const minimumFeed = await feedService.getFeed(2, 0);
    expect(minimumFeed.meta).toMatchObject({ page: 2, pageSize: 1, total: 0 });

    const minimumNotifications = await feedService.getNotifications(2, 0);
    expect(minimumNotifications.meta).toMatchObject({ page: 2, pageSize: 1, total: 0 });

    const preferences = await feedService.getNotificationPreferences();
    expect(preferences.data.every((preference) => preference.timeZoneId === 'UTC')).toBe(true);
  });

  it('builds useful pinned-spot activity when every public review request fails', async () => {
    const starterSpots = [
      {
        ...spotItem,
        id: 'description-spot',
        userId: '11111111-1111-1111-1111-111111111111',
      },
      {
        ...spotItem,
        id: 'city-spot',
        title: 'City fallback',
        description: '',
        userId: '22222222-2222-2222-2222-222222222222',
      },
      {
        ...spotItem,
        id: 'scope-spot',
        title: 'Scope fallback',
        description: '',
        city: '',
        userId: '33333333-3333-3333-3333-333333333333',
      },
    ];
    const get = vi.fn((path: string) => {
      if (path === '/api/content/feed/trending') {
        return Promise.resolve({ data: { data: starterSpots } });
      }
      return Promise.reject(new Error(`reviews unavailable for ${path}`));
    });

    vi.doMock('@/services/demoMode', () => mockDemoMode(false, false));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue(''),
      default: { get, put: vi.fn(), post: vi.fn() },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue(mockData()),
    }));

    const feedService = await import('@/services/feedService');
    const feed = await feedService.getFeed(1, 10);

    expect(feed.data).toHaveLength(3);
    expect(feed.data.every((item) => item.type === 'spot' && item.title.includes('pinned'))).toBe(true);
    expect(feed.data.find((item) => item.targetId === 'description-spot')?.excerpt).toBe('Golden hour view');
    expect(feed.data.find((item) => item.targetId === 'city-spot')?.excerpt).toBe('Austin place worth saving.');
    expect(feed.data.find((item) => item.targetId === 'scope-spot')?.excerpt).toBe('Scope place worth saving.');
  });

  it('uses raw public reviews after an empty private page, then preserves a later strict empty page', async () => {
    let privateFeedCalls = 0;
    let starterFeedCalls = 0;
    const get = vi.fn((path: string) => {
      if (path === '/api/content/feed/') {
        privateFeedCalls += 1;
        return Promise.resolve({
          data: {
            data: [],
            meta: { page: privateFeedCalls, pageSize: 20, total: 0, totalPages: 1 },
          },
        });
      }
      if (path === '/api/content/feed/trending') {
        starterFeedCalls += 1;
        return Promise.resolve({
          data: {
            data: starterFeedCalls === 1
              ? [{ ...spotItem, id: 'raw-review-spot', userId: undefined }]
              : [],
          },
        });
      }
      if (path === '/api/content/reviews/spot/raw-review-spot') {
        return Promise.resolve({
          data: [
            {
              id: 'raw-review',
              user: { id: '44444444-4444-4444-4444-444444444444' },
              rating: 5,
              comment: 'A raw-array review still belongs in the starter feed.',
              createdAt: '2026-06-04T12:00:00Z',
            },
          ],
        });
      }
      if (path === '/api/content/spots/') {
        return Promise.resolve({ data: { data: [] } });
      }
      return Promise.reject(new Error(`unexpected path ${path}`));
    });

    vi.doMock('@/services/demoMode', () => mockDemoMode(false, false));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue('live-access-token'),
      default: { get, put: vi.fn(), post: vi.fn() },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue(mockData()),
    }));

    const feedService = await import('@/services/feedService');

    const starterPage = await feedService.getFeed();
    expect(starterPage.data).toEqual([
      expect.objectContaining({
        id: 'review-raw-review',
        type: 'review',
        targetId: 'raw-review-spot',
      }),
    ]);

    const emptyPage = await feedService.getFeed(2);
    expect(emptyPage).toMatchObject({
      data: [],
      meta: { page: 2, pageSize: 20, total: 0, totalPages: 1 },
    });
  });

  it('applies strict and fallback outage policies to public and private feeds', async () => {
    vi.doMock('@/services/demoMode', () => mockDemoMode(false, false));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue(''),
      default: {
        get: vi.fn().mockRejectedValue(new Error('public feed offline')),
        put: vi.fn(),
        post: vi.fn(),
      },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue(mockData()),
    }));

    const strictFeedService = await import('@/services/feedService');
    await expect(strictFeedService.getFeed()).rejects.toThrow('public feed offline');

    vi.resetModules();
    vi.doMock('@/services/demoMode', () => mockDemoMode(false, true));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue('live-access-token'),
      default: {
        get: vi.fn().mockRejectedValue(new Error('private feed offline')),
        put: vi.fn(),
        post: vi.fn(),
      },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue(mockData()),
    }));

    const fallbackFeedService = await import('@/services/feedService');
    await expect(fallbackFeedService.getFeed(1, 1)).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'feed-1' })],
    });
  });

  it('uses ranked public spots for trending fallback and surfaces a strict total outage', async () => {
    const fallbackGet = vi.fn()
      .mockResolvedValueOnce({ data: { data: [] } })
      .mockResolvedValueOnce({ data: { data: [spotItem] } });
    vi.doMock('@/services/demoMode', () => mockDemoMode(false, true));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue(''),
      default: { get: fallbackGet, put: vi.fn(), post: vi.fn() },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue(mockData()),
    }));

    const fallbackFeedService = await import('@/services/feedService');
    await expect(fallbackFeedService.getTrendingSpots()).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'spot-1' })],
    });
    expect(fallbackGet).toHaveBeenNthCalledWith(2, '/api/content/spots/', {
      params: { page: 1, pageSize: 4 },
    });

    vi.resetModules();
    vi.doMock('@/services/demoMode', () => mockDemoMode(false, false));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue(''),
      default: {
        get: vi.fn().mockRejectedValue(new Error('all trending sources offline')),
        put: vi.fn(),
        post: vi.fn(),
      },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue(mockData()),
    }));

    const strictFeedService = await import('@/services/feedService');
    await expect(strictFeedService.getTrendingSpots()).rejects.toThrow('all trending sources offline');
  });

  it('uses the configured notification page size after a fallback read failure', async () => {
    vi.doMock('@/services/demoMode', () => mockDemoMode(false, true));
    vi.doMock('@/services/api', () => ({
      getAccessToken: vi.fn().mockReturnValue('live-access-token'),
      default: {
        get: vi.fn().mockRejectedValue(new Error('notifications offline')),
        put: vi.fn(),
        post: vi.fn(),
      },
    }));
    vi.doMock('@/services/mockDataLoader', () => ({
      loadMockData: vi.fn().mockResolvedValue(mockData()),
    }));

    const feedService = await import('@/services/feedService');
    await expect(feedService.getNotifications(3, 0)).resolves.toMatchObject({
      data: [],
      meta: { page: 3, pageSize: 20, total: 0, totalPages: 1 },
    });
  });
});
