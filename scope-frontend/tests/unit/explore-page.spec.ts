import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick, type Component } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

const ORIGINAL_INNER_WIDTH = window.innerWidth;

const {
  fixtureSpots,
  listSpotsMock,
  listTrendingSpotsMock,
  loadSearchPlaceRecommendationsMock,
  recordSearchPlaceSuggestionClickMock,
  searchContentMock,
} = vi.hoisted(() => ({
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
  loadSearchPlaceRecommendationsMock: vi.fn(),
  recordSearchPlaceSuggestionClickMock: vi.fn(),
  searchContentMock: vi.fn(),
}));

vi.mock('@/services/spotService', () => ({
  listSpots: listSpotsMock,
  listTrendingSpots: listTrendingSpotsMock,
  getSpotDetail: vi.fn(),
  createSpot: vi.fn(),
  updateSpot: vi.fn(),
}));

vi.mock('@/services/searchDiscoveryService', () => ({
  loadSearchPlaceRecommendations: loadSearchPlaceRecommendationsMock,
  recordSearchPlaceSuggestionClick: recordSearchPlaceSuggestionClickMock,
}));

vi.mock('@/services/searchService', () => ({
  searchContent: searchContentMock,
}));

import ExplorePage from '@/views/ExplorePage.vue';
import { useMapStore } from '@/stores/map';
import { useSearchStore } from '@/stores/search';
import { useSpotsStore } from '@/stores/spots';

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

function buildRouter(exploreComponent: Component = ExplorePage) {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/explore',
        name: 'explore',
        component: exploreComponent,
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

async function mountExplorePage(options?: { mobile?: boolean; route?: string }) {
  setViewportWidth(options?.mobile ? 390 : 1280);

  const router = buildRouter();
  await router.push(options?.route ?? '/explore');
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

async function mountQaExplorePage() {
  vi.resetModules();
  vi.doMock('@/utils/qaMode', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/utils/qaMode')>();
    return {
      ...actual,
      isScopeQaMode: () => true,
    };
  });

  const { default: QaExplorePage } = await import('@/views/ExplorePage.vue');
  const router = buildRouter(QaExplorePage);
  await router.push('/explore');
  await router.isReady();

  const wrapper = mount(QaExplorePage, {
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
  vi.doUnmock('@/utils/qaMode');

  return { wrapper, router };
}

function buildGeneratedSpot(index: number) {
  const base = fixtureSpots[index % fixtureSpots.length];

  return {
    ...base,
    id: `generated-spot-${index}`,
    title: `Generated City ${String(index).padStart(2, '0')} Stop`,
    description: `Fixture spot ${index} with its own city and vibe.`,
    latitude: base.latitude + index / 100,
    longitude: base.longitude - index / 100,
    city: `City ${String(index).padStart(2, '0')}`,
    country: 'US',
    vibe: `vibe-${String(index).padStart(2, '0')}`,
    likesCount: 20 + index,
    createdAt: `2026-03-${String((index % 20) + 1).padStart(2, '0')}T12:00:00Z`,
  };
}

async function getVibeOptionTexts(wrapper: VueWrapper) {
  await nextTick();
  return [
    wrapper.find('[data-test="vibe-chip-all"]').exists() ? wrapper.get('[data-test="vibe-chip-all"]').text() : '',
    ...wrapper.findAll('[data-test="vibe-chip"]').map((chip) => chip.text()),
  ].filter(Boolean);
}

async function selectVibeOption(wrapper: VueWrapper, vibe: string) {
  await nextTick();
  let option = wrapper.findAll('[data-test="vibe-chip"]').find((entry) => entry.attributes('data-vibe') === vibe);

  if (!option && wrapper.find('[data-test="vibe-chip-more"]').exists()) {
    await wrapper.get('[data-test="vibe-chip-more"]').trigger('click');
    await nextTick();
    option = wrapper.findAll('[data-test="vibe-chip"]').find((entry) => entry.attributes('data-vibe') === vibe);
  }

  expect(option).toBeTruthy();
  await option!.trigger('click');
  await nextTick();
}

async function openRegionFilter(wrapper: VueWrapper) {
  await wrapper.get('[data-test="state-filter-select"]').trigger('click');
  await nextTick();
}

async function getRegionFilterOptionLabels(wrapper: VueWrapper) {
  await openRegionFilter(wrapper);
  return wrapper.findAll('[data-test="state-filter-option"]').map((option) => option.get('span').text());
}

async function selectRegionFilterOption(wrapper: VueWrapper, region: string) {
  if (!wrapper.find('[data-test="state-filter-option"]').exists()) {
    await openRegionFilter(wrapper);
  }

  const option = wrapper
    .findAll('[data-test="state-filter-option"]')
    .find((entry) => entry.attributes('data-region') === region);

  expect(option).toBeTruthy();
  await option!.trigger('click');
  await nextTick();
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
    searchContentMock.mockReset().mockResolvedValue({
      query: '',
      type: 'spots',
      total: 0,
      offset: 0,
      limit: 20,
      results: [],
    });
    loadSearchPlaceRecommendationsMock.mockReset().mockResolvedValue([
      {
        ...fixtureSpots[1],
        recommendationReason: 'Popular nature pick with calm energy',
        searchSuggestionSource: 'recommendation',
      },
    ]);
    recordSearchPlaceSuggestionClickMock.mockReset().mockResolvedValue(undefined);
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

    await wrapper.get('[data-test="category-chip-food"]').trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('1');
    expect(mapStore.activeCategories).toEqual(['nature']);

    await wrapper.get('input[aria-label="Search spots"]').setValue('Kyoto');
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    expect(wrapper.text()).toContain('No spots match the current filters');
    expect(wrapper.find('[data-test="explore-empty-state"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="empty-state-panel"]').exists()).toBe(false);

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
      'entertainment',
      'scenic',
      'other',
    ]);
  });

  it('surfaces live spot pillars as explore vibes when summaries do not include a vibe string', async () => {
    listSpotsMock.mockResolvedValueOnce({
      data: [
        {
          ...fixtureSpots[0],
          id: 'pillar-only-spot',
          title: 'Production Water Garden',
          category: 'scenic',
          vibe: undefined,
          pillars: ['photo-worthy', 'group-friendly'],
        },
        fixtureSpots[1],
      ],
      meta: {
        page: 1,
        pageSize: 2,
        total: 2,
        totalPages: 1,
      },
    });

    const { wrapper } = await mountExplorePage();

    const vibeOptions = await getVibeOptionTexts(wrapper);
    expect(vibeOptions).toContain('Photo Worthy');

    await selectVibeOption(wrapper, 'photo-worthy');

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('1');
    expect(wrapper.get('[data-test="explore-results"]').text()).toContain('Production Water Garden');

    await wrapper.get('input[aria-label="Search spots"]').setValue('group-friendly');
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('1');
    expect(wrapper.get('[data-test="explore-results"]').text()).toContain('Production Water Garden');
  });

  it('shows city and state labels for seeded production spots when API summaries omit location fields', async () => {
    const seededProductionSpots = [
      {
        ...fixtureSpots[0],
        id: '90000000-0000-0000-0000-000000000001',
        title: 'Mule Alley Mercantile Row',
        city: undefined,
        country: undefined,
        category: 'shopping',
        likesCount: undefined,
      },
      {
        ...fixtureSpots[1],
        id: '90000000-0000-0000-0000-000000000002',
        title: 'San Antonio River Walk Blue Hour',
        city: undefined,
        country: undefined,
        category: 'scenic',
        likesCount: undefined,
      },
      {
        ...fixtureSpots[2],
        id: '90000000-0000-0000-0000-000000000003',
        title: 'Fort Worth Water Gardens',
        city: undefined,
        country: undefined,
        category: 'scenic',
        likesCount: undefined,
      },
    ];

    listSpotsMock.mockResolvedValueOnce({
      data: seededProductionSpots,
      meta: {
        page: 1,
        pageSize: seededProductionSpots.length,
        total: seededProductionSpots.length,
        totalPages: 1,
      },
    });

    const { wrapper } = await mountExplorePage();

    expect(wrapper.text()).toContain('2 cities across all countries');
    expect(wrapper.find('[data-test="city-chip-empty"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-test="city-chip"]').map((chip) => chip.text())).toEqual([
      'Fort Worth, TX',
      'San Antonio, TX',
    ]);
    expect(wrapper.get('[data-test="explore-results"]').text()).toContain('Fort Worth, TX');
    expect(wrapper.get('[data-test="explore-results"]').text()).toContain('San Antonio, TX');
    expect(wrapper.get('[data-test="trending-list"]').text()).toContain('Fort Worth, TX');
    expect(wrapper.get('[data-test="trending-list"]').text()).not.toContain('Scope community pin');
    expect(wrapper.get('[data-test="trending-list"]').text()).not.toContain('New pin');

    await wrapper.findAll('[data-test="city-chip"]').find((chip) => chip.text() === 'Fort Worth, TX')?.trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('2');
    expect(wrapper.get('[data-test="explore-results"]').text()).toContain('Mule Alley Mercantile Row');
    expect(wrapper.get('[data-test="explore-results"]').text()).not.toContain('San Antonio River Walk Blue Hour');

    await wrapper.get('.quick-filter-actions [data-test="state-reset-location"]').trigger('click');
    await nextTick();
    await wrapper.get('input[aria-label="Search spots"]').setValue('San Antonio');
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('1');
    expect(wrapper.get('[data-test="explore-results"]').text()).toContain('San Antonio River Walk Blue Hour');
  });

  it('shows recommended places when explore search receives focus and opens the spot', async () => {
    const { wrapper, router } = await mountExplorePage();

    await wrapper.get('input[aria-label="Search spots"]').trigger('focusin');
    await flushPromises();

    expect(loadSearchPlaceRecommendationsMock).toHaveBeenCalledWith(expect.objectContaining({
      limit: 6,
    }));
    expect(wrapper.get('[data-test="explore-search-recommendations"]').text()).toContain('Recommended places');
    expect(wrapper.get('[data-test="explore-search-recommendation"]').text()).toContain('Botanic River Walk');

    await wrapper.get('[data-test="explore-search-recommendation"]').trigger('click');
    await flushPromises();

    expect(recordSearchPlaceSuggestionClickMock).toHaveBeenCalledWith(expect.objectContaining({
      id: 'spot-2',
      searchSuggestionSource: 'recommendation',
    }));
    expect(router.currentRoute.value.fullPath).toBe('/spots/botanic-river-walk-fort-worth');
  });

  it('renders elastic search results with safe highlights, fallbacks, and route query sync', async () => {
    const { wrapper, router } = await mountExplorePage({ route: '/explore?q=ramen' });
    const searchStore = useSearchStore();
    searchStore.search = vi.fn();
    searchStore.results = {
      query: 'ramen',
      type: 'spots',
      total: 3,
      offset: 0,
      limit: 20,
      results: [
        {
          id: 'search-highlight',
          name: 'Shibuya Ramen Counter',
          description: 'Counter seats and late broth.',
          category: 'food',
          location: { lat: 35.6595, lon: 139.7005 },
          avg_rating: 4.9,
          review_count: 42,
          _score: 12,
          _highlights: {
            description: ['Late <em>ramen</em> & "broth" <script>'],
          },
        },
        {
          id: 'search-description',
          name: 'Unknown Category Garden',
          description: 'A <quiet> courtyard with tea & shade.',
          category: 'mystery',
          avg_rating: 4.4,
          review_count: 0,
          _score: 8,
        },
        {
          id: 'search-empty',
          name: 'Untitled Discovery Pin',
          category: undefined,
          _score: 4,
        },
      ],
    };

    await nextTick();

    expect((wrapper.get('input[aria-label="Search spots"]').element as HTMLInputElement).value).toBe('ramen');
    expect(wrapper.get('[data-test="results-count"]').text()).toBe('3');
    expect(wrapper.text()).toContain('Results for "ramen" - 3 matches');
    expect(wrapper.findAll('[data-test="explore-card"]')).toHaveLength(3);
    expect(wrapper.html()).toContain('<mark>ramen</mark>');
    expect(wrapper.text()).toContain('"broth"');
    expect(wrapper.html()).toContain('&lt;script&gt;');
    expect(wrapper.html()).not.toContain('<script>');
    expect(wrapper.text()).toContain('Unknown Category Garden');
    expect(wrapper.text()).toContain('Other');
    expect(router.currentRoute.value.query.q).toBe('ramen');
  });

  it('hydrates search from route query changes without replacing the same query again', async () => {
    const { wrapper, router } = await mountExplorePage();
    const replaceSpy = vi.spyOn(router, 'replace');

    await router.replace('/explore?q=route-only');
    await flushPromises();
    await nextTick();

    expect((wrapper.get('input[aria-label="Search spots"]').element as HTMLInputElement).value).toBe('route-only');
    expect(router.currentRoute.value.query.q).toBe('route-only');
    expect(replaceSpy).toHaveBeenCalledTimes(1);

    replaceSpy.mockRestore();
  });

  it('keeps the explore shell mounted without exposing raw backend errors', async () => {
    listSpotsMock.mockRejectedValueOnce(new Error('Explore backend unavailable'));

    const { wrapper } = await mountExplorePage();

    await flushPromises();

    expect(wrapper.text()).not.toContain('Explore results could not be refreshed');
    expect(wrapper.text()).not.toContain('Explore backend unavailable');
    expect(wrapper.find('[data-test="trending-panel"]').exists()).toBe(true);
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
    expect(mapStore.activeCategories).toHaveLength(9);

    await wrapper.get('[data-test="category-chip-food"]').trigger('click');
    await nextTick();
    expect(wrapper.get('.view-toggle a[to="/map"]').exists()).toBe(true);
    await router.push('/map');
    await flushPromises();

    expect(router.currentRoute.value.name).toBe('map');
    expect(mapStore.activeCategories).toEqual(['food']);
  });

  it('shows vibe chips by default and narrows them as filters change', async () => {
    const { wrapper } = await mountExplorePage();

    expect(wrapper.find('[data-test="vibe-chip-row"]').exists()).toBe(true);
    expect(await getVibeOptionTexts(wrapper)).toEqual([
      'Any vibe',
      'Calm',
      'Curated',
      'Electric',
    ]);

    await wrapper.get('[data-test="category-chip-food"]').trigger('click');
    await nextTick();

    expect(await getVibeOptionTexts(wrapper)).toEqual([
      'Any vibe',
      'Electric',
    ]);

    await wrapper.findAll('[data-test="city-chip"]').find((chip) => chip.text() === 'Fort Worth, TX')?.trigger('click');
    await nextTick();

    expect(await getVibeOptionTexts(wrapper)).toEqual([
      'Any vibe',
      'Electric',
    ]);
  });

  it('filters large city sets by country before city selection', async () => {
    const expandedSpots = [
      ...fixtureSpots,
      {
        id: 'spot-4',
        title: 'Sydney Morning Market',
        description: 'A harbour market lane with espresso counters and a compact food loop.',
        latitude: -33.8568,
        longitude: 151.2153,
        category: 'scenic',
        city: 'Sydney',
        country: 'AU',
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
    expect(wrapper.text()).toContain('3 cities across all countries');
    expect(wrapper.find('[data-test="state-filter-control"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-test="country-chip"]').map((chip) => chip.text())).toEqual(['USA', 'AU']);
    expect(wrapper.findAll('[data-test="city-chip"]').map((chip) => chip.text())).toEqual([
      'Austin, TX',
      'Fort Worth, TX',
      'Sydney, NSW',
    ]);

    await wrapper.findAll('[data-test="country-chip"]').find((chip) => chip.text() === 'USA')?.trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('3');
    expect(wrapper.text()).toContain('2 cities in USA');
    expect(wrapper.find('[data-test="state-filter-control"]').exists()).toBe(true);
    expect(wrapper.get('[data-test="state-filter-control"]').text()).toContain('Filter type');
    expect(await getRegionFilterOptionLabels(wrapper)).toEqual(['All states', 'TX']);
    expect(wrapper.findAll('[data-test="state-filter-option"]').map((option) => option.get('small').text())).toEqual([
      '2 cities available',
      '2 cities available',
    ]);
    expect(wrapper.findAll('[data-test="city-chip"]').map((chip) => chip.text())).toEqual([
      'Austin, TX',
      'Fort Worth, TX',
    ]);

    await selectRegionFilterOption(wrapper, 'TX');

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('3');
    expect(wrapper.text()).toContain('2 cities in TX');
    expect(wrapper.findAll('[data-test="city-chip"]').map((chip) => chip.text())).toEqual([
      'Austin, TX',
      'Fort Worth, TX',
    ]);
    expect(wrapper.get('.quick-filter-actions [data-test="state-reset-location"]').text()).toContain('Reset location');
    expect(
      wrapper.find('.quick-filter-actions').element.firstElementChild?.getAttribute('data-test'),
    ).toBe('state-reset-location');
    expect(
      wrapper.find('.quick-filter-actions').element.lastElementChild?.getAttribute('data-test'),
    ).toBe('state-filter-control');

    await wrapper.get('[data-test="state-reset-location"]').trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('4');
    expect(wrapper.find('[data-test="state-reset-location"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="state-filter-control"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="country-chip-all"]').classes()).toContain('active');
    expect(wrapper.findAll('[data-test="city-chip"]').map((chip) => chip.text())).toEqual([
      'Austin, TX',
      'Fort Worth, TX',
      'Sydney, NSW',
    ]);

    await wrapper.findAll('[data-test="country-chip"]').find((chip) => chip.text() === 'AU')?.trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('1');
    expect(await getRegionFilterOptionLabels(wrapper)).toEqual(['All regions', 'NSW']);
    expect(wrapper.findAll('[data-test="city-chip"]').map((chip) => chip.text())).toEqual(['Sydney, NSW']);
  });

  it('clears city and country filters when their backing options disappear', async () => {
    const expandedSpots = [
      ...fixtureSpots,
      {
        id: 'spot-4',
        title: 'Barcelona Morning Market',
        description: 'A market lane with espresso counters and a compact food loop.',
        latitude: 41.3851,
        longitude: 2.1734,
        category: 'scenic',
        city: 'Barcelona',
        country: 'Spain',
        vibe: 'cinematic',
        rating: 4.9,
        photoUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800',
        likesCount: 55,
        createdAt: '2026-03-22T12:00:00Z',
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
    const spotsStore = useSpotsStore();

    await wrapper.findAll('[data-test="city-chip"]').find((chip) => chip.text() === 'Barcelona, Catalonia')?.trigger('click');
    await nextTick();
    expect(wrapper.get('[data-test="results-count"]').text()).toBe('1');

    await wrapper.findAll('[data-test="country-chip"]').find((chip) => chip.text() === 'USA')?.trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('3');
    expect(wrapper.get('.quick-filter-actions [data-test="state-reset-location"]').text()).toContain('Reset location');

    spotsStore.items = [expandedSpots.find((spot) => spot.city === 'Barcelona')!];
    await nextTick();

    expect(wrapper.find('[data-test="state-reset-location"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="results-count"]').text()).toBe('1');
  });

  it('expands hidden city and vibe chips before filtering', async () => {
    const expandedSpots = Array.from({ length: 13 }, (_, index) => buildGeneratedSpot(index + 1));
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

    expect(wrapper.findAll('[data-test="city-chip"]')).toHaveLength(6);
    expect(wrapper.get('[data-test="city-chip-more"]').text()).toBe('+7 more');
    expect(wrapper.get('[data-test="city-chip-more"]').attributes('aria-expanded')).toBe('false');
    expect(wrapper.findAll('[data-test="vibe-chip"]')).toHaveLength(12);
    expect(wrapper.get('[data-test="vibe-chip-more"]').text()).toBe('+1 more');
    expect(await getVibeOptionTexts(wrapper)).not.toContain('Vibe 13');

    await selectVibeOption(wrapper, 'vibe-13');

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('1');
    expect(wrapper.get('[data-test="vibe-chip-more"]').text()).toBe('Show fewer');

    await wrapper.get('.clear-filters').trigger('click');
    await nextTick();
    expect(wrapper.get('[data-test="vibe-chip-more"]').text()).toBe('+1 more');
    await wrapper.get('[data-test="city-chip-more"]').trigger('click');
    await nextTick();

    expect(wrapper.findAll('[data-test="city-chip"]')).toHaveLength(13);
    expect(wrapper.get('[data-test="city-chip-more"]').text()).toBe('Show fewer');
    expect(wrapper.get('[data-test="city-chip-more"]').attributes('aria-expanded')).toBe('true');
    expect(wrapper.findAll('[data-test="city-chip"]').map((chip) => chip.text())).toContain('City 13, USA');

    await wrapper.findAll('[data-test="city-chip"]').find((chip) => chip.text() === 'City 13, USA')?.trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('1');

    await wrapper.get('[data-test="city-chip-more"]').trigger('click');
    await nextTick();

    expect(wrapper.findAll('[data-test="city-chip"]').map((chip) => chip.text())).toContain('City 13, USA');
    expect(wrapper.get('[data-test="city-chip-more"]').text()).toBe('+7 more');
  });

  it('narrows city and vibe choices from the active category and location filters', async () => {
    const expandedSpots = [
      ...fixtureSpots,
      {
        id: 'spot-4',
        title: 'Quiet Garden Patio',
        description: 'Calm food stop with garden seating.',
        latitude: 34.0522,
        longitude: -118.2437,
        category: 'food',
        city: 'Los Angeles',
        country: 'US',
        vibe: 'calm',
        rating: 4.5,
        photoUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800',
        likesCount: 12,
        createdAt: '2026-03-12T12:00:00Z',
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

    await wrapper.get('[data-test="category-chip-food"]').trigger('click');
    await nextTick();

    expect(wrapper.findAll('[data-test="city-chip"]').map((chip) => chip.text())).toEqual([
      'Fort Worth, TX',
      'Los Angeles, CA',
    ]);
    expect(await getVibeOptionTexts(wrapper)).toEqual([
      'Any vibe',
      'Calm',
      'Electric',
    ]);

    await wrapper.findAll('[data-test="city-chip"]').find((chip) => chip.text() === 'Fort Worth, TX')?.trigger('click');
    await nextTick();

    expect(await getVibeOptionTexts(wrapper)).toEqual([
      'Any vibe',
      'Electric',
    ]);

    await selectVibeOption(wrapper, 'electric');

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('1');
    expect(wrapper.get('[data-test="explore-results"]').text()).toContain('Sunset Rooftop Tacos');
  });

  it('labels empty city and country filters when no location data is available', async () => {
    listSpotsMock.mockResolvedValueOnce({
      data: [],
      meta: {
        page: 1,
        pageSize: 0,
        total: 0,
        totalPages: 0,
      },
    });

    const { wrapper } = await mountExplorePage();

    expect(wrapper.text()).toContain('No cities yet');
    expect(wrapper.get('[data-test="country-chip-empty"]').text()).toBe('Countries appear after spots sync.');
    expect(wrapper.get('[data-test="city-chip-empty"]').text()).toBe('Cities appear after spots sync.');
    expect(wrapper.find('[data-test="state-filter-control"]').exists()).toBe(false);
    expect(wrapper.get('[data-test="vibe-chip-empty"]').text()).toBe('Vibes appear after spots sync.');
    expect(wrapper.find('[data-test="vibe-chip"]').exists()).toBe(false);
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

    expect(wrapper.findAll('[data-test="spot-card-skeleton"]')).toHaveLength(9);
    expect(wrapper.find('[data-test="trending-item"]').exists()).toBe(false);
  });

  it('clears pending search debounce timers when the page unmounts', async () => {
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const { wrapper } = await mountExplorePage();

    await wrapper.get('input[aria-label="Search spots"]').setValue('timer cleanup');
    await nextTick();

    wrapper.unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('covers explore helper fallbacks, overflow filters, and stale recommendation races', async () => {
    const countries = ['US', 'Canada', 'France', 'Japan', 'Mexico', 'Italy', 'Spain', 'Portugal'];
    const multiCountrySpots = countries.map((country, index) => ({
      ...buildGeneratedSpot(index),
      id: `country-spot-${index}`,
      title: `${country} Choice ${index}`,
      city: `City ${index}`,
      country,
      state: country === 'US' ? (index % 2 ? 'CA' : 'TX') : undefined,
      stateCode: country === 'US' ? (index % 2 ? 'CA' : 'TX') : undefined,
      region: country === 'US' ? (index % 2 ? 'CA' : 'TX') : `Region ${index}`,
      likesCount: index === 0 ? undefined : 30,
      rating: index < 2 ? 4.9 : 4.5,
      createdAt: index === 2 ? 'not-a-date' : `2026-04-${String(index + 1).padStart(2, '0')}T12:00:00Z`,
      vibe: `vibe-${index}`,
    }));
    listSpotsMock.mockResolvedValueOnce({
      data: multiCountrySpots,
      meta: {
        page: 1,
        pageSize: multiCountrySpots.length,
        total: multiCountrySpots.length,
        totalPages: 1,
      },
    });

    const { wrapper } = await mountExplorePage();
    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    const read = <T>(entry: T | { value: T }): T => (
      entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry as T
    );
    const write = <T>(entry: { value: T }, value: T) => {
      entry.value = value;
    };

    expect(coverage.resolveSpotRegion({ city: '', country: '', category: 'other' })).toBe('Global');
    expect(coverage.resolveSpotCountry({ city: '', country: '', category: 'other' })).toBe('Global');
    expect(coverage.buildCityFilterKey('Austin', 'TX', 'USA')).toBe('USA::TX::Austin');
    expect(coverage.formatCityOptionLabel('Paris', '')).toBe('Paris');
    expect(coverage.formatCityOptionLabel('Austin', 'TX')).toContain('Austin');
    expect(coverage.formatCategory('nightlife')).toBe('Nightlife');
    expect(coverage.formatTrendingSignal({ category: 'food', likesCount: 0 })).toBe('Food pick');
    expect(coverage.formatTrendingSignal({ category: 'food', likesCount: 1 })).toBe('1 community saves');
    expect(coverage.getSpotCreatedTime({ createdAt: 'not-a-date' })).toBe(0);
    expect(coverage.escapeHtml('<em>"Scope"</em>')).toBe('&lt;em&gt;&quot;Scope&quot;&lt;/em&gt;');
    expect(coverage.formatSearchHighlight('A <em>great</em> & safe stop')).toBe('A <mark>great</mark> &amp; safe stop');

    const ranked = coverage.rankPopularSpots([
      { id: 'b', title: 'Beta', rating: 4.8, likesCount: 3, createdAt: '2026-04-02T00:00:00Z' },
      { id: 'a', title: 'Alpha', rating: 4.9, likesCount: 3, createdAt: '2026-04-02T00:00:00Z' },
      { id: 'c', title: 'Gamma', rating: 5, createdAt: 'bad-date' },
    ]).map((spot: { id: string }) => spot.id);
    expect(ranked).toEqual(['a', 'b', 'c']);
    expect(coverage.sortExploreSpotsForMode(multiCountrySpots as any[], 'popular')[0].id).toBe('country-spot-1');
    expect(coverage.isSpotCategory('food')).toBe(true);
    expect(coverage.isSpotCategory('not-real')).toBe(false);
    expect(coverage.mapSearchResultToSpot({
      id: 'search-spot',
      name: 'Search & Find',
      description: 'Fallback description',
      location: { lat: 10, lon: 20 },
      category: 'unknown',
      avg_rating: 4.2,
      review_count: 7,
      _highlights: {
        description: ['A <em>bright</em> result'],
      },
    })).toMatchObject({
      id: 'search-spot',
      category: 'other',
      searchSnippet: 'A <mark>bright</mark> result',
    });

    expect(read<Array<{ value: string }>>(coverage.availableCountryOptions).length).toBeGreaterThan(5);
    write(coverage.selectedCountry, 'Spain');
    await nextTick();
    expect(read<Array<{ value: string }>>(coverage.visibleCountryOptions)[0].value).toBe('Spain');
    expect(read<string>(coverage.countryOverflowButtonLabel)).toMatch(/more$/);
    expect(read<string>(coverage.countryOverflowButtonAriaLabel)).toContain('countries');
    write(coverage.isCountryFilterExpanded, true);
    await nextTick();
    expect(read<string>(coverage.countryOverflowButtonLabel)).toBe('Show fewer');
    expect(read<string>(coverage.countryOverflowButtonAriaLabel)).toBe('Show fewer countries');

    const usaCity = read<Array<{ key: string; country: string }>>(coverage.availableCityFilterOptions)
      .find((city) => city.country === 'USA');
    expect(usaCity).toBeTruthy();
    write(coverage.selectedCityKey, usaCity!.key);
    write(coverage.selectedCountry, 'France');
    await nextTick();
    expect(read<string>(coverage.selectedCityKey)).toBe('');

    write(coverage.selectedCountry, 'USA');
    write(coverage.selectedRegion, 'Missing State');
    await nextTick();
    expect(read<string>(coverage.selectedRegion)).toBe('');
    expect(read<string>(coverage.cityFilterScopeCopy)).toBe('in USA');
    expect(coverage.formatAvailableCityCount(1)).toBe('1 city available');
    expect(coverage.formatRegionOptionMeta({ value: 'TX', label: 'TX', count: 2 })).toBe('2 cities available');

    const control = document.createElement('div');
    const inside = document.createElement('button');
    control.appendChild(inside);
    write(coverage.regionFilterControlRef, control);
    write(coverage.isRegionFilterOpen, true);
    coverage.handleDocumentClick({ target: inside } as unknown as MouseEvent);
    expect(read<boolean>(coverage.isRegionFilterOpen)).toBe(true);
    coverage.handleDocumentClick({ target: document.body } as unknown as MouseEvent);
    expect(read<boolean>(coverage.isRegionFilterOpen)).toBe(false);
    write(coverage.isRegionFilterOpen, true);
    coverage.handleDocumentClick({ target: 'not-a-node' } as unknown as MouseEvent);
    expect(read<boolean>(coverage.isRegionFilterOpen)).toBe(true);

    const staleRecommendation = Promise.reject(new Error('late recommendation failure'));
    loadSearchPlaceRecommendationsMock
      .mockReturnValueOnce(staleRecommendation)
      .mockResolvedValueOnce([{ ...fixtureSpots[0], recommendationReason: 'Fresh pick' }]);
    const staleLoad = coverage.loadExploreSearchRecommendations({ force: true });
    const freshLoad = coverage.loadExploreSearchRecommendations({ force: true });
    await Promise.all([staleLoad, freshLoad]);
    await flushPromises();
    expect(read<unknown>(coverage.exploreSearchRecommendationsError)).toBeNull();
    expect(read<Array<unknown>>(coverage.exploreSearchRecommendations)).toHaveLength(1);

    loadSearchPlaceRecommendationsMock.mockRejectedValueOnce(new Error('recommendations unavailable'));
    await coverage.loadExploreSearchRecommendations({ force: true });
    await flushPromises();
    expect(read<string>(coverage.exploreSearchRecommendationsError)).toBe('Recommended places are temporarily unavailable.');
    write(coverage.hasFocusedExploreSearch, true);
    write(coverage.searchQuery, 'zzzzzz');
    useSearchStore().loading = false;
    await nextTick();
    expect(read<boolean>(coverage.showExploreSearchRecommendations)).toBe(true);
    expect(read<string>(coverage.exploreSearchRecommendationTitle)).toBe('Recommended instead');
    useSearchStore().loading = true;
    await nextTick();
    expect(read<boolean>(coverage.showExploreSearchRecommendations)).toBe(false);
  });

  it('keeps edge filter copy, pagination clamps, and recommendation metadata predictable', async () => {
    const generatedSpots = Array.from({ length: 12 }, (_, index) => buildGeneratedSpot(index + 1));
    const mysteryCitySpot = {
      ...fixtureSpots[0],
      id: 'mystery-city-spot',
      title: 'Mystery City Listening Room',
      city: 'Mystery City',
      country: '',
      state: '',
      stateCode: '',
      region: '',
      vibe: 'mystic',
      rating: 4.15,
      likesCount: 9,
      createdAt: '2026-04-16T12:00:00Z',
    };
    const coordinateOnlySpot = {
      ...fixtureSpots[1],
      id: 'coordinate-only-spot',
      title: 'Coordinate Only Pause',
      city: '',
      country: '',
      state: '',
      stateCode: '',
      region: '',
      vibe: '',
      pillars: [],
      rating: 0,
      likesCount: 0,
      createdAt: 'bad-date',
    };
    const edgeSpots = [...generatedSpots, mysteryCitySpot, coordinateOnlySpot];
    listSpotsMock.mockResolvedValueOnce({
      data: edgeSpots,
      meta: {
        page: 1,
        pageSize: edgeSpots.length,
        total: edgeSpots.length,
        totalPages: 2,
      },
    });

    const { wrapper } = await mountExplorePage();
    const coverage = (wrapper.vm as any).__coverage as Record<string, any>;
    const read = <T>(entry: T | { value: T }): T => (
      entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry as T
    );
    const write = <T>(entry: { value: T }, value: T) => {
      entry.value = value;
    };
    const mapStore = useMapStore();

    expect(coverage.rankPopularSpots([
      { id: 'b', title: 'Same', rating: 5, likesCount: 10, createdAt: '2026-04-01T00:00:00Z' },
      { id: 'a', title: 'Same', rating: 5, likesCount: 10, createdAt: '2026-04-01T00:00:00Z' },
    ]).map((spot: { id: string }) => spot.id)).toEqual(['a', 'b']);

    mapStore.setActiveCategories([]);
    await nextTick();
    expect(read<string[]>(coverage.activeExploreCategories)).toHaveLength(9);
    coverage.toggleCategory('food');
    await nextTick();
    expect(mapStore.activeCategories).toEqual(['food']);
    coverage.toggleCategory('food');
    await nextTick();
    expect(mapStore.activeCategories).toEqual([]);
    mapStore.resetCategories();
    await nextTick();

    const cityOptions = read<Array<{ key: string; city: string; region: string; country: string; label: string }>>(
      coverage.availableCityFilterOptions,
    );
    const generatedCity = cityOptions.find((city) => city.city === 'City 12');
    const mysteryCity = cityOptions.find((city) => city.city === 'Mystery City');
    expect(generatedCity).toBeTruthy();
    expect(mysteryCity).toMatchObject({
      city: 'Mystery City',
      region: 'Global',
      country: 'Global',
      label: 'Mystery City',
    });
    expect(read<string>(coverage.vibeOverflowButtonAriaLabel)).toBe('Show 1 more vibe');

    write(coverage.selectedVibe, 'vibe-12');
    await nextTick();
    expect(read<string[]>(coverage.visibleExploreVibes)[0]).toBe('vibe-12');
    expect(coverage.matchesActiveVibeFilter(generatedSpots[11])).toBe(true);
    write(coverage.selectedVibe, 'missing-vibe');
    mapStore.setActiveCategories(['nature']);
    await nextTick();
    expect(read<string>(coverage.selectedVibe)).toBe('');
    mapStore.resetCategories();
    await nextTick();

    coverage.toggleCity(generatedCity);
    await nextTick();
    expect(read<{ label: string } | null>(coverage.selectedCityOption)?.label).toBe('City 12, USA');
    expect(read<string>(coverage.vibeFilterMetaCopy)).toBe('1 vibe in City 12, USA');
    coverage.toggleCity(generatedCity);
    await nextTick();
    expect(read<string>(coverage.selectedCityKey)).toBe('');

    coverage.toggleCity(mysteryCity);
    await nextTick();
    expect(coverage.matchesSelectedCity(mysteryCitySpot)).toBe(true);
    expect(read<string>(coverage.vibeFilterMetaCopy)).toBe('1 vibe in Mystery City');
    coverage.toggleCity(mysteryCity);
    write(coverage.selectedRegion, 'Global');
    await nextTick();
    expect(coverage.matchesSelectedRegion(mysteryCitySpot)).toBe(true);
    expect(read<string>(coverage.cityFilterScopeCopy)).toBe('in Global');
    expect(read<string>(coverage.vibeFilterMetaCopy)).toBe('1 vibe in Global');
    write(coverage.selectedRegion, '');
    await nextTick();

    coverage.goToExplorePage(99);
    await nextTick();
    expect(read<string>(coverage.explorePaginationStatus)).toContain('Page 2 of 2');
    write(coverage.selectedCountry, 'Atlantis');
    await nextTick();
    expect(read<Array<unknown>>(coverage.visibleExploreCityOptions)).toHaveLength(0);
    expect(wrapper.get('[data-test="city-chip-empty"]').text()).toBe('No cities with spots yet.');
    expect(read<string>(coverage.explorePaginationStatus)).toBe('Page 1 of 1');
    coverage.clearLocationFilters();
    await nextTick();

    write(coverage.selectedCountry, 'USA');
    await nextTick();
    write(coverage.selectedRegion, 'Missing State');
    await nextTick();
    expect(read<string>(coverage.selectedRegionFilterLabel)).toBe(read<string>(coverage.regionFilterAllLabel));
    coverage.clearLocationFilters();
    await nextTick();

    expect(coverage.formatRecommendationMeta({
      ...coordinateOnlySpot,
      recommendationReason: '',
      searchSuggestionSource: 'recommendation',
    })).toBe('Scope place');
    expect(coverage.formatRecommendationMeta({
      ...mysteryCitySpot,
      recommendationReason: 'Fresh local signal',
      searchSuggestionSource: 'recommendation',
    })).toBe('Mystery City / 4.2 rating / Fresh local signal / Mystic');

    const originalWindow = window;
    vi.stubGlobal('window', undefined);
    try {
      expect(coverage.resolveIsMobileExploreLayout()).toBe(false);
    } finally {
      vi.stubGlobal('window', originalWindow);
    }

    loadSearchPlaceRecommendationsMock.mockClear().mockResolvedValueOnce([
      { ...fixtureSpots[0], id: 'cached-rec', recommendationReason: 'Cached pick' },
    ]);
    await coverage.loadExploreSearchRecommendations({ force: true });
    await coverage.loadExploreSearchRecommendations();
    expect(loadSearchPlaceRecommendationsMock).toHaveBeenCalledTimes(1);

    let resolveStaleRecommendation: (value: unknown[]) => void = () => {};
    const staleRecommendation = new Promise<unknown[]>((resolve) => {
      resolveStaleRecommendation = resolve;
    });
    loadSearchPlaceRecommendationsMock
      .mockReset()
      .mockReturnValueOnce(staleRecommendation)
      .mockResolvedValueOnce([{ ...fixtureSpots[2], id: 'fresh-rec', recommendationReason: 'Fresh pick' }]);
    const staleLoad = coverage.loadExploreSearchRecommendations({ force: true });
    const freshLoad = coverage.loadExploreSearchRecommendations({ force: true });
    resolveStaleRecommendation([{ ...fixtureSpots[1], id: 'stale-rec', recommendationReason: 'Stale pick' }]);
    await Promise.all([staleLoad, freshLoad]);
    await flushPromises();

    expect(read<Array<{ id: string }>>(coverage.exploreSearchRecommendations)[0].id).toBe('fresh-rec');
    expect(read<boolean>(coverage.exploreSearchRecommendationsLoading)).toBe(false);
  });

  it('renders the lightweight QA explore preview without loading the standard grid', async () => {
    const { wrapper } = await mountQaExplorePage();

    expect(wrapper.find('.discovery-shell').exists()).toBe(false);
    expect(wrapper.text()).toContain('Photo-led discovery stays condensed for quick previews.');
    expect(wrapper.findAll('.explore-audit-preview__item')).toHaveLength(3);
    expect(wrapper.text()).toContain('Lakefront Sunrise Loop');
    expect(listSpotsMock).not.toHaveBeenCalled();
  });
});
