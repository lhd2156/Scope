import type { NotificationItem } from '@/types';

type NotificationHandler = (notification: NotificationItem) => void;

let intervalHandle: number | undefined;

export function startNotificationStream(handler: NotificationHandler): void {
  stopNotificationStream();
  intervalHandle = window.setInterval(() => {
    handler({
      id: `notification-live-${Date.now()}`,
      title: 'Live update connected',
      body: 'SignalR client scaffold is active and ready for backend wiring.',
      isRead: false,
      createdAt: new Date().toISOString(),
      type: 'system.connected',
    });
  }, 60000);
}

export function stopNotificationStream(): void {
  if (intervalHandle) {
    window.clearInterval(intervalHandle);
    intervalHandle = undefined;
  }
}
