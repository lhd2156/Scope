import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import Modal from '@/components/common/Modal.vue';
import PageHero from '@/components/common/PageHero.vue';
import TabBar from '@/components/common/TabBar.vue';
import ToastViewport from '@/components/common/ToastViewport.vue';
import ReviewSentiment from '@/components/spots/ReviewSentiment.vue';
import TripDetail from '@/components/trips/TripDetail.vue';

const { toastStoreMock, reducedMotionMock } = vi.hoisted(() => ({
  toastStoreMock: {
    hasToasts: true,
    items: [
      {
        id: 'toast-1',
        title: 'Route saved',
        message: 'Your draft is ready.',
        tone: 'success',
        autoHideMs: 5000,
      },
    ],
    dismissToast: vi.fn(),
  },
  reducedMotionMock: { value: false },
}));

vi.mock('@/stores/toasts', () => ({
  useToastStore: () => toastStoreMock,
}));

vi.mock('@/utils/motion', () => ({
  useReducedMotion: () => reducedMotionMock,
}));

describe('component coverage smoke tests', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    toastStoreMock.hasToasts = true;
    toastStoreMock.items = [
      {
        id: 'toast-1',
        title: 'Route saved',
        message: 'Your draft is ready.',
        tone: 'success',
        autoHideMs: 5000,
      },
    ];
    toastStoreMock.dismissToast.mockClear();
    reducedMotionMock.value = false;
  });

  it('renders toast viewport transitions and dismisses toast items', async () => {
    const wrapper = mount(ToastViewport, {
      global: {
        stubs: {
          Toast: {
            props: ['title', 'message', 'tone', 'autoHideMs'],
            emits: ['close'],
            template: '<button data-test="toast-stub" @click="$emit(\'close\')">{{ title }} {{ message }} {{ tone }} {{ autoHideMs }}</button>',
          },
          TransitionGroup: false,
        },
      },
    });

    expect(wrapper.get('[data-test="toast-stub"]').text()).toContain('Route saved');
    await wrapper.get('[data-test="toast-stub"]').trigger('click');
    expect(toastStoreMock.dismissToast).toHaveBeenCalledWith('toast-1');

    reducedMotionMock.value = true;
    await nextTick();
    expect(wrapper.find('.toast-stack').exists()).toBe(true);

    toastStoreMock.hasToasts = false;
    wrapper.vm.$forceUpdate();
    await nextTick();
    expect(wrapper.find('.toast-viewport').exists()).toBe(false);
  });

  it('renders sentiment thresholds and hides missing scores', async () => {
    const positive = mount(ReviewSentiment, { props: { score: 0.8 } });
    expect(positive.text()).toBe('Positive');
    expect(positive.attributes('title')).toBe('Sentiment score: 0.80');
    expect(positive.classes()).toContain('sentiment-positive');

    const neutral = mount(ReviewSentiment, { props: { score: 0.1 } });
    expect(neutral.text()).toBe('Mixed');
    expect(neutral.classes()).toContain('sentiment-neutral');

    const negative = mount(ReviewSentiment, { props: { score: -0.5 } });
    expect(negative.text()).toBe('Critical');
    expect(negative.classes()).toContain('sentiment-negative');

    const missing = mount(ReviewSentiment, { props: { score: null } });
    expect(missing.html()).toBe('<!--v-if-->');
  });

  it('locks modal focus, closes by backdrop and escape, and restores body scroll', async () => {
    const opener = document.createElement('button');
    opener.textContent = 'Open';
    document.body.appendChild(opener);
    opener.focus();

    const wrapper = mount(Modal, {
      attachTo: document.body,
      props: {
        open: true,
        title: 'Trip settings',
        eyebrow: 'Planner',
        size: 'lg',
      },
      slots: {
        default: '<button data-test="inside-action">Inside</button>',
      },
      global: {
        stubs: {
          ScopeIcon: { template: '<span />' },
          Transition: false,
        },
      },
    });

    await flushPromises();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.textContent).toContain('Trip settings');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    await nextTick();
    expect(document.activeElement).toBeTruthy();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(wrapper.emitted('close')).toBeTruthy();

    await wrapper.setProps({ open: false });
    await flushPromises();
    expect(document.body.style.overflow).toBe('');

    await wrapper.setProps({ open: true, closeOnBackdrop: false });
    await flushPromises();
    document.body.querySelector<HTMLElement>('.modal-backdrop')?.click();
    expect(wrapper.emitted('close')).toHaveLength(1);

    wrapper.unmount();
  });

  it('renders trip details from fallback itinerary data and stays empty for null trips', () => {
    const trip = {
      id: 'trip-coverage',
      title: 'North Texas Loop',
      description: 'A quick city-to-park loop.',
      destination: 'Fort Worth, TX',
      startDate: '2026-05-08',
      endDate: '2026-05-10',
      budget: 1200,
      currency: 'USD',
      members: [
        { id: 'member-1', displayName: 'Ava Torres' },
      ],
      spots: [
        {
          spotId: 'stop-2',
          title: 'Late Coffee',
          latitude: 32.76,
          longitude: -97.33,
          category: 'food',
          city: 'Fort Worth',
          dayNumber: 2,
          timeSlot: '15:00',
          estimatedCost: 18,
        },
        {
          spotId: 'stop-1',
          title: 'Morning Garden',
          latitude: 32.74,
          longitude: -97.36,
          category: 'nature',
          city: 'Fort Worth',
          dayNumber: 1,
          timeSlot: '09:00',
          estimatedCost: 12,
        },
      ],
    } as any;

    const wrapper = mount(TripDetail, {
      props: { trip },
      global: {
        stubs: {
          LazyImage: { props: ['src', 'fallbackSrc', 'alt'], template: '<img :src="src" :alt="alt" />' },
          MapView: { props: ['spots', 'routePoints'], template: '<div data-test="trip-map">{{ routePoints.length }} route points</div>' },
          MemberList: { props: ['members'], template: '<div data-test="members">{{ members.length }} member</div>' },
          TripTimeline: { props: ['itinerary'], template: '<div data-test="timeline">{{ itinerary.days.map((day) => day.dayNumber + ":" + day.spots.map((spot) => spot.title).join(",")).join(" / ") }}</div>' },
        },
      },
    });

    expect(wrapper.get('[data-test="trip-detail"]').text()).toContain('North Texas Loop');
    expect(wrapper.get('[data-test="timeline"]').text()).toContain('1:Morning Garden');
    expect(wrapper.get('[data-test="trip-map"]').text()).toContain('2 route points');
    expect(wrapper.get('[data-test="members"]').text()).toContain('1 member');

    const empty = mount(TripDetail, { props: { trip: null } });
    expect(empty.html()).toBe('<!--v-if-->');
  });

  it('renders shared page hero and tab controls with slot and disabled states', async () => {
    const hero = mount(PageHero, {
      props: {
        title: 'Scope routes',
        eyebrow: 'Planner',
        description: 'Shape a route from the map.',
        tone: 'gold',
        centered: true,
      },
      slots: {
        stats: '<span data-test="hero-stat">3 stops</span>',
        actions: '<button data-test="hero-action">Save</button>',
        toolbar: '<label data-test="hero-toolbar">Filter</label>',
        footer: '<small data-test="hero-footer">Updated now</small>',
      },
    });
    expect(hero.classes()).toContain('page-hero--gold');
    expect(hero.classes()).toContain('page-hero--centered');
    expect(hero.get('[data-test="hero-stat"]').text()).toBe('3 stops');
    expect(hero.get('[data-test="hero-footer"]').text()).toBe('Updated now');

    const tabs = mount(TabBar, {
      props: {
        modelValue: 'map',
        variant: 'segmented',
        fullWidth: true,
        ariaLabel: 'Planner sections',
        tabs: [
          { id: 'map', label: 'Map', icon: 'M', count: 2, panelId: 'map-panel' },
          { id: 'timeline', label: 'Timeline', disabled: true },
          { id: 'budget', label: 'Budget', dataTest: 'budget-tab' },
        ],
      },
    });

    expect(tabs.attributes('aria-label')).toBe('Planner sections');
    expect(tabs.classes()).toContain('tab-bar--segmented');
    expect(tabs.classes()).toContain('tab-bar--full');
    expect(tabs.get('[data-test="tab-map"]').attributes('aria-selected')).toBe('true');
    const disabledTab = tabs.get('[data-test="tab-timeline"]');
    (disabledTab.element as HTMLButtonElement).disabled = false;
    await disabledTab.trigger('click');
    expect(tabs.emitted('change')).toBeUndefined();
    await tabs.get('[data-test="budget-tab"]').trigger('click');
    expect(tabs.emitted('update:modelValue')?.[0]).toEqual(['budget']);
    expect(tabs.emitted('change')?.[0]).toEqual(['budget']);
  });
});
