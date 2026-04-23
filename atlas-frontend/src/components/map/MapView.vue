<template>
  <section class="map-view">
    <div ref="mapContainer" class="map-canvas" :class="{ 'is-fallback': !interactiveMapEnabled }" />

    <div v-if="!interactiveMapEnabled" class="map-fallback" data-test="map-fallback-stage">
      <svg class="map-fallback__canvas" viewBox="0 0 1200 900" preserveAspectRatio="none">
        <g class="map-fallback__terrain">
          <path v-for="terrainShape in fallbackTerrainPaths" :key="terrainShape" :d="terrainShape" />
        </g>

        <g class="map-fallback__rings">
          <circle v-for="ringRadius in fallbackRingSizes" :key="ringRadius" cx="842" cy="638" :r="ringRadius" />
        </g>

        <g v-if="fallbackRoutePath" class="map-fallback__route">
          <path :d="fallbackRoutePath" />
        </g>

        <g class="map-fallback__markers">
          <g
            v-for="marker in fallbackMarkers"
            :key="marker.id"
            class="map-fallback__marker"
            :class="[`is-${marker.category}`, { 'is-active': marker.isActive }]"
            :data-test="`map-fallback-marker-${marker.id}`"
          >
            <circle
              class="map-fallback__marker-hit-area"
              :cx="marker.x"
              :cy="marker.y"
              :r="marker.isActive ? 42 : 34"
              :data-test="`map-fallback-marker-hit-${marker.id}`"
              role="button"
              tabindex="0"
              :aria-label="`Open ${marker.title}`"
              @click="handleFallbackMarkerSelect(marker.id)"
              @keydown.enter.prevent="handleFallbackMarkerSelect(marker.id)"
              @keydown.space.prevent="handleFallbackMarkerSelect(marker.id)"
            />
            <circle class="map-fallback__marker-halo" :cx="marker.x" :cy="marker.y" :r="marker.isActive ? 34 : 24" />
            <circle class="map-fallback__marker-ring" :cx="marker.x" :cy="marker.y" :r="marker.isActive ? 15 : 12" />
            <circle class="map-fallback__marker-core" :cx="marker.x" :cy="marker.y" :r="marker.isActive ? 8 : 6" />

            <g v-if="marker.sequence !== null" class="map-fallback__sequence">
              <circle :cx="marker.x + 18" :cy="marker.y - 18" r="12" />
              <text :x="marker.x + 18" :y="marker.y - 14">{{ marker.sequence }}</text>
            </g>

            <g v-if="marker.showLabel" class="map-fallback__label">
              <rect :x="marker.labelX" :y="marker.labelY" :width="marker.labelWidth" height="30" rx="15" ry="15" />
              <text :x="marker.labelTextX" :y="marker.labelTextY">{{ marker.label }}</text>
            </g>
          </g>
        </g>
      </svg>
    </div>

    <div v-if="showSummary" class="map-summary glass-panel">
      <span>{{ visibleSpotCount }} pins in view</span>
      <span v-if="hasRoute">{{ routePoints.length }} route stops</span>
      <span>{{ mapStore.activeCategories.length }} filters active</span>
    </div>

    <LocationTracker
      v-if="showLocationTracker"
      ref="locationTracker"
      :auto-start="false"
      class="tracker-overlay"
      @tracking-state="handleTrackingState"
      @update:location="handleLocationUpdate"
    />

    <MapControls
      v-if="showControls"
      :categories="allCategories"
      :active-categories="mapStore.activeCategories"
      :route-ready="hasRoute"
      :tracking-state="trackingState"
      :interactive="interactiveMapEnabled"
      :show-filter-panel="showFilterPanel"
      @zoom-in="handleZoom(1)"
      @zoom-out="handleZoom(-1)"
      @locate="handleLocate"
      @fit-route="fitToRoute"
      @reset-filters="mapStore.resetCategories"
      @toggle-category="mapStore.toggleCategory"
    />

    <section v-if="!interactiveMapEnabled" class="empty-state glass-panel">
      <div>
        <p class="eyebrow">Mapbox token required</p>
        <h2>Drop your public token into <code>VITE_MAPBOX_TOKEN</code>.</h2>
        <p>
          Atlas will render the interactive map as soon as a Mapbox public token is available.
          The route, filters, and selected pins are already wired to the live map layer.
        </p>
      </div>
      <ul>
        <li>Theme-aware map styles are connected to the dark/light design system.</li>
        <li>Custom markers render category-specific icons and labels.</li>
        <li>Route overlays and live GPS tracking are ready once the token is supplied.</li>
      </ul>
    </section>

    <RouteLayer :map-instance="map" :points="routePoints" :style-key="mapStyle" :variant="routeVariant" />
  </section>
</template>

<script setup lang="ts">
import { createApp, computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type { App as VueApp, ComponentPublicInstance } from 'vue';
import type mapboxgl from 'mapbox-gl';
import ClusterMarker from '@/components/map/ClusterMarker.vue';
import MapControls from '@/components/map/MapControls.vue';
import LocationTracker from '@/components/map/LocationTracker.vue';
import RouteLayer from '@/components/map/RouteLayer.vue';
import SpotMarker from '@/components/map/SpotMarker.vue';
import {
  hasMapboxToken,
  loadConfiguredMapboxRuntime,
  resolveMapboxStyle,
} from '@/services/mapboxLoader';
import {
  calculateHaversineDistance,
  clusterViewportPoints,
  preloadAtlasWasmRuntime,
  type AtlasWasmViewport,
} from '@/services/wasmService';
import { useMapStore } from '@/stores/map';
import type { MapPoint, SpotCategory, UserLocation } from '@/types';
import { isUiTestEnvironment } from '@/utils/scheduleNonCriticalTask';

type TrackingState = 'idle' | 'locating' | 'tracking' | 'denied' | 'unsupported' | 'error';

type LocationTrackerInstance = ComponentPublicInstance & {
  focusUserLocation: () => UserLocation | null;
};

interface MarkerController {
  id: string;
  app: VueApp<Element>;
  marker: mapboxgl.Marker;
}

interface DistanceOrigin {
  id: string;
  latitude: number;
  longitude: number;
  mode: 'selected' | 'user';
}

interface SpotMarkerModel {
  kind: 'spot';
  id: string;
  spot: MapPoint;
  distanceLabel: string | null;
}

interface ClusterMarkerModel {
  kind: 'cluster';
  id: string;
  latitude: number;
  longitude: number;
  pointCount: number;
  pointIds: string[];
}

type ViewportMarkerModel = SpotMarkerModel | ClusterMarkerModel;

interface FallbackMarker {
  id: string;
  title: string;
  category: SpotCategory;
  x: number;
  y: number;
  label: string;
  labelX: number;
  labelY: number;
  labelTextX: number;
  labelTextY: number;
  labelWidth: number;
  sequence: number | null;
  isActive: boolean;
  showLabel: boolean;
}

const FALLBACK_VIEWPORT = {
  width: 1200,
  height: 900,
};
const LIVE_CLUSTER_RADIUS_PX = 72;
const LIVE_CLUSTER_MIN_POINTS = 2;

const fallbackTerrainPaths = [
  'M 54 142 C 148 74 298 56 422 118 C 534 176 586 292 560 384 C 526 510 380 562 268 618 C 198 652 146 734 88 712 C 30 690 38 590 26 484 C 16 390 -18 198 54 142 Z',
  'M 298 468 C 370 392 520 370 612 430 C 722 504 742 646 676 742 C 614 828 458 860 340 806 C 236 758 204 566 298 468 Z',
  'M 690 112 C 796 60 944 86 1034 178 C 1128 274 1146 444 1076 556 C 998 682 810 730 680 672 C 574 624 534 448 570 316 C 596 220 622 144 690 112 Z',
  'M 888 586 C 960 542 1050 556 1114 620 C 1182 690 1182 802 1106 850 C 1018 906 854 902 786 822 C 734 760 786 648 888 586 Z',
];
const fallbackRingSizes = [168, 248, 332];
const FALLBACK_MARKER_CLEARANCE = 54;
const FALLBACK_MARKER_PADDING = 26;
const FALLBACK_COORDINATE_PADDING_RATIO = 0.16;
const FALLBACK_MIN_COORDINATE_RANGE = 0.18;
const FALLBACK_HORIZONTAL_PADDING = 120;
const FALLBACK_VERTICAL_PADDING = 112;
const fallbackMarkerOffsets = [
  { x: 0, y: 0 },
  { x: 56, y: -24 },
  { x: -56, y: -24 },
  { x: 0, y: 56 },
  { x: 72, y: 24 },
  { x: -72, y: 24 },
  { x: 32, y: -72 },
  { x: -32, y: -72 },
  { x: 88, y: 0 },
  { x: -88, y: 0 },
  { x: 0, y: -96 },
  { x: 0, y: 96 },
] as const;

interface FallbackProjection {
  x: number;
  y: number;
}

interface FallbackProjectionBounds {
  minLongitude: number;
  maxLongitude: number;
  minLatitude: number;
  maxLatitude: number;
}

const props = withDefaults(
  defineProps<{
    spots: MapPoint[];
    routePoints?: MapPoint[];
    selectedSpotId?: string | null;
    showLocationTracker?: boolean;
    clickToSelect?: boolean;
    showFilterPanel?: boolean;
    showSummary?: boolean;
    showControls?: boolean;
    markerVariant?: 'default' | 'sequence';
    routeVariant?: 'default' | 'planner';
  }>(),
  {
    routePoints: () => [],
    selectedSpotId: null,
    showLocationTracker: true,
    clickToSelect: false,
    showFilterPanel: false,
    showSummary: true,
    showControls: true,
    markerVariant: 'default',
    routeVariant: 'default',
  },
);

const emit = defineEmits<{
  (event: 'spot-select', spot: MapPoint): void;
  (event: 'location-update', location: UserLocation): void;
  (event: 'map-click', payload: { latitude: number; longitude: number }): void;
  (event: 'interaction', payload: { type: string }): void;
}>();

const allCategories: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'scenic', 'other'];
const mapStore = useMapStore();
const mapContainer = ref<HTMLDivElement | null>(null);
const map = shallowRef<mapboxgl.Map | null>(null);
const mapboxRuntime = shallowRef<typeof mapboxgl | null>(null);
const locationTracker = ref<LocationTrackerInstance | null>(null);
const markerControllers = new Map<string, MarkerController>();
const userMarker = shallowRef<mapboxgl.Marker | null>(null);
const hasInitialFit = ref(false);
const shouldCenterOnNextFix = ref(false);
const trackingState = ref<TrackingState>('idle');
const hasToken = hasMapboxToken();
const interactiveMapEnabled = hasToken && !isUiTestEnvironment();
const mapStyle = ref(mapStore.viewport.style);

let themeObserver: MutationObserver | null = null;
let syncingViewport = false;
let markerRenderVersion = 0;
let cachedVisibleSpotIds: string[] = [];

function handleWindowResize() {
  map.value?.resize();
  void renderSpotMarkers();
}

const selectedSpotId = computed(() => props.selectedSpotId ?? mapStore.selectedSpotId);
const filteredSpots = computed(() => props.spots.filter((spot) => mapStore.activeCategories.includes(spot.category)));
const hasRoute = computed(() => props.routePoints.length > 1);
const visibleSpotCount = computed(() => mapStore.visibleSpotIds.length || filteredSpots.value.length);
const showSummary = computed(() => props.showSummary);
const showControls = computed(() => props.showControls);
const routeVariant = computed(() => props.routeVariant);
const routeOrderLookup = computed(() =>
  new Map(props.routePoints.map((point, index) => [point.id, index + 1])),
);
const fallbackMarkerSpots = computed(() => (filteredSpots.value.length ? filteredSpots.value : props.spots));
const fallbackProjectionBounds = computed<FallbackProjectionBounds>(() => {
  const projectionSpots = [...props.routePoints, ...props.spots];
  if (!projectionSpots.length) {
    return {
      minLongitude: -1,
      maxLongitude: 1,
      minLatitude: -1,
      maxLatitude: 1,
    };
  }

  const longitudes = projectionSpots.map((spot) => spot.longitude);
  const latitudes = projectionSpots.map((spot) => spot.latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const longitudePadding = Math.max((maxLongitude - minLongitude) * FALLBACK_COORDINATE_PADDING_RATIO, FALLBACK_MIN_COORDINATE_RANGE / 2);
  const latitudePadding = Math.max((maxLatitude - minLatitude) * FALLBACK_COORDINATE_PADDING_RATIO, FALLBACK_MIN_COORDINATE_RANGE / 2);

  return {
    minLongitude: minLongitude - longitudePadding,
    maxLongitude: maxLongitude + longitudePadding,
    minLatitude: minLatitude - latitudePadding,
    maxLatitude: maxLatitude + latitudePadding,
  };
});
const fallbackProjectedPoints = computed(() => {
  const projectionBySpotId = new Map<string, FallbackProjection>();
  const placedProjections: FallbackProjection[] = [];
  const uniqueProjectionSpots = [...props.routePoints, ...props.spots].filter((spot, index, collection) => (
    collection.findIndex((candidate) => candidate.id === spot.id) === index
  ));

  uniqueProjectionSpots.forEach((spot) => {
    const resolvedProjection = resolveFallbackProjection(projectFallbackPoint(spot, fallbackProjectionBounds.value), placedProjections);
    placedProjections.push(resolvedProjection);
    projectionBySpotId.set(spot.id, resolvedProjection);
  });

  return projectionBySpotId;
});
const fallbackMarkers = computed<FallbackMarker[]>(() => {
  const activeMarkerId = selectedSpotId.value ?? props.routePoints[0]?.id ?? fallbackMarkerSpots.value[0]?.id ?? null;

  return fallbackMarkerSpots.value.map((spot, index) => {
    const projection = fallbackProjectedPoints.value.get(spot.id) ?? projectFallbackPoint(spot, fallbackProjectionBounds.value);
    const label = (spot.city || spot.title).trim().slice(0, 22) || 'Atlas pin';
    const labelWidth = Math.min(Math.max(label.length * 8 + 30, 104), 180);
    const labelX = clampNumber(projection.x + 18, 18, FALLBACK_VIEWPORT.width - labelWidth - 18);
    const labelY = clampNumber(projection.y - 44, 18, FALLBACK_VIEWPORT.height - 48);
    const sequence = routeOrderLookup.value.get(spot.id) ?? null;
    const isActive = spot.id === activeMarkerId;

    return {
      id: spot.id,
      title: spot.title,
      category: spot.category,
      x: projection.x,
      y: projection.y,
      label,
      labelX,
      labelY,
      labelTextX: labelX + 16,
      labelTextY: labelY + 19,
      labelWidth,
      sequence,
      isActive,
      showLabel: isActive || sequence !== null || index < 3,
    };
  });
});
const fallbackRoutePath = computed(() => {
  if (props.routePoints.length < 2) {
    return '';
  }

  const projectedRoutePoints = props.routePoints.map((point) => fallbackProjectedPoints.value.get(point.id) ?? projectFallbackPoint(point, fallbackProjectionBounds.value));

  return projectedRoutePoints.reduce((pathSegments, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }

    const previousPoint = projectedRoutePoints[index - 1];
    const controlX = Number((((previousPoint.x + point.x) / 2)).toFixed(2));
    const controlY = Number((Math.max(56, Math.min(previousPoint.y, point.y) - 58)).toFixed(2));
    return `${pathSegments} Q ${controlX} ${controlY} ${point.x} ${point.y}`;
  }, '');
});

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function projectFallbackPoint(point: MapPoint, projectionBounds: FallbackProjectionBounds): FallbackProjection {
  const longitudeRange = Math.max(projectionBounds.maxLongitude - projectionBounds.minLongitude, FALLBACK_MIN_COORDINATE_RANGE);
  const latitudeRange = Math.max(projectionBounds.maxLatitude - projectionBounds.minLatitude, FALLBACK_MIN_COORDINATE_RANGE);
  const usableWidth = FALLBACK_VIEWPORT.width - FALLBACK_HORIZONTAL_PADDING * 2;
  const usableHeight = FALLBACK_VIEWPORT.height - FALLBACK_VERTICAL_PADDING * 2;
  const x = FALLBACK_HORIZONTAL_PADDING + (((point.longitude - projectionBounds.minLongitude) / longitudeRange) * usableWidth);
  const y = FALLBACK_VIEWPORT.height - FALLBACK_VERTICAL_PADDING - (((point.latitude - projectionBounds.minLatitude) / latitudeRange) * usableHeight);

  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
  };
}

function distanceBetweenFallbackPoints(firstPoint: FallbackProjection, secondPoint: FallbackProjection): number {
  return Math.hypot(firstPoint.x - secondPoint.x, firstPoint.y - secondPoint.y);
}

function resolveFallbackProjection(baseProjection: FallbackProjection, placedProjections: FallbackProjection[]): FallbackProjection {
  for (const offset of fallbackMarkerOffsets) {
    const candidateProjection = {
      x: clampNumber(baseProjection.x + offset.x, FALLBACK_MARKER_PADDING, FALLBACK_VIEWPORT.width - FALLBACK_MARKER_PADDING),
      y: clampNumber(baseProjection.y + offset.y, FALLBACK_MARKER_PADDING, FALLBACK_VIEWPORT.height - FALLBACK_MARKER_PADDING),
    };

    if (placedProjections.every((placedProjection) => distanceBetweenFallbackPoints(candidateProjection, placedProjection) >= FALLBACK_MARKER_CLEARANCE)) {
      return candidateProjection;
    }
  }

  return {
    x: clampNumber(baseProjection.x, FALLBACK_MARKER_PADDING, FALLBACK_VIEWPORT.width - FALLBACK_MARKER_PADDING),
    y: clampNumber(baseProjection.y, FALLBACK_MARKER_PADDING, FALLBACK_VIEWPORT.height - FALLBACK_MARKER_PADDING),
  };
}

function handleTrackingState(nextState: TrackingState) {
  trackingState.value = nextState;
}

function buildUserMarkerElement(): HTMLDivElement {
  const element = document.createElement('div');
  element.setAttribute('aria-hidden', 'true');
  element.style.width = '1.2rem';
  element.style.height = '1.2rem';
  element.style.borderRadius = '9999px';
  element.style.border = '3px solid var(--bg-primary)';
  element.style.background = 'var(--accent-teal)';
  element.style.boxShadow = '0 0 0 0.4rem var(--accent-teal-light)';
  return element;
}

function syncViewportFromMap() {
  const instance = map.value;
  if (!instance) {
    return;
  }

  const center = instance.getCenter();
  syncingViewport = true;
  mapStore.setCenter([center.lng, center.lat]);
  mapStore.setZoom(Number(instance.getZoom().toFixed(2)));
  syncingViewport = false;
}

function setVisibleSpotIds(spotIds: string[]) {
  cachedVisibleSpotIds = [...new Set(spotIds)];
  mapStore.setVisibleSpotIds(cachedVisibleSpotIds);
}

function getVisibleSpotsFromBounds(instance: mapboxgl.Map): MapPoint[] {
  const bounds = instance.getBounds();
  return filteredSpots.value.filter((spot) => bounds.contains([spot.longitude, spot.latitude]));
}

function buildViewport(instance: mapboxgl.Map): AtlasWasmViewport | null {
  const container = mapContainer.value ?? instance.getContainer();
  const width = container?.clientWidth ?? 0;
  const height = container?.clientHeight ?? 0;
  if (width <= 0 || height <= 0) {
    return null;
  }

  const bounds = instance.getBounds();
  return {
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth(),
    width,
    height,
    zoom: Number(instance.getZoom().toFixed(2)),
  };
}

function getDistanceOrigin(): DistanceOrigin | null {
  if (mapStore.userLocation) {
    return {
      id: 'user-location',
      latitude: mapStore.userLocation[1],
      longitude: mapStore.userLocation[0],
      mode: 'user',
    };
  }

  const activeSpot = selectedSpotId.value
    ? props.spots.find((spot) => spot.id === selectedSpotId.value) ?? null
    : null;

  if (!activeSpot) {
    return null;
  }

  return {
    id: activeSpot.id,
    latitude: activeSpot.latitude,
    longitude: activeSpot.longitude,
    mode: 'selected',
  };
}

function formatDistanceLabel(
  miles: number,
  meters: number,
  originMode: DistanceOrigin['mode'],
): string | null {
  if (miles <= 0.01) {
    return null;
  }

  if (miles >= 0.15) {
    const milesValue = miles >= 10 ? Math.round(miles).toString() : miles.toFixed(1).replace(/\.0$/, '');
    return originMode === 'user' ? `${milesValue} mi away` : `${milesValue} mi from selected`;
  }

  const roundedMeters = Math.max(25, Math.round(meters / 25) * 25);
  return originMode === 'user' ? `${roundedMeters} m away` : `${roundedMeters} m from selected`;
}

async function resolveDistanceLabels(spots: MapPoint[]): Promise<Map<string, string>> {
  const origin = getDistanceOrigin();
  if (!origin) {
    return new Map();
  }

  const distanceEntries = await Promise.all(spots.map(async (spot) => {
    if (spot.id === origin.id) {
      return null;
    }

    const distance = await calculateHaversineDistance(origin, spot);
    if (!distance.valid) {
      return null;
    }

    const label = formatDistanceLabel(distance.miles, distance.meters, origin.mode);
    return label ? [spot.id, label] as const : null;
  }));

  return new Map(
    distanceEntries.filter((entry): entry is readonly [string, string] => Boolean(entry)),
  );
}

function buildSpotMarkerModels(spots: MapPoint[], distanceLabels: Map<string, string>): SpotMarkerModel[] {
  return spots.map((spot) => ({
    kind: 'spot',
    id: spot.id,
    spot,
    distanceLabel: distanceLabels.get(spot.id) ?? null,
  }));
}

async function buildViewportMarkerModels(instance: mapboxgl.Map): Promise<{
  markers: ViewportMarkerModel[];
  visibleSpotIds: string[];
}> {
  const visibleSpots = getVisibleSpotsFromBounds(instance);
  const fallbackVisibleIds = visibleSpots.map((spot) => spot.id);

  if (!visibleSpots.length) {
    return {
      markers: [],
      visibleSpotIds: [],
    };
  }

  if (props.markerVariant === 'sequence') {
    const distanceLabels = await resolveDistanceLabels(visibleSpots);
    return {
      markers: buildSpotMarkerModels(visibleSpots, distanceLabels),
      visibleSpotIds: fallbackVisibleIds,
    };
  }

  const viewport = buildViewport(instance);
  if (!viewport) {
    const distanceLabels = await resolveDistanceLabels(visibleSpots);
    return {
      markers: buildSpotMarkerModels(visibleSpots, distanceLabels),
      visibleSpotIds: fallbackVisibleIds,
    };
  }

  const clusteredEntries = await clusterViewportPoints(filteredSpots.value, viewport, {
    radiusPx: LIVE_CLUSTER_RADIUS_PX,
    minPoints: LIVE_CLUSTER_MIN_POINTS,
    includeSingles: true,
  });

  const spotLookup = new Map(filteredSpots.value.map((spot) => [spot.id, spot]));
  const singletonSpots = clusteredEntries
    .filter((entry) => !entry.clustered)
    .map((entry) => spotLookup.get(entry.pointIds[0]) ?? null)
    .filter((spot): spot is MapPoint => Boolean(spot));
  const distanceLabels = await resolveDistanceLabels(singletonSpots);

  return {
    markers: clusteredEntries.flatMap<ViewportMarkerModel>((entry) => {
      if (!entry.clustered) {
        const spot = spotLookup.get(entry.pointIds[0]);
        if (!spot) {
          return [];
        }

        return [{
          kind: 'spot',
          id: spot.id,
          spot,
          distanceLabel: distanceLabels.get(spot.id) ?? null,
        }];
      }

      return [{
        kind: 'cluster',
        id: entry.id,
        latitude: entry.latitude,
        longitude: entry.longitude,
        pointCount: entry.pointCount,
        pointIds: [...entry.pointIds],
      }];
    }),
    visibleSpotIds: clusteredEntries.flatMap((entry) => entry.pointIds),
  };
}

function updateVisibleSpotIds() {
  const instance = map.value;
  if (!instance || !interactiveMapEnabled) {
    setVisibleSpotIds(filteredSpots.value.map((spot) => spot.id));
    return;
  }

  if (cachedVisibleSpotIds.length || !filteredSpots.value.length) {
    mapStore.setVisibleSpotIds(cachedVisibleSpotIds);
    return;
  }

  setVisibleSpotIds(getVisibleSpotsFromBounds(instance).map((spot) => spot.id));
}

function clearSpotMarkers() {
  markerControllers.forEach(({ app, marker }) => {
    marker.remove();
    app.unmount();
  });
  markerControllers.clear();
}

function handleSpotSelect(spot: MapPoint) {
  mapStore.setSelectedSpotId(spot.id);
  emit('spot-select', spot);
}

function handleFallbackMarkerSelect(markerId: string) {
  const fallbackSpot = fallbackMarkerSpots.value.find((spot) => spot.id === markerId);
  if (!fallbackSpot) {
    return;
  }

  handleSpotSelect(fallbackSpot);
}

function handleClusterSelect(pointIds: string[]) {
  emit('interaction', { type: 'cluster_focus' });
  const pointIdsSet = new Set(pointIds);
  fitToPoints(filteredSpots.value.filter((spot) => pointIdsSet.has(spot.id)));
}

async function renderSpotMarkers() {
  const renderVersion = ++markerRenderVersion;
  cachedVisibleSpotIds = [];
  const instance = map.value;
  const runtime = mapboxRuntime.value;
  if (!instance || !runtime || !interactiveMapEnabled) {
    clearSpotMarkers();
    updateVisibleSpotIds();
    return;
  }

  let nextMarkers: ViewportMarkerModel[] = [];
  let nextVisibleSpotIds: string[] = [];

  try {
    const markerState = await buildViewportMarkerModels(instance);
    nextMarkers = markerState.markers;
    nextVisibleSpotIds = markerState.visibleSpotIds;
  } catch {
    const fallbackVisibleSpots = getVisibleSpotsFromBounds(instance);
    const distanceLabels = await resolveDistanceLabels(fallbackVisibleSpots);
    nextMarkers = buildSpotMarkerModels(fallbackVisibleSpots, distanceLabels);
    nextVisibleSpotIds = fallbackVisibleSpots.map((spot) => spot.id);
  }

  if (renderVersion !== markerRenderVersion) {
    return;
  }

  clearSpotMarkers();
  setVisibleSpotIds(nextVisibleSpotIds);

  nextMarkers.forEach((markerModel) => {
    const mountTarget = document.createElement('div');
    const app = markerModel.kind === 'spot'
      ? createApp(SpotMarker, {
        spot: markerModel.spot,
        active: selectedSpotId.value === markerModel.id,
        variant: props.markerVariant,
        sequence: routeOrderLookup.value.get(markerModel.id) ?? null,
        distanceLabel: markerModel.distanceLabel,
        onSelect: () => handleSpotSelect(markerModel.spot),
      })
      : createApp(ClusterMarker, {
        pointCount: markerModel.pointCount,
        dataTestId: `map-cluster-marker-${markerModel.id}`,
        onSelect: () => handleClusterSelect(markerModel.pointIds),
      });

    app.mount(mountTarget);

    const marker = new runtime.Marker({
      element: mountTarget,
      anchor: markerModel.kind === 'spot' ? 'bottom' : 'center',
    })
      .setLngLat(
        markerModel.kind === 'spot'
          ? [markerModel.spot.longitude, markerModel.spot.latitude]
          : [markerModel.longitude, markerModel.latitude],
      )
      .addTo(instance);

    markerControllers.set(markerModel.id, { id: markerModel.id, app, marker });
  });
}

function fitToPoints(points: MapPoint[]) {
  const instance = map.value;
  const runtime = mapboxRuntime.value;
  if (!instance || !runtime || !points.length || !interactiveMapEnabled) {
    return;
  }

  if (points.length === 1) {
    instance.easeTo({
      center: [points[0].longitude, points[0].latitude],
      zoom: 13,
      duration: 600,
    });
    return;
  }

  const bounds = new runtime.LngLatBounds();
  points.forEach((point) => bounds.extend([point.longitude, point.latitude]));
  instance.fitBounds(bounds, {
    padding: 96,
    duration: 800,
    maxZoom: 12,
  });
}

function fitToRoute() {
  emit('interaction', { type: 'fit_route' });
  fitToPoints(props.routePoints.length > 1 ? props.routePoints : filteredSpots.value);
}

function handleZoom(delta: number) {
  const instance = map.value;
  if (!instance || !interactiveMapEnabled) {
    return;
  }

  emit('interaction', { type: delta > 0 ? 'zoom_in' : 'zoom_out' });
  instance.easeTo({
    zoom: Math.min(Math.max(instance.getZoom() + delta, 2), 18),
    duration: 250,
  });
}

function centerOnLocation(location: UserLocation) {
  const instance = map.value;
  if (!instance || !interactiveMapEnabled) {
    return;
  }

  instance.easeTo({
    center: [location.longitude, location.latitude],
    zoom: Math.max(instance.getZoom(), 12),
    duration: 650,
  });
}

function handleLocate() {
  emit('interaction', { type: 'locate' });

  const location = locationTracker.value?.focusUserLocation() ?? null;
  if (location) {
    centerOnLocation(location);
    return;
  }

  shouldCenterOnNextFix.value = true;
}

function handleLocationUpdate(location: UserLocation) {
  const instance = map.value;
  const runtime = mapboxRuntime.value;
  mapStore.setUserLocation([location.longitude, location.latitude]);
  emit('location-update', location);

  if (instance && runtime && interactiveMapEnabled) {
    if (!userMarker.value) {
      userMarker.value = new runtime.Marker({
        element: buildUserMarkerElement(),
        anchor: 'center',
      }).setLngLat([location.longitude, location.latitude]).addTo(instance);
    } else {
      userMarker.value.setLngLat([location.longitude, location.latitude]);
    }
  }

  if (shouldCenterOnNextFix.value) {
    centerOnLocation(location);
    shouldCenterOnNextFix.value = false;
  }

  void renderSpotMarkers();
}

function syncThemeToMap() {
  mapStyle.value = resolveMapboxStyle(mapStore.viewport.style);
  mapStore.setStyle(mapStyle.value);

  if (map.value && interactiveMapEnabled && map.value.getStyle().sprite !== undefined) {
    map.value.setStyle(mapStyle.value);
  }
}

async function setupMap() {
  if (!mapContainer.value || !interactiveMapEnabled || map.value) {
    updateVisibleSpotIds();
    return;
  }

  const runtime = await loadConfiguredMapboxRuntime();
  mapboxRuntime.value = runtime;
  if (!mapContainer.value || map.value) {
    updateVisibleSpotIds();
    return;
  }

  mapStyle.value = resolveMapboxStyle(mapStore.viewport.style);
  mapStore.setStyle(mapStyle.value);

  const instance = new runtime.Map({
    container: mapContainer.value,
    style: mapStyle.value,
    center: mapStore.viewport.center,
    zoom: mapStore.viewport.zoom,
    attributionControl: false,
  });

  instance.on('click', (event) => {
    if (!props.clickToSelect) {
      return;
    }

    emit('interaction', { type: 'map_click' });
    emit('map-click', {
      latitude: Number(event.lngLat.lat.toFixed(6)),
      longitude: Number(event.lngLat.lng.toFixed(6)),
    });
  });

  instance.on('load', () => {
    void renderSpotMarkers();
  });
  instance.on('moveend', () => {
    syncViewportFromMap();
    void renderSpotMarkers();
  });
  instance.on('idle', updateVisibleSpotIds);

  map.value = instance;
}

watch(
  () => props.selectedSpotId,
  (nextSelectedSpotId) => {
    if (nextSelectedSpotId) {
      mapStore.setSelectedSpotId(nextSelectedSpotId);
    }
  },
  { immediate: true },
);

watch(
  () => filteredSpots.value.map((spot) => `${spot.id}:${spot.latitude}:${spot.longitude}`),
  () => {
    if (!filteredSpots.value.some((spot) => spot.id === selectedSpotId.value)) {
      mapStore.setSelectedSpotId(filteredSpots.value[0]?.id ?? null);
    }

    nextTick(() => {
      void renderSpotMarkers();
    });
  },
  { immediate: true },
);

watch(
  () => selectedSpotId.value,
  (nextSelectedSpotId, previousSelectedSpotId) => {
    if (!nextSelectedSpotId) {
      void renderSpotMarkers();
      return;
    }

    if (nextSelectedSpotId !== previousSelectedSpotId) {
      const selectedSpot = props.spots.find((spot) => spot.id === nextSelectedSpotId);
      if (selectedSpot && map.value && interactiveMapEnabled) {
        map.value.easeTo({
          center: [selectedSpot.longitude, selectedSpot.latitude],
          duration: 500,
        });
      }
    }

    void renderSpotMarkers();
  },
);

watch(
  () => [mapStore.viewport.center[0], mapStore.viewport.center[1], mapStore.viewport.zoom] as const,
  ([longitude, latitude, zoom]) => {
    const instance = map.value;
    if (!instance || syncingViewport || !interactiveMapEnabled) {
      return;
    }

    const center = instance.getCenter();
    const zoomDistance = Math.abs(instance.getZoom() - zoom);
    const longitudeDistance = Math.abs(center.lng - longitude);
    const latitudeDistance = Math.abs(center.lat - latitude);

    if (zoomDistance > 0.05 || longitudeDistance > 0.0001 || latitudeDistance > 0.0001) {
      instance.easeTo({
        center: [longitude, latitude],
        zoom,
        duration: 300,
      });
    }
  },
);

watch(
  () => [map.value, props.routePoints.length, props.spots.length] as const,
  () => {
    if (hasInitialFit.value || !map.value || !interactiveMapEnabled) {
      return;
    }

    const targetPoints = props.routePoints.length > 1 ? props.routePoints : filteredSpots.value;
    if (!targetPoints.length) {
      return;
    }

    fitToPoints(targetPoints);
    hasInitialFit.value = true;
  },
  { immediate: true },
);

onMounted(() => {
  if (interactiveMapEnabled) {
    void preloadAtlasWasmRuntime();
  }
  void setupMap();
  themeObserver = new MutationObserver(syncThemeToMap);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  window.addEventListener('resize', handleWindowResize);
});

onBeforeUnmount(() => {
  markerRenderVersion += 1;
  cachedVisibleSpotIds = [];
  themeObserver?.disconnect();
  themeObserver = null;
  window.removeEventListener('resize', handleWindowResize);
  clearSpotMarkers();
  userMarker.value?.remove();
  userMarker.value = null;
  map.value?.remove();
  map.value = null;
});
</script>

<style scoped>
.map-view {
  position: relative;
  min-height: 100%;
  border-radius: var(--radius-2xl);
  overflow: hidden;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent-teal) 22%, transparent), transparent 32%),
    radial-gradient(circle at bottom right, color-mix(in srgb, var(--accent-gold) 18%, transparent), transparent 28%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-tertiary) 100%, transparent), color-mix(in srgb, var(--bg-secondary) 100%, transparent));
}

.map-view--mobile {
  border-radius: 0;
}

.map-canvas,
.map-fallback {
  position: absolute;
  inset: 0;
}

.map-canvas.is-fallback {
  background:
    radial-gradient(circle at 16% 20%, color-mix(in srgb, var(--accent-teal) 18%, transparent), transparent 28%),
    radial-gradient(circle at 78% 76%, color-mix(in srgb, var(--accent-gold) 16%, transparent), transparent 24%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-tertiary) 98%, transparent), color-mix(in srgb, var(--bg-secondary) 100%, transparent));
}

.map-fallback {
  pointer-events: none;
  z-index: 1;
}

.map-fallback__canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.map-fallback__terrain path {
  fill: color-mix(in srgb, var(--text-secondary) 10%, transparent);
  stroke: color-mix(in srgb, var(--glass-border) 85%, transparent);
  stroke-width: 2;
}

.map-fallback__rings circle {
  fill: none;
  stroke: color-mix(in srgb, var(--glass-border) 72%, transparent);
  stroke-width: 1;
  stroke-dasharray: 14 18;
}

.map-fallback__route path {
  fill: none;
  stroke: color-mix(in srgb, var(--accent-teal) 72%, transparent);
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 12 14;
  filter: drop-shadow(0 0 16px color-mix(in srgb, var(--accent-teal) 22%, transparent));
}

.map-fallback__marker {
  color: var(--accent-teal);
}

.map-fallback__marker-hit-area {
  fill: transparent;
  cursor: pointer;
  pointer-events: all;
}

.map-fallback__marker-hit-area:focus-visible {
  outline: none;
}

.map-fallback__marker-hit-area:focus-visible + .map-fallback__marker-halo {
  fill: color-mix(in srgb, currentColor 22%, transparent);
  opacity: 1;
}

.map-fallback__marker-hit-area:focus-visible + .map-fallback__marker-halo + .map-fallback__marker-ring {
  stroke: color-mix(in srgb, var(--text-primary) 80%, currentColor);
  stroke-width: 3.5;
}

.map-fallback__marker-hit-area:focus-visible + .map-fallback__marker-halo + .map-fallback__marker-ring + .map-fallback__marker-core {
  fill: color-mix(in srgb, currentColor 92%, var(--text-primary));
}

.map-fallback__marker.is-food {
  color: var(--accent-teal);
}

.map-fallback__marker.is-nature {
  color: var(--success);
}

.map-fallback__marker.is-nightlife {
  color: color-mix(in srgb, var(--info) 55%, var(--bg-tertiary));
}

.map-fallback__marker.is-culture {
  color: var(--info);
}

.map-fallback__marker.is-adventure {
  color: var(--accent-gold);
}

.map-fallback__marker.is-shopping {
  color: color-mix(in srgb, var(--accent-gold) 40%, var(--accent-teal));
}

.map-fallback__marker.is-scenic {
  color: color-mix(in srgb, var(--accent-teal) 62%, var(--info));
}

.map-fallback__marker.is-other {
  color: var(--text-secondary);
}

.map-fallback__marker-halo,
.map-fallback__marker-ring,
.map-fallback__marker-core,
.map-fallback__label rect,
.map-fallback__sequence circle {
  transition:
    transform var(--transition-normal),
    opacity var(--transition-normal),
    fill var(--transition-normal),
    stroke var(--transition-normal);
}

.map-fallback__marker-halo {
  fill: color-mix(in srgb, currentColor 18%, transparent);
  opacity: 0.65;
}

.map-fallback__marker-ring {
  fill: color-mix(in srgb, var(--bg-secondary) 88%, transparent);
  stroke: color-mix(in srgb, currentColor 85%, transparent);
  stroke-width: 2.5;
}

.map-fallback__marker-core {
  fill: currentColor;
}

.map-fallback__marker.is-active .map-fallback__marker-halo {
  fill: color-mix(in srgb, currentColor 26%, transparent);
  opacity: 1;
}

.map-fallback__marker.is-active .map-fallback__marker-ring {
  stroke: color-mix(in srgb, currentColor 100%, var(--text-primary));
}

.map-fallback__label rect,
.map-fallback__sequence circle {
  fill: color-mix(in srgb, var(--glass-bg) 96%, transparent);
  stroke: color-mix(in srgb, currentColor 55%, var(--glass-border));
  stroke-width: 1;
}

.map-fallback__label text,
.map-fallback__sequence text {
  fill: var(--text-primary);
  font-size: 0.8rem;
  font-weight: var(--font-weight-semibold);
}

.map-fallback__label text {
  dominant-baseline: middle;
}

.map-fallback__sequence text {
  font-size: 0.72rem;
  text-anchor: middle;
}

.map-summary,
.tracker-overlay {
  position: absolute;
  left: var(--space-4);
  z-index: var(--z-sidebar);
}

.map-summary {
  top: var(--space-4);
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.map-summary span + span {
  position: relative;
}

.map-summary span + span::before {
  content: '•';
  margin-right: var(--space-3);
  color: var(--text-muted);
}

.tracker-overlay {
  bottom: var(--space-4);
}

.empty-state {
  position: absolute;
  inset: 50% auto auto 50%;
  width: min(28rem, calc(100% - 4rem));
  transform: translate(-10%, -50%);
  z-index: var(--z-sidebar);
  padding: var(--space-5);
  display: grid;
  gap: var(--space-4);
  background: color-mix(in srgb, var(--glass-bg) 92%, transparent);
  box-shadow: var(--shadow-lg);
}

.empty-state h2 {
  margin: 0 0 var(--space-3);
  font-size: var(--font-size-h2);
}

.empty-state p,
.empty-state li {
  color: var(--text-secondary);
  line-height: var(--line-height-relaxed);
}

.empty-state ul {
  margin: 0;
  padding-left: 1.25rem;
  display: grid;
  gap: var(--space-2);
}

.map-view--mobile .map-summary {
  top: var(--space-3);
  left: var(--space-3);
  right: auto;
  max-width: calc(100% - 6.75rem);
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
}

.map-view--mobile .tracker-overlay {
  display: none;
}

.map-view--mobile .empty-state {
  left: 50%;
  right: auto;
  width: min(24rem, calc(100% - 2rem));
  transform: translate(-50%, -50%);
}

.eyebrow {
  margin: 0 0 var(--space-2);
  font-size: var(--font-size-caption);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent-teal);
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  padding: 0.15rem 0.35rem;
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
}

@media (prefers-reduced-motion: no-preference) {
  .map-fallback__marker.is-active .map-fallback__marker-halo {
    animation: map-fallback-pulse 2.4s ease-in-out infinite;
  }
}

@media (prefers-reduced-motion: reduce) {
  .map-fallback__marker-halo,
  .map-fallback__marker-ring,
  .map-fallback__marker-core,
  .map-fallback__label rect,
  .map-fallback__sequence circle,
  .map-fallback__route path {
    transition: none;
    animation: none;
  }
}

@media (max-width: 960px) {
  .map-summary,
  .tracker-overlay {
    left: var(--space-3);
  }

  .map-summary {
    top: var(--space-3);
    max-width: calc(100% - 7rem);
  }

  .tracker-overlay {
    bottom: 19rem;
  }

  .empty-state {
    left: var(--space-3);
    right: var(--space-3);
    width: auto;
    transform: translate(0, -50%);
  }

  .map-view--mobile .map-summary {
    max-width: calc(100% - 6.75rem);
  }

  .map-view--mobile .tracker-overlay {
    display: none;
  }

  .map-view--mobile .empty-state {
    left: 50%;
    right: auto;
    width: min(24rem, calc(100% - 2rem));
    transform: translate(-50%, -50%);
  }
}

@keyframes map-fallback-pulse {
  0%,
  100% {
    opacity: 0.45;
  }

  50% {
    opacity: 1;
  }
}
</style>
