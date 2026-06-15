<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useDashboardStore } from '@/stores/dashboardStore';
import type { MetricPoint } from '@/types/analytics';
import { formatDateTime, formatNumber } from '@/utils/formatters';

const dashboard = useDashboardStore();
const statCards = computed(() => [
  { label: 'Total Users', value: dashboard.stats.totalUsers },
  { label: 'Total Spots', value: dashboard.stats.totalSpots },
  { label: 'Total Trips', value: dashboard.stats.totalTrips },
  { label: 'Total Reviews', value: dashboard.stats.totalReviews },
  { label: 'Active Sessions', value: dashboard.stats.activeSessions },
]);
const charts = computed(() => [
  {
    title: 'User signups',
    tone: '',
    series: dashboard.userGrowth,
    height: (item: MetricPoint) => `${20 + (item.users ?? 0)}px`,
  },
  {
    title: 'Spots created',
    tone: 'teal',
    series: dashboard.spotGrowth,
    height: (item: MetricPoint) => `${20 + (item.spots ?? 0)}px`,
  },
  {
    title: 'Engagement',
    tone: 'amber',
    series: dashboard.engagement,
    height: (item: MetricPoint) => `${20 + (item.likes ?? 0) / 8}px`,
  },
]);

onMounted(() => {
  void dashboard.refresh();
});
</script>

<template>
  <div class="page-stack">
    <section class="stats-grid">
      <article v-for="stat in statCards" :key="stat.label" class="glass-panel stat-card">
        <span>{{ stat.label }}</span>
        <strong>{{ formatNumber(stat.value) }}</strong>
      </article>
    </section>

    <section class="chart-grid">
      <article v-for="chart in charts" :key="chart.title" class="glass-panel admin-card">
        <h2>{{ chart.title }}</h2>
        <div class="bar-row" :class="chart.tone">
          <span
            v-for="item in chart.series"
            :key="item.label"
            :style="{ height: chart.height(item) }"
          />
        </div>
      </article>
    </section>

    <section class="glass-panel admin-card">
      <div class="card-header">
        <h2>Recent activity</h2>
        <span v-if="dashboard.loading">Refreshing...</span>
      </div>
      <article v-for="item in dashboard.activity" :key="item.id" class="activity-row">
        <div>
          <strong>{{ item.label }}</strong>
          <p>{{ item.type }}</p>
        </div>
        <time>{{ formatDateTime(item.timestamp) }}</time>
      </article>
    </section>
  </div>
</template>
