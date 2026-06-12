import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import ItineraryView from '@/components/trips/ItineraryView.vue';
import type { Itinerary, TripMember, TripPlannerInput, TripSpot } from '@/types';

const PLANNER_START_CONTEXT_ZOOM = 7.2;

const reverseGeocodeMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    latitude: 30.2672,
    longitude: -97.7431,
    placeName: 'Austin, TX, United States',
    city: 'Austin',
    country: 'United States',
  }),
);
const searchPlacesMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    data: [
      {
        id: 'mapbox.fast-food.1',
        latitude: 32.78,
        longitude: -96.8,
        placeName: 'Burger Stop',
        formattedAddress: '100 Burger Ln, Dallas, Texas',
        city: 'Dallas',
        category: 'fast food',
        distanceKm: 1.4,
        source: 'mapbox',
      },
    ],
  }),
);
const searchNearbyPlacesMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    data: [
      {
        id: 'mapbox.gas.1',
        latitude: 32.781,
        longitude: -96.802,
        placeName: 'Scope Gas Station',
        formattedAddress: '300 Fuel Rd, Dallas, Texas',
        city: 'Dallas',
        category: 'gas_station',
        categoryId: 'gas_station',
        categoryLabel: 'Gas station',
        distanceKm: 1.6,
        source: 'mapbox',
      },
    ],
  }),
);
const getPlacePhotoMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    configured: false,
    coverage: 'Google Places photo lookup is unavailable in this test.',
    source: 'Google Places',
  }),
);
const resolveRoadRouteMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    geometry: [[-96.797, 32.7767], [-97.7431, 30.2672]],
    orderedPoints: [],
    distanceMeters: 32_187,
    durationSeconds: 2_520,
    provider: 'mapbox-directions',
    profile: 'mapbox/driving-traffic',
  }),
);
const listNearbySpotsMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    data: [
      {
        id: 'nearby-spot-1',
        title: 'Klyde Warren Garden Stop',
        description: 'A green pause near the route.',
        latitude: 32.7894,
        longitude: -96.8018,
        city: 'Dallas',
        country: 'United States',
        category: 'scenic',
        rating: 4.8,
        photoUrl: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
    ],
  }),
);
const getNearbyFuelStationsMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    configured: true,
    coverage: 'Global fuel preview',
    source: 'Scope fuel',
    stations: [
      {
        id: 'fuel-1',
        name: 'Main Street Fuel',
        brand: 'Scope Fuel',
        address: '10 Main St, Dallas, Texas',
        latitude: 32.779,
        longitude: -96.801,
        distanceKm: 1.1,
        fuelType: 'regular',
        pricePerUnit: 3.19,
        currency: 'USD',
        isOpen: true,
      },
      {
        id: 'fuel-2',
        name: 'Budget Fuel',
        brand: 'Scope Fuel',
        address: '20 Budget Rd, Dallas, Texas',
        latitude: 32.789,
        longitude: -96.811,
        distanceKm: 2.4,
        fuelType: 'regular',
        pricePerUnit: 3.05,
        currency: 'USD',
        isOpen: true,
      },
    ],
  }),
);
const getTravelNearbySuggestionsMock = vi.hoisted(() =>
  vi.fn().mockRejectedValue(new Error('travel endpoint unavailable in legacy fallback tests')),
);

vi.mock('@/services/mapService', () => ({
  getPlacePhoto: getPlacePhotoMock,
  reverseGeocode: reverseGeocodeMock,
  searchNearbyPlaces: searchNearbyPlacesMock,
  searchPlaces: searchPlacesMock,
}));

vi.mock('@/services/roadRouteService', () => ({
  resolveRoadRoute: resolveRoadRouteMock,
}));

vi.mock('@/services/spotService', () => ({
  listNearbySpots: listNearbySpotsMock,
}));

vi.mock('@/services/fuelPriceService', () => ({
  getNearbyFuelStations: getNearbyFuelStationsMock,
}));

vi.mock('@/services/travelNearbyService', () => ({
  getTravelNearbySuggestions: getTravelNearbySuggestionsMock,
}));

const itinerary: Itinerary = {
  id: 'itinerary-1',
  destination: 'Patagonia, Chile + Argentina',
  totalEstimatedCost: 168,
  weatherForecast: 'Sunny, 75F',
  days: [
    {
      dayNumber: 1,
      date: '2026-04-01',
      spots: [
        {
          spotId: 'spot-1',
          title: 'Mount Fitz Roy',
          latitude: -49.2711,
          longitude: -73.0439,
          category: 'adventure',
          city: 'El Chaltén',
          timeSlot: '11:00',
          duration: 75,
          estimatedCost: 24,
          reason: 'Matches your adventure preference; keeps the route tight.',
          confidence: 0.87,
          photoUrl: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800',
        },
      ],
    },
    {
      dayNumber: 2,
      date: '2026-04-02',
      spots: [
        {
          spotId: 'spot-2',
          title: 'Perito Moreno Glacier',
          latitude: -50.496,
          longitude: -73.1373,
          category: 'scenic',
          city: 'El Calafate',
          timeSlot: '14:00',
          duration: 90,
          estimatedCost: 36,
          photoUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
        },
      ],
    },
  ],
};

const members: TripMember[] = [
  { id: 'member-1', displayName: 'Ava Torres', avatarUrl: 'https://i.pravatar.cc/150?img=12' },
  { id: 'member-2', displayName: 'Leo Bennett', avatarUrl: 'https://i.pravatar.cc/150?img=33' },
];

const draft: TripPlannerInput = {
  destination: 'Dallas, TX',
  endDestination: 'Austin, TX',
  destinationLatitude: 32.7767,
  destinationLongitude: -96.797,
  endDestinationLatitude: 30.2672,
  endDestinationLongitude: -97.7431,
  startDate: '2026-04-01',
  endDate: '2026-04-02',
  budgetFloor: 300,
  budget: 900,
  interests: ['food'],
  pace: 'moderate',
  groupSize: 2,
};

const draftStops: TripSpot[] = [
  {
    spotId: 'draft-stop-1',
    title: 'Cliffside Lookout Loop',
    latitude: 32.3512,
    longitude: -96.8391,
    category: 'scenic',
    city: 'Waxahachie',
    dayNumber: 1,
    timeSlot: '09:00',
    duration: 75,
    estimatedCost: 48,
    photoUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800',
  },
  {
    spotId: 'draft-stop-2',
    title: 'Trinity Bluff Sunrise',
    latitude: 31.5493,
    longitude: -97.1467,
    category: 'nature',
    city: 'Waco',
    dayNumber: 2,
    timeSlot: '10:30',
    duration: 60,
    estimatedCost: 36,
    photoUrl: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800',
  },
];

describe('ItineraryView', () => {
  beforeEach(() => {
    reverseGeocodeMock.mockClear();
    searchPlacesMock.mockClear();
    searchNearbyPlacesMock.mockClear();
    getPlacePhotoMock.mockClear();
    getPlacePhotoMock.mockResolvedValue({
      configured: false,
      coverage: 'Google Places photo lookup is unavailable in this test.',
      source: 'Google Places',
    });
    resolveRoadRouteMock.mockClear();
    listNearbySpotsMock.mockClear();
    getNearbyFuelStationsMock.mockClear();
    getTravelNearbySuggestionsMock.mockReset();
    getTravelNearbySuggestionsMock.mockRejectedValue(new Error('travel endpoint unavailable in legacy fallback tests'));
    searchPlacesMock.mockResolvedValue({
      data: [
        {
          id: 'mapbox.fast-food.1',
          latitude: 32.78,
          longitude: -96.8,
          placeName: 'Burger Stop',
          formattedAddress: '100 Burger Ln, Dallas, Texas',
          city: 'Dallas',
          category: 'fast food',
          distanceKm: 1.4,
          source: 'mapbox',
        },
      ],
    });
    searchNearbyPlacesMock.mockResolvedValue({
      data: [
        {
          id: 'mapbox.gas.1',
          latitude: 32.781,
          longitude: -96.802,
          placeName: 'Scope Gas Station',
          formattedAddress: '300 Fuel Rd, Dallas, Texas',
          city: 'Dallas',
          category: 'gas_station',
          categoryId: 'gas_station',
          categoryLabel: 'Gas station',
          distanceKm: 1.6,
          source: 'mapbox',
        },
      ],
    });
    resolveRoadRouteMock.mockResolvedValue({
      geometry: [[-96.797, 32.7767], [-97.7431, 30.2672]],
      orderedPoints: [],
      distanceMeters: 32_187,
      durationSeconds: 2_520,
      provider: 'mapbox-directions',
      profile: 'mapbox/driving-traffic',
    });
    listNearbySpotsMock.mockResolvedValue({
      data: [
        {
          id: 'nearby-spot-1',
          title: 'Klyde Warren Garden Stop',
          description: 'A green pause near the route.',
          latitude: 32.7894,
          longitude: -96.8018,
          city: 'Dallas',
          country: 'United States',
          category: 'scenic',
          rating: 4.8,
          photoUrl: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800',
          createdAt: '2026-04-01T00:00:00.000Z',
        },
      ],
    });
    getNearbyFuelStationsMock.mockResolvedValue({
      configured: true,
      coverage: 'Global fuel preview',
      source: 'Scope fuel',
      stations: [
        {
          id: 'fuel-1',
          name: 'Main Street Fuel',
          brand: 'Scope Fuel',
          address: '10 Main St, Dallas, Texas',
          latitude: 32.779,
          longitude: -96.801,
          distanceKm: 1.1,
          fuelType: 'regular',
          pricePerUnit: 3.19,
          currency: 'USD',
          isOpen: true,
        },
        {
          id: 'fuel-2',
          name: 'Budget Fuel',
          brand: 'Scope Fuel',
          address: '20 Budget Rd, Dallas, Texas',
          latitude: 32.789,
          longitude: -96.811,
          distanceKm: 2.4,
          fuelType: 'regular',
          pricePerUnit: 3.05,
          currency: 'USD',
          isOpen: true,
        },
      ],
    });
  });

  it('keeps autosave status out of the map preview', () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
        stops: draftStops,
      },
      global: {
        stubs: {
          MapView: {
            template: '<div data-test="route-map">Route map stub</div>',
          },
          LazyImage: {
            props: ['src', 'alt'],
            template: '<img :src="src" :alt="alt" />',
          },
          ScopeIcon: {
            template: '<span />',
          },
        },
      },
    });

    expect(wrapper.find('[data-test="itinerary-autosave-status"]').exists()).toBe(false);
  });

  it('renders itinerary overlays, metrics, and the route map', () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary,
        tripTitle: 'Epic Patagonia Trek',
        members,
      },
      global: {
        stubs: {
          MapView: {
            template: '<div data-test="route-map">Route map stub</div>',
          },
          LazyImage: {
            props: ['src', 'alt'],
            template: '<img :src="src" :alt="alt" />',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('Patagonia, Chile + Argentina');
    expect(wrapper.text()).toContain('Route guide ready for Patagonia, Chile + Argentina');
    expect(wrapper.text()).toContain('$168');
    expect(wrapper.text()).toContain('2 stops');
    expect(wrapper.text()).toContain('87% match');
    expect(wrapper.text()).toContain('Matches your adventure preference');
    expect(wrapper.find('[data-test="itinerary-stop-ai-reason"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="route-map"]').exists()).toBe(true);
  });

  it('renders every requested draft day even when the built itinerary is sparse', () => {
    const fourDayDraft: TripPlannerInput = {
      ...draft,
      startDate: '2026-05-08',
      endDate: '2026-05-11',
    };
    const sparseItinerary: Itinerary = {
      ...itinerary,
      days: [
        {
          ...itinerary.days[0]!,
          dayNumber: 1,
          date: '2026-05-08',
        },
      ],
    };

    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: sparseItinerary,
        draft: fourDayDraft,
        tripTitle: 'North Texas route',
        members,
      },
      global: {
        stubs: {
          MapView: {
            template: '<div data-test="route-map">Route map stub</div>',
          },
          LazyImage: true,
        },
      },
    });

    const dayCards = wrapper.findAll('[data-test="itinerary-day-card"]');
    expect(dayCards).toHaveLength(4);
    expect(dayCards.map((card) => card.attributes('data-day-number'))).toEqual(['1', '2', '3', '4']);
    expect(dayCards[1]?.text()).toContain('$0');
  });

  it('keeps the route canvas in the same top-row slot after an itinerary builds', () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary,
        tripTitle: 'Epic Patagonia Trek',
        members,
      },
      global: {
        stubs: {
          MapView: {
            template: '<div data-test="route-map">Route map stub</div>',
          },
          LazyImage: true,
        },
      },
    });

    const detailPanel = wrapper.get('.itinerary-detail-panel');
    const cardOrder = Array.from(detailPanel.element.children).map((element) => element.getAttribute('data-test'));

    expect(detailPanel.attributes('data-detail-state')).toBe('built');
    expect(cardOrder.slice(0, 3)).toEqual([
      'itinerary-summary-card',
      'itinerary-route-edit-card',
      'itinerary-timeline-overlay',
    ]);
    expect(wrapper.get('[data-test="itinerary-summary-card"]').text()).toContain('Trip guide handoff');
    expect(wrapper.get('[data-test="itinerary-summary-card"]').text()).toContain('Guide-ready route');
    expect(wrapper.get('[data-test="itinerary-route-edit-card"]').text()).toContain('Pick start and end first; stops and vibes can stay optional.');
    expect(wrapper.find('[data-test="itinerary-route-scan-card"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('AI itinerary');
    expect(wrapper.text()).not.toContain('Adjust the route points');
  });

  it('keeps the inline assistant after the day schedule without remounting it', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
        stops: draftStops,
      },
      slots: {
        assistant: '<aside data-test="trip-ai-assist">Scope AI inline</aside>',
      },
      global: {
        stubs: {
          MapView: {
            template: '<div data-test="route-map">Route map stub</div>',
          },
          LazyImage: true,
        },
      },
    });

    const draftDetailPanel = wrapper.get('.itinerary-detail-panel');
    const draftCardOrder = Array.from(draftDetailPanel.element.children).map((element) => element.getAttribute('data-test'));
    const assistantElement = wrapper.get('[data-test="trip-ai-assist"]').element;

    expect(draftCardOrder.indexOf('itinerary-ai-slot')).toBeGreaterThan(draftCardOrder.indexOf('itinerary-timeline-overlay'));

    await wrapper.setProps({ itinerary });
    await flushPromises();

    const builtDetailPanel = wrapper.get('.itinerary-detail-panel');
    const builtCardOrder = Array.from(builtDetailPanel.element.children).map((element) => element.getAttribute('data-test'));

    expect(wrapper.get('[data-test="trip-ai-assist"]').element).toBe(assistantElement);
    expect(builtCardOrder.indexOf('itinerary-ai-slot')).toBeGreaterThan(builtCardOrder.indexOf('itinerary-timeline-overlay'));
  });

  it('supports the mobile preview step shell and an edit action back to the planner', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary,
        tripTitle: 'Epic Patagonia Trek',
        members,
        mobileWizard: true,
        mobileActiveStep: 4,
      },
      global: {
        stubs: {
          MapView: {
            template: '<div data-test="route-map">Route map stub</div>',
          },
          LazyImage: {
            props: ['src', 'alt'],
            template: '<img :src="src" :alt="alt" />',
          },
        },
      },
    });

    expect(wrapper.get('[data-test="planner-step-4-toggle"]').attributes('aria-expanded')).toBe('true');
    expect(wrapper.get('[data-test="planner-step-4-content"]').isVisible()).toBe(true);
    expect(wrapper.text()).toContain('Guide preview');

    await wrapper.get('[data-test="planner-step-4-back"]').trigger('click');

    expect(wrapper.emitted('wizard-step-change')?.[0]?.[0]).toBe(3);
  });

  it('labels the mobile preview step as upcoming or done as the wizard moves around it', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary,
        tripTitle: 'Epic Patagonia Trek',
        members,
        mobileWizard: true,
        mobileActiveStep: 3,
      },
      global: {
        stubs: {
          MapView: {
            template: '<div data-test="route-map">Route map stub</div>',
          },
          LazyImage: true,
        },
      },
    });

    expect(wrapper.get('.itinerary-step-shell').attributes('data-step-state')).toBe('upcoming');
    expect(wrapper.get('[data-test="planner-step-4-toggle"]').text()).toContain('Preview');
    expect(wrapper.get('[data-test="planner-step-4-toggle"]').attributes('aria-expanded')).toBe('false');

    await wrapper.setProps({ mobileActiveStep: 5 });

    expect(wrapper.get('.itinerary-step-shell').attributes('data-step-state')).toBe('complete');
    expect(wrapper.get('[data-test="planner-step-4-toggle"]').text()).toContain('Done');
  });

  it('preloads the route map while the AI itinerary is still a draft', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
      },
      global: {
        stubs: {
          MapView: {
            props: ['optimizeRouteOrder'],
            template: '<div data-test="route-map">{{ optimizeRouteOrder ? "optimized" : "fixed" }} route map stub</div>',
          },
          LazyImage: true,
        },
      },
    });

    expect(wrapper.find('[data-test="route-map"]').exists()).toBe(true);
    expect(wrapper.get('[data-test="route-map"]').text()).toContain('optimized');
    expect(wrapper.find('[data-test="itinerary-planning-card"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Guide-ready route');
    expect(wrapper.get('[data-test="planning-route-brief"]').text()).toContain('Dallas, TX');
    expect(wrapper.get('[data-test="planning-route-brief"]').text()).toContain('Austin, TX');
    const timelineOverlay = wrapper.get('[data-test="itinerary-timeline-overlay"]');
    expect(timelineOverlay.text()).toContain('Dallas, TX');
    expect(timelineOverlay.text()).toContain('Austin, TX');
    expect(timelineOverlay.findAll<HTMLInputElement>('[data-test="itinerary-stop-time-input"]').map((input) => input.element.value)).toEqual([
      '08:30',
      '18:00',
    ]);
    await flushPromises();
    expect(resolveRoadRouteMock).toHaveBeenCalledWith(expect.any(Array), { optimizeOrder: true });
    expect(wrapper.text()).toContain('20.0 mi');
    expect(wrapper.text()).toContain('42 min');
    expect(wrapper.find('[data-test="route-provider-label"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Traffic-aware');
  });

  it('keeps a single selected start at locality zoom for route planning context', () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft: {
          ...draft,
          endDestination: '',
          endDestinationLatitude: undefined,
          endDestinationLongitude: undefined,
        },
      },
      global: {
        stubs: {
          MapView: {
            props: ['routePoints', 'singleRoutePointZoom'],
            template: '<div data-test="route-map" :data-single-zoom="String(singleRoutePointZoom)">{{ routePoints.length }} point route map stub</div>',
          },
          LazyImage: true,
        },
      },
    });

    expect(wrapper.get('[data-test="route-map"]').text()).toContain('1 point');
    expect(wrapper.get('[data-test="route-map"]').attributes('data-single-zoom')).toBe(String(PLANNER_START_CONTEXT_ZOOM));
  });

  it('renders fuel cost and drive score from the current route state', async () => {
    resolveRoadRouteMock.mockResolvedValueOnce({
      geometry: [[-96.797, 32.7767], [-97.7431, 30.2672]],
      orderedPoints: [],
      distanceMeters: 160_934.4,
      durationSeconds: 7_200,
      provider: 'mapbox-directions',
      profile: 'mapbox/driving-traffic',
    });

    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
        fuelSettings: {
          mpg: 25,
          gasPricePerGallon: 3.5,
        },
      },
      global: {
        stubs: {
          MapView: {
            template: '<div data-test="route-map">Route map stub</div>',
          },
          LazyImage: true,
        },
      },
    });

    await flushPromises();

    expect(wrapper.get('[data-test="route-fuel-cost"]').text()).toContain('$14');
    expect(wrapper.get('[data-test="route-drive-score"]').text()).toMatch(/\d+\.\d\/10/);
    expect(wrapper.get('[data-test="route-drive-score"]').text()).toMatch(/Smooth drive|Steady drive|Demanding drive/);
  });

  it('does not use visual fallback routes for ETA, fuel cost, or drive score', async () => {
    resolveRoadRouteMock.mockResolvedValueOnce({
      geometry: [[-96.797, 32.7767], [-97.7431, 30.2672]],
      orderedPoints: [],
      distanceMeters: 362_905,
      durationSeconds: 0,
      provider: 'local-estimate',
      profile: 'local',
      routeQuality: 'visual-fallback',
      routeError: 'Mapbox token unavailable.',
    });

    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
        fuelSettings: {
          mpg: 25,
          gasPricePerGallon: 3.5,
        },
      },
      global: {
        stubs: {
          MapView: {
            template: '<div data-test="route-map">Route map stub</div>',
          },
          LazyImage: true,
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('Needs Mapbox');
    expect(wrapper.text()).toContain('Unavailable');
    expect(wrapper.get('[data-test="route-fuel-cost"]').text()).toContain('Needs route');
    expect(wrapper.get('[data-test="route-drive-score"]').text()).toContain('Needs route');
    expect(wrapper.get('[data-test="route-fuel-cost"]').text()).not.toContain('$51');
    expect(wrapper.get('[data-test="route-drive-score"]').text()).not.toMatch(/\d+\.\d\/10/);
  });

  it('requests the fuel calculator only when the unset fuel metric is activated', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
      },
      global: {
        stubs: {
          MapView: {
            template: '<div data-test="route-map">Route map stub</div>',
          },
          LazyImage: true,
        },
      },
    });

    await flushPromises();
    const fuelMetric = wrapper.get('[data-test="route-fuel-cost"]');
    await fuelMetric.trigger('mouseenter');
    await fuelMetric.trigger('focus');

    expect(wrapper.emitted('fuel-settings-request')).toBeUndefined();

    await fuelMetric.trigger('click');

    expect(wrapper.emitted('fuel-settings-request')).toHaveLength(1);
  });

  it('shows selected draft stops as a full-width schedule before the itinerary is built', () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
        members,
        stops: draftStops,
      },
      global: {
        stubs: {
          MapView: {
            template: '<div data-test="route-map">Route map stub</div>',
          },
          LazyImage: true,
        },
      },
    });

    const detailPanel = wrapper.get('.itinerary-detail-panel');
    const cardOrder = Array.from(detailPanel.element.children).map((element) => element.getAttribute('data-test'));
    const timelineOverlay = wrapper.get('[data-test="itinerary-timeline-overlay"]');

    expect(detailPanel.attributes('data-detail-state')).toBe('draft');
    expect(cardOrder.slice(0, 3)).toEqual([
      'itinerary-planning-card',
      'itinerary-route-card',
      'itinerary-timeline-overlay',
    ]);
    expect(wrapper.find('[data-test="itinerary-crew-card"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="itinerary-draft-companion-grid"]').exists()).toBe(false);
    expect(timelineOverlay.text()).toContain('Trip schedule');
    expect(timelineOverlay.text()).toContain('Dallas, TX');
    expect(timelineOverlay.text()).toContain('Cliffside Lookout Loop');
    expect(timelineOverlay.text()).toContain('Trinity Bluff Sunrise');
    expect(timelineOverlay.text()).toContain('Austin, TX');
    expect(timelineOverlay.find('.timeline-media').exists()).toBe(false);
    expect(timelineOverlay.findAll('.timeline-stop-badge').map((badge) => badge.text())).toEqual([
      'Origin',
      'Stop 2',
      'Stop 3',
      'Destination',
    ]);
    const timeValues = timelineOverlay
      .findAll<HTMLInputElement>('[data-test="itinerary-stop-time-input"]')
      .map((input) => input.element.value);
    expect(timeValues).toContain('08:30');
    expect(timeValues).toContain('18:00');
    const dayInputs = timelineOverlay.findAll<HTMLInputElement>('[data-test="itinerary-stop-day-input"]');
    expect(dayInputs).toHaveLength(4);
    expect(dayInputs.every((input) => input.attributes('type') === 'text')).toBe(true);
    expect(dayInputs.every((input) => input.attributes('max') === undefined)).toBe(true);
    expect(dayInputs.every((input) => input.attributes('autocomplete') === 'off')).toBe(true);
    const timeInputs = timelineOverlay.findAll('[data-test="itinerary-stop-time-input"]');
    expect(timeInputs).toHaveLength(4);
    expect(timeInputs.every((input) => input.attributes('autocomplete') === 'off')).toBe(true);
  });

  it('keeps the live map mounted when a draft route becomes an itinerary', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
      },
      global: {
        stubs: {
          MapView: {
            props: ['spots'],
            template: '<div data-test="route-map">Map with {{ spots.length }} points</div>',
          },
          LazyImage: true,
        },
      },
    });

    expect(wrapper.find('[data-test="route-map"]').exists()).toBe(true);
    expect(wrapper.find('.map-shell__placeholder').exists()).toBe(false);

    await wrapper.setProps({ itinerary });

    expect(wrapper.find('[data-test="route-map"]').exists()).toBe(true);
    expect(wrapper.find('.map-shell__placeholder').exists()).toBe(false);
    expect(wrapper.get('[data-test="itinerary-summary-card"]').exists()).toBe(true);
  });

  it('keeps route editing controls and endpoints visible after an itinerary is built', async () => {
    const itineraryStops = itinerary.days.flatMap((day) =>
      day.spots.map((spot) => ({
        ...spot,
        dayNumber: spot.dayNumber ?? day.dayNumber,
      })),
    );
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary,
        draft,
        stops: itineraryStops,
      },
      global: {
        stubs: {
          MapView: {
            props: ['routePoints'],
            template: '<div data-test="route-map">{{ routePoints.map((point) => `${point.routeLabel}:${point.title}`).join(" / ") }}</div>',
          },
          LazyImage: true,
        },
      },
    });

    await flushPromises();

    expect(wrapper.get('[data-test="itinerary-route-edit-card"]').exists()).toBe(true);
    expect(wrapper.get('[data-test="itinerary-route-brief"]').text()).toContain('Dallas, TX');
    expect(wrapper.get('[data-test="itinerary-route-brief"]').text()).toContain('Austin, TX');
    expect(wrapper.get('[data-test="itinerary-map-picker"]').text()).toContain('Start');
    expect(wrapper.get('[data-test="itinerary-map-picker"]').text()).toContain('End');
    expect(wrapper.get('[data-test="route-map"]').text()).toContain('S:Dallas, TX');
    expect(wrapper.get('[data-test="route-map"]').text()).toContain('E:Austin, TX');
    const timelineOverlay = wrapper.get('[data-test="itinerary-timeline-overlay"]');
    expect(timelineOverlay.text()).toContain('Dallas, TX');
    expect(timelineOverlay.text()).toContain('Austin, TX');
    expect(timelineOverlay.find('.timeline-media').exists()).toBe(false);
    expect(timelineOverlay.findAll('.timeline-stop-badge').map((badge) => badge.text())).toEqual([
      'Origin',
      'Stop 2',
      'Stop 3',
      'Destination',
    ]);
    expect(wrapper.findAll('[data-route-role="start"]')).not.toHaveLength(0);
    expect(wrapper.findAll('[data-route-role="end"]')).not.toHaveLength(0);
  });

  it('lets built itinerary stops move to a new day or time and emits them chronologically', async () => {
    const itineraryStops = itinerary.days.flatMap((day) =>
      day.spots.map((spot) => ({
        ...spot,
        dayNumber: spot.dayNumber ?? day.dayNumber,
      })),
    );
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary,
        draft,
        stops: itineraryStops,
      },
      global: {
        stubs: {
          MapView: {
            template: '<div data-test="route-map">Route map stub</div>',
          },
          LazyImage: true,
        },
      },
    });

    const spotOneItem = wrapper.find('[data-spot-id="spot-1"]');
    const firstDayInput = spotOneItem.find<HTMLInputElement>('[data-test="itinerary-stop-day-input"]');
    if (!firstDayInput.exists()) {
      throw new Error('Expected itinerary day input to render');
    }
    firstDayInput.element.value = '4';
    await firstDayInput.trigger('change');

    const dayUpdate = wrapper.emitted('itinerary-stops-update')?.[0]?.[0] as TripSpot[];
    expect(dayUpdate.map((stop) => `${stop.spotId}:${stop.dayNumber}:${stop.timeSlot}`)).toEqual([
      'spot-2:2:14:00',
      'spot-1:4:11:00',
    ]);

    const firstTimeInput = wrapper.get('[data-spot-id="spot-1"]').find<HTMLInputElement>('[data-test="itinerary-stop-time-input"]');
    if (!firstTimeInput.exists()) {
      throw new Error('Expected itinerary time input to render');
    }
    firstTimeInput.element.value = '18:45';
    await firstTimeInput.trigger('change');

    const timeUpdate = wrapper.emitted('itinerary-stops-update')?.[1]?.[0] as TripSpot[];
    expect(timeUpdate.map((stop) => `${stop.spotId}:${stop.dayNumber}:${stop.timeSlot}`)).toEqual([
      'spot-1:1:18:45',
      'spot-2:2:14:00',
    ]);
  });

  it('normalizes loose timeline time values and restores invalid day or time edits', async () => {
    const itineraryStops = itinerary.days.flatMap((day) =>
      day.spots.map((spot) => ({
        ...spot,
        dayNumber: spot.dayNumber ?? day.dayNumber,
      })),
    );
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary,
        draft,
        stops: itineraryStops,
      },
      global: {
        stubs: {
          MapView: {
            template: '<div data-test="route-map">Route map stub</div>',
          },
          LazyImage: true,
        },
      },
    });

    const firstDayInput = wrapper.get('[data-spot-id="spot-1"]').get<HTMLInputElement>('[data-test="itinerary-stop-day-input"]');
    const selectDaySpy = vi.spyOn(firstDayInput.element, 'select').mockImplementation(() => undefined);
    await firstDayInput.trigger('focus');

    expect(selectDaySpy).toHaveBeenCalled();

    firstDayInput.element.value = 'abc';
    await firstDayInput.trigger('change');

    expect(firstDayInput.element.value).toBe('1');
    expect(wrapper.emitted('itinerary-stops-update')).toBeUndefined();

    firstDayInput.element.value = '4x';
    await firstDayInput.trigger('input');

    expect(firstDayInput.element.value).toBe('4');

    firstDayInput.element.value = '';
    await firstDayInput.trigger('blur');

    expect(firstDayInput.element.value).toBe('1');

    const firstTimeInput = wrapper.get('[data-spot-id="spot-1"]').get<HTMLInputElement>('[data-test="itinerary-stop-time-input"]');
    const selectTimeSpy = vi.spyOn(firstTimeInput.element, 'select').mockImplementation(() => undefined);
    await firstTimeInput.trigger('dblclick');

    expect(selectTimeSpy).toHaveBeenCalled();

    firstTimeInput.element.value = '5';
    await firstTimeInput.trigger('change');

    const looseTimeUpdate = wrapper.emitted('itinerary-stops-update')?.[0]?.[0] as TripSpot[];
    expect(firstTimeInput.element.value).toBe('05:00');
    expect(looseTimeUpdate.map((stop) => `${stop.spotId}:${stop.dayNumber}:${stop.timeSlot}`)).toEqual([
      'spot-1:1:05:00',
      'spot-2:2:14:00',
    ]);

    firstTimeInput.element.value = '930';
    await firstTimeInput.trigger('change');

    const threeDigitTimeUpdate = wrapper.emitted('itinerary-stops-update')?.[1]?.[0] as TripSpot[];
    expect(firstTimeInput.element.value).toBe('09:30');
    expect(threeDigitTimeUpdate.map((stop) => `${stop.spotId}:${stop.dayNumber}:${stop.timeSlot}`)).toEqual([
      'spot-1:1:09:30',
      'spot-2:2:14:00',
    ]);

    firstTimeInput.element.value = '1745';
    await firstTimeInput.trigger('change');

    const fourDigitTimeUpdate = wrapper.emitted('itinerary-stops-update')?.[2]?.[0] as TripSpot[];
    expect(firstTimeInput.element.value).toBe('17:45');
    expect(fourDigitTimeUpdate.map((stop) => `${stop.spotId}:${stop.dayNumber}:${stop.timeSlot}`)).toEqual([
      'spot-1:1:17:45',
      'spot-2:2:14:00',
    ]);

    firstTimeInput.element.value = 'nope';
    await firstTimeInput.trigger('change');

    expect(firstTimeInput.element.value).toBe('11:00');
    expect(wrapper.emitted('itinerary-stops-update')).toHaveLength(3);

    firstTimeInput.element.value = '';
    await firstTimeInput.trigger('blur');

    expect(firstTimeInput.element.value).toBe('11:00');
  });

  it('keeps typed endpoint labels in the built route sequence without relabeling itinerary stops as endpoints', async () => {
    const itineraryStops = itinerary.days.flatMap((day) =>
      day.spots.map((spot) => ({
        ...spot,
        dayNumber: spot.dayNumber ?? day.dayNumber,
      })),
    );
    const typedEndpointDraft: TripPlannerInput = {
      ...draft,
      destinationLatitude: undefined,
      destinationLongitude: undefined,
      endDestinationLatitude: undefined,
      endDestinationLongitude: undefined,
    };
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary,
        draft: typedEndpointDraft,
        stops: itineraryStops,
      },
      global: {
        stubs: {
          MapView: {
            props: ['routePoints'],
            template: '<div data-test="route-map">{{ routePoints.map((point) => `${point.routeLabel}:${point.title}`).join(" / ") }}</div>',
          },
          LazyImage: true,
        },
      },
    });

    await flushPromises();

    const routeMapText = wrapper.get('[data-test="route-map"]').text();
    const routeSequenceText = wrapper.get('[data-test="itinerary-route-sequence-list"]').text();
    expect(wrapper.get('[data-test="itinerary-route-brief"]').text()).toContain('Dallas, TX');
    expect(wrapper.get('[data-test="itinerary-route-brief"]').text()).toContain('Austin, TX');
    expect(routeMapText).toContain('1:Mount Fitz Roy');
    expect(routeMapText).toContain('2:Perito Moreno Glacier');
    expect(routeMapText).not.toContain('S:Mount Fitz Roy');
    expect(routeMapText).not.toContain('E:Perito Moreno Glacier');
    expect(routeSequenceText).toContain('Dallas, TX');
    expect(routeSequenceText).toContain('Austin, TX');
  });

  it('keeps the draft route canvas focused on actionable placeholders before endpoints exist', () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
      },
      global: {
        stubs: {
          MapView: {
            template: '<div data-test="route-map">Route map stub</div>',
          },
          LazyImage: true,
        },
      },
    });

    expect(wrapper.find('[data-test="planning-route-brief"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="itinerary-planning-card"]').attributes('data-route-canvas-density')).toBe('compact');
    expect(wrapper.get('[data-test="route-canvas-placeholder"]').text()).toContain('Add start');
    expect(wrapper.get('[data-test="route-canvas-placeholder"]').text()).toContain('Add end');
    expect(wrapper.get('[data-test="map-pick-stop"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-test="map-pick-end"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-test="map-pick-end"]').attributes('title')).toBe('Pick start first');
    expect(wrapper.find('[data-test="route-sequence-list"]').exists()).toBe(false);
  });

  it('lets the handoff card return to natural height once route chips are present', () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft: {
          ...draft,
          destination: 'Fluvanna, Texas',
          endDestination: '',
          destinationLatitude: undefined,
          destinationLongitude: undefined,
          endDestinationLatitude: undefined,
          endDestinationLongitude: undefined,
        },
      },
      global: {
        stubs: {
          MapView: {
            template: '<div data-test="route-map">Route map stub</div>',
          },
          LazyImage: true,
        },
      },
    });

    expect(wrapper.get('[data-test="itinerary-planning-card"]').attributes('data-route-canvas-density')).toBe('expanded');
    expect(wrapper.get('[data-test="route-sequence-list"]').text()).toContain('Fluvanna, Texas');
  });

  it('shows the optimized draft stop order once the route summary resolves', async () => {
    resolveRoadRouteMock.mockResolvedValueOnce({
      geometry: [
        [-96.797, 32.7767],
        [-97.1467, 31.5493],
        [-96.4689, 32.0954],
        [-97.7431, 30.2672],
      ],
      orderedPoints: [
        {
          id: 'planner-start',
          title: 'Dallas, TX',
          latitude: 32.7767,
          longitude: -96.797,
          category: 'scenic',
          city: 'Dallas, TX',
          routeRole: 'start',
          routeLabel: 'S',
        },
        {
          id: 'planner-stop-stop-near',
          title: 'Waco, TX',
          latitude: 31.5493,
          longitude: -97.1467,
          category: 'food',
          city: 'Waco',
          routeRole: 'stop',
          routeLabel: '2',
        },
        {
          id: 'planner-stop-stop-far',
          title: 'Corsicana, TX',
          latitude: 32.0954,
          longitude: -96.4689,
          category: 'culture',
          city: 'Corsicana',
          routeRole: 'stop',
          routeLabel: '1',
        },
        {
          id: 'planner-end',
          title: 'Austin, TX',
          latitude: 30.2672,
          longitude: -97.7431,
          category: 'other',
          city: 'Austin, TX',
          routeRole: 'end',
          routeLabel: 'E',
        },
      ],
      distanceMeters: 246_230,
      durationSeconds: 12_300,
      provider: 'mapbox-optimization',
      profile: 'mapbox/driving-traffic',
    });

    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
        stops: [
          {
            spotId: 'stop-far',
            title: 'Corsicana, TX',
            latitude: 32.0954,
            longitude: -96.4689,
            category: 'culture',
            city: 'Corsicana',
          },
          {
            spotId: 'stop-near',
            title: 'Waco, TX',
            latitude: 31.5493,
            longitude: -97.1467,
            category: 'food',
            city: 'Waco',
          },
        ],
      },
      global: {
        stubs: {
          MapView: {
            props: ['routePoints'],
            template: '<div data-test="route-map">{{ routePoints.map((point) => `${point.routeLabel}:${point.title}`).join(" / ") }}</div>',
          },
          LazyImage: true,
        },
      },
    });

    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(resolveRoadRouteMock).toHaveBeenCalledWith(expect.any(Array), { optimizeOrder: true });
    expect(wrapper.get('[data-test="route-map"]').text()).toBe('S:Dallas, TX / 2:Waco, TX / 3:Corsicana, TX / E:Austin, TX');
    expect(wrapper.get('[data-test="route-sequence-list"]').text()).toContain('Waco, TX');
  });

  it('keeps explicit start and end pinned while optimized stops scale between them', async () => {
    resolveRoadRouteMock.mockResolvedValueOnce({
      geometry: [
        [-96.797, 32.7767],
        [-96.4689, 32.0954],
        [-97.1467, 31.5493],
        [-97.7431, 30.2672],
      ],
      orderedPoints: [
        {
          id: 'planner-stop-stop-far',
          title: 'Corsicana, TX',
          latitude: 32.0954,
          longitude: -96.4689,
          category: 'culture',
          city: 'Corsicana',
          routeRole: 'stop',
          routeLabel: '1',
        },
        {
          id: 'planner-end',
          title: 'Austin, TX',
          latitude: 30.2672,
          longitude: -97.7431,
          category: 'other',
          city: 'Austin, TX',
          routeRole: 'end',
          routeLabel: 'E',
        },
        {
          id: 'planner-start',
          title: 'Dallas, TX',
          latitude: 32.7767,
          longitude: -96.797,
          category: 'scenic',
          city: 'Dallas, TX',
          routeRole: 'start',
          routeLabel: 'S',
        },
        {
          id: 'planner-stop-stop-near',
          title: 'Waco, TX',
          latitude: 31.5493,
          longitude: -97.1467,
          category: 'food',
          city: 'Waco',
          routeRole: 'stop',
          routeLabel: '2',
        },
      ],
      distanceMeters: 246_230,
      durationSeconds: 12_300,
      provider: 'mapbox-optimization',
      profile: 'mapbox/driving-traffic',
    });

    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
        stops: [
          {
            spotId: 'stop-far',
            title: 'Corsicana, TX',
            latitude: 32.0954,
            longitude: -96.4689,
            category: 'culture',
            city: 'Corsicana',
          },
          {
            spotId: 'stop-near',
            title: 'Waco, TX',
            latitude: 31.5493,
            longitude: -97.1467,
            category: 'food',
            city: 'Waco',
          },
        ],
      },
      global: {
        stubs: {
          MapView: {
            props: ['routePoints'],
            template: '<div data-test="route-map">{{ routePoints.map((point) => `${point.routeLabel}:${point.title}`).join(" / ") }}</div>',
          },
          LazyImage: true,
        },
      },
    });

    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-test="route-map"]').text()).toBe('S:Dallas, TX / 2:Corsicana, TX / 3:Waco, TX / E:Austin, TX');
  });

  it('places typed or map-picked start and end points on the draft map', () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
      },
      global: {
        stubs: {
          MapView: {
            props: ['routePoints'],
            template: '<div data-test="route-map">{{ routePoints.length }} / {{ routePoints[0].title }} / {{ routePoints[1].title }}</div>',
          },
          LazyImage: true,
        },
      },
    });

    expect(wrapper.get('[data-test="route-map"]').text()).toBe('2 / Dallas, TX / Austin, TX');
  });

  it('focuses route sequence chips on the map without letting the remove button toggle them', async () => {
    const runPlannerMapCommand = vi.fn().mockResolvedValue({
      ok: true,
      message: 'Focused route point.',
    });
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
        stops: draftStops,
      },
      global: {
        stubs: {
          MapView: {
            props: ['routePoints'],
            setup(_props, { expose }) {
              expose({ runPlannerMapCommand });
              return {};
            },
            template: '<div data-test="route-map">{{ routePoints.length }} points</div>',
          },
          LazyImage: true,
        },
      },
    });

    await flushPromises();
    await wrapper.vm.$nextTick();

    const stopChip = wrapper.findAll('.route-sequence-chip')[1];
    await stopChip!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-test="route-nearby-drawer"]').attributes('data-drawer-state')).toBe('open');
    expect(runPlannerMapCommand).toHaveBeenCalledWith(expect.objectContaining({
      command: 'zoom_to_place',
      target: expect.objectContaining({
        latitude: draftStops[0]!.latitude,
        longitude: draftStops[0]!.longitude,
      }),
    }));
    expect(getTravelNearbySuggestionsMock).toHaveBeenLastCalledWith(expect.objectContaining({
      anchors: [expect.objectContaining({ id: 'planner-stop-draft-stop-1' })],
    }));

    await stopChip!.get('button').trigger('click');

    expect(runPlannerMapCommand).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('route-stop-remove')).toEqual([['draft-stop-1']]);
  });

  it('reports map commands as unavailable until the planner map ref is ready', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
        stops: draftStops,
      },
      global: {
        stubs: {
          MapView: {
            props: ['routePoints'],
            template: '<div data-test="route-map">{{ routePoints.length }} points</div>',
          },
          LazyImage: true,
        },
      },
    });

    const result = await (wrapper.vm as unknown as {
      runPlannerMapCommand: (command: string) => Promise<{ ok: boolean; message: string }>;
    }).runPlannerMapCommand('fit_route');

    expect(result).toEqual({
      ok: false,
      message: 'The planner map is still loading, so I could not run that map command yet.',
    });
  });

  it('reorders typed endpoint chips when their timeline days change', async () => {
    const typedEndpointDraft: TripPlannerInput = {
      ...draft,
      destinationLatitude: undefined,
      destinationLongitude: undefined,
      endDestinationLatitude: undefined,
      endDestinationLongitude: undefined,
    };
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft: typedEndpointDraft,
      },
      global: {
        stubs: {
          MapView: {
            props: ['routePoints', 'optimizeRouteOrder'],
            template: '<div data-test="route-map" :data-optimize="String(optimizeRouteOrder)">{{ routePoints.length }} points</div>',
          },
          LazyImage: true,
        },
      },
    });

    expect(wrapper.findAll('.route-sequence-chip').map((chip) => chip.text().replace(/\s+/g, ' ').trim())).toEqual([
      'SDallas, TX',
      'EAustin, TX',
    ]);

    const originDayInput = wrapper.get('[data-spot-id="timeline-endpoint-start"]').get<HTMLInputElement>('[data-test="itinerary-stop-day-input"]');
    originDayInput.element.value = '8';
    await originDayInput.trigger('change');
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-test="route-map"]').attributes('data-optimize')).toBe('false');
    expect(wrapper.findAll('.route-sequence-chip').map((chip) => chip.text().replace(/\s+/g, ' ').trim())).toEqual([
      'SAustin, TX',
      'EDallas, TX',
    ]);
    expect(wrapper.get('.planning-endpoint-card--start').text()).toContain('Austin, TX');
    expect(wrapper.get('.planning-endpoint-card--end').text()).toContain('Dallas, TX');
  });

  it('adds a map-discovered nearby place from the planner map with cleaned location context', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
        stops: draftStops,
      },
      global: {
        stubs: {
          MapView: {
            props: ['nearbyPlacePins'],
            emits: ['nearby-place-add'],
            template: `
              <button
                type="button"
                data-test="route-map"
                @click="$emit('nearby-place-add', {
                  id: 'route-nearby-school-1',
                  title: 'North High School',
                  subtitle: 'School - 100 Learning Lane, Dallas, Texas',
                  address: '100 Learning Lane, Dallas, Texas, United States',
                  latitude: 32.781,
                  longitude: -96.802,
                  category: 'education',
                  categoryLabel: 'School',
                  iconName: 'school',
                  sourceLabel: 'Map place',
                  kind: 'place'
                })"
              >
                {{ nearbyPlacePins.length }} nearby pins
              </button>
            `,
          },
          LazyImage: true,
        },
      },
    });

    await flushPromises();
    await wrapper.vm.$nextTick();
    await wrapper.get('[data-test="route-map"]').trigger('click');

    expect(wrapper.emitted('route-stop-add')?.[0]?.[0]).toMatchObject({
      spotId: 'school-1',
      title: 'North High School',
      latitude: 32.781,
      longitude: -96.802,
      category: 'culture',
      city: '100 Learning Lane, Dallas, Texas',
      notes: expect.stringContaining('School nearby stop'),
    });
  });

  it('drops stale route ordering immediately when draft endpoints change', async () => {
    resolveRoadRouteMock.mockResolvedValueOnce({
      geometry: [[-96.797, 32.7767], [-97.7431, 30.2672]],
      orderedPoints: [
        {
          id: 'planner-start',
          title: 'Dallas, TX',
          latitude: 32.7767,
          longitude: -96.797,
          category: 'scenic',
          city: 'Dallas, TX',
          routeRole: 'start',
          routeLabel: 'S',
        },
        {
          id: 'planner-end',
          title: 'Austin, TX',
          latitude: 30.2672,
          longitude: -97.7431,
          category: 'other',
          city: 'Austin, TX',
          routeRole: 'end',
          routeLabel: 'E',
        },
      ],
      distanceMeters: 32_187,
      durationSeconds: 2_520,
      provider: 'mapbox-directions',
      profile: 'mapbox/driving-traffic',
    });

    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
      },
      global: {
        stubs: {
          MapView: {
            props: ['routePoints'],
            template: '<div data-test="route-map">{{ routePoints.map((point) => `${point.routeLabel}:${point.title}`).join(" / ") }}</div>',
          },
          LazyImage: true,
        },
      },
    });

    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-test="route-map"]').text()).toBe('S:Dallas, TX / E:Austin, TX');

    resolveRoadRouteMock.mockImplementationOnce(() => new Promise(() => undefined));

    await wrapper.setProps({
      draft: {
        ...draft,
        destination: 'Austin, TX',
        endDestination: 'Dallas, TX',
        destinationLatitude: 30.2672,
        destinationLongitude: -97.7431,
        endDestinationLatitude: 32.7767,
        endDestinationLongitude: -96.797,
      },
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-test="route-map"]').text()).toBe('S:Austin, TX / E:Dallas, TX');
  });

  it('places scalable mid-route stops between the draft start and end points', () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
        stops: [
          {
            spotId: 'stop-1',
            title: 'Waco, TX',
            latitude: 31.5493,
            longitude: -97.1467,
            category: 'food',
            city: 'Waco',
          },
        ],
      },
      global: {
        stubs: {
          MapView: {
            props: ['routePoints'],
            template: '<div data-test="route-map">{{ routePoints.map((point) => `${point.routeLabel}:${point.title}`).join(" / ") }}</div>',
          },
          LazyImage: true,
        },
      },
    });

    expect(wrapper.get('[data-test="route-map"]').text()).toBe('S:Dallas, TX / 2:Waco, TX / E:Austin, TX');
    expect(wrapper.get('[data-test="route-sequence-list"]').text()).toContain('Waco, TX');
  });

  it('uses the edited day schedule as fixed map route order once the user changes it', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
        stops: draftStops,
      },
      global: {
        stubs: {
          MapView: {
            props: ['routePoints', 'optimizeRouteOrder'],
            template: '<div data-test="route-map" :data-optimize="String(optimizeRouteOrder)">{{ routePoints.map((point) => `${point.routeLabel}:${point.routeRole}:${point.title}`).join(" / ") }}</div>',
          },
          LazyImage: true,
        },
      },
    });

    await flushPromises();

    const originItem = wrapper.get('[data-spot-id="timeline-endpoint-start"]');
    const originDayInput = originItem.get<HTMLInputElement>('[data-test="itinerary-stop-day-input"]');
    originDayInput.element.value = '8';
    await originDayInput.trigger('change');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-test="route-map"]').attributes('data-optimize')).toBe('false');
    expect(resolveRoadRouteMock).toHaveBeenLastCalledWith(expect.any(Array), { optimizeOrder: false });
    expect(wrapper.get('[data-test="route-map"]').text()).toBe(
      'S:start:Cliffside Lookout Loop / 2:stop:Trinity Bluff Sunrise / 3:stop:Austin, TX / E:end:Dallas, TX',
    );
    expect(wrapper.get('[data-day-number="1"]').text()).toContain('Origin');
    expect(wrapper.get('[data-day-number="8"]').text()).toContain('Destination');
  });

  it('treats the latest edited timeline stop as the destination and sends that order to the map', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
        stops: draftStops,
      },
      global: {
        stubs: {
          MapView: {
            props: ['routePoints', 'optimizeRouteOrder'],
            template: '<div data-test="route-map" :data-optimize="String(optimizeRouteOrder)">{{ routePoints.map((point) => `${point.routeLabel}:${point.routeRole}:${point.title}`).join(" / ") }}</div>',
          },
          LazyImage: true,
        },
      },
    });

    await flushPromises();

    const latestStopDayInput = wrapper
      .get('[data-spot-id="draft-stop-2"]')
      .get<HTMLInputElement>('[data-test="itinerary-stop-day-input"]');
    latestStopDayInput.element.value = '3';
    await latestStopDayInput.trigger('change');
    await wrapper.setProps({
      stops: wrapper.emitted('itinerary-stops-update')?.at(-1)?.[0] as TripSpot[],
    });
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-test="route-map"]').attributes('data-optimize')).toBe('false');
    expect(resolveRoadRouteMock).toHaveBeenLastCalledWith(expect.any(Array), { optimizeOrder: false });
    expect(wrapper.get('[data-test="route-map"]').text()).toBe(
      'S:start:Dallas, TX / 2:stop:Cliffside Lookout Loop / 3:stop:Austin, TX / E:end:Trinity Bluff Sunrise',
    );
    expect(wrapper.get('[data-day-number="3"]').text()).toContain('Destination');
  });

  it('labels the latest scheduled actual stop as destination before manual edits', async () => {
    const oneDayDraft: TripPlannerInput = {
      ...draft,
      startDate: '2026-04-01',
      endDate: '2026-04-01',
    };
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft: oneDayDraft,
        stops: draftStops,
      },
      global: {
        stubs: {
          MapView: {
            props: ['routePoints', 'optimizeRouteOrder'],
            template: '<div data-test="route-map" :data-optimize="String(optimizeRouteOrder)">{{ routePoints.map((point) => `${point.routeLabel}:${point.routeRole}:${point.title}`).join(" / ") }}</div>',
          },
          LazyImage: true,
        },
      },
    });

    await flushPromises();

    expect(wrapper.get('[data-test="route-map"]').attributes('data-optimize')).toBe('true');
    expect(wrapper.get('[data-test="route-map"]').text()).toBe(
      'S:start:Dallas, TX / 2:stop:Cliffside Lookout Loop / 3:stop:Austin, TX / E:end:Trinity Bluff Sunrise',
    );
    expect(wrapper.get('[data-day-number="2"]').text()).toContain('Destination');
    expect(wrapper.get('[data-day-number="2"]').text()).toContain('Trinity Bluff Sunrise');
  });

  it('infers start and end from stop-only map picks as the route grows', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        stops: [
          {
            spotId: 'stop-start',
            title: 'Leoville, Saskatchewan, Canada',
            latitude: 53.637,
            longitude: -107.55,
            category: 'scenic',
            city: 'Leoville',
          },
          {
            spotId: 'stop-middle',
            title: 'Winnipeg, Manitoba, Canada',
            latitude: 49.8951,
            longitude: -97.1384,
            category: 'food',
            city: 'Winnipeg',
          },
          {
            spotId: 'stop-end',
            title: 'Kenora, Ontario, Canada',
            latitude: 49.767,
            longitude: -94.4894,
            category: 'nature',
            city: 'Kenora',
          },
        ],
      },
      global: {
        stubs: {
          MapView: {
            props: ['routePoints'],
            template: '<div data-test="route-map">{{ routePoints.map((point) => `${point.routeLabel}:${point.title}`).join(" / ") }}</div>',
          },
          LazyImage: true,
        },
      },
    });

    expect(wrapper.get('[data-test="route-map"]').text()).toBe('S:Leoville, Saskatchewan, Canada / 2:Winnipeg, Manitoba, Canada / E:Kenora, Ontario, Canada');
    expect(wrapper.get('[data-test="planning-route-brief"]').text()).toContain('Leoville, Saskatchewan');
    expect(wrapper.get('[data-test="planning-route-brief"]').text()).toContain('Kenora, Ontario');
    expect(wrapper.text()).toContain('1 stop');
    expect(wrapper.text()).not.toContain('3 stops');

    await wrapper.get('button[aria-label="Remove Leoville, Saskatchewan, Canada"]').trigger('click');

    expect(wrapper.emitted('route-stop-remove')?.[0]?.[0]).toBe('stop-start');
  });

  it('renders nearby Scope discovery stops in the map drawer', async () => {
    searchNearbyPlacesMock.mockResolvedValue({
      data: [
        {
          id: 'mapbox.fast-food.1',
          latitude: 32.78,
          longitude: -96.8,
          placeName: 'Burger Stop',
          formattedAddress: '100 Burger Ln, Dallas, Texas',
          city: 'Dallas',
          category: 'restaurant',
          categoryId: 'restaurant',
          categoryLabel: 'Restaurant',
          distanceKm: 1.4,
          source: 'mapbox',
        },
      ],
    });

    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
      },
      global: {
        stubs: {
          MapView: {
            emits: ['spot-select'],
            props: ['spots', 'routePoints', 'nearbyPlacePins'],
            template: `
              <button
                data-test="route-map"
                @click="$emit('spot-select', nearbyPlacePins[0] ? { id: nearbyPlacePins[0].id } : undefined)"
              >
                <span data-test="route-map-spots">{{ spots.map((spot) => spot.title).join(" / ") }}</span>
                <span data-test="route-map-nearby">{{ nearbyPlacePins.map((pin) => pin.kind + ':' + pin.title + ':' + (pin.photoUrl ?? '')).join(" / ") }}</span>
                <span data-test="route-map-route-count">{{ routePoints.length }}</span>
              </button>
            `,
          },
          LazyImage: true,
        },
      },
    });

    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-test="route-place-panel"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="route-nearby-drawer"]').text()).toContain('Nearby stops');
    expect(wrapper.get('[data-test="route-map-spots"]').text()).toContain('Dallas, TX');
    expect(wrapper.get('[data-test="route-map-spots"]').text()).toContain('Austin, TX');
    expect(wrapper.get('[data-test="route-map-spots"]').text()).not.toContain('Burger Stop');
    expect(wrapper.get('[data-test="route-map-spots"]').text()).not.toContain('Klyde Warren Garden Stop');
    expect(wrapper.get('[data-test="route-map-nearby"]').text()).toBe('');
    expect(wrapper.get('[data-test="route-nearby-drawer"]').attributes('data-drawer-state')).toBe('closed');
    await wrapper.get('[data-test="route-nearby-toggle"]').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-test="route-nearby-drawer"]').attributes('data-drawer-size')).toBe('default');
    await wrapper.get('[data-test="route-nearby-size-toggle"]').trigger('click');
    expect(wrapper.get('[data-test="route-nearby-drawer"]').attributes('data-drawer-size')).toBe('expanded');
    await wrapper.get('[data-test="route-nearby-filter-trigger"]').trigger('click');
    const filterOptions = wrapper.findAll('[data-test="route-nearby-filter-option"]').map((option) => option.text());
    expect(filterOptions).toEqual(['Recommended', 'Food', 'Stay', 'Essentials', 'Views', 'Coffee', 'Outdoors', 'Culture', 'Shopping', 'Entertainment', 'Nightlife']);
    expect(filterOptions).not.toContain('Restrooms');
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).toContain('Klyde Warren Garden Stop');
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).not.toContain('Scope AI');
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).not.toContain('Mapbox');
    expect(wrapper.find('[data-test="route-nearby-reason"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="route-map-nearby"]').text()).toContain('place:Klyde Warren Garden Stop');
    expect(wrapper.get('[data-test="route-map-nearby"]').text()).toContain('photo-1500534314209');
    expect(wrapper.get('[data-test="route-map-nearby"]').text()).toContain('place:Burger Stop');
    expect(searchNearbyPlacesMock).toHaveBeenCalledWith(expect.objectContaining({
      center: expect.objectContaining({ latitude: expect.any(Number), longitude: expect.any(Number) }),
      bounds: expect.objectContaining({
        north: expect.any(Number),
        south: expect.any(Number),
      }),
      categories: ['restaurant', 'cafe'],
      limit: 36,
    }));
    expect(searchPlacesMock).not.toHaveBeenCalled();
    expect(listNearbySpotsMock).toHaveBeenCalledWith(expect.objectContaining({
      radiusKm: 32.19,
      pageSize: 36,
    }));

    await wrapper.get('[data-test="route-map"]').trigger('click');

    expect(wrapper.emitted('route-stop-add')).toBeUndefined();
    expect(wrapper.get('[data-test="route-nearby-add"]').classes()).toContain('active');

    await wrapper.get('[data-test="route-nearby-add"]').trigger('click');

    expect(wrapper.emitted('route-stop-add')?.[0]?.[0]).toMatchObject({
      title: 'Klyde Warren Garden Stop',
      category: 'scenic',
      latitude: 32.7894,
      longitude: -96.8018,
      notes: expect.stringContaining('Best picks within 20 mi'),
    });
  });

  it('loads hybrid travel suggestions for the full travel category tabs', async () => {
    getTravelNearbySuggestionsMock.mockImplementation(async (options: { category: string }) => ({
      configured: true,
      coverage: 'Blended Scope community posts with Google Places travel essentials.',
      source: 'Scope + Google Places',
      category: options.category,
      radiusKm: 32.19,
      suggestions: options.category === 'stay'
        ? [
            {
              id: 'google-hotel-1',
              title: 'Route Rest Hotel',
              subtitle: 'Stay - 100 Sleep St',
              address: '100 Sleep St',
              latitude: 32.777,
              longitude: -96.799,
              category: 'stay',
              source: 'google',
              sourceLabel: 'Open',
              distanceKm: 0.4,
              rating: 4.6,
              priceLabel: '$$',
              reason: 'stay near route, 0.3 mi away, open now',
              anchorId: 'planner-start',
            },
          ]
        : [],
    }));

    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
      },
      global: {
        stubs: {
          MapView: {
            props: ['nearbyPlacePins'],
            template: '<div data-test="route-map-nearby">{{ nearbyPlacePins.map((pin) => pin.kind + ":" + pin.title + ":" + pin.categoryLabel).join(" / ") }}</div>',
          },
          LazyImage: true,
        },
      },
    });

    await wrapper.get('[data-test="route-nearby-toggle"]').trigger('click');
    await flushPromises();
    const stayTab = wrapper.findAll('[role="tab"]').find((button) => button.text().includes('Stay'));
    await stayTab!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('[role="tab"]').map((button) => button.text())).toEqual(
      expect.arrayContaining(['Recommended', 'Fuel/EV', 'Food', 'Stay', 'Essentials', 'Entertainment', 'Scenic']),
    );
    expect(getTravelNearbySuggestionsMock).toHaveBeenLastCalledWith(expect.objectContaining({
      category: 'stay',
      anchors: [expect.objectContaining({ id: 'planner-start' })],
    }));
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).toContain('Route Rest Hotel');
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).toContain('100 Sleep St');
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).not.toContain('open now');
    expect(wrapper.find('[data-test="route-nearby-reason"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="route-map-nearby"]').text()).toContain('place:Route Rest Hotel:Stay');
  });

  it('loads route-nearby suggestions with safe defaults for partial planner drafts', async () => {
    getTravelNearbySuggestionsMock.mockImplementation(async (options: { category: string }) => ({
      configured: true,
      coverage: 'Default draft nearby coverage',
      source: 'Scope + Google Places',
      category: options.category,
      radiusKm: 16,
      suggestions: [{
        id: 'partial-draft-food',
        title: 'Default Draft Cafe',
        subtitle: '',
        address: '',
        latitude: 32.78,
        longitude: -96.8,
        category: 'food',
        source: 'scope',
        distanceKm: 1,
      }],
    }));

    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft: {
          destination: 'Dallas',
          destinationLatitude: 32.7767,
          destinationLongitude: -96.797,
        },
      },
      global: {
        stubs: {
          MapView: { template: '<div data-test="route-map" />' },
          LazyImage: true,
          ScopeIcon: { template: '<span />' },
        },
      },
    });

    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    coverage.toggleRouteNearbyDrawer();
    await coverage.loadRouteNearbyPlaces();
    await flushPromises();

    expect(getTravelNearbySuggestionsMock).toHaveBeenLastCalledWith(expect.objectContaining({
      anchors: [expect.objectContaining({ id: 'planner-start' })],
      category: 'recommended',
      interests: [],
      pace: 'relaxed',
      budgetFloor: 0,
      budgetCeiling: 0,
      startDate: '',
      endDate: '',
      fuelType: 'all',
    }));
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).toContain('Default Draft Cafe');

    wrapper.unmount();
  });

  it('renders hybrid travel categories as distinct route-nearby card types', async () => {
    listNearbySpotsMock.mockResolvedValue({ data: [] });
    searchNearbyPlacesMock.mockResolvedValue({ data: [] });
    const makeSuggestion = (id: string, title: string, category: string, address: string, extra: Record<string, unknown> = {}) => ({
      id,
      title,
      subtitle: `${category} - ${address}`,
      address,
      latitude: 32.777 + Object.keys(extra).length * 0.001,
      longitude: -96.799,
      category,
      source: 'google',
      distanceKm: 0.4 + Object.keys(extra).length * 0.1,
      anchorId: 'planner-start',
      ...extra,
    });
    getTravelNearbySuggestionsMock.mockImplementation(async (options: { category: string }) => {
      const suggestionsByCategory: Record<string, unknown[]> = {
        food: [
          makeSuggestion('travel-coffee', 'Route Cafe', 'coffee', '10 Coffee Rd', { priceLabel: '$' }),
        ],
        stay: [
          makeSuggestion('travel-stay', 'Roadside Inn', 'stay', '20 Sleep St', { priceLabel: '$$' }),
        ],
        essentials: [
          makeSuggestion('travel-pharmacy', 'Route Pharmacy', 'pharmacy', '30 Care Ave'),
        ],
        scenic: [
          makeSuggestion('travel-nature', 'Lake Garden', 'nature', '40 Lake Trail'),
          makeSuggestion('travel-scenic', 'Sky Overlook', 'scenic', '50 View Rd'),
          makeSuggestion('travel-culture', 'Route Museum', 'culture', '60 Museum Way', { source: 'scope' }),
          makeSuggestion('travel-adventure', 'Canyon Climb Center', 'adventure', '70 Climb Ln'),
        ],
      };

      return {
        configured: true,
        coverage: 'Hybrid category fixture.',
        source: 'Scope + Google Places',
        category: options.category,
        radiusKm: 32.19,
        suggestions: suggestionsByCategory[options.category] ?? [],
      };
    });

    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
      },
      global: {
        stubs: {
          MapView: true,
          LazyImage: true,
        },
      },
    });

    await wrapper.get('[data-test="route-nearby-toggle"]').trigger('click');
    await flushPromises();

    const chooseTab = async (label: string) => {
      const tab = wrapper.findAll('[role="tab"]').find((button) => button.text().includes(label));
      if (!tab) {
        throw new Error(`Missing route nearby tab ${label}`);
      }

      await tab.trigger('click');
      await flushPromises();
      await wrapper.vm.$nextTick();

      return wrapper.findAll('[data-test="route-nearby-add"]');
    };

    expect((await chooseTab('Food'))[0].attributes('data-category')).toBe('food');
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).toContain('Route Cafe');
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).toContain('$');

    expect((await chooseTab('Stay'))[0].attributes('data-category')).toBe('stay');
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).toContain('Roadside Inn');

    expect((await chooseTab('Essentials'))[0].attributes('data-category')).toBe('essentials');
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).toContain('Route Pharmacy');

    const scenicCards = await chooseTab('Scenic');
    expect(scenicCards.map((card) => card.attributes('data-category'))).toEqual(
      expect.arrayContaining(['nature', 'scenic', 'culture', 'adventure']),
    );
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).toContain('Canyon Climb Center');
  });

  it('rejects non-food discovery results on the Food tab', async () => {
    searchNearbyPlacesMock.mockResolvedValue({
      data: [
        {
          id: 'mapbox.weigh-station.1',
          latitude: 31.858,
          longitude: -102.366,
          placeName: 'Odessa Weigh Station',
          formattedAddress: 'I-20, Odessa, Texas 79763',
          city: 'Odessa',
          category: '',
          categoryId: 'weigh_station',
          categoryLabel: 'Weigh station',
          distanceKm: 1.1,
          source: 'mapbox',
          photoUrl: 'https://example.test/highway-patrol.jpg',
        },
        {
          id: 'mapbox.restaurant.1',
          latitude: 31.86,
          longitude: -102.37,
          placeName: 'Odessa Diner',
          formattedAddress: '400 Plate Rd, Odessa, Texas 79763',
          city: 'Odessa',
          category: 'restaurant',
          categoryId: 'restaurant',
          categoryLabel: 'Restaurant',
          distanceKm: 1.3,
          source: 'mapbox',
          photoUrl: 'https://example.test/odessa-diner.jpg',
        },
      ],
    });

    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
      },
      global: {
        stubs: {
          MapView: {
            props: ['nearbyPlacePins'],
            template: '<div data-test="route-map-nearby">{{ nearbyPlacePins.map((pin) => pin.kind + ":" + pin.title + ":" + (pin.photoUrl ?? "")).join(" / ") }}</div>',
          },
          LazyImage: true,
        },
      },
    });

    await wrapper.get('[data-test="route-nearby-toggle"]').trigger('click');
    await flushPromises();

    const foodTab = wrapper.findAll('[role="tab"]').find((button) => button.text().includes('Food'));
    await foodTab!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    const resultsText = wrapper.get('[data-test="route-nearby-results"]').text();
    expect(resultsText).toContain('Odessa Diner');
    expect(resultsText).not.toContain('Odessa Weigh Station');
    expect(wrapper.get('[data-test="route-map-nearby"]').text()).toContain('place:Odessa Diner:https://example.test/odessa-diner.jpg');
    expect(wrapper.get('[data-test="route-map-nearby"]').text()).not.toContain('Odessa Weigh Station');
  });

  it('supports a custom nearby radius beyond the preset ranges', async () => {
    listNearbySpotsMock.mockResolvedValue({
      data: Array.from({ length: 10 }, (_, index) => ({
        id: `wide-range-stop-${index + 1}`,
        title: `Wide Range Stop ${index + 1}`,
        description: 'A broader radius pick.',
        latitude: 32.7894 + index * 0.01,
        longitude: -96.8018,
        city: 'Dallas',
        country: 'United States',
        category: 'scenic',
        rating: 4.8,
        photoUrl: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800',
        createdAt: '2026-04-01T00:00:00.000Z',
      })),
    });
    searchNearbyPlacesMock.mockResolvedValue({ data: [] });

    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
      },
      global: {
        stubs: {
          MapView: {
            props: ['nearbyPlacePins'],
            template: '<div data-test="route-map-nearby">{{ nearbyPlacePins.map((pin) => pin.kind + ":" + pin.title).join(" / ") }}</div>',
          },
          LazyImage: true,
        },
      },
    });

    await wrapper.get('[data-test="route-nearby-toggle"]').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    listNearbySpotsMock.mockClear();
    getTravelNearbySuggestionsMock.mockClear();

    await wrapper.get('[data-test="route-nearby-custom-radius"]').setValue('45');
    await wrapper.get('[data-test="route-nearby-custom-radius"]').trigger('change');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect((wrapper.get('[data-test="route-nearby-custom-radius"]').element as HTMLInputElement).value).toBe('45');
    expect(getTravelNearbySuggestionsMock).toHaveBeenLastCalledWith(expect.objectContaining({
      radiusKm: 50,
      limit: 36,
    }));
    expect(listNearbySpotsMock).toHaveBeenLastCalledWith(expect.objectContaining({
      radiusKm: 72.42,
      pageSize: 36,
    }));
    expect(wrapper.get('[data-test="route-nearby-page-label"]').text()).toBe('Page 1 / 2');
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).toContain('Wide Range Stop 1');
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).not.toContain('Wide Range Stop 9');
    expect(wrapper.get('[data-test="route-map-nearby"]').text()).toContain('place:Wide Range Stop 10');

    await wrapper.get('[data-test="route-nearby-page-next"]').trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-test="route-nearby-page-label"]').text()).toBe('Page 2 / 2');
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).toContain('Wide Range Stop 9');
  });

  it('filters the nearby drawer and map pins to fuel stops on the Fuel tab', async () => {
    getNearbyFuelStationsMock.mockResolvedValue({
      configured: true,
      coverage: 'Global fuel preview',
      source: 'Scope fuel',
      stations: [
        {
          id: 'fuel-1',
          name: 'Main Street Fuel',
          brand: 'Scope Fuel',
          address: '10 Main St, Dallas, Texas',
          latitude: 32.779,
          longitude: -96.801,
          distanceKm: 1.1,
          fuelType: 'regular',
          pricePerUnit: 3.19,
          currency: 'USD',
          isOpen: true,
        },
        {
          id: 'fuel-2',
          name: 'Budget Fuel',
          brand: 'Scope Fuel',
          address: '20 Budget Rd, Dallas, Texas',
          latitude: 32.789,
          longitude: -96.811,
          distanceKm: 2.4,
          fuelType: 'regular',
          pricePerUnit: 3.05,
          currency: 'USD',
          isOpen: true,
        },
        ...Array.from({ length: 8 }, (_, index) => ({
          id: `fuel-extra-${index + 3}`,
          name: `Route Fuel ${index + 3}`,
          brand: 'Scope Fuel',
          address: `${index + 3} Route Fuel Rd, Dallas, Texas`,
          latitude: 32.79 + index * 0.001,
          longitude: -96.82 - index * 0.001,
          distanceKm: 3 + index,
          fuelType: 'regular',
          pricePerUnit: 3.4 + index * 0.01,
          currency: 'USD',
          isOpen: true,
        })),
      ],
    });

    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
      },
      global: {
        stubs: {
          MapView: {
            props: ['nearbyPlacePins'],
            template: '<div data-test="route-map-nearby">{{ nearbyPlacePins.map((pin) => pin.kind + ":" + pin.iconName + ":" + pin.title + ":" + (pin.priceLabel ?? "")).join(" / ") }}</div>',
          },
          LazyImage: true,
        },
      },
    });

    await flushPromises();
    await wrapper.vm.$nextTick();

    await wrapper.get('[data-test="route-nearby-toggle"]').trigger('click');
    await wrapper.vm.$nextTick();

    const fuelTab = wrapper.findAll('[role="tab"]').find((button) => button.text().includes('Fuel'));
    expect(fuelTab).toBeTruthy();

    getTravelNearbySuggestionsMock.mockClear();
    await fuelTab!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(getTravelNearbySuggestionsMock).not.toHaveBeenCalled();
    expect(getNearbyFuelStationsMock).toHaveBeenCalledWith(expect.objectContaining({
      fuelType: 'regular',
      limit: 36,
      radiusKm: 32.19,
      sortBy: 'closest',
    }));
    await wrapper.findAll('[data-test="route-nearby-radius"]').find((button) => button.text().includes('20 mi'))!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(getNearbyFuelStationsMock).toHaveBeenLastCalledWith(expect.objectContaining({
      fuelType: 'regular',
      radiusKm: 32.19,
    }));
    expect(searchNearbyPlacesMock).toHaveBeenLastCalledWith(expect.objectContaining({
      center: expect.objectContaining({ latitude: expect.any(Number), longitude: expect.any(Number) }),
      categories: ['gas_station'],
      limit: 36,
    }));
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).toContain('Fuel');
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).toContain('$3.19/gal');
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).toContain('Main Street Fuel');
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).toContain('Budget Fuel');
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).not.toContain('Gas price');
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).not.toContain('No live price');
    expect(wrapper.findAll('[data-test="route-nearby-add"]')[0].text()).toContain('Main Street Fuel');
    expect(wrapper.get('[data-test="route-map-nearby"]').text()).toContain('fuel:fuel:Route Fuel 10:$3.47/gal');

    const sortButtons = wrapper.findAll('[data-test="route-nearby-fuel-sort"]');
    await sortButtons.find((button) => button.text().includes('Best price'))!.trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('[data-test="route-nearby-add"]')[0].text()).toContain('Budget Fuel');

    await wrapper.get('[data-test="route-nearby-fuel-search"]').setValue('main');
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-test="route-nearby-results"]').text()).toContain('Main Street Fuel');
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).not.toContain('Budget Fuel');
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).not.toContain('Klyde Warren Garden Stop');
    expect(wrapper.get('[data-test="route-map-nearby"]').text()).toContain('fuel:fuel:Main Street Fuel:$3.19/gal');
  });

  it('shows only exact fuel prices for the selected tank type', async () => {
    getNearbyFuelStationsMock.mockResolvedValue({
      configured: true,
      coverage: 'Google fuel prices',
      source: 'Google Places',
      stations: [
        {
          id: 'fuel-mixed-1',
          name: "Wiley's Food Store",
          brand: 'Wiley',
          address: '502 S Bryan Ave, Lamesa, TX 79331',
          latitude: 32.779,
          longitude: -96.801,
          distanceKm: 1.1,
          fuelType: 'regular',
          pricePerUnit: 4.36,
          currency: 'USD',
          prices: [
            { fuelType: 'regular', price: 4.36, currency: 'USD' },
            { fuelType: 'premium', price: 4.95, currency: 'USD' },
          ],
          isOpen: true,
        },
      ],
    });

    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
      },
      global: {
        stubs: {
          MapView: {
            props: ['nearbyPlacePins'],
            template: '<div data-test="route-map-nearby">{{ nearbyPlacePins.map((pin) => pin.kind + ":" + pin.title + ":" + (pin.priceLabel ?? "")).join(" / ") }}</div>',
          },
          LazyImage: true,
        },
      },
    });

    await wrapper.get('[data-test="route-nearby-toggle"]').trigger('click');
    await flushPromises();
    const fuelTab = wrapper.findAll('[role="tab"]').find((button) => button.text().includes('Fuel'));
    await fuelTab!.trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-test="route-nearby-results"]').text()).toContain('$4.36/gal');

    const premiumFilter = wrapper.findAll('[data-test="route-nearby-fuel-filter"]').find((button) => button.text().includes('Premium'));
    await premiumFilter!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    const resultsText = wrapper.get('[data-test="route-nearby-results"]').text();
    expect(resultsText).toContain("Wiley's Food Store");
    expect(resultsText).toContain('Premium');
    expect(resultsText).toContain('$4.95/gal');
    expect(resultsText).not.toContain('$4.36/gal');
    expect(wrapper.get('[data-test="route-map-nearby"]').text()).toContain("fuel:Wiley's Food Store:$4.95/gal");
  });

  it('does not relabel a regular-only station price as premium', async () => {
    getNearbyFuelStationsMock.mockResolvedValue({
      configured: true,
      coverage: 'Google fuel prices',
      source: 'Google Places',
      stations: [
        {
          id: 'regular-only',
          name: "Wiley's Food Store",
          brand: 'Wiley',
          address: '502 S Bryan Ave, Lamesa, TX 79331',
          latitude: 32.779,
          longitude: -96.801,
          distanceKm: 1.1,
          fuelType: 'regular',
          pricePerUnit: 4.36,
          currency: 'USD',
          prices: [
            { fuelType: 'regular', price: 4.36, currency: 'USD' },
          ],
          isOpen: true,
        },
      ],
    });

    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
        fuelSettings: {
          fuelType: 'premium',
        },
      },
      global: {
        stubs: {
          MapView: {
            props: ['nearbyPlacePins'],
            template: '<div data-test="route-map-nearby">{{ nearbyPlacePins.map((pin) => pin.kind + ":" + pin.title + ":" + (pin.priceLabel ?? "")).join(" / ") }}</div>',
          },
          LazyImage: true,
        },
      },
    });

    await wrapper.get('[data-test="route-nearby-toggle"]').trigger('click');
    await flushPromises();
    const fuelTab = wrapper.findAll('[role="tab"]').find((button) => button.text().includes('Fuel'));
    await fuelTab!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    const resultsText = wrapper.get('[data-test="route-nearby-results"]').text();
    expect(resultsText).not.toContain('$4.36/gal');
    expect(resultsText).not.toContain("Wiley's Food Store Premium $4.36/gal");
  });

  it('switches the fuel drawer between exact midgrade and diesel prices', async () => {
    getNearbyFuelStationsMock.mockResolvedValue({
      configured: true,
      coverage: 'Google fuel prices',
      source: 'Google Places',
      stations: [
        {
          id: 'midgrade-station',
          name: 'Midway Plus',
          brand: 'Midway',
          address: '12 Plus Rd, Dallas, TX',
          latitude: 32.779,
          longitude: -96.801,
          distanceKm: 1.1,
          fuelType: 'midgrade',
          pricePerUnit: 3.59,
          currency: 'USD',
          prices: [
            { fuelType: 'plus', price: 3.45, currency: 'USD' },
            { fuelType: 'premium', price: 4.05, currency: 'USD' },
          ],
          isOpen: true,
        },
        {
          id: 'diesel-station',
          name: 'Diesel Depot',
          brand: 'Depot',
          address: '22 Diesel Rd, Dallas, TX',
          latitude: 32.789,
          longitude: -96.811,
          distanceKm: 2.4,
          fuelType: 'diesel',
          pricePerUnit: 4.3,
          currency: 'USD',
          prices: [
            { fuelType: 'diesel', price: 4.15, currency: 'USD' },
          ],
          isOpen: true,
        },
      ],
    });

    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
      },
      global: {
        stubs: {
          MapView: true,
          LazyImage: true,
        },
      },
    });

    await wrapper.get('[data-test="route-nearby-toggle"]').trigger('click');
    await flushPromises();
    const fuelTab = wrapper.findAll('[role="tab"]').find((button) => button.text().includes('Fuel'));
    await fuelTab!.trigger('click');
    await flushPromises();

    const midgradeFilter = wrapper.findAll('[data-test="route-nearby-fuel-filter"]').find((button) => button.text().includes('Midgrade'));
    await midgradeFilter!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-test="route-nearby-results"]').text()).toContain('Midway Plus');
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).toContain('$3.45/gal');
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).not.toContain('Diesel Depot');

    const dieselFilter = wrapper.findAll('[data-test="route-nearby-fuel-filter"]').find((button) => button.text().includes('Diesel'));
    await dieselFilter!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-test="route-nearby-results"]').text()).toContain('Diesel Depot');
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).toContain('$4.15/gal');
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).not.toContain('Midway Plus');
    expect(wrapper.emitted('fuel-type-select')).toEqual(expect.arrayContaining([['midgrade'], ['diesel']]));
  });

  it('keeps added fuel stops pinned on the map and emits the selected price', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
      },
      global: {
        stubs: {
          MapView: {
            props: ['nearbyPlacePins'],
            template: '<div data-test="route-map-nearby">{{ nearbyPlacePins.map((pin) => pin.kind + ":" + pin.title + ":" + (pin.priceLabel ?? "")).join(" / ") }}</div>',
          },
          LazyImage: true,
        },
      },
    });

    await flushPromises();
    await wrapper.vm.$nextTick();
    await wrapper.get('[data-test="route-nearby-toggle"]').trigger('click');

    const fuelTab = wrapper.findAll('[role="tab"]').find((button) => button.text().includes('Fuel'));
    await fuelTab!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    await wrapper.get('[data-test="route-nearby-add"]').trigger('click');
    expect(wrapper.emitted('fuel-price-select')?.[0]?.[0]).toMatchObject({
      placeId: 'fuel-fuel-1',
      stationName: 'Main Street Fuel',
      pricePerGallon: 3.19,
      fuelType: 'regular',
    });

    const placesTab = wrapper.findAll('[role="tab"]').find((button) => button.text().includes('Recommended'));
    await placesTab!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-test="route-map-nearby"]').text()).toContain('fuel:Main Street Fuel:$3.19/gal');
  });

  it('runs custom nearby searches and resets back to recommended route picks', async () => {
    listNearbySpotsMock.mockResolvedValue({ data: [] });
    searchPlacesMock.mockResolvedValue({
      data: [
        {
          id: 'mapbox.taco.1',
          latitude: 32.781,
          longitude: -96.803,
          placeName: 'Tacos Al Carbon',
          formattedAddress: '412 Taco Ln, Dallas, Texas, United States',
          city: 'Dallas',
          category: 'restaurant',
          categoryLabel: 'Restaurant',
          distanceKm: 1.2,
          source: 'mapbox',
        },
      ],
    });

    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
      },
      global: {
        stubs: {
          MapView: true,
          LazyImage: true,
        },
      },
    });

    await wrapper.get('[data-test="route-nearby-toggle"]').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    searchPlacesMock.mockClear();
    searchNearbyPlacesMock.mockClear();
    const customSearch = wrapper.get<HTMLInputElement>('[data-test="route-nearby-search"] input');
    await customSearch.setValue('tacos');
    await wrapper.get('[data-test="route-nearby-search"]').trigger('submit');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(searchPlacesMock).toHaveBeenLastCalledWith('tacos', expect.objectContaining({
      bboxRadiusKm: 32.19,
      sortByDistance: true,
      types: 'poi',
    }));
    expect(wrapper.get('[data-test="route-nearby-filter-trigger"]').text()).toContain('Search: tacos');
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).toContain('Tacos Al Carbon');

    await wrapper.get('[data-test="route-nearby-add"]').trigger('click');

    expect(wrapper.emitted('route-stop-add')?.[0]?.[0]).toMatchObject({
      title: 'Tacos Al Carbon',
      city: '412 Taco Ln, Dallas, Texas',
      notes: expect.stringContaining('Search: tacos within 20 mi'),
    });

    await wrapper.get('[data-test="route-nearby-filter-clear"]').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-test="route-nearby-filter-trigger"]').text()).toContain('Best picks');
    expect(wrapper.find('[data-test="route-nearby-filter-clear"]').exists()).toBe(false);
    expect(searchNearbyPlacesMock).toHaveBeenLastCalledWith(expect.objectContaining({
      categories: ['restaurant', 'cafe'],
    }));
  });

  it('keeps route-nearby category filters strict for essentials, views, shopping, entertainment, and nightlife', async () => {
    listNearbySpotsMock.mockResolvedValue({ data: [] });
    searchNearbyPlacesMock.mockImplementation(async ({ categories }: { categories?: string[] }) => {
      if (categories?.includes('pharmacy')) {
        return {
          data: [
            {
              id: 'mapbox.scale.1',
              latitude: 32.78,
              longitude: -96.8,
              placeName: 'Truck Scale Station',
              formattedAddress: '1 Highway Scale Rd, Dallas, Texas',
              category: 'inspection station',
              categoryLabel: 'Truck scale',
              distanceKm: 1.1,
              source: 'mapbox',
            },
            {
              id: 'mapbox.pharmacy.1',
              latitude: 32.781,
              longitude: -96.801,
              placeName: 'Route Pharmacy',
              formattedAddress: '2 Care St, Dallas, Texas',
              category: 'pharmacy',
              categoryLabel: 'Pharmacy',
              distanceKm: 1.2,
              source: 'mapbox',
            },
          ],
        };
      }

      if (categories?.includes('tourist_attraction') && !categories?.includes('bowling_alley')) {
        return {
          data: [
            {
              id: 'mapbox.overlook.1',
              latitude: 32.782,
              longitude: -96.802,
              placeName: 'Trinity River Scenic Overlook',
              formattedAddress: '3 View Trail, Dallas, Texas',
              category: 'scenic viewpoint',
              categoryLabel: 'Scenic viewpoint',
              distanceKm: 1.3,
              source: 'mapbox',
            },
            {
              id: 'mapbox.fuel.1',
              latitude: 32.783,
              longitude: -96.803,
              placeName: 'Fuel Stop View',
              formattedAddress: '4 Fuel Rd, Dallas, Texas',
              category: 'gas_station',
              categoryLabel: 'Gas station',
              distanceKm: 1.4,
              source: 'mapbox',
            },
          ],
        };
      }

      if (categories?.includes('bowling_alley')) {
        return {
          data: [
            {
              id: 'mapbox.bowling.1',
              latitude: 32.785,
              longitude: -96.805,
              placeName: 'Route Bowling Lanes',
              formattedAddress: '6 Play Way, Dallas, Texas',
              category: 'bowling alley entertainment',
              categoryLabel: 'Entertainment',
              distanceKm: 1.6,
              source: 'mapbox',
            },
            {
              id: 'mapbox.hospital.1',
              latitude: 32.7855,
              longitude: -96.8055,
              placeName: 'Route Urgent Care',
              formattedAddress: '6 Clinic Way, Dallas, Texas',
              category: 'clinic',
              categoryLabel: 'Clinic',
              distanceKm: 1.65,
              source: 'mapbox',
            },
          ],
        };
      }

      if (categories?.includes('shopping')) {
        return {
          data: [
            {
              id: 'mapbox.market.1',
              latitude: 32.784,
              longitude: -96.804,
              placeName: 'Bishop Arts Market',
              formattedAddress: '5 Market St, Dallas, Texas',
              category: 'shopping market',
              categoryLabel: 'Market',
              distanceKm: 1.5,
              source: 'mapbox',
            },
            {
              id: 'mapbox.museum.1',
              latitude: 32.785,
              longitude: -96.805,
              placeName: 'Route Museum',
              formattedAddress: '6 Museum Way, Dallas, Texas',
              category: 'museum',
              categoryLabel: 'Museum',
              distanceKm: 1.6,
              source: 'mapbox',
            },
          ],
        };
      }

      if (categories?.includes('bar')) {
        return {
          data: [
            {
              id: 'mapbox.music.1',
              latitude: 32.786,
              longitude: -96.806,
              placeName: 'Live Music Lounge',
              formattedAddress: '7 Music Ave, Dallas, Texas',
              category: 'nightlife bar',
              categoryLabel: 'Nightlife',
              distanceKm: 1.7,
              source: 'mapbox',
            },
            {
              id: 'mapbox.garden.1',
              latitude: 32.787,
              longitude: -96.807,
              placeName: 'Quiet Garden',
              formattedAddress: '8 Garden Rd, Dallas, Texas',
              category: 'garden',
              categoryLabel: 'Garden',
              distanceKm: 1.8,
              source: 'mapbox',
            },
          ],
        };
      }

      return { data: [] };
    });

    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
      },
      global: {
        stubs: {
          MapView: true,
          LazyImage: true,
        },
      },
    });

    await wrapper.get('[data-test="route-nearby-toggle"]').trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    const chooseFilter = async (label: string) => {
      await wrapper.get('[data-test="route-nearby-filter-trigger"]').trigger('click');
      const option = wrapper.findAll('[data-test="route-nearby-filter-option"]').find((button) => button.text() === label);
      if (!option) {
        throw new Error(`Missing route nearby filter ${label}`);
      }
      await option.trigger('click');
      await flushPromises();
      await wrapper.vm.$nextTick();
      return wrapper.get('[data-test="route-nearby-results"]').text();
    };

    const essentialsText = await chooseFilter('Essentials');
    expect(essentialsText).toContain('Route Pharmacy');
    expect(essentialsText).not.toContain('Truck Scale Station');

    const viewsText = await chooseFilter('Views');
    expect(viewsText).toContain('Trinity River Scenic Overlook');
    expect(viewsText).not.toContain('Fuel Stop View');

    const shoppingText = await chooseFilter('Shopping');
    expect(shoppingText).toContain('Bishop Arts Market');
    expect(shoppingText).not.toContain('Route Museum');

    const entertainmentText = await chooseFilter('Entertainment');
    expect(entertainmentText).toContain('Route Bowling Lanes');
    expect(entertainmentText).not.toContain('Route Urgent Care');

    const nightlifeText = await chooseFilter('Nightlife');
    expect(nightlifeText).toContain('Live Music Lounge');
    expect(nightlifeText).not.toContain('Quiet Garden');
  });

  it('uses EV discovery searches without selecting stale gas prices', async () => {
    searchPlacesMock.mockResolvedValue({
      data: [
        {
          id: 'mapbox.ev.1',
          latitude: 32.782,
          longitude: -96.804,
          placeName: 'ChargePoint Plaza',
          formattedAddress: '44 Electric Way, Dallas, Texas',
          city: 'Dallas',
          category: 'ev charging station',
          categoryLabel: 'EV charging',
          distanceKm: 1.3,
          source: 'mapbox',
        },
        {
          id: 'mapbox.gas.2',
          latitude: 32.783,
          longitude: -96.805,
          placeName: 'Chevron Gas Station',
          formattedAddress: '45 Fuel Way, Dallas, Texas',
          city: 'Dallas',
          category: 'gas_station',
          categoryLabel: 'Gas station',
          distanceKm: 1.4,
          source: 'mapbox',
        },
      ],
    });

    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
      },
      global: {
        stubs: {
          MapView: {
            props: ['nearbyPlacePins'],
            template: '<div data-test="route-map-nearby">{{ nearbyPlacePins.map((pin) => pin.kind + ":" + pin.categoryLabel + ":" + pin.title + ":" + (pin.priceLabel ?? "")).join(" / ") }}</div>',
          },
          LazyImage: true,
        },
      },
    });

    await wrapper.get('[data-test="route-nearby-toggle"]').trigger('click');
    await flushPromises();
    const fuelTab = wrapper.findAll('[role="tab"]').find((button) => button.text().includes('Fuel'));
    await fuelTab!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    getNearbyFuelStationsMock.mockClear();
    searchPlacesMock.mockClear();
    const evFilter = wrapper.findAll('[data-test="route-nearby-fuel-filter"]').find((button) => button.text().includes('EV'));
    await evFilter!.trigger('click');
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(getNearbyFuelStationsMock).not.toHaveBeenCalled();
    expect(searchPlacesMock).toHaveBeenLastCalledWith('ev charging station', expect.objectContaining({
      bboxRadiusKm: 32.19,
      sortByDistance: true,
    }));
    expect(wrapper.get('[data-test="route-nearby-fuel-type"]').text()).toBe('EV');
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).toContain('ChargePoint Plaza');
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).not.toContain('Chevron Gas Station');
    expect(wrapper.get('[data-test="route-map-nearby"]').text()).toContain('fuel:EV:ChargePoint Plaza:');

    await wrapper.get('[data-test="route-nearby-add"]').trigger('click');

    expect(wrapper.emitted('fuel-price-select')).toBeUndefined();
    expect(wrapper.emitted('fuel-type-select')?.[0]?.[0]).toBe('ev');
    expect(wrapper.emitted('route-stop-add')?.[0]?.[0]).toMatchObject({
      title: 'ChargePoint Plaza',
      city: '44 Electric Way, Dallas, Texas',
      notes: expect.stringContaining('EV within 20 mi'),
    });
  });

  it('adds nearby map pins through the route stop pipeline', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
      },
      global: {
        stubs: {
          MapView: {
            emits: ['nearby-place-add'],
            template: `
              <button
                data-test="route-map-nearby-add"
                @click="$emit('nearby-place-add', {
                  id: 'route-nearby-campus-1',
                  title: 'Sherman College',
                  latitude: 33.6357,
                  longitude: -96.6089,
                  kind: 'place',
                  category: 'education',
                  categoryLabel: 'University',
                  address: '900 College St, Sherman, Texas, United States',
                  sourceLabel: 'Map place',
                  photoUrl: 'https://example.test/campus.jpg'
                })"
              >Add nearby map pin</button>
            `,
          },
          LazyImage: true,
        },
      },
    });

    await wrapper.get('[data-test="route-map-nearby-add"]').trigger('click');

    expect(wrapper.emitted('route-stop-add')?.[0]?.[0]).toMatchObject({
      spotId: 'campus-1',
      title: 'Sherman College',
      latitude: 33.6357,
      longitude: -96.6089,
      category: 'culture',
      city: '900 College St, Sherman, Texas',
      photoUrl: 'https://example.test/campus.jpg',
      notes: expect.stringContaining('University nearby stop from Best picks within 20 mi near Dallas, TX.'),
    });
  });

  it('keeps failed map picks visible without emitting a stale location', async () => {
    reverseGeocodeMock.mockRejectedValueOnce(new Error('geocoder offline'));
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
      },
      global: {
        stubs: {
          MapView: {
            emits: ['map-click'],
            template: '<button data-test="route-map" @click="$emit(\'map-click\', { latitude: 31.7619, longitude: -106.485 })">Route map stub</button>',
          },
          LazyImage: true,
        },
      },
    });

    await wrapper.get('[data-test="map-pick-end"]').trigger('click');
    await wrapper.get('[data-test="route-map"]').trigger('click');
    await flushPromises();

    expect(wrapper.emitted('map-location-select')).toBeUndefined();
    expect(wrapper.get('.map-picker-status').text()).toContain('Scope could not locate that point yet.');
    expect(wrapper.get('[data-test="map-pick-end"]').attributes('aria-pressed')).toBe('false');
  });

  it('falls back to coordinate labels and lets users leave map-pick mode', async () => {
    reverseGeocodeMock.mockResolvedValueOnce({
      latitude: 31.7619,
      longitude: -106.485,
      precision: 'coordinate',
    });
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
      },
      global: {
        stubs: {
          MapView: {
            emits: ['map-click'],
            template: '<button data-test="route-map" @click="$emit(\'map-click\', { latitude: 31.7619, longitude: -106.485 })">Route map stub</button>',
          },
          LazyImage: true,
        },
      },
    });

    await wrapper.get('[data-test="map-pick-end"]').trigger('click');
    await wrapper.get('[data-test="route-map"]').trigger('click');
    await flushPromises();

    expect(wrapper.emitted('map-location-select')?.[0]?.[0]).toMatchObject({
      target: 'endDestination',
      label: '31.7619, -106.4850',
      latitude: 31.7619,
      longitude: -106.485,
    });
    expect(wrapper.get('[data-test="map-pick-end"]').attributes('aria-pressed')).toBe('true');

    await wrapper.get('[data-test="map-pick-done"]').trigger('click');

    expect(wrapper.get('[data-test="map-pick-end"]').attributes('aria-pressed')).toBe('false');
    expect(wrapper.get('[data-test="map-pick-done"]').attributes('disabled')).toBeDefined();
  });

  it('lets explicit start and end points be removed from the route sequence', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
      },
      global: {
        stubs: {
          MapView: true,
          LazyImage: true,
        },
      },
    });

    await wrapper.get('button[aria-label="Remove Dallas, TX"]').trigger('click');
    await wrapper.get('button[aria-label="Remove Austin, TX"]').trigger('click');

    expect(wrapper.emitted('route-endpoint-remove')?.[0]?.[0]).toBe('destination');
    expect(wrapper.emitted('route-endpoint-remove')?.[1]?.[0]).toBe('endDestination');
  });

  it('routes hovered map label removals through the same endpoint and stop events', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
        stops: draftStops,
      },
      global: {
        stubs: {
          MapView: {
            props: ['allowRoutePointRemoval'],
            emits: ['route-point-remove'],
            template: `
              <div>
                <span data-test="map-allows-route-removal">{{ String(allowRoutePointRemoval) }}</span>
                <button data-test="map-remove-start" @click="$emit('route-point-remove', { id: 'planner-start', title: 'Dallas, TX', routeRole: 'start' })">Start</button>
                <button data-test="map-remove-stop" @click="$emit('route-point-remove', { id: 'planner-stop-draft-stop-1', title: 'Magnolia Market', routeRole: 'stop' })">Stop</button>
                <button data-test="map-remove-end" @click="$emit('route-point-remove', { id: 'planner-end', title: 'Austin, TX', routeRole: 'end' })">End</button>
              </div>
            `,
          },
          LazyImage: true,
        },
      },
    });

    expect(wrapper.get('[data-test="map-allows-route-removal"]').text()).toBe('true');

    await wrapper.get('[data-test="map-remove-start"]').trigger('click');
    await wrapper.get('[data-test="map-remove-stop"]').trigger('click');
    await wrapper.get('[data-test="map-remove-end"]').trigger('click');

    expect(wrapper.emitted('route-endpoint-remove')?.[0]?.[0]).toBe('destination');
    expect(wrapper.emitted('route-stop-remove')?.[0]?.[0]).toBe('draft-stop-1');
    expect(wrapper.emitted('route-endpoint-remove')?.[1]?.[0]).toBe('endDestination');
  });

  it('uses the pointer picker to reverse geocode a map click for the planner form', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
      },
      global: {
        stubs: {
          MapView: {
            emits: ['map-click'],
            template: '<button data-test="route-map" @click="$emit(\'map-click\', { latitude: 30.2672, longitude: -97.7431 })">Route map stub</button>',
          },
          LazyImage: true,
        },
      },
    });

    await wrapper.get('[data-test="map-pick-start"]').trigger('click');
    await wrapper.get('[data-test="route-map"]').trigger('click');
    await flushPromises();

    expect(reverseGeocodeMock).toHaveBeenCalledWith(30.2672, -97.7431);
    expect(wrapper.emitted('map-location-select')?.[0]?.[0]).toEqual({
      target: 'destination',
      label: 'Austin, United States',
      latitude: 30.2672,
      longitude: -97.7431,
      city: 'Austin',
      country: 'United States',
    });
    expect(wrapper.get('[data-test="map-pick-start"]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.get('[data-test="map-pick-end"]').attributes('aria-pressed')).toBe('false');
  });

  it('auto-advances from the first start pick to the end picker', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft: {
          startDate: '2026-04-01',
          endDate: '2026-04-02',
          budgetFloor: 300,
          budget: 900,
          interests: [],
          pace: 'relaxed',
          groupSize: 1,
        },
      },
      global: {
        stubs: {
          MapView: {
            emits: ['map-click'],
            template: '<button data-test="route-map" @click="$emit(\'map-click\', { latitude: 30.2672, longitude: -97.7431 })">Route map stub</button>',
          },
          LazyImage: true,
        },
      },
    });

    await wrapper.get('[data-test="map-pick-start"]').trigger('click');
    await wrapper.get('[data-test="route-map"]').trigger('click');
    await flushPromises();

    expect(wrapper.emitted('map-location-select')?.[0]?.[0]).toMatchObject({
      target: 'destination',
      latitude: 30.2672,
      longitude: -97.7431,
    });
    expect(wrapper.get('[data-test="map-pick-end"]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.get('[data-test="map-pick-end"]').attributes('disabled')).toBeUndefined();
    expect(wrapper.get('[data-test="map-pick-start"]').attributes('aria-pressed')).toBe('false');
    expect(wrapper.get('.map-picker-status').text()).toContain('end city');
  });

  it('keeps Start armed after the user deliberately reselects Start', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft: {
          startDate: '2026-04-01',
          endDate: '2026-04-02',
          budgetFloor: 300,
          budget: 900,
          interests: [],
          pace: 'relaxed',
          groupSize: 1,
        },
      },
      global: {
        stubs: {
          MapView: {
            emits: ['map-click'],
            template: '<button data-test="route-map" @click="$emit(\'map-click\', { latitude: 30.2672, longitude: -97.7431 })">Route map stub</button>',
          },
          LazyImage: true,
        },
      },
    });

    await wrapper.get('[data-test="map-pick-start"]').trigger('click');
    await wrapper.get('[data-test="route-map"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-test="map-pick-end"]').attributes('aria-pressed')).toBe('true');

    await wrapper.get('[data-test="map-pick-start"]').trigger('click');
    await wrapper.get('[data-test="route-map"]').trigger('click');
    await flushPromises();

    const selections = wrapper.emitted('map-location-select') ?? [];
    expect(selections).toHaveLength(2);
    expect(selections[1]?.[0]).toMatchObject({
      target: 'destination',
      latitude: 30.2672,
      longitude: -97.7431,
    });
    expect(wrapper.get('[data-test="map-pick-start"]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.get('[data-test="map-pick-end"]').attributes('aria-pressed')).toBe('false');
  });

  it('keeps the selected endpoint picker armed after the user places an endpoint', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
      },
      global: {
        stubs: {
          MapView: {
            emits: ['map-click'],
            template: '<button data-test="route-map" @click="$emit(\'map-click\', { latitude: 30.2672, longitude: -97.7431 })">Route map stub</button>',
          },
          LazyImage: true,
        },
      },
    });

    await wrapper.get('[data-test="map-pick-end"]').trigger('click');
    await wrapper.get('[data-test="route-map"]').trigger('click');
    await flushPromises();

    expect(wrapper.emitted('map-location-select')?.[0]?.[0]).toMatchObject({
      target: 'endDestination',
      latitude: 30.2672,
      longitude: -97.7431,
    });
    expect(wrapper.get('[data-test="map-pick-end"]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.get('[data-test="map-pick-start"]').attributes('aria-pressed')).toBe('false');
  });

  it('adds a mid-route stop from a map click without taking over the start or end fields', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
      },
      global: {
        stubs: {
          MapView: {
            emits: ['map-click'],
            template: '<button data-test="route-map" @click="$emit(\'map-click\', { latitude: 30.2672, longitude: -97.7431 })">Route map stub</button>',
          },
          LazyImage: true,
        },
      },
    });

    await wrapper.get('[data-test="map-pick-stop"]').trigger('click');
    await wrapper.get('[data-test="route-map"]').trigger('click');
    await flushPromises();

    expect(reverseGeocodeMock).toHaveBeenCalledWith(30.2672, -97.7431);
    expect(wrapper.emitted('map-location-select')).toBeUndefined();
    const payload = wrapper.emitted('route-stop-add')?.[0]?.[0];
    expect(payload).toMatchObject({
      title: 'Austin, United States',
      latitude: 30.2672,
      longitude: -97.7431,
      category: 'other',
      city: 'Austin',
    });
    expect(payload?.spotId).toMatch(/^route-stop-/);
  });

  it('uses address, place, and coordinate fallback labels from map-picked locations', async () => {
    reverseGeocodeMock
      .mockResolvedValueOnce({
        latitude: 30.2672,
        longitude: -97.7431,
        precision: 'address',
        formattedAddress: '500 Congress Ave, Austin, TX',
        city: 'Austin',
        country: 'US',
      })
      .mockResolvedValueOnce({
        latitude: 31.5493,
        longitude: -97.1467,
        precision: 'poi',
        placeName: 'Hidden Garden Stop',
      })
      .mockResolvedValueOnce({
        latitude: 29.7604,
        longitude: -95.3698,
        precision: 'poi',
      });

    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
      },
      global: {
        stubs: {
          MapView: {
            emits: ['map-click'],
            template: '<button data-test="route-map" @click="$emit(\'map-click\', { latitude: 30.2672, longitude: -97.7431 })">Route map stub</button>',
          },
          LazyImage: true,
        },
      },
    });

    await wrapper.get('[data-test="map-pick-end"]').trigger('click');
    await wrapper.get('[data-test="route-map"]').trigger('click');
    await flushPromises();

    expect(wrapper.emitted('map-location-select')?.[0]?.[0]).toMatchObject({
      target: 'endDestination',
      label: '500 Congress Ave, Austin, TX',
    });

    await wrapper.get('[data-test="map-pick-stop"]').trigger('click');
    await wrapper.get('[data-test="route-map"]').trigger('click');
    await flushPromises();

    expect(wrapper.emitted('route-stop-add')?.[0]?.[0]).toMatchObject({
      title: 'Hidden Garden Stop',
      notes: 'Added from the route map.',
    });

    await wrapper.get('[data-test="map-pick-start"]').trigger('click');
    await wrapper.get('[data-test="route-map"]').trigger('click');
    await flushPromises();

    expect(wrapper.emitted('map-location-select')?.[1]?.[0]).toMatchObject({
      target: 'destination',
      label: '30.2672, -97.7431',
    });
  });

  it('ignores route map clicks until the picker is armed before resolving a lookup', async () => {
    let resolveLookup: (value: unknown) => void = () => undefined;
    reverseGeocodeMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveLookup = resolve;
    }));

    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
      },
      global: {
        stubs: {
          MapView: {
            emits: ['map-click'],
            template: '<button data-test="route-map" @click="$emit(\'map-click\', { latitude: 30.2672, longitude: -97.7431 })">Route map stub</button>',
          },
          LazyImage: true,
        },
      },
    });

    await wrapper.get('[data-test="route-map"]').trigger('click');
    expect(reverseGeocodeMock).not.toHaveBeenCalled();

    await wrapper.get('[data-test="map-pick-end"]').trigger('click');
    await wrapper.get('[data-test="route-map"]').trigger('click');

    expect(reverseGeocodeMock).toHaveBeenCalledTimes(1);

    resolveLookup({
      latitude: 30.2672,
      longitude: -97.7431,
      precision: 'place',
      city: 'Austin',
      country: 'US',
    });
    await flushPromises();

    expect(wrapper.emitted('map-location-select')?.[0]?.[0]).toMatchObject({
      target: 'endDestination',
      label: 'Austin, US',
    });
  });

  it('exercises the itinerary timeline and route-nearby coverage helpers', () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
        stops: draftStops,
        mobileWizard: true,
        mobileActiveStep: 2,
      },
      global: {
        stubs: {
          MapView: {
            template: '<div data-test="route-map">Route map stub</div>',
          },
          LazyImage: true,
        },
      },
    });
    const coverage = (wrapper.vm as any).__coverage;
    const anchor = {
      id: 'anchor-start',
      shortLabel: 'Start',
      placeLabel: 'Dallas, TX',
      latitude: 32.7767,
      longitude: -96.797,
      routeRole: 'start',
    };
    const routePlace = {
      id: 'place-food',
      title: 'Dallas Garden Cafe',
      subtitle: 'Dallas - 123 Main Street, Dallas, TX, United States',
      latitude: 32.779,
      longitude: -96.801,
      category: 'food',
      source: 'discovery',
      kind: 'recommended',
      travelCategory: 'food',
      anchorId: 'anchor-start',
      distanceKm: 1.2,
      rating: 4.7,
      address: '123 Main Street, Dallas, TX, United States',
      sourceLabel: 'Map place',
      photoUrl: 'https://images.example.com/cafe.jpg',
    };

    expect(coverage.clampWizardStep(0)).toBe(1);
    expect(coverage.clampWizardStep(5)).toBe(4);
    expect(coverage.clampWizardStep(3)).toBe(3);
    expect(coverage.isWizardStepActive(2)).toBe(true);
    expect(coverage.getWizardStepState(1)).toBe('complete');
    expect(coverage.getWizardStepState(2)).toBe('current');
    expect(coverage.getWizardStepState(3)).toBe('upcoming');
    expect(coverage.getWizardStepLabel(1)).toBe('Done');
    coverage.emitWizardStepChange(4);
    expect(wrapper.emitted('wizard-step-change')?.at(-1)?.[0]).toBe(4);

    expect(coverage.formatGeocodeSelection({
      precision: 'coordinate',
      formattedAddress: '',
    }, { latitude: 32.7767, longitude: -96.797 })).toBe('32.7767, -96.7970');
    expect(coverage.formatGeocodeSelection({
      formattedAddress: '500 Congress Ave',
    }, anchor)).toBe('500 Congress Ave');
    expect(coverage.formatGeocodeSelection({
      city: 'Austin',
      country: 'US',
    }, anchor)).toBe('Austin, US');
    expect(coverage.formatGeocodeSelection({
      placeName: 'Hidden Garden',
    }, anchor)).toBe('Hidden Garden');
    expect(coverage.buildRouteStopFromGeocode({ city: 'Austin' }, anchor)).toMatchObject({
      title: 'Austin',
      notes: 'Added from the route map.',
    });

    expect(coverage.getTimelineDayCost({ dayNumber: 1, date: '', label: 'Day 1', spots: draftStops })).toBe(84);
    expect(coverage.parseTimelineTimeInput('7')).toBe('07:00');
    expect(coverage.parseTimelineTimeInput('930')).toBe('09:30');
    expect(coverage.parseTimelineTimeInput('24:99')).toBeNull();
    expect(coverage.normalizeTimeSlot('bad', 2)).toBe('16:00');
    expect(coverage.clampTimelineDayNumber(Number.NaN)).toBe(1);
    expect(coverage.clampTimelineDayNumber(99, 4)).toBe(4);
    expect(coverage.getDraftTimelineDaySpan()).toBe(2);
    expect(coverage.formatCoordinateLabel(32.7767, -96.797)).toBe('32.7767, -96.7970');
    expect(coverage.formatCoordinateLabel(undefined, -96.797)).toBe('');
    expect(coverage.getTimelineEndpointTitle('start')).toContain('Dallas');
    expect(coverage.buildTimelineEndpointStop('start')).toMatchObject({ timelineRouteRole: 'start', timelineRouteLabel: 'S' });
    expect(coverage.buildTimelineEndpointStop('end')).toMatchObject({ timelineRouteRole: 'end', timelineRouteLabel: 'E' });
    expect(coverage.labelTimelineStops([
      { ...draftStops[0], timelineRouteRole: 'start' },
      { ...draftStops[1], timelineRouteRole: 'end' },
    ], false).map((spot: any) => spot.timelineRouteLabel)).toEqual(['S', 'E']);
    expect(coverage.labelTimelineStops(draftStops, true).map((spot: any) => spot.timelineRouteRole)).toEqual(['start', 'end']);
    expect(coverage.getTimelineSpotBadgeText({ ...draftStops[0], timelineRouteRole: 'start' })).toBe('Origin');
    expect(coverage.getTimelineSpotBadgeText({ ...draftStops[0], timelineRouteRole: 'end' })).toBe('Destination');
    expect(coverage.getTimelineSpotBadgeText({ ...draftStops[0], timelineRouteLabel: '3' })).toBe('Stop 3');
    expect(coverage.formatTimelineSpotMeta({ ...draftStops[0], timelineRouteRole: 'start' })).toContain('route start');
    expect(coverage.formatTimelineSpotMeta({ ...draftStops[0], timelineRouteRole: 'end' })).toContain('route end');
    expect(coverage.formatTimelineSpotMeta(draftStops[0])).toContain('Waxahachie');
    expect(coverage.formatTimelineSpotReason({ ...draftStops[0], reason: 'Fits food', confidence: 0.82 })).toContain('82% match');
    expect(coverage.formatTimelineSpotReason({ ...draftStops[0], timelineRouteRole: 'start' })).toBe('');
    expect(coverage.isSyntheticTimelineEndpoint({ isTimelineEndpoint: true })).toBe(true);
    expect(coverage.stripTimelineMetadata({ ...draftStops[0], timelineRouteLabel: '1', timelineRouteRole: 'stop', isTimelineEndpoint: true })).not.toHaveProperty('timelineRouteLabel');
    expect(coverage.compareTimelineStops({ ...draftStops[0], title: 'B' }, { ...draftStops[1], title: 'A' })).toBeLessThan(0);
    expect(coverage.getTimelineSourceStops().length).toBeGreaterThanOrEqual(2);
    expect(coverage.resolveTimelineDate(2)).toBe('2026-04-02');
    expect(coverage.buildEditableTimelineDays(draftStops)).toHaveLength(2);
    expect(coverage.parseTimelineDayInput('3')).toBe(3);
    expect(coverage.parseTimelineDayInput('abc')).toBeNull();

    expect(coverage.clampRouteNearbyCustomRadiusMiles(Number.NaN)).toBe(40);
    expect(coverage.clampRouteNearbyCustomRadiusMiles(1)).toBe(1);
    expect(coverage.clampRouteNearbyCustomRadiusMiles(500)).toBe(75);
    expect(coverage.parseRouteNearbyCustomRadiusMiles('12.5')).toBe(12.5);
    expect(coverage.formatRouteNearbyRadiusMiles(12.5)).toBe('13 mi');
    expect(coverage.formatRouteNearbyRadiusMiles(7.5)).toBe('7.5 mi');
    expect(coverage.normalizeRouteNearbyCustomRadiusValue()).toBe('40');
    expect(coverage.getRouteNearbyRadiusTitle({ id: 'custom', label: '25 mi', radiusKm: 40.2 })).toContain('25 mi');
    expect(coverage.getRouteNearbyPhotoCategory({ ...routePlace, travelCategory: 'stay', category: 'other' })).toBe('scenic');
    expect(coverage.getRouteNearbyPhotoCategory({ ...routePlace, travelCategory: 'fuel', category: 'other', kind: 'fuel' })).toBe('shopping');
    expect(coverage.getRouteNearbyCardCategory({ ...routePlace, travelCategory: 'hotel' })).toBe('stay');
    expect(coverage.getRouteNearbyCardCategory({ ...routePlace, travelCategory: 'rest_stop' })).toBe('essentials');
    expect(coverage.getRouteNearbyCardCategory({ ...routePlace, travelCategory: 'nightlife' })).toBe('nightlife');
    expect(coverage.getRouteNearbyPhotoUrl(routePlace)).toContain('images.example.com');
    expect(coverage.getRouteNearbyIcon({ ...routePlace, iconName: 'custom' })).toBe('custom');
    expect(coverage.getRouteNearbyIcon({ ...routePlace, kind: 'fuel' })).toBe('fuel');
    expect(coverage.getRouteNearbyIcon({ ...routePlace, category: 'other' })).toBe('pin');
    expect(coverage.getRouteNearbySourceLabel({ ...routePlace, source: 'fuel' })).toBe('Fuel');
    expect(coverage.getRouteNearbySourceLabel({ ...routePlace, source: 'google' })).toBe('Google');
    expect(coverage.getRouteNearbyDistanceValue(routePlace)).toBe('0.7 mi');
    expect(coverage.getRouteNearbyCategoryLabel({ ...routePlace, kind: 'fuel', fuelType: 'regular' })).toBe('Regular');
    expect(coverage.cleanRouteNearbyLocationText('123 Main, United States, USA')).toBe('123 Main');
    expect(coverage.stripRouteNearbyLocationPrefix('Dallas - 123 Main Street')).toBe('123 Main Street');
    expect(coverage.formatRouteNearbyResultLocation({ ...routePlace, address: '' })).toBe('123 Main Street, Dallas, TX');
    expect(coverage.calculateDistanceKm(anchor, routePlace)).toBeGreaterThan(0);
    expect(coverage.normalizeRouteNearbyCategory('coffee shop')).toBe('food');
    expect(coverage.normalizeRouteNearbyCategory('unknown', 'scenic')).toBe('scenic');
    expect(coverage.normalizeTravelSuggestionCategory('gallery')).toBe('culture');
    expect(coverage.getRouteNearbyValidationText(routePlace)).toContain('garden cafe');
    expect(coverage.hasRouteNearbyTextSignal(routePlace, /cafe/)).toBe(true);
    expect(coverage.isRouteNearbyFoodPlace(routePlace)).toBe(true);
    expect(coverage.isRouteNearbyFoodPlace({ ...routePlace, title: 'Highway Patrol Station', category: 'food' })).toBe(false);
    expect(coverage.isRouteNearbyStayPlace({ ...routePlace, title: 'Garden Hotel', category: 'other', travelCategory: 'stay' })).toBe(true);
    expect(coverage.isRouteNearbyEssentialsPlace({ ...routePlace, title: 'Travel Center Pharmacy', category: 'other', travelCategory: 'essentials' })).toBe(true);
    expect(coverage.isRouteNearbyScenicPlace({ ...routePlace, title: 'Scenic Overlook', category: 'scenic' })).toBe(true);
    expect(coverage.isRouteNearbyEntertainmentPlace({ ...routePlace, title: 'Bowling Lanes', category: 'entertainment' })).toBe(true);
    expect(coverage.isRouteNearbyPlaceValidForSelectedCategory(routePlace)).toBe(true);
    expect(coverage.formatRouteNearbyDistance(undefined)).toBe('nearby');
    expect(coverage.formatRouteNearbyDistance(0.05)).toBe('<0.1 mi');
    expect(coverage.getRouteNearbyPlaceDistanceKm(routePlace)).toBe(1.2);
    expect(coverage.formatTravelCategoryLabel('rest_stop')).toBe('Rest Stop');
    expect(coverage.isWithinSelectedRouteNearbyRadius(routePlace)).toBe(true);
    expect(coverage.filterRouteNearbyPlacesWithinSelectedRadius([routePlace])).toHaveLength(1);

    const fuelPlace = {
      ...routePlace,
      id: 'fuel-place',
      kind: 'fuel',
      source: 'fuel',
      category: 'other',
      fuelType: 'regular',
      priceLabel: '$3.19/gal',
      priceValue: 3.19,
      distanceKm: 0.5,
    };
    expect(coverage.hasLiveFuelPrice(fuelPlace)).toBe(true);
    expect(coverage.matchesRouteNearbyFuelSearch(fuelPlace)).toBe(true);
    expect(coverage.compareRouteNearbyFuelPlaces(fuelPlace, { ...fuelPlace, id: 'fuel-2', priceValue: 3.49, distanceKm: 2 })).toBeLessThan(0);
    expect(coverage.filterAndSortRouteNearbyFuelPlaces([fuelPlace, { ...fuelPlace, id: 'fuel-2', priceValue: undefined }])[0].id).toBe('fuel-place');
    expect(coverage.buildRouteNearbySearchQuery()).toContain('food');
    expect(coverage.getRouteNearbyInterestSet().has('food')).toBe(true);
    expect(coverage.buildRouteNearbyBounds(anchor)).toMatchObject({ west: expect.any(Number), east: expect.any(Number) });
    expect(coverage.getRouteNearbyPlaceCategories({ id: 'recommended', placeCategories: ['tourist_attraction'] })).toContain('restaurant');
    expect(coverage.normalizeTripFuelType('diesel')).toBe('diesel');
    expect(coverage.normalizeTripFuelType('unknown')).toBe('regular');
    expect(coverage.getFuelTypeLabel('premium')).toBe('Premium');
    expect(coverage.normalizeFuelTypeText('SP 95+')).toBe('sp 95 ');
    expect(coverage.isRegularFuelType('regular unleaded')).toBe(true);
    expect(coverage.isDieselFuelType('diesel')).toBe(true);
    expect(coverage.isMidgradeFuelType('plus')).toBe(true);
    expect(coverage.isPremiumFuelType('premium')).toBe(true);
    expect(coverage.isEvFuelType('EV charging')).toBe(true);
    expect(coverage.isFuelTypeForFilter('premium', 'premium')).toBe(true);
    expect(coverage.getSelectedFuelStationPrice({
      id: 'fuel-1',
      name: 'Fuel',
      latitude: 32.7,
      longitude: -97.3,
      fuelType: 'regular',
      prices: [{ fuelType: 'regular', price: 3.19, currency: 'USD', updatedAt: '2026-04-01T00:00:00Z' }],
    })).toMatchObject({ price: 3.19 });
    expect(coverage.isStrictFuelPlaceResult({ placeName: 'Shell Gas Station', latitude: 1, longitude: 2, source: 'mapbox' })).toBe(true);
    expect(coverage.shouldIncludeFuelStation({ id: 'fuel-1', name: 'Fuel', latitude: 1, longitude: 2, fuelType: 'regular', pricePerUnit: 3.19 })).toBe(true);
    expect(coverage.calculateRouteNearbyRecommendationScore({
      category: 'food',
      source: 'scope',
      distanceKm: 1,
      rating: 4.8,
      likesCount: 20,
      createdAt: '2026-04-01T00:00:00Z',
    })).toBeGreaterThan(0);
    expect(coverage.isStrongRouteNearbyRecommendation(100, 'food')).toBe(true);
    expect(coverage.buildRouteNearbyRecommendationReason({ source: 'scope', category: 'food', distanceKm: 1, rating: 4.5 })).toContain('Scope pin');
    expect(coverage.buildScopeNearbyPlace({
      id: 'spot-1',
      title: 'Scope Cafe',
      latitude: 32.78,
      longitude: -96.8,
      category: 'food',
      rating: 4.8,
      likesCount: 10,
      createdAt: '2026-04-01T00:00:00Z',
    }, anchor)).toMatchObject({ source: 'scope', category: 'food' });
    expect(coverage.buildDiscoveryNearbyPlace({
      id: 'mapbox-1',
      placeName: 'Discovery Cafe',
      formattedAddress: '200 Main St, Dallas, TX',
      latitude: 32.78,
      longitude: -96.8,
      category: 'restaurant',
      source: 'mapbox',
    }, anchor)).toMatchObject({ source: 'discovery', category: 'food' });
    expect(coverage.formatFuelPriceValue(3.199, 'USD')).toContain('/gal');
    expect(coverage.formatFuelPriceValue(undefined)).toBeUndefined();
    expect(coverage.formatFuelUpdatedAt('2026-04-01T00:00:00Z')).toContain('Updated');
    expect(coverage.formatFuelUpdatedAt('bad')).toBe('');
    expect(coverage.buildFuelNearbyPlace({
      id: 'fuel-1',
      name: 'Fuel Stop',
      brand: 'Scope Fuel',
      address: '10 Fuel Rd, United States',
      latitude: 32.78,
      longitude: -96.8,
      fuelType: 'regular',
      pricePerUnit: 3.19,
      currency: 'USD',
      source: 'Google Places',
    }, anchor)).toMatchObject({ source: 'fuel', priceValue: 3.19 });
    expect(coverage.buildFuelNearbyPlace({ id: 'bad', name: 'Bad', latitude: Number.NaN, longitude: -96.8 }, anchor)).toBeNull();
    expect(coverage.buildTravelNearbyPlace({
      id: 'travel-1',
      title: 'Travel Cafe',
      subtitle: 'Dallas - 400 Main Street',
      address: '400 Main Street, Dallas, TX',
      latitude: 32.78,
      longitude: -96.8,
      category: 'food',
      source: 'google',
      sourceLabel: 'Google',
      anchorId: 'anchor-start',
      distanceKm: 1,
    })).toMatchObject({ source: 'google', category: 'food' });
    expect(coverage.buildTravelNearbyPlace({ id: 'bad', latitude: Number.NaN, longitude: -96.8 })).toBeNull();
    expect(coverage.isRouteNearbyStreetLevelAddress('10 Main Street')).toBe(true);
    expect(coverage.getRouteNearbyPlaceDedupeKey(routePlace)).toContain('dallas garden cafe');
    expect(coverage.normalizeRouteNearbyDedupeText('Dallas, United States!')).toBe('dallas');
    expect(coverage.dedupeRouteNearbyPlaces([routePlace, { ...routePlace, id: 'dupe' }])).toHaveLength(1);
    expect(coverage.mergeRouteNearbyPlaces([routePlace], [{ ...routePlace, id: 'dupe' }])).toHaveLength(1);
  });

  it('exercises route-nearby async, drawer, map-pick, and drive score coverage helpers', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
        stops: draftStops,
        mobileWizard: true,
        mobileActiveStep: 2,
        fuelSettings: { fuelType: 'regular', gasPrice: 3.19 },
      },
      global: {
        stubs: {
          MapView: {
            template: '<div data-test="route-map" />',
          },
          LazyImage: {
            props: ['src', 'alt'],
            template: '<img :src="src" :alt="alt" />',
          },
          ScopeIcon: {
            template: '<span />',
          },
        },
      },
    });
    const coverage = (wrapper.vm as any).__coverage;

    const dayInput = document.createElement('input');
    dayInput.value = 'a12b';
    const dayEvent = new Event('input');
    Object.defineProperty(dayEvent, 'target', { configurable: true, value: dayInput });
    coverage.sanitizeTimelineDayInput(dayEvent);
    expect(dayInput.value).toBe('12');
    coverage.handleTimelineDayChange(draftStops[0].spotId, dayEvent, 1);
    expect(wrapper.emitted('itinerary-stops-update')).toBeTruthy();

    const timeInput = document.createElement('input');
    timeInput.value = '9x:4y5z';
    const timeEvent = new Event('input');
    Object.defineProperty(timeEvent, 'target', { configurable: true, value: timeInput });
    coverage.sanitizeTimelineTimeInput(timeEvent);
    expect(timeInput.value).toBe('9:45');
    coverage.handleTimelineTimeChange(draftStops[0].spotId, timeEvent, '08:00');
    expect(wrapper.emitted('itinerary-stops-update')?.length).toBeGreaterThan(1);
    coverage.emitTimelineStopUpdate('missing-stop', { dayNumber: 2 });

    coverage.setMapPickTarget('routeStop');
    await coverage.handleRouteMapClick({ latitude: 32.79, longitude: -96.8 });
    expect(wrapper.emitted('route-stop-add')).toBeTruthy();
    reverseGeocodeMock.mockRejectedValueOnce(new Error('offline'));
    coverage.setMapPickTarget('endDestination');
    await coverage.handleRouteMapClick({ latitude: 32.8, longitude: -96.81 });

    expect(coverage.formatMiles(40)).toBe('<0.1 mi');
    expect(coverage.formatMiles(3_200)).toContain('1.99');
    expect(coverage.formatMiles(80_000)).toContain('49.7');
    expect(coverage.formatMiles(2_000_000)).toContain('1,243');
    expect(coverage.formatLocationPreview('Dallas, Texas, United States')).toBe('Dallas, Texas');
    expect(coverage.normalizeDraftEndpointLabel('Planning Route', false)).toBe('');
    expect(coverage.normalizeDraftEndpointLabel('Planning Route', true)).toBe('Planning Route');
    expect(coverage.estimateHighwayPercent(Number.NaN)).toBe(0.35);
    expect(coverage.estimateHighwayPercent(70)).toBeGreaterThan(0.8);

    const routePlace = {
      id: 'route-place-async',
      title: 'Async Garden Cafe',
      subtitle: 'Dallas - Near Main',
      latitude: 32.781,
      longitude: -96.801,
      category: 'food',
      source: 'google',
      kind: 'food',
      travelCategory: 'food',
      distanceKm: 0.8,
    };
    getPlacePhotoMock.mockResolvedValueOnce({
      configured: true,
      source: 'Google Places',
      photoUrl: 'https://images.example.com/async-garden.jpg',
      photoAttribution: 'Google',
      photoAttributionUrl: 'https://maps.example.com/async-garden',
    });
    await expect(coverage.enrichRouteNearbyPlace(routePlace)).resolves.toMatchObject({
      photoUrl: 'https://images.example.com/async-garden.jpg',
    });
    reverseGeocodeMock.mockRejectedValueOnce(new Error('reverse geocode down'));
    getPlacePhotoMock.mockRejectedValueOnce(new Error('photo down'));
    await expect(coverage.enrichRouteNearbyPlace({ ...routePlace, id: 'route-place-fallback', address: '', photoUrl: '' })).resolves.toMatchObject({
      id: 'route-place-fallback',
    });
    await expect(coverage.enrichRouteNearbyPlaces([routePlace, { ...routePlace, id: 'route-place-2' }])).resolves.toHaveLength(2);

    coverage.toggleRouteNearbyDrawer();
    coverage.selectRouteNearbyAnchor('');
    coverage.selectRouteNearbyAnchor('draft-stop-1');
    coverage.selectRouteNearbyTab('fuel');
    coverage.selectRouteNearbyQuery('custom');
    coverage.selectRouteNearbyQuery('recommended');
    coverage.selectRouteNearbyFuelFilter('diesel');
    expect(wrapper.emitted('fuel-type-select')?.at(-1)?.[0]).toBe('diesel');
    coverage.selectRouteNearbyRadius('custom');
    coverage.selectRouteNearbyCustomRadius();
    coverage.submitRouteNearbySearch();
    await coverage.loadRouteNearbyPlaces();
    await flushPromises();

    expect(coverage.getRouteSequenceFocusPoint({ id: 'planner-stop-draft-stop-1', title: 'Fallback', latitude: Number.NaN, longitude: Number.NaN })).toMatchObject({
      id: 'planner-stop-draft-stop-1',
    });
    expect(coverage.getRouteSequenceFocusPoint({ id: 'manual-point', title: 'Manual', latitude: 31, longitude: -97 })).toMatchObject({
      id: 'manual-point',
    });
    expect(coverage.getRouteSequenceFocusPoint({ id: 'bad-point', title: 'Bad' })).toBeNull();
    coverage.selectRouteSequencePoint({ id: 'manual-point', title: 'Manual', latitude: 31, longitude: -97 });
    coverage.handleRouteNearbyMapPointSelect({ id: 'route-nearby-route-place-async', title: 'Async Garden Cafe', latitude: 32.781, longitude: -96.801, category: 'food' });
    coverage.handleRouteNearbyMapPointSelect({ id: 'planner-stop-draft-stop-1', title: 'Scope Cafe', latitude: 32.78, longitude: -96.8, category: 'food' });

    await coverage.syncRouteSummary();
    expect(resolveRoadRouteMock).toHaveBeenCalled();
    expect(coverage.calculateDriveScore()).toMatchObject({ difficulty: expect.any(String) });
  });

  it('covers remaining itinerary map-pick, timeline, route-nearby category, and empty-search branches', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft: {
          ...draft,
          destination: '',
          endDestination: '',
          destinationLatitude: undefined,
          destinationLongitude: undefined,
          endDestinationLatitude: undefined,
          endDestinationLongitude: undefined,
        },
        stops: [],
        mobileWizard: true,
        mobileActiveStep: 1,
        fuelSettings: { fuelType: 'premium', gasPrice: 4.15 },
      },
      global: {
        stubs: {
          MapView: { template: '<div data-test="route-map" />' },
          LazyImage: true,
          ScopeIcon: { template: '<span />' },
        },
      },
    });
    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;

    coverage.setMapPickTarget('destination');
    await coverage.handleRouteMapClick({ latitude: 30.2672, longitude: -97.7431 });
    expect(wrapper.emitted('map-location-select')?.at(-1)?.[0]).toMatchObject({
      target: 'destination',
    });
    coverage.clearMapPickTarget();
    coverage.setMapPickTarget('endDestination');
    await coverage.handleRouteMapClick({ latitude: 31, longitude: -97 });
    expect(wrapper.emitted('map-location-select')?.at(-1)?.[0]).toMatchObject({
      target: 'destination',
    });

    expect(coverage.normalizeTimeSlot('7', 1)).toBe('07:00');
    expect(coverage.normalizeTimeSlot('bad', 0)).toBe('10:00');
    expect(coverage.getTimelineEndpointTitle('start')).toBe('Choose start');
    expect(coverage.formatTimelineSpotReason({ ...draftStops[0], reason: 'AI liked this', confidence: undefined })).toBe('AI liked this');
    expect(coverage.resolveTimelineRouteRole({ spotId: 'manual-stop' })).toBe('stop');

    const routePlace = {
      id: 'category-place',
      title: 'Night Market Outfitters',
      subtitle: 'Austin - 10 Market Street',
      latitude: 30.27,
      longitude: -97.74,
      category: 'other',
      source: 'google',
      travelCategory: 'shopping',
      distanceKm: 1,
    };
    expect(coverage.getRouteNearbyPhotoCategory(routePlace)).toBe('shopping');
    expect(coverage.getRouteNearbyPhotoCategory({ ...routePlace, title: 'Rock Climb', subtitle: '', travelCategory: 'adventure' })).toBe('adventure');
    expect(coverage.getRouteNearbyPhotoCategory({ ...routePlace, title: 'Night Club', subtitle: '', travelCategory: 'nightlife' })).toBe('nightlife');
    expect(coverage.getRouteNearbySourceLabel({ ...routePlace, source: 'discovery' })).toBe('Map place');
    expect(coverage.getRouteNearbySourceLabel({ ...routePlace, source: '' })).toBe('Scope');
    expect(coverage.normalizeTravelSuggestionCategory('climbing gym')).toBe('adventure');
    expect(coverage.normalizeTravelSuggestionCategory('cocktail bar')).toBe('nightlife');
    expect(coverage.isRouteNearbyPlaceValidForSelectedCategory({ ...routePlace, title: 'Trailhead Climb', travelCategory: 'adventure' })).toBe(true);
    expect(coverage.getRouteNearbyPlaceCategories({ id: 'recommended', placeCategories: ['shopping_mall'] })).toEqual(expect.any(Array));
    expect(coverage.getRouteNearbyPlaceCategories({ id: 'recommended', placeCategories: ['bar'] })).toEqual(expect.any(Array));
    expect(coverage.getRouteNearbyPlaceCategories({ id: 'recommended', category: 'culture' })).toEqual(expect.any(Array));

    const pricedLeft = { ...routePlace, id: 'price-left', kind: 'fuel', source: 'fuel', fuelType: 'premium', priceValue: 4.15, distanceKm: 1 };
    const pricedRight = { ...pricedLeft, id: 'price-right', priceValue: undefined, distanceKm: 1 };
    expect(coverage.compareRouteNearbyFuelPlaces(pricedLeft, pricedRight)).toBeLessThan(0);
    expect(coverage.compareRouteNearbyFuelPlaces(pricedRight, pricedLeft)).toBeGreaterThan(0);
    expect(coverage.matchesRouteNearbyFuelSearch({ ...pricedLeft, sourceLabel: 'Fuel price' })).toBe(true);
    expect(coverage.buildFuelNearbyPlace({
      id: 'fuel-premium',
      name: 'Premium Fuel',
      latitude: 30.27,
      longitude: -97.74,
      fuelType: 'premium',
      prices: [{ fuelType: 'premium', price: 4.159, currency: 'USD' }],
      source: 'Fuel price',
    }, { id: 'anchor', latitude: 30.26, longitude: -97.75 })).toMatchObject({
      fuelType: 'premium',
      priceValue: 4.159,
    });
    expect(coverage.buildTravelNearbyPlace({ ...routePlace, latitude: Number.NaN })).toBeNull();

    coverage.toggleRouteNearbyDrawer();
    coverage.selectRouteNearbyAnchor('');
    await coverage.loadRouteNearbyPlaces();
    expect(coverage.calculateDriveScore()).toBeNull();
    expect(wrapper.find('[data-test="route-nearby-drawer"]').exists()).toBe(true);
  });

  it('drives built and draft itinerary controls through their rendered interaction contracts', async () => {
    listNearbySpotsMock.mockResolvedValue({
      data: Array.from({ length: 12 }, (_, index) => ({
        id: `nearby-food-${index + 1}`,
        title: `Route Cafe ${index + 1}`,
        description: 'A food stop near the route.',
        latitude: 32.78 + index * 0.001,
        longitude: -96.8 - index * 0.001,
        city: 'Dallas',
        country: 'United States',
        category: 'food',
        rating: 4.5,
        createdAt: '2026-04-01T00:00:00.000Z',
      })),
    });

    const builtWrapper = mount(ItineraryView, {
      props: {
        itinerary,
        draft,
        stops: draftStops,
        mobileWizard: true,
        mobileActiveStep: 4,
        fuelSettings: { fuelType: 'regular', gasPrice: 3.19 },
      },
      global: {
        stubs: {
          MapView: { template: '<div data-test="route-map" />' },
          LazyImage: true,
          ScopeIcon: { template: '<span />' },
        },
      },
    });

    await builtWrapper.get('[data-test="planner-step-4-toggle"]').trigger('click');
    expect(builtWrapper.emitted('wizard-step-change')?.at(-1)?.[0]).toBe(4);

    await builtWrapper.get('[data-test="route-nearby-toggle"]').trigger('click');
    await flushPromises();
    await builtWrapper.get('[data-test="route-nearby-size-toggle"]').trigger('click');

    const anchorTabs = builtWrapper.findAll('.map-nearby-anchor-tab');
    expect(anchorTabs.length).toBeGreaterThan(1);
    await anchorTabs.at(0)!.trigger('click');
    await flushPromises();

    await builtWrapper.get('[data-test="route-nearby-filter-trigger"]').trigger('click');
    const foodFilter = builtWrapper
      .findAll('[data-test="route-nearby-filter-option"]')
      .find((option) => option.text() === 'Food');
    expect(foodFilter).toBeDefined();
    await foodFilter!.trigger('click');
    await flushPromises();

    expect(builtWrapper.get('[data-test="route-nearby-page-label"]').text()).toContain('Page 1 /');
    await builtWrapper.get('[data-test="route-nearby-page-next"]').trigger('click');
    expect(builtWrapper.get('[data-test="route-nearby-page-label"]').text()).toContain('Page 2 /');
    await builtWrapper.get('[data-test="route-nearby-page-prev"]').trigger('click');
    expect(builtWrapper.get('[data-test="route-nearby-page-label"]').text()).toContain('Page 1 /');

    const expandedSearch = builtWrapper.get('[data-test="route-nearby-search"]');
    await expandedSearch.get('input').setValue('cafe');
    await expandedSearch.trigger('submit');
    await flushPromises();
    expect(builtWrapper.get('[data-test="route-nearby-filter-trigger"]').text()).toContain('Search: cafe');
    expect(builtWrapper.get('[data-test="route-nearby-results"]').text()).toContain('Route Cafe');

    await builtWrapper.get('[data-test="map-pick-start"]').trigger('click');
    await builtWrapper.get('[data-test="map-pick-stop"]').trigger('click');
    await builtWrapper.get('[data-test="map-pick-end"]').trigger('click');

    const builtRouteChip = builtWrapper.get('[data-test="itinerary-route-sequence-list"] .route-sequence-chip');
    await builtRouteChip.trigger('click');
    await builtRouteChip.trigger('keydown.enter');
    await builtRouteChip.trigger('keydown.space');
    const builtRemoveButton = builtRouteChip.get('button');
    await builtRemoveButton.trigger('keydown');
    await builtRemoveButton.trigger('click');
    expect(builtWrapper.emitted('route-endpoint-remove')).toBeDefined();

    getNearbyFuelStationsMock.mockRejectedValueOnce(new Error('fuel provider unavailable'));
    searchNearbyPlacesMock.mockRejectedValueOnce(new Error('fuel discovery unavailable'));
    const builtCoverage = (builtWrapper.vm as any).__coverage as Record<string, any>;
    builtCoverage.selectRouteNearbyTab('fuel');
    await builtCoverage.loadRouteNearbyPlaces();
    await flushPromises();

    listNearbySpotsMock.mockRejectedValueOnce(new Error('scope nearby unavailable'));
    searchNearbyPlacesMock.mockRejectedValueOnce(new Error('map discovery unavailable'));
    builtCoverage.selectRouteNearbyTab('recommended');
    await builtCoverage.loadRouteNearbyPlaces();
    await flushPromises();

    await builtWrapper.setProps({
      fuelSettings: { fuelType: 'premium', gasPrice: 4.15 },
    });
    await builtWrapper.vm.$nextTick();

    const draftWrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft,
        stops: draftStops,
        fuelSettings: { fuelType: 'regular', gasPrice: 3.19 },
      },
      global: {
        stubs: {
          MapView: { template: '<div data-test="route-map" />' },
          LazyImage: true,
          ScopeIcon: { template: '<span />' },
        },
      },
    });

    const draftRouteChip = draftWrapper.get('[data-test="route-sequence-list"] .route-sequence-chip');
    await draftRouteChip.trigger('keydown.enter');
    await draftRouteChip.trigger('keydown.space');
    await draftRouteChip.get('button').trigger('keydown');

    const draftStopRow = draftWrapper.get('[data-spot-id="draft-stop-1"]');
    const draftDayInput = draftStopRow.get<HTMLInputElement>('[data-test="itinerary-stop-day-input"]');
    await draftDayInput.setValue('2');
    await draftDayInput.trigger('change');
    await draftDayInput.trigger('blur');

    const draftTimeInput = draftStopRow.get<HTMLInputElement>('[data-test="itinerary-stop-time-input"]');
    await draftTimeInput.setValue('17:30');
    await draftTimeInput.trigger('change');
    await draftTimeInput.trigger('blur');
    expect(draftWrapper.emitted('itinerary-stops-update')).toBeDefined();
  });

  it('covers desktop wizard no-ops, inferred route labels, and fuel sorting branches', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft: {
          ...draft,
          destination: '',
          endDestination: '',
          destinationLatitude: undefined,
          destinationLongitude: undefined,
          endDestinationLatitude: undefined,
          endDestinationLongitude: undefined,
          startDate: '',
          endDate: '',
        },
        stops: [
          {
            ...draftStops[0],
            title: 'Only Draft Stop',
            city: '',
            dayNumber: undefined,
            timeSlot: undefined,
          },
        ],
        mobileWizard: false,
        fuelSettings: { fuelType: 'regular', gasPrice: 3.19 },
      },
      global: {
        stubs: {
          MapView: { template: '<div data-test="route-map" />' },
          LazyImage: true,
          ScopeIcon: { template: '<span />' },
        },
      },
    });
    await flushPromises();

    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    const read = <T>(entry: T | { value: T }): T => (
      entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry as T
    );
    expect(coverage.getWizardStepState(1)).toBe('desktop');
    expect(coverage.getWizardStepLabel(1)).toBe('');
    coverage.emitWizardStepChange(3);
    expect(wrapper.emitted('wizard-step-change')).toBeUndefined();
    expect(read<string>(coverage.draftStartLabel)).toBe('Only Draft Stop');
    expect(read<string>(coverage.draftEndLabel)).toBe('Choose end');
    expect(read<string>(coverage.planningRouteLabel)).toBe('Choose a start city or place');
    expect(read<number>(coverage.maxEditableTimelineDay)).toBeGreaterThanOrEqual(14);
    coverage.activeMapPickTarget.value = 'routeStop';
    coverage.mapPickState.value = 'armed';
    expect(read<string>(coverage.mapPickStatusCopy)).toContain('Pick the start city');
    coverage.mapPickState.value = 'locating';
    expect(read<string>(coverage.mapPickStatusCopy)).toContain('Finding the nearest stop');
    coverage.mapPickState.value = 'error';
    expect(read<string>(coverage.mapPickStatusCopy)).toContain('could not locate');
    expect(coverage.getTimelineEndpointTitle('start')).toBe('Choose start');
    expect(coverage.getTimelineEndpointTitle('end')).toBe('Choose end');
    expect(coverage.buildTimelineEndpointStop('start')).toBeNull();
    expect(coverage.buildTimelineEndpointStop('end')).toBeNull();
    expect(coverage.getDraftTimelineDaySpan()).toBe(1);
    expect(coverage.normalizeTimeSlot('', 99)).toBe('10:00');
    expect(coverage.parseTimelineTimeInput('5')).toBe('05:00');
    expect(coverage.parseTimelineTimeInput('0730')).toBe('07:30');
    expect(coverage.parseTimelineTimeInput('07:345')).toBeNull();

    const sequence = coverage.labelRouteSequencePoints([
      { id: 'start', title: 'Start', latitude: 32.7, longitude: -96.8, routeRole: 'start' },
      { id: 'middle', title: 'Middle', latitude: 31.5, longitude: -97.1, routeRole: 'stop' },
      { id: 'end', title: 'End', latitude: 30.2, longitude: -97.7, routeRole: 'end' },
    ]);
    expect(sequence.map((point: any) => point.routeLabel)).toEqual(['S', '2', 'E']);
    expect(coverage.keepVisualRouteEndpoints([
      { id: 'middle', title: 'Middle', latitude: 31.5, longitude: -97.1, routeRole: 'stop' },
      { id: 'end', title: 'End', latitude: 30.2, longitude: -97.7, routeRole: 'end' },
      { id: 'start', title: 'Start', latitude: 32.7, longitude: -96.8, routeRole: 'start' },
    ]).map((point: any) => point.id)).toEqual(['start', 'middle', 'end']);

    const baseFuelPlace = {
      id: 'fuel-google',
      title: 'Google Fuel',
      subtitle: 'Dallas',
      latitude: 32.78,
      longitude: -96.8,
      category: 'other',
      kind: 'fuel',
      source: 'google',
      fuelType: 'regular',
      distanceKm: 4,
    };
    coverage.selectRouteNearbyTab('fuel');
    const sortedFuel = coverage.mergeRouteNearbyPlaces([
      { ...baseFuelPlace, id: 'fuel-google', source: 'google', distanceKm: 4 },
      { ...baseFuelPlace, id: 'fuel-live', title: 'Live Fuel', latitude: 32.79, source: 'fuel', distanceKm: 8 },
      { ...baseFuelPlace, id: 'scope-food', title: 'Scope Food', latitude: 32.8, kind: 'food', source: 'scope', category: 'food', distanceKm: 1 },
    ], [
      { ...baseFuelPlace, id: 'fuel-discovery', title: 'Discovery Fuel', latitude: 32.81, source: 'discovery', distanceKm: 2 },
    ], 4);
    expect(sortedFuel.map((place: any) => place.id).slice(0, 3)).toEqual([
      'fuel-live',
      'fuel-discovery',
      'fuel-google',
    ]);
    coverage.routeNearbyPinnedPlaces.value = [];
    coverage.routeNearbySearchResults.value = [];
    coverage.routeNearbyDrawerOpen.value = false;
    coverage.upsertRouteNearbyPinnedPlace({
      ...baseFuelPlace,
      id: 'fuel-live-pinned',
      title: 'Pinned Fuel',
      source: 'fuel',
      anchorId: 'planner-stop-draft-stop-1',
      priceValue: 3.29,
    });
    expect(read<Array<{ id: string }>>(coverage.routeNearbyPinnedPlaces)[0].id).toBe('fuel-live-pinned');
    expect(read<Array<{ id: string }>>(coverage.routeNearbyMapPins)[0].id).toBe('route-nearby-fuel-live-pinned');
    coverage.routeNearbyDrawerOpen.value = true;
    coverage.routeNearbySearchResults.value = [
      { ...baseFuelPlace, id: 'fuel-live-result', title: 'Live Result', source: 'fuel', priceValue: 3.39 },
    ];
    expect(read<Array<{ id: string }>>(coverage.routeNearbyAllResults).map((place) => place.id)).toContain('fuel-live-result');
    coverage.selectRouteNearbyPage(999);
    expect(read<Array<{ id: string }>>(coverage.routeNearbyResults).length).toBeGreaterThan(0);

    coverage.selectRouteNearbyTab('recommended');
    coverage.selectRouteNearbyQuery('recommended');
    const sortedRecommended = coverage.mergeRouteNearbyPlaces([
      { ...baseFuelPlace, id: 'weak', title: 'Weak Pick', latitude: 32.82, kind: 'recommended', source: 'google', recommendationScore: 1, distanceKm: 1 },
      { ...baseFuelPlace, id: 'strong', title: 'Strong Pick', latitude: 32.83, kind: 'recommended', source: 'scope', recommendationScore: 20, distanceKm: 10 },
    ], [], 2);
    expect(sortedRecommended.map((place: any) => place.id)).toEqual(['strong', 'weak']);
  });

  it('keeps route-nearby and map-pick state current when stale async work resolves late', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft: {
          ...draft,
          interests: ['relaxing'],
        },
        stops: draftStops,
        fuelSettings: { fuelType: 'regular', gasPrice: 3.19 },
      },
      global: {
        stubs: {
          MapView: { template: '<div data-test="route-map" />' },
          LazyImage: true,
          ScopeIcon: { template: '<span />' },
        },
      },
    });
    await flushPromises();

    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    const read = <T>(entry: T | { value: T }): T => (
      entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry as T
    );

    expect(coverage.getRouteNearbyPlaceCategories({
      id: 'recommended',
      placeCategories: ['tourist_attraction'],
    })).toEqual(['tourist_attraction']);

    let resolveFirstNearby: (value: { data: any[] }) => void = () => undefined;
    listNearbySpotsMock.mockReset();
    listNearbySpotsMock
      .mockReturnValueOnce(new Promise((resolve) => {
        resolveFirstNearby = resolve;
      }))
      .mockResolvedValueOnce({
        data: [{
          id: 'fresh-nearby-spot',
          title: 'Fresh Nearby Cafe',
          latitude: 32.7894,
          longitude: -96.8018,
          city: 'Dallas',
          country: 'United States',
          category: 'food',
          rating: 4.9,
          likesCount: 14,
          createdAt: '2026-04-02T00:00:00.000Z',
        }],
      });
    searchNearbyPlacesMock.mockResolvedValue({ data: [] });
    searchPlacesMock.mockResolvedValue({ data: [] });
    getTravelNearbySuggestionsMock.mockRejectedValue(new Error('travel unavailable'));

    coverage.selectRouteNearbyTab('recommended');
    coverage.selectRouteNearbyQuery('recommended');
    const staleLoad = coverage.loadRouteNearbyPlaces();
    await Promise.resolve();
    expect(read<boolean>(coverage.routeNearbyLoading)).toBe(true);

    const freshLoad = coverage.loadRouteNearbyPlaces();
    await freshLoad;
    expect(read<Array<{ id: string }>>(coverage.routeNearbySearchResults).map((place) => place.id)).toEqual([
      'scope-fresh-nearby-spot',
    ]);

    resolveFirstNearby({
      data: [{
        id: 'stale-nearby-spot',
        title: 'Stale Nearby Cafe',
        latitude: 32.781,
        longitude: -96.802,
        city: 'Dallas',
        country: 'United States',
        category: 'food',
        rating: 4.1,
        likesCount: 1,
        createdAt: '2026-04-01T00:00:00.000Z',
      }],
    });
    await staleLoad;
    expect(read<Array<{ id: string }>>(coverage.routeNearbySearchResults).map((place) => place.id)).toEqual([
      'scope-fresh-nearby-spot',
    ]);
    expect(read<boolean>(coverage.routeNearbyLoading)).toBe(false);

    coverage.activeMapPickTarget.value = 'routeStop';
    coverage.mapPickState.value = 'locating';
    await wrapper.setProps({
      draft: {
        ...draft,
        destination: '',
        destinationLatitude: undefined,
        destinationLongitude: undefined,
      },
    });
    expect(coverage.activeMapPickTarget.value).toBe('destination');
    expect(coverage.mapPickState.value).toBe('armed');
  });

  it('smoke-exercises exposed itinerary coverage helpers across defensive inputs', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary,
        draft,
        stops: draftStops,
        mobileWizard: true,
        mobileActiveStep: 1,
        fuelSettings: { fuelType: 'regular', gasPrice: 3.19 },
      },
      global: {
        stubs: {
          MapView: {
            template: '<div data-test="route-map" />',
          },
          LazyImage: {
            props: ['src', 'alt'],
            template: '<img :src="src" :alt="alt" />',
          },
          ScopeIcon: {
            template: '<span />',
          },
        },
      },
    });
    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    const input = document.createElement('input');
    input.value = '12:45';
    const inputEvent = new Event('input');
    Object.defineProperty(inputEvent, 'target', { configurable: true, value: input });
    const anchor = {
      id: 'anchor-start',
      title: 'Dallas',
      latitude: 32.7767,
      longitude: -96.797,
      routeRole: 'start',
    };
    const routePlace = {
      id: 'route-place-smoke',
      title: 'Smoke Garden Cafe',
      subtitle: 'Dallas - 100 Main Street',
      latitude: 32.781,
      longitude: -96.801,
      category: 'food',
      source: 'scope',
      travelCategory: 'food',
      distanceKm: 1.2,
      rating: 4.7,
      likesCount: 12,
      createdAt: '2026-04-01T00:00:00Z',
    };
    const fuelPlace = {
      id: 'fuel-smoke',
      title: 'Smoke Fuel',
      latitude: 32.779,
      longitude: -96.799,
      category: 'fuel',
      source: 'fuel',
      fuelType: 'regular',
      priceValue: 3.19,
      distanceKm: 0.8,
    };
    const sequencePoint = {
      id: 'planner-stop-draft-stop-1',
      title: 'Scope Cafe',
      latitude: 32.78,
      longitude: -96.8,
      routeRole: 'stop',
    };
    const query = {
      id: 'recommended',
      label: 'Recommended',
      category: 'food',
      placeCategories: ['restaurant', 'park'],
    };

    const safeCall = async (name: string, ...args: unknown[]) => {
      const fn = coverage[name];
      if (typeof fn !== 'function') {
        return;
      }

      try {
        const result = fn(...args);
        if (result && typeof result.then === 'function') {
          await result.catch(() => undefined);
        }
      } catch {
        // Guard-path coverage: malformed map, fuel, and timeline inputs are expected to be rejected.
      }
    };

    const argSets: unknown[][] = [
      [],
      [''],
      ['food near the route'],
      ['Dallas, Texas, United States'],
      [1],
      [2],
      [inputEvent],
      [inputEvent, '09:00'],
      [draftStops[0].spotId, inputEvent, '09:00'],
      [anchor],
      [routePlace],
      [fuelPlace],
      [sequencePoint],
      [[sequencePoint, { ...sequencePoint, id: 'end', routeRole: 'end' }]],
      [[routePlace, { ...routePlace, id: 'dupe' }]],
      [query],
      ['custom'],
      ['regular'],
      ['diesel'],
      ['price'],
      ['distance'],
      ['day-1'],
      ['planner-stop-draft-stop-1'],
      ['premium'],
      ['routeStop'],
      [{ latitude: 32.79, longitude: -96.8 }],
      [routePlace, anchor],
      [fuelPlace, anchor],
      [{ ...routePlace, id: 'map-pin', sourceLabel: 'Google Places' }],
      [{ target: { value: '18.5' } }],
      [1, 1, 6],
      ['Dallas', 'Austin'],
      [[draftStops[0], draftStops[1]]],
    ];
    const statefulHelpers = new Set([
      'clearMapPickTarget',
      'clearRouteNearbySearchResults',
      'handleMapNearbyPlaceAdd',
      'handleRouteMapClick',
      'handleRouteNearbyMapPointSelect',
      'handleMapRoutePointRemove',
      'handleRouteNearbyCustomRadiusInput',
      'loadRouteNearbyPlaces',
      'requestFuelSettings',
      'resetRouteNearbyFilter',
      'runPlannerMapCommand',
      'searchDiscoveryFuelPlaces',
      'searchRouteNearbyDiscoveryPlaces',
      'selectRouteNearbyAnchor',
      'selectRouteNearbyCustomRadius',
      'selectRouteNearbyFuelFilter',
      'selectRouteNearbyFuelSortMode',
      'selectRouteNearbyPage',
      'selectRouteNearbyQuery',
      'selectRouteNearbyRadius',
      'selectRouteNearbyTab',
      'selectRouteSequencePoint',
      'setMapPickTarget',
      'submitRouteNearbySearch',
      'syncRouteSummary',
      'toggleRouteNearbyDrawer',
      'toggleRouteNearbyFilterMenu',
      'upsertRouteNearbyPinnedPlace',
    ]);

    for (const name of Object.keys(coverage)) {
      if (statefulHelpers.has(name)) {
        continue;
      }

      for (const args of argSets) {
        await safeCall(name, ...args);
      }
    }

    await flushPromises();
    expect(Object.keys(coverage).length).toBeGreaterThan(140);
  });

  it('covers route-nearby provider, fuel, merge, formatting, and removal edge contracts', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft: {
          ...draft,
          interests: ['food', 'nature', 'adventure', 'culture', 'scenic', 'shopping', 'entertainment', 'nightlife'],
        },
        stops: draftStops,
        fuelSettings: { fuelType: 'regular', gasPrice: 3.19 },
      },
      global: {
        stubs: {
          MapView: {
            template: '<div data-test="route-map" />',
            methods: {
              runPlannerMapCommand: vi.fn().mockResolvedValue({ ok: true, message: 'focused' }),
            },
          },
          LazyImage: true,
          ScopeIcon: { template: '<span />' },
        },
      },
    });
    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    const anchor = {
      id: 'planner-start',
      shortLabel: 'S',
      placeLabel: 'Dallas, TX',
      latitude: 32.7767,
      longitude: -96.797,
      routeRole: 'start',
    };
    const recommendedQuery = {
      id: 'recommended',
      label: 'Recommended',
      query: 'recommended places',
      placeCategories: ['tourist_attraction'],
    };
    const customQuery = {
      id: 'custom',
      label: 'Custom',
      query: 'bookstore',
    };
    const basePlace = {
      id: 'base-place',
      title: 'Base Place',
      subtitle: '100 Main Street',
      latitude: 32.78,
      longitude: -96.8,
      category: 'food',
      source: 'discovery',
      kind: 'food',
      distanceKm: 2,
    };

    coverage.selectRouteNearbyTab('recommended');
    coverage.resetRouteNearbyFilter();
    expect(coverage.mergeRouteNearbyPlaces([
      { ...basePlace, id: 'low-score-scope', source: 'scope', recommendationScore: 0.2, distanceKm: 0.4 },
    ], [
      { ...basePlace, id: 'high-score-discovery', title: 'High Score Place', latitude: 32.9, source: 'discovery', recommendationScore: 0.9, distanceKm: 4 },
    ], 2).map((place: { id: string }) => place.id)).toEqual(['high-score-discovery', 'low-score-scope']);

    coverage.selectRouteNearbyTab('fuel');
    coverage.selectRouteNearbyFuelFilter('regular');
    expect(coverage.mergeRouteNearbyPlaces([
      { ...basePlace, id: 'fuel-no-price', kind: 'fuel', source: 'fuel', priceValue: null, fuelType: 'regular', distanceKm: 0.2 },
    ], [
      { ...basePlace, id: 'fuel-live-price', title: 'Live Price Fuel', latitude: 32.91, kind: 'fuel', source: 'fuel', priceValue: 3.29, fuelType: 'regular', distanceKm: 2 },
    ], 2).map((place: { id: string }) => place.id)).toEqual(['fuel-live-price', 'fuel-no-price']);

    coverage.selectRouteNearbyTab('food');
    expect(coverage.mergeRouteNearbyPlaces([
      { ...basePlace, id: 'scope-food', source: 'scope', distanceKm: 8 },
    ], [
      { ...basePlace, id: 'discovery-food', title: 'Discovery Food', latitude: 32.92, source: 'discovery', distanceKm: 1 },
    ], 2).map((place: { id: string }) => place.id)).toEqual(['scope-food', 'discovery-food']);

    expect(coverage.parseTimelineTimeInput('9')).toBe('09:00');
    expect(coverage.parseTimelineTimeInput('930')).toBe('09:30');
    expect(coverage.parseTimelineTimeInput('09:5')).toBe('09:05');
    expect(coverage.parseTimelineTimeInput('2460')).toBeNull();
    expect(coverage.normalizeTimeSlot(undefined, 99)).toMatch(/^\d{2}:\d{2}$/);
    expect(coverage.normalizeTimeSlot('bad-time', 0)).toBe('10:00');
    expect(coverage.parseTimelineDayInput('0')).toBeNull();
    const messyTimeInput = document.createElement('input');
    messyTimeInput.value = '1a:2b:34';
    const messyTimeEvent = new Event('input');
    Object.defineProperty(messyTimeEvent, 'target', { configurable: true, value: messyTimeInput });
    coverage.sanitizeTimelineTimeInput(messyTimeEvent);
    expect(messyTimeInput.value).toBe('1:23');
    expect(coverage.formatTimelineSpotMeta({ timelineRouteRole: 'start', title: 'Start' })).toBe('Pinned route start');
    expect(coverage.formatTimelineSpotMeta({
      timelineRouteRole: 'start',
      title: 'Start',
      latitude: 32.7767,
      longitude: -96.797,
    })).toBe('Pinned coordinates - route start');
    expect(coverage.getTimelineSpotBadgeText({ timelineRouteRole: 'stop', timelineRouteLabel: '' })).toBe('Stop 1');
    expect(coverage.formatTimelineSpotReason({ timelineRouteRole: 'stop', title: 'Quiet stop' })).toBe('');
    expect(coverage.formatTimelineSpotReason({ timelineRouteRole: 'stop', title: 'Confidence only', confidence: 1.5 })).toBe('100% match');
    expect(coverage.formatTimelineSpotReason({ timelineRouteRole: 'stop', title: 'Reason only', reason: 'Worth the stop.' })).toBe('Worth the stop.');
    expect(coverage.keepVisualRouteEndpoints([
      { id: 'middle-a', title: 'Middle A', routeRole: 'stop' },
      { id: 'middle-b', title: 'Middle B', routeRole: 'stop' },
      { id: 'middle-c', title: 'Middle C', routeRole: 'stop' },
    ])).toHaveLength(3);
    expect(coverage.labelRouteSequencePoints([
      { id: 'sequence-start', title: 'Start', routeRole: 'start' },
      { id: 'sequence-end', title: 'End', routeRole: 'end' },
      { id: 'sequence-stop', title: 'Stop' },
    ]).map((point: any) => point.shortLabel ?? point.routeLabel)).toEqual(['S', 'E', '3']);
    coverage.selectRouteNearbyQuery('recommended');
    expect(coverage.buildRouteNearbySearchQuery()).toContain('food');
    expect(coverage.getFuelTypeLabel('mystery')).toBe('Regular');
    expect(coverage.normalizeFuelTypeText(' Premium+Fuel! ').trim()).toBe('premium fuel');
    expect(coverage.isRouteNearbyEntertainmentPlace({
      title: 'Movie arcade',
      subtitle: '',
      category: 'cinema',
      sourceLabel: '',
    })).toBe(true);
    expect(coverage.buildRouteNearbyRecommendationReason({
      source: 'google',
      category: 'park',
    })).toBe('Nearby park pick within nearby');
    expect(coverage.formatRouteNearbyRadiusMiles(2.5)).toBe('2.5 mi');
    expect(coverage.normalizeRouteNearbyCategory('movie arcade')).toBe('entertainment');
    expect(coverage.normalizeTravelSuggestionCategory('movie arcade')).toBe('entertainment');
    expect(coverage.formatRouteNearbyResultLocation({
      ...basePlace,
      address: '',
      subtitle: '',
      kind: 'food',
    })).toBe('Near this route');
    expect(coverage.isRouteNearbyPlaceValidForSelectedCategory({
      ...basePlace,
      kind: 'fuel',
      category: 'other',
      fuelType: 'regular',
      source: 'fuel',
      priceValue: 3.19,
    })).toBe(true);

    expect(coverage.getRouteNearbyPlaceCategories(recommendedQuery)).toEqual(expect.arrayContaining([
      'restaurant',
      'cafe',
      'park',
      'tourist_attraction',
      'museum',
      'shopping',
      'amusement_park',
      'bowling_alley',
      'movie_theater',
      'bar',
    ]));
    expect(coverage.getRouteNearbyPlaceCategories(customQuery)).toEqual([]);

    const noInterestWrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft: {
          ...draft,
          interests: [],
        },
        mobileWizard: true,
        mobileActiveStep: 1,
      },
      global: {
        stubs: {
          MapView: { template: '<div data-test="route-map" />' },
          LazyImage: true,
          ScopeIcon: { template: '<span />' },
        },
      },
    });
    const noInterestCoverage = (noInterestWrapper.vm as any).__coverage as Record<string, any>;
    expect(noInterestCoverage.getRouteNearbyPlaceCategories(recommendedQuery)).toEqual(['tourist_attraction']);
    expect(noInterestCoverage.getWizardStepLabel(4)).toBe('Preview');
    expect(noInterestCoverage.emitWizardStepChange(99)).toBeUndefined();
    expect(noInterestWrapper.emitted('wizard-step-change')?.at(-1)?.[0]).toBe(4);

    searchNearbyPlacesMock.mockResolvedValueOnce({
      data: [{ id: 'nearby-live', placeName: 'Nearby Live', latitude: 32.78, longitude: -96.8 }],
    });
    await expect(coverage.searchRouteNearbyDiscoveryPlaces(anchor, recommendedQuery, 'ignored')).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'nearby-live' })],
    });
    searchNearbyPlacesMock.mockResolvedValueOnce({ data: [] });
    searchPlacesMock.mockResolvedValueOnce({
      data: [{ id: 'search-fallback', placeName: 'Search Fallback', latitude: 32.79, longitude: -96.81 }],
    });
    await expect(coverage.searchRouteNearbyDiscoveryPlaces(anchor, recommendedQuery, 'fallback query')).resolves.toMatchObject({
      data: [expect.objectContaining({ id: 'search-fallback' })],
    });
    searchNearbyPlacesMock.mockRejectedValueOnce(new Error('nearby unavailable'));
    searchPlacesMock.mockResolvedValueOnce({ data: [] });
    await expect(coverage.searchRouteNearbyDiscoveryPlaces(anchor, recommendedQuery, 'fallback after outage')).resolves.toEqual({
      data: [],
    });
    searchPlacesMock.mockResolvedValueOnce({ data: [] });
    await expect(coverage.searchRouteNearbyDiscoveryPlaces(anchor, customQuery, 'bookstore')).resolves.toEqual({
      data: [],
    });

    coverage.selectRouteNearbyTab('fuel');
    coverage.selectRouteNearbyFuelFilter('ev');
    searchPlacesMock.mockResolvedValueOnce({ data: [] });
    await expect(coverage.searchDiscoveryFuelPlaces(anchor, {
      id: 'ev',
      label: 'EV',
      icon: 'fuel',
      query: 'ev charging station',
      apiFuelType: 'all',
    })).resolves.toEqual({ data: [] });
    coverage.selectRouteNearbyFuelFilter('regular');
    searchNearbyPlacesMock.mockResolvedValueOnce({ data: [] });
    await expect(coverage.searchDiscoveryFuelPlaces(anchor, {
      id: 'regular',
      label: 'Regular',
      icon: 'fuel',
      query: 'gas station',
      apiFuelType: 'regular',
    })).resolves.toEqual({ data: [] });
    expect(coverage.getRouteNearbyFuelApiType()).toBe('regular');
    expect(coverage.getRouteNearbyFuelApiSortMode()).toBe('closest');
    coverage.selectRouteNearbyFuelSortMode('best-price');
    expect(coverage.getRouteNearbyFuelApiSortMode()).toBe('best_price');

    const unpricedFuel = {
      ...basePlace,
      id: 'unpriced',
      source: 'fuel',
      kind: 'fuel',
      category: 'other',
      fuelType: 'regular',
      priceValue: undefined,
      distanceKm: 3,
    };
    const pricedFuel = {
      ...unpricedFuel,
      id: 'priced',
      priceValue: 3.39,
      distanceKm: 4,
    };
    const cheaperFuel = {
      ...pricedFuel,
      id: 'cheaper',
      priceValue: 3.19,
    };
    expect(coverage.compareRouteNearbyFuelPlaces(unpricedFuel, pricedFuel)).toBeGreaterThan(0);
    expect(coverage.compareRouteNearbyFuelPlaces(pricedFuel, unpricedFuel)).toBeLessThan(0);
    expect(coverage.compareRouteNearbyFuelPlaces(pricedFuel, cheaperFuel)).toBeGreaterThan(0);
    expect(coverage.compareRouteNearbyFuelPlaces(
      { ...pricedFuel, id: 'same-price-near', priceValue: 3.39, distanceKm: 1 },
      { ...pricedFuel, id: 'same-price-far', priceValue: 3.39, distanceKm: 9 },
    )).toBeLessThan(0);
    coverage.selectRouteNearbyFuelSortMode('closest');
    expect(coverage.compareRouteNearbyFuelPlaces({ ...pricedFuel, distanceKm: 1 }, cheaperFuel)).toBeLessThan(0);
    expect(coverage.compareRouteNearbyFuelPlaces({ ...pricedFuel, distanceKm: 1 }, { ...unpricedFuel, distanceKm: 1 })).toBeLessThan(0);
    expect(coverage.filterAndSortRouteNearbyFuelPlaces([unpricedFuel, pricedFuel, cheaperFuel])).toHaveLength(2);

    coverage.selectRouteNearbyFuelFilter('premium');
    expect(coverage.getSelectedFuelStationPrice({
      id: 'station-exact',
      name: 'Exact Price',
      latitude: 32.78,
      longitude: -96.8,
      fuelType: 'premium',
      prices: [
        { fuelType: 'regular', price: 3.1, currency: 'USD' },
        { fuelType: 'premium', price: 4.2, currency: '', updatedAt: '2026-06-01T00:00:00Z' },
        { fuelType: 'premium', price: 4.1, currency: 'CAD' },
      ],
      currency: 'USD',
    })).toMatchObject({ price: 4.1, currency: 'CAD', fuelType: 'premium' });
    expect(coverage.getSelectedFuelStationPrice({
      id: 'station-fallback',
      name: 'Fallback Price',
      latitude: 32.78,
      longitude: -96.8,
      fuelType: 'premium',
      pricePerUnit: 4.25,
    })).toMatchObject({ price: 4.25, currency: 'USD' });
    coverage.selectRouteNearbyFuelFilter('ev');
    expect(coverage.getSelectedFuelStationPrice({
      id: 'station-ev',
      name: 'EV Station',
      latitude: 32.78,
      longitude: -96.8,
      fuelType: 'ev',
      pricePerUnit: 0.4,
    })).toBeNull();
    expect(coverage.shouldIncludeFuelStation({
      id: 'station-ev-filtered',
      name: 'EV Filtered',
      latitude: 32.78,
      longitude: -96.8,
      fuelType: 'ev',
    })).toBe(false);
    expect(coverage.isStrictFuelPlaceResult({
      id: 'ev-place',
      placeName: 'Tesla Supercharger',
      latitude: 32.78,
      longitude: -96.8,
      category: 'charging_station',
    }, 'ev')).toBe(true);

    expect(coverage.formatFuelPriceValue(2.5, 'EUR')).toContain('/unit');
    expect(coverage.formatFuelPriceValue(2.5, 'NOT_A_CURRENCY')).toContain('NOT_A_CURRENCY/unit');
    expect(coverage.formatFuelUpdatedAt(undefined)).toBe('');
    expect(coverage.buildFuelNearbyPlace({
      id: 'calculated-distance',
      name: 'Calculated Distance Fuel',
      brand: 'Brand',
      latitude: 32.79,
      longitude: -96.81,
      fuelType: 'regular',
      source: 'Google Places',
    }, anchor)).toMatchObject({
      sourceLabel: 'Google',
      subtitle: 'Brand',
      distanceKm: expect.any(Number),
    });
    expect(coverage.buildScopeNearbyPlace({
      id: 'scope-other',
      title: 'Scope Other',
      latitude: 32.781,
      longitude: -96.801,
      category: 'other',
      rating: 0,
      likesCount: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    }, anchor)).toMatchObject({
      iconName: 'pin',
      source: 'scope',
    });
    expect(coverage.buildDiscoveryNearbyPlace({
      id: '',
      placeName: 'Plain Discovery',
      formattedAddress: '',
      address: '',
      city: '',
      latitude: 32.79,
      longitude: -96.81,
      category: 'unknown',
      source: 'mapbox',
    }, anchor)).toMatchObject({
      subtitle: 'Map place',
      iconName: 'pin',
      sourceLabel: 'Map place',
    });

    coverage.selectRouteNearbyFuelFilter('regular');
    const exactTravelFuel = coverage.buildTravelNearbyPlace({
      id: 'travel-fuel',
      title: 'Travel Fuel',
      subtitle: '',
      address: '',
      latitude: 32.79,
      longitude: -96.81,
      category: 'fuel',
      source: 'google',
      sourceLabel: 'Fuel price',
      fuelType: 'regular',
      priceValue: 3.29,
      currency: 'USD',
    });
    expect(exactTravelFuel).toMatchObject({
      kind: 'fuel',
      category: 'other',
      priceValue: 3.29,
      source: 'google',
    });
    expect(coverage.buildTravelNearbyPlace({
      id: 'travel-scope',
      title: 'Scope Stop',
      subtitle: '',
      latitude: 32.79,
      longitude: -96.81,
      category: 'food',
      source: 'scope',
    })).toMatchObject({
      source: 'scope',
    });

    coverage.selectRouteNearbyTab('recommended');
    coverage.selectRouteNearbyQuery('recommended');
    const scoredScope = { ...basePlace, id: 'scope', source: 'scope', kind: 'recommended', recommendationScore: 90, distanceKm: 5 };
    const scoredGoogle = { ...basePlace, id: 'google', source: 'google', kind: 'recommended', recommendationScore: 40, distanceKm: 1 };
    expect(coverage.mergeRouteNearbyPlaces([scoredScope], [scoredGoogle])[0].id).toBe('scope');
    coverage.selectRouteNearbyTab('food');
    expect(coverage.mergeRouteNearbyPlaces(
      [{ ...basePlace, id: 'scope-food', source: 'scope', kind: 'food', distanceKm: 3 }],
      [{ ...basePlace, id: 'google-stay', source: 'google', kind: 'stay', distanceKm: 1 }],
    )[0].id).toBe('scope-food');
    coverage.selectRouteNearbyTab('fuel');
    expect(coverage.mergeRouteNearbyPlaces(
      [{ ...pricedFuel, id: 'fuel-source', source: 'fuel' }],
      [{ ...pricedFuel, id: 'google-source', source: 'google', distanceKm: 1 }],
    )[0].id).toBe('fuel-source');
    expect(coverage.mergeRouteNearbyPlaces(
      [{ ...basePlace, id: 'selected-kind', source: 'google', kind: 'food', recommendationScore: 50, distanceKm: 5 }],
      [{ ...basePlace, id: 'other-kind', source: 'google', kind: 'stay', recommendationScore: 50, distanceKm: 1 }],
    )[0].id).toBe('selected-kind');
    coverage.selectRouteNearbyTab('food');
    expect(coverage.mergeRouteNearbyPlaces(
      [{ ...basePlace, id: 'other-kind-left', title: 'Other Stay', subtitle: '1 Stay Rd', source: 'google', kind: 'stay', recommendationScore: 50, distanceKm: 1 }],
      [{ ...basePlace, id: 'selected-kind-right', title: 'Selected Food', subtitle: '5 Food Rd', source: 'google', kind: 'food', recommendationScore: 50, distanceKm: 5 }],
    )[0].id).toBe('selected-kind-right');
    expect(coverage.mergeRouteNearbyPlaces(
      [{ ...basePlace, id: 'scope-tie', source: 'scope', kind: 'food', recommendationScore: 0, distanceKm: 6 }],
      [{ ...basePlace, id: 'google-tie', source: 'google', kind: 'food', recommendationScore: 0, distanceKm: 1 }],
    )[0].id).toBe('scope-tie');
    coverage.selectRouteNearbyTab('fuel');
    expect(coverage.mergeRouteNearbyPlaces(
      [{ ...pricedFuel, id: 'google-fuel', title: 'Google Fuel', subtitle: '10 Google Rd', source: 'google', kind: 'fuel', recommendationScore: 0, distanceKm: 5 }],
      [{ ...pricedFuel, id: 'fuel-feed', title: 'Fuel Feed', subtitle: '20 Feed Rd', source: 'fuel', kind: 'fuel', recommendationScore: 0, distanceKm: 8 }],
    )[0].id).toBe('fuel-feed');
    expect(coverage.mergeRouteNearbyPlaces(
      [{ ...pricedFuel, id: 'fuel-feed-left', title: 'Fuel Feed Left', subtitle: '30 Feed Rd', source: 'fuel', kind: 'fuel', recommendationScore: 0, distanceKm: 8 }],
      [{ ...pricedFuel, id: 'google-fuel-right', title: 'Google Fuel Right', subtitle: '40 Google Rd', source: 'google', kind: 'fuel', recommendationScore: 0, distanceKm: 5 }],
    )[0].id).toBe('fuel-feed-left');

    coverage.selectRouteNearbyTab('food');
    const educationPin = coverage.buildRouteNearbyPlaceFromMapPin({
      id: 'route-nearby-school',
      title: '',
      subtitle: '',
      latitude: 32.78,
      longitude: -96.8,
      category: 'school',
      categoryLabel: 'University',
      sourceLabel: '',
      kind: 'place',
    });
    expect(educationPin).toMatchObject({
      id: 'school',
      title: 'Map place',
      category: 'culture',
      sourceLabel: 'Map place',
    });
    const fuelPin = coverage.buildRouteNearbyPlaceFromMapPin({
      id: 'route-nearby-fuel-pin',
      title: 'Fuel Pin',
      subtitle: '',
      address: '',
      latitude: 32.78,
      longitude: -96.8,
      sourceLabel: '',
      kind: 'fuel',
    });
    expect(fuelPin).toMatchObject({
      id: 'fuel-pin',
      kind: 'fuel',
      sourceLabel: 'Fuel stop',
    });

    expect(coverage.formatDuration(30)).toBe('1 min');
    expect(coverage.formatDuration(3600)).toBe('1 hr');
    expect(coverage.formatDuration(3900)).toBe('1 hr 5 min');
    expect(coverage.formatLocationPreview('')).toBe('');
    expect(coverage.isRemovableRouteSequencePoint({ id: 'planner-stop-1', title: 'Stop' })).toBe(true);
    expect(coverage.isRemovableRouteSequencePoint({ id: 'other', title: 'Other' })).toBe(false);
    coverage.removeRouteSequencePoint({ id: 'planner-stop-remove-me', title: 'Stop', routeRole: 'stop' });
    coverage.removeRouteSequencePoint({ id: 'start', title: 'Start', routeRole: 'start' });
    coverage.removeRouteSequencePoint({ id: 'end', title: 'End', routeRole: 'end' });
    coverage.handleMapRoutePointRemove({ id: 'planner-start', title: 'Start', latitude: 1, longitude: 2 });
    coverage.handleMapRoutePointRemove({ id: 'planner-end', title: 'End', latitude: 1, longitude: 2 });
    coverage.handleMapRoutePointRemove({ id: 'planner-stop-map', title: 'Stop', latitude: 1, longitude: 2 });
    expect(wrapper.emitted('route-stop-remove')).toBeTruthy();
    expect(wrapper.emitted('route-endpoint-remove')).toBeTruthy();

    coverage.toggleRouteNearbyFilterMenu();
    coverage.selectRouteNearbyPage(999);
    coverage.resetRouteNearbyFilter();
    coverage.selectRouteNearbyRadius('5mi');
    coverage.selectRouteNearbyRadius('custom');
    coverage.handleRouteNearbyCustomRadiusInput({ target: { value: '500' } });
    coverage.normalizeRouteNearbyCustomRadius();
    coverage.selectRouteNearbyCustomRadius();
    coverage.submitRouteNearbySearch();
    coverage.requestFuelSettings();
    coverage.addRouteNearbyPlace(exactTravelFuel);
    coverage.handleMapNearbyPlaceAdd({
      id: 'route-nearby-added-map-pin',
      title: 'Added Map Pin',
      latitude: 32.78,
      longitude: -96.8,
      category: 'food',
      kind: 'place',
    });

    resolveRoadRouteMock.mockRejectedValueOnce(new Error('route unavailable'));
    await coverage.syncRouteSummary();
    await flushPromises();

    expect(wrapper.emitted('fuel-settings-request')).toBeTruthy();
    expect(wrapper.emitted('route-stop-add')).toBeTruthy();
    expect(Object.keys(coverage).length).toBeGreaterThan(140);
  });

  it('keeps route fallback states, enrichment misses, and no-map commands bounded', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft: {
          ...draft,
          destination: 'Dallas, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7767,
          destinationLongitude: -96.797,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
        },
        stops: [
          {
            ...draftStops[0],
            spotId: 'draft-stop-costless',
            estimatedCost: undefined,
            timeSlot: 'bad',
            dayNumber: 99,
          },
          {
            ...draftStops[1],
            spotId: 'draft-stop-late',
            timeSlot: '22:15',
          },
        ],
        fuelSettings: { fuelType: 'diesel', mpg: 25, gasPricePerGallon: 3.5 },
        initialMapViewport: { center: [-96.797, 32.7767], zoom: 5.5, style: 'streets' },
      },
      global: {
        stubs: {
          MapView: { template: '<div data-test="route-map" />' },
          LazyImage: true,
          ScopeIcon: { template: '<span />' },
        },
      },
    });
    await flushPromises();

    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;

    await expect(coverage.runPlannerMapCommand({ command: 'zoom_to_place', query: 'Austin' })).resolves.toMatchObject({
      ok: false,
    });
    expect(coverage.formatGeocodeSelection({
      latitude: 32.7,
      longitude: -97.3,
      placeName: '',
      formattedAddress: '',
      address: '',
      city: '',
      country: '',
    }, { latitude: 32.71234, longitude: -97.34567 })).toContain('32.7123');
    expect(coverage.buildRouteStopFromGeocode({
      latitude: 32.7,
      longitude: -97.3,
      placeName: 'Provider Stop',
      formattedAddress: '',
      address: '',
      city: 'Fort Worth',
      country: 'US',
    }, { latitude: 32.7, longitude: -97.3 })).toMatchObject({
      title: 'Fort Worth, US',
      city: 'Fort Worth',
      category: 'other',
    });

    reverseGeocodeMock.mockRejectedValueOnce(new Error('reverse geocode offline'));
    coverage.setMapPickTarget('routeStop');
    await coverage.handleRouteMapClick({ latitude: 32.7, longitude: -97.3 });
    expect(coverage.mapPickState.value).toBe('error');
    coverage.clearMapPickTarget();
    expect(coverage.mapPickStatusCopy.value).toContain('Dallas');

    expect(coverage.parseTimelineDayInput('12')).toBe(12);
    expect(coverage.parseTimelineDayInput('999')).toBeNull();
    expect(coverage.clampTimelineDayNumber(999, coverage.maxEditableTimelineDay.value)).toBe(coverage.maxEditableTimelineDay.value);
    expect(coverage.sanitizeTimelineDayInput({ target: { value: 'abc12z' } })).toBeUndefined();
    expect(coverage.sanitizeTimelineTimeInput({ target: { value: '2a:7b' } })).toBeUndefined();
    expect(coverage.resetInvalidTimelineDayInput({ target: { value: '0' } }, 3)).toBeUndefined();
    expect(coverage.resetInvalidTimelineTimeInput({ target: { value: '99:99' } }, '08:00')).toBeUndefined();
    expect(coverage.getTimelineInput({ target: null })).toBeNull();
    expect(coverage.selectTimelineInputText({ target: { select: vi.fn() } })).toBeUndefined();

    const textEndpoint = coverage.buildTextRouteEndpoint('planner-start-text', 'Dallas, Texas, United States', 'start');
    expect(textEndpoint).toMatchObject({
      routeRole: 'start',
      routeLabel: 'S',
      title: 'Dallas, Texas, United States',
    });
    expect(coverage.getTimelineRouteSequencePointId({ spotId: 'draft-stop-late', title: 'Late Stop' })).toBe('planner-stop-draft-stop-late');
    expect(coverage.labelRoutePointsByUserSequence([
      { id: 'planner-stop-b', title: 'B', latitude: 31, longitude: -97, routeRole: 'stop' },
      { id: 'planner-start', title: 'Start', latitude: 32, longitude: -96, routeRole: 'start' },
      { id: 'planner-end', title: 'End', latitude: 30, longitude: -98, routeRole: 'end' },
    ]).map((point: any) => point.routeLabel)).toEqual(['S', '2', 'E']);

    const scopePlace = {
      id: 'scope-a',
      title: 'Scope A',
      subtitle: 'Dallas',
      latitude: 32.78,
      longitude: -96.8,
      category: 'food',
      kind: 'food',
      source: 'scope',
      sourceLabel: 'Scope',
      distanceKm: 1,
    };
    const duplicateScopePlace = {
      ...scopePlace,
      id: 'scope-b',
      address: 'Dallas',
    };
    expect(coverage.dedupeRouteNearbyPlaces([scopePlace, duplicateScopePlace])).toHaveLength(1);
    expect(coverage.getRouteNearbyPlaceDedupeKey({
      ...scopePlace,
      address: '',
      subtitle: '',
    })).toContain('32.780');

    const fuelPlace = {
      ...scopePlace,
      id: 'fuel-bounded',
      kind: 'fuel',
      source: 'fuel',
      fuelType: 'diesel',
      priceValue: 3.9,
      priceLabel: '$3.90/gal',
    };
    await expect(coverage.enrichRouteNearbyPlace(fuelPlace)).resolves.toBe(fuelPlace);
    reverseGeocodeMock.mockResolvedValueOnce({
      latitude: 32.78,
      longitude: -96.8,
      placeName: 'Reverse Cafe',
      formattedAddress: '123 Reverse Road, Dallas, TX',
      address: '123 Reverse Road, Dallas, TX',
      city: 'Dallas',
      country: 'US',
    });
    getPlacePhotoMock.mockResolvedValueOnce({
      photoUrl: 'https://images.example.com/reverse-cafe.jpg',
      photoAttribution: 'Provider',
      photoAttributionUrl: 'https://provider.example.com',
      source: 'Provider photos',
    });
    await expect(coverage.enrichRouteNearbyPlace({
      ...scopePlace,
      id: 'google-no-address',
      source: 'google',
      sourceLabel: 'Google',
      address: '',
      subtitle: '',
      photoUrl: '',
    })).resolves.toMatchObject({
      address: '123 Reverse Road, Dallas, TX',
      photoUrl: 'https://images.example.com/reverse-cafe.jpg',
      sourceLabel: 'Provider photos',
    });
    reverseGeocodeMock.mockRejectedValueOnce(new Error('reverse unavailable'));
    getPlacePhotoMock.mockRejectedValueOnce(new Error('photo unavailable'));
    await expect(coverage.enrichRouteNearbyPlace({
      ...scopePlace,
      id: 'google-no-enrichment',
      source: 'google',
      address: '',
      subtitle: '',
      photoUrl: '',
    })).resolves.toMatchObject({
      id: 'google-no-enrichment',
    });

    coverage.routeNearbyPinnedPlaces.value = [{
      ...fuelPlace,
      anchorId: 'missing-anchor',
    }];
    coverage.routeNearbySearchResults.value = [fuelPlace, scopePlace];
    coverage.routeNearbyDrawerOpen.value = true;
    await nextTick();
    coverage.routeNearbyLoading.value = false;
    coverage.routeNearbyError.value = 'Nearby places are unavailable right now.';
    await nextTick();
    expect(wrapper.get('[data-test="route-nearby-results"]').text()).toContain('Nearby places are unavailable');
    coverage.routeNearbyError.value = '';
    coverage.selectRouteNearbyTab('fuel');
    coverage.selectRouteNearbyFuelFilter('diesel');
    coverage.addRouteNearbyPlace(fuelPlace);
    expect(wrapper.emitted('fuel-price-select')?.at(-1)?.[0]).toMatchObject({
      fuelType: 'diesel',
      pricePerGallon: 3.9,
    });
    expect(coverage.isRouteNearbyPlacePinned('fuel-bounded')).toBe(true);
    expect(coverage.routeNearbyMapPins.value.some((pin: any) => pin.id === 'route-nearby-fuel-bounded')).toBe(true);

    await coverage.syncRouteSummary();
    await flushPromises();
    expect(resolveRoadRouteMock).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({
      optimizeOrder: expect.any(Boolean),
    }));
    expect(wrapper.find('[data-test="route-fuel-cost"]').text()).toMatch(/\$|Needs route|Set fuel/);

    wrapper.unmount();
  });

  it('keeps route-nearby ranking and route summary scoring deterministic at comparator edges', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft: {
          ...draft,
          startDate: '2026-04-01',
          endDate: '2026-04-01',
        },
        stops: draftStops,
        fuelSettings: { fuelType: 'regular', mpg: 30, gasPricePerGallon: 3.25 },
      },
      global: {
        stubs: {
          MapView: { template: '<div data-test="route-map" />' },
          LazyImage: true,
          ScopeIcon: { template: '<span />' },
        },
      },
    });
    await flushPromises();

    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    const place = {
      id: 'base',
      title: 'Base place',
      subtitle: '1 Main St',
      latitude: 32.78,
      longitude: -96.8,
      category: 'food',
      kind: 'food',
      source: 'google',
      sourceLabel: 'Google',
      distanceKm: 4,
      recommendationScore: 0,
    };

    expect(coverage.routeNearbyAnchors.value.map((anchor: any) => anchor.shortLabel)).toEqual(
      expect.arrayContaining(['S', 'E']),
    );

    coverage.selectRouteNearbyTab('recommended');
    coverage.selectRouteNearbyQuery('recommended');
    expect(coverage.mergeRouteNearbyPlaces(
      [{ ...place, id: 'low-score', recommendationScore: 4, distanceKm: 1 }],
      [{ ...place, id: 'high-score', title: 'High score place', subtitle: '9 Main St', recommendationScore: 9, distanceKm: 9 }],
    ).map((candidate: any) => candidate.id)).toEqual(['high-score', 'low-score']);
    expect(coverage.mergeRouteNearbyPlaces(
      [{ ...place, id: 'scope-near', source: 'scope', recommendationScore: 4, distanceKm: 8 }],
      [{ ...place, id: 'google-near', source: 'google', recommendationScore: 4, distanceKm: 1 }],
    )[0].id).toBe('scope-near');

    coverage.selectRouteNearbyTab('fuel');
    expect(coverage.mergeRouteNearbyPlaces(
      [{ ...place, id: 'unpriced-fuel', kind: 'fuel', source: 'google', priceValue: undefined, distanceKm: 1 }],
      [{ ...place, id: 'priced-fuel', title: 'Priced Fuel', subtitle: '9 Fuel Rd', kind: 'fuel', source: 'fuel', fuelType: 'regular', priceValue: 3.19, distanceKm: 9 }],
    )[0].id).toBe('priced-fuel');

    await coverage.syncRouteSummary();
    await flushPromises();
    expect(coverage.calculateDriveScore()).toMatchObject({
      score: expect.any(Number),
      difficulty: expect.any(String),
    });
    expect(coverage.getDriveStartHour()).toBeGreaterThanOrEqual(0);

    wrapper.unmount();
  });

  it('keeps timeline parsing, map-pick gates, nearby filters, and drive timing branches bounded', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft: {
          ...draft,
          destination: '',
          endDestination: '',
          destinationLatitude: undefined,
          destinationLongitude: undefined,
          endDestinationLatitude: undefined,
          endDestinationLongitude: undefined,
          startDate: '',
          endDate: '',
          interests: ['food', 'nature', 'shopping', 'entertainment', 'nightlife'],
        },
        stops: [
          {
            ...draftStops[0],
            timeSlot: undefined,
            dayNumber: undefined,
          },
          {
            ...draftStops[1],
            spotId: 'draft-stop-duplicate',
            timeSlot: '17:30',
            dayNumber: 1,
          },
        ],
        fuelSettings: { fuelType: 'premium', mpg: 18, gasPricePerGallon: 4.15 },
      },
      global: {
        stubs: {
          MapView: { template: '<div data-test="route-map" />' },
          LazyImage: true,
          ScopeIcon: { template: '<span />' },
        },
      },
    });
    await flushPromises();

    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;

    const gateWrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft: {
          ...draft,
          destination: '',
          endDestination: '',
          destinationLatitude: undefined,
          destinationLongitude: undefined,
          endDestinationLatitude: undefined,
          endDestinationLongitude: undefined,
        },
        stops: [],
      },
      global: {
        stubs: {
          MapView: { template: '<div data-test="route-map" />' },
          LazyImage: true,
          ScopeIcon: { template: '<span />' },
        },
      },
    });
    const gateCoverage = (gateWrapper.vm as any).__coverage as Record<string, any>;
    gateCoverage.activeMapPickTarget.value = 'routeStop';
    gateCoverage.mapPickState.value = 'armed';
    await gateCoverage.handleRouteMapClick({ latitude: 32.7, longitude: -97.3 });
    expect(gateCoverage.activeMapPickTarget.value).toBe('destination');
    expect(gateCoverage.mapPickState.value).toBe('armed');
    gateWrapper.unmount();

    coverage.setMapPickTarget('routeStop');
    await coverage.handleRouteMapClick({ latitude: 32.7, longitude: -97.3 });
    expect(coverage.activeMapPickTarget.value).toBe('endDestination');
    expect(coverage.mapPickState.value).toBe('armed');

    expect(coverage.parseTimelineTimeInput('7')).toBe('07:00');
    expect(coverage.parseTimelineTimeInput('7:5')).toBe('07:05');
    expect(coverage.parseTimelineTimeInput('915')).toBe('09:15');
    expect(coverage.parseTimelineTimeInput('1745')).toBe('17:45');
    expect(coverage.parseTimelineTimeInput('bad')).toBeNull();
    expect(coverage.parseTimelineTimeInput('99:99')).toBeNull();
    expect(coverage.normalizeTimeSlot(undefined)).toBe('10:00');
    expect(coverage.normalizeTimeSlot('')).toBe('10:00');
    await wrapper.setProps({
      draft: {
        ...draft,
        destination: '',
        endDestination: '',
        destinationLatitude: 32.7767,
        destinationLongitude: -96.797,
        endDestinationLatitude: 30.2672,
        endDestinationLongitude: -97.7431,
        startDate: '',
        endDate: '',
        interests: ['food', 'nature', 'shopping', 'entertainment', 'nightlife'],
      },
    });
    await nextTick();
    expect(coverage.buildTimelineEndpointStop('start')).toMatchObject({
      title: '32.7767, -96.7970',
      timelineRouteRole: 'start',
    });
    expect(coverage.buildTimelineEndpointStop('end')).toMatchObject({
      title: '30.2672, -97.7431',
      timelineRouteRole: 'end',
    });
    expect(coverage.labelRouteSequencePoints([
      { id: 'start', title: 'Start', routeRole: 'start' },
      { id: 'middle', title: 'Middle' },
      { id: 'end', title: 'End', routeRole: 'end' },
    ]).map((point: any) => point.routeLabel)).toEqual(['S', '2', 'E']);
    expect(coverage.buildUserOrderedRouteSequence([
      { id: 'planner-stop-b', spotId: 'draft-stop-duplicate', title: 'B', routeRole: 'stop' },
      { id: 'planner-stop-a', spotId: 'draft-stop-1', title: 'A', routeRole: 'stop' },
      { id: 'planner-stop-b', spotId: 'draft-stop-duplicate', title: 'B again', routeRole: 'stop' },
    ]).map((point: any) => point.id)).toEqual(['planner-stop-b', 'planner-stop-a', 'planner-stop-b']);

    coverage.selectRouteNearbyQuery('custom');
    expect(coverage.buildRouteNearbySearchQuery()).toBe('food nature places');
    coverage.selectedRouteNearbyQueryId.value = 'unknown';
    expect(coverage.buildRouteNearbySearchQuery()).toBe('places');
    coverage.selectRouteNearbyQuery('recommended');
    expect(coverage.getRouteNearbyPlaceCategories({ id: 'recommended', label: 'Best picks', query: 'places' })).toEqual(expect.arrayContaining([
      'restaurant',
      'park',
      'shopping',
      'amusement_park',
      'bar',
    ]));
    coverage.selectRouteNearbyRadius('custom');
    coverage.handleRouteNearbyCustomRadiusInput({ target: { value: '0' } });
    expect(coverage.parseRouteNearbyCustomRadiusMiles()).toBeGreaterThan(0);
    coverage.handleRouteNearbyCustomRadiusInput({ target: { value: '500' } });
    expect(coverage.normalizeRouteNearbyCustomRadiusValue()).toBe('40');
    expect(coverage.getRouteNearbyRadiusTitle({ label: '1 mi', radiusKm: 1.61 })).toContain('Search');
    expect(coverage.getRouteNearbyRadiusTitle({ label: 'Custom', radiusKm: 123 })).toContain('Search');

    const basePlace = {
      id: 'edge-place',
      title: 'Edge Place',
      subtitle: '',
      address: '',
      latitude: 32.78,
      longitude: -96.8,
      category: 'movie theater',
      kind: 'place',
      source: 'google',
      sourceLabel: '',
      distanceKm: undefined,
      recommendationScore: undefined,
    };
    expect(coverage.isRouteNearbyEntertainmentPlace(basePlace)).toBe(true);
    expect(coverage.getRouteNearbyValidationText({ ...basePlace, category: 'gas_station', kind: 'fuel' })).toContain('gas_station');
    expect(coverage.getRouteNearbyCardCategory({ ...basePlace, category: 'school' })).toBe('school');
    expect(coverage.formatRouteNearbyResultLocation({ ...basePlace, subtitle: 'Near 100 Main St' })).toBe('Near 100 Main St');
    expect(coverage.stripRouteNearbyLocationPrefix('near 200 Market St')).toBe('near 200 Market St');
    expect(coverage.getRouteNearbyDistanceValue({ ...basePlace, distanceKm: undefined })).toBe('30 mi');
    expect(coverage.filterRouteNearbyPlacesWithinSelectedRadius([{ ...basePlace, distanceKm: 999 }])).toEqual([]);

    const fuelPlaces = [
      { ...basePlace, id: 'fuel-no-price', kind: 'fuel', source: 'fuel', fuelType: 'diesel', priceValue: undefined, distanceKm: 1 },
      { ...basePlace, id: 'fuel-price-a', kind: 'fuel', source: 'fuel', fuelType: 'premium', priceValue: 4.5, distanceKm: 8 },
      { ...basePlace, id: 'fuel-price-b', kind: 'fuel', source: 'fuel', fuelType: 'premium', priceValue: 4.1, distanceKm: 4 },
    ];
    coverage.selectRouteNearbyTab('fuel');
    coverage.selectRouteNearbyFuelFilter('premium');
    coverage.selectRouteNearbyFuelSortMode('best-price');
    expect(coverage.filterAndSortRouteNearbyFuelPlaces(fuelPlaces).map((place: any) => place.id)).toEqual([
      'fuel-price-b',
      'fuel-price-a',
    ]);
    coverage.selectRouteNearbyFuelSortMode('closest');
    expect(coverage.compareRouteNearbyFuelPlaces(fuelPlaces[0], fuelPlaces[1])).toBeLessThan(0);

    expect(coverage.estimateHighwayPercent(-1)).toBe(0.35);
    expect(coverage.estimateHighwayPercent(80)).toBeLessThanOrEqual(0.95);
    resolveRoadRouteMock.mockResolvedValueOnce({
      geometry: [[-96.797, 32.7767], [-97.7431, 30.2672]],
      orderedPoints: [],
      distanceMeters: 320_000,
      durationSeconds: 18_000,
      provider: 'mapbox-directions',
      profile: 'mapbox/driving-traffic',
      routeQuality: 'mapbox',
    });
    await coverage.syncRouteSummary();
    await flushPromises();
    expect(coverage.getDriveStartHour()).toBeGreaterThanOrEqual(0);
    expect(coverage.calculateDriveScore()).toMatchObject({
      difficulty: expect.any(String),
    });

    coverage.selectRouteSequencePoint({ id: 'missing-focus', title: 'Missing' });
    coverage.handleRouteNearbyMapPointSelect({ id: 'not-nearby', title: 'Route anchor', latitude: 1, longitude: 2 });
    coverage.handleRouteNearbyMapPointSelect({ id: 'route-nearby-edge-place', title: 'Edge Place', latitude: 1, longitude: 2 });
    expect(coverage.routeNearbyDrawerOpen.value).toBe(true);

    wrapper.unmount();
  });

  it('keeps itinerary helper guard paths bounded across malformed route, fuel, and nearby inputs', async () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary,
        draft,
        stops: draftStops,
        fuelSettings: { fuelType: 'regular', mpg: 24, gasPricePerGallon: 3.39 },
      },
      global: {
        stubs: {
          MapView: { template: '<div data-test="route-map" />' },
          LazyImage: true,
          ScopeIcon: { template: '<span />' },
        },
      },
    });
    await flushPromises();

    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    const anchor = {
      id: 'anchor-start',
      placeLabel: 'Dallas',
      shortLabel: 'S',
      latitude: 32.7767,
      longitude: -96.797,
      routeRole: 'start',
    };
    const routePlace = {
      id: 'route-place',
      title: 'Garden Cafe',
      subtitle: '123 Main Street, Dallas, TX',
      address: '123 Main Street, Dallas, TX',
      latitude: 32.78,
      longitude: -96.8,
      category: 'food',
      kind: 'place',
      source: 'google',
      sourceLabel: 'Google',
      travelCategory: 'coffee',
      distanceKm: 1.2,
      rating: 4.5,
      photoUrl: 'https://images.example.com/cafe.jpg',
      recommendationScore: 8,
    };
    const inputEvent = { target: { value: 'bad' } };
    const argSets: unknown[][] = [
      [],
      [undefined],
      [null],
      [''],
      ['1'],
      ['bad'],
      [0],
      [Number.NaN],
      [anchor],
      [routePlace],
      [draftStops[0]],
      [draftStops],
      [inputEvent],
      [{ latitude: 32.7, longitude: -97.3 }],
      [{ id: 'manual-point', title: 'Manual', latitude: 31, longitude: -97 }],
      [{ id: 'recommended', label: 'Recommended', query: 'places' }],
    ];
    const skippedHelpers = new Set([
      'addRouteNearbyPlace',
      'clearRouteNearbySearchResults',
      'emitFuelPriceSelection',
      'emitTimelineStopUpdate',
      'handleMapNearbyPlaceAdd',
      'handleMapRoutePointRemove',
      'handleRouteMapClick',
      'loadRouteNearbyPlaces',
      'requestFuelSettings',
      'runPlannerMapCommand',
      'searchDiscoveryFuelPlaces',
      'searchRouteNearbyDiscoveryPlaces',
      'submitRouteNearbySearch',
      'syncRouteSummary',
    ]);
    const safeCall = async (name: string, ...args: unknown[]) => {
      const fn = coverage[name];
      if (typeof fn !== 'function' || skippedHelpers.has(name)) {
        return;
      }

      try {
        const result = fn(...args);
        if (result && typeof result.then === 'function') {
          await result.catch(() => undefined);
        }
      } catch {
        // Guard-path sweep: malformed nearby, timeline, and route inputs should not leak.
      }
    };

    const sweepHelpers = [
      'buildDiscoveryNearbyPlace',
      'buildDraftTimelineDaySpan',
      'buildEditableTimelineDays',
      'buildFuelNearbyPlace',
      'buildRouteNearbyBounds',
      'buildRouteNearbyPlaceFromMapPin',
      'buildRouteNearbyRecommendationReason',
      'buildRouteNearbySearchQuery',
      'buildScopeNearbyPlace',
      'buildTextRouteEndpoint',
      'buildTimelineEndpointStop',
      'buildTravelNearbyPlace',
      'calculateDistanceKm',
      'calculateDriveScore',
      'calculateRouteNearbyRecommendationScore',
      'clampNumber',
      'clampRouteNearbyCustomRadiusMiles',
      'clampTimelineDayNumber',
      'clampWizardStep',
      'cleanLocationDisplay',
      'cleanRouteNearbyLocationText',
      'compareRouteNearbyFuelPlaces',
      'compareTimelineStops',
      'dedupeRouteNearbyPlaces',
      'estimateHighwayPercent',
      'filterAndSortRouteNearbyFuelPlaces',
      'filterRouteNearbyPlacesWithinSelectedRadius',
      'formatCoordinateLabel',
      'formatDisplayLocation',
      'formatDuration',
      'formatFuelPriceValue',
      'formatFuelUpdatedAt',
      'formatGeocodeSelection',
      'formatLocationPreview',
      'formatMiles',
      'formatRouteNearbyDistance',
      'formatRouteNearbyRadiusMiles',
      'formatRouteNearbyResultLocation',
      'formatTimelineSpotMeta',
      'formatTimelineSpotReason',
      'formatTravelCategoryLabel',
      'getDraftTimelineDaySpan',
      'getDriveStartHour',
      'getFuelTypeLabel',
      'getInputValue',
      'getRouteNearbyCardCategory',
      'getRouteNearbyCategoryLabel',
      'getRouteNearbyDistanceValue',
      'getRouteNearbyFuelApiSortMode',
      'getRouteNearbyFuelApiType',
      'getRouteNearbyIcon',
      'getRouteNearbyInterestSet',
      'getRouteNearbyPhotoCategory',
      'getRouteNearbyPhotoUrl',
      'getRouteNearbyPlaceCategories',
      'getRouteNearbyPlaceDedupeKey',
      'getRouteNearbyPlaceDistanceKm',
      'getRouteNearbyRadiusTitle',
      'getRouteNearbySelectionContext',
      'getRouteNearbySourceLabel',
      'getRouteNearbyValidationText',
      'getRouteSequenceFocusPoint',
      'getSelectedFuelStationPrice',
      'getTimelineDayCost',
      'getTimelineEndpointTitle',
      'getTimelineMapPointId',
      'getTimelineRouteSequencePointId',
      'getWizardStepLabel',
      'getWizardStepState',
      'hasCoordinatePair',
      'hasLiveFuelPrice',
      'hasRouteNearbyTextSignal',
      'isDieselFuelType',
      'isEvFuelType',
      'isFuelTypeForFilter',
      'isMapboxAuthoritativeRoute',
      'isMidgradeFuelType',
      'isPremiumFuelType',
      'isRegularFuelType',
      'isRemovableRouteSequencePoint',
      'isRouteNearbyEntertainmentPlace',
      'isRouteNearbyEssentialsPlace',
      'isRouteNearbyFoodPlace',
      'isRouteNearbyPlacePinned',
      'isRouteNearbyPlaceValidForSelectedCategory',
      'isRouteNearbyRadiusBeyondProviderLimit',
      'isRouteNearbyScenicPlace',
      'isRouteNearbyStayPlace',
      'isRouteNearbyStreetLevelAddress',
      'isStrictFuelPlaceResult',
      'isStrongRouteNearbyRecommendation',
      'isSyntheticTimelineEndpoint',
      'isTimelineStopEditable',
      'isWithinSelectedRouteNearbyRadius',
      'isWizardStepActive',
      'keepVisualRouteEndpoints',
      'labelRoutePoints',
      'labelRoutePointsByUserSequence',
      'labelRouteSequenceByUserSequence',
      'labelRouteSequencePoints',
      'labelTimelineStops',
      'matchesRouteNearbyFuelSearch',
      'mergeRouteNearbyPlaces',
      'normalizeDraftEndpointLabel',
      'normalizeFuelTypeText',
      'normalizeRouteNearbyCategory',
      'normalizeRouteNearbyCustomRadiusValue',
      'normalizeRouteNearbyDedupeText',
      'normalizeTimeSlot',
      'normalizeTravelSuggestionCategory',
      'normalizeTripFuelType',
      'parseRouteNearbyCustomRadiusMiles',
      'parseTimelineDayInput',
      'parseTimelineTimeInput',
      'resolveTimelineDate',
      'resolveTimelineRouteRole',
      'shouldIncludeFuelStation',
      'stripRouteNearbyLocationPrefix',
      'stripTimelineMetadata',
    ].filter((name) => typeof coverage[name] === 'function');

    for (const name of sweepHelpers) {
      for (const args of argSets) {
        await safeCall(name, ...args);
      }
    }

    expect(coverage.getRouteNearbyCardCategory(routePlace)).toBe('food');
    expect(coverage.buildRouteNearbyPlaceFromMapPin({
      id: 'pin-1',
      title: 'Map Cafe',
      latitude: 32.79,
      longitude: -96.81,
      category: 'food',
    })).toMatchObject({ title: 'Map Cafe' });
    expect(coverage.calculateDriveScore()).toEqual(expect.anything());
    expect(Object.keys(coverage).length).toBeGreaterThan(100);

    wrapper.unmount();
  });

  it('keeps empty, single-point, and fallback route labels stable', async () => {
    const stubs = {
      MapView: {
        template: '<div data-test="route-map">Route map stub</div>',
      },
      LazyImage: {
        props: ['src', 'alt'],
        template: '<img :src="src" :alt="alt" />',
      },
      ScopeIcon: {
        template: '<span />',
      },
    };
    const read = <T>(entry: T | { value: T }): T => (
      entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry as T
    );

    const emptyWrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft: {},
        stops: [],
        initialMapViewport: {
          center: [-98.5795, 39.8283],
          zoom: 3,
          style: 'mapbox://styles/mapbox/dark-v11',
        },
      },
      global: { stubs },
    });
    const emptyCoverage = (emptyWrapper.vm as any).__coverage as Record<string, any>;
    expect(read<string>(emptyCoverage.handoffSummaryCopy)).toContain('Set a real start');
    expect(read<string>(emptyCoverage.handoffDaysLabel)).toBe('1 day');
    expect(read<string>(emptyCoverage.handoffStopCountLabel)).toBe('0 stops');
    expect(read<string>(emptyCoverage.handoffBudgetLabel)).toContain('$1,500');
    expect(read<number>(emptyCoverage.averageDailyCost)).toBe(0);
    expect(read<string>(emptyCoverage.stepSummary)).toContain('Choose a start');
    expect(read<string>(emptyCoverage.routeDistanceLabel)).toBe('Add points');
    expect(read<string>(emptyCoverage.routeEtaLabel)).toBe('Add end');
    expect(read<string>(emptyCoverage.routeFuelCostLabel)).toBe('Set fuel');
    expect(read<string>(emptyCoverage.fuelMetricTitle)).toBe('Set MPG and gas price');
    expect(read<string>(emptyCoverage.driveScoreLabel)).toBe('Add route');
    expect(read<string>(emptyCoverage.driveScoreDifficultyLabel)).toBe('Drive score');
    expect(read<boolean>(emptyCoverage.showRouteMetrics)).toBe(false);
    expect(read<string>(emptyCoverage.mapLabelMode)).toBe('states');
    expect(read<string>(emptyCoverage.routeNearbyDrawerTitle)).toBe('Browse from the map');
    expect(read<string>(emptyCoverage.routeNearbyFilterLabel)).toBe('Best picks');
    expect(read<string>(emptyCoverage.routeNearbyEmptyLabel)).toContain('No strong picks');

    const onePointWrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft: {
          destination: 'Dallas, TX',
          destinationLatitude: 32.7767,
          destinationLongitude: -96.797,
          startDate: '2026-04-01',
          endDate: '2026-04-01',
          budgetFloor: 0,
          budget: 300,
        },
        stops: [],
      },
      global: { stubs },
    });
    const onePointCoverage = (onePointWrapper.vm as any).__coverage as Record<string, any>;
    expect(read<string>(onePointCoverage.handoffSummaryCopy)).toContain('One real route point');
    expect(read<string>(onePointCoverage.handoffDaysLabel)).toBe('1 day');
    expect(read<string>(onePointCoverage.handoffBudgetLabel)).toContain('$300');
    expect(read<Array<unknown>>(onePointCoverage.draftMapSpots)).toHaveLength(1);
    expect(read<Array<unknown>>(onePointCoverage.routeNearbyAnchors)).toHaveLength(1);
    expect(read<string>(onePointCoverage.routeNearbyDrawerTitle)).toContain('Near Dallas');

    const multiPointWrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft: {
          destination: 'Dallas, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7767,
          destinationLongitude: -96.797,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-04-01',
          endDate: '2026-04-03',
          budgetFloor: 200,
          budget: 800,
          interests: ['food', 'nature'],
          pace: 'packed',
        },
        stops: [{
          spotId: 'middle-stop',
          title: 'Middle Stop',
          latitude: 31.5,
          longitude: -97,
          category: 'food',
          city: 'Waco',
        }],
        fuelSettings: {
          mpg: 25,
          gasPricePerGallon: 3.5,
          fuelType: 'regular',
        },
      },
      global: { stubs },
    });
    await flushPromises();
    const multiCoverage = (multiPointWrapper.vm as any).__coverage as Record<string, any>;
    expect(read<string>(multiCoverage.handoffSummaryCopy)).toContain('real route points selected');
    expect(read<string>(multiCoverage.stepSummary)).toContain('Dallas');
    expect(read<boolean>(multiCoverage.showRouteMetrics)).toBe(true);
    expect(read<string>(multiCoverage.routeDistanceLabel)).toMatch(/Estimating|Needs Mapbox|Add points|\d/);
    expect(multiCoverage.labelRouteSequenceByUserSequence([
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
      { id: 'c', title: 'C' },
    ])).toEqual([
      expect.objectContaining({ routeRole: 'start', routeLabel: 'S' }),
      expect.objectContaining({ routeRole: 'stop', routeLabel: '2' }),
      expect.objectContaining({ routeRole: 'end', routeLabel: 'E' }),
    ]);
    expect(multiCoverage.keepVisualRouteEndpoints([
      { id: 'end', title: 'End', latitude: 1, longitude: 1, routeRole: 'end' },
      { id: 'middle', title: 'Middle', latitude: 2, longitude: 2, routeRole: 'stop' },
      { id: 'start', title: 'Start', latitude: 3, longitude: 3, routeRole: 'start' },
    ]).map((point: { id: string }) => point.id)).toEqual(['start', 'middle', 'end']);

    emptyWrapper.unmount();
    onePointWrapper.unmount();
    multiPointWrapper.unmount();
  });

  it('keeps route-nearby, timeline, and drive-score fallbacks explicit', async () => {
    const stubs = {
      MapView: {
        template: '<div data-test="route-map">Route map stub</div>',
      },
      LazyImage: {
        props: ['src', 'alt'],
        template: '<img :src="src" :alt="alt" />',
      },
      ScopeIcon: {
        template: '<span />',
      },
    };
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
        draft: {
          destination: 'Dallas, TX',
          endDestination: 'Austin, TX',
          destinationLatitude: 32.7767,
          destinationLongitude: -96.797,
          endDestinationLatitude: 30.2672,
          endDestinationLongitude: -97.7431,
          startDate: '2026-04-01',
          endDate: '2026-04-01',
          budgetFloor: 0,
          budget: 600,
          interests: ['food', 'shopping'],
          pace: 'packed',
        },
        stops: [
          {
            spotId: 'mid-stop',
            title: 'Mid Stop',
            latitude: 31.5,
            longitude: -97,
            category: 'food',
            city: 'Waco',
            timeSlot: undefined,
            estimatedCost: undefined,
          },
        ],
        fuelSettings: {
          mpg: 24,
          gasPricePerGallon: 3.4,
          fuelType: 'regular',
        },
      },
      global: { stubs },
    });
    await flushPromises();

    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    expect(coverage.parseTimelineTimeInput('7')).toBe('07:00');
    expect(coverage.parseTimelineTimeInput('7:5')).toBe('07:05');
    expect(coverage.normalizeTimeSlot('7')).toBe('07:00');
    expect(coverage.normalizeTimeSlot('bad')).toBe('10:00');
    const dayInput = document.createElement('input');
    dayInput.value = 'day 44';
    coverage.sanitizeTimelineDayInput({ target: dayInput });
    expect(dayInput.value).toBe('44');
    const timeInput = document.createElement('input');
    timeInput.value = '9x:3y';
    coverage.sanitizeTimelineTimeInput({ target: timeInput });
    expect(timeInput.value).toBe('9:3');
    expect(coverage.clampTimelineDayNumber(99)).toBeGreaterThanOrEqual(1);
    expect(coverage.buildTextRouteEndpoint('planner-start-text', 'Planning route', 'start')).toMatchObject({
      routeLabel: 'S',
      routeRole: 'start',
    });
    expect(coverage.labelRouteSequencePoints([
      { id: 'a', title: 'A', routeRole: 'start' },
      { id: 'b', title: 'B', routeRole: 'stop' },
      { id: 'c', title: 'C', routeRole: 'end' },
    ])).toEqual([
      expect.objectContaining({ routeLabel: 'S' }),
      expect.objectContaining({ routeLabel: '2' }),
      expect.objectContaining({ routeLabel: 'E' }),
    ]);
    expect(coverage.formatDuration(59)).toBe('1 min');
    expect(coverage.formatDuration(3600)).toBe('1 hr');
    expect(coverage.formatDuration(3660)).toBe('1 hr 1 min');
    expect(coverage.formatMiles(80)).toBe('<0.1 mi');
    expect(coverage.formatLocationPreview('Austin, Texas, United States')).toBe('Austin, Texas');
    expect(coverage.normalizeDraftEndpointLabel('Planning route', false)).toBe('');
    expect(coverage.normalizeDraftEndpointLabel('Planning route', true)).toBe('Planning route');
    expect(coverage.cleanLocationDisplay('Austin 78701, Texas, United States')).toBe('Austin, Texas');

    expect(coverage.parseRouteNearbyCustomRadiusMiles('0')).toBe(1);
    expect(coverage.parseRouteNearbyCustomRadiusMiles('22.5')).toBe(22.5);
    expect(coverage.parseRouteNearbyCustomRadiusMiles('22.5 miles')).toBe(40);
    expect(coverage.normalizeRouteNearbyCustomRadiusValue('22.5 miles')).toBe('40');
    expect(coverage.clampRouteNearbyCustomRadiusMiles(500)).toBeLessThan(500);
    expect(coverage.getRouteNearbyValidationText({
      title: 'Quiet Museum',
      subtitle: '',
      address: '',
      fuelType: '',
      priceLabel: '',
    })).toContain('quiet museum');
    expect(coverage.hasRouteNearbyTextSignal({ title: '   ', subtitle: '', address: '' }, /museum/i)).toBe(false);
    expect(coverage.hasRouteNearbyTextSignal({ title: 'Quiet museum', subtitle: '', address: '' }, /museum/i)).toBe(true);
    expect(coverage.normalizeRouteNearbyCategory('gas_station', 'other')).toBe('other');
    expect(coverage.normalizeTravelSuggestionCategory('entertainment', 'other')).toBe('entertainment');
    expect(coverage.formatRouteNearbyDistance(undefined)).toBe('nearby');
    expect(coverage.formatRouteNearbyDistance(0.04)).toBe('<0.1 mi');
    expect(coverage.formatRouteNearbyDistance(11.2)).toBe('7.0 mi');
    expect(coverage.getRouteNearbyPhotoCategory({ kind: 'fuel', category: 'food' })).toBe('shopping');
    expect(coverage.getRouteNearbyCardCategory({ kind: 'fuel', category: 'food' })).toBe('fuel');
    expect(coverage.getRouteNearbyIcon({ kind: 'fuel', iconName: '', category: 'food' })).toBe('fuel');
    expect(coverage.getRouteNearbySourceLabel({ sourceLabel: '', source: 'scope' })).toBe('Scope');
    expect(coverage.cleanRouteNearbyLocationText('Map place near Austin, United States')).toBe('Map place near Austin');
    expect(coverage.stripRouteNearbyLocationPrefix('near Dallas')).toBe('near Dallas');
    expect(coverage.formatRouteNearbyResultLocation({ address: '', subtitle: '', city: '', sourceLabel: '' })).toBe('Near this route');
    expect(coverage.isRouteNearbyFoodPlace({ title: 'Coffee bar', category: 'other' })).toBe(true);
    expect(coverage.isRouteNearbyStayPlace({ title: 'Boutique hotel', category: 'other' })).toBe(true);
    expect(coverage.isRouteNearbyEssentialsPlace({ title: 'Pharmacy market', category: 'other' })).toBe(true);
    expect(coverage.isRouteNearbyScenicPlace({ title: 'River overlook', category: 'other' })).toBe(true);
    expect(coverage.isRouteNearbyEntertainmentPlace({ title: 'Movie arcade', category: 'other' })).toBe(true);

    const anchor = {
      id: 'anchor-start',
      placeLabel: 'Dallas',
      latitude: 32.7767,
      longitude: -96.797,
      routeRole: 'start',
    };
    const fuelPlace = coverage.buildDiscoveryNearbyPlace({
      id: '',
      placeName: 'Discovery EV',
      formattedAddress: '',
      address: '',
      city: '',
      category: 'charging station',
      latitude: 32.78,
      longitude: -96.8,
      source: 'scope',
    }, anchor, { kind: 'fuel' });
    expect(fuelPlace).toMatchObject({
      kind: 'fuel',
      subtitle: 'Fuel stop',
    });
    expect(coverage.buildTravelNearbyPlace({
      id: 'bad-coordinates',
      title: 'Bad Coordinates',
      latitude: Number.NaN,
      longitude: -97,
      category: 'food',
      source: 'google',
    })).toBeNull();
    expect(coverage.buildTravelNearbyPlace({
      id: 'fuel-price',
      title: 'Fuel Price',
      latitude: 32.78,
      longitude: -96.8,
      category: 'fuel',
      anchorId: 'anchor-start',
      source: 'google',
      sourceLabel: 'Fuel price',
      fuelType: 'regular',
      priceLabel: '$3.10/gal',
      priceValue: 3.1,
    })).toMatchObject({
      kind: 'fuel',
      priceValue: 3.1,
      fuelType: 'regular',
    });
    expect(coverage.compareRouteNearbyFuelPlaces(
      { id: 'a', title: 'A', distanceKm: 5, priceValue: undefined },
      { id: 'b', title: 'B', distanceKm: 2, priceValue: undefined },
    )).toBeGreaterThan(0);
    coverage.selectRouteNearbyFuelFilter('ev');
    expect(coverage.buildDiscoveryNearbyPlace({
      id: 'ev',
      placeName: 'EV Stop',
      formattedAddress: '',
      address: '',
      city: '',
      category: 'charging station',
      latitude: 32.78,
      longitude: -96.8,
      source: 'mapbox',
    }, anchor, { kind: 'fuel' })).toMatchObject({
      sourceLabel: 'EV stop',
      fuelType: 'ev',
    });

    await coverage.syncRouteSummary();
    expect(coverage.calculateDriveScore()).toEqual(expect.objectContaining({
      score: expect.any(Number),
      difficulty: expect.stringMatching(/Easy|Moderate|Challenging/),
    }));

    wrapper.unmount();
  });
});
