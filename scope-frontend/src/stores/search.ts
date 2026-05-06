import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  searchContent,
  searchNearby,
  type GeoSearchResponse,
  type SearchResponse,
} from '@/services/searchService';

export const useSearchStore = defineStore('search', () => {
  const results = ref<SearchResponse | null>(null);
  const geoResults = ref<GeoSearchResponse | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastQuery = ref('');

  async function search(query: string, type: 'spots' | 'reviews' | 'trips' = 'spots', limit = 20, offset = 0) {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      results.value = null;
      return;
    }

    loading.value = true;
    error.value = null;
    lastQuery.value = trimmedQuery;

    try {
      results.value = await searchContent(trimmedQuery, type, limit, offset);
    } catch (caughtError: unknown) {
      error.value = caughtError instanceof Error ? caughtError.message : 'Search failed';
      results.value = null;
    } finally {
      loading.value = false;
    }
  }

  async function nearby(lat: number, lon: number, radiusKm = 10, limit = 20) {
    loading.value = true;
    error.value = null;

    try {
      geoResults.value = await searchNearby(lat, lon, radiusKm, limit);
    } catch (caughtError: unknown) {
      error.value = caughtError instanceof Error ? caughtError.message : 'Nearby search failed';
      geoResults.value = null;
    } finally {
      loading.value = false;
    }
  }

  function clearResults() {
    results.value = null;
    geoResults.value = null;
    error.value = null;
    lastQuery.value = '';
  }

  return { results, geoResults, loading, error, lastQuery, search, nearby, clearResults };
});
