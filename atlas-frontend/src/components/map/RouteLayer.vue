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
  }>(),
  {
    styleKey: 'default',
  },
);

function readCssToken(tokenName: string, fallback: string): string {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const value = getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim();
  return value || fallback;
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
        'line-color': readCssToken('--bg-primary', '#0f0f1a'),
        'line-width': 8,
        'line-opacity': 0.75,
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
        'line-color': readCssToken('--accent-gold', '#f59e0b'),
        'line-width': 4,
      },
    });
  }
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
  () => [props.points, props.styleKey],
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
