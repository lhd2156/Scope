import { apiClient } from '@/api/client';

export interface IntelHealth {
  status: string;
  model?: string;
  version?: string;
}

export async function getIntelHealth(): Promise<IntelHealth> {
  const { data } = await apiClient.get<IntelHealth>('/api/intel/health');
  return data;
}

export async function getIntelAnalytics(): Promise<Record<string, unknown>> {
  const { data } = await apiClient.get<Record<string, unknown>>('/api/intel/analytics');
  return data;
}
