<template>
  <div class="notification-dropdown">
    <button class="notification-toggle" type="button" @click="toggleMenu">
      <span class="notification-toggle__icon">
        <AtlasIcon name="bell" label="Notifications" />
        <span v-if="notificationsStore.unreadCount" class="notification-badge">{{ notificationsStore.unreadCount }}</span>
      </span>
      <span class="notification-toggle__label">Notifications</span>
    </button>

    <div v-if="isOpen" class="glass-panel notification-menu">
      <header class="notification-menu__header">
        <div>
          <p class="eyebrow">Inbox</p>
          <h3>Recent updates</h3>
        </div>
        <button v-if="notificationsStore.items.length" class="link-button" type="button" @click="void notificationsStore.markAllRead()">
          Mark all read
        </button>
      </header>

      <p v-if="notificationsStore.connectionError" class="notification-state" role="alert">{{ notificationsStore.connectionError }}</p>
      <p v-else-if="notificationsStore.error" class="notification-state" role="alert">{{ notificationsStore.error }}</p>
      <p v-else-if="notificationsStore.loading" class="notification-state">Loading notifications…</p>
      <p v-else-if="!notificationsStore.items.length" class="notification-state">No new Atlas updates yet.</p>

      <VirtualList
        v-else
        :items="notificationsStore.items"
        :item-height="96"
        :viewport-height="360"
        list-label="Notifications"
      >
        <template #default="{ item }">
          <button class="notification-row surface-card" type="button" @click="void markRead(toNotification(item))">
            <div class="notification-row__copy">
              <strong>{{ toNotification(item).title }}</strong>
              <p>{{ toNotification(item).body || 'Atlas update' }}</p>
            </div>
            <span class="notification-row__meta">
              <span v-if="!toNotification(item).isRead" class="notification-row__dot" />
              <span>{{ formatRelativeDate(toNotification(item).createdAt) }}</span>
            </span>
          </button>
        </template>
      </VirtualList>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import VirtualList from '@/components/common/VirtualList.vue';
import { useNotificationsStore } from '@/stores/notifications';
import type { NotificationItem } from '@/types';

const notificationsStore = useNotificationsStore();
const isOpen = ref(false);

function toggleMenu() {
  isOpen.value = !isOpen.value;
}

function toNotification(value: unknown): NotificationItem {
  return value as NotificationItem;
}

async function markRead(notification: NotificationItem) {
  if (notification.isRead) {
    return;
  }

  await notificationsStore.markRead(notification.id);
}

function formatRelativeDate(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
</script>

<style scoped>
.notification-dropdown {
  position: relative;
}

.notification-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: var(--glass-bg);
  color: var(--text-primary);
  padding: 0.7rem 0.95rem;
  cursor: pointer;
}

.notification-toggle__icon {
  position: relative;
  display: inline-flex;
}

.notification-badge {
  position: absolute;
  inset: -0.4rem -0.5rem auto auto;
  min-width: 1.15rem;
  height: 1.15rem;
  border-radius: var(--radius-full);
  background: var(--danger);
  color: white;
  font-size: 0.7rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.25rem;
}

.notification-menu {
  position: absolute;
  right: 0;
  top: calc(100% + var(--space-3));
  width: min(26rem, calc(100vw - 2rem));
  padding: var(--space-5);
  display: grid;
  gap: var(--space-4);
  z-index: var(--z-dropdown);
}

.notification-menu__header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  align-items: flex-start;
}

.eyebrow {
  margin: 0 0 var(--space-1);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.notification-menu__header h3,
.notification-state,
.notification-row__copy strong,
.notification-row__copy p {
  margin: 0;
}

.link-button {
  border: 0;
  background: transparent;
  color: var(--accent-teal);
  cursor: pointer;
  font-weight: var(--font-weight-semibold);
}

.notification-state,
.notification-row__copy p,
.notification-row__meta {
  color: var(--text-secondary);
}

.notification-row {
  width: 100%;
  height: calc(96px - 0.5rem);
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: flex-start;
  padding: var(--space-4);
  border: 0;
  background: var(--bg-secondary);
  cursor: pointer;
  text-align: left;
}

.notification-row__copy {
  min-width: 0;
}

.notification-row__meta {
  display: grid;
  justify-items: end;
  gap: var(--space-2);
  font-size: var(--font-size-small);
}

.notification-row__dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: var(--radius-full);
  background: var(--accent-teal);
}
</style>
