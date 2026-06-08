import type {
  AuthForm,
  AuthPayload,
  FeedItem,
  FriendConnection,
  FriendRequest,
  Itinerary,
  MapPoint,
  NotificationItem,
  NotificationPreference,
  Photo,
  RegisterForm,
  RegisterPayload,
  Review,
  SpotCategory,
  SpotDetail,
  SpotFormSubmission,
  SpotPillar,
  SpotSafetyStatus,
  SpotSummary,
  SpotVerificationStatus,
  Trip,
  TripMember,
  TripPlannerInput,
  TripSpot,
  UserProfile,
} from '@/types';
import {
  resolveAvatarUrl,
  resolveFeedImageUrl,
  resolveSpotPhotoUrl,
  resolveTripCoverImageUrl,
} from '@/utils/imageFallbacks';
import { resolveShowcaseUserProfile } from '@/utils/showcaseActors';

const CONTROL_CHARACTER_CLASS = [
  `${String.fromCharCode(0)}-${String.fromCharCode(8)}`,
  String.fromCharCode(11),
  String.fromCharCode(12),
  `${String.fromCharCode(14)}-${String.fromCharCode(31)}`,
  `${String.fromCharCode(127)}-${String.fromCharCode(159)}`,
].join('');
const CONTROL_CHARACTERS_REGEX = new RegExp(`[${CONTROL_CHARACTER_CLASS}]`, 'g');
const INLINE_WHITESPACE_REGEX = /[^\S\n]+/g;
const MULTIPLE_NEWLINES_REGEX = /\n{3,}/g;
const RELATIVE_URL_REGEX = /^(?:\.{1,2}\/|\/)[^\s]*$/;
const DATA_IMAGE_URL_REGEX = /^data:image\/(?:png|jpe?g|webp|gif|avif);base64,[a-z0-9+/=\s]+$/i;
const SAFE_IMAGE_PROTOCOLS = new Set(['http:', 'https:', 'blob:']);
const GENERATED_AVATAR_HOSTS = new Set(['i.pravatar.cc', 'pravatar.cc']);

const DEFAULT_DISPLAY_NAME = 'New explorer';
const DEFAULT_SPOT_TITLE = 'Untitled spot';
const DEFAULT_TRIP_TITLE = 'Untitled trip';
const DEFAULT_DESTINATION = 'Scope destination';
const DEFAULT_FEED_TITLE = 'Scope activity';
const DEFAULT_NOTIFICATION_TITLE = 'Scope update';
const DEFAULT_NOTIFICATION_BODY = 'A new Scope update is available.';
const DEFAULT_WEATHER_FORECAST = 'Forecast pending.';
const DEFAULT_SPOT_CATEGORY: SpotCategory = 'other';
const SPOT_CATEGORIES = new Set<SpotCategory>([
  'food',
  'nature',
  'nightlife',
  'culture',
  'adventure',
  'shopping',
  'entertainment',
  'scenic',
  'other',
]);
const SPOT_PILLARS = new Set<SpotPillar>([
  'hidden-gem',
  'photo-worthy',
  'date-night',
  'group-friendly',
  'solo-friendly',
  'family-friendly',
  'budget-friendly',
  'worth-the-drive',
  'quick-stop',
  'calm',
  'lively',
  'luxury-feel',
]);
const SPOT_VERIFICATION_STATUSES = new Set<SpotVerificationStatus>(['legacy', 'unverified', 'verified', 'rejected']);
const SPOT_SAFETY_STATUSES = new Set<SpotSafetyStatus>(['legacy', 'clean', 'blocked']);
const HANDLE_DISPLAY_NAME_REPAIRS: Record<string, string> = {
  louisdo: 'Louis Do',
};

interface AvatarSanitizerOptions {
  allowGeneratedAvatar?: boolean;
}

interface SpotSanitizerOptions {
  allowGeneratedAuthorAvatar?: boolean;
  allowGeneratedReviewAvatars?: boolean;
}

type SpotWireVisibility = {
  isPublic?: unknown;
  is_public?: unknown;
};

type SpotWireFields = SpotWireVisibility & {
  admin_area?: unknown;
  average_rating?: unknown;
  created_at?: unknown;
  likes_count?: unknown;
  photo_url?: unknown;
  province?: unknown;
  provider_place_address?: unknown;
  provider_place_id?: unknown;
  provider_place_name?: unknown;
  postal_code?: unknown;
  region?: unknown;
  safety_reason?: unknown;
  safety_status?: unknown;
  state?: unknown;
  state_code?: unknown;
  user_id?: unknown;
  userId?: unknown;
  verified_at?: unknown;
  verification_distance_meters?: unknown;
  verification_source?: unknown;
  verification_status?: unknown;
};

type UserWireFields = Partial<UserProfile> & {
  avatar_url?: unknown;
  display_name?: unknown;
  home_base?: unknown;
  show_activity_status?: unknown;
};

type ReviewWireFields = {
  id?: unknown;
  spotId?: unknown;
  spot_id?: unknown;
  user?: unknown;
  userId?: unknown;
  user_id?: unknown;
  username?: unknown;
  displayName?: unknown;
  display_name?: unknown;
  email?: unknown;
  avatarUrl?: unknown;
  avatar_url?: unknown;
  rating?: unknown;
  comment?: unknown;
  createdAt?: unknown;
  created_at?: unknown;
  sentimentScore?: unknown;
  sentiment_score?: unknown;
};

interface TripSanitizerOptions {
  allowGeneratedMemberAvatars?: boolean;
}

type TripSpotWireFields = Partial<TripSpot> & {
  spot?: unknown;
  spot_id?: unknown;
  spot_title?: unknown;
  day_number?: unknown;
  sort_order?: unknown;
  ai_reason?: unknown;
  match_confidence?: unknown;
};

type TripMemberWireFields = Partial<TripMember> & {
  user_id?: unknown;
  userId?: unknown;
  role?: unknown;
  display_name?: unknown;
};

type TripWireFields = Partial<Trip> & {
  is_public?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  cover_photo_url?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

type FeedWireFields = Partial<FeedItem> & {
  activity_type?: unknown;
  activityType?: unknown;
  created_at?: unknown;
  image_url?: unknown;
  target_type?: unknown;
  targetType?: unknown;
  target_location?: unknown;
  target_path?: unknown;
  target_id?: unknown;
  item?: unknown;
};

interface FeedSanitizerOptions {
  allowGeneratedActorAvatar?: boolean;
}

function resolveFeedItemType(
  item: FeedItem,
  wireItem: FeedWireFields,
  nestedItem: Record<string, unknown>,
): FeedItem['type'] {
  const rawType = optionalWireString((item as FeedItem & { type?: unknown }).type);
  const activityType =
    optionalWireString(wireItem.activityType) ??
    optionalWireString(wireItem.activity_type) ??
    optionalWireString(nestedItem.activityType) ??
    optionalWireString(nestedItem.activity_type);
  const targetType =
    optionalWireString(wireItem.targetType) ??
    optionalWireString(wireItem.target_type) ??
    optionalWireString(nestedItem.targetType) ??
    optionalWireString(nestedItem.target_type);
  const normalizedSignals = [rawType, activityType, targetType]
    .map((value) => value?.toLowerCase() ?? '')
    .filter(Boolean);
  const titleSignal = sanitizeSingleLineText(item.title).toLowerCase();

  if (
    normalizedSignals.some((signal) => signal.includes('review')) ||
    /\breviewed\b/.test(titleSignal) ||
    /\breview\s+(?:of|for)\b/.test(titleSignal)
  ) {
    return 'review';
  }

  if (normalizedSignals.some((signal) => signal.includes('trip'))) {
    return 'trip';
  }

  return 'spot';
}

interface FriendSanitizerOptions {
  allowGeneratedUserAvatar?: boolean;
}

function normalizeText(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARACTERS_REGEX, '');
}

function optionalSingleLineText(value: string | null | undefined): string | undefined {
  const sanitized = sanitizeSingleLineText(value);
  return sanitized || undefined;
}

function optionalMultilineText(value: string | null | undefined): string | undefined {
  const sanitized = sanitizeMultilineText(value);
  return sanitized || undefined;
}

function optionalWireString(value: unknown): string | undefined {
  return typeof value === 'string' ? optionalSingleLineText(value) : undefined;
}

function sanitizeCompactText(value: string | null | undefined): string {
  return normalizeText(value).replace(/\s+/g, '').trim();
}

export function sanitizeSingleLineText(value: string | null | undefined): string {
  return normalizeText(value).replace(/\s+/g, ' ').trim();
}

export function sanitizeMultilineText(value: string | null | undefined): string {
  return normalizeText(value)
    .split('\n')
    .map((line) => line.replace(INLINE_WHITESPACE_REGEX, ' ').trim())
    .join('\n')
    .replace(MULTIPLE_NEWLINES_REGEX, '\n\n')
    .trim();
}

export function sanitizeImageUrl(value: string | null | undefined): string | undefined {
  const sanitized = sanitizeCompactText(value);

  if (!sanitized) {
    return undefined;
  }

  if (DATA_IMAGE_URL_REGEX.test(sanitized)) {
    return sanitized;
  }

  if (RELATIVE_URL_REGEX.test(sanitized) && !sanitized.startsWith('//')) {
    return sanitized;
  }

  try {
    const url = new URL(sanitized);
    return SAFE_IMAGE_PROTOCOLS.has(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function sanitizeAvatarUrl(
  value: string | null | undefined,
  options: AvatarSanitizerOptions = {},
): string | undefined {
  const sanitized = sanitizeImageUrl(value);

  if (!sanitized) {
    return undefined;
  }

  try {
    const url = new URL(sanitized);

    if (GENERATED_AVATAR_HOSTS.has(url.hostname.toLowerCase()) && !options.allowGeneratedAvatar) {
      return undefined;
    }
  } catch {
    return sanitized;
  }

  return sanitized;
}

function sanitizeEmail(value: string | null | undefined): string | undefined {
  const sanitized = sanitizeCompactText(value).toLowerCase();
  return sanitized || undefined;
}

function sanitizeLoginIdentifier(value: string | null | undefined): string {
  const sanitized = sanitizeSingleLineText(value);
  if (!sanitized) {
    return '';
  }

  return sanitized.includes('@') ? sanitizeCompactText(sanitized).toLowerCase() : sanitized;
}

function sanitizePhoneNumber(value: string | null | undefined): string | undefined {
  const sanitized = sanitizeSingleLineText(value);
  return sanitized || undefined;
}

function compactIdentity(value: string | null | undefined): string {
  return sanitizeSingleLineText(value).replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function sanitizeNonNegativeNumber(value: number | null | undefined, fallback = 0): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, numericValue) : fallback;
}

function sanitizeOptionalNumber(value: unknown): number | undefined {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function sanitizeOptionalConfidence(value: unknown): number | undefined {
  const numericValue = sanitizeOptionalNumber(value);
  return typeof numericValue === 'number'
    ? Math.min(1, Math.max(0, numericValue))
    : undefined;
}

function sanitizeOptionalCoordinate(value: number | null | undefined, minimum: number, maximum: number): number | undefined {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < minimum || numericValue > maximum) {
    return undefined;
  }

  return numericValue;
}

function sanitizeSpotCategory(value: SpotCategory | string | null | undefined): SpotCategory {
  const category = value as SpotCategory;
  return SPOT_CATEGORIES.has(category) ? category : DEFAULT_SPOT_CATEGORY;
}

function sanitizeSpotPillars(value: unknown): SpotPillar[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const pillars: SpotPillar[] = [];
  value.forEach((item) => {
    const pillar = sanitizeSingleLineText(item as string | null | undefined) as SpotPillar;
    if (SPOT_PILLARS.has(pillar) && !pillars.includes(pillar)) {
      pillars.push(pillar);
    }
  });
  return pillars.slice(0, 4);
}

function sanitizeSpotVerificationStatus(value: unknown): SpotVerificationStatus | undefined {
  const status = sanitizeSingleLineText(value as string | null | undefined) as SpotVerificationStatus;
  return SPOT_VERIFICATION_STATUSES.has(status) ? status : undefined;
}

function sanitizeSpotSafetyStatus(value: unknown): SpotSafetyStatus | undefined {
  const status = sanitizeSingleLineText(value as string | null | undefined) as SpotSafetyStatus;
  return SPOT_SAFETY_STATUSES.has(status) ? status : undefined;
}

function sanitizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  return fallback;
}

function sanitizeSpotVisibility(spot: SpotWireVisibility): boolean {
  return sanitizeBoolean(spot.isPublic, sanitizeBoolean(spot.is_public, true));
}

function sanitizeDisplayName(
  value: string | null | undefined,
  context: { username?: string | null; email?: string | null } = {},
): string {
  const sanitized = sanitizeSingleLineText(value);
  const username = sanitizeSingleLineText(context.username);
  const emailLocalPart = sanitizeEmail(context.email)?.split('@')[0] ?? '';
  const fallback = sanitized || username || DEFAULT_DISPLAY_NAME;
  const compactFallback = compactIdentity(fallback);
  const compactUsername = compactIdentity(username);
  const compactEmailLocalPart = compactIdentity(emailLocalPart);
  const repairedName =
    HANDLE_DISPLAY_NAME_REPAIRS[compactFallback] ||
    HANDLE_DISPLAY_NAME_REPAIRS[compactUsername] ||
    HANDLE_DISPLAY_NAME_REPAIRS[compactEmailLocalPart];
  const isHandleCopiedToDisplayName = Boolean(
    compactFallback &&
    repairedName &&
    (compactFallback === compactUsername || compactFallback === compactEmailLocalPart),
  );

  if (isHandleCopiedToDisplayName) {
    return repairedName;
  }

  return fallback;
}

function isGeneratedTravelerDisplayName(value: string | undefined): boolean {
  return /^Traveler\s+[0-9a-f]{4,}$/i.test(sanitizeSingleLineText(value));
}

export function sanitizeAuthForm(payload: AuthForm): AuthForm {
  return {
    email: sanitizeLoginIdentifier(payload.email),
    password: String(payload.password ?? ''),
  };
}

export function sanitizeRegisterForm(payload: RegisterForm): RegisterPayload {
  const username = sanitizeSingleLineText(payload.username);
  const email = sanitizeEmail(payload.email) ?? '';
  const displayName = sanitizeSingleLineText(payload.displayName) ||
    [payload.firstName, payload.lastName]
      .map((part) => sanitizeSingleLineText(part))
      .filter(Boolean)
      .join(' ');
  const phoneNumber = sanitizePhoneNumber(payload.phoneNumber);

  return {
    email,
    password: String(payload.password ?? ''),
    username,
    displayName: sanitizeDisplayName(displayName, { username, email }),
    ...(phoneNumber ? { phoneNumber } : {}),
    // Only forward ISO dates. Anything else (already-validated client-side)
    // becomes an empty string so the server can surface its own error.
    dateOfBirth: /^\d{4}-\d{2}-\d{2}$/.test(payload.dateOfBirth ?? '')
      ? payload.dateOfBirth
      : '',
  };
}

export function sanitizeAuthPayload(payload: AuthPayload): AuthPayload {
  const username = sanitizeSingleLineText(payload.username);

  return {
    ...payload,
    username: username || 'scope-user',
    email: sanitizeEmail(payload.email),
    displayName: sanitizeDisplayName(payload.displayName, { username, email: payload.email }),
    avatarUrl: sanitizeAvatarUrl(payload.avatarUrl),
    homeBase: optionalSingleLineText(payload.homeBase),
    interests: Array.isArray(payload.interests)
      ? payload.interests.map((interest) => sanitizeSingleLineText(interest)).filter(Boolean)
      : undefined,
    showActivityStatus: sanitizeBoolean(payload.showActivityStatus, true),
    profileVisibility: payload.profileVisibility === 'public' || payload.profileVisibility === 'private'
      ? payload.profileVisibility
      : 'friends',
    accessToken: String(payload.accessToken ?? '').trim(),
    refreshToken: String(payload.refreshToken ?? '').trim(),
  };
}

export function sanitizeUserProfile(
  user: UserProfile,
  options: AvatarSanitizerOptions = {},
): UserProfile {
  const username = sanitizeSingleLineText(user.username);
  const displayName = sanitizeDisplayName(user.displayName, { username, email: user.email });
  const avatarSeed = user.id || username || displayName || DEFAULT_DISPLAY_NAME;

  return {
    ...user,
    username: username || 'scope-user',
    email: sanitizeEmail(user.email) ?? '',
    displayName,
    avatarUrl: resolveAvatarUrl(sanitizeAvatarUrl(user.avatarUrl, options), avatarSeed),
    bio: optionalMultilineText(user.bio),
    homeBase: optionalSingleLineText(user.homeBase),
    interests: (user.interests ?? []).map((interest) => sanitizeSingleLineText(interest)).filter(Boolean),
    stats: user.stats ? { ...user.stats } : undefined,
    showActivityStatus: sanitizeBoolean(user.showActivityStatus, true),
    profileVisibility: user.profileVisibility === 'public' || user.profileVisibility === 'private'
      ? user.profileVisibility
      : 'friends',
  };
}

export function sanitizePhoto(photo: Photo): Photo {
  const wirePhoto = photo as Photo & {
    storageUrl?: unknown;
    storage_url?: unknown;
    thumbnailUrl?: unknown;
    thumbnail_url?: unknown;
  };
  const url = typeof photo.url === 'string'
    ? photo.url
    : typeof wirePhoto.storageUrl === 'string'
      ? wirePhoto.storageUrl
      : typeof wirePhoto.storage_url === 'string'
        ? wirePhoto.storage_url
        : typeof wirePhoto.thumbnailUrl === 'string'
          ? wirePhoto.thumbnailUrl
          : typeof wirePhoto.thumbnail_url === 'string'
            ? wirePhoto.thumbnail_url
            : undefined;

  return {
    ...photo,
    url: sanitizeImageUrl(url) ?? '',
    caption: optionalSingleLineText(photo.caption),
  };
}

export function sanitizeReview(
  review: Review,
  options: AvatarSanitizerOptions = {},
): Review {
  const source = (review ?? {}) as Partial<Review>;
  const wireReview = source as ReviewWireFields;
  const wireUser = wireReview.user && typeof wireReview.user === 'object'
    ? wireReview.user as UserWireFields
    : undefined;
  const userId =
    optionalWireString(wireUser?.id) ??
    optionalWireString(wireReview.userId) ??
    optionalWireString(wireReview.user_id) ??
    'unknown-reviewer';
  const username =
    optionalWireString(wireUser?.username) ??
    optionalWireString(wireReview.username) ??
    `traveler-${userId.slice(0, 8)}`;
  const displayName =
    optionalWireString(wireUser?.displayName) ??
    optionalWireString(wireUser?.display_name) ??
    optionalWireString(wireReview.displayName) ??
    optionalWireString(wireReview.display_name) ??
    `Traveler ${userId.slice(0, 8)}`;
  const email = sanitizeEmail(optionalWireString(wireUser?.email) ?? optionalWireString(wireReview.email)) ?? '';
  const avatarUrl =
    optionalWireString(wireUser?.avatarUrl) ??
    optionalWireString(wireUser?.avatar_url) ??
    optionalWireString(wireReview.avatarUrl) ??
    optionalWireString(wireReview.avatar_url);
  const showcaseReviewer = resolveShowcaseUserProfile(userId);
  const shouldUseShowcaseReviewer = Boolean(
    showcaseReviewer &&
    (!displayName || isGeneratedTravelerDisplayName(displayName) || !wireUser),
  );
  const reviewer: UserProfile = {
    id: showcaseReviewer?.id ?? userId,
    username: shouldUseShowcaseReviewer ? showcaseReviewer!.username : username,
    email: shouldUseShowcaseReviewer ? showcaseReviewer!.email : email,
    displayName: shouldUseShowcaseReviewer ? showcaseReviewer!.displayName : displayName,
    avatarUrl: shouldUseShowcaseReviewer ? showcaseReviewer!.avatarUrl : avatarUrl,
    bio: shouldUseShowcaseReviewer ? showcaseReviewer!.bio : optionalMultilineText(optionalWireString(wireUser?.bio)),
    homeBase: shouldUseShowcaseReviewer
      ? showcaseReviewer!.homeBase
      : optionalWireString(wireUser?.homeBase) ?? optionalWireString(wireUser?.home_base),
    interests: shouldUseShowcaseReviewer
      ? [...showcaseReviewer!.interests]
      : Array.isArray(wireUser?.interests)
      ? wireUser.interests.map((interest) => sanitizeSingleLineText(interest)).filter(Boolean)
      : [],
    stats: shouldUseShowcaseReviewer
      ? showcaseReviewer!.stats ? { ...showcaseReviewer!.stats } : undefined
      : wireUser?.stats ? { ...wireUser.stats } : undefined,
    showActivityStatus: shouldUseShowcaseReviewer ? showcaseReviewer!.showActivityStatus : sanitizeBoolean(
      wireUser?.showActivityStatus,
      sanitizeBoolean(wireUser?.show_activity_status, true),
    ),
  };
  const createdAt =
    optionalWireString(wireReview.createdAt) ??
    optionalWireString(wireReview.created_at) ??
    '';
  const sentimentScore = sanitizeOptionalNumber(wireReview.sentimentScore ?? wireReview.sentiment_score);

  return {
    ...source,
    id: optionalWireString(wireReview.id) ?? '',
    spotId: optionalWireString(wireReview.spotId) ?? optionalWireString(wireReview.spot_id) ?? '',
    user: sanitizeUserProfile(reviewer, options),
    rating: sanitizeOptionalNumber(wireReview.rating) ?? 0,
    comment: sanitizeMultilineText(optionalWireString(wireReview.comment)),
    createdAt,
    sentiment_score: sentimentScore ?? null,
  };
}

export function sanitizeSpotSummary(
  spot: SpotSummary,
  options: SpotSanitizerOptions = {},
): SpotSummary {
  const wireSpot = spot as SpotSummary & SpotWireFields;
  const rating = sanitizeOptionalNumber(spot.rating) ?? sanitizeOptionalNumber(wireSpot.average_rating) ?? 0;
  const likesCount = sanitizeOptionalNumber(spot.likesCount) ?? sanitizeOptionalNumber(wireSpot.likes_count);
  const category = sanitizeSpotCategory(spot.category);
  const pillars = sanitizeSpotPillars((spot as SpotSummary & { pillars?: unknown }).pillars);
  const createdAt = typeof spot.createdAt === 'string'
    ? spot.createdAt
    : typeof wireSpot.created_at === 'string'
      ? wireSpot.created_at
      : '';
  const userId = optionalWireString(spot.userId) ?? optionalWireString(wireSpot.user_id);
  const photoUrl = typeof spot.photoUrl === 'string'
    ? spot.photoUrl
    : typeof wireSpot.photo_url === 'string'
      ? wireSpot.photo_url
      : undefined;
  const verificationStatus = sanitizeSpotVerificationStatus(spot.verificationStatus ?? wireSpot.verification_status);
  const safetyStatus = sanitizeSpotSafetyStatus(spot.safetyStatus ?? wireSpot.safety_status);

  return {
    ...spot,
    title: sanitizeSingleLineText(spot.title) || DEFAULT_SPOT_TITLE,
    description: optionalMultilineText(spot.description),
    address: optionalSingleLineText(spot.address),
    city: optionalSingleLineText(spot.city),
    country: optionalSingleLineText(spot.country),
    adminArea: optionalSingleLineText(spot.adminArea ?? (typeof wireSpot.admin_area === 'string' ? wireSpot.admin_area : undefined)),
    province: optionalSingleLineText(spot.province ?? (typeof wireSpot.province === 'string' ? wireSpot.province : undefined)),
    region: optionalSingleLineText(spot.region ?? (typeof wireSpot.region === 'string' ? wireSpot.region : undefined)),
    state: optionalSingleLineText(spot.state ?? (typeof wireSpot.state === 'string' ? wireSpot.state : undefined)),
    stateCode: optionalSingleLineText(spot.stateCode ?? (typeof wireSpot.state_code === 'string' ? wireSpot.state_code : undefined)),
    postalCode: optionalSingleLineText(spot.postalCode ?? (typeof wireSpot.postal_code === 'string' ? wireSpot.postal_code : undefined)),
    vibe: optionalSingleLineText(spot.vibe),
    category,
    pillars,
    rating,
    createdAt,
    isPublic: sanitizeSpotVisibility(wireSpot),
    userId,
    photoUrl: resolveSpotPhotoUrl(category, sanitizeImageUrl(photoUrl)),
    likesCount,
    verificationStatus,
    verificationSource: optionalSingleLineText(spot.verificationSource ?? (typeof wireSpot.verification_source === 'string' ? wireSpot.verification_source : undefined)),
    providerPlaceId: optionalSingleLineText(spot.providerPlaceId ?? (typeof wireSpot.provider_place_id === 'string' ? wireSpot.provider_place_id : undefined)),
    providerPlaceName: optionalSingleLineText(spot.providerPlaceName ?? (typeof wireSpot.provider_place_name === 'string' ? wireSpot.provider_place_name : undefined)),
    providerPlaceAddress: optionalSingleLineText(spot.providerPlaceAddress ?? (typeof wireSpot.provider_place_address === 'string' ? wireSpot.provider_place_address : undefined)),
    verificationDistanceMeters: sanitizeOptionalNumber(spot.verificationDistanceMeters ?? wireSpot.verification_distance_meters) ?? null,
    verifiedAt: typeof spot.verifiedAt === 'string'
      ? spot.verifiedAt
      : typeof wireSpot.verified_at === 'string'
        ? wireSpot.verified_at
        : null,
    safetyStatus,
    safetyReason: optionalSingleLineText(spot.safetyReason ?? (typeof wireSpot.safety_reason === 'string' ? wireSpot.safety_reason : undefined)),
    author: spot.author
      ? sanitizeUserProfile(spot.author, { allowGeneratedAvatar: options.allowGeneratedAuthorAvatar })
      : undefined,
  };
}

export function sanitizeSpotDetail(
  spot: SpotDetail,
  options: SpotSanitizerOptions = {},
): SpotDetail {
  const photos = Array.isArray(spot.photos) ? spot.photos : [];
  const reviews = Array.isArray(spot.reviews) ? spot.reviews : [];

  return {
    ...sanitizeSpotSummary(spot, options),
    photos: photos.map((photo) => sanitizePhoto(photo)),
    reviews: reviews.map((review) =>
      sanitizeReview(review, { allowGeneratedAvatar: options.allowGeneratedReviewAvatars }),
    ),
  };
}

export function sanitizeMapPoint(point: MapPoint): MapPoint {
  return {
    ...point,
    title: sanitizeSingleLineText(point.title) || DEFAULT_SPOT_TITLE,
    city: optionalSingleLineText(point.city),
    vibe: optionalSingleLineText(point.vibe),
    photoUrl: resolveSpotPhotoUrl(point.category, sanitizeImageUrl(point.photoUrl)),
  };
}

export function sanitizeTripSpot(spot: TripSpot): TripSpot {
  const wireSpot = spot as TripSpotWireFields;
  const spotId = typeof spot.spotId === 'string'
    ? spot.spotId
    : typeof wireSpot.spotId === 'string'
      ? wireSpot.spotId
      : typeof wireSpot.spot === 'string'
        ? wireSpot.spot
        : typeof wireSpot.spot_id === 'string'
          ? wireSpot.spot_id
          : '';
  const latitude = sanitizeOptionalNumber(spot.latitude) ?? sanitizeOptionalNumber(wireSpot.latitude) ?? 0;
  const longitude = sanitizeOptionalNumber(spot.longitude) ?? sanitizeOptionalNumber(wireSpot.longitude) ?? 0;

  return {
    ...spot,
    spotId,
    title: sanitizeSingleLineText(spot.title) || sanitizeSingleLineText(String(wireSpot.spot_title ?? '')) || DEFAULT_SPOT_TITLE,
    timeSlot: optionalSingleLineText(spot.timeSlot),
    duration: sanitizeOptionalNumber(spot.duration),
    estimatedCost: sanitizeOptionalNumber(spot.estimatedCost),
    photoUrl: resolveSpotPhotoUrl(spot.category, sanitizeImageUrl(spot.photoUrl)),
    city: optionalSingleLineText(spot.city),
    latitude,
    longitude,
    dayNumber: sanitizeOptionalNumber(spot.dayNumber) ?? sanitizeOptionalNumber(wireSpot.day_number),
    notes: optionalMultilineText(spot.notes),
    reason: optionalMultilineText(spot.reason) ?? optionalMultilineText(String(wireSpot.ai_reason ?? '')),
    confidence: sanitizeOptionalConfidence(spot.confidence) ?? sanitizeOptionalConfidence(wireSpot.match_confidence),
    category: sanitizeSpotCategory(spot.category),
  };
}

export function sanitizeTripMember(
  member: TripMember,
  options: AvatarSanitizerOptions = {},
): TripMember {
  const wireMember = member as TripMemberWireFields;
  const memberId = typeof wireMember.user_id === 'string'
    ? wireMember.user_id
    : typeof wireMember.userId === 'string'
      ? wireMember.userId
      : member.id;
  const role = optionalSingleLineText(member.status) ?? optionalSingleLineText(String(wireMember.role ?? ''));
  const explicitDisplayName =
    optionalSingleLineText(member.displayName) ??
    optionalWireString(wireMember.display_name);
  const displayName = explicitDisplayName
    ? sanitizeDisplayName(explicitDisplayName)
    : memberId
      ? `Traveler ${memberId.slice(0, 8)}`
      : DEFAULT_DISPLAY_NAME;
  const avatarSeed = member.id || displayName || DEFAULT_DISPLAY_NAME;

  return {
    ...member,
    id: memberId,
    displayName,
    avatarUrl: resolveAvatarUrl(sanitizeAvatarUrl(member.avatarUrl, options), avatarSeed),
    status: role,
    inviteStatus: member.inviteStatus === 'pending' || member.inviteStatus === 'accepted'
      ? member.inviteStatus
      : typeof wireMember.role === 'string'
        ? 'accepted'
        : undefined,
    presence: member.presence === 'active' || member.presence === 'viewing' || member.presence === 'offline'
      ? member.presence
      : undefined,
  };
}

export function sanitizeItinerary(itinerary: Itinerary): Itinerary {
  return {
    ...itinerary,
    destination: sanitizeSingleLineText(itinerary.destination) || DEFAULT_DESTINATION,
    days: (Array.isArray(itinerary.days) ? itinerary.days : []).map((day) => ({
      ...day,
      spots: (Array.isArray(day.spots) ? day.spots : []).map((spot) => sanitizeTripSpot(spot)),
    })),
    weatherForecast: sanitizeSingleLineText(itinerary.weatherForecast) || DEFAULT_WEATHER_FORECAST,
  };
}

export function sanitizeTrip(
  trip: Trip,
  options: TripSanitizerOptions = {},
): Trip {
  const wireTrip = trip as TripWireFields;
  const tripSpots = Array.isArray(trip.spots) ? trip.spots : [];
  const tripMembers = Array.isArray(trip.members) ? trip.members : [];
  const sanitizedSpots = tripSpots.map((spot) => sanitizeTripSpot(spot));
  const coverImageUrl = typeof trip.coverImageUrl === 'string'
    ? trip.coverImageUrl
    : typeof wireTrip.cover_photo_url === 'string'
      ? wireTrip.cover_photo_url
      : undefined;

  return {
    ...trip,
    title: sanitizeSingleLineText(trip.title) || DEFAULT_TRIP_TITLE,
    destination: sanitizeSingleLineText(trip.destination) || DEFAULT_DESTINATION,
    description: optionalMultilineText(trip.description),
    isPublic: sanitizeBoolean(trip.isPublic, sanitizeBoolean(wireTrip.is_public, true)),
    startDate: typeof trip.startDate === 'string' ? trip.startDate : typeof wireTrip.start_date === 'string' ? wireTrip.start_date : '',
    endDate: typeof trip.endDate === 'string' ? trip.endDate : typeof wireTrip.end_date === 'string' ? wireTrip.end_date : '',
    createdAt: typeof trip.createdAt === 'string' ? trip.createdAt : typeof wireTrip.created_at === 'string' ? wireTrip.created_at : undefined,
    updatedAt: typeof trip.updatedAt === 'string' ? trip.updatedAt : typeof wireTrip.updated_at === 'string' ? wireTrip.updated_at : undefined,
    spots: sanitizedSpots,
    members: tripMembers.map((member) =>
      sanitizeTripMember(member, { allowGeneratedAvatar: options.allowGeneratedMemberAvatars }),
    ),
    itinerary: trip.itinerary ? sanitizeItinerary(trip.itinerary) : undefined,
    coverImageUrl: resolveTripCoverImageUrl({
      coverImageUrl: sanitizeImageUrl(coverImageUrl),
      spots: sanitizedSpots,
    }),
  };
}

export function sanitizeFeedItem(
  item: FeedItem,
  options: FeedSanitizerOptions = {},
): FeedItem {
  const wireItem = item as FeedWireFields;
  const nestedItem = wireItem.item && typeof wireItem.item === 'object'
    ? wireItem.item as Record<string, unknown>
    : {};
  const type = resolveFeedItemType(item, wireItem, nestedItem);
  const nestedTitle = optionalWireString(nestedItem.title);
  const fallbackTitle = nestedTitle
    ? `${type === 'trip' ? 'Planned' : type === 'review' ? 'Reviewed' : 'Pinned'} ${nestedTitle}`
    : DEFAULT_FEED_TITLE;
  const imageUrl =
    optionalWireString(item.imageUrl) ??
    optionalWireString(wireItem.image_url) ??
    optionalWireString(nestedItem.photo_url) ??
    optionalWireString(nestedItem.cover_photo_url);
  const targetId =
    optionalWireString(item.targetId) ??
    optionalWireString(wireItem.target_id) ??
    optionalWireString(nestedItem.id) ??
    optionalWireString(nestedItem.spot_id) ??
    '';
  const targetPath =
    sanitizeRelativeAppPath(item.targetPath) ??
    sanitizeRelativeAppPath(optionalWireString(wireItem.target_path));
  const targetLocation =
    optionalWireString(item.targetLocation) ??
    optionalWireString(wireItem.target_location);
  const actor = item.actor && typeof item.actor === 'object'
    ? item.actor
    : {
      id: optionalWireString(nestedItem.user_id) ?? optionalWireString(nestedItem.creator_id) ?? 'scope-community',
      username: 'scope-community',
      email: '',
      displayName: 'Scope community',
      interests: [],
    };

  return {
    ...item,
    type,
    actor: sanitizeUserProfile(actor as UserProfile, { allowGeneratedAvatar: options.allowGeneratedActorAvatar }),
    title: sanitizeSingleLineText(item.title) || fallbackTitle,
    excerpt: sanitizeMultilineText(item.excerpt) || sanitizeMultilineText(optionalWireString(nestedItem.description)),
    createdAt: optionalWireString(item.createdAt) ?? optionalWireString(wireItem.created_at) ?? optionalWireString(nestedItem.created_at) ?? new Date(0).toISOString(),
    imageUrl: resolveFeedImageUrl({
      type,
      imageUrl: sanitizeImageUrl(imageUrl),
    }),
    targetId,
    targetPath,
    targetLocation: sanitizeSingleLineText(targetLocation),
  };
}

export function sanitizeNotificationItem(item: NotificationItem): NotificationItem {
  const wireItem = item as NotificationItem & {
    action_url?: unknown;
    actor_user_id?: unknown;
    archived_at?: unknown;
    created_at?: unknown;
    expires_at?: unknown;
    group_key?: unknown;
    is_read?: unknown;
    metadata_json?: unknown;
    priority?: unknown;
    read_at?: unknown;
    reference_id?: unknown;
    reference_type?: unknown;
    source_event_id?: unknown;
    template_key?: unknown;
    template_version?: unknown;
  };
  const createdAt = typeof item.createdAt === 'string'
    ? item.createdAt
    : typeof wireItem.created_at === 'string'
      ? wireItem.created_at
      : '';

  return {
    ...item,
    title: sanitizeSingleLineText(item.title) || DEFAULT_NOTIFICATION_TITLE,
    body: sanitizeMultilineText(item.body) || DEFAULT_NOTIFICATION_BODY,
    type: sanitizeSingleLineText(item.type) || 'general',
    isRead: sanitizeBoolean(item.isRead, sanitizeBoolean(wireItem.is_read, false)),
    createdAt,
    templateKey: optionalSingleLineText(item.templateKey ?? (typeof wireItem.template_key === 'string' ? wireItem.template_key : undefined)),
    templateVersion: sanitizeOptionalNumber(item.templateVersion ?? wireItem.template_version),
    category: optionalSingleLineText(item.category) ?? 'general',
    priority: optionalSingleLineText(item.priority ?? (typeof wireItem.priority === 'string' ? wireItem.priority : undefined)) ?? 'normal',
    actionUrl: sanitizeRelativeAppPath(item.actionUrl ?? (typeof wireItem.action_url === 'string' ? wireItem.action_url : undefined)),
    actorUserId: optionalSingleLineText(item.actorUserId ?? (typeof wireItem.actor_user_id === 'string' ? wireItem.actor_user_id : undefined)) ?? null,
    referenceType: optionalSingleLineText(item.referenceType ?? (typeof wireItem.reference_type === 'string' ? wireItem.reference_type : undefined)) ?? null,
    referenceId: optionalSingleLineText(item.referenceId ?? (typeof wireItem.reference_id === 'string' ? wireItem.reference_id : undefined)) ?? null,
    sourceEventId: optionalSingleLineText(item.sourceEventId ?? (typeof wireItem.source_event_id === 'string' ? wireItem.source_event_id : undefined)) ?? null,
    groupKey: optionalSingleLineText(item.groupKey ?? (typeof wireItem.group_key === 'string' ? wireItem.group_key : undefined)) ?? null,
    metadataJson: typeof item.metadataJson === 'string'
      ? item.metadataJson
      : typeof wireItem.metadata_json === 'string'
        ? wireItem.metadata_json
        : null,
    readAt: typeof item.readAt === 'string'
      ? item.readAt
      : typeof wireItem.read_at === 'string'
        ? wireItem.read_at
        : null,
    expiresAt: typeof item.expiresAt === 'string'
      ? item.expiresAt
      : typeof wireItem.expires_at === 'string'
        ? wireItem.expires_at
        : null,
    archivedAt: typeof item.archivedAt === 'string'
      ? item.archivedAt
      : typeof wireItem.archived_at === 'string'
        ? wireItem.archived_at
        : null,
  };
}

function sanitizeRelativeAppPath(value: string | null | undefined): string | undefined {
  const sanitized = sanitizeCompactText(value);
  if (!sanitized || !sanitized.startsWith('/') || sanitized.startsWith('//')) {
    return undefined;
  }

  return sanitized;
}

export function sanitizeNotificationPreference(preference: NotificationPreference): NotificationPreference {
  const wirePreference = preference as NotificationPreference & {
    digest_cadence?: unknown;
    email_enabled?: unknown;
    in_app_enabled?: unknown;
    push_enabled?: unknown;
    quiet_hours_end_minutes?: unknown;
    quiet_hours_start_minutes?: unknown;
    time_zone_id?: unknown;
    user_id?: unknown;
  };

  return {
    ...preference,
    id: optionalSingleLineText(preference.id),
    userId: optionalSingleLineText(preference.userId ?? (typeof wirePreference.user_id === 'string' ? wirePreference.user_id : undefined)),
    category: sanitizeSingleLineText(preference.category) || 'general',
    inAppEnabled: sanitizeBoolean(preference.inAppEnabled, sanitizeBoolean(wirePreference.in_app_enabled, true)),
    pushEnabled: sanitizeBoolean(preference.pushEnabled, sanitizeBoolean(wirePreference.push_enabled, true)),
    emailEnabled: sanitizeBoolean(preference.emailEnabled, sanitizeBoolean(wirePreference.email_enabled, false)),
    digestCadence: sanitizeSingleLineText(preference.digestCadence ?? (typeof wirePreference.digest_cadence === 'string' ? wirePreference.digest_cadence : undefined)) || 'daily',
    quietHoursStartMinutes: sanitizeOptionalNumber(preference.quietHoursStartMinutes ?? wirePreference.quiet_hours_start_minutes) ?? null,
    quietHoursEndMinutes: sanitizeOptionalNumber(preference.quietHoursEndMinutes ?? wirePreference.quiet_hours_end_minutes) ?? null,
    timeZoneId: sanitizeSingleLineText(preference.timeZoneId ?? (typeof wirePreference.time_zone_id === 'string' ? wirePreference.time_zone_id : undefined)) || 'UTC',
  };
}

export function sanitizeFriendConnection(
  connection: FriendConnection,
  options: FriendSanitizerOptions = {},
): FriendConnection {
  return {
    ...connection,
    user: sanitizeUserProfile(connection.user, { allowGeneratedAvatar: options.allowGeneratedUserAvatar }),
    presence: sanitizeFriendPresence(connection.presence),
    coverPhotoUrl: sanitizeImageUrl(connection.coverPhotoUrl),
    nextAdventure: optionalSingleLineText(connection.nextAdventure),
  };
}

export function sanitizeFriendRequest(
  request: FriendRequest,
  options: FriendSanitizerOptions = {},
): FriendRequest {
  return {
    ...request,
    user: sanitizeUserProfile(request.user, { allowGeneratedAvatar: options.allowGeneratedUserAvatar }),
    note: optionalMultilineText(request.note),
  };
}

function sanitizeFriendPresence(value: string | undefined): FriendConnection['presence'] {
  return value === 'planning' || value === 'online' || value === 'idle' || value === 'offline' || value === 'hidden'
    ? value
    : 'offline';
}

export function sanitizeSpotFormSubmission(submission: SpotFormSubmission): SpotFormSubmission {
  const sanitizedTitle = sanitizeSingleLineText(submission.spot.title) || DEFAULT_SPOT_TITLE;

  return {
    spot: {
      ...submission.spot,
      title: sanitizedTitle,
      description: sanitizeMultilineText(submission.spot.description),
      address: sanitizeSingleLineText(submission.spot.address),
      city: sanitizeSingleLineText(submission.spot.city),
      country: sanitizeSingleLineText(submission.spot.country).toUpperCase(),
      postalCode: optionalSingleLineText(submission.spot.postalCode),
      pillars: sanitizeSpotPillars(submission.spot.pillars),
      vibe: sanitizeSingleLineText(submission.spot.vibe),
      providerPlaceId: optionalSingleLineText(submission.spot.providerPlaceId),
      providerPlaceName: optionalSingleLineText(submission.spot.providerPlaceName),
      providerPlaceAddress: optionalSingleLineText(submission.spot.providerPlaceAddress),
      verificationStatus: sanitizeSpotVerificationStatus(submission.spot.verificationStatus),
      verificationSource: optionalSingleLineText(submission.spot.verificationSource),
      verificationDistanceMeters: sanitizeOptionalNumber(submission.spot.verificationDistanceMeters),
      verifiedAt: optionalSingleLineText(submission.spot.verifiedAt),
    },
    existingPhotos: submission.existingPhotos.map((photo) => ({
      ...sanitizePhoto(photo),
      caption: optionalSingleLineText(photo.caption) ?? sanitizedTitle,
    })),
    newPhotos: submission.newPhotos.map((photo) => ({
      ...photo,
      previewUrl: sanitizeImageUrl(photo.previewUrl) ?? photo.previewUrl,
      caption: sanitizeSingleLineText(photo.caption),
    })),
  };
}

export function sanitizeTripPlannerInput(input: TripPlannerInput): TripPlannerInput {
  return {
    ...input,
    destination: sanitizeSingleLineText(input.destination),
    endDestination: optionalSingleLineText(input.endDestination),
    destinationLatitude: sanitizeOptionalCoordinate(input.destinationLatitude, -90, 90),
    destinationLongitude: sanitizeOptionalCoordinate(input.destinationLongitude, -180, 180),
    endDestinationLatitude: sanitizeOptionalCoordinate(input.endDestinationLatitude, -90, 90),
    endDestinationLongitude: sanitizeOptionalCoordinate(input.endDestinationLongitude, -180, 180),
    budgetFloor: sanitizeNonNegativeNumber(input.budgetFloor),
    budget: sanitizeNonNegativeNumber(input.budget),
  };
}
