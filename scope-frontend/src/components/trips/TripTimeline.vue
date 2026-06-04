<template>
  <section class="timeline-shell" data-test="trip-timeline">
    <header class="timeline-header">
      <div>
        <p class="eyebrow">Timeline</p>
        <h2>{{ title }}</h2>
      </div>
      <span class="meta-pill">{{ totalStops }} stops</span>
    </header>

    <div v-if="itinerary?.days.length" class="timeline-days">
      <article v-for="day in itinerary.days" :key="day.dayNumber" class="surface-card day-card">
        <div class="day-rail">
          <span class="day-badge">Day {{ day.dayNumber }}</span>
          <strong>{{ formatDate(day.date) }}</strong>
          <span>{{ currencyFormatter.format(getDayCost(day)) }}</span>
        </div>

        <ol class="stop-list">
          <li v-for="spot in day.spots" :key="`${day.dayNumber}-${spot.spotId}`" class="stop-card">
            <div class="time-pill">{{ spot.timeSlot ?? 'Flexible' }}</div>
            <div class="stop-copy">
              <div class="stop-heading">
                <strong>{{ spot.title }}</strong>
                <span class="badge" :class="`badge-${spot.category}`">{{ formatCategory(spot.category) }}</span>
              </div>
              <p class="stop-meta">
                {{ spot.city || 'Scope city' }} · {{ spot.duration ?? 60 }} min · {{ currencyFormatter.format(spot.estimatedCost ?? 0) }}
              </p>
              <p v-if="spot.notes" class="stop-notes">{{ spot.notes }}</p>
            </div>
          </li>
        </ol>
      </article>
    </div>

    <p v-else class="empty-copy">Trip stops will populate here once Scope sequences the route.</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Itinerary, ItineraryDay, SpotCategory } from '@/types';
import { formatWeekdayMonthDay } from '@/utils/formatters';

const props = withDefaults(
  defineProps<{
    itinerary: Itinerary | null;
    title?: string;
  }>(),
  {
    title: 'Daily route breakdown',
  },
);

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatCategory(category: SpotCategory | undefined): string {
  const resolvedCategory = category || 'other';
  return resolvedCategory.charAt(0).toUpperCase() + resolvedCategory.slice(1);
}

function formatDate(value: string): string {
  return formatWeekdayMonthDay(value);
}

function getDayCost(day: ItineraryDay): number {
  return day.spots.reduce((total, spot) => total + (spot.estimatedCost ?? 0), 0);
}

const totalStops = computed(() => props.itinerary?.days.reduce((total, day) => total + day.spots.length, 0) ?? 0);
</script>

<style scoped>
.timeline-shell,
.timeline-days,
.day-card,
.stop-list,
.stop-copy {
  display: grid;
  gap: var(--space-4);
}

.timeline-header,
.stop-heading,
.stop-card {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
}

.timeline-header {
  align-items: flex-start;
}

.eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.timeline-header h2,
.day-rail strong,
.day-rail span,
.stop-meta,
.stop-notes,
.empty-copy {
  margin: 0;
}

.meta-pill,
.day-badge,
.time-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  padding: 0.55rem 0.85rem;
  font-size: var(--font-size-small);
}

.meta-pill,
.day-badge {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: var(--glass-blur);
}

.day-card {
  grid-template-columns: minmax(11rem, 12rem) minmax(0, 1fr);
  padding: var(--space-4);
}

.day-rail {
  display: grid;
  align-content: start;
  gap: var(--space-2);
}

.day-rail strong {
  color: var(--text-primary);
}

.day-rail span,
.stop-meta,
.stop-notes,
.empty-copy {
  color: var(--text-secondary);
}

.stop-list {
  list-style: none;
  padding: 0;
}

.stop-card {
  align-items: flex-start;
}

.time-pill {
  min-width: 4.75rem;
  background: var(--accent-teal-light);
  color: var(--accent-teal);
  font-weight: var(--font-weight-semibold);
}

.stop-heading {
  align-items: center;
}

.stop-copy {
  flex: 1;
}

.stop-copy strong {
  color: var(--text-primary);
}

.stop-meta,
.stop-notes {
  line-height: var(--line-height-relaxed);
}

.empty-copy {
  padding: var(--space-4) 0 0;
}

@media (max-width: 900px) {
  .day-card {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .timeline-header,
  .stop-heading,
  .stop-card {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
