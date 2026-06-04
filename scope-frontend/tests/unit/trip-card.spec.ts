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
    expect(wrapper.text()).toContain('Apr 1 → Apr 2');
    expect(wrapper.text()).toContain('2 days');
    expect(wrapper.text()).toContain('1 member');
    expect(wrapper.text()).toContain('1 stop');
    expect(wrapper.find('a').attributes('href')).toBe('/trips/trip-1');
  });

  it('toggles saved state and renders private draft fallbacks', async () => {
    const wrapper = mount(TripCard, {
      props: {
        trip: {
          ...trip,
          description: '   ',
          isPublic: false,
          startDate: '2026-04-01',
          endDate: '2026-04-01',
          budget: undefined,
          spots: [],
          members: [],
        },
      },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('Apr 1');
    expect(wrapper.text()).toContain('1 day');
    expect(wrapper.text()).toContain('0 members');
    expect(wrapper.text()).toContain('0 stops');
    expect(wrapper.text()).toContain('Private draft');
    expect(wrapper.text()).toContain('A premium route board is waiting for the first itinerary notes.');
    expect(wrapper.text()).toContain('Ready for itinerary generation');

    const saveButton = wrapper.get('button.save-button');
    expect(saveButton.attributes('aria-pressed')).toBe('false');
    await saveButton.trigger('click');
    expect(saveButton.attributes('aria-pressed')).toBe('true');
    expect(saveButton.attributes('aria-label')).toContain('Remove North Texas Night + Food Loop from saved trips');
  });

  it('formats budget footers with a default currency', () => {
    const wrapper = mount(TripCard, {
      props: {
        trip: {
          ...trip,
          budget: 1200,
          currency: undefined,
        },
      },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('Budget target $1,200');
  });
});
