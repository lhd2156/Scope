<template>
  <article class="adventure-card glass-panel" data-test="profile-adventure-card">
    <div class="adventure-media">
      <LazyImage :src="coverImageUrl" :fallback-src="coverImageFallback" :alt="trip.title" class="adventure-image" />

      <div class="adventure-media-chrome">
        <span class="destination-pill">{{ trip.destination }}</span>
      </div>
    </div>

    <div class="adventure-body">
      <div class="meta-row">
        <span class="meta-pill">
          <ScopeIcon name="calendar" />
          <span>{{ dateRangeLabel }}</span>
        </span>
        <span class="meta-pill">
          <ScopeIcon name="route" />
          <span>{{ tripLengthDays }} day{{ tripLengthDays === 1 ? '' : 's' }}</span>
        </span>
      </div>

      <div class="copy-stack">
        <h3>{{ trip.title }}</h3>
        <p class="description">{{ descriptionCopy }}</p>
      </div>

      <RouterLink :to="`/trips/${trip.id}`" class="cta-link">
        <span>Open trip</span>
        <ScopeIcon name="arrow-right" />
      </RouterLink>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import type { Trip } from '@/types';
import { formatMonthDay, getInclusiveDaySpan } from '@/utils/formatters';
import { getTripCoverFallback, resolveTripCoverImageUrl } from '@/utils/demoPhotos';

const props = defineProps<{
  trip: Trip;
}>();

const PROFILE_ADVENTURE_IMAGE_WIDTH = 720;

const coverImageFallback = computed(() => getTripCoverFallback(props.trip, PROFILE_ADVENTURE_IMAGE_WIDTH));
const coverImageUrl = computed(() => resolveTripCoverImageUrl(props.trip, PROFILE_ADVENTURE_IMAGE_WIDTH));

const dateRangeLabel = computed(() => {
  const start = formatMonthDay(props.trip.startDate);
  const end = formatMonthDay(props.trip.endDate);
  return !start || start === end ? start : `${start} → ${end}`;
});

const tripLengthDays = computed(() => getInclusiveDaySpan(props.trip.startDate, props.trip.endDate));

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

.adventure-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-slow), filter var(--transition-slow);
}

.adventure-card:hover .adventure-image,
.adventure-card:focus-within .adventure-image {
  transform: scale(1.05);
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

.destination-pill {
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
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
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  justify-content: stretch;
  min-width: 0;
  width: 100%;
  color: var(--text-secondary);
}

.meta-pill :deep(.scope-icon) {
  width: 0.95rem;
  height: 0.95rem;
  color: var(--accent-teal);
}

.meta-pill span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.cta-link :deep(.scope-icon) {
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
