import { ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { getFeed, getHomeActivityFeed, getTrendingSpots } from '@/services/feedService';
import { useAuthStore } from '@/stores/auth';
import type { FeedItem, PaginationMeta, SpotSummary } from '@/types';
import { toAsyncErrorMessage } from '@/utils/errors';
import { applyCurrentUserIdentityToFeedItems } from '@/utils/currentUserIdentity';

export const useFeedStore = defineStore('feed', () => {
  const authStore = useAuthStore();
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
      items.value = applyCurrentUserIdentityToFeedItems(response.data, authStore.currentUser);
      meta.value = response.meta ?? null;
      hasLoaded.value = true;
      return items.value;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not load the activity feed right now.');
      throw nextError;
    } finally {
      loading.value = false;
    }
  }

  async function fetchHomeActivityFeed(force = false, page = 1, pageSize?: number) {
    if (loading.value || (hasLoaded.value && !force)) {
      return items.value;
    }

    loading.value = true;
    error.value = null;

    try {
      const response = await getHomeActivityFeed(page, pageSize);
      items.value = applyCurrentUserIdentityToFeedItems(response.data, authStore.currentUser);
      meta.value = response.meta ?? null;
      hasLoaded.value = true;
      return items.value;
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

  watch(
    () => authStore.currentUser,
    (currentUser) => {
      items.value = applyCurrentUserIdentityToFeedItems(items.value, currentUser);
    },
    { deep: true },
  );

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
    fetchHomeActivityFeed,
    fetchTrendingSpots,
  };
});
