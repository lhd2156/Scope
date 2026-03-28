import api from '@/services/api';
import { filterSpots, getSpotById, mockSpots } from '@/services/mockData';
import type { ApiEnvelope, SpotDetail, SpotFilters, SpotSummary } from '@/types';

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
