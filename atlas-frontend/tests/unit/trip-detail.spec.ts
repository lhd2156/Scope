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
  coverImageUrl: 'https://images.example.com/trip.jpg',
  spots: [
    {
      spotId: 'spot-1',
      title: 'Sunset Rooftop Tacos',
      latitude: 32.7555,
      longitude: -97.3308,
      category: 'food',
      estimatedCost: 24,
      city: 'Fort Worth',
    },
  ],
  members: [
    { id: 'user-1', displayName: 'Louis Do', status: 'owner' },
    { id: 'user-2', displayName: 'Maya Chen', status: 'editor' },
  ],
};

describe('TripDetail', () => {
  it('renders the trip hero, stats, and composed trip surfaces', () => {
    const wrapper = mount(TripDetail, {
      props: {
        trip,
      },
      global: {
        stubs: {
          MemberList: {
            template: '<div data-test="member-list">Members stub</div>',
          },
          TripTimeline: {
            template: '<div data-test="trip-timeline">Timeline stub</div>',
          },
          ItineraryView: {
            template: '<div data-test="itinerary-view">Itinerary stub</div>',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('North Texas Night + Food Loop');
    expect(wrapper.text()).toContain('Fort Worth, TX');
    expect(wrapper.text()).toContain('Travelers');
    expect(wrapper.find('[data-test="member-list"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="trip-timeline"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="itinerary-view"]').exists()).toBe(true);
  });
});
