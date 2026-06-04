<template>
  <AppShell>
    <div class="page-container page-stack notifications-page">
      <PageHero
        eyebrow="Notifications"
        title="Scope inbox"
        description="Review friend activity, trip invites, comments, mentions, and account alerts in one place."
      >
        <template #stats>
          <span class="meta-pill">{{ notificationsStore.unreadCount }} unread</span>
        </template>
      </PageHero>

      <section class="notifications-toolbar" aria-label="Notification filters">
        <div class="filter-row">
          <button
            v-for="category in categoryOptions"
            :key="category"
            type="button"
            class="filter-chip"
            :class="{ 'is-active': selectedCategory === category }"
            @click="selectedCategory = category"
          >
            {{ formatCategory(category) }}
          </button>
        </div>

        <div class="toolbar-actions">
          <button type="button" class="toggle-button" :class="{ 'is-active': unreadOnly }" @click="unreadOnly = !unreadOnly">
            Unread only
          </button>
          <button type="button" class="secondary-button" :disabled="!notificationsStore.unreadCount" @click="void runNotificationAction(notificationsStore.markAllRead())">
            Mark all read
          </button>
          <button type="button" class="primary-button" :disabled="pushBusy" @click="enablePush">
            {{ pushBusy ? 'Enabling...' : 'Enable push' }}
          </button>
        </div>
      </section>

      <div class="notifications-workspace">
        <section class="notification-list" aria-label="Notification inbox">
          <p v-if="notificationsStore.error" class="state-copy" role="alert">{{ notificationsStore.error }}</p>
          <p v-else-if="notificationsStore.loading && !notificationsStore.items.length" class="state-copy" role="status">Loading notifications...</p>
          <div
            v-else-if="!visibleNotifications.length"
            class="notifications-empty-state"
            data-test="notifications-empty-state"
          >
            <p class="eyebrow">Inbox</p>
            <h2>No matching notifications</h2>
            <p>New Scope updates will appear here when they match your selected filters.</p>
          </div>

          <template v-else>
            <article
              v-for="notification in visibleNotifications"
              :key="notification.id"
              class="notification-card surface-card"
              :class="{ 'is-unread': !notification.isRead }"
            >
              <button type="button" class="notification-card__main" @click="void openNotification(notification)">
                <span class="notification-card__category">{{ formatCategory(notification.category || notification.type) }}</span>
                <strong>{{ notification.title }}</strong>
                <span>{{ notification.body }}</span>
              </button>
              <div class="notification-card__meta">
                <span>{{ formatDate(notification.createdAt) }}</span>
                <button v-if="!notification.isRead" type="button" class="text-button" @click="void runNotificationAction(notificationsStore.markRead(notification.id))">
                  Mark read
                </button>
                <button v-if="isFriendRequest(notification)" type="button" class="text-button" @click="void runNotificationAction(notificationsStore.performAction(notification.id, 'accept_friend_request'))">
                  Accept
                </button>
                <button v-if="isFriendRequest(notification)" type="button" class="text-button" @click="void runNotificationAction(notificationsStore.performAction(notification.id, 'decline_friend_request'))">
                  Decline
                </button>
                <button type="button" class="text-button" @click="void runNotificationAction(notificationsStore.performAction(notification.id, 'mute_category'))">
                  Mute type
                </button>
              </div>
            </article>
          </template>
        </section>

        <aside class="preferences-panel" aria-label="Notification preferences">
          <div class="preferences-panel__heading">
            <p class="eyebrow">Preferences</p>
            <h2>Delivery controls</h2>
          </div>

          <p v-if="preferencesLoading" class="state-copy" role="status">Loading preferences...</p>
          <p v-else-if="preferencesError" class="state-copy" role="alert">{{ preferencesError }}</p>
          <div v-else class="preference-stack">
            <article v-for="preference in preferences" :key="preference.category" class="preference-row">
              <div>
                <strong>{{ formatCategory(preference.category) }}</strong>
                <span>{{ preference.digestCadence === 'instant' ? 'Instant delivery' : `${formatCategory(preference.digestCadence)} cadence` }}</span>
              </div>
              <div class="preference-row__toggles">
                <button type="button" class="mini-toggle" :class="{ 'is-active': preference.inAppEnabled }" @click="void savePreference(preference, { inAppEnabled: !preference.inAppEnabled })">
                  In-app
                </button>
                <button type="button" class="mini-toggle" :class="{ 'is-active': preference.pushEnabled }" @click="void savePreference(preference, { pushEnabled: !preference.pushEnabled })">
                  Push
                </button>
                <button type="button" class="mini-toggle" :class="{ 'is-active': preference.emailEnabled }" @click="void savePreference(preference, { emailEnabled: !preference.emailEnabled })">
                  Email
                </button>
              </div>
            </article>
          </div>
        </aside>
      </div>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import PageHero from '@/components/common/PageHero.vue';
import {
  getNotificationPreferences,
  updateNotificationPreference,
} from '@/services/feedService';
import { enableBrowserPushNotifications } from '@/services/pushNotificationService';
import { useNotificationsStore } from '@/stores/notifications';
import { useToastStore } from '@/stores/toasts';
import type { NotificationItem, NotificationPreference } from '@/types';
import { toAsyncErrorMessage } from '@/utils/errors';
import { sanitizeInternalRouteTarget } from '@/utils/navigationSafety';

const notificationsStore = useNotificationsStore();
const toastStore = useToastStore();
const router = useRouter();
const selectedCategory = ref('all');
const unreadOnly = ref(false);
const preferences = ref<NotificationPreference[]>([]);
const preferencesLoading = ref(false);
const preferencesError = ref('');
const pushBusy = ref(false);

const categoryOptions = computed(() => {
  const categories = new Set(['all']);
  notificationsStore.items.forEach((notification) => {
    categories.add(notification.category || notification.type || 'general');
  });
  preferences.value.forEach((preference) => categories.add(preference.category));
  return Array.from(categories);
});

const visibleNotifications = computed(() =>
  notificationsStore.items.filter((notification) => {
    if (selectedCategory.value !== 'all' && (notification.category || notification.type) !== selectedCategory.value) {
      return false;
    }
    if (unreadOnly.value && notification.isRead) {
      return false;
    }
    return true;
  }),
);

onMounted(() => {
  void runNotificationAction(notificationsStore.fetchNotifications(true));
  void loadPreferences();
});

async function loadPreferences(): Promise<void> {
  preferencesLoading.value = true;
  preferencesError.value = '';
  try {
    const response = await getNotificationPreferences();
    preferences.value = response.data;
  } catch (error) {
    preferencesError.value = toAsyncErrorMessage(error, 'Notification preferences could not be loaded.');
  } finally {
    preferencesLoading.value = false;
  }
}

async function savePreference(
  preference: NotificationPreference,
  patch: Partial<NotificationPreference>,
): Promise<void> {
  try {
    const updatedPreference = {
      ...preference,
      ...patch,
      timeZoneId: Intl.DateTimeFormat().resolvedOptions().timeZone || preference.timeZoneId || 'UTC',
    };
    const savedPreference = await updateNotificationPreference(updatedPreference);
    preferences.value = preferences.value.map((item) =>
      item.category === savedPreference.category ? savedPreference : item,
    );
  } catch (error) {
    toastStore.showError({
      title: 'Preference not saved',
      message: toAsyncErrorMessage(error, 'Scope could not update that notification preference.'),
    });
  }
}

async function openNotification(notification: NotificationItem): Promise<void> {
  try {
    const updatedNotification = notification.isRead
      ? notification
      : (await notificationsStore.markRead(notification.id)) ?? notification;
    const actionUrl = sanitizeInternalRouteTarget(updatedNotification.actionUrl || notification.actionUrl, '');
    if (actionUrl) {
      await router.push(actionUrl).catch(() => undefined);
    }
  } catch (error) {
    toastStore.showError({
      title: 'Notification not opened',
      message: toAsyncErrorMessage(error, 'Scope could not open that notification.'),
    });
  }
}

async function runNotificationAction(action: Promise<unknown>): Promise<void> {
  try {
    await action;
  } catch (error) {
    toastStore.showError({
      title: 'Notification action failed',
      message: toAsyncErrorMessage(error, 'Scope could not update that notification.'),
    });
  }
}

async function enablePush(): Promise<void> {
  pushBusy.value = true;
  try {
    const result = await enableBrowserPushNotifications();
    const toast = result.ok ? toastStore.showSuccess : toastStore.showError;
    toast({
      title: result.ok ? 'Push enabled' : 'Push not enabled',
      message: result.message,
    });
  } finally {
    pushBusy.value = false;
  }
}

function isFriendRequest(notification: NotificationItem): boolean {
  return notification.type === 'friend.request' || notification.templateKey === 'friend.request';
}

function formatCategory(value: string): string {
  return String(value || 'general')
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string): string {
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
</script>

<style scoped>
.notifications-page {
  gap: var(--section-gap);
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.55rem 0.9rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--bg-secondary));
  color: var(--accent-teal);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 38%, var(--glass-border));
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.notifications-toolbar,
.notifications-workspace,
.preferences-panel,
.notification-list,
.preference-stack,
.preferences-panel__heading {
  display: grid;
}

.notifications-toolbar {
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, transparent);
  border-radius: var(--radius-xl);
  background: var(--bg-secondary);
}

.filter-row,
.toolbar-actions,
.notification-card__meta,
.preference-row__toggles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.toolbar-actions {
  justify-content: flex-end;
}

.filter-chip,
.toggle-button,
.secondary-button,
.primary-button,
.text-button,
.mini-toggle {
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-tertiary) 70%, var(--bg-secondary));
  color: var(--text-primary);
  cursor: pointer;
  font-weight: var(--font-weight-semibold);
}

.filter-chip,
.toggle-button,
.secondary-button,
.primary-button {
  min-height: 2.7rem;
  padding: 0.7rem 1rem;
}

.filter-chip.is-active,
.toggle-button.is-active,
.mini-toggle.is-active,
.primary-button {
  border-color: var(--accent-teal);
  background: var(--accent-teal);
  color: var(--text-inverse);
}

.secondary-button:disabled,
.primary-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.notifications-workspace {
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 24rem);
  gap: var(--space-5);
  align-items: start;
}

.notification-list {
  gap: var(--space-3);
}

.notification-card {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-5);
}

.notification-card.is-unread {
  border-color: color-mix(in srgb, var(--accent-teal) 42%, var(--glass-border));
}

.notification-card__main {
  display: grid;
  gap: var(--space-2);
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0;
  text-align: left;
}

.notification-card__main strong,
.preferences-panel__heading h2,
.preferences-panel__heading p,
.preference-row strong,
.preference-row span,
.state-copy {
  margin: 0;
}

.notification-card__main span:not(.notification-card__category),
.notification-card__meta,
.preference-row span,
.state-copy {
  color: var(--text-secondary);
}

.notification-card__category,
.eyebrow {
  color: var(--accent-teal);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-eyebrow);
  text-transform: uppercase;
}

.text-button {
  padding: 0.45rem 0.7rem;
  font-size: var(--font-size-caption);
}

.preferences-panel {
  position: sticky;
  top: calc(var(--shell-content-top) + var(--space-3));
  gap: var(--space-4);
  padding: var(--space-5);
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, transparent);
  background: var(--bg-secondary);
}

.preference-stack {
  gap: var(--space-3);
}

.preference-row {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-tertiary) 60%, transparent);
}

.preference-row > div:first-child {
  display: grid;
  gap: var(--space-1);
}

.mini-toggle {
  padding: 0.45rem 0.65rem;
  font-size: var(--font-size-caption);
}

.notifications-empty-state {
  min-height: clamp(18rem, 34vh, 26rem);
  display: grid;
  align-content: center;
  justify-items: center;
  gap: var(--space-3);
  padding: clamp(var(--space-5), 4vw, var(--space-8));
  text-align: center;
}

.notifications-empty-state h2,
.notifications-empty-state p {
  margin: 0;
}

.notifications-empty-state h2 {
  max-width: 30rem;
  color: var(--text-primary);
  font-size: clamp(1.25rem, 1.8vw, 1.7rem);
  line-height: var(--line-height-tight);
  letter-spacing: 0;
}

.notifications-empty-state p:not(.eyebrow) {
  max-width: 36rem;
  color: var(--text-secondary);
  line-height: var(--line-height-relaxed);
}

@media (max-width: 980px) {
  .notifications-workspace {
    grid-template-columns: 1fr;
  }

  .preferences-panel {
    position: static;
  }
}
</style>
