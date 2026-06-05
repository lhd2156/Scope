<template>
  <section
    class="map-view"
    :class="{
      'map-view--pick-mode': clickToSelect,
      'map-view--weather-visible': showMapWeatherBadge,
      'map-view--style-transitioning': isMapStyleTransitioning,
      'map-view--camera-transitioning': isMapCameraTransitioning,
      'map-view--camera-moving': isMapCameraMoving,
      'map-view--camera-visual-suppressed': isMapCameraVisualSettlingSuppressed,
      'map-view--tile-settling': isMapTileSettling,
      'map-view--render-gated': isMapRenderGateActive,
      'map-view--snapshot-visible': isMapStyleTransitionSnapshotVisible,
      'map-view--planner-previewing': isPlannerMapCanvasPreviewing,
      'map-view--planner-revealing': isPlannerMapCanvasRevealing,
      'map-view--planner-revealed': isPlannerMapCanvasRevealed,
      'map-view--quick-dim': isMapQuickDimVisible,
    }"
    :data-map-presentation="effectiveMapPresentation"
    :data-map-style="mapStyle"
    :data-map-route-variant="routeVariant"
    :data-map-transition-cover="mapStyleTransitionCoverMode"
    :data-map-transition-variant="mapStyleTransitionVariant"
  >
    <div
      ref="mapContainer"
      class="map-canvas"
      :class="{ 'is-fallback': !interactiveMapEnabled, 'map-canvas--planner': routeVariant === 'planner' }"
      @pointerdown.capture="handleMapUserCameraInput"
      @touchstart.capture="handleMapUserCameraInput"
      @wheel.capture="handleMapUserCameraInput"
      @click.capture="handleMapCanvasClick"
    />
    <div
      v-if="routeVariant === 'planner' && !isPlannerMapCanvasRevealed && isPlannerMapCanvasPreviewing"
      class="map-planner-preload-surface"
      :class="{
        'is-previewing': isPlannerMapCanvasPreviewing,
        'is-revealing': isPlannerMapCanvasRevealing,
      }"
      aria-hidden="true"
    />
    <img
      v-if="mapStyleTransitionSnapshotUrl"
      class="map-style-transition-snapshot"
      :class="{
        'is-visible': isMapStyleTransitionSnapshotVisible,
        'is-tinted': isMapStyleTransitionSnapshotTinted,
      }"
      :src="mapStyleTransitionSnapshotUrl"
      alt=""
      aria-hidden="true"
    />
    <div class="map-render-smoothing-veil" aria-hidden="true" />
    <div class="map-style-transition-veil" aria-hidden="true" />

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
      v-if="interactiveMapEnabled && routeVariant !== 'planner' && liveRouteOverlayPath"
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

    <div
      v-if="showMapWeatherBadge"
      class="map-weather-badge glass-panel"
      data-test="map-weather-badge"
      aria-label="Current weather near map center"
    >
      <ScopeIcon :name="mapWeatherIconName" label="Current weather" />
      <strong>{{ mapWeatherTemperatureLabel }}</strong>
    </div>

    <div
      v-if="showMapTrafficKey"
      class="map-traffic-key glass-panel"
      data-test="map-traffic-key"
      aria-label="Live traffic key: slow, heavy, closed"
    >
      <span class="map-traffic-key__label">Live traffic</span>
      <span class="map-traffic-key__item">
        <span class="map-traffic-key__swatch map-traffic-key__swatch--slow" aria-hidden="true" />
        <span>Slow</span>
      </span>
      <span class="map-traffic-key__item">
        <span class="map-traffic-key__swatch map-traffic-key__swatch--heavy" aria-hidden="true" />
        <span>Heavy</span>
      </span>
      <span class="map-traffic-key__item">
        <span class="map-traffic-key__swatch map-traffic-key__swatch--closed" aria-hidden="true" />
        <span>Closed</span>
      </span>
    </div>

    <LocationTracker
      v-if="showLocationTracker"
      ref="locationTracker"
      :auto-start="false"
      class="tracker-overlay"
      @activate="handleLocationBadgeActivate"
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

    <nav
      v-if="props.showMapStyleToggle && interactiveMapEnabled"
      class="map-style-switch glass-panel"
      aria-label="Map style"
      data-test="map-style-switch"
    >
      <button
        v-for="option in mapStyleModeOptions"
        :key="option.mode"
        type="button"
        class="map-style-switch__button"
        :class="{ 'is-active': activeMapStyleMode === option.mode }"
        :aria-label="option.ariaLabel"
        :aria-pressed="String(activeMapStyleMode === option.mode)"
        :title="option.label"
        @click="handleMapStyleModeSelect(option.mode)"
      >
        <ScopeIcon :name="option.iconName" :label="option.label" />
        <span class="map-style-switch__label">{{ option.label }}</span>
      </button>
    </nav>

    <nav
      v-if="props.showProjectionToggle && interactiveMapEnabled"
      class="map-projection-switch glass-panel"
      aria-label="Map view"
      data-test="map-projection-switch"
    >
      <button
        v-for="option in mapProjectionModeOptions"
        :key="option.mode"
        type="button"
        class="map-projection-switch__button"
        :class="{ 'is-active': activeMapProjectionMode === option.mode }"
        :aria-label="option.ariaLabel"
        :aria-pressed="String(activeMapProjectionMode === option.mode)"
        :title="option.title"
        @click="handleMapProjectionModeSelect(option.mode)"
      >
        <ScopeIcon :name="option.iconName" :label="option.title" />
        <span>{{ option.label }}</span>
      </button>
    </nav>

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
      :presentation="effectiveMapPresentation"
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
  LIGHT_MAP_STYLE,
  hasMapboxToken,
  loadConfiguredMapboxRuntime,
  resolveMapboxStyle,
} from '@/services/mapboxLoader';
import {
  buildUsStateLabelFeatureCollection,
  SCOPE_US_STATE_ABBREVIATION_LABEL_OPACITY,
  SCOPE_US_STATE_ABBREVIATION_LABEL_TEXT_FIELD,
  SCOPE_US_STATE_LABEL_LAYER_ID,
  SCOPE_US_STATE_LABEL_SOURCE_ID,
  SCOPE_US_STATE_NAME_LABEL_LAYER_ID,
  SCOPE_US_STATE_NAME_LABEL_OPACITY,
  SCOPE_US_STATE_NAME_LABEL_TEXT_FIELD,
  US_STATE_LABELS,
} from '@/components/map/usStateLabels';
import {
  getPlacePhoto,
  reverseGeocode,
  searchNearbyPlaces,
  type NearbyPlaceBounds,
  type NearbyPlaceResult,
} from '@/services/mapService';
import { DEMO_MODE_ENABLED, localFallbackEnabled } from '@/services/demoMode';
import { getOpenWeatherMapSnapshot, type WeatherSnapshot } from '@/services/openWeatherMapService';
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
import { DEFAULT_MAP_VIEWPORT, MAX_MAP_ZOOM, MIN_MAP_ZOOM, useMapStore } from '@/stores/map';
import type { ScopeAiMapCommand, ScopeAiMapCommandPayload, ScopeAiMapTarget } from '@/stores/scopeAiPlanner';
import type { MapNearbyPlacePin, MapPoint, MapViewport, SpotCategory, UserLocation } from '@/types';
import { getSpotPhotoFallback, isSpotPhotoFallbackUrl } from '@/utils/imageFallbacks';
import { getCurrentLocation, isGeolocationSupported } from '@/utils/geolocation';
import { isUiTestEnvironment } from '@/utils/scheduleNonCriticalTask';
import { getWeatherSnapshotIconName } from '@/utils/weatherDisplay';

type TrackingState = 'idle' | 'locating' | 'tracking' | 'denied' | 'unsupported' | 'error';
type MapLabelMode = 'none' | 'states' | 'majorCities' | 'full';
type MapPresentationMode = 'scope' | 'native';
type MapStyleTransitionVariant = 'load' | 'switch';
type ScopeAiMapExternalCommandInput = ScopeAiMapCommand | ScopeAiMapCommandPayload;
type MapProjectionName = 'globe' | 'mercator';
type MapFogStyle = NonNullable<Parameters<mapboxgl.Map['setFog']>[0]>;
interface CenterOnLocationOptions {
  allowDefer?: boolean;
  forceZoomIn?: boolean;
  maxFocusZoom?: number;
  durationMs?: number;
  useFlight?: boolean;
  renderGate?: boolean;
  tileSettling?: boolean;
}
type MapFeaturePlacePopupAnchor =
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

type LocationTrackerInstance = ComponentPublicInstance & {
  focusUserLocation: () => UserLocation | null;
  startTracking: () => void;
};

interface SmoothScrollZoomController {
  enable?: (options?: { around?: 'center' }) => void;
  setZoomRate?: (zoomRate: number) => void;
  setWheelZoomRate?: (wheelZoomRate: number) => void;
}

interface MarkerController {
  id: string;
  kind: ViewportMarkerModel['kind'];
  mountTarget: HTMLDivElement;
  marker: mapboxgl.Marker;
  signature: string;
}

interface NearbyPlaceMarkerController {
  id: string;
  signature: string;
  element: HTMLDivElement;
  button: HTMLButtonElement;
  marker: mapboxgl.Marker;
}

interface NearbyPlacePopupRenderOptions {
  deferFallbackPhoto?: boolean;
  allowInstantFallbackPhoto?: boolean;
}

interface MapFeaturePlaceEnrichment {
  title?: string;
  address?: string;
  subtitle?: string;
  photoUrl?: string;
  photoAttribution?: string;
  photoAttributionUrl?: string;
  photoLookupStatus?: MapNearbyPlacePin['photoLookupStatus'];
  sourceLabel?: string;
}

interface WaterReferenceLabel {
  id: string;
  name: string;
  coordinates: [number, number];
  minZoom?: number;
}

interface WaterReferenceLabelFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: {
      id: string;
      name: string;
      minZoom: number;
    };
    geometry: {
      type: 'Point';
      coordinates: [number, number];
    };
  }>;
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
const MAP_STYLE_MODE_STORAGE_KEY = 'scope.tripPlanner.mapStyleMode';
const MAP_PROJECTION_MODE_STORAGE_KEY = 'scope.map.projectionMode';
const MAP_WEATHER_MIN_ZOOM = 6;
const MAP_WEATHER_COORDINATE_PRECISION = 2;
const MAP_WEATHER_REFRESH_DEBOUNCE_MS = 650;
const MAP_DEMO_WEATHER_ENABLED = localFallbackEnabled('VITE', 'ENABLE', 'DEMO', 'WEATHER');
const MAP_DECORATIVE_CAMERA_SETTLE_BUFFER_MS = 180;
const NEARBY_PLACES_MIN_ZOOM = 8.4;
const NEARBY_PLACES_REFRESH_DEBOUNCE_MS = 1400;
const NEARBY_PLACES_MIN_LIMIT = 72;
const NEARBY_PLACES_MAX_LIMIT = 144;
const NEARBY_PLACES_SIGNATURE_COORDINATE_PRECISION = 5;
const NEARBY_PLACES_SIGNATURE_ZOOM_PRECISION = 2;
const NEARBY_PLACE_MARKER_OFFSET: [number, number] = [0, 0];
const NEARBY_PLACE_POPUP_FALLBACK_PHOTO_WIDTH = 512;
const MAP_POI_LABEL_MIN_ZOOM = 9.25;
const MAP_SUBTLE_POI_LABEL_MIN_ZOOM = 9.7;
const MAP_POI_ICON_SIZE = ['interpolate', ['linear'], ['zoom'], 8.8, 0.82, 13.5, 1, 17, 1.14];
const MAP_POI_ICON_OPACITY = ['interpolate', ['linear'], ['zoom'], 8.05, 0, 8.65, 0.84, 9.4, 1, 15, 1];
const MAP_SUBTLE_POI_ICON_OPACITY = ['interpolate', ['linear'], ['zoom'], 8.3, 0, 8.9, 0.74, 11, 0.94, 16, 1];
const MAP_MUTED_POI_ICON_OPACITY = ['interpolate', ['linear'], ['zoom'], 8.3, 0, 8.9, 0.38, 12, 0.52, 16, 0.64];
const MAP_POI_LABEL_OPACITY = ['interpolate', ['linear'], ['zoom'], 9.25, 0, 10.05, 0.74, 16, 0.92];
const MAP_SUBTLE_POI_LABEL_OPACITY = ['interpolate', ['linear'], ['zoom'], 9.7, 0, 10.65, 0.58, 17, 0.74];
const MAP_POI_FALLBACK_ICON_IMAGE = 'scope-poi-marker';
const MAP_MUTED_POI_ICON_NAMES = [
  'barrier',
  'barrier-15',
  'cross',
  'cross-15',
  'entrance',
  'entrance-15',
  'gate',
  'gate-15',
  'marker-stroked',
  'marker-stroked-15',
] as const;
const WATER_REFERENCE_LABELS: readonly WaterReferenceLabel[] = [
  { id: 'lake-superior', name: 'Lake Superior', coordinates: [-87.15, 47.7], minZoom: 2.15 },
  { id: 'lake-michigan', name: 'Lake Michigan', coordinates: [-87.05, 44.08], minZoom: 2.15 },
  { id: 'lake-huron', name: 'Lake Huron', coordinates: [-82.45, 44.72], minZoom: 2.15 },
  { id: 'lake-erie', name: 'Lake Erie', coordinates: [-81.25, 42.2], minZoom: 2.25 },
  { id: 'lake-ontario', name: 'Lake Ontario', coordinates: [-77.95, 43.65], minZoom: 2.35 },
] as const;
const MAP_NIGHT_ADMIN_0_BOUNDARY_COLOR = 'rgb(128, 145, 186)';
const MAP_NIGHT_ADMIN_1_BOUNDARY_COLOR = 'rgb(142, 160, 204)';
const MAP_NIGHT_ADMIN_0_BOUNDARY_OPACITY = ['interpolate', ['linear'], ['zoom'], 2, 0.62, 4.6, 0.76, 7.2, 0.86, 10, 0.84];
const MAP_NIGHT_ADMIN_1_BOUNDARY_OPACITY = ['interpolate', ['linear'], ['zoom'], 2, 0.66, 4.6, 0.82, 7.2, 0.94, 10, 0.9];
const MAP_NIGHT_ADMIN_0_BOUNDARY_WIDTH = ['interpolate', ['linear'], ['zoom'], 2, 0.88, 4.6, 1.12, 7.2, 1.32, 10, 1.24];
const MAP_NIGHT_ADMIN_1_BOUNDARY_WIDTH = ['interpolate', ['linear'], ['zoom'], 2, 0.94, 4.6, 1.22, 7.2, 1.52, 10, 1.42];
const MAP_NIGHT_PRIMARY_ROAD_OPACITY = ['interpolate', ['linear'], ['zoom'], 2, 0.18, 3.6, 0.32, 5.2, 0.5, 6.8, 0.7, 9.5, 0.9, 13, 0.96];
const MAP_NIGHT_PRIMARY_ROAD_WIDTH = ['interpolate', ['linear'], ['zoom'], 2, 0.28, 4.2, 0.58, 6.6, 1.1, 10, 1.86, 14, 3.2];
const MAP_NIGHT_LOCAL_ROAD_OPACITY = ['interpolate', ['linear'], ['zoom'], 5.8, 0.04, 8.2, 0.2, 10.2, 0.5, 12.8, 0.72, 15, 0.86];
const MAP_NIGHT_SIMPLE_ROAD_OPACITY = ['interpolate', ['linear'], ['zoom'], 5.8, 0.06, 8.2, 0.24, 10.2, 0.56, 14, 0.88];
const MAP_NIGHT_ROAD_CASING_OPACITY = ['interpolate', ['linear'], ['zoom'], 4.8, 0.02, 7.4, 0.16, 10, 0.38, 14, 0.58];
const MAP_NIGHT_LOCAL_ROAD_WIDTH = ['interpolate', ['linear'], ['zoom'], 6, 0.12, 8.2, 0.26, 10.2, 0.68, 13, 1.28, 16, 2.35];
const MAP_NIGHT_SIMPLE_ROAD_WIDTH = ['interpolate', ['linear'], ['zoom'], 5.8, 0.12, 8.4, 0.34, 10.8, 0.94, 14, 2.5, 18, 10];
const MAP_NATIVE_MAJOR_ROAD_OPACITY = ['interpolate', ['linear'], ['zoom'], 3, 0.22, 5, 0.38, 6.8, 0.64, 9, 0.9, 14, 1];
const MAP_FEATURE_CLICK_RADIUS_PX = 24;
const MAP_FEATURE_PLACE_PIN_LIMIT = 30;
const MAP_STYLE_TRANSITION_TIMEOUT_MS = 3600;
const MAP_STYLE_TRANSITION_MIN_VISIBLE_MS = 220;
const MAP_STYLE_SWITCH_TRANSITION_TIMEOUT_MS = 1500;
const MAP_STYLE_SWITCH_TRANSITION_MIN_VISIBLE_MS = 420;
const MAP_STYLE_SWITCH_SETTLE_TIMEOUT_MS = 700;
const MAP_STYLE_SNAPSHOT_FADE_MS = 780;
const MAP_STYLE_PRESENTATION_SETTLE_FRAMES = 1;
const MAP_STYLE_PRESENTATION_REFRESH_DELAYS_MS = [80, 240] as const;
const MAP_CONTROL_ZOOM_RESET_MS = 760;
const MAP_CONTROL_ZOOM_DURATION_MS = 520;
const MAP_CONTROL_ZOOM_VIEWPORT_SYNC_BUFFER_MS = 220;
const MAP_LOCATION_FOCUS_MIN_ZOOM = 13.65;
const MAP_LOCATION_FOCUS_MAX_ZOOM = 15.25;
const MAP_LOCATION_FOCUS_TARGET_ZOOM = 13.35;
const MAP_LOCATION_FOCUS_ZOOM_STEP = 1.05;
const MAP_LOCATION_FAR_FOCUS_SOURCE_ZOOM = 7;
const MAP_LOCATION_FAR_FOCUS_MAX_ZOOM = 9.75;
const MAP_LOCATION_FAR_FOCUS_ZOOM_DELTA = 2;
const MAP_LOCATION_FAR_FOCUS_ZOOM_DELAY_MS = 180;
const MAP_LOCATION_FAR_FOCUS_ZOOM_DURATION_MS = 760;
const MAP_SPOT_FOCUS_ZOOM = 13;
const MAP_LOCATION_FOCUS_DURATION_MS = 1800;
const MAP_LOCATION_FOCUS_MIN_DURATION_MS = 1180;
const MAP_LOCATION_FOCUS_MAX_DURATION_MS = 2200;
const MAP_LOCATION_FIRST_FOCUS_EXTRA_MS = 260;
const MAP_LOCATION_FIRST_FOCUS_MAX_DURATION_MS = MAP_LOCATION_FOCUS_MAX_DURATION_MS + 420;
const MAP_PENDING_LOCATION_CAMERA_RETRY_MS = 120;
const MAP_INITIAL_AUTO_LOCATE_RETRY_MS = 90;
const MAP_PLANNER_TRACKPAD_ZOOM_RATE = 1 / 320;
const MAP_PLANNER_WHEEL_ZOOM_RATE = 1 / 1500;
const MAP_TILE_SETTLE_TIMEOUT_MS = 1450;
const MAP_TILE_SETTLE_AFTER_IDLE_MS = 160;
const MAP_PLANNER_TILE_SETTLE_TIMEOUT_MS = 900;
const MAP_PLANNER_TILE_SETTLE_AFTER_IDLE_MS = 90;
const MAP_RENDER_GATE_TIMEOUT_MS = 3600;
const MAP_RENDER_GATE_MIN_VISIBLE_MS = 220;
const MAP_RENDER_GATE_REVEAL_DELAY_MS = 80;
const MAP_PRIORITY_CAMERA_GATE_TIMEOUT_MS = 4800;
const MAP_PRIORITY_CAMERA_GATE_MIN_VISIBLE_MS = 640;
const MAP_RENDER_READY_RETRY_MS = 120;
const MAP_RENDER_READY_MAX_RETRIES = 8;
const MAP_RENDER_READY_SETTLE_FRAMES = 2;
const MAP_SYMBOL_FADE_DURATION_MS = 360;
const MAP_PLANNER_TILE_FADE_DURATION_MS = 0;
const MAP_PLANNER_GLOBE_RESTORE_DELAY_MS = 700;
const MAP_LOCATION_GLOBE_RESTORE_DELAY_MS = 2600;
const MAP_PLANNER_CANVAS_LOAD_REVEAL_DELAY_MS = 80;
const MAP_PLANNER_CANVAS_REVEAL_FALLBACK_MS = 340;
const MAP_PLANNER_CANVAS_REVEAL_RETRY_MS = 100;
const MAP_PLANNER_CANVAS_REVEAL_MAX_WAIT_MS = 1800;
const MAP_PLANNER_PRELOAD_SURFACE_HOLD_MS = 40;
const MAP_PLANNER_PRELOAD_SURFACE_FADE_MS = 160;
const MAP_PLANNER_INITIAL_DIM_FLASH_MS = 500;
const MAP_PLANNER_RESET_DIM_FLASH_MS = 260;
const MAP_CAMERA_CENTER_TOLERANCE = 0.0001;
const MAP_CAMERA_ZOOM_TOLERANCE = 0.035;
const MAP_CAMERA_ANGLE_TOLERANCE = 0.15;
const MAP_LOCATION_CENTER_TOLERANCE = 0.0004;
const MAP_LOCATION_ZOOM_TOLERANCE = 0.06;
const MAP_POINTER_HANDLER_THROTTLE_MS = 60;
const MAP_FEATURE_PREFETCH_DEBOUNCE_MS = 280;
const MAP_FEATURE_PREFETCH_RADIUS_PX = MAP_FEATURE_CLICK_RADIUS_PX;
const MAP_FEATURE_PLACE_CLICK_PHOTO_WAIT_MS = 720;
const MAP_FEATURE_VISIBLE_PHOTO_PREFETCH_LIMIT = 12;
const MAP_FEATURE_VISIBLE_PHOTO_PREFETCH_DEBOUNCE_MS = 260;
const MAP_LOCATION_FOLLOW_UPDATE_DURATION_MS = 720;
const MAP_FEATURE_VISIBLE_PHOTO_PREFETCH_MIN_ZOOM = 12.4;
const MAP_SINGLE_ROUTE_POINT_FIT_ZOOM = 13;
const MAP_STATE_NAME_LABEL_TEXT_FIELD = ['coalesce', ['get', 'name_en'], SCOPE_US_STATE_NAME_LABEL_TEXT_FIELD, ['get', 'name_script']] as const;
const MAP_STATE_NAME_LABEL_MIN_ZOOM = 5.45;
const MAP_STATE_NAME_LABEL_TEXT_FIELD_BY_ZOOM = ['step', ['zoom'], '', MAP_STATE_NAME_LABEL_MIN_ZOOM, MAP_STATE_NAME_LABEL_TEXT_FIELD] as const;
const MAP_GLOBAL_REGION_LABEL_MIN_ZOOM = 3.35;
const MAP_GLOBAL_REGION_LABEL_TEXT_FIELD_BY_ZOOM = ['step', ['zoom'], '', MAP_GLOBAL_REGION_LABEL_MIN_ZOOM, MAP_STATE_NAME_LABEL_TEXT_FIELD] as const;
const MAP_REFERENCE_LABEL_TEXT_SIZE = ['interpolate', ['linear'], ['zoom'], 2, 10.5, 3.6, 12.5, 5.8, 15];
const MAP_STATE_REFERENCE_LABEL_TEXT_SIZE = ['interpolate', ['linear'], ['zoom'], 5.25, 11.5, 6.2, 13.5, 7.8, 15];
const MAP_STATE_NAME_LABEL_OPACITY = ['interpolate', ['linear'], ['zoom'], 5.35, 0, 5.85, 0.36, 6.6, 0.78, 7.4, 0.9];
const MAP_GLOBAL_REGION_LABEL_OPACITY = ['interpolate', ['linear'], ['zoom'], 3.15, 0, 3.65, 0.42, 5.2, 0.74, 7.4, 0.88];
const MAP_COUNTRY_LABEL_MAX_ZOOM = 3.2;
const MAP_COUNTRY_LABEL_OPACITY = ['interpolate', ['linear'], ['zoom'], 1, 0.76, 2.55, 0.62, 3.15, 0];
const MAP_CONTEXT_LABEL_MIN_ZOOM = 5.45;
const MAP_CONTEXT_LABEL_OPACITY = ['interpolate', ['linear'], ['zoom'], 5.15, 0, 5.85, 0.42, 7.2, 0.76, 10, 0.86];
const MAP_WATER_LABEL_MIN_ZOOM = 1.15;
const MAP_STATES_MODE_WATER_LABEL_MIN_ZOOM = 3.2;
const MAP_WATER_LABEL_OPACITY = ['interpolate', ['linear'], ['zoom'], 1.05, 0.72, 2.4, 0.86, 5, 0.92, 10, 0.84];
const MAP_STATES_MODE_WATER_LABEL_OPACITY = ['interpolate', ['linear'], ['zoom'], 3.05, 0, 3.35, 0.36, 5.4, 0.64, 10, 0.72];
const MAP_WATER_REFERENCE_SOURCE_ID = 'scope-water-reference-labels';
const MAP_WATER_REFERENCE_LAYER_ID = 'scope-water-reference-labels';
const MAP_WATER_REFERENCE_TEXT_FIELD = ['get', 'name'] as const;
const MAP_WATER_REFERENCE_MAX_ZOOM = 9.2;
const MAP_WATER_REFERENCE_TEXT_SIZE = ['interpolate', ['linear'], ['zoom'], 2.35, 10.25, 4.35, 11.5, 6.2, 13, 7.8, 14.5] as const;
const MAP_WATER_REFERENCE_TEXT_OPACITY = [
  'interpolate',
  ['linear'],
  ['zoom'],
  1.9,
  0,
  2.35,
  0.86,
  5.8,
  0.95,
  8.2,
  0.76,
  9.2,
  0,
] as const;
const MAP_STATES_MODE_WATER_REFERENCE_TEXT_OPACITY = [
  'interpolate',
  ['linear'],
  ['zoom'],
  3.05,
  0,
  3.35,
  0.36,
  6.4,
  0.6,
  9.2,
  0,
] as const;
const MAP_SCOPE_SOLID_LABEL_OPACITY = 1;
const MAP_SCOPE_REFERENCE_LABEL_COLOR = 'rgb(232, 238, 246)';
const MAP_SCOPE_REFERENCE_LABEL_HALO_COLOR = 'rgb(14, 22, 29)';
const MAP_NATIVE_REFERENCE_LABEL_COLOR = 'rgb(76, 88, 91)';
const MAP_NATIVE_REFERENCE_LABEL_HALO_COLOR = 'rgb(244, 250, 241)';
const MAP_SCOPE_BACKGROUND_COLOR = 'rgb(12, 17, 24)';
const MAP_SCOPE_WATER_FILL_COLOR = 'rgb(38, 84, 106)';
const MAP_SCOPE_WATER_FILL_OPACITY = 0.92;
const MAP_SCOPE_LANDUSE_FILL_COLOR = [
  'match',
  ['get', 'class'],
  ['park', 'grass', 'pitch', 'golf_course', 'wood', 'national_park'],
  'rgb(80, 151, 75)',
  ['school', 'college', 'university', 'hospital', 'commercial', 'industrial', 'airport'],
  'rgb(62, 54, 42)',
  ['sand', 'scrub', 'desert', 'bare_rock'],
  'rgb(52, 46, 36)',
  'rgb(18, 25, 32)',
];
const MAP_NATIVE_LANDCOVER_FILL_COLOR = [
  'match',
  ['get', 'class'],
  'crop',
  'rgb(213, 224, 152)',
  'grass',
  'rgb(188, 221, 160)',
  'wood',
  'rgb(128, 184, 124)',
  'scrub',
  'rgb(218, 195, 133)',
  'sand',
  'rgb(218, 196, 138)',
  'desert',
  'rgb(218, 196, 138)',
  'snow',
  'rgb(246, 248, 244)',
  'rgb(226, 209, 157)',
];
const MAP_SCOPE_LANDCOVER_FILL_COLOR = 'rgb(18, 25, 32)';
const MAP_NATIVE_ARID_FILL_COLOR = 'rgb(218, 196, 138)';
const MAP_SCOPE_ARID_FILL_COLOR = 'rgb(52, 46, 36)';
const MAP_PRESENTATION_PAINT_TRANSITION = { duration: 420, delay: 0 } as const;
const MAP_SCOPE_FILL_TRANSITION = MAP_PRESENTATION_PAINT_TRANSITION;
const MAP_SCOPE_GLOBE_FOG: MapFogStyle = {
  color: 'rgb(38, 53, 66)',
  'high-color': 'rgb(63, 91, 108)',
  'horizon-blend': 0.012,
  range: [1.6, 8.8],
  'space-color': 'rgb(7, 13, 22)',
  'star-intensity': 0.02,
};
const MAP_NATIVE_GLOBE_FOG: MapFogStyle = {
  color: 'rgb(24, 39, 50)',
  'high-color': 'rgb(70, 108, 128)',
  'horizon-blend': 0.002,
  range: [5.2, 11.5],
  'space-color': 'rgb(8, 15, 24)',
  'star-intensity': 0.01,
};
const MAP_NATIVE_ADMIN_0_BOUNDARY_OPACITY = ['interpolate', ['linear'], ['zoom'], 1, 0.64, 3, 0.76, 5, 0.86, 7, 0.94, 10, 0.98];
const MAP_NATIVE_ADMIN_1_BOUNDARY_OPACITY = ['interpolate', ['linear'], ['zoom'], 1, 0.64, 3, 0.78, 5, 0.88, 7, 0.96, 10, 0.98];
const MAP_NATIVE_ADMIN_0_BOUNDARY_WIDTH = ['interpolate', ['linear'], ['zoom'], 1, 0.84, 4, 1.16, 7, 1.48, 10, 1.68];
const MAP_NATIVE_ADMIN_1_BOUNDARY_WIDTH = ['interpolate', ['linear'], ['zoom'], 1, 0.82, 4, 1.18, 7, 1.58, 10, 1.82];
const MAP_STATES_MODE_CONTEXT_LABEL_MIN_ZOOM = 6.45;
const MAP_STATES_MODE_ROAD_LABEL_MIN_ZOOM = 6.35;
const MAP_ADMIN_STATE_BOUNDARY_DASHARRAY = [2, 0.001] as const;
const MAP_NATIVE_LOCAL_ROAD_COLOR = 'rgb(224, 228, 220)';
const MAP_NATIVE_LOCAL_ROAD_CASING_COLOR = 'rgb(241, 245, 236)';
const MAP_NATIVE_LOCAL_ROAD_OPACITY = ['interpolate', ['linear'], ['zoom'], 6.4, 0, 8.4, 0.12, 10, 0.38, 13, 0.68, 16, 0.82];
const MAP_NATIVE_ROAD_CASING_OPACITY = ['interpolate', ['linear'], ['zoom'], 4.8, 0, 6.8, 0.16, 8.6, 0.42, 12, 0.66, 15, 0.74];
const MAP_NATIVE_MAJOR_ROAD_WIDTH = ['interpolate', ['linear'], ['zoom'], 3, 0.52, 5, 0.98, 7, 1.55, 10, 2.35, 14, 3.6];
const MAP_NATIVE_LOCAL_ROAD_WIDTH = ['interpolate', ['linear'], ['zoom'], 6, 0.08, 8, 0.18, 11, 0.55, 14, 1.2, 17, 2.1];
const MAP_NATIVE_SIMPLE_ROAD_OPACITY = ['interpolate', ['linear'], ['zoom'], 5.8, 0.03, 7.8, 0.24, 10, 0.64, 14, 0.94];
const MAP_NATIVE_SIMPLE_ROAD_WIDTH = ['interpolate', ['linear'], ['zoom'], 5, 0.2, 10, 1.2, 14, 3.4, 18, 12];
const MAP_NATIVE_SIMPLE_ROAD_COLOR = [
  'match',
  ['get', 'class'],
  ['motorway', 'motorway_link', 'trunk', 'trunk_link'],
  'rgb(132, 142, 142)',
  ['primary', 'primary_link'],
  'rgb(154, 163, 160)',
  ['secondary', 'tertiary'],
  'rgb(192, 198, 190)',
  MAP_NATIVE_LOCAL_ROAD_COLOR,
];
const MAP_TRAFFIC_MODERATE_COLOR = 'rgb(217, 138, 36)';
const MAP_TRAFFIC_HEAVY_COLOR = 'rgb(240, 68, 56)';
const MAP_TRAFFIC_SEVERE_COLOR = 'rgb(197, 22, 45)';
const MAP_TRAFFIC_CLOSURE_COLOR = 'rgb(118, 84, 215)';
const MAP_TRAFFIC_ALERT_COLOR = [
  'match',
  ['get', 'congestion'],
  'heavy',
  MAP_TRAFFIC_HEAVY_COLOR,
  'severe',
  MAP_TRAFFIC_SEVERE_COLOR,
  'closed',
  MAP_TRAFFIC_CLOSURE_COLOR,
  MAP_TRAFFIC_SEVERE_COLOR,
];
const MAP_TRAFFIC_FLOW_OPACITY = ['interpolate', ['linear'], ['zoom'], 7.6, 0, 8.6, 0.52, 11, 0.8, 15, 0.92];
const MAP_TRAFFIC_ALERT_OPACITY = ['interpolate', ['linear'], ['zoom'], 7.8, 0, 8.6, 0.72, 11, 0.92, 15, 1];
const MAP_TRAFFIC_FLOW_LINE_WIDTH = ['interpolate', ['linear'], ['zoom'], 7.8, 0.72, 9.6, 1.28, 11.5, 2.55, 14.5, 5.3, 16.5, 8.1];
const MAP_TRAFFIC_ALERT_LINE_WIDTH = ['interpolate', ['linear'], ['zoom'], 7.8, 0.86, 9.6, 1.55, 11.5, 3.05, 14.5, 6.15, 16.5, 9.1];
const MAP_TRAFFIC_FLOW_CASING_WIDTH = ['interpolate', ['linear'], ['zoom'], 7.8, 2.05, 9.6, 3.05, 11.5, 5.05, 14.5, 9.05, 16.5, 12.2];
const MAP_TRAFFIC_ALERT_CASING_WIDTH = ['interpolate', ['linear'], ['zoom'], 7.8, 2.35, 9.6, 3.55, 11.5, 5.85, 14.5, 10.15, 16.5, 13.2];
const MAP_TRAFFIC_SOURCE_ID = 'scope-mapbox-traffic';
const MAP_TRAFFIC_SOURCE_LAYER = 'traffic';
const MAP_TRAFFIC_SOURCE_URL = 'mapbox://mapbox.mapbox-traffic-v1';
const MAP_TERRAIN_SOURCE_ID = 'scope-mapbox-terrain';
const MAP_TERRAIN_LAYER_IDS = [
  'scope-terrain-crop',
  'scope-terrain-grass',
  'scope-terrain-scrub',
  'scope-terrain-wood',
  'scope-terrain-snow',
  'scope-terrain-hillshade-shadow',
] as const;
const MAP_TRAFFIC_LAYER_IDS = [
  'scope-traffic-flow-casing',
  'scope-traffic-flow',
  'scope-traffic-alert-casing',
  'scope-traffic-alert',
  'scope-traffic-closures',
] as const;
const MAP_TRAFFIC_LEGACY_LAYER_IDS = ['scope-traffic-low'] as const;
const MAP_TRAFFIC_ALL_LAYER_IDS = [...MAP_TRAFFIC_LAYER_IDS, ...MAP_TRAFFIC_LEGACY_LAYER_IDS] as const;
const MAP_SCOPE_ROAD_CONTEXT_LAYER_IDS = [
  'scope-dark-road-context-major',
  'scope-dark-road-context-secondary',
] as const;
const MAP_TRAFFIC_MAJOR_ROAD_CLASSES = [
  'motorway',
  'motorway_link',
  'trunk',
  'trunk_link',
  'primary',
  'primary_link',
] as const;
const MAP_CONTEXT_SECONDARY_ROAD_CLASSES = [
  'secondary',
  'secondary_link',
  'tertiary',
  'tertiary_link',
] as const;
const NEARBY_PLACE_PHOTO_PRELOAD_CACHE_LIMIT = 96;
const NEARBY_PLACE_POPOVER_VIEWPORT_PADDING_PX = 12;
const NEARBY_PLACE_POPOVER_MIN_HEIGHT_PX = 172;
const MAP_FEATURE_PLACE_POPUP_VIEWPORT_PADDING_PX = 14;
const MAP_FEATURE_PLACE_POPUP_OFFSET_PX = 42;
const MAP_FEATURE_PLACE_POPUP_ESTIMATED_HALF_WIDTH_PX = 144;
const MAP_FEATURE_PLACE_POPUP_ESTIMATED_PHOTO_HEIGHT_PX = 268;
const MAP_FEATURE_PLACE_POPUP_ESTIMATED_TEXT_HEIGHT_PX = 190;
const MAP_FEATURE_PLACE_POPUP_MIN_ZOOM = MAP_POI_LABEL_MIN_ZOOM + 0.35;
const MAP_FEATURE_PLACE_POPUP_RENDER_RADIUS_PX = 36;
const MAP_TRAFFIC_LINE_CASING_WIDTH = MAP_TRAFFIC_FLOW_CASING_WIDTH;
const MAP_ROAD_SHIELD_ICON_SIZE = ['interpolate', ['linear'], ['zoom'], 6.4, 0.76, 8, 0.9, 11, 1, 14, 1.12];
const MAP_ROAD_SHIELD_TEXT_SIZE = ['interpolate', ['linear'], ['zoom'], 6.4, 8.2, 8, 8.8, 11, 9.4, 14, 10.2];
const MAP_ROAD_SHIELD_SPACING = ['interpolate', ['linear'], ['zoom'], 6.4, 240, 8, 300, 11, 400, 14, 560];
const fallbackTerrainPaths = [
  'M 54 142 C 148 74 298 56 422 118 C 534 176 586 292 560 384 C 526 510 380 562 268 618 C 198 652 146 734 88 712 C 30 690 38 590 26 484 C 16 390 -18 198 54 142 Z',
  'M 298 468 C 370 392 520 370 612 430 C 722 504 742 646 676 742 C 614 828 458 860 340 806 C 236 758 204 566 298 468 Z',
  'M 690 112 C 796 60 944 86 1034 178 C 1128 274 1146 444 1076 556 C 998 682 810 730 680 672 C 574 624 534 448 570 316 C 596 220 622 144 690 112 Z',
  'M 888 586 C 960 542 1050 556 1114 620 C 1182 690 1182 802 1106 850 C 1018 906 854 902 786 822 C 734 760 786 648 888 586 Z',
];
const fallbackRingSizes = [168, 248, 332];
const FALLBACK_MARKER_CLEARANCE = 88;
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
const FALLBACK_DYNAMIC_OFFSET_START_RADIUS = 128;
const FALLBACK_DYNAMIC_OFFSET_RING_GAP = 48;

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

type DocumentThemeMode = 'dark' | 'light';

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
    labelMode?: MapLabelMode;
    mapPresentation?: MapPresentationMode;
    showMapStyleToggle?: boolean;
    showProjectionToggle?: boolean;
    persistMapPreferences?: boolean;
    usePlannerCameraMotion?: boolean;
    flatProjectionViewport?: MapViewport;
    showTraffic?: boolean;
    markerVariant?: 'default' | 'sequence';
    routeVariant?: 'default' | 'planner';
    showWeatherBadge?: boolean;
    showNearbyPlaces?: boolean;
    autoSearchNearbyPlaces?: boolean;
    nearbyPlacePins?: MapNearbyPlacePin[];
    allowRoutePointRemoval?: boolean;
    autoLocateOnLoad?: boolean;
    autoLocateZoom?: number;
    autoFitRouteOnLoad?: boolean;
    singleRoutePointZoom?: number;
    plainPinMarker?: boolean;
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
    labelMode: 'full',
    mapPresentation: 'scope',
    showMapStyleToggle: false,
    showProjectionToggle: false,
    persistMapPreferences: true,
    usePlannerCameraMotion: false,
    flatProjectionViewport: undefined,
    showTraffic: false,
    markerVariant: 'default',
    routeVariant: 'default',
    showWeatherBadge: true,
    showNearbyPlaces: true,
    autoSearchNearbyPlaces: false,
    nearbyPlacePins: () => [],
    allowRoutePointRemoval: false,
    autoLocateOnLoad: false,
    autoLocateZoom: 13.5,
    autoFitRouteOnLoad: true,
    singleRoutePointZoom: MAP_SINGLE_ROUTE_POINT_FIT_ZOOM,
    plainPinMarker: false,
  },
);

function usesPlannerCameraMotion(): boolean {
  return props.routeVariant === 'planner' || props.usePlannerCameraMotion;
}

const emit = defineEmits<{
  (event: 'spot-select', spot: MapPoint): void;
  (event: 'location-update', location: UserLocation): void;
  (event: 'map-click', payload: { latitude: number; longitude: number }): void;
  (event: 'nearby-place-add', place: MapNearbyPlacePin): void;
  (event: 'route-point-remove', point: MapPoint): void;
  (event: 'interaction', payload: { type: string }): void;
}>();

const allCategories: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'entertainment', 'scenic', 'other'];
const mapStore = useMapStore();
const mapContainer = ref<HTMLDivElement | null>(null);
const map = shallowRef<mapboxgl.Map | null>(null);
const mapboxRuntime = shallowRef<typeof mapboxgl | null>(null);
const locationTracker = ref<LocationTrackerInstance | null>(null);
const markerControllers = new Map<string, MarkerController>();
const nearbyPlaceMarkerControllers = new Map<string, NearbyPlaceMarkerController>();
const scopeMapPaintOverrides = new Map<string, Map<string, unknown>>();
const userMarker = shallowRef<mapboxgl.Marker | null>(null);
const initialFitSignature = ref('');
const shouldCenterOnNextFix = ref(false);
const isFollowingUserLocation = ref(false);
const trackingState = ref<TrackingState>('idle');
const liveRouteOverlayPath = ref('');
const liveRouteOverlaySize = ref({ width: 1, height: 1 });
const measuredVisiblePinCount = ref<number | null>(null);
const autoRoadRoute = ref<{ signature: string; summary: RoadRouteSummary } | null>(null);
const mapWeatherSnapshot = ref<WeatherSnapshot | null>(null);
const mapWeatherRequestId = ref(0);
const nearbyPlacesRequestId = ref(0);
const nearbyViewportPlacePins = ref<MapNearbyPlacePin[]>([]);
const mapFeaturePlacePins = ref<MapNearbyPlacePin[]>([]);
const lastUserLocation = ref<UserLocation | null>(null);
const activeNearbyPlaceMarkerId = ref<string | null>(null);
const hasToken = hasMapboxToken();
const allowInteractiveMapInUiTests = import.meta.env.VITE_ENABLE_MAPBOX_IN_UI_TESTS === 'true';
const interactiveMapEnabled = ref(hasToken && (allowInteractiveMapInUiTests || !isUiTestEnvironment()));
const mapStyle = ref(mapStore.viewport.style);
const isMapStyleTransitioning = ref(interactiveMapEnabled.value);
const isMapCameraTransitioning = ref(false);
const isMapCameraMoving = ref(false);
const isMapCameraVisualSettlingSuppressed = ref(false);
const isMapTileSettling = ref(interactiveMapEnabled.value);
const isMapRenderGateActive = ref(interactiveMapEnabled.value);
const isPlannerMapCanvasRevealed = ref(false);
const isPlannerMapCanvasPreviewing = ref(false);
const isPlannerMapCanvasRevealing = ref(false);
const isMapQuickDimVisible = ref(false);
const activeMapStyleMode = ref<MapPresentationMode>(readMapStyleModePreference() ?? props.mapPresentation);
const activeMapProjectionMode = ref<MapProjectionName>(resolveInitialMapProjectionMode());
const mapStyleTransitionCoverMode = ref<MapPresentationMode>(activeMapStyleMode.value);
const mapStyleTransitionVariant = ref<MapStyleTransitionVariant>('load');
const mapStyleTransitionSnapshotUrl = ref('');
const isMapStyleTransitionSnapshotVisible = ref(false);
const isMapStyleTransitionSnapshotTinted = ref(false);
const currentDocumentTheme = ref<DocumentThemeMode>(getDocumentTheme());
const mapStyleModeOptions = [
  {
    mode: 'scope' as const,
    label: 'Dark',
    iconName: 'moon',
    ariaLabel: 'Use Scope dark map',
  },
  {
    mode: 'native' as const,
    label: 'Bright',
    iconName: 'sun',
    ariaLabel: 'Use bright map',
  },
] as const;
const mapProjectionModeOptions = [
  {
    mode: 'mercator' as const,
    label: '2D',
    title: 'Flat map',
    iconName: 'map',
    ariaLabel: 'Use flat 2D map',
  },
  {
    mode: 'globe' as const,
    label: '3D',
    title: '3D globe',
    iconName: 'globe',
    ariaLabel: 'Use 3D globe map',
  },
] as const;
const effectiveMapPresentation = computed<MapPresentationMode>(() => (
  props.showMapStyleToggle
    ? activeMapStyleMode.value
    : (props.mapPresentation === 'scope' && currentDocumentTheme.value === 'light' ? 'native' : props.mapPresentation)
));

function markMapRuntimeFailed(): void {
  cancelScheduledMarkerRender();
  clearMapStyleTransitionTimer();
  clearMapStyleTransitionSnapshot();
  clearMapStylePresentationRefreshes();
  clearMapPostStyleResizeTimers();
  clearMapRenderHealthTimers();
  clearMapTileSettlingTimer();
  clearMapRenderGateTimer();
  clearMapCameraTransitionTimers();
  clearLocationCameraAnimation();
  clearPlannerMapCanvasPreviewFrame();
  clearPlannerMapCanvasRevealTimer();
  clearPlannerMapPreloadSurfaceTimer();
  clearMapQuickDimTimer();
  clearPlannerGlobeRestoreTimer();
  clearMapFeaturePlacePrefetchTimer();
  clearVisibleMapFeaturePlacePhotoPrefetchTimer();
  clearPendingLocationCameraFlushTimer();
  clearPendingInitialAutoLocateFocus();
  pendingLocationCameraSignature = null;
  pendingResetCameraSignature = null;
  hasCompletedUserLocationFlight = false;
  hasRequestedInitialUserLocation = false;
  isMapStyleTransitioning.value = false;
  isMapCameraTransitioning.value = false;
  isMapCameraVisualSettlingSuppressed.value = false;
  isMapTileSettling.value = false;
  isMapRenderGateActive.value = false;
  isPlannerMapCanvasRevealed.value = true;
  isPlannerMapCanvasPreviewing.value = false;
  isPlannerMapCanvasRevealing.value = false;
  isMapQuickDimVisible.value = false;
  mapRenderGateMinimumVisibleUntil = 0;
  clearMapFeaturePlacePopup();
  clearSpotMarkers();
  clearNearbyPlaceMarkers();
  mapFeaturePlacePins.value = [];
  lastVisibleMapFeaturePhotoPrefetchSignature = '';
  activeMapProjectionName = null;
  activeScopedMapPresentation = null;
  liveRouteOverlayPath.value = '';
  if (interactiveMapEnabled.value) {
    interactiveMapEnabled.value = false;
  }
}

let themeObserver: MutationObserver | null = null;
let syncingViewport = false;
let syncingViewportReleaseVersion = 0;
let suppressViewportCameraSyncUntil = 0;
let markerRenderVersion = 0;
let markerRenderRequestId = 0;
let markerRenderFrameHandle: number | null = null;
let isMarkerRenderQueued = false;
let autoRoadRouteRequestId = 0;
let autoLocateRequestId = 0;
let manualLocateRequestId = 0;
let hasRequestedInitialUserLocation = false;
let mapWeatherRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let nearbyPlacesRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let nearbyPlacesViewportSignature = '';
let mapFeaturePlacePrefetchTimer: ReturnType<typeof setTimeout> | null = null;
let pendingMapFeaturePlacePrefetch:
  | { point: { x: number; y: number }; lngLat: mapboxgl.LngLat }
  | null = null;
let lastMapFeaturePlacePrefetchKey = '';
let mapFeatureVisiblePhotoPrefetchTimer: ReturnType<typeof setTimeout> | null = null;
let lastVisibleMapFeaturePhotoPrefetchSignature = '';
let containerResizeObserver: ResizeObserver | null = null;
let mapResizeFrameHandle: number | null = null;
let liveRouteOverlayFrameHandle: number | null = null;
let activePopoverPlacementFrameHandle: number | null = null;
let mapStyleSwapVersion = 0;
let mapStyleTransitionTimer: ReturnType<typeof setTimeout> | null = null;
let mapTileSettlingTimer: ReturnType<typeof setTimeout> | null = null;
let mapRenderGateTimer: ReturnType<typeof setTimeout> | null = null;
let mapRenderGateMinimumVisibleUntil = 0;
let mapStyleTransitionStartedAt = 0;
let mapStyleTransitionSnapshotTimer: ReturnType<typeof setTimeout> | null = null;
let mapStyleTransitionSnapshotTintFrame: number | null = null;
let mapCameraTransitionTimer: ReturnType<typeof setTimeout> | null = null;
let mapCameraTransitionReadyTimer: ReturnType<typeof setTimeout> | null = null;
let mapCameraTransitionStartedAt = 0;
let mapCameraTransitionVersion = 0;
let plannerMapCanvasRevealTimer: ReturnType<typeof setTimeout> | null = null;
let plannerMapPreloadSurfaceTimer: ReturnType<typeof setTimeout> | null = null;
let mapQuickDimTimer: ReturnType<typeof setTimeout> | null = null;
let plannerMapCanvasPreviewFrame: number | null = null;
let plannerGlobeRestoreTimer: ReturnType<typeof setTimeout> | null = null;
let plannerMapCanvasRevealStartedAt = 0;
let locationCameraAnimationFrameHandle: number | null = null;
let locationCameraAnimationTimer: ReturnType<typeof setTimeout> | null = null;
let suppressNextCameraInteractionRenderGate = false;
let suppressNextCameraInteractionRenderGateTimer: ReturnType<typeof setTimeout> | null = null;
let nextPlannerGlobeRestoreDelayMs = MAP_PLANNER_GLOBE_RESTORE_DELAY_MS;
let deferMapDecorativeWorkUntil = 0;
const mapTransitionSnapshotHolds = new Set<'style' | 'camera'>();
let mapStylePresentationFrameHandle: number | null = null;
let mapStylePresentationRefreshTimers: ReturnType<typeof setTimeout>[] = [];
let mapPostStyleResizeTimers: ReturnType<typeof setTimeout>[] = [];
let mapRenderHealthTimers: ReturnType<typeof setTimeout>[] = [];
let mapStyleModeSelectionVersion = 0;
let mapTrafficUnavailable = false;
let activeMapProjectionName: MapProjectionName | null = null;
let activeScopedMapPresentation: MapPresentationMode | null = null;
let mapFeaturePlaceRequestId = 0;
let mapFeaturePlaceClickRequestId = 0;
const mapFeaturePlaceEnrichmentCache = new Map<string, MapFeaturePlaceEnrichment>();
const mapFeaturePlacePrefetchPromises = new Map<string, Promise<void>>();
const mapFeaturePlacePhotoPrefetchPromises = new Map<string, Promise<void>>();
const nearbyPlacePhotoPreloadCache = new Map<string, Promise<void>>();
let mapFeaturePlacePopup: mapboxgl.Popup | null = null;
let mapFeaturePlacePopupSignature = '';
let mapFeaturePlacePopupPlaceId = '';
let mapFeaturePlacePopupAnchor: MapFeaturePlacePopupAnchor | '' = '';
let suppressMapFeaturePlacePopupClose = false;
let pendingControlZoom: number | null = null;
let pendingControlZoomResetTimer: ReturnType<typeof setTimeout> | null = null;
let mapCanvasClickCaptureCleanup: (() => void) | null = null;
let hasMapCompletedInitialIdle = false;
let hasCompletedUserLocationFlight = false;
let pendingLocationCamera: { location: UserLocation; minimumZoom: number; options?: CenterOnLocationOptions } | null = null;
let pendingLocationCameraSignature: string | null = null;
let pendingLocationCameraFlushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingInitialAutoLocateFocus: { location: UserLocation; requestId: number } | null = null;
let pendingInitialAutoLocateFocusTimer: ReturnType<typeof setTimeout> | null = null;
let pendingResetCameraSignature: string | null = null;
let locationPermissionPrimeRequestId = 0;

function releaseSyncingViewportAfterFlush(): void {
  const releaseVersion = ++syncingViewportReleaseVersion;
  void nextTick(() => {
    if (releaseVersion === syncingViewportReleaseVersion) {
      syncingViewport = false;
    }
  });
}

function suppressViewportCameraSyncFor(durationMs: number): void {
  suppressViewportCameraSyncUntil = Math.max(suppressViewportCameraSyncUntil, Date.now() + durationMs);
}

function deferMapDecorativeWorkFor(durationMs: number): void {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return;
  }

  deferMapDecorativeWorkUntil = Math.max(deferMapDecorativeWorkUntil, Date.now() + durationMs);
}

function resolveMapDecorativeWorkDelay(baseDelayMs: number): number {
  const remainingDeferMs = Math.max(0, deferMapDecorativeWorkUntil - Date.now());
  return Math.max(baseDelayMs, remainingDeferMs);
}

interface MapResizeOptions {
  syncOverlays?: boolean;
}

function resizeMapToContainer(instance = map.value, options: MapResizeOptions = {}): void {
  if (!instance || typeof instance.resize !== 'function') {
    return;
  }

  instance.resize();
  instance?.triggerRepaint?.();

  if (options.syncOverlays === false) {
    return;
  }

  updateLiveRouteOverlay();
  scheduleMarkerRender();
  scheduleNearbyPlacesRefresh();
}

function scheduleMapResize(instance = map.value, options: MapResizeOptions = {}): void {
  if (typeof window === 'undefined') {
    resizeMapToContainer(instance, options);
    return;
  }

  if (mapResizeFrameHandle !== null) {
    window.cancelAnimationFrame(mapResizeFrameHandle);
  }

  mapResizeFrameHandle = window.requestAnimationFrame(() => {
    mapResizeFrameHandle = null;
    resizeMapToContainer(instance, options);
  });
}

function clearMapPostStyleResizeTimers(): void {
  mapPostStyleResizeTimers.forEach((timer) => clearTimeout(timer));
  mapPostStyleResizeTimers = [];
}

function scheduleMapPostStyleResizeSeries(instance = map.value): void {
  clearMapPostStyleResizeTimers();
  scheduleMapResize(instance, { syncOverlays: false });
  mapPostStyleResizeTimers = [140, 420].map((delay) => setTimeout(() => scheduleMapResize(instance, { syncOverlays: false }), delay));
}

function clearMapRenderHealthTimers(): void {
  mapRenderHealthTimers.forEach((timer) => clearTimeout(timer));
  mapRenderHealthTimers = [];
}

function isMapRenderSurfaceMismatched(instance: mapboxgl.Map): boolean {
  const container = mapContainer.value ?? instance.getContainer();
  const canvas = instance.getCanvas();
  const containerBox = container.getBoundingClientRect();
  const canvasBox = canvas.getBoundingClientRect();
  const pixelRatio = Math.max(window.devicePixelRatio || 1, 1);
  const expectedCanvasWidth = Math.round(containerBox.width * pixelRatio);
  const expectedCanvasHeight = Math.round(containerBox.height * pixelRatio);
  const backingTolerance = Math.max(2, Math.ceil(pixelRatio));

  return (
    Math.abs(canvasBox.width - containerBox.width) > 1 ||
    Math.abs(canvasBox.height - containerBox.height) > 1 ||
    Math.abs(canvas.width - expectedCanvasWidth) > backingTolerance ||
    Math.abs(canvas.height - expectedCanvasHeight) > backingTolerance
  );
}

function repairMapRenderSurface(instance = map.value): void {
  if (!instance || !mapContainer.value || !interactiveMapEnabled.value) {
    return;
  }

  const containerBox = mapContainer.value.getBoundingClientRect();
  if (containerBox.width < 120 || containerBox.height < 120) {
    return;
  }

  try {
    if (!isMapRenderSurfaceMismatched(instance)) {
      instance.triggerRepaint?.();
      return;
    }

    instance.resize();
    const center = instance.getCenter();
    instance.jumpTo({
      center,
      zoom: instance.getZoom(),
      bearing: instance.getBearing(),
      pitch: instance.getPitch(),
    });
    instance.triggerRepaint?.();
  } catch {
    // The map can briefly be mid-style-load; the next health tick will retry.
  }
}

function scheduleMapRenderHealthCheckSeries(instance = map.value): void {
  clearMapRenderHealthTimers();
  repairMapRenderSurface(instance);
  mapRenderHealthTimers = [120, 420, 1_000].map((delay) =>
    setTimeout(() => repairMapRenderSurface(instance), delay),
  );
}

function clearMapTileSettlingTimer(): void {
  if (mapTileSettlingTimer) {
    clearTimeout(mapTileSettlingTimer);
    mapTileSettlingTimer = null;
  }
}

function startMapTileSettling(timeoutMs = MAP_TILE_SETTLE_TIMEOUT_MS): void {
  if (!interactiveMapEnabled.value) {
    return;
  }

  const effectiveTimeoutMs = props.routeVariant === 'planner'
    ? Math.min(timeoutMs, MAP_PLANNER_TILE_SETTLE_TIMEOUT_MS)
    : timeoutMs;
  isMapTileSettling.value = true;
  clearMapTileSettlingTimer();
  mapTileSettlingTimer = setTimeout(() => {
    mapTileSettlingTimer = null;
    isMapTileSettling.value = false;
  }, effectiveTimeoutMs);
}

function finishMapTileSettling(
  delayMs = props.routeVariant === 'planner' ? MAP_PLANNER_TILE_SETTLE_AFTER_IDLE_MS : MAP_TILE_SETTLE_AFTER_IDLE_MS,
): void {
  clearMapTileSettlingTimer();
  mapTileSettlingTimer = setTimeout(() => {
    mapTileSettlingTimer = null;
    isMapTileSettling.value = false;
  }, delayMs);
}

function clearMapRenderGateTimer(): void {
  if (mapRenderGateTimer) {
    clearTimeout(mapRenderGateTimer);
    mapRenderGateTimer = null;
  }
}

function closeMapRenderGate(): void {
  clearMapRenderGateTimer();
  isMapRenderGateActive.value = false;
  mapRenderGateMinimumVisibleUntil = 0;
}

function clearMapCameraTransitionTimers(): void {
  if (mapCameraTransitionTimer) {
    clearTimeout(mapCameraTransitionTimer);
    mapCameraTransitionTimer = null;
  }

  if (mapCameraTransitionReadyTimer) {
    clearTimeout(mapCameraTransitionReadyTimer);
    mapCameraTransitionReadyTimer = null;
  }
}

function clearLocationCameraAnimation(): void {
  if (locationCameraAnimationFrameHandle !== null && typeof window !== 'undefined') {
    window.cancelAnimationFrame(locationCameraAnimationFrameHandle);
    locationCameraAnimationFrameHandle = null;
  }
  if (locationCameraAnimationTimer) {
    clearTimeout(locationCameraAnimationTimer);
    locationCameraAnimationTimer = null;
  }
}

function clearPlannerMapCanvasRevealTimer(): void {
  if (plannerMapCanvasRevealTimer) {
    clearTimeout(plannerMapCanvasRevealTimer);
    plannerMapCanvasRevealTimer = null;
  }
}

function clearPlannerMapCanvasPreviewFrame(): void {
  if (plannerMapCanvasPreviewFrame === null) {
    return;
  }

  if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(plannerMapCanvasPreviewFrame);
  }
  plannerMapCanvasPreviewFrame = null;
}

function clearPlannerMapPreloadSurfaceTimer(): void {
  if (plannerMapPreloadSurfaceTimer) {
    clearTimeout(plannerMapPreloadSurfaceTimer);
    plannerMapPreloadSurfaceTimer = null;
  }
}

function clearMapQuickDimTimer(): void {
  if (mapQuickDimTimer) {
    clearTimeout(mapQuickDimTimer);
    mapQuickDimTimer = null;
  }
}

function flashPlannerMapDim(durationMs: number): void {
  if (props.routeVariant !== 'planner' || !interactiveMapEnabled.value) {
    return;
  }

  clearMapQuickDimTimer();
  isMapQuickDimVisible.value = true;
  mapQuickDimTimer = setTimeout(() => {
    mapQuickDimTimer = null;
    isMapQuickDimVisible.value = false;
  }, durationMs);
}

function clearPlannerGlobeRestoreTimer(): void {
  if (plannerGlobeRestoreTimer) {
    clearTimeout(plannerGlobeRestoreTimer);
    plannerGlobeRestoreTimer = null;
  }
}

function revealPlannerMapCanvas(instance: mapboxgl.Map): void {
  if (props.routeVariant !== 'planner') {
    return;
  }

  if (isPlannerMapCanvasRevealed.value || plannerMapPreloadSurfaceTimer) {
    return;
  }

  clearPlannerMapCanvasRevealTimer();
  plannerMapCanvasRevealStartedAt = 0;
  if (!hasMapCompletedInitialIdle) {
    isMapCameraMoving.value = false;
    isMapCameraVisualSettlingSuppressed.value = false;
    applyStableMapProjection(instance);
  }
  previewPlannerMapCanvas(instance);
  instance.getCanvas().classList.add('loaded');
  setTripsMapDebugFlag('__tripsMapIdle');
  isPlannerMapCanvasRevealing.value = false;
  clearPlannerMapPreloadSurfaceTimer();
  plannerMapPreloadSurfaceTimer = setTimeout(() => {
    isPlannerMapCanvasRevealing.value = true;
    plannerMapPreloadSurfaceTimer = setTimeout(() => {
      plannerMapPreloadSurfaceTimer = null;
      isPlannerMapCanvasRevealed.value = true;
      isPlannerMapCanvasPreviewing.value = false;
      isPlannerMapCanvasRevealing.value = false;
      flushPendingInitialAutoLocateFocus();
    }, MAP_PLANNER_PRELOAD_SURFACE_FADE_MS);
  }, MAP_PLANNER_PRELOAD_SURFACE_HOLD_MS);
  if (isMapStyleTransitioning.value && mapStyleTransitionVariant.value === 'load') {
    finishMapStyleTransition();
  }
  closeMapRenderGate();
}

function previewPlannerMapCanvas(instance: mapboxgl.Map): void {
  if (props.routeVariant !== 'planner' || isPlannerMapCanvasRevealed.value) {
    return;
  }

  try {
    instance.getCanvas().classList.add('is-previewing');
    instance.triggerRepaint?.();
    isPlannerMapCanvasPreviewing.value = true;
  } catch {
    // The dim preload surface still protects the first paint.
  }
}

function schedulePlannerMapCanvasPreview(instance: mapboxgl.Map): void {
  if (props.routeVariant !== 'planner' || isPlannerMapCanvasRevealed.value) {
    return;
  }

  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    previewPlannerMapCanvas(instance);
    return;
  }

  if (plannerMapCanvasPreviewFrame !== null) {
    return;
  }

  plannerMapCanvasPreviewFrame = window.requestAnimationFrame(() => {
    plannerMapCanvasPreviewFrame = null;
    if (map.value && map.value !== instance) {
      return;
    }

    previewPlannerMapCanvas(instance);
  });
}

function isPlannerMapCanvasReadyToReveal(instance: mapboxgl.Map): boolean {
  try {
    const mapWithLoaded = instance as mapboxgl.Map & {
      loaded?: () => boolean;
    };
    return (typeof mapWithLoaded.loaded === 'function' ? mapWithLoaded.loaded() : true) && isMapRenderVisuallyReady(instance);
  } catch {
    return false;
  }
}

function schedulePlannerMapCanvasRevealFallback(instance: mapboxgl.Map): void {
  if (props.routeVariant !== 'planner') {
    return;
  }

  const isInitialSchedule = plannerMapCanvasRevealStartedAt === 0;
  if (isInitialSchedule) {
    plannerMapCanvasRevealStartedAt = Date.now();
  }

  clearPlannerMapCanvasRevealTimer();
  plannerMapCanvasRevealTimer = setTimeout(() => {
    plannerMapCanvasRevealTimer = null;
    const revealWaitMs = Date.now() - plannerMapCanvasRevealStartedAt;
    if (!isPlannerMapCanvasReadyToReveal(instance) && revealWaitMs < MAP_PLANNER_CANVAS_REVEAL_MAX_WAIT_MS) {
      try {
        instance.triggerRepaint?.();
      } catch {
        // The next retry or idle event will handle the reveal.
      }
      schedulePlannerMapCanvasRevealFallback(instance);
      return;
    }

    revealPlannerMapCanvas(instance);
  }, isInitialSchedule ? MAP_PLANNER_CANVAS_REVEAL_FALLBACK_MS : MAP_PLANNER_CANVAS_REVEAL_RETRY_MS);
}

function schedulePlannerMapCanvasLoadReveal(instance: mapboxgl.Map): void {
  if (props.routeVariant !== 'planner' || isPlannerMapCanvasRevealed.value) {
    return;
  }

  clearPlannerMapCanvasRevealTimer();
  plannerMapCanvasRevealTimer = setTimeout(() => {
    plannerMapCanvasRevealTimer = null;
    if (!map.value || map.value !== instance || isPlannerMapCanvasRevealed.value) {
      return;
    }

    if (!isPlannerMapCanvasReadyToReveal(instance)) {
      try {
        instance.triggerRepaint?.();
      } catch {
        // The fallback reveal loop will retry when Mapbox settles.
      }
      schedulePlannerMapCanvasRevealFallback(instance);
      return;
    }

    revealPlannerMapCanvas(instance);
  }, MAP_PLANNER_CANVAS_LOAD_REVEAL_DELAY_MS);
}

function clearSuppressedCameraInteractionRenderGate(): void {
  suppressNextCameraInteractionRenderGate = false;
  if (suppressNextCameraInteractionRenderGateTimer) {
    clearTimeout(suppressNextCameraInteractionRenderGateTimer);
    suppressNextCameraInteractionRenderGateTimer = null;
  }
}

function suppressCameraInteractionRenderGateOnce(): void {
  suppressNextCameraInteractionRenderGate = true;
  if (suppressNextCameraInteractionRenderGateTimer) {
    clearTimeout(suppressNextCameraInteractionRenderGateTimer);
  }

  suppressNextCameraInteractionRenderGateTimer = setTimeout(() => {
    suppressNextCameraInteractionRenderGate = false;
    suppressNextCameraInteractionRenderGateTimer = null;
  }, MAP_LOCATION_FOCUS_DURATION_MS + 600);
}

function consumeSuppressedCameraInteractionRenderGate(): boolean {
  if (!suppressNextCameraInteractionRenderGate) {
    return false;
  }

  clearSuppressedCameraInteractionRenderGate();
  return true;
}

function openMapRenderGate(
  timeoutMs = MAP_RENDER_GATE_TIMEOUT_MS,
  minimumVisibleMs = MAP_RENDER_GATE_MIN_VISIBLE_MS,
): void {
  if (!interactiveMapEnabled.value) {
    return;
  }

  isMapRenderGateActive.value = true;
  mapRenderGateMinimumVisibleUntil = Math.max(
    mapRenderGateMinimumVisibleUntil,
    Date.now() + minimumVisibleMs,
  );
  clearMapRenderGateTimer();
  mapRenderGateTimer = setTimeout(() => {
    mapRenderGateTimer = null;
    isMapRenderGateActive.value = false;
    mapRenderGateMinimumVisibleUntil = 0;
  }, timeoutMs);
}

function revealMapRenderGate(delayMs = MAP_RENDER_GATE_REVEAL_DELAY_MS): void {
  clearMapRenderGateTimer();
  const minimumVisibleDelayMs = Math.max(0, mapRenderGateMinimumVisibleUntil - Date.now());
  const revealDelayMs = Math.max(delayMs, minimumVisibleDelayMs);
  mapRenderGateTimer = setTimeout(() => {
    mapRenderGateTimer = null;
    isMapRenderGateActive.value = false;
    mapRenderGateMinimumVisibleUntil = 0;
  }, revealDelayMs);
}

function isMapRenderVisuallyReady(instance: mapboxgl.Map): boolean {
  try {
    const tileAwareMap = instance as mapboxgl.Map & {
      areTilesLoaded?: () => boolean;
      isMoving?: () => boolean;
    };
    const isStyleReady = typeof instance.isStyleLoaded === 'function'
      ? instance.isStyleLoaded()
      : true;
    const areTilesReady = typeof tileAwareMap.areTilesLoaded === 'function'
      ? tileAwareMap.areTilesLoaded()
      : true;
    const isStillMoving = typeof tileAwareMap.isMoving === 'function'
      ? tileAwareMap.isMoving()
      : false;

    return isStyleReady && areTilesReady && !isStillMoving;
  } catch {
    return false;
  }
}

function finishMapCameraRenderTransition(version: number, delayMs: number): void {
  if (version !== mapCameraTransitionVersion) {
    return;
  }

  if (mapCameraTransitionTimer) {
    clearTimeout(mapCameraTransitionTimer);
  }

  mapCameraTransitionTimer = setTimeout(() => {
    if (version !== mapCameraTransitionVersion) {
      return;
    }

    mapCameraTransitionTimer = null;
    isMapCameraTransitioning.value = false;
    pendingLocationCameraSignature = null;
    pendingResetCameraSignature = null;
    releaseMapTransitionSnapshotHold('camera');
  }, delayMs);
}

function startMapCameraRenderTransition(
  options: {
    timeoutMs?: number;
    minimumVisibleMs?: number;
    captureSnapshot?: boolean;
    renderGate?: boolean;
    tileSettling?: boolean;
  } = {},
): void {
  if (!interactiveMapEnabled.value) {
    return;
  }

  const timeoutMs = options.timeoutMs ?? MAP_RENDER_GATE_TIMEOUT_MS;
  const minimumVisibleMs = options.minimumVisibleMs ?? MAP_RENDER_GATE_MIN_VISIBLE_MS;
  const version = ++mapCameraTransitionVersion;
  mapCameraTransitionStartedAt = getMapStyleTransitionNow();
  isMapCameraTransitioning.value = true;
  if (options.captureSnapshot === true) {
    holdMapTransitionSnapshot('camera');
  }

  if (options.renderGate !== false) {
    openMapRenderGate(timeoutMs, minimumVisibleMs);
  } else {
    closeMapRenderGate();
  }
  if (options.tileSettling !== false) {
    startMapTileSettling(timeoutMs);
  } else {
    clearMapTileSettlingTimer();
    isMapTileSettling.value = false;
  }
  clearMapCameraTransitionTimers();
  mapCameraTransitionTimer = setTimeout(() => {
    if (version !== mapCameraTransitionVersion) {
      return;
    }

    mapCameraTransitionTimer = null;
    isMapCameraTransitioning.value = false;
    pendingLocationCameraSignature = null;
    pendingResetCameraSignature = null;
    releaseMapTransitionSnapshotHold('camera');
    if (options.tileSettling !== false) {
      finishMapTileSettling();
    }
  }, timeoutMs);
}

function stopMapCameraRenderTransitionVisuals(): void {
  mapCameraTransitionVersion += 1;
  clearMapCameraTransitionTimers();
  isMapCameraTransitioning.value = false;
  closeMapRenderGate();
  clearMapTileSettlingTimer();
  isMapTileSettling.value = false;
  releaseMapTransitionSnapshotHold('camera');
}

async function settleMapRenderAfterIdle(
  instance: mapboxgl.Map,
  options: {
    version?: number;
    attempt?: number;
  } = {},
): Promise<void> {
  const version = options.version ?? mapCameraTransitionVersion;
  const attempt = options.attempt ?? 0;

  for (let frameIndex = 0; frameIndex < MAP_RENDER_READY_SETTLE_FRAMES; frameIndex += 1) {
    await waitForNextAnimationFrame();
    if (map.value !== instance || version !== mapCameraTransitionVersion) {
      return;
    }
  }

  if (!isMapRenderVisuallyReady(instance) && attempt < MAP_RENDER_READY_MAX_RETRIES) {
    if (mapCameraTransitionReadyTimer) {
      clearTimeout(mapCameraTransitionReadyTimer);
    }
    mapCameraTransitionReadyTimer = setTimeout(() => {
      mapCameraTransitionReadyTimer = null;
      void settleMapRenderAfterIdle(instance, {
        version,
        attempt: attempt + 1,
      });
    }, MAP_RENDER_READY_RETRY_MS);
    return;
  }

  const elapsedMs = getMapStyleTransitionNow() - mapCameraTransitionStartedAt;
  const remainingCameraVisibleMs = Math.max(0, MAP_RENDER_GATE_MIN_VISIBLE_MS - elapsedMs);
  const revealDelayMs = Math.max(MAP_RENDER_GATE_REVEAL_DELAY_MS, remainingCameraVisibleMs);
  revealMapRenderGate(revealDelayMs);
  finishMapTileSettling(revealDelayMs);
  finishMapCameraRenderTransition(version, revealDelayMs);
}

function shouldDeferPriorityCamera(): boolean {
  const instance = map.value;
  if (!instance || !interactiveMapEnabled.value) {
    return false;
  }

  if (!hasMapCompletedInitialIdle || isMapStyleTransitioning.value) {
    return true;
  }

  try {
    return !instance.loaded();
  } catch {
    return true;
  }
}

function handleMapContainerResize() {
  scheduleMapResize();
}

const selectedSpotId = computed(() => props.selectedSpotId ?? mapStore.selectedSpotId);
const filteredSpots = computed(() => props.spots.filter((spot) => mapStore.activeCategories.includes(spot.category)));
const markerSpots = computed(() => mergeUniqueMapPoints(props.routePoints, filteredSpots.value));
const spotLookup = computed(() => new Map(mergeUniqueMapPoints(props.routePoints, props.spots).map((spot) => [spot.id, spot])));
const markerSpotLookup = computed(() => new Map(markerSpots.value.map((spot) => [spot.id, spot])));
const shouldEagerlyPreloadSpatialRuntime = computed(() => (
  interactiveMapEnabled.value &&
  (
    props.routeVariant !== 'planner' ||
    markerSpots.value.some(hasValidCoordinates)
  )
));
const selectedSpot = computed(() => {
  const currentSelectedSpotId = selectedSpotId.value;
  return currentSelectedSpotId ? spotLookup.value.get(currentSelectedSpotId) ?? null : null;
});
const hasRoute = computed(() => props.routePoints.length > 1);
const visibleSpotCount = computed(() => (
  mapStore.visibleSpotIdsMeasured
    ? (measuredVisiblePinCount.value ?? mapStore.visibleSpotIds.length)
    : (interactiveMapEnabled.value ? 0 : markerSpots.value.length)
));
const showSummary = computed(() => props.showSummary);
const showControls = computed(() => props.showControls);
const shouldLoadMapWeatherBadge = computed(() => props.showWeatherBadge && (!DEMO_MODE_ENABLED || MAP_DEMO_WEATHER_ENABLED));
const mapWeatherPoint = computed(() => {
  const [longitude, latitude] = mapStore.viewport.center;
  if (
    !shouldLoadMapWeatherBadge.value ||
    mapStore.viewport.zoom < MAP_WEATHER_MIN_ZOOM ||
    !isFiniteNumber(latitude) ||
    !isFiniteNumber(longitude)
  ) {
    return null;
  }

  return {
    latitude: roundMapWeatherCoordinate(latitude),
    longitude: roundMapWeatherCoordinate(longitude),
  };
});
const mapWeatherLookupKey = computed(() => {
  const point = mapWeatherPoint.value;
  return point ? `${point.latitude.toFixed(MAP_WEATHER_COORDINATE_PRECISION)}:${point.longitude.toFixed(MAP_WEATHER_COORDINATE_PRECISION)}` : '';
});
const showMapWeatherBadge = computed(() => Boolean(shouldLoadMapWeatherBadge.value && mapWeatherSnapshot.value && mapWeatherPoint.value));
const mapWeatherTemperatureLabel = computed(() => {
  const temperature = mapWeatherSnapshot.value?.temperatureF;
  return isFiniteNumber(temperature) ? `${Math.round(temperature)}°F` : '--°F';
});
const mapWeatherIconName = computed(() => mapWeatherSnapshot.value ? getWeatherSnapshotIconName(mapWeatherSnapshot.value) : 'weather');
const showMapTrafficKey = computed(() => Boolean(props.showTraffic && interactiveMapEnabled.value));
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
const fallbackMarkerSpots = computed(() => (markerSpots.value.length ? markerSpots.value : props.spots));
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
    const sequence = props.clickToSelect && props.routePoints.length <= 1
      ? null
      : routeOrderLookup.value.get(spot.id) ?? null;
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
      showLabel: props.clickToSelect ? false : isActive || sequence !== null || index < 3,
    };
  }).sort((left, right) => Number(left.isActive) - Number(right.isActive));
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

function createThrottledMapMouseHandler(
  handler: (event: mapboxgl.MapMouseEvent) => void,
  waitMs: number,
): (event: mapboxgl.MapMouseEvent) => void {
  let lastRunAt = 0;

  return (event: mapboxgl.MapMouseEvent) => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - lastRunAt < waitMs) {
      return;
    }

    lastRunAt = now;
    handler(event);
  };
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

  if (props.routeVariant === 'planner' || !instance || !interactiveMapEnabled.value || routeCoordinates.length < 2 || !container?.clientWidth || !container?.clientHeight) {
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

function cancelScheduledLiveRouteOverlayUpdate(): void {
  if (typeof window !== 'undefined' && liveRouteOverlayFrameHandle !== null) {
    window.cancelAnimationFrame(liveRouteOverlayFrameHandle);
  }

  liveRouteOverlayFrameHandle = null;
}

function scheduleLiveRouteOverlayUpdate(): void {
  if (liveRouteOverlayFrameHandle !== null) {
    return;
  }

  if (typeof window === 'undefined') {
    updateLiveRouteOverlay();
    return;
  }

  liveRouteOverlayFrameHandle = window.requestAnimationFrame(() => {
    liveRouteOverlayFrameHandle = null;
    updateLiveRouteOverlay();
  });
}

function isUserStartedMapCameraInteraction(event: unknown): boolean {
  return Boolean((event as { originalEvent?: unknown } | null | undefined)?.originalEvent);
}

function stopFollowingUserLocationCamera(): void {
  shouldCenterOnNextFix.value = false;
  isFollowingUserLocation.value = false;
  pendingLocationCamera = null;
  pendingLocationCameraSignature = null;
  clearPendingLocationCameraFlushTimer();
  clearPendingInitialAutoLocateFocus();
  clearLocationCameraAnimation();
}

function beginMapCameraInteraction(event?: unknown): void {
  if (isUserStartedMapCameraInteraction(event)) {
    stopFollowingUserLocationCamera();
  }

  const suppressVisualSettling = consumeSuppressedCameraInteractionRenderGate();
  isMapCameraMoving.value = true;
  isMapCameraVisualSettlingSuppressed.value = suppressVisualSettling;
  if (!suppressVisualSettling) {
    applyPlannerInteractionProjection();
  }
  if (suppressVisualSettling) {
    clearMapTileSettlingTimer();
    isMapTileSettling.value = false;
    closeMapRenderGate();
  } else {
    startMapTileSettling();
  }
  if (props.routeVariant === 'planner') {
    closeMapRenderGate();
  } else if (!suppressVisualSettling) {
    openMapRenderGate(MAP_RENDER_GATE_TIMEOUT_MS);
  }
  clearMapFeaturePlacePrefetchTimer();
  cancelScheduledLiveRouteOverlayUpdate();
}

function finishMapCameraInteraction(): void {
  if (isMapCameraMoving.value) {
    isMapCameraMoving.value = false;
  }
  pendingLocationCameraSignature = null;
  isMapCameraVisualSettlingSuppressed.value = false;

  const plannerRestoreDelayMs = nextPlannerGlobeRestoreDelayMs;
  nextPlannerGlobeRestoreDelayMs = MAP_PLANNER_GLOBE_RESTORE_DELAY_MS;
  schedulePlannerGlobeRestore(map.value, plannerRestoreDelayMs);
  scheduleLiveRouteOverlayUpdate();
  syncMapFeaturePlacePopup();
  scheduleActiveNearbyPlacePopoverPlacement();
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

  if (typeof window === 'undefined' || (isUiTestEnvironment() && !interactiveMapEnabled.value)) {
    queueMicrotaskSafe(flushRender);
    return;
  }

  markerRenderFrameHandle = window.requestAnimationFrame(() => {
    flushRender();
  });
}

interface MapCameraTarget {
  center: [number, number];
  zoom: number;
  bearing?: number;
  pitch?: number;
}

interface MapCameraTolerance {
  center?: number;
  zoom?: number;
  angle?: number;
}

function buildCameraTargetSignature(target: MapCameraTarget): string {
  const bearing = typeof target.bearing === 'number' ? target.bearing.toFixed(2) : '*';
  const pitch = typeof target.pitch === 'number' ? target.pitch.toFixed(2) : '*';
  return [
    target.center[0].toFixed(5),
    target.center[1].toFixed(5),
    target.zoom.toFixed(2),
    bearing,
    pitch,
  ].join(':');
}

function isMapCameraAtTarget(
  instance: mapboxgl.Map,
  target: MapCameraTarget,
  tolerance: MapCameraTolerance = {},
): boolean {
  const centerTolerance = tolerance.center ?? MAP_CAMERA_CENTER_TOLERANCE;
  const zoomTolerance = tolerance.zoom ?? MAP_CAMERA_ZOOM_TOLERANCE;
  const angleTolerance = tolerance.angle ?? MAP_CAMERA_ANGLE_TOLERANCE;

  try {
    const center = instance.getCenter();
    const isCentered =
      Math.abs(center.lng - target.center[0]) <= centerTolerance &&
      Math.abs(center.lat - target.center[1]) <= centerTolerance;
    const isZoomed = Math.abs(instance.getZoom() - target.zoom) <= zoomTolerance;
    const isBearingReady = typeof target.bearing !== 'number' || Math.abs(instance.getBearing() - target.bearing) <= angleTolerance;
    const isPitchReady = typeof target.pitch !== 'number' || Math.abs(instance.getPitch() - target.pitch) <= angleTolerance;

    return isCentered && isZoomed && isBearingReady && isPitchReady;
  } catch {
    return false;
  }
}

function isMapStoreViewportAtTarget(target: MapViewport, style: string): boolean {
  const [longitude, latitude] = mapStore.viewport.center;
  return (
    Math.abs(longitude - target.center[0]) <= MAP_CAMERA_CENTER_TOLERANCE &&
    Math.abs(latitude - target.center[1]) <= MAP_CAMERA_CENTER_TOLERANCE &&
    Math.abs(mapStore.viewport.zoom - target.zoom) <= MAP_CAMERA_ZOOM_TOLERANCE &&
    mapStore.viewport.style === style
  );
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getMapDeviceMemoryGb(): number {
  if (typeof navigator === 'undefined') {
    return 0;
  }

  return Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 0);
}

function getMapHardwareConcurrency(): number {
  if (typeof navigator === 'undefined') {
    return 0;
  }

  return Number(navigator.hardwareConcurrency ?? 0);
}

function getMapTileResourceProfile(): { minTileCacheSize: number; maxTileCacheSize: number; prefetchZoomDelta: number } {
  const memoryGb = getMapDeviceMemoryGb();
  const coreCount = getMapHardwareConcurrency();
  const isLowResourceDevice = (memoryGb > 0 && memoryGb <= 4) || (coreCount > 0 && coreCount <= 4);
  const isHighResourceDevice = (memoryGb >= 12 || memoryGb === 0) && coreCount >= 10;
  const isPlannerMap = usesPlannerCameraMotion();

  if (isLowResourceDevice) {
    return {
      minTileCacheSize: isPlannerMap ? 192 : 128,
      maxTileCacheSize: isPlannerMap ? 560 : 384,
      prefetchZoomDelta: 1,
    };
  }

  if (isHighResourceDevice) {
    return {
      minTileCacheSize: isPlannerMap ? 512 : 256,
      maxTileCacheSize: isPlannerMap ? 1536 : 896,
      prefetchZoomDelta: isPlannerMap ? 3 : 2,
    };
  }

  return {
    minTileCacheSize: isPlannerMap ? 384 : 192,
    maxTileCacheSize: isPlannerMap ? 1120 : 640,
    prefetchZoomDelta: isPlannerMap ? 3 : 2,
  };
}

function configurePlannerMapGestureSmoothness(instance: mapboxgl.Map): void {
  if (props.routeVariant !== 'planner') {
    return;
  }

  try {
    const scrollZoom = (instance as mapboxgl.Map & { scrollZoom?: SmoothScrollZoomController }).scrollZoom;
    scrollZoom?.enable?.({ around: 'center' });
    scrollZoom?.setZoomRate?.(MAP_PLANNER_TRACKPAD_ZOOM_RATE);
    scrollZoom?.setWheelZoomRate?.(MAP_PLANNER_WHEEL_ZOOM_RATE);
  } catch {
    // Gesture tuning is best-effort; default Mapbox controls still work.
  }
}

function buildFallbackViewportBounds(): FallbackProjectionBounds {
  const [centerLongitude, centerLatitude] = mapStore.viewport.center;
  const zoom = clampNumber(mapStore.viewport.zoom, MIN_MAP_ZOOM, MAX_MAP_ZOOM);
  const longitudeSpan = clampNumber(38 / 2 ** (zoom - 3), 0.08, 150);
  const latitudeSpan = clampNumber(longitudeSpan * 0.62, 0.06, 72);

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

function mergeUniqueMapPoints(primaryPoints: MapPoint[], secondaryPoints: MapPoint[]): MapPoint[] {
  const mergedPoints = new Map<string, MapPoint>();

  [...primaryPoints, ...secondaryPoints]
    .filter(hasValidCoordinates)
    .forEach((point) => {
      if (!mergedPoints.has(point.id)) {
        mergedPoints.set(point.id, point);
      }
    });

  return [...mergedPoints.values()];
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
  for (const offset of getFallbackMarkerOffsetCandidates(placedProjections.length)) {
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

function getFallbackMarkerOffsetCandidates(placedCount: number): Array<{ x: number; y: number }> {
  const dynamicOffsets: Array<{ x: number; y: number }> = [];
  const ringCount = Math.ceil(Math.max(placedCount - fallbackMarkerOffsets.length, 0) / 8) + 3;

  for (let ring = 0; ring < ringCount; ring += 1) {
    const radius = FALLBACK_DYNAMIC_OFFSET_START_RADIUS + ring * FALLBACK_DYNAMIC_OFFSET_RING_GAP;
    const steps = 8 + ring * 4;
    const phase = ring % 2 === 0 ? Math.PI / 8 : 0;

    for (let step = 0; step < steps; step += 1) {
      const angle = phase + (step / steps) * Math.PI * 2;
      dynamicOffsets.push({
        x: Number((Math.cos(angle) * radius).toFixed(2)),
        y: Number((Math.sin(angle) * radius).toFixed(2)),
      });
    }
  }

  return [...fallbackMarkerOffsets, ...dynamicOffsets];
}

function handleTrackingState(nextState: TrackingState) {
  trackingState.value = nextState;
}

function buildUserMarkerElement(): HTMLDivElement {
  const element = document.createElement('div');
  element.setAttribute('aria-hidden', 'true');
  element.style.width = '1.35rem';
  element.style.height = '1.35rem';
  element.style.borderRadius = '9999px';
  element.style.border = '4px solid var(--bg-primary)';
  element.style.background = 'var(--accent-teal)';
  element.style.boxShadow = '0 0 0 0.42rem var(--accent-teal-light), 0 0.35rem 1rem rgb(0 0 0 / 0.28)';
  element.style.pointerEvents = 'none';
  element.style.transform = 'translateZ(0)';
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
  releaseSyncingViewportAfterFlush();
}

function setVisibleSpotIds(spotIds: string[], visiblePinCount = spotIds.length) {
  measuredVisiblePinCount.value = Math.max(visiblePinCount, spotIds.length, 0);
  mapStore.setVisibleSpotIds([...new Set(spotIds)]);
}

function isFiniteNumber(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function roundMapWeatherCoordinate(value: number): number {
  return Number(value.toFixed(MAP_WEATHER_COORDINATE_PRECISION));
}

function clearMapWeatherRefreshTimer(): void {
  if (!mapWeatherRefreshTimer) {
    return;
  }

  clearTimeout(mapWeatherRefreshTimer);
  mapWeatherRefreshTimer = null;
}

async function loadMapWeatherSnapshot(): Promise<void> {
  if (mapWeatherPoint.value && (Date.now() < deferMapDecorativeWorkUntil || isMapCameraMoving.value)) {
    scheduleMapWeatherRefresh();
    return;
  }

  const requestId = mapWeatherRequestId.value + 1;
  mapWeatherRequestId.value = requestId;
  const point = mapWeatherPoint.value;

  if (!point) {
    mapWeatherSnapshot.value = null;
    return;
  }

  try {
    const snapshot = await getOpenWeatherMapSnapshot({
      label: 'Map center',
      latitude: point.latitude,
      longitude: point.longitude,
    });
    if (requestId !== mapWeatherRequestId.value) {
      return;
    }

    mapWeatherSnapshot.value = snapshot;
  } catch {
    if (requestId !== mapWeatherRequestId.value) {
      return;
    }

    mapWeatherSnapshot.value = null;
  }
}

function scheduleMapWeatherRefresh(): void {
  clearMapWeatherRefreshTimer();
  if (!mapWeatherPoint.value) {
    mapWeatherRequestId.value += 1;
    mapWeatherSnapshot.value = null;
    return;
  }

  const delayMs = resolveMapDecorativeWorkDelay(MAP_WEATHER_REFRESH_DEBOUNCE_MS);
  mapWeatherRefreshTimer = setTimeout(() => {
    mapWeatherRefreshTimer = null;
    void loadMapWeatherSnapshot();
  }, delayMs);
}

function clearNearbyPlacesRefreshTimer(): void {
  if (!nearbyPlacesRefreshTimer) {
    return;
  }

  clearTimeout(nearbyPlacesRefreshTimer);
  nearbyPlacesRefreshTimer = null;
}

function clearNearbyPlaceMarkers(): void {
  nearbyPlaceMarkerControllers.forEach((controller) => {
    controller.marker.remove();
  });
  nearbyPlaceMarkerControllers.clear();
  if (!getActiveMapFeaturePlacePin()) {
    activeNearbyPlaceMarkerId.value = null;
  }
}

function getMapVisibleBounds(instance: mapboxgl.Map): NearbyPlaceBounds | null {
  const bounds = instance.getBounds();
  const west = bounds.getWest();
  const south = bounds.getSouth();
  const east = bounds.getEast();
  const north = bounds.getNorth();

  if (
    !isFiniteNumber(west) ||
    !isFiniteNumber(south) ||
    !isFiniteNumber(east) ||
    !isFiniteNumber(north) ||
    west >= east ||
    south >= north
  ) {
    return null;
  }

  return { west, south, east, north };
}

function getNearbyPlacesLimitForZoom(zoom: number): number {
  if (zoom >= 14) {
    return NEARBY_PLACES_MAX_LIMIT;
  }

  if (zoom >= 12) {
    return 120;
  }

  if (zoom >= 10) {
    return 96;
  }

  return NEARBY_PLACES_MIN_LIMIT;
}

function getNearbyPlacesBoundsPaddingRatio(zoom: number): number {
  if (zoom >= 14) {
    return 0.18;
  }

  if (zoom >= 12) {
    return 0.15;
  }

  if (zoom >= 10) {
    return 0.12;
  }

  return 0.08;
}

function expandNearbyPlaceBounds(bounds: NearbyPlaceBounds, zoom: number): NearbyPlaceBounds {
  const longitudeSpan = Math.max(0, bounds.east - bounds.west);
  const latitudeSpan = Math.max(0, bounds.north - bounds.south);
  const paddingRatio = getNearbyPlacesBoundsPaddingRatio(zoom);

  return {
    west: clampNumber(bounds.west - longitudeSpan * paddingRatio, -179.999, 179.999),
    south: clampNumber(bounds.south - latitudeSpan * paddingRatio, -85, 85),
    east: clampNumber(bounds.east + longitudeSpan * paddingRatio, -179.999, 179.999),
    north: clampNumber(bounds.north + latitudeSpan * paddingRatio, -85, 85),
  };
}

function getNearbyPlaceSearchBounds(instance: mapboxgl.Map): NearbyPlaceBounds | null {
  const visibleBounds = getMapVisibleBounds(instance);
  if (!visibleBounds) {
    return null;
  }

  return expandNearbyPlaceBounds(visibleBounds, instance.getZoom());
}

function buildNearbyPlacesViewportSignature(instance: mapboxgl.Map): string {
  const center = instance.getCenter();
  const bounds = getNearbyPlaceSearchBounds(instance);
  if (!bounds) {
    return '';
  }

  return [
    center.lng.toFixed(NEARBY_PLACES_SIGNATURE_COORDINATE_PRECISION),
    center.lat.toFixed(NEARBY_PLACES_SIGNATURE_COORDINATE_PRECISION),
    instance.getZoom().toFixed(NEARBY_PLACES_SIGNATURE_ZOOM_PRECISION),
    bounds.west.toFixed(NEARBY_PLACES_SIGNATURE_COORDINATE_PRECISION),
    bounds.south.toFixed(NEARBY_PLACES_SIGNATURE_COORDINATE_PRECISION),
    bounds.east.toFixed(NEARBY_PLACES_SIGNATURE_COORDINATE_PRECISION),
    bounds.north.toFixed(NEARBY_PLACES_SIGNATURE_COORDINATE_PRECISION),
  ].join(':');
}

function canRenderNearbyPlaces(instance: mapboxgl.Map): boolean {
  return Boolean(
    props.showNearbyPlaces &&
    interactiveMapEnabled.value &&
    getMapVisibleBounds(instance),
  );
}

function canAutoSearchNearbyPlaces(instance: mapboxgl.Map): boolean {
  return Boolean(props.autoSearchNearbyPlaces && canRenderNearbyPlaces(instance));
}

function shouldLoadNearbyPlaces(instance: mapboxgl.Map): boolean {
  return canAutoSearchNearbyPlaces(instance) && instance.getZoom() >= NEARBY_PLACES_MIN_ZOOM;
}

const GAS_STATION_TITLE_PATTERN = /\b(?:qt|quik\s*trip|quick\s*trip|shell|chevron|exxon|mobil|bp|valero|texaco|circle\s*k|7-eleven|racetrac|race\s*trac|speedway|marathon|sunoco|conoco|phillips\s*66|kum\s*&\s*go|kum\s+and\s+go|casey's|love's|pilot|flying\s*j|travel\s*center|ta\s+travel|petro\s+stopping)\b/i;
const GROCERY_TITLE_PATTERN = /\b(?:albertsons|kroger|safeway|publix|whole\s*foods|trader\s*joe'?s|h\s*-?\s*e\s*-?\s*b|heb|aldi|lidl|winco|food\s*lion|wegmans|meijer|sprouts|market\s*basket|shop\s*rite|shoprite|ralphs|vons|pavilions|tom\s*thumb|giant\s*eagle|stop\s*&\s*shop|stop\s+and\s+shop|walmart\s+neighborhood\s+market|fresh\s+market|central\s+market)\b/i;
const RETAIL_TITLE_PATTERN = /\b(?:target|walmart|costco|sam'?s\s*club|best\s*buy|home\s*depot|lowe'?s|ikea|macy'?s|nordstrom|tj\s*maxx|marshalls|ross|dillard'?s|academy\s*sports|dick'?s\s*sporting\s*goods|bass\s*pro|cabela'?s|dollar\s+general|family\s+dollar|dollar\s+tree|five\s+below|tractor\s+supply)\b/i;
const PHARMACY_TITLE_PATTERN = /\b(?:cvs|walgreens|rite\s*aid|pharmacy|drugstore|drug\s*store)\b/i;
const RESTAURANT_TITLE_PATTERN = /\b(?:mcdonald'?s|burger\s*king|wendy'?s|whataburger|in\s*-?\s*n\s*-?\s*out|chick\s*-?\s*fil\s*-?\s*a|taco\s*bell|chipotle|subway|panera|olive\s*garden|texas\s*roadhouse|ihop|denny'?s|waffle\s*house|applebee'?s|chili'?s|sonic|dairy\s*queen|pizza\s*hut|domino'?s|papa\s+john'?s|popeyes|kfc|raising\s*cane'?s|panda\s*express)\b/i;
const COFFEE_TITLE_PATTERN = /\b(?:starbucks|dunkin|dutch\s*bros|coffee|espresso|cafe|caffe)\b/i;
const BANK_TITLE_PATTERN = /\b(?:bank|credit\s*union|chase|wells\s*fargo|bank\s*of\s*america|capital\s*one|citibank|pnc|truist|td\s*bank|us\s*bank|frost\s*bank)\b/i;
const HOTEL_TITLE_PATTERN = /\b(?:hotel|motel|inn|suites|resort|lodg(?:e|ing)|marriott|hilton|hyatt|holiday\s*inn|hampton|la\s*quinta|best\s*western|courtyard|residence\s+inn|fairfield\s+inn|comfort\s+inn|motel\s*6|super\s*8)\b/i;
const HEALTH_TITLE_PATTERN = /\b(?:hospital|clinic|urgent\s*care|medical|dentist|orthodont|vision|optical|veterinary|vet\s*clinic|pediatrics?|children'?s\s+(?:medical|hospital|clinic|northeast)|cook\s+children'?s)\b/i;
const FITNESS_TITLE_PATTERN = /\b(?:gym|fitness|planet\s*fitness|la\s*fitness|anytime\s*fitness|orangetheory|crossfit|ymca|pilates|yoga)\b/i;
const ENTERTAINMENT_TITLE_PATTERN = /\b(?:entertainment|amusement|theme\s*park|six\s*flags|cinema|theater|theatre|movie|amc|regal|cinemark|bowling|arcade|zoo|aquarium|stadium|arena|ballpark|amphitheater|amphitheatre)\b/i;

interface PlaceCategoryOverride {
  label: string;
  category: string;
  kind: string;
}

interface PlaceCategoryRule extends PlaceCategoryOverride {
  categoryPattern?: RegExp;
  titlePattern?: RegExp;
}

const PLACE_CATEGORY_RULES: readonly PlaceCategoryRule[] = [
  {
    label: 'Fire station',
    category: 'fire_station',
    kind: 'civic',
    categoryPattern: /\bfire\s*(?:station|department)?\b/,
    titlePattern: /\bfire\s*(?:station|department)\b/,
  },
  {
    label: 'Police',
    category: 'police',
    kind: 'civic',
    categoryPattern: /\b(?:police|sheriff|law\s+enforcement)\b/,
    titlePattern: /\b(?:police|sheriff)\b/,
  },
  {
    label: 'ATM',
    category: 'atm',
    kind: 'finance',
    categoryPattern: /\batm\b/,
    titlePattern: /\batm\b/,
  },
  {
    label: 'Parking',
    category: 'parking',
    kind: 'parking',
    categoryPattern: /\b(?:parking|car\s+park|parkade)\b/,
    titlePattern: /\bparking\b/,
  },
  {
    label: 'Transit',
    category: 'transit',
    kind: 'transit',
    categoryPattern: /\b(?:airport|bus\s+station|train\s+station|railway|metro|subway|transit|transport|ferry|tram)\b/,
    titlePattern: /\b(?:airport|bus\s+station|train\s+station|rail\s+station|terminal|transit|ferry)\b/,
  },
  {
    label: 'Grocery',
    category: 'grocery',
    kind: 'shopping',
    categoryPattern: /\b(?:grocery|supermarket|food\s+market)\b/,
    titlePattern: GROCERY_TITLE_PATTERN,
  },
  {
    label: 'Pharmacy',
    category: 'pharmacy',
    kind: 'health',
    categoryPattern: /\b(?:pharmacy|drugstore|drug\s+store|chemist)\b/,
    titlePattern: PHARMACY_TITLE_PATTERN,
  },
  {
    label: 'Medical',
    category: 'medical',
    kind: 'health',
    categoryPattern: /\b(?:hospital|clinic|urgent\s+care|emergency\s+room|medical|doctor|dentist|veterinary|optical|health)\b/,
    titlePattern: HEALTH_TITLE_PATTERN,
  },
  {
    label: 'Coffee',
    category: 'coffee',
    kind: 'food',
    categoryPattern: /\b(?:coffee|cafe|cafeteria|espresso)\b/,
    titlePattern: COFFEE_TITLE_PATTERN,
  },
  {
    label: 'Restaurant',
    category: 'restaurant',
    kind: 'food',
    categoryPattern: /\b(?:restaurant|fast\s+food|food\s+and\s+drink|food|diner|eatery|pizza|burger|sandwich|taco|sushi|bbq|barbecue|bakery|ice\s+cream)\b/,
    titlePattern: RESTAURANT_TITLE_PATTERN,
  },
  {
    label: 'Bar',
    category: 'bar',
    kind: 'food',
    categoryPattern: /\b(?:bar|pub|brewery|beer|wine|cocktail|nightclub|nightlife)\b/,
    titlePattern: /\b(?:bar|pub|brewery|taproom|nightclub)\b/,
  },
  {
    label: 'Hotel',
    category: 'hotel',
    kind: 'lodging',
    categoryPattern: /\b(?:hotel|motel|lodging|lodge|resort|hostel|inn)\b/,
    titlePattern: HOTEL_TITLE_PATTERN,
  },
  {
    label: 'Park',
    category: 'park',
    kind: 'park',
    categoryPattern: /\b(?:park|gardens?|trail|nature|beach|campground|playground|picnic|recreation\s+area)\b/,
    titlePattern: /\b(?:park|botanical\s+gardens?|water\s+gardens?|trail|trailhead|nature\s+preserve|beach|campground|playground)\b/,
  },
  {
    label: 'Fitness',
    category: 'fitness',
    kind: 'adventure',
    categoryPattern: /\b(?:gym|fitness|sports\s+club|recreation\s+center|yoga|pilates|climbing)\b/,
    titlePattern: FITNESS_TITLE_PATTERN,
  },
  {
    label: 'Entertainment',
    category: 'entertainment',
    kind: 'entertainment',
    categoryPattern: /\b(?:entertainment|amusement|theme\s+park|cinema|movie|theater|theatre|bowling|arcade|zoo|aquarium|stadium|arena|music\s+venue|performing\s+arts)\b/,
    titlePattern: ENTERTAINMENT_TITLE_PATTERN,
  },
  {
    label: 'Museum',
    category: 'museum',
    kind: 'landmark',
    categoryPattern: /\b(?:museum|gallery|art\s+gallery)\b/,
    titlePattern: /\b(?:museum|gallery)\b/,
  },
  {
    label: 'Landmark',
    category: 'landmark',
    kind: 'landmark',
    categoryPattern: /\b(?:tourist|attraction|landmark|historic|monument|viewpoint|scenic|lookout)\b/,
    titlePattern: /\b(?:landmark|monument|historic|lookout|overlook|viewpoint)\b/,
  },
  {
    label: 'Place of worship',
    category: 'worship',
    kind: 'landmark',
    categoryPattern: /\b(?:church|mosque|temple|synagogue|place\s+of\s+worship|religious)\b/,
    titlePattern: /\b(?:church|mosque|temple|synagogue|cathedral)\b/,
  },
  {
    label: 'Library',
    category: 'library',
    kind: 'landmark',
    categoryPattern: /\blibrary\b/,
    titlePattern: /\blibrary\b/,
  },
  {
    label: 'School',
    category: 'school',
    kind: 'education',
    categoryPattern: /\b(?:school|college|university|education|campus)\b/,
    titlePattern: /\b(?:school|college|university|academy|campus)\b/,
  },
  {
    label: 'Auto service',
    category: 'auto_service',
    kind: 'shopping',
    categoryPattern: /\b(?:auto|automotive|car\s+wash|car\s+repair|car\s+rental|vehicle|tire|tyre|mechanic|dealership)\b/,
    titlePattern: /\b(?:auto|automotive|car\s+wash|car\s+rental|tire|tyre|mechanic|dealership)\b/,
  },
  {
    label: 'Bank',
    category: 'bank',
    kind: 'finance',
    categoryPattern: /\b(?:bank|credit\s+union|finance|financial)\b/,
    titlePattern: BANK_TITLE_PATTERN,
  },
  {
    label: 'Shopping',
    category: 'shopping',
    kind: 'shopping',
    categoryPattern: /\b(?:shop|shopping|store|retail|mall|department\s+store|clothing|hardware|electronics|bookstore|convenience)\b/,
    titlePattern: RETAIL_TITLE_PATTERN,
  },
  {
    label: 'Services',
    category: 'service',
    kind: 'other',
    categoryPattern: /\b(?:salon|spa|barber|laundry|dry\s+cleaner|post\s+office|courthouse|city\s+hall|government|service)\b/,
    titlePattern: /\b(?:salon|spa|barber|laundry|post\s+office|courthouse|city\s+hall)\b/,
  },
] as const;

function normalizePlaceCategoryText(...values: Array<string | undefined>): string {
  return values
    .filter(Boolean)
    .join(' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getPlaceCategoryOverride(
  rawCategory: string | undefined,
  title: string | undefined,
): PlaceCategoryOverride | null {
  const categoryText = normalizePlaceCategoryText(rawCategory);
  const titleText = normalizePlaceCategoryText(title);
  if (!titleText && !categoryText) {
    return null;
  }

  if (isFuelPlaceCategory(rawCategory, titleText)) return { label: 'Gas station', category: 'gas_station', kind: 'fuel' };

  const matchingRule = PLACE_CATEGORY_RULES.find((rule) =>
    Boolean(
      (categoryText && rule.categoryPattern?.test(categoryText)) ||
      (titleText && rule.titlePattern?.test(titleText)),
    ),
  );

  if (matchingRule) {
    return {
      label: matchingRule.label,
      category: matchingRule.category,
      kind: matchingRule.kind,
    };
  }

  return null;
}

function resolveNearbyPlaceCategoryValue(rawCategory: string | undefined, title: string | undefined): string {
  return getPlaceCategoryOverride(rawCategory, title)?.category || rawCategory || 'place';
}

function isFuelPlaceCategory(category: string | undefined, title = ''): boolean {
  const categoryText = normalizePlaceCategoryText(category);
  const titleText = normalizePlaceCategoryText(title);
  if (/gas station|fuel|petrol|service station|ev charging|charging station/.test(categoryText)) {
    return true;
  }

  return GAS_STATION_TITLE_PATTERN.test(titleText) &&
    /gas|fuel|petrol|charging|motorist|convenience|service|store|shop|poi|place/.test(categoryText || 'place');
}

function normalizeNearbyPlaceCategoryLabel(
  label: string | undefined,
  title = '',
  fallback = 'Place',
): string {
  const categoryOverride = getPlaceCategoryOverride(label, title);
  if (categoryOverride) {
    return categoryOverride.label;
  }

  const labelText = normalizePlaceCategoryText(label);
  const titleText = normalizePlaceCategoryText(title);
  const combinedText = `${titleText} ${labelText}`;

  if (/fire station|fire department|\bfire\b/.test(combinedText)) return 'Fire station';
  if (/police|sheriff/.test(combinedText)) return 'Police';
  if (/hospital|clinic|urgent care|emergency room|medical/.test(combinedText)) return 'Medical';
  if (/pharmacy|drugstore/.test(combinedText)) return 'Pharmacy';
  if (isFuelPlaceCategory(label, title)) return 'Gas station';
  if (/motorist/.test(labelText)) return 'Travel stop';
  if (/grocery|supermarket|market/.test(combinedText)) return 'Grocery';
  if (/shop|store|mall|retail/.test(combinedText)) return 'Shopping';
  if (/entertainment|amusement|theme park|cinema|movie|theater|theatre|bowling|arcade|zoo|aquarium|stadium|arena/.test(combinedText)) return 'Entertainment';
  if (/restaurant|diner|food/.test(combinedText)) return 'Restaurant';
  if (/coffee|cafe/.test(combinedText)) return 'Coffee';
  if (/\bbar\b|pub|nightlife/.test(combinedText)) return 'Bar';
  if (/park|trail|garden|nature/.test(combinedText)) return 'Park';
  if (/museum/.test(combinedText)) return 'Museum';
  if (/tourist|landmark|attraction|historic/.test(combinedText)) return 'Landmark';
  if (/hotel|lodg/.test(combinedText)) return 'Hotel';
  if (/school|college|university|education/.test(combinedText)) return 'School';
  if (/parking/.test(combinedText)) return 'Parking';
  if (/\batm\b/.test(combinedText)) return 'ATM';
  if (/bank/.test(combinedText)) return 'Bank';
  if (/shop|store|mall|retail/.test(combinedText)) return 'Shopping';

  return titleCaseMapFeatureCategory(label || fallback);
}

function formatNearbyPlaceCategory(place: MapNearbyPlacePin): string {
  const label = place.categoryLabel || place.category || (place.kind === 'fuel' ? 'Fuel' : 'Place');
  return normalizeNearbyPlaceCategoryLabel(label, place.title, place.kind === 'fuel' ? 'Gas station' : 'Place');
}

function formatNearbyPlaceAddress(place: MapNearbyPlacePin): string {
  return place.address || place.subtitle || '';
}

function buildGoogleMapsAddressUrl(place: MapNearbyPlacePin, address: string): string {
  const query = address.trim() ||
    [place.title, place.latitude.toFixed(6), place.longitude.toFixed(6)].filter(Boolean).join(' ');
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', query);
  return url.toString();
}

function formatNearbyPlaceDistance(place: MapNearbyPlacePin): string {
  return place.distanceLabel || '';
}

function getNearbyPlaceKind(place: MapNearbyPlacePin): string {
  if (place.kind === 'fuel') {
    return 'fuel';
  }

  const categoryOverride = getPlaceCategoryOverride(place.categoryLabel || place.category, place.title);
  if (categoryOverride) {
    return categoryOverride.kind;
  }

  const normalizedLabel = normalizeNearbyPlaceCategoryLabel(place.categoryLabel || place.category, place.title);
  const category = `${place.category ?? ''} ${place.categoryLabel ?? ''} ${normalizedLabel} ${place.title ?? ''}`.toLowerCase();
  if (isFuelPlaceCategory(category, place.title)) return 'fuel';
  if (/hospital|clinic|pharmacy|health|medical/.test(category)) return 'health';
  if (/entertainment|amusement|theme park|cinema|movie|theater|theatre|bowling|arcade|zoo|aquarium|stadium|arena/.test(category)) return 'entertainment';
  if (/shop|store|mall|retail|grocery|supermarket|market/.test(category)) return 'shopping';
  if (/school|college|university|education/.test(category)) return 'education';
  if (/food|drink|coffee|restaurant|cafe|bar/.test(category)) return 'food';
  if (/park|trail|garden|nature/.test(category)) return 'park';
  if (/hotel|lodg/.test(category)) return 'lodging';
  if (/gas|fuel|charging/.test(category)) return 'fuel';
  if (/tourist|landmark|museum|historic|attraction|culture/.test(category)) return 'landmark';
  return 'other';
}

function getNearbyPlaceIconName(place: MapNearbyPlacePin): string {
  if (place.iconName) {
    return place.iconName;
  }

  const kind = getNearbyPlaceKind(place);
  switch (kind) {
    case 'fuel':
      return 'fuel';
    case 'food':
      return 'food';
    case 'park':
      return 'nature';
    case 'shopping':
      return 'shopping';
    case 'entertainment':
      return 'entertainment';
    case 'landmark':
      return 'scenic';
    case 'education':
      return 'culture';
    default:
      return 'pin';
  }
}

function createNearbyPlaceMarkerIcon(iconName: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'nearby-place-marker__svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');

  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `/scope-icons.svg#icon-${iconName}`);
  svg.append(use);
  return svg;
}

function mapNearbySearchResultToPin(place: NearbyPlaceResult): MapNearbyPlacePin {
  const categoryLabel = normalizeNearbyPlaceCategoryLabel(
    place.categoryLabel || place.category || place.precision,
    place.placeName,
  );
  const categoryText = `${place.categoryId ?? ''} ${place.category ?? ''} ${place.categoryLabel ?? ''}`;
  const distanceLabel = isFiniteNumber(place.distanceKm)
    ? place.distanceKm >= 1
      ? `${place.distanceKm.toFixed(place.distanceKm >= 10 ? 0 : 1).replace(/\.0$/, '')} km from center`
      : `${Math.max(25, Math.round(place.distanceKm * 1000 / 25) * 25)} m from center`
    : undefined;

  return {
    id: place.id || `${place.placeName}:${place.latitude.toFixed(5)}:${place.longitude.toFixed(5)}`,
    title: place.placeName || 'Nearby place',
    latitude: place.latitude,
    longitude: place.longitude,
    kind: isFuelPlaceCategory(categoryText, place.placeName) ? 'fuel' : 'place',
    category: resolveNearbyPlaceCategoryValue(place.category || place.categoryId, place.placeName),
    categoryLabel,
    address: place.formattedAddress || place.address || [place.city, place.country].filter(Boolean).join(', ') || undefined,
    sourceLabel: place.source === 'mapbox' ? 'Mapbox' : 'Scope',
    photoUrl: place.photoUrl,
    photoAttribution: place.photoAttribution,
    photoAttributionUrl: place.photoAttributionUrl,
    photoLookupStatus: place.photoUrl ? 'complete' : undefined,
    distanceLabel,
  };
}

function sanitizeMapFeatureText(value: unknown, maxLength = 140): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function readMapFeatureProperty(
  feature: mapboxgl.MapboxGeoJSONFeature,
  propertyNames: string[],
  maxLength?: number,
): string {
  const properties = feature.properties ?? {};
  for (const propertyName of propertyNames) {
    const value = sanitizeMapFeatureText(properties[propertyName], maxLength);
    if (value) {
      return value;
    }
  }

  return '';
}

function getMapFeatureLayerSourceLayer(feature: mapboxgl.MapboxGeoJSONFeature): string {
  return String((feature.layer as { 'source-layer'?: unknown } | undefined)?.['source-layer'] ?? '').toLowerCase();
}

function getInteractiveMapFeatureLayerIds(instance: mapboxgl.Map): string[] {
  return (instance.getStyle().layers ?? [])
    .filter((layer) => {
      const layerId = String(layer.id ?? '');
      if (!layerId || layer.type !== 'symbol') {
        return false;
      }

      return isPoiLabelLayer(layerId.toLowerCase(), getLayerSourceLayer(layer));
    })
    .map((layer) => String(layer.id));
}

function getMapFeatureCoordinates(
  feature: mapboxgl.MapboxGeoJSONFeature,
  fallback: mapboxgl.LngLat,
): { latitude: number; longitude: number } {
  const geometry = feature.geometry as { type?: string; coordinates?: unknown } | null | undefined;
  if (geometry?.type === 'Point' && Array.isArray(geometry.coordinates)) {
    const longitude = Number(geometry.coordinates[0]);
    const latitude = Number(geometry.coordinates[1]);
    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    ) {
      return { latitude, longitude };
    }
  }

  return { latitude: fallback.lat, longitude: fallback.lng };
}

function titleCaseMapFeatureCategory(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function getMapFeatureCategoryLabel(feature: mapboxgl.MapboxGeoJSONFeature, title = ''): string {
  const category = readMapFeatureProperty(feature, ['category', 'class', 'type', 'maki'], 80);
  return normalizeNearbyPlaceCategoryLabel(category, title);
}

function getMapFeatureCategory(feature: mapboxgl.MapboxGeoJSONFeature, title = ''): string {
  return resolveNearbyPlaceCategoryValue(readMapFeatureProperty(feature, ['maki', 'category', 'class', 'type'], 80), title);
}

function buildAddressFromMapFeatureParts(feature: mapboxgl.MapboxGeoJSONFeature): string {
  const houseNumber = readMapFeatureProperty(feature, ['house_num', 'housenum', 'housenumber', 'addr:housenumber'], 24);
  const street = readMapFeatureProperty(feature, ['street', 'street_name', 'addr:street'], 120);
  const city = readMapFeatureProperty(feature, ['city', 'place', 'locality'], 80);
  const region = readMapFeatureProperty(feature, ['region', 'state'], 40);
  const postalCode = readMapFeatureProperty(feature, ['postcode', 'postal_code', 'addr:postcode'], 24);
  const streetLine = [houseNumber, street].filter(Boolean).join(' ');
  const localityLine = [city, region, postalCode].filter(Boolean).join(', ');
  return [streetLine, localityLine].filter(Boolean).join(', ');
}

function getMapFeatureAddress(feature: mapboxgl.MapboxGeoJSONFeature): string | undefined {
  return readMapFeatureProperty(feature, ['full_address', 'place_name', 'address', 'addr_full', 'addr:full'], 180) ||
    buildAddressFromMapFeatureParts(feature) ||
    undefined;
}

function buildMapFeaturePlaceEnrichmentKey(pin: MapNearbyPlacePin): string {
  return [
    pin.title.trim().toLowerCase(),
    String(pin.category ?? '').trim().toLowerCase(),
    pin.latitude.toFixed(5),
    pin.longitude.toFixed(5),
  ].join(':');
}

function compactMapFeaturePlaceEnrichment(patch: MapFeaturePlaceEnrichment): MapFeaturePlaceEnrichment {
  const nextPatch: MapFeaturePlaceEnrichment = {};
  const title = patch.title?.trim();
  const address = patch.address?.trim();
  const subtitle = patch.subtitle?.trim();
  const photoUrl = patch.photoUrl?.trim();
  const photoAttribution = patch.photoAttribution?.trim();
  const photoAttributionUrl = patch.photoAttributionUrl?.trim();
  const sourceLabel = patch.sourceLabel?.trim();

  if (title) {
    nextPatch.title = title;
  }

  if (address) {
    nextPatch.address = address;
  }

  if (subtitle) {
    nextPatch.subtitle = subtitle;
  }

  if (photoUrl) {
    nextPatch.photoUrl = photoUrl;
  }

  if (photoAttribution) {
    nextPatch.photoAttribution = photoAttribution;
  }

  if (photoAttributionUrl) {
    nextPatch.photoAttributionUrl = photoAttributionUrl;
  }

  if (patch.photoLookupStatus) {
    nextPatch.photoLookupStatus = patch.photoLookupStatus;
  }

  if (sourceLabel) {
    nextPatch.sourceLabel = sourceLabel;
  }

  return nextPatch;
}

function cacheMapFeaturePlaceEnrichment(cacheKey: string, patch: MapFeaturePlaceEnrichment): void {
  const compactPatch = compactMapFeaturePlaceEnrichment(patch);
  if (!Object.keys(compactPatch).length) {
    return;
  }

  const cachedPatch = {
    ...mapFeaturePlaceEnrichmentCache.get(cacheKey),
    ...compactPatch,
  };
  mapFeaturePlaceEnrichmentCache.delete(cacheKey);
  mapFeaturePlaceEnrichmentCache.set(cacheKey, cachedPatch);

  while (mapFeaturePlaceEnrichmentCache.size > MAP_FEATURE_PLACE_PIN_LIMIT * 3) {
    const oldestKey = mapFeaturePlaceEnrichmentCache.keys().next().value as string | undefined;
    if (!oldestKey) {
      break;
    }
    mapFeaturePlaceEnrichmentCache.delete(oldestKey);
  }
}

function applyCachedMapFeaturePlaceEnrichment(pin: MapNearbyPlacePin): MapNearbyPlacePin {
  const cachedPatch = mapFeaturePlaceEnrichmentCache.get(buildMapFeaturePlaceEnrichmentKey(pin));
  if (!cachedPatch) {
    return pin;
  }

  return {
    ...pin,
    ...cachedPatch,
    subtitle: cachedPatch.subtitle ?? cachedPatch.address ?? pin.subtitle,
  };
}

function syncActiveMapFeaturePlacePinFromCache(pin: MapNearbyPlacePin): void {
  if (activeNearbyPlaceMarkerId.value !== pin.id) {
    return;
  }

  let didPatchActivePin = false;
  let didChangeActivePin = false;
  mapFeaturePlacePins.value = mapFeaturePlacePins.value.map((place) => {
    if (place.id !== pin.id) {
      return place;
    }

    didPatchActivePin = true;
    const enrichedPlace = applyCachedMapFeaturePlaceEnrichment(place);
    didChangeActivePin = buildNearbyPlaceMarkerSignature(enrichedPlace) !== buildNearbyPlaceMarkerSignature(place);
    return enrichedPlace;
  });

  if (!didPatchActivePin || !didChangeActivePin) {
    return;
  }

  syncNearbyPlaceMarkers();
  syncActiveNearbyPlaceMarkerLayer();
}

function hasWarmMapFeaturePlaceEnrichment(pin: MapNearbyPlacePin): boolean {
  const cachedPatch = mapFeaturePlaceEnrichmentCache.get(buildMapFeaturePlaceEnrichmentKey(pin));
  if (!cachedPatch) {
    return false;
  }

  const hasAddress = isUsableMapFeatureAddress(cachedPatch.address || cachedPatch.subtitle || pin.address);
  const hasResolvedPhoto = cachedPatch.photoLookupStatus === 'complete' ||
    Boolean(cachedPatch.photoUrl?.trim() || pin.photoUrl?.trim());
  const needsPhotoLookup = !pin.photoUrl?.trim();
  return hasAddress && (!needsPhotoLookup || hasResolvedPhoto);
}

function isCoordinateLikeAddress(value: string | undefined): boolean {
  const text = value?.trim();
  if (!text) {
    return false;
  }

  return /^-?\d{1,3}(?:\.\d+)?,\s*-?\d{1,3}(?:\.\d+)?$/.test(text);
}

function isUsableMapFeatureAddress(value: string | undefined): boolean {
  const text = value?.trim();
  return Boolean(text && text.length >= 6 && !isCoordinateLikeAddress(text));
}

function isUsableMapFeatureGeocodeResult(result: { precision?: string; formattedAddress?: string; address?: string } | null | undefined): boolean {
  if (!result) {
    return false;
  }

  const precision = String(result.precision ?? '').toLowerCase();
  if (['coordinate', 'fallback'].includes(precision)) {
    return false;
  }

  return isUsableMapFeatureAddress(result.formattedAddress || result.address);
}

function mapRenderedFeatureToNearbyPlacePin(
  feature: mapboxgl.MapboxGeoJSONFeature,
  fallbackLngLat: mapboxgl.LngLat,
): MapNearbyPlacePin | null {
  const sourceLayer = getMapFeatureLayerSourceLayer(feature);
  const layerId = String(feature.layer?.id ?? '').toLowerCase();
  if (!isPoiLabelLayer(layerId, sourceLayer)) {
    return null;
  }

  const title = readMapFeatureProperty(feature, ['name', 'name_en', 'name_script', 'brand', 'ref'], 120);
  const category = getMapFeatureCategory(feature, title);
  if (!title || !category) {
    return null;
  }

  const { latitude, longitude } = getMapFeatureCoordinates(feature, fallbackLngLat);
  const stableId = sanitizeMapFeatureText(feature.id, 80) ||
    `${title}:${category}:${latitude.toFixed(5)}:${longitude.toFixed(5)}`;

  return {
    id: `map-feature-${stableId}`,
    title,
    latitude,
    longitude,
    kind: isFuelPlaceCategory(category, title) ? 'fuel' : 'place',
    category,
    categoryLabel: getMapFeatureCategoryLabel(feature, title),
    address: getMapFeatureAddress(feature),
    photoLookupStatus: 'pending',
    sourceLabel: 'Mapbox',
  };
}

function upsertMapFeaturePlacePin(pin: MapNearbyPlacePin, options: { activate?: boolean } = {}): MapNearbyPlacePin {
  const enrichedPin = applyCachedMapFeaturePlaceEnrichment(pin);
  const nextPins = [
    enrichedPin,
    ...mapFeaturePlacePins.value.filter((place) => place.id !== enrichedPin.id),
  ].slice(0, MAP_FEATURE_PLACE_PIN_LIMIT);
  mapFeaturePlacePins.value = nextPins;
  syncNearbyPlaceMarkers();
  if (options.activate !== false || isUsableMapFeatureAddress(enrichedPin.address || enrichedPin.subtitle)) {
    activateNearbyPlaceMarker(enrichedPin.id);
  }
  return enrichedPin;
}

function applyMapFeaturePlacePinEnrichment(
  pin: MapNearbyPlacePin,
  cacheKey: string,
  patch: MapFeaturePlaceEnrichment,
  requestId: number,
): void {
  if (requestId !== mapFeaturePlaceRequestId) {
    return;
  }

  const compactPatch = compactMapFeaturePlaceEnrichment(patch);
  if (!Object.keys(compactPatch).length) {
    return;
  }

  cacheMapFeaturePlaceEnrichment(cacheKey, compactPatch);
  let didPatchActivePin = false;
  mapFeaturePlacePins.value = mapFeaturePlacePins.value.map((place) =>
    place.id === pin.id
      ? (() => {
          didPatchActivePin = true;
          return {
            ...place,
            ...compactPatch,
            subtitle: compactPatch.subtitle ?? compactPatch.address ?? place.subtitle,
          };
        })()
      : place,
  );

  if (!didPatchActivePin || activeNearbyPlaceMarkerId.value !== pin.id) {
    return;
  }

  syncNearbyPlaceMarkers();
  syncActiveNearbyPlaceMarkerLayer();
}

function preloadNearbyPlacePhoto(photoUrl: string): Promise<void> {
  const normalizedPhotoUrl = photoUrl.trim();
  if (!normalizedPhotoUrl || typeof Image === 'undefined') {
    return Promise.resolve();
  }

  if (import.meta.env.MODE === 'test' || isUiTestEnvironment()) {
    return Promise.resolve();
  }

  const cachedPreload = nearbyPlacePhotoPreloadCache.get(normalizedPhotoUrl);
  if (cachedPreload) {
    nearbyPlacePhotoPreloadCache.delete(normalizedPhotoUrl);
    nearbyPlacePhotoPreloadCache.set(normalizedPhotoUrl, cachedPreload);
    return cachedPreload;
  }

  const preloadPromise = new Promise<void>((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.loading = 'eager';
    image.src = normalizedPhotoUrl;

    if (typeof image.decode === 'function') {
      image.decode().catch(() => undefined).then(() => resolve());
      return;
    }

    image.onload = () => resolve();
    image.onerror = () => resolve();
  });

  nearbyPlacePhotoPreloadCache.set(normalizedPhotoUrl, preloadPromise);
  while (nearbyPlacePhotoPreloadCache.size > NEARBY_PLACE_PHOTO_PRELOAD_CACHE_LIMIT) {
    const oldestKey = nearbyPlacePhotoPreloadCache.keys().next().value as string | undefined;
    if (!oldestKey) {
      break;
    }

    nearbyPlacePhotoPreloadCache.delete(oldestKey);
  }

  return preloadPromise;
}

function getCachedMapFeaturePlaceEnrichment(pin: MapNearbyPlacePin): MapFeaturePlaceEnrichment | undefined {
  return mapFeaturePlaceEnrichmentCache.get(buildMapFeaturePlaceEnrichmentKey(pin));
}

function hasRealMapFeaturePlacePhoto(pin: MapNearbyPlacePin): boolean {
  const cachedPatch = getCachedMapFeaturePlaceEnrichment(pin);
  return Boolean(pin.photoUrl?.trim() || cachedPatch?.photoUrl?.trim());
}

function hasSettledMapFeaturePlacePhotoLookup(pin: MapNearbyPlacePin): boolean {
  const cachedPatch = getCachedMapFeaturePlaceEnrichment(pin);
  return Boolean(pin.photoUrl?.trim() || cachedPatch?.photoUrl?.trim() || cachedPatch?.photoLookupStatus === 'complete');
}

function prefetchMapFeaturePlacePhoto(pin: MapNearbyPlacePin): Promise<void> | null {
  if (hasSettledMapFeaturePlacePhotoLookup(pin)) {
    return null;
  }

  const cacheKey = buildMapFeaturePlaceEnrichmentKey(pin);
  const existingPrefetch = mapFeaturePlacePhotoPrefetchPromises.get(cacheKey);
  if (existingPrefetch) {
    return existingPrefetch;
  }

  const cachedPatch = mapFeaturePlaceEnrichmentCache.get(cacheKey);
  const photoPromise = getPlacePhoto({
    title: pin.title || cachedPatch?.title || 'Nearby place',
    address: pin.address || pin.subtitle || cachedPatch?.address || cachedPatch?.subtitle,
    latitude: pin.latitude,
    longitude: pin.longitude,
    maxWidthPx: NEARBY_PLACE_POPUP_FALLBACK_PHOTO_WIDTH,
  })
    .then(async (photoLookup) => {
      const photoUrl = photoLookup?.photoUrl?.trim();
      if (photoUrl) {
        await preloadNearbyPlacePhoto(photoUrl);
      }
      cacheMapFeaturePlaceEnrichment(cacheKey, {
        photoUrl,
        photoAttribution: photoLookup?.photoAttribution,
        photoAttributionUrl: photoLookup?.photoAttributionUrl,
        photoLookupStatus: 'complete',
        sourceLabel: photoUrl ? photoLookup?.source || pin.sourceLabel : pin.sourceLabel,
      });
      syncActiveMapFeaturePlacePinFromCache(pin);
    })
    .catch(() => {
      cacheMapFeaturePlaceEnrichment(cacheKey, {
        photoLookupStatus: 'complete',
      });
    })
    .finally(() => {
      mapFeaturePlacePhotoPrefetchPromises.delete(cacheKey);
    });

  mapFeaturePlacePhotoPrefetchPromises.set(cacheKey, photoPromise);
  return photoPromise;
}

function waitForMapFeaturePlacePhoto(pin: MapNearbyPlacePin, prefetchPromise: Promise<void> | null): Promise<void> {
  if (!prefetchPromise || hasRealMapFeaturePlacePhoto(pin)) {
    return Promise.resolve();
  }

  return Promise.race([
    prefetchPromise,
    new Promise<void>((resolve) => {
      setTimeout(resolve, MAP_FEATURE_PLACE_CLICK_PHOTO_WAIT_MS);
    }),
  ]).then(() => undefined);
}

function prefetchMapFeaturePlacePin(pin: MapNearbyPlacePin): Promise<void> | null {
  if (hasWarmMapFeaturePlaceEnrichment(pin)) {
    return null;
  }

  const cacheKey = buildMapFeaturePlaceEnrichmentKey(pin);
  const existingPrefetch = mapFeaturePlacePrefetchPromises.get(cacheKey);
  if (existingPrefetch) {
    return existingPrefetch;
  }

  const addressPromise = isUsableMapFeatureAddress(pin.address)
    ? Promise.resolve()
    : reverseGeocode(pin.latitude, pin.longitude)
      .then((result) => {
        if (!isUsableMapFeatureGeocodeResult(result)) {
          return;
        }

        const address = result?.formattedAddress || result?.address;
        if (!isUsableMapFeatureAddress(address)) {
          return;
        }

        cacheMapFeaturePlaceEnrichment(cacheKey, {
          title: pin.title || result?.placeName || 'Nearby place',
          address,
          subtitle: address,
        });
        syncActiveMapFeaturePlacePinFromCache(pin);
      })
      .catch(() => undefined);

  const photoPromise = prefetchMapFeaturePlacePhoto(pin) ?? Promise.resolve();

  const prefetchPromise = Promise.allSettled([addressPromise, photoPromise])
    .then(() => {
      syncActiveMapFeaturePlacePinFromCache(pin);
    })
    .finally(() => {
      mapFeaturePlacePrefetchPromises.delete(cacheKey);
    });
  mapFeaturePlacePrefetchPromises.set(cacheKey, prefetchPromise);
  return prefetchPromise;
}

async function enrichMapFeaturePlacePinAddress(pin: MapNearbyPlacePin): Promise<void> {
  const requestId = ++mapFeaturePlaceRequestId;
  const cacheKey = buildMapFeaturePlaceEnrichmentKey(pin);

  const addressPromise = reverseGeocode(pin.latitude, pin.longitude)
    .then((result) => {
      if (!result) {
        return;
      }

      const geocodedAddress = result.formattedAddress || result.address;
      const address = isUsableMapFeatureGeocodeResult(result)
        ? geocodedAddress
        : pin.address;
      if (!isUsableMapFeatureAddress(address)) {
        return;
      }

      applyMapFeaturePlacePinEnrichment(pin, cacheKey, {
        title: pin.title || result.placeName || 'Nearby place',
        address,
        subtitle: address,
      }, requestId);
      if (activeNearbyPlaceMarkerId.value !== pin.id) {
        activateNearbyPlaceMarker(pin.id);
      }
    })
    .catch(() => undefined);

  const photoPromise = prefetchMapFeaturePlacePhoto(pin) ?? Promise.resolve();

  await Promise.allSettled([addressPromise, photoPromise]);
}

function getRenderedMapFeaturePlacePinAtPoint(
  point: { x: number; y: number },
  lngLat: mapboxgl.LngLat,
  radiusPx = MAP_FEATURE_CLICK_RADIUS_PX,
): MapNearbyPlacePin | null {
  const instance = map.value;
  if (!instance || !shouldHandleInteractiveMapFeaturePlaces()) {
    return null;
  }

  const layerIds = getInteractiveMapFeatureLayerIds(instance);
  if (!layerIds.length) {
    return null;
  }

  const clickBounds: [[number, number], [number, number]] = [
    [point.x - radiusPx, point.y - radiusPx],
    [point.x + radiusPx, point.y + radiusPx],
  ];
  const features = instance.queryRenderedFeatures(clickBounds, { layers: layerIds });
  const fallbackFeatures = features.length ? [] : instance.queryRenderedFeatures(clickBounds);
  return features
    .concat(fallbackFeatures)
    .map((feature) => mapRenderedFeatureToNearbyPlacePin(feature, lngLat))
    .find((place): place is MapNearbyPlacePin => Boolean(place)) ?? null;
}

function shouldHandleInteractiveMapFeaturePlaces(): boolean {
  return interactiveMapEnabled.value && !props.clickToSelect;
}

async function activateRenderedMapFeaturePlacePin(pin: MapNearbyPlacePin): Promise<void> {
  const clickRequestId = ++mapFeaturePlaceClickRequestId;
  const photoPrefetchPromise = prefetchMapFeaturePlacePhoto(pin);
  const prefetchPromise = prefetchMapFeaturePlacePin(pin);
  await waitForMapFeaturePlacePhoto(pin, photoPrefetchPromise ?? prefetchPromise);
  const nextPin = applyCachedMapFeaturePlaceEnrichment(pin);

  if (clickRequestId !== mapFeaturePlaceClickRequestId || !interactiveMapEnabled.value) {
    return;
  }

  const activePin = upsertMapFeaturePlacePin(nextPin, {
    activate: true,
  });
  emit('interaction', { type: 'map_feature_place_select' });
  if (!hasWarmMapFeaturePlaceEnrichment(activePin)) {
    if (prefetchPromise) {
      void prefetchPromise
        .then(() => syncActiveMapFeaturePlacePinFromCache(activePin))
        .catch(() => undefined);
    } else {
      void enrichMapFeaturePlacePinAddress(activePin);
    }
  }
}

function handleRenderedMapFeatureClickAtPoint(point: { x: number; y: number }, lngLat: mapboxgl.LngLat): boolean {
  const pin = getRenderedMapFeaturePlacePinAtPoint(point, lngLat);
  if (!pin) {
    mapFeaturePlaceClickRequestId += 1;
    return false;
  }

  void activateRenderedMapFeaturePlacePin(pin);
  return true;
}

function handleRenderedMapFeatureClick(event: mapboxgl.MapMouseEvent): boolean {
  return handleRenderedMapFeatureClickAtPoint(event.point, event.lngLat);
}

function clearMapFeaturePlacePrefetchTimer(): void {
  if (mapFeaturePlacePrefetchTimer) {
    clearTimeout(mapFeaturePlacePrefetchTimer);
    mapFeaturePlacePrefetchTimer = null;
  }
  pendingMapFeaturePlacePrefetch = null;
}

function clearVisibleMapFeaturePlacePhotoPrefetchTimer(): void {
  if (mapFeatureVisiblePhotoPrefetchTimer) {
    clearTimeout(mapFeatureVisiblePhotoPrefetchTimer);
    mapFeatureVisiblePhotoPrefetchTimer = null;
  }
}

function getVisibleMapFeaturePlacePhotoPrefetchPins(instance: mapboxgl.Map): MapNearbyPlacePin[] {
  if (instance.getZoom() < MAP_FEATURE_VISIBLE_PHOTO_PREFETCH_MIN_ZOOM) {
    return [];
  }

  const layerIds = getInteractiveMapFeatureLayerIds(instance);
  if (!layerIds.length) {
    return [];
  }

  const canvas = instance.getCanvas();
  const container = mapContainer.value ?? instance.getContainer();
  const width = Math.max(canvas.clientWidth || 0, canvas.width || 0, container.clientWidth || 0);
  const height = Math.max(canvas.clientHeight || 0, canvas.height || 0, container.clientHeight || 0);
  if (!width || !height) {
    return [];
  }

  const horizontalInset = Math.round(width * 0.12);
  const verticalInset = Math.round(height * 0.12);
  const bounds: [[number, number], [number, number]] = [
    [horizontalInset, verticalInset],
    [width - horizontalInset, height - verticalInset],
  ];
  const center = instance.getCenter();
  const fallbackLngLat = { lng: center.lng, lat: center.lat } as mapboxgl.LngLat;
  const seen = new Set<string>();
  const centerPoint = { x: width / 2, y: height / 2 };

  return instance.queryRenderedFeatures(bounds, { layers: layerIds })
    .map((feature) => mapRenderedFeatureToNearbyPlacePin(feature, fallbackLngLat))
    .filter((place): place is MapNearbyPlacePin => Boolean(place))
    .map((place) => {
      let distance = Number.MAX_SAFE_INTEGER;
      try {
        const point = instance.project([place.longitude, place.latitude]);
        distance = Math.hypot(point.x - centerPoint.x, point.y - centerPoint.y);
      } catch {
        // If projection is briefly unavailable during a style settle, keep the pin but rank it last.
      }

      return { place, distance };
    })
    .sort((left, right) => left.distance - right.distance)
    .map(({ place }) => place)
    .filter((place) => {
      const cacheKey = buildMapFeaturePlaceEnrichmentKey(place);
      if (seen.has(cacheKey) || hasSettledMapFeaturePlacePhotoLookup(place)) {
        return false;
      }

      seen.add(cacheKey);
      return true;
    })
    .slice(0, MAP_FEATURE_VISIBLE_PHOTO_PREFETCH_LIMIT);
}

function warmVisibleMapFeaturePlacePhotos(): void {
  mapFeatureVisiblePhotoPrefetchTimer = null;
  const instance = map.value;
  if (!instance || !interactiveMapEnabled.value || isMapCameraMoving.value || isMapStyleTransitioning.value) {
    return;
  }

  const pins = getVisibleMapFeaturePlacePhotoPrefetchPins(instance);
  if (!pins.length) {
    return;
  }

  const center = instance.getCenter();
  const signature = [
    Math.round(center.lng * 100),
    Math.round(center.lat * 100),
    Math.round(instance.getZoom() * 2),
    pins.map(buildMapFeaturePlaceEnrichmentKey).join('|'),
  ].join(':');
  if (signature === lastVisibleMapFeaturePhotoPrefetchSignature) {
    return;
  }

  lastVisibleMapFeaturePhotoPrefetchSignature = signature;
  pins.forEach((pin) => {
    void prefetchMapFeaturePlacePhoto(pin);
  });
}

function scheduleVisibleMapFeaturePlacePhotoPrefetch(delayMs = MAP_FEATURE_VISIBLE_PHOTO_PREFETCH_DEBOUNCE_MS): void {
  clearVisibleMapFeaturePlacePhotoPrefetchTimer();
  if (!map.value || !interactiveMapEnabled.value) {
    return;
  }

  mapFeatureVisiblePhotoPrefetchTimer = setTimeout(warmVisibleMapFeaturePlacePhotos, delayMs);
}

function clearMapFeaturePlaceSelection(): void {
  mapFeaturePlaceClickRequestId += 1;
  mapFeaturePlaceRequestId += 1;
  clearMapFeaturePlacePrefetchTimer();
  lastMapFeaturePlacePrefetchKey = '';
  activeNearbyPlaceMarkerId.value = null;
  mapFeaturePlacePins.value = [];
  clearMapFeaturePlacePopup({ preserveActive: true });
  syncNearbyPlaceMarkers();
}

function warmPendingMapFeaturePlace(): void {
  mapFeaturePlacePrefetchTimer = null;
  const pending = pendingMapFeaturePlacePrefetch;
  pendingMapFeaturePlacePrefetch = null;
  if (!pending || props.routeVariant === 'planner' || props.clickToSelect || !interactiveMapEnabled.value) {
    return;
  }

  const pin = getRenderedMapFeaturePlacePinAtPoint(
    pending.point,
    pending.lngLat,
    MAP_FEATURE_PREFETCH_RADIUS_PX,
  );
  if (!pin) {
    return;
  }

  const cacheKey = buildMapFeaturePlaceEnrichmentKey(pin);
  if (cacheKey === lastMapFeaturePlacePrefetchKey && hasWarmMapFeaturePlaceEnrichment(pin)) {
    return;
  }

  lastMapFeaturePlacePrefetchKey = cacheKey;
  prefetchMapFeaturePlacePin(pin);
}

function handleRenderedMapFeatureHover(event: mapboxgl.MapMouseEvent): void {
  if (
    !interactiveMapEnabled.value ||
    props.routeVariant === 'planner' ||
    props.clickToSelect ||
    isMapCameraMoving.value
  ) {
    clearMapFeaturePlacePrefetchTimer();
    return;
  }

  pendingMapFeaturePlacePrefetch = {
    point: event.point,
    lngLat: event.lngLat,
  };

  if (mapFeaturePlacePrefetchTimer) {
    return;
  }

  if (MAP_FEATURE_PREFETCH_DEBOUNCE_MS <= 0) {
    warmPendingMapFeaturePlace();
    return;
  }

  mapFeaturePlacePrefetchTimer = setTimeout(
    warmPendingMapFeaturePlace,
    MAP_FEATURE_PREFETCH_DEBOUNCE_MS,
  );
}

function mergeNearbyPlacePins(pins: MapNearbyPlacePin[]): MapNearbyPlacePin[] {
  const seenKeys = new Set<string>();
  return pins.filter((pin) => {
    const key = [
      pin.id,
      pin.title.toLowerCase(),
      pin.latitude.toFixed(5),
      pin.longitude.toFixed(5),
    ].join(':');
    if (seenKeys.has(key)) {
      return false;
    }

    seenKeys.add(key);
    return true;
  });
}

function syncNearbyPlaceMarkers(): void {
  const instance = map.value;
  const runtime = mapboxRuntime.value;
  syncMapFeaturePlacePopup();
  if (!instance || !runtime || !interactiveMapEnabled.value || !props.showNearbyPlaces) {
    clearNearbyPlaceMarkers();
    return;
  }

  const routeNearbyPins = props.showNearbyPlaces ? [...props.nearbyPlacePins, ...nearbyViewportPlacePins.value] : [];
  renderNearbyPlaceMarkers(
    mergeNearbyPlacePins(routeNearbyPins),
    instance,
    runtime,
  );
}

function normalizeNearbyPlaceAttributionUrl(value: string | undefined): string | undefined {
  const text = value?.trim();
  if (!text) {
    return undefined;
  }

  try {
    const baseUrl = globalThis.location?.origin || 'https://scope.local';
    const url = new URL(text, baseUrl);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function getNearbyPlaceFallbackPhotoCategory(place: MapNearbyPlacePin): SpotCategory | null {
  if (place.kind === 'fuel') {
    return 'other';
  }

  const kind = getNearbyPlaceKind(place);
  switch (kind) {
    case 'food':
      return 'food';
    case 'park':
      return 'nature';
    case 'shopping':
      return 'shopping';
    case 'entertainment':
      return 'entertainment';
    case 'landmark':
      return 'culture';
    case 'education':
      return 'culture';
    case 'lodging':
      return 'scenic';
    case 'health':
      return 'other';
    default:
      return 'scenic';
  }
}

function getNearbyPlacePopupPhotoUrl(
  place: MapNearbyPlacePin,
  options: NearbyPlacePopupRenderOptions = {},
): { photoUrl: string; isFallback: boolean } | null {
  const explicitPhotoUrl = place.photoUrl?.trim();
  if (explicitPhotoUrl) {
    if (shouldSuppressNearbyPlacePopupPhoto(explicitPhotoUrl)) {
      return null;
    }

    return { photoUrl: explicitPhotoUrl, isFallback: false };
  }

  if (props.routeVariant === 'planner') {
    return null;
  }

  if (options.deferFallbackPhoto && !options.allowInstantFallbackPhoto) {
    return null;
  }

  const sourceLabel = place.sourceLabel?.trim().toLowerCase();
  const isExternalPlace = isMapFeaturePlacePin(place) || sourceLabel === 'mapbox';
  const shouldSuppressFallback = !options.allowInstantFallbackPhoto &&
    (isExternalPlace || place.photoLookupStatus === 'complete' || place.photoLookupStatus === 'pending');
  if (shouldSuppressFallback) {
    return null;
  }

  const fallbackPhotoUrl = getNearbyPlaceInstantFallbackPhotoUrl(place);
  if (!fallbackPhotoUrl) {
    return null;
  }

  return {
    photoUrl: fallbackPhotoUrl,
    isFallback: true,
  };
}

function shouldSuppressNearbyPlacePopupPhoto(photoUrl: string): boolean {
  return props.routeVariant === 'planner' && isSpotPhotoFallbackUrl(photoUrl);
}

function getNearbyPlaceInstantFallbackPhotoUrl(place: MapNearbyPlacePin): string | null {
  const fallbackCategory = getNearbyPlaceFallbackPhotoCategory(place);
  if (!fallbackCategory) {
    return null;
  }

  return getSpotPhotoFallback(fallbackCategory, NEARBY_PLACE_POPUP_FALLBACK_PHOTO_WIDTH);
}

function isMapFeaturePlacePin(place: MapNearbyPlacePin): boolean {
  return place.id.startsWith('map-feature-');
}

function getActiveMapFeaturePlacePin(): MapNearbyPlacePin | null {
  const activeId = activeNearbyPlaceMarkerId.value;
  if (!activeId) {
    return null;
  }

  return mapFeaturePlacePins.value.find((place) => place.id === activeId) ?? null;
}

function shouldDeferNearbyPlaceFallbackPhoto(place: MapNearbyPlacePin): boolean {
  if (place.photoUrl?.trim()) {
    return false;
  }

  const sourceLabel = place.sourceLabel?.trim().toLowerCase();
  return isMapFeaturePlacePin(place) || sourceLabel === 'mapbox' || place.photoLookupStatus === 'pending';
}

function shouldAllowInstantNearbyPlaceFallbackPhoto(place: MapNearbyPlacePin): boolean {
  const sourceLabel = place.sourceLabel?.trim().toLowerCase();
  return !isMapFeaturePlacePin(place) && sourceLabel !== 'mapbox';
}

function shouldReserveNearbyPlaceAddressSlot(place: MapNearbyPlacePin): boolean {
  return isMapFeaturePlacePin(place) && !formatNearbyPlaceAddress(place);
}

function buildNearbyPlacePopupContent(place: MapNearbyPlacePin, options: NearbyPlacePopupRenderOptions = {}): HTMLElement {
  const root = document.createElement('article');
  root.className = 'nearby-place-popup';

  const title = document.createElement('h3');
  title.textContent = place.title || 'Nearby place';

  const popupPhoto = getNearbyPlacePopupPhotoUrl(place, options);
  const hasMediaSlot = Boolean(popupPhoto);
  root.classList.toggle('nearby-place-popup--without-photo', !hasMediaSlot);
  if (popupPhoto) {
    const figure = document.createElement('figure');
    figure.className = 'nearby-place-popup__photo';
    if (popupPhoto.isFallback) {
      figure.dataset.photoSource = 'fallback';
    }

    const image = document.createElement('img');
    image.className = 'nearby-place-popup__image';
    image.src = popupPhoto.photoUrl;
    image.alt = '';
    image.loading = 'eager';
    image.decoding = popupPhoto.isFallback ? 'sync' : 'async';
    image.setAttribute('fetchpriority', 'high');
    image.dataset.test = 'nearby-place-photo';
    figure.append(image);

    const attributionName = popupPhoto.isFallback ? '' : place.photoAttribution?.trim();
    const attributionUrl = popupPhoto.isFallback ? undefined : normalizeNearbyPlaceAttributionUrl(place.photoAttributionUrl);
    if (!popupPhoto.isFallback && (attributionName || attributionUrl)) {
      const attribution = document.createElement('figcaption');
      attribution.className = 'nearby-place-popup__attribution';
      if (attributionUrl) {
        const link = document.createElement('a');
        link.href = attributionUrl;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.textContent = attributionName ? `Photo: ${attributionName}` : 'Photo attribution';
        attribution.append(link);
      } else {
        attribution.textContent = `Photo: ${attributionName}`;
      }
      figure.append(attribution);
    }

    root.append(figure);
  }

  const content = document.createElement('div');
  content.className = 'nearby-place-popup__content';
  content.append(title);

  const distance = formatNearbyPlaceDistance(place);
  if (distance) {
    const distanceLabel = document.createElement('p');
    distanceLabel.className = 'nearby-place-popup__distance';
    distanceLabel.textContent = distance;
    content.append(distanceLabel);
  }

  const addressText = formatNearbyPlaceAddress(place);
  if (addressText) {
    const address = document.createElement('a');
    address.className = 'nearby-place-popup__address nearby-place-popup__address--link';
    address.href = buildGoogleMapsAddressUrl(place, addressText);
    address.target = '_blank';
    address.rel = 'noopener noreferrer';
    address.title = 'Open address in Google Maps';
    address.setAttribute('aria-label', `Open ${addressText} in Google Maps`);
    address.textContent = addressText;
    content.append(address);
  } else if (shouldReserveNearbyPlaceAddressSlot(place)) {
    const address = document.createElement('p');
    address.className = 'nearby-place-popup__address nearby-place-popup__address--pending';
    address.textContent = addressText || '';
    content.append(address);
  }

  const details = document.createElement('div');
  details.className = 'nearby-place-popup__details';

  const category = document.createElement('p');
  category.className = 'nearby-place-popup__category';
  category.textContent = formatNearbyPlaceCategory(place);
  details.append(category);

  const metaItems = [
    place.priceLabel,
  ].filter(Boolean).join(' - ');
  if (metaItems) {
    const meta = document.createElement('p');
    meta.className = 'nearby-place-popup__meta';
    meta.textContent = metaItems;
    details.append(meta);
  }

  const actions = document.createElement('div');
  actions.className = 'nearby-place-popup__actions';

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'nearby-place-popup__add';
  addButton.dataset.nearbyPlaceAdd = 'true';
  addButton.dataset.test = 'nearby-place-add-stop';
  addButton.textContent = 'Add stop';
  actions.append(addButton);

  const footer = document.createElement('div');
  footer.className = 'nearby-place-popup__footer';
  footer.append(details, actions);

  root.append(content, footer);

  return root;
}

function buildNearbyPlaceMarkerElement(place: MapNearbyPlacePin): {
  root: HTMLDivElement;
  button: HTMLButtonElement;
  closeButton: HTMLButtonElement;
  addButton: HTMLButtonElement | null;
} {
  const root = document.createElement('div');
  const categoryLabel = formatNearbyPlaceCategory(place);
  const priceLabel = place.kind === 'fuel' ? place.priceLabel?.trim() : '';
  root.className = 'nearby-place-marker';
  root.dataset.placeKind = getNearbyPlaceKind(place);
  root.dataset.test = 'nearby-place-marker';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'nearby-place-marker__button';
  button.setAttribute('aria-label', `Open ${place.title || categoryLabel}${priceLabel ? `, ${priceLabel}` : ''}`);

  const icon = document.createElement('span');
  icon.className = 'nearby-place-marker__icon';
  icon.append(createNearbyPlaceMarkerIcon(getNearbyPlaceIconName(place)));
  button.append(icon);

  root.append(button);

  if (priceLabel) {
    const price = document.createElement('span');
    price.className = 'nearby-place-marker__price';
    price.textContent = priceLabel;
    root.append(price);
  }

  const titleLabel = place.title?.trim();
  if (titleLabel) {
    const label = document.createElement('span');
    label.className = 'nearby-place-marker__label';
    label.textContent = titleLabel;
    root.append(label);
  }

  const popover = document.createElement('div');
  popover.className = 'nearby-place-marker__popover';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'nearby-place-marker__popover-close';
  closeButton.setAttribute('aria-label', `Close ${place.title || categoryLabel}`);
  closeButton.textContent = String.fromCharCode(215);

  const popupRenderOptions = {
    deferFallbackPhoto: shouldDeferNearbyPlaceFallbackPhoto(place),
    allowInstantFallbackPhoto: shouldAllowInstantNearbyPlaceFallbackPhoto(place),
  };
  popover.append(closeButton, buildNearbyPlacePopupContent(place, popupRenderOptions));
  const addButton = popover.querySelector<HTMLButtonElement>('[data-nearby-place-add="true"]');
  root.append(popover);

  return { root, button, closeButton, addButton };
}

function buildNearbyPlaceMarkerId(place: MapNearbyPlacePin, index: number): string {
  return place.id || `${place.title}:${place.latitude.toFixed(5)}:${place.longitude.toFixed(5)}:${index}`;
}

function buildNearbyPlaceMarkerSignature(place: MapNearbyPlacePin): string {
  return [
    place.title,
    place.latitude.toFixed(6),
    place.longitude.toFixed(6),
    place.kind,
    place.category ?? '',
    place.iconName ?? '',
    place.categoryLabel ?? '',
    place.address ?? '',
    place.subtitle ?? '',
    place.photoUrl ?? '',
    place.photoAttribution ?? '',
    place.photoAttributionUrl ?? '',
    place.photoLookupStatus ?? '',
    place.sourceLabel ?? '',
    place.distanceLabel ?? '',
    place.priceLabel ?? '',
  ].join(':');
}

function resolveMapFeaturePlacePopupAnchor(instance: mapboxgl.Map, place: MapNearbyPlacePin): MapFeaturePlacePopupAnchor {
  const container = mapContainer.value;
  if (!container) {
    return 'bottom';
  }

  let projectedPoint: { x: number; y: number };
  try {
    projectedPoint = instance.project([place.longitude, place.latitude]);
  } catch {
    return 'bottom';
  }

  const popupPhoto = getNearbyPlacePopupPhotoUrl(place, {
    deferFallbackPhoto: shouldDeferNearbyPlaceFallbackPhoto(place),
    allowInstantFallbackPhoto: shouldAllowInstantNearbyPlaceFallbackPhoto(place),
  });
  const estimatedPopupHeight = popupPhoto
    ? MAP_FEATURE_PLACE_POPUP_ESTIMATED_PHOTO_HEIGHT_PX
    : MAP_FEATURE_PLACE_POPUP_ESTIMATED_TEXT_HEIGHT_PX;
  const padding = MAP_FEATURE_PLACE_POPUP_VIEWPORT_PADDING_PX;
  const availableAbove = projectedPoint.y - padding;
  const availableBelow = container.clientHeight - projectedPoint.y - padding;
  const verticalAnchor = availableBelow >= estimatedPopupHeight || availableBelow >= availableAbove
    ? 'top'
    : 'bottom';

  if (projectedPoint.x < MAP_FEATURE_PLACE_POPUP_ESTIMATED_HALF_WIDTH_PX + padding) {
    return `${verticalAnchor}-left` as MapFeaturePlacePopupAnchor;
  }

  if (projectedPoint.x > container.clientWidth - MAP_FEATURE_PLACE_POPUP_ESTIMATED_HALF_WIDTH_PX - padding) {
    return `${verticalAnchor}-right` as MapFeaturePlacePopupAnchor;
  }

  return verticalAnchor;
}

function isSameMapFeaturePlacePin(left: MapNearbyPlacePin, right: MapNearbyPlacePin): boolean {
  if (left.id === right.id) {
    return true;
  }

  return buildMapFeaturePlaceEnrichmentKey(left) === buildMapFeaturePlaceEnrichmentKey(right);
}

function isMapFeaturePlacePopupPreciseEnough(instance: mapboxgl.Map, place: MapNearbyPlacePin): boolean {
  if (!isMapFeaturePlacePin(place)) {
    return true;
  }

  if (instance.getZoom() < MAP_FEATURE_PLACE_POPUP_MIN_ZOOM) {
    return false;
  }

  let projectedPoint: { x: number; y: number };
  try {
    projectedPoint = instance.project([place.longitude, place.latitude]);
  } catch {
    return false;
  }

  const renderedPin = getRenderedMapFeaturePlacePinAtPoint(
    projectedPoint,
    { lng: place.longitude, lat: place.latitude } as mapboxgl.LngLat,
    MAP_FEATURE_PLACE_POPUP_RENDER_RADIUS_PX,
  );

  return Boolean(renderedPin && isSameMapFeaturePlacePin(place, renderedPin));
}

function closeMapFeaturePlacePopupIfImprecise(): boolean {
  const instance = map.value;
  const place = getActiveMapFeaturePlacePin();
  if (!instance || !place || !isMapFeaturePlacePin(place)) {
    return false;
  }

  if (isMapFeaturePlacePopupPreciseEnough(instance, place)) {
    return false;
  }

  clearMapFeaturePlaceSelection();
  return true;
}

function closeMapFeaturePlacePopupIfZoomTooLow(): void {
  const instance = map.value;
  const place = getActiveMapFeaturePlacePin();
  if (!instance || !place || !isMapFeaturePlacePin(place)) {
    return;
  }

  if (instance.getZoom() < MAP_FEATURE_PLACE_POPUP_MIN_ZOOM) {
    clearMapFeaturePlaceSelection();
  }
}

function clearMapFeaturePlacePopup(options: { preserveActive?: boolean } = {}): void {
  if (!mapFeaturePlacePopup) {
    mapFeaturePlacePopupSignature = '';
    mapFeaturePlacePopupPlaceId = '';
    mapFeaturePlacePopupAnchor = '';
    return;
  }

  suppressMapFeaturePlacePopupClose = true;
  mapFeaturePlacePopup.remove();
  suppressMapFeaturePlacePopupClose = false;
  mapFeaturePlacePopup = null;
  mapFeaturePlacePopupSignature = '';
  mapFeaturePlacePopupPlaceId = '';
  mapFeaturePlacePopupAnchor = '';

  if (options.preserveActive !== true && getActiveMapFeaturePlacePin()) {
    activeNearbyPlaceMarkerId.value = null;
  }
}

function bindNearbyPlacePopupAddHandler(popupContent: HTMLElement, place: MapNearbyPlacePin): void {
  const addButton = popupContent.querySelector<HTMLButtonElement>('[data-nearby-place-add="true"]');
  addButton?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    emit('nearby-place-add', place);
    emit('interaction', { type: 'nearby_place_add' });
    clearMapFeaturePlacePopup();
  });
}

function syncMapFeaturePlacePopup(): void {
  const instance = map.value;
  const runtime = mapboxRuntime.value;
  const place = getActiveMapFeaturePlacePin();
  if (!instance || !runtime || !interactiveMapEnabled.value || !place || !hasUsableNearbyPlaceCoordinates(place)) {
    clearMapFeaturePlacePopup({ preserveActive: true });
    return;
  }
  if (!isMapFeaturePlacePopupPreciseEnough(instance, place)) {
    clearMapFeaturePlaceSelection();
    return;
  }

  const anchor = resolveMapFeaturePlacePopupAnchor(instance, place);
  const signature = `${anchor}:${place.id}:${buildNearbyPlaceMarkerSignature(place)}`;
  const lngLat: [number, number] = [place.longitude, place.latitude];
  if (mapFeaturePlacePopup && mapFeaturePlacePopupSignature === signature) {
    mapFeaturePlacePopup.setLngLat(lngLat);
    return;
  }

  const popupContent = buildNearbyPlacePopupContent(place, {
    deferFallbackPhoto: shouldDeferNearbyPlaceFallbackPhoto(place),
    allowInstantFallbackPhoto: shouldAllowInstantNearbyPlaceFallbackPhoto(place),
  });
  bindNearbyPlacePopupAddHandler(popupContent, place);

  if (mapFeaturePlacePopup && mapFeaturePlacePopupPlaceId === place.id && mapFeaturePlacePopupAnchor === anchor) {
    mapFeaturePlacePopup
      .setLngLat(lngLat)
      .setDOMContent(popupContent);
    mapFeaturePlacePopupSignature = signature;
    return;
  }

  clearMapFeaturePlacePopup({ preserveActive: true });

  const popup = new runtime.Popup({
    anchor,
    className: 'map-feature-place-popup',
    closeButton: true,
    closeOnClick: false,
    focusAfterOpen: false,
    maxWidth: '18rem',
    offset: MAP_FEATURE_PLACE_POPUP_OFFSET_PX,
  })
    .setLngLat(lngLat)
    .setDOMContent(popupContent)
    .addTo(instance);

  popup.on('close', () => {
    if (suppressMapFeaturePlacePopupClose) {
      return;
    }

    mapFeaturePlacePopup = null;
    mapFeaturePlacePopupSignature = '';
    mapFeaturePlacePopupPlaceId = '';
    mapFeaturePlacePopupAnchor = '';
    if (activeNearbyPlaceMarkerId.value === place.id) {
      activeNearbyPlaceMarkerId.value = null;
      syncActiveNearbyPlaceMarkerLayer();
    }
  });

  mapFeaturePlacePopup = popup;
  mapFeaturePlacePopupSignature = signature;
  mapFeaturePlacePopupPlaceId = place.id;
  mapFeaturePlacePopupAnchor = anchor;
}

function removeNearbyPlaceMarkerController(markerId: string): void {
  const controller = nearbyPlaceMarkerControllers.get(markerId);
  if (!controller) {
    return;
  }

  if (activeNearbyPlaceMarkerId.value === markerId) {
    activeNearbyPlaceMarkerId.value = null;
  }

  controller.marker.remove();
  nearbyPlaceMarkerControllers.delete(markerId);
}

function updateNearbyPlaceMarkerPopoverPlacement(controller: NearbyPlaceMarkerController, isActive: boolean): void {
  if (!isActive) {
    delete controller.element.dataset.popoverPlacement;
    controller.element.style.removeProperty('--nearby-place-popover-shift-x');
    controller.element.style.removeProperty('--nearby-place-popover-max-height');
    return;
  }

  const container = mapContainer.value;
  const popover = controller.element.querySelector<HTMLElement>('.nearby-place-marker__popover');
  if (!container || !popover) {
    delete controller.element.dataset.popoverPlacement;
    controller.element.style.removeProperty('--nearby-place-popover-shift-x');
    controller.element.style.removeProperty('--nearby-place-popover-max-height');
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const markerRect = controller.element.getBoundingClientRect();
  const padding = NEARBY_PLACE_POPOVER_VIEWPORT_PADDING_PX;
  const markerCenterX = markerRect.left + markerRect.width / 2;
  const popoverWidth = popover.offsetWidth || 276;
  const popoverHeight = popover.offsetHeight || 220;
  const minPopoverLeft = containerRect.left + padding;
  const maxPopoverRight = containerRect.right - padding;
  const naturalPopoverLeft = markerCenterX - popoverWidth / 2;
  const naturalPopoverRight = markerCenterX + popoverWidth / 2;
  const horizontalShift = naturalPopoverLeft < minPopoverLeft
    ? minPopoverLeft - naturalPopoverLeft
    : naturalPopoverRight > maxPopoverRight
      ? maxPopoverRight - naturalPopoverRight
      : 0;
  const topSpace = markerRect.top - containerRect.top - padding;
  const bottomSpace = containerRect.bottom - markerRect.bottom - padding;
  const placement = topSpace < popoverHeight + 18 && bottomSpace > topSpace ? 'below' : 'above';
  const availableHeight = Math.max(
    NEARBY_PLACE_POPOVER_MIN_HEIGHT_PX,
    (placement === 'below' ? bottomSpace : topSpace) - padding,
  );

  controller.element.dataset.popoverPlacement = placement;
  controller.element.style.setProperty('--nearby-place-popover-shift-x', `${Math.round(horizontalShift)}px`);
  controller.element.style.setProperty('--nearby-place-popover-max-height', `${Math.round(availableHeight)}px`);
}

function updateActiveNearbyPlaceMarkerPopoverPlacement(): void {
  const activeMarkerId = activeNearbyPlaceMarkerId.value;
  if (!activeMarkerId) {
    return;
  }

  const controller = nearbyPlaceMarkerControllers.get(activeMarkerId);
  if (controller) {
    updateNearbyPlaceMarkerPopoverPlacement(controller, true);
  }
}

function scheduleActiveNearbyPlacePopoverPlacement(): void {
  if (!activeNearbyPlaceMarkerId.value || typeof window === 'undefined') {
    updateActiveNearbyPlaceMarkerPopoverPlacement();
    return;
  }

  if (activePopoverPlacementFrameHandle !== null) {
    return;
  }

  activePopoverPlacementFrameHandle = window.requestAnimationFrame(() => {
    activePopoverPlacementFrameHandle = null;
    updateActiveNearbyPlaceMarkerPopoverPlacement();
  });
}

function syncActiveNearbyPlaceMarkerLayer(): void {
  let activeMarkerStillExists = Boolean(getActiveMapFeaturePlacePin());

  nearbyPlaceMarkerControllers.forEach((controller, markerId) => {
    const isActive = markerId === activeNearbyPlaceMarkerId.value;
    controller.element.classList.toggle('is-active', isActive);
    controller.element.dataset.active = isActive ? 'true' : 'false';
    controller.element.style.zIndex = isActive ? '300' : '160';
    updateNearbyPlaceMarkerPopoverPlacement(controller, isActive);
    if (isActive) {
      activeMarkerStillExists = true;
    }
  });

  if (activeNearbyPlaceMarkerId.value && !activeMarkerStillExists) {
    activeNearbyPlaceMarkerId.value = null;
  }

  syncMapFeaturePlacePopup();
}

function activateNearbyPlaceMarker(markerId: string): void {
  activeNearbyPlaceMarkerId.value = markerId;
  syncActiveNearbyPlaceMarkerLayer();
}

function createNearbyPlaceMarkerController(
  markerId: string,
  place: MapNearbyPlacePin,
  instance: mapboxgl.Map,
  runtime: typeof mapboxgl,
): NearbyPlaceMarkerController {
  const { root: markerElement, button, closeButton, addButton } = buildNearbyPlaceMarkerElement(place);

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    activateNearbyPlaceMarker(markerId);
  });

  closeButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (activeNearbyPlaceMarkerId.value === markerId) {
      activeNearbyPlaceMarkerId.value = null;
      syncActiveNearbyPlaceMarkerLayer();
    }
  });

  addButton?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    activateNearbyPlaceMarker(markerId);
    emit('nearby-place-add', place);
    emit('interaction', { type: 'nearby_place_add' });
    if (activeNearbyPlaceMarkerId.value === markerId) {
      activeNearbyPlaceMarkerId.value = null;
      syncActiveNearbyPlaceMarkerLayer();
    }
  });

  const marker = new runtime.Marker({
    element: markerElement,
    anchor: 'center',
    offset: NEARBY_PLACE_MARKER_OFFSET,
  })
    .setLngLat([place.longitude, place.latitude])
    .addTo(instance);

  return {
    id: markerId,
    signature: buildNearbyPlaceMarkerSignature(place),
    element: markerElement,
    button,
    marker,
  };
}

function renderNearbyPlaceMarkers(places: MapNearbyPlacePin[], instance: mapboxgl.Map, runtime: typeof mapboxgl): void {
  const nextMarkerIds = new Set<string>();

  places.forEach((place, index) => {
    if (!hasUsableNearbyPlaceCoordinates(place)) {
      return;
    }

    const markerId = buildNearbyPlaceMarkerId(place, index);
    const signature = buildNearbyPlaceMarkerSignature(place);
    nextMarkerIds.add(markerId);

    const existingController = nearbyPlaceMarkerControllers.get(markerId);
    if (existingController && existingController.signature === signature) {
      existingController.marker.setLngLat([place.longitude, place.latitude]);
      return;
    }

    if (existingController) {
      removeNearbyPlaceMarkerController(markerId);
    }

    nearbyPlaceMarkerControllers.set(markerId, createNearbyPlaceMarkerController(markerId, place, instance, runtime));
  });

  Array.from(nearbyPlaceMarkerControllers.keys())
    .filter((markerId) => !nextMarkerIds.has(markerId))
    .forEach(removeNearbyPlaceMarkerController);

  syncActiveNearbyPlaceMarkerLayer();
}

function hasUsableNearbyPlaceCoordinates(place: MapNearbyPlacePin): boolean {
  return isFiniteNumber(place.latitude)
    && isFiniteNumber(place.longitude)
    && place.latitude >= -90
    && place.latitude <= 90
    && place.longitude >= -180
    && place.longitude <= 180;
}

async function loadNearbyPlacesForViewport(): Promise<void> {
  const instance = map.value;
  const runtime = mapboxRuntime.value;
  if (!instance || !runtime || !canAutoSearchNearbyPlaces(instance)) {
    nearbyPlacesViewportSignature = '';
    nearbyPlacesRequestId.value += 1;
    nearbyViewportPlacePins.value = [];
    syncNearbyPlaceMarkers();
    return;
  }

  if (!shouldLoadNearbyPlaces(instance)) {
    syncNearbyPlaceMarkers();
    return;
  }

  const bounds = getNearbyPlaceSearchBounds(instance);
  const center = instance.getCenter();
  const viewportSignature = buildNearbyPlacesViewportSignature(instance);
  if (!bounds || !viewportSignature || viewportSignature === nearbyPlacesViewportSignature) {
    return;
  }

  nearbyPlacesViewportSignature = viewportSignature;
  const requestId = nearbyPlacesRequestId.value + 1;
  nearbyPlacesRequestId.value = requestId;

  try {
    const response = await searchNearbyPlaces({
      center: {
        latitude: center.lat,
        longitude: center.lng,
      },
      bounds,
      limit: getNearbyPlacesLimitForZoom(instance.getZoom()),
    });

    if (requestId !== nearbyPlacesRequestId.value || viewportSignature !== nearbyPlacesViewportSignature) {
      return;
    }

    nearbyViewportPlacePins.value = response.data.map(mapNearbySearchResultToPin);
    syncNearbyPlaceMarkers();
  } catch {
    if (requestId !== nearbyPlacesRequestId.value) {
      return;
    }

    nearbyViewportPlacePins.value = [];
    syncNearbyPlaceMarkers();
  }
}

function scheduleNearbyPlacesRefresh(): void {
  const instance = map.value;
  clearNearbyPlacesRefreshTimer();

  if (!instance || !canAutoSearchNearbyPlaces(instance)) {
    nearbyPlacesViewportSignature = '';
    nearbyPlacesRequestId.value += 1;
    nearbyViewportPlacePins.value = [];
    syncNearbyPlaceMarkers();
    return;
  }

  if (!shouldLoadNearbyPlaces(instance)) {
    syncNearbyPlaceMarkers();
    return;
  }

  nearbyPlacesRefreshTimer = setTimeout(() => {
    nearbyPlacesRefreshTimer = null;
    void loadNearbyPlacesForViewport();
  }, NEARBY_PLACES_REFRESH_DEBOUNCE_MS);
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
  if (props.showProjectionToggle && activeMapProjectionMode.value === 'mercator' && props.flatProjectionViewport) {
    return cloneMapViewport(props.flatProjectionViewport);
  }

  return props.initialViewport
    ? cloneMapViewport(props.initialViewport)
    : cloneMapViewport(DEFAULT_MAP_VIEWPORT);
}

function getDefaultMapProjectionMode(): MapProjectionName {
  return props.routeVariant === 'planner' ? 'globe' : 'mercator';
}

function isMapProjectionMode(value: string | null | undefined): value is MapProjectionName {
  return value === 'globe' || value === 'mercator';
}

function readMapProjectionModePreference(): MapProjectionName | null {
  if (!props.persistMapPreferences || typeof window === 'undefined') {
    return null;
  }

  try {
    const storedMode = window.localStorage.getItem(MAP_PROJECTION_MODE_STORAGE_KEY);
    return isMapProjectionMode(storedMode) ? storedMode : null;
  } catch {
    return null;
  }
}

function writeMapProjectionModePreference(mode: MapProjectionName): void {
  if (!props.persistMapPreferences || typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(MAP_PROJECTION_MODE_STORAGE_KEY, mode);
  } catch {
    // Storage can be unavailable in private contexts; the in-session mode still works.
  }
}

function resolveInitialMapProjectionMode(): MapProjectionName {
  return props.showProjectionToggle
    ? (readMapProjectionModePreference() ?? getDefaultMapProjectionMode())
    : getDefaultMapProjectionMode();
}

function isMapPresentationMode(value: string | null | undefined): value is MapPresentationMode {
  return value === 'scope' || value === 'native';
}

function readMapStyleModePreference(): MapPresentationMode | null {
  if (!props.persistMapPreferences || typeof window === 'undefined') {
    return null;
  }

  try {
    const storedMode = window.localStorage.getItem(MAP_STYLE_MODE_STORAGE_KEY);
    return isMapPresentationMode(storedMode) ? storedMode : null;
  } catch {
    return null;
  }
}

function writeMapStyleModePreference(mode: MapPresentationMode): void {
  if (!props.persistMapPreferences || typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(MAP_STYLE_MODE_STORAGE_KEY, mode);
  } catch {
    // Storage can be unavailable in private contexts; the in-session mode still works.
  }
}

function getMapStyleForPresentation(_mode: MapPresentationMode): string {
  return LIGHT_MAP_STYLE;
}

function shouldUseStateAbbreviationLabels(labelMode: MapLabelMode): boolean {
  return labelMode === 'states';
}

function shouldHideNativeStateNameLabels(labelMode: MapLabelMode): boolean {
  return labelMode === 'majorCities';
}

function getWaterLabelMinZoom(labelMode: MapLabelMode): number {
  return labelMode === 'states' ? MAP_STATES_MODE_WATER_LABEL_MIN_ZOOM : MAP_WATER_LABEL_MIN_ZOOM;
}

function getWaterLabelOpacity(labelMode: MapLabelMode): unknown {
  return labelMode === 'states' ? MAP_STATES_MODE_WATER_LABEL_OPACITY : MAP_WATER_LABEL_OPACITY;
}

function getWaterReferenceLabelMinZoom(labelMode: MapLabelMode): number {
  return getWaterLabelMinZoom(labelMode);
}

function getWaterReferenceLabelOpacity(labelMode: MapLabelMode): unknown {
  return labelMode === 'states' ? MAP_STATES_MODE_WATER_REFERENCE_TEXT_OPACITY : MAP_WATER_REFERENCE_TEXT_OPACITY;
}

function getDocumentTheme(): DocumentThemeMode {
  if (typeof document === 'undefined') {
    return 'dark';
  }

  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function clearMapStyleTransitionTimer(): void {
  if (mapStyleTransitionTimer) {
    clearTimeout(mapStyleTransitionTimer);
    mapStyleTransitionTimer = null;
  }
}

function clearMapStyleTransitionSnapshot(): void {
  if (mapStyleTransitionSnapshotTimer) {
    clearTimeout(mapStyleTransitionSnapshotTimer);
    mapStyleTransitionSnapshotTimer = null;
  }

  if (mapStyleTransitionSnapshotTintFrame !== null) {
    cancelAnimationFrame(mapStyleTransitionSnapshotTintFrame);
    mapStyleTransitionSnapshotTintFrame = null;
  }

  mapTransitionSnapshotHolds.clear();
  isMapStyleTransitionSnapshotVisible.value = false;
  isMapStyleTransitionSnapshotTinted.value = false;
  mapStyleTransitionSnapshotUrl.value = '';
}

function canCaptureMapCanvasSnapshot(): boolean {
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
    return false;
  }

  return true;
}

function captureMapStyleTransitionSnapshot(): void {
  const instance = map.value;
  if (!instance || !interactiveMapEnabled.value) {
    clearMapStyleTransitionSnapshot();
    return;
  }

  try {
    const canvas = instance.getCanvas();
    if (!canvas.width || !canvas.height || !canCaptureMapCanvasSnapshot()) {
      clearMapStyleTransitionSnapshot();
      return;
    }

    const nextSnapshotUrl = canvas.toDataURL('image/jpeg', 0.84);
    if (!nextSnapshotUrl || nextSnapshotUrl.length < 128) {
      clearMapStyleTransitionSnapshot();
      return;
    }

    if (mapStyleTransitionSnapshotTimer) {
      clearTimeout(mapStyleTransitionSnapshotTimer);
      mapStyleTransitionSnapshotTimer = null;
    }

    if (mapStyleTransitionSnapshotTintFrame !== null) {
      cancelAnimationFrame(mapStyleTransitionSnapshotTintFrame);
      mapStyleTransitionSnapshotTintFrame = null;
    }

    mapStyleTransitionSnapshotUrl.value = nextSnapshotUrl;
    isMapStyleTransitionSnapshotVisible.value = true;
    isMapStyleTransitionSnapshotTinted.value = false;
    if (mapStyleTransitionVariant.value === 'switch' && typeof requestAnimationFrame === 'function') {
      mapStyleTransitionSnapshotTintFrame = requestAnimationFrame(() => {
        mapStyleTransitionSnapshotTintFrame = null;
        if (isMapStyleTransitionSnapshotVisible.value && mapStyleTransitionSnapshotUrl.value === nextSnapshotUrl) {
          isMapStyleTransitionSnapshotTinted.value = true;
        }
      });
    } else {
      isMapStyleTransitionSnapshotTinted.value = mapStyleTransitionVariant.value === 'switch';
    }
  } catch {
    clearMapStyleTransitionSnapshot();
  }
}

function releaseMapStyleTransitionSnapshot(): void {
  if (mapTransitionSnapshotHolds.size > 0) {
    return;
  }

  if (!mapStyleTransitionSnapshotUrl.value) {
    return;
  }

  isMapStyleTransitionSnapshotVisible.value = false;
  if (mapStyleTransitionSnapshotTimer) {
    clearTimeout(mapStyleTransitionSnapshotTimer);
  }

  mapStyleTransitionSnapshotTimer = setTimeout(() => {
    mapStyleTransitionSnapshotTimer = null;
    if (!isMapStyleTransitionSnapshotVisible.value) {
      isMapStyleTransitionSnapshotTinted.value = false;
      mapStyleTransitionSnapshotUrl.value = '';
    }
  }, MAP_STYLE_SNAPSHOT_FADE_MS);
}

function holdMapTransitionSnapshot(reason: 'style' | 'camera'): void {
  mapTransitionSnapshotHolds.add(reason);
  captureMapStyleTransitionSnapshot();
}

function releaseMapTransitionSnapshotHold(reason: 'style' | 'camera'): void {
  mapTransitionSnapshotHolds.delete(reason);
  releaseMapStyleTransitionSnapshot();
}

function getMapStyleTransitionNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function waitForNextAnimationFrame(): Promise<void> {
  if (typeof requestAnimationFrame !== 'function') {
    return new Promise((resolve) => window.setTimeout(resolve, 0));
  }

  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function getMapStyleTransitionTimeoutMs(variant: MapStyleTransitionVariant): number {
  return variant === 'switch' ? MAP_STYLE_SWITCH_TRANSITION_TIMEOUT_MS : MAP_STYLE_TRANSITION_TIMEOUT_MS;
}

function getMapStyleTransitionMinimumVisibleMs(variant: MapStyleTransitionVariant): number {
  return variant === 'switch' ? MAP_STYLE_SWITCH_TRANSITION_MIN_VISIBLE_MS : MAP_STYLE_TRANSITION_MIN_VISIBLE_MS;
}

function startMapStyleTransition(
  options: {
    coverMode?: MapPresentationMode;
    variant?: MapStyleTransitionVariant;
  } = {},
): void {
  if (!interactiveMapEnabled.value) {
    return;
  }

  const variant = options.variant ?? 'load';
  const timeoutMs = getMapStyleTransitionTimeoutMs(variant);
  const minimumVisibleMs = getMapStyleTransitionMinimumVisibleMs(variant);
  mapStyleTransitionCoverMode.value = options.coverMode ?? effectiveMapPresentation.value;
  mapStyleTransitionVariant.value = variant;
  releaseMapTransitionSnapshotHold('style');
  if (variant !== 'switch') {
    openMapRenderGate(
      timeoutMs + MAP_RENDER_GATE_REVEAL_DELAY_MS,
      minimumVisibleMs,
    );
  } else {
    closeMapRenderGate();
  }
  mapStyleTransitionStartedAt = getMapStyleTransitionNow();
  isMapStyleTransitioning.value = true;
  if (variant !== 'switch') {
    startMapTileSettling(timeoutMs);
  } else {
    clearMapTileSettlingTimer();
    isMapTileSettling.value = false;
  }
  clearMapStyleTransitionTimer();
  mapStyleTransitionTimer = setTimeout(() => {
    mapStyleTransitionTimer = null;
    isMapStyleTransitioning.value = false;
    releaseMapTransitionSnapshotHold('style');
    if (variant !== 'switch') {
      finishMapTileSettling();
    }
  }, timeoutMs);
}

function finishMapStyleTransition(version?: number): void {
  if (typeof version === 'number' && version !== mapStyleSwapVersion) {
    return;
  }

  const minimumVisibleMs = getMapStyleTransitionMinimumVisibleMs(mapStyleTransitionVariant.value);
  const remainingVisibleTime = Math.max(
    0,
    minimumVisibleMs - (getMapStyleTransitionNow() - mapStyleTransitionStartedAt),
  );
  if (remainingVisibleTime > 0) {
    clearMapStyleTransitionTimer();
    mapStyleTransitionTimer = setTimeout(() => {
      if (typeof version === 'number' && version !== mapStyleSwapVersion) {
        return;
      }

      mapStyleTransitionTimer = null;
      isMapStyleTransitioning.value = false;
      releaseMapTransitionSnapshotHold('style');
      if (mapStyleTransitionVariant.value !== 'switch') {
        revealMapRenderGate();
        finishMapTileSettling();
      }
    }, remainingVisibleTime);
    return;
  }

  clearMapStyleTransitionTimer();
  isMapStyleTransitioning.value = false;
  releaseMapTransitionSnapshotHold('style');
  if (mapStyleTransitionVariant.value !== 'switch') {
    revealMapRenderGate();
    finishMapTileSettling();
  }
}

function finishMapStyleTransitionAfterPresentationFrame(instance: mapboxgl.Map, version: number): void {
  const finish = () => {
    if (version !== mapStyleSwapVersion) {
      return;
    }

    try {
      instance.triggerRepaint?.();
    } catch {
      // The style switch is presentation-only; a missed repaint will be picked up by the next frame.
    }

    finishMapStyleTransition(version);
  };

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(finish);
    return;
  }

  window.setTimeout(finish, 0);
}

function finishMapStyleTransitionAfterStyleSettle(instance: mapboxgl.Map, version: number): void {
  let hasFinished = false;
  let settleFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  const finish = () => {
    if (hasFinished || version !== mapStyleSwapVersion) {
      return;
    }

    hasFinished = true;
    if (settleFallbackTimer) {
      clearTimeout(settleFallbackTimer);
      settleFallbackTimer = null;
    }

    void settleMapStylePresentationTransition(instance, version);
  };

  try {
    instance.once('idle', finish);
    instance.triggerRepaint?.();
  } catch {
    finish();
    return;
  }

  settleFallbackTimer = setTimeout(finish, MAP_STYLE_SWITCH_SETTLE_TIMEOUT_MS);
}

async function settleMapStylePresentationTransition(instance: mapboxgl.Map, version: number): Promise<void> {
  if (version !== mapStyleSwapVersion) {
    return;
  }

  applyMapStylePresentation();
  refreshMapStylePresentationSurfaces();

  for (let frameIndex = 0; frameIndex < MAP_STYLE_PRESENTATION_SETTLE_FRAMES; frameIndex += 1) {
    await waitForNextAnimationFrame();
    if (version !== mapStyleSwapVersion) {
      return;
    }

    applyMapStylePresentation();
    instance.triggerRepaint?.();
  }

  finishMapStyleTransition(version);
}

function finishMapStyleTransitionWhenPresentationReady(
  instance: mapboxgl.Map,
  version: number,
  attempt = 0,
): void {
  if (version !== mapStyleSwapVersion) {
    return;
  }

  const hasLoadedStyle = (() => {
    try {
      return instance.isStyleLoaded() && Boolean(instance.getStyle().layers?.length);
    } catch {
      return false;
    }
  })();

  const isStyleSwitch = mapStyleTransitionVariant.value === 'switch';
  const isPlannerLoadTransition = props.routeVariant === 'planner' && mapStyleTransitionVariant.value === 'load';
  if (hasLoadedStyle && (isStyleSwitch || isPlannerLoadTransition || isMapRenderVisuallyReady(instance))) {
    void settleMapStylePresentationTransition(instance, version);
    return;
  }

  let hasScheduledNextCheck = false;
  const scheduleNextCheck = () => {
    if (hasScheduledNextCheck || version !== mapStyleSwapVersion) {
      return;
    }

    hasScheduledNextCheck = true;
    const finishAfterFrame = () => {
      if (version !== mapStyleSwapVersion) {
        return;
      }

      scheduleMapStylePresentationRefresh();
      if (!isStyleSwitch && !isPlannerLoadTransition && !isMapRenderVisuallyReady(instance) && attempt < MAP_RENDER_READY_MAX_RETRIES) {
        window.setTimeout(() => {
          finishMapStyleTransitionWhenPresentationReady(instance, version, attempt + 1);
        }, MAP_RENDER_READY_RETRY_MS);
        return;
      }

      void settleMapStylePresentationTransition(instance, version);
    };

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(finishAfterFrame);
      return;
    }

    window.setTimeout(finishAfterFrame, 0);
  };

  try {
    instance.once('idle', scheduleNextCheck);
  } catch {
    scheduleNextCheck();
    return;
  }

  window.setTimeout(scheduleNextCheck, MAP_RENDER_READY_RETRY_MS);
}

function clearMapStylePresentationRefreshes(): void {
  if (mapStylePresentationFrameHandle !== null) {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(mapStylePresentationFrameHandle);
    }
    mapStylePresentationFrameHandle = null;
  }

  mapStylePresentationRefreshTimers.forEach((timer) => clearTimeout(timer));
  mapStylePresentationRefreshTimers = [];
}

function scheduleMapStylePresentationRefresh(): void {
  if (mapStylePresentationFrameHandle !== null) {
    return;
  }

  if (typeof requestAnimationFrame !== 'function') {
    applyMapStylePresentation();
    return;
  }

  mapStylePresentationFrameHandle = requestAnimationFrame(() => {
    mapStylePresentationFrameHandle = null;
    applyMapStylePresentation();
  });
}

function scheduleMapStylePresentationRefreshSeries(): void {
  mapStylePresentationRefreshTimers.forEach((timer) => clearTimeout(timer));
  mapStylePresentationRefreshTimers = [];
  scheduleMapStylePresentationRefresh();
  mapStylePresentationRefreshTimers = MAP_STYLE_PRESENTATION_REFRESH_DELAYS_MS.map((delay) =>
    setTimeout(scheduleMapStylePresentationRefresh, delay),
  );
}

function refreshMapStylePresentationSurfaces(): void {
  scheduleMapStylePresentationRefresh();
  scheduleMapPostStyleResizeSeries();
  scheduleMapRenderHealthCheckSeries();
  scheduleMarkerRender();
  syncNearbyPlaceMarkers();
  scheduleNearbyPlacesRefresh();
  scheduleLiveRouteOverlayUpdate();
}

function resolveRequestedMapStyle(fallback = mapStore.viewport.style): string {
  if (props.showMapStyleToggle) {
    return getMapStyleForPresentation(effectiveMapPresentation.value);
  }

  const requestedStyle = props.initialViewport?.style ?? fallback;
  return effectiveMapPresentation.value === 'native' ? getMapStyleForPresentation('native') : resolveMapboxStyle(requestedStyle);
}

function applyRequestedMapStyle(
  style = props.initialViewport?.style ?? mapStore.viewport.style,
  options: {
    forcePresentationTransition?: boolean;
    transitionCoverMode?: MapPresentationMode;
    transitionVariant?: MapStyleTransitionVariant;
  } = {},
): void {
  const targetStyle = props.showMapStyleToggle
    ? getMapStyleForPresentation(effectiveMapPresentation.value)
    : (effectiveMapPresentation.value === 'native' ? getMapStyleForPresentation('native') : resolveMapboxStyle(style));
  const isPresentationOnlySwap = options.forcePresentationTransition === true;
  const transitionCoverMode = options.transitionCoverMode ?? effectiveMapPresentation.value;
  const transitionVariant = options.transitionVariant ?? (isPresentationOnlySwap ? 'switch' : 'load');
  mapStore.setStyle(targetStyle);

  if (mapStyle.value === targetStyle) {
    const shouldSettlePresentation = isPresentationOnlySwap || isMapStyleTransitioning.value;
    const styleSwapVersion = shouldSettlePresentation ? ++mapStyleSwapVersion : mapStyleSwapVersion;
    const isFastPresentationSwitch = isPresentationOnlySwap && transitionVariant === 'switch';
    if (shouldSettlePresentation) {
      startMapStyleTransition({ coverMode: transitionCoverMode, variant: transitionVariant });
    } else {
      clearMapStyleTransitionTimer();
    }

    applyMapStylePresentation();
    if (isFastPresentationSwitch) {
      scheduleMapStylePresentationRefresh();
      scheduleMarkerRender();
    } else {
      scheduleMapStylePresentationRefreshSeries();
      refreshMapStylePresentationSurfaces();
    }
    if (shouldSettlePresentation) {
      const instance = map.value;
      if (instance && interactiveMapEnabled.value) {
        if (isFastPresentationSwitch) {
          finishMapStyleTransitionAfterPresentationFrame(instance, styleSwapVersion);
        } else {
          finishMapStyleTransitionAfterStyleSettle(instance, styleSwapVersion);
        }
      } else {
        finishMapStyleTransition(styleSwapVersion);
      }
    }
    return;
  }

  const instance = map.value;
  mapStyle.value = targetStyle;
  scopeMapPaintOverrides.clear();
  activeScopedMapPresentation = null;
  if (instance && interactiveMapEnabled.value && instance.getStyle().sprite !== undefined) {
    const styleSwapVersion = ++mapStyleSwapVersion;
    startMapStyleTransition({ coverMode: transitionCoverMode, variant: transitionVariant });
    instance.once('style.load', () => {
      if (styleSwapVersion !== mapStyleSwapVersion) {
        return;
      }

      scheduleMapPostStyleResizeSeries();
      scheduleMapStylePresentationRefreshSeries();
      refreshMapStylePresentationSurfaces();
      finishMapStyleTransitionWhenPresentationReady(instance, styleSwapVersion);
    });
    instance.once('idle', () => {
      if (styleSwapVersion !== mapStyleSwapVersion) {
        return;
      }

      scheduleMapPostStyleResizeSeries();
      scheduleMapStylePresentationRefreshSeries();
      finishMapStyleTransitionWhenPresentationReady(instance, styleSwapVersion);
    });

    try {
      instance.setStyle(targetStyle, {
        diff: true,
        localFontFamily: undefined,
        localIdeographFontFamily: undefined,
      });
    } catch {
      finishMapStyleTransition(styleSwapVersion);
      return;
    }
  }
}

async function handleMapStyleModeSelect(mode: MapPresentationMode): Promise<void> {
  if (activeMapStyleMode.value === mode) {
    return;
  }

  const selectionVersion = ++mapStyleModeSelectionVersion;
  activeMapStyleMode.value = mode;
  if (selectionVersion !== mapStyleModeSelectionVersion) {
    return;
  }

  writeMapStyleModePreference(mode);
  applyRequestedMapStyle(getMapStyleForPresentation(mode), {
    forcePresentationTransition: true,
    transitionCoverMode: mode,
    transitionVariant: 'switch',
  });
  scheduleMapPostStyleResizeSeries();
  emit('interaction', { type: `map_style_${mode}` });
}

function applyFlatProjectionViewport(): void {
  if (!props.flatProjectionViewport) {
    return;
  }

  const targetViewport = cloneMapViewport(props.flatProjectionViewport);
  const instance = map.value;
  const targetCamera = {
    center: targetViewport.center,
    zoom: targetViewport.zoom,
    bearing: 0,
    pitch: 0,
  };

  clearPendingControlZoom();
  syncingViewport = true;
  mapStore.setCenter(targetViewport.center);
  mapStore.setZoom(targetViewport.zoom);
  releaseSyncingViewportAfterFlush();

  if (!instance || !interactiveMapEnabled.value) {
    return;
  }

  suppressViewportCameraSyncFor(MAP_CONTROL_ZOOM_DURATION_MS + MAP_CONTROL_ZOOM_VIEWPORT_SYNC_BUFFER_MS);
  clearLocationCameraAnimation();
  instance.stop();
  startMapCameraRenderTransition({
    timeoutMs: MAP_PRIORITY_CAMERA_GATE_TIMEOUT_MS,
    minimumVisibleMs: MAP_PRIORITY_CAMERA_GATE_MIN_VISIBLE_MS,
    captureSnapshot: false,
    renderGate: false,
    tileSettling: true,
  });
  instance.easeTo({
    ...targetCamera,
    duration: MAP_CONTROL_ZOOM_DURATION_MS,
    easing: easeOutMapControlZoom,
    essential: true,
  });
}

function handleMapProjectionModeSelect(mode: MapProjectionName): void {
  if (activeMapProjectionMode.value === mode) {
    return;
  }

  activeMapProjectionMode.value = mode;
  writeMapProjectionModePreference(mode);
  if (map.value) {
    applyStableMapProjection(map.value);
  }
  if (mode === 'mercator') {
    applyFlatProjectionViewport();
  }
  scheduleMapPostStyleResizeSeries();
  refreshMapStylePresentationSurfaces();
  emit('interaction', { type: mode === 'globe' ? 'map_projection_3d' : 'map_projection_2d' });
}

function buildViewportSignature(viewport: MapViewport | undefined): string {
  if (!viewport) {
    return '';
  }

  return `${viewport.center[0].toFixed(5)},${viewport.center[1].toFixed(5)}:${viewport.zoom.toFixed(2)}:${viewport.style}`;
}

function applyBaseViewport(options: { animate?: boolean } = {}): void {
  const targetViewport = resolveBaseViewport();
  applyRequestedMapStyle(targetViewport.style);

  if (hasMappablePoints()) {
    return;
  }

  mapStore.setCenter(targetViewport.center);
  mapStore.setZoom(targetViewport.zoom);

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
    return markerSpots.value.filter((spot) => bounds.contains([spot.longitude, spot.latitude]));
  }

  return getMapPointsInsideViewport(
    markerSpots.value.filter(hasValidCoordinates),
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
  candidates = markerSpots.value,
): string[] {
  const explicitPointIds = [...new Set(entry.pointIds.filter((pointId) => markerSpotLookup.value.has(pointId)))];
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
  candidates = markerSpots.value,
): MapPoint | null {
  const explicitPointId = entry.pointIds.find((pointId) => markerSpotLookup.value.has(pointId));
  if (explicitPointId) {
    return markerSpotLookup.value.get(explicitPointId) ?? null;
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
  if (props.markerVariant === 'sequence' || routeOrderLookup.value.size > 0) {
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
    setVisibleSpotIds(markerSpots.value.map((spot) => spot.id));
  }
}

function buildMarkerRenderContext(): MarkerRenderContext {
  return {
    markerVariant: props.markerVariant,
    routeOrderLookup: routeOrderLookup.value,
    selectedSpotId: selectedSpotId.value,
  };
}

function getSpotMarkerVariant(markerId: string): 'default' | 'sequence' {
  if (props.clickToSelect && props.routePoints.length <= 1) {
    return props.markerVariant;
  }

  if (routeOrderLookup.value.has(markerId)) {
    return 'sequence';
  }

  return props.markerVariant;
}

function renderMarkerContent(markerModel: ViewportMarkerModel, mountTarget: HTMLDivElement) {
  if (markerModel.kind === 'spot') {
    const removableRouteMarker = props.allowRoutePointRemoval && routeOrderLookup.value.has(markerModel.id);

    render(h(SpotMarker, {
      spot: markerModel.spot,
      active: selectedSpotId.value === markerModel.id,
      variant: getSpotMarkerVariant(markerModel.id),
      sequence: routeOrderLookup.value.get(markerModel.id) ?? null,
      distanceLabel: markerModel.distanceLabel,
      removable: removableRouteMarker,
      showLabel: !props.clickToSelect || removableRouteMarker,
      pinOnly: props.plainPinMarker,
      onSelect: () => handleSpotSelect(markerModel.spot),
      onFocus: () => handleSpotFocus(markerModel.spot),
      onRemove: () => handleRoutePointRemove(markerModel.spot),
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
  focusSpotOnMap(spot);
  emit('spot-select', spot);
}

function focusSpotOnMap(spot: MapPoint): void {
  if (!hasValidCoordinates(spot)) {
    return;
  }

  const instance = map.value;
  const targetCenter: [number, number] = [spot.longitude, spot.latitude];
  const currentZoom = instance?.getZoom() ?? mapStore.viewport.zoom;
  const targetZoom = Math.min(Math.max(currentZoom, MAP_SPOT_FOCUS_ZOOM), MAX_MAP_ZOOM);

  shouldCenterOnNextFix.value = false;
  isFollowingUserLocation.value = false;
  pendingLocationCamera = null;
  pendingLocationCameraSignature = null;
  clearPendingLocationCameraFlushTimer();
  clearPendingInitialAutoLocateFocus();
  clearPendingControlZoom();
  clearLocationCameraAnimation();

  syncingViewport = true;
  mapStore.setCenter(targetCenter);
  mapStore.setZoom(targetZoom);
  releaseSyncingViewportAfterFlush();

  if (!instance || !interactiveMapEnabled.value) {
    return;
  }

  suppressViewportCameraSyncFor(780);
  startMapTileSettling();
  instance.stop();
  instance.easeTo({
    center: targetCenter,
    zoom: targetZoom,
    duration: 620,
    easing: easeInOutMapLocationFocus,
    essential: true,
  });
}

function focusSpotById(spotId: string): boolean {
  const spot = spotLookup.value.get(spotId);
  if (!spot) {
    return false;
  }

  focusSpotOnMap(spot);
  return true;
}

function handleSpotFocus(spot: MapPoint) {
  handleSpotSelect(spot);
  emit('interaction', { type: 'spot_focus' });
}

function handleRoutePointRemove(point: MapPoint) {
  emit('route-point-remove', point);
  emit('interaction', { type: 'route_point_remove' });
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

function shouldIgnoreMapFeatureMouseEvent(event: MouseEvent): boolean {
  if (!shouldHandleInteractiveMapFeaturePlaces()) {
    return true;
  }

  const target = event.target;
  if (target instanceof Element && target.closest('.mapboxgl-marker, .nearby-place-marker, .mapboxgl-popup')) {
    return true;
  }

  return false;
}

function resolveMapFeatureMouseEventHit(event: MouseEvent): { point: { x: number; y: number }; lngLat: mapboxgl.LngLat } | null {
  if (shouldIgnoreMapFeatureMouseEvent(event)) {
    return null;
  }

  const instance = map.value;
  const canvas = instance?.getCanvas?.() ?? mapContainer.value?.querySelector<HTMLCanvasElement>('.mapboxgl-canvas');
  if (!instance || !canvas) {
    return null;
  }

  const canvasRect = canvas.getBoundingClientRect();
  const point = {
    x: event.clientX - canvasRect.left,
    y: event.clientY - canvasRect.top,
  };
  if (point.x < 0 || point.y < 0 || point.x > canvasRect.width || point.y > canvasRect.height) {
    return null;
  }

  try {
    return {
      point,
      lngLat: instance.unproject([point.x, point.y]),
    };
  } catch {
    return null;
  }
}

function prefetchInteractiveMapFeaturePlaceFromMouseEvent(event: MouseEvent): void {
  const hit = resolveMapFeatureMouseEventHit(event);
  if (!hit) {
    return;
  }

  const pin = getRenderedMapFeaturePlacePinAtPoint(hit.point, hit.lngLat);
  if (!pin) {
    return;
  }

  prefetchMapFeaturePlacePin(pin);
}

function handleInteractiveMapFeatureClickFromMouseEvent(event: MouseEvent): boolean {
  const hit = resolveMapFeatureMouseEventHit(event);
  if (!hit) {
    return false;
  }

  return handleRenderedMapFeatureClickAtPoint(hit.point, hit.lngLat);
}

function handleMapCanvasClick(event: MouseEvent) {
  if (!interactiveMapEnabled.value) {
    return;
  }

  if (handleInteractiveMapFeatureClickFromMouseEvent(event)) {
    return;
  }

  if (!props.clickToSelect) {
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

function handleMapUserCameraInput(): void {
  if (!interactiveMapEnabled.value) {
    return;
  }

  stopFollowingUserLocationCamera();
}

function attachMapCanvasClickCapture(instance: mapboxgl.Map): void {
  mapCanvasClickCaptureCleanup?.();

  const canvas = instance.getCanvas();
  const handleCanvasPointerDownCapture = (event: MouseEvent) => {
    prefetchInteractiveMapFeaturePlaceFromMouseEvent(event);
  };
  const handleCanvasClickCapture = (event: MouseEvent) => {
    handleInteractiveMapFeatureClickFromMouseEvent(event);
  };
  canvas.addEventListener('pointerdown', handleCanvasPointerDownCapture, { capture: true, passive: true });
  canvas.addEventListener('click', handleCanvasClickCapture, { capture: true });
  mapCanvasClickCaptureCleanup = () => {
    canvas.removeEventListener('pointerdown', handleCanvasPointerDownCapture, { capture: true });
    canvas.removeEventListener('click', handleCanvasClickCapture, { capture: true });
    mapCanvasClickCaptureCleanup = null;
  };
}

function handleClusterSelect(pointIds: string[]) {
  emit('interaction', { type: 'cluster_focus' });
  const pointIdsSet = new Set(pointIds);
  fitToPoints(markerSpots.value.filter((spot) => pointIdsSet.has(spot.id)));
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

  clearPendingControlZoom();
  clearLocationCameraAnimation();
  instance.stop();
  startMapCameraRenderTransition({
    timeoutMs: MAP_RENDER_GATE_TIMEOUT_MS,
  });
  if (points.length === 1) {
    const requestedZoom = Number(props.singleRoutePointZoom);
    instance.easeTo({
      center: [points[0].longitude, points[0].latitude],
      zoom: Number.isFinite(requestedZoom)
        ? clampNumber(requestedZoom, MIN_MAP_ZOOM, MAX_MAP_ZOOM)
        : MAP_SINGLE_ROUTE_POINT_FIT_ZOOM,
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
  fitToPoints(props.routePoints.length > 1 ? props.routePoints : markerSpots.value);
}

function buildFitSignature(kind: 'route' | 'spots', points: MapPoint[]): string {
  return `${kind}:${points.map(buildMapPointRenderKey).join('|')}`;
}

function clearPendingControlZoom(): void {
  pendingControlZoom = null;
  if (pendingControlZoomResetTimer) {
    clearTimeout(pendingControlZoomResetTimer);
    pendingControlZoomResetTimer = null;
  }
}

function schedulePendingControlZoomReset(): void {
  if (pendingControlZoomResetTimer) {
    clearTimeout(pendingControlZoomResetTimer);
  }

  pendingControlZoomResetTimer = setTimeout(() => {
    pendingControlZoom = null;
    pendingControlZoomResetTimer = null;
  }, MAP_CONTROL_ZOOM_RESET_MS);
}

function easeOutMapControlZoom(progress: number): number {
  return 1 - ((1 - progress) ** 3);
}

function easeInOutMapLocationFocus(progress: number): number {
  return progress < 0.5
    ? 2 * progress * progress
    : -1 + (4 - 2 * progress) * progress;
}

function resolveLocationFocusZoom(currentZoom: number, minimumZoom: number, options: CenterOnLocationOptions): number {
  const baseTargetZoom = Math.max(currentZoom, minimumZoom);
  if (options.forceZoomIn !== true) {
    return clampNumber(baseTargetZoom, MIN_MAP_ZOOM, MAX_MAP_ZOOM);
  }

  let maxFocusZoom = Math.min(Math.max(currentZoom, options.maxFocusZoom ?? MAP_LOCATION_FOCUS_MAX_ZOOM), MAX_MAP_ZOOM);
  if (options.useFlight === true && currentZoom < MAP_LOCATION_FAR_FOCUS_SOURCE_ZOOM) {
    maxFocusZoom = Math.min(maxFocusZoom, MAP_LOCATION_FAR_FOCUS_MAX_ZOOM);
  }

  return clampNumber(
    Math.max(baseTargetZoom, MAP_LOCATION_FOCUS_MIN_ZOOM, currentZoom + MAP_LOCATION_FOCUS_ZOOM_STEP),
    MIN_MAP_ZOOM,
    maxFocusZoom,
  );
}

function getWrappedLongitudeDistance(firstLongitude: number, secondLongitude: number): number {
  return Math.abs((((firstLongitude - secondLongitude) + 540) % 360) - 180);
}

function resolveLocationFocusDuration(
  instance: mapboxgl.Map | null,
  targetCenter: [number, number],
  targetZoom: number,
  options: CenterOnLocationOptions,
): number {
  if (typeof options.durationMs === 'number') {
    return options.durationMs;
  }

  if (options.useFlight !== true || !instance) {
    return 780;
  }

  const currentCenter = instance.getCenter();
  const currentZoom = instance.getZoom();
  const longitudeWeight = getWrappedLongitudeDistance(targetCenter[0], currentCenter.lng) / 42;
  const latitudeWeight = Math.abs(targetCenter[1] - currentCenter.lat) / 26;
  const zoomWeight = Math.abs(targetZoom - currentZoom) / 8;
  const travelWeight = clampNumber(Math.max(longitudeWeight, latitudeWeight, zoomWeight), 0, 1);

  return Math.round(
    MAP_LOCATION_FOCUS_MIN_DURATION_MS +
    ((MAP_LOCATION_FOCUS_MAX_DURATION_MS - MAP_LOCATION_FOCUS_MIN_DURATION_MS) * travelWeight),
  );
}

function handleZoom(delta: number) {
  const instance = map.value;
  if (!instance || !interactiveMapEnabled.value) {
    return;
  }

  emit('interaction', { type: delta > 0 ? 'zoom_in' : 'zoom_out' });
  const baseZoom = pendingControlZoom ?? instance.getZoom();
  const targetZoom = Math.min(Math.max(baseZoom + delta, MIN_MAP_ZOOM), MAX_MAP_ZOOM);
  pendingControlZoom = targetZoom;
  schedulePendingControlZoomReset();
  const isPlannerMap = usesPlannerCameraMotion();
  const zoomDuration = isPlannerMap ? MAP_CONTROL_ZOOM_DURATION_MS : 360;
  clearLocationCameraAnimation();
  instance.stop();
  if (isPlannerMap) {
    deferMapDecorativeWorkFor(zoomDuration + MAP_DECORATIVE_CAMERA_SETTLE_BUFFER_MS);
    suppressViewportCameraSyncFor(zoomDuration + MAP_CONTROL_ZOOM_VIEWPORT_SYNC_BUFFER_MS);
    stopMapCameraRenderTransitionVisuals();
    suppressCameraInteractionRenderGateOnce();
  } else {
    startMapCameraRenderTransition({
      timeoutMs: MAP_RENDER_GATE_TIMEOUT_MS,
    });
  }
  instance.easeTo({
    zoom: targetZoom,
    duration: zoomDuration,
    easing: isPlannerMap ? easeInOutMapLocationFocus : easeOutMapControlZoom,
    essential: true,
  });
}

function centerOnLocation(location: UserLocation, minimumZoom = 12, options: CenterOnLocationOptions = {}): boolean {
  const instance = map.value;
  const targetCenter: [number, number] = [location.longitude, location.latitude];
  const currentZoom = instance?.getZoom() ?? mapStore.viewport.zoom;
  const targetZoom = resolveLocationFocusZoom(currentZoom, minimumZoom, options);
  const isUserLocationFlight = options.useFlight === true;
  const shouldSoftenFirstLocationFlight = isUserLocationFlight && !hasCompletedUserLocationFlight && typeof options.durationMs !== 'number';
  let duration = resolveLocationFocusDuration(instance ?? null, targetCenter, targetZoom, options);
  if (shouldSoftenFirstLocationFlight) {
    duration = Math.min(MAP_LOCATION_FIRST_FOCUS_MAX_DURATION_MS, duration + MAP_LOCATION_FIRST_FOCUS_EXTRA_MS);
  }
  const easing = isUserLocationFlight ? easeInOutMapLocationFocus : easeOutMapControlZoom;
  const shouldStageFarLocationFocus =
    isUserLocationFlight &&
    currentZoom < MAP_LOCATION_FAR_FOCUS_SOURCE_ZOOM &&
    targetZoom - currentZoom > MAP_LOCATION_FAR_FOCUS_ZOOM_DELTA;
  const locationFocusMotionMs = shouldStageFarLocationFocus
    ? duration + MAP_LOCATION_FAR_FOCUS_ZOOM_DELAY_MS + MAP_LOCATION_FAR_FOCUS_ZOOM_DURATION_MS
    : duration;
  if (isUserLocationFlight) {
    deferMapDecorativeWorkFor(locationFocusMotionMs + MAP_DECORATIVE_CAMERA_SETTLE_BUFFER_MS);
  }
  if (!instance || !interactiveMapEnabled.value) {
    mapStore.setCenter(targetCenter);
    mapStore.setZoom(targetZoom);
    return true;
  }

  syncUserLocationMarker(location);
  const cameraSignature = buildCameraTargetSignature({ center: targetCenter, zoom: targetZoom });
  if (
    pendingLocationCameraSignature === cameraSignature &&
    (isMapCameraTransitioning.value || isMapCameraMoving.value)
  ) {
    return true;
  }

  if (isMapCameraAtTarget(instance, { center: targetCenter, zoom: targetZoom }, {
    center: MAP_LOCATION_CENTER_TOLERANCE,
    zoom: MAP_LOCATION_ZOOM_TOLERANCE,
  })) {
    clearPendingControlZoom();
    syncingViewport = true;
    mapStore.setCenter(targetCenter);
    mapStore.setZoom(targetZoom);
    releaseSyncingViewportAfterFlush();
    return true;
  }

  if (options.allowDefer !== false && shouldDeferPriorityCamera()) {
    pendingLocationCamera = { location, minimumZoom, options };
    syncingViewport = true;
    mapStore.setCenter(targetCenter);
    mapStore.setZoom(targetZoom);
    releaseSyncingViewportAfterFlush();
    schedulePendingLocationCameraFlush();
    startMapCameraRenderTransition({
      timeoutMs: MAP_PRIORITY_CAMERA_GATE_TIMEOUT_MS,
      minimumVisibleMs: MAP_PRIORITY_CAMERA_GATE_MIN_VISIBLE_MS,
    });
    return true;
  }

  clearPendingControlZoom();
  suppressViewportCameraSyncFor(locationFocusMotionMs + 260);
  syncingViewport = true;
  mapStore.setCenter(targetCenter);
  mapStore.setZoom(targetZoom);
  releaseSyncingViewportAfterFlush();
  clearLocationCameraAnimation();
  instance.stop();
  pendingLocationCameraSignature = cameraSignature;
  pendingResetCameraSignature = null;
  if (isUserLocationFlight) {
    nextPlannerGlobeRestoreDelayMs = Math.max(nextPlannerGlobeRestoreDelayMs, MAP_LOCATION_GLOBE_RESTORE_DELAY_MS);
    stopMapCameraRenderTransitionVisuals();
  } else {
    startMapCameraRenderTransition({
      timeoutMs: MAP_PRIORITY_CAMERA_GATE_TIMEOUT_MS,
      minimumVisibleMs: MAP_PRIORITY_CAMERA_GATE_MIN_VISIBLE_MS,
      renderGate: options.renderGate ?? true,
      tileSettling: options.tileSettling ?? true,
      captureSnapshot: false,
    });
  }
  const cameraOptions = {
    center: targetCenter,
    zoom: targetZoom,
    duration,
    easing,
    essential: true,
  };
  if (isUserLocationFlight) {
    hasCompletedUserLocationFlight = true;
    suppressCameraInteractionRenderGateOnce();
    if (shouldStageFarLocationFocus) {
      instance.easeTo({
        ...cameraOptions,
        zoom: currentZoom,
      });
      locationCameraAnimationTimer = setTimeout(() => {
        locationCameraAnimationTimer = null;
        if (!map.value || map.value !== instance || !interactiveMapEnabled.value) {
          return;
        }

        suppressViewportCameraSyncFor(MAP_LOCATION_FAR_FOCUS_ZOOM_DURATION_MS + 260);
        suppressCameraInteractionRenderGateOnce();
        instance.easeTo({
          center: targetCenter,
          zoom: targetZoom,
          duration: MAP_LOCATION_FAR_FOCUS_ZOOM_DURATION_MS,
          easing: easeOutMapControlZoom,
          essential: true,
        });
      }, duration + MAP_LOCATION_FAR_FOCUS_ZOOM_DELAY_MS);
      return true;
    }

    instance.easeTo(cameraOptions);
    return true;
  }
  instance.easeTo(cameraOptions);
  return true;
}

function clearPendingLocationCameraFlushTimer(): void {
  if (pendingLocationCameraFlushTimer) {
    clearTimeout(pendingLocationCameraFlushTimer);
    pendingLocationCameraFlushTimer = null;
  }
}

function clearPendingInitialAutoLocateFocus(): void {
  pendingInitialAutoLocateFocus = null;
  if (pendingInitialAutoLocateFocusTimer) {
    clearTimeout(pendingInitialAutoLocateFocusTimer);
    pendingInitialAutoLocateFocusTimer = null;
  }
}

function schedulePendingLocationCameraFlush(): void {
  if (pendingLocationCameraFlushTimer) {
    return;
  }

  pendingLocationCameraFlushTimer = setTimeout(() => {
    pendingLocationCameraFlushTimer = null;
    if (!pendingLocationCamera) {
      return;
    }

    if (shouldDeferPriorityCamera()) {
      schedulePendingLocationCameraFlush();
      return;
    }

    flushPendingLocationCamera();
  }, MAP_PENDING_LOCATION_CAMERA_RETRY_MS);
}

function flushPendingLocationCamera(): boolean {
  const queuedCamera = pendingLocationCamera;
  if (!queuedCamera) {
    return false;
  }

  pendingLocationCamera = null;
  clearPendingLocationCameraFlushTimer();
  centerOnLocation(queuedCamera.location, queuedCamera.minimumZoom, {
    ...queuedCamera.options,
    allowDefer: false,
  });
  return true;
}

function isInitialAutoLocateFocusReady(): boolean {
  if (props.routeVariant === 'planner' && !isPlannerMapCanvasRevealed.value) {
    return false;
  }

  return !shouldDeferPriorityCamera();
}

function schedulePendingInitialAutoLocateFocus(): void {
  if (pendingInitialAutoLocateFocusTimer) {
    return;
  }

  pendingInitialAutoLocateFocusTimer = setTimeout(() => {
    pendingInitialAutoLocateFocusTimer = null;
    flushPendingInitialAutoLocateFocus();
  }, MAP_INITIAL_AUTO_LOCATE_RETRY_MS);
}

function flushPendingInitialAutoLocateFocus(): boolean {
  const queuedFocus = pendingInitialAutoLocateFocus;
  if (!queuedFocus) {
    return false;
  }

  const instance = map.value;
  if (
    queuedFocus.requestId !== autoLocateRequestId ||
    !instance ||
    !interactiveMapEnabled.value
  ) {
    clearPendingInitialAutoLocateFocus();
    return false;
  }

  if (!isInitialAutoLocateFocusReady()) {
    schedulePendingInitialAutoLocateFocus();
    return false;
  }

  clearPendingInitialAutoLocateFocus();
  focusUserLocationSmoothly(queuedFocus.location);
  return true;
}

function queueInitialAutoLocateFocus(location: UserLocation, requestId: number): void {
  if (requestId !== autoLocateRequestId) {
    return;
  }

  pendingInitialAutoLocateFocus = { location, requestId };
  if (!flushPendingInitialAutoLocateFocus()) {
    schedulePendingInitialAutoLocateFocus();
  }
}

function ensureLocationTracking(): void {
  if (!props.showLocationTracker) {
    return;
  }

  locationTracker.value?.startTracking();
}

function startUserLocationFollow(): void {
  isFollowingUserLocation.value = true;
  ensureLocationTracking();
}

function focusUserLocationSmoothly(location: UserLocation): boolean {
  startUserLocationFollow();
  syncUserLocationMarker(location);
  return centerOnLocation(location, MAP_LOCATION_FOCUS_TARGET_ZOOM, {
    allowDefer: false,
    forceZoomIn: true,
    maxFocusZoom: MAP_LOCATION_FOCUS_TARGET_ZOOM,
    useFlight: true,
  });
}

async function requestOneShotUserLocation(requestId: number): Promise<void> {
  if (!isGeolocationSupported()) {
    shouldCenterOnNextFix.value = false;
    isFollowingUserLocation.value = false;
    trackingState.value = 'unsupported';
    return;
  }

  trackingState.value = 'locating';

  try {
    const location = await getCurrentLocation();
    if (requestId !== manualLocateRequestId || !map.value || !interactiveMapEnabled.value) {
      return;
    }

    handleLocationUpdate(location);
  } catch (error) {
    if (requestId !== manualLocateRequestId) {
      return;
    }

    const geolocationError = error as { code?: number };
    shouldCenterOnNextFix.value = false;
    isFollowingUserLocation.value = false;
    trackingState.value = geolocationError.code === 1 ? 'denied' : 'error';
  }
}

function prepareInitialAutoLocateFromBaseViewport(instance: mapboxgl.Map): void {
  if (props.routeVariant !== 'planner' || hasMappablePoints()) {
    return;
  }

  const baseViewport = resolveBaseViewport();
  const baseCamera = {
    center: baseViewport.center,
    zoom: baseViewport.zoom,
    bearing: 0,
    pitch: 0,
  };
  if (isMapCameraAtTarget(instance, baseCamera)) {
    return;
  }

  syncingViewport = true;
  mapStore.setCenter(baseViewport.center);
  mapStore.setZoom(baseViewport.zoom);
  releaseSyncingViewportAfterFlush();
  instance.jumpTo(baseCamera);
}

async function requestInitialUserLocation(): Promise<void> {
  const instance = map.value;
  if (
    !props.autoLocateOnLoad ||
    hasRequestedInitialUserLocation ||
    !instance ||
    !interactiveMapEnabled.value ||
    !isGeolocationSupported()
  ) {
    return;
  }

  hasRequestedInitialUserLocation = true;
  const requestId = ++autoLocateRequestId;
  trackingState.value = 'locating';
  prepareInitialAutoLocateFromBaseViewport(instance);

  try {
    const location = await getCurrentLocation();
    if (requestId !== autoLocateRequestId || !map.value || !interactiveMapEnabled.value) {
      return;
    }

    trackingState.value = 'tracking';
    handleLocationUpdate(location);
    ensureLocationTracking();
    queueInitialAutoLocateFocus(location, requestId);
  } catch (error) {
    if (requestId !== autoLocateRequestId) {
      return;
    }

    const geolocationError = error as { code?: number };
    trackingState.value = geolocationError.code === 1 ? 'denied' : 'error';
  }
}

async function primeLocationTrackerWhenPermissionGranted(): Promise<void> {
  if (
    !props.showLocationTracker ||
    props.autoLocateOnLoad ||
    trackingState.value !== 'idle' ||
    !isGeolocationSupported() ||
    typeof navigator === 'undefined' ||
    !navigator.permissions?.query
  ) {
    return;
  }

  const requestId = ++locationPermissionPrimeRequestId;
  try {
    const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
    if (
      requestId !== locationPermissionPrimeRequestId ||
      permissionStatus.state !== 'granted' ||
      trackingState.value !== 'idle'
    ) {
      return;
    }

    locationTracker.value?.startTracking();
  } catch {
    // Some browsers do not expose geolocation through Permissions API; keep locate click-driven.
  }
}

function handleLocate() {
  emit('interaction', { type: 'locate' });

  clearPendingInitialAutoLocateFocus();
  startUserLocationFollow();
  const location = locationTracker.value?.focusUserLocation() ?? lastUserLocation.value ?? null;
  if (location) {
    focusUserLocationSmoothly(location);
    return;
  }

  shouldCenterOnNextFix.value = true;
  void requestOneShotUserLocation(++manualLocateRequestId);
}

function handleLocationBadgeActivate(location: UserLocation | null) {
  emit('interaction', { type: 'locate_badge' });

  clearPendingInitialAutoLocateFocus();
  startUserLocationFollow();
  const targetLocation = location ?? lastUserLocation.value;
  if (targetLocation) {
    focusUserLocationSmoothly(targetLocation);
    return;
  }

  shouldCenterOnNextFix.value = true;
  void requestOneShotUserLocation(++manualLocateRequestId);
}

function resetMapViewport(): boolean {
  const instance = map.value;
  const targetViewport = resolveBaseViewport();
  const targetStyle = resolveRequestedMapStyle(targetViewport.style);
  const targetCamera = {
    center: targetViewport.center,
    zoom: targetViewport.zoom,
    bearing: 0,
    pitch: 0,
  };
  const targetCameraSignature = buildCameraTargetSignature(targetCamera);
  const isInteractive = Boolean(instance && interactiveMapEnabled.value);
  const cameraAlreadyRequested =
    pendingResetCameraSignature === targetCameraSignature &&
    isMapCameraTransitioning.value;
  const cameraAlreadyReset = instance && isInteractive
    ? isMapCameraAtTarget(instance, targetCamera)
    : isMapStoreViewportAtTarget(targetViewport, targetStyle);
  const styleAlreadyReset = mapStyle.value === targetStyle && mapStore.viewport.style === targetStyle;
  const resetFlightDuration = instance && isInteractive
    ? resolveLocationFocusDuration(instance, targetCamera.center, targetCamera.zoom, { useFlight: true })
    : 980;
  deferMapDecorativeWorkFor(resetFlightDuration + MAP_DECORATIVE_CAMERA_SETTLE_BUFFER_MS);

  if (cameraAlreadyRequested || (cameraAlreadyReset && styleAlreadyReset)) {
    clearPendingControlZoom();
    return false;
  }

  clearPendingControlZoom();
  suppressViewportCameraSyncFor(resetFlightDuration + 320);
  pendingLocationCameraSignature = null;
  mapStore.setCenter(targetViewport.center);
  mapStore.setZoom(targetViewport.zoom);
  if (styleAlreadyReset) {
    mapStore.setStyle(targetStyle);
  } else {
    applyRequestedMapStyle(targetViewport.style);
  }

  if (!instance || !interactiveMapEnabled.value || cameraAlreadyReset) {
    return true;
  }

  clearLocationCameraAnimation();
  instance.stop();
  applyPlannerInteractionProjection(instance);
  pendingResetCameraSignature = targetCameraSignature;
  flashPlannerMapDim(MAP_PLANNER_RESET_DIM_FLASH_MS);
  suppressCameraInteractionRenderGateOnce();
  if (usesPlannerCameraMotion()) {
    stopMapCameraRenderTransitionVisuals();
    instance.flyTo({
      ...targetCamera,
      duration: resetFlightDuration,
      easing: easeInOutMapLocationFocus,
      essential: true,
      curve: 1.18,
      speed: 0.72,
      maxDuration: MAP_LOCATION_FOCUS_MAX_DURATION_MS + 200,
    });
    return true;
  }

  startMapCameraRenderTransition({
    timeoutMs: MAP_PRIORITY_CAMERA_GATE_TIMEOUT_MS,
    minimumVisibleMs: MAP_PRIORITY_CAMERA_GATE_MIN_VISIBLE_MS,
    captureSnapshot: false,
    renderGate: false,
    tileSettling: true,
  });
  instance.easeTo({
    ...targetCamera,
    duration: resetFlightDuration,
    easing: easeOutMapControlZoom,
    essential: true,
  });
  return true;
}

function handleResetMap() {
  emit('interaction', { type: 'reset_map' });
  mapStore.resetCategories();
  mapStore.resetVisibleSpotIds();
  measuredVisiblePinCount.value = null;
  shouldCenterOnNextFix.value = false;
  isFollowingUserLocation.value = false;
  pendingLocationCamera = null;
  pendingLocationCameraSignature = null;
  clearPendingInitialAutoLocateFocus();
  clearMapFeaturePlaceSelection();

  const resetRoutePoints = props.routePoints.filter(hasValidCoordinates);
  const resetMarkerPoints = markerSpots.value.filter(hasValidCoordinates);
  const resetTargetPoints = resetRoutePoints.length ? resetRoutePoints : resetMarkerPoints;
  mapStore.setSelectedSpotId(resetTargetPoints[0]?.id ?? markerSpots.value[0]?.id ?? null);
  initialFitSignature.value = resetTargetPoints.length
    ? buildFitSignature(resetRoutePoints.length ? 'route' : 'spots', resetTargetPoints)
    : 'reset';
  resetMapViewport();

  nextTick(() => {
    updateLiveRouteOverlay();
    updateVisibleSpotIds();
    scheduleMarkerRender();
    scheduleNearbyPlacesRefresh();
  });
}

function normalizePlannerMapCommandInput(input: ScopeAiMapExternalCommandInput): ScopeAiMapCommandPayload {
  return typeof input === 'string' ? { command: input } : input;
}

function isValidPlannerMapTarget(target: ScopeAiMapTarget | undefined): target is ScopeAiMapTarget {
  return Boolean(target) &&
    Number.isFinite(target?.latitude) &&
    Number.isFinite(target?.longitude) &&
    Number(target?.latitude) >= -90 &&
    Number(target?.latitude) <= 90 &&
    Number(target?.longitude) >= -180 &&
    Number(target?.longitude) <= 180;
}

function focusPlannerMapTarget(target: ScopeAiMapTarget): boolean {
  const instance = map.value;
  if (!instance || !interactiveMapEnabled.value) {
    return false;
  }

  const targetCenter: [number, number] = [Number(target.longitude), Number(target.latitude)];
  const currentZoom = instance.getZoom();
  const targetZoom = clampNumber(
    typeof target.zoom === 'number' ? target.zoom : Math.max(currentZoom, MAP_LOCATION_FOCUS_TARGET_ZOOM),
    MIN_MAP_ZOOM,
    MAX_MAP_ZOOM,
  );
  const duration = resolveLocationFocusDuration(instance, targetCenter, targetZoom, { useFlight: true });

  emit('interaction', { type: 'zoom_to_place' });
  shouldCenterOnNextFix.value = false;
  isFollowingUserLocation.value = false;
  pendingLocationCamera = null;
  pendingLocationCameraSignature = null;
  clearPendingInitialAutoLocateFocus();
  clearLocationCameraAnimation();
  deferMapDecorativeWorkFor(duration + MAP_DECORATIVE_CAMERA_SETTLE_BUFFER_MS);
  suppressViewportCameraSyncFor(duration + MAP_CONTROL_ZOOM_VIEWPORT_SYNC_BUFFER_MS);
  suppressCameraInteractionRenderGateOnce();
  instance.stop();
  mapStore.setCenter(targetCenter);
  mapStore.setZoom(targetZoom);
  instance.flyTo({
    center: targetCenter,
    zoom: targetZoom,
    duration,
    easing: easeInOutMapLocationFocus,
    essential: true,
  });

  return true;
}

async function runPlannerMapCommand(input: ScopeAiMapExternalCommandInput): Promise<{ ok: boolean; message: string }> {
  if (!interactiveMapEnabled.value) {
    return {
      ok: false,
      message: 'The live planner map is offline right now, so I could not move the Mapbox view.',
    };
  }

  const payload = normalizePlannerMapCommandInput(input);
  const command = payload.command;

  switch (command) {
    case 'zoom_in':
      handleZoom(1);
      return { ok: true, message: 'Zoomed the planner map in.' };
    case 'zoom_out':
      handleZoom(-1);
      return { ok: true, message: 'Zoomed the planner map out.' };
    case 'zoom_to_place':
      if (!isValidPlannerMapTarget(payload.target)) {
        return {
          ok: false,
          message: 'I found the map command, but I could not resolve that place to map coordinates.',
        };
      }
      focusPlannerMapTarget(payload.target);
      return { ok: true, message: `Zoomed the planner map to ${payload.target.label ?? payload.query ?? 'that place'}.` };
    case 'reset_map':
      handleResetMap();
      return { ok: true, message: 'Reset the planner map view.' };
    case 'fit_route':
      fitToRoute();
      return { ok: true, message: 'Fitted the planner map to the current route.' };
    case 'locate_user':
      handleLocate();
      return { ok: true, message: 'Asked the planner map to center on your location.' };
    case 'map_style_light':
      if (activeMapStyleMode.value === 'native') {
        return { ok: true, message: 'The planner map is already in bright mode.' };
      }
      await handleMapStyleModeSelect('native');
      return { ok: true, message: 'Switched only the planner map to bright mode.' };
    case 'map_style_dark':
      if (activeMapStyleMode.value === 'scope') {
        return { ok: true, message: 'The planner map is already in dark mode.' };
      }
      await handleMapStyleModeSelect('scope');
      return { ok: true, message: 'Switched only the planner map to dark mode.' };
    default:
      return { ok: false, message: 'I could not match that map command to a planner map control.' };
  }
}

function syncUserLocationMarker(location = lastUserLocation.value): void {
  const instance = map.value;
  const runtime = mapboxRuntime.value;
  if (!location || !instance || !runtime || !interactiveMapEnabled.value) {
    return;
  }

  if (!userMarker.value) {
    userMarker.value = new runtime.Marker({
      element: buildUserMarkerElement(),
      anchor: 'center',
    }).setLngLat([location.longitude, location.latitude]).addTo(instance);
  } else {
    userMarker.value.setLngLat([location.longitude, location.latitude]);
  }
}

function handleLocationUpdate(location: UserLocation) {
  lastUserLocation.value = location;
  trackingState.value = 'tracking';
  mapStore.setUserLocation([location.longitude, location.latitude]);
  emit('location-update', location);
  syncUserLocationMarker(location);

  if (shouldCenterOnNextFix.value) {
    const didCenter = centerOnLocation(location, MAP_LOCATION_FOCUS_TARGET_ZOOM, {
      allowDefer: false,
      forceZoomIn: true,
      maxFocusZoom: MAP_LOCATION_FOCUS_TARGET_ZOOM,
      useFlight: true,
    });
    shouldCenterOnNextFix.value = !didCenter;
    isFollowingUserLocation.value = didCenter;
  } else if (isFollowingUserLocation.value) {
    centerOnLocation(location, MAP_LOCATION_FOCUS_TARGET_ZOOM, {
      allowDefer: false,
      forceZoomIn: false,
      durationMs: MAP_LOCATION_FOLLOW_UPDATE_DURATION_MS,
      renderGate: false,
      tileSettling: false,
    });
  }

  scheduleMarkerRender();
}

function syncThemeToMap() {
  const previousPresentation = effectiveMapPresentation.value;
  const nextTheme = getDocumentTheme();
  if (currentDocumentTheme.value === nextTheme) {
    return;
  }

  currentDocumentTheme.value = nextTheme;
  const nextPresentation = effectiveMapPresentation.value;
  if (nextPresentation === previousPresentation) {
    return;
  }

  applyRequestedMapStyle(undefined, {
    forcePresentationTransition: true,
    transitionCoverMode: nextPresentation,
    transitionVariant: 'switch',
  });
}

function safelySetMapPaintProperty(instance: mapboxgl.Map, layerId: string, property: string, value: unknown): void {
  try {
    if (mapStylePropertyMatches(instance.getPaintProperty(layerId, property), value)) {
      return;
    }

    instance.setPaintProperty(layerId, property, value);
  } catch {
    // Mapbox styles can include imported/read-only layers; keep layer polish best-effort.
  }
}

function safelySetMapPaintTransitions(instance: mapboxgl.Map, layerId: string, properties: readonly string[]): void {
  properties.forEach((property) => {
    safelySetMapPaintProperty(instance, layerId, `${property}-transition`, MAP_PRESENTATION_PAINT_TRANSITION);
  });
}

function mapStylePropertyMatches(current: unknown, next: unknown): boolean {
  if (Object.is(current, next)) {
    return true;
  }

  try {
    return JSON.stringify(current) === JSON.stringify(next);
  } catch {
    return false;
  }
}

function getLayerPaintProperty(layer: mapboxgl.AnyLayer, property: string): unknown {
  const paint = (layer as { paint?: Record<string, unknown> }).paint;
  return paint && Object.prototype.hasOwnProperty.call(paint, property) ? paint[property] : null;
}

function getLayerLayoutProperty(layer: mapboxgl.AnyLayer, property: string): unknown {
  const layout = (layer as { layout?: Record<string, unknown> }).layout;
  return layout && Object.prototype.hasOwnProperty.call(layout, property) ? layout[property] : null;
}

function hasLayerLayoutValue(value: unknown): boolean {
  return value !== null && value !== undefined && !(typeof value === 'string' && !value.trim());
}

function setScopedMapPaintProperty(instance: mapboxgl.Map, layer: mapboxgl.AnyLayer, property: string, value: unknown): void {
  const layerId = String(layer.id ?? '');
  if (!layerId) {
    return;
  }

  if (!scopeMapPaintOverrides.has(layerId)) {
    scopeMapPaintOverrides.set(layerId, new Map<string, unknown>());
  }

  const layerOverrides = scopeMapPaintOverrides.get(layerId);
  if (layerOverrides && !layerOverrides.has(property)) {
    layerOverrides.set(property, getLayerPaintProperty(layer, property));
  }

  safelySetMapPaintProperty(instance, layerId, property, value);
}

function setScopedMapPaintTransition(instance: mapboxgl.Map, layer: mapboxgl.AnyLayer, property: string): void {
  setScopedMapPaintProperty(instance, layer, `${property}-transition`, MAP_PRESENTATION_PAINT_TRANSITION);
}

function applyMapPresentationLayerTransition(instance: mapboxgl.Map, layer: mapboxgl.AnyLayer): void {
  switch (layer.type) {
    case 'background':
      setScopedMapPaintTransition(instance, layer, 'background-color');
      setScopedMapPaintTransition(instance, layer, 'background-opacity');
      break;
    case 'fill':
      setScopedMapPaintTransition(instance, layer, 'fill-color');
      setScopedMapPaintTransition(instance, layer, 'fill-opacity');
      break;
    case 'line':
      setScopedMapPaintTransition(instance, layer, 'line-color');
      setScopedMapPaintTransition(instance, layer, 'line-opacity');
      break;
    case 'symbol':
      setScopedMapPaintTransition(instance, layer, 'text-color');
      setScopedMapPaintTransition(instance, layer, 'text-opacity');
      setScopedMapPaintTransition(instance, layer, 'text-halo-color');
      setScopedMapPaintTransition(instance, layer, 'icon-color');
      setScopedMapPaintTransition(instance, layer, 'icon-opacity');
      setScopedMapPaintTransition(instance, layer, 'icon-halo-color');
      break;
    case 'hillshade':
      setScopedMapPaintTransition(instance, layer, 'hillshade-exaggeration');
      setScopedMapPaintTransition(instance, layer, 'hillshade-shadow-color');
      setScopedMapPaintTransition(instance, layer, 'hillshade-highlight-color');
      setScopedMapPaintTransition(instance, layer, 'hillshade-accent-color');
      break;
    default:
      break;
  }
}

function restoreScopedMapPaintProperties(instance: mapboxgl.Map): void {
  if (!scopeMapPaintOverrides.size) {
    return;
  }

  scopeMapPaintOverrides.forEach((properties, layerId) => {
    if (!instance.getLayer(layerId)) {
      return;
    }

    properties.forEach((value, property) => {
      safelySetMapPaintProperty(instance, layerId, property, value);
    });
  });
  scopeMapPaintOverrides.clear();
}

function prepareScopedMapPresentation(instance: mapboxgl.Map, mode: MapPresentationMode): void {
  if (activeScopedMapPresentation && activeScopedMapPresentation !== mode) {
    restoreScopedMapPaintProperties(instance);
  }

  activeScopedMapPresentation = mode;
}

function safelySetMapLayoutProperty(instance: mapboxgl.Map, layerId: string, property: string, value: unknown): void {
  try {
    if (mapStylePropertyMatches(instance.getLayoutProperty(layerId, property), value)) {
      return;
    }

    instance.setLayoutProperty(layerId, property, value);
  } catch {
    // Mapbox styles can include imported/read-only layers; keep layer polish best-effort.
  }
}

function getMapLayoutProperty(instance: mapboxgl.Map, layerId: string, property: string): unknown {
  try {
    return instance.getLayoutProperty(layerId, property);
  } catch {
    return undefined;
  }
}

function safelySetMapLayerZoomRange(instance: mapboxgl.Map, layerId: string, minzoom: number, maxzoom: number): void {
  try {
    instance.setLayerZoomRange(layerId, minzoom, maxzoom);
  } catch {
    // Mapbox styles can include imported/read-only layers; keep layer polish best-effort.
  }
}

function safelyMoveMapLayerBefore(instance: mapboxgl.Map, layerId: string, beforeLayerId: string | undefined): void {
  try {
    if (!instance.getLayer(layerId)) {
      return;
    }

    if (beforeLayerId && beforeLayerId !== layerId && instance.getLayer(beforeLayerId)) {
      instance.moveLayer(layerId, beforeLayerId);
      return;
    }

    instance.moveLayer(layerId);
  } catch {
    // Visual layer ordering is best-effort during style swaps.
  }
}

function getFirstSymbolLayerId(instance: mapboxgl.Map): string | undefined {
  try {
    const firstSymbolLayerId = String(instance.getStyle().layers?.find((layer) => layer.type === 'symbol')?.id ?? '');
    return firstSymbolLayerId || undefined;
  } catch {
    return undefined;
  }
}

function getFirstNativeSymbolLayerId(instance: mapboxgl.Map): string | undefined {
  try {
    const firstSymbolLayerId = String(instance.getStyle().layers?.find((layer) => (
      layer.type === 'symbol'
      && layer.id !== SCOPE_US_STATE_LABEL_LAYER_ID
      && layer.id !== SCOPE_US_STATE_NAME_LABEL_LAYER_ID
    ))?.id ?? '');
    return firstSymbolLayerId || undefined;
  } catch {
    return undefined;
  }
}

function getMapTrafficBeforeLayerId(instance: mapboxgl.Map): string | undefined {
  try {
    const layers = instance.getStyle().layers ?? [];
    const boundaryLayerId = String(layers.find((layer) => {
      const layerId = String(layer.id ?? '').toLowerCase();
      if (!layerId || layer.type !== 'line') {
        return false;
      }

      return isAdministrativeBoundaryLineLayer(layerId, getLayerSourceLayer(layer));
    })?.id ?? '');
    return boundaryLayerId || getFirstSymbolLayerId(instance);
  } catch {
    return getFirstSymbolLayerId(instance);
  }
}

type TripsMapDebugWindow = Window & {
  __scopeMapboxMap?: mapboxgl.Map | null;
  __tripsMap?: mapboxgl.Map | null;
  __tripsMapIdle?: boolean;
  __tripsMapLoaded?: boolean;
};

function isTripsMapDebugEnabled(): boolean {
  const runtimeProcess = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process;
  return isUiTestEnvironment() || (!import.meta.env.PROD && runtimeProcess?.env?.NODE_ENV !== 'production');
}

function setTripsMapDebugFlag(flag: '__tripsMapIdle' | '__tripsMapLoaded'): void {
  if (props.routeVariant !== 'planner' || typeof window === 'undefined' || !isTripsMapDebugEnabled()) {
    return;
  }

  (window as TripsMapDebugWindow)[flag] = true;
}

function exposeMapInstanceForUiTests(instance: mapboxgl.Map | null): void {
  if (typeof window === 'undefined' || (!isUiTestEnvironment() && !isTripsMapDebugEnabled())) {
    return;
  }

  const debugWindow = window as TripsMapDebugWindow;
  debugWindow.__scopeMapboxMap = instance;
  if (props.routeVariant === 'planner') {
    debugWindow.__tripsMap = instance;
    const canvasAlreadyRevealed = Boolean(instance?.getCanvas?.().classList.contains('loaded'));
    debugWindow.__tripsMapIdle = canvasAlreadyRevealed;
    debugWindow.__tripsMapLoaded = canvasAlreadyRevealed;
  }
}

function isScopeTrafficLayerId(layerId: string): boolean {
  return (MAP_TRAFFIC_ALL_LAYER_IDS as readonly string[]).includes(layerId);
}

function isScopeRoadContextLayerId(layerId: string): boolean {
  return (MAP_SCOPE_ROAD_CONTEXT_LAYER_IDS as readonly string[]).includes(layerId);
}

function getMapRoadSourceId(instance: mapboxgl.Map): string | null {
  try {
    const sources = instance.getStyle().sources ?? {};
    if (sources.composite) {
      return 'composite';
    }

    const sourceEntry = Object.entries(sources).find(([, source]) => {
      const url = String((source as { url?: unknown }).url ?? '');
      return /mapbox-streets-v8|mapbox\.mapbox-streets/i.test(url);
    });
    return sourceEntry?.[0] ?? null;
  } catch {
    return null;
  }
}

function buildTrafficRoadClassFilter(): unknown[] {
  return ['match', ['get', 'class'], [...MAP_TRAFFIC_MAJOR_ROAD_CLASSES], true, false];
}

function buildTrafficCongestionFilter(levels: readonly string[]): unknown[] {
  return ['match', ['get', 'congestion'], [...levels], true, false];
}

function getMapTrafficCasingColor(): string {
  return effectiveMapPresentation.value === 'native' ? 'rgb(247, 247, 239)' : 'rgb(38, 54, 69)';
}

function getMapTrafficCasingOpacity(): unknown {
  return effectiveMapPresentation.value === 'native'
    ? ['interpolate', ['linear'], ['zoom'], 8.2, 0.48, 10, 0.62, 13, 0.74, 15, 0.82]
    : ['interpolate', ['linear'], ['zoom'], 8.2, 0.28, 10, 0.44, 13, 0.58, 15, 0.68];
}

function applyMapTrafficLayerPaint(instance: mapboxgl.Map): void {
  MAP_TRAFFIC_LAYER_IDS.forEach((layerId) => {
    if (!instance.getLayer(layerId)) {
      return;
    }

    safelySetMapLayoutProperty(instance, layerId, 'line-cap', 'butt');
    safelySetMapLayoutProperty(instance, layerId, 'line-join', 'bevel');
  });

  if (instance.getLayer('scope-traffic-flow-casing')) {
    safelySetMapPaintProperty(instance, 'scope-traffic-flow-casing', 'line-color', getMapTrafficCasingColor());
    safelySetMapPaintProperty(instance, 'scope-traffic-flow-casing', 'line-opacity', getMapTrafficCasingOpacity());
    safelySetMapPaintProperty(instance, 'scope-traffic-flow-casing', 'line-width', MAP_TRAFFIC_LINE_CASING_WIDTH);
  }

  if (instance.getLayer('scope-traffic-flow')) {
    safelySetMapPaintProperty(instance, 'scope-traffic-flow', 'line-color', MAP_TRAFFIC_MODERATE_COLOR);
    safelySetMapPaintProperty(instance, 'scope-traffic-flow', 'line-opacity', MAP_TRAFFIC_FLOW_OPACITY);
    safelySetMapPaintProperty(instance, 'scope-traffic-flow', 'line-width', MAP_TRAFFIC_FLOW_LINE_WIDTH);
  }

  if (instance.getLayer('scope-traffic-alert-casing')) {
    safelySetMapPaintProperty(instance, 'scope-traffic-alert-casing', 'line-color', getMapTrafficCasingColor());
    safelySetMapPaintProperty(instance, 'scope-traffic-alert-casing', 'line-opacity', getMapTrafficCasingOpacity());
    safelySetMapPaintProperty(instance, 'scope-traffic-alert-casing', 'line-width', MAP_TRAFFIC_ALERT_CASING_WIDTH);
  }

  if (instance.getLayer('scope-traffic-alert')) {
    safelySetMapPaintProperty(instance, 'scope-traffic-alert', 'line-color', MAP_TRAFFIC_ALERT_COLOR);
    safelySetMapPaintProperty(instance, 'scope-traffic-alert', 'line-opacity', MAP_TRAFFIC_ALERT_OPACITY);
    safelySetMapPaintProperty(instance, 'scope-traffic-alert', 'line-width', MAP_TRAFFIC_ALERT_LINE_WIDTH);
  }

  if (instance.getLayer('scope-traffic-closures')) {
    safelySetMapPaintProperty(instance, 'scope-traffic-closures', 'line-color', MAP_TRAFFIC_CLOSURE_COLOR);
    safelySetMapPaintProperty(instance, 'scope-traffic-closures', 'line-opacity', 1);
    safelySetMapPaintProperty(instance, 'scope-traffic-closures', 'line-width', MAP_TRAFFIC_ALERT_LINE_WIDTH);
    safelySetMapPaintProperty(instance, 'scope-traffic-closures', 'line-dasharray', [1.05, 0.7]);
  }
}

function buildMapTrafficLayerDefinitions(): mapboxgl.AnyLayer[] {
  const roadClassFilter = buildTrafficRoadClassFilter();
  const moderateTrafficFilter = [
    'all',
    roadClassFilter,
    ['!=', ['get', 'closed'], 'yes'],
    buildTrafficCongestionFilter(['moderate']),
  ];
  const alertTrafficFilter = [
    'all',
    roadClassFilter,
    ['!=', ['get', 'closed'], 'yes'],
    buildTrafficCongestionFilter(['heavy', 'severe']),
  ];

  return [
    {
      id: 'scope-traffic-flow-casing',
      type: 'line',
      source: MAP_TRAFFIC_SOURCE_ID,
      'source-layer': MAP_TRAFFIC_SOURCE_LAYER,
      minzoom: 8.2,
      filter: moderateTrafficFilter,
      layout: {
        'line-cap': 'butt',
        'line-join': 'bevel',
      },
      paint: {
        'line-color': getMapTrafficCasingColor(),
        'line-opacity': getMapTrafficCasingOpacity(),
        'line-width': MAP_TRAFFIC_FLOW_CASING_WIDTH,
      },
    } as mapboxgl.AnyLayer,
    {
      id: 'scope-traffic-flow',
      type: 'line',
      source: MAP_TRAFFIC_SOURCE_ID,
      'source-layer': MAP_TRAFFIC_SOURCE_LAYER,
      minzoom: 8.2,
      filter: moderateTrafficFilter,
      layout: {
        'line-cap': 'butt',
        'line-join': 'bevel',
      },
      paint: {
        'line-color': MAP_TRAFFIC_MODERATE_COLOR,
        'line-opacity': MAP_TRAFFIC_FLOW_OPACITY,
        'line-width': MAP_TRAFFIC_FLOW_LINE_WIDTH,
        'line-emissive-strength': 0.55,
      },
    } as mapboxgl.AnyLayer,
    {
      id: 'scope-traffic-alert-casing',
      type: 'line',
      source: MAP_TRAFFIC_SOURCE_ID,
      'source-layer': MAP_TRAFFIC_SOURCE_LAYER,
      minzoom: 8.2,
      filter: alertTrafficFilter,
      layout: {
        'line-cap': 'butt',
        'line-join': 'bevel',
      },
      paint: {
        'line-color': getMapTrafficCasingColor(),
        'line-opacity': getMapTrafficCasingOpacity(),
        'line-width': MAP_TRAFFIC_ALERT_CASING_WIDTH,
      },
    } as mapboxgl.AnyLayer,
    {
      id: 'scope-traffic-alert',
      type: 'line',
      source: MAP_TRAFFIC_SOURCE_ID,
      'source-layer': MAP_TRAFFIC_SOURCE_LAYER,
      minzoom: 8.2,
      filter: alertTrafficFilter,
      layout: {
        'line-cap': 'butt',
        'line-join': 'bevel',
      },
      paint: {
        'line-color': MAP_TRAFFIC_ALERT_COLOR,
        'line-opacity': MAP_TRAFFIC_ALERT_OPACITY,
        'line-width': MAP_TRAFFIC_ALERT_LINE_WIDTH,
        'line-emissive-strength': 0.72,
      },
    } as mapboxgl.AnyLayer,
    {
      id: 'scope-traffic-closures',
      type: 'line',
      source: MAP_TRAFFIC_SOURCE_ID,
      'source-layer': MAP_TRAFFIC_SOURCE_LAYER,
      minzoom: 8.2,
      filter: [
        'all',
        roadClassFilter,
        ['==', ['get', 'closed'], 'yes'],
      ],
      layout: {
        'line-cap': 'butt',
        'line-join': 'bevel',
      },
      paint: {
        'line-color': MAP_TRAFFIC_CLOSURE_COLOR,
        'line-dasharray': [1.05, 0.7],
        'line-opacity': 1,
        'line-width': MAP_TRAFFIC_ALERT_LINE_WIDTH,
        'line-emissive-strength': 0.8,
      },
    } as mapboxgl.AnyLayer,
  ];
}

function buildScopeRoadContextLayerDefinitions(sourceId: string): mapboxgl.AnyLayer[] {
  return [
    {
      id: 'scope-dark-road-context-major',
      type: 'line',
      source: sourceId,
      'source-layer': 'road',
      minzoom: 3.8,
      filter: ['match', ['get', 'class'], [...MAP_TRAFFIC_MAJOR_ROAD_CLASSES], true, false],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': 'rgb(112, 128, 142)',
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 3.8, 0, 4.8, 0.18, 6.5, 0.34, 8.6, 0.5, 13, 0.64],
        'line-width': ['interpolate', ['linear'], ['zoom'], 3.8, 0.22, 5.2, 0.38, 7.2, 0.72, 10, 1.28, 14, 2.55],
        'line-blur': 0.15,
        'line-emissive-strength': 0.04,
      },
    } as mapboxgl.AnyLayer,
    {
      id: 'scope-dark-road-context-secondary',
      type: 'line',
      source: sourceId,
      'source-layer': 'road',
      minzoom: 6.2,
      filter: ['match', ['get', 'class'], [...MAP_CONTEXT_SECONDARY_ROAD_CLASSES], true, false],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': 'rgb(82, 98, 111)',
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 6.2, 0, 7.4, 0.18, 9.6, 0.34, 13, 0.5],
        'line-width': ['interpolate', ['linear'], ['zoom'], 6.2, 0.16, 8.2, 0.42, 11, 0.98, 15, 2.1],
        'line-blur': 0.18,
        'line-emissive-strength': 0.025,
      },
    } as mapboxgl.AnyLayer,
  ];
}

function removeScopeRoadContextLayers(instance: mapboxgl.Map): void {
  try {
    [...MAP_SCOPE_ROAD_CONTEXT_LAYER_IDS].reverse().forEach((layerId) => {
      if (instance.getLayer(layerId)) {
        instance.removeLayer(layerId);
      }
    });
  } catch {
    // Road context is decorative; base roads remain available.
  }
}

function syncScopeRoadContextLayers(instance: mapboxgl.Map): void {
  const sourceId = getMapRoadSourceId(instance);
  if (!sourceId) {
    removeScopeRoadContextLayers(instance);
    return;
  }

  try {
    const beforeLayerId = getMapTrafficBeforeLayerId(instance);
    buildScopeRoadContextLayerDefinitions(sourceId).forEach((layer) => {
      const layerId = String(layer.id ?? '');
      if (instance.getLayer(layerId)) {
        safelyMoveMapLayerBefore(instance, layerId, beforeLayerId);
        return;
      }

      if (beforeLayerId && instance.getLayer(beforeLayerId)) {
        instance.addLayer(layer, beforeLayerId);
        return;
      }

      instance.addLayer(layer);
    });
  } catch {
    // Some Mapbox style imports reject extra layers while loading; the refresh series retries.
  }
}

function buildWaterReferenceLabelFeatureCollection(): WaterReferenceLabelFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: WATER_REFERENCE_LABELS.map((label) => ({
      type: 'Feature',
      properties: {
        id: label.id,
        name: label.name,
        minZoom: label.minZoom ?? MAP_WATER_LABEL_MIN_ZOOM,
      },
      geometry: {
        type: 'Point',
        coordinates: label.coordinates,
      },
    })),
  };
}

function syncWaterReferenceLabelLayer(instance: mapboxgl.Map): void {
  try {
    const labelMode = props.labelMode ?? 'full';
    const minZoom = getWaterReferenceLabelMinZoom(labelMode);
    const textOpacity = getWaterReferenceLabelOpacity(labelMode);
    const isNativePresentation = effectiveMapPresentation.value === 'native';
    const textColor = isNativePresentation ? 'rgb(42, 107, 139)' : 'rgb(151, 211, 232)';
    const haloColor = isNativePresentation ? 'rgb(235, 249, 242)' : 'rgb(5, 10, 14)';
    const haloWidth = isNativePresentation ? 1.2 : 0.78;
    const haloBlur = isNativePresentation ? 0.25 : 0;
    const beforeLayerId = instance.getLayer(SCOPE_US_STATE_LABEL_LAYER_ID)
      ? SCOPE_US_STATE_LABEL_LAYER_ID
      : getFirstNativeSymbolLayerId(instance);

    if (!instance.getSource(MAP_WATER_REFERENCE_SOURCE_ID)) {
      instance.addSource(MAP_WATER_REFERENCE_SOURCE_ID, {
        type: 'geojson',
        data: buildWaterReferenceLabelFeatureCollection(),
      });
    }

    if (!instance.getLayer(MAP_WATER_REFERENCE_LAYER_ID)) {
      instance.addLayer({
        id: MAP_WATER_REFERENCE_LAYER_ID,
        type: 'symbol',
        source: MAP_WATER_REFERENCE_SOURCE_ID,
        minzoom: minZoom,
        maxzoom: MAP_WATER_REFERENCE_MAX_ZOOM,
        layout: {
          'text-field': MAP_WATER_REFERENCE_TEXT_FIELD,
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': MAP_WATER_REFERENCE_TEXT_SIZE,
          'text-letter-spacing': 0.02,
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-optional': true,
          'text-padding': 8,
        },
        paint: {
          'text-color': textColor,
          'text-halo-color': haloColor,
          'text-halo-width': haloWidth,
          'text-halo-blur': haloBlur,
          'text-opacity': textOpacity,
        },
      } as mapboxgl.AnyLayer, beforeLayerId);
    }

    if (beforeLayerId && instance.getLayer(beforeLayerId)) {
      safelyMoveMapLayerBefore(instance, MAP_WATER_REFERENCE_LAYER_ID, beforeLayerId);
    }
    safelySetMapLayoutProperty(instance, MAP_WATER_REFERENCE_LAYER_ID, 'visibility', 'visible');
    safelySetMapLayerZoomRange(instance, MAP_WATER_REFERENCE_LAYER_ID, minZoom, MAP_WATER_REFERENCE_MAX_ZOOM);
    safelySetMapLayoutProperty(instance, MAP_WATER_REFERENCE_LAYER_ID, 'text-size', MAP_WATER_REFERENCE_TEXT_SIZE);
    safelySetMapLayoutProperty(instance, MAP_WATER_REFERENCE_LAYER_ID, 'text-allow-overlap', false);
    safelySetMapLayoutProperty(instance, MAP_WATER_REFERENCE_LAYER_ID, 'text-ignore-placement', false);
    safelySetMapLayoutProperty(instance, MAP_WATER_REFERENCE_LAYER_ID, 'text-optional', true);
    safelySetMapLayoutProperty(instance, MAP_WATER_REFERENCE_LAYER_ID, 'text-padding', 8);
    safelySetMapPaintTransitions(instance, MAP_WATER_REFERENCE_LAYER_ID, [
      'text-color',
      'text-halo-color',
      'text-halo-width',
      'text-halo-blur',
      'text-opacity',
    ]);
    safelySetMapPaintProperty(instance, MAP_WATER_REFERENCE_LAYER_ID, 'text-color', textColor);
    safelySetMapPaintProperty(instance, MAP_WATER_REFERENCE_LAYER_ID, 'text-halo-color', haloColor);
    safelySetMapPaintProperty(instance, MAP_WATER_REFERENCE_LAYER_ID, 'text-halo-width', haloWidth);
    safelySetMapPaintProperty(instance, MAP_WATER_REFERENCE_LAYER_ID, 'text-halo-blur', haloBlur);
    safelySetMapPaintProperty(instance, MAP_WATER_REFERENCE_LAYER_ID, 'text-opacity', textOpacity);
  } catch {
    // Reference water labels are decorative; the base map remains usable if they fail to attach.
  }
}

function removeMapTerrainLayers(instance: mapboxgl.Map): void {
  try {
    MAP_TERRAIN_LAYER_IDS.forEach((layerId) => {
      if (instance.getLayer(layerId)) {
        instance.removeLayer(layerId);
      }
    });

    if (instance.getSource(MAP_TERRAIN_SOURCE_ID)) {
      instance.removeSource(MAP_TERRAIN_SOURCE_ID);
    }
  } catch {
    // Terrain is decorative; never block the base map or traffic layer.
  }
}

function syncReferenceLabelLayers(instance: mapboxgl.Map): void {
  try {
    const labelMode = props.labelMode ?? 'full';
    const showStateAbbreviationLabels = shouldUseStateAbbreviationLabels(labelMode);
    const isNativePresentation = effectiveMapPresentation.value === 'native';
    const textColor = isNativePresentation ? MAP_NATIVE_REFERENCE_LABEL_COLOR : MAP_SCOPE_REFERENCE_LABEL_COLOR;
    const haloColor = isNativePresentation ? MAP_NATIVE_REFERENCE_LABEL_HALO_COLOR : MAP_SCOPE_REFERENCE_LABEL_HALO_COLOR;
    const haloWidth = isNativePresentation ? 1.4 : 1.65;
    const haloBlur = isNativePresentation ? 0.35 : 0.22;
    const beforeLayerId = getFirstNativeSymbolLayerId(instance);

    if (!instance.getSource(SCOPE_US_STATE_LABEL_SOURCE_ID)) {
      instance.addSource(SCOPE_US_STATE_LABEL_SOURCE_ID, {
        type: 'geojson',
        data: buildUsStateLabelFeatureCollection(US_STATE_LABELS),
      });
    }

    if (!instance.getLayer(SCOPE_US_STATE_LABEL_LAYER_ID)) {
      instance.addLayer({
        id: SCOPE_US_STATE_LABEL_LAYER_ID,
        type: 'symbol',
        source: SCOPE_US_STATE_LABEL_SOURCE_ID,
        minzoom: 2.35,
        maxzoom: 6.35,
        layout: {
          'text-field': SCOPE_US_STATE_ABBREVIATION_LABEL_TEXT_FIELD,
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': MAP_REFERENCE_LABEL_TEXT_SIZE,
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-optional': true,
          'text-padding': 4,
        },
        paint: {
          'text-color': textColor,
          'text-halo-color': haloColor,
          'text-halo-width': haloWidth,
          'text-halo-blur': haloBlur,
          'text-opacity': SCOPE_US_STATE_ABBREVIATION_LABEL_OPACITY,
        },
      } as mapboxgl.AnyLayer, beforeLayerId);
    }

    if (!instance.getLayer(SCOPE_US_STATE_NAME_LABEL_LAYER_ID)) {
      instance.addLayer({
        id: SCOPE_US_STATE_NAME_LABEL_LAYER_ID,
        type: 'symbol',
        source: SCOPE_US_STATE_LABEL_SOURCE_ID,
        minzoom: 5.25,
        maxzoom: 8.45,
        layout: {
          'text-field': SCOPE_US_STATE_NAME_LABEL_TEXT_FIELD,
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': MAP_STATE_REFERENCE_LABEL_TEXT_SIZE,
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-optional': true,
          'text-padding': 6,
        },
        paint: {
          'text-color': textColor,
          'text-halo-color': haloColor,
          'text-halo-width': haloWidth,
          'text-halo-blur': haloBlur,
          'text-opacity': SCOPE_US_STATE_NAME_LABEL_OPACITY,
        },
      } as mapboxgl.AnyLayer, beforeLayerId);
    }

    if (beforeLayerId) {
      safelyMoveMapLayerBefore(instance, SCOPE_US_STATE_LABEL_LAYER_ID, beforeLayerId);
      safelyMoveMapLayerBefore(instance, SCOPE_US_STATE_NAME_LABEL_LAYER_ID, beforeLayerId);
    }
    safelySetMapLayoutProperty(instance, SCOPE_US_STATE_LABEL_LAYER_ID, 'visibility', showStateAbbreviationLabels ? 'visible' : 'none');
    safelySetMapLayerZoomRange(instance, SCOPE_US_STATE_LABEL_LAYER_ID, 2.35, 6.35);
    safelySetMapLayoutProperty(instance, SCOPE_US_STATE_LABEL_LAYER_ID, 'text-field', SCOPE_US_STATE_ABBREVIATION_LABEL_TEXT_FIELD);
    safelySetMapLayoutProperty(instance, SCOPE_US_STATE_LABEL_LAYER_ID, 'text-size', MAP_REFERENCE_LABEL_TEXT_SIZE);
    safelySetMapLayoutProperty(instance, SCOPE_US_STATE_LABEL_LAYER_ID, 'text-allow-overlap', false);
    safelySetMapLayoutProperty(instance, SCOPE_US_STATE_LABEL_LAYER_ID, 'text-ignore-placement', false);
    safelySetMapLayoutProperty(instance, SCOPE_US_STATE_LABEL_LAYER_ID, 'text-optional', true);
    safelySetMapPaintTransitions(instance, SCOPE_US_STATE_LABEL_LAYER_ID, [
      'text-color',
      'text-halo-color',
      'text-halo-width',
      'text-halo-blur',
      'text-opacity',
    ]);
    safelySetMapPaintProperty(instance, SCOPE_US_STATE_LABEL_LAYER_ID, 'text-color', textColor);
    safelySetMapPaintProperty(instance, SCOPE_US_STATE_LABEL_LAYER_ID, 'text-halo-color', haloColor);
    safelySetMapPaintProperty(instance, SCOPE_US_STATE_LABEL_LAYER_ID, 'text-halo-width', haloWidth);
    safelySetMapPaintProperty(instance, SCOPE_US_STATE_LABEL_LAYER_ID, 'text-halo-blur', haloBlur);
    safelySetMapPaintProperty(instance, SCOPE_US_STATE_LABEL_LAYER_ID, 'text-opacity', SCOPE_US_STATE_ABBREVIATION_LABEL_OPACITY);
    safelySetMapLayoutProperty(instance, SCOPE_US_STATE_NAME_LABEL_LAYER_ID, 'visibility', showStateAbbreviationLabels ? 'visible' : 'none');
    safelySetMapLayerZoomRange(instance, SCOPE_US_STATE_NAME_LABEL_LAYER_ID, 5.25, 8.45);
    safelySetMapLayoutProperty(instance, SCOPE_US_STATE_NAME_LABEL_LAYER_ID, 'text-field', SCOPE_US_STATE_NAME_LABEL_TEXT_FIELD);
    safelySetMapLayoutProperty(instance, SCOPE_US_STATE_NAME_LABEL_LAYER_ID, 'text-size', MAP_STATE_REFERENCE_LABEL_TEXT_SIZE);
    safelySetMapLayoutProperty(instance, SCOPE_US_STATE_NAME_LABEL_LAYER_ID, 'text-allow-overlap', false);
    safelySetMapLayoutProperty(instance, SCOPE_US_STATE_NAME_LABEL_LAYER_ID, 'text-ignore-placement', false);
    safelySetMapLayoutProperty(instance, SCOPE_US_STATE_NAME_LABEL_LAYER_ID, 'text-optional', true);
    safelySetMapPaintTransitions(instance, SCOPE_US_STATE_NAME_LABEL_LAYER_ID, [
      'text-color',
      'text-halo-color',
      'text-halo-width',
      'text-halo-blur',
      'text-opacity',
    ]);
    safelySetMapPaintProperty(instance, SCOPE_US_STATE_NAME_LABEL_LAYER_ID, 'text-color', textColor);
    safelySetMapPaintProperty(instance, SCOPE_US_STATE_NAME_LABEL_LAYER_ID, 'text-halo-color', haloColor);
    safelySetMapPaintProperty(instance, SCOPE_US_STATE_NAME_LABEL_LAYER_ID, 'text-halo-width', haloWidth);
    safelySetMapPaintProperty(instance, SCOPE_US_STATE_NAME_LABEL_LAYER_ID, 'text-halo-blur', haloBlur);
    safelySetMapPaintProperty(instance, SCOPE_US_STATE_NAME_LABEL_LAYER_ID, 'text-opacity', SCOPE_US_STATE_NAME_LABEL_OPACITY);
  } catch {
    // Reference labels are decorative; the base Mapbox labels remain available if this layer cannot attach.
  }
}

function removeMapTrafficLayers(instance: mapboxgl.Map): void {
  try {
    [...MAP_TRAFFIC_ALL_LAYER_IDS].reverse().forEach((layerId) => {
      if (instance.getLayer(layerId)) {
        instance.removeLayer(layerId);
      }
    });

    if (instance.getSource(MAP_TRAFFIC_SOURCE_ID)) {
      instance.removeSource(MAP_TRAFFIC_SOURCE_ID);
    }
  } catch {
    // Traffic is an optional overlay; style transitions can briefly make it unavailable.
  }
}

function removeLegacyMapTrafficLayers(instance: mapboxgl.Map): void {
  MAP_TRAFFIC_LEGACY_LAYER_IDS.forEach((layerId) => {
    if (instance.getLayer(layerId)) {
      instance.removeLayer(layerId);
    }
  });
}

function addMapTrafficLayer(instance: mapboxgl.Map, layer: mapboxgl.AnyLayer, beforeLayerId: string | undefined): void {
  if (instance.getLayer(String(layer.id))) {
    safelyMoveMapLayerBefore(instance, String(layer.id), beforeLayerId);
    return;
  }

  if (beforeLayerId && instance.getLayer(beforeLayerId)) {
    instance.addLayer(layer, beforeLayerId);
    return;
  }

  instance.addLayer(layer);
}

function syncMapTrafficLayers(instance: mapboxgl.Map): void {
  if (!props.showTraffic || mapTrafficUnavailable) {
    removeMapTrafficLayers(instance);
    return;
  }

  try {
    removeLegacyMapTrafficLayers(instance);

    if (!instance.getSource(MAP_TRAFFIC_SOURCE_ID)) {
      instance.addSource(MAP_TRAFFIC_SOURCE_ID, {
        type: 'vector',
        url: MAP_TRAFFIC_SOURCE_URL,
      });
    }

    const beforeLayerId = getMapTrafficBeforeLayerId(instance);
    buildMapTrafficLayerDefinitions().forEach((layer) => {
      addMapTrafficLayer(instance, layer, beforeLayerId);
    });
    applyMapTrafficLayerPaint(instance);
  } catch {
    // Keep the base map usable if Traffic v1 is slow, unavailable, or mid-style-swap.
  }
}

function layerIdIncludes(normalizedLayerId: string, fragments: string[]): boolean {
  return fragments.some((fragment) => normalizedLayerId.includes(fragment));
}

function getLayerSourceLayer(layer: mapboxgl.AnyLayer): string {
  return String((layer as { 'source-layer'?: unknown })['source-layer'] ?? '').toLowerCase();
}

function isCountryLabelLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return layerIdIncludes(normalizedLayerId, ['country']) || sourceLayer === 'country_label';
}

function isStateLabelLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return layerIdIncludes(normalizedLayerId, ['state', 'province', 'admin-1', 'admin1']) ||
    layerIdIncludes(sourceLayer, ['state', 'province', 'admin_1', 'admin-1']);
}

function isWaterLabelLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return layerIdIncludes(normalizedLayerId, ['water', 'ocean', 'sea', 'lake', 'marine']) ||
    layerIdIncludes(sourceLayer, ['water', 'marine']);
}

function isNaturalOrWaterLabelLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return isWaterLabelLayer(normalizedLayerId, sourceLayer) ||
    layerIdIncludes(normalizedLayerId, ['natural']) ||
    layerIdIncludes(sourceLayer, ['natural_label']);
}

function isNeighborhoodLabelLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return layerIdIncludes(normalizedLayerId, ['neighborhood', 'settlement-subdivision']) ||
    layerIdIncludes(sourceLayer, ['neighborhood', 'settlement_subdivision']);
}

function isSettlementLabelLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return layerIdIncludes(normalizedLayerId, ['place-label', 'settlement', 'city', 'town', 'village', 'hamlet']) ||
    layerIdIncludes(sourceLayer, ['place_label', 'settlement', 'city', 'town', 'village', 'hamlet']);
}

function isPoiLabelLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return /(^|[-_ ])poi($|[-_ ])/.test(normalizedLayerId) ||
    layerIdIncludes(normalizedLayerId, ['point-of-interest', 'transit', 'airport']) ||
    layerIdIncludes(sourceLayer, ['poi', 'point_of_interest', 'transit', 'airport']);
}

function isRoadLabelLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return layerIdIncludes(normalizedLayerId, [
    'road-label',
    'road-number',
    'road-shield',
    'route-number',
    'route-shield',
    'motorway-shield',
    'motorway-junction',
    'highway-label',
    'highway-shield',
  ]) ||
    layerIdIncludes(sourceLayer, ['road_label', 'road', 'motorway_junction', 'transportation_name']);
}

function isRoadShieldLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return layerIdIncludes(normalizedLayerId, [
    'road-number-shield',
    'road-shield',
    'route-number',
    'route-shield',
    'motorway-shield',
    'highway-shield',
  ]) ||
    (isRoadLabelLayer(normalizedLayerId, sourceLayer) && layerIdIncludes(normalizedLayerId, ['shield']));
}

function isRoadLineLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return sourceLayer === 'road' ||
    layerIdIncludes(normalizedLayerId, ['road', 'street', 'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'bridge', 'tunnel']);
}

function isSimpleRoadLineLayer(normalizedLayerId: string): boolean {
  return layerIdIncludes(normalizedLayerId, ['road-simple', 'bridge-simple', 'tunnel-simple']);
}

function isMajorRoadLineLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return isRoadLineLayer(normalizedLayerId, sourceLayer) &&
    layerIdIncludes(normalizedLayerId, ['motorway', 'trunk', 'primary', 'highway']);
}

function isRoadCasingLineLayer(normalizedLayerId: string): boolean {
  return layerIdIncludes(normalizedLayerId, ['case', 'casing']);
}

function getNightRoadLineColor(normalizedLayerId: string, sourceLayer: string): string {
  if (isRoadCasingLineLayer(normalizedLayerId)) {
    return 'rgb(31, 42, 51)';
  }

  if (isMajorRoadLineLayer(normalizedLayerId, sourceLayer)) {
    return 'rgb(104, 119, 130)';
  }

  if (isSimpleRoadLineLayer(normalizedLayerId)) {
    return 'rgb(70, 86, 98)';
  }

  if (layerIdIncludes(normalizedLayerId, ['secondary', 'tertiary'])) {
    return 'rgb(78, 94, 105)';
  }

  return 'rgb(57, 72, 84)';
}

function getNightRoadLineOpacity(normalizedLayerId: string, sourceLayer: string): unknown {
  if (isRoadCasingLineLayer(normalizedLayerId)) {
    return MAP_NIGHT_ROAD_CASING_OPACITY;
  }

  if (isSimpleRoadLineLayer(normalizedLayerId)) {
    return MAP_NIGHT_SIMPLE_ROAD_OPACITY;
  }

  return isMajorRoadLineLayer(normalizedLayerId, sourceLayer)
    ? MAP_NIGHT_PRIMARY_ROAD_OPACITY
    : MAP_NIGHT_LOCAL_ROAD_OPACITY;
}

function getNativeMajorRoadColor(normalizedLayerId: string): string {
  if (isRoadCasingLineLayer(normalizedLayerId)) {
    return 'rgb(247, 248, 244)';
  }

  if (layerIdIncludes(normalizedLayerId, ['motorway', 'trunk'])) {
    return 'rgb(152, 161, 160)';
  }

  if (layerIdIncludes(normalizedLayerId, ['primary'])) {
    return 'rgb(174, 181, 179)';
  }

  return 'rgb(202, 205, 200)';
}

function applyNativeMajorRoadPresentation(instance: mapboxgl.Map, layer: mapboxgl.AnyLayer, normalizedLayerId: string): void {
  setScopedMapPaintProperty(instance, layer, 'line-color', getNativeMajorRoadColor(normalizedLayerId));
  setScopedMapPaintProperty(
    instance,
    layer,
    'line-opacity',
    isRoadCasingLineLayer(normalizedLayerId) ? MAP_NATIVE_ROAD_CASING_OPACITY : MAP_NATIVE_MAJOR_ROAD_OPACITY,
  );
  setScopedMapPaintProperty(instance, layer, 'line-width', MAP_NATIVE_MAJOR_ROAD_WIDTH);
  setScopedMapPaintProperty(instance, layer, 'line-emissive-strength', 0);
}

function applyNativeSimpleRoadPresentation(instance: mapboxgl.Map, layer: mapboxgl.AnyLayer): void {
  setScopedMapPaintProperty(instance, layer, 'line-color', MAP_NATIVE_SIMPLE_ROAD_COLOR);
  setScopedMapPaintProperty(instance, layer, 'line-opacity', MAP_NATIVE_SIMPLE_ROAD_OPACITY);
  setScopedMapPaintProperty(instance, layer, 'line-width', MAP_NATIVE_SIMPLE_ROAD_WIDTH);
  setScopedMapPaintProperty(instance, layer, 'line-emissive-strength', 0);
}

function applyNativeRoadPresentation(instance: mapboxgl.Map, layer: mapboxgl.AnyLayer, normalizedLayerId: string, sourceLayer: string): void {
  if (isSimpleRoadLineLayer(normalizedLayerId)) {
    applyNativeSimpleRoadPresentation(instance, layer);
    return;
  }

  if (isMajorRoadLineLayer(normalizedLayerId, sourceLayer)) {
    applyNativeMajorRoadPresentation(instance, layer, normalizedLayerId);
    return;
  }

  setScopedMapPaintProperty(
    instance,
    layer,
    'line-color',
    isRoadCasingLineLayer(normalizedLayerId) ? MAP_NATIVE_LOCAL_ROAD_CASING_COLOR : MAP_NATIVE_LOCAL_ROAD_COLOR,
  );
  setScopedMapPaintProperty(
    instance,
    layer,
    'line-opacity',
    isRoadCasingLineLayer(normalizedLayerId) ? MAP_NATIVE_ROAD_CASING_OPACITY : MAP_NATIVE_LOCAL_ROAD_OPACITY,
  );
  setScopedMapPaintProperty(instance, layer, 'line-width', MAP_NATIVE_LOCAL_ROAD_WIDTH);
  setScopedMapPaintProperty(instance, layer, 'line-emissive-strength', 0);
}

function isCountryBoundaryLineLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return layerIdIncludes(normalizedLayerId, ['admin-0', 'admin0', 'country']) ||
    layerIdIncludes(sourceLayer, ['admin_0', 'admin-0', 'country']);
}

function isStateBoundaryLineLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return layerIdIncludes(normalizedLayerId, ['admin-1', 'admin1', 'state', 'province']) ||
    layerIdIncludes(sourceLayer, ['admin_1', 'admin-1', 'state', 'province']);
}

function applyNativeAdministrativeBoundaryPresentation(
  instance: mapboxgl.Map,
  layer: mapboxgl.AnyLayer,
  normalizedLayerId: string,
  sourceLayer: string,
): void {
  const isCountryBoundary = isCountryBoundaryLineLayer(normalizedLayerId, sourceLayer);
  const isStateBoundary = isStateBoundaryLineLayer(normalizedLayerId, sourceLayer) || !isCountryBoundary;

  setScopedMapPaintProperty(
    instance,
    layer,
    'line-color',
    isCountryBoundary ? 'rgb(94, 112, 108)' : 'rgb(146, 130, 104)',
  );
  setScopedMapPaintProperty(
    instance,
    layer,
    'line-opacity',
    isCountryBoundary ? MAP_NATIVE_ADMIN_0_BOUNDARY_OPACITY : MAP_NATIVE_ADMIN_1_BOUNDARY_OPACITY,
  );
  setScopedMapPaintProperty(
    instance,
    layer,
    'line-width',
    isCountryBoundary ? MAP_NATIVE_ADMIN_0_BOUNDARY_WIDTH : MAP_NATIVE_ADMIN_1_BOUNDARY_WIDTH,
  );
  setScopedMapPaintProperty(instance, layer, 'line-blur', 0.1);
  setScopedMapPaintProperty(instance, layer, 'line-emissive-strength', 0);

  if (isStateBoundary) {
    setScopedMapPaintProperty(instance, layer, 'line-dasharray', MAP_ADMIN_STATE_BOUNDARY_DASHARRAY);
  }
}

function applyScopeAdministrativeBoundaryPresentation(
  instance: mapboxgl.Map,
  layer: mapboxgl.AnyLayer,
  normalizedLayerId: string,
  sourceLayer: string,
): void {
  const isCountryBoundary = isCountryBoundaryLineLayer(normalizedLayerId, sourceLayer);
  const isStateBoundary = isStateBoundaryLineLayer(normalizedLayerId, sourceLayer) || !isCountryBoundary;

  setScopedMapPaintProperty(
    instance,
    layer,
    'line-color',
    isCountryBoundary ? MAP_NIGHT_ADMIN_0_BOUNDARY_COLOR : MAP_NIGHT_ADMIN_1_BOUNDARY_COLOR,
  );
  setScopedMapPaintProperty(
    instance,
    layer,
    'line-opacity',
    isCountryBoundary ? MAP_NIGHT_ADMIN_0_BOUNDARY_OPACITY : MAP_NIGHT_ADMIN_1_BOUNDARY_OPACITY,
  );
  setScopedMapPaintProperty(
    instance,
    layer,
    'line-width',
    isCountryBoundary ? MAP_NIGHT_ADMIN_0_BOUNDARY_WIDTH : MAP_NIGHT_ADMIN_1_BOUNDARY_WIDTH,
  );
  setScopedMapPaintProperty(instance, layer, 'line-blur', 0.04);
  setScopedMapPaintProperty(instance, layer, 'line-emissive-strength', 0);

  if (isStateBoundary) {
    setScopedMapPaintProperty(instance, layer, 'line-dasharray', MAP_ADMIN_STATE_BOUNDARY_DASHARRAY);
  }
}

function applyScopeRoadPresentation(instance: mapboxgl.Map, layer: mapboxgl.AnyLayer, normalizedLayerId: string, sourceLayer: string): void {
  setScopedMapPaintProperty(instance, layer, 'line-color', getNightRoadLineColor(normalizedLayerId, sourceLayer));
  setScopedMapPaintProperty(instance, layer, 'line-opacity', getNightRoadLineOpacity(normalizedLayerId, sourceLayer));
  setScopedMapPaintProperty(
    instance,
    layer,
    'line-width',
    isRoadCasingLineLayer(normalizedLayerId)
      ? MAP_NIGHT_PRIMARY_ROAD_WIDTH
      : isMajorRoadLineLayer(normalizedLayerId, sourceLayer)
        ? MAP_NIGHT_PRIMARY_ROAD_WIDTH
        : isSimpleRoadLineLayer(normalizedLayerId)
          ? MAP_NIGHT_SIMPLE_ROAD_WIDTH
          : MAP_NIGHT_LOCAL_ROAD_WIDTH,
  );
  setScopedMapPaintProperty(instance, layer, 'line-emissive-strength', 0);
}

function isAridLandFillLayer(normalizedLayerId: string): boolean {
  return layerIdIncludes(normalizedLayerId, ['sand', 'scrub', 'desert', 'bare', 'dry']);
}

function isLandcoverFillLayer(normalizedLayerId: string): boolean {
  return layerIdIncludes(normalizedLayerId, ['landcover', 'natural']);
}

function isLanduseFillLayer(normalizedLayerId: string): boolean {
  return layerIdIncludes(normalizedLayerId, ['landuse', 'land-use', 'park', 'pitch', 'school', 'airport']);
}

function applyNativeFillPresentation(instance: mapboxgl.Map, layer: mapboxgl.AnyLayer, normalizedLayerId: string): void {
  if (layer.type === 'background') {
    setScopedMapPaintProperty(
      instance,
      layer,
      'background-color',
      ['interpolate', ['linear'], ['zoom'], 0, 'rgb(214, 198, 151)', 4, 'rgb(228, 216, 178)', 8, 'rgb(241, 239, 229)'],
    );
    return;
  }

  if (layer.type !== 'fill') {
    return;
  }

  // Native mode should stay close to the detailed Mapbox Outdoors palette.
  // Dark mode owns the heavier fill overrides below.
  setScopedMapPaintProperty(instance, layer, 'fill-emissive-strength', 0);

  if (isLandcoverFillLayer(normalizedLayerId)) {
    setScopedMapPaintProperty(instance, layer, 'fill-color', MAP_NATIVE_LANDCOVER_FILL_COLOR);
    setScopedMapPaintProperty(instance, layer, 'fill-opacity', ['interpolate', ['linear'], ['zoom'], 0, 0.84, 5, 0.72, 10, 0.62]);
    return;
  }

  if (isAridLandFillLayer(normalizedLayerId)) {
    setScopedMapPaintProperty(instance, layer, 'fill-color', MAP_NATIVE_ARID_FILL_COLOR);
    setScopedMapPaintProperty(instance, layer, 'fill-opacity', ['interpolate', ['linear'], ['zoom'], 0, 0.82, 5, 0.74, 10, 0.64]);
  }
}

function applyScopeFillPresentation(instance: mapboxgl.Map, layer: mapboxgl.AnyLayer, normalizedLayerId: string): void {
  if (layer.type === 'background') {
    setScopedMapPaintProperty(instance, layer, 'background-color', MAP_SCOPE_BACKGROUND_COLOR);
    return;
  }

  if (layer.type !== 'fill') {
    return;
  }

  setScopedMapPaintProperty(instance, layer, 'fill-emissive-strength', 0);
  setScopedMapPaintProperty(instance, layer, 'fill-color-transition', MAP_SCOPE_FILL_TRANSITION);
  setScopedMapPaintProperty(instance, layer, 'fill-opacity-transition', MAP_SCOPE_FILL_TRANSITION);

  if (layerIdIncludes(normalizedLayerId, ['water'])) {
    setScopedMapPaintProperty(instance, layer, 'fill-color', MAP_SCOPE_WATER_FILL_COLOR);
    setScopedMapPaintProperty(instance, layer, 'fill-opacity', MAP_SCOPE_WATER_FILL_OPACITY);
    return;
  }

  if (isLanduseFillLayer(normalizedLayerId)) {
    setScopedMapPaintProperty(instance, layer, 'fill-color', MAP_SCOPE_LANDUSE_FILL_COLOR);
    setScopedMapPaintProperty(instance, layer, 'fill-opacity', ['interpolate', ['linear'], ['zoom'], 0, 0, 10.8, 0, 12.4, 0.2, 14.5, 0.52, 16, 0.62]);
    return;
  }

  if (isLandcoverFillLayer(normalizedLayerId)) {
    setScopedMapPaintProperty(instance, layer, 'fill-color', MAP_SCOPE_LANDCOVER_FILL_COLOR);
    setScopedMapPaintProperty(instance, layer, 'fill-opacity', ['interpolate', ['linear'], ['zoom'], 0, 0, 12.2, 0, 14, 0.08, 16, 0.14]);
    return;
  }

  if (isAridLandFillLayer(normalizedLayerId)) {
    setScopedMapPaintProperty(instance, layer, 'fill-color', MAP_SCOPE_ARID_FILL_COLOR);
    setScopedMapPaintProperty(instance, layer, 'fill-opacity', ['interpolate', ['linear'], ['zoom'], 0, 0, 11.6, 0, 13.6, 0.18, 16, 0.32]);
    return;
  }

  if (layerIdIncludes(normalizedLayerId, ['park', 'wood', 'grass', 'national', 'natural'])) {
    setScopedMapPaintProperty(instance, layer, 'fill-color', 'rgb(80, 151, 75)');
    setScopedMapPaintProperty(instance, layer, 'fill-opacity', ['interpolate', ['linear'], ['zoom'], 0, 0, 10.8, 0, 12.4, 0.22, 14.5, 0.54, 16, 0.64]);
    return;
  }

  if (layerIdIncludes(normalizedLayerId, ['building'])) {
    setScopedMapPaintProperty(instance, layer, 'fill-color', 'rgb(45, 53, 58)');
    setScopedMapPaintProperty(instance, layer, 'fill-opacity', ['interpolate', ['linear'], ['zoom'], 12, 0.32, 15, 0.5, 17, 0.68]);
    return;
  }
}

function getNaturalGlobeFog(): MapFogStyle {
  return effectiveMapPresentation.value === 'native' ? MAP_NATIVE_GLOBE_FOG : MAP_SCOPE_GLOBE_FOG;
}

function getRequestedMapProjectionName(): MapProjectionName {
  return props.showProjectionToggle ? activeMapProjectionMode.value : getDefaultMapProjectionMode();
}

function resolveMapProjectionName(instance: mapboxgl.Map): MapProjectionName {
  void instance;
  return getRequestedMapProjectionName();
}

function applyNaturalGlobeAtmosphere(instance: mapboxgl.Map): void {
  try {
    if (activeMapProjectionName !== 'globe' || typeof instance.setFog !== 'function') {
      return;
    }

    instance.setFog(getNaturalGlobeFog());
  } catch {
    // Some Mapbox style swaps briefly reject fog updates; the refresh series retries after style load.
  }
}

function setMapProjection(instance: mapboxgl.Map, projectionName: MapProjectionName): void {
  const projectedMap = instance as mapboxgl.Map & {
    setProjection?: (projection: string | { name: string }) => void;
    setRenderWorldCopies?: (renderWorldCopies: boolean) => void;
  };

  if (activeMapProjectionName !== projectionName) {
    projectedMap.setProjection?.({ name: projectionName });
    activeMapProjectionName = projectionName;
  }
  projectedMap.setRenderWorldCopies?.(projectionName !== 'globe');
}

function applyStableMapProjection(instance: mapboxgl.Map): void {
  try {
    setMapProjection(instance, resolveMapProjectionName(instance));
    applyNaturalGlobeAtmosphere(instance);
  } catch {
    // Projection is a visual enhancement; keep the map interactive if Mapbox rejects it mid-style swap.
  }
}

function applyPlannerInteractionProjection(instance = map.value): void {
  if (props.routeVariant !== 'planner' || !instance) {
    return;
  }

  clearPlannerGlobeRestoreTimer();
  applyStableMapProjection(instance);
}

function schedulePlannerGlobeRestore(instance = map.value, delayMs = MAP_PLANNER_GLOBE_RESTORE_DELAY_MS): void {
  if (props.routeVariant !== 'planner' || !instance) {
    return;
  }

  clearPlannerGlobeRestoreTimer();
  const targetProjection = resolveMapProjectionName(instance);
  if (targetProjection !== 'globe') {
    try {
      setMapProjection(instance, targetProjection);
    } catch {
      // Projection changes are opportunistic; never interrupt map interaction.
    }
    return;
  }

  plannerGlobeRestoreTimer = setTimeout(() => {
    plannerGlobeRestoreTimer = null;
    if (!map.value || map.value !== instance || isMapCameraMoving.value || locationCameraAnimationFrameHandle !== null) {
      return;
    }

    const restoredProjection = resolveMapProjectionName(instance);
    if (activeMapProjectionName === restoredProjection) {
      applyNaturalGlobeAtmosphere(instance);
      return;
    }

    applyStableMapProjection(instance);
  }, delayMs);
}

function ensurePoiFallbackIcon(instance: mapboxgl.Map): void {
  if (typeof document === 'undefined') {
    return;
  }

  const mapWithImages = instance as mapboxgl.Map & {
    addImage?: (id: string, image: HTMLCanvasElement, options?: { pixelRatio?: number }) => void;
    hasImage?: (id: string) => boolean;
  };

  try {
    if (mapWithImages.hasImage?.(MAP_POI_FALLBACK_ICON_IMAGE)) {
      return;
    }

    const pixelRatio = 2;
    const canvas = document.createElement('canvas');
    canvas.width = 30 * pixelRatio;
    canvas.height = 30 * pixelRatio;
    const context = canvas.getContext('2d');
    if (!context || typeof mapWithImages.addImage !== 'function') {
      return;
    }

    context.scale(pixelRatio, pixelRatio);
    context.shadowColor = 'rgba(5, 10, 14, 0.38)';
    context.shadowBlur = 4;
    context.beginPath();
    context.arc(15, 15, 7.25, 0, Math.PI * 2);
    context.fillStyle = 'rgb(25, 199, 167)';
    context.fill();
    context.shadowBlur = 0;
    context.lineWidth = 2.4;
    context.strokeStyle = 'rgb(7, 16, 20)';
    context.stroke();
    context.beginPath();
    context.arc(15, 15, 2.6, 0, Math.PI * 2);
    context.fillStyle = 'rgb(230, 255, 249)';
    context.fill();

    mapWithImages.addImage(MAP_POI_FALLBACK_ICON_IMAGE, canvas, { pixelRatio });
  } catch {
    // The native Mapbox sprite still works if our generic fallback icon cannot be registered.
  }
}

function applyScopeSolidSymbolTextPresentation(instance: mapboxgl.Map, layer: mapboxgl.AnyLayer, normalizedLayerId: string, sourceLayer: string): void {
  const isRoadLabel = isRoadLabelLayer(normalizedLayerId, sourceLayer);
  const isWaterLabel = isWaterLabelLayer(normalizedLayerId, sourceLayer);
  setScopedMapPaintProperty(instance, layer, 'text-color', isWaterLabel ? 'rgb(151, 211, 232)' : 'rgb(255, 255, 255)');
  setScopedMapPaintProperty(instance, layer, 'text-opacity', MAP_SCOPE_SOLID_LABEL_OPACITY);
  setScopedMapPaintProperty(instance, layer, 'text-halo-color', 'rgb(4, 9, 13)');
  setScopedMapPaintProperty(instance, layer, 'text-halo-width', isRoadLabel ? 0.78 : 0.68);
  setScopedMapPaintProperty(instance, layer, 'text-halo-blur', 0);
}

function applyScopeFinalSymbolTextPresentation(instance: mapboxgl.Map): void {
  const layers = instance.getStyle().layers ?? [];

  layers.forEach((layer) => {
    if (layer.type !== 'symbol') {
      return;
    }

    const layerId = String(layer.id ?? '');
    if (!layerId || isScopeTrafficLayerId(layerId) || isScopeRoadContextLayerId(layerId)) {
      return;
    }

    const textField = getMapLayoutProperty(instance, layerId, 'text-field');
    if (textField == null || getMapLayoutProperty(instance, layerId, 'visibility') === 'none') {
      return;
    }

    applyScopeSolidSymbolTextPresentation(instance, layer, layerId.toLowerCase(), getLayerSourceLayer(layer));
  });
}

function restoreMapSymbolLabelVisibility(instance: mapboxgl.Map, layerId: string): void {
  safelySetMapLayoutProperty(instance, layerId, 'visibility', 'visible');
}

function applyStateNameLabelPresentation(instance: mapboxgl.Map, layerId: string, labelMode: MapLabelMode): void {
  if (shouldHideNativeStateNameLabels(labelMode)) {
    safelySetMapLayoutProperty(instance, layerId, 'visibility', 'none');
    return;
  }

  const isStatesMode = labelMode === 'states';
  safelySetMapLayoutProperty(instance, layerId, 'visibility', 'visible');
  safelySetMapLayerZoomRange(
    instance,
    layerId,
    isStatesMode ? MAP_GLOBAL_REGION_LABEL_MIN_ZOOM : MAP_STATE_NAME_LABEL_MIN_ZOOM,
    24,
  );
  safelySetMapLayoutProperty(
    instance,
    layerId,
    'text-field',
    isStatesMode ? MAP_GLOBAL_REGION_LABEL_TEXT_FIELD_BY_ZOOM : MAP_STATE_NAME_LABEL_TEXT_FIELD_BY_ZOOM,
  );
  safelySetMapLayoutProperty(instance, layerId, 'text-max-width', isStatesMode ? 7 : 8);
  safelySetMapPaintProperty(instance, layerId, 'text-opacity', isStatesMode ? MAP_GLOBAL_REGION_LABEL_OPACITY : MAP_STATE_NAME_LABEL_OPACITY);
}

function applyCountryLabelPresentation(instance: mapboxgl.Map, layer: mapboxgl.AnyLayer, layerId: string): void {
  safelySetMapLayerZoomRange(instance, layerId, 0, MAP_COUNTRY_LABEL_MAX_ZOOM);
  setScopedMapPaintProperty(instance, layer, 'text-opacity', MAP_COUNTRY_LABEL_OPACITY);
}

function applyContextLabelPresentation(
  instance: mapboxgl.Map,
  layer: mapboxgl.AnyLayer,
  layerId: string,
  normalizedLayerId = '',
  sourceLayer = '',
): void {
  const isWaterLabel = isWaterLabelLayer(normalizedLayerId, sourceLayer);
  safelySetMapLayerZoomRange(instance, layerId, isWaterLabel ? MAP_WATER_LABEL_MIN_ZOOM : MAP_CONTEXT_LABEL_MIN_ZOOM, 24);
  const isScopePresentation = effectiveMapPresentation.value === 'scope';
  const isRoadLabel = isRoadLabelLayer(normalizedLayerId, sourceLayer);
  setScopedMapPaintProperty(
    instance,
    layer,
    'text-opacity',
    isWaterLabel
      ? MAP_WATER_LABEL_OPACITY
      : (isScopePresentation ? MAP_SCOPE_SOLID_LABEL_OPACITY : MAP_CONTEXT_LABEL_OPACITY),
  );

  if (isWaterLabel) {
    setScopedMapPaintProperty(instance, layer, 'text-color', isScopePresentation ? 'rgb(151, 211, 232)' : 'rgb(50, 111, 140)');
    setScopedMapPaintProperty(instance, layer, 'text-halo-color', isScopePresentation ? 'rgb(5, 10, 14)' : 'rgb(236, 247, 242)');
    setScopedMapPaintProperty(instance, layer, 'text-halo-width', isScopePresentation ? 0.72 : 1.05);
    setScopedMapPaintProperty(instance, layer, 'text-halo-blur', isScopePresentation ? 0 : 0.25);
    return;
  }

  if (!isScopePresentation) {
    return;
  }

  setScopedMapPaintProperty(instance, layer, 'text-color', isRoadLabel ? 'rgb(255, 255, 255)' : 'rgb(248, 250, 252)');
  setScopedMapPaintProperty(instance, layer, 'text-halo-color', 'rgb(5, 10, 14)');
  setScopedMapPaintProperty(instance, layer, 'text-halo-width', isRoadLabel ? 0.78 : 0.62);
  setScopedMapPaintProperty(instance, layer, 'text-halo-blur', 0);
}

function applyRoadShieldPresentation(instance: mapboxgl.Map, layerId: string): void {
  safelySetMapLayoutProperty(instance, layerId, 'visibility', 'visible');
  safelySetMapLayerZoomRange(instance, layerId, 6.4, 24);
  safelySetMapLayoutProperty(instance, layerId, 'icon-size', MAP_ROAD_SHIELD_ICON_SIZE);
  safelySetMapLayoutProperty(instance, layerId, 'text-size', MAP_ROAD_SHIELD_TEXT_SIZE);
  safelySetMapLayoutProperty(instance, layerId, 'symbol-spacing', MAP_ROAD_SHIELD_SPACING);
  safelySetMapPaintProperty(instance, layerId, 'icon-opacity', ['interpolate', ['linear'], ['zoom'], 6.4, 0.22, 7.4, 0.56, 8.8, 0.8, 11, 0.94]);
  safelySetMapPaintProperty(instance, layerId, 'text-opacity', ['interpolate', ['linear'], ['zoom'], 6.4, 0.24, 7.4, 0.6, 8.8, 0.84, 11, 0.96]);
  if (effectiveMapPresentation.value === 'scope') {
    safelySetMapPaintProperty(instance, layerId, 'text-color', 'rgb(255, 255, 255)');
    safelySetMapPaintProperty(instance, layerId, 'text-opacity', 1);
    safelySetMapPaintProperty(instance, layerId, 'text-halo-color', 'rgb(5, 10, 14)');
    safelySetMapPaintProperty(instance, layerId, 'text-halo-width', 0.82);
    safelySetMapPaintProperty(instance, layerId, 'text-halo-blur', 0);
  }
}

function applyStatesModeContextSymbolPresentation(
  instance: mapboxgl.Map,
  layer: mapboxgl.AnyLayer,
  layerId: string,
  minzoom: number,
): void {
  safelySetMapLayoutProperty(instance, layerId, 'visibility', 'visible');
  safelySetMapLayerZoomRange(instance, layerId, minzoom, 24);
  setScopedMapPaintProperty(
    instance,
    layer,
    'text-opacity',
    ['interpolate', ['linear'], ['zoom'], Math.max(0, minzoom - 0.35), 0, minzoom + 0.55, 0.58, minzoom + 3, 0.84],
  );
  setScopedMapPaintProperty(
    instance,
    layer,
    'icon-opacity',
    ['interpolate', ['linear'], ['zoom'], Math.max(0, minzoom - 0.25), 0, minzoom + 0.55, 0.68, minzoom + 3, 0.9],
  );
}

function applyStatesModeSymbolPresentation(
  instance: mapboxgl.Map,
  layer: mapboxgl.AnyLayer,
  layerId: string,
  normalizedLayerId: string,
  sourceLayer: string,
): boolean {
  if (isCountryLabelLayer(normalizedLayerId, sourceLayer)) {
    safelySetMapLayoutProperty(instance, layerId, 'visibility', 'visible');
    safelySetMapLayerZoomRange(instance, layerId, 0, 4.55);
    setScopedMapPaintProperty(instance, layer, 'text-opacity', ['interpolate', ['linear'], ['zoom'], 1, 0.62, 3.35, 0.58, 4.55, 0]);
    return true;
  }

  if (isStateLabelLayer(normalizedLayerId, sourceLayer)) {
    applyStateNameLabelPresentation(instance, layerId, 'states');
    return true;
  }

  if (isRoadShieldLayer(normalizedLayerId, sourceLayer)) {
    applyRoadShieldPresentation(instance, layerId);
    return true;
  }

  if (isRoadLabelLayer(normalizedLayerId, sourceLayer)) {
    applyStatesModeContextSymbolPresentation(instance, layer, layerId, MAP_STATES_MODE_ROAD_LABEL_MIN_ZOOM);
    return true;
  }

  if (isWaterLabelLayer(normalizedLayerId, sourceLayer)) {
    const waterLabelMinZoom = getWaterLabelMinZoom('states');
    applyStatesModeContextSymbolPresentation(instance, layer, layerId, waterLabelMinZoom);
    safelySetMapLayoutProperty(instance, layerId, 'text-allow-overlap', false);
    safelySetMapLayoutProperty(instance, layerId, 'text-ignore-placement', false);
    safelySetMapLayoutProperty(instance, layerId, 'text-optional', true);
    setScopedMapPaintProperty(instance, layer, 'text-opacity', getWaterLabelOpacity('states'));
    setScopedMapPaintProperty(instance, layer, 'text-color', effectiveMapPresentation.value === 'scope' ? 'rgb(151, 211, 232)' : 'rgb(50, 111, 140)');
    setScopedMapPaintProperty(instance, layer, 'text-halo-color', effectiveMapPresentation.value === 'scope' ? 'rgb(5, 10, 14)' : 'rgb(236, 247, 242)');
    setScopedMapPaintProperty(instance, layer, 'text-halo-width', effectiveMapPresentation.value === 'scope' ? 0.72 : 1.05);
    return true;
  }

  if (isPoiLabelLayer(normalizedLayerId, sourceLayer)) {
    applyPoiSymbolPresentation(instance, layer, layerId);
    return true;
  }

  if (
    isSettlementLabelLayer(normalizedLayerId, sourceLayer) ||
    isNeighborhoodLabelLayer(normalizedLayerId, sourceLayer) ||
    isNaturalOrWaterLabelLayer(normalizedLayerId, sourceLayer)
  ) {
    applyStatesModeContextSymbolPresentation(instance, layer, layerId, MAP_STATES_MODE_CONTEXT_LABEL_MIN_ZOOM);
    return true;
  }

  applyStatesModeContextSymbolPresentation(instance, layer, layerId, MAP_STATES_MODE_CONTEXT_LABEL_MIN_ZOOM);
  return true;
}

function isAdministrativeBoundaryLineLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return layerIdIncludes(normalizedLayerId, ['admin', 'boundary', 'state', 'province']) ||
    layerIdIncludes(sourceLayer, ['admin', 'boundary', 'state', 'province']);
}

function getPoiLabelMinZoom(): number {
  return props.showPlaceLabels ? MAP_POI_LABEL_MIN_ZOOM : MAP_SUBTLE_POI_LABEL_MIN_ZOOM;
}

function getPoiIconOpacity(): unknown {
  return props.showPlaceLabels ? MAP_POI_ICON_OPACITY : MAP_SUBTLE_POI_ICON_OPACITY;
}

function getPoiSymbolIconOpacity(): unknown {
  return [
    'case',
    ['match', ['coalesce', ['get', 'maki'], ['get', 'icon'], ['get', 'type'], ''], MAP_MUTED_POI_ICON_NAMES, true, false],
    MAP_MUTED_POI_ICON_OPACITY,
    getPoiIconOpacity(),
  ];
}

function getPoiLabelOpacity(): unknown {
  return props.showPlaceLabels ? MAP_POI_LABEL_OPACITY : MAP_SUBTLE_POI_LABEL_OPACITY;
}

function applyPoiSymbolPresentation(instance: mapboxgl.Map, layer: mapboxgl.AnyLayer, layerId: string): void {
  const originalIconImage = getLayerLayoutProperty(layer, 'icon-image');
  safelySetMapLayoutProperty(instance, layerId, 'visibility', 'visible');
  safelySetMapLayerZoomRange(instance, layerId, getPoiLabelMinZoom(), 24);
  safelySetMapLayoutProperty(
    instance,
    layerId,
    'icon-image',
    hasLayerLayoutValue(originalIconImage) ? originalIconImage : MAP_POI_FALLBACK_ICON_IMAGE,
  );
  safelySetMapLayoutProperty(instance, layerId, 'icon-size', MAP_POI_ICON_SIZE);
  safelySetMapLayoutProperty(instance, layerId, 'icon-optional', false);
  safelySetMapLayoutProperty(instance, layerId, 'icon-allow-overlap', true);
  safelySetMapLayoutProperty(instance, layerId, 'icon-ignore-placement', true);
  safelySetMapLayoutProperty(instance, layerId, 'text-optional', true);
  const originalIconColor = getLayerPaintProperty(layer, 'icon-color');
  if (effectiveMapPresentation.value === 'scope') {
    setScopedMapPaintProperty(instance, layer, 'icon-color', [
      'case',
      ['match', ['coalesce', ['get', 'maki'], ['get', 'icon'], ['get', 'type'], ''], MAP_MUTED_POI_ICON_NAMES, true, false],
      'rgb(118, 136, 148)',
      'rgb(134, 226, 206)',
    ]);
    setScopedMapPaintProperty(instance, layer, 'icon-halo-color', 'rgb(7, 12, 16)');
    setScopedMapPaintProperty(instance, layer, 'icon-halo-width', 0.5);
    setScopedMapPaintProperty(instance, layer, 'icon-halo-blur', 0.35);
    applyScopeSolidSymbolTextPresentation(instance, layer, layerId.toLowerCase(), getLayerSourceLayer(layer));
  } else if (originalIconColor !== null) {
    safelySetMapPaintProperty(instance, layerId, 'icon-color', originalIconColor);
  }
  setScopedMapPaintProperty(instance, layer, 'icon-opacity', getPoiSymbolIconOpacity());
  setScopedMapPaintProperty(
    instance,
    layer,
    'text-opacity',
    effectiveMapPresentation.value === 'scope' ? MAP_SCOPE_SOLID_LABEL_OPACITY : getPoiLabelOpacity(),
  );
}

function applyNativeMapStylePresentation(instance: mapboxgl.Map): void {
  try {
    removeScopeRoadContextLayers(instance);
    syncMapTrafficLayers(instance);
    syncReferenceLabelLayers(instance);
    syncWaterReferenceLabelLayer(instance);

    const labelMode = props.labelMode ?? 'full';
    const layers = instance.getStyle().layers ?? [];

    layers.forEach((layer) => {
      const layerId = String(layer.id ?? '');
      const normalizedLayerId = layerId.toLowerCase();
      const sourceLayer = getLayerSourceLayer(layer);

      if (!layerId) {
        return;
      }

      if ((MAP_TERRAIN_LAYER_IDS as readonly string[]).includes(layerId) || isScopeTrafficLayerId(layerId) || isScopeRoadContextLayerId(layerId)) {
        return;
      }

      applyMapPresentationLayerTransition(instance, layer);

      if (layer.type === 'line') {
        if (isAdministrativeBoundaryLineLayer(normalizedLayerId, sourceLayer)) {
          applyNativeAdministrativeBoundaryPresentation(instance, layer, normalizedLayerId, sourceLayer);
          return;
        }

        if (isRoadLineLayer(normalizedLayerId, sourceLayer)) {
          applyNativeRoadPresentation(instance, layer, normalizedLayerId, sourceLayer);
        }
        return;
      }

      if (layer.type === 'background' || layer.type === 'fill') {
        applyNativeFillPresentation(instance, layer, normalizedLayerId);
        return;
      }

      if (layer.type !== 'symbol') {
        return;
      }

      if (layerId === SCOPE_US_STATE_LABEL_LAYER_ID || layerId === SCOPE_US_STATE_NAME_LABEL_LAYER_ID) {
        return;
      }

      if (labelMode === 'none') {
        safelySetMapLayoutProperty(instance, layerId, 'visibility', 'none');
        return;
      }

      restoreMapSymbolLabelVisibility(instance, layerId);

      if (labelMode === 'states' && applyStatesModeSymbolPresentation(instance, layer, layerId, normalizedLayerId, sourceLayer)) {
        return;
      }

      if (isPoiLabelLayer(normalizedLayerId, sourceLayer)) {
        applyPoiSymbolPresentation(instance, layer, layerId);
        return;
      }

      if (isRoadShieldLayer(normalizedLayerId, sourceLayer)) {
        applyRoadShieldPresentation(instance, layerId);
        return;
      }

      if (isCountryLabelLayer(normalizedLayerId, sourceLayer)) {
        applyCountryLabelPresentation(instance, layer, layerId);
        return;
      }

      if (isStateLabelLayer(normalizedLayerId, sourceLayer)) {
        applyStateNameLabelPresentation(instance, layerId, labelMode);
        return;
      }

      if (
        isRoadLabelLayer(normalizedLayerId, sourceLayer) ||
        isSettlementLabelLayer(normalizedLayerId, sourceLayer) ||
        isNeighborhoodLabelLayer(normalizedLayerId, sourceLayer) ||
        isNaturalOrWaterLabelLayer(normalizedLayerId, sourceLayer)
      ) {
        applyContextLabelPresentation(instance, layer, layerId, normalizedLayerId, sourceLayer);
      }
    });
  } catch {
    // If the style is still swapping, the next style.load/load pass will try again.
  }
}

function applyMapStylePresentation(): void {
  const instance = map.value;
  if (!instance || !interactiveMapEnabled.value) {
    return;
  }

  applyStableMapProjection(instance);
  ensurePoiFallbackIcon(instance);
  removeMapTerrainLayers(instance);
  prepareScopedMapPresentation(instance, effectiveMapPresentation.value);

  if (effectiveMapPresentation.value === 'native') {
    applyNativeMapStylePresentation(instance);
    return;
  }

  try {
    syncScopeRoadContextLayers(instance);
    syncMapTrafficLayers(instance);
    syncReferenceLabelLayers(instance);
    syncWaterReferenceLabelLayer(instance);

    const labelMode = props.labelMode ?? 'full';
    const layers = instance.getStyle().layers ?? [];

    layers.forEach((layer) => {
      const layerId = String(layer.id ?? '');
      const normalizedLayerId = layerId.toLowerCase();
      const sourceLayer = getLayerSourceLayer(layer);
      if (!layerId) {
        return;
      }

      if (isScopeTrafficLayerId(layerId) || isScopeRoadContextLayerId(layerId)) {
        return;
      }

      if ((MAP_TERRAIN_LAYER_IDS as readonly string[]).includes(layerId)) {
        return;
      }

      applyMapPresentationLayerTransition(instance, layer);

      if (layer.type === 'line') {
        if (isAdministrativeBoundaryLineLayer(normalizedLayerId, sourceLayer)) {
          applyScopeAdministrativeBoundaryPresentation(instance, layer, normalizedLayerId, sourceLayer);
          return;
        }

        if (isRoadLineLayer(normalizedLayerId, sourceLayer)) {
          applyScopeRoadPresentation(instance, layer, normalizedLayerId, sourceLayer);
        }
        return;
      }

      if (layer.type === 'background' || layer.type === 'fill') {
        applyScopeFillPresentation(instance, layer, normalizedLayerId);
        return;
      }

      if (layerId === SCOPE_US_STATE_LABEL_LAYER_ID || layerId === SCOPE_US_STATE_NAME_LABEL_LAYER_ID) {
        return;
      }

      if (layer.type !== 'symbol') {
        return;
      }

      if (labelMode === 'none') {
        safelySetMapLayoutProperty(instance, layerId, 'visibility', 'none');
        return;
      }

      restoreMapSymbolLabelVisibility(instance, layerId);
      applyScopeSolidSymbolTextPresentation(instance, layer, normalizedLayerId, sourceLayer);

      if (labelMode === 'states' && applyStatesModeSymbolPresentation(instance, layer, layerId, normalizedLayerId, sourceLayer)) {
        return;
      }

      if (isPoiLabelLayer(normalizedLayerId, sourceLayer)) {
        applyPoiSymbolPresentation(instance, layer, layerId);
        return;
      }

      if (isRoadShieldLayer(normalizedLayerId, sourceLayer)) {
        applyRoadShieldPresentation(instance, layerId);
        return;
      }

      if (isCountryLabelLayer(normalizedLayerId, sourceLayer)) {
        applyCountryLabelPresentation(instance, layer, layerId);
        return;
      }

      if (isStateLabelLayer(normalizedLayerId, sourceLayer)) {
        applyStateNameLabelPresentation(instance, layerId, labelMode);
        return;
      }

      if (
        isRoadLabelLayer(normalizedLayerId, sourceLayer) ||
        isSettlementLabelLayer(normalizedLayerId, sourceLayer) ||
        isNeighborhoodLabelLayer(normalizedLayerId, sourceLayer) ||
        isNaturalOrWaterLabelLayer(normalizedLayerId, sourceLayer)
      ) {
        applyContextLabelPresentation(instance, layer, layerId, normalizedLayerId, sourceLayer);
      }
    });

    applyScopeFinalSymbolTextPresentation(instance);
  } catch {
    // If the style is still swapping, the next style.load/load pass will try again.
  }
}

function markInitialMapRenderReady(instance: mapboxgl.Map): void {
  if (hasMapCompletedInitialIdle) {
    return;
  }

  revealPlannerMapCanvas(instance);
  hasMapCompletedInitialIdle = true;
  setTripsMapDebugFlag('__tripsMapIdle');
  finishMapStyleTransitionWhenPresentationReady(instance, mapStyleSwapVersion);
  flushPendingInitialAutoLocateFocus();
}

function recoverMissedInitialMapIdle(instance: mapboxgl.Map): boolean {
  if (hasMapCompletedInitialIdle || map.value !== instance) {
    return hasMapCompletedInitialIdle;
  }

  let loaded = false;
  try {
    loaded = instance.loaded();
  } catch {
    loaded = false;
  }

  const canvasPresented = Boolean(instance.getCanvas?.().classList.contains('loaded'));
  if (!loaded && !canvasPresented && !isMapRenderVisuallyReady(instance)) {
    return false;
  }

  markInitialMapRenderReady(instance);
  if (flushPendingLocationCamera()) {
    scheduleVisibleMapFeaturePlacePhotoPrefetch(320);
  }
  return true;
}

function scheduleInitialMapIdleFallback(instance: mapboxgl.Map, attempt = 0): void {
  const delayMs = attempt === 0 ? 80 : Math.min(1200, 160 * 2 ** Math.min(attempt, 3));
  setTimeout(() => {
    if (recoverMissedInitialMapIdle(instance) || attempt >= 6 || map.value !== instance) {
      return;
    }

    scheduleInitialMapIdleFallback(instance, attempt + 1);
  }, delayMs);
}

async function setupMap() {
  if (!mapContainer.value || !interactiveMapEnabled.value || map.value) {
    updateVisibleSpotIds();
    return;
  }

  clearPlannerMapPreloadSurfaceTimer();
  clearPlannerMapCanvasPreviewFrame();
  isPlannerMapCanvasRevealed.value = false;
  isPlannerMapCanvasPreviewing.value = props.routeVariant === 'planner';
  isPlannerMapCanvasRevealing.value = false;

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

  mapStyle.value = resolveRequestedMapStyle();
  mapStore.setStyle(mapStyle.value);
  hasMapCompletedInitialIdle = false;
  hasCompletedUserLocationFlight = false;
  activeMapProjectionName = null;
  startMapStyleTransition();
  flashPlannerMapDim(MAP_PLANNER_INITIAL_DIM_FLASH_MS);
  const tileResourceProfile = getMapTileResourceProfile();
  const initialProjectionName = getRequestedMapProjectionName();

  let instance;
  try {
    instance = new runtime.Map({
      container: mapContainer.value,
      style: mapStyle.value,
      center: mapStore.viewport.center,
      zoom: mapStore.viewport.zoom,
      projection: initialProjectionName,
      attributionControl: false,
      antialias: false,
      collectResourceTiming: false,
      fadeDuration: props.routeVariant === 'planner' ? MAP_PLANNER_TILE_FADE_DURATION_MS : MAP_SYMBOL_FADE_DURATION_MS,
      localIdeographFontFamily: 'system-ui, sans-serif',
      maxTileCacheSize: tileResourceProfile.maxTileCacheSize,
      minTileCacheSize: tileResourceProfile.minTileCacheSize,
      performanceMetricsCollection: false,
      precompilePrograms: props.routeVariant === 'planner',
      prefetchZoomDelta: tileResourceProfile.prefetchZoomDelta,
      refreshExpiredTiles: false,
      renderWorldCopies: initialProjectionName !== 'globe',
      scrollZoom: props.routeVariant === 'planner' ? { around: 'center' } : true,
      trackResize: false,
    });
  } catch (error) {
    console.warn('[scope-map] Mapbox initialization failed; rendering fallback.', error);
    markMapRuntimeFailed();
    updateVisibleSpotIds();
    return;
  }

  configurePlannerMapGestureSmoothness(instance);
  applyStableMapProjection(instance);
  attachMapCanvasClickCapture(instance);
  schedulePlannerMapCanvasPreview(instance);
  schedulePlannerMapCanvasRevealFallback(instance);
  instance.on('error', (event: { sourceId?: string; error?: { status?: number; message?: string } }) => {
    const status = event?.error?.status;
    const message = event?.error?.message ?? '';
    const isAuthError = status === 401 || status === 403 || /access token|unauthor/i.test(message);
    const isTrafficError =
      event?.sourceId === MAP_TRAFFIC_SOURCE_ID ||
      /mapbox\.mapbox-traffic-v1|mapbox-traffic-v1|scope-mapbox-traffic/i.test(message);
    if (isTrafficError) {
      mapTrafficUnavailable = true;
      console.warn('[scope-map] Mapbox traffic unavailable; continuing without the traffic overlay.', event?.error);
      removeMapTrafficLayers(instance);
      return;
    }

    if (isAuthError) {
      console.warn('[scope-map] Mapbox auth/tile error; falling back to static view.', event?.error);
      try {
        instance?.remove();
      } catch {
        // ignore
      }
      map.value = null;
      exposeMapInstanceForUiTests(null);
      markMapRuntimeFailed();
      updateVisibleSpotIds();
    }
  });

  instance.on('click', (event) => {
    if (props.clickToSelect) {
      emit('interaction', { type: 'map_click' });
      emit('map-click', {
        latitude: Number(event.lngLat.lat.toFixed(6)),
        longitude: Number(event.lngLat.lng.toFixed(6)),
      });
      return;
    }

    handleRenderedMapFeatureClick(event);
  });

  instance.on('load', () => {
    setTripsMapDebugFlag('__tripsMapLoaded');
    previewPlannerMapCanvas(instance);
    schedulePlannerMapCanvasLoadReveal(instance);
    if (props.routeVariant !== 'planner' || hasMapCompletedInitialIdle) {
      openMapRenderGate(MAP_RENDER_GATE_TIMEOUT_MS);
    }
    startMapTileSettling();
    scheduleMapPostStyleResizeSeries(instance);
    scheduleMapRenderHealthCheckSeries(instance);
    scheduleMapStylePresentationRefreshSeries();
    scheduleMarkerRender();
    syncNearbyPlaceMarkers();
    scheduleNearbyPlacesRefresh();
    scheduleVisibleMapFeaturePlacePhotoPrefetch(180);
    void requestInitialUserLocation();
    void primeLocationTrackerWhenPermissionGranted();
    updateLiveRouteOverlay();
  });
  instance.once('idle', () => {
    revealPlannerMapCanvas(instance);
    hasMapCompletedInitialIdle = true;
    finishMapStyleTransitionWhenPresentationReady(instance, mapStyleSwapVersion);
    flushPendingInitialAutoLocateFocus();
    scheduleVisibleMapFeaturePlacePhotoPrefetch(120);
  });
  instance.on('style.load', () => {
    if (props.routeVariant !== 'planner' || hasMapCompletedInitialIdle) {
      openMapRenderGate(MAP_RENDER_GATE_TIMEOUT_MS);
    }
    startMapTileSettling();
    applyStableMapProjection(instance);
    refreshMapStylePresentationSurfaces();
    scheduleVisibleMapFeaturePlacePhotoPrefetch();
  });
  instance.on('styledata', scheduleMapStylePresentationRefresh);
  if (props.routeVariant !== 'planner') {
    instance.on('mousemove', createThrottledMapMouseHandler(handleRenderedMapFeatureHover, MAP_POINTER_HANDLER_THROTTLE_MS));
  }
  instance.on('movestart', beginMapCameraInteraction);
  instance.on('move', () => scheduleLiveRouteOverlayUpdate());
  instance.on('zoom', closeMapFeaturePlacePopupIfZoomTooLow);
  instance.on('moveend', () => {
    syncViewportFromMap();
    closeMapFeaturePlacePopupIfImprecise();
    finishMapCameraInteraction();
    scheduleMarkerRender();
    scheduleNearbyPlacesRefresh();
    scheduleVisibleMapFeaturePlacePhotoPrefetch();
  });
  instance.on('idle', () => {
    setTripsMapDebugFlag('__tripsMapIdle');
    hasMapCompletedInitialIdle = true;
    if (flushPendingInitialAutoLocateFocus()) {
      scheduleVisibleMapFeaturePlacePhotoPrefetch(320);
      return;
    }
    if (flushPendingLocationCamera()) {
      scheduleVisibleMapFeaturePlacePhotoPrefetch(320);
      return;
    }
    void settleMapRenderAfterIdle(instance);
    finishMapCameraInteraction();
    scheduleMarkerRender();
    scheduleVisibleMapFeaturePlacePhotoPrefetch(120);
  });

  map.value = instance;
  exposeMapInstanceForUiTests(instance);
  syncUserLocationMarker();
  updateLiveRouteOverlay();
  scheduleInitialMapIdleFallback(instance);
  queueMicrotaskSafe(() => {
    void requestInitialUserLocation();
    void primeLocationTrackerWhenPermissionGranted();
  });
  nextTick(() => {
    scheduleMapResize(instance);
    scheduleMapRenderHealthCheckSeries(instance);
  });
}

watch(
  mapWeatherLookupKey,
  () => {
    scheduleMapWeatherRefresh();
  },
  { immediate: true },
);

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
    if (props.routePoints.filter(hasValidCoordinates).length < 2) {
      liveRouteOverlayPath.value = '';
      autoRoadRoute.value = null;
    }

    nextTick(scheduleLiveRouteOverlayUpdate);
  },
  { immediate: true },
);

watch(
  () => [props.showPlaceLabels, props.labelMode, props.showTraffic] as const,
  () => {
    nextTick(applyMapStylePresentation);
  },
);

watch(
  () => [props.showProjectionToggle, props.routeVariant] as const,
  () => {
    if (!props.showProjectionToggle) {
      activeMapProjectionMode.value = getDefaultMapProjectionMode();
    }

    const instance = map.value;
    if (instance && interactiveMapEnabled.value) {
      applyStableMapProjection(instance);
      scheduleMapPostStyleResizeSeries(instance);
      refreshMapStylePresentationSurfaces();
    }
  },
);

watch(
  () => [props.showNearbyPlaces, props.autoSearchNearbyPlaces] as const,
  ([showNearbyPlaces, autoSearchNearbyPlaces]) => {
    if (!showNearbyPlaces) {
      nearbyPlacesViewportSignature = '';
      nearbyPlacesRequestId.value += 1;
      nearbyViewportPlacePins.value = [];
      clearNearbyPlacesRefreshTimer();
      if (mapFeaturePlacePins.value.length) {
        nextTick(syncNearbyPlaceMarkers);
      } else {
        clearNearbyPlaceMarkers();
      }
      return;
    }

    if (!autoSearchNearbyPlaces) {
      nearbyPlacesViewportSignature = '';
      nearbyPlacesRequestId.value += 1;
      nearbyViewportPlacePins.value = [];
      clearNearbyPlacesRefreshTimer();
      nextTick(syncNearbyPlaceMarkers);
      return;
    }

    nextTick(scheduleNearbyPlacesRefresh);
  },
);

watch(
  () => props.nearbyPlacePins.map((pin) => [
    pin.id,
    pin.title,
    pin.latitude.toFixed(5),
    pin.longitude.toFixed(5),
    pin.kind,
    pin.iconName ?? '',
    pin.priceLabel ?? '',
    pin.distanceLabel ?? '',
    pin.photoUrl ?? '',
    pin.photoAttribution ?? '',
    pin.photoAttributionUrl ?? '',
  ].join(':')).join('|'),
  () => {
    nextTick(syncNearbyPlaceMarkers);
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
  () => markerSpots.value.map(buildMapPointRenderKey),
  () => {
    if (selectedSpotId.value && !markerSpots.value.some((spot) => spot.id === selectedSpotId.value)) {
      mapStore.setSelectedSpotId(null);
    }

    nextTick(() => {
      scheduleMarkerRender();
    });
  },
  { immediate: true },
);

watch(
  () => selectedSpotId.value,
  (nextSelectedSpotId) => {
    if (!nextSelectedSpotId) {
      scheduleMarkerRender();
      return;
    }

    scheduleMarkerRender();
  },
);

watch(
  () => [mapStore.viewport.center[0], mapStore.viewport.center[1], mapStore.viewport.zoom] as const,
  ([longitude, latitude, zoom]) => {
    const instance = map.value;
    if (!instance || syncingViewport || Date.now() < suppressViewportCameraSyncUntil || !interactiveMapEnabled.value) {
      return;
    }

    const center = instance.getCenter();
    const zoomDistance = Math.abs(instance.getZoom() - zoom);
    const longitudeDistance = Math.abs(center.lng - longitude);
    const latitudeDistance = Math.abs(center.lat - latitude);

    if (zoomDistance > 0.05 || longitudeDistance > 0.0001 || latitudeDistance > 0.0001) {
      startMapTileSettling();
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
    markerSpots.value.map(buildMapPointRenderKey).join('|'),
  ] as const,
  () => {
    if (!map.value || !interactiveMapEnabled.value) {
      return;
    }

    if (!props.autoFitRouteOnLoad) {
      return;
    }

    const targetKind = 'route';
    const targetPoints = props.routePoints.filter(hasValidCoordinates);
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
  currentDocumentTheme.value = getDocumentTheme();
  applyBaseViewport();
  if (props.showProjectionToggle && activeMapProjectionMode.value === 'mercator') {
    applyFlatProjectionViewport();
  }
  if (shouldEagerlyPreloadSpatialRuntime.value) {
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
});

onBeforeUnmount(() => {
  if (mapResizeFrameHandle !== null && typeof window !== 'undefined') {
    window.cancelAnimationFrame(mapResizeFrameHandle);
    mapResizeFrameHandle = null;
  }
  cancelScheduledLiveRouteOverlayUpdate();
  if (activePopoverPlacementFrameHandle !== null && typeof window !== 'undefined') {
    window.cancelAnimationFrame(activePopoverPlacementFrameHandle);
    activePopoverPlacementFrameHandle = null;
  }
  cancelScheduledMarkerRender();
  autoRoadRouteRequestId += 1;
  autoLocateRequestId += 1;
  manualLocateRequestId += 1;
  hasRequestedInitialUserLocation = false;
  locationPermissionPrimeRequestId += 1;
  mapStyleSwapVersion += 1;
  pendingLocationCamera = null;
  pendingLocationCameraSignature = null;
  pendingResetCameraSignature = null;
  mapWeatherRequestId.value += 1;
  nearbyPlacesRequestId.value += 1;
  markerRenderVersion += 1;
  clearMapTileSettlingTimer();
  clearMapRenderGateTimer();
  clearMapCameraTransitionTimers();
  clearLocationCameraAnimation();
  clearPlannerMapCanvasPreviewFrame();
  clearPlannerMapCanvasRevealTimer();
  clearPlannerMapPreloadSurfaceTimer();
  clearMapQuickDimTimer();
  clearPlannerGlobeRestoreTimer();
  clearPendingLocationCameraFlushTimer();
  clearPendingInitialAutoLocateFocus();
  mapRenderGateMinimumVisibleUntil = 0;
  clearMapStyleTransitionTimer();
  clearMapStyleTransitionSnapshot();
  clearMapStylePresentationRefreshes();
  clearMapPostStyleResizeTimers();
  clearMapRenderHealthTimers();
  clearMapFeaturePlacePrefetchTimer();
  clearVisibleMapFeaturePlacePhotoPrefetchTimer();
  clearSuppressedCameraInteractionRenderGate();
  clearPendingControlZoom();
  clearMapWeatherRefreshTimer();
  clearNearbyPlacesRefreshTimer();
  themeObserver?.disconnect();
  themeObserver = null;
  containerResizeObserver?.disconnect();
  containerResizeObserver = null;
  mapCanvasClickCaptureCleanup?.();
  clearSpotMarkers();
  clearMapFeaturePlacePopup();
  clearNearbyPlaceMarkers();
  userMarker.value?.remove();
  userMarker.value = null;
  map.value?.remove();
  map.value = null;
  isPlannerMapCanvasPreviewing.value = false;
  isPlannerMapCanvasRevealing.value = false;
  isMapQuickDimVisible.value = false;
  exposeMapInstanceForUiTests(null);
});

defineExpose({
  runPlannerMapCommand,
  focusSpotById,
  ...(import.meta.env.MODE === 'test'
    ? {
        __coverage: {
          applyCachedMapFeaturePlaceEnrichment,
          applyMapStylePresentation,
          applyMapFeaturePlacePinEnrichment,
          applyNativeMapStylePresentation,
          applyRequestedMapStyle,
          applyScopeFillPresentation,
          applyStatesModeSymbolPresentation,
          buildAddressFromMapFeatureParts,
          buildFallbackViewportBounds,
          bindNearbyPlacePopupAddHandler,
          buildNearbyPlaceMarkerElement,
          buildNearbyPlaceMarkerId,
          buildNearbyPlaceMarkerSignature,
          buildNearbyPlacePopupContent,
          buildMapFeaturePlaceEnrichmentKey,
          buildViewportMarkerModels,
          cacheMapFeaturePlaceEnrichment,
          captureMapStyleTransitionSnapshot,
          centerOnLocation,
          clearMapFeaturePlacePrefetchTimer,
          clearLocationCameraAnimation,
          clearMapFeaturePlaceSelection,
          clearMapCameraTransitionTimers,
          clearMapRenderGateTimer,
          clearMapRenderHealthTimers,
          clearMapStyleTransitionTimer,
          clearMapTileSettlingTimer,
          clearPlannerMapCanvasPreviewFrame,
          clearPlannerMapCanvasRevealTimer,
          clearPlannerMapPreloadSurfaceTimer,
          clearMapStyleTransitionSnapshot,
          closeMapRenderGate,
          compactMapFeaturePlaceEnrichment,
          consumeSuppressedCameraInteractionRenderGate,
          deferMapDecorativeWorkFor,
          ensurePoiFallbackIcon,
          enrichMapFeaturePlacePinAddress,
          easeInOutMapLocationFocus,
          finishMapStyleTransitionAfterStyleSettle,
          finishMapStyleTransitionWhenPresentationReady,
          finishMapCameraRenderTransition,
          finishMapTileSettling,
          flashPlannerMapDim,
          flushPendingLocationCamera,
          expandNearbyPlaceBounds,
          finishMapStyleTransition,
          getCachedMapFeaturePlaceEnrichment,
          getInteractiveMapFeatureLayerIds,
          getMapFeatureAddress,
          getMapFeatureCategory,
          getMapFeatureCategoryLabel,
          getMapFeatureCoordinates,
          getMapFeatureLayerSourceLayer,
          getMapTileResourceProfile,
          getNearbyPlaceSearchBounds,
          getNearbyPlaceFallbackPhotoCategory,
          getNearbyPlaceInstantFallbackPhotoUrl,
          getNearbyPlacePopupPhotoUrl,
          getNearbyPlacesBoundsPaddingRatio,
          getNearbyPlacesLimitForZoom,
          getRenderedMapFeaturePlacePinAtPoint,
          getVisibleMapFeaturePlacePhotoPrefetchPins,
          handleFallbackCanvasClick,
          handleMapCanvasClick,
          handleMapContainerResize,
          handleRenderedMapFeatureClick,
          handleRenderedMapFeatureClickAtPoint,
          handleRenderedMapFeatureHover,
          handleZoom,
          hasRealMapFeaturePlacePhoto,
          hasSettledMapFeaturePlacePhotoLookup,
          hasWarmMapFeaturePlaceEnrichment,
          holdMapTransitionSnapshot,
          isMapRenderVisuallyReady,
          isCoordinateLikeAddress,
          isMarkerCoordinateInsideViewport,
          isMapFeaturePlacePopupPreciseEnough,
          isMapRenderSurfaceMismatched,
          isSameMapFeaturePlacePin,
          isUsableMapFeatureAddress,
          isUsableMapFeatureGeocodeResult,
          loadMapWeatherSnapshot,
          loadNearbyPlacesForViewport,
          mapRenderedFeatureToNearbyPlacePin,
          mergeNearbyPlacePins,
          normalizeNearbyPlaceAttributionUrl,
          openMapRenderGate,
          prepareInitialAutoLocateFromBaseViewport,
          previewPlannerMapCanvas,
          prefetchMapFeaturePlacePhoto,
          prefetchMapFeaturePlacePin,
          preloadNearbyPlacePhoto,
          reconcileSpotMarkers,
          releaseMapStyleTransitionSnapshot,
          releaseMapTransitionSnapshotHold,
          repairMapRenderSurface,
          revealMapRenderGate,
          revealPlannerMapCanvas,
          resetMapViewport,
          readMapFeatureProperty,
          resizeMapToContainer,
          resolveFallbackProjection,
          resolveMapFeatureMouseEventHit,
          resolveMapFeaturePlacePopupAnchor,
          resolveMapDecorativeWorkDelay,
          sampleRouteCoordinatesForOverlay,
          scheduleMapRenderHealthCheckSeries,
          scheduleMapResize,
          schedulePlannerMapCanvasLoadReveal,
          schedulePlannerMapCanvasPreview,
          schedulePlannerMapCanvasRevealFallback,
          schedulePendingLocationCameraFlush,
          scheduleVisibleMapFeaturePlacePhotoPrefetch,
          settleMapRenderAfterIdle,
          setupMap,
          shouldDeferPriorityCamera,
          startMapCameraRenderTransition,
          startMapStyleTransition,
          startMapTileSettling,
          stopMapCameraRenderTransitionVisuals,
          suppressCameraInteractionRenderGateOnce,
          syncAutoRoadRoute,
          syncActiveMapFeaturePlacePinFromCache,
          syncMapFeaturePlacePopup,
          syncThemeToMap,
          renderSpotMarkers,
          titleCaseMapFeatureCategory,
          updateNearbyPlaceMarkerPopoverPlacement,
          upsertMapFeaturePlacePin,
          warmPendingMapFeaturePlace,
          warmVisibleMapFeaturePlacePhotos,
          waitForMapFeaturePlacePhoto,
          usesPlannerCameraMotion,
          markMapRuntimeFailed,
          releaseSyncingViewportAfterFlush,
          suppressViewportCameraSyncFor,
          clearMapPostStyleResizeTimers,
          scheduleMapPostStyleResizeSeries,
          clearMapQuickDimTimer,
          clearPlannerGlobeRestoreTimer,
          isPlannerMapCanvasReadyToReveal,
          clearSuppressedCameraInteractionRenderGate,
          queueMicrotaskSafe,
          createThrottledMapMouseHandler,
          cancelScheduledMarkerRender,
          updateLiveRouteOverlay,
          cancelScheduledLiveRouteOverlayUpdate,
          scheduleLiveRouteOverlayUpdate,
          beginMapCameraInteraction,
          finishMapCameraInteraction,
          scheduleMarkerRender,
          buildCameraTargetSignature,
          isMapCameraAtTarget,
          isMapStoreViewportAtTarget,
          clampNumber,
          getMapDeviceMemoryGb,
          getMapHardwareConcurrency,
          configurePlannerMapGestureSmoothness,
          projectFallbackPoint,
          projectFallbackCoordinate,
          unprojectFallbackCoordinate,
          buildRouteCoordinateRenderKey,
          mergeUniqueMapPoints,
          distanceBetweenFallbackPoints,
          handleTrackingState,
          buildUserMarkerElement,
          syncViewportFromMap,
          setVisibleSpotIds,
          isFiniteNumber,
          roundMapWeatherCoordinate,
          clearMapWeatherRefreshTimer,
          scheduleMapWeatherRefresh,
          clearNearbyPlacesRefreshTimer,
          clearNearbyPlaceMarkers,
          getMapVisibleBounds,
          buildNearbyPlacesViewportSignature,
          canRenderNearbyPlaces,
          canAutoSearchNearbyPlaces,
          shouldLoadNearbyPlaces,
          normalizePlaceCategoryText,
          getPlaceCategoryOverride,
          resolveNearbyPlaceCategoryValue,
          isFuelPlaceCategory,
          normalizeNearbyPlaceCategoryLabel,
          formatNearbyPlaceCategory,
          formatNearbyPlaceAddress,
          buildGoogleMapsAddressUrl,
          formatNearbyPlaceDistance,
          getNearbyPlaceKind,
          getNearbyPlaceIconName,
          createNearbyPlaceMarkerIcon,
          mapNearbySearchResultToPin,
          sanitizeMapFeatureText,
          shouldHandleInteractiveMapFeaturePlaces,
          clearVisibleMapFeaturePlacePhotoPrefetchTimer,
          syncNearbyPlaceMarkers,
          shouldSuppressNearbyPlacePopupPhoto,
          isMapFeaturePlacePin,
          getActiveMapFeaturePlacePin,
          shouldDeferNearbyPlaceFallbackPhoto,
          shouldAllowInstantNearbyPlaceFallbackPhoto,
          shouldReserveNearbyPlaceAddressSlot,
          closeMapFeaturePlacePopupIfImprecise,
          closeMapFeaturePlacePopupIfZoomTooLow,
          clearMapFeaturePlacePopup,
          removeNearbyPlaceMarkerController,
          updateActiveNearbyPlaceMarkerPopoverPlacement,
          scheduleActiveNearbyPlacePopoverPlacement,
          syncActiveNearbyPlaceMarkerLayer,
          activateNearbyPlaceMarker,
          createNearbyPlaceMarkerController,
          renderNearbyPlaceMarkers,
          hasUsableNearbyPlaceCoordinates,
          scheduleNearbyPlacesRefresh,
          hasValidRouteCoordinate,
          hasValidCoordinates,
          hasMappablePoints,
          getRouteMarkerSequence,
          buildRouteOrderLookup,
          resolveBaseViewport,
          getDefaultMapProjectionMode,
          isMapProjectionMode,
          readMapProjectionModePreference,
          writeMapProjectionModePreference,
          resolveInitialMapProjectionMode,
          isMapPresentationMode,
          readMapStyleModePreference,
          writeMapStyleModePreference,
          getMapStyleForPresentation,
          shouldUseStateAbbreviationLabels,
          shouldHideNativeStateNameLabels,
          getWaterLabelMinZoom,
          getWaterLabelOpacity,
          getWaterReferenceLabelMinZoom,
          getWaterReferenceLabelOpacity,
          getDocumentTheme,
          canCaptureMapCanvasSnapshot,
          getMapStyleTransitionNow,
          waitForNextAnimationFrame,
          getMapStyleTransitionTimeoutMs,
          getMapStyleTransitionMinimumVisibleMs,
          finishMapStyleTransitionAfterPresentationFrame,
          clearMapStylePresentationRefreshes,
          scheduleMapStylePresentationRefresh,
          scheduleMapStylePresentationRefreshSeries,
          refreshMapStylePresentationSurfaces,
          resolveRequestedMapStyle,
          applyFlatProjectionViewport,
          handleMapProjectionModeSelect,
          buildViewportSignature,
          applyBaseViewport,
          hasValidMarkerCoordinates,
          isValidClusterEntry,
          getLiveMarkerVisibilityBuffer,
          getVisibleSpotsFromViewport,
          getRenderableSpotsFromViewport,
          getVisibleMarkerModelsFromViewport,
          getVisibleSpotIdsFromMarkerModels,
          getVisiblePinCountFromMarkerModels,
          buildViewport,
          getViewportBufferOffsets,
          projectSpotIntoClusterViewport,
          resolveClusterEntryPointIds,
          resolveSingletonEntrySpot,
          getDistanceOrigin,
          formatDistanceLabel,
          buildSpotMarkerModels,
          createEmptyMarkerState,
          updateVisibleSpotIds,
          buildMarkerRenderContext,
          getSpotMarkerVariant,
          renderMarkerContent,
          removeMarkerController,
          clearSpotMarkers,
          handleSpotSelect,
          focusSpotOnMap,
          handleSpotFocus,
          handleRoutePointRemove,
          handleFallbackMarkerSelect,
          emitMapClickAtCoordinate,
          handleFallbackMarkerClick,
          shouldIgnoreMapFeatureMouseEvent,
          prefetchInteractiveMapFeaturePlaceFromMouseEvent,
          handleInteractiveMapFeatureClickFromMouseEvent,
          attachMapCanvasClickCapture,
          handleClusterSelect,
          createMarkerController,
          updateMarkerController,
          isMarkerRectVisibleInMap,
          measureVisibleMarkerState,
          fitToPoints,
          fitToRoute,
          buildFitSignature,
          clearPendingControlZoom,
          schedulePendingControlZoomReset,
          easeOutMapControlZoom,
          resolveLocationFocusZoom,
          getWrappedLongitudeDistance,
          resolveLocationFocusDuration,
          clearPendingLocationCameraFlushTimer,
          clearPendingInitialAutoLocateFocus,
          isInitialAutoLocateFocusReady,
          schedulePendingInitialAutoLocateFocus,
          flushPendingInitialAutoLocateFocus,
          queueInitialAutoLocateFocus,
          ensureLocationTracking,
          startUserLocationFollow,
          focusUserLocationSmoothly,
          handleLocate,
          handleLocationBadgeActivate,
          handleResetMap,
          normalizePlannerMapCommandInput,
          isValidPlannerMapTarget,
          focusPlannerMapTarget,
          syncUserLocationMarker,
          handleLocationUpdate,
          safelySetMapPaintProperty,
          safelySetMapPaintTransitions,
          mapStylePropertyMatches,
          getLayerPaintProperty,
          getLayerLayoutProperty,
          hasLayerLayoutValue,
          setScopedMapPaintProperty,
          setScopedMapPaintTransition,
          applyMapPresentationLayerTransition,
          restoreScopedMapPaintProperties,
          prepareScopedMapPresentation,
          safelySetMapLayoutProperty,
          getMapLayoutProperty,
          safelySetMapLayerZoomRange,
          safelyMoveMapLayerBefore,
          getFirstSymbolLayerId,
          getFirstNativeSymbolLayerId,
          getMapTrafficBeforeLayerId,
          isTripsMapDebugEnabled,
          setTripsMapDebugFlag,
          exposeMapInstanceForUiTests,
          isScopeTrafficLayerId,
          isScopeRoadContextLayerId,
          getMapRoadSourceId,
          buildTrafficRoadClassFilter,
          buildTrafficCongestionFilter,
          getMapTrafficCasingColor,
          getMapTrafficCasingOpacity,
          applyMapTrafficLayerPaint,
          buildMapTrafficLayerDefinitions,
          buildScopeRoadContextLayerDefinitions,
          removeScopeRoadContextLayers,
          syncScopeRoadContextLayers,
          buildWaterReferenceLabelFeatureCollection,
          syncWaterReferenceLabelLayer,
          removeMapTerrainLayers,
          syncReferenceLabelLayers,
          removeMapTrafficLayers,
          removeLegacyMapTrafficLayers,
          addMapTrafficLayer,
          syncMapTrafficLayers,
          layerIdIncludes,
          getLayerSourceLayer,
          isCountryLabelLayer,
          isStateLabelLayer,
          isWaterLabelLayer,
          isNaturalOrWaterLabelLayer,
          isNeighborhoodLabelLayer,
          isSettlementLabelLayer,
          isPoiLabelLayer,
          isRoadLabelLayer,
          isRoadShieldLayer,
          isRoadLineLayer,
          isSimpleRoadLineLayer,
          isMajorRoadLineLayer,
          isRoadCasingLineLayer,
          getNightRoadLineColor,
          getNightRoadLineOpacity,
          getNativeMajorRoadColor,
          applyNativeMajorRoadPresentation,
          applyNativeSimpleRoadPresentation,
          applyNativeRoadPresentation,
          isCountryBoundaryLineLayer,
          isStateBoundaryLineLayer,
          applyNativeAdministrativeBoundaryPresentation,
          applyScopeAdministrativeBoundaryPresentation,
          applyScopeRoadPresentation,
          isAridLandFillLayer,
          isLandcoverFillLayer,
          isLanduseFillLayer,
          applyNativeFillPresentation,
          getNaturalGlobeFog,
          getRequestedMapProjectionName,
          resolveMapProjectionName,
          applyNaturalGlobeAtmosphere,
          setMapProjection,
          applyStableMapProjection,
          applyPlannerInteractionProjection,
          schedulePlannerGlobeRestore,
          applyScopeSolidSymbolTextPresentation,
          applyScopeFinalSymbolTextPresentation,
          restoreMapSymbolLabelVisibility,
          applyStateNameLabelPresentation,
          applyCountryLabelPresentation,
          applyContextLabelPresentation,
          applyRoadShieldPresentation,
          applyStatesModeContextSymbolPresentation,
          isAdministrativeBoundaryLineLayer,
          getPoiLabelMinZoom,
          getPoiIconOpacity,
          getPoiSymbolIconOpacity,
          getPoiLabelOpacity,
          applyPoiSymbolPresentation,
          markInitialMapRenderReady,
          recoverMissedInitialMapIdle,
          scheduleInitialMapIdleFallback,
        },
      }
    : {}),
});
</script>

<style scoped>
.map-view {
  --scope-map-chrome-z: 720;
  --scope-map-loading-bg: rgb(31 35 38);
  --scope-map-style-transition-bg:
    radial-gradient(circle at 18% 16%, rgb(32 190 169 / 0.22), transparent 36%),
    linear-gradient(180deg, rgb(13 18 24 / 0.82), rgb(17 22 28 / 0.78));
  --scope-map-style-transition-cover-bg:
    radial-gradient(circle at 16% 12%, rgb(34 196 175 / 0.18), transparent 34%),
    radial-gradient(circle at 88% 82%, rgb(69 126 159 / 0.22), transparent 38%),
    linear-gradient(180deg, rgb(9 15 22), rgb(16 27 34));
  --scope-map-style-transition-filter: saturate(0.92) brightness(0.92) blur(1.5px);
  --scope-map-style-switch-snapshot-opacity: 1;
  --scope-map-style-switch-snapshot-filter: saturate(0.9) brightness(0.84) contrast(1.02);
  --scope-map-style-switch-veil-opacity: 0.2;
  --scope-map-status-left: 0.58rem;
  --scope-map-attribution-clearance: 2.05rem;
  position: relative;
  isolation: isolate;
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

.map-view[data-map-route-variant='planner'] {
  --scope-map-globe-backdrop:
    radial-gradient(circle at 50% 42%, rgb(80 154 185 / 0.48), transparent 58%),
    radial-gradient(circle at 48% 54%, rgb(204 210 145 / 0.22), transparent 36%),
    linear-gradient(180deg, rgb(12 24 35), rgb(18 48 65) 52%, rgb(8 17 27));
  background: var(--scope-map-globe-backdrop);
}

.map-view[data-map-route-variant='planner'][data-map-presentation='scope'] {
  --scope-map-globe-backdrop:
    radial-gradient(circle at 50% 42%, rgb(39 91 116 / 0.5), transparent 58%),
    radial-gradient(circle at 48% 54%, rgb(67 96 61 / 0.18), transparent 36%),
    linear-gradient(180deg, rgb(7 13 21), rgb(12 31 43) 52%, rgb(5 10 17));
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
.map-live-route-overlay,
.map-planner-preload-surface {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.map-canvas {
  z-index: 0;
  overflow: hidden;
}

.map-planner-preload-surface {
  z-index: 20;
  pointer-events: none;
  overflow: hidden;
  opacity: 1;
  background:
    radial-gradient(circle at 50% 42%, rgb(8 20 26 / 0.12), transparent 42%),
    linear-gradient(180deg, rgb(5 10 16 / 0.26), rgb(5 10 16 / 0.32));
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  transform: translateZ(0);
  transition:
    opacity 180ms cubic-bezier(0.22, 1, 0.36, 1),
    -webkit-backdrop-filter 160ms cubic-bezier(0.22, 1, 0.36, 1),
    backdrop-filter 160ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity;
  contain: paint;
}

.map-planner-preload-surface::before,
.map-planner-preload-surface::after {
  position: absolute;
  inset: 0;
  content: '';
  pointer-events: none;
  transition:
    opacity 360ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 360ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity, transform;
}

.map-planner-preload-surface::before {
  opacity: 0.18;
  background:
    radial-gradient(circle at 49% 42%, rgb(255 255 255 / 0.06), transparent 35%),
    linear-gradient(180deg, rgb(5 9 15 / 0.04), transparent 40%, rgb(5 9 15 / 0.1));
  transform: scale(1);
}

.map-planner-preload-surface::after {
  opacity: 0.04;
  background:
    radial-gradient(circle at 18% 20%, rgb(28 211 188 / 0.14), transparent 32%),
    radial-gradient(circle at 84% 76%, rgb(92 124 180 / 0.16), transparent 38%);
  transform: translate3d(0, 0, 0);
}

.map-planner-preload-surface.is-previewing {
  opacity: 1;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

.map-planner-preload-surface.is-previewing::before {
  opacity: 0.14;
}

.map-planner-preload-surface.is-previewing::after {
  opacity: 0.03;
}

.map-planner-preload-surface.is-revealing {
  opacity: 0;
  -webkit-backdrop-filter: saturate(1) brightness(1) contrast(1);
  backdrop-filter: saturate(1) brightness(1) contrast(1);
}

.map-planner-preload-surface.is-revealing::before,
.map-planner-preload-surface.is-revealing::after {
  opacity: 0;
}

.map-canvas--planner {
  --scope-map-loading-bg: var(--scope-map-globe-backdrop);
  background: var(--scope-map-globe-backdrop);
}

.map-canvas--planner :deep(.mapboxgl-map),
.map-canvas--planner :deep(.mapboxgl-canvas-container) {
  background: var(--scope-map-globe-backdrop) !important;
}

.map-view[data-map-presentation='native'] {
  --scope-map-style-transition-bg:
    radial-gradient(circle at 18% 16%, rgb(32 190 169 / 0.2), transparent 36%),
    linear-gradient(180deg, rgb(17 22 28 / 0.74), rgb(23 28 31 / 0.68));
  --scope-map-style-transition-filter: saturate(0.96) brightness(0.96) blur(1.25px);
}

.map-view[data-map-transition-cover='scope'] {
  --scope-map-style-transition-cover-bg:
    radial-gradient(circle at 18% 16%, rgb(34 196 175 / 0.18), transparent 34%),
    radial-gradient(circle at 86% 82%, rgb(69 126 159 / 0.22), transparent 38%),
    linear-gradient(180deg, rgb(9 15 22), rgb(16 27 34));
  --scope-map-style-switch-snapshot-opacity: 1;
  --scope-map-style-switch-snapshot-filter: saturate(0.74) brightness(0.52) contrast(1.1);
  --scope-map-style-switch-veil-opacity: 0.22;
}

.map-view[data-map-transition-cover='native'] {
  --scope-map-style-transition-cover-bg:
    radial-gradient(circle at 15% 18%, rgb(88 181 199 / 0.22), transparent 34%),
    radial-gradient(circle at 84% 74%, rgb(229 205 134 / 0.24), transparent 36%),
    linear-gradient(180deg, rgb(116 185 204), rgb(214 226 170) 48%, rgb(235 222 155));
  --scope-map-style-switch-snapshot-opacity: 1;
  --scope-map-style-switch-snapshot-filter: saturate(1.04) brightness(1.18) contrast(0.94);
  --scope-map-style-switch-veil-opacity: 0.16;
}

.map-render-smoothing-veil {
  position: absolute;
  inset: 0;
  z-index: 17;
  pointer-events: none;
  opacity: 0;
  background:
    radial-gradient(circle at 46% 36%, color-mix(in srgb, var(--accent-teal) 8%, transparent), transparent 42%),
    linear-gradient(180deg, rgb(7 12 18 / 0.08), rgb(7 12 18 / 0.14));
  transition: opacity 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
  will-change: opacity;
  contain: paint;
}

.map-style-transition-snapshot {
  position: absolute;
  inset: 0;
  z-index: 18;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  opacity: 0;
  transform: translateZ(0);
  transition:
    opacity 680ms cubic-bezier(0.16, 1, 0.3, 1),
    filter 680ms cubic-bezier(0.16, 1, 0.3, 1);
  filter: saturate(1) brightness(1);
  will-change: opacity, filter;
  contain: paint;
}

.map-style-transition-snapshot.is-visible {
  opacity: 1;
}

.map-view[data-map-route-variant='planner'].map-view--camera-transitioning:not(.map-view--style-transitioning) .map-style-transition-snapshot.is-visible {
  opacity: 0.84;
  filter: saturate(1) brightness(1) contrast(1);
  transition-duration: 160ms;
}

.map-style-transition-snapshot.is-tinted {
  filter: var(--scope-map-style-switch-snapshot-filter);
}

.map-view--style-transitioning[data-map-transition-variant='switch'] .map-style-transition-snapshot.is-visible {
  opacity: 1;
  filter: saturate(1) brightness(1) contrast(1);
}

.map-view--style-transitioning[data-map-transition-variant='switch'] .map-style-transition-snapshot.is-visible.is-tinted {
  opacity: var(--scope-map-style-switch-snapshot-opacity);
  filter: var(--scope-map-style-switch-snapshot-filter);
  transition-duration: 560ms;
}

.map-view--tile-settling .map-render-smoothing-veil {
  opacity: 0.1;
}

.map-view--camera-moving .map-render-smoothing-veil {
  opacity: 0.12;
  transition-duration: 100ms;
}

.map-view--render-gated .map-render-smoothing-veil {
  opacity: 0.11;
  transition-duration: 60ms;
}

.map-style-transition-veil {
  position: absolute;
  inset: 0;
  z-index: 19;
  pointer-events: none;
  opacity: 0;
  overflow: hidden;
  background: var(--scope-map-style-transition-bg);
  -webkit-backdrop-filter: var(--scope-map-style-transition-filter);
  backdrop-filter: var(--scope-map-style-transition-filter);
  transform: translateZ(0);
  transition: opacity 420ms cubic-bezier(0.2, 0.8, 0.2, 1);
  will-change: opacity;
}

.map-style-transition-veil::after {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0;
  background:
    linear-gradient(110deg, transparent 0 28%, rgb(255 255 255 / 0.1) 44%, transparent 62%),
    radial-gradient(circle at 50% 42%, rgb(255 255 255 / 0.06), transparent 42%);
  transform: translate3d(-10%, 0, 0);
  transition:
    opacity 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    transform 840ms cubic-bezier(0.2, 0.8, 0.2, 1);
  will-change: opacity, transform;
}

.map-view--style-transitioning .map-style-transition-veil {
  opacity: 0.94;
  transition-duration: 140ms;
}

.map-view[data-map-route-variant='planner'].map-view--style-transitioning[data-map-transition-variant='load'] .map-style-transition-veil {
  opacity: 0.03;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  transition-duration: 100ms;
}

.map-view[data-map-route-variant='planner'] .map-render-smoothing-veil {
  background:
    linear-gradient(180deg, rgb(232 224 216 / 0.34), rgb(232 224 216 / 0.2)),
    radial-gradient(circle at 50% 42%, rgb(134 226 206 / 0.1), transparent 44%);
}

.map-view[data-map-route-variant='planner'].map-view--tile-settling .map-render-smoothing-veil,
.map-view[data-map-route-variant='planner'].map-view--camera-moving .map-render-smoothing-veil,
.map-view[data-map-route-variant='planner'].map-view--render-gated .map-render-smoothing-veil {
  opacity: 0.035;
  transition-duration: 140ms;
}

.map-view[data-map-route-variant='planner'].map-view--camera-visual-suppressed .map-render-smoothing-veil {
  opacity: 0;
  transition-duration: 0ms;
}

.map-view--style-transitioning[data-map-transition-variant='switch'] .map-style-transition-veil {
  opacity: var(--scope-map-style-switch-veil-opacity);
  background: var(--scope-map-style-transition-cover-bg);
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  transition-duration: 360ms;
}

.map-view--style-transitioning[data-map-transition-variant='switch']:not(.map-view--snapshot-visible) .map-style-transition-veil {
  opacity: var(--scope-map-style-switch-veil-opacity);
}

.map-view--camera-transitioning .map-style-transition-veil {
  opacity: 0.012;
  background: var(--scope-map-style-transition-cover-bg);
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  transition-duration: 90ms;
}

.map-view--camera-transitioning:not(.map-view--snapshot-visible) .map-style-transition-veil {
  opacity: 0.012;
}

.map-view[data-map-route-variant='planner'].map-view--quick-dim .map-style-transition-veil {
  opacity: 0.18;
  background: var(--scope-map-style-transition-cover-bg);
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  transition-duration: 120ms;
}

.map-view--style-transitioning[data-map-transition-variant='switch'] .map-style-transition-veil::after {
  opacity: 1;
  transform: translate3d(0, 0, 0);
}

.map-canvas :deep(.mapboxgl-map),
.map-canvas :deep(.mapboxgl-canvas-container) {
  width: 100% !important;
  height: 100% !important;
}

.map-canvas :deep(.mapboxgl-canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
  background: var(--scope-map-loading-bg);
}

.map-view[data-map-route-variant='planner'] :deep(.mapboxgl-canvas) {
  display: block;
  visibility: visible;
  opacity: 1;
  filter: none;
  transition:
    filter 220ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 120ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: filter, opacity;
}

.map-view[data-map-route-variant='planner'] :deep(.mapboxgl-canvas.is-previewing) {
  opacity: 1;
  filter: saturate(0.82) brightness(0.62) contrast(1.06);
}

.map-view[data-map-route-variant='planner'] :deep(.mapboxgl-canvas.loaded) {
  display: block;
  visibility: visible;
  opacity: 1;
  filter: none;
}

.map-view--planner-revealing[data-map-route-variant='planner'] :deep(.mapboxgl-canvas.loaded),
.map-view--planner-revealed[data-map-route-variant='planner'] :deep(.mapboxgl-canvas.loaded) {
  filter: none;
  will-change: auto;
}

.map-canvas :deep(.mapboxgl-popup-content) {
  padding: 0;
  border-radius: 1rem;
  background: transparent;
  box-shadow: none;
}

.map-canvas :deep(.mapboxgl-popup-close-button) {
  right: 0.35rem;
  top: 0.35rem;
  z-index: 2;
  width: 1.7rem;
  height: 1.7rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 74%, transparent);
  color: var(--text-primary);
  font-size: 1.1rem;
  line-height: 1;
}

.map-canvas :deep(.map-feature-place-popup) {
  z-index: 180;
}

.map-canvas :deep(.map-feature-place-popup.mapboxgl-popup-anchor-bottom .mapboxgl-popup-tip) {
  border-top-color: color-mix(in srgb, var(--accent-teal) 24%, var(--glass-border));
}

.map-canvas :deep(.nearby-place-marker) {
  position: relative;
  display: grid;
  place-items: center;
  z-index: 160;
}

.map-canvas :deep(.nearby-place-marker__button) {
  display: grid;
  place-items: center;
  width: 2.35rem;
  height: 2.35rem;
  border: 2px solid color-mix(in srgb, white 70%, var(--accent-teal) 30%);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 86%, rgb(11, 21, 23) 14%);
  color: rgb(7, 16, 15);
  box-shadow:
    0 0.65rem 1.25rem rgb(0 0 0 / 0.28),
    0 0 0 0.38rem color-mix(in srgb, var(--accent-teal) 24%, transparent);
  cursor: pointer;
}

.map-canvas :deep(.nearby-place-marker__thumb) {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
}

.map-canvas :deep(.nearby-place-marker__icon) {
  display: grid;
  place-items: center;
  width: 1.1rem;
  height: 1.1rem;
}

.map-canvas :deep(.nearby-place-marker__svg) {
  width: 100%;
  height: 100%;
}

.map-canvas :deep(.nearby-place-marker__label),
.map-canvas :deep(.nearby-place-marker__price) {
  display: none;
}

.map-canvas :deep(.nearby-place-marker__popover) {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 0.75rem);
  width: min(17.25rem, calc(100vw - 2rem));
  max-height: var(--nearby-place-popover-max-height, none);
  transform: translate(calc(-50% + var(--nearby-place-popover-shift-x, 0px)), 0);
  opacity: 0;
  pointer-events: none;
  transition: none;
}

.map-canvas :deep(.nearby-place-marker[data-popover-placement="below"] .nearby-place-marker__popover) {
  top: calc(100% + 0.75rem);
  bottom: auto;
  transform: translate(calc(-50% + var(--nearby-place-popover-shift-x, 0px)), 0);
}

.map-canvas :deep(.nearby-place-marker.is-active .nearby-place-marker__popover) {
  transform: translate(calc(-50% + var(--nearby-place-popover-shift-x, 0px)), 0);
  opacity: 1;
  pointer-events: auto;
}

.map-canvas :deep(.nearby-place-marker__popover-close) {
  position: absolute;
  right: 0.55rem;
  top: 0.55rem;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 1.55rem;
  height: 1.55rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 78%, transparent);
  color: var(--text-secondary);
  cursor: pointer;
}

.map-canvas :deep(.nearby-place-popup) {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas:
    "photo"
    "content"
    "footer";
  gap: 0.62rem;
  width: min(17.25rem, calc(100vw - 2rem));
  max-height: inherit;
  padding: 0.68rem;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 24%, var(--glass-border));
  border-radius: 1rem;
  background: color-mix(in srgb, var(--bg-secondary) 98%, var(--bg-primary) 2%);
  color: var(--text-primary);
  box-shadow:
    0 1rem 2.6rem rgb(0 0 0 / 0.38),
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 8%, transparent);
}

.map-canvas :deep(.nearby-place-popup::-webkit-scrollbar) {
  display: none;
}

.map-canvas :deep(.nearby-place-popup--without-photo) {
  grid-template-areas:
    "content"
    "footer";
}

.map-canvas :deep(.nearby-place-popup__photo) {
  position: relative;
  display: grid;
  grid-area: photo;
  place-items: center;
  width: 100%;
  height: 7.6rem;
  margin: 0;
  overflow: hidden;
  border-radius: 0.72rem;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent-teal) 26%, var(--bg-tertiary)), color-mix(in srgb, var(--bg-primary) 82%, var(--accent-gold) 18%));
  background-position: center;
  background-size: cover;
}

.map-canvas :deep(.nearby-place-popup__photo--loading) {
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--bg-tertiary) 92%, white 8%) 0%, color-mix(in srgb, var(--accent-teal) 20%, var(--bg-tertiary) 80%) 45%, color-mix(in srgb, var(--bg-tertiary) 92%, white 8%) 90%);
  background-size: 100% 100%;
}

.map-canvas :deep(.nearby-place-popup__photo--empty) {
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--bg-tertiary) 96%, black 4%), color-mix(in srgb, var(--bg-primary) 88%, var(--accent-teal) 12%));
}

.map-canvas :deep(.nearby-place-popup__photo--empty::after) {
  position: absolute;
  inset: 0;
  content: "";
  background:
    radial-gradient(circle at 28% 18%, color-mix(in srgb, var(--accent-teal) 14%, transparent), transparent 32%),
    linear-gradient(180deg, transparent, rgb(0 0 0 / 0.16));
  pointer-events: none;
}

.map-canvas :deep(.nearby-place-popup__photo-icon) {
  display: grid;
  place-items: center;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 70%, transparent);
  color: var(--accent-teal);
}

.map-canvas :deep(.nearby-place-popup__photo-icon svg) {
  width: 1.12rem;
  height: 1.12rem;
}

.map-canvas :deep(.nearby-place-popup__image) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.map-canvas :deep(.nearby-place-popup__content) {
  display: grid;
  grid-area: content;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    "title distance"
    "address address";
  gap: 0.3rem;
  min-width: 0;
  padding-right: 1.6rem;
}

.map-canvas :deep(.nearby-place-popup h3) {
  grid-area: title;
  margin: 0;
  color: var(--text-primary);
  font-size: 1rem;
  line-height: 1.12;
  overflow-wrap: anywhere;
}

.map-canvas :deep(.nearby-place-popup__category),
.map-canvas :deep(.nearby-place-popup__address),
.map-canvas :deep(.nearby-place-popup__meta),
.map-canvas :deep(.nearby-place-popup__distance) {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 0.74rem;
  line-height: 1.28;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-canvas :deep(.nearby-place-popup__details) {
  display: grid;
  align-content: end;
  gap: 0.1rem;
  min-width: 0;
}

.map-canvas :deep(.nearby-place-popup__address) {
  grid-area: address;
  display: -webkit-box;
  white-space: normal;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.map-canvas :deep(.nearby-place-popup__distance) {
  grid-area: distance;
  justify-self: end;
  align-self: start;
  color: var(--text-primary);
  font-weight: var(--font-weight-bold);
}

.map-canvas :deep(.nearby-place-popup__address--link) {
  color: var(--text-secondary);
  text-decoration: none;
  text-underline-offset: 0.18em;
}

.map-canvas :deep(.nearby-place-popup__address--link:hover),
.map-canvas :deep(.nearby-place-popup__address--link:focus-visible) {
  color: var(--text-primary);
  text-decoration: underline;
  outline: none;
}

.map-canvas :deep(.nearby-place-popup__address--pending) {
  min-height: 1.9em;
}

.map-canvas :deep(.nearby-place-popup__category) {
  color: var(--accent-teal);
  font-weight: var(--font-weight-semibold);
}

.map-canvas :deep(.nearby-place-popup__attribution) {
  position: absolute;
  inset: auto 0 0;
  padding: 0.22rem 0.35rem;
  background: rgb(0 0 0 / 0.42);
  color: white;
  font-size: 0.58rem;
}

.map-canvas :deep(.nearby-place-popup__attribution a) {
  color: inherit;
}

.map-canvas :deep(.nearby-place-popup__footer) {
  display: grid;
  grid-area: footer;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 0.7rem;
}

.map-canvas :deep(.nearby-place-popup__actions) {
  display: flex;
  justify-content: flex-end;
  align-items: flex-end;
}

.map-canvas :deep(.nearby-place-popup__add) {
  min-width: 5.15rem;
  min-height: 2.25rem;
  padding: 0 0.78rem;
  border: 0;
  border-radius: var(--radius-full);
  background: var(--accent-teal);
  color: rgb(5, 17, 15);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  box-shadow: none;
}

.map-canvas :deep(.nearby-place-popup__add:hover),
.map-canvas :deep(.nearby-place-popup__add:focus-visible) {
  background: color-mix(in srgb, var(--accent-teal) 88%, white 12%);
  outline: none;
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
  opacity: 1;
  transition: none;
  will-change: opacity;
  contain: layout paint;
}

.map-view--camera-moving .map-live-route-overlay {
  opacity: 1;
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

.map-fallback__marker.is-entertainment {
  color: var(--badge-entertainment-fg);
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
.map-status-dock,
.map-location-corner,
.map-traffic-key,
.tracker-overlay,
.map-style-switch,
.map-projection-switch {
  position: absolute;
  z-index: var(--scope-map-chrome-z);
}

.map-summary {
  right: calc(var(--safe-area-right) + var(--space-4));
  top: var(--space-4);
  left: auto;
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

.map-weather-badge {
  position: absolute;
  left: max(0.7rem, var(--safe-area-left));
  bottom: calc(var(--space-4) + var(--safe-area-bottom) + 1.65rem);
  z-index: var(--z-sidebar);
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  max-width: min(8.5rem, calc(100% - 8rem));
  min-height: 2.35rem;
  padding: 0.46rem 0.74rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 20%, var(--glass-border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-secondary) 90%, var(--bg-primary) 10%);
  color: var(--text-primary);
  backdrop-filter: none;
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 6%, transparent);
  pointer-events: none;
}

.map-location-corner {
  top: calc(var(--safe-area-top) + var(--space-4));
  right: calc(var(--safe-area-right) + var(--scope-map-controls-right, var(--space-4)));
  display: flex;
  justify-content: flex-end;
  max-width: min(16rem, calc(100% - var(--space-8)));
  pointer-events: none;
}

.map-weather-badge :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
  color: var(--accent-teal);
}

.map-weather-badge strong {
  min-width: 0;
  line-height: 1;
  white-space: nowrap;
}

.map-weather-badge strong {
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.map-traffic-key {
  top: calc(var(--safe-area-top) + var(--space-4));
  right: calc(var(--safe-area-right) + var(--space-4));
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  max-width: min(31rem, calc(100% - 9rem));
  padding: 0.42rem 0.55rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 16%, var(--glass-border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-secondary) 88%, transparent);
  box-shadow:
    0 0.8rem 2rem color-mix(in srgb, var(--bg-primary) 24%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 7%, transparent);
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  pointer-events: none;
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
}

.map-traffic-key__label {
  display: inline-flex;
  align-items: center;
  padding-right: 0.1rem;
  color: var(--text-primary);
  font-weight: var(--font-weight-bold);
  white-space: nowrap;
}

.map-traffic-key__item {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  white-space: nowrap;
}

.map-traffic-key__swatch {
  width: 1.25rem;
  height: 0.28rem;
  border-radius: var(--radius-full);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--bg-primary) 36%, transparent);
}

.map-traffic-key__swatch--slow {
  background: rgb(217, 138, 36);
}

.map-traffic-key__swatch--heavy {
  background: rgb(240, 68, 56);
}

.map-traffic-key__swatch--closed {
  background: rgb(118, 84, 215);
}

.map-style-switch {
  right: calc(var(--safe-area-right) + var(--scope-map-controls-right, var(--space-4)) + 5.15rem);
  bottom: calc(var(--safe-area-bottom) + var(--scope-map-controls-bottom, var(--space-4)));
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.38rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-secondary) 86%, transparent);
  box-shadow:
    0 0.9rem 2.2rem color-mix(in srgb, var(--bg-primary) 28%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 7%, transparent);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  pointer-events: auto;
}

.map-projection-switch {
  top: calc(var(--safe-area-top) + var(--space-4) + 3.55rem);
  right: calc(var(--safe-area-right) + var(--space-4));
  left: auto;
  bottom: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.38rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-secondary) 88%, transparent);
  box-shadow:
    0 0.9rem 2.2rem color-mix(in srgb, var(--bg-primary) 28%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 7%, transparent);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  pointer-events: auto;
}

.map-style-switch__button,
.map-projection-switch__button {
  display: grid;
  place-items: center;
  width: 2.55rem;
  height: 2.55rem;
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  background: transparent;
  color: color-mix(in srgb, var(--text-primary) 76%, var(--text-secondary) 24%);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.map-style-switch__button:hover,
.map-style-switch__button:focus-visible,
.map-projection-switch__button:hover,
.map-projection-switch__button:focus-visible {
  transform: translateY(var(--motion-card-lift));
  border-color: color-mix(in srgb, var(--accent-teal) 24%, var(--border-hover));
  color: var(--text-primary);
  outline: none;
}

.map-style-switch__button.is-active,
.map-projection-switch__button.is-active {
  border-color: color-mix(in srgb, var(--accent-teal) 30%, transparent);
  background: color-mix(in srgb, var(--accent-teal) 18%, var(--bg-tertiary) 82%);
  color: var(--accent-teal);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 8%, transparent),
    0 0.45rem 1.1rem color-mix(in srgb, var(--accent-teal) 12%, transparent);
}

.map-style-switch__button:active,
.map-projection-switch__button:active {
  transform: translateY(0) scale(var(--motion-press-scale));
}

.map-style-switch__button :deep(.scope-icon),
.map-projection-switch__button :deep(.scope-icon) {
  width: 1.08rem;
  height: 1.08rem;
}

.map-projection-switch__button {
  grid-template-columns: auto auto;
  width: auto;
  min-width: 3.95rem;
  gap: 0.32rem;
  padding: 0 0.7rem;
  font-size: 0.78rem;
  font-weight: var(--font-weight-bold);
  line-height: 1;
}

.map-style-switch__label {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
}

.tracker-overlay {
  right: calc(var(--safe-area-right) + var(--scope-map-controls-right, var(--space-4)) + 10.95rem);
  bottom: calc(var(--safe-area-bottom) + var(--scope-map-controls-bottom, var(--space-4)) + 0.24rem);
  max-width: min(12.35rem, calc(100% - 15.4rem));
  pointer-events: auto;
}

.map-view--weather-visible .tracker-overlay {
  bottom: calc(var(--safe-area-bottom) + var(--scope-map-controls-bottom, var(--space-4)) + 0.24rem);
}

.empty-state {
  position: absolute;
  inset: 50% auto auto 50%;
  width: min(30rem, calc(100% - 3rem));
  transform: translate(-50%, -50%);
  z-index: var(--scope-map-chrome-z);
  pointer-events: none;
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
  right: max(var(--space-3), var(--safe-area-right));
  left: auto;
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

.map-view--mobile .map-weather-badge {
  left: max(var(--space-3), var(--safe-area-left));
  bottom: calc(var(--space-3) + var(--safe-area-bottom) + 1.45rem);
  max-width: min(15rem, calc(100% - 6.5rem));
  min-height: 2.15rem;
  padding: 0.38rem 0.62rem;
}

.map-view--mobile .map-projection-switch {
  top: calc(max(var(--space-3), var(--safe-area-top)) + 5.9rem);
  right: max(var(--space-3), var(--safe-area-right));
  left: auto;
  bottom: auto;
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
  .map-render-smoothing-veil,
  .map-style-transition-snapshot,
  .map-style-transition-veil::after,
  .map-style-transition-veil,
  .map-live-route-overlay__outline,
  .map-live-route-overlay__line {
    transition: none;
    animation: none;
  }
}

@media (max-width: 960px) {
  .map-summary {
    right: var(--space-3);
    left: auto;
  }

  .map-summary {
    top: var(--space-3);
    max-width: calc(100% - 7rem);
  }

  .tracker-overlay {
    right: calc(var(--safe-area-right) + var(--scope-map-controls-right, var(--space-3)) + 10rem);
    bottom: calc(var(--safe-area-bottom) + var(--scope-map-controls-bottom, var(--space-3)) + 0.16rem);
    max-width: min(11.9rem, calc(100% - 14.2rem));
  }

  .map-weather-badge {
    left: max(0.58rem, var(--safe-area-left));
    bottom: calc(var(--space-3) + var(--safe-area-bottom) + 1.45rem);
    max-width: min(15rem, calc(100% - 6.5rem));
  }

  .map-traffic-key {
    top: calc(var(--safe-area-top) + var(--space-3));
    right: calc(var(--safe-area-right) + var(--space-3));
    max-width: min(21rem, calc(100% - 5.5rem));
    gap: 0.34rem;
    padding: 0.38rem 0.48rem;
  }

  .map-view--weather-visible .tracker-overlay {
    bottom: calc(var(--safe-area-bottom) + var(--scope-map-controls-bottom, var(--space-3)) + 0.16rem);
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

  .map-style-switch {
    right: calc(var(--scope-map-controls-right, var(--space-3)) + 4.75rem);
    bottom: var(--scope-map-controls-bottom, var(--space-3));
  }

  .map-projection-switch {
    top: calc(var(--safe-area-top) + var(--space-3) + 3.45rem);
    right: calc(var(--safe-area-right) + var(--space-3));
    left: auto;
    bottom: auto;
  }

  .map-style-switch__button {
    min-width: 2.35rem;
    width: 2.35rem;
    padding: 0;
  }

  .map-projection-switch__button {
    min-width: 3.65rem;
    min-height: 2.35rem;
    padding-inline: 0.58rem;
  }

  .map-style-switch__label {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
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
