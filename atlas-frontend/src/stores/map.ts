import { ref } from 'vue';
import { defineStore } from 'pinia';
import { mockViewport } from '@/services/mockData';
import type { MapViewport } from '@/types';

export const useMapStore = defineStore('map', () => {
  const viewport = ref<MapViewport>({ ...mockViewport });

  function setCenter(center: [number, number]) {
    viewport.value = { ...viewport.value, center };
  }

  function setZoom(zoom: number) {
    viewport.value = { ...viewport.value, zoom };
  }

  function setStyle(style: string) {
    viewport.value = { ...viewport.value, style };
  }

  return { viewport, setCenter, setZoom, setStyle };
});
