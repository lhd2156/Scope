<template>
  <AppShell>
    <div class="page-container page-stack">
      <div v-if="tripsStore.loading" class="glass-panel state-card">
        <p class="eyebrow">Trip detail</p>
        <h1>Loading route…</h1>
        <p class="section-copy">Atlas is pulling the trip, members, and itinerary surfaces into the workspace.</p>
      </div>

      <div v-else-if="tripsStore.selectedTrip">
        <TripDetail :trip="tripsStore.selectedTrip" />
      </div>

      <div v-else class="glass-panel state-card" role="alert">
        <p class="eyebrow">Trip detail</p>
        <h1>{{ tripsStore.error ? 'Trip unavailable' : 'Trip not found' }}</h1>
        <p class="section-copy">
          {{ tripsStore.error || 'The requested trip could not be loaded. It may have been deleted or the route has not been synced into Atlas yet.' }}
        </p>
      </div>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { useRoute } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import TripDetail from '@/components/trips/TripDetail.vue';
import { useTripsStore } from '@/stores/trips';

const route = useRoute();
const tripsStore = useTripsStore();

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
.page-stack {
  display: grid;
  gap: var(--space-6);
}

.state-card {
  padding: var(--space-8);
  display: grid;
  gap: var(--space-4);
}

.eyebrow {
  margin: 0;
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

h1,
.section-copy {
  margin: 0;
}
</style>
