import { mount } from '@vue/test-utils';
import ReviewList from '@/components/spots/ReviewList.vue';
import type { Review } from '@/types';

const reviews: Review[] = [
  {
    id: 'review-1',
    spotId: 'spot-1',
    user: {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      avatarUrl: 'https://i.pravatar.cc/150?img=12',
      interests: ['food'],
    },
    rating: 4.8,
    comment: 'Perfect rooftop energy right before sunset.',
    createdAt: '2026-03-29T00:00:00Z',
  },
];

describe('ReviewList', () => {
  it('renders review cards with author, star summary, and comment details', () => {
    const wrapper = mount(ReviewList, {
      props: {
        reviews,
      },
    });

    expect(wrapper.text()).toContain('Louis Do');
    expect(wrapper.find('[aria-label="Rated 4.8 out of 5"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('4.8');
    expect(wrapper.text()).toContain('Perfect rooftop energy right before sunset.');
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
});
