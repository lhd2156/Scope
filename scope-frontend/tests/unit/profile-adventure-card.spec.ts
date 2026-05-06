import { mount } from '@vue/test-utils';
import ProfileAdventureCard from '@/components/profile/ProfileAdventureCard.vue';
import type { Trip } from '@/types';

const trip: Trip = {
  id: 'trip-1',
  title: 'North Texas Night + Food Loop',
  destination: 'Fort Worth, TX',
  description: 'Two days of tacos, skyline views, galleries, and nightlife sequenced for a premium downtown circuit.',
  isPublic: true,
  startDate: '2026-04-01',
  endDate: '2026-04-02',
  spots: [],
  members: [{ id: 'user-1', displayName: 'Louis Do' }],
  coverImageUrl: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920',
  status: 'planning',
};

describe('ProfileAdventureCard', () => {
  it('renders the photo-led recent adventure card layout', () => {
    const wrapper = mount(ProfileAdventureCard, {
      props: {
        trip,
      },
      global: {
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a :href="typeof to === \'string\' ? to : \'/mock\'"><slot /></a>',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('North Texas Night + Food Loop');
    expect(wrapper.text()).toContain('Fort Worth, TX');
    expect(wrapper.text()).toContain('Apr 1 → Apr 2');
    expect(wrapper.text()).toContain('2 days');
    expect(wrapper.text()).toContain('Open trip');
  });
});
