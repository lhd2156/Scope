import { ref } from 'vue';
import { defineStore } from 'pinia';
import { generateItinerary } from '@/services/intelService';
import { getTripDetail, listTrips } from '@/services/tripService';
import type { Itinerary, Trip, TripPlannerInput } from '@/types';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Atlas could not load that trip right now.';
}

export const useTripsStore = defineStore('trips', () => {
  const items = ref<Trip[]>([]);
  const selectedTrip = ref<Trip | null>(null);
  const previewItinerary = ref<Itinerary | null>(null);
  const loading = ref(false);
  const planning = ref(false);
  const error = ref<string | null>(null);

  async function fetchTrips() {
    loading.value = true;
    error.value = null;

    try {
      const response = await listTrips();
      items.value = response.data;
    } catch (nextError) {
      error.value = toErrorMessage(nextError);
      throw nextError;
    } finally {
      loading.value = false;
    }
  }

  async function fetchTrip(tripId: string) {
    loading.value = true;
    selectedTrip.value = null;
    error.value = null;

    try {
      const response = await getTripDetail(tripId);
      selectedTrip.value = response.data;
    } catch (nextError) {
      error.value = toErrorMessage(nextError);
      throw nextError;
    } finally {
      loading.value = false;
    }
  }

  async function buildItinerary(input: TripPlannerInput) {
    planning.value = true;
    error.value = null;

    try {
      const response = await generateItinerary(input);
      previewItinerary.value = response.data;
    } catch (nextError) {
      error.value = 'Atlas could not generate an itinerary right now.';
      throw nextError;
    } finally {
      planning.value = false;
    }
  }

  return {
    items,
    selectedTrip,
    previewItinerary,
    loading,
    planning,
    error,
    fetchTrips,
    fetchTrip,
    buildItinerary,
  };
});
