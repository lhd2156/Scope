import api from '@/services/api';
import { mockFeed, mockNotifications, mockSpots } from '@/services/mockData';
import { paginateItems, sortByCreatedAtDescending } from '@/services/serviceUtils';
import type { ApiEnvelope, FeedItem, NotificationItem, SpotSummary } from '@/types';
import { sanitizeFeedItem, sanitizeNotificationItem, sanitizeSpotSummary } from '@/utils/sanitizers';

const FEED_BASE_PATH = '/api/content/feed';
const NOTIFICATIONS_BASE_PATH = '/api/core/notifications';

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

function updateMockNotification(notificationId: string, isRead: boolean): NotificationItem | undefined {
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

export async function getFeed(page = 1, pageSize = mockFeed.length || 1): Promise<ApiEnvelope<FeedItem[]>> {
  try {
    const { data } = await api.get<ApiEnvelope<FeedItem[]>>(FEED_BASE_PATH, { params: { page, pageSize } });
    return sanitizeFeedEnvelope(data);
  } catch {
    return sanitizeFeedEnvelope(paginateItems(sortByCreatedAtDescending(mockFeed), page, pageSize));
  }
}

export async function getTrendingSpots(limit = 4): Promise<ApiEnvelope<SpotSummary[]>> {
  try {
    const { data } = await api.get<ApiEnvelope<SpotSummary[]>>(`${FEED_BASE_PATH}/trending`, { params: { limit } });
    return sanitizeSpotEnvelope(data);
  } catch {
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

export async function getNotifications(page = 1, pageSize = mockNotifications.length || 1): Promise<ApiEnvelope<NotificationItem[]>> {
  try {
    const { data } = await api.get<ApiEnvelope<NotificationItem[]>>(NOTIFICATIONS_BASE_PATH, {
      params: { page, pageSize },
    });
    return sanitizeNotificationEnvelope(data);
  } catch {
    return sanitizeNotificationEnvelope(paginateItems(sortByCreatedAtDescending(mockNotifications), page, pageSize));
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
