<template>
  <header
    class="navbar"
    :class="{
      'navbar--scrolled': isScrolled,
      'navbar--mobile-open': isMobileMenuOpen,
      'navbar--notifications-open': isNotificationMenuOpen,
    }"
  >
    <div class="navbar__inner">
      <div class="navbar__leading">
        <RouterLink to="/" class="brand" @click="closeMobileMenu()">
          <span class="brand__mark" aria-hidden="true">
            <ScopeIcon name="logo" />
          </span>
          <span class="brand__text">Scope Trips</span>
        </RouterLink>

        <nav class="nav-links" aria-label="Primary">
          <RouterLink to="/">Home</RouterLink>
          <RouterLink to="/explore">Explore</RouterLink>
          <RouterLink to="/map">Map</RouterLink>

          <div v-if="authStore.isAuthenticated" ref="featureMenuRef" class="feature-menu-shell" @focusout="handleFeatureMenuFocusOut">
            <button
              :id="featureMenuButtonId"
              ref="featureMenuButtonRef"
              type="button"
              class="feature-menu-button"
              aria-haspopup="menu"
              :aria-expanded="String(isFeatureMenuOpen)"
              :aria-controls="isFeatureMenuOpen ? featureMenuId : undefined"
              @click="toggleFeatureMenu"
              @keydown="handleFeatureMenuButtonKeydown"
            >
              <span>More</span>
              <ScopeIcon name="chevron-down" label="" />
            </button>

            <Transition name="dropdown-fade">
              <div
                v-if="isFeatureMenuOpen"
                :id="featureMenuId"
                ref="featureMenuPanelRef"
                class="feature-menu-dropdown glass-panel"
                role="menu"
                :aria-labelledby="featureMenuButtonId"
                tabindex="-1"
                @keydown="handleFeatureMenuKeydown"
              >
                <RouterLink
                  v-for="link in featureLinks"
                  :key="link.to"
                  :to="link.to"
                  role="menuitem"
                  tabindex="-1"
                  @click="closeFeatureMenu()"
                >
                  <ScopeIcon :name="link.icon" :label="link.label" />
                  <span>{{ link.label }}</span>
                </RouterLink>
              </div>
            </Transition>
          </div>
        </nav>
      </div>

      <div class="actions">
        <div
          ref="quickSearchRef"
          class="quick-search-shell quick-search-shell--desktop"
          @focusin="handleQuickSearchFocus"
          @keydown.esc="closeQuickSearch"
        >
          <SearchBar
            v-model="searchQuery"
            class="navbar-search"
            compact
            label="Search Scope Trips"
            placeholder="Search cities, vibes, and spots"
            @search="handleSearch"
          />

          <Transition name="dropdown-fade">
            <div
              v-if="showQuickSearchPanel"
              class="quick-search-dropdown glass-panel"
              data-test="quick-search-dropdown"
              role="region"
              aria-label="Quick search results"
            >
              <p class="quick-search-dropdown__eyebrow">{{ quickSearchPanelEyebrow }}</p>
              <div v-if="quickSearchLoading && hasQuickSearchQuery" class="quick-search-state" role="status" aria-live="polite">
                Searching Scope Trips...
              </div>
              <div v-else-if="quickSearchError" class="quick-search-state quick-search-state--error" role="alert">
                {{ quickSearchError }}
              </div>
              <div v-else-if="quickSearchPlaceResults.length" class="quick-search-results" role="list" aria-label="Search matches">
                <button
                  v-for="result in quickSearchPlaceResults"
                  :key="result.id"
                  type="button"
                  class="quick-search-result"
                  data-test="quick-search-result"
                  role="listitem"
                  @click="openQuickSearchResult(result)"
                >
                  <span v-if="result.photoUrl" class="quick-search-result__media" aria-hidden="true">
                    <img :src="result.photoUrl" alt="" data-test="quick-search-result-photo" />
                  </span>
                  <span v-else class="quick-search-result__icon" aria-hidden="true">
                    <ScopeIcon name="pin" />
                  </span>
                  <span class="quick-search-result__copy">
                    <strong>{{ result.title }}</strong>
                    <small>{{ formatQuickSearchResultMeta(result) }}</small>
                    <span v-if="result.description">{{ result.description }}</span>
                  </span>
                </button>
              </div>
              <div v-else-if="hasQuickSearchQuery" class="quick-search-state" role="status">
                No quick matches yet.
              </div>
              <section v-if="showQuickSearchRecommendations" class="quick-search-section" aria-labelledby="quick-search-recommendations-title">
                <div class="quick-search-section__header">
                  <strong id="quick-search-recommendations-title">{{ quickSearchRecommendationTitle }}</strong>
                  <span v-if="quickSearchRecommendationPlaces.length">{{ quickSearchRecommendationPlaces.length }} places</span>
                </div>
                <div v-if="quickSearchRecommendationsLoading" class="quick-search-state" role="status" aria-live="polite">
                  Loading recommended places...
                </div>
                <div v-else-if="quickSearchRecommendationsError" class="quick-search-state quick-search-state--error" role="alert">
                  {{ quickSearchRecommendationsError }}
                </div>
                <div v-else-if="quickSearchRecommendationPlaces.length" class="quick-search-results quick-search-results--recommendations" role="list">
                  <button
                    v-for="result in quickSearchRecommendationPlaces"
                    :key="`recommended-${result.id}`"
                    type="button"
                    class="quick-search-result"
                    data-test="quick-search-recommendation"
                    role="listitem"
                    @click="openQuickSearchResult(result)"
                  >
                    <span v-if="result.photoUrl" class="quick-search-result__media" aria-hidden="true">
                      <img :src="result.photoUrl" alt="" data-test="quick-search-recommendation-photo" />
                    </span>
                    <span v-else class="quick-search-result__icon" aria-hidden="true">
                      <ScopeIcon name="sparkle" />
                    </span>
                    <span class="quick-search-result__copy">
                      <strong>{{ result.title }}</strong>
                      <small>{{ formatQuickSearchResultMeta(result) }}</small>
                      <span>{{ result.recommendationReason || result.description || 'Strong signal from current Scope Trips places.' }}</span>
                    </span>
                  </button>
                </div>
              </section>
            </div>
          </Transition>
        </div>

        <RouterLink
          class="create-spot-link"
          :to="{ name: 'spot-create' }"
          aria-label="Create Spot"
          data-onboarding-target="create-spot-button"
          data-test="create-spot-link"
        >
          <span class="create-spot-link__icon-shell" aria-hidden="true">
            <ScopeIcon name="pin" />
          </span>
          <span class="create-spot-link__copy">
            <span>Create</span>
            <span class="create-spot-link__copy-extended">Spot</span>
          </span>
        </RouterLink>

        <NotificationDropdown v-if="authStore.isAuthenticated" @open-change="isNotificationMenuOpen = $event" />

        <ThemeToggle />

        <div v-if="authStore.currentUser" ref="menuRef" class="menu-shell" @focusout="handleMenuFocusOut">
          <button
            :id="menuButtonId"
            ref="menuButtonRef"
            type="button"
            class="profile-chip"
            aria-haspopup="menu"
            :aria-expanded="String(isMenuOpen)"
            :aria-controls="isMenuOpen ? menuId : undefined"
            @click="toggleMenu"
            @keydown="handleMenuButtonKeydown"
          >
            <span class="profile-chip__avatar-shell">
              <Avatar :name="authStore.currentUser.displayName" :src="authStore.currentUser.avatarUrl" :size="36" />
            </span>
            <span class="profile-chip__copy">
              <strong>{{ authStore.currentUser.displayName }}</strong>
              <small>{{ profileMetaLine }}</small>
            </span>
            <span class="profile-chip__chevron" aria-hidden="true">
              <ScopeIcon name="chevron-down" label="Open user menu" />
            </span>
          </button>

          <Transition name="dropdown-fade">
            <div
              v-if="isMenuOpen"
              :id="menuId"
              ref="menuPanelRef"
              class="menu-dropdown glass-panel"
              role="menu"
              :aria-labelledby="menuButtonId"
              tabindex="-1"
              @keydown="handleMenuKeydown"
            >
              <div class="menu-dropdown__profile" role="none">
                <Avatar :name="authStore.currentUser.displayName" :src="authStore.currentUser.avatarUrl" :size="48" />
                <div class="menu-dropdown__copy" role="none">
                  <p class="menu-dropdown__eyebrow">Signed in as</p>
                  <strong>{{ authStore.currentUser.displayName }}</strong>
                  <p>{{ profileMetaLine }}</p>
                </div>
              </div>

              <div class="menu-dropdown__divider" role="none" aria-hidden="true" />

              <div class="menu-dropdown__actions" role="none">
                <RouterLink :to="`/profile/${authStore.currentUser.id}`" role="menuitem" tabindex="-1" @click="closeMenu">
                  <ScopeIcon name="user" label="Profile" />
                  <span>Profile</span>
                </RouterLink>
                <RouterLink to="/settings" role="menuitem" tabindex="-1" @click="closeMenu">
                  <ScopeIcon name="settings" label="Settings" />
                  <span>Settings</span>
                </RouterLink>
                <button type="button" role="menuitem" tabindex="-1" @click="handleLogout">
                  <ScopeIcon name="logout" label="Log out" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          </Transition>
        </div>

        <div v-else class="guest-actions">
          <RouterLink class="ghost-link" to="/login">Log in</RouterLink>
          <RouterLink class="accent-link" to="/register">Create account</RouterLink>
        </div>
      </div>

      <button
        ref="mobileMenuButtonRef"
        type="button"
        class="navbar__mobile-toggle"
        data-test="mobile-menu-toggle"
        aria-haspopup="dialog"
        :aria-expanded="String(isMobileMenuOpen)"
        :aria-controls="isMobileMenuOpen ? mobileMenuId : undefined"
        :aria-label="isMobileMenuOpen ? 'Close navigation drawer' : 'Open navigation drawer'"
        @click="toggleMobileMenu"
      >
        <ScopeIcon :name="isMobileMenuOpen ? 'close' : 'menu'" :label="isMobileMenuOpen ? 'Close navigation drawer' : 'Open navigation drawer'" />
      </button>
    </div>
  </header>

  <Transition name="navbar-mobile-backdrop">
    <div
      v-if="isMobileMenuOpen"
      class="navbar__mobile-overlay"
      data-test="mobile-drawer-backdrop"
      @click.self="closeMobileMenu({ restoreFocus: true })"
    >
      <aside
        :id="mobileMenuId"
        ref="mobileDrawerRef"
        class="navbar__mobile-drawer glass-panel"
        data-test="mobile-drawer"
        role="dialog"
        :aria-labelledby="mobileMenuTitleId"
        aria-modal="true"
        tabindex="-1"
        @keydown="handleMobileDrawerKeydown"
      >
        <div class="navbar__mobile-header">
          <p class="navbar__mobile-eyebrow">Navigator</p>
          <div class="navbar__mobile-title-row">
            <div class="navbar__mobile-title-copy">
              <h2 :id="mobileMenuTitleId">Take Scope Trips with you</h2>
              <p>{{ mobileDrawerDescription }}</p>
            </div>
            <button
              type="button"
              class="navbar__mobile-close"
              aria-label="Close navigation drawer"
              @click="closeMobileMenu({ restoreFocus: true })"
            >
              <ScopeIcon name="close" label="Close navigation drawer" />
            </button>
          </div>
        </div>

        <div v-if="authStore.currentUser" class="navbar__mobile-account surface-card">
          <Avatar :name="authStore.currentUser.displayName" :src="authStore.currentUser.avatarUrl" :size="52" />
          <div class="navbar__mobile-account-copy">
            <strong>{{ authStore.currentUser.displayName }}</strong>
            <p>{{ profileMetaLine }}</p>
            <span class="navbar__mobile-account-chip">{{ mobileDrawerStatus }}</span>
          </div>
        </div>

        <div v-else class="navbar__mobile-account navbar__mobile-account--guest surface-card">
          <div class="navbar__mobile-account-copy">
            <strong>Welcome back to Scope Trips</strong>
            <p>Sign in to keep planning trips, saving pins, and following your crew from anywhere.</p>
          </div>
        </div>

        <div
          ref="mobileQuickSearchRef"
          class="quick-search-shell quick-search-shell--mobile"
          @focusin="handleQuickSearchFocus"
          @keydown.esc="closeQuickSearch"
        >
          <SearchBar
            v-model="searchQuery"
            class="navbar__mobile-search"
            aria-label="Search Scope Trips on mobile"
            placeholder="Search cities, spots, and travel vibes"
            @search="handleSearch"
          />

          <Transition name="dropdown-fade">
            <div
              v-if="showQuickSearchPanel"
              class="quick-search-dropdown quick-search-dropdown--mobile glass-panel"
              data-test="quick-search-dropdown"
              role="region"
              aria-label="Quick search results"
            >
              <p class="quick-search-dropdown__eyebrow">{{ quickSearchPanelEyebrow }}</p>
              <div v-if="quickSearchLoading && hasQuickSearchQuery" class="quick-search-state" role="status" aria-live="polite">
                Searching Scope Trips...
              </div>
              <div v-else-if="quickSearchError" class="quick-search-state quick-search-state--error" role="alert">
                {{ quickSearchError }}
              </div>
              <div v-else-if="quickSearchPlaceResults.length" class="quick-search-results" role="list" aria-label="Search matches">
                <button
                  v-for="result in quickSearchPlaceResults"
                  :key="`mobile-${result.id}`"
                  type="button"
                  class="quick-search-result"
                  data-test="quick-search-result"
                  role="listitem"
                  @click="openQuickSearchResult(result)"
                >
                  <span v-if="result.photoUrl" class="quick-search-result__media" aria-hidden="true">
                    <img :src="result.photoUrl" alt="" data-test="quick-search-result-photo" />
                  </span>
                  <span v-else class="quick-search-result__icon" aria-hidden="true">
                    <ScopeIcon name="pin" />
                  </span>
                  <span class="quick-search-result__copy">
                    <strong>{{ result.title }}</strong>
                    <small>{{ formatQuickSearchResultMeta(result) }}</small>
                    <span v-if="result.description">{{ result.description }}</span>
                  </span>
                </button>
              </div>
              <div v-else-if="hasQuickSearchQuery" class="quick-search-state" role="status">
                No quick matches yet.
              </div>
              <section v-if="showQuickSearchRecommendations" class="quick-search-section" aria-labelledby="mobile-quick-search-recommendations-title">
                <div class="quick-search-section__header">
                  <strong id="mobile-quick-search-recommendations-title">{{ quickSearchRecommendationTitle }}</strong>
                  <span v-if="quickSearchRecommendationPlaces.length">{{ quickSearchRecommendationPlaces.length }} places</span>
                </div>
                <div v-if="quickSearchRecommendationsLoading" class="quick-search-state" role="status" aria-live="polite">
                  Loading recommended places...
                </div>
                <div v-else-if="quickSearchRecommendationsError" class="quick-search-state quick-search-state--error" role="alert">
                  {{ quickSearchRecommendationsError }}
                </div>
                <div v-else-if="quickSearchRecommendationPlaces.length" class="quick-search-results quick-search-results--recommendations" role="list">
                  <button
                    v-for="result in quickSearchRecommendationPlaces"
                    :key="`mobile-recommended-${result.id}`"
                    type="button"
                    class="quick-search-result"
                    data-test="quick-search-recommendation"
                    role="listitem"
                    @click="openQuickSearchResult(result)"
                  >
                    <span v-if="result.photoUrl" class="quick-search-result__media" aria-hidden="true">
                      <img :src="result.photoUrl" alt="" data-test="quick-search-recommendation-photo" />
                    </span>
                    <span v-else class="quick-search-result__icon" aria-hidden="true">
                      <ScopeIcon name="sparkle" />
                    </span>
                    <span class="quick-search-result__copy">
                      <strong>{{ result.title }}</strong>
                      <small>{{ formatQuickSearchResultMeta(result) }}</small>
                      <span>{{ result.recommendationReason || result.description || 'Strong signal from current Scope Trips places.' }}</span>
                    </span>
                  </button>
                </div>
              </section>
            </div>
          </Transition>
        </div>

        <nav class="navbar__mobile-nav" aria-label="Mobile primary">
          <RouterLink
            v-for="link in mobileLinks"
            :key="`${link.to}:${link.label}`"
            :to="link.to"
            class="navbar__mobile-link"
            @click="closeMobileMenu()"
          >
            <span class="navbar__mobile-link-icon">
              <ScopeIcon :name="link.icon" :label="link.label" />
            </span>
            <span class="navbar__mobile-link-copy">
              <strong>{{ link.label }}</strong>
              <small>{{ link.description }}</small>
            </span>
            <ScopeIcon class="navbar__mobile-link-arrow" name="arrow-right" />
          </RouterLink>
        </nav>

        <div class="navbar__mobile-footer">
          <button v-if="authStore.currentUser" type="button" class="navbar__mobile-secondary" @click="handleLogout">
            <ScopeIcon name="logout" label="Log out" />
            <span>Log out</span>
          </button>

          <div v-else class="navbar__mobile-guest-actions">
            <RouterLink class="navbar__mobile-secondary" to="/login" @click="closeMobileMenu()">Log in</RouterLink>
            <RouterLink class="navbar__mobile-primary" to="/register" @click="closeMobileMenu()">Create account</RouterLink>
          </div>
        </div>
      </aside>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core';
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import Avatar from '@/components/common/Avatar.vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import SearchBar from '@/components/common/SearchBar.vue';
import ThemeToggle from '@/components/common/ThemeToggle.vue';
import { MOBILE_NAV_BREAKPOINT, buildMobileNavLinks } from '@/config/navbarLinks';
import {
  loadSearchPlaceRecommendations,
  recordSearchPlaceSuggestionClick,
  type SearchPlaceSuggestion,
} from '@/services/searchDiscoveryService';
import { searchContent, type SearchResult } from '@/services/searchService';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toasts';
import { focusFirstElement, focusLastElement, getFocusableElements, moveFocus } from '@/utils/a11y';
import { buildSpotPath } from '@/utils/spotRoutes';

const NotificationDropdown = defineAsyncComponent(() => import('@/components/social/NotificationDropdown.vue'));
const QUICK_SEARCH_RESULT_LIMIT = 6;
const QUICK_SEARCH_RECOMMENDATION_LIMIT = 6;

const featureLinks = [
  { label: 'Trips', to: '/trips', icon: 'route' },
  { label: 'New trip', to: '/trips/new', icon: 'plus' },
  { label: 'Friends', to: '/friends', icon: 'friends' },
] as const;

const authStore = useAuthStore();
const toastStore = useToastStore();
const route = useRoute();
const router = useRouter();
const searchQuery = ref('');
const quickSearchResults = ref<SearchResult[]>([]);
const quickSearchRecommendations = ref<SearchPlaceSuggestion[]>([]);
const quickSearchLoading = ref(false);
const quickSearchRecommendationsLoading = ref(false);
const quickSearchError = ref<string | null>(null);
const quickSearchRecommendationsError = ref<string | null>(null);
const isQuickSearchOpen = ref(false);
const isFeatureMenuOpen = ref(false);
const isMenuOpen = ref(false);
const isMobileMenuOpen = ref(false);
const isNotificationMenuOpen = ref(false);
const isScrolled = ref(false);
const featureMenuRef = ref<HTMLElement | null>(null);
const featureMenuButtonRef = ref<HTMLElement | null>(null);
const featureMenuPanelRef = ref<HTMLElement | null>(null);
const quickSearchRef = ref<HTMLElement | null>(null);
const mobileQuickSearchRef = ref<HTMLElement | null>(null);
const menuRef = ref<HTMLElement | null>(null);
const menuButtonRef = ref<HTMLElement | null>(null);
const menuPanelRef = ref<HTMLElement | null>(null);
const mobileMenuButtonRef = ref<HTMLElement | null>(null);
const mobileDrawerRef = ref<HTMLElement | null>(null);
const featureMenuButtonId = `navbar-feature-menu-button-${useId()}`;
const featureMenuId = `navbar-feature-menu-${useId()}`;
const menuButtonId = `navbar-menu-button-${useId()}`;
const menuId = `navbar-menu-${useId()}`;
const mobileMenuId = `navbar-mobile-menu-${useId()}`;
const mobileMenuTitleId = `navbar-mobile-menu-title-${useId()}`;
const bodyOverflowBeforeMobileMenu = ref<string | null>(null);
let quickSearchRequestId = 0;
let quickSearchRecommendationRequestId = 0;

interface QuickSearchPlace {
  id: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  photoUrl?: string;
  rating?: number;
  reviewCount?: number;
  likesCount?: number;
  city?: string;
  country?: string;
  vibe?: string;
  source: 'search' | SearchPlaceSuggestion['searchSuggestionSource'];
  recommendationReason?: string;
}

function formatProfileHandle(username: string): string {
  return `@${username.trim().toLocaleLowerCase()}`;
}

const profileMetaLine = computed(() => {
  if (!authStore.currentUser) {
    return '';
  }

  if (authStore.currentUser.username) {
    return formatProfileHandle(authStore.currentUser.username);
  }

  return authStore.currentUser.email || 'Traveler profile';
});
const mobileLinks = computed(() => buildMobileNavLinks(authStore.currentUser));
const mobileDrawerDescription = computed(() => authStore.currentUser
  ? 'Jump between maps, saved routes, and your traveler settings with one hand.'
  : 'Browse curated destinations, open the map, and sign in when you want to save the journey.');
const mobileDrawerStatus = computed(() => {
  if (!authStore.currentUser) {
    return 'Guest browsing';
  }

  const plannedTrips = authStore.currentUser.stats?.trips ?? 0;
  return plannedTrips > 0 ? `${plannedTrips} trip${plannedTrips === 1 ? '' : 's'} in motion` : 'Travel mode active';
});
const normalizedSearchQuery = computed(() => searchQuery.value.trim());
const hasQuickSearchQuery = computed(() => Boolean(normalizedSearchQuery.value));
const quickSearchRecommendationPlaces = computed<QuickSearchPlace[]>(() =>
  quickSearchRecommendations.value.map(mapSuggestionToQuickPlace),
);
const quickSearchRecommendationMatches = computed<QuickSearchPlace[]>(() => {
  const queryTokens = tokenizeQuickSearchQuery(normalizedSearchQuery.value);

  if (!queryTokens.length) {
    return [];
  }

  return quickSearchRecommendationPlaces.value
    .filter((place) => matchesQuickSearchPlace(place, queryTokens))
    .sort((left, right) => scoreQuickSearchPlace(right, queryTokens) - scoreQuickSearchPlace(left, queryTokens))
    .slice(0, QUICK_SEARCH_RESULT_LIMIT);
});
const quickSearchPlaceResults = computed<QuickSearchPlace[]>(() =>
  mergeQuickSearchPlaces([
    ...quickSearchResults.value.map(mapSearchResultToQuickPlace),
    ...quickSearchRecommendationMatches.value,
  ]).slice(0, QUICK_SEARCH_RESULT_LIMIT),
);
const showQuickSearchRecommendations = computed(() =>
  !hasQuickSearchQuery.value && (
    quickSearchRecommendationsLoading.value ||
    Boolean(quickSearchRecommendationsError.value) ||
    Boolean(quickSearchRecommendationPlaces.value.length)
  ),
);
const quickSearchPanelEyebrow = computed(() =>
  hasQuickSearchQuery.value ? 'Quick search' : 'Recommended places',
);
const quickSearchRecommendationTitle = computed(() =>
  hasQuickSearchQuery.value ? 'Recommended instead' : 'Recommended for you',
);
const showQuickSearchPanel = computed(() =>
  isQuickSearchOpen.value && (
    hasQuickSearchQuery.value ||
    quickSearchLoading.value ||
    quickSearchRecommendationsLoading.value ||
    Boolean(quickSearchError.value) ||
    Boolean(quickSearchRecommendationsError.value) ||
    Boolean(quickSearchResults.value.length) ||
    Boolean(quickSearchRecommendations.value.length)
  ),
);

function syncSearchFromRoute() {
  searchQuery.value = typeof route.query.q === 'string' ? route.query.q : '';
}

function resetQuickSearchState(): void {
  quickSearchRequestId += 1;
  quickSearchResults.value = [];
  quickSearchLoading.value = false;
  quickSearchError.value = null;
}

function closeQuickSearch(): void {
  isQuickSearchOpen.value = false;
}

function handleQuickSearchFocus(): void {
  isQuickSearchOpen.value = true;

  if (!hasQuickSearchQuery.value) {
    void loadQuickSearchRecommendations();
  }
}

function mapSearchResultToQuickPlace(result: SearchResult): QuickSearchPlace {
  const photoUrl = result.photoUrl?.trim() || result.photo_url?.trim() || undefined;
  const place: QuickSearchPlace = {
    id: result.id.trim(),
    title: result.name,
    source: 'search',
  };

  if (result.description) place.description = result.description;
  if (result.category) place.category = result.category;
  if (result.tags?.length) place.tags = result.tags;
  if (photoUrl) place.photoUrl = photoUrl;
  if (typeof result.avg_rating === 'number') place.rating = result.avg_rating;
  if (typeof result.review_count === 'number') place.reviewCount = result.review_count;
  if (result.city) place.city = result.city;
  if (result.country) place.country = result.country;
  if (result.vibe) place.vibe = result.vibe;

  return place;
}

function mapSuggestionToQuickPlace(spot: SearchPlaceSuggestion): QuickSearchPlace {
  const place: QuickSearchPlace = {
    id: spot.id,
    title: spot.title,
    category: spot.category,
    rating: spot.rating,
    source: spot.searchSuggestionSource,
  };

  if (spot.description) place.description = spot.description;
  if (spot.photoUrl) place.photoUrl = spot.photoUrl;
  if (typeof spot.likesCount === 'number') place.likesCount = spot.likesCount;
  if (spot.city) place.city = spot.city;
  if (spot.country) place.country = spot.country;
  if (spot.vibe) place.vibe = spot.vibe;
  if (spot.recommendationReason) place.recommendationReason = spot.recommendationReason;

  return place;
}

function normalizeQuickSearchTarget(result: SearchResult | QuickSearchPlace): QuickSearchPlace {
  if ('name' in result) {
    return mapSearchResultToQuickPlace(result);
  }

  return result;
}

function normalizeQuickSearchText(value: string | number | null | undefined): string {
  return String(value ?? '').trim().toLocaleLowerCase();
}

function tokenizeQuickSearchQuery(query: string): string[] {
  return normalizeQuickSearchText(query).split(/\s+/).filter(Boolean);
}

function isShortQuickSearchQuery(queryTokens: readonly string[]): boolean {
  return queryTokens.some((token) => token.length > 0 && token.length <= 3);
}

function getQuickSearchHaystack(place: QuickSearchPlace, options: { includeDescription?: boolean } = {}): string {
  const includeDescription = options.includeDescription ?? true;

  return [
    place.title,
    includeDescription ? place.description : undefined,
    place.category,
    place.city,
    place.country,
    place.vibe,
    ...(place.tags ?? []),
  ].map(normalizeQuickSearchText).filter(Boolean).join(' ');
}

function quickSearchTextHasTokenPrefix(text: string, token: string): boolean {
  return text.split(/[^a-z0-9]+/).some((word) => word.startsWith(token));
}

function matchesQuickSearchPlace(place: QuickSearchPlace, queryTokens: readonly string[]): boolean {
  if (!queryTokens.length) {
    return false;
  }

  const requirePrefixMatch = isShortQuickSearchQuery(queryTokens);
  const haystack = getQuickSearchHaystack(place, { includeDescription: !requirePrefixMatch });
  return queryTokens.every((token) => (
    requirePrefixMatch ? quickSearchTextHasTokenPrefix(haystack, token) : haystack.includes(token)
  ));
}

function scoreQuickSearchPlace(place: QuickSearchPlace, queryTokens: readonly string[]): number {
  const title = normalizeQuickSearchText(place.title);
  const location = normalizeQuickSearchText([place.city, place.country].filter(Boolean).join(' '));
  const requirePrefixMatch = isShortQuickSearchQuery(queryTokens);
  const haystack = getQuickSearchHaystack(place, { includeDescription: !requirePrefixMatch });

  return queryTokens.reduce((score, token) => {
    if (title === token) {
      return score + 12;
    }

    if (title.startsWith(token) || title.split(/\s+/).some((word) => word.startsWith(token))) {
      return score + 8;
    }

    if (!requirePrefixMatch && title.includes(token)) {
      return score + 6;
    }

    if (requirePrefixMatch ? quickSearchTextHasTokenPrefix(location, token) : location.includes(token)) {
      return score + 4;
    }

    return score + (
      requirePrefixMatch
        ? (quickSearchTextHasTokenPrefix(haystack, token) ? 1 : 0)
        : (haystack.includes(token) ? 1 : 0)
    );
  }, place.rating ?? 0);
}

function mergeQuickSearchPlace(existingPlace: QuickSearchPlace, incomingPlace: QuickSearchPlace): QuickSearchPlace {
  const mergedPlace: QuickSearchPlace = {
    ...existingPlace,
  };

  const description = existingPlace.description || incomingPlace.description;
  const category = existingPlace.category || incomingPlace.category;
  const tags = existingPlace.tags?.length ? existingPlace.tags : incomingPlace.tags;
  const photoUrl = existingPlace.photoUrl || incomingPlace.photoUrl;
  const rating = existingPlace.rating ?? incomingPlace.rating;
  const reviewCount = existingPlace.reviewCount ?? incomingPlace.reviewCount;
  const likesCount = existingPlace.likesCount ?? incomingPlace.likesCount;
  const city = existingPlace.city || incomingPlace.city;
  const country = existingPlace.country || incomingPlace.country;
  const vibe = existingPlace.vibe || incomingPlace.vibe;
  const recommendationReason = existingPlace.recommendationReason || incomingPlace.recommendationReason;

  if (description) mergedPlace.description = description;
  if (category) mergedPlace.category = category;
  if (tags?.length) mergedPlace.tags = tags;
  if (photoUrl) mergedPlace.photoUrl = photoUrl;
  if (typeof rating === 'number') mergedPlace.rating = rating;
  if (typeof reviewCount === 'number') mergedPlace.reviewCount = reviewCount;
  if (typeof likesCount === 'number') mergedPlace.likesCount = likesCount;
  if (city) mergedPlace.city = city;
  if (country) mergedPlace.country = country;
  if (vibe) mergedPlace.vibe = vibe;
  if (recommendationReason) mergedPlace.recommendationReason = recommendationReason;

  return mergedPlace;
}

function buildQuickSearchPlaceKeys(place: QuickSearchPlace): string[] {
  const keys = [`id:${place.id.trim()}`];
  const titleKey = normalizeQuickSearchText([place.title, place.city, place.country].filter(Boolean).join('|'));

  if (titleKey) {
    keys.push(`title:${titleKey}`);
  }

  return keys;
}

function mergeQuickSearchPlaces(places: QuickSearchPlace[]): QuickSearchPlace[] {
  const mergedPlaces: QuickSearchPlace[] = [];
  const placeByKey = new Map<string, QuickSearchPlace>();

  for (const place of places) {
    const keys = buildQuickSearchPlaceKeys(place);
    const matchingPlace = keys.map((key) => placeByKey.get(key)).find(Boolean);

    if (matchingPlace) {
      const mergedPlace = mergeQuickSearchPlace(matchingPlace, place);
      const index = mergedPlaces.indexOf(matchingPlace);
      if (index >= 0) {
        mergedPlaces[index] = mergedPlace;
      }
      for (const key of buildQuickSearchPlaceKeys(mergedPlace)) {
        placeByKey.set(key, mergedPlace);
      }
      continue;
    }

    mergedPlaces.push(place);
    for (const key of keys) {
      placeByKey.set(key, place);
    }
  }

  return mergedPlaces;
}

function formatQuickSearchResultMeta(result: SearchResult | QuickSearchPlace): string {
  if ('name' in result) {
    const searchLocation = [result.city, result.country].filter(Boolean).join(', ');
    const metaParts = [
      result.category,
      searchLocation,
      result.avg_rating ? `${result.avg_rating.toFixed(1)} rating` : '',
      result.tags?.find((tag) => tag.trim() && ![result.category, result.city, result.country].includes(tag)),
    ].filter(Boolean);

    return metaParts.slice(0, 3).join(' / ') || 'Scope Trips spot';
  }

  const location = [result.city, result.country].filter(Boolean).join(', ');
  const metaParts = [
    result.category,
    location,
    result.rating ? `${result.rating.toFixed(1)} rating` : '',
    result.tags?.find((tag) => tag.trim()),
  ].filter(Boolean);

  return metaParts.slice(0, 3).join(' / ') || 'Scope Trips spot';
}

async function loadQuickSearchRecommendations(options: { force?: boolean } = {}): Promise<void> {
  if (!options.force && (quickSearchRecommendations.value.length || quickSearchRecommendationsLoading.value)) {
    return;
  }

  const requestId = quickSearchRecommendationRequestId + 1;
  quickSearchRecommendationRequestId = requestId;
  quickSearchRecommendationsLoading.value = true;
  quickSearchRecommendationsError.value = null;

  try {
    const recommendations = await loadSearchPlaceRecommendations({
      isAuthenticated: authStore.isAuthenticated,
      currentUser: authStore.currentUser,
      limit: QUICK_SEARCH_RECOMMENDATION_LIMIT,
    });

    if (requestId !== quickSearchRecommendationRequestId) {
      return;
    }

    quickSearchRecommendations.value = recommendations;
  } catch {
    if (requestId !== quickSearchRecommendationRequestId) {
      return;
    }

    quickSearchRecommendations.value = [];
    quickSearchRecommendationsError.value = 'Recommended places are temporarily unavailable.';
  } finally {
    if (requestId === quickSearchRecommendationRequestId) {
      quickSearchRecommendationsLoading.value = false;
    }
  }
}

async function openQuickSearchResult(result: SearchResult | QuickSearchPlace): Promise<void> {
  const place = normalizeQuickSearchTarget(result);
  const resultId = place.id.trim();
  closeQuickSearch();
  closeMobileMenu();

  if (!resultId) {
    return;
  }

  if (place.source === 'recommendation') {
    const matchingSuggestion = quickSearchRecommendations.value.find((spot) => spot.id === resultId);
    if (matchingSuggestion) {
      void recordSearchPlaceSuggestionClick(matchingSuggestion);
    }
  }

  await router.push(buildSpotPath({
    id: resultId,
    title: place.title,
    ...(place.city ? { city: place.city } : {}),
    ...(place.country ? { country: place.country } : {}),
  }));
}

function updateScrollState(): void {
  if (typeof window === 'undefined') {
    return;
  }

  isScrolled.value = window.scrollY > 24;
}

function getFeatureMenuItems(): HTMLElement[] {
  if (!featureMenuPanelRef.value) {
    return [];
  }

  return Array.from(featureMenuPanelRef.value.querySelectorAll<HTMLElement>('[role="menuitem"]'));
}

function getMenuItems(): HTMLElement[] {
  if (!menuPanelRef.value) {
    return [];
  }

  return Array.from(menuPanelRef.value.querySelectorAll<HTMLElement>('[role="menuitem"]'));
}

function focusFeatureMenuBoundary(position: 'first' | 'last'): void {
  const menuItems = getFeatureMenuItems();
  const focusTarget = position === 'first' ? menuItems[0] : menuItems[menuItems.length - 1];

  if (focusTarget) {
    focusTarget.focus();
    return;
  }

  featureMenuPanelRef.value?.focus();
}

function focusMenuBoundary(position: 'first' | 'last'): void {
  const menuItems = getMenuItems();
  const focusTarget = position === 'first' ? menuItems[0] : menuItems[menuItems.length - 1];

  if (focusTarget) {
    focusTarget.focus();
    return;
  }

  menuPanelRef.value?.focus();
}

function focusMobileDrawerBoundary(position: 'first' | 'last'): void {
  const focusMoved = position === 'first'
    ? focusFirstElement(mobileDrawerRef.value)
    : focusLastElement(mobileDrawerRef.value);

  if (!focusMoved) {
    mobileDrawerRef.value?.focus();
  }
}

async function openFeatureMenu(position: 'none' | 'first' | 'last' = 'none'): Promise<void> {
  if (!isFeatureMenuOpen.value) {
    closeQuickSearch();
    closeMenu();
    closeMobileMenu();
    isFeatureMenuOpen.value = true;
    await nextTick();
  }

  if (position === 'first' || position === 'last') {
    focusFeatureMenuBoundary(position);
  }
}

async function openMenu(position: 'none' | 'first' | 'last' = 'none'): Promise<void> {
  if (!isMenuOpen.value) {
    closeQuickSearch();
    closeFeatureMenu();
    closeMobileMenu();
    isMenuOpen.value = true;
    await nextTick();
  }

  if (position === 'first' || position === 'last') {
    focusMenuBoundary(position);
  }
}

async function openMobileMenu(position: 'panel' | 'first' | 'last' = 'first'): Promise<void> {
  if (!isMobileMenuOpen.value) {
    closeQuickSearch();
    closeFeatureMenu();
    closeMenu();
    isMobileMenuOpen.value = true;
    await nextTick();
  }

  if (position === 'panel') {
    mobileDrawerRef.value?.focus();
    return;
  }

  focusMobileDrawerBoundary(position);
}

function closeMenu(options: { restoreFocus?: boolean } = {}) {
  if (!isMenuOpen.value) {
    return;
  }

  isMenuOpen.value = false;

  if (options.restoreFocus) {
    void nextTick(() => {
      menuButtonRef.value?.focus();
    });
  }
}

function closeFeatureMenu(options: { restoreFocus?: boolean } = {}) {
  if (!isFeatureMenuOpen.value) {
    return;
  }

  isFeatureMenuOpen.value = false;

  if (options.restoreFocus) {
    void nextTick(() => {
      featureMenuButtonRef.value?.focus();
    });
  }
}

function closeMobileMenu(options: { restoreFocus?: boolean } = {}) {
  if (!isMobileMenuOpen.value) {
    return;
  }

  isMobileMenuOpen.value = false;

  if (options.restoreFocus) {
    void nextTick(() => {
      mobileMenuButtonRef.value?.focus();
    });
  }
}

function toggleFeatureMenu() {
  if (isFeatureMenuOpen.value) {
    closeFeatureMenu();
    return;
  }

  void openFeatureMenu('first');
}

function toggleMenu() {
  if (isMenuOpen.value) {
    closeMenu();
    return;
  }

  void openMenu('first');
}

function toggleMobileMenu() {
  if (isMobileMenuOpen.value) {
    closeMobileMenu({ restoreFocus: true });
    return;
  }

  void openMobileMenu();
}

function handleFeatureMenuButtonKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      void openFeatureMenu('first');
      break;
    case 'ArrowUp':
      event.preventDefault();
      void openFeatureMenu('last');
      break;
    case 'Enter':
    case ' ':
      if (!isFeatureMenuOpen.value) {
        event.preventDefault();
        void openFeatureMenu('first');
      }
      break;
    case 'Escape':
      if (isFeatureMenuOpen.value) {
        event.preventDefault();
        closeFeatureMenu({ restoreFocus: true });
      }
      break;
    default:
      break;
  }
}

function handleMenuButtonKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      void openMenu('first');
      break;
    case 'ArrowUp':
      event.preventDefault();
      void openMenu('last');
      break;
    case 'Enter':
    case ' ':
      if (!isMenuOpen.value) {
        event.preventDefault();
        void openMenu('first');
      }
      break;
    case 'Escape':
      if (isMenuOpen.value) {
        event.preventDefault();
        closeMenu({ restoreFocus: true });
      }
      break;
    default:
      break;
  }
}

function moveFeatureMenuFocus(direction: 1 | -1): void {
  const menuItems = getFeatureMenuItems();

  if (!menuItems.length) {
    featureMenuPanelRef.value?.focus();
    return;
  }

  const activeElement = typeof document === 'undefined' ? null : document.activeElement;
  const currentIndex = menuItems.findIndex((menuItem) => menuItem === activeElement);
  const nextIndex = currentIndex === -1
    ? direction === 1 ? 0 : menuItems.length - 1
    : (currentIndex + direction + menuItems.length) % menuItems.length;

  menuItems[nextIndex]?.focus();
}

function moveMenuFocus(direction: 1 | -1): void {
  const menuItems = getMenuItems();

  if (!menuItems.length) {
    menuPanelRef.value?.focus();
    return;
  }

  const activeElement = typeof document === 'undefined' ? null : document.activeElement;
  const currentIndex = menuItems.findIndex((menuItem) => menuItem === activeElement);
  const nextIndex = currentIndex === -1
    ? direction === 1 ? 0 : menuItems.length - 1
    : (currentIndex + direction + menuItems.length) % menuItems.length;

  menuItems[nextIndex]?.focus();
}

function handleFeatureMenuKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      moveFeatureMenuFocus(1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      moveFeatureMenuFocus(-1);
      break;
    case 'Home':
      event.preventDefault();
      focusFeatureMenuBoundary('first');
      break;
    case 'End':
      event.preventDefault();
      focusFeatureMenuBoundary('last');
      break;
    case 'Escape':
      event.preventDefault();
      closeFeatureMenu({ restoreFocus: true });
      break;
    default:
      break;
  }
}

function handleMenuKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      moveMenuFocus(1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      moveMenuFocus(-1);
      break;
    case 'Home':
      event.preventDefault();
      focusMenuBoundary('first');
      break;
    case 'End':
      event.preventDefault();
      focusMenuBoundary('last');
      break;
    case 'Escape':
      event.preventDefault();
      closeMenu({ restoreFocus: true });
      break;
    default:
      break;
  }
}

function handleMobileDrawerKeydown(event: KeyboardEvent): void {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      if (!moveFocus(mobileDrawerRef.value, 1)) {
        focusMobileDrawerBoundary('first');
      }
      break;
    case 'ArrowUp':
      event.preventDefault();
      if (!moveFocus(mobileDrawerRef.value, -1)) {
        focusMobileDrawerBoundary('last');
      }
      break;
    case 'Home':
      event.preventDefault();
      focusMobileDrawerBoundary('first');
      break;
    case 'End':
      event.preventDefault();
      focusMobileDrawerBoundary('last');
      break;
    case 'Tab': {
      const focusableElements = getFocusableElements(mobileDrawerRef.value);

      if (!focusableElements.length) {
        event.preventDefault();
        mobileDrawerRef.value?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = typeof document === 'undefined' ? null : document.activeElement;

      if (event.shiftKey && (activeElement === firstElement || activeElement === mobileDrawerRef.value)) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
      break;
    }
    case 'Escape':
      event.preventDefault();
      closeMobileMenu({ restoreFocus: true });
      break;
    default:
      break;
  }
}

function handleFeatureMenuFocusOut(event: FocusEvent): void {
  const nextTarget = event.relatedTarget;

  if (nextTarget instanceof Node && featureMenuRef.value?.contains(nextTarget)) {
    return;
  }

  closeFeatureMenu();
}

function handleMenuFocusOut(event: FocusEvent): void {
  const nextTarget = event.relatedTarget;

  if (nextTarget instanceof Node && menuRef.value?.contains(nextTarget)) {
    return;
  }

  closeMenu();
}

function handleGlobalMenuKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') {
    return;
  }

  if (isFeatureMenuOpen.value) {
    event.preventDefault();
    closeFeatureMenu({ restoreFocus: true });
    return;
  }

  if (isMobileMenuOpen.value) {
    event.preventDefault();
    closeMobileMenu({ restoreFocus: true });
    return;
  }

  if (isMenuOpen.value) {
    event.preventDefault();
    closeMenu({ restoreFocus: true });
  }
}

function setMobileScrollLock(isLocked: boolean): void {
  if (typeof document === 'undefined') {
    return;
  }

  const { body } = document;

  if (isLocked) {
    if (bodyOverflowBeforeMobileMenu.value === null) {
      bodyOverflowBeforeMobileMenu.value = body.style.overflow;
    }

    body.style.overflow = 'hidden';
    return;
  }

  body.style.overflow = bodyOverflowBeforeMobileMenu.value ?? '';
  bodyOverflowBeforeMobileMenu.value = null;
}

function handleViewportResize(): void {
  if (typeof window === 'undefined') {
    return;
  }

  updateScrollState();

  if (window.innerWidth > MOBILE_NAV_BREAKPOINT && isMobileMenuOpen.value) {
    closeMobileMenu();
  }
}

async function handleLogout() {
  closeFeatureMenu();
  closeMenu();
  closeMobileMenu();
  await authStore.logout();
  await router.push({ name: 'home' });

  if (authStore.error) {
    toastStore.showInfo({
      title: 'Signed out locally',
      message: authStore.error,
    });
    return;
  }

  toastStore.showSuccess({
    title: 'Signed out',
    message: 'Your Scope Trips session is closed for now. Come back anytime to keep exploring.',
  });
}

async function handleSearch(query: string): Promise<void> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    resetQuickSearchState();
    isQuickSearchOpen.value = true;
    void loadQuickSearchRecommendations();
    return;
  }

  const requestId = quickSearchRequestId + 1;
  quickSearchRequestId = requestId;
  isQuickSearchOpen.value = true;
  quickSearchLoading.value = true;
  quickSearchError.value = null;

  if (!quickSearchRecommendations.value.length && !quickSearchRecommendationsLoading.value) {
    void loadQuickSearchRecommendations();
  }

  try {
    const response = await searchContent(normalizedQuery, 'spots', QUICK_SEARCH_RESULT_LIMIT, 0);

    if (requestId !== quickSearchRequestId) {
      return;
    }

    quickSearchResults.value = response.results.slice(0, QUICK_SEARCH_RESULT_LIMIT);
  } catch {
    if (requestId !== quickSearchRequestId) {
      return;
    }

    quickSearchResults.value = [];
    quickSearchError.value = 'Scope Trips could not load quick search right now.';
  } finally {
    if (requestId === quickSearchRequestId) {
      quickSearchLoading.value = false;
    }
  }
}

defineExpose({
  ...(import.meta.env.MODE === 'test'
    ? {
        __coverage: {
          closeFeatureMenu,
          closeMenu,
          closeMobileMenu,
          closeQuickSearch,
          focusFeatureMenuBoundary,
          focusMenuBoundary,
          focusMobileDrawerBoundary,
          formatProfileHandle,
          formatQuickSearchResultMeta,
          buildQuickSearchPlaceKeys,
          getFeatureMenuItems,
          getQuickSearchHaystack,
          getMenuItems,
          handleFeatureMenuButtonKeydown,
          handleFeatureMenuFocusOut,
          handleFeatureMenuKeydown,
          handleGlobalMenuKeydown,
          handleMenuButtonKeydown,
          handleMenuFocusOut,
          handleMenuKeydown,
          handleMobileDrawerKeydown,
          handleQuickSearchFocus,
          handleSearch,
          handleViewportResize,
          isShortQuickSearchQuery,
          mapSearchResultToQuickPlace,
          mapSuggestionToQuickPlace,
          matchesQuickSearchPlace,
          mergeQuickSearchPlace,
          mergeQuickSearchPlaces,
          moveFeatureMenuFocus,
          moveMenuFocus,
          normalizeQuickSearchTarget,
          normalizeQuickSearchText,
          openFeatureMenu,
          openMenu,
          openMobileMenu,
          openQuickSearchResult,
          quickSearchTextHasTokenPrefix,
          resetQuickSearchState,
          scoreQuickSearchPlace,
          setMobileScrollLock,
          syncSearchFromRoute,
          tokenizeQuickSearchQuery,
          toggleFeatureMenu,
          toggleMenu,
          toggleMobileMenu,
          updateScrollState,
        },
      }
    : {}),
});

watch(
  () => route.fullPath,
  () => {
    syncSearchFromRoute();
    closeQuickSearch();
    closeFeatureMenu();
    closeMenu();
    closeMobileMenu();
    updateScrollState();
  },
  { immediate: true },
);

watch(
  () => isFeatureMenuOpen.value || isMenuOpen.value || isMobileMenuOpen.value,
  (isAnyMenuOpen) => {
    if (typeof window === 'undefined') {
      return;
    }

    if (isAnyMenuOpen) {
      window.addEventListener('keydown', handleGlobalMenuKeydown);
      return;
    }

    window.removeEventListener('keydown', handleGlobalMenuKeydown);
  },
  { immediate: true },
);

watch(
  () => isMobileMenuOpen.value,
  (isOpen) => {
    setMobileScrollLock(isOpen);

    if (isOpen) {
      closeMenu();
    }
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
    quickSearchRecommendationRequestId += 1;
    quickSearchRecommendations.value = [];
    quickSearchRecommendationsLoading.value = false;
    quickSearchRecommendationsError.value = null;

    if (isQuickSearchOpen.value && !hasQuickSearchQuery.value) {
      void loadQuickSearchRecommendations({ force: true });
    }
  },
);

onClickOutside(menuRef, () => {
  closeMenu();
});

onClickOutside(featureMenuRef, () => {
  closeFeatureMenu();
});

onClickOutside(quickSearchRef, (event) => {
  const eventTarget = event.target;

  if (eventTarget instanceof Node && mobileQuickSearchRef.value?.contains(eventTarget)) {
    return;
  }

  closeQuickSearch();
});

onClickOutside(mobileQuickSearchRef, (event) => {
  const eventTarget = event.target;

  if (eventTarget instanceof Node && quickSearchRef.value?.contains(eventTarget)) {
    return;
  }

  closeQuickSearch();
});

onMounted(() => {
  updateScrollState();
  window.addEventListener('scroll', updateScrollState, { passive: true });
  window.addEventListener('resize', handleViewportResize, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalMenuKeydown);
  window.removeEventListener('scroll', updateScrollState);
  window.removeEventListener('resize', handleViewportResize);
  setMobileScrollLock(false);
});
</script>

<style scoped>
.navbar {
  --navbar-edge-padding: 1rem;

  position: fixed;
  inset: 0 0 auto;
  z-index: var(--z-navbar);
  isolation: isolate;
  padding: calc(var(--safe-area-top) + 0.85rem) 0 0.7rem;
  border-bottom: 1px solid color-mix(in srgb, var(--glass-border) 65%, transparent);
  background-color: var(--bg-primary);
  background-image:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-primary) 94%, var(--bg-secondary)) 0%,
      color-mix(in srgb, var(--bg-primary) 98%, var(--bg-secondary)) 76%,
      var(--bg-primary) 100%
    );
  opacity: var(--motion-navbar-opacity-rest);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  transition:
    background-color var(--transition-normal),
    background-image var(--transition-normal),
    border-color var(--transition-normal),
    box-shadow var(--transition-normal),
    padding var(--transition-normal);
}

.navbar::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 0;
  width: calc(100vw - (var(--navbar-edge-padding) * 2));
  height: 1px;
  border-radius: var(--radius-full);
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, var(--accent-teal) 42%, transparent),
    transparent
  );
  opacity: 0;
  transform: translateX(-50%) scaleX(0.92);
  transition: opacity var(--transition-normal), transform var(--transition-normal);
  pointer-events: none;
}

.navbar--scrolled {
  border-bottom-color: var(--glass-border);
  opacity: var(--motion-navbar-opacity-scrolled);
  background-color: var(--bg-primary);
  background-image:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-primary) 90%, var(--bg-secondary)) 0%,
      var(--bg-primary) 100%
    );
  box-shadow: 0 1.5rem 3rem color-mix(in srgb, var(--bg-primary) 34%, transparent);
}

.navbar--scrolled::after {
  opacity: 1;
  transform: translateX(-50%) scaleX(1);
}

.navbar--mobile-open {
  border-bottom-color: var(--glass-border);
  opacity: var(--motion-navbar-opacity-scrolled);
  background-color: var(--bg-primary);
  background-image:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-primary) 88%, var(--bg-secondary)) 0%,
      var(--bg-primary) 100%
    );
  box-shadow: 0 1.5rem 3rem color-mix(in srgb, var(--bg-primary) 34%, transparent);
}

.navbar--mobile-open::after {
  opacity: 1;
  transform: translateX(-50%) scaleX(1);
}

.navbar--notifications-open {
  z-index: var(--z-notification);
}

.navbar__inner {
  width: 100%;
  max-width: none;
  margin: 0 auto;
  padding: 0 calc(var(--navbar-edge-padding) + var(--safe-area-right)) 0 calc(var(--navbar-edge-padding) + var(--safe-area-left));
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas: 'leading actions';
  align-items: center;
  gap: var(--space-5);
  transition: transform var(--transition-normal), gap var(--transition-normal);
}

.navbar--scrolled .navbar__inner {
  transform: none;
}

.brand,
.nav-links,
.actions,
.profile-chip,
.guest-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.navbar__leading {
  grid-area: leading;
  display: inline-flex;
  align-items: center;
  gap: var(--space-5);
  min-width: 0;
}

.brand {
  flex-shrink: 0;
  gap: 0.6rem;
  color: var(--text-primary);
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  text-decoration: none;
}

.brand__mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.625rem;
  border: 1px solid color-mix(in srgb, var(--highlight-sheen) 14%, transparent);
  background: var(--accent-teal);
  color: var(--text-inverse);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 18%, transparent);
}

.brand__mark :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
}

.brand:hover,
.brand:focus-visible {
  color: var(--text-primary);
  outline: none;
}

.nav-links {
  justify-content: flex-start;
  flex-wrap: nowrap;
  gap: 0.15rem;
  min-width: 0;
}

.nav-links a,
.feature-menu-button,
.ghost-link,
.profile-chip {
  color: var(--text-secondary);
}

.nav-links a,
.feature-menu-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 2.25rem;
  padding: 0 0.85rem;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 500;
  letter-spacing: 0.005em;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background var(--transition-fast);
}

.nav-links a::after {
  display: none;
}

.nav-links a.router-link-active,
.nav-links a:hover,
.nav-links a:focus-visible,
.feature-menu-button:hover,
.feature-menu-button:focus-visible,
.feature-menu-button[aria-expanded='true'],
.ghost-link:hover,
.ghost-link:focus-visible,
.profile-chip:hover,
.profile-chip:focus-visible {
  color: var(--text-primary);
  outline: none;
}

.nav-links a.router-link-active,
.feature-menu-button[aria-expanded='true'] {
  background: color-mix(in srgb, var(--accent-teal) 14%, transparent);
}

.feature-menu-shell {
  position: relative;
}

.feature-menu-button {
  gap: 0.35rem;
}

.feature-menu-button :deep(.scope-icon) {
  width: 0.85rem;
  height: 0.85rem;
  opacity: 0.78;
  transition: transform var(--transition-fast);
}

.feature-menu-button[aria-expanded='true'] :deep(.scope-icon) {
  transform: rotate(180deg);
}

.feature-menu-dropdown {
  position: absolute;
  top: calc(100% + 0.65rem);
  left: 0;
  z-index: var(--z-dropdown);
  min-width: 13rem;
  display: grid;
  gap: 0.2rem;
  padding: 0.45rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  background: var(--bg-secondary);
  box-shadow:
    var(--shadow-lg),
    0 0 0 1px color-mix(in srgb, var(--accent-teal) 8%, transparent);
}

.feature-menu-dropdown a {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 2.65rem;
  padding: 0.55rem 0.7rem;
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}

.feature-menu-dropdown a:hover,
.feature-menu-dropdown a:focus-visible,
.feature-menu-dropdown a.router-link-active {
  background: color-mix(in srgb, var(--accent-teal) 14%, transparent);
  outline: none;
}

.feature-menu-dropdown :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
  color: var(--accent-teal);
}

.actions {
  grid-area: actions;
  justify-content: flex-end;
  justify-self: end;
  min-width: 0;
}

.quick-search-shell {
  position: relative;
  min-width: 0;
}

.quick-search-shell--desktop {
  flex: 0 1 auto;
}

.navbar-search {
  width: 100%;
  min-width: clamp(18rem, 28vw, 31rem);
  max-width: 31rem;
  border-color: color-mix(in srgb, var(--glass-border) 92%, transparent);
  background: color-mix(in srgb, var(--glass-bg) 88%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--text-primary) 10%, transparent),
    0 0.75rem 1.5rem color-mix(in srgb, var(--bg-primary) 16%, transparent);
}

.navbar-search :deep(.search-bar__label) {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.navbar-search:focus-within {
  border-color: color-mix(in srgb, var(--accent-teal) 36%, var(--glass-border));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-teal) 22%, transparent);
}

.quick-search-dropdown {
  position: absolute;
  top: calc(100% + var(--space-2));
  right: 0;
  z-index: var(--z-dropdown);
  width: min(43rem, calc(100vw - 2rem));
  display: grid;
  gap: 0.85rem;
  padding: 0.95rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  border-radius: var(--radius-xl);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--bg-secondary) 98%, transparent) 0%,
      color-mix(in srgb, var(--bg-primary) 94%, transparent) 100%
    );
  box-shadow:
    var(--shadow-lg),
    0 0 0 1px color-mix(in srgb, var(--accent-teal) 9%, transparent);
}

.quick-search-dropdown--mobile {
  position: static;
  width: 100%;
  margin-top: var(--space-2);
}

.quick-search-dropdown__eyebrow,
.quick-search-state,
.quick-search-result__copy strong,
.quick-search-result__copy small,
.quick-search-result__copy span {
  margin: 0;
}

.quick-search-dropdown__eyebrow {
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-eyebrow);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
}

.quick-search-results {
  display: grid;
  gap: 0.55rem;
  max-height: min(22rem, calc(100vh - 9rem));
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding-right: 0.2rem;
}

.quick-search-section {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.quick-search-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-width: 0;
  color: var(--text-primary);
}

.quick-search-section__header strong {
  overflow: hidden;
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-search-section__header span {
  flex: 0 0 auto;
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}

.quick-search-results--recommendations {
  max-height: min(20rem, calc(100vh - 13rem));
}

.quick-search-result {
  width: 100%;
  min-height: 4.8rem;
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr);
  gap: 0.85rem;
  align-items: center;
  padding: 0.55rem 0.7rem 0.55rem 0.55rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 64%, transparent);
  border-radius: var(--radius-md);
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--bg-primary) 62%, transparent) 0%,
      color-mix(in srgb, var(--bg-secondary) 72%, transparent) 100%
    );
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast);
}

.quick-search-result:hover,
.quick-search-result:focus-visible {
  border-color: color-mix(in srgb, var(--accent-teal) 42%, var(--glass-border));
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--accent-teal-light) 62%, var(--bg-primary)) 0%,
      color-mix(in srgb, var(--bg-secondary) 82%, transparent) 100%
    );
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--accent-teal) 12%, transparent),
    0 0.7rem 1.4rem color-mix(in srgb, var(--bg-primary) 22%, transparent);
  outline: none;
  transform: translateY(var(--motion-button-lift));
}

.quick-search-result__media {
  width: 5rem;
  height: 3.95rem;
  display: block;
  overflow: hidden;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--bg-primary) 70%, transparent);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--text-primary) 12%, transparent),
    0 0.35rem 0.8rem color-mix(in srgb, var(--bg-primary) 18%, transparent);
}

.quick-search-result__media img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.quick-search-result__icon {
  width: 3.25rem;
  height: 3.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  justify-self: center;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--accent-teal-light) 82%, transparent);
  color: var(--accent-teal);
}

.quick-search-result__icon :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
}

.quick-search-result__copy {
  min-width: 0;
  display: grid;
  gap: 0.18rem;
}

.quick-search-result__copy strong,
.quick-search-result__copy small,
.quick-search-result__copy span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.quick-search-result__copy strong {
  color: var(--text-primary);
  font-size: 0.95rem;
  line-height: 1.2;
  white-space: nowrap;
}

.quick-search-result__copy small {
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  line-height: 1.3;
  white-space: nowrap;
}

.quick-search-result__copy span,
.quick-search-state {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  line-height: var(--line-height-normal);
}

.quick-search-result__copy span {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.quick-search-state {
  padding: 0.8rem 0.9rem;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--bg-primary) 38%, transparent);
}

.quick-search-state--error {
  color: var(--danger);
}

.create-spot-link {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
  min-height: 2.85rem;
  padding: 0.42rem 0.8rem 0.42rem 0.48rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 34%, var(--glass-border));
  border-radius: var(--radius-full);
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--accent-teal) 94%, transparent) 0%,
      color-mix(in srgb, var(--accent-teal-hover) 92%, transparent) 100%
  );
  color: var(--bg-primary);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text-primary) 24%, transparent);
  text-decoration: none;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast),
    filter var(--transition-fast);
}

.create-spot-link::before {
  content: '';
  position: absolute;
  inset: 1px;
  border-radius: inherit;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--text-primary) 14%, transparent),
    color-mix(in srgb, var(--accent-gold) 14%, transparent)
  );
  opacity: 0.58;
  pointer-events: none;
}

.create-spot-link:hover,
.create-spot-link:focus-visible,
.create-spot-link.router-link-active,
.create-spot-link[data-onboarding-active='true'] {
  outline: none;
  transform: translateY(var(--motion-button-lift));
  border-color: color-mix(in srgb, var(--accent-gold) 26%, var(--accent-teal));
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--accent-gold) 14%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--text-primary) 24%, transparent);
  filter: saturate(1.05);
}

.create-spot-link:active {
  transform: translateY(0) scale(var(--motion-press-scale));
}

.create-spot-link__icon-shell,
.create-spot-link__copy {
  position: relative;
  z-index: 1;
}

.create-spot-link__icon-shell {
  width: 1.9rem;
  height: 1.9rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 14%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text-primary) 22%, transparent);
}

.create-spot-link__icon-shell :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
}

.create-spot-link__copy {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.92rem;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.create-spot-link__copy-extended {
  color: color-mix(in srgb, var(--bg-primary) 92%, transparent);
}

.menu-shell {
  position: relative;
}

.profile-chip {
  min-width: 0;
  max-width: 15rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 96%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--glass-bg) 88%, transparent);
  padding: 0.35rem 0.55rem 0.35rem 0.35rem;
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--text-primary) 12%, transparent),
    0 1rem 2rem color-mix(in srgb, var(--bg-primary) 18%, transparent);
  transition:
    color var(--transition-fast),
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.profile-chip:hover,
.profile-chip:focus-visible,
.profile-chip[aria-expanded='true'] {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent-teal) 38%, var(--glass-border));
  background: color-mix(in srgb, var(--glass-bg) 96%, transparent);
  box-shadow:
    var(--shadow-md),
    0 0 0 1px color-mix(in srgb, var(--accent-teal) 16%, transparent);
}

.profile-chip:active {
  transform: translateY(0) scale(0.97);
}

.profile-chip__avatar-shell {
  position: relative;
  display: inline-grid;
  border-radius: var(--radius-full);
}

.profile-chip__avatar-shell::after {
  content: '';
  position: absolute;
  inset: -0.15rem;
  border-radius: inherit;
  background: radial-gradient(circle at top, color-mix(in srgb, var(--accent-teal) 34%, transparent), transparent 70%);
  z-index: -1;
}

.profile-chip__copy {
  min-width: 0;
  display: grid;
  gap: 0.1rem;
  text-align: left;
}

.profile-chip__copy strong,
.profile-chip__copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-chip__copy strong {
  color: var(--text-primary);
  font-size: 0.95rem;
}

.profile-chip__copy small {
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  letter-spacing: 0;
  text-transform: none;
}

.profile-chip__chevron {
  display: inline-flex;
  color: var(--text-secondary);
  transition: transform var(--transition-fast), color var(--transition-fast);
}

.profile-chip[aria-expanded='true'] .profile-chip__chevron {
  color: var(--accent-teal);
  transform: rotate(180deg);
}

.profile-chip__chevron :deep(.scope-icon) {
  width: 0.95rem;
  height: 0.95rem;
}

.menu-dropdown {
  position: absolute;
  top: calc(100% + var(--space-3));
  right: 0;
  min-width: 17.5rem;
  display: grid;
  gap: var(--space-4);
  padding: var(--space-4);
  overflow: hidden;
  z-index: var(--z-dropdown);
  box-shadow:
    var(--shadow-lg),
    0 0 0 1px color-mix(in srgb, var(--glass-border) 100%, transparent);
}

.menu-dropdown::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent-teal) 20%, transparent), transparent 48%),
    linear-gradient(135deg, color-mix(in srgb, var(--text-primary) 10%, transparent), transparent 42%);
  pointer-events: none;
}

.menu-dropdown > * {
  position: relative;
  z-index: 1;
}

.menu-dropdown:focus-visible {
  outline: 2px solid var(--input-focus);
  outline-offset: 3px;
}

.menu-dropdown__profile {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-3);
  align-items: center;
}

.menu-dropdown__copy {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
}

.menu-dropdown__eyebrow,
.menu-dropdown__copy p,
.menu-dropdown__copy strong {
  margin: 0;
}

.menu-dropdown__eyebrow {
  color: var(--accent-teal);
  font-size: var(--font-size-caption);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.menu-dropdown__copy strong {
  color: var(--text-primary);
  font-size: var(--font-size-body);
}

.menu-dropdown__copy p:last-child {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.menu-dropdown__divider {
  height: 1px;
  background: color-mix(in srgb, var(--glass-border) 100%, transparent);
}

.menu-dropdown__actions {
  display: grid;
  gap: var(--space-1);
}

.menu-dropdown a,
.menu-dropdown button {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: 0.85rem 0.95rem;
  border: 0;
  border-radius: var(--radius-xl);
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast),
    color var(--transition-fast);
}

.menu-dropdown a:hover,
.menu-dropdown a:focus-visible,
.menu-dropdown button:hover,
.menu-dropdown button:focus-visible {
  background: color-mix(in srgb, var(--accent-teal-light) 72%, transparent);
  box-shadow: 0 1rem 2rem color-mix(in srgb, var(--accent-teal) 16%, transparent);
  transform: translateY(-1px);
  outline: none;
}

.menu-dropdown a:active,
.menu-dropdown button:active {
  transform: translateY(0) scale(0.97);
}

.guest-actions {
  flex-wrap: nowrap;
}

.ghost-link,
.accent-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  padding: 0.72rem 1rem;
  font-weight: var(--font-weight-semibold);
  transition:
    transform var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    color var(--transition-fast);
}

.ghost-link {
  border: 1px solid transparent;
}

.ghost-link:hover,
.ghost-link:focus-visible {
  transform: translateY(-1px);
  background: color-mix(in srgb, var(--glass-bg) 84%, transparent);
  border-color: color-mix(in srgb, var(--glass-border) 100%, transparent);
}

.ghost-link:active {
  transform: translateY(0) scale(0.97);
}

.accent-link {
  background: var(--accent-teal);
  color: var(--bg-primary);
  box-shadow: var(--shadow-sm);
}

.accent-link:hover,
.accent-link:focus-visible {
  background: var(--accent-teal-hover);
  box-shadow: var(--shadow-sm);
  outline: none;
  transform: translateY(-1px);
}

.accent-link:active {
  transform: translateY(0) scale(0.97);
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-0.35rem);
}

.navbar__mobile-toggle {
  grid-area: mobile;
  justify-self: end;
  display: none;
  width: 2.85rem;
  height: 2.85rem;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--glass-bg) 90%, transparent);
  color: var(--text-primary);
  align-items: center;
  justify-content: center;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--text-primary) 10%, transparent),
    0 1rem 2rem color-mix(in srgb, var(--bg-primary) 18%, transparent);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast),
    color var(--transition-fast);
}

.navbar__mobile-toggle:hover,
.navbar__mobile-toggle:focus-visible,
.navbar--mobile-open .navbar__mobile-toggle {
  outline: none;
  transform: translateY(var(--motion-button-lift));
  border-color: color-mix(in srgb, var(--accent-teal) 38%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal-light) 62%, transparent);
  box-shadow:
    var(--shadow-md),
    0 0 0 1px color-mix(in srgb, var(--accent-teal) 16%, transparent);
}

.navbar__mobile-toggle:active {
  transform: translateY(0) scale(var(--motion-press-scale));
}

.navbar__mobile-toggle :deep(.scope-icon),
.navbar__mobile-close :deep(.scope-icon) {
  width: 1.1rem;
  height: 1.1rem;
}

.navbar__mobile-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-sidebar);
  display: flex;
  justify-content: flex-end;
  padding:
    calc(env(safe-area-inset-top, 0px) + 4.85rem)
    max(var(--space-4), env(safe-area-inset-right, 0px))
    max(var(--space-4), env(safe-area-inset-bottom, 0px))
    max(var(--space-4), env(safe-area-inset-left, 0px));
  background: color-mix(in srgb, var(--bg-primary) 42%, transparent);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.navbar__mobile-drawer {
  position: relative;
  width: min(24rem, 100%);
  max-height: 100%;
  display: grid;
  gap: var(--space-4);
  padding: var(--space-5);
  overflow: auto;
  overscroll-behavior: contain;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--glass-bg) 98%, transparent) 0%,
      color-mix(in srgb, var(--bg-secondary) 96%, transparent) 100%
    );
  box-shadow:
    var(--shadow-lg),
    0 1.5rem 3rem color-mix(in srgb, var(--bg-primary) 36%, transparent);
}

.navbar__mobile-drawer::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent-teal) 18%, transparent), transparent 44%),
    linear-gradient(160deg, color-mix(in srgb, var(--text-primary) 8%, transparent), transparent 38%);
  pointer-events: none;
}

.navbar__mobile-drawer > * {
  position: relative;
  z-index: 1;
}

.navbar__mobile-drawer:focus-visible {
  outline: 2px solid var(--input-focus);
  outline-offset: 4px;
}

.navbar__mobile-header {
  display: grid;
  gap: var(--space-2);
}

.navbar__mobile-eyebrow {
  margin: 0;
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-eyebrow);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}

.navbar__mobile-title-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-3);
  align-items: start;
}

.navbar__mobile-title-copy {
  display: grid;
  gap: var(--space-2);
}

.navbar__mobile-title-copy h2,
.navbar__mobile-title-copy p,
.navbar__mobile-account-copy strong,
.navbar__mobile-account-copy p,
.navbar__mobile-link-copy strong,
.navbar__mobile-link-copy small {
  margin: 0;
}

.navbar__mobile-title-copy h2 {
  font-size: clamp(1.4rem, 5vw, 1.85rem);
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-display);
}

.navbar__mobile-title-copy p,
.navbar__mobile-account-copy p,
.navbar__mobile-link-copy small {
  color: var(--text-secondary);
}

.navbar__mobile-close {
  width: 2.5rem;
  height: 2.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--glass-border) 100%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--glass-bg) 88%, transparent);
  color: var(--text-primary);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.navbar__mobile-close:hover,
.navbar__mobile-close:focus-visible {
  outline: none;
  transform: translateY(var(--motion-button-lift));
  border-color: color-mix(in srgb, var(--accent-teal) 32%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal-light) 62%, transparent);
  box-shadow: var(--shadow-sm);
}

.navbar__mobile-account {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  background:
    linear-gradient(
      145deg,
      color-mix(in srgb, var(--accent-teal-light) 72%, transparent),
      color-mix(in srgb, var(--glass-bg) 84%, transparent)
    );
}

.navbar__mobile-account--guest {
  grid-template-columns: minmax(0, 1fr);
}

.navbar__mobile-account-copy {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
}

.navbar__mobile-account-copy strong {
  color: var(--text-primary);
  font-size: 1rem;
}

.navbar__mobile-account-chip {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.75rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal-light) 88%, transparent);
  color: var(--accent-teal);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.navbar__mobile-search {
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--text-primary) 10%, transparent),
    0 1rem 2rem color-mix(in srgb, var(--bg-primary) 12%, transparent);
}

.navbar__mobile-nav {
  display: grid;
  gap: var(--space-3);
}

.navbar__mobile-link {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--space-3);
  align-items: center;
  min-height: 4.5rem;
  padding: 0.95rem 1rem;
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--glass-border) 95%, transparent);
  background: color-mix(in srgb, var(--bg-secondary) 94%, transparent);
  color: var(--text-primary);
  text-decoration: none;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast),
    color var(--transition-fast);
}

.navbar__mobile-link:hover,
.navbar__mobile-link:focus-visible,
.navbar__mobile-link.router-link-active {
  outline: none;
  transform: translateY(var(--motion-button-lift));
  border-color: color-mix(in srgb, var(--accent-teal) 32%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal-light) 58%, transparent);
  box-shadow: 0 1rem 2rem color-mix(in srgb, var(--accent-teal) 12%, transparent);
}

.navbar__mobile-link:active {
  transform: translateY(0) scale(var(--motion-press-scale));
}

.navbar__mobile-link-icon {
  width: 2.75rem;
  height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--glass-bg) 92%, transparent);
  color: var(--accent-teal);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text-primary) 8%, transparent);
}

.navbar__mobile-link-icon :deep(.scope-icon) {
  width: 1.1rem;
  height: 1.1rem;
}

.navbar__mobile-link-copy {
  min-width: 0;
  display: grid;
  gap: 0.2rem;
}

.navbar__mobile-link-copy strong {
  font-size: 0.98rem;
}

.navbar__mobile-link-arrow {
  width: 1rem;
  height: 1rem;
  color: var(--text-secondary);
}

.navbar__mobile-footer {
  display: grid;
  gap: var(--space-3);
  padding-top: var(--space-2);
}

.navbar__mobile-secondary,
.navbar__mobile-primary {
  width: 100%;
  min-height: 3rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 0.85rem 1rem;
  border-radius: var(--radius-full);
  border: 1px solid transparent;
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  text-decoration: none;
  transition:
    transform var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    color var(--transition-fast);
}

.navbar__mobile-secondary {
  background: color-mix(in srgb, var(--glass-bg) 92%, transparent);
  border-color: color-mix(in srgb, var(--glass-border) 100%, transparent);
  color: var(--text-primary);
}

.navbar__mobile-primary {
  background: var(--accent-teal);
  color: var(--bg-primary);
  box-shadow: var(--shadow-sm);
}

.navbar__mobile-secondary:hover,
.navbar__mobile-secondary:focus-visible,
.navbar__mobile-primary:hover,
.navbar__mobile-primary:focus-visible {
  outline: none;
  transform: translateY(var(--motion-button-lift));
}

.navbar__mobile-secondary:hover,
.navbar__mobile-secondary:focus-visible {
  border-color: color-mix(in srgb, var(--accent-teal) 32%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal-light) 58%, transparent);
  box-shadow: var(--shadow-sm);
}

.navbar__mobile-primary:hover,
.navbar__mobile-primary:focus-visible {
  background: var(--accent-teal-hover);
  box-shadow: var(--shadow-sm);
}

.navbar__mobile-secondary:active,
.navbar__mobile-primary:active {
  transform: translateY(0) scale(var(--motion-press-scale));
}

.navbar__mobile-guest-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.navbar-mobile-backdrop-enter-active,
.navbar-mobile-backdrop-leave-active {
  transition: opacity var(--transition-normal);
}

.navbar-mobile-backdrop-enter-active .navbar__mobile-drawer,
.navbar-mobile-backdrop-leave-active .navbar__mobile-drawer {
  transition: opacity var(--transition-normal), transform var(--transition-normal);
}

.navbar-mobile-backdrop-enter-from,
.navbar-mobile-backdrop-leave-to {
  opacity: 0;
}

.navbar-mobile-backdrop-enter-from .navbar__mobile-drawer,
.navbar-mobile-backdrop-leave-to .navbar__mobile-drawer {
  opacity: 0;
  transform: translateX(1.25rem);
}

@media (prefers-reduced-motion: no-preference) {
  .create-spot-link[data-onboarding-active='true'] {
    animation: navbar-create-spot-pulse 1.8s ease-in-out infinite;
  }
}

@media (max-width: 1440px) {
  .navbar {
    --navbar-edge-padding: 1rem;
  }

  .navbar__inner {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: 'leading actions';
    gap: var(--space-3);
  }

  .nav-links {
    justify-content: flex-start;
  }

  .navbar-search {
    min-width: 16rem;
    max-width: 22rem;
  }

  .actions {
    gap: var(--space-2);
  }

  .actions :deep(.notification-toggle) {
    width: 2.75rem;
    min-height: 2.75rem;
    padding: 0.72rem;
    justify-content: center;
    gap: 0;
  }

  .actions :deep(.notification-toggle__label) {
    display: none;
  }
}

@media (max-width: 1280px) {
  .profile-chip {
    padding-right: 0.42rem;
  }

  .profile-chip__copy,
  .profile-chip__chevron {
    display: none;
  }
}

@media (max-width: 1024px) {
  .navbar {
    --navbar-edge-padding: var(--shell-side-padding);
  }

  .navbar {
    padding-top: calc(var(--safe-area-top) + 0.75rem);
  }

  .navbar__inner {
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    grid-template-areas: 'leading leading actions mobile';
    row-gap: 0;
  }

  .nav-links,
  .quick-search-shell--desktop,
  .navbar-search,
  .menu-shell,
  .profile-chip,
  .guest-actions {
    display: none;
  }

  .actions {
    width: auto;
    justify-content: flex-end;
    gap: var(--space-2);
  }

  .create-spot-link {
    min-height: 2.75rem;
    padding: 0.38rem 0.72rem 0.38rem 0.42rem;
  }

  .create-spot-link__icon-shell {
    width: 1.8rem;
    height: 1.8rem;
  }

  .create-spot-link__copy {
    font-size: 0.88rem;
  }

  .actions :deep(.notification-toggle) {
    width: 2.75rem;
    min-height: 2.75rem;
    padding: 0.72rem;
    justify-content: center;
    gap: 0;
  }

  .actions :deep(.notification-toggle__label) {
    display: none;
  }

  .actions :deep(.notification-menu) {
    right: 0;
    width: min(22rem, calc(100vw - (var(--space-4) * 2)));
  }

  .navbar__mobile-toggle {
    display: inline-flex;
  }
}

@media (max-width: 640px) {
  .brand__text {
    font-size: clamp(1.12rem, 5vw, 1.3rem);
  }

  .navbar__inner {
    gap: var(--space-3);
  }

  .create-spot-link {
    padding-right: 0.72rem;
  }

  .create-spot-link__copy-extended {
    display: none;
  }

  .actions :deep(.notification-menu) {
    right: calc(-1 * var(--space-2));
    width: min(20rem, calc(100vw - (var(--space-4) * 2)));
  }

  .navbar__mobile-overlay {
    padding:
      calc(env(safe-area-inset-top, 0px) + 4.4rem)
      max(var(--space-3), env(safe-area-inset-right, 0px))
      max(var(--space-3), env(safe-area-inset-bottom, 0px))
      max(var(--space-3), env(safe-area-inset-left, 0px));
  }

  .navbar__mobile-drawer {
    width: 100%;
    padding: var(--space-4);
    gap: var(--space-3);
  }

  .navbar__mobile-guest-actions {
    grid-template-columns: minmax(0, 1fr);
  }
}

@keyframes navbar-create-spot-pulse {
  0%,
  100% {
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--accent-gold) 14%, transparent),
      inset 0 1px 0 color-mix(in srgb, var(--text-primary) 24%, transparent);
  }

  50% {
    box-shadow:
      0 0 0 1px color-mix(in srgb, var(--accent-gold) 24%, transparent),
      inset 0 1px 0 color-mix(in srgb, var(--text-primary) 24%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .navbar,
  .navbar::after,
  .navbar__inner,
  .nav-links a,
  .create-spot-link,
  .profile-chip,
  .menu-dropdown a,
  .menu-dropdown button,
  .ghost-link,
  .accent-link,
  .dropdown-fade-enter-active,
  .dropdown-fade-leave-active,
  .navbar__mobile-toggle,
  .navbar__mobile-close,
  .navbar__mobile-link,
  .navbar__mobile-secondary,
  .navbar__mobile-primary,
  .navbar-mobile-backdrop-enter-active,
  .navbar-mobile-backdrop-leave-active,
  .navbar-mobile-backdrop-enter-active .navbar__mobile-drawer,
  .navbar-mobile-backdrop-leave-active .navbar__mobile-drawer {
    transition-duration: 1ms;
  }

  .nav-links a:hover,
  .nav-links a:focus-visible,
  .create-spot-link:hover,
  .create-spot-link:focus-visible,
  .create-spot-link:active,
  .create-spot-link.router-link-active,
  .create-spot-link[data-onboarding-active='true'],
  .profile-chip:hover,
  .profile-chip:focus-visible,
  .profile-chip[aria-expanded='true'],
  .profile-chip:active,
  .menu-dropdown a:hover,
  .menu-dropdown a:focus-visible,
  .menu-dropdown a:active,
  .menu-dropdown button:hover,
  .menu-dropdown button:focus-visible,
  .menu-dropdown button:active,
  .ghost-link:hover,
  .ghost-link:focus-visible,
  .ghost-link:active,
  .accent-link:hover,
  .accent-link:focus-visible,
  .accent-link:active,
  .navbar--scrolled .navbar__inner,
  .navbar__mobile-toggle:hover,
  .navbar__mobile-toggle:focus-visible,
  .navbar__mobile-toggle:active,
  .navbar__mobile-close:hover,
  .navbar__mobile-close:focus-visible,
  .navbar__mobile-link:hover,
  .navbar__mobile-link:focus-visible,
  .navbar__mobile-link:active,
  .navbar__mobile-secondary:hover,
  .navbar__mobile-secondary:focus-visible,
  .navbar__mobile-secondary:active,
  .navbar__mobile-primary:hover,
  .navbar__mobile-primary:focus-visible,
  .navbar__mobile-primary:active {
    transform: none;
  }

  .dropdown-fade-enter-from,
  .dropdown-fade-leave-to,
  .profile-chip[aria-expanded='true'] .profile-chip__chevron,
  .navbar-mobile-backdrop-enter-from .navbar__mobile-drawer,
  .navbar-mobile-backdrop-leave-to .navbar__mobile-drawer {
    transform: none;
  }
}

</style>
