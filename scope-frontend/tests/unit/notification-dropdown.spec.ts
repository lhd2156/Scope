import { reactive } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';

const routerPush = vi.hoisted(() => vi.fn(() => Promise.resolve()));

const notificationsStoreState = reactive({
  items: [] as Array<{
    id: string;
    title: string;
    body: string;
    isRead: boolean;
    createdAt: string;
    type?: string;
    templateKey?: string;
    actionUrl?: string;
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
    return notificationsStoreState.items.find((notification) => notification.id === notificationId);
  }),
  performAction: vi.fn(async () => undefined),
};

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationsStore: () => notificationsStoreMock,
}));

import NotificationDropdown from '@/components/social/NotificationDropdown.vue';

describe('NotificationDropdown', () => {
  const mountDropdown = () => mount(NotificationDropdown, {
    attachTo: document.body,
    global: {
      stubs: {
        ScopeIcon: { template: '<span class="icon-stub" />' },
      },
    },
  });

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
    notificationsStoreMock.performAction.mockClear();
    routerPush.mockClear();
  });

  it('renders a virtualized notification list and routes read actions through the store', async () => {
    const wrapper = mountDropdown();

    expect(wrapper.get('.notification-badge').text()).toBe('2');

    await wrapper.get('.notification-toggle').trigger('click');

    expect(wrapper.text()).toContain('Notifications');
    expect(wrapper.text()).toContain('Update 0');
    expect(wrapper.text()).not.toContain('Update 11');
    expect(wrapper.get('.notification-menu').attributes('role')).toBe('dialog');

    const firstRow = wrapper.findAll('.notification-row__main')[0];
    await firstRow.trigger('click');
    await flushPromises();
    expect(notificationsStoreMock.markRead).toHaveBeenCalledWith('notification-0');
    expect(wrapper.get('.notification-badge').text()).toBe('1');

    await wrapper.get('[data-test="notification-mark-all-read"]').trigger('click');
    await flushPromises();
    expect(notificationsStoreMock.markAllRead).toHaveBeenCalledTimes(1);
    expect(wrapper.find('.notification-badge').exists()).toBe(false);
    expect(wrapper.find('[data-test="notification-mark-all-read"]').exists()).toBe(false);
  });

  it('hydrates the inbox when opened before notifications have loaded', async () => {
    notificationsStoreState.items = [];
    notificationsStoreState.unreadCount = 0;
    notificationsStoreState.hasLoaded = false;

    const wrapper = mountDropdown();

    await wrapper.get('.notification-toggle').trigger('click');

    expect(notificationsStoreMock.fetchNotifications).toHaveBeenCalledTimes(1);
  });

  it('supports keyboard opening, focus movement, and escape dismissal', async () => {
    const wrapper = mountDropdown();

    const trigger = wrapper.get('.notification-toggle');
    (trigger.element as HTMLButtonElement).focus();

    await trigger.trigger('keydown', { key: 'ArrowDown' });
    await flushPromises();

    const panel = wrapper.get('.notification-menu');
    const visibleNotificationButtons = wrapper.findAll('.notification-row__main');
    const lastVisibleNotificationButton = visibleNotificationButtons[visibleNotificationButtons.length - 1];

    expect(trigger.attributes('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(wrapper.get('.link-button').element);

    await panel.trigger('keydown', { key: 'End' });
    await flushPromises();
    expect(document.activeElement).toBe(lastVisibleNotificationButton.element);

    await panel.trigger('keydown', { key: 'Home' });
    await flushPromises();
    expect(document.activeElement).toBe(wrapper.get('.link-button').element);

    await panel.trigger('keydown', { key: 'ArrowDown' });
    await panel.trigger('keydown', { key: 'ArrowUp' });
    await panel.trigger('keydown', { key: 'PageDown' });
    await flushPromises();
    expect(wrapper.find('.notification-menu').exists()).toBe(true);

    await panel.trigger('keydown', { key: 'Escape' });
    await flushPromises();

    expect(wrapper.find('.notification-menu').exists()).toBe(false);
    expect(document.activeElement).toBe(trigger.element);
  });

  it('shows loading skeletons while the inbox is hydrating', async () => {
    notificationsStoreState.items = [];
    notificationsStoreState.unreadCount = 0;
    notificationsStoreState.loading = true;

    const wrapper = mountDropdown();

    await wrapper.get('.notification-toggle').trigger('click');

    expect(wrapper.findAll('.notification-skeleton-row')).toHaveLength(4);
  });

  it('renders a plain empty state when there are no recent notifications', async () => {
    notificationsStoreState.items = [];
    notificationsStoreState.unreadCount = 0;

    const wrapper = mountDropdown();

    await wrapper.get('.notification-toggle').trigger('click');

    expect(wrapper.find('[data-test="notification-dropdown-empty-state"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="empty-state-panel"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('No new Scope updates yet');
  });

  it('routes inbox and notification opens, then handles friend request actions through the store', async () => {
    notificationsStoreState.items = [
      {
        id: 'friend-request-1',
        title: 'Maya sent a friend request',
        body: 'Accept to plan together.',
        isRead: false,
        createdAt: '2026-03-29T10:00:00Z',
        type: 'friend.request',
        templateKey: 'friend.request',
        actionUrl: '/friends',
      },
    ];
    notificationsStoreState.unreadCount = 1;

    const wrapper = mountDropdown();

    await wrapper.get('.notification-toggle').trigger('click');
    await wrapper.get('[data-test="notification-open-inbox"]').trigger('click');
    await flushPromises();
    expect(routerPush).toHaveBeenCalledWith('/notifications');

    await wrapper.get('.notification-toggle').trigger('click');
    await wrapper.get('.notification-row__main').trigger('click');
    await flushPromises();
    expect(notificationsStoreMock.markRead).toHaveBeenCalledWith('friend-request-1');
    expect(routerPush).toHaveBeenCalledWith('/friends');

    await wrapper.get('.notification-toggle').trigger('click');
    await wrapper.findAll('.notification-action').find((button) => button.text() === 'Accept')!.trigger('click');
    await wrapper.findAll('.notification-action').find((button) => button.text() === 'Decline')!.trigger('click');
    await flushPromises();
    expect(notificationsStoreMock.performAction).toHaveBeenNthCalledWith(1, 'friend-request-1', 'accept_friend_request');
    expect(notificationsStoreMock.performAction).toHaveBeenNthCalledWith(2, 'friend-request-1', 'decline_friend_request');
  });

  it('prioritizes realtime connection errors before generic inbox errors', async () => {
    notificationsStoreState.items = [];
    notificationsStoreState.unreadCount = 0;
    notificationsStoreState.connectionError = 'Realtime inbox disconnected.';
    notificationsStoreState.error = 'Older fetch error';

    const wrapper = mountDropdown();

    await wrapper.get('.notification-toggle').trigger('click');

    expect(wrapper.get('[role="alert"]').text()).toBe('Realtime inbox disconnected.');

    notificationsStoreState.connectionError = null;
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe('Older fetch error');
  });

  it('keeps unsafe notification actions local and labels malformed timestamps defensively', async () => {
    notificationsStoreState.items = [
      {
        id: 'read-notification',
        title: 'Unsafe action',
        body: '',
        isRead: true,
        createdAt: 'not-a-date',
        actionUrl: 'https://evil.example/phish',
      },
    ];
    notificationsStoreState.unreadCount = 0;

    const wrapper = mountDropdown();

    await wrapper.get('.notification-toggle').trigger('click');

    expect(wrapper.text()).toContain('Scope update');
    expect(wrapper.text()).toContain('Just now');

    await wrapper.get('.notification-row__main').trigger('click');
    await flushPromises();

    expect(notificationsStoreMock.markRead).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
    expect(wrapper.find('.notification-menu').exists()).toBe(true);
  });

  it('closes by repeated toggle and focus leaving the dropdown', async () => {
    const outsideButton = document.createElement('button');
    outsideButton.textContent = 'Outside';
    document.body.appendChild(outsideButton);
    const wrapper = mountDropdown();

    await wrapper.get('.notification-toggle').trigger('keydown', { key: 'Escape' });
    expect(wrapper.find('.notification-menu').exists()).toBe(false);

    await wrapper.get('.notification-toggle').trigger('keydown', { key: 'ArrowUp' });
    await flushPromises();
    expect(wrapper.find('.notification-menu').exists()).toBe(true);

    await wrapper.trigger('focusout', { relatedTarget: wrapper.get('.link-button').element });
    expect(wrapper.find('.notification-menu').exists()).toBe(true);

    await wrapper.trigger('focusout', { relatedTarget: outsideButton });
    await flushPromises();
    expect(wrapper.find('.notification-menu').exists()).toBe(false);

    await wrapper.get('.notification-toggle').trigger('keydown', { key: ' ' });
    await flushPromises();
    expect(wrapper.find('.notification-menu').exists()).toBe(true);

    outsideButton.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    outsideButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();
    expect(wrapper.find('.notification-menu').exists()).toBe(false);

    await wrapper.get('.notification-toggle').trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(wrapper.find('.notification-menu').exists()).toBe(true);

    await wrapper.get('.notification-toggle').trigger('click');
    expect(wrapper.find('.notification-menu').exists()).toBe(false);

    await wrapper.get('.notification-toggle').trigger('click');
    await flushPromises();
    wrapper.unmount();

    expect(wrapper.emitted('open-change')?.at(-1)).toEqual([false]);
  });
});
