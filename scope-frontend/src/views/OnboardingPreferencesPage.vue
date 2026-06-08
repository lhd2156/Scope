<template>
  <section class="onboarding-page" aria-labelledby="onboarding-title">
    <div class="onboarding-shell">
      <header class="onboarding-header">
        <p class="eyebrow">Personalize Scope</p>
        <h1 id="onboarding-title">What do you want to find on Scope?</h1>
        <p class="section-copy">
          Pick a few vibes that match how you like to travel. We'll surface spots, trips, and friend
          suggestions that lean toward those tastes. You can change these anytime in settings.
        </p>
      </header>

      <p v-if="formError" class="onboarding-error" role="alert">{{ formError }}</p>

      <fieldset class="preferences-grid" aria-describedby="onboarding-title">
        <legend class="sr-only">Select your interests</legend>
        <button
          v-for="option in interestOptions"
          :key="option.value"
          type="button"
          class="preference-chip"
          :class="{ 'preference-chip--active': selectedInterests.includes(option.value) }"
          :aria-pressed="selectedInterests.includes(option.value)"
          @click="toggleInterest(option.value)"
        >
          <span class="preference-chip__icon" aria-hidden="true">
            <ScopeIcon :name="option.icon" label="" />
          </span>
          <span class="preference-chip__body">
            <span class="preference-chip__label">{{ option.label }}</span>
            <span class="preference-chip__description">{{ option.description }}</span>
          </span>
          <span class="preference-chip__check" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="5 12 10 17 19 7" />
            </svg>
          </span>
        </button>
      </fieldset>

      <div class="onboarding-meta">
        <p class="onboarding-meta__helper">
          {{ selectionHelperCopy }}
        </p>
      </div>

      <section class="home-base-panel" aria-labelledby="home-base-title">
        <div class="home-base-panel__identity">
          <div
            class="home-base-panel__signal"
            :class="{ 'is-selected': hasSelectedHomeBase }"
            aria-hidden="true"
          >
            <span class="home-base-ping">
              <span class="home-base-ping__ring"></span>
              <ScopeIcon name="pin" label="" />
            </span>
          </div>

          <div class="home-base-panel__copy">
            <p class="eyebrow">Optional</p>
            <h2 id="home-base-title">Set your preferred location</h2>
            <p>Search a city, neighborhood, or address for local suggestions.</p>
          </div>
        </div>

        <div class="home-base-field">
          <div class="home-base-field__header">
            <label class="home-base-field__label" for="home-base-input">Preferred location</label>
            <button
              v-if="homeBase.trim()"
              type="button"
              class="home-base-field__clear"
              @click="clearHomeBase"
            >
              Clear
            </button>
          </div>
          <div
            class="home-base-combobox"
            :class="{
              'is-open': showHomeBaseSuggestions,
              'is-selected': hasSelectedHomeBase,
            }"
          >
            <ScopeIcon class="home-base-combobox__icon" name="search" label="" />
            <input
              id="home-base-input"
              v-model="homeBase"
              type="text"
              autocomplete="street-address"
              maxlength="120"
              placeholder="City, neighborhood, or address"
              role="combobox"
              aria-autocomplete="list"
              :aria-expanded="showHomeBaseSuggestions"
              :aria-controls="homeBaseSuggestionsId"
              :aria-activedescendant="activeHomeBaseOptionId"
              @focus="handleHomeBaseFocus"
              @blur="handleHomeBaseBlur"
              @keydown="handleHomeBaseKeydown"
            />
            <span
              v-if="showHomeBaseStatus"
              class="home-base-combobox__status"
              :class="`state-${homeBaseSearchState}`"
            >
              {{ homeBaseStatusCopy }}
            </span>
          </div>

          <Transition name="home-base-suggestions">
            <div
              v-if="showHomeBaseSuggestions"
              :id="homeBaseSuggestionsId"
              class="home-base-suggestions"
              role="listbox"
              aria-label="Preferred location suggestions"
            >
              <p v-if="homeBaseSearchState === 'loading'" class="home-base-suggestions__message">
                Finding the best matches...
              </p>
              <p v-else-if="homeBaseSearchState === 'empty'" class="home-base-suggestions__message">
                No clean matches yet. Try a city, ZIP code, or nearby street.
              </p>
              <p v-else-if="homeBaseSearchState === 'error'" class="home-base-suggestions__message">
                Suggestions are not available right now. You can still type your location.
              </p>

              <button
                v-for="(suggestion, index) in homeBaseSuggestions"
                :id="getHomeBaseOptionId(index)"
                :key="`${suggestion.id || suggestion.formattedAddress || suggestion.placeName}-${index}`"
                type="button"
                class="home-base-suggestion"
                :class="{ 'is-active': index === activeHomeBaseIndex }"
                role="option"
                :aria-selected="index === activeHomeBaseIndex"
                @mousedown.prevent
                @click="selectHomeBaseSuggestion(suggestion)"
              >
                <span class="home-base-suggestion__pin" aria-hidden="true">
                  <ScopeIcon name="pin" label="" />
                </span>
                <span class="home-base-suggestion__copy">
                  <span class="home-base-suggestion__name">{{ getHomeBaseSuggestionName(suggestion) }}</span>
                  <span class="home-base-suggestion__meta">{{ getHomeBaseSuggestionMeta(suggestion) }}</span>
                </span>
                <span class="home-base-suggestion__type">
                  {{ getHomeBaseSuggestionType(suggestion) }}
                </span>
              </button>
            </div>
          </Transition>

          <p class="home-base-field__helper">
            {{ homeBaseHelperCopy }}
          </p>
        </div>
      </section>

      <section class="profile-photo-panel" aria-labelledby="profile-photo-title">
        <div class="profile-photo-panel__identity">
          <Avatar
            class="profile-photo-panel__avatar"
            :name="profileDisplayName"
            :src="profilePhotoPreview || undefined"
            :size="64"
          />
          <div>
            <p class="eyebrow">Optional</p>
            <h2 id="profile-photo-title">Profile photo</h2>
            <p>Keep the default person icon or choose your own image.</p>
          </div>
        </div>

        <div class="profile-photo-panel__actions">
          <label class="photo-picker-button" for="profile-photo-input">
            <ScopeIcon name="camera" label="" />
            <span>Choose photo</span>
          </label>
          <button
            type="button"
            class="photo-clear-button"
            :class="{ 'is-hidden': !profilePhotoPreview }"
            :aria-hidden="!profilePhotoPreview"
            :tabindex="profilePhotoPreview ? 0 : -1"
            @click="clearProfilePhoto"
          >
            Remove
          </button>
          <input
            id="profile-photo-input"
            class="sr-only"
            type="file"
            :accept="PROFILE_PHOTO_ACCEPT"
            @change="handleProfilePhotoSelection"
          />
        </div>
      </section>

      <footer class="onboarding-actions">
        <Button variant="secondary" type="button" :disabled="isSubmitting" @click="skip">
          Skip for now
        </Button>
        <Button
          variant="primary"
          type="button"
          :loading="isSubmitting"
          :disabled="isSubmitting"
          @click="submit"
        >
          Continue to Scope
        </Button>
      </footer>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Avatar from '@/components/common/Avatar.vue';
import Button from '@/components/common/Button.vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import { searchLocations, type PlaceSearchResult } from '@/services/mapService';
import { formatHomeBaseLocation } from '@/utils/formatters';
import { useAuthStore } from '@/stores/auth';
import { useUserStore } from '@/stores/user';
import type { SpotCategory } from '@/types';
import { sanitizeInternalRouteTarget } from '@/utils/navigationSafety';
import { sanitizeAvatarUrl } from '@/utils/sanitizers';
import { normalizeUserVibes } from '@/utils/userPreferenceSignals';

interface InterestOption {
  value: SpotCategory;
  label: string;
  icon: string;
  description: string;
}

/*
 * The option list is intentionally copy-forward: each description reads
 * like a Spotify taste profile so the picker feels like personalization,
 * not a taxonomy drill. Keep SpotCategory values in sync with the type
 * defined in @/types so the preferences map straight onto recommendation
 * signals on the backend.
 */
const interestOptions: InterestOption[] = [
  { value: 'food', label: 'Food & drink', icon: 'food', description: 'Kitchens, bars, street food.' },
  { value: 'nature', label: 'Nature escapes', icon: 'nature', description: 'Trails, views, campsites.' },
  { value: 'culture', label: 'Culture & arts', icon: 'culture', description: 'Galleries, concerts, history.' },
  { value: 'nightlife', label: 'Nightlife', icon: 'nightlife', description: 'Lounges, live sets, late-night.' },
  { value: 'adventure', label: 'Adventure', icon: 'adventure', description: 'Climbing, paddling, off-map.' },
  { value: 'entertainment', label: 'Entertainment', icon: 'entertainment', description: 'Bowling, theme parks, games.' },
  { value: 'scenic', label: 'Scenic routes', icon: 'scenic', description: 'Views, drives, slow moments.' },
  { value: 'shopping', label: 'Shopping & makers', icon: 'shopping', description: 'Designers, vintage, markets.' },
  { value: 'other', label: 'Surprise me', icon: 'sparkle', description: 'Let Scope mix it up.' },
];

const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;
const PROFILE_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
const HOME_BASE_SEARCH_MIN_LENGTH = 2;
const HOME_BASE_SEARCH_DEBOUNCE_MS = 240;
const HOME_BASE_SEARCH_TYPES = 'address,street,place,city,locality,neighborhood,postcode';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const userStore = useUserStore();

const selectedInterests = ref<SpotCategory[]>(normalizeUserVibes(authStore.currentUser?.interests));
const homeBase = ref(authStore.currentUser?.homeBase ?? '');
const profilePhotoUrl = ref(sanitizeAvatarUrl(authStore.currentUser?.avatarUrl) ?? '');
const selectedProfilePhotoObjectUrl = ref('');
const isSubmitting = ref(false);
const formError = ref('');
const homeBaseSuggestions = ref<PlaceSearchResult[]>([]);
const homeBaseSearchState = ref<'idle' | 'typing' | 'loading' | 'ready' | 'empty' | 'error' | 'selected'>('idle');
const homeBaseFieldFocused = ref(false);
const activeHomeBaseIndex = ref(-1);
const selectedHomeBaseLabel = ref(homeBase.value.trim());
let shouldRetainProfilePhotoObjectUrl = false;
let homeBaseSearchTimer: ReturnType<typeof setTimeout> | null = null;
let homeBaseSearchRequestId = 0;

const profileDisplayName = computed(() => authStore.currentUser?.displayName || 'Scope traveler');
const profilePhotoPreview = computed(() => sanitizeAvatarUrl(profilePhotoUrl.value) ?? '');
const homeBaseSuggestionsId = 'home-base-suggestions';
const hasSelectedHomeBase = computed(() => Boolean(selectedHomeBaseLabel.value && homeBase.value.trim()));
const showHomeBaseSuggestions = computed(() => {
  if (!homeBaseFieldFocused.value || homeBase.value.trim().length < HOME_BASE_SEARCH_MIN_LENGTH) {
    return false;
  }

  return homeBaseSuggestions.value.length > 0 ||
    homeBaseSearchState.value === 'loading' ||
    homeBaseSearchState.value === 'empty' ||
    homeBaseSearchState.value === 'error';
});
const activeHomeBaseOptionId = computed(() => (
  activeHomeBaseIndex.value >= 0 ? getHomeBaseOptionId(activeHomeBaseIndex.value) : undefined
));
const showHomeBaseStatus = computed(() => (
  homeBaseSearchState.value === 'loading' ||
  homeBaseSearchState.value === 'ready' ||
  homeBaseSearchState.value === 'empty' ||
  homeBaseSearchState.value === 'error'
));

const homeBaseStatusCopy = computed(() => {
  if (homeBaseSearchState.value === 'loading') return 'Searching';
  if (homeBaseSearchState.value === 'ready') return `${homeBaseSuggestions.value.length} matches`;
  if (homeBaseSearchState.value === 'empty') return 'No matches';
  if (homeBaseSearchState.value === 'error') return 'Manual entry';
  return '';
});

const homeBaseHelperCopy = computed(() => {
  if (hasSelectedHomeBase.value) return 'Saved for local suggestions.';
  if (homeBaseSearchState.value === 'ready') return 'Choose the closest match.';
  if (homeBaseSearchState.value === 'loading') return 'Finding matches.';
  if (homeBase.value.trim()) return 'Pick a suggestion or keep typing.';
  return 'Start typing to find the best match.';
});

const selectionHelperCopy = computed(() => {
  const count = selectedInterests.value.length;
  if (count === 0) return 'Optional. Smart defaults if skipped.';
  if (count === 1) return 'Optional. 1 vibe selected.';
  return `Optional. ${count} vibes selected.`;
});

function toggleInterest(value: SpotCategory) {
  const index = selectedInterests.value.indexOf(value);
  formError.value = '';

  if (index >= 0) {
    selectedInterests.value.splice(index, 1);
    return;
  }

  selectedInterests.value.push(value);
}

function clearHomeBase() {
  homeBase.value = '';
  selectedHomeBaseLabel.value = '';
  homeBaseSearchRequestId += 1;
  resetHomeBaseSuggestions('idle');
  formError.value = '';
}

function clearHomeBaseSearchTimer() {
  if (homeBaseSearchTimer) {
    clearTimeout(homeBaseSearchTimer);
    homeBaseSearchTimer = null;
  }
}

function resetHomeBaseSuggestions(state: typeof homeBaseSearchState.value = 'idle') {
  clearHomeBaseSearchTimer();
  homeBaseSuggestions.value = [];
  activeHomeBaseIndex.value = -1;
  homeBaseSearchState.value = state;
}

function getHomeBaseOptionId(index: number): string {
  return `${homeBaseSuggestionsId}-option-${index}`;
}

function getHomeBaseSuggestionName(suggestion: PlaceSearchResult): string {
  return suggestion.placeName || suggestion.address || suggestion.formattedAddress || 'Location match';
}

function getHomeBaseSuggestionMeta(suggestion: PlaceSearchResult): string {
  const formattedAddress = suggestion.formattedAddress?.trim();
  const primaryName = getHomeBaseSuggestionName(suggestion).trim();
  if (formattedAddress && formattedAddress.toLowerCase() !== primaryName.toLowerCase()) {
    return formattedAddress;
  }

  return [suggestion.city, suggestion.country].filter(Boolean).join(', ') || 'Verified location';
}

function getHomeBaseSuggestionType(suggestion: PlaceSearchResult): string {
  const precision = (suggestion.precision ?? '').toLowerCase();
  if (precision.includes('address') || precision.includes('street')) return 'Address';
  if (precision.includes('neighborhood')) return 'Area';
  if (precision.includes('postcode')) return 'ZIP';
  if (precision.includes('place') || precision.includes('city') || precision.includes('locality')) return 'City';
  return 'Place';
}

function formatHomeBaseSuggestionLabel(suggestion: PlaceSearchResult): string {
  return formatHomeBaseLocation(suggestion);
}

function dedupeHomeBaseSuggestions(suggestions: PlaceSearchResult[]): PlaceSearchResult[] {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    const visibleLabel = (suggestion.formattedAddress || suggestion.placeName || suggestion.address || '').trim();
    if (!visibleLabel) {
      return false;
    }

    const identity = (
      suggestion.formattedAddress ||
      suggestion.providerPlaceId ||
      suggestion.id ||
      [suggestion.placeName, suggestion.latitude, suggestion.longitude].filter((value) => value !== undefined).join('|')
    ).trim().toLowerCase();
    if (!identity || seen.has(identity)) {
      return false;
    }

    seen.add(identity);
    return true;
  });
}

async function loadHomeBaseSuggestions(query: string) {
  const requestId = ++homeBaseSearchRequestId;
  homeBaseSearchState.value = 'loading';

  try {
    const { data } = await searchLocations(query, {
      limit: 6,
      preferPoi: false,
      sortByDistance: false,
      types: HOME_BASE_SEARCH_TYPES,
    });

    if (requestId !== homeBaseSearchRequestId || query !== homeBase.value.trim()) {
      return;
    }

    homeBaseSuggestions.value = dedupeHomeBaseSuggestions(data);
    activeHomeBaseIndex.value = homeBaseSuggestions.value.length ? 0 : -1;
    homeBaseSearchState.value = homeBaseSuggestions.value.length ? 'ready' : 'empty';
  } catch {
    if (requestId !== homeBaseSearchRequestId) {
      return;
    }

    homeBaseSuggestions.value = [];
    activeHomeBaseIndex.value = -1;
    homeBaseSearchState.value = 'error';
  }
}

function handleHomeBaseFocus() {
  homeBaseFieldFocused.value = true;
}

function handleHomeBaseBlur() {
  window.setTimeout(() => {
    homeBaseFieldFocused.value = false;
    activeHomeBaseIndex.value = -1;
  }, 120);
}

function selectHomeBaseSuggestion(suggestion: PlaceSearchResult) {
  const label = formatHomeBaseSuggestionLabel(suggestion);
  if (!label) {
    return;
  }

  homeBase.value = label;
  selectedHomeBaseLabel.value = label;
  homeBaseSuggestions.value = [];
  activeHomeBaseIndex.value = -1;
  homeBaseSearchState.value = 'selected';
}

function moveHomeBaseSelection(delta: number) {
  if (!homeBaseSuggestions.value.length) {
    return;
  }

  const nextIndex = activeHomeBaseIndex.value < 0
    ? 0
    : (activeHomeBaseIndex.value + delta + homeBaseSuggestions.value.length) % homeBaseSuggestions.value.length;
  activeHomeBaseIndex.value = nextIndex;
}

function handleHomeBaseKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    homeBaseFieldFocused.value = true;
    moveHomeBaseSelection(1);
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    homeBaseFieldFocused.value = true;
    moveHomeBaseSelection(-1);
    return;
  }

  if (event.key === 'Enter' && activeHomeBaseIndex.value >= 0) {
    event.preventDefault();
    const suggestion = homeBaseSuggestions.value[activeHomeBaseIndex.value];
    if (suggestion) {
      selectHomeBaseSuggestion(suggestion);
    }
    return;
  }

  if (event.key === 'Escape') {
    resetHomeBaseSuggestions(homeBase.value.trim() ? 'typing' : 'idle');
    homeBaseFieldFocused.value = false;
  }
}

function validateProfilePhotoFile(file: File): string {
  if (!PROFILE_PHOTO_ACCEPT.split(',').includes(file.type)) {
    return 'Choose a JPG, PNG, WebP, or GIF profile photo.';
  }

  if (file.size > MAX_PROFILE_PHOTO_BYTES) {
    return 'Profile photo must be 5 MB or smaller.';
  }

  return '';
}

function revokeSelectedProfilePhotoUrl() {
  if (
    selectedProfilePhotoObjectUrl.value &&
    !shouldRetainProfilePhotoObjectUrl &&
    typeof URL.revokeObjectURL === 'function'
  ) {
    URL.revokeObjectURL(selectedProfilePhotoObjectUrl.value);
  }

  selectedProfilePhotoObjectUrl.value = '';
  shouldRetainProfilePhotoObjectUrl = false;
}

function clearProfilePhoto() {
  shouldRetainProfilePhotoObjectUrl = false;
  revokeSelectedProfilePhotoUrl();
  profilePhotoUrl.value = '';
  formError.value = '';
}

function handleProfilePhotoSelection(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) {
    return;
  }

  const validationError = validateProfilePhotoFile(file);
  if (validationError) {
    formError.value = validationError;
    input.value = '';
    return;
  }

  if (typeof URL.createObjectURL !== 'function') {
    formError.value = 'Scope could not preview that profile photo in this browser.';
    input.value = '';
    return;
  }

  const objectUrl = URL.createObjectURL(file);
  revokeSelectedProfilePhotoUrl();
  selectedProfilePhotoObjectUrl.value = objectUrl;
  profilePhotoUrl.value = objectUrl;
  formError.value = '';
  input.value = '';
}

function buildPreferenceUpdate() {
  shouldRetainProfilePhotoObjectUrl = Boolean(
    selectedProfilePhotoObjectUrl.value &&
    profilePhotoPreview.value === selectedProfilePhotoObjectUrl.value,
  );

  return {
    interests: [...selectedInterests.value],
    homeBase: homeBase.value.trim() || undefined,
    avatarUrl: profilePhotoPreview.value || undefined,
  };
}

async function persistPreferenceUpdate() {
  const update = buildPreferenceUpdate();
  authStore.updateCurrentUser(update);

  if (!authStore.currentUser?.id) {
    return;
  }

  await userStore.saveProfile(update, authStore.currentUser.id);
}

function resolveRedirectTarget(): string {
  return sanitizeInternalRouteTarget(route.query.redirect, '/');
}

async function submit() {
  isSubmitting.value = true;
  formError.value = '';

  try {
    await persistPreferenceUpdate();
    await router.push(resolveRedirectTarget());
  } catch {
    formError.value = 'Scope could not save your preferences. Try once more in a moment.';
  } finally {
    isSubmitting.value = false;
  }
}

async function skip() {
  // We still persist whatever is currently checked so accidental skips
  // don't overwrite a good selection, but we do not invent a location.
  isSubmitting.value = true;
  formError.value = '';

  try {
    await persistPreferenceUpdate();
    await router.push(resolveRedirectTarget());
  } catch {
    formError.value = 'Scope could not save your preferences. Try once more in a moment.';
  } finally {
    isSubmitting.value = false;
  }
}

onBeforeUnmount(() => {
  homeBaseSearchRequestId += 1;
  clearHomeBaseSearchTimer();
  revokeSelectedProfilePhotoUrl();
});

watch(homeBase, (nextHomeBase) => {
  const query = nextHomeBase.trim();
  if (query !== selectedHomeBaseLabel.value) {
    selectedHomeBaseLabel.value = '';
  }

  homeBaseSearchRequestId += 1;

  if (!query) {
    resetHomeBaseSuggestions('idle');
    return;
  }

  if (query.length < HOME_BASE_SEARCH_MIN_LENGTH) {
    resetHomeBaseSuggestions('typing');
    return;
  }

  if (query === selectedHomeBaseLabel.value) {
    resetHomeBaseSuggestions('selected');
    return;
  }

  clearHomeBaseSearchTimer();
  homeBaseSearchState.value = 'typing';
  homeBaseSuggestions.value = [];
  activeHomeBaseIndex.value = -1;
  homeBaseSearchTimer = setTimeout(() => {
    void loadHomeBaseSuggestions(query);
  }, HOME_BASE_SEARCH_DEBOUNCE_MS);
});
</script>

<style scoped>
.onboarding-page {
  min-height: 100dvh;
  padding: clamp(2rem, 5vw, 4rem) clamp(1rem, 4vw, 3rem);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.onboarding-shell {
  width: min(100%, 52rem);
  display: grid;
  gap: var(--space-6);
  padding: clamp(var(--space-6), 4vw, var(--space-8));
  border-radius: clamp(var(--radius-xl), 3vw, var(--radius-2xl));
  background: var(--bg-secondary);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 14%, var(--glass-border));
  box-shadow:
    var(--shadow-lg),
    0 0 0 1px color-mix(in srgb, var(--accent-teal) 8%, transparent);
}

.onboarding-header {
  display: grid;
  gap: var(--space-3);
}

.eyebrow {
  margin: 0;
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-eyebrow);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}

.onboarding-header h1 {
  margin: 0;
  font-size: clamp(1.75rem, 2.4vw + 0.6rem, var(--font-size-h1));
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-display);
}

.section-copy {
  color: var(--text-secondary);
  margin: 0;
}

.onboarding-error {
  margin: 0;
  padding: 0.9rem 1rem;
  border: 1px solid color-mix(in srgb, var(--danger) 48%, transparent);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--danger) 12%, transparent);
}

.preferences-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14.5rem, 1fr));
  gap: var(--space-3);
  padding: 0;
  margin: 0;
  border: 0;
}

.preference-chip {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: 1rem 1.1rem;
  text-align: left;
  border: 1px solid color-mix(in srgb, var(--glass-border) 90%, var(--border));
  border-radius: var(--radius-xl);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast);
}

.preference-chip:hover,
.preference-chip:focus-visible {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent-teal) 36%, var(--border));
  box-shadow: 0 0.75rem 1.5rem color-mix(in srgb, var(--bg-primary) 16%, transparent);
  outline: none;
}

.preference-chip--active {
  border-color: color-mix(in srgb, var(--accent-teal) 58%, var(--border));
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--bg-tertiary));
  box-shadow:
    0 0 0 0.12rem color-mix(in srgb, var(--accent-teal) 30%, transparent),
    0 0.75rem 1.5rem color-mix(in srgb, var(--bg-primary) 18%, transparent);
}

.preference-chip__icon {
  display: inline-grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-md);
  color: var(--accent-teal);
  background: color-mix(in srgb, var(--bg-primary) 48%, transparent);
}

.preference-chip__icon :deep(.scope-icon) {
  width: 1.2rem;
  height: 1.2rem;
}

.preference-chip--active .preference-chip__icon {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--accent-teal) 34%, var(--bg-primary));
}

.preference-chip__body {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}

.preference-chip__label {
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.005em;
}

.preference-chip__description {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  line-height: 1.35;
}

.preference-chip__check {
  display: inline-grid;
  place-items: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--glass-border) 80%, var(--border));
  color: transparent;
  transition:
    color var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.preference-chip__check svg {
  width: 0.9rem;
  height: 0.9rem;
}

.preference-chip--active .preference-chip__check {
  color: var(--text-primary);
  border-color: color-mix(in srgb, var(--accent-teal) 64%, transparent);
  background: color-mix(in srgb, var(--accent-teal) 88%, transparent);
}

.onboarding-meta__helper {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--font-size-small);
}

.home-base-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 22rem);
  gap: var(--space-4);
  align-items: center;
  padding: clamp(var(--space-4), 2.6vw, var(--space-5));
  border: 1px solid color-mix(in srgb, var(--glass-border) 86%, var(--border));
  border-radius: var(--radius-xl);
  background:
    radial-gradient(circle at 2.75rem 50%, color-mix(in srgb, var(--accent-teal) 16%, transparent), transparent 32%),
    color-mix(in srgb, var(--bg-tertiary) 76%, transparent);
}

.home-base-panel__identity {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.home-base-panel__signal {
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  color: var(--text-secondary);
}

.home-base-ping {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 4rem;
  height: 4rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 32%, var(--glass-border));
  background:
    radial-gradient(circle, color-mix(in srgb, var(--accent-teal) 20%, transparent), transparent 64%),
    color-mix(in srgb, var(--bg-primary) 62%, transparent);
  color: var(--accent-teal);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--text-primary) 8%, transparent),
    0 1rem 2rem color-mix(in srgb, var(--bg-primary) 18%, transparent);
}

.home-base-ping :deep(.scope-icon) {
  position: relative;
  z-index: 2;
  width: 1.6rem;
  height: 1.6rem;
}

.home-base-ping__ring {
  position: absolute;
  inset: 0.55rem;
  border-radius: inherit;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 58%, transparent);
  animation: home-base-pulse 1.9s ease-out infinite;
}

.home-base-panel__signal.is-selected .home-base-ping {
  color: var(--text-primary);
  border-color: color-mix(in srgb, var(--accent-teal) 64%, var(--glass-border));
  background:
    radial-gradient(circle, color-mix(in srgb, var(--accent-teal) 38%, transparent), transparent 66%),
    color-mix(in srgb, var(--accent-teal) 26%, var(--bg-primary));
}

.home-base-panel__copy {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
}

.home-base-panel__copy h2,
.home-base-panel__copy p {
  margin: 0;
}

.home-base-panel__copy h2 {
  font-size: var(--font-size-h3);
  line-height: var(--line-height-tight);
}

.home-base-panel__copy p:not(.eyebrow) {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  line-height: var(--line-height-normal);
}

.home-base-field {
  position: relative;
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.home-base-field__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-width: 0;
}

.home-base-field__label {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
}

.home-base-field__clear {
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: color-mix(in srgb, var(--accent-teal) 78%, var(--text-secondary));
  font: inherit;
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition:
    color var(--transition-fast),
    opacity var(--transition-fast);
}

.home-base-field__clear:hover,
.home-base-field__clear:focus-visible {
  color: var(--text-primary);
  outline: none;
}

.home-base-combobox {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 3rem;
  padding: 0 0.75rem 0 0.95rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 90%, var(--border));
  border-radius: var(--radius-lg);
  background: var(--bg-primary);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--text-primary) 4%, transparent);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    background var(--transition-fast);
}

.home-base-combobox.is-open,
.home-base-combobox:focus-within {
  border-color: color-mix(in srgb, var(--accent-teal) 64%, var(--border));
  box-shadow:
    0 0 0 0.18rem color-mix(in srgb, var(--accent-teal) 16%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--text-primary) 5%, transparent);
}

.home-base-combobox.is-selected {
  border-color: color-mix(in srgb, var(--accent-teal) 58%, var(--border));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent-teal) 7%, var(--bg-primary)), var(--bg-primary));
}

.home-base-combobox__icon {
  width: 1.15rem;
  height: 1.15rem;
  color: color-mix(in srgb, var(--accent-teal) 70%, var(--text-secondary));
}

.home-base-combobox input {
  width: 100%;
  min-width: 0;
  padding: 0.88rem 0;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-weight: var(--font-weight-regular);
}

.home-base-combobox input:focus {
  outline: none;
}

.home-base-combobox input::placeholder {
  color: var(--text-muted);
}

.home-base-combobox__status {
  justify-self: end;
  min-width: max-content;
  padding: 0.32rem 0.55rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 68%, transparent);
  color: var(--text-muted);
  background: color-mix(in srgb, var(--bg-secondary) 74%, transparent);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
  line-height: 1;
}

.home-base-combobox__status.state-ready {
  color: color-mix(in srgb, var(--accent-teal) 78%, var(--text-primary));
  border-color: color-mix(in srgb, var(--accent-teal) 35%, transparent);
  background: color-mix(in srgb, var(--accent-teal) 12%, transparent);
}

.home-base-combobox__status.state-loading {
  color: var(--text-secondary);
}

.home-base-combobox__status.state-error {
  color: color-mix(in srgb, var(--warning) 76%, var(--text-primary));
}

.home-base-suggestions {
  position: absolute;
  top: calc(100% - 1.1rem);
  left: 0;
  right: 0;
  z-index: 25;
  display: grid;
  gap: 0.35rem;
  max-height: min(19rem, calc(100dvh - 2rem));
  overflow-y: auto;
  padding: 0.55rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 26%, var(--glass-border));
  border-radius: var(--radius-lg);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 92%, transparent), color-mix(in srgb, var(--bg-primary) 96%, transparent));
  box-shadow:
    0 1.2rem 2.6rem color-mix(in srgb, var(--bg-primary) 42%, transparent),
    0 0 0 1px color-mix(in srgb, var(--accent-teal) 10%, transparent);
}

.home-base-suggestion {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    transform var(--transition-fast);
}

.home-base-suggestion:hover,
.home-base-suggestion:focus-visible,
.home-base-suggestion.is-active {
  border-color: color-mix(in srgb, var(--accent-teal) 32%, transparent);
  background: color-mix(in srgb, var(--accent-teal) 12%, transparent);
  outline: none;
}

.home-base-suggestion__pin {
  display: inline-grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-full);
  color: var(--accent-teal);
  background: color-mix(in srgb, var(--accent-teal) 12%, var(--bg-primary));
}

.home-base-suggestion__pin :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
}

.home-base-suggestion__copy {
  display: grid;
  gap: 0.12rem;
  min-width: 0;
}

.home-base-suggestion__name,
.home-base-suggestion__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-base-suggestion__name {
  font-weight: var(--font-weight-semibold);
}

.home-base-suggestion__meta {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.home-base-suggestion__type {
  padding: 0.28rem 0.5rem;
  border-radius: var(--radius-full);
  color: var(--text-muted);
  background: color-mix(in srgb, var(--bg-primary) 68%, transparent);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}

.home-base-suggestions__message,
.home-base-field__helper {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--font-size-small);
  line-height: var(--line-height-normal);
}

.home-base-suggestions__message {
  padding: 0.8rem;
}

.home-base-suggestions-enter-active,
.home-base-suggestions-leave-active {
  transition:
    opacity var(--transition-fast),
    transform var(--transition-fast);
}

.home-base-suggestions-enter-from,
.home-base-suggestions-leave-to {
  opacity: 0;
  transform: translateY(-0.35rem);
}

@keyframes home-base-pulse {
  0% {
    opacity: 0.9;
    transform: scale(0.72);
  }

  70% {
    opacity: 0;
    transform: scale(1.62);
  }

  100% {
    opacity: 0;
    transform: scale(1.62);
  }
}

.profile-photo-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: clamp(var(--space-4), 2.6vw, var(--space-5));
  border: 1px solid color-mix(in srgb, var(--glass-border) 86%, var(--border));
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--bg-tertiary) 76%, transparent);
}

.profile-photo-panel__identity {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: 1 1 auto;
  min-width: 0;
}

.profile-photo-panel__avatar {
  flex: 0 0 4rem;
}

.profile-photo-panel__identity h2,
.profile-photo-panel__identity p {
  margin: 0;
}

.profile-photo-panel__identity h2 {
  font-size: var(--font-size-h3);
  line-height: var(--line-height-tight);
}

.profile-photo-panel__identity p:not(.eyebrow) {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.profile-photo-panel__actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
  flex: 0 0 auto;
}

.photo-picker-button,
.photo-clear-button {
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 0 1rem;
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--glass-border) 90%, var(--border));
  font: inherit;
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
}

.photo-picker-button {
  background: color-mix(in srgb, var(--accent-teal) 18%, var(--bg-primary));
  color: var(--text-primary);
}

.photo-picker-button:hover,
.photo-picker-button:focus-within {
  border-color: color-mix(in srgb, var(--accent-teal) 58%, var(--border));
  background: color-mix(in srgb, var(--accent-teal) 28%, var(--bg-primary));
}

.photo-clear-button {
  background: transparent;
  color: var(--text-secondary);
  min-width: 100%;
  min-height: 1.65rem;
  padding: 0 0.75rem;
  font-size: var(--font-size-small);
}

.photo-clear-button.is-hidden {
  visibility: hidden;
  pointer-events: none;
}

.photo-clear-button:hover,
.photo-clear-button:focus-visible {
  color: var(--text-primary);
  border-color: color-mix(in srgb, var(--text-secondary) 42%, var(--border));
  outline: none;
}

.onboarding-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 760px) {
  .home-base-panel {
    grid-template-columns: 1fr;
    align-items: stretch;
  }
}

@media (max-width: 560px) {
  .profile-photo-panel,
  .home-base-panel__identity,
  .profile-photo-panel__identity,
  .profile-photo-panel__actions {
    align-items: stretch;
  }

  .profile-photo-panel {
    flex-direction: column;
  }

  .profile-photo-panel__identity {
    align-items: center;
  }

  .home-base-panel__identity {
    align-items: center;
  }

  .photo-picker-button,
  .photo-clear-button {
    width: 100%;
  }

  .onboarding-actions {
    flex-direction: column-reverse;
    align-items: stretch;
  }
}

@media (prefers-reduced-motion: reduce) {
  .preference-chip,
  .home-base-suggestion,
  .home-base-combobox,
  .home-base-suggestions-enter-active,
  .home-base-suggestions-leave-active {
    transition: none;
  }

  .home-base-ping__ring {
    animation: none;
  }
}
</style>
