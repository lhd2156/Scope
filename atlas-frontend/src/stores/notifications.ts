import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/feedService';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toasts';
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

  function receiveNotification(notification: NotificationItem) {
    addNotification(notification);

    const toastStore = useToastStore();
    toastStore.showInfo({
      title: notification.title || 'Atlas update',
      message: notification.body || 'A fresh Atlas notification just landed in your inbox.',
      autoHideMs: 5_000,
    });
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
      const { startNotificationStream } = await import('@/services/signalrService');
      await startNotificationStream({
        accessTokenFactory: () => authStore.token,
        onNotification: (notification) => {
          receiveNotification(notification);
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
      const { stopNotificationStream } = await import('@/services/signalrService');
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
      useToastStore().showError({
        title: 'Notification update failed',
        message: error.value,
      });
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
      useToastStore().showError({
        title: 'Notification update failed',
        message: error.value,
      });
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
