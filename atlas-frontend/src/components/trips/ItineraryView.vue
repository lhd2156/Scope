<template>
  <section class="glass-panel itinerary-stage" data-test="itinerary-view">
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

      <header class="overlay-card summary-card">
        <div>
          <p class="eyebrow">AI itinerary</p>
          <h2>{{ displayedTitle }}</h2>
          <p class="summary-copy">
            {{ itinerary.destination }} · {{ itinerary.weatherForecast }}
          </p>
        </div>

        <div class="summary-metrics">
          <span class="summary-pill">{{ itinerary.days.length }} day{{ itinerary.days.length === 1 ? '' : 's' }}</span>
          <span class="summary-pill">{{ totalStops }} stops</span>
          <span class="summary-pill summary-pill--accent">{{ currencyFormatter.format(itinerary.totalEstimatedCost) }}</span>
        </div>
      </header>

      <aside v-if="previewMembers.length" class="overlay-card crew-card">
        <p class="eyebrow">Travelers</p>
        <div class="crew-stack">
          <div v-for="member in previewMembers" :key="member.id" class="crew-member">
            <LazyImage v-if="member.avatarUrl" :src="member.avatarUrl" :alt="member.displayName" class="crew-avatar" />
            <span v-else class="crew-avatar crew-avatar--fallback">{{ getInitials(member.displayName) }}</span>
          </div>
        </div>
        <div class="crew-copy">
          <strong>{{ members.length }} synced</strong>
          <span>{{ previewMembers.map((member) => member.displayName).join(', ') }}</span>
        </div>
        <button class="invite-button" type="button">+ Invite</button>
      </aside>

      <section class="overlay-card timeline-overlay">
        <header class="timeline-header">
          <div>
            <p class="eyebrow">Day by day</p>
            <h3>Timeline overlay</h3>
          </div>
          <span class="summary-pill">Avg {{ currencyFormatter.format(averageDailyCost) }}</span>
        </header>

        <div class="timeline-rail">
          <article v-for="day in itinerary.days" :key="day.dayNumber" class="timeline-card">
            <div class="timeline-media">
              <LazyImage :src="day.spots[0]?.photoUrl ?? ''" :alt="day.spots[0]?.title ?? `Day ${day.dayNumber}`" class="timeline-image" />
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

    <div v-else class="empty-state">
      <AtlasIcon name="sparkle" label="AI itinerary" />
      <div>
        <h2>No itinerary yet</h2>
        <p>Dial in the destination, dates, budget, pace, and route order to let Atlas lay out a premium travel plan.</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import MapView from '@/components/map/MapView.vue';
import { formatWeekdayMonthDay, getInitials } from '@/utils/formatters';
import type { Itinerary, ItineraryDay, MapPoint, TripMember } from '@/types';

const props = withDefaults(
  defineProps<{
    itinerary: Itinerary | null;
    tripTitle?: string;
    members?: TripMember[];
    submitting?: boolean;
  }>(),
  {
    tripTitle: '',
    members: () => [],
    submitting: false,
  },
);

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function getDayCost(day: ItineraryDay): number {
  return day.spots.reduce((total, spot) => total + (spot.estimatedCost ?? 0), 0);
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
const mapSpots = computed<MapPoint[]>(() =>
  props.itinerary?.days.flatMap((day) =>
    day.spots.map((spot) => ({
      id: `${day.dayNumber}-${spot.spotId}`,
      title: spot.title,
      latitude: spot.latitude,
      longitude: spot.longitude,
      category: spot.category,
      city: spot.city,
      photoUrl: spot.photoUrl,
    })),
  ) ?? [],
);
</script>

<style scoped>
.itinerary-stage {
  position: relative;
  min-height: 48rem;
  overflow: hidden;
  padding: 0;
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

.overlay-card,
.timeline-card,
.stop-list,
.stop-copy,
.crew-copy,
.empty-state {
  display: grid;
  gap: var(--space-3);
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

.eyebrow {
  margin: 0 0 var(--space-1);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

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

.summary-card h2,
.timeline-header h3,
.timeline-body h4,
.crew-copy strong,
.stop-copy strong {
  color: var(--text-primary);
}

.summary-copy,
.crew-copy span,
.stop-copy small,
.empty-state p {
  color: var(--text-secondary);
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
  width: 3rem;
  height: 3rem;
  border-radius: var(--radius-full);
  overflow: hidden;
  border: 2px solid var(--bg-primary);
  object-fit: cover;
  background: var(--bg-secondary);
}

.crew-avatar--fallback {
  display: grid;
  place-items: center;
  color: var(--accent-teal);
  font-weight: var(--font-weight-bold);
  background: var(--accent-teal-light);
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
  justify-items: center;
  padding: var(--space-8) var(--space-6);
  text-align: center;
}

.empty-state :deep(.atlas-icon) {
  width: 2.75rem;
  height: 2.75rem;
  color: var(--accent-teal);
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
  .stop-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .timeline-rail {
    grid-auto-columns: minmax(14rem, 78vw);
  }
}

@media (prefers-reduced-motion: reduce) {
  .invite-button,
  .timeline-card,
  .timeline-image {
    transition: none;
  }

  .invite-button:hover,
  .invite-button:focus-visible,
  .timeline-card:hover,
  .timeline-card:focus-within,
  .timeline-card:hover .timeline-image,
  .timeline-card:focus-within .timeline-image,
  .loading-card {
    transform: none;
  }
}
</style>
