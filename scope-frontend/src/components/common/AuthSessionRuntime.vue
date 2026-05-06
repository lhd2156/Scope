<template>
  <span hidden aria-hidden="true" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toasts';
import { isScopeQaMode } from '@/utils/qaMode';
import { scheduleNonCriticalTask } from '@/utils/scheduleNonCriticalTask';

interface NotificationRuntimeStore {
  fetchNotifications(force?: boolean): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

const authStore = useAuthStore();
const toastStore = useToastStore();
const route = useRoute();
const router = useRouter();
const loginLikeRouteNames = new Set(['login', 'register']);
let activeSessionExpiredToastId: string | null = null;
let activeSessionExpiredMessage: string | null = null;
let notificationsStorePromise: Promise<NotificationRuntimeStore> | null = null;
let cancelNotificationBoot: (() => void) | null = null;

void authStore.hydrateSession();

async function loadNotificationsStore(): Promise<NotificationRuntimeStore> {
  if (!notificationsStorePromise) {
    notificationsStorePromise = import('@/stores/notifications').then(({ useNotificationsStore }) => useNotificationsStore());
  }

  return notificationsStorePromise;
}

async function syncRealtimeNotifications(isAuthenticated: boolean): Promise<void> {
  cancelNotificationBoot?.();
  cancelNotificationBoot = null;

  if (isScopeQaMode()) {
    if (!notificationsStorePromise) {
      return;
    }

    const notificationsStore = await notificationsStorePromise;
    await notificationsStore.disconnect();
    return;
  }

  if (!isAuthenticated) {
    if (!notificationsStorePromise) {
      return;
    }

    const notificationsStore = await notificationsStorePromise;
    await notificationsStore.disconnect();
    return;
  }

  cancelNotificationBoot = scheduleNonCriticalTask(async () => {
    try {
      const notificationsStore = await loadNotificationsStore();
      await notificationsStore.fetchNotifications();
      await notificationsStore.connect();
    } catch {
      // Notification store state already captures the user-facing error surface.
    } finally {
      cancelNotificationBoot = null;
    }
  }, { delayMs: 1_600, timeoutMs: 4_000 });
}

function resolveSessionExpiredDestination(currentRoute: RouteLocationNormalizedLoaded) {
  return loginLikeRouteNames.has(String(currentRoute.name ?? ''))
    ? undefined
    : {
        name: 'login' as const,
        query: {
          redirect: currentRoute.fullPath,
          reason: 'expired',
        },
      };
}

function dismissSessionExpiredToast(invokeOnClose = true) {
  if (!activeSessionExpiredToastId) {
    return;
  }

  toastStore.dismissToast(activeSessionExpiredToastId, { invokeOnClose });
  activeSessionExpiredToastId = null;
  activeSessionExpiredMessage = null;
}

watch(
  () => authStore.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated) {
      dismissSessionExpiredToast();
    }

    void syncRealtimeNotifications(isAuthenticated);
  },
  { immediate: true },
);

watch(
  () => authStore.sessionExpiredMessage,
  async (sessionMessage) => {
    if (!sessionMessage) {
      dismissSessionExpiredToast();
      return;
    }

    if (activeSessionExpiredMessage !== sessionMessage) {
      dismissSessionExpiredToast();
      activeSessionExpiredToastId = toastStore.showError({
        title: 'Session expired',
        message: sessionMessage,
        autoHideMs: 0,
        onClose: () => {
          if (activeSessionExpiredToastId) {
            activeSessionExpiredToastId = null;
            activeSessionExpiredMessage = null;
          }
        },
      });
      activeSessionExpiredMessage = sessionMessage;
      authStore.clearSessionExpiredMessage();
    }

    const destination = resolveSessionExpiredDestination(route);
    if (!destination) {
      return;
    }

    try {
      await router.push(destination);
    } catch {
      // Ignore redundant navigation failures while the app settles on the login route.
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  dismissSessionExpiredToast(false);
  cancelNotificationBoot?.();
  cancelNotificationBoot = null;

  if (notificationsStorePromise) {
    void notificationsStorePromise
      .then((notificationsStore) => notificationsStore.disconnect())
      .catch(() => undefined);
  }
});
</script>
