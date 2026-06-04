<template>
  <div class="floating-trip-ai" data-test="floating-trip-ai" :data-open="String(isOpen)">
    <div
      v-if="isOpen"
      id="floating-trip-ai-panel"
      class="floating-trip-ai__panel"
      role="dialog"
      aria-label="Scope AI trip assistant"
    >
      <button
        type="button"
        class="floating-trip-ai__close"
        aria-label="Close Scope AI"
        @click="closeAssistant"
      >
        <ScopeIcon name="close" label="" />
      </button>
      <TripPlannerAiAssist
        ref="assistantRef"
        :draft="resolvedDraft"
        :location-search-proximity="locationSearchProximity"
        :trip-title="resolvedTripTitle"
        :stops="resolvedStops"
        :user-id="userId"
        @route-stop-add="forwardRouteStopAdd"
        @route-stops-replace="forwardRouteStopsReplace"
        @itinerary-build-request="forwardItineraryBuildRequest"
      />
    </div>

    <button
      type="button"
      class="floating-trip-ai__button"
      data-test="floating-trip-ai-button"
      :aria-expanded="String(isOpen)"
      aria-controls="floating-trip-ai-panel"
      @click="toggleAssistant"
    >
      <ScopeIcon name="sparkle" label="" />
      <span>AI help</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import TripPlannerAiAssist from '@/components/trips/TripPlannerAiAssist.vue';
import { useAuthStore } from '@/stores/auth';
import type { SpotCategory, Trip, TripMember, TripPace, TripPlannerInput, TripSpot } from '@/types';
import { normalizeUserVibes } from '@/utils/userPreferenceSignals';

interface PlannerLocationSearchProximity {
  label?: string;
  latitude: number;
  longitude: number;
}

interface TripPlannerAiAssistHandle {
  handoffPlannerBrief: (options?: { prompt?: string }) => Promise<boolean>;
  focusComposer: () => Promise<void>;
}

type RouteActionReason = 'build' | 'tighten' | 'weekend';

interface ItineraryBuildRequestPayload {
  prompt: string;
  reason: RouteActionReason;
  draftDefaults?: {
    startDate?: string;
    endDate?: string;
    durationDays?: number;
    interests?: SpotCategory[];
    pace?: TripPace;
    groupSize?: number;
  };
  handled: boolean;
  resolve: (result: { status: 'success' | 'busy' | 'queued'; routeLabel: string; stopCount: number; dayCount?: number }) => void;
  reject: (error: unknown) => void;
}

const props = withDefaults(
  defineProps<{
    trip?: Trip | null;
    draft?: TripPlannerInput | null;
    tripTitle?: string;
    stops?: TripSpot[];
    members?: TripMember[];
    locationSearchProximity?: PlannerLocationSearchProximity;
    userId?: string;
    startOpen?: boolean;
  }>(),
  {
    trip: null,
    draft: null,
    tripTitle: '',
    stops: () => [],
    members: () => [],
    userId: undefined,
    startOpen: false,
  },
);

const emit = defineEmits<{
  (event: 'route-stop-add', stop: TripSpot): void;
  (event: 'route-stops-replace', stops: TripSpot[]): void;
  (event: 'itinerary-build-request', payload: ItineraryBuildRequestPayload): void;
}>();

const assistantRef = ref<TripPlannerAiAssistHandle | null>(null);
const isOpen = ref(props.startOpen);
const authStore = useAuthStore();

const todayDateInput = computed(() => {
  const today = new Date();
  return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
});

const resolvedStops = computed(() => (
  props.stops.length ? props.stops : props.trip?.spots ?? []
));

const resolvedTripTitle = computed(() => (
  props.tripTitle.trim() || props.trip?.title?.trim() || 'Trip assistant'
));

const resolvedDraft = computed<TripPlannerInput>(() => (
  props.draft ? normalizeDraft(props.draft) : buildDraftFromTrip(props.trip)
));

watch(
  () => props.startOpen,
  (startOpen) => {
    if (startOpen) {
      isOpen.value = true;
    }
  },
);

function normalizeDraft(draft: TripPlannerInput): TripPlannerInput {
  return {
    ...draft,
    endDestination: draft.endDestination ?? '',
    budgetFloor: draft.budgetFloor ?? 0,
    interests: [...draft.interests],
  };
}

function buildDraftFromTrip(trip: Trip | null): TripPlannerInput {
  const stops = resolvedStops.value;
  const firstStop = stops[0];
  const lastStop = stops.length > 1 ? stops[stops.length - 1] : undefined;
  const budget = trip?.budget ?? 1500;

  return {
    destination: trip?.destination?.trim() || firstStop?.city || firstStop?.title || '',
    endDestination: lastStop?.city || lastStop?.title || '',
    startDate: trip?.startDate ?? todayDateInput.value,
    endDate: trip?.endDate ?? trip?.startDate ?? todayDateInput.value,
    budgetFloor: Math.max(0, Math.round(budget * 0.35)),
    budget,
    interests: inferInterestsFromStops(stops),
    pace: 'moderate',
    groupSize: Math.max(1, props.members.length || trip?.members.length || 1),
  };
}

function inferInterestsFromStops(stops: TripSpot[]): TripPlannerInput['interests'] {
  const stopInterests = [...new Set(stops.map((stop) => stop.category).filter(Boolean))].slice(0, 6);
  return stopInterests.length ? stopInterests : normalizeUserVibes(authStore.currentUser?.interests);
}

function toggleAssistant(): void {
  isOpen.value = !isOpen.value;
}

function closeAssistant(): void {
  isOpen.value = false;
}

async function openAssistant(): Promise<void> {
  isOpen.value = true;
  await nextTick();
}

async function handoffPlannerBrief(options: { prompt?: string } = {}): Promise<boolean> {
  await openAssistant();
  const handoff = assistantRef.value?.handoffPlannerBrief;
  if (typeof handoff !== 'function') {
    return false;
  }

  await handoff(options);
  return true;
}

async function focusComposer(): Promise<void> {
  await openAssistant();
  const focus = assistantRef.value?.focusComposer;
  if (typeof focus === 'function') {
    await focus();
  }
}

function forwardRouteStopAdd(stop: TripSpot): void {
  emit('route-stop-add', stop);
}

function forwardRouteStopsReplace(stops: TripSpot[]): void {
  emit('route-stops-replace', stops);
}

function forwardItineraryBuildRequest(payload: ItineraryBuildRequestPayload): void {
  emit('itinerary-build-request', payload);
}

defineExpose<{
  handoffPlannerBrief: (options?: { prompt?: string }) => Promise<boolean>;
  focusComposer: () => Promise<void>;
  openAssistant: () => Promise<void>;
  closeAssistant: () => void;
}>({
  handoffPlannerBrief,
  focusComposer,
  openAssistant,
  closeAssistant,
});
</script>

<style scoped>
.floating-trip-ai {
  position: fixed;
  right: max(var(--space-4), env(safe-area-inset-right));
  bottom: max(var(--space-4), env(safe-area-inset-bottom));
  z-index: 1200;
  display: grid;
  justify-items: end;
  gap: var(--space-3);
  pointer-events: none;
}

.floating-trip-ai__panel,
.floating-trip-ai__button {
  pointer-events: auto;
}

.floating-trip-ai__panel {
  position: relative;
  width: min(30rem, calc(100vw - (var(--space-4) * 2)));
  max-height: min(44rem, calc(100vh - 8rem));
}

.floating-trip-ai__panel :deep(.trip-ai-assist) {
  --trip-ai-assist-active-height: min(38rem, calc(100vh - 10rem));
  box-shadow: var(--shadow-xl);
}

.floating-trip-ai__panel :deep(.trip-ai-assist__chat-menu) {
  margin-right: 2.85rem;
}

.floating-trip-ai__close {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  z-index: 40;
  width: 2.35rem;
  height: 2.35rem;
  display: inline-grid;
  place-items: center;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--bg-secondary) 88%, transparent);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition:
    color var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    transform var(--transition-fast);
}

.floating-trip-ai__close:hover {
  color: var(--text-primary);
  border-color: color-mix(in srgb, var(--accent-teal) 42%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--bg-secondary));
  transform: translateY(-1px);
}

.floating-trip-ai__button {
  min-height: 3.35rem;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-5);
  border: 1px solid color-mix(in srgb, var(--accent-gold) 42%, var(--glass-border));
  border-radius: var(--radius-full);
  color: var(--text-primary);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent-gold) 28%, var(--bg-secondary)), color-mix(in srgb, var(--accent-teal) 24%, var(--bg-secondary)));
  box-shadow:
    var(--shadow-lg),
    inset 0 1px 0 color-mix(in srgb, white 10%, transparent);
  font-weight: 800;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast);
}

.floating-trip-ai__button:hover {
  border-color: color-mix(in srgb, var(--accent-teal) 54%, var(--accent-gold));
  box-shadow:
    var(--shadow-xl),
    0 0 0 4px color-mix(in srgb, var(--accent-teal) 14%, transparent);
  transform: translateY(-1px);
}

.floating-trip-ai__button :deep(.scope-icon) {
  width: 1.15rem;
  height: 1.15rem;
}

@media (max-width: 720px) {
  .floating-trip-ai {
    right: max(var(--space-3), env(safe-area-inset-right));
    bottom: calc(max(var(--space-3), env(safe-area-inset-bottom)) + 4.75rem);
  }

  .floating-trip-ai__panel {
    width: calc(100vw - (var(--space-3) * 2));
    max-height: calc(100vh - 9.5rem);
  }

  .floating-trip-ai__panel :deep(.trip-ai-assist) {
    --trip-ai-assist-active-height: calc(100vh - 10.5rem);
  }

  .floating-trip-ai__button {
    min-height: 3rem;
    padding: 0 var(--space-4);
  }
}
</style>
