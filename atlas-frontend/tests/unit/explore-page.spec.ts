import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

const { fixtureSpots } = vi.hoisted(() => ({
  fixtureSpots: [
    {
      id: 'spot-1',
      title: 'Sunset Rooftop Tacos',
      latitude: 32.7555,
      longitude: -97.3308,
      category: 'food',
      city: 'Fort Worth',
      country: 'US',
      vibe: 'electric',
      rating: 4.8,
      createdAt: '2026-03-26T20:00:00Z',
    },
    {
      id: 'spot-2',
      title: 'Botanic River Walk',
      latitude: 32.749,
      longitude: -97.363,
      category: 'nature',
      city: 'Fort Worth',
      country: 'US',
      vibe: 'calm',
      rating: 4.7,
      createdAt: '2026-03-24T14:10:00Z',
    },
    {
      id: 'spot-3',
      title: 'Modern Art Garden',
      latitude: 30.2672,
      longitude: -97.7431,
      category: 'culture',
      city: 'Austin',
      country: 'US',
      vibe: 'curated',
      rating: 4.6,
      createdAt: '2026-03-20T16:05:00Z',
    },
  ],
}));

vi.mock('@/services/spotService', () => ({
  listSpots: vi.fn().mockResolvedValue({
    data: fixtureSpots,
    meta: {
      page: 1,
      pageSize: fixtureSpots.length,
      total: fixtureSpots.length,
      totalPages: 1,
    },
  }),
  listTrendingSpots: vi.fn().mockResolvedValue({ data: fixtureSpots.slice(0, 2) }),
  getSpotDetail: vi.fn(),
  createSpot: vi.fn(),
  updateSpot: vi.fn(),
}));

import ExplorePage from '@/views/ExplorePage.vue';

describe('ExplorePage', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('filters the explore grid by search query and category chips', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/explore',
          name: 'explore',
          component: ExplorePage,
        },
      ],
    });

    await router.push('/explore');
    await router.isReady();

    const wrapper = mount(ExplorePage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          SpotCard: {
            props: ['spot'],
            template: '<div class="spot-card-stub">{{ spot.title }}</div>',
          },
        },
      },
    });

    await flushPromises();
    await nextTick();

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('3');
    expect(wrapper.findAll('.spot-card-stub')).toHaveLength(3);

    await wrapper.get('input[aria-label="Search spots"]').setValue('Fort Worth');
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('2');

    await wrapper.get('[data-test="category-chip-food"]').trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('1');
    expect(wrapper.findAll('.spot-card-stub')).toHaveLength(1);

    await wrapper.get('button.button-secondary').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('3');
  });
});
