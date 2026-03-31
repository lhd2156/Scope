import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { resolveOnboardingSteps } from '@/config/onboarding';
import { useAuthStore } from '@/stores/auth';

export const useOnboardingStore = defineStore('onboarding', () => {
  const authStore = useAuthStore();
  const isActive = ref(false);
  const activeStepIndex = ref(0);
  const steps = computed(() => resolveOnboardingSteps(authStore.isAuthenticated));
  const activeStep = computed(() => steps.value[activeStepIndex.value] ?? null);
  const totalSteps = computed(() => steps.value.length);

  function start(stepId?: string): void {
    if (!steps.value.length) {
      return;
    }

    const requestedIndex = stepId
      ? steps.value.findIndex((step) => step.id === stepId)
      : 0;

    activeStepIndex.value = requestedIndex >= 0 ? requestedIndex : 0;
    isActive.value = true;
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
    isActive.value = false;
    activeStepIndex.value = 0;
  }

  watch(
    steps,
    (nextSteps) => {
      if (!nextSteps.length) {
        finish();
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
    start,
    next,
    previous,
    finish,
  };
});
