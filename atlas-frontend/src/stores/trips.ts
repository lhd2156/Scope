import { ref } from 'vue';
import { defineStore } from 'pinia';
import { generateItinerary, getTripDetail, listTrips } from '@/services/tripService';
import type { Itinerary, Trip, TripPlannerInput } from '@/types';

export const useTripsStore = defineStore('trips', () => {
  const items = ref<Trip[]>([]);
  const selectedTrip = ref<Trip | null>(null);
  const previewItinerary = ref<Itinerary | null>(null);
  const loading = ref(false);

  async function fetchTrips() {
    loading.value = true;
    const response = await listTrips();
    items.value = response.data;
    loading.value = false;
  }

  async function fetchTrip(tripId: string) {
    loading.value = true;
    const response = await getTripDetail(tripId);
    selectedTrip.value = response.data;
    loading.value = false;
  }

  async function buildItinerary(input: TripPlannerInput) {
    loading.value = true;
    const response = await generateItinerary(input);
    previewItinerary.value = response.data;
    loading.value = false;
  }

  return {
    items,
    selectedTrip,
    previewItinerary,
    loading,
    fetchTrips,
    fetchTrip,
    buildItinerary,
  };
});
