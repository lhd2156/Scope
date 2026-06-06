<template>
  <section v-if="spot" class="spot-detail page-stack">
    <section class="glass-panel gallery-panel" data-test="spot-gallery">
      <div class="hero-gallery">
        <button
          v-if="activeGalleryPhoto"
          type="button"
          class="hero-gallery__button"
          :aria-label="`Open featured photo of ${spot.title}`"
          @click="selectedPhotoId = activeGalleryPhoto.id"
        >
          <LazyImage
            :src="activeGalleryPhoto.url"
            :fallback-src="heroImageFallback"
            :alt="activeGalleryPhoto.caption || spot.title"
            class="hero-gallery__image"
            eager
          />
          <span class="hero-gallery__overlay"></span>
          <div class="hero-gallery__copy">
            <p class="eyebrow">Photo gallery</p>
            <strong>{{ activeGalleryPhoto.caption || `${spot.title} featured view` }}</strong>
            <div class="hero-gallery__meta" aria-label="Photo gallery details">
              <span class="hero-gallery__meta-item" data-test="spot-photo-count">
                <ScopeIcon name="camera" label="Photo count" />
                <span>{{ photoCountLabel }}</span>
              </span>
              <span class="hero-gallery__meta-item" data-test="spot-photo-curation">
                <ScopeIcon name="sparkle" label="Curated gallery" />
                <span>Curated travel angles</span>
              </span>
            </div>
          </div>
        </button>

        <div v-else class="hero-gallery__placeholder">
          <p class="eyebrow">Photo gallery</p>
          <strong>{{ categoryLabel }}</strong>
          <span>Hero photography is still syncing for this pin.</span>
        </div>
      </div>

      <div class="thumbnail-grid">
        <button
          v-for="photo in thumbnailPhotos"
          :key="photo.id"
          type="button"
          class="thumbnail-card"
          :class="{ 'is-active': photo.id === activeGalleryPhoto?.id }"
          :aria-label="`Show ${photo.caption || spot.title}`"
          data-test="gallery-thumb"
          @click="selectedPhotoId = photo.id"
        >
          <LazyImage :src="photo.url" :fallback-src="heroImageFallback" :alt="photo.caption || spot.title" class="thumbnail-card__image" />
          <span class="thumbnail-card__overlay"></span>
          <span class="thumbnail-card__copy">{{ photo.caption || 'Travel angle' }}</span>
        </button>
      </div>
    </section>

    <section class="headline-shell">
      <div class="headline-stack">
        <div class="headline-meta">
          <span class="badge headline-badge" :class="`badge-${spot.category}`">{{ categoryLabel }}</span>
          <div class="rating-cluster" aria-label="Spot rating overview">
            <StarRatingDisplay
              :rating="averageRatingNumber"
              :label="`Rated ${averageRating} out of 5`"
              id-prefix="spot-hero"
              variant="spot-detail"
            />
            <strong>{{ averageRating }}</strong>
            <span>{{ reviewCountLabel }}</span>
          </div>
        </div>

        <div class="headline-copy">
          <h1>{{ spot.title }}</h1>
          <p class="location-line">
            <ScopeIcon name="map" label="Location" />
            <span>{{ locationLine }}</span>
          </p>
          <p class="headline-description">{{ spot.description }}</p>
        </div>
      </div>

      <div class="action-row" data-test="spot-actions">
        <RouterLink class="button button-primary action-button" :to="tripPlannerLink">
          <ScopeIcon name="plus" label="Add to trip" />
          <span>Add to Trip</span>
        </RouterLink>

        <button type="button" class="button button-secondary action-button" @click="handleShare">
          <ScopeIcon name="share" label="Share" />
          <span>Share</span>
        </button>

        <button
          type="button"
          class="button action-button save-button"
          :class="isSaved ? 'save-button--active' : 'save-button--idle'"
          :disabled="savingSavedState"
          :aria-pressed="String(isSaved)"
          :aria-label="isSaved ? `Remove ${spot.title} from saved spots` : `Save ${spot.title}`"
          @click="toggleSaved"
        >
          <ScopeIcon :name="isSaved ? 'heart-filled' : 'heart'" :label="isSaved ? 'Saved' : 'Save'" />
          <span>{{ isSaved ? 'Saved' : 'Save' }}</span>
        </button>
      </div>
    </section>

    <div class="detail-layout">
      <div class="content-column">
        <section class="glass-panel section-panel section-panel--overview">
          <div class="section-heading">
            <div class="section-heading__titles">
              <p class="eyebrow">Overview</p>
              <h2>Why travelers bookmark this stop</h2>
            </div>
            <span class="metric-pill">{{ saveCountLabel }} saves</span>
          </div>

          <div class="overview-stack">
            <p class="section-copy section-copy--lead">{{ spot.description }}</p>
            <p class="section-copy">{{ overviewCopy }}</p>
          </div>

          <div class="highlight-grid">
            <article v-for="fact in highlightCards" :key="fact.label" class="glass-info-card">
              <p>{{ fact.label }}</p>
              <strong>{{ fact.value }}</strong>
              <span>{{ fact.copy }}</span>
            </article>
          </div>
        </section>

        <section class="glass-panel section-panel section-panel--reviews reviews-panel">
          <div class="section-heading reviews-heading">
            <div class="section-heading__titles">
              <p class="eyebrow">Reviews</p>
              <h2>{{ reviewCountLabel }}</h2>
            </div>
            <div class="reviews-summary" role="group" :aria-label="`Rated ${averageRating} out of 5`">
              <StarRatingDisplay
                :rating="averageRatingNumber"
                :label="`Rated ${averageRating} out of 5`"
                id-prefix="review-summary"
                variant="spot-detail"
              />
              <strong class="reviews-summary__score">{{ averageRating }}</strong>
            </div>
          </div>

          <p v-if="reviewErrorMessage" class="review-error" role="alert">{{ reviewErrorMessage }}</p>
          <ReviewList :reviews="displayReviews" />

          <article class="glass-panel review-form-panel">
            <div v-if="authStore.isAuthenticated" class="review-form-stack">
              <ReviewForm :submitting="submittingReview" @submit="handleReviewSubmit" />
            </div>
            <div v-else class="review-cta">
              <h3>Want to leave a review?</h3>
              <p class="section-copy">Sign in so your take on this stop can shape itinerary quality and social proof.</p>
              <RouterLink class="button button-secondary" to="/login">Log in to review</RouterLink>
            </div>
          </article>
        </section>
      </div>

      <aside class="sidebar-column">
        <section class="glass-panel section-panel map-panel">
          <div class="map-panel__heading">
            <div class="section-heading__titles">
              <p class="eyebrow">Mini-map</p>
              <h2>Where it sits on the route</h2>
            </div>
            <div class="map-time-hint">
              <span class="map-time-hint__label">Ideal visit</span>
              <span class="map-time-hint__value">{{ travelCue.window }}</span>
            </div>
          </div>

          <div class="mini-map-shell">
            <MapView :spots="miniMapSpots" :selected-spot-id="spot.id" :show-location-tracker="false" />
          </div>
        </section>

        <section class="glass-panel section-panel info-panel">
          <div class="section-heading">
            <div class="section-heading__titles">
              <p class="eyebrow">Scope snapshot</p>
              <h2>Quick planning notes</h2>
            </div>
          </div>

          <dl class="detail-list">
            <div class="detail-row">
              <dt>Address</dt>
              <dd>{{ addressLine }}</dd>
            </div>
            <div class="detail-row">
              <dt>Category</dt>
              <dd>{{ categoryLabel }}</dd>
            </div>
            <div class="detail-row">
              <dt>Vibe</dt>
              <dd>{{ vibeLabel }}</dd>
            </div>
            <div class="detail-row">
              <dt>Pinned</dt>
              <dd>{{ publishedLabel }}</dd>
            </div>
          </dl>
        </section>

        <section class="glass-panel section-panel info-panel info-panel--accent">
          <div class="section-heading">
            <div class="section-heading__titles">
              <p class="eyebrow">Trip fit</p>
              <h2>{{ tripFitHeading }}</h2>
            </div>
          </div>

          <div class="trip-fit-stack">
            <p class="section-copy">{{ tripFitCopy }}</p>
            <div class="route-cue-list">
              <article class="route-cue-card">
                <p>Best window</p>
                <strong>{{ travelCue.window }}</strong>
              </article>
              <article class="route-cue-card">
                <p>Pairs with</p>
                <strong>{{ travelCue.pairing }}</strong>
              </article>
              <article class="route-cue-card">
                <p>Route energy</p>
                <strong>{{ travelCue.energy }}</strong>
              </article>
            </div>
          </div>
        </section>
      </aside>
    </div>

    <section class="glass-panel section-panel similar-panel">
      <div class="section-heading similar-heading">
        <div class="section-heading__titles">
          <p class="eyebrow">Similar spots</p>
          <h2>Keep the route going</h2>
        </div>
        <RouterLink class="similar-link" to="/explore">View all</RouterLink>
      </div>

      <div v-if="similarSpots.length" class="similar-rail" data-test="similar-spots">
        <RouterLink
          v-for="similarSpot in similarSpots"
          :key="similarSpot.id"
          :to="buildSpotPath(similarSpot)"
          class="similar-card"
        >
          <div class="similar-card__media">
            <LazyImage
              :src="resolveSpotPhotoUrl(similarSpot.category, similarSpot.photoUrl || heroImageUrl, 720)"
              :fallback-src="getSpotPhotoFallback(similarSpot.category, 720)"
              :alt="similarSpot.title"
              class="similar-card__image"
            />
            <span class="similar-card__overlay"></span>
            <div class="similar-card__topline">
              <span class="badge" :class="`badge-${similarSpot.category}`">{{ formatCategory(similarSpot.category) }}</span>
              <span class="similar-card__rating" :aria-label="`Rated ${similarSpot.rating.toFixed(1)} out of 5`">
                <StarRatingDisplay
                  :rating="similarSpot.rating"
                  :label="`Rated ${similarSpot.rating.toFixed(1)} out of 5`"
                  :id-prefix="`similar-${similarSpot.id}`"
                />
                <span>{{ similarSpot.rating.toFixed(1) }}</span>
              </span>
            </div>
            <div class="similar-card__copy">
              <strong>{{ similarSpot.title }}</strong>
              <span>{{ formatSimilarLocation(similarSpot) }}</span>
            </div>
          </div>
        </RouterLink>
      </div>

      <article v-else class="empty-state-panel">
        <p class="eyebrow">Nearby inspiration</p>
        <strong>{{ loadingSimilar ? 'Scanning nearby Scope pins' : 'No similar spots yet' }}</strong>
        <p>{{ loadingSimilar ? 'Pulling neighboring stops with matching energy and category context.' : 'Once more community pins land around this route, similar recommendations will appear here.' }}</p>
      </article>
    </section>

    <Toast
      v-if="showReviewToast"
      title="Review added"
      message="Your review was saved and synced to the live spot detail."
      tone="success"
      @close="showReviewToast = false"
    />

    <Toast
      v-if="showShareToast"
      title="Link copied"
      message="This spot link is ready to paste into messages, trip docs, or your travel group chat."
      tone="success"
      @close="showShareToast = false"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import StarRatingDisplay from '@/components/common/StarRatingDisplay.vue';
import Toast from '@/components/common/Toast.vue';
import { createSpotReview, listNearbySpots, listSpotReviews } from '@/services/spotService';
import { useAuthStore } from '@/stores/auth';
import { useSpotsStore } from '@/stores/spots';
import { useToastStore } from '@/stores/toasts';
import type { MapPoint, Photo, Review, SpotDetail as SpotDetailModel, SpotSummary } from '@/types';
import { getSpotPhotoFallback, resolveSpotPhotoUrl } from '@/utils/imageFallbacks';
import { scheduleNonCriticalTask, type CancelScheduledTask } from '@/utils/scheduleNonCriticalTask';
import { formatVibeLabel } from '@/utils/formatters';
import { buildSpotPath } from '@/utils/spotRoutes';
import { SPOT_TRAVEL_CUES } from '@/config/spotTravelCues';

const DESIRED_GALLERY_SIZE = 5;
const regionNameFormatter = typeof Intl !== 'undefined' && 'DisplayNames' in Intl
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null;

const props = defineProps<{
  spot: SpotDetailModel | null;
}>();

const MapView = defineAsyncComponent(() => import('@/components/map/MapView.vue'));
const ReviewForm = defineAsyncComponent(() => import('@/components/spots/ReviewForm.vue'));
const ReviewList = defineAsyncComponent(() => import('@/components/spots/ReviewList.vue'));

const router = useRouter();
const authStore = useAuthStore();
const spotsStore = useSpotsStore();
const toastStore = useToastStore();
const persistedReviews = ref<Review[]>([]);
const isSaved = ref(false);
const savingSavedState = ref(false);
const submittingReview = ref(false);
const selectedPhotoId = ref('');
const similarSpots = ref<SpotSummary[]>([]);
const loadingSimilar = ref(false);
const showReviewToast = ref(false);
const showShareToast = ref(false);
const reviewErrorMessage = ref('');
let cancelSimilarSpotsLoad: CancelScheduledTask = () => undefined;

function formatCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function formatRegion(region?: string): string {
  if (!region) {
    return '';
  }

  const normalizedRegion = region.trim();
  if (!normalizedRegion) {
    return '';
  }

  if (/^[A-Za-z]{2}$/.test(normalizedRegion) && regionNameFormatter) {
    return regionNameFormatter.of(normalizedRegion.toUpperCase()) ?? normalizedRegion.toUpperCase();
  }

  return normalizedRegion;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function duplicatePhoto(photo: Photo, index: number): Photo {
  return {
    id: `${photo.id}-variant-${index}`,
    url: photo.url,
    caption: photo.caption,
  };
}

const SPOT_DETAIL_HERO_IMAGE_WIDTH = 1200;

const categoryLabel = computed(() => (props.spot ? formatCategory(props.spot.category) : 'Spot'));
const heroImageFallback = computed(() => getSpotPhotoFallback(props.spot?.category ?? 'scenic', SPOT_DETAIL_HERO_IMAGE_WIDTH));
const heroImageUrl = computed(() => {
  if (!props.spot) {
    return heroImageFallback.value;
  }

  return resolveSpotPhotoUrl(props.spot.category, props.spot.photoUrl ?? props.spot.photos[0]?.url, SPOT_DETAIL_HERO_IMAGE_WIDTH);
});
const travelCue = computed(() => (props.spot ? SPOT_TRAVEL_CUES[props.spot.category] : SPOT_TRAVEL_CUES.other));
const galleryPhotos = computed<Photo[]>(() => {
  if (!props.spot) {
    return [];
  }

  const sourcePhotos = props.spot.photos.length
    ? props.spot.photos.filter((photo) => Boolean(photo.url))
    : heroImageUrl.value
      ? [{ id: `${props.spot.id}-hero-photo`, url: heroImageUrl.value, caption: props.spot.title }]
      : [];

  if (!sourcePhotos.length) {
    return [];
  }

  if (sourcePhotos.length >= DESIRED_GALLERY_SIZE) {
    return sourcePhotos.slice(0, DESIRED_GALLERY_SIZE);
  }

  const expandedPhotos = [...sourcePhotos];
  for (let index = sourcePhotos.length; index < DESIRED_GALLERY_SIZE; index += 1) {
    expandedPhotos.push(duplicatePhoto(sourcePhotos[index % sourcePhotos.length], index));
  }

  return expandedPhotos;
});
const activeGalleryPhoto = computed(() => galleryPhotos.value.find((photo) => photo.id === selectedPhotoId.value) ?? galleryPhotos.value[0] ?? null);
const thumbnailPhotos = computed(() => galleryPhotos.value.slice(1, DESIRED_GALLERY_SIZE));
const locationLine = computed(() => {
  if (!props.spot) {
    return '';
  }

  const locationParts = [props.spot.city, formatRegion(props.spot.country)].filter((value): value is string => Boolean(value));
  if (locationParts.length) {
    return locationParts.join(', ');
  }

  return props.spot.address || 'Scope location pending';
});
const addressLine = computed(() => props.spot?.address || 'Shared in-app once the content engine syncs the full address data.');
const vibeLabel = computed(() =>
  formatVibeLabel(props.spot?.vibe?.trim() || 'community curated'),
);
const photoCountLabel = computed(() => {
  const totalPhotos = galleryPhotos.value.length;
  return `${totalPhotos} photo${totalPhotos === 1 ? '' : 's'}`;
});
const displayReviews = computed(() => persistedReviews.value.length ? persistedReviews.value : props.spot?.reviews ?? []);
const reviewCountLabel = computed(() => {
  const totalReviews = displayReviews.value.length;
  return `${totalReviews} review${totalReviews === 1 ? '' : 's'}`;
});
const averageRatingNumber = computed(() => {
  if (!props.spot) {
    return 0;
  }

  return props.spot.rating;
});
const averageRating = computed(() => averageRatingNumber.value.toFixed(1));
const publishedLabel = computed(() => (props.spot ? formatDate(props.spot.createdAt) : ''));
const saveCount = computed(() => {
  const baseLikesCount = props.spot?.likesCount ?? 0;
  if (!props.spot) {
    return 0;
  }

  if (isSaved.value === Boolean(props.spot.liked)) {
    return baseLikesCount;
  }

  return Math.max(0, baseLikesCount + (isSaved.value ? 1 : -1));
});
const saveCountLabel = computed(() => {
  const totalSaves = saveCount.value;
  if (!totalSaves) {
    return isSaved.value ? '1' : 'Fresh';
  }

  return String(totalSaves);
});
const overviewCopy = computed(() => {
  if (!props.spot) {
    return '';
  }

  const routeSummaryLead = props.spot.category === 'food'
    ? 'Excellent anchor stop for an evening route.'
    : `${props.spot.title} plays best as a ${travelCue.value.energy.toLowerCase()} for a ${categoryLabel.value.toLowerCase()}-leaning itinerary.`;

  return `${routeSummaryLead} Travelers consistently call out the ${vibeLabel.value.toLowerCase()} tone, which makes it easy to sequence before or after ${travelCue.value.pairing.toLowerCase()} moments.`;
});
const tripFitHeading = computed(() => {
  if (!props.spot) {
    return 'Flexible stop';
  }

  if (props.spot.rating >= 4.8) {
    return 'Premium itinerary anchor';
  }

  if (props.spot.rating >= 4.5) {
    return 'Strong supporting highlight';
  }

  return 'Flexible discovery stop';
});
const tripFitCopy = computed(() => {
  if (!props.spot) {
    return '';
  }

  if (props.spot.rating >= 4.8) {
    return 'This spot is strong enough to anchor a day plan on its own. Use it as the emotional high point, then wrap supporting scenic or social stops around it.';
  }

  if (props.spot.rating >= 4.5) {
    return 'Best used as a high-confidence midpoint or closer. It gives the route polish without forcing the entire itinerary to revolve around one pin.';
  }

  return 'Treat this as a flexible optional stop that adds texture when you are already in the area.';
});
const highlightCards = computed(() => [
  {
    label: 'Best window',
    value: travelCue.value.window,
    copy: 'Plan your arrival around the strongest light, energy, and crowd flow.',
  },
  {
    label: 'Pairs with',
    value: travelCue.value.pairing,
    copy: 'Blend this stop with nearby categories for a smoother premium route.',
  },
  {
    label: 'Community pulse',
    value: `${averageRating.value} avg, ${saveCountLabel.value} saves`,
    copy: 'Social proof stays visible so travelers can gauge confidence at a glance.',
  },
]);
const tripPlannerLink = computed(() => (props.spot ? `/trips/new?spot=${encodeURIComponent(props.spot.id)}` : '/trips/new'));
const spotPath = computed(() => (props.spot ? buildSpotPath(props.spot) : '/explore'));
const miniMapSpots = computed<MapPoint[]>(() => {
  if (!props.spot) {
    return [];
  }

  return [
    {
      id: props.spot.id,
      title: props.spot.title,
      latitude: props.spot.latitude,
      longitude: props.spot.longitude,
      category: props.spot.category,
      ...(props.spot.city ? { city: props.spot.city } : {}),
      ...(props.spot.vibe ? { vibe: props.spot.vibe } : {}),
      rating: props.spot.rating,
      /* Same resolved URL as the hero so the map pin can show a thumbnail, not a flat icon. */
      photoUrl: heroImageUrl.value,
    },
  ];
});

function formatSimilarLocation(spotSummary: SpotSummary): string {
  const locationParts = [spotSummary.city, formatRegion(spotSummary.country)].filter((value): value is string => Boolean(value));
  return locationParts.join(', ') || 'Scope discovery';
}

async function loadSimilarSpots(spot: SpotDetailModel | null): Promise<void> {
  if (!spot) {
    similarSpots.value = [];
    return;
  }

  loadingSimilar.value = true;

  try {
    const response = await listNearbySpots({
      latitude: spot.latitude,
      longitude: spot.longitude,
      radiusKm: 350,
      page: 1,
      pageSize: 8,
    });

    similarSpots.value = response.data
      .filter((candidate) => candidate.id !== spot.id)
      .sort((left, right) => {
        const categoryBias = Number(right.category === spot.category) - Number(left.category === spot.category);
        if (categoryBias !== 0) {
          return categoryBias;
        }

        return right.rating - left.rating;
      })
      .slice(0, 5);
  } catch {
    similarSpots.value = [];
  } finally {
    loadingSimilar.value = false;
  }
}

async function loadPersistedReviews(spotId: string): Promise<void> {
  try {
    const response = await listSpotReviews(spotId);
    persistedReviews.value = response.data;
    reviewErrorMessage.value = '';
  } catch {
    persistedReviews.value = props.spot?.reviews ?? [];
    reviewErrorMessage.value = 'Scope could not refresh live reviews right now.';
  }
}

async function handleReviewSubmit(payload: { rating: number; comment: string }) {
  if (!props.spot) {
    return;
  }

  submittingReview.value = true;
  reviewErrorMessage.value = '';

  try {
    await createSpotReview(props.spot.id, payload);
    await loadPersistedReviews(props.spot.id);
    await spotsStore.fetchSpot(props.spot.id).catch(() => undefined);
    showReviewToast.value = true;
  } catch {
    reviewErrorMessage.value = 'Scope could not publish that review right now.';
  } finally {
    submittingReview.value = false;
  }
}

async function handleShare(): Promise<void> {
  if (!props.spot) {
    return;
  }

  const shareUrl = typeof window === 'undefined'
    ? spotPath.value
    : new URL(spotPath.value, window.location.origin).toString();

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareUrl);
    }
  } finally {
    showShareToast.value = true;
  }
}

async function toggleSaved(): Promise<void> {
  if (!props.spot || savingSavedState.value) {
    return;
  }

  if (!authStore.isAuthenticated) {
    toastStore.showInfo({
      title: 'Sign in to save',
      message: 'Create an account or log in to keep this spot in your saved places.',
    });
    router.push({ path: '/login', query: { redirect: spotPath.value, intent: 'save' } }).catch(() => undefined);
    return;
  }

  const previousSavedState = isSaved.value;
  isSaved.value = !previousSavedState;
  savingSavedState.value = true;

  try {
    const updatedSpot = await spotsStore.toggleLike(props.spot.id);
    isSaved.value = Boolean(updatedSpot.liked);
  } catch {
    isSaved.value = previousSavedState;
  } finally {
    savingSavedState.value = false;
  }
}

watch(
  () => props.spot,
  (spot) => {
    cancelSimilarSpotsLoad();
    isSaved.value = Boolean(spot?.liked);
    savingSavedState.value = false;
    persistedReviews.value = spot?.reviews ?? [];
    submittingReview.value = false;
    reviewErrorMessage.value = '';
    showReviewToast.value = false;
    showShareToast.value = false;
    selectedPhotoId.value = galleryPhotos.value[0]?.id ?? '';

    if (!spot) {
      similarSpots.value = [];
      return;
    }

    cancelSimilarSpotsLoad = scheduleNonCriticalTask(() => loadSimilarSpots(spot), {
      delayMs: 220,
      timeoutMs: 1_200,
    });
    void loadPersistedReviews(spot.id);
  },
  { immediate: true },
);

watch(
  galleryPhotos,
  (photos) => {
    if (!photos.length) {
      selectedPhotoId.value = '';
      return;
    }

    if (!photos.some((photo) => photo.id === selectedPhotoId.value)) {
      selectedPhotoId.value = photos[0]?.id ?? '';
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  cancelSimilarSpotsLoad();
});
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: var(--space-6);
}

.gallery-panel,
.section-panel,
.review-form-panel,
.glass-info-card,
.route-cue-card,
.similar-card,
.thumbnail-card,
.empty-state-panel {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-md);
}

.gallery-panel,
.section-panel,
.info-panel,
.review-form-panel,
.empty-state-panel {
  border-radius: var(--radius-2xl);
}

.gallery-panel,
.section-panel {
  overflow: hidden;
}

.gallery-panel {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-4);
}

.hero-gallery,
.hero-gallery__button,
.hero-gallery__placeholder,
.thumbnail-card,
.similar-card__media,
.mini-map-shell {
  overflow: hidden;
  position: relative;
}

.hero-gallery,
.hero-gallery__button,
.hero-gallery__placeholder {
  min-height: 0;
  border-radius: var(--radius-2xl);
}

.hero-gallery__button,
.thumbnail-card {
  width: 100%;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
}

.hero-gallery__button,
.hero-gallery__placeholder {
  display: block;
  aspect-ratio: 21 / 9;
}

.hero-gallery__placeholder {
  display: grid;
  place-content: center;
  gap: var(--space-2);
  padding: var(--space-6);
  text-align: center;
  background:
    radial-gradient(circle at top left, var(--accent-teal-light), transparent 30%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-tertiary) 92%, transparent), color-mix(in srgb, var(--bg-secondary) 94%, transparent));
}

.hero-gallery__placeholder strong,
.hero-gallery__copy strong,
.headline-copy h1,
.section-heading h2,
.review-cta h3,
.empty-state-panel strong,
.glass-info-card strong,
.route-cue-card strong,
.similar-card__copy strong,
.reviews-summary strong {
  margin: 0;
  color: var(--text-primary);
}

.hero-gallery__placeholder span,
.hero-gallery__copy span,
.headline-description,
.location-line,
.section-copy,
.detail-row dt,
.detail-row dd,
.review-cta p,
.empty-state-panel p,
.glass-info-card span,
.similar-card__copy span,
.thumbnail-card__copy {
  color: var(--text-secondary);
}

.headline-description {
  line-height: 1.55;
  max-width: 65ch;
}

.hero-gallery__image,
.thumbnail-card__image,
.similar-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-slow);
}

.hero-gallery__overlay,
.thumbnail-card__overlay,
.similar-card__overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.hero-gallery__overlay {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--bg-primary) 8%, transparent) 0%,
    color-mix(in srgb, var(--bg-primary) 78%, transparent) 100%
  );
}

.hero-gallery__copy,
.thumbnail-card__copy,
.similar-card__copy,
.similar-card__topline {
  position: absolute;
  z-index: 1;
}

.hero-gallery__copy {
  inset: auto auto var(--space-5) var(--space-5);
  display: grid;
  gap: var(--space-2);
  width: min(28rem, calc(100% - (var(--space-10))));
}

.hero-gallery__copy strong,
.similar-card__copy strong {
  font-size: clamp(var(--font-size-h2), 2vw, 2rem);
}

.hero-gallery__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.hero-gallery__copy .hero-gallery__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  min-height: 1.85rem;
  padding: 0.34rem 0.62rem;
  border: 1px solid color-mix(in srgb, var(--text-primary) 14%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 48%, transparent);
  color: color-mix(in srgb, var(--text-primary) 84%, var(--text-secondary) 16%);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.hero-gallery__copy .hero-gallery__meta-item span {
  color: inherit;
}

.hero-gallery__meta-item :deep(.scope-icon) {
  width: 0.9rem;
  height: 0.9rem;
  color: var(--accent-teal);
}

.thumbnail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4);
}

.thumbnail-card,
.similar-card {
  border-radius: var(--radius-xl);
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);
}

.thumbnail-card {
  aspect-ratio: 1.18 / 1;
  border: 1px solid var(--glass-border);
}

.thumbnail-card.is-active {
  border-color: var(--accent-teal);
  box-shadow: var(--shadow-glow-teal);
}

.thumbnail-card__overlay {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--bg-primary) 6%, transparent) 0%,
    color-mix(in srgb, var(--bg-primary) 72%, transparent) 100%
  );
}

.thumbnail-card__copy {
  right: var(--space-3);
  bottom: var(--space-3);
  left: var(--space-3);
  font-size: var(--font-size-small);
  line-height: var(--line-height-normal);
  text-align: left;
}

.headline-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-6);
  align-items: end;
  padding-bottom: var(--space-2);
}

.headline-stack,
.headline-copy,
.content-column,
.sidebar-column,
.reviews-summary,
.review-form-stack,
.review-cta,
.overview-stack,
.trip-fit-stack,
.route-cue-list,
.detail-list,
.empty-state-panel {
  display: grid;
}

.headline-stack,
.headline-copy,
.trip-fit-stack,
.empty-state-panel {
  gap: var(--space-4);
}

.overview-stack {
  gap: var(--space-6);
  padding-bottom: var(--space-2);
}

.headline-meta,
.rating-cluster,
.location-line,
.action-row,
.section-heading,
.reviews-heading,
.similar-heading,
.detail-row,
.reviews-summary,
.similar-card__topline {
  display: flex;
}

.headline-meta,
.rating-cluster,
.location-line,
.action-row,
.reviews-summary {
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.headline-meta {
  gap: var(--space-4);
}

.headline-copy h1 {
  font-size: clamp(var(--font-size-h1), 4vw, 3rem);
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-display);
}

.location-line,
.headline-description,
.section-copy,
.detail-row dd,
.detail-row dt,
.empty-state-panel p,
.glass-info-card span {
  margin: 0;
}

.location-line {
  font-size: var(--font-size-body);
}

.location-line :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
  color: var(--accent-teal);
}

.headline-description,
.section-copy,
.review-cta p,
.empty-state-panel p,
.glass-info-card span {
  line-height: var(--line-height-relaxed);
}

.headline-badge,
.metric-pill,
.similar-card__rating {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border-radius: var(--radius-full);
  font-size: var(--font-size-small);
}

.headline-badge {
  padding: 0.5rem 1.05rem;
  min-height: 2.4rem;
  line-height: 1.2;
  box-sizing: border-box;
}

.metric-pill,
.similar-card__rating {
  padding: 0.55rem 0.8rem;
  background: color-mix(in srgb, var(--bg-secondary) 45%, transparent);
  border: 1px solid var(--glass-border);
}

.rating-cluster,
.reviews-summary,
.similar-card__rating {
  color: var(--text-secondary);
}

.reviews-summary {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.65rem;
  padding: 0.45rem 0.9rem 0.45rem 0.6rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-gold) 7%, var(--bg-secondary) 55%);
  border: 1px solid color-mix(in srgb, var(--accent-gold) 24%, var(--glass-border));
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text-primary) 5%, transparent);
}

.reviews-summary__score {
  font-variant-numeric: tabular-nums;
  font-size: 1.15rem;
  line-height: 1;
  padding-left: 0.15rem;
}

.rating-cluster strong,
.reviews-summary .reviews-summary__score,
.similar-card__rating {
  color: var(--text-primary);
}

.similar-card__rating :deep(.scope-icon) {
  width: 0.95rem;
  height: 0.95rem;
}

.action-row {
  justify-content: flex-end;
}

.action-button {
  min-height: 3.2rem;
  min-width: 9.75rem;
}

.save-button--idle {
  background: color-mix(in srgb, var(--bg-secondary) 42%, transparent);
  border-color: var(--glass-border);
  color: var(--text-primary);
}

.save-button--active {
  background: var(--accent-teal-light);
  border-color: color-mix(in srgb, var(--accent-teal) 55%, var(--glass-border));
  color: var(--accent-teal);
  box-shadow: var(--shadow-glow-teal);
}

.detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(19rem, 0.85fr);
  gap: var(--space-8);
  align-items: start;
}

.content-column,
.sidebar-column,
.review-form-stack,
.review-cta,
.route-cue-list,
.detail-list {
  gap: var(--space-5);
}

.sidebar-column {
  position: sticky;
  top: calc(var(--shell-content-top) + var(--space-4));
}

.section-panel {
  display: grid;
  padding: var(--space-6);
  gap: var(--space-5);
}

.section-panel--overview {
  padding: clamp(var(--space-8), 4.5vw, var(--space-12));
  gap: clamp(var(--space-6), 3.5vw, var(--space-10));
}

.section-panel--overview .section-heading__titles {
  gap: var(--space-4);
}

.section-panel--overview .section-heading {
  padding-bottom: var(--space-1);
}

.section-heading,
.reviews-heading,
.similar-heading {
  justify-content: space-between;
  gap: var(--space-4);
  align-items: flex-start;
}

.section-heading__titles {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}

.map-panel__heading {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-4);
  width: 100%;
}

.map-panel__heading h2 {
  margin: 0;
}

.map-time-hint {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--bg-secondary) 70%, transparent);
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text-primary) 6%, transparent);
}

.map-time-hint__label {
  font-size: var(--font-size-caption);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--accent-teal);
  font-weight: var(--font-weight-medium);
}

.map-time-hint__value {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-size-body);
  line-height: 1.5;
  font-weight: var(--font-weight-medium);
}

.section-heading h2,
.section-heading__titles h2,
.review-cta h3,
.empty-state-panel strong {
  font-size: var(--font-size-h2);
  line-height: var(--line-height-tight);
  margin: 0;
}

.eyebrow,
.glass-info-card p,
.route-cue-card p,
.detail-row dt {
  margin: 0;
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}

.highlight-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  column-gap: clamp(var(--space-6), 2.5vw, var(--space-10));
  row-gap: var(--space-8);
  margin-top: var(--space-2);
}

.glass-info-card,
.route-cue-card {
  display: grid;
  border-radius: var(--radius-xl);
  background:
    radial-gradient(circle at top right, var(--accent-teal-light), transparent 45%),
    color-mix(in srgb, var(--bg-secondary) 35%, transparent);
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);
}

.route-cue-card {
  gap: var(--space-3);
  padding: var(--space-6);
}

.highlight-grid .glass-info-card {
  gap: var(--space-4);
  padding: var(--space-8) clamp(var(--space-5), 2.2vw, var(--space-8));
  min-height: 0;
}

.glass-info-card strong,
.route-cue-card strong {
  font-size: var(--font-size-h3);
  line-height: var(--line-height-tight);
}

.reviews-panel,
.map-panel,
.info-panel,
.similar-panel {
  display: grid;
  gap: var(--space-5);
}

.section-panel--reviews {
  gap: var(--space-6);
}

.similar-panel {
  content-visibility: auto;
  contain-intrinsic-size: 1px 520px;
}

.review-form-panel {
  position: relative;
  padding: var(--space-6);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 30%, transparent) 0%, transparent 55%),
    var(--glass-bg);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--accent-teal) 12%, transparent);
}

.review-form-panel::before {
  content: '';
  position: absolute;
  inset: 0 1.25rem auto;
  top: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, var(--glass-border) 80%, var(--accent-teal) 20%) 20%,
    color-mix(in srgb, var(--glass-border) 80%, var(--accent-teal) 20%) 80%,
    transparent
  );
  border-radius: var(--radius-full);
  pointer-events: none;
  opacity: 0.9;
}

.review-error {
  margin: 0;
  color: var(--danger);
  line-height: var(--line-height-normal);
}

.review-cta {
  justify-items: start;
}

.mini-map-shell {
  min-height: 24rem;
  border-radius: var(--radius-2xl);
}

.mini-map-shell :deep(.map-view) {
  min-height: 24rem;
  border-radius: var(--radius-2xl);
}

.mini-map-shell :deep(.map-summary),
.mini-map-shell :deep(.map-controls),
.mini-map-shell :deep(.tracker-overlay) {
  display: none;
}

.mini-map-shell :deep(.empty-state) {
  width: min(22rem, calc(100% - 2rem));
  padding: var(--space-5);
}

.detail-list {
  padding: 0;
  margin: 0;
}

.detail-row {
  justify-content: space-between;
  gap: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid color-mix(in srgb, var(--glass-border) 90%, transparent);
}

.detail-row:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.detail-row dd {
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
  text-align: right;
}

.info-panel--accent {
  background:
    radial-gradient(circle at top right, var(--accent-teal-light), transparent 40%),
    var(--glass-bg);
}

.route-cue-list {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.similar-link {
  color: var(--accent-teal);
  font-weight: var(--font-weight-semibold);
}

.similar-link:hover,
.similar-link:focus-visible {
  color: var(--accent-teal-hover);
  outline: none;
}

.similar-rail {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(16rem, 1fr);
  gap: var(--space-6);
  overflow-x: auto;
  padding-bottom: var(--space-2);
}

.similar-card {
  min-width: 0;
}

.similar-card__media {
  aspect-ratio: 4 / 3;
  border-radius: inherit;
}

.similar-card__overlay {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--bg-primary) 6%, transparent) 0%,
    color-mix(in srgb, var(--bg-primary) 82%, transparent) 100%
  );
}

.similar-card__topline {
  top: var(--space-4);
  right: var(--space-4);
  left: var(--space-4);
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
}

/* Glass pills instead of solid category rectangles (global .badge-* fills are overridden here). */
.similar-panel .similar-card .badge {
  display: inline-flex;
  align-items: center;
  border-radius: var(--radius-full);
  padding: 0.4rem 0.85rem;
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  text-transform: capitalize;
  letter-spacing: 0.02em;
  line-height: 1.25;
  border: 1px solid color-mix(in srgb, currentColor 38%, rgba(255, 255, 255, 0.12));
  background: color-mix(in srgb, currentColor 17%, rgba(5, 7, 14, 0.78));
  backdrop-filter: blur(12px) saturate(1.15);
  -webkit-backdrop-filter: blur(12px) saturate(1.15);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.09),
    0 1px 4px rgba(0, 0, 0, 0.28);
}

.similar-card__copy {
  right: var(--space-4);
  bottom: var(--space-4);
  left: var(--space-4);
  display: grid;
  gap: var(--space-1);
}

.empty-state-panel {
  gap: var(--space-2);
  padding: var(--space-5);
  text-align: center;
}

.thumbnail-card:hover,
.thumbnail-card:focus-visible,
.glass-info-card:hover,
.route-cue-card:hover,
.similar-card:hover,
.similar-card:focus-visible,
.hero-gallery__button:hover,
.hero-gallery__button:focus-visible {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  border-color: var(--border-hover);
  outline: none;
}

.hero-gallery__button:hover .hero-gallery__image,
.hero-gallery__button:focus-visible .hero-gallery__image,
.thumbnail-card:hover .thumbnail-card__image,
.thumbnail-card:focus-visible .thumbnail-card__image,
.similar-card:hover .similar-card__image,
.similar-card:focus-visible .similar-card__image {
  transform: scale(1.05);
}

@media (max-width: 1180px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }

  .sidebar-column {
    position: static;
  }

  .highlight-grid,
  .route-cue-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 920px) {
  .headline-shell,
  .thumbnail-grid {
    grid-template-columns: 1fr;
  }

  .headline-shell {
    gap: var(--space-4);
  }

  .action-row {
    justify-content: flex-start;
  }

  .thumbnail-grid,
  .highlight-grid,
  .route-cue-list {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 720px) {
  .gallery-panel,
  .section-panel,
  .review-form-panel,
  .empty-state-panel {
    padding: var(--space-4);
  }

  .section-panel--overview {
    padding: clamp(var(--space-5), 5vw, var(--space-8));
    gap: var(--space-6);
  }

  .hero-gallery__copy {
    right: var(--space-4);
    bottom: var(--space-4);
    left: var(--space-4);
    width: auto;
  }

  .headline-copy h1 {
    font-size: clamp(2.3rem, 10vw, 3.2rem);
  }

  .section-heading,
  .reviews-heading,
  .similar-heading,
  .detail-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .detail-row dd {
    text-align: left;
  }

  .action-row,
  .thumbnail-grid,
  .highlight-grid,
  .route-cue-list {
    grid-template-columns: 1fr;
  }

  .action-button {
    width: 100%;
  }

  .similar-rail {
    grid-auto-columns: minmax(14rem, 85vw);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-gallery__image,
  .thumbnail-card__image,
  .similar-card__image,
  .thumbnail-card,
  .glass-info-card,
  .route-cue-card,
  .similar-card,
  .hero-gallery__button {
    transition: none;
  }

  .thumbnail-card:hover,
  .thumbnail-card:focus-visible,
  .glass-info-card:hover,
  .route-cue-card:hover,
  .similar-card:hover,
  .similar-card:focus-visible,
  .hero-gallery__button:hover,
  .hero-gallery__button:focus-visible {
    transform: none;
  }

  .hero-gallery__button:hover .hero-gallery__image,
  .hero-gallery__button:focus-visible .hero-gallery__image,
  .thumbnail-card:hover .thumbnail-card__image,
  .thumbnail-card:focus-visible .thumbnail-card__image,
  .similar-card:hover .similar-card__image,
  .similar-card:focus-visible .similar-card__image {
    transform: none;
  }
}
</style>
