<template>
  <AppShell>
    <div class="page-container page-stack notifications-page">
      <PageHero
        eyebrow="Notifications"
        title="Scope inbox"
        description="Review friend activity, trip invites, comments, mentions, and account alerts in one place."
      >
        <template #stats>
          <span class="meta-pill meta-pill--accent">
            <ScopeIcon name="bell" />
            {{ unreadSummary }}
          </span>
          <span class="meta-pill">
            <ScopeIcon name="mail" />
            {{ totalSummary }}
          </span>
          <span class="meta-pill" :class="{ 'is-alert': Boolean(notificationsStore.connectionError) }">
            <ScopeIcon :name="realtimeIcon" />
            {{ realtimeStatusLabel }}
          </span>
        </template>

        <template #actions>
          <button
            type="button"
            class="hero-action hero-action--primary"
            data-test="notifications-enable-push"
            :disabled="pushBusy"
            @click="enablePush"
          >
            <ScopeIcon name="bell" />
            <span>{{ pushBusy ? 'Enabling...' : 'Enable push' }}</span>
          </button>
          <button
            type="button"
            class="hero-action"
            data-test="notifications-mark-all-read"
            :disabled="!notificationsStore.unreadCount"
            @click="void runNotificationAction(notificationsStore.markAllRead())"
          >
            <ScopeIcon name="mail" />
            <span>Mark all read</span>
          </button>
        </template>
      </PageHero>

      <section class="notifications-command-bar" aria-label="Notification filters">
        <div class="command-bar__filters">
          <span class="command-bar__label">
            <ScopeIcon name="filter" />
            Filter
          </span>
          <div class="filter-row">
            <button
              v-for="category in categoryOptions"
              :key="category.id"
              type="button"
              class="filter-chip"
              :class="{ 'is-active': selectedCategory === category.id }"
              :data-test="`notifications-filter-${category.id}`"
              @click="selectedCategory = category.id"
            >
              <span>{{ category.label }}</span>
              <span class="filter-chip__count">{{ category.count }}</span>
            </button>
          </div>
        </div>

        <label class="switch-control" data-test="notifications-unread-toggle">
          <input v-model="unreadOnly" type="checkbox" />
          <span class="switch-control__track" aria-hidden="true" />
          <span>Unread only</span>
        </label>
      </section>

      <div class="notifications-workspace">
        <section class="notification-list" aria-label="Notification inbox">
          <header class="panel-heading">
            <div>
              <p class="eyebrow">Inbox</p>
              <h2>Recent activity</h2>
            </div>
            <span class="panel-heading__meta">{{ visibleSummary }}</span>
          </header>

          <p v-if="notificationsStore.connectionError" class="state-banner" role="alert">
            {{ notificationsStore.connectionError }}
          </p>
          <p v-else-if="notificationsStore.error" class="state-banner" role="alert">
            {{ notificationsStore.error }}
          </p>
          <div v-else-if="notificationsStore.loading && !notificationsStore.items.length" class="notification-skeleton-stack" role="status" aria-live="polite" aria-label="Loading notifications">
            <article v-for="index in 4" :key="`notification-skeleton-${index}`" class="notification-skeleton">
              <span class="notification-skeleton__icon" />
              <span class="notification-skeleton__copy" />
              <span class="notification-skeleton__meta" />
            </article>
          </div>
          <div
            v-else-if="!visibleNotifications.length"
            class="notifications-empty-state"
            data-test="notifications-empty-state"
          >
            <div class="notifications-empty-state__copy">
              <span class="empty-state-icon">
                <ScopeIcon name="bell" />
              </span>
              <p class="eyebrow">{{ emptyStateEyebrow }}</p>
              <h2>{{ emptyStateTitle }}</h2>
              <p>{{ emptyStateDescription }}</p>
              <button
                v-if="hasActiveFilters"
                type="button"
                class="hero-action hero-action--primary"
                data-test="notifications-clear-filters"
                @click="clearFilters"
              >
                <ScopeIcon name="reset" />
                <span>Clear filters</span>
              </button>
            </div>

            <div v-if="!hasActiveFilters" class="coverage-preview" aria-label="Notification coverage preview">
              <article
                v-for="preview in notificationCoveragePreview"
                :key="preview.id"
                class="coverage-preview__item"
                :class="`coverage-preview__item--${preview.category}`"
              >
                <span class="coverage-preview__icon">
                  <ScopeIcon :name="preview.icon" />
                </span>
                <span>
                  <strong>{{ preview.title }}</strong>
                  <span>{{ preview.body }}</span>
                </span>
              </article>
            </div>
          </div>

          <template v-else>
            <article
              v-for="notification in visibleNotifications"
              :key="notification.id"
              class="notification-card"
              :class="[
                `notification-card--${resolveNotificationCategory(notification)}`,
                { 'is-unread': !notification.isRead },
              ]"
              :data-test="`notifications-row-${notification.id}`"
            >
              <span class="notification-card__icon" aria-hidden="true">
                <ScopeIcon :name="getNotificationIcon(notification)" />
              </span>
              <button type="button" class="notification-card__main" @click="void openNotification(notification)">
                <span class="notification-card__topline">
                  <span class="notification-card__category">{{ formatCategory(resolveNotificationCategory(notification)) }}</span>
                  <span class="notification-card__time">{{ formatDate(notification.createdAt) }}</span>
                </span>
                <strong>{{ notification.title }}</strong>
                <span>{{ notification.body }}</span>
              </button>
              <div class="notification-card__actions">
                <span v-if="!notification.isRead" class="unread-dot">Unread</span>
                <button v-if="!notification.isRead" type="button" class="text-button" @click="void runNotificationAction(notificationsStore.markRead(notification.id))">
                  Mark read
                </button>
                <button v-if="notification.actionUrl" type="button" class="text-button text-button--primary" @click="void openNotification(notification)">
                  Open
                </button>
                <button v-if="isFriendRequest(notification)" type="button" class="text-button text-button--primary" @click="void runNotificationAction(notificationsStore.performAction(notification.id, 'accept_friend_request'))">
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
          <header class="preferences-panel__heading">
            <div>
              <p class="eyebrow">Preferences</p>
              <h2>Delivery controls</h2>
            </div>
            <p>{{ preferenceSummary }}</p>
          </header>

          <div class="delivery-meter" aria-label="Enabled delivery channels">
            <span>
              <strong>{{ enabledInAppCount }}</strong>
              In-app
            </span>
            <span>
              <strong>{{ enabledPushCount }}</strong>
              Push
            </span>
            <span>
              <strong>{{ enabledEmailCount }}</strong>
              Email
            </span>
          </div>

          <p v-if="preferencesLoading" class="state-banner" role="status">Loading preferences...</p>
          <p v-else-if="preferencesError" class="state-banner" role="alert">{{ preferencesError }}</p>
          <div v-else class="preference-stack">
            <article v-for="preference in preferences" :key="preference.category" class="preference-row">
              <div class="preference-row__copy">
                <strong>{{ formatCategory(preference.category) }}</strong>
                <span>{{ formatPreferenceCadence(preference) }}</span>
                <small>{{ formatQuietHours(preference) }}</small>
              </div>
              <div class="preference-row__toggles">
                <button
                  type="button"
                  class="mini-toggle"
                  :class="{ 'is-active': preference.inAppEnabled }"
                  :aria-pressed="String(preference.inAppEnabled)"
                  @click="void savePreference(preference, { inAppEnabled: !preference.inAppEnabled })"
                >
                  In-app
                </button>
                <button
                  type="button"
                  class="mini-toggle"
                  :class="{ 'is-active': preference.pushEnabled }"
                  :aria-pressed="String(preference.pushEnabled)"
                  @click="void savePreference(preference, { pushEnabled: !preference.pushEnabled })"
                >
                  Push
                </button>
                <button
                  type="button"
                  class="mini-toggle"
                  :class="{ 'is-active': preference.emailEnabled }"
                  :aria-pressed="String(preference.emailEnabled)"
                  @click="void savePreference(preference, { emailEnabled: !preference.emailEnabled })"
                >
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
import ScopeIcon from '@/components/common/ScopeIcon.vue';
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

interface CategoryOption {
  id: string;
  label: string;
  count: number;
}

interface CoveragePreviewItem {
  id: string;
  category: string;
  icon: string;
  title: string;
  body: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  account: 'Account',
  all: 'All',
  comment: 'Comments',
  digest: 'Digests',
  friend: 'Friends',
  general: 'General',
  mention: 'Mentions',
  route: 'Routes',
  security: 'Security',
  social: 'Social',
  spot: 'Spots',
  system: 'System',
  trip: 'Trips',
  weather: 'Weather',
};

const CATEGORY_ICONS: Record<string, string> = {
  account: 'user',
  comment: 'message-circle',
  digest: 'mail',
  friend: 'friends',
  general: 'bell',
  mention: 'message-circle',
  route: 'route',
  security: 'lock',
  social: 'heart',
  spot: 'pin',
  system: 'settings',
  trip: 'calendar',
  weather: 'weather',
};

const CATEGORY_ORDER = [
  'all',
  'trip',
  'friend',
  'social',
  'comment',
  'mention',
  'spot',
  'route',
  'weather',
  'account',
  'security',
  'system',
  'digest',
  'general',
];

const notificationCoveragePreview: CoveragePreviewItem[] = [
  {
    id: 'preview-trip',
    category: 'trip',
    icon: 'calendar',
    title: 'Trip invite',
    body: 'A collaborator adds you to a live route.',
  },
  {
    id: 'preview-friend',
    category: 'friend',
    icon: 'friends',
    title: 'Friend request',
    body: 'A traveler wants to plan together.',
  },
  {
    id: 'preview-comment',
    category: 'comment',
    icon: 'message-circle',
    title: 'Comment mention',
    body: 'A note needs your reply on a spot.',
  },
  {
    id: 'preview-account',
    category: 'security',
    icon: 'lock',
    title: 'Account alert',
    body: 'Security and delivery changes stay visible.',
  },
];

const notificationsStore = useNotificationsStore();
const toastStore = useToastStore();
const router = useRouter();
const selectedCategory = ref('all');
const unreadOnly = ref(false);
const preferences = ref<NotificationPreference[]>([]);
const preferencesLoading = ref(false);
const preferencesError = ref('');
const pushBusy = ref(false);

const unreadSummary = computed(() => `${notificationsStore.unreadCount} unread`);
const totalSummary = computed(() => `${notificationsStore.items.length} total`);
const hasActiveFilters = computed(() => selectedCategory.value !== 'all' || unreadOnly.value);
const unreadItemCount = computed(() => notificationsStore.items.filter((notification) => !notification.isRead).length);
const enabledInAppCount = computed(() => preferences.value.filter((preference) => preference.inAppEnabled).length);
const enabledPushCount = computed(() => preferences.value.filter((preference) => preference.pushEnabled).length);
const enabledEmailCount = computed(() => preferences.value.filter((preference) => preference.emailEnabled).length);
const preferenceSummary = computed(() => {
  if (preferencesLoading.value) {
    return 'Syncing delivery state';
  }

  if (!preferences.value.length) {
    return 'No channel preferences yet';
  }

  return `${preferences.value.length} categories configured`;
});
const realtimeIcon = computed(() => (notificationsStore.connectionError ? 'cloud-lightning' : 'bell'));
const realtimeStatusLabel = computed(() => {
  if (notificationsStore.connectionError) {
    return 'Realtime paused';
  }

  switch (notificationsStore.connectionState) {
    case 'connected':
      return 'Realtime connected';
    case 'connecting':
      return 'Realtime connecting';
    case 'reconnecting':
      return 'Realtime reconnecting';
    case 'disconnected':
      return 'Realtime offline';
    case 'error':
      return 'Realtime paused';
    default:
      return 'Realtime ready';
  }
});

const categoryCounts = computed(() => {
  const counts = new Map<string, number>();
  notificationsStore.items.forEach((notification) => {
    const category = resolveNotificationCategory(notification);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  });
  return counts;
});

const categoryOptions = computed<CategoryOption[]>(() => {
  const options: CategoryOption[] = [
    {
      id: 'all',
      label: formatCategory('all'),
      count: notificationsStore.items.length,
    },
  ];

  categoryCounts.value.forEach((count, category) => {
    options.push({
      id: category,
      label: formatCategory(category),
      count,
    });
  });

  return options.sort((left, right) => getCategorySortIndex(left.id) - getCategorySortIndex(right.id));
});

const visibleNotifications = computed(() =>
  notificationsStore.items.filter((notification) => {
    if (selectedCategory.value !== 'all' && resolveNotificationCategory(notification) !== selectedCategory.value) {
      return false;
    }
    if (unreadOnly.value && notification.isRead) {
      return false;
    }
    return true;
  }),
);

const visibleSummary = computed(() => {
  if (notificationsStore.loading && !notificationsStore.items.length) {
    return 'Loading';
  }

  if (!notificationsStore.items.length) {
    return 'Inbox clear';
  }

  if (visibleNotifications.value.length === notificationsStore.items.length) {
    return `${visibleNotifications.value.length} visible`;
  }

  return `${visibleNotifications.value.length} of ${notificationsStore.items.length} visible`;
});

const emptyStateEyebrow = computed(() => (hasActiveFilters.value ? 'Filtered view' : 'Inbox'));
const emptyStateTitle = computed(() => {
  if (hasActiveFilters.value) {
    return 'No notifications match';
  }

  return unreadOnly.value && unreadItemCount.value === 0 ? 'Everything is read' : 'Inbox is clear';
});
const emptyStateDescription = computed(() => {
  if (hasActiveFilters.value) {
    return 'Try another category or include read notifications to widen the inbox.';
  }

  return 'New Scope updates will land here with the same actions, routing, and delivery controls shown below.';
});

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
    if (result.ok) {
      toastStore.showSuccess({
        title: 'Push enabled',
        message: result.message,
      });
      return;
    }

    toastStore.showError({
      title: 'Push not enabled',
      message: result.message,
    });
  } finally {
    pushBusy.value = false;
  }
}

function clearFilters(): void {
  selectedCategory.value = 'all';
  unreadOnly.value = false;
}

function isFriendRequest(notification: NotificationItem): boolean {
  const type = normalizeCategoryId(notification.type);
  const templateKey = normalizeCategoryId(notification.templateKey);
  return type.startsWith('friend-request') || templateKey.startsWith('friend-request');
}

function normalizeCategoryId(value: string | null | undefined): string {
  const category = String(value ?? '')
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[._\s]+/g, '-')
    .replace(/[^a-z0-9-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return normalizeCategoryAlias(category);
}

function normalizeCategoryAlias(category: string): string {
  switch (category) {
    case 'friends':
      return 'friend';
    case 'trips':
      return 'trip';
    case 'comments':
      return 'comment';
    case 'mentions':
      return 'mention';
    case 'routes':
      return 'route';
    case 'spots':
      return 'spot';
    case 'systems':
      return 'system';
    default:
      return category;
  }
}

function resolveNotificationCategory(notification: NotificationItem): string {
  const explicitCategory = normalizeCategoryId(notification.category);
  if (explicitCategory && explicitCategory !== 'general') {
    return explicitCategory;
  }

  const type = normalizeCategoryId(notification.type);
  if (!type) {
    return 'general';
  }

  if (type.startsWith('trip')) {
    return 'trip';
  }
  if (type.startsWith('friend')) {
    return 'friend';
  }
  if (type.startsWith('spot') || type.includes('review') || type.includes('liked')) {
    return 'social';
  }
  if (type.startsWith('comment')) {
    return 'comment';
  }
  if (type.startsWith('mention')) {
    return 'mention';
  }
  if (type.startsWith('intel-route') || type.includes('route')) {
    return 'route';
  }
  if (type.includes('weather')) {
    return 'weather';
  }
  if (type.startsWith('security')) {
    return 'security';
  }
  if (type.startsWith('account') || type.startsWith('profile')) {
    return 'account';
  }
  if (type.startsWith('system')) {
    return 'system';
  }

  return 'general';
}

function getCategorySortIndex(category: string): number {
  const index = CATEGORY_ORDER.indexOf(category);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

function getNotificationIcon(notification: NotificationItem): string {
  return CATEGORY_ICONS[resolveNotificationCategory(notification)] ?? 'bell';
}

function formatCategory(value: string): string {
  const category = normalizeCategoryId(value) || 'general';
  if (CATEGORY_LABELS[category]) {
    return CATEGORY_LABELS[category];
  }

  return category
    .replace(/-+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatPreferenceCadence(preference: NotificationPreference): string {
  const cadence = normalizeCategoryId(preference.digestCadence);
  if (cadence === 'instant') {
    return 'Instant delivery';
  }
  if (cadence === 'off') {
    return 'Digest off';
  }
  return `${formatCategory(cadence)} cadence`;
}

function formatQuietHours(preference: NotificationPreference): string {
  if (
    typeof preference.quietHoursStartMinutes !== 'number' ||
    typeof preference.quietHoursEndMinutes !== 'number'
  ) {
    return 'No quiet hours';
  }

  return `Quiet ${formatMinutes(preference.quietHoursStartMinutes)}-${formatMinutes(preference.quietHoursEndMinutes)}`;
}

function formatMinutes(minutes: number): string {
  const normalizedMinutes = Math.max(0, Math.min(1439, Math.floor(minutes)));
  const hours = Math.floor(normalizedMinutes / 60);
  const minute = normalizedMinutes % 60;
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(2026, 0, 1, hours, minute));
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

.meta-pill,
.hero-action,
.filter-chip,
.switch-control,
.text-button,
.mini-toggle {
  min-height: 2.5rem;
}

.meta-pill,
.hero-action,
.filter-chip,
.text-button,
.mini-toggle,
.delivery-meter span,
.unread-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.meta-pill {
  gap: var(--space-2);
  padding: 0.55rem 0.85rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-tertiary) 72%, var(--bg-secondary));
  color: var(--text-secondary);
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, transparent);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.meta-pill :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
}

.meta-pill--accent {
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--bg-secondary));
  color: var(--accent-teal);
  border-color: color-mix(in srgb, var(--accent-teal) 38%, var(--glass-border));
}

.meta-pill.is-alert {
  background: color-mix(in srgb, var(--danger) 12%, var(--bg-secondary));
  color: color-mix(in srgb, var(--danger) 72%, var(--text-primary));
  border-color: color-mix(in srgb, var(--danger) 34%, var(--glass-border));
}

.hero-action {
  gap: var(--space-2);
  padding: 0.7rem 0.95rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, transparent);
  background: color-mix(in srgb, var(--bg-tertiary) 74%, var(--bg-secondary));
  color: var(--text-primary);
  cursor: pointer;
  font-weight: var(--font-weight-semibold);
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.hero-action:hover:not(:disabled),
.hero-action:focus-visible:not(:disabled),
.filter-chip:hover,
.filter-chip:focus-visible,
.text-button:hover,
.text-button:focus-visible,
.mini-toggle:hover,
.mini-toggle:focus-visible {
  border-color: color-mix(in srgb, var(--accent-teal) 42%, var(--glass-border));
  outline: none;
}

.hero-action:hover:not(:disabled),
.hero-action:focus-visible:not(:disabled) {
  transform: translateY(var(--motion-button-lift));
}

.hero-action--primary {
  border-color: var(--accent-teal);
  background: var(--accent-teal);
  color: var(--text-inverse);
}

.hero-action:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.notifications-command-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4);
  border-block: 1px solid color-mix(in srgb, var(--glass-border) 72%, transparent);
  background: color-mix(in srgb, var(--bg-secondary) 72%, transparent);
}

.command-bar__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.command-bar__label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.filter-row,
.notification-card__actions,
.preference-row__toggles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.filter-chip {
  gap: var(--space-2);
  padding: 0.55rem 0.7rem 0.55rem 0.85rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-tertiary) 70%, var(--bg-secondary));
  color: var(--text-secondary);
  cursor: pointer;
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.filter-chip.is-active {
  border-color: color-mix(in srgb, var(--accent-teal) 48%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 18%, var(--bg-secondary));
  color: var(--text-primary);
}

.filter-chip__count {
  min-width: 1.45rem;
  height: 1.45rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--text-primary) 8%, transparent);
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
}

.filter-chip.is-active .filter-chip__count {
  background: color-mix(in srgb, var(--accent-teal) 30%, var(--bg-secondary));
  color: var(--text-primary);
}

.switch-control {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0.35rem 0.55rem 0.35rem 0.35rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, transparent);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.switch-control input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.switch-control__track {
  position: relative;
  width: 2.55rem;
  height: 1.45rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-tertiary) 86%, var(--bg-secondary));
  border: 1px solid color-mix(in srgb, var(--glass-border) 90%, transparent);
}

.switch-control__track::after {
  content: '';
  position: absolute;
  top: 0.18rem;
  left: 0.18rem;
  width: 0.95rem;
  height: 0.95rem;
  border-radius: var(--radius-full);
  background: var(--text-secondary);
  transition:
    transform var(--transition-fast),
    background var(--transition-fast);
}

.switch-control input:checked + .switch-control__track {
  background: color-mix(in srgb, var(--accent-teal) 32%, var(--bg-secondary));
  border-color: color-mix(in srgb, var(--accent-teal) 48%, var(--glass-border));
}

.switch-control input:checked + .switch-control__track::after {
  transform: translateX(1.1rem);
  background: var(--accent-teal);
}

.switch-control:focus-within {
  outline: 2px solid var(--input-focus);
  outline-offset: 3px;
}

.notifications-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(20rem, 25rem);
  gap: var(--space-5);
  align-items: start;
}

.notification-list,
.preferences-panel,
.preference-stack,
.preferences-panel__heading,
.panel-heading,
.notifications-empty-state,
.notifications-empty-state__copy,
.coverage-preview,
.notification-skeleton-stack {
  display: grid;
}

.notification-list {
  gap: var(--space-3);
  min-width: 0;
}

.panel-heading,
.preferences-panel__heading {
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: end;
  gap: var(--space-4);
}

.panel-heading h2,
.panel-heading p,
.preferences-panel__heading h2,
.preferences-panel__heading p,
.notification-card__main strong,
.notification-card__main span,
.preference-row strong,
.preference-row span,
.preference-row small,
.state-banner,
.notifications-empty-state h2,
.notifications-empty-state p,
.coverage-preview__item strong,
.coverage-preview__item span {
  margin: 0;
}

.panel-heading h2,
.preferences-panel__heading h2 {
  color: var(--text-primary);
  font-size: var(--font-size-h2);
  line-height: var(--line-height-tight);
  letter-spacing: 0;
}

.panel-heading__meta,
.preferences-panel__heading p,
.state-banner,
.notification-card__main span:not(.notification-card__category),
.notification-card__time,
.preference-row span,
.preference-row small,
.notifications-empty-state p:not(.eyebrow),
.coverage-preview__item span {
  color: var(--text-secondary);
}

.panel-heading__meta {
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.state-banner {
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, transparent);
  background: color-mix(in srgb, var(--bg-secondary) 76%, transparent);
}

.notification-skeleton-stack {
  gap: var(--space-3);
}

.notification-skeleton {
  display: grid;
  grid-template-columns: 2.65rem minmax(0, 1fr) 5.5rem;
  gap: var(--space-4);
  min-height: 7.5rem;
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--glass-border) 72%, transparent);
  background: color-mix(in srgb, var(--bg-secondary) 84%, transparent);
}

.notification-skeleton__icon,
.notification-skeleton__copy,
.notification-skeleton__meta {
  border-radius: var(--radius-full);
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--bg-tertiary) 70%, transparent),
    color-mix(in srgb, var(--text-primary) 9%, transparent),
    color-mix(in srgb, var(--bg-tertiary) 70%, transparent)
  );
}

.notification-skeleton__icon {
  width: 2.65rem;
  height: 2.65rem;
}

.notification-skeleton__copy {
  height: 4.8rem;
}

.notification-skeleton__meta {
  height: 1rem;
}

.notifications-empty-state {
  grid-template-columns: minmax(0, 0.95fr) minmax(18rem, 1fr);
  gap: var(--space-5);
  min-height: clamp(24rem, 44vh, 34rem);
  align-items: stretch;
  padding: clamp(var(--space-4), 3vw, var(--space-6));
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--glass-border) 74%, transparent);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--bg-secondary) 92%, transparent), color-mix(in srgb, var(--bg-tertiary) 38%, var(--bg-primary))),
    color-mix(in srgb, var(--bg-secondary) 82%, transparent);
}

.notifications-empty-state__copy {
  align-content: center;
  justify-items: start;
  gap: var(--space-3);
}

.empty-state-icon,
.notification-card__icon,
.coverage-preview__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
}

.empty-state-icon {
  width: 3rem;
  height: 3rem;
  background: color-mix(in srgb, var(--accent-teal) 18%, var(--bg-secondary));
  color: var(--accent-teal);
}

.notifications-empty-state h2 {
  max-width: 28rem;
  color: var(--text-primary);
  font-size: clamp(1.35rem, 2vw, 1.85rem);
  line-height: var(--line-height-tight);
  letter-spacing: 0;
}

.notifications-empty-state p:not(.eyebrow) {
  max-width: 34rem;
  line-height: var(--line-height-relaxed);
}

.coverage-preview {
  align-content: center;
  gap: var(--space-3);
}

.coverage-preview__item {
  display: grid;
  grid-template-columns: 2.4rem minmax(0, 1fr);
  align-items: start;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--glass-border) 72%, transparent);
  background: color-mix(in srgb, var(--bg-primary) 30%, var(--bg-secondary));
}

.coverage-preview__icon {
  width: 2.4rem;
  height: 2.4rem;
  color: var(--accent-teal);
  background: color-mix(in srgb, var(--accent-teal) 14%, var(--bg-secondary));
}

.coverage-preview__item strong,
.coverage-preview__item span {
  display: block;
}

.coverage-preview__item strong {
  color: var(--text-primary);
  font-size: var(--font-size-small);
}

.coverage-preview__item span {
  line-height: var(--line-height-normal);
}

.coverage-preview__item--friend .coverage-preview__icon,
.notification-card--friend .notification-card__icon {
  color: var(--info);
  background: color-mix(in srgb, var(--info) 18%, var(--bg-secondary));
}

.coverage-preview__item--comment .coverage-preview__icon,
.notification-card--comment .notification-card__icon,
.notification-card--mention .notification-card__icon {
  color: var(--accent-gold);
  background: color-mix(in srgb, var(--accent-gold) 18%, var(--bg-secondary));
}

.coverage-preview__item--security .coverage-preview__icon,
.notification-card--security .notification-card__icon,
.notification-card--account .notification-card__icon {
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 18%, var(--bg-secondary));
}

.notification-card--social .notification-card__icon,
.notification-card--spot .notification-card__icon {
  color: var(--accent-gold);
  background: color-mix(in srgb, var(--accent-gold) 16%, var(--bg-secondary));
}

.notification-card--route .notification-card__icon,
.notification-card--weather .notification-card__icon {
  color: var(--info);
  background: color-mix(in srgb, var(--info) 16%, var(--bg-secondary));
}

.notification-card {
  display: grid;
  grid-template-columns: 2.75rem minmax(0, 1fr);
  grid-template-areas:
    "icon main"
    "icon actions";
  gap: var(--space-3) var(--space-4);
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--glass-border) 76%, transparent);
  background: color-mix(in srgb, var(--bg-secondary) 86%, transparent);
  box-shadow: var(--shadow-sm);
}

.notification-card.is-unread {
  border-color: color-mix(in srgb, var(--accent-teal) 42%, var(--glass-border));
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--accent-teal) 10%, transparent), transparent 38%),
    color-mix(in srgb, var(--bg-secondary) 90%, transparent);
}

.notification-card__icon {
  grid-area: icon;
  width: 2.75rem;
  height: 2.75rem;
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--bg-secondary));
  color: var(--accent-teal);
}

.notification-card__main {
  grid-area: main;
  display: grid;
  gap: var(--space-2);
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.notification-card__main:focus-visible,
.text-button:focus-visible,
.mini-toggle:focus-visible {
  outline: 2px solid var(--input-focus);
  outline-offset: 3px;
}

.notification-card__topline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.notification-card__category,
.eyebrow {
  color: var(--accent-teal);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-eyebrow);
  text-transform: uppercase;
}

.notification-card__time {
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0;
  text-transform: none;
}

.notification-card__main strong {
  color: var(--text-primary);
  line-height: var(--line-height-tight);
  overflow-wrap: anywhere;
}

.notification-card__main span:not(.notification-card__category, .notification-card__time) {
  line-height: var(--line-height-normal);
  overflow-wrap: anywhere;
}

.notification-card__actions {
  grid-area: actions;
  align-items: center;
}

.unread-dot {
  gap: var(--space-1);
  min-height: 2rem;
  padding: 0 0.65rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 14%, var(--bg-secondary));
  color: var(--accent-teal);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
}

.text-button,
.mini-toggle {
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-tertiary) 70%, var(--bg-secondary));
  color: var(--text-primary);
  cursor: pointer;
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  padding: 0.45rem 0.7rem;
}

.text-button--primary,
.mini-toggle.is-active {
  border-color: var(--accent-teal);
  background: var(--accent-teal);
  color: var(--text-inverse);
}

.preferences-panel {
  position: sticky;
  top: calc(var(--shell-content-top) + var(--space-3));
  gap: var(--space-4);
  padding: var(--space-5);
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, transparent);
  background: color-mix(in srgb, var(--bg-secondary) 88%, transparent);
}

.preferences-panel__heading {
  align-items: start;
}

.preferences-panel__heading p {
  max-width: 10rem;
  text-align: right;
  font-size: var(--font-size-small);
  line-height: var(--line-height-normal);
}

.delivery-meter {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
}

.delivery-meter span {
  flex-direction: column;
  gap: var(--space-1);
  min-height: 4.1rem;
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--glass-border) 72%, transparent);
  background: color-mix(in srgb, var(--bg-tertiary) 52%, transparent);
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
}

.delivery-meter strong {
  color: var(--text-primary);
  font-size: var(--font-size-h3);
  line-height: var(--line-height-tight);
}

.preference-stack {
  gap: var(--space-3);
}

.preference-row {
  display: grid;
  gap: var(--space-3);
  padding-block: var(--space-3);
  border-block-start: 1px solid color-mix(in srgb, var(--glass-border) 72%, transparent);
}

.preference-row:first-child {
  border-block-start: 0;
  padding-block-start: 0;
}

.preference-row__copy {
  display: grid;
  gap: var(--space-1);
}

.preference-row strong {
  color: var(--text-primary);
}

.preference-row small {
  font-size: var(--font-size-caption);
}

@media (max-width: 1080px) {
  .notifications-workspace,
  .notifications-empty-state {
    grid-template-columns: 1fr;
  }

  .preferences-panel {
    position: static;
  }
}

@media (max-width: 720px) {
  .notifications-command-bar,
  .command-bar__filters,
  .filter-row,
  .switch-control,
  .hero-action {
    width: 100%;
  }

  .hero-action,
  .filter-chip {
    justify-content: center;
  }

  .panel-heading,
  .preferences-panel__heading {
    grid-template-columns: 1fr;
  }

  .preferences-panel__heading p {
    max-width: none;
    text-align: left;
  }

  .notification-card {
    grid-template-columns: 1fr;
    grid-template-areas:
      "icon"
      "main"
      "actions";
  }

  .notification-skeleton {
    grid-template-columns: 2.65rem minmax(0, 1fr);
  }

  .notification-skeleton__meta {
    display: none;
  }

  .delivery-meter {
    grid-template-columns: 1fr;
  }
}
</style>
