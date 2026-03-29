<template>
  <RouterView v-slot="{ Component, route: activeRoute }">
    <Transition :name="routeTransitionName" mode="out-in" appear>
      <div
        :key="resolveRouteStageKey(activeRoute)"
        class="route-stage"
        :data-route-name="resolveRouteStageName(activeRoute)"
        :data-route-path="activeRoute.path"
      >
        <AppErrorBoundary :reset-key="resolveRouteBoundaryKey(activeRoute)">
          <component :is="Component" />
        </AppErrorBoundary>
      </div>
    </Transition>
  </RouterView>

  <ToastViewport />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';
import { RouterView, useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router';
import AppErrorBoundary from '@/components/common/AppErrorBoundary.vue';
import ToastViewport from '@/components/common/ToastViewport.vue';
import { useAuthStore } from '@/stores/auth';
import { useNotificationsStore } from '@/stores/notifications';
import { useToastStore } from '@/stores/toasts';
import { useReducedMotion } from '@/utils/motion';

const authStore = useAuthStore();
const notificationsStore = useNotificationsStore();
const toastStore = useToastStore();
const reducedMotion = useReducedMotion();
const route = useRoute();
const router = useRouter();

const routeTransitionName = computed(() => (reducedMotion.value ? 'route-fade-reduced' : 'route-fade'));
let activeSessionExpiredToastId: string | null = null;
let activeSessionExpiredMessage: string | null = null;

void authStore.hydrateSession();

async function syncRealtimeNotifications(isAuthenticated: boolean) {
  if (!isAuthenticated) {
    await notificationsStore.disconnect();
    return;
  }

  try {
    await notificationsStore.fetchNotifications();
    await notificationsStore.connect();
  } catch {
    // Notification store state already captures the user-facing error surface.
  }
}

function dismissSessionExpiredToast(invokeOnClose = false): void {
  if (!activeSessionExpiredToastId) {
    activeSessionExpiredMessage = null;
    return;
  }

  const toastId = activeSessionExpiredToastId;
  activeSessionExpiredToastId = null;
  activeSessionExpiredMessage = null;
  toastStore.dismissToast(toastId, { invokeOnClose });
}

function resolveRouteStageKey(activeRoute: RouteLocationNormalizedLoaded): string {
  return activeRoute.path;
}

function resolveRouteBoundaryKey(activeRoute: RouteLocationNormalizedLoaded): string {
  return activeRoute.fullPath;
}

function resolveRouteStageName(activeRoute: RouteLocationNormalizedLoaded): string {
  return typeof activeRoute.name === 'string' ? activeRoute.name : activeRoute.path;
}

watch(
  () => authStore.isAuthenticated,
  (isAuthenticated) => {
    void syncRealtimeNotifications(isAuthenticated);
  },
  { immediate: true },
);

watch(
  () => authStore.sessionExpiredMessage,
  (message) => {
    if (!message) {
      dismissSessionExpiredToast(false);
      return;
    }

    if (message === activeSessionExpiredMessage) {
      return;
    }

    dismissSessionExpiredToast(false);
    activeSessionExpiredMessage = message;
    activeSessionExpiredToastId = toastStore.showError({
      title: 'Session expired',
      message,
      autoHideMs: 0,
      onClose: () => {
        activeSessionExpiredToastId = null;
        activeSessionExpiredMessage = null;
        authStore.clearSessionExpiredMessage();
      },
    });
  },
  { immediate: true },
);

watch(
  () => authStore.sessionExpiredMessage,
  (message) => {
    if (!message || !route.meta.requiresAuth) {
      return;
    }

    void router.replace({
      name: 'login',
      query: {
        redirect: route.fullPath,
        reason: 'expired',
      },
    });
  },
);

onBeforeUnmount(() => {
  dismissSessionExpiredToast(false);
  void notificationsStore.disconnect();
});
</script>
