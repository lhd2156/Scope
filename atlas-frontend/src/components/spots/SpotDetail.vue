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
            :alt="activeGalleryPhoto.caption || spot.title"
            class="hero-gallery__image"
            eager
          />
          <span class="hero-gallery__overlay"></span>
          <div class="hero-gallery__copy">
            <p class="eyebrow">Photo gallery</p>
            <strong>{{ activeGalleryPhoto.caption || `${spot.title} featured view` }}</strong>
            <span>{{ photoCountLabel }} · curated travel angles</span>
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
          <LazyImage :src="photo.url" :alt="photo.caption || spot.title" class="thumbnail-card__image" />
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
            <div class="star-row" aria-hidden="true">
              <AtlasIcon
                v-for="(filled, index) in averageRatingStars"
                :key="`average-star-${index}`"
                :name="filled ? 'star-filled' : 'star'"
              />
            </div>
            <strong>{{ averageRating }}</strong>
            <span>{{ reviewCountLabel }}</span>
          </div>
        </div>

        <div class="headline-copy">
          <h1>{{ spot.title }}</h1>
          <p class="location-line">
            <AtlasIcon name="map" label="Location" />
            <span>{{ locationLine }}</span>
          </p>
          <p class="headline-description">{{ spot.description }}</p>
        </div>
      </div>

      <div class="action-row" data-test="spot-actions">
        <RouterLink class="button button-primary action-button" :to="tripPlannerLink">
          <AtlasIcon name="plus" label="Add to trip" />
          <span>Add to Trip</span>
        </RouterLink>

        <button type="button" class="button button-secondary action-button" @click="handleShare">
          <AtlasIcon name="share" label="Share" />
          <span>Share</span>
        </button>

        <button
          type="button"
          class="button action-button save-button"
          :class="isSaved ? 'save-button--active' : 'save-button--idle'"
          :aria-pressed="String(isSaved)"
          :aria-label="isSaved ? `Remove ${spot.title} from saved spots` : `Save ${spot.title}`"
          @click="toggleSaved"
        >
          <AtlasIcon :name="isSaved ? 'heart-filled' : 'heart'" :label="isSaved ? 'Saved' : 'Save'" />
          <span>{{ isSaved ? 'Saved' : 'Save' }}</span>
        </button>
      </div>
    </section>

    <div class="detail-layout">
      <div class="content-column">
        <section class="glass-panel section-panel">
          <div class="section-heading">
            <div>
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

        <section class="glass-panel section-panel reviews-panel">
          <div class="section-heading reviews-heading">
            <div>
              <p class="eyebrow">Reviews</p>
              <h2>{{ reviewCountLabel }}</h2>
            </div>
            <div class="reviews-summary">
              <div class="star-row" aria-hidden="true">
                <AtlasIcon
                  v-for="(filled, index) in averageRatingStars"
                  :key="`review-summary-star-${index}`"
                  :name="filled ? 'star-filled' : 'star'"
                />
              </div>
              <strong>{{ averageRating }}</strong>
            </div>
          </div>

          <ReviewList :reviews="displayReviews" />

          <article class="glass-panel review-form-panel">
            <div v-if="authStore.isAuthenticated" class="review-form-stack">
              <ReviewForm @submit="handleReviewSubmit" />
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
          <div class="section-heading">
            <div>
              <p class="eyebrow">Mini-map</p>
              <h2>Where it sits on the route</h2>
            </div>
            <span class="map-copy">{{ travelCue.window }}</span>
          </div>

          <div class="mini-map-shell">
            <MapView :spots="miniMapSpots" :selected-spot-id="spot.id" :show-location-tracker="false" />
          </div>
        </section>

        <section class="glass-panel section-panel info-panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Atlas snapshot</p>
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
            <div>
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
        <div>
          <p class="eyebrow">Similar spots</p>
          <h2>Keep the route going</h2>
        </div>
        <RouterLink class="similar-link" to="/explore">View all</RouterLink>
      </div>

      <div v-if="similarSpots.length" class="similar-rail" data-test="similar-spots">
        <RouterLink
          v-for="similarSpot in similarSpots"
          :key="similarSpot.id"
          :to="`/spots/${similarSpot.id}`"
          class="similar-card"
        >
          <div class="similar-card__media">
            <LazyImage :src="similarSpot.photoUrl || heroImageUrl || ''" :alt="similarSpot.title" class="similar-card__image" />
            <span class="similar-card__overlay"></span>
            <div class="similar-card__topline">
              <span class="badge" :class="`badge-${similarSpot.category}`">{{ formatCategory(similarSpot.category) }}</span>
              <span class="similar-card__rating">
                <AtlasIcon name="star-filled" label="Rating" />
                {{ similarSpot.rating.toFixed(1) }}
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
        <strong>{{ loadingSimilar ? 'Scanning nearby Atlas pins' : 'No similar spots yet' }}</strong>
        <p>{{ loadingSimilar ? 'Pulling neighboring stops with matching energy and category context.' : 'Once more community pins land around this route, similar recommendations will appear here.' }}</p>
      </article>
    </section>

    <Toast
      v-if="showReviewToast"
      title="Review added"
      message="Your review was added to the local spot detail shell while the live review endpoint finishes wiring up."
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
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import Toast from '@/components/common/Toast.vue';
import MapView from '@/components/map/MapView.vue';
import ReviewForm from '@/components/spots/ReviewForm.vue';
import ReviewList from '@/components/spots/ReviewList.vue';
import { listNearbySpots } from '@/services/spotService';
import { useAuthStore } from '@/stores/auth';
import type { MapPoint, Photo, Review, SpotDetail as SpotDetailModel, SpotSummary } from '@/types';

const DESIRED_GALLERY_SIZE = 5;
const regionNameFormatter = typeof Intl !== 'undefined' && 'DisplayNames' in Intl
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null;

const travelCueMap = {
  food: {
    window: 'Golden hour dinner run',
    pairing: 'Culture + nightlife',
    energy: 'Social anchor stop',
  },
  nature: {
    window: 'Sunrise to late morning',
    pairing: 'Scenic + adventure',
    energy: 'Slow recharge moment',
  },
  nightlife: {
    window: 'After dark peak hours',
    pairing: 'Food + live music',
    energy: 'High-energy closer',
  },
  culture: {
    window: 'Late morning to sunset',
    pairing: 'Food + shopping',
    energy: 'Story-rich midpoint',
  },
  adventure: {
    window: 'First light launch',
    pairing: 'Nature + scenic',
    energy: 'Hero itinerary anchor',
  },
  shopping: {
    window: 'Midday browse window',
    pairing: 'Culture + food',
    energy: 'Polished flex stop',
  },
  scenic: {
    window: 'Sunrise or golden hour',
    pairing: 'Nature + food',
    energy: 'Camera-first pause',
  },
  other: {
    window: 'Flexible all-day stop',
    pairing: 'Nearby community pins',
    energy: 'Utility route filler',
  },
} as const;

const props = defineProps<{
  spot: SpotDetailModel | null;
}>();

const authStore = useAuthStore();
const localReviews = ref<Review[]>([]);
const isSaved = ref(false);
const selectedPhotoId = ref('');
const similarSpots = ref<SpotSummary[]>([]);
const loadingSimilar = ref(false);
const showReviewToast = ref(false);
const showShareToast = ref(false);

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

const categoryLabel = computed(() => (props.spot ? formatCategory(props.spot.category) : 'Spot'));
const heroImageUrl = computed(() => props.spot?.photoUrl ?? props.spot?.photos[0]?.url ?? '');
const travelCue = computed(() => (props.spot ? travelCueMap[props.spot.category] : travelCueMap.other));
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

  return props.spot.address || 'Atlas location pending';
});
const addressLine = computed(() => props.spot?.address || 'Shared in-app once the content engine syncs the full address data.');
const vibeLabel = computed(() => props.spot?.vibe || 'Community-curated');
const photoCountLabel = computed(() => {
  const totalPhotos = galleryPhotos.value.length;
  return `${totalPhotos} photo${totalPhotos === 1 ? '' : 's'}`;
});
const displayReviews = computed(() => [...localReviews.value, ...(props.spot?.reviews ?? [])]);
const reviewCountLabel = computed(() => {
  const totalReviews = displayReviews.value.length;
  return `${totalReviews} review${totalReviews === 1 ? '' : 's'}`;
});
const averageRatingNumber = computed(() => {
  if (!props.spot) {
    return 0;
  }

  const serverReviewCount = props.spot.reviews.length;
  const serverRatingTotal = props.spot.rating * Math.max(serverReviewCount, 1);

  if (!localReviews.value.length) {
    return props.spot.rating;
  }

  const localRatingTotal = localReviews.value.reduce((sum, review) => sum + review.rating, 0);
  return (serverRatingTotal + localRatingTotal) / (serverReviewCount + localReviews.value.length);
});
const averageRating = computed(() => averageRatingNumber.value.toFixed(1));
const averageRatingStars = computed(() => Array.from({ length: 5 }, (_, index) => index < Math.round(averageRatingNumber.value)));
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

  return `${props.spot.title} plays best as a ${travelCue.value.energy.toLowerCase()} for a ${categoryLabel.value.toLowerCase()}-leaning itinerary. Travelers consistently call out the ${vibeLabel.value.toLowerCase()} tone, which makes it easy to sequence before or after ${travelCue.value.pairing.toLowerCase()} moments.`;
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
    value: `${averageRating.value} avg · ${saveCountLabel.value} saves`,
    copy: 'Social proof stays visible so travelers can gauge confidence at a glance.',
  },
]);
const tripPlannerLink = computed(() => (props.spot ? `/trips/new?spot=${encodeURIComponent(props.spot.id)}` : '/trips/new'));
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
      ...(heroImageUrl.value ? { photoUrl: heroImageUrl.value } : {}),
    },
  ];
});

function formatSimilarLocation(spotSummary: SpotSummary): string {
  const locationParts = [spotSummary.city, formatRegion(spotSummary.country)].filter((value): value is string => Boolean(value));
  return locationParts.join(', ') || 'Atlas discovery';
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

async function handleShare(): Promise<void> {
  if (!props.spot) {
    return;
  }

  const shareUrl = typeof window === 'undefined'
    ? `/spots/${props.spot.id}`
    : new URL(`/spots/${props.spot.id}`, window.location.origin).toString();

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareUrl);
    }
  } finally {
    showShareToast.value = true;
  }
}

function toggleSaved(): void {
  isSaved.value = !isSaved.value;
}

watch(
  () => props.spot,
  (spot) => {
    isSaved.value = Boolean(spot?.liked);
    localReviews.value = [];
    showReviewToast.value = false;
    showShareToast.value = false;
    selectedPhotoId.value = galleryPhotos.value[0]?.id ?? '';
    void loadSimilarSpots(spot);
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
.map-copy,
.review-cta p,
.empty-state-panel p,
.glass-info-card span,
.similar-card__copy span,
.thumbnail-card__copy {
  color: var(--text-secondary);
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
  gap: var(--space-5);
  align-items: end;
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
.overview-stack,
.trip-fit-stack,
.empty-state-panel {
  gap: var(--space-3);
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

.location-line :deep(.atlas-icon) {
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

.rating-cluster strong,
.reviews-summary strong,
.similar-card__rating {
  color: var(--text-primary);
}

.star-row {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--accent-gold);
}

.star-row :deep(.atlas-icon),
.similar-card__rating :deep(.atlas-icon) {
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
  gap: var(--space-6);
  align-items: start;
}

.content-column,
.sidebar-column,
.review-form-stack,
.review-cta,
.route-cue-list,
.detail-list {
  gap: var(--space-4);
}

.sidebar-column {
  position: sticky;
  top: calc(var(--shell-content-top) + var(--space-4));
}

.section-panel {
  padding: var(--space-5);
  gap: var(--space-4);
}

.section-heading,
.reviews-heading,
.similar-heading {
  justify-content: space-between;
  gap: var(--space-4);
  align-items: flex-start;
}

.section-heading h2,
.review-cta h3,
.empty-state-panel strong {
  font-size: var(--font-size-h2);
  line-height: var(--line-height-tight);
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
  gap: var(--space-4);
}

.glass-info-card,
.route-cue-card {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  background:
    radial-gradient(circle at top right, var(--accent-teal-light), transparent 45%),
    color-mix(in srgb, var(--bg-secondary) 35%, transparent);
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);
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
  gap: var(--space-4);
}

.review-form-panel {
  padding: var(--space-4);
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
  gap: var(--space-3);
  padding-bottom: var(--space-3);
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
  gap: var(--space-4);
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
  top: var(--space-3);
  right: var(--space-3);
  left: var(--space-3);
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
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
