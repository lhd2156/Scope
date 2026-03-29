<template>
  <AppShell>
    <div class="page-container page-stack">
      <SectionHeading
        eyebrow="Settings"
        title="Preferences and account controls"
        description="Theme, privacy, notifications, and profile presentation all live in one place while backend settings mature."
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
          <p class="section-copy">Atlas ships dark by default with a light mode override for bright daytime planning.</p>
          <ThemeToggle />
        </article>

        <article class="glass-panel settings-card form-card">
          <div class="card-heading">
            <div>
              <p class="eyebrow">Account</p>
              <h2>Profile and privacy</h2>
            </div>
            <span class="meta-pill">Mock sync enabled</span>
          </div>
          <p class="section-copy">These controls mirror the architecture contract and update the local profile shell until the core settings API is live.</p>

          <SettingsForm
            v-model:error-message="formError"
            :initial-value="settingsValue"
            :submitting="isSaving"
            @submit="handleSave"
          />
        </article>
      </section>

      <Toast
        :open="showToast"
        title="Settings updated"
        message="Profile copy and preference controls were refreshed in the local Atlas shell."
        tone="success"
        @close="showToast = false"
      />
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import AppShell from '@/components/common/AppShell.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import ThemeToggle from '@/components/common/ThemeToggle.vue';
import Toast from '@/components/common/Toast.vue';
import SettingsForm, { type SettingsFormValue } from '@/components/profile/SettingsForm.vue';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const isSaving = ref(false);
const showToast = ref(false);
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
  isSaving.value = true;

  await new Promise((resolve) => setTimeout(resolve, 250));

  settingsValue.value = payload;
  authStore.updateCurrentUser({
    displayName: payload.displayName,
    avatarUrl: payload.avatarUrl || undefined,
    bio: payload.bio || undefined,
    homeBase: payload.homeBase || undefined,
  });

  showToast.value = true;
  isSaving.value = false;
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

@media (max-width: 980px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }

  .card-heading {
    flex-direction: column;
  }
}
</style>
