import { describe, expect, it, vi } from 'vitest';
import type { AnalyticsRecord } from '@/services/analyticsService';
import {
  createAnalyticsService,
  trackFriendAdd,
  trackItineraryGenerate,
  trackRoutePageView,
  trackSpotCreate,
  trackThemeToggle,
  trackTripCreate,
} from '@/services/analyticsService';

describe('analyticsService', () => {
  it('queues page views until consent is granted and a provider is available', () => {
    document.title = 'Atlas Explore';
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
      title: 'Atlas Explore',
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

    expect(tracker.trackEvent).toHaveBeenCalledTimes(5);
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
      name: 'friend_add',
      category: 'social',
      label: 'request',
      value: 12,
      routeName: 'friends',
      metadata: expect.objectContaining({
        userId: 'user-8',
      }),
    }));
    expect(tracker.trackEvent).toHaveBeenNthCalledWith(5, expect.objectContaining({
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
        title: 'Account settings | Atlas',
        requiresAuth: true,
        guestOnly: false,
        robots: 'noindex,nofollow',
      },
    } as Parameters<typeof trackRoutePageView>[0], tracker);

    expect(tracker.trackPageView).toHaveBeenCalledWith({
      path: '/settings',
      title: 'Account settings | Atlas',
      routeName: 'settings',
      search: '?tab=privacy',
      metadata: {
        requiresAuth: true,
        guestOnly: false,
        robots: 'noindex,nofollow',
      },
    });
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
});
