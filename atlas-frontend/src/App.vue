<template>
  <RouterView />
  <Toast
    :open="Boolean(authStore.sessionExpiredMessage)"
    title="Session expired"
    :message="authStore.sessionExpiredMessage || ''"
    tone="error"
    @close="authStore.clearSessionExpiredMessage()"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import Toast from '@/components/common/Toast.vue';
import { useAuthStore } from '@/stores/auth';
import { useNotificationsStore } from '@/stores/notifications';

const authStore = useAuthStore();
const notificationsStore = useNotificationsStore();
const route = useRoute();
const router = useRouter();

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
