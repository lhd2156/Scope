import { flushPromises, mount } from '@vue/test-utils';
import TripPlanner from '@/components/trips/TripPlanner.vue';
import type { TripPlannerInput, TripSpot } from '@/types';
import { resetAnalyticsConsent, setAnalyticsConsent } from '@/utils/analyticsConsent';

const searchLocationsMock = vi.hoisted(() => vi.fn());
const canLoadWeatherMock = vi.hoisted(() => vi.fn(() => false));
const getWeatherSnapshotMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/mapService', () => ({
  searchLocations: searchLocationsMock,
}));

vi.mock('@/services/openWeatherMapService', () => ({
  canLoadOpenWeatherMapWeather: canLoadWeatherMock,
  getOpenWeatherMapSnapshot: getWeatherSnapshotMock,
}));

const initialValue: TripPlannerInput = {
  destination: 'Fort Worth, TX',
  endDestination: 'Dallas, TX',
  endDestinationLatitude: 32.7767,
  endDestinationLongitude: -96.797,
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
    canLoadWeatherMock.mockReset();
    canLoadWeatherMock.mockReturnValue(false);
    getWeatherSnapshotMock.mockReset();
    localStorage.clear();
    resetAnalyticsConsent();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('keeps the desktop route builder header compact without duplicating the trip title', () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
      },
    });

    const plannerHeader = wrapper.get('.planner-header');
    const titleInput = wrapper.get<HTMLInputElement>('[data-test="trip-title-input"]');

    expect(plannerHeader.text()).toBe('Route builder');
    expect(plannerHeader.find('h2').exists()).toBe(false);
    expect(titleInput.element.value).toBe('Epic Patagonia Trek');
    expect(wrapper.text()).not.toContain('floating copilot');
  });

  it('reacts to incoming draft title, route, budget, and fuel prop changes without stale UI state', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue: {
          destination: '',
          endDestination: '',
          startDate: '2026-06-01',
          endDate: '2026-06-01',
          budgetFloor: 600,
          budget: 800,
          interests: [],
          pace: 'relaxed',
          groupSize: 1,
        },
        initialTitle: '',
        fuelSettings: {
          mpg: 22,
          fuelType: 'premium',
        },
      },
    });

    expect((wrapper.get('[data-test="trip-title-input"]').element as HTMLInputElement).value).toBe('');
    expect(wrapper.get('[data-test="trip-fuel-card"]').text()).toContain('Premium / add gas price');

    await wrapper.setProps({
      initialValue: {
        destination: 'Moab, UT',
        endDestination: 'Zion National Park, UT',
        startDate: '2026-06-05',
        endDate: '2026-06-08',
        budgetFloor: 900,
        budget: 700,
        interests: ['food', 'culture', 'nature', 'adventure'],
        pace: 'packed',
        groupSize: 3,
      },
    });

    expect((wrapper.get('[data-test="destination-input"]').element as HTMLInputElement).value).toBe('Moab, UT');
    expect((wrapper.get('[data-test="end-destination-input"]').element as HTMLInputElement).value).toBe('Zion National Park, UT');
    expect(wrapper.text()).toContain('$700 - $700');
    expect(wrapper.get('[data-test="trip-pace-packed"]').classes()).toContain('active');
    expect((wrapper.get('[data-test="trip-title-input"]').element as HTMLInputElement).value).toBe('');

    await wrapper.setProps({ initialTitle: 'Utah Parks Loop' });
    expect((wrapper.get('[data-test="trip-title-input"]').element as HTMLInputElement).value).toBe('Utah Parks Loop');

    await wrapper.setProps({
      fuelSettings: {
        gasPricePerGallon: 4.25,
        fuelType: 'rocket' as never,
      },
    });

    expect(wrapper.get('[data-test="trip-fuel-card"]').text()).toContain('Regular / add MPG');
  });

  it('shows air quality next to wind in the weather snapshot', async () => {
    vi.useFakeTimers();
    canLoadWeatherMock.mockReturnValue(true);
    getWeatherSnapshotMock.mockImplementation(async (point: { label: string }) => ({
      id: point.label,
      label: point.label,
      temperatureF: point.label.includes('Dallas') ? 64 : 62,
      condition: 'Clear Sky',
      windMph: point.label.includes('Dallas') ? 6 : 10,
      providerLabel: 'OpenWeatherMap',
      observedAtIso: '2026-05-19T03:55:00.000Z',
      iconCode: '01n',
      isDaytime: false,
      airQuality: {
        index: 42,
        label: 'Good',
        scale: 'us',
      },
    }));

    const wrapper = mount(TripPlanner, {
      props: {
        initialValue: {
          ...initialValue,
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
        },
        initialTitle: 'Epic Patagonia Trek',
        selectedStops,
        suggestedStops,
        mobileWizard: true,
        mobileActiveStep: 2,
      },
    });

    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();

    const weatherCardText = wrapper.get('[data-test="trip-weather-card"]').text();
    expect(weatherCardText).toContain('Wind');
    expect(weatherCardText).toContain('10 mph');
    expect(weatherCardText).toContain('AQI');
    expect(weatherCardText).toContain('42 Good');
    expect(weatherCardText).toContain('OpenWeatherMap');
    expect(weatherCardText).toContain('Checked');
    expect(weatherCardText).not.toContain('Observed');
    expect(getWeatherSnapshotMock).toHaveBeenCalledWith(expect.objectContaining({
      latitude: 32.7555,
      longitude: -97.3308,
    }));
    expect(wrapper.find('.weather-snapshot__visual use').attributes('href')).toBe('/scope-icons.svg#icon-moon');
  });

  it('refreshes the weather snapshot after the first live check', async () => {
    vi.useFakeTimers();
    canLoadWeatherMock.mockReturnValue(true);
    getWeatherSnapshotMock.mockImplementation(async (point: { label: string }) => ({
      id: point.label,
      label: point.label,
      temperatureF: 72,
      condition: 'Partly Cloudy',
      windMph: 9,
      providerLabel: 'OpenWeatherMap',
      checkedAtIso: new Date().toISOString(),
    }));

    mount(TripPlanner, {
      props: {
        initialValue: {
          ...initialValue,
          destination: 'Austin, TX',
          destinationLatitude: 30.2672,
          destinationLongitude: -97.7431,
          endDestination: '',
        },
      },
    });

    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();
    expect(getWeatherSnapshotMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(120_000);
    await flushPromises();
    expect(getWeatherSnapshotMock).toHaveBeenCalledTimes(2);
  });

  it('labels stale fallback weather data instead of presenting it as live observation', async () => {
    vi.useFakeTimers();
    canLoadWeatherMock.mockReturnValue(true);
    getWeatherSnapshotMock.mockResolvedValue({
      id: 'fallback-weather',
      label: 'Tokyo, Japan',
      temperatureF: 78.4,
      condition: 'Current Conditions',
      windMph: 8.2,
      provider: 'openmeteo',
      providerLabel: 'Open-Meteo fallback',
      checkedAtIso: '2026-05-19T04:00:00.000Z',
      isStale: true,
    });

    const wrapper = mount(TripPlanner, {
      props: {
        initialValue: {
          ...initialValue,
          destination: 'Tokyo, Japan',
          destinationLatitude: 35.6762,
          destinationLongitude: 139.6503,
          endDestination: '',
        },
      },
    });

    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();

    const weatherCardText = wrapper.get('[data-test="trip-weather-card"]').text();
    expect(weatherCardText).toContain('78°F');
    expect(weatherCardText).toContain('Open-Meteo fallback');
    expect(weatherCardText).toContain('Stale');
    expect(weatherCardText).toContain('Fallback');
  });

  it('shows empty, unsupported, and provider-error weather states without guessing conditions', async () => {
    vi.useFakeTimers();
    canLoadWeatherMock.mockReturnValue(true);
    const emptyWrapper = mount(TripPlanner, {
      props: {
        initialValue: {},
      },
    });

    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();
    expect(emptyWrapper.get('[data-test="trip-weather-card"]').text()).toContain('Add an origin or destination to check weather.');
    expect(getWeatherSnapshotMock).not.toHaveBeenCalled();
    emptyWrapper.unmount();

    canLoadWeatherMock.mockReturnValue(false);
    const unsupportedWrapper = mount(TripPlanner, {
      props: {
        initialValue,
      },
    });

    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();
    expect(unsupportedWrapper.get('[data-test="trip-weather-card"]').text()).toContain('Weather needs browser fetch support.');
    expect(getWeatherSnapshotMock).not.toHaveBeenCalled();
    unsupportedWrapper.unmount();

    canLoadWeatherMock.mockReturnValue(true);
    getWeatherSnapshotMock.mockRejectedValue(new Error('weather provider unavailable'));
    const errorWrapper = mount(TripPlanner, {
      props: {
        initialValue,
      },
    });

    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();
    expect(errorWrapper.get('[data-test="trip-weather-card"]').text()).toContain('Weather is unavailable right now.');
  });

  it('keeps weather labels readable for address labels, invalid timestamps, and non-US AQ scales', async () => {
    vi.useFakeTimers();
    canLoadWeatherMock.mockReturnValue(true);
    getWeatherSnapshotMock.mockImplementation(async (point: { label: string }) => ({
      id: point.label,
      label: point.label,
      temperatureF: 68,
      condition: 'Fog',
      windMph: 4,
      checkedAtIso: 'not-a-date',
      airQuality: {
        index: 3,
        label: 'Moderate',
        scale: 'owm',
      },
    }));

    const wrapper = mount(TripPlanner, {
      props: {
        initialValue: {
          ...initialValue,
          destination: '123 Main Street, Austin, Texas, United States',
          endDestination: '',
        },
      },
    });

    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();

    const weatherCardText = wrapper.get('[data-test="trip-weather-card"]').text();
    expect(weatherCardText).toContain('Austin');
    expect(weatherCardText).toContain('Moderate');
    expect(weatherCardText).not.toContain('3 Moderate');
    expect(weatherCardText).toContain('Checked just now');
  });

  it('mirrors the Settings AI learning choice in the trip footer', async () => {
    setAnalyticsConsent('denied');
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
      },
    });

    expect(wrapper.get('[data-test="trip-ai-learning-note"]').text()).toContain('AI learning is off');

    setAnalyticsConsent('granted');
    await flushPromises();

    expect(wrapper.get('[data-test="trip-ai-learning-note"]').text()).toContain('AI learning is on');
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
    await flushPromises();

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

  it('allows submission when all interests are removed', async () => {
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
    await flushPromises();

    const emitted = wrapper.emitted('submit')?.[0]?.[0] as TripPlannerInput;
    expect(emitted.interests).toEqual([]);
    expect(wrapper.text()).toContain('Optional. Scope starts from the route and your stops; vibes only nudge the mix.');
    expect(wrapper.text()).toContain('Your guide will use the route first');
  });

  it('requires a final destination before handoff', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue: {
          ...initialValue,
          endDestination: '',
          endDestinationLatitude: undefined,
          endDestinationLongitude: undefined,
        },
        initialTitle: 'Epic Patagonia Trek',
        budgetRange: [1500, 3000],
        selectedStops,
        suggestedStops,
      },
    });

    await wrapper.get('[data-test="trip-planner"]').trigger('submit');
    await flushPromises();

    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.get('[data-test="end-destination-input"]').attributes('placeholder')).toBe('Final address, city, or landmark');
    expect(wrapper.text()).toContain('Add it now or before the start point. Scope will keep both endpoints in sync.');
    expect(wrapper.text()).toContain('Enter a final destination so Scope can build the itinerary.');
  });

  it('keeps invalid calendar and traveler counts in the brief step until corrected', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue: {
          ...initialValue,
          startDate: 'not-a-date',
          endDate: '2026-02-30',
          groupSize: 15,
        },
        initialTitle: 'Epic Patagonia Trek',
        mobileWizard: true,
        mobileActiveStep: 3,
      },
    });

    await wrapper.get('[data-test="trip-planner"]').trigger('submit');
    await flushPromises();

    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.emitted('wizard-step-change')?.at(-1)?.[0]).toBe(1);
    expect(wrapper.text()).toContain('Add a valid start date.');
    expect(wrapper.text()).toContain('Add a valid end date.');
    expect(wrapper.text()).toContain('Group size must stay between 1 and 12.');
  });

  it('blocks handoff when the end date falls before the start date', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue: {
          ...initialValue,
          startDate: '2026-04-04',
          endDate: '2026-04-02',
        },
        initialTitle: 'Epic Patagonia Trek',
      },
    });

    await wrapper.get('[data-test="trip-planner"]').trigger('submit');
    await flushPromises();

    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.text()).toContain('End date must be on or after the start date.');
  });

  it('lets travelers choose the end destination before the start place', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue: {
          ...initialValue,
          destination: '',
          destinationLatitude: undefined,
          destinationLongitude: undefined,
          endDestination: '',
          endDestinationLatitude: undefined,
          endDestinationLongitude: undefined,
        },
      },
    });

    const startInput = wrapper.get('[data-test="destination-input"]');
    const endInput = wrapper.get('[data-test="end-destination-input"]');
    expect(endInput.attributes('disabled')).toBeUndefined();
    expect(endInput.attributes('placeholder')).toBe('Final address, city, or landmark');
    expect(wrapper.text()).toContain('Add it now or before the start point. Scope will keep both endpoints in sync.');

    await endInput.setValue('Dallas, TX');
    await flushPromises();
    expect((wrapper.get('[data-test="end-destination-input"]').element as HTMLInputElement).value).toBe('Dallas, TX');

    await startInput.setValue('Austin, TX');
    await flushPromises();
    expect(wrapper.get('[data-test="end-destination-input"]').attributes('disabled')).toBeUndefined();
    expect(wrapper.get('[data-test="end-destination-input"]').attributes('placeholder')).toBe('Final address, city, or landmark');

    await wrapper.get('[data-test="end-destination-input"]').setValue('Dallas, TX');
    await flushPromises();
    expect((wrapper.get('[data-test="end-destination-input"]').element as HTMLInputElement).value).toBe('Dallas, TX');

    await startInput.setValue('');
    await flushPromises();
    expect(wrapper.get('[data-test="end-destination-input"]').attributes('disabled')).toBeUndefined();
    expect((wrapper.get('[data-test="end-destination-input"]').element as HTMLInputElement).value).toBe('Dallas, TX');

    await wrapper.get('[data-test="trip-planner"]').trigger('submit');
    await flushPromises();
    expect(wrapper.emitted('submit')).toBeDefined();
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
    await flushPromises();

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
    await flushPromises();

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
    await flushPromises();

    const emitted = wrapper.emitted('submit')?.[0]?.[0] as TripPlannerInput;
    expect(emitted.budgetFloor).toBe(900);
    expect(emitted.budget).toBe(2400);
    expect((wrapper.get('[data-test="budget-floor-input"]').element as HTMLInputElement).value).toBe('900');
    expect((wrapper.get('[data-test="budget-ceiling-input"]').element as HTMLInputElement).value).toBe('2400');
  });

  it('normalizes an incoming max budget below the floor into a valid one-value range', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue: {
          ...initialValue,
          budgetFloor: 500,
          budget: 400,
        },
        initialTitle: 'Epic Patagonia Trek',
        selectedStops,
        suggestedStops,
        mobileWizard: true,
        mobileActiveStep: 2,
      },
    });

    expect((wrapper.get('[data-test="budget-floor-input"]').element as HTMLInputElement).value).toBe('400');
    expect((wrapper.get('[data-test="budget-ceiling-input"]').element as HTMLInputElement).value).toBe('400');
    expect(wrapper.text()).toContain('$400 - $400');

    await wrapper.get('[data-test="trip-planner"]').trigger('submit');
    await flushPromises();

    const emitted = wrapper.emitted('submit')?.[0]?.[0] as TripPlannerInput;
    expect(emitted.budgetFloor).toBe(400);
    expect(emitted.budget).toBe(400);
  });

  it('keeps typed budget values non-negative and prevents the max from sitting below the min', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue: {
          ...initialValue,
          budgetFloor: 500,
          budget: 1500,
        },
        initialTitle: 'Epic Patagonia Trek',
        selectedStops,
        suggestedStops,
      },
    });

    await wrapper.get('[data-test="budget-ceiling-input"]').setValue('-5');
    await wrapper.get('[data-test="trip-planner"]').trigger('submit');
    await flushPromises();

    const emitted = wrapper.emitted('submit')?.[0]?.[0] as TripPlannerInput;
    expect(emitted.budgetFloor).toBe(0);
    expect(emitted.budget).toBe(0);
    expect((wrapper.get('[data-test="budget-floor-input"]').element as HTMLInputElement).value).toBe('0');
    expect((wrapper.get('[data-test="budget-ceiling-input"]').element as HTMLInputElement).value).toBe('0');
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
    await flushPromises();

    const emitted = wrapper.emitted('submit')?.[0]?.[0] as TripPlannerInput;
    expect(emitted.budgetFloor).toBe(400);
    expect(emitted.budget).toBe(600);
    expect((wrapper.get('[data-test="budget-floor-input"]').element as HTMLInputElement).value).toBe('400');
    expect((wrapper.get('[data-test="budget-ceiling-input"]').element as HTMLInputElement).value).toBe('600');
  });

  it('emits fuel settings from the sidebar calculator', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
        selectedStops,
        suggestedStops,
      },
    });

    await wrapper.get('[data-test="fuel-mpg-input"]').setValue('25');
    await wrapper.get('[data-test="fuel-price-input"]').setValue('3.5');

    expect(wrapper.emitted('update:fuel-settings')?.at(-1)?.[0]).toEqual({
      mpg: 25,
      gasPricePerGallon: 3.5,
      fuelType: 'regular',
    });

    await wrapper.get('[data-test="fuel-type-option-diesel"]').trigger('click');

    expect(wrapper.emitted('update:fuel-settings')?.at(-1)?.[0]).toEqual({
      mpg: 25,
      gasPricePerGallon: 3.5,
      fuelType: 'diesel',
    });
  });

  it('scrolls and focuses the fuel card from the exposed planner helper', async () => {
    vi.useFakeTimers();
    const scrollIntoViewSpy = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus').mockImplementation(() => undefined);
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoViewSpy,
    });

    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
      },
    });

    (wrapper.vm as unknown as { scrollToFuelSettings: () => void }).scrollToFuelSettings();

    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    await vi.advanceTimersByTimeAsync(420);
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });

    focusSpy.mockRestore();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: originalScrollIntoView,
    });
  });

  it('uses in-app fuel validation instead of native number bubbles', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
        selectedStops,
        suggestedStops,
      },
    });

    await wrapper.get('[data-test="fuel-mpg-input"]').setValue('1235655');
    await wrapper.get('[data-test="fuel-price-input"]').setValue('25');
    await flushPromises();

    expect(wrapper.get('[data-test="trip-planner"]').attributes('novalidate')).toBeDefined();
    expect(wrapper.get('[data-test="fuel-mpg-input"]').attributes('type')).toBe('text');
    expect(wrapper.get('[data-test="fuel-mpg-input"]').attributes('max')).toBeUndefined();
    expect(wrapper.get('[data-test="fuel-mpg-error"]').text()).toBe('MPG must be 200 or less.');
    expect(wrapper.get('[data-test="fuel-price-error"]').text()).toBe('Gas price must be $20.00/gal or less.');
    expect(wrapper.text()).toContain('Check fuel inputs');
    expect(wrapper.emitted('update:fuel-settings')?.at(-1)?.[0]).toEqual({
      mpg: undefined,
      gasPricePerGallon: undefined,
      fuelType: 'regular',
    });
  });

  it('persists checked and custom packing checklist items', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
        selectedStops,
        suggestedStops,
      },
    });

    await wrapper.get('input[aria-label="Driver license and registration"]').setValue(true);
    await wrapper.get('.packing-add-form input').setValue('Blanket');
    await wrapper.get('.packing-add-form').trigger('submit');

    expect(wrapper.text()).toContain('Blanket');
    expect(setItemSpy).toHaveBeenLastCalledWith(
      'scope-trip-planner-packing-checklist:draft:standalone',
      expect.stringContaining('Blanket'),
    );
    setItemSpy.mockRestore();
  });

  it('removes custom packing items while leaving the default checklist intact', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
      },
    });

    await wrapper.get('.packing-add-form input').setValue('Rain shell');
    await wrapper.get('.packing-add-form').trigger('submit');
    expect(wrapper.text()).toContain('Rain shell');

    await wrapper.get('button[aria-label="Remove Rain shell"]').trigger('click');

    expect(wrapper.text()).not.toContain('Rain shell');
    expect(wrapper.find('button[aria-label="Remove Driver license and registration"]').exists()).toBe(false);
  });

  it('keeps packing checklist state scoped to each trip', async () => {
    localStorage.setItem(
      'scope-trip-planner-packing-checklist:trip:patagonia',
      JSON.stringify([
        { id: 'license-registration', label: 'Driver license and registration', checked: true },
        { id: 'chargers-cables', label: 'Phone chargers and cables', checked: false },
        { id: 'water-snacks', label: 'Water and road snacks', checked: false },
        { id: 'first-aid', label: 'First aid kit', checked: false },
        { id: 'sunglasses', label: 'Sunglasses', checked: false },
        { id: 'emergency-kit', label: 'Emergency roadside kit', checked: false },
      ]),
    );

    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
        packingChecklistScope: 'trip:patagonia',
      },
    });

    expect(wrapper.text()).toContain('1/6 packed');

    await wrapper.setProps({ packingChecklistScope: 'trip:dallas' });
    await flushPromises();

    expect(wrapper.text()).toContain('0/6 packed');

    await wrapper.get('.packing-item input').setValue(true);

    expect(localStorage.getItem('scope-trip-planner-packing-checklist:trip:patagonia')).toContain('"checked":true');
    expect(localStorage.getItem('scope-trip-planner-packing-checklist:trip:dallas')).toContain('"checked":true');
  });

  it('falls back to the default packing checklist when stored data is malformed', () => {
    localStorage.setItem('scope-trip-planner-packing-checklist:trip:broken', '{not json');

    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        packingChecklistScope: 'trip:broken',
      },
    });

    expect(wrapper.get('[data-test="trip-packing-card"]').text()).toContain('0/6 packed');
    expect(wrapper.text()).toContain('Driver license and registration');
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
    await flushPromises();

    const emitted = wrapper.emitted('submit')?.[0]?.[0] as TripPlannerInput;
    expect(searchLocationsMock).toHaveBeenCalledWith('1600 Pennsylvania', {
      limit: 6,
      proximity: {
        latitude: 32.7767,
        longitude: -96.797,
      },
    });
    expect(emitted.destination).toBe('1600 Pennsylvania Avenue NW, Washington, DC 20500, United States');
    expect(emitted.destinationLatitude).toBeCloseTo(38.8977);
    expect(emitted.destinationLongitude).toBeCloseTo(-77.0365);
  });

  it('auto-resolves a typed start location before handoff', async () => {
    searchLocationsMock.mockResolvedValueOnce({
      data: [
        {
          latitude: 30.2672,
          longitude: -97.7431,
          placeName: 'Austin',
          formattedAddress: 'Austin, Texas, United States',
          city: 'Austin',
          country: 'United States',
          precision: 'city',
        },
      ],
    });

    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
        selectedStops,
        suggestedStops,
      },
    });

    await wrapper.get('[data-test="destination-input"]').setValue('Austin, TX');
    await wrapper.get('[data-test="trip-planner"]').trigger('submit');
    await flushPromises();

    const emitted = wrapper.emitted('submit')?.[0]?.[0] as TripPlannerInput;
    expect(searchLocationsMock).toHaveBeenCalledWith('Austin, TX', {
      limit: 1,
      proximity: {
        latitude: 32.7767,
        longitude: -96.797,
      },
    });
    expect(emitted.destination).toBe('Austin, Texas, United States');
    expect(emitted.destinationLatitude).toBeCloseTo(30.2672);
    expect(emitted.destinationLongitude).toBeCloseTo(-97.7431);
  });

  it('keeps typed suggestions unpinned until the user selects a location', async () => {
    vi.useFakeTimers();
    searchLocationsMock.mockResolvedValue({
      data: [
        {
          latitude: 30.2672,
          longitude: -97.7431,
          placeName: 'Austin',
          formattedAddress: 'Austin, Texas, United States',
          city: 'Austin',
          country: 'United States',
          precision: 'city',
        },
      ],
    });

    const wrapper = mount(TripPlanner, {
      props: {
        initialValue: {
          ...initialValue,
          destinationLatitude: undefined,
          destinationLongitude: undefined,
        },
        initialTitle: 'Epic Patagonia Trek',
        selectedStops,
        suggestedStops,
      },
    });

    await wrapper.get('[data-test="destination-input"]').setValue('Austin, TX');
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    const latestDraft = wrapper.emitted('update:draft')?.at(-1)?.[0] as TripPlannerInput;
    expect(searchLocationsMock).toHaveBeenCalledWith('Austin, TX', {
      limit: 6,
      proximity: {
        latitude: 32.7767,
        longitude: -96.797,
      },
    });
    expect(latestDraft.destination).toBe('Austin, TX');
    expect(latestDraft.destinationLatitude).toBeUndefined();
    expect(latestDraft.destinationLongitude).toBeUndefined();
  });

  it('supports keyboard navigation and escape dismissal for location suggestions', async () => {
    vi.useFakeTimers();
    searchLocationsMock.mockResolvedValue({
      data: [
        {
          latitude: 30.2672,
          longitude: -97.7431,
          placeName: 'Austin',
          formattedAddress: 'Austin, Texas, United States',
          city: 'Austin',
          country: 'United States',
          precision: 'city',
        },
        {
          latitude: 30.2502,
          longitude: -97.749,
          placeName: 'Austin Motel',
          formattedAddress: '1220 S Congress Ave, Austin, Texas',
          city: 'Austin',
          country: 'United States',
          precision: 'poi',
          category: 'hotel',
          distanceKm: 5.4,
          source: 'mapbox',
        },
      ],
    });
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
      },
    });
    const input = wrapper.get('[data-test="destination-input"]');

    await input.setValue('Austin');
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    expect(wrapper.findAll('[data-test="destination-suggestion"]')).toHaveLength(2);
    expect(wrapper.findAll('[data-test="destination-suggestion"]')[0]?.attributes('aria-selected')).toBe('true');

    await input.trigger('keydown', { key: 'ArrowDown' });
    expect(wrapper.findAll('[data-test="destination-suggestion"]')[1]?.attributes('aria-selected')).toBe('true');
    expect(wrapper.get('[data-test="destination-suggestion"].active').text()).toContain('Austin Motel');

    await input.trigger('keydown', { key: 'ArrowUp' });
    expect(wrapper.findAll('[data-test="destination-suggestion"]')[0]?.attributes('aria-selected')).toBe('true');

    await input.trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect((input.element as HTMLInputElement).value).toBe('Austin, Texas, United States');
    expect(wrapper.find('[data-test="destination-suggestions"]').exists()).toBe(false);

    await input.setValue('Austin');
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    expect(wrapper.find('[data-test="destination-suggestions"]').exists()).toBe(true);

    await input.trigger('keydown', { key: 'Escape' });
    await flushPromises();
    expect(wrapper.find('[data-test="destination-suggestions"]').exists()).toBe(false);
  });

  it('surfaces failed place search and closes the suggestion popover after blur', async () => {
    vi.useFakeTimers();
    searchLocationsMock.mockRejectedValue(new Error('places unavailable'));
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
      },
    });
    const input = wrapper.get('[data-test="destination-input"]');

    await input.trigger('focus');
    await input.setValue('Tulsa');
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    expect(wrapper.get('[data-test="destination-suggestions"]').text()).toContain('Scope could not search places right now.');

    await input.trigger('blur');
    await vi.advanceTimersByTimeAsync(150);
    await flushPromises();
    expect(wrapper.find('[data-test="destination-suggestions"]').exists()).toBe(false);
  });

  it('adds a suggested stop and emits the refreshed route order', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
        budgetRange: [1500, 3000],
        selectedStops: [selectedStops[0]],
        suggestedStops,
        mobileWizard: true,
        mobileActiveStep: 2,
      },
    });

    await wrapper.get('[data-test="destination-search-input"]').setValue('Torres');
    await wrapper.get('.add-stop-button').trigger('click');

    const latestStops = wrapper.emitted('update:stops')?.at(-1)?.[0] as TripSpot[];
    expect(latestStops).toHaveLength(2);
    expect(latestStops[1]?.title).toBe('Torres del Paine');
  });

  it('reorders and removes selected stops from the route list', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        initialTitle: 'Epic Patagonia Trek',
        selectedStops,
        suggestedStops,
        mobileWizard: true,
        mobileActiveStep: 2,
      },
    });

    const cards = wrapper.findAll('[data-test="trip-stop-card"]');
    const dragStartEvent = new Event('dragstart', { bubbles: true });
    cards[0]?.element.dispatchEvent(dragStartEvent);
    await flushPromises();
    expect(cards[0]?.classes()).toContain('is-dragging');

    await cards[1]?.trigger('dragenter');
    expect(cards[1]?.classes()).toContain('is-drop-target');

    await cards[1]?.trigger('drop');
    const reorderedStops = wrapper.emitted('update:stops')?.at(-1)?.[0] as TripSpot[];
    expect(reorderedStops.map((stop) => stop.spotId)).toEqual(['stop-2', 'stop-1']);

    await wrapper.setProps({ selectedStops: reorderedStops });
    await flushPromises();
    await wrapper.get('button[aria-label="Remove Perito Moreno Glacier"]').trigger('click');

    const remainingStops = wrapper.emitted('update:stops')?.at(-1)?.[0] as TripSpot[];
    expect(remainingStops.map((stop) => stop.spotId)).toEqual(['stop-1']);
    await wrapper.setProps({ selectedStops: remainingStops });
    await flushPromises();
    expect(wrapper.get('button[aria-label="Remove Mount Fitz Roy"]').attributes('disabled')).toBeDefined();
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

  it('filters stored packing blanks and carries a draft checklist into a saved trip scope', async () => {
    localStorage.setItem(
      'scope-trip-planner-packing-checklist:draft:road-trip',
      JSON.stringify([
        { id: 'blank-item', label: '   ', checked: true, custom: true },
        { id: 'camera', label: ' Camera ', checked: true, custom: true },
      ]),
    );

    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        packingChecklistScope: 'draft:road trip',
      },
    });

    expect(wrapper.get('[data-test="trip-packing-card"]').text()).toContain('1/1 packed');
    expect(wrapper.text()).toContain('Camera');

    (wrapper.vm as unknown as { addPackingItem: (label?: string) => void }).addPackingItem('   ');
    await flushPromises();
    expect(wrapper.findAll('.packing-item')).toHaveLength(1);

    await wrapper.setProps({ packingChecklistScope: 'trip:saved-route' });
    await flushPromises();
    expect(localStorage.getItem('scope-trip-planner-packing-checklist:trip:saved-route')).toContain('Camera');

    localStorage.setItem('scope-trip-planner-packing-checklist:trip:not-array', '{"label":"Nope"}');
    await wrapper.setProps({ packingChecklistScope: 'trip:not-array' });
    await flushPromises();

    expect(wrapper.get('[data-test="trip-packing-card"]').text()).toContain('0/6 packed');
    expect(wrapper.text()).toContain('Driver license and registration');
  });

  it('validates low and nonnumeric fuel inputs without re-emitting the active tank type', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        fuelSettings: {
          fuelType: 'regular',
        },
      },
    });
    const fuelEmitCount = wrapper.emitted('update:fuel-settings')?.length ?? 0;

    await wrapper.get('[data-test="fuel-type-option-regular"]').trigger('click');
    expect(wrapper.emitted('update:fuel-settings')?.length ?? 0).toBe(fuelEmitCount);

    await wrapper.get('[data-test="fuel-mpg-input"]').setValue('abc');
    await wrapper.get('[data-test="fuel-price-input"]').setValue('0.001');
    await flushPromises();

    expect(wrapper.get('[data-test="fuel-mpg-error"]').text()).toBe('MPG needs a number.');
    expect(wrapper.get('[data-test="fuel-price-error"]').text()).toBe('Gas price must be at least 0.01.');
    expect(wrapper.get('[data-test="trip-fuel-card"]').text()).toContain('Check fuel inputs');

    await wrapper.get('[data-test="fuel-mpg-input"]').setValue('0');
    await flushPromises();
    expect(wrapper.get('[data-test="fuel-mpg-error"]').text()).toBe('MPG must be at least 1.');
  });

  it('ignores stale weather lookups when the route changes mid-request', async () => {
    vi.useFakeTimers();
    canLoadWeatherMock.mockReturnValue(true);
    let resolveAustinWeather: ((snapshot: Awaited<ReturnType<typeof getWeatherSnapshotMock>>) => void) | undefined;
    const slowAustinWeather = new Promise((resolve) => {
      resolveAustinWeather = resolve;
    });
    getWeatherSnapshotMock
      .mockReturnValueOnce(slowAustinWeather)
      .mockResolvedValueOnce({
        id: 'current-weather',
        label: '   ',
        temperatureF: 74.2,
        condition: 'Clear',
        windMph: 5.4,
        providerLabel: 'OpenWeatherMap',
        checkedAtIso: '2026-05-19T04:00:00.000Z',
      });

    const wrapper = mount(TripPlanner, {
      props: {
        initialValue: {
          ...initialValue,
          destination: 'Austin, TX',
          destinationLatitude: 30.2672,
          destinationLongitude: -97.7431,
          endDestination: '',
        },
      },
    });

    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();
    expect(getWeatherSnapshotMock).toHaveBeenCalledTimes(1);

    await wrapper.setProps({
      initialValue: {
        ...initialValue,
        destination: 'Dallas, TX',
        destinationLatitude: 32.7767,
        destinationLongitude: -96.797,
        endDestination: '',
      },
    });
    await vi.advanceTimersByTimeAsync(250);
    await flushPromises();
    expect(getWeatherSnapshotMock).toHaveBeenCalledTimes(2);

    resolveAustinWeather?.({
      id: 'stale-weather',
      label: 'Austin, TX',
      temperatureF: 99,
      condition: 'Hot',
      windMph: 12,
      providerLabel: 'OpenWeatherMap',
      checkedAtIso: '2026-05-19T04:00:00.000Z',
    });
    await flushPromises();

    const weatherText = wrapper.get('[data-test="trip-weather-card"]').text();
    expect(weatherText).toContain('Route point');
    expect(weatherText).toContain('74°F');
    expect(weatherText).not.toContain('Austin, TX');
    expect(weatherText).not.toContain('AQI');
  });

  it('searches end destinations near the mapped start and applies provider coordinates', async () => {
    vi.useFakeTimers();
    searchLocationsMock.mockResolvedValueOnce({
      data: [
        {
          latitude: 36.154,
          longitude: -95.9928,
          placeName: 'Blue Dome Coffee',
          formattedAddress: 'Blue Dome Coffee, Tulsa, OK, United States',
          city: 'Tulsa',
          country: 'United States',
          precision: 'poi',
          category: 'coffee',
          distanceKm: 50,
          source: 'mapbox',
        },
      ],
    });

    const wrapper = mount(TripPlanner, {
      props: {
        initialValue: {
          ...initialValue,
          destination: 'Austin, TX',
          destinationLatitude: 30.2672,
          destinationLongitude: -97.7431,
          endDestination: '',
          endDestinationLatitude: undefined,
          endDestinationLongitude: undefined,
        },
      },
    });

    const endInput = wrapper.get('[data-test="end-destination-input"]');
    await endInput.trigger('focus');
    await endInput.setValue('Blue Dome');
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    expect(searchLocationsMock).toHaveBeenCalledWith('Blue Dome', {
      limit: 6,
      proximity: {
        latitude: 30.2672,
        longitude: -97.7431,
      },
    });

    const suggestion = wrapper.get('[data-test="end-destination-suggestion"]');
    expect(suggestion.text()).toContain('Blue Dome Coffee');
    expect(suggestion.text()).toContain('Closest');
    expect(suggestion.text()).toContain('31 mi away');

    await suggestion.trigger('click');
    await flushPromises();

    const latestDraft = wrapper.emitted('update:draft')?.at(-1)?.[0] as TripPlannerInput;
    expect(latestDraft.endDestination).toBe('Blue Dome Coffee');
    expect(latestDraft.endDestinationLatitude).toBeCloseTo(36.154);
    expect(latestDraft.endDestinationLongitude).toBeCloseTo(-95.9928);
  });

  it('uses retained location suggestions to resolve typed pinned labels before submit', async () => {
    vi.useFakeTimers();
    searchLocationsMock.mockResolvedValueOnce({
      data: [
        {
          latitude: 10.1234,
          longitude: 20.5678,
          precision: 'address',
        },
      ],
    });

    const wrapper = mount(TripPlanner, {
      props: {
        initialValue: {
          ...initialValue,
          destination: '',
          destinationLatitude: undefined,
          destinationLongitude: undefined,
          endDestination: 'Dallas, TX',
        },
      },
    });
    const startInput = wrapper.get('[data-test="destination-input"]');

    await startInput.setValue('Remote pin');
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    expect(wrapper.get('[data-test="destination-suggestion"]').text()).toContain('10.1234, 20.5678');

    await startInput.setValue('Pinned location');
    await wrapper.get('[data-test="trip-planner"]').trigger('submit');
    await flushPromises();

    const emitted = wrapper.emitted('submit')?.[0]?.[0] as TripPlannerInput;
    expect(emitted.destination).toBe('Pinned location');
    expect(emitted.destinationLatitude).toBeCloseTo(10.1234);
    expect(emitted.destinationLongitude).toBeCloseTo(20.5678);
  });

  it('keeps budget step and typed controls valid when minimum and maximum cross', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue: {
          ...initialValue,
          budgetFloor: 500,
          budget: 500,
        },
      },
    });

    await wrapper.get('[data-test="budget-floor-increment"]').trigger('click');
    expect((wrapper.get('[data-test="budget-floor-input"]').element as HTMLInputElement).value).toBe('600');
    expect((wrapper.get('[data-test="budget-ceiling-input"]').element as HTMLInputElement).value).toBe('600');

    await wrapper.get('[data-test="budget-ceiling-decrement"]').trigger('click');
    expect((wrapper.get('[data-test="budget-floor-input"]').element as HTMLInputElement).value).toBe('500');
    expect((wrapper.get('[data-test="budget-ceiling-input"]').element as HTMLInputElement).value).toBe('500');

    await wrapper.get('[data-test="budget-floor-input"]').setValue('700');
    expect((wrapper.get('[data-test="budget-ceiling-input"]').element as HTMLInputElement).value).toBe('700');
  });

  it('handles default stop additions and no-op route drag edges', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        selectedStops: [selectedStops[0]],
        suggestedStops,
        mobileWizard: true,
        mobileActiveStep: 2,
      },
    });

    await wrapper.get('[data-test="trip-add-stop"]').trigger('click');
    const defaultAddedStops = wrapper.emitted('update:stops')?.at(-1)?.[0] as TripSpot[];
    expect(defaultAddedStops.map((stop) => stop.spotId)).toEqual(['stop-1', 'stop-2']);

    await wrapper.setProps({ selectedStops: suggestedStops });
    await flushPromises();
    const emitCountBeforeNoMatch = wrapper.emitted('update:stops')?.length ?? 0;

    await wrapper.get('[data-test="trip-add-stop"]').trigger('click');
    expect(wrapper.emitted('update:stops')?.length ?? 0).toBe(emitCountBeforeNoMatch);

    const cards = wrapper.findAll('[data-test="trip-stop-card"]');
    const dataTransfer = {
      effectAllowed: '',
      setData: vi.fn(),
    };
    await cards[0]?.trigger('dragstart', { dataTransfer });
    expect(dataTransfer.effectAllowed).toBe('move');
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'stop-1');

    await cards[0]?.trigger('drop');
    expect(wrapper.emitted('update:stops')?.length ?? 0).toBe(emitCountBeforeNoMatch);

    await cards[0]?.trigger('dragend');
    expect(cards[0]?.classes()).not.toContain('is-dragging');
  });

  it('renders mobile wizard summaries for submitted and optional-interest route states', async () => {
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue: {
          destination: '100 Main Street, Fort Worth, TX',
          endDestination: 'Austin, TX',
          startDate: '2026-04-01',
          endDate: '2026-04-01',
          interests: ['other'],
          pace: 'relaxed',
          budgetFloor: 0,
          budget: 1000,
        },
        selectedStops: [
          {
            spotId: 'mobile-stop',
            title: '',
            latitude: 32.7555,
            longitude: -97.3308,
            category: 'other',
            city: '',
            photoUrl: undefined,
            estimatedCost: undefined,
            timeSlot: undefined,
          },
        ],
        mobileWizard: true,
        mobileActiveStep: 3,
        submitting: true,
      },
    });

    await flushPromises();

    expect(wrapper.attributes('data-planner-mode')).toBe('mobile-wizard');
    expect(wrapper.text()).toContain('100 Main Street, Fort Worth to Austin, TX');
    expect(wrapper.text()).toContain('1 day');
    expect(wrapper.text()).toContain('1 stop');
    expect(wrapper.text()).toContain('Relaxed pace');
    expect(wrapper.text()).toContain('1 interest');
    expect(wrapper.text()).toContain('Guide is building...');
    expect(wrapper.find('[data-test="planner-step-3-back"]').exists()).toBe(true);
    expect(wrapper.find('.field-error').exists()).toBe(false);

    await wrapper.setProps({
      initialValue: {
        destination: '',
        endDestination: '',
        interests: [],
        pace: 'packed',
      },
      selectedStops: [],
      mobileActiveStep: 1,
      submitting: false,
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Pick a place to plan around');
    expect(wrapper.text()).toContain('Stops appear after a destination is selected.');
    expect(wrapper.text()).toContain('Packed pace');
    expect(wrapper.text()).toContain('vibes optional');
    expect(wrapper.text()).toContain('Build with Trip Guide');

    await wrapper.get('[data-test="planner-step-1-continue"]').trigger('click');
    expect(wrapper.emitted('wizard-step-change')?.at(-1)?.[0]).toBe(2);
  });

  it('surfaces route validation errors for blank, start-only, and reversed-date drafts', async () => {
    const blankWrapper = mount(TripPlanner, {
      props: {
        initialValue: {
          ...initialValue,
          destination: '',
          endDestination: '',
          startDate: '',
          endDate: '',
          groupSize: 0,
        },
      },
    });

    await blankWrapper.get('[data-test="trip-planner"]').trigger('submit');
    await flushPromises();

    expect(blankWrapper.text()).toContain('Enter a start or final city, state, or place so Scope can build a route.');
    expect(blankWrapper.text()).toContain('Add a valid start date.');
    expect(blankWrapper.text()).toContain('Add a valid end date.');
    expect(blankWrapper.text()).toContain('Group size must stay between 1 and 12.');
    expect(blankWrapper.emitted('submit')).toBeUndefined();

    const startOnlyWrapper = mount(TripPlanner, {
      props: {
        initialValue: {
          ...initialValue,
          destination: 'Fort Worth, TX',
          endDestination: '',
        },
      },
    });

    await startOnlyWrapper.get('[data-test="trip-planner"]').trigger('submit');
    await flushPromises();

    expect(startOnlyWrapper.text()).toContain('Enter a final destination so Scope can build the itinerary.');
    expect(startOnlyWrapper.emitted('submit')).toBeUndefined();

    const reversedDatesWrapper = mount(TripPlanner, {
      props: {
        initialValue: {
          ...initialValue,
          startDate: '2026-04-04',
          endDate: '2026-04-01',
        },
      },
    });

    await reversedDatesWrapper.get('[data-test="trip-planner"]').trigger('submit');
    await flushPromises();

    expect(reversedDatesWrapper.text()).toContain('End date must be on or after the start date.');
    expect(reversedDatesWrapper.emitted('submit')).toBeUndefined();
  });

  it('exercises exposed planner helper guard paths for locations, fuel, packing, and weather', async () => {
    localStorage.setItem('scope-trip-planner-packing-checklist:trip:stored', JSON.stringify([
      { id: 'stored-item', label: 'Stored blanket', checked: true, custom: true },
      { id: '', label: '', checked: true },
    ]));
    localStorage.setItem('scope-trip-planner-packing-checklist:trip:broken-shape', JSON.stringify({ bad: true }));

    const wrapper = mount(TripPlanner, {
      props: {
        initialValue: {
          ...initialValue,
          destinationLatitude: 32.7555,
          destinationLongitude: -97.3308,
          endDestinationLatitude: undefined,
          endDestinationLongitude: undefined,
          budgetFloor: -50,
          budget: -10,
          groupSize: 99,
          startDate: 'bad-date',
          endDate: '2026-04-01',
        },
        packingChecklistScope: 'trip:stored',
        fuelSettings: { fuelType: 'ev' },
        selectedStops,
      },
    });
    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;

    expect(coverage.normalizePackingItem({ label: '  Camera  ', checked: 1 }, 4)).toMatchObject({
      id: 'packing-item-4',
      label: 'Camera',
      checked: true,
    });
    expect(coverage.normalizePackingItem({ label: ' ' }, 1)).toBeNull();
    expect(coverage.cloneDefaultPackingItems()).toHaveLength(6);
    expect(coverage.normalizePackingChecklistScope(' trip alpha ')).toBe('trip-alpha');
    expect(coverage.normalizePackingChecklistScope('')).toBe('draft:standalone');
    expect(coverage.isDraftPackingChecklistScope('draft:abc')).toBe(true);
    expect(coverage.getPackingChecklistStorageKey('trip:stored')).toBe('scope-trip-planner-packing-checklist:trip:stored');
    expect(coverage.readPackingChecklistStorage('scope-trip-planner-packing-checklist:trip:stored')).toEqual([
      expect.objectContaining({ id: 'stored-item', label: 'Stored blanket' }),
    ]);
    expect(coverage.readPackingChecklistStorage('scope-trip-planner-packing-checklist:trip:broken-shape')).toBeNull();
    expect(coverage.loadPackingChecklist('scope-trip-planner-packing-checklist:missing')).toHaveLength(6);
    coverage.persistPackingChecklist('scope-trip-planner-packing-checklist:trip:persisted');
    expect(localStorage.getItem('scope-trip-planner-packing-checklist:trip:persisted')).toContain('Stored blanket');

    expect(coverage.parseFuelNumber(' 24.5 ')).toBe(24.5);
    expect(coverage.parseFuelNumber('')).toBeUndefined();
    expect(coverage.parseBoundedFuelNumber('201', 1, 200)).toBeUndefined();
    expect(coverage.formatFuelLimit(0.5)).toBe('0.50');
    expect(coverage.getFuelInputError('', 'MPG', 1, 200)).toBe('');
    expect(coverage.getFuelInputError('abc', 'MPG', 1, 200)).toBe('MPG needs a number.');
    expect(coverage.getFuelInputError('0', 'MPG', 1, 200)).toBe('MPG must be at least 1.');
    expect(coverage.getFuelInputError('201', 'MPG', 1, 200)).toBe('MPG must be 200 or less.');
    expect(coverage.formatFuelInputValue(0)).toBe('');
    expect(coverage.normalizeTripFuelType('rocket')).toBe('regular');
    coverage.selectFuelType('diesel');
    expect(wrapper.emitted('update:fuel-settings')?.at(-1)?.[0]).toMatchObject({ fuelType: 'diesel' });

    expect(coverage.formatWeatherTemperature(71.6)).toBe('72°F');
    expect(coverage.formatWeatherWind(12.4)).toBe('12 mph');
    expect(coverage.formatWeatherAirQuality(null)).toBe('');
    expect(coverage.formatWeatherAirQuality({ index: 42, label: 'Good', scale: 'us' })).toBe('42 Good');
    expect(coverage.formatWeatherAirQuality({ index: 2, label: 'Moderate', scale: 'eu' })).toBe('Moderate');
    expect(coverage.formatWeatherCheckedAt('bad')).toBe('just now');
    expect(coverage.formatWeatherProvider({ provider: undefined, providerLabel: undefined })).toBe('Scope weather');
    expect(coverage.getWeatherCheckedTimestamp({ checkedAtIso: undefined, observedAtIso: '2026-04-01T00:00:00Z' })).toBe('2026-04-01T00:00:00Z');
    expect(coverage.formatWeatherLocationLabel('100 Main Road, Dallas, TX')).toBe('Dallas');
    expect(coverage.formatWeatherLocationLabel('')).toBe('Route point');
    expect(coverage.getWeatherSnapshotClass({ condition: 'Rain', iconCode: '10d' })).toEqual(expect.any(String));
    expect(coverage.getWeatherSnapshotIcon({ condition: 'Rain', iconCode: '10d' })).toEqual(expect.any(String));

    expect(coverage.formatLocationSuggestionTitle({ precision: 'poi', placeName: 'Botanic Garden' })).toBe('Botanic Garden');
    expect(coverage.formatLocationSuggestionTitle({ formattedAddress: '500 Main' })).toBe('500 Main');
    expect(coverage.formatLocationSuggestionMeta({
      precision: 'poi',
      latitude: 32.7,
      longitude: -97.3,
      distanceKm: 1,
      city: 'Fort Worth',
      country: 'US',
      category: 'park',
    })).toContain('0.6 mi away');
    expect(coverage.formatLocationSuggestionMeta({ latitude: 32.7555, longitude: -97.3308 })).toBe('32.7555, -97.3308');
    expect(coverage.formatLocationSuggestionBadge({ precision: 'poi', distanceKm: 1 }, 0)).toBe('Closest');
    expect(coverage.formatLocationSuggestionBadge({ precision: 'address' }, 0)).toBe('Best match');
    expect(coverage.formatLocationSuggestionBadge({ precision: 'address' }, 2)).toBe('');
    expect(coverage.formatDistanceMiles(20)).toBe('12 mi');

    expect(coverage.isCoordinatePair(32.7, -97.3)).toBe(true);
    expect(coverage.isCoordinatePair(99, -97.3)).toBe(false);
    expect(coverage.resolveLocationCoordinatePayload('destination')).toMatchObject({ destinationLatitude: 32.7555 });
    expect(coverage.resolveLocationSearchProximity('endDestination')).toMatchObject({ latitude: 32.7555, longitude: -97.3308 });
    expect(coverage.shouldShowLocationSuggestions('destination')).toBe(false);
    coverage.handleLocationFocus('destination');
    expect(coverage.shouldShowLocationSuggestions('destination')).toBe(true);
    coverage.handleLocationInput('destination');
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    coverage.handleLocationKeydown('destination', escapeEvent);
    expect(coverage.shouldShowLocationSuggestions('destination')).toBe(false);
    coverage.handleLocationBlur('destination');
    coverage.resetLocationSuggestionState('destination');
    coverage.errors.value = { endDestination: 'Pick a final destination.' };
    coverage.clearEndDestination();
    expect(coverage.errors.value.endDestination).toBeUndefined();
    expect(coverage.resolveErrorStep({ destination: 'Missing start' })).toBe(1);
    expect(coverage.resolveErrorStep({ endDestination: 'Missing end' })).toBe(1);
    expect(coverage.resolveErrorStep({ startDate: 'Missing start date' })).toBe(1);
    expect(coverage.resolveErrorStep({ endDate: 'Missing end date' })).toBe(1);
    expect(coverage.resolveErrorStep({ budget: 'Bad budget' })).toBe(1);
    expect(coverage.resolveErrorStep({ groupSize: 'Bad group' })).toBe(1);
    expect(coverage.resolveErrorStep({ interests: 'Pick one interest' })).toBe(3);
    expect(coverage.resolveErrorStep({})).toBe(1);

    expect(coverage.normalizeBudgetRange([1000, 500])).toMatchObject({ min: 500, max: 1000 });
    expect(coverage.normalizeBudgetValue(Number.NaN, 77)).toBe(77);
    expect(coverage.validatePlanner()).toMatchObject({
      startDate: 'Add a valid start date.',
      groupSize: 'Group size must stay between 1 and 12.',
    });
    expect(coverage.buildFormState({ destinationLatitude: 120, endDestinationLongitude: -200 })).toMatchObject({
      destinationLatitude: undefined,
      endDestinationLongitude: undefined,
    });
    coverage.form.endDestination = 'Dallas, TX';
    expect(coverage.buildPlannerPayload()).toMatchObject({
      destination: 'Fort Worth, TX',
      endDestination: 'Dallas, TX',
    });
  });

  it('keeps packing and location helpers safe when browser storage or suggestion results are unavailable', async () => {
    const storageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: undefined,
    });

    try {
      const storageUnavailableWrapper = mount(TripPlanner, {
        props: {
          initialValue,
          packingChecklistScope: 'trip:offline-storage',
        },
      });
      const offlineCoverage = (storageUnavailableWrapper.vm as any).__coverage as Record<string, any>;

      expect(offlineCoverage.readPackingChecklistStorage()).toBeNull();
      expect(offlineCoverage.loadPackingChecklist()).toHaveLength(6);
      expect(() => offlineCoverage.persistPackingChecklist()).not.toThrow();

      storageUnavailableWrapper.unmount();
    } finally {
      if (storageDescriptor) {
        Object.defineProperty(window, 'localStorage', storageDescriptor);
      }
    }

    localStorage.setItem(
      'scope-trip-planner-packing-checklist:trip:empty-normalized',
      JSON.stringify([{ id: '', label: '   ' }, { checked: true }]),
    );

    const wrapper = mount(TripPlanner, {
      props: {
        initialValue,
        packingChecklistScope: 'trip:empty-normalized',
        locationSearchProximity: {
          latitude: 35,
          longitude: -90,
        },
      },
    });
    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;

    expect(coverage.readPackingChecklistStorage('scope-trip-planner-packing-checklist:trip:empty-normalized')).toBeNull();
    expect(coverage.normalizePackingChecklistScope()).toBe('trip:empty-normalized');
    expect(coverage.getPackingChecklistStorageKey()).toBe('scope-trip-planner-packing-checklist:trip:empty-normalized');
    expect(coverage.normalizeBudgetRange()).toMatchObject({ step: 100 });
    expect(coverage.normalizeBudgetValue(undefined)).toBe(0);
    expect(coverage.buildFormState({})).toMatchObject({
      destination: '',
      endDestination: '',
      budgetFloor: 500,
      budget: 1500,
      interests: [],
      pace: 'relaxed',
      groupSize: 1,
    });

    const timers = {
      destination: setTimeout(() => undefined, 1),
      endDestination: null,
    };
    coverage.clearLocationTimer(timers, 'destination');
    expect(timers.destination).toBeNull();

    coverage.resetLocationSuggestionState('destination');
    coverage.handleLocationFocus('destination');
    const arrowDown = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
    coverage.handleLocationKeydown('destination', arrowDown);
    expect(arrowDown.defaultPrevented).toBe(true);

    const arrowUp = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true });
    coverage.handleLocationKeydown('destination', arrowUp);
    expect(arrowUp.defaultPrevented).toBe(true);

    const enterWithoutSelection = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    coverage.handleLocationKeydown('destination', enterWithoutSelection);
    expect(enterWithoutSelection.defaultPrevented).toBe(false);

    coverage.form.endDestinationLatitude = 34;
    coverage.form.endDestinationLongitude = -91;
    expect(coverage.resolveLocationSearchProximity('destination')).toEqual({
      latitude: 34,
      longitude: -91,
    });
    coverage.form.endDestinationLatitude = undefined;
    coverage.form.endDestinationLongitude = undefined;
    expect(coverage.resolveLocationSearchProximity('destination')).toEqual({
      latitude: 35,
      longitude: -90,
    });

    wrapper.unmount();
  });

  it('covers planner computed fallbacks, route labels, stop mutations, and budget guards', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-02T09:15:00.000Z'));

    const wrapper = mount(TripPlanner, {
      props: {
        initialValue: {
          ...initialValue,
          destination: '100 Main Street, Fort Worth, TX',
          endDestination: 'Fort Worth, TX',
          budgetFloor: 1000,
          budget: 600,
          interests: ['food', 'culture', 'nightlife', 'nature'],
          pace: 'packed',
          groupSize: 20,
        },
        suggestedStops,
        selectedStops: [selectedStops[0]!],
        packingChecklistScope: '  ',
        fuelSettings: {
          mpg: 0,
          gasPricePerGallon: 25,
          fuelType: 'premium',
        },
      },
    });
    await flushPromises();

    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    const read = <T>(entry: T | { value: T }): T => (
      entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry as T
    );

    expect(coverage.getLocationSegments(' 100 Main Street, Fort Worth, TX ')).toEqual([
      '100 Main Street',
      'Fort Worth',
      'TX',
    ]);
    expect(coverage.getLocationRegionHint('100 Main Street, Fort Worth, TX')).toBe('TX');
    expect(coverage.getLocationRegionHint('Fort Worth, TX, US')).toBe('TX, US');
    expect(coverage.getLikelyCityLabel('100 Main Street, Fort Worth, TX')).toBe('Fort Worth');
    expect(coverage.getLikelyCityLabel('Fort Worth, TX')).toBe('Fort Worth');
    expect(coverage.getLikelyCityLabel('Solo City')).toBe('Solo City');
    expect(coverage.buildWeatherSearchLabels('Fort Worth, TX', 'Dallas, TX')).toEqual(['Fort Worth']);
    expect(coverage.buildWeatherSearchLabels('100 Main Street, Fort Worth, TX', 'Dallas, TX')).toEqual([
      'Fort Worth, TX',
      'Fort Worth',
    ]);
    expect(read(coverage.weatherLookupPoints)).toHaveLength(2);
    expect(read<string>(coverage.weatherLookupKey)).toContain('100 Main Street');
    expect(read<string>(coverage.weatherStatusCopy)).toContain('route has a city');

    expect(coverage.formatRouteEndpointLabel(undefined)).toBe('');
    expect(coverage.formatRouteEndpointLabel('100 Main Street, Fort Worth, TX')).toBe('100 Main Street, Fort Worth');
    expect(read<string>(coverage.destinationLabel)).toBe('100 Main Street, Fort Worth to Fort Worth, TX');
    expect(read<boolean>(coverage.hasPlannerRouteSeed)).toBe(true);
    expect(read<string>(coverage.interestsMetaLabel)).toBe('4 selected');
    expect(read<string>(coverage.interestsLabel)).toBe('Food, Culture, Nightlife +1 more');
    expect(read<string>(coverage.guideHandoffCopy)).toContain('route first');
    expect(read<Array<string>>(coverage.visibleInterestCategories)).toEqual(expect.not.arrayContaining(['other']));
    coverage.toggleCategory('other');
    expect(read<Array<string>>(coverage.visibleInterestCategories)).toContain('other');
    expect(read<string>(coverage.stepOneSummary)).toContain('3 days');
    expect(read<string>(coverage.stepTwoSummary)).toContain('1 stop');
    expect(read<string>(coverage.stepThreeSummary)).toContain('5 interests');

    expect(read<string>(coverage.fuelSettingsSummary)).toBe('Check fuel inputs');
    expect(read<string>(coverage.fuelMpgError)).toBe('');
    expect(read<string>(coverage.fuelGasPriceError)).toContain('$20.00/gal');
    await wrapper.setProps({
      fuelSettings: {
        mpg: 24.5,
        gasPricePerGallon: 4.199,
        fuelType: 'diesel',
      },
    });
    await flushPromises();
    expect(read<string>(coverage.fuelSettingsSummary)).toContain('Diesel / 24.5 MPG / $4.20/gal');

    expect(read<string>(coverage.packingProgressLabel)).toBe('0/6 packed');
    coverage.addPackingItem('  Backup rain poncho  ');
    expect(read<string>(coverage.packingProgressLabel)).toBe('0/7 packed');
    coverage.addPackingItem('   ');
    expect(read<string>(coverage.packingProgressLabel)).toBe('0/7 packed');
    coverage.removePackingItem('backup rain poncho');
    expect(read<string>(coverage.packingProgressLabel)).toBe('0/6 packed');

    const normalizedStops = coverage.normalizeStops([
      { spotId: 'alpha', title: 'Alpha', latitude: 1, longitude: 2, category: 'food', timeSlot: undefined },
      { spotId: 'beta', title: 'Beta', latitude: 3, longitude: 4, category: 'culture', timeSlot: undefined },
      { spotId: 'gamma', title: 'Gamma', latitude: 5, longitude: 6, category: 'nature', timeSlot: undefined },
      { spotId: 'delta', title: 'Delta', latitude: 7, longitude: 8, category: 'scenic', timeSlot: undefined },
      { spotId: 'epsilon', title: 'Epsilon', latitude: 9, longitude: 10, category: 'nightlife', timeSlot: undefined },
    ]);
    expect(normalizedStops.every((stop: TripSpot) => Boolean(stop.timeSlot))).toBe(true);
    coverage.syncStops(normalizedStops.slice(0, 2));
    expect(wrapper.emitted('update:stops')?.at(-1)?.[0]).toHaveLength(2);

    coverage.removeStop('alpha');
    expect(wrapper.emitted('update:stops')?.at(-1)?.[0]).toHaveLength(1);
    coverage.removeStop('beta');
    expect(wrapper.emitted('update:stops')?.at(-1)?.[0]).toHaveLength(1);

    coverage.handleAddSuggestedStop();
    expect(wrapper.emitted('update:stops')?.at(-1)?.[0]).toHaveLength(2);

    const transfer = {
      effectAllowed: '',
      setData: vi.fn(),
    };
    coverage.handleDragStart('stop-1', { dataTransfer: transfer } as unknown as DragEvent);
    expect(transfer.effectAllowed).toBe('move');
    expect(transfer.setData).toHaveBeenCalledWith('text/plain', 'stop-1');
    coverage.handleDragEnter('stop-2');
    coverage.handleDrop('stop-2');
    expect(wrapper.emitted('update:stops')?.at(-1)?.[0]).toEqual(expect.any(Array));
    coverage.handleDrop('missing');
    coverage.handleDragEnd();

    const floorInput = document.createElement('input');
    floorInput.value = '-100';
    coverage.handleBudgetFloorNumberInput({ target: floorInput } as unknown as Event);
    expect(read<string>(coverage.budgetRangeLabel)).toContain('$0');
    const ceilingInput = document.createElement('input');
    ceilingInput.value = '250';
    coverage.handleBudgetCeilingNumberInput({ target: ceilingInput } as unknown as Event);
    expect(read<string>(coverage.dailyBudgetLabel)).toContain('/ day');
    coverage.updateGroupSize(99);
    expect(coverage.form.groupSize).toBe(12);
    coverage.updateGroupSize(-4);
    expect(coverage.form.groupSize).toBe(1);

    expect(coverage.toCalendarDayNumber('2026-02-30')).toEqual(Number.NaN);
    expect(coverage.toCalendarDayNumber('2026-02-28')).toEqual(expect.any(Number));
    coverage.form.destination = '';
    coverage.form.endDestination = '';
    coverage.form.destinationLatitude = undefined;
    coverage.form.destinationLongitude = undefined;
    coverage.form.endDestinationLatitude = undefined;
    coverage.form.endDestinationLongitude = undefined;
    coverage.syncStops([]);
    expect(read<boolean>(coverage.hasPlannerRouteSeed)).toBe(false);
    expect(read<string>(coverage.destinationLabel)).toBe('Pick a place to plan around');
    expect(read<string>(coverage.guideHandoffCopy)).toContain('Set a real route first');
    expect(read<string>(coverage.stepTwoSummary)).toContain('Stops appear');

    wrapper.unmount();
  });

  it('drives planner guard states for weather, wizard, fuel, budget, and location suggestions', async () => {
    vi.useFakeTimers();
    const wrapper = mount(TripPlanner, {
      props: {
        initialValue: {
          destination: '',
          endDestination: undefined as never,
          startDate: '2026-07-04',
          endDate: '2026-07-04',
          budgetFloor: 200,
          budget: 400,
          interests: [],
          pace: 'mystery' as never,
          groupSize: 1,
        },
        mobileWizard: true,
        mobileActiveStep: 2,
      },
    });
    await flushPromises();

    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    const read = <T>(entry: T | { value: T }): T => (
      entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry as T
    );

    coverage.weatherState.value = 'loading';
    expect(read<string>(coverage.weatherStatusCopy)).toBe('Checking live weather...');
    coverage.weatherState.value = 'missing-key';
    expect(read<string>(coverage.weatherStatusCopy)).toContain('browser fetch');
    coverage.weatherState.value = 'error';
    coverage.weatherErrorMessage.value = '';
    expect(read<string>(coverage.weatherStatusCopy)).toBe('Weather is unavailable right now.');
    coverage.weatherState.value = 'empty';
    expect(read<string>(coverage.weatherStatusCopy)).toContain('Add an origin');

    expect(coverage.getWizardStepState(1)).toBe('complete');
    expect(coverage.getWizardStepState(2)).toBe('current');
    expect(coverage.getWizardStepState(3)).toBe('upcoming');
    expect(coverage.getWizardStepLabel(1)).toBe('Done');
    expect(coverage.getWizardStepLabel(2)).toBe('Current');
    expect(coverage.getWizardStepLabel(3)).toBe('Next');
    expect(coverage.clampWizardStep(0)).toBe(1);
    expect(coverage.clampWizardStep(9)).toBe(4);
    coverage.emitWizardStepChange(9);
    expect(wrapper.emitted('wizard-step-change')?.at(-1)?.[0]).toBe(4);

    coverage.form.pace = 'unknown';
    expect(read<string>(coverage.stepThreeSummary)).toContain('Moderate pace');
    coverage.selectedFuelType.value = 'not-real';
    coverage.fuelMpgInput.value = '';
    coverage.fuelGasPriceInput.value = '';
    expect(read<string>(coverage.fuelSettingsSummary)).toBe('Regular tank');
    coverage.fuelMpgInput.value = '24';
    expect(read<string>(coverage.fuelSettingsSummary)).toBe('Regular / add gas price');
    coverage.fuelMpgInput.value = '';
    coverage.fuelGasPriceInput.value = '4.50';
    expect(read<string>(coverage.fuelSettingsSummary)).toBe('Regular / add MPG');

    coverage.budgetFloor.value = -1;
    coverage.budgetCeiling.value = 100;
    expect(coverage.validatePlanner()).toMatchObject({ budget: 'Budget values must be zero or higher.' });
    coverage.budgetFloor.value = 500;
    coverage.budgetCeiling.value = 100;
    expect(coverage.validatePlanner()).toMatchObject({
      budget: 'Maximum budget must be at least the minimum budget.'
    });
    coverage.normalizeBudgetInputs();
    expect(coverage.budgetCeiling.value).toBeGreaterThanOrEqual(coverage.budgetFloor.value);

    expect(coverage.formatRouteEndpointLabel('')).toBe('');
    expect(coverage.formatRouteEndpointLabel(', Austin, TX')).toBe('Austin, TX');
    expect(coverage.getLocationRegionHint('100 Main Street, Fort Worth')).toBe('');
    expect(coverage.buildWeatherSearchLabels('Fort Worth, TX', 'Fort Worth, TX')).toEqual(['Fort Worth']);
    coverage.form.endDestination = undefined;
    expect(coverage.buildPlannerPayload()).not.toHaveProperty('endDestination');
    coverage.form.destinationLatitude = 91;
    coverage.form.destinationLongitude = -97;
    expect(coverage.resolveLocationCoordinatePayload('destination')).toEqual({});

    const poiResult = {
      placeName: 'Coffee Hall',
      formattedAddress: '',
      address: '',
      latitude: 32.75,
      longitude: -97.33,
      precision: 'poi',
      city: '',
      country: '',
      category: 'coffee',
      distanceKm: 1.5,
    };
    expect(coverage.formatLocationSuggestionTitle(poiResult)).toBe('Coffee Hall');
    expect(coverage.formatLocationSuggestionMeta(poiResult)).toContain('0.9 mi away');
    expect(coverage.formatLocationSuggestionMeta({
      ...poiResult,
      precision: 'address',
      city: 'Fort Worth',
      country: 'United States',
      distanceKm: undefined,
    })).toBe('Fort Worth, United States');
    expect(coverage.formatLocationSuggestionMeta({
      ...poiResult,
      precision: 'address',
      placeName: '',
      city: '',
      country: '',
      distanceKm: undefined,
    })).toBe('32.7500, -97.3300');
    expect(coverage.formatLocationSuggestionBadge(poiResult, 0)).toBe('Closest');
    expect(coverage.formatLocationSuggestionBadge({ ...poiResult, distanceKm: undefined }, 0)).toBe('Best match');
    expect(coverage.formatLocationSuggestionBadge(poiResult, 1)).toBe('');

    const state = coverage.locationSuggestions.destination;
    coverage.setLocationFieldValue('destination', 'Co');
    state.open = true;
    state.loading = false;
    state.error = '';
    state.results = [];
    expect(coverage.shouldShowLocationSuggestions('destination')).toBe(false);
    coverage.setLocationFieldValue('destination', 'Coffee');
    expect(coverage.shouldShowLocationSuggestions('destination')).toBe(true);
    state.error = 'Provider down';
    expect(coverage.shouldShowLocationSuggestions('destination')).toBe(true);
    state.error = '';
    state.loading = true;
    expect(coverage.shouldShowLocationSuggestions('destination')).toBe(true);
    state.loading = false;
    state.results = [poiResult];
    state.activeIndex = 0;
    const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    coverage.handleLocationKeydown('destination', enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(coverage.form.destination).toBe('Coffee Hall');
    expect(coverage.resolveLocationCoordinatePayload('destination')).toMatchObject({
      destinationLatitude: 32.75,
      destinationLongitude: -97.33,
    });

    coverage.errors.value = { destination: 'Required', endDestination: 'Required' };
    coverage.setLocationFieldValue('destination', 'Dallas');
    coverage.handleLocationInput('destination');
    expect(coverage.errors.value.destination).toBeUndefined();
    coverage.clearEndDestination();
    expect(coverage.errors.value.endDestination).toBeUndefined();

    wrapper.unmount();
  });
});
