<template>
  <section class="stats-strip" data-test="profile-stats" :aria-label="statsAriaLabel">
    <div class="stats-grid">
      <article v-for="item in statCards" :key="item.label" class="glass-panel stat-card" data-test="profile-stat-card">
        <div class="icon-shell">
          <ScopeIcon :name="item.icon" :label="item.label" />
        </div>
        <div class="stat-copy">
          <strong>{{ item.value }}</strong>
          <span>{{ item.label }}</span>
          <small>{{ item.description }}</small>
        </div>
      </article>
    </div>

    <div class="support-strip">
      <span class="support-pill">{{ publicSpotCount }} public pin{{ publicSpotCount === 1 ? '' : 's' }}</span>
      <span class="support-pill">{{ averageRatingLabel }}</span>
      <span class="support-pill support-pill--accent" :class="favoriteCategoryClass">{{ favoriteCategoryLabel }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
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
  {
    label: 'Countries',
    value: `${props.countryCount}`,
    description: 'National footprints represented by public pins and trip stops.',
    icon: 'globe',
  },
  {
    label: 'Cities',
    value: `${props.cityCount}`,
    description: 'Distinct city anchors shaping the visible travel story.',
    icon: 'map',
  },
  {
    label: 'Trips',
    value: `${props.tripCount}`,
    description: 'Public adventures and collaborative routes shared on Scope.',
    icon: 'route',
  },
  {
    label: 'Days',
    value: `${props.travelDays}`,
    description: 'Documented days on the road captured in visible itineraries.',
    icon: 'calendar',
  },
]);

const averageRatingLabel = computed(() => (props.averageRating ? `${props.averageRating.toFixed(1)} avg rating` : 'Freshly launched profile'));
const favoriteCategoryLabel = computed(() => (props.favoriteCategory ? `${formatCategory(props.favoriteCategory)} focus` : 'Mixed vibes'));
const favoriteCategoryClass = computed(() => (props.favoriteCategory ? `badge-${props.favoriteCategory}` : 'badge-other'));
const statsAriaLabel = computed(() => `${props.user?.displayName ?? 'Traveler'} footprint stats`);
</script>

<style scoped>
.stats-strip,
.stats-grid,
.support-strip {
  display: grid;
}

.stats-strip {
  gap: var(--space-4);
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4);
}

.stat-card {
  display: grid;
  gap: var(--space-3);
  align-content: start;
  padding: var(--space-5);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent-teal) 12%, transparent), transparent 42%),
    linear-gradient(135deg, color-mix(in srgb, var(--accent-gold) 8%, transparent), transparent 35%),
    color-mix(in srgb, var(--glass-bg) 92%, var(--bg-secondary));
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.stat-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-hover);
  box-shadow: var(--shadow-lg);
}

.icon-shell {
  width: 3.25rem;
  height: 3.25rem;
  display: grid;
  place-items: center;
  border-radius: 1.1rem;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent-teal) 24%, transparent), color-mix(in srgb, var(--accent-gold) 10%, transparent)),
    var(--bg-tertiary);
  color: var(--accent-teal);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text-primary) 8%, transparent);
}

.icon-shell :deep(.scope-icon) {
  width: 1.4rem;
  height: 1.4rem;
}

.stat-copy {
  display: grid;
  gap: var(--space-2);
}

strong,
span,
small {
  margin: 0;
}

strong {
  color: var(--text-primary);
  font-size: clamp(1.8rem, 3vw, 2.4rem);
  line-height: 1;
  letter-spacing: -0.04em;
}

span {
  color: var(--text-primary);
  font-size: var(--font-size-h3);
  font-weight: var(--font-weight-semibold);
}

small {
  color: var(--text-secondary);
  line-height: var(--line-height-normal);
}

.support-strip {
  grid-template-columns: repeat(3, auto);
  justify-content: center;
  gap: var(--space-3);
}

.support-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.65rem 1rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 90%, transparent);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
}

.support-pill--accent {
  color: var(--text-primary);
}

@media (max-width: 1120px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .support-strip {
    grid-template-columns: repeat(2, auto);
  }
}

@media (max-width: 720px) {
  .stats-grid,
  .support-strip {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .stat-card:hover {
    transform: none;
  }
}
</style>
