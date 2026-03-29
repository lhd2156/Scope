import { ref } from 'vue';
import { defineStore } from 'pinia';
import { getFeed } from '@/services/feedService';
import type { FeedItem, PaginationMeta } from '@/types';
import { toAsyncErrorMessage } from '@/utils/errors';

export const useFeedStore = defineStore('feed', () => {
  const items = ref<FeedItem[]>([]);
  const meta = ref<PaginationMeta | null>(null);
  const loading = ref(false);
  const hasLoaded = ref(false);
  const error = ref<string | null>(null);

  async function fetchFeed(force = false) {
    if (loading.value || (hasLoaded.value && !force)) {
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const response = await getFeed();
      items.value = response.data;
      meta.value = response.meta ?? null;
      hasLoaded.value = true;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Atlas could not load the activity feed right now.');
      throw nextError;
    } finally {
      loading.value = false;
    }
  }

  return {
    items,
    meta,
    loading,
    hasLoaded,
    error,
    fetchFeed,
  };
});
