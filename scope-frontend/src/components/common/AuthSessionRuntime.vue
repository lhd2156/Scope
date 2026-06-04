<template>
  <span hidden aria-hidden="true" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue';
import { useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toasts';
import { AUTH_MOCK_FALLBACK_ENABLED } from '@/services/demoMode';
import {
  listenForPresenceActivity,
  sendPresenceBeacon,
  sendPresenceHeartbeat,
  stopPendingPresenceWork,
  type PresenceActivityDetail,
} from '@/services/presenceService';
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
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let removePresenceActivityListener: (() => void) | null = null;
let isIdle = false;
let presenceRuntimeStarted = false;

const PRESENCE_IDLE_MS = 120_000;
const PRESENCE_HEARTBEAT_MS = 60_000;

void authStore.hydrateSession();

function isRealtimeRuntimeDisabled(): boolean {
  return isScopeQaMode() || AUTH_MOCK_FALLBACK_ENABLED;
}

function routeLooksLikePlanning(activeRoute: RouteLocationNormalizedLoaded = route): boolean {
  const routeName = String(activeRoute.name ?? '');
  return routeName === 'trip-planner'
    || routeName === 'trip-edit'
    || routeName === 'trip-detail'
    || activeRoute.path.startsWith('/trips/new')
    || activeRoute.path.startsWith('/ai/trip-planner')
    || activeRoute.fullPath.includes('assistant=open');
}

function routeContext(activeRoute: RouteLocationNormalizedLoaded = route): string {
  return String(activeRoute.name ?? (activeRoute.path || 'scope'));
}

function buildPresenceForRoute(activeRoute: RouteLocationNormalizedLoaded = route): PresenceActivityDetail {
  const isPlanning = routeLooksLikePlanning(activeRoute);
  return {
    status: isIdle ? 'idle' : isPlanning ? 'planning' : 'online',
    routeContext: routeContext(activeRoute),
    isIdle,
    isPlanning: !isIdle && isPlanning,
  };
}

function clearIdleTimer(): void {
  if (!idleTimer) {
    return;
  }

  clearTimeout(idleTimer);
  idleTimer = null;
}

function scheduleIdleDetection(): void {
  clearIdleTimer();
  if (!authStore.isAuthenticated || isRealtimeRuntimeDisabled()) {
    return;
  }

  idleTimer = setTimeout(() => {
    isIdle = true;
    void sendPresenceHeartbeat(buildPresenceForRoute(), { force: true }).catch(() => undefined);
  }, PRESENCE_IDLE_MS);
}

function markUserActive(detail: PresenceActivityDetail = {}): void {
  if (!authStore.isAuthenticated || isRealtimeRuntimeDisabled()) {
    return;
  }

  const wasIdle = isIdle;
  isIdle = false;
  scheduleIdleDetection();
  const isPlanning = detail.isPlanning ?? routeLooksLikePlanning();

  void sendPresenceHeartbeat({
    ...buildPresenceForRoute(),
    ...detail,
    isIdle: false,
    isPlanning,
    status: detail.status ?? (isPlanning ? 'planning' : 'online'),
  }, { force: detail.immediate || wasIdle }).catch(() => undefined);
}

function handleVisibilityChange(): void {
  if (typeof document === 'undefined') {
    return;
  }

  if (document.hidden) {
    isIdle = true;
    clearIdleTimer();
    void sendPresenceHeartbeat(buildPresenceForRoute(), { force: true }).catch(() => undefined);
    return;
  }

  markUserActive({ immediate: true });
}

function startPresenceRuntime(): void {
  if (heartbeatTimer || isRealtimeRuntimeDisabled()) {
    return;
  }

  presenceRuntimeStarted = true;
  removePresenceActivityListener = listenForPresenceActivity((detail) => {
    markUserActive(detail);
  });

  window.addEventListener('pointerdown', handlePassiveActivity, { passive: true });
  window.addEventListener('keydown', handlePassiveActivity);
  window.addEventListener('scroll', handlePassiveActivity, { passive: true });
  window.addEventListener('touchstart', handlePassiveActivity, { passive: true });
  window.addEventListener('focus', handlePassiveActivity);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);

  heartbeatTimer = setInterval(() => {
    if (authStore.isAuthenticated) {
      void sendPresenceHeartbeat(buildPresenceForRoute()).catch(() => undefined);
    }
  }, PRESENCE_HEARTBEAT_MS);

  markUserActive({ immediate: true });
}

function stopPresenceRuntime(sendOffline = false): void {
  const shouldSendOffline = sendOffline && presenceRuntimeStarted && !isRealtimeRuntimeDisabled();

  clearIdleTimer();
  stopPendingPresenceWork();
  removePresenceActivityListener?.();
  removePresenceActivityListener = null;
  presenceRuntimeStarted = false;

  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  if (typeof window !== 'undefined') {
    window.removeEventListener('pointerdown', handlePassiveActivity);
    window.removeEventListener('keydown', handlePassiveActivity);
    window.removeEventListener('scroll', handlePassiveActivity);
    window.removeEventListener('touchstart', handlePassiveActivity);
    window.removeEventListener('focus', handlePassiveActivity);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  }

  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  }

  if (shouldSendOffline) {
    void sendPresenceHeartbeat({ status: 'offline', routeContext: routeContext(), isIdle: true }, { force: true }).catch(() => undefined);
  }
}

function handlePassiveActivity(): void {
  markUserActive();
}

function handleBeforeUnload(): void {
  sendPresenceBeacon({ status: 'offline', routeContext: routeContext(), isIdle: true });
}

async function loadNotificationsStore(): Promise<NotificationRuntimeStore> {
  if (!notificationsStorePromise) {
    notificationsStorePromise = import('@/stores/notifications').then(({ useNotificationsStore }) => useNotificationsStore());
  }

  return notificationsStorePromise;
}

async function syncRealtimeNotifications(isAuthenticated: boolean): Promise<void> {
  cancelNotificationBoot?.();
  cancelNotificationBoot = null;

  if (isRealtimeRuntimeDisabled()) {
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

    if (isAuthenticated) {
      startPresenceRuntime();
    } else {
      stopPresenceRuntime(true);
    }
  },
  { immediate: true },
);

watch(
  () => route.fullPath,
  () => {
    markUserActive({ immediate: true });
  },
);

onMounted(() => {
  if (authStore.isAuthenticated) {
    startPresenceRuntime();
  }
});

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

  stopPresenceRuntime(true);
});
</script>
