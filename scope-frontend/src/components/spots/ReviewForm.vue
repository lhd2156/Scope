<template>
  <form class="review-form" @submit.prevent="handleSubmit">
    <div class="review-form__header">
      <div class="review-form__titles">
        <p class="eyebrow">Leave a review</p>
        <h3>How did this stop feel in person?</h3>
      </div>
      <div class="rating-readout" role="status" :aria-label="`Your rating, ${rating.toFixed(1)} out of 5`">
        <span class="rating-readout__value">{{ rating.toFixed(1) }}</span>
        <span class="rating-readout__denom">/ 5</span>
      </div>
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
        @click="setRating(star)"
      >
        <ScopeIcon :name="rating >= star ? 'star-filled' : 'star'" :label="`${star} stars`" />
      </button>
    </div>

    <label class="rating-input">
      <span>Rating</span>
      <input
        v-model="ratingInput"
        data-test="review-rating-input"
        type="number"
        min="1.0"
        max="5.0"
        step="0.1"
        inputmode="decimal"
        @blur="syncRatingInput"
        @change="syncRatingInput"
      />
    </label>

    <label class="field-group">
      <div class="field-group__head">
        <span>Comment</span>
        <span class="field-hint" aria-live="polite">{{ comment.length }} / 500</span>
      </div>
      <textarea
        v-model="comment"
        rows="4"
        maxlength="500"
        placeholder="Share a practical note, standout detail, or timing tip for future travelers."
      />
    </label>

    <label class="anonymous-toggle">
      <input v-model="isAnonymous" type="checkbox" />
      <span class="anonymous-toggle__switch" aria-hidden="true">
        <span class="anonymous-toggle__thumb"></span>
      </span>
      <span class="anonymous-toggle__copy">
        <strong>Post anonymously</strong>
        <small>Your review helps the spot, but your public name and profile stay hidden.</small>
      </span>
    </label>

    <p v-if="errorMessage" class="error-copy">{{ errorMessage }}</p>

    <Button type="submit" :loading="submitting">
      Publish review
    </Button>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import Button from '@/components/common/Button.vue';
import { sanitizeMultilineText } from '@/utils/sanitizers';

const STAR_OPTIONS = [1, 2, 3, 4, 5] as const;
const MIN_COMMENT_LENGTH = 12;
const MIN_RATING = 1;
const MAX_RATING = 5;

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
  (event: 'submit', payload: { rating: number; comment: string; isAnonymous: boolean }): void;
}>();

const rating = ref(normalizeRating(props.defaultRating));
const ratingInput = ref(formatRating(rating.value));
const comment = ref('');
const isAnonymous = ref(false);
const errorMessage = ref('');

function normalizeRating(value: unknown, fallback = MAX_RATING): number {
  const numericValue = typeof value === 'number' ? value : Number(value);
  const numericFallback = Number.isFinite(fallback) ? fallback : MAX_RATING;
  const clamped = Math.min(Math.max(Number.isFinite(numericValue) ? numericValue : numericFallback, MIN_RATING), MAX_RATING);
  return Math.round(clamped * 10) / 10;
}

function formatRating(value: number): string {
  return normalizeRating(value).toFixed(1);
}

function setRating(value: number) {
  rating.value = normalizeRating(value, rating.value);
  ratingInput.value = formatRating(rating.value);
}

function syncRatingInput() {
  setRating(normalizeRating(ratingInput.value, rating.value));
}

function handleSubmit() {
  syncRatingInput();
  const normalizedComment = sanitizeMultilineText(comment.value);

  if (normalizedComment.length < MIN_COMMENT_LENGTH) {
    errorMessage.value = `Add at least ${MIN_COMMENT_LENGTH} characters so the review is useful to other travelers.`;
    return;
  }

  errorMessage.value = '';
  emit('submit', {
    rating: rating.value,
    comment: normalizedComment,
    isAnonymous: isAnonymous.value,
  });
  comment.value = '';
  setRating(props.defaultRating);
}
</script>

<style scoped>
.review-form {
  display: grid;
  gap: var(--space-5);
}

.review-form__header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: flex-start;
}

.review-form__titles {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.eyebrow,
.review-form__header h3,
.field-group__head span:first-child,
.error-copy {
  margin: 0;
}

.eyebrow {
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}

.field-group__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  width: 100%;
}

.field-hint {
  font-size: var(--font-size-caption);
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
  opacity: 0.9;
  letter-spacing: 0.02em;
}

.rating-readout {
  display: inline-flex;
  align-items: baseline;
  gap: 0.15rem;
  flex-shrink: 0;
  padding: 0.45rem 0.8rem 0.45rem 0.65rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-gold) 8%, var(--bg-secondary) 50%);
  border: 1px solid color-mix(in srgb, var(--accent-gold) 28%, var(--glass-border));
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text-primary) 4%, transparent);
  line-height: 1;
}

.rating-readout__value {
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
  font-size: 1.1rem;
}

.rating-readout__denom {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
  opacity: 0.9;
}

.field-group__head span:first-child {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
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

.rating-input {
  display: grid;
  gap: var(--space-2);
  max-width: 10rem;
}

.rating-input span {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
}

.rating-input input {
  width: 100%;
  border: 1px solid var(--input-border);
  border-radius: var(--radius-md);
  background: var(--input-bg);
  color: var(--text-primary);
  padding: 0.7rem 0.8rem;
  font: inherit;
  font-variant-numeric: tabular-nums;
}

.rating-input input:focus-visible {
  outline: 2px solid var(--input-focus);
  outline-offset: 2px;
  border-color: color-mix(in srgb, var(--accent-teal) 40%, var(--input-border));
}

.field-group {
  display: grid;
  gap: var(--space-2);
}

.anonymous-toggle {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-3);
  cursor: pointer;
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-secondary) 72%, transparent);
}

.anonymous-toggle input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.anonymous-toggle__switch {
  width: 2.75rem;
  height: 1.5rem;
  display: inline-flex;
  align-items: center;
  padding: 0.18rem;
  border-radius: var(--radius-full);
  background: var(--bg-muted);
  border: 1px solid var(--border);
  transition: background var(--transition-fast), border-color var(--transition-fast);
}

.anonymous-toggle__thumb {
  width: 1rem;
  height: 1rem;
  border-radius: var(--radius-full);
  background: var(--text-secondary);
  transition: transform var(--transition-fast), background var(--transition-fast);
}

.anonymous-toggle input:checked + .anonymous-toggle__switch {
  background: color-mix(in srgb, var(--accent-teal) 26%, var(--bg-secondary));
  border-color: color-mix(in srgb, var(--accent-teal) 48%, var(--border));
}

.anonymous-toggle input:checked + .anonymous-toggle__switch .anonymous-toggle__thumb {
  transform: translateX(1.18rem);
  background: var(--accent-teal);
}

.anonymous-toggle:focus-within {
  outline: 2px solid var(--input-focus);
  outline-offset: 2px;
}

.anonymous-toggle__copy {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}

.anonymous-toggle__copy strong,
.anonymous-toggle__copy small {
  display: block;
  line-height: var(--line-height-normal);
}

.anonymous-toggle__copy strong {
  color: var(--text-primary);
  font-size: var(--font-size-small);
}

.anonymous-toggle__copy small {
  color: var(--text-secondary);
}

.field-group textarea {
  width: 100%;
  resize: vertical;
  min-height: 8rem;
  line-height: var(--line-height-relaxed);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-xl);
  background: var(--input-bg);
  color: var(--text-primary);
  padding: 0.95rem 1.05rem;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.field-group textarea::placeholder {
  color: color-mix(in srgb, var(--text-secondary) 80%, var(--text-primary) 20%);
  opacity: 0.88;
}

.field-group textarea:focus-visible {
  outline: 2px solid var(--input-focus);
  outline-offset: 2px;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent-teal) 20%, transparent);
  border-color: color-mix(in srgb, var(--accent-teal) 40%, var(--input-border));
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
