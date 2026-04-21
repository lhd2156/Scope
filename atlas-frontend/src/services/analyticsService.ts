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

function clampMetricValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export interface AnalyticsRouteContext {
  path: string;
  fullPath: string;
  title?: string;
  routeName?: string;
  search?: string;
  metadata?: AnalyticsMetadata;
}

export type AnalyticsPageViewTracker = Pick<AnalyticsService, 'trackPageView'>;
export type AnalyticsEventTracker = Pick<AnalyticsService, 'trackEvent'>;
export type AnalyticsEngagementTracker = Pick<AnalyticsService, 'trackEngagement'>;
export type AnalyticsPageSessionTracker = Pick<AnalyticsPageEngagementTracker, 'attach' | 'beginPage'>;

export function resolveAnalyticsRouteContext(route: RouteLocationNormalizedLoaded): AnalyticsRouteContext {
  return {
    path: route.path,
    fullPath: route.fullPath,
    title: resolveRouteMetaString(route, route.meta.title),
    routeName: typeof route.name === 'string' ? route.name : undefined,
    search: resolveRouteSearch(route),
    metadata: {
      requiresAuth: Boolean(route.meta.requiresAuth),
      guestOnly: Boolean(route.meta.guestOnly),
      robots: resolveRouteMetaString(route, route.meta.robots),
    },
  };
}

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

export type AnalyticsPageSessionEndReason = 'route-change' | 'pagehide' | 'teardown';

export interface AnalyticsPageEngagementTrackerOptions {
  tracker?: AnalyticsEngagementTracker;
  now?: () => number;
  win?: Window | null;
  doc?: Document | null;
}

interface ActiveAnalyticsPageSession extends AnalyticsRouteContext {
  key: string;
  isVisible: boolean;
  visibleSegmentStartedAtMs: number;
  accumulatedVisibleMs: number;
  maxScrollDepth: number;
  mapInteractionCount: number;
  mapInteractionTypeCounts: Record<string, number>;
}

function buildSessionMetadata(
  session: ActiveAnalyticsPageSession,
  reason: AnalyticsPageSessionEndReason,
  extraMetadata?: AnalyticsMetadata,
): AnalyticsMetadata {
  return {
    ...(session.metadata ?? {}),
    ...(extraMetadata ?? {}),
    pageKey: session.key,
    flushReason: reason,
  };
}

function buildMapInteractionMetadata(
  session: ActiveAnalyticsPageSession,
  reason: AnalyticsPageSessionEndReason,
): AnalyticsMetadata {
  const interactionTypeMetadata = Object.entries(session.mapInteractionTypeCounts).reduce<AnalyticsMetadata>((metadata, [interactionType, count]) => {
    metadata[`mapInteraction_${interactionType}`] = count;
    return metadata;
  }, {});

  return buildSessionMetadata(session, reason, interactionTypeMetadata);
}

export class AnalyticsPageEngagementTracker {
  private readonly tracker: AnalyticsEngagementTracker;
  private readonly now: () => number;
  private readonly win: Window | null;
  private readonly doc: Document | null;
  private activeSession: ActiveAnalyticsPageSession | null = null;
  private listenersAttached = false;

  constructor(options: AnalyticsPageEngagementTrackerOptions = {}) {
    this.tracker = options.tracker ?? analyticsService;
    this.now = options.now ?? (() => Date.now());
    this.win = options.win ?? (typeof window === 'undefined' ? null : window);
    this.doc = options.doc ?? (typeof document === 'undefined' ? null : document);
  }

  attach(): void {
    if (this.listenersAttached) {
      return;
    }

    this.win?.addEventListener('scroll', this.handleScroll, { passive: true });
    this.win?.addEventListener('pagehide', this.handlePageHide);
    this.doc?.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.listenersAttached = true;
  }

  detach(): void {
    if (!this.listenersAttached) {
      return;
    }

    this.win?.removeEventListener('scroll', this.handleScroll);
    this.win?.removeEventListener('pagehide', this.handlePageHide);
    this.doc?.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.listenersAttached = false;
  }

  reset(): void {
    this.activeSession = null;
  }

  beginPage(context: AnalyticsRouteContext): void {
    const pageKey = context.fullPath || context.path;

    if (this.activeSession?.key === pageKey) {
      this.activeSession = {
        ...this.activeSession,
        ...context,
        metadata: {
          ...(this.activeSession.metadata ?? {}),
          ...(context.metadata ?? {}),
        },
      };
      return;
    }

    this.flushCurrentPage('route-change');

    const startedAtMs = this.now();
    this.activeSession = {
      ...context,
      key: pageKey,
      isVisible: !Boolean(this.doc?.hidden),
      visibleSegmentStartedAtMs: startedAtMs,
      accumulatedVisibleMs: 0,
      maxScrollDepth: 0,
      mapInteractionCount: 0,
      mapInteractionTypeCounts: {},
    };
  }

  recordMapInteraction(interactionType: string): void {
    if (!this.activeSession) {
      return;
    }

    this.activeSession.mapInteractionCount += 1;
    this.activeSession.mapInteractionTypeCounts[interactionType] = (this.activeSession.mapInteractionTypeCounts[interactionType] ?? 0) + 1;
  }

  flushCurrentPage(reason: AnalyticsPageSessionEndReason = 'teardown'): void {
    if (!this.activeSession) {
      return;
    }

    this.updateScrollDepth();
    this.pauseCurrentPage();

    const completedSession = this.activeSession;
    this.activeSession = null;
    const durationSeconds = Number((completedSession.accumulatedVisibleMs / 1000).toFixed(2));

    this.tracker.trackEngagement({
      metric: 'time_on_page',
      path: completedSession.path,
      title: completedSession.title,
      routeName: completedSession.routeName,
      durationMs: completedSession.accumulatedVisibleMs,
      value: durationSeconds,
      metadata: buildSessionMetadata(completedSession, reason),
    });

    this.tracker.trackEngagement({
      metric: 'scroll_depth',
      path: completedSession.path,
      title: completedSession.title,
      routeName: completedSession.routeName,
      value: completedSession.maxScrollDepth,
      metadata: buildSessionMetadata(completedSession, reason),
    });

    if (completedSession.routeName === 'map' || completedSession.path === '/map' || completedSession.mapInteractionCount > 0) {
      this.tracker.trackEngagement({
        metric: 'map_interaction_count',
        path: completedSession.path,
        title: completedSession.title,
        routeName: completedSession.routeName,
        value: completedSession.mapInteractionCount,
        metadata: buildMapInteractionMetadata(completedSession, reason),
      });
    }
  }

  private handleScroll = (): void => {
    this.updateScrollDepth();
  };

  private handlePageHide = (): void => {
    this.flushCurrentPage('pagehide');
  };

  private handleVisibilityChange = (): void => {
    if (!this.activeSession) {
      return;
    }

    if (this.doc?.hidden) {
      this.updateScrollDepth();
      this.pauseCurrentPage();
      return;
    }

    this.resumeCurrentPage();
  };

  private pauseCurrentPage(): void {
    if (!this.activeSession?.isVisible) {
      return;
    }

    this.activeSession.accumulatedVisibleMs += Math.max(0, this.now() - this.activeSession.visibleSegmentStartedAtMs);
    this.activeSession.isVisible = false;
  }

  private resumeCurrentPage(): void {
    if (!this.activeSession || this.activeSession.isVisible) {
      return;
    }

    this.activeSession.visibleSegmentStartedAtMs = this.now();
    this.activeSession.isVisible = true;
  }

  private updateScrollDepth(): void {
    if (!this.activeSession) {
      return;
    }

    this.activeSession.maxScrollDepth = Math.max(
      this.activeSession.maxScrollDepth,
      this.resolveCurrentScrollDepth(),
    );
  }

  private resolveCurrentScrollDepth(): number {
    const documentElement = this.doc?.documentElement;
    const body = this.doc?.body;
    const scrollTop = this.win?.scrollY
      ?? this.win?.pageYOffset
      ?? documentElement?.scrollTop
      ?? body?.scrollTop
      ?? 0;
    const scrollHeight = Math.max(documentElement?.scrollHeight ?? 0, body?.scrollHeight ?? 0);
    const clientHeight = documentElement?.clientHeight ?? this.win?.innerHeight ?? 0;
    const scrollableDistance = Math.max(scrollHeight - clientHeight, 0);

    if (scrollHeight <= 0 || clientHeight <= 0) {
      return 0;
    }

    if (scrollableDistance <= 0) {
      return 100;
    }

    return clampMetricValue(Math.round((scrollTop / scrollableDistance) * 100), 0, 100);
  }
}

export function trackRoutePageView(
  route: RouteLocationNormalizedLoaded,
  tracker?: AnalyticsPageViewTracker,
): void {
  const resolvedTracker = tracker ?? analyticsService;
  const routeContext = resolveAnalyticsRouteContext(route);

  resolvedTracker.trackPageView({
    path: routeContext.path,
    title: routeContext.title,
    routeName: routeContext.routeName,
    search: routeContext.search,
    metadata: routeContext.metadata,
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

export function attachAnalyticsPageEngagementTracker(tracker?: Pick<AnalyticsPageEngagementTracker, 'attach'>): void {
  (tracker ?? analyticsPageEngagementTracker).attach();
}

export function beginRoutePageEngagement(
  route: RouteLocationNormalizedLoaded,
  tracker?: Pick<AnalyticsPageEngagementTracker, 'beginPage'>,
): void {
  (tracker ?? analyticsPageEngagementTracker).beginPage(resolveAnalyticsRouteContext(route));
}

export function createAnalyticsPageEngagementTracker(
  options: AnalyticsPageEngagementTrackerOptions = {},
): AnalyticsPageEngagementTracker {
  return new AnalyticsPageEngagementTracker(options);
}

export function createAnalyticsService(options: AnalyticsServiceOptions = {}): AnalyticsService {
  return new AnalyticsService(options);
}

export const analyticsService = createAnalyticsService();
export const analyticsPageEngagementTracker = createAnalyticsPageEngagementTracker();
