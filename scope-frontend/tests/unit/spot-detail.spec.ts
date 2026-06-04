import { flushPromises, mount } from '@vue/test-utils';

const { authStoreMock, createSpotReviewMock, fetchSpotMock, listNearbySpotsMock, listSpotReviewsMock, toggleLikeMock } = vi.hoisted(() => ({
  authStoreMock: {
    isAuthenticated: true,
    currentUser: {
      id: 'user-auth',
      username: 'scopefan',
      email: 'scopefan@example.com',
      displayName: 'Scope Fan',
      interests: ['food', 'culture'],
      avatarUrl: 'https://i.pravatar.cc/150?img=18',
    },
  },
  createSpotReviewMock: vi.fn(),
  fetchSpotMock: vi.fn(),
  listNearbySpotsMock: vi.fn(),
  listSpotReviewsMock: vi.fn(),
  toggleLikeMock: vi.fn(),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

vi.mock('@/stores/spots', () => ({
  useSpotsStore: () => ({
    fetchSpot: fetchSpotMock,
    toggleLike: toggleLikeMock,
  }),
}));

vi.mock('@/services/spotService', () => ({
  createSpotReview: createSpotReviewMock,
  listNearbySpots: listNearbySpotsMock,
  listSpotReviews: listSpotReviewsMock,
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

const spotDetailStubs = {
  MapView: {
    template: '<div data-test="mini-map">Mini map stub</div>',
  },
  ReviewForm: {
    emits: ['submit'],
    template: '<button type="button" data-test="submit-review" @click="$emit(\'submit\', { rating: 5, comment: \'Perfect quiet reset.\' })">Submit review</button>',
  },
  ReviewList: {
    props: ['reviews'],
    template: '<div data-test="review-list">{{ reviews.map((review) => review.comment).join(" | ") }}</div>',
  },
};

describe('SpotDetail', () => {
  beforeEach(() => {
    authStoreMock.isAuthenticated = true;
    authStoreMock.currentUser = {
      id: 'user-auth',
      username: 'scopefan',
      email: 'scopefan@example.com',
      displayName: 'Scope Fan',
      interests: ['food', 'culture'],
      avatarUrl: 'https://i.pravatar.cc/150?img=18',
    };
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
    createSpotReviewMock.mockReset();
    createSpotReviewMock.mockResolvedValue({
      id: 'review-new',
      spotId: 'spot-1',
      rating: 5,
      comment: 'Fresh Scope review.',
      createdAt: '2026-03-28T10:00:00Z',
    });
    fetchSpotMock.mockReset();
    fetchSpotMock.mockResolvedValue(undefined);
    listSpotReviewsMock.mockReset();
    listSpotReviewsMock.mockImplementation(async (spotId: string) => ({
      data: spotId === 'spot-1' ? spot.reviews : [],
    }));
    toggleLikeMock.mockReset();
  });

  it('renders the premium gallery, action row, embedded map, and similar spots rail', async () => {
    const wrapper = mount(SpotDetail, {
      props: {
        spot,
      },
      global: {
        stubs: spotDetailStubs,
      },
    });

    await flushPromises();

    expect(wrapper.find('[data-test="spot-gallery"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-test="gallery-thumb"]')).toHaveLength(4);
    expect(wrapper.find('[data-test="spot-photo-count"]').text()).toContain('5 photos');
    expect(wrapper.find('[data-test="spot-photo-curation"]').text()).toContain('Curated travel angles');
    expect(wrapper.find('.hero-gallery__copy').text()).not.toContain('·');
    await wrapper.findAll('[data-test="gallery-thumb"]')[0].trigger('click');
    expect(wrapper.find('.hero-gallery__copy').text()).toContain('Golden hour detail');
    await wrapper.get('.hero-gallery__button').trigger('click');
    expect(wrapper.find('.hero-gallery__copy').text()).toContain('Golden hour detail');

    expect(wrapper.find('[data-test="spot-actions"]').text()).toContain('Add to Trip');
    expect(wrapper.text()).toContain('Sunset Rooftop Tacos');
    expect(wrapper.text()).toContain('Mini-map');
    expect(wrapper.text()).toContain('1 review');
    expect(wrapper.text()).toContain('Excellent anchor stop for an evening route.');
    expect(wrapper.find('[data-test="mini-map"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="similar-spots"]').text()).toContain('Botanic River Walk');

    const reviewSummary = wrapper.find('.reviews-summary');
    expect(reviewSummary.exists()).toBe(true);
    expect(reviewSummary.text()).not.toMatch(/average/i);
    expect(reviewSummary.text()).not.toContain('|');
    expect(reviewSummary.findAll('.star-rating__clip')[4].attributes('style')).toContain('width: 80%');

    const similarRating = wrapper.find('.similar-card__rating');
    expect(similarRating.text()).toContain('4.7');
    expect(similarRating.findAll('.star-rating__clip')[4].attributes('style')).toContain('width: 70%');
  });

  it('shows the login prompt when the traveler is not authenticated', async () => {
    authStoreMock.isAuthenticated = false;

    const wrapper = mount(SpotDetail, {
      props: {
        spot,
      },
      global: {
        stubs: spotDetailStubs,
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('Log in to review');
  });

  it('handles sparse media, local reviews, save toggles, sharing, and similar spot failures', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    (authStoreMock as any).currentUser = null;
    listNearbySpotsMock.mockRejectedValueOnce(new Error('nearby unavailable'));
    const sparseSpot: SpotDetailModel = {
      ...spot,
      id: 'spot-sparse',
      title: 'Quiet Garden Stop',
      category: 'nature',
      rating: 4.4,
      likesCount: 0,
      liked: false,
      photoUrl: undefined,
      photos: [
        { id: 'garden-photo', url: 'https://images.example.com/garden.jpg' },
      ],
      reviews: [],
      address: '',
      city: '',
      country: '',
      vibe: '',
    };
    const submittedReview = {
      id: 'review-new',
      spotId: sparseSpot.id,
      rating: 5,
      comment: 'Perfect quiet reset.',
      createdAt: '2026-03-28T10:00:00Z',
      user: authStoreMock.currentUser,
    };
    listSpotReviewsMock
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [submittedReview] });
    createSpotReviewMock.mockResolvedValueOnce(submittedReview);
    toggleLikeMock
      .mockResolvedValueOnce({ ...sparseSpot, liked: true, likesCount: 1 })
      .mockResolvedValueOnce({ ...sparseSpot, liked: false, likesCount: 0 });

    const wrapper = mount(SpotDetail, {
      props: {
        spot: sparseSpot,
      },
      global: {
        stubs: spotDetailStubs,
      },
    });

    await flushPromises();

    expect(wrapper.findAll('[data-test="gallery-thumb"]')).toHaveLength(4);
    expect(wrapper.text()).toContain('Scope location pending');
    expect(wrapper.text()).toContain('No similar spots yet');
    expect(wrapper.text()).toContain('Fresh saves');
    expect(wrapper.text()).toContain('Flexible discovery stop');

    await wrapper.get('[data-test="submit-review"]').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Perfect quiet reset.');
    expect(wrapper.text()).toContain('Review added');
    await wrapper.get('.toast-close').trigger('click');
    expect(wrapper.text()).not.toContain('Review added');

    const saveButton = wrapper.get('button[aria-label="Save Quiet Garden Stop"]');
    await saveButton.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('1 saves');
    expect(saveButton.attributes('aria-pressed')).toBe('true');
    expect(toggleLikeMock).toHaveBeenCalledWith('spot-sparse');

    await wrapper.get('button[aria-label="Remove Quiet Garden Stop from saved spots"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Fresh saves');

    await wrapper.findAll('button').find((button) => button.text().includes('Share'))!.trigger('click');
    await flushPromises();

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/spots/spot-sparse'));
    expect(wrapper.text()).toContain('Link copied');
    await wrapper.get('.toast-close').trigger('click');
    expect(wrapper.text()).not.toContain('Link copied');

    await wrapper.setProps({ spot: null });
    await flushPromises();

    expect(wrapper.find('[data-test="spot-gallery"]').exists()).toBe(false);
  });
});
