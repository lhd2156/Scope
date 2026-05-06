<template>
  <section
    class="glass-panel itinerary-stage"
    data-test="itinerary-view"
    data-onboarding-target="itinerary-stage"
    :data-itinerary-mode="mobileWizard ? 'mobile-wizard' : 'desktop'"
  >
    <div class="itinerary-step-shell" :data-step-state="getWizardStepState(4)">
      <button
        v-if="mobileWizard"
        type="button"
        class="itinerary-step-toggle"
        data-test="planner-step-4-toggle"
        data-onboarding-target="planner-preview-toggle"
        :aria-expanded="String(isWizardStepActive(4))"
        aria-controls="planner-step-4-content"
        @click="emitWizardStepChange(4)"
      >
        <span class="itinerary-step-toggle__index">4</span>
        <span class="itinerary-step-toggle__copy">
          <span class="eyebrow">Step 4</span>
          <strong>AI preview</strong>
          <span>{{ stepSummary }}</span>
        </span>
        <span class="itinerary-step-toggle__state">{{ getWizardStepLabel(4) }}</span>
      </button>

      <div
        id="planner-step-4-content"
        class="itinerary-step-content"
        data-test="planner-step-4-content"
        v-show="!mobileWizard || isWizardStepActive(4)"
      >
        <div class="map-shell" :class="{ 'map-shell--planning': !itinerary }">
          <MapView
            v-if="shouldRenderMap"
            :spots="displayMapSpots"
            :route-points="displayMapSpots"
            :show-location-tracker="false"
            :show-summary="false"
            :show-controls="true"
            :show-fit-route-control="false"
            :show-place-labels="true"
            :click-to-select="isMapPickModeEnabled"
            :initial-viewport="initialMapViewport"
            :optimize-route-order="shouldOptimizeRouteOrder"
            marker-variant="sequence"
            route-variant="planner"
            @map-click="handleRouteMapClick"
          />
          <div v-else class="map-shell__placeholder" aria-hidden="true" />
          <div class="map-vignette" />
        </div>

        <section class="itinerary-detail-panel" :data-detail-state="itinerary ? 'built' : 'draft'" aria-label="Trip map planning details">

          <template v-if="itinerary">
          <header class="overlay-card summary-card planning-card planning-card--built" data-test="itinerary-summary-card">
            <div class="planning-card__header">
              <p class="eyebrow">Scope AI handoff</p>
              <h2>AI-ready route</h2>
              <p class="summary-copy">{{ handoffSummaryCopy }}</p>
            </div>

            <div class="planning-route-brief" data-test="itinerary-route-brief">
              <article class="planning-endpoint-card planning-endpoint-card--start">
                <span class="route-point-badge">S</span>
                <span>
                  <small>Start</small>
                  <strong>{{ routeBriefStartLabel }}</strong>
                </span>
              </article>
              <div class="planning-route-connector" aria-hidden="true">
                <span />
                <span />
              </div>
              <article class="planning-endpoint-card planning-endpoint-card--end">
                <span class="route-point-badge">E</span>
                <span>
                  <small>End</small>
                  <strong>{{ routeBriefEndLabel }}</strong>
                </span>
              </article>
            </div>

            <div class="summary-metrics planning-metrics">
              <span class="summary-pill" data-test="itinerary-summary-days">
                <small>Days</small>
                <strong>{{ handoffDaysLabel }}</strong>
              </span>
              <span class="summary-pill">
                <small>Pace</small>
                <strong>{{ draftPaceLabel }}</strong>
              </span>
              <span class="summary-pill" data-test="itinerary-summary-stops">
                <small>Stops</small>
                <strong>{{ handoffStopCountLabel }}</strong>
              </span>
              <span class="summary-pill summary-pill--accent" data-test="itinerary-summary-cost">
                <small>Budget</small>
                <strong>{{ handoffBudgetLabel }}</strong>
              </span>
            </div>
          </header>

          <aside class="overlay-card route-signal-card planning-route-card" data-test="itinerary-route-edit-card">
            <header class="route-card-header">
              <div>
                <p class="eyebrow">Route canvas</p>
                <h3>Shape the route Scope AI will build</h3>
              </div>
            </header>

            <div v-if="showRouteMetrics" class="route-signal-grid route-signal-grid--planning">
              <span>
                <strong>{{ routeDistanceLabel }}</strong>
                <small>miles</small>
              </span>
              <span>
                <strong>{{ routeEtaLabel }}</strong>
                <small>ETA</small>
              </span>
            </div>

            <div class="map-picker-actions" data-test="itinerary-map-picker" role="group" aria-label="Pick route points from the map">
              <button
                type="button"
                class="map-picker-button"
                data-test="map-pick-start"
                :class="{ active: isMapPickModeEnabled && activeMapPickTarget === 'destination' }"
                :aria-pressed="String(isMapPickModeEnabled && activeMapPickTarget === 'destination')"
                :title="activeMapPickTarget === 'destination' && isMapPickModeEnabled ? mapPickStatusCopy : 'Pick start on map'"
                @click="setMapPickTarget('destination')"
              >
                <ScopeIcon name="cursor" label="Pick start on map" />
                <span>Start</span>
              </button>
              <button
                type="button"
                class="map-picker-button"
                data-test="map-pick-stop"
                :class="{ active: isMapPickModeEnabled && activeMapPickTarget === 'routeStop' }"
                :aria-pressed="String(isMapPickModeEnabled && activeMapPickTarget === 'routeStop')"
                :title="activeMapPickTarget === 'routeStop' && isMapPickModeEnabled ? mapPickStatusCopy : 'Add stop from map'"
                @click="setMapPickTarget('routeStop')"
              >
                <ScopeIcon name="plus" label="Add stop from map" />
                <span>Stop</span>
              </button>
              <button
                type="button"
                class="map-picker-button"
                data-test="map-pick-end"
                :class="{ active: isMapPickModeEnabled && activeMapPickTarget === 'endDestination' }"
                :aria-pressed="String(isMapPickModeEnabled && activeMapPickTarget === 'endDestination')"
                :title="activeMapPickTarget === 'endDestination' && isMapPickModeEnabled ? mapPickStatusCopy : 'Pick end on map'"
                @click="setMapPickTarget('endDestination')"
              >
                <ScopeIcon name="pin" label="Pick end on map" />
                <span>End</span>
              </button>
              <button
                type="button"
                class="map-picker-button"
                data-test="map-pick-done"
                :disabled="!isMapPickModeEnabled"
                title="Stop picking from map"
                @click="clearMapPickTarget"
              >
                <ScopeIcon name="route" label="Stop picking from map" />
                <span>Done</span>
              </button>
            </div>

            <p class="map-picker-status" :class="{ visible: isMapPickModeEnabled || mapPickState === 'error' }" aria-live="polite">
              {{ mapPickStatusCopy }}
            </p>

            <div v-if="draftRouteSequence.length" class="route-sequence-list" data-test="itinerary-route-sequence-list" aria-label="Current route points">
              <div
                v-for="point in draftRouteSequence"
                :key="point.id"
                class="route-sequence-chip"
                :data-route-role="point.routeRole ?? 'stop'"
              >
                <strong>{{ point.routeLabel }}</strong>
                <span>{{ formatLocationPreview(point.title) }}</span>
                <button
                  v-if="isDraftStopPoint(point)"
                  type="button"
                  :aria-label="`Remove ${point.title}`"
                  @click="removeDraftRouteStop(point.id)"
                >
                  <ScopeIcon name="close" label="Remove stop" />
                </button>
              </div>
            </div>
          </aside>

          <section v-if="editableTimelineDays.length" class="overlay-card timeline-overlay" data-test="itinerary-timeline-overlay">
            <header class="timeline-header">
              <div>
                <p class="eyebrow">Day by day</p>
                <h3>Trip schedule</h3>
              </div>
              <span class="summary-pill">Avg {{ currencyFormatter.format(averageDailyCost) }}</span>
            </header>

            <TransitionGroup name="timeline-day" tag="div" class="timeline-rail">
              <article
                v-for="day in editableTimelineDays"
                :key="day.dayNumber"
                class="timeline-card"
                data-test="itinerary-day-card"
                :data-day-number="day.dayNumber"
              >
                <div class="timeline-body">
                  <div class="timeline-day-heading">
                    <div>
                      <span class="day-pill">Day {{ day.dayNumber }}</span>
                      <h4>{{ formatWeekdayMonthDay(day.date) }}</h4>
                    </div>
                    <span class="timeline-cost">{{ currencyFormatter.format(getTimelineDayCost(day)) }}</span>
                  </div>
                  <TransitionGroup name="timeline-stop" tag="ol" class="stop-list">
                    <li
                      v-for="spot in day.spots"
                      :key="spot.spotId"
                      class="stop-item"
                      :data-route-role="spot.timelineRouteRole ?? 'stop'"
                      :data-spot-id="spot.spotId"
                    >
                      <span class="timeline-stop-badge" :data-route-role="spot.timelineRouteRole ?? 'stop'">{{ getTimelineSpotBadgeText(spot) }}</span>
                      <div class="stop-copy">
                        <strong>{{ spot.title }}</strong>
                        <small>
                          {{ formatTimelineSpotMeta(spot) }}
                        </small>
                      </div>
                      <div class="timeline-stop-controls">
                        <label class="timeline-edit-field">
                          <span>Day</span>
                          <input
                            type="text"
                            inputmode="numeric"
                            pattern="[0-9]*"
                            maxlength="2"
                            :value="spot.dayNumber ?? day.dayNumber"
                            data-test="itinerary-stop-day-input"
                            @focus="selectTimelineInputText"
                            @dblclick="selectTimelineInputText"
                            @change="handleTimelineDayChange(spot.spotId, $event)"
                          />
                        </label>
                        <label class="timeline-edit-field">
                          <span>Time</span>
                          <input
                            type="text"
                            inputmode="numeric"
                            pattern="^[0-9]{1,2}:[0-9]{2}$"
                            maxlength="5"
                            :value="normalizeTimeSlot(spot.timeSlot)"
                            data-test="itinerary-stop-time-input"
                            @focus="selectTimelineInputText"
                            @dblclick="selectTimelineInputText"
                            @change="handleTimelineTimeChange(spot.spotId, $event)"
                          />
                        </label>
                      </div>
                    </li>
                  </TransitionGroup>
                </div>
              </article>
            </TransitionGroup>
          </section>

          <div v-if="submitting" class="overlay-card loading-card">Refreshing itinerary preview…</div>
        </template>

          <template v-else>
          <header class="overlay-card summary-card planning-card" data-test="itinerary-planning-card">
            <div class="planning-card__header">
              <p class="eyebrow">Scope AI handoff</p>
              <h2>AI-ready route</h2>
              <p class="summary-copy">{{ planningDraftStatus }} Hand it to Scope AI when you want the live itinerary.</p>
            </div>

            <div class="planning-route-brief" data-test="planning-route-brief">
              <article class="planning-endpoint-card planning-endpoint-card--start">
                <span class="route-point-badge">S</span>
                <span>
                  <small>Start</small>
                  <strong>{{ routeBriefStartLabel }}</strong>
                </span>
              </article>
              <div class="planning-route-connector" aria-hidden="true">
                <span />
                <span />
              </div>
              <article class="planning-endpoint-card planning-endpoint-card--end">
                <span class="route-point-badge">E</span>
                <span>
                  <small>End</small>
                  <strong>{{ routeBriefEndLabel }}</strong>
                </span>
              </article>
            </div>

            <div class="summary-metrics planning-metrics">
              <span class="summary-pill">
                <small>Days</small>
                <strong>{{ draftDaysLabel }}</strong>
              </span>
              <span class="summary-pill">
                <small>Pace</small>
                <strong>{{ draftPaceLabel }}</strong>
              </span>
              <span class="summary-pill">
                <small>Stops</small>
                <strong>{{ draftStopCountLabel }}</strong>
              </span>
              <span class="summary-pill summary-pill--accent">
                <small>Budget</small>
                <strong>{{ draftBudgetLabel }}</strong>
              </span>
            </div>
          </header>

          <aside class="overlay-card route-signal-card planning-route-card" data-test="itinerary-route-card">
            <header class="route-card-header">
              <div>
                <p class="eyebrow">Route canvas</p>
                <h3>Shape the route Scope AI will build</h3>
              </div>
            </header>

            <div v-if="showRouteMetrics" class="route-signal-grid route-signal-grid--planning">
              <span>
                <strong>{{ routeDistanceLabel }}</strong>
                <small>miles</small>
              </span>
              <span>
                <strong>{{ routeEtaLabel }}</strong>
                <small>ETA</small>
              </span>
            </div>

            <div v-else class="route-signal-grid route-signal-grid--planning route-signal-grid--placeholder" data-test="route-canvas-placeholder">
              <span>
                <strong>Add start</strong>
                <small>miles</small>
              </span>
              <span>
                <strong>Add end</strong>
                <small>ETA</small>
              </span>
            </div>

            <div class="map-picker-actions" data-test="itinerary-map-picker" role="group" aria-label="Pick route points from the map">
              <button
                type="button"
                class="map-picker-button"
                data-test="map-pick-start"
                :class="{ active: isMapPickModeEnabled && activeMapPickTarget === 'destination' }"
                :aria-pressed="String(isMapPickModeEnabled && activeMapPickTarget === 'destination')"
                :title="activeMapPickTarget === 'destination' && isMapPickModeEnabled ? mapPickStatusCopy : 'Pick start on map'"
                @click="setMapPickTarget('destination')"
              >
                <ScopeIcon name="cursor" label="Pick start on map" />
                <span>Start</span>
              </button>
              <button
                type="button"
                class="map-picker-button"
                data-test="map-pick-stop"
                :class="{ active: isMapPickModeEnabled && activeMapPickTarget === 'routeStop' }"
                :aria-pressed="String(isMapPickModeEnabled && activeMapPickTarget === 'routeStop')"
                :title="activeMapPickTarget === 'routeStop' && isMapPickModeEnabled ? mapPickStatusCopy : 'Add stop from map'"
                @click="setMapPickTarget('routeStop')"
              >
                <ScopeIcon name="plus" label="Add stop from map" />
                <span>Stop</span>
              </button>
              <button
                type="button"
                class="map-picker-button"
                data-test="map-pick-end"
                :class="{ active: isMapPickModeEnabled && activeMapPickTarget === 'endDestination' }"
                :aria-pressed="String(isMapPickModeEnabled && activeMapPickTarget === 'endDestination')"
                :title="activeMapPickTarget === 'endDestination' && isMapPickModeEnabled ? mapPickStatusCopy : 'Pick end on map'"
                @click="setMapPickTarget('endDestination')"
              >
                <ScopeIcon name="pin" label="Pick end on map" />
                <span>End</span>
              </button>
              <button
                type="button"
                class="map-picker-button"
                data-test="map-pick-done"
                :disabled="!isMapPickModeEnabled"
                title="Stop picking from map"
                @click="clearMapPickTarget"
              >
                <ScopeIcon name="route" label="Stop picking from map" />
                <span>Done</span>
              </button>
            </div>

            <p class="map-picker-status" :class="{ visible: isMapPickModeEnabled || mapPickState === 'error' }" aria-live="polite">
              {{ mapPickStatusCopy }}
            </p>

            <div v-if="draftRouteSequence.length" class="route-sequence-list" data-test="route-sequence-list" aria-label="Draft route points">
              <div
                v-for="point in draftRouteSequence"
                :key="point.id"
                class="route-sequence-chip"
                :data-route-role="point.routeRole ?? 'stop'"
              >
                <strong>{{ point.routeLabel }}</strong>
                <span>{{ formatLocationPreview(point.title) }}</span>
                <button
                  v-if="isDraftStopPoint(point)"
                  type="button"
                  :aria-label="`Remove ${point.title}`"
                  @click="removeDraftRouteStop(point.id)"
                >
                  <ScopeIcon name="close" label="Remove stop" />
                </button>
              </div>
            </div>

            <section v-if="routePlaceAnchors.length && routePlacePanelVisible" class="route-place-panel" data-test="route-place-panel">
              <header class="route-place-panel__header">
                <div>
                  <p class="eyebrow">Nearby places</p>
                  <h4>{{ routePlacePanelTitle }}</h4>
                </div>
                <button
                  type="button"
                  class="route-place-refresh"
                  :disabled="routePlaceSuggestionsLoading"
                  data-test="route-place-refresh"
                  @click="loadRoutePlaceSuggestions"
                >
                  <ScopeIcon name="reset" label="Refresh nearby places" />
                </button>
              </header>

              <div v-if="routePlaceAnchors.length > 1" class="route-place-tabs" role="tablist" aria-label="Nearby place focus">
                <button
                  v-for="anchor in routePlaceAnchors"
                  :key="anchor.id"
                  type="button"
                  class="route-place-tab"
                  :class="{ active: selectedRoutePlaceAnchor?.id === anchor.id }"
                  :aria-selected="String(selectedRoutePlaceAnchor?.id === anchor.id)"
                  role="tab"
                  @click="selectedRoutePlacePointId = anchor.id"
                >
                  <strong>{{ anchor.routeLabel }}</strong>
                  <span>{{ formatLocationPreview(anchor.title) }}</span>
                </button>
              </div>

              <div class="route-place-results" :data-place-state="routePlaceSuggestionsState" data-test="route-place-suggestions">
                <p v-if="routePlaceSuggestionsLoading" class="route-place-state">Finding nearby places...</p>
                <p v-else-if="routePlaceSuggestionsError" class="route-place-state route-place-state--error">{{ routePlaceSuggestionsError }}</p>
                <div v-else-if="availableRoutePlaceSuggestions.length" class="route-place-list">
                  <button
                    v-for="place in availableRoutePlaceSuggestions"
                    :key="place.id"
                    type="button"
                    class="route-place-card"
                    data-test="route-place-add"
                    :data-place-id="place.id"
                    @click="addSuggestedRoutePlace(place)"
                  >
                    <span class="route-place-card__media">
                      <LazyImage
                        :src="resolveRoutePlacePhoto(place)"
                        :fallback-src="getSpotPhotoFallback(place.category, ROUTE_PLACE_IMAGE_WIDTH)"
                        :alt="place.title"
                        class="route-place-card__image"
                      />
                    </span>
                    <span class="route-place-card__copy">
                      <strong>{{ place.title }}</strong>
                      <small>{{ formatRoutePlaceMeta(place) }}</small>
                    </span>
                    <span class="route-place-card__add" aria-hidden="true">
                      <ScopeIcon name="plus" label="Add nearby place" />
                    </span>
                  </button>
                </div>
              </div>
            </section>

          </aside>

            <section
              v-if="editableTimelineDays.length"
              class="overlay-card timeline-overlay timeline-overlay--draft"
              data-test="itinerary-timeline-overlay"
            >
              <header class="timeline-header">
                <div>
                  <p class="eyebrow">Day by day</p>
                  <h3>Trip schedule</h3>
                </div>
                <span class="summary-pill">Avg {{ currencyFormatter.format(averageDailyCost) }}</span>
              </header>

              <TransitionGroup name="timeline-day" tag="div" class="timeline-rail">
                <article
                  v-for="day in editableTimelineDays"
                  :key="day.dayNumber"
                  class="timeline-card"
                  data-test="itinerary-day-card"
                  :data-day-number="day.dayNumber"
                >
                  <div class="timeline-body">
                    <div class="timeline-day-heading">
                      <div>
                        <span class="day-pill">Day {{ day.dayNumber }}</span>
                        <h4>{{ formatWeekdayMonthDay(day.date) }}</h4>
                      </div>
                      <span class="timeline-cost">{{ currencyFormatter.format(getTimelineDayCost(day)) }}</span>
                    </div>
                    <TransitionGroup name="timeline-stop" tag="ol" class="stop-list">
                      <li
                        v-for="spot in day.spots"
                        :key="spot.spotId"
                        class="stop-item"
                        :data-route-role="spot.timelineRouteRole ?? 'stop'"
                        :data-spot-id="spot.spotId"
                      >
                        <span class="timeline-stop-badge" :data-route-role="spot.timelineRouteRole ?? 'stop'">{{ getTimelineSpotBadgeText(spot) }}</span>
                        <div class="stop-copy">
                          <strong>{{ spot.title }}</strong>
                          <small>
                            {{ formatTimelineSpotMeta(spot) }}
                          </small>
                        </div>
                        <div class="timeline-stop-controls">
                          <label class="timeline-edit-field">
                            <span>Day</span>
                            <input
                              type="text"
                              inputmode="numeric"
                              pattern="[0-9]*"
                              maxlength="2"
                              :value="spot.dayNumber ?? day.dayNumber"
                              data-test="itinerary-stop-day-input"
                              @focus="selectTimelineInputText"
                              @dblclick="selectTimelineInputText"
                              @change="handleTimelineDayChange(spot.spotId, $event)"
                            />
                          </label>
                          <label class="timeline-edit-field">
                            <span>Time</span>
                            <input
                              type="text"
                              inputmode="numeric"
                              pattern="^[0-9]{1,2}:[0-9]{2}$"
                              maxlength="5"
                              :value="normalizeTimeSlot(spot.timeSlot)"
                              data-test="itinerary-stop-time-input"
                              @focus="selectTimelineInputText"
                              @dblclick="selectTimelineInputText"
                              @change="handleTimelineTimeChange(spot.spotId, $event)"
                            />
                          </label>
                        </div>
                      </li>
                    </TransitionGroup>
                  </div>
                </article>
              </TransitionGroup>
            </section>
          </template>
        </section>

        <div v-if="mobileWizard" class="itinerary-step-actions">
          <button type="button" class="button button-secondary" data-test="planner-step-4-back" @click="emitWizardStepChange(3)">
            Adjust planner details
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import LazyImage from '@/components/common/LazyImage.vue';
import { reverseGeocode, type GeocodeResult } from '@/services/mapService';
import { resolveRoadRoute, type RoadRouteSummary } from '@/services/roadRouteService';
import { listNearbySpots } from '@/services/spotService';
import { addCalendarDays, formatWeekdayMonthDay, getInclusiveDaySpan } from '@/utils/formatters';
import type { Itinerary, MapPoint, MapViewport, SpotSummary, TripMember, TripPlannerInput, TripSpot } from '@/types';
import { getSpotPhotoFallback, resolveTripStopPhotoUrl } from '@/utils/demoPhotos';
import { scheduleNonCriticalTask, type CancelScheduledTask } from '@/utils/scheduleNonCriticalTask';

type PlannerWizardStep = 1 | 2 | 3 | 4;
type LocationPickTarget = 'destination' | 'endDestination';
type MapPickTarget = 'destination' | 'routeStop' | 'endDestination';
type MapPickState = 'idle' | 'armed' | 'locating' | 'error';
type RouteSequencePoint = Pick<MapPoint, 'id' | 'title' | 'routeRole' | 'routeLabel'>;
type TimelineRouteRole = 'start' | 'stop' | 'end';

type TimelineTripSpot = TripSpot & {
  timelineRouteLabel?: string;
  timelineRouteRole?: TimelineRouteRole;
  isTimelineEndpoint?: boolean;
};

interface EditableTimelineDay {
  dayNumber: number;
  date: string;
  spots: TimelineTripSpot[];
}

interface PlannerMapLocationSelection {
  target: LocationPickTarget;
  label: string;
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
}

const props = withDefaults(
  defineProps<{
    itinerary: Itinerary | null;
    draft?: Partial<TripPlannerInput>;
    tripTitle?: string;
    members?: TripMember[];
    stops?: TripSpot[];
    initialMapViewport?: MapViewport;
    submitting?: boolean;
    mobileWizard?: boolean;
    mobileActiveStep?: PlannerWizardStep;
  }>(),
  {
    draft: () => ({}),
    tripTitle: '',
    members: () => [],
    stops: () => [],
    submitting: false,
    mobileWizard: false,
    mobileActiveStep: 4 as PlannerWizardStep,
  },
);

const emit = defineEmits<{
  (event: 'wizard-step-change', payload: PlannerWizardStep): void;
  (event: 'map-location-select', payload: PlannerMapLocationSelection): void;
  (event: 'route-stop-add', payload: TripSpot): void;
  (event: 'route-stop-remove', payload: string): void;
  (event: 'itinerary-stops-update', payload: TripSpot[]): void;
}>();

const MapView = defineAsyncComponent(() => import('@/components/map/MapView.vue'));
const shouldRenderMap = ref(false);
const activeMapPickTarget = ref<MapPickTarget>('destination');
const mapPickState = ref<MapPickState>('idle');
const routeSummary = ref<RoadRouteSummary | null>(null);
const routeSummaryKey = ref('');
const selectedRoutePlacePointId = ref('');
const routePlaceSuggestions = ref<SpotSummary[]>([]);
const routePlaceSuggestionsLoading = ref(false);
const routePlaceSuggestionsError = ref('');
const timelineEndpointOverrides = ref<Record<string, Partial<Pick<TripSpot, 'dayNumber' | 'timeSlot'>>>>({});
const hasManualTimelineOrder = ref(false);
let cancelMapRender: CancelScheduledTask = () => undefined;
let routeSummaryRequestId = 0;
let routePlaceSuggestionsRequestId = 0;

const METERS_PER_MILE = 1609.344;
const ROUTE_PLACE_RADIUS_KM = 80;
const ROUTE_PLACE_LIMIT = 6;
const ROUTE_PLACE_IMAGE_WIDTH = 320;
const ITINERARY_DAY_IMAGE_WIDTH = 800;
const MAX_REASONABLE_TIMELINE_DAYS = 30;
const TIMELINE_START_TIME_SLOT = '08:30';
const TIMELINE_END_TIME_SLOT = '18:00';
const DEFAULT_TIMELINE_TIME_SLOTS = ['10:00', '13:00', '16:00'];
const TIMELINE_START_ENDPOINT_ID = 'timeline-endpoint-start';
const TIMELINE_END_ENDPOINT_ID = 'timeline-endpoint-end';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const paceLabelByValue: Record<TripPlannerInput['pace'], string> = {
  relaxed: 'Relaxed pace',
  moderate: 'Moderate pace',
  packed: 'Packed pace',
};

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
      return 'Preview';
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

function setMapPickTarget(target: MapPickTarget): void {
  activeMapPickTarget.value = target;
  mapPickState.value = 'armed';
}

function clearMapPickTarget(): void {
  mapPickState.value = 'idle';
}

function formatGeocodeSelection(result: GeocodeResult, fallback: { latitude: number; longitude: number }): string {
  if (result.precision === 'coordinate') {
    return result.formattedAddress || `${fallback.latitude.toFixed(4)}, ${fallback.longitude.toFixed(4)}`;
  }

  const addressLabel = result.formattedAddress || result.address;
  if (addressLabel) {
    return addressLabel;
  }

  const cityCountryLabel = [result.city, result.country].filter(Boolean).join(', ');
  if (cityCountryLabel) {
    return cityCountryLabel;
  }

  if (result.placeName) {
    return result.placeName;
  }

  return `${fallback.latitude.toFixed(4)}, ${fallback.longitude.toFixed(4)}`;
}

async function handleRouteMapClick(payload: { latitude: number; longitude: number }): Promise<void> {
  if (!isMapPickModeEnabled.value || mapPickState.value === 'locating') {
    return;
  }

  const selectedTarget = activeMapPickTarget.value;
  mapPickState.value = 'locating';

  try {
    const result = await reverseGeocode(payload.latitude, payload.longitude);
    if (selectedTarget === 'routeStop') {
      emit('route-stop-add', buildRouteStopFromGeocode(result, payload));
      activeMapPickTarget.value = 'routeStop';
      mapPickState.value = 'armed';
      return;
    }

    emit('map-location-select', {
      target: selectedTarget,
      label: formatGeocodeSelection(result, payload),
      latitude: payload.latitude,
      longitude: payload.longitude,
      city: result.city,
      country: result.country,
    });
    activeMapPickTarget.value = selectedTarget === 'destination' ? 'endDestination' : 'destination';
    mapPickState.value = 'armed';
  } catch {
    mapPickState.value = 'error';
  }
}

function buildRouteStopFromGeocode(result: GeocodeResult, fallback: { latitude: number; longitude: number }): TripSpot {
  const title = formatGeocodeSelection(result, fallback);
  const timestamp = Date.now().toString(36);
  const latitudeKey = Math.abs(Math.round(fallback.latitude * 10_000)).toString(36);
  const longitudeKey = Math.abs(Math.round(fallback.longitude * 10_000)).toString(36);

  return {
    spotId: `route-stop-${timestamp}-${latitudeKey}-${longitudeKey}`,
    title,
    latitude: fallback.latitude,
    longitude: fallback.longitude,
    category: 'other',
    city: result.city,
    duration: 45,
    notes: 'Added from the route map.',
  };
}

function getTimelineDayCost(day: EditableTimelineDay): number {
  return day.spots.reduce((total, spot) => total + (spot.estimatedCost ?? 0), 0);
}

function normalizeTimeSlot(value: string | undefined, fallbackIndex = 0): string {
  const trimmedValue = value?.trim() ?? '';
  const timeMatch = /^(\d{1,2}):([0-5]\d)$/.exec(trimmedValue);
  if (timeMatch) {
    const hour = Number.parseInt(timeMatch[1] ?? '', 10);
    const minutes = timeMatch[2] ?? '00';
    if (hour >= 0 && hour <= 23) {
      return `${String(hour).padStart(2, '0')}:${minutes}`;
    }
  }

  return DEFAULT_TIMELINE_TIME_SLOTS[fallbackIndex % DEFAULT_TIMELINE_TIME_SLOTS.length] ?? '09:00';
}

function clampTimelineDayNumber(value: number, maxDay = MAX_REASONABLE_TIMELINE_DAYS): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(Math.max(1, maxDay), Math.max(1, Math.round(value)));
}

function getDraftTimelineDaySpan(): number {
  const startDate = props.draft?.startDate ?? '';
  const endDate = props.draft?.endDate ?? startDate;
  return startDate ? getInclusiveDaySpan(startDate, endDate) : Math.max(1, props.itinerary?.days.length ?? 1);
}

function formatCoordinateLabel(latitude: number | undefined, longitude: number | undefined): string {
  if (!hasCoordinatePair(latitude, longitude)) {
    return '';
  }

  return `${Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)}`;
}

function getTimelineEndpointTitle(role: 'start' | 'end'): string {
  const latitude = role === 'start' ? props.draft?.destinationLatitude : props.draft?.endDestinationLatitude;
  const longitude = role === 'start' ? props.draft?.destinationLongitude : props.draft?.endDestinationLongitude;
  const typedLabel = role === 'start' ? draftDestination.value : draftEndDestination.value;
  const fallbackLabel = role === 'start' ? 'Choose start' : 'Choose end';
  return formatDisplayLocation(typedLabel || formatCoordinateLabel(latitude, longitude), fallbackLabel);
}

function buildTimelineEndpointStop(role: 'start' | 'end'): TimelineTripSpot | null {
  const isStart = role === 'start';
  const latitude = isStart ? props.draft?.destinationLatitude : props.draft?.endDestinationLatitude;
  const longitude = isStart ? props.draft?.destinationLongitude : props.draft?.endDestinationLongitude;
  const hasExplicitEndpoint = isStart ? hasExplicitDraftStart.value : hasExplicitDraftEnd.value;
  const hasTypedEndpoint = Boolean(isStart ? draftDestination.value : draftEndDestination.value);

  if (!hasExplicitEndpoint && !hasTypedEndpoint) {
    return null;
  }

  const spotId = isStart ? TIMELINE_START_ENDPOINT_ID : TIMELINE_END_ENDPOINT_ID;
  const overrides = timelineEndpointOverrides.value[spotId] ?? {};
  const fallbackDayNumber = isStart ? 1 : getDraftTimelineDaySpan();
  const fallbackTimeSlot = isStart ? TIMELINE_START_TIME_SLOT : TIMELINE_END_TIME_SLOT;
  const resolvedLatitude = hasCoordinatePair(latitude, longitude) ? Number(latitude) : 0;
  const resolvedLongitude = hasCoordinatePair(latitude, longitude) ? Number(longitude) : 0;

  return {
    spotId,
    title: getTimelineEndpointTitle(role),
    latitude: resolvedLatitude,
    longitude: resolvedLongitude,
    category: isStart ? 'scenic' : 'other',
    city: isStart ? 'Start point' : 'End point',
    dayNumber: clampTimelineDayNumber(overrides.dayNumber ?? fallbackDayNumber),
    timeSlot: normalizeTimeSlot(overrides.timeSlot ?? fallbackTimeSlot),
    duration: 30,
    estimatedCost: 0,
    timelineRouteLabel: isStart ? 'S' : 'E',
    timelineRouteRole: role,
    isTimelineEndpoint: true,
  };
}

function resolveTimelineRouteRole(stop: TripSpot): TimelineRouteRole {
  if (stop.spotId === inferredStartStop.value?.spotId) {
    return 'start';
  }

  if (stop.spotId === inferredEndStop.value?.spotId) {
    return 'end';
  }

  return 'stop';
}

function labelTimelineStops(stops: TimelineTripSpot[], useChronologicalEndpoints = false): TimelineTripSpot[] {
  const lastIndex = stops.length - 1;

  return stops.map((stop, index) => {
    if (useChronologicalEndpoints) {
      const timelineRouteRole: TimelineRouteRole = index === 0
        ? 'start'
        : index === lastIndex
          ? 'end'
          : 'stop';
      const timelineRouteLabel = timelineRouteRole === 'start'
        ? 'S'
        : timelineRouteRole === 'end'
          ? 'E'
          : String(index + 1);

      return { ...stop, timelineRouteLabel, timelineRouteRole };
    }

    if (stop.timelineRouteRole === 'start') {
      return { ...stop, timelineRouteLabel: 'S' };
    }

    if (stop.timelineRouteRole === 'end') {
      return { ...stop, timelineRouteLabel: 'E' };
    }

    return { ...stop, timelineRouteLabel: String(index + 1), timelineRouteRole: 'stop' };
  });
}

function getTimelineSpotBadgeText(spot: TimelineTripSpot): string {
  if (spot.timelineRouteRole === 'start') {
    return 'Origin';
  }

  if (spot.timelineRouteRole === 'end') {
    return 'Destination';
  }

  return `Stop ${spot.timelineRouteLabel || '1'}`;
}

function formatTimelineSpotMeta(spot: TimelineTripSpot): string {
  if (spot.timelineRouteRole === 'start') {
    return hasCoordinatePair(spot.latitude, spot.longitude) ? 'Pinned coordinates - route start' : 'Pinned route start';
  }

  if (spot.timelineRouteRole === 'end') {
    return 'Pinned finish - route end';
  }

  const locationLabel = spot.city || 'Scope destination';
  return `${locationLabel} - ${currencyFormatter.format(spot.estimatedCost ?? 0)}`;
}

function isSyntheticTimelineEndpoint(spot: TimelineTripSpot): boolean {
  return spot.isTimelineEndpoint === true;
}

function stripTimelineMetadata(stop: TimelineTripSpot): TripSpot {
  const {
    timelineRouteLabel: _timelineRouteLabel,
    timelineRouteRole: _timelineRouteRole,
    isTimelineEndpoint: _isTimelineEndpoint,
    ...tripSpot
  } = stop;
  return { ...tripSpot };
}

function compareTimelineStops(left: TimelineTripSpot, right: TimelineTripSpot): number {
  const dayComparison = (left.dayNumber ?? 1) - (right.dayNumber ?? 1);
  if (dayComparison !== 0) {
    return dayComparison;
  }

  const timeComparison = normalizeTimeSlot(left.timeSlot).localeCompare(normalizeTimeSlot(right.timeSlot));
  if (timeComparison !== 0) {
    return timeComparison;
  }

  return left.title.localeCompare(right.title);
}

function getTimelineSourceStops(): TimelineTripSpot[] {
  const sourceStops = props.stops.length
    ? props.stops
    : props.itinerary?.days.flatMap((day) =>
        day.spots.map((spot) => ({
          ...spot,
          dayNumber: spot.dayNumber ?? day.dayNumber,
        })),
      ) ?? [];

  const normalizedStops = sourceStops.map<TimelineTripSpot>((stop, index) => {
    const timelineRouteRole = resolveTimelineRouteRole(stop);
    const fallbackDayNumber = timelineRouteRole === 'start'
      ? 1
      : timelineRouteRole === 'end'
        ? getDraftTimelineDaySpan()
        : Math.floor(index / 3) + 1;
    const fallbackTimeSlot = timelineRouteRole === 'start'
      ? TIMELINE_START_TIME_SLOT
      : timelineRouteRole === 'end'
        ? TIMELINE_END_TIME_SLOT
        : DEFAULT_TIMELINE_TIME_SLOTS[index % DEFAULT_TIMELINE_TIME_SLOTS.length] ?? '10:00';

    return {
      ...stop,
      dayNumber: clampTimelineDayNumber(stop.dayNumber ?? fallbackDayNumber),
      timeSlot: normalizeTimeSlot(stop.timeSlot ?? fallbackTimeSlot, index),
      timelineRouteRole,
    };
  });
  const timelineStops = [
    buildTimelineEndpointStop('start'),
    ...normalizedStops,
    buildTimelineEndpointStop('end'),
  ].filter((stop): stop is TimelineTripSpot => Boolean(stop));

  return timelineStops;
}

function resolveTimelineDate(dayNumber: number): string {
  const matchingItineraryDay = props.itinerary?.days.find((day) => day.dayNumber === dayNumber);
  if (matchingItineraryDay?.date) {
    return matchingItineraryDay.date;
  }

  const anchorDate = props.draft?.startDate || props.itinerary?.days[0]?.date || '';
  return anchorDate ? addCalendarDays(anchorDate, dayNumber - 1) : '';
}

function buildEditableTimelineDays(stops: TimelineTripSpot[]): EditableTimelineDay[] {
  const dayLookup = new Map<number, EditableTimelineDay>();

  stops.forEach((stop) => {
    const dayNumber = clampTimelineDayNumber(stop.dayNumber ?? 1);
    if (!dayLookup.has(dayNumber)) {
      dayLookup.set(dayNumber, {
        dayNumber,
        date: resolveTimelineDate(dayNumber),
        spots: [],
      });
    }

    dayLookup.get(dayNumber)?.spots.push(stop);
  });

  return [...dayLookup.values()]
    .map((day) => ({
      ...day,
      spots: [...day.spots].sort(compareTimelineStops),
    }))
    .sort((left, right) => left.dayNumber - right.dayNumber);
}

function emitTimelineStopUpdate(spotId: string, patch: Partial<Pick<TripSpot, 'dayNumber' | 'timeSlot'>>): void {
  const targetStop = timelineSourceStops.value.find((stop) => stop.spotId === spotId);
  if (!targetStop) {
    return;
  }

  hasManualTimelineOrder.value = true;

  if (isSyntheticTimelineEndpoint(targetStop)) {
    timelineEndpointOverrides.value = {
      ...timelineEndpointOverrides.value,
      [spotId]: {
        ...timelineEndpointOverrides.value[spotId],
        ...patch,
        dayNumber: patch.dayNumber === undefined
          ? timelineEndpointOverrides.value[spotId]?.dayNumber
          : clampTimelineDayNumber(patch.dayNumber, maxEditableTimelineDay.value),
        timeSlot: patch.timeSlot === undefined ? timelineEndpointOverrides.value[spotId]?.timeSlot : normalizeTimeSlot(patch.timeSlot),
      },
    };
    return;
  }

  const nextStops = timelineSourceStops.value.filter((stop) => !isSyntheticTimelineEndpoint(stop)).map((stop) => {
    if (stop.spotId !== spotId) {
      return stripTimelineMetadata(stop);
    }

    return stripTimelineMetadata({
      ...stop,
      ...patch,
      dayNumber: patch.dayNumber === undefined
        ? stop.dayNumber
        : clampTimelineDayNumber(patch.dayNumber, maxEditableTimelineDay.value),
      timeSlot: patch.timeSlot === undefined ? stop.timeSlot : normalizeTimeSlot(patch.timeSlot),
    });
  });

  emit('itinerary-stops-update', [...nextStops].sort(compareTimelineStops));
}

function getInputValue(event: Event): string {
  return event.target instanceof HTMLInputElement ? event.target.value : '';
}

function selectTimelineInputText(event: Event): void {
  if (event.target instanceof HTMLInputElement) {
    event.target.select();
  }
}

function handleTimelineDayChange(spotId: string, event: Event): void {
  const nextDayNumber = Number.parseInt(getInputValue(event), 10);
  if (!Number.isFinite(nextDayNumber)) {
    return;
  }

  emitTimelineStopUpdate(spotId, {
    dayNumber: nextDayNumber,
  });
}

function handleTimelineTimeChange(spotId: string, event: Event): void {
  const nextTimeSlot = getInputValue(event);
  if (!nextTimeSlot) {
    return;
  }

  emitTimelineStopUpdate(spotId, {
    timeSlot: nextTimeSlot,
  });
}

const displayedTitle = computed(() => props.tripTitle.trim() || props.itinerary?.destination || 'AI itinerary');
const draftDestination = computed(() => props.draft?.destination?.trim() ?? '');
const draftEndDestination = computed(() => props.draft?.endDestination?.trim() ?? '');
const hasExplicitDraftStart = computed(() =>
  hasCoordinatePair(props.draft?.destinationLatitude, props.draft?.destinationLongitude),
);
const hasExplicitDraftEnd = computed(() =>
  hasCoordinatePair(props.draft?.endDestinationLatitude, props.draft?.endDestinationLongitude),
);
const hasDraftEndpoint = computed(() =>
  Boolean(draftDestination.value || draftEndDestination.value || hasExplicitDraftStart.value || hasExplicitDraftEnd.value),
);
const mappableDraftStops = computed(() =>
  props.stops.filter((stop) => hasCoordinatePair(stop.latitude, stop.longitude)),
);
const inferredStartStop = computed(() => (
  hasExplicitDraftStart.value || draftDestination.value ? null : mappableDraftStops.value[0] ?? null
));
const inferredEndStop = computed(() => {
  if (hasExplicitDraftEnd.value || draftEndDestination.value) {
    return null;
  }

  const stops = mappableDraftStops.value;
  if (stops.length === 0) {
    return null;
  }

  if (hasExplicitDraftStart.value || stops.length > 1) {
    return stops[stops.length - 1] ?? null;
  }

  return null;
});
const inferredMiddleStopCount = computed(() => {
  let stopCount = mappableDraftStops.value.length;
  if (!hasExplicitDraftStart.value && inferredStartStop.value) {
    stopCount -= 1;
  }

  if (!hasExplicitDraftEnd.value && inferredEndStop.value) {
    stopCount -= 1;
  }

  return Math.max(0, stopCount);
});
const draftStartLabel = computed(() =>
  formatDisplayLocation(draftDestination.value || inferredStartStop.value?.title || '', 'Choose start'),
);
const draftEndLabel = computed(() =>
  formatDisplayLocation(draftEndDestination.value || inferredEndStop.value?.title || '', 'Choose end'),
);
const planningRouteLabel = computed(() => {
  if (draftDestination.value && draftEndDestination.value) {
    return `${draftStartLabel.value} to ${draftEndLabel.value}`;
  }

  if (draftDestination.value) {
    return `${draftStartLabel.value} route`;
  }

  return 'Choose a start city or place';
});
const planningDraftStatus = computed(() => {
  const pointCount = draftRouteSequence.value.length;
  if (pointCount > 1) {
    return `${pointCount} route point${pointCount === 1 ? '' : 's'} selected`;
  }

  return planningRouteLabel.value;
});
const isMapPickModeEnabled = computed(() => mapPickState.value === 'armed' || mapPickState.value === 'locating');
const mapPickTargetLabel = computed(() => {
  switch (activeMapPickTarget.value) {
    case 'routeStop':
      return 'stop';
    case 'endDestination':
      return 'end';
    default:
      return 'start';
  }
});
const mapPickStatusCopy = computed(() => {
  if (mapPickState.value === 'locating') {
    return `Finding the nearest ${mapPickTargetLabel.value} place...`;
  }

  if (mapPickState.value === 'error') {
    return 'Scope could not locate that point yet.';
  }

  if (activeMapPickTarget.value === 'routeStop' && isMapPickModeEnabled.value) {
    return 'Click the map to add another stop between start and end.';
  }

  if (isMapPickModeEnabled.value) {
    return `Click the map to fill the ${mapPickTargetLabel.value} city.`;
  }

  return draftDestination.value ? planningRouteLabel.value : 'Use the pointer to fill the start city from the map.';
});
const draftDaysLabel = computed(() => {
  const startDate = props.draft?.startDate ?? '';
  const endDate = props.draft?.endDate ?? startDate;
  const dayCount = startDate ? getInclusiveDaySpan(startDate, endDate) : 1;
  return `${dayCount} day${dayCount === 1 ? '' : 's'}`;
});
const draftPaceLabel = computed(() => paceLabelByValue[props.draft?.pace ?? 'relaxed']);
const draftBudgetLabel = computed(() => {
  const budgetFloor = props.draft?.budgetFloor ?? 0;
  const budgetCeiling = props.draft?.budget ?? 1500;
  return `${currencyFormatter.format(budgetFloor)} - ${currencyFormatter.format(budgetCeiling)}`;
});
const draftStopCountLabel = computed(() => {
  const stopCount = inferredMiddleStopCount.value;
  return `${stopCount} stop${stopCount === 1 ? '' : 's'}`;
});
const shouldUseChronologicalTimelineEndpoints = computed(() =>
  !props.itinerary || hasManualTimelineOrder.value || hasDraftEndpoint.value,
);
const timelineSourceStops = computed(() =>
  labelTimelineStops(getTimelineSourceStops().sort(compareTimelineStops), shouldUseChronologicalTimelineEndpoints.value),
);
const maxEditableTimelineDay = computed(() => {
  const draftDaySpan = getInclusiveDaySpan(props.draft?.startDate ?? '', props.draft?.endDate ?? props.draft?.startDate ?? '');
  const currentMaxDay = timelineSourceStops.value.reduce((maxDay, stop) => Math.max(maxDay, stop.dayNumber ?? 1), 1);
  return Math.min(MAX_REASONABLE_TIMELINE_DAYS, Math.max(14, draftDaySpan, currentMaxDay));
});
const editableTimelineDays = computed(() => buildEditableTimelineDays(timelineSourceStops.value));
const timelineDaySpan = computed(() => editableTimelineDays.value.reduce((maxDay, day) => Math.max(maxDay, day.dayNumber), 0));
const totalStops = computed(() => (
  props.itinerary ? timelineSourceStops.value.filter((stop) => stop.timelineRouteRole === 'stop').length : 0
));
const handoffSummaryCopy = computed(() => {
  if (!props.itinerary) {
    return `${planningDraftStatus.value} Hand it to Scope AI when you want the live itinerary.`;
  }

  const weatherCopy = props.itinerary.weatherForecast.trim()
    ? `${props.itinerary.weatherForecast.trim().replace(/[.!?]+$/, '')}. `
    : '';
  return `${displayedTitle.value} is ready for ${props.itinerary.destination}. ${weatherCopy}Keep shaping this route here before publishing.`;
});
const handoffDaysLabel = computed(() => {
  if (!props.itinerary) {
    return draftDaysLabel.value;
  }

  const dayCount = Math.max(1, timelineDaySpan.value);
  return `${dayCount} day${dayCount === 1 ? '' : 's'}`;
});
const handoffStopCountLabel = computed(() => {
  if (!props.itinerary) {
    return draftStopCountLabel.value;
  }

  return `${totalStops.value} stop${totalStops.value === 1 ? '' : 's'}`;
});
const handoffBudgetLabel = computed(() => (
  props.itinerary ? currencyFormatter.format(props.itinerary.totalEstimatedCost) : draftBudgetLabel.value
));
const averageDailyCost = computed(() => {
  if (editableTimelineDays.value.length === 0) {
    return 0;
  }

  const totalCost = editableTimelineDays.value.reduce((total, day) => total + getTimelineDayCost(day), 0);
  return totalCost / editableTimelineDays.value.length;
});
const stepSummary = computed(() => {
  if (!props.itinerary) {
    return planningRouteLabel.value;
  }

  const dayCount = Math.max(1, timelineDaySpan.value);
  return `${dayCount} day${dayCount === 1 ? '' : 's'} · ${totalStops.value} stop${totalStops.value === 1 ? '' : 's'}`;
});
const draftMapSpots = computed<MapPoint[]>(() => {
  const points: MapPoint[] = [];
  const startLatitude = props.draft?.destinationLatitude;
  const startLongitude = props.draft?.destinationLongitude;
  const endLatitude = props.draft?.endDestinationLatitude;
  const endLongitude = props.draft?.endDestinationLongitude;
  const inferredStartStopId = inferredStartStop.value?.spotId ?? '';
  const inferredEndStopId = inferredEndStop.value?.spotId ?? '';

  if (hasExplicitDraftStart.value) {
    points.push({
      id: 'planner-start',
      title: draftStartLabel.value || 'Start',
      latitude: Number(startLatitude),
      longitude: Number(startLongitude),
      category: 'scenic',
      city: draftStartLabel.value || undefined,
      routeRole: 'start',
      routeLabel: 'S',
    });
  }

  mappableDraftStops.value.forEach((stop) => {
    let routeRole: MapPoint['routeRole'] = 'stop';
    let routeLabel = '';

    if (stop.spotId === inferredStartStopId) {
      routeRole = 'start';
      routeLabel = 'S';
    } else if (stop.spotId === inferredEndStopId) {
      routeRole = 'end';
      routeLabel = 'E';
    }

    points.push({
      id: `planner-stop-${stop.spotId}`,
      title: stop.title,
      latitude: stop.latitude,
      longitude: stop.longitude,
      category: stop.category,
      city: stop.city,
      photoUrl: resolveTripStopPhotoUrl(stop, ITINERARY_DAY_IMAGE_WIDTH),
      routeRole,
      routeLabel,
    });
  });

  if (hasExplicitDraftEnd.value) {
    points.push({
      id: 'planner-end',
      title: draftEndLabel.value || 'End',
      latitude: Number(endLatitude),
      longitude: Number(endLongitude),
      category: 'other',
      city: draftEndLabel.value || undefined,
      routeRole: 'end',
      routeLabel: 'E',
    });
  }

  return labelRoutePoints(points);
});
const shouldUseChronologicalMapOrder = computed(() =>
  !props.itinerary || hasManualTimelineOrder.value || hasExplicitDraftStart.value || hasExplicitDraftEnd.value,
);

function getTimelineMapPointId(stop: TimelineTripSpot): string {
  if (stop.spotId === TIMELINE_START_ENDPOINT_ID) {
    return 'planner-start';
  }

  if (stop.spotId === TIMELINE_END_ENDPOINT_ID) {
    return 'planner-end';
  }

  return `planner-stop-${stop.spotId}`;
}

function labelRoutePointsByUserSequence(points: MapPoint[]): MapPoint[] {
  const lastIndex = points.length - 1;

  return points.map((point, index) => {
    const routeRole: MapPoint['routeRole'] = index === 0
      ? 'start'
      : index === lastIndex
        ? 'end'
        : 'stop';
    const routeLabel = routeRole === 'start' ? 'S' : routeRole === 'end' ? 'E' : String(index + 1);

    return {
      ...point,
      routeRole,
      routeLabel,
    };
  });
}

function buildUserOrderedMapSpots(points: MapPoint[]): MapPoint[] {
  if ((!shouldUseChronologicalMapOrder.value && !hasManualTimelineOrder.value) || points.length <= 1) {
    return points;
  }

  const pointsById = new Map(points.map((point) => [point.id, point]));
  const usedPointIds = new Set<string>();
  const orderedPoints: MapPoint[] = [];

  timelineSourceStops.value.forEach((stop) => {
    const point = pointsById.get(getTimelineMapPointId(stop));
    if (!point || usedPointIds.has(point.id)) {
      return;
    }

    usedPointIds.add(point.id);
    orderedPoints.push(point);
  });

  points.forEach((point) => {
    if (!usedPointIds.has(point.id)) {
      orderedPoints.push(point);
    }
  });

  return labelRoutePointsByUserSequence(orderedPoints);
}

const mapSpots = computed<MapPoint[]>(() => {
  return buildUserOrderedMapSpots(draftMapSpots.value);
});
const shouldOptimizeRouteOrder = computed(() => !props.itinerary && !hasManualTimelineOrder.value);
const mapSpotsRouteKey = computed(() => getRouteSummaryKey(mapSpots.value));
const currentRouteSummary = computed(() => (
  routeSummaryKey.value === mapSpotsRouteKey.value ? routeSummary.value : null
));
function labelRoutePoints(points: MapPoint[]): MapPoint[] {
  return points.map((point, index) => {
    if (point.routeRole === 'start') {
      return { ...point, routeLabel: 'S' };
    }

    if (point.routeRole === 'end') {
      return { ...point, routeLabel: 'E' };
    }

    return { ...point, routeLabel: String(index + 1) };
  });
}

function labelRouteSequencePoints(points: RouteSequencePoint[]): RouteSequencePoint[] {
  return points.map((point, index) => {
    if (point.routeRole === 'start') {
      return { ...point, routeLabel: 'S' };
    }

    if (point.routeRole === 'end') {
      return { ...point, routeLabel: 'E' };
    }

    return { ...point, routeLabel: String(index + 1) };
  });
}

function labelRouteSequenceByUserSequence(points: RouteSequencePoint[]): RouteSequencePoint[] {
  const lastIndex = points.length - 1;

  return points.map((point, index) => {
    const routeRole: RouteSequencePoint['routeRole'] = index === 0
      ? 'start'
      : index === lastIndex
        ? 'end'
        : 'stop';
    const routeLabel = routeRole === 'start' ? 'S' : routeRole === 'end' ? 'E' : String(index + 1);

    return {
      ...point,
      routeRole,
      routeLabel,
    };
  });
}

function buildTextRouteEndpoint(id: string, title: string, routeRole: 'start' | 'end'): RouteSequencePoint {
  return {
    id,
    title,
    routeRole,
    routeLabel: routeRole === 'start' ? 'S' : 'E',
  };
}

function getTimelineRouteSequencePointId(stop: TimelineTripSpot): string {
  if (stop.spotId === TIMELINE_START_ENDPOINT_ID) {
    return hasExplicitDraftStart.value ? 'planner-start' : 'planner-start-text';
  }

  if (stop.spotId === TIMELINE_END_ENDPOINT_ID) {
    return hasExplicitDraftEnd.value ? 'planner-end' : 'planner-end-text';
  }

  return `planner-stop-${stop.spotId}`;
}

function buildUserOrderedRouteSequence(sequence: RouteSequencePoint[]): RouteSequencePoint[] {
  if (sequence.length <= 1) {
    return labelRouteSequencePoints(sequence);
  }

  const pointsById = new Map(sequence.map((point) => [point.id, point]));
  const usedPointIds = new Set<string>();
  const orderedSequence: RouteSequencePoint[] = [];

  timelineSourceStops.value.forEach((stop) => {
    const point = pointsById.get(getTimelineRouteSequencePointId(stop));
    if (!point || usedPointIds.has(point.id)) {
      return;
    }

    usedPointIds.add(point.id);
    orderedSequence.push(point);
  });

  sequence.forEach((point) => {
    if (!usedPointIds.has(point.id)) {
      orderedSequence.push(point);
    }
  });

  return labelRouteSequenceByUserSequence(orderedSequence);
}

function keepVisualRouteEndpoints(points: MapPoint[]): MapPoint[] {
  if (points.length <= 2) {
    return points;
  }

  const startPoint = points.find((point) => point.routeRole === 'start');
  const endPoint = [...points].reverse().find((point) => point.routeRole === 'end' && point.id !== startPoint?.id);
  if (!startPoint || !endPoint) {
    return points;
  }

  const middlePoints = points.filter((point) => point.id !== startPoint.id && point.id !== endPoint.id);
  return [startPoint, ...middlePoints, endPoint];
}

const displayMapSpots = computed<MapPoint[]>(() => {
  const summary = currentRouteSummary.value;
  if (props.itinerary || !shouldOptimizeRouteOrder.value || !summary?.orderedPoints.length) {
    return mapSpots.value;
  }

  return labelRoutePoints(keepVisualRouteEndpoints(summary.orderedPoints));
});
const draftRouteSequence = computed<RouteSequencePoint[]>(() => {
  const sequence: RouteSequencePoint[] = [];

  if (draftDestination.value && !hasExplicitDraftStart.value) {
    sequence.push(buildTextRouteEndpoint('planner-start-text', draftStartLabel.value, 'start'));
  }

  sequence.push(...displayMapSpots.value);

  if (draftEndDestination.value && !hasExplicitDraftEnd.value) {
    sequence.push(buildTextRouteEndpoint('planner-end-text', draftEndLabel.value, 'end'));
  }

  return buildUserOrderedRouteSequence(sequence);
});
const routeBriefStartLabel = computed(() =>
  draftRouteSequence.value.find((point) => point.routeRole === 'start')?.title ?? draftStartLabel.value,
);
const routeBriefEndLabel = computed(() =>
  [...draftRouteSequence.value].reverse().find((point) => point.routeRole === 'end')?.title ?? draftEndLabel.value,
);
const routePlaceAnchors = computed<MapPoint[]>(() => {
  if (props.itinerary) {
    return [];
  }

  return displayMapSpots.value.filter((point) => hasCoordinatePair(point.latitude, point.longitude));
});
const selectedRoutePlaceAnchor = computed(() => {
  if (routePlaceAnchors.value.length === 0) {
    return null;
  }

  return routePlaceAnchors.value.find((anchor) => anchor.id === selectedRoutePlacePointId.value) ?? routePlaceAnchors.value[0];
});
const routePlacePanelTitle = computed(() => {
  const anchor = selectedRoutePlaceAnchor.value;
  if (!anchor) {
    return 'Route places';
  }

  if (anchor.routeRole === 'start') {
    return 'Around start';
  }

  if (anchor.routeRole === 'end') {
    return 'Around end';
  }

  return `Around stop ${anchor.routeLabel}`;
});
const availableRoutePlaceSuggestions = computed(() => {
  const existingStopIds = new Set(props.stops.map((stop) => stop.spotId));
  return routePlaceSuggestions.value.filter((place) => !existingStopIds.has(place.id));
});
const routePlacePanelVisible = computed(
  () => routePlaceSuggestionsLoading.value || Boolean(routePlaceSuggestionsError.value) || availableRoutePlaceSuggestions.value.length > 0,
);
const routePlaceSuggestionsState = computed(() => {
  if (routePlaceSuggestionsLoading.value) {
    return 'loading';
  }

  if (routePlaceSuggestionsError.value) {
    return 'error';
  }

  return availableRoutePlaceSuggestions.value.length ? 'ready' : 'empty';
});
const routeDistanceLabel = computed(() => {
  const summary = currentRouteSummary.value;
  if (!summary || summary.distanceMeters <= 0) {
    return mapSpots.value.length > 1 ? 'Estimating' : 'Add points';
  }

  return formatMiles(summary.distanceMeters);
});
const routeEtaLabel = computed(() => {
  const summary = currentRouteSummary.value;
  if (!summary || summary.durationSeconds <= 0) {
    return mapSpots.value.length > 1 ? 'Estimating' : 'Add end';
  }

  return formatDuration(summary.durationSeconds);
});
const showRouteMetrics = computed(() => mapSpots.value.length > 1);
function cleanLocationDisplay(value: string): string {
  return value
    .replace(/\s*\.{3,}\s*/g, ' ')
    .replace(/\s+\d{5}(?:-\d{4})?(?=,|$)/g, '')
    .replace(/,\s*(United States|USA|Canada|Australia)$/i, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .trim();
}

function formatDisplayLocation(value: string, fallback: string): string {
  const cleanedValue = cleanLocationDisplay(value);
  return cleanedValue || fallback;
}

function formatLocationPreview(value: string): string {
  const cleanedValue = cleanLocationDisplay(value);
  const locationParts = cleanedValue.split(',').map((part) => part.trim()).filter(Boolean);
  if (locationParts.length > 2) {
    return locationParts.slice(0, 2).join(', ');
  }

  return cleanedValue || value;
}

function formatMiles(distanceMeters: number): string {
  const miles = distanceMeters / METERS_PER_MILE;
  if (miles > 0 && miles < 0.1) {
    return '<0.1 mi';
  }

  if (miles < 10) {
    return `${Math.max(0, miles).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} mi`;
  }

  if (miles < 1000) {
    return `${miles.toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} mi`;
  }

  return `${miles.toLocaleString('en-US', {
    maximumFractionDigits: 0,
  })} mi`;
}

function formatDuration(durationSeconds: number): string {
  const totalMinutes = Math.max(1, Math.round(durationSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) {
    return `${totalMinutes} min`;
  }

  if (!minutes) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
}

function removeDraftRouteStop(pointId: string): void {
  const routeStopId = pointId.replace(/^planner-stop-/, '');
  if (routeStopId) {
    emit('route-stop-remove', routeStopId);
  }
}

function isDraftStopPoint(point: RouteSequencePoint): boolean {
  return point.id.startsWith('planner-stop-');
}

function resolveRoutePlacePhoto(place: SpotSummary): string {
  return place.photoUrl || getSpotPhotoFallback(place.category, ROUTE_PLACE_IMAGE_WIDTH);
}

function formatRoutePlaceMeta(place: SpotSummary): string {
  const categoryLabel = place.category.replace(/[-_]/g, ' ');
  const ratingLabel = Number.isFinite(place.rating) && place.rating > 0 ? `${place.rating.toFixed(1)} rated` : '';
  return [categoryLabel, place.city, ratingLabel].filter(Boolean).join(' / ');
}

function addSuggestedRoutePlace(place: SpotSummary): void {
  emit('route-stop-add', {
    spotId: place.id,
    title: place.title,
    latitude: place.latitude,
    longitude: place.longitude,
    category: place.category,
    city: place.city,
    photoUrl: place.photoUrl,
    notes: place.description,
  });
}

async function loadRoutePlaceSuggestions(): Promise<void> {
  const anchor = selectedRoutePlaceAnchor.value;
  const requestId = ++routePlaceSuggestionsRequestId;

  if (!anchor || props.itinerary) {
    routePlaceSuggestions.value = [];
    routePlaceSuggestionsError.value = '';
    routePlaceSuggestionsLoading.value = false;
    return;
  }

  routePlaceSuggestionsLoading.value = true;
  routePlaceSuggestionsError.value = '';

  try {
    const response = await listNearbySpots({
      latitude: anchor.latitude,
      longitude: anchor.longitude,
      radiusKm: ROUTE_PLACE_RADIUS_KM,
      page: 1,
      pageSize: ROUTE_PLACE_LIMIT,
    });

    if (requestId !== routePlaceSuggestionsRequestId) {
      return;
    }

    routePlaceSuggestions.value = response.data.filter((place) => hasCoordinatePair(place.latitude, place.longitude));
  } catch {
    if (requestId === routePlaceSuggestionsRequestId) {
      routePlaceSuggestions.value = [];
      routePlaceSuggestionsError.value = 'Nearby places are unavailable right now.';
    }
  } finally {
    if (requestId === routePlaceSuggestionsRequestId) {
      routePlaceSuggestionsLoading.value = false;
    }
  }
}

function hasCoordinatePair(latitude: number | undefined, longitude: number | undefined): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Number(latitude) >= -90 &&
    Number(latitude) <= 90 &&
    Number(longitude) >= -180 &&
    Number(longitude) <= 180;
}

function getRouteSummaryKey(points: MapPoint[], optimizeOrder = shouldOptimizeRouteOrder.value): string {
  const routeModeKey = optimizeOrder ? 'optimized' : 'fixed';
  const pointKey = points
    .map((point) => `${point.id}:${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`)
    .join('|');
  return `${routeModeKey}:${pointKey}`;
}

async function syncRouteSummary(): Promise<void> {
  const requestId = ++routeSummaryRequestId;
  const routePoints = mapSpots.value.filter((spot) => hasCoordinatePair(spot.latitude, spot.longitude));
  const optimizeRouteOrder = shouldOptimizeRouteOrder.value;
  const summaryKey = getRouteSummaryKey(routePoints, optimizeRouteOrder);
  routeSummary.value = null;
  routeSummaryKey.value = summaryKey;

  if (routePoints.length < 2) {
    return;
  }

  try {
    const summary = await resolveRoadRoute(routePoints, { optimizeOrder: optimizeRouteOrder });
    if (requestId === routeSummaryRequestId && summaryKey === mapSpotsRouteKey.value) {
      routeSummaryKey.value = summaryKey;
      routeSummary.value = summary;
    }
  } catch {
    if (requestId === routeSummaryRequestId) {
      routeSummary.value = null;
    }
  }
}

watch(
  () => [
    props.itinerary?.id ?? '',
    draftDestination.value,
    draftEndDestination.value,
    props.draft?.destinationLatitude,
    props.draft?.destinationLongitude,
    props.draft?.endDestinationLatitude,
    props.draft?.endDestinationLongitude,
    props.stops.map((stop) => `${stop.spotId}:${stop.latitude},${stop.longitude}`).join('|'),
  ] as const,
  ([itineraryId]) => {
    const isMapAlreadyVisible = shouldRenderMap.value;
    cancelMapRender();

    if (!itineraryId || isMapAlreadyVisible) {
      shouldRenderMap.value = true;
      return;
    }

    shouldRenderMap.value = false;
    cancelMapRender = scheduleNonCriticalTask(() => {
      shouldRenderMap.value = true;
    }, { delayMs: 900, timeoutMs: 2_200 });
  },
  { immediate: true },
);

watch(
  () => mapSpotsRouteKey.value,
  () => {
    void syncRouteSummary();
  },
  { immediate: true },
);

watch(
  () => routePlaceAnchors.value.map((anchor) => `${anchor.id}:${anchor.latitude.toFixed(5)},${anchor.longitude.toFixed(5)}`).join('|'),
  () => {
    if (routePlaceAnchors.value.length === 0) {
      selectedRoutePlacePointId.value = '';
      routePlaceSuggestions.value = [];
      routePlaceSuggestionsError.value = '';
      routePlaceSuggestionsLoading.value = false;
      routePlaceSuggestionsRequestId += 1;
      return;
    }

    if (!routePlaceAnchors.value.some((anchor) => anchor.id === selectedRoutePlacePointId.value)) {
      selectedRoutePlacePointId.value = routePlaceAnchors.value[0].id;
    }
  },
  { immediate: true },
);

watch(
  () => {
    const anchor = selectedRoutePlaceAnchor.value;
    if (!anchor) {
      return '';
    }

    return `${anchor.id}:${anchor.latitude.toFixed(5)},${anchor.longitude.toFixed(5)}:${props.stops.map((stop) => stop.spotId).join('|')}`;
  },
  () => {
    void loadRoutePlaceSuggestions();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  cancelMapRender();
  routeSummaryRequestId += 1;
  routePlaceSuggestionsRequestId += 1;
});
</script>

<style scoped>
.itinerary-stage,
.overlay-card,
.itinerary-detail-panel,
.timeline-card,
.stop-list,
.stop-copy,
.itinerary-step-shell,
.itinerary-step-content,
.itinerary-step-toggle__copy,
.itinerary-step-actions {
  display: grid;
  gap: var(--space-3);
}

.itinerary-stage {
  position: relative;
  min-height: 34rem;
  overflow: hidden;
  padding: 0;
}

.itinerary-stage[data-onboarding-active='true'] {
  border-color: color-mix(in srgb, var(--accent-teal) 42%, var(--glass-border));
  box-shadow:
    var(--shadow-lg),
    0 0 0 1px color-mix(in srgb, var(--accent-teal) 22%, transparent),
    0 0 2.6rem color-mix(in srgb, var(--accent-teal) 20%, transparent);
}

.itinerary-stage[data-onboarding-active='true'] .summary-card,
.itinerary-stage[data-onboarding-active='true'] .timeline-overlay {
  border-color: color-mix(in srgb, var(--accent-teal) 28%, var(--glass-border));
  box-shadow:
    var(--shadow-lg),
    0 0 1.8rem color-mix(in srgb, var(--accent-teal) 18%, transparent);
}

.itinerary-stage[data-itinerary-mode='mobile-wizard'] {
  min-height: auto;
  overflow: visible;
  padding: var(--space-4);
}

.itinerary-step-content {
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: var(--space-4);
  padding: var(--space-4);
}

.itinerary-stage[data-itinerary-mode='mobile-wizard'] .itinerary-step-content {
  padding: 0;
}

.itinerary-detail-panel {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  align-items: stretch;
  min-width: 0;
}

.map-shell,
.map-shell :deep(.map-view),
.map-shell__placeholder {
  width: 100%;
  min-width: 0;
  min-height: clamp(34rem, 52vh, 44rem);
  height: 100%;
}

.map-shell {
  position: relative;
  z-index: 0;
  overflow: hidden;
}

.itinerary-stage[data-itinerary-mode='desktop'] .map-shell {
  width: calc(100% + var(--space-4) + var(--space-4));
  margin: calc(var(--space-4) * -1) calc(var(--space-4) * -1) 0;
}

.map-shell :deep(.map-view),
.map-shell__placeholder {
  display: block;
  border-radius: var(--radius-2xl);
}

.itinerary-stage[data-itinerary-mode='desktop'] .map-shell :deep(.map-view),
.itinerary-stage[data-itinerary-mode='desktop'] .map-shell__placeholder {
  border-radius: 0;
}

.map-shell :deep(.map-view) {
  --scope-map-controls-right: var(--space-3);
  --scope-map-controls-bottom: var(--space-3);
}

.map-shell__placeholder {
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent-teal) 20%, transparent), transparent 36%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 100%, transparent), color-mix(in srgb, var(--bg-primary) 88%, transparent));
}

.map-shell :deep(.spot-marker__label) {
  display: none;
}

.map-shell :deep(.empty-state) {
  display: none;
}

.map-vignette {
  display: none;
}

.itinerary-step-toggle {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: flex-start;
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

.itinerary-step-toggle:hover,
.itinerary-step-toggle:focus-visible,
.itinerary-step-toggle[data-onboarding-active='true'] {
  transform: translateY(var(--motion-card-lift));
  border-color: var(--border-hover);
  box-shadow: var(--shadow-md);
  outline: none;
}

.itinerary-step-toggle[data-onboarding-active='true'] {
  border-color: color-mix(in srgb, var(--accent-teal) 40%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 12%, var(--glass-bg));
  box-shadow:
    var(--shadow-md),
    0 0 1.5rem color-mix(in srgb, var(--accent-teal) 18%, transparent);
}

.itinerary-step-shell[data-step-state='current'] .itinerary-step-toggle {
  border-color: var(--accent-teal);
  background: color-mix(in srgb, var(--accent-teal) 12%, var(--glass-bg));
  box-shadow: var(--shadow-glow-teal);
}

.itinerary-step-shell[data-step-state='complete'] .itinerary-step-toggle {
  border-color: color-mix(in srgb, var(--accent-teal) 34%, var(--glass-border));
}

.itinerary-step-toggle__index {
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

.itinerary-step-toggle__copy {
  flex: 1;
  min-width: 0;
  gap: var(--space-1);
}

.itinerary-step-toggle__copy strong,
.itinerary-step-toggle__copy span,
.itinerary-step-toggle__state,
.map-picker-status,
.summary-card h2,
.timeline-header h3,
.timeline-body h4,
.summary-copy,
.planning-route-card p {
  margin: 0;
}

.eyebrow {
  margin: 0 0 var(--space-1);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.itinerary-step-toggle__copy > span:last-child,
.itinerary-step-toggle__state,
.map-picker-status,
.summary-copy,
.stop-copy small,
.planning-route-card p {
  color: var(--text-secondary);
}

.itinerary-step-toggle__copy strong,
.map-picker-button span,
.summary-card h2,
.timeline-header h3,
.timeline-body h4,
.stop-copy strong {
  color: var(--text-primary);
}

.summary-card h2 {
  font-size: clamp(1.35rem, 0.85vw + 1rem, 1.8rem);
  line-height: var(--line-height-tight);
}

.timeline-header h3 {
  font-size: var(--font-size-lg);
  line-height: var(--line-height-tight);
}

.timeline-body h4,
.stop-copy strong {
  font-size: var(--font-size-body);
  line-height: var(--line-height-tight);
}

.itinerary-step-toggle__state {
  align-self: center;
  white-space: nowrap;
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.itinerary-step-shell[data-step-state='complete'] .itinerary-step-toggle__state,
.itinerary-step-shell[data-step-state='current'] .itinerary-step-toggle__state {
  color: var(--accent-teal);
}

.overlay-card {
  position: relative;
  z-index: 2;
  min-width: 0;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--glass-bg) 94%, var(--bg-secondary)), color-mix(in srgb, var(--bg-secondary) 94%, var(--bg-primary)));
  border: 1px solid color-mix(in srgb, var(--accent-teal) 16%, var(--glass-border));
  backdrop-filter: var(--glass-blur);
  box-shadow:
    var(--shadow-lg),
    inset 0 1px 0 color-mix(in srgb, white 6%, transparent);
  border-radius: var(--radius-2xl);
}

.summary-card {
  width: 100%;
  padding: var(--space-4);
}

.summary-card--built {
  display: grid;
  align-content: start;
  gap: var(--space-4);
}

.summary-card--built h2,
.summary-card--built .summary-copy {
  min-width: 0;
  overflow-wrap: anywhere;
}

.summary-card--built h2 {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.summary-card--built .summary-copy {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.summary-card--built .summary-metrics {
  justify-content: flex-start;
  flex-wrap: wrap;
}

.route-signal-card {
  width: 100%;
  padding: var(--space-3);
}

.timeline-overlay {
  grid-column: 1 / -1;
  width: 100%;
  padding: clamp(var(--space-4), 1.4vw, var(--space-5));
  overflow: hidden;
  border-color: color-mix(in srgb, var(--accent-teal) 20%, var(--glass-border));
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--glass-bg) 96%, var(--bg-secondary)), color-mix(in srgb, var(--bg-primary) 54%, var(--glass-bg))),
    radial-gradient(circle at 8% 0%, color-mix(in srgb, var(--accent-teal) 10%, transparent), transparent 34%);
}

.timeline-overlay--draft .timeline-rail {
  max-height: none;
}

.loading-card {
  grid-column: 1 / -1;
  padding: 0.8rem 1rem;
  color: var(--text-primary);
}

.summary-metrics,
.route-signal-grid,
.route-card-header,
.map-picker-actions,
.timeline-header,
.stop-item {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  align-items: center;
}

.route-card-header {
  align-items: flex-start;
}

.route-card-header h3 {
  margin: var(--space-1) 0 0;
  color: var(--text-primary);
  font-size: var(--font-size-body);
  line-height: var(--line-height-tight);
}

.route-source-pill {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  padding: 0.45rem 0.78rem;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-eyebrow);
  text-transform: uppercase;
}

.map-picker-actions {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  justify-content: stretch;
  gap: 0.4rem;
  padding: 0.4rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 20%, var(--glass-border));
  border-radius: var(--radius-2xl);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 48%, var(--glass-bg)), color-mix(in srgb, var(--bg-secondary) 70%, var(--glass-bg)));
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 5%, transparent);
}

.map-picker-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-width: 0;
  min-height: 2.35rem;
  padding: 0.48rem 0.75rem;
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-primary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.map-picker-button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.map-picker-button.active,
.map-picker-button:not(:disabled):hover,
.map-picker-button:not(:disabled):focus-visible {
  transform: translateY(var(--motion-button-lift));
  border-color: color-mix(in srgb, var(--accent-teal) 62%, var(--glass-border));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent-teal) 26%, var(--glass-bg)), color-mix(in srgb, var(--accent-teal) 14%, var(--bg-primary)));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 10%, transparent),
    0 0 0.9rem color-mix(in srgb, var(--accent-teal) 16%, transparent);
  outline: none;
}

.map-picker-button :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
}

.map-picker-status {
  display: none;
  padding: 0.65rem 0.85rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 22%, var(--glass-border));
  border-radius: var(--radius-xl);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 44%, var(--glass-bg)), color-mix(in srgb, var(--bg-secondary) 72%, var(--glass-bg)));
  font-size: var(--font-size-small);
  line-height: var(--line-height-normal);
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 5%, transparent);
}

.map-picker-status.visible {
  display: block;
}

.route-sequence-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  min-width: 0;
}

.route-sequence-chip {
  --route-chip-color: var(--accent-teal);
  --route-chip-ink: var(--text-inverse);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  max-width: 100%;
  padding: 0.42rem 0.55rem 0.42rem 0.42rem;
  border: 1px solid color-mix(in srgb, var(--route-chip-color) 30%, var(--glass-border));
  border-radius: var(--radius-full);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--route-chip-color) 8%, var(--glass-bg)), color-mix(in srgb, var(--bg-primary) 40%, var(--glass-bg)));
  color: var(--text-primary);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 5%, transparent),
    0 0.45rem 1.1rem color-mix(in srgb, var(--bg-primary) 18%, transparent);
}

.route-sequence-chip strong {
  width: 1.6rem;
  height: 1.6rem;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: var(--route-chip-color);
  color: var(--route-chip-ink);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-bold);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  letter-spacing: 0;
  text-transform: uppercase;
  box-shadow: 0 0 0.8rem color-mix(in srgb, var(--route-chip-color) 24%, transparent);
}

.route-sequence-chip[data-route-role='stop'] {
  --route-chip-color: var(--accent-gold);
}

.route-sequence-chip[data-route-role='end'] {
  --route-chip-color: var(--accent-teal);
}

.route-sequence-chip span {
  min-width: 0;
  max-width: 15rem;
  overflow-wrap: anywhere;
  white-space: normal;
  line-height: var(--line-height-tight);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
}

.route-sequence-chip button {
  width: 1.55rem;
  height: 1.55rem;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 42%, var(--glass-bg));
  color: var(--text-secondary);
  cursor: pointer;
}

.route-sequence-chip button:hover,
.route-sequence-chip button:focus-visible {
  border-color: var(--danger);
  color: var(--danger);
  outline: none;
}

.route-sequence-chip button :deep(.scope-icon) {
  width: 0.8rem;
  height: 0.8rem;
}

.route-place-panel {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  border-radius: var(--radius-xl);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent-teal) 8%, transparent), transparent 45%),
    color-mix(in srgb, var(--bg-primary) 34%, var(--glass-bg));
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 5%, transparent);
}

.route-place-panel__header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  align-items: flex-start;
  min-width: 0;
}

.route-place-panel__header h4 {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);
  overflow-wrap: anywhere;
}

.route-place-refresh {
  width: 2.35rem;
  height: 2.35rem;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 22%, var(--glass-border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 44%, var(--glass-bg));
  color: var(--text-primary);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.route-place-refresh:disabled {
  cursor: wait;
  opacity: 0.58;
}

.route-place-refresh:not(:disabled):hover,
.route-place-refresh:not(:disabled):focus-visible {
  transform: translateY(var(--motion-button-lift));
  border-color: color-mix(in srgb, var(--accent-teal) 58%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 18%, var(--glass-bg));
  outline: none;
}

.route-place-tabs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(5.8rem, 1fr));
  gap: 0.45rem;
}

.route-place-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  min-height: 2.4rem;
  padding: 0.38rem 0.52rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 16%, var(--glass-border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 44%, var(--glass-bg));
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
}

.route-place-tab strong {
  width: 1.5rem;
  height: 1.5rem;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 74%, var(--bg-primary));
  color: var(--text-inverse);
  font-size: var(--font-size-caption);
  line-height: 1;
}

.route-place-tab span {
  min-width: 0;
  overflow-wrap: anywhere;
  white-space: normal;
  line-height: var(--line-height-tight);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
}

.route-place-tab.active,
.route-place-tab:hover,
.route-place-tab:focus-visible {
  border-color: color-mix(in srgb, var(--accent-teal) 52%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 13%, var(--glass-bg));
  color: var(--text-primary);
  outline: none;
}

.route-place-results {
  min-height: 5.5rem;
}

.route-place-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: var(--space-2);
}

.route-place-card {
  display: grid;
  grid-template-columns: 3.4rem minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  min-height: 4.2rem;
  padding: 0.45rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  border-radius: var(--radius-xl);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 74%, var(--glass-bg)), color-mix(in srgb, var(--bg-primary) 48%, var(--glass-bg)));
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 5%, transparent),
    0 0.75rem 1.6rem color-mix(in srgb, var(--bg-primary) 18%, transparent);
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.route-place-card:hover,
.route-place-card:focus-visible {
  transform: translateY(var(--motion-card-lift));
  border-color: color-mix(in srgb, var(--accent-teal) 54%, var(--glass-border));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 7%, transparent),
    0 1rem 2rem color-mix(in srgb, var(--accent-teal) 12%, transparent);
  outline: none;
}

.route-place-card__media {
  width: 3.4rem;
  height: 3.4rem;
  overflow: hidden;
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  background: color-mix(in srgb, var(--bg-primary) 50%, var(--glass-bg));
}

.route-place-card__image,
.route-place-card__image :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.route-place-card__copy {
  display: grid;
  gap: 0.18rem;
  min-width: 0;
}

.route-place-card__copy strong,
.route-place-card__copy small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.route-place-card__copy strong {
  color: var(--text-primary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);
}

.route-place-card__copy small {
  color: var(--text-muted);
  font-size: var(--font-size-caption);
}

.route-place-card__add {
  width: 1.85rem;
  height: 1.85rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: var(--accent-teal);
  color: var(--bg-primary);
  box-shadow: 0 0 0.8rem color-mix(in srgb, var(--accent-teal) 20%, transparent);
}

.route-place-state {
  min-height: 5.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-3);
  border: 1px dashed color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--bg-primary) 34%, var(--glass-bg));
  text-align: center;
  line-height: var(--line-height-normal);
}

.route-place-state--error {
  border-color: color-mix(in srgb, var(--danger) 34%, var(--glass-border));
  color: var(--danger);
}

.summary-metrics {
  margin-top: var(--space-3);
  flex-wrap: wrap;
}

.summary-pill,
.day-pill,
.timeline-cost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  padding: 0.45rem 0.7rem;
  font-size: var(--font-size-small);
}

.summary-pill,
.day-pill {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-primary);
}

.day-pill {
  font-weight: var(--font-weight-bold);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
}

.timeline-day-heading .day-pill {
  min-width: 5.6rem;
  border-color: color-mix(in srgb, var(--accent-teal) 44%, var(--glass-border));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent-teal) 18%, var(--glass-bg)), color-mix(in srgb, var(--bg-primary) 46%, var(--glass-bg)));
  color: color-mix(in srgb, var(--accent-teal) 84%, var(--text-primary));
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 7%, transparent);
}

.summary-pill--accent {
  background: var(--accent-teal);
  color: var(--bg-primary);
  box-shadow: none;
}

.timeline-cost {
  background: var(--accent-teal);
  color: var(--bg-primary);
  box-shadow: none;
}

.route-signal-card {
  gap: var(--space-3);
}

.route-signal-card p {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  line-height: var(--line-height-normal);
}

.route-signal-grid {
  justify-content: flex-start;
  gap: var(--space-3);
}

.route-signal-grid--planning {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  width: 100%;
}

.route-signal-grid span {
  display: grid;
  gap: 0.2rem;
  min-width: 5.8rem;
  padding: 0.65rem 0.7rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--bg-primary) 42%, var(--glass-bg));
}

.route-signal-grid--planning span {
  min-width: 0;
  padding: 0.8rem 0.9rem;
  border-color: color-mix(in srgb, var(--accent-teal) 26%, var(--glass-border));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent-teal) 8%, var(--glass-bg)), color-mix(in srgb, var(--bg-primary) 46%, var(--glass-bg)));
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 6%, transparent);
}

.route-signal-grid--placeholder span {
  border-style: dashed;
  color: var(--text-secondary);
}

.route-signal-grid--placeholder strong {
  color: var(--text-secondary);
}

.route-signal-grid strong,
.route-signal-grid small {
  margin: 0;
}

.route-signal-grid strong {
  color: var(--text-primary);
  font-size: var(--font-size-body);
  line-height: var(--line-height-tight);
  overflow-wrap: anywhere;
}

.route-signal-grid small {
  color: var(--text-muted);
  font-size: var(--font-size-caption);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.timeline-rail {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-auto-rows: max-content;
  gap: var(--space-3);
  max-height: none;
  overflow: visible;
  padding-right: 0;
  scrollbar-color: color-mix(in srgb, var(--text-secondary) 34%, var(--accent-teal)) transparent;
  scrollbar-width: thin;
  scrollbar-gutter: stable;
}

.timeline-rail::-webkit-scrollbar {
  width: 0.68rem;
  height: 0.68rem;
}

.timeline-rail::-webkit-scrollbar-track {
  margin: 0.35rem 0;
  border-radius: var(--radius-full);
  background: transparent;
}

.timeline-rail::-webkit-scrollbar-thumb {
  min-height: 2.75rem;
  border: 0.22rem solid transparent;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--text-secondary) 34%, var(--accent-teal));
  background-clip: padding-box;
}

.timeline-rail::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--accent-teal) 52%, var(--text-secondary));
  background-clip: padding-box;
}

.timeline-card {
  display: block;
  min-width: 0;
  min-height: 0;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--glass-bg) 94%, var(--bg-secondary)), color-mix(in srgb, var(--bg-secondary) 86%, var(--bg-primary)));
  border: 1px solid color-mix(in srgb, var(--accent-teal) 17%, var(--glass-border));
  border-radius: var(--radius-2xl);
  overflow: hidden;
  box-shadow:
    var(--shadow-md),
    inset 0 1px 0 color-mix(in srgb, white 5%, transparent);
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);
}

.timeline-day-move,
.timeline-stop-move {
  transition: transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.timeline-day-enter-active,
.timeline-day-leave-active,
.timeline-stop-enter-active,
.timeline-stop-leave-active {
  transition:
    opacity 220ms ease,
    transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1),
    border-color 220ms ease,
    box-shadow 220ms ease;
}

.timeline-day-enter-from,
.timeline-day-leave-to {
  opacity: 0;
  transform: translateY(0.75rem) scale(0.985);
}

.timeline-stop-enter-from {
  opacity: 0;
  transform: translateX(0.65rem) scale(0.99);
}

.timeline-stop-leave-to {
  opacity: 0;
  transform: translateX(-0.45rem) scale(0.99);
}

.timeline-body {
  padding: clamp(var(--space-4), 1.5vw, var(--space-5));
  display: grid;
  align-content: start;
  gap: var(--space-3);
}

.timeline-day-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid color-mix(in srgb, var(--accent-teal) 14%, var(--glass-border));
}

.timeline-day-heading > div {
  display: grid;
  gap: 0.5rem;
  min-width: 0;
}

.stop-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.stop-item {
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  padding: var(--space-3) clamp(var(--space-3), 1.1vw, var(--space-4));
  border: 1px solid color-mix(in srgb, var(--accent-teal) 14%, var(--glass-border));
  border-radius: var(--radius-xl);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 44%, var(--glass-bg)), color-mix(in srgb, var(--bg-secondary) 52%, var(--glass-bg)));
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 5%, transparent);
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.timeline-stop-controls {
  flex: 0 0 clamp(10.75rem, 24%, 13.75rem);
  display: grid;
  grid-template-columns: minmax(3.7rem, 0.52fr) minmax(5.9rem, 1fr);
  gap: var(--space-2);
  margin-left: auto;
  min-width: 0;
}

.timeline-stop-badge {
  min-width: 5.2rem;
  min-height: 2.25rem;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--accent-gold) 26%, var(--glass-border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-gold) 12%, var(--bg-primary));
  color: color-mix(in srgb, var(--accent-gold) 78%, var(--text-primary));
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.08em;
  line-height: 1;
  text-transform: uppercase;
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 5%, transparent);
}

.stop-item[data-route-role='start'] .timeline-stop-badge,
.stop-item[data-route-role='end'] .timeline-stop-badge {
  border-color: color-mix(in srgb, var(--accent-teal) 36%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 14%, var(--bg-primary));
  color: var(--accent-teal);
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 6%, transparent);
}

.timeline-edit-field {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}

.timeline-edit-field span {
  color: var(--text-muted);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-eyebrow);
  line-height: var(--line-height-tight);
  text-transform: uppercase;
}

.timeline-edit-field input {
  width: 100%;
  min-width: 0;
  min-height: 2.45rem;
  padding: 0.42rem 0.66rem;
  border: 1px solid color-mix(in srgb, var(--text-secondary) 24%, var(--glass-border));
  border-radius: var(--radius-lg);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--text-secondary) 9%, var(--bg-primary)), color-mix(in srgb, var(--bg-primary) 76%, var(--glass-bg)));
  color: var(--text-primary);
  font: inherit;
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-bold);
  font-variant-numeric: tabular-nums;
  text-align: center;
  caret-color: var(--text-primary);
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.timeline-edit-field input:focus {
  border-color: color-mix(in srgb, var(--text-primary) 42%, var(--glass-border));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--text-secondary) 18%, transparent);
  outline: none;
}

.timeline-edit-field input:hover:not(:focus) {
  border-color: color-mix(in srgb, var(--text-primary) 34%, var(--glass-border));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--text-secondary) 12%, var(--bg-primary)), color-mix(in srgb, var(--bg-primary) 78%, var(--glass-bg)));
}

.stop-copy {
  flex: 1 1 18rem;
  min-width: 0;
  align-self: center;
}

.itinerary-stage[data-itinerary-mode='desktop'] .stop-list {
  gap: 0.45rem;
}

.itinerary-stage[data-itinerary-mode='desktop'] .stop-copy small {
  display: none;
}

.planning-card {
  position: relative;
  isolation: isolate;
  width: 100%;
  align-self: start;
  align-content: stretch;
  gap: var(--space-5);
  min-height: 0;
  padding: var(--space-5);
  overflow: hidden;
  border-color: color-mix(in srgb, var(--accent-teal) 24%, var(--glass-border));
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--glass-bg) 95%, var(--bg-secondary)), color-mix(in srgb, var(--bg-primary) 58%, var(--glass-bg)));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 8%, transparent),
    0 1.4rem 3.6rem color-mix(in srgb, var(--bg-primary) 34%, transparent);
}

.planning-card__header {
  min-width: 0;
}

.planning-route-brief {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: stretch;
  gap: 0.55rem;
  padding: 0.55rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  border-radius: var(--radius-2xl);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 54%, var(--glass-bg)), color-mix(in srgb, var(--bg-secondary) 58%, var(--glass-bg)));
}

.planning-endpoint-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: var(--space-3);
  min-width: 0;
  padding: 0.85rem 0.95rem;
  border-radius: var(--radius-xl);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 40%, transparent), color-mix(in srgb, var(--bg-primary) 18%, transparent));
}

.planning-endpoint-card small,
.planning-metrics small {
  display: block;
  color: var(--text-muted);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-eyebrow);
  line-height: var(--line-height-tight);
  text-transform: uppercase;
}

.planning-endpoint-card strong {
  display: block;
  margin-top: 0.25rem;
  color: var(--text-primary);
  font-size: var(--font-size-body);
  line-height: var(--line-height-tight);
  overflow-wrap: anywhere;
}

.route-point-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.15rem;
  height: 2.15rem;
  border-radius: var(--radius-full);
  background: var(--accent-teal);
  color: var(--bg-primary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-bold);
  box-shadow: 0 0 1.35rem color-mix(in srgb, var(--accent-teal) 22%, transparent);
}

.planning-route-connector {
  display: grid;
  grid-template-columns: repeat(2, minmax(2rem, 1fr));
  grid-template-rows: auto;
  align-items: center;
  justify-items: center;
  min-width: 0;
  min-height: 0;
  padding: 0 2.6rem;
  color: color-mix(in srgb, var(--accent-teal) 62%, var(--text-secondary));
}

.planning-route-connector span {
  width: 100%;
  height: 1px;
  min-height: 1px;
  background: linear-gradient(90deg, transparent, currentColor, transparent);
  opacity: 0.58;
}

.planning-card .planning-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
  margin-top: 0;
}

.planning-card .summary-copy {
  display: -webkit-box;
  max-width: 42rem;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.planning-card .planning-metrics .summary-pill {
  display: grid;
  justify-items: start;
  gap: 0.22rem;
  min-width: 0;
  min-height: 3.65rem;
  padding: 0.75rem 0.9rem;
  border-radius: var(--radius-xl);
  border-color: color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 48%, var(--glass-bg)), color-mix(in srgb, var(--bg-secondary) 64%, var(--glass-bg)));
  font-weight: var(--font-weight-semibold);
  overflow-wrap: anywhere;
  text-align: left;
}

.planning-card .planning-metrics .summary-pill strong {
  color: var(--text-primary);
  font-size: var(--font-size-body);
  line-height: var(--line-height-tight);
  overflow-wrap: anywhere;
}

.planning-card .planning-metrics .summary-pill--accent {
  border-color: color-mix(in srgb, var(--accent-teal) 42%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 14%, var(--glass-bg));
  color: var(--text-primary);
}

.planning-card .planning-metrics .summary-pill--accent small,
.planning-card .planning-metrics .summary-pill--accent strong {
  color: var(--text-primary);
}

.planning-card .planning-metrics .summary-pill--accent strong {
  color: var(--accent-teal);
}

.planning-route-card {
  width: 100%;
  align-self: stretch;
  min-height: 100%;
  gap: var(--space-4);
  padding: var(--space-4);
  overflow: hidden;
  border-color: color-mix(in srgb, var(--accent-teal) 24%, var(--glass-border));
  background: color-mix(in srgb, var(--glass-bg) 96%, var(--bg-secondary));
}

.route-provider-copy {
  padding-top: var(--space-1);
  border-top: 1px solid color-mix(in srgb, var(--accent-teal) 16%, var(--glass-border));
}

.itinerary-step-actions .button {
  width: 100%;
}

.itinerary-step-actions {
  grid-column: 1 / -1;
}

@media (max-width: 1080px) {
  .itinerary-step-content,
  .itinerary-detail-panel {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .itinerary-stage {
    padding-bottom: 0;
  }

  .map-vignette {
    background: linear-gradient(180deg, var(--bg-primary), transparent 18%, transparent 82%, var(--bg-primary));
  }
}

@media (max-width: 720px) {
  .itinerary-stage,
  .map-shell,
  .map-shell :deep(.map-view),
  .map-shell__placeholder {
    min-height: 32rem;
  }

  .timeline-header,
  .summary-metrics,
  .route-signal-grid,
  .stop-item,
  .itinerary-step-toggle {
    flex-direction: column;
    align-items: flex-start;
  }

  .map-picker-button {
    min-height: 2.2rem;
    padding: 0.42rem 0.62rem;
  }

  .map-picker-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .map-picker-status {
    border-radius: var(--radius-xl);
  }

  .planning-route-brief {
    grid-template-columns: minmax(0, 1fr);
  }

  .planning-route-connector {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: auto;
    align-items: center;
    min-height: 0;
    padding-inline: var(--space-4);
  }

  .planning-route-connector span {
    width: 100%;
    height: 1px;
    min-height: 1px;
    background: linear-gradient(90deg, transparent, currentColor, transparent);
  }

  .planning-card .planning-metrics {
    grid-template-columns: minmax(0, 1fr);
  }

  .planning-card .planning-metrics .summary-pill--accent {
    grid-column: auto;
  }

  .timeline-rail {
    grid-auto-flow: column;
    grid-auto-columns: minmax(14rem, 78vw);
    grid-template-columns: none;
    max-height: none;
    overflow-x: auto;
    overflow-y: visible;
    padding-bottom: var(--space-2);
    padding-right: 0;
    scroll-snap-type: x proximity;
  }

  .timeline-card {
    display: block;
    scroll-snap-align: start;
  }

  .stop-item {
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .stop-copy {
    flex: 1 1 calc(100% - 7rem);
  }

  .timeline-stop-controls {
    width: 100%;
    flex-basis: auto;
    margin-left: 0;
  }
}

@media (max-width: 640px) {
  .itinerary-stage[data-itinerary-mode='mobile-wizard'] {
    padding: var(--space-4);
    border-radius: var(--radius-xl);
  }

  .itinerary-stage[data-itinerary-mode='mobile-wizard'] .map-shell,
  .itinerary-stage[data-itinerary-mode='mobile-wizard'] .map-shell :deep(.map-view),
  .itinerary-stage[data-itinerary-mode='mobile-wizard'] .map-shell__placeholder {
    min-height: 20rem;
  }

  .itinerary-stage[data-itinerary-mode='mobile-wizard'] :is(.summary-card, .route-signal-card, .timeline-overlay, .loading-card) {
    margin: 0;
  }

  .itinerary-stage[data-itinerary-mode='mobile-wizard'] .timeline-rail {
    grid-auto-columns: minmax(14rem, 82vw);
  }

  .planning-card {
    min-height: auto;
    padding: var(--space-4);
  }

  .route-signal-grid--planning {
    grid-template-columns: minmax(0, 1fr);
  }

}

@media (prefers-reduced-motion: reduce) {
  .timeline-card,
  .timeline-day-move,
  .timeline-stop-move,
  .timeline-day-enter-active,
  .timeline-day-leave-active,
  .timeline-stop-enter-active,
  .timeline-stop-leave-active,
  .stop-item,
  .itinerary-step-toggle {
    transition: none;
  }

  .timeline-day-enter-from,
  .timeline-day-leave-to,
  .timeline-stop-enter-from,
  .timeline-stop-leave-to,
  .loading-card,
  .itinerary-step-toggle:hover,
  .itinerary-step-toggle:focus-visible,
  .itinerary-step-toggle[data-onboarding-active='true'] {
    transform: none;
  }
}
</style>
