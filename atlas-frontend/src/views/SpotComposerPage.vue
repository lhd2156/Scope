<template>
  <AppShell>
    <div class="page-container page-stack">
      <SectionHeading
        :eyebrow="mode === 'edit' ? 'Edit spot' : 'Create spot'"
        :title="mode === 'edit' ? 'Refine a community pin' : 'Drop a new adventure pin'"
        :description="mode === 'edit'
          ? 'Update the story, media, and exact location so the discovery experience stays accurate.'
          : 'Compose the full spot record with photos, map coordinates, and the metadata Atlas needs for discovery.'"
      />

      <section v-if="mode === 'edit' && spotsStore.loading" class="glass-panel state-card">
        <p class="eyebrow">Loading</p>
        <h2>Pulling the current spot draft</h2>
        <p class="section-copy">Atlas is loading the existing pin so you can refine it safely.</p>
      </section>

      <section v-else-if="loadError" class="glass-panel state-card">
        <p class="eyebrow">Unavailable</p>
        <h2>That spot could not be loaded</h2>
        <p class="section-copy">The requested pin may not exist yet or the content engine has not synced it back.</p>
        <RouterLink class="state-link" to="/explore">Back to explore</RouterLink>
      </section>

      <SpotForm
        v-else
        :mode="mode"
        :initial-value="initialFormValue"
        :initial-photos="initialPhotos"
        :submitting="spotsStore.saving"
        @submit="handleSubmit"
        @cancel="handleCancel"
      />
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import SpotForm from '@/components/spots/SpotForm.vue';
import { useAuthStore } from '@/stores/auth';
import { useSpotsStore } from '@/stores/spots';
import type { Photo, SpotFormInput, SpotFormSubmission } from '@/types';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const spotsStore = useSpotsStore();
const loadError = ref(false);

const mode = computed<'create' | 'edit'>(() => (route.name === 'spot-edit' ? 'edit' : 'create'));
const requestedSpotId = computed(() => String(route.params.id ?? ''));
const homeBaseCity = computed(() => authStore.currentUser?.homeBase?.split(',')[0]?.trim() || 'Fort Worth');

const initialFormValue = computed<Partial<SpotFormInput>>(() => {
  if (mode.value === 'edit' && spotsStore.selectedSpot) {
    return {
      title: spotsStore.selectedSpot.title,
      description: spotsStore.selectedSpot.description ?? '',
      latitude: spotsStore.selectedSpot.latitude,
      longitude: spotsStore.selectedSpot.longitude,
      address: spotsStore.selectedSpot.address ?? '',
      city: spotsStore.selectedSpot.city ?? '',
      country: spotsStore.selectedSpot.country ?? 'US',
      category: spotsStore.selectedSpot.category,
      vibe: spotsStore.selectedSpot.vibe ?? '',
      rating: spotsStore.selectedSpot.rating,
      visitedAt: spotsStore.selectedSpot.createdAt.slice(0, 10),
      isPublic: true,
    };
  }

  return {
    city: homeBaseCity.value,
    country: 'US',
    category: 'food',
    rating: 4.5,
    latitude: 32.7555,
    longitude: -97.3308,
    visitedAt: new Date().toISOString().slice(0, 10),
    isPublic: true,
  };
});

const initialPhotos = computed<Photo[]>(() => (mode.value === 'edit' ? spotsStore.selectedSpot?.photos ?? [] : []));

async function loadEditableSpot(spotId: string): Promise<void> {
  if (mode.value !== 'edit') {
    loadError.value = false;
    return;
  }

  if (!spotId) {
    loadError.value = true;
    return;
  }

  loadError.value = false;

  try {
    await spotsStore.fetchSpot(spotId);
  } catch {
    loadError.value = true;
  }
}

async function handleSubmit(submission: SpotFormSubmission): Promise<void> {
  try {
    const savedSpot = mode.value === 'edit'
      ? await spotsStore.updateSpot(requestedSpotId.value, submission, authStore.currentUser)
      : await spotsStore.createSpot(submission, authStore.currentUser);

    await router.push(`/spots/${savedSpot.id}`);
  } catch {
    loadError.value = true;
  }
}

async function handleCancel(): Promise<void> {
  if (mode.value === 'edit' && requestedSpotId.value) {
    await router.push(`/spots/${requestedSpotId.value}`);
    return;
  }

  await router.push('/explore');
}

watch(
  () => [mode.value, requestedSpotId.value] as const,
  async ([nextMode, spotId]) => {
    if (nextMode === 'edit') {
      await loadEditableSpot(spotId);
      return;
    }

    loadError.value = false;
  },
  { immediate: true },
);
</script>

<style scoped>
.page-stack {
  display: grid;
  gap: var(--space-6);
}

.state-card {
  padding: var(--space-6);
  display: grid;
  gap: var(--space-3);
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
</style>
