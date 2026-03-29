<template>
  <section class="glass-panel itinerary-shell" data-test="itinerary-view">
    <template v-if="itinerary">
      <header class="summary-header">
        <div>
          <p class="eyebrow">AI itinerary</p>
          <h2>{{ itinerary.destination }}</h2>
          <p class="summary-copy">
            Atlas sequenced these stops by momentum, interest match, and route density so the day keeps flowing.
          </p>
        </div>

        <div class="hero-pills">
          <span class="hero-pill hero-pill--weather">{{ itinerary.weatherForecast }}</span>
          <span class="hero-pill">{{ totalStops }} stops</span>
        </div>
      </header>

      <div class="stats-grid">
        <article class="surface-card stat-card">
          <small>Total spend</small>
          <strong>{{ currencyFormatter.format(itinerary.totalEstimatedCost) }}</strong>
        </article>
        <article class="surface-card stat-card">
          <small>Trip length</small>
          <strong>{{ itinerary.days.length }} day{{ itinerary.days.length === 1 ? '' : 's' }}</strong>
        </article>
        <article class="surface-card stat-card">
          <small>Avg daily spend</small>
          <strong>{{ currencyFormatter.format(averageDailyCost) }}</strong>
        </article>
      </div>

      <div class="content-grid">
        <section class="surface-card route-panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Route preview</p>
              <h3>Map the generated path</h3>
            </div>
            <span class="meta-pill">{{ itinerary.days.length }} day{{ itinerary.days.length === 1 ? '' : 's' }}</span>
          </div>

          <div class="map-shell">
            <MapView :spots="mapSpots" :route-points="mapSpots" :show-location-tracker="false" />
          </div>
        </section>

        <section class="days-panel">
          <article v-for="day in itinerary.days" :key="day.dayNumber" class="surface-card day-card">
            <header class="day-header">
              <div>
                <span class="day-pill">Day {{ day.dayNumber }}</span>
                <h3>{{ formatDate(day.date) }}</h3>
              </div>
              <div class="day-metrics">
                <span>{{ day.spots.length }} stop{{ day.spots.length === 1 ? '' : 's' }}</span>
                <span>{{ currencyFormatter.format(getDayCost(day)) }}</span>
              </div>
            </header>

            <ol class="stop-list">
              <li v-for="spot in day.spots" :key="`${day.dayNumber}-${spot.spotId}`" class="stop-item">
                <div class="time-pill">{{ spot.timeSlot ?? 'Flexible' }}</div>
                <div class="stop-body">
                  <div class="stop-heading">
                    <strong>{{ spot.title }}</strong>
                    <span class="badge" :class="`badge-${spot.category}`">{{ formatCategory(spot.category) }}</span>
                  </div>
                  <p class="stop-meta">
                    {{ spot.city || 'Atlas city' }} · {{ spot.duration ?? 60 }} min · {{ currencyFormatter.format(spot.estimatedCost ?? 0) }}
                  </p>
                  <p v-if="spot.notes" class="stop-notes">{{ spot.notes }}</p>
                </div>
              </li>
            </ol>
          </article>
        </section>
      </div>
    </template>

    <div v-else class="empty-state">
      <AtlasIcon name="sparkle" label="AI itinerary" />
      <div>
        <h2>No itinerary yet</h2>
        <p>Dial in the destination, dates, budget, pace, and interests to let Atlas lay out a route.</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import MapView from '@/components/map/MapView.vue';
import type { Itinerary, ItineraryDay, MapPoint, SpotCategory } from '@/types';

const props = defineProps<{
  itinerary: Itinerary | null;
}>();

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatCategory(category: SpotCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(value));
}

function getDayCost(day: ItineraryDay): number {
  return day.spots.reduce((total, spot) => total + (spot.estimatedCost ?? 0), 0);
}

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
.itinerary-shell {
  display: grid;
  gap: var(--space-5);
  padding: var(--space-6);
}

.summary-header,
.panel-heading,
.day-header,
.stop-heading,
.stop-item,
.empty-state {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
}

.summary-header {
  align-items: flex-start;
}

.eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.summary-header h2,
.panel-heading h3,
.day-header h3,
.summary-copy,
.stop-meta,
.stop-notes,
.empty-state h2,
.empty-state p,
.stat-card small,
.stat-card strong {
  margin: 0;
}

.summary-copy,
.stop-meta,
.stop-notes,
.empty-state p,
.day-metrics,
.stat-card small {
  color: var(--text-secondary);
}

.hero-pills,
.day-metrics,
.stats-grid,
.days-panel,
.stop-list {
  display: grid;
  gap: var(--space-3);
}

.hero-pills {
  grid-auto-flow: row;
  justify-items: end;
}

.hero-pill,
.meta-pill,
.day-pill,
.time-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  padding: 0.55rem 0.85rem;
  font-size: var(--font-size-small);
}

.hero-pill,
.meta-pill,
.day-pill {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: var(--glass-blur);
}

.hero-pill--weather {
  color: var(--accent-gold);
}

.stats-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.stat-card,
.route-panel,
.day-card {
  padding: var(--space-4);
}

.stat-card {
  display: grid;
  gap: var(--space-2);
}

.stat-card strong {
  color: var(--text-primary);
  font-size: var(--font-size-h3);
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
  gap: var(--space-5);
}

.route-panel,
.days-panel,
.day-card {
  display: grid;
  gap: var(--space-4);
}

.panel-heading {
  align-items: flex-start;
}

.map-shell {
  min-height: 22rem;
  overflow: hidden;
  border-radius: var(--radius-xl);
}

.map-shell :deep(.map-view) {
  min-height: 22rem;
  border-radius: var(--radius-xl);
}

.map-shell :deep(.map-summary),
.map-shell :deep(.map-controls),
.map-shell :deep(.tracker-overlay) {
  display: none;
}

.day-card {
  background: var(--bg-secondary);
}

.day-header {
  align-items: flex-start;
}

.day-metrics {
  text-align: right;
  font-size: var(--font-size-small);
}

.stop-list {
  list-style: none;
  padding: 0;
}

.stop-item {
  align-items: flex-start;
}

.time-pill {
  min-width: 4.75rem;
  background: var(--accent-teal-light);
  color: var(--accent-teal);
  font-weight: var(--font-weight-semibold);
}

.stop-body {
  display: grid;
  gap: var(--space-2);
  flex: 1;
}

.stop-heading {
  align-items: center;
}

.stop-heading strong {
  color: var(--text-primary);
}

.stop-meta,
.stop-notes {
  line-height: var(--line-height-relaxed);
}

.empty-state {
  align-items: center;
  justify-content: center;
  padding: var(--space-8) var(--space-6);
  text-align: center;
  flex-direction: column;
}

.empty-state :deep(.atlas-icon) {
  width: 2.5rem;
  height: 2.5rem;
  color: var(--accent-teal);
}

@media (max-width: 1100px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 780px) {
  .itinerary-shell {
    padding: var(--space-5);
  }

  .summary-header,
  .panel-heading,
  .day-header,
  .stop-heading,
  .stop-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .hero-pills {
    justify-items: start;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .day-metrics {
    text-align: left;
  }
}
</style>
