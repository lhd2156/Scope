<template>
  <div class="review-list">
    <article v-for="review in reviews" :key="review.id" class="review-card surface-card">
      <div class="review-header">
        <div class="review-author">
          <Avatar :name="review.user.displayName" :src="review.user.avatarUrl" :size="44" />
          <div>
            <strong>{{ review.user.displayName }}</strong>
            <p>{{ formatRelativeTime(review.createdAt) }}</p>
          </div>
        </div>
        <span class="rating-pill">★ {{ review.rating.toFixed(1) }}</span>
      </div>
      <p class="review-comment">{{ review.comment }}</p>
    </article>

    <article v-if="!reviews.length" class="empty-state surface-card">
      <strong>{{ emptyTitle }}</strong>
      <p>{{ emptyCopy }}</p>
    </article>
  </div>
</template>

<script setup lang="ts">
import Avatar from '@/components/common/Avatar.vue';
import { formatRelativeTime } from '@/utils/formatters';
import type { Review } from '@/types';

withDefaults(
  defineProps<{
    reviews: Review[];
    emptyTitle?: string;
    emptyCopy?: string;
  }>(),
  {
    emptyTitle: 'No reviews yet',
    emptyCopy: 'Be the first traveler to leave a quick note for this stop.',
  },
);
</script>

<style scoped>
.review-list {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
}

.review-card {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-4);
}

.review-header,
.review-author {
  display: flex;
  gap: var(--space-3);
}

.review-header {
  justify-content: space-between;
  align-items: flex-start;
}

.review-author {
  align-items: center;
}

.review-author strong,
.review-author p,
.review-comment,
.empty-state strong,
.empty-state p {
  margin: 0;
}

.review-author p,
.review-comment,
.empty-state p {
  color: var(--text-secondary);
}

.review-comment,
.empty-state p {
  line-height: var(--line-height-relaxed);
}

.rating-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0.75rem;
  border-radius: var(--radius-full);
  background: var(--accent-gold-light);
  color: var(--accent-gold);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.empty-state {
  min-height: 12rem;
  place-items: center;
  padding: var(--space-5);
  text-align: center;
}

@media (max-width: 720px) {
  .review-header {
    flex-direction: column;
  }
}
</style>
