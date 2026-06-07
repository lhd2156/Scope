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
  await wrapper.get('[data-test="vibe-select"]').trigger('click');
  await nextTick();
  const options = wrapper.findAll('[data-test="vibe-option"]').map((option) => option.get('span').text());
  await wrapper.get('[data-test="vibe-select"]').trigger('keydown.esc');
  await nextTick();
  return options;
}

async function selectVibeOption(wrapper: VueWrapper, vibe: string) {
  await wrapper.get('[data-test="vibe-select"]').trigger('click');
  await nextTick();
  const option = wrapper.findAll('[data-test="vibe-option"]').find((entry) => entry.attributes('data-vibe') === vibe);
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

  it('opens the vibe menu from keyboard and dismisses it only for outside pointer events', async () => {
    const { wrapper } = await mountExplorePage();
    const vibeButton = wrapper.get('[data-test="vibe-select"]');

    await vibeButton.trigger('keydown.down');
    await nextTick();

    expect(wrapper.find('[data-test="vibe-menu"]').exists()).toBe(true);

    vibeButton.element.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await nextTick();

    expect(wrapper.find('[data-test="vibe-menu"]').exists()).toBe(true);

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await nextTick();

    expect(wrapper.find('[data-test="vibe-menu"]').exists()).toBe(false);

    await vibeButton.trigger('keydown.down');
    await nextTick();
    await vibeButton.trigger('keydown.esc');
    await nextTick();

    expect(wrapper.find('[data-test="vibe-menu"]').exists()).toBe(false);
  });

  it('filters large city sets by country before city selection', async () => {
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
    expect(wrapper.find('[data-test="state-filter-button"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-test="country-chip"]').map((chip) => chip.text())).toEqual(['Spain', 'USA']);
    expect(wrapper.findAll('[data-test="city-chip"]').map((chip) => chip.text())).toEqual([
      'Austin, TX',
      'Barcelona, Catalonia',
      'Fort Worth, TX',
    ]);

    await wrapper.findAll('[data-test="country-chip"]').find((chip) => chip.text() === 'USA')?.trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('3');
    expect(wrapper.text()).toContain('2 cities in USA');
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
    expect(wrapper.get('[data-test="country-chip-all"]').classes()).toContain('active');
    expect(wrapper.findAll('[data-test="city-chip"]').map((chip) => chip.text())).toEqual([
      'Austin, TX',
      'Barcelona, Catalonia',
      'Fort Worth, TX',
    ]);

    await wrapper.findAll('[data-test="country-chip"]').find((chip) => chip.text() === 'Spain')?.trigger('click');
    await nextTick();

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('1');
    expect(wrapper.findAll('[data-test="city-chip"]').map((chip) => chip.text())).toEqual(['Barcelona, Catalonia']);
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

  it('expands hidden city chips and filters by the vibe dropdown', async () => {
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
    expect(await getVibeOptionTexts(wrapper)).toContain('Vibe 13');

    await selectVibeOption(wrapper, 'vibe-13');

    expect(wrapper.get('[data-test="results-count"]').text()).toBe('1');

    await wrapper.get('.clear-filters').trigger('click');
    await nextTick();
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
    expect(wrapper.find('[data-test="state-filter-button"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="vibe-menu"]').exists()).toBe(false);
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

  it('renders the lightweight QA explore preview without loading the standard grid', async () => {
    const { wrapper } = await mountQaExplorePage();

    expect(wrapper.find('.discovery-shell').exists()).toBe(false);
    expect(wrapper.text()).toContain('Photo-led discovery stays condensed for quick previews.');
    expect(wrapper.findAll('.explore-audit-preview__item')).toHaveLength(3);
    expect(wrapper.text()).toContain('Lakefront Sunrise Loop');
    expect(listSpotsMock).not.toHaveBeenCalled();
  });
});
