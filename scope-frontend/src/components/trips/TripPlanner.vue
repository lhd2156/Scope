<template>
  <form
    class="trip-planner glass-panel"
    data-test="trip-planner"
    data-onboarding-target="planner-shell"
    :data-planner-mode="mobileWizard ? 'mobile-wizard' : 'desktop'"
    @submit.prevent="handleSubmit"
  >
    <header class="planner-header">
      <div class="planner-copy">
        <p class="eyebrow">Route builder</p>
        <h2>{{ displayTripTitle }}</h2>
        <p class="section-copy">
          Set the brief and route here. Scope AI uses this same draft to build the live itinerary in the copilot beside it.
        </p>
      </div>
    </header>

    <section class="planner-step-shell" :data-step-state="getWizardStepState(1)">
      <button
        v-if="mobileWizard"
        type="button"
        class="planner-step-toggle"
        data-test="planner-step-1-toggle"
        :aria-expanded="String(isWizardStepActive(1))"
        aria-controls="planner-step-1-content"
        @click="emitWizardStepChange(1)"
      >
        <span class="planner-step-toggle__index">1</span>
        <span class="planner-step-toggle__copy">
          <span class="eyebrow">Step 1</span>
          <strong>Trip brief</strong>
          <span>{{ stepOneSummary }}</span>
        </span>
        <span class="planner-step-toggle__state">{{ getWizardStepLabel(1) }}</span>
      </button>

      <div id="planner-step-1-content" class="planner-step-content" data-test="planner-step-1-content" v-show="!mobileWizard || isWizardStepActive(1)">
        <section class="planner-grid">
          <article class="planner-card glass-panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">Core brief</p>
                <h3>Title, dates, city, and travelers</h3>
              </div>
            </div>

            <div class="field-grid">
              <label class="field field-full">
                <span>Trip title</span>
                <div class="input-shell">
                  <ScopeIcon name="route" label="Trip title" />
                  <input v-model.trim="tripTitle" data-test="trip-title-input" type="text" maxlength="120" placeholder="Name this trip" />
                </div>
              </label>

              <label class="field">
                <span>Start date</span>
                <div class="input-shell">
                  <ScopeIcon name="calendar" label="Start date" />
                  <input v-model="form.startDate" type="date" />
                </div>
                <small v-if="errors.startDate" class="field-error">{{ errors.startDate }}</small>
              </label>

              <label class="field">
                <span>End date</span>
                <div class="input-shell">
                  <ScopeIcon name="calendar" label="End date" />
                  <input v-model="form.endDate" type="date" />
                </div>
                <small v-if="errors.endDate" class="field-error">{{ errors.endDate }}</small>
              </label>

              <div class="field field-full location-field">
                <label for="trip-destination-input">Start city, address, or place</label>
                <div class="input-shell">
                  <ScopeIcon name="search" label="Start destination" />
                  <input
                    id="trip-destination-input"
                    v-model.trim="form.destination"
                    data-test="destination-input"
                    type="text"
                    maxlength="120"
                    autocomplete="street-address"
                    placeholder="Street address, city, state, country, or landmark"
                    aria-autocomplete="list"
                    :aria-expanded="String(shouldShowLocationSuggestions('destination'))"
                    aria-controls="destination-suggestions"
                    @focus="handleLocationFocus('destination')"
                    @blur="handleLocationBlur('destination')"
                    @input="handleLocationInput('destination')"
                    @keydown="handleLocationKeydown('destination', $event)"
                  />
                </div>
                <div
                  v-if="shouldShowLocationSuggestions('destination')"
                  id="destination-suggestions"
                  class="location-suggestions glass-panel"
                  data-test="destination-suggestions"
                  role="listbox"
                  aria-label="Start location suggestions"
                >
                  <button
                    v-for="(suggestion, index) in locationSuggestions.destination.results"
                    :key="`destination-${suggestion.latitude}-${suggestion.longitude}-${index}`"
                    type="button"
                    class="location-suggestion"
                    data-test="destination-suggestion"
                    role="option"
                    :aria-selected="String(locationSuggestions.destination.activeIndex === index)"
                    :class="{ active: locationSuggestions.destination.activeIndex === index }"
                    @mouseenter="locationSuggestions.destination.activeIndex = index"
                    @mousedown.prevent
                    @click="selectLocationSuggestion('destination', suggestion)"
                  >
                    <span class="location-suggestion__header">
                      <span class="location-suggestion__main">{{ formatLocationSuggestionTitle(suggestion) }}</span>
                      <span v-if="formatLocationSuggestionBadge(suggestion, index)" class="location-suggestion__badge">
                        {{ formatLocationSuggestionBadge(suggestion, index) }}
                      </span>
                    </span>
                    <span class="location-suggestion__meta">{{ formatLocationSuggestionMeta(suggestion) }}</span>
                  </button>
                  <span v-if="locationSuggestions.destination.loading" class="location-status">Searching places...</span>
                  <span v-else-if="locationSuggestions.destination.error" class="location-status">{{ locationSuggestions.destination.error }}</span>
                  <span v-else-if="locationSuggestions.destination.results.length === 0" class="location-status">Keep typing a more exact place.</span>
                </div>
                <small class="field-hint">Type an exact address or use the map pointer.</small>
                <small v-if="errors.destination" class="field-error">{{ errors.destination }}</small>
              </div>

              <div class="field field-full location-field">
                <label for="trip-end-destination-input">End city, address, or place</label>
                <div class="input-shell">
                  <ScopeIcon name="pin" label="End destination" />
                  <input
                    id="trip-end-destination-input"
                    v-model.trim="form.endDestination"
                    data-test="end-destination-input"
                    type="text"
                    maxlength="120"
                    autocomplete="street-address"
                    placeholder="Optional final address, city, or landmark"
                    aria-autocomplete="list"
                    :aria-expanded="String(shouldShowLocationSuggestions('endDestination'))"
                    aria-controls="end-destination-suggestions"
                    @focus="handleLocationFocus('endDestination')"
                    @blur="handleLocationBlur('endDestination')"
                    @input="handleLocationInput('endDestination')"
                    @keydown="handleLocationKeydown('endDestination', $event)"
                  />
                </div>
                <div
                  v-if="shouldShowLocationSuggestions('endDestination')"
                  id="end-destination-suggestions"
                  class="location-suggestions glass-panel"
                  data-test="end-destination-suggestions"
                  role="listbox"
                  aria-label="End location suggestions"
                >
                  <button
                    v-for="(suggestion, index) in locationSuggestions.endDestination.results"
                    :key="`endDestination-${suggestion.latitude}-${suggestion.longitude}-${index}`"
                    type="button"
                    class="location-suggestion"
                    data-test="end-destination-suggestion"
                    role="option"
                    :aria-selected="String(locationSuggestions.endDestination.activeIndex === index)"
                    :class="{ active: locationSuggestions.endDestination.activeIndex === index }"
                    @mouseenter="locationSuggestions.endDestination.activeIndex = index"
                    @mousedown.prevent
                    @click="selectLocationSuggestion('endDestination', suggestion)"
                  >
                    <span class="location-suggestion__header">
                      <span class="location-suggestion__main">{{ formatLocationSuggestionTitle(suggestion) }}</span>
                      <span v-if="formatLocationSuggestionBadge(suggestion, index)" class="location-suggestion__badge">
                        {{ formatLocationSuggestionBadge(suggestion, index) }}
                      </span>
                    </span>
                    <span class="location-suggestion__meta">{{ formatLocationSuggestionMeta(suggestion) }}</span>
                  </button>
                  <span v-if="locationSuggestions.endDestination.loading" class="location-status">Searching places...</span>
                  <span v-else-if="locationSuggestions.endDestination.error" class="location-status">{{ locationSuggestions.endDestination.error }}</span>
                  <span v-else-if="locationSuggestions.endDestination.results.length === 0" class="location-status">Keep typing a more exact place.</span>
                </div>
                <small class="field-hint">Optional. Scope will route toward it when set.</small>
              </div>

              <div class="field field-full traveler-field">
                <span>Travelers</span>
                <div class="traveler-control" role="group" aria-label="Travelers on this trip">
                  <button
                    type="button"
                    class="traveler-step-button"
                    data-test="traveler-decrement"
                    aria-label="Remove traveler"
                    :disabled="form.groupSize <= 1"
                    @click="updateGroupSize(form.groupSize - 1)"
                  >
                    <span aria-hidden="true">-</span>
                  </button>
                  <output
                    class="traveler-count"
                    data-test="traveler-count"
                    aria-live="polite"
                    :aria-label="`${form.groupSize} traveler${form.groupSize === 1 ? '' : 's'}`"
                  >
                    <strong>{{ form.groupSize }}</strong>
                    <span>traveler{{ form.groupSize === 1 ? '' : 's' }}</span>
                  </output>
                  <button
                    type="button"
                    class="traveler-step-button"
                    data-test="traveler-increment"
                    aria-label="Add traveler"
                    :disabled="form.groupSize >= 12"
                    @click="updateGroupSize(form.groupSize + 1)"
                  >
                    <ScopeIcon name="plus" label="Add traveler" />
                  </button>
                </div>
                <small v-if="errors.groupSize" class="field-error">{{ errors.groupSize }}</small>
              </div>
            </div>
          </article>

          <article class="planner-card glass-panel budget-card">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">Budget range</p>
                <h3>{{ budgetRangeLabel }}</h3>
              </div>
              <span class="meta-pill">{{ dailyBudgetLabel }}</span>
            </div>

            <div class="budget-input-grid" role="group" aria-label="Budget range in dollars">
              <div class="budget-metric budget-input-card glass-panel" data-budget-control="minimum">
                <div class="budget-input-card__top">
                  <label for="budget-floor-input">Minimum</label>
                  <button
                    type="button"
                    class="budget-edit-button"
                    data-test="budget-floor-edit"
                    aria-label="Edit minimum budget"
                    @click="focusBudgetInput('floor')"
                  >
                    <ScopeIcon name="edit" label="Edit minimum budget" />
                  </button>
                </div>
                <div class="budget-control">
                  <button
                    type="button"
                    class="budget-step-button"
                    data-test="budget-floor-decrement"
                    aria-label="Decrease minimum budget"
                    :disabled="budgetFloor <= 0"
                    @click="adjustBudgetFloor(-BUDGET_STEP_AMOUNT)"
                  >
                    <span aria-hidden="true">-</span>
                  </button>
                  <span class="budget-number-field">
                    <span aria-hidden="true">$</span>
                    <input
                      ref="budgetFloorInput"
                      id="budget-floor-input"
                      data-test="budget-floor-input"
                      type="number"
                      min="0"
                      step="1"
                      inputmode="numeric"
                      aria-label="Minimum budget"
                      placeholder="0"
                      :value="budgetFloor"
                      @focus="selectBudgetInput"
                      @input="handleBudgetFloorNumberInput"
                      @blur="normalizeBudgetInputs"
                    />
                  </span>
                  <button
                    type="button"
                    class="budget-step-button"
                    data-test="budget-floor-increment"
                    aria-label="Increase minimum budget"
                    @click="adjustBudgetFloor(BUDGET_STEP_AMOUNT)"
                  >
                    <ScopeIcon name="plus" label="Increase minimum budget" />
                  </button>
                </div>
              </div>
              <div class="budget-metric budget-input-card glass-panel" data-budget-control="maximum">
                <div class="budget-input-card__top">
                  <label for="budget-ceiling-input">Maximum</label>
                  <button
                    type="button"
                    class="budget-edit-button"
                    data-test="budget-ceiling-edit"
                    aria-label="Edit maximum budget"
                    @click="focusBudgetInput('ceiling')"
                  >
                    <ScopeIcon name="edit" label="Edit maximum budget" />
                  </button>
                </div>
                <div class="budget-control">
                  <button
                    type="button"
                    class="budget-step-button"
                    data-test="budget-ceiling-decrement"
                    aria-label="Decrease maximum budget"
                    :disabled="budgetCeiling <= 0"
                    @click="adjustBudgetCeiling(-BUDGET_STEP_AMOUNT)"
                  >
                    <span aria-hidden="true">-</span>
                  </button>
                  <span class="budget-number-field">
                    <span aria-hidden="true">$</span>
                    <input
                      ref="budgetCeilingInput"
                      id="budget-ceiling-input"
                      data-test="budget-ceiling-input"
                      type="number"
                      min="0"
                      step="1"
                      inputmode="numeric"
                      aria-label="Maximum budget"
                      placeholder="0"
                      :value="budgetCeiling"
                      @focus="selectBudgetInput"
                      @input="handleBudgetCeilingNumberInput"
                      @blur="normalizeBudgetInputs"
                    />
                  </span>
                  <button
                    type="button"
                    class="budget-step-button"
                    data-test="budget-ceiling-increment"
                    aria-label="Increase maximum budget"
                    @click="adjustBudgetCeiling(BUDGET_STEP_AMOUNT)"
                  >
                    <ScopeIcon name="plus" label="Increase maximum budget" />
                  </button>
                </div>
              </div>
            </div>
            <p class="budget-helper">Total trip spend before splitting with travelers.</p>
            <small v-if="errors.budget" class="field-error">{{ errors.budget }}</small>
          </article>
        </section>

        <div v-if="mobileWizard" class="planner-step-actions">
          <button type="button" class="button button-secondary step-action-button" data-test="planner-step-1-continue" @click="emitWizardStepChange(2)">
            Continue to route
          </button>
        </div>
      </div>
    </section>

    <section v-if="mobileWizard || hasRouteStops" class="planner-step-shell" :data-step-state="getWizardStepState(2)">
      <button
        v-if="mobileWizard"
        type="button"
        class="planner-step-toggle"
        data-test="planner-step-2-toggle"
        :aria-expanded="String(isWizardStepActive(2))"
        aria-controls="planner-step-2-content"
        @click="emitWizardStepChange(2)"
      >
        <span class="planner-step-toggle__index">2</span>
        <span class="planner-step-toggle__copy">
          <span class="eyebrow">Step 2</span>
          <strong>Route order</strong>
          <span>{{ stepTwoSummary }}</span>
        </span>
        <span class="planner-step-toggle__state">{{ getWizardStepLabel(2) }}</span>
      </button>

      <div id="planner-step-2-content" class="planner-step-content" data-test="planner-step-2-content" v-show="!mobileWizard || isWizardStepActive(2)">
        <section class="planner-card glass-panel stop-section">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Route order</p>
              <h3>Stops Scope AI should sequence</h3>
            </div>
            <button type="button" class="button button-secondary add-stop-button" data-test="trip-add-stop" @click="handleAddSuggestedStop">
              <ScopeIcon name="plus" label="Add suggested stop" />
              <span>Add stop</span>
            </button>
          </div>

          <div class="stop-tools">
            <label class="field stop-search">
              <span>Add a destination</span>
              <div class="input-shell">
                <ScopeIcon name="search" label="Search suggested stops" />
                <input
                  v-model.trim="destinationSearch"
                  data-test="destination-search-input"
                  type="text"
                  maxlength="120"
                  placeholder="Search a place to add"
                />
              </div>
            </label>
          </div>

          <p class="section-copy stop-copy">
            Add or reorder stops here. Scope AI will use this list, then tighten timing in the live preview.
          </p>

          <div class="stop-list" data-test="trip-stop-list" role="list">
            <article
              v-for="stop in destinationStops"
              :key="stop.spotId"
              class="stop-card glass-panel"
              data-test="trip-stop-card"
              :data-stop-id="stop.spotId"
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
                <ScopeIcon name="grip" label="Drag stop" />
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
                <ScopeIcon name="close" label="Remove stop" />
              </button>
            </article>
          </div>
        </section>

        <div v-if="mobileWizard" class="planner-step-actions planner-step-actions--split">
          <button type="button" class="button button-secondary step-action-button" data-test="planner-step-2-back" @click="emitWizardStepChange(1)">
            Back to brief
          </button>
          <button type="button" class="button button-secondary step-action-button" data-test="planner-step-2-continue" @click="emitWizardStepChange(3)">
            Continue to trip vibe
          </button>
        </div>
      </div>
    </section>

    <section class="planner-step-shell" :data-step-state="getWizardStepState(3)">
      <button
        v-if="mobileWizard"
        type="button"
        class="planner-step-toggle"
        data-test="planner-step-3-toggle"
        :aria-expanded="String(isWizardStepActive(3))"
        aria-controls="planner-step-3-content"
        @click="emitWizardStepChange(3)"
      >
        <span class="planner-step-toggle__index">3</span>
        <span class="planner-step-toggle__copy">
          <span class="eyebrow">Step 3</span>
          <strong>Trip vibe</strong>
          <span>{{ stepThreeSummary }}</span>
        </span>
        <span class="planner-step-toggle__state">{{ getWizardStepLabel(3) }}</span>
      </button>

      <div id="planner-step-3-content" class="planner-step-content" data-test="planner-step-3-content" v-show="!mobileWizard || isWizardStepActive(3)">
        <section class="planner-grid planner-grid--secondary">
          <article class="planner-card glass-panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">Pace</p>
                <h3>How should the days feel?</h3>
              </div>
            </div>

            <div class="pace-grid">
              <button
                v-for="option in paceOptions"
                :key="option.value"
                type="button"
                class="pace-card glass-panel"
                :data-test="`trip-pace-${option.value}`"
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
                <h3>Pick the trip vibes</h3>
              </div>
              <span class="meta-pill">{{ form.interests.length }} selected</span>
            </div>

            <div class="chip-grid">
              <button
                v-for="category in categories"
                :key="category"
                type="button"
                class="interest-chip"
                :data-test="`trip-interest-${category}`"
                :class="[
                  `badge-${category}`,
                  {
                    active: form.interests.includes(category),
                  },
                ]"
                @click="toggleCategory(category)"
              >
                <ScopeIcon :name="category === 'other' ? 'pin' : category" :label="categoryLabels[category]" />
                <span>{{ categoryLabels[category] }}</span>
              </button>
            </div>
            <small v-if="errors.interests" class="field-error">{{ errors.interests }}</small>
          </article>
        </section>

        <footer class="planner-footer" :class="{ 'planner-footer--mobile': mobileWizard }">
          <div class="planner-footer-copy">
            <span class="eyebrow">Scope AI handoff</span>
            <strong>{{ destinationLabel }}</strong>
            <small>Send this route to Scope AI to build timing, sequence the stops, and refresh the preview. {{ interestsLabel }}</small>
          </div>

          <div class="planner-footer-actions">
            <button v-if="mobileWizard" type="button" class="button button-secondary step-action-button" data-test="planner-step-3-back" @click="emitWizardStepChange(2)">
              Back to route
            </button>
            <button class="submit-button" data-test="trip-planner-submit" data-onboarding-target="planner-submit" type="submit" :disabled="submitting">
              <ScopeIcon name="sparkle" label="Hand off to Scope AI" />
              <span>{{ submitting ? 'Scope AI is building...' : 'Hand Off to Scope AI' }}</span>
            </button>
          </div>
        </footer>
      </div>
    </section>
  </form>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import {
  TRIP_PLANNER_BUDGET_BOUNDS as budgetBounds,
  TRIP_PLANNER_CALENDAR_DATE_PATTERN as calendarDatePattern,
  TRIP_PLANNER_CATEGORIES as categories,
  TRIP_PLANNER_CATEGORY_LABELS as categoryLabels,
  TRIP_PLANNER_FALLBACK_TIME_SLOTS as fallbackTimeSlots,
  TRIP_PLANNER_PACE_OPTIONS as paceOptions,
} from '@/config/tripPlannerConfig';
import { searchLocations, type GeocodeResult, type PlaceSearchResult } from '@/services/mapService';
import type { SpotCategory, TripPlannerInput, TripSpot } from '@/types';
import { getInclusiveDaySpan } from '@/utils/formatters';

interface PlannerErrors {
  destination?: string;
  startDate?: string;
  endDate?: string;
  budget?: string;
  groupSize?: string;
  interests?: string;
}

type PlannerWizardStep = 1 | 2 | 3 | 4;
type LocationFieldKey = 'destination' | 'endDestination';

interface LocationSearchAnchor {
  latitude: number;
  longitude: number;
}

interface LocationSuggestionState {
  results: GeocodeResult[];
  loading: boolean;
  open: boolean;
  error: string;
  activeIndex: number;
}

const props = withDefaults(
  defineProps<{
    initialValue?: Partial<TripPlannerInput>;
    initialTitle?: string;
    budgetRange?: [number, number];
    selectedStops?: TripSpot[];
    stops?: TripSpot[];
    suggestedStops?: TripSpot[];
    submitting?: boolean;
    mobileWizard?: boolean;
    mobileActiveStep?: PlannerWizardStep;
    locationSearchProximity?: LocationSearchAnchor;
  }>(),
  {
    initialValue: () => ({}),
    initialTitle: '',
    budgetRange: () => [500, 5000] as [number, number],
    selectedStops: () => [],
    stops: () => [],
    suggestedStops: () => [],
    submitting: false,
    mobileWizard: false,
    mobileActiveStep: 1 as PlannerWizardStep,
    locationSearchProximity: undefined,
  },
);

const emit = defineEmits<{
  (event: 'submit', payload: TripPlannerInput): void;
  (event: 'update:draft', payload: TripPlannerInput): void;
  (event: 'update:stops', payload: TripSpot[]): void;
  (event: 'update:title', payload: string): void;
  (event: 'wizard-step-change', payload: PlannerWizardStep): void;
}>();

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const LOCATION_SEARCH_DEBOUNCE_MS = 260;
const LOCATION_MIN_QUERY_LENGTH = 3;
const BUDGET_STEP_AMOUNT = 100;

const errors = ref<PlannerErrors>({});
const resolvedBudgetBounds = computed(() => normalizeBudgetRange(props.budgetRange));
const resolvedSelectedStops = computed(() => (props.selectedStops.length ? props.selectedStops : props.stops));
const form = reactive<TripPlannerInput>(buildFormState(props.initialValue));
const tripTitle = ref(props.initialTitle.trim() || buildTripTitle(props.initialValue.destination));
const budgetCeiling = ref(resolveBudgetCeiling(props.initialValue, resolvedBudgetBounds.value));
const budgetFloor = ref(resolveBudgetFloor(props.initialValue, resolvedBudgetBounds.value, budgetCeiling.value));
const budgetFloorInput = ref<HTMLInputElement | null>(null);
const budgetCeilingInput = ref<HTMLInputElement | null>(null);
const destinationStops = ref<TripSpot[]>(normalizeStops(resolvedSelectedStops.value));
const destinationSearch = ref('');
const draggingStopId = ref<string | null>(null);
const dropTargetStopId = ref<string | null>(null);
const locationSuggestions = reactive<Record<LocationFieldKey, LocationSuggestionState>>({
  destination: {
    results: [],
    loading: false,
    open: false,
    error: '',
    activeIndex: -1,
  },
  endDestination: {
    results: [],
    loading: false,
    open: false,
    error: '',
    activeIndex: -1,
  },
});
const locationSearchTimers: Record<LocationFieldKey, ReturnType<typeof setTimeout> | null> = {
  destination: null,
  endDestination: null,
};
const locationBlurTimers: Record<LocationFieldKey, ReturnType<typeof setTimeout> | null> = {
  destination: null,
  endDestination: null,
};
const locationRequestIds: Record<LocationFieldKey, number> = {
  destination: 0,
  endDestination: 0,
};

watch(
  () => props.initialValue,
  (nextValue) => {
    Object.assign(form, buildFormState(nextValue));
    budgetCeiling.value = resolveBudgetCeiling(nextValue, resolvedBudgetBounds.value);
    budgetFloor.value = resolveBudgetFloor(nextValue, resolvedBudgetBounds.value, budgetCeiling.value);
    normalizeBudgetInputs();

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
  () => normalizeBudgetInputs(),
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
const displayTripTitle = computed(() => tripTitle.value.trim() || 'New trip');

function formatRouteEndpointLabel(value: string | undefined): string {
  const parts = (value ?? '').split(',').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) {
    return '';
  }

  const [primary = '', locality = ''] = parts;
  return locality ? `${primary}, ${locality}` : primary;
}

const destinationLabel = computed(() => {
  const startDestination = formatRouteEndpointLabel(form.destination);
  const endDestination = formatRouteEndpointLabel(form.endDestination);

  if (startDestination && endDestination) {
    return `${startDestination} to ${endDestination}`;
  }

  return startDestination || 'Pick a place to plan around';
});
const interestsLabel = computed(() => {
  if (!form.interests.length) {
    return 'Choose a few trip vibes';
  }

  const labels = form.interests.map((interest) => categoryLabels[interest]);
  if (labels.length <= 3) {
    return labels.join(', ');
  }

  return `${labels.slice(0, 3).join(', ')} +${labels.length - 3} more`;
});
const budgetRangeLabel = computed(() => `${currencyFormatter.format(budgetFloor.value)} - ${currencyFormatter.format(budgetCeiling.value)}`);
const dailyBudgetLabel = computed(() => `${currencyFormatter.format(dailyBudget.value)} / day`);
const stepOneSummary = computed(() => `${destinationLabel.value} · ${tripLengthDays.value} day${tripLengthDays.value === 1 ? '' : 's'}`);
const hasRouteStops = computed(() => destinationStops.value.length > 0 || props.suggestedStops.length > 0);
const stepTwoSummary = computed(() => {
  const stopCount = destinationStops.value.length;
  if (!stopCount) {
    return 'Stops appear after a destination is selected.';
  }

  const leadStop = destinationStops.value[0]?.title ?? 'Choose stops';
  return `${stopCount} stop${stopCount === 1 ? '' : 's'} · ${leadStop}`;
});
const stepThreeSummary = computed(() => `${paceLabel.value} pace · ${form.interests.length} interest${form.interests.length === 1 ? '' : 's'}`);

watch(
  () => [
    form.destination,
    form.endDestination ?? '',
    form.destinationLatitude,
    form.destinationLongitude,
    form.endDestinationLatitude,
    form.endDestinationLongitude,
    form.startDate,
    form.endDate,
    budgetFloor.value,
    budgetCeiling.value,
    form.pace,
    form.groupSize,
    form.interests.join('|'),
  ] as const,
  () => {
    emit('update:draft', buildPlannerPayload());
  },
);

function clampWizardStep(step: number): PlannerWizardStep {
  if (step <= 1) {
    return 1;
  }

  if (step >= 4) {
    return 4;
  }

  return step as PlannerWizardStep;
}

function isWizardStepActive(step: PlannerWizardStep): boolean {
  return !props.mobileWizard || props.mobileActiveStep === step;
}

function getWizardStepState(step: PlannerWizardStep): 'desktop' | 'current' | 'complete' | 'upcoming' {
  if (!props.mobileWizard) {
    return 'desktop';
  }

  if (props.mobileActiveStep === step) {
    return 'current';
  }

  return props.mobileActiveStep > step ? 'complete' : 'upcoming';
}

function getWizardStepLabel(step: PlannerWizardStep): string {
  const stepState = getWizardStepState(step);

  switch (stepState) {
    case 'complete':
      return 'Done';
    case 'current':
      return 'Current';
    case 'upcoming':
      return 'Next';
    default:
      return '';
  }
}

function emitWizardStepChange(step: number): void {
  if (!props.mobileWizard) {
    return;
  }

  emit('wizard-step-change', clampWizardStep(step));
}

function buildTripTitle(_destination?: string): string {
  return '';
}

function getDefaultDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function buildFormState(initialValue: Partial<TripPlannerInput>): TripPlannerInput {
  return {
    destination: initialValue.destination ?? '',
    endDestination: initialValue.endDestination ?? '',
    destinationLatitude: normalizeCoordinate(initialValue.destinationLatitude, -90, 90),
    destinationLongitude: normalizeCoordinate(initialValue.destinationLongitude, -180, 180),
    endDestinationLatitude: normalizeCoordinate(initialValue.endDestinationLatitude, -90, 90),
    endDestinationLongitude: normalizeCoordinate(initialValue.endDestinationLongitude, -180, 180),
    startDate: initialValue.startDate ?? getDefaultDate(0),
    endDate: initialValue.endDate ?? getDefaultDate(0),
    budgetFloor: initialValue.budgetFloor ?? 500,
    budget: initialValue.budget ?? 1500,
    interests: initialValue.interests ? [...initialValue.interests] : [],
    pace: initialValue.pace ?? 'relaxed',
    groupSize: initialValue.groupSize ?? 1,
  };
}

function buildPlannerPayload(): TripPlannerInput {
  const destination = form.destination.trim();
  const endDestination = form.endDestination?.trim() ?? '';
  const destinationCoordinates = resolveLocationCoordinatePayload('destination');
  const endDestinationCoordinates = resolveLocationCoordinatePayload('endDestination');

  return {
    destination,
    ...(destination ? destinationCoordinates : {}),
    ...(endDestination ? { endDestination } : {}),
    ...(endDestination ? endDestinationCoordinates : {}),
    startDate: form.startDate,
    endDate: form.endDate,
    budgetFloor: budgetFloor.value,
    budget: budgetCeiling.value,
    interests: [...form.interests],
    pace: form.pace,
    groupSize: form.groupSize,
  };
}

function normalizeCoordinate(value: number | undefined, minimum: number, maximum: number): number | undefined {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < minimum || numericValue > maximum) {
    return undefined;
  }

  return numericValue;
}

function isCoordinatePair(latitude: number | undefined, longitude: number | undefined): latitude is number {
  return (
    normalizeCoordinate(latitude, -90, 90) !== undefined &&
    normalizeCoordinate(longitude, -180, 180) !== undefined
  );
}

function resolveLocationCoordinatePayload(field: LocationFieldKey): Partial<TripPlannerInput> {
  if (field === 'destination' && isCoordinatePair(form.destinationLatitude, form.destinationLongitude)) {
    return {
      destinationLatitude: form.destinationLatitude,
      destinationLongitude: form.destinationLongitude,
    };
  }

  if (field === 'endDestination' && isCoordinatePair(form.endDestinationLatitude, form.endDestinationLongitude)) {
    return {
      endDestinationLatitude: form.endDestinationLatitude,
      endDestinationLongitude: form.endDestinationLongitude,
    };
  }

  return {};
}

function getLocationFieldValue(field: LocationFieldKey): string {
  return field === 'destination' ? form.destination : (form.endDestination ?? '');
}

function setLocationFieldValue(field: LocationFieldKey, value: string): void {
  if (field === 'destination') {
    form.destination = value;
    return;
  }

  form.endDestination = value;
}

function clearLocationCoordinates(field: LocationFieldKey): void {
  if (field === 'destination') {
    form.destinationLatitude = undefined;
    form.destinationLongitude = undefined;
    return;
  }

  form.endDestinationLatitude = undefined;
  form.endDestinationLongitude = undefined;
}

function setLocationCoordinates(field: LocationFieldKey, result: GeocodeResult): void {
  if (field === 'destination') {
    form.destinationLatitude = normalizeCoordinate(result.latitude, -90, 90);
    form.destinationLongitude = normalizeCoordinate(result.longitude, -180, 180);
    return;
  }

  form.endDestinationLatitude = normalizeCoordinate(result.latitude, -90, 90);
  form.endDestinationLongitude = normalizeCoordinate(result.longitude, -180, 180);
}

function clearLocationTimer(timers: Record<LocationFieldKey, ReturnType<typeof setTimeout> | null>, field: LocationFieldKey): void {
  const timer = timers[field];
  if (timer) {
    clearTimeout(timer);
    timers[field] = null;
  }
}

function shouldShowLocationSuggestions(field: LocationFieldKey): boolean {
  const state = locationSuggestions[field];
  return state.open && (state.loading || Boolean(state.error) || state.results.length > 0 || getLocationFieldValue(field).trim().length >= LOCATION_MIN_QUERY_LENGTH);
}

function formatLocationSuggestionTitle(result: GeocodeResult): string {
  if (result.precision === 'poi' && result.placeName) {
    return result.placeName;
  }

  return result.formattedAddress || result.address || result.placeName || 'Pinned location';
}

function formatLocationSuggestionMeta(result: GeocodeResult): string {
  const placeResult = result as PlaceSearchResult;
  const isPoiResult = result.precision === 'poi';
  const details = [
    placeResult.distanceKm === undefined ? '' : `${formatDistanceMiles(placeResult.distanceKm)} away`,
    [result.city, result.country].filter(Boolean).join(', '),
    isPoiResult ? placeResult.category : '',
  ].filter(Boolean);

  if (details.length) {
    return details.join(' - ');
  }

  const cityCountry = [result.city, result.country].filter(Boolean).join(', ');
  if (cityCountry) {
    return cityCountry;
  }

  return `${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`;
}

function formatLocationSuggestionBadge(result: GeocodeResult, index: number): string {
  const placeResult = result as PlaceSearchResult;
  if (index === 0 && result.precision === 'poi' && placeResult.distanceKm !== undefined) {
    return 'Closest';
  }

  return index === 0 ? 'Best match' : '';
}

function formatDistanceMiles(distanceKm: number): string {
  const miles = distanceKm * 0.621371;
  if (miles < 10) {
    return `${miles.toFixed(1)} mi`;
  }

  return `${Math.round(miles).toLocaleString('en-US')} mi`;
}

function resolveLocationSuggestionLabel(result: GeocodeResult): string {
  return formatLocationSuggestionTitle(result).slice(0, 160);
}

function handleLocationFocus(field: LocationFieldKey): void {
  clearLocationTimer(locationBlurTimers, field);
  locationSuggestions[field].open = true;
  scheduleLocationSearch(field);
}

function handleLocationBlur(field: LocationFieldKey): void {
  clearLocationTimer(locationBlurTimers, field);
  locationBlurTimers[field] = setTimeout(() => {
    locationSuggestions[field].open = false;
  }, 140);
}

function handleLocationInput(field: LocationFieldKey): void {
  clearLocationCoordinates(field);
  locationSuggestions[field].open = true;
  locationSuggestions[field].error = '';
  scheduleLocationSearch(field);

  if (field === 'destination' && errors.value.destination) {
    errors.value = {
      ...errors.value,
      destination: undefined,
    };
  }
}

function scheduleLocationSearch(field: LocationFieldKey): void {
  const query = getLocationFieldValue(field).trim();
  const state = locationSuggestions[field];
  clearLocationTimer(locationSearchTimers, field);

  if (query.length < LOCATION_MIN_QUERY_LENGTH) {
    state.results = [];
    state.loading = false;
    state.error = '';
    state.activeIndex = -1;
    return;
  }

  state.loading = true;
  locationSearchTimers[field] = setTimeout(() => {
    void runLocationSearch(field, query);
  }, LOCATION_SEARCH_DEBOUNCE_MS);
}

async function runLocationSearch(field: LocationFieldKey, query: string): Promise<void> {
  const requestId = locationRequestIds[field] + 1;
  locationRequestIds[field] = requestId;
  const state = locationSuggestions[field];

  try {
    const response = await searchLocations(query, {
      limit: 6,
      proximity: resolveLocationSearchProximity(field),
    });
    if (locationRequestIds[field] !== requestId || getLocationFieldValue(field).trim() !== query) {
      return;
    }

    state.results = response.data;
    state.activeIndex = response.data.length ? 0 : -1;
    state.error = '';
  } catch {
    if (locationRequestIds[field] !== requestId) {
      return;
    }

    state.results = [];
    state.activeIndex = -1;
    state.error = 'Scope could not search places right now.';
  } finally {
    if (locationRequestIds[field] === requestId) {
      state.loading = false;
    }
  }
}

function resolveLocationSearchProximity(field: LocationFieldKey): LocationSearchAnchor | undefined {
  if (field === 'destination' && isCoordinatePair(form.endDestinationLatitude, form.endDestinationLongitude)) {
    return {
      latitude: form.endDestinationLatitude,
      longitude: form.endDestinationLongitude,
    };
  }

  if (field === 'endDestination' && isCoordinatePair(form.destinationLatitude, form.destinationLongitude)) {
    return {
      latitude: form.destinationLatitude,
      longitude: form.destinationLongitude,
    };
  }

  return props.locationSearchProximity;
}

function selectLocationSuggestion(field: LocationFieldKey, result: GeocodeResult): void {
  const label = resolveLocationSuggestionLabel(result);
  setLocationFieldValue(field, label);
  setLocationCoordinates(field, result);
  locationSuggestions[field].results = [result];
  locationSuggestions[field].activeIndex = 0;
  locationSuggestions[field].open = false;
  locationSuggestions[field].loading = false;
  locationSuggestions[field].error = '';
}

function handleLocationKeydown(field: LocationFieldKey, event: KeyboardEvent): void {
  const state = locationSuggestions[field];
  const resultsCount = state.results.length;

  if (event.key === 'Escape') {
    state.open = false;
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    state.open = true;
    state.activeIndex = resultsCount ? (state.activeIndex + 1 + resultsCount) % resultsCount : -1;
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    state.open = true;
    state.activeIndex = resultsCount ? (state.activeIndex - 1 + resultsCount) % resultsCount : -1;
    return;
  }

  if (event.key === 'Enter' && state.open && state.activeIndex >= 0) {
    const selectedResult = state.results[state.activeIndex];
    if (selectedResult) {
      event.preventDefault();
      selectLocationSuggestion(field, selectedResult);
    }
  }
}

function normalizeBudgetRange(range?: [number, number]): { min: number; max: number; step: number } {
  const minimum = Number(range?.[0] ?? budgetBounds.min);
  const maximum = Number(range?.[1] ?? budgetBounds.max);
  const normalizedMinimum = Math.max(0, Math.min(minimum, maximum));
  const normalizedMaximum = Math.max(normalizedMinimum + budgetBounds.step, Math.max(minimum, maximum));

  return {
    min: normalizedMinimum,
    max: normalizedMaximum,
    step: budgetBounds.step,
  };
}

function normalizeBudgetValue(value: number | undefined, fallback = 0): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, Math.round(numericValue)) : fallback;
}

function resolveBudgetCeiling(initialValue: Partial<TripPlannerInput>, bounds: { min: number; max: number }): number {
  return normalizeBudgetValue(initialValue.budget ?? form.budget, bounds.min);
}

function resolveBudgetFloor(initialValue: Partial<TripPlannerInput>, bounds: { min: number }, ceiling: number): number {
  if (initialValue.budgetFloor !== undefined) {
    return Math.min(normalizeBudgetValue(initialValue.budgetFloor, bounds.min), ceiling);
  }

  return Math.min(bounds.min, ceiling);
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

function handleBudgetFloorNumberInput(event: Event): void {
  const nextValue = normalizeBudgetValue(Number((event.target as HTMLInputElement).value), budgetFloor.value);
  budgetFloor.value = nextValue;
  if (budgetCeiling.value < nextValue) {
    budgetCeiling.value = nextValue;
  }
}

function handleBudgetCeilingNumberInput(event: Event): void {
  const nextValue = normalizeBudgetValue(Number((event.target as HTMLInputElement).value), budgetCeiling.value);
  budgetCeiling.value = nextValue;
  if (budgetFloor.value > nextValue) {
    budgetFloor.value = nextValue;
  }
}

function selectBudgetInput(event: FocusEvent): void {
  (event.target as HTMLInputElement).select();
}

function focusBudgetInput(field: 'floor' | 'ceiling'): void {
  const input = field === 'floor' ? budgetFloorInput.value : budgetCeilingInput.value;
  input?.focus();
  input?.select();
}

function adjustBudgetFloor(delta: number): void {
  const nextValue = normalizeBudgetValue(budgetFloor.value + delta, budgetFloor.value);
  budgetFloor.value = nextValue;
  if (budgetCeiling.value < nextValue) {
    budgetCeiling.value = nextValue;
  }
}

function adjustBudgetCeiling(delta: number): void {
  const nextValue = normalizeBudgetValue(budgetCeiling.value + delta, budgetCeiling.value);
  budgetCeiling.value = nextValue;
  if (budgetFloor.value > nextValue) {
    budgetFloor.value = nextValue;
  }
}

function normalizeBudgetInputs(): void {
  budgetFloor.value = normalizeBudgetValue(budgetFloor.value, 0);
  budgetCeiling.value = normalizeBudgetValue(budgetCeiling.value, budgetFloor.value);
  if (budgetFloor.value > budgetCeiling.value) {
    budgetFloor.value = budgetCeiling.value;
  }
}

function updateGroupSize(nextValue: number): void {
  form.groupSize = Math.min(12, Math.max(1, Math.round(nextValue)));
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
    nextErrors.destination = 'Enter a city, state, or place so Scope can build a route.';
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

  if (budgetFloor.value < 0 || budgetCeiling.value < 0) {
    nextErrors.budget = 'Budget values must be zero or higher.';
  }

  if (budgetFloor.value > budgetCeiling.value) {
    nextErrors.budget = 'Budget floor must be at or below the ceiling.';
  }

  if (form.groupSize < 1 || form.groupSize > 12) {
    nextErrors.groupSize = 'Group size must stay between 1 and 12.';
  }

  if (!form.interests.length) {
    nextErrors.interests = 'Select at least one interest to guide the itinerary.';
  }

  return nextErrors;
}

function resolveErrorStep(nextErrors: PlannerErrors): PlannerWizardStep {
  if (nextErrors.destination || nextErrors.startDate || nextErrors.endDate || nextErrors.budget || nextErrors.groupSize) {
    return 1;
  }

  if (nextErrors.interests) {
    return 3;
  }

  return 1;
}

function handleSubmit(): void {
  normalizeBudgetInputs();
  const nextErrors = validatePlanner();
  errors.value = nextErrors;

  if (Object.keys(nextErrors).length > 0) {
    emitWizardStepChange(resolveErrorStep(nextErrors));
    return;
  }

  form.budget = budgetCeiling.value;
  form.budgetFloor = budgetFloor.value;

  emit('submit', buildPlannerPayload());
}

onBeforeUnmount(() => {
  (['destination', 'endDestination'] as const).forEach((field) => {
    clearLocationTimer(locationSearchTimers, field);
    clearLocationTimer(locationBlurTimers, field);
    locationRequestIds[field] += 1;
  });
});
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
  .planner-footer-copy,
  .planner-summary,
  .budget-input-grid,
  .planner-step-shell,
  .planner-step-content,
  .planner-step-toggle__copy {
  display: grid;
  gap: var(--space-4);
}

.trip-planner {
  position: relative;
  align-content: start;
  gap: var(--space-4);
  padding: var(--space-5);
  min-height: 100%;
}

.trip-planner[data-planner-mode='desktop'] {
  gap: var(--space-3);
  overflow: visible;
  padding: var(--space-4);
}

.trip-planner[data-onboarding-active='true'] {
  border-color: color-mix(in srgb, var(--accent-teal) 42%, var(--glass-border));
  box-shadow:
    var(--shadow-lg),
    0 0 0 1px color-mix(in srgb, var(--accent-teal) 22%, transparent),
    0 0 2.4rem color-mix(in srgb, var(--accent-teal) 18%, transparent);
}

.trip-planner[data-onboarding-active='true']::after {
  content: '';
  position: absolute;
  inset: 0.9rem;
  border-radius: calc(var(--radius-2xl) - 0.35rem);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 16%, transparent);
  pointer-events: none;
}

.planner-header,
.panel-heading,
.stop-heading,
.stop-card,
.planner-footer,
.planner-step-toggle,
.planner-step-actions,
.planner-footer-actions {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.panel-heading > div {
  min-width: 0;
  flex: 1 1 14rem;
}

.planner-header,
.panel-heading,
.planner-footer,
.planner-step-toggle,
.planner-step-actions,
.planner-footer-actions {
  align-items: flex-start;
}

.planner-header {
  padding: 0;
}

.trip-planner[data-planner-mode='desktop'] .planner-copy {
  gap: var(--space-2);
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
  .budget-helper,
  .budget-metric span,
  .budget-metric strong,
.field span,
.field label,
.field-hint,
.field-error,
.planner-step-toggle__copy strong,
.planner-step-toggle__copy span,
.planner-step-toggle__state {
  margin: 0;
}

.planner-copy h2 {
  font-size: var(--font-size-h1);
  line-height: var(--line-height-tight);
  letter-spacing: var(--letter-spacing-display);
}

.trip-planner[data-planner-mode='desktop'] .planner-copy h2 {
  font-size: clamp(1.55rem, 1vw + 1rem, 2.05rem);
}

.trip-planner[data-planner-mode='desktop'] .section-copy {
  font-size: var(--font-size-small);
  line-height: var(--line-height-normal);
}

.section-copy,
.stop-meta,
.stop-notes,
.planner-summary span,
.planner-footer-copy small,
.budget-metric span,
.pace-card span,
.planner-step-toggle__copy > span:last-child,
.planner-step-toggle__state {
  color: var(--text-secondary);
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

.planner-step-toggle {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-2xl);
  background: color-mix(in srgb, var(--glass-bg) 94%, transparent);
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    background var(--transition-fast);
}

.planner-step-toggle:hover,
.planner-step-toggle:focus-visible {
  transform: translateY(var(--motion-card-lift));
  border-color: var(--border-hover);
  box-shadow: var(--shadow-md);
  outline: none;
}

.planner-step-shell[data-step-state='current'] .planner-step-toggle {
  border-color: var(--accent-teal);
  background: color-mix(in srgb, var(--accent-teal) 12%, var(--glass-bg));
  box-shadow: var(--shadow-glow-teal);
}

.planner-step-shell[data-step-state='complete'] .planner-step-toggle {
  border-color: color-mix(in srgb, var(--accent-teal) 34%, var(--glass-border));
}

.planner-step-toggle__index {
  width: 2.4rem;
  height: 2.4rem;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 20%, var(--bg-primary));
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
}

.planner-step-toggle__copy {
  flex: 1;
  min-width: 0;
  gap: var(--space-1);
}

.planner-step-toggle__copy strong {
  color: var(--text-primary);
}

.planner-step-toggle__state {
  align-self: center;
  white-space: nowrap;
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.planner-step-shell[data-step-state='complete'] .planner-step-toggle__state,
.planner-step-shell[data-step-state='current'] .planner-step-toggle__state {
  color: var(--accent-teal);
}

.planner-step-actions {
  flex-wrap: wrap;
}

.planner-step-actions--split {
  justify-content: space-between;
}

.step-action-button {
  flex: 1;
  min-width: 0;
}

.planner-grid {
  grid-template-columns: 1fr;
  gap: var(--space-5);
}

.trip-planner[data-planner-mode='desktop'] .planner-grid,
.trip-planner[data-planner-mode='desktop'] .planner-step-content,
.trip-planner[data-planner-mode='desktop'] .field-grid,
.trip-planner[data-planner-mode='desktop'] .stop-list,
.trip-planner[data-planner-mode='desktop'] .pace-grid,
.trip-planner[data-planner-mode='desktop'] .chip-grid,
.trip-planner[data-planner-mode='desktop'] .planner-summary,
.trip-planner[data-planner-mode='desktop'] .budget-input-grid {
  gap: var(--space-3);
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
  padding: clamp(var(--space-4), 1.4vw, var(--space-5));
}

.trip-planner[data-planner-mode='desktop'] .planner-card {
  padding: var(--space-4);
  border-radius: var(--radius-xl);
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

.traveler-field {
  align-content: start;
}

.field > span,
.field > label {
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
}

.field-hint {
  color: var(--text-muted);
  font-size: var(--font-size-caption);
  line-height: var(--line-height-normal);
}

.location-field {
  position: relative;
}

.input-shell {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0.2rem 0.95rem;
  border-radius: var(--radius-xl);
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

.input-shell :deep(.scope-icon) {
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

.trip-planner[data-planner-mode='desktop'] .input-shell {
  padding: 0.1rem 0.9rem;
}

.trip-planner[data-planner-mode='desktop'] .input-shell input {
  padding: 0.5rem 0;
}

.field-error {
  color: var(--danger);
  font-size: var(--font-size-small);
}

.location-suggestions {
  position: absolute;
  top: calc(100% - 0.15rem);
  left: 0;
  right: 0;
  z-index: 8;
  display: grid;
  gap: 0.25rem;
  max-height: min(19rem, 48vh);
  overflow-y: auto;
  padding: 0.35rem;
  border-radius: var(--radius-xl);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  background: color-mix(in srgb, var(--bg-primary) 90%, var(--glass-bg));
  box-shadow: var(--shadow-lg);
}

.location-suggestion {
  display: grid;
  gap: 0.2rem;
  width: 100%;
  min-width: 0;
  padding: 0.7rem 0.75rem;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    transform var(--transition-fast);
}

.location-suggestion:hover,
.location-suggestion:focus-visible,
.location-suggestion.active {
  border-color: color-mix(in srgb, var(--accent-teal) 42%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--glass-bg));
  outline: none;
}

.location-suggestion__header,
.location-suggestion__main,
.location-suggestion__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.location-suggestion__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.location-suggestion__main {
  min-width: 0;
  flex: 1 1 auto;
  font-weight: var(--font-weight-semibold);
}

.location-suggestion__badge {
  flex: 0 0 auto;
  padding: 0.14rem 0.45rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 34%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 18%, var(--bg-primary));
  color: var(--accent-teal);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  line-height: 1.2;
}

.location-suggestion__meta,
.location-status {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.location-status {
  padding: 0.7rem 0.75rem;
}

.traveler-control {
  display: grid;
  grid-template-columns: 2.65rem minmax(0, 1fr) 2.65rem;
  align-items: center;
  gap: var(--space-3);
  padding: 0.42rem;
  border-radius: var(--radius-xl);
  border: 1px solid var(--input-border);
  background: var(--bg-secondary);
}

.traveler-step-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.35rem;
  height: 2.35rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 14%, var(--glass-bg));
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
}

.traveler-step-button:hover:not(:disabled),
.traveler-step-button:focus-visible {
  transform: translateY(var(--motion-button-lift));
  border-color: var(--accent-teal);
  background: var(--accent-teal);
  color: var(--bg-primary);
  outline: none;
}

.traveler-step-button:disabled {
  cursor: not-allowed;
  opacity: 0.46;
}

.traveler-step-button :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
}

.traveler-count {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: var(--space-2);
  min-width: 0;
  color: var(--text-primary);
}

.traveler-count strong {
  font-size: var(--font-size-lg);
  line-height: var(--line-height-tight);
}

.traveler-count span {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-medium);
}

.budget-card {
  align-content: start;
}

.budget-input-grid {
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
}

.budget-metric,
.planner-summary {
  padding: var(--space-4);
}

.budget-helper {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  line-height: var(--line-height-normal);
}

.trip-planner[data-planner-mode='desktop'] .budget-metric,
.trip-planner[data-planner-mode='desktop'] .planner-summary {
  padding: var(--space-3);
}

.budget-metric {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
  align-content: start;
}

.budget-input-card {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent-teal) 8%, transparent), transparent 42%),
    var(--glass-bg);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    background var(--transition-fast);
}

.budget-input-card::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  background: linear-gradient(90deg, color-mix(in srgb, var(--accent-teal) 18%, transparent), transparent 58%);
  transition: opacity var(--transition-fast);
}

.budget-input-card__top,
.budget-edit-button,
.budget-control,
.budget-number-field,
.budget-step-button {
  position: relative;
  z-index: 1;
}

.budget-input-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.budget-input-card__top label {
  font-size: var(--font-size-caption);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-eyebrow);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  cursor: pointer;
}

.budget-edit-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.35rem;
  height: 2.35rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 56%, var(--glass-border));
  border-radius: var(--radius-full);
  background:
    radial-gradient(circle at 35% 25%, color-mix(in srgb, var(--text-primary) 18%, transparent), transparent 42%),
    color-mix(in srgb, var(--accent-teal) 20%, var(--bg-secondary));
  color: color-mix(in srgb, var(--accent-teal) 86%, var(--text-primary));
  cursor: pointer;
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--text-primary) 8%, transparent),
    0 0 0 3px color-mix(in srgb, var(--accent-teal) 10%, transparent);
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast),
    color var(--transition-fast);
}

.budget-edit-button:hover,
.budget-edit-button:focus-visible {
  transform: translateY(-1px) scale(1.06);
  border-color: var(--accent-teal);
  background: var(--accent-teal);
  color: var(--bg-primary);
  box-shadow:
    0 0 0 4px color-mix(in srgb, var(--accent-teal) 20%, transparent),
    0 0.9rem 1.75rem color-mix(in srgb, var(--accent-teal) 24%, transparent);
  outline: none;
}

.budget-input-card__top :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
  color: currentColor;
  opacity: 0.78;
  transition:
    opacity var(--transition-fast);
}

.budget-edit-button:hover :deep(.scope-icon),
.budget-edit-button:focus-visible :deep(.scope-icon) {
  opacity: 1;
}

.budget-metric strong {
  font-size: var(--font-size-lg);
  line-height: var(--line-height-tight);
  overflow-wrap: anywhere;
}

.budget-control {
  display: grid;
  grid-template-columns: 2.45rem minmax(0, 1fr) 2.45rem;
  align-items: center;
  gap: 0.65rem;
}

.budget-step-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.45rem;
  height: 2.45rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 28%, var(--glass-border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--bg-secondary));
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.budget-step-button:hover:not(:disabled),
.budget-step-button:focus-visible {
  transform: translateY(var(--motion-button-lift));
  border-color: var(--accent-teal);
  background: var(--accent-teal);
  color: var(--bg-primary);
  box-shadow: 0 0.85rem 1.8rem color-mix(in srgb, var(--accent-teal) 18%, transparent);
  outline: none;
}

.budget-step-button:disabled {
  cursor: not-allowed;
  opacity: 0.44;
}

.budget-step-button :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
}

.budget-number-field {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  height: 2.8rem;
  padding: 0 0.85rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 24%, var(--input-border));
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-primary) 72%, transparent);
  color: var(--text-primary);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);
  cursor: pointer;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text-primary) 5%, transparent);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    background var(--transition-fast);
}

.budget-number-field:hover {
  border-color: color-mix(in srgb, var(--accent-teal) 52%, var(--input-border));
  background: color-mix(in srgb, var(--bg-primary) 82%, var(--accent-teal));
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--accent-teal) 10%, transparent),
    inset 0 0 0 1px color-mix(in srgb, var(--accent-teal) 12%, transparent);
}

.budget-number-field:focus-within {
  border-color: var(--accent-teal);
  background: color-mix(in srgb, var(--bg-primary) 88%, var(--accent-teal));
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--accent-teal) 18%, transparent),
    inset 0 0 0 1px color-mix(in srgb, var(--accent-teal) 16%, transparent);
}

.budget-number-field input {
  width: 100%;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  line-height: inherit;
  appearance: textfield;
  cursor: pointer;
}

.budget-number-field:focus-within input {
  cursor: text;
}

.budget-number-field input::placeholder {
  color: var(--text-muted);
}

.budget-number-field input::-webkit-outer-spin-button,
.budget-number-field input::-webkit-inner-spin-button {
  margin: 0;
  appearance: none;
}

.budget-metric strong,
.planner-summary strong,
.stop-body strong,
.pace-card strong {
  color: var(--text-primary);
}

.stop-section {
  gap: var(--space-3);
}

.trip-planner[data-planner-mode='desktop'] .stop-section {
  gap: var(--space-2);
}

.stop-tools {
  grid-template-columns: minmax(0, 1fr);
}

.stop-search {
  min-width: 0;
}

.stop-copy {
  margin-top: 0;
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

.trip-planner[data-planner-mode='desktop'] .stop-card {
  flex-wrap: nowrap;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-xl);
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

.trip-planner[data-planner-mode='desktop'] .drag-handle,
.trip-planner[data-planner-mode='desktop'] .stop-action {
  width: 2.25rem;
  height: 2.25rem;
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

.trip-planner[data-planner-mode='desktop'] .stop-media {
  width: 4.25rem;
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

.trip-planner[data-planner-mode='desktop'] .stop-body {
  gap: var(--space-1);
}

.stop-heading {
  align-items: flex-start;
}

.trip-planner[data-planner-mode='desktop'] .stop-heading {
  align-items: flex-start;
  flex-wrap: nowrap;
  gap: var(--space-2);
}

.trip-planner[data-planner-mode='desktop'] .stop-heading > div {
  min-width: 0;
}

.stop-heading strong {
  display: block;
  font-size: var(--font-size-h3);
}

.trip-planner[data-planner-mode='desktop'] .stop-heading strong {
  font-size: var(--font-size-lg);
}

.stop-badge {
  align-self: flex-start;
}

.trip-planner[data-planner-mode='desktop'] .stop-badge {
  margin-left: auto;
  white-space: nowrap;
}

.stop-meta,
.stop-notes {
  line-height: var(--line-height-relaxed);
}

.trip-planner[data-planner-mode='desktop'] .stop-meta,
.trip-planner[data-planner-mode='desktop'] .stop-notes {
  line-height: var(--line-height-normal);
}

.pace-grid {
  grid-template-columns: repeat(auto-fit, minmax(11.5rem, 1fr));
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

.trip-planner[data-planner-mode='desktop'] .pace-card {
  padding: var(--space-3);
}

.pace-card.active {
  border-color: var(--accent-teal);
  box-shadow: var(--shadow-glow-teal);
}

.chip-grid {
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
}

.interest-chip {
  --interest-bg: var(--badge-other-bg);
  --interest-fg: var(--badge-other-fg);

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  padding: 0.85rem 0.95rem;
  border-width: 2px;
  border-radius: var(--radius-xl);
  border-color: color-mix(in srgb, var(--interest-fg) 32%, var(--glass-border));
  background: color-mix(in srgb, var(--interest-bg) 28%, var(--glass-bg));
  color: color-mix(in srgb, var(--interest-fg) 82%, var(--text-primary));
  font-weight: var(--font-weight-semibold);
  opacity: 0.78;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    opacity var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
}

.interest-chip.badge-food {
  --interest-bg: var(--badge-food-bg);
  --interest-fg: var(--badge-food-fg);
}

.interest-chip.badge-nature {
  --interest-bg: var(--badge-nature-bg);
  --interest-fg: var(--badge-nature-fg);
}

.interest-chip.badge-nightlife {
  --interest-bg: var(--badge-nightlife-bg);
  --interest-fg: var(--badge-nightlife-fg);
}

.interest-chip.badge-culture {
  --interest-bg: var(--badge-culture-bg);
  --interest-fg: var(--badge-culture-fg);
}

.interest-chip.badge-adventure {
  --interest-bg: var(--badge-adventure-bg);
  --interest-fg: var(--badge-adventure-fg);
}

.interest-chip.badge-shopping {
  --interest-bg: var(--badge-shopping-bg);
  --interest-fg: var(--badge-shopping-fg);
}

.interest-chip.badge-scenic {
  --interest-bg: var(--badge-scenic-bg);
  --interest-fg: var(--badge-scenic-fg);
}

.interest-chip.badge-other {
  --interest-bg: var(--badge-other-bg);
  --interest-fg: var(--badge-other-fg);
}

.trip-planner[data-planner-mode='desktop'] .interest-chip {
  padding: 0.72rem 0.85rem;
}

.interest-chip.active,
.interest-chip:hover,
.interest-chip:focus-visible {
  opacity: 1;
  transform: translateY(var(--motion-chip-active-lift));
  box-shadow: var(--shadow-md);
  outline: none;
}

.interest-chip :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
}

.planner-footer {
  align-items: center;
  padding-top: var(--space-2);
  border-top: 1px solid color-mix(in srgb, var(--glass-border) 70%, transparent);
}

.planner-footer--mobile {
  align-items: stretch;
}

.planner-footer-copy {
  flex: 1 1 18rem;
  min-width: 0;
  gap: 0.35rem;
}

.planner-footer-copy strong {
  display: -webkit-box;
  color: var(--text-primary);
  font-size: var(--font-size-body);
  line-height: var(--line-height-tight);
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.planner-footer-copy small {
  font-size: var(--font-size-small);
  line-height: var(--line-height-normal);
}

.planner-summary {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.trip-planner[data-planner-mode='desktop'] .planner-summary {
  grid-template-columns: 1fr;
}

.planner-summary span {
  display: block;
  font-size: var(--font-size-small);
}

.planner-summary strong {
  overflow-wrap: anywhere;
}

.planner-footer-actions {
  flex-wrap: wrap;
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

.interest-chip.active {
  border-color: color-mix(in srgb, var(--text-primary) 86%, var(--interest-fg));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--interest-fg) 13%, var(--interest-bg)), var(--interest-bg));
  color: var(--text-primary);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--text-primary) 22%, transparent),
    0 0.8rem 1.8rem color-mix(in srgb, var(--interest-bg) 58%, transparent);
}

.interest-chip:hover:not(.active),
.interest-chip:focus-visible:not(.active) {
  border-color: color-mix(in srgb, var(--text-primary) 72%, var(--interest-fg));
  background: color-mix(in srgb, var(--interest-bg) 52%, var(--glass-bg));
  color: var(--text-primary);
}

.trip-planner[data-planner-mode='desktop'] .submit-button {
  min-width: 14rem;
  padding: 0.8rem 1.15rem;
}

.submit-button[data-onboarding-active='true'] {
  box-shadow:
    var(--shadow-sm),
    0 0 0 1px color-mix(in srgb, var(--text-primary) 12%, transparent);
}

.submit-button:hover:not(:disabled),
.submit-button:focus-visible,
.submit-button[data-onboarding-active='true'] {
  transform: translateY(var(--motion-card-lift));
  background: var(--accent-teal-hover);
  box-shadow: var(--shadow-sm);
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
  .stop-heading,
  .planner-step-actions,
  .planner-footer-actions {
    flex-direction: column;
    align-items: flex-start;
  }

  .panel-heading > div {
    width: 100%;
    flex-basis: auto;
  }

  .budget-input-grid,
  .pace-grid,
  .chip-grid {
    grid-template-columns: 1fr;
  }

  .submit-button,
  .step-action-button {
    width: 100%;
    min-width: 0;
  }

  .planner-footer-copy {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .trip-planner[data-planner-mode='mobile-wizard'] {
    padding: var(--space-4);
    gap: var(--space-5);
  }

  .trip-planner[data-planner-mode='mobile-wizard'] .planner-step-toggle {
    border-radius: var(--radius-xl);
  }

  .trip-planner[data-planner-mode='mobile-wizard'] .planner-card {
    padding: var(--space-4);
  }

  .trip-planner[data-planner-mode='mobile-wizard'] .planner-step-actions,
  .trip-planner[data-planner-mode='mobile-wizard'] .planner-footer-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .trip-planner[data-planner-mode='mobile-wizard'] .planner-summary {
    grid-template-columns: 1fr;
  }

  .trip-planner[data-planner-mode='mobile-wizard'] .submit-button,
  .trip-planner[data-planner-mode='mobile-wizard'] .step-action-button {
    width: 100%;
    min-width: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .input-shell,
  .location-suggestion,
  .stop-card,
  .stop-image,
  .drag-handle,
  .stop-action,
  .pace-card,
  .interest-chip,
  .planner-summary,
  .submit-button,
  .planner-step-toggle {
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
  .submit-button[data-onboarding-active='true'],
  .interest-chip:hover,
  .interest-chip:focus-visible,
  .interest-chip.active,
  .drag-handle:hover,
  .stop-action:hover:not(:disabled),
  .stop-action:focus-visible,
  .planner-step-toggle:hover,
  .planner-step-toggle:focus-visible {
    transform: none;
  }

  .stop-card:hover .stop-image,
  .stop-card:focus-within .stop-image {
    transform: none;
  }
}
</style>
