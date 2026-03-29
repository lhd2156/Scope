<template>
  <AppShell>
    <div class="page-container page-stack">
      <SectionHeading
        eyebrow="Explore"
        title="Find the right vibe for the day"
        description="Filter by city, category, and vibe tags to surface the strongest community spots."
      />

      <div class="page-actions">
        <p class="section-copy">Have a great stop the map is missing? Drop a new pin and attach the photos that sell the experience.</p>
        <RouterLink class="action-link" to="/spots/new">Drop a new pin</RouterLink>
      </div>

      <section class="glass-panel filters-panel">
        <label>
          <span>Category</span>
          <select v-model="categoryModel">
            <option value="">All categories</option>
            <option v-for="category in categories" :key="category" :value="category">{{ category }}</option>
          </select>
        </label>
        <label>
          <span>City</span>
          <input v-model="cityModel" type="text" placeholder="Fort Worth" />
        </label>
        <label>
          <span>Vibe</span>
          <input v-model="vibeModel" type="text" placeholder="calm, moody, luxury" />
        </label>
      </section>

      <section class="card-grid">
        <SpotCard v-for="spot in spotsStore.items" :key="spot.id" :spot="spot" />
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import AppShell from '@/components/common/AppShell.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import SpotCard from '@/components/spots/SpotCard.vue';
import { useSpotsStore } from '@/stores/spots';
import type { SpotCategory } from '@/types';

const spotsStore = useSpotsStore();
const categories: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'scenic', 'other'];

const categoryModel = computed({
  get: () => spotsStore.filters.category ?? '',
  set: async (value: SpotCategory | '') => {
    await spotsStore.fetchSpots({ category: value });
  },
});

const cityModel = computed({
  get: () => spotsStore.filters.city ?? '',
  set: async (value: string) => {
    await spotsStore.fetchSpots({ city: value });
  },
});

const vibeModel = computed({
  get: () => spotsStore.filters.vibe ?? '',
  set: async (value: string) => {
    await spotsStore.fetchSpots({ vibe: value });
  },
});

onMounted(async () => {
  await spotsStore.fetchSpots();
});
</script>

<style scoped>
.page-actions {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: center;
}

.page-actions .section-copy {
  margin: 0;
  max-width: 42rem;
}

.action-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.8rem 1rem;
  border-radius: var(--radius-full);
  border: 1px solid transparent;
  background: var(--accent-teal);
  color: var(--bg-primary);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  transition:
    transform var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.action-link:hover,
.action-link:focus-visible {
  background: var(--accent-teal-hover);
  box-shadow: var(--shadow-glow-teal);
  transform: translateY(-0.0625rem);
  outline: none;
}

.filters-panel {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
  padding: var(--space-5);
}

label {
  display: grid;
  gap: var(--space-2);
  color: var(--text-secondary);
}

select,
input {
  width: 100%;
  border: 1px solid var(--input-border);
  background: var(--input-bg);
  color: var(--text-primary);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

@media (max-width: 900px) {
  .page-actions {
    display: grid;
    align-items: start;
  }

  .action-link {
    width: fit-content;
  }

  .filters-panel {
    grid-template-columns: 1fr;
  }
}
</style>
