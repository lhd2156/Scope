<template>
  <section class="toast glass-panel" :class="[`toast--${tone}`]" :role="liveRole" :aria-live="liveMode" aria-atomic="true">
    <div class="toast-copy">
      <strong>{{ title }}</strong>
      <p>{{ message }}</p>
    </div>
    <button type="button" class="toast-close" aria-label="Dismiss toast" @click="$emit('close')">
      <ScopeIcon name="close" label="Dismiss toast" />
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';
import ScopeIcon from '@/components/common/ScopeIcon.vue';
import type { ToastTone } from '@/types';

const props = withDefaults(
  defineProps<{
    title: string;
    message: string;
    tone?: ToastTone;
    autoHideMs?: number;
  }>(),
  {
    tone: 'info',
    autoHideMs: 3_600,
  },
);

const emit = defineEmits<{
  (event: 'close'): void;
}>();

const liveRole = computed(() => (props.tone === 'error' ? 'alert' : 'status'));
const liveMode = computed(() => (props.tone === 'error' ? 'assertive' : 'polite'));
let timeoutId: ReturnType<typeof setTimeout> | null = null;

function clearTimeoutIfNeeded() {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
}

function scheduleAutoHide() {
  clearTimeoutIfNeeded();

  if (props.autoHideMs > 0) {
    timeoutId = setTimeout(() => emit('close'), props.autoHideMs);
  }
}

watch(
  () => props.autoHideMs,
  () => {
    scheduleAutoHide();
  },
  { immediate: true },
);

onBeforeUnmount(clearTimeoutIfNeeded);
</script>

<style scoped>
.toast {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-4);
  width: 100%;
  padding: var(--space-4);
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);
}

.toast:hover {
  transform: translateY(-0.0625rem);
  box-shadow: var(--shadow-lg);
}

.toast-copy {
  display: grid;
  gap: var(--space-2);
}

.toast-copy strong,
.toast-copy p {
  margin: 0;
}

.toast-copy p {
  color: var(--text-secondary);
}

.toast--success {
  border-color: color-mix(in srgb, var(--success) 34%, var(--glass-border));
}

.toast--error {
  border-color: color-mix(in srgb, var(--danger) 34%, var(--glass-border));
}

.toast--info {
  border-color: color-mix(in srgb, var(--info) 34%, var(--glass-border));
}

.toast-close {
  width: 2rem;
  height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
}

.toast-close:hover,
.toast-close:focus-visible {
  background: var(--accent-teal-light);
  color: var(--text-primary);
  outline: none;
}

.toast-close:active {
  transform: scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .toast,
  .toast-close {
    transition-duration: 1ms;
  }

  .toast:hover,
  .toast-close:active {
    transform: none;
  }
}
</style>
