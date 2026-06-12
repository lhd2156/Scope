import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ProfileAdventureCard from '@/components/profile/ProfileAdventureCard.vue';
import ProfileHeader from '@/components/profile/ProfileHeader.vue';
import TripTimeline from '@/components/trips/TripTimeline.vue';
import VirtualList from '@/components/common/VirtualList.vue';

vi.mock('@/components/common/LazyImage.vue', () => ({
  default: {
    props: ['src', 'fallbackSrc', 'alt'],
    template: '<img :src="src || fallbackSrc" :alt="alt" />',
  },
}));

vi.mock('@/components/common/ScopeIcon.vue', () => ({
  default: {
    props: ['name', 'label'],
    template: '<span class="scope-icon-stub" :data-name="name">{{ label }}</span>',
  },
}));

describe('Phase 5 small surface branch sweep', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-theme');
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const routerStubs = {
    RouterLink: { props: ['to'], template: '<a :href="typeof to === \'string\' ? to : to.path"><slot /></a>' },
  };

  it('renders compact trip/profile components through empty, single-day, and linkified states', () => {
    const emptyTimeline = mount(TripTimeline, {
      props: { itinerary: null },
    });
    expect(emptyTimeline.text()).toContain('0 stops');
    expect(emptyTimeline.text()).toContain('Trip stops will populate here');

    const timeline = mount(TripTimeline, {
      props: {
        itinerary: {
          id: 'itinerary-1',
          destination: 'Austin',
          weatherForecast: '',
          totalEstimatedCost: 0,
          days: [{
            dayNumber: 1,
            date: '2026-06-11',
            spots: [{
              spotId: 'flex',
              title: 'Flexible stop',
              latitude: 30.2,
              longitude: -97.7,
              estimatedCost: undefined,
              category: undefined,
              city: '',
              duration: undefined,
              timeSlot: undefined,
            }],
          }],
        },
      },
    });
    expect(timeline.text()).toContain('Flexible');
    expect(timeline.text()).toContain('Scope city');
    expect(timeline.text()).toContain('Other');

    const baseTrip = {
      id: 'trip-1',
      title: 'Solo reset',
      destination: 'Marfa',
      description: '',
      startDate: '2026-06-11',
      endDate: '2026-06-11',
      coverImageUrl: '',
      spots: [],
      members: [],
      isPublic: true,
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-02T00:00:00Z',
    };
    const adventure = mount(ProfileAdventureCard, {
      props: { trip: baseTrip },
      global: { stubs: routerStubs },
    });
    expect(adventure.text()).toContain('1 day');
    expect(adventure.text()).toContain('A premium route board is ready');

    const profile = mount(ProfileHeader, {
      props: {
        user: {
          id: 'user-1',
          username: 'scout',
          displayName: 'Scout User',
          avatarUrl: '',
          homeBase: '',
          bio: 'Find me at www.example.com).',
          interests: ['unknown-kind', 'food'],
          createdAt: '2026-01-01T00:00:00Z',
        },
        presence: 'hidden',
        primaryActionLabel: 'Edit',
        primaryActionTo: '/settings',
      },
      global: { stubs: routerStubs },
    });
    expect(profile.text()).toContain('Activity hidden');
    expect(profile.text()).toContain('No location');
    expect(profile.find('a.bio-copy__link').attributes('href')).toBe('https://www.example.com/');
    expect(profile.text()).toContain(')');
    expect(profile.find('.badge-other').exists()).toBe(true);
  });

  it('keeps virtual list sizing, keys, and scroll clamps deterministic', async () => {
    const wrapper = mount(VirtualList, {
      props: {
        items: [{ title: 'No id' }, { id: 2, title: 'Second' }, 'third'],
        itemHeight: 30,
        viewportHeight: 60,
        overscan: 0,
        stagger: true,
      },
      slots: {
        default: '<template #default="{ item, index }"><span>{{ index }}:{{ item.title || item }}</span></template>',
      },
    });

    expect(wrapper.text()).toContain('0:No id');
    await wrapper.setProps({ itemKey: (_item: unknown, index: number) => `custom-${index}` });
    expect(wrapper.findAll('.virtual-list__item')[0]?.attributes('style')).toContain('height: 30px');

    const scroller = wrapper.element as HTMLElement;
    Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 200 });
    await wrapper.trigger('scroll');
    await wrapper.setProps({ items: [{ id: 'only', title: 'Only' }] });
    await wrapper.vm.$nextTick();
    expect(scroller.scrollTop).toBe(0);
  });

  it('covers auth, seo, geolocation, mapbox, content, and ranking utility edge behavior', async () => {
    const authStorage = await import('@/utils/authSessionStorage');
    const authEvents: string[] = [];
    window.addEventListener(authStorage.AUTH_SESSION_HINT_CHANGE_EVENT, () => authEvents.push('changed'));
    window.localStorage.setItem(authStorage.AUTH_REFRESH_TOKEN_STORAGE_KEY, ' local-refresh ');
    window.sessionStorage.setItem(authStorage.AUTH_SESSION_HINT_STORAGE_KEY, JSON.stringify({
      version: 1,
      hasSessionCookie: true,
      lastAuthenticatedAt: '2026-06-11T00:00:00.000Z',
      persistence: 'legacy',
    }));
    expect(authStorage.readStoredAuthSessionPersistence()).toBe('local');
    expect(authStorage.readStoredRefreshToken()).toBe('local-refresh');
    authStorage.persistAuthSessionHint(' session-refresh ', { persistence: 'session' });
    expect(authStorage.readStoredRefreshToken()).toBe('session-refresh');
    authStorage.clearStoredAuthSessionHint();
    expect(authEvents.length).toBeGreaterThan(0);

    const originalWindow = window;
    vi.stubGlobal('window', undefined);
    expect(authStorage.hasStoredAuthSessionHint()).toBe(false);
    authStorage.persistAuthSessionHint('x');
    authStorage.clearStoredAuthSessionHint();
    vi.stubGlobal('window', originalWindow);

    const { validateContentSafety } = await import('@/utils/contentSafety');
    expect(validateContentSafety([{ field: 'empty', value: null }])).toEqual({ clean: true });
    expect(validateContentSafety([{ field: 'leet', value: 'sc0pe test blocked slur' }])).toMatchObject({
      clean: false,
      field: 'leet',
    });

    const geo = await import('@/utils/geolocation');
    vi.useFakeTimers();
    const clearWatch = vi.fn();
    const getCurrentPosition = vi.fn((success, error) => {
      success({
        coords: { latitude: 1, longitude: 2, accuracy: 3, heading: null, speed: null },
        timestamp: 4,
      });
      error(Object.assign(new Error('late'), { code: 1 }));
    });
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition,
        watchPosition: vi.fn(() => 7),
        clearWatch,
      },
    });
    await expect(geo.getCurrentLocation({ timeout: 5 })).resolves.toMatchObject({ latitude: 1, longitude: 2 });
    geo.stopLocationWatch(7);
    expect(clearWatch).toHaveBeenCalledWith(7);
    vi.useRealTimers();

    const mapbox = await import('@/services/mapboxLoader');
    expect(mapbox.getMapboxToken(undefined).length).toBeGreaterThan(0);
    expect(mapbox.getMapboxToken('')).toBe('');
    expect(mapbox.hasMapboxToken('  token  ')).toBe(true);
    expect(mapbox.resolveMapboxStyle('fallback-style', null)).toBe('fallback-style');
    document.documentElement.style.setProperty('--map-style', '"mapbox://styles/test/style"');
    expect(mapbox.resolveMapboxStyle('fallback-style')).toBe('mapbox://styles/test/style');

    const seo = await import('@/utils/seo');
    document.documentElement.setAttribute('data-theme', 'light');
    document.body.style.backgroundColor = 'rgb(1, 2, 3)';
    const afterEachCallbacks: Array<(route: any) => void> = [];
    seo.initializeSeo({
      currentRoute: {
        value: {
          path: '/custom',
          fullPath: '',
          meta: {
            title: () => false,
            description: '',
            robots: false,
            canonicalPath: false,
            image: false,
            type: '',
          },
        },
      },
      afterEach: (callback: (route: any) => void) => afterEachCallbacks.push(callback),
    } as never);
    await new Promise((resolve) => queueMicrotask(resolve));
    expect(document.title).toContain('Scope Trips');
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    afterEachCallbacks[0]?.({
      path: '/next',
      fullPath: '/next?x=1',
      meta: {
        title: 'Next title',
        description: 'Next description',
        canonicalPath: '/canonical-next',
        image: '/next.png',
        type: 'article',
      },
    });
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toContain('/canonical-next');
    seo.syncThemeColorMeta('light');
    expect(document.head.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.getAttribute('content')).toBe('default');

    const ranking = await import('@/utils/spotRanking');
    const ranked = ranking.rankTrendingSpots([
      { id: 'b', title: 'Bravo', category: 'food', latitude: 1, longitude: 1, rating: 4, likesCount: 1, createdAt: 'bad-date' },
      { id: 'a', title: 'Alpha', category: 'food', latitude: 1, longitude: 1, rating: 4, likesCount: 1, createdAt: 'bad-date' },
    ] as never, -1, Date.parse('2026-06-11T00:00:00Z'));
    expect(ranked).toEqual([]);
    expect(ranking.rankTrendingSpots([
      { id: 'b', title: 'Bravo', category: 'food', latitude: 1, longitude: 1, rating: 4, likesCount: 1, createdAt: 'bad-date' },
      { id: 'a', title: 'Alpha', category: 'food', latitude: 1, longitude: 1, rating: 4, likesCount: 1, createdAt: 'bad-date' },
    ] as never, 2)[0]?.id).toBe('a');

    await flushPromises();
  });
});
