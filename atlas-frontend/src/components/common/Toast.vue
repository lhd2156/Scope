<template>
  <Transition name="toast-slide">
    <section v-if="open" class="toast glass-panel" :class="[`toast--${tone}`]" role="status" aria-live="polite">
      <div class="toast-copy">
        <strong>{{ title }}</strong>
        <p>{{ message }}</p>
      </div>
      <button type="button" class="toast-close" aria-label="Dismiss toast" @click="$emit('close')">
        <AtlasIcon name="close" label="Dismiss toast" />
      </button>
    </section>
  </Transition>
</template>

<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message: string;
    tone?: 'success' | 'error' | 'info';
    autoHideMs?: number;
  }>(),
  {
    tone: 'info',
    autoHideMs: 3600,
  },
);

const emit = defineEmits<{
  (event: 'close'): void;
}>();

let timeoutId: ReturnType<typeof setTimeout> | null = null;

function clearTimeoutIfNeeded() {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
}

watch(
  () => props.open,
  (isOpen) => {
    clearTimeoutIfNeeded();

    if (isOpen && props.autoHideMs > 0) {
      timeoutId = setTimeout(() => emit('close'), props.autoHideMs);
    }
  },
  { immediate: true },
);

onBeforeUnmount(clearTimeoutIfNeeded);
</script>

<style scoped>
.toast {
  position: fixed;
  right: var(--space-4);
  bottom: var(--space-4);
  z-index: var(--z-toast);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-4);
  width: min(24rem, calc(100vw - 2rem));
  padding: var(--space-4);
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
}

.toast-close:hover,
.toast-close:focus-visible {
  background: var(--accent-teal-light);
  color: var(--text-primary);
  outline: none;
}

.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: opacity var(--transition-normal), transform var(--transition-normal);
}

.toast-slide-enter-from,
.toast-slide-leave-to {
  opacity: 0;
  transform: translateY(0.8rem);
}
</style>
