import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const savePushSubscription = vi.hoisted(() => vi.fn());

vi.mock('@/services/feedService', () => ({
  savePushSubscription,
}));

type PushService = typeof import('@/services/pushNotificationService');

const originalNotificationDescriptor = Object.getOwnPropertyDescriptor(window, 'Notification');
const originalGlobalNotificationDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Notification');
const originalPushManagerDescriptor = Object.getOwnPropertyDescriptor(window, 'PushManager');
const originalServiceWorkerDescriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');

function restoreProperty(target: object, key: PropertyKey, descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor);
    return;
  }

  Reflect.deleteProperty(target, key);
}

function setProperty(target: object, key: PropertyKey, value: unknown): void {
  Object.defineProperty(target, key, {
    configurable: true,
    value,
  });
}

function makePushSubscription(keys: Record<string, number[] | null> = {}): PushSubscription {
  return {
    endpoint: 'https://push.example/subscription/123',
    expirationTime: null,
    getKey: vi.fn((keyName: PushEncryptionKeyName) => {
      const values = Object.prototype.hasOwnProperty.call(keys, keyName) ? keys[keyName] : [1, 2, 3];
      return values ? new Uint8Array(values).buffer : null;
    }),
    options: {
      applicationServerKey: null,
      userVisibleOnly: true,
    },
    toJSON: vi.fn(),
    unsubscribe: vi.fn(),
  } as unknown as PushSubscription;
}

function installPushSupport({
  permission = 'granted',
  readyRegistration,
  registeredRegistration,
  registerRejects = false,
}: {
  permission?: NotificationPermission;
  readyRegistration?: ServiceWorkerRegistration | null;
  registeredRegistration?: ServiceWorkerRegistration | null;
  registerRejects?: boolean;
} = {}) {
  const requestPermission = vi.fn(async () => permission);
  const notificationConstructor = { requestPermission };
  const fallbackRegistration = registeredRegistration ?? makeRegistration();
  const ready = readyRegistration === undefined
    ? { catch: vi.fn(async (handler: (error: Error) => null) => handler(new Error('not ready yet'))) }
    : Promise.resolve(readyRegistration);
  const serviceWorker = {
    ready,
    register: registerRejects
      ? vi.fn().mockRejectedValue(new Error('registration failed'))
      : vi.fn().mockResolvedValue(fallbackRegistration),
  };

  setProperty(window, 'Notification', notificationConstructor);
  setProperty(globalThis, 'Notification', notificationConstructor);
  setProperty(window, 'PushManager', vi.fn());
  setProperty(navigator, 'serviceWorker', serviceWorker);

  return {
    fallbackRegistration,
    requestPermission,
    serviceWorker,
  };
}

function makeRegistration(subscription = makePushSubscription()): ServiceWorkerRegistration {
  return {
    pushManager: {
      subscribe: vi.fn().mockResolvedValue(subscription),
    },
  } as unknown as ServiceWorkerRegistration;
}

async function importService(publicKey = 'AQID'): Promise<PushService> {
  vi.resetModules();
  vi.stubEnv('VITE_WEB_PUSH_PUBLIC_KEY', publicKey);
  return import('@/services/pushNotificationService');
}

describe('pushNotificationService', () => {
  beforeEach(() => {
    savePushSubscription.mockReset();
    savePushSubscription.mockResolvedValue(undefined);
  });

  afterEach(() => {
    restoreProperty(window, 'Notification', originalNotificationDescriptor);
    restoreProperty(globalThis, 'Notification', originalGlobalNotificationDescriptor);
    restoreProperty(window, 'PushManager', originalPushManagerDescriptor);
    restoreProperty(navigator, 'serviceWorker', originalServiceWorkerDescriptor);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('subscribes with an existing service worker registration and saves browser push keys', async () => {
    const subscription = makePushSubscription({
      p256dh: [1, 2, 3],
      auth: [4, 5],
    });
    const readyRegistration = makeRegistration(subscription);
    const support = installPushSupport({ readyRegistration });
    const { enableBrowserPushNotifications } = await importService('AQID');

    const result = await enableBrowserPushNotifications();

    expect(result).toEqual({
      ok: true,
      status: 'enabled',
      message: 'Push notifications are enabled for this browser.',
    });
    expect(support.requestPermission).toHaveBeenCalledTimes(1);
    expect(support.serviceWorker.register).not.toHaveBeenCalled();
    expect(readyRegistration.pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array([1, 2, 3]),
    });
    expect(savePushSubscription).toHaveBeenCalledWith({
      endpoint: 'https://push.example/subscription/123',
      p256dh: 'AQID',
      auth: 'BAU=',
      userAgent: navigator.userAgent,
    });
  });

  it('registers the app service worker when no registration is ready', async () => {
    const registeredRegistration = makeRegistration();
    const support = installPushSupport({ registeredRegistration });
    const { enableBrowserPushNotifications } = await importService('AQID');

    await expect(enableBrowserPushNotifications()).resolves.toMatchObject({
      ok: true,
      status: 'enabled',
    });

    expect(support.serviceWorker.register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    expect(registeredRegistration.pushManager.subscribe).toHaveBeenCalledTimes(1);
  });

  it('returns unsupported and not-configured results before requesting permission', async () => {
    const { enableBrowserPushNotifications: unsupportedOptIn } = await importService('AQID');

    await expect(unsupportedOptIn()).resolves.toEqual({
      ok: false,
      status: 'unsupported',
      message: 'This browser does not support web push notifications.',
    });

    const support = installPushSupport();
    const { enableBrowserPushNotifications: missingKeyOptIn } = await importService('');

    await expect(missingKeyOptIn()).resolves.toEqual({
      ok: false,
      status: 'not_configured',
      message: 'Web push is not configured for this Scope environment yet.',
    });
    expect(support.requestPermission).not.toHaveBeenCalled();
  });

  it('returns denied when browser notification permission is refused', async () => {
    const support = installPushSupport({ permission: 'denied' });
    const { enableBrowserPushNotifications } = await importService('AQID');

    await expect(enableBrowserPushNotifications()).resolves.toEqual({
      ok: false,
      status: 'denied',
      message: 'Browser notification permission was not granted.',
    });
    expect(support.serviceWorker.register).not.toHaveBeenCalled();
    expect(savePushSubscription).not.toHaveBeenCalled();
  });

  it('returns failed when service worker registration cannot be resolved', async () => {
    const support = installPushSupport({ registerRejects: true });
    const { enableBrowserPushNotifications } = await importService('AQID');

    await expect(enableBrowserPushNotifications()).resolves.toEqual({
      ok: false,
      status: 'failed',
      message: 'Scope could not register the service worker for push notifications.',
    });
    expect(support.serviceWorker.register).toHaveBeenCalledTimes(1);
    expect(savePushSubscription).not.toHaveBeenCalled();
  });

  it('returns failed when subscribe or API persistence fails', async () => {
    const subscribeFailureRegistration = makeRegistration();
    vi.mocked(subscribeFailureRegistration.pushManager.subscribe).mockRejectedValueOnce(new Error('subscribe failed'));
    installPushSupport({ readyRegistration: subscribeFailureRegistration });
    const { enableBrowserPushNotifications } = await importService('AQID');

    await expect(enableBrowserPushNotifications()).resolves.toEqual({
      ok: false,
      status: 'failed',
      message: 'Scope could not finish browser push setup.',
    });
    expect(savePushSubscription).not.toHaveBeenCalled();

    const saveFailureRegistration = makeRegistration(makePushSubscription({ p256dh: null, auth: [7] }));
    installPushSupport({ readyRegistration: saveFailureRegistration });
    savePushSubscription.mockRejectedValueOnce(new Error('save failed'));
    const { enableBrowserPushNotifications: saveFailureOptIn } = await importService('AQID');

    await expect(saveFailureOptIn()).resolves.toEqual({
      ok: false,
      status: 'failed',
      message: 'Scope could not finish browser push setup.',
    });
    expect(savePushSubscription).toHaveBeenCalledWith(expect.objectContaining({
      p256dh: '',
      auth: 'Bw==',
    }));
  });
});
