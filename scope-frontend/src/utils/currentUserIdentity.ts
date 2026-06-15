import type { FeedItem, Review, UserProfile } from '@/types';
import { sanitizeUserProfile } from '@/utils/sanitizers';

type ReviewIdentityFields = Review & {
  userId?: unknown;
  user_id?: unknown;
};

const ACTIVITY_TITLE_ACTIONS = [
  ' reviewed ',
  ' pinned ',
  ' planned ',
  ' completed ',
  ' dropped ',
  ' saved ',
  ' shared ',
];

function normalizeUserId(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }

  return '';
}

function sameUserId(left: unknown, right: unknown): boolean {
  const normalizedLeft = normalizeUserId(left);
  const normalizedRight = normalizeUserId(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function getReviewUserId(review: Review): string {
  const wireReview = review as ReviewIdentityFields;
  return normalizeUserId(review.user?.id)
    || normalizeUserId(wireReview.userId)
    || normalizeUserId(wireReview.user_id);
}

function mergeCurrentUserIdentity(existingUser: UserProfile | null | undefined, currentUser: UserProfile): UserProfile {
  const displayName = currentUser.displayName?.trim()
    || existingUser?.displayName?.trim()
    || currentUser.username?.trim()
    || existingUser?.username?.trim()
    || 'Scope traveler';

  return sanitizeUserProfile({
    id: currentUser.id,
    username: currentUser.username?.trim() || existingUser?.username || '',
    email: currentUser.email?.trim() || existingUser?.email || '',
    displayName,
    avatarUrl: currentUser.avatarUrl?.trim() || existingUser?.avatarUrl,
    bio: currentUser.bio ?? existingUser?.bio,
    homeBase: currentUser.homeBase ?? existingUser?.homeBase,
    interests: currentUser.interests?.length ? [...currentUser.interests] : [...(existingUser?.interests ?? [])],
    stats: currentUser.stats ? { ...currentUser.stats } : existingUser?.stats ? { ...existingUser.stats } : undefined,
    showActivityStatus: currentUser.showActivityStatus ?? existingUser?.showActivityStatus,
    profileVisibility: currentUser.profileVisibility ?? existingUser?.profileVisibility,
  });
}

function rewriteActivityTitleForCurrentUser(title: string, actor: UserProfile): string {
  const displayName = actor.displayName?.trim();
  if (!displayName) {
    return title;
  }

  const lowerTitle = title.toLowerCase();
  const matchedAction = ACTIVITY_TITLE_ACTIONS.find((action) => lowerTitle.indexOf(action) > 0);
  if (!matchedAction) {
    return title;
  }

  const actionIndex = lowerTitle.indexOf(matchedAction);
  return `${displayName}${title.slice(actionIndex)}`;
}

export function applyCurrentUserIdentityToReview(review: Review, currentUser: UserProfile | null | undefined): Review {
  if (review.isAnonymous || !currentUser?.id || !sameUserId(getReviewUserId(review), currentUser.id)) {
    return review;
  }

  return {
    ...review,
    user: mergeCurrentUserIdentity(review.user, currentUser),
  };
}

export function applyCurrentUserIdentityToReviews(
  reviews: Review[],
  currentUser: UserProfile | null | undefined,
): Review[] {
  return reviews.map((review) => applyCurrentUserIdentityToReview(review, currentUser));
}

export function applyCurrentUserIdentityToFeedItem(
  item: FeedItem,
  currentUser: UserProfile | null | undefined,
): FeedItem {
  if (!currentUser?.id || !sameUserId(item.actor.id, currentUser.id)) {
    return item;
  }

  const actor = mergeCurrentUserIdentity(item.actor, currentUser);
  return {
    ...item,
    actor,
    title: rewriteActivityTitleForCurrentUser(item.title, actor),
  };
}

export function applyCurrentUserIdentityToFeedItems(
  items: FeedItem[],
  currentUser: UserProfile | null | undefined,
): FeedItem[] {
  return items.map((item) => applyCurrentUserIdentityToFeedItem(item, currentUser));
}
