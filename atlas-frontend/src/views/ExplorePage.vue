<template>
  <AppShell>
    <div class="page-container page-stack explore-page">
      <section class="glass-panel hero-panel">
        <div class="hero-copy">
          <p class="eyebrow">Explore</p>
          <h1>Find the right vibe for the day.</h1>
          <p class="section-copy">
            Search the community map, stack category and city filters, and move from inspiration to a concrete stop list without leaving the discovery flow.
          </p>
        </div>

        <div class="hero-metrics">
          <article class="surface-card metric-card">
            <small>Visible results</small>
            <strong data-test="results-count">{{ filteredSpots.length }}</strong>
            <span>Spots matching the active discovery filters</span>
          </article>
          <article class="surface-card metric-card">
            <small>Cities covered</small>
            <strong>{{ availableCities.length }}</strong>
            <span>Mapped across the current explore dataset</span>
          </article>
          <article class="surface-card metric-card">
            <small>Categories</small>
            <strong>{{ categories.length }}</strong>
            <span>Discovery lanes ready to browse</span>
          </article>
        </div>
      </section>

      <section class="glass-panel filter-panel">
        <div class="filter-toolbar">
          <SearchBar
            v-model="searchQuery"
            class="filter-search"
            label="Search spots"
            placeholder="Search by title, city, vibe, or description"
          />

          <div class="toolbar-actions">
            <RouterLink class="button button-primary" to="/spots/new">Drop a new pin</RouterLink>
            <button type="button" class="button button-secondary" @click="clearFilters">Clear filters</button>
          </div>
        </div>

        <div class="chip-stack">
          <div class="chip-group">
            <p class="chip-label">Categories</p>
            <div class="chip-row">
              <button type="button" class="filter-chip" :class="{ active: !selectedCategory }" @click="selectedCategory = ''">
                All
              </button>
              <button
                v-for="category in categories"
                :key="category"
                :data-test="`category-chip-${category}`"
                type="button"
                class="filter-chip"
                :class="{ active: selectedCategory === category }"
                @click="toggleCategory(category)"
              >
                {{ formatCategory(category) }}
              </button>
            </div>
          </div>

          <div class="chip-group">
            <p class="chip-label">Cities</p>
            <div class="chip-row">
              <button type="button" class="filter-chip" :class="{ active: !selectedCity }" @click="selectedCity = ''">All cities</button>
              <button
                v-for="city in availableCities"
                :key="city"
                type="button"
                class="filter-chip"
                :class="{ active: selectedCity === city }"
                @click="toggleCity(city)"
              >
                {{ city }}
              </button>
            </div>
          </div>

          <div class="chip-group">
            <p class="chip-label">Vibes</p>
            <div class="chip-row">
              <button type="button" class="filter-chip" :class="{ active: !selectedVibe }" @click="selectedVibe = ''">Any vibe</button>
              <button
                v-for="vibe in availableVibes"
                :key="vibe"
                type="button"
                class="filter-chip"
                :class="{ active: selectedVibe === vibe }"
                @click="toggleVibe(vibe)"
              >
                {{ formatVibe(vibe) }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="results-section">
        <div class="results-header">
          <div>
            <p class="eyebrow">Discovery results</p>
            <h2>Community-loved spots</h2>
          </div>
          <div class="active-filter-row">
            <span v-if="selectedCategory" class="active-pill">{{ formatCategory(selectedCategory) }}</span>
            <span v-if="selectedCity" class="active-pill">{{ selectedCity }}</span>
            <span v-if="selectedVibe" class="active-pill">{{ formatVibe(selectedVibe) }}</span>
            <span v-if="searchQuery" class="active-pill">“{{ searchQuery }}”</span>
          </div>
        </div>

        <p v-if="spotsStore.loading" class="section-copy">Loading explore results...</p>
        <div v-else-if="filteredSpots.length" class="results-grid">
          <SpotCard v-for="spot in filteredSpots" :key="spot.id" :spot="spot" />
        </div>
        <article v-else class="glass-panel empty-state">
          <h3>No spots match the current filters</h3>
          <p class="section-copy">Try clearing one of the active chips or broadening the search query to surface more places.</p>
          <button type="button" class="button button-secondary" @click="clearFilters">Reset discovery filters</button>
        </article>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import SearchBar from '@/components/common/SearchBar.vue';
import SpotCard from '@/components/spots/SpotCard.vue';
import { useSpotsStore } from '@/stores/spots';
import type { SpotCategory, SpotSummary } from '@/types';

const spotsStore = useSpotsStore();
const route = useRoute();
const router = useRouter();
const categories: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'scenic', 'other'];
const searchQuery = ref('');
const selectedCategory = ref<SpotCategory | ''>('');
const selectedCity = ref('');
const selectedVibe = ref('');

function formatCategory(category: SpotCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function formatVibe(vibe: string): string {
  return vibe
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function toggleCategory(category: SpotCategory) {
  selectedCategory.value = selectedCategory.value === category ? '' : category;
}

function toggleCity(city: string) {
  selectedCity.value = selectedCity.value === city ? '' : city;
}

function toggleVibe(vibe: string) {
  selectedVibe.value = selectedVibe.value === vibe ? '' : vibe;
}

function clearFilters() {
  searchQuery.value = '';
  selectedCategory.value = '';
  selectedCity.value = '';
  selectedVibe.value = '';
  void router.replace({ query: {} });
}

function matchesSearch(spot: SpotSummary, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const searchableFields = [spot.title, spot.description, spot.city, spot.country, spot.vibe, spot.author?.displayName]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.toLowerCase());

  return searchableFields.some((value) => value.includes(normalizedQuery));
}

const baseSpots = computed(() => spotsStore.items);

const availableCities = computed(() =>
  [...new Set(baseSpots.value.map((spot) => spot.city).filter((city): city is string => Boolean(city?.trim())))].sort((left, right) =>
    left.localeCompare(right),
  ),
);

const availableVibes = computed(() =>
  [...new Set(baseSpots.value.map((spot) => spot.vibe).filter((vibe): vibe is string => Boolean(vibe?.trim())))].sort((left, right) =>
    left.localeCompare(right),
  ),
);

const filteredSpots = computed(() =>
  baseSpots.value.filter((spot) => {
    const matchesCategory = !selectedCategory.value || spot.category === selectedCategory.value;
    const matchesCity = !selectedCity.value || spot.city === selectedCity.value;
    const matchesVibe = !selectedVibe.value || spot.vibe === selectedVibe.value;
    return matchesCategory && matchesCity && matchesVibe && matchesSearch(spot, searchQuery.value);
  }),
);

watch(
  () => route.query.q,
  (query) => {
    const nextQuery = typeof query === 'string' ? query : '';
    if (nextQuery !== searchQuery.value) {
      searchQuery.value = nextQuery;
    }
  },
  { immediate: true },
);

watch(searchQuery, (query) => {
  const currentQuery = typeof route.query.q === 'string' ? route.query.q : '';
  if (query === currentQuery) {
    return;
  }

  void router.replace({
    query: query ? { ...route.query, q: query } : Object.fromEntries(Object.entries(route.query).filter(([key]) => key !== 'q')),
  });
});

onMounted(async () => {
  await spotsStore.fetchSpots({ category: '', city: '', vibe: '', page: 1, pageSize: 12 });
});
</script>

<style scoped>
.explore-page,
.hero-panel,
.hero-copy,
.hero-metrics,
.filter-panel,
.chip-stack,
.chip-group,
.results-section,
.results-grid,
.empty-state {
  display: grid;
  gap: var(--space-5);
}

.hero-panel {
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.9fr);
  align-items: center;
  padding: var(--space-6);
}

.eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

h1,
h2,
h3,
small,
strong,
span {
  margin: 0;
}

h1 {
  font-size: clamp(2rem, 4vw, 3.5rem);
  line-height: var(--line-height-tight);
}

.hero-metrics {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.metric-card,
.filter-panel,
.empty-state {
  padding: var(--space-5);
}

.metric-card {
  display: grid;
  gap: var(--space-2);
}

.metric-card small,
.metric-card span,
.chip-label {
  color: var(--text-secondary);
}

.metric-card strong {
  color: var(--text-primary);
  font-size: var(--font-size-h2);
}

.filter-toolbar,
.toolbar-actions,
.results-header,
.chip-row,
.active-filter-row {
  display: flex;
  gap: var(--space-3);
}

.filter-toolbar,
.results-header {
  justify-content: space-between;
  align-items: flex-end;
}

.filter-search {
  min-width: min(100%, 34rem);
}

.chip-row,
.active-filter-row {
  flex-wrap: wrap;
}

.filter-chip,
.active-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.65rem 0.95rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.filter-chip {
  cursor: pointer;
}

.filter-chip:hover,
.filter-chip:focus-visible,
.filter-chip.active {
  background: var(--accent-teal-light);
  border-color: var(--accent-teal);
  color: var(--text-primary);
  box-shadow: var(--shadow-glow-teal);
  transform: translateY(-0.0625rem);
  outline: none;
}

.active-pill {
  border-color: var(--glass-border);
  background: var(--glass-bg);
}

.results-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.empty-state {
  justify-items: start;
}

@media (max-width: 1200px) {
  .results-grid,
  .hero-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 960px) {
  .hero-panel,
  .results-grid,
  .hero-metrics {
    grid-template-columns: 1fr;
  }

  .filter-toolbar,
  .results-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .toolbar-actions {
    width: 100%;
    flex-wrap: wrap;
  }
}
</style>
