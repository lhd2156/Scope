<template>
  <AppShell>
    <div class="map-page">
      <article v-if="workspaceError" class="glass-panel error-panel" role="alert">
        <p class="eyebrow">Temporary issue</p>
        <h2>Part of the map workspace could not be loaded</h2>
        <p class="section-copy">{{ workspaceError }}</p>
      </article>

      <section class="map-workspace">
        <aside class="map-sidebar">
          <Sidebar
            v-model:collapsed="sidebarCollapsed"
            eyebrow="Map workspace"
            title="Filters and highlights"
            collapsible
          >
            <div class="filter-cluster">
              <div class="filter-header">
                <div>
                  <p class="eyebrow">Filters</p>
                  <h3>Category lanes</h3>
                </div>
                <button type="button" class="text-link" @click="mapStore.resetCategories">Reset</button>
              </div>

              <div class="filter-chip-row">
                <button
                  v-for="category in categories"
                  :key="category"
                  type="button"
                  class="filter-chip"
                  :class="{ active: mapStore.activeCategories.includes(category) }"
                  @click="mapStore.toggleCategory(category)"
                >
                  {{ formatCategory(category) }}
                </button>
              </div>
            </div>

            <article class="surface-card sidebar-card route-card" :class="{ 'route-card--empty': !activeTrip }">
              <p class="eyebrow">Featured route</p>
              <h1>{{ routeTitle }}</h1>
              <p class="section-copy">{{ routeDescription }}</p>
              <div class="route-metrics">
                <span>{{ routePoints.length }} stop{{ routePoints.length === 1 ? '' : 's' }}</span>
                <span>{{ activeTrip?.members.length ?? 0 }} traveler{{ (activeTrip?.members.length ?? 0) === 1 ? '' : 's' }}</span>
                <span>{{ routeDestinationLabel }}</span>
              </div>
            </article>

            <article v-if="selectedSpot" class="surface-card sidebar-card selected-card">
              <LazyImage :src="selectedSpot.photoUrl" :alt="selectedSpot.title" class="selected-image" eager />
              <div class="selected-copy">
                <span class="badge" :class="`badge-${selectedSpot.category}`">{{ formatCategory(selectedSpot.category) }}</span>
                <h2>{{ selectedSpot.title }}</h2>
                <p>{{ selectedSpot.description }}</p>
                <div class="selected-meta">
                  <span>{{ selectedSpot.city }}, {{ selectedSpot.country }}</span>
                  <span>★ {{ selectedSpot.rating.toFixed(1) }}</span>
                </div>
                <RouterLink class="detail-link" :to="`/spots/${selectedSpot.id}`">Open spot detail</RouterLink>
              </div>
            </article>

            <article class="surface-card sidebar-card visible-card">
              <div class="visible-header">
                <div>
                  <p class="eyebrow">Visible pins</p>
                  <h2>{{ visibleTitle }}</h2>
                </div>
                <span class="filter-count">{{ mapStore.activeCategories.length }} active filters</span>
              </div>

              <p v-if="workspaceLoading" class="sidebar-state">Loading map pins and route context…</p>
              <div v-else-if="visibleSpots.length" class="visible-list">
                <button
                  v-for="spot in visibleSpots.slice(0, 5)"
                  :key="spot.id"
                  class="visible-item"
                  type="button"
                  :class="{ 'is-selected': spot.id === mapStore.selectedSpotId }"
                  @click="focusSpot(spot.id)"
                >
                  <div>
                    <strong>{{ spot.title }}</strong>
                    <p>{{ spot.city }}, {{ spot.country }}</p>
                  </div>
                  <span>★ {{ spot.rating.toFixed(1) }}</span>
                </button>
              </div>
              <div v-else class="sidebar-empty-state">
                <p>No pins match the current category mix.</p>
                <button type="button" class="button button-secondary" @click="mapStore.resetCategories">Show all categories</button>
              </div>
            </article>
          </Sidebar>
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
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import Sidebar from '@/components/common/Sidebar.vue';
import MapView from '@/components/map/MapView.vue';
import { useMapStore } from '@/stores/map';
import { useSpotsStore } from '@/stores/spots';
import { useTripsStore } from '@/stores/trips';
import type { MapPoint, SpotCategory } from '@/types';

const categories: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'scenic', 'other'];
const mapStore = useMapStore();
const spotsStore = useSpotsStore();
const tripsStore = useTripsStore();
const sidebarCollapsed = ref(false);

function formatCategory(category: SpotCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
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
  photoUrl: spot.photoUrl,
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

const selectedSpot = computed(() => spotsStore.items.find((spot) => spot.id === mapStore.selectedSpotId) ?? visibleSpots.value[0] ?? null);

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
  width: min(var(--page-max-width), calc(100% - (var(--shell-side-padding) * 2)));
  min-height: 100vh;
  margin: 0 auto;
  padding: var(--shell-content-top) 0 var(--space-6);
  display: grid;
  gap: var(--space-6);
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
  grid-template-columns: minmax(20rem, 24rem) minmax(0, 1fr);
  gap: var(--space-6);
  min-height: calc(100vh - var(--shell-content-top) - var(--space-6));
  align-items: stretch;
}

.map-stage,
.sidebar-card {
  overflow: hidden;
}

.map-stage {
  padding: 0;
}

.map-sidebar {
  display: grid;
  align-content: start;
}

.filter-cluster,
.sidebar-card,
.selected-copy,
.sidebar-empty-state {
  display: grid;
  gap: var(--space-4);
}

.sidebar-card {
  padding: var(--space-5);
}

.filter-header,
.visible-header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  align-items: flex-start;
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
  padding: 0.6rem 0.85rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
}

.filter-chip.active,
.filter-chip:hover,
.filter-chip:focus-visible {
  border-color: var(--accent-teal);
  background: var(--accent-teal-light);
  color: var(--text-primary);
  transform: translateY(-0.0625rem);
  outline: none;
}

.text-link,
.detail-link {
  color: var(--accent-teal);
  font-weight: var(--font-weight-semibold);
}

.text-link {
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 0;
}

.selected-image {
  width: 100%;
  height: 11rem;
  object-fit: cover;
  border-radius: var(--radius-xl);
}

.route-card h1,
.selected-copy h2,
.visible-header h2,
.filter-header h3 {
  margin: 0;
}

.eyebrow {
  margin: 0 0 var(--space-1);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.route-metrics,
.selected-meta,
.filter-count,
.selected-copy p,
.visible-item p,
.sidebar-state,
.sidebar-empty-state p {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.route-card--empty {
  background:
    radial-gradient(circle at top right, var(--accent-teal-light), transparent 45%),
    var(--bg-secondary);
}

.visible-list {
  display: grid;
  gap: var(--space-3);
}

.visible-item {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: center;
  width: 100%;
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.visible-item strong,
.visible-item p {
  display: block;
}

.visible-item p {
  margin: var(--space-1) 0 0;
}

.visible-item:hover,
.visible-item:focus-visible,
.visible-item.is-selected {
  border-color: var(--accent-teal);
  background: var(--accent-teal-light);
  transform: translateY(-0.0625rem);
  outline: none;
}

.sidebar-empty-state {
  justify-items: start;
}

.sidebar-empty-state .button {
  width: fit-content;
}

@media (max-width: 1100px) {
  .map-workspace {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .map-sidebar {
    order: 2;
  }

  .map-stage {
    min-height: 32rem;
  }
}
</style>
