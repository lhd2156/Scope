<template>
  <section class="trip-timeline glass-panel">
    <header class="trip-timeline__header">
      <div>
        <p class="eyebrow">Timeline</p>
        <h2>{{ timelineDays.length }} planned day{{ timelineDays.length === 1 ? '' : 's' }}</h2>
      </div>
      <span class="timeline-hint">Stop ordering follows the itinerary sequence.</span>
    </header>

    <div class="timeline-days">
      <article v-for="day in timelineDays" :key="day.dayNumber" class="timeline-day surface-card">
        <header class="timeline-day__header">
          <div>
            <strong>Day {{ day.dayNumber }}</strong>
            <p>{{ formatDate(day.date) }}</p>
          </div>
          <span class="timeline-count">{{ day.spots.length }} stop{{ day.spots.length === 1 ? '' : 's' }}</span>
        </header>

        <ol class="timeline-stops">
          <li v-for="stop in day.spots" :key="`${day.dayNumber}-${stop.spotId}`" class="timeline-stop">
            <div class="timeline-stop__rail">
              <span class="timeline-stop__dot" />
              <span class="timeline-stop__line" />
            </div>

            <div class="timeline-stop__card">
              <div class="timeline-stop__topline">
                <span class="time-pill">{{ stop.timeSlot || 'Flexible' }}</span>
                <span class="badge" :class="`badge-${stop.category}`">{{ formatCategory(stop.category) }}</span>
              </div>

              <div class="timeline-stop__content">
                <div>
                  <strong>{{ stop.title }}</strong>
                  <p>{{ stop.city || 'Atlas route stop' }}</p>
                </div>

                <div class="timeline-stop__meta">
                  <span>
                    <AtlasIcon name="clock" label="Duration" />
                    {{ stop.duration ?? 90 }} min
                  </span>
                  <span>
                    <AtlasIcon name="dollar" label="Estimated cost" />
                    ${{ (stop.estimatedCost ?? 0).toFixed(0) }}
                  </span>
                </div>
              </div>
            </div>
          </li>
        </ol>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import type { Itinerary, ItineraryDay, TripSpot } from '@/types';

const props = defineProps<{
  itinerary?: Itinerary | null;
  spots?: TripSpot[];
}>();

const timelineDays = computed<ItineraryDay[]>(() => {
  if (props.itinerary?.days?.length) {
    return props.itinerary.days;
  }

  const fallbackDate = new Date().toISOString().slice(0, 10);
  return [
    {
      dayNumber: 1,
      date: fallbackDate,
      spots: props.spots ?? [],
    },
  ];
});

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function formatCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}
</script>

<style scoped>
.trip-timeline {
  padding: var(--space-5);
  display: grid;
  gap: var(--space-5);
}

.trip-timeline__header,
.timeline-day__header,
.timeline-stop__topline,
.timeline-stop__content,
.timeline-stop__meta {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
}

.eyebrow {
  margin: 0 0 var(--space-1);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.timeline-hint,
.timeline-day__header p,
.timeline-stop__content p,
.timeline-stop__meta span {
  color: var(--text-secondary);
}

.timeline-days {
  display: grid;
  gap: var(--space-4);
}

.timeline-day {
  padding: var(--space-5);
}

.timeline-day__header strong,
.timeline-day__header p,
.timeline-stop__content strong,
.timeline-stop__content p {
  margin: 0;
}

.timeline-count,
.time-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0.8rem;
  border-radius: var(--radius-full);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  font-size: var(--font-size-small);
}

.timeline-stops {
  list-style: none;
  padding: 0;
  margin: var(--space-5) 0 0;
  display: grid;
  gap: var(--space-4);
}

.timeline-stop {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-3);
  align-items: start;
}

.timeline-stop__rail {
  display: grid;
  justify-items: center;
  gap: var(--space-2);
  min-width: 1rem;
}

.timeline-stop__dot {
  width: 0.8rem;
  height: 0.8rem;
  border-radius: var(--radius-full);
  background: var(--accent-teal);
  box-shadow: 0 0 0 0.3rem var(--accent-teal-light);
}

.timeline-stop__line {
  width: 2px;
  height: 100%;
  min-height: 4.5rem;
  background: var(--border);
}

.timeline-stop:last-child .timeline-stop__line {
  opacity: 0;
}

.timeline-stop__card {
  padding: var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--bg-secondary);
}

.timeline-stop__content {
  align-items: center;
  margin-top: var(--space-3);
}

.timeline-stop__meta {
  flex-wrap: wrap;
}

.timeline-stop__meta span {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-small);
}

.timeline-stop__meta :deep(.atlas-icon) {
  width: 0.95rem;
  height: 0.95rem;
  color: var(--accent-gold);
}

@media (max-width: 720px) {
  .trip-timeline__header,
  .timeline-day__header,
  .timeline-stop__topline,
  .timeline-stop__content {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
