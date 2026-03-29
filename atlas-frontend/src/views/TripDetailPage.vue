<template>
  <AppShell>
    <div class="page-container page-stack">
      <SectionHeading
        eyebrow="Trip detail"
        title="Collaborative itinerary view"
        description="Atlas renders the route, traveler roster, cost breakdown, and stop-by-stop timeline in one premium planning surface."
      />

      <section v-if="tripsStore.loading" class="glass-panel state-card">
        <p class="eyebrow">Loading</p>
        <h2>Pulling the full trip itinerary</h2>
        <p class="section-copy">Atlas is syncing member roles, route geometry, and itinerary sequencing.</p>
      </section>

      <section v-else-if="notFound" class="glass-panel state-card" role="alert">
        <p class="eyebrow">Missing trip</p>
        <h2>{{ tripsStore.error ? 'Trip unavailable' : 'That itinerary could not be found' }}</h2>
        <p class="section-copy">{{ tripsStore.error || 'The requested trip may have moved, been deleted, or not synced back yet.' }}</p>
        <RouterLink to="/trips/new" class="state-link">Plan a new trip</RouterLink>
      </section>

      <TripDetail v-else :trip="activeTrip" />
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import TripDetail from '@/components/trips/TripDetail.vue';
import { useTripsStore } from '@/stores/trips';

const route = useRoute();
const tripsStore = useTripsStore();
const notFound = ref(false);

const requestedTripId = computed(() => String(route.params.id ?? ''));
const activeTrip = computed(() => (tripsStore.selectedTrip?.id === requestedTripId.value ? tripsStore.selectedTrip : null));

async function loadTrip(tripId: string): Promise<void> {
  if (!tripId) {
    notFound.value = true;
    return;
  }

  notFound.value = false;

  try {
    await tripsStore.fetchTrip(tripId);
  } catch {
    notFound.value = true;
  }
}

watch(
  requestedTripId,
  async (tripId) => {
    await loadTrip(tripId);
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
  padding: var(--space-6);
  display: grid;
  gap: var(--space-3);
}

.state-card h2,
.state-card p {
  margin: 0;
}

.eyebrow {
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.state-link {
  color: var(--accent-teal);
  font-weight: var(--font-weight-semibold);
}

.state-link:hover,
.state-link:focus-visible {
  color: var(--accent-teal-hover);
  outline: none;
}
</style>
