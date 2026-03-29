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
import { sanitizeNotificationItem } from '@/utils/sanitizers';
import { toAsyncErrorMessage } from '@/utils/errors';

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<NotificationItem[]>([]);
  const loading = ref(false);
  const hasLoaded = ref(false);
  const connectionState = ref<NotificationConnectionState>('idle');
  const connectionError = ref<string | null>(null);
  const error = ref<string | null>(null);
  const unreadCount = computed(() => items.value.filter((notification) => !notification.isRead).length);
  const isRealtimeConnected = computed(() => connectionState.value === 'connected');

  async function fetchNotifications(force = false) {
    if (loading.value || (hasLoaded.value && !force)) {
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const response = await getNotifications();
      items.value = response.data;
      hasLoaded.value = true;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Atlas could not load notifications right now.');
      throw nextError;
    } finally {
      loading.value = false;
    }
  }

  function addNotification(notification: NotificationItem) {
    const normalizedNotification = sanitizeNotificationItem({
      ...notification,
      isRead: false,
    });

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

    connectionError.value = null;

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
          connectionState.value = 'error';
          connectionError.value = message;
        },
      });
    } catch (nextError) {
      connectionState.value = 'error';
      connectionError.value = toAsyncErrorMessage(nextError, 'Atlas could not start realtime notifications right now.');
    }
  }

  async function disconnect() {
    try {
      await stopNotificationStream();
    } catch (nextError) {
      connectionError.value = toAsyncErrorMessage(nextError, 'Atlas could not stop realtime notifications cleanly.');
    } finally {
      connectionState.value = 'idle';
    }
  }

  async function markRead(notificationId: string) {
    const previousItems = [...items.value];
    error.value = null;
    items.value = items.value.map((notification) =>
      notification.id === notificationId ? { ...notification, isRead: true } : notification,
    );

    try {
      await markNotificationRead(notificationId);
    } catch (nextError) {
      items.value = previousItems;
      error.value = toAsyncErrorMessage(nextError, 'Atlas could not mark that notification as read.');
    }
  }

  async function markAllRead() {
    const previousItems = [...items.value];
    error.value = null;
    items.value = items.value.map((notification) => ({ ...notification, isRead: true }));

    try {
      await markAllNotificationsRead();
    } catch (nextError) {
      items.value = previousItems;
      error.value = toAsyncErrorMessage(nextError, 'Atlas could not mark notifications as read right now.');
    }
  }

  return {
    items,
    loading,
    hasLoaded,
    unreadCount,
    connectionState,
    connectionError,
    error,
    isRealtimeConnected,
    fetchNotifications,
    addNotification,
    connect,
    disconnect,
    markRead,
    markAllRead,
  };
});
