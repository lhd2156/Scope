<template>
  <form class="spot-form" :data-category="form.category" data-test="spot-form" @submit.prevent="handleSubmit">
    <input
      id="spot-photo-input"
      data-test="photo-upload-input"
      class="sr-only"
      type="file"
      multiple
      :accept="SPOT_PHOTO_ACCEPT"
      :disabled="isPhotoLimitReached"
      aria-label="Spot photos"
      @change="handlePhotoSelection"
    />

    <section class="minimal-composer">
      <div v-if="serverRejection" class="server-rejection" data-test="server-rejection-panel" role="alert">
        <div class="server-rejection__icon">
          <ScopeIcon name="globe" label="Publish issue" />
        </div>
        <div>
          <p class="eyebrow">Needs a quick fix</p>
          <h3>{{ serverRejection.title }}</h3>
          <p>{{ serverRejection.message }}</p>
          <p class="server-rejection__action">{{ serverRejection.action }}</p>
          <div v-if="serverRejectionLabels.length" class="server-rejection__fields">
            <span v-for="label in serverRejectionLabels" :key="label">{{ label }}</span>
          </div>
        </div>
      </div>

      <div class="composer-grid">
        <div class="composer-column composer-column--left">
          <section class="composer-section composer-section--media" :class="{ 'has-server-error': isServerFieldHighlighted('photos') }">
            <header class="section-bar">
              <div class="section-bar__title">
                <h3>Photos</h3>
                <span class="composer-bar__meta">{{ totalPhotoCount }}/{{ MAX_SPOT_PHOTOS }} photos</span>
              </div>
              <label
                class="upload-button"
                :class="{ 'is-disabled': isPhotoLimitReached }"
                :aria-disabled="String(isPhotoLimitReached)"
                for="spot-photo-input"
              >
                <ScopeIcon name="camera" label="Upload photos" />
                <span>{{ isPhotoLimitReached ? 'Full' : 'Add photos' }}</span>
              </label>
            </header>

            <label
              class="hero-dropzone"
              :class="{ 'has-photo': coverPreviewUrl, 'has-server-error': isServerFieldHighlighted('photos'), 'is-disabled': isPhotoLimitReached }"
              :aria-disabled="String(isPhotoLimitReached)"
              for="spot-photo-input"
            >
              <img v-if="coverPreviewUrl" :src="coverPreviewUrl" alt="" />
              <div v-else class="hero-dropzone__empty">
                <ScopeIcon name="image" label="Cover photo" />
                <strong>Drop your hero photo</strong>
                <small>JPEG, PNG, or WebP. Up to {{ MAX_SPOT_PHOTOS }} photos.</small>
              </div>
            </label>

            <p v-if="errors.photos" class="field-error photos-error">{{ errors.photos }}</p>

            <div v-if="photoPreviewItems.length || !isPhotoLimitReached" class="photo-strip" aria-label="Spot photo order">
              <article
                v-for="(photo, index) in photoPreviewItems"
                :key="`${photo.source}-${photo.id}`"
                class="photo-thumb"
                :class="{ 'is-header': index === 0 }"
                data-test="photo-preview-card"
              >
                <img :src="photo.url" :alt="photo.caption || 'Spot photo'" />
                <button type="button" class="photo-action danger" :aria-label="`Remove ${photo.caption || 'spot photo'}`" @click="removePhotoPreview(photo)">
                  <ScopeIcon name="close" label="Remove" />
                </button>
              </article>

              <label
                v-if="!isPhotoLimitReached"
                class="photo-thumb photo-thumb--add"
                for="spot-photo-input"
                aria-label="Add another photo"
              >
                <ScopeIcon name="plus" label="Add another photo" />
              </label>
            </div>
          </section>

          <section class="composer-section composer-section--vibe" :class="{ 'has-server-error': isServerFieldHighlighted('pillars') || isServerFieldHighlighted('vibe') }">
            <header class="section-bar">
              <div class="section-bar__title">
                <h3>Category &amp; vibe</h3>
                <span class="composer-bar__meta">{{ form.pillars.length }}/4 pillars</span>
              </div>
            </header>

            <div class="field-grid">
              <label class="field">
                <span>Category</span>
                <div class="native-control native-control--select">
                  <select v-model="form.category" name="category" aria-label="Spot category" @change="handleCategorySelect">
                    <option v-for="category in categories" :key="category" :value="category">
                      {{ formatCategory(category) }}
                    </option>
                  </select>
                  <ScopeIcon name="chevron-down" label="" />
                </div>
              </label>

              <label class="field" :class="{ 'has-server-error': isServerFieldHighlighted('vibe') }">
                <span>Optional vibe</span>
                <input
                  v-model="form.vibe"
                  name="vibe"
                  type="text"
                  maxlength="48"
                  placeholder="electric, calm, curated"
                  :aria-invalid="Boolean(errors.vibe) || isServerFieldHighlighted('vibe')"
                />
                <small v-if="errors.vibe" class="field-error">{{ errors.vibe }}</small>
              </label>
            </div>

            <div class="field field-full" :class="{ 'has-server-error': isServerFieldHighlighted('pillars') }">
              <span class="field-label">Vibe pillars</span>
              <div class="pillar-grid" data-test="pillar-options">
                <button
                  v-for="pillar in ALLOWED_SPOT_PILLARS"
                  :key="pillar"
                  type="button"
                  class="pillar-chip"
                  :class="{ 'is-selected': form.pillars.includes(pillar) }"
                  :aria-pressed="form.pillars.includes(pillar)"
                  @click="togglePillar(pillar)"
                >
                  {{ formatPillar(pillar) }}
                </button>
              </div>
              <small v-if="errors.pillars" class="field-error">{{ errors.pillars }}</small>
            </div>
          </section>

          <section class="composer-section composer-section--extras composer-section--details">
            <header class="section-bar">
              <h3>Extras</h3>
            </header>
            <div class="field-grid field-grid--review">
              <label class="field">
                <span>Rating</span>
                <input v-model.number="form.rating" name="rating" type="number" min="0" max="5" step="0.1" />
                <small v-if="errors.rating" class="field-error">{{ errors.rating }}</small>
              </label>

              <label class="field">
                <span>Visited at</span>
                <div class="native-control native-control--date">
                  <input v-model="form.visitedAt" name="visitedAt" type="date" :aria-invalid="Boolean(errors.visitedAt)" />
                  <ScopeIcon name="calendar" label="" />
                </div>
                <small v-if="errors.visitedAt" class="field-error">{{ errors.visitedAt }}</small>
              </label>
            </div>
          </section>
        </div>

        <div class="composer-column composer-column--right">
          <header class="composer-bar">
            <div class="composer-bar__title">
              <h2>{{ mode === 'edit' ? 'Edit spot' : 'New spot' }}</h2>
              <span v-if="totalPhotoCount" class="composer-bar__meta">{{ totalPhotoCount }} photo{{ totalPhotoCount === 1 ? '' : 's' }}</span>
            </div>

            <div class="composer-bar__actions">
              <div class="visibility-control" data-test="visibility-control" aria-label="Spot visibility">
                <button
                  type="button"
                  class="visibility-option"
                  :class="{ 'is-selected': form.isPublic }"
                  aria-label="Public"
                  :aria-pressed="String(form.isPublic)"
                  @click="setVisibility(true)"
                >
                  <ScopeIcon name="globe" />
                  <span>Public</span>
                </button>
                <button
                  type="button"
                  class="visibility-option"
                  :class="{ 'is-selected': !form.isPublic }"
                  aria-label="Private"
                  :aria-pressed="String(!form.isPublic)"
                  @click="setVisibility(false)"
                >
                  <ScopeIcon name="lock" />
                  <span>Private</span>
                </button>
              </div>

              <button class="bar-button bar-button--ghost" type="button" @click="$emit('cancel')">Cancel</button>
              <button
                class="bar-button bar-button--ghost"
                data-test="spot-save-private"
                type="button"
                :disabled="privateDraftDisabled"
                @click="void submitPrivateDraft()"
              >
                {{ submitting && !form.isPublic ? 'Saving...' : 'Save draft' }}
              </button>
              <button class="bar-button bar-button--primary" data-test="spot-submit" type="submit" :disabled="publishDisabled">
                {{ submitting ? 'Saving...' : submitLabel }}
              </button>
            </div>
          </header>

          <section class="composer-section composer-section--story" :class="{ 'has-server-error': isServerFieldHighlighted('story') }">
            <header class="section-bar">
              <h3>Story</h3>
            </header>

            <div class="story-fields">
              <label class="field field-full" :class="{ 'has-server-error': isServerFieldHighlighted('title') }">
                <span>Place</span>
                <input
                  v-model="form.title"
                  name="title"
                  type="text"
                  maxlength="120"
                  placeholder="Sunset Rooftop Tacos, Costco, mural wall"
                  :aria-invalid="Boolean(errors.title) || isServerFieldHighlighted('title')"
                  @input="handleManualPlaceInput"
                  @blur="void resolveTypedPlaceLocation()"
                />
                <small v-if="errors.title" class="field-error">{{ errors.title }}</small>
              </label>

              <label class="field field-full" :class="{ 'has-server-error': isServerFieldHighlighted('description') }">
                <span>Description</span>
                <textarea
                  v-model="form.description"
                  name="description"
                  rows="3"
                  maxlength="2000"
                  placeholder="What makes it worth saving? Add the order, best time, or the tiny detail people should not miss."
                  :aria-invalid="Boolean(errors.description) || isServerFieldHighlighted('description')"
                />
                <small v-if="errors.description" class="field-error">{{ errors.description }}</small>
              </label>
            </div>
          </section>

          <section class="composer-section composer-section--location" :class="{ 'has-server-error': isServerFieldHighlighted('location') }">
            <header class="section-bar">
              <h3>Location</h3>
            </header>

            <label class="field field-full">
              <span>Address</span>
              <div class="place-control">
                <input
                  v-model="form.address"
                  name="address"
                  type="text"
                  maxlength="160"
                  placeholder="Search a place or paste an address"
                  :aria-invalid="Boolean(errors.address) || isServerFieldHighlighted('location')"
                  @input="handleManualPlaceInput"
                  @blur="void resolveTypedPlaceLocation()"
                />
              </div>
              <small v-if="errors.address" class="field-error">{{ errors.address }}</small>
            </label>

            <div class="location-workspace">
              <div class="pin-picker">
                <MapView
                  class="pin-picker__view"
                  data-test="spot-map-picker"
                  :spots="pinMapPoints"
                  :route-points="pinMapPoints"
                  :initial-viewport="pinMapViewport"
                  :show-location-tracker="false"
                  :show-summary="false"
                  :show-controls="false"
                  :show-fit-route-control="false"
                  :show-place-labels="true"
                  label-mode="full"
                  :click-to-select="true"
                  :persist-map-preferences="false"
                  :show-map-style-toggle="false"
                  :show-projection-toggle="false"
                  :show-traffic="false"
                  :show-weather-badge="false"
                  :show-nearby-places="false"
                  :auto-locate-on-load="false"
                  :auto-fit-route-on-load="true"
                  :single-route-point-zoom="13.35"
                  :plain-pin-marker="true"
                  map-presentation="scope"
                  @map-click="handlePinMapClick"
                />
              </div>

              <div class="location-details field-grid">
                <label class="field field--city">
                  <span>City</span>
                  <input
                    v-model="form.city"
                    name="city"
                    type="text"
                    maxlength="160"
                    placeholder="City name"
                    :aria-invalid="Boolean(errors.city) || isServerFieldHighlighted('location')"
                    @input="handleManualPlaceInput"
                  />
                  <small v-if="errors.city" class="field-error">{{ errors.city }}</small>
                </label>

                <label class="field field--country">
                  <span>Country</span>
                  <input
                    v-model="form.country"
                    name="country"
                    type="text"
                    maxlength="160"
                    placeholder="US"
                    :aria-invalid="Boolean(errors.country) || isServerFieldHighlighted('location')"
                    @input="handleManualPlaceInput"
                  />
                  <small v-if="errors.country" class="field-error">{{ errors.country }}</small>
                </label>

                <label class="field field--postal">
                  <span>ZIP code</span>
                  <input
                    v-model="form.postalCode"
                    name="postalCode"
                    type="text"
                    maxlength="32"
                    placeholder="76102"
                    :aria-invalid="Boolean(errors.postalCode) || isServerFieldHighlighted('location')"
                    @input="handleManualPlaceInput"
                  />
                  <small v-if="errors.postalCode" class="field-error">{{ errors.postalCode }}</small>
                </label>

                <label class="field field--coordinate">
                  <span>Latitude</span>
                  <input v-model.number="form.latitude" name="latitude" type="number" step="0.000001" @input="handleManualCoordinateInput" />
                  <small v-if="errors.latitude" class="field-error">{{ errors.latitude }}</small>
                </label>

                <label class="field field--coordinate">
                  <span>Longitude</span>
                  <input v-model.number="form.longitude" name="longitude" type="number" step="0.000001" @input="handleManualCoordinateInput" />
                  <small v-if="errors.longitude" class="field-error">{{ errors.longitude }}</small>
                </label>
              </div>
            </div>

            <p v-if="errors.locationVerification" class="field-error verification-error">
              {{ errors.locationVerification }}
            </p>
          </section>

          <small v-if="errors.safety" class="field-error safety-error">{{ errors.safety }}</small>
        </div>
      </div>
    </section>
  </form>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import MapView from '@/components/map/MapView.vue';
import { DEFAULT_MAP_STYLE } from '@/services/mapboxLoader';
import { reverseGeocode, searchLocations, searchNearbyPlaces, type GeocodeResult, type NearbyPlaceResult } from '@/services/mapService';
import type { MapPoint, MapViewport, Photo, SpotCategory, SpotComposerRejection, SpotFormInput, SpotFormSubmission, SpotPhotoUpload, SpotPillar } from '@/types';
import { validateContentSafety } from '@/utils/contentSafety';
import { inferSpotCategoryFromSignals } from '@/utils/spotCategoryInference';
import { ALLOWED_SPOT_PILLARS, SPOT_PHOTO_ACCEPT, validateSpotFormInput, validateSpotPhotoFile, type SpotFormErrors } from '@/utils/validators';

interface PhotoPreviewItem {
  id: string;
  url: string;
  caption: string;
  source: 'existing' | 'upload';
}

const props = withDefaults(
  defineProps<{
    mode?: 'create' | 'edit';
    initialValue?: Partial<SpotFormInput> | null;
    initialPhotos?: Photo[];
    serverRejection?: SpotComposerRejection | null;
    submitting?: boolean;
  }>(),
  {
    mode: 'create',
    initialValue: null,
    initialPhotos: () => [],
    serverRejection: null,
    submitting: false,
  },
);

const emit = defineEmits<{
  (event: 'submit', payload: SpotFormSubmission): void;
  (event: 'cancel'): void;
  (event: 'server-rejection-cleared'): void;
}>();

const DEFAULT_CENTER: [number, number] = [0, 0];
const DEFAULT_PIN_VIEWPORT: MapViewport = {
  center: [-98.5795, 39.8283],
  zoom: 3.25,
  style: DEFAULT_MAP_STYLE,
};
const MAX_SPOT_PHOTOS = 10;
const categories: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'entertainment', 'scenic', 'other'];
const PIN_PLACE_SNAP_MAX_DISTANCE_KM = 0.08;
const PIN_NEARBY_PLACE_CATEGORIES = [
  'restaurant',
  'food_and_drink',
  'cafe',
  'coffee',
  'bar',
  'grocery',
  'supermarket',
  'shopping',
  'amusement_park',
  'bowling_alley',
  'movie_theater',
  'tourist_attraction',
  'museum',
  'park',
  'hotel',
  'gas_station',
  'car_wash',
  'pharmacy',
  'bank',
  'parking',
  'hospital',
  'school',
] as const;
const PILLAR_LABELS: Record<SpotPillar, string> = {
  'hidden-gem': 'Hidden gem',
  'photo-worthy': 'Photo-worthy',
  'date-night': 'Date night',
  'group-friendly': 'Group-friendly',
  'solo-friendly': 'Solo-friendly',
  'family-friendly': 'Family-friendly',
  'budget-friendly': 'Budget-friendly',
  'worth-the-drive': 'Worth the drive',
  'quick-stop': 'Quick stop',
  calm: 'Calm',
  lively: 'Lively',
  'luxury-feel': 'Luxury feel',
};
const SERVER_FIELD_ALIASES: Record<string, string[]> = {
  story: ['story', 'title', 'description', 'vibe', 'pillars', 'content', 'safety'],
  title: ['title', 'story', 'content', 'safety'],
  description: ['description', 'story', 'content', 'safety'],
  vibe: ['vibe', 'story', 'content', 'safety'],
  pillars: ['pillars', 'story', 'content', 'safety'],
  photos: ['photos', 'photo', 'file', 'captions'],
  location: ['location', 'locationVerification', 'address', 'city', 'country', 'postalCode', 'postal_code', 'latitude', 'longitude', 'verification', 'providerPlaceId'],
  visibility: ['visibility', 'isPublic', 'is_public'],
  publish: ['publish', 'non_field_errors'],
};
const SERVER_FIELD_LABELS: Record<string, string> = {
  story: 'Story',
  title: 'Place',
  description: 'Description',
  vibe: 'Vibe',
  pillars: 'Vibe pillars',
  photos: 'Photos',
  location: 'Place',
  visibility: 'Visibility',
  safety: 'Copy safety',
  publish: 'Publish settings',
};

const errors = ref<SpotFormErrors>({});
const existingPhotos = ref<Photo[]>([]);
const uploads = ref<SpotPhotoUpload[]>([]);
const hasUserPinnedLocation = ref(false);
const hasUserSelectedCategory = ref(false);
const pinLookupRequestId = ref(0);
const form = reactive<SpotFormInput>(createDefaultForm(props.initialValue));
const lastAppliedInitialForm = ref<SpotFormInput>(cloneSpotFormValue(form));
const typedPlaceLookupRequestId = ref(0);
const placeVerification = reactive<{
  status: 'idle' | 'checking' | 'verified' | 'failed';
  reason: string;
  source: string;
  providerPlaceName: string;
  providerPlaceAddress: string;
  distanceMeters: number | null;
  signature: string;
}>({
  status: props.initialValue?.verificationStatus === 'verified' ? 'verified' : 'idle',
  reason: '',
  source: props.initialValue?.verificationSource ?? '',
  providerPlaceName: props.initialValue?.providerPlaceName ?? '',
  providerPlaceAddress: props.initialValue?.providerPlaceAddress ?? '',
  distanceMeters: props.initialValue?.verificationDistanceMeters ?? null,
  signature: '',
});

function todayValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function createDefaultForm(initialValue: Partial<SpotFormInput> | null | undefined): SpotFormInput {
  return {
    title: initialValue?.title ?? '',
    description: initialValue?.description ?? '',
    latitude: initialValue?.latitude ?? DEFAULT_CENTER[1],
    longitude: initialValue?.longitude ?? DEFAULT_CENTER[0],
    address: initialValue?.address ?? '',
    city: initialValue?.city ?? '',
    country: initialValue?.country ?? '',
    postalCode: initialValue?.postalCode ?? '',
    category: initialValue?.category ?? 'food',
    pillars: initialValue?.pillars?.length ? [...initialValue.pillars] : ['hidden-gem'],
    vibe: initialValue?.vibe ?? '',
    rating: typeof initialValue?.rating === 'number' ? initialValue.rating : 4.5,
    visitedAt: initialValue?.visitedAt ?? todayValue(),
    isPublic: initialValue?.isPublic ?? true,
    providerPlaceId: initialValue?.providerPlaceId ?? '',
    providerPlaceName: initialValue?.providerPlaceName ?? '',
    providerPlaceAddress: initialValue?.providerPlaceAddress ?? '',
    verificationStatus: initialValue?.verificationStatus ?? 'unverified',
    verificationSource: initialValue?.verificationSource ?? '',
    verificationDistanceMeters: initialValue?.verificationDistanceMeters ?? null,
    verifiedAt: initialValue?.verifiedAt ?? null,
  };
}

function cloneSpotFormValue(value: SpotFormInput): SpotFormInput {
  return {
    ...value,
    pillars: [...value.pillars],
  };
}

function hasSamePillars(left: SpotPillar[], right: SpotPillar[]): boolean {
  return [...left].sort().join('|') === [...right].sort().join('|');
}

function hasSameSpotFormValue(left: SpotFormInput, right: SpotFormInput): boolean {
  return left.title === right.title &&
    left.description === right.description &&
    Number(left.latitude) === Number(right.latitude) &&
    Number(left.longitude) === Number(right.longitude) &&
    left.address === right.address &&
    left.city === right.city &&
    left.country === right.country &&
    left.postalCode === right.postalCode &&
    left.category === right.category &&
    hasSamePillars(left.pillars, right.pillars) &&
    left.vibe === right.vibe &&
    Number(left.rating) === Number(right.rating) &&
    left.visitedAt === right.visitedAt &&
    left.isPublic === right.isPublic &&
    left.providerPlaceId === right.providerPlaceId &&
    left.providerPlaceName === right.providerPlaceName &&
    left.providerPlaceAddress === right.providerPlaceAddress &&
    left.verificationStatus === right.verificationStatus &&
    left.verificationSource === right.verificationSource &&
    Number(left.verificationDistanceMeters ?? -1) === Number(right.verificationDistanceMeters ?? -1) &&
    left.verifiedAt === right.verifiedAt;
}

function mergeIncomingInitialValueIntoUntouchedFields(previousInitial: SpotFormInput, nextInitial: SpotFormInput): void {
  const mutableForm = form as unknown as Record<string, unknown>;
  const scalarKeys = [
    'title',
    'description',
    'latitude',
    'longitude',
    'address',
    'city',
    'country',
    'postalCode',
    'category',
    'vibe',
    'rating',
    'visitedAt',
    'isPublic',
    'providerPlaceId',
    'providerPlaceName',
    'providerPlaceAddress',
    'verificationStatus',
    'verificationSource',
    'verificationDistanceMeters',
    'verifiedAt',
  ] as const;

  for (const key of scalarKeys) {
    if (form[key] === previousInitial[key]) {
      mutableForm[key] = nextInitial[key];
    }
  }

  if (hasSamePillars(form.pillars, previousInitial.pillars)) {
    form.pillars = [...nextInitial.pillars];
  }
}

function clonePhotos(photos: Photo[]): Photo[] {
  return photos.map((photo) => ({ ...photo }));
}

function formatCategory(category: SpotCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function formatPillar(pillar: SpotPillar): string {
  return PILLAR_LABELS[pillar] ?? pillar;
}

function clearError(field: keyof SpotFormErrors): void {
  if (!errors.value[field]) {
    return;
  }

  const nextErrors = { ...errors.value };
  delete nextErrors[field];
  errors.value = nextErrors;
}

function isServerFieldHighlighted(field: string): boolean {
  const serverFields = props.serverRejection?.fields ?? [];
  if (!serverFields.length) {
    return false;
  }

  const aliases = SERVER_FIELD_ALIASES[field] ?? [field];
  return aliases.some((alias) => serverFields.includes(alias));
}

function clearServerRejectionFor(fields: string[]): void {
  if (!props.serverRejection) {
    return;
  }

  if (fields.some((field) => isServerFieldHighlighted(field) || props.serverRejection?.fields.includes(field))) {
    emit('server-rejection-cleared');
  }
}

function setVisibility(isPublic: boolean): void {
  if (form.isPublic === isPublic) {
    return;
  }

  form.isPublic = isPublic;
  clearError('locationVerification');
  clearServerRejectionFor(['visibility', 'publish', 'location', 'photos']);
}

function normalizeForm(): SpotFormInput {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    latitude: Number(form.latitude),
    longitude: Number(form.longitude),
    address: form.address.trim(),
    city: form.city.trim(),
    country: form.country.trim().toUpperCase(),
    postalCode: form.postalCode?.trim(),
    category: form.category,
    pillars: [...form.pillars],
    vibe: form.vibe.trim(),
    rating: Number(form.rating),
    visitedAt: form.visitedAt,
    isPublic: form.isPublic,
    providerPlaceId: form.providerPlaceId,
    providerPlaceName: form.providerPlaceName,
    providerPlaceAddress: form.providerPlaceAddress,
    verificationStatus: isLocationVerified.value ? 'verified' : 'unverified',
    verificationSource: placeVerification.source,
    verificationDistanceMeters: placeVerification.distanceMeters,
    verifiedAt: form.verifiedAt,
  };
}

function revokeUploadPreviews(): void {
  if (typeof URL.revokeObjectURL !== 'function') {
    return;
  }

  uploads.value.forEach((upload) => {
    URL.revokeObjectURL(upload.previewUrl);
  });
}

function resetFromProps(nextInitialValue: Partial<SpotFormInput> | null | undefined = props.initialValue): void {
  const nextForm = createDefaultForm(nextInitialValue);
  Object.assign(form, nextForm);
  lastAppliedInitialForm.value = cloneSpotFormValue(nextForm);
  typedPlaceLookupRequestId.value += 1;
  hasUserPinnedLocation.value = props.mode === 'edit' && Number.isFinite(Number(form.latitude)) && Number.isFinite(Number(form.longitude));
  hasUserSelectedCategory.value = props.mode === 'edit';
  maybeAutofillCategory([form.title, form.address, form.city]);
  existingPhotos.value = clonePhotos(props.initialPhotos);
  revokeUploadPreviews();
  uploads.value = [];
  errors.value = {};
  resetVerificationFromForm();
}

function buildVerificationSignature(): string {
  return [
    form.title.trim().toLowerCase(),
    form.address.trim().toLowerCase(),
    form.city.trim().toLowerCase(),
    form.country.trim().toLowerCase(),
    (form.postalCode ?? '').trim().toLowerCase(),
    Number(form.latitude).toFixed(6),
    Number(form.longitude).toFixed(6),
  ].join('|');
}

function resetVerificationFromForm(): void {
  const verified = form.verificationStatus === 'verified';
  placeVerification.status = verified ? 'verified' : 'idle';
  placeVerification.reason = '';
  placeVerification.source = form.verificationSource ?? '';
  placeVerification.providerPlaceName = form.providerPlaceName ?? '';
  placeVerification.providerPlaceAddress = form.providerPlaceAddress ?? '';
  placeVerification.distanceMeters = form.verificationDistanceMeters ?? null;
  placeVerification.signature = verified ? buildVerificationSignature() : '';
}

function markVerificationStale(): void {
  if (placeVerification.status !== 'verified') {
    return;
  }
  if (placeVerification.signature === buildVerificationSignature()) {
    return;
  }
  placeVerification.status = 'idle';
  placeVerification.reason = '';
  form.verificationStatus = 'unverified';
  form.verifiedAt = null;
}

function clearProviderPlaceDetails(): void {
  form.providerPlaceId = '';
  form.providerPlaceName = '';
  form.providerPlaceAddress = '';
  placeVerification.providerPlaceName = '';
  placeVerification.providerPlaceAddress = '';
  placeVerification.source = '';
  placeVerification.distanceMeters = null;
}

function handleManualPlaceInput(): void {
  typedPlaceLookupRequestId.value += 1;
  clearProviderPlaceDetails();
  markVerificationStale();
}

function handleManualCoordinateInput(): void {
  typedPlaceLookupRequestId.value += 1;
  hasUserPinnedLocation.value = true;
  clearProviderPlaceDetails();
  markVerificationStale();
  clearError('latitude');
  clearError('longitude');
  clearError('locationVerification');
  clearServerRejectionFor(['location']);
}

function setCoordinates(latitude: number, longitude: number): void {
  form.latitude = Number(latitude.toFixed(6));
  form.longitude = Number(longitude.toFixed(6));
  hasUserPinnedLocation.value = true;
  clearError('latitude');
  clearError('longitude');
  clearError('locationVerification');
  clearServerRejectionFor(['location']);

}

function isPreciseGeocodeResult(result: GeocodeResult): boolean {
  return result.precision !== 'coordinate' && result.precision !== 'fallback';
}

function readCategorySignals(result: GeocodeResult | NearbyPlaceResult): string[] {
  const categoryAware = result as GeocodeResult & {
    category?: string;
    categoryId?: string;
    categoryLabel?: string;
  };

  return [
    categoryAware.category,
    categoryAware.categoryId,
    categoryAware.categoryLabel,
    result.placeName,
    result.formattedAddress,
    result.address,
    form.title,
    form.address,
  ].filter(Boolean) as string[];
}

function maybeAutofillCategory(signals: Array<string | null | undefined>): void {
  if (hasUserSelectedCategory.value) {
    return;
  }

  const inferredCategory = inferSpotCategoryFromSignals(signals);
  if (!inferredCategory) {
    return;
  }

  form.category = inferredCategory;
  clearServerRejectionFor(['story', 'location']);
}

function applyGeocodeResultToForm(result: GeocodeResult | NearbyPlaceResult, options: { overwriteTitle?: boolean; updateCoordinates?: boolean } = {}): void {
  if (!isPreciseGeocodeResult(result)) {
    return;
  }

  const nextPlaceName = result.placeName && result.placeName !== 'Pinned location' ? result.placeName : '';
  if (nextPlaceName && (options.overwriteTitle || !form.title.trim())) {
    form.title = nextPlaceName;
  }
  if (options.updateCoordinates) {
    form.latitude = Number(result.latitude.toFixed(6));
    form.longitude = Number(result.longitude.toFixed(6));
  }
  form.address = result.address || result.formattedAddress || result.placeName || form.address;
  form.providerPlaceName = nextPlaceName || form.providerPlaceName;
  form.providerPlaceAddress = result.formattedAddress || result.address || form.providerPlaceAddress;
  form.providerPlaceId = result.providerPlaceId || form.providerPlaceId;
  if (result.city) {
    form.city = result.city;
  }
  if (result.countryCode || result.country) {
    form.country = (result.countryCode || result.country || '').toUpperCase();
  }
  if (result.postalCode) {
    form.postalCode = result.postalCode;
  }
  maybeAutofillCategory(readCategorySignals(result));
  clearServerRejectionFor(['location', 'title']);
}

function getNearestPinnedPlace(places: NearbyPlaceResult[]): NearbyPlaceResult | null {
  return places.find((place) => (
    place.precision !== 'fallback' &&
    place.precision !== 'coordinate' &&
    typeof place.distanceKm === 'number' &&
    place.distanceKm <= PIN_PLACE_SNAP_MAX_DISTANCE_KM
  )) ?? null;
}

async function resolveNearestPinnedPlace(latitude: number, longitude: number): Promise<NearbyPlaceResult | null> {
  const response = await searchNearbyPlaces({
    center: { latitude, longitude },
    categories: PIN_NEARBY_PLACE_CATEGORIES,
    limit: 18,
  }).catch(() => ({ data: [] as NearbyPlaceResult[] }));

  return getNearestPinnedPlace(response.data);
}

async function autofillLocationFromPin(latitude: number, longitude: number, requestId: number): Promise<void> {
  try {
    const [reverseResult, nearestPlace] = await Promise.all([
      reverseGeocode(latitude, longitude).catch(() => null),
      resolveNearestPinnedPlace(latitude, longitude).catch(() => null),
    ]);

    if (requestId !== pinLookupRequestId.value) {
      return;
    }

    if (nearestPlace) {
      applyGeocodeResultToForm(nearestPlace, { overwriteTitle: true, updateCoordinates: true });
      return;
    }

    if (reverseResult) {
      applyGeocodeResultToForm(reverseResult, { overwriteTitle: reverseResult.precision === 'poi' });
    }
  } catch {
    // The backend verifies the final publish payload; map autofill is best-effort.
  }
}

function buildTypedPlaceLookupSignature(): string {
  return [
    form.title,
    form.address,
    form.city,
    form.country,
    form.postalCode,
  ].map((part) => part?.trim()).filter(Boolean).join('|');
}

async function resolveTypedPlaceLocation(): Promise<void> {
  const query = [
    form.title,
    form.address,
    form.city,
    form.country,
    form.postalCode,
  ].map((part) => part?.trim()).filter(Boolean).join(' ');
  if (!query) {
    return;
  }

  const requestId = typedPlaceLookupRequestId.value + 1;
  typedPlaceLookupRequestId.value = requestId;
  const lookupSignature = buildTypedPlaceLookupSignature();
  const response = await searchLocations(query, { limit: 1, preferPoi: true }).catch(() => ({ data: [] }));
  if (requestId !== typedPlaceLookupRequestId.value || lookupSignature !== buildTypedPlaceLookupSignature()) {
    return;
  }

  const result = response.data[0];
  if (!result) {
    return;
  }

  setCoordinates(result.latitude, result.longitude);
  applyGeocodeResultToForm(result, { overwriteTitle: !form.title.trim() });
  clearError('address');
  clearError('city');
  clearError('country');
  clearError('postalCode');
}

async function resolveClickedLocation(latitude: number, longitude: number, requestId: number): Promise<void> {
  await autofillLocationFromPin(latitude, longitude, requestId);
}

function handlePinMapClick(payload: { latitude: number; longitude: number }): void {
  typedPlaceLookupRequestId.value += 1;
  const requestId = pinLookupRequestId.value + 1;
  pinLookupRequestId.value = requestId;
  setCoordinates(payload.latitude, payload.longitude);
  void resolveClickedLocation(payload.latitude, payload.longitude, requestId);
}

function handleCategorySelect(): void {
  hasUserSelectedCategory.value = true;
  clearServerRejectionFor(['story', 'location']);
}

function togglePillar(pillar: SpotPillar): void {
  if (form.pillars.includes(pillar)) {
    form.pillars = form.pillars.filter((entry) => entry !== pillar);
    clearError('pillars');
    clearServerRejectionFor(['pillars', 'story']);
    return;
  }

  if (form.pillars.length >= 4) {
    errors.value = {
      ...errors.value,
      pillars: 'Choose up to 4 vibe pillars.',
    };
    return;
  }

  form.pillars = [...form.pillars, pillar];
  clearError('pillars');
  clearServerRejectionFor(['pillars', 'story']);
}

function removeExistingPhoto(photoId: string): void {
  existingPhotos.value = existingPhotos.value.filter((photo) => photo.id !== photoId);
  clearError('photos');
  clearServerRejectionFor(['photos']);
}

function removePhotoPreview(photo: PhotoPreviewItem): void {
  if (photo.source === 'existing') {
    removeExistingPhoto(photo.id);
    return;
  }

  removeUpload(photo.id);
}

function removeUpload(uploadId: string): void {
  const upload = uploads.value.find((entry) => entry.id === uploadId);
  if (upload && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(upload.previewUrl);
  }

  uploads.value = uploads.value.filter((entry) => entry.id !== uploadId);
  clearError('photos');
  clearServerRejectionFor(['photos']);
}

function handlePhotoSelection(event: Event): void {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);

  if (!files.length) {
    return;
  }

  const nextUploads: SpotPhotoUpload[] = [];
  const photoErrors: string[] = [];
  let remainingSlots = Math.max(0, MAX_SPOT_PHOTOS - totalPhotoCount.value);
  let overflowCount = 0;
  let acceptedIndex = 0;

  files.forEach((file) => {
    if (remainingSlots <= 0) {
      overflowCount += 1;
      return;
    }

    const validationError = validateSpotPhotoFile(file);
    if (validationError) {
      photoErrors.push(`${file.name}: ${validationError}`);
      return;
    }

    nextUploads.push({
      id: `${Date.now()}-${acceptedIndex}-${file.name}`,
      file,
      previewUrl: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '',
      caption: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
      mimeType: file.type,
      sizeBytes: file.size,
    });
    acceptedIndex += 1;
    remainingSlots -= 1;
  });

  uploads.value = [...uploads.value, ...nextUploads];
  clearServerRejectionFor(['photos']);

  if (overflowCount > 0) {
    photoErrors.push(`You can add up to ${MAX_SPOT_PHOTOS} photos. Remove one before adding more.`);
  }

  if (photoErrors.length) {
    errors.value = {
      ...errors.value,
      photos: photoErrors.join(' '),
    };
  } else {
    clearError('photos');
  }

  input.value = '';
}

async function handleSubmit(): Promise<void> {
  if (!form.providerPlaceId && !hasUserPinnedLocation.value) {
    await resolveTypedPlaceLocation();
  }

  const normalizedForm = normalizeForm();
  const nextErrors = validateSpotFormInput(normalizedForm);
  const captions = [
    ...existingPhotos.value.map((photo) => photo.caption ?? ''),
    ...uploads.value.map((upload) => upload.caption),
  ];
  const safetyResult = validateContentSafety([
    { field: 'title', value: normalizedForm.title },
    { field: 'description', value: normalizedForm.description },
    { field: 'vibe', value: normalizedForm.vibe },
    { field: 'pillars', value: normalizedForm.pillars.map(formatPillar) },
    { field: 'captions', value: captions },
  ]);

  if (!safetyResult.clean) {
    const safetyField = ['title', 'description', 'vibe', 'pillars'].includes(safetyResult.field ?? '')
      ? safetyResult.field as keyof SpotFormErrors
      : 'safety';
    nextErrors[safetyField] = safetyResult.message ?? 'This contains a blocked slur or hate term.';
  }

  if (normalizedForm.isPublic && !existingPhotos.value.length && !uploads.value.length) {
    nextErrors.photos = 'Upload at least one photo so the pin can render with a hero image.';
  }

  if (normalizedForm.isPublic && !hasPinnedCoordinates.value && !form.providerPlaceId) {
    nextErrors.locationVerification = 'Choose the place on the map before publishing.';
  }

  errors.value = nextErrors;

  if (Object.keys(nextErrors).length) {
    return;
  }

  emit('submit', {
    spot: normalizedForm,
    existingPhotos: existingPhotos.value.map((photo) => ({
      ...photo,
      caption: photo.caption?.trim() ?? '',
    })),
    newPhotos: uploads.value.map((upload) => ({
      ...upload,
      caption: upload.caption.trim(),
    })),
  });
}

async function submitPrivateDraft(): Promise<void> {
  if (privateDraftDisabled.value) {
    return;
  }

  setVisibility(false);
  await handleSubmit();
}

const totalPhotoCount = computed(() => existingPhotos.value.length + uploads.value.length);
const isPhotoLimitReached = computed(() => totalPhotoCount.value >= MAX_SPOT_PHOTOS);
const coverPreviewUrl = computed(() => existingPhotos.value[0]?.url || uploads.value[0]?.previewUrl || '');
const photoPreviewItems = computed<PhotoPreviewItem[]>(() => [
  ...existingPhotos.value.map((photo) => ({
    id: photo.id,
    url: photo.url,
    caption: photo.caption?.trim() ?? '',
    source: 'existing' as const,
  })),
  ...uploads.value.map((upload) => ({
    id: upload.id,
    url: upload.previewUrl,
    caption: upload.caption.trim(),
    source: 'upload' as const,
  })),
]);
const heading = computed(() => (props.mode === 'edit' ? 'Refine spot' : 'Create spot'));
const previewTitle = computed(() => form.title.trim() || 'Name the spot');
const previewSubtitle = computed(() => {
  const location = [form.city.trim(), form.country.trim()].filter(Boolean).join(', ');
  if (location) {
    return location;
  }
  if (form.address.trim()) {
    return form.address.trim();
  }
  return 'Drop a precise pin';
});
const submitLabel = computed(() => {
  if (props.mode === 'edit') {
    return form.isPublic ? 'Save changes' : 'Save private draft';
  }

  return form.isPublic ? 'Publish spot' : 'Save private draft';
});
const isLocationVerified = computed(() => placeVerification.status === 'verified' && placeVerification.signature === buildVerificationSignature());
function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

const hasPinnedCoordinates = computed(() => (
  isValidLatitude(Number(form.latitude)) &&
  isValidLongitude(Number(form.longitude)) &&
  (Number(form.latitude) !== DEFAULT_CENTER[1] || Number(form.longitude) !== DEFAULT_CENTER[0])
));
const hasProviderPlaceDetails = computed(() => Boolean(
  form.providerPlaceId?.trim() ||
  form.providerPlaceName?.trim() ||
  form.providerPlaceAddress?.trim(),
));
const pinMapPoints = computed<MapPoint[]>(() => {
  if (!hasPinnedCoordinates.value) {
    return [];
  }

  return [{
    id: 'spot-composer-pin',
    title: form.title.trim() || form.providerPlaceName?.trim() || form.address.trim() || 'Pinned place',
    latitude: Number(form.latitude),
    longitude: Number(form.longitude),
    category: form.category,
    city: form.city.trim() || undefined,
    vibe: form.vibe.trim() || undefined,
    rating: Number(form.rating) || undefined,
    photoUrl: coverPreviewUrl.value || undefined,
  }];
});
const pinMapViewport = computed<MapViewport>(() => (
  hasPinnedCoordinates.value
    ? {
        center: [Number(form.longitude), Number(form.latitude)],
        zoom: 13.35,
        style: DEFAULT_MAP_STYLE,
      }
    : DEFAULT_PIN_VIEWPORT
));
const publicSafetyReady = computed(() => validateContentSafety([
  { field: 'title', value: form.title },
  { field: 'description', value: form.description },
  { field: 'vibe', value: form.vibe },
  { field: 'pillars', value: form.pillars.map(formatPillar) },
  { field: 'captions', value: [...existingPhotos.value.map((photo) => photo.caption ?? ''), ...uploads.value.map((upload) => upload.caption)] },
]).clean);
const pillarSelectionReady = computed(() => form.pillars.length >= 1 && form.pillars.length <= 4);
const isReadyToPublishPublic = computed(() => (
  totalPhotoCount.value > 0 && publicSafetyReady.value && pillarSelectionReady.value
));
const publishDisabled = computed(() => (
  props.submitting ||
  !publicSafetyReady.value ||
  !pillarSelectionReady.value ||
  (form.isPublic && !isReadyToPublishPublic.value)
));
const privateDraftDisabled = computed(() => (
  props.submitting ||
  !publicSafetyReady.value ||
  !pillarSelectionReady.value
));
const activeStepId = ref<'media' | 'story' | 'vibe' | 'location' | 'details'>('media');
const composerSteps = computed(() => [
  {
    id: 'media' as const,
    label: 'Photos',
    sub: totalPhotoCount.value ? `${totalPhotoCount.value} added` : 'Lead with a hero',
    ready: totalPhotoCount.value > 0 || !form.isPublic,
  },
  {
    id: 'story' as const,
    label: 'Story',
    sub: publicSafetyReady.value ? 'Clean copy' : 'Needs a name',
    ready: publicSafetyReady.value,
  },
  {
    id: 'vibe' as const,
    label: 'Vibe',
    sub: `${form.pillars.length}/4 pillars`,
    ready: pillarSelectionReady.value,
  },
  {
    id: 'location' as const,
    label: 'Place',
    sub: hasProviderPlaceDetails.value ? 'Matched' : hasPinnedCoordinates.value ? 'Pinned' : 'Needs place',
    ready: hasPinnedCoordinates.value || hasProviderPlaceDetails.value || !form.isPublic,
  },
  {
    id: 'details' as const,
    label: 'Details',
    sub: form.rating ? `${Number(form.rating).toFixed(1)} rating` : 'Optional polish',
    ready: true,
  },
]);

function focusStep(stepId: typeof activeStepId.value): void {
  activeStepId.value = stepId;
  if (typeof document === 'undefined') return;
  const target = document.querySelector(`.composer-section--${stepId}`);
  if (target instanceof HTMLElement) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

const readinessItems = computed(() => [
  {
    key: 'photos',
    label: 'Photo',
    detail: totalPhotoCount.value ? `${totalPhotoCount.value} ready` : 'Needed for public',
    ready: totalPhotoCount.value > 0 || !form.isPublic,
    tone: 'photo',
  },
  {
    key: 'location',
    label: form.isPublic ? 'Place' : 'Private place',
    detail: hasProviderPlaceDetails.value ? 'Provider matched' : hasPinnedCoordinates.value ? 'Pin ready' : 'Needed for public',
    ready: hasPinnedCoordinates.value || hasProviderPlaceDetails.value || !form.isPublic,
    tone: 'place',
  },
  {
    key: 'safety',
    label: 'Clean copy',
    detail: publicSafetyReady.value ? 'Looks good' : 'Needs edits',
    ready: publicSafetyReady.value,
    tone: 'safety',
  },
  {
    key: 'pillars',
    label: 'Pillars',
    detail: `${form.pillars.length}/4 selected`,
    ready: pillarSelectionReady.value,
    tone: 'pillar',
  },
  {
    key: 'visibility',
    label: form.isPublic ? 'Public' : 'Private',
    detail: form.isPublic ? 'Discoverable' : 'Hidden draft',
    ready: true,
    tone: 'visibility',
  },
]);
const serverRejectionLabels = computed(() => {
  const labels = (props.serverRejection?.fields ?? []).map((field) => SERVER_FIELD_LABELS[field] ?? field.replace(/_/g, ' '));
  return [...new Set(labels)].slice(0, 4);
});

watch(
  () => props.initialValue,
  (nextValue) => {
    const previousInitial = lastAppliedInitialForm.value;
    const nextInitial = createDefaultForm(nextValue);
    const formMatchesPreviousInitial = hasSameSpotFormValue(form, previousInitial) && uploads.value.length === 0;
    const formMatchesNextInitial = hasSameSpotFormValue(form, nextInitial);

    if (formMatchesPreviousInitial || formMatchesNextInitial) {
      resetFromProps(nextValue);
      return;
    }

    lastAppliedInitialForm.value = cloneSpotFormValue(nextInitial);
    typedPlaceLookupRequestId.value += 1;
    mergeIncomingInitialValueIntoUntouchedFields(previousInitial, nextInitial);
    resetVerificationFromForm();
  },
  { immediate: true, deep: true },
);

watch(
  () => props.initialPhotos,
  () => {
    existingPhotos.value = clonePhotos(props.initialPhotos);
  },
  { immediate: true, deep: true },
);

watch(
  () => [form.latitude, form.longitude] as const,
  () => {
    markVerificationStale();
    clearServerRejectionFor(['location']);
  },
);

watch(
  () => [form.title, form.address, form.city, form.country, form.postalCode] as const,
  () => {
    markVerificationStale();
  },
);

watch(
  () => form.title,
  () => {
    maybeAutofillCategory([form.title, form.address]);
    clearServerRejectionFor(['story', 'title', 'safety']);
  },
);

watch(
  () => [form.address, form.city, form.country, form.postalCode] as const,
  () => {
    maybeAutofillCategory([form.title, form.address, form.city]);
    clearServerRejectionFor(['location']);
  },
);

watch(
  () => [form.description, form.vibe] as const,
  () => {
    clearServerRejectionFor(['story', 'description', 'vibe', 'safety']);
  },
);

watch(
  () => [
    ...existingPhotos.value.map((photo) => photo.caption ?? ''),
    ...uploads.value.map((upload) => upload.caption),
  ],
  () => {
    clearServerRejectionFor(['photos', 'safety']);
  },
);

onBeforeUnmount(() => {
  revokeUploadPreviews();
});

defineExpose({
  ...(import.meta.env.MODE === 'test'
    ? {
        __coverage: {
          activeStepId,
          composerSteps,
          focusStep,
          form,
          handleManualCoordinateInput,
          handleManualPlaceInput,
          heading,
          previewSubtitle,
          previewTitle,
          readinessItems,
          submitLabel,
          submitPrivateDraft,
          totalPhotoCount,
        },
      }
    : {}),
});
</script>

<style scoped>
.spot-form {
  --composer-accent: var(--accent-teal);
  --composer-accent-soft: color-mix(in srgb, var(--composer-accent) 14%, transparent);
  --composer-danger: var(--danger);
  --composer-success: var(--accent-teal);
  --composer-violet: var(--accent-teal-strong);
  display: block;
}

.spot-form[data-category='food'] { --composer-accent: var(--badge-food-fg, var(--accent-gold)); }
.spot-form[data-category='nature'],
.spot-form[data-category='adventure'] { --composer-accent: var(--badge-nature-fg, var(--success)); }
.spot-form[data-category='nightlife'],
.spot-form[data-category='culture'] { --composer-accent: var(--badge-nightlife-fg); }
.spot-form[data-category='shopping'] { --composer-accent: var(--badge-shopping-fg, var(--danger)); }
.spot-form[data-category='entertainment'] { --composer-accent: var(--badge-entertainment-fg, var(--accent-gold)); }
.spot-form[data-category='scenic'] { --composer-accent: var(--badge-scenic-fg, var(--info)); }

.sr-only {
  position: absolute;
  width: 0;
  height: 0;
  padding: 0;
  margin: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
  opacity: 0;
  pointer-events: none;
}

.minimal-composer {
  display: grid;
  gap: var(--space-3);
  width: min(100%, 94rem);
  margin: 0 auto;
  padding: var(--space-4);
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, transparent);
  border-radius: var(--radius-xl);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--bg-secondary) 98%, transparent), color-mix(in srgb, var(--bg-primary) 88%, transparent)),
    color-mix(in srgb, var(--bg-secondary) 94%, transparent);
  box-shadow: var(--shadow-md);
}

.composer-grid {
  display: grid;
  grid-template-columns: minmax(21rem, 0.92fr) minmax(0, 1.28fr);
  gap: var(--space-3);
  align-items: start;
}

.composer-column {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}

.composer-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-height: 3.8rem;
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--glass-border) 76%, transparent);
  background: color-mix(in srgb, var(--bg-tertiary) 34%, var(--bg-secondary));
}

.composer-bar__title {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  min-width: 0;
}

.composer-bar__title h2 {
  margin: 0;
  font-size: var(--font-size-h3);
  line-height: 1.1;
  letter-spacing: 0;
}

.composer-bar__meta {
  font-size: var(--font-size-caption);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.composer-bar__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
}

.bar-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-width: max-content;
  height: 2.15rem;
  padding: 0 0.75rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
  background: transparent;
  color: var(--text-primary);
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast), color var(--transition-fast);
}

.bar-button--ghost:hover,
.bar-button--ghost:focus-visible {
  outline: none;
  background: color-mix(in srgb, var(--bg-tertiary) 80%, transparent);
  border-color: color-mix(in srgb, var(--glass-border) 100%, transparent);
}

.bar-button--primary {
  background: var(--accent-teal);
  color: var(--text-inverse);
  border-color: var(--accent-teal);
}

.bar-button--primary:hover,
.bar-button--primary:focus-visible {
  outline: none;
  background: var(--accent-teal-hover);
  border-color: var(--accent-teal-hover);
}

.bar-button:disabled,
.bar-button:disabled:hover {
  cursor: not-allowed;
  opacity: 0.55;
  background: transparent;
  color: var(--text-secondary);
  border-color: color-mix(in srgb, var(--glass-border) 60%, transparent);
}

.bar-button--primary:disabled {
  background: color-mix(in srgb, var(--accent-teal) 35%, var(--bg-secondary));
  color: rgba(255, 255, 255, 0.7);
  border-color: transparent;
}

.visibility-control {
  display: inline-flex;
  align-items: center;
  gap: 0.24rem;
  padding: 0.22rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 84%, var(--border));
  background: color-mix(in srgb, var(--bg-primary) 36%, var(--glass-bg));
}

.visibility-option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 1.65rem;
  padding: 0.18rem 0.56rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 90%, var(--border));
  background: color-mix(in srgb, var(--bg-secondary) 72%, transparent);
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.visibility-option :deep(.scope-icon) {
  width: 0.9rem;
  height: 0.9rem;
}

.visibility-option.is-selected {
  border-color: color-mix(in srgb, var(--accent-teal) 72%, var(--glass-border));
  background: color-mix(in srgb, var(--accent-teal) 18%, var(--bg-secondary));
  color: var(--text-primary);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-teal) 26%, transparent);
}

.composer-section {
  display: grid;
  gap: 0.8rem;
  min-width: 0;
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--glass-border) 72%, transparent);
  background: color-mix(in srgb, var(--bg-tertiary) 28%, transparent);
  transition: border-color var(--transition-fast);
}

.composer-section:focus-within {
  border-color: color-mix(in srgb, var(--composer-violet) 32%, var(--glass-border));
}

.composer-section.has-server-error {
  border-color: color-mix(in srgb, var(--composer-danger) 55%, var(--glass-border));
}

.section-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-width: 0;
}

.section-bar__title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem;
  min-width: 0;
}

.section-bar h3 {
  margin: 0;
  font-size: var(--font-size-h4);
  letter-spacing: 0;
}

.hero-dropzone {
  position: relative;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  height: clamp(13rem, 24vh, 17rem);
  border-radius: var(--radius-lg);
  border: 1.5px dashed color-mix(in srgb, var(--glass-border) 100%, transparent);
  background: color-mix(in srgb, var(--bg-tertiary) 50%, var(--bg-secondary));
  overflow: hidden;
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}

.hero-dropzone:hover,
.hero-dropzone:focus-within {
  border-color: color-mix(in srgb, var(--composer-violet) 55%, var(--glass-border));
  background: color-mix(in srgb, var(--bg-tertiary) 70%, var(--bg-secondary));
}

.hero-dropzone.has-photo {
  border-style: solid;
  border-color: color-mix(in srgb, var(--glass-border) 80%, transparent);
  background: var(--bg-primary);
}

.hero-dropzone.has-server-error {
  border-color: color-mix(in srgb, var(--composer-danger) 70%, var(--glass-border));
}

.hero-dropzone.is-disabled {
  cursor: default;
}

.hero-dropzone img {
  position: absolute;
  inset: 0.36rem;
  width: calc(100% - 0.72rem);
  height: calc(100% - 0.72rem);
  max-width: calc(100% - 0.72rem);
  max-height: calc(100% - 0.72rem);
  object-fit: contain;
  object-position: center;
  border-radius: calc(var(--radius-lg) - 0.36rem);
  background: color-mix(in srgb, var(--bg-primary) 84%, transparent);
}

.hero-dropzone__empty {
  display: grid;
  justify-items: center;
  gap: 0.35rem;
  padding: var(--space-4);
  text-align: center;
  color: var(--text-secondary);
}

.hero-dropzone__empty :deep(.scope-icon) {
  width: 2.1rem;
  height: 2.1rem;
  padding: 0.5rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 70%, transparent);
  color: var(--text-primary);
}

.hero-dropzone__empty strong {
  font-size: 1rem;
  color: var(--text-primary);
}

.hero-dropzone__empty small {
  font-size: var(--font-size-caption);
}

.upload-button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  height: 2rem;
  padding: 0 0.75rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
  background: color-mix(in srgb, var(--bg-tertiary) 60%, transparent);
  color: var(--text-primary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}

.upload-button :deep(.scope-icon) {
  width: 0.9rem;
  height: 0.9rem;
}

.upload-button:hover,
.upload-button:focus-within {
  outline: none;
  border-color: color-mix(in srgb, var(--composer-violet) 50%, var(--glass-border));
}

.upload-button.is-disabled {
  opacity: 0.56;
  cursor: default;
}

.photo-strip {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0.3rem 0.08rem 0.2rem;
  scrollbar-width: thin;
}

.photo-thumb {
  position: relative;
  flex: 0 0 3.25rem;
  width: 3.25rem;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  border: 1px solid color-mix(in srgb, var(--glass-border) 76%, transparent);
  transition: transform var(--transition-fast), border-color var(--transition-fast);
}

.photo-thumb:hover,
.photo-thumb:focus-within {
  z-index: 2;
  border-color: color-mix(in srgb, var(--composer-violet) 46%, var(--glass-border));
}

.photo-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: inherit;
}

.photo-thumb--add {
  display: grid;
  place-items: center;
  cursor: pointer;
  color: var(--text-primary);
  border: 1.5px dashed color-mix(in srgb, var(--glass-border) 90%, transparent);
  background: color-mix(in srgb, var(--bg-tertiary) 58%, transparent);
}

.photo-thumb--add :deep(.scope-icon) {
  width: 1.18rem;
  height: 1.18rem;
}

.photo-action.danger {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  width: 1.5rem;
  height: 1.5rem;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-primary) 72%, transparent);
  color: white;
  cursor: pointer;
}

.photo-action.danger :deep(.scope-icon) {
  width: 0.75rem;
  height: 0.75rem;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}

.field {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
}

.field-full {
  grid-column: 1 / -1;
}

.field > span,
.field-label {
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-secondary);
}

.field input,
.field textarea,
.field select {
  width: 100%;
  min-height: 2.45rem;
  padding: 0.62rem 0.75rem;
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
  background: color-mix(in srgb, var(--bg-primary) 60%, var(--bg-tertiary));
  color: var(--text-primary);
  font-size: var(--font-size-body);
  font-family: inherit;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.field textarea {
  resize: vertical;
  min-height: 5.3rem;
  line-height: 1.5;
}

.native-control {
  position: relative;
  display: grid;
  align-items: center;
}

.native-control input,
.native-control select {
  appearance: none;
  padding-right: 2.35rem;
}

.native-control :deep(.scope-icon) {
  position: absolute;
  right: 0.72rem;
  width: 0.98rem;
  height: 0.98rem;
  color: var(--text-secondary);
  pointer-events: none;
}

.native-control input[type='date']::-webkit-calendar-picker-indicator {
  opacity: 0;
}

.field input:focus-visible,
.field textarea:focus-visible,
.field select:focus-visible {
  outline: none;
  border-color: color-mix(in srgb, var(--composer-violet) 60%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--composer-violet) 22%, transparent);
}

.field input::placeholder,
.field textarea::placeholder {
  color: var(--text-tertiary, color-mix(in srgb, var(--text-secondary) 60%, transparent));
}

.field.has-server-error input,
.field.has-server-error textarea,
.field.has-server-error select {
  border-color: color-mix(in srgb, var(--composer-danger) 60%, var(--glass-border));
}

.field-error {
  color: var(--composer-danger);
  font-size: var(--font-size-caption);
  margin: 0;
}

.safety-error {
  display: block;
  margin: var(--space-2) 0 0;
}

.story-fields {
  display: grid;
  gap: 0.7rem;
}

.place-control {
  display: flex;
  gap: 0.5rem;
}

.place-control input {
  flex: 1;
}

.location-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(13rem, 0.95fr);
  gap: 0.75rem;
  align-items: start;
}

.pin-picker {
  position: relative;
  height: 13.2rem;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
  background: var(--bg-primary);
}

.pin-picker__view {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  min-height: 100%;
}

.verification-error {
  margin: 0;
  font-size: var(--font-size-caption);
  color: var(--composer-danger);
}

.location-details {
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.58rem;
}

.location-details .field--city,
.location-details .field--country,
.location-details .field--postal {
  grid-column: span 2;
}

.location-details .field--coordinate {
  grid-column: span 3;
}

.pillar-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.pillar-chip {
  display: inline-flex;
  align-items: center;
  height: 1.85rem;
  padding: 0 0.62rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--glass-border) 80%, transparent);
  background: color-mix(in srgb, var(--bg-tertiary) 50%, transparent);
  color: var(--text-primary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}

.pillar-chip:hover,
.pillar-chip:focus-visible {
  outline: none;
  border-color: color-mix(in srgb, var(--composer-violet) 38%, var(--glass-border));
}

.pillar-chip.is-selected {
  background: var(--composer-violet);
  color: var(--text-inverse);
  border-color: var(--composer-violet);
}

.composer-section--extras {
  align-content: start;
}

.server-rejection {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--composer-danger) 50%, transparent);
  background: color-mix(in srgb, var(--composer-danger) 8%, var(--bg-secondary));
}

.server-rejection__icon {
  display: grid;
  place-items: center;
  width: 2.3rem;
  height: 2.3rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--composer-danger) 20%, transparent);
  color: var(--composer-danger);
}

.server-rejection h3 {
  margin: 0;
  font-size: var(--font-size-h3);
}

.server-rejection p {
  margin: 0.2rem 0 0;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.server-rejection__action {
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
}

.server-rejection__fields {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: var(--space-2);
}

.server-rejection__fields span {
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-full);
  border: 1px solid color-mix(in srgb, var(--composer-danger) 50%, transparent);
  background: color-mix(in srgb, var(--composer-danger) 14%, transparent);
  color: var(--composer-danger);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
}

.eyebrow {
  margin: 0;
  color: var(--composer-danger);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-semibold);
}

@media (max-height: 820px) and (min-width: 1021px) {
  .minimal-composer {
    padding: 0.72rem;
  }

  .composer-grid,
  .composer-column {
    gap: 0.55rem;
  }

  .composer-bar {
    min-height: 3.1rem;
    padding: 0.58rem 0.68rem;
  }

  .composer-section {
    gap: 0.5rem;
    padding: 0.62rem;
  }

  .field input,
  .field textarea,
  .field select {
    min-height: 2.16rem;
    padding-top: 0.48rem;
    padding-bottom: 0.48rem;
  }

  .hero-dropzone {
    height: 12.4rem;
  }

  .photo-thumb {
    flex-basis: 2.85rem;
    width: 2.85rem;
  }

  .pin-picker {
    height: 9.8rem;
  }

  .field textarea {
    min-height: 3.85rem;
  }

  .pillar-chip {
    height: 1.62rem;
  }
}

@media (max-width: 1020px) {
  .minimal-composer {
    width: min(100%, 48rem);
  }

  .composer-grid {
    grid-template-columns: 1fr;
  }

  .composer-column--right {
    order: -1;
  }

  .composer-column--left {
    order: 0;
  }
}

@media (max-width: 720px) {
  .minimal-composer {
    padding: var(--space-3);
  }

  .composer-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .composer-bar__actions {
    justify-content: space-between;
  }

  .field-grid {
    grid-template-columns: 1fr;
  }

  .location-details {
    grid-template-columns: 1fr;
  }

  .location-details .field--city,
  .location-details .field--country,
  .location-details .field--postal,
  .location-details .field--coordinate {
    grid-column: auto;
  }

  .location-workspace {
    grid-template-columns: 1fr;
  }

  .pin-picker {
    height: 14rem;
  }

  .hero-dropzone {
    height: 14rem;
  }
}
</style>
