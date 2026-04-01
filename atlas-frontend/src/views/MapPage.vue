<template>
  <AppShell>
    <div class="map-page" :class="{ 'map-page--mobile': isMobileMapLayout }">
      <article v-if="workspaceError" class="glass-panel error-panel" role="alert">
        <p class="eyebrow">Temporary issue</p>
        <h2>Part of the map workspace could not be loaded</h2>
        <p class="section-copy">{{ workspaceError }}</p>
      </article>

      <section class="map-workspace" :class="{ 'map-workspace--mobile': isMobileMapLayout }">
        <aside
          class="map-sidebar"
          :class="{
            'map-sidebar--mobile': isMobileMapLayout,
            'is-dragging': isDraggingMobileSheet,
          }"
          :style="mobileSheetStyle"
          :data-sheet-state="isMobileMapLayout ? mobileSheetState : 'desktop'"
          :aria-label="isMobileMapLayout ? 'Map workspace bottom sheet' : 'Map workspace sidebar'"
          data-test="map-mobile-sheet"
          @keydown="handleSidebarKeydown"
        >
          <button
            v-if="isMobileMapLayout"
            type="button"
            class="mobile-sheet-toggle glass-panel"
            data-test="map-mobile-sheet-toggle"
            :aria-expanded="String(mobileSheetState !== 'peek')"
            :aria-label="mobileSheetAriaLabel"
            @click="handleMobileSheetToggle"
            @pointerdown="startMobileSheetDrag"
          >
            <span class="mobile-sheet-grabber" aria-hidden="true" />
            <div class="mobile-sheet-summary">
              <p class="eyebrow">Map sidebar</p>
              <div class="mobile-sheet-summary-row">
                <h2>{{ mobileSheetHeadline }}</h2>
                <span class="filter-count mobile-sheet-count">{{ activeFilterCountLabel }}</span>
              </div>
              <p class="mobile-sheet-copy">{{ mobileSheetDescription }}</p>
            </div>
          </button>

          <div class="map-sidebar-scroll stagger-in" :class="{ 'map-sidebar-scroll--mobile': isMobileMapLayout }">
            <article class="glass-panel sidebar-panel filter-panel" style="--atlas-stagger-index: 0;" data-onboarding-target="map-filters">
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

            <article
              v-if="selectedSpot"
              :key="selectedSpot.id"
              class="glass-panel sidebar-panel selected-card"
              style="--atlas-stagger-index: 2;"
              data-test="map-selected-spot-card"
            >
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
                <RouterLink class="detail-link" :to="`/spots/${selectedSpot.id}`" data-test="map-selected-spot-detail-link">
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
          </div>
        </aside>

        <article class="map-stage glass-panel" :class="{ 'map-stage--mobile': isMobileMapLayout }">
          <MapView
            class="map-stage-view"
            :class="{ 'map-view--mobile': isMobileMapLayout }"
            :style="mapViewStyle"
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
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

type MobileSheetState = 'peek' | 'mid' | 'full';

const MOBILE_MAP_BREAKPOINT = 640;
const MOBILE_SHEET_DRAG_LIMIT = 280;
const MOBILE_SHEET_DRAG_THRESHOLD = 72;
const MOBILE_SHEET_STATES: MobileSheetState[] = ['peek', 'mid', 'full'];
const categories: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'scenic', 'other'];

const mapStore = useMapStore();
const spotsStore = useSpotsStore();
const tripsStore = useTripsStore();
const isMobileMapLayout = ref(false);
const mobileSheetState = ref<MobileSheetState>('peek');
const isDraggingMobileSheet = ref(false);
const mobileSheetDragStartY = ref(0);
const mobileSheetDragOffset = ref(0);
const ignoreNextMobileSheetClick = ref(false);

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

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

function resolveIsMobileMapLayout(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.innerWidth <= MOBILE_MAP_BREAKPOINT;
}

function syncMobileMapLayout() {
  isMobileMapLayout.value = resolveIsMobileMapLayout();
}

function setMobileSheetState(nextState: MobileSheetState) {
  mobileSheetState.value = nextState;
}

function getAdjacentMobileSheetState(direction: -1 | 1): MobileSheetState {
  const currentIndex = MOBILE_SHEET_STATES.indexOf(mobileSheetState.value);
  const nextIndex = clampNumber(currentIndex + direction, 0, MOBILE_SHEET_STATES.length - 1);
  return MOBILE_SHEET_STATES[nextIndex];
}

function removeMobileSheetPointerListeners() {
  if (typeof window === 'undefined') {
    return;
  }

  window.removeEventListener('pointermove', handleMobileSheetDrag);
  window.removeEventListener('pointerup', finishMobileSheetDrag);
  window.removeEventListener('pointercancel', cancelMobileSheetDrag);
}

function cancelMobileSheetDrag() {
  isDraggingMobileSheet.value = false;
  mobileSheetDragOffset.value = 0;
  removeMobileSheetPointerListeners();
}

function handleMobileSheetDrag(event: PointerEvent) {
  if (!isDraggingMobileSheet.value) {
    return;
  }

  mobileSheetDragOffset.value = clampNumber(
    event.clientY - mobileSheetDragStartY.value,
    -MOBILE_SHEET_DRAG_LIMIT,
    MOBILE_SHEET_DRAG_LIMIT,
  );
}

function finishMobileSheetDrag() {
  if (!isDraggingMobileSheet.value) {
    return;
  }

  const dragDelta = mobileSheetDragOffset.value;
  const hasMeaningfulDrag = Math.abs(dragDelta) > 10;

  cancelMobileSheetDrag();

  if (hasMeaningfulDrag) {
    ignoreNextMobileSheetClick.value = true;
  }

  if (dragDelta <= -MOBILE_SHEET_DRAG_THRESHOLD) {
    setMobileSheetState(getAdjacentMobileSheetState(1));
    return;
  }

  if (dragDelta >= MOBILE_SHEET_DRAG_THRESHOLD) {
    setMobileSheetState(getAdjacentMobileSheetState(-1));
  }
}

function startMobileSheetDrag(event: PointerEvent) {
  if (!isMobileMapLayout.value) {
    return;
  }

  const currentTarget = event.currentTarget;
  if (currentTarget instanceof HTMLElement && typeof currentTarget.setPointerCapture === 'function') {
    try {
      currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is optional for the drag affordance.
    }
  }

  mobileSheetDragStartY.value = event.clientY;
  mobileSheetDragOffset.value = 0;
  isDraggingMobileSheet.value = true;
  ignoreNextMobileSheetClick.value = false;

  if (typeof window !== 'undefined') {
    window.addEventListener('pointermove', handleMobileSheetDrag);
    window.addEventListener('pointerup', finishMobileSheetDrag);
    window.addEventListener('pointercancel', cancelMobileSheetDrag);
  }
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
const nextMobileSheetState = computed<MobileSheetState>(() => {
  switch (mobileSheetState.value) {
    case 'peek':
      return 'mid';
    case 'mid':
      return 'full';
    default:
      return 'peek';
  }
});
const mobileSheetVisibleHeight = computed(() => {
  switch (mobileSheetState.value) {
    case 'peek':
      return '8.75rem';
    case 'mid':
      return 'clamp(22rem, 52dvh, 30rem)';
    default:
      return '100%';
  }
});
const mobileSheetHeadline = computed(() => selectedSpot.value?.title ?? routeTitle.value);
const mobileSheetDescription = computed(() => {
  if (selectedSpot.value) {
    return `${selectedSpotLocation.value} · Swipe up for filters, route preview, and nearby pins.`;
  }

  return `${visibleTitle.value} · Swipe up for filters, route preview, and nearby pins.`;
});
const mobileSheetAriaLabel = computed(() => {
  switch (nextMobileSheetState.value) {
    case 'mid':
      return 'Expand map sidebar';
    case 'full':
      return 'Open full map sidebar';
    default:
      return 'Collapse map sidebar';
  }
});
const mobileSheetStyle = computed(() => {
  if (!isMobileMapLayout.value) {
    return undefined;
  }

  return {
    '--atlas-mobile-sheet-visible': mobileSheetVisibleHeight.value,
    '--atlas-mobile-sheet-drag-offset': `${mobileSheetDragOffset.value}px`,
  };
});
const mapViewStyle = computed(() => {
  if (!isMobileMapLayout.value) {
    return undefined;
  }

  return {
    '--atlas-map-controls-top': 'var(--space-3)',
    '--atlas-map-controls-right': 'var(--space-3)',
    '--atlas-map-controls-bottom': 'auto',
    '--atlas-map-controls-left': 'auto',
    '--atlas-map-controls-panel-top': 'var(--space-3)',
    '--atlas-map-controls-panel-right': 'var(--space-3)',
    '--atlas-map-controls-panel-bottom': 'auto',
    '--atlas-map-controls-panel-left': 'auto',
  };
});

function handleMobileSheetToggle() {
  if (!isMobileMapLayout.value) {
    return;
  }

  if (ignoreNextMobileSheetClick.value) {
    ignoreNextMobileSheetClick.value = false;
    return;
  }

  setMobileSheetState(nextMobileSheetState.value);
}

function revealMobileSheet() {
  if (!isMobileMapLayout.value || mobileSheetState.value !== 'peek') {
    return;
  }

  setMobileSheetState('mid');
}

function handleSpotSelect(spot: MapPoint) {
  mapStore.setSelectedSpotId(spot.id);
  revealMobileSheet();
}

function focusSpot(spotId: string) {
  const spot = spotsStore.items.find((entry) => entry.id === spotId);
  if (!spot) {
    return;
  }

  mapStore.setSelectedSpotId(spot.id);
  mapStore.setCenter([spot.longitude, spot.latitude]);
  mapStore.setZoom(12);
  revealMobileSheet();
}

function handleSidebarKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isMobileMapLayout.value && mobileSheetState.value !== 'peek') {
    setMobileSheetState('peek');
  }
}

watch(
  isMobileMapLayout,
  (isMobile) => {
    if (!isMobile) {
      cancelMobileSheetDrag();
    }

    ignoreNextMobileSheetClick.value = false;
    mobileSheetState.value = 'peek';
  },
  { immediate: true },
);

onMounted(async () => {
  syncMobileMapLayout();
  window.addEventListener('resize', syncMobileMapLayout);

  await Promise.allSettled([spotsStore.fetchSpots(), tripsStore.fetchTrips()]);

  if (!mapStore.selectedSpotId && spotsStore.items[0]) {
    mapStore.setSelectedSpotId(spotsStore.items[0].id);
  }
});

onBeforeUnmount(() => {
  cancelMobileSheetDrag();
  window.removeEventListener('resize', syncMobileMapLayout);
});
</script>

<style scoped>
.map-page {
  width: 100%;
  max-width: var(--shell-max-width-with-safe-area);
  min-height: 100vh;
  min-height: 100dvh;
  margin: 0 auto;
  padding:
    calc(var(--shell-content-top) - var(--space-3))
    calc(var(--shell-side-padding) + var(--safe-area-right))
    calc(var(--space-6) + var(--safe-area-bottom))
    calc(var(--shell-side-padding) + var(--safe-area-left));
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
  position: relative;
  display: grid;
  grid-template-columns: minmax(20rem, 21.5rem) minmax(0, 1fr);
  gap: var(--space-4);
  min-height: calc(100dvh - var(--shell-content-top) - var(--space-5));
  align-items: stretch;
}

.map-sidebar {
  min-height: 0;
}

.map-sidebar-scroll,
.sidebar-panel,
.selected-copy,
.sidebar-empty-state,
.route-preview,
.route-empty-state {
  display: grid;
  gap: var(--space-4);
}

.map-sidebar-scroll {
  align-content: start;
}

.mobile-sheet-toggle {
  display: none;
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
.route-footer,
.mobile-sheet-summary-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-3);
}

.panel-heading h1,
.panel-heading h2,
.route-heading h2,
.selected-copy h2,
.error-panel h2,
.mobile-sheet-summary h2 {
  margin: 0;
}

.panel-heading h1 {
  font-size: var(--font-size-h1);
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-display);
}

.panel-heading h2,
.selected-copy h2,
.mobile-sheet-summary h2 {
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
.route-metrics span,
.mobile-sheet-copy {
  color: var(--text-secondary);
}

.panel-copy,
.route-copy,
.selected-copy p,
.route-empty-state p,
.sidebar-empty-state p,
.sidebar-state,
.visible-copy p,
.mobile-sheet-copy {
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
.visible-item:focus-visible,
.mobile-sheet-toggle:hover,
.mobile-sheet-toggle:focus-visible {
  transform: translateY(var(--motion-card-lift));
  outline: none;
}

.filter-chip:active,
.text-link:active,
.detail-link:active,
.visible-item:active,
.mobile-sheet-toggle:active {
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
.visible-rating,
.mobile-sheet-copy {
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
  min-height: calc(100dvh - var(--shell-content-top) - var(--space-5));
  padding: 0;
  overflow: hidden;
}

.map-stage-view {
  height: 100%;
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

  .mobile-sheet-toggle,
  .mobile-sheet-toggle:hover,
  .mobile-sheet-toggle:focus-visible,
  .mobile-sheet-toggle:active,
  .map-sidebar--mobile {
    transition: none;
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

@media (max-width: 1024px) {
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

@media (max-width: 640px) {
  .map-page--mobile {
    width: 100vw;
    margin-inline: calc(50% - 50vw);
    padding: calc(var(--shell-content-top) - var(--space-2)) 0 0;
    gap: var(--space-4);
  }

  .map-page--mobile .error-panel {
    margin-inline: max(var(--space-3), var(--safe-area-left)) max(var(--space-3), var(--safe-area-right));
  }

  .map-workspace--mobile {
    grid-template-columns: 1fr;
    gap: 0;
    min-height: calc(100dvh - var(--shell-content-top) + var(--space-2));
    height: calc(100dvh - var(--shell-content-top) + var(--space-2));
  }

  .map-stage--mobile {
    min-height: 100%;
    height: 100%;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  .map-stage--mobile :deep(.map-view) {
    border-radius: 0;
  }

  .map-stage--mobile :deep(.map-controls) {
    --atlas-map-controls-right: max(var(--space-3), var(--safe-area-right));
    --atlas-map-controls-bottom: max(var(--space-3), var(--safe-area-bottom));
    --atlas-map-controls-panel-right: max(var(--space-3), var(--safe-area-right));
    --atlas-map-controls-panel-bottom: max(var(--space-3), var(--safe-area-bottom));
    --atlas-map-controls-panel-left: max(var(--space-3), var(--safe-area-left));
  }

  .map-sidebar--mobile {
    position: absolute;
    inset: auto 0 0;
    z-index: calc(var(--z-sidebar) + 1);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: var(--space-3);
    height: calc(100% - var(--space-3));
    padding:
      0
      max(var(--space-3), var(--safe-area-right))
      calc(var(--space-3) + var(--safe-area-bottom))
      max(var(--space-3), var(--safe-area-left));
    transform: translateY(calc(100% - var(--atlas-mobile-sheet-visible) + var(--atlas-mobile-sheet-drag-offset, 0px)));
    transition: transform var(--transition-normal);
    will-change: transform;
  }

  .map-sidebar--mobile.is-dragging {
    transition: none;
  }

  .mobile-sheet-toggle {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4) var(--space-4);
    border: 1px solid var(--glass-border);
    background: color-mix(in srgb, var(--glass-bg) 96%, transparent);
    box-shadow: var(--shadow-lg);
    cursor: grab;
    text-align: left;
    touch-action: none;
  }

  .mobile-sheet-grabber {
    width: 3.5rem;
    height: 0.35rem;
    margin: 0 auto;
    border-radius: var(--radius-full);
    background: color-mix(in srgb, var(--text-secondary) 60%, transparent);
  }

  .mobile-sheet-summary {
    display: grid;
    gap: var(--space-2);
  }

  .mobile-sheet-summary h2 {
    font-size: clamp(1.1rem, 4vw, 1.35rem);
  }

  .mobile-sheet-summary-row {
    align-items: center;
  }

  .mobile-sheet-count {
    white-space: nowrap;
  }

  .map-sidebar-scroll--mobile {
    min-height: 0;
    overflow-y: auto;
    padding-right: 0.15rem;
    overscroll-behavior: contain;
  }

  .map-sidebar--mobile .selected-card {
    order: 1;
  }

  .map-sidebar--mobile .filter-panel {
    order: 2;
  }

  .map-sidebar--mobile .route-card {
    order: 3;
  }

  .map-sidebar--mobile .visible-card {
    order: 4;
  }

  .map-sidebar--mobile .sidebar-panel {
    padding: var(--space-4);
  }

  .map-sidebar--mobile .panel-heading h1 {
    font-size: clamp(1.5rem, 5vw, 1.95rem);
  }

  .map-sidebar--mobile .panel-heading,
  .map-sidebar--mobile .visible-heading,
  .map-sidebar--mobile .route-footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .map-sidebar--mobile .visible-item {
    grid-template-columns: 4rem minmax(0, 1fr);
  }

  .map-sidebar--mobile .visible-image {
    width: 4rem;
  }

  .map-sidebar--mobile .visible-rating {
    grid-column: 2;
  }
}

@media (max-width: 640px) {
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
