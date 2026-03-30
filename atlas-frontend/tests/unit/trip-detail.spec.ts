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
    expect(wrapper.text()).toContain('Trip members');
    expect(wrapper.text()).toContain('Daily route breakdown');
    expect(wrapper.text()).toContain('Open with lunch before the city walk.');
    expect(wrapper.find('[data-test="trip-map"]').exists()).toBe(true);
  });
});
