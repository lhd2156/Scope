import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/App.vue';
import AdminShell from '@/components/AdminShell.vue';
import DashboardPage from '@/pages/DashboardPage.vue';
import LoginPage from '@/pages/LoginPage.vue';
import PhotosPage from '@/pages/PhotosPage.vue';
import ReviewsPage from '@/pages/ReviewsPage.vue';
import SimplePage from '@/pages/SimplePage.vue';
import SpotsPage from '@/pages/SpotsPage.vue';
import UserDetailPage from '@/pages/UserDetailPage.vue';
import UsersPage from '@/pages/UsersPage.vue';
import { useAuthStore } from '@/stores/authStore';
import { useDashboardStore } from '@/stores/dashboardStore';
import { deleteUser, getCurrentUser, getUser, listUsers, loginAdmin, updateUserStatus } from '@/api/core';
import { listPhotos, listReviews, listSpots, moderatePhoto, moderateReview } from '@/api/content';

const routerReplace = vi.fn();

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router');
  return {
    ...actual,
    useRouter: () => ({ replace: routerReplace }),
    useRoute: () => ({ params: { id: 'user-42' } }),
  };
});

vi.mock('@/api/core', () => ({
  deleteUser: vi.fn(),
  getCurrentUser: vi.fn(),
  getUser: vi.fn(),
  listUsers: vi.fn(),
  loginAdmin: vi.fn(),
  updateUserStatus: vi.fn(),
}));

vi.mock('@/api/content', () => ({
  listPhotos: vi.fn(),
  listReviews: vi.fn(),
  listSpots: vi.fn(),
  moderatePhoto: vi.fn(),
  moderateReview: vi.fn(),
}));

vi.mock('@/api/intel', () => ({
  getIntelHealth: vi.fn(),
}));

const adminUser = {
  id: 'admin-1',
  username: 'admin',
  email: 'admin@scope.local',
  role: 'admin',
};

describe('admin app surfaces', () => {
  beforeEach(() => {
    routerReplace.mockReset();
    vi.mocked(loginAdmin).mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' });
    vi.mocked(getCurrentUser).mockResolvedValue(adminUser);
    vi.mocked(listUsers).mockResolvedValue({
      items: [
        { id: 'user-1', username: 'louis', email: 'louis@example.com', role: 'user', status: 'active' },
      ],
      total: 1,
      page: 1,
      pageSize: 25,
    });
    vi.mocked(getUser).mockResolvedValue({
      id: 'user-42',
      username: 'maya',
      email: 'maya@example.com',
      role: 'user',
    });
    vi.mocked(updateUserStatus).mockResolvedValue({
      id: 'user-1',
      username: 'louis',
      email: 'louis@example.com',
      status: 'banned',
    });
    vi.mocked(deleteUser).mockResolvedValue(undefined);
    vi.mocked(listSpots).mockResolvedValue({
      items: [
        {
          id: 'spot-1',
          title: 'River Trail',
          city: 'Fort Worth',
          country: 'US',
          reviewCount: 4,
          flagged: true,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 25,
    });
    vi.mocked(listReviews).mockResolvedValue({
      items: [{ id: 'review-1', rating: 2, spot: 'River Trail', text: 'Needs review', status: 'flagged' }],
      total: 1,
      page: 1,
      pageSize: 25,
    });
    vi.mocked(moderateReview).mockResolvedValue({ id: 'review-1', rating: 2, status: 'approved' });
    vi.mocked(listPhotos).mockResolvedValue({
      items: [{ id: 'photo-1', url: 'https://example.com/photo.jpg', status: 'pending' }],
      total: 1,
      page: 1,
      pageSize: 25,
    });
    vi.mocked(moderatePhoto).mockResolvedValue({
      id: 'photo-1',
      url: 'https://example.com/photo.jpg',
      status: 'approved',
    });
  });

  it('renders the root outlet and authenticated shell logout flow', async () => {
    expect(
      mount(App, { global: { stubs: { RouterView: { template: '<div>route content</div>' } } } }).text(),
    ).toContain('route content');

    const auth = useAuthStore();
    auth.$patch({ currentUser: adminUser, isAuthenticated: true, token: 'access' });
    const shell = mount(AdminShell, {
      global: {
        stubs: {
          RouterLink: RouterLinkStub,
          RouterView: { template: '<section>dashboard outlet</section>' },
        },
      },
    });

    expect(shell.text()).toContain('admin@scope.local');
    expect(shell.text()).toContain('Dashboard');
    await shell.get('button').trigger('click');
    expect(auth.isAuthenticated).toBe(false);
    expect(routerReplace).toHaveBeenCalledWith('/login');
  });

  it('submits successful and failed login attempts', async () => {
    const success = mount(LoginPage);
    await success.get('input[type="email"]').setValue('admin@scope.local');
    await success.get('input[type="password"]').setValue('pw');
    await success.get('form').trigger('submit.prevent');
    await flushPromises();

    expect(routerReplace).toHaveBeenCalledWith('/dashboard');

    vi.mocked(loginAdmin).mockRejectedValueOnce(new Error('nope'));
    const failed = mount(LoginPage);
    await failed.get('input[type="email"]').setValue('admin@scope.local');
    await failed.get('input[type="password"]').setValue('bad');
    await failed.get('form').trigger('submit.prevent');
    await flushPromises();

    expect(failed.text()).toContain('Login failed');
  });

  it('refreshes dashboard metrics and activity', async () => {
    const wrapper = mount(DashboardPage);
    await flushPromises();

    expect(wrapper.text()).toContain('Total Users');
    expect(listUsers).toHaveBeenCalledWith({ page: 1, pageSize: 1 });

    const dashboard = useDashboardStore();
    dashboard.$patch({
      loading: true,
      userGrowth: [{ label: 'No users yet' }],
      spotGrowth: [{ label: 'No spots yet' }],
      engagement: [{ label: 'No likes yet' }],
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Refreshing...');
    expect(wrapper.findAll('.bar-row span').map((bar) => bar.attributes('style'))).toEqual([
      'height: 20px;',
      'height: 20px;',
      'height: 20px;',
    ]);
  });

  it('drives user search, pagination, status, and delete actions', async () => {
    const wrapper = mount(UsersPage, { global: { stubs: { RouterLink: RouterLinkStub } } });
    await flushPromises();

    expect(wrapper.text()).toContain('louis@example.com');
    await wrapper.get('input').setValue('louis');
    await wrapper.get('form').trigger('submit.prevent');
    await flushPromises();
    expect(listUsers).toHaveBeenLastCalledWith({ page: 1, pageSize: 25, search: 'louis' });

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Toggle status')
      ?.trigger('click');
    await flushPromises();
    expect(updateUserStatus).toHaveBeenCalledWith('user-1', 'banned');

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Delete')
      ?.trigger('click');
    await flushPromises();
    expect(deleteUser).toHaveBeenCalledWith('user-1');

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Next')
      ?.trigger('click');
    await flushPromises();
    expect(listUsers).toHaveBeenLastCalledWith({ page: 2, pageSize: 25, search: 'louis' });

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Previous')
      ?.trigger('click');
    await flushPromises();
    expect(listUsers).toHaveBeenLastCalledWith({ page: 1, pageSize: 25, search: 'louis' });
  });

  it('renders default user fields and reactivates banned users', async () => {
    vi.mocked(listUsers).mockResolvedValueOnce({
      items: [
        { id: 'user-banned', username: 'blocked', email: 'blocked@example.com', status: 'banned' },
        { id: 'user-defaults', username: 'defaults', email: 'defaults@example.com' },
      ],
      total: 2,
      page: 1,
      pageSize: 25,
    });

    const wrapper = mount(UsersPage, { global: { stubs: { RouterLink: RouterLinkStub } } });
    await flushPromises();

    expect(wrapper.text()).toContain('active');
    expect(wrapper.text()).toContain('user');
    await wrapper.findAll('button').find((button) => button.text() === 'Toggle status')?.trigger('click');
    await flushPromises();

    expect(updateUserStatus).toHaveBeenCalledWith('user-banned', 'active');
  });

  it('renders spots, reviews, photos, simple pages, and user fallback detail', async () => {
    vi.mocked(listSpots).mockResolvedValueOnce({
      items: [
        {
          id: 'spot-1',
          title: 'River Trail',
          city: 'Fort Worth',
          country: 'US',
          reviewCount: 4,
          flagged: true,
        },
        { id: 'spot-2', name: 'Fallback Name', location: 'Somewhere', review_count: 2, flagged: false },
        { id: 'spot-3', title: 'Mystery Pin' },
      ],
      total: 3,
      page: 1,
      pageSize: 25,
    });
    const spots = mount(SpotsPage);
    await flushPromises();
    expect(spots.text()).toContain('River Trail');
    expect(spots.text()).toContain('Fallback Name');
    expect(spots.text()).toContain('Unknown');
    await spots.get('select').setValue('true');
    await flushPromises();
    expect(listSpots).toHaveBeenLastCalledWith({ page: 1, pageSize: 25, flagged: 'true' });

    const reviews = mount(ReviewsPage);
    await flushPromises();
    expect(reviews.text()).toContain('Needs review');
    await reviews
      .findAll('button')
      .find((button) => button.text() === 'Approve')
      ?.trigger('click');
    await flushPromises();
    expect(moderateReview).toHaveBeenCalledWith('review-1', 'approved');
    await reviews
      .findAll('button')
      .find((button) => button.text() === 'Reject')
      ?.trigger('click');
    await flushPromises();
    expect(moderateReview).toHaveBeenCalledWith('review-1', 'rejected');

    vi.mocked(listReviews).mockResolvedValueOnce({
      items: [
        { id: 'review-comment', rating: 4, comment: 'Fallback comment' },
        { id: 'review-empty', rating: 3 },
      ],
      total: 2,
      page: 1,
      pageSize: 25,
    });
    const fallbackReviews = mount(ReviewsPage);
    await flushPromises();
    expect(fallbackReviews.text()).toContain('Spot review');
    expect(fallbackReviews.text()).toContain('Fallback comment');
    expect(fallbackReviews.text()).toContain('No comment');

    vi.mocked(listPhotos).mockResolvedValueOnce({
      items: [
        { id: 'photo-1', url: 'https://example.com/photo.jpg', status: 'pending' },
        { id: 'photo-2', url: 'https://example.com/photo-2.jpg' },
      ],
      total: 2,
      page: 1,
      pageSize: 25,
    });
    const photos = mount(PhotosPage);
    await flushPromises();
    await photos.get('input[type="checkbox"]').setValue(true);
    await photos.get('input[type="checkbox"]').setValue(false);
    await photos.get('input[type="checkbox"]').setValue(true);
    await photos.get('button').trigger('click');
    await flushPromises();
    expect(moderatePhoto).toHaveBeenCalledWith('photo-1', 'approved');

    const simple = mount(SimplePage, { props: { title: 'Settings', description: 'Admin controls.' } });
    expect(simple.text()).toContain('Settings');

    const detail = mount(UserDetailPage);
    await flushPromises();
    expect(detail.text()).toContain('maya@example.com');

    vi.mocked(getUser).mockRejectedValueOnce(new Error('missing'));
    const fallback = mount(UserDetailPage);
    await flushPromises();
    expect(fallback.text()).toContain('unknown@scope.local');
  });
});
