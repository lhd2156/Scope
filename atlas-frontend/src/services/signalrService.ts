import * as signalR from '@microsoft/signalr';
import type { NotificationConnectionState, NotificationItem } from '@/types';

const NOTIFICATION_HUB_URL = '/api/core/hubs/notifications';
const NOTIFICATION_RECEIVED_EVENT = 'NotificationReceived';
const RECONNECT_DELAYS_MS = [0, 2_000, 10_000, 30_000];
const MOCK_AUTH_FALLBACK_ENABLED = import.meta.env.VITE_ENABLE_AUTH_MOCK_FALLBACK === 'true';
const VISUAL_QA_FLAG = '__ATLAS_VISUAL_QA__';

export interface NotificationStreamOptions {
  accessTokenFactory: () => string;
  onNotification: (notification: NotificationItem) => void;
  onStateChange?: (state: NotificationConnectionState) => void;
  onError?: (message: string | null) => void;
}

let activeConnection: signalR.HubConnection | null = null;
let activeOptions: NotificationStreamOptions | null = null;
let startPromise: Promise<void> | null = null;

function serializeError(error: unknown): string | null {
  if (!error) {
    return null;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function emitState(state: NotificationConnectionState) {
  activeOptions?.onStateChange?.(state);
}

function emitError(error: unknown) {
  activeOptions?.onError?.(serializeError(error));
}

function isVisualQaSession() {
  if (typeof window === 'undefined') {
    return false;
  }

  return Boolean((window as Window & { __ATLAS_VISUAL_QA__?: boolean })[VISUAL_QA_FLAG]);
}

function normalizeNotification(notification: NotificationItem): NotificationItem {
  return {
    ...notification,
    isRead: notification.isRead,
  };
}

function buildConnection(options: NotificationStreamOptions): signalR.HubConnection {
  const connection = new signalR.HubConnectionBuilder()
    .withUrl(NOTIFICATION_HUB_URL, {
      accessTokenFactory: options.accessTokenFactory,
    })
    .withAutomaticReconnect(RECONNECT_DELAYS_MS)
    .configureLogging(import.meta.env.DEV ? signalR.LogLevel.Information : signalR.LogLevel.Warning)
    .build();

  connection.on(NOTIFICATION_RECEIVED_EVENT, (notification: NotificationItem) => {
    activeOptions?.onNotification(normalizeNotification(notification));
  });

  connection.onreconnecting((error) => {
    emitState('reconnecting');
    emitError(error);
  });

  connection.onreconnected(() => {
    emitState('connected');
    emitError(null);
  });

  connection.onclose((error) => {
    emitState('disconnected');
    emitError(error);
  });

  return connection;
}

function ensureConnection(options: NotificationStreamOptions): signalR.HubConnection {
  if (!activeConnection) {
    activeConnection = buildConnection(options);
  }

  return activeConnection;
}

export async function startNotificationStream(options: NotificationStreamOptions): Promise<void> {
  activeOptions = options;

  if (MOCK_AUTH_FALLBACK_ENABLED || isVisualQaSession()) {
    emitState('idle');
    emitError(null);
    return;
  }

  const accessToken = options.accessTokenFactory().trim();
  if (!accessToken) {
    emitState('idle');
    emitError(null);
    return;
  }

  const connection = ensureConnection(options);

  if (connection.state === signalR.HubConnectionState.Connected) {
    emitState('connected');
    emitError(null);
    return;
  }

  if (connection.state === signalR.HubConnectionState.Reconnecting) {
    emitState('reconnecting');
    return;
  }

  if (startPromise) {
    return startPromise;
  }

  emitState('connecting');
  emitError(null);

  startPromise = connection
    .start()
    .then(() => {
      emitState('connected');
      emitError(null);
    })
    .catch((error) => {
      emitState('disconnected');
      emitError(error);
      throw error;
    })
    .finally(() => {
      startPromise = null;
    });

  return startPromise;
}

export async function stopNotificationStream(): Promise<void> {
  const previousOptions = activeOptions;
  activeOptions = null;

  if (startPromise) {
    try {
      await startPromise;
    } catch {
      // Ignore startup failures during teardown.
    }
  }

  if (activeConnection && activeConnection.state !== signalR.HubConnectionState.Disconnected) {
    await activeConnection.stop();
  }

  activeConnection = null;
  startPromise = null;
  previousOptions?.onError?.(null);
  previousOptions?.onStateChange?.('idle');
}
