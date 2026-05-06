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
          <ScopeIcon :name="view.icon" aria-hidden="true" />
          <span>{{ view.label }}</span>
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
            <div class="document-visual" aria-hidden="true">
              <div class="document-icon">
                <ScopeIcon name="route" />
              </div>
              <span class="route-node route-node--start" />
              <span class="route-line" />
              <span class="route-node route-node--end" />
            </div>

            <div class="document-copy">
              <p class="eyebrow">{{ tripEyebrow(trip) }}</p>
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
                  {{ tripVisibilityLabel(trip) }}
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
import { computed, onMounted, ref } from 'vue';
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
  return /^(?:demo-)?trip-[123]$/.test(trip.id);
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
  return `${trip.spots.length} stop${trip.spots.length === 1 ? '' : 's'}`;
}

function tripMemberLabel(trip: Trip): string {
  return `${trip.members.length} traveler${trip.members.length === 1 ? '' : 's'}`;
}

function tripVisibilityLabel(trip: Trip): string {
  return trip.isPublic ? 'Public' : 'Private';
}

function tripEyebrow(trip: Trip): string {
  if (activeWorkspaceView.value === 'shared') {
    return 'Shared';
  }

  if (activeWorkspaceView.value === 'upcoming') {
    return trip.status === 'planning' ? 'Upcoming draft' : 'Upcoming';
  }

  return trip.status ?? 'Planning';
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
  } catch {
    // The workspace can still render local drafts or the store-level error.
  }
});
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
  box-shadow: var(--shadow-md), var(--shadow-glow-teal);
}

.workspace-metrics {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(var(--space-3), 1.4vw, var(--space-4));
}

.metric-card {
  appearance: none;
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  min-height: 5.9rem;
  padding: clamp(var(--space-4), 2vw, var(--space-5));
  border: 1px solid color-mix(in srgb, var(--accent-teal) 14%, var(--glass-border));
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--bg-secondary) 88%, var(--bg-primary));
  color: var(--text-primary);
  font: inherit;
  box-shadow: var(--shadow-md);
  cursor: pointer;
  text-align: left;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.metric-card :deep(.scope-icon) {
  width: 2.25rem;
  height: 2.25rem;
  padding: 0.55rem;
  border-radius: var(--radius-full);
  color: var(--accent-teal);
  background: color-mix(in srgb, var(--accent-teal) 14%, var(--bg-primary));
  border: 1px solid color-mix(in srgb, var(--accent-teal) 28%, transparent);
}

.metric-card:hover,
.metric-card:focus-visible {
  transform: translateY(var(--motion-button-lift));
  border-color: color-mix(in srgb, var(--accent-teal) 58%, var(--glass-border));
  background: color-mix(in srgb, var(--bg-secondary) 78%, var(--accent-teal) 8%);
  box-shadow:
    var(--shadow-md),
    0 0 0 3px color-mix(in srgb, var(--accent-teal) 18%, transparent);
  outline: none;
}

.metric-card--active {
  border-color: color-mix(in srgb, var(--accent-teal) 72%, var(--glass-border));
  background: color-mix(in srgb, var(--bg-secondary) 82%, var(--accent-teal) 10%);
  box-shadow:
    var(--shadow-md),
    inset 0 0 0 2px color-mix(in srgb, var(--accent-teal) 58%, transparent),
    inset 0.32rem 0 0 var(--accent-teal);
}

.metric-card span {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.metric-card strong {
  justify-self: end;
  font-size: clamp(1.55rem, 1.5vw + 1rem, 2rem);
  line-height: var(--line-height-tight);
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
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--space-4);
  align-items: center;
  min-height: 9rem;
  padding: var(--space-5);
  border-radius: var(--radius-xl);
  border-color: color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--bg-secondary) 92%, var(--accent-teal) 8%), color-mix(in srgb, var(--bg-primary) 92%, var(--bg-secondary))),
    linear-gradient(90deg, color-mix(in srgb, var(--accent-teal) 10%, transparent), transparent 52%);
  box-shadow: var(--shadow-lg);
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
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
  box-shadow: var(--shadow-lg), var(--shadow-glow-teal);
}

.document-visual {
  position: relative;
  width: 6.5rem;
  height: 5.5rem;
  display: grid;
  place-items: center;
}

.document-icon {
  position: relative;
  z-index: 1;
  width: 3.7rem;
  height: 3.7rem;
  display: inline-grid;
  place-items: center;
  border-radius: var(--radius-full);
  color: var(--accent-teal);
  background: color-mix(in srgb, var(--accent-teal) 15%, var(--bg-secondary));
  border: 1px solid color-mix(in srgb, var(--accent-teal) 34%, var(--glass-border));
}

.document-icon--shared {
  color: var(--accent-gold);
  background: color-mix(in srgb, var(--accent-gold) 16%, var(--bg-secondary));
  border-color: color-mix(in srgb, var(--accent-gold) 38%, var(--glass-border));
}

.route-node,
.route-line {
  position: absolute;
  display: block;
}

.route-node {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: var(--radius-full);
  background: var(--accent-teal);
  box-shadow: 0 0 0 0.35rem color-mix(in srgb, var(--accent-teal) 12%, transparent);
}

.route-node--start {
  left: 0.45rem;
  bottom: 0.7rem;
}

.route-node--end {
  right: 0.45rem;
  top: 0.7rem;
  background: var(--accent-gold);
  box-shadow: 0 0 0 0.35rem color-mix(in srgb, var(--accent-gold) 12%, transparent);
}

.route-line {
  inset: 1.15rem 1.05rem;
  border-top: 2px solid color-mix(in srgb, var(--accent-teal) 55%, transparent);
  border-right: 2px solid color-mix(in srgb, var(--accent-gold) 50%, transparent);
  border-radius: var(--radius-xl);
  transform: skewX(-18deg);
}

.document-copy {
  min-width: 0;
}

.document-copy h3 {
  color: var(--text-primary);
  font-size: clamp(1.25rem, 1vw + 1rem, 1.7rem);
  line-height: var(--line-height-tight);
  overflow-wrap: anywhere;
}

.document-copy > p {
  margin-top: var(--space-1);
}

.document-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.document-meta span {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 2rem;
  padding: 0.38rem 0.62rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 86%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 34%, var(--glass-bg));
  color: var(--text-secondary);
  font-size: var(--font-size-small);
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
  gap: var(--space-2);
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
  min-height: 2.75rem;
  padding: 0.72rem 1rem;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--accent-teal) 10%, var(--bg-secondary));
  border: 1px solid color-mix(in srgb, var(--accent-teal) 34%, var(--border));
  cursor: pointer;
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
    0 0 0 3px color-mix(in srgb, var(--accent-teal) 22%, transparent),
    0 0.85rem 1.6rem color-mix(in srgb, var(--accent-teal) 16%, transparent);
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
  box-shadow: 0 0 1.4rem color-mix(in srgb, var(--danger) 22%, transparent);
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
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--accent-teal) 22%, transparent),
    0 0.8rem 1.4rem color-mix(in srgb, var(--accent-teal) 14%, transparent);
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

  .document-visual {
    width: 100%;
    height: 4rem;
    place-items: start;
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
