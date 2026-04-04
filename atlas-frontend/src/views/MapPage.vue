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
                <button type="button" class="text-link" @click="handleResetCategories">Reset</button>
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
                  @click="handleCategoryToggle(category)"
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
              style="--atlas-stagger-index: 2;"
              data-test="map-selected-spot-card"
            >
              <template v-if="selectedSpot">
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
              <EmptyStatePanel
                v-else
                class="sidebar-empty-state"
                compact
                tone="surface"
                alignment="center"
                eyebrow="Your adventure map"
                title="No pins match this category mix"
                description="Reset the category blend to bring every saved Atlas pin back onto the map and into this quick-access rail."
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

        <article class="map-stage glass-panel" :class="{ 'map-stage--mobile': isMobileMapLayout }">
          <MapView
            class="map-stage-view"
            :class="{ 'map-view--mobile': isMobileMapLayout }"
            :style="mapViewStyle"
            :spots="mapSpots"
            :route-points="routePoints"
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
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import EmptyStatePanel from '@/components/common/EmptyStatePanel.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import { useMapStore } from '@/stores/map';
import { useOnboardingStore } from '@/stores/onboarding';
import { useSpotsStore } from '@/stores/spots';
import { useTripsStore } from '@/stores/trips';
import type { MapPoint, SpotCategory } from '@/types';
import { CATEGORY_TRAVEL_PHOTOS } from '@/utils/demoMedia';
import { isAtlasQaMode } from '@/utils/qaMode';
import { scheduleNonCriticalTask, type CancelScheduledTask } from '@/utils/scheduleNonCriticalTask';

interface RoutePreviewStop {
  id: string;
  title: string;
  category: SpotCategory;
  city: string;
  dayNumber?: number;
  timeSlot?: string;
  photoUrl: string;
}

interface MapWorkspaceSpot {
  id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  category: SpotCategory;
  city: string;
  country: string;
  vibe: string;
  rating: number;
  photoUrl?: string;
}

interface MapRoutePreviewTrip {
  title: string;
  description: string;
  destination: string;
  coverImageUrl?: string;
  members: Array<{
    id: string;
    displayName: string;
  }>;
  spots: Array<{
    spotId: string;
    title: string;
    latitude: number;
    longitude: number;
    category: SpotCategory;
    city?: string;
    dayNumber?: number;
    timeSlot?: string;
    photoUrl?: string;
  }>;
}

type MobileSheetState = 'peek' | 'mid' | 'full';

const MOBILE_MAP_BREAKPOINT = 640;
const MOBILE_SHEET_DRAG_LIMIT = 280;
const MOBILE_SHEET_DRAG_THRESHOLD = 72;
const MOBILE_SHEET_STATES: MobileSheetState[] = ['peek', 'mid', 'full'];
const categories: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'scenic', 'other'];
const isMapAuditMode = isAtlasQaMode();
const MAP_AUDIT_SPOTS: MapWorkspaceSpot[] = [
  {
    id: 'map-audit-riverfront-lounge',
    title: 'Riverfront Lounge',
    description: 'Glass-lined rooftop seating with a polished skyline backdrop for the guest map preview.',
    latitude: 32.7555,
    longitude: -97.3308,
    category: 'nightlife',
    city: 'Fort Worth',
    country: 'US',
    vibe: 'electric skyline',
    rating: 4.8,
    photoUrl: CATEGORY_TRAVEL_PHOTOS.nightlife,
  },
  {
    id: 'map-audit-botanic-loop',
    title: 'Botanic Loop',
    description: 'Tree-lined paths and a calm water edge that balance the featured night route.',
    latitude: 32.7419,
    longitude: -97.3621,
    category: 'nature',
    city: 'Fort Worth',
    country: 'US',
    vibe: 'garden reset',
    rating: 4.7,
    photoUrl: CATEGORY_TRAVEL_PHOTOS.nature,
  },
  {
    id: 'map-audit-vinyl-room',
    title: 'Vinyl Room',
    description: 'Low-lit listening lounge with enough energy to anchor the quick-access map rail.',
    latitude: 32.7812,
    longitude: -96.8003,
    category: 'culture',
    city: 'Dallas',
    country: 'US',
    vibe: 'late set',
    rating: 4.6,
    photoUrl: CATEGORY_TRAVEL_PHOTOS.culture,
  },
  {
    id: 'map-audit-sunrise-overlook',
    title: 'Sunrise Overlook',
    description: 'A scenic lookout that rounds out the audit route with a daylight stop.',
    latitude: 32.7791,
    longitude: -97.4012,
    category: 'scenic',
    city: 'Fort Worth',
    country: 'US',
    vibe: 'golden hour',
    rating: 4.9,
    photoUrl: CATEGORY_TRAVEL_PHOTOS.scenic,
  },
];
const MAP_AUDIT_ROUTE: MapRoutePreviewTrip = {
  title: 'North Texas Guest Sampler',
  description: 'A compact route preview that keeps the guest map fast while still showing categories, route order, and crew context.',
  destination: 'Fort Worth, TX',
  coverImageUrl: CATEGORY_TRAVEL_PHOTOS.scenic,
  members: [
    { id: 'map-audit-guide', displayName: 'Atlas Guide' },
    { id: 'map-audit-guest', displayName: 'Guest Preview' },
  ],
  spots: [
    {
      spotId: 'map-audit-riverfront-lounge',
      title: 'Riverfront Lounge',
      latitude: 32.7555,
      longitude: -97.3308,
      category: 'nightlife',
      city: 'Fort Worth',
      dayNumber: 1,
      timeSlot: '18:30',
      photoUrl: CATEGORY_TRAVEL_PHOTOS.nightlife,
    },
    {
      spotId: 'map-audit-botanic-loop',
      title: 'Botanic Loop',
      latitude: 32.7419,
      longitude: -97.3621,
      category: 'nature',
      city: 'Fort Worth',
      dayNumber: 1,
      timeSlot: '20:00',
      photoUrl: CATEGORY_TRAVEL_PHOTOS.nature,
    },
    {
      spotId: 'map-audit-sunrise-overlook',
      title: 'Sunrise Overlook',
      latitude: 32.7791,
      longitude: -97.4012,
      category: 'scenic',
      city: 'Fort Worth',
      dayNumber: 2,
      timeSlot: '07:15',
      photoUrl: CATEGORY_TRAVEL_PHOTOS.scenic,
    },
  ],
};
const MapView = defineAsyncComponent(() => import('@/components/map/MapView.vue'));

const mapStore = useMapStore();
const onboardingStore = useOnboardingStore();
const spotsStore = useSpotsStore();
const tripsStore = useTripsStore();
const isMobileMapLayout = ref(false);
const mobileSheetState = ref<MobileSheetState>('peek');
const isDraggingMobileSheet = ref(false);
const mobileSheetDragStartY = ref(0);
const mobileSheetDragOffset = ref(0);
const ignoreNextMobileSheetClick = ref(false);
let cancelInitialWorkspaceLoad: CancelScheduledTask = () => undefined;

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
    const matchingSpot = workspaceSpots.value.find((spot) => spot.id === stop.spotId);

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
    ? workspaceSpots.value.filter((spot) => visibleIds.has(spot.id))
    : workspaceSpots.value.filter((spot) => mapStore.activeCategories.includes(spot.category));

  return scopedSpots;
});

const visibleTitle = computed(() => {
  const count = visibleSpots.value.length;
  return `${count} spot${count === 1 ? '' : 's'} ready to explore`;
});
const activeFilterCountLabel = computed(() => `${mapStore.activeCategories.length}/${categories.length} live`);

const selectedSpot = computed(() => workspaceSpots.value.find((spot) => spot.id === mapStore.selectedSpotId) ?? visibleSpots.value[0] ?? null);
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
const isMapOnboardingStepActive = computed(() => (
  onboardingStore.isActive
  && onboardingStore.activeStep?.routeName === 'map'
));
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

function recordMapInteraction(type: string): void {
  void import('@/services/analyticsService')
    .then(({ analyticsPageEngagementTracker }) => {
      analyticsPageEngagementTracker.recordMapInteraction(type);
    })
    .catch(() => undefined);
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

function handleSidebarKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isMobileMapLayout.value && mobileSheetState.value !== 'peek') {
    setMobileSheetState('peek');
  }
}

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
.route-preview {
  display: grid;
  gap: var(--space-4);
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
  padding: var(--space-5);
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

.route-empty-state,
.sidebar-empty-state {
  align-self: stretch;
}

.sidebar-empty-state {
  min-block-size: 100%;
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
