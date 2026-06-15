<template>
  <form
    class="trip-planner glass-panel"
    data-test="trip-planner"
    data-onboarding-target="planner-shell"
    :data-planner-mode="mobileWizard ? 'mobile-wizard' : 'desktop'"
    novalidate
    @submit.prevent="handleSubmit"
  >
    <header class="planner-header" :data-header-mode="mobileWizard ? 'full' : 'compact'">
      <div class="planner-copy">
        <p class="eyebrow">Route builder</p>
        <template v-if="mobileWizard">
          <h2>{{ displayTripTitle }}</h2>
          <p class="section-copy">
            Set the brief and route here. The trip guide uses this same draft to build the live itinerary preview.
          </p>
        </template>
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
          <article class="planner-card planner-card--pillar glass-panel" data-test="planner-core-brief-card">
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
                    placeholder="Final address, city, or landmark"
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
                <small class="field-hint">Add it now or before the start point. Scope will keep both endpoints in sync.</small>
                <small v-if="errors.endDestination" class="field-error">{{ errors.endDestination }}</small>
              </div>

              <p v-if="showRouteEmptyHint" class="planner-empty-hint field-full" data-test="planner-empty-hint">
                <ScopeIcon name="pin" label="Route hint" />
                <span>Add a start or end place to drop the first pin. The route preview will update from there.</span>
              </p>

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

          <article class="planner-card planner-card--pillar glass-panel budget-card">
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

          <section class="planner-sidebar-tools" aria-label="Road trip tools">
            <article class="planner-tool-card planner-tool-card--weather" data-test="trip-weather-card">
              <header class="planner-tool-header">
                <span class="eyebrow">Weather snapshot</span>
                <strong>Origin + destination</strong>
              </header>

              <div v-if="weatherSnapshots.length" class="weather-snapshot-grid">
                <article
                  v-for="snapshot in weatherSnapshots"
                  :key="snapshot.id"
                  class="weather-snapshot"
                  :class="getWeatherSnapshotClass(snapshot)"
                >
                  <div class="weather-snapshot__hero">
                    <div class="weather-snapshot__visual" aria-hidden="true">
                      <ScopeIcon :name="getWeatherSnapshotIcon(snapshot)" />
                    </div>
                    <div class="weather-snapshot__copy">
                      <span class="weather-snapshot__location" :title="snapshot.label">{{ formatWeatherLocationLabel(snapshot.label) }}</span>
                      <strong>{{ formatWeatherTemperature(snapshot.temperatureF) }}</strong>
                      <small>{{ snapshot.condition }}</small>
                    </div>
                  </div>

                  <dl class="weather-snapshot__stats">
                    <div>
                      <dt>Wind</dt>
                      <dd>{{ formatWeatherWind(snapshot.windMph) }}</dd>
                    </div>
                    <div v-if="snapshot.airQuality">
                      <dt>AQI</dt>
                      <dd>{{ formatWeatherAirQuality(snapshot.airQuality) }}</dd>
                    </div>
                  </dl>

                  <footer class="weather-snapshot__footer">
                    <span class="weather-snapshot__source">{{ formatWeatherProvider(snapshot) }}</span>
                    <span v-if="getWeatherCheckedTimestamp(snapshot)" class="weather-snapshot__time">Checked {{ formatWeatherCheckedAt(getWeatherCheckedTimestamp(snapshot)) }}</span>
                    <span v-if="snapshot.isStale" class="weather-snapshot__flag">Stale</span>
                    <span v-if="isFallbackWeatherSnapshot(snapshot)" class="weather-snapshot__flag">Fallback</span>
                  </footer>
                </article>
              </div>
              <p v-else class="planner-tool-state" :data-state="weatherState">{{ weatherStatusCopy }}</p>
            </article>

            <article class="planner-tool-card planner-tool-card--packing" data-test="trip-packing-card">
              <header class="planner-tool-header">
                <span class="eyebrow">Packing checklist</span>
                <strong>{{ packingProgressLabel }}</strong>
              </header>

              <div class="packing-list" role="list">
                <label
                  v-for="item in packingItems"
                  :key="item.id"
                  class="packing-item"
                  :class="{ checked: item.checked }"
                  role="listitem"
                >
                  <input type="checkbox" :checked="item.checked" @change="togglePackingItem(item.id)" />
                  <span>{{ item.label }}</span>
                  <button
                    v-if="item.custom"
                    type="button"
                    :aria-label="`Remove ${item.label}`"
                    @click.prevent="removePackingItem(item.id)"
                  >
                    <ScopeIcon name="close" label="Remove packing item" />
                  </button>
                </label>
              </div>

              <form class="packing-add-form" @submit.prevent="addPackingItem">
                <input v-model.trim="newPackingItemLabel" type="text" maxlength="60" placeholder="Add item" aria-label="Add packing item" />
                <button type="submit" :disabled="!newPackingItemLabel">
                  <ScopeIcon name="plus" label="Add packing item" />
                </button>
              </form>
            </article>

            <article ref="fuelCardRef" class="planner-tool-card planner-tool-card--fuel" data-test="trip-fuel-card">
              <header class="planner-tool-header">
                <span class="eyebrow">Fuel cost calculator</span>
                <strong>{{ fuelSettingsSummary }}</strong>
              </header>

              <div class="fuel-type-selector" role="group" aria-label="Fuel tank type" data-test="fuel-type-selector">
                <button
                  v-for="option in fuelTypeOptions"
                  :key="option.id"
                  type="button"
                  class="fuel-type-selector__option"
                  :class="{ active: selectedFuelType === option.id }"
                  :aria-pressed="String(selectedFuelType === option.id)"
                  :data-test="`fuel-type-option-${option.id}`"
                  @click="selectFuelType(option.id)"
                >
                  <ScopeIcon :name="option.icon" label="" />
                  <span>{{ option.label }}</span>
                </button>
              </div>

              <div class="fuel-input-grid">
                <label class="field">
                  <span>MPG</span>
                  <div class="input-shell">
                    <input
                      v-model="fuelMpgInput"
                      type="text"
                      inputmode="decimal"
                      maxlength="8"
                      autocomplete="off"
                      placeholder="Vehicle MPG"
                      data-test="fuel-mpg-input"
                      ref="fuelMpgFieldRef"
                      @input="emitFuelSettings"
                    />
                  </div>
                  <small v-if="fuelMpgError" class="field-error" data-test="fuel-mpg-error">{{ fuelMpgError }}</small>
                </label>

                <label class="field">
                  <span>Gas price</span>
                  <div class="input-shell">
                    <input
                      v-model="fuelGasPriceInput"
                      type="text"
                      inputmode="decimal"
                      maxlength="8"
                      autocomplete="off"
                      placeholder="$ / gal"
                      data-test="fuel-price-input"
                      @input="emitFuelSettings"
                    />
                  </div>
                  <small v-if="fuelGasPriceError" class="field-error" data-test="fuel-price-error">{{ fuelGasPriceError }}</small>
                </label>
              </div>
            </article>
          </section>
        </section>

        <div v-if="mobileWizard" class="planner-step-actions">
          <button type="button" class="button button-secondary step-action-button" data-test="planner-step-1-continue" @click="emitWizardStepChange(2)">
            Continue to route
          </button>
        </div>
      </div>
    </section>

    <section v-if="mobileWizard" class="planner-step-shell" :data-step-state="getWizardStepState(2)">
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
              <h3>Stops the guide should sequence</h3>
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
            Add or reorder stops here. The guide will use this list, then tighten timing in the live preview.
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
          <article class="planner-card planner-card--pillar glass-panel">
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

          <article class="planner-card planner-card--pillar glass-panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">Interests</p>
                <h3>Trip style</h3>
              </div>
              <span class="meta-pill">{{ interestsMetaLabel }}</span>
            </div>

            <div class="chip-grid">
              <button
                v-for="category in visibleInterestCategories"
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
            <small v-if="!form.interests.length" class="field-hint interest-empty-hint" data-test="trip-interest-empty-hint">
              Optional. Scope starts from the route and your stops; vibes only nudge the mix.
            </small>
            <small v-if="errors.interests" class="field-error">{{ errors.interests }}</small>
          </article>
        </section>

        <footer class="planner-footer" :class="{ 'planner-footer--mobile': mobileWizard }">
          <div class="planner-footer-copy">
            <span class="eyebrow">Scope trip guide</span>
            <strong>{{ destinationLabel }}</strong>
            <small>{{ guideHandoffCopy }} {{ interestsLabel }}</small>
          </div>

          <div class="planner-footer-actions">
            <button v-if="mobileWizard" type="button" class="button button-secondary step-action-button" data-test="planner-step-3-back" @click="emitWizardStepChange(2)">
              Back to route
            </button>
            <button class="submit-button" data-test="trip-planner-submit" data-onboarding-target="planner-submit" type="submit" :disabled="submitting">
              <span>{{ submitting ? 'Guide is building...' : 'Build with Trip Guide' }}</span>
            </button>
          </div>

          <small class="planner-footer-learning-note" data-test="trip-ai-learning-note">
            {{ learningNote }}
          </small>

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
  TRIP_PLANNER_CATEGORIES as categories,
  TRIP_PLANNER_CATEGORY_LABELS as categoryLabels,
  TRIP_PLANNER_PACE_OPTIONS as paceOptions,
} from '@/config/tripPlannerConfig';
import {
  BUDGET_STEP_AMOUNT,
  FUEL_GAS_PRICE_MAX,
  FUEL_GAS_PRICE_MIN,
  FUEL_MPG_MAX,
  FUEL_MPG_MIN,
  buildWeatherSearchLabels,
  cloneDefaultPackingItems,
  formatDistanceMiles,
  formatFuelInputValue,
  formatFuelLimit,
  formatLocationSuggestionBadge,
  formatLocationSuggestionMeta,
  formatLocationSuggestionTitle,
  formatRouteEndpointLabel,
  formatWeatherAirQuality,
  formatWeatherCheckedAt,
  formatWeatherLocationLabel,
  formatWeatherProvider,
  formatWeatherTemperature,
  formatWeatherWind,
  fuelTypeOptions,
  getFuelInputError,
  getPackingChecklistStorageKey as buildPackingChecklistStorageKey,
  getWeatherCheckedTimestamp,
  isCoordinatePair,
  isDraftPackingChecklistScope as isDraftPackingChecklistScopeValue,
  isFallbackWeatherSnapshot,
  normalizeBudgetRange,
  normalizeBudgetValue,
  normalizeCoordinate,
  normalizePackingChecklistScope as normalizePackingChecklistScopeValue,
  normalizePackingItem,
  normalizeStops,
  normalizeTripFuelType,
  parseBoundedFuelNumber,
  parseFuelNumber,
  resolveLocationSuggestionLabel,
  toCalendarDayNumber,
  type PackingChecklistItem,
  type NormalizedBudgetRange,
} from '@/components/trips/tripPlannerHelpers';
import {
  clearLocationTimer,
  useTripPlannerLocationSearch,
  type LocationFieldKey,
  type LocationSearchAnchor,
} from '@/components/trips/tripPlannerLocationSearch';
import { searchLocations, type GeocodeResult } from '@/services/mapService';
import {
  canLoadOpenWeatherMapWeather,
  getOpenWeatherMapSnapshot,
  type WeatherLookupPoint,
  type WeatherSnapshot,
} from '@/services/openWeatherMapService';
import type { SpotCategory, TripFuelSettings, TripFuelType, TripPlannerInput, TripSpot } from '@/types';
import { getInclusiveDaySpan } from '@/utils/formatters';
import { useAnalyticsConsent } from '@/utils/analyticsConsent';
import { getWeatherSnapshotClassName, getWeatherSnapshotIconName } from '@/utils/weatherDisplay';

interface PlannerErrors {
  destination?: string;
  endDestination?: string;
  startDate?: string;
  endDate?: string;
  budget?: string;
  groupSize?: string;
  interests?: string;
}

type PlannerWizardStep = 1 | 2 | 3 | 4;
type WeatherState = 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'missing-key';

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
    fuelSettings?: TripFuelSettings;
    packingChecklistScope?: string;
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
    fuelSettings: () => ({}),
    packingChecklistScope: 'draft:standalone',
  },
);

const emit = defineEmits<{
  (event: 'submit', payload: TripPlannerInput): void;
  (event: 'update:draft', payload: TripPlannerInput): void;
  (event: 'update:stops', payload: TripSpot[]): void;
  (event: 'update:title', payload: string): void;
  (event: 'update:fuel-settings', payload: TripFuelSettings): void;
  (event: 'wizard-step-change', payload: PlannerWizardStep): void;
}>();

const { consent } = useAnalyticsConsent();
const learningNote = computed(() =>
  consent.value === 'granted'
    ? 'AI learning is on: opted-in chats and planner outcomes can help train future Scope AI trips.'
    : 'AI learning is off: chats stay private from Scope AI training until the user opts in.',
);

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const WEATHER_REFRESH_KEY_DEBOUNCE_MS = 200;
const WEATHER_REFRESH_INTERVAL_MS = 120_000;

const errors = ref<PlannerErrors>({});
const resolvedBudgetBounds = computed(() => normalizeBudgetRange(props.budgetRange));
const resolvedSelectedStops = computed(() => (props.selectedStops.length ? props.selectedStops : props.stops));
const form = reactive<TripPlannerInput>(buildFormState(props.initialValue));
const tripTitle = ref(props.initialTitle.trim() || buildTripTitle(props.initialValue.destination));
const budgetCeiling = ref(resolveBudgetCeiling(props.initialValue, resolvedBudgetBounds.value));
const budgetFloor = ref(resolveBudgetFloor(props.initialValue, resolvedBudgetBounds.value));
const budgetFloorInput = ref<HTMLInputElement | null>(null);
const budgetCeilingInput = ref<HTMLInputElement | null>(null);
const destinationStops = ref<TripSpot[]>(normalizeStops(resolvedSelectedStops.value));
const destinationSearch = ref('');
const weatherSnapshots = ref<WeatherSnapshot[]>([]);
const weatherState = ref<WeatherState>('idle');
const weatherErrorMessage = ref('');
const weatherRequestId = ref(0);
const packingItems = ref<PackingChecklistItem[]>(loadPackingChecklist(getPackingChecklistStorageKey()));
const newPackingItemLabel = ref('');
const fuelMpgInput = ref(formatFuelInputValue(props.fuelSettings.mpg));
const fuelGasPriceInput = ref(formatFuelInputValue(props.fuelSettings.gasPricePerGallon));
const selectedFuelType = ref<TripFuelType>(normalizeTripFuelType(props.fuelSettings.fuelType));
const fuelCardRef = ref<HTMLElement | null>(null);
const fuelMpgFieldRef = ref<HTMLInputElement | null>(null);
const draggingStopId = ref<string | null>(null);
const dropTargetStopId = ref<string | null>(null);
let weatherRefreshTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.initialValue,
  (nextValue) => {
    Object.assign(form, buildFormState(nextValue));
    budgetCeiling.value = resolveBudgetCeiling(nextValue, resolvedBudgetBounds.value);
    budgetFloor.value = resolveBudgetFloor(nextValue, resolvedBudgetBounds.value);
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
    if (normalizedTitle !== tripTitle.value.trim()) {
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

const weatherLookupPoints = computed<WeatherLookupPoint[]>(() => {
  const points: WeatherLookupPoint[] = [];
  const originLabel = form.destination.trim();
  const destinationLabelValue = form.endDestination?.trim() ?? '';

  if (originLabel) {
    points.push({
      label: originLabel,
      latitude: form.destinationLatitude,
      longitude: form.destinationLongitude,
      searchLabels: buildWeatherSearchLabels(originLabel, destinationLabelValue),
    });
  }

  if (destinationLabelValue && destinationLabelValue.toLowerCase() !== originLabel.toLowerCase()) {
    points.push({
      label: destinationLabelValue,
      latitude: form.endDestinationLatitude,
      longitude: form.endDestinationLongitude,
      searchLabels: buildWeatherSearchLabels(destinationLabelValue, originLabel),
    });
  }

  return points;
});
const weatherLookupKey = computed(() =>
  weatherLookupPoints.value
    .map((point) => [
      point.label,
      Number.isFinite(point.latitude) ? Number(point.latitude).toFixed(5) : '',
      Number.isFinite(point.longitude) ? Number(point.longitude).toFixed(5) : '',
      ...(point.searchLabels ?? []),
    ].join(':'))
    .join('|'),
);
const weatherStatusCopy = computed(() => {
  switch (weatherState.value) {
    case 'loading':
      return 'Checking live weather...';
    case 'missing-key':
      return 'Weather needs browser fetch support.';
    case 'error':
      return weatherErrorMessage.value || 'Weather is unavailable right now.';
    case 'empty':
      return 'Add an origin or destination to check weather.';
    default:
      return 'Weather will appear when the route has a city.';
  }
});
const packingProgressLabel = computed(() => {
  const checkedCount = packingItems.value.filter((item) => item.checked).length;
  return `${checkedCount}/${packingItems.value.length} packed`;
});
const parsedFuelMpg = computed(() => parseBoundedFuelNumber(fuelMpgInput.value, FUEL_MPG_MIN, FUEL_MPG_MAX));
const parsedFuelGasPrice = computed(() => parseBoundedFuelNumber(fuelGasPriceInput.value, FUEL_GAS_PRICE_MIN, FUEL_GAS_PRICE_MAX));
const fuelMpgError = computed(() => getFuelInputError(fuelMpgInput.value, 'MPG', FUEL_MPG_MIN, FUEL_MPG_MAX));
const fuelGasPriceError = computed(() => getFuelInputError(fuelGasPriceInput.value, 'Gas price', FUEL_GAS_PRICE_MIN, FUEL_GAS_PRICE_MAX, '$20.00/gal'));
const selectedFuelTypeLabel = computed(() =>
  fuelTypeOptions.find((option) => option.id === selectedFuelType.value)?.label ?? 'Regular',
);
const fuelSettingsSummary = computed(() => {
  const mpg = parsedFuelMpg.value;
  const price = parsedFuelGasPrice.value;
  if (fuelMpgError.value || fuelGasPriceError.value) {
    return 'Check fuel inputs';
  }

  if (mpg && price) {
    return `${selectedFuelTypeLabel.value} / ${mpg.toLocaleString('en-US', { maximumFractionDigits: 1 })} MPG / $${price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}/gal`;
  }

  if (mpg) {
    return `${selectedFuelTypeLabel.value} / add gas price`;
  }

  if (price) {
    return `${selectedFuelTypeLabel.value} / add MPG`;
  }

  return `${selectedFuelTypeLabel.value} tank`;
});

const destinationLabel = computed(() => {
  const startDestination = formatRouteEndpointLabel(form.destination);
  const endDestination = formatRouteEndpointLabel(form.endDestination);

  if (startDestination && endDestination) {
    return `${startDestination} to ${endDestination}`;
  }

  return startDestination || 'Pick a place to plan around';
});
const canEditEndDestination = computed(() => true);
const hasPlannerRouteSeed = computed(() => (
  Boolean(form.destination.trim() || (form.endDestination ?? '').trim() || destinationStops.value.length) ||
  isCoordinatePair(form.destinationLatitude, form.destinationLongitude) ||
  isCoordinatePair(form.endDestinationLatitude, form.endDestinationLongitude)
));
const showRouteEmptyHint = computed(() => !hasPlannerRouteSeed.value);

const {
  locationSuggestions,
  resetLocationSuggestionState,
  shouldShowLocationSuggestions,
  handleLocationFocus,
  handleLocationBlur,
  handleLocationInput,
  selectLocationSuggestion,
  resolveMissingLocationCoordinates,
  handleLocationKeydown,
  disposeLocationSearch,
} = useTripPlannerLocationSearch({
  searchLocations,
  canUseLocationField: (field) => field !== 'endDestination' || canEditEndDestination.value,
  getLocationFieldValue,
  hasLocationCoordinates: (field) => Object.keys(resolveLocationCoordinatePayload(field)).length > 0,
  setLocationFieldValue,
  clearLocationCoordinates,
  setLocationCoordinates,
  resolveLocationSearchProximity,
  resolveLocationSuggestionLabel,
  formatLocationSuggestionTitle,
  onBlockedLocationField: (field) => {
    if (field === 'endDestination') {
      clearEndDestination();
    }
  },
  onLocationInput: clearLocationError,
});

watch(
  canEditEndDestination,
  (canEditEnd) => {
    if (!canEditEnd) {
      clearEndDestination();
    }
  },
  { immediate: true },
);

const interestsMetaLabel = computed(() => {
  if (!form.interests.length) {
    return 'Optional';
  }

  return `${form.interests.length} selected`;
});
const interestsLabel = computed(() => {
  if (!form.interests.length) {
    return 'Smart defaults stay on.';
  }

  const labels = form.interests.map((interest) => categoryLabels[interest]);
  if (labels.length <= 3) {
    return labels.join(', ');
  }

  return `${labels.slice(0, 3).join(', ')} +${labels.length - 3} more`;
});
const guideHandoffCopy = computed(() => {
  if (!form.destination.trim() && !(form.endDestination ?? '').trim()) {
    return 'Set a real route first; the guide uses the drive before it suggests anything.';
  }

  if (!form.endDestination?.trim()) {
    return 'Add the final destination so the guide can stay route-grounded.';
  }

  return 'Your guide will use the route first, then dates, budget, pace, travelers, and vibes to pick real stops that fit the drive.';
});
const visibleInterestCategories = computed(() => (
  categories.filter((category) => category !== 'other' || form.interests.includes('other'))
));
const budgetRangeLabel = computed(() => `${currencyFormatter.format(budgetFloor.value)} - ${currencyFormatter.format(budgetCeiling.value)}`);
const dailyBudgetLabel = computed(() => `${currencyFormatter.format(dailyBudget.value)} / day`);
const stepOneSummary = computed(() => `${destinationLabel.value} · ${tripLengthDays.value} day${tripLengthDays.value === 1 ? '' : 's'}`);
const stepTwoSummary = computed(() => {
  const stopCount = destinationStops.value.length;
  if (!stopCount) {
    return 'Stops appear after a destination is selected.';
  }

  const leadStop = destinationStops.value[0]?.title ?? 'Choose stops';
  return `${stopCount} stop${stopCount === 1 ? '' : 's'} · ${leadStop}`;
});
const stepThreeSummary = computed(() => (
  form.interests.length
    ? `${paceLabel.value} pace · ${form.interests.length} interest${form.interests.length === 1 ? '' : 's'}`
    : `${paceLabel.value} pace · vibes optional`
));

function normalizePackingChecklistScope(scope = props.packingChecklistScope): string {
  return normalizePackingChecklistScopeValue(scope);
}

function isDraftPackingChecklistScope(scope: string | undefined): boolean {
  return isDraftPackingChecklistScopeValue(scope ?? props.packingChecklistScope);
}

function getPackingChecklistStorageKey(scope = props.packingChecklistScope): string {
  return buildPackingChecklistStorageKey(scope);
}

function readPackingChecklistStorage(storageKey = getPackingChecklistStorageKey()): PackingChecklistItem[] | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  try {
    const rawValue = localStorage.getItem(storageKey);
    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsedValue)) {
      return null;
    }

    const parsedItems = parsedValue
      .map((item, index) => normalizePackingItem(item as Partial<PackingChecklistItem>, index))
      .filter((item): item is PackingChecklistItem => Boolean(item));
    return parsedItems.length ? parsedItems : null;
  } catch {
    return null;
  }
}

function loadPackingChecklist(storageKey = getPackingChecklistStorageKey()): PackingChecklistItem[] {
  return readPackingChecklistStorage(storageKey) ?? cloneDefaultPackingItems();
}

function persistPackingChecklist(storageKey = getPackingChecklistStorageKey()): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify(packingItems.value));
  } catch {
    // Ignore storage quota/privacy failures; the visible checklist still works for this session.
  }
}

function togglePackingItem(itemId: string): void {
  packingItems.value = packingItems.value.map((item) => (
    item.id === itemId ? { ...item, checked: !item.checked } : item
  ));
}

function addPackingItem(labelOverride?: string | Event): void {
  const hasLabelOverride = typeof labelOverride === 'string';
  const label = (hasLabelOverride ? labelOverride : newPackingItemLabel.value).trim();
  if (!label) {
    return;
  }

  packingItems.value = [
    ...packingItems.value,
    {
      id: `custom-${Date.now().toString(36)}-${packingItems.value.length}`,
      label,
      checked: false,
      custom: true,
    },
  ];
  if (!hasLabelOverride) {
    newPackingItemLabel.value = '';
  }
}

function removePackingItem(itemId: string): void {
  const normalizedItemId = itemId.trim().toLowerCase();
  packingItems.value = packingItems.value.filter((item) =>
    item.id !== itemId && item.label.trim().toLowerCase() !== normalizedItemId,
  );
}

function selectFuelType(fuelType: TripFuelType): void {
  if (selectedFuelType.value === fuelType) {
    return;
  }

  selectedFuelType.value = fuelType;
  emitFuelSettings();
}

function emitFuelSettings(): void {
  emit('update:fuel-settings', {
    mpg: parsedFuelMpg.value,
    gasPricePerGallon: parsedFuelGasPrice.value,
    fuelType: selectedFuelType.value,
  });
}

function scrollToFuelSettings(): void {
  fuelCardRef.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  });

  window.setTimeout(() => {
    fuelMpgFieldRef.value?.focus({ preventScroll: true });
  }, 420);
}

function getWeatherSnapshotClass(snapshot: WeatherSnapshot): string {
  return getWeatherSnapshotClassName(snapshot);
}

function getWeatherSnapshotIcon(snapshot: WeatherSnapshot): string {
  return getWeatherSnapshotIconName(snapshot);
}

async function loadWeatherSnapshots(): Promise<void> {
  const requestId = weatherRequestId.value + 1;
  weatherRequestId.value = requestId;
  weatherErrorMessage.value = '';

  try {
    if (!weatherLookupPoints.value.length) {
      weatherSnapshots.value = [];
      weatherState.value = 'empty';
      return;
    }

    if (!canLoadOpenWeatherMapWeather()) {
      weatherSnapshots.value = [];
      weatherState.value = 'missing-key';
      return;
    }

    weatherState.value = 'loading';

    const results = await Promise.allSettled(
      weatherLookupPoints.value.map((point) => getOpenWeatherMapSnapshot(point)),
    );
    if (requestId !== weatherRequestId.value) {
      return;
    }

    const snapshots = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
    weatherSnapshots.value = snapshots;

    if (snapshots.length) {
      weatherState.value = 'ready';
      return;
    }

    weatherState.value = 'error';
    weatherErrorMessage.value = 'Weather is unavailable right now.';
  } finally {
    if (
      requestId === weatherRequestId.value &&
      weatherLookupPoints.value.length &&
      canLoadOpenWeatherMapWeather()
    ) {
      scheduleWeatherRefresh(WEATHER_REFRESH_INTERVAL_MS);
    }
  }
}

function clearWeatherRefreshTimer(): void {
  if (!weatherRefreshTimer) {
    return;
  }

  clearTimeout(weatherRefreshTimer);
  weatherRefreshTimer = null;
}

function scheduleWeatherRefresh(delayMs = WEATHER_REFRESH_KEY_DEBOUNCE_MS): void {
  clearWeatherRefreshTimer();
  weatherRefreshTimer = setTimeout(() => {
    weatherRefreshTimer = null;
    void loadWeatherSnapshots();
  }, delayMs);
}

watch(
  weatherLookupKey,
  () => {
    scheduleWeatherRefresh();
  },
  { immediate: true },
);

watch(
  packingItems,
  () => {
    persistPackingChecklist();
  },
  { deep: true },
);

watch(
  () => props.packingChecklistScope,
  (nextScope, previousScope) => {
    const nextStorageKey = getPackingChecklistStorageKey(nextScope);
    const storedItems = readPackingChecklistStorage(nextStorageKey);
    const shouldCarryDraftItemsToSavedTrip = Boolean(
      previousScope &&
      isDraftPackingChecklistScope(previousScope) &&
      !isDraftPackingChecklistScope(nextScope) &&
      !storedItems,
    );

    if (shouldCarryDraftItemsToSavedTrip) {
      persistPackingChecklist(nextStorageKey);
      return;
    }

    packingItems.value = storedItems ?? cloneDefaultPackingItems();
  },
);

watch(
  () => props.fuelSettings,
  (nextSettings) => {
    const nextMpg = formatFuelInputValue(nextSettings?.mpg);
    const nextGasPrice = formatFuelInputValue(nextSettings?.gasPricePerGallon);
    const nextFuelType = normalizeTripFuelType(nextSettings?.fuelType);
    if (nextMpg !== fuelMpgInput.value) {
      fuelMpgInput.value = nextMpg;
    }
    if (nextGasPrice !== fuelGasPriceInput.value) {
      fuelGasPriceInput.value = nextGasPrice;
    }
    if (nextFuelType !== selectedFuelType.value) {
      selectedFuelType.value = nextFuelType;
    }
  },
  { deep: true },
);

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

function clearEndDestination(): void {
  setLocationFieldValue('endDestination', '');
  clearLocationCoordinates('endDestination');
  resetLocationSuggestionState('endDestination');

  if (errors.value.endDestination) {
    errors.value = {
      ...errors.value,
      endDestination: undefined,
    };
  }
}

function clearLocationError(field: LocationFieldKey): void {
  if (errors.value[field]) {
    errors.value = {
      ...errors.value,
      [field]: undefined,
    };
  }
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

function resolveBudgetCeiling(initialValue: Partial<TripPlannerInput>, bounds: NormalizedBudgetRange): number {
  return normalizeBudgetValue(initialValue.budget ?? form.budget, bounds.min);
}

function resolveBudgetFloor(initialValue: Partial<TripPlannerInput>, bounds: Pick<NormalizedBudgetRange, 'min'>): number {
  if (initialValue.budgetFloor !== undefined) {
    return normalizeBudgetValue(initialValue.budgetFloor, bounds.min);
  }

  return bounds.min;
}

function syncStops(nextStops: TripSpot[]): void {
  destinationStops.value = normalizeStops(nextStops);
  emit('update:stops', destinationStops.value.map((stop) => ({ ...stop })));
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
  const normalizedFloor = normalizeBudgetValue(budgetFloor.value, 0);
  const normalizedCeiling = normalizeBudgetValue(budgetCeiling.value, 0);
  budgetFloor.value = normalizedCeiling < normalizedFloor ? normalizedCeiling : normalizedFloor;
  budgetCeiling.value = normalizedCeiling;
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

  const hasStartDestination = Boolean(form.destination.trim());
  const hasEndDestination = Boolean((form.endDestination ?? '').trim());

  if (!hasStartDestination && !hasEndDestination) {
    nextErrors.destination = 'Enter a start or final city, state, or place so Scope can build a route.';
  }

  if (hasStartDestination && !hasEndDestination) {
    nextErrors.endDestination = 'Enter a final destination so Scope can build the itinerary.';
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

  if (budgetCeiling.value < budgetFloor.value) {
    nextErrors.budget = 'Maximum budget must be at least the minimum budget.';
  }

  if (form.groupSize < 1 || form.groupSize > 12) {
    nextErrors.groupSize = 'Group size must stay between 1 and 12.';
  }

  return nextErrors;
}

function resolveErrorStep(nextErrors: PlannerErrors): PlannerWizardStep {
  if (nextErrors.destination || nextErrors.endDestination || nextErrors.startDate || nextErrors.endDate || nextErrors.budget || nextErrors.groupSize) {
    return 1;
  }

  if (nextErrors.interests) {
    return 3;
  }

  return 1;
}

async function handleSubmit(): Promise<void> {
  normalizeBudgetInputs();
  const nextErrors = validatePlanner();
  errors.value = nextErrors;

  if (Object.keys(nextErrors).length > 0) {
    emitWizardStepChange(resolveErrorStep(nextErrors));
    return;
  }

  await resolveMissingLocationCoordinates();

  form.budget = budgetCeiling.value;
  form.budgetFloor = budgetFloor.value;

  emit('submit', buildPlannerPayload());
}

onBeforeUnmount(() => {
  clearWeatherRefreshTimer();
  weatherRequestId.value += 1;
  disposeLocationSearch();
});

defineExpose({
  scrollToFuelSettings,
  addPackingItem,
  removePackingItem,
  ...(import.meta.env.MODE === 'test'
    ? {
        __coverage: {
          addPackingItem,
          buildFormState,
          buildPlannerPayload,
          clearEndDestination,
          clearLocationCoordinates,
          clearLocationTimer,
          cloneDefaultPackingItems,
          emitFuelSettings,
          formatDistanceMiles,
          formatFuelInputValue,
          formatFuelLimit,
          formatLocationSuggestionBadge,
          formatLocationSuggestionMeta,
          formatLocationSuggestionTitle,
          formatWeatherAirQuality,
          formatWeatherCheckedAt,
          formatWeatherLocationLabel,
          formatWeatherProvider,
          formatWeatherTemperature,
          formatWeatherWind,
          getFuelInputError,
          getPackingChecklistStorageKey,
          getWeatherCheckedTimestamp,
          getWeatherSnapshotClass,
          getWeatherSnapshotIcon,
          handleLocationBlur,
          handleLocationFocus,
          handleLocationInput,
          handleLocationKeydown,
          isCoordinatePair,
          isDraftPackingChecklistScope,
          loadPackingChecklist,
          normalizeBudgetRange,
          normalizeBudgetValue,
          normalizePackingChecklistScope,
          normalizePackingItem,
          normalizeTripFuelType,
          parseBoundedFuelNumber,
          parseFuelNumber,
          persistPackingChecklist,
          readPackingChecklistStorage,
          removePackingItem,
          resetLocationSuggestionState,
          resolveLocationCoordinatePayload,
          resolveLocationSearchProximity,
          scrollToFuelSettings,
          selectFuelType,
          shouldShowLocationSuggestions,
          validatePlanner,
        },
      }
    : {}),
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
  min-height: 0;
}

.trip-planner[data-planner-mode='desktop'] {
  gap: var(--space-3);
  min-height: 0;
  height: auto;
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
  gap: 0;
}

.trip-planner[data-planner-mode='desktop'] .planner-header[data-header-mode='compact'] {
  margin-bottom: calc(var(--space-2) * -1);
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

.planner-card--pillar {
  border-color: color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  background: color-mix(in srgb, var(--bg-primary) 48%, var(--glass-bg));
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

.planner-empty-hint {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  width: fit-content;
  max-width: 100%;
  margin: 0;
  padding: 0.65rem 0.85rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-secondary) 68%, transparent);
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  line-height: var(--line-height-normal);
}

.planner-empty-hint :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
  color: var(--accent-teal);
  flex-shrink: 0;
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

.trip-planner input[type='number'] {
  appearance: textfield;
  -moz-appearance: textfield;
}

.trip-planner input[type='number']::-webkit-outer-spin-button,
.trip-planner input[type='number']::-webkit-inner-spin-button {
  margin: 0;
  appearance: none;
  -webkit-appearance: none;
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
  gap: 0.35rem;
  min-height: 4.75rem;
  padding: var(--space-3);
  text-align: left;
  border-radius: var(--radius-xl);
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.trip-planner[data-planner-mode='desktop'] .pace-card {
  padding: var(--space-3);
}

.pace-card span {
  font-size: var(--font-size-small);
  line-height: var(--line-height-normal);
}

.pace-card.active {
  border-color: color-mix(in srgb, var(--accent-teal) 54%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 9%, var(--glass-bg));
  box-shadow: none;
}

.chip-grid {
  grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
  gap: var(--space-2);
}

.interest-chip {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-2);
  width: 100%;
  min-height: 2.9rem;
  padding: 0.62rem 0.78rem;
  border-width: 1px;
  border-radius: var(--radius-lg);
  border-color: color-mix(in srgb, var(--interest-fg, var(--text-secondary)) 24%, var(--glass-border));
  background: color-mix(in srgb, var(--interest-bg, var(--bg-secondary)) 18%, var(--bg-secondary));
  color: color-mix(in srgb, var(--interest-fg, var(--text-primary)) 76%, var(--text-primary));
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-normal);
  opacity: 1;
  transition:
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

.interest-chip.badge-entertainment {
  --interest-bg: var(--badge-entertainment-bg);
  --interest-fg: var(--badge-entertainment-fg);
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
  padding: 0.58rem 0.72rem;
}

.interest-chip.active,
.interest-chip:hover,
.interest-chip:focus-visible {
  outline: none;
}

.interest-chip :deep(.scope-icon) {
  width: 1rem;
  height: 1rem;
  color: color-mix(in srgb, var(--interest-fg, var(--text-secondary)) 78%, var(--text-secondary));
  flex-shrink: 0;
}

.interest-empty-hint {
  display: block;
}

.planner-footer {
  display: grid;
  justify-items: center;
  gap: var(--space-3);
  align-items: center;
  text-align: center;
  padding-top: var(--space-2);
  border-top: 1px solid color-mix(in srgb, var(--glass-border) 70%, transparent);
}

.planner-footer--mobile {
  align-items: stretch;
}

.planner-footer-copy {
  width: min(100%, 38rem);
  min-width: 0;
  gap: 0.35rem;
  justify-items: center;
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

.planner-footer-learning-note {
  width: min(100%, 38rem);
  margin: 0;
  color: color-mix(in srgb, var(--text-muted) 88%, var(--accent-teal));
  font-size: var(--font-size-caption);
  line-height: var(--line-height-normal);
  text-align: center;
}

.planner-sidebar-tools {
  display: grid;
  gap: var(--space-3);
  grid-template-columns: 1fr;
}

.planner-tool-card {
  display: grid;
  gap: var(--space-3);
  padding: 0.9rem;
  border: 1px solid color-mix(in srgb, var(--accent-teal) 18%, var(--glass-border));
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--bg-primary) 48%, var(--glass-bg));
  overflow: hidden;
}

.planner-tool-header {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}

.planner-tool-header strong {
  color: var(--text-primary);
  font-size: var(--font-size-body);
  line-height: var(--line-height-tight);
  overflow-wrap: anywhere;
}

.planner-tool-state,
.weather-snapshot-grid,
.packing-list,
.packing-add-form,
.fuel-type-selector,
.fuel-input-grid {
  margin: 0;
}

.planner-tool-state {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  line-height: var(--line-height-normal);
}

.weather-snapshot-grid,
.packing-list,
.fuel-input-grid {
  display: grid;
  gap: 0.65rem;
}

.fuel-type-selector {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(4.4rem, 1fr));
  gap: 0.36rem;
}

.fuel-type-selector__option {
  min-width: 0;
  min-height: 2.08rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  padding: 0.34rem 0.42rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, var(--border));
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-primary) 84%, transparent);
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-fast);
}

.fuel-type-selector__option:hover,
.fuel-type-selector__option.active {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent-teal) 58%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 16%, var(--bg-secondary));
  color: var(--text-primary);
}

.fuel-type-selector__option span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fuel-type-selector__option :deep(.scope-icon) {
  width: 0.92rem;
  height: 0.92rem;
  flex: 0 0 auto;
}

.weather-snapshot-grid {
  grid-template-columns: repeat(auto-fit, minmax(min(13.25rem, 100%), 13.25rem));
  justify-content: center;
  align-items: start;
  gap: 0.92rem;
}

.weather-snapshot {
  display: grid;
  align-content: space-between;
  gap: 0.72rem;
  aspect-ratio: 1 / 1;
  width: min(100%, 13.25rem);
  min-height: 0;
  overflow: hidden;
  padding: 0.94rem;
  border: 1px solid color-mix(in srgb, var(--text-primary) 12%, transparent);
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--accent-teal) 10%, var(--bg-secondary));
  box-shadow: none;
}

.weather-snapshot.is-clear {
  border-color: color-mix(in srgb, var(--accent-gold) 22%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-gold) 12%, var(--bg-secondary));
}

.weather-snapshot.is-clear-night {
  border-color: color-mix(in srgb, var(--accent-teal) 20%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 8%, var(--bg-secondary));
}

.weather-snapshot.is-rain {
  border-color: color-mix(in srgb, var(--info) 22%, var(--glass-border));
  background: color-mix(in srgb, var(--info) 12%, var(--bg-secondary));
}

.weather-snapshot.is-snow,
.weather-snapshot.is-fog {
  border-color: color-mix(in srgb, var(--text-secondary) 20%, var(--glass-border));
  background: color-mix(in srgb, var(--text-secondary) 9%, var(--bg-secondary));
}

.weather-snapshot.is-storm {
  border-color: color-mix(in srgb, var(--warning) 26%, var(--glass-border));
  background: color-mix(in srgb, var(--warning) 13%, var(--bg-secondary));
}

.weather-snapshot.is-wind {
  border-color: color-mix(in srgb, var(--accent-teal) 24%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 12%, var(--bg-secondary));
}

.weather-snapshot__hero {
  display: grid;
  align-items: start;
  gap: 0.54rem;
  justify-items: center;
  min-width: 0;
  text-align: center;
}

.weather-snapshot__visual {
  display: grid;
  place-items: center;
  justify-self: center;
  width: 2.72rem;
  height: 2.72rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 46%, transparent);
  color: var(--accent-teal);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 10%, transparent);
}

.weather-snapshot.is-clear .weather-snapshot__visual {
  color: var(--accent-gold);
}

.weather-snapshot.is-clear-night .weather-snapshot__visual {
  color: color-mix(in srgb, var(--text-primary) 82%, var(--accent-teal));
}

.weather-snapshot.is-rain .weather-snapshot__visual,
.weather-snapshot.is-snow .weather-snapshot__visual,
.weather-snapshot.is-fog .weather-snapshot__visual {
  color: var(--info);
}

.weather-snapshot.is-storm .weather-snapshot__visual {
  color: var(--warning);
}

.weather-snapshot__visual :deep(.scope-icon) {
  width: 1.15rem;
  height: 1.15rem;
}

.weather-snapshot__copy {
  display: grid;
  gap: 0.12rem;
  justify-items: center;
  min-width: 0;
  width: 100%;
}

.weather-snapshot__copy small,
.weather-snapshot__stats,
.weather-snapshot__footer {
  color: color-mix(in srgb, var(--text-primary) 76%, var(--text-secondary));
  line-height: var(--line-height-tight);
}

.weather-snapshot__location {
  max-width: 100%;
  overflow: hidden;
  color: var(--text-primary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-bold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weather-snapshot strong {
  color: var(--text-primary);
  font-size: 2.4rem;
  letter-spacing: 0;
  line-height: var(--line-height-tight);
}

.weather-snapshot__copy small {
  max-width: 100%;
  overflow: hidden;
  font-size: var(--font-size-caption);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weather-snapshot__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.42rem;
  margin: 0;
}

.weather-snapshot__stats div {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 0.08rem;
  min-width: 0;
  min-height: 2.35rem;
  padding: 0.42rem 0.48rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 70%, transparent);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--bg-primary) 34%, transparent);
}

.weather-snapshot__stats div:only-child {
  grid-column: 1 / -1;
}

.weather-snapshot__stats dt {
  color: var(--text-muted);
  font-size: 0.66rem;
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);
  text-transform: uppercase;
}

.weather-snapshot__stats dd {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weather-snapshot__footer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 0.26rem 0.54rem;
  padding-top: 0.48rem;
  border-top: 1px solid color-mix(in srgb, var(--glass-border) 64%, transparent);
  font-size: var(--font-size-caption);
}

.weather-snapshot__source {
  min-width: 0;
  overflow: hidden;
  color: color-mix(in srgb, var(--text-primary) 68%, var(--text-muted));
  font-weight: var(--font-weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weather-snapshot__time {
  justify-self: end;
  min-width: 0;
  overflow: hidden;
  color: color-mix(in srgb, var(--text-primary) 78%, var(--text-secondary));
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weather-snapshot__flag {
  justify-self: end;
  padding: 0.18rem 0.42rem;
  border: 1px solid color-mix(in srgb, var(--warning) 28%, transparent);
  border-radius: var(--radius-full);
  color: color-mix(in srgb, var(--text-primary) 88%, var(--warning));
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.packing-list {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.packing-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  min-height: 2.65rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 86%, transparent);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--glass-bg) 62%, transparent);
  color: var(--text-primary);
  font-size: var(--font-size-small);
}

.packing-item input {
  width: 0.95rem;
  height: 0.95rem;
  accent-color: var(--accent-teal);
}

.packing-item span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.packing-item.checked span {
  color: var(--text-muted);
  text-decoration: line-through;
}

.packing-item button,
.packing-add-form button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-secondary) 84%, transparent);
  color: var(--text-secondary);
}

.packing-add-form {
  display: flex;
  grid-column: 1 / -1;
  gap: 0.65rem;
}

.packing-add-form input {
  min-width: 0;
  flex: 1;
  border: 1px solid var(--input-border);
  border-radius: var(--radius-xl);
  background: var(--bg-secondary);
  color: var(--text-primary);
  padding: 0.65rem 0.85rem;
  outline: none;
}

.packing-add-form input:focus {
  border-color: var(--accent-teal);
  box-shadow: var(--shadow-glow-teal);
}

.fuel-input-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
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
  width: 100%;
  justify-content: center;
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
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    background var(--transition-fast),
    opacity var(--transition-fast);
}

.interest-chip.active {
  border-color: color-mix(in srgb, var(--interest-fg, var(--accent-teal)) 52%, var(--glass-border));
  background: color-mix(in srgb, var(--interest-bg, var(--accent-teal)) 32%, var(--bg-secondary));
  color: var(--text-primary);
  box-shadow: none;
}

.interest-chip.active :deep(.scope-icon) {
  color: color-mix(in srgb, var(--interest-fg, var(--accent-teal)) 88%, white);
}

.interest-chip:hover:not(.active),
.interest-chip:focus-visible:not(.active) {
  border-color: color-mix(in srgb, var(--interest-fg, var(--text-secondary)) 42%, var(--glass-border));
  background: color-mix(in srgb, var(--interest-bg, var(--bg-secondary)) 24%, var(--bg-secondary));
  color: var(--text-primary);
  box-shadow: none;
}

.trip-planner[data-planner-mode='desktop'] .submit-button {
  min-width: min(100%, 18rem);
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
  .chip-grid,
  .planner-sidebar-tools,
  .weather-snapshot-grid,
  .packing-list,
  .fuel-input-grid {
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
