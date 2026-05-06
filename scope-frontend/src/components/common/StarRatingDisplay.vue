<template>
  <div class="star-rating" :class="variantClass" :aria-label="label" role="img">
    <span v-for="starIndex in 5" :key="`${idPrefix}-star-${starIndex}`" class="star-rating__slot">
      <ScopeIcon class="star-rating__track" name="star" />
      <span class="star-rating__clip" :class="{ 'is-partial': isPartial(starIndex) }" :style="clipStyle(starIndex)">
        <ScopeIcon class="star-rating__fill" name="star-filled" />
      </span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import { starFillPortionAtIndex } from '@/utils/ratingDisplay';

const props = withDefaults(
  defineProps<{
    /** 0-5 (decimals show as partial last stars). */
    rating: number;
    /** Accessible label, e.g. "Rated 4.4 out of 5" */
    label: string;
    /** Optional prefix for stable keys in lists. */
    idPrefix?: string;
    /** compact: tight chips; explore: card overlay; spot-detail: hero / review header (slightly larger). */
    variant?: 'compact' | 'explore' | 'spot-detail';
  }>(),
  {
    idPrefix: 'star',
    variant: 'explore',
  },
);

const variantClass = computed(() => (props.variant ? `star-rating--${props.variant}` : ''));

function portion(oneBased: number): number {
  return starFillPortionAtIndex(props.rating, oneBased);
}

function isPartial(oneBased: number): boolean {
  const p = portion(oneBased);
  return p > 0 && p < 1;
}

function clipStyle(oneBased: number): { width: string } {
  const p = portion(oneBased);
  if (p <= 0) {
    return { width: '0' };
  }
  if (p >= 1) {
    return { width: '100%' };
  }
  return { width: `${Number((p * 100).toFixed(2))}%` };
}
</script>

<style scoped>
.star-rating {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}

.star-rating__slot {
  position: relative;
  display: block;
  width: 0.95rem;
  height: 0.95rem;
  flex-shrink: 0;
}

.star-rating--compact {
  gap: 0.12rem;
}

.star-rating--compact .star-rating__slot {
  width: 0.82rem;
  height: 0.82rem;
}

.star-rating--compact .star-rating__track {
  color: color-mix(in srgb, var(--accent-gold) 12%, var(--text-muted));
}

.star-rating--compact .star-rating__fill {
  color: var(--accent-gold);
}

.star-rating--explore .star-rating__track {
  color: color-mix(in srgb, var(--accent-gold) 28%, var(--text-muted));
}

.star-rating--explore .star-rating__fill {
  color: var(--accent-gold);
}

.star-rating--spot-detail {
  gap: 0.28rem;
}

.star-rating--spot-detail .star-rating__slot {
  width: 1.1rem;
  height: 1.1rem;
}

.star-rating--spot-detail .star-rating__track {
  color: color-mix(in srgb, var(--accent-gold) 28%, var(--text-muted));
}

.star-rating--spot-detail .star-rating__fill {
  color: var(--accent-gold);
}

.star-rating__clip {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 1;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
}

.star-rating__fill,
.star-rating__track {
  position: absolute;
  left: 0;
  top: 0;
  width: 0.95rem;
  height: 0.95rem;
}

.star-rating--compact .star-rating__fill,
.star-rating--compact .star-rating__track {
  width: 0.82rem;
  height: 0.82rem;
}

.star-rating--spot-detail .star-rating__fill,
.star-rating--spot-detail .star-rating__track {
  width: 1.1rem;
  height: 1.1rem;
}
</style>
