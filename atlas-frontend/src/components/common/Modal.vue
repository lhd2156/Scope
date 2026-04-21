<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="open" class="modal-backdrop" @click="handleBackdropClick">
        <section
          ref="modalPanelRef"
          class="modal-panel glass-panel"
          :class="[`modal-panel--${size}`]"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="bodyId"
          tabindex="-1"
          @click.stop
        >
          <header class="modal-header">
            <div>
              <p v-if="eyebrow" class="modal-eyebrow">{{ eyebrow }}</p>
              <h2 :id="titleId">{{ title }}</h2>
            </div>
            <button type="button" class="modal-close" aria-label="Close modal" @click="$emit('close')">
              <AtlasIcon name="close" label="Close modal" />
            </button>
          </header>
          <div :id="bodyId" class="modal-body">
            <slot />
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';
import AtlasIcon from '@/components/common/AtlasIcon.vue';
import { focusFirstElement, getFocusableElements } from '@/utils/a11y';

let openModalCount = 0;
let previousBodyOverflow = '';

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

const modalPanelRef = ref<HTMLElement | null>(null);
const titleId = `modal-title-${useId()}`;
const bodyId = `modal-body-${useId()}`;
let previouslyFocusedElement: HTMLElement | null = null;

function lockBodyScroll(): void {
  if (typeof document === 'undefined') {
    return;
  }

  if (openModalCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  openModalCount += 1;
}

function unlockBodyScroll(): void {
  if (typeof document === 'undefined' || openModalCount === 0) {
    return;
  }

  openModalCount -= 1;

  if (openModalCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
  }
}

function restoreFocus(): void {
  const focusTarget = previouslyFocusedElement;
  previouslyFocusedElement = null;

  if (!focusTarget?.isConnected) {
    return;
  }

  void nextTick(() => {
    focusTarget.focus();
  });
}

function focusModalPanel(): void {
  if (focusFirstElement(modalPanelRef.value)) {
    return;
  }

  modalPanelRef.value?.focus();
}

function handleBackdropClick() {
  if (props.closeOnBackdrop) {
    emit('close');
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.open) {
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    emit('close');
    return;
  }

  if (event.key !== 'Tab') {
    return;
  }

  const modalPanel = modalPanelRef.value;

  if (!modalPanel) {
    return;
  }

  const focusableElements = getFocusableElements(modalPanel);

  if (!focusableElements.length) {
    event.preventDefault();
    modalPanel.focus();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const activeElement = typeof document === 'undefined' ? null : document.activeElement;
  const isFocusInsidePanel = activeElement instanceof Node && modalPanel.contains(activeElement);

  if (event.shiftKey) {
    if (activeElement === firstElement || activeElement === modalPanel || !isFocusInsidePanel) {
      event.preventDefault();
      lastElement.focus();
    }

    return;
  }

  if (activeElement === lastElement || !isFocusInsidePanel) {
    event.preventDefault();
    firstElement.focus();
  }
}

async function activateModal(): Promise<void> {
  if (typeof document === 'undefined') {
    return;
  }

  previouslyFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  lockBodyScroll();
  window.addEventListener('keydown', handleKeydown);
  await nextTick();
  focusModalPanel();
}

function deactivateModal(): void {
  window.removeEventListener('keydown', handleKeydown);
  unlockBodyScroll();
  restoreFocus();
}

watch(
  () => props.open,
  (isOpen, wasOpen) => {
    if (isOpen) {
      void activateModal();
      return;
    }

    if (wasOpen) {
      deactivateModal();
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (props.open) {
    deactivateModal();
  }
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
  background: color-mix(in srgb, var(--bg-primary) 78%, transparent);
  backdrop-filter: var(--motion-modal-backdrop-blur-active);
  -webkit-backdrop-filter: var(--motion-modal-backdrop-blur-active);
}

.modal-panel {
  width: min(100%, 46rem);
  max-height: min(90vh, 52rem);
  overflow: auto;
  border-radius: var(--radius-2xl);
  padding: var(--space-5);
  z-index: var(--z-modal);
  transition:
    transform var(--transition-normal),
    opacity var(--transition-normal),
    box-shadow var(--transition-normal);
}

.modal-panel:focus-visible {
  outline: 2px solid var(--input-focus);
  outline-offset: 3px;
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
  transform: translateY(var(--motion-button-lift));
  border-color: var(--accent-teal);
  background: var(--accent-teal-light);
  outline: none;
}

.modal-close:active {
  transform: translateY(0) scale(var(--motion-press-scale));
}

.modal-body {
  display: grid;
  gap: var(--space-4);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition:
    opacity var(--transition-normal),
    background var(--transition-normal),
    backdrop-filter var(--transition-normal),
    -webkit-backdrop-filter var(--transition-normal);
}

.modal-fade-enter-active .modal-panel,
.modal-fade-leave-active .modal-panel {
  transition:
    transform var(--transition-normal),
    opacity var(--transition-normal),
    box-shadow var(--transition-normal);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  background: color-mix(in srgb, var(--bg-primary) 18%, transparent);
  backdrop-filter: var(--motion-modal-backdrop-blur-rest);
  -webkit-backdrop-filter: var(--motion-modal-backdrop-blur-rest);
}

.modal-fade-enter-from .modal-panel,
.modal-fade-leave-to .modal-panel {
  opacity: 0;
  transform: translateY(var(--motion-modal-panel-shift)) scale(0.98);
  box-shadow: none;
}

@media (prefers-reduced-motion: reduce) {
  .modal-close,
  .modal-fade-enter-active,
  .modal-fade-leave-active,
  .modal-fade-enter-active .modal-panel,
  .modal-fade-leave-active .modal-panel {
    transition-duration: 1ms;
  }

  .modal-fade-enter-from,
  .modal-fade-leave-to,
  .modal-fade-enter-from .modal-panel,
  .modal-fade-leave-to .modal-panel,
  .modal-close:active {
    transform: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
</style>
