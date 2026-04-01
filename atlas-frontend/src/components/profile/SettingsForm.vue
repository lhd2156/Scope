<template>
  <form class="settings-form stagger-in" @submit.prevent="submitForm">
    <section id="settings-account" class="surface-card settings-section" tabindex="-1" data-test="settings-section-account">
      <div class="section-header">
        <div class="section-heading">
          <span class="section-icon" aria-hidden="true">
            <AtlasIcon name="user" />
          </span>
          <div>
            <p class="eyebrow">Account</p>
            <h3>Account overview</h3>
          </div>
        </div>
        <span class="meta-pill">{{ syncModeLabel }}</span>
      </div>

      <div class="account-grid">
        <div class="account-block">
          <span class="account-label">Signed in as</span>
          <strong>{{ accountEmail || 'signed-in@atlas.travel' }}</strong>
        </div>
        <div class="account-block">
          <span class="account-label">Workspace mode</span>
          <strong>{{ syncModeLabel }}</strong>
        </div>
      </div>

      <p class="section-copy">{{ syncModeDescription }}</p>
    </section>

    <section id="settings-profile" class="surface-card settings-section" tabindex="-1" data-test="settings-section-profile">
      <div class="section-header">
        <div class="section-heading">
          <span class="section-icon" aria-hidden="true">
            <AtlasIcon name="camera" />
          </span>
          <div>
            <p class="eyebrow">Profile</p>
            <h3>Traveler identity</h3>
          </div>
        </div>
      </div>

      <div class="profile-hero">
        <div class="profile-avatar-shell">
          <Avatar :name="form.displayName || 'Atlas traveler'" :src="form.avatarUrl || undefined" :size="112" class="profile-avatar" />
          <button type="button" class="profile-avatar__camera" aria-label="Update avatar" @click="focusAvatarField">
            <AtlasIcon name="camera" label="Update avatar" />
          </button>
        </div>

        <div class="profile-hero__copy">
          <strong>{{ form.displayName || 'Atlas traveler' }}</strong>
          <p>{{ form.homeBase || 'Add your home base so collaborators know where your routes begin.' }}</p>
        </div>
      </div>

      <div class="field-grid">
        <label class="field-group">
          <span>Display name</span>
          <input v-model.trim="form.displayName" type="text" maxlength="80" placeholder="How your name appears in Atlas" />
        </label>

        <label class="field-group">
          <span>Home base</span>
          <input v-model.trim="form.homeBase" type="text" maxlength="120" placeholder="Fort Worth, TX" />
        </label>

        <label class="field-group field-group--wide">
          <span>Avatar URL</span>
          <input
            ref="avatarUrlInputRef"
            v-model.trim="form.avatarUrl"
            type="url"
            maxlength="240"
            placeholder="https://images.example.com/avatar.jpg"
          />
        </label>

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
            <AtlasIcon name="lock" />
          </span>
          <div>
            <p class="eyebrow">Privacy</p>
            <h3>Visibility controls</h3>
          </div>
        </div>
      </div>

      <p class="section-copy">Choose how broadly Atlas shares your profile, saved routes, and collaboration availability.</p>

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
            <AtlasIcon name="bell" />
          </span>
          <div>
            <p class="eyebrow">Notifications</p>
            <h3>How Atlas should reach you</h3>
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
            <AtlasIcon name="settings" />
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
              <AtlasIcon name="moon" label="Dark mode" />
              <span>Dark</span>
            </button>
            <button
              data-test="theme-option-light"
              type="button"
              class="theme-option"
              :class="{ 'is-active': form.themeMode === 'light' }"
              @click="selectTheme('light')"
            >
              <AtlasIcon name="sun" label="Light mode" />
              <span>Light</span>
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
                { 'is-active': form.categoryPreferences.includes(category) },
                form.categoryPreferences.includes(category) ? `badge-${category}` : '',
              ]"
              @click="toggleCategory(category)"
            >
              {{ formatCategory(category) }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <p v-if="errorMessage" class="error-copy">{{ errorMessage }}</p>

    <div class="form-actions">
      <Button data-test="settings-cancel" type="button" variant="secondary" @click="resetForm">Cancel</Button>
      <Button data-test="settings-save" type="submit" :loading="submitting">Save Changes</Button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import Avatar from '@/components/common/Avatar.vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import Button from '@/components/common/Button.vue';
import { setAnalyticsConsent, useAnalyticsConsent } from '@/utils/analyticsConsent';
import { applyTheme, initializeTheme, useTheme } from '@/utils/theme';
import type { SpotCategory, ThemeMode } from '@/types';

export interface SettingsFormValue {
  displayName: string;
  avatarUrl: string;
  bio: string;
  homeBase: string;
  privacy: 'public' | 'friends' | 'private';
  tripInvites: 'instant' | 'daily' | 'weekly';
  emailAlerts: boolean;
  categoryPreferences: SpotCategory[];
  themeMode: ThemeMode;
}

const categories: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'scenic', 'other'];
const privacyOptions = [
  { value: 'public' as const, label: 'Public', description: 'Anyone on Atlas can discover your profile and saved routes.' },
  { value: 'friends' as const, label: 'Friends only', description: 'Only accepted connections see your full planning context.' },
  { value: 'private' as const, label: 'Private', description: 'Keep your profile visible only to the trips you explicitly join.' },
];
const inviteCadenceOptions = [
  { value: 'instant' as const, label: 'Instant' },
  { value: 'daily' as const, label: 'Daily digest' },
  { value: 'weekly' as const, label: 'Weekly digest' },
];

const props = withDefaults(
  defineProps<{
    initialValue: SettingsFormValue;
    submitting?: boolean;
    accountEmail?: string;
    syncModeLabel?: string;
    syncModeDescription?: string;
  }>(),
  {
    submitting: false,
    accountEmail: '',
    syncModeLabel: 'API-backed',
    syncModeDescription: 'Changes sync through the Atlas account API.',
  },
);

const emit = defineEmits<{
  (event: 'submit', payload: SettingsFormValue): void;
}>();

initializeTheme();
const theme = useTheme();
const { consent } = useAnalyticsConsent();
const avatarUrlInputRef = ref<HTMLInputElement | null>(null);
const form = reactive<SettingsFormValue>(cloneSettingsFormValue(props.initialValue));
const errorMessage = defineModel<string>('errorMessage', { default: '' });

const analyticsConsentEnabled = computed(() => consent.value === 'granted');
const analyticsConsentStatusLabel = computed(() => {
  switch (consent.value) {
    case 'granted':
      return 'Analytics enabled — Atlas can measure optional usage patterns to improve route planning, map ergonomics, and product quality.';
    case 'denied':
      return 'Analytics opted out — Atlas keeps only the essential storage needed for sign-in, theme, onboarding, and offline reliability.';
    default:
      return 'No analytics choice saved yet — the cookie banner will keep asking until you explicitly allow analytics or opt out.';
  }
});
const analyticsConsentCopy = computed(() => {
  switch (consent.value) {
    case 'granted':
      return 'Optional analytics are on for page usage, map interaction, and trip-planning improvements.';
    case 'denied':
      return 'Only necessary storage is active. Turn this back on any time if you want to share anonymous usage analytics.';
    default:
      return 'Turn this on to allow optional analytics, or leave it off if you prefer to keep only necessary storage.';
  }
});

watch(
  () => props.initialValue,
  (nextValue) => {
    Object.assign(form, cloneSettingsFormValue(nextValue));
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

function cloneSettingsFormValue(value: SettingsFormValue): SettingsFormValue {
  return {
    ...value,
    categoryPreferences: [...value.categoryPreferences],
  };
}

function formatCategory(category: SpotCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function focusAvatarField(): void {
  void nextTick(() => {
    avatarUrlInputRef.value?.focus();
  });
}

function selectTheme(themeMode: ThemeMode): void {
  form.themeMode = themeMode;
  applyTheme(themeMode, { track: true, source: 'settings' });
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

function resetForm(): void {
  Object.assign(form, cloneSettingsFormValue(props.initialValue));
  applyTheme(props.initialValue.themeMode);
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
    avatarUrl: form.avatarUrl.trim(),
    bio: form.bio.trim(),
    homeBase: form.homeBase.trim(),
    categoryPreferences: [...form.categoryPreferences],
  });
}
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
.form-actions {
  display: grid;
}

.settings-form {
  gap: var(--space-5);
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
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);
}

.settings-section:hover,
.settings-section:focus-within {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  border-color: var(--border-hover);
}

.section-header,
.account-grid,
.option-grid,
.pill-row,
.theme-switch,
.form-actions {
  display: flex;
}

.section-header,
.account-grid,
.option-grid,
.pill-row,
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
  background: color-mix(in srgb, var(--accent-teal-light) 100%, transparent);
  color: var(--accent-teal);
}

.section-icon :deep(.atlas-icon) {
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
.profile-hero__copy p {
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
  width: fit-content;
  overflow: hidden;
  border-radius: var(--radius-full);
}

.profile-avatar {
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-lg);
}

.settings-section:hover .profile-avatar-shell :deep(img),
.settings-section:focus-within .profile-avatar-shell :deep(img) {
  transform: scale(1.06);
}

.profile-avatar-shell :deep(img) {
  transition: transform var(--transition-slow);
}

.profile-avatar__camera {
  position: absolute;
  right: var(--space-2);
  bottom: var(--space-2);
  width: 2.5rem;
  height: 2.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--glass-bg) 92%, transparent);
  color: var(--text-primary);
  backdrop-filter: var(--glass-blur);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.profile-avatar__camera:hover,
.profile-avatar__camera:focus-visible {
  outline: none;
  transform: translateY(-1px);
  border-color: var(--border-hover);
  box-shadow: var(--shadow-glow-teal);
}

.profile-avatar__camera:active {
  transform: translateY(0) scale(0.97);
}

.profile-avatar__camera :deep(.atlas-icon) {
  width: 1rem;
  height: 1rem;
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
  gap: var(--space-4);
}

.field-group {
  gap: var(--space-2);
}

.field-group--wide {
  grid-column: 1 / -1;
}

.field-group input,
.field-group textarea {
  width: 100%;
  padding: 0.95rem 1rem;
  border: 1px solid var(--input-border);
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--input-bg) 92%, transparent);
  color: var(--text-primary);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    background var(--transition-fast);
}

.field-group textarea {
  resize: vertical;
}

.field-group input::placeholder,
.field-group textarea::placeholder {
  color: var(--input-placeholder);
}

.field-group input:focus-visible,
.field-group textarea:focus-visible {
  outline: none;
  border-color: var(--input-focus);
  box-shadow: var(--shadow-glow-teal);
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
  border: 1px solid color-mix(in srgb, var(--glass-border) 68%, var(--border) 32%);
  background: color-mix(in srgb, var(--bg-primary) 74%, transparent);
  color: var(--text-primary);
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast),
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
  transform: translateY(-1px);
  border-color: var(--border-hover);
  box-shadow: var(--shadow-md);
}

.option-card:active,
.option-pill:active,
.preference-pill:active,
.theme-option:active,
.toggle-row:active {
  transform: translateY(0) scale(0.97);
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
  border-color: var(--accent-teal);
  background: color-mix(in srgb, var(--accent-teal-light) 82%, var(--bg-primary) 18%);
  box-shadow: var(--shadow-glow-teal);
}

.option-pill,
.preference-pill,
.theme-option {
  display: inline-flex;
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

.preference-pill.is-active {
  box-shadow: var(--shadow-glow-teal);
}

.theme-switch {
  gap: var(--space-3);
  flex-wrap: wrap;
}

.theme-option {
  flex: 1 1 11rem;
}

.theme-option :deep(.atlas-icon) {
  width: 1rem;
  height: 1rem;
}

.settings-stack {
  gap: var(--space-4);
}

.settings-block {
  gap: var(--space-3);
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
  background: color-mix(in srgb, var(--accent-teal-light) 88%, transparent);
  border-color: var(--accent-teal);
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

.form-actions :deep(.atlas-button) {
  min-width: 9rem;
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
  .form-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .form-actions {
    grid-template-columns: 1fr;
  }

  .form-actions :deep(.atlas-button) {
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
