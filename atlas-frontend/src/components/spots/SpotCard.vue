<template>
  <article class="spot-card glass-panel">
    <img :src="spot.photoUrl" :alt="spot.title" class="spot-image" />
    <div class="spot-body">
      <div class="spot-header">
        <span class="badge" :class="`badge-${spot.category}`">{{ spot.category }}</span>
        <span class="rating">★ {{ spot.rating.toFixed(1) }}</span>
      </div>
      <h3>{{ spot.title }}</h3>
      <p class="meta">{{ spot.city }}, {{ spot.country }} · {{ spot.vibe }}</p>
      <p class="description">{{ spot.description }}</p>
      <RouterLink :to="`/spots/${spot.id}`" class="link">View details</RouterLink>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { SpotSummary } from '@/types';

defineProps<{
  spot: SpotSummary;
}>();
</script>

<style scoped>
.spot-card {
  overflow: hidden;
  display: grid;
  grid-template-rows: 14rem 1fr;
}

.spot-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.spot-body {
  padding: var(--space-5);
  display: grid;
  gap: var(--space-3);
}

.spot-header,
.meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
}

.meta,
.description {
  color: var(--text-secondary);
}

h3 {
  margin: 0;
  font-size: var(--font-size-h3);
}

.rating {
  color: var(--accent-gold);
  font-weight: var(--font-weight-semibold);
}

.link {
  color: var(--accent-teal);
  font-weight: var(--font-weight-semibold);
}
</style>
