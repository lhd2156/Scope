import { createPinia, setActivePinia } from 'pinia';

const { authStoreMock } = vi.hoisted(() => ({
  authStoreMock: {
    isAuthenticated: false,
  },
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

import { useOnboardingStore } from '@/stores/onboarding';

describe('useOnboardingStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    authStoreMock.isAuthenticated = false;
  });

  it('returns the public walkthrough by default', () => {
    const onboardingStore = useOnboardingStore();

    expect(onboardingStore.steps.map((step) => step.id)).toEqual([
      'home-hero',
      'explore-toolbar',
      'map-filters',
    ]);
    expect(onboardingStore.totalSteps).toBe(3);
  });

  it('adds the planner step for authenticated travelers', () => {
    authStoreMock.isAuthenticated = true;
    const onboardingStore = useOnboardingStore();

    expect(onboardingStore.steps.map((step) => step.id)).toEqual([
      'home-hero',
      'explore-toolbar',
      'map-filters',
      'planner-submit',
    ]);
    expect(onboardingStore.totalSteps).toBe(4);
  });

  it('starts, advances, rewinds, and finishes the walkthrough', () => {
    authStoreMock.isAuthenticated = true;
    const onboardingStore = useOnboardingStore();

    onboardingStore.start();
    expect(onboardingStore.isActive).toBe(true);
    expect(onboardingStore.activeStep?.id).toBe('home-hero');

    onboardingStore.next();
    expect(onboardingStore.activeStep?.id).toBe('explore-toolbar');

    onboardingStore.previous();
    expect(onboardingStore.activeStep?.id).toBe('home-hero');

    onboardingStore.start('planner-submit');
    expect(onboardingStore.activeStep?.id).toBe('planner-submit');

    onboardingStore.next();
    expect(onboardingStore.isActive).toBe(false);
    expect(onboardingStore.activeStepIndex).toBe(0);
  });
});
