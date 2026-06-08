<template>
  <div class="review-list">
    <article v-for="review in reviews" :key="review.id" class="review-card glass-panel">
      <div class="review-header">
        <div class="review-author">
          <span class="review-author__avatar" aria-hidden="true">
            <Avatar :name="review.user.displayName" :src="review.user.avatarUrl" :size="48" />
          </span>
          <div class="review-author__copy">
            <strong>{{ review.user.displayName }}</strong>
            <p class="review-author__handle">@{{ review.user.username }}</p>
            <p class="review-timestamp">
              <time
                :datetime="review.createdAt"
                :title="formatMonthDayYear(review.createdAt) || undefined"
                class="review-timestamp__value"
              >
                {{ formatPostTimestamp(review.createdAt) }}
              </time>
            </p>
          </div>
        </div>

        <div class="review-meta">
          <ReviewSentiment :score="review.sentiment_score" />
          <div class="review-rating" :aria-label="`Rated ${review.rating.toFixed(1)} out of 5`">
            <StarRatingDisplay
              :rating="review.rating"
              :label="`Rated ${review.rating.toFixed(1)} out of 5`"
              :id-prefix="review.id"
              variant="spot-detail"
            />
            <span class="review-rating__value">{{ review.rating.toFixed(1) }}</span>
          </div>
        </div>
      </div>

      <p class="review-comment">{{ formatReviewComment(review.comment) }}</p>
    </article>

    <article v-if="!reviews.length" class="empty-state glass-panel">
      <strong>{{ emptyTitle }}</strong>
      <p>{{ emptyCopy }}</p>
    </article>
  </div>
</template>

<script setup lang="ts">
import Avatar from '@/components/common/Avatar.vue';
import StarRatingDisplay from '@/components/common/StarRatingDisplay.vue';
import ReviewSentiment from '@/components/spots/ReviewSentiment.vue';
import { formatMonthDayYear, formatPostTimestamp } from '@/utils/formatters';
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

function formatReviewComment(comment: string): string {
  const trimmedComment = comment.trim();

  if (trimmedComment.endsWith('.') && !trimmedComment.endsWith('..')) {
    return trimmedComment.slice(0, -1);
  }

  return trimmedComment;
}
</script>

<style scoped>
.review-list {
  display: grid;
  gap: var(--space-5);
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
}

.review-card,
.empty-state {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
  border-radius: var(--radius-xl);
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);
}

.review-card {
  position: relative;
  background:
    radial-gradient(circle at top right, var(--accent-gold-light), transparent 38%),
    var(--glass-bg);
  box-shadow: var(--shadow-md), inset 0 1px 0 color-mix(in srgb, var(--text-primary) 4%, transparent);
}

.review-card:hover,
.review-card:focus-within {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg), inset 0 1px 0 color-mix(in srgb, var(--text-primary) 5%, transparent);
  border-color: var(--border-hover);
}

.review-header,
.review-author,
.review-rating {
  display: flex;
}

.review-meta {
  display: grid;
  justify-items: end;
  gap: var(--space-2);
}

.review-header {
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-5);
  padding-bottom: var(--space-4);
  margin-bottom: var(--space-1);
  border-bottom: 1px solid color-mix(in srgb, var(--glass-border) 92%, var(--accent-gold) 8%);
}

.review-author {
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.review-author__avatar {
  display: inline-flex;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  padding: 2px;
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--accent-teal) 55%, transparent),
    color-mix(in srgb, var(--accent-gold) 45%, transparent)
  );
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--bg-primary) 40%, transparent);
}

.review-author__avatar :deep(.avatar) {
  border-radius: inherit;
}

.review-author__copy {
  display: grid;
  gap: 0.12rem;
  min-width: 0;
}

.review-author__handle {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
  line-height: 1.2;
}

.review-timestamp {
  margin: 0;
}

.review-timestamp__value {
  display: inline;
  color: color-mix(in srgb, var(--text-secondary) 92%, var(--accent-gold) 8%);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.02em;
  line-height: var(--line-height-normal);
  cursor: default;
  border-bottom: 1px solid transparent;
  transition: border-color 0.15s ease, color 0.15s ease;
}

.review-timestamp__value[title] {
  cursor: help;
}

.review-timestamp__value[title]:hover,
.review-timestamp__value[title]:focus-visible {
  color: var(--text-secondary);
  border-bottom-color: color-mix(in srgb, var(--text-secondary) 28%, transparent);
  outline: none;
}

.review-author strong,
.review-author p,
.review-comment,
.empty-state strong,
.empty-state p,
.review-rating__value {
  margin: 0;
}

.review-author p,
.review-comment,
.empty-state p,
.review-rating__value {
  color: var(--text-secondary);
}

.review-author strong {
  color: var(--text-primary);
  font-size: 1.02rem;
  letter-spacing: 0.01em;
}

.review-comment,
.empty-state p {
  line-height: var(--line-height-relaxed);
}

.review-comment {
  position: relative;
  margin-top: 0;
  padding: var(--space-2) 0 var(--space-1) var(--space-4);
  color: var(--text-primary);
  border-left: 2px solid color-mix(in srgb, var(--accent-gold) 55%, var(--accent-teal) 30%);
  border-radius: 0 0 0 var(--radius-md);
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--accent-gold) 5%, transparent),
    transparent 70%
  );
}

.review-rating {
  flex-shrink: 0;
  align-items: center;
  gap: 0.35rem;
  padding: 0.15rem 0;
  border-radius: 0;
  background: none;
  border: none;
  box-shadow: none;
}

.review-rating__value {
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  font-weight: var(--font-weight-semibold);
  min-width: 2ch;
}

.empty-state {
  min-height: 12rem;
  place-items: center;
  text-align: center;
  background:
    radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in srgb, var(--accent-teal) 8%, transparent), transparent 70%),
    var(--glass-bg);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text-primary) 4%, transparent);
}

@media (max-width: 720px) {
  .review-header {
    flex-direction: column;
  }

  .review-meta {
    justify-items: start;
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
