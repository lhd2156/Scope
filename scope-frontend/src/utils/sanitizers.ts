import type {
  AuthForm,
  AuthPayload,
  FeedItem,
  FriendConnection,
  FriendRequest,
  Itinerary,
  MapPoint,
  NotificationItem,
  Photo,
  RegisterForm,
  RegisterPayload,
  Review,
  SpotDetail,
  SpotFormSubmission,
  SpotSummary,
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
} from '@/utils/demoPhotos';

// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
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

interface TripSanitizerOptions {
  allowGeneratedMemberAvatars?: boolean;
}

interface FeedSanitizerOptions {
  allowGeneratedActorAvatar?: boolean;
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

function sanitizeOptionalCoordinate(value: number | null | undefined, minimum: number, maximum: number): number | undefined {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < minimum || numericValue > maximum) {
    return undefined;
  }

  return numericValue;
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
  };
}

export function sanitizePhoto(photo: Photo): Photo {
  return {
    ...photo,
    url: sanitizeImageUrl(photo.url) ?? '',
    caption: optionalSingleLineText(photo.caption),
  };
}

export function sanitizeReview(
  review: Review,
  options: AvatarSanitizerOptions = {},
): Review {
  return {
    ...review,
    user: sanitizeUserProfile(review.user, options),
    comment: sanitizeMultilineText(review.comment),
  };
}

export function sanitizeSpotSummary(
  spot: SpotSummary,
  options: SpotSanitizerOptions = {},
): SpotSummary {
  return {
    ...spot,
    title: sanitizeSingleLineText(spot.title) || DEFAULT_SPOT_TITLE,
    description: optionalMultilineText(spot.description),
    address: optionalSingleLineText(spot.address),
    city: optionalSingleLineText(spot.city),
    country: optionalSingleLineText(spot.country),
    vibe: optionalSingleLineText(spot.vibe),
    photoUrl: resolveSpotPhotoUrl(spot.category, sanitizeImageUrl(spot.photoUrl)),
    author: spot.author
      ? sanitizeUserProfile(spot.author, { allowGeneratedAvatar: options.allowGeneratedAuthorAvatar })
      : undefined,
  };
}

export function sanitizeSpotDetail(
  spot: SpotDetail,
  options: SpotSanitizerOptions = {},
): SpotDetail {
  return {
    ...sanitizeSpotSummary(spot, options),
    photos: spot.photos.map((photo) => sanitizePhoto(photo)),
    reviews: spot.reviews.map((review) =>
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
  return {
    ...spot,
    title: sanitizeSingleLineText(spot.title) || DEFAULT_SPOT_TITLE,
    timeSlot: optionalSingleLineText(spot.timeSlot),
    photoUrl: resolveSpotPhotoUrl(spot.category, sanitizeImageUrl(spot.photoUrl)),
    city: optionalSingleLineText(spot.city),
    notes: optionalMultilineText(spot.notes),
  };
}

export function sanitizeTripMember(
  member: TripMember,
  options: AvatarSanitizerOptions = {},
): TripMember {
  const displayName = sanitizeDisplayName(member.displayName);
  const avatarSeed = member.id || displayName || DEFAULT_DISPLAY_NAME;

  return {
    ...member,
    displayName,
    avatarUrl: resolveAvatarUrl(sanitizeAvatarUrl(member.avatarUrl, options), avatarSeed),
    status: optionalSingleLineText(member.status),
    inviteStatus: member.inviteStatus === 'pending' || member.inviteStatus === 'accepted'
      ? member.inviteStatus
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
    days: itinerary.days.map((day) => ({
      ...day,
      spots: day.spots.map((spot) => sanitizeTripSpot(spot)),
    })),
    weatherForecast: sanitizeSingleLineText(itinerary.weatherForecast) || DEFAULT_WEATHER_FORECAST,
  };
}

export function sanitizeTrip(
  trip: Trip,
  options: TripSanitizerOptions = {},
): Trip {
  const sanitizedSpots = trip.spots.map((spot) => sanitizeTripSpot(spot));

  return {
    ...trip,
    title: sanitizeSingleLineText(trip.title) || DEFAULT_TRIP_TITLE,
    destination: sanitizeSingleLineText(trip.destination) || DEFAULT_DESTINATION,
    description: optionalMultilineText(trip.description),
    spots: sanitizedSpots,
    members: trip.members.map((member) =>
      sanitizeTripMember(member, { allowGeneratedAvatar: options.allowGeneratedMemberAvatars }),
    ),
    itinerary: trip.itinerary ? sanitizeItinerary(trip.itinerary) : undefined,
    coverImageUrl: resolveTripCoverImageUrl({
      coverImageUrl: sanitizeImageUrl(trip.coverImageUrl),
      spots: sanitizedSpots,
    }),
  };
}

export function sanitizeFeedItem(
  item: FeedItem,
  options: FeedSanitizerOptions = {},
): FeedItem {
  return {
    ...item,
    actor: sanitizeUserProfile(item.actor, { allowGeneratedAvatar: options.allowGeneratedActorAvatar }),
    title: sanitizeSingleLineText(item.title) || DEFAULT_FEED_TITLE,
    excerpt: sanitizeMultilineText(item.excerpt),
    imageUrl: resolveFeedImageUrl({
      type: item.type,
      imageUrl: sanitizeImageUrl(item.imageUrl),
    }),
  };
}

export function sanitizeNotificationItem(item: NotificationItem): NotificationItem {
  return {
    ...item,
    title: sanitizeSingleLineText(item.title) || DEFAULT_NOTIFICATION_TITLE,
    body: sanitizeMultilineText(item.body) || DEFAULT_NOTIFICATION_BODY,
    type: sanitizeSingleLineText(item.type) || 'general',
  };
}

export function sanitizeFriendConnection(
  connection: FriendConnection,
  options: FriendSanitizerOptions = {},
): FriendConnection {
  return {
    ...connection,
    user: sanitizeUserProfile(connection.user, { allowGeneratedAvatar: options.allowGeneratedUserAvatar }),
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
      vibe: sanitizeSingleLineText(submission.spot.vibe),
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
