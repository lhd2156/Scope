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
import { useOnboardingStore } from '@/stores/onboarding';

const spotlightRects: Record<string, { top: number; left: number; width: number; height: number }> = {
  'home-hero': { top: 120, left: 120, width: 520, height: 280 },
  'explore-toolbar': { top: 140, left: 140, width: 640, height: 96 },
  'map-filters': { top: 128, left: 56, width: 320, height: 260 },
  'planner-submit': { top: 640, left: 180, width: 280, height: 56 },
};

const HomeRoute = { template: '<section data-onboarding-target="home-hero">Home hero</section>' };
const ExploreRoute = { template: '<section data-onboarding-target="explore-toolbar">Explore toolbar</section>' };
const MapRoute = { template: '<section data-onboarding-target="map-filters">Map filters</section>' };
const TripPlannerRoute = { template: '<button data-onboarding-target="planner-submit">Generate</button>' };
const Shell = defineComponent({
  components: {
    RouterView,
    OnboardingOverlay,
  },
  template: '<div><RouterView /><OnboardingOverlay /></div>',
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

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getBoundingClientRect() {
      const targetKey = (this as HTMLElement).dataset.onboardingTarget;
      if (targetKey && spotlightRects[targetKey]) {
        return toDomRect(spotlightRects[targetKey]);
      }

      return toDomRect({ top: 0, left: 0, width: 0, height: 0 });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('renders the current walkthrough step and spotlights the matching target', async () => {
    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    const wrapper = mount(Shell, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          teleport: true,
          transition: false,
        },
      },
    });

    const onboardingStore = useOnboardingStore();
    onboardingStore.start();
    await settleOnboarding();

    expect(wrapper.text()).toContain('Start on the home launchpad');
    expect(wrapper.text()).toContain('Step 1 of 4');
    expect(wrapper.find('.onboarding-overlay__spotlight').exists()).toBe(true);
    expect(wrapper.find('.onboarding-overlay__spotlight').attributes('style')).toContain('width: 548px;');
  });

  it('navigates between routed walkthrough steps when the traveler advances', async () => {
    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    const wrapper = mount(Shell, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          teleport: true,
          transition: false,
        },
      },
    });

    const onboardingStore = useOnboardingStore();
    onboardingStore.start();
    await settleOnboarding();

    await wrapper.get('.button.button-primary').trigger('click');
    await settleOnboarding();

    expect(router.currentRoute.value.name).toBe('explore');
    expect(wrapper.text()).toContain('Refine the shortlist in Explore');
  });

  it('closes the overlay when the final walkthrough step is finished', async () => {
    const router = buildRouter();
    await router.push('/');
    await router.isReady();

    const wrapper = mount(Shell, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          teleport: true,
          transition: false,
        },
      },
    });

    const onboardingStore = useOnboardingStore();
    onboardingStore.start('planner-submit');
    await settleOnboarding();

    expect(router.currentRoute.value.name).toBe('trip-planner');
    expect(wrapper.text()).toContain('Turn the brief into an AI itinerary');

    await wrapper.get('.button.button-primary').trigger('click');
    await settleOnboarding();

    expect(onboardingStore.isActive).toBe(false);
    expect(wrapper.find('.onboarding-overlay__card').exists()).toBe(false);
  });
});
