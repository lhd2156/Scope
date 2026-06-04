import api from '@/services/api';
import { isScopeQaMode } from '@/utils/qaMode';

const INTERACTIONS_PATH = '/api/content/interactions/';

export type InteractionType =
  | 'view'
  | 'dwell'
  | 'click'
  | 'like'
  | 'save'
  | 'visit'
  | 'review'
  | 'share'
  | 'dismiss'
  | 'hide';

export interface InteractionEvent {
  spotId: string;
  type: InteractionType;
  context?: Record<string, unknown>;
}

// Pending events batched until the next flush. The ledger is high-volume
// (every card impression is a view), so we never want a single request per
// event; we coalesce and send on a timer / on beforeunload.
const pendingEvents: InteractionEvent[] = [];
const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_MAX_BATCH = 25;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let beforeUnloadBound = false;

function scheduleFlush(): void {
  if (flushTimer !== null) {
    return;
  }
  if (typeof window !== 'undefined' && !beforeUnloadBound) {
    window.addEventListener('beforeunload', () => {
      void flushInteractions();
    });
    beforeUnloadBound = true;
  }
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushInteractions();
  }, FLUSH_INTERVAL_MS);
}

async function postInteraction(event: InteractionEvent): Promise<void> {
  // Content's interactions endpoint is one-event-per-call by design (keeps
  // the serializer dead simple). We still enforce a small concurrency cap by
  // sequencing the flush, so a batch of 25 produces 25 serialized requests
  // instead of a thundering herd.
  await api.post(INTERACTIONS_PATH, {
    spotId: event.spotId,
    interactionType: event.type,
    context: event.context ?? null,
  });
}

export function logInteraction(event: InteractionEvent): void {
  // In QA / demo mode, skip the wire call entirely -- there's no authenticated
  // user to attribute it to and the backend may not be up.
  if (isScopeQaMode()) {
    return;
  }
  pendingEvents.push(event);
  if (pendingEvents.length >= FLUSH_MAX_BATCH) {
    void flushInteractions();
    return;
  }
  scheduleFlush();
}

export async function flushInteractions(): Promise<void> {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (pendingEvents.length === 0) {
    return;
  }
  const batch = pendingEvents.splice(0, pendingEvents.length);
  // Best-effort: if the network drops, we intentionally do NOT re-queue. The
  // interaction ledger is statistical signal, not a source of truth. Re-queue
  // would amplify a backend outage into a client-side loop.
  for (const event of batch) {
    try {
      await postInteraction(event);
    } catch {
      // Swallow: see note above.
    }
  }
}
