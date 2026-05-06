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
          ref="mapSidebarRef"
          class="map-sidebar"
          :class="{
            'map-sidebar--mobile': isMobileMapLayout,
            'is-dragging': isDraggingMobileSheet,
            'is-scroll-softened': isMapSidebarScrolled,
          }"
          :style="mobileSheetStyle"
          :data-sheet-state="isMobileMapLayout ? mobileSheetState : 'desktop'"
          :aria-label="isMobileMapLayout ? 'Map workspace bottom sheet' : 'Map workspace sidebar'"
          data-test="map-mobile-sheet"
          @scroll.passive="syncMapSidebarScrollState"
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
            <article class="glass-panel sidebar-panel filter-panel" style="--scope-stagger-index: 0;" data-onboarding-target="map-filters">
              <div class="panel-heading">
                <div>
                  <p class="eyebrow">Explore categories</p>
                  <h1>Curate the map by mood</h1>
                </div>
                <button type="button" class="sidebar-reset-button" aria-label="Reset categories" @click="handleResetCategories">
                  <ScopeIcon name="reset" label="Reset categories" />
                  <span>Reset</span>
                </button>
              </div>

              <p class="panel-copy">
                Toggle the lanes you want Scope to spotlight, then jump straight into the best route mix on the map.
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
                  @click="handleCategoryToggle(category)"
                >
                  <ScopeIcon :name="categoryIconName(category)" :label="formatCategory(category)" />
                  <span>{{ formatCategory(category) }}</span>
                </button>
              </div>
            </article>

            <article class="glass-panel sidebar-panel route-card" :class="{ 'route-card--empty': !activeTrip }" style="--scope-stagger-index: 1;">
              <div class="panel-heading route-heading">
                <div class="route-heading-copy">
                  <p class="eyebrow">Featured route</p>
                  <h2>{{ routeTitle }}</h2>
                </div>
                <span class="route-destination-pill">{{ routeDestinationDisplay }}</span>
              </div>

              <p class="panel-copy route-copy">{{ routeDescription }}</p>

              <div v-if="routeStopsPreview.length" class="route-preview">
                <div class="route-preview-media" aria-label="Featured route stop order">
                  <svg class="route-preview-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <path class="route-preview-path-shadow" :d="routePreviewPath" />
                    <path class="route-preview-path-glow" :d="routePreviewPath" />
                    <path class="route-preview-path-line" :d="routePreviewPath" />
                  </svg>

                  <div class="route-preview-stops">
                    <article
                      v-for="(stop, index) in routeStopsPreview"
                      :key="stop.id"
                      class="route-preview-stop"
                      :class="index % 2 === 0 ? 'route-preview-stop--left' : 'route-preview-stop--right'"
                    >
                      <span class="route-preview-index">{{ index + 1 }}</span>
                      <div class="route-preview-copy">
                        <strong>{{ stop.title }}</strong>
                        <div class="route-preview-meta">
                          <span class="route-preview-meta-pill">Day {{ stop.dayNumber ?? index + 1 }}</span>
                          <span v-if="stop.timeSlot" class="route-preview-meta-pill route-preview-meta-pill--time">
                            {{ stop.timeSlot }}
                          </span>
                        </div>
                      </div>
                    </article>
                  </div>
                </div>

                <div class="route-footer">
                  <div class="route-metrics">
                    <span>
                      <ScopeIcon name="route" label="Trip stops" />
                      {{ routeStopMetric }}
                    </span>
                    <span v-if="routeDriveMetric">
                      <ScopeIcon name="clock" label="Estimated drive time" />
                      {{ routeDriveMetric }}
                    </span>
                    <span v-if="routeDistanceMetric">
                      <ScopeIcon name="navigation" label="Estimated drive distance" />
                      {{ routeDistanceMetric }}
                    </span>
                    <span>
                      <ScopeIcon name="friends" label="Travelers" />
                      {{ routeTravelerMetric }}
                    </span>
                    <span>
                      <ScopeIcon name="map" label="Destination" />
                      {{ routeDestinationDisplay }}
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

              <p v-else-if="workspaceLoading" class="sidebar-state">Syncing route preview and crew context…</p>
              <EmptyStatePanel
                v-else
                class="route-empty-state"
                compact
                tone="surface"
                alignment="center"
                eyebrow="Featured route"
                title="Planner previews land here"
                description="Pick a trip from the planner to preview its stop sequence, crew context, and live route overlay here."
                icon="route"
                artwork="map"
                heading-level="h3"
              >
                <RouterLink class="button button-secondary" to="/trips/new" data-test="map-empty-route-cta">
                  Open planner
                </RouterLink>
              </EmptyStatePanel>
            </article>

            <article
              v-if="selectedSpot || workspaceLoading || visibleSpots.length"
              :key="selectedSpot?.id ?? 'selected-spot-placeholder'"
              class="glass-panel sidebar-panel selected-card"
              :class="{ 'selected-card--placeholder': !selectedSpot }"
              style="--scope-stagger-index: 2;"
              data-test="map-selected-spot-card"
            >
              <template v-if="selectedSpot">
                <div class="selected-card-topline">
                  <span class="selected-label">Featured spot</span>
                  <span class="selected-rating" :aria-label="`Rated ${selectedSpot.rating.toFixed(1)} out of 5`">
                    <StarRatingDisplay
                      :rating="selectedSpot.rating"
                      :label="`Rated ${selectedSpot.rating.toFixed(1)} out of 5`"
                      :id-prefix="`map-selected-${selectedSpot.id}`"
                      variant="compact"
                    />
                    <span>{{ selectedSpot.rating.toFixed(1) }}</span>
                  </span>
                </div>

                <div class="selected-media">
                  <LazyImage :src="selectedSpotPhoto" :alt="selectedSpot.title" class="selected-image" eager />
                </div>

                <div class="selected-copy">
                  <span class="badge" :class="`badge-${selectedSpot.category}`">{{ formatCategory(selectedSpot.category) }}</span>
                  <h2>{{ selectedSpot.title }}</h2>
                  <p>{{ selectedSpot.description }}</p>
                  <div class="selected-meta">
                    <span>{{ selectedSpotLocation }}</span>
                    <span v-if="selectedSpotCountryBadge" class="selected-country-badge">{{ selectedSpotCountryBadge }}</span>
                    <span v-if="selectedSpot.vibe">{{ formatVibeLabel(selectedSpot.vibe) }}</span>
                  </div>
                  <RouterLink class="detail-link" :to="`/spots/${selectedSpot.id}`" data-test="map-selected-spot-detail-link">
                    <span>Open detail</span>
                    <ScopeIcon name="navigation" label="Open selected spot detail" />
                  </RouterLink>
                </div>
              </template>
              <template v-else>
                <div class="selected-media selected-media--placeholder" aria-hidden="true">
                  <div class="selected-image-skeleton skeleton-block" />
                </div>
                <div class="selected-copy selected-copy--placeholder" aria-hidden="true">
                  <span class="selected-badge-skeleton skeleton-block" />
                  <span class="selected-heading-skeleton skeleton-block" />
                  <span class="selected-body-skeleton skeleton-block" />
                  <span class="selected-body-skeleton skeleton-block selected-body-skeleton--short" />
                  <span class="selected-link-skeleton skeleton-block" />
                </div>
              </template>
            </article>

            <article class="glass-panel sidebar-panel visible-card" style="--scope-stagger-index: 3;">
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
                  </div>
                  <span class="visible-rating" :aria-label="`Rated ${spot.rating.toFixed(1)} out of 5`">
                    <StarRatingDisplay
                      :rating="spot.rating"
                      :label="`Rated ${spot.rating.toFixed(1)} out of 5`"
                      :id-prefix="`map-visible-${spot.id}`"
                      variant="compact"
                    />
                    <span>{{ spot.rating.toFixed(1) }}</span>
                  </span>
                  <div class="visible-location">
                    <span class="visible-location-badge">{{ formatSpotCityRegion(spot) }}</span>
                    <span v-if="formatSpotCountryBadge(spot.country)" class="visible-country-badge">
                      {{ formatSpotCountryBadge(spot.country) }}
                    </span>
                  </div>
                </button>
              </div>
              <EmptyStatePanel
                v-else
                class="sidebar-empty-state"
                compact
                tone="surface"
                alignment="center"
                eyebrow="Your adventure map"
                title="No pins match this category mix"
                description="Reset the category blend to bring every saved Scope pin back onto the map and into this quick-access rail."
                icon="map"
                artwork="map"
                heading-level="h3"
              >
                <button
                  type="button"
                  class="button button-secondary"
                  data-test="map-empty-reset-categories"
                  @click="handleResetCategories"
                >
                  Show all categories
                </button>
              </EmptyStatePanel>
            </article>
          </div>
        </aside>

        <article class="map-stage glass-panel" :class="{ 'map-stage--mobile': isMobileMapLayout }" data-onboarding-target="map-stage">
          <MapView
            class="map-stage-view"
            :class="{ 'map-view--mobile': isMobileMapLayout }"
            :style="mapViewStyle"
            :spots="mapSpots"
            :route-points="routePoints"
            :route-geometry="routeGeometry"
            :auto-resolve-route-geometry="false"
            :selected-spot-id="mapStore.selectedSpotId"
            @spot-select="handleSpotSelect"
            @interaction="handleMapInteraction"
          />
        </article>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import EmptyStatePanel from '@/components/common/EmptyStatePanel.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import StarRatingDisplay from '@/components/common/StarRatingDisplay.vue';
import { analyticsPageEngagementTracker } from '@/services/analyticsService';
import { resolveRoadRoute, type RoadRouteSummary } from '@/services/roadRouteService';
import { useMapStore } from '@/stores/map';
import { useOnboardingStore } from '@/stores/onboarding';
import { useSpotsStore } from '@/stores/spots';
import { useTripsStore } from '@/stores/trips';
import type { MapPoint, SpotCategory, TripSpot } from '@/types';
import { CATEGORY_TRAVEL_PHOTOS } from '@/utils/demoMedia';
import { formatVibeLabel } from '@/utils/formatters';
import { isScopeQaMode } from '@/utils/qaMode';
import { scheduleNonCriticalTask, type CancelScheduledTask } from '@/utils/scheduleNonCriticalTask';
import {
  MAP_AUDIT_ROUTE,
  MAP_AUDIT_SPOTS,
  type MapRoutePreviewTrip,
  type MapWorkspaceSpot,
} from '@/config/mapAuditFixture';

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
const MAX_ROUTE_PREVIEW_STOPS = 5;
const METERS_PER_MILE = 1609.344;
const categories: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'scenic', 'other'];
const isMapAuditMode = isScopeQaMode();
const CITY_REGION_FALLBACKS = new Map<string, string>([
  ['arlington', 'TX'],
  ['austin', 'TX'],
  ['dallas', 'TX'],
  ['fort worth', 'TX'],
  ['houston', 'TX'],
]);
const MapView = defineAsyncComponent(() => import('@/components/map/MapView.vue'));

const mapStore = useMapStore();
const onboardingStore = useOnboardingStore();
const spotsStore = useSpotsStore();
const tripsStore = useTripsStore();
const isMobileMapLayout = ref(false);
const mapSidebarRef = ref<HTMLElement | null>(null);
const isMapSidebarScrolled = ref(false);
const roadRoute = ref<RoadRouteSummary | null>(null);
const roadRouteLoading = ref(false);
const mobileSheetState = ref<MobileSheetState>('peek');
const isDraggingMobileSheet = ref(false);
const mobileSheetDragStartY = ref(0);
const mobileSheetDragOffset = ref(0);
const ignoreNextMobileSheetClick = ref(false);
let cancelInitialWorkspaceLoad: CancelScheduledTask = () => undefined;
let roadRouteRequestId = 0;

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

function formatRouteDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 'ETA pending';
  }

  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

function formatRouteDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) {
    return 'distance pending';
  }

  const miles = meters / METERS_PER_MILE;
  if (miles >= 10) {
    return `${Math.round(miles)} mi`;
  }

  return `${miles.toFixed(1).replace(/\.0$/, '')} mi`;
}

function buildRoutePreviewLayout(stopCount: number): { path: string } {
  const count = clampNumber(stopCount, 2, MAX_ROUTE_PREVIEW_STOPS);
  const leftX = 24;
  const rightX = 76;
  const rowCount = Math.ceil(count / 2);
  const topY = 20;
  const bottomY = 80;
  const yPositions = rowCount === 1
    ? [50]
    : Array.from({ length: rowCount }, (_, index) => {
        const y = topY + (((bottomY - topY) / (rowCount - 1)) * index);
        return Number(y.toFixed(2));
      });
  const points = Array.from({ length: count }, (_, index) => {
    const y = yPositions[Math.floor(index / 2)] ?? 50;
    return `${index % 2 === 0 ? leftX : rightX} ${y}`;
  });
  const path = `M ${points.join(' L ')}`;

  return { path };
}

function normalizeRegion(value: string | undefined): string {
  const region = value?.trim() ?? '';
  if (!region) {
    return '';
  }

  return region.length <= 3 ? region.toUpperCase() : region;
}

function resolveSpotRegion(spot: MapWorkspaceSpot): string {
  const regionAwareSpot = spot as MapWorkspaceSpot & {
    adminArea?: string;
    province?: string;
    region?: string;
    state?: string;
    stateCode?: string;
  };
  const explicitRegion = normalizeRegion(
    regionAwareSpot.stateCode ||
      regionAwareSpot.state ||
      regionAwareSpot.region ||
      regionAwareSpot.province ||
      regionAwareSpot.adminArea,
  );

  if (explicitRegion) {
    return explicitRegion;
  }

  return CITY_REGION_FALLBACKS.get((spot.city ?? '').trim().toLowerCase()) ?? '';
}

function formatSpotCityRegion(spot: MapWorkspaceSpot): string {
  const city = spot.city?.trim() ?? '';
  const region = resolveSpotRegion(spot);
  const locationParts = [city, region].filter(Boolean);

  return locationParts.length ? locationParts.join(', ') : 'Scope location';
}

function formatSpotCountryBadge(country: string | undefined): string {
  const normalizedCountry = country?.trim();
  if (!normalizedCountry) {
    return '';
  }

  if (/^(us|usa|united states|united states of america)$/i.test(normalizedCountry)) {
    return 'USA';
  }

  return normalizedCountry.length <= 3 ? normalizedCountry.toUpperCase() : normalizedCountry;
}

function resolveIsMobileMapLayout(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.innerWidth <= MOBILE_MAP_BREAKPOINT;
}

function syncMobileMapLayout() {
  isMobileMapLayout.value = resolveIsMobileMapLayout();
  syncMapSidebarScrollState();
}

function syncMapSidebarScrollState() {
  isMapSidebarScrolled.value = !isMobileMapLayout.value && (mapSidebarRef.value?.scrollTop ?? 0) > 8;
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

const workspaceSpots = computed<MapWorkspaceSpot[]>(() => (
  isMapAuditMode
    ? MAP_AUDIT_SPOTS
    : spotsStore.items.map((spot) => ({
      id: spot.id,
      title: spot.title,
      description: spot.description,
      latitude: spot.latitude,
      longitude: spot.longitude,
      category: spot.category,
      city: spot.city,
      country: spot.country,
      vibe: spot.vibe,
      rating: spot.rating,
      photoUrl: getSpotPhotoUrl(spot.category, spot.photoUrl),
    }))
));
const mapSpots = computed<MapPoint[]>(() => workspaceSpots.value.map((spot) => ({
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

const activeTrip = computed<MapRoutePreviewTrip | null>(() => (isMapAuditMode ? MAP_AUDIT_ROUTE : tripsStore.items[0] ?? null));
const workspaceLoading = computed(() => (isMapAuditMode ? false : spotsStore.loading || tripsStore.loading));
const workspaceError = computed(() => (isMapAuditMode ? '' : spotsStore.error || tripsStore.error || ''));
const routeSourceStops = computed<TripSpot[]>(() => activeTrip.value?.spots ?? []);
const routeSourcePoints = computed<MapPoint[]>(() => routeSourceStops.value.map((spot) => ({
  id: spot.spotId,
  title: spot.title,
  latitude: spot.latitude,
  longitude: spot.longitude,
  category: spot.category,
})));
const routePoints = computed<MapPoint[]>(() => {
  const optimizedPoints = roadRoute.value?.orderedPoints ?? [];
  return optimizedPoints.length ? optimizedPoints : routeSourcePoints.value;
});
const routeGeometry = computed(() => roadRoute.value?.geometry ?? []);
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
    return 'Scope is syncing trip context into the map workspace.';
  }

  return 'Pick a trip from the planner to preview its stop sequence and crew context on the map.';
});
const routeDestinationLabel = computed(() => activeTrip.value?.destination ?? 'Trip planner');

const routeDestinationDisplay = computed(() => routeDestinationLabel.value.replace(/\s*\u00c2?\u00b7\s*/g, ', '));

const routeStopMetric = computed(() => {
  const n = routePoints.value.length;
  return `${n} trip ${n === 1 ? 'stop' : 'stops'}`;
});

const routeDriveMetric = computed(() => {
  if (routePoints.value.length < 2) {
    return '';
  }

  if (roadRouteLoading.value && !roadRoute.value) {
    return 'Routing roads';
  }

  if (!roadRoute.value) {
    return '';
  }

  return formatRouteDuration(roadRoute.value.durationSeconds);
});

const routeDistanceMetric = computed(() => {
  if (routePoints.value.length < 2 || roadRouteLoading.value || !roadRoute.value) {
    return '';
  }

  return formatRouteDistance(roadRoute.value.distanceMeters);
});

const routeTravelerMetric = computed(() => {
  const n = activeTrip.value?.members.length ?? 0;
  return `${n} ${n === 1 ? 'Traveler' : 'Travelers'}`;
});
const activeRouteStops = computed<TripSpot[]>(() => {
  const stops = routeSourceStops.value;
  if (!stops.length) {
    return [];
  }

  const routeOrder = new Map(routePoints.value.map((point, index) => [point.id, index]));
  const sourceOrder = new Map(stops.map((stop, index) => [stop.spotId, index]));
  return [...stops].sort((left, right) => {
    const leftOrder = routeOrder.get(left.spotId) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = routeOrder.get(right.spotId) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return (sourceOrder.get(left.spotId) ?? 0) - (sourceOrder.get(right.spotId) ?? 0);
  });
});
const routeStopsPreview = computed<RoutePreviewStop[]>(() => {
  if (!activeTrip.value) {
    return [];
  }

  return activeRouteStops.value.slice(0, MAX_ROUTE_PREVIEW_STOPS).map((stop) => {
    const matchingSpot = workspaceSpots.value.find((spot) => spot.id === stop.spotId);

    return {
      id: stop.spotId,
      title: stop.title,
      category: stop.category,
      city: stop.city ?? matchingSpot?.city ?? activeTrip.value?.destination ?? 'Scope route',
      dayNumber: stop.dayNumber,
      timeSlot: stop.timeSlot,
      photoUrl: getSpotPhotoUrl(stop.category, stop.photoUrl ?? matchingSpot?.photoUrl),
    };
  });
});
const routePreviewLayout = computed(() => (
  routeStopsPreview.value.length > 1
    ? buildRoutePreviewLayout(routeStopsPreview.value.length)
    : { path: '' }
));
const routePreviewPath = computed(() => routePreviewLayout.value.path);
const routeHeroPhoto = computed(() => activeTrip.value?.coverImageUrl ?? routeStopsPreview.value[0]?.photoUrl ?? getFallbackPhoto('adventure'));
const routeMemberPreview = computed(() => (activeTrip.value?.members ?? []).slice(0, 3).map((member) => ({
  id: member.id,
  initials: getMemberInitials(member.displayName),
})));

const visibleSpots = computed(() => {
  const visibleIds = new Set(mapStore.visibleSpotIds);
  const scopedSpots = mapStore.visibleSpotIdsMeasured
    ? workspaceSpots.value.filter((spot) => visibleIds.has(spot.id))
    : workspaceSpots.value.filter((spot) => mapStore.activeCategories.includes(spot.category));

  return scopedSpots;
});

const visibleTitle = computed(() => {
  const count = visibleSpots.value.length;
  return `${count} spot${count === 1 ? '' : 's'} ready to explore`;
});
const activeFilterCountLabel = computed(() => `${mapStore.activeCategories.length}/${categories.length} live`);

const selectedSpot = computed(() => {
  const selectedId = mapStore.selectedSpotId;
  const explicitSelection = selectedId ? workspaceSpots.value.find((spot) => spot.id === selectedId) ?? null : null;

  if (!mapStore.visibleSpotIdsMeasured) {
    return explicitSelection ?? visibleSpots.value[0] ?? null;
  }

  if (!mapStore.visibleSpotIds.length) {
    return null;
  }

  return visibleSpots.value.find((spot) => spot.id === selectedId) ?? visibleSpots.value[0] ?? null;
});
const selectedSpotPhoto = computed(() => {
  if (!selectedSpot.value) {
    return routeHeroPhoto.value;
  }

  return getSpotPhotoUrl(selectedSpot.value.category, selectedSpot.value.photoUrl);
});
const selectedSpotLocation = computed(() => {
  if (!selectedSpot.value) {
    return 'Scope';
  }

  return formatSpotCityRegion(selectedSpot.value);
});
const selectedSpotCountryBadge = computed(() => formatSpotCountryBadge(selectedSpot.value?.country));
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
      return '9.5rem';
    case 'mid':
      return 'clamp(24rem, 58dvh, 34rem)';
    default:
      return '100%';
  }
});
const mobileSheetHeadline = computed(() => selectedSpot.value?.title ?? routeTitle.value);
const mobileSheetDescription = computed(() => {
  if (selectedSpot.value) {
    return `${selectedSpotLocation.value} · Swipe up for details.`;
  }

  return `${visibleTitle.value} · Swipe up for filters.`;
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
    '--scope-mobile-sheet-visible': mobileSheetVisibleHeight.value,
    '--scope-mobile-sheet-drag-offset': `${mobileSheetDragOffset.value}px`,
  };
});
const isMapOnboardingStepActive = computed(() => (
  onboardingStore.isActive
  && onboardingStore.activeStep?.routeName === 'map'
));
const mapViewStyle = computed(() => {
  if (!isMobileMapLayout.value) {
    return undefined;
  }

  return {
    '--scope-map-controls-top': 'calc(var(--space-3) + 4.75rem)',
    '--scope-map-controls-right': 'var(--space-3)',
    '--scope-map-controls-bottom': 'auto',
    '--scope-map-controls-left': 'auto',
    '--scope-map-controls-panel-top': 'var(--space-3)',
    '--scope-map-controls-panel-right': 'var(--space-3)',
    '--scope-map-controls-panel-bottom': 'auto',
    '--scope-map-controls-panel-left': 'auto',
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

function recordMapInteraction(type: string): void {
  analyticsPageEngagementTracker.recordMapInteraction(type);
}

function handleMapInteraction(payload: { type: string }) {
  recordMapInteraction(payload.type);
}

function handleCategoryToggle(category: SpotCategory) {
  mapStore.toggleCategory(category);
  handleMapInteraction({ type: 'category_toggle' });
}

function handleResetCategories() {
  mapStore.resetCategories();
  handleMapInteraction({ type: 'category_reset' });
}

function handleSpotSelect(spot: MapPoint) {
  mapStore.setSelectedSpotId(spot.id);
  handleMapInteraction({ type: 'spot_select' });
  revealMobileSheet();
}

function focusSpot(spotId: string) {
  const spot = workspaceSpots.value.find((entry) => entry.id === spotId);
  if (!spot) {
    return;
  }

  mapStore.setSelectedSpotId(spot.id);
  mapStore.setCenter([spot.longitude, spot.latitude]);
  mapStore.setZoom(12);
  handleMapInteraction({ type: 'visible_spot_focus' });
  revealMobileSheet();
}

function buildRoutePointRequestKey(point: MapPoint): string {
  return `${point.id}:${point.longitude.toFixed(5)},${point.latitude.toFixed(5)}`;
}

async function syncRoadRoute() {
  const requestId = ++roadRouteRequestId;
  const points = routeSourcePoints.value;
  if (points.length < 2) {
    roadRoute.value = null;
    roadRouteLoading.value = false;
    return;
  }

  roadRouteLoading.value = true;
  try {
    const nextRoute = await resolveRoadRoute(points);
    if (requestId !== roadRouteRequestId) {
      return;
    }

    roadRoute.value = nextRoute;
  } catch (error) {
    if (requestId !== roadRouteRequestId) {
      return;
    }

    console.warn('[scope-map] Road route resolution failed; keeping stop order stable.', error);
    roadRoute.value = null;
  } finally {
    if (requestId === roadRouteRequestId) {
      roadRouteLoading.value = false;
    }
  }
}

function handleSidebarKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isMobileMapLayout.value && mobileSheetState.value !== 'peek') {
    setMobileSheetState('peek');
  }
}

watch(
  () => routeSourcePoints.value.map(buildRoutePointRequestKey).join('|'),
  () => {
    void syncRoadRoute();
  },
  { immediate: true },
);

watch(
  [isMobileMapLayout, isMapOnboardingStepActive],
  ([isMobile, isMapOnboardingStep]) => {
    if (!isMobile) {
      cancelMobileSheetDrag();
      ignoreNextMobileSheetClick.value = false;
      mobileSheetState.value = 'peek';
      return;
    }

    ignoreNextMobileSheetClick.value = false;
    mobileSheetState.value = isMapOnboardingStep ? 'full' : 'peek';
  },
  { immediate: true },
);

onMounted(() => {
  syncMobileMapLayout();
  window.addEventListener('resize', syncMobileMapLayout);

  if (isMapAuditMode) {
    if (!mapStore.selectedSpotId && MAP_AUDIT_SPOTS[0]) {
      mapStore.setSelectedSpotId(MAP_AUDIT_SPOTS[0].id);
    }

    return;
  }

  cancelInitialWorkspaceLoad = scheduleNonCriticalTask(async () => {
    await Promise.allSettled([spotsStore.fetchSpots(), tripsStore.fetchTrips()]);

    if (!mapStore.selectedSpotId && spotsStore.items[0]) {
      mapStore.setSelectedSpotId(spotsStore.items[0].id);
    }
  }, { delayMs: 140, timeoutMs: 1_000 });
});

onBeforeUnmount(() => {
  roadRouteRequestId += 1;
  cancelInitialWorkspaceLoad();
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
  grid-template-columns: minmax(22rem, 24rem) minmax(0, 1fr);
  gap: var(--space-5);
  height: clamp(36rem, calc(100dvh - var(--shell-content-top) - var(--space-10)), 46rem);
  min-height: 36rem;
  max-height: 46rem;
  align-items: stretch;
}

.map-sidebar {
  min-height: 0;
  height: 100%;
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding-right: var(--space-1);
  -webkit-mask-image: linear-gradient(rgb(0 0 0), rgb(0 0 0));
  mask-image: linear-gradient(rgb(0 0 0), rgb(0 0 0));
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
}

.map-sidebar:not(.map-sidebar--mobile).is-scroll-softened {
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0,
    rgb(0 0 0 / 0.18) 0.45rem,
    rgb(0 0 0) 2.15rem,
    rgb(0 0 0) 100%
  );
  mask-image: linear-gradient(
    to bottom,
    transparent 0,
    rgb(0 0 0 / 0.18) 0.45rem,
    rgb(0 0 0) 2.15rem,
    rgb(0 0 0) 100%
  );
}

.map-sidebar::-webkit-scrollbar {
  width: 8px;
}

.map-sidebar::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--text-tertiary) 24%, transparent);
  border-radius: 999px;
}

.map-sidebar::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--text-tertiary) 42%, transparent);
}

.map-sidebar-scroll,
.sidebar-panel,
.selected-copy,
.route-preview {
  display: grid;
  gap: var(--space-5);
}

.route-empty-state,
.sidebar-empty-state {
  width: 100%;
  justify-self: stretch;
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
  padding: clamp(var(--space-6), 2.4vw, var(--space-8));
  box-shadow: var(--shadow-lg);
}

.filter-panel[data-onboarding-active='true'] {
  border-color: color-mix(in srgb, var(--accent-teal) 42%, var(--glass-border));
  box-shadow:
    var(--shadow-lg),
    0 0 0 1px color-mix(in srgb, var(--accent-teal) 22%, transparent),
    0 0 2.4rem color-mix(in srgb, var(--accent-teal) 18%, transparent);
}

.filter-panel[data-onboarding-active='true']::after {
  content: '';
  position: absolute;
  inset: 0.75rem;
  border-radius: calc(var(--radius-xl) - 0.3rem);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, transparent);
  pointer-events: none;
}

.panel-heading,
.visible-heading,
.route-footer,
.mobile-sheet-summary-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  /* Let the trailing pill/button drop below the title instead of
     colliding with it when the sidebar is narrow. */
  flex-wrap: wrap;
  padding-top: 0.1rem;
}

.panel-heading > :first-child {
  flex: 1 1 10rem;
  min-width: 0;
}

/* Breathing room between eyebrow and title (featured route, visible list, filters). */
.panel-heading > div:first-child,
.visible-heading > div:first-child,
.route-heading > div:first-child {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}

.route-heading > div:first-child {
  gap: var(--space-3);
}

.route-heading {
  align-items: flex-start;
  flex-wrap: nowrap;
  gap: var(--space-3);
}

.route-heading-copy {
  flex: 1 1 auto;
  min-width: 0;
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
  /* Baseline follows the shared h1 design token so MapPage stays aligned
     with the rest of the Scope type system. */
  font-size: var(--font-size-h1);
  /* ...then clamp downward when the sidebar is tight so "Curate the map
     by mood" doesn't wrap to three lines. The clamp caps at the same
     token, so the heading never exceeds the global h1 size. */
  font-size: clamp(1.25rem, 1.6vw + 0.4rem, var(--font-size-h1));
  line-height: 1.22;
  letter-spacing: var(--letter-spacing-display);
  text-wrap: balance;
}

.panel-heading h2,
.selected-copy h2,
.mobile-sheet-summary h2 {
  font-size: var(--font-size-h2);
  line-height: var(--line-height-tight);
}

.visible-heading h2 {
  line-height: 1.28;
  letter-spacing: -0.02em;
}

.route-heading h2 {
  font-size: clamp(1.28rem, 1vw + 0.78rem, 1.72rem);
  line-height: 1.2;
  letter-spacing: 0;
  text-wrap: balance;
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

.route-card .route-copy {
  font-size: 0.95rem;
  line-height: 1.5;
  letter-spacing: 0.01em;
}

.filter-chip-row,
.selected-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.route-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  align-items: stretch;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 0.6rem 0.85rem;
  border-radius: var(--radius-full);
  border: 1px solid transparent;
  color: inherit;
  font-size: 0.9rem;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: none;
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
  box-shadow: inset 0 0 0 1px currentColor;
}

.filter-chip.is-inactive {
  background: color-mix(in srgb, var(--bg-elevated) 82%, transparent);
  border-color: var(--border);
  color: var(--text-secondary);
  box-shadow: none;
}

.filter-chip:hover,
.filter-chip:focus-visible,
.sidebar-reset-button:hover,
.sidebar-reset-button:focus-visible,
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
.sidebar-reset-button:active,
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

.filter-chip :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
}

.sidebar-reset-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  flex-shrink: 0;
  margin-left: auto;
  margin-right: -0.35rem;
  min-height: 2.5rem;
  padding: 0.55rem 0.85rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 26%, var(--glass-border));
  background: color-mix(in srgb, var(--glass-bg) 88%, var(--bg-secondary) 12%);
  color: color-mix(in srgb, var(--accent-teal) 84%, var(--text-primary) 16%);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  cursor: pointer;
  box-shadow:
    var(--shadow-sm),
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 7%, transparent);
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.sidebar-reset-button:hover,
.sidebar-reset-button:focus-visible {
  border-color: color-mix(in srgb, var(--accent-teal) 38%, var(--border-hover));
  background: color-mix(in srgb, var(--accent-teal-light) 34%, var(--glass-bg));
  color: var(--accent-teal);
}

.sidebar-reset-button :deep(.scope-icon) {
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
  min-width: 0;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-secondary) 96%, var(--bg-primary) 4%),
      color-mix(in srgb, var(--bg-tertiary) 92%, var(--bg-primary) 8%)
    );
}

.route-heading .eyebrow {
  color: color-mix(in srgb, var(--text-secondary) 22%, var(--accent-teal) 78%);
  letter-spacing: 0.1em;
}

.route-heading h2 {
  color: color-mix(in srgb, var(--text-primary) 93%, var(--highlight-sheen) 7%);
  font-weight: var(--font-weight-semibold);
}

.route-heading > .route-destination-pill {
  align-self: flex-start;
  padding: 0.42rem 0.72rem;
  font-size: 0.78rem;
}

.route-preview {
  min-width: 0;
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
  padding: 0.5rem 0.9rem;
  border: 1px solid color-mix(in srgb, var(--highlight-sheen) 8%, var(--glass-border) 92%);
  background: color-mix(in srgb, var(--glass-bg) 88%, var(--bg-secondary) 12%);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  flex-shrink: 0;
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 6%, transparent);
}

.route-preview-media {
  position: relative;
  width: 100%;
  min-height: 14.25rem;
  border-radius: var(--radius-2xl);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--highlight-sheen) 5%, var(--border) 95%);
  background:
    radial-gradient(circle at 24% 18%, color-mix(in srgb, var(--accent-teal) 10%, transparent), transparent 36%),
    linear-gradient(145deg, color-mix(in srgb, var(--bg-secondary) 96%, var(--bg-primary) 4%), color-mix(in srgb, var(--bg-primary) 88%, var(--bg-secondary) 12%));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 7%, transparent),
    inset 0 -1px 0 color-mix(in srgb, var(--bg-primary) 38%, transparent);
}

.selected-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-normal);
}

.route-preview-path {
  position: absolute;
  inset: 1.65rem 2.2rem;
  width: calc(100% - 4.4rem);
  height: calc(100% - 3.3rem);
  pointer-events: none;
}

.route-preview-path-shadow,
.route-preview-path-glow,
.route-preview-path-line {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.route-preview-path-shadow {
  stroke: color-mix(in srgb, var(--bg-primary) 82%, transparent);
  stroke-width: 9;
  opacity: 0.82;
}

.route-preview-path-glow {
  stroke: color-mix(in srgb, var(--accent-teal) 32%, transparent);
  stroke-width: 6;
  opacity: 0.36;
  stroke-dasharray: 7 10;
}

.route-preview-path-line {
  stroke: color-mix(in srgb, var(--accent-teal) 82%, var(--text-primary) 18%);
  stroke-width: 3.25;
  opacity: 0.92;
  stroke-dasharray: 7 9;
}

.route-preview-stops {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: space-between;
  gap: 0.86rem 0.78rem;
  min-height: inherit;
  padding: 0.95rem;
  box-sizing: border-box;
}

.route-preview-stop {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  min-height: 3.38rem;
  padding: 0.54rem 0.68rem 0.54rem 0.54rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--highlight-sheen) 8%, var(--border) 92%);
  background: color-mix(in srgb, var(--bg-primary) 24%, var(--bg-secondary) 76%);
  box-shadow:
    0 0.55rem 1.4rem color-mix(in srgb, var(--bg-primary) 14%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 7%, transparent);
}

.route-preview-stop--left {
  grid-column: 1;
  justify-self: start;
}

.route-preview-stop--right {
  grid-column: 2;
  justify-self: end;
}

.route-preview-index {
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  width: 1.55rem;
  height: 1.55rem;
  border-radius: 50%;
  font-size: 0.68rem;
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
  color: color-mix(in srgb, var(--text-primary) 86%, var(--accent-teal) 14%);
  line-height: 1;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 36%, var(--border));
  background:
    radial-gradient(circle at 35% 28%, color-mix(in srgb, var(--accent-teal) 18%, transparent), transparent 58%),
    color-mix(in srgb, var(--bg-secondary) 86%, var(--bg-primary) 14%);
  box-shadow: 0 0 0 0.16rem color-mix(in srgb, var(--bg-primary) 28%, transparent);
}

.route-preview-copy strong,
.visible-copy strong,
.visible-copy p {
  display: block;
}

.route-preview-copy strong,
.visible-copy strong {
  color: var(--text-primary);
}

.route-preview-copy {
  min-width: 0;
}

.route-preview-copy strong {
  font-size: 0.86rem;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.route-preview-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.32rem;
  margin-top: 0.3rem;
}

.route-preview-meta-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.18rem;
  padding: 0.16rem 0.44rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--highlight-sheen) 6%, var(--border) 94%);
  background: color-mix(in srgb, var(--bg-secondary) 84%, var(--bg-primary) 16%);
  color: color-mix(in srgb, var(--text-secondary) 84%, var(--text-primary) 16%);
  font-size: 0.64rem;
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  white-space: nowrap;
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 5%, transparent);
}

.route-preview-meta-pill--time {
  border-color: color-mix(in srgb, var(--accent-gold) 18%, var(--border));
  background: color-mix(in srgb, var(--accent-gold) 7%, var(--bg-secondary) 93%);
  color: color-mix(in srgb, var(--accent-gold) 42%, var(--text-secondary) 58%);
}

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
  justify-content: flex-start;
  gap: 0.45rem;
  min-width: 0;
  width: 100%;
  padding: 0.48rem 0.58rem;
  font-size: 0.8rem;
  font-weight: var(--font-weight-medium);
  color: color-mix(in srgb, var(--text-primary) 92%, var(--highlight-sheen) 8%);
  border: 1px solid color-mix(in srgb, var(--highlight-sheen) 6%, var(--glass-border) 94%);
  background: color-mix(in srgb, var(--bg-primary) 22%, var(--bg-secondary) 78%);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 5%, transparent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.route-metrics :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
  color: color-mix(in srgb, var(--accent-gold) 48%, var(--accent-teal) 52%);
  opacity: 0.92;
}

.detail-link :deep(.scope-icon) {
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

.selected-card-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.selected-media {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.selected-label,
.selected-rating {
  padding: 0.48rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--highlight-sheen) 7%, var(--border) 93%);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-secondary) 90%, var(--bg-primary) 10%);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 7%, transparent),
    0 0.45rem 1rem color-mix(in srgb, var(--bg-primary) 18%, transparent);
}

.selected-label {
  border-color: color-mix(in srgb, var(--accent-teal) 18%, var(--border));
  background: color-mix(in srgb, var(--accent-teal) 8%, var(--bg-secondary) 92%);
}

.selected-rating {
  color: var(--accent-gold);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  gap: 0.35rem;
}

.selected-copy {
  align-content: start;
}

.selected-card--placeholder {
  min-height: 25rem;
}

.selected-media--placeholder {
  background: color-mix(in srgb, var(--bg-primary) 38%, transparent);
}

.selected-image-skeleton {
  width: 100%;
  height: 100%;
  border-radius: inherit;
}

.selected-copy--placeholder {
  gap: var(--space-3);
}

.selected-badge-skeleton {
  width: 6rem;
  height: 1.6rem;
  border-radius: var(--radius-full);
}

.selected-heading-skeleton {
  width: 72%;
  height: 1.4rem;
  border-radius: var(--radius-full);
}

.selected-body-skeleton {
  width: 100%;
  height: 1rem;
  border-radius: var(--radius-full);
}

.selected-body-skeleton--short {
  width: 68%;
}

.selected-link-skeleton {
  width: 8.5rem;
  height: 1rem;
  border-radius: var(--radius-full);
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
  grid-template-rows: auto auto;
  align-items: center;
  column-gap: var(--space-3);
  row-gap: 0.55rem;
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
  border-color: color-mix(in srgb, var(--highlight-sheen) 16%, var(--glass-border) 84%);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 9%, transparent);
  background: color-mix(in srgb, var(--highlight-sheen) 7%, var(--glass-bg));
}

.visible-item:hover,
.visible-item:focus-visible {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-md);
}

.visible-item:hover .visible-image,
.visible-item:focus-visible .visible-image,
.selected-card:hover .selected-image {
  transform: scale(var(--motion-image-zoom));
}

.visible-image {
  grid-row: 1 / span 2;
  width: 4.5rem;
  aspect-ratio: 1;
  border-radius: var(--radius-lg);
  object-fit: cover;
  overflow: hidden;
  transition: transform var(--transition-normal);
}

.visible-copy {
  grid-column: 2;
  grid-row: 1;
  min-width: 0;
}

.visible-location {
  grid-column: 2 / 4;
  grid-row: 2;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
  min-width: 0;
}

.visible-location-badge {
  min-width: 0;
  max-width: min(100%, 14rem);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: color-mix(in srgb, var(--text-secondary) 92%, var(--text-primary) 8%);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0;
}

.visible-location-badge,
.visible-country-badge,
.selected-country-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.55rem;
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  background: color-mix(in srgb, var(--bg-secondary) 88%, var(--bg-primary) 12%);
  line-height: 1;
}

.visible-country-badge,
.selected-country-badge {
  color: color-mix(in srgb, var(--text-primary) 82%, var(--accent-teal) 18%);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.08em;
}

.visible-rating {
  grid-column: 3;
  grid-row: 1;
  justify-self: end;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--accent-gold);
  font-weight: var(--font-weight-semibold);
}

.route-empty-state,
.sidebar-empty-state {
  align-self: stretch;
}

.sidebar-empty-state {
  min-block-size: 100%;
}

.map-stage {
  height: 100%;
  min-height: 0;
  padding: 0;
  overflow: hidden;
}

.map-stage[data-onboarding-active='true'] {
  border-color: color-mix(in srgb, var(--accent-teal) 44%, var(--glass-border));
  box-shadow:
    var(--shadow-lg),
    inset 0 0 0 1px color-mix(in srgb, var(--accent-teal) 24%, transparent);
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
  .sidebar-reset-button:hover,
  .sidebar-reset-button:focus-visible,
  .sidebar-reset-button:active,
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
  .selected-card:hover .selected-image {
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

@media (max-width: 1200px) {
  .map-workspace {
    grid-template-columns: 1fr;
    gap: var(--space-4);
    height: auto;
    min-height: 0;
    max-height: none;
  }

  .map-stage {
    order: 1;
    height: clamp(28rem, 58vh, 38rem);
    min-height: 28rem;
  }

  .map-sidebar {
    order: 2;
    height: auto;
    overflow: visible;
    padding-right: 0;
  }

  .map-sidebar-scroll {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: var(--space-4);
  }

  .map-sidebar-scroll > .sidebar-panel {
    padding: clamp(var(--space-5), 1.8vw, var(--space-6));
  }
}

@media (max-width: 880px) {
  .map-stage {
    height: clamp(25rem, 56vh, 34rem);
    min-height: 25rem;
  }

  .map-sidebar-scroll {
    grid-template-columns: 1fr;
  }

  .route-preview-media {
    min-height: 12.5rem;
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
    overflow: hidden;
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
    --scope-map-controls-top: calc(var(--space-3) + 4.75rem);
    --scope-map-controls-right: max(var(--space-3), var(--safe-area-right));
    --scope-map-controls-bottom: max(var(--space-3), var(--safe-area-bottom));
    --scope-map-controls-panel-right: max(var(--space-3), var(--safe-area-right));
    --scope-map-controls-panel-bottom: max(var(--space-3), var(--safe-area-bottom));
    --scope-map-controls-panel-left: max(var(--space-3), var(--safe-area-left));
  }

  .map-sidebar--mobile {
    position: absolute;
    inset:
      auto
      max(var(--space-2), var(--safe-area-right))
      0
      max(var(--space-2), var(--safe-area-left));
    /* Map marker DOM uses high z-index values, so the sheet must clear the map layer. */
    z-index: 600;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 0;
    height: calc(100% - var(--space-4));
    padding:
      0
      0
      calc(var(--space-3) + var(--safe-area-bottom))
      0;
    border: 1px solid color-mix(in srgb, var(--highlight-sheen) 8%, var(--border) 92%);
    border-bottom: 0;
    border-radius: calc(var(--radius-2xl) + 0.35rem) calc(var(--radius-2xl) + 0.35rem) 0 0;
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--bg-secondary) 98%, var(--bg-primary) 2%),
        color-mix(in srgb, var(--bg-primary) 96%, var(--bg-secondary) 4%)
      );
    box-shadow:
      0 -1.4rem 3rem color-mix(in srgb, var(--bg-primary) 42%, transparent),
      inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 6%, transparent);
    overflow: hidden;
    transform: translateY(calc(100% - var(--scope-mobile-sheet-visible) + var(--scope-mobile-sheet-drag-offset, 0px)));
    transition: transform var(--transition-normal);
    will-change: transform;
  }

  .map-sidebar--mobile.is-dragging {
    transition: none;
  }

  .mobile-sheet-toggle {
    display: grid;
    gap: var(--space-2);
    min-height: 9.5rem;
    padding: var(--space-3) var(--space-4) var(--space-4);
    border: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--highlight-sheen) 7%, var(--border) 93%);
    border-radius: calc(var(--radius-2xl) + 0.35rem) calc(var(--radius-2xl) + 0.35rem) 0 0;
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--bg-secondary) 98%, var(--bg-primary) 2%),
        color-mix(in srgb, var(--bg-primary) 94%, var(--bg-secondary) 6%)
      );
    box-shadow: none;
    cursor: grab;
    text-align: left;
    touch-action: none;
  }

  .mobile-sheet-grabber {
    width: 3.75rem;
    height: 0.32rem;
    margin: 0 auto;
    border-radius: var(--radius-full);
    background: color-mix(in srgb, var(--text-secondary) 72%, transparent);
  }

  .mobile-sheet-summary {
    display: grid;
    gap: 0.6rem;
    min-width: 0;
  }

  .mobile-sheet-summary h2 {
    font-size: clamp(1.05rem, 4vw, 1.28rem);
    letter-spacing: -0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-sheet-summary-row {
    align-items: center;
    flex-wrap: nowrap;
    gap: var(--space-3);
  }

  .mobile-sheet-count {
    padding: 0.45rem 0.75rem;
    white-space: nowrap;
  }

  .mobile-sheet-copy {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    font-size: 0.92rem;
    line-height: 1.45;
  }

  .map-sidebar-scroll--mobile {
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-4);
    padding-bottom: calc(var(--space-5) + var(--safe-area-bottom));
    overscroll-behavior: contain;
    scrollbar-width: none;
  }

  .map-sidebar-scroll--mobile::-webkit-scrollbar {
    display: none;
  }

  .map-sidebar--mobile[data-sheet-state='peek'] .map-sidebar-scroll--mobile {
    display: none;
  }

  .map-sidebar--mobile[data-sheet-state='mid'] .filter-panel,
  .map-sidebar--mobile[data-sheet-state='mid'] .route-card,
  .map-sidebar--mobile[data-sheet-state='mid'] .visible-card {
    display: none;
  }

  .map-sidebar--mobile[data-sheet-state='full'] .selected-card {
    display: none;
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
    border-color: color-mix(in srgb, var(--highlight-sheen) 7%, var(--border) 93%);
    background: color-mix(in srgb, var(--bg-secondary) 94%, var(--bg-primary) 6%);
    box-shadow: none;
    padding: var(--space-4);
  }

  .map-sidebar--mobile .selected-card {
    gap: var(--space-4);
  }

  .map-sidebar--mobile .filter-panel,
  .map-sidebar--mobile .route-card,
  .map-sidebar--mobile .visible-card {
    display: block;
  }

  .map-sidebar--mobile .filter-panel > * + *,
  .map-sidebar--mobile .route-card > * + *,
  .map-sidebar--mobile .visible-card > * + * {
    margin-top: var(--space-4);
  }

  .map-sidebar--mobile[data-sheet-state='full'] .filter-panel {
    min-height: 24rem;
  }

  .map-sidebar--mobile[data-sheet-state='full'] .route-card {
    min-height: 34rem;
  }

  .map-sidebar--mobile[data-sheet-state='full'] .visible-card {
    min-height: 28rem;
  }

  .map-sidebar--mobile .panel-heading h1 {
    font-size: clamp(1.25rem, 5vw, 1.55rem);
  }

  .map-sidebar--mobile .panel-heading,
  .map-sidebar--mobile .visible-heading,
  .map-sidebar--mobile .route-footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .map-sidebar--mobile .route-heading {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: nowrap;
    gap: var(--space-3);
  }

  .map-sidebar--mobile .route-heading h2 {
    font-size: clamp(1.26rem, 4.8vw, 1.52rem);
    line-height: 1.18;
  }

  .map-sidebar--mobile .route-heading > .route-destination-pill {
    align-self: flex-start;
    margin-left: auto;
    max-width: 45%;
    padding: 0.36rem 0.62rem;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 0.72rem;
  }

  .map-sidebar--mobile .route-copy {
    font-size: 0.94rem;
    line-height: 1.5;
  }

  .map-sidebar--mobile .route-card {
    padding-right: calc(var(--space-4) + 0.45rem);
  }

  .map-sidebar--mobile .route-preview-media {
    width: calc(100% - 0.45rem);
    min-height: 13.8rem;
    margin-right: 0.45rem;
    border-radius: var(--radius-xl);
  }

  .map-sidebar--mobile .route-preview-path {
    inset: 1.55rem 2.1rem 1.55rem 1.45rem;
    width: calc(100% - 3.55rem);
    height: calc(100% - 3.1rem);
  }

  .map-sidebar--mobile .route-preview-stops {
    grid-template-columns: repeat(2, minmax(0, min(12.35rem, calc((100% - 0.7rem) * 0.5))));
    justify-content: space-between;
    gap: 0.82rem 0.72rem;
    padding: 0.9rem calc(var(--space-4) + 0.8rem) 0.9rem 0.9rem;
  }

  .map-sidebar--mobile .route-preview-stop {
    width: 100%;
    min-height: 3.22rem;
    padding: 0.5rem 0.58rem 0.5rem 0.48rem;
  }

  .map-sidebar--mobile .route-preview-index {
    width: 1.5rem;
    height: 1.5rem;
    font-size: 0.66rem;
  }

  .map-sidebar--mobile .route-preview-copy strong {
    font-size: 0.85rem;
  }

  .map-sidebar--mobile .route-preview-meta {
    gap: 0.26rem;
    margin-top: 0.26rem;
  }

  .map-sidebar--mobile .route-preview-meta-pill {
    min-height: 1.12rem;
    padding: 0.14rem 0.38rem;
    font-size: 0.6rem;
  }

  .map-sidebar--mobile .route-metrics {
    width: calc(100% - 0.45rem);
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.55rem;
    margin-right: 0.45rem;
  }

  .map-sidebar--mobile .route-metrics span {
    justify-content: flex-start;
    gap: 0.38rem;
    padding: 0.46rem 0.54rem;
    font-size: 0.75rem;
  }

  .map-sidebar--mobile .route-metrics :deep(.scope-icon) {
    width: 0.9rem;
    height: 0.9rem;
  }

  .map-sidebar--mobile .route-members {
    margin-right: 0.45rem;
  }

  .map-sidebar--mobile .visible-item {
    grid-template-columns: 3.75rem minmax(0, 1fr);
    grid-template-rows: auto auto auto;
    align-items: start;
    gap: var(--space-3);
    padding: var(--space-3);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--bg-primary) 28%, var(--bg-secondary) 72%);
  }

  .map-sidebar--mobile .visible-image {
    grid-row: 1 / span 3;
    width: 3.75rem;
  }

  .map-sidebar--mobile .visible-copy {
    grid-column: 2;
    grid-row: 1;
  }

  .map-sidebar--mobile .visible-rating {
    grid-column: 2;
    grid-row: 2;
    justify-self: start;
  }

  .map-sidebar--mobile .visible-location {
    grid-column: 2;
    grid-row: 3;
  }

  .map-sidebar--mobile .selected-rating :deep(.star-rating) {
    display: none;
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

  .sidebar-reset-button {
    margin-left: 0;
    margin-right: 0;
  }

  .visible-item {
    grid-template-columns: 4.5rem minmax(0, 1fr);
    grid-template-rows: auto auto auto;
  }

  .visible-image {
    grid-row: 1 / span 3;
  }

  .visible-rating {
    grid-column: 2;
    grid-row: 2;
    justify-self: start;
  }

  .visible-location {
    grid-column: 2;
    grid-row: 3;
  }
}
</style>
