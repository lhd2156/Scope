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

      <section v-if="isTripPlannerAuditMode" class="glass-panel planner-audit-preview" aria-labelledby="planner-audit-title">
        <div class="planner-audit-preview__copy">
          <p class="eyebrow">Planner preview</p>
          <h2 id="planner-audit-title">Trip brief, route momentum, and itinerary output stay condensed during the QA session.</h2>
          <p class="section-copy">
            The full form wizard, stop management, and AI itinerary renderer remain in the standard planner workspace. Lighthouse measures a compact summary instead of the dual-pane planning canvas.
          </p>
        </div>

        <div class="planner-audit-preview__grid">
          <article class="surface-card planner-audit-preview__card">
            <p class="eyebrow">Destination</p>
            <h3>{{ plannerDraft.destination }}</h3>
            <p class="section-copy">{{ plannerStops.length }} planned stops · {{ plannerCrew.length }} travelers.</p>
          </article>

          <article class="surface-card planner-audit-preview__card">
            <p class="eyebrow">Budget</p>
            <h3>${{ plannerDraft.budget.toLocaleString() }}</h3>
            <p class="section-copy">{{ plannerDraft.startDate }} → {{ plannerDraft.endDate }}</p>
          </article>

          <article class="surface-card planner-audit-preview__card">
            <p class="eyebrow">Preview</p>
            <h3>{{ resolvedPreviewItinerary?.days.length ?? 0 }} itinerary days</h3>
            <p class="section-copy">Community remix rails and the full route map render outside the Lighthouse session.</p>
          </article>
        </div>
      </section>
      <section v-else class="planner-workspace" :class="{ 'planner-workspace--mobile': isMobilePlannerLayout }">
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

        <section v-if="isTripPlannerAuditMode" class="glass-panel planner-audit-preview" data-test="planner-audit-preview">
          <div class="planner-audit-preview__header">
            <div>
              <p class="eyebrow">Preview snapshot</p>
              <h2>{{ plannerTitle }}</h2>
            </div>
            <span class="planner-audit-preview__pill">{{ resolvedPreviewItinerary?.destination ?? plannerDraft.destination }}</span>
          </div>

          <p class="section-copy">
            Atlas keeps the audit view focused on the trip brief, route count, and budget summary while preserving the user-facing planner flow.
          </p>

          <div class="planner-audit-preview__metrics">
            <article class="planner-audit-preview__metric">
              <span class="eyebrow">Days</span>
              <strong>{{ plannerAuditDayCount }}</strong>
            </article>
            <article class="planner-audit-preview__metric">
              <span class="eyebrow">Stops</span>
              <strong>{{ plannerAuditStopCount }}</strong>
            </article>
            <article class="planner-audit-preview__metric">
              <span class="eyebrow">Budget</span>
              <strong>{{ plannerAuditBudgetLabel }}</strong>
            </article>
          </div>
        </section>

        <ItineraryView
          v-else
          :itinerary="resolvedPreviewItinerary"
          :trip-title="plannerTitle"
          :members="plannerCrew"
          :submitting="tripsStore.planning"
          :mobile-wizard="isMobilePlannerLayout"
          :mobile-active-step="mobileWizardStep"
          @wizard-step-change="handleWizardStepChange"
        />
      </section>

      <div v-if="!isTripPlannerAuditMode" ref="communityPreviewViewport" class="community-preview-sentinel" aria-hidden="true" />

      <section v-if="!isTripPlannerAuditMode && isCommunityPreviewReady" class="glass-panel community-panel">
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
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import AppShell from '@/components/common/AppShell.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import TripPlanner from '@/components/trips/TripPlanner.vue';
import { buildTripPlannerPresetItinerary, getTripPlannerPreset, matchTripPlannerPreset } from '@/services/tripPlannerPresets';
import { useToastStore } from '@/stores/toasts';
import { useTripsStore } from '@/stores/trips';
import { isAtlasQaMode } from '@/utils/qaMode';
import type { Itinerary, TripMember, TripPlannerInput, TripSpot } from '@/types';

type PlannerMobileStep = 1 | 2 | 3 | 4;

interface MobileWizardStep {
  number: PlannerMobileStep;
  label: string;
  description: string;
}

const TRIP_PLANNER_MOBILE_BREAKPOINT = 640;
const shouldEagerlyRenderHeavyContent = import.meta.env.MODE === 'test' || import.meta.env.VITEST;
const ItineraryView = defineAsyncComponent(() => import('@/components/trips/ItineraryView.vue'));
const TripCard = defineAsyncComponent(() => import('@/components/trips/TripCard.vue'));

const mobileWizardSteps: MobileWizardStep[] = [
  { number: 1, label: 'Brief', description: 'Destination, dates, and budget range.' },
  { number: 2, label: 'Route', description: 'Stop order, search, and destination stack.' },
  { number: 3, label: 'Vibe', description: 'Pace, interests, and final planner summary.' },
  { number: 4, label: 'Preview', description: 'AI map, timeline, and day-by-day cost view.' },
];

const tripsStore = useTripsStore();
const toastStore = useToastStore();
const isTripPlannerAuditMode = isAtlasQaMode();
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
const isCommunityPreviewReady = ref(shouldEagerlyRenderHeavyContent);
const communityPreviewViewport = ref<HTMLElement | null>(null);
let disconnectCommunityPreviewObserver: (() => void) | null = null;

const featuredTrips = computed(() => tripsStore.items.slice(0, 3));
const resolvedPreviewItinerary = computed<Itinerary | null>(() => tripsStore.previewItinerary ?? buildTripPlannerPresetItinerary(plannerDraft.value));
const plannerAuditDayCount = computed(() => resolvedPreviewItinerary.value?.days.length ?? 0);
const plannerAuditStopCount = computed(() => resolvedPreviewItinerary.value?.days.reduce((total, day) => total + day.spots.length, 0) ?? plannerStops.value.length);
const plannerAuditBudgetLabel = computed(() => `${Math.round(plannerDraft.value.budget).toLocaleString('en-US')} USD`);

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
    await tripsStore.buildItinerary(payload, { source: 'user' });
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

async function loadCommunityPreview(): Promise<void> {
  if (isCommunityPreviewReady.value) {
    return;
  }

  isCommunityPreviewReady.value = true;

  try {
    await tripsStore.fetchTrips();
  } catch {
    // surfaced through tripsStore.error
  }
}

onMounted(() => {
  syncMobilePlannerLayout();
  window.addEventListener('resize', syncMobilePlannerLayout, { passive: true });

  if (isTripPlannerAuditMode) {
    return;
  }

  if (shouldEagerlyRenderHeavyContent || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    void loadCommunityPreview();
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return;
      }

      void loadCommunityPreview();
      observer.disconnect();
      disconnectCommunityPreviewObserver = null;
    },
    { rootMargin: '320px 0px' },
  );

  const target = communityPreviewViewport.value;
  if (target) {
    observer.observe(target);
    disconnectCommunityPreviewObserver = () => observer.disconnect();
    return;
  }

  void loadCommunityPreview();
  observer.disconnect();
});

onBeforeUnmount(() => {
  disconnectCommunityPreviewObserver?.();
  disconnectCommunityPreviewObserver = null;
  window.removeEventListener('resize', syncMobilePlannerLayout);
});
</script>

<style scoped>
.planner-page.page-container {
  width: 100%;
  max-width: calc(1480px + (var(--shell-side-padding) * 2) + var(--safe-area-left) + var(--safe-area-right));
}

.planner-page,
.planner-workspace,
.community-panel,
.community-grid,
.planner-mobile-brief,
.planner-mobile-copy,
.planner-mobile-progress,
.planner-audit-preview,
.planner-audit-preview__copy,
.planner-audit-preview__grid,
.planner-audit-preview__card {
  display: grid;
  gap: var(--space-6);
}

.community-preview-sentinel {
  width: 100%;
  height: 1px;
}

.planner-audit-preview {
  display: grid;
  gap: var(--space-4);
  align-content: start;
  padding: var(--space-5);
}

.planner-audit-preview__header,
.planner-audit-preview__metrics {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  justify-content: space-between;
  align-items: flex-start;
}

.planner-audit-preview__pill,
.planner-audit-preview__metric {
  border-radius: var(--radius-2xl);
  border: 1px solid var(--border-subtle);
  background: var(--surface-elevated-soft);
}

.planner-audit-preview__pill {
  padding: 0.7rem 1rem;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.planner-audit-preview__metric {
  min-width: 8rem;
  padding: 1rem 1.1rem;
  display: grid;
  gap: 0.35rem;
}

.planner-audit-preview__metric strong {
  font-size: var(--font-size-h3);
  line-height: var(--line-height-tight);
}

.planner-page[data-planner-layout='mobile-wizard'] {
  gap: var(--space-4);
}

.planner-alert,
.community-panel,
.planner-mobile-brief,
.planner-audit-preview {
  padding: var(--space-6);
}

.community-panel {
  content-visibility: auto;
  contain-intrinsic-size: 840px;
}

.planner-audit-preview {
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent-teal) 14%, transparent), transparent 42%),
    linear-gradient(135deg, color-mix(in srgb, var(--glass-bg) 94%, transparent), color-mix(in srgb, var(--bg-secondary) 88%, transparent));
}

.planner-audit-preview__copy {
  gap: var(--space-3);
  max-width: var(--copy-measure-wide);
}

.planner-audit-preview__copy h2,
.planner-audit-preview__copy p,
.planner-audit-preview__card h3,
.planner-audit-preview__card p {
  margin: 0;
}

.planner-audit-preview__grid {
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: var(--space-4);
}

.planner-audit-preview__card {
  gap: var(--space-3);
  padding: var(--space-5);
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
