<template>
  <AppShell>
    <div class="page-container page-stack explore-page">
      <section class="glass-panel discovery-shell">
        <div class="discovery-shell__header">
          <div class="discovery-shell__copy">
            <p class="eyebrow">Discover</p>
            <h1>Explore standout places through photo-led discovery.</h1>
            <p class="section-copy">
              Search by spot, city, or vibe, then refine the shortlist with premium category chips and a ranked trending rail.
            </p>
          </div>

          <div class="surface-card discovery-shell__metric">
            <span class="metric-label">Curated results</span>
            <strong data-test="results-count">{{ displayedSpots.length }}</strong>
            <span class="metric-meta">{{ availableCities.length }} cities · {{ categories.length }} categories</span>
          </div>
        </div>

        <div class="discovery-shell__toolbar">
          <SearchBar
            v-model="searchQuery"
            class="discover-search"
            label="Search spots"
            placeholder="Search spots, cities, vibes..."
          />

          <div class="view-toggle" aria-label="Explore layout switch">
            <button type="button" class="view-toggle__button is-active" aria-pressed="true">Grid</button>
            <RouterLink class="view-toggle__button" to="/map">Map</RouterLink>
          </div>
        </div>

        <div class="category-strip" role="toolbar" aria-label="Spot categories">
          <button type="button" class="filter-chip" :class="{ active: !selectedCategory }" @click="selectedCategory = ''">All</button>
          <button
            v-for="category in categories"
            :key="category"
            :data-test="`category-chip-${category}`"
            type="button"
            class="filter-chip"
            :class="[
              { active: selectedCategory === category },
              selectedCategory === category ? ['chip-toned', `badge-${category}`] : [],
            ]"
            @click="toggleCategory(category)"
          >
            {{ formatCategory(category) }}
          </button>
        </div>

        <div class="quick-filter-grid">
          <section class="quick-filter-group" aria-label="City quick filters">
            <div class="quick-filter-group__header">
              <p class="chip-label">Cities</p>
              <button v-if="selectedCity" type="button" class="text-reset" @click="selectedCity = ''">Reset</button>
            </div>
            <div class="quick-filter-row">
              <button type="button" class="quick-filter-chip" :class="{ active: !selectedCity }" @click="selectedCity = ''">All cities</button>
              <button
                v-for="city in availableCities"
                :key="city"
                type="button"
                class="quick-filter-chip"
                :class="{ active: selectedCity === city }"
                @click="toggleCity(city)"
              >
                {{ city }}
              </button>
            </div>
          </section>

          <section class="quick-filter-group" aria-label="Vibe quick filters">
            <div class="quick-filter-group__header">
              <p class="chip-label">Vibes</p>
              <button v-if="selectedVibe" type="button" class="text-reset" @click="selectedVibe = ''">Reset</button>
            </div>
            <div class="quick-filter-row">
              <button type="button" class="quick-filter-chip" :class="{ active: !selectedVibe }" @click="selectedVibe = ''">Any vibe</button>
              <button
                v-for="vibe in availableVibes"
                :key="vibe"
                type="button"
                class="quick-filter-chip"
                :class="{ active: selectedVibe === vibe }"
                @click="toggleVibe(vibe)"
              >
                {{ formatVibe(vibe) }}
              </button>
            </div>
          </section>
        </div>

        <div class="discovery-shell__footer">
          <div class="active-filter-row">
            <span class="active-pill active-pill--summary">{{ displayedSpots.length }} ready to browse</span>
            <span v-for="pill in activeFilterPills" :key="pill" class="active-pill">{{ pill }}</span>
          </div>

          <button type="button" class="button button-secondary clear-filters" @click="clearFilters">Clear filters</button>
        </div>
      </section>

      <article v-if="spotsStore.error" class="glass-panel error-panel" role="alert">
        <p class="eyebrow">Temporary issue</p>
        <h2>Explore results could not be refreshed</h2>
        <p class="section-copy">{{ spotsStore.error }}</p>
      </article>

      <section class="explore-layout">
        <div class="explore-main">
          <div class="results-header">
            <div>
              <p class="eyebrow">Explore grid</p>
              <h2>Community-loved spots</h2>
            </div>
            <p class="results-note">Rich cover imagery, soft gradient overlays, and hover motion tuned to the explore mockup.</p>
          </div>

          <div v-if="showResultsSkeleton" class="results-masonry" role="status" aria-live="polite" aria-label="Loading explore results">
            <SpotCardSkeleton v-for="index in 6" :key="`explore-skeleton-${index}`" />
          </div>
          <div v-else-if="displayedSpots.length" class="results-masonry stagger-in" data-test="explore-results">
            <RouterLink
              v-for="(spot, index) in displayedSpots"
              :key="spot.id"
              :to="`/spots/${spot.id}`"
              class="explore-card glass-panel"
              :style="{ '--atlas-stagger-index': index }"
              data-test="explore-card"
            >
              <div class="explore-card__media">
                <LazyImage
                  :src="resolveExplorePhoto(spot)"
                  :fallback-src="resolveExplorePhotoFallback(spot)"
                  :alt="spot.title"
                  class="explore-card__image"
                />

                <div class="explore-card__chrome">
                  <span class="badge" :class="`badge-${spot.category}`">{{ formatCategory(spot.category) }}</span>
                  <span class="explore-card__save" aria-hidden="true">
                    <AtlasIcon name="heart" />
                  </span>
                </div>

                <div class="explore-card__overlay">
                  <h3>{{ spot.title }}</h3>
                  <p class="explore-card__location">
                    <AtlasIcon name="pin" />
                    <span>{{ formatLocation(spot) }}</span>
                  </p>
                  <div class="explore-card__rating-row">
                    <div class="explore-card__stars" :aria-label="`Rated ${spot.rating.toFixed(1)} out of 5`">
                      <AtlasIcon
                        v-for="starIndex in 5"
                        :key="`${spot.id}-star-${starIndex}`"
                        name="star-filled"
                        :class="['explore-card__star', { 'is-active': starIndex <= roundedRating(spot.rating) }]"
                      />
                    </div>
                    <span class="explore-card__rating-value">{{ spot.rating.toFixed(1) }}</span>
                  </div>
                </div>
              </div>
            </RouterLink>
          </div>
          <EmptyStatePanel
            v-else-if="!spotsStore.error"
            eyebrow="Discovery results"
            :title="emptyStateTitle"
            :description="emptyStateDescription"
            icon="search"
            heading-level="h3"
          >
            <button v-if="hasActiveFilters" type="button" class="button button-secondary" @click="clearFilters">Reset discovery filters</button>
          </EmptyStatePanel>
        </div>

        <aside class="glass-panel trending-panel">
          <div class="trending-panel__header">
            <p class="eyebrow">Trending</p>
            <h2>Trending This Week</h2>
            <p class="section-copy">
              Ranked by community saves, momentum, and the places travelers are adding into trip plans right now.
            </p>
          </div>

          <div v-if="showResultsSkeleton" class="trending-skeleton-list" aria-hidden="true">
            <div v-for="index in 6" :key="`trending-skeleton-${index}`" class="trending-skeleton" />
          </div>
          <ol v-else-if="trendingSpots.length" class="trending-list stagger-in" data-test="trending-list">
            <li v-for="(spot, index) in trendingSpots" :key="`trending-${spot.id}`" :style="{ '--atlas-stagger-index': index }">
              <RouterLink :to="`/spots/${spot.id}`" class="trending-item" data-test="trending-item">
                <span class="trending-item__rank" :aria-label="`Rank ${index + 1}`">#{{ index + 1 }}</span>
                <div class="trending-item__thumb-wrap">
                  <LazyImage
                    :src="resolveExplorePhoto(spot)"
                    :fallback-src="resolveExplorePhotoFallback(spot)"
                    :alt="spot.title"
                    class="trending-item__thumb"
                  />
                </div>
                <div class="trending-item__copy">
                  <strong>{{ spot.title }}</strong>
                  <p>
                    <AtlasIcon name="pin" />
                    <span>{{ formatLocation(spot) }}</span>
                  </p>
                  <span>{{ formatCategory(spot.category) }} · {{ formatSaves(spot.likesCount) }}</span>
                </div>
              </RouterLink>
            </li>
          </ol>
          <p v-else class="trending-empty">Trending spots are syncing into Atlas right now.</p>
        </aside>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import EmptyStatePanel from '@/components/common/EmptyStatePanel.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import SearchBar from '@/components/common/SearchBar.vue';
import SpotCardSkeleton from '@/components/spots/SpotCardSkeleton.vue';
import { useSpotsStore } from '@/stores/spots';
import type { SpotCategory, SpotSummary } from '@/types';
import { getSpotPhotoFallback, resolveSpotPhotoUrl } from '@/utils/demoPhotos';

const spotsStore = useSpotsStore();
const route = useRoute();
const router = useRouter();
const categories: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'scenic', 'other'];
const searchQuery = ref('');
const selectedCategory = ref<SpotCategory | ''>('');
const selectedCity = ref('');
const selectedVibe = ref('');
const isFetchingInitialResults = ref(true);

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

function formatLocation(spot: SpotSummary): string {
  const parts = [spot.city, spot.country].filter((value): value is string => Boolean(value?.trim()));
  return parts.length ? parts.join(', ') : 'Atlas community pin';
}

function formatSaves(likesCount?: number): string {
  const totalSaves = likesCount ?? 0;
  return totalSaves > 0 ? `${totalSaves} saves` : 'New pin';
}

function roundedRating(rating: number): number {
  return Math.max(0, Math.min(5, Math.round(rating)));
}

function resolveExplorePhotoFallback(spot: SpotSummary): string {
  return getSpotPhotoFallback(spot.category, 1200);
}

function resolveExplorePhoto(spot: SpotSummary): string {
  return resolveSpotPhotoUrl(spot.category, spot.photoUrl, 1200);
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
const hasActiveFilters = computed(() => Boolean(searchQuery.value || selectedCategory.value || selectedCity.value || selectedVibe.value));

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

const displayedSpots = computed(() =>
  [...filteredSpots.value].sort(
    (left, right) => (right.likesCount ?? 0) - (left.likesCount ?? 0) || right.rating - left.rating || right.createdAt.localeCompare(left.createdAt),
  ),
);

const trendingSpots = computed(() =>
  [...baseSpots.value]
    .sort((left, right) => (right.likesCount ?? 0) - (left.likesCount ?? 0) || right.rating - left.rating || right.createdAt.localeCompare(left.createdAt))
    .slice(0, 8),
);

const activeFilterPills = computed(() => {
  const pills: string[] = [];

  if (selectedCategory.value) {
    pills.push(formatCategory(selectedCategory.value));
  }

  if (selectedCity.value) {
    pills.push(selectedCity.value);
  }

  if (selectedVibe.value) {
    pills.push(formatVibe(selectedVibe.value));
  }

  if (searchQuery.value) {
    pills.push(`“${searchQuery.value}”`);
  }

  return pills;
});

const showResultsSkeleton = computed(() => isFetchingInitialResults.value && !baseSpots.value.length && !spotsStore.error);
const emptyStateTitle = computed(() => (hasActiveFilters.value ? 'No spots match the current filters' : 'No community spots yet'));
const emptyStateDescription = computed(() =>
  hasActiveFilters.value
    ? 'Try clearing one of the active chips or broadening the search query to surface more places.'
    : 'Atlas will surface community-loved places here once the first pins sync into explore.',
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
  try {
    await spotsStore.fetchSpots({ category: '', city: '', vibe: '', page: 1, pageSize: 12 });
  } catch {
    // Store error state already drives the inline failure message.
  } finally {
    isFetchingInitialResults.value = false;
  }
});
</script>

<style scoped>
.explore-page,
.discovery-shell,
.quick-filter-grid,
.quick-filter-group,
.error-panel,
.explore-layout,
.explore-main,
.results-masonry,
.trending-panel,
.trending-panel__header,
.trending-list,
.trending-item__copy,
.trending-skeleton-list {
  display: grid;
  gap: var(--space-5);
}

.discovery-shell {
  padding: clamp(var(--space-5), 3vw, var(--space-8));
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent-teal) 16%, transparent), transparent 32%),
    linear-gradient(180deg, color-mix(in srgb, var(--glass-bg) 100%, transparent), color-mix(in srgb, var(--bg-secondary) 72%, var(--glass-bg)));
}

.discovery-shell__header,
.discovery-shell__toolbar,
.discovery-shell__footer,
.results-header,
.quick-filter-group__header,
.active-filter-row,
.category-strip,
.quick-filter-row,
.explore-card__chrome,
.explore-card__rating-row,
.trending-item,
.trending-item__copy p {
  display: flex;
  gap: var(--space-3);
}

.discovery-shell__header,
.discovery-shell__footer,
.results-header,
.quick-filter-group__header,
.trending-item {
  justify-content: space-between;
  align-items: center;
}

.discovery-shell__copy {
  display: grid;
  gap: var(--space-3);
  max-width: var(--copy-measure-wide);
}

.eyebrow,
.metric-label,
.chip-label {
  margin: 0;
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-eyebrow);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}

h1,
h2,
h3,
p,
strong,
span {
  margin: 0;
}

h1 {
  font-size: var(--font-size-h1);
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-display);
  max-width: 18ch;
}

h2 {
  font-size: var(--font-size-h2);
  line-height: var(--line-height-tight);
}

.discovery-shell__metric {
  min-width: 12rem;
  padding: var(--space-5);
  display: grid;
  gap: var(--space-2);
  align-self: stretch;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 100%, transparent), color-mix(in srgb, var(--accent-teal) 10%, var(--bg-secondary)));
}

.discovery-shell__metric strong {
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1;
}

.metric-meta,
.results-note,
.text-reset,
.trending-item__copy span,
.trending-empty {
  color: var(--text-secondary);
}

.discovery-shell__toolbar {
  align-items: stretch;
}

.discover-search {
  flex: 1;
  min-height: 4.25rem;
  padding-inline: var(--space-4);
  border-radius: var(--radius-2xl);
  border-color: color-mix(in srgb, var(--glass-border) 100%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--glass-border) 100%, transparent);
}

.discover-search:focus-within {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-teal) 45%, var(--glass-border)), var(--shadow-glow-teal);
}

.discover-search :deep(.search-bar__input) {
  font-size: 1rem;
}

.discover-search :deep(.search-bar__icon) {
  color: color-mix(in srgb, var(--text-secondary) 100%, transparent);
}

.view-toggle {
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 0.35rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  background: color-mix(in srgb, var(--bg-secondary) 82%, var(--glass-bg));
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
}

.view-toggle__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 5rem;
  padding: 0.9rem 1.1rem;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-secondary);
  font-weight: var(--font-weight-semibold);
  transition:
    transform var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.view-toggle__button:hover,
.view-toggle__button:focus-visible {
  color: var(--text-primary);
  transform: translateY(var(--motion-button-lift));
  outline: none;
}

.view-toggle__button:active {
  transform: translateY(0) scale(var(--motion-press-scale));
}

.view-toggle__button.is-active {
  background: color-mix(in srgb, var(--accent-teal) 18%, var(--bg-secondary));
  color: var(--text-primary);
  box-shadow: var(--shadow-glow-teal);
}

.category-strip,
.quick-filter-row,
.active-filter-row {
  flex-wrap: wrap;
}

.category-strip,
.quick-filter-row {
  overflow-x: auto;
  scrollbar-width: thin;
}

.filter-chip,
.quick-filter-chip,
.active-pill,
.badge,
.explore-card__save {
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
}

.filter-chip,
.quick-filter-chip,
.active-pill,
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  padding: 0.7rem 1rem;
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
}

.filter-chip,
.quick-filter-chip {
  background: color-mix(in srgb, var(--bg-secondary) 85%, transparent);
  color: var(--text-secondary);
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast);
  cursor: pointer;
}

.filter-chip:hover,
.filter-chip:focus-visible,
.quick-filter-chip:hover,
.quick-filter-chip:focus-visible {
  transform: translateY(var(--motion-chip-active-lift));
  border-color: color-mix(in srgb, var(--accent-teal) 40%, var(--glass-border));
  color: var(--text-primary);
  outline: none;
}

.filter-chip:active,
.quick-filter-chip:active {
  transform: translateY(0) scale(var(--motion-press-scale));
}

.filter-chip.active,
.quick-filter-chip.active {
  transform: translateY(var(--motion-chip-active-lift));
  box-shadow: var(--shadow-md);
}

.filter-chip.active:not(.chip-toned),
.quick-filter-chip.active {
  border-color: var(--accent-teal);
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--bg-secondary));
  color: var(--text-primary);
}

.filter-chip.chip-toned {
  border-color: currentColor;
  box-shadow: 0 0 0 1px color-mix(in srgb, currentColor 24%, transparent), var(--shadow-md);
}

.quick-filter-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.quick-filter-group {
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  background: color-mix(in srgb, var(--bg-secondary) 76%, transparent);
}

.text-reset {
  padding: 0;
  border: 0;
  background: transparent;
  font: inherit;
  cursor: pointer;
  transition: transform var(--transition-fast), color var(--transition-fast);
}

.text-reset:hover,
.text-reset:focus-visible {
  color: var(--text-primary);
  outline: none;
}

.text-reset:active {
  transform: scale(var(--motion-press-scale));
}

.discovery-shell__footer {
  align-items: flex-start;
}

.active-pill {
  background: color-mix(in srgb, var(--glass-bg) 100%, transparent);
  color: var(--text-primary);
}

.active-pill--summary {
  border-color: color-mix(in srgb, var(--accent-teal) 40%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 14%, var(--bg-secondary));
}

.clear-filters {
  flex-shrink: 0;
}

.error-panel {
  padding: var(--space-5);
}

.explore-layout {
  grid-template-columns: minmax(0, 1fr) 17.5rem;
  align-items: start;
}

.results-header {
  align-items: end;
}

.results-note {
  max-width: 28rem;
  line-height: var(--line-height-relaxed);
}

.results-masonry {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
}

.explore-card {
  overflow: hidden;
  min-height: 0;
  transition:
    transform var(--transition-normal),
    box-shadow var(--transition-normal),
    border-color var(--transition-normal);
}

.explore-card:hover,
.explore-card:focus-visible {
  transform: translateY(var(--motion-card-lift));
  box-shadow: var(--shadow-lg);
  border-color: color-mix(in srgb, var(--accent-teal) 38%, var(--border-hover));
  outline: none;
}

.explore-card__media {
  position: relative;
  isolation: isolate;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent-teal) 14%, transparent), transparent 38%),
    linear-gradient(180deg, var(--bg-tertiary), var(--bg-secondary));
}

.explore-card__media::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 8%, transparent) 0%, transparent 30%, color-mix(in srgb, var(--bg-primary) 84%, transparent) 100%),
    linear-gradient(0deg, color-mix(in srgb, var(--accent-teal) 10%, transparent), transparent 50%);
  pointer-events: none;
}

.explore-card__image,
.trending-item__thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-slow), filter var(--transition-slow);
}

.explore-card:hover .explore-card__image,
.explore-card:focus-visible .explore-card__image,
.trending-item:hover .trending-item__thumb,
.trending-item:focus-visible .trending-item__thumb {
  transform: scale(var(--motion-image-zoom));
}

.explore-card__chrome,
.explore-card__overlay {
  position: absolute;
  inset-inline: var(--space-4);
  z-index: 1;
}

.explore-card__chrome {
  top: var(--space-4);
  justify-content: space-between;
  align-items: center;
}

.badge {
  box-shadow: var(--shadow-sm);
  text-transform: capitalize;
}

.explore-card__save {
  display: inline-grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  background: color-mix(in srgb, var(--glass-bg) 92%, transparent);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}

.explore-card__save :deep(.atlas-icon) {
  width: 1rem;
  height: 1rem;
}

.explore-card__overlay {
  bottom: var(--space-4);
  display: grid;
  gap: var(--space-2);
}

.explore-card__overlay h3 {
  font-size: clamp(1.3rem, 2vw, 1.6rem);
  line-height: 1.1;
  letter-spacing: -0.03em;
  text-shadow: var(--shadow-md);
}

.explore-card__location,
.trending-item__copy p {
  align-items: center;
  color: color-mix(in srgb, var(--text-primary) 86%, var(--text-secondary));
  font-size: var(--font-size-small);
}

.explore-card__location :deep(.atlas-icon),
.trending-item__copy p :deep(.atlas-icon) {
  width: 0.95rem;
  height: 0.95rem;
  color: var(--accent-teal);
}

.explore-card__rating-row {
  align-items: center;
}

.explore-card__stars {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}

.explore-card__star {
  width: 0.95rem;
  height: 0.95rem;
  color: color-mix(in srgb, var(--accent-gold) 28%, var(--text-muted));
}

.explore-card__star.is-active {
  color: var(--accent-gold);
}

.explore-card__rating-value {
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.trending-panel {
  padding: var(--space-5);
  position: sticky;
  top: calc(var(--shell-content-top) + var(--space-4));
}

.trending-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.trending-item {
  padding: var(--space-3);
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  background: color-mix(in srgb, var(--bg-secondary) 76%, transparent);
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    background var(--transition-fast);
}

.trending-item:hover,
.trending-item:focus-visible {
  transform: translateY(var(--motion-button-lift));
  border-color: color-mix(in srgb, var(--accent-teal) 36%, var(--glass-border));
  box-shadow: var(--shadow-md);
  outline: none;
}

.trending-item__rank {
  min-width: 2.4rem;
  color: var(--accent-teal);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.trending-item__thumb-wrap {
  width: 4.25rem;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--radius-lg);
  flex-shrink: 0;
}

.trending-item__copy {
  min-width: 0;
  gap: var(--space-2);
}

.trending-item__copy strong {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  color: var(--text-primary);
}

.trending-item__copy p,
.trending-item__copy span {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.trending-skeleton-list {
  gap: var(--space-3);
}

.trending-skeleton {
  height: 5.25rem;
  border-radius: var(--radius-xl);
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--bg-secondary) 100%, transparent) 0%, color-mix(in srgb, var(--glass-bg) 100%, transparent) 50%, color-mix(in srgb, var(--bg-secondary) 100%, transparent) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.2s ease-in-out infinite;
}

@media (max-width: 1200px) {
  .results-masonry {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1080px) {
  .explore-layout,
  .quick-filter-grid,
  .discovery-shell__header,
  .discovery-shell__toolbar,
  .discovery-shell__footer,
  .results-header {
    grid-template-columns: 1fr;
  }

  .discovery-shell__header,
  .discovery-shell__toolbar,
  .discovery-shell__footer,
  .results-header,
  .quick-filter-group__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .trending-panel {
    position: static;
  }
}

@media (max-width: 720px) {
  .results-masonry {
    grid-template-columns: 1fr;
  }

  .view-toggle,
  .clear-filters {
    width: 100%;
  }

  .view-toggle__button {
    flex: 1;
  }

  .explore-card__chrome,
  .explore-card__rating-row,
  .trending-item {
    align-items: flex-start;
  }

  .trending-item {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .trending-skeleton {
    opacity: 1;
    animation: none;
  }

  .filter-chip,
  .quick-filter-chip,
  .view-toggle__button,
  .explore-card,
  .explore-card__image,
  .trending-item,
  .trending-item__thumb,
  .text-reset {
    transition: none;
  }

  .filter-chip:hover,
  .filter-chip:focus-visible,
  .filter-chip:active,
  .quick-filter-chip:hover,
  .quick-filter-chip:focus-visible,
  .quick-filter-chip:active,
  .view-toggle__button:hover,
  .view-toggle__button:focus-visible,
  .view-toggle__button:active,
  .explore-card:hover,
  .explore-card:focus-visible,
  .explore-card:hover .explore-card__image,
  .explore-card:focus-visible .explore-card__image,
  .trending-item:hover,
  .trending-item:focus-visible,
  .trending-item:hover .trending-item__thumb,
  .trending-item:focus-visible .trending-item__thumb,
  .text-reset:active {
    transform: none;
  }
}

@keyframes shimmer {
  100% {
    background-position: -200% 0;
  }
}
</style>
