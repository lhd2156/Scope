<template>
  <span hidden aria-hidden="true" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import type mapboxgl from 'mapbox-gl';
import type { MapPoint } from '@/types';

type RouteCoordinate = [number, number];

const SOURCE_ID = 'scope-route-source';
const OUTLINE_LAYER_ID = 'scope-route-outline';
const LINE_LAYER_ID = 'scope-route-line';

const props = withDefaults(
  defineProps<{
    mapInstance: mapboxgl.Map | null;
    points: MapPoint[];
    coordinates?: RouteCoordinate[];
    styleKey?: string;
    variant?: 'default' | 'planner';
  }>(),
  {
    coordinates: () => [],
    styleKey: 'default',
    variant: 'default',
  },
);

function readCssToken(tokenName: string): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim();
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
        },
        paint: {
          'line-color': readCssToken('--bg-primary') || readCssToken('--border'),
          'line-width': props.variant === 'planner' ? 6 : 8,
          'line-opacity': props.variant === 'planner' ? 0.45 : 0.75,
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
        },
        paint: {
          'line-color': readCssToken('--accent-gold') || readCssToken('--accent-teal'),
          'line-width': props.variant === 'planner' ? 3.5 : 4,
        },
      });
    } catch {
      return;
    }
  }
}

function syncRouteStyle(map: mapboxgl.Map) {
  const outlineColor = readCssToken('--bg-primary') || readCssToken('--border');
  const defaultRouteColor = readCssToken('--accent-gold');
  const plannerRouteColor = readCssToken('--accent-teal');
  const routeColor = props.variant === 'planner' ? plannerRouteColor : defaultRouteColor;

  if (!outlineColor || !routeColor || typeof map.setPaintProperty !== 'function') {
    return;
  }

  try {
    map.setPaintProperty(OUTLINE_LAYER_ID, 'line-color', outlineColor);
    map.setPaintProperty(OUTLINE_LAYER_ID, 'line-width', props.variant === 'planner' ? 6 : 8);
    map.setPaintProperty(OUTLINE_LAYER_ID, 'line-opacity', props.variant === 'planner' ? 0.45 : 0.75);

    map.setPaintProperty(LINE_LAYER_ID, 'line-color', routeColor);
    map.setPaintProperty(LINE_LAYER_ID, 'line-width', props.variant === 'planner' ? 3.5 : 4);
    map.setPaintProperty(LINE_LAYER_ID, 'line-dasharray', [1, 0.001]);
  } catch {
    // The layer may disappear during a Mapbox style swap or map teardown.
  }
}

function upsertRoute() {
  const map = props.mapInstance;
  if (!map || !isRouteStyleReady(map)) {
    return;
  }

  const collection = buildRouteCollection();
  if (!collection.features.length) {
    removeRoute(map);
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
}

function handleStyleLoad() {
  upsertRoute();
}

watch(
  () => props.mapInstance,
  (nextMap, previousMap) => {
    previousMap?.off('style.load', handleStyleLoad);
    nextMap?.on('style.load', handleStyleLoad);
    upsertRoute();
  },
  { immediate: true },
);

watch(
  () => [props.points, props.coordinates, props.styleKey, props.variant],
  () => {
    upsertRoute();
  },
  { deep: true, immediate: true },
);

onBeforeUnmount(() => {
  props.mapInstance?.off('style.load', handleStyleLoad);
  removeRoute(props.mapInstance);
});
</script>
