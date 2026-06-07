<template>
  <AppShell>
    <div class="page-container page-stack planner-page" :data-planner-layout="isMobilePlannerLayout ? 'mobile-wizard' : 'desktop'">
      <article v-if="tripsStore.error" class="glass-panel planner-alert">
        <p class="eyebrow">Trip alert</p>
        <h2>Scope could not finish part of the planning flow</h2>
        <p>{{ tripsStore.error }}</p>
      </article>

      <TripCollaborationBar
        v-if="!isTripPlannerAuditMode"
        :trip="currentDraftTrip"
        :members="plannerMembers"
        :save-state="draftSaveState"
        :saving="tripsStore.saving"
        :show-edit-link="false"
        :is-public="plannerIsPublic"
        :can-edit="canEditCurrentTrip"
        :can-manage="canManageCurrentTrip"
        :show-ai-action="false"
        @save="handleSaveDraft"
        @share="handleShareDraft"
        @delete="handleDeleteCurrentDraft"
        @open-ai="handleOpenTripAi"
        @update:is-public="handleTripVisibilityUpdate"
      />

      <section v-if="isMobilePlannerLayout" class="glass-panel planner-mobile-brief">
        <div class="planner-mobile-copy">
          <p class="eyebrow">Scope trip guide</p>
          <h2>Prep a route the guide can trust</h2>
          <p>
            Set the route, dates, budget, pace, travelers, and vibes once. The guide uses that brief to suggest real stops that fit the drive.
          </p>
        </div>

        <div class="planner-mobile-progress" aria-label="Trip planner steps">
          <button
            v-for="step in mobileWizardSteps"
            :key="step.number"
            type="button"
            class="planner-mobile-step"
            :data-step-state="getMobileStepState(step.number)"
            :data-test="`planner-mobile-step-${step.number}`"
            @click="handleWizardStepChange(step.number)"
          >
            <span class="planner-mobile-step__index">{{ step.number }}</span>
            <span class="planner-mobile-step__copy">
              <strong>{{ step.label }}</strong>
              <small>{{ step.description }}</small>
            </span>
          </button>
        </div>
      </section>

      <section v-if="isTripPlannerAuditMode" class="glass-panel planner-audit-preview" aria-labelledby="planner-audit-title">
        <div class="planner-audit-preview__copy">
          <p class="eyebrow">Planner preview</p>
          <h2 id="planner-audit-title">Trip brief, route momentum, and itinerary output stay condensed for quick previews.</h2>
          <p class="section-copy">
            The full form wizard, stop management, and AI itinerary renderer remain in the standard planner workspace. This view keeps the summary compact.
          </p>
        </div>

        <div class="planner-audit-preview__grid">
          <article class="surface-card planner-audit-preview__card">
            <p class="eyebrow">Destination</p>
            <h3>{{ plannerDraft.destination }}</h3>
            <p class="section-copy">{{ plannerStops.length }} planned stops · {{ plannerMembers.length }} travelers.</p>
          </article>

          <article class="surface-card planner-audit-preview__card">
            <p class="eyebrow">Budget</p>
            <h3>${{ plannerDraft.budget.toLocaleString() }}</h3>
            <p class="section-copy">{{ plannerDraft.startDate }} → {{ plannerDraft.endDate }}</p>
          </article>

          <article class="surface-card planner-audit-preview__card">
            <p class="eyebrow">Preview</p>
            <h3>{{ resolvedPreviewItinerary?.days.length ?? 0 }} itinerary days</h3>
            <p class="section-copy">Route library cards and the full route map render in the standard planner workspace.</p>
          </article>
        </div>
      </section>
      <section v-else class="planner-workspace" :class="{ 'planner-workspace--mobile': isMobilePlannerLayout }">
        <TripPlanner
          ref="tripPlanner"
          :initial-value="plannerDraft"
          :initial-title="plannerTitle"
          :location-search-proximity="plannerLocationSearchProximity"
          :stops="plannerStops"
          :suggested-stops="plannerSuggestedStops"
          :submitting="tripsStore.planning"
          :mobile-wizard="isMobilePlannerLayout"
          :mobile-active-step="mobileWizardStep"
          :fuel-settings="tripFuelSettings"
          :packing-checklist-scope="plannerPackingChecklistScope"
          @update:title="handleTitleUpdate"
          @update:draft="handleDraftUpdate"
          @update:stops="handleStopsUpdate"
          @update:fuel-settings="handleFuelSettingsUpdate"
          @wizard-step-change="handleWizardStepChange"
          @submit="handlePlannerHandoff"
        />

        <div class="planner-workspace__right">
          <section v-if="isTripPlannerAuditMode" class="glass-panel planner-audit-preview" data-test="planner-audit-preview">
            <div class="planner-audit-preview__header">
              <div>
                <p class="eyebrow">Preview snapshot</p>
                <h2>{{ plannerTitle }}</h2>
              </div>
              <span class="planner-audit-preview__pill">{{ resolvedPreviewItinerary?.destination ?? plannerDraft.destination }}</span>
            </div>

            <p class="section-copy">
              Scope keeps this view focused on the trip brief, route count, and budget summary while preserving the user-facing planner flow.
            </p>

            <div class="planner-audit-preview__metrics">
              <article class="planner-audit-preview__metric">
                <span class="eyebrow">Days</span>
                <strong>{{ plannerAuditDayCount }}</strong>
              </article>
              <article class="planner-audit-preview__metric">
                <span class="eyebrow">Stops</span>
                <strong>{{ plannerAuditStopCount }}</strong>
              </article>
              <article class="planner-audit-preview__metric">
                <span class="eyebrow">Budget</span>
                <strong>{{ plannerAuditBudgetLabel }}</strong>
              </article>
            </div>
          </section>

          <ItineraryView
            ref="plannerItineraryView"
            v-else
            :itinerary="resolvedPreviewItinerary"
            :draft="plannerDraft"
            :trip-title="plannerTitle"
            :members="plannerMembers"
            :stops="plannerStops"
            :initial-map-viewport="plannerMapViewport"
            :submitting="tripsStore.planning"
            :mobile-wizard="isMobilePlannerLayout"
            :mobile-active-step="mobileWizardStep"
            :fuel-settings="tripFuelSettings"
            @map-location-select="handleMapLocationSelect"
            @route-stop-add="handleRouteStopAdd"
            @route-stop-remove="handleRouteStopRemove"
            @route-endpoint-remove="handleRouteEndpointRemove"
            @itinerary-stops-update="handleItineraryStopsUpdate"
            @wizard-step-change="handleWizardStepChange"
            @fuel-settings-request="handleFuelSettingsRequest"
            @fuel-price-select="handleFuelPriceSelect"
            @fuel-type-select="handleFuelTypeSelect"
          >
            <template #assistant>
              <TripPlannerAiAssist
                ref="tripAiAssist"
                class="planner-workspace__assistant planner-workspace__assistant--inline"
                :class="{ 'planner-workspace__assistant--with-days': hasPlannerDayByDayContent }"
                :draft="plannerDraft"
                :location-search-proximity="plannerLocationSearchProximity"
                :trip-title="plannerTitle"
                :stops="plannerStops"
                :scope-ai-store="scopeAiStore"
                :user-id="authStore.currentUser?.id"
                :execute-trip-command="handleScopeAiTripCommand"
                :execute-map-command="handleScopeAiMapCommand"
                @map-location-select="handleMapLocationSelect"
                @route-stop-add="handleRouteStopAdd"
                @route-stop-remove="handleRouteStopRemove"
                @route-stops-replace="handleRouteStopsReplace"
                @route-endpoint-remove="handleRouteEndpointRemove"
                @itinerary-build-request="handleAiItineraryBuildRequest"
              />
            </template>
          </ItineraryView>
        </div>
      </section>
      <div v-if="!isTripPlannerAuditMode" ref="featuredRoutesPreviewViewport" class="featured-routes-preview-sentinel" aria-hidden="true" />

      <section v-if="!isTripPlannerAuditMode && isFeaturedRoutesReady && featuredRouteCards.length" class="glass-panel featured-routes-panel">
        <div class="featured-routes-header">
          <div>
            <p class="eyebrow">Featured routes</p>
            <h2>Routes ready to start from</h2>
          </div>
          <span class="featured-routes-pill">{{ featuredRoutesPillLabel }}</span>
        </div>

        <div class="featured-routes-grid stagger-in">
          <article
            v-for="(card, index) in featuredRouteCards"
            :key="card.id"
            class="featured-route-card"
            :style="{ '--scope-stagger-index': index }"
            data-test="featured-route-card"
          >
            <div
              class="featured-route-visual"
              :data-visual-mode="card.visualMode"
              :data-hover-role="card.visualMode === 'split' ? featuredRouteHoverRoles[card.id] : undefined"
              aria-hidden="true"
              @mouseleave="handleFeaturedRouteVisualLeave(card.id)"
            >
              <template v-if="card.visualImages.length">
                <LazyImage
                  v-for="image in card.visualImages"
                  :key="image.key"
                  :src="image.src"
                  :alt="image.alt"
                  class="featured-route-visual__image"
                  :data-image-role="image.key"
                  eager
                  root-margin="360px 0px"
                />
              </template>
              <div v-if="card.visualMode === 'split'" class="featured-route-visual__hover-targets">
                <span
                  class="featured-route-visual__hover-target"
                  data-image-role="start"
                  data-test="featured-route-hover-start"
                  @mouseenter="handleFeaturedRouteVisualHover(card.id, 'start')"
                />
                <span
                  class="featured-route-visual__hover-target"
                  data-image-role="end"
                  data-test="featured-route-hover-end"
                  @mouseenter="handleFeaturedRouteVisualHover(card.id, 'end')"
                />
              </div>
              <div v-else class="featured-route-mapline">
                <span class="featured-route-mapline__pin">S</span>
                <span class="featured-route-mapline__track" />
                <span
                  v-for="category in card.visualCategories"
                  :key="category"
                  class="featured-route-mapline__category"
                  :data-category="category"
                />
                <span class="featured-route-mapline__pin">E</span>
              </div>

              <div class="featured-route-visual__overlay">
                <span>{{ card.dateLabel }}</span>
                <span>{{ card.dayLabel }}</span>
              </div>
            </div>

            <div class="featured-route-card__body">
              <div class="featured-route-card__heading">
                <h3>{{ card.title }}</h3>
                <p>{{ card.routeLabel }}</p>
              </div>

              <div class="featured-route-metrics" aria-label="Trip details">
                <span>{{ card.statusLabel }}</span>
                <span>{{ card.memberLabel }}</span>
                <span>{{ card.stopLabel }}</span>
                <span>{{ card.budgetLabel }}</span>
              </div>

              <button
                type="button"
                class="featured-route-cta"
                :aria-label="`Use ${card.title} as a new planner draft`"
                data-test="featured-route-use"
                @click="handleFeaturedRouteUse(card.trip)"
              >
                Use this route
              </button>
            </div>
          </article>
        </div>
      </section>

      <div
        v-if="isDeleteDraftDialogOpen"
        class="planner-confirm-backdrop"
        data-test="planner-delete-dialog"
        role="presentation"
        @click.self="cancelDeleteCurrentDraft"
        @keydown.escape.stop.prevent="cancelDeleteCurrentDraft"
      >
        <section
          class="planner-confirm-dialog glass-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="planner-delete-title"
        >
          <p class="eyebrow">Delete draft</p>
          <h2 id="planner-delete-title">Are you sure you want to delete this trip draft?</h2>
          <p>This removes the draft from your Trips workspace and sends you back to Trips. This action cannot be undone.</p>
          <div class="planner-confirm-actions">
            <button
              type="button"
              class="planner-confirm-button planner-confirm-button--secondary"
              data-test="planner-delete-cancel"
              :disabled="tripsStore.saving"
              @click="cancelDeleteCurrentDraft"
            >
              Keep draft
            </button>
            <button
              type="button"
              class="planner-confirm-button planner-confirm-button--danger"
              data-test="planner-delete-confirm"
              :disabled="tripsStore.saving"
              @click="confirmDeleteCurrentDraft"
            >
              Delete draft
            </button>
          </div>
        </section>
      </div>

      <TripShareModal
        :open="isShareModalOpen"
        :trip="currentDraftTrip"
        :members="plannerMembers"
        :share-link="tripShareLink"
        :submitting="tripsStore.saving"
        :can-manage="canManageCurrentTrip"
        @close="isShareModalOpen = false"
        @invite="handleInviteMember"
        @update-role="handleMemberRoleUpdate"
      />
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import { US_STATE_LABELS } from '@/components/map/usStateLabels';
import ItineraryView from '@/components/trips/ItineraryView.vue';
import TripCollaborationBar from '@/components/trips/TripCollaborationBar.vue';
import TripPlannerAiAssist from '@/components/trips/TripPlannerAiAssist.vue';
import TripPlanner from '@/components/trips/TripPlanner.vue';
import TripShareModal from '@/components/trips/TripShareModal.vue';
import { cloneMapViewport } from '@/config/mapViewport';
import { geocode, geocodeMapTarget, getPlacePhoto, type GeocodeResult } from '@/services/mapService';
import { getDefaultDiscoveryMapViewport, resolveHomeBaseMapViewport } from '@/services/mapViewportService';
import { STREETS_MAP_STYLE } from '@/services/mapboxLoader';
import { markPlanningActivity } from '@/services/presenceService';
import { matchTripPlannerPreset } from '@/services/tripPlannerPresets';
import { listPublicTrips, type TripMutationInput } from '@/services/tripService';
import { useAuthStore } from '@/stores/auth';
import { useMapStore } from '@/stores/map';
import { useScopeAiPlannerStore, type ScopeAiMapCommand, type ScopeAiMapCommandPayload, type ScopeAiPlannerState, type ScopeAiStop } from '@/stores/scopeAiPlanner';
import { useSpotsStore } from '@/stores/spots';
import { useToastStore } from '@/stores/toasts';
import { useTripsStore } from '@/stores/trips';
import { useUserStore } from '@/stores/user';
import { isScopeQaMode } from '@/utils/qaMode';
import { getSpotPhotoFallback } from '@/utils/imageFallbacks';
import { sanitizeImageUrl, sanitizeTripMember } from '@/utils/sanitizers';
import { addCalendarDays, getInclusiveDaySpan } from '@/utils/formatters';
import { areUserVibesEqual, normalizeUserVibes } from '@/utils/userPreferenceSignals';
import type { Itinerary, MapViewport, SpotCategory, Trip, TripFuelSettings, TripFuelType, TripInviteInput, TripMember, TripPlannerInput, TripSpot } from '@/types';

type PlannerMobileStep = 1 | 2 | 3 | 4;
type PlannerMapPickTarget = 'destination' | 'endDestination';

interface MobileWizardStep {
  number: PlannerMobileStep;
  label: string;
  description: string;
}

interface PlannerMapLocationSelection {
  target: PlannerMapPickTarget;
  label: string;
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
}

interface PlannerLocationSearchProximity {
  label?: string;
  latitude: number;
  longitude: number;
}

interface TripPlannerAiAssistHandle {
  handoffPlannerBrief: (options?: { prompt?: string }) => Promise<boolean>;
  focusComposer: () => Promise<void>;
}

interface PlannerItineraryViewHandle {
  runPlannerMapCommand: (command: ScopeAiMapCommand | ScopeAiMapCommandPayload) => Promise<{ ok: boolean; message: string }>;
}

type ScopeAiTripCommandPayload =
  | { type: 'save' }
  | { type: 'share' }
  | { type: 'delete' }
  | { type: 'visibility'; isPublic: boolean }
  | { type: 'invite'; recipient: string; role: 'editor' | 'viewer' };

interface ScopeAiCommandResult {
  ok: boolean;
  message: string;
  chips?: string[];
}

interface TripPlannerHandle {
  scrollToFuelSettings: () => void;
  addPackingItem: (label?: string) => void;
  removePackingItem: (itemId: string) => void;
}

interface RouteFuelPriceSelection {
  placeId: string;
  stationName: string;
  pricePerGallon: number;
  fuelType?: TripFuelType;
}

type RouteLibraryPhotoRole = 'single' | 'start' | 'end';
type RouteLibrarySplitHoverRole = Extract<RouteLibraryPhotoRole, 'start' | 'end'>;

interface RouteLibraryPhotoCacheEntry {
  photoUrl: string;
  savedAt: number;
}

interface RouteLibraryVisualImage {
  key: string;
  src: string;
  alt: string;
}

interface RouteLibraryStopPreview {
  id: string;
  title: string;
  meta: string;
  category: SpotCategory;
}

interface RouteLibraryCard {
  id: string;
  trip: Trip;
  title: string;
  routeLabel: string;
  dateLabel: string;
  statusLabel: 'Seed route' | 'Public route';
  memberLabel: string;
  stopLabel: string;
  dayLabel: string;
  budgetLabel: string;
  stopPreview: RouteLibraryStopPreview[];
  remainingStopCount: number;
  visualImages: RouteLibraryVisualImage[];
  visualMode: 'split' | 'single' | 'mapline';
  visualCategories: SpotCategory[];
}

interface SavePlannerDraftOptions {
  announce?: boolean;
  preserveRoute?: boolean;
  surfaceError?: boolean;
  persistedSignature?: string;
}

interface GeneratePlannerOptions {
  successToast?: boolean;
  errorToast?: boolean;
  rethrow?: boolean;
  saveDraft?: boolean;
  source?: 'auto' | 'user';
  requestedDateSpan?: Pick<TripPlannerInput, 'startDate' | 'endDate'>;
}

interface AiItineraryBuildDraftDefaults extends Partial<Pick<TripPlannerInput, 'startDate' | 'endDate' | 'interests' | 'pace' | 'groupSize'>> {
  durationDays?: number;
}

interface AiItineraryBuildRequestPayload {
  prompt: string;
  reason: 'build' | 'tighten' | 'weekend';
  draftDefaults?: AiItineraryBuildDraftDefaults;
  handled: boolean;
  resolve: (result: { status: 'success' | 'busy' | 'queued'; routeLabel: string; stopCount: number; dayCount?: number }) => void;
  reject: (error: unknown) => void;
}

const TRIP_PLANNER_MOBILE_BREAKPOINT = 640;
const PLANNER_USA_MAP_ZOOM = 3.25;
const SCOPE_AI_ENDPOINT_FOCUS_ZOOM = 10;
const TRIP_PLANNER_AUTOSAVE_DEBOUNCE_MS = 1_200;
const TRIP_PLANNER_AUTOSAVE_RETRY_MS = 1_800;
const DEFAULT_BUDGET_FLOOR = 500;
const DEFAULT_BUDGET_CEILING = 1500;
const DEFAULT_ITINERARY_TIME_SLOTS = ['09:00', '12:00', '15:00', '18:30'];
const ROUTE_LIBRARY_CARD_LIMIT = 3;
const ROUTE_LIBRARY_FETCH_LIMIT = ROUTE_LIBRARY_CARD_LIMIT * 4;
const ROUTE_LIBRARY_STOP_PREVIEW_LIMIT = 4;
const ROUTE_LIBRARY_PHOTO_WIDTH = 720;
const ROUTE_LIBRARY_PHOTO_CACHE_STORAGE_KEY = 'scope.routeLibraryPhotoLookupCache.v1';
const ROUTE_LIBRARY_PHOTO_CACHE_LIMIT = 120;
const SCOPE_AI_PLANNER_INTEREST_CATEGORIES: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'entertainment', 'scenic'];
const SCOPE_AI_PLANNER_SPOT_CATEGORIES = new Set<SpotCategory>([
  ...SCOPE_AI_PLANNER_INTEREST_CATEGORIES,
  'other',
]);
const shouldEagerlyRenderHeavyContent = import.meta.env.MODE === 'test' || import.meta.env.VITEST;

const ROUTE_LIBRARY_CATEGORY_LABELS: Record<SpotCategory, string> = {
  food: 'Food',
  nature: 'Nature',
  nightlife: 'Nightlife',
  culture: 'Culture',
  adventure: 'Adventure',
  shopping: 'Shopping',
  entertainment: 'Entertainment',
  scenic: 'Scenic',
  other: 'Stop',
};
const ROUTE_LIBRARY_SPLIT_FALLBACK_CATEGORIES: SpotCategory[] = [
  'scenic',
  'adventure',
  'nature',
  'food',
  'culture',
  'nightlife',
  'entertainment',
  'shopping',
  'other',
];

const mobileWizardSteps: MobileWizardStep[] = [
  { number: 1, label: 'Brief', description: 'Start, final destination, dates, travelers, and budget range.' },
  { number: 2, label: 'Route', description: 'Stop order and endpoint stack the guide will use.' },
  { number: 3, label: 'Guide', description: 'Pace, interests, and the route guide brief.' },
  { number: 4, label: 'Preview', description: 'Live route, timeline, and day-by-day cost view.' },
];

const tripsStore = useTripsStore();
const spotsStore = useSpotsStore();
const authStore = useAuthStore();
const mapStore = useMapStore();
const scopeAiStore = useScopeAiPlannerStore();
const toastStore = useToastStore();
const userStore = useUserStore();
const route = useRoute();
const router = useRouter();

function touchPlannerPresence(context = 'planner'): void {
  markPlanningActivity(`${route.fullPath || '/trips/new'}#${context}`);
}
const isTripPlannerAuditMode = isScopeQaMode();
const todayDateInput = getCurrentDateInputValue();
const isMobilePlannerLayout = ref(resolveIsMobilePlannerLayout());
const mobileWizardStep = ref<PlannerMobileStep>(1);
const plannerDraft = ref<TripPlannerInput>(createDefaultPlannerDraft());
const lastAppliedUserPreferenceInterests = ref<SpotCategory[]>([...plannerDraft.value.interests]);
const plannerTitle = ref('');
const plannerIsPublic = ref(false);
const plannerStops = ref<TripSpot[]>([]);
const plannerSuggestedStops = ref<TripSpot[]>([]);
const plannerCrew = ref<TripMember[]>([]);
const tripFuelSettings = ref<TripFuelSettings>({});
const selectedFuelPricesByPlaceId = ref<Record<string, number>>({});
const plannerMapViewport = ref<MapViewport>(createPlannerMapViewport(getPlannerDefaultMapViewport()));
const hasPlannerHomeBaseSearchAnchor = ref(false);
const currentDraftTrip = ref<Trip | null>(null);
const plannerDraftSessionId = ref(createPlannerDraftSessionId());
const draftSaveState = ref<'unsaved' | 'saving' | 'saved'>('saved');
const isShareModalOpen = ref(false);
const isDeleteDraftDialogOpen = ref(false);
const tripShareLink = ref('');
const hasGeneratedPreview = ref(false);
const isFeaturedRoutesReady = ref(false);
const featuredRoutesPreviewViewport = ref<HTMLElement | null>(null);
const featuredRouteTrips = ref<Trip[]>([]);
const routeLibraryPhotoLookups = ref<Record<string, Partial<Record<RouteLibraryPhotoRole, string>>>>({});
const featuredRouteHoverRoles = ref<Record<string, RouteLibrarySplitHoverRole>>({});
const tripPlanner = ref<TripPlannerHandle | null>(null);
const tripAiAssist = ref<TripPlannerAiAssistHandle | null>(null);
const plannerItineraryView = ref<PlannerItineraryViewHandle | null>(null);
const isPlannerEndDateUserLocked = ref(false);
let disconnectFeaturedRoutesPreviewObserver: (() => void) | null = null;
let hasLoadedFeaturedRoutes = false;
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let autoSaveRequestId = 0;
let isAiSyncInProgress = false;
let isScopeAiHydratingFromPlanner = false;
let lastPersistedDraftSignature = '';
let scheduledDraftAutosaveSignature = '';
let inFlightDraftAutosaveSignature = '';
let mapViewportRequestId = 0;
let editableTripHydrationRequestId = 0;
const routeLibraryPhotoLookupPending = new Map<string, Promise<string>>();
let routeLibraryPhotoCache: Record<string, RouteLibraryPhotoCacheEntry> | null = null;

const eligibleFeaturedRoutes = computed(() => [...featuredRouteTrips.value].filter(isRouteLibraryTrip).sort(compareRecentTrips));
const publicFeaturedRoutes = computed(() => eligibleFeaturedRoutes.value.filter((trip) => !isSeedRouteLibraryTrip(trip)));
const seededFeaturedRoutes = computed(() => eligibleFeaturedRoutes.value.filter(isSeedRouteLibraryTrip));
const featuredRoutes = computed(() => {
  const sourceRoutes = publicFeaturedRoutes.value.length ? publicFeaturedRoutes.value : seededFeaturedRoutes.value;
  return sourceRoutes.slice(0, ROUTE_LIBRARY_CARD_LIMIT);
});
const featuredRoutesPillLabel = computed(() => {
  const routeCount = featuredRoutes.value.length;
  const sourceLabel = publicFeaturedRoutes.value.length ? 'public' : 'seed';
  return `${routeCount} ${sourceLabel} ${routeCount === 1 ? 'route' : 'routes'}`;
});
const routeLibraryRepeatedImageKeys = computed(() => {
  const imageCounts = new Map<string, number>();

  featuredRoutes.value.forEach((trip) => {
    collectRouteLibraryDirectImages(trip).forEach((imageUrl) => {
      const imageKey = normalizeRouteLibraryImageKey(imageUrl);
      imageCounts.set(imageKey, (imageCounts.get(imageKey) ?? 0) + 1);
    });
  });

  return new Set([...imageCounts.entries()].filter(([, count]) => count > 1).map(([imageKey]) => imageKey));
});
const routeLibraryCards = computed<RouteLibraryCard[]>(() =>
  featuredRoutes.value.map((trip) => buildRouteLibraryCard(trip, routeLibraryRepeatedImageKeys.value)),
);
const featuredRouteCards = routeLibraryCards;
const resolvedPreviewItinerary = computed<Itinerary | null>(() => (hasGeneratedPreview.value ? tripsStore.previewItinerary : null));
const hasPlannerDayByDayContent = computed(() => {
  const draft = plannerDraft.value;
  const hasPreviewSchedule = Boolean(resolvedPreviewItinerary.value?.days.some((day) => day.spots.length));

  return Boolean(
    hasPreviewSchedule ||
    plannerStops.value.length ||
    hasMeaningfulPlannerEndpointLabel(draft.destination) ||
    hasMeaningfulPlannerEndpointLabel(draft.endDestination) ||
    hasCoordinatePair(draft.destinationLatitude, draft.destinationLongitude) ||
    hasCoordinatePair(draft.endDestinationLatitude, draft.endDestinationLongitude),
  );
});
const plannerAuditDayCount = computed(() => resolvedPreviewItinerary.value?.days.length ?? 0);
const plannerAuditStopCount = computed(() => resolvedPreviewItinerary.value?.days.reduce((total, day) => total + day.spots.length, 0) ?? plannerStops.value.length);
const plannerAuditBudgetLabel = computed(() => `${formatPlannerBudgetValue(plannerDraft.value.budgetFloor ?? 0)} - ${formatPlannerBudgetValue(plannerDraft.value.budget)}`);
const routeTripId = computed(() => (
  route.name === 'trip-edit' && route.params.id ? String(route.params.id) : ''
));
const plannerMembers = computed<TripMember[]>(() => {
  const members = currentDraftTrip.value?.members.length ? currentDraftTrip.value.members : plannerCrew.value;
  return ensureOwnerMember(members);
});
const currentUserTripRole = computed(() => {
  if (!currentDraftTrip.value) {
    return 'owner';
  }

  const currentUserId = authStore.currentUser?.id;
  return currentDraftTrip.value.members.find((member) => member.id === currentUserId)?.status;
});
const canEditCurrentTrip = computed(() => currentUserTripRole.value === 'owner' || currentUserTripRole.value === 'editor');
const canManageCurrentTrip = computed(() => currentUserTripRole.value === 'owner');
const shouldOpenTripAssistant = computed(() => route.query.assistant === 'open' || route.query.ai === 'open');
const routeSpotId = computed(() => {
  const value = Array.isArray(route.query.spot) ? route.query.spot[0] : route.query.spot;
  return typeof value === 'string' ? value.trim() : '';
});
const plannerLocationSearchProximity = computed<PlannerLocationSearchProximity | undefined>(() => {
  const userLocation = mapStore.userLocation;
  if (userLocation && isCoordinatePair(userLocation[1], userLocation[0])) {
    return {
      label: 'current location',
      latitude: userLocation[1],
      longitude: userLocation[0],
    };
  }

  if (hasPlannerHomeBaseSearchAnchor.value) {
    const [longitude, latitude] = plannerMapViewport.value.center;
    if (isCoordinatePair(latitude, longitude)) {
      return {
        label: authStore.currentUser?.homeBase?.trim() || 'home base',
        latitude,
        longitude,
      };
    }
  }

  return undefined;
});
const plannerPackingChecklistScope = computed(() => {
  const tripId = currentDraftTrip.value?.id || routeTripId.value;
  return tripId ? `trip:${tripId}` : `draft:${plannerDraftSessionId.value}`;
});
const draftAutosaveSignature = computed(() => buildDraftAutosaveSignature());

const ownerMember = computed<TripMember>(() =>
  sanitizeTripMember({
    id: authStore.currentUser?.id ?? 'local-user',
    displayName: authStore.currentUser?.displayName ?? 'You',
    avatarUrl: authStore.currentUser?.avatarUrl,
    status: 'owner',
    inviteStatus: 'accepted',
    presence: 'active',
  }),
);

function getCurrentDateInputValue(): string {
  const today = new Date();
  return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
}

function getCurrentUserTripVibes(): SpotCategory[] {
  return normalizeUserVibes(authStore.currentUser?.interests);
}

function getCurrentUserSuggestionVibes(): SpotCategory[] {
  return normalizeUserVibes(authStore.currentUser?.interests, { includeSurprise: false });
}

function canApplyUserVibesToCurrentDraft(): boolean {
  return !currentDraftTrip.value &&
    !plannerTitle.value.trim() &&
    !plannerStops.value.length &&
    !hasGeneratedPreview.value &&
    isPlannerRouteDraftBlank(plannerDraft.value) &&
    (
      plannerDraft.value.interests.length === 0 ||
      areUserVibesEqual(plannerDraft.value.interests, lastAppliedUserPreferenceInterests.value)
    );
}

function syncUserVibesToPlannerDraft(): void {
  const nextUserVibes = getCurrentUserTripVibes();
  scopeAiStore.seedPreferredTypes(getCurrentUserSuggestionVibes());

  if (canApplyUserVibesToCurrentDraft()) {
    plannerDraft.value = {
      ...plannerDraft.value,
      interests: nextUserVibes,
    };
  }

  lastAppliedUserPreferenceInterests.value = [...nextUserVibes];
}

async function hydrateCurrentPlannerProfile(): Promise<void> {
  const currentUser = authStore.currentUser;
  if (!currentUser?.id || route.name === 'trip-edit') {
    return;
  }

  const hasPlannerVibes = getCurrentUserTripVibes().length > 0;
  if (hasPlannerVibes) {
    return;
  }

  try {
    await userStore.fetchCurrentProfile();
    syncUserVibesToPlannerDraft();
  } catch {
    // The planner remains usable with route-derived defaults if the profile read fails.
  }
}

function formatPlannerBudgetValue(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function sanitizePositiveFuelValue(value: number | undefined): number | undefined {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : undefined;
}

function sanitizeFuelType(value: TripFuelSettings['fuelType'] | undefined): TripFuelType | undefined {
  const normalizedValue = String(value ?? '').trim().toLowerCase();
  return ['regular', 'midgrade', 'premium', 'diesel', 'ev'].includes(normalizedValue)
    ? (normalizedValue as TripFuelType)
    : undefined;
}

function roundFuelPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

function isCoordinatePair(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

function createPlannerMapViewport(viewport: MapViewport): MapViewport {
  return {
    ...cloneMapViewport(viewport),
    style: STREETS_MAP_STYLE,
  };
}

function getPlannerDefaultMapViewport(): MapViewport {
  return {
    ...getDefaultDiscoveryMapViewport(),
    zoom: PLANNER_USA_MAP_ZOOM,
  };
}

function setPlannerMapViewport(viewport: MapViewport): void {
  plannerMapViewport.value = createPlannerMapViewport(viewport);
}

function buildPlannerMapViewportForCoordinates(
  coordinates: Array<{ latitude: number; longitude: number }>,
): MapViewport {
  const validCoordinates = coordinates.filter((coordinate) =>
    hasCoordinatePair(coordinate.latitude, coordinate.longitude),
  );
  const [firstCoordinate] = validCoordinates;

  if (!firstCoordinate || validCoordinates.length === 1) {
    return {
      ...plannerMapViewport.value,
      center: firstCoordinate
        ? [firstCoordinate.longitude, firstCoordinate.latitude]
        : plannerMapViewport.value.center,
      zoom: SCOPE_AI_ENDPOINT_FOCUS_ZOOM,
    };
  }

  const longitudes = validCoordinates.map((coordinate) => coordinate.longitude);
  const latitudes = validCoordinates.map((coordinate) => coordinate.latitude);
  const west = Math.min(...longitudes);
  const east = Math.max(...longitudes);
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);
  const span = Math.max(east - west, north - south, 0.05);

  return {
    ...plannerMapViewport.value,
    center: [(west + east) / 2, (south + north) / 2],
    zoom: Math.max(4.25, Math.min(SCOPE_AI_ENDPOINT_FOCUS_ZOOM, 10 - Math.log2(span + 1))),
  };
}

function getDraftEndpointCoordinate(
  draft: TripPlannerInput,
  target: 'destination' | 'endDestination',
): { latitude: number; longitude: number } | null {
  const latitude = target === 'destination'
    ? draft.destinationLatitude
    : draft.endDestinationLatitude;
  const longitude = target === 'destination'
    ? draft.destinationLongitude
    : draft.endDestinationLongitude;

  return hasCoordinatePair(latitude, longitude)
    ? { latitude: Number(latitude), longitude: Number(longitude) }
    : null;
}

function didDraftEndpointCoordinateChange(
  previousDraft: TripPlannerInput,
  nextDraft: TripPlannerInput,
  target: 'destination' | 'endDestination',
): boolean {
  const previousCoordinate = getDraftEndpointCoordinate(previousDraft, target);
  const nextCoordinate = getDraftEndpointCoordinate(nextDraft, target);

  if (!nextCoordinate) {
    return false;
  }

  return !previousCoordinate ||
    Math.abs(previousCoordinate.latitude - nextCoordinate.latitude) > 0.000001 ||
    Math.abs(previousCoordinate.longitude - nextCoordinate.longitude) > 0.000001;
}

function focusPlannerMapForScopeAiEndpointChange(previousDraft: TripPlannerInput, nextDraft: TripPlannerInput): void {
  const didStartCoordinateChange = didDraftEndpointCoordinateChange(previousDraft, nextDraft, 'destination');
  const didEndCoordinateChange = didDraftEndpointCoordinateChange(previousDraft, nextDraft, 'endDestination');
  if (!didStartCoordinateChange && !didEndCoordinateChange) {
    return;
  }

  const startCoordinate = getDraftEndpointCoordinate(nextDraft, 'destination');
  const endCoordinate = getDraftEndpointCoordinate(nextDraft, 'endDestination');
  const coordinatesToShow = startCoordinate && endCoordinate && (didEndCoordinateChange || didStartCoordinateChange)
    ? [startCoordinate, endCoordinate]
    : [didStartCoordinateChange ? startCoordinate : endCoordinate].filter((coordinate): coordinate is { latitude: number; longitude: number } => Boolean(coordinate));

  setPlannerMapViewport(buildPlannerMapViewportForCoordinates(coordinatesToShow));
}

async function syncPlannerMapViewportFromHomeBase(): Promise<void> {
  const requestId = ++mapViewportRequestId;
  const homeBase = authStore.currentUser?.homeBase?.trim() ?? '';

  if (route.name !== 'trip-edit' || !homeBase) {
    hasPlannerHomeBaseSearchAnchor.value = false;
    setPlannerMapViewport(getPlannerDefaultMapViewport());
    return;
  }

  const homeBaseViewport = await resolveHomeBaseMapViewport(homeBase).catch(() => null);
  if (requestId !== mapViewportRequestId) {
    return;
  }

  hasPlannerHomeBaseSearchAnchor.value = Boolean(homeBaseViewport);
  setPlannerMapViewport(homeBaseViewport ?? getPlannerDefaultMapViewport());
}

function ensureOwnerMember(members: TripMember[]): TripMember[] {
  const sanitizedMembers = members.map((member) => sanitizeTripMember({ ...member }));
  if (currentDraftTrip.value && sanitizedMembers.length) {
    return sanitizedMembers;
  }
  const ownerId = ownerMember.value.id;
  const withoutDuplicateOwner = sanitizedMembers.filter((member) => member.id !== ownerId);
  return [ownerMember.value, ...withoutDuplicateOwner];
}

function resolvePlannerTitle(): string {
  return plannerTitle.value.trim() || buildGeneratedDraftTitle();
}

function resolvePlannerDestination(): string {
  const startDestination = plannerDraft.value.destination.trim();
  const endDestination = plannerDraft.value.endDestination?.trim();
  const titleDestination = plannerTitle.value.trim();

  if (startDestination && endDestination) {
    return `${startDestination} to ${endDestination}`;
  }

  return startDestination || endDestination || titleDestination || 'Planning route';
}

function formatPlannerHandoffDateSpan(payload: TripPlannerInput): string {
  const dayCount = getInclusiveDaySpan(payload.startDate, payload.endDate);
  if (payload.startDate && payload.endDate) {
    return `${payload.startDate} to ${payload.endDate} (${dayCount} day${dayCount === 1 ? '' : 's'})`;
  }

  return payload.startDate || payload.endDate || 'smart default dates';
}

function formatPlannerHandoffInterests(interests: SpotCategory[]): string {
  return interests.length ? interests.join(', ') : 'smart defaults';
}

function formatPlannerHandoffStops(stops: TripSpot[]): string {
  const routeStops = stops
    .filter((stop) => stop.title?.trim())
    .slice(0, 8)
    .map((stop, index) => {
      const dayLabel = stop.dayNumber ? `, day ${stop.dayNumber}` : '';
      const locationLabel = stop.city ? `, ${stop.city}` : '';
      return `${index + 1}. ${stop.title.trim()}${locationLabel}${dayLabel}`;
    });

  if (!routeStops.length) {
    return 'none yet';
  }

  return routeStops.join('; ');
}

function buildPlannerHandoffPrompt(payload: TripPlannerInput, stops: TripSpot[] = plannerStops.value): string {
  const startDestination = payload.destination.trim();
  const endDestination = payload.endDestination?.trim() ?? '';
  const guideFrame = 'Act as Scope Trip Guide for this planner handoff, not as the route copilot chat.';

  if (startDestination && endDestination) {
    return [
      guideFrame,
      `Route: ${startDestination} to ${endDestination}.`,
      `Dates: ${formatPlannerHandoffDateSpan(payload)}.`,
      `Budget: ${formatPlannerBudgetValue(payload.budgetFloor ?? DEFAULT_BUDGET_FLOOR)} to ${formatPlannerBudgetValue(payload.budget)}.`,
      `Pace: ${payload.pace}. Travelers: ${Math.max(1, payload.groupSize)}.`,
      `Vibes: ${formatPlannerHandoffInterests(payload.interests)}.`,
      `Existing route stops: ${formatPlannerHandoffStops(stops)}.`,
      'Use the live route and existing stops first, then suggest real places that are actually near the drive.',
      'Prioritize reputable/popular place data when available; for food, choose real restaurants, cafes, food trucks, bakeries, or fast-casual spots and reject non-food POIs even if provider data is noisy.',
      'Keep sparse routes grounded, use smart defaults only for missing nonessential details, and build the itinerary with a short guide-style explanation of why the stops fit.',
    ].join(' ');
  }

  if (startDestination) {
    return `${guideFrame} The start is ${startDestination}. Ask for the final destination before building so the suggestions stay route-grounded.`;
  }

  if (endDestination) {
    return `${guideFrame} The final destination is ${endDestination}. Ask for the start location before building so the suggestions stay route-grounded.`;
  }

  return `${guideFrame} Collect a real start and final destination before building the guide.`;
}

function getGeneratedTitleEndpoint(value: string | undefined): string {
  const parts = (value ?? '').split(',').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) {
    return '';
  }

  const [primary = '', locality = ''] = parts;
  const primaryLooksLikeAddress = /^\d/.test(primary) || /\b(highway|hwy|road|rd|street|st|avenue|ave|boulevard|blvd|drive|dr)\b/i.test(primary);
  return primaryLooksLikeAddress && locality ? locality : primary;
}

function buildGeneratedDraftTitle(draft: Pick<TripPlannerInput, 'destination' | 'endDestination'> = plannerDraft.value): string {
  const start = getGeneratedTitleEndpoint(draft.destination);
  const end = getGeneratedTitleEndpoint(draft.endDestination);
  const generatedTitle = start && end && start.toLowerCase() !== end.toLowerCase()
    ? `${start} to ${end}`
    : start || end
      ? `${start || end} itinerary`
      : 'Untitled trip';

  return generatedTitle.length > 80 ? `${generatedTitle.slice(0, 77).trim()}...` : generatedTitle;
}

function buildVisibleGeneratedDraftTitle(draft: Pick<TripPlannerInput, 'destination' | 'endDestination'> = plannerDraft.value): string {
  const generatedTitle = buildGeneratedDraftTitle(draft);
  return generatedTitle === 'Untitled trip' ? '' : generatedTitle;
}

function normalizePlannerTitleForCompare(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

function buildGeneratedTitleCandidates(draft: Pick<TripPlannerInput, 'destination' | 'endDestination'>): string[] {
  const start = getGeneratedTitleEndpoint(draft.destination);
  const end = getGeneratedTitleEndpoint(draft.endDestination);
  const fullStart = draft.destination.trim();
  const fullEnd = draft.endDestination?.trim() ?? '';
  const candidates = [
    buildGeneratedDraftTitle(draft),
    buildVisibleGeneratedDraftTitle(draft),
    start && end ? `${start} to ${end}` : '',
    fullStart && fullEnd ? `${fullStart} to ${fullEnd}` : '',
    start ? `${start} itinerary` : '',
    end ? `${end} itinerary` : '',
    start ? `${start} trip` : '',
    end ? `${end} trip` : '',
    'Untitled trip',
  ];

  return [...new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean))];
}

function isGeneratedPlannerTitleForDraft(title: string, draft: Pick<TripPlannerInput, 'destination' | 'endDestination'> = plannerDraft.value): boolean {
  const normalizedTitle = normalizePlannerTitleForCompare(title);
  if (!normalizedTitle) {
    return true;
  }

  return buildGeneratedTitleCandidates(draft).some((candidate) =>
    normalizePlannerTitleForCompare(candidate) === normalizedTitle,
  );
}

function syncGeneratedPlannerTitleForDraftChange(
  previousDraft: Pick<TripPlannerInput, 'destination' | 'endDestination'>,
  nextDraft: Pick<TripPlannerInput, 'destination' | 'endDestination'>,
): void {
  if (!isGeneratedPlannerTitleForDraft(plannerTitle.value, previousDraft)) {
    return;
  }

  plannerTitle.value = buildVisibleGeneratedDraftTitle(nextDraft);
}

function flattenPreviewStops(itinerary: Itinerary | null): TripSpot[] {
  return itinerary?.days.flatMap((day) =>
    day.spots.map((spot) => ({
      ...spot,
      dayNumber: spot.dayNumber ?? day.dayNumber,
    })),
  ) ?? [];
}

function ensureItineraryCoversDateSpan(
  itinerary: Itinerary,
  dateSpan: Pick<TripPlannerInput, 'startDate' | 'endDate'>,
): Itinerary {
  const dayCount = getInclusiveDaySpan(dateSpan.startDate, dateSpan.endDate);
  if (dayCount <= 0) {
    return itinerary;
  }

  const daysByNumber = new Map(itinerary.days.map((day) => [day.dayNumber, day]));
  const days = Array.from({ length: dayCount }, (_, index) => {
    const dayNumber = index + 1;
    const existingDay = daysByNumber.get(dayNumber);
    return {
      dayNumber,
      date: addCalendarDays(dateSpan.startDate, index),
      spots: existingDay?.spots ?? [],
    };
  });

  return {
    ...itinerary,
    days,
    totalEstimatedCost: days
      .flatMap((day) => day.spots)
      .reduce((total, stop) => total + (stop.estimatedCost ?? 0), 0),
  };
}

function flattenTripItineraryStops(itinerary: Itinerary | undefined): TripSpot[] {
  return itinerary?.days.flatMap((day) =>
    day.spots.map((spot) => ({
      ...spot,
      dayNumber: spot.dayNumber ?? day.dayNumber,
    })),
  ) ?? [];
}

function resolveTripRouteStops(trip: Trip): TripSpot[] {
  return trip.spots.length ? cloneStops(trip.spots) : cloneStops(flattenTripItineraryStops(trip.itinerary));
}

function splitRouteDestinationLabel(destination: string): { start: string; end: string } {
  const normalizedDestination = destination.trim();
  const routeParts = normalizedDestination.split(/\s*(?:\bto\b|\+|→|->)\s*/i).map((part) => part.trim()).filter(Boolean);

  if (routeParts.length < 2) {
    return {
      start: normalizedDestination,
      end: '',
    };
  }

  return {
    start: routeParts.slice(0, -1).join(' to '),
    end: routeParts[routeParts.length - 1] ?? '',
  };
}

function getMappableRouteStops(stops: TripSpot[]): TripSpot[] {
  return stops.filter((stop) => hasCoordinatePair(stop.latitude, stop.longitude));
}

function firstMappableRouteStop(stops: TripSpot[]): TripSpot | undefined {
  return getMappableRouteStops(stops)[0];
}

function lastMappableRouteStop(stops: TripSpot[]): TripSpot | undefined {
  const mappableStops = getMappableRouteStops(stops);
  return mappableStops.length > 1 ? mappableStops[mappableStops.length - 1] : undefined;
}

function getRouteLibraryStops(trip: Trip): TripSpot[] {
  return normalizeItineraryStops(resolveTripRouteStops(trip));
}

function isRouteLibraryTrip(trip: Trip): boolean {
  return trip.isPublic && getRouteLibraryStops(trip).length >= 2;
}

function compareRecentTrips(left: Trip, right: Trip): number {
  const leftTime = Date.parse(left.updatedAt || left.createdAt || left.startDate);
  const rightTime = Date.parse(right.updatedAt || right.createdAt || right.startDate);
  return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
}

function normalizeRouteLibraryImageKey(imageUrl: string): string {
  const normalizedImageUrl = imageUrl.trim();
  if (!normalizedImageUrl) {
    return '';
  }

  try {
    const url = new URL(normalizedImageUrl);
    return url.hostname === 'images.unsplash.com'
      ? `${url.origin}${url.pathname}`
      : normalizedImageUrl;
  } catch {
    return normalizedImageUrl;
  }
}

function isRepeatedRouteLibraryImage(imageUrl: string, repeatedImageKeys: Set<string>): boolean {
  return repeatedImageKeys.has(normalizeRouteLibraryImageKey(imageUrl));
}

function collectRouteLibraryDirectImages(trip: Trip): string[] {
  const imageUrls = [
    trip.coverImageUrl,
    ...resolveTripRouteStops(trip).map((stop) => stop.photoUrl),
  ]
    .map((imageUrl) => imageUrl?.trim() ?? '')
    .filter(Boolean);

  return [...new Set(imageUrls)];
}

function formatRouteLibraryCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatRouteLibraryDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function formatRouteLibraryDateLabel(trip: Trip): string {
  const startDate = formatRouteLibraryDate(trip.startDate);
  const endDate = formatRouteLibraryDate(trip.endDate);
  return startDate && endDate && startDate !== endDate ? `${startDate} - ${endDate}` : startDate || endDate || 'Flexible dates';
}

function formatRouteLibraryBudgetLabel(trip: Trip): string {
  return Number.isFinite(trip.budget) && Number(trip.budget) > 0
    ? formatPlannerBudgetValue(Number(trip.budget))
    : 'Budget TBD';
}

function formatRouteLibraryCategory(category: SpotCategory): string {
  return ROUTE_LIBRARY_CATEGORY_LABELS[category] ?? 'Stop';
}

function getRouteLibraryStopLocation(stop: TripSpot): string {
  return stop.city?.trim() || stop.title.trim();
}

function compactRouteLibraryLocation(value: string): string {
  return value
    .trim()
    .replace(/\s*,?\s*(United States|USA)$/i, '')
    .replace(/\s+/g, ' ');
}

function normalizeRouteLibraryLocation(value: string): string {
  return compactRouteLibraryLocation(value)
    .toLowerCase()
    .replace(/\b(texas|tx|oklahoma|ok|new mexico|nm|united states|usa)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getRouteLibraryEndpointLabels(trip: Trip, stops: TripSpot[]): { start: string; end: string; routeLabel: string } {
  const destinationParts = splitRouteDestinationLabel(trip.destination);
  const firstStop = stops[0];
  const lastStop = stops[stops.length - 1];
  const start = compactRouteLibraryLocation(destinationParts.start || (firstStop ? getRouteLibraryStopLocation(firstStop) : trip.destination));
  const end = compactRouteLibraryLocation(destinationParts.end || (lastStop ? getRouteLibraryStopLocation(lastStop) : ''));
  const normalizedStart = normalizeRouteLibraryLocation(start);
  const normalizedEnd = normalizeRouteLibraryLocation(end);

  if (!destinationParts.end && trip.destination.trim()) {
    return {
      start,
      end: '',
      routeLabel: compactRouteLibraryLocation(trip.destination),
    };
  }

  if (!end || normalizedStart === normalizedEnd) {
    return {
      start,
      end: '',
      routeLabel: start || compactRouteLibraryLocation(trip.destination),
    };
  }

  return {
    start,
    end,
    routeLabel: `${start} to ${end}`,
  };
}

function getRouteLibraryStopMeta(stop: TripSpot): string {
  const meta = [
    `Day ${normalizeItineraryDayNumber(stop.dayNumber, 1)}`,
    stop.timeSlot ? normalizeItineraryTimeSlot(stop.timeSlot) : '',
    formatRouteLibraryCategory(stop.category),
    stop.estimatedCost ? formatPlannerBudgetValue(stop.estimatedCost) : '',
  ].filter(Boolean);

  return meta.join(' · ');
}

function buildRouteLibraryStopPreview(stops: TripSpot[]): RouteLibraryStopPreview[] {
  return stops.slice(0, ROUTE_LIBRARY_STOP_PREVIEW_LIMIT).map((stop, index) => ({
    id: stop.spotId || `${stop.title}-${index}`,
    title: stop.title,
    meta: getRouteLibraryStopMeta(stop),
    category: stop.category,
  }));
}

function getRouteLibraryPhotoFromStop(stop: TripSpot | undefined, repeatedImageKeys: Set<string>, ignoredImageUrl = ''): string {
  const imageUrl = stop?.photoUrl?.trim() ?? '';
  if (!imageUrl || imageUrl === ignoredImageUrl || isRepeatedRouteLibraryImage(imageUrl, repeatedImageKeys)) {
    return '';
  }

  return imageUrl;
}

function getRouteLibraryFallbackPhoto(trip: Trip, repeatedImageKeys: Set<string>, ignoredImageUrl = ''): string {
  const imageUrls = collectRouteLibraryDirectImages(trip);
  return imageUrls.find((imageUrl) => imageUrl !== ignoredImageUrl && !isRepeatedRouteLibraryImage(imageUrl, repeatedImageKeys)) ?? '';
}

function shouldUseRouteLibrarySplitVisual(trip: Trip, stops: TripSpot[], endpoints: { start: string; end: string }): boolean {
  if (endpoints.end && normalizeRouteLibraryLocation(endpoints.start) !== normalizeRouteLibraryLocation(endpoints.end)) {
    return true;
  }

  return isSeedRouteLibraryTrip(trip) &&
    stops.length > 1 &&
    stops.some((stop) => hasCoordinatePair(stop.latitude, stop.longitude));
}

function getRouteLibrarySplitFallbackPhoto(stops: TripSpot[], role: RouteLibraryPhotoRole, ignoredImageUrl = ''): string {
  const orderedStops = role === 'end' ? [...stops].reverse() : stops;
  const categories = [
    ...orderedStops.map((stop) => stop.category),
    ...ROUTE_LIBRARY_SPLIT_FALLBACK_CATEGORIES,
  ];
  const seenCategories = new Set<SpotCategory>();
  const ignoredImageKey = normalizeRouteLibraryImageKey(ignoredImageUrl);

  for (const category of categories) {
    if (seenCategories.has(category)) {
      continue;
    }

    seenCategories.add(category);
    const fallbackPhoto = getSpotPhotoFallback(category, ROUTE_LIBRARY_PHOTO_WIDTH);
    if (fallbackPhoto && normalizeRouteLibraryImageKey(fallbackPhoto) !== ignoredImageKey) {
      return fallbackPhoto;
    }
  }

  return '';
}

function getRouteLibraryLookupPhoto(tripId: string, role: RouteLibraryPhotoRole, ignoredImageUrl = ''): string {
  const imageUrl = routeLibraryPhotoLookups.value[tripId]?.[role]?.trim() ?? '';
  return imageUrl && imageUrl !== ignoredImageUrl ? imageUrl : '';
}

function handleFeaturedRouteVisualHover(cardId: string, role: RouteLibrarySplitHoverRole): void {
  if (featuredRouteHoverRoles.value[cardId] === role) {
    return;
  }

  featuredRouteHoverRoles.value = {
    ...featuredRouteHoverRoles.value,
    [cardId]: role,
  };
}

function handleFeaturedRouteVisualLeave(cardId: string): void {
  if (!featuredRouteHoverRoles.value[cardId]) {
    return;
  }

  const { [cardId]: _removedRole, ...nextHoverRoles } = featuredRouteHoverRoles.value;
  featuredRouteHoverRoles.value = nextHoverRoles;
}

function canPersistRouteLibraryPhotoCache(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeRouteLibraryPhotoCacheText(value: string | undefined): string {
  return compactRouteLibraryLocation(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function formatRouteLibraryPhotoCoordinate(value: number | undefined): string {
  return Number.isFinite(value) ? Number(value).toFixed(5) : '';
}

function buildRouteLibraryPhotoCacheKey(stop: TripSpot | undefined): string {
  if (!stop || !hasCoordinatePair(stop.latitude, stop.longitude)) {
    return '';
  }

  return [
    normalizeRouteLibraryPhotoCacheText(stop.title),
    normalizeRouteLibraryPhotoCacheText(stop.city),
    formatRouteLibraryPhotoCoordinate(stop.latitude),
    formatRouteLibraryPhotoCoordinate(stop.longitude),
    String(ROUTE_LIBRARY_PHOTO_WIDTH),
  ].join('|');
}

function readRouteLibraryPhotoCache(): Record<string, RouteLibraryPhotoCacheEntry> {
  if (routeLibraryPhotoCache) {
    return routeLibraryPhotoCache;
  }

  if (!canPersistRouteLibraryPhotoCache()) {
    routeLibraryPhotoCache = {};
    return routeLibraryPhotoCache;
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(ROUTE_LIBRARY_PHOTO_CACHE_STORAGE_KEY) ?? '{}') as Record<string, Partial<RouteLibraryPhotoCacheEntry>>;
    routeLibraryPhotoCache = Object.fromEntries(
      Object.entries(parsed)
        .map(([key, entry]) => {
          const photoUrl = sanitizeImageUrl(entry?.photoUrl)?.trim() ?? '';
          const savedAt = Number(entry?.savedAt);
          return photoUrl && Number.isFinite(savedAt) ? [key, { photoUrl, savedAt }] : null;
        })
        .filter((entry): entry is [string, RouteLibraryPhotoCacheEntry] => Boolean(entry)),
    );
  } catch {
    routeLibraryPhotoCache = {};
  }

  return routeLibraryPhotoCache;
}

function writeRouteLibraryPhotoCache(cache: Record<string, RouteLibraryPhotoCacheEntry>): void {
  routeLibraryPhotoCache = Object.fromEntries(
    Object.entries(cache)
      .sort(([, left], [, right]) => right.savedAt - left.savedAt)
      .slice(0, ROUTE_LIBRARY_PHOTO_CACHE_LIMIT),
  );

  if (!canPersistRouteLibraryPhotoCache()) {
    return;
  }

  try {
    window.localStorage.setItem(ROUTE_LIBRARY_PHOTO_CACHE_STORAGE_KEY, JSON.stringify(routeLibraryPhotoCache));
  } catch {
    // Route cards can still use the in-memory cache when persistent storage is unavailable.
  }
}

function getCachedRouteLibraryPhoto(stop: TripSpot | undefined): string {
  const cacheKey = buildRouteLibraryPhotoCacheKey(stop);
  if (!cacheKey) {
    return '';
  }

  return readRouteLibraryPhotoCache()[cacheKey]?.photoUrl ?? '';
}

function setCachedRouteLibraryPhoto(stop: TripSpot | undefined, photoUrl: string): void {
  const cacheKey = buildRouteLibraryPhotoCacheKey(stop);
  const sanitizedPhotoUrl = sanitizeImageUrl(photoUrl)?.trim() ?? '';
  if (!cacheKey || !sanitizedPhotoUrl) {
    return;
  }

  writeRouteLibraryPhotoCache({
    ...readRouteLibraryPhotoCache(),
    [cacheKey]: {
      photoUrl: sanitizedPhotoUrl,
      savedAt: Date.now(),
    },
  });
}

function setRouteLibraryLookupPhoto(tripId: string, role: RouteLibraryPhotoRole, photoUrl: string): void {
  const sanitizedPhotoUrl = sanitizeImageUrl(photoUrl)?.trim() ?? '';
  if (!sanitizedPhotoUrl || routeLibraryPhotoLookups.value[tripId]?.[role] === sanitizedPhotoUrl) {
    return;
  }

  routeLibraryPhotoLookups.value = {
    ...routeLibraryPhotoLookups.value,
    [tripId]: {
      ...(routeLibraryPhotoLookups.value[tripId] ?? {}),
      [role]: sanitizedPhotoUrl,
    },
  };
}

function shouldPreferRouteLibraryLookupPhoto(trip: Trip): boolean {
  return isSeedRouteLibraryTrip(trip);
}

function buildRouteLibraryVisualImages(
  trip: Trip,
  stops: TripSpot[],
  endpoints: { start: string; end: string },
  repeatedImageKeys: Set<string>,
): RouteLibraryVisualImage[] {
  const firstStop = stops[0];
  const lastStop = stops[stops.length - 1];
  const hasSplitRoute = shouldUseRouteLibrarySplitVisual(trip, stops, endpoints);
  const preferLookupPhoto = shouldPreferRouteLibraryLookupPhoto(trip);

  if (hasSplitRoute) {
    const startLookupPhoto = getRouteLibraryLookupPhoto(trip.id, 'start');
    const startDirectPhoto = getRouteLibraryPhotoFromStop(firstStop, repeatedImageKeys)
      || getRouteLibraryFallbackPhoto(trip, repeatedImageKeys);
    const startPhoto = preferLookupPhoto
      ? startLookupPhoto || startDirectPhoto
      : startDirectPhoto || startLookupPhoto;

    const endLookupPhoto = getRouteLibraryLookupPhoto(trip.id, 'end', startPhoto);
    const endDirectPhoto = getRouteLibraryPhotoFromStop(lastStop, repeatedImageKeys, startPhoto)
      || getRouteLibraryFallbackPhoto(trip, repeatedImageKeys, startPhoto);
    const endPhoto = preferLookupPhoto
      ? endLookupPhoto || endDirectPhoto
      : endDirectPhoto || endLookupPhoto;
    const resolvedStartPhoto = startPhoto || getRouteLibrarySplitFallbackPhoto(stops, 'start', endPhoto);
    const resolvedEndPhoto = (endPhoto && normalizeRouteLibraryImageKey(endPhoto) !== normalizeRouteLibraryImageKey(resolvedStartPhoto))
      ? endPhoto
      : getRouteLibrarySplitFallbackPhoto(stops, 'end', resolvedStartPhoto);
    const startAltLabel = endpoints.start || (firstStop ? getRouteLibraryStopLocation(firstStop) : trip.title);
    const endAltLabel = endpoints.end || (lastStop ? getRouteLibraryStopLocation(lastStop) : trip.title);

    if (resolvedStartPhoto && resolvedEndPhoto && normalizeRouteLibraryImageKey(resolvedStartPhoto) !== normalizeRouteLibraryImageKey(resolvedEndPhoto)) {
      return [
        { key: 'start', src: resolvedStartPhoto, alt: `${startAltLabel} route photo` },
        { key: 'end', src: resolvedEndPhoto, alt: `${endAltLabel} route photo` },
      ];
    }
  }

  const singleLookupPhoto = getRouteLibraryLookupPhoto(trip.id, 'single')
    || getRouteLibraryLookupPhoto(trip.id, 'start');
  const singleDirectPhoto = getRouteLibraryFallbackPhoto(trip, repeatedImageKeys);
  const singlePhoto = preferLookupPhoto
    ? singleLookupPhoto || singleDirectPhoto
    : singleDirectPhoto || singleLookupPhoto;

  return singlePhoto
    ? [{ key: 'single', src: singlePhoto, alt: `${trip.title} route photo` }]
    : [];
}

function getRouteLibraryVisualCategories(stops: TripSpot[]): SpotCategory[] {
  const categories = stops.map((stop) => stop.category).filter((category, index, all) => all.indexOf(category) === index);
  return (categories.length ? categories : ['scenic']).slice(0, 4);
}

function buildRouteLibraryCard(trip: Trip, repeatedImageKeys: Set<string>): RouteLibraryCard {
  const stops = getRouteLibraryStops(trip);
  const endpoints = getRouteLibraryEndpointLabels(trip, stops);
  const dayCount = getInclusiveDaySpan(trip.startDate, trip.endDate);
  const memberCount = Math.max(trip.members.length, 1);
  const visualImages = buildRouteLibraryVisualImages(trip, stops, endpoints, repeatedImageKeys);

  return {
    id: trip.id,
    trip,
    title: trip.title,
    routeLabel: endpoints.routeLabel,
    dateLabel: formatRouteLibraryDateLabel(trip),
    statusLabel: isSeedRouteLibraryTrip(trip) ? 'Seed route' : 'Public route',
    memberLabel: formatRouteLibraryCount(memberCount, 'member'),
    stopLabel: formatRouteLibraryCount(stops.length, 'stop'),
    dayLabel: formatRouteLibraryCount(dayCount, 'day'),
    budgetLabel: formatRouteLibraryBudgetLabel(trip),
    stopPreview: buildRouteLibraryStopPreview(stops),
    remainingStopCount: Math.max(0, stops.length - ROUTE_LIBRARY_STOP_PREVIEW_LIMIT),
    visualImages,
    visualMode: visualImages.length > 1 ? 'split' : visualImages.length === 1 ? 'single' : 'mapline',
    visualCategories: getRouteLibraryVisualCategories(stops),
  };
}

function isSeedRouteLibraryTrip(trip: Trip): boolean {
  return /^trip-\d+$/i.test(trip.id);
}

function shouldLookupRouteLibraryPhoto(trip: Trip, stops: TripSpot[], repeatedImageKeys: Set<string>): boolean {
  if (import.meta.env.MODE === 'test' || import.meta.env.VITEST) {
    return false;
  }

  if (!stops.some((stop) => hasCoordinatePair(stop.latitude, stop.longitude))) {
    return false;
  }

  const endpoints = getRouteLibraryEndpointLabels(trip, stops);
  const hasSplitRoute = shouldUseRouteLibrarySplitVisual(trip, stops, endpoints);
  const directImageCount = collectRouteLibraryDirectImages(trip)
    .filter((imageUrl) => !isRepeatedRouteLibraryImage(imageUrl, repeatedImageKeys))
    .length;

  if (shouldPreferRouteLibraryLookupPhoto(trip)) {
    return true;
  }

  return hasSplitRoute ? directImageCount < 2 : directImageCount < 1;
}

function getRouteLibraryPhotoLookupRequests(
  trip: Trip,
  stops: TripSpot[],
  repeatedImageKeys: Set<string>,
): Array<{ role: RouteLibraryPhotoRole; stop: TripSpot | undefined }> {
  const firstStop = stops[0];
  const lastStop = stops[stops.length - 1];
  const endpoints = getRouteLibraryEndpointLabels(trip, stops);
  const hasSplitRoute = shouldUseRouteLibrarySplitVisual(trip, stops, endpoints);
  const preferLookupPhoto = shouldPreferRouteLibraryLookupPhoto(trip);

  if (hasSplitRoute) {
    const startDirectPhoto = getRouteLibraryPhotoFromStop(firstStop, repeatedImageKeys)
      || getRouteLibraryFallbackPhoto(trip, repeatedImageKeys);
    const endDirectPhoto = getRouteLibraryPhotoFromStop(lastStop, repeatedImageKeys, startDirectPhoto)
      || getRouteLibraryFallbackPhoto(trip, repeatedImageKeys, startDirectPhoto);

    return [
      preferLookupPhoto || !startDirectPhoto ? { role: 'start', stop: firstStop } : null,
      preferLookupPhoto || !endDirectPhoto ? { role: 'end', stop: lastStop } : null,
    ].filter((request): request is { role: RouteLibraryPhotoRole; stop: TripSpot | undefined } => Boolean(request));
  }

  const singleDirectPhoto = getRouteLibraryFallbackPhoto(trip, repeatedImageKeys);
  return preferLookupPhoto || !singleDirectPhoto
    ? [{ role: 'single', stop: firstStop }]
    : [];
}

async function lookupRouteLibraryPhoto(tripId: string, role: RouteLibraryPhotoRole, stop: TripSpot | undefined): Promise<void> {
  if (!stop || !hasCoordinatePair(stop.latitude, stop.longitude)) {
    return;
  }

  if (routeLibraryPhotoLookups.value[tripId]?.[role]) {
    return;
  }

  const cachedPhotoUrl = getCachedRouteLibraryPhoto(stop);
  if (cachedPhotoUrl) {
    setRouteLibraryLookupPhoto(tripId, role, cachedPhotoUrl);
    return;
  }

  const lookupKey = buildRouteLibraryPhotoCacheKey(stop) || `${tripId}:${role}`;
  const pendingLookup = routeLibraryPhotoLookupPending.get(lookupKey);
  if (pendingLookup) {
    const pendingPhotoUrl = await pendingLookup;
    setRouteLibraryLookupPhoto(tripId, role, pendingPhotoUrl);
    return;
  }

  const lookup = (async () => {
    try {
      const photoLookup = await getPlacePhoto({
        title: stop.title,
        address: stop.city,
        latitude: stop.latitude,
        longitude: stop.longitude,
        maxWidthPx: ROUTE_LIBRARY_PHOTO_WIDTH,
      });
      const photoUrl = sanitizeImageUrl(photoLookup.photoUrl)?.trim() ?? '';
      if (!photoUrl) {
        return '';
      }

      setCachedRouteLibraryPhoto(stop, photoUrl);
      return photoUrl;
    } catch {
      // Missing route art should fall back to the map-line visual, not block planning.
      return '';
    }
  })();

  routeLibraryPhotoLookupPending.set(lookupKey, lookup);

  try {
    const photoUrl = await lookup;
    setRouteLibraryLookupPhoto(tripId, role, photoUrl);
  } finally {
    if (routeLibraryPhotoLookupPending.get(lookupKey) === lookup) {
      routeLibraryPhotoLookupPending.delete(lookupKey);
    }
  }
}

async function enrichRouteLibraryPhotos(trips: Trip[]): Promise<void> {
  await Promise.all(trips.map(async (trip) => {
    const stops = getRouteLibraryStops(trip);
    if (!shouldLookupRouteLibraryPhoto(trip, stops, routeLibraryRepeatedImageKeys.value)) {
      return;
    }

    await Promise.all(
      getRouteLibraryPhotoLookupRequests(trip, stops, routeLibraryRepeatedImageKeys.value)
        .map((request) => lookupRouteLibraryPhoto(trip.id, request.role, request.stop)),
    );
  }));
}

function buildDraftTripInput(): TripMutationInput {
  const previewStops = flattenPreviewStops(tripsStore.previewItinerary);
  const spots = plannerStops.value.length ? plannerStops.value : previewStops;
  return {
    title: resolvePlannerTitle(),
    destination: resolvePlannerDestination(),
    description: 'Collaborative trip draft from Scope planner.',
    isPublic: plannerIsPublic.value,
    startDate: plannerDraft.value.startDate,
    endDate: plannerDraft.value.endDate,
    budget: plannerDraft.value.budget,
    currency: 'USD',
    status: 'planning',
    spots,
    members: ensureOwnerMember(currentDraftTrip.value?.members ?? plannerCrew.value),
  };
}

function createDefaultPlannerDraft(): TripPlannerInput {
  return {
    destination: '',
    endDestination: '',
    startDate: todayDateInput,
    endDate: todayDateInput,
    budgetFloor: DEFAULT_BUDGET_FLOOR,
    budget: DEFAULT_BUDGET_CEILING,
    interests: getCurrentUserTripVibes(),
    pace: 'relaxed',
    groupSize: 1,
  };
}

function createPlannerDraftSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function resetPlannerDraftWorkspace(): void {
  plannerDraft.value = createDefaultPlannerDraft();
  lastAppliedUserPreferenceInterests.value = [...plannerDraft.value.interests];
  isPlannerEndDateUserLocked.value = false;
  plannerTitle.value = '';
  plannerIsPublic.value = false;
  plannerStops.value = [];
  plannerSuggestedStops.value = [];
  plannerCrew.value = [];
  tripFuelSettings.value = {};
  selectedFuelPricesByPlaceId.value = {};
  currentDraftTrip.value = null;
  tripShareLink.value = '';
  plannerDraftSessionId.value = createPlannerDraftSessionId();
  tripsStore.previewItinerary = null;
  hasGeneratedPreview.value = false;
  draftSaveState.value = 'saved';
  lastPersistedDraftSignature = '';
  inFlightDraftAutosaveSignature = '';
  clearAutoSaveTimer();
  autoSaveRequestId += 1;
  editableTripHydrationRequestId += 1;
}

function resolveIsMobilePlannerLayout(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.innerWidth <= TRIP_PLANNER_MOBILE_BREAKPOINT;
}

function syncMobilePlannerLayout() {
  isMobilePlannerLayout.value = resolveIsMobilePlannerLayout();
}

function clampPlannerStep(step: number): PlannerMobileStep {
  if (step <= 1) {
    return 1;
  }

  if (step >= 4) {
    return 4;
  }

  return step as PlannerMobileStep;
}

function getMobileStepState(step: PlannerMobileStep): 'current' | 'complete' | 'upcoming' {
  if (mobileWizardStep.value === step) {
    return 'current';
  }

  return mobileWizardStep.value > step ? 'complete' : 'upcoming';
}

async function scrollMobileStepIntoView(step: PlannerMobileStep) {
  if (!isMobilePlannerLayout.value || typeof window === 'undefined') {
    return;
  }

  await nextTick();

  const target = document.querySelector(`[data-test="planner-step-${step}-toggle"]`);
  if (!(target instanceof HTMLElement) || typeof target.scrollIntoView !== 'function') {
    return;
  }

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  target.scrollIntoView({
    block: 'start',
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
  });
}

function handleWizardStepChange(step: number) {
  touchPlannerPresence('wizard-step');
  const nextStep = clampPlannerStep(step);
  mobileWizardStep.value = nextStep;
  void scrollMobileStepIntoView(nextStep);
}

function handleTitleUpdate(title: string) {
  const nextTitle = title.trim();
  if (nextTitle === plannerTitle.value.trim()) {
    return;
  }

  plannerTitle.value = nextTitle;
  markDraftAutosavePending();
}

function cloneStops(stops: TripSpot[]): TripSpot[] {
  return stops.map((stop) => ({
    ...stop,
  }));
}

function isScopeAiPlannerSpotCategory(value: string): value is SpotCategory {
  return SCOPE_AI_PLANNER_SPOT_CATEGORIES.has(value as SpotCategory);
}

function isScopeAiPlannerInterestCategory(value: string): value is SpotCategory {
  return SCOPE_AI_PLANNER_INTEREST_CATEGORIES.includes(value as SpotCategory);
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function mapScopeAiStopToPlannerStop(stop: ScopeAiStop, index: number): TripSpot {
  const category = isScopeAiPlannerSpotCategory(stop.type) ? stop.type : 'other';
  const hasStopCoordinates = hasCoordinatePair(stop.latitude, stop.longitude);

  return {
    spotId: stop.id,
    title: stop.name,
    category,
    estimatedCost: stop.estimated_cost,
    duration: stop.estimated_duration_minutes,
    latitude: hasStopCoordinates ? Number(stop.latitude) : Number.NaN,
    longitude: hasStopCoordinates ? Number(stop.longitude) : Number.NaN,
    notes: stop.notes,
    dayNumber: index + 1,
    timeSlot: normalizeItineraryTimeSlot(undefined, index),
  };
}

function syncScopeAiStateToPlanner(aiState: ScopeAiPlannerState): void {
  const previousDraft = plannerDraft.value;
  const nextDraft: TripPlannerInput = {
    ...plannerDraft.value,
    interests: [...plannerDraft.value.interests],
  };
  let titleChanged = false;
  let fuelSettingsChanged = false;
  let draftChanged = false;
  let stopsChanged = false;

  if (aiState.title !== null && plannerTitle.value !== aiState.title) {
    plannerTitle.value = aiState.title;
    titleChanged = true;
  }

  if (aiState.start !== null) {
    if (nextDraft.destination !== aiState.start) {
      nextDraft.destination = aiState.start;
      draftChanged = true;
    }
  } else if (nextDraft.destination || nextDraft.destinationLatitude !== undefined || nextDraft.destinationLongitude !== undefined) {
    nextDraft.destination = '';
    nextDraft.destinationLatitude = undefined;
    nextDraft.destinationLongitude = undefined;
    draftChanged = true;
  }

  if (
    hasCoordinatePair(aiState.startLatitude, aiState.startLongitude) &&
    (
      nextDraft.destinationLatitude !== aiState.startLatitude ||
      nextDraft.destinationLongitude !== aiState.startLongitude
    )
  ) {
    nextDraft.destinationLatitude = aiState.startLatitude;
    nextDraft.destinationLongitude = aiState.startLongitude;
    draftChanged = true;
  }

  if (aiState.end !== null) {
    if (nextDraft.endDestination !== aiState.end) {
      nextDraft.endDestination = aiState.end;
      draftChanged = true;
    }
  } else if (nextDraft.endDestination || nextDraft.endDestinationLatitude !== undefined || nextDraft.endDestinationLongitude !== undefined) {
    nextDraft.endDestination = '';
    nextDraft.endDestinationLatitude = undefined;
    nextDraft.endDestinationLongitude = undefined;
    draftChanged = true;
  }

  if (
    hasCoordinatePair(aiState.endLatitude, aiState.endLongitude) &&
    (
      nextDraft.endDestinationLatitude !== aiState.endLatitude ||
      nextDraft.endDestinationLongitude !== aiState.endLongitude
    )
  ) {
    nextDraft.endDestinationLatitude = aiState.endLatitude;
    nextDraft.endDestinationLongitude = aiState.endLongitude;
    draftChanged = true;
  }

  if (aiState.budget_min !== null && nextDraft.budgetFloor !== aiState.budget_min) {
    nextDraft.budgetFloor = aiState.budget_min;
    draftChanged = true;
  }

  if (aiState.budget_max !== null && nextDraft.budget !== aiState.budget_max) {
    nextDraft.budget = aiState.budget_max;
    draftChanged = true;
  }

  if (nextDraft.budget < nextDraft.budgetFloor) {
    nextDraft.budgetFloor = nextDraft.budget;
    draftChanged = true;
  }

  if (aiState.start_date !== null && nextDraft.startDate !== aiState.start_date) {
    nextDraft.startDate = aiState.start_date;
    draftChanged = true;
  } else if (aiState.date !== null && nextDraft.startDate !== aiState.date) {
    nextDraft.startDate = aiState.date;
    draftChanged = true;
  }

  if (aiState.end_date !== null && nextDraft.endDate !== aiState.end_date) {
    nextDraft.endDate = aiState.end_date;
    isPlannerEndDateUserLocked.value = true;
    draftChanged = true;
  }

  if (aiState.pace) {
    const nextPace = aiState.pace === 'standard' ? 'moderate' : aiState.pace;
    if (nextDraft.pace !== nextPace) {
      nextDraft.pace = nextPace;
      draftChanged = true;
    }
  }

  if (aiState.theme.length) {
    const nextInterests = aiState.theme.filter(isScopeAiPlannerInterestCategory);
    if (!areStringArraysEqual(nextDraft.interests, nextInterests)) {
      nextDraft.interests = nextInterests;
      draftChanged = true;
    }
  }

  if (aiState.party_size !== null && nextDraft.groupSize !== aiState.party_size) {
    nextDraft.groupSize = aiState.party_size;
    draftChanged = true;
  }

  const nextFuelSettings: TripFuelSettings = { ...tripFuelSettings.value };
  if (aiState.fuel_type !== null) {
    const nextFuelType = sanitizeFuelType(aiState.fuel_type);
    if (nextFuelType && nextFuelSettings.fuelType !== nextFuelType) {
      nextFuelSettings.fuelType = nextFuelType;
      fuelSettingsChanged = true;
    }
    if (nextFuelType === 'ev' && (nextFuelSettings.mpg !== undefined || nextFuelSettings.gasPricePerGallon !== undefined)) {
      delete nextFuelSettings.mpg;
      delete nextFuelSettings.gasPricePerGallon;
      fuelSettingsChanged = true;
    }
  }
  if (aiState.mpg !== null && nextFuelSettings.mpg !== aiState.mpg) {
    nextFuelSettings.mpg = aiState.mpg;
    fuelSettingsChanged = true;
  }
  if (aiState.gas_price !== null && nextFuelSettings.gasPricePerGallon !== aiState.gas_price) {
    nextFuelSettings.gasPricePerGallon = aiState.gas_price;
    fuelSettingsChanged = true;
  }

  if (aiState.stops.length || plannerStops.value.length) {
    const nextStops = aiState.stops.map(mapScopeAiStopToPlannerStop);
    if (JSON.stringify(plannerStops.value) !== JSON.stringify(nextStops)) {
      plannerStops.value = cloneStops(nextStops);
      stopsChanged = true;
    }
  }

  if (fuelSettingsChanged) {
    tripFuelSettings.value = nextFuelSettings;
  }

  if (draftChanged) {
    syncGeneratedPlannerTitleForDraftChange(previousDraft, nextDraft);
    plannerDraft.value = nextDraft;
    focusPlannerMapForScopeAiEndpointChange(previousDraft, nextDraft);
  }

  if (titleChanged || fuelSettingsChanged || draftChanged || stopsChanged) {
    hasGeneratedPreview.value = false;
    markDraftAutosavePending();
  }
}

function normalizeItineraryTimeSlot(value: string | undefined, fallbackIndex = 0): string {
  const trimmedValue = value?.trim() ?? '';
  const timeMatch = /^(\d{1,2}):([0-5]\d)$/.exec(trimmedValue);
  if (timeMatch) {
    const hour = Number.parseInt(timeMatch[1] ?? '', 10);
    const minutes = timeMatch[2] ?? '00';
    if (hour >= 0 && hour <= 23) {
      return `${String(hour).padStart(2, '0')}:${minutes}`;
    }
  }

  return DEFAULT_ITINERARY_TIME_SLOTS[fallbackIndex % DEFAULT_ITINERARY_TIME_SLOTS.length] ?? '09:00';
}

function normalizeItineraryDayNumber(value: number | undefined, fallbackDayNumber: number): number {
  if (!Number.isFinite(value)) {
    return fallbackDayNumber;
  }

  return Math.max(1, Math.round(Number(value)));
}

function compareItineraryStops(left: TripSpot, right: TripSpot): number {
  const dayComparison = (left.dayNumber ?? 1) - (right.dayNumber ?? 1);
  if (dayComparison !== 0) {
    return dayComparison;
  }

  const timeComparison = normalizeItineraryTimeSlot(left.timeSlot).localeCompare(normalizeItineraryTimeSlot(right.timeSlot));
  if (timeComparison !== 0) {
    return timeComparison;
  }

  return left.title.localeCompare(right.title);
}

function normalizeItineraryStops(stops: TripSpot[]): TripSpot[] {
  return stops
    .map((stop, index) => ({
      ...stop,
      dayNumber: normalizeItineraryDayNumber(stop.dayNumber, Math.floor(index / 3) + 1),
      timeSlot: normalizeItineraryTimeSlot(stop.timeSlot, index),
    }))
    .sort(compareItineraryStops);
}

function getMaxItineraryDayNumber(stops: TripSpot[]): number {
  return stops.reduce((maxDay, stop) => Math.max(maxDay, normalizeItineraryDayNumber(stop.dayNumber, 1)), 0);
}

function syncEndDateFromTimelineStops(stops: TripSpot[]): boolean {
  if (isPlannerEndDateUserLocked.value || !stops.length || !plannerDraft.value.startDate) {
    return false;
  }

  const maxDayNumber = getMaxItineraryDayNumber(stops);
  if (maxDayNumber < 1) {
    return false;
  }

  const nextEndDate = addCalendarDays(plannerDraft.value.startDate, maxDayNumber - 1);
  if (!nextEndDate || nextEndDate === plannerDraft.value.endDate) {
    return false;
  }

  plannerDraft.value = {
    ...plannerDraft.value,
    endDate: nextEndDate,
  };
  return true;
}

function rebuildPreviewItineraryFromStops(stops: TripSpot[]): Itinerary | null {
  const previewItinerary = tripsStore.previewItinerary;
  if (!previewItinerary) {
    return null;
  }

  const dayLookup = new Map<number, Itinerary['days'][number]>();
  const anchorDate = plannerDraft.value.startDate || previewItinerary.days[0]?.date || todayDateInput;

  stops.forEach((stop) => {
    const dayNumber = normalizeItineraryDayNumber(stop.dayNumber, 1);
    if (!dayLookup.has(dayNumber)) {
      dayLookup.set(dayNumber, {
        dayNumber,
        date: addCalendarDays(anchorDate, dayNumber - 1),
        spots: [],
      });
    }

    dayLookup.get(dayNumber)?.spots.push({
      ...stop,
      dayNumber,
      timeSlot: normalizeItineraryTimeSlot(stop.timeSlot),
    });
  });

  const days = [...dayLookup.values()]
    .map((day) => ({
      ...day,
      spots: [...day.spots].sort(compareItineraryStops),
    }))
    .sort((left, right) => left.dayNumber - right.dayNumber);

  return {
    ...previewItinerary,
    days,
    totalEstimatedCost: days
      .flatMap((day) => day.spots)
      .reduce((total, stop) => total + (stop.estimatedCost ?? 0), 0),
  };
}

function cloneMembers(members: TripMember[]): TripMember[] {
  return members.map((member) => sanitizeTripMember({ ...member }, { allowGeneratedAvatar: true }));
}

function syncPresetExperience(destination: string, previousDestination?: string, forceRouteReset = false) {
  const matchedPreset = matchTripPlannerPreset(destination);
  const previousPreset = previousDestination ? matchTripPlannerPreset(previousDestination) : null;
  if (!matchedPreset) {
    if (forceRouteReset || previousPreset) {
      plannerStops.value = [];
      plannerSuggestedStops.value = [];
      plannerCrew.value = [];
    }

    return null;
  }

  const shouldResetRoute = forceRouteReset || Boolean(previousPreset);

  if (shouldResetRoute) {
    plannerStops.value = cloneStops(matchedPreset.stops);
  }

  plannerSuggestedStops.value = cloneStops(matchedPreset.suggestedStops);
  plannerCrew.value = cloneMembers(matchedPreset.crew);
  return matchedPreset;
}

function normalizePlannerInputForCompare(input: TripPlannerInput): string {
  return JSON.stringify({
    destination: input.destination.trim(),
    endDestination: input.endDestination?.trim() ?? '',
    destinationLatitude: input.destinationLatitude ?? null,
    destinationLongitude: input.destinationLongitude ?? null,
    endDestinationLatitude: input.endDestinationLatitude ?? null,
    endDestinationLongitude: input.endDestinationLongitude ?? null,
    startDate: input.startDate,
    endDate: input.endDate,
    budgetFloor: input.budgetFloor ?? 0,
    budget: input.budget,
    interests: [...input.interests].sort(),
    pace: input.pace,
    groupSize: input.groupSize,
  });
}

function hasCoordinatePair(latitude: number | undefined, longitude: number | undefined): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Number(latitude) >= -90 &&
    Number(latitude) <= 90 &&
    Number(longitude) >= -180 &&
    Number(longitude) <= 180;
}

function hasMeaningfulPlannerEndpointLabel(value: string | undefined): boolean {
  const normalizedValue = value?.trim().toLowerCase() ?? '';
  return Boolean(
    normalizedValue &&
    normalizedValue !== 'planning route' &&
    normalizedValue !== 'untitled trip',
  );
}

function isPlannerRouteDraftBlank(draft: TripPlannerInput): boolean {
  return !draft.destination.trim() &&
    !(draft.endDestination?.trim() ?? '') &&
    !hasCoordinatePair(draft.destinationLatitude, draft.destinationLongitude) &&
    !hasCoordinatePair(draft.endDestinationLatitude, draft.endDestinationLongitude);
}

function resetBlankPlannerRouteWorkspace(): void {
  mapViewportRequestId += 1;
  hasPlannerHomeBaseSearchAnchor.value = false;
  mapStore.setSelectedSpotId(null);
  mapStore.resetVisibleSpotIds();
  setPlannerMapViewport(getPlannerDefaultMapViewport());
  plannerStops.value = [];
  plannerSuggestedStops.value = [];
  tripsStore.previewItinerary = null;
  hasGeneratedPreview.value = false;
}

function syncBlankPlannerRouteWorkspace(draft: TripPlannerInput): void {
  if (isPlannerRouteDraftBlank(draft)) {
    resetBlankPlannerRouteWorkspace();
  }
}

function hasAutosavableDraftInput(): boolean {
  const draft = plannerDraft.value;
  return Boolean(
    plannerTitle.value.trim()
    || draft.destination.trim()
    || draft.endDestination?.trim()
    || hasCoordinatePair(draft.destinationLatitude, draft.destinationLongitude)
    || hasCoordinatePair(draft.endDestinationLatitude, draft.endDestinationLongitude)
    || plannerStops.value.length
    || draft.interests.length
    || draft.pace !== 'relaxed'
    || draft.groupSize !== 1
    || draft.startDate !== todayDateInput
    || draft.endDate !== todayDateInput
    || (draft.budgetFloor ?? DEFAULT_BUDGET_FLOOR) !== DEFAULT_BUDGET_FLOOR
    || draft.budget !== DEFAULT_BUDGET_CEILING
    || plannerIsPublic.value
  );
}

function hasAutosavableRouteContent(): boolean {
  const draft = plannerDraft.value;
  return Boolean(
    draft.destination.trim()
    || draft.endDestination?.trim()
    || hasCoordinatePair(draft.destinationLatitude, draft.destinationLongitude)
    || hasCoordinatePair(draft.endDestinationLatitude, draft.endDestinationLongitude)
    || plannerStops.value.length
    || flattenPreviewStops(tripsStore.previewItinerary).length
  );
}

function shouldStopNewDraftAutosaveRetry(): boolean {
  return !currentDraftTrip.value && !hasAutosavableRouteContent();
}

function buildDraftAutosaveSignature(): string {
  const draft = plannerDraft.value;
  return JSON.stringify({
    title: plannerTitle.value.trim(),
    destination: draft.destination.trim(),
    endDestination: draft.endDestination?.trim() ?? '',
    destinationLatitude: draft.destinationLatitude ?? null,
    destinationLongitude: draft.destinationLongitude ?? null,
    endDestinationLatitude: draft.endDestinationLatitude ?? null,
    endDestinationLongitude: draft.endDestinationLongitude ?? null,
    startDate: draft.startDate,
    endDate: draft.endDate,
    budgetFloor: draft.budgetFloor ?? DEFAULT_BUDGET_FLOOR,
    budget: draft.budget,
    interests: [...draft.interests].sort(),
    pace: draft.pace,
    groupSize: draft.groupSize,
    isPublic: plannerIsPublic.value,
    stops: plannerStops.value.map((stop) => ({
      spotId: stop.spotId,
      title: stop.title,
      timeSlot: stop.timeSlot ?? '',
      duration: stop.duration ?? null,
      latitude: stop.latitude,
      longitude: stop.longitude,
      category: stop.category,
      estimatedCost: stop.estimatedCost ?? null,
      photoUrl: stop.photoUrl ?? '',
      city: stop.city ?? '',
      dayNumber: stop.dayNumber ?? null,
      notes: stop.notes ?? '',
    })),
  });
}

function clearAutoSaveTimer(): void {
  if (!autoSaveTimer) {
    scheduledDraftAutosaveSignature = '';
    return;
  }

  clearTimeout(autoSaveTimer);
  autoSaveTimer = null;
  scheduledDraftAutosaveSignature = '';
}

function scheduleDraftAutosave(
  delayMs = TRIP_PLANNER_AUTOSAVE_DEBOUNCE_MS,
  signature = draftAutosaveSignature.value,
): void {
  if (isTripPlannerAuditMode || !hasAutosavableDraftInput()) {
    clearAutoSaveTimer();
    return;
  }

  clearAutoSaveTimer();
  scheduledDraftAutosaveSignature = signature;
  autoSaveTimer = setTimeout(() => {
    void runDraftAutosave();
  }, delayMs);
}

function markDraftAutosavePending(): void {
  touchPlannerPresence('draft-change');

  if (!hasAutosavableDraftInput()) {
    clearAutoSaveTimer();
    draftSaveState.value = 'saved';
    return;
  }

  const signature = draftAutosaveSignature.value;
  if (signature === lastPersistedDraftSignature) {
    clearAutoSaveTimer();
    draftSaveState.value = 'saved';
    return;
  }

  if (
    (draftSaveState.value === 'saving' && signature === inFlightDraftAutosaveSignature) ||
    (draftSaveState.value === 'unsaved' && autoSaveTimer && signature === scheduledDraftAutosaveSignature)
  ) {
    return;
  }

  autoSaveRequestId += 1;
  draftSaveState.value = 'unsaved';
  scheduleDraftAutosave(TRIP_PLANNER_AUTOSAVE_DEBOUNCE_MS, signature);
}

async function runDraftAutosave(): Promise<void> {
  clearAutoSaveTimer();

  if (isTripPlannerAuditMode || !hasAutosavableDraftInput()) {
    draftSaveState.value = 'saved';
    return;
  }

  if (tripsStore.saving || tripsStore.planning) {
    scheduleDraftAutosave(TRIP_PLANNER_AUTOSAVE_RETRY_MS);
    return;
  }

  const signatureToPersist = draftAutosaveSignature.value;
  if (signatureToPersist === lastPersistedDraftSignature) {
    draftSaveState.value = 'saved';
    return;
  }

  const requestId = ++autoSaveRequestId;
  touchPlannerPresence('autosave');
  inFlightDraftAutosaveSignature = signatureToPersist;

  try {
    await savePlannerDraft({
      announce: false,
      preserveRoute: true,
      surfaceError: false,
      persistedSignature: signatureToPersist,
    });

    if (requestId !== autoSaveRequestId) {
      if (draftAutosaveSignature.value !== lastPersistedDraftSignature && hasAutosavableDraftInput()) {
        draftSaveState.value = 'unsaved';
        scheduleDraftAutosave();
      }
      return;
    }

    if (draftAutosaveSignature.value !== signatureToPersist && hasAutosavableDraftInput()) {
      draftSaveState.value = 'unsaved';
      scheduleDraftAutosave();
      return;
    }

    lastPersistedDraftSignature = signatureToPersist;
    draftSaveState.value = 'saved';
  } catch {
    tripsStore.error = null;
    if (requestId === autoSaveRequestId && hasAutosavableDraftInput()) {
      if (shouldStopNewDraftAutosaveRetry()) {
        lastPersistedDraftSignature = draftAutosaveSignature.value;
        draftSaveState.value = 'saved';
        return;
      }

      draftSaveState.value = 'unsaved';
      scheduleDraftAutosave(TRIP_PLANNER_AUTOSAVE_RETRY_MS);
    }
  } finally {
    if (inFlightDraftAutosaveSignature === signatureToPersist) {
      inFlightDraftAutosaveSignature = '';
    }
  }
}

function handleDraftUpdate(payload: TripPlannerInput) {
  if (normalizePlannerInputForCompare(plannerDraft.value) === normalizePlannerInputForCompare(payload)) {
    return;
  }

  const previousDraft = plannerDraft.value;
  const shouldLockEndDate = previousDraft.endDate !== payload.endDate && !isAiSyncInProgress && !isScopeAiHydratingFromPlanner;
  const nextDraft = {
    ...payload,
    endDestination: payload.endDestination ?? '',
    destinationLatitude: payload.destinationLatitude,
    destinationLongitude: payload.destinationLongitude,
    endDestinationLatitude: payload.endDestinationLatitude,
    endDestinationLongitude: payload.endDestinationLongitude,
    budgetFloor: payload.budgetFloor ?? 0,
    interests: [...payload.interests],
  };
  syncGeneratedPlannerTitleForDraftChange(previousDraft, nextDraft);
  plannerDraft.value = nextDraft;
  if (shouldLockEndDate) {
    isPlannerEndDateUserLocked.value = true;
  }
  hasGeneratedPreview.value = false;
  syncBlankPlannerRouteWorkspace(nextDraft);
  markDraftAutosavePending();
}

function handleFuelSettingsUpdate(payload: TripFuelSettings): void {
  touchPlannerPresence('fuel-settings');
  const nextFuelType = sanitizeFuelType(payload.fuelType) ?? tripFuelSettings.value.fuelType ?? 'regular';
  if (tripFuelSettings.value.fuelType && tripFuelSettings.value.fuelType !== nextFuelType) {
    selectedFuelPricesByPlaceId.value = {};
  }

  tripFuelSettings.value = {
    mpg: sanitizePositiveFuelValue(payload.mpg),
    gasPricePerGallon: sanitizePositiveFuelValue(payload.gasPricePerGallon),
    fuelType: nextFuelType,
  };
}

function handleFuelPriceSelect(payload: RouteFuelPriceSelection): void {
  touchPlannerPresence('fuel-price');
  const price = sanitizePositiveFuelValue(payload.pricePerGallon);
  if (!price || !payload.placeId.trim()) {
    return;
  }

  selectedFuelPricesByPlaceId.value = {
    ...selectedFuelPricesByPlaceId.value,
    [payload.placeId]: price,
  };

  const selectedPrices = Object.values(selectedFuelPricesByPlaceId.value).filter((entry) => Number.isFinite(entry) && entry > 0);
  if (!selectedPrices.length) {
    return;
  }

  const averagePrice = roundFuelPrice(selectedPrices.reduce((total, entry) => total + entry, 0) / selectedPrices.length);
  tripFuelSettings.value = {
    ...tripFuelSettings.value,
    gasPricePerGallon: averagePrice,
    fuelType: sanitizeFuelType(payload.fuelType) ?? tripFuelSettings.value.fuelType ?? 'regular',
  };
}

function handleFuelSettingsRequest(): void {
  touchPlannerPresence('fuel-panel');
  tripPlanner.value?.scrollToFuelSettings();
}

function handleFuelTypeSelect(fuelType: TripFuelType): void {
  touchPlannerPresence('fuel-type');
  if (tripFuelSettings.value.fuelType !== fuelType) {
    selectedFuelPricesByPlaceId.value = {};
  }

  tripFuelSettings.value = {
    ...tripFuelSettings.value,
    fuelType: sanitizeFuelType(fuelType) ?? 'regular',
  };
}

function handleMapLocationSelect(selection: PlannerMapLocationSelection) {
  const nextLocationLabel = selection.label.trim();
  if (!nextLocationLabel) {
    return;
  }

  const previousDraft = plannerDraft.value;
  const previousDestination = plannerDraft.value.destination;
  const nextDraft = selection.target === 'destination'
    ? {
        ...plannerDraft.value,
        destination: nextLocationLabel,
        destinationLatitude: selection.latitude,
        destinationLongitude: selection.longitude,
      }
    : {
        ...plannerDraft.value,
        endDestination: nextLocationLabel,
        endDestinationLatitude: selection.latitude,
        endDestinationLongitude: selection.longitude,
      };
  syncGeneratedPlannerTitleForDraftChange(previousDraft, nextDraft);
  plannerDraft.value = nextDraft;
  hasGeneratedPreview.value = false;

  if (selection.target === 'destination') {
    syncPresetExperience(nextLocationLabel, previousDestination, nextLocationLabel !== previousDestination);
  }

  markDraftAutosavePending();

  toastStore.showSuccess({
    title: selection.target === 'destination' ? 'Start city set' : 'End city set',
    message: `${nextLocationLabel} was added from the map.`,
  });
}

function handleRouteEndpointRemove(target: PlannerMapPickTarget): void {
  const previousDraft = plannerDraft.value;
  const endpointLabel = target === 'destination'
    ? plannerDraft.value.destination.trim()
    : plannerDraft.value.endDestination?.trim() ?? '';

  const nextDraft = target === 'destination'
    ? {
        ...plannerDraft.value,
        destination: '',
        destinationLatitude: undefined,
        destinationLongitude: undefined,
      }
    : {
        ...plannerDraft.value,
        endDestination: '',
        endDestinationLatitude: undefined,
        endDestinationLongitude: undefined,
      };
  syncGeneratedPlannerTitleForDraftChange(previousDraft, nextDraft);
  plannerDraft.value = nextDraft;
  tripsStore.previewItinerary = null;
  hasGeneratedPreview.value = false;
  syncBlankPlannerRouteWorkspace(nextDraft);

  markDraftAutosavePending();

  toastStore.showSuccess({
    title: target === 'destination' ? 'Start removed' : 'End removed',
    message: endpointLabel ? `${endpointLabel} was removed from the route.` : 'That endpoint was removed from the route.',
  });
}

function handleRouteStopAdd(stop: TripSpot) {
  const nextStopIndex = plannerStops.value.length;
  plannerStops.value = cloneStops([
    ...plannerStops.value,
    {
      ...stop,
      dayNumber: stop.dayNumber ?? nextStopIndex + 1,
      timeSlot: normalizeItineraryTimeSlot(stop.timeSlot, nextStopIndex),
    },
  ]);
  tripsStore.previewItinerary = null;
  hasGeneratedPreview.value = false;

  markDraftAutosavePending();

  toastStore.showSuccess({
    title: 'Route stop added',
    message: `${stop.title} was added between start and end.`,
  });
}

function handleRouteStopRemove(spotId: string) {
  const nextStops = plannerStops.value.filter((stop) => stop.spotId !== spotId);
  if (nextStops.length === plannerStops.value.length) {
    return;
  }

  plannerStops.value = cloneStops(nextStops);
  tripsStore.previewItinerary = null;
  hasGeneratedPreview.value = false;

  markDraftAutosavePending();
}

function handleRouteStopsReplace(stops: TripSpot[]) {
  plannerStops.value = cloneStops(stops);
  tripsStore.previewItinerary = null;
  hasGeneratedPreview.value = false;

  markDraftAutosavePending();

  toastStore.showSuccess({
    title: 'Route tightened',
    message: stops.length ? `${stops.length} committed stop${stops.length === 1 ? '' : 's'} kept in the route.` : 'The route is cleared for a lean itinerary build.',
  });
}

function handleItineraryStopsUpdate(stops: TripSpot[]) {
  const nextStops = normalizeItineraryStops(stops);
  plannerStops.value = cloneStops(nextStops);
  syncEndDateFromTimelineStops(nextStops);

  const nextPreview = rebuildPreviewItineraryFromStops(nextStops);
  if (nextPreview) {
    tripsStore.previewItinerary = nextPreview;
    hasGeneratedPreview.value = true;
  }

  markDraftAutosavePending();
}

async function handleAiItineraryBuildRequest(payload: AiItineraryBuildRequestPayload) {
  touchPlannerPresence('ai-itinerary-build');
  payload.handled = true;

  if (tripsStore.planning) {
    payload.resolve({
      status: 'busy',
      routeLabel: resolvePlannerDestination(),
      stopCount: plannerStops.value.length,
      dayCount: getInclusiveDaySpan(plannerDraft.value.startDate, plannerDraft.value.endDate),
    });
    return;
  }

  try {
    const buildDraft: TripPlannerInput = {
      ...plannerDraft.value,
      ...payload.draftDefaults,
      endDestination: plannerDraft.value.endDestination ?? '',
      interests: payload.draftDefaults?.interests
        ? [...payload.draftDefaults.interests]
        : [...plannerDraft.value.interests],
    };
    const itinerary = await handleGenerate(
      buildDraft,
      {
        successToast: false,
        errorToast: false,
        rethrow: true,
        saveDraft: false,
        requestedDateSpan: payload.draftDefaults?.startDate && payload.draftDefaults?.endDate
          ? {
              startDate: buildDraft.startDate,
              endDate: buildDraft.endDate,
            }
          : undefined,
      },
    );

    if (!itinerary) {
      throw new Error(tripsStore.error ?? 'Scope could not generate an itinerary right now.');
    }

    payload.resolve({
      status: 'success',
      routeLabel: resolvePlannerDestination(),
      stopCount: flattenPreviewStops(itinerary).length,
      dayCount: getInclusiveDaySpan(buildDraft.startDate, buildDraft.endDate),
    });
  } catch (error) {
    payload.reject(error);
  }
}

async function handlePlannerHandoff(payload: TripPlannerInput): Promise<void> {
  touchPlannerPresence('planner-handoff');
  const previousDestination = plannerDraft.value.destination;
  if (plannerDraft.value.endDate !== payload.endDate) {
    isPlannerEndDateUserLocked.value = true;
  }
  plannerDraft.value = {
    ...payload,
    endDestination: payload.endDestination ?? '',
    destinationLatitude: payload.destinationLatitude,
    destinationLongitude: payload.destinationLongitude,
    endDestinationLatitude: payload.endDestinationLatitude,
    endDestinationLongitude: payload.endDestinationLongitude,
    budgetFloor: payload.budgetFloor ?? 0,
    interests: [...payload.interests],
  };

  syncPresetExperience(payload.destination, previousDestination, payload.destination !== previousDestination);

  if (isMobilePlannerLayout.value) {
    handleWizardStepChange(4);
  }

  const handoffPrompt = buildPlannerHandoffPrompt(payload);
  await nextTick();

  if (!isTripPlannerAuditMode && tripAiAssist.value?.handoffPlannerBrief) {
    const handledByAssistant = await tripAiAssist.value.handoffPlannerBrief({ prompt: handoffPrompt });
    if (handledByAssistant) {
      return;
    }
  }

  await handleGenerate(payload);
}

async function handleOpenTripAi(): Promise<void> {
  touchPlannerPresence('open-ai');
  if (isTripPlannerAuditMode) {
    return;
  }

  await nextTick();
  await tripAiAssist.value?.focusComposer();
}

async function savePlannerDraft(options: SavePlannerDraftOptions = {}): Promise<Trip> {
  touchPlannerPresence('save-draft');
  draftSaveState.value = 'saving';

  try {
    const input = buildDraftTripInput();
    const savedTrip = currentDraftTrip.value
      ? await tripsStore.updateTrip(currentDraftTrip.value.id, input)
      : await tripsStore.createTrip(input);

    currentDraftTrip.value = savedTrip;
    plannerIsPublic.value = savedTrip.isPublic;
    plannerCrew.value = savedTrip.members;
    lastPersistedDraftSignature = options.persistedSignature ?? draftAutosaveSignature.value;
    draftSaveState.value = 'saved';

    if (options.preserveRoute === false && !(route.name === 'trip-edit' && route.params.id === savedTrip.id)) {
      await router.replace({ name: 'trip-edit', params: { id: savedTrip.id } });
    }

    if (options.announce ?? true) {
      toastStore.showSuccess({
        title: 'Draft saved',
        message: 'This trip now lives in Trips, and you can keep building here.',
      });
    }

    return savedTrip;
  } catch (error) {
    draftSaveState.value = 'unsaved';
    if (options.surfaceError ?? true) {
      toastStore.showError({
        title: 'Draft save failed',
        message: tripsStore.error ?? 'Scope could not save this trip draft right now.',
      });
    } else {
      tripsStore.error = null;
    }
    throw error;
  }
}

async function handleSaveDraft() {
  touchPlannerPresence('manual-save');
  await savePlannerDraft({ preserveRoute: true });
}

async function handleShareDraft() {
  touchPlannerPresence('share');
  try {
    const savedTrip = await savePlannerDraft({ announce: !currentDraftTrip.value, preserveRoute: true });
    const shareLink = await tripsStore.createShareLink(savedTrip.id);
    tripShareLink.value = shareLink.url;
    isShareModalOpen.value = true;
  } catch {
    toastStore.showError({
      title: 'Share failed',
      message: tripsStore.error ?? 'Scope could not create a live trip share link right now.',
    });
  }
}

async function loadRouteSpotIntoPlanner(): Promise<void> {
  const spotId = routeSpotId.value;
  if (!spotId || route.name === 'trip-edit' || plannerStops.value.some((stop) => stop.spotId === spotId)) {
    return;
  }

  try {
    const spot = await spotsStore.fetchSpot(spotId);
    if (!spot || routeSpotId.value !== spotId || plannerStops.value.some((stop) => stop.spotId === spot.id)) {
      return;
    }

    handleRouteStopAdd({
      spotId: spot.id,
      title: spot.title,
      latitude: spot.latitude,
      longitude: spot.longitude,
      category: spot.category,
      photoUrl: spot.photoUrl ?? spot.photos?.[0]?.url,
      city: spot.city,
      dayNumber: 1,
    });
  } catch {
    toastStore.showError({
      title: 'Spot unavailable',
      message: spotsStore.error ?? 'Scope could not add that spot to the planner.',
    });
  }
}

async function handleDeleteCurrentDraft() {
  touchPlannerPresence('delete-open');
  if (!currentDraftTrip.value) {
    return;
  }

  isDeleteDraftDialogOpen.value = true;
}

function cancelDeleteCurrentDraft() {
  touchPlannerPresence('delete-cancel');
  isDeleteDraftDialogOpen.value = false;
}

async function confirmDeleteCurrentDraft() {
  touchPlannerPresence('delete-confirm');
  const draftTrip = currentDraftTrip.value;
  if (!draftTrip) {
    isDeleteDraftDialogOpen.value = false;
    return;
  }

  clearAutoSaveTimer();
  autoSaveRequestId += 1;

  try {
    await tripsStore.deleteTrip(draftTrip.id);
    isDeleteDraftDialogOpen.value = false;
    resetPlannerDraftWorkspace();
    await router.replace({ name: 'trips' });

    toastStore.showSuccess({
      title: 'Draft deleted',
      message: 'That autosaved trip draft was removed from your workspace.',
    });
  } catch {
    isDeleteDraftDialogOpen.value = false;
    draftSaveState.value = 'saved';
    toastStore.showError({
      title: 'Draft delete failed',
      message: tripsStore.error ?? 'Scope could not delete that trip draft right now.',
    });
  }
}

async function handleTripVisibilityUpdate(isPublic: boolean): Promise<void> {
  touchPlannerPresence('visibility');
  if (plannerIsPublic.value === isPublic) {
    return;
  }

  const previousVisibility = plannerIsPublic.value;
  plannerIsPublic.value = isPublic;

  if (currentDraftTrip.value) {
    currentDraftTrip.value = {
      ...currentDraftTrip.value,
      isPublic,
    };
  }

  try {
    await savePlannerDraft({ announce: false, preserveRoute: true });
    toastStore.showSuccess({
      title: isPublic ? 'Trip is public' : 'Trip is private',
      message: isPublic ? 'Anyone with Scope access can view it now.' : 'Only the trip crew can view it now.',
    });
  } catch {
    plannerIsPublic.value = previousVisibility;
    if (currentDraftTrip.value) {
      currentDraftTrip.value = {
        ...currentDraftTrip.value,
        isPublic: previousVisibility,
      };
    }
  }
}

async function deletePlannerDraftFromAi(): Promise<void> {
  touchPlannerPresence('ai-delete');
  clearAutoSaveTimer();
  autoSaveRequestId += 1;

  const draftTrip = currentDraftTrip.value;
  if (!draftTrip) {
    resetPlannerDraftWorkspace();
    await router.replace({ name: 'trips' });
    toastStore.showSuccess({
      title: 'Draft cleared',
      message: 'That unsaved trip draft was cleared from the planner.',
    });
    return;
  }

  try {
    await tripsStore.deleteTrip(draftTrip.id);
    resetPlannerDraftWorkspace();
    await router.replace({ name: 'trips' });

    toastStore.showSuccess({
      title: 'Draft deleted',
      message: 'That autosaved trip draft was removed from your workspace.',
    });
  } catch (error) {
    draftSaveState.value = 'saved';
    toastStore.showError({
      title: 'Draft delete failed',
      message: tripsStore.error ?? 'Scope could not delete that trip draft right now.',
    });
    throw error;
  }
}

async function inviteTripMemberFromAi(payload: { recipient: string; role: TripInviteInput['role'] }): Promise<void> {
  touchPlannerPresence('ai-invite');
  if (!currentDraftTrip.value) {
    await savePlannerDraft({ announce: false, preserveRoute: true });
  }

  if (!currentDraftTrip.value) {
    throw new Error('Save the trip draft before inviting members.');
  }

  const updatedTrip = await tripsStore.inviteMember(currentDraftTrip.value.id, payload);
  currentDraftTrip.value = updatedTrip;
  plannerIsPublic.value = updatedTrip.isPublic;
  plannerCrew.value = updatedTrip.members;
  plannerDraft.value = {
    ...plannerDraft.value,
    groupSize: Math.max(plannerDraft.value.groupSize, updatedTrip.members.length),
  };
  toastStore.showSuccess({
    title: 'Invite queued',
    message: `${payload.recipient} can ${payload.role === 'editor' ? 'edit' : 'view'} this trip when they accept.`,
  });
}

async function handleScopeAiTripCommand(payload: ScopeAiTripCommandPayload): Promise<ScopeAiCommandResult> {
  touchPlannerPresence(`ai-trip-command-${payload.type}`);
  try {
    if (payload.type === 'save') {
      await savePlannerDraft({ preserveRoute: true });
      return { ok: true, message: 'Saved this trip draft.' };
    }

    if (payload.type === 'share') {
      const savedTrip = await savePlannerDraft({ announce: !currentDraftTrip.value, preserveRoute: true });
      const shareLink = await tripsStore.createShareLink(savedTrip.id);
      tripShareLink.value = shareLink.url;
      isShareModalOpen.value = true;
      return { ok: true, message: 'Created a live share link for this trip draft.' };
    }

    if (payload.type === 'delete') {
      await deletePlannerDraftFromAi();
      return { ok: true, message: 'Deleted this trip draft.' };
    }

    if (payload.type === 'visibility') {
      if (plannerIsPublic.value === payload.isPublic) {
        return {
          ok: true,
          message: payload.isPublic ? 'This trip is already public.' : 'This trip is already private.',
        };
      }

      await handleTripVisibilityUpdate(payload.isPublic);
      return {
        ok: plannerIsPublic.value === payload.isPublic,
        message: plannerIsPublic.value === payload.isPublic
          ? payload.isPublic ? 'Made this trip public.' : 'Made this trip private.'
          : 'I could not update that trip visibility right now.',
      };
    }

    if (payload.type === 'invite') {
      await inviteTripMemberFromAi({
        recipient: payload.recipient,
        role: payload.role,
      });
      return {
        ok: true,
        message: `Invited ${payload.recipient} as ${payload.role === 'viewer' ? 'a viewer' : 'an editor'}.`,
      };
    }
  } catch {
    return {
      ok: false,
      message: tripsStore.error || 'Scope could not finish that trip document action right now.',
    };
  }

  return {
    ok: false,
    message: 'I could not match that trip document action.',
  };
}

function resolveScopeAiMapTargetZoom(precision?: string): number {
  const normalized = precision?.toLowerCase() ?? '';
  if (/\bcountry\b/.test(normalized)) {
    return 3.75;
  }
  if (/\b(?:region|state|province)\b/.test(normalized)) {
    return 5.4;
  }
  if (/\b(?:district|county)\b/.test(normalized)) {
    return 7.25;
  }
  if (/\b(?:place|city|locality)\b/.test(normalized)) {
    return 10.5;
  }
  if (/\b(?:neighborhood|postcode)\b/.test(normalized)) {
    return 12.25;
  }
  return 14;
}

function formatScopeAiMapTargetLabel(result: GeocodeResult, fallback: string): string {
  return result.formattedAddress?.trim() ||
    result.placeName?.trim() ||
    result.address?.trim() ||
    fallback.trim();
}

function normalizeScopeAiMapTargetText(value: string | undefined): string {
  return value
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim() ?? '';
}

const SCOPE_AI_US_STATE_NAME_BY_CODE = new Map(
  US_STATE_LABELS.map((state) => [state.code.toLowerCase(), normalizeScopeAiMapTargetText(state.name)]),
);
const SCOPE_AI_US_STATE_CODE_HINTS = new Set(
  US_STATE_LABELS
    .map((state) => state.code.toLowerCase())
    .filter((code) => !new Set(['as', 'hi', 'id', 'in', 'me', 'or']).has(code)),
);
const SCOPE_AI_GLOBAL_MAP_HINTS = [
  'country',
  'canada',
  'mexico',
  'australia',
  'united kingdom',
  'uk',
  'england',
  'scotland',
  'wales',
  'ireland',
  'france',
  'spain',
  'italy',
  'germany',
  'japan',
  'china',
  'india',
  'brazil',
  'argentina',
  'colombia',
  'peru',
  'chile',
  'south africa',
  'egypt',
  'turkey',
  'netherlands',
  'portugal',
  'switzerland',
  'south korea',
  'singapore',
  'thailand',
  'united arab emirates',
  'uae',
  'tokyo',
  'paris',
  'london',
  'mexico city',
  'toronto',
  'vancouver',
  'montreal',
  'sydney',
  'melbourne',
  'brisbane',
  'perth',
  'berlin',
  'munich',
  'rome',
  'madrid',
  'barcelona',
  'seoul',
  'bangkok',
  'hong kong',
  'beijing',
  'shanghai',
  'delhi',
  'mumbai',
  'dubai',
  'istanbul',
  'cairo',
  'cape town',
  'johannesburg',
  'sao paulo',
  'rio de janeiro',
  'buenos aires',
  'lima',
  'bogota',
  'amsterdam',
  'dublin',
  'lisbon',
  'zurich',
  'geneva',
];
const SCOPE_AI_US_ALIAS_PATTERN = /\b(?:us|usa|u s|united states|america)\b/;
const SCOPE_AI_COUNTRY_ALIAS_EXPANSIONS = new Map([
  ['u s', 'united states'],
  ['us', 'united states'],
  ['usa', 'united states'],
  ['america', 'united states'],
  ['u k', 'united kingdom'],
  ['uk', 'united kingdom'],
  ['uae', 'united arab emirates'],
]);

function expandScopeAiMapStateCodes(value: string): string {
  return value
    .split(/\s+/)
    .map((token) => SCOPE_AI_US_STATE_NAME_BY_CODE.get(token) ?? token)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildScopeAiMapQueryVariants(query: string): string[] {
  const normalized = normalizeScopeAiMapTargetText(query);
  if (!normalized) {
    return [];
  }

  const variants = new Set<string>();
  const pushVariant = (value: string) => {
    const normalizedVariant = value.replace(/\s+/g, ' ').trim();
    if (normalizedVariant) {
      variants.add(normalizedVariant);
      variants.add(expandScopeAiMapStateCodes(normalizedVariant));
    }
  };

  pushVariant(normalized);
  SCOPE_AI_COUNTRY_ALIAS_EXPANSIONS.forEach((expanded, alias) => {
    if (scopeAiMapPhrasePattern(alias).test(normalized)) {
      pushVariant(normalized.replace(scopeAiMapPhrasePattern(alias), expanded));
    }
  });
  pushVariant(normalized.replace(/\b(?:city|town|county|state|province|region|country)\s+of\s+/g, ' '));
  pushVariant(normalized.replace(/\b(?:in|near|around)\s+/g, ' '));
  pushVariant(normalized
    .replace(/\b(?:city|town|county|state|province|region|country)\s+of\s+/g, ' ')
    .replace(/\b(?:in|near|around)\s+/g, ' '));
  pushVariant(normalized.replace(/\s+(?:state|province|region)$/g, ''));

  return [...variants];
}

function scopeAiMapPhrasePattern(value: string): RegExp {
  return new RegExp(`\\b${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
}

function hasScopeAiGlobalMapHint(normalizedQuery: string): boolean {
  return SCOPE_AI_GLOBAL_MAP_HINTS.some((hint) => scopeAiMapPhrasePattern(hint).test(normalizedQuery));
}

function hasScopeAiUnitedStatesRegionHint(normalizedQuery: string): boolean {
  if (SCOPE_AI_US_ALIAS_PATTERN.test(normalizedQuery)) {
    return true;
  }

  if (US_STATE_LABELS.some((state) => scopeAiMapPhrasePattern(normalizeScopeAiMapTargetText(state.name)).test(normalizedQuery))) {
    return true;
  }

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  return tokens.some((token) => SCOPE_AI_US_STATE_CODE_HINTS.has(token));
}

function isUnitedStatesScopeAiMapTarget(result: GeocodeResult): boolean {
  const country = normalizeScopeAiMapTargetText(result.country);
  const countryCode = normalizeScopeAiMapTargetText(result.countryCode);
  return country === 'united states' ||
    country === 'united states of america' ||
    country === 'usa' ||
    countryCode === 'us' ||
    countryCode === 'usa';
}

function queryMentionsScopeAiMapTargetCountry(normalizedQuery: string, result: GeocodeResult): boolean {
  const country = normalizeScopeAiMapTargetText(result.country);
  const countryCode = normalizeScopeAiMapTargetText(result.countryCode);
  if (!normalizedQuery) {
    return false;
  }

  if (country && normalizedQuery.includes(country)) {
    return true;
  }

  if (isUnitedStatesScopeAiMapTarget(result) && SCOPE_AI_US_ALIAS_PATTERN.test(normalizedQuery)) {
    return true;
  }

  return Boolean(countryCode && new RegExp(`\\b${countryCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(normalizedQuery));
}

function isBroadScopeAiMapPrecision(value: string | undefined): boolean {
  return /\b(?:country|region|state|province)\b/.test(value?.toLowerCase() ?? '');
}

function scoreScopeAiMapTargetMatch(query: string, result: GeocodeResult, index: number): number {
  const normalizedQuery = normalizeScopeAiMapTargetText(query);
  const queryVariants = buildScopeAiMapQueryVariants(query);
  if (!normalizedQuery || !queryVariants.length) {
    return -index;
  }

  const labels = [
    result.placeName,
    result.formattedAddress,
    result.address,
    result.city,
    result.country,
    result.countryCode,
  ].map(normalizeScopeAiMapTargetText).filter(Boolean);
  const hasExactLabel = labels.some((label) => queryVariants.some((variant) => label === variant || label === `${variant} united states`));
  const hasPrefixLabel = labels.some((label) => queryVariants.some((variant) => label.startsWith(`${variant} `)));
  const hasContainedLabel = labels.some((label) => queryVariants.some((variant) => label.includes(variant)));
  const broadPrecisionBoost = isBroadScopeAiMapPrecision(result.precision) && (hasExactLabel || hasPrefixLabel) ? 70 : 0;
  const countryHintBoost = queryMentionsScopeAiMapTargetCountry(normalizedQuery, result) ? 44 : 0;
  const hasGlobalHint = hasScopeAiGlobalMapHint(normalizedQuery);
  const hasUnitedStatesRegionHint = hasScopeAiUnitedStatesRegionHint(normalizedQuery);
  const userLocaleBoost = !hasGlobalHint && hasUnitedStatesRegionHint && isUnitedStatesScopeAiMapTarget(result) ? 36 : 0;
  const unmentionedNonUsCountryPenalty = !hasGlobalHint &&
    hasUnitedStatesRegionHint &&
    result.country &&
    !isUnitedStatesScopeAiMapTarget(result)
    ? 28
    : 0;

  return (
    (hasExactLabel ? 100 : 0) +
    (hasPrefixLabel ? 24 : 0) +
    (hasContainedLabel ? 8 : 0) +
    broadPrecisionBoost +
    countryHintBoost +
    userLocaleBoost -
    unmentionedNonUsCountryPenalty -
    index
  );
}

function selectScopeAiMapTargetResult(query: string, results: GeocodeResult[]): GeocodeResult | undefined {
  return [...results]
    .map((result, index) => ({
      result,
      score: scoreScopeAiMapTargetMatch(query, result, index),
    }))
    .sort((left, right) => right.score - left.score)[0]?.result;
}

async function handleScopeAiMapCommand(payload: ScopeAiMapCommandPayload): Promise<ScopeAiCommandResult> {
  touchPlannerPresence(`ai-map-${payload.command}`);
  if (payload.command === 'zoom_to_place') {
    const query = payload.query?.trim();
    if (!query) {
      return {
        ok: false,
        message: 'Tell me where to zoom the planner map, like "zoom into Texas."',
      };
    }

    const response = await geocodeMapTarget(query, 5);
    const target = selectScopeAiMapTargetResult(query, response.data);
    if (!target) {
      return {
        ok: false,
        message: `I could not find "${query}" on the planner map.`,
      };
    }

    const result = await plannerItineraryView.value?.runPlannerMapCommand({
      command: payload.command,
      query,
      target: {
        label: formatScopeAiMapTargetLabel(target, query),
        latitude: target.latitude,
        longitude: target.longitude,
        precision: target.precision,
        zoom: resolveScopeAiMapTargetZoom(target.precision),
      },
    });
    return result ?? {
      ok: false,
      message: 'The planner map is still loading, so I could not run that map command yet.',
    };
  }

  const result = await plannerItineraryView.value?.runPlannerMapCommand(payload.command);
  return result ?? {
    ok: false,
    message: 'The planner map is still loading, so I could not run that map command yet.',
  };
}

async function handleInviteMember(payload: TripInviteInput) {
  touchPlannerPresence('invite');
  if (!currentDraftTrip.value) {
    return;
  }

  try {
    const updatedTrip = await tripsStore.inviteMember(currentDraftTrip.value.id, payload);
    currentDraftTrip.value = updatedTrip;
    plannerIsPublic.value = updatedTrip.isPublic;
    plannerCrew.value = updatedTrip.members;
    plannerDraft.value = {
      ...plannerDraft.value,
      groupSize: Math.max(plannerDraft.value.groupSize, updatedTrip.members.length),
    };
    toastStore.showSuccess({
      title: 'Invite queued',
      message: `${payload.recipient} can ${payload.role === 'editor' ? 'edit' : 'view'} this trip when they accept.`,
    });
  } catch {
    toastStore.showError({
      title: 'Invite failed',
      message: tripsStore.error ?? 'Scope could not invite that traveler right now.',
    });
  }
}

async function handleMemberRoleUpdate(payload: { userId: string; role: TripInviteInput['role'] }) {
  touchPlannerPresence('member-role');
  if (!currentDraftTrip.value) {
    return;
  }

  try {
    const updatedTrip = await tripsStore.updateMemberRole(currentDraftTrip.value.id, payload.userId, payload.role);
    currentDraftTrip.value = updatedTrip;
    plannerCrew.value = updatedTrip.members;
    toastStore.showSuccess({
      title: 'Access updated',
      message: 'That crew permission is saved.',
    });
  } catch {
    toastStore.showError({
      title: 'Access update failed',
      message: tripsStore.error ?? 'Scope could not update that permission right now.',
    });
  }
}

async function handleGenerate(payload: TripPlannerInput, options: GeneratePlannerOptions = {}): Promise<Itinerary | null> {
  touchPlannerPresence('generate-itinerary');
  const previousDestination = plannerDraft.value.destination;
  plannerDraft.value = {
    ...payload,
    endDestination: payload.endDestination ?? '',
    destinationLatitude: payload.destinationLatitude,
    destinationLongitude: payload.destinationLongitude,
    endDestinationLatitude: payload.endDestinationLatitude,
    endDestinationLongitude: payload.endDestinationLongitude,
    budgetFloor: payload.budgetFloor ?? 0,
    interests: [...payload.interests],
  };

  syncPresetExperience(payload.destination, previousDestination, payload.destination !== previousDestination);

  try {
    const isFirstVisiblePreview = !hasGeneratedPreview.value;
    const generatedItinerary = await tripsStore.buildItinerary(payload, { source: options.source ?? 'user' });
    const itinerary = options.requestedDateSpan
      ? ensureItineraryCoversDateSpan(generatedItinerary, options.requestedDateSpan)
      : generatedItinerary;
    if (itinerary !== generatedItinerary) {
      tripsStore.previewItinerary = itinerary;
    }
    plannerStops.value = flattenPreviewStops(itinerary);
    if (!options.requestedDateSpan) {
      syncEndDateFromTimelineStops(plannerStops.value);
    }
    hasGeneratedPreview.value = true;
    let draftSaved = false;

    if (options.saveDraft !== false) {
      try {
        await savePlannerDraft({ announce: false, preserveRoute: true, surfaceError: false });
        draftSaved = true;
      } catch {
        draftSaveState.value = 'unsaved';
        tripsStore.error = null;
        scheduleDraftAutosave(TRIP_PLANNER_AUTOSAVE_RETRY_MS);
      }
    }

    if (options.successToast ?? true) {
      let successMessage = isFirstVisiblePreview ? 'Scope built the preview.' : 'Scope refreshed the preview.';
      if (draftSaved) {
        successMessage = isFirstVisiblePreview
          ? 'Scope built the preview and saved this trip draft.'
          : 'Scope refreshed the preview and saved this trip draft.';
      } else if (options.saveDraft !== false) {
        successMessage = isFirstVisiblePreview
          ? 'Scope built the preview. Draft save will retry when the backend is ready.'
          : 'Scope refreshed the preview. Draft save will retry when the backend is ready.';
      }

      toastStore.showSuccess({
        title: isFirstVisiblePreview ? 'Itinerary ready' : 'Itinerary refreshed',
        message: successMessage,
      });
    }

    if (isMobilePlannerLayout.value) {
      handleWizardStepChange(4);
    }

    return itinerary;
  } catch (error) {
    if (options.errorToast ?? true) {
      toastStore.showError({
        title: 'Planner update failed',
        message: tripsStore.error ?? 'Scope could not generate an itinerary right now.',
      });
    }

    if (options.rethrow) {
      throw error;
    }

    return null;
  }
}

function handleStopsUpdate(stops: TripSpot[]) {
  touchPlannerPresence('stops-update');
  plannerStops.value = cloneStops(stops);
  markDraftAutosavePending();
}

function applyGeocodedEndpointCoordinates(
  endpoint: GeocodeResult | null,
  target: 'destination' | 'endDestination',
): Partial<TripPlannerInput> {
  if (!endpoint || !hasCoordinatePair(endpoint.latitude, endpoint.longitude)) {
    return {};
  }

  if (target === 'destination') {
    return {
      destinationLatitude: endpoint.latitude,
      destinationLongitude: endpoint.longitude,
    };
  }

  return {
    endDestinationLatitude: endpoint.latitude,
    endDestinationLongitude: endpoint.longitude,
  };
}

async function geocodePlannerEndpoint(label: string): Promise<GeocodeResult | null> {
  if (!label.trim()) {
    return null;
  }

  try {
    const response = await geocode(label, 1);
    return response.data[0] ?? null;
  } catch {
    return null;
  }
}

async function hydrateMissingEditableTripEndpointCoordinates(requestId: number): Promise<void> {
  const draft = plannerDraft.value;
  const needsStartCoordinates = Boolean(
    draft.destination.trim() &&
    !hasCoordinatePair(draft.destinationLatitude, draft.destinationLongitude),
  );
  const needsEndCoordinates = Boolean(
    draft.endDestination?.trim() &&
    !hasCoordinatePair(draft.endDestinationLatitude, draft.endDestinationLongitude),
  );

  if (!needsStartCoordinates && !needsEndCoordinates) {
    return;
  }

  const [startEndpoint, endEndpoint] = await Promise.all([
    needsStartCoordinates ? geocodePlannerEndpoint(draft.destination) : Promise.resolve(null),
    needsEndCoordinates ? geocodePlannerEndpoint(draft.endDestination ?? '') : Promise.resolve(null),
  ]);

  if (requestId !== editableTripHydrationRequestId) {
    return;
  }

  plannerDraft.value = {
    ...plannerDraft.value,
    ...applyGeocodedEndpointCoordinates(startEndpoint, 'destination'),
    ...applyGeocodedEndpointCoordinates(endEndpoint, 'endDestination'),
  };
  lastPersistedDraftSignature = draftAutosaveSignature.value;
  draftSaveState.value = 'saved';
}

function hydratePlannerFromTrip(trip: Trip) {
  const routeStops = resolveTripRouteStops(trip);
  const routeLabel = splitRouteDestinationLabel(trip.destination);
  const startStop = firstMappableRouteStop(routeStops);
  const endStop = lastMappableRouteStop(routeStops);

  currentDraftTrip.value = trip;
  plannerIsPublic.value = trip.isPublic;
  plannerTitle.value = trip.title;
  plannerDraft.value = {
    ...plannerDraft.value,
    destination: routeLabel.start,
    endDestination: routeLabel.end,
    destinationLatitude: startStop?.latitude,
    destinationLongitude: startStop?.longitude,
    endDestinationLatitude: routeLabel.end ? endStop?.latitude : undefined,
    endDestinationLongitude: routeLabel.end ? endStop?.longitude : undefined,
    startDate: trip.startDate,
    endDate: trip.endDate,
    budgetFloor: plannerDraft.value.budgetFloor ?? 0,
    budget: trip.budget ?? plannerDraft.value.budget,
    interests: getRouteLibraryRemixInterests(routeStops),
    groupSize: Math.max(trip.members.length, 1),
  };
  plannerStops.value = routeStops;
  isPlannerEndDateUserLocked.value = true;
  plannerCrew.value = cloneMembers(trip.members);
  tripsStore.previewItinerary = trip.itinerary ?? null;
  hasGeneratedPreview.value = Boolean(trip.itinerary);
  draftSaveState.value = 'saved';
  lastPersistedDraftSignature = draftAutosaveSignature.value;
  clearAutoSaveTimer();
}

function cloneItinerary(itinerary: Itinerary): Itinerary {
  return {
    ...itinerary,
    days: itinerary.days.map((day) => ({
      ...day,
      spots: cloneStops(day.spots),
    })),
  };
}

function getFeaturedRouteUseDateRange(trip: Trip): Pick<TripPlannerInput, 'startDate' | 'endDate'> {
  const startDate = plannerDraft.value.startDate || todayDateInput;
  const hasPlannerDateRange = Boolean(
    plannerDraft.value.startDate &&
    plannerDraft.value.endDate &&
    plannerDraft.value.endDate !== plannerDraft.value.startDate,
  );

  if (hasPlannerDateRange) {
    return {
      startDate: plannerDraft.value.startDate,
      endDate: plannerDraft.value.endDate,
    };
  }

  const routeDaySpan = getInclusiveDaySpan(trip.startDate, trip.endDate);
  return {
    startDate,
    endDate: addCalendarDays(startDate, routeDaySpan - 1) || startDate,
  };
}

function shiftRouteLibraryPreviewItineraryDates(itinerary: Itinerary, startDate: string): Itinerary {
  return {
    ...itinerary,
    days: itinerary.days.map((day) => ({
      ...day,
      date: addCalendarDays(startDate, normalizeItineraryDayNumber(day.dayNumber, 1) - 1) || startDate,
    })),
  };
}

function buildRouteLibraryPreviewItinerary(trip: Trip, stops: TripSpot[], startDate: string): Itinerary {
  if (trip.itinerary?.days.length) {
    return shiftRouteLibraryPreviewItineraryDates(cloneItinerary(trip.itinerary), startDate);
  }

  const endpoints = getRouteLibraryEndpointLabels(trip, stops);
  const dayLookup = new Map<number, Itinerary['days'][number]>();

  stops.forEach((stop, index) => {
    const dayNumber = normalizeItineraryDayNumber(stop.dayNumber, Math.floor(index / 3) + 1);
    if (!dayLookup.has(dayNumber)) {
      dayLookup.set(dayNumber, {
        dayNumber,
        date: addCalendarDays(startDate, dayNumber - 1) || startDate,
        spots: [],
      });
    }

    dayLookup.get(dayNumber)?.spots.push({
      ...stop,
      dayNumber,
      timeSlot: normalizeItineraryTimeSlot(stop.timeSlot, index),
    });
  });

  const days = [...dayLookup.values()]
    .map((day) => ({
      ...day,
      spots: [...day.spots].sort(compareItineraryStops),
    }))
    .sort((left, right) => left.dayNumber - right.dayNumber);

  return {
    id: `${trip.id}-featured-route-preview`,
    destination: endpoints.routeLabel,
    days,
    totalEstimatedCost: days
      .flatMap((day) => day.spots)
      .reduce((total, stop) => total + (stop.estimatedCost ?? 0), 0),
    weatherForecast: trip.itinerary?.weatherForecast ?? '',
  };
}

function getRouteLibraryRemixEndpointLabels(trip: Trip, stops: TripSpot[]): { start: string; end: string } {
  const endpoints = getRouteLibraryEndpointLabels(trip, stops);
  const firstStop = stops[0];
  const lastStop = stops[stops.length - 1];
  const start = compactRouteLibraryLocation(firstStop?.title || endpoints.start || trip.destination);
  const end = compactRouteLibraryLocation(lastStop?.title || endpoints.end);

  if (!end || normalizeRouteLibraryLocation(start) === normalizeRouteLibraryLocation(end)) {
    return {
      start: endpoints.start || start,
      end: endpoints.end,
    };
  }

  return { start, end };
}

function getRouteLibraryRemixBudget(trip: Trip): number {
  const budget = Number(trip.budget);
  return Number.isFinite(budget) && budget > 0 ? budget : plannerDraft.value.budget;
}

function getRouteLibraryRemixInterests(stops: TripSpot[]): SpotCategory[] {
  const interests = stops
    .map((stop) => stop.category)
    .filter((category): category is SpotCategory => isScopeAiPlannerInterestCategory(category))
    .filter((category, index, all) => all.indexOf(category) === index);

  return interests.length ? interests : [...plannerDraft.value.interests];
}

function handleFeaturedRouteUse(trip: Trip): void {
  touchPlannerPresence('featured-route-use');
  const orderedRouteStops = resolveTripRouteStops(trip);
  if (orderedRouteStops.length < 2) {
    return;
  }

  const routeStops = normalizeItineraryStops(orderedRouteStops);
  const firstStop = orderedRouteStops[0];
  const lastStop = orderedRouteStops[orderedRouteStops.length - 1];
  const endpointLabels = getRouteLibraryRemixEndpointLabels(trip, orderedRouteStops);
  const budget = getRouteLibraryRemixBudget(trip);
  const dateRange = getFeaturedRouteUseDateRange(trip);
  const middleStops = normalizeItineraryStops(orderedRouteStops.slice(1, -1));
  const routeCoordinates = orderedRouteStops
    .filter((stop) => hasCoordinatePair(stop.latitude, stop.longitude))
    .map((stop) => ({ latitude: stop.latitude, longitude: stop.longitude }));

  if (route.name === 'trip-edit') {
    void router.replace({ name: 'trip-planner' });
  }

  currentDraftTrip.value = null;
  plannerDraftSessionId.value = createPlannerDraftSessionId();
  plannerTitle.value = trip.title;
  plannerIsPublic.value = false;
  plannerDraft.value = {
    ...plannerDraft.value,
    destination: endpointLabels.start,
    endDestination: endpointLabels.end,
    destinationLatitude: hasCoordinatePair(firstStop?.latitude, firstStop?.longitude) ? firstStop?.latitude : undefined,
    destinationLongitude: hasCoordinatePair(firstStop?.latitude, firstStop?.longitude) ? firstStop?.longitude : undefined,
    endDestinationLatitude: hasCoordinatePair(lastStop?.latitude, lastStop?.longitude) ? lastStop?.latitude : undefined,
    endDestinationLongitude: hasCoordinatePair(lastStop?.latitude, lastStop?.longitude) ? lastStop?.longitude : undefined,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    budgetFloor: Math.min(plannerDraft.value.budgetFloor ?? DEFAULT_BUDGET_FLOOR, budget),
    budget,
    interests: getRouteLibraryRemixInterests(routeStops),
    groupSize: Math.max(trip.members.length, 1),
  };
  plannerStops.value = middleStops;
  plannerSuggestedStops.value = [];
  plannerCrew.value = [ownerMember.value];
  tripFuelSettings.value = {};
  selectedFuelPricesByPlaceId.value = {};
  tripShareLink.value = '';
  tripsStore.previewItinerary = buildRouteLibraryPreviewItinerary(trip, routeStops, dateRange.startDate);
  hasGeneratedPreview.value = true;
  isPlannerEndDateUserLocked.value = true;
  draftSaveState.value = 'unsaved';
  lastPersistedDraftSignature = '';
  inFlightDraftAutosaveSignature = '';
  clearAutoSaveTimer();
  autoSaveRequestId += 1;
  editableTripHydrationRequestId += 1;

  if (routeCoordinates.length) {
    setPlannerMapViewport(buildPlannerMapViewportForCoordinates(routeCoordinates));
  }

  toastStore.showSuccess({
    title: 'Route loaded',
    message: `${trip.title} is loaded as a new unsaved planner draft.`,
  });
}

async function loadEditableTripFromRoute() {
  const tripId = route.params.id;
  if (!tripId) {
    return;
  }

  const requestId = ++editableTripHydrationRequestId;
  try {
    const trip = await tripsStore.fetchTrip(String(tripId));
    if (requestId !== editableTripHydrationRequestId) {
      return;
    }

    hydratePlannerFromTrip(trip);
    void hydrateMissingEditableTripEndpointCoordinates(requestId);
  } catch {
    toastStore.showError({
      title: 'Draft unavailable',
      message: tripsStore.error ?? 'Scope could not load that trip draft.',
    });
  }
}

async function loadFeaturedRoutesPreview(): Promise<void> {
  if (hasLoadedFeaturedRoutes) {
    return;
  }

  hasLoadedFeaturedRoutes = true;

  try {
    const response = await listPublicTrips(1, ROUTE_LIBRARY_FETCH_LIMIT);
    featuredRouteTrips.value = response.data;
  } catch {
    // surfaced through tripsStore.error
  } finally {
    isFeaturedRoutesReady.value = true;
  }
}

watch(
  () => route.params.id,
  () => {
    if (route.name === 'trip-edit') {
      void loadEditableTripFromRoute();
    }
  },
  { immediate: true },
);

watch(
  featuredRoutes,
  (trips) => {
    void enrichRouteLibraryPhotos(trips);
  },
  { immediate: true },
);

watch(
  () => authStore.currentUser?.homeBase ?? '',
  () => {
    void syncPlannerMapViewportFromHomeBase();
  },
  { immediate: true },
);

watch(
  () => authStore.currentUser?.interests ?? [],
  () => {
    syncUserVibesToPlannerDraft();
  },
  { deep: true, immediate: true },
);

watch(
  () => shouldOpenTripAssistant.value,
  async (shouldOpenAssistant) => {
    if (!shouldOpenAssistant || isTripPlannerAuditMode) {
      return;
    }

    await nextTick();
    await tripAiAssist.value?.focusComposer();
  },
  { immediate: true },
);

watch(
  [plannerDraft, plannerStops, plannerTitle, tripFuelSettings],
  () => {
    if (isAiSyncInProgress) {
      return;
    }

    isScopeAiHydratingFromPlanner = true;
    scopeAiStore.hydrateFromPlannerDraft(plannerDraft.value, plannerStops.value, plannerTitle.value, tripFuelSettings.value);
    void nextTick(() => {
      isScopeAiHydratingFromPlanner = false;
    });
  },
  { deep: true, immediate: true },
);

watch(
  () => scopeAiStore.plannerState,
  (aiState) => {
    if (isScopeAiHydratingFromPlanner) {
      return;
    }

    isAiSyncInProgress = true;
    try {
      syncScopeAiStateToPlanner(aiState);
    } finally {
      void nextTick(() => {
        isAiSyncInProgress = false;
      });
    }
  },
  { deep: true },
);

watch(
  () => scopeAiStore.pendingPackingActions,
  (actions) => {
    if (!actions.length) {
      return;
    }

    touchPlannerPresence('packing-actions');
    actions.forEach((action) => {
      if (action.type === 'add') {
        tripPlanner.value?.addPackingItem(action.label);
      } else {
        tripPlanner.value?.removePackingItem(action.id);
      }
    });
    scopeAiStore.clearPendingPackingActions();
  },
  { deep: true },
);

watch(
  () => draftAutosaveSignature.value,
  (signature) => {
    if (!hasAutosavableDraftInput()) {
      clearAutoSaveTimer();
      draftSaveState.value = 'saved';
      lastPersistedDraftSignature = '';
      inFlightDraftAutosaveSignature = '';
      return;
    }

    if (signature === lastPersistedDraftSignature) {
      clearAutoSaveTimer();
      draftSaveState.value = 'saved';
      inFlightDraftAutosaveSignature = '';
    }
  },
);

watch(
  routeSpotId,
  () => {
    void loadRouteSpotIntoPlanner();
  },
  { immediate: true },
);

onMounted(() => {
  syncMobilePlannerLayout();
  window.addEventListener('resize', syncMobilePlannerLayout, { passive: true });
  void hydrateCurrentPlannerProfile();

  if (shouldOpenTripAssistant.value) {
    void nextTick(async () => {
      await tripAiAssist.value?.focusComposer();
    });
  }

  if (isTripPlannerAuditMode) {
    return;
  }

  if (shouldEagerlyRenderHeavyContent || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    void loadFeaturedRoutesPreview();
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return;
      }

      void loadFeaturedRoutesPreview();
      observer.disconnect();
      disconnectFeaturedRoutesPreviewObserver = null;
    },
    { rootMargin: '320px 0px' },
  );

  const target = featuredRoutesPreviewViewport.value;
  if (target) {
    observer.observe(target);
    disconnectFeaturedRoutesPreviewObserver = () => observer.disconnect();
    return;
  }

  void loadFeaturedRoutesPreview();
  observer.disconnect();
});

onBeforeUnmount(() => {
  disconnectFeaturedRoutesPreviewObserver?.();
  disconnectFeaturedRoutesPreviewObserver = null;
  clearAutoSaveTimer();
  autoSaveRequestId += 1;
  mapViewportRequestId += 1;
  editableTripHydrationRequestId += 1;
  window.removeEventListener('resize', syncMobilePlannerLayout);
});
</script>

<style scoped>
.planner-page.page-container {
  width: 100%;
  max-width: calc(1640px + (var(--shell-side-padding) * 2) + var(--safe-area-left) + var(--safe-area-right));
  min-height: 100%;
}

.planner-page.page-container[data-planner-layout='desktop'] {
  /* Row order on desktop: TripCollaborationBar, planner-workspace, featured-routes-preview-sentinel */
  min-height: calc(100dvh - var(--shell-content-top) - var(--shell-content-bottom));
  grid-template-rows: auto 1fr auto;
}

.planner-page,
.planner-workspace,
.planner-workspace__right,
.featured-routes-panel,
.featured-routes-grid,
.planner-mobile-brief,
.planner-mobile-copy,
.planner-mobile-progress,
.planner-audit-preview,
.planner-audit-preview__copy,
.planner-audit-preview__grid,
.planner-audit-preview__card {
  display: grid;
  gap: var(--space-6);
}

.featured-routes-preview-sentinel {
  width: 100%;
  height: 1px;
}

.planner-audit-preview {
  display: grid;
  gap: var(--space-4);
  align-content: start;
  padding: var(--space-5);
}

.planner-audit-preview__header,
.planner-audit-preview__metrics {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  justify-content: space-between;
  align-items: flex-start;
}

.planner-audit-preview__pill,
.planner-audit-preview__metric {
  border-radius: var(--radius-2xl);
  border: 1px solid var(--border-subtle);
  background: var(--surface-elevated-soft);
}

.planner-audit-preview__pill {
  padding: 0.7rem 1rem;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.planner-audit-preview__metric {
  min-width: 8rem;
  padding: 1rem 1.1rem;
  display: grid;
  gap: 0.35rem;
}

.planner-audit-preview__metric strong {
  font-size: var(--font-size-h3);
  line-height: var(--line-height-tight);
}

.planner-page[data-planner-layout='mobile-wizard'] {
  gap: var(--space-4);
}

.planner-alert,
.featured-routes-panel,
.planner-mobile-brief,
.planner-audit-preview {
  padding: var(--space-6);
}

.featured-routes-panel {
  content-visibility: auto;
  contain-intrinsic-size: 840px;
}

.planner-audit-preview {
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent-teal) 14%, transparent), transparent 42%),
    linear-gradient(135deg, color-mix(in srgb, var(--glass-bg) 94%, transparent), color-mix(in srgb, var(--bg-secondary) 88%, transparent));
}

.planner-audit-preview__copy {
  gap: var(--space-3);
  max-width: var(--copy-measure-wide);
}

.planner-audit-preview__copy h2,
.planner-audit-preview__copy p,
.planner-audit-preview__card h3,
.planner-audit-preview__card p {
  margin: 0;
}

.planner-audit-preview__grid {
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: var(--space-4);
}

.planner-audit-preview__card {
  gap: var(--space-3);
  padding: var(--space-5);
}

.planner-alert h2,
.planner-alert p,
.featured-routes-header h2,
.planner-mobile-copy h2,
.planner-mobile-copy p {
  margin: 0;
}

.planner-alert {
  gap: var(--space-3);
}

.planner-alert p:last-child,
.planner-mobile-copy p {
  color: var(--text-secondary);
}

.planner-workspace {
  --planner-workspace-gap: clamp(var(--space-4), 1.1vw, var(--space-6));
  grid-template-columns: minmax(24rem, 0.72fr) minmax(42rem, 1.28fr);
  column-gap: var(--planner-workspace-gap);
  row-gap: var(--planner-workspace-gap);
  align-items: start;
  align-self: stretch;
  min-height: 0;
}

.planner-workspace__right {
  grid-column: 2;
  grid-row: 1;
  min-width: 0;
  min-height: 0;
  align-self: start;
  grid-template-rows: auto;
  align-content: start;
  gap: var(--planner-workspace-gap);
}

.planner-workspace :deep(.trip-planner),
.planner-workspace :deep(.itinerary-stage) {
  border-color: color-mix(in srgb, var(--accent-teal) 14%, var(--glass-border));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 96%, transparent), color-mix(in srgb, var(--bg-primary) 88%, var(--bg-secondary)));
  box-shadow:
    var(--shadow-lg),
    inset 0 1px 0 color-mix(in srgb, white 6%, transparent);
  backdrop-filter: saturate(1.06);
}

.planner-workspace :deep(.trip-planner) {
  grid-column: 1;
  grid-row: 1;
  align-self: start;
  min-height: 0;
  width: 100%;
}

.planner-workspace__assistant--inline.trip-ai-assist {
  --trip-ai-assist-active-height: clamp(48rem, 88vh, 64rem);
  --trip-ai-assist-fresh-height: clamp(48rem, 88vh, 64rem);
  width: 100%;
  min-height: var(--trip-ai-assist-fresh-height);
  height: var(--trip-ai-assist-fresh-height);
  max-height: var(--trip-ai-assist-fresh-height);
  align-self: start;
  border-color: color-mix(in srgb, var(--accent-teal) 16%, var(--glass-border));
  box-shadow:
    var(--shadow-lg),
    inset 0 1px 0 color-mix(in srgb, white 6%, transparent);
}

.planner-workspace__assistant--inline.trip-ai-assist[data-chat-state='active'] {
  min-height: var(--trip-ai-assist-active-height);
  height: var(--trip-ai-assist-active-height);
  max-height: var(--trip-ai-assist-active-height);
}

.planner-workspace__assistant--inline.trip-ai-assist.planner-workspace__assistant--with-days {
  --trip-ai-assist-active-height: clamp(48rem, 88vh, 64rem);
  --trip-ai-assist-fresh-height: clamp(48rem, 88vh, 64rem);
}

.planner-workspace :deep(.trip-planner__header),
.planner-workspace :deep(.itinerary-stage__header),
.planner-workspace__assistant :deep(.trip-ai-assist__header) {
  background: var(--bg-secondary);
  border-bottom-color: color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
}

.planner-workspace__assistant :deep(.trip-ai-assist__body) {
  min-height: 0;
}

.planner-workspace__right :deep(.itinerary-stage) {
  align-self: start;
  min-height: 0;
  height: auto;
}

@media (max-width: 1320px) {
  .planner-workspace {
    grid-template-columns: 1fr;
    grid-template-rows: auto;
    align-items: start;
    height: auto;
    max-height: none;
  }

  .planner-workspace :deep(.trip-planner) {
    grid-column: auto;
    grid-row: auto;
    align-self: start;
    min-height: auto;
    max-height: none;
    height: fit-content;
    overflow: visible;
  }

  .planner-workspace__right {
    grid-column: auto;
    grid-row: auto;
    min-height: 0;
    max-height: none;
    grid-template-rows: auto;
    align-content: start;
  }

  .planner-workspace__assistant--inline.trip-ai-assist {
    --trip-ai-assist-active-height: clamp(38rem, 78vh, 56rem);
    --trip-ai-assist-fresh-height: clamp(38rem, 78vh, 56rem);
    min-height: var(--trip-ai-assist-fresh-height);
    max-height: var(--trip-ai-assist-fresh-height);
    height: var(--trip-ai-assist-fresh-height);
    align-self: start;
  }

  .planner-workspace__assistant--inline.trip-ai-assist[data-chat-state='fresh'] {
    --trip-ai-assist-fresh-height: clamp(38rem, 78vh, 56rem);
  }

  .planner-workspace__assistant--inline.trip-ai-assist[data-chat-state='active'] {
    min-height: var(--trip-ai-assist-active-height);
    height: var(--trip-ai-assist-active-height);
    max-height: var(--trip-ai-assist-active-height);
  }

  .planner-workspace__assistant--inline.trip-ai-assist.planner-workspace__assistant--with-days {
    --trip-ai-assist-active-height: clamp(38rem, 78vh, 56rem);
    --trip-ai-assist-fresh-height: clamp(38rem, 78vh, 56rem);
  }

  .planner-workspace__right :deep(.itinerary-stage) {
    min-height: auto;
    max-height: none;
    height: auto;
  }
}

.planner-workspace--mobile {
  gap: var(--space-4);
}

.planner-mobile-brief {
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--accent-teal) 16%, transparent), transparent 38%),
    linear-gradient(180deg, color-mix(in srgb, var(--glass-bg) 100%, transparent), color-mix(in srgb, var(--bg-secondary) 70%, var(--glass-bg)));
}

.planner-mobile-copy {
  gap: var(--space-3);
}

.planner-mobile-progress {
  gap: var(--space-3);
}

.planner-mobile-step,
.featured-routes-header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: flex-start;
}

.planner-mobile-step {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-2xl);
  border: 1px solid var(--glass-border);
  background: color-mix(in srgb, var(--glass-bg) 94%, transparent);
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
}

.planner-mobile-step:hover,
.planner-mobile-step:focus-visible {
  transform: translateY(var(--motion-card-lift));
  border-color: var(--border-hover);
  box-shadow: var(--shadow-md);
  outline: none;
}

.planner-mobile-step[data-step-state='current'] {
  border-color: var(--accent-teal);
  background: color-mix(in srgb, var(--accent-teal) 14%, var(--glass-bg));
  box-shadow: var(--shadow-glow-teal);
}

.planner-mobile-step[data-step-state='complete'] {
  border-color: color-mix(in srgb, var(--accent-teal) 36%, var(--glass-border));
}

.planner-mobile-step__index {
  width: 2.3rem;
  height: 2.3rem;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 20%, var(--bg-primary));
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
}

.planner-mobile-step__copy {
  display: grid;
  gap: var(--space-1);
  flex: 1;
}

.planner-mobile-step__copy strong,
.planner-mobile-step__copy small {
  margin: 0;
}

.planner-mobile-step__copy small {
  color: var(--text-secondary);
  line-height: var(--line-height-normal);
}

.featured-routes-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0.85rem;
  border-radius: var(--radius-full);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: var(--glass-blur);
  color: var(--text-primary);
  font-size: var(--font-size-small);
}

.featured-routes-grid {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  gap: var(--space-4);
}

.featured-route-card {
  min-width: 0;
  display: grid;
  grid-template-rows: auto 1fr;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--glass-border) 84%, var(--accent-teal) 16%);
  border-radius: var(--radius-xl);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--bg-secondary) 92%, transparent), color-mix(in srgb, var(--bg-primary) 88%, transparent));
  box-shadow:
    0 0.65rem 1.25rem color-mix(in srgb, var(--bg-primary) 28%, transparent),
    inset 0 1px 0 color-mix(in srgb, white 5%, transparent);
}

.featured-route-card__body,
.featured-route-card__heading,
.featured-route-metrics {
  min-width: 0;
}

.featured-route-card__body {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
}

.featured-route-card__heading h3,
.featured-route-card__heading p {
  margin: 0;
}

.featured-route-card__heading h3 {
  color: var(--text-primary);
  font-size: clamp(1.1rem, 0.9vw, 1.28rem);
  line-height: var(--line-height-tight);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.featured-route-card__heading p {
  margin-top: 0.3rem;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-normal);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.featured-route-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.featured-route-metrics span {
  display: inline-flex;
  align-items: center;
  min-height: 1.95rem;
  padding: 0.36rem 0.62rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 72%, transparent);
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.featured-route-mapline__category[data-category='food'] {
  background: var(--badge-adventure-fg);
}

.featured-route-mapline__category[data-category='culture'] {
  background: var(--badge-nightlife-fg);
}

.featured-route-mapline__category[data-category='adventure'] {
  background: var(--badge-scenic-fg);
}

.featured-route-mapline__category[data-category='shopping'] {
  background: var(--badge-shopping-fg);
}

.featured-route-mapline__category[data-category='entertainment'] {
  background: var(--badge-entertainment-fg);
}

.featured-route-mapline__category[data-category='nature'],
.featured-route-mapline__category[data-category='scenic'] {
  background: var(--badge-nature-fg);
}

.featured-route-cta {
  justify-self: start;
  min-height: 2.35rem;
  padding: 0.54rem 0.86rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 48%, var(--glass-border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 28%, var(--bg-secondary));
  color: var(--text-primary);
  font: inherit;
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.featured-route-cta:hover,
.featured-route-cta:focus-visible {
  outline: none;
  transform: translateY(var(--motion-button-lift));
  border-color: var(--accent-teal);
  background: color-mix(in srgb, var(--accent-teal) 38%, var(--bg-secondary));
}

.featured-route-visual {
  position: relative;
  min-width: 0;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  contain: paint;
  isolation: isolate;
  border-bottom: 1px solid var(--border-subtle);
  background:
    radial-gradient(circle at 24% 24%, color-mix(in srgb, var(--accent-teal) 18%, transparent), transparent 32%),
    linear-gradient(145deg, color-mix(in srgb, var(--bg-tertiary) 78%, transparent), color-mix(in srgb, var(--bg-primary) 94%, transparent));
}

.featured-route-visual__image {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.featured-route-visual[data-visual-mode='split'] .featured-route-visual__image {
  backface-visibility: hidden;
  will-change: clip-path, filter, transform;
  transition:
    clip-path 260ms cubic-bezier(0.2, 0.85, 0.2, 1),
    filter 260ms cubic-bezier(0.2, 0.85, 0.2, 1),
    transform 260ms cubic-bezier(0.2, 0.85, 0.2, 1);
}

.featured-route-visual[data-visual-mode='split'] .featured-route-visual__image[data-image-role='start'] {
  clip-path: polygon(0 0, 100% 0, 0 100%);
}

.featured-route-visual[data-visual-mode='split'] .featured-route-visual__image[data-image-role='end'] {
  clip-path: polygon(100% 0, 100% 100%, 0 100%);
}

.featured-route-visual[data-visual-mode='split'][data-hover-role='start'] .featured-route-visual__image[data-image-role='start'],
.featured-route-visual[data-visual-mode='split'][data-hover-role='end'] .featured-route-visual__image[data-image-role='end'] {
  z-index: 1;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
  transform: scale(1.015);
}

.featured-route-visual[data-visual-mode='split'][data-hover-role='start'] .featured-route-visual__image[data-image-role='end'] {
  clip-path: polygon(100% 0, 100% 100%, 100% 100%, 100% 0);
  filter: saturate(0.88) brightness(0.9);
}

.featured-route-visual[data-visual-mode='split'][data-hover-role='end'] .featured-route-visual__image[data-image-role='start'] {
  clip-path: polygon(0 0, 0 0, 0 100%, 0 100%);
  filter: saturate(0.88) brightness(0.9);
}

.featured-route-visual[data-visual-mode='split']::after {
  content: '';
  position: absolute;
  inset: -10%;
  z-index: 2;
  background: linear-gradient(
    135deg,
    transparent calc(50% - 1px),
    color-mix(in srgb, var(--bg-primary) 72%, transparent) 50%,
    transparent calc(50% + 1px)
  );
  opacity: 1;
  pointer-events: none;
  transition: opacity var(--transition-fast);
}

.featured-route-visual[data-visual-mode='split'][data-hover-role]::after {
  opacity: 0;
}

.featured-route-visual__hover-targets {
  position: absolute;
  inset: 0;
  z-index: 3;
}

.featured-route-visual__hover-target {
  position: absolute;
  inset: 0;
}

.featured-route-visual__hover-target[data-image-role='start'] {
  clip-path: polygon(0 0, 100% 0, 0 100%);
}

.featured-route-visual__hover-target[data-image-role='end'] {
  clip-path: polygon(100% 0, 100% 100%, 0 100%);
}

.featured-route-visual[data-visual-mode='single'] .featured-route-visual__image {
  clip-path: none;
}

.featured-route-visual__overlay {
  position: absolute;
  inset: var(--space-3) var(--space-3) auto;
  z-index: 4;
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  pointer-events: none;
}

.featured-route-visual__overlay span {
  min-height: 2rem;
  display: inline-flex;
  align-items: center;
  padding: 0.42rem 0.68rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, white 14%, var(--glass-border));
  background: color-mix(in srgb, var(--bg-primary) 68%, transparent);
  color: var(--text-primary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  backdrop-filter: blur(10px);
}

.featured-route-mapline {
  position: relative;
  height: 100%;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-5);
}

.featured-route-mapline__track {
  height: 0.18rem;
  border-radius: var(--radius-full);
  background: linear-gradient(90deg, var(--accent-teal), color-mix(in srgb, var(--text-secondary) 44%, transparent));
}

.featured-route-mapline__pin {
  width: 2.45rem;
  height: 2.45rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 45%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 20%, var(--bg-secondary));
  color: var(--text-primary);
  font-weight: var(--font-weight-bold);
}

.featured-route-mapline__category {
  position: relative;
  z-index: 1;
  width: 0.85rem;
  height: 0.85rem;
  margin-left: -2.25rem;
  border-radius: var(--radius-full);
  border: 2px solid var(--bg-secondary);
}

.planner-confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: var(--space-5);
  background: color-mix(in srgb, var(--bg-primary) 68%, transparent);
  backdrop-filter: blur(12px);
}

.planner-confirm-dialog {
  display: grid;
  gap: var(--space-3);
  width: min(100%, 32rem);
  padding: var(--space-6);
  border-color: color-mix(in srgb, var(--danger) 34%, var(--glass-border));
  box-shadow: 0 1.25rem 3.2rem color-mix(in srgb, var(--bg-primary) 70%, transparent);
}

.planner-confirm-dialog h2,
.planner-confirm-dialog p {
  margin: 0;
}

.planner-confirm-dialog h2 {
  font-size: var(--font-size-h3);
  line-height: var(--line-height-tight);
}

.planner-confirm-dialog p:not(.eyebrow) {
  color: var(--text-secondary);
  line-height: var(--line-height-normal);
}

.planner-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-top: var(--space-2);
}

.planner-confirm-button {
  min-height: 2.8rem;
  padding: 0.75rem 1.1rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  font: inherit;
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-fast);
}

.planner-confirm-button:disabled {
  cursor: wait;
  opacity: 0.66;
}

.planner-confirm-button:not(:disabled):hover,
.planner-confirm-button:not(:disabled):focus-visible {
  outline: none;
  transform: translateY(var(--motion-button-lift));
}

.planner-confirm-button--secondary {
  background: color-mix(in srgb, var(--bg-primary) 86%, var(--glass-bg));
  color: var(--text-secondary);
}

.planner-confirm-button--danger {
  border-color: color-mix(in srgb, var(--danger) 64%, var(--glass-border));
  background: color-mix(in srgb, var(--danger) 74%, var(--bg-secondary));
  color: var(--bg-primary);
}

@media (max-width: 720px) {
  .planner-alert,
  .featured-routes-panel,
  .planner-mobile-brief {
    padding: var(--space-5);
  }

  .planner-mobile-step,
  .featured-routes-header {
    gap: var(--space-3);
  }

  .featured-routes-header,
  .planner-mobile-step {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 640px) {
  .planner-mobile-step {
    padding: var(--space-3);
    border-radius: var(--radius-xl);
  }
}

@media (prefers-reduced-motion: reduce) {
  .planner-mobile-step {
    transition-duration: 1ms;
  }

  .planner-mobile-step:hover,
  .planner-mobile-step:focus-visible {
    transform: none;
  }
}
</style>
