<template>
  <form class="review-form" @submit.prevent="handleSubmit">
    <div class="review-form__header">
      <div>
        <p class="eyebrow">Leave a review</p>
        <h3>How did this stop feel in person?</h3>
      </div>
      <span class="rating-readout">{{ rating.toFixed(1) }} / 5</span>
    </div>

    <div class="star-row" role="radiogroup" aria-label="Choose a star rating">
      <button
        v-for="star in STAR_OPTIONS"
        :key="star"
        type="button"
        class="star-button"
        :class="{ active: rating >= star }"
        :aria-checked="String(rating === star)"
        role="radio"
        @click="rating = star"
      >
        <AtlasIcon :name="rating >= star ? 'star-filled' : 'star'" :label="`${star} stars`" />
      </button>
    </div>

    <label class="field-group">
      <span>Comment</span>
      <textarea
        v-model="comment"
        rows="4"
        maxlength="500"
        placeholder="Share a practical note, standout detail, or timing tip for future travelers."
      />
    </label>

    <p v-if="errorMessage" class="error-copy">{{ errorMessage }}</p>

    <Button type="submit" :loading="submitting">
      Publish review
    </Button>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import Button from '@/components/common/Button.vue';

const STAR_OPTIONS = [1, 2, 3, 4, 5] as const;
const MIN_COMMENT_LENGTH = 12;

const props = withDefaults(
  defineProps<{
    submitting?: boolean;
    defaultRating?: number;
  }>(),
  {
    submitting: false,
    defaultRating: 5,
  },
);

const emit = defineEmits<{
  (event: 'submit', payload: { rating: number; comment: string }): void;
}>();

const rating = ref(Math.min(Math.max(props.defaultRating, 1), 5));
const comment = ref('');
const errorMessage = ref('');

function handleSubmit() {
  const normalizedComment = comment.value.trim();

  if (normalizedComment.length < MIN_COMMENT_LENGTH) {
    errorMessage.value = `Add at least ${MIN_COMMENT_LENGTH} characters so the review is useful to other travelers.`;
    return;
  }

  errorMessage.value = '';
  emit('submit', {
    rating: rating.value,
    comment: normalizedComment,
  });
  comment.value = '';
  rating.value = props.defaultRating;
}
</script>

<style scoped>
.review-form {
  display: grid;
  gap: var(--space-4);
}

.review-form__header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: flex-start;
}

.eyebrow,
.review-form__header h3,
.field-group span,
.error-copy {
  margin: 0;
}

.eyebrow {
  margin-bottom: var(--space-1);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.rating-readout,
.field-group span {
  color: var(--text-secondary);
}

.star-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.star-button {
  width: 2.75rem;
  height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
}

.star-button.active,
.star-button:hover,
.star-button:focus-visible {
  border-color: var(--accent-gold);
  background: var(--accent-gold-light);
  color: var(--accent-gold);
  transform: translateY(-0.0625rem);
  outline: none;
}

.field-group {
  display: grid;
  gap: var(--space-2);
}

.field-group textarea {
  width: 100%;
  resize: vertical;
  min-height: 8rem;
  border: 1px solid var(--input-border);
  border-radius: var(--radius-xl);
  background: var(--input-bg);
  color: var(--text-primary);
  padding: 0.95rem 1rem;
}

.field-group textarea:focus-visible {
  outline: 2px solid var(--input-focus);
  outline-offset: 2px;
}

.error-copy {
  color: var(--danger);
  line-height: var(--line-height-normal);
}

@media (max-width: 720px) {
  .review-form__header {
    flex-direction: column;
  }
}
</style>
