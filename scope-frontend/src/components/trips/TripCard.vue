<template>
  <article class="trip-card glass-panel" data-test="trip-card">
    <div class="trip-media">
      <LazyImage :src="tripImageUrl" :fallback-src="tripImageFallback" :alt="trip.title" class="trip-image" />

      <div class="trip-media-chrome">
        <button
          type="button"
          class="save-button"
          :class="{ active: isSaved }"
          :aria-pressed="isSaved"
          :aria-label="isSaved ? `Remove ${trip.title} from saved trips` : `Save ${trip.title}`"
          @click="toggleSaved"
        >
          <ScopeIcon :name="isSaved ? 'heart-filled' : 'heart'" />
        </button>
      </div>

      <div class="trip-overlay">
        <p class="eyebrow">{{ trip.destination }}</p>
        <h3>{{ trip.title }}</h3>

        <div class="overlay-meta">
          <span class="metric-pill">
            <ScopeIcon name="calendar" />
            <span>{{ dateRangeLabel }}</span>
          </span>
          <span class="metric-pill">
            <ScopeIcon name="route" />
            <span>{{ tripLengthDays }} day{{ tripLengthDays === 1 ? '' : 's' }}</span>
          </span>
        </div>
      </div>
    </div>

    <div class="trip-body">
      <p class="description">{{ descriptionCopy }}</p>

      <div class="metric-grid">
        <span class="metric-chip">
          <ScopeIcon name="friends" />
          <span>{{ memberLabel }}</span>
        </span>
        <span class="metric-chip">
          <ScopeIcon name="route" />
          <span>{{ stopLabel }}</span>
        </span>
        <span class="metric-chip">
          <ScopeIcon name="globe" />
          <span>{{ visibilityLabel }}</span>
        </span>
      </div>

      <div class="trip-footer">
        <span class="footer-copy">{{ footerCopy }}</span>
        <RouterLink :to="`/trips/${trip.id}`" class="cta-link">
          <span>View trip</span>
          <ScopeIcon name="arrow-right" />
        </RouterLink>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import type { Trip } from '@/types';
import { getTripCoverFallback, resolveTripCoverImageUrl } from '@/utils/demoPhotos';
import { formatMonthDay, getInclusiveDaySpan } from '@/utils/formatters';

const props = defineProps<{
  trip: Trip;
}>();

const isSaved = ref(false);

function toggleSaved() {
  isSaved.value = !isSaved.value;
}

const dateRangeLabel = computed(() => {
  const start = formatMonthDay(props.trip.startDate);
  const end = formatMonthDay(props.trip.endDate);
  return start === end ? start : `${start} → ${end}`;
});

const tripLengthDays = computed(() => getInclusiveDaySpan(props.trip.startDate, props.trip.endDate));

const TRIP_CARD_IMAGE_WIDTH = 720;

const tripImageFallback = computed(() => getTripCoverFallback(props.trip, TRIP_CARD_IMAGE_WIDTH));
const tripImageUrl = computed(() => resolveTripCoverImageUrl(props.trip, TRIP_CARD_IMAGE_WIDTH));
const descriptionCopy = computed(() => props.trip.description?.trim() || 'A premium route board is waiting for the first itinerary notes.');
const memberLabel = computed(() => `${props.trip.members.length} member${props.trip.members.length === 1 ? '' : 's'}`);
const stopLabel = computed(() => `${props.trip.spots.length} stop${props.trip.spots.length === 1 ? '' : 's'}`);
const visibilityLabel = computed(() => (props.trip.isPublic ? 'Public route' : 'Private draft'));
const footerCopy = computed(() => {
  if (props.trip.budget) {
    const currency = props.trip.currency ?? 'USD';
    return `Budget target ${new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(props.trip.budget)}`;
  }

  return props.trip.spots.length ? 'Open the full trip workspace' : 'Ready for itinerary generation';
});
</script>

<style scoped>
.trip-card {
  overflow: hidden;
  display: grid;
  color: inherit;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);
}

.trip-card:hover,
.trip-card:focus-within {
  transform: translateY(var(--motion-card-lift));
  box-shadow: var(--shadow-lg);
  border-color: var(--border-hover);
}

.trip-media {
  position: relative;
  isolation: isolate;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, var(--accent-teal-light), transparent 34%),
    radial-gradient(circle at bottom right, var(--accent-gold-light), transparent 32%),
    linear-gradient(180deg, var(--bg-tertiary), var(--bg-secondary));
}

.trip-media::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-primary) 12%, transparent) 0%,
      transparent 34%,
      color-mix(in srgb, var(--bg-primary) 88%, transparent) 100%
    ),
    linear-gradient(0deg, color-mix(in srgb, var(--accent-teal) 14%, transparent), transparent 42%);
  pointer-events: none;
}

.trip-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-slow), filter var(--transition-slow);
}

.trip-card:hover .trip-image,
.trip-card:focus-within .trip-image {
  transform: scale(var(--motion-image-zoom));
}

.trip-overlay h3,
.description,
.footer-copy {
  margin: 0;
}

.trip-overlay h3 {
  color: var(--text-primary);
}

.trip-media-chrome,
.trip-overlay,
.overlay-meta,
.trip-body,
.metric-grid,
.trip-footer {
  display: grid;
  gap: var(--space-3);
}

.trip-media-chrome,
.overlay-meta,
.trip-footer {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.trip-media-chrome,
.trip-overlay {
  position: absolute;
  inset-inline: var(--space-4);
  z-index: 1;
}

.trip-media-chrome {
  top: var(--space-4);
  justify-items: end;
}

.trip-overlay {
  bottom: var(--space-4);
}

.eyebrow {
  margin: 0;
  color: color-mix(in srgb, var(--text-primary) 78%, var(--text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.trip-overlay h3 {
  font-size: clamp(1.3rem, 2vw, 1.7rem);
  line-height: 1.08;
  letter-spacing: -0.03em;
  text-shadow: var(--shadow-md);
}

.metric-pill,
.metric-chip,
.save-button {
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
}

.metric-pill,
.metric-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  width: fit-content;
  padding: 0.55rem 0.9rem;
  background: color-mix(in srgb, var(--glass-bg) 100%, transparent);
  box-shadow: var(--shadow-sm);
  font-size: var(--font-size-small);
}

.metric-pill :deep(.scope-icon),
.metric-chip :deep(.scope-icon) {
  width: 0.95rem;
  height: 0.95rem;
  color: var(--accent-teal);
}

.metric-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.metric-chip {
  justify-content: center;
  min-width: 0;
  background: color-mix(in srgb, var(--accent-teal) 8%, var(--bg-secondary));
  color: var(--text-primary);
}

.metric-chip span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.save-button {
  display: inline-grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  background: color-mix(in srgb, var(--glass-bg) 90%, transparent);
  color: var(--text-primary);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast),
    background var(--transition-fast);
}

.save-button:hover,
.save-button:focus-visible {
  transform: translateY(var(--motion-button-lift));
  border-color: color-mix(in srgb, var(--accent-teal) 55%, var(--glass-border));
  box-shadow: var(--shadow-glow-teal);
  outline: none;
}

.save-button.active {
  color: var(--accent-teal);
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--glass-bg));
}

.save-button:active {
  transform: translateY(0) scale(var(--motion-press-scale));
}

.save-button :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
}

.trip-body {
  padding: var(--space-5);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 100%, transparent), color-mix(in srgb, var(--bg-primary) 10%, var(--bg-secondary)));
}

.description {
  color: var(--text-secondary);
  line-height: var(--line-height-normal);
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.footer-copy {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.cta-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: fit-content;
  padding: 0.8rem 1rem;
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
  transform: translateY(var(--motion-button-lift));
  border-color: var(--accent-teal);
  box-shadow: var(--shadow-glow-teal);
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--bg-secondary));
  outline: none;
}

.cta-link :deep(.scope-icon) {
  width: 0.95rem;
  height: 0.95rem;
}

@media (max-width: 900px) {
  .metric-grid,
  .overlay-meta,
  .trip-footer {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .trip-card,
  .trip-image,
  .save-button,
  .cta-link {
    transition: none;
  }

  .trip-card:hover,
  .trip-card:focus-within,
  .trip-card:hover .trip-image,
  .trip-card:focus-within .trip-image,
  .save-button:hover,
  .save-button:focus-visible,
  .save-button:active,
  .cta-link:hover,
  .cta-link:focus-visible {
    transform: none;
  }
}
</style>
