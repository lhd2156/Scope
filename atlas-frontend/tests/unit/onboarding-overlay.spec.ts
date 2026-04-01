import { defineComponent } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import { flushPromises, mount } from '@vue/test-utils';

const { authStoreMock } = vi.hoisted(() => ({
  authStoreMock: {
    isAuthenticated: true,
  },
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

import OnboardingOverlay from '@/components/common/OnboardingOverlay.vue';
import { ONBOARDING_COMPLETION_STORAGE_KEY, useOnboardingStore } from '@/stores/onboarding';

const spotlightRects: Record<string, { top: number; left: number; width: number; height: number }> = {
  'home-hero': { top: 120, left: 120, width: 520, height: 280 },
  'create-spot-button': { top: 28, left: 860, width: 168, height: 48 },
  'explore-toolbar': { top: 140, left: 140, width: 640, height: 96 },
  'map-filters': { top: 128, left: 56, width: 320, height: 260 },
  'map-controls': { top: 620, left: 1060, width: 72, height: 232 },
  'planner-shell': { top: 144, left: 84, width: 452, height: 676 },
  'planner-submit': { top: 728, left: 152, width: 312, height: 56 },
  'itinerary-stage': { top: 144, left: 592, width: 604, height: 676 },
};

const HomeRoute = { template: '<section data-onboarding-target="home-hero">Home hero</section>' };
const ExploreRoute = { template: '<section data-onboarding-target="explore-toolbar">Explore toolbar</section>' };
const MapRoute = {
  template: `
    <div>
      <section data-onboarding-target="map-filters">Map filters</section>
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
  await new Promise((resolve) => window.setTimeout(resolve, 220));
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
    authStoreMock.isAuthenticated = true;
    localStorage.clear();

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
          transition: false,
        },
      },
    });
    const wrapper = activeWrapper;

    const onboardingStore = useOnboardingStore();
    onboardingStore.start();
    await settleOnboarding();

    expect(wrapper.text()).toContain('Map every adventure before you ever leave home');
    expect(wrapper.text()).toContain('Step 1 of 5');
    expect(wrapper.text()).toContain('Drop memorable pins');
    expect(wrapper.text()).toContain('Explore the live map');
    expect(wrapper.text()).toContain('Plan with Atlas Intel');
    expect(wrapper.text()).toContain('Travel with your crew');
    expect(wrapper.find('.onboarding-overlay__card--welcome').exists()).toBe(true);
    expect(wrapper.find('.onboarding-overlay__spotlight').exists()).toBe(false);
    expect(wrapper.findAll('[data-test="onboarding-feature-card"]')).toHaveLength(4);
    expect(wrapper.findAll('.onboarding-overlay__progress-dot')).toHaveLength(5);
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
          transition: false,
        },
      },
    });
    const wrapper = activeWrapper;

    const onboardingStore = useOnboardingStore();
    onboardingStore.start();
    await settleOnboarding();

    await wrapper.findAll('.onboarding-overlay__progress-dot')[3].trigger('click');
    await settleOnboarding();

    expect(router.currentRoute.value.name).toBe('map');
    expect(wrapper.text()).toContain('Guide the canvas with controls and category lanes');
    expect(wrapper.text()).toContain('Move the map fast');
    expect(wrapper.text()).toContain('Filter by mood');
    expect(wrapper.get('[data-onboarding-target="map-filters"]').attributes('data-onboarding-active')).toBe('true');
    expect(wrapper.get('[data-onboarding-target="map-controls"]').attributes('data-onboarding-active')).toBe('true');
  });

  it('highlights the create-spot CTA before routing into the later walkthrough steps', async () => {
    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    activeWrapper = mount(Shell, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          teleport: true,
          transition: false,
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
    expect(wrapper.text()).toContain('Capture the places worth sharing');
    expect(wrapper.text()).toContain('Add visual proof');
    expect(wrapper.get('[data-onboarding-target="create-spot-button"]').attributes('data-onboarding-active')).toBe('true');
    expect(wrapper.find('.onboarding-overlay__spotlight').exists()).toBe(true);

    await wrapper.get('.button.button-primary').trigger('click');
    await settleOnboarding();

    expect(router.currentRoute.value.name).toBe('explore');
    expect(wrapper.text()).toContain('Refine the shortlist in Explore');
  });

  it('routes into the trip planner step and accents the planner plus AI preview surfaces', async () => {
    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    activeWrapper = mount(Shell, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          teleport: true,
          transition: false,
        },
      },
    });
    const wrapper = activeWrapper;

    const onboardingStore = useOnboardingStore();
    onboardingStore.start();
    await settleOnboarding();

    await wrapper.findAll('.onboarding-overlay__progress-dot')[4].trigger('click');
    await settleOnboarding();

    expect(router.currentRoute.value.name).toBe('trip-planner');
    expect(wrapper.text()).toContain('Shape the route, then let Atlas Intel compose the days');
    expect(wrapper.text()).toContain('Tune the route stack');
    expect(wrapper.text()).toContain('Generate a polished preview');
    expect(wrapper.text()).toContain('Step 5 of 5');
    expect(wrapper.get('[data-onboarding-target="planner-shell"]').attributes('data-onboarding-active')).toBe('true');
    expect(wrapper.get('[data-onboarding-target="planner-submit"]').attributes('data-onboarding-active')).toBe('true');
    expect(wrapper.get('[data-onboarding-target="itinerary-stage"]').attributes('data-onboarding-active')).toBe('true');
    expect(wrapper.find('.onboarding-overlay__spotlight').exists()).toBe(true);
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
          transition: false,
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
    expect(onboardingStore.hasCompleted).toBe(true);
    expect(localStorage.getItem(ONBOARDING_COMPLETION_STORAGE_KEY)).toBe('completed');
    expect(wrapper.find('.onboarding-overlay__card').exists()).toBe(false);
  });
});

