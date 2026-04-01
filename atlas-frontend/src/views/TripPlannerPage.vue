<template>
  <AppShell>
    <div class="page-container page-stack planner-page" :data-planner-layout="isMobilePlannerLayout ? 'mobile-wizard' : 'desktop'">
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

      <section v-if="isMobilePlannerLayout" class="glass-panel planner-mobile-brief">
        <div class="planner-mobile-copy">
          <p class="eyebrow">Mobile wizard</p>
          <h2>Plan the trip in four focused steps</h2>
          <p>
            Move from the core brief into route order, trip vibe, and the live AI preview without squeezing the desktop split layout onto a narrow screen.
          </p>
        </div>

        <div class="planner-mobile-progress" aria-label="Trip planner steps">
          <button
            v-for="step in mobileWizardSteps"
            :key="step.number"
            type="button"
            class="planner-mobile-step"
            :data-step-state="getMobileStepState(step.number)"
            :data-test="`planner-mobile-step-${step.number}`"
            @click="handleWizardStepChange(step.number)"
          >
            <span class="planner-mobile-step__index">{{ step.number }}</span>
            <span class="planner-mobile-step__copy">
              <strong>{{ step.label }}</strong>
              <small>{{ step.description }}</small>
            </span>
          </button>
        </div>
      </section>

      <section class="planner-workspace" :class="{ 'planner-workspace--mobile': isMobilePlannerLayout }">
        <TripPlanner
          :initial-value="plannerDraft"
          :initial-title="plannerTitle"
          :stops="plannerStops"
          :suggested-stops="plannerSuggestedStops"
          :submitting="tripsStore.planning"
          :mobile-wizard="isMobilePlannerLayout"
          :mobile-active-step="mobileWizardStep"
          @update:title="plannerTitle = $event"
          @update:stops="handleStopsUpdate"
          @wizard-step-change="handleWizardStepChange"
          @submit="handleGenerate"
        />

        <ItineraryView
          :itinerary="tripsStore.previewItinerary"
          :trip-title="plannerTitle"
          :members="plannerCrew"
          :submitting="tripsStore.planning"
          :mobile-wizard="isMobilePlannerLayout"
          :mobile-active-step="mobileWizardStep"
          @wizard-step-change="handleWizardStepChange"
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

        <div class="community-grid stagger-in">
          <TripCard
            v-for="(trip, index) in featuredTrips"
            :key="trip.id"
            :trip="trip"
            :style="{ '--atlas-stagger-index': index }"
          />
        </div>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import AppShell from '@/components/common/AppShell.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import ItineraryView from '@/components/trips/ItineraryView.vue';
import TripCard from '@/components/trips/TripCard.vue';
import TripPlanner from '@/components/trips/TripPlanner.vue';
import { getTripPlannerPreset, matchTripPlannerPreset } from '@/services/tripPlannerPresets';
import { useToastStore } from '@/stores/toasts';
import { useTripsStore } from '@/stores/trips';
import type { TripMember, TripPlannerInput, TripSpot } from '@/types';

type PlannerMobileStep = 1 | 2 | 3 | 4;

interface MobileWizardStep {
  number: PlannerMobileStep;
  label: string;
  description: string;
}

const TRIP_PLANNER_MOBILE_BREAKPOINT = 640;

const mobileWizardSteps: MobileWizardStep[] = [
  { number: 1, label: 'Brief', description: 'Destination, dates, and budget range.' },
  { number: 2, label: 'Route', description: 'Stop order, search, and destination stack.' },
  { number: 3, label: 'Vibe', description: 'Pace, interests, and final planner summary.' },
  { number: 4, label: 'Preview', description: 'AI map, timeline, and day-by-day cost view.' },
];

const tripsStore = useTripsStore();
const toastStore = useToastStore();
const defaultPreset = getTripPlannerPreset('Patagonia, Chile + Argentina');
const isMobilePlannerLayout = ref(resolveIsMobilePlannerLayout());
const mobileWizardStep = ref<PlannerMobileStep>(1);
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

function resolveIsMobilePlannerLayout(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.innerWidth <= TRIP_PLANNER_MOBILE_BREAKPOINT;
}

function syncMobilePlannerLayout() {
  isMobilePlannerLayout.value = resolveIsMobilePlannerLayout();
}

function clampPlannerStep(step: number): PlannerMobileStep {
  if (step <= 1) {
    return 1;
  }

  if (step >= 4) {
    return 4;
  }

  return step as PlannerMobileStep;
}

function getMobileStepState(step: PlannerMobileStep): 'current' | 'complete' | 'upcoming' {
  if (mobileWizardStep.value === step) {
    return 'current';
  }

  return mobileWizardStep.value > step ? 'complete' : 'upcoming';
}

async function scrollMobileStepIntoView(step: PlannerMobileStep) {
  if (!isMobilePlannerLayout.value || typeof window === 'undefined') {
    return;
  }

  await nextTick();

  const target = document.querySelector(`[data-test="planner-step-${step}-toggle"]`);
  if (!(target instanceof HTMLElement) || typeof target.scrollIntoView !== 'function') {
    return;
  }

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  target.scrollIntoView({
    block: 'start',
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
  });
}

function handleWizardStepChange(step: number) {
  const nextStep = clampPlannerStep(step);
  mobileWizardStep.value = nextStep;
  void scrollMobileStepIntoView(nextStep);
}

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

    if (isMobilePlannerLayout.value) {
      handleWizardStepChange(4);
    }
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
  syncMobilePlannerLayout();
  window.addEventListener('resize', syncMobilePlannerLayout, { passive: true });

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

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncMobilePlannerLayout);
});
</script>

<style scoped>
.planner-page.page-container {
  width: min(1480px, calc(100% - (var(--shell-side-padding) * 2)));
}

.planner-page,
.planner-workspace,
.community-panel,
.community-grid,
.planner-mobile-brief,
.planner-mobile-copy,
.planner-mobile-progress {
  display: grid;
  gap: var(--space-6);
}

.planner-page[data-planner-layout='mobile-wizard'] {
  gap: var(--space-4);
}

.planner-alert,
.community-panel,
.planner-mobile-brief {
  padding: var(--space-6);
}

.planner-alert h2,
.planner-alert p,
.community-header h2,
.planner-mobile-copy h2,
.planner-mobile-copy p {
  margin: 0;
}

.planner-alert {
  gap: var(--space-3);
}

.planner-alert p:last-child,
.planner-mobile-copy p {
  color: var(--text-secondary);
}

.planner-workspace {
  grid-template-columns: minmax(24rem, 0.4fr) minmax(0, 0.6fr);
  align-items: stretch;
}

.planner-workspace--mobile {
  gap: var(--space-4);
}

.planner-mobile-brief {
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent-teal) 16%, transparent), transparent 38%),
    linear-gradient(180deg, color-mix(in srgb, var(--glass-bg) 100%, transparent), color-mix(in srgb, var(--bg-secondary) 70%, var(--glass-bg)));
}

.planner-mobile-copy {
  gap: var(--space-3);
}

.planner-mobile-progress {
  gap: var(--space-3);
}

.planner-mobile-step,
.community-header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: flex-start;
}

.planner-mobile-step {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-2xl);
  border: 1px solid var(--glass-border);
  background: color-mix(in srgb, var(--glass-bg) 94%, transparent);
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
}

.planner-mobile-step:hover,
.planner-mobile-step:focus-visible {
  transform: translateY(var(--motion-card-lift));
  border-color: var(--border-hover);
  box-shadow: var(--shadow-md);
  outline: none;
}

.planner-mobile-step[data-step-state='current'] {
  border-color: var(--accent-teal);
  background: color-mix(in srgb, var(--accent-teal) 14%, var(--glass-bg));
  box-shadow: var(--shadow-glow-teal);
}

.planner-mobile-step[data-step-state='complete'] {
  border-color: color-mix(in srgb, var(--accent-teal) 36%, var(--glass-border));
}

.planner-mobile-step__index {
  width: 2.3rem;
  height: 2.3rem;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 20%, var(--bg-primary));
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
}

.planner-mobile-step__copy {
  display: grid;
  gap: var(--space-1);
  flex: 1;
}

.planner-mobile-step__copy strong,
.planner-mobile-step__copy small {
  margin: 0;
}

.planner-mobile-step__copy small {
  color: var(--text-secondary);
  line-height: var(--line-height-normal);
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
  .community-panel,
  .planner-mobile-brief {
    padding: var(--space-5);
  }

  .planner-mobile-step,
  .community-header {
    gap: var(--space-3);
  }

  .community-header,
  .planner-mobile-step {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 640px) {
  .planner-mobile-step {
    padding: var(--space-3);
    border-radius: var(--radius-xl);
  }
}

@media (prefers-reduced-motion: reduce) {
  .planner-mobile-step {
    transition-duration: 1ms;
  }

  .planner-mobile-step:hover,
  .planner-mobile-step:focus-visible {
    transform: none;
  }
}
</style>
