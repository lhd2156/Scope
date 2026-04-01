import type { RouteLocationNormalizedLoaded } from 'vue-router';

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

function resolveRouteMetaString(route: RouteLocationNormalizedLoaded, value: unknown): string | undefined {
  if (typeof value === 'function') {
    const resolvedValue = (value as (currentRoute: RouteLocationNormalizedLoaded) => string | false)(route);
    return typeof resolvedValue === 'string' ? resolvedValue : undefined;
  }

  return typeof value === 'string' ? value : undefined;
}

function resolveRouteSearch(route: RouteLocationNormalizedLoaded): string | undefined {
  const queryStartIndex = route.fullPath.indexOf('?');

  if (queryStartIndex < 0) {
    return undefined;
  }

  const hashStartIndex = route.fullPath.indexOf('#', queryStartIndex);
  return hashStartIndex >= 0
    ? route.fullPath.slice(queryStartIndex, hashStartIndex)
    : route.fullPath.slice(queryStartIndex);
}

export type AnalyticsPageViewTracker = Pick<AnalyticsService, 'trackPageView'>;
export type AnalyticsEventTracker = Pick<AnalyticsService, 'trackEvent'>;

export interface AnalyticsUserActionContext {
  path?: string;
  title?: string;
  routeName?: string;
}

export interface AnalyticsSpotCreatePayload extends AnalyticsUserActionContext {
  spotId: string;
  category: string;
  city?: string;
  photoCount: number;
  isPublic: boolean;
}

export interface AnalyticsTripCreatePayload extends AnalyticsUserActionContext {
  tripId: string;
  destination: string;
  stopCount: number;
  memberCount: number;
  isPublic: boolean;
  budget?: number;
}

export type ItineraryGenerationSource = 'auto-preview' | 'user';

export interface AnalyticsItineraryGeneratePayload extends AnalyticsUserActionContext {
  itineraryId: string;
  destination: string;
  dayCount: number;
  stopCount: number;
  totalEstimatedCost: number;
  budget?: number;
  groupSize?: number;
  interestCount: number;
  pace?: string;
  source?: ItineraryGenerationSource;
}

export interface AnalyticsFriendAddPayload extends AnalyticsUserActionContext {
  userId: string;
  mutualFriends: number;
  requestId?: string;
  source: 'profile' | 'request' | 'suggestion';
}

export interface AnalyticsThemeTogglePayload extends AnalyticsUserActionContext {
  theme: string;
  source: 'navbar' | 'settings';
  previousTheme?: string;
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

export function trackRoutePageView(
  route: RouteLocationNormalizedLoaded,
  tracker?: AnalyticsPageViewTracker,
): void {
  const resolvedTracker = tracker ?? analyticsService;

  resolvedTracker.trackPageView({
    path: route.path,
    title: resolveRouteMetaString(route, route.meta.title),
    routeName: typeof route.name === 'string' ? route.name : undefined,
    search: resolveRouteSearch(route),
    metadata: {
      requiresAuth: Boolean(route.meta.requiresAuth),
      guestOnly: Boolean(route.meta.guestOnly),
      robots: resolveRouteMetaString(route, route.meta.robots),
    },
  });
}

function resolveEventTracker(tracker?: AnalyticsEventTracker): AnalyticsEventTracker {
  return tracker ?? analyticsService;
}

export function trackSpotCreate(payload: AnalyticsSpotCreatePayload, tracker?: AnalyticsEventTracker): void {
  resolveEventTracker(tracker).trackEvent({
    name: 'spot_create',
    category: 'content',
    label: payload.category,
    value: payload.photoCount,
    path: payload.path,
    title: payload.title,
    routeName: payload.routeName,
    metadata: {
      spotId: payload.spotId,
      category: payload.category,
      city: payload.city,
      photoCount: payload.photoCount,
      isPublic: payload.isPublic,
    },
  });
}

export function trackTripCreate(payload: AnalyticsTripCreatePayload, tracker?: AnalyticsEventTracker): void {
  resolveEventTracker(tracker).trackEvent({
    name: 'trip_create',
    category: 'planning',
    label: payload.destination,
    value: payload.stopCount,
    path: payload.path,
    title: payload.title,
    routeName: payload.routeName,
    metadata: {
      tripId: payload.tripId,
      destination: payload.destination,
      stopCount: payload.stopCount,
      memberCount: payload.memberCount,
      isPublic: payload.isPublic,
      budget: payload.budget,
    },
  });
}

export function trackItineraryGenerate(
  payload: AnalyticsItineraryGeneratePayload,
  tracker?: AnalyticsEventTracker,
): void {
  const source = payload.source ?? 'user';

  resolveEventTracker(tracker).trackEvent({
    name: 'ai_itinerary_generate',
    category: 'planning',
    label: payload.destination,
    value: payload.stopCount,
    path: payload.path,
    title: payload.title,
    routeName: payload.routeName,
    metadata: {
      itineraryId: payload.itineraryId,
      destination: payload.destination,
      dayCount: payload.dayCount,
      stopCount: payload.stopCount,
      totalEstimatedCost: payload.totalEstimatedCost,
      budget: payload.budget,
      groupSize: payload.groupSize,
      interestCount: payload.interestCount,
      pace: payload.pace,
      source,
    },
  });
}

export function trackFriendAdd(payload: AnalyticsFriendAddPayload, tracker?: AnalyticsEventTracker): void {
  resolveEventTracker(tracker).trackEvent({
    name: 'friend_add',
    category: 'social',
    label: payload.source,
    value: payload.mutualFriends,
    path: payload.path,
    title: payload.title,
    routeName: payload.routeName,
    metadata: {
      userId: payload.userId,
      mutualFriends: payload.mutualFriends,
      requestId: payload.requestId,
      source: payload.source,
    },
  });
}

export function trackThemeToggle(payload: AnalyticsThemeTogglePayload, tracker?: AnalyticsEventTracker): void {
  resolveEventTracker(tracker).trackEvent({
    name: 'theme_toggle',
    category: 'preferences',
    label: payload.source,
    path: payload.path,
    title: payload.title,
    routeName: payload.routeName,
    metadata: {
      theme: payload.theme,
      previousTheme: payload.previousTheme,
      source: payload.source,
    },
  });
}

export function createAnalyticsService(options: AnalyticsServiceOptions = {}): AnalyticsService {
  return new AnalyticsService(options);
}

export const analyticsService = createAnalyticsService();
