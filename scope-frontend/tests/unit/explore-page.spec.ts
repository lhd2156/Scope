import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

const ORIGINAL_INNER_WIDTH = window.innerWidth;

const { fixtureSpots, listSpotsMock, listTrendingSpotsMock } = vi.hoisted(() => ({
  fixtureSpots: [
    {
      id: 'spot-1',
      title: 'Sunset Rooftop Tacos',
      description: 'Street tacos, skyline views, and a late-night crowd.',
      latitude: 32.7555,
      longitude: -97.3308,
      category: 'food',
      city: 'Fort Worth',
      country: 'US',
      vibe: 'electric',
      rating: 4.8,
      photoUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
      likesCount: 88,
      createdAt: '2026-03-26T20:00:00Z',
      author: {
        id: 'user-1',
        username: 'louisdo',
        email: 'louis@example.com',
        displayName: 'Louis Do',
        interests: ['food'],
      },
    },
    {
      id: 'spot-2',
      title: 'Botanic River Walk',
      description: 'A scenic river trail with sunrise light and glassy water.',
      latitude: 32.749,
      longitude: -97.363,
      category: 'nature',
      city: 'Fort Worth',
      country: 'US',
      vibe: 'calm',
      rating: 4.7,
      photoUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
      likesCount: 63,
      createdAt: '2026-03-24T14:10:00Z',
      author: {
        id: 'user-2',
        username: 'maya',
        email: 'maya@example.com',
        displayName: 'Maya Chen',
        interests: ['nature'],
      },
    },
    {
      id: 'spot-3',
      title: 'Modern Art Garden',
      description: 'Sculptures, reflective pools, and a clean architectural backdrop.',
      latitude: 30.2672,
      longitude: -97.7431,
      category: 'culture',
      city: 'Austin',
      country: 'US',
      vibe: 'curated',
      rating: 4.6,
      photoUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800',
      likesCount: 41,
      createdAt: '2026-03-20T16:05:00Z',
      author: {
        id: 'user-3',
        username: 'elijah',
        email: 'elijah@example.com',
        displayName: 'Elijah Brooks',
        interests: ['culture'],
      },
    },
  ],
  listSpotsMock: vi.fn(),
  listTrendingSpotsMock: vi.fn(),
}));

vi.mock('@/services/spotService', () => ({
  listSpots: listSpotsMock,
  listTrendingSpots: listTrendingSpotsMock,
  getSpotDetail: vi.fn(),
  createSpot: vi.fn(),
  updateSpot: vi.fn(),
}));

import ExplorePage from '@/views/ExplorePage.vue';
import { useMapStore } from '@/stores/map';

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

function buildRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/explore',
        name: 'explore',
        component: ExplorePage,
      },
      {
        path: '/map',
        name: 'map',
        component: { template: '<div>Map</div>' },
      },
      {
        path: '/spots/:id',
        name: 'spot-detail',
        component: { template: '<div>Spot detail</div>' },
      },
    ],
  });
}

async function mountExplorePage(options?: { mobile?: boolean }) {
  setViewportWidth(options?.mobile ? 390 : 1280);

  const router = buildRouter();
  await router.push('/explore');
  await router.isReady();

  const wrapper = mount(ExplorePage, {
    global: {
      plugins: [router],
      stubs: {
        AppShell: { template: '<div><slot /></div>' },
        LazyImage: {
          props: ['src', 'alt'],
          template: '<img class="lazy-image-stub" :src="src" :alt="alt" />',
        },
      },
    },
  });

  await flushPromises();
  await nextTick();

  return { wrapper, router };
}

describe('ExplorePage', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    setViewportWidth(1280);
    listSpotsMock.mockReset().mockResolvedValue({
      data: fixtureSpots,
      meta: {
        page: 1,
        pageSize: fixtureSpots.length,
        total: fixtureSpots.length,
        totalPages: 1,
      },
    });
    listTrendingSpotsMock.mockReset().mockResolvedValue({ data: fixtureSpots.slice(0, 2) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(() => {
    setViewportWidth(ORIGINAL_INNER_WIDTH);
  });

  it('filters the explore grid by search query and category chips', async () => {
    const { wrapper } = await mountExplorePage();
    const mapStore = useMapStore();

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('3');
    expect(wrapper.findAll('[data-test="explore-card"]')).toHaveLength(3);

    await wrapper.get('input[aria-label="Search spots"]').setValue('Fort Worth');
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('2');

    await wrapper.get('[data-test="category-chip-food"]').trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('1');
    expect(wrapper.findAll('[data-test="explore-card"]')).toHaveLength(1);
    expect(mapStore.activeCategories).toEqual(['food']);

    await wrapper.get('[data-test="category-chip-nature"]').trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('2');
    expect(wrapper.findAll('[data-test="explore-card"]')).toHaveLength(2);
    expect(mapStore.activeCategories).toEqual(['food', 'nature']);

    await wrapper.get('input[aria-label="Search spots"]').setValue('Kyoto');
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    expect(wrapper.text()).toContain('No spots match the current filters');
    expect(wrapper.find('[data-test="empty-state-panel"]').exists()).toBe(true);

    await wrapper.get('.clear-filters').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('3');
    expect(mapStore.activeCategories).toEqual([
      'food',
      'nature',
      'nightlife',
      'culture',
      'adventure',
      'shopping',
      'scenic',
      'other',
    ]);
  });

  it('shares multi-selected explore categories with the map route', async () => {
    const { wrapper, router } = await mountExplorePage();
    const mapStore = useMapStore();

    await wrapper.get('[data-test="category-chip-food"]').trigger('click');
    await nextTick();
    await wrapper.get('[data-test="category-chip-culture"]').trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="category-chip-all"]').classes()).not.toContain('active');
    expect(wrapper.get('[data-test="results-count"]').text()).toBe('2');
    expect(mapStore.activeCategories).toEqual(['food', 'culture']);

    await wrapper.get('[data-test="category-chip-all"]').trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="category-chip-all"]').classes()).toContain('active');
    expect(wrapper.get('[data-test="category-chip-food"]').classes()).not.toContain('active');
    expect(wrapper.get('[data-test="category-chip-culture"]').classes()).not.toContain('active');
    expect(wrapper.get('[data-test="results-count"]').text()).toBe('3');
    expect(mapStore.activeCategories).toHaveLength(8);

    await wrapper.get('[data-test="category-chip-food"]').trigger('click');
    await nextTick();
    expect(wrapper.get('.view-toggle a[to="/map"]').exists()).toBe(true);
    await router.push('/map');
    await flushPromises();

    expect(router.currentRoute.value.name).toBe('map');
    expect(mapStore.activeCategories).toEqual(['food']);
  });

  it('filters large city sets by state before city selection', async () => {
    const expandedSpots = [
      ...fixtureSpots,
      {
        id: 'spot-4',
        title: 'Lakefront Sunrise Loop',
        description: 'A skyline path with lake views and morning light.',
        latitude: 41.8781,
        longitude: -87.6298,
        category: 'scenic',
        city: 'Chicago',
        country: 'US',
        vibe: 'cinematic',
        rating: 4.9,
        photoUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800',
        likesCount: 55,
        createdAt: '2026-03-22T12:00:00Z',
        author: {
          id: 'user-4',
          username: 'avery',
          email: 'avery@example.com',
          displayName: 'Avery Stone',
          interests: ['scenic'],
        },
      },
    ];
    listSpotsMock.mockResolvedValueOnce({
      data: expandedSpots,
      meta: {
        page: 1,
        pageSize: expandedSpots.length,
        total: expandedSpots.length,
        totalPages: 1,
      },
    });

    const { wrapper } = await mountExplorePage();

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('4');
    expect(wrapper.findAll('[data-test="city-chip"]').map((chip) => chip.text())).toEqual([
      'Austin, TX',
      'Chicago, IL',
      'Fort Worth, TX',
    ]);

    await wrapper.get('[data-test="state-filter-button"]').trigger('click');
    await wrapper.findAll('[data-test="state-filter-option"]').find((option) => option.text().includes('TX'))?.trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('3');
    expect(wrapper.findAll('[data-test="city-chip"]').map((chip) => chip.text())).toEqual([
      'Austin, TX',
      'Fort Worth, TX',
    ]);
    expect(wrapper.get('.quick-filter-actions [data-test="state-reset-location"]').text()).toContain('Reset location');
    expect(
      wrapper.find('.quick-filter-actions').element.firstElementChild?.getAttribute('data-test'),
    ).toBe('state-reset-location');

    await wrapper.get('[data-test="state-reset-location"]').trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('4');
    expect(wrapper.find('[data-test="state-reset-location"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-test="city-chip"]').map((chip) => chip.text())).toEqual([
      'Austin, TX',
      'Chicago, IL',
      'Fort Worth, TX',
    ]);

    await wrapper.get('[data-test="state-filter-button"]').trigger('click');
    await wrapper.findAll('[data-test="state-filter-option"]').find((option) => option.text().includes('IL'))?.trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('1');
    expect(wrapper.findAll('[data-test="city-chip"]').map((chip) => chip.text())).toEqual(['Chicago, IL']);
  });

  it('renders a ranked trending sidebar from the loaded explore dataset', async () => {
    const { wrapper } = await mountExplorePage();

    const trendingItems = wrapper.findAll('[data-test="trending-item"]');

    expect(trendingItems).toHaveLength(3);
    expect(trendingItems[0].text()).toContain('#1');
    expect(trendingItems[0].text()).toContain('Sunset Rooftop Tacos');
    expect(trendingItems[1].text()).toContain('#2');
  });

  it('switches to the mobile single-column explore layout at the shared breakpoint', async () => {
    const { wrapper } = await mountExplorePage({ mobile: true });

    expect(wrapper.get('.explore-page').attributes('data-explore-layout')).toBe('mobile');
    expect(wrapper.get('[data-test="explore-results"]').attributes('data-results-layout')).toBe('single-column');
    expect(wrapper.get('[data-test="trending-panel"]').attributes('data-trending-layout')).toBe('stacked');
  });

  it('shows reusable spot skeletons while the first explore fetch is in flight', async () => {
    listSpotsMock.mockImplementation(() => new Promise(() => {}));

    const router = buildRouter();
    await router.push('/explore');
    await router.isReady();

    const wrapper = mount(ExplorePage, {
      global: {
        plugins: [router],
        stubs: {
          AppShell: { template: '<div><slot /></div>' },
          LazyImage: {
            props: ['src', 'alt'],
            template: '<img class="lazy-image-stub" :src="src" :alt="alt" />',
          },
        },
      },
    });

    expect(wrapper.findAll('[data-test="spot-card-skeleton"]')).toHaveLength(12);
    expect(wrapper.find('[data-test="trending-item"]').exists()).toBe(false);
  });
});
