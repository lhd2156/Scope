<template>
  <section class="map-view">
    <div ref="mapContainer" class="map-canvas" :class="{ 'is-fallback': !hasToken }" />

    <div v-if="!hasToken" class="map-fallback" data-test="map-fallback-stage" aria-hidden="true">
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
      :interactive="hasToken"
      :show-filter-panel="showFilterPanel"
      @zoom-in="handleZoom(1)"
      @zoom-out="handleZoom(-1)"
      @locate="handleLocate"
      @fit-route="fitToRoute"
      @reset-filters="mapStore.resetCategories"
      @toggle-category="mapStore.toggleCategory"
    />

    <section v-if="!hasToken" class="empty-state glass-panel">
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
import MapControls from '@/components/map/MapControls.vue';
import LocationTracker from '@/components/map/LocationTracker.vue';
import RouteLayer from '@/components/map/RouteLayer.vue';
import SpotMarker from '@/components/map/SpotMarker.vue';
import { loadMapboxRuntime } from '@/services/mapboxLoader';
import { useMapStore } from '@/stores/map';
import type { MapPoint, SpotCategory, UserLocation } from '@/types';

type TrackingState = 'idle' | 'locating' | 'tracking' | 'denied' | 'unsupported' | 'error';

type LocationTrackerInstance = ComponentPublicInstance & {
  focusUserLocation: () => UserLocation | null;
};

interface MarkerController {
  id: string;
  app: VueApp<Element>;
  marker: mapboxgl.Marker;
}

interface FallbackMarker {
  id: string;
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

const fallbackTerrainPaths = [
  'M 54 142 C 148 74 298 56 422 118 C 534 176 586 292 560 384 C 526 510 380 562 268 618 C 198 652 146 734 88 712 C 30 690 38 590 26 484 C 16 390 -18 198 54 142 Z',
  'M 298 468 C 370 392 520 370 612 430 C 722 504 742 646 676 742 C 614 828 458 860 340 806 C 236 758 204 566 298 468 Z',
  'M 690 112 C 796 60 944 86 1034 178 C 1128 274 1146 444 1076 556 C 998 682 810 730 680 672 C 574 624 534 448 570 316 C 596 220 622 144 690 112 Z',
  'M 888 586 C 960 542 1050 556 1114 620 C 1182 690 1182 802 1106 850 C 1018 906 854 902 786 822 C 734 760 786 648 888 586 Z',
];
const fallbackRingSizes = [168, 248, 332];

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
const hasToken = Boolean((import.meta.env.VITE_MAPBOX_TOKEN ?? '').trim());
const mapStyle = ref(mapStore.viewport.style);

let themeObserver: MutationObserver | null = null;
let syncingViewport = false;

function handleWindowResize() {
  map.value?.resize();
  updateVisibleSpotIds();
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
const fallbackMarkers = computed<FallbackMarker[]>(() => {
  const projectedSource = filteredSpots.value.length ? filteredSpots.value : props.spots;
  const activeMarkerId = selectedSpotId.value ?? props.routePoints[0]?.id ?? projectedSource[0]?.id ?? null;

  return projectedSource.map((spot, index) => {
    const x = Number((((spot.longitude + 180) / 360) * FALLBACK_VIEWPORT.width).toFixed(2));
    const y = Number((((90 - spot.latitude) / 180) * FALLBACK_VIEWPORT.height).toFixed(2));
    const label = (spot.city || spot.title).trim().slice(0, 22) || 'Atlas pin';
    const labelWidth = Math.min(Math.max(label.length * 8 + 30, 104), 180);
    const labelX = clampNumber(x + 18, 18, FALLBACK_VIEWPORT.width - labelWidth - 18);
    const labelY = clampNumber(y - 44, 18, FALLBACK_VIEWPORT.height - 48);
    const sequence = routeOrderLookup.value.get(spot.id) ?? null;
    const isActive = spot.id === activeMarkerId;

    return {
      id: spot.id,
      category: spot.category,
      x,
      y,
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

  const projectedRoutePoints = props.routePoints.map((point) => ({
    x: Number((((point.longitude + 180) / 360) * FALLBACK_VIEWPORT.width).toFixed(2)),
    y: Number((((90 - point.latitude) / 180) * FALLBACK_VIEWPORT.height).toFixed(2)),
  }));

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

function resolveMapStyle(): string {
  if (typeof window === 'undefined') {
    return mapStore.viewport.style;
  }

  const tokenValue = getComputedStyle(document.documentElement).getPropertyValue('--map-style').trim();
  return tokenValue || mapStore.viewport.style;
}

function handleTrackingState(nextState: TrackingState) {
  trackingState.value = nextState;
}

async function getMapboxRuntime() {
  if (!mapboxRuntime.value) {
    mapboxRuntime.value = await loadMapboxRuntime();
  }

  return mapboxRuntime.value;
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

function updateVisibleSpotIds() {
  const instance = map.value;
  if (!instance || !hasToken) {
    mapStore.setVisibleSpotIds(filteredSpots.value.map((spot) => spot.id));
    return;
  }

  const bounds = instance.getBounds();
  const visibleIds = filteredSpots.value
    .filter((spot) => bounds.contains([spot.longitude, spot.latitude]))
    .map((spot) => spot.id);

  mapStore.setVisibleSpotIds(visibleIds);
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

function renderSpotMarkers() {
  clearSpotMarkers();

  const instance = map.value;
  const runtime = mapboxRuntime.value;
  if (!instance || !runtime || !hasToken) {
    updateVisibleSpotIds();
    return;
  }

  filteredSpots.value.forEach((spot) => {
    const mountTarget = document.createElement('div');
    const app = createApp(SpotMarker, {
      spot,
      active: selectedSpotId.value === spot.id,
      variant: props.markerVariant,
      sequence: routeOrderLookup.value.get(spot.id) ?? null,
      onSelect: () => handleSpotSelect(spot),
    });

    app.mount(mountTarget);

    const marker = new runtime.Marker({
      element: mountTarget,
      anchor: 'bottom',
    })
      .setLngLat([spot.longitude, spot.latitude])
      .addTo(instance);

    markerControllers.set(spot.id, { id: spot.id, app, marker });
  });

  updateVisibleSpotIds();
}

function fitToPoints(points: MapPoint[]) {
  const instance = map.value;
  const runtime = mapboxRuntime.value;
  if (!instance || !runtime || !points.length || !hasToken) {
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
  fitToPoints(props.routePoints.length > 1 ? props.routePoints : filteredSpots.value);
}

function handleZoom(delta: number) {
  const instance = map.value;
  if (!instance || !hasToken) {
    return;
  }

  instance.easeTo({
    zoom: Math.min(Math.max(instance.getZoom() + delta, 2), 18),
    duration: 250,
  });
}

function centerOnLocation(location: UserLocation) {
  const instance = map.value;
  if (!instance || !hasToken) {
    return;
  }

  instance.easeTo({
    center: [location.longitude, location.latitude],
    zoom: Math.max(instance.getZoom(), 12),
    duration: 650,
  });
}

function handleLocate() {
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

  if (instance && runtime && hasToken) {
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
}

function syncThemeToMap() {
  mapStyle.value = resolveMapStyle();
  mapStore.setStyle(mapStyle.value);

  if (map.value && hasToken && map.value.getStyle().sprite !== undefined) {
    map.value.setStyle(mapStyle.value);
  }
}

async function setupMap() {
  if (!mapContainer.value || !hasToken || map.value) {
    updateVisibleSpotIds();
    return;
  }

  const runtime = await getMapboxRuntime();
  if (!mapContainer.value || map.value) {
    updateVisibleSpotIds();
    return;
  }

  runtime.accessToken = String(import.meta.env.VITE_MAPBOX_TOKEN);
  mapStyle.value = resolveMapStyle();
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

    emit('map-click', {
      latitude: Number(event.lngLat.lat.toFixed(6)),
      longitude: Number(event.lngLat.lng.toFixed(6)),
    });
  });

  instance.on('load', () => {
    renderSpotMarkers();
    updateVisibleSpotIds();
  });
  instance.on('moveend', () => {
    syncViewportFromMap();
    updateVisibleSpotIds();
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
  () => filteredSpots.value.map((spot) => spot.id),
  () => {
    if (!filteredSpots.value.some((spot) => spot.id === selectedSpotId.value)) {
      mapStore.setSelectedSpotId(filteredSpots.value[0]?.id ?? null);
    }

    nextTick(() => {
      renderSpotMarkers();
    });
  },
  { immediate: true },
);

watch(
  () => selectedSpotId.value,
  (nextSelectedSpotId, previousSelectedSpotId) => {
    if (!nextSelectedSpotId) {
      renderSpotMarkers();
      return;
    }

    if (nextSelectedSpotId !== previousSelectedSpotId) {
      const selectedSpot = props.spots.find((spot) => spot.id === nextSelectedSpotId);
      if (selectedSpot && map.value && hasToken) {
        map.value.easeTo({
          center: [selectedSpot.longitude, selectedSpot.latitude],
          duration: 500,
        });
      }
    }

    renderSpotMarkers();
  },
);

watch(
  () => [mapStore.viewport.center[0], mapStore.viewport.center[1], mapStore.viewport.zoom] as const,
  ([longitude, latitude, zoom]) => {
    const instance = map.value;
    if (!instance || syncingViewport || !hasToken) {
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
    if (hasInitialFit.value || !map.value || !hasToken) {
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
  void setupMap();
  themeObserver = new MutationObserver(syncThemeToMap);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  window.addEventListener('resize', handleWindowResize);
});

onBeforeUnmount(() => {
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
