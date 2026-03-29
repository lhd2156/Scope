<template>
  <AppShell>
    <div class="page-container page-stack">
      <SectionHeading
        eyebrow="Settings"
        title="Preferences and account controls"
        description="Theme, privacy, notifications, and profile presentation stay organized in one polished workspace."
      />

      <section class="settings-grid">
        <article class="glass-panel settings-card appearance-card">
          <div class="card-heading">
            <div>
              <p class="eyebrow">Appearance</p>
              <h2>Theme mode</h2>
            </div>
            <span class="meta-pill">Dark by default</span>
          </div>
          <p class="section-copy">Atlas ships dark by default with a light mode override for brighter daytime planning.</p>
          <ThemeToggle />
        </article>

        <article class="glass-panel settings-card form-card">
          <div class="card-heading">
            <div>
              <p class="eyebrow">Account</p>
              <h2>Profile and privacy</h2>
            </div>
            <span class="meta-pill">{{ syncModeLabel }}</span>
          </div>
          <p class="section-copy">Update how your profile appears across Atlas, from public identity details to planning preferences.</p>
          <p class="sync-note">
            {{ syncModeDescription }}
          </p>

          <SettingsForm
            v-model:error-message="formError"
            :initial-value="settingsValue"
            :submitting="isSaving"
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
import SectionHeading from '@/components/common/SectionHeading.vue';
import ThemeToggle from '@/components/common/ThemeToggle.vue';
import SettingsForm, { type SettingsFormValue } from '@/components/profile/SettingsForm.vue';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toasts';
import { useUserStore } from '@/stores/user';

const PROFILE_PREVIEW_MODE_ENABLED =
  import.meta.env.VITE_ENABLE_USER_MOCK_FALLBACK === 'true' || import.meta.env.VITE_ENABLE_AUTH_MOCK_FALLBACK === 'true';

const authStore = useAuthStore();
const toastStore = useToastStore();
const userStore = useUserStore();
const formError = ref('');
const settingsValue = ref<SettingsFormValue>({
  displayName: 'Atlas traveler',
  avatarUrl: '',
  bio: '',
  homeBase: '',
  privacy: 'friends',
  tripInvites: 'instant',
  emailAlerts: true,
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
    };
  },
  { immediate: true },
);

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
.settings-grid {
  display: grid;
  grid-template-columns: minmax(18rem, 0.72fr) minmax(0, 1.28fr);
  gap: var(--space-6);
}

.settings-card {
  padding: var(--space-6);
}

.appearance-card,
.form-card {
  display: grid;
  gap: var(--space-4);
}

.card-heading {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: flex-start;
}

.card-heading h2,
.eyebrow {
  margin: 0;
}

.eyebrow {
  margin-bottom: var(--space-1);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0.8rem;
  border-radius: var(--radius-full);
  background: var(--accent-teal-light);
  color: var(--accent-teal);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.sync-note {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  line-height: var(--line-height-relaxed);
}

@media (max-width: 980px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }

  .card-heading {
    flex-direction: column;
  }
}
</style>
