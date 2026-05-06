<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { listReviews, moderateReview } from '@/api/content';
import type { ReviewSummary } from '@/types/review';

const reviews = ref<ReviewSummary[]>([]);

async function loadReviews() {
  const result = await listReviews({ page: 1, pageSize: 25, status: 'flagged' });
  reviews.value = result.items;
}

async function moderate(id: string, status: string) {
  await moderateReview(id, status);
  await loadReviews();
}

onMounted(loadReviews);
</script>

<template>
  <section class="glass-panel admin-card">
    <div class="card-header">
      <div>
        <h2>Reviews</h2>
        <p>Approve or reject community review reports.</p>
      </div>
    </div>
    <article v-for="review in reviews" :key="review.id" class="activity-row">
      <div>
        <strong>{{ review.spot ?? 'Spot review' }}</strong>
        <p>{{ review.text ?? review.comment ?? 'No comment' }}</p>
      </div>
      <div class="table-actions">
        <button class="btn primary" type="button" @click="moderate(review.id, 'approved')">Approve</button>
        <button class="btn danger" type="button" @click="moderate(review.id, 'rejected')">Reject</button>
      </div>
    </article>
  </section>
</template>
