import { mount } from '@vue/test-utils';
import TripCard from '@/components/trips/TripCard.vue';
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
    },
  ],
  members: [{ id: 'user-1', displayName: 'Louis Do', status: 'owner' }],
};

describe('TripCard', () => {
  it('renders trip metadata and detail navigation', () => {
    const wrapper = mount(TripCard, {
      props: { trip },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('North Texas Night + Food Loop');
    expect(wrapper.text()).toContain('Fort Worth, TX');
    expect(wrapper.text()).toContain('1 member');
    expect(wrapper.text()).toContain('1 stop');
    expect(wrapper.find('a').attributes('href')).toBe('/trips/trip-1');
  });
});
