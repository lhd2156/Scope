import api from '@/services/api';
import { buildItineraryPreview, getTripById, mockTrips } from '@/services/mockData';
import type { ApiEnvelope, Itinerary, Trip, TripPlannerInput } from '@/types';

export async function listTrips(): Promise<ApiEnvelope<Trip[]>> {
  try {
    const { data } = await api.get<ApiEnvelope<Trip[]>>('/api/content/trips');
    return data;
  } catch {
    return {
      data: mockTrips,
      meta: { page: 1, pageSize: mockTrips.length, total: mockTrips.length, totalPages: 1 },
    };
  }
}

export async function getTripDetail(tripId: string): Promise<ApiEnvelope<Trip>> {
  try {
    const { data } = await api.get<ApiEnvelope<Trip>>(`/api/content/trips/${tripId}`);
    return data;
  } catch {
    const trip = getTripById(tripId);
    if (!trip) {
      throw new Error(`Trip ${tripId} not found`);
    }
    return { data: trip };
  }
}

export async function generateItinerary(input: TripPlannerInput): Promise<ApiEnvelope<Itinerary>> {
  try {
    const { data } = await api.post<ApiEnvelope<Itinerary>>('/api/intel/itinerary/generate', input);
    return data;
  } catch {
    return { data: buildItineraryPreview(input) };
  }
}
