<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="open" class="modal-backdrop" @click="handleBackdropClick">
        <section
          class="modal-panel glass-panel"
          :class="[`modal-panel--${size}`]"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          @click.stop
        >
          <header class="modal-header">
            <div>
              <p v-if="eyebrow" class="modal-eyebrow">{{ eyebrow }}</p>
              <h2>{{ title }}</h2>
            </div>
            <button type="button" class="modal-close" aria-label="Close modal" @click="$emit('close')">
              <AtlasIcon name="close" label="Close modal" />
            </button>
          </header>
          <div class="modal-body">
            <slot />
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    eyebrow?: string;
    size?: 'sm' | 'md' | 'lg';
    closeOnBackdrop?: boolean;
  }>(),
  {
    eyebrow: '',
    size: 'md',
    closeOnBackdrop: true,
  },
);

const emit = defineEmits<{
  (event: 'close'): void;
}>();

function handleBackdropClick() {
  if (props.closeOnBackdrop) {
    emit('close');
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.open) {
    emit('close');
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeydown);
      return;
    }

    window.removeEventListener('keydown', handleKeydown);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal-backdrop);
  display: grid;
  place-items: center;
  padding: var(--space-4);
  background: rgba(5, 8, 16, 0.7);
  backdrop-filter: blur(16px);
}

.modal-panel {
  width: min(100%, 46rem);
  max-height: min(90vh, 52rem);
  overflow: auto;
  border-radius: var(--radius-2xl);
  padding: var(--space-5);
  z-index: var(--z-modal);
}

.modal-panel--sm {
  width: min(100%, 28rem);
}

.modal-panel--lg {
  width: min(100%, 64rem);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  align-items: flex-start;
  margin-bottom: var(--space-4);
}

.modal-header h2,
.modal-eyebrow {
  margin: 0;
}

.modal-eyebrow {
  margin-bottom: var(--space-1);
  color: var(--accent-teal);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: var(--font-size-caption);
}

.modal-close {
  width: 2.5rem;
  height: 2.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    background var(--transition-fast);
}

.modal-close:hover,
.modal-close:focus-visible {
  transform: translateY(-0.0625rem);
  border-color: var(--accent-teal);
  background: var(--accent-teal-light);
  outline: none;
}

.modal-body {
  display: grid;
  gap: var(--space-4);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity var(--transition-normal), transform var(--transition-normal);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .modal-panel,
.modal-fade-leave-to .modal-panel {
  transform: translateY(0.75rem);
}
</style>
