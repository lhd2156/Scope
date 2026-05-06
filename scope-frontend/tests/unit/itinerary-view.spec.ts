import { flushPromises, mount } from '@vue/test-utils';
import ItineraryView from '@/components/trips/ItineraryView.vue';
import type { Itinerary, TripMember, TripPlannerInput, TripSpot } from '@/types';

const reverseGeocodeMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    latitude: 30.2672,
    longitude: -97.7431,
    placeName: 'Austin, TX, United States',
    city: 'Austin',
    country: 'United States',
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
        title: 'Waco Mammoth National Monument',
        description: 'A fossil site near the route.',
        latitude: 31.6047,
        longitude: -97.1758,
        city: 'Waco',
        country: 'United States',
        category: 'scenic',
        rating: 4.8,
        createdAt: '2026-04-01T00:00:00.000Z',
      },
    ],
  }),
);

vi.mock('@/services/mapService', () => ({
  reverseGeocode: reverseGeocodeMock,
}));

vi.mock('@/services/roadRouteService', () => ({
  resolveRoadRoute: resolveRoadRouteMock,
}));

vi.mock('@/services/spotService', () => ({
  listNearbySpots: listNearbySpotsMock,
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
    resolveRoadRouteMock.mockClear();
    listNearbySpotsMock.mockClear();
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
          title: 'Waco Mammoth National Monument',
          description: 'A fossil site near the route.',
          latitude: 31.6047,
          longitude: -97.1758,
          city: 'Waco',
          country: 'United States',
          category: 'scenic',
          rating: 4.8,
          createdAt: '2026-04-01T00:00:00.000Z',
        },
      ],
    });
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

    expect(wrapper.text()).toContain('Epic Patagonia Trek');
    expect(wrapper.text()).toContain('Patagonia, Chile + Argentina');
    expect(wrapper.text()).toContain('Sunny, 75F');
    expect(wrapper.text()).toContain('$168');
    expect(wrapper.text()).toContain('2 stops');
    expect(wrapper.find('[data-test="route-map"]').exists()).toBe(true);
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
    expect(wrapper.get('[data-test="itinerary-summary-card"]').text()).toContain('Scope AI handoff');
    expect(wrapper.get('[data-test="itinerary-summary-card"]').text()).toContain('AI-ready route');
    expect(wrapper.get('[data-test="itinerary-route-edit-card"]').text()).toContain('Shape the route Scope AI will build');
    expect(wrapper.find('[data-test="itinerary-route-scan-card"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('AI itinerary');
    expect(wrapper.text()).not.toContain('Adjust the route points');
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
    expect(wrapper.text()).toContain('AI preview');

    await wrapper.get('[data-test="planner-step-4-back"]').trigger('click');

    expect(wrapper.emitted('wizard-step-change')?.[0]?.[0]).toBe(3);
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
    expect(wrapper.text()).toContain('AI-ready route');
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
    expect(timelineOverlay.findAll('[data-test="itinerary-stop-time-input"]')).toHaveLength(4);
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

  it('keeps the draft route canvas filled with a placeholder before endpoints exist', () => {
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

    expect(wrapper.get('[data-test="planning-route-brief"]').text()).toContain('Choose start');
    expect(wrapper.get('[data-test="planning-route-brief"]').text()).toContain('Choose end');
    expect(wrapper.get('[data-test="planning-route-brief"]').text()).not.toContain('0 stops');
    expect(wrapper.get('[data-test="route-canvas-placeholder"]').text()).toContain('Add start');
    expect(wrapper.get('[data-test="route-canvas-placeholder"]').text()).toContain('Add end');
    expect(wrapper.find('[data-test="route-sequence-list"]').exists()).toBe(false);
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

  it('loads nearby place suggestions around route points and emits one as a stop', async () => {
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

    expect(listNearbySpotsMock).toHaveBeenCalledWith({
      latitude: 32.7767,
      longitude: -96.797,
      radiusKm: 80,
      page: 1,
      pageSize: 6,
    });
    expect(wrapper.get('[data-test="route-place-panel"]').text()).toContain('Around start');
    expect(wrapper.get('[data-test="route-place-suggestions"]').text()).toContain('Waco Mammoth National Monument');

    await wrapper.get('[data-place-id="nearby-spot-1"]').trigger('click');

    expect(wrapper.emitted('route-stop-add')?.[0]?.[0]).toMatchObject({
      spotId: 'nearby-spot-1',
      title: 'Waco Mammoth National Monument',
      latitude: 31.6047,
      longitude: -97.1758,
      category: 'scenic',
      city: 'Waco',
    });
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
});
