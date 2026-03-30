<template>
  <article class="spot-card glass-panel">
    <div class="spot-media">
      <LazyImage v-if="spot.photoUrl" :src="spot.photoUrl" :alt="spot.title" class="spot-image" />
      <div v-else class="spot-placeholder">
        <AtlasIcon name="image" label="Spot cover placeholder" />
        <strong>{{ categoryLabel }}</strong>
        <span>Cover photo coming soon</span>
      </div>

      <div class="spot-media-chrome">
        <span class="badge" :class="`badge-${spot.category}`">{{ categoryLabel }}</span>
        <button
          type="button"
          class="save-button"
          :class="{ active: isSaved }"
          :aria-pressed="isSaved"
          :aria-label="isSaved ? `Remove ${spot.title} from saved spots` : `Save ${spot.title}`"
          @click="toggleSaved"
        >
          <AtlasIcon :name="isSaved ? 'heart-filled' : 'heart'" />
        </button>
      </div>

      <div class="spot-overlay">
        <p class="location-row">
          <AtlasIcon name="pin" />
          <span>{{ locationLabel }}</span>
        </p>

        <div class="overlay-copy">
          <h3>{{ spot.title }}</h3>
          <div class="overlay-meta">
            <span class="rating-pill" :aria-label="`Rated ${ratingLabel} out of 5`">
              <AtlasIcon name="star-filled" />
              <strong>{{ ratingLabel }}</strong>
            </span>
            <span class="meta-pill">{{ tractionLabel }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="spot-body">
      <p class="description">{{ descriptionCopy }}</p>

      <div class="spot-footer">
        <div class="footer-meta">
          <span v-if="formattedVibe" class="body-pill">{{ formattedVibe }}</span>
          <span class="footer-copy">{{ footerCopy }}</span>
        </div>

        <RouterLink :to="`/spots/${spot.id}`" class="cta-link">
          <span>View details</span>
          <AtlasIcon name="arrow-right" />
        </RouterLink>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import type { SpotSummary } from '@/types';

const props = defineProps<{
  spot: SpotSummary;
}>();

const isSaved = ref(Boolean(props.spot.liked));

watch(
  () => props.spot.liked,
  (liked) => {
    isSaved.value = Boolean(liked);
  },
);

function formatCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function formatVibe(vibe: string): string {
  return vibe
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function toggleSaved() {
  isSaved.value = !isSaved.value;
}

const categoryLabel = computed(() => formatCategory(props.spot.category));
const ratingLabel = computed(() => props.spot.rating.toFixed(1));
const formattedVibe = computed(() => (props.spot.vibe?.trim() ? formatVibe(props.spot.vibe) : ''));
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

  return isSaved.value ? 'Saved to your atlas' : 'Open the full detail view';
});
</script>

<style scoped>
.spot-card {
  overflow: hidden;
  display: grid;
  transition:
    transform var(--transition-normal),
    box-shadow var(--transition-normal),
    border-color var(--transition-normal);
}

.spot-card:hover,
.spot-card:focus-within {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  border-color: var(--border-hover);
}

.spot-media {
  position: relative;
  isolation: isolate;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, var(--accent-teal-light), transparent 38%),
    linear-gradient(180deg, var(--bg-tertiary), var(--bg-secondary));
}

.spot-media::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-primary) 10%, transparent) 0%,
      transparent 34%,
      color-mix(in srgb, var(--bg-primary) 88%, transparent) 100%
    ),
    linear-gradient(0deg, color-mix(in srgb, var(--accent-teal) 12%, transparent), transparent 45%);
  pointer-events: none;
}

.spot-image,
.spot-placeholder {
  width: 100%;
  height: 100%;
}

.spot-image {
  object-fit: cover;
  transition: transform var(--transition-slow), filter var(--transition-slow);
}

.spot-card:hover .spot-image,
.spot-card:focus-within .spot-image {
  transform: scale(1.05);
}

.spot-placeholder {
  display: grid;
  place-content: center;
  gap: var(--space-2);
  padding: var(--space-6);
  text-align: center;
  color: var(--text-secondary);
}

.spot-placeholder :deep(.atlas-icon) {
  width: 2rem;
  height: 2rem;
  margin: 0 auto;
  color: var(--accent-teal);
}

.spot-placeholder strong {
  color: var(--text-primary);
  font-size: var(--font-size-h3);
}

.spot-media-chrome,
.spot-overlay,
.overlay-copy,
.overlay-meta,
.spot-body,
.spot-footer,
.footer-meta {
  display: grid;
  gap: var(--space-3);
}

.spot-media-chrome,
.overlay-meta,
.spot-footer {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.spot-media-chrome,
.spot-overlay {
  position: absolute;
  inset-inline: var(--space-4);
  z-index: 1;
}

.spot-media-chrome {
  top: var(--space-4);
}

.spot-overlay {
  bottom: var(--space-4);
}

.location-row {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  color: color-mix(in srgb, var(--text-primary) 88%, var(--text-secondary));
  font-size: var(--font-size-small);
}

.location-row :deep(.atlas-icon) {
  width: 0.95rem;
  height: 0.95rem;
  color: var(--accent-teal);
}

.overlay-copy h3,
.description,
.footer-copy {
  margin: 0;
}

.overlay-copy h3 {
  font-size: clamp(1.25rem, 2vw, 1.6rem);
  line-height: 1.1;
  letter-spacing: -0.03em;
  text-shadow: var(--shadow-md);
}

.badge,
.rating-pill,
.meta-pill,
.body-pill,
.save-button {
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
}

.badge,
.rating-pill,
.meta-pill,
.body-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  width: fit-content;
  padding: 0.5rem 0.85rem;
  box-shadow: var(--shadow-sm);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.badge {
  text-transform: capitalize;
}

.rating-pill,
.meta-pill,
.body-pill {
  background: color-mix(in srgb, var(--glass-bg) 100%, transparent);
  color: var(--text-primary);
}

.rating-pill :deep(.atlas-icon) {
  width: 0.9rem;
  height: 0.9rem;
  color: var(--accent-gold);
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
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent-teal) 55%, var(--glass-border));
  box-shadow: var(--shadow-glow-teal);
  outline: none;
}

.save-button.active {
  color: var(--accent-teal);
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--glass-bg));
}

.save-button:active {
  transform: translateY(0) scale(0.97);
}

.save-button :deep(.atlas-icon) {
  width: 1rem;
  height: 1rem;
}

.spot-body {
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

.footer-meta {
  gap: var(--space-2);
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
  .spot-media-chrome,
  .overlay-meta,
  .spot-footer {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .spot-body {
    padding: var(--space-4);
  }
}

@media (prefers-reduced-motion: reduce) {
  .spot-card,
  .spot-image,
  .save-button,
  .cta-link {
    transition: none;
  }

  .spot-card:hover,
  .spot-card:focus-within,
  .spot-card:hover .spot-image,
  .spot-card:focus-within .spot-image,
  .save-button:hover,
  .save-button:focus-visible,
  .save-button:active,
  .cta-link:hover,
  .cta-link:focus-visible {
    transform: none;
  }
}
</style>
