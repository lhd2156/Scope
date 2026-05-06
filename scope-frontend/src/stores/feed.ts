import { ref } from 'vue';
import { defineStore } from 'pinia';
import { getFeed, getTrendingSpots } from '@/services/feedService';
import type { FeedItem, PaginationMeta, SpotSummary } from '@/types';
import { toAsyncErrorMessage } from '@/utils/errors';

export const useFeedStore = defineStore('feed', () => {
  const items = ref<FeedItem[]>([]);
  const meta = ref<PaginationMeta | null>(null);
  const trendingSpots = ref<SpotSummary[]>([]);
  const loading = ref(false);
  const trendingLoading = ref(false);
  const hasLoaded = ref(false);
  const error = ref<string | null>(null);
  const trendingError = ref<string | null>(null);

  async function fetchFeed(force = false, page = 1, pageSize?: number) {
    if (loading.value || (hasLoaded.value && !force)) {
      return items.value;
    }

    loading.value = true;
    error.value = null;

    try {
      const response = await getFeed(page, pageSize);
      items.value = response.data;
      meta.value = response.meta ?? null;
      hasLoaded.value = true;
      return response.data;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not load the activity feed right now.');
      throw nextError;
    } finally {
      loading.value = false;
    }
  }

  async function fetchTrendingSpots(limit = 4) {
    trendingLoading.value = true;
    trendingError.value = null;

    try {
      const response = await getTrendingSpots(limit);
      trendingSpots.value = response.data;
      return response.data;
    } catch (nextError) {
      trendingError.value = toAsyncErrorMessage(nextError, 'Scope could not load trending spots right now.');
      throw nextError;
    } finally {
      trendingLoading.value = false;
    }
  }

  return {
    items,
    meta,
    trendingSpots,
    loading,
    trendingLoading,
    hasLoaded,
    error,
    trendingError,
    fetchFeed,
    fetchTrendingSpots,
  };
});
