import { defineComponent } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import { flushPromises, mount } from '@vue/test-utils';

import OnboardingOverlay from '@/components/common/OnboardingOverlay.vue';
import {
  ONBOARDING_COMPLETION_STORAGE_KEY,
  ONBOARDING_DISMISSED_STORAGE_KEY,
  useOnboardingStore,
} from '@/stores/onboarding';
import { clearStoredAuthSessionHint, persistAuthSessionHint } from '@/utils/authSessionStorage';

const spotlightRects: Record<string, { top: number; left: number; width: number; height: number }> = {
  'home-hero': { top: 120, left: 120, width: 520, height: 280 },
  'create-spot-button': { top: 28, left: 860, width: 168, height: 48 },
  'map-filters': { top: 128, left: 56, width: 320, height: 260 },
  'map-stage': { top: 128, left: 408, width: 760, height: 560 },
  'map-controls': { top: 620, left: 1060, width: 72, height: 232 },
  'planner-shell': { top: 144, left: 84, width: 452, height: 676 },
  'planner-submit': { top: 728, left: 152, width: 312, height: 56 },
  'itinerary-stage': { top: 144, left: 592, width: 604, height: 676 },
  'social-hub': { top: 232, left: 120, width: 820, height: 220 },
  'friends-hub-button': { top: 308, left: 780, width: 176, height: 44 },
  'activity-feed-list': { top: 488, left: 120, width: 704, height: 360 },
};

const HomeRoute = {
  template: `
    <div>
      <section data-onboarding-target="home-hero">Home hero</section>
      <section data-onboarding-target="social-hub">
        <button data-onboarding-target="friends-hub-button">Open Friends hub</button>
      </section>
      <div data-onboarding-target="activity-feed-list">Live activity feed</div>
    </div>
  `,
};
const ExploreRoute = { template: '<section>Explore toolbar</section>' };
const MapRoute = {
  template: `
    <div>
      <section data-onboarding-target="map-filters">Map filters</section>
      <main data-onboarding-target="map-stage">Map canvas</main>
      <aside data-onboarding-target="map-controls">Map controls</aside>
    </div>
  `,
};
const TripPlannerRoute = {
  template: `
    <div class="planner-route-stub">
      <section data-onboarding-target="planner-shell">
        <button data-onboarding-target="planner-submit">Generate AI itinerary</button>
      </section>
      <aside data-onboarding-target="itinerary-stage">Live AI preview</aside>
    </div>
  `,
};
const Shell = defineComponent({
  components: {
    RouterView,
    OnboardingOverlay,
  },
  template: '<div><button data-onboarding-target="create-spot-button">Create spot</button><RouterView /><OnboardingOverlay /></div>',
});
const TransitionStub = { template: '<slot />' };

function buildRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: HomeRoute },
      { path: '/explore', name: 'explore', component: ExploreRoute },
      { path: '/map', name: 'map', component: MapRoute },
      { path: '/trips/new', name: 'trip-planner', component: TripPlannerRoute },
    ],
  });
}

function toDomRect(bounds: { top: number; left: number; width: number; height: number }): DOMRect {
  return {
    ...bounds,
    right: bounds.left + bounds.width,
    bottom: bounds.top + bounds.height,
    x: bounds.left,
    y: bounds.top,
    toJSON: () => bounds,
  } as DOMRect;
}

async function settleOnboarding() {
  await flushPromises();
  await new Promise((resolve) => window.setTimeout(resolve, 620));
  await flushPromises();
}

describe('OnboardingOverlay', () => {
  let activeWrapper: ReturnType<typeof mount> | null = null;

  beforeAll(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1280,
      writable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
      writable: true,
    });

    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    setActivePinia(createPinia());
    document.body.innerHTML = '';
    localStorage.clear();
    clearStoredAuthSessionHint();
    persistAuthSessionHint();

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getBoundingClientRect() {
      const targetKey = (this as HTMLElement).dataset.onboardingTarget;
      if (targetKey && spotlightRects[targetKey]) {
        return toDomRect(spotlightRects[targetKey]);
      }

      return toDomRect({ top: 0, left: 0, width: 0, height: 0 });
    });
  });

  afterEach(() => {
    activeWrapper?.unmount();
    activeWrapper = null;
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1280,
      writable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
      writable: true,
    });
  });

  it('renders the premium welcome intro with feature highlights and progress dots', async () => {
    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    activeWrapper = mount(Shell, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          teleport: true,
          Transition: TransitionStub,
        },
      },
    });
    const wrapper = activeWrapper;

    const onboardingStore = useOnboardingStore();
    onboardingStore.start();
    await settleOnboarding();

    expect(wrapper.text()).toContain('Plan the day before you go');
    expect(wrapper.text()).toContain('Step 1 of 3');
    expect(wrapper.text()).toContain('Save real places');
    expect(wrapper.text()).toContain('Use the map');
    expect(wrapper.text()).toContain('Build routes');
    expect(wrapper.text()).toContain('Share taste');
    expect(wrapper.find('.onboarding-overlay__card--welcome').exists()).toBe(true);
    expect(wrapper.find('.onboarding-overlay__spotlight').exists()).toBe(false);
    expect(wrapper.findAll('[data-test="onboarding-feature-card"]')).toHaveLength(4);
    expect(wrapper.findAll('.onboarding-overlay__progress-dot')).toHaveLength(3);
    expect(wrapper.findAll('.onboarding-overlay__progress-dot.is-active')).toHaveLength(1);
    expect(wrapper.find('.onboarding-overlay__skip').exists()).toBe(true);
  });

  it('jumps to a selected step when a progress dot is activated', async () => {
    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    activeWrapper = mount(Shell, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          teleport: true,
          Transition: TransitionStub,
        },
      },
    });
    const wrapper = activeWrapper;

    const onboardingStore = useOnboardingStore();
    onboardingStore.start();
    await settleOnboarding();

    await wrapper.findAll('.onboarding-overlay__progress-dot')[2].trigger('click');
    await settleOnboarding();

    expect(router.currentRoute.value.name).toBe('map');
    expect(wrapper.text()).toContain('Filter the live map');
    expect(wrapper.text()).toContain('Move fast');
    expect(wrapper.text()).toContain('Filter lanes');
    expect(wrapper.get('[data-onboarding-target="map-filters"]').attributes('data-onboarding-active')).toBe('true');
    expect(wrapper.get('[data-onboarding-target="map-stage"]').attributes('data-onboarding-active')).toBe('true');
    expect(wrapper.get('[data-onboarding-target="map-controls"]').attributes('data-onboarding-active')).toBe('true');
  });

  it('accents the create-spot CTA before routing into the later walkthrough steps', async () => {
    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    activeWrapper = mount(Shell, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          teleport: true,
          Transition: TransitionStub,
        },
      },
    });
    const wrapper = activeWrapper;

    const onboardingStore = useOnboardingStore();
    onboardingStore.start();
    await settleOnboarding();

    await wrapper.get('.button.button-primary').trigger('click');
    await settleOnboarding();

    expect(router.currentRoute.value.name).toBe('home');
    expect(wrapper.text()).toContain('Save places fast');
    expect(wrapper.text()).toContain('Add a photo');
    expect(wrapper.get('[data-onboarding-target="create-spot-button"]').attributes('data-onboarding-active')).toBe('true');
    expect(wrapper.find('.onboarding-overlay__spotlight').exists()).toBe(false);

    await wrapper.get('.button.button-primary').trigger('click');
    await settleOnboarding();

    expect(router.currentRoute.value.name).toBe('map');
    expect(wrapper.text()).toContain('Filter the live map');
  });

  it('falls back to the first core step when a retired extended step is requested', async () => {
    const router = buildRouter();
    await router.push('/trips/new');
    await router.isReady();

    activeWrapper = mount(Shell, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          teleport: true,
          Transition: TransitionStub,
        },
      },
    });
    const wrapper = activeWrapper;

    const onboardingStore = useOnboardingStore();
    onboardingStore.start('social-hub');
    await settleOnboarding();

    expect(router.currentRoute.value.name).toBe('home');
    expect(wrapper.text()).toContain('Plan the day before you go');
    expect(wrapper.text()).toContain('Step 1 of 3');
    expect(wrapper.findAll('.onboarding-overlay__progress-dot')).toHaveLength(3);
  });

  it('closes the walkthrough if route navigation fails', async () => {
    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    activeWrapper = mount(Shell, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          teleport: true,
          Transition: TransitionStub,
        },
      },
    });

    const onboardingStore = useOnboardingStore();
    const pushSpy = vi.spyOn(router, 'push').mockRejectedValueOnce(new Error('navigation blocked'));

    onboardingStore.start('map-filters');
    await settleOnboarding();

    expect(pushSpy).toHaveBeenCalledWith({ name: 'map' });
    expect(onboardingStore.isActive).toBe(false);
    expect(document.body.querySelector('.onboarding-overlay__card')).toBeNull();
  });

  it('skips the overlay and persists completion when the traveler dismisses the tour', async () => {
    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    activeWrapper = mount(Shell, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          teleport: true,
          Transition: TransitionStub,
        },
      },
    });
    const wrapper = activeWrapper;

    const onboardingStore = useOnboardingStore();
    onboardingStore.start();
    await settleOnboarding();

    await wrapper.get('.onboarding-overlay__skip').trigger('click');
    await settleOnboarding();

    expect(onboardingStore.isActive).toBe(false);
    expect(onboardingStore.hasCompleted).toBe(false);
    expect(onboardingStore.hasDismissed).toBe(true);
    expect(localStorage.getItem(ONBOARDING_COMPLETION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(ONBOARDING_DISMISSED_STORAGE_KEY)).toBe('dismissed');
    expect(document.body.querySelector('.onboarding-overlay__card')).toBeNull();
  });

  it('supports keyboard navigation, backtracking, and finishing the final step', async () => {
    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    activeWrapper = mount(Shell, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          teleport: true,
          Transition: TransitionStub,
        },
      },
    });
    const wrapper = activeWrapper;
    const onboardingStore = useOnboardingStore();

    onboardingStore.start();
    await settleOnboarding();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await settleOnboarding();
    expect(onboardingStore.activeStepIndex).toBe(1);
    expect(wrapper.text()).toContain('Save places fast');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await settleOnboarding();
    expect(onboardingStore.activeStepIndex).toBe(0);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await settleOnboarding();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await settleOnboarding();
    expect(router.currentRoute.value.name).toBe('map');
    expect(wrapper.text()).toContain('Filter the live map');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await settleOnboarding();

    expect(onboardingStore.isActive).toBe(false);
    expect(onboardingStore.hasCompleted).toBe(true);
  });

  it('refreshes standalone, mobile, and missing-target layouts from window events', async () => {
    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    activeWrapper = mount(Shell, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          teleport: true,
          Transition: TransitionStub,
        },
      },
    });
    const wrapper = activeWrapper;
    const onboardingStore = useOnboardingStore();

    onboardingStore.start('create-spot-button');
    await settleOnboarding();
    expect(wrapper.find('.onboarding-overlay__spotlight').exists()).toBe(false);
    expect(wrapper.get('[data-onboarding-target="create-spot-button"]').attributes('data-onboarding-active')).toBe('true');

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 640,
      writable: true,
    });
    window.dispatchEvent(new Event('resize'));
    await flushPromises();
    expect((wrapper.get('.onboarding-overlay__card').element as HTMLElement).style.bottom).toBe('16px');

    onboardingStore.goToStep(2);
    await settleOnboarding();

    document
      .querySelectorAll('[data-onboarding-target="map-stage"]')
      .forEach((target) => target.remove());
    document.dispatchEvent(new Event('scroll', { bubbles: true }));
    window.dispatchEvent(new Event('scroll'));
    await flushPromises();

    expect(router.currentRoute.value.name).toBe('map');
    expect(wrapper.find('.onboarding-overlay__spotlight').exists()).toBe(false);
    expect(wrapper.get('[data-onboarding-target="map-filters"]').attributes('data-onboarding-active')).toBe('true');
  });

  it('exercises exposed overlay positioning, target, and keyboard coverage helpers', async () => {
    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    activeWrapper = mount(Shell, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          teleport: true,
          Transition: TransitionStub,
        },
      },
    });
    const wrapper = activeWrapper;
    const overlay = wrapper.findComponent(OnboardingOverlay);
    const coverage = (
      (overlay.vm as any).__coverage ??
      (overlay.vm as any).$?.exposed?.__coverage
    ) as Record<string, any>;
    const onboardingStore = useOnboardingStore();

    onboardingStore.start('home-hero');
    await settleOnboarding();

    const hero = wrapper.get('[data-onboarding-target="home-hero"]').element as HTMLElement;
    const hidden = document.createElement('button');
    hidden.style.display = 'none';
    document.body.appendChild(hidden);

    expect(coverage.clamp(20, 0, 10)).toBe(10);
    expect(coverage.resolveCardMaxWidth()).toBe(408);
    expect(coverage.isTargetVisible(hero)).toBe(true);
    expect(coverage.isTargetVisible(hidden)).toBe(false);
    expect(coverage.findVisibleTarget('[data-onboarding-target="home-hero"]')).toBe(hero);
    expect(coverage.resolveVisibleTargets([
      '[data-onboarding-target="home-hero"]',
      '[data-onboarding-target="missing"]',
    ])).toEqual([hero]);

    coverage.setDocumentScrollLock(true);
    expect(document.body.classList.contains('scope-onboarding-lock')).toBe(true);
    coverage.setDocumentScrollLock(false);
    expect(document.body.classList.contains('scope-onboarding-lock')).toBe(false);

    const measured = coverage.measureElement(hero);
    expect(measured.width).toBeGreaterThan(0);
    expect(coverage.resolveFallbackCardPosition().width).toBeGreaterThan(0);
    expect(coverage.resolveStandaloneCardPosition().width).toBeGreaterThan(0);
    expect(coverage.resolveDefaultCardPosition().width).toBeGreaterThan(0);
    expect(coverage.resolveEstimatedCardHeight()).toBeGreaterThan(0);
    expect(coverage.resolveCardPosition({ top: 24, left: 24, width: 80, height: 80 }).width).toBeGreaterThan(0);
    expect(coverage.cardStyle).toBeTruthy();
    expect(coverage.spotlightStyle).toBeTruthy();

    onboardingStore.goToStep(2);
    await settleOnboarding();
    const placementRect = { top: 320, left: 420, width: 180, height: 120 };
    for (const placement of ['top', 'right', 'bottom', 'left', 'center']) {
      (onboardingStore.steps[onboardingStore.activeStepIndex] as any).placement = placement;
      const position = coverage.resolveCardPosition(placementRect);
      expect(position.width, placement).toBeGreaterThan(0);
    }

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 620,
      writable: true,
    });
    expect(coverage.resolveCardPosition(placementRect).bottom).toBe(16);
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1280,
      writable: true,
    });

    coverage.setActiveTargets([hero]);
    expect(hero.getAttribute('data-onboarding-active')).toBe('true');
    coverage.setActiveTargets([]);
    expect(hero.hasAttribute('data-onboarding-active')).toBe(false);

    hidden.style.display = '';
    hidden.style.visibility = 'hidden';
    hidden.getBoundingClientRect = () => toDomRect({ top: 10, left: 10, width: 40, height: 40 });
    expect(coverage.isTargetVisible(hidden)).toBe(false);

    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    coverage.handleKeydown(escapeEvent);
    expect(escapeEvent.defaultPrevented).toBe(true);
    expect(onboardingStore.isActive).toBe(false);

    coverage.refreshLayout();
    onboardingStore.start('home-hero');
    await settleOnboarding();
    coverage.handleDotSelect(0);
    coverage.handleAdvance();
    expect(onboardingStore.activeStepIndex).toBeGreaterThan(0);
    coverage.handleSkip();
    expect(onboardingStore.isActive).toBe(false);

    expect(coverage.resolveDefaultCardPosition().width).toBeGreaterThan(0);
    const inactiveKey = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    coverage.handleKeydown(inactiveKey);
    expect(inactiveKey.defaultPrevented).toBe(false);
    await router.push('/explore');
    await flushPromises();

    onboardingStore.start('map-filters');
    await coverage.syncPresentation();
    await settleOnboarding();
    expect(router.currentRoute.value.name).toBe('map');
    expect(wrapper.find('.onboarding-overlay__spotlight').exists()).toBe(true);
    const spotlightStyleValue = coverage.spotlightStyle.value ?? coverage.spotlightStyle;
    expect(spotlightStyleValue).toMatchObject({
      top: expect.stringMatching(/px$/),
      left: expect.stringMatching(/px$/),
      width: expect.stringMatching(/px$/),
      height: expect.stringMatching(/px$/),
    });
    coverage.refreshLayout();
    expect(wrapper.get('[data-onboarding-target="map-stage"]').attributes('data-onboarding-active')).toBe('true');

    const mapStage = wrapper.get('[data-onboarding-target="map-stage"]').element as HTMLElement;
    mapStage.scrollIntoView = vi.fn(() => {
      mapStage.remove();
    });
    await coverage.syncPresentation();
    await flushPromises();
    expect(wrapper.find('.onboarding-overlay__spotlight').exists()).toBe(false);
    expect(wrapper.get('[data-onboarding-target="map-filters"]').attributes('data-onboarding-active')).toBe('true');

    coverage.refreshLayout();
    expect(wrapper.find('.onboarding-overlay__spotlight').exists()).toBe(false);
    expect(wrapper.get('[data-onboarding-target="map-filters"]').attributes('data-onboarding-active')).toBe('true');

    await coverage.syncPresentation();
    await flushPromises();
    expect(wrapper.find('.onboarding-overlay__spotlight').exists()).toBe(false);

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 360,
      writable: true,
    });
    expect(coverage.resolveCardPosition({
      top: 4,
      left: 4,
      width: 780,
      height: 340,
    }).width).toBeGreaterThan(0);
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
      writable: true,
    });

    onboardingStore.close();
    await coverage.syncPresentation();
    coverage.refreshLayout();
    expect(wrapper.find('.onboarding-overlay__spotlight').exists()).toBe(false);

    vi.useFakeTimers();
    try {
      const missingTarget = coverage.waitForTarget('[data-onboarding-target="missing-target"]');
      await vi.advanceTimersByTimeAsync(1_000);
      await expect(missingTarget).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  }, 20_000);

  it('covers defensive document/window guards and real back-button navigation', async () => {
    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    activeWrapper = mount(Shell, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          teleport: true,
          Transition: TransitionStub,
        },
      },
    });
    const wrapper = activeWrapper;
    const overlay = wrapper.findComponent(OnboardingOverlay);
    const coverage = (
      (overlay.vm as any).__coverage ??
      (overlay.vm as any).$?.exposed?.__coverage
    ) as Record<string, any>;
    const onboardingStore = useOnboardingStore();

    onboardingStore.start('home-hero');
    await settleOnboarding();
    coverage.handleAdvance();
    await settleOnboarding();

    const backButton = wrapper.findAll('button').find((button) => button.text() === 'Back');
    expect(backButton?.exists()).toBe(true);
    await backButton!.trigger('click');
    await settleOnboarding();
    expect(onboardingStore.activeStepIndex).toBe(0);

    const originalDocument = document;
    vi.stubGlobal('document', undefined);
    expect(() => coverage.setDocumentScrollLock(true)).not.toThrow();
    vi.stubGlobal('document', originalDocument);

    const originalWindow = window;
    const target = wrapper.get('[data-onboarding-target="home-hero"]').element as HTMLElement;
    vi.stubGlobal('window', undefined);
    expect(coverage.isTargetVisible(target)).toBe(true);
    vi.stubGlobal('window', originalWindow);

    onboardingStore.goToStep(2);
    await settleOnboarding();
    expect(router.currentRoute.value.name).toBe('map');
    expect(coverage.resolveDefaultCardPosition().width).toBeGreaterThan(0);

    (onboardingStore.steps[onboardingStore.activeStepIndex] as any).placement = 'top';
    const topPlacement = coverage.resolveCardPosition({ top: 460, left: 420, width: 180, height: 120 });
    expect(topPlacement.top).toBeLessThan(460);

    const firstSync = coverage.syncPresentation();
    const secondSync = coverage.syncPresentation();
    await Promise.all([firstSync, secondSync]);
    expect(wrapper.find('.onboarding-overlay__card').exists()).toBe(true);
  });
});
