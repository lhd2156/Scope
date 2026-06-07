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

            <article
              class="glass-panel sidebar-panel route-card"
              :class="{
                'route-card--empty': !activeTrip,
                'route-card--map-preview-active': isFeaturedRouteMapVisible,
                'route-card--map-preview-pinned': isFeaturedRoutePreviewPinned,
              }"
              style="--scope-stagger-index: 1;"
              role="button"
              tabindex="0"
              :aria-pressed="String(isFeaturedRoutePreviewPinned)"
              :aria-disabled="String(!canPreviewFeaturedRouteOnMap)"
              :aria-label="isFeaturedRouteMapVisible ? 'Hide featured route on map' : 'Show featured route on map'"
              data-test="map-featured-route-card"
              @click="handleFeaturedRouteCardClick"
              @keydown.enter.prevent="handleFeaturedRouteCardClick"
              @keydown.space.prevent="handleFeaturedRouteCardClick"
            >
              <div class="panel-heading route-heading">
                <div class="route-heading-copy">
                  <p class="eyebrow">Featured route</p>
                  <h2>{{ routeTitle }}</h2>
                </div>
                <div class="route-heading-actions">
                  <span class="route-destination-pill">{{ routeDestinationDisplay }}</span>
                </div>
              </div>

              <p class="panel-copy route-copy">{{ routeDescription }}</p>

              <div v-if="routeStopsPreview.length" class="route-preview" data-test="map-featured-route-preview">
                <ol class="route-timeline" aria-label="Featured route stop order">
                  <li v-for="(stop, index) in routeStopsPreview" :key="stop.id" class="route-timeline-stop">
                    <span class="route-timeline-index">{{ index + 1 }}</span>
                    <div class="route-timeline-copy">
                      <strong>{{ stop.title }}</strong>
                      <div class="route-timeline-meta">
                        <span class="route-timeline-pill">
                          <ScopeIcon name="calendar" label="Day" />
                          Day {{ stop.dayNumber ?? index + 1 }}
                        </span>
                        <span v-if="stop.timeSlot" class="route-timeline-pill route-timeline-pill--time">
                          <ScopeIcon name="clock" label="Time" />
                          {{ stop.timeSlot }}
                        </span>
                      </div>
                    </div>
                  </li>
                </ol>

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

              <p v-else-if="workspaceLoading" class="sidebar-state">Syncing route preview and crew context...</p>
              <div v-else class="route-empty-state map-plain-empty-state" data-test="map-route-empty-state">
                <p class="eyebrow">Featured route</p>
                <h3>Route details coming together</h3>
                <p>Add stops in the planner and Scope will draw the sequence, drive context, and crew timing here.</p>
                <RouterLink class="button button-secondary" to="/trips/new" data-test="map-empty-route-cta">
                  Open planner
                </RouterLink>
              </div>
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
                  <RouterLink class="detail-link" :to="buildSpotPath(selectedSpot)" data-test="map-selected-spot-detail-link">
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

              <p v-if="workspaceLoading" class="sidebar-state">Loading map pins and route context...</p>
              <div v-else-if="visibleSpots.length" class="visible-list">
                <button
                  v-for="spot in visibleSpotPreviews"
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
                  <div
                    class="visible-location"
                    :class="{ 'has-country': formatSpotCountryBadge(spot.country) }"
                  >
                    <span class="visible-location-badge">{{ formatSpotCityRegion(spot) }}</span>
                    <span v-if="formatSpotCountryBadge(spot.country)" class="visible-country-badge">
                      {{ formatSpotCountryBadge(spot.country) }}
                    </span>
                  </div>
                </button>
              </div>
              <div v-else class="sidebar-empty-state map-plain-empty-state" data-test="map-sidebar-empty-state">
                <p class="eyebrow">Your adventure map</p>
                <h3>{{ visibleEmptyTitle }}</h3>
                <p>{{ visibleEmptyDescription }}</p>
                <button
                  type="button"
                  class="button button-secondary"
                  data-test="map-empty-reset-categories"
                  @click="handleResetCategories"
                >
                  Show all categories
                </button>
              </div>
            </article>
          </div>
        </aside>

        <article class="map-stage glass-panel" :class="{ 'map-stage--mobile': isMobileMapLayout }" data-onboarding-target="map-stage">
          <MapView
            class="map-stage-view"
            :class="{ 'map-view--mobile': isMobileMapLayout }"
            :style="mapViewStyle"
            :spots="mapSpots"
            :route-points="mapRoutePoints"
            :route-geometry="mapRouteGeometry"
            :auto-resolve-route-geometry="false"
            :selected-spot-id="mapStore.selectedSpotId"
            :initial-viewport="mapBaseViewport"
            :label-mode="mapLabelMode"
            :show-place-labels="true"
            map-presentation="scope"
            :show-map-style-toggle="true"
            :show-projection-toggle="true"
            :persist-map-preferences="false"
            :use-planner-camera-motion="true"
            :auto-locate-on-load="false"
            marker-variant="default"
            :show-fit-route-control="mapRoutePoints.length > 1"
            :auto-fit-route-on-load="false"
            @spot-select="handleSpotSelect"
            @interaction="handleMapInteraction"
          />
          <Transition name="map-selected-overlay">
            <article
              v-if="selectedMapOverlaySpot"
              class="map-selected-overlay glass-panel"
              data-test="map-selected-overlay"
              aria-live="polite"
            >
              <LazyImage
                :src="selectedMapOverlayPhoto"
                :alt="selectedMapOverlaySpot.title"
                class="map-selected-overlay__media"
                eager
              />
              <div class="map-selected-overlay__copy">
                <div class="map-selected-overlay__topline">
                  <span class="badge" :class="`badge-${selectedMapOverlaySpot.category}`">
                    {{ formatCategory(selectedMapOverlaySpot.category) }}
                  </span>
                  <span class="map-selected-overlay__rating">
                    <ScopeIcon name="star-filled" label="Rating" />
                    {{ selectedMapOverlaySpot.rating.toFixed(1) }}
                  </span>
                </div>
                <h2>{{ selectedMapOverlaySpot.title }}</h2>
                <p class="map-selected-overlay__location">{{ selectedMapOverlayLocation }}</p>
                <p class="map-selected-overlay__description">{{ selectedMapOverlaySpot.description }}</p>
                <div class="map-selected-overlay__footer">
                  <span v-if="selectedMapOverlaySpot.vibe" class="map-selected-overlay__vibe">
                    <ScopeIcon name="sparkle" label="Vibe" />
                    {{ formatVibeLabel(selectedMapOverlaySpot.vibe) }}
                  </span>
                  <RouterLink class="map-selected-overlay__link" :to="buildSpotPath(selectedMapOverlaySpot)">
                    <span>Open detail</span>
                    <ScopeIcon name="navigation" label="Open selected spot detail" />
                  </RouterLink>
                </div>
              </div>
              <button
                type="button"
                class="map-selected-overlay__close"
                aria-label="Close selected spot preview"
                @click="handleDismissMapSpotOverlay"
              >
                <ScopeIcon name="close" label="Close selected spot preview" />
              </button>
            </article>
          </Transition>
        </article>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import StarRatingDisplay from '@/components/common/StarRatingDisplay.vue';
import { analyticsPageEngagementTracker } from '@/services/analyticsService';
import { LOCAL_PREVIEW_ENABLED, localFallbackEnabled } from '@/services/demoMode';
import { getDefaultDiscoveryMapViewport, resolveHomeBaseMapViewport } from '@/services/mapViewportService';
import { resolveRoadRoute, type RoadRouteSummary } from '@/services/roadRouteService';
import { cloneMapViewport } from '@/config/mapViewport';
import { useAuthStore } from '@/stores/auth';
import { useMapStore } from '@/stores/map';
import { useOnboardingStore } from '@/stores/onboarding';
import { useSpotsStore } from '@/stores/spots';
import { useTripsStore } from '@/stores/trips';
import type { MapPoint, MapViewport, SpotCategory, SpotSummary, TripSpot } from '@/types';
import { CATEGORY_TRAVEL_PHOTOS } from '@/utils/travelMedia';
import { formatCityRegionLocation, formatCountryLabel, formatVibeLabel } from '@/utils/formatters';
import { isScopeQaMode } from '@/utils/qaMode';
import { scheduleNonCriticalTask, type CancelScheduledTask } from '@/utils/scheduleNonCriticalTask';
import { buildSpotPath } from '@/utils/spotRoutes';
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
type MapLabelMode = 'none' | 'states' | 'majorCities' | 'full';

const MOBILE_MAP_BREAKPOINT = 640;
const MOBILE_SHEET_DRAG_LIMIT = 280;
const MOBILE_SHEET_DRAG_THRESHOLD = 72;
const MOBILE_SHEET_STATES: MobileSheetState[] = ['peek', 'mid', 'full'];
const MAX_ROUTE_PREVIEW_STOPS = 5;
const MAP_SPOT_PAGE_SIZE = 96;
const VISIBLE_SPOT_PREVIEW_LIMIT = 8;
const METERS_PER_MILE = 1609.344;
const categories: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'entertainment', 'scenic', 'other'];
const PUBLIC_FEATURED_ROUTE_FALLBACK: MapRoutePreviewTrip = {
  title: 'Texas Photo Loop',
  description: 'A compact starter route through high-signal Texas stops for quick map scanning, route context, and trip inspiration.',
  destination: 'Texas',
  coverImageUrl: CATEGORY_TRAVEL_PHOTOS.scenic,
  members: [
    { id: 'scope-editorial', displayName: 'Scope Editorial' },
    { id: 'local-picks', displayName: 'Local Picks' },
  ],
  spots: [
    {
      spotId: '90000000-0000-0000-0000-000000000003',
      title: 'Fort Worth Water Gardens',
      latitude: 32.7478,
      longitude: -97.324,
      category: 'scenic',
      city: 'Fort Worth',
      dayNumber: 1,
      timeSlot: '09:30',
      photoUrl: CATEGORY_TRAVEL_PHOTOS.scenic,
    },
    {
      spotId: '90000000-0000-0000-0000-000000000001',
      title: 'Mule Alley Mercantile Row',
      latitude: 32.7899,
      longitude: -97.3484,
      category: 'shopping',
      city: 'Fort Worth',
      dayNumber: 1,
      timeSlot: '11:15',
      photoUrl: CATEGORY_TRAVEL_PHOTOS.shopping,
    },
    {
      spotId: '90000000-0000-0000-0000-000000000005',
      title: 'Lady Bird Skyline Boardwalk',
      latitude: 30.249,
      longitude: -97.7256,
      category: 'scenic',
      city: 'Austin',
      dayNumber: 1,
      timeSlot: '17:45',
      photoUrl: CATEGORY_TRAVEL_PHOTOS.scenic,
    },
  ],
};
const isMapAuditMode = isScopeQaMode();
const LOCAL_MAP_PREVIEW_ENABLED = LOCAL_PREVIEW_ENABLED || localFallbackEnabled('VITE', 'ENABLE', 'MAP', 'MOCK', 'FALLBACK');
const MapView = defineAsyncComponent(() => import('@/components/map/MapView.vue'));

const authStore = useAuthStore();
const mapStore = useMapStore();
const onboardingStore = useOnboardingStore();
const spotsStore = useSpotsStore();
const tripsStore = useTripsStore();
const route = useRoute();

if (!isMapAuditMode) {
  mapStore.setSelectedSpotId(null);
  mapStore.resetVisibleSpotIds();
  mapStore.resetCategories();
}

const isMobileMapLayout = ref(false);
const mapSidebarRef = ref<HTMLElement | null>(null);
const mapBaseViewport = ref<MapViewport>(getDefaultDiscoveryMapViewport());
const isMapSidebarScrolled = ref(false);
const roadRoute = ref<RoadRouteSummary | null>(null);
const roadRouteLoading = ref(false);
const isSelectedMapOverlayVisible = ref(false);
const hasLoadedSpotData = ref(false);
const hasLoadedTripData = ref(false);
const localPreviewSpots = ref<SpotSummary[]>([]);
const localPreviewTrip = ref<MapRoutePreviewTrip | null>(null);
const isFeaturedRoutePreviewPinned = ref(false);
const mobileSheetState = ref<MobileSheetState>('peek');
const isDraggingMobileSheet = ref(false);
const mobileSheetDragStartY = ref(0);
const mobileSheetDragOffset = ref(0);
const ignoreNextMobileSheetClick = ref(false);
let cancelInitialWorkspaceLoad: CancelScheduledTask = () => undefined;
let roadRouteRequestId = 0;
let mapBaseViewportRequestId = 0;

const focusedMapSpotId = computed(() => {
  const rawSpotId = route?.query?.spotId;
  return typeof rawSpotId === 'string' ? rawSpotId.trim() : '';
});

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

function formatSpotCityRegion(spot: MapWorkspaceSpot): string {
  const locationLabel = formatCityRegionLocation(spot, '').trim();
  const countryBadge = formatSpotCountryBadge(spot.country);
  const countrySuffix = `, ${countryBadge}`;

  if (countryBadge && locationLabel.toLowerCase().endsWith(countrySuffix.toLowerCase())) {
    return locationLabel.slice(0, -countrySuffix.length);
  }

  return locationLabel || 'Location syncing';
}

function formatSpotCountryBadge(country: string | undefined): string {
  return formatCountryLabel(country);
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

function toWorkspaceSpot(spot: SpotSummary): MapWorkspaceSpot {
  return {
    id: spot.id,
    title: spot.title,
    description: spot.description ?? 'Saved Scope spot ready to explore on the live map.',
    latitude: spot.latitude,
    longitude: spot.longitude,
    category: spot.category,
    city: spot.city ?? '',
    country: spot.country ?? '',
    vibe: spot.vibe ?? formatCategory(spot.category),
    rating: spot.rating,
    photoUrl: getSpotPhotoUrl(spot.category, spot.photoUrl),
  };
}

function mergeSpotSources(spots: SpotSummary[], prioritySpot?: SpotSummary | null): SpotSummary[] {
  if (!prioritySpot) {
    return spots;
  }

  const seenSpotIds = new Set<string>();
  return [prioritySpot, ...spots].filter((spot) => {
    if (seenSpotIds.has(spot.id)) {
      return false;
    }

    seenSpotIds.add(spot.id);
    return true;
  });
}

async function syncFocusedMapSpot(): Promise<void> {
  const spotId = focusedMapSpotId.value;
  if (!spotId || isMapAuditMode) {
    return;
  }

  mapStore.setSelectedSpotId(spotId);
  await spotsStore.fetchSpot(spotId);
  hasLoadedSpotData.value = true;
  mapStore.setSelectedSpotId(spotId);
}

async function loadLocalMapPreviewData(): Promise<void> {
  if (!LOCAL_MAP_PREVIEW_ENABLED) {
    return;
  }

  if (import.meta.env.MODE === 'production' && import.meta.env.VITE_ENABLE_LOCAL_PREVIEW !== 'true') {
    return;
  }

  const { mockSpots, mockTrips } = await import('@/services/mockData');
  localPreviewSpots.value = mockSpots;
  localPreviewTrip.value = mockTrips[0] ?? null;
}

const workspaceSpots = computed<MapWorkspaceSpot[]>(() => {
  if (isMapAuditMode) {
    return MAP_AUDIT_SPOTS;
  }

  const sourceSpots = spotsStore.items.length || hasLoadedSpotData.value || !LOCAL_MAP_PREVIEW_ENABLED
    ? spotsStore.items
    : localPreviewSpots.value;
  const mergedSpots = mergeSpotSources(sourceSpots, spotsStore.selectedSpot ? {
    id: spotsStore.selectedSpot.id,
    title: spotsStore.selectedSpot.title,
    description: spotsStore.selectedSpot.description,
    latitude: spotsStore.selectedSpot.latitude,
    longitude: spotsStore.selectedSpot.longitude,
    address: spotsStore.selectedSpot.address,
    city: spotsStore.selectedSpot.city,
    country: spotsStore.selectedSpot.country,
    category: spotsStore.selectedSpot.category,
    vibe: spotsStore.selectedSpot.vibe,
    rating: spotsStore.selectedSpot.rating,
    photoUrl: spotsStore.selectedSpot.photoUrl ?? spotsStore.selectedSpot.photos[0]?.url,
    createdAt: spotsStore.selectedSpot.createdAt,
    isPublic: spotsStore.selectedSpot.isPublic,
    author: spotsStore.selectedSpot.author,
    liked: spotsStore.selectedSpot.liked,
    likesCount: spotsStore.selectedSpot.likesCount,
  } : null);

  return mergedSpots.map(toWorkspaceSpot);
});
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

const activeTrip = computed<MapRoutePreviewTrip | null>(() => (
  isMapAuditMode
    ? MAP_AUDIT_ROUTE
    : tripsStore.items[0]
      ?? (hasLoadedTripData.value || !LOCAL_MAP_PREVIEW_ENABLED ? null : localPreviewTrip.value)
      ?? PUBLIC_FEATURED_ROUTE_FALLBACK
));
const workspaceLoading = computed(() => (isMapAuditMode ? false : spotsStore.loading || tripsStore.loading));
const workspaceError = computed(() => (
  isMapAuditMode ? '' : spotsStore.error || (authStore.isAuthenticated ? tripsStore.error : '') || ''
));
const routeSourceStops = computed<TripSpot[]>(() => activeTrip.value?.spots ?? []);
function labelRouteMapPoints(points: MapPoint[]): MapPoint[] {
  const lastIndex = points.length - 1;

  return points.map((point, index) => {
    const routeRole: MapPoint['routeRole'] = index === 0
      ? 'start'
      : index === lastIndex
        ? 'end'
        : 'stop';
    const routeLabel = routeRole === 'start' ? 'S' : routeRole === 'end' ? 'E' : String(index + 1);

    return {
      ...point,
      routeRole,
      routeLabel,
    };
  });
}

const routeSourcePoints = computed<MapPoint[]>(() => labelRouteMapPoints(routeSourceStops.value.map((spot) => ({
  id: spot.spotId,
  title: spot.title,
  latitude: spot.latitude,
  longitude: spot.longitude,
  category: spot.category,
  city: spot.city,
}))));
const routePoints = computed<MapPoint[]>(() => {
  const optimizedPoints = roadRoute.value?.orderedPoints ?? [];
  return labelRouteMapPoints(optimizedPoints.length ? optimizedPoints : routeSourcePoints.value);
});
const routeGeometry = computed(() => roadRoute.value?.geometry ?? []);
const hasSelectedMapCategories = computed(() => mapStore.activeCategories.length > 0);
const canPreviewFeaturedRouteOnMap = computed(() => hasSelectedMapCategories.value && routeSourcePoints.value.length > 1);
const isFeaturedRouteMapVisible = computed(() => (
  canPreviewFeaturedRouteOnMap.value
  && isFeaturedRoutePreviewPinned.value
));
const mapRoutePoints = computed(() => (isFeaturedRouteMapVisible.value ? routePoints.value : []));
const mapRouteGeometry = computed(() => (isFeaturedRouteMapVisible.value ? routeGeometry.value : []));
const mapLabelMode = computed<MapLabelMode>(() => {
  const hasPreferredLocation = Boolean(authStore.currentUser?.homeBase?.trim());
  const hasFocusedMapContext = Boolean(mapStore.selectedSpotId) || mapStore.viewport.zoom >= 7;
  if (hasPreferredLocation || hasFocusedMapContext) {
    return 'full';
  }

  return mapStore.viewport.zoom >= 4.45 ? 'majorCities' : 'states';
});
const routeTitle = computed(() => {
  if (activeTrip.value?.title) {
    return activeTrip.value.title;
  }

  return workspaceLoading.value ? 'Loading route preview' : 'Route preview ready';
});

function isRouteDescriptionPlaceholder(description: string): boolean {
  const normalizedDescription = description.trim().toLowerCase();
  return !normalizedDescription
    || normalizedDescription === 'collaborative trip draft from scope planner.'
    || normalizedDescription.includes('collaborative trip draft from scope planner')
    || normalizedDescription.includes('pick a trip from the planner')
    || normalizedDescription.includes('planner previews land here');
}

const routeDescription = computed(() => {
  const description = activeTrip.value?.description?.trim() ?? '';
  if (description && !isRouteDescriptionPlaceholder(description)) {
    return description;
  }

  if (workspaceLoading.value) {
    return 'Scope is syncing trip context into the map workspace.';
  }

  if (activeTrip.value) {
    const stopCount = routeSourceStops.value.length;
    const destination = routeDestinationDisplay.value;
    if (stopCount > 1) {
      return `A live ${stopCount}-stop route preview around ${destination}, with the pin order, timing, and crew context ready to refine.`;
    }

    return `A focused route preview around ${destination}, ready for saved pins, timing, and trip context.`;
  }

  return 'Start a route in the planner and it will appear here with ordered stops, drive context, and crew notes.';
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
const routeHeroPhoto = computed(() => activeTrip.value?.coverImageUrl ?? routeStopsPreview.value[0]?.photoUrl ?? getFallbackPhoto('adventure'));
const routeMemberPreview = computed(() => (activeTrip.value?.members ?? []).slice(0, 3).map((member) => ({
  id: member.id,
  initials: getMemberInitials(member.displayName),
})));

const visibleSpots = computed(() => {
  if (!hasSelectedMapCategories.value) {
    return [];
  }

  const visibleIds = new Set(mapStore.visibleSpotIds);
  const scopedSpots = mapStore.visibleSpotIdsMeasured
    ? workspaceSpots.value.filter((spot) => visibleIds.has(spot.id) && mapStore.activeCategories.includes(spot.category))
    : workspaceSpots.value.filter((spot) => mapStore.activeCategories.includes(spot.category));

  return scopedSpots;
});

const visibleSpotPreviews = computed(() => {
  const spots = visibleSpots.value;
  if (spots.length <= VISIBLE_SPOT_PREVIEW_LIMIT) {
    return spots;
  }

  const selectedSpotId = mapStore.selectedSpotId;
  const previewAnchorSpot = selectedSpotId
    ? spots.find((spot) => spot.id === selectedSpotId) ?? null
    : spots[0] ?? null;
  const selectedCategory = previewAnchorSpot?.category;
  const categoryOrder = [
    ...(selectedCategory ? [selectedCategory] : []),
    ...categories.filter((category) => category !== selectedCategory),
  ];
  const selectedSpotIds = new Set<string>();
  const previews: MapWorkspaceSpot[] = [];

  const addPreview = (spot: MapWorkspaceSpot | null | undefined) => {
    if (!spot || selectedSpotIds.has(spot.id) || previews.length >= VISIBLE_SPOT_PREVIEW_LIMIT) {
      return;
    }

    selectedSpotIds.add(spot.id);
    previews.push(spot);
  };

  addPreview(previewAnchorSpot);

  const categoryBuckets = new Map<SpotCategory, MapWorkspaceSpot[]>();
  categoryOrder.forEach((category) => {
    categoryBuckets.set(
      category,
      spots
        .filter((spot) => spot.category === category && !selectedSpotIds.has(spot.id))
        .sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title)),
    );
  });

  while (previews.length < VISIBLE_SPOT_PREVIEW_LIMIT && Array.from(categoryBuckets.values()).some((bucket) => bucket.length)) {
    categoryOrder.forEach((category) => {
      addPreview(categoryBuckets.get(category)?.shift());
    });
  }

  return previews;
});

const visibleTitle = computed(() => {
  const count = visibleSpots.value.length;
  return `${count} spot${count === 1 ? '' : 's'} ready to explore`;
});
const visibleEmptyTitle = computed(() => (
  hasSelectedMapCategories.value ? 'No pins match this category mix' : 'No categories selected'
));
const visibleEmptyDescription = computed(() => (
  hasSelectedMapCategories.value
    ? 'Reset the category blend to bring every saved Scope pin back onto the map and into this quick-access rail.'
    : 'Turn on a category to bring matching Scope pins back onto the map and into this quick-access rail.'
));
const activeFilterCountLabel = computed(() => `${mapStore.activeCategories.length}/${categories.length} live`);

const selectedSpot = computed(() => {
  if (!hasSelectedMapCategories.value) {
    return null;
  }

  const selectedId = mapStore.selectedSpotId;
  const explicitSelection = selectedId ? workspaceSpots.value.find((spot) => spot.id === selectedId) ?? null : null;
  const activeExplicitSelection = explicitSelection && mapStore.activeCategories.includes(explicitSelection.category)
    ? explicitSelection
    : null;

  if (!mapStore.visibleSpotIdsMeasured) {
    return activeExplicitSelection ?? visibleSpots.value[0] ?? null;
  }

  if (!mapStore.visibleSpotIds.length) {
    return null;
  }

  return visibleSpots.value.find((spot) => spot.id === selectedId) ?? visibleSpots.value[0] ?? null;
});
const selectedMapOverlaySpot = computed(() => {
  if (!hasSelectedMapCategories.value || !isSelectedMapOverlayVisible.value || isMobileMapLayout.value || !mapStore.selectedSpotId) {
    return null;
  }

  const spot = workspaceSpots.value.find((entry) => entry.id === mapStore.selectedSpotId) ?? null;
  return spot && mapStore.activeCategories.includes(spot.category) ? spot : null;
});
const selectedSpotPhoto = computed(() => {
  if (!selectedSpot.value) {
    return routeHeroPhoto.value;
  }

  return getSpotPhotoUrl(selectedSpot.value.category, selectedSpot.value.photoUrl);
});
const selectedMapOverlayPhoto = computed(() => {
  const spot = selectedMapOverlaySpot.value;
  return spot ? getSpotPhotoUrl(spot.category, spot.photoUrl) : routeHeroPhoto.value;
});
const selectedSpotLocation = computed(() => {
  if (!selectedSpot.value) {
    return 'Scope';
  }

  return formatSpotCityRegion(selectedSpot.value);
});
const selectedMapOverlayLocation = computed(() => {
  const spot = selectedMapOverlaySpot.value;
  return spot ? formatSpotCityRegion(spot) : 'Scope';
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
const mobileSheetHeadline = computed(() => {
  if (selectedSpot.value) {
    return selectedSpot.value.title;
  }

  return hasSelectedMapCategories.value ? routeTitle.value : visibleEmptyTitle.value;
});
const mobileSheetDescription = computed(() => {
  if (selectedSpot.value) {
    return `${selectedSpotLocation.value} - Swipe up for details.`;
  }

  return `${visibleTitle.value} - Swipe up for filters.`;
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
    '--scope-mobile-sheet-visible': mobileSheetVisibleHeight.value,
    '--scope-map-controls-top': 'calc(var(--space-3) + 4.75rem)',
    '--scope-map-controls-right': 'var(--space-3)',
    '--scope-map-controls-bottom': 'calc(var(--scope-mobile-sheet-visible) + var(--space-4))',
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

function handleFeaturedRouteCardClick() {
  if (!canPreviewFeaturedRouteOnMap.value) {
    return;
  }

  isFeaturedRoutePreviewPinned.value = !isFeaturedRoutePreviewPinned.value;
  handleMapInteraction({
    type: isFeaturedRoutePreviewPinned.value ? 'featured_route_pin' : 'featured_route_unpin',
  });
}

function handleCategoryToggle(category: SpotCategory) {
  mapStore.toggleCategory(category);
  handleMapInteraction({ type: 'category_toggle' });
}

function handleResetCategories() {
  mapStore.resetCategories();
  handleMapInteraction({ type: 'category_reset' });
}

function handleDismissMapSpotOverlay() {
  isSelectedMapOverlayVisible.value = false;
  mapStore.setSelectedSpotId(null);
  handleMapInteraction({ type: 'spot_preview_dismiss' });
}

function handleSpotSelect(spot: MapPoint) {
  mapStore.setSelectedSpotId(spot.id);
  isSelectedMapOverlayVisible.value = true;
  handleMapInteraction({ type: 'spot_select' });
  revealMobileSheet();
}

function focusSpot(spotId: string) {
  const spot = workspaceSpots.value.find((entry) => entry.id === spotId);
  if (!spot) {
    return;
  }

  mapStore.setSelectedSpotId(spot.id);
  isSelectedMapOverlayVisible.value = true;
  mapStore.setCenter([spot.longitude, spot.latitude]);
  mapStore.setZoom(12);
  handleMapInteraction({ type: 'visible_spot_focus' });
  revealMobileSheet();
}

function buildRoutePointRequestKey(point: MapPoint): string {
  return `${point.id}:${point.longitude.toFixed(5)},${point.latitude.toFixed(5)}`;
}

function setMapBaseViewport(viewport: MapViewport): void {
  const nextViewport = cloneMapViewport(viewport);
  mapBaseViewport.value = nextViewport;
  mapStore.setCenter(nextViewport.center);
  mapStore.setZoom(nextViewport.zoom);
  mapStore.setStyle(nextViewport.style);
}

async function syncMapBaseViewportFromPreferredLocation(): Promise<void> {
  const requestId = ++mapBaseViewportRequestId;
  const preferredLocation = authStore.currentUser?.homeBase?.trim() ?? '';

  if (!preferredLocation) {
    setMapBaseViewport(getDefaultDiscoveryMapViewport());
    return;
  }

  const preferredViewport = await resolveHomeBaseMapViewport(preferredLocation).catch(() => null);
  if (requestId !== mapBaseViewportRequestId) {
    return;
  }

  setMapBaseViewport(preferredViewport ?? getDefaultDiscoveryMapViewport());
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

watch(
  () => authStore.currentUser?.homeBase ?? '',
  () => {
    void syncMapBaseViewportFromPreferredLocation();
  },
  { immediate: true },
);

watch(focusedMapSpotId, () => {
  void syncFocusedMapSpot().catch(() => undefined);
});

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
    const tripLoadTask = authStore.isAuthenticated
      ? tripsStore.fetchTrips().then(() => {
        hasLoadedTripData.value = true;
      })
      : Promise.resolve().then(() => {
        hasLoadedTripData.value = true;
      });

    await Promise.allSettled([
      loadLocalMapPreviewData(),
      syncFocusedMapSpot().catch(() => undefined),
      spotsStore.fetchSpots({ page: 1, pageSize: MAP_SPOT_PAGE_SIZE }).then(() => {
        hasLoadedSpotData.value = true;
      }),
      tripLoadTask,
    ]);
  }, { delayMs: 140, timeoutMs: 1_000 });
});

onBeforeUnmount(() => {
  roadRouteRequestId += 1;
  mapBaseViewportRequestId += 1;
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
  grid-template-columns: minmax(20rem, 22.5rem) minmax(0, 1fr);
  gap: var(--space-4);
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

.map-plain-empty-state {
  min-height: 14rem;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-3);
  text-align: center;
}

.map-plain-empty-state h3,
.map-plain-empty-state p {
  margin: 0;
}

.map-plain-empty-state h3 {
  max-width: 24rem;
  color: var(--text-primary);
  font-size: clamp(1.15rem, 1.2vw, 1.45rem);
  line-height: var(--line-height-tight);
  letter-spacing: 0;
}

.map-plain-empty-state p:not(.eyebrow) {
  max-width: 28rem;
  color: var(--text-secondary);
  line-height: var(--line-height-relaxed);
}

.map-plain-empty-state .button {
  margin-top: var(--space-1);
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
  gap: 0.68rem;
  align-items: stretch;
  width: 100%;
}

.route-metrics span:last-child {
  grid-column: 1 / 2;
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
  width: 100%;
  cursor: pointer;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-secondary) 96%, var(--bg-primary) 4%),
      color-mix(in srgb, var(--bg-tertiary) 92%, var(--bg-primary) 8%)
    );
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast);
}

.route-card:focus-visible {
  outline: none;
  border-color: color-mix(in srgb, var(--accent-teal) 42%, var(--glass-border));
  box-shadow:
    var(--shadow-md),
    0 0 0 3px color-mix(in srgb, var(--accent-teal) 14%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 8%, transparent);
}

.route-card[aria-disabled='true'] {
  cursor: default;
}

.route-card > * {
  min-width: 0;
  max-width: 100%;
}

.route-card--map-preview-active {
  border-color: color-mix(in srgb, var(--accent-teal) 24%, var(--glass-border));
  box-shadow:
    var(--shadow-md),
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 8%, transparent),
    0 0 0 1px color-mix(in srgb, var(--accent-teal) 8%, transparent);
}

.route-heading .eyebrow {
  color: color-mix(in srgb, var(--text-secondary) 22%, var(--accent-teal) 78%);
  letter-spacing: 0.1em;
}

.route-heading h2 {
  color: color-mix(in srgb, var(--text-primary) 93%, var(--highlight-sheen) 7%);
  font-weight: var(--font-weight-semibold);
}

.route-heading-actions {
  display: inline-flex;
  flex: 0 1 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: flex-start;
  gap: var(--space-2);
  min-width: 0;
  max-width: 100%;
}

.route-heading-actions > .route-destination-pill {
  align-self: flex-start;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  padding: 0.42rem 0.72rem;
  justify-content: flex-start;
  overflow: hidden;
  text-overflow: ellipsis;
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

.selected-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-normal);
}

.route-timeline {
  list-style: none;
  min-width: 0;
  margin: 0;
  padding: 1.05rem;
  display: grid;
  gap: 0;
  border: 1px solid color-mix(in srgb, var(--highlight-sheen) 6%, var(--border) 94%);
  border-radius: var(--radius-xl);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 90%, var(--bg-primary) 10%), color-mix(in srgb, var(--bg-primary) 16%, var(--bg-secondary) 84%));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 7%, transparent),
    inset 0 -1px 0 color-mix(in srgb, var(--bg-primary) 34%, transparent);
}

.route-timeline-stop {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.85rem;
  min-width: 0;
  padding: 0 0 1.14rem;
}

.route-timeline-stop:last-child {
  padding-bottom: 0;
}

.route-timeline-stop::after {
  content: '';
  position: absolute;
  left: 0.95rem;
  top: 2.26rem;
  bottom: 0.25rem;
  border-left: 1px dashed color-mix(in srgb, var(--accent-teal) 42%, var(--glass-border));
}

.route-timeline-stop:last-child::after {
  display: none;
}

.route-timeline-index {
  position: relative;
  z-index: 1;
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  width: 1.9rem;
  height: 1.9rem;
  border-radius: 50%;
  font-size: 0.78rem;
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
  color: color-mix(in srgb, var(--text-primary) 88%, var(--accent-teal) 12%);
  line-height: 1;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 62%, var(--border));
  background:
    radial-gradient(circle at 35% 28%, color-mix(in srgb, var(--accent-teal) 24%, transparent), transparent 58%),
    color-mix(in srgb, var(--bg-secondary) 86%, var(--bg-primary) 14%);
  box-shadow:
    0 0 0 0.2rem color-mix(in srgb, var(--bg-primary) 24%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 8%, transparent);
}

.route-timeline-copy strong,
.visible-copy strong,
.visible-copy p {
  display: block;
}

.route-timeline-copy strong,
.visible-copy strong {
  color: var(--text-primary);
}

.route-timeline-copy {
  display: grid;
  align-content: start;
  gap: 0.46rem;
  min-width: 0;
  padding-top: 0.08rem;
}

.route-timeline-copy strong {
  font-size: 0.92rem;
  line-height: 1.24;
  overflow-wrap: anywhere;
}

.route-timeline-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.36rem;
}

.route-timeline-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.28rem;
  min-height: 1.42rem;
  padding: 0.22rem 0.52rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--highlight-sheen) 6%, var(--border) 94%);
  background: color-mix(in srgb, var(--bg-secondary) 84%, var(--bg-primary) 16%);
  color: color-mix(in srgb, var(--text-secondary) 84%, var(--text-primary) 16%);
  font-size: 0.68rem;
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  white-space: nowrap;
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 5%, transparent);
}

.route-timeline-pill :deep(.scope-icon) {
  width: 0.72rem;
  height: 0.72rem;
  color: color-mix(in srgb, var(--accent-teal) 66%, var(--text-secondary) 34%);
}

.route-timeline-pill--time {
  border-color: color-mix(in srgb, var(--accent-teal) 28%, var(--border));
  background: color-mix(in srgb, var(--accent-teal) 10%, var(--bg-secondary) 90%);
  color: color-mix(in srgb, var(--accent-teal) 56%, var(--text-primary) 44%);
}

.route-member-copy,
.visible-copy p,
.visible-rating,
.mobile-sheet-copy {
  font-size: var(--font-size-small);
}

.route-footer {
  display: grid;
  align-items: stretch;
  gap: var(--space-4);
}

.route-metrics span {
  justify-content: flex-start;
  gap: 0.5rem;
  min-width: 0;
  width: 100%;
  min-height: 2.28rem;
  padding: 0.54rem 0.7rem;
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
  color: var(--accent-teal);
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
  gap: 0.85rem;
}

.visible-item {
  width: 100%;
  display: grid;
  grid-template-columns: 4.75rem minmax(0, 1fr);
  grid-template-rows: auto auto auto;
  align-items: start;
  column-gap: 1rem;
  row-gap: 0.58rem;
  min-height: 7rem;
  padding: 0.95rem 1rem;
  border-radius: var(--radius-xl);
  border: 1px solid var(--glass-border);
  background: color-mix(in srgb, var(--bg-primary) 22%, transparent);
  color: var(--text-primary);
  font: inherit;
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
  width: 4.75rem;
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

.visible-copy strong {
  display: -webkit-box;
  overflow: hidden;
  font-size: 1.06rem;
  line-height: 1.16;
  letter-spacing: 0;
  text-wrap: balance;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.visible-location {
  grid-column: 1 / -1;
  grid-row: 3;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: nowrap;
  min-width: 0;
  width: 100%;
}

.visible-location-badge {
  flex: 0 1 auto;
  width: auto;
  min-width: 0;
  max-width: 100%;
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
  min-height: 1.55rem;
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  background: color-mix(in srgb, var(--bg-secondary) 88%, var(--bg-primary) 12%);
  line-height: 1;
}

.visible-location-badge {
  display: block;
}

.visible-country-badge,
.selected-country-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  color: color-mix(in srgb, var(--text-primary) 82%, var(--accent-teal) 18%);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.08em;
}

.visible-rating {
  grid-column: 2;
  grid-row: 2;
  justify-self: start;
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

.map-selected-overlay {
  position: absolute;
  top: max(var(--space-4), var(--safe-area-top));
  left: max(var(--space-4), var(--safe-area-left));
  z-index: calc(var(--z-sidebar) + 1);
  display: grid;
  grid-template-columns: minmax(8.8rem, 0.42fr) minmax(0, 1fr) auto;
  align-items: stretch;
  gap: var(--space-4);
  width: min(30rem, calc(100% - 23rem));
  min-height: 11rem;
  padding: var(--space-4);
  border-color: color-mix(in srgb, var(--accent-teal) 22%, var(--glass-border));
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--bg-secondary) 94%, transparent), color-mix(in srgb, var(--bg-primary) 88%, transparent));
  box-shadow:
    0 1.4rem 3.2rem color-mix(in srgb, var(--bg-primary) 38%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 7%, transparent);
  pointer-events: auto;
}

.map-selected-overlay__media {
  width: 100%;
  min-height: 9.3rem;
  border-radius: var(--radius-xl);
  object-fit: cover;
  overflow: hidden;
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--highlight-sheen) 10%, transparent),
    0 0.8rem 1.8rem color-mix(in srgb, var(--bg-primary) 22%, transparent);
}

.map-selected-overlay__copy {
  display: grid;
  align-content: center;
  gap: 0.62rem;
  min-width: 0;
}

.map-selected-overlay__topline {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.map-selected-overlay__topline .badge,
.map-selected-overlay__rating,
.map-selected-overlay__vibe {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  min-height: 1.62rem;
  padding: 0.28rem 0.62rem;
  border-radius: var(--radius-full);
  font-size: 0.74rem;
  font-weight: var(--font-weight-semibold);
  line-height: 1;
}

.map-selected-overlay__rating {
  border: 1px solid color-mix(in srgb, var(--accent-gold) 26%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-gold) 8%, var(--bg-secondary) 92%);
  color: color-mix(in srgb, var(--accent-gold) 72%, var(--text-primary) 28%);
}

.map-selected-overlay__rating :deep(.scope-icon) {
  width: 0.84rem;
  height: 0.84rem;
}

.map-selected-overlay h2,
.map-selected-overlay p {
  margin: 0;
  min-width: 0;
}

.map-selected-overlay h2 {
  color: var(--text-primary);
  font-size: clamp(1.25rem, 1.4vw + 0.65rem, 1.7rem);
  line-height: 1.08;
  letter-spacing: 0;
  text-wrap: balance;
}

.map-selected-overlay__location {
  color: var(--text-secondary);
  font-size: 0.94rem;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-selected-overlay__description {
  display: -webkit-box;
  color: color-mix(in srgb, var(--text-secondary) 88%, var(--text-primary) 12%);
  font-size: 0.9rem;
  line-height: 1.45;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.map-selected-overlay__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-top: 0.1rem;
}

.map-selected-overlay__vibe {
  max-width: 100%;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  background: color-mix(in srgb, var(--bg-secondary) 78%, var(--accent-teal) 8%);
  color: color-mix(in srgb, var(--text-primary) 86%, var(--accent-teal) 14%);
}

.map-selected-overlay__vibe :deep(.scope-icon) {
  width: 0.84rem;
  height: 0.84rem;
  color: var(--accent-teal);
}

.map-selected-overlay__link {
  display: inline-flex;
  align-items: center;
  gap: 0.38rem;
  width: fit-content;
  color: var(--accent-teal);
  font-size: 0.88rem;
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
}

.map-selected-overlay__link :deep(.scope-icon) {
  width: 0.88rem;
  height: 0.88rem;
}

.map-selected-overlay__close {
  display: grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  border: 1px solid color-mix(in srgb, var(--highlight-sheen) 7%, var(--glass-border) 93%);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 28%, var(--bg-secondary) 72%);
  color: var(--text-secondary);
  cursor: pointer;
}

.map-selected-overlay__close:hover,
.map-selected-overlay__close:focus-visible {
  color: var(--text-primary);
  border-color: var(--border-hover);
  outline: none;
}

.map-selected-overlay__close :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
}

.map-selected-overlay-enter-active,
.map-selected-overlay-leave-active {
  transition:
    opacity var(--transition-normal),
    transform var(--transition-normal);
}

.map-selected-overlay-enter-from,
.map-selected-overlay-leave-to {
  opacity: 0;
  transform: translateY(-0.8rem) scale(0.98);
}

.map-stage {
  position: relative;
  height: 100%;
  min-height: 0;
  padding: 0;
  overflow: hidden;
  border-color: color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-secondary) 96%, var(--bg-primary) 4%),
      color-mix(in srgb, var(--bg-primary) 92%, var(--bg-secondary) 8%)
    );
  box-shadow:
    var(--shadow-lg),
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 7%, transparent),
    0 0 0 1px color-mix(in srgb, var(--accent-teal) 5%, transparent);
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

@media (max-width: 1080px) {
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

  .route-timeline {
    padding: 0.95rem;
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
    --scope-map-controls-bottom: calc(var(--scope-mobile-sheet-visible, 9.5rem) + var(--space-4) + var(--safe-area-bottom));
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
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .map-sidebar--mobile .route-heading h2 {
    font-size: clamp(1.26rem, 4.8vw, 1.52rem);
    line-height: 1.18;
  }

  .map-sidebar--mobile .route-heading-actions {
    justify-content: flex-start;
    gap: var(--space-2);
  }

  .map-sidebar--mobile .route-heading-actions > .route-destination-pill {
    align-self: flex-start;
    flex: 0 1 auto;
    margin-left: 0;
    max-width: 100%;
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
    padding-right: var(--space-4);
  }

  .map-sidebar--mobile .route-timeline {
    padding: 0.9rem;
    border-radius: var(--radius-lg);
  }

  .map-sidebar--mobile .route-timeline-stop {
    gap: 0.68rem;
    padding-bottom: 1rem;
  }

  .map-sidebar--mobile .route-timeline-stop::after {
    left: 0.84rem;
    top: 2.05rem;
  }

  .map-sidebar--mobile .route-timeline-index {
    width: 1.68rem;
    height: 1.68rem;
    font-size: 0.7rem;
  }

  .map-sidebar--mobile .route-timeline-copy strong {
    font-size: 0.86rem;
    line-height: 1.22;
  }

  .map-sidebar--mobile .route-timeline-meta {
    gap: 0.28rem;
  }

  .map-sidebar--mobile .route-timeline-pill {
    min-height: 1.22rem;
    padding: 0.16rem 0.42rem;
    font-size: 0.62rem;
  }

  .map-sidebar--mobile .route-timeline-pill :deep(.scope-icon) {
    width: 0.64rem;
    height: 0.64rem;
  }

  .map-sidebar--mobile .route-metrics {
    width: 100%;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.55rem;
    margin-right: 0;
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
    margin-right: 0;
  }

  .map-sidebar--mobile .route-empty-state {
    max-width: 100%;
  }

  .map-sidebar--mobile .route-empty-state :deep(.empty-state-panel__actions),
  .map-sidebar--mobile .route-empty-state :deep(.button) {
    width: 100%;
  }

  .map-sidebar--mobile .visible-item {
    grid-template-columns: 4.25rem minmax(0, 1fr);
    grid-template-rows: auto auto auto;
    align-items: start;
    gap: 0.55rem 0.85rem;
    min-height: 6.35rem;
    padding: 0.85rem;
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--bg-primary) 28%, var(--bg-secondary) 72%);
  }

  .map-sidebar--mobile .visible-image {
    grid-row: 1 / span 2;
    width: 4.25rem;
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

  .map-sidebar--mobile .visible-copy strong {
    font-size: 0.98rem;
    line-height: 1.14;
  }

  .map-sidebar--mobile .visible-location {
    grid-column: 1 / -1;
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
    grid-template-columns: 4.25rem minmax(0, 1fr);
    grid-template-rows: auto auto auto;
    min-height: 6.35rem;
    padding: 0.85rem;
  }

  .visible-image {
    grid-row: 1 / span 2;
    width: 4.25rem;
  }

  .visible-rating {
    grid-column: 2;
    grid-row: 2;
    justify-self: start;
  }

  .visible-location {
    grid-column: 1 / -1;
    grid-row: 3;
  }

  .visible-copy strong {
    font-size: 0.98rem;
    line-height: 1.14;
  }
}
</style>
