import { mount } from '@vue/test-utils';
import ItineraryView from '@/components/trips/ItineraryView.vue';
import type { Itinerary, TripMember } from '@/types';

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

describe('ItineraryView', () => {
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
    expect(wrapper.text()).toContain('2 synced');
    expect(wrapper.find('[data-test="route-map"]').exists()).toBe(true);
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

  it('shows a premium empty state when no itinerary is available', () => {
    const wrapper = mount(ItineraryView, {
      props: {
        itinerary: null,
      },
      global: {
        stubs: {
          MapView: true,
          LazyImage: true,
        },
      },
    });

    expect(wrapper.find('[data-test="empty-state-panel"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('No itinerary yet');
  });
});
