import { ref } from 'vue';
import { defineStore } from 'pinia';
import { cloneMapViewport, UNITED_STATES_MAP_VIEWPORT } from '@/config/mapViewport';
import type { MapViewport, SpotCategory } from '@/types';

export const DEFAULT_MAP_VIEWPORT: MapViewport = cloneMapViewport(UNITED_STATES_MAP_VIEWPORT);
export const MIN_MAP_ZOOM = 1.5;
export const MAX_MAP_ZOOM = 18;

const allCategories: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'entertainment', 'scenic', 'other'];

export const useMapStore = defineStore('map', () => {
  const viewport = ref<MapViewport>(cloneMapViewport(DEFAULT_MAP_VIEWPORT));
  const activeCategories = ref<SpotCategory[]>([...allCategories]);
  const visibleSpotIds = ref<string[]>([]);
  const visibleSpotIdsMeasured = ref(false);
  const selectedSpotId = ref<string | null>(null);
  const userLocation = ref<[number, number] | null>(null);

  function setCenter(center: [number, number]) {
    viewport.value = { ...viewport.value, center };
  }

  function setZoom(zoom: number) {
    viewport.value = { ...viewport.value, zoom: Math.min(Math.max(zoom, MIN_MAP_ZOOM), MAX_MAP_ZOOM) };
  }

  function setStyle(style: string) {
    viewport.value = { ...viewport.value, style };
  }

  function resetViewport() {
    viewport.value = cloneMapViewport(DEFAULT_MAP_VIEWPORT);
  }

  function toggleCategory(category: SpotCategory) {
    if (activeCategories.value.includes(category)) {
      activeCategories.value = activeCategories.value.filter((entry) => entry !== category);
      return;
    }

    activeCategories.value = [...activeCategories.value, category];
  }

  function setActiveCategories(categories: SpotCategory[]) {
    const nextCategories = allCategories.filter((category) => categories.includes(category));
    activeCategories.value = nextCategories;
  }

  function resetCategories() {
    activeCategories.value = [...allCategories];
  }

  function setVisibleSpotIds(spotIds: string[]) {
    visibleSpotIds.value = spotIds;
    visibleSpotIdsMeasured.value = true;
  }

  function resetVisibleSpotIds() {
    visibleSpotIds.value = [];
    visibleSpotIdsMeasured.value = false;
  }

  function setSelectedSpotId(spotId: string | null) {
    selectedSpotId.value = spotId;
  }

  function setUserLocation(coordinates: [number, number] | null) {
    userLocation.value = coordinates;
  }

  return {
    viewport,
    activeCategories,
    visibleSpotIds,
    visibleSpotIdsMeasured,
    selectedSpotId,
    userLocation,
    setCenter,
    setZoom,
    setStyle,
    resetViewport,
    toggleCategory,
    setActiveCategories,
    resetCategories,
    setVisibleSpotIds,
    resetVisibleSpotIds,
    setSelectedSpotId,
    setUserLocation,
  };
});
