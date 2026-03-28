import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { getSpotDetail, listSpots, listTrendingSpots } from '@/services/spotService';
import type { SpotDetail, SpotFilters, SpotSummary } from '@/types';

export const useSpotsStore = defineStore('spots', () => {
  const items = ref<SpotSummary[]>([]);
  const trending = ref<SpotSummary[]>([]);
  const selectedSpot = ref<SpotDetail | null>(null);
  const filters = ref<SpotFilters>({ page: 1, pageSize: 12 });
  const loading = ref(false);

  const featuredSpots = computed(() => trending.value.length ? trending.value : items.value.slice(0, 4));

  async function fetchSpots(nextFilters: SpotFilters = filters.value) {
    loading.value = true;
    filters.value = { ...filters.value, ...nextFilters };
    const response = await listSpots(filters.value);
    items.value = response.data;
    loading.value = false;
  }

  async function fetchTrending() {
    const response = await listTrendingSpots();
    trending.value = response.data;
  }

  async function fetchSpot(spotId: string) {
    loading.value = true;
    const response = await getSpotDetail(spotId);
    selectedSpot.value = response.data;
    loading.value = false;
  }

  return {
    items,
    trending,
    selectedSpot,
    filters,
    loading,
    featuredSpots,
    fetchSpots,
    fetchTrending,
    fetchSpot,
  };
});
