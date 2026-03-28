<template>
  <section v-if="itinerary" class="glass-panel itinerary-panel">
    <div class="summary">
      <div>
        <p class="eyebrow">AI itinerary</p>
        <h2>{{ itinerary.destination }}</h2>
      </div>
      <div class="stats">
        <span>${{ itinerary.totalEstimatedCost.toFixed(0) }}</span>
        <span>{{ itinerary.weatherForecast }}</span>
      </div>
    </div>

    <div class="day-list">
      <article v-for="day in itinerary.days" :key="day.dayNumber" class="day-card">
        <header>
          <strong>Day {{ day.dayNumber }}</strong>
          <span>{{ day.date }}</span>
        </header>
        <ul>
          <li v-for="spot in day.spots" :key="`${day.dayNumber}-${spot.spotId}`">
            <span>{{ spot.timeSlot }}</span>
            <div>
              <strong>{{ spot.title }}</strong>
              <p>{{ spot.category }} · {{ spot.duration }} min · ${{ spot.estimatedCost ?? 0 }}</p>
            </div>
          </li>
        </ul>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { Itinerary } from '@/types';

defineProps<{
  itinerary: Itinerary | null;
}>();
</script>

<style scoped>
.itinerary-panel {
  padding: var(--space-6);
  display: grid;
  gap: var(--space-5);
}

.summary {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: start;
}

.eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--accent-teal);
  text-transform: uppercase;
  font-size: var(--font-size-caption);
  letter-spacing: 0.12em;
}

.summary h2,
.day-card p {
  margin: 0;
}

.stats {
  display: grid;
  gap: var(--space-2);
  color: var(--text-secondary);
  text-align: right;
}

.day-list {
  display: grid;
  gap: var(--space-4);
}

.day-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  background: var(--bg-secondary);
}

.day-card header,
.day-card li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
}

.day-card ul {
  list-style: none;
  padding: 0;
  margin: var(--space-4) 0 0;
  display: grid;
  gap: var(--space-3);
}

.day-card li span,
.day-card li p {
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .summary,
  .day-card header,
  .day-card li {
    flex-direction: column;
  }

  .stats {
    text-align: left;
  }
}
</style>
