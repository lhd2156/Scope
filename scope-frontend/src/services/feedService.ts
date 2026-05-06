import api from '@/services/api';
import { loadMockData } from '@/services/mockDataLoader';
import { normalizeArrayEnvelopeData, paginateItems, sortByCreatedAtDescending } from '@/services/serviceUtils';
import type { ApiEnvelope, FeedItem, NotificationItem, SpotSummary } from '@/types';
import { sanitizeFeedItem, sanitizeNotificationItem, sanitizeSpotSummary } from '@/utils/sanitizers';
import { rankTrendingSpots } from '@/utils/spotRanking';

const FEED_BASE_PATH = '/api/content/feed';
const NOTIFICATIONS_BASE_PATH = '/api/core/notifications';
const DEFAULT_FALLBACK_PAGE_SIZE = 20;
let hasObservedLiveFeedData = false;

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

async function buildMockFeedEnvelope(page: number, pageSize: number): Promise<ApiEnvelope<FeedItem[]>> {
  const { mockFeed } = await loadMockData();
  const resolvedPageSize = pageSize || mockFeed.length || 1;
  return sanitizeFeedEnvelope(
    paginateItems(sortByCreatedAtDescending(mockFeed), page, resolvedPageSize),
    { allowGeneratedActorAvatar: true },
  );
}

export async function getFeed(page = 1, pageSize = DEFAULT_FALLBACK_PAGE_SIZE): Promise<ApiEnvelope<FeedItem[]>> {
  try {
    const { data } = await api.get<ApiEnvelope<FeedItem[]>>(FEED_BASE_PATH, { params: { page, pageSize } });
    const sanitizedResponse = sanitizeFeedEnvelope(data);

    if (sanitizedResponse.data.length) {
      hasObservedLiveFeedData = true;
      return sanitizedResponse;
    }

    return hasObservedLiveFeedData ? sanitizedResponse : buildMockFeedEnvelope(page, pageSize);
  } catch {
    return buildMockFeedEnvelope(page, pageSize);
  }
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

  try {
    const { data } = await api.get<ApiEnvelope<SpotSummary[]>>(`${FEED_BASE_PATH}/trending`, { params: { limit } });
    const sanitizedEnvelope = sanitizeSpotEnvelope(data);
    if (!sanitizedEnvelope.data.length) {
      return mockTrendingEnvelope();
    }

    return {
      ...sanitizedEnvelope,
      data: rankTrendingSpots(sanitizedEnvelope.data, limit),
    };
  } catch {
    return mockTrendingEnvelope();
  }
}

export async function getNotifications(page = 1, pageSize = DEFAULT_FALLBACK_PAGE_SIZE): Promise<ApiEnvelope<NotificationItem[]>> {
  try {
    const { data } = await api.get<ApiEnvelope<NotificationItem[]>>(NOTIFICATIONS_BASE_PATH, {
      params: { page, pageSize },
    });
    return sanitizeNotificationEnvelope(data);
  } catch {
    const { mockNotifications } = await loadMockData();
    const resolvedPageSize = pageSize || mockNotifications.length || 1;
    return sanitizeNotificationEnvelope(paginateItems(sortByCreatedAtDescending(mockNotifications), page, resolvedPageSize));
  }
}

export async function markNotificationRead(notificationId: string): Promise<NotificationItem | undefined> {
  try {
    const { data } = await api.put<ApiEnvelope<NotificationItem> | NotificationItem>(
      `${NOTIFICATIONS_BASE_PATH}/${notificationId}/read`,
      undefined,
    );

    return sanitizeNotificationItem('data' in data ? data.data : data);
  } catch {
    return updateMockNotification(notificationId, true);
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  try {
    await api.put(`${NOTIFICATIONS_BASE_PATH}/read-all`, undefined);
  } catch {
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
  }
}
