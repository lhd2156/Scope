import api from '@/services/api';
import { createMockSpot, filterSpots, getSpotById, mockSpots, updateMockSpot } from '@/services/mockData';
import type { ApiEnvelope, SpotDetail, SpotFilters, SpotFormSubmission, SpotSummary, UserProfile } from '@/types';

export async function listSpots(filters: SpotFilters = {}): Promise<ApiEnvelope<SpotSummary[]>> {
  try {
    const { data } = await api.get<ApiEnvelope<SpotSummary[]>>('/api/content/spots', { params: filters });
    return data;
  } catch {
    const filteredSpots = filterSpots(filters);
    return {
      data: filteredSpots,
      meta: {
        page: filters.page ?? 1,
        pageSize: filters.pageSize ?? filteredSpots.length,
        total: filteredSpots.length,
        totalPages: 1,
      },
    };
  }
}

export async function listTrendingSpots(): Promise<ApiEnvelope<SpotSummary[]>> {
  try {
    const { data } = await api.get<ApiEnvelope<SpotSummary[]>>('/api/content/feed/trending');
    return data;
  } catch {
    return {
      data: [...mockSpots].sort((left, right) => (right.likesCount ?? 0) - (left.likesCount ?? 0)).slice(0, 4),
      meta: { page: 1, pageSize: 4, total: 4, totalPages: 1 },
    };
  }
}

export async function getSpotDetail(spotId: string): Promise<ApiEnvelope<SpotDetail>> {
  try {
    const { data } = await api.get<ApiEnvelope<SpotDetail>>(`/api/content/spots/${spotId}`);
    return data;
  } catch {
    const detail = getSpotById(spotId);
    if (!detail) {
      throw new Error(`Spot ${spotId} not found`);
    }
    return { data: detail };
  }
}

export async function createSpot(submission: SpotFormSubmission, currentUser?: UserProfile | null): Promise<ApiEnvelope<SpotDetail>> {
  try {
    const { data } = await api.post<ApiEnvelope<SpotDetail>>('/api/content/spots', submission.spot);
    return data;
  } catch {
    return { data: createMockSpot(submission, currentUser) };
  }
}

export async function updateSpot(spotId: string, submission: SpotFormSubmission, currentUser?: UserProfile | null): Promise<ApiEnvelope<SpotDetail>> {
  try {
    const { data } = await api.put<ApiEnvelope<SpotDetail>>(`/api/content/spots/${spotId}`, submission.spot);
    return data;
  } catch {
    return { data: updateMockSpot(spotId, submission, currentUser) };
  }
}
