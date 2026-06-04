import { savePushSubscription } from '@/services/feedService';

export interface PushOptInResult {
  ok: boolean;
  status: 'enabled' | 'denied' | 'unsupported' | 'not_configured' | 'failed';
  message: string;
}

const WEB_PUSH_PUBLIC_KEY = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY?.trim() || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

function isPushSupported(): boolean {
  return typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window;
}

function readSubscriptionKey(subscription: PushSubscription, keyName: PushEncryptionKeyName): string {
  const key = subscription.getKey(keyName);
  if (!key) {
    return '';
  }

  const bytes = new Uint8Array(key);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

async function ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  const existingRegistration = await navigator.serviceWorker.ready.catch(() => null);
  if (existingRegistration) {
    return existingRegistration;
  }

  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}

export async function enableBrowserPushNotifications(): Promise<PushOptInResult> {
  if (!isPushSupported()) {
    return {
      ok: false,
      status: 'unsupported',
      message: 'This browser does not support web push notifications.',
    };
  }

  if (!WEB_PUSH_PUBLIC_KEY) {
    return {
      ok: false,
      status: 'not_configured',
      message: 'Web push is not configured for this Scope environment yet.',
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return {
      ok: false,
      status: 'denied',
      message: 'Browser notification permission was not granted.',
    };
  }

  const registration = await ensureServiceWorkerRegistration();
  if (!registration) {
    return {
      ok: false,
      status: 'failed',
      message: 'Scope could not register the service worker for push notifications.',
    };
  }

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(WEB_PUSH_PUBLIC_KEY),
    });

    await savePushSubscription({
      endpoint: subscription.endpoint,
      p256dh: readSubscriptionKey(subscription, 'p256dh'),
      auth: readSubscriptionKey(subscription, 'auth'),
      userAgent: navigator.userAgent,
    });

    return {
      ok: true,
      status: 'enabled',
      message: 'Push notifications are enabled for this browser.',
    };
  } catch {
    return {
      ok: false,
      status: 'failed',
      message: 'Scope could not finish browser push setup.',
    };
  }
}
