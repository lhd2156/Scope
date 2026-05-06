<template>
  <span v-if="label" class="sentiment-badge" :class="`sentiment-${sentiment}`" :title="title">
    <span class="sentiment-badge__dot" aria-hidden="true" />
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ score: number | null | undefined }>();

const sentiment = computed(() => {
  if (props.score == null) {
    return null;
  }

  if (props.score >= 0.6) {
    return 'positive';
  }

  if (props.score <= -0.3) {
    return 'negative';
  }

  return 'neutral';
});

const label = computed(() => {
  if (!sentiment.value) {
    return '';
  }

  return {
    positive: 'Positive',
    neutral: 'Mixed',
    negative: 'Critical',
  }[sentiment.value];
});

const title = computed(() => {
  if (props.score == null) {
    return undefined;
  }

  return `Sentiment score: ${props.score.toFixed(2)}`;
});
</script>

<style scoped>
.sentiment-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  width: fit-content;
  padding: 0.35rem 0.7rem;
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
  line-height: 1;
}

.sentiment-badge__dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: var(--radius-full);
  background: currentColor;
  box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 16%, transparent);
}

.sentiment-positive {
  color: var(--success);
  border-color: color-mix(in srgb, var(--success) 30%, transparent);
  background: color-mix(in srgb, var(--success) 14%, var(--bg-secondary));
}

.sentiment-neutral {
  color: var(--warning);
  border-color: color-mix(in srgb, var(--warning) 30%, transparent);
  background: color-mix(in srgb, var(--warning) 14%, var(--bg-secondary));
}

.sentiment-negative {
  color: var(--danger);
  border-color: color-mix(in srgb, var(--danger) 32%, transparent);
  background: color-mix(in srgb, var(--danger) 14%, var(--bg-secondary));
}
</style>
