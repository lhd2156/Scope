<template>
  <form class="trip-planner glass-panel" data-test="trip-planner" @submit.prevent="handleSubmit">
    <div class="planner-header">
      <div>
        <p class="eyebrow">Trip planner</p>
        <h2>Shape the route before Atlas optimizes it</h2>
        <p class="section-copy">
          Define timing, budget, pace, and interests so the itinerary engine can sequence stops with intention.
        </p>
      </div>

      <div class="planner-stats">
        <div class="surface-card stat-card">
          <strong>{{ tripLengthDays }}</strong>
          <span>Day{{ tripLengthDays === 1 ? '' : 's' }}</span>
        </div>
        <div class="surface-card stat-card">
          <strong>${{ dailyBudget }}</strong>
          <span>Per day</span>
        </div>
      </div>
    </div>

    <div class="planner-grid">
      <section class="surface-card panel-section">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Where + when</p>
            <h3>Anchor the trip window</h3>
          </div>
          <span class="meta-pill">{{ paceLabel }}</span>
        </div>

        <div class="field-grid two-column">
          <label class="field field-full">
            <span>Destination</span>
            <input v-model.trim="form.destination" data-test="destination-input" type="text" maxlength="120" placeholder="Fort Worth, TX" />
            <small v-if="errors.destination" class="field-error">{{ errors.destination }}</small>
          </label>

          <label class="field">
            <span>Start date</span>
            <input v-model="form.startDate" type="date" />
            <small v-if="errors.startDate" class="field-error">{{ errors.startDate }}</small>
          </label>

          <label class="field">
            <span>End date</span>
            <input v-model="form.endDate" type="date" />
            <small v-if="errors.endDate" class="field-error">{{ errors.endDate }}</small>
          </label>
        </div>
      </section>

      <section class="surface-card panel-section">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">Trip constraints</p>
            <h3>Set spending and group fit</h3>
          </div>
        </div>

        <div class="field-grid two-column">
          <label class="field">
            <span>Budget</span>
            <input v-model.number="form.budget" type="number" min="0" step="25" />
            <small v-if="errors.budget" class="field-error">{{ errors.budget }}</small>
          </label>

          <label class="field">
            <span>Group size</span>
            <input v-model.number="form.groupSize" type="number" min="1" max="12" />
            <small v-if="errors.groupSize" class="field-error">{{ errors.groupSize }}</small>
          </label>
        </div>

        <div class="pace-grid">
          <button
            v-for="option in paceOptions"
            :key="option.value"
            type="button"
            class="pace-card"
            :class="{ active: form.pace === option.value }"
            @click="form.pace = option.value"
          >
            <strong>{{ option.label }}</strong>
            <span>{{ option.copy }}</span>
          </button>
        </div>
      </section>
    </div>

    <section class="surface-card panel-section interest-section">
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
    </section>

    <footer class="planner-footer">
      <div class="surface-card summary-card">
        <h3>Planner summary</h3>
        <ul>
          <li>
            <span>Destination</span>
            <strong>{{ destinationLabel }}</strong>
          </li>
          <li>
            <span>Trip window</span>
            <strong>{{ tripLengthDays }} day{{ tripLengthDays === 1 ? '' : 's' }}</strong>
          </li>
          <li>
            <span>Interests</span>
            <strong>{{ interestsLabel }}</strong>
          </li>
        </ul>
      </div>

      <button class="submit-button" data-test="trip-planner-submit" type="submit" :disabled="submitting">
        {{ submitting ? 'Generating…' : 'Generate itinerary' }}
      </button>
    </footer>
  </form>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import type { SpotCategory, TripPace, TripPlannerInput } from '@/types';

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
  { value: 'relaxed', label: 'Relaxed', copy: 'Leave margin for detours and long meals.' },
  { value: 'moderate', label: 'Moderate', copy: 'Balance headline stops with breathing room.' },
  { value: 'packed', label: 'Packed', copy: 'Stack the day with dense momentum.' },
];

const props = withDefaults(
  defineProps<{
    initialValue?: Partial<TripPlannerInput>;
    submitting?: boolean;
  }>(),
  {
    initialValue: () => ({}),
    submitting: false,
  },
);

const emit = defineEmits<{
  (event: 'submit', payload: TripPlannerInput): void;
}>();

const errors = ref<PlannerErrors>({});
const form = reactive<TripPlannerInput>(buildFormState(props.initialValue));

watch(
  () => props.initialValue,
  (nextValue) => {
    Object.assign(form, buildFormState(nextValue));
  },
  { deep: true },
);

const tripLengthDays = computed(() => calculateTripLengthDays(form.startDate, form.endDate));
const dailyBudget = computed(() => Math.round(form.budget / Math.max(tripLengthDays.value, 1)));
const paceLabel = computed(() => paceOptions.find((option) => option.value === form.pace)?.label ?? 'Moderate');
const destinationLabel = computed(() => form.destination.trim() || 'Choose a destination');
const interestsLabel = computed(() => (form.interests.length ? form.interests.map((interest) => categoryLabels[interest]).join(', ') : 'Select at least one interest'));

function buildFormState(initialValue: Partial<TripPlannerInput>): TripPlannerInput {
  return {
    destination: initialValue.destination ?? 'Fort Worth, TX',
    startDate: initialValue.startDate ?? new Date().toISOString().slice(0, 10),
    endDate: initialValue.endDate ?? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    budget: initialValue.budget ?? 500,
    interests: initialValue.interests ? [...initialValue.interests] : ['food', 'culture', 'nightlife'],
    pace: initialValue.pace ?? 'moderate',
    groupSize: initialValue.groupSize ?? 2,
  };
}

function calculateTripLengthDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 1;
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1);
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
  const start = new Date(form.startDate);
  const end = new Date(form.endDate);

  if (!form.destination.trim()) {
    nextErrors.destination = 'Choose a destination so Atlas can build a route.';
  }

  if (Number.isNaN(start.getTime())) {
    nextErrors.startDate = 'Add a valid start date.';
  }

  if (Number.isNaN(end.getTime())) {
    nextErrors.endDate = 'Add a valid end date.';
  }

  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end < start) {
    nextErrors.endDate = 'End date must be on or after the start date.';
  }

  if (form.budget < 0) {
    nextErrors.budget = 'Budget must be zero or greater.';
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

  emit('submit', {
    destination: form.destination.trim(),
    startDate: form.startDate,
    endDate: form.endDate,
    budget: form.budget,
    interests: [...form.interests],
    pace: form.pace,
    groupSize: form.groupSize,
  });
}
</script>

<style scoped>
.trip-planner,
.planner-header,
.planner-grid,
.panel-section,
.planner-stats,
.field-grid,
.planner-footer,
.summary-card {
  display: grid;
  gap: var(--space-4);
}

.trip-planner {
  padding: var(--space-6);
}

.planner-header {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
}

.eyebrow {
  margin: 0 0 var(--space-1);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.planner-header h2,
.panel-heading h3,
.summary-card h3,
.section-copy,
.summary-card ul,
.summary-card li {
  margin: 0;
}

.planner-stats {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.stat-card,
.pace-card,
.summary-card {
  padding: var(--space-4);
}

.stat-card {
  min-width: 8rem;
  text-align: center;
}

.stat-card strong,
.summary-card strong,
.pace-card strong {
  color: var(--text-primary);
}

.stat-card span,
.pace-card span,
.summary-card span,
.section-copy {
  color: var(--text-secondary);
}

.planner-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.panel-section {
  padding: var(--space-5);
}

.panel-heading {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  align-items: flex-start;
}

.field-grid.two-column {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.field {
  display: grid;
  gap: var(--space-2);
}

.field-full {
  grid-column: 1 / -1;
}

.field input {
  width: 100%;
  border: 1px solid var(--input-border);
  border-radius: var(--radius-lg);
  background: var(--input-bg);
  color: var(--text-primary);
  padding: 0.85rem 0.95rem;
}

.field input:focus-visible {
  outline: none;
  border-color: var(--input-focus);
  box-shadow: var(--shadow-glow-teal);
}

.field-error {
  color: var(--danger);
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0.8rem;
  border-radius: var(--radius-full);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
  font-size: var(--font-size-small);
}

.pace-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
}

.pace-card,
.interest-chip,
.submit-button {
  border: 1px solid transparent;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast),
    opacity var(--transition-fast);
}

.pace-card {
  text-align: left;
  border-radius: var(--radius-xl);
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
}

.pace-card.active,
.pace-card:hover,
.pace-card:focus-visible {
  border-color: var(--border-hover);
  transform: translateY(-0.0625rem);
  outline: none;
}

.pace-card.active {
  box-shadow: var(--shadow-glow-teal);
}

.interest-section {
  padding: var(--space-5);
}

.chip-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-3);
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
  cursor: pointer;
  opacity: 0.55;
}

.interest-chip.active {
  opacity: 1;
  box-shadow: var(--shadow-md);
}

.interest-chip:hover,
.interest-chip:focus-visible {
  transform: translateY(-0.0625rem);
  outline: none;
}

.interest-chip :deep(.atlas-icon) {
  width: 1rem;
  height: 1rem;
}

.planner-footer {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: stretch;
}

.summary-card ul {
  padding-left: 1rem;
  display: grid;
  gap: var(--space-2);
}

.summary-card li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  color: var(--text-secondary);
}

.submit-button {
  align-self: end;
  padding: 0.95rem 1.35rem;
  border-radius: var(--radius-full);
  background: var(--accent-teal);
  color: var(--bg-primary);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  box-shadow: var(--shadow-glow-teal);
}

.submit-button:hover:not(:disabled),
.submit-button:focus-visible {
  background: var(--accent-teal-hover);
  transform: translateY(-0.0625rem);
  outline: none;
}

.submit-button:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

@media (max-width: 1024px) {
  .planner-grid,
  .chip-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .trip-planner {
    padding: var(--space-5);
  }

  .planner-header,
  .planner-grid,
  .planner-footer,
  .field-grid.two-column,
  .pace-grid,
  .chip-grid {
    grid-template-columns: 1fr;
  }

  .planner-stats {
    width: 100%;
  }
}
</style>
