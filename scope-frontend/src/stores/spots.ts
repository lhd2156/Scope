import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  createSpot as createSpotRequest,
  deleteSpot as deleteSpotRequest,
  getSpotDetail,
  likeSpot as likeSpotRequest,
  listNearbySpots,
  listSpots,
  listTrendingSpots,
  unlikeSpot as unlikeSpotRequest,
  updateSpot as updateSpotRequest,
  type NearbySpotFilters,
} from '@/services/spotService';
import { trackSpotCreate } from '@/services/analyticsService';
import type { PaginationMeta, SpotDetail, SpotFilters, SpotFormSubmission, SpotSummary, UserProfile } from '@/types';
import { toAsyncErrorMessage } from '@/utils/errors';
import { rankTrendingSpots } from '@/utils/spotRanking';

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
    pillars: spot.pillars,
    vibe: spot.vibe,
    rating: spot.rating,
    photoUrl: spot.photoUrl ?? spot.photos[0]?.url,
    createdAt: spot.createdAt,
    isPublic: spot.isPublic ?? true,
    userId: spot.userId,
    author: spot.author,
    liked: spot.liked,
    likesCount: spot.likesCount,
    verificationStatus: spot.verificationStatus,
    verificationSource: spot.verificationSource,
    providerPlaceId: spot.providerPlaceId,
    providerPlaceName: spot.providerPlaceName,
    providerPlaceAddress: spot.providerPlaceAddress,
    verificationDistanceMeters: spot.verificationDistanceMeters,
    verifiedAt: spot.verifiedAt,
    safetyStatus: spot.safetyStatus,
    safetyReason: spot.safetyReason,
  };
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

function removeFromCollection(collection: SpotSummary[], spotId: string): SpotSummary[] {
  return collection.filter((entry) => entry.id !== spotId);
}

function recordSpotCreateAnalytics(payload: {
  spotId: string;
  category: SpotDetail['category'];
  city?: string;
  photoCount: number;
  isPublic: boolean;
  routeName: string;
}): void {
  trackSpotCreate(payload);
}

export const useSpotsStore = defineStore('spots', () => {
  const items = ref<SpotSummary[]>([]);
  const meta = ref<PaginationMeta | null>(null);
  const trending = ref<SpotSummary[]>([]);
  const nearby = ref<SpotSummary[]>([]);
  const nearbyMeta = ref<PaginationMeta | null>(null);
  const selectedSpot = ref<SpotDetail | null>(null);
  const filters = ref<SpotFilters>({ page: 1, pageSize: 12 });
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);

  const featuredSpots = computed(() => rankTrendingSpots(trending.value.length ? trending.value : items.value, 4));
  const likedSpots = computed(() => {
    const byId = new Map<string, SpotSummary>();
    const collections = [items.value, trending.value, nearby.value];

    collections.forEach((collection) => {
      collection.forEach((spot) => {
        if (spot.liked) {
          byId.set(spot.id, spot);
        }
      });
    });

    if (selectedSpot.value?.liked) {
      byId.set(selectedSpot.value.id, toSpotSummary(selectedSpot.value));
    }

    return [...byId.values()];
  });

  function matchesActiveFilters(spot: SpotSummary): boolean {
    const activeFilters = filters.value;
    const matchesCategory = !activeFilters.category || spot.category === activeFilters.category;
    const matchesCity = !activeFilters.city || spot.city?.toLowerCase().includes(activeFilters.city.toLowerCase());
    const matchesVibe = !activeFilters.vibe || spot.vibe?.toLowerCase().includes(activeFilters.vibe.toLowerCase());
    return matchesCategory && matchesCity && matchesVibe;
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

  function reconcileNearby(spot: SpotSummary): void {
    if (!nearby.value.some((entry) => entry.id === spot.id)) {
      return;
    }

    nearby.value = upsertCollection(nearby.value, spot);
  }

  function applySpotDetail(detail: SpotDetail): void {
    selectedSpot.value = detail;
    const summary = toSpotSummary(detail);
    reconcileItems(summary);
    reconcileTrending(summary);
    reconcileNearby(summary);
  }

  async function fetchSpots(nextFilters: SpotFilters = filters.value) {
    loading.value = true;
    error.value = null;
    filters.value = { ...filters.value, ...nextFilters };

    try {
      const response = await listSpots(filters.value);
      items.value = response.data;
      meta.value = response.meta ?? null;
      return response.data;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not load spots right now.');
      throw nextError;
    } finally {
      loading.value = false;
    }
  }

  async function fetchTrending(limit = 4) {
    loading.value = true;
    error.value = null;

    try {
      const response = await listTrendingSpots(limit);
      trending.value = response.data;
      return response.data;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not load trending spots right now.');
      throw nextError;
    } finally {
      loading.value = false;
    }
  }

  async function fetchNearby(filtersInput: NearbySpotFilters) {
    loading.value = true;
    error.value = null;

    try {
      const response = await listNearbySpots(filtersInput);
      nearby.value = response.data;
      nearbyMeta.value = response.meta ?? null;
      return response.data;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not load nearby spots right now.');
      throw nextError;
    } finally {
      loading.value = false;
    }
  }

  async function fetchSpot(spotId: string) {
    loading.value = true;
    error.value = null;
    selectedSpot.value = null;

    try {
      const response = await getSpotDetail(spotId);
      selectedSpot.value = response.data;
      return response.data;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not load that spot right now.');
      throw nextError;
    } finally {
      loading.value = false;
    }
  }

  async function createSpot(submission: SpotFormSubmission, currentUser?: UserProfile | null): Promise<SpotDetail> {
    saving.value = true;
    error.value = null;

    try {
      const response = await createSpotRequest(submission, currentUser);
      applySpotDetail(response.data);
      recordSpotCreateAnalytics({
        spotId: response.data.id,
        category: response.data.category,
        city: response.data.city,
        photoCount: submission.existingPhotos.length + submission.newPhotos.length,
        isPublic: submission.spot.isPublic,
        routeName: 'spot-create',
      });
      return response.data;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not save that spot right now.');
      throw nextError;
    } finally {
      saving.value = false;
    }
  }

  async function updateSpot(spotId: string, submission: SpotFormSubmission, currentUser?: UserProfile | null): Promise<SpotDetail> {
    saving.value = true;
    error.value = null;

    try {
      const response = await updateSpotRequest(spotId, submission, currentUser);
      applySpotDetail(response.data);
      return response.data;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not update that spot right now.');
      throw nextError;
    } finally {
      saving.value = false;
    }
  }

  async function deleteSpot(spotId: string): Promise<void> {
    saving.value = true;
    error.value = null;

    try {
      await deleteSpotRequest(spotId);
      items.value = removeFromCollection(items.value, spotId);
      trending.value = removeFromCollection(trending.value, spotId);
      nearby.value = removeFromCollection(nearby.value, spotId);

      if (selectedSpot.value?.id === spotId) {
        selectedSpot.value = null;
      }
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not delete that spot right now.');
      throw nextError;
    } finally {
      saving.value = false;
    }
  }

  async function likeSpot(spotId: string): Promise<SpotDetail> {
    saving.value = true;
    error.value = null;

    try {
      const response = await likeSpotRequest(spotId);
      applySpotDetail(response.data);
      return response.data;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not like that spot right now.');
      throw nextError;
    } finally {
      saving.value = false;
    }
  }

  async function unlikeSpot(spotId: string): Promise<SpotDetail> {
    saving.value = true;
    error.value = null;

    try {
      const response = await unlikeSpotRequest(spotId);
      applySpotDetail(response.data);
      return response.data;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not remove that like right now.');
      throw nextError;
    } finally {
      saving.value = false;
    }
  }

  async function toggleLike(spotId: string): Promise<SpotDetail> {
    const currentSummary = selectedSpot.value?.id === spotId
      ? toSpotSummary(selectedSpot.value)
      : items.value.find((spot) => spot.id === spotId) ?? trending.value.find((spot) => spot.id === spotId) ?? nearby.value.find((spot) => spot.id === spotId);

    return currentSummary?.liked ? unlikeSpot(spotId) : likeSpot(spotId);
  }

  return {
    items,
    meta,
    trending,
    nearby,
    nearbyMeta,
    selectedSpot,
    filters,
    loading,
    saving,
    error,
    featuredSpots,
    likedSpots,
    fetchSpots,
    fetchTrending,
    fetchNearby,
    fetchSpot,
    createSpot,
    updateSpot,
    deleteSpot,
    likeSpot,
    unlikeSpot,
    toggleLike,
  };
});
