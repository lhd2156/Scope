import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { generateItinerary, getTripDetail, listTrips } from '@/services/tripService';
import type { Itinerary, Trip, TripPlannerInput } from '@/types';

export const useTripsStore = defineStore('trips', () => {
  const items = ref<Trip[]>([]);
  const selectedTrip = ref<Trip | null>(null);
  const previewItinerary = ref<Itinerary | null>(null);
  const loading = ref(false);

  const featuredTrips = computed(() => items.value.slice(0, 3));

  async function fetchTrips() {
    loading.value = true;

    try {
      const response = await listTrips();
      items.value = response.data;
    } finally {
      loading.value = false;
    }
  }

  async function fetchTrip(tripId: string) {
    loading.value = true;
    selectedTrip.value = null;

    try {
      const response = await getTripDetail(tripId);
      selectedTrip.value = response.data;
    } finally {
      loading.value = false;
    }
  }

  async function buildItinerary(input: TripPlannerInput) {
    loading.value = true;

    try {
      const response = await generateItinerary(input);
      previewItinerary.value = response.data;
    } finally {
      loading.value = false;
    }
  }

  return {
    items,
    selectedTrip,
    previewItinerary,
    loading,
    featuredTrips,
    fetchTrips,
    fetchTrip,
    buildItinerary,
  };
});
