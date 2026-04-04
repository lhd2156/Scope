import { mount } from '@vue/test-utils';
import FeedItem from '@/components/social/FeedItem.vue';
import ProfileHeader from '@/components/profile/ProfileHeader.vue';
import SpotCard from '@/components/spots/SpotCard.vue';
import TripCard from '@/components/trips/TripCard.vue';
import type { FeedItem as FeedItemModel, SpotSummary, Trip, UserProfile } from '@/types';
import { getFeedPhotoFallback, getSpotPhotoFallback, getTripCoverFallback } from '@/utils/demoPhotos';

const lazyImageStub = {
  props: ['src', 'fallbackSrc', 'alt'],
  template: '<img class="lazy-image-stub" :src="src" :data-fallback-src="fallbackSrc" :alt="alt" />',
};

describe('demo photo surfaces', () => {
  it('renders a real fallback image for SpotCard when a spot photo is missing', () => {
    const spot: SpotSummary = {
      id: 'spot-1',
      title: 'Fallback Food Stop',
      latitude: 32.7555,
      longitude: -97.3308,
      category: 'food',
      rating: 4.8,
      createdAt: '2026-03-26T20:00:00Z',
    };

    const wrapper = mount(SpotCard, {
      props: { spot },
      global: {
        stubs: {
          LazyImage: lazyImageStub,
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    expect(wrapper.find('.lazy-image-stub').attributes('src')).toBe(getSpotPhotoFallback('food', 640));
  });

  it('renders a real fallback image for TripCard when a cover image is missing', () => {
    const trip: Trip = {
      id: 'trip-1',
      title: 'Fallback Route Board',
      destination: 'Fort Worth, TX',
      isPublic: true,
      startDate: '2026-04-01',
      endDate: '2026-04-02',
      spots: [
        {
          spotId: 'spot-1',
          title: 'Fallback Food Stop',
          latitude: 32.7555,
          longitude: -97.3308,
          category: 'food',
        },
      ],
      members: [{ id: 'user-1', displayName: 'Louis Do', status: 'owner' }],
    };

    const wrapper = mount(TripCard, {
      props: { trip },
      global: {
        stubs: {
          LazyImage: lazyImageStub,
          RouterLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    });

    expect(wrapper.find('.lazy-image-stub').attributes('src')).toBe(getTripCoverFallback(trip, 720));
  });

  it('renders a real fallback image for FeedItem when attached media is missing', () => {
    const item: FeedItemModel = {
      id: 'feed-1',
      type: 'trip',
      actor: {
        id: 'user-1',
        username: 'louisdo',
        email: 'louis@example.com',
        displayName: 'Louis Do',
        interests: ['food', 'culture'],
      },
      title: 'Louis planned Fallback Route Board',
      excerpt: 'A route with resilient media fallbacks.',
      createdAt: '2026-03-26T18:05:00Z',
      targetId: 'trip-1',
    };

    const wrapper = mount(FeedItem, {
      props: { item },
      global: {
        stubs: {
          LazyImage: lazyImageStub,
          Avatar: {
            props: ['name', 'src', 'size'],
            template: '<div class="avatar-stub" :data-src="src">{{ name }}</div>',
          },
        },
      },
    });

    expect(wrapper.find('.lazy-image-stub').attributes('src')).toBe(getFeedPhotoFallback(item, 960));
  });

  it('renders a real pravatar fallback for ProfileHeader when an avatar is missing', () => {
    const user: UserProfile = {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      interests: ['food', 'culture'],
    };

    const wrapper = mount(ProfileHeader, {
      props: {
        user,
        primaryActionLabel: 'Edit preferences',
        primaryActionTo: '/settings',
      },
      global: {
        stubs: {
          LazyImage: lazyImageStub,
          RouterLink: {
            props: ['to'],
            template: '<a :href="typeof to === \'string\' ? to : \'/mock\'"><slot /></a>',
          },
        },
      },
    });

    expect(wrapper.find('.lazy-image-stub').attributes('src')).toMatch(/^https:\/\/i\.pravatar\.cc\/150\?img=\d+$/);
  });
});
