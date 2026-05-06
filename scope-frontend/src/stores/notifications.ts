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

const NOTIFICATION_READ_STATE_STORAGE_VERSION = 1;
const NOTIFICATION_READ_STATE_STORAGE_KEY_PREFIX = 'scope-notification-read-state-v1';
const MAX_STORED_READ_NOTIFICATION_IDS = 500;

interface StoredNotificationReadState {
  version: number;
  readIds: string[];
}

function getNotificationReadStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeNotificationId(value: string | null | undefined): string {
  return String(value ?? '').trim();
}

function normalizeNotificationReadScope(value: string | null | undefined): string {
  const scope = String(value ?? '')
    .trim()
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return scope || 'anonymous';
}

function resolveNotificationReadScope(): string {
  try {
    const authStore = useAuthStore();
    return normalizeNotificationReadScope(
      authStore.currentUser?.id || authStore.currentUser?.email || authStore.currentUser?.username,
    );
  } catch {
    return 'anonymous';
  }
}

function resolveNotificationReadStateStorageKey(scope = resolveNotificationReadScope()): string {
  return `${NOTIFICATION_READ_STATE_STORAGE_KEY_PREFIX}:${scope}`;
}

function removeStoredReadNotificationIds(scope: string): void {
  const storage = getNotificationReadStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(resolveNotificationReadStateStorageKey(scope));
  } catch {
    // Ignore storage failures; the in-memory read state still updates.
  }
}

function readStoredReadNotificationIds(scope = resolveNotificationReadScope()): Set<string> {
  const storage = getNotificationReadStorage();

  if (!storage) {
    return new Set();
  }

  let rawValue: string | null = null;

  try {
    rawValue = storage.getItem(resolveNotificationReadStateStorageKey(scope));
  } catch {
    return new Set();
  }

  if (!rawValue) {
    return new Set();
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<StoredNotificationReadState>;

    if (
      parsedValue.version !== NOTIFICATION_READ_STATE_STORAGE_VERSION ||
      !Array.isArray(parsedValue.readIds)
    ) {
      removeStoredReadNotificationIds(scope);
      return new Set();
    }

    return new Set(
      parsedValue.readIds
        .map((notificationId) => normalizeNotificationId(notificationId))
        .filter(Boolean)
        .slice(-MAX_STORED_READ_NOTIFICATION_IDS),
    );
  } catch {
    removeStoredReadNotificationIds(scope);
    return new Set();
  }
}

function writeStoredReadNotificationIds(readIds: Set<string>, scope = resolveNotificationReadScope()): void {
  const storage = getNotificationReadStorage();

  if (!storage) {
    return;
  }

  const payload: StoredNotificationReadState = {
    version: NOTIFICATION_READ_STATE_STORAGE_VERSION,
    readIds: Array.from(readIds)
      .map((notificationId) => normalizeNotificationId(notificationId))
      .filter(Boolean)
      .slice(-MAX_STORED_READ_NOTIFICATION_IDS),
  };

  try {
    storage.setItem(resolveNotificationReadStateStorageKey(scope), JSON.stringify(payload));
  } catch {
    // Ignore storage write failures; the visible store already reflects the action.
  }
}

function rememberReadNotificationIds(notificationIds: readonly string[], scope = resolveNotificationReadScope()): void {
  const readIds = readStoredReadNotificationIds(scope);

  for (const notificationId of notificationIds) {
    const normalizedNotificationId = normalizeNotificationId(notificationId);

    if (!normalizedNotificationId) {
      continue;
    }

    readIds.delete(normalizedNotificationId);
    readIds.add(normalizedNotificationId);
  }

  while (readIds.size > MAX_STORED_READ_NOTIFICATION_IDS) {
    const oldestNotificationId = readIds.values().next().value;

    if (typeof oldestNotificationId !== 'string') {
      break;
    }

    readIds.delete(oldestNotificationId);
  }

  writeStoredReadNotificationIds(readIds, scope);
}

function getNotificationCreatedAtMs(notification: NotificationItem): number {
  const createdAtMs = Date.parse(notification.createdAt);
  return Number.isFinite(createdAtMs) ? createdAtMs : 0;
}

function buildFallbackNotificationId(notification: NotificationItem, index: number): string {
  return [
    'notification',
    normalizeNotificationReadScope(notification.type),
    normalizeNotificationReadScope(notification.createdAt),
    normalizeNotificationReadScope(notification.title).slice(0, 48),
    String(index),
  ].filter(Boolean).join('-');
}

function normalizeNotificationForInbox(notification: NotificationItem, index: number): NotificationItem {
  const sanitizedNotification = sanitizeNotificationItem(notification);
  const notificationId = normalizeNotificationId(sanitizedNotification.id);

  return {
    ...sanitizedNotification,
    id: notificationId || buildFallbackNotificationId(sanitizedNotification, index),
    isRead: sanitizedNotification.isRead === true,
  };
}

function sortNotificationsByCreatedAtDescending(notifications: readonly NotificationItem[]): NotificationItem[] {
  return [...notifications].sort(
    (left, right) => getNotificationCreatedAtMs(right) - getNotificationCreatedAtMs(left),
  );
}

function applyStoredReadState(notifications: readonly NotificationItem[], scope = resolveNotificationReadScope()): NotificationItem[] {
  const readIds = readStoredReadNotificationIds(scope);

  return notifications.map((notification) => {
    const notificationId = normalizeNotificationId(notification.id);
    return notificationId && readIds.has(notificationId)
      ? { ...notification, isRead: true }
      : notification;
  });
}

function normalizeNotificationList(notifications: readonly NotificationItem[], scope = resolveNotificationReadScope()): NotificationItem[] {
  return sortNotificationsByCreatedAtDescending(
    applyStoredReadState(
      notifications.map((notification, index) => normalizeNotificationForInbox(notification, index)),
      scope,
    ),
  );
}

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<NotificationItem[]>([]);
  const loading = ref(false);
  const hasLoaded = ref(false);
  const loadedReadScope = ref<string | null>(null);
  const connectionState = ref<NotificationConnectionState>('idle');
  const connectionError = ref<string | null>(null);
  const error = ref<string | null>(null);
  const unreadCount = computed(() => items.value.filter((notification) => !notification.isRead).length);
  const isRealtimeConnected = computed(() => connectionState.value === 'connected');

  async function fetchNotifications(force = false) {
    const readScope = resolveNotificationReadScope();
    const hasScopeChanged = Boolean(loadedReadScope.value && loadedReadScope.value !== readScope);

    if (loading.value || (hasLoaded.value && loadedReadScope.value === readScope && !force)) {
      return;
    }

    if (hasScopeChanged) {
      items.value = [];
      hasLoaded.value = false;
    }

    loading.value = true;
    error.value = null;

    try {
      const response = await getNotifications();

      if (readScope !== resolveNotificationReadScope()) {
        items.value = [];
        hasLoaded.value = false;
        loadedReadScope.value = null;
        return;
      }

      items.value = normalizeNotificationList(response.data, readScope);
      rememberReadNotificationIds(
        items.value
          .filter((notification) => notification.isRead)
          .map((notification) => notification.id),
        readScope,
      );
      hasLoaded.value = true;
      loadedReadScope.value = readScope;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not load notifications right now.');
      throw nextError;
    } finally {
      loading.value = false;
    }
  }

  function addNotification(notification: NotificationItem) {
    const readScope = resolveNotificationReadScope();
    const normalizedIncomingNotification = normalizeNotificationForInbox(notification, items.value.length);
    const normalizedNotificationId = normalizeNotificationId(normalizedIncomingNotification.id);
    const storedReadIds = readStoredReadNotificationIds(readScope);
    const existingIndex = normalizedNotificationId
      ? items.value.findIndex((entry) => normalizeNotificationId(entry.id) === normalizedNotificationId)
      : -1;
    const existingNotification = existingIndex >= 0 ? items.value[existingIndex] : undefined;
    const normalizedNotification = sanitizeNotificationItem({
      ...normalizedIncomingNotification,
      isRead: Boolean(
        normalizedIncomingNotification.isRead ||
        existingNotification?.isRead ||
        (normalizedNotificationId && storedReadIds.has(normalizedNotificationId)),
      ),
    });

    if (normalizedNotification.isRead && normalizedNotificationId) {
      rememberReadNotificationIds([normalizedNotificationId], readScope);
    }

    if (existingIndex >= 0) {
      items.value.splice(existingIndex, 1, normalizedNotification);
      items.value = sortNotificationsByCreatedAtDescending(items.value);
      return;
    }

    items.value = sortNotificationsByCreatedAtDescending([normalizedNotification, ...items.value]);
  }

  function receiveNotification(notification: NotificationItem) {
    addNotification(notification);

    const toastStore = useToastStore();
    toastStore.showInfo({
      title: notification.title || 'Scope update',
      message: notification.body || 'A fresh Scope notification just landed in your inbox.',
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
          connectionError.value = message;

          if (message) {
            connectionState.value = 'error';
          }
        },
      });
    } catch (nextError) {
      connectionState.value = 'error';
      connectionError.value = toAsyncErrorMessage(nextError, 'Scope could not start realtime notifications right now.');
    }
  }

  async function disconnect() {
    try {
      const { stopNotificationStream } = await import('@/services/signalrService');
      await stopNotificationStream();
    } catch (nextError) {
      connectionError.value = toAsyncErrorMessage(nextError, 'Scope could not stop realtime notifications cleanly.');
    } finally {
      connectionState.value = 'idle';
    }
  }

  async function markRead(notificationId: string) {
    const normalizedNotificationId = normalizeNotificationId(notificationId);

    if (!normalizedNotificationId) {
      return;
    }

    const readScope = resolveNotificationReadScope();
    const hasMatchingNotification = items.value.some(
      (notification) => normalizeNotificationId(notification.id) === normalizedNotificationId,
    );

    if (!hasMatchingNotification) {
      return;
    }

    const previousItems = [...items.value];
    error.value = null;
    items.value = items.value.map((notification) =>
      normalizeNotificationId(notification.id) === normalizedNotificationId
        ? { ...notification, isRead: true }
        : notification,
    );

    try {
      const updatedNotification = await markNotificationRead(normalizedNotificationId);
      rememberReadNotificationIds([normalizedNotificationId], readScope);

      if (updatedNotification) {
        const normalizedUpdatedNotification = normalizeNotificationForInbox({
          ...updatedNotification,
          isRead: true,
        }, 0);
        items.value = sortNotificationsByCreatedAtDescending(
          items.value.map((notification) =>
            normalizeNotificationId(notification.id) === normalizedNotificationId
              ? normalizedUpdatedNotification
              : notification,
          ),
        );
      }
    } catch (nextError) {
      items.value = previousItems;
      error.value = toAsyncErrorMessage(nextError, 'Scope could not mark that notification as read.');
      useToastStore().showError({
        title: 'Notification update failed',
        message: error.value,
      });
    }
  }

  async function markAllRead() {
    const readScope = resolveNotificationReadScope();
    const notificationIds = items.value
      .map((notification) => normalizeNotificationId(notification.id))
      .filter(Boolean);

    if (!notificationIds.length) {
      return;
    }

    if (!items.value.some((notification) => !notification.isRead)) {
      rememberReadNotificationIds(notificationIds, readScope);
      return;
    }

    const previousItems = [...items.value];
    error.value = null;
    items.value = items.value.map((notification) => ({ ...notification, isRead: true }));

    try {
      await markAllNotificationsRead();
      rememberReadNotificationIds(notificationIds, readScope);
    } catch (nextError) {
      items.value = previousItems;
      error.value = toAsyncErrorMessage(nextError, 'Scope could not mark notifications as read right now.');
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
