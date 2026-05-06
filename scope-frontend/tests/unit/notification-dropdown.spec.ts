import { reactive } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';

const notificationsStoreState = reactive({
  items: [] as Array<{
    id: string;
    title: string;
    body: string;
    isRead: boolean;
    createdAt: string;
  }>,
  unreadCount: 0,
  loading: false,
  hasLoaded: true,
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
  get hasLoaded() {
    return notificationsStoreState.hasLoaded;
  },
  get connectionError() {
    return notificationsStoreState.connectionError;
  },
  get error() {
    return notificationsStoreState.error;
  },
  fetchNotifications: vi.fn(async () => undefined),
  markAllRead: vi.fn(async () => {
    notificationsStoreState.items = notificationsStoreState.items.map((notification) => ({
      ...notification,
      isRead: true,
    }));
    notificationsStoreState.unreadCount = 0;
  }),
  markRead: vi.fn(async (notificationId: string) => {
    notificationsStoreState.items = notificationsStoreState.items.map((notification) =>
      notification.id === notificationId ? { ...notification, isRead: true } : notification,
    );
    notificationsStoreState.unreadCount = notificationsStoreState.items.filter((notification) => !notification.isRead).length;
  }),
};

vi.mock('@/stores/notifications', () => ({
  useNotificationsStore: () => notificationsStoreMock,
}));

import NotificationDropdown from '@/components/social/NotificationDropdown.vue';

describe('NotificationDropdown', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    notificationsStoreState.items = Array.from({ length: 12 }, (_, index) => ({
      id: `notification-${index}`,
      title: `Update ${index}`,
      body: `Body ${index}`,
      isRead: index > 1,
      createdAt: '2026-03-29T10:00:00Z',
    }));
    notificationsStoreState.unreadCount = 2;
    notificationsStoreState.loading = false;
    notificationsStoreState.hasLoaded = true;
    notificationsStoreState.connectionError = null;
    notificationsStoreState.error = '';
    notificationsStoreMock.fetchNotifications.mockClear();
    notificationsStoreMock.markAllRead.mockClear();
    notificationsStoreMock.markRead.mockClear();
  });

  it('renders a virtualized notification list and routes read actions through the store', async () => {
    const wrapper = mount(NotificationDropdown, {
      attachTo: document.body,
      global: {
        stubs: {
          ScopeIcon: { template: '<span class="icon-stub" />' },
        },
      },
    });

    expect(wrapper.get('.notification-badge').text()).toBe('2');

    await wrapper.get('.notification-toggle').trigger('click');

    expect(wrapper.text()).toContain('Notifications');
    expect(wrapper.text()).toContain('Update 0');
    expect(wrapper.text()).not.toContain('Update 11');
    expect(wrapper.get('.notification-menu').attributes('role')).toBe('dialog');

    const firstRow = wrapper.findAll('.notification-row')[0];
    await firstRow.trigger('click');
    await flushPromises();
    expect(notificationsStoreMock.markRead).toHaveBeenCalledWith('notification-0');
    expect(wrapper.get('.notification-badge').text()).toBe('1');

    await wrapper.get('.link-button').trigger('click');
    await flushPromises();
    expect(notificationsStoreMock.markAllRead).toHaveBeenCalledTimes(1);
    expect(wrapper.find('.notification-badge').exists()).toBe(false);
    expect(wrapper.find('.link-button').exists()).toBe(false);
  });

  it('hydrates the inbox when opened before notifications have loaded', async () => {
    notificationsStoreState.items = [];
    notificationsStoreState.unreadCount = 0;
    notificationsStoreState.hasLoaded = false;

    const wrapper = mount(NotificationDropdown, {
      attachTo: document.body,
      global: {
        stubs: {
          ScopeIcon: { template: '<span class="icon-stub" />' },
        },
      },
    });

    await wrapper.get('.notification-toggle').trigger('click');

    expect(notificationsStoreMock.fetchNotifications).toHaveBeenCalledTimes(1);
  });

  it('supports keyboard opening, focus movement, and escape dismissal', async () => {
    const wrapper = mount(NotificationDropdown, {
      attachTo: document.body,
      global: {
        stubs: {
          ScopeIcon: { template: '<span class="icon-stub" />' },
        },
      },
    });

    const trigger = wrapper.get('.notification-toggle');
    (trigger.element as HTMLButtonElement).focus();

    await trigger.trigger('keydown', { key: 'ArrowDown' });
    await flushPromises();

    const panel = wrapper.get('.notification-menu');
    const visibleNotificationRows = wrapper.findAll('.notification-row');
    const lastVisibleNotificationRow = visibleNotificationRows[visibleNotificationRows.length - 1];

    expect(trigger.attributes('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(wrapper.get('.link-button').element);

    await panel.trigger('keydown', { key: 'End' });
    await flushPromises();
    expect(document.activeElement).toBe(lastVisibleNotificationRow.element);

    await panel.trigger('keydown', { key: 'Escape' });
    await flushPromises();

    expect(wrapper.find('.notification-menu').exists()).toBe(false);
    expect(document.activeElement).toBe(trigger.element);
  });

  it('shows loading skeletons while the inbox is hydrating', async () => {
    notificationsStoreState.items = [];
    notificationsStoreState.unreadCount = 0;
    notificationsStoreState.loading = true;

    const wrapper = mount(NotificationDropdown, {
      global: {
        stubs: {
          ScopeIcon: { template: '<span class="icon-stub" />' },
        },
      },
    });

    await wrapper.get('.notification-toggle').trigger('click');

    expect(wrapper.findAll('.notification-skeleton-row')).toHaveLength(4);
  });

  it('renders an empty-state panel when there are no recent notifications', async () => {
    notificationsStoreState.items = [];
    notificationsStoreState.unreadCount = 0;

    const wrapper = mount(NotificationDropdown, {
      global: {
        stubs: {
          ScopeIcon: { template: '<span class="icon-stub" />' },
        },
      },
    });

    await wrapper.get('.notification-toggle').trigger('click');

    expect(wrapper.find('[data-test="empty-state-panel"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('No new Scope updates yet');
  });
});
