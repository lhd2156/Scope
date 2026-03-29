<template>
  <AppShell>
    <div class="page-container page-stack">
      <SectionHeading
        eyebrow="Trip planner"
        title="Generate an itinerary from your travel constraints"
        description="Shape the destination, timing, budget, and interests first. Atlas Intel handles the stop sequencing and route density."
      />

      <article v-if="tripsStore.error" class="glass-panel error-panel" role="alert">
        <p class="eyebrow">Temporary issue</p>
        <h2>Atlas could not finish part of the planning flow</h2>
        <p class="section-copy">{{ tripsStore.error }}</p>
      </article>

      <section class="planner-layout">
        <TripPlanner :initial-value="plannerDraft" :submitting="tripsStore.planning" @submit="handleGenerate" />
        <ItineraryView :itinerary="tripsStore.previewItinerary" />
      </section>

      <section class="support-grid">
        <article class="glass-panel draft-panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Draft signal</p>
              <h2>{{ plannerDraft.destination }}</h2>
            </div>
            <span class="meta-pill">{{ plannerDraft.pace }} pace</span>
          </div>

          <div class="draft-metrics">
            <div class="surface-card metric-card">
              <small>Travel window</small>
              <strong>{{ plannerDraft.startDate }} → {{ plannerDraft.endDate }}</strong>
            </div>
            <div class="surface-card metric-card">
              <small>Budget</small>
              <strong>${{ plannerDraft.budget }}</strong>
            </div>
            <div class="surface-card metric-card">
              <small>Interests</small>
              <strong>{{ interestLabel }}</strong>
            </div>
          </div>
        </article>

        <section class="community-panel">
          <div class="panel-heading community-heading">
            <div>
              <p class="eyebrow">Community routes</p>
              <h2>Reference trips already mapped in Atlas</h2>
            </div>
            <RouterLink class="map-link" to="/map">Open map workspace</RouterLink>
          </div>

          <div class="trip-grid">
            <TripCard v-for="trip in featuredTrips" :key="trip.id" :trip="trip" />
          </div>
        </section>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppShell from '@/components/common/AppShell.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import ItineraryView from '@/components/trips/ItineraryView.vue';
import TripCard from '@/components/trips/TripCard.vue';
import TripPlanner from '@/components/trips/TripPlanner.vue';
import { useToastStore } from '@/stores/toasts';
import { useTripsStore } from '@/stores/trips';
import type { TripPlannerInput } from '@/types';

const toastStore = useToastStore();
const tripsStore = useTripsStore();
const defaultPlannerInput: TripPlannerInput = {
  destination: 'Fort Worth, TX',
  startDate: '2026-04-01',
  endDate: '2026-04-03',
  budget: 500,
  interests: ['food', 'culture', 'nightlife'],
  pace: 'moderate',
  groupSize: 2,
};

const plannerDraft = ref<TripPlannerInput>({
  ...defaultPlannerInput,
  interests: [...defaultPlannerInput.interests],
});

const featuredTrips = computed(() => tripsStore.items.slice(0, 3));
const interestLabel = computed(() => plannerDraft.value.interests.map((interest) => interest.charAt(0).toUpperCase() + interest.slice(1)).join(', '));

async function handleGenerate(payload: TripPlannerInput) {
  plannerDraft.value = {
    ...payload,
    interests: [...payload.interests],
  };

  try {
    const generatedItinerary = await tripsStore.buildItinerary(plannerDraft.value);
    const itineraryDayCount = generatedItinerary.days.length;
    toastStore.showSuccess({
      title: 'Itinerary refreshed',
      message: itineraryDayCount
        ? `${generatedItinerary.destination} now has a ${itineraryDayCount}-day route preview ready.`
        : 'Atlas refreshed your itinerary preview.',
    });
  } catch {
    toastStore.showError({
      title: 'Planner update failed',
      message: tripsStore.error || 'Atlas could not generate an itinerary right now.',
    });
  }
}

onMounted(async () => {
  await Promise.allSettled([tripsStore.fetchTrips(), tripsStore.buildItinerary(plannerDraft.value)]);
});
</script>

<style scoped>
.page-stack,
.error-panel,
.support-grid,
.draft-panel,
.draft-metrics,
.community-panel {
  display: grid;
  gap: var(--space-6);
}

.planner-layout {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
  gap: var(--space-6);
  align-items: start;
}

.draft-panel,
.error-panel {
  padding: var(--space-6);
}

.error-panel h2,
.error-panel p {
  margin: 0;
}

.panel-heading,
.community-heading {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: flex-start;
}

.eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.panel-heading h2,
.metric-card small,
.metric-card strong {
  margin: 0;
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0.85rem;
  border-radius: var(--radius-full);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: var(--glass-blur);
  font-size: var(--font-size-small);
}

.draft-metrics,
.trip-grid {
  display: grid;
  gap: var(--space-4);
}

.draft-metrics {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.metric-card {
  padding: var(--space-4);
  display: grid;
  gap: var(--space-2);
}

.metric-card small {
  color: var(--text-secondary);
}

.metric-card strong {
  color: var(--text-primary);
}

.trip-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.map-link {
  color: var(--accent-teal);
  font-weight: var(--font-weight-semibold);
}

@media (max-width: 1180px) {
  .planner-layout,
  .support-grid,
  .trip-grid,
  .draft-metrics {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .draft-panel {
    padding: var(--space-5);
  }

  .panel-heading,
  .community-heading {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
