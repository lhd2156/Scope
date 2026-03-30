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

const CONTROL_CHARACTERS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const INLINE_WHITESPACE_REGEX = /[^\S\n]+/g;
const MULTIPLE_NEWLINES_REGEX = /\n{3,}/g;
const RELATIVE_URL_REGEX = /^(?:\.{1,2}\/|\/)[^\s]*$/;
const DATA_IMAGE_URL_REGEX = /^data:image\/(?:png|jpe?g|webp|gif|avif);base64,[a-z0-9+/=\s]+$/i;
const SAFE_IMAGE_PROTOCOLS = new Set(['http:', 'https:', 'blob:']);

const DEFAULT_DISPLAY_NAME = 'Atlas traveler';
const DEFAULT_SPOT_TITLE = 'Untitled spot';
const DEFAULT_TRIP_TITLE = 'Untitled trip';
const DEFAULT_DESTINATION = 'Atlas destination';
const DEFAULT_FEED_TITLE = 'Atlas activity';
const DEFAULT_NOTIFICATION_TITLE = 'Atlas update';
const DEFAULT_NOTIFICATION_BODY = 'A new Atlas update is available.';
const DEFAULT_WEATHER_FORECAST = 'Forecast pending.';

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

function sanitizeEmail(value: string | null | undefined): string | undefined {
  const sanitized = sanitizeCompactText(value).toLowerCase();
  return sanitized || undefined;
}

export function sanitizeAuthForm(payload: AuthForm): AuthForm {
  return {
    email: sanitizeEmail(payload.email) ?? '',
    password: String(payload.password ?? ''),
  };
}

export function sanitizeRegisterForm(payload: RegisterForm): RegisterForm {
  const username = sanitizeSingleLineText(payload.username);

  return {
    ...sanitizeAuthForm(payload),
    username,
    displayName: sanitizeSingleLineText(payload.displayName) || username || DEFAULT_DISPLAY_NAME,
  };
}

export function sanitizeAuthPayload(payload: AuthPayload): AuthPayload {
  const username = sanitizeSingleLineText(payload.username);

  return {
    ...payload,
    username: username || 'atlas-user',
    email: sanitizeEmail(payload.email),
    displayName: sanitizeSingleLineText(payload.displayName) || username || DEFAULT_DISPLAY_NAME,
    accessToken: String(payload.accessToken ?? '').trim(),
    refreshToken: String(payload.refreshToken ?? '').trim(),
  };
}

export function sanitizeUserProfile(user: UserProfile): UserProfile {
  const username = sanitizeSingleLineText(user.username);
  const displayName = sanitizeSingleLineText(user.displayName) || username || DEFAULT_DISPLAY_NAME;
  const avatarSeed = user.id || username || displayName || DEFAULT_DISPLAY_NAME;

  return {
    ...user,
    username: username || 'atlas-user',
    email: sanitizeEmail(user.email) ?? '',
    displayName,
    avatarUrl: resolveAvatarUrl(sanitizeImageUrl(user.avatarUrl), avatarSeed),
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

export function sanitizeReview(review: Review): Review {
  return {
    ...review,
    user: sanitizeUserProfile(review.user),
    comment: sanitizeMultilineText(review.comment),
  };
}

export function sanitizeSpotSummary(spot: SpotSummary): SpotSummary {
  return {
    ...spot,
    title: sanitizeSingleLineText(spot.title) || DEFAULT_SPOT_TITLE,
    description: optionalMultilineText(spot.description),
    address: optionalSingleLineText(spot.address),
    city: optionalSingleLineText(spot.city),
    country: optionalSingleLineText(spot.country),
    vibe: optionalSingleLineText(spot.vibe),
    photoUrl: resolveSpotPhotoUrl(spot.category, sanitizeImageUrl(spot.photoUrl)),
    author: spot.author ? sanitizeUserProfile(spot.author) : undefined,
  };
}

export function sanitizeSpotDetail(spot: SpotDetail): SpotDetail {
  return {
    ...sanitizeSpotSummary(spot),
    photos: spot.photos.map((photo) => sanitizePhoto(photo)),
    reviews: spot.reviews.map((review) => sanitizeReview(review)),
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

export function sanitizeTripMember(member: TripMember): TripMember {
  const displayName = sanitizeSingleLineText(member.displayName) || DEFAULT_DISPLAY_NAME;
  const avatarSeed = member.id || displayName || DEFAULT_DISPLAY_NAME;

  return {
    ...member,
    displayName,
    avatarUrl: resolveAvatarUrl(sanitizeImageUrl(member.avatarUrl), avatarSeed),
    status: optionalSingleLineText(member.status),
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

export function sanitizeTrip(trip: Trip): Trip {
  const sanitizedSpots = trip.spots.map((spot) => sanitizeTripSpot(spot));

  return {
    ...trip,
    title: sanitizeSingleLineText(trip.title) || DEFAULT_TRIP_TITLE,
    destination: sanitizeSingleLineText(trip.destination) || DEFAULT_DESTINATION,
    description: optionalMultilineText(trip.description),
    spots: sanitizedSpots,
    members: trip.members.map((member) => sanitizeTripMember(member)),
    itinerary: trip.itinerary ? sanitizeItinerary(trip.itinerary) : undefined,
    coverImageUrl: resolveTripCoverImageUrl({
      coverImageUrl: sanitizeImageUrl(trip.coverImageUrl),
      spots: sanitizedSpots,
    }),
  };
}

export function sanitizeFeedItem(item: FeedItem): FeedItem {
  return {
    ...item,
    actor: sanitizeUserProfile(item.actor),
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

export function sanitizeFriendConnection(connection: FriendConnection): FriendConnection {
  return {
    ...connection,
    user: sanitizeUserProfile(connection.user),
    nextAdventure: optionalSingleLineText(connection.nextAdventure),
  };
}

export function sanitizeFriendRequest(request: FriendRequest): FriendRequest {
  return {
    ...request,
    user: sanitizeUserProfile(request.user),
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
  };
}
