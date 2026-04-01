export type AnalyticsConsentState = 'unknown' | 'granted' | 'denied';

export interface AnalyticsMetadata {
  [key: string]: boolean | number | string | null | undefined;
}

interface AnalyticsRecordBase {
  timestamp: string;
  path: string;
  title?: string;
  routeName?: string;
  metadata?: AnalyticsMetadata;
}

export interface AnalyticsPageViewRecord extends AnalyticsRecordBase {
  kind: 'page_view';
  referrer?: string;
  search?: string;
}

export interface AnalyticsEventRecord extends AnalyticsRecordBase {
  kind: 'event';
  name: string;
  category?: string;
  label?: string;
  value?: number;
}

export interface AnalyticsEngagementRecord extends AnalyticsRecordBase {
  kind: 'engagement';
  metric: string;
  durationMs?: number;
  value?: number;
}

export type AnalyticsRecord = AnalyticsPageViewRecord | AnalyticsEventRecord | AnalyticsEngagementRecord;

export interface AnalyticsPageViewPayload {
  path?: string;
  title?: string;
  routeName?: string;
  referrer?: string;
  search?: string;
  metadata?: AnalyticsMetadata;
}

export interface AnalyticsEventPayload {
  name: string;
  path?: string;
  title?: string;
  routeName?: string;
  category?: string;
  label?: string;
  value?: number;
  metadata?: AnalyticsMetadata;
}

export interface AnalyticsEngagementPayload {
  metric: string;
  path?: string;
  title?: string;
  routeName?: string;
  durationMs?: number;
  value?: number;
  metadata?: AnalyticsMetadata;
}

export interface AnalyticsProvider {
  id: string;
  track: (record: AnalyticsRecord) => void | Promise<void>;
  flush?: () => void | Promise<void>;
}

export interface AnalyticsServiceOptions {
  enabled?: boolean;
  consent?: AnalyticsConsentState;
  providers?: AnalyticsProvider[];
  now?: () => Date;
}

function resolvePath(path?: string): string {
  if (path) {
    return path;
  }

  if (typeof window === 'undefined') {
    return '/';
  }

  return window.location.pathname || '/';
}

function resolveSearch(search?: string): string | undefined {
  if (typeof search === 'string') {
    return search;
  }

  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.location.search || undefined;
}

function resolveTitle(title?: string): string | undefined {
  if (title) {
    return title;
  }

  if (typeof document === 'undefined') {
    return undefined;
  }

  return document.title || undefined;
}

function resolveReferrer(referrer?: string): string | undefined {
  if (typeof referrer === 'string') {
    return referrer;
  }

  if (typeof document === 'undefined') {
    return undefined;
  }

  return document.referrer || undefined;
}

export class AnalyticsService {
  private enabled: boolean;
  private consent: AnalyticsConsentState;
  private readonly now: () => Date;
  private readonly providers = new Map<string, AnalyticsProvider>();
  private queuedRecords: AnalyticsRecord[] = [];

  constructor(options: AnalyticsServiceOptions = {}) {
    this.enabled = options.enabled ?? true;
    this.consent = options.consent ?? 'unknown';
    this.now = options.now ?? (() => new Date());

    for (const provider of options.providers ?? []) {
      this.providers.set(provider.id, provider);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getConsent(): AnalyticsConsentState {
    return this.consent;
  }

  getQueuedRecords(): AnalyticsRecord[] {
    return [...this.queuedRecords];
  }

  registerProvider(provider: AnalyticsProvider): void {
    this.providers.set(provider.id, provider);

    if (this.canDispatch()) {
      this.flushQueue();
    }
  }

  unregisterProvider(providerId: string): void {
    this.providers.delete(providerId);
  }

  clearProviders(): void {
    this.providers.clear();
  }

  setEnabled(nextEnabled: boolean): void {
    this.enabled = nextEnabled;

    if (!nextEnabled) {
      this.queuedRecords = [];
    }
  }

  setConsent(nextConsent: AnalyticsConsentState): void {
    this.consent = nextConsent;

    if (nextConsent === 'denied') {
      this.queuedRecords = [];
      return;
    }

    if (nextConsent === 'granted' && this.canDispatch()) {
      this.flushQueue();
    }
  }

  trackPageView(payload: AnalyticsPageViewPayload = {}): void {
    this.handleRecord({
      kind: 'page_view',
      timestamp: this.createTimestamp(),
      path: resolvePath(payload.path),
      title: resolveTitle(payload.title),
      routeName: payload.routeName,
      referrer: resolveReferrer(payload.referrer),
      search: resolveSearch(payload.search),
      metadata: payload.metadata,
    });
  }

  trackEvent(payload: AnalyticsEventPayload): void {
    this.handleRecord({
      kind: 'event',
      timestamp: this.createTimestamp(),
      path: resolvePath(payload.path),
      title: resolveTitle(payload.title),
      routeName: payload.routeName,
      name: payload.name,
      category: payload.category,
      label: payload.label,
      value: payload.value,
      metadata: payload.metadata,
    });
  }

  trackEngagement(payload: AnalyticsEngagementPayload): void {
    this.handleRecord({
      kind: 'engagement',
      timestamp: this.createTimestamp(),
      path: resolvePath(payload.path),
      title: resolveTitle(payload.title),
      routeName: payload.routeName,
      metric: payload.metric,
      durationMs: payload.durationMs,
      value: payload.value,
      metadata: payload.metadata,
    });
  }

  flushQueue(): void {
    if (!this.canDispatch() || this.queuedRecords.length === 0) {
      return;
    }

    const pendingRecords = [...this.queuedRecords];
    this.queuedRecords = [];

    for (const record of pendingRecords) {
      this.dispatchRecord(record);
    }
  }

  flushProviders(): void {
    for (const provider of this.providers.values()) {
      void provider.flush?.();
    }
  }

  private createTimestamp(): string {
    return this.now().toISOString();
  }

  private canDispatch(): boolean {
    return this.enabled && this.consent === 'granted' && this.providers.size > 0;
  }

  private handleRecord(record: AnalyticsRecord): void {
    if (!this.enabled || this.consent === 'denied') {
      return;
    }

    if (!this.canDispatch()) {
      this.queuedRecords = [...this.queuedRecords, record];
      return;
    }

    this.dispatchRecord(record);
  }

  private dispatchRecord(record: AnalyticsRecord): void {
    for (const provider of this.providers.values()) {
      void provider.track(record);
    }
  }
}

export function createAnalyticsService(options: AnalyticsServiceOptions = {}): AnalyticsService {
  return new AnalyticsService(options);
}

export const analyticsService = createAnalyticsService();
