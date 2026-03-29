import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/feedService';
import { startNotificationStream, stopNotificationStream } from '@/services/signalrService';
import { useAuthStore } from '@/stores/auth';
import type { NotificationConnectionState, NotificationItem } from '@/types';

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<NotificationItem[]>([]);
  const loading = ref(false);
  const hasLoaded = ref(false);
  const connectionState = ref<NotificationConnectionState>('idle');
  const connectionError = ref<string | null>(null);
  const unreadCount = computed(() => items.value.filter((notification) => !notification.isRead).length);
  const isRealtimeConnected = computed(() => connectionState.value === 'connected');

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
    const normalizedNotification = {
      ...notification,
      isRead: false,
    };

    const existingIndex = items.value.findIndex((entry) => entry.id === normalizedNotification.id);

    if (existingIndex >= 0) {
      items.value.splice(existingIndex, 1, normalizedNotification);
      return;
    }

    items.value = [normalizedNotification, ...items.value];
  }

  async function connect() {
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated) {
      connectionState.value = 'idle';
      connectionError.value = null;
      return;
    }

    try {
      await startNotificationStream({
        accessTokenFactory: () => authStore.token,
        onNotification: (notification) => {
          addNotification(notification);
        },
        onStateChange: (state) => {
          connectionState.value = state;
        },
        onError: (message) => {
          connectionError.value = message;
        },
      });
    } catch {
      // Connection state and error are already surfaced via callbacks.
    }
  }

  async function disconnect() {
    await stopNotificationStream();
    connectionState.value = 'idle';
    connectionError.value = null;
  }

  async function markRead(notificationId: string) {
    const previousItems = [...items.value];
    items.value = items.value.map((notification) =>
      notification.id === notificationId ? { ...notification, isRead: true } : notification,
    );

    try {
      await markNotificationRead(notificationId);
    } catch {
      items.value = previousItems;
    }
  }

  async function markAllRead() {
    const previousItems = [...items.value];
    items.value = items.value.map((notification) => ({ ...notification, isRead: true }));

    try {
      await markAllNotificationsRead();
    } catch {
      items.value = previousItems;
    }
  }

  return {
    items,
    loading,
    hasLoaded,
    unreadCount,
    connectionState,
    connectionError,
    isRealtimeConnected,
    fetchNotifications,
    addNotification,
    connect,
    disconnect,
    markRead,
    markAllRead,
  };
});
