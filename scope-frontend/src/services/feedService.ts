import api from '@/services/api';
import { DEMO_MODE_ENABLED, localFallbackEnabled } from '@/services/demoMode';
import { loadMockData } from '@/services/mockDataLoader';
import { normalizeArrayEnvelopeData, paginateItems, sortByCreatedAtDescending } from '@/services/serviceUtils';
import type {
  ApiEnvelope,
  FeedItem,
  NotificationItem,
  NotificationPreference,
  NotificationPreferenceInput,
  PushSubscriptionInput,
  SpotSummary,
} from '@/types';
import {
  sanitizeFeedItem,
  sanitizeNotificationItem,
  sanitizeNotificationPreference,
  sanitizeSpotSummary,
} from '@/utils/sanitizers';
import { rankTrendingSpots } from '@/utils/spotRanking';

const FEED_BASE_PATH = '/api/content/feed';
const FEED_LIST_PATH = '/api/content/feed/';
const NOTIFICATIONS_BASE_PATH = '/api/core/notifications';
const DEFAULT_FALLBACK_PAGE_SIZE = 20;
const DEFAULT_NOTIFICATION_CATEGORIES = ['account', 'security', 'trip', 'friend', 'social', 'comment', 'mention', 'digest', 'general'];
const FEED_READ_FALLBACK_ENABLED = localFallbackEnabled('VITE', 'ENABLE', 'FEED', 'MOCK', 'FALLBACK');
const NOTIFICATION_READ_FALLBACK_ENABLED = localFallbackEnabled('VITE', 'ENABLE', 'NOTIFICATION', 'MOCK', 'FALLBACK');
let hasObservedLiveFeedData = false;
let hasObservedLiveTrendingData = false;

interface FeedEnvelopeSanitizerOptions {
  allowGeneratedActorAvatar?: boolean;
}

interface SpotEnvelopeSanitizerOptions {
  allowGeneratedAuthorAvatar?: boolean;
}

function sanitizeFeedEnvelope(
  response: ApiEnvelope<FeedItem[]>,
  options: FeedEnvelopeSanitizerOptions = {},
): ApiEnvelope<FeedItem[]> {
  return {
    ...response,
    data: normalizeArrayEnvelopeData(response).map((item) =>
      sanitizeFeedItem(item, { allowGeneratedActorAvatar: options.allowGeneratedActorAvatar }),
    ),
  };
}

function sanitizeNotificationEnvelope(response: ApiEnvelope<NotificationItem[]>): ApiEnvelope<NotificationItem[]> {
  return {
    ...response,
    data: normalizeArrayEnvelopeData(response).map((item) => sanitizeNotificationItem(item)),
  };
}

function sanitizeNotificationPreferenceEnvelope(response: ApiEnvelope<NotificationPreference[]>): ApiEnvelope<NotificationPreference[]> {
  return {
    ...response,
    data: normalizeArrayEnvelopeData(response).map((preference) => sanitizeNotificationPreference(preference)),
  };
}

function sanitizeSpotEnvelope(
  response: ApiEnvelope<SpotSummary[]>,
  options: SpotEnvelopeSanitizerOptions = {},
): ApiEnvelope<SpotSummary[]> {
  return {
    ...response,
    data: normalizeArrayEnvelopeData(response).map((spot) =>
      sanitizeSpotSummary(spot, { allowGeneratedAuthorAvatar: options.allowGeneratedAuthorAvatar }),
    ),
  };
}

async function updateMockNotification(notificationId: string, isRead: boolean): Promise<NotificationItem | undefined> {
  const { mockNotifications } = await loadMockData();
  const notificationIndex = mockNotifications.findIndex((notification) => notification.id === notificationId);

  if (notificationIndex === -1) {
    return undefined;
  }

  const updatedNotification = sanitizeNotificationItem({
    ...mockNotifications[notificationIndex],
    isRead,
  });

  mockNotifications.splice(notificationIndex, 1, updatedNotification);
  return updatedNotification;
}

function buildDefaultMockNotificationPreferences(): NotificationPreference[] {
  return DEFAULT_NOTIFICATION_CATEGORIES.map((category) => sanitizeNotificationPreference({
    category,
    inAppEnabled: true,
    pushEnabled: category !== 'digest',
    emailEnabled: ['account', 'security', 'trip', 'digest'].includes(category),
    digestCadence: category === 'digest' ? 'daily' : 'instant',
    quietHoursStartMinutes: null,
    quietHoursEndMinutes: null,
    timeZoneId: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  }));
}

function buildEmptyNotificationEnvelope(page: number, pageSize: number): ApiEnvelope<NotificationItem[]> {
  return {
    data: [],
    meta: {
      page,
      pageSize: Math.max(1, pageSize || DEFAULT_FALLBACK_PAGE_SIZE),
      total: 0,
      totalPages: 1,
    },
  };
}

async function buildMockFeedEnvelope(page: number, pageSize: number): Promise<ApiEnvelope<FeedItem[]>> {
  const { mockFeed } = await loadMockData();
  const resolvedPageSize = pageSize || mockFeed.length || 1;
  return sanitizeFeedEnvelope(
    paginateItems(sortByCreatedAtDescending(mockFeed), page, resolvedPageSize),
    { allowGeneratedActorAvatar: true },
  );
}

function rememberLiveFeed(items: FeedItem[]): void {
  if (items.length) {
    hasObservedLiveFeedData = true;
  }
}

function rememberLiveTrending(spots: SpotSummary[]): void {
  if (spots.length) {
    hasObservedLiveTrendingData = true;
  }
}

export async function getFeed(page = 1, pageSize = DEFAULT_FALLBACK_PAGE_SIZE): Promise<ApiEnvelope<FeedItem[]>> {
  if (DEMO_MODE_ENABLED) {
    return buildMockFeedEnvelope(page, pageSize);
  }

  try {
    const { data } = await api.get<ApiEnvelope<FeedItem[]>>(FEED_LIST_PATH, { params: { page, pageSize } });
    const sanitizedEnvelope = sanitizeFeedEnvelope(data);
    rememberLiveFeed(sanitizedEnvelope.data);
    if (sanitizedEnvelope.data.length || hasObservedLiveFeedData || !FEED_READ_FALLBACK_ENABLED) {
      return sanitizedEnvelope;
    }
  } catch (error) {
    if (!FEED_READ_FALLBACK_ENABLED) {
      throw error;
    }
  }

  return buildMockFeedEnvelope(page, pageSize);
}

export async function getTrendingSpots(limit = 4): Promise<ApiEnvelope<SpotSummary[]>> {
  async function mockTrendingEnvelope(): Promise<ApiEnvelope<SpotSummary[]>> {
    const { mockSpots } = await loadMockData();
    const trendingSpots = rankTrendingSpots(mockSpots, limit);

    return sanitizeSpotEnvelope(
      {
        data: trendingSpots,
        meta: {
          page: 1,
          pageSize: Math.max(1, limit),
          total: trendingSpots.length,
          totalPages: 1,
        },
      },
      { allowGeneratedAuthorAvatar: true },
    );
  }

  if (DEMO_MODE_ENABLED) {
    return mockTrendingEnvelope();
  }

  try {
    const { data } = await api.get<ApiEnvelope<SpotSummary[]>>(`${FEED_BASE_PATH}/trending`, { params: { limit } });
    const sanitizedEnvelope = sanitizeSpotEnvelope(data);
    const rankedEnvelope = {
      ...sanitizedEnvelope,
      data: rankTrendingSpots(sanitizedEnvelope.data, limit),
    };
    rememberLiveTrending(rankedEnvelope.data);
    if (rankedEnvelope.data.length || hasObservedLiveTrendingData || !FEED_READ_FALLBACK_ENABLED) {
      return rankedEnvelope;
    }
  } catch (error) {
    if (!FEED_READ_FALLBACK_ENABLED) {
      throw error;
    }
  }

  return mockTrendingEnvelope();
}

export async function getNotifications(
  page = 1,
  pageSize = DEFAULT_FALLBACK_PAGE_SIZE,
  filters: { category?: string; unread?: boolean } = {},
): Promise<ApiEnvelope<NotificationItem[]>> {
  if (DEMO_MODE_ENABLED) {
    const { mockNotifications } = await loadMockData();
    const resolvedPageSize = pageSize || mockNotifications.length || 1;
    const filteredNotifications = mockNotifications.filter((notification) => {
      if (filters.category && notification.category !== filters.category) {
        return false;
      }
      if (typeof filters.unread === 'boolean' && notification.isRead === filters.unread) {
        return false;
      }
      return true;
    });
    return sanitizeNotificationEnvelope(paginateItems(sortByCreatedAtDescending(filteredNotifications), page, resolvedPageSize));
  }

  try {
    const { data } = await api.get<ApiEnvelope<NotificationItem[]>>(NOTIFICATIONS_BASE_PATH, {
      params: { page, pageSize, ...filters },
    });
    return sanitizeNotificationEnvelope(data);
  } catch (error) {
    if (!NOTIFICATION_READ_FALLBACK_ENABLED) {
      throw error;
    }
  }

  return buildEmptyNotificationEnvelope(page, pageSize);
}

export async function performNotificationAction(notificationId: string, action: string): Promise<unknown> {
  if (DEMO_MODE_ENABLED) {
    if (action === 'mark_read' || action === 'open' || action.startsWith('accept_') || action.startsWith('decline_')) {
      await updateMockNotification(notificationId, true);
    }
    return { ok: true };
  }

  const { data } = await api.post(`${NOTIFICATIONS_BASE_PATH}/${notificationId}/actions`, { action });
  return data;
}

export async function getNotificationPreferences(): Promise<ApiEnvelope<NotificationPreference[]>> {
  if (DEMO_MODE_ENABLED) {
    return { data: buildDefaultMockNotificationPreferences() };
  }

  try {
    const { data } = await api.get<ApiEnvelope<NotificationPreference[]>>(`${NOTIFICATIONS_BASE_PATH}/preferences`);
    const sanitizedEnvelope = sanitizeNotificationPreferenceEnvelope(data);
    if (sanitizedEnvelope.data.length || !NOTIFICATION_READ_FALLBACK_ENABLED) {
      return sanitizedEnvelope;
    }
  } catch (error) {
    if (!NOTIFICATION_READ_FALLBACK_ENABLED) {
      throw error;
    }
  }

  return { data: buildDefaultMockNotificationPreferences() };
}

export async function updateNotificationPreference(payload: NotificationPreferenceInput): Promise<NotificationPreference> {
  const sanitizedPayload = sanitizeNotificationPreference(payload);

  if (DEMO_MODE_ENABLED) {
    return sanitizedPayload;
  }

  const { data } = await api.put<ApiEnvelope<NotificationPreference> | NotificationPreference>(
    `${NOTIFICATIONS_BASE_PATH}/preferences`,
    sanitizedPayload,
  );
  return sanitizeNotificationPreference('data' in data ? data.data : data);
}

export async function savePushSubscription(payload: PushSubscriptionInput): Promise<unknown> {
  const { data } = await api.post(`${NOTIFICATIONS_BASE_PATH}/push-subscriptions`, payload);
  return data;
}

export async function markNotificationRead(notificationId: string): Promise<NotificationItem | undefined> {
  if (DEMO_MODE_ENABLED) {
    return updateMockNotification(notificationId, true);
  }

  const { data } = await api.put<ApiEnvelope<NotificationItem> | NotificationItem>(
    `${NOTIFICATIONS_BASE_PATH}/${notificationId}/read`,
    undefined,
  );

  return sanitizeNotificationItem('data' in data ? data.data : data);
}

export async function markAllNotificationsRead(): Promise<void> {
  if (DEMO_MODE_ENABLED) {
    const { mockNotifications } = await loadMockData();
    mockNotifications.splice(
      0,
      mockNotifications.length,
      ...mockNotifications.map((notification) =>
        sanitizeNotificationItem({
          ...notification,
          isRead: true,
        }),
      ),
    );
    return;
  }

  await api.put(`${NOTIFICATIONS_BASE_PATH}/read-all`, undefined);
}
