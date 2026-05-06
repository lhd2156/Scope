<template>
  <div v-if="toastStore.hasToasts" class="toast-viewport">
    <TransitionGroup :name="transitionName" tag="div" class="toast-stack">
      <Toast
        v-for="toast in toastStore.items"
        :key="toast.id"
        :title="toast.title"
        :message="toast.message"
        :tone="toast.tone"
        :auto-hide-ms="toast.autoHideMs"
        @close="toastStore.dismissToast(toast.id)"
      />
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Toast from '@/components/common/Toast.vue';
import { useToastStore } from '@/stores/toasts';
import { useReducedMotion } from '@/utils/motion';

const toastStore = useToastStore();
const reducedMotion = useReducedMotion();
const transitionName = computed(() => (reducedMotion.value ? 'toast-stack-reduced' : 'toast-stack'));
</script>

<style scoped>
.toast-viewport {
  position: fixed;
  right: var(--space-4);
  bottom: var(--space-4);
  z-index: var(--z-toast);
  width: min(24rem, calc(100vw - (var(--space-4) * 2)));
  pointer-events: none;
}

.toast-stack {
  display: grid;
  gap: var(--space-3);
}

.toast-stack :deep(.toast) {
  pointer-events: auto;
}

.toast-stack-enter-active,
.toast-stack-leave-active,
.toast-stack-move {
  transition:
    opacity var(--transition-normal),
    transform var(--transition-normal),
    filter var(--transition-normal);
  will-change: opacity, transform, filter;
}

.toast-stack-enter-from,
.toast-stack-leave-to {
  opacity: 0;
  transform: translate3d(var(--motion-toast-slide-x), var(--motion-toast-slide-y), 0) scale(0.98);
  filter: blur(0.625rem);
}

.toast-stack-enter-to,
.toast-stack-leave-from {
  opacity: 1;
  transform: none;
  filter: none;
}

.toast-stack-reduced-enter-active,
.toast-stack-reduced-leave-active,
.toast-stack-reduced-move {
  transition: opacity var(--transition-fast);
}

.toast-stack-reduced-enter-from,
.toast-stack-reduced-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .toast-stack-enter-active,
  .toast-stack-leave-active,
  .toast-stack-move,
  .toast-stack-reduced-enter-active,
  .toast-stack-reduced-leave-active,
  .toast-stack-reduced-move {
    transition-duration: 1ms;
  }

  .toast-stack-enter-from,
  .toast-stack-leave-to {
    transform: none;
  }
}

@media (max-width: 640px) {
  .toast-viewport {
    left: var(--space-4);
    width: auto;
  }
}
</style>
