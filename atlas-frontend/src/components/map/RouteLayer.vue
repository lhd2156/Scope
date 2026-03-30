<template />

<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import type mapboxgl from 'mapbox-gl';
import type { MapPoint } from '@/types';

const SOURCE_ID = 'atlas-route-source';
const OUTLINE_LAYER_ID = 'atlas-route-outline';
const LINE_LAYER_ID = 'atlas-route-line';

const props = withDefaults(
  defineProps<{
    mapInstance: mapboxgl.Map | null;
    points: MapPoint[];
    styleKey?: string;
    variant?: 'default' | 'planner';
  }>(),
  {
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

function buildRouteCollection() {
  if (props.points.length < 2) {
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
          coordinates: props.points.map((point) => [point.longitude, point.latitude]),
        },
      },
    ],
  } as const;
}

function removeRoute(map: mapboxgl.Map | null) {
  if (!map) {
    return;
  }

  if (map.getLayer(LINE_LAYER_ID)) {
    map.removeLayer(LINE_LAYER_ID);
  }

  if (map.getLayer(OUTLINE_LAYER_ID)) {
    map.removeLayer(OUTLINE_LAYER_ID);
  }

  if (map.getSource(SOURCE_ID)) {
    map.removeSource(SOURCE_ID);
  }
}

function ensureLineLayers(map: mapboxgl.Map) {
  if (!map.getLayer(OUTLINE_LAYER_ID)) {
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
  }

  if (!map.getLayer(LINE_LAYER_ID)) {
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

  map.setPaintProperty(OUTLINE_LAYER_ID, 'line-color', outlineColor);
  map.setPaintProperty(OUTLINE_LAYER_ID, 'line-width', props.variant === 'planner' ? 6 : 8);
  map.setPaintProperty(OUTLINE_LAYER_ID, 'line-opacity', props.variant === 'planner' ? 0.45 : 0.75);

  map.setPaintProperty(LINE_LAYER_ID, 'line-color', routeColor);
  map.setPaintProperty(LINE_LAYER_ID, 'line-width', props.variant === 'planner' ? 3.5 : 4);
  map.setPaintProperty(LINE_LAYER_ID, 'line-dasharray', props.variant === 'planner' ? [1.2, 1.8] : [1, 0.001]);
}

function upsertRoute() {
  const map = props.mapInstance;
  if (!map || !map.isStyleLoaded()) {
    return;
  }

  const collection = buildRouteCollection();
  if (!collection.features.length) {
    removeRoute(map);
    return;
  }

  const existingSource = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
  if (existingSource) {
    existingSource.setData(collection);
  } else {
    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: collection,
    });
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
  () => [props.points, props.styleKey, props.variant],
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
