<template>
  <div class="review-list">
    <article v-for="review in reviews" :key="review.id" class="review-card glass-panel">
      <div class="review-header">
        <div class="review-author">
          <Avatar :name="review.user.displayName" :src="review.user.avatarUrl" :size="48" />
          <div class="review-author__copy">
            <strong>{{ review.user.displayName }}</strong>
            <p>{{ formatRelativeTime(review.createdAt) }}</p>
          </div>
        </div>

        <div class="review-rating" :aria-label="`Rated ${review.rating.toFixed(1)} out of 5`">
          <div class="star-row" aria-hidden="true">
            <AtlasIcon
              v-for="(filled, index) in buildStars(review.rating)"
              :key="`${review.id}-star-${index}`"
              :name="filled ? 'star-filled' : 'star'"
              label="Review star"
            />
          </div>
          <span>{{ review.rating.toFixed(1) }}</span>
        </div>
      </div>

      <p class="review-comment">{{ review.comment }}</p>
    </article>

    <article v-if="!reviews.length" class="empty-state glass-panel">
      <strong>{{ emptyTitle }}</strong>
      <p>{{ emptyCopy }}</p>
    </article>
  </div>
</template>

<script setup lang="ts">
import AtlasIcon from '@/components/common/AtlasIcon.vue';
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

function buildStars(rating: number): boolean[] {
  return Array.from({ length: 5 }, (_, index) => index < Math.round(rating));
}
</script>

<style scoped>
.review-list {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
}

.review-card,
.empty-state {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);
}

.review-card {
  background:
    radial-gradient(circle at top right, var(--accent-gold-light), transparent 34%),
    var(--glass-bg);
}

.review-card:hover,
.review-card:focus-within {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  border-color: var(--border-hover);
}

.review-header,
.review-author,
.review-rating,
.star-row {
  display: flex;
}

.review-header {
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
}

.review-author {
  align-items: center;
  gap: var(--space-3);
}

.review-author__copy {
  display: grid;
  gap: var(--space-1);
}

.review-author strong,
.review-author p,
.review-comment,
.empty-state strong,
.empty-state p,
.review-rating span {
  margin: 0;
}

.review-author p,
.review-comment,
.empty-state p,
.review-rating span {
  color: var(--text-secondary);
}

.review-comment,
.empty-state p {
  line-height: var(--line-height-relaxed);
}

.review-rating {
  align-items: center;
  gap: var(--space-2);
  padding: 0.55rem 0.8rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-secondary) 45%, transparent);
  border: 1px solid var(--glass-border);
}

.star-row {
  align-items: center;
  gap: var(--space-1);
  color: var(--accent-gold);
}

.star-row :deep(.atlas-icon) {
  width: 0.95rem;
  height: 0.95rem;
}

.empty-state {
  min-height: 12rem;
  place-items: center;
  text-align: center;
}

@media (max-width: 720px) {
  .review-header {
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .review-card {
    transition: none;
  }

  .review-card:hover,
  .review-card:focus-within {
    transform: none;
  }
}
</style>
