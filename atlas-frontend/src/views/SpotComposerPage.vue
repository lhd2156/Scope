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

      <section v-else-if="pageErrorMessage" class="glass-panel state-card" role="alert">
        <p class="eyebrow">Unavailable</p>
        <h2>{{ mode === 'edit' ? 'That spot could not be loaded' : 'That spot could not be saved' }}</h2>
        <p class="section-copy">{{ pageErrorMessage }}</p>
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
import { useToastStore } from '@/stores/toasts';
import type { Photo, SpotFormInput, SpotFormSubmission } from '@/types';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const spotsStore = useSpotsStore();
const toastStore = useToastStore();
const pageErrorMessage = ref('');

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
    pageErrorMessage.value = '';
    return;
  }

  if (!spotId) {
    pageErrorMessage.value = 'The requested pin may not exist yet or the content engine has not synced it back.';
    return;
  }

  pageErrorMessage.value = '';

  try {
    await spotsStore.fetchSpot(spotId);
  } catch {
    pageErrorMessage.value = spotsStore.error || 'The requested pin may not exist yet or the content engine has not synced it back.';
  }
}

async function handleSubmit(submission: SpotFormSubmission): Promise<void> {
  pageErrorMessage.value = '';
  const isEditingSpot = mode.value === 'edit';

  try {
    const savedSpot = isEditingSpot
      ? await spotsStore.updateSpot(requestedSpotId.value, submission, authStore.currentUser)
      : await spotsStore.createSpot(submission, authStore.currentUser);

    await router.push(`/spots/${savedSpot.id}`);
    toastStore.showSuccess({
      title: isEditingSpot ? 'Spot updated' : 'Spot published',
      message: isEditingSpot
        ? 'Atlas saved the latest pin details for explorers.'
        : 'Your new Atlas pin is now ready for discovery.',
    });
  } catch {
    const saveErrorMessage = spotsStore.error || 'Atlas could not save that spot right now.';
    pageErrorMessage.value = saveErrorMessage;
    toastStore.showError({
      title: 'Spot save failed',
      message: saveErrorMessage,
    });
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

    pageErrorMessage.value = '';
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
