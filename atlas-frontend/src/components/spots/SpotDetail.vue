<template>
  <section v-if="spot" class="spot-detail page-stack">
    <header class="glass-panel hero-panel">
      <div class="hero-media">
        <img v-if="heroImageUrl" :src="heroImageUrl" :alt="spot.title" class="hero-image" />
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

        <p class="section-copy">
          {{ overviewCopy }}
        </p>

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

      <div v-if="galleryPhotos.length" class="gallery-grid">
        <figure v-for="photo in galleryPhotos" :key="photo.id" class="gallery-card surface-card">
          <img :src="photo.url" :alt="photo.caption || spot.title" />
          <figcaption>{{ photo.caption || 'Community upload' }}</figcaption>
        </figure>
      </div>
      <p v-else class="empty-copy">Photo uploads will appear here once the content engine finishes syncing media.</p>
    </section>

    <section class="glass-panel panel-section reviews-section">
      <div class="section-heading reviews-heading">
        <div>
          <p class="eyebrow">Reviews</p>
          <h2>{{ reviewCountLabel }}</h2>
        </div>
        <span class="metric-pill">{{ averageRating }} avg</span>
      </div>

      <div v-if="spot.reviews.length" class="reviews-grid">
        <article v-for="review in spot.reviews" :key="review.id" class="review-card surface-card">
          <div class="review-header">
            <div class="review-author">
              <span class="review-avatar">{{ getInitials(review.user.displayName) }}</span>
              <div>
                <strong>{{ review.user.displayName }}</strong>
                <p>{{ formatDate(review.createdAt) }}</p>
              </div>
            </div>
            <span class="metric-pill">★ {{ review.rating.toFixed(1) }}</span>
          </div>
          <p class="review-comment">{{ review.comment }}</p>
        </article>
      </div>
      <p v-else class="empty-copy">No reviews yet. Be the first traveler to leave a note for this stop.</p>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MapView from '@/components/map/MapView.vue';
import type { MapPoint, Photo, SpotDetail as SpotDetailModel } from '@/types';

const props = defineProps<{
  spot: SpotDetailModel | null;
}>();

function formatCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
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
const reviewCountLabel = computed(() => {
  const totalReviews = props.spot?.reviews.length ?? 0;
  return `${totalReviews} review${totalReviews === 1 ? '' : 's'}`;
});
const averageRating = computed(() => {
  if (!props.spot) {
    return '0.0';
  }

  if (!props.spot.reviews.length) {
    return props.spot.rating.toFixed(1);
  }

  const total = props.spot.reviews.reduce((sum, review) => sum + review.rating, 0);
  return (total / props.spot.reviews.length).toFixed(1);
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
.review-author,
.overview-item {
  display: grid;
  gap: var(--space-2);
}

.hero-heading h1,
.section-heading h2,
.review-author p,
.review-comment,
.section-copy {
  margin: 0;
}

.hero-heading h1 {
  font-size: clamp(var(--font-size-h1), 2vw + 1.3rem, 2.7rem);
  line-height: var(--line-height-tight);
}

.hero-meta,
.hero-description,
.map-copy,
.empty-copy,
.review-author p,
.review-comment,
.overview-item dd,
.section-copy {
  color: var(--text-secondary);
}

.hero-description,
.review-comment,
.section-copy,
.overview-item dd {
  line-height: var(--line-height-relaxed);
}

.chip-row,
.hero-stats,
.content-grid,
.gallery-grid,
.reviews-grid,
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
.gallery-card,
.review-card,
.overview-item {
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
.overview-item dd,
.gallery-card figcaption {
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

.gallery-grid {
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
}

.gallery-card {
  overflow: hidden;
}

.gallery-card img {
  width: 100%;
  height: 12rem;
  object-fit: cover;
  border-radius: var(--radius-lg);
}

.gallery-card figcaption {
  padding-top: var(--space-3);
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.reviews-grid {
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
}

.review-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.review-author {
  grid-template-columns: auto 1fr;
  align-items: center;
}

.review-avatar {
  width: 2.75rem;
  height: 2.75rem;
  display: grid;
  place-items: center;
  border-radius: var(--radius-full);
  background: var(--accent-teal-light);
  color: var(--accent-teal);
  font-weight: var(--font-weight-bold);
}

.eyebrow {
  margin: 0 0 var(--space-1);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.empty-copy {
  margin: var(--space-4) 0 0;
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
  .section-heading,
  .review-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .hero-stats,
  .overview-grid {
    grid-template-columns: 1fr;
  }
}
</style>
