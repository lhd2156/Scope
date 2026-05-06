<template>
  <section v-if="spots.length" class="glass-panel for-you-panel">
    <div class="for-you-header">
      <div>
        <p class="eyebrow">For You</p>
        <h2>Personalized picks based on your interests</h2>
      </div>
    </div>

    <div class="for-you-grid stagger-in">
      <RouterLink
        v-for="(spot, index) in spots"
        :key="spot.id"
        :to="`/spots/${spot.id}`"
        class="for-you-card glass-panel"
        :style="{ '--scope-stagger-index': index }"
      >
        <div class="for-you-card__copy">
          <span class="badge" :class="`badge-${spot.category}`">{{ formatCategory(spot.category) }}</span>
          <strong>{{ spot.title }}</strong>
          <div class="for-you-card__rating">
            <StarRatingDisplay
              :rating="spot.rating"
              :label="`Rated ${spot.rating.toFixed(1)} out of 5`"
              :id-prefix="`for-you-${spot.id}`"
            />
            <span>{{ spot.rating.toFixed(1) }}</span>
          </div>
          <span class="for-you-card__location">{{ formatLocation(spot) }}</span>
        </div>
      </RouterLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import StarRatingDisplay from '@/components/common/StarRatingDisplay.vue';
import { recommendSpots } from '@/services/intelService';
import { useAuthStore } from '@/stores/auth';
import type { SpotCategory, SpotSummary } from '@/types';

const VALID_CATEGORIES = new Set<SpotCategory>([
  'food',
  'nature',
  'nightlife',
  'culture',
  'adventure',
  'shopping',
  'scenic',
  'other',
]);

const authStore = useAuthStore();
const spots = ref<SpotSummary[]>([]);

function isSpotCategory(value: string): value is SpotCategory {
  return VALID_CATEGORIES.has(value as SpotCategory);
}

function formatCategory(category: SpotCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function formatLocation(spot: SpotSummary): string {
  const location = [spot.city, spot.country].filter(Boolean).join(', ');
  return location || 'Scope recommendation';
}

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    return;
  }

  try {
    const interests = (authStore.currentUser?.interests ?? []).filter(isSpotCategory);
    const result = await recommendSpots({
      interests: interests.length ? interests : undefined,
      limit: 6,
    });
    spots.value = result.data;
  } catch {
    // Personalized recommendations are best-effort.
  }
});
</script>

<style scoped>
.for-you-panel {
  display: grid;
  gap: var(--space-5);
  padding: var(--space-6);
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent-teal) 16%, transparent), transparent 38%),
    linear-gradient(135deg, color-mix(in srgb, var(--glass-bg) 96%, transparent), color-mix(in srgb, var(--bg-secondary) 88%, transparent));
}

.for-you-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.for-you-header h2,
.for-you-header p {
  margin: 0;
}

.for-you-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr));
  gap: var(--space-4);
}

.for-you-card {
  min-height: 9rem;
  padding: var(--space-4);
  color: var(--text-primary);
  text-decoration: none;
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent-teal) 12%, transparent), transparent 46%),
    color-mix(in srgb, var(--bg-secondary) 84%, transparent);
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.for-you-card:hover,
.for-you-card:focus-visible {
  outline: none;
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--accent-teal) 38%, var(--glass-border));
  box-shadow: var(--shadow-md);
}

.for-you-card__copy {
  display: grid;
  gap: var(--space-2);
}

.for-you-card__rating {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-primary);
  font-size: var(--font-size-small);
  font-variant-numeric: tabular-nums;
  font-weight: var(--font-weight-semibold);
}

.for-you-card__location {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}
</style>
