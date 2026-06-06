import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import SpotCard from '@/components/spots/SpotCard.vue';
import { useAuthStore } from '@/stores/auth';
import { useSpotsStore } from '@/stores/spots';
import { useToastStore } from '@/stores/toasts';
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
  async function mountSpotCard(spotOverride: SpotSummary, options: { authenticated?: boolean } = {}) {
    const pinia = createPinia();
    setActivePinia(pinia);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/login', component: { template: '<div />' } },
        { path: '/spots/:id', component: { template: '<div />' } },
        { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
      ],
    });

    await router.push('/');
    await router.isReady();

    if (options.authenticated) {
      const authStore = useAuthStore();
      authStore.token = 'unit-token';
      authStore.currentUser = {
        id: 'user-1',
        username: 'unit-user',
        email: 'unit@example.com',
        displayName: 'Unit User',
        interests: ['food'],
      };
    }

    return {
      router,
      authStore: useAuthStore(),
      spotsStore: useSpotsStore(),
      toastStore: useToastStore(),
      wrapper: mount(SpotCard, {
        props: {
          spot: spotOverride,
        },
        global: {
          plugins: [pinia, router],
          stubs: {
            LazyImage: {
              props: ['src', 'fallbackSrc', 'alt'],
              template: '<img class="lazy-image-stub" :src="src" :data-fallback-src="fallbackSrc" :alt="alt" />',
            },
            RouterLink: {
              props: ['to'],
              template: '<a :href="to"><slot /></a>',
            },
          },
        },
      }),
    };
  }

  it('renders the premium spot summary and detail link', async () => {
    const { wrapper } = await mountSpotCard(spot);

    expect(wrapper.text()).toContain('Sunset Rooftop Tacos');
    expect(wrapper.text()).toContain('Food');
    expect(wrapper.text()).toContain('Fort Worth, US');
    expect(wrapper.text()).toContain('118 saves');
    expect(wrapper.text()).toContain('View details');
    expect(wrapper.find('a').attributes('href')).toBe('/spots/sunset-rooftop-tacos-fort-worth');

    const ratingClips = wrapper.find('.rating-pill').findAll('.star-rating__clip');
    expect(ratingClips).toHaveLength(5);
    expect(ratingClips[4].attributes('style')).toContain('width: 80%');
  });

  it('keeps saved state interactive for authenticated users and syncs when the parent updates liked state', async () => {
    const sparseSpot: SpotSummary = {
      ...spot,
      id: 'spot-2',
      title: 'Quiet Route Bench',
      description: '  ',
      city: '',
      country: '',
      category: 'other',
      vibe: '',
      photoUrl: '',
      likesCount: 0,
      liked: false,
    };
    const { spotsStore, wrapper } = await mountSpotCard(sparseSpot, { authenticated: true });
    vi.spyOn(spotsStore, 'toggleLike').mockResolvedValue({
      ...sparseSpot,
      liked: true,
      likesCount: 1,
      photos: [],
      reviews: [],
    });

    expect(wrapper.text()).toContain('Scope community pin');
    expect(wrapper.text()).toContain('New pin');
    expect(wrapper.text()).toContain('Community details are syncing for this spot.');
    expect(wrapper.text()).toContain('Open the full detail view');
    expect(wrapper.find('.save-button').attributes('aria-pressed')).toBe('false');

    await wrapper.get('.save-button').trigger('click');
    expect(wrapper.find('.save-button').classes()).toContain('active');
    expect(wrapper.find('.save-button').attributes('aria-pressed')).toBe('true');
    expect(wrapper.text()).toContain('Saved to your scope');
    expect(spotsStore.toggleLike).toHaveBeenCalledWith('spot-2');

    await wrapper.setProps({ spot: { ...sparseSpot, liked: true } });
    expect(wrapper.find('.save-button').attributes('aria-pressed')).toBe('true');

    await wrapper.setProps({ spot: { ...sparseSpot, liked: false } });
    expect(wrapper.find('.save-button').attributes('aria-pressed')).toBe('false');
  });

  it('prompts guests to sign in before saving', async () => {
    const { router, toastStore, wrapper } = await mountSpotCard({ ...spot, liked: false });

    await wrapper.get('.save-button').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/login');
    expect(router.currentRoute.value.query.redirect).toBe('/');
    expect(toastStore.items[0]).toMatchObject({
      title: 'Sign in to save',
    });
    expect(wrapper.find('.save-button').attributes('aria-pressed')).toBe('false');
  });

  it('credits the author when a spot carries community attribution', async () => {
    const { wrapper } = await mountSpotCard({
      ...spot,
      id: 'spot-3',
      liked: false,
      author: {
        id: 'user-2',
        username: 'maya',
        email: 'maya@example.com',
        displayName: 'Maya Chen',
        interests: [],
      },
    });

    expect(wrapper.text()).toContain('Pinned by Maya Chen');
  });
});
