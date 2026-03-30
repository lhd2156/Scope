<template>
  <AppShell>
    <div class="page-container page-stack spot-detail-page">
      <div v-if="activeSpot && authStore.isAuthenticated" class="glass-panel page-actions">
        <div>
          <p class="eyebrow">Creator tools</p>
          <h2>Need to tune the copy, photos, or exact coordinates?</h2>
          <p class="section-copy">Jump into the edit flow without leaving the premium detail layout.</p>
        </div>
        <RouterLink class="action-link" :to="`/spots/${activeSpot.id}/edit`">Edit this spot</RouterLink>
      </div>

      <section v-if="spotsStore.loading" class="glass-panel state-card loading-card">
        <LoadingSpinner size="lg" label="Loading spot detail" />
        <div>
          <p class="eyebrow">Loading</p>
          <h2>Pulling the full spot profile</h2>
          <p class="section-copy">Atlas is syncing gallery, review, and location data for this stop.</p>
        </div>
      </section>

      <section v-else-if="notFound" class="glass-panel state-card" role="alert">
        <p class="eyebrow">Missing spot</p>
        <h2>{{ spotsStore.error ? 'That pin is temporarily unavailable' : 'That pin could not be found' }}</h2>
        <p class="section-copy">{{ spotsStore.error || 'The requested spot may have moved, been removed, or not synced yet.' }}</p>
        <RouterLink to="/explore" class="state-link">Back to explore</RouterLink>
      </section>

      <SpotDetail v-else :spot="activeSpot" />
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import SpotDetail from '@/components/spots/SpotDetail.vue';
import { useAuthStore } from '@/stores/auth';
import { useSpotsStore } from '@/stores/spots';

const route = useRoute();
const authStore = useAuthStore();
const spotsStore = useSpotsStore();
const notFound = ref(false);

const requestedSpotId = computed(() => String(route.params.id ?? ''));
const activeSpot = computed(() => (spotsStore.selectedSpot?.id === requestedSpotId.value ? spotsStore.selectedSpot : null));

async function loadSpot(spotId: string) {
  if (!spotId) {
    notFound.value = true;
    return;
  }

  notFound.value = false;

  try {
    await spotsStore.fetchSpot(spotId);
  } catch {
    notFound.value = true;
  }
}

watch(
  requestedSpotId,
  async (spotId) => {
    await loadSpot(spotId);
  },
  { immediate: true },
);
</script>

<style scoped>
.spot-detail-page {
  --page-max-width: 1280px;
  display: grid;
  gap: var(--space-5);
}

.page-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5);
}

.page-actions h2,
.page-actions .section-copy,
.state-card h2,
.state-card p {
  margin: 0;
}

.page-actions h2,
.state-card h2 {
  font-size: var(--font-size-h2);
  line-height: var(--line-height-tight);
}

.action-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.8rem 1rem;
  border-radius: var(--radius-full);
  border: 1px solid transparent;
  background: var(--accent-teal);
  color: var(--bg-primary);
  font-weight: var(--font-weight-semibold);
  transition:
    transform var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.action-link:hover,
.action-link:focus-visible {
  background: var(--accent-teal-hover);
  box-shadow: var(--shadow-glow-teal);
  transform: translateY(-0.0625rem);
  outline: none;
}

.state-card {
  padding: var(--space-6);
  display: grid;
  gap: var(--space-3);
}

.loading-card {
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: var(--space-5);
}

.eyebrow {
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.state-link {
  color: var(--accent-teal);
  font-weight: var(--font-weight-semibold);
}

.state-link:hover,
.state-link:focus-visible {
  color: var(--accent-teal-hover);
  outline: none;
}

@media (max-width: 900px) {
  .page-actions,
  .loading-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .loading-card {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .action-link {
    transition: none;
  }

  .action-link:hover,
  .action-link:focus-visible {
    transform: none;
  }
}
</style>
