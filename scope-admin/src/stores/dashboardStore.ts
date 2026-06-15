import { defineStore } from 'pinia';
import { listUsers } from '@/api/core';
import { listPhotos, listReviews, listSpots, listTrips } from '@/api/content';
import { getIntelHealth } from '@/api/intel';
import type { PaginatedResult } from '@/api/client';
import type { ActivityItem, DashboardStats, GeoMetric, MetricPoint } from '@/types/analytics';

interface DashboardState {
  stats: DashboardStats;
  userGrowth: MetricPoint[];
  spotGrowth: MetricPoint[];
  engagement: MetricPoint[];
  geo: GeoMetric[];
  activity: ActivityItem[];
  loading: boolean;
  error: string | null;
}

const sampleSeries: MetricPoint[] = [
  { label: 'Mon', users: 18, spots: 24, reviews: 42, likes: 220, photos: 30 },
  { label: 'Tue', users: 24, spots: 31, reviews: 38, likes: 260, photos: 38 },
  { label: 'Wed', users: 31, spots: 28, reviews: 55, likes: 310, photos: 41 },
  { label: 'Thu', users: 37, spots: 44, reviews: 62, likes: 384, photos: 48 },
  { label: 'Fri', users: 46, spots: 51, reviews: 70, likes: 420, photos: 56 },
  { label: 'Sat', users: 58, spots: 67, reviews: 88, likes: 510, photos: 72 },
  { label: 'Sun', users: 63, spots: 59, reviews: 82, likes: 488, photos: 64 },
];

const emptyStats: DashboardStats = {
  totalUsers: 0,
  totalSpots: 0,
  totalTrips: 0,
  totalReviews: 0,
  activeSessions: 0,
};

function buildActivity(): ActivityItem[] {
  return [
    {
      id: 'activity-1',
      type: 'registration',
      label: 'New admin-visible user registration',
      timestamp: new Date().toISOString(),
    },
    {
      id: 'activity-2',
      type: 'spot',
      label: 'Spot moderation queue refreshed',
      timestamp: new Date(Date.now() - 900_000).toISOString(),
    },
    {
      id: 'activity-3',
      type: 'review',
      label: 'Flagged reviews prioritized for review',
      timestamp: new Date(Date.now() - 1_800_000).toISOString(),
    },
    {
      id: 'activity-4',
      type: 'system',
      label: 'Intel health check completed',
      timestamp: new Date(Date.now() - 3_600_000).toISOString(),
    },
  ];
}

function settledTotal<T>(result: PromiseSettledResult<PaginatedResult<T>>): number {
  return result.status === 'fulfilled' ? result.value.total : 0;
}

function buildPhotoActivity(
  result: PromiseSettledResult<PaginatedResult<unknown>>,
): ActivityItem[] {
  return result.status === 'fulfilled'
    ? [
        {
          id: 'photos',
          type: 'system',
          label: `${result.value.total} photos indexed`,
          timestamp: new Date().toISOString(),
        },
      ]
    : [];
}

export const useDashboardStore = defineStore('dashboard', {
  state: (): DashboardState => ({
    stats: emptyStats,
    userGrowth: sampleSeries,
    spotGrowth: sampleSeries,
    engagement: sampleSeries,
    geo: [
      { name: 'Tokyo', value: 42 },
      { name: 'San Francisco', value: 37 },
      { name: 'Lisbon', value: 31 },
      { name: 'Fort Worth', value: 25 },
    ],
    activity: buildActivity(),
    loading: false,
    error: null,
  }),
  actions: {
    async refresh() {
      this.loading = true;
      this.error = null;
      try {
        const [users, spots, trips, reviews, photos, intelHealth] = await Promise.allSettled([
          listUsers({ page: 1, pageSize: 1 }),
          listSpots({ page: 1, pageSize: 1 }),
          listTrips({ page: 1, pageSize: 1 }),
          listReviews({ page: 1, pageSize: 1 }),
          listPhotos({ page: 1, pageSize: 1 }),
          getIntelHealth(),
        ]);

        const stats: DashboardStats = {
          totalUsers: settledTotal(users),
          totalSpots: settledTotal(spots),
          totalTrips: settledTotal(trips),
          totalReviews: settledTotal(reviews),
          activeSessions: intelHealth.status === 'fulfilled' && intelHealth.value.status ? 1 : 0,
        };

        this.$patch({
          stats,
          userGrowth: sampleSeries,
          spotGrowth: sampleSeries,
          engagement: sampleSeries,
          activity: [
            ...buildActivity(),
            ...buildPhotoActivity(photos),
          ].slice(0, 10),
          loading: false,
        });
      } catch (error) {
        this.$patch({
          error: error instanceof Error ? error.message : 'Dashboard refresh failed',
          loading: false,
        });
      }
    },
  },
});
