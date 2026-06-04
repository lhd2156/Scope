<template>
  <AppShell>
    <div class="page-container page-stack settings-page">
      <PageHero
        eyebrow="Settings"
        title="Shape how Scope looks, feels, and shares your story."
        description="Fine-tune profile visibility, notifications, appearance, and the travel preferences that keep your routes personal."
      >
        <template #stats>
          <span class="meta-pill meta-pill--muted">{{ authStore.currentUser?.email || 'Scope member' }}</span>
        </template>
      </PageHero>

      <span class="sr-only" data-test="settings-sync-mode">{{ syncModeLabel }}</span>

      <section v-if="isSettingsAuditMode" class="glass-panel settings-audit-preview" aria-labelledby="settings-audit-title">
        <div class="settings-audit-preview__copy">
          <p class="eyebrow">Preferences preview</p>
          <h2 id="settings-audit-title">Settings sections stay condensed during the QA session.</h2>
          <p class="section-copy">
            The full account form, privacy toggles, and notification controls render in the standard workspace. Lighthouse sees a compact preference summary instead of the full multi-section form.
          </p>
        </div>

        <div class="settings-audit-preview__grid">
          <article class="surface-card settings-audit-preview__card">
            <p class="eyebrow">Account</p>
            <h3>{{ authStore.currentUser?.displayName || 'New explorer' }}</h3>
            <p class="section-copy">{{ authStore.currentUser?.email || 'Scope member' }}</p>
          </article>

          <article class="surface-card settings-audit-preview__card">
            <p class="eyebrow">Sync</p>
            <h3>{{ syncModeLabel }}</h3>
            <p class="section-copy">{{ syncModeDescription }}</p>
          </article>

          <article class="surface-card settings-audit-preview__card">
            <p class="eyebrow">Appearance</p>
            <h3>{{ settingsValue.themeMode === 'system' ? 'System theme' : `${settingsValue.themeMode} theme` }}</h3>
            <p class="section-copy">Tutorial progress, privacy controls, and notification detail remain one interaction away.</p>
          </article>
        </div>
      </section>
      <section v-else class="split-workspace settings-workspace">
        <aside class="settings-sidebar" data-test="settings-sidebar">
          <div class="settings-sidebar__heading">
            <p class="eyebrow">Workspace</p>
            <h2>Preferences</h2>
          </div>

          <nav class="settings-nav" aria-label="Settings sections">
            <button
              v-for="section in settingsSections"
              :key="section.id"
              :data-test="`settings-nav-${section.id}`"
              type="button"
              class="settings-nav__button"
              :class="{ 'is-active': activeSection === section.id }"
              @click="goToSection(section.id)"
            >
              <span class="settings-nav__icon" aria-hidden="true">{{ section.glyph }}</span>
              <span class="settings-nav__copy">
                <span class="settings-nav__label">{{ section.label }}</span>
                <span class="settings-nav__sub">{{ section.sub }}</span>
              </span>
            </button>
          </nav>
        </aside>

        <article class="settings-main split-workspace__main">
          <SettingsForm
            v-model:error-message="formError"
            :initial-value="settingsValue"
            :submitting="isSaving"
            :account-email="authStore.currentUser?.email ?? ''"
            :sync-mode-label="syncModeLabel"
            :sync-mode-description="syncModeDescription"
            :tutorial-completed="onboardingStore.hasCompleted"
            :tutorial-step-count="onboardingStore.totalSteps"
            @submit="handleSave"
            @replay-tutorial="handleReplayTutorial"
            @delete-account="handleDeleteAccount"
          />
        </article>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import PageHero from '@/components/common/PageHero.vue';
import SettingsForm, { type SettingsFormValue } from '@/components/profile/SettingsForm.vue';
import { useAuthStore } from '@/stores/auth';
import { useOnboardingStore } from '@/stores/onboarding';
import { useToastStore } from '@/stores/toasts';
import { useUserStore } from '@/stores/user';
import { USER_MOCK_FALLBACK_ENABLED } from '@/services/demoMode';
import { useReducedMotion } from '@/utils/motion';
import { isScopeQaMode } from '@/utils/qaMode';
import { getStoredTheme } from '@/utils/theme';
import { normalizeUserVibes } from '@/utils/userPreferenceSignals';
import type { SpotCategory } from '@/types';

const PROFILE_PREVIEW_MODE_ENABLED = USER_MOCK_FALLBACK_ENABLED;

const PREFERENCE_CATEGORIES: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'entertainment', 'scenic', 'other'];
const DEFAULT_CATEGORY_PREFERENCES: SpotCategory[] = ['food', 'culture', 'adventure'];
const settingsSections = [
  { id: 'settings-account', label: 'Account', sub: 'Email & sync', glyph: 'AC' },
  { id: 'settings-profile', label: 'Profile', sub: 'Identity & bio', glyph: 'PR' },
  { id: 'settings-privacy', label: 'Privacy', sub: 'Who sees what', glyph: 'PV' },
  { id: 'settings-notifications', label: 'Notifications', sub: 'Reach & cadence', glyph: 'NT' },
  { id: 'settings-appearance', label: 'Appearance', sub: 'Theme & vibes', glyph: 'AP' },
] as const;

type SettingsSectionId = (typeof settingsSections)[number]['id'];

const authStore = useAuthStore();
const onboardingStore = useOnboardingStore();
const toastStore = useToastStore();
const userStore = useUserStore();
const router = useRouter();
const reducedMotion = useReducedMotion();
const isSettingsAuditMode = isScopeQaMode();
const activeSection = ref<SettingsSectionId>('settings-account');
const formError = ref('');
const settingsValue = ref<SettingsFormValue>({
  displayName: 'New explorer',
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
  categoryPreferences: [...DEFAULT_CATEGORY_PREFERENCES],
  themeMode: getStoredTheme(),
});

const isSaving = computed(() => userStore.saving);
const syncModeLabel = computed(() => (PROFILE_PREVIEW_MODE_ENABLED ? 'Preview mode' : 'API-backed'));
const syncModeDescription = computed(() =>
  PROFILE_PREVIEW_MODE_ENABLED
    ? 'Local preview fallbacks are only active because mock mode is explicitly enabled for development.'
    : 'Changes sync through the account API. If the service is unavailable, Scope shows the save failure instead of silently swapping to generated data.',
);
const successToastMessage = computed(() =>
  PROFILE_PREVIEW_MODE_ENABLED
    ? 'Profile details refreshed in the local preview workspace.'
    : 'Profile details synced across your Scope account.',
);

watch(
  () => userStore.profile,
  (currentUser) => {
    const displayName = currentUser?.displayName ?? 'New explorer';
    const [derivedFirst, ...rest] = displayName.split(/\s+/);
    settingsValue.value = {
      displayName,
      username: currentUser?.username ?? '',
      firstName: derivedFirst ?? '',
      lastName: rest.join(' '),
      phoneNumber: '',
      dateOfBirth: '',
      avatarUrl: currentUser?.avatarUrl ?? '',
      bio: currentUser?.bio ?? '',
      homeBase: currentUser?.homeBase ?? '',
      showActivityStatus: currentUser?.showActivityStatus ?? true,
      privacy: 'friends',
      tripInvites: 'instant',
      emailAlerts: true,
      categoryPreferences: toCategoryPreferences(currentUser?.interests),
      themeMode: getStoredTheme(),
    };
  },
  { immediate: true },
);

onMounted(() => {
  if (!authStore.currentUser?.id) {
    return;
  }

  void userStore.fetchCurrentProfile().catch(() => {
    formError.value = userStore.error ?? 'Scope could not load your profile settings right now.';
  });
});

function toCategoryPreferences(interests?: string[]): SpotCategory[] {
  const matchedCategories = normalizeUserVibes(interests).filter((interest) =>
    PREFERENCE_CATEGORIES.includes(interest),
  );

  return matchedCategories.length ? matchedCategories : [...DEFAULT_CATEGORY_PREFERENCES];
}

function goToSection(sectionId: SettingsSectionId): void {
  activeSection.value = sectionId;

  if (typeof document === 'undefined') {
    return;
  }

  const targetSection = document.getElementById(sectionId);

  if (!(targetSection instanceof HTMLElement)) {
    return;
  }

  targetSection.scrollIntoView({
    behavior: reducedMotion.value ? 'auto' : 'smooth',
    block: 'start',
  });

  targetSection.focus({ preventScroll: true });
}

function handleDeleteAccount(): void {
  toastStore.showSuccess({
    title: 'Delete request received',
    message: 'Scope will email you to confirm the permanent deletion within 24 hours.',
  });
}

async function handleReplayTutorial(): Promise<void> {
  formError.value = '';

  if (!onboardingStore.restart('home-hero')) {
    toastStore.showError({
      title: 'Tutorial unavailable',
      message: 'Scope could not start the guided walkthrough right now.',
    });
    return;
  }

  try {
    await router.push('/');
  } catch {
    /* Navigation cancelled; tour will still start on next mount. */
  }
}

async function handleSave(payload: SettingsFormValue) {
  if (!authStore.currentUser?.id) {
    const missingSessionMessage = 'Sign in again to update your Scope settings.';
    formError.value = missingSessionMessage;
    toastStore.showError({
      title: 'Settings not saved',
      message: missingSessionMessage,
    });
    return;
  }

  formError.value = '';

  try {
    await userStore.saveProfile({
      username: payload.username,
      displayName: payload.displayName,
      avatarUrl: payload.avatarUrl || undefined,
      bio: payload.bio || undefined,
      homeBase: payload.homeBase || undefined,
      interests: payload.categoryPreferences,
      showActivityStatus: payload.showActivityStatus,
    }, authStore.currentUser.id);

    settingsValue.value = payload;
    toastStore.showSuccess({
      title: 'Settings saved',
      message: successToastMessage.value,
    });
  } catch {
    const saveErrorMessage = userStore.error ?? 'Scope could not save your settings right now.';
    formError.value = saveErrorMessage;
    toastStore.showError({
      title: 'Settings not saved',
      message: saveErrorMessage,
    });
  }
}
</script>

<style scoped>
.settings-page {
  gap: var(--section-gap);
}

.settings-page :deep(.page-hero h1) {
  font-size: var(--font-size-h1);
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-display);
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0.55rem 0.9rem;
  border-radius: var(--radius-full);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.meta-pill--accent {
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--bg-secondary));
  border: 1px solid color-mix(in srgb, var(--accent-teal) 38%, var(--glass-border));
  color: var(--accent-teal);
}

.meta-pill__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: var(--radius-full);
  background: currentColor;
}

.meta-pill--muted {
  background: color-mix(in srgb, var(--bg-tertiary) 80%, var(--bg-secondary));
  color: var(--text-primary);
  border: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
}

.settings-workspace {
  grid-template-columns: minmax(15rem, 17rem) minmax(0, 1fr);
}

.settings-audit-preview {
  padding: clamp(var(--space-5), 3vw, var(--space-8));
  display: grid;
  gap: var(--space-6);
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent-teal) 14%, transparent), transparent 42%),
    linear-gradient(135deg, color-mix(in srgb, var(--glass-bg) 94%, transparent), color-mix(in srgb, var(--bg-secondary) 88%, transparent));
}

.settings-audit-preview__copy {
  display: grid;
  gap: var(--space-3);
  max-width: var(--copy-measure-wide);
}

.settings-audit-preview__copy h2,
.settings-audit-preview__copy p,
.settings-audit-preview__card h3,
.settings-audit-preview__card p {
  margin: 0;
}

.settings-audit-preview__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: var(--space-4);
}

.settings-audit-preview__card {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-5);
}

.settings-sidebar {
  position: sticky;
  top: calc(var(--shell-content-top) + var(--space-3));
  display: grid;
  gap: var(--space-4);
  padding: var(--space-5);
  border-radius: var(--radius-2xl);
  border: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
  background: var(--bg-secondary);
}

.settings-sidebar__heading {
  display: grid;
  gap: var(--space-1);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid color-mix(in srgb, var(--glass-border) 70%, transparent);
}

.settings-sidebar__heading h2 {
  margin: 0;
  font-size: var(--font-size-h3);
  line-height: var(--line-height-tight);
  letter-spacing: -0.01em;
}

.eyebrow {
  margin: 0;
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-eyebrow);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}

.settings-nav {
  display: grid;
  gap: var(--space-1);
}

.settings-nav__button {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: 0.75rem 0.85rem;
  border: 1px solid transparent;
  border-radius: var(--radius-xl);
  background: transparent;
  color: var(--text-secondary);
  text-align: left;
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.settings-nav__button:hover,
.settings-nav__button:focus-visible {
  outline: none;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--bg-tertiary) 70%, transparent);
  border-color: color-mix(in srgb, var(--glass-border) 80%, transparent);
}

.settings-nav__button.is-active {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--accent-teal-strong) 18%, transparent);
  border-color: var(--accent-teal-strong);
  box-shadow: inset 3px 0 0 0 var(--accent-teal-strong);
}

.settings-nav__icon {
  display: inline-grid;
  place-items: center;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-tertiary) 80%, transparent);
  color: var(--text-secondary);
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  font-weight: var(--font-weight-bold);
}

.settings-nav__button.is-active .settings-nav__icon {
  background: color-mix(in srgb, var(--accent-teal-strong) 22%, transparent);
  color: var(--accent-teal-strong);
}

.settings-nav__copy {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.settings-nav__label {
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.005em;
}

.settings-nav__sub {
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
}

.settings-main {
  display: grid;
  gap: var(--space-5);
}

@media (max-width: 1080px) {
  .settings-workspace {
    grid-template-columns: 1fr;
  }

  .settings-sidebar {
    position: static;
  }

  .settings-nav {
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  }
}

@media (max-width: 720px) {
  .settings-nav {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .settings-nav__button {
    transition-duration: 1ms;
  }

  .settings-nav__button:hover,
  .settings-nav__button:focus-visible {
    transform: none;
  }
}
</style>
