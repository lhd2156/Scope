import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, vi } from 'vitest';
import ReviewList from '@/components/spots/ReviewList.vue';
import type { Review } from '@/types';

const { authStoreMock, getUserProfileMock } = vi.hoisted(() => ({
  authStoreMock: {
    isAuthenticated: true,
  },
  getUserProfileMock: vi.fn(),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

vi.mock('@/services/userService', () => ({
  getUserProfile: getUserProfileMock,
}));

const reviews: Review[] = [
  {
    id: 'review-1',
    spotId: 'spot-1',
    user: {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      avatarUrl: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=600',
      interests: ['food'],
    },
    rating: 4.8,
    sentiment_score: 0.1,
    comment: 'Perfect rooftop energy right before sunset.',
    createdAt: '2026-03-29T00:00:00Z',
  },
];

describe('ReviewList', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
    authStoreMock.isAuthenticated = true;
    getUserProfileMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders review cards with author, star summary, and comment details', () => {
    const wrapper = mount(ReviewList, {
      props: {
        reviews,
      },
    });

    expect(wrapper.text()).toContain('Louis Do');
    expect(wrapper.text()).toContain('@louisdo');
    expect(wrapper.text()).toContain('Mar 29, 2026');
    expect(wrapper.find('[aria-label="Rated 4.8 out of 5"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('4.8');
    expect(wrapper.text()).not.toContain('Mixed');
    expect(wrapper.text()).toContain('Perfect rooftop energy right before sunset');
    expect(wrapper.text()).not.toContain('Perfect rooftop energy right before sunset.');
    expect(getUserProfileMock).not.toHaveBeenCalled();

    const ratingClips = wrapper.find('.review-rating').findAll('.star-rating__clip');
    expect(ratingClips).toHaveLength(5);
    expect(ratingClips[4].attributes('style')).toContain('width: 80%');
  });

  it('hydrates generated reviewer placeholders with the latest Core profile for signed-in viewers', async () => {
    const userId = '22222222-2222-4222-8222-222222222222';
    getUserProfileMock.mockResolvedValueOnce({
      data: {
        id: userId,
        username: 'fresh.traveler',
        email: '',
        displayName: 'Fresh Traveler',
        avatarUrl: 'https://cdn.example.com/fresh-avatar.webp',
        interests: ['culture'],
      },
    });

    const wrapper = mount(ReviewList, {
      props: {
        reviews: [
          {
            ...reviews[0],
            id: 'review-generated',
            user: {
              id: userId,
              username: 'traveler-22222222',
              email: '',
              displayName: 'Traveler 22222222',
              avatarUrl: '',
              interests: [],
            },
          },
        ],
      },
    });

    await flushPromises();

    expect(getUserProfileMock).toHaveBeenCalledWith(userId);
    expect(wrapper.text()).toContain('Fresh Traveler');
    expect(wrapper.text()).toContain('@fresh.traveler');
    expect(wrapper.find('.review-author__avatar img').attributes('src')).toBe('https://cdn.example.com/fresh-avatar.webp');
  });

  it('keeps generated reviewer fallbacks for guests without making profile calls', async () => {
    authStoreMock.isAuthenticated = false;

    const wrapper = mount(ReviewList, {
      props: {
        reviews: [
          {
            ...reviews[0],
            id: 'review-guest',
            user: {
              id: '33333333-3333-4333-8333-333333333333',
              username: 'traveler-33333333',
              email: '',
              displayName: 'Traveler 33333333',
              avatarUrl: '',
              interests: [],
            },
          },
        ],
      },
    });

    await flushPromises();

    expect(getUserProfileMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Traveler 33333333');
  });

  it('renders anonymous reviews without hydrating the real reviewer profile', async () => {
    const wrapper = mount(ReviewList, {
      props: {
        reviews: [
          {
            ...reviews[0],
            id: 'review-anonymous',
            isAnonymous: true,
            user: {
              id: 'anonymous',
              username: 'anonymous',
              email: '',
              displayName: 'Anonymous traveler',
              avatarUrl: '',
              interests: [],
            },
          },
        ],
      },
    });

    await flushPromises();

    expect(getUserProfileMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Anonymous traveler');
    expect(wrapper.text()).toContain('Anonymous contribution');
    expect(wrapper.text()).not.toContain('@anonymous');
  });

  it('renders the empty state when no reviews are available', () => {
    const wrapper = mount(ReviewList, {
      props: {
        reviews: [],
      },
    });

    expect(wrapper.text()).toContain('No reviews yet');
    expect(wrapper.text()).toContain('Be the first traveler');
  });

  it('leaves comments without a single trailing sentence period unchanged', () => {
    const wrapper = mount(ReviewList, {
      props: {
        reviews: [
          {
            ...reviews[0],
            id: 'review-2',
            comment: 'Still delightful..',
          },
        ],
      },
    });

    expect(wrapper.text()).toContain('Still delightful..');
  });
});
