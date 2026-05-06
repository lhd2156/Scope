<template>
  <section class="map-view" :class="{ 'map-view--pick-mode': clickToSelect }">
    <div
      ref="mapContainer"
      class="map-canvas"
      :class="{ 'is-fallback': !interactiveMapEnabled }"
      @click="handleMapCanvasClick"
    />

    <div v-if="!interactiveMapEnabled" class="map-fallback" data-test="map-fallback-stage">
      <svg class="map-fallback__canvas" viewBox="0 0 1200 900" preserveAspectRatio="none" @click="handleFallbackCanvasClick">
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
              @click.stop="handleFallbackMarkerClick(marker)"
              @keydown.enter.prevent="handleFallbackMarkerClick(marker)"
              @keydown.space.prevent="handleFallbackMarkerClick(marker)"
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

    <svg
      v-if="interactiveMapEnabled && liveRouteOverlayPath"
      class="map-live-route-overlay"
      :viewBox="`0 0 ${liveRouteOverlaySize.width} ${liveRouteOverlaySize.height}`"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path class="map-live-route-overlay__outline" :d="liveRouteOverlayPath" />
      <path class="map-live-route-overlay__line" :d="liveRouteOverlayPath" />
    </svg>

    <div v-if="showSummary" class="map-summary glass-panel" aria-label="Map summary">
      <span class="map-summary__item" data-test="map-summary-pins">
        <ScopeIcon name="pin" label="Pins in view" />
        <span>{{ visibleSpotCount }} pins in view</span>
      </span>
      <span class="map-summary__item" data-test="map-summary-filters">
        <ScopeIcon name="filter" label="Filters active" />
        <span>{{ mapStore.activeCategories.length }} filters active</span>
      </span>
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
      :show-fit-route-control="showFitRouteControl"
      @zoom-in="handleZoom(1)"
      @zoom-out="handleZoom(-1)"
      @locate="handleLocate"
      @reset-map="handleResetMap"
      @fit-route="fitToRoute"
      @reset-filters="mapStore.resetCategories"
      @toggle-category="mapStore.toggleCategory"
    />

    <section v-if="!interactiveMapEnabled" class="empty-state">
      <div class="empty-state__icon" aria-hidden="true">
        <ScopeIcon name="map" />
      </div>
      <div class="empty-state__copy">
        <p class="eyebrow">Interactive map offline</p>
        <h2>Connect Mapbox to light up live tiles</h2>
        <p>
          Scope is running without a Mapbox token, so the satellite preview below is a stylised
          fallback. The sidebar, filters, and routes still work — add
          <code>VITE_MAPBOX_TOKEN</code> to your environment to unlock the full live map.
        </p>
      </div>
    </section>

    <RouteLayer
      :map-instance="map"
      :points="routePoints"
      :coordinates="routeShapeCoordinates"
      :style-key="mapStyle"
      :variant="routeVariant"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, h, nextTick, onBeforeUnmount, onMounted, ref, render, shallowRef, watch } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import type mapboxgl from 'mapbox-gl';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import ClusterMarker from '@/components/map/ClusterMarker.vue';
import MapControls from '@/components/map/MapControls.vue';
import LocationTracker from '@/components/map/LocationTracker.vue';
import RouteLayer from '@/components/map/RouteLayer.vue';
import SpotMarker from '@/components/map/SpotMarker.vue';
import { cloneMapViewport } from '@/config/mapViewport';
import {
  buildMapPointRenderKey,
  getPinCountRepresentedByViewportMarkers,
  getSpotIdsRepresentedByViewportMarkers,
  getSpotIdsRepresentedByVisibleViewportMarkers,
  getViewportMarkerCoordinates,
  getViewportMarkerSignature,
  getViewportMarkerZIndex,
  planViewportMarkerReconciliation,
  type MarkerRenderContext,
  type SpotMarkerModel,
  type ViewportMarkerModel,
} from '@/components/map/mapMarkerState';
import { getMapPointsInsideViewport } from '@/components/map/mapViewportVisibility';
import {
  hasMapboxToken,
  loadConfiguredMapboxRuntime,
  resolveMapboxStyle,
} from '@/services/mapboxLoader';
import {
  resolveRoadRoute,
  type RoadRouteSummary,
  type RouteCoordinate,
} from '@/services/roadRouteService';
import {
  calculateHaversineDistance,
  clusterViewportPoints,
  preloadScopeWasmRuntime,
  type ScopeWasmClusterResult,
  type ScopeWasmViewport,
} from '@/services/wasmService';
import { DEFAULT_MAP_VIEWPORT, useMapStore } from '@/stores/map';
import type { MapPoint, MapViewport, SpotCategory, UserLocation } from '@/types';
import { isUiTestEnvironment } from '@/utils/scheduleNonCriticalTask';

type TrackingState = 'idle' | 'locating' | 'tracking' | 'denied' | 'unsupported' | 'error';

type LocationTrackerInstance = ComponentPublicInstance & {
  focusUserLocation: () => UserLocation | null;
};

interface MarkerController {
  id: string;
  kind: ViewportMarkerModel['kind'];
  mountTarget: HTMLDivElement;
  marker: mapboxgl.Marker;
  signature: string;
}

interface DistanceOrigin {
  id: string;
  latitude: number;
  longitude: number;
  mode: 'selected' | 'user';
}

interface FallbackMarker {
  id: string;
  title: string;
  category: SpotCategory;
  latitude: number;
  longitude: number;
  x: number;
  y: number;
  label: string;
  labelX: number;
  labelY: number;
  labelTextX: number;
  labelTextY: number;
  labelWidth: number;
  sequence: string | number | null;
  isActive: boolean;
  showLabel: boolean;
}

const FALLBACK_VIEWPORT = {
  width: 1200,
  height: 900,
};
const LIVE_CLUSTER_RADIUS_PX = 72;
const LIVE_CLUSTER_MIN_POINTS = 2;
const LIVE_MARKER_VISIBILITY_BUFFER_PX = 96;
const VISIBLE_MARKER_MIN_INTERSECTION_PX = 14;
const MAX_LIVE_ROUTE_OVERLAY_COORDINATES = 240;

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
    routeGeometry?: RouteCoordinate[];
    autoResolveRouteGeometry?: boolean;
    optimizeRouteOrder?: boolean;
    selectedSpotId?: string | null;
    showLocationTracker?: boolean;
    clickToSelect?: boolean;
    initialViewport?: MapViewport;
    showFilterPanel?: boolean;
    showSummary?: boolean;
    showControls?: boolean;
    showFitRouteControl?: boolean;
    showPlaceLabels?: boolean;
    markerVariant?: 'default' | 'sequence';
    routeVariant?: 'default' | 'planner';
  }>(),
  {
    routePoints: () => [],
    routeGeometry: () => [],
    autoResolveRouteGeometry: true,
    optimizeRouteOrder: false,
    selectedSpotId: null,
    showLocationTracker: true,
    clickToSelect: false,
    showFilterPanel: false,
    showSummary: true,
    showControls: true,
    showFitRouteControl: true,
    showPlaceLabels: false,
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
const initialFitSignature = ref('');
const shouldCenterOnNextFix = ref(false);
const trackingState = ref<TrackingState>('idle');
const liveRouteOverlayPath = ref('');
const liveRouteOverlaySize = ref({ width: 1, height: 1 });
const measuredVisiblePinCount = ref<number | null>(null);
const autoRoadRoute = ref<{ signature: string; summary: RoadRouteSummary } | null>(null);
const hasToken = hasMapboxToken();
const interactiveMapEnabled = ref(hasToken && !isUiTestEnvironment());
const mapStyle = ref(mapStore.viewport.style);

function markMapRuntimeFailed(): void {
  cancelScheduledMarkerRender();
  clearSpotMarkers();
  liveRouteOverlayPath.value = '';
  if (interactiveMapEnabled.value) {
    interactiveMapEnabled.value = false;
  }
}

let themeObserver: MutationObserver | null = null;
let syncingViewport = false;
let markerRenderVersion = 0;
let markerRenderRequestId = 0;
let markerRenderFrameHandle: number | null = null;
let isMarkerRenderQueued = false;
let autoRoadRouteRequestId = 0;
let containerResizeObserver: ResizeObserver | null = null;

function handleWindowResize() {
  map.value?.resize();
  updateLiveRouteOverlay();
  scheduleMarkerRender();
}

function handleMapContainerResize() {
  map.value?.resize();
  updateLiveRouteOverlay();
  scheduleMarkerRender();
}

const selectedSpotId = computed(() => props.selectedSpotId ?? mapStore.selectedSpotId);
const filteredSpots = computed(() => props.spots.filter((spot) => mapStore.activeCategories.includes(spot.category)));
const spotLookup = computed(() => new Map(props.spots.map((spot) => [spot.id, spot])));
const filteredSpotLookup = computed(() => new Map(filteredSpots.value.map((spot) => [spot.id, spot])));
const selectedSpot = computed(() => {
  const currentSelectedSpotId = selectedSpotId.value;
  return currentSelectedSpotId ? spotLookup.value.get(currentSelectedSpotId) ?? null : null;
});
const hasRoute = computed(() => props.routePoints.length > 1);
const visibleSpotCount = computed(() => (
  mapStore.visibleSpotIdsMeasured
    ? (measuredVisiblePinCount.value ?? mapStore.visibleSpotIds.length)
    : (interactiveMapEnabled.value ? 0 : filteredSpots.value.length)
));
const showSummary = computed(() => props.showSummary);
const showControls = computed(() => props.showControls);
const routeVariant = computed(() => props.routeVariant);
const routeOrderLookup = computed(() => buildRouteOrderLookup(props.routePoints));
const routePointGeometrySignature = computed(() =>
  props.routePoints.filter(hasValidCoordinates).map(buildMapPointRenderKey).join('|'),
);
const routeShapeCoordinates = computed<RouteCoordinate[]>(() => {
  const roadCoordinates = props.routeGeometry.filter(hasValidRouteCoordinate);
  if (roadCoordinates.length > 1) {
    return roadCoordinates;
  }

  const autoCoordinates = autoRoadRoute.value?.signature === routePointGeometrySignature.value
    ? autoRoadRoute.value.summary.geometry.filter(hasValidRouteCoordinate)
    : [];
  if (autoCoordinates.length > 1) {
    return autoCoordinates;
  }

  return props.routePoints
    .filter(hasValidCoordinates)
    .map((point): RouteCoordinate => [point.longitude, point.latitude]);
});
const fallbackMarkerSpots = computed(() => (filteredSpots.value.length ? filteredSpots.value : props.spots));
const fallbackProjectionBounds = computed<FallbackProjectionBounds>(() => {
  const projectionCoordinates = [
    ...routeShapeCoordinates.value,
    ...props.routePoints.map((point): RouteCoordinate => [point.longitude, point.latitude]),
    ...props.spots.map((point): RouteCoordinate => [point.longitude, point.latitude]),
  ].filter(hasValidRouteCoordinate);

  if (!projectionCoordinates.length) {
    return buildFallbackViewportBounds();
  }

  const longitudes = projectionCoordinates.map(([longitude]) => longitude);
  const latitudes = projectionCoordinates.map(([, latitude]) => latitude);
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
    const label = (spot.city || spot.title).trim().slice(0, 22) || 'Scope pin';
    const labelWidth = Math.min(Math.max(label.length * 8 + 30, 104), 180);
    const labelX = clampNumber(projection.x + 18, 18, FALLBACK_VIEWPORT.width - labelWidth - 18);
    const labelY = clampNumber(projection.y - 44, 18, FALLBACK_VIEWPORT.height - 48);
    const sequence = routeOrderLookup.value.get(spot.id) ?? null;
    const isActive = spot.id === activeMarkerId;

    return {
      id: spot.id,
      title: spot.title,
      category: spot.category,
      latitude: spot.latitude,
      longitude: spot.longitude,
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
  const routeCoordinates = routeShapeCoordinates.value;
  if (routeCoordinates.length < 2) {
    return '';
  }

  const projectedRoutePoints = routeCoordinates.map((coordinate) => projectFallbackCoordinate(coordinate, fallbackProjectionBounds.value));

  return projectedRoutePoints.reduce((pathSegments, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }

    return `${pathSegments} L ${point.x} ${point.y}`;
  }, '');
});

function queueMicrotaskSafe(task: () => void) {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(task);
    return;
  }

  Promise.resolve().then(task);
}

function cancelScheduledMarkerRender() {
  markerRenderRequestId += 1;
  isMarkerRenderQueued = false;

  if (typeof window !== 'undefined' && markerRenderFrameHandle !== null) {
    window.cancelAnimationFrame(markerRenderFrameHandle);
  }

  markerRenderFrameHandle = null;
}

function updateLiveRouteOverlay() {
  const instance = map.value;
  const container = mapContainer.value ?? instance?.getContainer();
  const routeCoordinates = routeShapeCoordinates.value;

  if (!instance || !interactiveMapEnabled.value || routeCoordinates.length < 2 || !container?.clientWidth || !container?.clientHeight) {
    liveRouteOverlayPath.value = '';
    return;
  }

  liveRouteOverlaySize.value = {
    width: container.clientWidth,
    height: container.clientHeight,
  };

  liveRouteOverlayPath.value = sampleRouteCoordinatesForOverlay(routeCoordinates)
    .map((coordinate, index) => {
      const projectedPoint = instance.project(coordinate);
      const command = index === 0 ? 'M' : 'L';
      return `${command} ${Number(projectedPoint.x.toFixed(2))} ${Number(projectedPoint.y.toFixed(2))}`;
    })
    .join(' ');
}

function scheduleMarkerRender() {
  if (isMarkerRenderQueued) {
    return;
  }

  isMarkerRenderQueued = true;
  const requestId = markerRenderRequestId + 1;
  markerRenderRequestId = requestId;
  const flushRender = () => {
    if (requestId !== markerRenderRequestId) {
      return;
    }

    isMarkerRenderQueued = false;
    markerRenderFrameHandle = null;
    void renderSpotMarkers();
  };

  if (typeof window === 'undefined' || isUiTestEnvironment()) {
    queueMicrotaskSafe(flushRender);
    return;
  }

  markerRenderFrameHandle = window.requestAnimationFrame(() => {
    flushRender();
  });
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function buildFallbackViewportBounds(): FallbackProjectionBounds {
  const [centerLongitude, centerLatitude] = mapStore.viewport.center;
  const zoom = clampNumber(mapStore.viewport.zoom, 2, 18);
  const longitudeSpan = clampNumber(38 / 2 ** Math.max(0, zoom - 3), 0.08, 42);
  const latitudeSpan = clampNumber(longitudeSpan * 0.62, 0.06, 24);

  return {
    minLongitude: centerLongitude - longitudeSpan / 2,
    maxLongitude: centerLongitude + longitudeSpan / 2,
    minLatitude: centerLatitude - latitudeSpan / 2,
    maxLatitude: centerLatitude + latitudeSpan / 2,
  };
}

function projectFallbackPoint(point: MapPoint, projectionBounds: FallbackProjectionBounds): FallbackProjection {
  return projectFallbackCoordinate([point.longitude, point.latitude], projectionBounds);
}

function projectFallbackCoordinate(coordinate: RouteCoordinate, projectionBounds: FallbackProjectionBounds): FallbackProjection {
  const longitudeRange = Math.max(projectionBounds.maxLongitude - projectionBounds.minLongitude, FALLBACK_MIN_COORDINATE_RANGE);
  const latitudeRange = Math.max(projectionBounds.maxLatitude - projectionBounds.minLatitude, FALLBACK_MIN_COORDINATE_RANGE);
  const usableWidth = FALLBACK_VIEWPORT.width - FALLBACK_HORIZONTAL_PADDING * 2;
  const usableHeight = FALLBACK_VIEWPORT.height - FALLBACK_VERTICAL_PADDING * 2;
  const [longitude, latitude] = coordinate;
  const x = FALLBACK_HORIZONTAL_PADDING + (((longitude - projectionBounds.minLongitude) / longitudeRange) * usableWidth);
  const y = FALLBACK_VIEWPORT.height - FALLBACK_VERTICAL_PADDING - (((latitude - projectionBounds.minLatitude) / latitudeRange) * usableHeight);

  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
  };
}

function unprojectFallbackCoordinate(point: FallbackProjection, projectionBounds: FallbackProjectionBounds): RouteCoordinate {
  const longitudeRange = Math.max(projectionBounds.maxLongitude - projectionBounds.minLongitude, FALLBACK_MIN_COORDINATE_RANGE);
  const latitudeRange = Math.max(projectionBounds.maxLatitude - projectionBounds.minLatitude, FALLBACK_MIN_COORDINATE_RANGE);
  const usableWidth = FALLBACK_VIEWPORT.width - FALLBACK_HORIZONTAL_PADDING * 2;
  const usableHeight = FALLBACK_VIEWPORT.height - FALLBACK_VERTICAL_PADDING * 2;
  const normalizedX = clampNumber((point.x - FALLBACK_HORIZONTAL_PADDING) / usableWidth, 0, 1);
  const normalizedY = clampNumber((FALLBACK_VIEWPORT.height - FALLBACK_VERTICAL_PADDING - point.y) / usableHeight, 0, 1);
  const longitude = projectionBounds.minLongitude + normalizedX * longitudeRange;
  const latitude = projectionBounds.minLatitude + normalizedY * latitudeRange;

  return [longitude, latitude];
}

function buildRouteCoordinateRenderKey(coordinate: RouteCoordinate): string {
  return `${coordinate[0].toFixed(5)},${coordinate[1].toFixed(5)}`;
}

function sampleRouteCoordinatesForOverlay(coordinates: RouteCoordinate[]): RouteCoordinate[] {
  if (coordinates.length <= MAX_LIVE_ROUTE_OVERLAY_COORDINATES) {
    return coordinates;
  }

  const firstCoordinate = coordinates[0]!;
  const lastCoordinate = coordinates[coordinates.length - 1]!;
  const step = Math.ceil((coordinates.length - 2) / (MAX_LIVE_ROUTE_OVERLAY_COORDINATES - 2));
  const sampledCoordinates: RouteCoordinate[] = [firstCoordinate];
  for (let index = step; index < coordinates.length - 1; index += step) {
    sampledCoordinates.push(coordinates[index]!);
  }
  sampledCoordinates.push(lastCoordinate);
  return sampledCoordinates;
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

function setVisibleSpotIds(spotIds: string[], visiblePinCount = spotIds.length) {
  measuredVisiblePinCount.value = Math.max(visiblePinCount, spotIds.length, 0);
  mapStore.setVisibleSpotIds([...new Set(spotIds)]);
}

function isFiniteNumber(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasValidRouteCoordinate(coordinate: RouteCoordinate): boolean {
  const [longitude, latitude] = coordinate;
  return isFiniteNumber(latitude)
    && isFiniteNumber(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

function hasValidCoordinates(point: MapPoint): boolean {
  return isFiniteNumber(point.latitude)
    && isFiniteNumber(point.longitude)
    && point.latitude >= -90
    && point.latitude <= 90
    && point.longitude >= -180
    && point.longitude <= 180;
}

function hasMappablePoints(): boolean {
  return props.routePoints.some(hasValidCoordinates) || props.spots.some(hasValidCoordinates);
}

function getRouteMarkerSequence(point: MapPoint, routePosition: number): string | number {
  if (point.routeRole === 'start') {
    return 'S';
  }

  if (point.routeRole === 'end') {
    return 'E';
  }

  const customLabel = point.routeLabel?.trim();
  return point.routeRole ? routePosition : customLabel || routePosition;
}

function buildRouteOrderLookup(routePoints: MapPoint[]): Map<string, string | number> {
  return new Map(
    routePoints.map((point, index) => [
      point.id,
      getRouteMarkerSequence(point, index + 1),
    ]),
  );
}

function resolveBaseViewport(): MapViewport {
  return props.initialViewport
    ? cloneMapViewport(props.initialViewport)
    : cloneMapViewport(DEFAULT_MAP_VIEWPORT);
}

function buildViewportSignature(viewport: MapViewport | undefined): string {
  if (!viewport) {
    return '';
  }

  return `${viewport.center[0].toFixed(5)},${viewport.center[1].toFixed(5)}:${viewport.zoom.toFixed(2)}:${viewport.style}`;
}

function applyBaseViewport(options: { animate?: boolean } = {}): void {
  if (hasMappablePoints()) {
    return;
  }

  const targetViewport = resolveBaseViewport();
  mapStore.setCenter(targetViewport.center);
  mapStore.setZoom(targetViewport.zoom);
  mapStore.setStyle(targetViewport.style);
  mapStyle.value = targetViewport.style;

  const instance = map.value;
  if (!instance || !interactiveMapEnabled.value || options.animate !== true) {
    return;
  }

  instance.easeTo({
    center: targetViewport.center,
    zoom: targetViewport.zoom,
    duration: 550,
  });
}

async function syncAutoRoadRoute(): Promise<void> {
  const requestId = ++autoRoadRouteRequestId;
  const suppliedRouteGeometry = props.routeGeometry.filter(hasValidRouteCoordinate);
  if (!props.autoResolveRouteGeometry || suppliedRouteGeometry.length > 1) {
    autoRoadRoute.value = null;
    return;
  }

  const routePoints = props.routePoints.filter(hasValidCoordinates);
  if (routePoints.length < 2) {
    autoRoadRoute.value = null;
    return;
  }

  const routeSignature = routePointGeometrySignature.value;
  autoRoadRoute.value = null;

  try {
    const nextRoute = await resolveRoadRoute(routePoints, { optimizeOrder: props.optimizeRouteOrder });
    if (requestId !== autoRoadRouteRequestId || routeSignature !== routePointGeometrySignature.value) {
      return;
    }

    autoRoadRoute.value = {
      signature: routeSignature,
      summary: nextRoute,
    };
  } catch (error) {
    if (requestId !== autoRoadRouteRequestId) {
      return;
    }

    console.warn('[scope-map] Road route resolution failed; using direct fallback geometry.', error);
    autoRoadRoute.value = null;
  }
}

function hasValidMarkerCoordinates(marker: ViewportMarkerModel): boolean {
  const [longitude, latitude] = getViewportMarkerCoordinates(marker);
  return isFiniteNumber(latitude)
    && isFiniteNumber(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

function isValidClusterEntry(entry: ScopeWasmClusterResult): boolean {
  return isFiniteNumber(entry.latitude)
    && isFiniteNumber(entry.longitude)
    && isFiniteNumber(entry.screenX)
    && isFiniteNumber(entry.screenY)
    && entry.latitude >= -90
    && entry.latitude <= 90
    && entry.longitude >= -180
    && entry.longitude <= 180
    && entry.pointCount > 0;
}

function getLiveMarkerVisibilityBuffer(width: number, height: number): number {
  const responsiveLimit = Math.max(48, Math.min(width, height) * 0.24);
  return Math.min(LIVE_MARKER_VISIBILITY_BUFFER_PX, responsiveLimit);
}

function getVisibleSpotsFromViewport(instance: mapboxgl.Map, bufferPx = 0): MapPoint[] {
  const container = mapContainer.value ?? instance.getContainer();
  const width = container?.clientWidth ?? 0;
  const height = container?.clientHeight ?? 0;
  if (width <= 0 || height <= 0) {
    const bounds = instance.getBounds();
    return filteredSpots.value.filter((spot) => bounds.contains([spot.longitude, spot.latitude]));
  }

  return getMapPointsInsideViewport(
    filteredSpots.value.filter(hasValidCoordinates),
    { width, height },
    (spot) => instance.project([spot.longitude, spot.latitude]),
    bufferPx,
  );
}

function getRenderableSpotsFromViewport(instance: mapboxgl.Map): MapPoint[] {
  const container = mapContainer.value ?? instance.getContainer();
  const width = container?.clientWidth ?? 0;
  const height = container?.clientHeight ?? 0;
  return getVisibleSpotsFromViewport(instance, getLiveMarkerVisibilityBuffer(width, height));
}

function getVisibleMarkerModelsFromViewport(instance: mapboxgl.Map, markers: ViewportMarkerModel[]): ViewportMarkerModel[] {
  const container = mapContainer.value ?? instance.getContainer();
  const width = container?.clientWidth ?? 0;
  const height = container?.clientHeight ?? 0;
  if (width <= 0 || height <= 0 || !markers.length) {
    return [];
  }

  return markers.filter((marker) => {
    const visibleSpotIds = getSpotIdsRepresentedByVisibleViewportMarkers(
      [marker],
      { width, height },
      () => {
        const [longitude, latitude] = getViewportMarkerCoordinates(marker);
        return instance.project([longitude, latitude]);
      },
    );
    return visibleSpotIds.length > 0 || isMarkerCoordinateInsideViewport(marker, instance, width, height);
  });
}

function isMarkerCoordinateInsideViewport(
  marker: ViewportMarkerModel,
  instance: mapboxgl.Map,
  width: number,
  height: number,
  bufferPx = 0,
): boolean {
  const [longitude, latitude] = getViewportMarkerCoordinates(marker);
  const projectedPoint = instance.project([longitude, latitude]);
  return (
    Number.isFinite(projectedPoint.x)
    && Number.isFinite(projectedPoint.y)
    &&
    projectedPoint.x >= -bufferPx
    && projectedPoint.x <= width + bufferPx
    && projectedPoint.y >= -bufferPx
    && projectedPoint.y <= height + bufferPx
  );
}

function getVisibleSpotIdsFromMarkerModels(instance: mapboxgl.Map, markers: ViewportMarkerModel[]): string[] {
  return getSpotIdsRepresentedByViewportMarkers(getVisibleMarkerModelsFromViewport(instance, markers));
}

function getVisiblePinCountFromMarkerModels(instance: mapboxgl.Map, markers: ViewportMarkerModel[]): number {
  return getPinCountRepresentedByViewportMarkers(getVisibleMarkerModelsFromViewport(instance, markers));
}

function buildViewport(instance: mapboxgl.Map): ScopeWasmViewport | null {
  const container = mapContainer.value ?? instance.getContainer();
  const width = container?.clientWidth ?? 0;
  const height = container?.clientHeight ?? 0;
  if (width <= 0 || height <= 0) {
    return null;
  }

  const buffer = getLiveMarkerVisibilityBuffer(width, height);
  const northWest = instance.unproject([-buffer, -buffer]);
  const southEast = instance.unproject([width + buffer, height + buffer]);
  if (
    !Number.isFinite(northWest.lng)
    || !Number.isFinite(northWest.lat)
    || !Number.isFinite(southEast.lng)
    || !Number.isFinite(southEast.lat)
  ) {
    return null;
  }

  return {
    west: northWest.lng,
    south: southEast.lat,
    east: southEast.lng,
    north: northWest.lat,
    width: width + (buffer * 2),
    height: height + (buffer * 2),
    zoom: Number(instance.getZoom().toFixed(2)),
  };
}

function getViewportBufferOffsets(instance: mapboxgl.Map, viewport: ScopeWasmViewport): { x: number; y: number } {
  const container = mapContainer.value ?? instance.getContainer();
  const width = container?.clientWidth ?? 0;
  const height = container?.clientHeight ?? 0;

  return {
    x: Math.max((viewport.width - width) / 2, 0),
    y: Math.max((viewport.height - height) / 2, 0),
  };
}

function projectSpotIntoClusterViewport(
  instance: mapboxgl.Map,
  viewport: ScopeWasmViewport,
  spot: MapPoint,
): { x: number; y: number } {
  const offset = getViewportBufferOffsets(instance, viewport);
  const projectedPoint = instance.project([spot.longitude, spot.latitude]);

  return {
    x: projectedPoint.x + offset.x,
    y: projectedPoint.y + offset.y,
  };
}

function resolveClusterEntryPointIds(
  entry: ScopeWasmClusterResult,
  instance: mapboxgl.Map,
  viewport: ScopeWasmViewport,
  candidates = filteredSpots.value,
): string[] {
  const explicitPointIds = [...new Set(entry.pointIds.filter((pointId) => filteredSpotLookup.value.has(pointId)))];
  if (explicitPointIds.length) {
    return explicitPointIds;
  }

  const footprintPadding = 2;
  const targetCount = Math.max(entry.pointCount, 0);
  const projectedCandidates = candidates
    .map((spot) => {
      const projectedPoint = projectSpotIntoClusterViewport(instance, viewport, spot);
      return {
        spot,
        projectedPoint,
        distanceFromEntry: Math.hypot(projectedPoint.x - entry.screenX, projectedPoint.y - entry.screenY),
      };
    })
    .sort((left, right) => left.distanceFromEntry - right.distanceFromEntry);

  const footprintCandidates = projectedCandidates.filter(({ projectedPoint }) => (
    projectedPoint.x >= entry.minScreenX - footprintPadding
    && projectedPoint.x <= entry.maxScreenX + footprintPadding
    && projectedPoint.y >= entry.minScreenY - footprintPadding
    && projectedPoint.y <= entry.maxScreenY + footprintPadding
  ));

  return (footprintCandidates.length ? footprintCandidates : projectedCandidates)
    .slice(0, targetCount || 1)
    .map(({ spot }) => spot.id)
    .sort((left, right) => left.localeCompare(right));
}

function resolveSingletonEntrySpot(
  entry: ScopeWasmClusterResult,
  instance: mapboxgl.Map,
  viewport: ScopeWasmViewport,
  candidates = filteredSpots.value,
): MapPoint | null {
  const explicitPointId = entry.pointIds.find((pointId) => filteredSpotLookup.value.has(pointId));
  if (explicitPointId) {
    return filteredSpotLookup.value.get(explicitPointId) ?? null;
  }

  const closestEntry = candidates
    .map((spot) => {
      const projectedPoint = projectSpotIntoClusterViewport(instance, viewport, spot);
      return {
        spot,
        distanceFromEntry: Math.hypot(projectedPoint.x - entry.screenX, projectedPoint.y - entry.screenY),
      };
    })
    .sort((left, right) => left.distanceFromEntry - right.distanceFromEntry)[0];

  return closestEntry?.spot ?? null;
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

  if (!selectedSpot.value) {
    return null;
  }

  return {
    id: selectedSpot.value.id,
    latitude: selectedSpot.value.latitude,
    longitude: selectedSpot.value.longitude,
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
  return spots
    .filter(hasValidCoordinates)
    .map((spot) => ({
      kind: 'spot',
      id: spot.id,
      spot,
      distanceLabel: distanceLabels.get(spot.id) ?? null,
    }));
}

function createEmptyMarkerState(): {
  markers: ViewportMarkerModel[];
  visibleSpotIds: string[];
  visiblePinCount: number;
} {
  return {
    markers: [],
    visibleSpotIds: [],
    visiblePinCount: 0,
  };
}

async function buildViewportMarkerModels(instance: mapboxgl.Map): Promise<{
  markers: ViewportMarkerModel[];
  visibleSpotIds: string[];
  visiblePinCount: number;
}> {
  if (props.markerVariant === 'sequence') {
    const visibleSpots = getRenderableSpotsFromViewport(instance);
    if (!visibleSpots.length) {
      return createEmptyMarkerState();
    }

    const distanceLabels = await resolveDistanceLabels(visibleSpots);
    const markers = buildSpotMarkerModels(visibleSpots, distanceLabels);
    return {
      markers,
      visibleSpotIds: getVisibleSpotIdsFromMarkerModels(instance, markers),
      visiblePinCount: getVisiblePinCountFromMarkerModels(instance, markers),
    };
  }

  const renderableSpots = getRenderableSpotsFromViewport(instance);
  if (!renderableSpots.length) {
    return createEmptyMarkerState();
  }

  const viewport = buildViewport(instance);
  if (!viewport) {
    const distanceLabels = await resolveDistanceLabels(renderableSpots);
    const markers = buildSpotMarkerModels(renderableSpots, distanceLabels);
    return {
      markers,
      visibleSpotIds: getVisibleSpotIdsFromMarkerModels(instance, markers),
      visiblePinCount: getVisiblePinCountFromMarkerModels(instance, markers),
    };
  }

  const clusteredEntries = (await clusterViewportPoints(renderableSpots, viewport, {
    radiusPx: LIVE_CLUSTER_RADIUS_PX,
    minPoints: LIVE_CLUSTER_MIN_POINTS,
    includeSingles: true,
  })).filter(isValidClusterEntry);

  if (!clusteredEntries.length) {
    const distanceLabels = await resolveDistanceLabels(renderableSpots);
    const markers = buildSpotMarkerModels(renderableSpots, distanceLabels);
    return {
      markers,
      visibleSpotIds: getVisibleSpotIdsFromMarkerModels(instance, markers),
      visiblePinCount: getVisiblePinCountFromMarkerModels(instance, markers),
    };
  }

  const singletonSpots = clusteredEntries
    .filter((entry) => !entry.clustered)
    .map((entry) => resolveSingletonEntrySpot(entry, instance, viewport, renderableSpots))
    .filter((spot): spot is MapPoint => Boolean(spot));
  const distanceLabels = await resolveDistanceLabels(singletonSpots);

  const markers = clusteredEntries.flatMap<ViewportMarkerModel>((entry) => {
    if (!entry.clustered) {
      const spot = resolveSingletonEntrySpot(entry, instance, viewport, renderableSpots);
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

    const pointIds = resolveClusterEntryPointIds(entry, instance, viewport, renderableSpots);

    return [{
      kind: 'cluster',
      id: entry.id,
      latitude: entry.latitude,
      longitude: entry.longitude,
      pointCount: entry.pointCount || pointIds.length,
      pointIds,
    }];
  }).filter(hasValidMarkerCoordinates);

  return {
    markers,
    visibleSpotIds: getVisibleSpotIdsFromMarkerModels(instance, markers),
    visiblePinCount: getVisiblePinCountFromMarkerModels(instance, markers),
  };
}

function updateVisibleSpotIds() {
  const instance = map.value;
  if (!instance || !interactiveMapEnabled.value) {
    setVisibleSpotIds(filteredSpots.value.map((spot) => spot.id));
  }
}

function buildMarkerRenderContext(): MarkerRenderContext {
  return {
    markerVariant: props.markerVariant,
    routeOrderLookup: routeOrderLookup.value,
    selectedSpotId: selectedSpotId.value,
  };
}

function renderMarkerContent(markerModel: ViewportMarkerModel, mountTarget: HTMLDivElement) {
  if (markerModel.kind === 'spot') {
    render(h(SpotMarker, {
      spot: markerModel.spot,
      active: selectedSpotId.value === markerModel.id,
      variant: props.markerVariant,
      sequence: routeOrderLookup.value.get(markerModel.id) ?? null,
      distanceLabel: markerModel.distanceLabel,
      onSelect: () => handleSpotSelect(markerModel.spot),
    }), mountTarget);
    return;
  }

  render(h(ClusterMarker, {
    pointCount: markerModel.pointCount,
    dataTestId: `map-cluster-marker-${markerModel.id}`,
    onSelect: () => handleClusterSelect(markerModel.pointIds),
  }), mountTarget);
}

function removeMarkerController(markerId: string) {
  const controller = markerControllers.get(markerId);
  if (!controller) {
    return;
  }

  render(null, controller.mountTarget);
  controller.marker.remove();
  markerControllers.delete(markerId);
}

function clearSpotMarkers() {
  Array.from(markerControllers.keys()).forEach(removeMarkerController);
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

function emitMapClickAtCoordinate(latitude: number, longitude: number) {
  emit('interaction', { type: 'map_click' });
  emit('map-click', {
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
  });
}

function handleFallbackMarkerClick(marker: FallbackMarker) {
  if (props.clickToSelect) {
    emitMapClickAtCoordinate(marker.latitude, marker.longitude);
    return;
  }

  handleFallbackMarkerSelect(marker.id);
}

function handleFallbackCanvasClick(event: MouseEvent) {
  if (!props.clickToSelect) {
    return;
  }

  const fallbackCanvas = event.currentTarget;
  if (!(fallbackCanvas instanceof SVGSVGElement)) {
    return;
  }

  const screenMatrix = fallbackCanvas.getScreenCTM();
  if (!screenMatrix) {
    return;
  }

  const point = fallbackCanvas.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const fallbackPoint = point.matrixTransform(screenMatrix.inverse());
  const [longitude, latitude] = unprojectFallbackCoordinate(
    {
      x: fallbackPoint.x,
      y: fallbackPoint.y,
    },
    fallbackProjectionBounds.value,
  );

  emitMapClickAtCoordinate(latitude, longitude);
}

function handleMapCanvasClick(event: MouseEvent) {
  if (!props.clickToSelect || !interactiveMapEnabled.value) {
    return;
  }

  const container = mapContainer.value;
  if (!container || container.querySelector('.mapboxgl-canvas')) {
    return;
  }

  const mapRect = container.getBoundingClientRect();
  if (mapRect.width <= 0 || mapRect.height <= 0) {
    return;
  }

  const fallbackPoint = {
    x: ((event.clientX - mapRect.left) / mapRect.width) * FALLBACK_VIEWPORT.width,
    y: ((event.clientY - mapRect.top) / mapRect.height) * FALLBACK_VIEWPORT.height,
  };
  const [longitude, latitude] = unprojectFallbackCoordinate(fallbackPoint, buildFallbackViewportBounds());

  emitMapClickAtCoordinate(latitude, longitude);
}

function handleClusterSelect(pointIds: string[]) {
  emit('interaction', { type: 'cluster_focus' });
  const pointIdsSet = new Set(pointIds);
  fitToPoints(filteredSpots.value.filter((spot) => pointIdsSet.has(spot.id)));
}

function createMarkerController(
  markerModel: ViewportMarkerModel,
  instance: mapboxgl.Map,
  runtime: typeof mapboxgl,
  context: MarkerRenderContext,
): MarkerController {
  const mountTarget = document.createElement('div');
  mountTarget.style.zIndex = getViewportMarkerZIndex(markerModel, context);
  renderMarkerContent(markerModel, mountTarget);

  return {
    id: markerModel.id,
    kind: markerModel.kind,
    mountTarget,
    marker: new runtime.Marker({
      element: mountTarget,
      anchor: markerModel.kind === 'spot' ? 'bottom' : 'center',
    })
      .setLngLat(getViewportMarkerCoordinates(markerModel))
      .addTo(instance),
    signature: getViewportMarkerSignature(markerModel, context),
  };
}

function updateMarkerController(
  controller: MarkerController,
  markerModel: ViewportMarkerModel,
  context: MarkerRenderContext,
) {
  controller.kind = markerModel.kind;
  controller.signature = getViewportMarkerSignature(markerModel, context);
  controller.mountTarget.style.zIndex = getViewportMarkerZIndex(markerModel, context);
  controller.marker.setLngLat(getViewportMarkerCoordinates(markerModel));
  renderMarkerContent(markerModel, controller.mountTarget);
}

function isMarkerRectVisibleInMap(markerRect: DOMRect, mapRect: DOMRect): boolean {
  if (markerRect.width <= 0 || markerRect.height <= 0 || mapRect.width <= 0 || mapRect.height <= 0) {
    return false;
  }

  const intersectionWidth = Math.min(markerRect.right, mapRect.right) - Math.max(markerRect.left, mapRect.left);
  const intersectionHeight = Math.min(markerRect.bottom, mapRect.bottom) - Math.max(markerRect.top, mapRect.top);

  return intersectionWidth >= VISIBLE_MARKER_MIN_INTERSECTION_PX && intersectionHeight >= VISIBLE_MARKER_MIN_INTERSECTION_PX;
}

function measureVisibleMarkerState(
  markers: ViewportMarkerModel[],
  instance: mapboxgl.Map,
): { measured: boolean; spotIds: string[]; pinCount: number } {
  const container = mapContainer.value ?? instance.getContainer();
  const mapRect = container?.getBoundingClientRect();
  if (!mapRect || mapRect.width <= 0 || mapRect.height <= 0) {
    return {
      measured: false,
      spotIds: [],
      pinCount: 0,
    };
  }

  const visibleMarkers = markers.filter((markerModel) => {
    const controller = markerControllers.get(markerModel.id);
    return Boolean(controller && isMarkerRectVisibleInMap(controller.mountTarget.getBoundingClientRect(), mapRect));
  });

  return {
    measured: true,
    spotIds: getSpotIdsRepresentedByViewportMarkers(visibleMarkers),
    pinCount: getPinCountRepresentedByViewportMarkers(visibleMarkers),
  };
}

function reconcileSpotMarkers(
  nextMarkers: ViewportMarkerModel[],
  nextVisibleSpotIds: string[],
  nextVisiblePinCount: number,
  instance: mapboxgl.Map,
  runtime: typeof mapboxgl,
) {
  const context = buildMarkerRenderContext();
  const existingMarkers = new Map<string, { kind: ViewportMarkerModel['kind']; signature: string }>(
    Array.from(
      markerControllers.values(),
      (controller) => [controller.id, {
        kind: controller.kind,
        signature: controller.signature,
      }] as const,
    ),
  );
  const reconciliationPlan = planViewportMarkerReconciliation(existingMarkers, nextMarkers, context);
  const nextMarkerIdsToCreate = new Set(reconciliationPlan.create.map((marker) => marker.id));
  const nextMarkerIdsToUpdate = new Set(reconciliationPlan.update.map((marker) => marker.id));

  reconciliationPlan.remove.forEach(removeMarkerController);

  nextMarkers.forEach((markerModel) => {
    if (nextMarkerIdsToCreate.has(markerModel.id)) {
      try {
        markerControllers.set(markerModel.id, createMarkerController(markerModel, instance, runtime, context));
      } catch (error) {
        console.warn('[scope-map] Skipped invalid marker while rendering the live map.', error);
        removeMarkerController(markerModel.id);
      }
      return;
    }

    if (nextMarkerIdsToUpdate.has(markerModel.id)) {
      const controller = markerControllers.get(markerModel.id);
      if (controller) {
        try {
          updateMarkerController(controller, markerModel, context);
        } catch (error) {
          console.warn('[scope-map] Removed invalid marker update while rendering the live map.', error);
          removeMarkerController(markerModel.id);
        }
      }
    }
  });

  const measuredVisibleState = measureVisibleMarkerState(nextMarkers, instance);
  if (measuredVisibleState.measured) {
    setVisibleSpotIds(measuredVisibleState.spotIds, measuredVisibleState.pinCount);
    return;
  }

  setVisibleSpotIds(nextVisibleSpotIds, nextVisiblePinCount);
}

async function renderSpotMarkers() {
  isMarkerRenderQueued = false;
  markerRenderFrameHandle = null;
  const renderVersion = ++markerRenderVersion;
  const instance = map.value;
  const runtime = mapboxRuntime.value;
  if (!instance || !runtime || !interactiveMapEnabled.value) {
    clearSpotMarkers();
    updateVisibleSpotIds();
    return;
  }

  let nextMarkers: ViewportMarkerModel[] = [];
  let nextVisibleSpotIds: string[] = [];
  let nextVisiblePinCount = 0;

  try {
    const markerState = await buildViewportMarkerModels(instance);
    nextMarkers = markerState.markers;
    nextVisibleSpotIds = markerState.visibleSpotIds;
    nextVisiblePinCount = markerState.visiblePinCount;
  } catch {
    const fallbackVisibleSpots = getRenderableSpotsFromViewport(instance);
    const distanceLabels = await resolveDistanceLabels(fallbackVisibleSpots);
    nextMarkers = buildSpotMarkerModels(fallbackVisibleSpots, distanceLabels);
    nextVisibleSpotIds = getVisibleSpotIdsFromMarkerModels(instance, nextMarkers);
    nextVisiblePinCount = getVisiblePinCountFromMarkerModels(instance, nextMarkers);
  }

  if (renderVersion !== markerRenderVersion) {
    return;
  }

  try {
    reconcileSpotMarkers(nextMarkers, nextVisibleSpotIds, nextVisiblePinCount, instance, runtime);
  } catch (error) {
    console.warn('[scope-map] Marker reconciliation failed; keeping the map workspace stable.', error);
    clearSpotMarkers();
    setVisibleSpotIds([], 0);
  }
}

function fitToPoints(points: MapPoint[]) {
  const instance = map.value;
  const runtime = mapboxRuntime.value;
  if (!instance || !runtime || !points.length || !interactiveMapEnabled.value) {
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

function buildFitSignature(kind: 'route' | 'spots', points: MapPoint[]): string {
  return `${kind}:${points.map(buildMapPointRenderKey).join('|')}`;
}

function handleZoom(delta: number) {
  const instance = map.value;
  if (!instance || !interactiveMapEnabled.value) {
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
  if (!instance || !interactiveMapEnabled.value) {
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

function resetMapViewport() {
  const instance = map.value;
  const targetViewport = resolveBaseViewport();
  mapStore.setCenter(targetViewport.center);
  mapStore.setZoom(targetViewport.zoom);
  mapStore.setStyle(targetViewport.style);
  mapStyle.value = targetViewport.style;

  if (!instance || !interactiveMapEnabled.value) {
    return;
  }

  instance.easeTo({
    center: mapStore.viewport.center,
    zoom: mapStore.viewport.zoom,
    duration: 650,
  });
}

function handleResetMap() {
  emit('interaction', { type: 'reset_map' });
  mapStore.resetCategories();
  mapStore.resetVisibleSpotIds();
  measuredVisiblePinCount.value = null;
  shouldCenterOnNextFix.value = false;

  const resetTargetPoints = props.routePoints.length > 1
    ? props.routePoints.filter(hasValidCoordinates)
    : props.spots.filter(hasValidCoordinates);
  mapStore.setSelectedSpotId(resetTargetPoints[0]?.id ?? props.spots[0]?.id ?? null);
  initialFitSignature.value = resetTargetPoints.length
    ? buildFitSignature(props.routePoints.length > 1 ? 'route' : 'spots', resetTargetPoints)
    : 'reset';
  resetMapViewport();

  nextTick(() => {
    updateLiveRouteOverlay();
    updateVisibleSpotIds();
    scheduleMarkerRender();
  });
}

function handleLocationUpdate(location: UserLocation) {
  const instance = map.value;
  const runtime = mapboxRuntime.value;
  mapStore.setUserLocation([location.longitude, location.latitude]);
  emit('location-update', location);

  if (instance && runtime && interactiveMapEnabled.value) {
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

  scheduleMarkerRender();
}

function syncThemeToMap() {
  mapStyle.value = resolveMapboxStyle(mapStore.viewport.style);
  mapStore.setStyle(mapStyle.value);

  if (map.value && interactiveMapEnabled.value && map.value.getStyle().sprite !== undefined) {
    map.value.setStyle(mapStyle.value);
    map.value.once('style.load', applyPlaceLabelVisibility);
  }
}

function applyPlaceLabelVisibility(): void {
  const instance = map.value;
  if (!instance || !interactiveMapEnabled.value || !props.showPlaceLabels) {
    return;
  }

  const layers = instance.getStyle().layers ?? [];
  layers.forEach((layer) => {
    const layerId = String(layer.id ?? '');
    const normalizedLayerId = layerId.toLowerCase();
    const isPlaceLayer = normalizedLayerId.includes('poi') ||
      normalizedLayerId.includes('point-of-interest') ||
      normalizedLayerId.includes('place-label') ||
      normalizedLayerId.includes('settlement') ||
      normalizedLayerId.includes('road-label') ||
      normalizedLayerId.includes('road-number') ||
      normalizedLayerId.includes('transit-label') ||
      normalizedLayerId.includes('airport-label');

    if (!isPlaceLayer) {
      return;
    }

    try {
      instance.setLayoutProperty(layerId, 'visibility', 'visible');
    } catch {
      // Some imported style fragments are read-only in Mapbox GL. Best-effort labels are enough here.
    }
  });
}

async function setupMap() {
  if (!mapContainer.value || !interactiveMapEnabled.value || map.value) {
    updateVisibleSpotIds();
    return;
  }

  let runtime;
  try {
    runtime = await loadConfiguredMapboxRuntime();
  } catch (error) {
    console.warn('[scope-map] Mapbox runtime failed to load; rendering fallback.', error);
    markMapRuntimeFailed();
    updateVisibleSpotIds();
    return;
  }
  mapboxRuntime.value = runtime;
  if (!mapContainer.value || map.value) {
    updateVisibleSpotIds();
    return;
  }

  mapStyle.value = resolveMapboxStyle(mapStore.viewport.style);
  mapStore.setStyle(mapStyle.value);

  let instance;
  try {
    instance = new runtime.Map({
      container: mapContainer.value,
      style: mapStyle.value,
      center: mapStore.viewport.center,
      zoom: mapStore.viewport.zoom,
      attributionControl: false,
    });
  } catch (error) {
    console.warn('[scope-map] Mapbox initialization failed; rendering fallback.', error);
    markMapRuntimeFailed();
    updateVisibleSpotIds();
    return;
  }

  instance.on('error', (event: { error?: { status?: number; message?: string } }) => {
    const status = event?.error?.status;
    const message = event?.error?.message ?? '';
    const isAuthError = status === 401 || status === 403 || /access token|unauthor/i.test(message);
    if (isAuthError) {
      console.warn('[scope-map] Mapbox auth/tile error; falling back to static view.', event?.error);
      try {
        instance?.remove();
      } catch {
        // ignore
      }
      map.value = null;
      markMapRuntimeFailed();
      updateVisibleSpotIds();
    }
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
    applyPlaceLabelVisibility();
    scheduleMarkerRender();
    updateLiveRouteOverlay();
  });
  instance.on('style.load', applyPlaceLabelVisibility);
  instance.on('move', updateLiveRouteOverlay);
  instance.on('zoom', updateLiveRouteOverlay);
  instance.on('moveend', () => {
    syncViewportFromMap();
    updateLiveRouteOverlay();
    scheduleMarkerRender();
  });
  instance.on('idle', () => {
    updateLiveRouteOverlay();
    scheduleMarkerRender();
  });

  map.value = instance;
  updateLiveRouteOverlay();
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
  () => [
    props.routePoints.map(buildMapPointRenderKey).join('|'),
    routeShapeCoordinates.value.map(buildRouteCoordinateRenderKey).join('|'),
  ] as const,
  () => {
    nextTick(updateLiveRouteOverlay);
  },
  { immediate: true },
);

watch(
  () => props.showPlaceLabels,
  () => {
    nextTick(applyPlaceLabelVisibility);
  },
);

watch(
  () => [
    props.autoResolveRouteGeometry,
    props.optimizeRouteOrder,
    props.routeGeometry.filter(hasValidRouteCoordinate).map(buildRouteCoordinateRenderKey).join('|'),
    routePointGeometrySignature.value,
  ] as const,
  () => {
    void syncAutoRoadRoute();
  },
  { immediate: true },
);

watch(
  () => filteredSpots.value.map(buildMapPointRenderKey),
  () => {
    if (!filteredSpots.value.some((spot) => spot.id === selectedSpotId.value)) {
      mapStore.setSelectedSpotId(filteredSpots.value[0]?.id ?? null);
    }

    nextTick(() => {
      scheduleMarkerRender();
    });
  },
  { immediate: true },
);

watch(
  () => selectedSpotId.value,
  (nextSelectedSpotId, previousSelectedSpotId) => {
    if (!nextSelectedSpotId) {
      scheduleMarkerRender();
      return;
    }

    if (nextSelectedSpotId !== previousSelectedSpotId) {
      const nextSelectedSpot = spotLookup.value.get(nextSelectedSpotId);
      if (nextSelectedSpot && map.value && interactiveMapEnabled.value) {
        map.value.easeTo({
          center: [nextSelectedSpot.longitude, nextSelectedSpot.latitude],
          duration: 500,
        });
      }
    }

    scheduleMarkerRender();
  },
);

watch(
  () => [mapStore.viewport.center[0], mapStore.viewport.center[1], mapStore.viewport.zoom] as const,
  ([longitude, latitude, zoom]) => {
    const instance = map.value;
    if (!instance || syncingViewport || !interactiveMapEnabled.value) {
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
  () => [
    map.value,
    props.routePoints.map(buildMapPointRenderKey).join('|'),
    filteredSpots.value.map(buildMapPointRenderKey).join('|'),
  ] as const,
  () => {
    if (!map.value || !interactiveMapEnabled.value) {
      return;
    }

    const hasRoutePoints = props.routePoints.length > 1;
    const targetKind = hasRoutePoints ? 'route' : 'spots';
    const targetPoints = hasRoutePoints ? props.routePoints : filteredSpots.value;
    if (!targetPoints.length) {
      return;
    }

    const nextSignature = buildFitSignature(targetKind, targetPoints);
    if (initialFitSignature.value === nextSignature || (targetKind === 'spots' && initialFitSignature.value)) {
      return;
    }

    fitToPoints(targetPoints);
    initialFitSignature.value = nextSignature;
  },
  { immediate: true },
);

watch(
  () => buildViewportSignature(props.initialViewport),
  () => {
    applyBaseViewport({ animate: true });
  },
);

onMounted(() => {
  measuredVisiblePinCount.value = null;
  mapStore.resetVisibleSpotIds();
  applyBaseViewport();
  if (interactiveMapEnabled.value) {
    void preloadScopeWasmRuntime();
  }
  void setupMap();
  themeObserver = new MutationObserver(syncThemeToMap);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  if (mapContainer.value && typeof ResizeObserver !== 'undefined') {
    containerResizeObserver = new ResizeObserver(handleMapContainerResize);
    containerResizeObserver.observe(mapContainer.value);
  }
  window.addEventListener('resize', handleWindowResize);
});

onBeforeUnmount(() => {
  cancelScheduledMarkerRender();
  autoRoadRouteRequestId += 1;
  markerRenderVersion += 1;
  themeObserver?.disconnect();
  themeObserver = null;
  containerResizeObserver?.disconnect();
  containerResizeObserver = null;
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
  width: 100%;
  height: 100%;
  min-width: 0;
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

.map-view--pick-mode .map-canvas,
.map-view--pick-mode .map-fallback__canvas,
.map-view--pick-mode :deep(.mapboxgl-canvas) {
  cursor: crosshair;
}

.map-view--pick-mode .map-fallback,
.map-view--pick-mode .map-fallback__canvas {
  pointer-events: auto;
}

.map-view--pick-mode :deep(.mapboxgl-marker) {
  pointer-events: none;
}

.map-canvas,
.map-fallback,
.map-live-route-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.map-canvas :deep(.mapboxgl-map),
.map-canvas :deep(.mapboxgl-canvas-container),
.map-canvas :deep(.mapboxgl-canvas) {
  width: 100% !important;
  height: 100% !important;
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

.map-live-route-overlay {
  width: 100%;
  height: 100%;
  z-index: 2;
  pointer-events: none;
  overflow: visible;
}

.map-live-route-overlay__outline,
.map-live-route-overlay__line {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.map-live-route-overlay__outline {
  stroke: color-mix(in srgb, var(--bg-primary) 88%, black);
  stroke-width: 12;
  stroke-opacity: 0.88;
}

.map-live-route-overlay__line {
  stroke: var(--accent-gold);
  stroke-width: 6;
  filter: drop-shadow(0 0 0.6rem color-mix(in srgb, var(--accent-gold) 45%, transparent));
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
  stroke: color-mix(in srgb, var(--accent-gold) 86%, var(--accent-teal) 14%);
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 0 16px color-mix(in srgb, var(--accent-gold) 22%, transparent));
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
  gap: var(--space-2);
  padding: 0.55rem;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.map-summary__item {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 2.1rem;
  padding: 0.45rem 0.72rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 16%, var(--glass-border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-secondary) 84%, var(--bg-primary) 16%);
  color: color-mix(in srgb, var(--text-primary) 86%, var(--text-secondary) 14%);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  white-space: nowrap;
}

.map-summary__item :deep(.scope-icon) {
  width: 0.95rem;
  height: 0.95rem;
  color: var(--accent-teal);
}

.tracker-overlay {
  bottom: var(--space-4);
  max-width: min(33rem, calc(100% - 8rem));
}

.empty-state {
  position: absolute;
  inset: 50% auto auto 50%;
  width: min(30rem, calc(100% - 3rem));
  transform: translate(-50%, -50%);
  z-index: var(--z-sidebar);
  padding: var(--space-5) var(--space-6);
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-4);
  align-items: start;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: 0 24px 60px -24px rgba(0, 0, 0, 0.55);
}

:root[data-theme='light'] .empty-state {
  background: var(--bg-elevated);
}

.empty-state__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 18%, transparent);
  color: var(--accent-teal);
  flex-shrink: 0;
}

.empty-state__icon :deep(.scope-icon) {
  width: 1.25rem;
  height: 1.25rem;
}

.empty-state__copy {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.empty-state h2 {
  margin: 0;
  font-size: 1.125rem;
  line-height: 1.3;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.empty-state p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.88rem;
  line-height: 1.5;
}

.map-view--mobile .map-summary {
  top: max(var(--space-3), var(--safe-area-top));
  left: max(var(--space-3), var(--safe-area-left));
  right: auto;
  max-width: min(18rem, calc(100% - 7.5rem));
  gap: 0.35rem var(--space-2);
  padding: 0.5rem;
  border-radius: 1.35rem;
  background: color-mix(in srgb, var(--bg-secondary) 94%, var(--bg-primary) 6%);
  box-shadow:
    0 0.8rem 1.8rem color-mix(in srgb, var(--bg-primary) 28%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 6%, transparent);
  font-size: 0.82rem;
  line-height: 1.35;
}

.map-view--mobile .map-summary__item {
  min-height: 1.85rem;
  padding: 0.34rem 0.58rem;
  font-size: 0.78rem;
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
  .map-fallback__route path,
  .map-live-route-overlay__outline,
  .map-live-route-overlay__line {
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
    bottom: var(--space-3);
    max-width: calc(100% - 7rem);
  }

  .empty-state {
    left: var(--space-3);
    right: var(--space-3);
    width: auto;
    transform: translate(0, -50%);
  }

  .map-view--mobile .map-summary {
    max-width: min(18rem, calc(100% - 7.5rem));
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
