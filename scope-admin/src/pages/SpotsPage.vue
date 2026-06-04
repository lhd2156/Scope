<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { listSpots } from '@/api/content';
import type { SpotSummary } from '@/types/spot';
import { formatLocation } from '@/utils/formatters';

const spots = ref<SpotSummary[]>([]);
const flagged = ref<boolean | ''>('');

async function loadSpots() {
  const result = await listSpots({ page: 1, pageSize: 25, flagged: flagged.value });
  spots.value = result.items;
}

onMounted(loadSpots);
</script>

<template>
  <section class="glass-panel admin-card">
    <div class="card-header">
      <div>
        <h2>Spots</h2>
        <p>Review map content and flagged location submissions.</p>
      </div>
      <select v-model="flagged" @change="loadSpots">
        <option value="">All spots</option>
        <option value="true">Flagged</option>
        <option value="false">Unflagged</option>
      </select>
    </div>
    <table class="admin-table">
      <thead>
        <tr>
          <th>Spot</th>
          <th>Location</th>
          <th>Reviews</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="spot in spots" :key="spot.id">
          <td>{{ spot.title ?? spot.name }}</td>
          <td>{{ formatLocation(spot) }}</td>
          <td>{{ spot.reviewCount ?? spot.review_count ?? 0 }}</td>
          <td>{{ spot.flagged ? 'Flagged' : 'Clear' }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
