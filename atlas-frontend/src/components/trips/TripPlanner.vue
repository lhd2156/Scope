<template>
  <form class="trip-planner glass-panel" data-test="trip-planner" @submit.prevent="handleSubmit">
    <header class="planner-header">
      <div class="planner-copy">
        <p class="eyebrow">Trip planner</p>
        <h2>{{ tripTitle }}</h2>
        <p class="section-copy">
          Dial in the route constraints, budget range, and stop order first. Atlas Intel will turn the brief into a premium day-by-day itinerary.
        </p>
      </div>

      <div class="planner-pill-stack">
        <span class="meta-pill">{{ tripLengthDays }} day{{ tripLengthDays === 1 ? '' : 's' }}</span>
        <span class="meta-pill meta-pill--accent">{{ paceLabel }}</span>
      </div>
    </header>

    <section class="planner-grid">
      <article class="planner-card glass-panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Core brief</p>
            <h3>Title, dates, and destination</h3>
          </div>
          <span class="meta-pill">{{ form.groupSize }} traveler{{ form.groupSize === 1 ? '' : 's' }}</span>
        </div>

        <div class="field-grid">
          <label class="field field-full">
            <span>Trip title</span>
            <div class="input-shell">
              <AtlasIcon name="route" label="Trip title" />
              <input v-model.trim="tripTitle" data-test="trip-title-input" type="text" maxlength="120" placeholder="Epic Patagonia Trek" />
            </div>
          </label>

          <label class="field">
            <span>Start date</span>
            <div class="input-shell">
              <AtlasIcon name="calendar" label="Start date" />
              <input v-model="form.startDate" type="date" />
            </div>
            <small v-if="errors.startDate" class="field-error">{{ errors.startDate }}</small>
          </label>

          <label class="field">
            <span>End date</span>
            <div class="input-shell">
              <AtlasIcon name="calendar" label="End date" />
              <input v-model="form.endDate" type="date" />
            </div>
            <small v-if="errors.endDate" class="field-error">{{ errors.endDate }}</small>
          </label>

          <label class="field field-full">
            <span>Destination search</span>
            <div class="input-shell">
              <AtlasIcon name="search" label="Destination search" />
              <input
                v-model.trim="form.destination"
                data-test="destination-input"
                type="text"
                maxlength="120"
                placeholder="Patagonia, Chile + Argentina"
              />
            </div>
            <small v-if="errors.destination" class="field-error">{{ errors.destination }}</small>
          </label>
        </div>
      </article>

      <article class="planner-card glass-panel budget-card">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Budget dual-handle</p>
            <h3>{{ budgetRangeLabel }}</h3>
          </div>
          <span class="meta-pill">{{ dailyBudgetLabel }}</span>
        </div>

        <div class="budget-slider-shell" aria-hidden="true">
          <div class="budget-slider-track" />
          <input
            class="budget-slider"
            type="range"
            :min="resolvedBudgetBounds.min"
            :max="resolvedBudgetBounds.max"
            :step="resolvedBudgetBounds.step"
            :value="budgetFloor"
            @input="handleBudgetFloorInput"
          />
          <input
            class="budget-slider"
            type="range"
            :min="resolvedBudgetBounds.min"
            :max="resolvedBudgetBounds.max"
            :step="resolvedBudgetBounds.step"
            :value="budgetCeiling"
            @input="handleBudgetCeilingInput"
          />
        </div>

        <div class="budget-scale">
          <span>{{ currencyFormatter.format(resolvedBudgetBounds.min) }}</span>
          <span>{{ currencyFormatter.format(resolvedBudgetBounds.max) }}</span>
        </div>

        <div class="budget-summary">
          <article class="budget-metric glass-panel">
            <span>Budget floor</span>
            <strong>{{ currencyFormatter.format(budgetFloor) }}</strong>
          </article>
          <article class="budget-metric glass-panel">
            <span>Budget ceiling</span>
            <strong>{{ currencyFormatter.format(budgetCeiling) }}</strong>
          </article>
        </div>
        <small v-if="errors.budget" class="field-error">{{ errors.budget }}</small>
      </article>
    </section>

    <section class="planner-card glass-panel stop-section">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Route order</p>
          <h3>Draggable destination list</h3>
        </div>
        <button type="button" class="button button-secondary add-stop-button" @click="handleAddSuggestedStop">
          <AtlasIcon name="plus" label="Add suggested stop" />
          <span>Add stop</span>
        </button>
      </div>

      <div class="stop-tools">
        <label class="field stop-search">
          <span>Add a destination</span>
          <div class="input-shell">
            <AtlasIcon name="search" label="Search suggested stops" />
            <input
              v-model.trim="destinationSearch"
              data-test="destination-search-input"
              type="text"
              maxlength="120"
              placeholder="Search suggested stops"
            />
          </div>
        </label>
      </div>

      <p class="section-copy stop-copy">
        Reorder the route before generating. The current destination search steers Atlas, while the stop stack defines the adventure arc.
      </p>

      <div class="stop-list" role="list">
        <article
          v-for="stop in destinationStops"
          :key="stop.spotId"
          class="stop-card glass-panel"
          :class="{ 'is-dragging': draggingStopId === stop.spotId, 'is-drop-target': dropTargetStopId === stop.spotId }"
          draggable="true"
          role="listitem"
          @dragstart="handleDragStart(stop.spotId, $event)"
          @dragenter.prevent="handleDragEnter(stop.spotId)"
          @dragover.prevent
          @drop="handleDrop(stop.spotId)"
          @dragend="handleDragEnd"
        >
          <button type="button" class="drag-handle" aria-label="Drag stop">
            <AtlasIcon name="grip" label="Drag stop" />
          </button>

          <div class="stop-media">
            <LazyImage :src="stop.photoUrl ?? ''" :alt="stop.title" class="stop-image" />
          </div>

          <div class="stop-body">
            <div class="stop-heading">
              <div>
                <span class="stop-day">Day {{ stop.dayNumber ?? 1 }}</span>
                <strong>{{ stop.title }}</strong>
              </div>
              <span class="badge stop-badge" :class="`badge-${stop.category}`">{{ categoryLabels[stop.category] }}</span>
            </div>

            <p class="stop-meta">
              {{ stop.city }} · {{ stop.timeSlot ?? 'Flexible' }} · {{ currencyFormatter.format(stop.estimatedCost ?? 0) }}
            </p>
            <p class="stop-notes">{{ stop.notes }}</p>
          </div>

          <button
            type="button"
            class="stop-action"
            :disabled="destinationStops.length === 1"
            :aria-label="`Remove ${stop.title}`"
            @click="removeStop(stop.spotId)"
          >
            <AtlasIcon name="close" label="Remove stop" />
          </button>
        </article>
      </div>
    </section>

    <section class="planner-grid planner-grid--secondary">
      <article class="planner-card glass-panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Pace</p>
            <h3>How intense should the route feel?</h3>
          </div>
        </div>

        <div class="pace-grid">
          <button
            v-for="option in paceOptions"
            :key="option.value"
            type="button"
            class="pace-card glass-panel"
            :class="{ active: form.pace === option.value }"
            @click="form.pace = option.value"
          >
            <strong>{{ option.label }}</strong>
            <span>{{ option.copy }}</span>
          </button>
        </div>
      </article>

      <article class="planner-card glass-panel">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Interests</p>
            <h3>Tell Atlas what should dominate the route</h3>
          </div>
          <span class="meta-pill">{{ form.interests.length }} selected</span>
        </div>

        <div class="chip-grid">
          <button
            v-for="category in categories"
            :key="category"
            type="button"
            class="interest-chip"
            :class="[
              `badge-${category}`,
              {
                active: form.interests.includes(category),
              },
            ]"
            @click="toggleCategory(category)"
          >
            <AtlasIcon :name="category === 'other' ? 'pin' : category" :label="categoryLabels[category]" />
            <span>{{ categoryLabels[category] }}</span>
          </button>
        </div>
        <small v-if="errors.interests" class="field-error">{{ errors.interests }}</small>
      </article>
    </section>

    <footer class="planner-footer">
      <div class="planner-summary glass-panel">
        <div>
          <span>Destination</span>
          <strong>{{ destinationLabel }}</strong>
        </div>
        <div>
          <span>Interests</span>
          <strong>{{ interestsLabel }}</strong>
        </div>
      </div>

      <button class="submit-button" data-test="trip-planner-submit" type="submit" :disabled="submitting">
        <AtlasIcon name="sparkle" label="Generate AI itinerary" />
        <span>{{ submitting ? 'Generating AI Itinerary…' : 'Generate AI Itinerary' }}</span>
      </button>
    </footer>
  </form>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import type { SpotCategory, TripPace, TripPlannerInput, TripSpot } from '@/types';
import { getInclusiveDaySpan } from '@/utils/formatters';

interface PlannerErrors {
  destination?: string;
  startDate?: string;
  endDate?: string;
  budget?: string;
  groupSize?: string;
  interests?: string;
}

const categories: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'scenic', 'other'];
const categoryLabels: Record<SpotCategory, string> = {
  food: 'Food',
  nature: 'Nature',
  nightlife: 'Nightlife',
  culture: 'Culture',
  adventure: 'Adventure',
  shopping: 'Shopping',
  scenic: 'Scenic',
  other: 'Other',
};
const paceOptions: Array<{ value: TripPace; label: string; copy: string }> = [
  { value: 'relaxed', label: 'Relaxed', copy: 'Longer meals, softer pacing, and more breathing room.' },
  { value: 'moderate', label: 'Moderate', copy: 'Balance marquee moments with scenic pauses.' },
  { value: 'packed', label: 'Packed', copy: 'Stack the route with high-density adventure energy.' },
];
const budgetBounds = {
  min: 500,
  max: 5000,
  step: 100,
};
const minimumBudgetGap = 300;
const calendarDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const fallbackTimeSlots = ['08:30', '12:30', '16:30', '19:30'] as const;

const props = withDefaults(
  defineProps<{
    initialValue?: Partial<TripPlannerInput>;
    initialTitle?: string;
    budgetRange?: [number, number];
    selectedStops?: TripSpot[];
    stops?: TripSpot[];
    suggestedStops?: TripSpot[];
    submitting?: boolean;
  }>(),
  {
    initialValue: () => ({}),
    initialTitle: '',
    budgetRange: () => [500, 5000] as [number, number],
    selectedStops: () => [],
    stops: () => [],
    suggestedStops: () => [],
    submitting: false,
  },
);

const emit = defineEmits<{
  (event: 'submit', payload: TripPlannerInput): void;
  (event: 'update:stops', payload: TripSpot[]): void;
  (event: 'update:title', payload: string): void;
}>();

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const errors = ref<PlannerErrors>({});
const resolvedBudgetBounds = computed(() => normalizeBudgetRange(props.budgetRange));
const resolvedSelectedStops = computed(() => (props.selectedStops.length ? props.selectedStops : props.stops));
const form = reactive<TripPlannerInput>(buildFormState(props.initialValue));
const tripTitle = ref(props.initialTitle.trim() || buildTripTitle(props.initialValue.destination));
const budgetFloor = ref(resolveBudgetFloor(props.initialValue.budget ?? form.budget, resolvedBudgetBounds.value.min, resolvedBudgetBounds.value.max));
const budgetCeiling = ref(clampBudget(props.initialValue.budget ?? form.budget, resolvedBudgetBounds.value.min, resolvedBudgetBounds.value.max));
const destinationStops = ref<TripSpot[]>(normalizeStops(resolvedSelectedStops.value));
const destinationSearch = ref('');
const draggingStopId = ref<string | null>(null);
const dropTargetStopId = ref<string | null>(null);

watch(
  () => props.initialValue,
  (nextValue) => {
    Object.assign(form, buildFormState(nextValue));
    budgetCeiling.value = clampBudget(nextValue.budget ?? form.budget, resolvedBudgetBounds.value.min, resolvedBudgetBounds.value.max);
    budgetFloor.value = resolveBudgetFloor(nextValue.budget ?? form.budget, resolvedBudgetBounds.value.min, resolvedBudgetBounds.value.max);

    if (!props.initialTitle.trim()) {
      tripTitle.value = buildTripTitle(nextValue.destination);
    }
  },
  { deep: true },
);

watch(
  () => props.initialTitle,
  (nextTitle) => {
    const normalizedTitle = nextTitle.trim();
    if (normalizedTitle && normalizedTitle !== tripTitle.value) {
      tripTitle.value = normalizedTitle;
    }
  },
  { immediate: true },
);

watch(
  resolvedSelectedStops,
  (nextStops) => {
    destinationStops.value = normalizeStops(nextStops);
  },
  { deep: true, immediate: true },
);

watch(
  resolvedBudgetBounds,
  (nextBounds) => {
    budgetCeiling.value = clampBudget(budgetCeiling.value, nextBounds.min, nextBounds.max);
    budgetFloor.value = resolveBudgetFloor(budgetCeiling.value, nextBounds.min, nextBounds.max);
  },
  { immediate: true },
);

watch(
  tripTitle,
  (nextTitle) => {
    emit('update:title', nextTitle.trim());
  },
  { immediate: true },
);

const tripLengthDays = computed(() => getInclusiveDaySpan(form.startDate, form.endDate));
const dailyBudget = computed(() => Math.round(budgetCeiling.value / Math.max(tripLengthDays.value, 1)));
const paceLabel = computed(() => paceOptions.find((option) => option.value === form.pace)?.label ?? 'Moderate');
const destinationLabel = computed(() => form.destination.trim() || 'Choose a destination');
const interestsLabel = computed(() => (form.interests.length ? form.interests.map((interest) => categoryLabels[interest]).join(', ') : 'Select at least one interest'));
const budgetRangeLabel = computed(() => `${currencyFormatter.format(budgetFloor.value)} - ${currencyFormatter.format(budgetCeiling.value)}`);
const dailyBudgetLabel = computed(() => `${currencyFormatter.format(dailyBudget.value)} / day`);

function buildTripTitle(destination?: string): string {
  const sanitizedDestination = destination?.trim();
  if (!sanitizedDestination) {
    return 'Epic Adventure Route';
  }

  if (sanitizedDestination.toLowerCase().includes('patagonia')) {
    return 'Epic Patagonia Trek';
  }

  return `${sanitizedDestination} Route`;
}

function getDefaultDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function buildFormState(initialValue: Partial<TripPlannerInput>): TripPlannerInput {
  return {
    destination: initialValue.destination ?? 'Patagonia, Chile + Argentina',
    startDate: initialValue.startDate ?? getDefaultDate(30),
    endDate: initialValue.endDate ?? getDefaultDate(33),
    budget: initialValue.budget ?? 3000,
    interests: initialValue.interests ? [...initialValue.interests] : ['adventure', 'nature', 'scenic'],
    pace: initialValue.pace ?? 'moderate',
    groupSize: initialValue.groupSize ?? 3,
  };
}

function normalizeBudgetRange(range?: [number, number]): { min: number; max: number; step: number } {
  const minimum = Number(range?.[0] ?? budgetBounds.min);
  const maximum = Number(range?.[1] ?? budgetBounds.max);

  return {
    min: Math.min(minimum, maximum),
    max: Math.max(minimum, maximum),
    step: budgetBounds.step,
  };
}

function clampBudget(value: number, minimum = resolvedBudgetBounds.value.min, maximum = resolvedBudgetBounds.value.max): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function resolveBudgetFloor(totalBudget: number, minimum = resolvedBudgetBounds.value.min, maximum = resolvedBudgetBounds.value.max): number {
  const clampedBudget = clampBudget(totalBudget, minimum, maximum);
  return Math.max(minimum, Math.min(clampedBudget - 1500, clampedBudget - minimumBudgetGap));
}

function normalizeStops(stops: TripSpot[]): TripSpot[] {
  return stops.map((stop, index) => ({
    ...stop,
    dayNumber: index + 1,
    timeSlot: stop.timeSlot ?? fallbackTimeSlots[index % fallbackTimeSlots.length] ?? '20:00',
  }));
}

function syncStops(nextStops: TripSpot[]): void {
  destinationStops.value = normalizeStops(nextStops);
  emit('update:stops', destinationStops.value.map((stop) => ({ ...stop })));
}

function toCalendarDayNumber(value: string): number {
  const matched = calendarDatePattern.exec(value);
  if (!matched) {
    return Number.NaN;
  }

  const [, year, month, day] = matched;
  const parsedDate = new Date(Number(year), Number(month) - 1, Number(day));

  if (
    parsedDate.getFullYear() !== Number(year) ||
    parsedDate.getMonth() !== Number(month) - 1 ||
    parsedDate.getDate() !== Number(day)
  ) {
    return Number.NaN;
  }

  return Date.UTC(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate()) / (24 * 60 * 60 * 1000);
}

function handleBudgetFloorInput(event: Event): void {
  const nextValue = Number((event.target as HTMLInputElement).value);
  budgetFloor.value = Math.min(nextValue, budgetCeiling.value - minimumBudgetGap);
}

function handleBudgetCeilingInput(event: Event): void {
  const nextValue = Number((event.target as HTMLInputElement).value);
  budgetCeiling.value = Math.max(nextValue, budgetFloor.value + minimumBudgetGap);
}

function handleAddSuggestedStop(): void {
  const existingStopIds = new Set(destinationStops.value.map((stop) => stop.spotId));
  const unmatchedSuggestions = props.suggestedStops.filter((stop) => !existingStopIds.has(stop.spotId));
  const normalizedQuery = destinationSearch.value.trim().toLowerCase();
  const nextSuggestion = normalizedQuery
    ? unmatchedSuggestions.find((stop) =>
        [stop.title, stop.city, stop.notes]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(normalizedQuery)),
      )
    : unmatchedSuggestions[0];

  if (!nextSuggestion) {
    return;
  }

  destinationSearch.value = '';
  syncStops([...destinationStops.value, nextSuggestion]);
}

function removeStop(stopId: string): void {
  if (destinationStops.value.length === 1) {
    return;
  }

  syncStops(destinationStops.value.filter((stop) => stop.spotId !== stopId));
}

function handleDragStart(stopId: string, event: DragEvent): void {
  draggingStopId.value = stopId;
  dropTargetStopId.value = stopId;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', stopId);
  }
}

function handleDragEnter(stopId: string): void {
  dropTargetStopId.value = stopId;
}

function handleDrop(targetStopId: string): void {
  const sourceStopId = draggingStopId.value;
  draggingStopId.value = null;
  dropTargetStopId.value = null;

  if (!sourceStopId || sourceStopId === targetStopId) {
    return;
  }

  const nextStops = [...destinationStops.value];
  const sourceIndex = nextStops.findIndex((stop) => stop.spotId === sourceStopId);
  const targetIndex = nextStops.findIndex((stop) => stop.spotId === targetStopId);

  if (sourceIndex === -1 || targetIndex === -1) {
    return;
  }

  const [movedStop] = nextStops.splice(sourceIndex, 1);
  nextStops.splice(targetIndex, 0, movedStop);
  syncStops(nextStops);
}

function handleDragEnd(): void {
  draggingStopId.value = null;
  dropTargetStopId.value = null;
}

function toggleCategory(category: SpotCategory): void {
  if (form.interests.includes(category)) {
    form.interests = form.interests.filter((entry) => entry !== category);
    return;
  }

  form.interests = [...form.interests, category];
}

function validatePlanner(): PlannerErrors {
  const nextErrors: PlannerErrors = {};
  const startDayNumber = toCalendarDayNumber(form.startDate);
  const endDayNumber = toCalendarDayNumber(form.endDate);

  if (!form.destination.trim()) {
    nextErrors.destination = 'Choose a destination so Atlas can build a route.';
  }

  if (Number.isNaN(startDayNumber)) {
    nextErrors.startDate = 'Add a valid start date.';
  }

  if (Number.isNaN(endDayNumber)) {
    nextErrors.endDate = 'Add a valid end date.';
  }

  if (!Number.isNaN(startDayNumber) && !Number.isNaN(endDayNumber) && endDayNumber < startDayNumber) {
    nextErrors.endDate = 'End date must be on or after the start date.';
  }

  if (budgetCeiling.value < budgetBounds.min) {
    nextErrors.budget = 'Budget must stay above the minimum range.';
  }

  if (form.groupSize < 1 || form.groupSize > 12) {
    nextErrors.groupSize = 'Group size must stay between 1 and 12.';
  }

  if (!form.interests.length) {
    nextErrors.interests = 'Select at least one interest to guide the itinerary.';
  }

  return nextErrors;
}

function handleSubmit(): void {
  const nextErrors = validatePlanner();
  errors.value = nextErrors;

  if (Object.keys(nextErrors).length > 0) {
    return;
  }

  form.budget = budgetCeiling.value;

  emit('submit', {
    destination: form.destination.trim(),
    startDate: form.startDate,
    endDate: form.endDate,
    budget: budgetCeiling.value,
    interests: [...form.interests],
    pace: form.pace,
    groupSize: form.groupSize,
  });
}
</script>

<style scoped>
.trip-planner,
.planner-grid,
.planner-copy,
.planner-card,
.field-grid,
.field,
.stop-tools,
.stop-list,
.stop-body,
.stop-heading,
.stop-media,
.pace-grid,
.chip-grid,
.planner-footer,
.planner-summary,
.budget-summary {
  display: grid;
  gap: var(--space-4);
}

.trip-planner {
  padding: var(--space-6);
  min-height: 100%;
}

.planner-header,
.panel-heading,
.stop-heading,
.stop-card,
.planner-footer {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
}

.planner-header,
.panel-heading,
.planner-footer {
  align-items: flex-start;
}

.eyebrow,
.stop-day {
  margin: 0;
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-eyebrow);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}

.planner-copy h2,
.panel-heading h3,
.stop-body strong,
.stop-meta,
.stop-notes,
.section-copy,
.planner-summary span,
.planner-summary strong,
.budget-metric span,
.budget-metric strong,
.field span,
.field-error {
  margin: 0;
}

.planner-copy h2 {
  font-size: var(--font-size-h1);
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-display);
}

.section-copy,
.stop-meta,
.stop-notes,
.planner-summary span,
.budget-metric span,
.budget-scale span,
.pace-card span {
  color: var(--text-secondary);
}

.planner-pill-stack {
  display: grid;
  gap: var(--space-3);
  justify-items: end;
}

.meta-pill,
.stop-day {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  padding: 0.55rem 0.9rem;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
}

.meta-pill--accent {
  color: var(--accent-gold);
}

.planner-grid {
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
}

.planner-grid--secondary {
  align-items: start;
}

.planner-card,
.budget-metric,
.stop-card,
.pace-card,
.planner-summary {
  border-radius: var(--radius-2xl);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-md);
}

.planner-card {
  padding: var(--space-5);
}

.field-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.field {
  gap: var(--space-2);
}

.field-full {
  grid-column: 1 / -1;
}

.field > span {
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
}

.input-shell {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0.2rem 0.95rem;
  border-radius: var(--radius-lg);
  border: 1px solid var(--input-border);
  background: var(--bg-secondary);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast);
}

.input-shell:focus-within {
  border-color: var(--accent-teal);
  box-shadow: var(--shadow-glow-teal);
  transform: translateY(-0.0625rem);
}

.input-shell :deep(.atlas-icon) {
  width: 1rem;
  height: 1rem;
  color: var(--text-secondary);
}

.input-shell input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  padding: 0.65rem 0;
}

.field-error {
  color: var(--danger);
  font-size: var(--font-size-small);
}

.budget-card {
  align-content: start;
}

.budget-slider-shell {
  position: relative;
  min-height: 2.5rem;
  display: flex;
  align-items: center;
}

.budget-slider-track {
  position: absolute;
  inset: 50% 0 auto;
  height: 0.375rem;
  border-radius: var(--radius-full);
  transform: translateY(-50%);
  background: linear-gradient(90deg, var(--border), var(--accent-teal), var(--accent-teal), var(--border));
  opacity: 0.9;
}

.budget-slider {
  position: absolute;
  inset: 0;
  width: 100%;
  margin: 0;
  background: transparent;
  appearance: none;
  accent-color: var(--accent-teal);
  pointer-events: auto;
}

.budget-slider::-webkit-slider-runnable-track {
  height: 0.375rem;
  background: transparent;
}

.budget-slider::-moz-range-track {
  height: 0.375rem;
  background: transparent;
}

.budget-slider::-webkit-slider-thumb {
  appearance: none;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: var(--radius-full);
  border: 3px solid var(--bg-primary);
  background: var(--text-primary);
  box-shadow: var(--shadow-glow-teal);
  margin-top: -0.4375rem;
}

.budget-slider::-moz-range-thumb {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: var(--radius-full);
  border: 3px solid var(--bg-primary);
  background: var(--text-primary);
  box-shadow: var(--shadow-glow-teal);
}

.budget-scale,
.budget-summary {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.budget-scale {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  font-size: var(--font-size-small);
}

.budget-metric,
.planner-summary {
  padding: var(--space-4);
}

.budget-metric strong,
.planner-summary strong,
.stop-body strong,
.pace-card strong {
  color: var(--text-primary);
}

.stop-section {
  gap: var(--space-5);
}

.stop-tools {
  grid-template-columns: minmax(0, 1fr);
}

.stop-search {
  min-width: 0;
}

.stop-copy {
  margin-top: calc(var(--space-4) * -1);
}

.add-stop-button {
  align-self: center;
}

.stop-card {
  align-items: center;
  padding: var(--space-3);
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);
}

.stop-card:hover,
.stop-card:focus-within,
.pace-card:hover,
.pace-card:focus-visible,
.planner-summary:hover {
  transform: translateY(var(--motion-card-lift));
  box-shadow: var(--shadow-lg);
  border-color: var(--border-hover);
}

.stop-card.is-dragging {
  opacity: 0.8;
}

.stop-card.is-drop-target {
  border-color: var(--accent-teal);
  box-shadow: var(--shadow-glow-teal);
}

.drag-handle,
.stop-action,
.pace-card,
.interest-chip {
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
}

.drag-handle,
.stop-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: var(--radius-full);
  background: var(--bg-secondary);
  transition:
    transform var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
}

.drag-handle:hover,
.stop-action:hover:not(:disabled),
.stop-action:focus-visible {
  transform: translateY(var(--motion-button-lift));
  background: var(--accent-teal-light);
  color: var(--accent-teal);
  outline: none;
}

.stop-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stop-media {
  width: 5.5rem;
  flex-shrink: 0;
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.stop-image {
  aspect-ratio: 1 / 1;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-normal);
}

.stop-card:hover .stop-image,
.stop-card:focus-within .stop-image {
  transform: scale(var(--motion-image-zoom));
}

.stop-body {
  flex: 1;
  min-width: 0;
}

.stop-heading {
  align-items: flex-start;
}

.stop-heading strong {
  display: block;
  font-size: var(--font-size-h3);
}

.stop-badge {
  align-self: flex-start;
}

.stop-meta,
.stop-notes {
  line-height: var(--line-height-relaxed);
}

.pace-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.pace-card {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-4);
  text-align: left;
  border-radius: var(--radius-xl);
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.pace-card.active {
  border-color: var(--accent-teal);
  box-shadow: var(--shadow-glow-teal);
}

.chip-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.interest-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  padding: 0.85rem 0.95rem;
  border-radius: var(--radius-lg);
  font-weight: var(--font-weight-semibold);
  opacity: 0.55;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    opacity var(--transition-fast),
    border-color var(--transition-fast);
}

.interest-chip.active,
.interest-chip:hover,
.interest-chip:focus-visible {
  opacity: 1;
  transform: translateY(var(--motion-chip-active-lift));
  box-shadow: var(--shadow-md);
  outline: none;
}

.interest-chip :deep(.atlas-icon) {
  width: 1rem;
  height: 1rem;
}

.planner-footer {
  align-items: center;
}

.planner-summary {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.planner-summary span {
  display: block;
  font-size: var(--font-size-small);
}

.submit-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-width: 18rem;
  padding: 1rem 1.5rem;
  border: none;
  border-radius: var(--radius-full);
  background: var(--accent-teal);
  color: var(--bg-primary);
  font-weight: var(--font-weight-semibold);
  box-shadow: var(--shadow-glow-teal);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    background var(--transition-fast),
    opacity var(--transition-fast);
}

.submit-button:hover:not(:disabled),
.submit-button:focus-visible {
  transform: translateY(var(--motion-card-lift));
  background: var(--accent-teal-hover);
  box-shadow: 0 0 30px var(--accent-teal-light);
  outline: none;
}

.submit-button:active:not(:disabled) {
  transform: translateY(0) scale(var(--motion-press-scale));
}

.submit-button:disabled {
  cursor: wait;
  opacity: 0.8;
}

@media (max-width: 1180px) {
  .planner-grid,
  .planner-grid--secondary,
  .field-grid,
  .planner-summary {
    grid-template-columns: 1fr;
  }

  .pace-grid,
  .chip-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 780px) {
  .trip-planner {
    padding: var(--space-5);
  }

  .planner-header,
  .panel-heading,
  .planner-footer,
  .stop-card,
  .stop-heading {
    flex-direction: column;
    align-items: flex-start;
  }

  .planner-pill-stack {
    justify-items: start;
  }

  .budget-summary,
  .pace-grid,
  .chip-grid {
    grid-template-columns: 1fr;
  }

  .submit-button {
    width: 100%;
    min-width: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .input-shell,
  .stop-card,
  .stop-image,
  .drag-handle,
  .stop-action,
  .pace-card,
  .interest-chip,
  .planner-summary,
  .submit-button {
    transition-duration: 1ms;
    animation: none;
  }

  .stop-card:hover,
  .stop-card:focus-within,
  .pace-card:hover,
  .pace-card:focus-visible,
  .planner-summary:hover,
  .submit-button:hover:not(:disabled),
  .submit-button:focus-visible,
  .interest-chip:hover,
  .interest-chip:focus-visible,
  .interest-chip.active,
  .drag-handle:hover,
  .stop-action:hover:not(:disabled),
  .stop-action:focus-visible {
    transform: none;
  }

  .stop-card:hover .stop-image,
  .stop-card:focus-within .stop-image {
    transform: none;
  }
}
</style>
