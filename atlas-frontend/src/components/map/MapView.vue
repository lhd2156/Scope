<template>
  <section class="map-view">
    <div ref="mapContainer" class="map-canvas" :class="{ 'is-fallback': !hasToken }" />

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
    radial-gradient(circle at top left, var(--accent-teal-light), transparent 35%),
    linear-gradient(180deg, var(--bg-tertiary), var(--bg-secondary));
}

.map-canvas {
  position: absolute;
  inset: 0;
}

.map-canvas.is-fallback {
  background:
    linear-gradient(90deg, transparent 49%, var(--glass-border) 50%, transparent 51%),
    linear-gradient(transparent 49%, var(--glass-border) 50%, transparent 51%),
    radial-gradient(circle at top left, var(--accent-teal-light), transparent 30%),
    radial-gradient(circle at bottom right, var(--accent-gold-light), transparent 30%),
    var(--bg-secondary);
  background-size: 4rem 4rem, 4rem 4rem, auto, auto, auto;
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
  width: min(32rem, calc(100% - 2rem));
  transform: translate(-50%, -50%);
  z-index: var(--z-sidebar);
  padding: var(--space-6);
  display: grid;
  gap: var(--space-4);
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
}
</style>
