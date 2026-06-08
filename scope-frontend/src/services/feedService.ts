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
import { formatCityRegionLocation } from '@/utils/formatters';
import { rankTrendingSpots } from '@/utils/spotRanking';
import { buildSpotPath } from '@/utils/spotRoutes';
import {
  normalizeShowcaseActorKey,
  resolveShowcaseUserProfile,
} from '@/utils/showcaseActors';

const FEED_BASE_PATH = '/api/content/feed';
const FEED_LIST_PATH = '/api/content/feed/';
const SPOTS_COLLECTION_PATH = '/api/content/spots/';
const REVIEWS_BASE_PATH = '/api/content/reviews';
const NOTIFICATIONS_BASE_PATH = '/api/core/notifications';
const DEFAULT_FALLBACK_PAGE_SIZE = 20;
const STARTER_REVIEW_SPOT_LIMIT = 10;
const STARTER_FEED_HIGHLIGHT_LIMIT = 6;
const STARTER_FEED_FIXED_HEAD_COUNT = 4;
const DEFAULT_NOTIFICATION_CATEGORIES = ['account', 'security', 'trip', 'friend', 'social', 'comment', 'mention', 'digest', 'general'];
const FEED_READ_FALLBACK_ENABLED = localFallbackEnabled('VITE', 'ENABLE', 'FEED', 'MOCK', 'FALLBACK');
const NOTIFICATION_READ_FALLBACK_ENABLED = localFallbackEnabled('VITE', 'ENABLE', 'NOTIFICATION', 'MOCK', 'FALLBACK');
let hasObservedLiveFeedData = false;
let hasObservedLiveTrendingData = false;

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

async function getRankedPublicSpotEnvelope(limit: number): Promise<ApiEnvelope<SpotSummary[]>> {
  const { data } = await api.get<ApiEnvelope<SpotSummary[]>>(SPOTS_COLLECTION_PATH, {
    params: { page: 1, pageSize: Math.max(1, limit) },
  });
  const sanitizedEnvelope = sanitizeSpotEnvelope(data);

  return {
    ...sanitizedEnvelope,
    data: rankTrendingSpots(sanitizedEnvelope.data, limit),
  };
}

async function getPublicStarterSpots(limit: number): Promise<SpotSummary[]> {
  try {
    const { data } = await api.get<ApiEnvelope<SpotSummary[]>>(`${FEED_BASE_PATH}/trending`, {
      params: { limit },
    });
    const spots = sanitizeSpotEnvelope(data).data;
    if (spots.length) {
      return rankTrendingSpots(spots, limit);
    }
  } catch {
    // Production currently seeds public spots before it exposes a public feed
    // trending endpoint, so use those same spots to build review activity.
  }

  return getRankedPublicSpotEnvelope(limit).then((envelope) => envelope.data);
}

async function buildMockFeedEnvelope(page: number, pageSize: number): Promise<ApiEnvelope<FeedItem[]>> {
  const { mockFeed } = await loadMockData();
  const resolvedPageSize = pageSize || mockFeed.length || 1;
  return sanitizeFeedEnvelope(
    paginateItems(sortByCreatedAtDescending(mockFeed), page, resolvedPageSize),
    { allowGeneratedActorAvatar: true },
  );
}

function resolveShowcaseActor(userId: string | undefined): UserProfile {
  const key = normalizeShowcaseActorKey(userId);
  const showcaseActor = resolveShowcaseUserProfile(userId);

  if (showcaseActor) {
    return sanitizeFeedItem({
      id: `actor-${key}`,
      type: 'spot',
      actor: showcaseActor,
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
    targetLocation: formatCityRegionLocation(spot, ''),
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
  const typeScore = item.type === 'review' ? 14 : 5;

  return ratingScore + socialScore + noteScore + typeScore;
}

function shuffleFeedItems(items: FeedItem[]): FeedItem[] {
  const shuffledItems = [...items];

  for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffledItems[index], shuffledItems[swapIndex]] = [shuffledItems[swapIndex], shuffledItems[index]];
  }

  return shuffledItems;
}

function buildStarterCandidateOrder(items: FeedItem[], randomize: boolean): FeedItem[] {
  if (!randomize || items.length <= STARTER_FEED_HIGHLIGHT_LIMIT) {
    return items;
  }

  const fixedHeadCount = Math.min(STARTER_FEED_FIXED_HEAD_COUNT, items.length);
  return [
    ...items.slice(0, fixedHeadCount),
    ...shuffleFeedItems(items.slice(fixedHeadCount)),
  ];
}

function selectStarterFeedHighlights(items: FeedItem[], randomize: boolean): FeedItem[] {
  const rankedItems = [...items].sort((left, right) => {
    const scoreDelta = scoreStarterFeedItem(right) - scoreStarterFeedItem(left);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
  const candidateItems = buildStarterCandidateOrder(rankedItems, randomize);

  const selectedItems: FeedItem[] = [];
  const selectedTargets = new Set<string>();
  const selectedActors = new Set<string>();

  for (const item of candidateItems) {
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
    for (const item of candidateItems) {
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

async function buildPublicStarterReviewFeed(
  page: number,
  pageSize: number,
  randomize: boolean,
): Promise<ApiEnvelope<FeedItem[]>> {
  const spots = await getPublicStarterSpots(STARTER_REVIEW_SPOT_LIMIT);
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
      targetLocation: formatCityRegionLocation(spot, ''),
    })), randomize);

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

export async function getHomeActivityFeed(page = 1, pageSize = DEFAULT_FALLBACK_PAGE_SIZE): Promise<ApiEnvelope<FeedItem[]>> {
  if (DEMO_MODE_ENABLED) {
    return buildMockFeedEnvelope(page, pageSize);
  }

  let emptyStarterFeed: ApiEnvelope<FeedItem[]> | null = null;

  try {
    const starterFeed = await buildPublicStarterReviewFeed(page, pageSize, true);
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

export async function getFeed(page = 1, pageSize = DEFAULT_FALLBACK_PAGE_SIZE): Promise<ApiEnvelope<FeedItem[]>> {
  if (DEMO_MODE_ENABLED) {
    return buildMockFeedEnvelope(page, pageSize);
  }

  if (!hasPrivateFeedAccess()) {
    let emptyStarterFeed: ApiEnvelope<FeedItem[]> | null = null;

    try {
      const starterFeed = await buildPublicStarterReviewFeed(page, pageSize, true);
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
    const starterFeed = await buildPublicStarterReviewFeed(page, pageSize, true);
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

  let liveTrendingError: unknown = null;
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
    liveTrendingError = error;
  }

  try {
    const rankedPublicSpots = await getRankedPublicSpotEnvelope(limit);
    rememberLiveTrending(rankedPublicSpots.data);
    if (rankedPublicSpots.data.length || hasObservedLiveTrendingData || !FEED_READ_FALLBACK_ENABLED) {
      return rankedPublicSpots;
    }
  } catch (error) {
    liveTrendingError = error;
  }

  if (!FEED_READ_FALLBACK_ENABLED && liveTrendingError) {
    throw liveTrendingError;
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
