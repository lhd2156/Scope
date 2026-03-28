import { ref } from 'vue';
import { defineStore } from 'pinia';
import { getFeed } from '@/services/feedService';
import type { FeedItem } from '@/types';

export const useFeedStore = defineStore('feed', () => {
  const items = ref<FeedItem[]>([]);
  const loading = ref(false);

  async function fetchFeed() {
    loading.value = true;
    const response = await getFeed();
    items.value = response.data;
    loading.value = false;
  }

  return { items, loading, fetchFeed };
});
