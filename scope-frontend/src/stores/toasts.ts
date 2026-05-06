import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { ToastItem, ToastPayload, ToastTone } from '@/types';

interface ManagedToast extends ToastItem {
  onClose?: () => void;
}

interface ToastInput extends ToastPayload {
  onClose?: () => void;
}

interface DismissToastOptions {
  invokeOnClose?: boolean;
}

const DEFAULT_AUTO_HIDE_MS = 4_000;
const MAX_VISIBLE_TOASTS = 4;
let toastSequence = 0;

function createToastId(): string {
  toastSequence += 1;
  return `toast-${toastSequence}`;
}

function normalizeAutoHideMs(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_AUTO_HIDE_MS;
  }

  return Math.max(0, value);
}

function normalizeTone(value: ToastTone | undefined): ToastTone {
  return value ?? 'info';
}

function normalizeCopy(value: string, fallback: string): string {
  const normalizedValue = value.trim();
  return normalizedValue || fallback;
}

export const useToastStore = defineStore('toasts', () => {
  const items = ref<ManagedToast[]>([]);
  const hasToasts = computed(() => items.value.length > 0);

  function pushToast(input: ToastInput): string {
    const nextToast: ManagedToast = {
      id: createToastId(),
      title: normalizeCopy(input.title, 'Scope update'),
      message: normalizeCopy(input.message, 'Your latest Scope update is ready.'),
      tone: normalizeTone(input.tone),
      autoHideMs: normalizeAutoHideMs(input.autoHideMs),
      onClose: input.onClose,
    };

    items.value = [nextToast, ...items.value];

    if (items.value.length > MAX_VISIBLE_TOASTS) {
      const overflowToasts = items.value.splice(MAX_VISIBLE_TOASTS);
      overflowToasts.forEach((toast) => toast.onClose?.());
    }

    return nextToast.id;
  }

  function dismissToast(id: string, options: DismissToastOptions = {}): void {
    const toastIndex = items.value.findIndex((toast) => toast.id === id);
    if (toastIndex === -1) {
      return;
    }

    const [removedToast] = items.value.splice(toastIndex, 1);

    if (options.invokeOnClose ?? true) {
      removedToast?.onClose?.();
    }
  }

  function clearToasts(options: DismissToastOptions = {}): void {
    const activeToasts = [...items.value];
    items.value = [];

    if (options.invokeOnClose ?? true) {
      activeToasts.forEach((toast) => toast.onClose?.());
    }
  }

  function showSuccess(input: Omit<ToastInput, 'tone'>): string {
    return pushToast({
      ...input,
      tone: 'success',
    });
  }

  function showError(input: Omit<ToastInput, 'tone'>): string {
    return pushToast({
      ...input,
      tone: 'error',
    });
  }

  function showInfo(input: Omit<ToastInput, 'tone'>): string {
    return pushToast({
      ...input,
      tone: 'info',
    });
  }

  return {
    items,
    hasToasts,
    pushToast,
    dismissToast,
    clearToasts,
    showSuccess,
    showError,
    showInfo,
  };
});
