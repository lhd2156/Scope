<template>
  <AppShell>
    <div class="page-container page-stack planner-page">
      <SectionHeading
        eyebrow="Trip planner"
        title="Generate an itinerary from your travel constraints"
        description="Build the trip title, travel window, budget range, and route stack on the left, then review the AI-tuned timeline and map overlay on the right."
      />

      <article v-if="tripsStore.error" class="glass-panel planner-alert">
        <p class="eyebrow">Planner status</p>
        <h2>Atlas could not finish part of the planning flow</h2>
        <p>{{ tripsStore.error }}</p>
      </article>

      <section class="planner-workspace">
        <TripPlanner
          :initial-value="plannerDraft"
          :stops="plannerStops"
          :suggested-stops="plannerSuggestedStops"
          :submitting="tripsStore.planning"
          @update:title="plannerTitle = $event"
          @update:stops="handleStopsUpdate"
          @submit="handleGenerate"
        />

        <ItineraryView
          :itinerary="tripsStore.previewItinerary"
          :trip-title="plannerTitle"
          :members="plannerCrew"
          :submitting="tripsStore.planning"
        />
      </section>

      <section class="glass-panel community-panel">
        <div class="community-header">
          <div>
            <p class="eyebrow">Reference trips</p>
            <h2>Routes already mapped by the Atlas community</h2>
          </div>
          <span class="community-pill">{{ featuredTrips.length }} ready to remix</span>
        </div>

        <div class="community-grid">
          <TripCard v-for="trip in featuredTrips" :key="trip.id" :trip="trip" />
        </div>
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
import { getTripPlannerPreset, matchTripPlannerPreset } from '@/services/tripPlannerPresets';
import { useToastStore } from '@/stores/toasts';
import { useTripsStore } from '@/stores/trips';
import type { TripMember, TripPlannerInput, TripSpot } from '@/types';

const tripsStore = useTripsStore();
const toastStore = useToastStore();
const defaultPreset = getTripPlannerPreset('Patagonia, Chile + Argentina');
const plannerDraft = ref<TripPlannerInput>({
  destination: defaultPreset.destination,
  startDate: '2026-11-03',
  endDate: '2026-11-05',
  budget: defaultPreset.baseBudget,
  interests: [...defaultPreset.interests],
  pace: 'moderate',
  groupSize: 3,
});
const plannerTitle = ref(defaultPreset.tripTitle);
const plannerStops = ref<TripSpot[]>(cloneStops(defaultPreset.stops));
const plannerSuggestedStops = ref<TripSpot[]>(cloneStops(defaultPreset.suggestedStops));
const plannerCrew = ref<TripMember[]>(cloneMembers(defaultPreset.crew));

const featuredTrips = computed(() => tripsStore.items.slice(0, 3));

function cloneStops(stops: TripSpot[]): TripSpot[] {
  return stops.map((stop) => ({
    ...stop,
  }));
}

function cloneMembers(members: TripMember[]): TripMember[] {
  return members.map((member) => ({
    ...member,
  }));
}

function syncPresetExperience(destination: string, previousDestination?: string, forceRouteReset = false) {
  const matchedPreset = matchTripPlannerPreset(destination);
  if (!matchedPreset) {
    return null;
  }

  const previousPreset = previousDestination ? matchTripPlannerPreset(previousDestination) : null;
  const shouldResetTitle =
    !plannerTitle.value.trim() ||
    (previousPreset && plannerTitle.value === previousPreset.tripTitle) ||
    forceRouteReset;

  if (shouldResetTitle) {
    plannerTitle.value = matchedPreset.tripTitle;
  }

  if (forceRouteReset) {
    plannerStops.value = cloneStops(matchedPreset.stops);
  }

  plannerSuggestedStops.value = cloneStops(matchedPreset.suggestedStops);
  plannerCrew.value = cloneMembers(matchedPreset.crew);
  return matchedPreset;
}

async function handleGenerate(payload: TripPlannerInput) {
  const previousDestination = plannerDraft.value.destination;
  plannerDraft.value = {
    ...payload,
    interests: [...payload.interests],
  };

  syncPresetExperience(payload.destination, previousDestination, payload.destination !== previousDestination);

  try {
    await tripsStore.buildItinerary(payload);
    toastStore.showSuccess({
      title: 'Itinerary refreshed',
      message: 'Atlas refreshed your itinerary preview.',
    });
  } catch {
    toastStore.showError({
      title: 'Planner update failed',
      message: tripsStore.error ?? 'Atlas could not generate an itinerary right now.',
    });
  }
}

function handleStopsUpdate(stops: TripSpot[]) {
  plannerStops.value = cloneStops(stops);
}

onMounted(async () => {
  try {
    await tripsStore.fetchTrips();
  } catch {
    // surfaced through tripsStore.error
  }

  try {
    await tripsStore.buildItinerary(plannerDraft.value);
  } catch {
    // surfaced through tripsStore.error
  }
});
</script>

<style scoped>
.planner-page.page-container {
  width: min(1480px, calc(100% - (var(--shell-side-padding) * 2)));
}

.planner-page,
.planner-workspace,
.community-panel,
.community-grid {
  display: grid;
  gap: var(--space-6);
}

.planner-alert,
.community-panel {
  padding: var(--space-6);
}

.planner-alert h2,
.planner-alert p,
.community-header h2 {
  margin: 0;
}

.planner-alert {
  gap: var(--space-3);
}

.planner-alert p:last-child {
  color: var(--text-secondary);
}

.planner-workspace {
  grid-template-columns: minmax(24rem, 0.4fr) minmax(0, 0.6fr);
  align-items: stretch;
}

.community-header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: flex-start;
}

.community-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0.85rem;
  border-radius: var(--radius-full);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: var(--glass-blur);
  color: var(--text-primary);
  font-size: var(--font-size-small);
}

.community-grid {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
}

@media (max-width: 1180px) {
  .planner-workspace {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .planner-alert,
  .community-panel {
    padding: var(--space-5);
  }

  .community-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
