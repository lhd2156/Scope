import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { trackItineraryGenerate, trackTripCreate } from '@/services/analyticsService';
import { generateItinerary } from '@/services/intelService';
import {
  addTripSpot as addTripSpotRequest,
  createTrip as createTripRequest,
  deleteTrip as deleteTripRequest,
  getTripDetail,
  getTripMembers,
  inviteTripMember as inviteTripMemberRequest,
  listTrips,
  removeTripSpot as removeTripSpotRequest,
  reorderTripSpots as reorderTripSpotsRequest,
  updateTrip as updateTripRequest,
  type ReorderTripSpotsInput,
  type TripMutationInput,
} from '@/services/tripService';
import type { Itinerary, PaginationMeta, Trip, TripInviteInput, TripMember, TripPlannerInput, TripSpot } from '@/types';
import { toAsyncErrorMessage } from '@/utils/errors';

function upsertTrip(collection: Trip[], trip: Trip): Trip[] {
  const nextCollection = [...collection];
  const existingIndex = nextCollection.findIndex((entry) => entry.id === trip.id);

  if (existingIndex === -1) {
    nextCollection.unshift(trip);
    return nextCollection;
  }

  nextCollection.splice(existingIndex, 1, trip);
  return nextCollection;
}

interface BuildItineraryOptions {
  source?: 'auto' | 'user';
}

function recordTripCreateAnalytics(payload: {
  tripId: string;
  destination: string;
  stopCount: number;
  memberCount: number;
  isPublic: boolean;
  budget?: number;
  routeName: string;
}): void {
  trackTripCreate(payload);
}

function recordItineraryGenerateAnalytics(payload: {
  itineraryId: string;
  destination: string;
  dayCount: number;
  stopCount: number;
  totalEstimatedCost: number;
  budget?: number;
  groupSize: number;
  interestCount: number;
  pace: TripPlannerInput['pace'];
  routeName: string;
  source: 'user';
}): void {
  trackItineraryGenerate(payload);
}

export const useTripsStore = defineStore('trips', () => {
  const items = ref<Trip[]>([]);
  const meta = ref<PaginationMeta | null>(null);
  const selectedTrip = ref<Trip | null>(null);
  const members = ref<TripMember[]>([]);
  const previewItinerary = ref<Itinerary | null>(null);
  const loading = ref(false);
  const planning = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);

  const activeTrip = computed(() => selectedTrip.value ?? items.value[0] ?? null);

  function syncSelectedTrip(trip: Trip): void {
    selectedTrip.value = trip;
    members.value = trip.members;
    items.value = upsertTrip(items.value, trip);
  }

  async function fetchTrips(page = 1, pageSize?: number) {
    loading.value = true;
    error.value = null;

    try {
      const response = await listTrips(page, pageSize);
      items.value = response.data;
      meta.value = response.meta ?? null;
      return response.data;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not load trips right now.');
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
      syncSelectedTrip(response.data);
      return response.data;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not load that trip right now.');
      throw nextError;
    } finally {
      loading.value = false;
    }
  }

  async function fetchMembers(tripId = selectedTrip.value?.id ?? '') {
    if (!tripId) {
      members.value = [];
      return [];
    }

    loading.value = true;
    error.value = null;

    try {
      const response = await getTripMembers(tripId);
      members.value = response.data;
      return response.data;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not load trip members right now.');
      throw nextError;
    } finally {
      loading.value = false;
    }
  }

  async function createTrip(input: TripMutationInput): Promise<Trip> {
    saving.value = true;
    error.value = null;

    try {
      const response = await createTripRequest(input);
      syncSelectedTrip(response.data);
      recordTripCreateAnalytics({
        tripId: response.data.id,
        destination: response.data.destination,
        stopCount: response.data.spots.length,
        memberCount: response.data.members.length,
        isPublic: response.data.isPublic,
        budget: response.data.budget ?? input.budget,
        routeName: 'trip-planner',
      });
      return response.data;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not create that trip right now.');
      throw nextError;
    } finally {
      saving.value = false;
    }
  }

  async function updateTrip(tripId: string, input: TripMutationInput): Promise<Trip> {
    saving.value = true;
    error.value = null;

    try {
      const response = await updateTripRequest(tripId, input);
      syncSelectedTrip(response.data);
      return response.data;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not update that trip right now.');
      throw nextError;
    } finally {
      saving.value = false;
    }
  }

  async function deleteTrip(tripId: string): Promise<void> {
    saving.value = true;
    error.value = null;

    try {
      await deleteTripRequest(tripId);
      items.value = items.value.filter((trip) => trip.id !== tripId);

      if (selectedTrip.value?.id === tripId) {
        selectedTrip.value = null;
        members.value = [];
      }
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not delete that trip right now.');
      throw nextError;
    } finally {
      saving.value = false;
    }
  }

  async function addSpot(tripId: string, tripSpot: TripSpot): Promise<Trip> {
    saving.value = true;
    error.value = null;

    try {
      const response = await addTripSpotRequest(tripId, tripSpot);
      syncSelectedTrip(response.data);
      return response.data;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not add that stop right now.');
      throw nextError;
    } finally {
      saving.value = false;
    }
  }

  async function removeSpot(tripId: string, spotId: string): Promise<Trip> {
    saving.value = true;
    error.value = null;

    try {
      const response = await removeTripSpotRequest(tripId, spotId);
      syncSelectedTrip(response.data);
      return response.data;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not remove that stop right now.');
      throw nextError;
    } finally {
      saving.value = false;
    }
  }

  async function reorderSpots(tripId: string, input: ReorderTripSpotsInput): Promise<Trip> {
    saving.value = true;
    error.value = null;

    try {
      const response = await reorderTripSpotsRequest(tripId, input);
      syncSelectedTrip(response.data);
      return response.data;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not reorder those stops right now.');
      throw nextError;
    } finally {
      saving.value = false;
    }
  }

  async function inviteMember(tripId: string, input: TripInviteInput): Promise<Trip> {
    saving.value = true;
    error.value = null;

    try {
      const response = await inviteTripMemberRequest(tripId, input);
      syncSelectedTrip(response.data);
      return response.data;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not invite that traveler right now.');
      throw nextError;
    } finally {
      saving.value = false;
    }
  }

  async function buildItinerary(input: TripPlannerInput, options: BuildItineraryOptions = {}) {
    planning.value = true;
    error.value = null;

    try {
      const response = await generateItinerary(input);
      previewItinerary.value = response.data;

      if ((options.source ?? 'user') === 'user') {
        const stopCount = response.data.days.reduce((totalStops, day) => totalStops + day.spots.length, 0);

        recordItineraryGenerateAnalytics({
          itineraryId: response.data.id,
          destination: response.data.destination,
          dayCount: response.data.days.length,
          stopCount,
          totalEstimatedCost: response.data.totalEstimatedCost,
          budget: input.budget,
          groupSize: input.groupSize,
          interestCount: input.interests.length,
          pace: input.pace,
          routeName: 'trip-planner',
          source: 'user',
        });
      }

      return response.data;
    } catch (nextError) {
      error.value = toAsyncErrorMessage(nextError, 'Scope could not generate an itinerary right now.');
      throw nextError;
    } finally {
      planning.value = false;
    }
  }

  return {
    items,
    meta,
    selectedTrip,
    members,
    previewItinerary,
    loading,
    planning,
    saving,
    error,
    activeTrip,
    fetchTrips,
    fetchTrip,
    fetchMembers,
    createTrip,
    updateTrip,
    deleteTrip,
    addSpot,
    removeSpot,
    reorderSpots,
    inviteMember,
    buildItinerary,
  };
});
