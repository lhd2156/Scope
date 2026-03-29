<template>
  <RouterLink :to="`/trips/${trip.id}`" class="trip-card glass-panel" data-test="trip-card">
    <div class="trip-media">
      <img v-if="trip.coverImageUrl" :src="trip.coverImageUrl" :alt="trip.title" class="trip-image" />
      <div v-else class="trip-fallback">
        <AtlasIcon name="route" label="Trip route" />
        <span>Route preview</span>
      </div>

      <div class="trip-overlay">
        <span class="status-pill">{{ statusLabel }}</span>
        <span class="metric-pill">{{ tripLengthDays }} day{{ tripLengthDays === 1 ? '' : 's' }}</span>
      </div>
    </div>

    <div class="trip-body">
      <div>
        <p class="eyebrow">{{ trip.destination }}</p>
        <h3>{{ trip.title }}</h3>
        <p class="description">{{ trip.description }}</p>
      </div>

      <div class="metric-grid">
        <div class="metric-item surface-card">
          <AtlasIcon name="calendar" label="Trip dates" />
          <div>
            <strong>{{ dateRangeLabel }}</strong>
            <span>Travel window</span>
          </div>
        </div>
        <div class="metric-item surface-card">
          <AtlasIcon name="friends" label="Trip members" />
          <div>
            <strong>{{ trip.members.length }} member{{ trip.members.length === 1 ? '' : 's' }}</strong>
            <span>Shared trip</span>
          </div>
        </div>
        <div class="metric-item surface-card">
          <AtlasIcon name="route" label="Trip stops" />
          <div>
            <strong>{{ trip.spots.length }} stop{{ trip.spots.length === 1 ? '' : 's' }}</strong>
            <span>Mapped route</span>
          </div>
        </div>
      </div>
    </div>
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import type { Trip } from '@/types';

const props = defineProps<{
  trip: Trip;
}>();

const dateRangeLabel = computed(() => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const start = formatter.format(new Date(props.trip.startDate));
  const end = formatter.format(new Date(props.trip.endDate));
  return start === end ? start : `${start} → ${end}`;
});

const tripLengthDays = computed(() => {
  const start = new Date(props.trip.startDate);
  const end = new Date(props.trip.endDate);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1);
});

const statusLabel = computed(() => {
  const status = props.trip.status ?? 'planning';
  return status.charAt(0).toUpperCase() + status.slice(1);
});
</script>

<style scoped>
.trip-card {
  overflow: hidden;
  display: grid;
  gap: 0;
  color: inherit;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);
}

.trip-card:hover,
.trip-card:focus-visible {
  transform: translateY(-0.125rem);
  box-shadow: var(--shadow-lg);
  outline: none;
}

.trip-media {
  position: relative;
  min-height: 14rem;
  background:
    radial-gradient(circle at top left, var(--accent-teal-light), transparent 30%),
    radial-gradient(circle at bottom right, var(--accent-gold-light), transparent 30%),
    linear-gradient(180deg, var(--bg-tertiary), var(--bg-secondary));
}

.trip-image,
.trip-fallback {
  width: 100%;
  height: 100%;
}

.trip-image {
  object-fit: cover;
}

.trip-fallback {
  display: grid;
  place-content: center;
  gap: var(--space-2);
  color: var(--text-secondary);
}

.trip-fallback :deep(.atlas-icon) {
  width: 2rem;
  height: 2rem;
  color: var(--accent-teal);
}

.trip-overlay {
  position: absolute;
  inset: var(--space-4) var(--space-4) auto;
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  align-items: flex-start;
}

.status-pill,
.metric-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0.85rem;
  border-radius: var(--radius-full);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: var(--glass-blur);
  font-size: var(--font-size-small);
}

.status-pill {
  color: var(--accent-gold);
}

.metric-pill {
  color: var(--text-primary);
}

.trip-body {
  display: grid;
  gap: var(--space-5);
  padding: var(--space-5);
}

.eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: var(--font-size-caption);
}

h3,
.description,
.metric-item strong,
.metric-item span {
  margin: 0;
}

h3 {
  font-size: var(--font-size-h3);
}

.description,
.metric-item span {
  color: var(--text-secondary);
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
}

.metric-item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-3);
  align-items: start;
  padding: var(--space-4);
}

.metric-item :deep(.atlas-icon) {
  width: 1.1rem;
  height: 1.1rem;
  color: var(--accent-teal);
}

.metric-item div {
  display: grid;
  gap: var(--space-1);
}

.metric-item strong {
  color: var(--text-primary);
  font-size: var(--font-size-small);
}

.metric-item span {
  font-size: var(--font-size-caption);
}

@media (max-width: 900px) {
  .metric-grid {
    grid-template-columns: 1fr;
  }
}
</style>
