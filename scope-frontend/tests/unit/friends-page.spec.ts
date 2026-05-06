import { createPinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';

const trackFriendAddMock = vi.hoisted(() => vi.fn());
const searchUsersMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/analyticsService', () => ({
  trackFriendAdd: trackFriendAddMock,
}));

vi.mock('@/services/userService', () => ({
  searchUsers: searchUsersMock,
}));

import FriendsPage from '@/views/FriendsPage.vue';

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/friends', component: FriendsPage },
      { path: '/profile/:id', component: { template: '<div>Profile target</div>' } },
    ],
  });
}

const globalStubs = {
  AppShell: { template: '<div><slot /></div>' },
  ScopeIcon: { props: ['name'], template: '<span class="icon-stub">{{ name }}</span>' },
  Avatar: { props: ['name'], template: '<div class="avatar-stub">{{ name }}</div>' },
  LazyImage: { props: ['src', 'alt'], template: '<img class="lazy-image-stub" :src="src" :alt="alt" />' },
};

describe('FriendsPage', () => {
  beforeEach(() => {
    searchUsersMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    trackFriendAddMock.mockReset();
  });

  it('renders an empty travel circle for brand-new accounts and prompts the find-people search', () => {
    const router = createTestRouter();
    const wrapper = mount(FriendsPage, {
      global: {
        plugins: [router, createPinia()],
        stubs: globalStubs,
      },
    });

    expect(wrapper.text()).toContain('Build your Scope travel circle.');
    expect(wrapper.findAll('[data-test="friend-card"]')).toHaveLength(0);
    expect(wrapper.findAll('[data-test="request-card"]')).toHaveLength(0);
    expect(wrapper.findAll('[data-test="suggestion-card"]')).toHaveLength(0);
    expect(wrapper.get('[data-test="tab-all"]').text()).toContain('0');
    expect(wrapper.get('[data-test="tab-requests"]').text()).toContain('0');
    expect(wrapper.text()).toContain('Your travel circle is still forming');
    expect(wrapper.text()).toContain('Add real Scope members');
    expect(wrapper.get('[data-test="find-people-search"]').exists()).toBe(true);
  });

  it('searches real Scope members and sends a friend request', async () => {
    vi.useFakeTimers();

    const priya = {
      id: 'user-6',
      username: 'priya.nair',
      email: 'priya@example.com',
      displayName: 'Priya Nair',
      avatarUrl: 'https://example.com/priya.png',
      homeBase: 'Houston, TX',
      interests: ['food', 'culture'],
    };

    searchUsersMock.mockResolvedValue({
      data: [priya],
      meta: { page: 1, pageSize: 1, total: 1, totalPages: 1 },
    });

    const router = createTestRouter();
    const wrapper = mount(FriendsPage, {
      global: {
        plugins: [router, createPinia()],
        stubs: globalStubs,
      },
    });

    await wrapper.get('input[aria-label="Find Scope members"]').setValue('priya');
    // SearchBar debounces (300ms) before emitting, then FriendsPage debounces (280ms) before calling the API.
    await vi.advanceTimersByTimeAsync(650);
    await flushPromises();

    expect(searchUsersMock).toHaveBeenCalledWith('priya', 1, expect.any(Number));
    const results = wrapper.findAll('[data-test="suggestion-card"]');
    expect(results).toHaveLength(1);
    expect(wrapper.text()).toContain('Priya Nair');
    expect(wrapper.text()).toContain('@priya.nair');

    const sendButton = wrapper.get('[data-test="send-request-user-6"]');
    expect(sendButton.text()).toContain('Send request');

    await sendButton.trigger('click');
    // Flush the dynamic analytics import chain before asserting the tracking call.
    await flushPromises();
    await flushPromises();

    expect(sendButton.text()).toContain('Request sent');
    expect((sendButton.element as HTMLButtonElement).disabled).toBe(true);
    expect(trackFriendAddMock).toHaveBeenCalledWith(expect.objectContaining({
      routeName: 'friends',
      source: 'search',
      userId: 'user-6',
    }));
  });

  it('shows a helpful empty state when search returns no results', async () => {
    vi.useFakeTimers();

    searchUsersMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 0, total: 0, totalPages: 1 },
    });

    const router = createTestRouter();
    const wrapper = mount(FriendsPage, {
      global: {
        plugins: [router, createPinia()],
        stubs: globalStubs,
      },
    });

    await wrapper.get('input[aria-label="Find Scope members"]').setValue('nobody-here');
    await vi.advanceTimersByTimeAsync(650);
    await flushPromises();

    expect(wrapper.text()).toContain('No Scope members matched');
  });

  it('surfaces an API failure message without crashing the page', async () => {
    vi.useFakeTimers();

    searchUsersMock.mockRejectedValue(new Error('network down'));

    const router = createTestRouter();
    const wrapper = mount(FriendsPage, {
      global: {
        plugins: [router, createPinia()],
        stubs: globalStubs,
      },
    });

    await wrapper.get('input[aria-label="Find Scope members"]').setValue('priya');
    await vi.advanceTimersByTimeAsync(650);
    await flushPromises();

    expect(wrapper.get('[data-test="find-people-error"]').text()).toContain('member search');
  });
});
