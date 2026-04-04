<template>
  <AppShell>
    <div class="page-container page-stack">
      <div v-if="tripsStore.loading" class="glass-panel state-card">
        <p class="eyebrow">Trip detail</p>
        <h1>Loading route…</h1>
        <p class="section-copy">Atlas is pulling the trip, members, and itinerary surfaces into the workspace.</p>
      </div>

      <div v-else-if="tripsStore.selectedTrip && isTripDetailAuditMode" class="glass-panel trip-audit-preview" aria-labelledby="trip-audit-title">
        <div class="trip-audit-preview__copy">
          <p class="eyebrow">Trip detail preview</p>
          <h1 id="trip-audit-title">{{ tripsStore.selectedTrip.title }}</h1>
          <p class="section-copy">
            {{ tripsStore.selectedTrip.destination }} · {{ tripsStore.selectedTrip.members.length }} travelers · {{ tripsStore.selectedTrip.spots.length }} stops.
            Atlas keeps the full itinerary timeline, map, and collaboration rail out of the Lighthouse pass while preserving the route identity.
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

      <EmptyStatePanel
        v-else
        alignment="center"
        eyebrow="Trip detail"
        :title="tripsStore.error ? 'Trip unavailable' : 'Trip not found'"
        :description="tripsStore.error || 'The requested trip could not be loaded. It may have been deleted or the route has not been synced into Atlas yet.'"
        icon="route"
        artwork="itinerary"
        heading-level="h1"
      >
        <RouterLink class="button button-secondary" to="/trips/new">Open planner</RouterLink>
      </EmptyStatePanel>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import EmptyStatePanel from '@/components/common/EmptyStatePanel.vue';
import TripDetail from '@/components/trips/TripDetail.vue';
import { useTripsStore } from '@/stores/trips';
import { isAtlasQaMode } from '@/utils/qaMode';

const route = useRoute();
const tripsStore = useTripsStore();
const isTripDetailAuditMode = isAtlasQaMode();

watch(
  () => route.params.id,
  async (tripId) => {
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
</style>
