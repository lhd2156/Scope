<template>
  <div ref="dropdownRef" class="notification-dropdown" @focusout="handleDropdownFocusOut">
    <button
      :id="triggerId"
      ref="toggleRef"
      class="notification-toggle"
      data-test="notification-toggle"
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="String(isOpen)"
      :aria-controls="isOpen ? panelId : undefined"
      @click="toggleMenu"
      @keydown="handleToggleKeydown"
    >
      <span class="notification-toggle__icon">
        <ScopeIcon name="bell" label="Notifications" />
        <span v-if="notificationsStore.unreadCount" class="notification-badge" data-test="notification-badge">{{ notificationsStore.unreadCount }}</span>
      </span>
      <span class="notification-toggle__label">Notifications</span>
    </button>

    <div
      v-if="isOpen"
      :id="panelId"
      ref="panelRef"
      class="glass-panel notification-menu"
      data-test="notification-menu"
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
        <div class="notification-menu__actions">
          <button v-if="notificationsStore.unreadCount" class="link-button" data-test="notification-mark-all-read" type="button" @click="markAllRead">
            Mark all read
          </button>
          <button class="inbox-link-button" data-test="notification-open-inbox" type="button" @click="openInbox">
            Open inbox
          </button>
        </div>
      </header>

      <p :id="panelDescriptionId" class="notification-menu__sr-only">
        Review your latest Scope updates, then press Escape to collapse the inbox and return to the bell.
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

      <div
        v-else-if="showEmptyState"
        class="notification-dropdown-empty-state"
        data-test="notification-dropdown-empty-state"
      >
        <p class="eyebrow">Inbox</p>
        <h4>No new Scope updates yet</h4>
        <p>Trip invites, comments, and route changes will land here as soon as they happen.</p>
      </div>

      <VirtualList
        v-else
        :items="notificationsStore.items"
        :item-height="NOTIFICATION_ROW_HEIGHT"
        :viewport-height="NOTIFICATION_VIEWPORT_HEIGHT"
        list-label="Notifications"
      >
        <template #default="{ item }">
          <article :data-test="`notification-row-${toNotification(item).id}`" class="notification-row surface-card">
            <button class="notification-row__main" type="button" @click="void openNotification(toNotification(item))">
              <div class="notification-row__copy">
                <strong>{{ toNotification(item).title }}</strong>
                <p>{{ toNotification(item).body || 'Scope update' }}</p>
              </div>
              <span class="notification-row__meta">
                <span v-if="!toNotification(item).isRead" class="notification-row__dot" />
                <span>{{ formatRelativeDate(toNotification(item).createdAt) }}</span>
              </span>
            </button>
            <div v-if="isFriendRequest(toNotification(item))" class="notification-row__actions">
              <button type="button" class="notification-action notification-action--primary" @click.stop="void performRequestAction(toNotification(item), 'accept_friend_request')">
                Accept
              </button>
              <button type="button" class="notification-action" @click.stop="void performRequestAction(toNotification(item), 'decline_friend_request')">
                Decline
              </button>
            </div>
          </article>
        </template>
      </VirtualList>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core';
import { computed, nextTick, onBeforeUnmount, ref, useId } from 'vue';
import { useRouter } from 'vue-router';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import SkeletonBlock from '@/components/common/SkeletonBlock.vue';
import VirtualList from '@/components/common/VirtualList.vue';
import { useNotificationsStore } from '@/stores/notifications';
import type { NotificationItem } from '@/types';
import { focusFirstElement, focusLastElement, moveFocus } from '@/utils/a11y';
import { sanitizeInternalRouteTarget } from '@/utils/navigationSafety';

const notificationsStore = useNotificationsStore();
const router = useRouter();
const emit = defineEmits<{
  (event: 'open-change', isOpen: boolean): void;
}>();
const NOTIFICATION_ROW_HEIGHT = 136;
const NOTIFICATION_VIEWPORT_HEIGHT = 384;
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
    emit('open-change', true);
    if (!notificationsStore.hasLoaded && !notificationsStore.loading) {
      void notificationsStore.fetchNotifications().catch(() => undefined);
    }
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
  emit('open-change', false);

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

function openInbox(): void {
  closeMenu();
  router.push('/notifications').catch(() => undefined);
}

async function markAllRead(): Promise<void> {
  try {
    await notificationsStore.markAllRead();
  } catch {
    // Store state exposes the user-facing error; keep async click handlers contained.
  }
}

async function openNotification(notification: NotificationItem) {
  try {
    const updatedNotification = notification.isRead
      ? notification
      : (await notificationsStore.markRead(notification.id)) ?? notification;

    const actionUrl = sanitizeInternalRouteTarget(updatedNotification.actionUrl || notification.actionUrl, '');
    if (actionUrl) {
      closeMenu();
      await router.push(actionUrl).catch(() => undefined);
    }
  } catch {
    // Store state exposes the user-facing error; keep async click handlers contained.
  }
}

function isFriendRequest(notification: NotificationItem): boolean {
  return notification.type === 'friend.request' || notification.templateKey === 'friend.request';
}

async function performRequestAction(notification: NotificationItem, action: 'accept_friend_request' | 'decline_friend_request') {
  try {
    await notificationsStore.performAction(notification.id, action);
  } catch {
    // Store state exposes the user-facing error; keep async click handlers contained.
  }
}

function formatRelativeDate(value: string): string {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return 'Just now';
  }

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

onBeforeUnmount(() => {
  if (isOpen.value) {
    emit('open-change', false);
  }
});
</script>

<style scoped>
.notification-dropdown {
  position: relative;
  z-index: var(--z-notification);
}

.notification-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 2.85rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 96%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--glass-bg) 90%, transparent);
  color: var(--text-primary);
  padding: 0.72rem 1rem;
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--text-primary) 10%, transparent),
    0 0.85rem 1.8rem color-mix(in srgb, var(--bg-primary) 18%, transparent);
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast),
    color var(--transition-fast);
}

.notification-toggle:hover,
.notification-toggle:focus-visible {
  border-color: color-mix(in srgb, var(--accent-teal) 40%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal-light) 72%, transparent);
  box-shadow:
    var(--shadow-md),
    0 0 0 1px color-mix(in srgb, var(--accent-teal) 16%, transparent);
  outline: none;
}

.notification-toggle:hover,
.notification-toggle:focus-visible {
  transform: translateY(-0.0625rem);
}

.notification-toggle__icon {
  position: relative;
  display: inline-flex;
}

.notification-toggle__label {
  font-weight: var(--font-weight-medium);
}

.notification-badge {
  position: absolute;
  inset: -0.42rem -0.52rem auto auto;
  min-width: 1.15rem;
  height: 1.15rem;
  border-radius: var(--radius-full);
  background: var(--danger);
  color: var(--text-primary);
  font-size: 0.7rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.25rem;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--bg-primary) 72%, transparent);
  isolation: isolate;
}

.notification-badge::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: color-mix(in srgb, var(--danger) 36%, transparent);
  z-index: -1;
  animation: notification-pulse 1.8s ease-out infinite;
}

.notification-menu {
  position: absolute;
  right: 0;
  top: calc(100% + var(--space-3));
  width: min(31rem, calc(100vw - 2rem));
  padding: var(--space-5);
  display: grid;
  gap: var(--space-4);
  z-index: var(--z-notification);
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

.notification-menu__header > div {
  min-width: 0;
}

.notification-menu__actions {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
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

.link-button,
.inbox-link-button {
  border: 0;
  background: transparent;
  color: var(--accent-teal);
  cursor: pointer;
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.link-button:focus-visible,
.inbox-link-button:focus-visible {
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
  padding: var(--space-4);
  background: var(--bg-secondary);
  text-align: left;
}

.notification-row {
  height: calc(100% - var(--space-2));
  display: grid;
  gap: var(--space-3);
}

.notification-skeleton-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  column-gap: var(--space-4);
  align-items: flex-start;
  min-height: calc(116px - var(--space-2));
}

.notification-row:hover,
.notification-row:focus-within {
  border-color: var(--accent-teal);
  box-shadow: var(--shadow-glow-teal);
  outline: none;
}

.notification-row__main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  column-gap: var(--space-4);
  align-items: flex-start;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.notification-row__main:focus-visible,
.notification-action:focus-visible {
  outline: 2px solid var(--input-focus);
  outline-offset: 3px;
  border-radius: var(--radius-md);
}

.notification-row__copy,
.notification-skeleton-row__copy {
  min-width: 0;
  display: grid;
  gap: var(--space-2);
}

.notification-row__copy strong {
  display: -webkit-box;
  overflow: hidden;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.notification-row__copy p {
  display: -webkit-box;
  overflow: hidden;
  overflow-wrap: anywhere;
  line-height: var(--line-height-normal);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.notification-row__meta,
.notification-skeleton-row__meta {
  display: grid;
  justify-items: end;
  gap: var(--space-2);
  min-width: 5.9rem;
  max-width: 6.4rem;
  font-size: var(--font-size-small);
  line-height: var(--line-height-tight);
  text-align: right;
  white-space: nowrap;
}

.notification-row__dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: var(--radius-full);
  background: var(--accent-teal);
}

.notification-row__actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.notification-action {
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-tertiary) 80%, transparent);
  color: var(--text-primary);
  cursor: pointer;
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  padding: 0.45rem 0.75rem;
}

.notification-action--primary {
  border-color: var(--accent-teal);
  background: var(--accent-teal);
  color: var(--text-inverse);
}

.notification-dropdown-empty-state {
  min-height: 12rem;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: var(--space-2);
  padding: var(--space-5) var(--space-3);
  text-align: center;
}

.notification-dropdown-empty-state h4,
.notification-dropdown-empty-state p {
  margin: 0;
}

.notification-dropdown-empty-state h4 {
  max-width: 22rem;
  color: var(--text-primary);
  font-size: 1rem;
  line-height: var(--line-height-tight);
  letter-spacing: 0;
}

.notification-dropdown-empty-state p:not(.eyebrow) {
  max-width: 24rem;
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  line-height: var(--line-height-relaxed);
}

@media (max-width: 34rem) {
  .notification-menu {
    right: calc(var(--space-3) * -1);
    width: min(100vw - 1rem, 31rem);
    padding: var(--space-4);
  }

  .notification-row,
  .notification-skeleton-row {
    column-gap: var(--space-3);
    padding: var(--space-3);
  }

  .notification-row__meta,
  .notification-skeleton-row__meta {
    min-width: 5.15rem;
    max-width: 5.35rem;
    font-size: var(--font-size-caption);
  }
}

@keyframes notification-pulse {
  0% {
    opacity: 0.75;
    transform: scale(1);
  }

  70% {
    opacity: 0;
    transform: scale(1.9);
  }

  100% {
    opacity: 0;
    transform: scale(1.9);
  }
}

@media (prefers-reduced-motion: reduce) {
  .notification-toggle,
  .notification-row {
    transition-duration: 1ms;
  }

  .notification-badge::after {
    animation: none;
    opacity: 0;
  }
}
</style>
