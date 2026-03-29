<template>
  <section class="glass-panel stats-panel" data-test="profile-stats">
    <div class="panel-header">
      <div>
        <p class="eyebrow">Atlas stats</p>
        <h2>{{ user.displayName }} at a glance</h2>
      </div>
      <span class="meta-pill">{{ publicSpotCount }} public pin{{ publicSpotCount === 1 ? '' : 's' }}</span>
    </div>

    <div class="stats-grid">
      <article v-for="item in statCards" :key="item.label" class="surface-card stat-card">
        <div class="icon-shell">
          <AtlasIcon :name="item.icon" :label="item.label" />
        </div>
        <div>
          <small>{{ item.label }}</small>
          <strong>{{ item.value }}</strong>
          <p>{{ item.description }}</p>
        </div>
      </article>
    </div>

    <div class="signature-row">
      <span class="signature-label">Signature category</span>
      <span class="signature-chip" :class="favoriteCategoryClass">{{ favoriteCategoryLabel }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import type { SpotCategory, UserProfile } from '@/types';

const props = defineProps<{
  user: UserProfile;
  publicSpotCount: number;
  cityCount: number;
  averageRating: number;
  routeCount: number;
  favoriteCategory?: SpotCategory | null;
}>();

function formatCategory(category: SpotCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

const statCards = computed(() => [
  {
    label: 'Average rating',
    value: props.averageRating ? props.averageRating.toFixed(1) : '—',
    description: 'Average sentiment across this explorer\'s visible public pins.',
    icon: 'star',
  },
  {
    label: 'City coverage',
    value: `${props.cityCount}`,
    description: `Cit${props.cityCount === 1 ? 'y' : 'ies'} represented on the public adventure map.`,
    icon: 'map',
  },
  {
    label: 'Shared trips',
    value: `${props.routeCount}`,
    description: 'Collaborative public routes where this explorer appears with the crew.',
    icon: 'route',
  },
]);

const favoriteCategoryLabel = computed(() => (props.favoriteCategory ? formatCategory(props.favoriteCategory) : 'Mixed'));
const favoriteCategoryClass = computed(() => (props.favoriteCategory ? `badge-${props.favoriteCategory}` : 'badge-other'));
</script>

<style scoped>
.stats-panel {
  display: grid;
  gap: var(--space-5);
  padding: var(--space-5);
}

.panel-header,
.signature-row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: flex-start;
}

.eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--accent-teal);
  font-size: var(--font-size-caption);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

h2,
small,
strong,
p {
  margin: 0;
}

.meta-pill,
.signature-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0.85rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  font-size: var(--font-size-small);
}

.stats-grid {
  display: grid;
  gap: var(--space-4);
}

.stat-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-3);
  padding: var(--space-4);
}

.icon-shell {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-full);
  display: grid;
  place-items: center;
  background: var(--accent-teal-light);
  color: var(--accent-teal);
}

.icon-shell :deep(.atlas-icon) {
  width: 1.2rem;
  height: 1.2rem;
}

small,
p,
.signature-label {
  color: var(--text-secondary);
}

strong {
  display: block;
  margin: var(--space-1) 0;
  color: var(--text-primary);
  font-size: var(--font-size-h3);
}

p {
  line-height: var(--line-height-relaxed);
  font-size: var(--font-size-small);
}

.signature-row {
  align-items: center;
}

.signature-label {
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
}

@media (max-width: 720px) {
  .panel-header,
  .signature-row,
  .stat-card {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
