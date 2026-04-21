import { flushPromises, mount } from '@vue/test-utils';

const { authStoreMock, listNearbySpotsMock } = vi.hoisted(() => ({
  authStoreMock: {
    isAuthenticated: true,
    currentUser: {
      id: 'user-auth',
      username: 'atlasfan',
      email: 'atlasfan@example.com',
      displayName: 'Atlas Fan',
      interests: ['food', 'culture'],
      avatarUrl: 'https://i.pravatar.cc/150?img=18',
    },
  },
  listNearbySpotsMock: vi.fn(),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

vi.mock('@/services/spotService', () => ({
  listNearbySpots: listNearbySpotsMock,
}));

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
  liked: true,
  photos: [
    { id: 'photo-1', url: 'https://images.example.com/spot.jpg', caption: 'Primary hero shot' },
    { id: 'photo-2', url: 'https://images.example.com/spot-2.jpg', caption: 'Golden hour detail' },
    { id: 'photo-3', url: 'https://images.example.com/spot-3.jpg', caption: 'Cocktail pass' },
    { id: 'photo-4', url: 'https://images.example.com/spot-4.jpg', caption: 'Dining room angle' },
    { id: 'photo-5', url: 'https://images.example.com/spot-5.jpg', caption: 'Night skyline frame' },
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
        avatarUrl: 'https://i.pravatar.cc/150?img=32',
      },
    },
  ],
};

describe('SpotDetail', () => {
  beforeEach(() => {
    authStoreMock.isAuthenticated = true;
    listNearbySpotsMock.mockResolvedValue({
      data: [
        {
          id: 'spot-2',
          title: 'Botanic River Walk',
          latitude: 32.749,
          longitude: -97.363,
          category: 'nature',
          city: 'Fort Worth',
          country: 'US',
          rating: 4.7,
          createdAt: '2026-03-24T14:10:00Z',
          photoUrl: 'https://images.example.com/nearby.jpg',
        },
      ],
    });
  });

  it('renders the premium gallery, action row, embedded map, and similar spots rail', async () => {
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

    await flushPromises();

    expect(wrapper.find('[data-test="spot-gallery"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-test="gallery-thumb"]')).toHaveLength(4);
    expect(wrapper.find('[data-test="spot-actions"]').text()).toContain('Add to Trip');
    expect(wrapper.text()).toContain('Sunset Rooftop Tacos');
    expect(wrapper.text()).toContain('Mini-map');
    expect(wrapper.text()).toContain('1 review');
    expect(wrapper.text()).toContain('Excellent anchor stop for an evening route.');
    expect(wrapper.find('[data-test="mini-map"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="similar-spots"]').text()).toContain('Botanic River Walk');
  });

  it('shows the login prompt when the traveler is not authenticated', async () => {
    authStoreMock.isAuthenticated = false;

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

    await flushPromises();

    expect(wrapper.text()).toContain('Log in to review');
  });
});
