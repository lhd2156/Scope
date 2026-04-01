import { createPinia, setActivePinia } from 'pinia';

const { authStoreMock } = vi.hoisted(() => ({
  authStoreMock: {
    isAuthenticated: false,
  },
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

import { ONBOARDING_COMPLETION_STORAGE_KEY, useOnboardingStore } from '@/stores/onboarding';

describe('useOnboardingStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    authStoreMock.isAuthenticated = false;
    localStorage.clear();
  });

  it('returns the public walkthrough by default', () => {
    const onboardingStore = useOnboardingStore();

    expect(onboardingStore.steps.map((step) => step.id)).toEqual([
      'home-hero',
      'create-spot-button',
      'explore-toolbar',
      'map-filters',
    ]);
    expect(onboardingStore.steps[0]).toMatchObject({
      variant: 'welcome',
      showSpotlight: false,
    });
    expect(onboardingStore.steps[0].highlights).toHaveLength(4);
    expect(onboardingStore.steps[1].highlights).toHaveLength(2);
    expect(onboardingStore.totalSteps).toBe(4);
    expect(onboardingStore.hasCompleted).toBe(false);
  });

  it('adds the planner step for authenticated travelers', () => {
    authStoreMock.isAuthenticated = true;
    const onboardingStore = useOnboardingStore();

    expect(onboardingStore.steps.map((step) => step.id)).toEqual([
      'home-hero',
      'create-spot-button',
      'explore-toolbar',
      'map-filters',
      'planner-submit',
    ]);
    expect(onboardingStore.totalSteps).toBe(5);
  });

  it('starts, advances, rewinds, and persists completion when the walkthrough finishes', () => {
    authStoreMock.isAuthenticated = true;
    const onboardingStore = useOnboardingStore();

    expect(onboardingStore.startIfPending()).toBe(true);
    expect(onboardingStore.isActive).toBe(true);
    expect(onboardingStore.activeStep?.id).toBe('home-hero');

    onboardingStore.next();
    expect(onboardingStore.activeStep?.id).toBe('create-spot-button');

    onboardingStore.previous();
    expect(onboardingStore.activeStep?.id).toBe('home-hero');

    onboardingStore.goToStep(4);
    expect(onboardingStore.activeStep?.id).toBe('planner-submit');

    onboardingStore.next();
    expect(onboardingStore.isActive).toBe(false);
    expect(onboardingStore.activeStepIndex).toBe(0);
    expect(onboardingStore.hasCompleted).toBe(true);
    expect(localStorage.getItem(ONBOARDING_COMPLETION_STORAGE_KEY)).toBe('completed');
  });

  it('persists skip state and allows a replay after completion is reset', () => {
    const onboardingStore = useOnboardingStore();

    onboardingStore.start();
    onboardingStore.skip();

    expect(onboardingStore.hasCompleted).toBe(true);
    expect(localStorage.getItem(ONBOARDING_COMPLETION_STORAGE_KEY)).toBe('completed');
    expect(onboardingStore.startIfPending()).toBe(false);

    onboardingStore.resetCompletion();
    expect(onboardingStore.hasCompleted).toBe(false);
    expect(localStorage.getItem(ONBOARDING_COMPLETION_STORAGE_KEY)).toBeNull();

    expect(onboardingStore.restart('map-filters')).toBe(true);
    expect(onboardingStore.isActive).toBe(true);
    expect(onboardingStore.activeStep?.id).toBe('map-filters');
  });
});
