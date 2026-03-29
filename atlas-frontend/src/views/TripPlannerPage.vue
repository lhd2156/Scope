<template>
  <AppShell>
    <div class="page-container page-stack">
      <SectionHeading
        eyebrow="Trip planner"
        title="Generate an itinerary from your travel constraints"
        description="Use the planner to shape budget, timing, pace, and interests, then compare the AI route against saved Atlas trips."
      />

      <section class="planner-layout">
        <TripPlanner :initial-value="plannerSeed" :submitting="tripsStore.loading" @submit="submitPlanner" />
        <ItineraryView :itinerary="tripsStore.previewItinerary" />
      </section>

      <section class="saved-trips-section">
        <SectionHeading
          eyebrow="Saved trips"
          title="Reference itineraries already in Atlas"
          description="Use existing group routes as a benchmark while the AI itinerary comes together."
        />

        <div class="trip-grid">
          <TripCard v-for="trip in tripsStore.items" :key="trip.id" :trip="trip" />
        </div>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import AppShell from '@/components/common/AppShell.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import ItineraryView from '@/components/trips/ItineraryView.vue';
import TripCard from '@/components/trips/TripCard.vue';
import TripPlanner from '@/components/trips/TripPlanner.vue';
import { useTripsStore } from '@/stores/trips';
import type { TripPlannerInput } from '@/types';

const tripsStore = useTripsStore();
const plannerSeed: TripPlannerInput = {
  destination: 'Fort Worth, TX',
  startDate: '2026-04-01',
  endDate: '2026-04-03',
  budget: 500,
  interests: ['food', 'culture', 'nightlife'],
  pace: 'moderate',
  groupSize: 2,
};

async function submitPlanner(payload: TripPlannerInput): Promise<void> {
  await tripsStore.buildItinerary(payload);
}

onMounted(async () => {
  await Promise.all([
    tripsStore.fetchTrips(),
    tripsStore.buildItinerary(plannerSeed),
  ]);
});
</script>

<style scoped>
.page-stack,
.saved-trips-section {
  display: grid;
  gap: var(--space-6);
}

.planner-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(22rem, 0.95fr);
  gap: var(--space-6);
  align-items: start;
}

.trip-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  gap: var(--space-4);
}

@media (max-width: 1100px) {
  .planner-layout {
    grid-template-columns: 1fr;
  }
}
</style>
