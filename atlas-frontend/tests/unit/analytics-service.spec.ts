import { describe, expect, it, vi } from 'vitest';
import type { AnalyticsRecord } from '@/services/analyticsService';
import { createAnalyticsService } from '@/services/analyticsService';

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
