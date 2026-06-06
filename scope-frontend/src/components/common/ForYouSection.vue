<template>
  <section v-if="spots.length" class="for-you-panel" aria-labelledby="for-you-title">
    <div class="for-you-header">
      <div>
        <p class="eyebrow">For You</p>
        <h2 id="for-you-title">Personalized picks based on your interests</h2>
        <p class="section-copy">Places that line up with your saved tastes, recent signals, and the strongest Scope activity nearby.</p>
      </div>
      <span class="for-you-pill">{{ spots.length }} matches</span>
    </div>

    <div class="for-you-grid stagger-in">
      <RouterLink
        v-for="(spot, index) in spots"
        :key="spot.id"
        :to="buildSpotPath(spot)"
        class="for-you-card"
        :style="{ '--scope-stagger-index': index }"
      >
        <span class="for-you-card__media">
          <LazyImage
            :src="resolveSpotImage(spot)"
            :fallback-src="resolveSpotImageFallback(spot)"
            :alt="spot.title"
            class="for-you-card__image"
          />
          <span class="for-you-card__media-chrome">
            <span class="badge for-you-card__category" :class="`badge-${spot.category}`">{{ formatCategoryLabel(spot.category) }}</span>
            <span class="for-you-card__rank">#{{ index + 1 }}</span>
          </span>
        </span>

        <div class="for-you-card__copy">
          <span class="for-you-card__location">
            <ScopeIcon name="pin" />
            <span>{{ formatLocation(spot) }}</span>
          </span>

          <h3>{{ spot.title }}</h3>
          <p>{{ formatDescription(spot) }}</p>

          <div class="for-you-card__rating">
            <span class="for-you-card__rating-pill">
              <StarRatingDisplay
                :rating="spot.rating"
                :label="`Rated ${spot.rating.toFixed(1)} out of 5`"
                :id-prefix="`for-you-${spot.id}`"
                variant="compact"
              />
              <strong>{{ spot.rating.toFixed(1) }}</strong>
            </span>
            <span class="for-you-card__reason">{{ resolveRecommendationReason(spot) }}</span>
          </div>
        </div>
      </RouterLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import LazyImage from '@/components/common/LazyImage.vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import StarRatingDisplay from '@/components/common/StarRatingDisplay.vue';
import { recommendSpots } from '@/services/intelService';
import { useAuthStore } from '@/stores/auth';
import type { SpotSummary } from '@/types';
import { getSpotPhotoFallback, resolveSpotPhotoUrl } from '@/utils/imageFallbacks';
import { formatCategoryLabel, formatCityRegionLocation, formatVibeLabel } from '@/utils/formatters';
import { buildSpotPath } from '@/utils/spotRoutes';
import { normalizeUserVibes } from '@/utils/userPreferenceSignals';

const authStore = useAuthStore();
const spots = ref<SpotSummary[]>([]);
const CARD_IMAGE_WIDTH = 520;
const recommendationInterests = computed(() =>
  normalizeUserVibes(authStore.currentUser?.interests, { includeSurprise: false }),
);
let recommendationRequestId = 0;

function formatLocation(spot: SpotSummary): string {
  return formatCityRegionLocation(spot, 'Scope recommendation');
}

function formatDescription(spot: SpotSummary): string {
  const description = spot.description?.trim();
  if (description) {
    return description;
  }

  const vibe = spot.vibe?.trim();
  if (vibe) {
    return `${formatVibeLabel(vibe)} energy with enough community signal to make the shortlist.`;
  }

  return `A strong ${formatCategoryLabel(spot.category).toLowerCase()} pick from the current Scope graph.`;
}

function resolveSpotImage(spot: SpotSummary): string {
  return resolveSpotPhotoUrl(spot.category, spot.photoUrl, CARD_IMAGE_WIDTH);
}

function resolveSpotImageFallback(spot: SpotSummary): string {
  return getSpotPhotoFallback(spot.category, CARD_IMAGE_WIDTH);
}

function resolveRecommendationReason(spot: SpotSummary): string {
  const interests = recommendationInterests.value;
  if (interests.includes(spot.category)) {
    return `${formatCategoryLabel(spot.category)} match`;
  }

  if ((spot.likesCount ?? 0) > 0) {
    return `${spot.likesCount} saves`;
  }

  return spot.vibe?.trim() ? formatVibeLabel(spot.vibe) : 'Scope signal';
}

async function loadRecommendations() {
  if (!authStore.isAuthenticated) {
    spots.value = [];
    return;
  }

  const requestId = ++recommendationRequestId;

  try {
    const interests = recommendationInterests.value;
    const result = await recommendSpots({
      interests: interests.length ? interests : undefined,
      limit: 6,
    });

    if (requestId === recommendationRequestId) {
      spots.value = result.data;
    }
  } catch {
    // Personalized recommendations are best-effort.
  }
}

watch(
  () => [authStore.isAuthenticated, recommendationInterests.value.join('|')] as const,
  () => {
    void loadRecommendations();
  },
  { immediate: true },
);
</script>

<style scoped>
.for-you-panel {
  position: relative;
  display: grid;
  gap: clamp(var(--space-5), 2vw, var(--space-7));
  padding: clamp(var(--space-5), 3vw, var(--space-8));
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, var(--border));
  border-radius: var(--radius-2xl);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent-teal) 9%, transparent), transparent 38%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 98%, transparent), color-mix(in srgb, var(--bg-primary) 84%, var(--bg-secondary)));
  box-shadow: var(--shadow-lg);
}

.for-you-panel::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 1px;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent-teal) 58%, transparent), transparent);
  pointer-events: none;
}

.for-you-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: clamp(var(--space-4), 2vw, var(--space-7));
}

.for-you-header h2,
.for-you-header p {
  margin: 0;
}

.for-you-header h2 {
  font-size: clamp(1.6rem, 2.4vw, 2.35rem);
  line-height: var(--line-height-tight);
}

.for-you-header .section-copy {
  max-width: 46rem;
  margin-top: var(--space-2);
}

.for-you-pill {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  min-height: 2.4rem;
  padding: 0.45rem 0.85rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 28%, var(--border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 10%, var(--bg-secondary));
  color: var(--accent-teal);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.for-you-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: clamp(var(--space-4), 1.4vw, var(--space-5));
  align-items: stretch;
}

.for-you-card {
  display: grid;
  grid-template-rows: auto 1fr;
  min-width: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--highlight-sheen) 10%, var(--border));
  border-radius: var(--radius-xl);
  color: var(--text-primary);
  text-decoration: none;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-tertiary) 88%, transparent), color-mix(in srgb, var(--bg-secondary) 96%, transparent));
  box-shadow: var(--shadow-sm);
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.for-you-card:hover,
.for-you-card:focus-visible {
  outline: none;
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--accent-teal) 38%, var(--glass-border));
  box-shadow: var(--shadow-lg);
}

.for-you-card__media {
  position: relative;
  isolation: isolate;
  display: block;
  aspect-ratio: 16 / 11;
  overflow: hidden;
  background: var(--bg-tertiary);
}

.for-you-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.01);
  transition: transform var(--transition-slow), filter var(--transition-slow);
}

.for-you-card:hover .for-you-card__image,
.for-you-card:focus-visible .for-you-card__image {
  transform: scale(var(--motion-image-zoom));
  filter: saturate(1.06) contrast(1.02);
}

.for-you-card__media::after {
  content: '';
  position: absolute;
  inset: auto 0 0;
  height: 58%;
  background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--bg-primary) 78%, transparent));
  pointer-events: none;
  z-index: 1;
}

.for-you-card__media-chrome {
  position: absolute;
  inset: var(--space-3);
  z-index: 2;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.for-you-card__category {
  max-width: min(100%, 9rem);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-color: color-mix(in srgb, var(--highlight-sheen) 18%, transparent);
  background: color-mix(in srgb, var(--bg-primary) 68%, transparent);
  backdrop-filter: blur(8px) saturate(1.2);
  -webkit-backdrop-filter: blur(8px) saturate(1.2);
}

.for-you-card__rank {
  display: inline-grid;
  place-items: center;
  min-width: 2rem;
  height: 2rem;
  padding-inline: 0.45rem;
  border: 1px solid color-mix(in srgb, var(--highlight-sheen) 18%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 68%, transparent);
  color: var(--text-primary);
  font-size: 0.74rem;
  font-weight: var(--font-weight-bold);
  font-variant-numeric: tabular-nums;
  backdrop-filter: blur(8px) saturate(1.2);
  -webkit-backdrop-filter: blur(8px) saturate(1.2);
}

.for-you-card__copy {
  display: grid;
  gap: var(--space-3);
  align-content: start;
  padding: var(--space-4);
  min-width: 0;
}

.for-you-card__copy h3,
.for-you-card__copy p {
  margin: 0;
}

.for-you-card__copy h3 {
  font-size: clamp(1rem, 1vw, 1.12rem);
  line-height: var(--line-height-tight);
  letter-spacing: 0;
}

.for-you-card__copy p {
  display: -webkit-box;
  min-height: 2.9em;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 0.84rem;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.for-you-card__rating {
  display: grid;
  justify-items: start;
  gap: 0.45rem;
  min-width: 0;
}

.for-you-card__rating-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--text-primary);
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  font-weight: var(--font-weight-semibold);
}

.for-you-card__rating-pill :deep(.star-rating) {
  font-size: 0.82rem;
}

.for-you-card__location {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 500;
}

.for-you-card__location span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.for-you-card__location :deep(.scope-icon) {
  width: 0.84rem;
  height: 0.84rem;
  flex-shrink: 0;
  color: var(--accent-teal);
}

.for-you-card__reason {
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  padding: 0.28rem 0.52rem;
  border: 1px solid color-mix(in srgb, var(--accent-gold) 22%, var(--border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-gold) 9%, transparent);
  color: color-mix(in srgb, var(--accent-gold) 82%, var(--text-primary));
  font-size: 0.72rem;
  font-weight: var(--font-weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1540px) {
  .for-you-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 920px) {
  .for-you-header {
    align-items: start;
    flex-direction: column;
  }

  .for-you-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 620px) {
  .for-you-panel {
    padding: var(--space-5);
  }

  .for-you-grid {
    grid-template-columns: 1fr;
  }
}
</style>
