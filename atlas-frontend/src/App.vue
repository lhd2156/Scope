<template>
  <RouterView v-slot="{ Component, route: activeRoute }">
    <Transition :name="routeTransitionName" mode="out-in" appear>
      <div
        :key="resolveRouteStageKey(activeRoute)"
        class="route-stage"
        :data-route-name="resolveRouteStageName(activeRoute)"
        :data-route-path="activeRoute.path"
      >
        <component :is="Component" />
      </div>
    </Transition>
  </RouterView>

  <Toast
    :open="Boolean(authStore.sessionExpiredMessage)"
    title="Session expired"
    :message="authStore.sessionExpiredMessage || ''"
    tone="error"
    @close="authStore.clearSessionExpiredMessage()"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';
import { RouterView, useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router';
import Toast from '@/components/common/Toast.vue';
import { useAuthStore } from '@/stores/auth';
import { useNotificationsStore } from '@/stores/notifications';
import { useReducedMotion } from '@/utils/motion';

const authStore = useAuthStore();
const notificationsStore = useNotificationsStore();
const reducedMotion = useReducedMotion();
const route = useRoute();
const router = useRouter();

const routeTransitionName = computed(() => (reducedMotion.value ? 'route-fade-reduced' : 'route-fade'));

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

function resolveRouteStageKey(activeRoute: RouteLocationNormalizedLoaded): string {
  return activeRoute.path;
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
  void notificationsStore.disconnect();
});
</script>
