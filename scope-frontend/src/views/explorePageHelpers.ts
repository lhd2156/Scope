import type { SearchResult } from '@/services/searchService';
import type { SpotCategory, SpotSummary } from '@/types';
import {
  formatCityRegionLocation,
  formatCountryLabel,
  formatLocationRegionLabel,
  resolveCityRegionLocation,
  resolveLocationRegion,
} from '@/utils/formatters';
import { rankTrendingSpots } from '@/utils/spotRanking';

export type DisplaySpot = SpotSummary & { searchSnippet?: string };
export type ExploreSortMode = 'community' | 'trending' | 'popular';

export interface CountryOption {
  value: string;
  count: number;
  label: string;
}

export interface CityFilterOption {
  key: string;
  city: string;
  region: string;
  country: string;
  label: string;
  count: number;
}

export interface RegionFilterOption {
  value: string;
  label: string;
  count: number;
}

export interface ExplorePageRange {
  startIndex: number;
  endIndex: number;
}

const LOCATION_SCOPE_SEPARATOR = '::';

export function resolveSpotRegion(spot: SpotSummary): string {
  return resolveLocationRegion(spot, { allowCountryFallback: true }) || 'Global';
}

export function resolveSpotCountry(spot: SpotSummary): string {
  return resolveCityRegionLocation(spot)?.country || formatCountryLabel(spot.country) || 'Global';
}

export function buildCityFilterKey(city: string, region: string, country: string): string {
  return `${country}${LOCATION_SCOPE_SEPARATOR}${region}${LOCATION_SCOPE_SEPARATOR}${city}`;
}

export function formatRegionLabel(region: string): string {
  return formatLocationRegionLabel(region);
}

export function formatCityOptionLabel(city: string, region: string): string {
  return region ? `${city}, ${formatRegionLabel(region)}` : city;
}

export function formatCategory(category: SpotCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function formatLocation(spot: SpotSummary): string {
  return formatCityRegionLocation(spot, 'Location syncing');
}

export function formatTrendingSignal(spot: SpotSummary): string {
  const likesCount = spot.likesCount ?? 0;

  return likesCount > 0 ? `${likesCount} community saves` : `${formatCategory(spot.category)} pick`;
}

export function getSpotCreatedTime(spot: SpotSummary): number {
  const timestamp = Date.parse(spot.createdAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function rankPopularSpots<TSpot extends SpotSummary>(spots: TSpot[]): TSpot[] {
  return [...spots].sort((left, right) => (
    (right.likesCount ?? 0) - (left.likesCount ?? 0) ||
    right.rating - left.rating ||
    getSpotCreatedTime(right) - getSpotCreatedTime(left) ||
    left.title.localeCompare(right.title) ||
    left.id.localeCompare(right.id)
  ));
}

export function sortExploreSpotsForMode(spots: DisplaySpot[], sortMode: ExploreSortMode): DisplaySpot[] {
  if (sortMode === 'popular') {
    return rankPopularSpots(spots);
  }

  // The community mode currently shares the trending ranker until backend signals replace it.
  return rankTrendingSpots(spots) as DisplaySpot[];
}

export function isSpotCategory(value: string | undefined, categories: readonly SpotCategory[]): value is SpotCategory {
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

export function formatSearchHighlight(value: string): string {
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

export function resolveSearchSnippet(result: SearchResult): string | undefined {
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

export function mapSearchResultToSpot(result: SearchResult, categories: readonly SpotCategory[]): DisplaySpot {
  const spot: DisplaySpot = {
    id: result.id,
    title: result.name,
    description: result.description ?? '',
    latitude: result.location?.lat ?? 0,
    longitude: result.location?.lon ?? 0,
    city: result.city ?? '',
    country: result.country ?? '',
    category: isSpotCategory(result.category, categories) ? result.category : 'other',
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

export function resolveSpotVibes(spot: SpotSummary): string[] {
  const values = [spot.vibe, ...(spot.pillars ?? [])]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  return [...new Set(values)];
}

export function matchesSearch(spot: SpotSummary, query: string): boolean {
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

export function matchesActiveCategoryFilter(
  spot: SpotSummary,
  allCategoriesSelected: boolean,
  activeExploreCategories: readonly SpotCategory[],
): boolean {
  return allCategoriesSelected || activeExploreCategories.includes(spot.category);
}

export function matchesActiveVibeFilter(spot: SpotSummary, selectedVibe: string): boolean {
  return !selectedVibe || resolveSpotVibes(spot).includes(selectedVibe);
}

export function matchesSelectedCountry(spot: SpotSummary, selectedCountry: string): boolean {
  if (!selectedCountry) {
    return true;
  }

  return resolveSpotCountry(spot) === selectedCountry;
}

export function matchesSelectedCity(spot: SpotSummary, selectedCityOption: CityFilterOption | null): boolean {
  if (!selectedCityOption) {
    return true;
  }

  const spotLocation = resolveCityRegionLocation(spot);
  const locationRegion = spotLocation?.region || resolveSpotRegion(spot);
  const country = spotLocation?.country || resolveSpotCountry(spot);

  return (
    spotLocation?.city === selectedCityOption.city &&
    locationRegion === selectedCityOption.region &&
    country === selectedCityOption.country
  );
}

export function matchesSelectedRegion(spot: SpotSummary, selectedCountry: string, selectedRegion: string): boolean {
  if (!selectedRegion) {
    return true;
  }

  const spotLocation = resolveCityRegionLocation(spot);
  const locationRegion = spotLocation?.region || resolveSpotRegion(spot);
  const country = spotLocation?.country || resolveSpotCountry(spot);

  return locationRegion === selectedRegion && (!selectedCountry || country === selectedCountry);
}

export function deriveCityFilterOptions(spots: readonly SpotSummary[]): CityFilterOption[] {
  const cities = new Map<string, CityFilterOption>();

  for (const spot of spots) {
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
}

export function deriveCountryOptions(cityOptions: readonly CityFilterOption[]): CountryOption[] {
  const countries = new Map<string, number>();

  for (const option of cityOptions) {
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
}

export function deriveVibes(spots: readonly SpotSummary[]): string[] {
  return [...new Set(spots.flatMap((spot) => resolveSpotVibes(spot)))].sort((left, right) =>
    left.localeCompare(right),
  );
}

export function getVisibleExploreVibes(
  availableExploreVibes: readonly string[],
  selectedVibe: string,
  isVibeFilterExpanded: boolean,
  maxVisibleVibeFilters: number,
): string[] {
  if (isVibeFilterExpanded) {
    return [...availableExploreVibes];
  }

  const visibleVibes = availableExploreVibes.slice(0, maxVisibleVibeFilters);
  if (selectedVibe && availableExploreVibes.includes(selectedVibe) && !visibleVibes.includes(selectedVibe)) {
    return [selectedVibe, ...visibleVibes.slice(0, maxVisibleVibeFilters - 1)];
  }

  return visibleVibes;
}

export function getHiddenOptionCount(totalOptionCount: number, visibleUniqueOptionCount: number): number {
  return Math.max(0, totalOptionCount - visibleUniqueOptionCount);
}

export function getVisibleCountryOptions(
  availableCountryOptions: readonly CountryOption[],
  selectedCountry: string,
  isCountryFilterExpanded: boolean,
  maxVisibleCountryFilters: number,
): CountryOption[] {
  if (isCountryFilterExpanded) {
    return [...availableCountryOptions];
  }

  const visibleCountries = availableCountryOptions.slice(0, maxVisibleCountryFilters);
  const selectedOption = availableCountryOptions.find((country) => country.value === selectedCountry);
  if (selectedOption && !visibleCountries.some((country) => country.value === selectedOption.value)) {
    return [selectedOption, ...visibleCountries.slice(0, maxVisibleCountryFilters - 1)];
  }

  return visibleCountries;
}

export function filterCityOptionsByScope(
  cityOptions: readonly CityFilterOption[],
  selectedCountry: string,
  selectedRegion: string,
): CityFilterOption[] {
  return selectedCountry
    ? cityOptions.filter((city) => (
      city.country === selectedCountry &&
      (!selectedRegion || city.region === selectedRegion)
    ))
    : [...cityOptions];
}

export function getVisibleCityOptions(
  filteredCityOptions: readonly CityFilterOption[],
  selectedCity: CityFilterOption | null,
  isCityFilterExpanded: boolean,
  maxVisibleCityFilters: number,
): CityFilterOption[] {
  if (isCityFilterExpanded) {
    return [...filteredCityOptions];
  }

  const visibleCities = filteredCityOptions.slice(0, maxVisibleCityFilters);
  if (
    selectedCity &&
    filteredCityOptions.some((city) => city.key === selectedCity.key) &&
    !visibleCities.some((city) => city.key === selectedCity.key)
  ) {
    return [selectedCity, ...visibleCities.slice(0, maxVisibleCityFilters - 1)];
  }

  return visibleCities;
}

export function deriveRegionOptions(
  cityOptions: readonly CityFilterOption[],
  selectedCountry: string,
): RegionFilterOption[] {
  if (!selectedCountry) {
    return [];
  }

  const regions = new Map<string, RegionFilterOption>();
  cityOptions
    .filter((city) => (
      city.country === selectedCountry &&
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
}

export function formatAvailableCityCount(count: number): string {
  return `${count} ${count === 1 ? 'city' : 'cities'} available`;
}

export function getTotalExplorePages(totalResults: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalResults / pageSize));
}

export function getExplorePageRange(currentPage: number, pageSize: number): ExplorePageRange {
  const startIndex = (currentPage - 1) * pageSize;
  return {
    startIndex,
    endIndex: startIndex + pageSize,
  };
}

export function clampExplorePage(page: number, totalPages: number): number {
  return Math.min(Math.max(1, page), totalPages);
}

export function formatExplorePaginationStatus(
  totalResults: number,
  startIndex: number,
  endIndex: number,
  currentPage: number,
  totalPages: number,
): string {
  if (!totalResults) {
    return 'Page 1 of 1';
  }

  const start = Math.min(totalResults, startIndex + 1);
  const end = Math.min(totalResults, endIndex);
  return `${start}-${end} of ${totalResults} - Page ${currentPage} of ${totalPages}`;
}

export function shouldShowExplorePagination(
  isScopeQaExploreMode: boolean,
  showResultsSkeleton: boolean,
  resultCount: number,
  pageSize: number,
): boolean {
  return !isScopeQaExploreMode && !showResultsSkeleton && resultCount > pageSize;
}
