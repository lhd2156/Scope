<template>
  <aside class="location-tracker glass-panel" :class="`state-${trackingState}`">
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
}>();

const trackingState = ref<TrackingState>(isGeolocationSupported() ? 'idle' : 'unsupported');
const lastLocation = ref<UserLocation | null>(null);
const watchId = ref<number | null>(null);
const errorMessage = ref('');

const statusTitle = computed(() => {
  switch (trackingState.value) {
    case 'tracking':
      return 'Live GPS active';
    case 'locating':
      return 'Finding your signal';
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
    return `Accuracy ±${Math.round(lastLocation.value.accuracy)}m`;
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
        ? 'Allow location access to share your live position in Atlas.'
        : 'Atlas could not read your position. Try again in a stronger signal area.';
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

defineExpose({
  focusUserLocation,
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
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  min-width: 15rem;
}

.status-indicator {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: var(--radius-full);
  background: var(--text-muted);
  box-shadow: 0 0 0 0.35rem var(--accent-teal-light);
}

.status-indicator.is-live {
  background: var(--accent-teal);
  animation: pulse 1.6s ease-in-out infinite;
}

.location-tracker strong {
  display: block;
  margin-bottom: var(--space-1);
}

.location-tracker p {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
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
