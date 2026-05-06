<template>
  <form class="spot-form" data-test="spot-form" @submit.prevent="handleSubmit">
    <section class="glass-panel form-shell">
      <header class="form-header">
        <div>
          <p class="eyebrow">{{ mode === 'edit' ? 'Edit pin' : 'Drop a pin' }}</p>
          <h2>{{ heading }}</h2>
          <p class="section-copy">{{ description }}</p>
        </div>

        <div class="status-chip">
          <ScopeIcon name="map" label="Map-ready spot" />
          <span>{{ totalPhotoCount }} photo{{ totalPhotoCount === 1 ? '' : 's' }}</span>
        </div>
      </header>

      <div class="form-grid">
        <section class="surface-card panel-section">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Story</p>
              <h3>What makes this stop worth sharing?</h3>
            </div>
          </div>

          <div class="field-grid">
            <label class="field field-full">
              <span>Title</span>
              <input
                v-model="form.title"
                name="title"
                type="text"
                maxlength="120"
                placeholder="Sunset Rooftop Tacos"
                :aria-invalid="Boolean(errors.title)"
              />
              <small v-if="errors.title" class="field-error">{{ errors.title }}</small>
            </label>

            <label class="field field-full">
              <span>Description</span>
              <textarea
                v-model="form.description"
                name="description"
                rows="5"
                maxlength="2000"
                placeholder="Tell travelers why this stop matters, what to order, and when it shines."
                :aria-invalid="Boolean(errors.description)"
              />
              <small v-if="errors.description" class="field-error">{{ errors.description }}</small>
            </label>

            <label class="field">
              <span>Category</span>
              <select v-model="form.category" name="category">
                <option v-for="category in categories" :key="category" :value="category">
                  {{ formatCategory(category) }}
                </option>
              </select>
            </label>

            <label class="field">
              <span>Vibe</span>
              <input
                v-model="form.vibe"
                name="vibe"
                type="text"
                maxlength="48"
                placeholder="electric, calm, curated"
                :aria-invalid="Boolean(errors.vibe)"
              />
              <small v-if="errors.vibe" class="field-error">{{ errors.vibe }}</small>
            </label>

            <label class="field">
              <span>Rating</span>
              <input v-model.number="form.rating" name="rating" type="number" min="0" max="5" step="0.1" />
              <small v-if="errors.rating" class="field-error">{{ errors.rating }}</small>
            </label>

            <label class="field">
              <span>Visited at</span>
              <input v-model="form.visitedAt" name="visitedAt" type="date" :aria-invalid="Boolean(errors.visitedAt)" />
              <small v-if="errors.visitedAt" class="field-error">{{ errors.visitedAt }}</small>
            </label>

            <label class="field field-full toggle-field">
              <span>Visibility</span>
              <button
                class="toggle-button"
                :class="{ 'is-public': form.isPublic }"
                type="button"
                @click="form.isPublic = !form.isPublic"
              >
                <span class="toggle-thumb" />
                <span>{{ form.isPublic ? 'Public community pin' : 'Private draft' }}</span>
              </button>
            </label>
          </div>
        </section>

        <section class="surface-card panel-section">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Location</p>
              <h3>Place the pin with map precision</h3>
            </div>
            <span class="map-status">{{ mapStatusLabel }}</span>
          </div>

          <div class="field-grid location-grid">
            <label class="field field-full">
              <span>Address</span>
              <input
                v-model="form.address"
                name="address"
                type="text"
                maxlength="160"
                placeholder="123 Main St"
                :aria-invalid="Boolean(errors.address)"
              />
              <small v-if="errors.address" class="field-error">{{ errors.address }}</small>
            </label>

            <label class="field">
              <span>City</span>
              <input
                v-model="form.city"
                name="city"
                type="text"
                maxlength="160"
                placeholder="City name"
                :aria-invalid="Boolean(errors.city)"
              />
              <small v-if="errors.city" class="field-error">{{ errors.city }}</small>
            </label>

            <label class="field">
              <span>Country</span>
              <input
                v-model="form.country"
                name="country"
                type="text"
                maxlength="160"
                placeholder="US"
                :aria-invalid="Boolean(errors.country)"
              />
              <small v-if="errors.country" class="field-error">{{ errors.country }}</small>
            </label>

            <label class="field">
              <span>Latitude</span>
              <input v-model.number="form.latitude" name="latitude" type="number" step="0.000001" />
              <small v-if="errors.latitude" class="field-error">{{ errors.latitude }}</small>
            </label>

            <label class="field">
              <span>Longitude</span>
              <input v-model.number="form.longitude" name="longitude" type="number" step="0.000001" />
              <small v-if="errors.longitude" class="field-error">{{ errors.longitude }}</small>
            </label>
          </div>

          <div class="pin-picker">
            <div ref="mapContainer" class="pin-picker__map" :class="{ 'is-fallback': !isInteractiveMapReady }" />

            <div v-if="!isInteractiveMapReady" class="pin-picker__empty glass-panel">
              <div>
                <p class="eyebrow">{{ mapFallbackEyebrow }}</p>
                <h4>{{ mapFallbackTitle }}</h4>
                <p>{{ mapFallbackDescription }}</p>
              </div>

              <div v-if="showLoadInteractiveMapAction" class="pin-picker__cta-row">
                <button type="button" class="preset-button" :disabled="isInteractiveMapLoading" @click="void enableInteractiveMap()">
                  {{ isInteractiveMapLoading ? 'Loading live map…' : 'Load live map picker' }}
                </button>
              </div>

              <div class="preset-grid">
                <button v-for="preset in locationPresets" :key="preset.label" type="button" class="preset-button" @click="applyPreset(preset)">
                  {{ preset.label }}
                </button>
              </div>
            </div>

            <div class="pin-picker__legend glass-panel">
              <ScopeIcon name="crosshair" label="Pin picker" />
              <span>Click the map or drag the marker to update coordinates.</span>
            </div>
          </div>
        </section>
      </div>
    </section>

    <section class="glass-panel form-shell photos-shell">
      <div class="panel-heading panel-heading--photos">
        <div>
          <p class="eyebrow">Photos</p>
          <h3>Upload the cover and atmosphere shots</h3>
          <p class="section-copy">JPEG, PNG, and WebP are supported. The first image becomes the hero surface.</p>
        </div>

        <label class="upload-button" for="spot-photo-input">
          <ScopeIcon name="camera" label="Upload photos" />
          <span>Add photos</span>
        </label>
      </div>

      <input
        id="spot-photo-input"
        data-test="photo-upload-input"
        class="sr-only"
        type="file"
        multiple
        :accept="SPOT_PHOTO_ACCEPT"
        @change="handlePhotoSelection"
      />

      <p v-if="errors.photos" class="field-error photos-error">{{ errors.photos }}</p>

      <div v-if="existingPhotos.length || uploads.length" class="photo-grid">
        <article v-for="photo in existingPhotos" :key="photo.id" class="surface-card photo-card">
          <img :src="photo.url" :alt="photo.caption || 'Existing spot photo'" class="photo-card__image" />
          <div class="photo-card__body">
            <div class="photo-card__header">
              <strong>Existing photo</strong>
              <button type="button" class="photo-action danger" @click="removeExistingPhoto(photo.id)">Remove</button>
            </div>
            <label class="field">
              <span>Caption</span>
              <input v-model="photo.caption" type="text" maxlength="120" placeholder="Golden hour detail" />
            </label>
          </div>
        </article>

        <article v-for="upload in uploads" :key="upload.id" class="surface-card photo-card" data-test="photo-preview-card">
          <img :src="upload.previewUrl" :alt="upload.caption || upload.file.name" class="photo-card__image" />
          <div class="photo-card__body">
            <div class="photo-card__header">
              <strong>{{ upload.file.name }}</strong>
              <button type="button" class="photo-action danger" @click="removeUpload(upload.id)">Remove</button>
            </div>
            <p class="photo-meta">{{ formatBytes(upload.sizeBytes) }} · {{ upload.mimeType }}</p>
            <label class="field">
              <span>Caption</span>
              <input v-model="upload.caption" type="text" maxlength="120" placeholder="What does this frame show?" />
            </label>
          </div>
        </article>
      </div>

      <div v-else class="photo-empty surface-card">
        <ScopeIcon name="image" label="No photos uploaded" />
        <div>
          <strong>No photos yet</strong>
          <p>Add at least one photo so the spot can render with a premium cover image.</p>
        </div>
      </div>
    </section>

    <footer class="glass-panel form-footer">
      <div>
        <p class="eyebrow">Ready</p>
        <p class="section-copy">{{ mode === 'edit' ? 'Save your changes and keep the pin fresh.' : 'Publish this stop to the Scope map and discovery flow.' }}</p>
      </div>

      <div class="footer-actions">
        <button class="footer-button footer-button--secondary" type="button" @click="$emit('cancel')">Cancel</button>
        <button class="footer-button footer-button--primary" data-test="spot-submit" type="submit" :disabled="submitting">
          {{ submitting ? 'Saving…' : submitLabel }}
        </button>
      </div>
    </footer>
  </form>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import type mapboxgl from 'mapbox-gl';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import {
  DEFAULT_MAP_STYLE,
  hasMapboxToken,
  loadConfiguredMapboxRuntime,
  resolveMapboxStyle,
} from '@/services/mapboxLoader';
import type { Photo, SpotCategory, SpotFormInput, SpotFormSubmission, SpotPhotoUpload } from '@/types';
import { isScopeQaMode } from '@/utils/qaMode';
import { isUiTestEnvironment, scheduleNonCriticalTask, type CancelScheduledTask } from '@/utils/scheduleNonCriticalTask';
import { SPOT_PHOTO_ACCEPT, validateSpotFormInput, validateSpotPhotoFile, type SpotFormErrors } from '@/utils/validators';

interface LocationPreset {
  label: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
}

const props = withDefaults(
  defineProps<{
    mode?: 'create' | 'edit';
    initialValue?: Partial<SpotFormInput> | null;
    initialPhotos?: Photo[];
    submitting?: boolean;
  }>(),
  {
    mode: 'create',
    initialValue: null,
    initialPhotos: () => [],
    submitting: false,
  },
);

const emit = defineEmits<{
  (event: 'submit', payload: SpotFormSubmission): void;
  (event: 'cancel'): void;
}>();

const DEFAULT_CENTER: [number, number] = [0, 0];
const categories: SpotCategory[] = ['food', 'nature', 'nightlife', 'culture', 'adventure', 'shopping', 'scenic', 'other'];
const locationPresets: LocationPreset[] = [
  { label: 'Fort Worth', city: 'Fort Worth', country: 'US', latitude: 32.7555, longitude: -97.3308 },
  { label: 'Dallas', city: 'Dallas', country: 'US', latitude: 32.7767, longitude: -96.797 },
  { label: 'Austin', city: 'Austin', country: 'US', latitude: 30.2672, longitude: -97.7431 },
];

const mapContainer = ref<HTMLDivElement | null>(null);
const map = shallowRef<mapboxgl.Map | null>(null);
const marker = shallowRef<mapboxgl.Marker | null>(null);
const hasToken = hasMapboxToken();
const isScopeSpotQaMode = isScopeQaMode();
const interactiveMapAvailable = hasToken && !isUiTestEnvironment();
const shouldAutoHydrateInteractiveMap = interactiveMapAvailable && !isScopeSpotQaMode;
const errors = ref<SpotFormErrors>({});
const existingPhotos = ref<Photo[]>([]);
const uploads = ref<SpotPhotoUpload[]>([]);
const isInteractiveMapLoading = ref(false);
const form = reactive<SpotFormInput>(createDefaultForm(props.initialValue));

let themeObserver: MutationObserver | null = null;
let syncingMap = false;
let cancelDeferredMapSetup: CancelScheduledTask = () => undefined;

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
    category: initialValue?.category ?? 'food',
    vibe: initialValue?.vibe ?? '',
    rating: typeof initialValue?.rating === 'number' ? initialValue.rating : 4.5,
    visitedAt: initialValue?.visitedAt ?? todayValue(),
    isPublic: initialValue?.isPublic ?? true,
  };
}

function clonePhotos(photos: Photo[]): Photo[] {
  return photos.map((photo) => ({ ...photo }));
}

function formatCategory(category: SpotCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function clearError(field: keyof SpotFormErrors): void {
  if (!errors.value[field]) {
    return;
  }

  const nextErrors = { ...errors.value };
  delete nextErrors[field];
  errors.value = nextErrors;
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
    category: form.category,
    vibe: form.vibe.trim(),
    rating: Number(form.rating),
    visitedAt: form.visitedAt,
    isPublic: form.isPublic,
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

function resetFromProps(): void {
  Object.assign(form, createDefaultForm(props.initialValue));
  existingPhotos.value = clonePhotos(props.initialPhotos);
  revokeUploadPreviews();
  uploads.value = [];
  errors.value = {};
  syncMarkerWithForm(true);
}

function buildMarkerElement(): HTMLDivElement {
  const element = document.createElement('div');
  element.setAttribute('aria-hidden', 'true');
  element.style.width = '1.4rem';
  element.style.height = '1.4rem';
  element.style.borderRadius = '9999px';
  element.style.border = '3px solid var(--bg-primary)';
  element.style.background = 'var(--accent-teal)';
  element.style.boxShadow = '0 0 0 0.4rem var(--accent-teal-light)';
  return element;
}

function setCoordinates(latitude: number, longitude: number, recenterMap = true): void {
  form.latitude = Number(latitude.toFixed(6));
  form.longitude = Number(longitude.toFixed(6));
  clearError('latitude');
  clearError('longitude');

  if (recenterMap) {
    syncMarkerWithForm(true);
  }
}

function syncMarkerWithForm(recenterMap = false): void {
  if (!map.value || !marker.value || !interactiveMapAvailable) {
    return;
  }

  const coordinates: [number, number] = [form.longitude, form.latitude];
  marker.value.setLngLat(coordinates);

  if (recenterMap && !syncingMap) {
    map.value.easeTo({ center: coordinates, duration: 250 });
  }
}

function syncThemeToMap(): void {
  if (!map.value || !interactiveMapAvailable) {
    return;
  }

  map.value.setStyle(resolveMapboxStyle(DEFAULT_MAP_STYLE));
}

async function setupMap(): Promise<void> {
  if (!mapContainer.value || !interactiveMapAvailable || map.value) {
    return;
  }

  const runtime = await loadConfiguredMapboxRuntime();
  if (!mapContainer.value || map.value) {
    return;
  }

  const instance = new runtime.Map({
    container: mapContainer.value,
    style: resolveMapboxStyle(DEFAULT_MAP_STYLE),
    center: [form.longitude, form.latitude],
    zoom: 12,
    attributionControl: false,
  });

  const nextMarker = new runtime.Marker({ element: buildMarkerElement(), draggable: true })
    .setLngLat([form.longitude, form.latitude])
    .addTo(instance);

  nextMarker.on('dragstart', () => {
    syncingMap = true;
  });

  nextMarker.on('dragend', () => {
    const nextCoordinates = nextMarker.getLngLat();
    syncingMap = false;
    setCoordinates(nextCoordinates.lat, nextCoordinates.lng, false);
  });

  instance.on('click', (event) => {
    setCoordinates(event.lngLat.lat, event.lngLat.lng, false);
  });

  map.value = instance;
  marker.value = nextMarker;
}

async function enableInteractiveMap(): Promise<void> {
  if (!interactiveMapAvailable || map.value || isInteractiveMapLoading.value) {
    return;
  }

  isInteractiveMapLoading.value = true;

  try {
    await setupMap();
  } finally {
    isInteractiveMapLoading.value = false;
  }
}

function applyPreset(preset: LocationPreset): void {
  form.city = preset.city;
  form.country = preset.country;
  setCoordinates(preset.latitude, preset.longitude);
}

function removeExistingPhoto(photoId: string): void {
  existingPhotos.value = existingPhotos.value.filter((photo) => photo.id !== photoId);
  clearError('photos');
}

function removeUpload(uploadId: string): void {
  const upload = uploads.value.find((entry) => entry.id === uploadId);
  if (upload && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(upload.previewUrl);
  }

  uploads.value = uploads.value.filter((entry) => entry.id !== uploadId);
  clearError('photos');
}

function handlePhotoSelection(event: Event): void {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);

  if (!files.length) {
    return;
  }

  const nextUploads: SpotPhotoUpload[] = [];
  const photoErrors: string[] = [];

  files.forEach((file, index) => {
    const validationError = validateSpotPhotoFile(file);
    if (validationError) {
      photoErrors.push(`${file.name}: ${validationError}`);
      return;
    }

    nextUploads.push({
      id: `${Date.now()}-${index}-${file.name}`,
      file,
      previewUrl: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '',
      caption: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
      mimeType: file.type,
      sizeBytes: file.size,
    });
  });

  uploads.value = [...uploads.value, ...nextUploads];

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

function handleSubmit(): void {
  const normalizedForm = normalizeForm();
  const nextErrors = validateSpotFormInput(normalizedForm);

  if (!existingPhotos.value.length && !uploads.value.length) {
    nextErrors.photos = 'Upload at least one photo so the pin can render with a hero image.';
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

const totalPhotoCount = computed(() => existingPhotos.value.length + uploads.value.length);
const heading = computed(() => (props.mode === 'edit' ? 'Refine the story, media, and exact pin' : 'Create a discoverable spot with story, photos, and a mapped pin'));
const description = computed(() => (
  props.mode === 'edit'
    ? 'Keep the listing fresh with better copy, updated imagery, and more precise coordinates.'
    : 'Scope uses this metadata to render cards, map markers, and itinerary recommendations across the product.'
));
const submitLabel = computed(() => (props.mode === 'edit' ? 'Save changes' : 'Publish spot'));
const isInteractiveMapReady = computed(() => interactiveMapAvailable && Boolean(map.value));
const showLoadInteractiveMapAction = computed(() => interactiveMapAvailable && !isInteractiveMapReady.value);
const mapStatusLabel = computed(() => {
  if (isInteractiveMapReady.value) {
    return 'Mapbox ready';
  }

  if (interactiveMapAvailable) {
    return 'Interactive map available on demand';
  }

  return 'Token missing — manual coordinates enabled';
});
const mapFallbackEyebrow = computed(() => (interactiveMapAvailable ? 'Interactive map deferred' : 'Mapbox token required'));
const mapFallbackTitle = computed(() => (interactiveMapAvailable ? 'Manual coordinates stay responsive while the live map loads only when needed.' : 'Manual pin placement is active.'));
const mapFallbackDescription = computed(() => (
  interactiveMapAvailable
    ? 'Use the preset shortcuts, type exact coordinates, or load the interactive map picker when you want drag-and-drop precision.'
    : 'Scope will turn this panel into a clickable map picker as soon as VITE_MAPBOX_TOKEN is configured.'
));

watch(
  () => props.initialValue,
  () => {
    resetFromProps();
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
    syncMarkerWithForm(false);
  },
);

onMounted(() => {
  if (shouldAutoHydrateInteractiveMap) {
    cancelDeferredMapSetup = scheduleNonCriticalTask(() => enableInteractiveMap(), {
      delayMs: 1_600,
      timeoutMs: 3_200,
    });
  }

  themeObserver = new MutationObserver(syncThemeToMap);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
});

onBeforeUnmount(() => {
  cancelDeferredMapSetup();
  themeObserver?.disconnect();
  themeObserver = null;
  revokeUploadPreviews();
  marker.value?.remove();
  marker.value = null;
  map.value?.remove();
  map.value = null;
});
</script>

<style scoped>
.spot-form {
  display: grid;
  gap: var(--space-6);
}

.form-shell,
.form-footer {
  padding: var(--space-6);
}

.form-header,
.panel-heading,
.panel-heading--photos,
.form-footer {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: flex-start;
}

.form-header h2,
.panel-heading h3,
.pin-picker__empty h4 {
  margin: 0;
}

.status-chip,
.map-status,
.pin-picker__legend,
.upload-button,
.footer-button,
.toggle-button,
.preset-button,
.photo-action {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.status-chip,
.map-status,
.pin-picker__legend {
  padding: 0.65rem 0.9rem;
  font-size: var(--font-size-small);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-6);
  margin-top: var(--space-6);
}

.panel-section {
  padding: var(--space-5);
  display: grid;
  gap: var(--space-5);
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.field,
.toggle-field {
  display: grid;
  gap: var(--space-2);
  color: var(--text-secondary);
}

.field-full {
  grid-column: 1 / -1;
}

input,
select,
textarea {
  width: 100%;
  border: 1px solid var(--input-border);
  background: var(--input-bg);
  color: var(--text-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

input:focus,
select:focus,
textarea:focus {
  outline: none;
  border-color: var(--input-focus);
  box-shadow: var(--shadow-glow-teal);
}

textarea {
  resize: vertical;
  min-height: 8rem;
}

.field-error {
  color: var(--danger);
  font-size: var(--font-size-small);
}

.toggle-button {
  justify-content: flex-start;
  width: fit-content;
  padding: 0.45rem 0.8rem 0.45rem 0.45rem;
  cursor: pointer;
}

.toggle-thumb {
  width: 1.6rem;
  height: 1.6rem;
  border-radius: var(--radius-full);
  background: var(--text-muted);
  transition: background var(--transition-fast), transform var(--transition-fast);
}

.toggle-button.is-public {
  border-color: var(--accent-teal);
  background: var(--accent-teal-light);
}

.toggle-button.is-public .toggle-thumb {
  background: var(--accent-teal);
  transform: translateX(0.1rem);
}

.pin-picker {
  position: relative;
  min-height: 22rem;
  border-radius: var(--radius-2xl);
  overflow: hidden;
  background:
    radial-gradient(circle at top left, var(--accent-teal-light), transparent 35%),
    linear-gradient(180deg, var(--bg-tertiary), var(--bg-secondary));
}

.pin-picker__map {
  position: absolute;
  inset: 0;
}

.pin-picker__map.is-fallback {
  background:
    linear-gradient(90deg, transparent 49%, var(--glass-border) 50%, transparent 51%),
    linear-gradient(transparent 49%, var(--glass-border) 50%, transparent 51%),
    radial-gradient(circle at top left, var(--accent-teal-light), transparent 30%),
    radial-gradient(circle at bottom right, var(--accent-gold-light), transparent 30%),
    var(--bg-secondary);
  background-size: 4rem 4rem, 4rem 4rem, auto, auto, auto;
}

.pin-picker__empty,
.pin-picker__legend {
  position: absolute;
  z-index: var(--z-sidebar);
}

.pin-picker__empty {
  inset: 50% auto auto 50%;
  width: min(24rem, calc(100% - 2rem));
  transform: translate(-50%, -50%);
  padding: var(--space-5);
  display: grid;
  gap: var(--space-4);
}

.pin-picker__empty p,
.photo-empty p,
.photo-meta {
  margin: 0;
  color: var(--text-secondary);
}

.pin-picker__legend {
  left: var(--space-4);
  bottom: var(--space-4);
}

.preset-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.pin-picker__cta-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.preset-button,
.upload-button,
.photo-action,
.footer-button {
  padding: 0.7rem 0.95rem;
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
}

.preset-button:hover,
.upload-button:hover,
.photo-action:hover,
.footer-button:hover,
.footer-button:focus-visible,
.upload-button:focus-visible,
.photo-action:focus-visible,
.preset-button:focus-visible,
.toggle-button:focus-visible {
  outline: none;
  transform: translateY(-0.0625rem);
  border-color: var(--border-hover);
}

.photos-shell {
  display: grid;
  gap: var(--space-5);
}

.panel-heading--photos {
  align-items: center;
}

.upload-button {
  color: var(--accent-teal);
  font-weight: var(--font-weight-semibold);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: var(--space-4);
}

.photo-card {
  overflow: hidden;
}

.photo-card__image {
  width: 100%;
  height: 13rem;
  object-fit: cover;
}

.photo-card__body {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
}

.photo-card__header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  align-items: center;
}

.photo-meta {
  font-size: var(--font-size-small);
}

.photo-empty {
  padding: var(--space-5);
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.photo-empty :deep(.scope-icon) {
  width: 1.5rem;
  height: 1.5rem;
  color: var(--accent-gold);
}

.photos-error {
  margin: 0;
}

.photo-action.danger {
  color: var(--danger);
}

.footer-actions {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.footer-button--primary {
  border-color: transparent;
  background: var(--accent-teal);
  color: var(--bg-primary);
  font-weight: var(--font-weight-semibold);
}

.footer-button--secondary {
  background: transparent;
}

.footer-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.eyebrow {
  margin: 0 0 var(--space-2);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  padding: 0.15rem 0.35rem;
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
}

@media (max-width: 1100px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .form-shell,
  .form-footer {
    padding: var(--space-5);
  }

  .form-header,
  .panel-heading,
  .panel-heading--photos,
  .form-footer,
  .photo-card__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .field-grid {
    grid-template-columns: 1fr;
  }

  .pin-picker__legend {
    left: var(--space-3);
    right: var(--space-3);
    bottom: var(--space-3);
  }
}
</style>
