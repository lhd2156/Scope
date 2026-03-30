<template>
  <AppShell>
    <div class="map-page">
      <article v-if="workspaceError" class="glass-panel error-panel" role="alert">
        <p class="eyebrow">Temporary issue</p>
        <h2>Part of the map workspace could not be loaded</h2>
        <p class="section-copy">{{ workspaceError }}</p>
      </article>

      <section class="map-workspace">
        <aside class="map-sidebar stagger-in" aria-label="Map workspace sidebar">
          <article class="glass-panel sidebar-panel filter-panel" style="--atlas-stagger-index: 0;">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">Explore categories</p>
                <h1>Curate the map by mood</h1>
              </div>
              <button type="button" class="text-link" @click="mapStore.resetCategories">Reset</button>
            </div>

            <p class="panel-copy">
              Toggle the lanes you want Atlas to spotlight, then jump straight into the best route mix on the map.
            </p>

            <div class="filter-chip-row">
              <button
                v-for="category in categories"
                :key="category"
                type="button"
                class="filter-chip"
                :class="[
                  `badge-${category}`,
                  {
                    'is-inactive': !mapStore.activeCategories.includes(category),
                  },
                ]"
                @click="mapStore.toggleCategory(category)"
              >
                <AtlasIcon :name="categoryIconName(category)" :label="formatCategory(category)" />
                <span>{{ formatCategory(category) }}</span>
              </button>
            </div>
          </article>

          <article class="glass-panel sidebar-panel route-card" :class="{ 'route-card--empty': !activeTrip }" style="--atlas-stagger-index: 1;">
            <div class="panel-heading route-heading">
              <div>
                <p class="eyebrow">Featured route</p>
                <h2>{{ routeTitle }}</h2>
              </div>
              <span class="route-destination-pill">{{ routeDestinationLabel }}</span>
            </div>

            <p class="panel-copy route-copy">{{ routeDescription }}</p>

            <div v-if="routeStopsPreview.length" class="route-preview">
              <div class="route-preview-media">
                <LazyImage :src="routeHeroPhoto" :alt="routeTitle" class="route-hero-image" eager />
                <div class="route-preview-sheen" />

                <div class="route-preview-stops">
                  <article v-for="(stop, index) in routeStopsPreview" :key="stop.id" class="route-preview-stop">
                    <span class="route-preview-index">{{ index + 1 }}</span>
                    <div class="route-preview-copy">
                      <strong>{{ stop.title }}</strong>
                      <small>
                        Day {{ stop.dayNumber ?? index + 1 }}
                        <span v-if="stop.timeSlot">· {{ stop.timeSlot }}</span>
                      </small>
                    </div>
                  </article>
                </div>
              </div>

              <div class="route-footer">
                <div class="route-metrics">
                  <span>
                    <AtlasIcon name="route" label="Route stops" />
                    {{ routePoints.length }} stop{{ routePoints.length === 1 ? '' : 's' }}
                  </span>
                  <span>
                    <AtlasIcon name="friends" label="Travelers" />
                    {{ activeTrip?.members.length ?? 0 }} traveler{{ (activeTrip?.members.length ?? 0) === 1 ? '' : 's' }}
                  </span>
                  <span>
                    <AtlasIcon name="map" label="Destination" />
                    {{ routeDestinationLabel }}
                  </span>
                </div>

                <div v-if="routeMemberPreview.length" class="route-members">
                  <div class="route-member-avatars" aria-hidden="true">
                    <span v-for="member in routeMemberPreview" :key="member.id" class="route-member-avatar">{{ member.initials }}</span>
                  </div>
                  <span class="route-member-copy">Crew synced</span>
                </div>
              </div>
            </div>

            <div v-else class="route-empty-state">
              <p>Pick a trip from the planner to preview its stop sequence and crew context here.</p>
            </div>
          </article>

          <article v-if="selectedSpot" :key="selectedSpot.id" class="glass-panel sidebar-panel selected-card" style="--atlas-stagger-index: 2;">
            <div class="selected-media">
              <LazyImage :src="selectedSpotPhoto" :alt="selectedSpot.title" class="selected-image" eager />
              <div class="selected-media-gradient" />

              <div class="selected-media-topline">
                <span class="selected-label">Featured spot</span>
                <span class="selected-rating">★ {{ selectedSpot.rating.toFixed(1) }}</span>
              </div>
            </div>

            <div class="selected-copy">
              <span class="badge" :class="`badge-${selectedSpot.category}`">{{ formatCategory(selectedSpot.category) }}</span>
              <h2>{{ selectedSpot.title }}</h2>
              <p>{{ selectedSpot.description }}</p>
              <div class="selected-meta">
                <span>{{ selectedSpotLocation }}</span>
                <span v-if="selectedSpot.vibe">{{ selectedSpot.vibe }}</span>
              </div>
              <RouterLink class="detail-link" :to="`/spots/${selectedSpot.id}`">
                <span>Open detail</span>
                <AtlasIcon name="navigation" label="Open selected spot detail" />
              </RouterLink>
            </div>
          </article>

          <article class="glass-panel sidebar-panel visible-card" style="--atlas-stagger-index: 3;">
            <div class="panel-heading visible-heading">
              <div>
                <p class="eyebrow">Your adventure map</p>
                <h2>{{ visibleTitle }}</h2>
              </div>
              <span class="filter-count">{{ activeFilterCountLabel }}</span>
            </div>

            <p v-if="workspaceLoading" class="sidebar-state">Loading map pins and route context…</p>
            <div v-else-if="visibleSpots.length" class="visible-list">
              <button
                v-for="spot in visibleSpots.slice(0, 4)"
                :key="spot.id"
                class="visible-item"
                type="button"
                :class="{ 'is-selected': spot.id === mapStore.selectedSpotId }"
                @click="focusSpot(spot.id)"
              >
                <LazyImage :src="getSpotPhotoUrl(spot.category, spot.photoUrl)" :alt="spot.title" class="visible-image" eager />
                <div class="visible-copy">
                  <strong>{{ spot.title }}</strong>
                  <p>{{ [spot.city, spot.country].filter(Boolean).join(', ') }}</p>
                </div>
                <span class="visible-rating">★ {{ spot.rating.toFixed(1) }}</span>
              </button>
            </div>
            <div v-else class="sidebar-empty-state">
              <p>No pins match the current category mix.</p>
              <button type="button" class="button button-secondary" @click="mapStore.resetCategories">Show all categories</button>
            </div>
          </article>
        </aside>

        <article class="map-stage glass-panel">
          <MapView
            :spots="mapSpots"
            :route-points="routePoints"
            :selected-spot-id="mapStore.selectedSpotId"
            @spot-select="handleSpotSelect"
          />
        </article>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import MapView from '@/components/map/MapView.vue';
import { useMapStore } from '@/stores/map';
import { useSpotsStore } from '@/stores/spots';
import { useTripsStore } from '@/stores/trips';
import type { MapPoint, SpotCategory } from '@/types';
import { CATEGORY_TRAVEL_PHOTOS } from '@/utils/demoMedia';

interface RoutePreviewStop {
  id: string;
  title: string;
  category: SpotCategory;
  city: string;
  dayNumber?: number;
  timeSlot?: string;
  photoUrl: string;
}

const categories: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'scenic', 'other'];

const mapStore = useMapStore();
const spotsStore = useSpotsStore();
const tripsStore = useTripsStore();

function formatCategory(category: SpotCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function categoryIconName(category: SpotCategory): string {
  return category === 'other' ? 'pin' : category;
}

function getFallbackPhoto(category: SpotCategory): string {
  return CATEGORY_TRAVEL_PHOTOS[category];
}

function getSpotPhotoUrl(category: SpotCategory, photoUrl?: string): string {
  return photoUrl || getFallbackPhoto(category);
}

function getMemberInitials(displayName: string): string {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

const mapSpots = computed<MapPoint[]>(() => spotsStore.items.map((spot) => ({
  id: spot.id,
  title: spot.title,
  latitude: spot.latitude,
  longitude: spot.longitude,
  category: spot.category,
  city: spot.city,
  vibe: spot.vibe,
  rating: spot.rating,
  photoUrl: getSpotPhotoUrl(spot.category, spot.photoUrl),
})));

const activeTrip = computed(() => tripsStore.items[0] ?? null);
const workspaceLoading = computed(() => spotsStore.loading || tripsStore.loading);
const workspaceError = computed(() => spotsStore.error || tripsStore.error || '');
const routePoints = computed<MapPoint[]>(() => (activeTrip.value?.spots ?? []).map((spot) => ({
  id: spot.spotId,
  title: spot.title,
  latitude: spot.latitude,
  longitude: spot.longitude,
  category: spot.category,
}))); 
const routeTitle = computed(() => {
  if (activeTrip.value?.title) {
    return activeTrip.value.title;
  }

  return workspaceLoading.value ? 'Loading route preview' : 'Route preview ready';
});
const routeDescription = computed(() => {
  if (activeTrip.value?.description) {
    return activeTrip.value.description;
  }

  if (workspaceLoading.value) {
    return 'Atlas is syncing trip context into the map workspace.';
  }

  return 'Pick a trip from the planner to preview its stop sequence and crew context on the map.';
});
const routeDestinationLabel = computed(() => activeTrip.value?.destination ?? 'Trip planner');
const routeStopsPreview = computed<RoutePreviewStop[]>(() => {
  if (!activeTrip.value) {
    return [];
  }

  return activeTrip.value.spots.slice(0, 4).map((stop) => {
    const matchingSpot = spotsStore.items.find((spot) => spot.id === stop.spotId);

    return {
      id: stop.spotId,
      title: stop.title,
      category: stop.category,
      city: stop.city ?? matchingSpot?.city ?? activeTrip.value?.destination ?? 'Atlas route',
      dayNumber: stop.dayNumber,
      timeSlot: stop.timeSlot,
      photoUrl: getSpotPhotoUrl(stop.category, stop.photoUrl ?? matchingSpot?.photoUrl),
    };
  });
});
const routeHeroPhoto = computed(() => activeTrip.value?.coverImageUrl ?? routeStopsPreview.value[0]?.photoUrl ?? getFallbackPhoto('adventure'));
const routeMemberPreview = computed(() => (activeTrip.value?.members ?? []).slice(0, 3).map((member) => ({
  id: member.id,
  initials: getMemberInitials(member.displayName),
})));

const visibleSpots = computed(() => {
  const visibleIds = new Set(mapStore.visibleSpotIds);
  const scopedSpots = visibleIds.size
    ? spotsStore.items.filter((spot) => visibleIds.has(spot.id))
    : spotsStore.items.filter((spot) => mapStore.activeCategories.includes(spot.category));

  return scopedSpots;
});

const visibleTitle = computed(() => {
  const count = visibleSpots.value.length;
  return `${count} spot${count === 1 ? '' : 's'} ready to explore`;
});
const activeFilterCountLabel = computed(() => `${mapStore.activeCategories.length}/${categories.length} live`);

const selectedSpot = computed(() => spotsStore.items.find((spot) => spot.id === mapStore.selectedSpotId) ?? visibleSpots.value[0] ?? null);
const selectedSpotPhoto = computed(() => {
  if (!selectedSpot.value) {
    return routeHeroPhoto.value;
  }

  return getSpotPhotoUrl(selectedSpot.value.category, selectedSpot.value.photoUrl);
});
const selectedSpotLocation = computed(() => {
  if (!selectedSpot.value) {
    return 'Atlas';
  }

  return [selectedSpot.value.city, selectedSpot.value.country].filter(Boolean).join(', ');
});

function handleSpotSelect(spot: MapPoint) {
  mapStore.setSelectedSpotId(spot.id);
}

function focusSpot(spotId: string) {
  const spot = spotsStore.items.find((entry) => entry.id === spotId);
  if (!spot) {
    return;
  }

  mapStore.setSelectedSpotId(spot.id);
  mapStore.setCenter([spot.longitude, spot.latitude]);
  mapStore.setZoom(12);
}

onMounted(async () => {
  await Promise.allSettled([spotsStore.fetchSpots(), tripsStore.fetchTrips()]);

  if (!mapStore.selectedSpotId && spotsStore.items[0]) {
    mapStore.setSelectedSpotId(spotsStore.items[0].id);
  }
});
</script>

<style scoped>
.map-page {
  width: calc(100vw - (var(--shell-side-padding) * 2));
  min-height: 100vh;
  margin: 0 auto;
  padding: calc(var(--shell-content-top) - var(--space-3)) 0 var(--space-6);
  display: grid;
  gap: var(--space-5);
}

.error-panel {
  padding: var(--space-6);
}

.error-panel h2,
.error-panel p {
  margin: 0;
}

.map-workspace {
  display: grid;
  grid-template-columns: minmax(20rem, 21.5rem) minmax(0, 1fr);
  gap: var(--space-4);
  min-height: calc(100vh - var(--shell-content-top) - var(--space-5));
  align-items: stretch;
}

.map-sidebar {
  display: grid;
  align-content: start;
  gap: var(--space-4);
}

.sidebar-panel,
.selected-copy,
.sidebar-empty-state,
.route-preview,
.route-empty-state {
  display: grid;
  gap: var(--space-4);
}

.sidebar-panel {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  padding: var(--space-5);
  box-shadow: var(--shadow-lg);
}

.panel-heading,
.visible-heading,
.route-footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-3);
}

.panel-heading h1,
.panel-heading h2,
.route-heading h2,
.selected-copy h2,
.error-panel h2 {
  margin: 0;
}

.panel-heading h1 {
  font-size: var(--font-size-h1);
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-display);
}

.panel-heading h2,
.selected-copy h2 {
  font-size: var(--font-size-h2);
  line-height: var(--line-height-tight);
}

.eyebrow,
.selected-label {
  margin: 0;
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-eyebrow);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}

.panel-copy,
.route-copy,
.selected-copy p,
.route-empty-state p,
.sidebar-state,
.sidebar-empty-state p,
.visible-copy p,
.filter-count,
.route-member-copy,
.selected-meta span,
.route-preview-copy small,
.route-metrics span {
  color: var(--text-secondary);
}

.panel-copy,
.route-copy,
.selected-copy p,
.route-empty-state p,
.sidebar-empty-state p,
.sidebar-state,
.visible-copy p {
  margin: 0;
  line-height: var(--line-height-relaxed);
}

.filter-chip-row,
.route-metrics,
.selected-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 0.72rem 0.95rem;
  border-radius: var(--radius-full);
  border: 1px solid transparent;
  color: inherit;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast),
    opacity var(--transition-fast);
}

.filter-chip:not(.is-inactive) {
  border-color: currentColor;
  box-shadow:
    inset 0 0 0 1px currentColor,
    var(--shadow-sm),
    0 0 1.35rem color-mix(in srgb, currentColor 16%, transparent);
}

.filter-chip.is-inactive {
  background: color-mix(in srgb, var(--bg-elevated) 82%, transparent);
  border-color: var(--border);
  color: var(--text-secondary);
  box-shadow: var(--shadow-sm);
}

.filter-chip:hover,
.filter-chip:focus-visible,
.text-link:hover,
.text-link:focus-visible,
.detail-link:hover,
.detail-link:focus-visible,
.visible-item:hover,
.visible-item:focus-visible {
  transform: translateY(var(--motion-card-lift));
  outline: none;
}

.filter-chip:active,
.text-link:active,
.detail-link:active,
.visible-item:active {
  transform: translateY(0) scale(var(--motion-press-scale));
}

.filter-chip.is-inactive:hover,
.filter-chip.is-inactive:focus-visible {
  border-color: var(--border-hover);
  background: color-mix(in srgb, var(--accent-teal-light) 50%, var(--glass-bg));
  color: var(--text-primary);
}

.filter-chip :deep(.atlas-icon) {
  width: 1rem;
  height: 1rem;
}

.text-link,
.detail-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  width: fit-content;
  color: var(--accent-teal);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  transition:
    transform var(--transition-fast),
    color var(--transition-fast),
    opacity var(--transition-fast);
}

.text-link {
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.route-card {
  background:
    radial-gradient(circle at top right, var(--accent-teal-light), transparent 42%),
    radial-gradient(circle at bottom left, var(--accent-gold-light), transparent 35%),
    var(--glass-bg);
}

.route-destination-pill,
.filter-count,
.selected-rating,
.selected-label,
.selected-meta span,
.route-metrics span,
.route-member-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
}

.route-destination-pill,
.filter-count {
  padding: 0.55rem 0.8rem;
  border: 1px solid var(--glass-border);
  background: color-mix(in srgb, var(--glass-bg) 90%, transparent);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
}

.route-preview-media {
  position: relative;
  min-height: 14rem;
  border-radius: var(--radius-xl);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--text-primary) 14%, transparent);
  background: linear-gradient(180deg, color-mix(in srgb, var(--bg-tertiary) 86%, transparent), var(--bg-secondary));
}

.route-hero-image,
.selected-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-normal);
}

.route-hero-image {
  position: absolute;
  inset: 0;
  transform: scale(1.04);
}

.route-preview-sheen,
.selected-media-gradient {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.route-preview-sheen {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 18%, transparent), color-mix(in srgb, var(--bg-primary) 82%, transparent)),
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent-teal) 18%, transparent), transparent 46%);
}

.route-preview-stops {
  position: relative;
  z-index: 1;
  min-height: 100%;
  padding: var(--space-4);
  align-content: end;
}

.route-preview-stop {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: var(--space-3);
  padding: 0.8rem 0.9rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--glass-border);
  background: color-mix(in srgb, var(--bg-primary) 58%, transparent);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
}

.route-preview-index {
  width: 2rem;
  height: 2rem;
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  background: color-mix(in srgb, var(--accent-teal) 28%, var(--bg-primary));
}

.route-preview-copy strong,
.route-preview-copy small,
.visible-copy strong,
.visible-copy p {
  display: block;
}

.route-preview-copy strong,
.visible-copy strong {
  color: var(--text-primary);
}

.route-preview-copy small,
.route-member-copy,
.visible-copy p,
.visible-rating {
  font-size: var(--font-size-small);
}

.route-footer {
  align-items: center;
  flex-wrap: wrap;
}

.route-metrics span {
  gap: var(--space-2);
  padding: 0.6rem 0.8rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  background: color-mix(in srgb, var(--bg-primary) 26%, transparent);
}

.route-metrics :deep(.atlas-icon),
.detail-link :deep(.atlas-icon) {
  width: 1rem;
  height: 1rem;
}

.route-members {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
}

.route-member-avatars {
  display: flex;
  padding-left: var(--space-2);
}

.route-member-avatar {
  width: 2rem;
  height: 2rem;
  margin-left: calc(var(--space-2) * -1);
  border: 2px solid color-mix(in srgb, var(--glass-bg) 100%, transparent);
  background: color-mix(in srgb, var(--accent-teal) 20%, var(--bg-primary));
  color: var(--text-primary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-bold);
}

.route-empty-state {
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  border: 1px dashed var(--glass-border);
  background: color-mix(in srgb, var(--bg-primary) 18%, transparent);
}

.selected-card {
  gap: var(--space-4);
}

.selected-media {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.selected-media-gradient {
  background: linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--bg-primary) 78%, transparent) 100%);
}

.selected-media-topline {
  position: absolute;
  inset: var(--space-4) var(--space-4) auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
}

.selected-label,
.selected-rating {
  padding: 0.5rem 0.8rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  background: color-mix(in srgb, var(--bg-primary) 34%, transparent);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
}

.selected-rating {
  color: var(--accent-gold);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.selected-copy {
  align-content: start;
}

.selected-copy .badge {
  width: fit-content;
  padding: 0.45rem 0.75rem;
  border-radius: var(--radius-full);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.selected-meta span {
  padding: 0.45rem 0.7rem;
  border: 1px solid var(--glass-border);
  background: color-mix(in srgb, var(--bg-primary) 22%, transparent);
  font-size: var(--font-size-small);
}

.visible-list {
  display: grid;
  gap: var(--space-3);
}

.visible-item {
  width: 100%;
  display: grid;
  grid-template-columns: 4.5rem minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-xl);
  border: 1px solid var(--glass-border);
  background: color-mix(in srgb, var(--bg-primary) 22%, transparent);
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    background var(--transition-fast);
}

.visible-item.is-selected {
  border-color: var(--accent-teal);
  box-shadow:
    var(--shadow-md),
    0 0 1.5rem color-mix(in srgb, var(--accent-teal) 18%, transparent);
  background: color-mix(in srgb, var(--accent-teal) 10%, var(--glass-bg));
}

.visible-item:hover,
.visible-item:focus-visible {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-md);
}

.visible-item:hover .visible-image,
.visible-item:focus-visible .visible-image,
.selected-card:hover .selected-image,
.route-card:hover .route-hero-image {
  transform: scale(var(--motion-image-zoom));
}

.visible-image {
  width: 4.5rem;
  aspect-ratio: 1;
  border-radius: var(--radius-lg);
  object-fit: cover;
  overflow: hidden;
  transition: transform var(--transition-normal);
}

.visible-rating {
  color: var(--accent-gold);
  font-weight: var(--font-weight-semibold);
}

.sidebar-empty-state {
  justify-items: start;
}

.sidebar-empty-state .button {
  width: fit-content;
}

.map-stage {
  min-height: calc(100vh - var(--shell-content-top) - var(--space-5));
  padding: 0;
  overflow: hidden;
}

@media (prefers-reduced-motion: no-preference) {
  .selected-card {
    animation: selected-spot-slide-in 460ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }
}

@media (prefers-reduced-motion: reduce) {
  .selected-card {
    opacity: 1;
    animation: none;
  }

  .filter-chip,
  .filter-chip:hover,
  .filter-chip:focus-visible,
  .filter-chip:active,
  .text-link:hover,
  .text-link:focus-visible,
  .text-link:active,
  .detail-link:hover,
  .detail-link:focus-visible,
  .detail-link:active,
  .visible-item:hover,
  .visible-item:focus-visible,
  .visible-item:active,
  .visible-item:hover .visible-image,
  .visible-item:focus-visible .visible-image,
  .selected-card:hover .selected-image,
  .route-card:hover .route-hero-image {
    transform: none;
  }
}

@keyframes selected-spot-slide-in {
  from {
    opacity: 0;
    transform: translateX(calc(var(--motion-modal-panel-shift) * -1));
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@media (max-width: 1100px) {
  .map-workspace {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .map-stage {
    min-height: 36rem;
    order: 1;
  }

  .map-sidebar {
    order: 2;
  }
}

@media (max-width: 720px) {
  .map-page {
    padding-top: var(--shell-content-top);
  }

  .panel-heading,
  .visible-heading,
  .route-footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .visible-item {
    grid-template-columns: 4.5rem minmax(0, 1fr);
  }

  .visible-rating {
    grid-column: 2;
  }
}
</style>
