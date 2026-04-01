<template>
  <AppShell>
    <div class="page-container page-stack settings-page">
      <section class="glass-panel settings-shell">
        <div class="settings-shell__copy">
          <p class="eyebrow">Settings</p>
          <h1>Shape how Atlas looks, feels, and shares your story.</h1>
          <p class="section-copy">
            Fine-tune profile visibility, notifications, appearance, and the travel preferences that keep your routes personal.
          </p>
        </div>

        <div class="settings-shell__meta">
          <span class="meta-pill">{{ syncModeLabel }}</span>
          <span class="meta-pill meta-pill--muted">{{ authStore.currentUser?.email || 'Atlas member' }}</span>
        </div>
      </section>

      <section class="settings-workspace">
        <aside class="glass-panel settings-sidebar" data-test="settings-sidebar">
          <div>
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
              <span>{{ section.label }}</span>
            </button>
          </nav>
        </aside>

        <article class="glass-panel settings-main">
          <SettingsForm
            v-model:error-message="formError"
            :initial-value="settingsValue"
            :submitting="isSaving"
            :account-email="authStore.currentUser?.email ?? ''"
            :sync-mode-label="syncModeLabel"
            :sync-mode-description="syncModeDescription"
            @submit="handleSave"
          />
        </article>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppShell from '@/components/common/AppShell.vue';
import SettingsForm, { type SettingsFormValue } from '@/components/profile/SettingsForm.vue';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toasts';
import { useUserStore } from '@/stores/user';
import { USER_MOCK_FALLBACK_ENABLED } from '@/services/demoMode';
import { useReducedMotion } from '@/utils/motion';
import { getStoredTheme } from '@/utils/theme';
import type { SpotCategory } from '@/types';

const PROFILE_PREVIEW_MODE_ENABLED = USER_MOCK_FALLBACK_ENABLED;

const PREFERENCE_CATEGORIES: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'scenic', 'other'];
const DEFAULT_CATEGORY_PREFERENCES: SpotCategory[] = ['food', 'culture', 'adventure'];
const settingsSections = [
  { id: 'settings-account', label: 'Account' },
  { id: 'settings-profile', label: 'Profile' },
  { id: 'settings-privacy', label: 'Privacy' },
  { id: 'settings-notifications', label: 'Notifications' },
  { id: 'settings-appearance', label: 'Appearance' },
] as const;

type SettingsSectionId = (typeof settingsSections)[number]['id'];

const authStore = useAuthStore();
const toastStore = useToastStore();
const userStore = useUserStore();
const reducedMotion = useReducedMotion();
const activeSection = ref<SettingsSectionId>('settings-account');
const formError = ref('');
const settingsValue = ref<SettingsFormValue>({
  displayName: 'Atlas traveler',
  avatarUrl: '',
  bio: '',
  homeBase: '',
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
    : 'Changes sync through the account API. If the service is unavailable, Atlas shows the save failure instead of silently swapping to demo data.',
);
const successToastMessage = computed(() =>
  PROFILE_PREVIEW_MODE_ENABLED
    ? 'Profile details refreshed in the local preview workspace.'
    : 'Profile details synced across your Atlas account.',
);

watch(
  () => authStore.currentUser,
  (currentUser) => {
    settingsValue.value = {
      displayName: currentUser?.displayName ?? 'Atlas traveler',
      avatarUrl: currentUser?.avatarUrl ?? '',
      bio: currentUser?.bio ?? '',
      homeBase: currentUser?.homeBase ?? '',
      privacy: 'friends',
      tripInvites: 'instant',
      emailAlerts: true,
      categoryPreferences: toCategoryPreferences(currentUser?.interests),
      themeMode: getStoredTheme(),
    };
  },
  { immediate: true },
);

function toCategoryPreferences(interests?: string[]): SpotCategory[] {
  const matchedCategories = (interests ?? []).filter((interest): interest is SpotCategory =>
    PREFERENCE_CATEGORIES.includes(interest as SpotCategory),
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

async function handleSave(payload: SettingsFormValue) {
  if (!authStore.currentUser?.id) {
    const missingSessionMessage = 'Sign in again to update your Atlas settings.';
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
      displayName: payload.displayName,
      avatarUrl: payload.avatarUrl || undefined,
      bio: payload.bio || undefined,
      homeBase: payload.homeBase || undefined,
    });

    settingsValue.value = payload;
    toastStore.showSuccess({
      title: 'Settings saved',
      message: successToastMessage.value,
    });
  } catch {
    const saveErrorMessage = userStore.error ?? 'Atlas could not save your settings right now.';
    formError.value = saveErrorMessage;
    toastStore.showError({
      title: 'Settings not saved',
      message: saveErrorMessage,
    });
  }
}
</script>

<style scoped>
.settings-page,
.settings-shell,
.settings-shell__copy,
.settings-sidebar,
.settings-nav {
  display: grid;
}

.settings-page {
  gap: var(--section-gap);
}

.settings-shell,
.settings-sidebar,
.settings-main {
  padding: clamp(var(--space-5), 3vw, var(--space-8));
}

.settings-shell {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: var(--space-6);
}

.settings-shell__copy {
  gap: var(--space-3);
  max-width: var(--copy-measure-wide);
}

.settings-shell__copy h1,
.settings-sidebar h2,
.meta-pill {
  margin: 0;
}

.settings-shell__copy h1 {
  font-size: var(--font-size-h1);
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-display);
}

.eyebrow {
  margin: 0;
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-eyebrow);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}

.settings-shell__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-3);
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.7rem 1rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal-light) 100%, transparent);
  color: var(--accent-teal);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.meta-pill--muted {
  background: color-mix(in srgb, var(--glass-bg) 92%, transparent);
  color: var(--text-primary);
  border: 1px solid var(--glass-border);
}

.settings-workspace {
  display: grid;
  grid-template-columns: 15rem minmax(0, 1fr);
  gap: var(--space-6);
  align-items: start;
}

.settings-sidebar {
  position: sticky;
  top: calc(var(--shell-content-top) + var(--space-3));
  gap: var(--space-4);
}

.settings-sidebar h2 {
  font-size: var(--font-size-h2);
  line-height: var(--line-height-tight);
}

.settings-nav {
  gap: var(--space-2);
}

.settings-nav__button {
  position: relative;
  width: 100%;
  padding: 0.85rem 1rem 0.85rem 1.2rem;
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

.settings-nav__button::before {
  content: '';
  position: absolute;
  left: 0.55rem;
  top: 0.6rem;
  bottom: 0.6rem;
  width: 0.2rem;
  border-radius: var(--radius-full);
  background: var(--accent-teal);
  opacity: 0;
  transform: scaleY(0.4);
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.settings-nav__button:hover,
.settings-nav__button:focus-visible {
  outline: none;
  color: var(--text-primary);
  transform: translateY(-1px);
  background: color-mix(in srgb, var(--glass-bg) 88%, transparent);
  border-color: var(--glass-border);
  box-shadow: var(--shadow-md);
}

.settings-nav__button.is-active {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--accent-teal-light) 72%, transparent);
  border-color: color-mix(in srgb, var(--accent-teal) 22%, var(--glass-border) 78%);
  box-shadow: var(--shadow-glow-teal);
}

.settings-nav__button.is-active::before {
  opacity: 1;
  transform: scaleY(1);
}

.settings-main {
  display: grid;
}

@media (max-width: 1080px) {
  .settings-shell,
  .settings-workspace {
    grid-template-columns: 1fr;
  }

  .settings-shell__meta {
    justify-content: flex-start;
  }

  .settings-sidebar {
    position: static;
  }

  .settings-nav {
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  }
}

@media (max-width: 720px) {
  .settings-shell__meta {
    flex-direction: column;
    align-items: stretch;
  }

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
