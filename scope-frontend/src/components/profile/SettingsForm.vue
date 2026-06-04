<template>
  <form class="settings-form stagger-in" @submit.prevent="submitForm">
    <section id="settings-account" class="surface-card settings-section" tabindex="-1" data-test="settings-section-account">
      <div class="section-header">
        <div class="section-heading">
          <span class="section-icon" aria-hidden="true">
            <ScopeIcon name="user" />
          </span>
          <div>
            <p class="eyebrow">Account</p>
            <h3>Account &amp; sign-in</h3>
          </div>
        </div>
      </div>

      <div class="field-grid">
        <div class="field-group">
          <span>Email</span>
          <div class="readonly-field">
            <strong>{{ accountEmail || 'signed-in@scope.travel' }}</strong>
            <small>Email changes require verification - reach out to support to update.</small>
          </div>
        </div>

        <label class="field-group">
          <span>Phone number</span>
          <input v-model.trim="form.phoneNumber" type="tel" maxlength="32" autocomplete="tel" placeholder="+1 555 123 4567" />
        </label>
      </div>

      <div class="danger-zone" data-test="settings-danger-zone">
        <div>
          <strong>Delete account</strong>
          <p>Permanently remove your Scope account, saved pins, trips, and friends. This cannot be undone.</p>
        </div>
        <button
          type="button"
          class="danger-button"
          data-test="settings-delete-account"
          @click="confirmDeleteAccount"
        >
          Delete account
        </button>
      </div>
    </section>

    <section id="settings-profile" class="surface-card settings-section" tabindex="-1" data-test="settings-section-profile">
      <div class="section-header">
        <div class="section-heading">
          <span class="section-icon" aria-hidden="true">
            <ScopeIcon name="camera" />
          </span>
          <div>
            <p class="eyebrow">Profile</p>
            <h3>Profile identity</h3>
          </div>
        </div>
      </div>

      <div class="profile-hero">
        <button
          type="button"
          class="profile-avatar-shell"
          :class="{ 'is-uploading': avatarUploading }"
          :aria-label="form.avatarUrl ? 'Change profile photo' : 'Upload profile photo'"
          :disabled="avatarUploading"
          @click="openAvatarPicker"
        >
          <Avatar
            :name="form.displayName || 'New explorer'"
            :src="form.avatarUrl"
            :size="112"
            class="profile-avatar"
          />
          <span class="profile-avatar__overlay" aria-hidden="true">
            <ScopeIcon name="camera" />
            <span class="profile-avatar__overlay-text">
              {{ avatarUploading ? 'Uploading.' : form.avatarUrl ? 'Change photo' : 'Upload photo' }}
            </span>
          </span>
        </button>

        <div class="profile-hero__copy">
          <strong>{{ form.displayName || 'New explorer' }}</strong>
          <p>{{ form.homeBase || 'Add a location so collaborators know where your routes begin.' }}</p>
          <small class="profile-hero__hint">Click the circle to upload a JPEG, PNG, or WebP up to 5 MB.</small>
        </div>
      </div>

      <input
        ref="avatarFileInputRef"
        type="file"
        class="sr-only"
        :accept="AVATAR_ACCEPT"
        data-test="settings-avatar-input"
        @change="handleAvatarFileSelection"
      />

      <div class="field-grid">
        <label class="field-group">
          <span>First name</span>
          <input v-model.trim="form.firstName" type="text" maxlength="80" autocomplete="given-name" placeholder="First name" />
        </label>

        <label class="field-group">
          <span>Last name</span>
          <input v-model.trim="form.lastName" type="text" maxlength="80" autocomplete="family-name" placeholder="Last name" />
        </label>

        <label class="field-group">
          <span>Display name</span>
          <input v-model.trim="form.displayName" type="text" maxlength="80" placeholder="How your name appears in Scope" />
        </label>

        <label class="field-group">
          <span>Username</span>
          <div class="input-shell input-shell--prefix">
            <span class="input-prefix" aria-hidden="true">@</span>
            <input v-model.trim="form.username" type="text" maxlength="40" autocomplete="username" placeholder="your-handle" @input="normalizeUsername" />
          </div>
        </label>

        <DateField
          v-model="form.dateOfBirth"
          class="field-group field-group--datefield"
          label="Date of birth"
          autocomplete="bday"
          placeholder="MM/DD/YYYY"
          :show-message="false"
        />

        <div class="field-group">
          <span>Location</span>
          <div class="location-field" :class="{ 'is-open': locationOpen }">
            <div class="input-shell">
              <ScopeIcon name="pin" label="Location" />
              <input
                ref="locationInputRef"
                v-model.trim="form.homeBase"
                type="text"
                maxlength="160"
                autocomplete="off"
                placeholder="City, neighborhood, or address"
                aria-autocomplete="list"
                aria-controls="settings-location-suggestions"
                :aria-expanded="locationOpen"
                @focus="handleLocationFocus"
                @blur="handleLocationBlur"
                @input="handleLocationInput"
                @keydown="handleLocationKeydown"
              />
              <button
                v-if="form.homeBase"
                type="button"
                class="input-clear"
                aria-label="Clear location"
                @click="clearLocation"
              >
                <ScopeIcon name="close" label="Clear location" />
              </button>
            </div>
            <div
              v-if="locationOpen && (locationLoading || locationResults.length || locationStatus)"
              id="settings-location-suggestions"
              class="location-suggestions"
              role="listbox"
              aria-label="Location suggestions"
            >
              <button
                v-for="(result, index) in locationResults"
                :key="`location-${result.latitude}-${result.longitude}-${index}`"
                type="button"
                class="location-suggestion"
                :class="{ active: index === locationActiveIndex }"
                role="option"
                :aria-selected="index === locationActiveIndex"
                @mouseenter="locationActiveIndex = index"
                @mousedown.prevent
                @click="selectLocation(result)"
              >
                <span class="location-suggestion__main">{{ formatLocationTitle(result) }}</span>
                <span class="location-suggestion__meta">{{ formatLocationMeta(result) }}</span>
              </button>
              <span v-if="locationLoading" class="location-status">Searching places...</span>
              <span v-else-if="locationStatus" class="location-status">{{ locationStatus }}</span>
            </div>
          </div>
          <small class="field-hint">Used to surface nearby spots, suggestions, and travelers.</small>
        </div>

        <label class="field-group field-group--wide">
          <span>Bio</span>
          <textarea v-model.trim="form.bio" rows="4" maxlength="280" placeholder="Tell other travelers what kind of adventures you chase." />
        </label>
      </div>
    </section>

    <section id="settings-privacy" class="surface-card settings-section" tabindex="-1" data-test="settings-section-privacy">
      <div class="section-header">
        <div class="section-heading">
          <span class="section-icon" aria-hidden="true">
            <ScopeIcon name="lock" />
          </span>
          <div>
            <p class="eyebrow">Privacy</p>
            <h3>Visibility controls</h3>
          </div>
        </div>
      </div>

      <p class="section-copy">Choose how broadly Scope shares your profile, saved routes, and collaboration availability.</p>

      <div class="option-grid" role="radiogroup" aria-label="Profile visibility">
        <button
          v-for="option in privacyOptions"
          :key="option.value"
          type="button"
          class="option-card"
          :class="{ 'is-active': form.privacy === option.value }"
          @click="form.privacy = option.value"
        >
          <strong>{{ option.label }}</strong>
          <span>{{ option.description }}</span>
        </button>
      </div>

      <div class="settings-stack settings-stack--privacy">
        <button
          data-test="activity-status-toggle"
          type="button"
          class="toggle-row"
          :class="{ 'is-active': form.showActivityStatus }"
          @click="form.showActivityStatus = !form.showActivityStatus"
        >
          <div>
            <strong>Activity status</strong>
            <p>
              {{ form.showActivityStatus
                ? 'Friends can see when you are online, idle, or actively planning.'
                : 'Friends see Activity hidden instead of online or planning status.' }}
            </p>
          </div>
          <span class="toggle-switch" :class="{ 'is-active': form.showActivityStatus }" aria-hidden="true">
            <span class="toggle-switch__thumb" />
          </span>
        </button>

        <button
          data-test="analytics-consent-toggle"
          type="button"
          class="toggle-row"
          :class="{ 'is-active': analyticsConsentEnabled }"
          @click="toggleAnalyticsConsent"
        >
          <div>
            <strong>Usage analytics</strong>
            <p data-test="analytics-consent-copy">{{ analyticsConsentCopy }}</p>
          </div>
          <span class="toggle-switch" :class="{ 'is-active': analyticsConsentEnabled }" aria-hidden="true">
            <span class="toggle-switch__thumb" />
          </span>
        </button>

        <p class="section-copy settings-note" data-test="analytics-consent-status">
          {{ analyticsConsentStatusLabel }}
        </p>
      </div>
    </section>

    <section id="settings-notifications" class="surface-card settings-section" tabindex="-1" data-test="settings-section-notifications">
      <div class="section-header">
        <div class="section-heading">
          <span class="section-icon" aria-hidden="true">
            <ScopeIcon name="bell" />
          </span>
          <div>
            <p class="eyebrow">Notifications</p>
            <h3>How Scope should reach you</h3>
          </div>
        </div>
      </div>

      <div class="settings-stack">
        <div class="settings-block">
          <p class="block-label">Trip invite cadence</p>
          <div class="pill-row" role="radiogroup" aria-label="Trip invite cadence">
            <button
              v-for="option in inviteCadenceOptions"
              :key="option.value"
              type="button"
              class="option-pill"
              :class="{ 'is-active': form.tripInvites === option.value }"
              @click="form.tripInvites = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <button type="button" class="toggle-row" :class="{ 'is-active': form.emailAlerts }" @click="form.emailAlerts = !form.emailAlerts">
          <div>
            <strong>Email alerts</strong>
            <p>Send friend activity, collaboration updates, and itinerary reminders to your inbox.</p>
          </div>
          <span class="toggle-switch" :class="{ 'is-active': form.emailAlerts }" aria-hidden="true">
            <span class="toggle-switch__thumb" />
          </span>
        </button>
      </div>
    </section>

    <section id="settings-appearance" class="surface-card settings-section" tabindex="-1" data-test="settings-section-appearance">
      <div class="section-header">
        <div class="section-heading">
          <span class="section-icon" aria-hidden="true">
            <ScopeIcon name="settings" />
          </span>
          <div>
            <p class="eyebrow">Appearance</p>
            <h3>Theme and travel taste</h3>
          </div>
        </div>
      </div>

      <div class="settings-stack">
        <div class="settings-block">
          <p class="block-label">Theme mode</p>
          <div class="theme-switch" role="group" aria-label="Theme mode">
            <button
              data-test="theme-option-dark"
              type="button"
              class="theme-option"
              :class="{ 'is-active': form.themeMode === 'dark' }"
              @click="selectTheme('dark')"
            >
              <ScopeIcon name="moon" label="Dark mode" />
              <span>Dark</span>
            </button>
            <button
              data-test="theme-option-light"
              type="button"
              class="theme-option theme-option--coming-soon"
              aria-disabled="true"
              aria-describedby="settings-theme-light-tooltip"
              title="Light mode coming soon"
              @click="selectTheme('light')"
            >
              <ScopeIcon name="sun" label="Light mode" />
              <span>Light</span>
              <span id="settings-theme-light-tooltip" class="theme-option__tooltip" role="tooltip">Coming soon</span>
            </button>
          </div>
        </div>

        <div class="settings-block">
          <p class="block-label">Travel preferences</p>
          <div class="pill-row preferences-row" role="group" aria-label="Travel preferences">
            <button
              v-for="category in categories"
              :key="category"
              :data-test="`preference-pill-${category}`"
              type="button"
              class="preference-pill"
              :class="[
                `preference-pill--${category}`,
                {
                  'is-active': form.categoryPreferences.includes(category),
                  [`badge-${category}`]: form.categoryPreferences.includes(category),
                },
              ]"
              @click="toggleCategory(category)"
            >
              <ScopeIcon :name="categoryIcon(category)" :label="formatCategory(category)" />
              {{ formatCategory(category) }}
            </button>
          </div>
        </div>

        <div class="settings-block">
          <p class="block-label">Guided walkthrough</p>
          <div class="tutorial-card" data-test="settings-tutorial-card">
            <div class="tutorial-card__copy">
              <span class="tutorial-card__icon" aria-hidden="true">
                <ScopeIcon name="sparkle" />
              </span>

              <div class="tutorial-card__text">
                <strong>Replay the premium Scope tour</strong>
                <p>{{ tutorialDescription }}</p>
              </div>
            </div>

            <div class="tutorial-card__actions">
              <span class="meta-pill tutorial-pill">{{ tutorialCompleted ? 'Completed' : 'Ready to start' }}</span>
              <span class="tutorial-pill tutorial-pill--muted">{{ tutorialStepLabel }}</span>
              <Button
                data-test="settings-replay-tutorial"
                type="button"
                variant="primary"
                icon="sparkle"
                icon-label="Replay tutorial"
                @click="handleReplayTutorial"
              >
                Replay tutorial
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <p v-if="errorMessage" class="error-copy">{{ errorMessage }}</p>

    <div class="form-actions settings-action-bar" :class="{ 'settings-action-bar--dirty': isFormDirty }">
      <div class="settings-action-bar__status" aria-live="polite">
        <span v-if="isFormDirty" class="settings-action-bar__dot" aria-hidden="true" />
        <span class="settings-action-bar__label">{{ isFormDirty ? 'Unsaved changes' : 'All changes saved' }}</span>
      </div>
      <div class="settings-action-bar__buttons">
        <Button data-test="settings-cancel" type="button" variant="secondary" :disabled="!isFormDirty" @click="resetForm">Cancel</Button>
        <Button data-test="settings-save" type="submit" :loading="submitting" :disabled="!isFormDirty">Save Changes</Button>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
import Avatar from '@/components/common/Avatar.vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import Button from '@/components/common/Button.vue';
import DateField from '@/components/auth/DateField.vue';
import { setAnalyticsConsent, useAnalyticsConsent } from '@/utils/analyticsConsent';
import { applyTheme, initializeTheme, useTheme } from '@/utils/theme';
import { geocode, type GeocodeResult } from '@/services/mapService';
import { getPresignedUploadTarget, uploadFileToPresignedTarget } from '@/services/s3Service';
import type { SpotCategory, ThemeMode } from '@/types';

const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const AVATAR_ACCEPT = '.jpg,.jpeg,.png,.webp';
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const ACTIVE_THEME_MODE: ThemeMode = 'dark';

export interface SettingsFormValue {
  displayName: string;
  username: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  dateOfBirth: string;
  avatarUrl: string;
  bio: string;
  homeBase: string;
  showActivityStatus: boolean;
  privacy: 'public' | 'friends' | 'private';
  tripInvites: 'instant' | 'daily' | 'weekly';
  emailAlerts: boolean;
  categoryPreferences: SpotCategory[];
  themeMode: ThemeMode;
}

const categories: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'entertainment', 'scenic', 'other'];
const privacyOptions = [
  { value: 'public' as const, label: 'Public', description: 'Anyone on Scope can discover your profile and saved routes.' },
  { value: 'friends' as const, label: 'Friends only', description: 'Only accepted connections see your full planning context.' },
  { value: 'private' as const, label: 'Private', description: 'Keep your profile visible only to the trips you explicitly join.' },
];
const inviteCadenceOptions = [
  { value: 'instant' as const, label: 'Instant' },
  { value: 'daily' as const, label: 'Daily digest' },
  { value: 'weekly' as const, label: 'Weekly digest' },
];

const defaultSettingsFormValue: SettingsFormValue = {
  displayName: '',
  username: '',
  firstName: '',
  lastName: '',
  phoneNumber: '',
  dateOfBirth: '',
  avatarUrl: '',
  bio: '',
  homeBase: '',
  showActivityStatus: true,
  privacy: 'friends',
  tripInvites: 'instant',
  emailAlerts: true,
  categoryPreferences: [],
  themeMode: ACTIVE_THEME_MODE,
};

const props = withDefaults(
  defineProps<{
    initialValue: SettingsFormValue;
    submitting?: boolean;
    accountEmail?: string;
    syncModeLabel?: string;
    syncModeDescription?: string;
    tutorialCompleted?: boolean;
    tutorialStepCount?: number;
  }>(),
  {
    submitting: false,
    accountEmail: '',
    syncModeLabel: 'API-backed',
    syncModeDescription: 'Changes sync through the Scope account API.',
    tutorialCompleted: false,
    tutorialStepCount: 0,
  },
);

const emit = defineEmits<{
  (event: 'submit', payload: SettingsFormValue): void;
  (event: 'replay-tutorial'): void;
  (event: 'delete-account'): void;
}>();

initializeTheme();
const theme = useTheme();
const { consent } = useAnalyticsConsent();
const avatarFileInputRef = ref<HTMLInputElement | null>(null);
const avatarUploading = ref(false);
let avatarPreviewUrl: string | null = null;
const locationInputRef = ref<HTMLInputElement | null>(null);
const form = reactive<SettingsFormValue>(cloneSettingsFormValue(props.initialValue));
const errorMessage = defineModel<string>('errorMessage', { default: '' });

const locationOpen = ref(false);
const locationLoading = ref(false);
const locationStatus = ref('');
const locationResults = ref<GeocodeResult[]>([]);
const locationActiveIndex = ref(-1);
let locationDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let locationBlurTimer: ReturnType<typeof setTimeout> | null = null;
let locationRequestId = 0;

function handleLocationFocus(): void {
  if (locationBlurTimer) {
    clearTimeout(locationBlurTimer);
    locationBlurTimer = null;
  }
  if (form.homeBase.trim().length >= 2) {
    locationOpen.value = true;
    if (!locationResults.value.length && !locationLoading.value) {
      void runLocationSearch(form.homeBase);
    }
  }
}

function handleLocationBlur(): void {
  locationBlurTimer = setTimeout(() => {
    locationOpen.value = false;
  }, 140);
}

function handleLocationInput(): void {
  locationActiveIndex.value = -1;
  if (locationDebounceTimer) {
    clearTimeout(locationDebounceTimer);
  }
  const query = form.homeBase.trim();
  if (query.length < 2) {
    locationOpen.value = false;
    locationResults.value = [];
    locationStatus.value = '';
    return;
  }
  locationOpen.value = true;
  locationLoading.value = true;
  locationStatus.value = '';
  locationDebounceTimer = setTimeout(() => {
    void runLocationSearch(query);
  }, 220);
}

async function runLocationSearch(query: string): Promise<void> {
  const requestId = ++locationRequestId;
  try {
    const envelope = await geocode(query, 6);
    if (requestId !== locationRequestId) return;
    const results = Array.isArray(envelope.data) ? envelope.data : [];
    locationResults.value = results;
    locationStatus.value = results.length ? '' : 'No matching places. Try a city or address.';
  } catch {
    if (requestId !== locationRequestId) return;
    locationResults.value = [];
    locationStatus.value = 'Place search is offline right now.';
  } finally {
    if (requestId === locationRequestId) {
      locationLoading.value = false;
    }
  }
}

function handleLocationKeydown(event: KeyboardEvent): void {
  if (!locationOpen.value || !locationResults.value.length) {
    if (event.key === 'ArrowDown' && form.homeBase.trim().length >= 2) {
      locationOpen.value = true;
      void runLocationSearch(form.homeBase);
    }
    return;
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    locationActiveIndex.value = (locationActiveIndex.value + 1) % locationResults.value.length;
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    locationActiveIndex.value = locationActiveIndex.value <= 0
      ? locationResults.value.length - 1
      : locationActiveIndex.value - 1;
  } else if (event.key === 'Enter') {
    const candidate = locationResults.value[locationActiveIndex.value];
    if (locationActiveIndex.value >= 0 && candidate) {
      event.preventDefault();
      selectLocation(candidate);
    }
  } else if (event.key === 'Escape') {
    locationOpen.value = false;
  }
}

function selectLocation(result: GeocodeResult): void {
  form.homeBase = formatLocationTitle(result);
  locationOpen.value = false;
  locationResults.value = [];
}

function clearLocation(): void {
  form.homeBase = '';
  locationOpen.value = false;
  locationResults.value = [];
  locationStatus.value = '';
  void nextTick(() => locationInputRef.value?.focus());
}

function formatLocationTitle(result: GeocodeResult): string {
  return result.placeName?.split(',')[0]?.trim() || result.city || result.placeName || '';
}

function formatLocationMeta(result: GeocodeResult): string {
  const segments = [result.city, result.country].filter(Boolean) as string[];
  return segments.length ? segments.join(', ') : result.placeName || '';
}

function normalizeUsername(): void {
  form.username = form.username
    .replace(/^@+/, '')
    .replace(/[^a-z0-9._-]/gi, '')
    .toLowerCase();
}

function confirmDeleteAccount(): void {
  const ok = typeof window !== 'undefined'
    ? window.confirm('Delete your Scope account permanently? You will lose all pins, trips, and friends.')
    : false;
  if (ok) {
    emit('delete-account');
  }
}

onBeforeUnmount(() => {
  if (locationDebounceTimer) clearTimeout(locationDebounceTimer);
  if (locationBlurTimer) clearTimeout(locationBlurTimer);
  releaseAvatarPreview();
});

const analyticsConsentEnabled = computed(() => consent.value === 'granted');
const analyticsConsentStatusLabel = computed(() => {
  switch (consent.value) {
    case 'granted':
      return 'Analytics enabled - Scope can measure optional usage patterns, AI chats, and planning choices to improve route planning, map ergonomics, and future Scope AI quality.';
    case 'denied':
      return 'Analytics opted out - Scope keeps only the essential storage needed for sign-in, theme, onboarding, and offline reliability.';
    default:
      return 'No analytics choice saved yet - the cookie banner will keep asking until you explicitly allow analytics or opt out.';
  }
});
const analyticsConsentCopy = computed(() => {
  switch (consent.value) {
    case 'granted':
      return 'Optional analytics are on for page usage, map interaction, AI chat learning, and trip-planning improvements.';
    case 'denied':
      return 'Only necessary storage is active. Turn this back on any time if you want to share anonymous usage analytics.';
    default:
      return 'Turn this on to allow optional analytics and AI planning learning, or leave it off if you prefer to keep only necessary storage.';
  }
});
const tutorialStepLabel = computed(() => {
  if (props.tutorialStepCount <= 0) {
    return 'Guided tour ready';
  }

  return props.tutorialStepCount === 1 ? '1-step guide' : `${props.tutorialStepCount}-step guide`;
});
const tutorialDescription = computed(() => {
  const walkthroughScope = props.tutorialStepCount > 0 ? tutorialStepLabel.value.toLowerCase() : 'guided walkthrough';

  return props.tutorialCompleted
    ? `Launch the ${walkthroughScope} again whenever you want a quick refresher on pin drops, live map controls, and route setup.`
    : `Start the ${walkthroughScope} any time to learn where Scope keeps pin drops, map filters, and the fastest route handoff.`;
});

const isFormDirty = computed(() => {
  const initial = props.initialValue;
  if (form.displayName !== initial.displayName) return true;
  if (form.username !== initial.username) return true;
  if (form.firstName !== initial.firstName) return true;
  if (form.lastName !== initial.lastName) return true;
  if (form.phoneNumber !== initial.phoneNumber) return true;
  if (form.dateOfBirth !== initial.dateOfBirth) return true;
  if (form.avatarUrl !== initial.avatarUrl) return true;
  if (form.bio !== initial.bio) return true;
  if (form.homeBase !== initial.homeBase) return true;
  if (form.showActivityStatus !== initial.showActivityStatus) return true;
  if (form.privacy !== initial.privacy) return true;
  if (form.tripInvites !== initial.tripInvites) return true;
  if (form.emailAlerts !== initial.emailAlerts) return true;
  if (form.themeMode !== ACTIVE_THEME_MODE) return true;
  const initialCategories = [...initial.categoryPreferences].sort().join('|');
  const currentCategories = [...form.categoryPreferences].sort().join('|');
  return initialCategories !== currentCategories;
});

watch(
  () => props.initialValue,
  (nextValue) => {
    Object.assign(form, cloneSettingsFormValue(nextValue));
    releaseAvatarPreview();
    errorMessage.value = '';
  },
  { deep: true },
);

watch(
  () => theme.value,
  (nextTheme) => {
    form.themeMode = nextTheme;
  },
  { immediate: true },
);

function cloneSettingsFormValue(value: Partial<SettingsFormValue>): SettingsFormValue {
  return {
    ...defaultSettingsFormValue,
    ...value,
    themeMode: ACTIVE_THEME_MODE,
    categoryPreferences: Array.isArray(value.categoryPreferences) ? [...value.categoryPreferences] : [],
  };
}

function formatCategory(category: SpotCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function categoryIcon(category: SpotCategory): string {
  return category === 'other' ? 'sparkle' : category;
}

function openAvatarPicker(): void {
  if (avatarUploading.value) return;
  void nextTick(() => {
    avatarFileInputRef.value?.click();
  });
}

function releaseAvatarPreview(): void {
  if (avatarPreviewUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(avatarPreviewUrl);
  }
  avatarPreviewUrl = null;
}

async function handleAvatarFileSelection(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0] ?? null;
  if (input) input.value = '';
  if (!file) return;

  if (!AVATAR_ALLOWED_TYPES.includes(file.type as (typeof AVATAR_ALLOWED_TYPES)[number])) {
    errorMessage.value = 'Only JPEG, PNG, and WebP photos are supported for avatars.';
    return;
  }

  if (file.size > AVATAR_MAX_BYTES) {
    errorMessage.value = 'Avatar uploads must be 5 MB or smaller.';
    return;
  }

  errorMessage.value = '';
  releaseAvatarPreview();
  const previewUrl = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
    ? URL.createObjectURL(file)
    : '';
  avatarPreviewUrl = previewUrl || null;
  if (previewUrl) {
    form.avatarUrl = previewUrl;
  }

  avatarUploading.value = true;
  try {
    const target = await getPresignedUploadTarget({
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    });
    const finalUrl = await uploadFileToPresignedTarget(target, file);
    if (finalUrl && finalUrl !== previewUrl) {
      form.avatarUrl = finalUrl;
      releaseAvatarPreview();
    }
  } catch {
    errorMessage.value = 'Scope could not finish uploading that photo. Try again in a moment.';
  } finally {
    avatarUploading.value = false;
  }
}

function selectTheme(themeMode: ThemeMode): void {
  form.themeMode = ACTIVE_THEME_MODE;
  applyTheme(ACTIVE_THEME_MODE, {
    track: themeMode === ACTIVE_THEME_MODE,
    source: 'settings',
  });
}

function toggleCategory(category: SpotCategory): void {
  if (form.categoryPreferences.includes(category)) {
    form.categoryPreferences = form.categoryPreferences.filter((entry) => entry !== category);
    return;
  }

  form.categoryPreferences = [...form.categoryPreferences, category];
}

function toggleAnalyticsConsent(): void {
  setAnalyticsConsent(analyticsConsentEnabled.value ? 'denied' : 'granted');
}

function handleReplayTutorial(): void {
  errorMessage.value = '';
  emit('replay-tutorial');
}

function resetForm(): void {
  const initialValue = cloneSettingsFormValue(props.initialValue);
  Object.assign(form, initialValue);
  releaseAvatarPreview();
  applyTheme(ACTIVE_THEME_MODE);
  errorMessage.value = '';
}

function submitForm(): void {
  if (!form.displayName.trim()) {
    errorMessage.value = 'Display name is required so your profile stays recognizable.';
    return;
  }

  errorMessage.value = '';
  emit('submit', {
    ...form,
    displayName: form.displayName.trim(),
    username: form.username.trim(),
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    phoneNumber: form.phoneNumber.trim(),
    dateOfBirth: form.dateOfBirth,
    avatarUrl: form.avatarUrl.trim(),
    bio: form.bio.trim(),
    homeBase: form.homeBase.trim(),
    showActivityStatus: form.showActivityStatus,
    categoryPreferences: [...form.categoryPreferences],
  });
}

defineExpose({
  ...(import.meta.env.MODE === 'test'
    ? {
        __coverage: {
          avatarUploading,
          clearLocation,
          cloneSettingsFormValue,
          confirmDeleteAccount,
          errorMessage,
          form,
          formatLocationMeta,
          formatLocationTitle,
          handleAvatarFileSelection,
          handleLocationBlur,
          handleLocationFocus,
          handleLocationInput,
          handleLocationKeydown,
          locationActiveIndex,
          locationLoading,
          locationOpen,
          locationResults,
          locationStatus,
          normalizeUsername,
          openAvatarPicker,
          releaseAvatarPreview,
          runLocationSearch,
          selectLocation,
        },
      }
    : {}),
});
</script>

<style scoped>
.settings-form,
.settings-section,
.section-heading,
.account-grid,
.account-block,
.profile-hero,
.profile-hero__copy,
.field-grid,
.field-group,
.settings-stack,
.settings-block,
.tutorial-card,
.tutorial-card__copy,
.tutorial-card__text,
.form-actions {
  display: grid;
}

.settings-form {
  gap: var(--space-5);
  /* Two-tier green system:
     - Primary action buttons keep --accent-teal (bright brand green)
     - Selected/highlighted controls use --settings-active-color (darker forest green)
     so the user can instantly tell "selection" apart from "button". */
  --settings-active-color: var(--accent-teal-strong);
  --settings-active-color-soft: color-mix(in srgb, var(--settings-active-color) 18%, transparent);
}

.settings-stack--privacy {
  gap: var(--space-3);
}

.settings-note {
  margin: 0;
}

.stagger-in > * {
  opacity: 0;
}

.settings-section {
  gap: var(--space-4);
  padding: var(--space-5);
  scroll-margin-top: calc(var(--shell-content-top) + var(--space-4));
  content-visibility: auto;
  contain-intrinsic-size: 560px;
  border: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
  background: color-mix(in srgb, var(--bg-secondary) 96%, transparent);
  box-shadow: none;
  transition: border-color var(--transition-fast);
}

.settings-section:focus-within {
  border-color: color-mix(in srgb, var(--accent-teal) 26%, var(--glass-border));
}

.section-header,
.account-grid,
.option-grid,
.pill-row,
.theme-switch,
.tutorial-card__actions,
.form-actions {
  display: flex;
}

.section-header,
.account-grid,
.option-grid,
.pill-row,
.tutorial-card__actions,
.form-actions {
  gap: var(--space-3);
}

.section-header {
  justify-content: space-between;
  align-items: start;
}

.section-heading {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-3);
}

.section-icon,
.meta-pill,
.account-label,
.block-label,
.field-group span,
.tutorial-pill,
.error-copy {
  font-size: var(--font-size-small);
}

.section-icon {
  width: 2.75rem;
  height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--settings-active-color) 18%, transparent);
  color: var(--settings-active-color);
}

.section-icon :deep(.scope-icon) {
  width: 1.15rem;
  height: 1.15rem;
}

.eyebrow,
.section-heading h3,
.account-block strong,
.profile-hero__copy strong,
.profile-hero__copy p,
.section-copy,
.field-group span,
.field-group input,
.field-group textarea,
.option-card strong,
.option-card span,
.block-label,
.toggle-row strong,
.toggle-row p,
.tutorial-card__text strong,
.tutorial-card__text p,
.error-copy {
  margin: 0;
}

.eyebrow {
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.section-heading h3 {
  font-size: var(--font-size-h3);
  line-height: var(--line-height-tight);
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0.8rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal-light) 100%, transparent);
  color: var(--accent-teal);
  font-weight: var(--font-weight-semibold);
}

.account-grid {
  flex-wrap: wrap;
}

.account-block {
  gap: var(--space-1);
  flex: 1 1 14rem;
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--glass-border) 72%, var(--border) 28%);
  background: color-mix(in srgb, var(--bg-primary) 76%, transparent);
}

.account-label,
.section-copy,
.field-group span,
.option-card span,
.block-label,
.toggle-row p,
.profile-hero__copy p,
.tutorial-card__text p {
  color: var(--text-secondary);
  line-height: var(--line-height-relaxed);
}

.profile-hero {
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-5);
  align-items: center;
}

.profile-avatar-shell {
  position: relative;
  display: inline-flex;
  width: fit-content;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  overflow: hidden;
  background: transparent;
  cursor: pointer;
  isolation: isolate;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.profile-avatar-shell:hover,
.profile-avatar-shell:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--settings-active-color) 60%, transparent);
}

.profile-avatar-shell:active {
  transform: scale(0.97);
}

.profile-avatar-shell:disabled {
  cursor: progress;
}

.profile-avatar {
  border-radius: var(--radius-full);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--glass-border) 80%, transparent);
}

.profile-avatar-shell :deep(img) {
  transition: transform var(--transition-slow);
}

.profile-avatar-shell:hover :deep(img),
.profile-avatar-shell:focus-visible :deep(img) {
  transform: scale(1.06);
}

.profile-avatar__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.4rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 65%, transparent);
  color: var(--text-inverse);
  opacity: 0;
  transition: opacity var(--transition-fast);
  pointer-events: none;
}

.profile-avatar-shell:hover .profile-avatar__overlay,
.profile-avatar-shell:focus-visible .profile-avatar__overlay,
.profile-avatar-shell.is-uploading .profile-avatar__overlay {
  opacity: 1;
}

.profile-avatar__overlay :deep(.scope-icon) {
  width: 1.4rem;
  height: 1.4rem;
}

.profile-avatar__overlay-text {
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.02em;
  text-align: center;
  line-height: 1.1;
}

.profile-avatar-shell.is-uploading .profile-avatar__overlay :deep(.scope-icon) {
  animation: settings-avatar-pulse 1.2s ease-in-out infinite;
}

@keyframes settings-avatar-pulse {
  0%, 100% { transform: scale(1); opacity: 0.85; }
  50% { transform: scale(1.15); opacity: 1; }
}

.profile-hero__hint {
  display: block;
  margin-top: var(--space-1);
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  line-height: 1.4;
}

.profile-hero__copy {
  gap: var(--space-2);
}

.profile-hero__copy strong {
  font-size: var(--font-size-h2);
  line-height: var(--line-height-tight);
}

.field-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4) var(--space-4);
  align-items: start;
}

.field-group {
  gap: var(--space-2);
  align-content: start;
}

.field-group > span:first-child {
  min-height: 1.25rem;
  display: flex;
  align-items: center;
}

.field-group--datefield {
  grid-template-rows: auto auto;
  gap: var(--space-2);
}

.field-group--datefield :deep(.date-field__label) {
  min-height: 1.25rem;
  display: flex;
  align-items: center;
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
}

.field-group--datefield :deep(.date-field__shell) {
  min-height: 3.25rem;
  padding: 0 1rem;
  background: color-mix(in srgb, var(--input-bg) 92%, transparent);
  border-color: var(--input-border);
  box-shadow: none;
  transform: none;
}

.field-group--datefield :deep(.date-field__shell:hover),
.field-group--datefield :deep(.date-field__shell.is-focused),
.field-group--datefield :deep(.date-field__shell:focus-within) {
  border-color: color-mix(in srgb, var(--settings-active-color) 60%, var(--input-focus));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--settings-active-color) 22%, transparent);
  transform: none;
}

.field-group--datefield :deep(.date-field__input) {
  padding: 0.95rem 0;
  line-height: 1.25;
}

.field-group--datefield :deep(.date-field__message) {
  display: none;
}

.field-group--wide {
  grid-column: 1 / -1;
}

.field-group input,
.field-group textarea {
  width: 100%;
  min-height: 3.25rem;
  padding: 0.95rem 1rem;
  border: 1px solid var(--input-border);
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--input-bg) 92%, transparent);
  color: var(--text-primary);
  font: inherit;
  line-height: 1.25;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    background var(--transition-fast);
}

.field-group textarea {
  min-height: 6rem;
}

.field-group textarea {
  resize: vertical;
}

.field-group input::placeholder,
.field-group textarea::placeholder {
  color: var(--input-placeholder);
}

.readonly-field {
  display: grid;
  gap: 0.2rem;
  min-height: 3.25rem;
  padding: 0.65rem 1rem;
  border: 1px dashed color-mix(in srgb, var(--glass-border) 80%, transparent);
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--bg-tertiary) 38%, var(--bg-secondary));
  align-content: center;
}

.readonly-field strong {
  font-size: var(--font-size-body);
  color: var(--text-primary);
}

.readonly-field small {
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  line-height: 1.4;
}

.input-shell {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0;
  width: 100%;
  min-height: 3.25rem;
  border: 1px solid var(--input-border);
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--input-bg) 92%, transparent);
  padding: 0 1rem;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.input-shell:focus-within {
  border-color: color-mix(in srgb, var(--settings-active-color) 60%, var(--input-focus));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--settings-active-color) 22%, transparent);
}

.input-shell :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.input-shell input {
  flex: 1;
  min-width: 0;
  min-height: auto;
  border: 0;
  background: transparent;
  padding: 0.95rem 0.5rem;
  color: var(--text-primary);
  outline: none;
}

.input-shell--prefix .input-prefix {
  padding-inline-end: 0.25rem;
  color: var(--text-secondary);
  font-weight: var(--font-weight-medium);
}

.input-clear {
  display: inline-grid;
  place-items: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: var(--radius-full);
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}

.input-clear:hover,
.input-clear:focus-visible {
  outline: none;
  background: color-mix(in srgb, var(--bg-tertiary) 80%, transparent);
  color: var(--text-primary);
}

.location-field {
  position: relative;
}

.location-suggestions {
  position: absolute;
  z-index: var(--z-dropdown);
  top: calc(100% + 0.35rem);
  left: 0;
  right: 0;
  display: grid;
  max-height: 18rem;
  overflow-y: auto;
  padding: var(--space-2);
  border: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
  border-radius: var(--radius-xl);
  background: var(--bg-secondary);
  box-shadow: 0 18px 32px -22px color-mix(in srgb, var(--bg-primary) 80%, transparent);
}

.location-suggestion {
  display: grid;
  gap: 0.15rem;
  width: 100%;
  padding: 0.55rem 0.7rem;
  border: 0;
  border-radius: var(--radius-lg);
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
}

.location-suggestion:hover,
.location-suggestion:focus-visible,
.location-suggestion.active {
  outline: none;
  background: color-mix(in srgb, var(--settings-active-color) 16%, transparent);
}

.location-suggestion__main {
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.location-suggestion__meta {
  font-size: var(--font-size-caption);
  color: var(--text-secondary);
}

.location-status {
  padding: 0.45rem 0.7rem;
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
}

.field-hint {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  line-height: 1.4;
}

.danger-zone {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--danger) 32%, transparent);
  background: color-mix(in srgb, var(--danger) 6%, var(--bg-secondary));
}

.danger-zone strong {
  display: block;
  font-size: var(--font-size-body);
  color: var(--text-primary);
}

.danger-zone p {
  margin: 0.2rem 0 0;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  line-height: 1.4;
}

.danger-button {
  padding: 0.7rem 1.1rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--danger) 50%, transparent);
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  color: var(--danger);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-small);
  cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}

.danger-button:hover,
.danger-button:focus-visible {
  outline: none;
  background: color-mix(in srgb, var(--danger) 22%, transparent);
  border-color: color-mix(in srgb, var(--danger) 70%, transparent);
}

@media (max-width: 720px) {
  .danger-zone {
    grid-template-columns: 1fr;
  }
}

.field-group input:focus-visible,
.field-group textarea:focus-visible {
  outline: none;
  border-color: color-mix(in srgb, var(--settings-active-color) 60%, var(--input-focus));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--settings-active-color) 22%, transparent);
}

.option-grid,
.pill-row {
  flex-wrap: wrap;
}

.option-card,
.option-pill,
.preference-pill,
.theme-option,
.toggle-row {
  border: 1px solid color-mix(in srgb, var(--glass-border) 72%, transparent);
  background: color-mix(in srgb, var(--bg-tertiary) 50%, var(--bg-secondary));
  color: var(--text-primary);
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
}

.option-card,
.option-pill,
.preference-pill,
.theme-option {
  cursor: pointer;
}

.option-card:hover,
.option-card:focus-visible,
.option-pill:hover,
.option-pill:focus-visible,
.preference-pill:hover,
.preference-pill:focus-visible,
.theme-option:hover,
.theme-option:focus-visible,
.toggle-row:hover,
.toggle-row:focus-visible {
  outline: none;
  border-color: color-mix(in srgb, var(--settings-active-color) 38%, var(--glass-border));
  background: color-mix(in srgb, var(--bg-tertiary) 80%, var(--bg-secondary));
}

.option-card {
  flex: 1 1 13rem;
  display: grid;
  gap: var(--space-2);
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  text-align: left;
}

.option-card.is-active,
.option-pill.is-active,
.theme-option.is-active,
.toggle-row.is-active {
  border-color: var(--settings-active-color);
  background: color-mix(in srgb, var(--settings-active-color) 18%, transparent);
  color: var(--text-primary);
  box-shadow: inset 3px 0 0 0 var(--settings-active-color);
}

.option-card.is-active strong,
.theme-option.is-active span,
.toggle-row.is-active strong {
  color: var(--settings-active-color);
}

.option-card.is-active span,
.toggle-row.is-active p {
  color: var(--text-secondary);
}

.option-pill,
.preference-pill,
.theme-option {
  display: inline-flex;
  position: relative;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 3rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-full);
  font-weight: var(--font-weight-medium);
}

.preference-pill {
  min-width: 6.25rem;
}

.theme-option--coming-soon {
  cursor: default;
  color: var(--text-secondary);
}

.theme-option__tooltip {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 0.55rem);
  z-index: 3;
  min-width: max-content;
  padding: 0.3rem 0.55rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 76%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-elevated) 96%, transparent);
  color: var(--text-primary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 0.25rem);
  transition:
    opacity var(--transition-fast),
    transform var(--transition-fast);
}

.theme-option--coming-soon:hover .theme-option__tooltip,
.theme-option--coming-soon:focus-visible .theme-option__tooltip {
  opacity: 1;
  transform: translate(-50%, 0);
}

/* Preference pills get per-category map-badge colors when selected. */
.preference-pill {
  gap: 0.45rem;
}

.preference-pill :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
}

/* Selected preference pills mirror the map badges so users instantly
   recognize the category color they would see on /map. */
.preference-pill.is-active {
  border-color: currentColor;
  box-shadow: inset 0 0 0 1px currentColor;
}

.preference-pill--food.is-active      { background: var(--badge-food-bg);      color: var(--badge-food-fg); }
.preference-pill--nature.is-active    { background: var(--badge-nature-bg);    color: var(--badge-nature-fg); }
.preference-pill--nightlife.is-active { background: var(--badge-nightlife-bg); color: var(--badge-nightlife-fg); }
.preference-pill--culture.is-active   { background: var(--badge-culture-bg);   color: var(--badge-culture-fg); }
.preference-pill--adventure.is-active { background: var(--badge-adventure-bg); color: var(--badge-adventure-fg); }
.preference-pill--shopping.is-active  { background: var(--badge-shopping-bg);  color: var(--badge-shopping-fg); }
.preference-pill--entertainment.is-active { background: var(--badge-entertainment-bg); color: var(--badge-entertainment-fg); }
.preference-pill--scenic.is-active    { background: var(--badge-scenic-bg);    color: var(--badge-scenic-fg); }
.preference-pill--other.is-active     { background: var(--badge-other-bg);     color: var(--badge-other-fg); }

.theme-switch {
  gap: var(--space-3);
  flex-wrap: wrap;
}

.theme-option {
  flex: 1 1 11rem;
}

.theme-option :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
}

.settings-stack {
  gap: var(--space-4);
}

.settings-block {
  gap: var(--space-3);
}

.tutorial-card {
  gap: var(--space-4);
  padding: clamp(var(--space-4), 2.6vw, var(--space-5));
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
  background: color-mix(in srgb, var(--bg-tertiary) 50%, var(--bg-secondary));
  box-shadow: none;
  transition: border-color var(--transition-fast);
}

.tutorial-card:focus-within {
  border-color: color-mix(in srgb, var(--accent-teal) 26%, var(--glass-border));
}

.tutorial-card__copy {
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-3);
  align-items: start;
}

.tutorial-card__icon {
  width: 2.6rem;
  height: 2.6rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--accent-teal-light) 100%, transparent);
  color: var(--accent-teal);
}

.tutorial-card__icon :deep(.scope-icon) {
  width: 1.1rem;
  height: 1.1rem;
}

.tutorial-card__text {
  gap: var(--space-2);
}

.tutorial-card__text strong {
  font-size: 1rem;
  line-height: var(--line-height-tight);
}

.tutorial-card__actions {
  flex-wrap: wrap;
  align-items: center;
}

.tutorial-card__actions :deep(.scope-button) {
  margin-left: auto;
  min-width: 11.5rem;
}

.tutorial-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0.8rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--settings-active-color) 18%, transparent);
  color: var(--settings-active-color);
  font-weight: var(--font-weight-semibold);
}

.tutorial-pill--muted {
  background: color-mix(in srgb, var(--glass-bg) 92%, transparent);
  color: var(--text-primary);
  border: 1px solid color-mix(in srgb, var(--glass-border) 88%, transparent);
}

.toggle-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  border-radius: var(--radius-2xl);
  text-align: left;
  cursor: pointer;
}

.toggle-row strong {
  display: block;
  margin-bottom: var(--space-1);
}

.toggle-switch {
  position: relative;
  width: 3.4rem;
  height: 2rem;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-secondary) 88%, transparent);
  border: 1px solid color-mix(in srgb, var(--glass-border) 72%, var(--border) 28%);
  transition: background var(--transition-fast), border-color var(--transition-fast);
}

.toggle-switch.is-active {
  background: var(--settings-active-color);
  border-color: var(--settings-active-color);
}

.toggle-switch.is-active .toggle-switch__thumb {
  background: var(--text-inverse);
}

.toggle-switch__thumb {
  position: absolute;
  top: 0.18rem;
  left: 0.2rem;
  width: 1.45rem;
  height: 1.45rem;
  border-radius: var(--radius-full);
  background: var(--text-primary);
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-fast);
}

.toggle-switch.is-active .toggle-switch__thumb {
  transform: translateX(1.35rem);
}

.error-copy {
  color: var(--danger);
}

.form-actions {
  grid-template-columns: repeat(2, minmax(0, max-content));
  justify-content: end;
}

.form-actions :deep(.scope-button) {
  min-width: 9rem;
}

.settings-action-bar {
  position: sticky;
  bottom: var(--space-3);
  z-index: 4;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
  background: color-mix(in srgb, var(--bg-secondary) 98%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: border-color var(--transition-fast);
}

.settings-action-bar--dirty {
  border-color: color-mix(in srgb, var(--settings-active-color) 50%, var(--glass-border));
}

.settings-action-bar__dot {
  background: var(--settings-active-color) !important;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--settings-active-color) 22%, transparent) !important;
}

.settings-action-bar__status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-small);
  color: var(--text-secondary);
  font-weight: var(--font-weight-medium);
}

.settings-action-bar--dirty .settings-action-bar__status {
  color: var(--text-primary);
}

.settings-action-bar__dot {
  display: inline-block;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: var(--radius-full);
  background: var(--accent-teal);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent-teal) 22%, transparent);
  animation: settings-pulse 1.8s ease-in-out infinite;
}

.settings-action-bar__buttons {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

@keyframes settings-pulse {
  0%, 100% {
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent-teal) 22%, transparent);
  }
  50% {
    box-shadow: 0 0 0 7px color-mix(in srgb, var(--accent-teal) 8%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .settings-action-bar__dot {
    animation: none;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .stagger-in > * {
    animation: fade-in-up 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .stagger-in > *:nth-child(1) {
    animation-delay: 0ms;
  }

  .stagger-in > *:nth-child(2) {
    animation-delay: 100ms;
  }

  .stagger-in > *:nth-child(3) {
    animation-delay: 200ms;
  }

  .stagger-in > *:nth-child(4) {
    animation-delay: 300ms;
  }

  .stagger-in > *:nth-child(5) {
    animation-delay: 400ms;
  }

  .stagger-in > *:nth-child(n + 6) {
    animation-delay: 500ms;
  }

  .option-card.is-active,
  .option-pill.is-active,
  .preference-pill.is-active,
  .theme-option.is-active,
  .toggle-row.is-active {
    animation: chip-bounce 360ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(0.75rem);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes chip-bounce {
  0% {
    transform: translateY(0) scale(0.96);
  }

  55% {
    transform: translateY(-0.0625rem) scale(1.03);
  }

  100% {
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 900px) {
  .profile-hero,
  .field-grid {
    grid-template-columns: 1fr;
  }

  .field-group--wide {
    grid-column: auto;
  }
}

@media (max-width: 720px) {
  .section-header,
  .toggle-row,
  .tutorial-card__actions,
  .form-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .tutorial-card__copy {
    grid-template-columns: 1fr;
  }

  .form-actions {
    grid-template-columns: 1fr;
  }

  .form-actions :deep(.scope-button),
  .tutorial-card__actions :deep(.scope-button) {
    width: 100%;
    margin-left: 0;
  }

  .settings-action-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .settings-action-bar__buttons {
    flex-direction: column;
  }

  .settings-action-bar__buttons :deep(.scope-button) {
    width: 100%;
  }

  .theme-option,
  .option-card {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .stagger-in > *,
  .option-card.is-active,
  .option-pill.is-active,
  .preference-pill.is-active,
  .theme-option.is-active,
  .toggle-row.is-active {
    opacity: 1;
    animation: none;
  }

  .settings-section,
  .profile-avatar-shell :deep(img),
  .profile-avatar__camera,
  .option-card,
  .option-pill,
  .preference-pill,
  .theme-option,
  .tutorial-card,
  .toggle-row,
  .toggle-switch__thumb {
    transition-duration: 1ms;
  }

  .settings-section:hover,
  .settings-section:focus-within,
  .option-card:hover,
  .option-card:focus-visible,
  .option-card:active,
  .option-pill:hover,
  .option-pill:focus-visible,
  .option-pill:active,
  .preference-pill:hover,
  .preference-pill:focus-visible,
  .preference-pill:active,
  .theme-option:hover,
  .theme-option:focus-visible,
  .theme-option:active,
  .tutorial-card:hover,
  .tutorial-card:focus-within,
  .toggle-row:hover,
  .toggle-row:focus-visible,
  .toggle-row:active,
  .profile-avatar__camera:hover,
  .profile-avatar__camera:focus-visible,
  .profile-avatar__camera:active {
    transform: none;
  }
}
</style>
