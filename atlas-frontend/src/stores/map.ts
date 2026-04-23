import { ref } from 'vue';
import { defineStore } from 'pinia';
import { DEFAULT_MAP_STYLE } from '@/services/mapboxLoader';
import type { MapViewport, SpotCategory } from '@/types';

const DEFAULT_MAP_VIEWPORT: MapViewport = {
  center: [-97.7431, 30.2672],
  zoom: 5.6,
  style: DEFAULT_MAP_STYLE,
};

const allCategories: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'scenic', 'other'];

export const useMapStore = defineStore('map', () => {
  const viewport = ref<MapViewport>({ ...DEFAULT_MAP_VIEWPORT });
  const activeCategories = ref<SpotCategory[]>([...allCategories]);
  const visibleSpotIds = ref<string[]>([]);
  const selectedSpotId = ref<string | null>(null);
  const userLocation = ref<[number, number] | null>(null);

  function setCenter(center: [number, number]) {
    viewport.value = { ...viewport.value, center };
  }

  function setZoom(zoom: number) {
    viewport.value = { ...viewport.value, zoom: Math.min(Math.max(zoom, 2), 18) };
  }

  function setStyle(style: string) {
    viewport.value = { ...viewport.value, style };
  }

  function toggleCategory(category: SpotCategory) {
    if (activeCategories.value.includes(category)) {
      activeCategories.value = activeCategories.value.filter((entry) => entry !== category);
      if (!activeCategories.value.length) {
        activeCategories.value = [category];
      }
      return;
    }

    activeCategories.value = [...activeCategories.value, category];
  }

  function resetCategories() {
    activeCategories.value = [...allCategories];
  }

  function setVisibleSpotIds(spotIds: string[]) {
    visibleSpotIds.value = spotIds;
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
    selectedSpotId,
    userLocation,
    setCenter,
    setZoom,
    setStyle,
    toggleCategory,
    resetCategories,
    setVisibleSpotIds,
    setSelectedSpotId,
    setUserLocation,
  };
});
