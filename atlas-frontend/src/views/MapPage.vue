<template>
  <AppShell>
    <div class="map-page">
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

            <article class="surface-card sidebar-card route-card">
              <p class="eyebrow">Featured route</p>
              <h1>{{ activeTrip?.title ?? 'Atlas route preview' }}</h1>
              <p class="section-copy">
                {{ activeTrip?.description ?? 'Trip routes light up here as soon as the content engine returns itinerary data.' }}
              </p>
              <div class="route-metrics">
                <span>{{ routePoints.length }} stops</span>
                <span>{{ activeTrip?.members.length ?? 0 }} travelers</span>
                <span>{{ activeTrip?.destination ?? 'Texas demo circuit' }}</span>
              </div>
            </article>

            <article v-if="selectedSpot" class="surface-card sidebar-card selected-card">
              <img :src="selectedSpot.photoUrl" :alt="selectedSpot.title" class="selected-image" />
              <div class="selected-copy">
                <span class="badge" :class="`badge-${selectedSpot.category}`">{{ selectedSpot.category }}</span>
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
                  <h2>{{ visibleSpots.length }} spots ready to explore</h2>
                </div>
                <span class="filter-count">{{ mapStore.activeCategories.length }} active filters</span>
              </div>

              <div class="visible-list">
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
const routePoints = computed<MapPoint[]>(() => (activeTrip.value?.spots ?? []).map((spot) => ({
  id: spot.spotId,
  title: spot.title,
  latitude: spot.latitude,
  longitude: spot.longitude,
  category: spot.category,
})));

const visibleSpots = computed(() => {
  const visibleIds = new Set(mapStore.visibleSpotIds);
  const scopedSpots = visibleIds.size
    ? spotsStore.items.filter((spot) => visibleIds.has(spot.id))
    : spotsStore.items.filter((spot) => mapStore.activeCategories.includes(spot.category));

  return scopedSpots;
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
  await Promise.all([spotsStore.fetchSpots(), tripsStore.fetchTrips()]);

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
.selected-copy {
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
.visible-item p {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
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
