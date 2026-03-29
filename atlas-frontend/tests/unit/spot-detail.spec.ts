import { mount } from '@vue/test-utils';
import SpotDetail from '@/components/spots/SpotDetail.vue';
import type { SpotDetail as SpotDetailModel } from '@/types';

const spot: SpotDetailModel = {
  id: 'spot-1',
  title: 'Sunset Rooftop Tacos',
  description: 'Street tacos, skyline views, and a late-night crowd.',
  latitude: 32.7555,
  longitude: -97.3308,
  address: '123 Main St',
  city: 'Fort Worth',
  country: 'US',
  category: 'food',
  vibe: 'electric',
  rating: 4.8,
  photoUrl: 'https://images.example.com/spot.jpg',
  createdAt: '2026-03-26T20:00:00Z',
  likesCount: 118,
  photos: [
    { id: 'photo-1', url: 'https://images.example.com/spot.jpg', caption: 'Primary hero shot' },
    { id: 'photo-2', url: 'https://images.example.com/spot-2.jpg', caption: 'Golden hour detail' },
  ],
  reviews: [
    {
      id: 'review-1',
      spotId: 'spot-1',
      rating: 4.9,
      comment: 'Excellent anchor stop for an evening route.',
      createdAt: '2026-03-27T20:00:00Z',
      user: {
        id: 'user-1',
        username: 'maya',
        email: 'maya@example.com',
        displayName: 'Maya Chen',
        interests: ['food'],
      },
    },
  ],
};

describe('SpotDetail', () => {
  it('renders the overview, gallery, reviews, and embedded map context', () => {
    const wrapper = mount(SpotDetail, {
      props: {
        spot,
      },
      global: {
        stubs: {
          MapView: {
            template: '<div data-test="mini-map">Mini map stub</div>',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('Sunset Rooftop Tacos');
    expect(wrapper.text()).toContain('Mini-map');
    expect(wrapper.text()).toContain('2 photos');
    expect(wrapper.text()).toContain('1 review');
    expect(wrapper.text()).toContain('Excellent anchor stop for an evening route.');
    expect(wrapper.find('[data-test="mini-map"]').exists()).toBe(true);
  });
});
