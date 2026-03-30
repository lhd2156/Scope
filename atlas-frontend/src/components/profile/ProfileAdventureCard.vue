<template>
  <article class="adventure-card glass-panel" data-test="profile-adventure-card">
    <div class="adventure-media">
      <LazyImage v-if="coverImageUrl" :src="coverImageUrl" :alt="trip.title" class="adventure-image" eager />
      <div v-else class="adventure-fallback">
        <AtlasIcon name="route" label="Trip route placeholder" />
        <span>Adventure cover</span>
      </div>

      <div class="adventure-media-chrome">
        <span class="destination-pill">{{ trip.destination }}</span>
        <span class="status-pill" :class="`status-pill--${tripStatus}`">{{ statusLabel }}</span>
      </div>
    </div>

    <div class="adventure-body">
      <div class="meta-row">
        <span class="meta-pill">
          <AtlasIcon name="calendar" />
          <span>{{ dateRangeLabel }}</span>
        </span>
        <span class="meta-pill">
          <AtlasIcon name="route" />
          <span>{{ tripLengthDays }} day{{ tripLengthDays === 1 ? '' : 's' }}</span>
        </span>
      </div>

      <div class="copy-stack">
        <h3>{{ trip.title }}</h3>
        <p class="description">{{ descriptionCopy }}</p>
      </div>

      <RouterLink :to="`/trips/${trip.id}`" class="cta-link">
        <span>Open trip</span>
        <AtlasIcon name="arrow-right" />
      </RouterLink>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import type { Trip, TripStatus } from '@/types';
import { formatMonthDay, getInclusiveDaySpan } from '@/utils/formatters';

const props = defineProps<{
  trip: Trip;
}>();

const coverImageUrl = computed(() => props.trip.coverImageUrl?.trim() || props.trip.spots[0]?.photoUrl?.trim() || '');

const dateRangeLabel = computed(() => {
  const start = formatMonthDay(props.trip.startDate);
  const end = formatMonthDay(props.trip.endDate);
  return !start || start === end ? start : `${start} → ${end}`;
});

const tripLengthDays = computed(() => getInclusiveDaySpan(props.trip.startDate, props.trip.endDate));

const tripStatus = computed<TripStatus>(() => props.trip.status ?? 'planning');
const statusLabel = computed(() => tripStatus.value.charAt(0).toUpperCase() + tripStatus.value.slice(1));
const descriptionCopy = computed(() => props.trip.description?.trim() || 'A premium route board is ready for its next chapter.');
</script>

<style scoped>
.adventure-card {
  overflow: hidden;
  display: grid;
  min-height: 100%;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);
}

.adventure-card:hover,
.adventure-card:focus-within {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  border-color: var(--border-hover);
}

.adventure-media {
  position: relative;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, var(--accent-teal-light), transparent 34%),
    radial-gradient(circle at bottom right, var(--accent-gold-light), transparent 36%),
    linear-gradient(180deg, var(--bg-tertiary), var(--bg-secondary));
}

.adventure-media::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 12%, transparent) 0%, transparent 32%, color-mix(in srgb, var(--bg-primary) 76%, transparent) 100%),
    linear-gradient(0deg, color-mix(in srgb, var(--accent-teal) 16%, transparent), transparent 40%);
  pointer-events: none;
}

.adventure-image,
.adventure-fallback {
  width: 100%;
  height: 100%;
}

.adventure-image {
  object-fit: cover;
  transition: transform var(--transition-slow), filter var(--transition-slow);
}

.adventure-card:hover .adventure-image,
.adventure-card:focus-within .adventure-image {
  transform: scale(1.05);
}

.adventure-fallback {
  display: grid;
  place-content: center;
  gap: var(--space-2);
  padding: var(--space-6);
  color: var(--text-secondary);
  text-align: center;
}

.adventure-fallback :deep(.atlas-icon) {
  width: 2rem;
  height: 2rem;
  margin: 0 auto;
  color: var(--accent-teal);
}

.adventure-media-chrome,
.meta-row,
.copy-stack,
.adventure-body {
  display: grid;
  gap: var(--space-3);
}

.adventure-media-chrome {
  position: absolute;
  inset: var(--space-4) var(--space-4) auto;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  z-index: 1;
}

.destination-pill,
.status-pill,
.meta-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  width: fit-content;
  padding: 0.55rem 0.9rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  background: color-mix(in srgb, var(--glass-bg) 100%, transparent);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-sm);
  font-size: var(--font-size-small);
}

.destination-pill,
.status-pill {
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
}

.status-pill--planning {
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--glass-bg));
}

.status-pill--active {
  background: color-mix(in srgb, var(--accent-gold) 18%, var(--glass-bg));
}

.status-pill--completed {
  background: color-mix(in srgb, var(--success) 18%, var(--glass-bg));
}

.status-pill--cancelled {
  background: color-mix(in srgb, var(--danger) 16%, var(--glass-bg));
}

.adventure-body {
  padding: var(--space-5);
  align-content: start;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 100%, transparent), color-mix(in srgb, var(--bg-primary) 12%, var(--bg-secondary)));
}

.meta-row {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.meta-pill {
  justify-content: center;
  min-width: 0;
  color: var(--text-secondary);
}

.meta-pill :deep(.atlas-icon) {
  width: 0.95rem;
  height: 0.95rem;
  color: var(--accent-teal);
}

.copy-stack h3,
.copy-stack p {
  margin: 0;
}

.copy-stack h3 {
  font-size: clamp(1.2rem, 2vw, 1.55rem);
  line-height: 1.08;
  letter-spacing: -0.03em;
}

.description {
  color: var(--text-secondary);
  line-height: var(--line-height-normal);
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.cta-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: fit-content;
  margin-top: auto;
  padding: 0.85rem 1.05rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 36%, var(--border));
  background: color-mix(in srgb, var(--accent-teal) 10%, var(--bg-secondary));
  color: var(--text-primary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.cta-link:hover,
.cta-link:focus-visible {
  transform: translateY(-1px);
  border-color: var(--accent-teal);
  box-shadow: var(--shadow-glow-teal);
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--bg-secondary));
  outline: none;
}

.cta-link :deep(.atlas-icon) {
  width: 0.95rem;
  height: 0.95rem;
}

@media (max-width: 720px) {
  .meta-row,
  .adventure-media-chrome {
    grid-template-columns: 1fr;
  }

  .cta-link {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .adventure-card,
  .adventure-image,
  .cta-link {
    transition: none;
  }

  .adventure-card:hover,
  .adventure-card:focus-within,
  .adventure-card:hover .adventure-image,
  .adventure-card:focus-within .adventure-image,
  .cta-link:hover,
  .cta-link:focus-visible {
    transform: none;
  }
}
</style>
