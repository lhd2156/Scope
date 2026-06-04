<template>
  <span hidden aria-hidden="true" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue';
import type mapboxgl from 'mapbox-gl';
import type { MapPoint } from '@/types';
import { readMapColorToken } from '@/components/map/mapColorTokens';

type RouteCoordinate = [number, number];
type MapPresentationMode = 'scope' | 'native';

const SOURCE_ID = 'scope-route-source';
const OUTLINE_LAYER_ID = 'scope-route-outline';
const LINE_LAYER_ID = 'scope-route-line';
const TRAFFIC_LAYER_IDS = [
  'scope-traffic-flow-casing',
  'scope-traffic-flow',
  'scope-traffic-alert-casing',
  'scope-traffic-alert',
  'scope-traffic-closures',
] as const;
const ROUTE_SYNC_RETRY_DELAYS_MS = [80, 240, 640] as const;
const ROUTE_OUTLINE_WIDTH = {
  default: 10,
  planner: 11,
} as const;
const ROUTE_LINE_WIDTH = {
  default: 5.4,
  planner: 6.2,
} as const;
const ROUTE_OUTLINE_OPACITY = {
  default: 0.76,
  planner: 0.8,
} as const;
const ROUTE_LINE_OPACITY = {
  default: 0.96,
  planner: 1,
} as const;

const props = withDefaults(
  defineProps<{
    mapInstance: mapboxgl.Map | null;
    points: MapPoint[];
    coordinates?: RouteCoordinate[];
    styleKey?: string;
    presentation?: MapPresentationMode;
    variant?: 'default' | 'planner';
  }>(),
  {
    coordinates: () => [],
    styleKey: 'default',
    presentation: 'scope',
    variant: 'default',
  },
);

function isDocumentLightTheme(): boolean {
  return typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
}

function isLightRouteSurface(): boolean {
  return props.presentation === 'native' || isDocumentLightTheme();
}

function getRouteOutlineColor(): string {
  return isLightRouteSurface()
    ? readMapColorToken('--map-route-outline-light', 'rgb(6, 16, 24)')
    : readMapColorToken('--map-route-outline-dark', 'rgb(236, 254, 255)');
}

function getRouteLineColor(): string {
  if (isLightRouteSurface()) {
    return readMapColorToken('--map-route-default-light', 'rgb(180, 83, 9)');
  }

  return readMapColorToken('--map-route-default-dark', readMapColorToken('--accent-gold', 'rgb(251, 191, 36)'));
}

function getRouteOutlineWidth(): number {
  return props.variant === 'planner' ? ROUTE_OUTLINE_WIDTH.planner : ROUTE_OUTLINE_WIDTH.default;
}

function getRouteLineWidth(): number {
  return props.variant === 'planner' ? ROUTE_LINE_WIDTH.planner : ROUTE_LINE_WIDTH.default;
}

function getRouteOutlineOpacity(): number {
  return props.variant === 'planner' ? ROUTE_OUTLINE_OPACITY.planner : ROUTE_OUTLINE_OPACITY.default;
}

function getRouteLineOpacity(): number {
  return props.variant === 'planner' ? ROUTE_LINE_OPACITY.planner : ROUTE_LINE_OPACITY.default;
}

function hasValidRouteCoordinate(coordinate: RouteCoordinate): boolean {
  const [longitude, latitude] = coordinate;
  return Number.isFinite(longitude)
    && Number.isFinite(latitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

function getLineCoordinates(): RouteCoordinate[] {
  const roadCoordinates = props.coordinates.filter(hasValidRouteCoordinate);
  if (roadCoordinates.length > 1) {
    return roadCoordinates;
  }

  return props.points
    .filter((point) => (
      Number.isFinite(point.longitude)
      && Number.isFinite(point.latitude)
      && point.latitude >= -90
      && point.latitude <= 90
      && point.longitude >= -180
      && point.longitude <= 180
    ))
    .map((point): RouteCoordinate => [point.longitude, point.latitude]);
}

function buildRouteCollection() {
  const coordinates = getLineCoordinates();
  if (coordinates.length < 2) {
    return {
      type: 'FeatureCollection',
      features: [],
    } as const;
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates,
        },
      },
    ],
  } as const;
}

function safelyHasLayer(map: mapboxgl.Map, layerId: string): boolean {
  try {
    return Boolean(map.getLayer(layerId));
  } catch {
    return false;
  }
}

function safelyHasSource(map: mapboxgl.Map, sourceId: string): mapboxgl.Source | undefined {
  try {
    return map.getSource(sourceId);
  } catch {
    return undefined;
  }
}

function safelyRemoveLayer(map: mapboxgl.Map, layerId: string): void {
  if (!safelyHasLayer(map, layerId)) {
    return;
  }

  try {
    map.removeLayer(layerId);
  } catch {
    // Mapbox can clear its style internals before Vue finishes unmounting child layers.
  }
}

function safelyRemoveSource(map: mapboxgl.Map, sourceId: string): void {
  if (!safelyHasSource(map, sourceId)) {
    return;
  }

  try {
    map.removeSource(sourceId);
  } catch {
    // Mapbox can clear its style internals before Vue finishes unmounting child layers.
  }
}

function isRouteStyleReady(map: mapboxgl.Map): boolean {
  try {
    return map.isStyleLoaded();
  } catch {
    return false;
  }
}

function removeRoute(map: mapboxgl.Map | null) {
  if (!map) {
    return;
  }

  safelyRemoveLayer(map, LINE_LAYER_ID);
  safelyRemoveLayer(map, OUTLINE_LAYER_ID);
  safelyRemoveSource(map, SOURCE_ID);
}

function ensureLineLayers(map: mapboxgl.Map) {
  if (!safelyHasLayer(map, OUTLINE_LAYER_ID)) {
    try {
      map.addLayer({
        id: OUTLINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
          'line-sort-key': 1000,
        },
        paint: {
          'line-color': getRouteOutlineColor(),
          'line-width': getRouteOutlineWidth(),
          'line-opacity': getRouteOutlineOpacity(),
        },
      });
    } catch {
      return;
    }
  }

  if (!safelyHasLayer(map, LINE_LAYER_ID)) {
    try {
      map.addLayer({
        id: LINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
          'line-sort-key': 1001,
        },
        paint: {
          'line-color': getRouteLineColor(),
          'line-width': getRouteLineWidth(),
          'line-opacity': getRouteLineOpacity(),
        },
      });
    } catch {
      return;
    }
  }
}

function bringRouteLayersToFront(map: mapboxgl.Map): void {
  try {
    const firstTrafficLayerId = TRAFFIC_LAYER_IDS.find((layerId) => safelyHasLayer(map, layerId));

    if (safelyHasLayer(map, OUTLINE_LAYER_ID) && typeof map.moveLayer === 'function') {
      if (firstTrafficLayerId) {
        map.moveLayer(OUTLINE_LAYER_ID, firstTrafficLayerId);
      } else {
        map.moveLayer(OUTLINE_LAYER_ID);
      }
    }

    if (safelyHasLayer(map, LINE_LAYER_ID) && typeof map.moveLayer === 'function') {
      if (firstTrafficLayerId) {
        map.moveLayer(LINE_LAYER_ID, firstTrafficLayerId);
      } else {
        map.moveLayer(LINE_LAYER_ID);
      }
    }
  } catch {
    // Route ordering is best-effort while Mapbox swaps style internals.
  }
}

function syncRouteStyle(map: mapboxgl.Map) {
  const outlineColor = getRouteOutlineColor();
  const routeColor = getRouteLineColor();

  if (!outlineColor || !routeColor || typeof map.setPaintProperty !== 'function') {
    return;
  }

  try {
    map.setPaintProperty(OUTLINE_LAYER_ID, 'line-color', outlineColor);
    map.setPaintProperty(OUTLINE_LAYER_ID, 'line-width', getRouteOutlineWidth());
    map.setPaintProperty(OUTLINE_LAYER_ID, 'line-opacity', getRouteOutlineOpacity());

    map.setPaintProperty(LINE_LAYER_ID, 'line-color', routeColor);
    map.setPaintProperty(LINE_LAYER_ID, 'line-width', getRouteLineWidth());
    map.setPaintProperty(LINE_LAYER_ID, 'line-opacity', getRouteLineOpacity());
    map.setPaintProperty(LINE_LAYER_ID, 'line-dasharray', [1, 0.001]);
  } catch {
    // The layer may disappear during a Mapbox style swap or map teardown.
  }
}

let routeSyncTimers: ReturnType<typeof setTimeout>[] = [];
let routeThemeObserver: MutationObserver | null = null;

function clearScheduledRouteSync(): void {
  routeSyncTimers.forEach((timer) => clearTimeout(timer));
  routeSyncTimers = [];
}

function scheduleRouteSync(): void {
  clearScheduledRouteSync();
  routeSyncTimers = ROUTE_SYNC_RETRY_DELAYS_MS.map((delay) => setTimeout(() => {
    upsertRoute();
  }, delay));
}

function syncRouteNowAndRetryIfStyleIsPending(): void {
  const currentMap = props.mapInstance;
  const styleReady = currentMap ? isRouteStyleReady(currentMap) : false;
  upsertRoute();

  if (!styleReady) {
    scheduleRouteSync();
  }
}

function upsertRoute() {
  const map = props.mapInstance;
  const collection = buildRouteCollection();
  if (!collection.features.length) {
    removeRoute(map);
    return;
  }

  if (!map || !isRouteStyleReady(map)) {
    return;
  }

  const existingSource = safelyHasSource(map, SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
  try {
    if (existingSource) {
      existingSource.setData(collection);
    } else {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: collection,
      });
    }
  } catch {
    return;
  }

  ensureLineLayers(map);
  syncRouteStyle(map);
  bringRouteLayersToFront(map);
}

function handleMapStyleReady() {
  syncRouteNowAndRetryIfStyleIsPending();
}

watch(
  () => props.mapInstance,
  (nextMap, previousMap) => {
    clearScheduledRouteSync();
    previousMap?.off('load', handleMapStyleReady);
    previousMap?.off('style.load', handleMapStyleReady);
    previousMap?.off('idle', handleMapStyleReady);
    nextMap?.on('load', handleMapStyleReady);
    nextMap?.on('style.load', handleMapStyleReady);
    nextMap?.on('idle', handleMapStyleReady);
    syncRouteNowAndRetryIfStyleIsPending();
  },
  { immediate: true },
);

watch(
  () => [props.points, props.coordinates, props.styleKey, props.presentation, props.variant],
  () => {
    syncRouteNowAndRetryIfStyleIsPending();
  },
  { deep: true, immediate: true },
);

onMounted(() => {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') {
    return;
  }

  routeThemeObserver = new MutationObserver(() => {
    syncRouteNowAndRetryIfStyleIsPending();
  });
  routeThemeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
});

onBeforeUnmount(() => {
  clearScheduledRouteSync();
  routeThemeObserver?.disconnect();
  routeThemeObserver = null;
  props.mapInstance?.off('load', handleMapStyleReady);
  props.mapInstance?.off('style.load', handleMapStyleReady);
  props.mapInstance?.off('idle', handleMapStyleReady);
  removeRoute(props.mapInstance);
});
</script>
