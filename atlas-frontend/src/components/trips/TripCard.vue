<template>
  <article class="trip-card glass-panel">
    <div>
      <p class="eyebrow">{{ trip.destination }}</p>
      <h3>{{ trip.title }}</h3>
      <p class="description">{{ trip.description }}</p>
    </div>
    <div class="trip-meta">
      <span>{{ trip.startDate }} → {{ trip.endDate }}</span>
      <span>{{ trip.members.length }} members</span>
      <RouterLink :to="`/trips/${trip.id}`" class="link">Open trip</RouterLink>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Trip } from '@/types';

defineProps<{
  trip: Trip;
}>();
</script>

<style scoped>
.trip-card {
  padding: var(--space-5);
  display: grid;
  gap: var(--space-4);
}

.eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--accent-gold);
  text-transform: uppercase;
  font-size: var(--font-size-caption);
  letter-spacing: 0.12em;
}

h3,
.description {
  margin: 0;
}

.description,
.trip-meta {
  color: var(--text-secondary);
}

.trip-meta {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.link {
  color: var(--accent-teal);
  font-weight: var(--font-weight-semibold);
}
</style>
