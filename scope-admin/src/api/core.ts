import { apiClient, unwrapData, unwrapList, type PaginatedRequest, type PaginatedResult } from '@/api/client';
import type { AuthResponse, UserProfile } from '@/types/user';

export interface LoginInput {
  email: string;
  password: string;
}

export async function loginAdmin(input: LoginInput): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/api/core/auth/login', input);
  return unwrapData(data);
}

export async function getCurrentUser(): Promise<UserProfile> {
  const { data } = await apiClient.get<UserProfile>('/api/core/users/me');
  return unwrapData(data);
}

export async function listUsers(params: PaginatedRequest): Promise<PaginatedResult<UserProfile>> {
  const response = await apiClient.get('/api/core/users', {
    params: {
      page: params.page,
      pageSize: params.pageSize,
      q: params.search ?? params.q,
    },
  });
  return unwrapList<UserProfile>(response, params.page, params.pageSize);
}

export async function getUser(id: string): Promise<UserProfile> {
  const { data } = await apiClient.get<UserProfile>(`/api/core/users/${id}`);
  return unwrapData(data);
}

export async function updateUserStatus(id: string, status: string): Promise<UserProfile> {
  const { data } = await apiClient.patch<UserProfile>(`/api/core/users/${id}/status`, { status });
  return unwrapData(data);
}

export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/api/core/users/${id}`);
}

export async function listFriendships(): Promise<PaginatedResult<unknown>> {
  const response = await apiClient.get('/api/core/friendships');
  return unwrapList<unknown>(response, 1, 25);
}
