<template>
  <AppShell>
    <div class="page-container page-stack">
      <SectionHeading
        eyebrow="Settings"
        title="Preferences and account controls"
        description="Theme, notifications, and privacy controls sit here while backend settings mature."
      />

      <section class="settings-grid">
        <article class="glass-panel settings-card">
          <h2>Appearance</h2>
          <p class="section-copy">Atlas ships dark by default with a light mode override for bright daytime planning.</p>
          <ThemeToggle />
        </article>

        <article class="glass-panel settings-card">
          <h2>Account</h2>
          <p class="section-copy">Identity, privacy, and notification preferences will sync through the core platform.</p>
          <div class="setting-list">
            <div class="setting-row"><strong>Email alerts</strong><span>Enabled</span></div>
            <div class="setting-row"><strong>Trip invites</strong><span>Instant</span></div>
            <div class="setting-row"><strong>Profile visibility</strong><span>Friends only</span></div>
          </div>
        </article>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import AppShell from '@/components/common/AppShell.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import ThemeToggle from '@/components/common/ThemeToggle.vue';
</script>

<style scoped>
.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-6);
}

.settings-card {
  padding: var(--space-6);
}

.setting-list {
  display: grid;
  gap: var(--space-4);
  margin-top: var(--space-5);
}

.setting-row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  color: var(--text-secondary);
}

@media (max-width: 900px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }

  .setting-row {
    flex-direction: column;
  }
}
</style>
