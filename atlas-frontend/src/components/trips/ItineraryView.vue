<template>
  <section
    class="glass-panel itinerary-stage"
    data-test="itinerary-view"
    :data-itinerary-mode="mobileWizard ? 'mobile-wizard' : 'desktop'"
  >
    <div class="itinerary-step-shell" :data-step-state="getWizardStepState(4)">
      <button
        v-if="mobileWizard"
        type="button"
        class="itinerary-step-toggle"
        data-test="planner-step-4-toggle"
        :aria-expanded="String(isWizardStepActive(4))"
        aria-controls="planner-step-4-content"
        @click="emitWizardStepChange(4)"
      >
        <span class="itinerary-step-toggle__index">4</span>
        <span class="itinerary-step-toggle__copy">
          <span class="eyebrow">Step 4</span>
          <strong>AI preview</strong>
          <span>{{ stepSummary }}</span>
        </span>
        <span class="itinerary-step-toggle__state">{{ getWizardStepLabel(4) }}</span>
      </button>

      <div
        id="planner-step-4-content"
        class="itinerary-step-content"
        data-test="planner-step-4-content"
        v-show="!mobileWizard || isWizardStepActive(4)"
      >
        <template v-if="itinerary">
          <div class="map-shell">
            <MapView
              :spots="mapSpots"
              :route-points="mapSpots"
              :show-location-tracker="false"
              :show-summary="false"
              :show-controls="false"
              marker-variant="sequence"
              route-variant="planner"
            />
            <div class="map-vignette" />
          </div>

          <header class="overlay-card summary-card" data-test="itinerary-summary-card">
            <div>
              <p class="eyebrow">AI itinerary</p>
              <h2>{{ displayedTitle }}</h2>
              <p class="summary-copy">
                {{ itinerary.destination }} · {{ itinerary.weatherForecast }}
              </p>
            </div>

            <div class="summary-metrics">
              <span class="summary-pill" data-test="itinerary-summary-days">{{ itinerary.days.length }} day{{ itinerary.days.length === 1 ? '' : 's' }}</span>
              <span class="summary-pill" data-test="itinerary-summary-stops">{{ totalStops }} stops</span>
              <span class="summary-pill summary-pill--accent" data-test="itinerary-summary-cost">{{ currencyFormatter.format(itinerary.totalEstimatedCost) }}</span>
            </div>
          </header>

          <aside v-if="previewMembers.length" class="overlay-card crew-card">
            <p class="eyebrow">Travelers</p>
            <div class="crew-stack">
              <div v-for="member in previewMembers" :key="member.id" class="crew-member">
                <Avatar :name="member.displayName" :src="member.avatarUrl" :size="48" class="crew-avatar" />
              </div>
            </div>
            <div class="crew-copy">
              <strong>{{ members.length }} synced</strong>
              <span>{{ previewMembers.map((member) => member.displayName).join(', ') }}</span>
            </div>
            <button class="invite-button" type="button">+ Invite</button>
          </aside>

          <section class="overlay-card timeline-overlay" data-test="itinerary-timeline-overlay">
            <header class="timeline-header">
              <div>
                <p class="eyebrow">Day by day</p>
                <h3>Timeline overlay</h3>
              </div>
              <span class="summary-pill">Avg {{ currencyFormatter.format(averageDailyCost) }}</span>
            </header>

            <div class="timeline-rail">
              <article v-for="day in itinerary.days" :key="day.dayNumber" class="timeline-card" data-test="itinerary-day-card">
                <div class="timeline-media">
                  <LazyImage
                    :src="resolveDayImage(day)"
                    :fallback-src="resolveDayImageFallback(day)"
                    :alt="day.spots[0]?.title ?? `Day ${day.dayNumber}`"
                    class="timeline-image"
                  />
                  <div class="timeline-media__overlay">
                    <span class="day-pill">Day {{ day.dayNumber }}</span>
                    <span class="timeline-cost">{{ currencyFormatter.format(getDayCost(day)) }}</span>
                  </div>
                </div>

                <div class="timeline-body">
                  <h4>{{ formatWeekdayMonthDay(day.date) }}</h4>
                  <ol class="stop-list">
                    <li v-for="spot in day.spots" :key="`${day.dayNumber}-${spot.spotId}`" class="stop-item">
                      <span class="time-pill">{{ spot.timeSlot ?? 'Flexible' }}</span>
                      <div class="stop-copy">
                        <strong>{{ spot.title }}</strong>
                        <small>
                          {{ spot.city || 'Atlas destination' }} · {{ currencyFormatter.format(spot.estimatedCost ?? 0) }}
                        </small>
                      </div>
                    </li>
                  </ol>
                </div>
              </article>
            </div>
          </section>

          <div v-if="submitting" class="overlay-card loading-card">Refreshing itinerary preview…</div>
        </template>

        <EmptyStatePanel
          v-else
          class="empty-state"
          alignment="center"
          eyebrow="AI itinerary"
          title="No itinerary yet"
          description="Dial in the destination, dates, budget, pace, and route order to let Atlas lay out a premium travel plan."
          icon="sparkle"
          artwork="itinerary"
          heading-level="h2"
        />

        <div v-if="mobileWizard" class="itinerary-step-actions">
          <button type="button" class="button button-secondary" data-test="planner-step-4-back" @click="emitWizardStepChange(3)">
            Adjust planner details
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Avatar from '@/components/common/Avatar.vue';
import EmptyStatePanel from '@/components/common/EmptyStatePanel.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import MapView from '@/components/map/MapView.vue';
import { formatWeekdayMonthDay } from '@/utils/formatters';
import type { Itinerary, ItineraryDay, MapPoint, TripMember } from '@/types';
import { getSpotPhotoFallback, resolveTripStopPhotoUrl } from '@/utils/demoPhotos';

type PlannerWizardStep = 1 | 2 | 3 | 4;

const props = withDefaults(
  defineProps<{
    itinerary: Itinerary | null;
    tripTitle?: string;
    members?: TripMember[];
    submitting?: boolean;
    mobileWizard?: boolean;
    mobileActiveStep?: PlannerWizardStep;
  }>(),
  {
    tripTitle: '',
    members: () => [],
    submitting: false,
    mobileWizard: false,
    mobileActiveStep: 4 as PlannerWizardStep,
  },
);

const emit = defineEmits<{
  (event: 'wizard-step-change', payload: PlannerWizardStep): void;
}>();

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function clampWizardStep(step: number): PlannerWizardStep {
  if (step <= 1) {
    return 1;
  }

  if (step >= 4) {
    return 4;
  }

  return step as PlannerWizardStep;
}

function isWizardStepActive(step: PlannerWizardStep): boolean {
  return !props.mobileWizard || props.mobileActiveStep === step;
}

function getWizardStepState(step: PlannerWizardStep): 'desktop' | 'current' | 'complete' | 'upcoming' {
  if (!props.mobileWizard) {
    return 'desktop';
  }

  if (props.mobileActiveStep === step) {
    return 'current';
  }

  return props.mobileActiveStep > step ? 'complete' : 'upcoming';
}

function getWizardStepLabel(step: PlannerWizardStep): string {
  const stepState = getWizardStepState(step);

  switch (stepState) {
    case 'complete':
      return 'Done';
    case 'current':
      return 'Current';
    case 'upcoming':
      return 'Preview';
    default:
      return '';
  }
}

function emitWizardStepChange(step: number): void {
  if (!props.mobileWizard) {
    return;
  }

  emit('wizard-step-change', clampWizardStep(step));
}

function getDayCost(day: ItineraryDay): number {
  return day.spots.reduce((total, spot) => total + (spot.estimatedCost ?? 0), 0);
}

function resolveDayImageFallback(day: ItineraryDay): string {
  return getSpotPhotoFallback(day.spots[0]?.category ?? 'scenic', 1200);
}

function resolveDayImage(day: ItineraryDay): string {
  const leadSpot = day.spots[0];

  if (!leadSpot) {
    return resolveDayImageFallback(day);
  }

  return resolveTripStopPhotoUrl(leadSpot, 1200);
}

const displayedTitle = computed(() => props.tripTitle.trim() || props.itinerary?.destination || 'AI itinerary');
const previewMembers = computed(() => props.members.slice(0, 3));
const totalStops = computed(() => props.itinerary?.days.reduce((total, day) => total + day.spots.length, 0) ?? 0);
const averageDailyCost = computed(() => {
  if (!props.itinerary || props.itinerary.days.length === 0) {
    return 0;
  }

  return props.itinerary.totalEstimatedCost / props.itinerary.days.length;
});
const stepSummary = computed(() => {
  if (!props.itinerary) {
    return 'Generate the route to unlock a live preview.';
  }

  return `${props.itinerary.days.length} day${props.itinerary.days.length === 1 ? '' : 's'} · ${totalStops.value} stop${totalStops.value === 1 ? '' : 's'}`;
});
const mapSpots = computed<MapPoint[]>(() =>
  props.itinerary?.days.flatMap((day) =>
    day.spots.map((spot) => ({
      id: `${day.dayNumber}-${spot.spotId}`,
      title: spot.title,
      latitude: spot.latitude,
      longitude: spot.longitude,
      category: spot.category,
      city: spot.city,
      photoUrl: resolveTripStopPhotoUrl(spot, 1200),
    })),
  ) ?? [],
);
</script>

<style scoped>
.itinerary-stage,
.overlay-card,
.timeline-card,
.stop-list,
.stop-copy,
.crew-copy,
.empty-state,
.itinerary-step-shell,
.itinerary-step-content,
.itinerary-step-toggle__copy,
.itinerary-step-actions {
  display: grid;
  gap: var(--space-3);
}

.itinerary-stage {
  position: relative;
  min-height: 48rem;
  overflow: hidden;
  padding: 0;
}

.itinerary-stage[data-itinerary-mode='mobile-wizard'] {
  min-height: auto;
  overflow: visible;
  padding: var(--space-4);
}

.map-shell,
.map-shell :deep(.map-view) {
  min-height: 48rem;
  height: 100%;
}

.map-shell :deep(.map-view) {
  border-radius: var(--radius-2xl);
}

.map-shell :deep(.spot-marker__label) {
  display: none;
}

.map-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(180deg, var(--bg-primary), transparent 22%, transparent 64%, var(--bg-primary)),
    linear-gradient(90deg, var(--bg-primary), transparent 22%, transparent 72%, var(--bg-primary));
  opacity: 0.72;
}

.itinerary-step-toggle {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: flex-start;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-2xl);
  background: color-mix(in srgb, var(--glass-bg) 94%, transparent);
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    background var(--transition-fast);
}

.itinerary-step-toggle:hover,
.itinerary-step-toggle:focus-visible {
  transform: translateY(var(--motion-card-lift));
  border-color: var(--border-hover);
  box-shadow: var(--shadow-md);
  outline: none;
}

.itinerary-step-shell[data-step-state='current'] .itinerary-step-toggle {
  border-color: var(--accent-teal);
  background: color-mix(in srgb, var(--accent-teal) 12%, var(--glass-bg));
  box-shadow: var(--shadow-glow-teal);
}

.itinerary-step-shell[data-step-state='complete'] .itinerary-step-toggle {
  border-color: color-mix(in srgb, var(--accent-teal) 34%, var(--glass-border));
}

.itinerary-step-toggle__index {
  width: 2.4rem;
  height: 2.4rem;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 20%, var(--bg-primary));
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
}

.itinerary-step-toggle__copy {
  flex: 1;
  min-width: 0;
  gap: var(--space-1);
}

.itinerary-step-toggle__copy strong,
.itinerary-step-toggle__copy span,
.itinerary-step-toggle__state,
.summary-card h2,
.timeline-header h3,
.timeline-body h4,
.summary-copy,
.crew-copy strong,
.crew-copy span,
.empty-state h2,
.empty-state p {
  margin: 0;
}

.eyebrow {
  margin: 0 0 var(--space-1);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.itinerary-step-toggle__copy > span:last-child,
.itinerary-step-toggle__state,
.summary-copy,
.crew-copy span,
.stop-copy small,
.empty-state p {
  color: var(--text-secondary);
}

.itinerary-step-toggle__copy strong,
.summary-card h2,
.timeline-header h3,
.timeline-body h4,
.crew-copy strong,
.stop-copy strong {
  color: var(--text-primary);
}

.itinerary-step-toggle__state {
  align-self: center;
  white-space: nowrap;
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.itinerary-step-shell[data-step-state='complete'] .itinerary-step-toggle__state,
.itinerary-step-shell[data-step-state='current'] .itinerary-step-toggle__state {
  color: var(--accent-teal);
}

.overlay-card {
  position: absolute;
  background: linear-gradient(180deg, var(--glass-bg), var(--bg-secondary));
  border: 1px solid var(--glass-border);
  backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-lg);
  border-radius: var(--radius-2xl);
}

.summary-card {
  top: var(--space-6);
  left: var(--space-6);
  width: min(30rem, calc(100% - 3rem));
  padding: var(--space-5);
}

.crew-card {
  top: var(--space-6);
  right: var(--space-6);
  width: min(16rem, calc(100% - 3rem));
  padding: var(--space-4);
}

.timeline-overlay {
  right: var(--space-6);
  bottom: var(--space-6);
  width: min(46rem, calc(100% - 3rem));
  padding: var(--space-4);
}

.loading-card {
  top: var(--space-6);
  left: 50%;
  transform: translateX(-50%);
  padding: 0.8rem 1rem;
  color: var(--text-primary);
}

.summary-metrics,
.crew-stack,
.timeline-header,
.timeline-media__overlay,
.stop-item {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  align-items: center;
}

.summary-metrics {
  margin-top: var(--space-4);
  flex-wrap: wrap;
}

.summary-pill,
.day-pill,
.time-pill,
.timeline-cost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  padding: 0.55rem 0.85rem;
  font-size: var(--font-size-small);
}

.summary-pill,
.day-pill {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
}

.summary-pill--accent,
.timeline-cost {
  background: var(--accent-teal);
  color: var(--bg-primary);
  box-shadow: var(--shadow-glow-teal);
}

.crew-stack {
  justify-content: flex-start;
}

.crew-member + .crew-member {
  margin-left: -0.65rem;
}

.crew-avatar {
  border-radius: var(--radius-full);
}

.crew-avatar :deep(img),
.crew-avatar :deep(.lazy-image) {
  border: 2px solid var(--bg-primary);
}

.invite-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0.85rem 1rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-primary);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);
}

.invite-button:hover,
.invite-button:focus-visible {
  transform: translateY(-0.125rem);
  box-shadow: var(--shadow-md), var(--shadow-glow-teal);
  border-color: var(--accent-teal);
  outline: none;
}

.timeline-rail {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(15rem, 1fr);
  gap: var(--space-4);
  overflow-x: auto;
  padding-bottom: var(--space-2);
  scroll-snap-type: x proximity;
}

.timeline-card {
  min-width: 0;
  background: linear-gradient(180deg, var(--glass-bg), var(--bg-secondary));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
  scroll-snap-align: start;
}

.timeline-card:hover,
.timeline-card:focus-within {
  transform: translateY(-0.125rem);
  box-shadow: var(--shadow-lg), var(--shadow-glow-teal);
}

.timeline-media {
  position: relative;
  overflow: hidden;
  min-height: 8.5rem;
}

.timeline-image {
  width: 100%;
  height: 100%;
  min-height: 8.5rem;
  object-fit: cover;
  transition: transform var(--transition-slow);
}

.timeline-card:hover .timeline-image,
.timeline-card:focus-within .timeline-image {
  transform: scale(1.05);
}

.timeline-media__overlay {
  position: absolute;
  inset: auto var(--space-3) var(--space-3) var(--space-3);
}

.timeline-body {
  padding: var(--space-4);
  display: grid;
  gap: var(--space-3);
}

.stop-list {
  list-style: none;
  padding: 0;
}

.stop-item {
  align-items: flex-start;
}

.time-pill {
  min-width: 4.85rem;
  background: var(--accent-teal-light);
  color: var(--accent-teal);
  font-weight: var(--font-weight-semibold);
}

.stop-copy {
  flex: 1;
}

.empty-state {
  min-height: 34rem;
  place-content: center;
}

.itinerary-step-actions .button {
  width: 100%;
}

@media (max-width: 1080px) {
  .summary-card,
  .crew-card,
  .timeline-overlay,
  .loading-card {
    position: static;
    width: auto;
    margin: var(--space-4);
  }

  .loading-card {
    transform: none;
    margin-top: 0;
  }

  .itinerary-stage {
    padding-bottom: var(--space-4);
  }

  .map-vignette {
    background: linear-gradient(180deg, var(--bg-primary), transparent 18%, transparent 82%, var(--bg-primary));
  }
}

@media (max-width: 720px) {
  .itinerary-stage,
  .map-shell,
  .map-shell :deep(.map-view) {
    min-height: 36rem;
  }

  .timeline-header,
  .summary-metrics,
  .stop-item,
  .itinerary-step-toggle {
    flex-direction: column;
    align-items: flex-start;
  }

  .timeline-rail {
    grid-auto-columns: minmax(14rem, 78vw);
  }
}

@media (max-width: 640px) {
  .itinerary-stage[data-itinerary-mode='mobile-wizard'] {
    padding: var(--space-4);
    border-radius: var(--radius-xl);
  }

  .itinerary-stage[data-itinerary-mode='mobile-wizard'] .map-shell,
  .itinerary-stage[data-itinerary-mode='mobile-wizard'] .map-shell :deep(.map-view) {
    min-height: 20rem;
  }

  .itinerary-stage[data-itinerary-mode='mobile-wizard'] :is(.summary-card, .crew-card, .timeline-overlay, .loading-card) {
    margin: 0;
  }

  .itinerary-stage[data-itinerary-mode='mobile-wizard'] .timeline-rail {
    grid-auto-columns: minmax(14rem, 82vw);
  }

  .itinerary-stage[data-itinerary-mode='mobile-wizard'] .empty-state {
    min-height: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .invite-button,
  .timeline-card,
  .timeline-image,
  .itinerary-step-toggle {
    transition: none;
  }

  .invite-button:hover,
  .invite-button:focus-visible,
  .timeline-card:hover,
  .timeline-card:focus-within,
  .timeline-card:hover .timeline-image,
  .timeline-card:focus-within .timeline-image,
  .loading-card,
  .itinerary-step-toggle:hover,
  .itinerary-step-toggle:focus-visible {
    transform: none;
  }
}
</style>
