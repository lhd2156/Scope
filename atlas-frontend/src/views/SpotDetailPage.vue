<template>
  <AppShell>
    <div class="page-container page-stack">
      <SectionHeading
        eyebrow="Spot detail"
        title="Spot depth view"
        description="Photos, reviews, and map context pulled into a single premium detail surface."
      />

      <div v-if="activeSpot && authStore.isAuthenticated" class="page-actions">
        <p class="section-copy">Need to refresh the copy, photos, or exact coordinates? Open the edit flow for this pin.</p>
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
import SectionHeading from '@/components/common/SectionHeading.vue';
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
.page-stack {
  display: grid;
  gap: var(--space-6);
}

.page-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
}

.page-actions .section-copy {
  margin: 0;
  max-width: 42rem;
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

.state-card h2,
.state-card p {
  margin: 0;
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
</style>
