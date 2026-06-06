<template>
  <article class="spot-card">
    <div class="spot-media">
      <LazyImage :src="spotImageUrl" :fallback-src="spotImageFallback" :alt="spot.title" class="spot-image" />

      <div class="spot-media-chrome">
        <span class="badge" :class="`badge-${spot.category}`">{{ categoryLabel }}</span>
        <button
          type="button"
          class="save-button"
          :class="{ active: isSaved }"
          :disabled="isSaving"
          :aria-pressed="isSaved"
          :aria-label="isSaved ? `Remove ${spot.title} from saved spots` : `Save ${spot.title}`"
          @click="toggleSaved"
        >
          <ScopeIcon :name="isSaved ? 'heart-filled' : 'heart'" />
        </button>
      </div>
    </div>

    <div class="spot-body">
      <RouterLink :to="spotPath" class="location-row" :aria-label="`Open ${spot.title} details`">
        <ScopeIcon name="pin" />
        <span>{{ locationLabel }}</span>
      </RouterLink>

      <div class="rating-row">
        <span class="rating-pill" :aria-label="`Rated ${ratingLabel} out of 5`">
          <StarRatingDisplay
            :rating="spot.rating"
            :label="`Rated ${ratingLabel} out of 5`"
            :id-prefix="`spot-card-${spot.id}`"
            variant="compact"
          />
          <strong>{{ ratingLabel }}</strong>
        </span>
        <span class="traction">{{ tractionLabel }}</span>
      </div>

      <h3 class="spot-title">{{ spot.title }}</h3>

      <p class="description">{{ descriptionCopy }}</p>

      <div class="spot-footer">
        <div class="footer-meta">
          <span v-if="formattedVibe" class="body-pill">{{ formattedVibe }}</span>
          <span class="footer-copy">{{ footerCopy }}</span>
        </div>

        <RouterLink :to="spotPath" class="cta-link">
          <span>View details</span>
          <ScopeIcon name="arrow-right" />
        </RouterLink>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import LazyImage from '@/components/common/LazyImage.vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import StarRatingDisplay from '@/components/common/StarRatingDisplay.vue';
import { useAuthStore } from '@/stores/auth';
import { useSpotsStore } from '@/stores/spots';
import { useToastStore } from '@/stores/toasts';
import type { SpotSummary } from '@/types';
import { getSpotPhotoFallback, resolveSpotPhotoUrl } from '@/utils/imageFallbacks';
import { formatCategoryLabel, formatCityRegionLocation, formatVibeLabel } from '@/utils/formatters';
import { buildSpotPath } from '@/utils/spotRoutes';

const props = defineProps<{
  spot: SpotSummary;
}>();

const router = useRouter();
const authStore = useAuthStore();
const spotsStore = useSpotsStore();
const toastStore = useToastStore();
const isSaved = ref(Boolean(props.spot.liked));
const isSaving = ref(false);

watch(
  () => props.spot.liked,
  (liked) => {
    isSaved.value = Boolean(liked);
  },
);

function promptLoginToSave(): void {
  toastStore.showInfo({
    title: 'Sign in to save',
    message: 'Create an account or log in to keep this spot in your saved places.',
  });

  const redirectTarget = router.currentRoute.value.fullPath || spotPath.value;
  router.push({ path: '/login', query: { redirect: redirectTarget, intent: 'save' } }).catch(() => undefined);
}

async function toggleSaved() {
  if (isSaving.value) {
    return;
  }

  if (!authStore.isAuthenticated) {
    promptLoginToSave();
    return;
  }

  const previousSavedState = isSaved.value;
  isSaved.value = !previousSavedState;
  isSaving.value = true;

  try {
    const updatedSpot = await spotsStore.toggleLike(props.spot.id);
    isSaved.value = Boolean(updatedSpot.liked);
  } catch {
    isSaved.value = previousSavedState;
    toastStore.showError({
      title: 'Save failed',
      message: 'Scope could not update that saved spot right now.',
    });
  } finally {
    isSaving.value = false;
  }
}

const categoryLabel = computed(() => formatCategoryLabel(props.spot.category));
const CARD_IMAGE_WIDTH = 640;

const spotPath = computed(() => buildSpotPath(props.spot));
const spotImageFallback = computed(() => getSpotPhotoFallback(props.spot.category, CARD_IMAGE_WIDTH));
const spotImageUrl = computed(() => resolveSpotPhotoUrl(props.spot.category, props.spot.photoUrl, CARD_IMAGE_WIDTH));
const ratingLabel = computed(() => props.spot.rating.toFixed(1));
const formattedVibe = computed(() => (props.spot.vibe?.trim() ? formatVibeLabel(props.spot.vibe) : ''));
const locationLabel = computed(() => formatCityRegionLocation(props.spot, 'Location syncing'));
const tractionLabel = computed(() => {
  const likesCount = props.spot.likesCount ?? 0;
  return likesCount > 0 ? `${likesCount} saves` : `${categoryLabel.value} pick`;
});
const descriptionCopy = computed(() => props.spot.description?.trim() || 'Community details are syncing for this spot.');
const footerCopy = computed(() => {
  if (props.spot.author?.displayName) {
    return `Pinned by ${props.spot.author.displayName}`;
  }

  return isSaved.value ? 'Saved to your scope' : 'Open the full detail view';
});
</script>

<style scoped>
.spot-card {
  display: grid;
  grid-template-rows: auto 1fr;
  overflow: hidden;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  transition:
    transform var(--transition-normal),
    box-shadow var(--transition-normal),
    border-color var(--transition-normal);
}

.spot-card:hover,
.spot-card:focus-within {
  transform: translateY(var(--motion-card-lift));
  box-shadow: 0 20px 40px -20px rgba(0, 0, 0, 0.45), 0 8px 16px -12px rgba(0, 0, 0, 0.25);
  border-color: var(--border-hover, color-mix(in srgb, var(--accent-teal) 35%, var(--border)));
}

.spot-media {
  position: relative;
  isolation: isolate;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, var(--accent-teal-light), transparent 38%),
    linear-gradient(180deg, var(--bg-tertiary), var(--bg-secondary));
}

.spot-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-slow);
}

.spot-card:hover .spot-image,
.spot-card:focus-within .spot-image {
  transform: scale(var(--motion-image-zoom));
}

.spot-media-chrome {
  position: absolute;
  top: var(--space-3);
  inset-inline: var(--space-3);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  z-index: 1;
  pointer-events: none;
}

.spot-media-chrome > * {
  pointer-events: auto;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0.35rem 0.7rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--highlight-sheen) 18%, transparent);
  background: color-mix(in srgb, var(--bg-primary) 72%, transparent);
  backdrop-filter: blur(8px) saturate(1.2);
  -webkit-backdrop-filter: blur(8px) saturate(1.2);
  color: var(--text-primary);
  font-size: 0.78rem;
  font-weight: var(--font-weight-semibold);
  text-transform: capitalize;
  letter-spacing: 0.005em;
}

.save-button {
  display: inline-grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--highlight-sheen) 18%, transparent);
  background: color-mix(in srgb, var(--bg-primary) 72%, transparent);
  backdrop-filter: blur(8px) saturate(1.2);
  -webkit-backdrop-filter: blur(8px) saturate(1.2);
  color: var(--text-primary);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    color var(--transition-fast),
    background var(--transition-fast);
}

.save-button:hover,
.save-button:focus-visible {
  transform: scale(1.06);
  color: var(--accent-teal);
  outline: none;
}

.save-button.active {
  color: var(--accent-teal);
  background: color-mix(in srgb, var(--accent-teal) 22%, var(--bg-primary));
}

.save-button :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
}

.spot-body {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5) var(--space-5);
  align-content: start;
  justify-items: center;
  text-align: center;
}

.location-row {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  margin: 0;
  max-width: 100%;
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 500;
  min-width: 0;
  text-decoration: none;
  transition: color var(--transition-fast);
}

.location-row:hover,
.location-row:focus-visible {
  color: var(--text-primary);
  outline: none;
}

.location-row span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.location-row :deep(.scope-icon) {
  width: 0.85rem;
  height: 0.85rem;
  color: var(--accent-teal);
  flex-shrink: 0;
}

.rating-row {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  flex-shrink: 0;
  margin-bottom: var(--space-1);
}

.rating-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-gold) 18%, transparent);
  color: var(--text-primary);
  font-size: 0.78rem;
  font-weight: var(--font-weight-semibold);
  line-height: 1;
}

.traction {
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 500;
}

.spot-title {
  margin: 0;
  font-size: clamp(1.05rem, 1.4vw, 1.2rem);
  line-height: 1.25;
  letter-spacing: -0.015em;
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
  text-align: center;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.description {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
  text-align: center;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.spot-footer {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  width: 100%;
  margin-top: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  text-align: left;
}

.footer-meta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  flex-wrap: wrap;
}

.body-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 14%, transparent);
  color: var(--accent-teal);
  font-size: 0.74rem;
  font-weight: var(--font-weight-semibold);
  text-transform: capitalize;
  letter-spacing: 0.02em;
}

.footer-copy {
  color: var(--text-secondary);
  font-size: 0.78rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.cta-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.55rem;
  border-radius: var(--radius-md);
  color: var(--accent-teal);
  font-size: 0.82rem;
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  transition:
    transform var(--transition-fast),
    color var(--transition-fast),
    background var(--transition-fast);
  flex-shrink: 0;
  align-self: flex-start;
  margin-left: 0;
}

.cta-link :deep(.scope-icon) {
  width: 0.85rem;
  height: 0.85rem;
  transition: transform var(--transition-fast);
}

.cta-link:hover,
.cta-link:focus-visible {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--accent-teal) 18%, transparent);
  outline: none;
}

.cta-link:hover :deep(.scope-icon),
.cta-link:focus-visible :deep(.scope-icon) {
  transform: translateX(2px);
}

@media (max-width: 720px) {
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
