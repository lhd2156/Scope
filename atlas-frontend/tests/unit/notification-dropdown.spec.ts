import { reactive } from 'vue';
import { mount } from '@vue/test-utils';

const notificationsStoreState = reactive({
  items: Array.from({ length: 12 }, (_, index) => ({
    id: `notification-${index}`,
    title: `Update ${index}`,
    body: `Body ${index}`,
    isRead: index > 1,
    createdAt: '2026-03-29T10:00:00Z',
  })),
  unreadCount: 2,
  loading: false,
  connectionError: null as string | null,
  error: '',
});

const notificationsStoreMock = {
  get items() {
    return notificationsStoreState.items;
  },
  get unreadCount() {
    return notificationsStoreState.unreadCount;
  },
  get loading() {
    return notificationsStoreState.loading;
  },
  get connectionError() {
    return notificationsStoreState.connectionError;
  },
  get error() {
    return notificationsStoreState.error;
  },
  markAllRead: vi.fn(async () => undefined),
  markRead: vi.fn(async () => undefined),
};

vi.mock('@/stores/notifications', () => ({
  useNotificationsStore: () => notificationsStoreMock,
}));

import NotificationDropdown from '@/components/social/NotificationDropdown.vue';

describe('NotificationDropdown', () => {
  beforeEach(() => {
    notificationsStoreMock.markAllRead.mockClear();
    notificationsStoreMock.markRead.mockClear();
  });

  it('renders a virtualized notification list and routes read actions through the store', async () => {
    const wrapper = mount(NotificationDropdown, {
      global: {
        stubs: {
          AtlasIcon: { template: '<span class="icon-stub" />' },
        },
      },
    });

    await wrapper.get('.notification-toggle').trigger('click');

    expect(wrapper.text()).toContain('Notifications');
    expect(wrapper.text()).toContain('Update 0');
    expect(wrapper.text()).not.toContain('Update 11');

    await wrapper.get('.link-button').trigger('click');
    expect(notificationsStoreMock.markAllRead).toHaveBeenCalledTimes(1);

    const firstRow = wrapper.findAll('.notification-row')[0];
    await firstRow.trigger('click');
    expect(notificationsStoreMock.markRead).toHaveBeenCalledWith('notification-0');
  });
});
