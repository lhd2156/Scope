import api, { getAccessToken } from '@/services/api';
import type { PresenceHeartbeatInput, PresenceStatus } from '@/types';

const PRESENCE_BASE_PATH = '/api/core/presence';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || '';
const PRESENCE_ACTIVITY_EVENT = 'scope:presence-activity';
const MIN_HEARTBEAT_INTERVAL_MS = 15_000;
const FAILED_HEARTBEAT_BACKOFF_MS = 30_000;

let lastHeartbeatAt = 0;
let heartbeatBackoffUntil = 0;
let pendingHeartbeatTimer: ReturnType<typeof setTimeout> | null = null;

export interface PresenceActivityDetail extends PresenceHeartbeatInput {
  immediate?: boolean;
}

function normalizePresenceStatus(input: PresenceHeartbeatInput): PresenceStatus {
  if (input.isIdle) {
    return 'idle';
  }

  if (input.isPlanning) {
    return 'planning';
  }

  return input.status ?? 'online';
}

function buildHeartbeatPayload(input: PresenceHeartbeatInput) {
  return {
    status: normalizePresenceStatus(input),
    routeContext: input.routeContext,
    isIdle: Boolean(input.isIdle),
    isPlanning: Boolean(input.isPlanning),
  };
}

function hasDeliverablePresenceSession(): boolean {
  const accessToken = getAccessToken().trim();
  return Boolean(accessToken) && !accessToken.startsWith('scope-qa-') && !accessToken.startsWith('preview-access-');
}

function buildPresenceApiUrl(path: string): string {
  if (!API_BASE_URL || API_BASE_URL === '/') {
    return path;
  }

  return `${API_BASE_URL.replace(/\/+$/, '')}${path}`;
}

async function postHeartbeat(input: PresenceHeartbeatInput): Promise<void> {
  await api.put(`${PRESENCE_BASE_PATH}/heartbeat`, buildHeartbeatPayload(input));
}

export async function sendPresenceHeartbeat(input: PresenceHeartbeatInput = {}, options: { force?: boolean } = {}): Promise<void> {
  if (!hasDeliverablePresenceSession()) {
    stopPendingPresenceWork();
    return;
  }

  const now = Date.now();
  const payload = buildHeartbeatPayload(input);
  if (payload.status !== 'offline' && heartbeatBackoffUntil > now) {
    return;
  }

  const elapsed = now - lastHeartbeatAt;

  if (!options.force && elapsed < MIN_HEARTBEAT_INTERVAL_MS) {
    pendingHeartbeatTimer ??= setTimeout(() => {
      pendingHeartbeatTimer = null;
      void sendPresenceHeartbeat(input, { force: true });
    }, MIN_HEARTBEAT_INTERVAL_MS - elapsed);
    return;
  }

  lastHeartbeatAt = now;
  try {
    await postHeartbeat(input);
    heartbeatBackoffUntil = 0;
  } catch (error) {
    heartbeatBackoffUntil = Date.now() + FAILED_HEARTBEAT_BACKOFF_MS;
    throw error;
  }
}

export function markPresenceActivity(detail: PresenceActivityDetail = {}): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent<PresenceActivityDetail>(PRESENCE_ACTIVITY_EVENT, { detail }));
}

export function markPlanningActivity(routeContext?: string): void {
  markPresenceActivity({
    status: 'planning',
    routeContext,
    isPlanning: true,
    immediate: true,
  });
}

export function listenForPresenceActivity(callback: (detail: PresenceActivityDetail) => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handler = (event: Event) => {
    callback((event as CustomEvent<PresenceActivityDetail>).detail ?? {});
  };

  window.addEventListener(PRESENCE_ACTIVITY_EVENT, handler);
  return () => window.removeEventListener(PRESENCE_ACTIVITY_EVENT, handler);
}

export function stopPendingPresenceWork(): void {
  if (pendingHeartbeatTimer) {
    clearTimeout(pendingHeartbeatTimer);
    pendingHeartbeatTimer = null;
  }
}

export function sendPresenceBeacon(input: PresenceHeartbeatInput): void {
  if (typeof window === 'undefined') {
    return;
  }

  const accessToken = getAccessToken();
  if (!accessToken || accessToken.startsWith('scope-qa-') || accessToken.startsWith('preview-access-')) {
    return;
  }

  try {
    void window.fetch(buildPresenceApiUrl(`${PRESENCE_BASE_PATH}/heartbeat`), {
      method: 'PUT',
      keepalive: true,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildHeartbeatPayload(input)),
    });
  } catch {
    // Page shutdown should never block navigation.
  }
}
