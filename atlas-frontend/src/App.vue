<template>
  <RouterView />
</template>

<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import { RouterView } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useNotificationsStore } from '@/stores/notifications';

const authStore = useAuthStore();
const notificationsStore = useNotificationsStore();

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

onBeforeUnmount(() => {
  void notificationsStore.disconnect();
});
</script>
