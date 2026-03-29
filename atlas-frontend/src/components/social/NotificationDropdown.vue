<template>
  <div ref="root" class="notification-dropdown" :class="{ inline: inlinePanel }">
    <button
      v-if="!inlinePanel"
      class="trigger-button"
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="String(isOpen)"
      @click="isOpen = !isOpen"
    >
      <AtlasIcon name="bell" label="Notifications" />
      <span v-if="unreadCount" class="badge">{{ unreadCount }}</span>
    </button>

    <section v-if="inlinePanel || isOpen" class="panel glass-panel">
      <header class="panel-header">
        <div>
          <p class="eyebrow">Realtime alerts</p>
          <h2>Notifications</h2>
        </div>
        <button type="button" class="text-button" @click="$emit('mark-all-read')">Mark all read</button>
      </header>

      <div class="connection-state" :class="`state-${connectionState}`" :title="connectionTooltip">
        <span class="status-dot" />
        <span>{{ connectionLabel }}</span>
      </div>

      <p v-if="loading" class="state-copy">Loading notifications...</p>
      <div v-else-if="notifications.length" class="notification-list">
        <button
          v-for="notification in notifications"
          :key="notification.id"
          class="notification-card"
          :class="{ unread: !notification.isRead }"
          type="button"
          @click="handleNotificationClick(notification.id)"
        >
          <span class="icon-shell">
            <AtlasIcon :name="iconFor(notification.type)" />
          </span>
          <div class="content">
            <div class="title-row">
              <strong>{{ notification.title }}</strong>
              <span v-if="!notification.isRead" class="new-pill">New</span>
            </div>
            <p>{{ notification.body }}</p>
            <span class="meta">{{ formatRelativeTime(notification.createdAt) }}</span>
          </div>
        </button>
      </div>
      <div v-else class="empty-state surface-card">
        <strong>You're all caught up.</strong>
        <p>No unread trip invites, friend requests, or spot updates right now.</p>
      </div>

      <RouterLink v-if="!inlinePanel" class="footer-link" to="/friends" @click="isOpen = false">
        Open friends workspace
      </RouterLink>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onClickOutside } from '@vueuse/core';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import type { NotificationConnectionState, NotificationItem } from '@/types';
import { formatRelativeTime } from '@/utils/formatters';

const props = withDefaults(
  defineProps<{
    notifications: NotificationItem[];
    unreadCount: number;
    loading?: boolean;
    inlinePanel?: boolean;
    connectionState?: NotificationConnectionState;
    connectionError?: string | null;
  }>(),
  {
    loading: false,
    inlinePanel: false,
    connectionState: 'idle',
    connectionError: null,
  },
);

const emit = defineEmits<{
  (event: 'mark-all-read'): void;
  (event: 'read', notificationId: string): void;
}>();

const root = ref<HTMLElement | null>(null);
const isOpen = ref(false);

const connectionLabel = computed(() => {
  switch (props.connectionState) {
    case 'connected':
      return 'SignalR live';
    case 'connecting':
      return 'Connecting to SignalR…';
    case 'reconnecting':
      return 'Reconnecting…';
    case 'disconnected':
      return 'Realtime offline';
    default:
      return 'Realtime idle';
  }
});

const connectionTooltip = computed(() => props.connectionError ?? connectionLabel.value);

onClickOutside(root, () => {
  if (!props.inlinePanel) {
    isOpen.value = false;
  }
});

function iconFor(type: string): string {
  if (type.includes('friend')) {
    return 'friends';
  }

  if (type.includes('spot') || type.includes('review')) {
    return 'heart';
  }

  if (type.includes('trip')) {
    return 'calendar';
  }

  return 'sparkle';
}

function handleNotificationClick(notificationId: string) {
  emit('read', notificationId);

  if (!props.inlinePanel) {
    isOpen.value = false;
  }
}
</script>

<style scoped>
.notification-dropdown {
  position: relative;
}

.trigger-button {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 2.9rem;
  height: 2.9rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  background: var(--glass-bg);
  color: var(--text-primary);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.trigger-button:hover,
.trigger-button:focus-visible {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-glow-teal);
  transform: translateY(-0.0625rem);
  outline: none;
}

.badge {
  position: absolute;
  top: -0.25rem;
  right: -0.15rem;
  min-width: 1.2rem;
  height: 1.2rem;
  padding: 0 0.2rem;
  border-radius: var(--radius-full);
  background: var(--danger);
  color: var(--text-primary);
  font-size: 0.6875rem;
  display: inline-grid;
  place-items: center;
}

.panel {
  position: absolute;
  top: calc(100% + var(--space-3));
  right: 0;
  width: min(26rem, calc(100vw - 2rem));
  padding: var(--space-5);
  display: grid;
  gap: var(--space-4);
  z-index: var(--z-dropdown);
}

.inline .panel {
  position: static;
  width: 100%;
}

.panel-header,
.title-row,
.notification-card,
.footer-link,
.text-button,
.connection-state {
  display: flex;
  gap: var(--space-3);
}

.panel-header,
.title-row {
  justify-content: space-between;
  align-items: flex-start;
}

.eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--accent-teal);
  font-size: var(--font-size-caption);
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

h2,
.state-copy {
  margin: 0;
}

.text-button {
  border: none;
  background: transparent;
  color: var(--accent-teal);
  cursor: pointer;
  font-weight: var(--font-weight-semibold);
  padding: 0;
}

.connection-state {
  align-items: center;
  width: fit-content;
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  padding: 0.35rem 0.7rem;
  font-size: var(--font-size-small);
}

.status-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: var(--radius-full);
  background: var(--text-muted);
}

.connection-state.state-connected {
  color: var(--accent-teal);
  border-color: var(--accent-teal-light);
}

.connection-state.state-connected .status-dot {
  background: var(--accent-teal);
}

.connection-state.state-connecting,
.connection-state.state-reconnecting {
  color: var(--accent-gold);
  border-color: var(--accent-gold-light);
}

.connection-state.state-connecting .status-dot,
.connection-state.state-reconnecting .status-dot {
  background: var(--accent-gold);
}

.connection-state.state-disconnected .status-dot {
  background: var(--danger);
}

.notification-list {
  display: grid;
  gap: var(--space-3);
}

.notification-card {
  width: 100%;
  align-items: flex-start;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--bg-secondary);
  padding: var(--space-4);
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition:
    border-color var(--transition-fast),
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.notification-card:hover,
.notification-card:focus-visible {
  border-color: var(--accent-teal);
  transform: translateY(-0.0625rem);
  box-shadow: var(--shadow-md);
  outline: none;
}

.notification-card.unread {
  background: linear-gradient(135deg, var(--accent-teal-light), transparent 48%), var(--bg-secondary);
}

.icon-shell {
  display: inline-grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: var(--radius-full);
  background: var(--bg-primary);
  color: var(--accent-teal);
  flex-shrink: 0;
}

.content {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.content p,
.meta,
.empty-state p,
.state-copy {
  margin: 0;
  color: var(--text-secondary);
}

.new-pill {
  display: inline-flex;
  align-items: center;
  border-radius: var(--radius-full);
  background: var(--accent-gold-light);
  color: var(--accent-gold);
  padding: 0.2rem 0.55rem;
  font-size: 0.6875rem;
  font-weight: var(--font-weight-semibold);
}

.empty-state {
  padding: var(--space-5);
}

.footer-link {
  justify-content: center;
  align-items: center;
  color: var(--accent-teal);
  font-weight: var(--font-weight-semibold);
}
</style>
