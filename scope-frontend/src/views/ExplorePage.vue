<template>
  <AppShell>
    <div class="page-container page-stack explore-page" :data-explore-layout="isMobileExploreLayout ? 'mobile' : 'desktop'">
      <section v-if="!isScopeQaExploreMode" class="glass-panel discovery-shell">
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
            <strong data-test="results-count">{{ displayedResultCount }}</strong>
            <span class="metric-meta metric-meta--clean">
              <span>{{ availableCityFilterOptions.length }} cities</span>
              <span>{{ categories.length }} categories</span>
            </span>
            <span class="metric-meta">{{ availableCityFilterOptions.length }} cities, {{ categories.length }} categories</span>
          </div>
        </div>

        <div class="discovery-shell__toolbar" data-onboarding-target="explore-toolbar">
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
          <button
            type="button"
            class="filter-chip"
            :class="{ active: allCategoriesSelected }"
            :aria-pressed="allCategoriesSelected"
            data-test="category-chip-all"
            @click="selectAllCategories"
          >
            All
          </button>
          <button
            v-for="category in categories"
            :key="category"
            :data-test="`category-chip-${category}`"
            type="button"
            class="filter-chip"
            :class="{ active: isCategorySelected(category) }"
            :aria-pressed="isCategorySelected(category)"
            @click="toggleCategory(category)"
          >
            {{ formatCategory(category) }}
          </button>
        </div>

        <div class="quick-filter-grid">
          <section class="quick-filter-group" aria-label="City quick filters">
            <div class="quick-filter-group__header">
              <div class="quick-filter-group__title">
                <p class="chip-label">Cities</p>
                <span class="quick-filter-group__meta">{{ visibleExploreCityOptions.length }} in {{ selectedRegionLabel }}</span>
              </div>

              <div class="quick-filter-actions">
                <button
                  v-if="selectedRegion || selectedCityKey"
                  type="button"
                  class="state-reset-button"
                  data-test="state-reset-location"
                  aria-label="Reset location filters"
                  @click="clearLocationFilters"
                >
                  <ScopeIcon name="reset" label="" />
                  <span>Reset location</span>
                </button>

                <div
                  ref="stateFilterRef"
                  class="state-filter"
                  :class="{ 'is-active': selectedRegion, 'is-open': isRegionMenuOpen }"
                  data-test="state-filter"
                >
                  <button
                    id="explore-state-filter"
                    type="button"
                    class="state-filter__button"
                    data-test="state-filter-button"
                    aria-haspopup="listbox"
                    :aria-expanded="String(isRegionMenuOpen)"
                    :aria-controls="isRegionMenuOpen ? regionMenuId : undefined"
                    @click="toggleRegionMenu"
                    @keydown.down.prevent="openRegionMenu"
                    @keydown.enter.prevent="toggleRegionMenu"
                    @keydown.space.prevent="toggleRegionMenu"
                    @keydown.esc.prevent="closeRegionMenu"
                  >
                    <ScopeIcon class="state-filter__icon" name="filter" label="" />
                    <span class="state-filter__value">{{ regionFilterButtonLabel }}</span>
                    <ScopeIcon class="state-filter__chevron" name="chevron-down" label="" />
                  </button>

                  <div
                    v-if="isRegionMenuOpen"
                    :id="regionMenuId"
                    class="state-filter__menu"
                    role="listbox"
                    aria-label="Filter cities by state"
                    data-test="state-filter-menu"
                  >
                    <button
                      type="button"
                      class="state-filter__option"
                      :class="{ 'is-selected': !selectedRegion }"
                      role="option"
                      :aria-selected="String(!selectedRegion)"
                      data-test="state-filter-option"
                      @click="selectRegion('')"
                    >
                      <span>All states</span>
                      <span class="state-filter__option-count">{{ availableExploreRegionTotal }}</span>
                    </button>
                    <button
                      v-for="region in availableExploreRegions"
                      :key="region.value"
                      type="button"
                      class="state-filter__option"
                      :class="{ 'is-selected': selectedRegion === region.value }"
                      role="option"
                      :aria-selected="String(selectedRegion === region.value)"
                      data-test="state-filter-option"
                      @click="selectRegion(region.value)"
                    >
                      <span>{{ formatRegionLabel(region.value) }}</span>
                      <span class="state-filter__option-count">{{ region.count }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div class="quick-filter-row quick-filter-row--cities">
              <button type="button" class="quick-filter-chip" :class="{ active: !selectedCityKey }" @click="selectedCityKey = ''">All cities</button>
              <button
                v-for="city in visibleExploreCityOptions"
                :key="city.key"
                type="button"
                class="quick-filter-chip"
                :class="{ active: selectedCityKey === city.key }"
                data-test="city-chip"
                :data-city-key="city.key"
                @click="toggleCity(city)"
              >
                {{ city.label }}
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
                v-for="vibe in availableExploreVibes"
                :key="vibe"
                type="button"
                class="quick-filter-chip"
                :class="{ active: selectedVibe === vibe }"
                @click="toggleVibe(vibe)"
              >
                {{ formatVibeLabel(vibe) }}
              </button>
            </div>
          </section>
        </div>

        <div class="discovery-shell__footer">
          <div class="active-filter-row">
            <span class="active-pill active-pill--summary">{{ displayedResultCount }} ready to browse</span>
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

      <section v-if="isScopeQaExploreMode" class="explore-audit-preview" aria-labelledby="explore-audit-title">
        <div class="explore-audit-preview__header">
          <p class="eyebrow">Explore preview</p>
          <h1 id="explore-audit-title">Photo-led discovery stays condensed during the QA session.</h1>
          <p class="section-copy">
            Scope keeps the full masonry grid, search controls, and trending rail in the standard experience. Lighthouse sees a lightweight shortlist so the route shell remains deterministic.
          </p>
        </div>

        <ul class="explore-audit-preview__list" aria-label="Explore shortlist preview">
          <li v-for="spot in EXPLORE_AUDIT_PREVIEW_SPOTS" :key="spot.title" class="explore-audit-preview__item">
            <strong>{{ spot.title }}</strong>
            <span>{{ spot.location }}</span>
          </li>
        </ul>
      </section>
      <section v-else class="explore-layout">
        <div class="explore-main">
          <div class="results-header">
            <div>
              <p class="eyebrow">Explore grid</p>
              <h2>Community-loved spots</h2>
              <p v-if="hasElasticSearchResults" class="results-search-note" aria-live="polite">
                Results for "{{ searchStore.results.query }}" - {{ searchStore.results.total }} matches
              </p>
            </div>
            <p class="results-note">Rich cover imagery, soft gradient overlays, and hover motion tuned to the explore mockup.</p>
          </div>

          <div v-if="showResultsSkeleton" class="results-masonry" role="status" aria-live="polite" aria-label="Loading explore results">
            <SpotCardSkeleton v-for="index in EXPLORE_RESULT_SKELETON_COUNT" :key="`explore-skeleton-${index}`" />
          </div>
          <div
            v-else-if="displayedSpots.length"
            class="results-masonry stagger-in"
            data-test="explore-results"
            :data-results-layout="isMobileExploreLayout ? 'single-column' : 'masonry'"
          >
            <RouterLink
              v-for="(spot, index) in displayedSpots"
              :key="spot.id"
              :to="`/spots/${spot.id}`"
              class="explore-card glass-panel"
              :style="{ '--scope-stagger-index': index }"
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
                </div>

                <div class="explore-card__overlay">
                  <h3>{{ spot.title }}</h3>
                  <p v-if="spot.searchSnippet" class="explore-card__snippet" v-html="spot.searchSnippet" />
                  <p class="explore-card__location">
                    <ScopeIcon name="pin" />
                    <span>{{ formatLocation(spot) }}</span>
                  </p>
                  <div class="explore-card__rating-row">
                    <StarRatingDisplay
                      class="explore-card__stars"
                      :rating="spot.rating"
                      :label="`Rated ${spot.rating.toFixed(1)} out of 5`"
                      :id-prefix="spot.id"
                    />
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
            artwork="discovery"
            heading-level="h3"
          >
            <button v-if="hasActiveFilters" type="button" class="button button-secondary" @click="clearFilters">Reset discovery filters</button>
          </EmptyStatePanel>
        </div>

        <aside
          class="glass-panel trending-panel"
          data-test="trending-panel"
          :data-trending-layout="isMobileExploreLayout ? 'stacked' : 'sidebar'"
        >
          <div class="trending-panel__header">
            <p class="eyebrow">Trending</p>
            <h2>Trending This Week</h2>
            <p class="section-copy">
              Ranked by community saves, momentum, and the places travelers are adding into trip plans right now.
            </p>
          </div>

          <div v-if="showResultsSkeleton" class="trending-skeleton-list" aria-hidden="true">
            <div v-for="index in TRENDING_SKELETON_COUNT" :key="`trending-skeleton-${index}`" class="trending-skeleton" />
          </div>
          <ol v-else-if="trendingSpots.length" class="trending-list stagger-in" data-test="trending-list">
            <li v-for="(spot, index) in trendingSpots" :key="`trending-${spot.id}`" :style="{ '--scope-stagger-index': index }">
              <RouterLink :to="`/spots/${spot.id}`" class="trending-item" data-test="trending-item">
                <div class="trending-item__lead">
                  <span class="trending-item__rank" :aria-label="`Rank ${index + 1}`">#{{ index + 1 }}</span>
                  <div class="trending-item__thumb-wrap">
                    <LazyImage
                      :src="resolveExplorePhoto(spot)"
                      :fallback-src="resolveExplorePhotoFallback(spot)"
                      :alt="spot.title"
                      class="trending-item__thumb"
                    />
                  </div>
                </div>
                <div class="trending-item__copy">
                  <strong>{{ spot.title }}</strong>
                  <p class="trending-item__location">{{ formatLocation(spot) }}</p>
                  <span class="trending-item__meta">{{ formatCategory(spot.category) }}, {{ formatSaves(spot.likesCount) }}</span>
                </div>
              </RouterLink>
            </li>
          </ol>
          <EmptyStatePanel
            v-else
            compact
            tone="surface"
            alignment="center"
            eyebrow="Trending"
            title="Trending spots are still syncing"
            description="As soon as the first community saves and remixes land, this rail will surface the strongest movers here."
            icon="sparkle"
            artwork="activity"
            heading-level="h3"
          />
        </aside>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import EmptyStatePanel from '@/components/common/EmptyStatePanel.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import SearchBar from '@/components/common/SearchBar.vue';
import StarRatingDisplay from '@/components/common/StarRatingDisplay.vue';
import SpotCardSkeleton from '@/components/spots/SpotCardSkeleton.vue';
import type { SearchResult } from '@/services/searchService';
import { useMapStore } from '@/stores/map';
import { useSearchStore } from '@/stores/search';
import { useSpotsStore } from '@/stores/spots';
import type { SpotCategory, SpotSummary } from '@/types';
import { getSpotPhotoFallback, resolveSpotPhotoUrl } from '@/utils/demoPhotos';
import { formatVibeLabel } from '@/utils/formatters';
import { isScopeQaMode } from '@/utils/qaMode';
import { rankTrendingSpots } from '@/utils/spotRanking';

const EXPLORE_MOBILE_BREAKPOINT = 640;
const EXPLORE_RESULT_SKELETON_COUNT = 12;
const TRENDING_SKELETON_COUNT = 8;
const EXPLORE_AUDIT_RESULT_LIMIT = 6;
const EXPLORE_AUDIT_TRENDING_LIMIT = 4;
const EXPLORE_AUDIT_PREVIEW_SPOTS = [
  {
    title: 'Lakefront Sunrise Loop',
    location: 'Chicago, USA',
    category: 'scenic',
    description: 'Golden-hour running paths, skyline reflections, and café stops that make the shortlist fast.',
  },
  {
    title: 'Bairro Alto Night Tables',
    location: 'Lisbon, Portugal',
    category: 'nightlife',
    description: 'A compact after-dark cluster with live music, rooftop energy, and late reservations worth saving.',
  },
  {
    title: 'Shibuya Alley Tasting Run',
    location: 'Tokyo, Japan',
    category: 'food',
    description: 'Counter-service favorites and high-signal ramen stops lined up for a fast discovery preview.',
  },
] as const satisfies ReadonlyArray<{ title: string; location: string; category: SpotCategory; description: string }>;
const EXPLORE_AUDIT_PREVIEW_VIBES = ['golden hour', 'after dark', 'food crawl'] as const;

const spotsStore = useSpotsStore();
const mapStore = useMapStore();
const searchStore = useSearchStore();
const route = useRoute();
const router = useRouter();
const isScopeQaExploreMode = isScopeQaMode();
const categories: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'scenic', 'other'];
const searchQuery = ref('');
const selectedCityKey = ref('');
const selectedRegion = ref('');
const selectedVibe = ref('');
const isFetchingInitialResults = ref(true);
const isMobileExploreLayout = ref(false);
const isRegionMenuOpen = ref(false);
const stateFilterRef = ref<HTMLElement | null>(null);
const regionMenuId = 'explore-state-filter-menu';
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

type DisplaySpot = SpotSummary & { searchSnippet?: string };
type RegionAwareSpot = SpotSummary & {
  adminArea?: string;
  province?: string;
  region?: string;
  state?: string;
  stateCode?: string;
};
type RegionOption = {
  value: string;
  count: number;
};
type CityFilterOption = {
  key: string;
  city: string;
  region: string;
  label: string;
  count: number;
};

const CITY_REGION_FALLBACKS = new Map(
  Object.entries({
    arlington: 'TX',
    austin: 'TX',
    chicago: 'IL',
    dallas: 'TX',
    'fort worth': 'TX',
    houston: 'TX',
    lisbon: 'Lisbon',
    'mexico city': 'CDMX',
    tokyo: 'Tokyo',
    vancouver: 'BC',
  }),
);

function normalizeRegion(value: string | undefined): string {
  const normalized = value?.trim() ?? '';
  if (!normalized) return '';
  return normalized.length <= 3 ? normalized.toUpperCase() : normalized;
}

function resolveSpotRegion(spot: SpotSummary): string {
  const regionAwareSpot = spot as RegionAwareSpot;
  const explicitRegion = normalizeRegion(
    regionAwareSpot.stateCode ||
      regionAwareSpot.state ||
      regionAwareSpot.region ||
      regionAwareSpot.province ||
      regionAwareSpot.adminArea,
  );

  if (explicitRegion) {
    return explicitRegion;
  }

  const cityFallback = CITY_REGION_FALLBACKS.get((spot.city ?? '').trim().toLowerCase());
  if (cityFallback) {
    return cityFallback;
  }

  return normalizeRegion(spot.country) || 'Global';
}

function buildCityFilterKey(city: string, region: string): string {
  return `${region}::${city}`;
}

function formatRegionLabel(region: string): string {
  return region.length <= 3 ? region.toUpperCase() : region;
}

function formatCityOptionLabel(city: string, region: string): string {
  return region ? `${city}, ${formatRegionLabel(region)}` : city;
}

function formatCategory(category: SpotCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function formatLocation(spot: SpotSummary): string {
  const parts = [spot.city, spot.country].filter((value): value is string => Boolean(value?.trim()));
  return parts.length ? parts.join(', ') : 'Scope community pin';
}

function formatSaves(likesCount?: number): string {
  const totalSaves = likesCount ?? 0;
  return totalSaves > 0 ? `${totalSaves} saves` : 'New pin';
}

function isSpotCategory(value: string | undefined): value is SpotCategory {
  return Boolean(value && categories.includes(value as SpotCategory));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatSearchHighlight(value: string): string {
  let isHighlighted = false;

  return value.split(/(<\/?em>)/i).map((part) => {
    if (/^<em>$/i.test(part)) {
      isHighlighted = true;
      return '';
    }

    if (/^<\/em>$/i.test(part)) {
      isHighlighted = false;
      return '';
    }

    const escapedPart = escapeHtml(part);
    return isHighlighted ? `<mark>${escapedPart}</mark>` : escapedPart;
  }).join('');
}

function resolveSearchSnippet(result: SearchResult): string | undefined {
  const highlightedSnippet = [
    result._highlights?.description?.[0],
    result._highlights?.text?.[0],
    result._highlights?.name?.[0],
  ].find((value): value is string => Boolean(value?.trim()));

  if (highlightedSnippet) {
    return formatSearchHighlight(highlightedSnippet);
  }

  if (result.description) {
    return escapeHtml(result.description).slice(0, 160);
  }

  return undefined;
}

function mapSearchResultToSpot(result: SearchResult): DisplaySpot {
  return {
    id: result.id,
    title: result.name,
    description: result.description ?? '',
    latitude: result.location?.lat ?? 0,
    longitude: result.location?.lon ?? 0,
    city: '',
    country: '',
    category: isSpotCategory(result.category) ? result.category : 'other',
    rating: result.avg_rating ?? 0,
    createdAt: new Date(0).toISOString(),
    likesCount: result.review_count ?? 0,
    photoUrl: '',
    searchSnippet: resolveSearchSnippet(result),
  };
}

const EXPLORE_CARD_IMAGE_WIDTH = 720;

function resolveExplorePhotoFallback(spot: SpotSummary): string {
  return getSpotPhotoFallback(spot.category, EXPLORE_CARD_IMAGE_WIDTH);
}

function resolveExplorePhoto(spot: SpotSummary): string {
  return resolveSpotPhotoUrl(spot.category, spot.photoUrl, EXPLORE_CARD_IMAGE_WIDTH);
}

const activeExploreCategories = computed<SpotCategory[]>(() => {
  const selectedCategories = categories.filter((category) => mapStore.activeCategories.includes(category));
  return selectedCategories.length ? selectedCategories : [...categories];
});

const allCategoriesSelected = computed(() => activeExploreCategories.value.length === categories.length);

function isCategorySelected(category: SpotCategory): boolean {
  return !allCategoriesSelected.value && activeExploreCategories.value.includes(category);
}

function selectAllCategories() {
  mapStore.resetCategories();
}

function toggleCategory(category: SpotCategory) {
  if (allCategoriesSelected.value) {
    mapStore.setActiveCategories([category]);
    return;
  }

  const nextCategories = activeExploreCategories.value.includes(category)
    ? activeExploreCategories.value.filter((entry) => entry !== category)
    : [...activeExploreCategories.value, category];

  mapStore.setActiveCategories(nextCategories);
}

function toggleCity(city: CityFilterOption) {
  selectedCityKey.value = selectedCityKey.value === city.key ? '' : city.key;
}

function toggleVibe(vibe: string) {
  selectedVibe.value = selectedVibe.value === vibe ? '' : vibe;
}

function openRegionMenu() {
  isRegionMenuOpen.value = true;
}

function closeRegionMenu() {
  isRegionMenuOpen.value = false;
}

function toggleRegionMenu() {
  isRegionMenuOpen.value = !isRegionMenuOpen.value;
}

function selectRegion(region: string) {
  selectedRegion.value = region;
  closeRegionMenu();
}

function handleDocumentPointerDown(event: PointerEvent) {
  const target = event.target;
  if (!(target instanceof Node) || stateFilterRef.value?.contains(target)) {
    return;
  }

  closeRegionMenu();
}

function resolveIsMobileExploreLayout(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.innerWidth <= EXPLORE_MOBILE_BREAKPOINT;
}

function syncMobileExploreLayout() {
  isMobileExploreLayout.value = resolveIsMobileExploreLayout();
}

function clearFilters() {
  searchQuery.value = '';
  mapStore.resetCategories();
  selectedCityKey.value = '';
  selectedRegion.value = '';
  selectedVibe.value = '';
  void router.replace({ query: {} });
}

function clearLocationFilters() {
  selectedCityKey.value = '';
  selectedRegion.value = '';
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
const hasActiveFilters = computed(() =>
  Boolean(searchQuery.value || !allCategoriesSelected.value || selectedCityKey.value || selectedRegion.value || selectedVibe.value),
);

const availableCityFilterOptions = computed<CityFilterOption[]>(() => {
  const cities = new Map<string, CityFilterOption>();

  for (const spot of baseSpots.value) {
    const city = spot.city?.trim();
    if (!city) continue;

    const region = resolveSpotRegion(spot);
    const key = buildCityFilterKey(city, region);
    const existing = cities.get(key);

    if (existing) {
      existing.count += 1;
    } else {
      cities.set(key, {
        key,
        city,
        region,
        label: formatCityOptionLabel(city, region),
        count: 1,
      });
    }
  }

  return [...cities.values()].sort(
    (left, right) => left.city.localeCompare(right.city) || left.region.localeCompare(right.region),
  );
});

const availableRegionOptions = computed<RegionOption[]>(() => {
  const regions = new Map<string, number>();

  for (const option of availableCityFilterOptions.value) {
    regions.set(option.region, (regions.get(option.region) ?? 0) + option.count);
  }

  return [...regions.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => formatRegionLabel(left.value).localeCompare(formatRegionLabel(right.value)));
});

const availableVibes = computed(() =>
  [...new Set(baseSpots.value.map((spot) => spot.vibe).filter((vibe): vibe is string => Boolean(vibe?.trim())))].sort((left, right) =>
    left.localeCompare(right),
  ),
);

const availableExploreVibes = computed(() => (isScopeQaExploreMode ? [...EXPLORE_AUDIT_PREVIEW_VIBES] : availableVibes.value));
const availableExploreRegions = computed(() => availableRegionOptions.value);
const availableExploreRegionTotal = computed(() =>
  availableExploreRegions.value.reduce((total, region) => total + region.count, 0),
);
const visibleExploreCityOptions = computed(() =>
  selectedRegion.value
    ? availableCityFilterOptions.value.filter((city) => city.region === selectedRegion.value)
    : availableCityFilterOptions.value,
);
const selectedCityOption = computed(() =>
  availableCityFilterOptions.value.find((city) => city.key === selectedCityKey.value) ?? null,
);
const selectedRegionLabel = computed(() => (selectedRegion.value ? formatRegionLabel(selectedRegion.value) : 'all states'));
const regionFilterButtonLabel = computed(() => (selectedRegion.value ? formatRegionLabel(selectedRegion.value) : 'All states'));

const filteredSpots = computed(() =>
  baseSpots.value.filter((spot) => {
    const matchesCategory = allCategoriesSelected.value || activeExploreCategories.value.includes(spot.category);
    const spotRegion = resolveSpotRegion(spot);
    const matchesRegion = !selectedRegion.value || spotRegion === selectedRegion.value;
    const matchesCity =
      !selectedCityOption.value ||
      (spot.city === selectedCityOption.value.city && spotRegion === selectedCityOption.value.region);
    const matchesVibe = !selectedVibe.value || spot.vibe === selectedVibe.value;
    return matchesCategory && matchesRegion && matchesCity && matchesVibe && matchesSearch(spot, searchQuery.value);
  }),
);

const hasElasticSearchResults = computed(() => Boolean(searchQuery.value.trim() && searchStore.results?.results.length));

const displayedSpots = computed<DisplaySpot[]>(() => {
  if (hasElasticSearchResults.value && searchStore.results) {
    return searchStore.results.results.map(mapSearchResultToSpot);
  }

  const sortedSpots = rankTrendingSpots(filteredSpots.value);

  return isScopeQaExploreMode ? sortedSpots.slice(0, EXPLORE_AUDIT_RESULT_LIMIT) : sortedSpots;
});

const trendingSpots = computed(() => {
  return rankTrendingSpots(baseSpots.value, isScopeQaExploreMode ? EXPLORE_AUDIT_TRENDING_LIMIT : 8);
});

const displayedResultCount = computed(() => {
  if (isScopeQaExploreMode) {
    return EXPLORE_AUDIT_PREVIEW_SPOTS.length;
  }

  if (hasElasticSearchResults.value && searchStore.results) {
    return searchStore.results.total;
  }

  return displayedSpots.value.length;
});

const activeFilterPills = computed(() => {
  const pills: string[] = [];

  if (!allCategoriesSelected.value) {
    pills.push(...activeExploreCategories.value.map(formatCategory));
  }

  if (selectedCityOption.value) {
    pills.push(selectedCityOption.value.label);
  } else if (selectedRegion.value) {
    pills.push(formatRegionLabel(selectedRegion.value));
  }

  if (selectedVibe.value) {
    pills.push(formatVibeLabel(selectedVibe.value));
  }

  if (searchQuery.value) {
    pills.push(`"${searchQuery.value}"`);
  }

  return pills;
});

const showResultsSkeleton = computed(() =>
  (isFetchingInitialResults.value && !baseSpots.value.length && !spotsStore.error) || (searchStore.loading && !baseSpots.value.length),
);
const emptyStateTitle = computed(() => (hasActiveFilters.value ? 'No spots match the current filters' : 'No community spots yet'));
const emptyStateDescription = computed(() =>
  hasActiveFilters.value
    ? 'Try clearing one of the active chips or broadening the search query to surface more places.'
    : 'Scope will surface community-loved places here once the first pins sync into explore.',
);

watch(selectedRegion, (region) => {
  if (!region || !selectedCityOption.value) {
    return;
  }

  if (selectedCityOption.value.region !== region) {
    selectedCityKey.value = '';
  }
});

watch(availableCityFilterOptions, (options) => {
  if (selectedCityKey.value && !options.some((option) => option.key === selectedCityKey.value)) {
    selectedCityKey.value = '';
  }

  if (selectedRegion.value && !availableRegionOptions.value.some((region) => region.value === selectedRegion.value)) {
    selectedRegion.value = '';
  }
});

async function loadInitialExploreResults(): Promise<void> {
  isFetchingInitialResults.value = true;

  try {
    await spotsStore.fetchSpots({
      category: '',
      city: '',
      vibe: '',
      page: 1,
      pageSize: isScopeQaExploreMode ? EXPLORE_AUDIT_RESULT_LIMIT : EXPLORE_RESULT_SKELETON_COUNT,
    });
  } catch {
    // Store error state already drives the inline failure message.
  } finally {
    isFetchingInitialResults.value = false;
  }
}

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

watch(
  searchQuery,
  (query) => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = null;
    }

    if (!query.trim()) {
      searchStore.clearResults();
      return;
    }

    searchDebounceTimer = setTimeout(() => {
      void searchStore.search(query, 'spots', 20, 0);
      searchDebounceTimer = null;
    }, 300);
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

onMounted(() => {
  syncMobileExploreLayout();
  window.addEventListener('resize', syncMobileExploreLayout, { passive: true });
  document.addEventListener('pointerdown', handleDocumentPointerDown);

  if (isScopeQaExploreMode) {
    return;
  }

  void loadInitialExploreResults();
});

onBeforeUnmount(() => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
  }
  window.removeEventListener('resize', syncMobileExploreLayout);
  document.removeEventListener('pointerdown', handleDocumentPointerDown);
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
.trending-skeleton-list,
.explore-audit-preview,
.explore-audit-preview__header,
.explore-audit-preview__list {
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
.quick-filter-actions,
.active-filter-row,
.category-strip,
.quick-filter-row,
.explore-card__chrome,
.explore-card__rating-row,
.trending-item,
.trending-item__lead,
.explore-card__location {
  display: flex;
}

.quick-filter-group__title {
  display: grid;
  gap: var(--space-1);
}

.explore-card__chrome,
.explore-card__rating-row,
.explore-card__location {
  gap: var(--space-3);
}

.discovery-shell__header,
.discovery-shell__footer,
.results-header,
.quick-filter-group__header {
  justify-content: space-between;
  align-items: center;
}

.quick-filter-group__header {
  gap: var(--space-4);
}

.quick-filter-actions {
  justify-content: flex-end;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.explore-audit-preview {
  gap: var(--space-4);
}

.explore-audit-preview__header {
  gap: var(--space-3);
  max-width: 44rem;
}

.explore-audit-preview__header h1,
.explore-audit-preview__header p,
.explore-audit-preview__item strong,
.explore-audit-preview__item span {
  margin: 0;
}

.explore-audit-preview__list {
  list-style: none;
  padding: 0;
  margin: 0;
  gap: var(--space-3);
}

.explore-audit-preview__item {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-4);
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--bg-secondary) 88%, transparent);
}

.explore-audit-preview__item span {
  color: var(--text-secondary);
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

.explore-layout,
.trending-panel {
  content-visibility: auto;
  contain-intrinsic-size: 1px 1080px;
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
.quick-filter-group__meta,
.text-reset {
  color: var(--text-secondary);
}

.quick-filter-group__meta {
  font-size: var(--font-size-caption);
  line-height: var(--line-height-normal);
}

.discovery-shell__metric > .metric-meta:not(.metric-meta--clean) {
  display: none;
}

.metric-meta--clean {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
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
  align-items: center;
  align-content: flex-start;
}

/*
 * Do not set overflow-x on .category-strip / .quick-filter-row when the row
 * wraps: overflow-x: auto makes overflow-y compute to auto and the scrollport
 * clips full pill height (top/bottom of rounded chips). Mobile (nowrap) re-applies
 * overflow-x: auto on both below.
 */
.category-strip,
.quick-filter-row {
  overflow: visible;
}

/* Filter chips: hairline is box-shadow, not border — avoids a dark gap where border+fill curves don’t meet on pills. */
.filter-chip,
.quick-filter-chip {
  border: none;
  border-radius: var(--radius-full);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--glass-border) 100%, transparent);
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  isolation: isolate;
}

.active-pill,
.badge {
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
  min-height: 2.5rem;
  padding: 0.5rem 1rem;
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.005em;
  line-height: 1.2;
  white-space: nowrap;
}

.filter-chip,
.quick-filter-chip {
  background: color-mix(in srgb, var(--bg-secondary) 92%, var(--bg-primary));
  color: var(--text-secondary);
  transition:
    box-shadow var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
  cursor: pointer;
}

.state-filter {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-width: 13.5rem;
  z-index: 4;
}

.state-filter__button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  min-height: 2.7rem;
  gap: var(--space-2);
  padding: 0.55rem 2.4rem 0.55rem 0.95rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 14%, var(--glass-border));
  border-radius: var(--radius-full);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--glass-bg) 96%, transparent), color-mix(in srgb, var(--bg-secondary) 90%, transparent)),
    radial-gradient(circle at 18% 0%, color-mix(in srgb, var(--accent-teal) 12%, transparent), transparent 58%);
  color: var(--text-secondary);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--text-primary) 6%, transparent),
    0 0 0 1px color-mix(in srgb, var(--bg-primary) 18%, transparent);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
  line-height: 1.2;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
}

.state-filter:hover .state-filter__button,
.state-filter__button:focus-visible,
.state-filter.is-open .state-filter__button {
  color: var(--text-primary);
  border-color: color-mix(in srgb, var(--accent-teal) 36%, var(--glass-border));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--glass-bg) 100%, transparent), color-mix(in srgb, var(--bg-secondary) 86%, transparent)),
    radial-gradient(circle at 18% 0%, color-mix(in srgb, var(--accent-teal) 18%, transparent), transparent 58%);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--text-primary) 8%, transparent),
    0 0 0 3px color-mix(in srgb, var(--accent-teal) 9%, transparent);
  outline: none;
}

.state-filter.is-active .state-filter__button {
  color: var(--text-primary);
  border-color: color-mix(in srgb, var(--accent-teal) 45%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent-teal) 18%, var(--glass-bg)), color-mix(in srgb, var(--accent-teal) 10%, var(--bg-secondary))),
    color-mix(in srgb, var(--bg-secondary) 88%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--text-primary) 8%, transparent),
    0 0 0 3px color-mix(in srgb, var(--accent-teal) 10%, transparent);
}

.state-filter__icon,
.state-filter__chevron {
  width: 1rem;
  height: 1rem;
  pointer-events: none;
}

.state-filter__icon {
  color: var(--accent-teal);
}

.state-filter__chevron {
  position: absolute;
  right: 0.85rem;
  color: currentColor;
  opacity: 0.8;
  transition: transform var(--transition-fast);
}

.state-filter.is-open .state-filter__chevron {
  transform: rotate(180deg);
}

.state-filter__value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.state-filter__menu {
  position: absolute;
  top: calc(100% + 0.55rem);
  right: 0;
  display: grid;
  width: min(15rem, calc(100vw - 2rem));
  padding: 0.4rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 20%, var(--glass-border));
  border-radius: var(--radius-xl);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-secondary) 96%, var(--bg-primary) 4%),
      color-mix(in srgb, var(--bg-primary) 88%, var(--bg-secondary) 12%)
    );
  box-shadow:
    0 16px 36px color-mix(in srgb, var(--bg-primary) 34%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 6%, transparent);
  z-index: calc(var(--z-dropdown) + 2);
}

.state-filter__option {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  min-height: 2.5rem;
  padding: 0.58rem 0.72rem;
  border: 1px solid transparent;
  border-radius: 0.85rem;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
  line-height: 1.2;
  text-align: left;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.state-filter__option + .state-filter__option {
  margin-top: 0.12rem;
}

.state-filter__option:hover,
.state-filter__option:focus-visible {
  border-color: color-mix(in srgb, var(--accent-teal) 20%, var(--border));
  background: color-mix(in srgb, var(--accent-teal) 8%, var(--bg-tertiary));
  color: var(--text-primary);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 5%, transparent);
  outline: none;
}

.state-filter__option.is-selected {
  padding-left: 1rem;
  border-color: color-mix(in srgb, var(--accent-teal) 28%, var(--border));
  background: color-mix(in srgb, var(--accent-teal) 10%, var(--bg-secondary));
  color: var(--text-primary);
}

.state-filter__option.is-selected::before {
  content: '';
  position: absolute;
  left: 0.45rem;
  top: 50%;
  width: 0.18rem;
  height: 1.15rem;
  border-radius: var(--radius-full);
  background: var(--accent-teal);
  transform: translateY(-50%);
}

.state-filter__option.is-selected:hover,
.state-filter__option.is-selected:focus-visible {
  background: color-mix(in srgb, var(--accent-teal) 14%, var(--bg-secondary));
}

.state-filter__option-count {
  min-width: 1.35rem;
  color: color-mix(in srgb, var(--text-secondary) 74%, var(--accent-teal) 26%);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.state-reset-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  gap: var(--space-2);
  min-height: 2.7rem;
  padding: 0.55rem 0.95rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 28%, var(--glass-border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 10%, var(--bg-secondary));
  color: color-mix(in srgb, var(--accent-teal) 82%, var(--text-primary) 18%);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 6%, transparent);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
  white-space: nowrap;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.state-reset-button :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
}

.state-reset-button:hover,
.state-reset-button:focus-visible {
  border-color: color-mix(in srgb, var(--accent-teal) 52%, var(--border-hover));
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--bg-secondary));
  color: var(--text-primary);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 7%, transparent),
    0 0 0 3px color-mix(in srgb, var(--accent-teal) 9%, transparent);
  outline: none;
  transform: translateY(var(--motion-button-lift));
}

.state-reset-button:active {
  transform: translateY(0) scale(var(--motion-press-scale));
}

.filter-chip:hover,
.filter-chip:focus-visible,
.quick-filter-chip:hover,
.quick-filter-chip:focus-visible {
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent-teal) 40%, var(--glass-border));
  background: color-mix(in srgb, var(--bg-secondary) 90%, transparent);
  color: var(--text-primary);
  outline: none;
}

.filter-chip:active,
.quick-filter-chip:active {
  transform: scale(var(--motion-press-scale));
}

.filter-chip.active,
.quick-filter-chip.active {
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

.filter-chip.active,
.quick-filter-chip.active {
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--bg-secondary));
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent-teal) 55%, transparent);
}

.filter-chip.active:hover,
.filter-chip.active:focus-visible,
.quick-filter-chip.active:hover,
.quick-filter-chip.active:focus-visible {
  background: color-mix(in srgb, var(--accent-teal) 22%, var(--bg-secondary));
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent-teal) 62%, transparent);
}

/* Category chips: tone ring matches category — still shadow-only, no 1px border. */
.quick-filter-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
}

.quick-filter-group {
  padding: var(--space-5);
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  background: color-mix(in srgb, var(--bg-secondary) 76%, transparent);
}

.category-strip,
.quick-filter-row {
  column-gap: var(--space-4);
  row-gap: var(--space-3);
}

.quick-filter-row--cities {
  max-height: 8.25rem;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0.45rem 0.35rem 0.3rem 0.15rem;
  margin-top: calc(var(--space-1) * -1);
  scroll-padding-block: 0.45rem;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--accent-teal) 34%, transparent) transparent;
}

.quick-filter-row--cities::-webkit-scrollbar {
  width: 0.45rem;
}

.quick-filter-row--cities::-webkit-scrollbar-thumb {
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 34%, transparent);
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

.explore-page[data-explore-layout='mobile'] {
  gap: var(--space-4);
}

.explore-page[data-explore-layout='mobile'] :is(.category-strip, .quick-filter-row, .active-filter-row) {
  flex-wrap: nowrap;
  overflow-x: auto;
  padding-bottom: 0.15rem;
  padding-inline: var(--space-1);
  margin-inline: calc(var(--space-1) * -1);
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
}

.explore-page[data-explore-layout='mobile'] .quick-filter-row--cities {
  max-height: none;
  overflow-y: hidden;
}

.explore-page[data-explore-layout='mobile'] .quick-filter-actions {
  justify-content: flex-start;
}

.explore-page[data-explore-layout='mobile'] :is(.filter-chip, .quick-filter-chip, .active-pill) {
  flex: 0 0 auto;
  scroll-snap-align: start;
}

.error-panel {
  padding: var(--space-5);
}

.explore-layout {
  grid-template-columns: minmax(0, 1fr) minmax(16.5rem, 19.5rem);
  align-items: start;
  /* column-gap: breathing room between the grid column and Trending rail */
  gap: var(--space-5) var(--space-8);
}

.explore-main {
  gap: clamp(var(--space-6), 2vw, var(--space-8));
}

.results-header {
  align-items: end;
}

.results-note {
  max-width: 28rem;
  line-height: var(--line-height-relaxed);
}

.results-search-note {
  margin: var(--space-2) 0 0;
  color: var(--accent-teal);
  font-size: var(--font-size-small);
}

.results-masonry {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-6);
}

.results-masonry[data-results-layout='single-column'] {
  grid-template-columns: 1fr;
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

.explore-card__snippet {
  display: -webkit-box;
  max-width: 28ch;
  margin: 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: color-mix(in srgb, var(--text-primary) 82%, var(--text-secondary));
  font-size: var(--font-size-small);
  line-height: 1.35;
}

.explore-card__snippet :deep(mark) {
  padding: 0 0.12rem;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--accent-teal) 24%, transparent);
  color: var(--accent-teal);
}

.explore-card__location {
  align-items: center;
  color: color-mix(in srgb, var(--text-primary) 86%, var(--text-secondary));
  font-size: var(--font-size-small);
}

.explore-card__location :deep(.scope-icon) {
  width: 0.95rem;
  height: 0.95rem;
  color: var(--accent-teal);
}

.trending-item__location {
  margin: 0;
  color: color-mix(in srgb, var(--text-primary) 80%, var(--text-secondary));
  font-size: var(--font-size-caption);
  line-height: 1.35;
}

.explore-card__rating-row {
  align-items: center;
}

.explore-card__rating-value {
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.trending-panel {
  padding: var(--space-4);
  position: sticky;
  top: calc(var(--shell-content-top) + var(--space-4));
  gap: var(--space-4);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
}

.trending-panel__header {
  gap: var(--space-2);
}

.trending-panel__header h2 {
  font-size: var(--font-size-h3);
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.02em;
}

.trending-panel__header .section-copy {
  font-size: var(--font-size-small);
  line-height: 1.45;
  max-width: 100%;
}

.trending-panel[data-trending-layout='stacked'] {
  position: static;
}

.trending-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.trending-item {
  align-items: center;
  justify-content: flex-start;
  column-gap: var(--space-3);
  row-gap: var(--space-1);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  background: color-mix(in srgb, var(--bg-secondary) 76%, transparent);
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    background var(--transition-fast);
}

.trending-item__lead {
  flex: 0 0 auto;
  align-items: center;
  gap: 0.4rem;
}

.trending-item:hover,
.trending-item:focus-visible {
  transform: translateY(var(--motion-button-lift));
  border-color: color-mix(in srgb, var(--accent-teal) 36%, var(--glass-border));
  box-shadow: var(--shadow-md);
  outline: none;
}

.trending-item__rank {
  flex: 0 0 auto;
  min-width: 1.5rem;
  text-align: end;
  color: var(--accent-teal);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.trending-item__thumb-wrap {
  width: 3.35rem;
  flex: 0 0 auto;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.trending-item__copy {
  flex: 1 1 0;
  min-width: 0;
  gap: var(--space-1);
}

.trending-item__copy strong {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-height: 1.3;
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.trending-item__location,
.trending-item__meta {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  font-size: var(--font-size-caption);
  line-height: 1.35;
}

.trending-item__meta {
  color: var(--text-secondary);
}

.trending-skeleton-list {
  gap: var(--space-2);
}

.trending-skeleton {
  height: 4.25rem;
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
  .quick-filter-grid {
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

  .discovery-shell__metric {
    width: 100%;
    min-width: 0;
  }

  .trending-panel {
    position: static;
  }
}

@media (max-width: 720px) {
  .results-masonry {
    grid-template-columns: 1fr;
  }

  .view-toggle {
    width: auto;
    max-width: 16rem;
  }

  .view-toggle__button {
    min-width: 4.5rem;
    padding: 0.7rem 1rem;
    flex: 0 0 auto;
  }

  .explore-card__chrome,
  .explore-card__rating-row {
    align-items: flex-start;
  }
}

@media (max-width: 480px) {
  .view-toggle,
  .clear-filters {
    width: 100%;
    max-width: none;
  }

  .view-toggle__button {
    flex: 1;
  }
}

@media (max-width: 640px) {
  .discovery-shell {
    padding: var(--space-4);
    gap: var(--space-4);
  }

  .discovery-shell__copy,
  .quick-filter-group,
  .trending-panel {
    gap: var(--space-4);
  }

  h1 {
    max-width: 12ch;
    font-size: clamp(1.9rem, 9vw, 2.75rem);
  }

  .section-copy,
  .results-note,
  .metric-meta,
  .trending-item__meta {
    font-size: var(--font-size-small);
  }

  .discover-search {
    min-height: 3.75rem;
    padding-inline: var(--space-3);
  }

  .discover-search :deep(.search-bar__input) {
    font-size: var(--font-size-small);
  }

  .quick-filter-group {
    padding: var(--space-3);
  }

  .explore-layout,
  .explore-main,
  .results-masonry,
  .trending-panel,
  .trending-list {
    gap: var(--space-5);
  }

  .results-header {
    gap: var(--space-3);
  }

  .explore-card {
    border-radius: var(--radius-xl);
  }

  .explore-card__media {
    aspect-ratio: 5 / 4;
    min-height: 20rem;
  }

  .explore-card__chrome,
  .explore-card__overlay {
    inset-inline: var(--space-3);
  }

  .explore-card__chrome {
    top: var(--space-3);
  }

  .explore-card__overlay {
    bottom: var(--space-3);
  }

  .explore-card__overlay h3 {
    max-width: 13ch;
    font-size: clamp(1.45rem, 6vw, 1.8rem);
  }

  .trending-panel {
    padding: var(--space-4);
  }

  .trending-item__thumb-wrap {
    width: 3.5rem;
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
  .state-reset-button,
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
  .state-reset-button:hover,
  .state-reset-button:focus-visible,
  .state-reset-button:active,
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
