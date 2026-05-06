import { computed, onScopeDispose, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { resolveOnboardingSteps } from '@/config/onboarding';
import { AUTH_SESSION_HINT_CHANGE_EVENT, hasStoredAuthSessionHint } from '@/utils/authSessionStorage';

export const ONBOARDING_COMPLETION_STORAGE_KEY = 'scope-onboarding-completed-v1';
const ONBOARDING_COMPLETION_VALUE = 'completed';

function readPersistedCompletion(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_COMPLETION_STORAGE_KEY) === ONBOARDING_COMPLETION_VALUE;
  } catch {
    return false;
  }
}

function writePersistedCompletion(isCompleted: boolean): void {
  try {
    if (isCompleted) {
      localStorage.setItem(ONBOARDING_COMPLETION_STORAGE_KEY, ONBOARDING_COMPLETION_VALUE);
      return;
    }

    localStorage.removeItem(ONBOARDING_COMPLETION_STORAGE_KEY);
  } catch {
    // Ignore storage failures and keep the in-memory onboarding state usable.
  }
}

export const useOnboardingStore = defineStore('onboarding', () => {
  const isActive = ref(false);
  const activeStepIndex = ref(0);
  const hasCompleted = ref(readPersistedCompletion());
  const hasStartedThisSession = ref(false);
  const hasSessionHint = ref(hasStoredAuthSessionHint());
  const steps = computed(() => resolveOnboardingSteps(hasSessionHint.value));
  const activeStep = computed(() => steps.value[activeStepIndex.value] ?? null);
  const totalSteps = computed(() => steps.value.length);

  function resolveRequestedIndex(stepId?: string): number {
    if (!steps.value.length) {
      return 0;
    }

    const requestedIndex = stepId
      ? steps.value.findIndex((step) => step.id === stepId)
      : 0;

    return requestedIndex >= 0 ? requestedIndex : 0;
  }

  function close(): void {
    isActive.value = false;
    activeStepIndex.value = 0;
  }

  function persistCompletion(): void {
    hasCompleted.value = true;
    writePersistedCompletion(true);
  }

  function start(stepId?: string): boolean {
    if (!steps.value.length) {
      return false;
    }

    activeStepIndex.value = resolveRequestedIndex(stepId);
    hasStartedThisSession.value = true;
    isActive.value = true;
    return true;
  }

  function startIfPending(stepId?: string): boolean {
    if (hasCompleted.value || hasStartedThisSession.value || isActive.value) {
      return false;
    }

    return start(stepId);
  }

  function goToStep(stepIndex: number): void {
    if (!isActive.value || !steps.value.length) {
      return;
    }

    activeStepIndex.value = Math.min(Math.max(stepIndex, 0), steps.value.length - 1);
  }

  function next(): void {
    if (!isActive.value) {
      return;
    }

    if (activeStepIndex.value >= steps.value.length - 1) {
      finish();
      return;
    }

    activeStepIndex.value += 1;
  }

  function previous(): void {
    if (!isActive.value) {
      return;
    }

    activeStepIndex.value = Math.max(0, activeStepIndex.value - 1);
  }

  function finish(): void {
    persistCompletion();
    close();
  }

  function skip(): void {
    persistCompletion();
    close();
  }

  function resetCompletion(): void {
    hasCompleted.value = false;
    writePersistedCompletion(false);
  }

  function restart(stepId?: string): boolean {
    resetCompletion();
    return start(stepId);
  }

  function syncSessionHint(): void {
    hasSessionHint.value = hasStoredAuthSessionHint();
  }

  if (typeof window !== 'undefined') {
    window.addEventListener(AUTH_SESSION_HINT_CHANGE_EVENT, syncSessionHint);
    window.addEventListener('storage', syncSessionHint);

    onScopeDispose(() => {
      window.removeEventListener(AUTH_SESSION_HINT_CHANGE_EVENT, syncSessionHint);
      window.removeEventListener('storage', syncSessionHint);
    });
  }

  watch(
    steps,
    (nextSteps) => {
      if (!nextSteps.length) {
        close();
        return;
      }

      if (activeStepIndex.value > nextSteps.length - 1) {
        activeStepIndex.value = nextSteps.length - 1;
      }
    },
    { immediate: true },
  );

  return {
    isActive,
    activeStepIndex,
    activeStep,
    steps,
    totalSteps,
    hasCompleted,
    start,
    startIfPending,
    goToStep,
    next,
    previous,
    close,
    finish,
    skip,
    resetCompletion,
    restart,
  };
});
