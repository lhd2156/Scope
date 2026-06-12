import { mount } from '@vue/test-utils';
import TripDetail from '@/components/trips/TripDetail.vue';
import type { Trip } from '@/types';

const trip: Trip = {
  id: 'trip-1',
  title: 'North Texas Night + Food Loop',
  destination: 'Fort Worth, TX',
  description: 'Two days of tacos, skyline views, galleries, and nightlife.',
  isPublic: true,
  startDate: '2026-04-01',
  endDate: '2026-04-02',
  budget: 320,
  currency: 'USD',
  status: 'planning',
  coverImageUrl: 'https://images.example.com/trip.jpg',
  members: [
    { id: 'user-1', displayName: 'Louis Do', status: 'owner' },
    { id: 'user-2', displayName: 'Maya Chen', status: 'editor' },
  ],
  spots: [
    {
      spotId: 'spot-1',
      title: 'Sunset Rooftop Tacos',
      latitude: 32.7555,
      longitude: -97.3308,
      category: 'food',
      city: 'Fort Worth',
      timeSlot: '11:00',
      duration: 75,
      estimatedCost: 24,
      dayNumber: 1,
      notes: 'Open with lunch before the city walk.',
    },
    {
      spotId: 'spot-2',
      title: 'Midnight Vinyl Club',
      latitude: 32.7812,
      longitude: -96.8003,
      category: 'nightlife',
      city: 'Dallas',
      timeSlot: '20:30',
      duration: 120,
      estimatedCost: 42,
      dayNumber: 2,
      notes: 'Close with a dance-floor stop.',
    },
  ],
  itinerary: {
    id: 'itinerary-1',
    destination: 'Fort Worth, TX',
    totalEstimatedCost: 66,
    weatherForecast: 'Sunny, 75F',
    days: [
      {
        dayNumber: 1,
        date: '2026-04-01',
        spots: [
          {
            spotId: 'spot-1',
            title: 'Sunset Rooftop Tacos',
            latitude: 32.7555,
            longitude: -97.3308,
            category: 'food',
            city: 'Fort Worth',
            timeSlot: '11:00',
            duration: 75,
            estimatedCost: 24,
            dayNumber: 1,
            notes: 'Open with lunch before the city walk.',
          },
        ],
      },
      {
        dayNumber: 2,
        date: '2026-04-02',
        spots: [
          {
            spotId: 'spot-2',
            title: 'Midnight Vinyl Club',
            latitude: 32.7812,
            longitude: -96.8003,
            category: 'nightlife',
            city: 'Dallas',
            timeSlot: '20:30',
            duration: 120,
            estimatedCost: 42,
            dayNumber: 2,
            notes: 'Close with a dance-floor stop.',
          },
        ],
      },
    ],
  },
};

describe('TripDetail', () => {
  it('renders the trip hero, timeline, members, and route preview', () => {
    const wrapper = mount(TripDetail, {
      props: {
        trip,
      },
      global: {
        stubs: {
          MapView: {
            template: '<div data-test="trip-map">Trip map stub</div>',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('North Texas Night + Food Loop');
    expect(wrapper.text()).toContain('Fort Worth, TX · Apr 1 → Apr 2');
    expect(wrapper.text()).toContain('Wed, Apr 1');
    expect(wrapper.text()).toContain('Thu, Apr 2');
    expect(wrapper.text()).toContain('Trip members');
    expect(wrapper.text()).toContain('Daily route breakdown');
    expect(wrapper.text()).toContain('Open with lunch before the city walk.');
    expect(wrapper.find('[data-test="trip-map"]').exists()).toBe(true);
  });

  it('builds a fallback itinerary, budget label, and packed route map when itinerary data is absent', () => {
    const fallbackTrip: Trip = {
      ...trip,
      id: 'trip-fallback',
      title: 'Single Day Sprint',
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      budget: undefined,
      itinerary: undefined,
      members: [{ id: 'user-1', displayName: 'Louis Do', status: 'owner' }],
      spots: Array.from({ length: 5 }, (_, index) => ({
        spotId: `fallback-spot-${index + 1}`,
        title: `Fallback stop ${index + 1}`,
        latitude: 32.7 + index * 0.01,
        longitude: -97.3 - index * 0.01,
        category: 'food',
        city: 'Fort Worth',
        timeSlot: index % 2 === 0 ? undefined : `1${index}:00`,
        estimatedCost: index % 2 === 0 ? undefined : 18,
        dayNumber: index < 3 ? 1 : 2,
      })),
    };
    const mapViewStub = {
      name: 'MapView',
      props: ['spots'],
      template: '<div data-test="trip-map">Trip map stub</div>',
    };

    const wrapper = mount(TripDetail, {
      props: {
        trip: fallbackTrip,
      },
      global: {
        stubs: {
          MapView: mapViewStub,
        },
      },
    });

    const mapSpots = wrapper.findComponent({ name: 'MapView' }).props('spots') as Array<{ routeRole: string }>;

    expect(wrapper.text()).toContain('Single Day Sprint');
    expect(wrapper.text()).toContain('Apr 1');
    expect(wrapper.text()).toContain('Budget TBD');
    expect(wrapper.text()).toContain('$36');
    expect(wrapper.text()).toContain('Weather syncing from Scope Intel.');
    expect(wrapper.text()).toContain('Packed');
    expect(mapSpots.map((spot) => spot.routeRole)).toEqual(['start', 'stop', 'stop', 'stop', 'end']);
  });

  it('uses itinerary stops for the map when the trip spot list is empty', () => {
    const itineraryOnlyTrip: Trip = {
      ...trip,
      id: 'trip-itinerary-only',
      title: 'Itinerary Only Route',
      spots: [],
      budget: 725,
      itinerary: {
        id: 'itinerary-only',
        destination: 'Fort Worth, TX',
        totalEstimatedCost: 210,
        weatherForecast: 'Cloudy, 68F',
        days: [
          {
            dayNumber: 3,
            date: '2026-04-03',
            spots: [
              {
                spotId: 'itinerary-stop-1',
                title: 'Gallery brunch',
                latitude: 32.76,
                longitude: -97.34,
                category: 'culture',
                city: 'Fort Worth',
              },
              {
                spotId: 'itinerary-stop-2',
                title: 'River walk',
                latitude: 32.78,
                longitude: -97.36,
                category: 'nature',
                city: 'Fort Worth',
              },
            ],
          },
        ],
      },
    };
    const mapViewStub = {
      name: 'MapView',
      props: ['spots'],
      template: '<div data-test="trip-map">Trip map stub</div>',
    };

    const wrapper = mount(TripDetail, {
      props: {
        trip: itineraryOnlyTrip,
      },
      global: {
        stubs: {
          MapView: mapViewStub,
        },
      },
    });

    const mapSpots = wrapper.findComponent({ name: 'MapView' }).props('spots') as Array<{ id: string; routeRole: string }>;

    expect(wrapper.text()).toContain('$725');
    expect(wrapper.text()).toContain('$210');
    expect(wrapper.text()).toContain('Cloudy, 68F');
    expect(wrapper.text()).toContain('Relaxed');
    expect(mapSpots).toEqual([
      expect.objectContaining({ id: 'itinerary-stop-1', routeRole: 'start' }),
      expect.objectContaining({ id: 'itinerary-stop-2', routeRole: 'end' }),
    ]);
  });

  it('keeps null, singular, and fallback trip detail helpers safe', async () => {
    const nullWrapper = mount(TripDetail, {
      props: {
        trip: null,
      },
      global: {
        stubs: {
          MapView: { template: '<div />' },
        },
      },
    });
    const nullCoverage = (nullWrapper.vm as any).__coverage;

    expect(nullWrapper.find('[data-test="trip-detail"]').exists()).toBe(false);
    expect(nullCoverage.resolvedItinerary.value).toBeNull();
    expect(nullCoverage.totalDays.value).toBe(0);
    expect(nullCoverage.dateRangeLabel.value).toBe('');
    expect(nullCoverage.heroImageFallback.value).toBe('');
    expect(nullCoverage.heroImageUrl.value).toBe('');
    expect(nullCoverage.estimatedSpendLabel.value).toBe('$0');
    expect(nullCoverage.weatherLabel.value).toBe('Weather syncing');
    expect(nullCoverage.routeIntensityLabel.value).toBe('Relaxed');
    expect(nullCoverage.routeStops.value).toEqual([]);
    expect(nullCoverage.mapSpots.value).toEqual([]);

    const singularTrip: Trip = {
      ...trip,
      id: 'trip-singular',
      title: 'Solo Stop',
      startDate: '2026-04-01',
      endDate: '2026-04-01',
      currency: undefined,
      budget: 125,
      members: [{ id: 'user-1', displayName: 'Louis Do', status: 'owner' }],
      itinerary: undefined,
      spots: [
        {
          spotId: 'solo-stop',
          title: 'Solo Stop Cafe',
          latitude: 32.7555,
          longitude: -97.3308,
          category: 'food',
          city: 'Fort Worth',
          estimatedCost: undefined,
          timeSlot: undefined,
          dayNumber: undefined,
        },
      ],
    };

    await nullWrapper.setProps({ trip: singularTrip });
    expect(nullWrapper.text()).toContain('1 day');
    expect(nullWrapper.text()).toContain('1 stop');
    expect(nullWrapper.text()).toContain('1 traveler');
    expect(nullCoverage.budgetLabel.value).toBe('$125');
    expect(nullCoverage.buildFallbackItinerary(singularTrip)).toMatchObject({
      totalEstimatedCost: 0,
      days: [
        {
          dayNumber: 1,
          spots: [expect.objectContaining({ title: 'Solo Stop Cafe' })],
        },
      ],
    });
    expect(nullCoverage.flattenItineraryStops({
      id: 'inline',
      destination: 'Inline',
      totalEstimatedCost: 0,
      weatherForecast: '',
      days: [
        {
          dayNumber: 4,
          date: '2026-04-04',
          spots: [
            { ...singularTrip.spots[0], dayNumber: undefined },
          ],
        },
      ],
    })[0]).toMatchObject({ dayNumber: 4 });
  });
});
