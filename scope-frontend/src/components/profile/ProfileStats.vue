<template>
  <section class="stats-strip" data-test="profile-stats" :aria-label="statsAriaLabel">
    <div class="stats-row">
      <article v-for="item in statCards" :key="item.label" class="stat-card stat-pill" data-test="profile-stat-card">
        <span class="stat-pill__icon" aria-hidden="true">
          <ScopeIcon :name="item.icon" :label="item.label" />
        </span>
        <strong>{{ item.value }}</strong>
        <span class="stat-pill__label">{{ item.label }}</span>
      </article>
    </div>

    <div class="support-strip">
      <span class="support-pill">
        <ScopeIcon class="support-pill__icon" name="pin" label="Public pins" />
        <span>{{ publicSpotCount }} public pin{{ publicSpotCount === 1 ? '' : 's' }}</span>
      </span>
      <span class="support-pill support-pill--rating">
        <StarRatingDisplay
          v-if="averageRating"
          :rating="averageRating"
          :label="`Average rating ${averageRatingLabel} out of 5`"
          id-prefix="profile-average-rating"
          variant="compact"
        />
        <span>{{ averageRatingLabel }}</span>
      </span>
      <span v-if="favoriteCategory" class="support-pill support-pill--accent" :class="favoriteCategoryClass">{{ favoriteCategoryLabel }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import StarRatingDisplay from '@/components/common/StarRatingDisplay.vue';
import type { SpotCategory, UserProfile } from '@/types';

const props = defineProps<{
  user?: UserProfile;
  countryCount: number;
  cityCount: number;
  tripCount: number;
  travelDays: number;
  publicSpotCount: number;
  averageRating: number;
  favoriteCategory?: SpotCategory | null;
}>();

function formatCategory(category: SpotCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

const statCards = computed(() => [
  { label: 'Countries', value: `${props.countryCount}`, icon: 'globe' },
  { label: 'Cities', value: `${props.cityCount}`, icon: 'map' },
  { label: 'Trips', value: `${props.tripCount}`, icon: 'route' },
  { label: 'Days', value: `${props.travelDays}`, icon: 'calendar' },
]);

const averageRatingLabel = computed(() => (props.averageRating ? `${props.averageRating.toFixed(1)} avg rating` : 'Freshly launched profile'));
const favoriteCategoryLabel = computed(() => (props.favoriteCategory ? `${formatCategory(props.favoriteCategory)} focus` : ''));
const favoriteCategoryClass = computed(() => (props.favoriteCategory ? `badge-${props.favoriteCategory}` : ''));
const statsAriaLabel = computed(() => `${props.user?.displayName ?? 'Traveler'} footprint stats`);
</script>

<style scoped>
.stats-strip {
  display: grid;
  gap: var(--space-3);
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
  gap: var(--space-2);
  padding: 0;
  overflow: visible;
}

.stat-pill {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  grid-template-areas:
    'icon value'
    'icon label';
  align-items: center;
  gap: 0 0.65rem;
  padding: var(--space-3) var(--space-4);
  border: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-secondary) 94%, var(--bg-primary) 6%);
}

.stat-pill__icon {
  grid-area: icon;
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-tertiary) 80%, transparent);
  color: var(--text-secondary);
}

.stat-pill__icon :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
}

strong,
.stat-pill__label {
  margin: 0;
}

strong {
  grid-area: value;
  color: var(--text-primary);
  font-size: 1.25rem;
  line-height: 1;
  letter-spacing: -0.02em;
  font-weight: var(--font-weight-bold);
  align-self: end;
}

.stat-pill__label {
  grid-area: label;
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  font-weight: var(--font-weight-medium);
  align-self: start;
}

.support-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.support-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.7rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 70%, transparent);
  background: color-mix(in srgb, var(--bg-tertiary) 50%, var(--bg-secondary));
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}

.support-pill__icon {
  width: 0.82rem;
  height: 0.82rem;
  color: var(--accent-teal);
}

.support-pill--rating {
  color: var(--text-primary);
}

.support-pill--accent {
  color: var(--text-primary);
}

@media (max-width: 720px) {
  .stats-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 420px) {
  .stats-row {
    grid-template-columns: 1fr;
  }
}
</style>
