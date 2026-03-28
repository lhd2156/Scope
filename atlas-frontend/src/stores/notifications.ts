import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { getNotifications } from '@/services/feedService';
import { startNotificationStream, stopNotificationStream } from '@/services/signalrService';
import type { NotificationItem } from '@/types';

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<NotificationItem[]>([]);
  const loading = ref(false);
  const unreadCount = computed(() => items.value.filter((notification) => !notification.isRead).length);

  async function fetchNotifications() {
    loading.value = true;
    const response = await getNotifications();
    items.value = response.data;
    loading.value = false;
  }

  function connect() {
    startNotificationStream((notification) => {
      items.value = [notification, ...items.value];
    });
  }

  function disconnect() {
    stopNotificationStream();
  }

  function markAllRead() {
    items.value = items.value.map((notification) => ({ ...notification, isRead: true }));
  }

  return {
    items,
    loading,
    unreadCount,
    fetchNotifications,
    connect,
    disconnect,
    markAllRead,
  };
});
