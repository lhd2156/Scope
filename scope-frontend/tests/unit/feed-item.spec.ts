import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, vi } from 'vitest';
import FeedItem from '@/components/social/FeedItem.vue';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toasts';
import type { FeedItem as FeedItemModel } from '@/types';

const item: FeedItemModel = {
  id: 'feed-1',
  type: 'trip',
  actor: {
    id: 'user-1',
    username: 'louisdo',
    email: 'louis@example.com',
    displayName: 'Louis Do',
    homeBase: 'Fort Worth, TX',
    bio: 'Scope planner',
    interests: ['food', 'culture'],
    stats: { spots: 42, trips: 8, friends: 126 },
  },
  title: 'Louis planned North Texas Night + Food Loop',
  excerpt: 'A two-day itinerary built around food, culture, and nightlife.',
  createdAt: '2026-03-26T18:05:00Z',
  imageUrl: 'https://images.example.com/trip.jpg',
  targetId: 'trip-1',
};

describe('FeedItem', () => {
  function createTestRouter() {
    return createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/feed', component: { template: '<div />' } },
        { path: '/login', component: { template: '<div />' } },
        { path: '/trips/:id', component: { template: '<div />' } },
        { path: '/spots/:id', component: { template: '<div />' } },
      ],
    });
  }

  function lazyImageStub() {
    return {
      props: ['src', 'alt'],
      template: '<img class="lazy-image-stub" :src="src" :alt="alt" />',
    };
  }

  function normalizedReviewerAction(wrapper: ReturnType<typeof mount>): string {
    return wrapper.get('.reviewer-action').text().replace(/\s+/g, ' ').trim();
  }

  beforeEach(() => {
    // FeedItem now touches the auth and toast pinia stores (for gated
    // engagement state). Without an active pinia the component throws
    // on setup, so give the test its own scratch store instance.
    setActivePinia(createPinia());
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a premium social feed card with travel media and engagement actions', () => {
    const wrapper = mount(FeedItem, {
      props: {
        item,
      },
      global: {
        stubs: {
          LazyImage: {
            props: ['src', 'alt'],
            template: '<img class="lazy-image-stub" :src="src" :alt="alt" />',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('Planned a route');
    expect(wrapper.text()).toContain('Louis Do planned North Texas Night + Food Loop');
    expect(wrapper.text()).toContain('Route snapshot');
    expect(wrapper.text()).toContain('A two-day itinerary built around food, culture, and nightlife.');
    expect(wrapper.text()).toContain('Trip update');
    expect(wrapper.text()).toContain('Open trip');
    expect(wrapper.findAll('.action-button')).toHaveLength(3);
    expect(wrapper.find('.feed-media .lazy-image-stub').attributes('alt')).toBe('Louis planned North Texas Night + Food Loop');
    expect(wrapper.find('.meta-divider').exists()).toBe(false);
  });

  it('keeps a readable actor name when the activity title already contains a partial name', () => {
    const wrapper = mount(FeedItem, {
      props: {
        item: {
          ...item,
          actor: {
            ...item.actor,
            username: 'maya',
            displayName: 'Maya Chen',
          },
          title: 'Maya pinned Botanic River Walk',
        },
      },
      global: {
        stubs: {
          LazyImage: {
            props: ['src', 'alt'],
            template: '<img class="lazy-image-stub" :src="src" :alt="alt" />',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('Maya Chen pinned Botanic River Walk');
  });

  it('shows the reviewed spot location ahead of the actor home base', () => {
    const wrapper = mount(FeedItem, {
      props: {
        item: {
          ...item,
          type: 'review',
          title: 'Sofia Ramirez reviewed Fort Worth Water Gardens',
          excerpt: '4.8/5: Worth saving because it gives the map a clear anchor.',
          targetId: 'spot-water-gardens',
          targetLocation: 'Fort Worth, TX',
          actor: {
            ...item.actor,
            username: 'sofiaramirez',
            displayName: 'Sofia Ramirez',
            homeBase: 'San Antonio, TX',
          },
        },
      },
      global: {
        stubs: {
          LazyImage: lazyImageStub(),
        },
      },
    });

    expect(normalizedReviewerAction(wrapper)).toBe('Sofia Ramirez (@sofiaramirez) reviewed.');
    expect(wrapper.text()).toContain('Fort Worth Water Gardens');
    expect(wrapper.text()).toContain('Fort Worth, TX');
    expect(wrapper.text()).toContain('Mar 26, 2026');
    expect(wrapper.get('.rating-badge').text()).toContain('4.8/5');
    expect(wrapper.text()).toContain('Worth saving because it gives the map a clear anchor.');
    expect(wrapper.text()).not.toContain('San Antonio, TX');
  });

  it('gates preview and signed-out engagement with helpful toasts and sign-in routing', async () => {
    const router = createTestRouter();
    await router.push('/feed?tab=community');
    await router.isReady();

    const previewWrapper = mount(FeedItem, {
      props: {
        item: {
          ...item,
          type: 'review',
          title: 'Maya completed a review of Botanic River Walk',
          targetId: 'spot-1',
        },
        preview: true,
      },
      global: {
        plugins: [router],
        stubs: {
          LazyImage: lazyImageStub(),
        },
      },
    });
    const toastStore = useToastStore();

    await previewWrapper.get(`[data-test="feed-like-${item.id}"]`).trigger('click');
    expect(toastStore.items[0]).toMatchObject({
      title: 'Scope activity',
    });
    expect(previewWrapper.get(`[data-test="feed-like-${item.id}"]`).attributes('aria-pressed')).toBe('false');
    expect(previewWrapper.get(`[data-test="feed-like-${item.id}"]`).attributes('title')).toContain('Scope activity');
    expect(normalizedReviewerAction(previewWrapper)).toBe('Louis Do (@louisdo) reviewed.');
    expect(previewWrapper.text()).toContain('Botanic River Walk');
    expect(previewWrapper.text()).toContain('Community take');
    expect(previewWrapper.text()).not.toContain('Place review');
    expect(previewWrapper.text()).toContain('Open spot');
    expect(previewWrapper.get('.rating-badge').text()).toContain('Review');

    previewWrapper.unmount();
    toastStore.clearToasts();

    const signedOutWrapper = mount(FeedItem, {
      props: {
        item: {
          ...item,
          title: 'Maya reviewed River Arts District',
        },
      },
      global: {
        plugins: [router],
        stubs: {
          LazyImage: lazyImageStub(),
        },
      },
    });

    await signedOutWrapper.get(`[data-test="feed-share-${item.id}"]`).trigger('click');
    await flushPromises();

    expect(toastStore.items[0]).toMatchObject({
      title: 'Sign in required',
      message: 'Sign in to share this Scope moment with your crew.',
    });
    expect(router.currentRoute.value.path).toBe('/login');
    expect(router.currentRoute.value.query.redirect).toBe('/');
  });

  it('toggles authenticated like and share state and routes comments to the destination', async () => {
    const router = createTestRouter();
    await router.push('/');
    await router.isReady();
    const authStore = useAuthStore();
    authStore.token = 'access-token';
    authStore.currentUser = {
      id: 'user-auth',
      username: 'authuser',
      email: 'auth@example.com',
      displayName: 'Auth User',
      interests: [],
    };

    const wrapper = mount(FeedItem, {
      props: {
        item: {
          ...item,
          type: 'review',
          targetId: 'spot-1',
          title: 'Finished a review of Downtown Food Hall',
          actor: {
            ...item.actor,
            displayName: '',
            username: 'scopefriend',
            homeBase: '',
          },
        },
      },
      global: {
        plugins: [router],
        stubs: {
          LazyImage: lazyImageStub(),
        },
      },
    });

    const likeButton = wrapper.get(`[data-test="feed-like-${item.id}"]`);
    const shareButton = wrapper.get(`[data-test="feed-share-${item.id}"]`);

    expect(normalizedReviewerAction(wrapper)).toBe('scopefriend (@scopefriend) reviewed.');
    expect(wrapper.text()).toContain('Downtown Food Hall');
    expect(wrapper.text()).toContain('Community take');
    expect(wrapper.text()).not.toContain('Place review');
    expect(wrapper.text()).toContain('Scope community');
    expect(likeButton.attributes('title')).toBe('Like');

    await likeButton.trigger('click');
    expect(likeButton.attributes('aria-pressed')).toBe('true');
    expect(likeButton.attributes('title')).toBe('Unlike');

    await shareButton.trigger('click');
    expect(shareButton.attributes('aria-pressed')).toBe('true');
    expect(shareButton.attributes('title')).toBe('Shared');

    await wrapper.get(`[data-test="feed-comment-${item.id}"]`).trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/spots/downtown-food-hall');
  });
});
