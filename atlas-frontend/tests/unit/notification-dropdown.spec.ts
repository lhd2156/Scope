import { mount } from '@vue/test-utils';
import NotificationDropdown from '@/components/social/NotificationDropdown.vue';
import type { NotificationItem } from '@/types';

const notifications: NotificationItem[] = [
  {
    id: 'notification-1',
    title: 'Trip member joined',
    body: 'Maya joined North Texas Night + Food Loop.',
    isRead: false,
    createdAt: '2026-03-27T03:00:00Z',
    type: 'trip.member.added',
  },
  {
    id: 'notification-2',
    title: 'Spot liked',
    body: 'Elijah liked Sunset Rooftop Tacos.',
    isRead: true,
    createdAt: '2026-03-26T21:14:00Z',
    type: 'spot.liked',
  },
];

describe('NotificationDropdown', () => {
  it('opens the inbox and emits read actions', async () => {
    const wrapper = mount(NotificationDropdown, {
      props: {
        notifications,
        unreadCount: 1,
        inlinePanel: true,
      },
    });

    expect(wrapper.text()).toContain('Notifications');
    expect(wrapper.text()).toContain('Trip member joined');

    await wrapper.get('.notification-card').trigger('click');
    await wrapper.get('.text-button').trigger('click');

    expect(wrapper.emitted('read')?.[0]).toEqual(['notification-1']);
    expect(wrapper.emitted('mark-all-read')).toBeTruthy();
  });
});
