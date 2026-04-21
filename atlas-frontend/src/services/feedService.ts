import api from '@/services/api';
import { loadMockData } from '@/services/mockDataLoader';
import { paginateItems, sortByCreatedAtDescending } from '@/services/serviceUtils';
import type { ApiEnvelope, FeedItem, NotificationItem, SpotSummary } from '@/types';
import { sanitizeFeedItem, sanitizeNotificationItem, sanitizeSpotSummary } from '@/utils/sanitizers';

const FEED_BASE_PATH = '/api/content/feed';
const NOTIFICATIONS_BASE_PATH = '/api/core/notifications';
const DEFAULT_FALLBACK_PAGE_SIZE = 20;

function sanitizeFeedEnvelope(response: ApiEnvelope<FeedItem[]>): ApiEnvelope<FeedItem[]> {
  return {
    ...response,
    data: response.data.map((item) => sanitizeFeedItem(item)),
  };
}

function sanitizeNotificationEnvelope(response: ApiEnvelope<NotificationItem[]>): ApiEnvelope<NotificationItem[]> {
  return {
    ...response,
    data: response.data.map((item) => sanitizeNotificationItem(item)),
  };
}

function sanitizeSpotEnvelope(response: ApiEnvelope<SpotSummary[]>): ApiEnvelope<SpotSummary[]> {
  return {
    ...response,
    data: response.data.map((spot) => sanitizeSpotSummary(spot)),
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

export async function getFeed(page = 1, pageSize = DEFAULT_FALLBACK_PAGE_SIZE): Promise<ApiEnvelope<FeedItem[]>> {
  try {
    const { data } = await api.get<ApiEnvelope<FeedItem[]>>(FEED_BASE_PATH, { params: { page, pageSize } });
    return sanitizeFeedEnvelope(data);
  } catch {
    const { mockFeed } = await loadMockData();
    const resolvedPageSize = pageSize || mockFeed.length || 1;
    return sanitizeFeedEnvelope(paginateItems(sortByCreatedAtDescending(mockFeed), page, resolvedPageSize));
  }
}

export async function getTrendingSpots(limit = 4): Promise<ApiEnvelope<SpotSummary[]>> {
  try {
    const { data } = await api.get<ApiEnvelope<SpotSummary[]>>(`${FEED_BASE_PATH}/trending`, { params: { limit } });
    return sanitizeSpotEnvelope(data);
  } catch {
    const { mockSpots } = await loadMockData();
    const trendingSpots = [...mockSpots]
      .sort((left, right) => (right.likesCount ?? 0) - (left.likesCount ?? 0))
      .slice(0, limit);

    return sanitizeSpotEnvelope({
      data: trendingSpots,
      meta: {
        page: 1,
        pageSize: Math.max(1, limit),
        total: trendingSpots.length,
        totalPages: 1,
      },
    });
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
