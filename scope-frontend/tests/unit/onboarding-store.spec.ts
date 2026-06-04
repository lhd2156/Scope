import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { ONBOARDING_COMPLETION_STORAGE_KEY, useOnboardingStore } from '@/stores/onboarding';
import { clearStoredAuthSessionHint, persistAuthSessionHint } from '@/utils/authSessionStorage';

describe('useOnboardingStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    clearStoredAuthSessionHint();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock('@/config/onboarding');
    vi.resetModules();
  });

  it('returns the public walkthrough by default', () => {
    const onboardingStore = useOnboardingStore();

    expect(onboardingStore.steps.map((step) => step.id)).toEqual([
      'home-hero',
      'create-spot-button',
      'map-filters',
    ]);
    expect(onboardingStore.steps[0]).toMatchObject({
      variant: 'welcome',
      showSpotlight: false,
    });
    expect(onboardingStore.steps[0].highlights).toHaveLength(4);
    expect(onboardingStore.steps[1].highlights).toHaveLength(2);
    expect(onboardingStore.steps[2]).toMatchObject({
      selector: '[data-onboarding-target="map-stage"]',
      placement: 'left',
      accentSelectors: ['[data-onboarding-target="map-filters"]', '[data-onboarding-target="map-controls"]'],
    });
    expect(onboardingStore.steps[2].highlights).toHaveLength(2);
    expect(onboardingStore.totalSteps).toBe(3);
    expect(onboardingStore.hasCompleted).toBe(false);
  });

  it('keeps replay on the three-step core walkthrough for authenticated travelers', () => {
    persistAuthSessionHint();
    const onboardingStore = useOnboardingStore();

    expect(onboardingStore.steps.map((step) => step.id)).toEqual([
      'home-hero',
      'create-spot-button',
      'map-filters',
    ]);
    expect(onboardingStore.totalSteps).toBe(3);
  });

  it('hydrates completion from localStorage and keeps auto-start disabled until replay', () => {
    localStorage.setItem(ONBOARDING_COMPLETION_STORAGE_KEY, 'completed');

    const onboardingStore = useOnboardingStore();

    expect(onboardingStore.hasCompleted).toBe(true);
    expect(onboardingStore.startIfPending()).toBe(false);
    expect(onboardingStore.isActive).toBe(false);

    expect(onboardingStore.restart('home-hero')).toBe(true);
    expect(onboardingStore.hasCompleted).toBe(false);
    expect(localStorage.getItem(ONBOARDING_COMPLETION_STORAGE_KEY)).toBeNull();
    expect(onboardingStore.isActive).toBe(true);
    expect(onboardingStore.activeStep?.id).toBe('home-hero');
  });

  it('starts, advances, rewinds, and persists completion when the walkthrough finishes', () => {
    persistAuthSessionHint();
    const onboardingStore = useOnboardingStore();

    expect(onboardingStore.startIfPending()).toBe(true);
    expect(onboardingStore.isActive).toBe(true);
    expect(onboardingStore.activeStep?.id).toBe('home-hero');

    onboardingStore.next();
    expect(onboardingStore.activeStep?.id).toBe('create-spot-button');

    onboardingStore.previous();
    expect(onboardingStore.activeStep?.id).toBe('home-hero');

    onboardingStore.goToStep(2);
    expect(onboardingStore.activeStep?.id).toBe('map-filters');

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

  it('keeps the in-memory walkthrough usable when persisted storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('remove blocked');
    });

    const onboardingStore = useOnboardingStore();

    expect(onboardingStore.hasCompleted).toBe(false);
    expect(onboardingStore.start()).toBe(true);

    onboardingStore.finish();
    expect(onboardingStore.hasCompleted).toBe(true);

    onboardingStore.resetCompletion();
    expect(onboardingStore.hasCompleted).toBe(false);
  });

  it('ignores navigation calls while inactive and unregisters session hint listeners on dispose', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const onboardingStore = useOnboardingStore();

    onboardingStore.goToStep(2);
    onboardingStore.next();
    onboardingStore.previous();

    expect(onboardingStore.activeStepIndex).toBe(0);

    onboardingStore.start('missing-step-id');
    expect(onboardingStore.activeStep?.id).toBe('home-hero');

    onboardingStore.$dispose();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('scope-auth-session-hint-change', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));
  });

  it('handles empty and shrinking configured walkthrough step lists', async () => {
    vi.resetModules();
    vi.doMock('@/config/onboarding', () => ({
      resolveOnboardingSteps: (hasSessionHint: boolean) => (hasSessionHint
        ? [
            {
              id: 'first',
              routeName: 'home',
              selector: '[data-test="first"]',
              eyebrow: 'First',
              title: 'First step',
              description: 'First step.',
              placement: 'center',
              ctaLabel: 'Next',
            },
            {
              id: 'second',
              routeName: 'map',
              selector: '[data-test="second"]',
              eyebrow: 'Second',
              title: 'Second step',
              description: 'Second step.',
              placement: 'left',
              ctaLabel: 'Done',
            },
          ]
        : []),
    }));

    persistAuthSessionHint();
    setActivePinia(createPinia());
    const { useOnboardingStore: useMockedOnboardingStore } = await import('@/stores/onboarding');
    const onboardingStore = useMockedOnboardingStore();

    expect(onboardingStore.start('second')).toBe(true);
    expect(onboardingStore.activeStep?.id).toBe('second');

    clearStoredAuthSessionHint();
    await nextTick();

    expect(onboardingStore.isActive).toBe(false);
    expect(onboardingStore.activeStep).toBeNull();
    expect(onboardingStore.start()).toBe(false);
  });
});
