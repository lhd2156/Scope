import { apiClient, unwrapData, unwrapList, type PaginatedRequest, type PaginatedResult } from '@/api/client';
import type { ReviewSummary } from '@/types/review';
import type { AdminPhoto, SpotSummary } from '@/types/spot';
import type { TripSummary } from '@/types/trip';

export async function listSpots(params: PaginatedRequest): Promise<PaginatedResult<SpotSummary>> {
  const response = await apiClient.get('/api/content/spots/', {
    params: {
      page: params.page,
      page_size: params.pageSize,
      q: params.search ?? params.q,
      flagged: params.flagged === '' ? undefined : params.flagged,
    },
  });
  return unwrapList<SpotSummary>(response, params.page, params.pageSize);
}

export async function getSpot(id: string): Promise<SpotSummary> {
  const { data } = await apiClient.get<SpotSummary>(`/api/content/spots/${id}/`);
  return unwrapData(data);
}

export async function deleteSpot(id: string): Promise<void> {
  await apiClient.delete(`/api/content/spots/${id}/`);
}

export async function featureSpot(id: string, featured: boolean): Promise<SpotSummary> {
  const { data } = await apiClient.patch<SpotSummary>(`/api/content/spots/${id}/`, { featured });
  return unwrapData(data);
}

export async function listTrips(params: PaginatedRequest): Promise<PaginatedResult<TripSummary>> {
  const response = await apiClient.get('/api/content/trips/', {
    params: {
      page: params.page,
      page_size: params.pageSize,
      q: params.search ?? params.q,
    },
  });
  return unwrapList<TripSummary>(response, params.page, params.pageSize);
}

export async function listReviews(params: PaginatedRequest): Promise<PaginatedResult<ReviewSummary>> {
  const response = await apiClient.get('/api/content/reviews/', {
    params: {
      page: params.page,
      page_size: params.pageSize,
      q: params.search ?? params.q,
      status: params.status,
    },
  });
  return unwrapList<ReviewSummary>(response, params.page, params.pageSize);
}

export async function moderateReview(id: string, status: string): Promise<ReviewSummary> {
  const { data } = await apiClient.patch<ReviewSummary>(`/api/content/reviews/${id}/`, { status });
  return unwrapData(data);
}

export async function deleteReview(id: string): Promise<void> {
  await apiClient.delete(`/api/content/reviews/${id}/`);
}

export async function listPhotos(params: PaginatedRequest): Promise<PaginatedResult<AdminPhoto>> {
  const response = await apiClient.get('/api/content/photos/', {
    params: {
      page: params.page,
      page_size: params.pageSize,
      status: params.status,
    },
  });
  return unwrapList<AdminPhoto>(response, params.page, params.pageSize);
}

export async function moderatePhoto(id: string, status: string): Promise<AdminPhoto> {
  const { data } = await apiClient.patch<AdminPhoto>(`/api/content/photos/${id}/`, { status });
  return unwrapData(data);
}

export async function deletePhoto(id: string): Promise<void> {
  await apiClient.delete(`/api/content/photos/${id}/`);
}
