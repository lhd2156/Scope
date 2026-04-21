import { mount } from '@vue/test-utils';
import TripTimeline from '@/components/trips/TripTimeline.vue';
import type { Itinerary } from '@/types';

const itinerary: Itinerary = {
  id: 'itinerary-1',
  destination: 'Fort Worth, TX',
  totalEstimatedCost: 84,
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
          timeSlot: '12:00',
          duration: 90,
          estimatedCost: 24,
          city: 'Fort Worth',
        },
      ],
    },
  ],
};

describe('TripTimeline', () => {
  it('renders grouped itinerary stops with timing and cost metadata', () => {
    const wrapper = mount(TripTimeline, {
      props: {
        itinerary,
      },
    });

    expect(wrapper.text()).toContain('Day 1');
    expect(wrapper.text()).toContain('Wed, Apr 1');
    expect(wrapper.text()).toContain('Sunset Rooftop Tacos');
    expect(wrapper.text()).toContain('12:00');
    expect(wrapper.text()).toContain('$24');
  });
});
