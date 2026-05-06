import { mount } from '@vue/test-utils';
import SpotCard from '@/components/spots/SpotCard.vue';
import type { SpotSummary } from '@/types';

const spot: SpotSummary = {
  id: 'spot-1',
  title: 'Sunset Rooftop Tacos',
  description: 'Street tacos, skyline views, and a late-night crowd.',
  latitude: 32.7555,
  longitude: -97.3308,
  city: 'Fort Worth',
  country: 'US',
  category: 'food',
  vibe: 'electric',
  rating: 4.8,
  photoUrl: 'https://images.example.com/spot.jpg',
  createdAt: '2026-03-26T20:00:00Z',
  likesCount: 118,
  liked: true,
};

describe('SpotCard', () => {
  it('renders the premium spot summary and detail link', () => {
    const wrapper = mount(SpotCard, {
      props: {
        spot,
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

    expect(wrapper.text()).toContain('Sunset Rooftop Tacos');
    expect(wrapper.text()).toContain('Food');
    expect(wrapper.text()).toContain('Fort Worth, US');
    expect(wrapper.text()).toContain('118 saves');
    expect(wrapper.text()).toContain('View details');
    expect(wrapper.find('a').attributes('href')).toBe('/spots/spot-1');

    const ratingClips = wrapper.find('.rating-pill').findAll('.star-rating__clip');
    expect(ratingClips).toHaveLength(5);
    expect(ratingClips[4].attributes('style')).toContain('width: 80%');
  });
});
