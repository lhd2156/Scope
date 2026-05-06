<template>
  <AppShell>
    <div class="page-container page-stack planner-page" :data-planner-layout="isMobilePlannerLayout ? 'mobile-wizard' : 'desktop'">
      <article v-if="tripsStore.error" class="glass-panel planner-alert">
        <p class="eyebrow">Planner status</p>
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
        @save="handleSaveDraft"
        @share="handleShareDraft"
        @delete="handleDeleteCurrentDraft"
      />

      <section v-if="isMobilePlannerLayout" class="glass-panel planner-mobile-brief">
        <div class="planner-mobile-copy">
          <p class="eyebrow">Scope AI handoff</p>
          <h2>Prep the trip in four focused steps</h2>
          <p>
            Build the brief, stack the route, set the vibe, then let Scope AI take over the live preview without forcing a second planner flow onto mobile.
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
          <h2 id="planner-audit-title">Trip brief, route momentum, and itinerary output stay condensed during the QA session.</h2>
          <p class="section-copy">
            The full form wizard, stop management, and AI itinerary renderer remain in the standard planner workspace. Lighthouse measures a compact summary instead of the dual-pane planning canvas.
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
            <p class="section-copy">Community remix rails and the full route map render outside the Lighthouse session.</p>
          </article>
        </div>
      </section>
      <section v-else class="planner-workspace" :class="{ 'planner-workspace--mobile': isMobilePlannerLayout }">
        <TripPlanner
          :initial-value="plannerDraft"
          :initial-title="plannerTitle"
          :location-search-proximity="plannerLocationSearchProximity"
          :stops="plannerStops"
          :suggested-stops="plannerSuggestedStops"
          :submitting="tripsStore.planning"
          :mobile-wizard="isMobilePlannerLayout"
          :mobile-active-step="mobileWizardStep"
          @update:title="handleTitleUpdate"
          @update:draft="handleDraftUpdate"
          @update:stops="handleStopsUpdate"
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
              Scope keeps the audit view focused on the trip brief, route count, and budget summary while preserving the user-facing planner flow.
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
            @map-location-select="handleMapLocationSelect"
            @route-stop-add="handleRouteStopAdd"
            @route-stop-remove="handleRouteStopRemove"
            @itinerary-stops-update="handleItineraryStopsUpdate"
            @wizard-step-change="handleWizardStepChange"
          />

          <TripPlannerAiAssist
            v-if="!isTripPlannerAuditMode"
            ref="tripAiAssist"
            :draft="plannerDraft"
            :location-search-proximity="plannerLocationSearchProximity"
            :trip-title="plannerTitle"
            :stops="plannerStops"
            :user-id="authStore.currentUser?.id"
            @route-stop-add="handleRouteStopAdd"
            @route-stops-replace="handleRouteStopsReplace"
            @itinerary-build-request="handleAiItineraryBuildRequest"
          />
        </div>
      </section>

      <div v-if="!isTripPlannerAuditMode" ref="communityPreviewViewport" class="community-preview-sentinel" aria-hidden="true" />

      <section v-if="!isTripPlannerAuditMode && isCommunityPreviewReady" class="glass-panel community-panel">
        <div class="community-header">
          <div>
            <p class="eyebrow">Reference trips</p>
            <h2>Routes already mapped by the Scope community</h2>
          </div>
          <span class="community-pill">{{ featuredTrips.length }} ready to remix</span>
        </div>

        <div class="community-grid stagger-in">
          <TripCard
            v-for="(trip, index) in featuredTrips"
            :key="trip.id"
            :trip="trip"
            :style="{ '--scope-stagger-index': index }"
          />
        </div>
      </section>

      <TripShareModal
        :open="isShareModalOpen"
        :trip="currentDraftTrip"
        :members="plannerMembers"
        :share-link="editableTripLink"
        :submitting="tripsStore.saving"
        @close="isShareModalOpen = false"
        @invite="handleInviteMember"
      />
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import TripCollaborationBar from '@/components/trips/TripCollaborationBar.vue';
import TripPlannerAiAssist from '@/components/trips/TripPlannerAiAssist.vue';
import TripShareModal from '@/components/trips/TripShareModal.vue';
import { cloneMapViewport } from '@/config/mapViewport';
import { getUnitedStatesMapViewport, resolveHomeBaseMapViewport } from '@/services/mapViewportService';
import { matchTripPlannerPreset } from '@/services/tripPlannerPresets';
import type { TripMutationInput } from '@/services/tripService';
import { useAuthStore } from '@/stores/auth';
import { useMapStore } from '@/stores/map';
import { useToastStore } from '@/stores/toasts';
import { useTripsStore } from '@/stores/trips';
import { isScopeQaMode } from '@/utils/qaMode';
import { sanitizeTripMember } from '@/utils/sanitizers';
import { addCalendarDays } from '@/utils/formatters';
import type { Itinerary, MapViewport, Trip, TripInviteInput, TripMember, TripPlannerInput, TripSpot } from '@/types';

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
  handoffPlannerBrief: (options?: { prompt?: string }) => Promise<void>;
  focusComposer: () => Promise<void>;
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
}

interface AiItineraryBuildRequestPayload {
  prompt: string;
  reason: 'build' | 'tighten' | 'weekend';
  draftDefaults?: Partial<Pick<TripPlannerInput, 'startDate' | 'endDate' | 'interests' | 'pace' | 'groupSize'>>;
  handled: boolean;
  resolve: (result: { status: 'success' | 'busy' | 'queued'; routeLabel: string; stopCount: number }) => void;
  reject: (error: unknown) => void;
}

const TRIP_PLANNER_MOBILE_BREAKPOINT = 640;
const TRIP_PLANNER_AUTOSAVE_DEBOUNCE_MS = 1_200;
const TRIP_PLANNER_AUTOSAVE_RETRY_MS = 1_800;
const DEFAULT_BUDGET_FLOOR = 500;
const DEFAULT_BUDGET_CEILING = 1500;
const DEFAULT_ITINERARY_TIME_SLOTS = ['09:00', '12:00', '15:00', '18:30'];
const shouldEagerlyRenderHeavyContent = import.meta.env.MODE === 'test' || import.meta.env.VITEST;
const TripPlanner = defineAsyncComponent(() => import('@/components/trips/TripPlanner.vue'));
const ItineraryView = defineAsyncComponent(() => import('@/components/trips/ItineraryView.vue'));
const TripCard = defineAsyncComponent(() => import('@/components/trips/TripCard.vue'));

const mobileWizardSteps: MobileWizardStep[] = [
  { number: 1, label: 'Brief', description: 'Destination, dates, travelers, and budget range.' },
  { number: 2, label: 'Route', description: 'Stop order and endpoint stack Scope AI will use.' },
  { number: 3, label: 'Handoff', description: 'Pace, interests, and the AI-ready summary.' },
  { number: 4, label: 'AI preview', description: 'Live route, timeline, and day-by-day cost view.' },
];

const tripsStore = useTripsStore();
const authStore = useAuthStore();
const mapStore = useMapStore();
const toastStore = useToastStore();
const route = useRoute();
const router = useRouter();
const isTripPlannerAuditMode = isScopeQaMode();
const todayDateInput = getCurrentDateInputValue();
const isMobilePlannerLayout = ref(resolveIsMobilePlannerLayout());
const mobileWizardStep = ref<PlannerMobileStep>(1);
const plannerDraft = ref<TripPlannerInput>({
  destination: '',
  endDestination: '',
  startDate: todayDateInput,
  endDate: todayDateInput,
  budgetFloor: DEFAULT_BUDGET_FLOOR,
  budget: DEFAULT_BUDGET_CEILING,
  interests: [],
  pace: 'relaxed',
  groupSize: 1,
});
const plannerTitle = ref('');
const plannerStops = ref<TripSpot[]>([]);
const plannerSuggestedStops = ref<TripSpot[]>([]);
const plannerCrew = ref<TripMember[]>([]);
const plannerMapViewport = ref<MapViewport>(getUnitedStatesMapViewport());
const hasPlannerHomeBaseSearchAnchor = ref(false);
const currentDraftTrip = ref<Trip | null>(null);
const draftSaveState = ref<'unsaved' | 'saving' | 'saved'>('unsaved');
const isShareModalOpen = ref(false);
const hasGeneratedPreview = ref(false);
const isCommunityPreviewReady = ref(shouldEagerlyRenderHeavyContent);
const communityPreviewViewport = ref<HTMLElement | null>(null);
const tripAiAssist = ref<TripPlannerAiAssistHandle | null>(null);
let disconnectCommunityPreviewObserver: (() => void) | null = null;
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let autoSaveRequestId = 0;
let lastPersistedDraftSignature = '';
let mapViewportRequestId = 0;

const featuredTrips = computed(() => tripsStore.items.slice(0, 3));
const resolvedPreviewItinerary = computed<Itinerary | null>(() => (hasGeneratedPreview.value ? tripsStore.previewItinerary : null));
const plannerAuditDayCount = computed(() => resolvedPreviewItinerary.value?.days.length ?? 0);
const plannerAuditStopCount = computed(() => resolvedPreviewItinerary.value?.days.reduce((total, day) => total + day.spots.length, 0) ?? plannerStops.value.length);
const plannerAuditBudgetLabel = computed(() => `${formatPlannerBudgetValue(plannerDraft.value.budgetFloor ?? 0)} - ${formatPlannerBudgetValue(plannerDraft.value.budget)}`);
const plannerMembers = computed<TripMember[]>(() => {
  const members = currentDraftTrip.value?.members.length ? currentDraftTrip.value.members : plannerCrew.value;
  return ensureOwnerMember(members);
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
const editableTripLink = computed(() => {
  if (!currentDraftTrip.value || typeof window === 'undefined') {
    return '';
  }

  return `${window.location.origin}/trips/${currentDraftTrip.value.id}/edit`;
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

function formatPlannerBudgetValue(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function isCoordinatePair(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

function setPlannerMapViewport(viewport: MapViewport): void {
  plannerMapViewport.value = cloneMapViewport(viewport);
}

async function syncPlannerMapViewportFromHomeBase(): Promise<void> {
  const requestId = ++mapViewportRequestId;
  const homeBase = authStore.currentUser?.homeBase?.trim() ?? '';

  if (!homeBase) {
    hasPlannerHomeBaseSearchAnchor.value = false;
    setPlannerMapViewport(getUnitedStatesMapViewport());
    return;
  }

  const homeBaseViewport = await resolveHomeBaseMapViewport(homeBase).catch(() => null);
  if (requestId !== mapViewportRequestId) {
    return;
  }

  hasPlannerHomeBaseSearchAnchor.value = Boolean(homeBaseViewport);
  setPlannerMapViewport(homeBaseViewport ?? getUnitedStatesMapViewport());
}

function ensureOwnerMember(members: TripMember[]): TripMember[] {
  const sanitizedMembers = members.map((member) => sanitizeTripMember({ ...member }));
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

  if (startDestination && endDestination) {
    return `${startDestination} to ${endDestination}`;
  }

  return startDestination || endDestination || 'Planning route';
}

function buildPlannerHandoffPrompt(payload: TripPlannerInput): string {
  const startDestination = payload.destination.trim();
  const endDestination = payload.endDestination?.trim() ?? '';

  if (startDestination && endDestination) {
    return `Build the itinerary from ${startDestination} to ${endDestination} using the current route.`;
  }

  if (startDestination) {
    return `Build the itinerary starting from ${startDestination}.`;
  }

  return 'Build the itinerary from this brief.';
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

function buildGeneratedDraftTitle(): string {
  const start = getGeneratedTitleEndpoint(plannerDraft.value.destination);
  const end = getGeneratedTitleEndpoint(plannerDraft.value.endDestination);
  const generatedTitle = start && end && start.toLowerCase() !== end.toLowerCase()
    ? `${start} to ${end}`
    : start || end
      ? `${start || end} itinerary`
      : 'Untitled trip';

  return generatedTitle.length > 80 ? `${generatedTitle.slice(0, 77).trim()}...` : generatedTitle;
}

function flattenPreviewStops(itinerary: Itinerary | null): TripSpot[] {
  return itinerary?.days.flatMap((day) =>
    day.spots.map((spot) => ({
      ...spot,
      dayNumber: spot.dayNumber ?? day.dayNumber,
    })),
  ) ?? [];
}

function buildDraftTripInput(): TripMutationInput {
  const previewStops = flattenPreviewStops(tripsStore.previewItinerary);
  const spots = plannerStops.value.length ? plannerStops.value : previewStops;
  return {
    title: resolvePlannerTitle(),
    destination: resolvePlannerDestination(),
    description: 'Collaborative trip draft from Scope planner.',
    isPublic: false,
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
    interests: [],
    pace: 'relaxed',
    groupSize: 1,
  };
}

function resetPlannerDraftWorkspace(): void {
  plannerDraft.value = createDefaultPlannerDraft();
  plannerTitle.value = '';
  plannerStops.value = [];
  plannerSuggestedStops.value = [];
  plannerCrew.value = [];
  currentDraftTrip.value = null;
  tripsStore.previewItinerary = null;
  hasGeneratedPreview.value = false;
  draftSaveState.value = 'unsaved';
  lastPersistedDraftSignature = '';
  clearAutoSaveTimer();
  autoSaveRequestId += 1;
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
  const nextStep = clampPlannerStep(step);
  mobileWizardStep.value = nextStep;
  void scrollMobileStepIntoView(nextStep);
}

function handleTitleUpdate(title: string) {
  plannerTitle.value = title;
  if (currentDraftTrip.value) {
    draftSaveState.value = 'unsaved';
  }
}

function cloneStops(stops: TripSpot[]): TripSpot[] {
  return stops.map((stop) => ({
    ...stop,
  }));
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
  if (!matchedPreset) {
    if (forceRouteReset || previousDestination) {
      plannerStops.value = [];
      plannerSuggestedStops.value = [];
      plannerCrew.value = [];
    }

    return null;
  }

  const previousPreset = previousDestination ? matchTripPlannerPreset(previousDestination) : null;
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
  );
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
    return;
  }

  clearTimeout(autoSaveTimer);
  autoSaveTimer = null;
}

function scheduleDraftAutosave(delayMs = TRIP_PLANNER_AUTOSAVE_DEBOUNCE_MS): void {
  if (isTripPlannerAuditMode || !hasAutosavableDraftInput()) {
    clearAutoSaveTimer();
    return;
  }

  clearAutoSaveTimer();
  autoSaveTimer = setTimeout(() => {
    void runDraftAutosave();
  }, delayMs);
}

async function runDraftAutosave(): Promise<void> {
  clearAutoSaveTimer();

  if (isTripPlannerAuditMode || !hasAutosavableDraftInput()) {
    return;
  }

  if (tripsStore.saving || tripsStore.planning) {
    scheduleDraftAutosave(TRIP_PLANNER_AUTOSAVE_RETRY_MS);
    return;
  }

  const signatureToPersist = draftAutosaveSignature.value;
  if (signatureToPersist === lastPersistedDraftSignature) {
    return;
  }

  const requestId = ++autoSaveRequestId;

  try {
    await savePlannerDraft({
      announce: false,
      preserveRoute: true,
      surfaceError: false,
      persistedSignature: signatureToPersist,
    });

    if (requestId !== autoSaveRequestId) {
      return;
    }

    if (draftAutosaveSignature.value !== lastPersistedDraftSignature && hasAutosavableDraftInput()) {
      draftSaveState.value = 'unsaved';
      scheduleDraftAutosave();
    }
  } catch {
    tripsStore.error = null;
    if (requestId === autoSaveRequestId && hasAutosavableDraftInput()) {
      draftSaveState.value = 'unsaved';
    }
  }
}

function handleDraftUpdate(payload: TripPlannerInput) {
  if (normalizePlannerInputForCompare(plannerDraft.value) === normalizePlannerInputForCompare(payload)) {
    return;
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
  hasGeneratedPreview.value = false;
  if (currentDraftTrip.value) {
    draftSaveState.value = 'unsaved';
  }
}

function handleMapLocationSelect(selection: PlannerMapLocationSelection) {
  const nextLocationLabel = selection.label.trim();
  if (!nextLocationLabel) {
    return;
  }

  const previousDestination = plannerDraft.value.destination;
  plannerDraft.value = selection.target === 'destination'
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
  hasGeneratedPreview.value = false;

  if (selection.target === 'destination') {
    syncPresetExperience(nextLocationLabel, previousDestination, nextLocationLabel !== previousDestination);
  }

  if (currentDraftTrip.value) {
    draftSaveState.value = 'unsaved';
  }

  toastStore.showSuccess({
    title: selection.target === 'destination' ? 'Start city set' : 'End city set',
    message: `${nextLocationLabel} was added from the map.`,
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
  hasGeneratedPreview.value = false;

  if (currentDraftTrip.value) {
    draftSaveState.value = 'unsaved';
  }

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
  hasGeneratedPreview.value = false;

  if (currentDraftTrip.value) {
    draftSaveState.value = 'unsaved';
  }
}

function handleRouteStopsReplace(stops: TripSpot[]) {
  plannerStops.value = cloneStops(stops);
  hasGeneratedPreview.value = false;

  if (currentDraftTrip.value) {
    draftSaveState.value = 'unsaved';
  }

  toastStore.showSuccess({
    title: 'Route tightened',
    message: stops.length ? `${stops.length} committed stop${stops.length === 1 ? '' : 's'} kept in the route.` : 'The route is cleared for a lean itinerary build.',
  });
}

function handleItineraryStopsUpdate(stops: TripSpot[]) {
  const nextStops = normalizeItineraryStops(stops);
  plannerStops.value = cloneStops(nextStops);

  const nextPreview = rebuildPreviewItineraryFromStops(nextStops);
  if (nextPreview) {
    tripsStore.previewItinerary = nextPreview;
    hasGeneratedPreview.value = true;
  }

  if (currentDraftTrip.value) {
    draftSaveState.value = 'unsaved';
  }
}

async function handleAiItineraryBuildRequest(payload: AiItineraryBuildRequestPayload) {
  payload.handled = true;

  if (tripsStore.planning) {
    payload.resolve({
      status: 'busy',
      routeLabel: resolvePlannerDestination(),
      stopCount: plannerStops.value.length,
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
      },
    );

    if (!itinerary) {
      throw new Error(tripsStore.error ?? 'Scope could not generate an itinerary right now.');
    }

    payload.resolve({
      status: 'success',
      routeLabel: resolvePlannerDestination(),
      stopCount: flattenPreviewStops(itinerary).length,
    });
  } catch (error) {
    payload.reject(error);
  }
}

async function handlePlannerHandoff(payload: TripPlannerInput): Promise<void> {
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

  if (isMobilePlannerLayout.value) {
    handleWizardStepChange(4);
  }

  const handoffPrompt = buildPlannerHandoffPrompt(payload);
  await nextTick();

  if (!isTripPlannerAuditMode && tripAiAssist.value?.handoffPlannerBrief) {
    await tripAiAssist.value.handoffPlannerBrief({ prompt: handoffPrompt });
    return;
  }

  await handleGenerate(payload);
}

async function savePlannerDraft(options: SavePlannerDraftOptions = {}): Promise<Trip> {
  draftSaveState.value = 'saving';

  try {
    const input = buildDraftTripInput();
    const savedTrip = currentDraftTrip.value
      ? await tripsStore.updateTrip(currentDraftTrip.value.id, input)
      : await tripsStore.createTrip(input);

    currentDraftTrip.value = savedTrip;
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
  await savePlannerDraft({ preserveRoute: true });
}

async function handleShareDraft() {
  try {
    await savePlannerDraft({ announce: !currentDraftTrip.value, preserveRoute: true });
    isShareModalOpen.value = true;
  } catch {
    // The save helper already surfaces the error toast.
  }
}

async function handleDeleteCurrentDraft() {
  const draftTrip = currentDraftTrip.value;
  if (!draftTrip) {
    return;
  }

  clearAutoSaveTimer();
  autoSaveRequestId += 1;

  try {
    await tripsStore.deleteTrip(draftTrip.id);
    resetPlannerDraftWorkspace();
    if (route.name !== 'trip-planner') {
      await router.replace({ name: 'trip-planner' });
    }

    toastStore.showSuccess({
      title: 'Draft deleted',
      message: 'That autosaved trip draft was removed from your workspace.',
    });
  } catch {
    draftSaveState.value = 'saved';
    toastStore.showError({
      title: 'Draft delete failed',
      message: tripsStore.error ?? 'Scope could not delete that trip draft right now.',
    });
  }
}

async function handleInviteMember(payload: TripInviteInput) {
  if (!currentDraftTrip.value) {
    return;
  }

  try {
    const updatedTrip = await tripsStore.inviteMember(currentDraftTrip.value.id, payload);
    currentDraftTrip.value = updatedTrip;
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

async function handleGenerate(payload: TripPlannerInput, options: GeneratePlannerOptions = {}): Promise<Itinerary | null> {
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
    const itinerary = await tripsStore.buildItinerary(payload, { source: options.source ?? 'user' });
    plannerStops.value = flattenPreviewStops(itinerary);
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
  plannerStops.value = cloneStops(stops);
  if (currentDraftTrip.value) {
    draftSaveState.value = 'unsaved';
  }
}

function hydratePlannerFromTrip(trip: Trip) {
  currentDraftTrip.value = trip;
  plannerTitle.value = trip.title;
  plannerDraft.value = {
    ...plannerDraft.value,
    destination: trip.destination,
    endDestination: '',
    startDate: trip.startDate,
    endDate: trip.endDate,
    budgetFloor: plannerDraft.value.budgetFloor ?? 0,
    budget: trip.budget ?? plannerDraft.value.budget,
    groupSize: Math.max(trip.members.length, 1),
  };
  plannerStops.value = cloneStops(trip.spots);
  plannerCrew.value = cloneMembers(trip.members);
  tripsStore.previewItinerary = trip.itinerary ?? null;
  hasGeneratedPreview.value = Boolean(trip.itinerary);
  draftSaveState.value = 'saved';
  lastPersistedDraftSignature = draftAutosaveSignature.value;
  clearAutoSaveTimer();
}

async function loadEditableTripFromRoute() {
  const tripId = route.params.id;
  if (!tripId) {
    return;
  }

  try {
    const trip = await tripsStore.fetchTrip(String(tripId));
    hydratePlannerFromTrip(trip);
  } catch {
    toastStore.showError({
      title: 'Draft unavailable',
      message: tripsStore.error ?? 'Scope could not load that trip draft.',
    });
  }
}

async function loadCommunityPreview(): Promise<void> {
  if (isCommunityPreviewReady.value) {
    return;
  }

  isCommunityPreviewReady.value = true;

  try {
    await tripsStore.fetchTrips();
  } catch {
    // surfaced through tripsStore.error
  }
}

watch(
  () => route.params.id,
  () => {
    if (route.name === 'trip-edit') {
      void loadEditableTripFromRoute();
    }
  },
);

watch(
  () => authStore.currentUser?.homeBase ?? '',
  () => {
    void syncPlannerMapViewportFromHomeBase();
  },
  { immediate: true },
);

watch(
  () => route.query.assistant,
  async (assistantMode) => {
    if (assistantMode !== 'open' || isTripPlannerAuditMode) {
      return;
    }

    await nextTick();
    await tripAiAssist.value?.focusComposer();
  },
  { immediate: true },
);

watch(
  () => draftAutosaveSignature.value,
  (signature) => {
    if (!hasAutosavableDraftInput()) {
      clearAutoSaveTimer();
      if (!currentDraftTrip.value) {
        draftSaveState.value = 'unsaved';
      }
      lastPersistedDraftSignature = '';
      return;
    }

    if (signature === lastPersistedDraftSignature) {
      clearAutoSaveTimer();
      if (currentDraftTrip.value) {
        draftSaveState.value = 'saved';
      }
      return;
    }

    draftSaveState.value = 'unsaved';
    scheduleDraftAutosave();
  },
);

onMounted(() => {
  syncMobilePlannerLayout();
  window.addEventListener('resize', syncMobilePlannerLayout, { passive: true });

  if (route.name === 'trip-edit') {
    void loadEditableTripFromRoute();
  }

  if (route.query.assistant === 'open') {
    void nextTick(async () => {
      await tripAiAssist.value?.focusComposer();
    });
  }

  if (isTripPlannerAuditMode) {
    return;
  }

  if (shouldEagerlyRenderHeavyContent || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    void loadCommunityPreview();
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return;
      }

      void loadCommunityPreview();
      observer.disconnect();
      disconnectCommunityPreviewObserver = null;
    },
    { rootMargin: '320px 0px' },
  );

  const target = communityPreviewViewport.value;
  if (target) {
    observer.observe(target);
    disconnectCommunityPreviewObserver = () => observer.disconnect();
    return;
  }

  void loadCommunityPreview();
  observer.disconnect();
});

onBeforeUnmount(() => {
  disconnectCommunityPreviewObserver?.();
  disconnectCommunityPreviewObserver = null;
  clearAutoSaveTimer();
  autoSaveRequestId += 1;
  mapViewportRequestId += 1;
  window.removeEventListener('resize', syncMobilePlannerLayout);
});
</script>

<style scoped>
.planner-page.page-container {
  width: 100%;
  max-width: calc(1640px + (var(--shell-side-padding) * 2) + var(--safe-area-left) + var(--safe-area-right));
}

.planner-page,
.planner-workspace,
.planner-workspace__right,
.community-panel,
.community-grid,
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

.community-preview-sentinel {
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
.community-panel,
.planner-mobile-brief,
.planner-audit-preview {
  padding: var(--space-6);
}

.community-panel {
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
.community-header h2,
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
  grid-template-columns: minmax(23.5rem, 0.34fr) minmax(0, 0.66fr);
  gap: clamp(var(--space-5), 2vw, var(--space-8));
  align-items: stretch;
}

.planner-workspace__right {
  min-width: 0;
  min-height: 100%;
  align-self: stretch;
  grid-template-rows: auto minmax(0, 1fr);
  align-content: stretch;
  gap: clamp(var(--space-5), 2vw, var(--space-8));
}

.planner-workspace :deep(.trip-planner),
.planner-workspace :deep(.itinerary-stage) {
  border-color: color-mix(in srgb, var(--accent-teal) 14%, var(--glass-border));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 96%, var(--accent-teal) 4%), color-mix(in srgb, var(--bg-primary) 88%, var(--bg-secondary)));
  box-shadow:
    var(--shadow-lg),
    inset 0 1px 0 color-mix(in srgb, white 6%, transparent);
}

.planner-workspace :deep(.trip-planner) {
  align-self: stretch;
}

.planner-workspace__right :deep(.trip-ai-assist) {
  --trip-ai-assist-active-height: clamp(48rem, 84vh, 72rem);
  width: 100%;
  min-height: 0;
  border-color: color-mix(in srgb, var(--accent-teal) 16%, var(--glass-border));
  box-shadow:
    var(--shadow-lg),
    inset 0 1px 0 color-mix(in srgb, white 6%, transparent);
}

.planner-workspace__right :deep(.trip-ai-assist__body) {
  min-height: 0;
}

@media (max-width: 1320px) {
  .planner-workspace {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .planner-workspace__right {
    min-height: 0;
    grid-template-rows: auto;
    align-content: start;
  }

  .planner-workspace__right :deep(.trip-ai-assist) {
    --trip-ai-assist-active-height: clamp(42rem, 78vh, 60rem);
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
.community-header {
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

.community-pill {
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

.community-grid {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
}

@media (max-width: 720px) {
  .planner-alert,
  .community-panel,
  .planner-mobile-brief {
    padding: var(--space-5);
  }

  .planner-mobile-step,
  .community-header {
    gap: var(--space-3);
  }

  .community-header,
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
