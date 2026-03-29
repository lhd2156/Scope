import { ref } from 'vue';
import { defineStore } from 'pinia';
import { getFeed } from '@/services/feedService';
import type { FeedItem, PaginationMeta } from '@/types';

export const useFeedStore = defineStore('feed', () => {
  const items = ref<FeedItem[]>([]);
  const meta = ref<PaginationMeta | null>(null);
  const loading = ref(false);
  const hasLoaded = ref(false);

  async function fetchFeed(force = false) {
    if (loading.value || (hasLoaded.value && !force)) {
      return;
    }

    loading.value = true;

    try {
      const response = await getFeed();
      items.value = response.data;
      meta.value = response.meta ?? null;
      hasLoaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  return {
    items,
    meta,
    loading,
    hasLoaded,
    fetchFeed,
  };
});
