<template>
  <section class="glass-panel itinerary-view">
    <header class="itinerary-view__header">
      <div>
        <p class="eyebrow">AI itinerary</p>
        <h2>{{ heading }}</h2>
        <p class="section-copy">{{ subtitle }}</p>
      </div>

      <div class="itinerary-view__stats">
        <article class="surface-card stat-card">
          <small>Total cost</small>
          <strong>${{ totalCost.toFixed(0) }}</strong>
        </article>
        <article class="surface-card stat-card">
          <small>Stops</small>
          <strong>{{ totalStops }}</strong>
        </article>
        <article class="surface-card stat-card">
          <small>Weather</small>
          <strong>{{ weatherLabel }}</strong>
        </article>
      </div>
    </header>

    <div v-if="itinerary" class="itinerary-view__grid">
      <section class="surface-card route-panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Route preview</p>
            <h3>Theme-aware map route</h3>
          </div>
          <span class="meta-pill">{{ routePoints.length }} route point{{ routePoints.length === 1 ? '' : 's' }}</span>
        </div>

        <div class="route-map" data-test="itinerary-map">
          <MapView :spots="routePoints" :route-points="routePoints" :show-location-tracker="false" />
        </div>
      </section>

      <section class="surface-card breakdown-panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Cost breakdown</p>
            <h3>Spend by day</h3>
          </div>
        </div>

        <div class="breakdown-list">
          <article v-for="day in dayBreakdown" :key="day.dayNumber" class="breakdown-card">
            <div>
              <strong>Day {{ day.dayNumber }}</strong>
              <p>{{ formatDate(day.date) }}</p>
            </div>
            <span>${{ day.cost.toFixed(0) }}</span>
          </article>
        </div>
      </section>
    </div>
    <section v-else class="surface-card itinerary-empty">
      <AtlasIcon name="sparkle" label="AI itinerary pending" />
      <div>
        <strong>No itinerary yet</strong>
        <p>Submit the planner to let Atlas generate a route, cost estimate, and sequencing preview.</p>
      </div>
    </section>

    <div v-if="itinerary" class="day-list">
      <article v-for="day in itinerary.days" :key="day.dayNumber" class="surface-card day-card">
        <header class="day-card__header">
          <div>
            <strong>Day {{ day.dayNumber }}</strong>
            <p>{{ formatDate(day.date) }}</p>
          </div>
          <span class="meta-pill">${{ calculateDayCost(day).toFixed(0) }}</span>
        </header>

        <ul class="day-card__stops">
          <li v-for="spot in day.spots" :key="`${day.dayNumber}-${spot.spotId}`">
            <div>
              <strong>{{ spot.title }}</strong>
              <p>{{ spot.city || formatCategory(spot.category) }} · {{ spot.duration ?? 90 }} min</p>
            </div>
            <span>{{ spot.timeSlot || 'Flexible' }}</span>
          </li>
        </ul>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import MapView from '@/components/map/MapView.vue';
import type { Itinerary, ItineraryDay, MapPoint } from '@/types';

const props = defineProps<{
  itinerary: Itinerary | null;
}>();

const heading = computed(() => props.itinerary?.destination ?? 'Itinerary preview');
const subtitle = computed(() => props.itinerary?.days.length
  ? `Atlas sequenced ${totalStops.value} stops across ${props.itinerary.days.length} day${props.itinerary.days.length === 1 ? '' : 's'}.`
  : 'Generate a route to see sequencing, route geometry, and cost breakdown.');
const totalCost = computed(() => props.itinerary?.totalEstimatedCost ?? 0);
const totalStops = computed(() => props.itinerary?.days.reduce((total, day) => total + day.spots.length, 0) ?? 0);
const weatherLabel = computed(() => props.itinerary?.weatherForecast ?? 'Pending');
const routePoints = computed<MapPoint[]>(() => (props.itinerary?.days ?? []).flatMap((day) => day.spots).map((spot) => ({
  id: spot.spotId,
  title: spot.title,
  latitude: spot.latitude,
  longitude: spot.longitude,
  category: spot.category,
  ...(spot.city ? { city: spot.city } : {}),
  ...(spot.photoUrl ? { photoUrl: spot.photoUrl } : {}),
})));
const dayBreakdown = computed(() => (props.itinerary?.days ?? []).map((day) => ({
  dayNumber: day.dayNumber,
  date: day.date,
  cost: calculateDayCost(day),
})));

function calculateDayCost(day: ItineraryDay): number {
  return day.spots.reduce((total, spot) => total + (spot.estimatedCost ?? 0), 0);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function formatCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}
</script>

<style scoped>
.itinerary-view {
  padding: var(--space-6);
  display: grid;
  gap: var(--space-6);
}

.itinerary-view__header,
.itinerary-view__grid,
.itinerary-view__stats,
.panel-heading,
.day-card__header,
.day-card__stops li,
.breakdown-card {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
}

.itinerary-view__header {
  align-items: flex-start;
}

.eyebrow {
  margin: 0 0 var(--space-1);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.itinerary-view__header h2,
.panel-heading h3,
.stat-card small,
.stat-card strong,
.breakdown-card p,
.day-card__header p,
.day-card__stops p {
  margin: 0;
}

.itinerary-view__stats {
  flex-wrap: wrap;
}

.stat-card,
.route-panel,
.breakdown-panel,
.day-card,
.itinerary-empty {
  padding: var(--space-5);
}

.stat-card {
  min-width: 8rem;
  display: grid;
  gap: var(--space-2);
}

.stat-card small,
.breakdown-card p,
.day-card__header p,
.day-card__stops p,
.section-copy {
  color: var(--text-secondary);
}

.itinerary-view__grid {
  align-items: stretch;
}

.route-panel {
  flex: 1.2;
  display: grid;
  gap: var(--space-4);
}

.breakdown-panel {
  flex: 0.8;
  display: grid;
  gap: var(--space-4);
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0.8rem;
  border-radius: var(--radius-full);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  font-size: var(--font-size-small);
}

.route-map {
  min-height: 22rem;
  overflow: hidden;
  border-radius: var(--radius-xl);
}

.route-map :deep(.map-view) {
  min-height: 22rem;
}

.breakdown-list,
.day-list,
.day-card__stops {
  display: grid;
  gap: var(--space-3);
}

.breakdown-card {
  align-items: center;
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  background: var(--bg-primary);
}

.itinerary-empty {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.itinerary-empty strong,
.itinerary-empty p {
  margin: 0;
}

.itinerary-empty p {
  color: var(--text-secondary);
}

.itinerary-empty :deep(.atlas-icon) {
  width: 1.5rem;
  height: 1.5rem;
  color: var(--accent-gold);
}

.day-card__header {
  align-items: flex-start;
}

.day-card__stops {
  list-style: none;
  padding: 0;
  margin: var(--space-4) 0 0;
}

.day-card__stops li {
  align-items: center;
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  background: var(--bg-primary);
}

@media (max-width: 1024px) {
  .itinerary-view__header,
  .itinerary-view__grid {
    flex-direction: column;
  }
}

@media (max-width: 720px) {
  .itinerary-view {
    padding: var(--space-5);
  }

  .day-card__header,
  .day-card__stops li,
  .breakdown-card {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
