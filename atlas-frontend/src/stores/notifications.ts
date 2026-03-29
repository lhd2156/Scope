import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { getNotifications } from '@/services/feedService';
import { startNotificationStream, stopNotificationStream } from '@/services/signalrService';
import type { NotificationItem } from '@/types';

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<NotificationItem[]>([]);
  const loading = ref(false);
  const hasLoaded = ref(false);
  const unreadCount = computed(() => items.value.filter((notification) => !notification.isRead).length);

  async function fetchNotifications(force = false) {
    if (loading.value || (hasLoaded.value && !force)) {
      return;
    }

    loading.value = true;

    try {
      const response = await getNotifications();
      items.value = response.data;
      hasLoaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  function addNotification(notification: NotificationItem) {
    const existingIndex = items.value.findIndex((entry) => entry.id === notification.id);

    if (existingIndex >= 0) {
      items.value.splice(existingIndex, 1, notification);
      return;
    }

    items.value = [notification, ...items.value];
  }

  function connect() {
    startNotificationStream((notification) => {
      addNotification(notification);
    });
  }

  function disconnect() {
    stopNotificationStream();
  }

  function markRead(notificationId: string) {
    items.value = items.value.map((notification) =>
      notification.id === notificationId ? { ...notification, isRead: true } : notification,
    );
  }

  function markAllRead() {
    items.value = items.value.map((notification) => ({ ...notification, isRead: true }));
  }

  return {
    items,
    loading,
    hasLoaded,
    unreadCount,
    fetchNotifications,
    addNotification,
    connect,
    disconnect,
    markRead,
    markAllRead,
  };
});
