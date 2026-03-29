<template>
  <section v-if="spot" class="spot-detail page-stack">
    <header class="glass-panel hero-panel">
      <div class="hero-media">
        <LazyImage v-if="heroImageUrl" :src="heroImageUrl" :alt="spot.title" class="hero-image" eager />
        <div v-else class="hero-placeholder">
          <strong>{{ categoryLabel }}</strong>
          <span>Hero image coming soon</span>
        </div>
      </div>

      <div class="hero-copy">
        <div class="hero-topline">
          <span class="badge" :class="`badge-${spot.category}`">{{ categoryLabel }}</span>
          <span class="metric-pill">★ {{ averageRating }}</span>
        </div>

        <div class="hero-heading">
          <h1>{{ spot.title }}</h1>
          <p class="hero-meta">{{ locationLine }}</p>
        </div>

        <p class="hero-description">{{ spot.description }}</p>

        <div class="chip-row">
          <span v-if="spot.vibe" class="detail-chip">{{ spot.vibe }}</span>
          <span class="detail-chip">{{ reviewCountLabel }}</span>
          <span class="detail-chip">{{ photoCountLabel }}</span>
          <span class="detail-chip">Pinned {{ publishedLabel }}</span>
        </div>

        <div class="hero-stats">
          <article class="stat-card surface-card">
            <small>Average rating</small>
            <strong>{{ averageRating }}</strong>
          </article>
          <article class="stat-card surface-card">
            <small>Community saves</small>
            <strong>{{ savesLabel }}</strong>
          </article>
          <article class="stat-card surface-card">
            <small>Category</small>
            <strong>{{ categoryLabel }}</strong>
          </article>
        </div>
      </div>
    </header>

    <div class="content-grid">
      <section class="glass-panel panel-section overview-panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Overview</p>
            <h2>Why this stop matters</h2>
          </div>
        </div>

        <p class="section-copy">{{ overviewCopy }}</p>

        <dl class="overview-grid">
          <div class="overview-item surface-card">
            <dt>Address</dt>
            <dd>{{ spot.address || 'Shared in-app once the content engine syncs full address data.' }}</dd>
          </div>
          <div class="overview-item surface-card">
            <dt>City</dt>
            <dd>{{ spot.city || 'Atlas city pending' }}</dd>
          </div>
          <div class="overview-item surface-card">
            <dt>Country</dt>
            <dd>{{ spot.country || 'Atlas region pending' }}</dd>
          </div>
          <div class="overview-item surface-card">
            <dt>Trip fit</dt>
            <dd>{{ tripFitCopy }}</dd>
          </div>
        </dl>
      </section>

      <section class="glass-panel panel-section map-panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Mini-map</p>
            <h2>Drop-in context</h2>
          </div>
          <p class="map-copy">Theme-aware Mapbox preview centered on this pin.</p>
        </div>

        <div class="mini-map-shell">
          <MapView :spots="miniMapSpots" :selected-spot-id="spot.id" :show-location-tracker="false" />
        </div>
      </section>
    </div>

    <section class="glass-panel panel-section gallery-section">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Gallery</p>
          <h2>{{ photoCountLabel }}</h2>
        </div>
      </div>

      <PhotoGallery
        :photos="galleryItems"
        empty-title="No photos synced yet"
        empty-copy="Photo uploads will appear here once the content engine finishes syncing media."
      />
    </section>

    <section class="glass-panel panel-section reviews-section">
      <div class="section-heading reviews-heading">
        <div>
          <p class="eyebrow">Reviews</p>
          <h2>{{ reviewCountLabel }}</h2>
        </div>
        <span class="metric-pill">{{ averageRating }} avg</span>
      </div>

      <ReviewList :reviews="displayReviews" />

      <article class="surface-card review-form-panel">
        <div v-if="authStore.isAuthenticated" class="review-form-stack">
          <ReviewForm @submit="handleReviewSubmit" />
        </div>
        <div v-else class="review-cta">
          <h3>Want to leave a review?</h3>
          <p class="section-copy">Sign in so your take on this spot can shape itinerary quality and social proof.</p>
          <RouterLink class="button button-secondary" to="/login">Log in to review</RouterLink>
        </div>
      </article>
    </section>

    <Toast
      :open="showReviewToast"
      title="Review added"
      message="Your review was added to the local spot detail shell while the live review endpoint finishes wiring up."
      tone="success"
      @close="showReviewToast = false"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import LazyImage from '@/components/common/LazyImage.vue';
import Toast from '@/components/common/Toast.vue';
import MapView from '@/components/map/MapView.vue';
import PhotoGallery from '@/components/spots/PhotoGallery.vue';
import ReviewForm from '@/components/spots/ReviewForm.vue';
import ReviewList from '@/components/spots/ReviewList.vue';
import { useAuthStore } from '@/stores/auth';
import type { MapPoint, Photo, PhotoGalleryItem, Review, SpotDetail as SpotDetailModel } from '@/types';

const props = defineProps<{
  spot: SpotDetailModel | null;
}>();

const authStore = useAuthStore();
const localReviews = ref<Review[]>([]);
const showReviewToast = ref(false);

function formatCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

const categoryLabel = computed(() => (props.spot ? formatCategory(props.spot.category) : 'Spot'));
const heroImageUrl = computed(() => props.spot?.photoUrl ?? props.spot?.photos[0]?.url ?? null);
const locationLine = computed(() => {
  if (!props.spot) {
    return '';
  }

  const addressParts = [props.spot.address, [props.spot.city, props.spot.country].filter(Boolean).join(', ')]
    .filter((value): value is string => Boolean(value?.trim()));

  return addressParts.join(' · ');
});
const photoCountLabel = computed(() => {
  const totalPhotos = props.spot?.photos.length ?? 0;
  return `${totalPhotos} photo${totalPhotos === 1 ? '' : 's'}`;
});
const displayReviews = computed(() => [...localReviews.value, ...(props.spot?.reviews ?? [])]);
const reviewCountLabel = computed(() => {
  const totalReviews = displayReviews.value.length;
  return `${totalReviews} review${totalReviews === 1 ? '' : 's'}`;
});
const averageRating = computed(() => {
  if (!props.spot) {
    return '0.0';
  }

  if (!displayReviews.value.length) {
    return props.spot.rating.toFixed(1);
  }

  const total = displayReviews.value.reduce((sum, review) => sum + review.rating, 0);
  return (total / displayReviews.value.length).toFixed(1);
});
const publishedLabel = computed(() => (props.spot ? formatDate(props.spot.createdAt) : ''));
const savesLabel = computed(() => {
  const likesCount = props.spot?.likesCount ?? 0;
  return likesCount > 0 ? String(likesCount) : 'Fresh';
});
const overviewCopy = computed(() => {
  if (!props.spot) {
    return '';
  }

  const vibeCopy = props.spot.vibe ? `The current vibe reads ${props.spot.vibe}.` : 'The vibe tag is still being refined by the community.';
  return `${props.spot.title} anchors the ${categoryLabel.value.toLowerCase()} lane of Atlas with enough texture for discovery, social proof, and itinerary planning. ${vibeCopy}`;
});
const tripFitCopy = computed(() => {
  if (!props.spot) {
    return '';
  }

  if (props.spot.rating >= 4.7) {
    return 'Excellent anchor stop for a premium itinerary.';
  }

  if (props.spot.rating >= 4.3) {
    return 'Strong supporting stop that pairs well with nearby pins.';
  }

  return 'Best used as a flexible optional stop.';
});
const galleryPhotos = computed<Photo[]>(() => {
  if (!props.spot) {
    return [];
  }

  if (props.spot.photos.length) {
    return props.spot.photos;
  }

  if (heroImageUrl.value) {
    return [
      {
        id: `${props.spot.id}-hero-photo`,
        url: heroImageUrl.value,
        caption: props.spot.title,
      },
    ];
  }

  return [];
});
const galleryItems = computed<PhotoGalleryItem[]>(() =>
  galleryPhotos.value.map((photo) => ({
    id: photo.id,
    url: photo.url,
    caption: photo.caption ?? '',
    source: 'existing',
  })),
);
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
      ...(props.spot.photoUrl ? { photoUrl: props.spot.photoUrl } : {}),
    },
  ];
});

function handleReviewSubmit(payload: { rating: number; comment: string }) {
  if (!props.spot) {
    return;
  }

  localReviews.value = [
    {
      id: `local-review-${Date.now()}`,
      spotId: props.spot.id,
      rating: payload.rating,
      comment: payload.comment,
      createdAt: new Date().toISOString(),
      user: authStore.currentUser ?? {
        id: 'guest-reviewer',
        username: 'guest-reviewer',
        email: '',
        displayName: 'Atlas traveler',
        interests: [],
      },
    },
    ...localReviews.value,
  ];
  showReviewToast.value = true;
}

watch(
  () => props.spot?.id,
  () => {
    localReviews.value = [];
    showReviewToast.value = false;
  },
);
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: var(--space-6);
}

.hero-panel {
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
}

.hero-media {
  min-height: 24rem;
  background:
    radial-gradient(circle at top left, var(--accent-teal-light), transparent 35%),
    linear-gradient(180deg, var(--bg-tertiary), var(--bg-secondary));
}

.hero-image,
.hero-placeholder {
  width: 100%;
  height: 100%;
}

.hero-image {
  object-fit: cover;
}

.hero-placeholder {
  display: grid;
  place-content: center;
  gap: var(--space-2);
  padding: var(--space-6);
  color: var(--text-secondary);
  text-align: center;
}

.hero-placeholder strong {
  color: var(--text-primary);
  font-size: var(--font-size-h2);
}

.hero-copy,
.panel-section {
  padding: var(--space-6);
}

.hero-copy {
  display: grid;
  align-content: start;
  gap: var(--space-5);
}

.hero-topline,
.reviews-heading,
.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.hero-heading,
.overview-item,
.review-form-stack,
.review-cta {
  display: grid;
  gap: var(--space-2);
}

.hero-heading h1,
.section-heading h2,
.section-copy,
.map-copy,
.review-cta h3,
.review-cta p {
  margin: 0;
}

.hero-heading h1 {
  font-size: clamp(var(--font-size-h1), 2vw + 1.3rem, 2.7rem);
  line-height: var(--line-height-tight);
}

.hero-meta,
.hero-description,
.map-copy,
.section-copy,
.overview-item dd {
  color: var(--text-secondary);
}

.hero-description,
.section-copy,
.overview-item dd {
  line-height: var(--line-height-relaxed);
}

.chip-row,
.hero-stats,
.content-grid,
.overview-grid {
  display: grid;
  gap: var(--space-4);
}

.chip-row {
  grid-template-columns: repeat(auto-fit, minmax(10rem, max-content));
}

.detail-chip,
.metric-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 0.6rem 0.85rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  font-size: var(--font-size-small);
}

.metric-pill {
  color: var(--text-primary);
}

.hero-stats {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.stat-card,
.overview-item,
.review-form-panel {
  padding: var(--space-4);
}

.stat-card {
  display: grid;
  gap: var(--space-2);
}

.stat-card small,
.overview-item dt {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.stat-card strong,
.overview-item dd {
  color: var(--text-primary);
}

.content-grid {
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
}

.overview-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: var(--space-5);
}

.overview-item dt,
.overview-item dd {
  margin: 0;
}

.mini-map-shell {
  min-height: 20rem;
  margin-top: var(--space-5);
  overflow: hidden;
  border-radius: var(--radius-xl);
}

.mini-map-shell :deep(.map-view) {
  min-height: 20rem;
  border-radius: var(--radius-xl);
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

.review-form-panel {
  margin-top: var(--space-4);
}

.review-cta {
  justify-items: start;
}

.eyebrow {
  margin: 0 0 var(--space-1);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

@media (max-width: 1100px) {
  .hero-panel,
  .content-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .hero-copy,
  .panel-section {
    padding: var(--space-5);
  }

  .hero-topline,
  .reviews-heading,
  .section-heading {
    flex-direction: column;
    align-items: flex-start;
  }

  .hero-stats,
  .overview-grid {
    grid-template-columns: 1fr;
  }
}
</style>
