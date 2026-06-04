<template>
  <AppShell>
    <div class="page-container page-stack spot-detail-page">
      <div v-if="activeSpot && canManageSpot" class="glass-panel page-actions" data-test="spot-detail-creator-tools">
        <div>
          <p class="eyebrow">Creator tools</p>
          <h2>Need to tune the copy, photos, or exact coordinates?</h2>
          <p class="section-copy">Jump into the edit flow without leaving the premium detail layout.</p>
        </div>
        <div class="creator-actions">
          <RouterLink class="action-link" :to="`/spots/${activeSpot.id}/edit`">Edit this spot</RouterLink>
          <button
            type="button"
            class="action-link action-link--danger"
            :disabled="spotsStore.saving"
            @click="openDeleteModal"
          >
            Delete this spot
          </button>
        </div>
      </div>

      <section v-if="spotsStore.loading" class="glass-panel state-card loading-card">
        <LoadingSpinner size="lg" label="Loading spot detail" />
        <div>
          <p class="eyebrow">Loading</p>
          <h2>Pulling the full spot profile</h2>
          <p class="section-copy">Scope is syncing gallery, review, and location data for this stop.</p>
        </div>
      </section>

      <section v-else-if="notFound" class="glass-panel state-card" role="alert">
        <p class="eyebrow">Missing spot</p>
        <h2>{{ spotsStore.error ? 'That pin is temporarily unavailable' : 'That pin could not be found' }}</h2>
        <p class="section-copy">{{ spotsStore.error || 'The requested spot may have moved, been removed, or not synced yet.' }}</p>
        <RouterLink to="/explore" class="state-link">Back to explore</RouterLink>
      </section>

      <article v-else-if="isSpotDetailAuditMode && activeSpot" class="glass-panel spot-detail-audit" data-test="spot-detail-audit">
        <div class="spot-detail-audit__media">
          <img :src="activeSpot.photoUrl" :alt="activeSpot.title" class="spot-detail-audit__image" loading="eager" />
        </div>
        <div class="spot-detail-audit__copy">
          <span class="badge" :class="`badge-${activeSpot.category}`">{{ activeSpot.category }}</span>
          <h1>{{ activeSpot.title }}</h1>
          <p class="section-copy">{{ activeSpot.description }}</p>
          <div class="spot-detail-audit__meta">
            <span>{{ [activeSpot.city, activeSpot.country].filter(Boolean).join(', ') }}</span>
            <span class="spot-detail-audit__rating" :aria-label="`Rated ${activeSpot.rating.toFixed(1)} out of 5`">
              <StarRatingDisplay
                :rating="activeSpot.rating"
                :label="`Rated ${activeSpot.rating.toFixed(1)} out of 5`"
                :id-prefix="`spot-audit-${activeSpot.id}`"
                variant="compact"
              />
              <span>{{ activeSpot.rating.toFixed(1) }}</span>
            </span>
            <span v-if="activeSpot.vibe">{{ formatVibeLabel(activeSpot.vibe) }}</span>
          </div>
          <RouterLink to="/explore" class="state-link">Back to explore</RouterLink>
        </div>
      </article>

      <SpotDetail v-else :spot="activeSpot" />
    </div>

    <Modal :open="showDeleteModal" title="Delete this spot?" eyebrow="Creator tools" size="sm" @close="closeDeleteModal">
      <div class="delete-modal" data-test="spot-delete-modal">
        <p class="section-copy">
          Scope will remove this pin from explore, maps, and itinerary suggestions for everyone using the current demo workspace.
        </p>
        <p v-if="deleteErrorMessage" class="delete-error" role="alert">{{ deleteErrorMessage }}</p>
        <div class="modal-actions">
          <button type="button" class="button button-secondary" :disabled="spotsStore.saving" @click="closeDeleteModal">Keep spot</button>
          <button type="button" class="button delete-button" :disabled="spotsStore.saving" @click="handleDeleteSpot">
            {{ spotsStore.saving ? 'Deleting…' : 'Delete spot' }}
          </button>
        </div>
      </div>
    </Modal>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import Modal from '@/components/common/Modal.vue';
import StarRatingDisplay from '@/components/common/StarRatingDisplay.vue';
import SpotDetail from '@/components/spots/SpotDetail.vue';
import { logInteraction } from '@/services/interactionService';
import { useAuthStore } from '@/stores/auth';
import { useSpotsStore } from '@/stores/spots';
import { useToastStore } from '@/stores/toasts';
import type { SpotDetail as SpotDetailModel } from '@/types';
import { formatVibeLabel } from '@/utils/formatters';
import { isScopeQaMode } from '@/utils/qaMode';

const SPOT_DETAIL_AUDIT_FIXTURE: SpotDetailModel = {
  id: 'demo-spot-1',
  title: 'Sunset Rooftop Tacos',
  description: 'A compact audit fixture that keeps the detail route readable, branded, and fast while synthetic QA skips the full gallery and review stack.',
  latitude: 32.7555,
  longitude: -97.3308,
  address: '600 Commerce St',
  city: 'Fort Worth',
  country: 'US',
  category: 'food',
  vibe: 'golden hour bites',
  rating: 4.8,
  photoUrl: 'https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?auto=format&fit=crop&w=1200&q=80',
  createdAt: '2026-01-12T18:00:00.000Z',
  author: {
    id: 'demo-user-1',
    username: 'scopedemo',
    email: 'demo@scope.travel',
    displayName: 'Scope traveler',
    interests: ['food', 'nightlife', 'culture'],
  },
  liked: false,
  likesCount: 184,
  photos: [
    {
      id: 'demo-spot-1-photo-1',
      url: 'https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?auto=format&fit=crop&w=1200&q=80',
      caption: 'Rooftop tacos at sunset',
    },
  ],
  reviews: [],
};

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const spotsStore = useSpotsStore();
const toastStore = useToastStore();
const isSpotDetailAuditMode = isScopeQaMode();
const notFound = ref(false);
const showDeleteModal = ref(false);
const deleteErrorMessage = ref('');

const requestedSpotId = computed(() => String(route.params.id ?? ''));
const auditSpot = computed<SpotDetailModel | null>(() => (
  isSpotDetailAuditMode && requestedSpotId.value === SPOT_DETAIL_AUDIT_FIXTURE.id
    ? SPOT_DETAIL_AUDIT_FIXTURE
    : null
));
const activeSpot = computed(() => auditSpot.value ?? (spotsStore.selectedSpot?.id === requestedSpotId.value ? spotsStore.selectedSpot : null));
const lastAuthenticatedSpotRefreshKey = ref('');

function resolveSpotOwnerId(spot: SpotDetailModel): string | undefined {
  return spot.author?.id ?? spot.userId;
}

const canManageSpot = computed(() => {
  if (!activeSpot.value || !authStore.isAuthenticated) {
    return false;
  }

  const ownerId = resolveSpotOwnerId(activeSpot.value);
  return Boolean(ownerId && authStore.currentUser?.id && ownerId === authStore.currentUser.id);
});

function openDeleteModal() {
  deleteErrorMessage.value = '';
  showDeleteModal.value = true;
}

function closeDeleteModal() {
  if (spotsStore.saving) {
    return;
  }

  deleteErrorMessage.value = '';
  showDeleteModal.value = false;
}

async function handleDeleteSpot() {
  if (!activeSpot.value) {
    return;
  }

  deleteErrorMessage.value = '';

  try {
    await spotsStore.deleteSpot(activeSpot.value.id);
    showDeleteModal.value = false;
    await router.push('/explore');
    toastStore.showSuccess({
      title: 'Spot deleted',
      message: 'Scope removed the pin from the current workspace.',
    });
  } catch {
    deleteErrorMessage.value = spotsStore.error || 'Scope could not delete that spot right now.';
    toastStore.showError({
      title: 'Delete failed',
      message: deleteErrorMessage.value,
    });
  }
}

async function loadSpot(spotId: string) {
  if (!spotId) {
    notFound.value = true;
    return;
  }

  notFound.value = false;
  deleteErrorMessage.value = '';
  showDeleteModal.value = false;

  if (isSpotDetailAuditMode && spotId === SPOT_DETAIL_AUDIT_FIXTURE.id) {
    return;
  }

  try {
    await spotsStore.fetchSpot(spotId);
    // Successful detail load counts as a 'view'. Drives Intel's user affinity
    // model (see scope_intel/app/repositories.INTERACTION_WEIGHTS). Errors
    // are swallowed inside `logInteraction` -- ledger writes are best-effort.
    logInteraction({ spotId, type: 'view', context: { source: 'detail' } });
  } catch {
    notFound.value = true;
  }
}

onMounted(() => {
  void loadSpot(requestedSpotId.value);
});

watch(requestedSpotId, (spotId) => {
  void loadSpot(spotId);
});

watch(
  () => [
    requestedSpotId.value,
    authStore.hasHydratedSession,
    authStore.isAuthenticated,
    authStore.currentUser?.id,
  ] as const,
  ([spotId, hasHydratedSession, isAuthenticated, userId]) => {
    if (!spotId || !hasHydratedSession || !isAuthenticated || !userId) {
      return;
    }

    const refreshKey = `${spotId}:${userId}`;
    if (lastAuthenticatedSpotRefreshKey.value === refreshKey) {
      return;
    }

    lastAuthenticatedSpotRefreshKey.value = refreshKey;
    void loadSpot(spotId);
  },
);
</script>

<style scoped>
.spot-detail-page {
  --page-max-width: 1280px;
  display: grid;
  gap: var(--space-5);
}

.page-container.spot-detail-page {
  padding-top: calc(var(--shell-content-top) + var(--space-6));
}

.spot-detail-audit {
  display: grid;
  grid-template-columns: minmax(0, 18rem) minmax(0, 1fr);
  gap: var(--space-5);
  padding: var(--space-5);
}

.spot-detail-audit__media {
  min-height: 16rem;
}

.spot-detail-audit__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--radius-3xl);
  display: block;
}

.spot-detail-audit__copy,
.spot-detail-audit__meta {
  display: grid;
  gap: var(--space-3);
}

.spot-detail-audit__copy h1,
.spot-detail-audit__copy p {
  margin: 0;
}

.spot-detail-audit__meta {
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.spot-detail-audit__rating {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
  font-variant-numeric: tabular-nums;
}

.page-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5);
  scroll-margin-top: calc(var(--shell-content-top) + var(--space-6));
}

.creator-actions,
.modal-actions {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.creator-actions {
  justify-content: flex-end;
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
  scroll-margin-top: calc(var(--shell-content-top) + var(--space-6));
  border-radius: var(--radius-full);
  border: 1px solid transparent;
  background: var(--accent-teal);
  color: var(--bg-primary);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    background var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    color var(--transition-fast);
}

.action-link:hover,
.action-link:focus-visible {
  background: var(--accent-teal-hover);
  box-shadow: var(--shadow-glow-teal);
  transform: translateY(-0.0625rem);
  outline: none;
}

.action-link--danger {
  background: transparent;
  border-color: color-mix(in srgb, var(--danger) 45%, var(--border));
  color: var(--danger);
}

.action-link--danger:hover,
.action-link--danger:focus-visible {
  background: color-mix(in srgb, var(--danger) 14%, transparent);
  border-color: color-mix(in srgb, var(--danger) 62%, var(--border));
  box-shadow: none;
}

.action-link:disabled,
.delete-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.state-card,
.delete-modal {
  padding: var(--space-6);
  display: grid;
  gap: var(--space-3);
}

.loading-card {
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: var(--space-5);
}

.delete-modal {
  padding: 0;
  gap: var(--space-4);
}

.delete-error {
  margin: 0;
  color: var(--danger);
  font-size: var(--font-size-small);
}

.modal-actions {
  justify-content: flex-end;
}

.delete-button {
  border-color: transparent;
  background: color-mix(in srgb, var(--danger) 92%, black);
  color: var(--bg-primary);
}

.delete-button:hover,
.delete-button:focus-visible {
  background: color-mix(in srgb, var(--danger) 78%, black);
  box-shadow: 0 0 0 0.25rem color-mix(in srgb, var(--danger) 22%, transparent);
  outline: none;
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

  .creator-actions,
  .modal-actions {
    width: 100%;
  }

  .creator-actions > *,
  .modal-actions > * {
    flex: 1 1 100%;
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
