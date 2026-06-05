<template>
  <AppShell>
    <div class="page-container page-stack trips-workspace">
      <header class="workspace-hero">
        <div class="workspace-hero__copy">
          <p class="eyebrow">Trips</p>
          <h1>Trip workspace</h1>
          <p>Drafts, shared plans, and upcoming trips ready to open or polish.</p>
        </div>

        <div class="workspace-hero__actions">
          <RouterLink class="primary-action" to="/trips/new">
            <ScopeIcon name="plus" label="New trip" />
            <span>New trip</span>
          </RouterLink>
        </div>
      </header>

      <section class="workspace-metrics" aria-label="Trip workspace summary">
        <button
          v-for="view in workspaceViews"
          :key="view.id"
          type="button"
          class="metric-card"
          :class="{ 'metric-card--active': activeWorkspaceView === view.id }"
          :aria-pressed="activeWorkspaceView === view.id"
          @click="activeWorkspaceView = view.id"
        >
          <span class="metric-card__meta">
            <ScopeIcon :name="view.icon" aria-hidden="true" />
            <span>{{ view.label }}</span>
          </span>
          <strong>{{ view.count }}</strong>
        </button>
      </section>

      <section class="workspace-section" :class="{ 'workspace-section--empty': !activeWorkspaceTrips.length }">
        <div v-if="activeWorkspaceTrips.length" class="section-heading">
          <div>
            <p class="eyebrow">{{ activeWorkspaceMeta.eyebrow }}</p>
            <h2>{{ activeWorkspaceMeta.title }}</h2>
          </div>
          <span v-if="activeWorkspaceTrips.length" class="section-pill">{{ activeWorkspaceMeta.pill }}</span>
        </div>

        <div v-if="activeWorkspaceTrips.length" class="trip-document-stack">
          <article v-for="trip in activeWorkspaceTrips" :key="trip.id" class="trip-document glass-panel">
            <div class="document-copy">
              <h3>{{ trip.title }}</h3>
              <p>{{ trip.destination }}</p>
              <div class="document-meta" aria-label="Trip details">
                <span>
                  <ScopeIcon name="calendar" aria-hidden="true" />
                  {{ formatTripWindow(trip) }}
                </span>
                <span>
                  <ScopeIcon name="route" aria-hidden="true" />
                  {{ tripStopLabel(trip) }}
                </span>
                <span>
                  <ScopeIcon name="globe" aria-hidden="true" />
                  {{ tripAccessLabel(trip) }}
                </span>
              </div>
            </div>

            <div class="document-side">
              <div v-if="activeWorkspaceView !== 'drafts'" class="document-crew">
                <Avatar
                  v-for="member in trip.members.slice(0, 3)"
                  :key="member.id"
                  :name="member.displayName"
                  :src="member.avatarUrl"
                  :size="34"
                />
              </div>
              <small v-if="activeWorkspaceView !== 'drafts'">{{ tripMemberLabel(trip) }}</small>
              <RouterLink class="document-action" :to="`/trips/${trip.id}/edit`">
                <span>{{ activeWorkspaceView === 'drafts' ? 'Edit' : 'Open' }}</span>
                <ScopeIcon name="arrow-right" />
              </RouterLink>
              <button
                v-if="activeWorkspaceView === 'drafts'"
                type="button"
                class="document-action document-action--danger"
                data-test="delete-draft-trip"
                :disabled="deletingTripId === trip.id"
                @click="handleDeleteDraft(trip)"
              >
                <span>{{ deletingTripId === trip.id ? 'Deleting' : 'Delete' }}</span>
                <ScopeIcon name="close" />
              </button>
            </div>
          </article>
        </div>

        <div
          v-else
          class="workspace-empty-card"
          role="status"
          aria-live="polite"
        >
          <div class="workspace-empty-card__copy">
            <h3>{{ activeWorkspaceMeta.emptyTitle }}</h3>
            <p>{{ activeWorkspaceMeta.emptyDescription }}</p>
          </div>

          <RouterLink v-if="activeWorkspaceMeta.showAction" class="primary-action empty-action" to="/trips/new">
            <ScopeIcon name="plus" aria-hidden="true" />
            {{ activeWorkspaceMeta.actionLabel }}
          </RouterLink>
        </div>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import Avatar from '@/components/common/Avatar.vue';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toasts';
import { useTripsStore } from '@/stores/trips';
import type { Trip } from '@/types';
import { formatMonthDay } from '@/utils/formatters';

type WorkspaceView = 'drafts' | 'shared' | 'upcoming';

const tripsStore = useTripsStore();
const authStore = useAuthStore();
const toastStore = useToastStore();
const deletingTripId = ref('');
const activeWorkspaceView = ref<WorkspaceView>('drafts');

const currentUserId = computed(() => authStore.currentUser?.id ?? '');
const allTrips = computed(() => tripsStore.items);
const realWorkspaceTrips = computed(() => allTrips.value.filter((trip) => !isReferenceTrip(trip)));
const draftTrips = computed(() => realWorkspaceTrips.value.filter((trip) => (trip.status ?? 'planning') === 'planning' && !isSharedWithCurrentUser(trip)));
const sharedTrips = computed(() => realWorkspaceTrips.value.filter((trip) => isSharedWithCurrentUser(trip)));
const upcomingTrips = computed(() => realWorkspaceTrips.value.filter((trip) => isUpcomingTrip(trip)));

const workspaceViews = computed<Array<{ id: WorkspaceView; label: string; icon: string; count: number }>>(() => [
  { id: 'drafts', label: 'Drafts', icon: 'route', count: draftTrips.value.length },
  { id: 'shared', label: 'Shared', icon: 'friends', count: sharedTrips.value.length },
  { id: 'upcoming', label: 'Upcoming', icon: 'calendar', count: upcomingTrips.value.length },
]);

const activeWorkspaceTrips = computed(() => {
  if (activeWorkspaceView.value === 'shared') {
    return sharedTrips.value;
  }

  if (activeWorkspaceView.value === 'upcoming') {
    return upcomingTrips.value;
  }

  return draftTrips.value;
});

const activeWorkspaceMeta = computed(() => {
  if (activeWorkspaceView.value === 'shared') {
    return {
      eyebrow: 'Shared',
      title: 'Shared trip plans',
      pill: `${sharedTrips.value.length} shared`,
      emptyTitle: 'No shared trips yet',
      emptyDescription: 'Trips shared with you will appear here.',
      actionLabel: '',
      showAction: false,
    };
  }

  if (activeWorkspaceView.value === 'upcoming') {
    return {
      eyebrow: 'Upcoming',
      title: 'Upcoming trips',
      pill: `${upcomingTrips.value.length} upcoming`,
      emptyTitle: 'Nothing scheduled yet',
      emptyDescription: 'Trips with future dates will appear here.',
      actionLabel: 'Create trip',
      showAction: true,
    };
  }

  return {
    eyebrow: 'Drafts',
    title: 'Editable trip plans',
    pill: `${draftTrips.value.length} saved`,
    emptyTitle: 'No drafts yet',
    emptyDescription: 'Create a trip when you are ready to shape the route.',
    actionLabel: 'Create trip',
    showAction: true,
  };
});

function isReferenceTrip(trip: Trip): boolean {
  return /^trip-[123]$/.test(trip.id);
}

function firstPopulatedWorkspaceView(): WorkspaceView | null {
  if (draftTrips.value.length) {
    return 'drafts';
  }

  if (sharedTrips.value.length) {
    return 'shared';
  }

  if (upcomingTrips.value.length) {
    return 'upcoming';
  }

  return null;
}

function syncActiveWorkspaceViewWithTrips(): void {
  if (activeWorkspaceTrips.value.length) {
    return;
  }

  const populatedView = firstPopulatedWorkspaceView();
  if (populatedView) {
    activeWorkspaceView.value = populatedView;
  }
}

function isSharedWithCurrentUser(trip: Trip): boolean {
  if (!currentUserId.value) {
    return false;
  }

  const member = trip.members.find((entry) => entry.id === currentUserId.value);
  return Boolean(member && member.status !== 'owner');
}

function isUpcomingTrip(trip: Trip): boolean {
  return new Date(`${trip.endDate}T23:59:59`) >= new Date();
}

function formatTripWindow(trip: Trip): string {
  const start = formatMonthDay(trip.startDate);
  const end = formatMonthDay(trip.endDate);
  return start === end ? start : `${start} to ${end}`;
}

function tripStopLabel(trip: Trip): string {
  return `${trip.spots.length} route stop${trip.spots.length === 1 ? '' : 's'}`;
}

function tripMemberLabel(trip: Trip): string {
  return `${trip.members.length} traveler${trip.members.length === 1 ? '' : 's'}`;
}

function tripAccessLabel(trip: Trip): string {
  if (isSharedWithCurrentUser(trip)) {
    return 'Shared';
  }

  return trip.isPublic ? 'Public' : 'Private';
}

async function handleDeleteDraft(trip: Trip): Promise<void> {
  if (deletingTripId.value) {
    return;
  }

  deletingTripId.value = trip.id;
  try {
    await tripsStore.deleteTrip(trip.id);
    toastStore.showSuccess({
      title: 'Draft deleted',
      message: `${trip.title || 'Trip draft'} was removed from your workspace.`,
    });
  } catch {
    toastStore.showError({
      title: 'Draft delete failed',
      message: tripsStore.error ?? 'Scope could not delete that trip draft right now.',
    });
  } finally {
    deletingTripId.value = '';
  }
}

onMounted(async () => {
  try {
    await tripsStore.fetchTrips();
    syncActiveWorkspaceViewWithTrips();
  } catch {
    // The workspace can still render local drafts or the store-level error.
  }
});

watch([draftTrips, sharedTrips, upcomingTrips], syncActiveWorkspaceViewWithTrips, { flush: 'post' });
</script>

<style scoped>
.trips-workspace {
  max-width: calc(1480px + (var(--shell-side-padding) * 2) + var(--safe-area-left) + var(--safe-area-right));
  gap: clamp(var(--space-5), 2.4vw, var(--space-8));
}

.workspace-hero,
.workspace-metrics,
.workspace-section,
.trip-document-stack {
  display: grid;
  gap: var(--space-4);
}

.workspace-hero {
  position: relative;
  overflow: hidden;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-5);
  min-height: 9rem;
  padding: clamp(var(--space-5), 3vw, var(--space-8));
  border: 1px solid color-mix(in srgb, var(--accent-teal) 22%, var(--glass-border));
  border-radius: var(--radius-2xl);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--bg-secondary) 94%, var(--accent-teal) 6%), color-mix(in srgb, var(--bg-primary) 92%, var(--bg-secondary))),
    linear-gradient(90deg, color-mix(in srgb, var(--accent-teal) 14%, transparent), transparent 48%),
    linear-gradient(270deg, color-mix(in srgb, var(--accent-gold) 12%, transparent), transparent 38%);
  box-shadow:
    var(--shadow-lg),
    inset 0 1px 0 color-mix(in srgb, white 7%, transparent);
}

.workspace-hero__copy {
  position: relative;
  z-index: 1;
  max-width: 42rem;
}

.workspace-hero__copy h1,
.workspace-hero__copy p,
.section-heading h2,
.document-copy h3,
.document-copy p,
.metric-card span,
.metric-card strong {
  margin: 0;
}

.workspace-hero__copy h1 {
  font-size: clamp(2.35rem, 4vw, 4.4rem);
  letter-spacing: 0;
  line-height: 0.95;
}

.workspace-hero__copy p:not(.eyebrow),
.document-copy p {
  color: var(--text-secondary);
  line-height: var(--line-height-normal);
}

.workspace-hero__copy p:not(.eyebrow) {
  max-width: 38rem;
  margin-top: var(--space-3);
  font-size: var(--font-size-body);
}

.primary-action,
.document-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border-radius: var(--radius-full);
  text-decoration: none;
  font-weight: var(--font-weight-semibold);
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
}

.primary-action {
  position: relative;
  z-index: 1;
  min-height: 3.2rem;
  padding: 0.9rem 1.3rem;
  color: var(--bg-primary);
  background: var(--accent-teal);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 70%, transparent);
  box-shadow: var(--shadow-md);
}

.workspace-metrics {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(var(--space-2), 1vw, var(--space-3));
}

.metric-card {
  appearance: none;
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  min-height: 4.35rem;
  padding: 0.9rem 1.15rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, transparent);
  border-radius: calc(var(--radius-xl) - 0.15rem);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--bg-secondary) 92%, transparent),
    color-mix(in srgb, var(--bg-primary) 94%, transparent)
  );
  color: var(--text-primary);
  font: inherit;
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 5%, transparent);
  cursor: pointer;
  text-align: left;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast),
    color var(--transition-fast);
}

.metric-card__meta {
  display: inline-flex;
  align-items: center;
  gap: 0.72rem;
  min-width: 0;
}

.metric-card :deep(.scope-icon) {
  width: 1.7rem;
  height: 1.7rem;
  padding: 0.4rem;
  border-radius: var(--radius-full);
  color: color-mix(in srgb, var(--text-secondary) 80%, var(--accent-teal));
  background: color-mix(in srgb, var(--bg-primary) 76%, var(--bg-secondary));
  border: 1px solid color-mix(in srgb, var(--glass-border) 86%, transparent);
}

.metric-card:hover,
.metric-card:focus-visible {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent-teal) 34%, var(--glass-border));
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--bg-secondary) 89%, var(--accent-teal) 4%),
    color-mix(in srgb, var(--bg-primary) 92%, var(--bg-secondary))
  );
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 6%, transparent),
    0 0 0 2px color-mix(in srgb, var(--accent-teal) 10%, transparent);
  outline: none;
}

.metric-card--active {
  border-color: color-mix(in srgb, var(--accent-teal) 58%, var(--glass-border));
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--bg-secondary) 84%, var(--accent-teal) 8%),
    color-mix(in srgb, var(--bg-primary) 92%, var(--bg-secondary))
  );
  box-shadow:
    inset 0 0 0 2px color-mix(in srgb, var(--accent-teal) 58%, transparent);
}

.metric-card--active :deep(.scope-icon) {
  color: var(--accent-teal);
  border-color: color-mix(in srgb, var(--accent-teal) 28%, transparent);
  background: color-mix(in srgb, var(--accent-teal) 10%, var(--bg-primary));
}

.metric-card span {
  color: color-mix(in srgb, var(--text-secondary) 82%, var(--text-primary));
  font-size: 0.84rem;
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
}

.metric-card strong {
  width: 2.3rem;
  justify-self: end;
  text-align: right;
  font-size: clamp(1.34rem, 1vw + 0.92rem, 1.72rem);
  line-height: var(--line-height-tight);
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.workspace-section {
  align-content: start;
  gap: clamp(var(--space-4), 1.8vw, var(--space-6));
}

.workspace-section--empty {
  justify-items: center;
  padding-top: clamp(var(--space-5), 2.6vw, var(--space-8));
}

.workspace-section--empty .section-heading {
  justify-content: center;
  width: min(100%, 44rem);
  margin-inline: auto;
  text-align: center;
}

.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.section-heading h2 {
  font-size: clamp(1.45rem, 1.2vw + 1rem, 2rem);
  line-height: var(--line-height-tight);
}

.section-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.3rem;
  padding: 0.5rem 0.85rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--glass-border);
  background: color-mix(in srgb, var(--glass-bg) 86%, transparent);
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.trip-document-stack {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 32rem), 1fr));
}

.trip-document {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: clamp(var(--space-4), 1.2vw, var(--space-5));
  align-items: center;
  min-height: 9.4rem;
  padding: clamp(var(--space-5), 1.2vw, var(--space-6));
  border-radius: var(--radius-xl);
  border-color: color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--bg-secondary) 92%, var(--accent-teal) 8%), color-mix(in srgb, var(--bg-primary) 92%, var(--bg-secondary))),
    linear-gradient(90deg, color-mix(in srgb, var(--accent-teal) 10%, transparent), transparent 52%);
  box-shadow: var(--shadow-lg);
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    background var(--transition-fast);
}

.trip-document::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 0.3rem;
  background: linear-gradient(180deg, var(--accent-teal), color-mix(in srgb, var(--accent-gold) 78%, var(--accent-teal)));
}

.trip-document:hover,
.trip-document:focus-within {
  transform: translateY(var(--motion-card-lift));
  border-color: color-mix(in srgb, var(--accent-teal) 42%, var(--glass-border));
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--bg-secondary) 84%, var(--accent-teal) 16%), color-mix(in srgb, var(--bg-primary) 90%, var(--bg-secondary))),
    linear-gradient(90deg, color-mix(in srgb, var(--accent-teal) 16%, transparent), transparent 50%);
  box-shadow: var(--shadow-lg);
}

.document-copy {
  min-width: 0;
  padding-left: 0.2rem;
}

.document-copy h3 {
  color: var(--text-primary);
  font-size: clamp(1.42rem, 1.15vw + 1rem, 1.92rem);
  line-height: 1.1;
  letter-spacing: -0.01em;
  overflow-wrap: normal;
  text-wrap: balance;
}

.document-copy > p {
  margin-top: 0.5rem;
  line-height: 1.45;
  max-width: 68ch;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.document-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: var(--space-4);
}

.document-meta span {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 1.8rem;
  padding: 0.3rem 0.54rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 86%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 34%, var(--glass-bg));
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: var(--font-weight-semibold);
}

.document-meta :deep(.scope-icon) {
  width: 0.9rem;
  height: 0.9rem;
  color: var(--accent-teal);
}

.document-side {
  display: grid;
  justify-items: end;
  gap: 0.55rem;
  align-content: center;
  min-width: 6.6rem;
}

.document-side small {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.document-crew {
  display: flex;
}

.document-crew :deep(.avatar + .avatar) {
  margin-left: -0.65rem;
}

.document-action {
  width: 100%;
  min-height: 2rem;
  padding: 0.42rem 0.78rem;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--accent-teal) 10%, var(--bg-secondary));
  border: 1px solid color-mix(in srgb, var(--accent-teal) 34%, var(--border));
  cursor: pointer;
  font-size: 0.8rem;
}

.document-action--danger {
  background: color-mix(in srgb, var(--danger) 9%, var(--bg-secondary));
  border-color: color-mix(in srgb, var(--danger) 38%, var(--border));
}

.primary-action:hover,
.primary-action:focus-visible,
.document-action:hover,
.document-action:focus-visible {
  transform: translateY(var(--motion-button-lift));
  border-color: var(--accent-teal);
  box-shadow:
    var(--shadow-md),
    0 0 0 3px color-mix(in srgb, var(--accent-teal) 22%, transparent);
  outline: none;
}

.primary-action:hover,
.primary-action:focus-visible {
  background: var(--accent-teal-hover);
}

.primary-action:active,
.document-action:active {
  transform: translateY(0) scale(var(--motion-press-scale));
}

.document-action--danger:hover,
.document-action--danger:focus-visible {
  border-color: color-mix(in srgb, var(--danger) 66%, var(--border));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 18%, transparent);
}

.document-action:disabled {
  cursor: wait;
  opacity: 0.68;
  transform: none;
}

.workspace-empty-card {
  position: relative;
  overflow: hidden;
  display: grid;
  align-content: center;
  align-items: center;
  justify-items: center;
  gap: clamp(var(--space-5), 2.4vw, var(--space-8));
  width: min(100%, 64rem);
  min-height: clamp(18.5rem, 30vw, 21rem);
  margin-inline: auto;
  padding: clamp(var(--space-6), 4vw, var(--space-10));
  border: 1px solid color-mix(in srgb, var(--accent-teal) 20%, var(--glass-border));
  border-radius: var(--radius-2xl);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 94%, transparent), color-mix(in srgb, var(--bg-primary) 91%, transparent)),
    linear-gradient(135deg, color-mix(in srgb, var(--accent-teal) 5%, transparent), transparent 62%);
  box-shadow:
    var(--shadow-lg),
    inset 0 1px 0 color-mix(in srgb, var(--text-primary) 7%, transparent);
  text-align: center;
}

.workspace-empty-card > * {
  position: relative;
  z-index: 1;
}

.workspace-empty-card__copy {
  display: grid;
  justify-items: center;
  gap: var(--space-3);
  max-width: 38rem;
}

.workspace-empty-card__copy h3,
.workspace-empty-card__copy p {
  margin: 0;
}

.workspace-empty-card__copy h3 {
  color: var(--text-primary);
  font-size: clamp(1.75rem, 0.8vw + 1.45rem, 2.15rem);
  line-height: var(--line-height-tight);
}

.workspace-empty-card__copy p {
  max-width: 34rem;
  color: var(--text-secondary);
  font-size: var(--font-size-body);
  line-height: var(--line-height-normal);
}

.empty-action {
  align-self: center;
  min-width: 9rem;
  min-height: 2.55rem;
  margin-top: 0;
  padding: 0.62rem 1rem;
  font-size: var(--font-size-small);
  box-shadow: none;
}

.empty-action:hover,
.empty-action:focus-visible {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-teal) 22%, transparent);
}

@media (max-width: 1080px) {
  .workspace-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .workspace-hero,
  .workspace-metrics,
  .section-heading,
  .trip-document {
    grid-template-columns: 1fr;
  }

  .workspace-hero__actions,
  .primary-action,
  .document-action {
    width: 100%;
  }

  .workspace-empty-card .empty-action {
    width: min(100%, 12rem);
  }

  .workspace-hero {
    min-height: auto;
  }

  .workspace-hero__copy h1 {
    font-size: clamp(2rem, 13vw, 3.2rem);
  }

  .section-heading {
    display: grid;
  }

  .document-side {
    justify-items: start;
  }

  .workspace-metrics {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .primary-action,
  .document-action,
  .trip-document {
    transition-duration: 1ms;
  }

  .primary-action:hover,
  .primary-action:focus-visible,
  .document-action:hover,
  .document-action:focus-visible,
  .trip-document:hover,
  .trip-document:focus-within {
    transform: none;
  }
}
</style>
