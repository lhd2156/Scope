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
            @focusin="handleExploreSearchFocus"
          />

          <div class="view-toggle" aria-label="Explore layout switch">
            <button type="button" class="view-toggle__button is-active" aria-pressed="true">Grid</button>
            <RouterLink class="view-toggle__button" to="/map">Map</RouterLink>
          </div>
        </div>

        <section
          v-if="showExploreSearchRecommendations"
          class="search-recommendations"
          data-test="explore-search-recommendations"
          aria-labelledby="explore-search-recommendations-title"
        >
          <div class="search-recommendations__header">
            <div>
              <p class="chip-label">Search picks</p>
              <h2 id="explore-search-recommendations-title">{{ exploreSearchRecommendationTitle }}</h2>
            </div>
            <span v-if="exploreSearchRecommendations.length">{{ exploreSearchRecommendations.length }} places</span>
          </div>

          <div v-if="exploreSearchRecommendationsLoading" class="search-recommendations__state" role="status" aria-live="polite">
            Loading recommended places...
          </div>
          <div v-else-if="exploreSearchRecommendationsError" class="search-recommendations__state search-recommendations__state--error" role="alert">
            {{ exploreSearchRecommendationsError }}
          </div>
          <div v-else class="search-recommendations__grid" role="list">
            <button
              v-for="spot in exploreSearchRecommendations"
              :key="`explore-recommended-${spot.id}`"
              type="button"
              class="search-recommendation"
              data-test="explore-search-recommendation"
              role="listitem"
              @click="openExploreRecommendation(spot)"
            >
              <span class="search-recommendation__rank">{{ formatCategory(spot.category) }}</span>
              <strong>{{ spot.title }}</strong>
              <span>{{ formatRecommendationMeta(spot) }}</span>
            </button>
          </div>
        </section>

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
                <p class="chip-label">{{ locationFilterTitle }}</p>
                <span class="quick-filter-group__meta">{{ cityFilterMetaCopy }}</span>
              </div>

              <div class="quick-filter-actions">
                <button
                  v-if="selectedCountry || selectedRegion || selectedCityKey"
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
                  v-if="hasRegionFilterOptions"
                  ref="regionFilterControlRef"
                  class="region-filter-control"
                  :class="{ 'is-open': isRegionFilterOpen }"
                  data-test="state-filter-control"
                >
                  <button
                    type="button"
                    class="region-filter-button"
                    data-test="state-filter-select"
                    aria-haspopup="listbox"
                    :aria-expanded="String(isRegionFilterOpen)"
                    :aria-controls="regionFilterListboxId"
                    :aria-label="`${regionFilterControlLabel}: ${selectedRegionFilterLabel}`"
                    @click="toggleRegionFilterOpen"
                    @keydown.escape.prevent="closeRegionFilter"
                  >
                    <span class="region-filter-button__label">{{ regionFilterControlLabel }}</span>
                    <span class="region-filter-button__value">{{ selectedRegionFilterLabel }}</span>
                    <ScopeIcon name="chevron-down" label="" />
                  </button>

                  <div
                    v-if="isRegionFilterOpen"
                    :id="regionFilterListboxId"
                    class="region-filter-menu"
                    role="listbox"
                    :aria-label="`${regionFilterControlLabel} options`"
                  >
                    <button
                      type="button"
                      class="region-filter-option"
                      :class="{ active: !selectedRegion }"
                      role="option"
                      :aria-selected="String(!selectedRegion)"
                      data-test="state-filter-option"
                      data-region=""
                      @click="selectRegionOption('')"
                    >
                      <span>{{ regionFilterAllLabel }}</span>
                      <small>{{ regionFilterAllMetaLabel }}</small>
                    </button>
                    <button
                      v-for="region in availableRegionOptions"
                      :key="region.value"
                      type="button"
                      class="region-filter-option"
                      :class="{ active: selectedRegion === region.value }"
                      role="option"
                      :aria-selected="String(selectedRegion === region.value)"
                      data-test="state-filter-option"
                      :data-region="region.value"
                      @click="selectRegionOption(region.value)"
                    >
                      <span>{{ region.label }}</span>
                      <small>{{ formatRegionOptionMeta(region) }}</small>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div class="quick-filter-row quick-filter-row--countries" data-test="country-filter-row">
              <span v-if="!availableCountryOptions.length" class="quick-filter-chip quick-filter-chip--empty" data-test="country-chip-empty">
                Countries appear after spots sync.
              </span>
              <template v-else>
                <button
                  type="button"
                  class="quick-filter-chip"
                  :class="{ active: !selectedCountry }"
                  data-test="country-chip-all"
                  @click="selectCountry('')"
                >
                  All countries
                </button>
                <button
                  v-for="country in visibleCountryOptions"
                  :key="country.value"
                  type="button"
                  class="quick-filter-chip"
                  :class="{ active: selectedCountry === country.value }"
                  data-test="country-chip"
                  :data-country="country.value"
                  @click="selectCountry(country.value)"
                >
                  {{ country.label }}
                </button>
                <button
                  v-if="countryOverflowButtonLabel"
                  type="button"
                  class="quick-filter-chip quick-filter-chip--more"
                  data-test="country-chip-more"
                  :aria-expanded="String(isCountryFilterExpanded)"
                  :aria-label="countryOverflowButtonAriaLabel"
                  @click="toggleCountryFilterExpanded"
                >
                  {{ countryOverflowButtonLabel }}
                </button>
              </template>
            </div>
            <div class="quick-filter-section quick-filter-section--cities">
              <div class="quick-filter-section__label">
                <span>Cities</span>
                <small>{{ cityFilterScopeCopy }}</small>
              </div>
              <div class="quick-filter-row quick-filter-row--cities">
                <span v-if="!availableCityFilterOptions.length" class="quick-filter-chip quick-filter-chip--empty" data-test="city-chip-empty">
                  Cities appear after spots sync.
                </span>
                <span v-else-if="!visibleExploreCityOptions.length" class="quick-filter-chip quick-filter-chip--empty" data-test="city-chip-empty">
                  No cities with spots yet.
                </span>
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
                <button
                  v-if="cityOverflowButtonLabel"
                  type="button"
                  class="quick-filter-chip quick-filter-chip--more"
                  data-test="city-chip-more"
                  :aria-expanded="String(isCityFilterExpanded)"
                  :aria-label="cityOverflowButtonAriaLabel"
                  @click="toggleCityFilterExpanded"
                >
                  {{ cityOverflowButtonLabel }}
                </button>
              </div>
            </div>
          </section>

          <section class="quick-filter-group" aria-label="Vibe quick filters">
            <div class="quick-filter-group__header">
              <div class="quick-filter-group__title">
                <p class="chip-label">Vibes</p>
                <span class="quick-filter-group__meta">{{ vibeFilterMetaCopy }}</span>
              </div>
            </div>
            <div class="quick-filter-row quick-filter-row--vibes" data-test="vibe-chip-row">
              <span v-if="!availableExploreVibes.length" class="quick-filter-chip quick-filter-chip--empty" data-test="vibe-chip-empty">
                Vibes appear after spots sync.
              </span>
              <template v-else>
                <button
                  type="button"
                  class="quick-filter-chip"
                  :class="{ active: !selectedVibe }"
                  data-test="vibe-chip-all"
                  @click="selectVibe('')"
                >
                  Any vibe
                </button>
                <button
                  v-for="vibe in visibleExploreVibes"
                  :key="vibe"
                  type="button"
                  class="quick-filter-chip"
                  :class="{ active: selectedVibe === vibe }"
                  data-test="vibe-chip"
                  :data-vibe="vibe"
                  @click="selectVibe(vibe)"
                >
                  {{ formatVibeLabel(vibe) }}
                </button>
                <button
                  v-if="vibeOverflowButtonLabel"
                  type="button"
                  class="quick-filter-chip quick-filter-chip--more"
                  data-test="vibe-chip-more"
                  :aria-expanded="String(isVibeFilterExpanded)"
                  :aria-label="vibeOverflowButtonAriaLabel"
                  @click="toggleVibeFilterExpanded"
                >
                  {{ vibeOverflowButtonLabel }}
                </button>
              </template>
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

      <section v-if="isScopeQaExploreMode" class="explore-audit-preview" aria-labelledby="explore-audit-title">
        <div class="explore-audit-preview__header">
          <p class="eyebrow">Explore preview</p>
          <h1 id="explore-audit-title">Photo-led discovery stays condensed for quick previews.</h1>
          <p class="section-copy">
            Scope keeps the full masonry grid, search controls, and trending rail in the standard experience. This preview uses a lightweight shortlist so the route shell stays fast.
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
            <p class="results-note">{{ exploreGridRankDescription }}</p>
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
              :to="buildSpotPath(spot)"
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
                  <p v-if="spot.searchSnippet" class="explore-card__snippet" v-html="toTrustedSanitizedHtml(spot.searchSnippet)" />
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
          <nav
            v-if="showExplorePagination"
            class="explore-pagination"
            data-test="explore-pagination"
            aria-label="Community-loved spot pages"
          >
            <button
              type="button"
              class="explore-pagination__button"
              data-test="explore-page-prev"
              :disabled="exploreCurrentPage <= 1"
              aria-label="Previous explore page"
              @click="goToExplorePage(exploreCurrentPage - 1)"
            >
              <ScopeIcon name="arrow-left" />
            </button>
            <span class="explore-pagination__status" data-test="explore-page-status">
              {{ explorePaginationStatus }}
            </span>
            <button
              type="button"
              class="explore-pagination__button"
              data-test="explore-page-next"
              :disabled="exploreCurrentPage >= totalExplorePages"
              aria-label="Next explore page"
              @click="goToExplorePage(exploreCurrentPage + 1)"
            >
              <ScopeIcon name="arrow-right" />
            </button>
          </nav>
          <div v-if="!showResultsSkeleton && !displayedSpots.length" class="explore-empty-state" data-test="explore-empty-state">
            <p class="eyebrow">Discovery results</p>
            <h3>{{ emptyStateTitle }}</h3>
            <p>{{ emptyStateDescription }}</p>
            <button v-if="hasActiveFilters" type="button" class="button button-secondary" @click="clearFilters">
              Reset discovery filters
            </button>
          </div>
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
              <RouterLink :to="buildSpotPath(spot)" class="trending-item" data-test="trending-item">
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
                  <span class="trending-item__meta">{{ formatTrendingSignal(spot) }}</span>
                </div>
              </RouterLink>
            </li>
          </ol>
          <div v-else class="explore-empty-state explore-empty-state--trending" data-test="trending-empty-state">
            <p class="eyebrow">Trending</p>
            <h3>Trending spots are still syncing</h3>
            <p>As soon as the first community saves and remixes land, this rail will surface the strongest movers here.</p>
          </div>
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
import LazyImage from '@/components/common/LazyImage.vue';
import SearchBar from '@/components/common/SearchBar.vue';
import StarRatingDisplay from '@/components/common/StarRatingDisplay.vue';
import SpotCardSkeleton from '@/components/spots/SpotCardSkeleton.vue';
import {
  loadSearchPlaceRecommendations,
  recordSearchPlaceSuggestionClick,
  type SearchPlaceSuggestion,
} from '@/services/searchDiscoveryService';
import type { SearchResult } from '@/services/searchService';
import { useAuthStore } from '@/stores/auth';
import { useMapStore } from '@/stores/map';
import { useSearchStore } from '@/stores/search';
import { useSpotsStore } from '@/stores/spots';
import type { SpotCategory, SpotSummary } from '@/types';
import { getSpotPhotoFallback, resolveSpotPhotoUrl } from '@/utils/imageFallbacks';
import {
  formatCityRegionLocation,
  formatCountryLabel,
  formatLocationRegionLabel,
  formatVibeLabel,
  resolveCityRegionLocation,
  resolveLocationRegion,
} from '@/utils/formatters';
import { isScopeQaMode } from '@/utils/qaMode';
import { rankTrendingSpots } from '@/utils/spotRanking';
import { buildSpotPath } from '@/utils/spotRoutes';
import { toTrustedSanitizedHtml } from '@/utils/trustedHtml';

const EXPLORE_MOBILE_BREAKPOINT = 640;
const EXPLORE_GRID_PAGE_SIZE = 9;
const EXPLORE_RESULT_SKELETON_COUNT = EXPLORE_GRID_PAGE_SIZE;
const EXPLORE_DISCOVERY_BATCH_SIZE = 54;
const EXPLORE_SEARCH_RESULT_LIMIT = EXPLORE_DISCOVERY_BATCH_SIZE;
const TRENDING_SKELETON_COUNT = 8;
const EXPLORE_AUDIT_RESULT_LIMIT = 6;
const EXPLORE_AUDIT_TRENDING_LIMIT = 4;
const MAX_VISIBLE_COUNTRY_FILTERS = 5;
const MAX_VISIBLE_CITY_FILTERS = 6;
const MAX_VISIBLE_VIBE_FILTERS = 12;
const regionFilterListboxId = 'explore-region-filter-options';
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
const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();
const isScopeQaExploreMode = isScopeQaMode();
const categories: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'entertainment', 'scenic', 'other'];
const searchQuery = ref('');
const selectedCityKey = ref('');
const selectedCountry = ref('');
const selectedRegion = ref('');
const selectedVibe = ref('');
const isCountryFilterExpanded = ref(false);
const isCityFilterExpanded = ref(false);
const isVibeFilterExpanded = ref(false);
const isRegionFilterOpen = ref(false);
const isFetchingInitialResults = ref(true);
const isMobileExploreLayout = ref(false);
const hasFocusedExploreSearch = ref(false);
const exploreCurrentPage = ref(1);
const exploreSortMode = ref<ExploreSortMode>('community');
const exploreSearchRecommendations = ref<SearchPlaceSuggestion[]>([]);
const exploreSearchRecommendationsLoading = ref(false);
const exploreSearchRecommendationsError = ref<string | null>(null);
const regionFilterControlRef = ref<HTMLElement | null>(null);
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let exploreSearchRecommendationRequestId = 0;

type DisplaySpot = SpotSummary & { searchSnippet?: string };
type ExploreSortMode = 'community' | 'trending' | 'popular';
type CountryOption = {
  value: string;
  count: number;
  label: string;
};
type CityFilterOption = {
  key: string;
  city: string;
  region: string;
  country: string;
  label: string;
  count: number;
};
type RegionFilterOption = {
  value: string;
  label: string;
  count: number;
};

const LOCATION_SCOPE_SEPARATOR = '::';

function resolveSpotRegion(spot: SpotSummary): string {
  return resolveLocationRegion(spot, { allowCountryFallback: true }) || 'Global';
}

function resolveSpotCountry(spot: SpotSummary): string {
  return resolveCityRegionLocation(spot)?.country || formatCountryLabel(spot.country) || 'Global';
}

function buildCityFilterKey(city: string, region: string, country: string): string {
  return `${country}${LOCATION_SCOPE_SEPARATOR}${region}${LOCATION_SCOPE_SEPARATOR}${city}`;
}

function formatRegionLabel(region: string): string {
  return formatLocationRegionLabel(region);
}

function formatCityOptionLabel(city: string, region: string): string {
  return region ? `${city}, ${formatRegionLabel(region)}` : city;
}

function formatCategory(category: SpotCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function formatLocation(spot: SpotSummary): string {
  return formatCityRegionLocation(spot, 'Location syncing');
}

function formatTrendingSignal(spot: SpotSummary): string {
  const likesCount = spot.likesCount ?? 0;

  return likesCount > 0 ? `${likesCount} community saves` : `${formatCategory(spot.category)} pick`;
}

function getSpotCreatedTime(spot: SpotSummary): number {
  const timestamp = Date.parse(spot.createdAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function rankPopularSpots<TSpot extends SpotSummary>(spots: TSpot[]): TSpot[] {
  return [...spots].sort((left, right) => (
    (right.likesCount ?? 0) - (left.likesCount ?? 0) ||
    right.rating - left.rating ||
    getSpotCreatedTime(right) - getSpotCreatedTime(left) ||
    left.title.localeCompare(right.title) ||
    left.id.localeCompare(right.id)
  ));
}

function sortExploreSpotsForMode(spots: DisplaySpot[], sortMode: ExploreSortMode): DisplaySpot[] {
  if (sortMode === 'popular') {
    return rankPopularSpots(spots);
  }

  // The community mode currently shares the trending ranker until backend signals replace it.
  return rankTrendingSpots(spots);
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
  const spot: DisplaySpot = {
    id: result.id,
    title: result.name,
    description: result.description ?? '',
    latitude: result.location?.lat ?? 0,
    longitude: result.location?.lon ?? 0,
    city: result.city ?? '',
    country: result.country ?? '',
    category: isSpotCategory(result.category) ? result.category : 'other',
    rating: result.avg_rating ?? 0,
    createdAt: new Date(0).toISOString(),
    likesCount: result.review_count ?? 0,
    photoUrl: result.photoUrl ?? result.photo_url ?? '',
  };
  const searchSnippet = resolveSearchSnippet(result);

  if (searchSnippet) {
    spot.searchSnippet = searchSnippet;
  }

  return spot;
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

function toggleCityFilterExpanded() {
  isCityFilterExpanded.value = !isCityFilterExpanded.value;
}

function toggleCountryFilterExpanded() {
  isCountryFilterExpanded.value = !isCountryFilterExpanded.value;
}

function toggleVibeFilterExpanded() {
  isVibeFilterExpanded.value = !isVibeFilterExpanded.value;
}

function selectCountry(country: string) {
  selectedCountry.value = country;
  selectedRegion.value = '';
  selectedCityKey.value = '';
  isCityFilterExpanded.value = false;
  isRegionFilterOpen.value = false;
}

function selectRegion(region: string) {
  selectedRegion.value = region;
  selectedCityKey.value = '';
  isCityFilterExpanded.value = false;
}

function closeRegionFilter() {
  isRegionFilterOpen.value = false;
}

function toggleRegionFilterOpen() {
  isRegionFilterOpen.value = !isRegionFilterOpen.value;
}

function selectRegionOption(region: string) {
  selectRegion(region);
  closeRegionFilter();
}

function handleDocumentClick(event: MouseEvent) {
  const control = regionFilterControlRef.value;
  const target = event.target;
  if (!control || !(target instanceof Node) || control.contains(target)) {
    return;
  }

  closeRegionFilter();
}

function selectVibe(vibe: string) {
  selectedVibe.value = vibe;
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

function goToExplorePage(page: number) {
  const nextPage = Math.min(Math.max(1, page), totalExplorePages.value);
  exploreCurrentPage.value = nextPage;
}

function clearFilters() {
  searchQuery.value = '';
  mapStore.resetCategories();
  selectedCityKey.value = '';
  selectedCountry.value = '';
  selectedRegion.value = '';
  isCountryFilterExpanded.value = false;
  isCityFilterExpanded.value = false;
  isVibeFilterExpanded.value = false;
  isRegionFilterOpen.value = false;
  selectedVibe.value = '';
  void router.replace({ query: {} });
}

async function loadExploreSearchRecommendations(options: { force?: boolean } = {}): Promise<void> {
  if (!options.force && (exploreSearchRecommendations.value.length || exploreSearchRecommendationsLoading.value)) {
    return;
  }

  const requestId = exploreSearchRecommendationRequestId + 1;
  exploreSearchRecommendationRequestId = requestId;
  exploreSearchRecommendationsLoading.value = true;
  exploreSearchRecommendationsError.value = null;

  try {
    const recommendations = await loadSearchPlaceRecommendations({
      isAuthenticated: authStore.isAuthenticated,
      currentUser: authStore.currentUser,
      limit: 6,
    });

    if (requestId !== exploreSearchRecommendationRequestId) {
      return;
    }

    exploreSearchRecommendations.value = recommendations;
  } catch {
    if (requestId !== exploreSearchRecommendationRequestId) {
      return;
    }

    exploreSearchRecommendations.value = [];
    exploreSearchRecommendationsError.value = 'Recommended places are temporarily unavailable.';
  } finally {
    if (requestId === exploreSearchRecommendationRequestId) {
      exploreSearchRecommendationsLoading.value = false;
    }
  }
}

function handleExploreSearchFocus() {
  hasFocusedExploreSearch.value = true;
  void loadExploreSearchRecommendations();
}

function formatRecommendationMeta(spot: SearchPlaceSuggestion): string {
  const locationLabel = formatCityRegionLocation(spot, '');
  const meta = [
    locationLabel,
    spot.rating ? `${spot.rating.toFixed(1)} rating` : '',
    spot.recommendationReason,
    spot.vibe ? formatVibeLabel(spot.vibe) : '',
  ].filter(Boolean);

  return meta.length ? meta.join(' / ') : 'Scope place';
}

async function openExploreRecommendation(spot: SearchPlaceSuggestion): Promise<void> {
  void recordSearchPlaceSuggestionClick(spot);
  await router.push(buildSpotPath(spot));
}

function clearLocationFilters() {
  selectedCityKey.value = '';
  selectedCountry.value = '';
  selectedRegion.value = '';
  isCountryFilterExpanded.value = false;
  isCityFilterExpanded.value = false;
  isRegionFilterOpen.value = false;
}

function matchesSearch(spot: SpotSummary, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const searchableFields = [
    spot.title,
    spot.description,
    spot.city,
    spot.country,
    formatLocation(spot),
    ...resolveSpotVibes(spot),
    spot.author?.displayName,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.toLowerCase());

  return searchableFields.some((value) => value.includes(normalizedQuery));
}

function resolveSpotVibes(spot: SpotSummary): string[] {
  const values = [spot.vibe, ...(spot.pillars ?? [])]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  return [...new Set(values)];
}

const baseSpots = computed(() => spotsStore.items);
const hasActiveFilters = computed(() =>
  Boolean(searchQuery.value || !allCategoriesSelected.value || selectedCityKey.value || selectedCountry.value || selectedRegion.value || selectedVibe.value),
);

function matchesActiveCategoryFilter(spot: SpotSummary): boolean {
  return allCategoriesSelected.value || activeExploreCategories.value.includes(spot.category);
}

function matchesActiveVibeFilter(spot: SpotSummary): boolean {
  return !selectedVibe.value || resolveSpotVibes(spot).includes(selectedVibe.value);
}

function matchesSelectedCountry(spot: SpotSummary): boolean {
  if (!selectedCountry.value) {
    return true;
  }

  return resolveSpotCountry(spot) === selectedCountry.value;
}

function matchesSelectedCity(spot: SpotSummary): boolean {
  if (!selectedCityOption.value) {
    return true;
  }

  const spotLocation = resolveCityRegionLocation(spot);
  const locationRegion = spotLocation?.region || resolveSpotRegion(spot);
  const country = spotLocation?.country || resolveSpotCountry(spot);

  return (
    spotLocation?.city === selectedCityOption.value.city &&
    locationRegion === selectedCityOption.value.region &&
    country === selectedCityOption.value.country
  );
}

function matchesSelectedRegion(spot: SpotSummary): boolean {
  if (!selectedRegion.value) {
    return true;
  }

  const spotLocation = resolveCityRegionLocation(spot);
  const locationRegion = spotLocation?.region || resolveSpotRegion(spot);
  const country = spotLocation?.country || resolveSpotCountry(spot);

  return locationRegion === selectedRegion.value && (!selectedCountry.value || country === selectedCountry.value);
}

const locationOptionSourceSpots = computed(() =>
  baseSpots.value.filter((spot) =>
    matchesActiveCategoryFilter(spot) &&
    matchesActiveVibeFilter(spot) &&
    matchesSearch(spot, searchQuery.value),
  ),
);

const vibeOptionSourceSpots = computed(() =>
  baseSpots.value.filter((spot) =>
    matchesActiveCategoryFilter(spot) &&
    matchesSelectedCountry(spot) &&
    matchesSelectedRegion(spot) &&
    matchesSelectedCity(spot) &&
    matchesSearch(spot, searchQuery.value),
  ),
);

const availableCityFilterOptions = computed<CityFilterOption[]>(() => {
  const cities = new Map<string, CityFilterOption>();

  for (const spot of locationOptionSourceSpots.value) {
    const location = resolveCityRegionLocation(spot);
    if (!location?.city) continue;

    const city = location.city;
    const region = location.region || resolveSpotRegion(spot);
    const country = location.country || resolveSpotCountry(spot);
    const key = buildCityFilterKey(city, region, country);
    const existing = cities.get(key);

    if (existing) {
      existing.count += 1;
    } else {
      cities.set(key, {
        key,
        city,
        region,
        country,
        label: location.label || formatCityOptionLabel(city, region),
        count: 1,
      });
    }
  }

  return [...cities.values()].sort(
    (left, right) => left.city.localeCompare(right.city) || left.region.localeCompare(right.region),
  );
});

const availableCountryOptions = computed<CountryOption[]>(() => {
  const countries = new Map<string, number>();

  for (const option of availableCityFilterOptions.value) {
    countries.set(option.country, (countries.get(option.country) ?? 0) + option.count);
  }

  return [...countries.entries()]
    .map(([country, count]) => ({
      value: country,
      label: country,
      count,
    }))
    .sort((left, right) => {
      const leftWeight = left.value === 'USA' ? 0 : 1;
      const rightWeight = right.value === 'USA' ? 0 : 1;
      return leftWeight - rightWeight || left.label.localeCompare(right.label);
    });
});

const availableVibes = computed(() =>
  [...new Set(vibeOptionSourceSpots.value.flatMap((spot) => resolveSpotVibes(spot)))].sort((left, right) =>
    left.localeCompare(right),
  ),
);

const availableExploreVibes = computed(() => (isScopeQaExploreMode ? [...EXPLORE_AUDIT_PREVIEW_VIBES] : availableVibes.value));
const visibleExploreVibes = computed(() => {
  if (isVibeFilterExpanded.value) {
    return availableExploreVibes.value;
  }

  const visibleVibes = availableExploreVibes.value.slice(0, MAX_VISIBLE_VIBE_FILTERS);
  if (selectedVibe.value && availableExploreVibes.value.includes(selectedVibe.value) && !visibleVibes.includes(selectedVibe.value)) {
    return [selectedVibe.value, ...visibleVibes.slice(0, MAX_VISIBLE_VIBE_FILTERS - 1)];
  }

  return visibleVibes;
});
const hiddenVibeCount = computed(() =>
  Math.max(0, availableExploreVibes.value.length - new Set(visibleExploreVibes.value).size),
);
const vibeOverflowButtonLabel = computed(() => {
  if (isVibeFilterExpanded.value && availableExploreVibes.value.length > MAX_VISIBLE_VIBE_FILTERS) {
    return 'Show fewer';
  }

  return hiddenVibeCount.value ? `+${hiddenVibeCount.value} more` : '';
});
const vibeOverflowButtonAriaLabel = computed(() =>
  isVibeFilterExpanded.value
    ? 'Show fewer vibes'
    : `Show ${hiddenVibeCount.value} more ${hiddenVibeCount.value === 1 ? 'vibe' : 'vibes'}`,
);
const vibeFilterMetaCopy = computed(() => {
  const vibeCount = availableExploreVibes.value.length;
  if (!vibeCount) {
    return 'No vibes for this view';
  }

  if (selectedCityOption.value) {
    return `${vibeCount} ${vibeCount === 1 ? 'vibe' : 'vibes'} in ${selectedCityOption.value.label}`;
  }

  if (selectedRegion.value) {
    return `${vibeCount} ${vibeCount === 1 ? 'vibe' : 'vibes'} in ${formatRegionLabel(selectedRegion.value)}`;
  }

  if (selectedCountry.value) {
    return `${vibeCount} ${vibeCount === 1 ? 'vibe' : 'vibes'} in ${selectedCountry.value}`;
  }

  return `${vibeCount} ${vibeCount === 1 ? 'vibe' : 'vibes'} available`;
});
const visibleCountryOptions = computed(() => {
  if (isCountryFilterExpanded.value) {
    return availableCountryOptions.value;
  }

  const visibleCountries = availableCountryOptions.value.slice(0, MAX_VISIBLE_COUNTRY_FILTERS);
  const selectedOption = availableCountryOptions.value.find((country) => country.value === selectedCountry.value);
  if (selectedOption && !visibleCountries.some((country) => country.value === selectedOption.value)) {
    return [selectedOption, ...visibleCountries.slice(0, MAX_VISIBLE_COUNTRY_FILTERS - 1)];
  }

  return visibleCountries;
});
const hiddenCountryCount = computed(() =>
  Math.max(0, availableCountryOptions.value.length - new Set(visibleCountryOptions.value.map((country) => country.value)).size),
);
const countryOverflowButtonLabel = computed(() => {
  if (isCountryFilterExpanded.value && availableCountryOptions.value.length > MAX_VISIBLE_COUNTRY_FILTERS) {
    return 'Show fewer';
  }

  return hiddenCountryCount.value ? `+${hiddenCountryCount.value} more` : '';
});
const countryOverflowButtonAriaLabel = computed(() =>
  isCountryFilterExpanded.value
    ? 'Show fewer countries'
    : `Show ${hiddenCountryCount.value} more ${hiddenCountryCount.value === 1 ? 'country' : 'countries'}`,
);
const filteredExploreCityOptions = computed(() =>
  selectedCountry.value
    ? availableCityFilterOptions.value.filter((city) => (
      city.country === selectedCountry.value &&
      (!selectedRegion.value || city.region === selectedRegion.value)
    ))
    : availableCityFilterOptions.value,
);
const selectedCityOption = computed(() =>
  availableCityFilterOptions.value.find((city) => city.key === selectedCityKey.value) ?? null,
);
const visibleExploreCityOptions = computed(() => {
  if (isCityFilterExpanded.value) {
    return filteredExploreCityOptions.value;
  }

  const visibleCities = filteredExploreCityOptions.value.slice(0, MAX_VISIBLE_CITY_FILTERS);
  const selectedCity = selectedCityOption.value;
  if (selectedCity && filteredExploreCityOptions.value.some((city) => city.key === selectedCity.key) && !visibleCities.some((city) => city.key === selectedCity.key)) {
    return [selectedCity, ...visibleCities.slice(0, MAX_VISIBLE_CITY_FILTERS - 1)];
  }

  return visibleCities;
});
const hiddenCityCount = computed(() =>
  Math.max(0, filteredExploreCityOptions.value.length - new Set(visibleExploreCityOptions.value.map((city) => city.key)).size),
);
const cityOverflowButtonLabel = computed(() => {
  if (isCityFilterExpanded.value && filteredExploreCityOptions.value.length > MAX_VISIBLE_CITY_FILTERS) {
    return 'Show fewer';
  }

  return hiddenCityCount.value ? `+${hiddenCityCount.value} more` : '';
});
const cityOverflowButtonAriaLabel = computed(() =>
  isCityFilterExpanded.value
    ? 'Show fewer cities'
    : `Show ${hiddenCityCount.value} more ${hiddenCityCount.value === 1 ? 'city' : 'cities'}`,
);
const selectedCountryLabel = computed(() => selectedCountry.value || 'all countries');
const availableRegionOptions = computed<RegionFilterOption[]>(() => {
  if (!selectedCountry.value) {
    return [];
  }

  const regions = new Map<string, RegionFilterOption>();
  availableCityFilterOptions.value
    .filter((city) => (
      city.country === selectedCountry.value &&
      city.region &&
      city.region !== city.country &&
      city.region !== 'Global'
    ))
    .forEach((city) => {
      const existing = regions.get(city.region);
      if (existing) {
        existing.count += 1;
        return;
      }

      regions.set(city.region, {
        value: city.region,
        label: formatRegionLabel(city.region),
        count: 1,
      });
    });

  return [...regions.values()].sort((left, right) => left.label.localeCompare(right.label));
});
const hasRegionFilterOptions = computed(() => Boolean(selectedCountry.value && availableRegionOptions.value.length));
const regionFilterTitle = computed(() => (selectedCountry.value === 'USA' ? 'States' : 'Regions'));
const regionFilterControlLabel = 'Filter type';
const regionFilterAllLabel = computed(() => `All ${regionFilterTitle.value.toLowerCase()}`);
const selectedRegionFilterLabel = computed(() => {
  if (!selectedRegion.value) {
    return regionFilterAllLabel.value;
  }

  return availableRegionOptions.value.find((region) => region.value === selectedRegion.value)?.label ?? regionFilterAllLabel.value;
});
const selectedCountryCityCount = computed(() =>
  selectedCountry.value
    ? availableCityFilterOptions.value.filter((city) => city.country === selectedCountry.value).length
    : availableCityFilterOptions.value.length,
);
function formatAvailableCityCount(count: number): string {
  return `${count} ${count === 1 ? 'city' : 'cities'} available`;
}

const regionFilterAllMetaLabel = computed(() => formatAvailableCityCount(selectedCountryCityCount.value));

function formatRegionOptionMeta(region: RegionFilterOption): string {
  return formatAvailableCityCount(region.count);
}
const cityFilterScopeCopy = computed(() => {
  if (selectedRegion.value) {
    return `in ${formatRegionLabel(selectedRegion.value)}`;
  }

  return selectedCountry.value ? `in ${selectedCountryLabel.value}` : 'across all countries';
});
const locationFilterTitle = 'Cities';
const cityFilterMetaCopy = computed(() => {
  if (!availableCityFilterOptions.value.length) {
    return 'No cities yet';
  }

  const cityCount = filteredExploreCityOptions.value.length;
  if (selectedRegion.value) {
    return `${cityCount} ${cityCount === 1 ? 'city' : 'cities'} in ${formatRegionLabel(selectedRegion.value)}`;
  }

  return selectedCountry.value
    ? `${cityCount} ${cityCount === 1 ? 'city' : 'cities'} in ${selectedCountryLabel.value}`
    : `${cityCount} ${cityCount === 1 ? 'city' : 'cities'} across all countries`;
});

const filteredSpots = computed(() =>
  baseSpots.value.filter((spot) => {
    return (
      matchesActiveCategoryFilter(spot) &&
      matchesSelectedCountry(spot) &&
      matchesSelectedRegion(spot) &&
      matchesSelectedCity(spot) &&
      matchesActiveVibeFilter(spot) &&
      matchesSearch(spot, searchQuery.value)
    );
  }),
);

const hasElasticSearchResults = computed(() => Boolean(searchQuery.value.trim() && searchStore.results?.results.length));

const rankedExploreSpots = computed<DisplaySpot[]>(() => {
  if (hasElasticSearchResults.value && searchStore.results) {
    return searchStore.results.results.map(mapSearchResultToSpot);
  }

  const sortedSpots = sortExploreSpotsForMode(filteredSpots.value, exploreSortMode.value);

  return isScopeQaExploreMode ? sortedSpots.slice(0, EXPLORE_AUDIT_RESULT_LIMIT) : sortedSpots;
});

const totalExplorePages = computed(() => Math.max(1, Math.ceil(rankedExploreSpots.value.length / EXPLORE_GRID_PAGE_SIZE)));
const explorePageStartIndex = computed(() => (exploreCurrentPage.value - 1) * EXPLORE_GRID_PAGE_SIZE);
const explorePageEndIndex = computed(() => explorePageStartIndex.value + EXPLORE_GRID_PAGE_SIZE);

const displayedSpots = computed<DisplaySpot[]>(() => {
  if (isScopeQaExploreMode) {
    return rankedExploreSpots.value;
  }

  return rankedExploreSpots.value.slice(explorePageStartIndex.value, explorePageEndIndex.value);
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

  return rankedExploreSpots.value.length;
});

const showExplorePagination = computed(() =>
  !isScopeQaExploreMode &&
  !showResultsSkeleton.value &&
  rankedExploreSpots.value.length > EXPLORE_GRID_PAGE_SIZE,
);

const explorePaginationStatus = computed(() => {
  const totalResults = rankedExploreSpots.value.length;
  if (!totalResults) {
    return 'Page 1 of 1';
  }

  const start = Math.min(totalResults, explorePageStartIndex.value + 1);
  const end = Math.min(totalResults, explorePageEndIndex.value);
  return `${start}-${end} of ${totalResults} - Page ${exploreCurrentPage.value} of ${totalExplorePages.value}`;
});

const exploreGridRankDescription = computed(() => (
  exploreSortMode.value === 'popular'
    ? 'Sorted by saves and rating, with nine spots per page for cleaner browsing.'
    : 'Ranked by community saves, rating, and freshness, with nine spots per page for cleaner browsing.'
));

const showExploreSearchRecommendations = computed(() => {
  if (isScopeQaExploreMode) {
    return false;
  }

  const hasRecommendationState = (
    exploreSearchRecommendationsLoading.value ||
    Boolean(exploreSearchRecommendationsError.value) ||
    Boolean(exploreSearchRecommendations.value.length)
  );

  if (!hasRecommendationState) {
    return false;
  }

  if (!searchQuery.value.trim()) {
    return hasFocusedExploreSearch.value;
  }

  return !searchStore.loading && displayedSpots.value.length === 0;
});

const exploreSearchRecommendationTitle = computed(() =>
  searchQuery.value.trim() ? 'Recommended instead' : 'Recommended places',
);

const activeFilterPills = computed(() => {
  const pills: string[] = [];

  if (!allCategoriesSelected.value) {
    pills.push(...activeExploreCategories.value.map(formatCategory));
  }

  if (selectedCityOption.value) {
    pills.push(selectedCityOption.value.label);
  } else if (selectedCountry.value) {
    pills.push(selectedCountry.value);
  }

  if (selectedRegion.value && !selectedCityOption.value) {
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
  (isFetchingInitialResults.value && !baseSpots.value.length) || (searchStore.loading && !baseSpots.value.length),
);
const emptyStateTitle = computed(() => (hasActiveFilters.value ? 'No spots match the current filters' : 'No community spots yet'));
const emptyStateDescription = computed(() =>
  hasActiveFilters.value
    ? 'Try clearing one of the active chips or broadening the search query to surface more places.'
    : 'Scope will surface community-loved places here once the first pins sync into explore.',
);

watch(selectedCountry, (country) => {
  if (!country || !selectedCityOption.value) {
    return;
  }

  if (!filteredExploreCityOptions.value.some((city) => city.key === selectedCityOption.value?.key)) {
    selectedCityKey.value = '';
  }
});

watch(availableCityFilterOptions, (options) => {
  if (selectedCityKey.value && !options.some((option) => option.key === selectedCityKey.value)) {
    selectedCityKey.value = '';
  }

  if (selectedCountry.value && !availableCountryOptions.value.some((country) => country.value === selectedCountry.value)) {
    selectedCountry.value = '';
    selectedRegion.value = '';
    isCountryFilterExpanded.value = false;
  }
});

watch(availableRegionOptions, (regions) => {
  if (!regions.length) {
    closeRegionFilter();
  }

  if (selectedRegion.value && !regions.some((region) => region.value === selectedRegion.value)) {
    selectedRegion.value = '';
    selectedCityKey.value = '';
    closeRegionFilter();
  }
});

watch(availableExploreVibes, (vibes) => {
  if (selectedVibe.value && !vibes.includes(selectedVibe.value)) {
    selectedVibe.value = '';
  }
});

watch(
  () => [
    searchQuery.value.trim(),
    activeExploreCategories.value.join('|'),
    selectedCountry.value,
    selectedRegion.value,
    selectedCityKey.value,
    selectedVibe.value,
    exploreSortMode.value,
  ] as const,
  () => {
    exploreCurrentPage.value = 1;
  },
);

watch(totalExplorePages, (pageCount) => {
  if (exploreCurrentPage.value > pageCount) {
    exploreCurrentPage.value = pageCount;
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
      pageSize: isScopeQaExploreMode ? EXPLORE_AUDIT_RESULT_LIMIT : EXPLORE_DISCOVERY_BATCH_SIZE,
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
      void searchStore.search(query, 'spots', EXPLORE_SEARCH_RESULT_LIMIT, 0);
      searchDebounceTimer = null;
    }, 300);
  },
  { immediate: true },
);

watch(
  () => [
    authStore.isAuthenticated,
    authStore.currentUser?.id ?? '',
    authStore.currentUser?.interests?.join('|') ?? '',
  ] as const,
  () => {
    exploreSearchRecommendationRequestId += 1;
    exploreSearchRecommendations.value = [];
    exploreSearchRecommendationsLoading.value = false;
    exploreSearchRecommendationsError.value = null;

    if (hasFocusedExploreSearch.value) {
      void loadExploreSearchRecommendations({ force: true });
    }
  },
);

defineExpose(import.meta.env.MODE === 'test'
  ? {
      __coverage: {
        activeFilterPills,
        activeExploreCategories,
        allCategoriesSelected,
        availableCityFilterOptions,
        availableCountryOptions,
        availableExploreVibes,
        availableRegionOptions,
        baseSpots,
        buildCityFilterKey,
        cityFilterMetaCopy,
        cityFilterScopeCopy,
        cityOverflowButtonAriaLabel,
        cityOverflowButtonLabel,
        clearFilters,
        clearLocationFilters,
        closeRegionFilter,
        countryOverflowButtonAriaLabel,
        countryOverflowButtonLabel,
        displayedResultCount,
        displayedSpots,
        emptyStateDescription,
        emptyStateTitle,
        escapeHtml,
        exploreGridRankDescription,
        explorePaginationStatus,
        exploreSearchRecommendationTitle,
        exploreSearchRecommendations,
        exploreSearchRecommendationsError,
        exploreSearchRecommendationsLoading,
        exploreSortMode,
        filteredExploreCityOptions,
        filteredSpots,
        formatAvailableCityCount,
        formatCategory,
        formatCityOptionLabel,
        formatLocation,
        formatRecommendationMeta,
        formatRegionLabel,
        formatRegionOptionMeta,
        formatSearchHighlight,
        formatTrendingSignal,
        getSpotCreatedTime,
        goToExplorePage,
        handleDocumentClick,
        handleExploreSearchFocus,
        hasActiveFilters,
        hasElasticSearchResults,
        hasFocusedExploreSearch,
        hasRegionFilterOptions,
        hiddenCityCount,
        hiddenCountryCount,
        isCategorySelected,
        isCityFilterExpanded,
        isCountryFilterExpanded,
        isFetchingInitialResults,
        isMobileExploreLayout,
        isRegionFilterOpen,
        isSpotCategory,
        isVibeFilterExpanded,
        loadExploreSearchRecommendations,
        mapSearchResultToSpot,
        matchesActiveCategoryFilter,
        matchesActiveVibeFilter,
        matchesSearch,
        matchesSelectedCity,
        matchesSelectedCountry,
        matchesSelectedRegion,
        openExploreRecommendation,
        rankPopularSpots,
        rankedExploreSpots,
        regionFilterAllLabel,
        regionFilterAllMetaLabel,
        regionFilterControlRef,
        regionFilterTitle,
        resolveExplorePhoto,
        resolveExplorePhotoFallback,
        resolveIsMobileExploreLayout,
        resolveSearchSnippet,
        resolveSpotCountry,
        resolveSpotRegion,
        resolveSpotVibes,
        searchQuery,
        selectAllCategories,
        selectCountry,
        selectedCityKey,
        selectedCityOption,
        selectedCountry,
        selectedCountryCityCount,
        selectedCountryLabel,
        selectedRegion,
        selectedRegionFilterLabel,
        selectedVibe,
        showExplorePagination,
        showExploreSearchRecommendations,
        showResultsSkeleton,
        sortExploreSpotsForMode,
        syncMobileExploreLayout,
        toggleCategory,
        toggleCity,
        toggleCityFilterExpanded,
        toggleCountryFilterExpanded,
        toggleRegionFilterOpen,
        toggleVibeFilterExpanded,
        totalExplorePages,
        trendingSpots,
        visibleCountryOptions,
        visibleExploreCityOptions,
        visibleExploreVibes,
        vibeFilterMetaCopy,
        vibeOverflowButtonAriaLabel,
        vibeOverflowButtonLabel,
      },
    }
  : {});

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
  document.addEventListener('click', handleDocumentClick);

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
  document.removeEventListener('click', handleDocumentClick);
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

.region-filter-control {
  position: relative;
  flex: 0 1 auto;
  min-width: 11rem;
}

.region-filter-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: 2.7rem;
  padding: 0.55rem 2.5rem 0.55rem 0.95rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 24%, var(--glass-border));
  border-radius: var(--radius-full);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--glass-bg) 96%, transparent), color-mix(in srgb, var(--bg-secondary) 90%, transparent));
  color: var(--text-secondary);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 5%, transparent);
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.region-filter-button__label {
  flex: 0 0 auto;
  color: color-mix(in srgb, var(--accent-teal) 82%, var(--text-primary) 18%);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
}

.region-filter-button__value {
  min-width: 0;
  flex: 1 1 auto;
  color: var(--text-primary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.region-filter-button:hover,
.region-filter-button:focus-visible,
.region-filter-control.is-open .region-filter-button {
  border-color: color-mix(in srgb, var(--accent-teal) 48%, var(--border-hover));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent-teal) 10%, var(--glass-bg)), color-mix(in srgb, var(--bg-secondary) 92%, transparent));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 7%, transparent),
    0 0 0 3px color-mix(in srgb, var(--accent-teal) 9%, transparent);
  outline: none;
}

.region-filter-button :deep(.scope-icon) {
  position: absolute;
  right: 0.8rem;
  width: 1rem;
  height: 1rem;
  color: currentColor;
  opacity: 0.8;
  pointer-events: none;
  transition: transform var(--transition-fast);
}

.region-filter-control.is-open .region-filter-button :deep(.scope-icon) {
  transform: rotate(180deg);
}

.region-filter-menu {
  position: absolute;
  top: calc(100% + 0.45rem);
  right: 0;
  z-index: 40;
  display: grid;
  gap: var(--space-1);
  width: max(100%, 15rem);
  max-height: min(18rem, 52vh);
  padding: var(--space-2);
  overflow-y: auto;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 28%, var(--glass-border));
  border-radius: var(--radius-lg);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-elevated) 94%, var(--bg-secondary)), color-mix(in srgb, var(--bg-secondary) 94%, var(--bg-primary))),
    var(--bg-secondary);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 8%, transparent),
    0 18px 38px color-mix(in srgb, var(--bg-primary) 58%, transparent);
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--accent-teal) 34%, transparent) transparent;
}

.region-filter-menu::-webkit-scrollbar {
  width: 0.45rem;
}

.region-filter-menu::-webkit-scrollbar-thumb {
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 34%, transparent);
}

.region-filter-option {
  display: grid;
  gap: 0.15rem;
  width: 100%;
  min-width: 0;
  padding: 0.65rem 0.75rem;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font: inherit;
  line-height: 1.2;
  text-align: left;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.region-filter-option span,
.region-filter-option small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.region-filter-option span {
  color: var(--text-primary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.region-filter-option small {
  color: var(--text-muted);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}

.region-filter-option:hover,
.region-filter-option:focus-visible,
.region-filter-option.active {
  border-color: color-mix(in srgb, var(--accent-teal) 28%, transparent);
  background: color-mix(in srgb, var(--accent-teal) 12%, var(--bg-secondary));
  color: var(--text-primary);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 6%, transparent);
  outline: none;
}

.region-filter-option.active small {
  color: color-mix(in srgb, var(--accent-teal) 76%, var(--text-secondary));
}

.quick-filter-section {
  display: grid;
  gap: var(--space-3);
  padding-top: var(--space-4);
  margin-top: var(--space-4);
  border-top: 1px solid color-mix(in srgb, var(--glass-border) 72%, transparent);
}

.quick-filter-section__label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-width: 0;
  color: color-mix(in srgb, var(--text-secondary) 82%, var(--text-primary) 18%);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.02em;
}

.quick-filter-section__label small {
  color: var(--text-muted);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.quick-filter-row--countries {
  padding-bottom: var(--space-3);
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

.quick-filter-chip--empty {
  cursor: default;
  border-style: dashed;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--bg-secondary) 62%, transparent);
}

.quick-filter-chip--more {
  border: 1px dashed color-mix(in srgb, var(--text-secondary) 42%, var(--glass-border));
  box-shadow: none;
  color: color-mix(in srgb, var(--text-secondary) 82%, var(--accent-teal));
  font-weight: var(--font-weight-semibold);
}

.quick-filter-chip--more:hover,
.quick-filter-chip--more:focus-visible {
  border-color: color-mix(in srgb, var(--accent-teal) 54%, var(--glass-border));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-teal) 9%, transparent);
  color: var(--text-primary);
  background: color-mix(in srgb, var(--accent-teal) 10%, var(--bg-secondary));
}

.quick-filter-chip--empty:hover,
.quick-filter-chip--empty:focus-visible,
.quick-filter-chip--empty:active {
  color: var(--text-muted);
  background: color-mix(in srgb, var(--bg-secondary) 62%, transparent);
  box-shadow: none;
  transform: none;
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

.search-recommendations {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 22%, var(--glass-border));
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--bg-secondary) 72%, transparent);
}

.search-recommendations__header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--space-4);
  min-width: 0;
}

.search-recommendations__header h2 {
  margin: 0;
  font-size: var(--font-size-h3);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0;
}

.search-recommendations__header span,
.search-recommendations__state,
.search-recommendation span {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.search-recommendations__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
}

.search-recommendation {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
  min-height: 7.25rem;
  padding: var(--space-4);
  border: 1px solid color-mix(in srgb, var(--glass-border) 88%, transparent);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-primary) 44%, transparent);
  color: var(--text-primary);
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.search-recommendation:hover,
.search-recommendation:focus-visible {
  border-color: color-mix(in srgb, var(--accent-teal) 42%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 9%, var(--bg-secondary));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-teal) 9%, transparent);
  outline: none;
  transform: translateY(var(--motion-button-lift));
}

.search-recommendation strong,
.search-recommendation span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-recommendation strong {
  color: var(--text-primary);
  font-size: 1rem;
  line-height: var(--line-height-tight);
  white-space: nowrap;
}

.search-recommendation span:not(.search-recommendation__rank) {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-height: var(--line-height-normal);
}

.search-recommendation__rank {
  justify-self: start;
  max-width: 100%;
  padding: 0.28rem 0.55rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 24%, var(--border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 10%, transparent);
  color: var(--accent-teal);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.search-recommendations__state {
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-primary) 42%, transparent);
}

.search-recommendations__state--error {
  color: var(--danger);
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

.explore-pagination {
  display: inline-flex;
  align-items: center;
  justify-self: stretch;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
  max-width: 100%;
  padding: 0.45rem;
  border-radius: calc(var(--radius-xl) + 0.15rem);
  border: 1px solid color-mix(in srgb, var(--glass-border) 78%, transparent);
  background: color-mix(in srgb, var(--bg-tertiary) 72%, transparent);
}

.explore-pagination__button {
  display: inline-grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 28%, var(--glass-border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 11%, transparent);
  color: var(--accent-teal);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-fast);
}

.explore-pagination__button:hover,
.explore-pagination__button:focus-visible {
  outline: none;
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent-teal) 54%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 18%, transparent);
}

.explore-pagination__button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
  transform: none;
}

.explore-pagination__button :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
}

.explore-pagination__status {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-normal);
  text-align: center;
}

.explore-empty-state {
  min-height: clamp(16rem, 28vw, 24rem);
  display: grid;
  align-content: center;
  justify-items: center;
  gap: var(--space-3);
  padding: clamp(var(--space-5), 4vw, var(--space-8));
  text-align: center;
}

.explore-empty-state--trending {
  min-height: 18rem;
  padding: var(--space-4) var(--space-2);
}

.explore-empty-state h3,
.explore-empty-state p {
  margin: 0;
}

.explore-empty-state h3 {
  max-width: 27rem;
  color: var(--text-primary);
  font-size: clamp(1.2rem, 1.8vw, 1.6rem);
  line-height: var(--line-height-tight);
  letter-spacing: 0;
}

.explore-empty-state p:not(.eyebrow) {
  max-width: 34rem;
  color: var(--text-secondary);
  line-height: var(--line-height-relaxed);
}

.explore-empty-state .button {
  margin-top: var(--space-2);
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

  .search-recommendations__grid {
    grid-template-columns: 1fr;
  }

  .discovery-shell__header,
  .discovery-shell__toolbar,
  .discovery-shell__footer,
  .search-recommendations__header,
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

  .explore-pagination {
    width: 100%;
    justify-self: stretch;
  }

  .explore-pagination__status {
    flex: 1;
    min-width: 0;
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
    .search-recommendation,
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
    .search-recommendation:hover,
    .search-recommendation:focus-visible,
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
