import api from '@/services/api';
import { mockFeed, mockNotifications } from '@/services/mockData';
import type { ApiEnvelope, FeedItem, NotificationItem } from '@/types';

export async function getFeed(): Promise<ApiEnvelope<FeedItem[]>> {
  try {
    const { data } = await api.get<ApiEnvelope<FeedItem[]>>('/api/content/feed');
    return data;
  } catch {
    return {
      data: mockFeed,
      meta: { page: 1, pageSize: mockFeed.length, total: mockFeed.length, totalPages: 1 },
    };
  }
}

export async function getNotifications(): Promise<ApiEnvelope<NotificationItem[]>> {
  try {
    const { data } = await api.get<ApiEnvelope<NotificationItem[]>>('/api/core/notifications');
    return data;
  } catch {
    return {
      data: mockNotifications,
      meta: {
        page: 1,
        pageSize: mockNotifications.length,
        total: mockNotifications.length,
        totalPages: 1,
      },
    };
  }
}
