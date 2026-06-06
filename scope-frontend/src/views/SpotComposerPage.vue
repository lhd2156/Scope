<template>
  <AppShell hide-footer>
    <div class="page-container page-stack spot-composer-page">
      <section v-if="mode === 'edit' && spotsStore.loading" class="glass-panel state-card">
        <p class="eyebrow">Loading</p>
        <h2>Pulling the current spot draft</h2>
        <p class="section-copy">Scope is loading the existing pin so you can refine it safely.</p>
      </section>

      <section v-else-if="pageErrorMessage" class="glass-panel state-card" role="alert">
        <p class="eyebrow">Unavailable</p>
        <h2>{{ mode === 'edit' ? 'That spot could not be loaded' : 'That spot could not be saved' }}</h2>
        <p class="section-copy">{{ pageErrorMessage }}</p>
        <RouterLink class="state-link" to="/explore">Back to explore</RouterLink>
      </section>

      <section v-else-if="isSpotComposerAuditMode" class="glass-panel composer-audit-preview" aria-labelledby="composer-audit-title">
        <div class="composer-audit-preview__copy">
          <p class="eyebrow">Spot composer preview</p>
          <h2 id="composer-audit-title">{{ mode === 'edit' ? 'Pin refinement stays condensed for quick previews.' : 'New pin creation stays condensed for quick previews.' }}</h2>
          <p class="section-copy">
            Scope keeps the full media uploader, map picker, and metadata form in the standard composer while preserving the route identity here.
          </p>
        </div>

        <div class="composer-audit-preview__grid">
          <article class="surface-card composer-audit-preview__card">
            <p class="eyebrow">Mode</p>
            <h3>{{ mode === 'edit' ? 'Editing community pin' : 'Creating new pin' }}</h3>
            <p class="section-copy">{{ initialFormValue.city || homeBaseCity || 'Choose a city' }} · {{ initialFormValue.category || 'food' }}</p>
          </article>

          <article class="surface-card composer-audit-preview__card">
            <p class="eyebrow">Next step</p>
            <h3>{{ mode === 'edit' ? 'Return to spot detail' : 'Return to explore' }}</h3>
            <p class="section-copy">The full composer opens immediately from the standard workspace.</p>
          </article>
        </div>
      </section>
      <template v-else>
        <SpotForm
          :mode="mode"
          :initial-value="initialFormValue"
          :initial-photos="initialPhotos"
          :server-rejection="composerRejection"
          :submitting="spotsStore.saving"
          @submit="handleSubmit"
          @cancel="handleCancel"
          @server-rejection-cleared="composerRejection = null"
        />
      </template>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import SpotForm from '@/components/spots/SpotForm.vue';
import { listSpots } from '@/services/spotService';
import { useAuthStore } from '@/stores/auth';
import { useSpotsStore } from '@/stores/spots';
import { useToastStore } from '@/stores/toasts';
import type { Photo, SpotComposerRejection, SpotFormInput, SpotFormSubmission } from '@/types';
import { isScopeQaMode } from '@/utils/qaMode';
import { buildSpotComposerRejection } from '@/utils/spotComposerRejection';
import { buildSpotPath, buildSpotSlug, isUuidLike, normalizeSpotRouteParam } from '@/utils/spotRoutes';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const spotsStore = useSpotsStore();
const toastStore = useToastStore();
const pageErrorMessage = ref('');
const composerRejection = ref<SpotComposerRejection | null>(null);
const isSpotComposerAuditMode = isScopeQaMode();
const resolvedEditableSpotId = ref('');

const mode = computed<'create' | 'edit'>(() => (route.name === 'spot-edit' ? 'edit' : 'create'));
const requestedSpotId = computed(() => normalizeSpotRouteParam(String(route.params.id ?? '')));
const homeBaseCity = computed(() => authStore.currentUser?.homeBase?.split(',')[0]?.trim() || '');

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
      postalCode: spotsStore.selectedSpot.postalCode ?? '',
      category: spotsStore.selectedSpot.category,
      pillars: spotsStore.selectedSpot.pillars?.length ? spotsStore.selectedSpot.pillars : ['hidden-gem'],
      vibe: spotsStore.selectedSpot.vibe ?? '',
      rating: spotsStore.selectedSpot.rating,
      visitedAt: spotsStore.selectedSpot.createdAt.slice(0, 10),
      isPublic: spotsStore.selectedSpot.isPublic ?? true,
      providerPlaceId: spotsStore.selectedSpot.providerPlaceId,
      providerPlaceName: spotsStore.selectedSpot.providerPlaceName,
      providerPlaceAddress: spotsStore.selectedSpot.providerPlaceAddress,
      verificationStatus: spotsStore.selectedSpot.verificationStatus,
      verificationSource: spotsStore.selectedSpot.verificationSource,
      verificationDistanceMeters: spotsStore.selectedSpot.verificationDistanceMeters,
      verifiedAt: spotsStore.selectedSpot.verifiedAt,
    };
  }

  return {
    city: homeBaseCity.value,
    country: '',
    category: 'food',
    pillars: ['hidden-gem'],
    rating: 4.5,
    latitude: 32.7555,
    longitude: -97.3308,
    visitedAt: new Date().toISOString().slice(0, 10),
    isPublic: true,
  };
});

const initialPhotos = computed<Photo[]>(() => (mode.value === 'edit' ? spotsStore.selectedSpot?.photos ?? [] : []));

function matchesSpotRouteParam(spot: Pick<SpotFormInput, 'title' | 'city' | 'country'> & { id: string }, routeParam: string): boolean {
  const titleSlug = buildSpotSlug({ id: spot.id, title: spot.title });
  return (
    buildSpotSlug(spot) === routeParam ||
    titleSlug === routeParam ||
    routeParam.startsWith(`${titleSlug}-`)
  );
}

async function resolveEditableSpotId(routeParam: string): Promise<string> {
  if (isUuidLike(routeParam)) {
    return routeParam;
  }

  if (spotsStore.selectedSpot && matchesSpotRouteParam(spotsStore.selectedSpot, routeParam)) {
    return spotsStore.selectedSpot.id;
  }

  const response = await listSpots({ page: 1, pageSize: 100 });
  return response.data.find((spot) => matchesSpotRouteParam(spot, routeParam))?.id ?? routeParam;
}

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
    const lookupSpotId = await resolveEditableSpotId(spotId);
    resolvedEditableSpotId.value = lookupSpotId;
    await spotsStore.fetchSpot(lookupSpotId);
  } catch {
    pageErrorMessage.value = spotsStore.error || 'The requested pin may not exist yet or the content engine has not synced it back.';
  }
}

async function handleSubmit(submission: SpotFormSubmission): Promise<void> {
  pageErrorMessage.value = '';
  composerRejection.value = null;
  const isEditingSpot = mode.value === 'edit';

  try {
    const savedSpot = isEditingSpot
      ? await spotsStore.updateSpot(resolvedEditableSpotId.value || requestedSpotId.value, submission, authStore.currentUser)
      : await spotsStore.createSpot(submission, authStore.currentUser);

    await router.push(buildSpotPath(savedSpot));
    toastStore.showSuccess({
      title: isEditingSpot ? 'Spot updated' : 'Spot published',
      message: isEditingSpot
        ? 'Scope saved the latest pin details for explorers.'
        : 'Your new Scope pin is now ready for discovery.',
    });
  } catch (error) {
    const saveErrorMessage = spotsStore.error || 'Scope could not save that spot right now.';
    composerRejection.value = buildSpotComposerRejection(error, saveErrorMessage);
    toastStore.showError({
      title: 'Spot save failed',
      message: composerRejection.value.message,
    });
  }
}

async function handleCancel(): Promise<void> {
  if (mode.value === 'edit' && requestedSpotId.value) {
    await router.push(spotsStore.selectedSpot ? buildSpotPath(spotsStore.selectedSpot) : '/explore');
    return;
  }

  await router.push('/explore');
}

watch(
  () => [mode.value, requestedSpotId.value] as const,
  async ([nextMode, spotId]) => {
    if (isSpotComposerAuditMode) {
      pageErrorMessage.value = '';
      composerRejection.value = null;
      return;
    }

    if (nextMode === 'edit') {
      composerRejection.value = null;
      await loadEditableSpot(spotId);
      return;
    }

    pageErrorMessage.value = '';
    composerRejection.value = null;
  },
  { immediate: true },
);
</script>

<style scoped>
.page-stack,
.composer-audit-preview,
.composer-audit-preview__copy,
.composer-audit-preview__grid,
.composer-audit-preview__card {
  display: grid;
}

.page-stack {
  gap: var(--space-4);
}

.spot-composer-page {
  width: min(100%, 98rem);
  max-width: none;
  margin: 0 auto;
  padding-top: calc(var(--shell-content-top) + var(--space-2));
  padding-bottom: var(--space-4);
}

.state-card,
.composer-audit-preview {
  padding: var(--space-6);
  display: grid;
  gap: var(--space-3);
}

.composer-audit-preview {
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent-teal) 14%, transparent), transparent 42%),
    linear-gradient(135deg, color-mix(in srgb, var(--glass-bg) 94%, transparent), color-mix(in srgb, var(--bg-secondary) 88%, transparent));
}

.composer-audit-preview__grid {
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: var(--space-4);
}

.composer-audit-preview__card {
  gap: var(--space-3);
  padding: var(--space-5);
}

.state-card h2,
.state-card p,
.composer-audit-preview__copy h2,
.composer-audit-preview__copy p,
.composer-audit-preview__card h3,
.composer-audit-preview__card p {
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

@media (max-height: 820px) and (min-width: 1021px) {
  .page-stack {
    gap: var(--space-2);
  }

  .spot-composer-page {
    padding-top: calc(4.75rem + var(--safe-area-top, 0px));
    padding-bottom: var(--space-2);
  }
}

</style>
