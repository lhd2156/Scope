import type { AxiosResponse } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient, unwrapData, unwrapList } from '@/api/client';
import {
  deletePhoto,
  deleteReview,
  deleteSpot,
  featureSpot,
  getSpot,
  listPhotos,
  listReviews,
  listSpots,
  listTrips,
  moderatePhoto,
  moderateReview,
} from '@/api/content';
import {
  deleteUser,
  getCurrentUser,
  getUser,
  listFriendships,
  listUsers,
  loginAdmin,
  updateUserStatus,
} from '@/api/core';
import { getIntelAnalytics, getIntelHealth } from '@/api/intel';

function response<T>(data: T): AxiosResponse<T> {
  return { data, status: 200, statusText: 'OK', headers: {}, config: {} as AxiosResponse<T>['config'] };
}

describe('admin API services', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('unwraps envelope and list response variants', () => {
    expect(unwrapData({ data: { id: 'wrapped' } })).toEqual({ id: 'wrapped' });
    expect(unwrapData({ id: 'raw' })).toEqual({ id: 'raw' });
    expect(unwrapList(response([{ id: 'array' }]), 2, 10)).toEqual({
      items: [{ id: 'array' }],
      total: 1,
      page: 2,
      pageSize: 10,
    });
    expect(unwrapList(response({ results: [{ id: 'result' }], count: 7 }), 3, 5)).toMatchObject({
      items: [{ id: 'result' }],
      total: 7,
      page: 3,
      pageSize: 5,
    });
    expect(
      unwrapList(response({ items: [{ id: 'item' }], meta: { total: 8, page: 4, pageSize: 20 } })),
    ).toEqual({
      items: [{ id: 'item' }],
      total: 8,
      page: 4,
      pageSize: 20,
    });
    expect(
      unwrapList(
        response({ data: 'not-a-list' }) as unknown as AxiosResponse<unknown[] | { data?: unknown[] }>,
      ),
    ).toMatchObject({ items: [], total: 0 });
  });

  it('calls content moderation endpoints with normalized parameters', async () => {
    const get = vi.spyOn(apiClient, 'get');
    const patch = vi.spyOn(apiClient, 'patch');
    const del = vi.spyOn(apiClient, 'delete').mockResolvedValue(response({}));

    get.mockResolvedValueOnce(
      response({ data: [{ id: 'spot-1' }], meta: { total: 1, page: 1, pageSize: 25 } }),
    );
    expect(await listSpots({ page: 1, pageSize: 25, search: 'trail', flagged: '' })).toMatchObject({
      total: 1,
    });
    expect(get).toHaveBeenLastCalledWith('/api/content/spots/', {
      params: { page: 1, page_size: 25, q: 'trail', flagged: undefined },
    });

    get.mockResolvedValueOnce(response({ data: [], total: 0 }));
    await listSpots({ page: 2, pageSize: 10, q: 'river', flagged: true });
    expect(get).toHaveBeenLastCalledWith('/api/content/spots/', {
      params: { page: 2, page_size: 10, q: 'river', flagged: true },
    });

    get.mockResolvedValueOnce(response({ data: { id: 'spot-1', title: 'Trail' } }));
    expect(await getSpot('spot-1')).toMatchObject({ title: 'Trail' });

    patch.mockResolvedValueOnce(response({ data: { id: 'spot-1', featured: true } }));
    expect(await featureSpot('spot-1', true)).toMatchObject({ featured: true });

    get.mockResolvedValueOnce(response({ results: [{ id: 'trip-1' }], count: 3 }));
    expect(await listTrips({ page: 2, pageSize: 10, q: 'tokyo' })).toMatchObject({ total: 3 });
    expect(get).toHaveBeenLastCalledWith('/api/content/trips/', {
      params: { page: 2, page_size: 10, q: 'tokyo' },
    });

    get.mockResolvedValueOnce(response({ items: [{ id: 'review-1' }], total: 4 }));
    expect(await listReviews({ page: 1, pageSize: 25, search: 'unsafe', status: 'flagged' })).toMatchObject({
      total: 4,
    });
    expect(get).toHaveBeenLastCalledWith('/api/content/reviews/', {
      params: { page: 1, page_size: 25, q: 'unsafe', status: 'flagged' },
    });
    patch.mockResolvedValueOnce(response({ data: { id: 'review-1', status: 'approved' } }));
    expect(await moderateReview('review-1', 'approved')).toMatchObject({ status: 'approved' });

    get.mockResolvedValueOnce(response({ data: [{ id: 'photo-1' }], total: 5 }));
    expect(await listPhotos({ page: 1, pageSize: 25, status: 'pending' })).toMatchObject({ total: 5 });
    patch.mockResolvedValueOnce(response({ data: { id: 'photo-1', status: 'approved' } }));
    expect(await moderatePhoto('photo-1', 'approved')).toMatchObject({ status: 'approved' });

    await deleteSpot('spot-1');
    await deleteReview('review-1');
    await deletePhoto('photo-1');
    expect(del).toHaveBeenCalledTimes(3);
  });

  it('calls core and intel endpoints through typed helpers', async () => {
    const get = vi.spyOn(apiClient, 'get');
    const post = vi.spyOn(apiClient, 'post');
    const patch = vi.spyOn(apiClient, 'patch');
    const del = vi.spyOn(apiClient, 'delete').mockResolvedValue(response({}));

    post.mockResolvedValueOnce(response({ data: { accessToken: 'token' } }));
    expect(await loginAdmin({ email: 'admin@example.com', password: 'pw' })).toEqual({
      accessToken: 'token',
    });

    get.mockResolvedValueOnce(response({ data: { id: 'admin-1', email: 'admin@example.com' } }));
    expect(await getCurrentUser()).toMatchObject({ id: 'admin-1' });

    get.mockResolvedValueOnce(response({ data: [{ id: 'user-1' }], meta: { total: 9 } }));
    expect(await listUsers({ page: 1, pageSize: 25, search: 'lou' })).toMatchObject({ total: 9 });

    get.mockResolvedValueOnce(response({ data: { id: 'user-1' } }));
    expect(await getUser('user-1')).toMatchObject({ id: 'user-1' });

    patch.mockResolvedValueOnce(response({ data: { id: 'user-1', status: 'banned' } }));
    expect(await updateUserStatus('user-1', 'banned')).toMatchObject({ status: 'banned' });

    get.mockResolvedValueOnce(response({ results: [{ id: 'friendship-1' }], count: 1 }));
    expect(await listFriendships()).toMatchObject({ total: 1 });

    get.mockResolvedValueOnce(response({ status: 'healthy' }));
    expect(await getIntelHealth()).toMatchObject({ status: 'healthy' });
    get.mockResolvedValueOnce(response({ activeUsers: 12 }));
    expect(await getIntelAnalytics()).toMatchObject({ activeUsers: 12 });

    await deleteUser('user-1');
    expect(del).toHaveBeenCalledWith('/api/core/users/user-1');
  });
});
