import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { createSpot as createSpotRequest, getSpotDetail, listSpots, listTrendingSpots, updateSpot as updateSpotRequest } from '@/services/spotService';
import type { SpotDetail, SpotFilters, SpotFormSubmission, SpotSummary, UserProfile } from '@/types';

function toSpotSummary(spot: SpotDetail): SpotSummary {
  return {
    id: spot.id,
    title: spot.title,
    description: spot.description,
    latitude: spot.latitude,
    longitude: spot.longitude,
    address: spot.address,
    city: spot.city,
    country: spot.country,
    category: spot.category,
    vibe: spot.vibe,
    rating: spot.rating,
    photoUrl: spot.photoUrl ?? spot.photos[0]?.url,
    createdAt: spot.createdAt,
    author: spot.author,
    liked: spot.liked,
    likesCount: spot.likesCount,
  };
}

export const useSpotsStore = defineStore('spots', () => {
  const items = ref<SpotSummary[]>([]);
  const trending = ref<SpotSummary[]>([]);
  const selectedSpot = ref<SpotDetail | null>(null);
  const filters = ref<SpotFilters>({ page: 1, pageSize: 12 });
  const loading = ref(false);
  const saving = ref(false);

  const featuredSpots = computed(() => (trending.value.length ? trending.value : items.value.slice(0, 4)));

  function matchesActiveFilters(spot: SpotSummary): boolean {
    const activeFilters = filters.value;
    const matchesCategory = !activeFilters.category || spot.category === activeFilters.category;
    const matchesCity = !activeFilters.city || spot.city?.toLowerCase().includes(activeFilters.city.toLowerCase());
    const matchesVibe = !activeFilters.vibe || spot.vibe?.toLowerCase().includes(activeFilters.vibe.toLowerCase());
    return matchesCategory && matchesCity && matchesVibe;
  }

  function upsertCollection(collection: SpotSummary[], spot: SpotSummary): SpotSummary[] {
    const nextCollection = [...collection];
    const existingIndex = nextCollection.findIndex((entry) => entry.id === spot.id);

    if (existingIndex === -1) {
      nextCollection.unshift(spot);
      return nextCollection;
    }

    nextCollection.splice(existingIndex, 1, spot);
    return nextCollection;
  }

  function reconcileItems(spot: SpotSummary): void {
    const alreadyListed = items.value.some((entry) => entry.id === spot.id);
    if (alreadyListed && !matchesActiveFilters(spot)) {
      items.value = items.value.filter((entry) => entry.id !== spot.id);
      return;
    }

    if (matchesActiveFilters(spot)) {
      items.value = upsertCollection(items.value, spot);
    }
  }

  function reconcileTrending(spot: SpotSummary): void {
    if (!trending.value.some((entry) => entry.id === spot.id)) {
      return;
    }

    trending.value = upsertCollection(trending.value, spot);
  }

  async function fetchSpots(nextFilters: SpotFilters = filters.value) {
    loading.value = true;
    filters.value = { ...filters.value, ...nextFilters };

    try {
      const response = await listSpots(filters.value);
      items.value = response.data;
    } finally {
      loading.value = false;
    }
  }

  async function fetchTrending() {
    loading.value = true;

    try {
      const response = await listTrendingSpots();
      trending.value = response.data;
    } finally {
      loading.value = false;
    }
  }

  async function fetchSpot(spotId: string) {
    loading.value = true;
    selectedSpot.value = null;

    try {
      const response = await getSpotDetail(spotId);
      selectedSpot.value = response.data;
    } finally {
      loading.value = false;
    }
  }

  async function createSpot(submission: SpotFormSubmission, currentUser?: UserProfile | null): Promise<SpotDetail> {
    saving.value = true;

    try {
      const response = await createSpotRequest(submission, currentUser);
      selectedSpot.value = response.data;
      const summary = toSpotSummary(response.data);
      reconcileItems(summary);
      reconcileTrending(summary);
      return response.data;
    } finally {
      saving.value = false;
    }
  }

  async function updateSpot(spotId: string, submission: SpotFormSubmission, currentUser?: UserProfile | null): Promise<SpotDetail> {
    saving.value = true;

    try {
      const response = await updateSpotRequest(spotId, submission, currentUser);
      selectedSpot.value = response.data;
      const summary = toSpotSummary(response.data);
      reconcileItems(summary);
      reconcileTrending(summary);
      return response.data;
    } finally {
      saving.value = false;
    }
  }

  return {
    items,
    trending,
    selectedSpot,
    filters,
    loading,
    saving,
    featuredSpots,
    fetchSpots,
    fetchTrending,
    fetchSpot,
    createSpot,
    updateSpot,
  };
});
