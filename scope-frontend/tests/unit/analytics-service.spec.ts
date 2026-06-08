import { describe, expect, it, vi } from 'vitest';
import type { AnalyticsRecord } from '@/services/analyticsService';
import {
  AnalyticsPageEngagementTracker,
  AnalyticsService,
  analyticsPageEngagementTracker,
  analyticsService,
  attachAnalyticsPageEngagementTracker,
  beginRoutePageEngagement,
  createAnalyticsPageEngagementTracker,
  createAnalyticsService,
  trackScopeAiInteraction,
  trackFriendAdd,
  trackItineraryGenerate,
  trackRoutePageView,
  trackSpotCreate,
  trackThemeToggle,
  trackTripCreate,
} from '@/services/analyticsService';

function restoreProperty(target: object, property: string, descriptor?: PropertyDescriptor): void {
  if (descriptor) {
    Object.defineProperty(target, property, descriptor);
    return;
  }

  delete (target as Record<string, unknown>)[property];
}

describe('analyticsService', () => {
  it('queues page views until consent is granted and a provider is available', () => {
    document.title = 'Scope Explore';
    window.history.replaceState({}, '', '/explore?city=austin');

    const trackedRecords: AnalyticsRecord[] = [];
    const analytics = createAnalyticsService({
      consent: 'unknown',
      now: () => new Date('2026-04-01T07:00:00.000Z'),
    });

    analytics.trackPageView({ routeName: 'explore' });

    expect(analytics.getQueuedRecords()).toHaveLength(1);
    expect(analytics.getQueuedRecords()[0]).toMatchObject({
      kind: 'page_view',
      path: '/explore',
      routeName: 'explore',
      title: 'Scope Explore',
      search: '?city=austin',
      timestamp: '2026-04-01T07:00:00.000Z',
    });

    analytics.registerProvider({
      id: 'memory',
      track: (record) => {
        trackedRecords.push(record);
      },
    });

    expect(trackedRecords).toHaveLength(0);

    analytics.setConsent('granted');

    expect(trackedRecords).toHaveLength(1);
    expect(trackedRecords[0]).toMatchObject({
      kind: 'page_view',
      path: '/explore',
      routeName: 'explore',
    });
    expect(analytics.getQueuedRecords()).toHaveLength(0);
  });

  it('dispatches events and engagement metrics immediately once consent is granted', () => {
    const providerTrack = vi.fn();
    const analytics = createAnalyticsService({
      consent: 'granted',
      providers: [{ id: 'memory', track: providerTrack }],
      now: () => new Date('2026-04-01T07:05:00.000Z'),
    });

    analytics.trackEvent({
      name: 'friend_add',
      category: 'social',
      label: 'suggested-user-card',
      value: 1,
      path: '/friends',
      routeName: 'friends',
      metadata: { source: 'people-you-may-know' },
    });

    analytics.trackEngagement({
      metric: 'scroll_depth',
      value: 75,
      path: '/friends',
      routeName: 'friends',
      metadata: { section: 'feed' },
    });

    expect(providerTrack).toHaveBeenCalledTimes(2);
    expect(providerTrack).toHaveBeenNthCalledWith(1, expect.objectContaining({
      kind: 'event',
      name: 'friend_add',
      category: 'social',
      label: 'suggested-user-card',
      value: 1,
      path: '/friends',
      routeName: 'friends',
    }));
    expect(providerTrack).toHaveBeenNthCalledWith(2, expect.objectContaining({
      kind: 'engagement',
      metric: 'scroll_depth',
      value: 75,
      path: '/friends',
      routeName: 'friends',
    }));
  });

  it('maps key user-action helpers into canonical analytics events', () => {
    const tracker = {
      trackEvent: vi.fn(),
    };

    trackSpotCreate({
      spotId: 'spot-9',
      category: 'food',
      city: 'Austin',
      photoCount: 3,
      isPublic: true,
      routeName: 'spot-create',
    }, tracker);

    trackTripCreate({
      tripId: 'trip-4',
      destination: 'Austin, TX',
      stopCount: 4,
      memberCount: 3,
      isPublic: true,
      budget: 640,
    }, tracker);

    trackItineraryGenerate({
      itineraryId: 'itinerary-2',
      destination: 'Austin, TX',
      dayCount: 2,
      stopCount: 5,
      totalEstimatedCost: 420,
      budget: 640,
      groupSize: 3,
      interestCount: 4,
      pace: 'moderate',
      routeName: 'trip-planner',
      source: 'user',
    }, tracker);

    trackScopeAiInteraction({
      interactionId: 'turn-1',
      source: 'typed',
      prompt: 'Can you keep this route scenic but cheap?',
      assistantResponse: 'I would keep one scenic stop and avoid paid detours.',
      responseKind: 'text',
      responseModel: 'scope-local-copilot',
      conversationTurnCount: 1,
      hasStart: true,
      hasEnd: true,
      stopCount: 2,
      interestCount: 2,
      groupSize: 3,
      pace: 'moderate',
      budgetFloor: 500,
      budget: 1500,
      routeName: 'trip-planner',
    }, tracker);

    trackFriendAdd({
      userId: 'user-8',
      mutualFriends: 12,
      requestId: 'request-1',
      source: 'request',
      routeName: 'friends',
    }, tracker);

    trackThemeToggle({
      theme: 'light',
      previousTheme: 'dark',
      source: 'settings',
      routeName: 'settings',
    }, tracker);

    expect(tracker.trackEvent).toHaveBeenCalledTimes(6);
    expect(tracker.trackEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({
      name: 'spot_create',
      category: 'content',
      label: 'food',
      value: 3,
      routeName: 'spot-create',
      metadata: expect.objectContaining({
        spotId: 'spot-9',
        city: 'Austin',
      }),
    }));
    expect(tracker.trackEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({
      name: 'trip_create',
      category: 'planning',
      label: 'Austin, TX',
      value: 4,
      metadata: expect.objectContaining({
        memberCount: 3,
        budget: 640,
      }),
    }));
    expect(tracker.trackEvent).toHaveBeenNthCalledWith(3, expect.objectContaining({
      name: 'ai_itinerary_generate',
      category: 'planning',
      label: 'Austin, TX',
      value: 5,
      routeName: 'trip-planner',
      metadata: expect.objectContaining({
        itineraryId: 'itinerary-2',
        source: 'user',
      }),
    }));
    expect(tracker.trackEvent).toHaveBeenNthCalledWith(4, expect.objectContaining({
      name: 'scope_ai_interaction',
      category: 'ai_training',
      label: 'typed',
      value: 1,
      routeName: 'trip-planner',
      metadata: expect.objectContaining({
        interactionId: 'turn-1',
        promptSample: 'Can you keep this route scenic but cheap?',
        assistantSample: 'I would keep one scenic stop and avoid paid detours.',
        trainingEligible: true,
      }),
    }));
    expect(tracker.trackEvent).toHaveBeenNthCalledWith(5, expect.objectContaining({
      name: 'friend_add',
      category: 'social',
      label: 'request',
      value: 12,
      routeName: 'friends',
      metadata: expect.objectContaining({
        userId: 'user-8',
      }),
    }));
    expect(tracker.trackEvent).toHaveBeenNthCalledWith(6, expect.objectContaining({
      name: 'theme_toggle',
      category: 'preferences',
      label: 'settings',
      routeName: 'settings',
      metadata: expect.objectContaining({
        theme: 'light',
        previousTheme: 'dark',
      }),
    }));
  });

  it('drops queued records when consent is denied or analytics is disabled', () => {
    const providerTrack = vi.fn();
    const analytics = createAnalyticsService({
      consent: 'unknown',
      providers: [{ id: 'memory', track: providerTrack }],
    });

    analytics.trackEvent({
      name: 'theme_toggle',
      path: '/settings',
    });

    expect(analytics.getQueuedRecords()).toHaveLength(1);

    analytics.setConsent('denied');

    expect(analytics.getQueuedRecords()).toHaveLength(0);

    analytics.setConsent('granted');
    analytics.setEnabled(false);
    analytics.trackPageView({ path: '/settings' });

    expect(providerTrack).not.toHaveBeenCalled();
    expect(analytics.getQueuedRecords()).toHaveLength(0);
  });

  it('maps router locations into canonical page-view payloads', () => {
    const tracker = {
      trackPageView: vi.fn(),
    };

    trackRoutePageView({
      path: '/settings',
      fullPath: '/settings?tab=privacy',
      name: 'settings',
      meta: {
        title: 'Account settings | Scope',
        requiresAuth: true,
        guestOnly: false,
        robots: 'noindex,nofollow',
      },
    } as Parameters<typeof trackRoutePageView>[0], tracker);

    expect(tracker.trackPageView).toHaveBeenCalledWith({
      path: '/settings',
      title: 'Account settings | Scope',
      routeName: 'settings',
      search: '?tab=privacy',
      metadata: {
        requiresAuth: true,
        guestOnly: false,
        robots: 'noindex,nofollow',
      },
    });
  });

  it('aggregates time on page, scroll depth, and map interactions per page session', () => {
    const trackEngagement = vi.fn();
    let nowMs = 0;
    let scrollY = 0;
    const hidden = false;

    const originalHiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden');
    const originalScrollYDescriptor = Object.getOwnPropertyDescriptor(window, 'scrollY');
    const originalPageYOffsetDescriptor = Object.getOwnPropertyDescriptor(window, 'pageYOffset');
    const originalDocumentClientHeightDescriptor = Object.getOwnPropertyDescriptor(document.documentElement, 'clientHeight');
    const originalDocumentScrollHeightDescriptor = Object.getOwnPropertyDescriptor(document.documentElement, 'scrollHeight');
    const originalBodyScrollHeightDescriptor = Object.getOwnPropertyDescriptor(document.body, 'scrollHeight');

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    });
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      get: () => scrollY,
    });
    Object.defineProperty(window, 'pageYOffset', {
      configurable: true,
      get: () => scrollY,
    });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      get: () => 1000,
    });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      get: () => 4000,
    });
    Object.defineProperty(document.body, 'scrollHeight', {
      configurable: true,
      get: () => 4000,
    });

    try {
      const pageTracker = createAnalyticsPageEngagementTracker({
        tracker: { trackEngagement },
        now: () => nowMs,
        win: window,
        doc: document,
      });

      pageTracker.attach();
      pageTracker.beginPage({
        path: '/map',
        fullPath: '/map?view=city',
        title: 'Live adventure map | Scope',
        routeName: 'map',
        metadata: {
          requiresAuth: false,
        },
      });

      nowMs = 1200;
      scrollY = 1500;
      window.dispatchEvent(new Event('scroll'));
      pageTracker.recordMapInteraction('spot_select');
      pageTracker.recordMapInteraction('zoom_in');
      pageTracker.recordMapInteraction('spot_select');

      nowMs = 4200;
      pageTracker.beginPage({
        path: '/explore',
        fullPath: '/explore',
        title: 'Explore community-loved spots | Scope',
        routeName: 'explore',
      });
      pageTracker.detach();
      pageTracker.reset();

      expect(trackEngagement).toHaveBeenCalledTimes(3);
      expect(trackEngagement).toHaveBeenNthCalledWith(1, expect.objectContaining({
        metric: 'time_on_page',
        path: '/map',
        routeName: 'map',
        durationMs: 4200,
        value: 4.2,
        metadata: expect.objectContaining({
          pageKey: '/map?view=city',
          flushReason: 'route-change',
          requiresAuth: false,
        }),
      }));
      expect(trackEngagement).toHaveBeenNthCalledWith(2, expect.objectContaining({
        metric: 'scroll_depth',
        path: '/map',
        routeName: 'map',
        value: 50,
      }));
      expect(trackEngagement).toHaveBeenNthCalledWith(3, expect.objectContaining({
        metric: 'map_interaction_count',
        path: '/map',
        routeName: 'map',
        value: 3,
        metadata: expect.objectContaining({
          mapInteraction_spot_select: 2,
          mapInteraction_zoom_in: 1,
        }),
      }));
    } finally {
      restoreProperty(document, 'hidden', originalHiddenDescriptor);
      restoreProperty(window, 'scrollY', originalScrollYDescriptor);
      restoreProperty(window, 'pageYOffset', originalPageYOffsetDescriptor);
      restoreProperty(document.documentElement, 'clientHeight', originalDocumentClientHeightDescriptor);
      restoreProperty(document.documentElement, 'scrollHeight', originalDocumentScrollHeightDescriptor);
      restoreProperty(document.body, 'scrollHeight', originalBodyScrollHeightDescriptor);
    }
  });

  it('pauses time-on-page accumulation while the document is hidden', () => {
    const trackEngagement = vi.fn();
    let nowMs = 0;
    let hidden = false;

    const originalHiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden');

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    });

    try {
      const pageTracker = createAnalyticsPageEngagementTracker({
        tracker: { trackEngagement },
        now: () => nowMs,
        win: window,
        doc: document,
      });

      pageTracker.attach();
      pageTracker.beginPage({
        path: '/friends',
        fullPath: '/friends',
        title: 'Friend graph | Scope',
        routeName: 'friends',
      });

      nowMs = 1500;
      hidden = true;
      document.dispatchEvent(new Event('visibilitychange'));

      nowMs = 5500;
      hidden = false;
      document.dispatchEvent(new Event('visibilitychange'));

      nowMs = 7000;
      pageTracker.flushCurrentPage();
      pageTracker.detach();
      pageTracker.reset();

      expect(trackEngagement).toHaveBeenCalledTimes(2);
      expect(trackEngagement).toHaveBeenNthCalledWith(1, expect.objectContaining({
        metric: 'time_on_page',
        path: '/friends',
        routeName: 'friends',
        durationMs: 3000,
        value: 3,
        metadata: expect.objectContaining({
          flushReason: 'teardown',
        }),
      }));
      expect(trackEngagement).toHaveBeenNthCalledWith(2, expect.objectContaining({
        metric: 'scroll_depth',
        path: '/friends',
        routeName: 'friends',
      }));
    } finally {
      restoreProperty(document, 'hidden', originalHiddenDescriptor);
    }
  });

  it('flushes registered providers on demand', () => {
    const providerFlush = vi.fn();
    const analytics = createAnalyticsService({
      consent: 'granted',
      providers: [{
        id: 'memory',
        track: vi.fn(),
        flush: providerFlush,
      }],
    });

    analytics.flushProviders();

    expect(providerFlush).toHaveBeenCalledTimes(1);
  });

  it('keeps provider registration, removal, and queued replay explicit', () => {
    const firstProviderTrack = vi.fn();
    const secondProviderTrack = vi.fn();
    const analytics = createAnalyticsService({
      consent: 'granted',
      providers: [
        { id: 'first', track: firstProviderTrack },
        { id: 'second', track: secondProviderTrack },
      ],
      now: () => new Date('2026-04-01T08:00:00.000Z'),
    });

    expect(analytics.isEnabled()).toBe(true);
    expect(analytics.getConsent()).toBe('granted');

    analytics.trackEvent({ name: 'initial_dispatch', path: '/map' });
    analytics.unregisterProvider('first');
    analytics.trackEvent({ name: 'after_unregister', path: '/map' });
    analytics.clearProviders();
    analytics.trackEvent({ name: 'queued_without_provider', path: '/map' });

    expect(firstProviderTrack).toHaveBeenCalledTimes(1);
    expect(secondProviderTrack).toHaveBeenCalledTimes(2);
    expect(analytics.getQueuedRecords()).toHaveLength(1);

    analytics.registerProvider({ id: 'first', track: firstProviderTrack });

    expect(analytics.getQueuedRecords()).toHaveLength(0);
    expect(firstProviderTrack).toHaveBeenLastCalledWith(expect.objectContaining({
      kind: 'event',
      name: 'queued_without_provider',
      timestamp: '2026-04-01T08:00:00.000Z',
    }));
  });

  it('updates an active page session and flushes pagehide sessions from attached listeners', () => {
    const trackEngagement = vi.fn();
    let nowMs = 0;
    let hidden = false;
    let scrollY = 0;
    const originalHiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden');
    const originalScrollYDescriptor = Object.getOwnPropertyDescriptor(window, 'scrollY');
    const originalDocumentClientHeightDescriptor = Object.getOwnPropertyDescriptor(document.documentElement, 'clientHeight');
    const originalDocumentScrollHeightDescriptor = Object.getOwnPropertyDescriptor(document.documentElement, 'scrollHeight');

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    });
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      get: () => scrollY,
    });
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      get: () => 500,
    });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      get: () => 1000,
    });

    try {
      const pageTracker = createAnalyticsPageEngagementTracker({
        tracker: { trackEngagement },
        now: () => nowMs,
        win: window,
        doc: document,
      });

      pageTracker.recordMapInteraction('ignored-before-session');
      pageTracker.attach();
      pageTracker.attach();
      pageTracker.beginPage({
        path: '/planner',
        fullPath: '/planner?draft=1',
        routeName: 'planner',
        metadata: { requiresAuth: true },
      });
      pageTracker.beginPage({
        path: '/planner',
        fullPath: '/planner?draft=1',
        title: 'Updated planner title',
        routeName: 'planner',
        metadata: { guestOnly: false },
      });

      nowMs = 2_000;
      hidden = true;
      scrollY = 250;
      document.dispatchEvent(new Event('visibilitychange'));

      nowMs = 3_000;
      window.dispatchEvent(new Event('pagehide'));
      pageTracker.detach();
      pageTracker.detach();

      expect(trackEngagement).toHaveBeenCalledTimes(2);
      expect(trackEngagement).toHaveBeenNthCalledWith(1, expect.objectContaining({
        metric: 'time_on_page',
        title: 'Updated planner title',
        durationMs: 2000,
        metadata: expect.objectContaining({
          pageKey: '/planner?draft=1',
          flushReason: 'pagehide',
          requiresAuth: true,
          guestOnly: false,
        }),
      }));
      expect(trackEngagement).toHaveBeenNthCalledWith(2, expect.objectContaining({
        metric: 'scroll_depth',
        value: 50,
      }));
    } finally {
      restoreProperty(document, 'hidden', originalHiddenDescriptor);
      restoreProperty(window, 'scrollY', originalScrollYDescriptor);
      restoreProperty(document.documentElement, 'clientHeight', originalDocumentClientHeightDescriptor);
      restoreProperty(document.documentElement, 'scrollHeight', originalDocumentScrollHeightDescriptor);
    }
  });

  it('supports functional route meta and hash-trimmed query strings', () => {
    const tracker = {
      trackPageView: vi.fn(),
    };

    trackRoutePageView({
      path: '/explore',
      fullPath: '/explore?city=austin#spots',
      name: Symbol('explore'),
      meta: {
        title: (route) => route.path === '/explore' ? 'Dynamic Explore' : false,
        robots: () => false,
        requiresAuth: false,
        guestOnly: true,
      },
    } as Parameters<typeof trackRoutePageView>[0], tracker);

    expect(tracker.trackPageView).toHaveBeenCalledWith({
      path: '/explore',
      title: 'Dynamic Explore',
      routeName: undefined,
      search: '?city=austin',
      metadata: {
        requiresAuth: false,
        guestOnly: true,
        robots: undefined,
      },
    });
  });

  it('trims Scope AI samples without requiring an assistant response', () => {
    const tracker = {
      trackEvent: vi.fn(),
    };

    trackScopeAiInteraction({
      interactionId: 'turn-without-assistant',
      source: 'suggestion',
      prompt: `\n        ${'Keep this trip affordable and outdoors. '.repeat(30)}\n      `,
      responseKind: 'error',
      conversationTurnCount: 4,
      hasStart: false,
      hasEnd: true,
      stopCount: 0,
      interestCount: 1,
    }, tracker);

    const payload = tracker.trackEvent.mock.calls[0]?.[0];

    expect(payload).toMatchObject({
      name: 'scope_ai_interaction',
      label: 'suggestion',
      value: 4,
      metadata: expect.objectContaining({
        interactionId: 'turn-without-assistant',
        assistantSample: undefined,
        assistantLength: undefined,
        responseKind: 'error',
      }),
    });
    expect(payload.metadata.promptSample).toHaveLength(600);
    expect(payload.metadata.promptSample).not.toContain('\n');
  });

  it('delegates attach and route engagement helpers to their supplied trackers', () => {
    const attach = vi.fn();
    const beginPage = vi.fn();

    attachAnalyticsPageEngagementTracker({ attach });
    beginRoutePageEngagement({
      path: '/map',
      fullPath: '/map',
      name: 'map',
      meta: {
        title: 'Map | Scope',
        requiresAuth: false,
      },
    } as Parameters<typeof beginRoutePageEngagement>[0], { beginPage });

    expect(attach).toHaveBeenCalledTimes(1);
    expect(beginPage).toHaveBeenCalledWith({
      path: '/map',
      fullPath: '/map',
      title: 'Map | Scope',
      routeName: 'map',
      search: undefined,
      metadata: {
        requiresAuth: false,
        guestOnly: false,
        robots: undefined,
      },
    });
  });

  it('uses stable page-view fallbacks when browser globals or metadata are unavailable', () => {
    const trackedRecords: AnalyticsRecord[] = [];
    const analytics = new AnalyticsService({
      consent: 'granted',
      providers: [{
        id: 'memory',
        track: (record) => trackedRecords.push(record),
      }],
    });
    const originalWindow = window;
    const originalDocument = document;

    try {
      vi.stubGlobal('window', undefined);
      vi.stubGlobal('document', undefined);
      analytics.trackPageView();

      expect(trackedRecords[0]).toMatchObject({
        kind: 'page_view',
        path: '/',
        title: undefined,
        search: undefined,
        referrer: undefined,
      });

      vi.stubGlobal('window', {
        location: {
          pathname: '',
          search: '',
        },
      });
      vi.stubGlobal('document', {
        title: '',
        referrer: '',
      });
      analytics.trackPageView();
      analytics.trackPageView({
        path: '/explicit',
        title: 'Explicit title',
        search: '',
        referrer: '',
      });

      expect(trackedRecords[1]).toMatchObject({
        path: '/',
        title: undefined,
        search: undefined,
        referrer: undefined,
      });
      expect(trackedRecords[2]).toMatchObject({
        path: '/explicit',
        title: 'Explicit title',
        search: '',
        referrer: '',
      });
    } finally {
      vi.stubGlobal('window', originalWindow);
      vi.stubGlobal('document', originalDocument);
    }
  });

  it('covers default service construction and non-dispatching state transitions', () => {
    const analytics = new AnalyticsService();

    analytics.trackPageView();
    expect(analytics.getQueuedRecords()).toHaveLength(1);

    analytics.setEnabled(true);
    analytics.setConsent('granted');
    expect(analytics.getQueuedRecords()).toHaveLength(1);

    analytics.setEnabled(false);
    expect(analytics.getQueuedRecords()).toEqual([]);
  });

  it('resolves every supported scroll source and zero-distance document', () => {
    const cases = [
      {
        win: { scrollY: undefined, pageYOffset: 50, innerHeight: 100 },
        documentElement: { scrollTop: undefined, scrollHeight: 200, clientHeight: 100 },
        body: { scrollTop: undefined, scrollHeight: 0 },
        expected: 50,
      },
      {
        win: { scrollY: undefined, pageYOffset: undefined, innerHeight: 100 },
        documentElement: { scrollTop: 25, scrollHeight: 200, clientHeight: 100 },
        body: { scrollTop: undefined, scrollHeight: 0 },
        expected: 25,
      },
      {
        win: { scrollY: undefined, pageYOffset: undefined, innerHeight: 100 },
        documentElement: { scrollTop: undefined, scrollHeight: 0, clientHeight: undefined },
        body: { scrollTop: 75, scrollHeight: 200 },
        expected: 75,
      },
      {
        win: { scrollY: undefined, pageYOffset: undefined, innerHeight: 100 },
        documentElement: { scrollTop: undefined, scrollHeight: 100, clientHeight: 100 },
        body: { scrollTop: undefined, scrollHeight: 0 },
        expected: 100,
      },
      {
        win: { scrollY: undefined, pageYOffset: undefined, innerHeight: undefined },
        documentElement: { scrollTop: undefined, scrollHeight: undefined, clientHeight: undefined },
        body: { scrollTop: undefined, scrollHeight: undefined },
        expected: 0,
      },
    ];

    for (const [index, testCase] of cases.entries()) {
      const trackEngagement = vi.fn();
      const pageTracker = createAnalyticsPageEngagementTracker({
        tracker: { trackEngagement },
        now: () => 1000,
        win: testCase.win as unknown as Window,
        doc: {
          hidden: false,
          documentElement: testCase.documentElement,
          body: testCase.body,
        } as unknown as Document,
      });

      pageTracker.beginPage({
        path: `/scroll-${index}`,
        fullPath: '',
        routeName: `scroll-${index}`,
      });
      pageTracker.flushCurrentPage();

      expect(trackEngagement).toHaveBeenCalledWith(expect.objectContaining({
        metric: 'scroll_depth',
        value: testCase.expected,
        metadata: expect.objectContaining({
          pageKey: `/scroll-${index}`,
        }),
      }));
    }
  });

  it('ignores lifecycle events without a page and safely refreshes an active session', () => {
    const trackEngagement = vi.fn();
    let hidden = false;
    const originalHiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden');

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    });

    try {
      const pageTracker = new AnalyticsPageEngagementTracker({
        tracker: { trackEngagement },
        now: () => 1000,
        win: window,
        doc: document,
      });

      pageTracker.attach();
      window.dispatchEvent(new Event('scroll'));
      document.dispatchEvent(new Event('visibilitychange'));

      pageTracker.beginPage({
        path: '/quiet',
        fullPath: '',
        routeName: 'quiet',
      });
      pageTracker.beginPage({
        path: '/quiet',
        fullPath: '',
        routeName: 'quiet',
      });
      hidden = false;
      document.dispatchEvent(new Event('visibilitychange'));
      pageTracker.flushCurrentPage();
      pageTracker.flushCurrentPage();
      pageTracker.detach();

      expect(trackEngagement).toHaveBeenCalledTimes(2);
    } finally {
      restoreProperty(document, 'hidden', originalHiddenDescriptor);
    }
  });

  it('delegates optional helpers to singleton trackers and defaults itinerary source', () => {
    const pageViewSpy = vi.spyOn(analyticsService, 'trackPageView').mockImplementation(() => undefined);
    const eventSpy = vi.spyOn(analyticsService, 'trackEvent').mockImplementation(() => undefined);
    const attachSpy = vi.spyOn(analyticsPageEngagementTracker, 'attach').mockImplementation(() => undefined);
    const beginPageSpy = vi.spyOn(analyticsPageEngagementTracker, 'beginPage').mockImplementation(() => undefined);
    const customTracker = { trackEvent: vi.fn() };
    const route = {
      path: '/map',
      fullPath: '/map',
      name: 'map',
      meta: {},
    } as Parameters<typeof trackRoutePageView>[0];

    trackRoutePageView(route);
    trackSpotCreate({
      spotId: 'spot-default-tracker',
      category: 'scenic',
      photoCount: 0,
      isPublic: true,
    });
    trackItineraryGenerate({
      itineraryId: 'itinerary-default-source',
      destination: 'Austin',
      dayCount: 1,
      stopCount: 2,
      totalEstimatedCost: 100,
      interestCount: 1,
    }, customTracker);
    attachAnalyticsPageEngagementTracker();
    beginRoutePageEngagement(route);

    expect(pageViewSpy).toHaveBeenCalledTimes(1);
    expect(eventSpy).toHaveBeenCalledTimes(1);
    expect(customTracker.trackEvent).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ source: 'user' }),
    }));
    expect(attachSpy).toHaveBeenCalledTimes(1);
    expect(beginPageSpy).toHaveBeenCalledTimes(1);
  });
});
