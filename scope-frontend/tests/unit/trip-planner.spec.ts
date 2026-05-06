import { flushPromises, mount } from '@vue/test-utils';
import TripPlanner from '@/components/trips/TripPlanner.vue';
import type { TripPlannerInput, TripSpot } from '@/types';

const searchLocationsMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/mapService', () => ({
  searchLocations: searchLocationsMock,
}));

const initialValue: TripPlannerInput = {
  destination: 'Fort Worth, TX',
  endDestination: '',
  startDate: '2026-04-01',
  endDate: '2026-04-03',
  budgetFloor: 500,
  budget: 500,
  interests: ['food', 'culture', 'nightlife'],
  pace: 'moderate',
  groupSize: 2,
};

const selectedStops: TripSpot[] = [
  {
    spotId: 'stop-1',
    title: 'Mount Fitz Roy',
    latitude: -49.2711,
    longitude: -73.0439,
    category: 'adventure',
    city: 'El Chaltén',
    duration: 180,
    photoUrl: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800',
    notes: 'Sunrise alpine start.',
  },
  {
    spotId: 'stop-2',
    title: 'Perito Moreno Glacier',
    latitude: -50.496,
    longitude: -73.1373,
    category: 'scenic',
    city: 'El Calafate',
    duration: 150,
    photoUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
    notes: 'Glacier boardwalk and cruise.',
  },
];

const suggestedStops: TripSpot[] = [
  ...selectedStops,
  {
    spotId: 'stop-3',
    title: 'Torres del Paine',
    latitude: -50.9423,
    longitude: -72.9874,
    category: 'nature',
    city: 'Torres del Paine',
    duration: 210,
    photoUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800',
    notes: 'Finish with the iconic towers.',
  },
];

describe('TripPlanner', () => {
  beforeEach(() => {
    searchLocationsMock.mockReset();
    searchLocationsMock.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('emits a normalized planner payload after a valid submit', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
        budgetRange: [1500, 3000],
        selectedStops,
        suggestedStops,
      },
    });

    await wrapper.get('[data-test="trip-title-input"]').setValue('Epic Andes Escape');
    await wrapper.get('[data-test="destination-input"]').setValue('Austin, TX ');
    await wrapper.get('[data-test="end-destination-input"]').setValue('Dallas, TX ');

    const paceButtons = wrapper.findAll('button.pace-card');
    await paceButtons[2]?.trigger('click');

    const interestButtons = wrapper.findAll('button.interest-chip');
    await interestButtons[1]?.trigger('click');

    await wrapper.get('[data-test="trip-planner"]').trigger('submit');

    const emitted = wrapper.emitted('submit')?.[0]?.[0] as TripPlannerInput;
    expect(emitted.destination).toBe('Austin, TX');
    expect(emitted.endDestination).toBe('Dallas, TX');
    expect(emitted.pace).toBe('packed');
    expect(emitted.interests).toEqual(['food', 'culture', 'nightlife', 'nature']);
    expect(wrapper.emitted('update:title')?.at(-1)?.[0]).toBe('Epic Andes Escape');
    expect(wrapper.text()).toContain('/ day');
  });

  it('keeps the route preview readable for full postal addresses', () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue: {
          ...initialValue,
          destination: '1630 Cortner Road, Pueblo, Colorado 81006, United States',
          endDestination: '72a Canyon Drive Loop, Los Ojos, New Mexico 87551, United States',
        },
      },
    });

    expect(wrapper.text()).toContain('1630 Cortner Road, Pueblo to 72a Canyon Drive Loop, Los Ojos');
    expect(wrapper.text()).not.toContain('Colorado 81006, United States to');
  });

  it('blocks submission when all interests are removed', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
        budgetRange: [1500, 3000],
        selectedStops,
        suggestedStops,
      },
    });

    const interestButtons = wrapper.findAll('button.interest-chip');
    await interestButtons[0]?.trigger('click');
    await interestButtons[3]?.trigger('click');
    await interestButtons[2]?.trigger('click');

    await wrapper.get('[data-test="trip-planner"]').trigger('submit');

    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.text()).toContain('Select at least one interest to guide the itinerary.');
  });

  it('lets travelers be added from the trip brief controls', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
        budgetRange: [1500, 3000],
        selectedStops,
        suggestedStops,
      },
    });

    await wrapper.get('[data-test="traveler-increment"]').trigger('click');
    await wrapper.get('[data-test="traveler-increment"]').trigger('click');
    await wrapper.get('[data-test="traveler-decrement"]').trigger('click');
    await wrapper.get('[data-test="trip-planner"]').trigger('submit');

    const emitted = wrapper.emitted('submit')?.[0]?.[0] as TripPlannerInput;
    expect(emitted.groupSize).toBe(3);
    expect(wrapper.get('[data-test="traveler-count"]').text()).toBe('3travelers');
  });

  it('lets the budget floor and ceiling use typed custom values', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
        selectedStops,
        suggestedStops,
      },
    });

    await wrapper.get('[data-test="budget-floor-input"]').setValue('125');
    await wrapper.get('[data-test="budget-ceiling-input"]').setValue('7200');
    await wrapper.get('[data-test="trip-planner"]').trigger('submit');

    const emitted = wrapper.emitted('submit')?.[0]?.[0] as TripPlannerInput;
    expect(emitted.budgetFloor).toBe(125);
    expect(emitted.budget).toBe(7200);
    expect(wrapper.findAll('input[type="range"]')).toHaveLength(0);
  });

  it('uses the edit budget buttons to focus the full typed amount', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const wrapper = mount(TripPlanner, {
      attachTo: host,
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
        selectedStops,
        suggestedStops,
      },
    });
    const floorInput = wrapper.get('[data-test="budget-floor-input"]').element as HTMLInputElement;
    const ceilingInput = wrapper.get('[data-test="budget-ceiling-input"]').element as HTMLInputElement;
    const floorSelectSpy = vi.spyOn(floorInput, 'select');
    const ceilingSelectSpy = vi.spyOn(ceilingInput, 'select');

    await wrapper.get('[data-test="budget-floor-edit"]').trigger('click');
    expect(document.activeElement).toBe(floorInput);
    expect(floorSelectSpy).toHaveBeenCalled();

    await wrapper.get('[data-test="budget-ceiling-edit"]').trigger('click');
    expect(document.activeElement).toBe(ceilingInput);
    expect(ceilingSelectSpy).toHaveBeenCalled();

    wrapper.unmount();
    host.remove();
  });

  it('keeps the typed budget floor and ceiling independent', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue: {
          ...initialValue,
          budgetFloor: 500,
          budget: 3000,
        },
        initialTitle: 'Epic Patagonia Trek',
        selectedStops,
        suggestedStops,
      },
    });

    await wrapper.get('[data-test="budget-floor-input"]').setValue('900');
    await wrapper.get('[data-test="budget-ceiling-input"]').setValue('2400');
    await wrapper.get('[data-test="trip-planner"]').trigger('submit');

    const emitted = wrapper.emitted('submit')?.[0]?.[0] as TripPlannerInput;
    expect(emitted.budgetFloor).toBe(900);
    expect(emitted.budget).toBe(2400);
    expect((wrapper.get('[data-test="budget-floor-input"]').element as HTMLInputElement).value).toBe('900');
    expect((wrapper.get('[data-test="budget-ceiling-input"]').element as HTMLInputElement).value).toBe('2400');
  });

  it('lets the budget range be adjusted from visible controls', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
        selectedStops,
        suggestedStops,
      },
    });

    await wrapper.get('[data-test="budget-floor-decrement"]').trigger('click');
    await wrapper.get('[data-test="budget-ceiling-increment"]').trigger('click');
    await wrapper.get('[data-test="trip-planner"]').trigger('submit');

    const emitted = wrapper.emitted('submit')?.[0]?.[0] as TripPlannerInput;
    expect(emitted.budgetFloor).toBe(400);
    expect(emitted.budget).toBe(600);
    expect((wrapper.get('[data-test="budget-floor-input"]').element as HTMLInputElement).value).toBe('400');
    expect((wrapper.get('[data-test="budget-ceiling-input"]').element as HTMLInputElement).value).toBe('600');
  });

  it('lets typed exact addresses fill coordinates from geocoding suggestions', async () => {
    vi.useFakeTimers();
    searchLocationsMock.mockResolvedValue({
      data: [
        {
          latitude: 38.8977,
          longitude: -77.0365,
          placeName: '1600 Pennsylvania Avenue NW',
          formattedAddress: '1600 Pennsylvania Avenue NW, Washington, DC 20500, United States',
          city: 'Washington',
          country: 'United States',
          precision: 'address',
        },
      ],
    });

    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
        budgetRange: [1500, 3000],
        selectedStops,
        suggestedStops,
      },
    });

    await wrapper.get('[data-test="destination-input"]').setValue('1600 Pennsylvania');
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    await wrapper.get('[data-test="destination-suggestion"]').trigger('click');
    await flushPromises();
    await wrapper.get('[data-test="trip-planner"]').trigger('submit');

    const emitted = wrapper.emitted('submit')?.[0]?.[0] as TripPlannerInput;
    expect(searchLocationsMock).toHaveBeenCalledWith('1600 Pennsylvania', {
      limit: 6,
      proximity: undefined,
    });
    expect(emitted.destination).toBe('1600 Pennsylvania Avenue NW, Washington, DC 20500, United States');
    expect(emitted.destinationLatitude).toBeCloseTo(38.8977);
    expect(emitted.destinationLongitude).toBeCloseTo(-77.0365);
  });

  it('adds a suggested stop and emits the refreshed route order', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
        budgetRange: [1500, 3000],
        selectedStops: [selectedStops[0]],
        suggestedStops,
      },
    });

    await wrapper.get('[data-test="destination-search-input"]').setValue('Torres');
    await wrapper.get('.add-stop-button').trigger('click');

    const latestStops = wrapper.emitted('update:stops')?.at(-1)?.[0] as TripSpot[];
    expect(latestStops).toHaveLength(2);
    expect(latestStops[1]?.title).toBe('Torres del Paine');
  });

  it('renders a vertical mobile wizard with only the active step expanded', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
        budgetRange: [1500, 3000],
        selectedStops,
        suggestedStops,
        mobileWizard: true,
        mobileActiveStep: 2,
      },
    });

    expect(wrapper.get('[data-test="planner-step-1-toggle"]').attributes('aria-expanded')).toBe('false');
    expect(wrapper.get('[data-test="planner-step-2-toggle"]').attributes('aria-expanded')).toBe('true');
    expect(wrapper.get('[data-test="planner-step-1-content"]').isVisible()).toBe(false);
    expect(wrapper.get('[data-test="planner-step-2-content"]').isVisible()).toBe(true);
    expect(wrapper.get('[data-test="planner-step-3-content"]').isVisible()).toBe(false);
  });

  it('emits wizard step changes from the mobile step actions', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
        budgetRange: [1500, 3000],
        selectedStops,
        suggestedStops,
        mobileWizard: true,
        mobileActiveStep: 1,
      },
    });

    await wrapper.get('[data-test="planner-step-1-continue"]').trigger('click');

    expect(wrapper.emitted('wizard-step-change')?.[0]?.[0]).toBe(2);
  });
});
