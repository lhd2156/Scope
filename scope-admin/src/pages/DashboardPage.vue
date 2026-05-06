<script setup lang="ts">
import { onMounted } from 'vue';
import { useDashboardStore } from '@/stores/dashboardStore';
import { formatDateTime, formatNumber } from '@/utils/formatters';

const dashboard = useDashboardStore();

onMounted(() => {
  void dashboard.refresh();
});
</script>

<template>
  <div class="page-stack">
    <section class="stats-grid">
      <article class="glass-panel stat-card">
        <span>Total Users</span>
        <strong>{{ formatNumber(dashboard.stats.totalUsers) }}</strong>
      </article>
      <article class="glass-panel stat-card">
        <span>Total Spots</span>
        <strong>{{ formatNumber(dashboard.stats.totalSpots) }}</strong>
      </article>
      <article class="glass-panel stat-card">
        <span>Total Trips</span>
        <strong>{{ formatNumber(dashboard.stats.totalTrips) }}</strong>
      </article>
      <article class="glass-panel stat-card">
        <span>Total Reviews</span>
        <strong>{{ formatNumber(dashboard.stats.totalReviews) }}</strong>
      </article>
      <article class="glass-panel stat-card">
        <span>Active Sessions</span>
        <strong>{{ formatNumber(dashboard.stats.activeSessions) }}</strong>
      </article>
    </section>

    <section class="chart-grid">
      <article class="glass-panel admin-card">
        <h2>User signups</h2>
        <div class="bar-row">
          <span v-for="item in dashboard.userGrowth" :key="item.label" :style="{ height: `${20 + (item.users ?? 0)}px` }" />
        </div>
      </article>
      <article class="glass-panel admin-card">
        <h2>Spots created</h2>
        <div class="bar-row teal">
          <span v-for="item in dashboard.spotGrowth" :key="item.label" :style="{ height: `${20 + (item.spots ?? 0)}px` }" />
        </div>
      </article>
      <article class="glass-panel admin-card">
        <h2>Engagement</h2>
        <div class="bar-row amber">
          <span v-for="item in dashboard.engagement" :key="item.label" :style="{ height: `${20 + ((item.likes ?? 0) / 8)}px` }" />
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
