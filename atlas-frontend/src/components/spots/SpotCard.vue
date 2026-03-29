<template>
  <article class="spot-card glass-panel">
    <div class="spot-media">
      <img v-if="spot.photoUrl" :src="spot.photoUrl" :alt="spot.title" class="spot-image" />
      <div v-else class="spot-placeholder">
        <strong>{{ categoryLabel }}</strong>
        <span>Cover photo coming soon</span>
      </div>

      <div class="media-overlay">
        <span class="badge" :class="`badge-${spot.category}`">{{ categoryLabel }}</span>
        <div class="rating-pill" :aria-label="`Rated ${ratingLabel} out of 5`">
          <span class="rating-stars" aria-hidden="true">{{ ratingStars }}</span>
          <strong>{{ ratingLabel }}</strong>
        </div>
      </div>
    </div>

    <div class="spot-body">
      <div class="eyebrow-row">
        <p class="location">{{ locationLabel }}</p>
        <span v-if="spot.vibe" class="meta-pill">{{ spot.vibe }}</span>
      </div>

      <div class="title-row">
        <h3>{{ spot.title }}</h3>
        <span class="meta-pill">{{ tractionLabel }}</span>
      </div>

      <p class="description">{{ descriptionCopy }}</p>

      <div class="spot-footer">
        <span class="footer-copy">{{ footerCopy }}</span>
        <RouterLink :to="`/spots/${spot.id}`" class="link">View details</RouterLink>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SpotSummary } from '@/types';

const props = defineProps<{
  spot: SpotSummary;
}>();

function formatCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

const categoryLabel = computed(() => formatCategory(props.spot.category));
const ratingLabel = computed(() => props.spot.rating.toFixed(1));
const ratingStars = computed(() => {
  const filledStars = Math.max(1, Math.min(5, Math.round(props.spot.rating)));
  return `${'★'.repeat(filledStars)}${'☆'.repeat(5 - filledStars)}`;
});
const locationLabel = computed(() => {
  const parts = [props.spot.city, props.spot.country].filter((value): value is string => Boolean(value?.trim()));
  return parts.length ? parts.join(', ') : 'Atlas community pin';
});
const tractionLabel = computed(() => {
  const likesCount = props.spot.likesCount ?? 0;
  return likesCount > 0 ? `${likesCount} saves` : 'New pin';
});
const descriptionCopy = computed(() => props.spot.description?.trim() || 'Community details are syncing for this spot.');
const footerCopy = computed(() => {
  if (props.spot.author?.displayName) {
    return `Pinned by ${props.spot.author.displayName}`;
  }

  return props.spot.liked ? 'Already saved to your atlas' : 'Open the full detail view';
});
</script>

<style scoped>
.spot-card {
  overflow: hidden;
  display: grid;
  grid-template-rows: 15rem 1fr;
  transition:
    transform var(--transition-normal),
    box-shadow var(--transition-normal),
    border-color var(--transition-normal);
}

.spot-card:hover,
.spot-card:focus-within {
  transform: translateY(-0.125rem);
  box-shadow: var(--shadow-lg);
}

.spot-media {
  position: relative;
  min-height: 15rem;
  background:
    radial-gradient(circle at top left, var(--accent-teal-light), transparent 35%),
    linear-gradient(180deg, var(--bg-tertiary), var(--bg-secondary));
}

.spot-image,
.spot-placeholder {
  width: 100%;
  height: 100%;
}

.spot-image {
  object-fit: cover;
}

.spot-placeholder {
  display: grid;
  place-content: center;
  gap: var(--space-2);
  padding: var(--space-5);
  text-align: center;
  color: var(--text-secondary);
}

.spot-placeholder strong {
  color: var(--text-primary);
  font-size: var(--font-size-h3);
}

.media-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4);
  background: linear-gradient(180deg, transparent 0%, transparent 45%, var(--glass-bg) 100%);
}

.rating-pill,
.meta-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0.45rem 0.75rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-sm);
}

.rating-pill {
  color: var(--text-primary);
}

.rating-stars {
  color: var(--accent-gold);
  letter-spacing: 0.08em;
  font-size: var(--font-size-small);
}

.spot-body {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-5);
}

.eyebrow-row,
.title-row,
.spot-footer {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.location,
.description,
.footer-copy {
  color: var(--text-secondary);
}

.location,
.description,
.footer-copy,
.title-row h3 {
  margin: 0;
}

.location,
.footer-copy,
.meta-pill,
.rating-pill {
  font-size: var(--font-size-small);
}

.title-row h3 {
  flex: 1;
  font-size: var(--font-size-h3);
  line-height: var(--line-height-tight);
}

.description {
  line-height: var(--line-height-relaxed);
}

.spot-footer {
  align-items: center;
}

.link {
  color: var(--accent-teal);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.link:hover,
.link:focus-visible {
  color: var(--accent-teal-hover);
  outline: none;
}

@media (max-width: 720px) {
  .eyebrow-row,
  .title-row,
  .spot-footer,
  .media-overlay {
    flex-direction: column;
    align-items: flex-start;
  }

  .spot-card {
    grid-template-rows: 13rem 1fr;
  }
}
</style>
