import { describe, expect, it, vi } from 'vitest';
import { useDashboardStore } from '@/stores/dashboardStore';
import { listUsers } from '@/api/core';
import { listPhotos, listReviews, listSpots, listTrips } from '@/api/content';
import { getIntelHealth } from '@/api/intel';

vi.mock('@/api/core', () => ({ listUsers: vi.fn() }));
vi.mock('@/api/content', () => ({
  listPhotos: vi.fn(),
  listReviews: vi.fn(),
  listSpots: vi.fn(),
  listTrips: vi.fn(),
}));
vi.mock('@/api/intel', () => ({ getIntelHealth: vi.fn() }));

describe('dashboard store', () => {
  it('combines fulfilled service counts into dashboard stats', async () => {
    vi.mocked(listUsers).mockResolvedValue({ items: [], total: 10, page: 1, pageSize: 1 });
    vi.mocked(listSpots).mockResolvedValue({ items: [], total: 20, page: 1, pageSize: 1 });
    vi.mocked(listTrips).mockResolvedValue({ items: [], total: 30, page: 1, pageSize: 1 });
    vi.mocked(listReviews).mockResolvedValue({ items: [], total: 40, page: 1, pageSize: 1 });
    vi.mocked(listPhotos).mockResolvedValue({ items: [], total: 50, page: 1, pageSize: 1 });
    vi.mocked(getIntelHealth).mockResolvedValue({ status: 'healthy' });

    const store = useDashboardStore();
    await store.refresh();

    expect(store.stats).toEqual({
      totalUsers: 10,
      totalSpots: 20,
      totalTrips: 30,
      totalReviews: 40,
      activeSessions: 1,
    });
    expect(store.activity[0].label).toContain('registration');
    expect(store.activity.some((item) => item.id === 'photos')).toBe(true);
    expect(store.loading).toBe(false);
  });

  it('falls back to zeros for rejected service counts and records refresh errors', async () => {
    vi.mocked(listUsers).mockRejectedValue(new Error('offline'));
    vi.mocked(listSpots).mockRejectedValue(new Error('offline'));
    vi.mocked(listTrips).mockRejectedValue(new Error('offline'));
    vi.mocked(listReviews).mockRejectedValue(new Error('offline'));
    vi.mocked(listPhotos).mockRejectedValue(new Error('offline'));
    vi.mocked(getIntelHealth).mockRejectedValue(new Error('offline'));

    const store = useDashboardStore();
    await store.refresh();
    expect(store.stats).toMatchObject({
      totalUsers: 0,
      totalSpots: 0,
      totalTrips: 0,
      totalReviews: 0,
      activeSessions: 0,
    });

    const allSettled = vi.spyOn(Promise, 'allSettled').mockRejectedValueOnce(new Error('boom'));
    await store.refresh();
    expect(store.error).toBe('boom');
    expect(store.loading).toBe(false);
    allSettled.mockRestore();
  });
});
