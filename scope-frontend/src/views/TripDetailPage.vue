<template>
  <AppShell>
    <div class="page-container page-stack">
      <div v-if="tripsStore.loading" class="glass-panel state-card">
        <p class="eyebrow">Trip detail</p>
        <h1>Loading route…</h1>
        <p class="section-copy">Scope is pulling the trip, members, and itinerary surfaces into the workspace.</p>
      </div>

      <div v-else-if="tripsStore.selectedTrip && isTripDetailAuditMode" class="glass-panel trip-audit-preview" aria-labelledby="trip-audit-title">
        <div class="trip-audit-preview__copy">
          <p class="eyebrow">Trip detail preview</p>
          <h1 id="trip-audit-title">{{ tripsStore.selectedTrip.title }}</h1>
          <p class="section-copy">
            {{ tripsStore.selectedTrip.destination }} · {{ tripsStore.selectedTrip.members.length }} travelers · {{ tripsStore.selectedTrip.spots.length }} stops.
            Scope keeps the full itinerary timeline, map, and collaboration rail out of the Lighthouse pass while preserving the route identity.
          </p>
        </div>

        <div class="trip-audit-preview__grid">
          <article class="surface-card trip-audit-preview__card">
            <p class="eyebrow">Route window</p>
            <h2>{{ tripsStore.selectedTrip.startDate }} → {{ tripsStore.selectedTrip.endDate }}</h2>
            <p class="section-copy">A compact summary of the travel window and collaboration footprint.</p>
          </article>

          <article class="surface-card trip-audit-preview__card">
            <p class="eyebrow">Crew</p>
            <h2>{{ tripsStore.selectedTrip.members.length }} collaborators</h2>
            <p class="section-copy">Full member roles, notes, and stop-level detail stay in the standard trip workspace.</p>
          </article>
        </div>
      </div>
      <div v-else-if="tripsStore.selectedTrip">
        <TripDetail :trip="tripsStore.selectedTrip" />
      </div>

      <div
        v-else
        class="trip-detail-empty-state"
        data-test="trip-detail-empty-state"
      >
        <p class="eyebrow">Trip detail</p>
        <h1>{{ tripsStore.error ? 'Trip unavailable' : 'Trip not found' }}</h1>
        <p>{{ tripsStore.error || 'The requested trip could not be loaded. It may have been deleted or the route has not been synced into Scope yet.' }}</p>
        <RouterLink class="button button-secondary" to="/trips/new">Open planner</RouterLink>
      </div>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import TripDetail from '@/components/trips/TripDetail.vue';
import { useTripsStore } from '@/stores/trips';
import { isScopeQaMode } from '@/utils/qaMode';

const route = useRoute();
const tripsStore = useTripsStore();
const isTripDetailAuditMode = isScopeQaMode();

watch(
  () => [route.name, route.params.id, route.params.token],
  async ([routeName, tripId, shareToken]) => {
    if (routeName === 'trip-share') {
      if (!shareToken) {
        return;
      }

      try {
        await tripsStore.fetchSharedTrip(String(shareToken));
      } catch {
        // The store already captures the error state used by this page.
      }
      return;
    }

    if (!tripId) {
      return;
    }

    try {
      await tripsStore.fetchTrip(String(tripId));
    } catch {
      // The store already captures the error state used by this page.
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.page-stack,
.trip-audit-preview,
.trip-audit-preview__copy,
.trip-audit-preview__grid,
.trip-audit-preview__card {
  display: grid;
}

.page-stack {
  gap: var(--space-6);
}

.state-card,
.trip-audit-preview {
  padding: var(--space-8);
  gap: var(--space-4);
}

.trip-audit-preview {
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent-teal) 14%, transparent), transparent 42%),
    linear-gradient(135deg, color-mix(in srgb, var(--glass-bg) 94%, transparent), color-mix(in srgb, var(--bg-secondary) 88%, transparent));
}

.trip-audit-preview__grid {
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: var(--space-4);
}

.trip-audit-preview__card {
  gap: var(--space-3);
  padding: var(--space-5);
}

.eyebrow {
  margin: 0;
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

h1,
h2,
.section-copy,
.trip-audit-preview__card p {
  margin: 0;
}

.trip-detail-empty-state {
  min-height: clamp(24rem, 48vh, 36rem);
  display: grid;
  align-content: center;
  justify-items: center;
  gap: var(--space-3);
  padding: clamp(var(--space-6), 5vw, var(--space-10));
  text-align: center;
}

.trip-detail-empty-state h1,
.trip-detail-empty-state p {
  margin: 0;
}

.trip-detail-empty-state h1 {
  max-width: 32rem;
  color: var(--text-primary);
  font-size: clamp(1.7rem, 3vw, 3rem);
  line-height: var(--line-height-tight);
  letter-spacing: 0;
}

.trip-detail-empty-state p:not(.eyebrow) {
  max-width: 42rem;
  color: var(--text-secondary);
  line-height: var(--line-height-relaxed);
}

.trip-detail-empty-state .button {
  margin-top: var(--space-2);
}
</style>
