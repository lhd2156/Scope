<template>
  <article class="trip-card glass-panel">
    <div class="trip-card__media">
      <img v-if="coverImage" :src="coverImage" :alt="trip.title" class="trip-card__image" />
      <div v-else class="trip-card__placeholder">
        <span class="trip-card__badge">{{ trip.destination }}</span>
        <strong>{{ trip.title }}</strong>
      </div>

      <div class="trip-card__overlay">
        <span class="trip-card__pill">{{ trip.isPublic ? 'Public trip' : 'Private trip' }}</span>
        <span class="trip-card__pill">{{ formattedDates }}</span>
      </div>
    </div>

    <div class="trip-card__body">
      <div class="trip-card__header">
        <p class="eyebrow">{{ trip.destination }}</p>
        <span class="meta-pill">{{ tripLengthDays }} day{{ tripLengthDays === 1 ? '' : 's' }}</span>
      </div>

      <h3>{{ trip.title }}</h3>
      <p class="trip-card__description">{{ descriptionCopy }}</p>

      <div class="trip-card__meta">
        <div class="meta-row">
          <AtlasIcon name="calendar" label="Trip dates" />
          <span>{{ formattedDates }}</span>
        </div>
        <div class="meta-row">
          <AtlasIcon name="friends" label="Trip members" />
          <span>{{ memberCopy }}</span>
        </div>
        <div class="meta-row">
          <AtlasIcon name="route" label="Trip stops" />
          <span>{{ stopCopy }}</span>
        </div>
      </div>

      <RouterLink :to="`/trips/${trip.id}`" class="trip-card__link">Open trip itinerary</RouterLink>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import type { Trip } from '@/types';

const props = defineProps<{
  trip: Trip;
}>();

const coverImage = computed(() => props.trip.coverImageUrl ?? props.trip.spots[0]?.photoUrl ?? null);
const descriptionCopy = computed(() => props.trip.description?.trim() || 'This route is waiting for a richer trip story.');
const tripLengthDays = computed(() => calculateTripLengthDays(props.trip.startDate, props.trip.endDate));
const formattedDates = computed(() => `${formatDate(props.trip.startDate)} – ${formatDate(props.trip.endDate)}`);
const memberCopy = computed(() => `${props.trip.members.length} member${props.trip.members.length === 1 ? '' : 's'}`);
const stopCopy = computed(() => `${props.trip.spots.length} stop${props.trip.spots.length === 1 ? '' : 's'}`);

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function calculateTripLengthDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1);
}
</script>

<style scoped>
.trip-card {
  overflow: hidden;
  display: grid;
  grid-template-rows: 14rem 1fr;
}

.trip-card__media {
  position: relative;
  background:
    radial-gradient(circle at top left, var(--accent-teal-light), transparent 35%),
    linear-gradient(180deg, var(--bg-tertiary), var(--bg-secondary));
}

.trip-card__image,
.trip-card__placeholder {
  width: 100%;
  height: 100%;
}

.trip-card__image {
  object-fit: cover;
}

.trip-card__placeholder {
  display: grid;
  place-content: center;
  gap: var(--space-2);
  padding: var(--space-5);
  text-align: center;
}

.trip-card__placeholder strong {
  font-size: var(--font-size-h3);
}

.trip-card__badge,
.trip-card__pill,
.meta-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0.8rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  font-size: var(--font-size-small);
  color: var(--text-primary);
}

.trip-card__overlay {
  position: absolute;
  inset: var(--space-4) var(--space-4) auto var(--space-4);
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.trip-card__body {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-5);
}

.trip-card__header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  align-items: center;
}

.eyebrow {
  margin: 0;
  color: var(--accent-gold);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: var(--font-size-caption);
}

.trip-card h3,
.trip-card__description {
  margin: 0;
}

.trip-card__description,
.meta-row span {
  color: var(--text-secondary);
  line-height: var(--line-height-relaxed);
}

.trip-card__meta {
  display: grid;
  gap: var(--space-3);
}

.meta-row {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
}

.meta-row :deep(.atlas-icon) {
  width: 1rem;
  height: 1rem;
  color: var(--accent-teal);
}

.trip-card__link {
  color: var(--accent-teal);
  font-weight: var(--font-weight-semibold);
}

.trip-card__link:hover,
.trip-card__link:focus-visible {
  color: var(--accent-teal-hover);
  outline: none;
}

@media (max-width: 720px) {
  .trip-card__header,
  .trip-card__overlay {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
