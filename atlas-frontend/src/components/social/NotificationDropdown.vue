<template>
  <div ref="dropdownRef" class="notification-dropdown" @focusout="handleDropdownFocusOut">
    <button
      :id="triggerId"
      ref="toggleRef"
      class="notification-toggle"
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="String(isOpen)"
      :aria-controls="isOpen ? panelId : undefined"
      @click="toggleMenu"
      @keydown="handleToggleKeydown"
    >
      <span class="notification-toggle__icon">
        <AtlasIcon name="bell" label="Notifications" />
        <span v-if="notificationsStore.unreadCount" class="notification-badge">{{ notificationsStore.unreadCount }}</span>
      </span>
      <span class="notification-toggle__label">Notifications</span>
    </button>

    <div
      v-if="isOpen"
      :id="panelId"
      ref="panelRef"
      class="glass-panel notification-menu"
      role="dialog"
      :aria-labelledby="panelHeadingId"
      :aria-describedby="panelDescriptionId"
      tabindex="-1"
      @keydown="handlePanelKeydown"
    >
      <header class="notification-menu__header">
        <div>
          <p class="eyebrow">Inbox</p>
          <h3 :id="panelHeadingId">Recent updates</h3>
        </div>
        <button v-if="notificationsStore.items.length" class="link-button" type="button" @click="void notificationsStore.markAllRead()">
          Mark all read
        </button>
      </header>

      <p :id="panelDescriptionId" class="notification-menu__sr-only">
        Review your latest Atlas updates, then press Escape to collapse the inbox and return to the bell.
      </p>

      <p v-if="notificationsStore.connectionError" class="notification-state" role="alert">{{ notificationsStore.connectionError }}</p>
      <p v-else-if="notificationsStore.error" class="notification-state" role="alert">{{ notificationsStore.error }}</p>

      <div v-else-if="showLoadingState" class="notification-skeleton-list" role="status" aria-live="polite" aria-label="Loading notifications">
        <article v-for="index in 4" :key="`notification-skeleton-${index}`" class="notification-skeleton-row surface-card" aria-hidden="true">
          <div class="notification-skeleton-row__copy">
            <SkeletonBlock width="72%" height="1rem" />
            <SkeletonBlock width="100%" height="0.85rem" />
            <SkeletonBlock width="88%" height="0.85rem" />
          </div>
          <div class="notification-skeleton-row__meta">
            <SkeletonBlock width="0.55rem" height="0.55rem" shape="circle" />
            <SkeletonBlock width="4.75rem" height="0.75rem" />
          </div>
        </article>
      </div>

      <EmptyStatePanel
        v-else-if="showEmptyState"
        tone="surface"
        compact
        eyebrow="Inbox"
        title="No new Atlas updates yet"
        description="Trip invites, comments, and route changes will land here as soon as they happen."
        icon="bell"
        heading-level="h4"
      />

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
import { onClickOutside } from '@vueuse/core';
import { computed, nextTick, ref, useId } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import EmptyStatePanel from '@/components/common/EmptyStatePanel.vue';
import SkeletonBlock from '@/components/common/SkeletonBlock.vue';
import VirtualList from '@/components/common/VirtualList.vue';
import { useNotificationsStore } from '@/stores/notifications';
import type { NotificationItem } from '@/types';
import { focusFirstElement, focusLastElement, moveFocus } from '@/utils/a11y';

const notificationsStore = useNotificationsStore();
const isOpen = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);
const toggleRef = ref<HTMLElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);
const triggerId = `notification-trigger-${useId()}`;
const panelId = `notification-panel-${useId()}`;
const panelHeadingId = `notification-heading-${useId()}`;
const panelDescriptionId = `notification-description-${useId()}`;
const showLoadingState = computed(
  () => notificationsStore.loading && !notificationsStore.items.length && !notificationsStore.error && !notificationsStore.connectionError,
);
const showEmptyState = computed(
  () => !notificationsStore.loading && !notificationsStore.items.length && !notificationsStore.error && !notificationsStore.connectionError,
);

function focusPanelBoundary(position: 'first' | 'last'): void {
  const focusMoved = position === 'first'
    ? focusFirstElement(panelRef.value)
    : focusLastElement(panelRef.value);

  if (!focusMoved) {
    panelRef.value?.focus();
  }
}

async function openMenu(position: 'none' | 'first' | 'last' = 'none'): Promise<void> {
  if (!isOpen.value) {
    isOpen.value = true;
    await nextTick();
  }

  if (position === 'first' || position === 'last') {
    focusPanelBoundary(position);
  }
}

function closeMenu(options: { restoreFocus?: boolean } = {}): void {
  if (!isOpen.value) {
    return;
  }

  isOpen.value = false;

  if (options.restoreFocus) {
    void nextTick(() => {
      toggleRef.value?.focus();
    });
  }
}

function toggleMenu() {
  if (isOpen.value) {
    closeMenu();
    return;
  }

  void openMenu();
}

function handleToggleKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'ArrowDown':
    case 'Enter':
    case ' ':
      event.preventDefault();
      void openMenu('first');
      break;
    case 'ArrowUp':
      event.preventDefault();
      void openMenu('last');
      break;
    case 'Escape':
      if (isOpen.value) {
        event.preventDefault();
        closeMenu({ restoreFocus: true });
      }
      break;
    default:
      break;
  }
}

function handlePanelKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      moveFocus(panelRef.value, 1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      moveFocus(panelRef.value, -1);
      break;
    case 'Home':
      event.preventDefault();
      focusPanelBoundary('first');
      break;
    case 'End':
      event.preventDefault();
      focusPanelBoundary('last');
      break;
    case 'Escape':
      event.preventDefault();
      closeMenu({ restoreFocus: true });
      break;
    default:
      break;
  }
}

function handleDropdownFocusOut(event: FocusEvent): void {
  const nextTarget = event.relatedTarget;

  if (nextTarget instanceof Node && dropdownRef.value?.contains(nextTarget)) {
    return;
  }

  closeMenu();
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

onClickOutside(dropdownRef, () => {
  closeMenu();
});
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
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    transform var(--transition-fast);
}

.notification-toggle:hover,
.notification-toggle:focus-visible {
  border-color: var(--accent-teal);
  background: var(--accent-teal-light);
  outline: none;
}

.notification-toggle:focus-visible {
  transform: translateY(-0.0625rem);
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

.notification-menu:focus-visible {
  outline: 2px solid var(--input-focus);
  outline-offset: 3px;
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

.notification-menu__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.link-button {
  border: 0;
  background: transparent;
  color: var(--accent-teal);
  cursor: pointer;
  font-weight: var(--font-weight-semibold);
}

.link-button:focus-visible {
  outline: 2px solid var(--input-focus);
  outline-offset: 3px;
  border-radius: var(--radius-md);
}

.notification-state,
.notification-row__copy p,
.notification-row__meta {
  color: var(--text-secondary);
}

.notification-skeleton-list {
  display: grid;
  gap: var(--space-3);
}

.notification-row,
.notification-skeleton-row {
  width: 100%;
  height: calc(96px - 0.5rem);
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: flex-start;
  padding: var(--space-4);
  border: 0;
  background: var(--bg-secondary);
  text-align: left;
}

.notification-row {
  cursor: pointer;
}

.notification-row:hover,
.notification-row:focus-visible {
  border-color: var(--accent-teal);
  box-shadow: var(--shadow-glow-teal);
  outline: none;
}

.notification-row__copy,
.notification-skeleton-row__copy {
  min-width: 0;
  display: grid;
  gap: var(--space-2);
}

.notification-row__meta,
.notification-skeleton-row__meta {
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

@media (prefers-reduced-motion: reduce) {
  .notification-toggle,
  .notification-row {
    transition-duration: 1ms;
  }
}
</style>
