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
        <div class="home-base-panel__copy">
          <p class="eyebrow">Optional</p>
          <h2 id="home-base-title">Want to add a home base?</h2>
          <p>
            Add a city only if you want local recommendations. Scope leaves this blank until you choose it.
          </p>
        </div>

        <label class="home-base-field">
          <span>Home base</span>
          <input
            v-model="homeBase"
            type="text"
            autocomplete="address-level2"
            maxlength="80"
            placeholder="City, region, or leave blank"
          />
        </label>
      </section>

      <section class="profile-photo-panel" aria-labelledby="profile-photo-title">
        <div class="profile-photo-panel__identity">
          <Avatar :name="profileDisplayName" :src="profilePhotoPreview || undefined" :size="64" />
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
            v-if="profilePhotoPreview"
            type="button"
            class="photo-clear-button"
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
          :disabled="selectedInterests.length === 0"
          @click="submit"
        >
          Continue to Scope
        </Button>
      </footer>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Avatar from '@/components/common/Avatar.vue';
import Button from '@/components/common/Button.vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import { useAuthStore } from '@/stores/auth';
import type { SpotCategory } from '@/types';
import { sanitizeAvatarUrl } from '@/utils/sanitizers';

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
  { value: 'food', label: 'Food & drink', icon: 'food', description: 'Chef-led kitchens, hidden bars, street-food crawls.' },
  { value: 'nature', label: 'Nature escapes', icon: 'nature', description: 'Trails, coastal overlooks, sunrise camping spots.' },
  { value: 'culture', label: 'Culture & arts', icon: 'culture', description: 'Galleries, concerts, historic walks with context.' },
  { value: 'nightlife', label: 'Nightlife', icon: 'nightlife', description: 'Rooftop lounges, live sets, late-night energy.' },
  { value: 'adventure', label: 'Adventure', icon: 'adventure', description: 'Climbing, paddling, anything off the beaten map pin.' },
  { value: 'scenic', label: 'Scenic routes', icon: 'scenic', description: 'Overlooks, drives, and slow-travel moments.' },
  { value: 'shopping', label: 'Shopping & makers', icon: 'shopping', description: 'Local designers, vintage finds, artisan markets.' },
  { value: 'other', label: 'Surprise me', icon: 'sparkle', description: "Let Scope mix genres when you're feeling spontaneous." },
];

const MAX_SELECTION = 6;
const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;
const PROFILE_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const selectedInterests = ref<SpotCategory[]>([
  ...((authStore.currentUser?.interests ?? []) as SpotCategory[]),
]);
const homeBase = ref(authStore.currentUser?.homeBase ?? '');
const profilePhotoUrl = ref(sanitizeAvatarUrl(authStore.currentUser?.avatarUrl) ?? '');
const selectedProfilePhotoObjectUrl = ref('');
const isSubmitting = ref(false);
const formError = ref('');
let shouldRetainProfilePhotoObjectUrl = false;

const profileDisplayName = computed(() => authStore.currentUser?.displayName || 'Scope traveler');
const profilePhotoPreview = computed(() => sanitizeAvatarUrl(profilePhotoUrl.value) ?? '');

const selectionHelperCopy = computed(() => {
  const count = selectedInterests.value.length;
  if (count === 0) return 'Pick at least one to continue. You can always change this later.';
  if (count === 1) return "Nice — we'll mix this in across your feed, map, and trip picks.";
  if (count >= MAX_SELECTION) return `Cap reached (${MAX_SELECTION}). Remove one to add a different vibe.`;
  return `${count} vibes selected. Keep picking or hit continue when you're ready.`;
});

function toggleInterest(value: SpotCategory) {
  const index = selectedInterests.value.indexOf(value);
  if (index >= 0) {
    selectedInterests.value.splice(index, 1);
    return;
  }

  if (selectedInterests.value.length >= MAX_SELECTION) {
    formError.value = `You can pick up to ${MAX_SELECTION} vibes. Deselect one first.`;
    return;
  }

  formError.value = '';
  selectedInterests.value.push(value);
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

function resolveRedirectTarget(): string {
  const redirectTarget = typeof route.query.redirect === 'string' ? route.query.redirect : '';
  return redirectTarget || '/';
}

async function submit() {
  if (selectedInterests.value.length === 0) {
    formError.value = 'Pick at least one vibe so Scope can personalize your feed.';
    return;
  }

  isSubmitting.value = true;
  formError.value = '';

  try {
    authStore.updateCurrentUser(buildPreferenceUpdate());
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
  authStore.updateCurrentUser(buildPreferenceUpdate());
  await router.push(resolveRedirectTarget());
}

onBeforeUnmount(() => {
  revokeSelectedProfilePhotoUrl();
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
  grid-template-columns: minmax(0, 1fr) minmax(14rem, 20rem);
  gap: var(--space-4);
  align-items: center;
  padding: var(--space-4);
  border: 1px solid color-mix(in srgb, var(--glass-border) 86%, var(--border));
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--bg-tertiary) 76%, transparent);
}

.home-base-panel__copy {
  display: grid;
  gap: var(--space-2);
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
}

.home-base-field {
  display: grid;
  gap: var(--space-2);
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
}

.home-base-field input {
  width: 100%;
  min-height: 3rem;
  padding: 0 0.95rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 90%, var(--border));
  border-radius: var(--radius-lg);
  background: var(--bg-primary);
  color: var(--text-primary);
  font: inherit;
  font-weight: var(--font-weight-regular);
}

.home-base-field input:focus {
  border-color: color-mix(in srgb, var(--accent-teal) 64%, var(--border));
  box-shadow: 0 0 0 0.18rem color-mix(in srgb, var(--accent-teal) 16%, transparent);
  outline: none;
}

.home-base-field input::placeholder {
  color: var(--text-muted);
}

.profile-photo-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid color-mix(in srgb, var(--glass-border) 86%, var(--border));
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--bg-tertiary) 76%, transparent);
}

.profile-photo-panel__identity {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
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
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  flex-wrap: wrap;
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

@media (max-width: 560px) {
  .home-base-panel {
    grid-template-columns: 1fr;
  }

  .profile-photo-panel,
  .profile-photo-panel__identity,
  .profile-photo-panel__actions {
    align-items: stretch;
  }

  .profile-photo-panel,
  .profile-photo-panel__actions {
    flex-direction: column;
  }

  .profile-photo-panel__identity {
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
  .preference-chip {
    transition: none;
  }
}
</style>
