import { flushPromises, mount } from '@vue/test-utils';

const { authStoreMock, createSpotReviewMock, fetchSpotMock, listNearbySpotsMock, listSpotReviewsMock, routerPushMock, toastStoreMock, toggleLikeMock } = vi.hoisted(() => ({
  authStoreMock: {
    isAuthenticated: true,
    currentUser: {
      id: 'user-auth',
      username: 'scopefan',
      email: 'scopefan@example.com',
      displayName: 'Scope Fan',
      interests: ['food', 'culture'],
      avatarUrl: 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=600',
    },
  },
  createSpotReviewMock: vi.fn(),
  fetchSpotMock: vi.fn(),
  listNearbySpotsMock: vi.fn(),
  listSpotReviewsMock: vi.fn(),
  routerPushMock: vi.fn(),
  toastStoreMock: {
    showInfo: vi.fn(),
  },
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

vi.mock('@/stores/toasts', () => ({
  useToastStore: () => toastStoreMock,
}));

vi.mock('@/services/spotService', () => ({
  createSpotReview: createSpotReviewMock,
  listNearbySpots: listNearbySpotsMock,
  listSpotReviews: listSpotReviewsMock,
}));

vi.mock('vue-router', () => ({
  RouterLink: {
    props: ['to'],
    template: '<a :href="typeof to === \'string\' ? to : to?.path"><slot /></a>',
  },
  useRouter: () => ({
    push: routerPushMock,
  }),
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
        avatarUrl: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=600',
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
    template: '<div data-test="review-list">{{ reviews.map((review) => `${review.user?.displayName ?? "No user"}:${review.user?.avatarUrl ?? ""}:${review.comment}`).join(" | ") }}</div>',
  },
};

describe('SpotDetail', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    authStoreMock.isAuthenticated = true;
    authStoreMock.currentUser = {
      id: 'user-auth',
      username: 'scopefan',
      email: 'scopefan@example.com',
      displayName: 'Scope Fan',
      interests: ['food', 'culture'],
      avatarUrl: 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=600',
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
    routerPushMock.mockReset();
    routerPushMock.mockResolvedValue(undefined);
    toastStoreMock.showInfo.mockReset();
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
    expect(wrapper.findAll('[data-test="gallery-empty-slot"]')).toHaveLength(0);
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
    expect(reviewSummary.text()).toContain('4.9');
    expect(reviewSummary.text()).not.toMatch(/average/i);
    expect(reviewSummary.text()).not.toContain('|');
    expect(reviewSummary.findAll('.star-rating__clip')[4].attributes('style')).toContain('width: 90%');

    const similarRating = wrapper.find('.similar-card__rating');
    expect(similarRating.text()).toContain('4.7');
    expect(similarRating.findAll('.star-rating__clip')[4].attributes('style')).toContain('width: 70%');
  });

  it('deduplicates repeated gallery URLs without padding missing thumbnail slots', async () => {
    const duplicateGallerySpot: SpotDetailModel = {
      ...spot,
      id: 'spot-duplicate-gallery',
      title: 'River Walk Blue Hour',
      photoUrl: 'https://images.example.com/river-walk.jpg?auto=compress&w=1600',
      photos: [
        {
          id: 'river-main',
          url: 'https://images.example.com/river-walk.jpg?auto=compress&w=720',
          caption: 'River walk hero angle',
        },
        {
          id: 'river-extra-1',
          url: 'https://images.example.com/river-walk-side.jpg',
          caption: 'Side bridge detail',
        },
        {
          id: 'river-extra-2',
          url: 'https://images.example.com/river-walk-lights.jpg',
          caption: 'Blue hour lights',
        },
        {
          id: 'river-extra-2-duplicate',
          url: 'https://images.example.com/river-walk-lights.jpg?auto=compress&w=480',
          caption: 'Duplicate blue hour lights',
        },
      ],
      reviews: [],
    };

    const wrapper = mount(SpotDetail, {
      props: {
        spot: duplicateGallerySpot,
      },
      global: {
        stubs: spotDetailStubs,
      },
    });

    await flushPromises();

    expect(wrapper.find('[data-test="spot-photo-count"]').text()).toContain('3 photos');
    expect(wrapper.findAll('[data-test="gallery-thumb"]')).toHaveLength(2);
    expect(wrapper.findAll('[data-test="gallery-empty-slot"]')).toHaveLength(0);
    expect(wrapper.findAll('.thumbnail-card__empty-icon')).toHaveLength(0);
    expect(wrapper.text()).toContain('Side bridge detail');
    expect(wrapper.text()).toContain('Blue hour lights');
    expect(wrapper.text()).not.toContain('Duplicate blue hour lights');

    await wrapper.findAll('[data-test="gallery-thumb"]')[0].trigger('click');
    expect(wrapper.find('.hero-gallery__copy').text()).toContain('Side bridge detail');
  });

  it('uses a view-all tile when a spot has more than five photos', async () => {
    const largeGallerySpot: SpotDetailModel = {
      ...spot,
      id: 'spot-large-gallery',
      title: 'Full Gallery Stop',
      photoUrl: 'https://images.example.com/full-main.jpg',
      photos: [
        { id: 'full-main', url: 'https://images.example.com/full-main.jpg', caption: 'Main view' },
        { id: 'full-extra-1', url: 'https://images.example.com/full-extra-1.jpg', caption: 'Entry angle' },
        { id: 'full-extra-2', url: 'https://images.example.com/full-extra-2.jpg', caption: 'Side angle' },
        { id: 'full-extra-3', url: 'https://images.example.com/full-extra-3.jpg', caption: 'Table angle' },
        { id: 'full-extra-4', url: 'https://images.example.com/full-extra-4.jpg', caption: 'Corner angle' },
        { id: 'full-extra-5', url: 'https://images.example.com/full-extra-5.jpg', caption: 'Street angle' },
        { id: 'full-extra-6', url: 'https://images.example.com/full-extra-6.jpg', caption: 'Night angle' },
      ],
    };

    const wrapper = mount(SpotDetail, {
      props: {
        spot: largeGallerySpot,
      },
      global: {
        stubs: spotDetailStubs,
      },
    });

    await flushPromises();

    expect(wrapper.find('[data-test="spot-photo-count"]').text()).toContain('7 photos');
    expect(wrapper.findAll('[data-test="gallery-thumb"]')).toHaveLength(3);
    expect(wrapper.findAll('[data-test="gallery-empty-slot"]')).toHaveLength(0);
    expect(wrapper.get('[data-test="gallery-view-all"]').element.tagName).toBe('BUTTON');
    expect(wrapper.get('[data-test="gallery-view-all"]').text()).toContain('7 photos');

    await wrapper.get('[data-test="gallery-view-all"]').trigger('click');
    await flushPromises();

    expect(document.body.textContent).toContain('All photos');
    expect(document.body.textContent).toContain('Main view');
    expect(document.body.textContent).toContain('Night angle');

    const nightAngleButton = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.spot-gallery-dialog__thumb'))
      .find((button) => button.textContent?.includes('Night angle'));
    expect(nightAngleButton).toBeTruthy();
    nightAngleButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await wrapper.vm.$nextTick();
    expect(document.body.textContent).toContain('Night angle');
  });

  it('uses a clean hero placeholder when no real spot photos are available', async () => {
    const noPhotoSpot: SpotDetailModel = {
      ...spot,
      id: 'spot-no-photo',
      title: 'Quiet Plaza Corner',
      category: 'culture',
      photoUrl: undefined,
      photos: [],
      reviews: [],
    };

    const wrapper = mount(SpotDetail, {
      props: {
        spot: noPhotoSpot,
      },
      global: {
        stubs: spotDetailStubs,
      },
    });

    await flushPromises();

    expect(wrapper.find('.hero-gallery__placeholder').exists()).toBe(true);
    expect(wrapper.find('.hero-gallery__placeholder').text()).toContain('Culture');
    expect(wrapper.find('[data-test="spot-photo-count"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-test="gallery-thumb"]')).toHaveLength(0);
    expect(wrapper.findAll('[data-test="gallery-empty-slot"]')).toHaveLength(0);
    expect(wrapper.findAll('.thumbnail-card__empty-icon')).toHaveLength(0);
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

  it('keeps starter reviews visible without alarming travelers when live review refresh fails', async () => {
    listSpotReviewsMock.mockRejectedValueOnce(new Error('reviews unavailable'));

    const wrapper = mount(SpotDetail, {
      props: {
        spot,
      },
      global: {
        stubs: spotDetailStubs,
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('Excellent anchor stop for an evening route.');
    expect(wrapper.text()).not.toContain('Scope could not refresh live reviews right now.');
  });

  it('shows the live review refresh issue when no fallback reviews are available', async () => {
    listSpotReviewsMock.mockRejectedValueOnce(new Error('reviews unavailable'));

    const wrapper = mount(SpotDetail, {
      props: {
        spot: {
          ...spot,
          reviews: [],
        },
      },
      global: {
        stubs: spotDetailStubs,
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('Scope could not refresh live reviews right now.');
  });

  it('uses the latest signed-in identity for current user reviews returned with stale profile data', async () => {
    authStoreMock.currentUser = {
      id: 'user-auth',
      username: 'launch-ready',
      email: 'launch-ready@example.com',
      displayName: 'Launch Ready Louis',
      interests: ['food', 'culture'],
      avatarUrl: 'https://images.example.com/avatar-updated.jpg',
    };
    listSpotReviewsMock.mockResolvedValueOnce({
      data: [
        {
          id: 'review-current-user',
          spotId: 'spot-1',
          rating: 5,
          comment: 'Identity should stay fresh after settings save.',
          createdAt: '2026-03-29T10:00:00Z',
          user: {
            id: 'user-auth',
            username: 'traveler-user-auth',
            email: '',
            displayName: 'Traveler user-aut',
            interests: [],
            avatarUrl: '',
          },
        },
      ],
    });

    const wrapper = mount(SpotDetail, {
      props: {
        spot,
      },
      global: {
        stubs: spotDetailStubs,
      },
    });

    await flushPromises();

    const reviewListText = wrapper.get('[data-test="review-list"]').text();
    expect(reviewListText).toContain('Launch Ready Louis');
    expect(reviewListText).toContain('https://images.example.com/avatar-updated.jpg');
    expect(reviewListText).toContain('Identity should stay fresh after settings save.');
  });

  it('refreshes an existing spot after another review updates its live average', async () => {
    const secondReview = {
      id: 'review-2',
      spotId: 'spot-1',
      rating: 4.1,
      comment: 'Second traveler changed the public average.',
      createdAt: '2026-03-29T11:00:00Z',
      user: {
        id: 'user-2',
        username: 'jordan',
        email: 'jordan@example.com',
        displayName: 'Jordan Reed',
        interests: ['nature'],
        avatarUrl: 'https://images.example.com/jordan.jpg',
      },
    };
    listSpotReviewsMock
      .mockResolvedValueOnce({ data: spot.reviews })
      .mockResolvedValueOnce({ data: [...spot.reviews, secondReview] });

    const wrapper = mount(SpotDetail, {
      props: {
        spot,
      },
      global: {
        stubs: spotDetailStubs,
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('1 review');
    expect(wrapper.get('.reviews-summary__score').text()).toBe('4.9');

    await wrapper.get('[data-test="submit-review"]').trigger('click');
    await flushPromises();

    expect(createSpotReviewMock).toHaveBeenCalledWith('spot-1', {
      rating: 5,
      comment: 'Perfect quiet reset.',
    });
    expect(listSpotReviewsMock).toHaveBeenCalledTimes(2);
    expect(fetchSpotMock).toHaveBeenCalledWith('spot-1');
    expect(wrapper.text()).toContain('2 reviews');
    expect(wrapper.text()).toContain('Second traveler changed the public average.');
    expect(wrapper.get('.reviews-summary__score').text()).toBe('4.5');
  });

  it('shows a clean error when review publishing fails', async () => {
    createSpotReviewMock.mockRejectedValueOnce(new Error('review publish failed'));

    const wrapper = mount(SpotDetail, {
      props: {
        spot,
      },
      global: {
        stubs: spotDetailStubs,
      },
    });

    await flushPromises();
    await wrapper.get('[data-test="submit-review"]').trigger('click');
    await flushPromises();

    expect(createSpotReviewMock).toHaveBeenCalledWith('spot-1', {
      rating: 5,
      comment: 'Perfect quiet reset.',
    });
    expect(wrapper.text()).toContain('Scope could not publish that review right now.');
    expect(wrapper.text()).toContain('Excellent anchor stop for an evening route.');
  });

  it('routes guests to login when they try to save a readable spot', async () => {
    authStoreMock.isAuthenticated = false;

    const wrapper = mount(SpotDetail, {
      props: {
        spot: { ...spot, liked: false },
      },
      global: {
        stubs: spotDetailStubs,
      },
    });

    await flushPromises();
    await wrapper.get('button[aria-label="Save Sunset Rooftop Tacos"]').trigger('click');
    await flushPromises();

    expect(toastStoreMock.showInfo).toHaveBeenCalledWith({
      title: 'Sign in to save',
      message: 'Create an account or log in to keep this spot in your saved places.',
    });
    expect(routerPushMock).toHaveBeenCalledWith({
      path: '/login',
      query: {
        redirect: '/spots/sunset-rooftop-tacos-fort-worth',
        intent: 'save',
      },
    });
    expect(toggleLikeMock).not.toHaveBeenCalled();
  });

  it('rolls the saved state back when the API cannot persist a save toggle', async () => {
    toggleLikeMock.mockRejectedValueOnce(new Error('like unavailable'));

    const wrapper = mount(SpotDetail, {
      props: {
        spot: { ...spot, liked: false, likesCount: 12 },
      },
      global: {
        stubs: spotDetailStubs,
      },
    });

    await flushPromises();

    const saveButton = wrapper.get('button[aria-label="Save Sunset Rooftop Tacos"]');
    await saveButton.trigger('click');
    await flushPromises();

    expect(toggleLikeMock).toHaveBeenCalledWith('spot-1');
    expect(wrapper.get('button[aria-label="Save Sunset Rooftop Tacos"]').attributes('aria-pressed')).toBe('false');
    expect(wrapper.text()).toContain('12 saves');
  });

  it('ignores duplicate save clicks while the save request is still in flight', async () => {
    let resolveToggle!: (value: SpotDetailModel) => void;
    toggleLikeMock.mockImplementationOnce(() => new Promise<SpotDetailModel>((resolve) => {
      resolveToggle = resolve;
    }));

    const wrapper = mount(SpotDetail, {
      props: {
        spot: { ...spot, liked: false, likesCount: 12 },
      },
      global: {
        stubs: spotDetailStubs,
      },
    });

    await flushPromises();

    const saveButton = wrapper.get('button[aria-label="Save Sunset Rooftop Tacos"]');
    await saveButton.trigger('click');
    saveButton.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(toggleLikeMock).toHaveBeenCalledTimes(1);

    resolveToggle({ ...spot, liked: true, likesCount: 13 });
    await flushPromises();

    expect(wrapper.get('button[aria-label="Remove Sunset Rooftop Tacos from saved spots"]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.text()).toContain('13 saves');
  });

  it('shows share feedback even when the browser clipboard API is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });

    const wrapper = mount(SpotDetail, {
      props: {
        spot,
      },
      global: {
        stubs: spotDetailStubs,
      },
    });

    await flushPromises();
    await wrapper.findAll('button').find((button) => button.text().includes('Share'))!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Link copied');
  });

  it('resets the active gallery image when a new spot has a different photo set', async () => {
    const wrapper = mount(SpotDetail, {
      props: {
        spot,
      },
      global: {
        stubs: spotDetailStubs,
      },
    });

    await flushPromises();
    await wrapper.findAll('[data-test="gallery-thumb"]')[1].trigger('click');
    expect(wrapper.find('.hero-gallery__copy').text()).toContain('Cocktail pass');

    await wrapper.setProps({
      spot: {
        ...spot,
        id: 'spot-fresh-gallery',
        title: 'Fresh Gallery Stop',
        photoUrl: 'https://images.example.com/fresh-main.jpg',
        photos: [
          { id: 'fresh-main', url: 'https://images.example.com/fresh-main.jpg', caption: 'Fresh hero angle' },
          { id: 'fresh-extra', url: 'https://images.example.com/fresh-extra.jpg', caption: 'Fresh side angle' },
        ],
      },
    });
    await flushPromises();

    expect(wrapper.find('.hero-gallery__copy').text()).toContain('Fresh hero angle');
    expect(wrapper.findAll('[data-test="gallery-thumb"]')).toHaveLength(1);
    expect(wrapper.findAll('[data-test="gallery-empty-slot"]')).toHaveLength(0);
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

    expect(wrapper.find('[data-test="spot-photo-count"]').text()).toContain('1 photo');
    expect(wrapper.findAll('[data-test="gallery-thumb"]')).toHaveLength(0);
    expect(wrapper.findAll('[data-test="gallery-empty-slot"]')).toHaveLength(0);
    expect(wrapper.findAll('.thumbnail-card__empty-icon')).toHaveLength(0);
    expect(wrapper.text()).toContain('Location syncing');
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

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/spots/quiet-garden-stop'));
    expect(wrapper.text()).toContain('Link copied');
    await wrapper.get('.toast-close').trigger('click');
    expect(wrapper.text()).not.toContain('Link copied');

    await wrapper.setProps({ spot: null });
    await flushPromises();

    expect(wrapper.find('[data-test="spot-gallery"]').exists()).toBe(false);
  });
});
