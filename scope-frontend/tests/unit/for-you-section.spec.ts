import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import ForYouSection from '@/components/common/ForYouSection.vue';
import type { SpotCategory, SpotSummary } from '@/types';

const { authStoreHolder, recommendSpotsMock } = vi.hoisted(() => ({
  authStoreHolder: {
    store: undefined as
      | {
          isAuthenticated: boolean;
          currentUser: { id: string; interests: string[] } | null;
        }
      | undefined,
  },
  recommendSpotsMock: vi.fn(),
}));

vi.mock('@/stores/auth', async () => {
  const { reactive } = await import('vue');

  authStoreHolder.store ??= reactive({
    isAuthenticated: true,
    currentUser: {
      id: 'user-1',
      interests: [],
    },
  });

  return {
    useAuthStore: () => authStoreHolder.store,
  };
});

vi.mock('@/services/intelService', () => ({
  recommendSpots: recommendSpotsMock,
}));

function createSpot(category: SpotCategory): SpotSummary {
  return {
    id: `spot-${category}`,
    title: `${category} place`,
    description: `${category} recommendation`,
    latitude: 32.7,
    longitude: -97.3,
    city: 'Fort Worth',
    country: 'United States',
    category,
    vibe: `${category} energy`,
    rating: 4.7,
    createdAt: '2026-05-01T00:00:00.000Z',
    likesCount: 12,
  };
}

function mountForYouSection() {
  return mount(ForYouSection, {
    global: {
      stubs: {
        LazyImage: { props: ['alt'], template: '<img :alt="alt" />' },
        ScopeIcon: { template: '<svg />' },
        StarRatingDisplay: { template: '<span />' },
        RouterLink: { props: ['to'], template: '<a><slot /></a>' },
      },
    },
  });
}

describe('ForYouSection', () => {
  beforeEach(() => {
    authStoreHolder.store!.isAuthenticated = true;
    authStoreHolder.store!.currentUser = {
      id: 'user-1',
      interests: [],
    };
    recommendSpotsMock.mockReset();
    recommendSpotsMock.mockResolvedValue({ data: [createSpot('food')] });
  });

  it('normalizes account vibes before asking for personalized recommendations', async () => {
    authStoreHolder.store!.currentUser!.interests = [' Food ', 'SCENIC', 'unknown', 'other', 'food'];

    mountForYouSection();
    await flushPromises();

    expect(recommendSpotsMock).toHaveBeenCalledWith({
      interests: ['food', 'scenic'],
      limit: 6,
    });
  });

  it('refreshes recommendations when account vibes change during the session', async () => {
    authStoreHolder.store!.currentUser!.interests = ['food'];
    recommendSpotsMock
      .mockResolvedValueOnce({ data: [createSpot('food')] })
      .mockResolvedValueOnce({ data: [createSpot('culture')] });

    const wrapper = mountForYouSection();
    await flushPromises();

    expect(wrapper.text()).toContain('food place');
    expect(recommendSpotsMock).toHaveBeenLastCalledWith({
      interests: ['food'],
      limit: 6,
    });

    authStoreHolder.store!.currentUser!.interests = ['culture', 'other'];
    await nextTick();
    await flushPromises();

    expect(recommendSpotsMock).toHaveBeenLastCalledWith({
      interests: ['culture'],
      limit: 6,
    });
    expect(wrapper.text()).toContain('culture place');
  });

  it('stays hidden for guests and treats recommendation failures as best-effort', async () => {
    authStoreHolder.store!.isAuthenticated = false;

    const guestWrapper = mountForYouSection();
    await flushPromises();

    expect(recommendSpotsMock).not.toHaveBeenCalled();
    expect(guestWrapper.html()).toBe('<!--v-if-->');

    authStoreHolder.store!.isAuthenticated = true;
    recommendSpotsMock.mockRejectedValueOnce(new Error('recommendations offline'));
    const authenticatedWrapper = mountForYouSection();
    await flushPromises();

    expect(authenticatedWrapper.html()).toBe('<!--v-if-->');
  });

  it('renders fallback copy and recommendation reasons from category, saves, vibe, and graph signal', async () => {
    authStoreHolder.store!.currentUser!.interests = ['nature'];
    recommendSpotsMock.mockResolvedValueOnce({
      data: [
        {
          ...createSpot('nature'),
          id: 'spot-nature-match',
          title: 'Nature match',
          description: '',
          city: '',
          country: '',
          vibe: '',
          likesCount: 0,
        },
        {
          ...createSpot('food'),
          id: 'spot-food-saves',
          title: 'Food saves',
          description: '  ',
          vibe: '',
          likesCount: 22,
        },
        {
          ...createSpot('culture'),
          id: 'spot-culture-vibe',
          title: 'Culture vibe',
          description: '',
          vibe: 'quiet gallery',
          likesCount: 0,
        },
        {
          ...createSpot('shopping'),
          id: 'spot-shopping-signal',
          title: 'Shopping signal',
          description: '',
          vibe: '',
          likesCount: 0,
        },
      ],
    });

    const wrapper = mountForYouSection();
    await flushPromises();

    expect(wrapper.text()).toContain('4 matches');
    expect(wrapper.text()).toContain('Scope recommendation');
    expect(wrapper.text()).toContain('A strong nature pick from the current Scope graph.');
    expect(wrapper.text()).toContain('Nature match');
    expect(wrapper.text()).toContain('22 saves');
    expect(wrapper.text()).toContain('Quiet Gallery energy with enough community signal to make the shortlist.');
    expect(wrapper.text()).toContain('Quiet Gallery');
    expect(wrapper.text()).toContain('Scope signal');
  });

  it('ignores stale recommendation responses when preferences change quickly', async () => {
    const firstRequest = Promise.withResolvers<{ data: SpotSummary[] }>();
    const secondRequest = Promise.withResolvers<{ data: SpotSummary[] }>();
    authStoreHolder.store!.currentUser!.interests = ['food'];
    recommendSpotsMock
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    const wrapper = mountForYouSection();
    await nextTick();

    authStoreHolder.store!.currentUser!.interests = ['culture'];
    await nextTick();

    secondRequest.resolve({ data: [createSpot('culture')] });
    await flushPromises();
    expect(wrapper.text()).toContain('culture place');

    firstRequest.resolve({ data: [createSpot('food')] });
    await flushPromises();
    expect(wrapper.text()).toContain('culture place');
    expect(wrapper.text()).not.toContain('food place');
  });
});
