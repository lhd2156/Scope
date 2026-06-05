<template>
  <section class="profile-map" data-test="profile-map" :data-active-mode="activeMode">
    <div class="profile-map__header">
      <div class="profile-map__copy">
        <p class="eyebrow">{{ activeCollection.eyebrow }}</p>
        <h2>{{ title }}</h2>
        <p class="section-copy">{{ effectiveDescription }}</p>
      </div>

      <div class="map-mode-switch" aria-label="Profile map collection">
        <button
          v-for="collection in availableCollections"
          :key="collection.id"
          type="button"
          class="map-mode-button"
          :class="{ 'is-active': collection.id === activeMode }"
          :aria-pressed="String(collection.id === activeMode)"
          @click="selectMode(collection.id)"
        >
          <ScopeIcon :name="collection.icon" :label="collection.label" />
          <span>{{ collection.label }}</span>
          <strong>{{ collection.spots.length }}</strong>
        </button>
      </div>
    </div>

    <div v-if="activeSpots.length" class="profile-map__workspace">
      <div class="profile-map__stage">
        <MapView
          ref="mapViewRef"
          class="profile-map__view"
          :spots="mapPoints"
          :route-points="emptyRoutePoints"
          :selected-spot-id="selectedSpotId"
          :initial-viewport="initialViewport"
          :show-location-tracker="false"
          :show-filter-panel="false"
          :show-summary="false"
          :show-controls="true"
          :show-fit-route-control="false"
          :show-map-style-toggle="true"
          :show-place-labels="true"
          :show-weather-badge="false"
          :show-nearby-places="false"
          :auto-search-nearby-places="false"
          :auto-locate-on-load="false"
          :auto-fit-route-on-load="false"
          :single-route-point-zoom="11.5"
          label-mode="full"
          map-presentation="scope"
          marker-variant="default"
          :persist-map-preferences="true"
          @spot-select="handleSpotSelect"
        />

        <article v-if="selectedSpot" class="profile-map__spotlight" aria-live="polite">
          <LazyImage
            :src="selectedSpotImageUrl"
            :fallback-src="selectedSpotImageFallback"
            :alt="selectedSpot.title"
            class="profile-map__spotlight-image"
            eager
          />
          <div class="profile-map__spotlight-copy">
            <div class="profile-map__spotlight-topline">
              <span class="badge" :class="`badge-${selectedSpot.category}`">{{ formatCategory(selectedSpot.category) }}</span>
              <span class="profile-map__rating">{{ selectedSpot.rating.toFixed(1) }}</span>
            </div>
            <h3>{{ selectedSpot.title }}</h3>
            <p>{{ selectedSpotLocation }}</p>
          </div>
          <RouterLink :to="`/spots/${selectedSpot.id}`" class="profile-map__spotlight-link" aria-label="Open spot detail">
            <ScopeIcon name="navigation" label="Open spot detail" />
            <span>Details</span>
          </RouterLink>
        </article>
      </div>

      <aside class="profile-map__drawer" aria-label="Profile map places">
        <div class="profile-map__drawer-heading">
          <p class="eyebrow">{{ activeCollection.drawerEyebrow }}</p>
          <h3>{{ activeCollection.drawerTitle }}</h3>
          <p>{{ activeCollection.drawerDescription }}</p>
        </div>

        <div class="profile-map__metrics" aria-label="Active collection summary">
          <span v-for="metric in activeMetrics" :key="metric.label" class="profile-map__metric">
            <strong>{{ metric.value }}</strong>
            <span>{{ metric.label }}</span>
          </span>
        </div>

        <div class="profile-map__list">
          <button
            v-for="spot in activeSpots"
            :key="`profile-map-place-${spot.id}`"
            type="button"
            class="profile-map__place"
            :class="{ 'is-active': spot.id === selectedSpotId }"
            @click="selectSpot(spot.id)"
          >
            <LazyImage
              :src="resolveSpotImageUrl(spot)"
              :fallback-src="getSpotPhotoFallback(spot.category, 240)"
              :alt="spot.title"
              class="profile-map__place-image"
            />
            <span class="profile-map__place-copy">
              <strong>{{ spot.title }}</strong>
              <span>{{ formatSpotLocation(spot) }}</span>
            </span>
          </button>
        </div>
      </aside>
    </div>

    <div v-else class="profile-map-empty-state" data-test="profile-map-empty-state">
      <p class="eyebrow">{{ activeCollection.eyebrow }}</p>
      <h3>{{ activeCollection.emptyTitle }}</h3>
      <p>{{ activeCollection.emptyDescription }}</p>
      <RouterLink class="button button-secondary" to="/map">Open map</RouterLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import LazyImage from '@/components/common/LazyImage.vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import MapView from '@/components/map/MapView.vue';
import { getDefaultDiscoveryMapViewport } from '@/services/mapViewportService';
import type { MapPoint, MapViewport, SpotCategory, SpotSummary } from '@/types';
import { getSpotPhotoFallback, resolveSpotPhotoUrl } from '@/utils/imageFallbacks';
import { getSpotFingerprint } from '@/utils/spotIdentity';

type ProfileMapMode = 'all' | 'visited' | 'pinned' | 'wishlist';
type ProfileMapViewInstance = InstanceType<typeof MapView> & {
  focusSpotById?: (spotId: string) => boolean;
};

interface ProfileMapCollection {
  id: ProfileMapMode;
  label: string;
  icon: string;
  eyebrow: string;
  description: string;
  drawerEyebrow: string;
  drawerTitle: string;
  drawerDescription: string;
  emptyTitle: string;
  emptyDescription: string;
  spots: SpotSummary[];
}

const props = withDefaults(
  defineProps<{
    spots?: SpotSummary[];
    visitedSpots?: SpotSummary[];
    pinnedSpots?: SpotSummary[];
    wishlistSpots?: SpotSummary[];
    title?: string;
    description?: string;
    ownerName?: string;
    showWishlist?: boolean;
  }>(),
  {
    spots: () => [],
    visitedSpots: () => [],
    pinnedSpots: () => [],
    wishlistSpots: () => [],
    title: 'Scope Map',
    description: '',
    ownerName: 'This explorer',
    showWishlist: true,
  },
);

const activeMode = ref<ProfileMapMode>('visited');
const selectedSpotId = ref<string | null>(null);
const hasUserSelectedMode = ref(false);
const mapViewRef = ref<ProfileMapViewInstance | null>(null);
const emptyRoutePoints: MapPoint[] = [];

function hasValidCoordinates(spot: SpotSummary): boolean {
  return Number.isFinite(spot.latitude) &&
    Number.isFinite(spot.longitude) &&
    spot.latitude >= -90 &&
    spot.latitude <= 90 &&
    spot.longitude >= -180 &&
    spot.longitude <= 180;
}

function normalizeSpots(spots: SpotSummary[]): SpotSummary[] {
  const uniqueSpots: SpotSummary[] = [];
  const seenKeys = new Set<string>();

  spots.filter(hasValidCoordinates).forEach((spot) => {
    const fingerprint = getSpotFingerprint(spot);
    const isDuplicate = seenKeys.has(spot.id) || Boolean(fingerprint && seenKeys.has(fingerprint));

    seenKeys.add(spot.id);
    if (fingerprint) {
      seenKeys.add(fingerprint);
    }

    if (!isDuplicate) {
      uniqueSpots.push(spot);
    }
  });

  return uniqueSpots.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

const fallbackSpots = computed(() => normalizeSpots(props.spots));
const visitedCollectionSpots = computed(() => normalizeSpots(props.visitedSpots.length ? props.visitedSpots : fallbackSpots.value));
const pinnedCollectionSpots = computed(() => normalizeSpots(props.pinnedSpots.length ? props.pinnedSpots : fallbackSpots.value));
const wishlistCollectionSpots = computed(() => normalizeSpots(props.wishlistSpots));
const allCollectionSpots = computed(() => normalizeSpots([
  ...visitedCollectionSpots.value,
  ...pinnedCollectionSpots.value,
  ...(props.showWishlist ? wishlistCollectionSpots.value : []),
]));

const availableCollections = computed<ProfileMapCollection[]>(() => {
  const owner = props.ownerName;
  const collections: ProfileMapCollection[] = [
    {
      id: 'all',
      label: 'All',
      icon: 'map',
      eyebrow: 'Scope map',
      description: `${owner}'s visits, public pins, and saves on one map.`,
      drawerEyebrow: 'All places',
      drawerTitle: 'All mapped places',
      drawerDescription: 'Visits, public pins, and saves in one view.',
      emptyTitle: 'No mapped places yet',
      emptyDescription: 'Visited stops, public pins, and saved places will collect here once this profile starts mapping.',
      spots: allCollectionSpots.value,
    },
    {
      id: 'visited',
      label: 'Visited',
      icon: 'route',
      eyebrow: 'Visited map',
      description: `${owner}'s trip stops and confirmed visits.`,
      drawerEyebrow: 'Visited places',
      drawerTitle: 'Visited places',
      drawerDescription: 'Trip stops and confirmed visits.',
      emptyTitle: 'No mapped visits yet',
      emptyDescription: 'Completed routes and trip stops will appear here once this explorer starts logging visits.',
      spots: visitedCollectionSpots.value,
    },
    {
      id: 'pinned',
      label: 'Pinned',
      icon: 'pin',
      eyebrow: 'Pinned map',
      description: `${owner}'s public pins and shared places.`,
      drawerEyebrow: 'Public pins',
      drawerTitle: 'Public pins',
      drawerDescription: 'Places this profile shared.',
      emptyTitle: 'No public pins yet',
      emptyDescription: 'When this explorer publishes places to Scope, their strongest pins will show up here.',
      spots: pinnedCollectionSpots.value,
    },
  ];

  if (props.showWishlist) {
    collections.push({
      id: 'wishlist',
      label: 'Wishlist',
      icon: 'heart-filled',
      eyebrow: 'Wishlist map',
      description: `${owner}'s saved spots for a future route.`,
      drawerEyebrow: 'Saved places',
      drawerTitle: 'Wishlist',
      drawerDescription: 'Saved places for a future route.',
      emptyTitle: 'No saved spots yet',
      emptyDescription: 'Like or save places from Explore and they will become the next layer of this map.',
      spots: wishlistCollectionSpots.value,
    });
  }

  return collections;
});

const activeCollection = computed(() => (
  availableCollections.value.find((collection) => collection.id === activeMode.value) ?? availableCollections.value[0]
));
const activeSpots = computed(() => activeCollection.value?.spots ?? []);
const mapPoints = computed<MapPoint[]>(() => activeSpots.value.map((spot) => ({
  id: spot.id,
  title: spot.title,
  latitude: spot.latitude,
  longitude: spot.longitude,
  category: spot.category,
  city: spot.city,
  vibe: spot.vibe,
  rating: spot.rating,
  photoUrl: resolveSpotImageUrl(spot),
})));
const selectedSpot = computed(() => activeSpots.value.find((spot) => spot.id === selectedSpotId.value) ?? activeSpots.value[0] ?? null);
const selectedSpotImageFallback = computed(() => getSpotPhotoFallback(selectedSpot.value?.category ?? 'scenic', 800));
const selectedSpotImageUrl = computed(() => (selectedSpot.value ? resolveSpotImageUrl(selectedSpot.value, 800) : selectedSpotImageFallback.value));
const selectedSpotLocation = computed(() => (selectedSpot.value ? formatSpotLocation(selectedSpot.value) : 'Scope map pin'));
const effectiveDescription = computed(() => {
  const intro = props.description.trim();
  return intro || activeCollection.value.description;
});
const cityCount = computed(() => new Set(activeSpots.value.map((spot) => spot.city?.trim()).filter(Boolean)).size);
const countryCount = computed(() => {
  const countries = new Set(activeSpots.value.map((spot) => spot.country?.trim().toUpperCase()).filter(Boolean));
  return countries.size || (activeSpots.value.length ? 1 : 0);
});
const activeMetrics = computed(() => [
  { label: activeMode.value === 'wishlist' ? 'saves' : 'spots', value: String(activeSpots.value.length) },
  { label: cityCount.value === 1 ? 'city' : 'cities', value: String(cityCount.value) },
  { label: countryCount.value === 1 ? 'country' : 'countries', value: String(countryCount.value) },
]);
const initialViewport = computed<MapViewport>(() => buildViewportForSpots(activeSpots.value));

watch(
  availableCollections,
  (collections) => {
    if (!collections.length) {
      return;
    }

    const activeCollectionStillExists = collections.some((collection) => collection.id === activeMode.value);
    if (!activeCollectionStillExists) {
      activeMode.value = collections[0].id;
      hasUserSelectedMode.value = false;
      return;
    }

    if (!hasUserSelectedMode.value) {
      activeMode.value = collections.find((collection) => collection.id === 'visited' && collection.spots.length)?.id
        ?? collections.find((collection) => collection.spots.length)?.id
        ?? collections.find((collection) => collection.id === 'visited')?.id
        ?? collections[0].id;
    }
  },
  { immediate: true },
);

watch(
  activeSpots,
  (nextSpots) => {
    if (!nextSpots.length) {
      selectedSpotId.value = null;
      return;
    }

    if (!nextSpots.some((spot) => spot.id === selectedSpotId.value)) {
      selectedSpotId.value = nextSpots[0].id;
    }
  },
  { immediate: true },
);

function selectMode(mode: ProfileMapMode) {
  activeMode.value = mode;
  hasUserSelectedMode.value = true;
}

function selectSpot(spotId: string) {
  selectedSpotId.value = spotId;
  void nextTick(() => {
    mapViewRef.value?.focusSpotById?.(spotId);
  });
}

function handleSpotSelect(spot: MapPoint) {
  selectedSpotId.value = spot.id;
}

function resolveSpotImageUrl(spot: SpotSummary, width = 640): string {
  return resolveSpotPhotoUrl(spot.category, spot.photoUrl, width);
}

function formatCategory(category: SpotCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function formatSpotLocation(spot: SpotSummary): string {
  const parts = [spot.city, spot.country].filter((value): value is string => Boolean(value?.trim()));
  return parts.length ? parts.join(', ') : 'Scope community pin';
}

function buildViewportForSpots(spots: SpotSummary[]): MapViewport {
  const baseViewport = getDefaultDiscoveryMapViewport();
  if (!spots.length) {
    return baseViewport;
  }

  const longitudes = spots.map((spot) => spot.longitude);
  const latitudes = spots.map((spot) => spot.latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const longitudeSpan = maxLongitude - minLongitude;
  const latitudeSpan = maxLatitude - minLatitude;
  const largestSpan = Math.max(longitudeSpan, latitudeSpan);

  return {
    center: [
      Number(((minLongitude + maxLongitude) / 2).toFixed(5)),
      Number(((minLatitude + maxLatitude) / 2).toFixed(5)),
    ],
    zoom: resolveViewportZoom(spots.length, largestSpan),
    style: baseViewport.style,
  };
}

function resolveViewportZoom(spotCount: number, largestSpan: number): number {
  if (spotCount === 1) {
    return 11.5;
  }

  if (largestSpan > 90) {
    return 2.35;
  }

  if (largestSpan > 35) {
    return 3.1;
  }

  if (largestSpan > 12) {
    return 4.6;
  }

  if (largestSpan > 4) {
    return 6.2;
  }

  if (largestSpan > 1.2) {
    return 8.1;
  }

  return 10.2;
}
</script>

<style scoped>
.profile-map {
  --profile-map-height: clamp(36rem, 68vh, 52rem);
  display: grid;
  gap: var(--space-4);
  min-width: 0;
  height: 100%;
}

.profile-map__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(38rem, auto);
  align-items: end;
  gap: var(--space-4);
}

.profile-map__copy {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.eyebrow,
h2,
h3,
p,
strong,
span {
  margin: 0;
}

.eyebrow {
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-eyebrow);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}

h2 {
  color: var(--text-primary);
  font-size: clamp(1.65rem, 2.4vw, 2.35rem);
  line-height: var(--line-height-tight);
  letter-spacing: 0;
}

.section-copy {
  max-width: 64rem;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  line-height: 1.5;
}

.map-mode-switch {
  display: flex;
  flex-wrap: nowrap;
  justify-content: flex-end;
  gap: var(--space-2);
  width: min(100%, 43rem);
  min-width: min(100%, 38rem);
}

.map-mode-button {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  flex: 1 1 0;
  align-items: center;
  gap: 0.48rem;
  min-width: 0;
  min-height: 2.85rem;
  padding: 0 0.78rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 90%, transparent);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-secondary) 82%, var(--bg-primary) 18%);
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-fast);
}

.map-mode-button:hover,
.map-mode-button:focus-visible,
.map-mode-button.is-active {
  border-color: color-mix(in srgb, var(--accent-teal) 40%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 14%, var(--bg-secondary));
  color: var(--text-primary);
  outline: none;
}

.map-mode-button:hover,
.map-mode-button:focus-visible {
  transform: translateY(var(--motion-card-lift));
}

.map-mode-button :deep(.scope-icon) {
  width: 0.95rem;
  height: 0.95rem;
  color: var(--accent-teal);
}

.map-mode-button span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-mode-button strong {
  color: inherit;
  font-size: 0.84rem;
}

.profile-map__workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(16.5rem, 19rem);
  gap: var(--space-4);
  min-height: var(--profile-map-height);
}

.profile-map__stage,
.profile-map__drawer {
  min-width: 0;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--bg-secondary) 94%, var(--bg-primary) 6%);
  box-shadow:
    0 1.6rem 3.4rem color-mix(in srgb, var(--bg-primary) 34%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 7%, transparent);
}

.profile-map__stage {
  position: relative;
  overflow: hidden;
  min-height: var(--profile-map-height);
}

.profile-map__view {
  width: 100%;
  height: 100%;
  min-height: var(--profile-map-height);
}

.profile-map__view :deep(.map-view),
.profile-map__view :deep(.map-canvas) {
  border-radius: var(--radius-xl);
}

.profile-map__spotlight {
  position: absolute;
  left: var(--space-4);
  top: var(--space-4);
  z-index: calc(var(--z-sidebar) + 1);
  display: grid;
  grid-template-columns: 4.2rem minmax(0, 1fr) auto;
  align-items: stretch;
  gap: 0.75rem;
  width: min(24rem, calc(100% - 2rem));
  padding: 0.72rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 24%, var(--glass-border));
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-secondary) 92%, transparent);
  backdrop-filter: blur(12px) saturate(1.08);
  -webkit-backdrop-filter: blur(12px) saturate(1.08);
  box-shadow: 0 0.85rem 1.8rem color-mix(in srgb, var(--bg-primary) 30%, transparent);
}

.profile-map__spotlight-image {
  width: 4.2rem;
  height: 4.2rem;
  object-fit: cover;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-tertiary);
}

.profile-map__spotlight-copy {
  display: grid;
  align-content: center;
  gap: 0.38rem;
  min-width: 0;
}

.profile-map__spotlight-topline {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.32rem;
}

.badge,
.profile-map__rating {
  display: inline-flex;
  align-items: center;
  gap: 0.32rem;
  min-height: 1.36rem;
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-full);
  font-size: 0.68rem;
  font-weight: var(--font-weight-semibold);
  line-height: 1;
}

.profile-map__rating {
  border: 1px solid color-mix(in srgb, var(--accent-gold) 24%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-gold) 12%, var(--bg-secondary));
  color: var(--text-primary);
}

.profile-map__spotlight-copy h3 {
  color: var(--text-primary);
  display: -webkit-box;
  overflow: hidden;
  font-size: 0.95rem;
  line-height: 1.16;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.profile-map__spotlight-copy p {
  overflow: hidden;
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-map__spotlight-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.34rem;
  align-self: center;
  min-width: 4.65rem;
  min-height: 2.25rem;
  padding: 0 0.72rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 24%, var(--glass-border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 12%, var(--bg-secondary));
  color: var(--accent-teal);
  font-size: 0.74rem;
  font-weight: var(--font-weight-bold);
  line-height: 1;
  text-decoration: none;
}

.profile-map__spotlight-link:hover,
.profile-map__spotlight-link:focus-visible {
  border-color: var(--accent-teal);
  color: var(--text-primary);
  outline: none;
}

.profile-map__spotlight-link :deep(.scope-icon) {
  width: 0.92rem;
  height: 0.92rem;
}

.profile-map__drawer {
  display: grid;
  align-content: start;
  gap: var(--space-4);
  max-height: var(--profile-map-height);
  padding: var(--space-4);
  overflow: auto;
  scrollbar-width: thin;
}

.profile-map__drawer-heading {
  display: grid;
  gap: var(--space-2);
}

.profile-map__drawer-heading h3 {
  color: var(--text-primary);
  font-size: 1.2rem;
  line-height: 1.15;
  letter-spacing: 0;
}

.profile-map__drawer-heading p:not(.eyebrow) {
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  line-height: 1.45;
}

.profile-map__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
}

.profile-map__metric {
  display: grid;
  gap: 0.18rem;
  min-width: 0;
  padding: 0.68rem 0.55rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 75%, transparent);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-primary) 22%, var(--bg-secondary));
}

.profile-map__metric strong {
  color: var(--text-primary);
  font-size: 1.15rem;
  line-height: 1;
}

.profile-map__metric span {
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 0.6rem;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.04em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.profile-map__list {
  display: grid;
  gap: var(--space-2);
}

.profile-map__place {
  display: grid;
  grid-template-columns: 3.35rem minmax(0, 1fr);
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  min-height: 4.35rem;
  padding: 0.52rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 78%, transparent);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-primary) 18%, var(--bg-secondary));
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    transform var(--transition-fast);
}

.profile-map__place:hover,
.profile-map__place:focus-visible,
.profile-map__place.is-active {
  border-color: color-mix(in srgb, var(--accent-teal) 42%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 11%, var(--bg-secondary));
  outline: none;
}

.profile-map__place:hover,
.profile-map__place:focus-visible {
  transform: translateY(var(--motion-card-lift));
}

.profile-map__place-image {
  width: 3.35rem;
  height: 3.35rem;
  object-fit: cover;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-tertiary);
}

.profile-map__place-copy {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.profile-map__place-copy strong,
.profile-map__place-copy span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-map__place-copy strong {
  color: var(--text-primary);
  font-size: 0.86rem;
  line-height: 1.2;
}

.profile-map__place-copy span {
  color: var(--text-secondary);
  font-size: 0.74rem;
}

.profile-map-empty-state {
  min-height: clamp(20rem, 32vw, 28rem);
  display: grid;
  align-content: center;
  justify-items: center;
  gap: var(--space-3);
  padding: clamp(var(--space-5), 4vw, var(--space-8));
  text-align: center;
}

.profile-map-empty-state h3,
.profile-map-empty-state p {
  margin: 0;
}

.profile-map-empty-state h3 {
  max-width: 28rem;
  color: var(--text-primary);
  font-size: clamp(1.35rem, 2vw, 1.9rem);
  line-height: var(--line-height-tight);
  letter-spacing: 0;
}

.profile-map-empty-state p:not(.eyebrow) {
  max-width: 38rem;
  color: var(--text-secondary);
  line-height: var(--line-height-relaxed);
}

.profile-map-empty-state .button {
  margin-top: var(--space-2);
}

@media (max-width: 1180px) {
  .profile-map {
    --profile-map-height: clamp(35rem, 66vh, 46rem);
  }

  .profile-map__header,
  .profile-map__workspace {
    grid-template-columns: 1fr;
  }

  .map-mode-switch {
    width: 100%;
    min-width: 0;
  }

  .profile-map__drawer {
    max-height: none;
  }
}

@media (max-width: 760px) {
  .profile-map {
    --profile-map-height: clamp(30rem, 60vh, 36rem);
  }

  .map-mode-switch {
    overflow-x: auto;
    padding-bottom: 0.1rem;
    scrollbar-width: thin;
  }

  .map-mode-button {
    min-width: 8.25rem;
  }

  .profile-map__spotlight {
    position: static;
    grid-template-columns: 4rem minmax(0, 1fr) auto;
    width: calc(100% - var(--space-4));
    margin: calc(-1 * var(--space-6)) auto var(--space-4);
  }

  .profile-map__spotlight-image {
    width: 4rem;
    height: 4rem;
  }

  .profile-map__metrics {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .profile-map__spotlight {
    grid-template-columns: minmax(0, 1fr);
  }

  .profile-map__spotlight-image {
    display: none;
  }

  .profile-map__spotlight-link {
    justify-self: start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .map-mode-button,
  .profile-map__place {
    transition: none;
  }

  .map-mode-button:hover,
  .map-mode-button:focus-visible,
  .profile-map__place:hover,
  .profile-map__place:focus-visible {
    transform: none;
  }
}
</style>
