import api, { getAccessToken } from '@/services/api';
import { DEMO_MODE_ENABLED, localFallbackEnabled } from '@/services/demoMode';
import { loadMockData } from '@/services/mockDataLoader';
import { normalizeArrayEnvelopeData, paginateItems, sortByCreatedAtDescending } from '@/services/serviceUtils';
import type {
  ApiEnvelope,
  FeedItem,
  NotificationItem,
  NotificationPreference,
  NotificationPreferenceInput,
  PushSubscriptionInput,
  Review,
  SpotSummary,
  UserProfile,
} from '@/types';
import {
  sanitizeFeedItem,
  sanitizeNotificationItem,
  sanitizeNotificationPreference,
  sanitizeSpotSummary,
} from '@/utils/sanitizers';
import { rankTrendingSpots } from '@/utils/spotRanking';
import { buildSpotPath } from '@/utils/spotRoutes';

const FEED_BASE_PATH = '/api/content/feed';
const FEED_LIST_PATH = '/api/content/feed/';
const REVIEWS_BASE_PATH = '/api/content/reviews';
const NOTIFICATIONS_BASE_PATH = '/api/core/notifications';
const DEFAULT_FALLBACK_PAGE_SIZE = 20;
const STARTER_REVIEW_SPOT_LIMIT = 10;
const STARTER_FEED_HIGHLIGHT_LIMIT = 6;
const DEFAULT_NOTIFICATION_CATEGORIES = ['account', 'security', 'trip', 'friend', 'social', 'comment', 'mention', 'digest', 'general'];
const FEED_READ_FALLBACK_ENABLED = localFallbackEnabled('VITE', 'ENABLE', 'FEED', 'MOCK', 'FALLBACK');
const NOTIFICATION_READ_FALLBACK_ENABLED = localFallbackEnabled('VITE', 'ENABLE', 'NOTIFICATION', 'MOCK', 'FALLBACK');
let hasObservedLiveFeedData = false;
let hasObservedLiveTrendingData = false;

const SHOWCASE_ACTORS: Record<string, Omit<UserProfile, 'id'>> = {
  '11111111111111111111111111111111': {
    username: 'alex.morgan',
    email: '',
    displayName: 'Alex Morgan',
    avatarUrl: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Fictional Scope starter persona for food-first city routes, late dinners, and walkable culture loops.',
    homeBase: 'Fort Worth, TX',
    interests: ['food', 'culture', 'nightlife'],
    stats: { spots: 18, trips: 5, friends: 96 },
    showActivityStatus: true,
  },
  '22222222222222222222222222222222': {
    username: 'maya.chen',
    email: '',
    displayName: 'Maya Chen',
    avatarUrl: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Fictional Scope starter persona for gardens, museums, and design-forward weekend pacing.',
    homeBase: 'Dallas, TX',
    interests: ['scenic', 'culture', 'shopping'],
    stats: { spots: 16, trips: 6, friends: 112 },
    showActivityStatus: true,
  },
  '33333333333333333333333333333333': {
    username: 'elijah.brooks',
    email: '',
    displayName: 'Elijah Brooks',
    avatarUrl: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Fictional Scope starter persona for outdoor resets, strong coffee, and high-energy city walks.',
    homeBase: 'Austin, TX',
    interests: ['adventure', 'food', 'nature'],
    stats: { spots: 21, trips: 7, friends: 88 },
    showActivityStatus: true,
  },
  '44444444444444444444444444444441': {
    username: 'sofia.ramirez',
    email: '',
    displayName: 'Sofia Ramirez',
    avatarUrl: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Fictional Scope starter persona for market mornings, heritage districts, and food-led itineraries.',
    homeBase: 'San Antonio, TX',
    interests: ['food', 'culture', 'shopping'],
    stats: { spots: 22, trips: 8, friends: 134 },
    showActivityStatus: true,
  },
  '55555555555555555555555555555551': {
    username: 'jordan.reed',
    email: '',
    displayName: 'Jordan Reed',
    avatarUrl: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Fictional Scope starter persona for scenic overlooks, rail stations, and daylight-efficient routes.',
    homeBase: 'Denver, CO',
    interests: ['scenic', 'nature', 'adventure'],
    stats: { spots: 19, trips: 5, friends: 76 },
    showActivityStatus: true,
  },
  '66666666666666666666666666666661': {
    username: 'aisha.bello',
    email: '',
    displayName: 'Aisha Bello',
    avatarUrl: 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Fictional Scope starter persona for waterfront walks, art districts, and polished group dinners.',
    homeBase: 'Houston, TX',
    interests: ['culture', 'food', 'scenic'],
    stats: { spots: 17, trips: 6, friends: 101 },
    showActivityStatus: true,
  },
  '77777777777777777777777777777771': {
    username: 'theo.alvarez',
    email: '',
    displayName: 'Theo Alvarez',
    avatarUrl: 'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Fictional Scope starter persona for markets, architecture, and late-night city energy.',
    homeBase: 'Barcelona, ES',
    interests: ['culture', 'shopping', 'nightlife'],
    stats: { spots: 24, trips: 9, friends: 143 },
    showActivityStatus: true,
  },
  '88888888888888888888888888888881': {
    username: 'priya.nair',
    email: '',
    displayName: 'Priya Nair',
    avatarUrl: 'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=600',
    bio: 'Fictional Scope starter persona for gardens, skyline walks, and compact international stopovers.',
    homeBase: 'Singapore',
    interests: ['scenic', 'culture', 'food'],
    stats: { spots: 20, trips: 7, friends: 118 },
    showActivityStatus: true,
  },
};

interface FeedEnvelopeSanitizerOptions {
  allowGeneratedActorAvatar?: boolean;
}

interface SpotEnvelopeSanitizerOptions {
  allowGeneratedAuthorAvatar?: boolean;
}

function sanitizeFeedEnvelope(
  response: ApiEnvelope<FeedItem[]>,
  options: FeedEnvelopeSanitizerOptions = {},
): ApiEnvelope<FeedItem[]> {
  return {
    ...response,
    data: normalizeArrayEnvelopeData(response).map((item) =>
      sanitizeFeedItem(item, { allowGeneratedActorAvatar: options.allowGeneratedActorAvatar }),
    ),
  };
}

function sanitizeNotificationEnvelope(response: ApiEnvelope<NotificationItem[]>): ApiEnvelope<NotificationItem[]> {
  return {
    ...response,
    data: normalizeArrayEnvelopeData(response).map((item) => sanitizeNotificationItem(item)),
  };
}

function sanitizeNotificationPreferenceEnvelope(response: ApiEnvelope<NotificationPreference[]>): ApiEnvelope<NotificationPreference[]> {
  return {
    ...response,
    data: normalizeArrayEnvelopeData(response).map((preference) => sanitizeNotificationPreference(preference)),
  };
}

function sanitizeSpotEnvelope(
  response: ApiEnvelope<SpotSummary[]>,
  options: SpotEnvelopeSanitizerOptions = {},
): ApiEnvelope<SpotSummary[]> {
  return {
    ...response,
    data: normalizeArrayEnvelopeData(response).map((spot) =>
      sanitizeSpotSummary(spot, { allowGeneratedAuthorAvatar: options.allowGeneratedAuthorAvatar }),
    ),
  };
}

async function updateMockNotification(notificationId: string, isRead: boolean): Promise<NotificationItem | undefined> {
  const { mockNotifications } = await loadMockData();
  const notificationIndex = mockNotifications.findIndex((notification) => notification.id === notificationId);

  if (notificationIndex === -1) {
    return undefined;
  }

  const updatedNotification = sanitizeNotificationItem({
    ...mockNotifications[notificationIndex],
    isRead,
  });

  mockNotifications.splice(notificationIndex, 1, updatedNotification);
  return updatedNotification;
}

function buildDefaultMockNotificationPreferences(): NotificationPreference[] {
  return DEFAULT_NOTIFICATION_CATEGORIES.map((category) => sanitizeNotificationPreference({
    category,
    inAppEnabled: true,
    pushEnabled: category !== 'digest',
    emailEnabled: ['account', 'security', 'trip', 'digest'].includes(category),
    digestCadence: category === 'digest' ? 'daily' : 'instant',
    quietHoursStartMinutes: null,
    quietHoursEndMinutes: null,
    timeZoneId: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  }));
}

function buildEmptyNotificationEnvelope(page: number, pageSize: number): ApiEnvelope<NotificationItem[]> {
  return {
    data: [],
    meta: {
      page,
      pageSize: Math.max(1, pageSize || DEFAULT_FALLBACK_PAGE_SIZE),
      total: 0,
      totalPages: 1,
    },
  };
}

async function buildMockFeedEnvelope(page: number, pageSize: number): Promise<ApiEnvelope<FeedItem[]>> {
  const { mockFeed } = await loadMockData();
  const resolvedPageSize = pageSize || mockFeed.length || 1;
  return sanitizeFeedEnvelope(
    paginateItems(sortByCreatedAtDescending(mockFeed), page, resolvedPageSize),
    { allowGeneratedActorAvatar: true },
  );
}

function normalizeActorKey(value: string | undefined): string {
  return String(value ?? '').replace(/[^a-f0-9]/gi, '').toLowerCase();
}

function resolveShowcaseActor(userId: string | undefined): UserProfile {
  const key = normalizeActorKey(userId);
  const showcaseActor = SHOWCASE_ACTORS[key];

  if (showcaseActor) {
    return sanitizeFeedItem({
      id: `actor-${key}`,
      type: 'spot',
      actor: { id: userId || key, ...showcaseActor },
      title: 'Scope activity',
      excerpt: '',
      createdAt: new Date(0).toISOString(),
      targetId: '',
    }).actor;
  }

  const suffix = key.slice(0, 8) || 'scope';
  return sanitizeFeedItem({
    id: `actor-${suffix}`,
    type: 'spot',
    actor: {
      id: userId || suffix,
      username: `traveler-${suffix}`,
      email: '',
      displayName: `Traveler ${suffix}`,
      interests: [],
      stats: { spots: 8, trips: 3, friends: 32 },
      showActivityStatus: true,
    },
    title: 'Scope activity',
    excerpt: '',
    createdAt: new Date(0).toISOString(),
    targetId: '',
  }).actor;
}

function getReviewUserId(review: Review): string | undefined {
  const wireReview = review as Review & { user_id?: unknown; userId?: unknown };
  if (typeof wireReview.user_id === 'string') {
    return wireReview.user_id;
  }
  if (typeof wireReview.userId === 'string') {
    return wireReview.userId;
  }
  return review.user?.id;
}

function getReviewCreatedAt(review: Review): string {
  const wireReview = review as Review & { created_at?: unknown; createdAt?: unknown };
  if (typeof wireReview.created_at === 'string') {
    return wireReview.created_at;
  }
  if (typeof wireReview.createdAt === 'string') {
    return wireReview.createdAt;
  }
  return new Date(0).toISOString();
}

function buildStarterReviewItem(spot: SpotSummary, review: Review): FeedItem {
  const actor = resolveShowcaseActor(getReviewUserId(review));
  const rating = Number(review.rating);
  const ratingLabel = Number.isFinite(rating) ? `${rating.toFixed(1).replace(/\.0$/, '')}/5` : 'Review';

  return sanitizeFeedItem({
    id: `review-${review.id || `${spot.id}-${actor.id}`}`,
    type: 'review',
    actor,
    title: `${actor.displayName} reviewed ${spot.title}`,
    excerpt: review.comment ? `${ratingLabel}: ${review.comment}` : `${ratingLabel} rating for ${spot.title}`,
    createdAt: getReviewCreatedAt(review),
    imageUrl: spot.photoUrl,
    targetId: spot.id,
    targetPath: buildSpotPath(spot),
  });
}

function parseStarterRating(item: FeedItem): number {
  const ratingMatch = item.excerpt.match(/^([0-5](?:\.\d)?)(?:\/5)?/);
  const rating = Number(ratingMatch?.[1]);
  return Number.isFinite(rating) ? rating : 0;
}

function scoreStarterFeedItem(item: FeedItem): number {
  const actorStats = item.actor.stats;
  const socialScore = ((actorStats?.friends ?? 0) * 0.08) + ((actorStats?.spots ?? 0) * 0.5) + ((actorStats?.trips ?? 0) * 0.75);
  const ratingScore = parseStarterRating(item) * 18;
  const noteScore = Math.min(18, Math.max(0, item.excerpt.trim().length / 14));
  const typeScore = item.type === 'review' ? 14 : item.type === 'trip' ? 8 : 5;

  return ratingScore + socialScore + noteScore + typeScore;
}

function selectStarterFeedHighlights(items: FeedItem[]): FeedItem[] {
  const rankedItems = [...items].sort((left, right) => {
    const scoreDelta = scoreStarterFeedItem(right) - scoreStarterFeedItem(left);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });

  const selectedItems: FeedItem[] = [];
  const selectedTargets = new Set<string>();
  const selectedActors = new Set<string>();

  for (const item of rankedItems) {
    if (selectedItems.length >= STARTER_FEED_HIGHLIGHT_LIMIT) {
      break;
    }

    if (selectedTargets.has(item.targetId) || selectedActors.has(item.actor.id)) {
      continue;
    }

    selectedItems.push(item);
    selectedTargets.add(item.targetId);
    selectedActors.add(item.actor.id);
  }

  if (selectedItems.length < STARTER_FEED_HIGHLIGHT_LIMIT) {
    for (const item of rankedItems) {
      if (selectedItems.length >= STARTER_FEED_HIGHLIGHT_LIMIT) {
        break;
      }

      if (selectedItems.some((selectedItem) => selectedItem.id === item.id)) {
        continue;
      }

      selectedItems.push(item);
    }
  }

  return selectedItems;
}

async function getSpotReviewsForStarterFeed(spot: SpotSummary): Promise<FeedItem[]> {
  const { data } = await api.get<ApiEnvelope<Review[]> | Review[]>(`${REVIEWS_BASE_PATH}/spot/${spot.id}`);
  const reviews = normalizeArrayEnvelopeData({ data: 'data' in data ? data.data : data as Review[] });
  return reviews.map((review) => buildStarterReviewItem(spot, review as Review));
}

async function buildPublicStarterReviewFeed(page: number, pageSize: number): Promise<ApiEnvelope<FeedItem[]>> {
  const { data } = await api.get<ApiEnvelope<SpotSummary[]>>(`${FEED_BASE_PATH}/trending`, {
    params: { limit: STARTER_REVIEW_SPOT_LIMIT },
  });
  const spots = sanitizeSpotEnvelope(data).data;
  const reviewGroups = await Promise.allSettled(spots.map((spot) => getSpotReviewsForStarterFeed(spot)));
  const reviewItems = reviewGroups
    .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const starterItems = selectStarterFeedHighlights(reviewItems.length
    ? reviewItems
    : spots.map((spot) => sanitizeFeedItem({
      id: `spot-${spot.id}`,
      type: 'spot',
      actor: resolveShowcaseActor(spot.userId),
      title: `${resolveShowcaseActor(spot.userId).displayName} pinned ${spot.title}`,
      excerpt: spot.description || `${spot.city || 'Scope'} place worth saving.`,
      createdAt: spot.createdAt,
      imageUrl: spot.photoUrl,
      targetId: spot.id,
      targetPath: buildSpotPath(spot),
    })));

  return paginateItems(starterItems, page, pageSize || DEFAULT_FALLBACK_PAGE_SIZE);
}

function rememberLiveFeed(items: FeedItem[]): void {
  if (items.length) {
    hasObservedLiveFeedData = true;
  }
}

function rememberLiveTrending(spots: SpotSummary[]): void {
  if (spots.length) {
    hasObservedLiveTrendingData = true;
  }
}

function hasPrivateFeedAccess(): boolean {
  return Boolean(getAccessToken().trim());
}

export async function getFeed(page = 1, pageSize = DEFAULT_FALLBACK_PAGE_SIZE): Promise<ApiEnvelope<FeedItem[]>> {
  if (DEMO_MODE_ENABLED) {
    return buildMockFeedEnvelope(page, pageSize);
  }

  if (!hasPrivateFeedAccess()) {
    let emptyStarterFeed: ApiEnvelope<FeedItem[]> | null = null;

    try {
      const starterFeed = await buildPublicStarterReviewFeed(page, pageSize);
      if (starterFeed.data.length) {
        return starterFeed;
      }
      emptyStarterFeed = starterFeed;
    } catch (error) {
      if (!FEED_READ_FALLBACK_ENABLED) {
        throw error;
      }
    }

    if (!FEED_READ_FALLBACK_ENABLED && emptyStarterFeed) {
      return emptyStarterFeed;
    }

    return buildMockFeedEnvelope(page, pageSize);
  }

  let liveFeedError: unknown = null;
  let emptyLiveFeed: ApiEnvelope<FeedItem[]> | null = null;
  try {
    const { data } = await api.get<ApiEnvelope<FeedItem[]>>(FEED_LIST_PATH, { params: { page, pageSize } });
    const sanitizedEnvelope = sanitizeFeedEnvelope(data);
    rememberLiveFeed(sanitizedEnvelope.data);
    if (sanitizedEnvelope.data.length || hasObservedLiveFeedData) {
      return sanitizedEnvelope;
    }
    emptyLiveFeed = sanitizedEnvelope;
  } catch (error) {
    liveFeedError = error;
  }

  try {
    const starterFeed = await buildPublicStarterReviewFeed(page, pageSize);
    if (starterFeed.data.length) {
      return starterFeed;
    }
  } catch {
    // If the public starter feed is unavailable, fall through to the existing
    // configured fallback behavior.
  }

  if (!FEED_READ_FALLBACK_ENABLED && liveFeedError) {
    throw liveFeedError;
  }

  if (!FEED_READ_FALLBACK_ENABLED && emptyLiveFeed) {
    return emptyLiveFeed;
  }

  return buildMockFeedEnvelope(page, pageSize);
}

export async function getTrendingSpots(limit = 4): Promise<ApiEnvelope<SpotSummary[]>> {
  async function mockTrendingEnvelope(): Promise<ApiEnvelope<SpotSummary[]>> {
    const { mockSpots } = await loadMockData();
    const trendingSpots = rankTrendingSpots(mockSpots, limit);

    return sanitizeSpotEnvelope(
      {
        data: trendingSpots,
        meta: {
          page: 1,
          pageSize: Math.max(1, limit),
          total: trendingSpots.length,
          totalPages: 1,
        },
      },
      { allowGeneratedAuthorAvatar: true },
    );
  }

  if (DEMO_MODE_ENABLED) {
    return mockTrendingEnvelope();
  }

  try {
    const { data } = await api.get<ApiEnvelope<SpotSummary[]>>(`${FEED_BASE_PATH}/trending`, { params: { limit } });
    const sanitizedEnvelope = sanitizeSpotEnvelope(data);
    const rankedEnvelope = {
      ...sanitizedEnvelope,
      data: rankTrendingSpots(sanitizedEnvelope.data, limit),
    };
    rememberLiveTrending(rankedEnvelope.data);
    if (rankedEnvelope.data.length || hasObservedLiveTrendingData || !FEED_READ_FALLBACK_ENABLED) {
      return rankedEnvelope;
    }
  } catch (error) {
    if (!FEED_READ_FALLBACK_ENABLED) {
      throw error;
    }
  }

  return mockTrendingEnvelope();
}

export async function getNotifications(
  page = 1,
  pageSize = DEFAULT_FALLBACK_PAGE_SIZE,
  filters: { category?: string; unread?: boolean } = {},
): Promise<ApiEnvelope<NotificationItem[]>> {
  if (DEMO_MODE_ENABLED) {
    const { mockNotifications } = await loadMockData();
    const resolvedPageSize = pageSize || mockNotifications.length || 1;
    const filteredNotifications = mockNotifications.filter((notification) => {
      if (filters.category && notification.category !== filters.category) {
        return false;
      }
      if (typeof filters.unread === 'boolean' && notification.isRead === filters.unread) {
        return false;
      }
      return true;
    });
    return sanitizeNotificationEnvelope(paginateItems(sortByCreatedAtDescending(filteredNotifications), page, resolvedPageSize));
  }

  try {
    const { data } = await api.get<ApiEnvelope<NotificationItem[]>>(NOTIFICATIONS_BASE_PATH, {
      params: { page, pageSize, ...filters },
    });
    return sanitizeNotificationEnvelope(data);
  } catch (error) {
    if (!NOTIFICATION_READ_FALLBACK_ENABLED) {
      throw error;
    }
  }

  return buildEmptyNotificationEnvelope(page, pageSize);
}

export async function performNotificationAction(notificationId: string, action: string): Promise<unknown> {
  if (DEMO_MODE_ENABLED) {
    if (action === 'mark_read' || action === 'open' || action.startsWith('accept_') || action.startsWith('decline_')) {
      await updateMockNotification(notificationId, true);
    }
    return { ok: true };
  }

  const { data } = await api.post(`${NOTIFICATIONS_BASE_PATH}/${notificationId}/actions`, { action });
  return data;
}

export async function getNotificationPreferences(): Promise<ApiEnvelope<NotificationPreference[]>> {
  if (DEMO_MODE_ENABLED) {
    return { data: buildDefaultMockNotificationPreferences() };
  }

  try {
    const { data } = await api.get<ApiEnvelope<NotificationPreference[]>>(`${NOTIFICATIONS_BASE_PATH}/preferences`);
    const sanitizedEnvelope = sanitizeNotificationPreferenceEnvelope(data);
    if (sanitizedEnvelope.data.length || !NOTIFICATION_READ_FALLBACK_ENABLED) {
      return sanitizedEnvelope;
    }
  } catch (error) {
    if (!NOTIFICATION_READ_FALLBACK_ENABLED) {
      throw error;
    }
  }

  return { data: buildDefaultMockNotificationPreferences() };
}

export async function updateNotificationPreference(payload: NotificationPreferenceInput): Promise<NotificationPreference> {
  const sanitizedPayload = sanitizeNotificationPreference(payload);

  if (DEMO_MODE_ENABLED) {
    return sanitizedPayload;
  }

  const { data } = await api.put<ApiEnvelope<NotificationPreference> | NotificationPreference>(
    `${NOTIFICATIONS_BASE_PATH}/preferences`,
    sanitizedPayload,
  );
  return sanitizeNotificationPreference('data' in data ? data.data : data);
}

export async function savePushSubscription(payload: PushSubscriptionInput): Promise<unknown> {
  const { data } = await api.post(`${NOTIFICATIONS_BASE_PATH}/push-subscriptions`, payload);
  return data;
}

export async function markNotificationRead(notificationId: string): Promise<NotificationItem | undefined> {
  if (DEMO_MODE_ENABLED) {
    return updateMockNotification(notificationId, true);
  }

  const { data } = await api.put<ApiEnvelope<NotificationItem> | NotificationItem>(
    `${NOTIFICATIONS_BASE_PATH}/${notificationId}/read`,
    undefined,
  );

  return sanitizeNotificationItem('data' in data ? data.data : data);
}

export async function markAllNotificationsRead(): Promise<void> {
  if (DEMO_MODE_ENABLED) {
    const { mockNotifications } = await loadMockData();
    mockNotifications.splice(
      0,
      mockNotifications.length,
      ...mockNotifications.map((notification) =>
        sanitizeNotificationItem({
          ...notification,
          isRead: true,
        }),
      ),
    );
    return;
  }

  await api.put(`${NOTIFICATIONS_BASE_PATH}/read-all`, undefined);
}
