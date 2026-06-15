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
          <strong>Guide preview</strong>
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
            ref="plannerMapView"
            :spots="displayMapPins"
            :route-points="displayMapSpots"
            :show-location-tracker="true"
            :show-summary="false"
            :show-controls="true"
            :show-fit-route-control="false"
            :show-place-labels="true"
            :label-mode="mapLabelMode"
            :click-to-select="isMapPickModeEnabled"
            :initial-viewport="initialMapViewport"
            :reset-viewport="resetMapViewport"
            :optimize-route-order="shouldOptimizeRouteOrder"
            :show-nearby-places="routeNearbyDrawerOpen || routeNearbyPinnedPlaces.length > 0"
            :auto-search-nearby-places="false"
            :auto-locate-on-load="false"
            :single-route-point-zoom="PLANNER_START_CONTEXT_ZOOM"
            :nearby-place-pins="routeNearbyMapPins"
            :allow-route-point-removal="true"
            map-presentation="native"
            :show-map-style-toggle="true"
            :show-traffic="true"
            marker-variant="sequence"
            route-variant="planner"
            @map-click="handleRouteMapClick"
            @spot-select="handleRouteNearbyMapPointSelect"
            @nearby-place-add="handleMapNearbyPlaceAdd"
            @route-point-remove="handleMapRoutePointRemove"
          />
          <div v-else class="map-shell__placeholder" aria-hidden="true" />
          <div class="map-vignette" />
          <section
            class="map-nearby-drawer"
            :data-drawer-state="routeNearbyDrawerOpen ? 'open' : 'closed'"
            :data-drawer-size="routeNearbyDrawerExpanded ? 'expanded' : 'default'"
            data-test="route-nearby-drawer"
            aria-label="Nearby route stops"
          >
            <header class="map-nearby-drawer__header">
              <div>
                <p class="eyebrow">Nearby stops</p>
                <h3>{{ routeNearbyDrawerTitle }}</h3>
              </div>
              <div class="map-nearby-drawer__actions">
                <button
                  v-if="routeNearbyDrawerOpen"
                  type="button"
                  class="map-nearby-drawer__resize"
                  data-test="route-nearby-size-toggle"
                  :aria-pressed="String(routeNearbyDrawerExpanded)"
                  :aria-label="routeNearbyDrawerSizeLabel"
                  :title="routeNearbyDrawerSizeLabel"
                  @click="routeNearbyDrawerExpanded = !routeNearbyDrawerExpanded"
                >
                  <ScopeIcon name="map" label="" />
                </button>
                <button
                  type="button"
                  class="map-nearby-drawer__toggle"
                  data-test="route-nearby-toggle"
                  :aria-expanded="String(routeNearbyDrawerOpen)"
                  @click="toggleRouteNearbyDrawer"
                >
                  <ScopeIcon name="chevron-down" label="Toggle nearby stops" />
                </button>
              </div>
            </header>

            <div v-if="routeNearbyDrawerOpen" class="map-nearby-drawer__body">
              <p v-if="!routeNearbyAnchors.length" class="map-nearby-drawer__empty">
                Add a start point to browse nearby Scope picks.
              </p>

              <template v-else>
                <div class="map-nearby-layout">
                  <div class="map-nearby-controls">
                <div v-if="routeNearbyAnchors.length > 1" class="map-nearby-anchor-tabs" role="tablist" aria-label="Nearby search anchor">
                  <button
                  v-for="anchor in routeNearbyAnchors"
                  :key="anchor.id"
                  type="button"
                  class="map-nearby-anchor-tab"
                  :class="{ active: selectedRouteNearbyAnchorId === anchor.id }"
                  :aria-selected="String(selectedRouteNearbyAnchorId === anchor.id)"
                  role="tab"
                    @click="selectRouteNearbyAnchor(anchor.id)"
                  >
                    <strong>{{ anchor.shortLabel }}</strong>
                    <span>{{ anchor.placeLabel }}</span>
                  </button>
                </div>

                <div class="map-nearby-radius-control" role="group" aria-label="Nearby search radius">
                  <div class="map-nearby-radius-tabs">
                    <button
                      v-for="radiusOption in routeNearbyRadiusOptions"
                      :key="radiusOption.id"
                      type="button"
                      class="map-nearby-radius-tab"
                      :class="{ active: selectedRouteNearbyRadiusId === radiusOption.id }"
                      :aria-pressed="String(selectedRouteNearbyRadiusId === radiusOption.id)"
                      :title="getRouteNearbyRadiusTitle(radiusOption)"
                      data-test="route-nearby-radius"
                      @click="selectRouteNearbyRadius(radiusOption.id)"
                    >
                      {{ radiusOption.label }}
                    </button>
                  </div>
                  <label
                    class="map-nearby-radius-custom"
                    :class="{ active: selectedRouteNearbyRadiusId === ROUTE_NEARBY_CUSTOM_RADIUS_ID }"
                    :title="routeNearbyCustomRadiusTitle"
                    @click="selectRouteNearbyCustomRadius"
                  >
                    <span>Custom</span>
                    <input
                      v-model="routeNearbyCustomRadiusMiles"
                      type="number"
                      inputmode="decimal"
                      :min="ROUTE_NEARBY_CUSTOM_RADIUS_MIN_MI"
                      :max="ROUTE_NEARBY_CUSTOM_RADIUS_MAX_MI"
                      step="1"
                      aria-label="Custom nearby search radius in miles"
                      data-test="route-nearby-custom-radius"
                      @focus="selectRouteNearbyCustomRadius"
                      @input="handleRouteNearbyCustomRadiusInput"
                      @change="normalizeRouteNearbyCustomRadius"
                    />
                    <small>mi</small>
                  </label>
                </div>

                <div class="map-nearby-mode-tabs" role="tablist" aria-label="Nearby stop type">
                  <button
                    v-for="tab in routeNearbyTabs"
                    :key="tab.id"
                    type="button"
                    class="map-nearby-mode-tab"
                    :class="{ active: selectedRouteNearbyTabId === tab.id }"
                    :aria-selected="String(selectedRouteNearbyTabId === tab.id)"
                    role="tab"
                    @click="selectRouteNearbyTab(tab.id)"
                  >
                    <ScopeIcon v-if="tab.icon" :name="tab.icon" label="" />
                    <span>{{ tab.label }}</span>
                  </button>
                </div>

                <div v-if="selectedRouteNearbyTabId === 'fuel'" class="map-nearby-fuel-panel">
                  <div class="map-nearby-fuel-panel__header">
                    <span>Tank type</span>
                    <strong data-test="route-nearby-fuel-type">{{ selectedRouteNearbyFuelFilter.label }}</strong>
                  </div>
                  <div class="map-nearby-fuel-filters" role="group" aria-label="Fuel tank type">
                    <button
                      v-for="filter in routeNearbyFuelFilters"
                      :key="filter.id"
                      type="button"
                      class="map-nearby-fuel-filter"
                      :class="{ active: selectedRouteNearbyFuelFilterId === filter.id }"
                      :aria-pressed="String(selectedRouteNearbyFuelFilterId === filter.id)"
                      data-test="route-nearby-fuel-filter"
                      @click="selectRouteNearbyFuelFilter(filter.id)"
                    >
                      <ScopeIcon :name="filter.icon" label="" />
                      <span>{{ filter.label }}</span>
                    </button>
                  </div>
                  <div class="map-nearby-fuel-tools">
                    <label class="map-nearby-fuel-search">
                      <ScopeIcon name="search" label="" />
                      <input
                        v-model="routeNearbyFuelSearchQuery"
                        type="search"
                        placeholder="Search stations"
                        aria-label="Search fuel stations"
                        data-test="route-nearby-fuel-search"
                      />
                    </label>
                    <div class="map-nearby-fuel-sort" role="group" aria-label="Fuel result sort">
                      <button
                        v-for="sortOption in routeNearbyFuelSortOptions"
                        :key="sortOption.id"
                        type="button"
                        :class="{ active: selectedRouteNearbyFuelSortMode === sortOption.id }"
                        :aria-pressed="String(selectedRouteNearbyFuelSortMode === sortOption.id)"
                        data-test="route-nearby-fuel-sort"
                        @click="selectRouteNearbyFuelSortMode(sortOption.id)"
                      >
                        {{ sortOption.label }}
                      </button>
                    </div>
                  </div>
                </div>

                <div v-if="selectedRouteNearbyTabId !== 'fuel' && !routeNearbyDrawerExpanded" class="map-nearby-places-panel">
                  <div
                    v-if="selectedRouteNearbyTabId === 'recommended'"
                    class="map-nearby-filterbar"
                    :data-menu-open="routeNearbyFilterMenuOpen ? 'true' : 'false'"
                  >
                    <div class="map-nearby-filterbar__menu">
                      <button
                        type="button"
                        class="map-nearby-filterbar__trigger"
                        data-test="route-nearby-filter-trigger"
                        aria-haspopup="listbox"
                        :aria-expanded="String(routeNearbyFilterMenuOpen)"
                        @click="toggleRouteNearbyFilterMenu"
                      >
                        <ScopeIcon name="filter" label="" />
                        <span>Filter</span>
                        <strong>{{ routeNearbyFilterLabel }}</strong>
                        <ScopeIcon name="chevron-down" label="" />
                      </button>
                      <div
                        v-if="routeNearbyFilterMenuOpen"
                        class="map-nearby-filterbar__popover"
                        role="listbox"
                        data-test="route-nearby-filter-menu"
                      >
                        <button
                          v-for="query in routeNearbyDropdownQueries"
                          :key="query.id"
                          type="button"
                          class="map-nearby-filterbar__option"
                          :class="{ active: selectedRouteNearbyQueryId === query.id, 'has-icon': query.icon }"
                          role="option"
                          :aria-selected="String(selectedRouteNearbyQueryId === query.id)"
                          data-test="route-nearby-filter-option"
                          @click="selectRouteNearbyQuery(query.id)"
                        >
                          <ScopeIcon v-if="query.icon" :name="query.icon" label="" />
                          <span>{{ query.label }}</span>
                        </button>
                      </div>
                    </div>
                    <button
                      v-if="selectedRouteNearbyQueryId !== 'recommended' || routeNearbyCustomQuery.trim()"
                      type="button"
                      class="map-nearby-filterbar__clear"
                      data-test="route-nearby-filter-clear"
                      @click="resetRouteNearbyFilter"
                    >
                      Reset
                    </button>
                  </div>
                  <form class="map-nearby-search" data-test="route-nearby-search" @submit.prevent="submitRouteNearbySearch">
                    <ScopeIcon name="search" label="" />
                    <input
                      v-model="routeNearbyCustomQuery"
                      type="search"
                      placeholder="Search nearby"
                      aria-label="Search places nearby"
                    />
                    <button type="submit" :disabled="!routeNearbyCustomQuery.trim()">Find</button>
                  </form>
                </div>

                  </div>

                <div class="map-nearby-results-column">
                  <div v-if="selectedRouteNearbyTabId !== 'fuel' && routeNearbyDrawerExpanded" class="map-nearby-places-panel map-nearby-places-panel--results">
                    <div
                      v-if="selectedRouteNearbyTabId === 'recommended'"
                      class="map-nearby-filterbar"
                      :data-menu-open="routeNearbyFilterMenuOpen ? 'true' : 'false'"
                    >
                      <div class="map-nearby-filterbar__menu">
                        <button
                          type="button"
                          class="map-nearby-filterbar__trigger"
                          data-test="route-nearby-filter-trigger"
                          aria-haspopup="listbox"
                          :aria-expanded="String(routeNearbyFilterMenuOpen)"
                          @click="toggleRouteNearbyFilterMenu"
                        >
                          <ScopeIcon name="filter" label="" />
                          <span>Filter</span>
                          <strong>{{ routeNearbyFilterLabel }}</strong>
                          <ScopeIcon name="chevron-down" label="" />
                        </button>
                        <div
                          v-if="routeNearbyFilterMenuOpen"
                          class="map-nearby-filterbar__popover"
                          role="listbox"
                          data-test="route-nearby-filter-menu"
                        >
                          <button
                            v-for="query in routeNearbyDropdownQueries"
                            :key="query.id"
                            type="button"
                            class="map-nearby-filterbar__option"
                            :class="{ active: selectedRouteNearbyQueryId === query.id, 'has-icon': query.icon }"
                            role="option"
                            :aria-selected="String(selectedRouteNearbyQueryId === query.id)"
                            data-test="route-nearby-filter-option"
                            @click="selectRouteNearbyQuery(query.id)"
                          >
                            <ScopeIcon v-if="query.icon" :name="query.icon" label="" />
                            <span>{{ query.label }}</span>
                          </button>
                        </div>
                      </div>
                      <button
                        v-if="selectedRouteNearbyQueryId !== 'recommended' || routeNearbyCustomQuery.trim()"
                        type="button"
                        class="map-nearby-filterbar__clear"
                        data-test="route-nearby-filter-clear"
                        @click="resetRouteNearbyFilter"
                      >
                        Reset
                      </button>
                    </div>
                    <form class="map-nearby-search" data-test="route-nearby-search" @submit.prevent="submitRouteNearbySearch">
                      <ScopeIcon name="search" label="" />
                      <input
                        v-model="routeNearbyCustomQuery"
                        type="search"
                        placeholder="Search nearby"
                        aria-label="Search places nearby"
                      />
                      <button type="submit" :disabled="!routeNearbyCustomQuery.trim()">Find</button>
                    </form>
                  </div>

                <div class="map-nearby-results" data-test="route-nearby-results">
                  <p v-if="routeNearbyLoading" class="map-nearby-state">{{ routeNearbyLoadingLabel }}</p>
                  <p v-else-if="routeNearbyError" class="map-nearby-state map-nearby-state--error">{{ routeNearbyError }}</p>
                  <p v-else-if="!routeNearbyResults.length" class="map-nearby-state">{{ routeNearbyEmptyLabel }}</p>

                  <template v-else>
                    <button
                      v-for="place in routeNearbyResults"
                      :key="place.id"
                      type="button"
                      class="map-nearby-result"
                      :class="{ active: selectedRouteNearbyPlaceId === place.id, 'is-added': isRouteNearbyPlacePinned(place.id) }"
                      :data-place-kind="place.kind"
                      :data-category="getRouteNearbyCardCategory(place)"
                      data-test="route-nearby-add"
                      @click="addRouteNearbyPlace(place)"
                    >
                      <span class="map-nearby-result__visual" :data-has-photo="getRouteNearbyPhotoUrl(place) ? 'true' : 'false'">
                        <img
                          v-if="getRouteNearbyPhotoUrl(place)"
                          :src="getRouteNearbyPhotoUrl(place)"
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                        <ScopeIcon v-else :name="getRouteNearbyIcon(place)" label="" />
                      </span>
                      <span class="map-nearby-result__copy">
                        <strong>{{ place.title }}</strong>
                        <small class="map-nearby-result__location">{{ formatRouteNearbyResultLocation(place) }}</small>
                        <span class="map-nearby-result__tags">
                          <span class="map-nearby-result__category">{{ getRouteNearbyCategoryLabel(place) }}</span>
                          <span v-if="place.priceLabel" class="map-nearby-result__price">{{ place.priceLabel }}</span>
                        </span>
                      </span>
                      <span class="map-nearby-result__meta">
                        <strong>{{ getRouteNearbyDistanceValue(place) }}</strong>
                      </span>
                    </button>
                  </template>
                </div>
                <nav v-if="routeNearbyPageCount > 1 && !routeNearbyLoading && !routeNearbyError" class="map-nearby-pagination" aria-label="Nearby stop result pages">
                  <button
                    type="button"
                    data-test="route-nearby-page-prev"
                    :disabled="normalizedRouteNearbyCurrentPage <= 1"
                    aria-label="Previous nearby stops page"
                    @click="selectRouteNearbyPage(normalizedRouteNearbyCurrentPage - 1)"
                  >
                    &lt;
                  </button>
                  <span data-test="route-nearby-page-label">Page {{ normalizedRouteNearbyCurrentPage }} / {{ routeNearbyPageCount }}</span>
                  <button
                    type="button"
                    data-test="route-nearby-page-next"
                    :disabled="normalizedRouteNearbyCurrentPage >= routeNearbyPageCount"
                    aria-label="Next nearby stops page"
                    @click="selectRouteNearbyPage(normalizedRouteNearbyCurrentPage + 1)"
                  >
                    &gt;
                  </button>
                </nav>
                </div>
                </div>
              </template>
            </div>
          </section>
        </div>

        <section class="itinerary-detail-panel" :data-detail-state="itinerary ? 'built' : 'draft'" aria-label="Trip map planning details">

          <template v-if="itinerary">
          <header class="overlay-card summary-card planning-card planning-card--built" data-test="itinerary-summary-card">
            <div class="planning-card__header">
              <p class="eyebrow">Trip guide handoff</p>
              <h2>Guide-ready route</h2>
              <p class="summary-copy">{{ handoffSummaryCopy }}</p>
            </div>

            <div v-if="showRouteBriefEndpoints" class="planning-route-brief" data-test="itinerary-route-brief">
              <article v-if="showRouteBriefStart" class="planning-endpoint-card planning-endpoint-card--start">
                <span class="route-point-badge">S</span>
                <span>
                  <small>Start</small>
                  <strong>{{ routeBriefStartLabel }}</strong>
                </span>
              </article>
              <article v-if="showRouteBriefEnd" class="planning-endpoint-card planning-endpoint-card--end">
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
                <h2>Shape the route</h2>
                <p class="summary-copy route-card-copy">Pick start and end first; stops and vibes can stay optional.</p>
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
              <span
                data-test="route-fuel-cost"
                class="route-signal-fuel-tile"
                :class="{ 'is-actionable': routeFuelCost === null }"
                :role="routeFuelCost === null ? 'button' : undefined"
                :tabindex="routeFuelCost === null ? 0 : undefined"
                :title="fuelMetricTitle"
                @click="requestFuelSettings"
                @keydown.enter.prevent="requestFuelSettings"
                @keydown.space.prevent="requestFuelSettings"
              >
                <strong>{{ routeFuelCostLabel }}</strong>
                <small>Fuel cost</small>
              </span>
              <span data-test="route-drive-score">
                <strong>{{ driveScoreLabel }}</strong>
                <small>{{ driveScoreDifficultyLabel }}</small>
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
                :disabled="!canPickAfterStart"
                :class="{ active: isMapPickModeEnabled && activeMapPickTarget === 'routeStop' }"
                :aria-pressed="String(isMapPickModeEnabled && activeMapPickTarget === 'routeStop')"
                :title="!canPickAfterStart ? 'Pick start first' : activeMapPickTarget === 'routeStop' && isMapPickModeEnabled ? mapPickStatusCopy : 'Add stop from map'"
                @click="setMapPickTarget('routeStop')"
              >
                <ScopeIcon name="plus" label="Add stop from map" />
                <span>Stop</span>
              </button>
              <button
                type="button"
                class="map-picker-button"
                data-test="map-pick-end"
                :disabled="!canPickAfterStart"
                :class="{ active: isMapPickModeEnabled && activeMapPickTarget === 'endDestination' }"
                :aria-pressed="String(isMapPickModeEnabled && activeMapPickTarget === 'endDestination')"
                :title="!canPickAfterStart ? 'Pick start first' : activeMapPickTarget === 'endDestination' && isMapPickModeEnabled ? mapPickStatusCopy : 'Pick end on map'"
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

            <div class="planning-route-card__extra">
              <p class="map-picker-status" :class="{ visible: isMapPickModeEnabled || mapPickState === 'error' }" aria-live="polite">
                {{ mapPickStatusCopy }}
              </p>

              <div v-if="draftRouteSequence.length" class="route-sequence-list" data-test="itinerary-route-sequence-list" aria-label="Current route points">
                <div
                  v-for="point in draftRouteSequence"
                  :key="point.id"
                  class="route-sequence-chip"
                  :data-route-role="point.routeRole ?? 'stop'"
                  role="button"
                  tabindex="0"
                  :aria-label="`Focus ${point.title} on the map`"
                  @click="selectRouteSequencePoint(point)"
                  @keydown.enter.prevent="selectRouteSequencePoint(point)"
                  @keydown.space.prevent="selectRouteSequencePoint(point)"
                >
                  <strong>{{ point.routeLabel }}</strong>
                  <span>{{ formatLocationPreview(point.title) }}</span>
                  <button
                    v-if="isRemovableRouteSequencePoint(point)"
                    type="button"
                    :aria-label="`Remove ${point.title}`"
                    @click.stop="removeRouteSequencePoint(point)"
                    @keydown.stop
                  >
                    <ScopeIcon name="close" label="" />
                  </button>
                </div>
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
                        <small
                          v-if="formatTimelineSpotReason(spot)"
                          class="stop-ai-reason"
                          data-test="itinerary-stop-ai-reason"
                        >
                          {{ formatTimelineSpotReason(spot) }}
                        </small>
                      </div>
                      <div class="timeline-stop-controls">
                        <label class="timeline-edit-field">
                          <span>Day</span>
                          <input
                            type="text"
                            inputmode="numeric"
                            pattern="[0-9]*"
                            autocomplete="off"
                            autocapitalize="off"
                            spellcheck="false"
                            name="scope-timeline-day"
                            aria-label="Day number"
                            maxlength="2"
                            :value="spot.dayNumber ?? day.dayNumber"
                            data-test="itinerary-stop-day-input"
                            @focus="selectTimelineInputText"
                            @dblclick="selectTimelineInputText"
                            @input="sanitizeTimelineDayInput"
                            @change="handleTimelineDayChange(spot.spotId, $event, spot.dayNumber ?? day.dayNumber)"
                            @blur="resetInvalidTimelineDayInput($event, spot.dayNumber ?? day.dayNumber)"
                          />
                        </label>
                        <label class="timeline-edit-field">
                          <span>Time</span>
                          <input
                            type="text"
                            inputmode="numeric"
                            pattern="[0-9:]*"
                            autocomplete="off"
                            autocapitalize="off"
                            spellcheck="false"
                            name="scope-timeline-time"
                            aria-label="Time"
                            maxlength="5"
                            :value="normalizeTimeSlot(spot.timeSlot)"
                            data-test="itinerary-stop-time-input"
                            @focus="selectTimelineInputText"
                            @dblclick="selectTimelineInputText"
                            @input="sanitizeTimelineTimeInput"
                            @change="handleTimelineTimeChange(spot.spotId, $event, normalizeTimeSlot(spot.timeSlot))"
                            @blur="resetInvalidTimelineTimeInput($event, normalizeTimeSlot(spot.timeSlot))"
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
          <header
            class="overlay-card summary-card planning-card"
            data-test="itinerary-planning-card"
            :data-route-canvas-density="routeCanvasDensity"
          >
            <div class="planning-card__header">
              <p class="eyebrow">Trip guide handoff</p>
              <h2>Guide-ready route</h2>
              <p class="summary-copy">{{ handoffSummaryCopy }}</p>
            </div>

            <div v-if="showRouteBriefEndpoints" class="planning-route-brief" data-test="planning-route-brief">
              <article v-if="showRouteBriefStart" class="planning-endpoint-card planning-endpoint-card--start">
                <span class="route-point-badge">S</span>
                <span>
                  <small>Start</small>
                  <strong>{{ routeBriefStartLabel }}</strong>
                </span>
              </article>
              <article v-if="showRouteBriefEnd" class="planning-endpoint-card planning-endpoint-card--end">
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
                <h2>Shape the route</h2>
                <p class="summary-copy route-card-copy">Pick start and end first; stops and vibes can stay optional.</p>
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
              <span
                data-test="route-fuel-cost"
                class="route-signal-fuel-tile"
                :class="{ 'is-actionable': routeFuelCost === null }"
                :role="routeFuelCost === null ? 'button' : undefined"
                :tabindex="routeFuelCost === null ? 0 : undefined"
                :title="fuelMetricTitle"
                @click="requestFuelSettings"
                @keydown.enter.prevent="requestFuelSettings"
                @keydown.space.prevent="requestFuelSettings"
              >
                <strong>{{ routeFuelCostLabel }}</strong>
                <small>Fuel cost</small>
              </span>
              <span data-test="route-drive-score">
                <strong>{{ driveScoreLabel }}</strong>
                <small>{{ driveScoreDifficultyLabel }}</small>
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
              <span
                class="route-signal-fuel-tile is-actionable"
                role="button"
                tabindex="0"
                :title="fuelMetricTitle"
                @click="requestFuelSettings"
                @keydown.enter.prevent="requestFuelSettings"
                @keydown.space.prevent="requestFuelSettings"
              >
                <strong>Set fuel</strong>
                <small>Fuel cost</small>
              </span>
              <span>
                <strong>Add route</strong>
                <small>Drive score</small>
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
                :disabled="!canPickAfterStart"
                :class="{ active: isMapPickModeEnabled && activeMapPickTarget === 'routeStop' }"
                :aria-pressed="String(isMapPickModeEnabled && activeMapPickTarget === 'routeStop')"
                :title="!canPickAfterStart ? 'Pick start first' : activeMapPickTarget === 'routeStop' && isMapPickModeEnabled ? mapPickStatusCopy : 'Add stop from map'"
                @click="setMapPickTarget('routeStop')"
              >
                <ScopeIcon name="plus" label="Add stop from map" />
                <span>Stop</span>
              </button>
              <button
                type="button"
                class="map-picker-button"
                data-test="map-pick-end"
                :disabled="!canPickAfterStart"
                :class="{ active: isMapPickModeEnabled && activeMapPickTarget === 'endDestination' }"
                :aria-pressed="String(isMapPickModeEnabled && activeMapPickTarget === 'endDestination')"
                :title="!canPickAfterStart ? 'Pick start first' : activeMapPickTarget === 'endDestination' && isMapPickModeEnabled ? mapPickStatusCopy : 'Pick end on map'"
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

            <div class="planning-route-card__extra">
              <p class="map-picker-status" :class="{ visible: isMapPickModeEnabled || mapPickState === 'error' }" aria-live="polite">
                {{ mapPickStatusCopy }}
              </p>

              <div v-if="draftRouteSequence.length" class="route-sequence-list" data-test="route-sequence-list" aria-label="Draft route points">
                <div
                  v-for="point in draftRouteSequence"
                  :key="point.id"
                  class="route-sequence-chip"
                  :data-route-role="point.routeRole ?? 'stop'"
                  role="button"
                  tabindex="0"
                  :aria-label="`Focus ${point.title} on the map`"
                  @click="selectRouteSequencePoint(point)"
                  @keydown.enter.prevent="selectRouteSequencePoint(point)"
                  @keydown.space.prevent="selectRouteSequencePoint(point)"
                >
                  <strong>{{ point.routeLabel }}</strong>
                  <span>{{ formatLocationPreview(point.title) }}</span>
                  <button
                    v-if="isRemovableRouteSequencePoint(point)"
                    type="button"
                    :aria-label="`Remove ${point.title}`"
                    @click.stop="removeRouteSequencePoint(point)"
                    @keydown.stop
                  >
                    <ScopeIcon name="close" label="" />
                  </button>
                </div>
              </div>
            </div>
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
                          <small
                            v-if="formatTimelineSpotReason(spot)"
                            class="stop-ai-reason"
                            data-test="itinerary-stop-ai-reason"
                          >
                            {{ formatTimelineSpotReason(spot) }}
                          </small>
                        </div>
                        <div class="timeline-stop-controls">
                          <label class="timeline-edit-field">
                            <span>Day</span>
                            <input
                              type="text"
                              inputmode="numeric"
                              pattern="[0-9]*"
                              autocomplete="off"
                              autocapitalize="off"
                              spellcheck="false"
                              name="scope-timeline-day"
                              aria-label="Day number"
                              maxlength="2"
                              :value="spot.dayNumber ?? day.dayNumber"
                              data-test="itinerary-stop-day-input"
                              @focus="selectTimelineInputText"
                              @dblclick="selectTimelineInputText"
                              @input="sanitizeTimelineDayInput"
                              @change="handleTimelineDayChange(spot.spotId, $event, spot.dayNumber ?? day.dayNumber)"
                              @blur="resetInvalidTimelineDayInput($event, spot.dayNumber ?? day.dayNumber)"
                            />
                          </label>
                          <label class="timeline-edit-field">
                            <span>Time</span>
                            <input
                              type="text"
                              inputmode="numeric"
                              pattern="[0-9:]*"
                              autocomplete="off"
                              autocapitalize="off"
                              spellcheck="false"
                              name="scope-timeline-time"
                              aria-label="Time"
                              maxlength="5"
                              :value="normalizeTimeSlot(spot.timeSlot)"
                              data-test="itinerary-stop-time-input"
                              @focus="selectTimelineInputText"
                              @dblclick="selectTimelineInputText"
                              @input="sanitizeTimelineTimeInput"
                              @change="handleTimelineTimeChange(spot.spotId, $event, normalizeTimeSlot(spot.timeSlot))"
                              @blur="resetInvalidTimelineTimeInput($event, normalizeTimeSlot(spot.timeSlot))"
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

          <div v-if="$slots.assistant" class="itinerary-assistant-slot" data-test="itinerary-ai-slot">
            <slot name="assistant" />
          </div>
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
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import MapView from '@/components/map/MapView.vue';
import { reverseGeocode, searchNearbyPlaces, searchPlaces, type GeocodeResult, type PlaceSearchResult } from '@/services/mapService';
import { prewarmConfiguredMapboxRuntime } from '@/services/mapboxLoader';
import { getNearbyFuelStations } from '@/services/fuelPriceService';
import { getTravelNearbySuggestions } from '@/services/travelNearbyService';
import { resolveRoadRoute, type RoadRouteSummary } from '@/services/roadRouteService';
import { listNearbySpots } from '@/services/spotService';
import { addCalendarDays, formatWeekdayMonthDay, getInclusiveDaySpan } from '@/utils/formatters';
import type { FuelStationPrice, Itinerary, MapNearbyPlacePin, MapPoint, MapViewport, SpotSummary, TripFuelSettings, TripFuelType, TripMember, TripPlannerInput, TripSpot } from '@/types';
import { resolveTripStopPhotoUrl } from '@/utils/imageFallbacks';
import { scheduleNonCriticalTask, type CancelScheduledTask } from '@/utils/scheduleNonCriticalTask';
import type { ScopeAiMapCommand, ScopeAiMapCommandPayload } from '@/stores/scopeAiPlanner';
import {
  ROUTE_NEARBY_CUSTOM_RADIUS_ID,
  ROUTE_NEARBY_CUSTOM_RADIUS_MAX_MI,
  ROUTE_NEARBY_CUSTOM_RADIUS_MIN_MI,
  ROUTE_NEARBY_MAP_PIN_LIMIT,
  ROUTE_NEARBY_PROVIDER_RADIUS_LIMIT_KM,
  ROUTE_NEARBY_RESULT_LIMIT,
  createItineraryRouteNearbyHelpers,
  normalizeTripFuelType,
  routeNearbyExtraFilterQueryIds,
  routeNearbyFuelFilters,
  routeNearbyFuelSortOptions,
  routeNearbyQueries,
  routeNearbyRadiusOptions,
  routeNearbyTabs,
  type RouteNearbyAnchor,
  type RouteNearbyFuelFilter,
  type RouteNearbyFuelFilterId,
  type RouteNearbyFuelPriceSelection,
  type RouteNearbyFuelSortMode,
  type RouteNearbyPlace,
  type RouteNearbyQuery,
  type RouteNearbyQueryId,
  type RouteNearbyRadiusOption,
  type RouteNearbyTabId,
} from '@/components/trips/itineraryRouteNearbyHelpers';
import {
  DEFAULT_TIMELINE_TIME_SLOTS,
  MAX_REASONABLE_TIMELINE_DAYS,
  TIMELINE_END_ENDPOINT_ID,
  TIMELINE_END_TIME_SLOT,
  TIMELINE_START_ENDPOINT_ID,
  TIMELINE_START_TIME_SLOT,
  clampTimelineDayNumber,
  compareTimelineStops,
  formatCoordinateLabel,
  formatTimelineSpotReason,
  getTimelineSpotBadgeText,
  hasCoordinatePair,
  isSyntheticTimelineEndpoint,
  labelTimelineStops,
  normalizeTimeSlot,
  parseTimelineTimeInput,
  stripTimelineMetadata,
  type TimelineRouteRole,
  type TimelineTripSpot,
} from '@/components/trips/itineraryTimelineHelpers';

type PlannerWizardStep = 1 | 2 | 3 | 4;
type LocationPickTarget = 'destination' | 'endDestination';
type MapPickTarget = 'destination' | 'routeStop' | 'endDestination';
type MapPickState = 'idle' | 'armed' | 'locating' | 'error';
type MapLabelMode = 'none' | 'states' | 'majorCities' | 'full';
type PlannerMapViewHandle = InstanceType<typeof MapView> & {
  runPlannerMapCommand?: (command: ScopeAiMapCommand | ScopeAiMapCommandPayload) => Promise<{ ok: boolean; message: string }>;
};
type RouteSequencePoint = Pick<MapPoint, 'id' | 'title' | 'routeRole' | 'routeLabel'> & Partial<Pick<MapPoint, 'latitude' | 'longitude'>>;
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

type DriveScoreDifficulty = 'Easy' | 'Moderate' | 'Challenging';

interface DriveScoreSnapshot {
  score: number;
  difficulty: DriveScoreDifficulty;
}

const props = withDefaults(
  defineProps<{
    itinerary: Itinerary | null;
    draft?: Partial<TripPlannerInput>;
    tripTitle?: string;
    members?: TripMember[];
    stops?: TripSpot[];
    initialMapViewport?: MapViewport;
    resetMapViewport?: MapViewport;
    submitting?: boolean;
    mobileWizard?: boolean;
    mobileActiveStep?: PlannerWizardStep;
    fuelSettings?: TripFuelSettings;
  }>(),
  {
    draft: () => ({}),
    tripTitle: '',
    members: () => [],
    stops: () => [],
    submitting: false,
    mobileWizard: false,
    mobileActiveStep: 4 as PlannerWizardStep,
    fuelSettings: () => ({}),
  },
);

const emit = defineEmits<{
  (event: 'wizard-step-change', payload: PlannerWizardStep): void;
  (event: 'map-location-select', payload: PlannerMapLocationSelection): void;
  (event: 'route-stop-add', payload: TripSpot): void;
  (event: 'route-stop-remove', payload: string): void;
  (event: 'route-endpoint-remove', payload: LocationPickTarget): void;
  (event: 'itinerary-stops-update', payload: TripSpot[]): void;
  (event: 'fuel-settings-request'): void;
  (event: 'fuel-price-select', payload: RouteNearbyFuelPriceSelection): void;
  (event: 'fuel-type-select', payload: TripFuelType): void;
}>();

const shouldRenderMap = ref(false);
const plannerMapView = ref<PlannerMapViewHandle | null>(null);
const cancelMapboxRuntimePrewarm = scheduleNonCriticalTask(() => {
  if (shouldRenderMap.value) {
    return;
  }

  void prewarmConfiguredMapboxRuntime().catch(() => undefined);
}, { delayMs: 420, timeoutMs: 1_300 });
const activeMapPickTarget = ref<MapPickTarget>('destination');
const mapPickState = ref<MapPickState>('idle');
const pendingStartPick = ref(false);
const startAutoAdvanceLocked = ref(false);
const routeSummary = ref<RoadRouteSummary | null>(null);
const routeSummaryKey = ref('');
const routeNearbyDrawerOpen = ref(false);
const routeNearbyDrawerTouched = ref(false);
const routeNearbyDrawerExpanded = ref(false);
const selectedRouteNearbyTabId = ref<RouteNearbyTabId>('recommended');
const selectedRouteNearbyAnchorId = ref('');
const selectedRouteNearbyQueryId = ref<RouteNearbyQueryId>('recommended');
const selectedRouteNearbyFuelFilterId = ref<RouteNearbyFuelFilterId>(normalizeTripFuelType(props.fuelSettings?.fuelType));
const selectedRouteNearbyFuelSortMode = ref<RouteNearbyFuelSortMode>('closest');
const selectedRouteNearbyRadiusId = ref('20mi');
const routeNearbyCustomRadiusMiles = ref('40');
const selectedRouteNearbyPlaceId = ref('');
const routeNearbyCurrentPage = ref(1);
const routeNearbyCustomQuery = ref('');
const routeNearbyFuelSearchQuery = ref('');
const routeNearbyFilterMenuOpen = ref(false);
const routeNearbySearchResults = ref<RouteNearbyPlace[]>([]);
const routeNearbyPinnedPlaces = ref<RouteNearbyPlace[]>([]);
const routeNearbyLoading = ref(false);
const routeNearbyError = ref('');
const timelineEndpointOverrides = ref<Record<string, Partial<Pick<TripSpot, 'dayNumber' | 'timeSlot'>>>>({});
const hasManualTimelineOrder = ref(false);
let cancelMapRender: CancelScheduledTask = () => undefined;
let routeSummaryRequestId = 0;
let routeNearbyRequestId = 0;

const METERS_PER_MILE = 1609.344;
const ITINERARY_DAY_IMAGE_WIDTH = 800;
const PLANNER_START_CONTEXT_ZOOM = 7.2;
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
  if (target !== 'destination' && !canPickAfterStart.value) {
    activeMapPickTarget.value = 'destination';
    mapPickState.value = 'armed';
    return;
  }

  if (target === 'destination' && canPickAfterStart.value) {
    startAutoAdvanceLocked.value = true;
  }

  activeMapPickTarget.value = target;
  mapPickState.value = 'armed';
}

function clearMapPickTarget(): void {
  mapPickState.value = 'idle';
  pendingStartPick.value = false;
  startAutoAdvanceLocked.value = false;
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
  const shouldAdvanceToEndAfterStart = selectedTarget === 'destination' &&
    !startAutoAdvanceLocked.value &&
    !draftEndDestination.value &&
    !hasExplicitDraftEnd.value;

  if (selectedTarget !== 'destination' && !canPickAfterStart.value) {
    activeMapPickTarget.value = 'destination';
    mapPickState.value = 'armed';
    return;
  }

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
    if (shouldAdvanceToEndAfterStart) {
      pendingStartPick.value = true;
      activeMapPickTarget.value = 'endDestination';
    } else {
      activeMapPickTarget.value = selectedTarget;
    }
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

function getDraftTimelineDaySpan(): number {
  const startDate = props.draft?.startDate ?? '';
  const endDate = props.draft?.endDate ?? startDate;
  return startDate ? getInclusiveDaySpan(startDate, endDate) : Math.max(1, props.itinerary?.days.length ?? 1);
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

  if (props.itinerary) {
    const itineraryDaySpan = props.itinerary.days.reduce((maxDay, day) => Math.max(maxDay, day.dayNumber), 0);
    const expectedDaySpan = Math.max(getDraftTimelineDaySpan(), itineraryDaySpan);
    for (let dayNumber = 1; dayNumber <= expectedDaySpan; dayNumber += 1) {
      dayLookup.set(dayNumber, {
        dayNumber,
        date: resolveTimelineDate(dayNumber),
        spots: [],
      });
    }
  }

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

function getTimelineInput(event: Event): HTMLInputElement | null {
  return event.target instanceof HTMLInputElement ? event.target : null;
}

function selectTimelineInputText(event: Event): void {
  if (event.target instanceof HTMLInputElement) {
    event.target.select();
  }
}

function sanitizeTimelineDayInput(event: Event): void {
  const input = getTimelineInput(event);
  if (!input) {
    return;
  }

  const sanitizedValue = input.value.replace(/\D/g, '').slice(0, 2);
  if (input.value !== sanitizedValue) {
    input.value = sanitizedValue;
  }
}

function sanitizeTimelineTimeInput(event: Event): void {
  const input = getTimelineInput(event);
  if (!input) {
    return;
  }

  const cleanedValue = input.value.replace(/[^\d:]/g, '');
  const [hourPart = '', ...minuteParts] = cleanedValue.split(':');
  const sanitizedValue = minuteParts.length
    ? `${hourPart.slice(0, 2)}:${minuteParts.join('').slice(0, 2)}`
    : hourPart.slice(0, 4);

  if (input.value !== sanitizedValue) {
    input.value = sanitizedValue;
  }
}

function parseTimelineDayInput(value: string): number | null {
  const trimmedValue = value.trim();
  if (!/^\d{1,2}$/.test(trimmedValue)) {
    return null;
  }

  const parsedDay = Number.parseInt(trimmedValue, 10);
  if (!Number.isFinite(parsedDay) || parsedDay < 1) {
    return null;
  }

  return clampTimelineDayNumber(parsedDay, maxEditableTimelineDay.value);
}

function resetTimelineDayInput(event: Event, fallbackDayNumber: number): void {
  const input = getTimelineInput(event);
  if (input) {
    input.value = String(clampTimelineDayNumber(fallbackDayNumber, maxEditableTimelineDay.value));
  }
}

function resetTimelineTimeInput(event: Event, fallbackTimeSlot: string): void {
  const input = getTimelineInput(event);
  if (input) {
    input.value = normalizeTimeSlot(fallbackTimeSlot);
  }
}

function resetInvalidTimelineDayInput(event: Event, fallbackDayNumber: number): void {
  if (parseTimelineDayInput(getInputValue(event)) === null) {
    resetTimelineDayInput(event, fallbackDayNumber);
  }
}

function resetInvalidTimelineTimeInput(event: Event, fallbackTimeSlot: string): void {
  if (parseTimelineTimeInput(getInputValue(event)) === null) {
    resetTimelineTimeInput(event, fallbackTimeSlot);
  }
}

function handleTimelineDayChange(spotId: string, event: Event, fallbackDayNumber: number): void {
  sanitizeTimelineDayInput(event);
  const nextDayNumber = parseTimelineDayInput(getInputValue(event));
  if (nextDayNumber === null) {
    resetTimelineDayInput(event, fallbackDayNumber);
    return;
  }

  resetTimelineDayInput(event, nextDayNumber);
  emitTimelineStopUpdate(spotId, {
    dayNumber: nextDayNumber,
  });
}

function handleTimelineTimeChange(spotId: string, event: Event, fallbackTimeSlot: string): void {
  sanitizeTimelineTimeInput(event);
  const nextTimeSlot = parseTimelineTimeInput(getInputValue(event));
  if (!nextTimeSlot) {
    resetTimelineTimeInput(event, fallbackTimeSlot);
    return;
  }

  resetTimelineTimeInput(event, nextTimeSlot);
  emitTimelineStopUpdate(spotId, {
    timeSlot: nextTimeSlot,
  });
}

const rawDraftDestination = computed(() => props.draft?.destination?.trim() ?? '');
const rawDraftEndDestination = computed(() => props.draft?.endDestination?.trim() ?? '');
const hasExplicitDraftStart = computed(() =>
  hasCoordinatePair(props.draft?.destinationLatitude, props.draft?.destinationLongitude),
);
const hasExplicitDraftEnd = computed(() =>
  hasCoordinatePair(props.draft?.endDestinationLatitude, props.draft?.endDestinationLongitude),
);
const draftDestination = computed(() =>
  normalizeDraftEndpointLabel(rawDraftDestination.value, hasExplicitDraftStart.value),
);
const draftEndDestination = computed(() =>
  normalizeDraftEndpointLabel(rawDraftEndDestination.value, hasExplicitDraftEnd.value),
);
const hasDraftEndpoint = computed(() =>
  Boolean(draftDestination.value || draftEndDestination.value || hasExplicitDraftStart.value || hasExplicitDraftEnd.value),
);
const canPickAfterStart = computed(() =>
  Boolean(draftDestination.value || hasExplicitDraftStart.value || pendingStartPick.value),
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

  if (!canPickAfterStart.value && activeMapPickTarget.value !== 'destination') {
    return 'Pick the start city before adding stops or an end point.';
  }

  if (activeMapPickTarget.value === 'routeStop' && isMapPickModeEnabled.value) {
    return 'Click the map to add another stop between start and end.';
  }

  if (isMapPickModeEnabled.value) {
    return `Click the map to fill the ${mapPickTargetLabel.value} city.`;
  }

  return draftDestination.value ? planningRouteLabel.value : 'Use the pointer to fill the start city from the map.';
});

watch(canPickAfterStart, (canPick) => {
  if (canPick || activeMapPickTarget.value === 'destination') {
    return;
  }

  activeMapPickTarget.value = 'destination';
  if (isMapPickModeEnabled.value) {
    mapPickState.value = 'armed';
  }
});

watch(
  [draftDestination, hasExplicitDraftStart],
  ([destinationLabel, hasStartCoordinates]) => {
    if (destinationLabel || hasStartCoordinates) {
      pendingStartPick.value = false;
    }
  },
);

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
    const pointCount = draftRouteSequence.value.length;
    if (pointCount > 1) {
      return `${pointCount} real route points selected. The guide can build from the drive now; vibes only steer the style.`;
    }

    if (pointCount === 1) {
      return 'One real route point set. Add the other endpoint so the guide can use the actual route.';
    }

    return 'Set a real start and final destination first. The guide uses those points before suggesting stops.';
  }

  return `Route guide ready for ${props.itinerary.destination}. Keep the stops that match the actual drive, then publish when it feels right.`;
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
function isMapboxAuthoritativeRoute(summary: RoadRouteSummary | null): boolean {
  if (!summary) {
    return false;
  }

  return summary.routeQuality === 'mapbox' ||
    (summary.routeQuality === undefined && summary.provider.startsWith('mapbox-'));
}

const hasAuthoritativeRouteMetrics = computed(() => isMapboxAuthoritativeRoute(currentRouteSummary.value));
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
const routeNearbyAnchors = computed<RouteNearbyAnchor[]>(() => {
  const routePoints = displayMapSpots.value.filter((point) => hasCoordinatePair(point.latitude, point.longitude));
  if (!routePoints.length) {
    return [];
  }

  const seenAnchorIds = new Set<string>();

  return routePoints.reduce<RouteNearbyAnchor[]>((anchors, point) => {
    if (seenAnchorIds.has(point.id)) {
      return anchors;
    }

    seenAnchorIds.add(point.id);
    anchors.push({
      id: point.id,
      shortLabel: point.routeLabel || (point.routeRole === 'start' ? 'S' : point.routeRole === 'end' ? 'E' : 'Stop'),
      placeLabel: formatLocationPreview(point.title),
      latitude: point.latitude,
      longitude: point.longitude,
      routeRole: point.routeRole,
    });
    return anchors;
  }, []);
});
const selectedRouteNearbyAnchor = computed(() =>
  routeNearbyAnchors.value.find((anchor) => anchor.id === selectedRouteNearbyAnchorId.value) ?? routeNearbyAnchors.value[0] ?? null,
);
const selectedRouteNearbyQuery = computed(() =>
  routeNearbyQueries.find((query) => query.id === selectedRouteNearbyQueryId.value) ?? {
    id: 'custom',
    label: 'Custom',
    query: routeNearbyCustomQuery.value.trim() || 'places',
    icon: 'search',
  },
);
const routeNearbyDropdownQueryIds: RouteNearbyQueryId[] = [
  'recommended',
  'food',
  'stay',
  'essentials',
  'scenic',
  ...routeNearbyExtraFilterQueryIds,
];
const routeNearbyDropdownQueries = computed(() =>
  routeNearbyDropdownQueryIds
    .map((queryId) => routeNearbyQueries.find((query) => query.id === queryId))
    .filter((query): query is RouteNearbyQuery => Boolean(query)),
);
const routeNearbyFilterLabel = computed(() => {
  if (selectedRouteNearbyQueryId.value === 'custom') {
    const searchLabel = routeNearbyCustomQuery.value.trim();
    return searchLabel ? `Search: ${searchLabel}` : 'Custom search';
  }

  if (selectedRouteNearbyQueryId.value === 'recommended') {
    return 'Best picks';
  }

  return selectedRouteNearbyQuery.value.label;
});
const routeNearbyDrawerSizeLabel = computed(() => (
  routeNearbyDrawerExpanded.value ? 'Keep nearby stops half width' : 'Expand nearby stops'
));
const selectedRouteNearbyFuelFilter = computed(() =>
  routeNearbyFuelFilters.find((filter) => filter.id === selectedRouteNearbyFuelFilterId.value) ?? routeNearbyFuelFilters[0],
);
const routeNearbyCustomRadiusOption = computed<RouteNearbyRadiusOption>(() => getRouteNearbyCustomRadiusOption());
const selectedRouteNearbyRadiusOption = computed<RouteNearbyRadiusOption>(() => getSelectedRouteNearbyRadiusOption());
const selectedRouteNearbyRadiusKm = computed(() => selectedRouteNearbyRadiusOption.value.radiusKm);
const routeNearbyCustomRadiusTitle = computed(() => getRouteNearbyRadiusTitle(routeNearbyCustomRadiusOption.value));
const routeNearbyDrawerTitle = computed(() => {
  if (!routeNearbyAnchors.value.length) {
    return 'Browse from the map';
  }

  const anchor = selectedRouteNearbyAnchor.value;
  return anchor ? `Near ${anchor.placeLabel}` : 'Along this route';
});
const routeNearbyLoadingLabel = computed(() => (
  selectedRouteNearbyTabId.value === 'fuel' ? 'Finding fuel stops.' : 'Finding best picks.'
));
const routeNearbyEmptyLabel = computed(() => (
  selectedRouteNearbyTabId.value === 'fuel'
    ? `No live ${selectedRouteNearbyFuelFilter.value.label.toLowerCase()} prices within ${selectedRouteNearbyRadiusOption.value.label}. Widen the range or choose another route point.`
    : `No strong picks within ${selectedRouteNearbyRadiusOption.value.label}. Widen the range or choose another route point.`
));
const routeNearbyVisibleSearchResults = computed<RouteNearbyPlace[]>(() =>
  selectedRouteNearbyTabId.value === 'fuel'
    ? filterAndSortRouteNearbyFuelPlaces(routeNearbySearchResults.value)
    : filterRouteNearbyPlacesWithinSelectedRadius(routeNearbySearchResults.value),
);
const routeNearbyAllResults = computed<RouteNearbyPlace[]>(() => {
  const pinnedPlacesForTab = routeNearbyPinnedPlaces.value
    .filter((place) => place.kind === selectedRouteNearbyTabId.value)
    .filter(isWithinSelectedRouteNearbyRadius);
  return dedupeRouteNearbyPlaces(
    [...pinnedPlacesForTab, ...routeNearbyVisibleSearchResults.value],
    ROUTE_NEARBY_MAP_PIN_LIMIT + pinnedPlacesForTab.length,
  );
});
const routeNearbyPageCount = computed(() => Math.max(1, Math.ceil(routeNearbyAllResults.value.length / ROUTE_NEARBY_RESULT_LIMIT)));
const normalizedRouteNearbyCurrentPage = computed(() => clampNumber(routeNearbyCurrentPage.value, 1, routeNearbyPageCount.value));
const routeNearbyResults = computed<RouteNearbyPlace[]>(() => {
  const pageIndex = normalizedRouteNearbyCurrentPage.value - 1;
  const startIndex = pageIndex * ROUTE_NEARBY_RESULT_LIMIT;
  return routeNearbyAllResults.value.slice(startIndex, startIndex + ROUTE_NEARBY_RESULT_LIMIT);
});
const routeNearbyMapPlaces = computed<RouteNearbyPlace[]>(() =>
  dedupeRouteNearbyPlaces(
    routeNearbyDrawerOpen.value
      ? [...routeNearbyPinnedPlaces.value, ...routeNearbyVisibleSearchResults.value]
      : [...routeNearbyPinnedPlaces.value],
    Math.max(ROUTE_NEARBY_MAP_PIN_LIMIT, ROUTE_NEARBY_RESULT_LIMIT + routeNearbyPinnedPlaces.value.length),
  ),
);
const routeNearbyMapPins = computed<MapNearbyPlacePin[]>(() =>
  routeNearbyMapPlaces.value.slice(0, ROUTE_NEARBY_MAP_PIN_LIMIT).map((place) => ({
    id: `route-nearby-${place.id}`,
    title: place.title,
    latitude: place.latitude,
    longitude: place.longitude,
    kind: place.kind === 'fuel' ? 'fuel' : 'place',
    category: place.kind === 'fuel' ? 'fuel' : place.category,
    iconName: place.iconName ?? getRouteNearbyIcon(place),
    categoryLabel: getRouteNearbyCategoryLabel(place),
    address: place.address ?? place.subtitle,
    subtitle: place.subtitle,
    photoUrl: getRouteNearbyPhotoUrl(place) || place.photoUrl,
    photoLookupStatus: 'complete',
    sourceLabel: place.sourceLabel ?? getRouteNearbySourceLabel(place),
    distanceLabel: formatRouteNearbyDistance(getRouteNearbyPlaceDistanceKm(place) ?? undefined),
    priceLabel: place.priceLabel,
  })),
);
const displayMapPins = computed<MapPoint[]>(() => {
  const existingIds = new Set<string>();
  return displayMapSpots.value.filter((point) => {
    if (existingIds.has(point.id)) {
      return false;
    }

    existingIds.add(point.id);
    return true;
  });
});
const mapLabelMode = computed<MapLabelMode>(() => {
  const viewportZoom = props.initialMapViewport?.zoom ?? 0;
  const isDefaultWideMap = viewportZoom < 6 && displayMapSpots.value.length === 0 && !props.itinerary;
  return isDefaultWideMap ? 'states' : 'full';
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
const routeCanvasDensity = computed(() => (draftRouteSequence.value.length ? 'expanded' : 'compact'));
const routeBriefStartLabel = computed(() =>
  draftRouteSequence.value.find((point) => point.routeRole === 'start')?.title ?? draftStartLabel.value,
);
const routeBriefEndLabel = computed(() =>
  [...draftRouteSequence.value].reverse().find((point) => point.routeRole === 'end')?.title ?? draftEndLabel.value,
);
const showRouteBriefStart = computed(() =>
  draftRouteSequence.value.some((point) => point.routeRole === 'start') && routeBriefStartLabel.value !== 'Choose start',
);
const showRouteBriefEnd = computed(() =>
  draftRouteSequence.value.some((point) => point.routeRole === 'end') && routeBriefEndLabel.value !== 'Choose end',
);
const showRouteBriefEndpoints = computed(() => showRouteBriefStart.value || showRouteBriefEnd.value);
const routeDistanceLabel = computed(() => {
  const summary = currentRouteSummary.value;
  if (!summary || summary.distanceMeters <= 0) {
    return mapSpots.value.length > 1 ? 'Estimating' : 'Add points';
  }

  if (!isMapboxAuthoritativeRoute(summary)) {
    return 'Needs Mapbox';
  }

  return formatMiles(summary.distanceMeters);
});
const routeEtaLabel = computed(() => {
  const summary = currentRouteSummary.value;
  if (!summary) {
    return mapSpots.value.length > 1 ? 'Estimating' : 'Add end';
  }

  if (!isMapboxAuthoritativeRoute(summary) || summary.durationSeconds <= 0) {
    return 'Unavailable';
  }

  return formatDuration(summary.durationSeconds);
});
const routeDistanceMiles = computed(() => {
  const summary = currentRouteSummary.value;
  return summary && isMapboxAuthoritativeRoute(summary) && summary.distanceMeters > 0 ? summary.distanceMeters / METERS_PER_MILE : 0;
});
const routeFuelCost = computed(() => {
  const mpg = props.fuelSettings?.mpg;
  const gasPricePerGallon = props.fuelSettings?.gasPricePerGallon;
  if (!Number.isFinite(mpg) || !Number.isFinite(gasPricePerGallon) || Number(mpg) <= 0 || Number(gasPricePerGallon) <= 0 || routeDistanceMiles.value <= 0) {
    return null;
  }

  return (routeDistanceMiles.value / Number(mpg)) * Number(gasPricePerGallon);
});
const routeFuelCostLabel = computed(() => {
  if (currentRouteSummary.value && !hasAuthoritativeRouteMetrics.value) {
    return 'Needs route';
  }

  if (routeFuelCost.value === null) {
    return 'Set fuel';
  }

  return currencyFormatter.format(routeFuelCost.value);
});
const fuelMetricTitle = computed(() => (
  currentRouteSummary.value && !hasAuthoritativeRouteMetrics.value
    ? currentRouteSummary.value.routeError ?? 'Mapbox route is required for fuel cost.'
    : routeFuelCost.value === null
      ? 'Set MPG and gas price'
      : 'Fuel estimate from MPG and gas price'
));
const driveScoreSnapshot = computed<DriveScoreSnapshot | null>(() => calculateDriveScore());
const driveScoreLabel = computed(() => {
  const score = driveScoreSnapshot.value?.score;
  if (currentRouteSummary.value && !hasAuthoritativeRouteMetrics.value) {
    return 'Needs route';
  }

  if (!score) {
    return currentRouteSummary.value ? 'Scoring' : 'Add route';
  }

  return `${score.toFixed(1)}/10`;
});
const driveScoreDifficultyLabel = computed(() => {
  const difficulty = driveScoreSnapshot.value?.difficulty;
  if (!difficulty) {
    return 'Drive score';
  }

  if (difficulty === 'Easy') {
    return 'Smooth drive';
  }

  if (difficulty === 'Moderate') {
    return 'Steady drive';
  }

  return 'Demanding drive';
});
const showRouteMetrics = computed(() => mapSpots.value.length > 1);

function requestFuelSettings(): void {
  if (routeFuelCost.value !== null) {
    return;
  }

  emit('fuel-settings-request');
}

const routeNearbyHelpers = createItineraryRouteNearbyHelpers({
  getSelectedRouteNearbyTabId: () => selectedRouteNearbyTabId.value,
  getSelectedRouteNearbyQueryId: () => selectedRouteNearbyQueryId.value,
  getSelectedRouteNearbyQuery: () => selectedRouteNearbyQuery.value,
  getSelectedRouteNearbyFuelFilterId: () => selectedRouteNearbyFuelFilterId.value,
  getSelectedRouteNearbyFuelSortMode: () => selectedRouteNearbyFuelSortMode.value,
  getSelectedRouteNearbyRadiusId: () => selectedRouteNearbyRadiusId.value,
  getRouteNearbyCustomRadiusMiles: () => routeNearbyCustomRadiusMiles.value,
  getRouteNearbyCustomQuery: () => routeNearbyCustomQuery.value,
  getRouteNearbyFuelSearchQuery: () => routeNearbyFuelSearchQuery.value,
  getRouteNearbyInterests: () => props.draft?.interests ?? [],
  getSelectedRouteNearbyAnchor: () => selectedRouteNearbyAnchor.value,
});
const {
  clampRouteNearbyCustomRadiusMiles,
  parseRouteNearbyCustomRadiusMiles,
  formatRouteNearbyRadiusMiles,
  normalizeRouteNearbyCustomRadiusValue,
  getRouteNearbyCustomRadiusOption,
  getSelectedRouteNearbyRadiusOption,
  getRouteNearbyRadiusTitle,
  getRouteNearbyPhotoCategory,
  getRouteNearbyCardCategory,
  getRouteNearbyPhotoUrl,
  getRouteNearbyIcon,
  getRouteNearbySourceLabel,
  getRouteNearbyDistanceValue,
  getRouteNearbyCategoryLabel,
  cleanRouteNearbyLocationText,
  stripRouteNearbyLocationPrefix,
  formatRouteNearbyResultLocation,
  calculateDistanceKm,
  normalizeRouteNearbyCategory,
  normalizeTravelSuggestionCategory,
  getRouteNearbyValidationText,
  hasRouteNearbyTextSignal,
  isRouteNearbyFoodPlace,
  isRouteNearbyStayPlace,
  isRouteNearbyEssentialsPlace,
  isRouteNearbyScenicPlace,
  isRouteNearbyEntertainmentPlace,
  isRouteNearbyPlaceValidForSelectedCategory,
  formatRouteNearbyDistance,
  getRouteNearbyPlaceDistanceKm,
  formatTravelCategoryLabel,
  isWithinSelectedRouteNearbyRadius,
  filterRouteNearbyPlacesWithinSelectedRadius,
  hasLiveFuelPrice,
  matchesRouteNearbyFuelSearch,
  compareRouteNearbyFuelPlaces,
  filterAndSortRouteNearbyFuelPlaces,
  buildRouteNearbySearchQuery,
  getRouteNearbyInterestSet,
  buildRouteNearbyBounds,
  getRouteNearbyPlaceCategories,
  getFuelTypeLabel,
  normalizeFuelTypeText,
  isRegularFuelType,
  isDieselFuelType,
  isMidgradeFuelType,
  isPremiumFuelType,
  isEvFuelType,
  isFuelTypeForFilter,
  getSelectedFuelStationPrice,
  isStrictFuelPlaceResult,
  shouldIncludeFuelStation,
  calculateRouteNearbyRecommendationScore,
  isStrongRouteNearbyRecommendation,
  buildRouteNearbyRecommendationReason,
  buildScopeNearbyPlace,
  buildDiscoveryNearbyPlace,
  formatFuelPriceValue,
  formatFuelUpdatedAt,
  buildFuelNearbyPlace,
  buildTravelNearbyPlace,
  isRouteNearbyStreetLevelAddress,
  enrichRouteNearbyPlace,
  enrichRouteNearbyPlaces,
  getRouteNearbyPlaceDedupeKey,
  normalizeRouteNearbyDedupeText,
  dedupeRouteNearbyPlaces,
  mergeRouteNearbyPlaces,
  buildRouteNearbyPlaceFromMapPin,
  getRouteNearbyFuelApiType,
  getRouteNearbyFuelApiSortMode,
  isRouteNearbyRadiusBeyondProviderLimit,
} = routeNearbyHelpers;

async function searchRouteNearbyDiscoveryPlaces(
  anchor: RouteNearbyAnchor,
  query: RouteNearbyQuery,
  queryText: string,
): Promise<{ data: PlaceSearchResult[] }> {
  const categories = getRouteNearbyPlaceCategories(query);
  if (query.id !== 'custom' && categories.length) {
    const nearbyResponse = await searchNearbyPlaces({
      center: { latitude: anchor.latitude, longitude: anchor.longitude },
      bounds: buildRouteNearbyBounds(anchor),
      categories,
      limit: ROUTE_NEARBY_MAP_PIN_LIMIT,
    }).catch(() => ({ data: [] as PlaceSearchResult[] }));

    if (nearbyResponse.data.length) {
      return { data: nearbyResponse.data };
    }
  }

  return searchPlaces(queryText, {
    proximity: { latitude: anchor.latitude, longitude: anchor.longitude },
    bboxRadiusKm: selectedRouteNearbyRadiusKm.value,
    sortByDistance: true,
    limit: ROUTE_NEARBY_MAP_PIN_LIMIT,
    types: 'poi',
  });
}

async function searchDiscoveryFuelPlaces(anchor: RouteNearbyAnchor, fuelFilter: RouteNearbyFuelFilter): Promise<{ data: PlaceSearchResult[] }> {
  if (fuelFilter.id === 'ev' || isRouteNearbyRadiusBeyondProviderLimit()) {
    return searchPlaces(fuelFilter.query, {
      proximity: { latitude: anchor.latitude, longitude: anchor.longitude },
      bboxRadiusKm: selectedRouteNearbyRadiusKm.value,
      sortByDistance: true,
      limit: ROUTE_NEARBY_MAP_PIN_LIMIT,
      types: 'poi',
    });
  }

  const response = await searchNearbyPlaces({
    center: { latitude: anchor.latitude, longitude: anchor.longitude },
    categories: ['gas_station'],
    limit: ROUTE_NEARBY_MAP_PIN_LIMIT,
  });

  return { data: response.data };
}
async function loadRouteNearbyPlaces(): Promise<void> {
  const anchor = selectedRouteNearbyAnchor.value;
  const requestId = ++routeNearbyRequestId;
  routeNearbyError.value = '';

  if (!anchor) {
    routeNearbySearchResults.value = [];
    routeNearbyLoading.value = false;
    return;
  }

  routeNearbyLoading.value = true;
  const activeQuery = selectedRouteNearbyQuery.value;
  const queryText = buildRouteNearbySearchQuery();
  let cappedTravelPlaces: RouteNearbyPlace[] = [];

  try {
    if (selectedRouteNearbyTabId.value !== 'fuel') {
      try {
        const travelResponse = await getTravelNearbySuggestions({
          anchors: [anchor],
          routePoints: displayMapSpots.value.map((point) => ({
            id: point.id,
            title: point.title,
            latitude: point.latitude,
            longitude: point.longitude,
            routeRole: point.routeRole,
          })),
          category: selectedRouteNearbyTabId.value,
          radiusKm: Math.min(selectedRouteNearbyRadiusKm.value, ROUTE_NEARBY_PROVIDER_RADIUS_LIMIT_KM),
          limit: ROUTE_NEARBY_MAP_PIN_LIMIT,
          interests: props.draft?.interests ?? [],
          pace: props.draft?.pace ?? 'relaxed',
          budgetFloor: props.draft?.budgetFloor ?? 0,
          budgetCeiling: props.draft?.budget ?? 0,
          startDate: props.draft?.startDate ?? '',
          endDate: props.draft?.endDate ?? '',
          fuelType: props.fuelSettings?.fuelType ?? 'all',
          latestIntent: queryText,
        });

        if (requestId !== routeNearbyRequestId) {
          return;
        }

        const travelPlaces = travelResponse.suggestions
          .map(buildTravelNearbyPlace)
          .filter((place): place is RouteNearbyPlace => Boolean(place))
          .filter(isWithinSelectedRouteNearbyRadius);
        const enrichedTravelPlaces = await enrichRouteNearbyPlaces(travelPlaces);
        if (requestId !== routeNearbyRequestId) {
          return;
        }

        if (!isRouteNearbyRadiusBeyondProviderLimit() && enrichedTravelPlaces.length) {
          routeNearbySearchResults.value = enrichedTravelPlaces;
          return;
        }

        cappedTravelPlaces = enrichedTravelPlaces;
      } catch {
        // Fall back to the existing client-side Scope + Mapbox path while the Intel travel endpoint is unavailable.
      }
    }

    if (selectedRouteNearbyTabId.value === 'fuel') {
      const fuelFilter = selectedRouteNearbyFuelFilter.value;
      const shouldRequestLiveFuelPrices = fuelFilter.id !== 'ev' && !isRouteNearbyRadiusBeyondProviderLimit();
      const [fuelResponse, discoveryFuelResponse] = await Promise.all([
        !shouldRequestLiveFuelPrices
          ? Promise.resolve({ stations: [] as FuelStationPrice[] })
          : getNearbyFuelStations({
              latitude: anchor.latitude,
              longitude: anchor.longitude,
              radiusKm: selectedRouteNearbyRadiusKm.value,
              fuelType: getRouteNearbyFuelApiType(),
              limit: ROUTE_NEARBY_MAP_PIN_LIMIT,
              sortBy: getRouteNearbyFuelApiSortMode(),
            }).catch(() => ({ stations: [] })),
        searchDiscoveryFuelPlaces(anchor, fuelFilter).catch(() => ({ data: [] as PlaceSearchResult[] })),
      ]);

      if (requestId !== routeNearbyRequestId) {
        return;
      }

      const fuelPlaces = fuelResponse.stations
        .filter(shouldIncludeFuelStation)
        .map((station) => buildFuelNearbyPlace(station, anchor))
        .filter((place): place is RouteNearbyPlace => Boolean(place))
        .filter(isWithinSelectedRouteNearbyRadius);
      const discoveryFuelPlaces = discoveryFuelResponse.data
        .filter((place) => isStrictFuelPlaceResult(place, fuelFilter.id))
        .map((place) => buildDiscoveryNearbyPlace(place, anchor, { kind: 'fuel' }))
        .filter(isWithinSelectedRouteNearbyRadius);
      routeNearbySearchResults.value = mergeRouteNearbyPlaces(fuelPlaces, discoveryFuelPlaces, ROUTE_NEARBY_MAP_PIN_LIMIT);
      return;
    }

    const [scopeResponse, discoveryResponse] = await Promise.all([
      listNearbySpots({
        latitude: anchor.latitude,
        longitude: anchor.longitude,
        radiusKm: selectedRouteNearbyRadiusKm.value,
        page: 1,
        pageSize: ROUTE_NEARBY_MAP_PIN_LIMIT,
      }).catch(() => ({ data: [] as SpotSummary[] })),
      searchRouteNearbyDiscoveryPlaces(anchor, activeQuery, queryText).catch(() => ({ data: [] as PlaceSearchResult[] })),
    ]);

    if (requestId !== routeNearbyRequestId) {
      return;
    }

    const scopePlaces = scopeResponse.data
      .filter((spot) => !activeQuery.category || activeQuery.id === 'recommended' || spot.category === activeQuery.category)
      .map((spot) => buildScopeNearbyPlace(spot, anchor))
      .filter(isWithinSelectedRouteNearbyRadius);
    const discoveryPlaces = discoveryResponse.data
      .map((place) => buildDiscoveryNearbyPlace(place, anchor))
      .filter(isWithinSelectedRouteNearbyRadius);
      const mergedPlaces = mergeRouteNearbyPlaces(
        [...cappedTravelPlaces, ...scopePlaces],
        discoveryPlaces,
        ROUTE_NEARBY_MAP_PIN_LIMIT,
      );
      const enrichedPlaces = await enrichRouteNearbyPlaces(mergedPlaces);
      if (requestId !== routeNearbyRequestId) {
        return;
      }

      routeNearbySearchResults.value = enrichedPlaces;
  } catch {
    if (requestId === routeNearbyRequestId) {
      routeNearbyError.value = 'Nearby places are unavailable right now.';
      routeNearbySearchResults.value = [];
    }
  } finally {
    if (requestId === routeNearbyRequestId) {
      routeNearbyLoading.value = false;
    }
  }
}

function toggleRouteNearbyDrawer(): void {
  routeNearbyDrawerTouched.value = true;
  if (routeNearbyDrawerOpen.value) {
    routeNearbyDrawerExpanded.value = false;
    routeNearbyDrawerOpen.value = false;
    routeNearbyFilterMenuOpen.value = false;
    return;
  }

  routeNearbyDrawerOpen.value = true;
}

function clearRouteNearbySearchResults(): void {
  routeNearbyRequestId += 1;
  routeNearbyLoading.value = false;
  routeNearbyError.value = '';
  routeNearbySearchResults.value = [];
  routeNearbyCurrentPage.value = 1;
}

function selectRouteNearbyPage(page: number): void {
  routeNearbyCurrentPage.value = Math.round(clampNumber(page, 1, routeNearbyPageCount.value));
  selectedRouteNearbyPlaceId.value = '';
}

function toggleRouteNearbyFilterMenu(): void {
  routeNearbyFilterMenuOpen.value = !routeNearbyFilterMenuOpen.value;
}

function selectRouteNearbyAnchor(anchorId: string): void {
  if (!anchorId) {
    return;
  }

  routeNearbyDrawerTouched.value = true;
  routeNearbyDrawerOpen.value = true;
  routeNearbyFilterMenuOpen.value = false;
  selectedRouteNearbyPlaceId.value = '';

  if (selectedRouteNearbyAnchorId.value === anchorId) {
    return;
  }

  clearRouteNearbySearchResults();
  selectedRouteNearbyAnchorId.value = anchorId;
}

function selectRouteNearbyTab(tabId: RouteNearbyTabId): void {
  const tabChanged = selectedRouteNearbyTabId.value !== tabId;
  selectedRouteNearbyTabId.value = tabId;
  selectedRouteNearbyPlaceId.value = '';
  routeNearbyCustomQuery.value = '';
  routeNearbyFilterMenuOpen.value = false;
  if (tabChanged) {
    clearRouteNearbySearchResults();
  }

  if (tabId !== 'fuel') {
    selectedRouteNearbyQueryId.value = tabId;
    routeNearbyFuelSearchQuery.value = '';
    return;
  }

  selectedRouteNearbyQueryId.value = 'recommended';
}

function selectRouteNearbyQuery(queryId: RouteNearbyQueryId): void {
  if (queryId === 'custom') {
    routeNearbyFilterMenuOpen.value = false;
    return;
  }

  if (selectedRouteNearbyQueryId.value === queryId) {
    routeNearbyFilterMenuOpen.value = false;
    return;
  }

  selectedRouteNearbyQueryId.value = queryId;
  routeNearbyCustomQuery.value = '';
  selectedRouteNearbyPlaceId.value = '';
  routeNearbyFilterMenuOpen.value = false;
  clearRouteNearbySearchResults();
}

function resetRouteNearbyFilter(): void {
  const shouldClearResults = selectedRouteNearbyQueryId.value !== 'recommended';
  selectedRouteNearbyQueryId.value = 'recommended';
  routeNearbyCustomQuery.value = '';
  selectedRouteNearbyPlaceId.value = '';
  routeNearbyFilterMenuOpen.value = false;
  if (shouldClearResults) {
    clearRouteNearbySearchResults();
  }
}

function selectRouteNearbyFuelFilter(filterId: RouteNearbyFuelFilterId): void {
  if (selectedRouteNearbyFuelFilterId.value === filterId) {
    return;
  }

  selectedRouteNearbyFuelFilterId.value = filterId;
  selectedRouteNearbyPlaceId.value = '';
  clearRouteNearbySearchResults();
  emit('fuel-type-select', filterId);
}

function selectRouteNearbyFuelSortMode(sortMode: RouteNearbyFuelSortMode): void {
  selectedRouteNearbyFuelSortMode.value = sortMode;
  selectedRouteNearbyPlaceId.value = '';
  routeNearbyCurrentPage.value = 1;
}

function selectRouteNearbyRadius(radiusId: string): void {
  if (selectedRouteNearbyRadiusId.value === radiusId) {
    return;
  }

  selectedRouteNearbyRadiusId.value = radiusId;
  selectedRouteNearbyPlaceId.value = '';
  clearRouteNearbySearchResults();
}

function selectRouteNearbyCustomRadius(): void {
  selectRouteNearbyRadius(ROUTE_NEARBY_CUSTOM_RADIUS_ID);
}

function handleRouteNearbyCustomRadiusInput(): void {
  selectedRouteNearbyRadiusId.value = ROUTE_NEARBY_CUSTOM_RADIUS_ID;
  selectedRouteNearbyPlaceId.value = '';
  clearRouteNearbySearchResults();
}

function normalizeRouteNearbyCustomRadius(): void {
  const normalizedRadius = normalizeRouteNearbyCustomRadiusValue();
  const radiusChanged = routeNearbyCustomRadiusMiles.value !== normalizedRadius;
  routeNearbyCustomRadiusMiles.value = normalizedRadius;
  if (radiusChanged || selectedRouteNearbyRadiusId.value !== ROUTE_NEARBY_CUSTOM_RADIUS_ID) {
    handleRouteNearbyCustomRadiusInput();
  }
}

function submitRouteNearbySearch(): void {
  if (!routeNearbyCustomQuery.value.trim()) {
    return;
  }

  selectedRouteNearbyQueryId.value = 'custom';
  routeNearbyFilterMenuOpen.value = false;
  selectedRouteNearbyPlaceId.value = '';
  clearRouteNearbySearchResults();
  void loadRouteNearbyPlaces();
}

function isRouteNearbyPlacePinned(placeId: string): boolean {
  return routeNearbyPinnedPlaces.value.some((place) => place.id === placeId);
}

function upsertRouteNearbyPinnedPlace(place: RouteNearbyPlace): void {
  const dedupeKey = getRouteNearbyPlaceDedupeKey(place);
  const nextPinnedPlaces = routeNearbyPinnedPlaces.value.filter((entry) => getRouteNearbyPlaceDedupeKey(entry) !== dedupeKey);
  routeNearbyPinnedPlaces.value = [place, ...nextPinnedPlaces].slice(0, 12);
}

function emitFuelPriceSelection(place: RouteNearbyPlace): void {
  if (!hasLiveFuelPrice(place)) {
    return;
  }

  emit('fuel-price-select', {
    placeId: place.id,
    stationName: place.title,
    pricePerGallon: Number(place.priceValue),
    fuelType: normalizeTripFuelType(place.fuelType),
  });
}

function getRouteNearbySelectionContext(): string {
  const radiusLabel = selectedRouteNearbyRadiusOption.value.label;
  if (selectedRouteNearbyTabId.value === 'fuel') {
    return `${selectedRouteNearbyFuelFilter.value.label} within ${radiusLabel}`;
  }

  if (selectedRouteNearbyTabId.value === 'recommended') {
    return `${routeNearbyFilterLabel.value} within ${radiusLabel}`;
  }

  const tabLabel = routeNearbyTabs.find((tab) => tab.id === selectedRouteNearbyTabId.value)?.label ?? 'nearby picks';
  return `${tabLabel} within ${radiusLabel}`;
}

function addRouteNearbyPlace(place: RouteNearbyPlace): void {
  const photoUrl = getRouteNearbyPhotoUrl(place) || place.photoUrl;
  const nearbyContext = getRouteNearbySelectionContext();
  routeNearbyFilterMenuOpen.value = false;
  selectedRouteNearbyPlaceId.value = place.id;
  upsertRouteNearbyPinnedPlace(place);
  emitFuelPriceSelection(place);
  emit('route-stop-add', {
    spotId: place.id,
    title: place.title,
    latitude: place.latitude,
    longitude: place.longitude,
    category: place.category,
    city: formatRouteNearbyResultLocation(place),
    photoUrl,
    estimatedCost: place.source === 'scope' ? 15 : undefined,
    notes: `${getRouteNearbyCategoryLabel(place)} nearby stop from ${nearbyContext} near ${selectedRouteNearbyAnchor.value?.placeLabel ?? 'the route'}.`,
  });
}

function handleMapNearbyPlaceAdd(place: MapNearbyPlacePin): void {
  addRouteNearbyPlace(buildRouteNearbyPlaceFromMapPin(place));
}

function getRouteSequenceFocusPoint(point: RouteSequencePoint): Pick<MapPoint, 'id' | 'title' | 'latitude' | 'longitude'> | null {
  const mapPoint = displayMapSpots.value.find((candidate) => candidate.id === point.id);
  if (mapPoint && hasCoordinatePair(mapPoint.latitude, mapPoint.longitude)) {
    return {
      id: mapPoint.id,
      title: mapPoint.title,
      latitude: Number(mapPoint.latitude),
      longitude: Number(mapPoint.longitude),
    };
  }

  if (hasCoordinatePair(point.latitude, point.longitude)) {
    return {
      id: point.id,
      title: point.title,
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
    };
  }

  return null;
}

function selectRouteSequencePoint(point: RouteSequencePoint): void {
  const focusPoint = getRouteSequenceFocusPoint(point);
  if (!focusPoint) {
    return;
  }

  selectRouteNearbyAnchor(focusPoint.id);
  void runPlannerMapCommand({
    command: 'zoom_to_place',
    query: focusPoint.title,
    target: {
      label: formatLocationPreview(focusPoint.title),
      latitude: focusPoint.latitude,
      longitude: focusPoint.longitude,
      zoom: 12.2,
      precision: 'route-point',
    },
  });
}

function handleRouteNearbyMapPointSelect(point: MapPoint): void {
  if (!point.id.startsWith('route-nearby-')) {
    if (routeNearbyAnchors.value.some((anchor) => anchor.id === point.id)) {
      selectRouteNearbyAnchor(point.id);
    }
    return;
  }

  const placeId = point.id.replace(/^route-nearby-/, '');
  selectedRouteNearbyPlaceId.value = placeId;
  routeNearbyDrawerOpen.value = true;
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function getDriveStartHour(): number {
  const startStop = timelineSourceStops.value.find((stop) => stop.timelineRouteRole === 'start') ?? timelineSourceStops.value[0];
  const [hourValue = '8'] = normalizeTimeSlot(startStop?.timeSlot ?? TIMELINE_START_TIME_SLOT).split(':');
  const parsedHour = Number.parseInt(hourValue, 10);
  return Number.isFinite(parsedHour) ? parsedHour : 8;
}

function estimateHighwayPercent(averageMph: number): number {
  if (!Number.isFinite(averageMph) || averageMph <= 0) {
    return 0.35;
  }

  return clampNumber((averageMph - 25) / 45, 0.1, 0.95);
}

function calculateDriveScore(): DriveScoreSnapshot | null {
  const summary = currentRouteSummary.value;
  if (!summary || !isMapboxAuthoritativeRoute(summary) || summary.durationSeconds <= 0 || routeDistanceMiles.value <= 0) {
    return null;
  }

  const driveHours = summary.durationSeconds / 3600;
  const averageMph = routeDistanceMiles.value / driveHours;
  const highwayPercent = estimateHighwayPercent(averageMph);
  const stopCount = inferredMiddleStopCount.value;
  const startHour = getDriveStartHour();
  const timePenalty = startHour < 6 || startHour >= 21
    ? 1.2
    : startHour >= 16 && startHour <= 18
      ? 0.6
      : 0;
  const durationPenalty = clampNumber((driveHours - 1) * 0.45, 0, 3);
  const stopPenalty = clampNumber(stopCount * 0.35, 0, 2);
  const highwayPenalty = (1 - highwayPercent) * 1.6;
  const score = clampNumber(10 - durationPenalty - stopPenalty - timePenalty - highwayPenalty, 1, 10);
  const difficulty: DriveScoreDifficulty = score >= 8
    ? 'Easy'
    : score >= 5.5
      ? 'Moderate'
      : 'Challenging';

  return {
    score,
    difficulty,
  };
}

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

function normalizeDraftEndpointLabel(value: string, hasCoordinates: boolean): string {
  const cleanedValue = cleanLocationDisplay(value);
  if (!cleanedValue) {
    return '';
  }

  const normalizedValue = cleanedValue.toLowerCase();
  if (!hasCoordinates && (normalizedValue === 'planning route' || normalizedValue === 'untitled trip')) {
    return '';
  }

  return cleanedValue;
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

function removeRouteSequencePoint(point: RouteSequencePoint): void {
  if (point.id.startsWith('planner-stop-')) {
    removeDraftRouteStop(point.id);
    return;
  }

  if (point.routeRole === 'start') {
    emit('route-endpoint-remove', 'destination');
    return;
  }

  if (point.routeRole === 'end') {
    emit('route-endpoint-remove', 'endDestination');
  }
}

function handleMapRoutePointRemove(point: MapPoint): void {
  if (point.id.startsWith('planner-stop-')) {
    removeDraftRouteStop(point.id);
    return;
  }

  if (point.routeRole === 'start' || point.id === 'planner-start') {
    emit('route-endpoint-remove', 'destination');
    return;
  }

  if (point.routeRole === 'end' || point.id === 'planner-end') {
    emit('route-endpoint-remove', 'endDestination');
  }
}

function isRemovableRouteSequencePoint(point: RouteSequencePoint): boolean {
  return point.id.startsWith('planner-stop-') || point.routeRole === 'start' || point.routeRole === 'end';
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
    }, { delayMs: 120, timeoutMs: 900 });
  },
  { immediate: true },
);

watch(
  routeNearbyAnchors,
  (anchors) => {
    if (!anchors.length) {
      selectedRouteNearbyAnchorId.value = '';
      routeNearbyDrawerOpen.value = false;
      routeNearbyDrawerExpanded.value = false;
      routeNearbySearchResults.value = [];
      routeNearbyPinnedPlaces.value = [];
      routeNearbyCurrentPage.value = 1;
      return;
    }

    const anchorIds = new Set(anchors.map((anchor) => anchor.id));
    routeNearbyPinnedPlaces.value = routeNearbyPinnedPlaces.value.filter((place) => !place.anchorId || anchorIds.has(place.anchorId));

    if (!anchors.some((anchor) => anchor.id === selectedRouteNearbyAnchorId.value)) {
      clearRouteNearbySearchResults();
      selectedRouteNearbyAnchorId.value = anchors.find((anchor) => anchor.routeRole === 'start')?.id ?? anchors[0]?.id ?? '';
    }

    if (!routeNearbyDrawerTouched.value) {
      routeNearbyDrawerOpen.value = false;
    }
  },
  { immediate: true },
);

watch(
  () => [
    routeNearbyDrawerOpen.value,
    selectedRouteNearbyAnchor.value?.id ?? '',
    selectedRouteNearbyTabId.value,
    selectedRouteNearbyQueryId.value,
    selectedRouteNearbyFuelFilterId.value,
    selectedRouteNearbyRadiusId.value,
    selectedRouteNearbyRadiusKm.value,
  ] as const,
  () => {
    if (!routeNearbyDrawerOpen.value) {
      routeNearbyRequestId += 1;
      routeNearbyLoading.value = false;
      routeNearbyError.value = '';
      routeNearbySearchResults.value = [];
      routeNearbyCurrentPage.value = 1;
      routeNearbyFilterMenuOpen.value = false;
      return;
    }

    void loadRouteNearbyPlaces();
  },
  { immediate: true },
);

watch(routeNearbyPageCount, (pageCount) => {
  if (routeNearbyCurrentPage.value > pageCount) {
    routeNearbyCurrentPage.value = pageCount;
  }
});

watch(routeNearbyFuelSearchQuery, () => {
  routeNearbyCurrentPage.value = 1;
  selectedRouteNearbyPlaceId.value = '';
});

watch(
  () => props.fuelSettings?.fuelType,
  (nextFuelType) => {
    const normalizedFuelType = normalizeTripFuelType(nextFuelType);
    if (selectedRouteNearbyFuelFilterId.value !== normalizedFuelType) {
      clearRouteNearbySearchResults();
      selectedRouteNearbyFuelFilterId.value = normalizedFuelType;
    }
  },
);

watch(
  () => mapSpotsRouteKey.value,
  () => {
    void syncRouteSummary();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  cancelMapboxRuntimePrewarm();
  cancelMapRender();
  routeSummaryRequestId += 1;
  routeNearbyRequestId += 1;
});

async function runPlannerMapCommand(command: ScopeAiMapCommand | ScopeAiMapCommandPayload): Promise<{ ok: boolean; message: string }> {
  shouldRenderMap.value = true;
  const result = await plannerMapView.value?.runPlannerMapCommand?.(command);
  return result ?? {
    ok: false,
    message: 'The planner map is still loading, so I could not run that map command yet.',
  };
}

defineExpose({
  runPlannerMapCommand,
  ...(import.meta.env.MODE === 'test'
    ? {
        __coverage: {
          clampWizardStep,
          isWizardStepActive,
          getWizardStepState,
          getWizardStepLabel,
          emitWizardStepChange,
          setMapPickTarget,
          clearMapPickTarget,
          formatGeocodeSelection,
          handleRouteMapClick,
          buildRouteStopFromGeocode,
          getTimelineDayCost,
          emitTimelineStopUpdate,
          sanitizeTimelineDayInput,
          sanitizeTimelineTimeInput,
          handleTimelineDayChange,
          handleTimelineTimeChange,
          parseTimelineTimeInput,
          normalizeTimeSlot,
          clampTimelineDayNumber,
          getDraftTimelineDaySpan,
          formatCoordinateLabel,
          getTimelineEndpointTitle,
          buildTimelineEndpointStop,
          resolveTimelineRouteRole,
          labelTimelineStops,
          getTimelineSpotBadgeText,
          formatTimelineSpotMeta,
          formatTimelineSpotReason,
          isSyntheticTimelineEndpoint,
          stripTimelineMetadata,
          compareTimelineStops,
          getTimelineSourceStops,
          resolveTimelineDate,
          buildEditableTimelineDays,
          parseTimelineDayInput,
          buildUserOrderedMapSpots,
          isMapboxAuthoritativeRoute,
          labelRouteSequencePoints,
          buildUserOrderedRouteSequence,
          keepVisualRouteEndpoints,
          clampRouteNearbyCustomRadiusMiles,
          parseRouteNearbyCustomRadiusMiles,
          formatRouteNearbyRadiusMiles,
          normalizeRouteNearbyCustomRadiusValue,
          getRouteNearbyRadiusTitle,
          getRouteNearbyPhotoCategory,
          getRouteNearbyCardCategory,
          getRouteNearbyPhotoUrl,
          getRouteNearbyIcon,
          getRouteNearbySourceLabel,
          getRouteNearbyDistanceValue,
          getRouteNearbyCategoryLabel,
          cleanRouteNearbyLocationText,
          stripRouteNearbyLocationPrefix,
          formatRouteNearbyResultLocation,
          calculateDistanceKm,
          normalizeRouteNearbyCategory,
          normalizeTravelSuggestionCategory,
          getRouteNearbyValidationText,
          hasRouteNearbyTextSignal,
          isRouteNearbyFoodPlace,
          isRouteNearbyStayPlace,
          isRouteNearbyEssentialsPlace,
          isRouteNearbyScenicPlace,
          isRouteNearbyEntertainmentPlace,
          isRouteNearbyPlaceValidForSelectedCategory,
          formatRouteNearbyDistance,
          getRouteNearbyPlaceDistanceKm,
          formatTravelCategoryLabel,
          isWithinSelectedRouteNearbyRadius,
          filterRouteNearbyPlacesWithinSelectedRadius,
          hasLiveFuelPrice,
          matchesRouteNearbyFuelSearch,
          compareRouteNearbyFuelPlaces,
          filterAndSortRouteNearbyFuelPlaces,
          buildRouteNearbySearchQuery,
          getRouteNearbyInterestSet,
          buildRouteNearbyBounds,
          getRouteNearbyPlaceCategories,
          normalizeTripFuelType,
          getFuelTypeLabel,
          normalizeFuelTypeText,
          isRegularFuelType,
          isDieselFuelType,
          isMidgradeFuelType,
          isPremiumFuelType,
          isEvFuelType,
          isFuelTypeForFilter,
          getSelectedFuelStationPrice,
          isStrictFuelPlaceResult,
          shouldIncludeFuelStation,
          calculateRouteNearbyRecommendationScore,
          isStrongRouteNearbyRecommendation,
          buildRouteNearbyRecommendationReason,
          buildScopeNearbyPlace,
          buildDiscoveryNearbyPlace,
          formatFuelPriceValue,
          formatFuelUpdatedAt,
          buildFuelNearbyPlace,
          buildTravelNearbyPlace,
          isRouteNearbyStreetLevelAddress,
          enrichRouteNearbyPlace,
          enrichRouteNearbyPlaces,
          loadRouteNearbyPlaces,
          getRouteNearbyPlaceDedupeKey,
          normalizeRouteNearbyDedupeText,
          dedupeRouteNearbyPlaces,
          mergeRouteNearbyPlaces,
          toggleRouteNearbyDrawer,
          selectRouteNearbyAnchor,
          selectRouteNearbyTab,
          selectRouteNearbyQuery,
          selectRouteNearbyFuelFilter,
          selectRouteNearbyRadius,
          selectRouteNearbyCustomRadius,
          submitRouteNearbySearch,
          getRouteSequenceFocusPoint,
          selectRouteSequencePoint,
          handleRouteNearbyMapPointSelect,
          estimateHighwayPercent,
          calculateDriveScore,
          formatMiles,
          formatLocationPreview,
          normalizeDraftEndpointLabel,
          syncRouteSummary,
          getInputValue,
          getTimelineInput,
          selectTimelineInputText,
          resetTimelineDayInput,
          resetTimelineTimeInput,
          resetInvalidTimelineDayInput,
          resetInvalidTimelineTimeInput,
          getTimelineMapPointId,
          labelRoutePointsByUserSequence,
          labelRoutePoints,
          labelRouteSequenceByUserSequence,
          buildTextRouteEndpoint,
          getTimelineRouteSequencePointId,
          requestFuelSettings,
          searchRouteNearbyDiscoveryPlaces,
          getRouteNearbyFuelApiType,
          getRouteNearbyFuelApiSortMode,
          isRouteNearbyRadiusBeyondProviderLimit,
          searchDiscoveryFuelPlaces,
          clearRouteNearbySearchResults,
          selectRouteNearbyPage,
          toggleRouteNearbyFilterMenu,
          resetRouteNearbyFilter,
          selectRouteNearbyFuelSortMode,
          handleRouteNearbyCustomRadiusInput,
          normalizeRouteNearbyCustomRadius,
          isRouteNearbyPlacePinned,
          upsertRouteNearbyPinnedPlace,
          emitFuelPriceSelection,
          getRouteNearbySelectionContext,
          addRouteNearbyPlace,
          buildRouteNearbyPlaceFromMapPin,
          handleMapNearbyPlaceAdd,
          clampNumber,
          getDriveStartHour,
          cleanLocationDisplay,
          formatDisplayLocation,
          formatDuration,
          removeDraftRouteStop,
          removeRouteSequencePoint,
          handleMapRoutePointRemove,
          isRemovableRouteSequencePoint,
          hasCoordinatePair,
          getRouteSummaryKey,
          runPlannerMapCommand,
        },
      }
    : {}),
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
  align-content: start;
  align-items: start;
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
  align-content: start;
  align-items: start;
  gap: clamp(var(--space-5), 2vw, var(--space-8));
  padding: var(--space-4);
}

.itinerary-stage[data-itinerary-mode='mobile-wizard'] .itinerary-step-content {
  padding: 0;
}

.itinerary-detail-panel {
  --route-canvas-control-min: 3.05rem;
  --route-canvas-tile-gap: 0.35rem;
  --route-canvas-tile-inset: 0.35rem;
  --route-canvas-top-block-min: calc(var(--route-canvas-control-min) + var(--route-canvas-control-min) + var(--route-canvas-tile-gap) + var(--route-canvas-tile-inset) + var(--route-canvas-tile-inset));
  --route-canvas-text-gutter: 1.65rem;
  --route-canvas-control-pad-x: 0.65rem;
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
  min-height: clamp(31rem, 50vh, 40rem);
  height: clamp(31rem, 50vh, 40rem);
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
  --scope-map-vignette-background: none;
  --scope-map-vignette-shadow: inset 0 0 0 1px color-mix(in srgb, var(--highlight-sheen) 8%, transparent);
}

.map-shell :deep(.map-controls) {
  gap: var(--space-3);
}

.map-shell :deep(.control-stack) {
  gap: 0.42rem;
  padding: 0.38rem;
}

.map-shell :deep(.control-button) {
  width: 2.45rem;
  height: 2.45rem;
}

.map-shell :deep(.control-button .scope-icon) {
  width: 0.96rem;
  height: 0.96rem;
}

.map-shell__placeholder {
  background: var(--bg-secondary);
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

.map-nearby-drawer {
  position: absolute;
  z-index: 5000;
  top: var(--space-4);
  bottom: var(--space-4);
  left: var(--space-4);
  isolation: isolate;
  display: grid;
  gap: clamp(0.76rem, 0.9vw, var(--space-4));
  grid-template-rows: auto minmax(0, 1fr);
  width: min(50%, 46rem);
  max-width: calc(100% - (var(--space-4) * 2));
  max-height: none;
  padding: clamp(0.8rem, 1vw, var(--space-4));
  border: 1px solid color-mix(in srgb, var(--accent-teal) 28%, var(--glass-border));
  border-radius: var(--radius-2xl);
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--bg-secondary) 98%, var(--bg-primary)), color-mix(in srgb, var(--bg-primary) 98%, var(--bg-secondary))),
    var(--bg-primary);
  color: var(--text-primary);
  box-shadow:
    0 1.5rem 3.6rem color-mix(in srgb, var(--shadow-color) 34%, transparent),
    0 0 0 1px color-mix(in srgb, var(--bg-primary) 72%, transparent);
  backdrop-filter: blur(24px) saturate(1.12);
  overflow: hidden;
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] {
  right: var(--space-4);
  width: auto;
  gap: clamp(0.9rem, 1.1vw, 1.2rem);
  padding: clamp(1rem, 1.25vw, 1.3rem);
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--bg-secondary) 99%, var(--bg-primary)), color-mix(in srgb, var(--bg-primary) 99%, var(--bg-secondary))),
    var(--bg-primary);
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-drawer__header h3 {
  max-width: 68rem;
  font-size: clamp(1.05rem, 0.5vw + 0.92rem, 1.38rem);
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-drawer__body {
  align-content: stretch;
  align-items: stretch;
  overflow: hidden;
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-layout {
  grid-template-columns: minmax(24rem, 0.32fr) minmax(0, 1fr);
  align-items: stretch;
  min-height: 0;
  overflow: hidden;
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-results-column {
  grid-template-rows: auto minmax(0, 1fr) auto;
  align-content: stretch;
  min-height: 0;
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-controls {
  align-content: start;
  gap: 0.7rem;
  min-height: 0;
  max-height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0.72rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 76%, var(--border));
  border-radius: 1.2rem;
  background: color-mix(in srgb, var(--bg-primary) 58%, transparent);
  scrollbar-width: none;
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-controls::-webkit-scrollbar {
  display: none;
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-anchor-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
  gap: 0.45rem;
  min-height: 0;
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-anchor-tab {
  width: 100%;
  max-width: none;
  min-width: 0;
  min-height: 2.62rem;
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-radius-control {
  gap: 0.42rem;
  padding: 0.36rem;
  border-radius: 1rem;
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-radius-tabs {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.38rem;
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-radius-custom {
  min-height: 2.42rem;
  padding-inline: 0.78rem;
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-mode-tabs {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.48rem;
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-mode-tab {
  justify-content: flex-start;
  min-width: 0;
  min-height: 2.7rem;
  padding-inline: 0.82rem;
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-places-panel,
.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-fuel-panel {
  align-self: start;
  gap: 0.72rem;
  min-width: 0;
  padding: 0.72rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, var(--border));
  border-radius: 1.1rem;
  background: color-mix(in srgb, var(--bg-primary) 62%, transparent);
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-fuel-filters {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem;
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-fuel-filter {
  justify-content: flex-start;
  width: 100%;
  min-height: 2.36rem;
  padding-inline: 0.7rem;
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-fuel-tools {
  grid-template-columns: minmax(0, 1fr);
  gap: 0.48rem;
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-fuel-sort {
  justify-self: stretch;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-search,
.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-fuel-search {
  min-height: 2.55rem;
  border-radius: 1rem;
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-places-panel--results {
  justify-self: end;
  width: min(100%, 52rem);
  margin-bottom: 0.82rem;
  grid-template-columns: minmax(22rem, 1fr) minmax(12.5rem, 15rem);
  align-items: center;
  padding: 0;
  border: 0;
  background: transparent;
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-places-panel--results .map-nearby-filterbar {
  order: 2;
  min-width: 0;
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-places-panel--results .map-nearby-search {
  order: 1;
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-places-panel--results .map-nearby-search:only-child {
  grid-column: 1 / -1;
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-places-panel--results .map-nearby-filterbar__trigger {
  min-width: 0;
  padding-inline: 0.6rem;
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-results {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 23rem), 1fr));
  align-content: start;
  gap: 0.82rem;
  min-height: 0;
  overflow-y: auto;
  padding-right: 0.18rem;
  scrollbar-width: none;
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-results::-webkit-scrollbar {
  display: none;
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-state {
  grid-column: 1 / -1;
  min-height: 13rem;
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-result {
  grid-template-columns: 5.3rem minmax(0, 1fr) auto;
  gap: 1rem;
  min-height: 6.35rem;
  padding: 0.86rem;
  border-radius: 1.28rem;
}

.map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-result__visual {
  inline-size: 5.1rem;
  block-size: 5.1rem;
  border-radius: 1.05rem;
}

.map-nearby-drawer[data-drawer-state='closed'] {
  bottom: auto;
  right: auto;
  width: auto;
  max-height: none;
  grid-template-rows: auto;
  padding: 0.45rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-secondary) 96%, var(--bg-primary));
}

.map-nearby-drawer[data-drawer-state='closed'] .map-nearby-drawer__header > div:first-child {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
}

.map-nearby-drawer[data-drawer-state='closed'] .map-nearby-drawer__toggle {
  inline-size: auto;
  min-inline-size: 7rem;
  block-size: 2.35rem;
  display: inline-flex;
  gap: 0.5rem;
  padding-inline: 0.82rem 0.9rem;
  border-radius: var(--radius-full);
  color: var(--text-primary);
}

.map-nearby-drawer[data-drawer-state='closed'] .map-nearby-drawer__toggle::after {
  content: "Nearby";
  color: currentColor;
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.02em;
}

.map-nearby-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-width: 0;
}

.map-nearby-drawer__header > div {
  min-width: 0;
}

.map-nearby-drawer__header h3 {
  margin: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: var(--font-size-body-sm);
  line-height: 1.12;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-nearby-drawer__header .eyebrow {
  margin-bottom: 0.18rem;
  color: color-mix(in srgb, var(--accent-teal) 78%, var(--text-secondary));
}

.map-nearby-drawer__actions {
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  flex: 0 0 auto;
}

.map-nearby-drawer__toggle,
.map-nearby-drawer__resize {
  inline-size: 2.1rem;
  block-size: 2.1rem;
  flex: 0 0 auto;
  display: inline-grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 36%, var(--glass-border));
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--accent-teal) 14%, var(--bg-secondary));
  color: var(--text-primary);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.map-nearby-drawer__toggle:hover,
.map-nearby-drawer__resize:hover,
.map-nearby-drawer__resize[aria-pressed='true'] {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent-teal) 72%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 24%, var(--bg-secondary));
}

.map-nearby-drawer__toggle :deep(.scope-icon) {
  display: none;
}

.map-nearby-drawer__toggle::before {
  display: block;
  inline-size: 0.62rem;
  block-size: 0.62rem;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  content: "";
  transform: translateY(-0.08rem) rotate(45deg);
  transition: transform var(--transition-fast);
}

.map-nearby-drawer[data-drawer-state='open'] .map-nearby-drawer__toggle::before {
  transform: translateY(0.08rem) rotate(225deg);
}

.map-nearby-drawer__body {
  display: grid;
  align-content: start;
  align-items: start;
  gap: clamp(0.72rem, 0.84vw, var(--space-3));
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
}

.map-nearby-drawer__body::-webkit-scrollbar {
  display: none;
}

.map-nearby-layout,
.map-nearby-controls,
.map-nearby-results-column {
  display: grid;
  min-width: 0;
  min-height: 0;
  gap: clamp(0.72rem, 0.84vw, var(--space-3));
}

.map-nearby-drawer__empty,
.map-nearby-state {
  margin: 0;
  width: 100%;
  padding: var(--space-3);
  border: 1px dashed color-mix(in srgb, var(--accent-teal) 30%, var(--glass-border));
  border-radius: var(--radius-xl);
  color: var(--text-secondary);
  font-size: var(--font-size-body-sm);
  line-height: 1.35;
  text-align: center;
}

.map-nearby-drawer__empty {
  min-height: 8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--bg-primary) 58%, transparent);
}

.map-nearby-state {
  display: grid;
  place-items: center;
  min-height: 5.25rem;
}

.map-nearby-state--error {
  border-color: color-mix(in srgb, var(--danger) 42%, var(--glass-border));
  color: var(--danger);
}

.map-nearby-anchor-tabs {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.36rem;
  min-height: 2.5rem;
}

.map-nearby-mode-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.42rem;
}

.map-nearby-radius-control {
  display: grid;
  gap: 0.46rem;
  padding: 0.22rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, var(--border));
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--bg-primary) 82%, transparent);
}

.map-nearby-radius-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.28rem;
  min-width: 0;
}

.map-nearby-radius-custom {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  min-height: 2.32rem;
  padding: 0 0.66rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, var(--border));
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-primary) 72%, transparent);
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-bold);
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
}

.map-nearby-radius-custom span,
.map-nearby-radius-custom small {
  white-space: nowrap;
}

.map-nearby-radius-custom input {
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-bold);
  text-align: right;
  outline: none;
  appearance: textfield;
}

.map-nearby-radius-custom input::-webkit-outer-spin-button,
.map-nearby-radius-custom input::-webkit-inner-spin-button {
  margin: 0;
  appearance: none;
}

.map-nearby-radius-custom:hover,
.map-nearby-radius-custom:focus-within,
.map-nearby-radius-custom.active {
  border-color: color-mix(in srgb, var(--accent-teal) 60%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 13%, var(--bg-secondary));
  color: var(--text-primary);
}

.map-nearby-places-panel,
.map-nearby-fuel-panel {
  display: grid;
  gap: 0.66rem;
}

.map-nearby-filterbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  position: relative;
  z-index: 4;
}

.map-nearby-filterbar__menu {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
}

.map-nearby-filterbar__trigger,
.map-nearby-filterbar__clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, var(--border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 82%, transparent);
  color: var(--text-secondary);
  font: inherit;
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
}

.map-nearby-filterbar__trigger {
  width: 100%;
  gap: 0.4rem;
  justify-content: flex-start;
  min-width: 0;
  padding: 0 0.68rem;
}

.map-nearby-filterbar__trigger span {
  flex: 0 0 auto;
  color: var(--text-muted);
  font-size: 0.64rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.map-nearby-filterbar__trigger strong {
  min-width: 0;
  flex: 1 1 auto;
  color: var(--text-primary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-bold);
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-nearby-filterbar__clear {
  flex: 0 0 auto;
  padding: 0 0.58rem;
}

.map-nearby-filterbar__trigger:hover,
.map-nearby-filterbar__trigger:focus-visible,
.map-nearby-filterbar[data-menu-open='true'] .map-nearby-filterbar__trigger,
.map-nearby-filterbar__clear:hover {
  border-color: color-mix(in srgb, var(--accent-teal) 46%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 12%, var(--bg-primary));
  color: var(--text-primary);
}

.map-nearby-filterbar__trigger :deep(.scope-icon) {
  inline-size: 0.92rem;
  block-size: 0.92rem;
  color: var(--accent-teal);
}

.map-nearby-filterbar__trigger :deep(.scope-icon:last-child) {
  color: var(--text-muted);
  transition: transform var(--transition-fast);
}

.map-nearby-filterbar[data-menu-open='true'] .map-nearby-filterbar__trigger :deep(.scope-icon:last-child) {
  transform: rotate(180deg);
}

.map-nearby-filterbar__popover {
  position: absolute;
  z-index: 12;
  top: calc(100% + 0.42rem);
  left: 0;
  right: 0;
  display: grid;
  gap: 0.22rem;
  max-height: min(20rem, 46vh);
  overflow-y: auto;
  padding: 0.36rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 26%, var(--glass-border));
  border-radius: 1rem;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--bg-secondary) 98%, var(--bg-primary)), color-mix(in srgb, var(--bg-primary) 98%, var(--bg-secondary))),
    var(--bg-primary);
  box-shadow: 0 1rem 2.4rem color-mix(in srgb, var(--shadow-color) 36%, transparent);
  scrollbar-width: none;
}

.map-nearby-filterbar__popover::-webkit-scrollbar {
  display: none;
}

.map-nearby-filterbar__option {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: 0.48rem;
  min-height: 2.32rem;
  padding: 0 0.58rem;
  border: 1px solid transparent;
  border-radius: 0.76rem;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  text-align: left;
}

.map-nearby-filterbar__option.has-icon {
  grid-template-columns: 1.15rem minmax(0, 1fr);
}

.map-nearby-filterbar__option span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-nearby-filterbar__option :deep(.scope-icon) {
  inline-size: 1rem;
  block-size: 1rem;
  color: var(--text-muted);
}

.map-nearby-filterbar__option:hover,
.map-nearby-filterbar__option.active {
  border-color: color-mix(in srgb, var(--accent-teal) 36%, transparent);
  background: color-mix(in srgb, var(--accent-teal) 12%, transparent);
  color: var(--text-primary);
}

.map-nearby-filterbar__option.active :deep(.scope-icon) {
  color: var(--accent-teal);
}

.map-nearby-places-panel__header,
.map-nearby-fuel-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
}

.map-nearby-places-panel__header strong,
.map-nearby-fuel-panel__header strong {
  font-size: var(--font-size-caption);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.map-nearby-places-panel__header strong {
  color: var(--accent-teal);
}

.map-nearby-fuel-panel__header strong {
  color: var(--accent-mint);
}

.map-nearby-place-filters,
.map-nearby-fuel-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  min-width: 0;
}

.map-nearby-anchor-tab,
.map-nearby-mode-tab,
.map-nearby-radius-tab,
.map-nearby-place-filter,
.map-nearby-fuel-filter {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  min-width: max-content;
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, var(--border));
  background: color-mix(in srgb, var(--bg-primary) 82%, transparent);
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-fast);
}

.map-nearby-anchor-tab:hover,
.map-nearby-mode-tab:hover,
.map-nearby-radius-tab:hover,
.map-nearby-place-filter:hover,
.map-nearby-fuel-filter:hover {
  border-color: color-mix(in srgb, var(--accent-teal) 50%, var(--glass-border));
  color: var(--text-primary);
}

.map-nearby-anchor-tab.active,
.map-nearby-mode-tab.active,
.map-nearby-radius-tab.active,
.map-nearby-place-filter.active,
.map-nearby-fuel-filter.active {
  border-color: color-mix(in srgb, var(--accent-teal) 68%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 17%, var(--bg-secondary));
  color: var(--text-primary);
}

.map-nearby-mode-tab.active :deep(.scope-icon),
.map-nearby-place-filter.active :deep(.scope-icon),
.map-nearby-fuel-filter.active :deep(.scope-icon) {
  color: color-mix(in srgb, var(--accent-teal) 86%, white);
}

.map-nearby-anchor-tab {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  flex: 0 0 auto;
  gap: 0.38rem;
  max-width: 11rem;
  min-height: 2.3rem;
  padding: 0.44rem 0.56rem;
  border-radius: var(--radius-xl);
  text-align: left;
}

.map-nearby-anchor-tab strong {
  display: inline-grid;
  place-items: center;
  min-width: 1.45rem;
  min-height: 1.45rem;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--accent-teal) 18%, var(--bg-secondary));
  color: var(--text-primary);
  font-size: var(--font-size-caption);
}

.map-nearby-anchor-tab span {
  min-width: 0;
  overflow: hidden;
  font-size: var(--font-size-caption);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-nearby-mode-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-width: 0;
  min-height: 2.42rem;
  padding: 0.46rem 0.66rem;
  border-radius: var(--radius-xl);
  font-size: var(--font-size-body-sm);
  font-weight: var(--font-weight-semibold);
}

.map-nearby-mode-tab span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-nearby-radius-tab {
  min-width: 0;
  min-height: 2.28rem;
  padding: 0 0.42rem;
  border-radius: var(--radius-lg);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-bold);
}

.map-nearby-fuel-tools {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.38rem;
}

.map-nearby-fuel-search {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.36rem;
  min-height: 2rem;
  padding: 0 0.58rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, var(--border));
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-primary) 86%, transparent);
  color: var(--text-secondary);
}

.map-nearby-fuel-search input {
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: var(--font-size-caption);
  outline: none;
}

.map-nearby-fuel-search input::placeholder {
  color: var(--text-muted);
}

.map-nearby-fuel-search :deep(.scope-icon) {
  inline-size: 0.95rem;
  block-size: 0.95rem;
}

.map-nearby-fuel-sort {
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(0, auto));
  gap: 0.24rem;
  padding: 0.18rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, var(--border));
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-primary) 82%, transparent);
}

.map-nearby-fuel-sort button {
  min-height: 1.62rem;
  padding: 0 0.48rem;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}

.map-nearby-fuel-sort button.active {
  background: color-mix(in srgb, var(--accent-teal) 24%, var(--bg-secondary));
  color: var(--text-primary);
}

.map-nearby-place-filter,
.map-nearby-fuel-filter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  gap: 0.4rem;
  width: auto;
  min-width: 0;
  min-height: 2.2rem;
  padding: 0.4rem 0.56rem;
  border-radius: var(--radius-lg);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
}

.map-nearby-fuel-filter span {
  min-width: 0;
  max-width: 6.8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-nearby-place-filter span {
  min-width: 0;
  max-width: 6.8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-nearby-mode-tab :deep(.scope-icon),
.map-nearby-place-filter :deep(.scope-icon),
.map-nearby-fuel-filter :deep(.scope-icon) {
  inline-size: 1rem;
  block-size: 1rem;
}

.map-nearby-search {
  display: grid;
  grid-template-columns: auto minmax(12rem, 1fr) auto;
  align-items: center;
  gap: 0.42rem;
  min-height: 2.62rem;
  padding: 0.3rem 0.32rem 0.3rem 0.68rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, var(--border));
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--bg-primary) 84%, transparent);
}

.map-nearby-search input {
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  outline: none;
}

.map-nearby-search input::placeholder {
  color: var(--text-muted);
}

.map-nearby-search button {
  min-height: 1.86rem;
  padding: 0 0.66rem;
  border: 0;
  border-radius: var(--radius-lg);
  background: var(--accent-teal);
  color: var(--bg-primary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
}

.map-nearby-search button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.map-nearby-results {
  display: grid;
  gap: 0.68rem;
  min-height: 0;
  overflow: visible;
  padding-right: 0.08rem;
}

.map-nearby-pagination {
  justify-self: end;
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  margin-top: 0.1rem;
  padding: 0.22rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 78%, var(--border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 82%, transparent);
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-bold);
}

.map-nearby-pagination button {
  display: inline-grid;
  place-items: center;
  min-width: 2rem;
  min-height: 1.86rem;
  border: 0;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 16%, transparent);
  color: var(--text-primary);
  cursor: pointer;
}

.map-nearby-pagination button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.map-nearby-result {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: 4.8rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.92rem;
  width: 100%;
  min-width: 0;
  min-height: 5.65rem;
  padding: 0.74rem 0.82rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, var(--border));
  border-radius: 1.15rem;
  background: color-mix(in srgb, var(--bg-primary) 88%, transparent);
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.map-nearby-result:hover,
.map-nearby-result.active {
  border-color: color-mix(in srgb, var(--accent-teal) 44%, var(--glass-border));
  background: color-mix(in srgb, var(--bg-secondary) 50%, var(--bg-primary));
}

.map-nearby-result.active {
  box-shadow: none;
}

.map-nearby-result.is-added {
  border-color: color-mix(in srgb, var(--accent-mint) 42%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-mint) 8%, var(--bg-primary));
}

.map-nearby-result[data-place-kind='fuel'] .map-nearby-result__visual[data-has-photo='false'] {
  background: color-mix(in srgb, var(--accent-mint) 18%, var(--bg-secondary));
  color: var(--accent-mint);
}

.map-nearby-result__visual {
  inline-size: 4.65rem;
  block-size: 4.65rem;
  overflow: hidden;
  display: inline-grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  border-radius: 1rem;
  background: color-mix(in srgb, var(--bg-secondary) 74%, var(--bg-primary));
  color: var(--accent-teal);
}

.map-nearby-result__visual[data-has-photo='false'] {
  background: color-mix(in srgb, var(--accent-teal) 12%, var(--bg-secondary));
}

.map-nearby-result__visual img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.map-nearby-result__copy {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  align-self: stretch;
  gap: 0.38rem;
  min-width: 0;
}

.map-nearby-result__copy strong,
.map-nearby-result__location {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.map-nearby-result__copy strong {
  display: -webkit-box;
  font-size: 1.02rem;
  line-height: var(--line-height-tight);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.map-nearby-result__location {
  display: -webkit-box;
  line-height: 1.22;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.map-nearby-result__location {
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
}

.map-nearby-result__tags {
  display: flex;
  flex-wrap: wrap;
  grid-row: 4;
  align-self: end;
  gap: 0.38rem;
  min-width: 0;
}

.map-nearby-result__category,
.map-nearby-result__price {
  display: inline-flex;
  align-items: center;
  min-height: 1.45rem;
  max-width: 100%;
  padding: 0.2rem 0.56rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 72%, transparent);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-bold);
  line-height: 1;
}

.map-nearby-result[data-category='food'] .map-nearby-result__category {
  border-color: color-mix(in srgb, var(--badge-adventure-fg) 44%, var(--glass-border));
  color: var(--badge-adventure-fg);
  background: color-mix(in srgb, var(--badge-adventure-fg) 10%, transparent);
}

.map-nearby-result[data-category='stay'] .map-nearby-result__category {
  border-color: color-mix(in srgb, var(--badge-culture-fg) 44%, var(--glass-border));
  color: var(--badge-culture-fg);
  background: color-mix(in srgb, var(--badge-culture-fg) 10%, transparent);
}

.map-nearby-result[data-category='essentials'] .map-nearby-result__category,
.map-nearby-result[data-category='shopping'] .map-nearby-result__category {
  border-color: color-mix(in srgb, var(--badge-shopping-fg) 42%, var(--glass-border));
  color: var(--badge-shopping-fg);
  background: color-mix(in srgb, var(--badge-shopping-fg) 9%, transparent);
}

.map-nearby-result[data-category='entertainment'] .map-nearby-result__category {
  border-color: color-mix(in srgb, var(--badge-entertainment-fg) 44%, var(--glass-border));
  color: var(--badge-entertainment-fg);
  background: color-mix(in srgb, var(--badge-entertainment-fg) 10%, transparent);
}

.map-nearby-result[data-category='nature'] .map-nearby-result__category {
  border-color: color-mix(in srgb, var(--badge-nature-fg) 44%, var(--glass-border));
  color: var(--badge-nature-fg);
  background: color-mix(in srgb, var(--badge-nature-fg) 9%, transparent);
}

.map-nearby-result[data-category='scenic'] .map-nearby-result__category,
.map-nearby-result[data-category='adventure'] .map-nearby-result__category {
  border-color: color-mix(in srgb, var(--badge-scenic-fg) 44%, var(--glass-border));
  color: var(--badge-scenic-fg);
  background: color-mix(in srgb, var(--badge-scenic-fg) 9%, transparent);
}

.map-nearby-result[data-category='culture'] .map-nearby-result__category {
  border-color: color-mix(in srgb, var(--badge-nightlife-fg) 44%, var(--glass-border));
  color: var(--badge-nightlife-fg);
  background: color-mix(in srgb, var(--badge-nightlife-fg) 10%, transparent);
}

.map-nearby-result[data-category='nightlife'] .map-nearby-result__category {
  border-color: color-mix(in srgb, var(--badge-nightlife-fg) 44%, var(--glass-border));
  color: var(--badge-nightlife-fg);
  background: color-mix(in srgb, var(--badge-nightlife-fg) 10%, transparent);
}

.map-nearby-result[data-category='fuel'] .map-nearby-result__category,
.map-nearby-result[data-category='ev'] .map-nearby-result__category {
  border-color: color-mix(in srgb, var(--accent-mint) 46%, var(--glass-border));
  color: var(--accent-mint);
  background: color-mix(in srgb, var(--accent-mint) 10%, transparent);
}

.map-nearby-result__price {
  border-color: color-mix(in srgb, var(--accent-mint) 34%, var(--glass-border));
  color: var(--accent-mint);
}

.map-nearby-result__meta {
  display: grid;
  justify-items: end;
  min-width: 0;
  align-self: start;
  padding-top: 0.14rem;
}

.map-nearby-result__meta strong {
  max-width: 4.8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-nearby-result__meta strong {
  color: var(--text-primary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-bold);
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
  order: 20;
  width: 100%;
  padding: clamp(var(--space-4), 1.4vw, var(--space-5));
  overflow: hidden;
  border-color: color-mix(in srgb, var(--accent-teal) 20%, var(--glass-border));
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--glass-bg) 96%, var(--bg-secondary)), color-mix(in srgb, var(--bg-primary) 54%, var(--glass-bg))),
    radial-gradient(circle at 8% 0%, color-mix(in srgb, var(--accent-teal) 10%, transparent), transparent 34%);
}

.itinerary-assistant-slot {
  grid-column: 1 / -1;
  order: 30;
  display: grid;
  min-width: 0;
  width: 100%;
  margin-inline: 0;
  padding-top: var(--space-2);
  position: relative;
  z-index: 2;
}

.itinerary-assistant-slot :deep(.trip-ai-assist) {
  width: 100%;
  border-radius: var(--radius-2xl);
}

.itinerary-stage[data-itinerary-mode='mobile-wizard'] .itinerary-assistant-slot {
  width: 100%;
  margin-inline: 0;
}

.itinerary-stage[data-itinerary-mode='mobile-wizard'] .itinerary-assistant-slot :deep(.trip-ai-assist) {
  border-radius: var(--radius-2xl);
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

.route-card-header h2 {
  margin: 0;
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
  gap: var(--route-canvas-tile-gap);
  padding: var(--route-canvas-tile-inset);
  border: 1px solid color-mix(in srgb, var(--accent-teal) 20%, var(--glass-border));
  border-radius: var(--radius-2xl);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 48%, var(--glass-bg)), color-mix(in srgb, var(--bg-secondary) 70%, var(--glass-bg)));
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 5%, transparent);
}

.map-picker-button {
  display: grid;
  grid-template-columns: var(--route-canvas-text-gutter) minmax(0, 1fr);
  align-items: center;
  justify-content: stretch;
  column-gap: var(--space-3);
  min-width: 0;
  min-height: var(--route-canvas-control-min);
  padding: 0.38rem var(--route-canvas-control-pad-x);
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
  justify-self: center;
  width: 1rem;
  height: 1rem;
}

.map-picker-button span {
  min-width: 0;
  text-align: left;
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
  align-items: flex-start;
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
  max-width: min(100%, 18rem);
  width: fit-content;
  flex: 0 1 auto;
  padding: 0.42rem 0.55rem 0.42rem 0.42rem;
  border: 1px solid color-mix(in srgb, var(--route-chip-color) 30%, var(--glass-border));
  border-radius: var(--radius-full);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--route-chip-color) 8%, var(--glass-bg)), color-mix(in srgb, var(--bg-primary) 40%, var(--glass-bg)));
  color: var(--text-primary);
  cursor: pointer;
  box-shadow: none;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.route-sequence-chip:hover,
.route-sequence-chip:focus-visible {
  border-color: color-mix(in srgb, var(--route-chip-color) 52%, var(--glass-border));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--route-chip-color) 14%, var(--glass-bg)), color-mix(in srgb, var(--bg-primary) 50%, var(--glass-bg)));
  box-shadow: none;
  outline: none;
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
  box-shadow: none;
}

.route-sequence-chip[data-route-role='stop'] {
  --route-chip-color: var(--accent-gold);
}

.route-sequence-chip[data-route-role='end'] {
  --route-chip-color: var(--accent-teal);
}

.route-sequence-chip span {
  min-width: 0;
  max-width: min(12.5rem, 100%);
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
  grid-column: 1 / -1;
  display: grid;
  gap: var(--space-2);
  padding: 0.65rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  border-radius: var(--radius-xl);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent-teal) 8%, transparent), transparent 45%),
    color-mix(in srgb, var(--bg-primary) 34%, var(--glass-bg));
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 5%, transparent);
}

.route-place-panel[data-expanded='true'] {
  padding: var(--space-3);
}

.route-place-panel__header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  align-items: flex-start;
  min-width: 0;
}

.route-place-panel__header .eyebrow {
  margin-bottom: 0.18rem;
}

.route-place-panel__header h4 {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);
  overflow-wrap: anywhere;
}

.route-place-panel__actions {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex: 0 0 auto;
}

.route-place-refresh,
.route-place-toggle {
  width: 2.35rem;
  height: 2.35rem;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--glass-border) 92%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-secondary) 86%, var(--bg-primary));
  color: var(--text-primary);
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 6%, transparent),
    0 0.4rem 1rem color-mix(in srgb, black 18%, transparent);
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast),
    color var(--transition-fast);
}

.route-place-refresh :deep(.scope-icon),
.route-place-toggle :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
  color: color-mix(in srgb, var(--text-primary) 78%, var(--text-secondary));
}

.route-place-toggle :deep(.scope-icon) {
  transition: transform var(--transition-fast);
}

.route-place-panel[data-expanded='true'] .route-place-toggle :deep(.scope-icon) {
  transform: rotate(180deg);
}

.route-place-refresh:disabled {
  cursor: wait;
  opacity: 0.58;
}

.route-place-refresh:not(:disabled):hover,
.route-place-refresh:not(:disabled):focus-visible,
.route-place-toggle:hover,
.route-place-toggle:focus-visible {
  transform: translateY(var(--motion-button-lift));
  border-color: color-mix(in srgb, var(--accent-teal) 52%, var(--glass-border));
  background: color-mix(in srgb, var(--bg-secondary) 90%, var(--accent-teal) 10%);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 8%, transparent),
    0 0 0 2px color-mix(in srgb, var(--accent-teal) 14%, transparent);
  outline: none;
}

.route-place-preview,
.route-place-panel__body {
  min-width: 0;
}

.route-place-preview {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.45rem;
}

.route-place-preview__place,
.route-place-preview__empty {
  display: grid;
  grid-template-columns: 2.15rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
  min-height: 3rem;
  padding: 0.42rem 0.5rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  border-radius: var(--radius-full);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 62%, var(--glass-bg)), color-mix(in srgb, var(--bg-primary) 42%, var(--glass-bg)));
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.route-place-preview__empty {
  grid-column: 1 / -1;
  grid-template-columns: 2.15rem minmax(0, 1fr);
}

.route-place-preview__place:hover,
.route-place-preview__place:focus-visible,
.route-place-preview__empty:hover,
.route-place-preview__empty:focus-visible,
.route-place-preview__more:hover,
.route-place-preview__more:focus-visible {
  transform: translateY(var(--motion-button-lift));
  border-color: color-mix(in srgb, var(--accent-teal) 52%, var(--glass-border));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 6%, transparent),
    0 0.8rem 1.5rem color-mix(in srgb, var(--accent-teal) 10%, transparent);
  outline: none;
}

.route-place-preview__icon {
  width: 2.15rem;
  height: 2.15rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--bg-primary));
  color: var(--accent-teal);
}

.route-place-preview__icon :deep(.scope-icon) {
  width: 0.95rem;
  height: 0.95rem;
}

.route-place-preview__copy {
  display: grid;
  gap: 0.12rem;
  min-width: 0;
}

.route-place-preview__copy strong,
.route-place-preview__copy small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.route-place-preview__copy strong {
  color: var(--text-primary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);
}

.route-place-preview__copy small {
  color: var(--text-muted);
  font-size: var(--font-size-caption);
}

.route-place-preview__more {
  min-width: 2.6rem;
  min-height: 2.6rem;
  padding: 0 0.55rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 14%, var(--glass-bg));
  color: var(--text-primary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.route-place-panel__body {
  display: grid;
  gap: var(--space-2);
}

.route-place-search {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.45rem;
  min-height: 2.45rem;
  padding: 0.3rem 0.35rem 0.3rem 0.65rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 16%, var(--glass-border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 42%, var(--glass-bg));
  color: var(--text-secondary);
}

.route-place-search :deep(.scope-icon) {
  width: 0.95rem;
  height: 0.95rem;
}

.route-place-search input {
  min-width: 0;
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: var(--font-size-small);
  outline: none;
}

.route-place-search input::placeholder {
  color: var(--text-muted);
}

.route-place-search button {
  width: 1.95rem;
  height: 1.95rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 26%, var(--glass-border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--bg-secondary));
  color: var(--text-primary);
  cursor: pointer;
}

.route-place-search:focus-within,
.route-place-search button:hover,
.route-place-search button:focus-visible {
  border-color: color-mix(in srgb, var(--accent-teal) 54%, var(--glass-border));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-teal) 14%, transparent);
  outline: none;
}

.route-place-query-tabs {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.45rem;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 0.12rem;
  scrollbar-width: thin;
}

.route-place-query-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 2rem;
  padding: 0.34rem 0.55rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 14%, var(--glass-border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 38%, var(--glass-bg));
  color: var(--text-secondary);
  cursor: pointer;
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
}

.route-place-query-tab :deep(.scope-icon) {
  width: 0.86rem;
  height: 0.86rem;
}

.route-place-query-tab.active,
.route-place-query-tab:hover,
.route-place-query-tab:focus-visible {
  border-color: color-mix(in srgb, var(--accent-teal) 54%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 14%, var(--glass-bg));
  color: var(--text-primary);
  outline: none;
}

.route-place-tabs {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.45rem;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 0.12rem;
  scrollbar-width: thin;
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
  flex: 0 0 min(13rem, 72%);
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
  min-height: 4.6rem;
  max-height: min(16rem, 34vh);
  overflow: auto;
  padding-right: 0.12rem;
  scrollbar-width: thin;
}

.route-place-list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
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
  min-height: 4.6rem;
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
  gap: var(--route-canvas-tile-gap);
  width: 100%;
  padding: var(--route-canvas-tile-inset);
  box-sizing: border-box;
  min-height: var(--route-canvas-top-block-min);
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
  /*
    Keep the same internal text start gutter as the Start/End rows on the left card
    (badge width + gap), so both cards share one visual text axis.
  */
  display: grid;
  grid-template-columns: var(--route-canvas-text-gutter) minmax(0, 1fr);
  column-gap: var(--space-3);
  min-width: 0;
  min-height: var(--route-canvas-control-min);
  padding: 0.52rem var(--route-canvas-control-pad-x);
  border-color: color-mix(in srgb, var(--accent-teal) 26%, var(--glass-border));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent-teal) 8%, var(--glass-bg)), color-mix(in srgb, var(--bg-primary) 46%, var(--glass-bg)));
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 6%, transparent);
}

.route-signal-grid--planning span::before {
  content: '';
  width: var(--route-canvas-text-gutter);
  height: var(--route-canvas-text-gutter);
  border-radius: var(--radius-full);
  opacity: 0;
}

.route-signal-grid--planning span > strong,
.route-signal-grid--planning span > small {
  grid-column: 2;
}

.route-signal-grid--placeholder span {
  border-style: dashed;
  color: var(--text-secondary);
}

.route-signal-grid--placeholder strong {
  color: var(--text-secondary);
}

.route-signal-fuel-tile.is-actionable {
  cursor: pointer;
}

.route-signal-fuel-tile.is-actionable:hover,
.route-signal-fuel-tile.is-actionable:focus-visible {
  border-color: var(--accent-teal);
  background: color-mix(in srgb, var(--accent-teal) 13%, var(--glass-bg));
  box-shadow: var(--shadow-glow-teal);
  outline: none;
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
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-eyebrow);
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

.stop-ai-reason {
  display: block;
  margin-top: 0.16rem;
  color: color-mix(in srgb, var(--accent-teal) 72%, var(--text-secondary));
  font-size: var(--font-size-caption);
}

.itinerary-stage[data-itinerary-mode='desktop'] .stop-list {
  gap: 0.45rem;
}

.itinerary-stage[data-itinerary-mode='desktop'] .stop-copy small:not(.stop-ai-reason) {
  display: none;
}

.planning-card {
  position: relative;
  isolation: isolate;
  width: 100%;
  align-self: start;
  align-content: start;
  gap: var(--space-3);
  height: auto;
  min-height: 0;
  padding: var(--space-4);
  overflow: hidden;
  border-color: color-mix(in srgb, var(--accent-teal) 24%, var(--glass-border));
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--glass-bg) 95%, var(--bg-secondary)), color-mix(in srgb, var(--bg-primary) 58%, var(--glass-bg)));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 8%, transparent),
    0 1.4rem 3.6rem color-mix(in srgb, var(--bg-primary) 34%, transparent);
}

.planning-card[data-route-canvas-density='compact'] {
  align-self: stretch;
  height: 100%;
}

.planning-card__header {
  min-width: 0;
}

.planning-card__header,
.route-card-header > div {
  display: grid;
  align-content: start;
  gap: var(--space-1);
  min-height: 6.35rem;
}

.planning-card__header h2,
.route-card-header h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: clamp(1.35rem, 0.85vw + 1rem, 1.8rem);
  line-height: var(--line-height-tight);
}

.planning-card__header .summary-copy,
.route-card-header .summary-copy {
  display: block;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: color-mix(in srgb, var(--text-secondary) 88%, var(--text-primary));
  font-size: var(--font-size-small);
  line-height: var(--line-height-normal);
  letter-spacing: 0;
}

.planning-route-brief {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-auto-rows: minmax(var(--route-canvas-control-min), auto);
  align-items: stretch;
  gap: var(--route-canvas-tile-gap);
  padding: var(--route-canvas-tile-inset);
  min-height: calc(var(--route-canvas-control-min) + (var(--route-canvas-tile-inset) * 2));
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  border-radius: var(--radius-2xl);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 54%, var(--glass-bg)), color-mix(in srgb, var(--bg-secondary) 58%, var(--glass-bg)));
}

.planning-endpoint-card {
  display: grid;
  grid-template-columns: var(--route-canvas-text-gutter) minmax(0, 1fr);
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  min-height: 100%;
  padding: 0.52rem var(--route-canvas-control-pad-x);
  border-radius: var(--radius-xl);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 40%, transparent), color-mix(in srgb, var(--bg-primary) 18%, transparent));
}

.planning-endpoint-card small,
.planning-metrics small,
.route-signal-grid small {
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
  margin-top: 0.16rem;
  color: var(--text-primary);
  font-size: var(--font-size-body);
  line-height: var(--line-height-tight);
  overflow-wrap: anywhere;
}

.route-point-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--route-canvas-text-gutter);
  height: var(--route-canvas-text-gutter);
  border-radius: var(--radius-full);
  background: var(--accent-teal);
  color: var(--bg-primary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-bold);
  box-shadow: 0 0 1.35rem color-mix(in srgb, var(--accent-teal) 22%, transparent);
}

.planning-card .planning-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--route-canvas-tile-gap);
  padding: var(--route-canvas-tile-inset);
  margin-top: 0;
}

.planning-card .planning-metrics .summary-pill {
  display: grid;
  justify-items: start;
  gap: 0.22rem;
  min-width: 0;
  min-height: var(--route-canvas-control-min);
  padding: 0.58rem var(--route-canvas-control-pad-x);
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
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr);
  align-content: start;
  gap: var(--space-3);
  padding: var(--space-4);
  overflow: hidden;
  border-color: color-mix(in srgb, var(--accent-teal) 24%, var(--glass-border));
  background: color-mix(in srgb, var(--glass-bg) 96%, var(--bg-secondary));
}

.planning-route-card__extra {
  display: grid;
  align-content: start;
  gap: var(--space-2);
  min-height: 0;
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
    background: none;
  }
}

@media (max-width: 720px) {
  .itinerary-stage,
  .map-shell,
  .map-shell :deep(.map-view),
  .map-shell__placeholder {
    min-height: 32rem;
    height: 32rem;
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

  .map-nearby-drawer,
  .map-nearby-drawer[data-drawer-state='closed'] {
    top: var(--space-2);
    left: var(--space-2);
    bottom: auto;
    width: auto;
    max-height: min(24rem, calc(56% - var(--space-2)));
    padding: 0.62rem;
  }

  .map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] {
    right: var(--space-2);
    width: auto;
    bottom: var(--space-2);
    max-height: none;
  }

  .map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-drawer__body {
    overflow-y: auto;
  }

  .map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-layout {
    grid-template-columns: minmax(0, 1fr);
    overflow: visible;
  }

  .map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-controls {
    overflow: visible;
    max-height: none;
  }

  .map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-mode-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] .map-nearby-results {
    grid-template-columns: minmax(0, 1fr);
    overflow: visible;
  }

  .map-nearby-drawer__header h3 {
    max-width: 100%;
    font-size: var(--font-size-body-sm);
  }

  .map-nearby-results {
    max-height: none;
  }

  .map-nearby-search {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .map-nearby-result {
    grid-template-columns: 3.35rem minmax(0, 1fr) auto;
    gap: 0.64rem;
  }

  .map-nearby-result__visual {
    inline-size: 3.2rem;
    block-size: 3.2rem;
  }

  .map-nearby-result__copy strong {
    font-size: var(--font-size-body-sm);
  }

  .map-nearby-mode-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .planning-route-brief {
    grid-template-columns: minmax(0, 1fr);
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
    height: 20rem;
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

  .route-sequence-list {
    grid-template-columns: minmax(0, 1fr);
  }

  .itinerary-stage[data-itinerary-mode='mobile-wizard'] .map-nearby-drawer {
    max-height: min(18rem, calc(58% - var(--space-2)));
  }

  .itinerary-stage[data-itinerary-mode='mobile-wizard'] .map-nearby-drawer[data-drawer-state='open'][data-drawer-size='expanded'] {
    bottom: var(--space-2);
    max-height: none;
  }

  .itinerary-stage[data-itinerary-mode='mobile-wizard'] .map-nearby-results {
    max-height: none;
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
