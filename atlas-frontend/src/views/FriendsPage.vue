<template>
  <AppShell>
    <div class="page-container page-stack">
      <SectionHeading
        eyebrow="Friends"
        title="Social graph and notifications"
        description="This page blends profile relationships with the notification stream scaffolding."
      />

      <section class="friends-grid">
        <article class="glass-panel friends-panel">
          <h2>Friend circle</h2>
          <div class="friend-list">
            <div v-for="friend in mockUsers" :key="friend.id" class="friend-row">
              <div>
                <strong>{{ friend.displayName }}</strong>
                <p>{{ friend.homeBase }}</p>
              </div>
              <span>{{ friend.stats?.spots ?? 0 }} spots</span>
            </div>
          </div>
        </article>

        <article class="glass-panel notifications-panel">
          <div class="panel-header">
            <h2>Notifications</h2>
            <button class="button button-secondary" type="button" @click="notificationsStore.markAllRead">Mark all read</button>
          </div>
          <div class="notification-list">
            <article v-for="notification in notificationsStore.items" :key="notification.id" class="notification-card">
              <strong>{{ notification.title }}</strong>
              <p>{{ notification.body }}</p>
            </article>
          </div>
        </article>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import AppShell from '@/components/common/AppShell.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import { mockUsers } from '@/services/mockData';
import { useNotificationsStore } from '@/stores/notifications';

const notificationsStore = useNotificationsStore();

onMounted(async () => {
  await notificationsStore.fetchNotifications();
  notificationsStore.connect();
});

onUnmounted(() => {
  notificationsStore.disconnect();
});
</script>

<style scoped>
.friends-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-6);
}

.friends-panel,
.notifications-panel {
  padding: var(--space-6);
}

.friend-list,
.notification-list {
  display: grid;
  gap: var(--space-4);
  margin-top: var(--space-4);
}

.friend-row,
.notification-card,
.panel-header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
}

.friend-row,
.notification-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  background: var(--bg-secondary);
}

.friend-row p,
.friend-row span,
.notification-card p {
  margin: 0;
  color: var(--text-secondary);
}

@media (max-width: 900px) {
  .friends-grid {
    grid-template-columns: 1fr;
  }

  .friend-row,
  .notification-card,
  .panel-header {
    flex-direction: column;
  }
}
</style>
