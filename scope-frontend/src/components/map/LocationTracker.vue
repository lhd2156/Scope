<template>
  <aside
    class="location-tracker glass-panel"
    :class="`state-${trackingState}`"
    data-test="map-location-badge"
    :role="isActionable ? 'button' : undefined"
    :tabindex="isActionable ? 0 : undefined"
    :aria-label="isActionable ? `${statusTitle}. ${statusMessage}. Center map on this location.` : undefined"
    :title="statusMessage"
    @click="handleActivate"
    @keydown.enter.prevent="handleActivate"
    @keydown.space.prevent="handleActivate"
  >
    <div class="status-indicator" :class="{ 'is-live': trackingState === 'tracking' }" />
    <div>
      <strong>{{ statusTitle }}</strong>
      <p>{{ statusMessage }}</p>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { UserLocation } from '@/types';
import { isGeolocationSupported, startLocationWatch, stopLocationWatch } from '@/utils/geolocation';

type TrackingState = 'idle' | 'locating' | 'tracking' | 'denied' | 'unsupported' | 'error';

const props = withDefaults(
  defineProps<{
    autoStart?: boolean;
  }>(),
  {
    autoStart: true,
  },
);

const emit = defineEmits<{
  (event: 'update:location', location: UserLocation): void;
  (event: 'tracking-state', state: TrackingState): void;
  (event: 'activate', location: UserLocation | null): void;
}>();

const trackingState = ref<TrackingState>(isGeolocationSupported() ? 'idle' : 'unsupported');
const lastLocation = ref<UserLocation | null>(null);
const watchId = ref<number | null>(null);
const errorMessage = ref('');

const statusTitle = computed(() => {
  switch (trackingState.value) {
    case 'tracking':
      return 'Location on';
    case 'locating':
      return 'Turning location on';
    case 'denied':
      return 'Location permission blocked';
    case 'unsupported':
      return 'Location unavailable';
    case 'error':
      return 'GPS temporarily unavailable';
    default:
      return 'Location ready';
  }
});

const statusMessage = computed(() => {
  if (trackingState.value === 'tracking' && lastLocation.value) {
    return `Precision ${Math.round(lastLocation.value.accuracy)} m`;
  }

  if (trackingState.value === 'denied' || trackingState.value === 'error') {
    return errorMessage.value;
  }

  if (trackingState.value === 'unsupported') {
    return 'This browser cannot provide real-time location updates.';
  }

  if (trackingState.value === 'locating') {
    return 'Waiting for the next GPS fix to center the map.';
  }

  return 'Use the locate action to center the map on your current position.';
});

const isActionable = computed(() => trackingState.value !== 'unsupported');

function setTrackingState(nextState: TrackingState) {
  trackingState.value = nextState;
  emit('tracking-state', nextState);
}

function startTracking() {
  if (!isGeolocationSupported()) {
    setTrackingState('unsupported');
    return;
  }

  if (watchId.value !== null) {
    return;
  }

  setTrackingState('locating');
  const nextWatchId = startLocationWatch(
    (location) => {
      lastLocation.value = location;
      errorMessage.value = '';
      setTrackingState('tracking');
      emit('update:location', location);
    },
    (error) => {
      stopTracking();
      errorMessage.value = error.code === 1
        ? 'Allow location access to share your live position in Scope.'
        : 'Scope could not read your position. Try again in a stronger signal area.';
      setTrackingState(error.code === 1 ? 'denied' : 'error');
    },
  );

  watchId.value = nextWatchId;

  if (nextWatchId === null) {
    setTrackingState('unsupported');
  }
}

function stopTracking() {
  stopLocationWatch(watchId.value);
  watchId.value = null;

  if (trackingState.value === 'tracking' || trackingState.value === 'locating') {
    setTrackingState('idle');
  }
}

function focusUserLocation(): UserLocation | null {
  if (lastLocation.value) {
    return lastLocation.value;
  }

  startTracking();
  return null;
}

function getCurrentLocationSnapshot(): UserLocation | null {
  return lastLocation.value;
}

function handleActivate() {
  if (!isActionable.value) {
    return;
  }

  emit('activate', focusUserLocation());
}

defineExpose({
  focusUserLocation,
  getCurrentLocationSnapshot,
  startTracking,
  stopTracking,
  lastLocation,
});

watch(
  () => props.autoStart,
  (autoStart) => {
    if (autoStart) {
      startTracking();
      return;
    }

    stopTracking();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  stopTracking();
});
</script>

<style scoped>
.location-tracker {
  display: inline-flex;
  align-items: center;
  gap: 0.46rem;
  box-sizing: border-box;
  min-width: 0;
  width: max-content;
  max-width: min(8.2rem, calc(100vw - 2rem));
  min-height: 2.24rem;
  padding: 0.38rem 0.58rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--bg-secondary) 88%, transparent);
  box-shadow:
    0 0.8rem 2rem color-mix(in srgb, var(--bg-primary) 26%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 6%, transparent);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

.location-tracker:hover,
.location-tracker:focus-visible {
  transform: translateY(var(--motion-button-lift));
  border-color: color-mix(in srgb, var(--accent-teal) 34%, var(--glass-border));
  background: color-mix(in srgb, var(--bg-secondary) 92%, transparent);
  box-shadow:
    0 0.95rem 2.2rem color-mix(in srgb, var(--bg-primary) 30%, transparent),
    0 0 0 2px color-mix(in srgb, var(--accent-teal) 14%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--highlight-sheen) 8%, transparent);
  outline: none;
}

.location-tracker:active {
  transform: translateY(0) scale(var(--motion-press-scale));
}

.status-indicator {
  width: 0.64rem;
  height: 0.64rem;
  border-radius: var(--radius-full);
  background: var(--text-muted);
  box-shadow: 0 0 0 0.3rem var(--accent-teal-light);
  flex: 0 0 auto;
}

.location-tracker > div {
  min-width: 0;
}

.status-indicator.is-live {
  background: var(--accent-teal);
  animation: pulse 1.6s ease-in-out infinite;
}

.location-tracker strong {
  display: block;
  margin-bottom: 0.1rem;
  font-size: 0.78rem;
  line-height: 1.1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.location-tracker p {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.location-tracker.state-denied .status-indicator,
.location-tracker.state-error .status-indicator {
  background: var(--danger);
  box-shadow: 0 0 0 0.35rem var(--glass-border);
}

.location-tracker.state-unsupported .status-indicator,
.location-tracker.state-idle .status-indicator {
  box-shadow: 0 0 0 0.35rem var(--glass-border);
}

.location-tracker.state-idle,
.location-tracker.state-unsupported {
  display: none;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }

  50% {
    transform: scale(1.25);
    opacity: 0.75;
  }
}
</style>
