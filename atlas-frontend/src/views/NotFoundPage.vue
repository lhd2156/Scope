<template>
  <main v-if="isNotFoundAuditMode" class="page-container page-stack not-found-audit-shell">
    <SectionHeading
      eyebrow="404"
      title="This trail does not exist in Atlas"
      description="The link may be outdated, the page may have moved, or the route was never published. Use one of the recovery paths below to get back to discovery."
    />

    <section class="glass-panel state-card" role="alert" aria-live="polite">
      <div class="state-copy">
        <p class="eyebrow">Route unavailable</p>
        <h2>Page not found</h2>
        <p>
          Atlas could not resolve this path. Head back to the home feed, jump into explore,
          or reopen the live map workspace to continue planning.
        </p>
      </div>

      <div class="state-actions">
        <RouterLink class="state-link state-link--primary" to="/">Return home</RouterLink>
        <RouterLink class="state-link" to="/explore">Explore spots</RouterLink>
        <RouterLink class="state-link" to="/map">Open map</RouterLink>
      </div>
    </section>
  </main>
  <AppShell v-else>
    <div class="page-container page-stack">
      <SectionHeading
        eyebrow="404"
        title="This trail does not exist in Atlas"
        description="The link may be outdated, the page may have moved, or the route was never published. Use one of the recovery paths below to get back to discovery."
      />

      <section class="glass-panel state-card" role="alert" aria-live="polite">
        <div class="state-copy">
          <p class="eyebrow">Route unavailable</p>
          <h2>Page not found</h2>
          <p>
            Atlas could not resolve this path. Head back to the home feed, jump into explore,
            or reopen the live map workspace to continue planning.
          </p>
        </div>

        <div class="state-actions">
          <RouterLink class="state-link state-link--primary" to="/">Return home</RouterLink>
          <RouterLink class="state-link" to="/explore">Explore spots</RouterLink>
          <RouterLink class="state-link" to="/map">Open map</RouterLink>
        </div>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import { isAtlasQaMode } from '@/utils/qaMode';

const isNotFoundAuditMode = isAtlasQaMode();
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: var(--space-6);
}

.not-found-audit-shell {
  min-height: 100vh;
  align-content: center;
}

.state-card {
  padding: var(--space-8);
  display: grid;
  gap: var(--space-6);
}

.state-copy {
  display: grid;
  gap: var(--space-3);
  max-width: 42rem;
}

.state-copy h2,
.state-copy p {
  margin: 0;
}

.state-copy p:last-child {
  color: var(--text-secondary);
  line-height: var(--line-height-relaxed);
}

.eyebrow {
  margin: 0;
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-eyebrow);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}

.state-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.state-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.875rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.state-link:hover,
.state-link:focus-visible {
  outline: none;
  transform: translateY(-0.0625rem);
  background: var(--bg-secondary);
  border-color: var(--border-hover);
}

.state-link--primary {
  border-color: transparent;
  background: var(--accent-teal);
  color: var(--bg-primary);
}

.state-link--primary:hover,
.state-link--primary:focus-visible {
  background: var(--accent-teal-hover);
  box-shadow: var(--shadow-glow-teal);
}

@media (max-width: 768px) {
  .state-card {
    padding: var(--space-6);
  }

  .state-actions {
    flex-direction: column;
  }

  .state-link {
    width: 100%;
  }
}
</style>
