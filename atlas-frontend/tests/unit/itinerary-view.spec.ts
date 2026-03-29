import { mount } from '@vue/test-utils';
import ItineraryView from '@/components/trips/ItineraryView.vue';
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
        {
          spotId: 'spot-2',
          title: 'Botanic River Walk',
          latitude: 32.749,
          longitude: -97.363,
          category: 'nature',
          timeSlot: '15:00',
          duration: 90,
          estimatedCost: 60,
          city: 'Fort Worth',
        },
      ],
    },
  ],
};

describe('ItineraryView', () => {
  it('renders route preview, totals, and day-level cost breakdown', () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary,
      },
      global: {
        stubs: {
          MapView: {
            template: '<div data-test="map-stub">Map preview</div>',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('Fort Worth, TX');
    expect(wrapper.text()).toContain('$84');
    expect(wrapper.text()).toContain('Sunny, 75F');
    expect(wrapper.find('[data-test="map-stub"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Botanic River Walk');
  });
});
