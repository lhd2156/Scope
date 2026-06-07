export type ThemeMode = 'dark' | 'light';
export type SpotCategory = 'food' | 'nature' | 'nightlife' | 'culture' | 'adventure' | 'shopping' | 'entertainment' | 'scenic' | 'other';
export type SpotPillar =
  | 'hidden-gem'
  | 'photo-worthy'
  | 'date-night'
  | 'group-friendly'
  | 'solo-friendly'
  | 'family-friendly'
  | 'budget-friendly'
  | 'worth-the-drive'
  | 'quick-stop'
  | 'calm'
  | 'lively'
  | 'luxury-feel';
export type SpotVerificationStatus = 'legacy' | 'unverified' | 'verified' | 'rejected';
export type SpotSafetyStatus = 'legacy' | 'clean' | 'blocked';
export type TripPace = 'relaxed' | 'moderate' | 'packed';
export type TripStatus = 'planning' | 'active' | 'completed' | 'cancelled';
export type TripMemberRole = 'owner' | 'editor' | 'viewer';
export type TripInviteStatus = 'pending' | 'accepted';

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
    traceId?: string;
  };
}

export interface ApiEnvelope<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface SpotComposerRejection {
  id: number;
  title: string;
  message: string;
  action: string;
  fields: string[];
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface UserStats {
  spots: number;
  trips: number;
  friends: number;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  homeBase?: string;
  interests: string[];
  stats?: UserStats;
  showActivityStatus?: boolean;
}

export type FriendPresence = 'planning' | 'online' | 'idle' | 'offline' | 'hidden';

export interface FriendConnection {
  id: string;
  user: UserProfile;
  presence: FriendPresence;
  sharedTrips: number;
  mutualFriends: number;
  favoriteCategories: SpotCategory[];
  coverPhotoUrl?: string;
  nextAdventure?: string;
  lastActiveAt: string;
}

export interface FriendRequest {
  id: string;
  user: UserProfile;
  direction: 'incoming' | 'outgoing';
  createdAt: string;
  mutualFriends: number;
  note?: string;
}

export interface FriendSuggestion {
  id: string;
  user: UserProfile;
  mutualFriends: number;
  sharedInterests: string[];
  favoriteCategories: SpotCategory[];
  presence: FriendPresence;
  reason: string;
  score?: number;
}

export type PresenceStatus = 'planning' | 'online' | 'idle' | 'offline';

export interface PresenceHeartbeatInput {
  status?: PresenceStatus;
  routeContext?: string;
  isIdle?: boolean;
  isPlanning?: boolean;
}

export interface AuthPayload {
  id: string;
  username: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  homeBase?: string;
  interests?: string[];
  showActivityStatus?: boolean;
  accessToken: string;
  refreshToken: string;
}

export interface AuthForm {
  /*
   * Login accepts an email, phone number, username, or display name. The
   * property name stays `email` for the existing auth store/API plumbing.
   */
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterForm extends AuthForm {
  username: string;
  /** Form-only field; combined with `lastName` into `displayName` on submit. */
  firstName: string;
  /** Form-only field; combined with `firstName` into `displayName` on submit. */
  lastName: string;
  displayName: string;
  /** Optional phone number used as another sign-in identifier. */
  phoneNumber?: string;
  /*
   * ISO 8601 calendar date (YYYY-MM-DD) captured from the birthday field on
   * RegisterPage. Required so Scope can gate age-limited
   * features (13+ COPPA minimum) and personalize trip defaults later.
   */
  dateOfBirth: string;
  /*
   * Client-only field used to confirm the chosen password. Never sent to
   * the backend verbatim - the auth service strips it before sending the
   * API payload.
   */
  confirmPassword: string;
  /** Must be true to submit; not sent to the API. */
  acceptedTerms: boolean;
}

/*
 * Payload shape the auth service actually sends to the API. It omits the
 * form-only `confirmPassword` so we never round-trip a duplicate secret.
 */
export interface RegisterPayload {
  username: string;
  displayName: string;
  email: string;
  phoneNumber?: string;
  password: string;
  dateOfBirth: string;
}

export interface Photo {
  id: string;
  url: string;
  caption?: string;
}

export interface SpotPhotoUpload {
  id: string;
  file: File;
  previewUrl: string;
  caption: string;
  mimeType: string;
  sizeBytes: number;
}

export interface PhotoGalleryItem {
  id: string;
  url: string;
  caption: string;
  source: 'existing' | 'upload';
  meta?: string;
}

export interface PhotoGalleryAction {
  id: string;
  source: 'existing' | 'upload';
}

export interface PhotoGalleryCaptionUpdate extends PhotoGalleryAction {
  caption: string;
}

export interface Review {
  id: string;
  spotId: string;
  user: UserProfile;
  rating: number;
  comment: string;
  createdAt: string;
  sentiment_score?: number | null;
}

export interface SpotSummary {
  id: string;
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  country?: string;
  adminArea?: string;
  province?: string;
  region?: string;
  state?: string;
  stateCode?: string;
  postalCode?: string;
  category: SpotCategory;
  pillars?: SpotPillar[];
  vibe?: string;
  rating: number;
  photoUrl?: string;
  createdAt: string;
  isPublic?: boolean;
  userId?: string;
  author?: UserProfile;
  liked?: boolean;
  likesCount?: number;
  verificationStatus?: SpotVerificationStatus;
  verificationSource?: string;
  providerPlaceId?: string;
  providerPlaceName?: string;
  providerPlaceAddress?: string;
  verificationDistanceMeters?: number | null;
  verifiedAt?: string | null;
  safetyStatus?: SpotSafetyStatus;
  safetyReason?: string;
}

export interface SpotDetail extends SpotSummary {
  photos: Photo[];
  reviews: Review[];
}

export interface MapPoint {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  category: SpotCategory;
  city?: string;
  vibe?: string;
  rating?: number;
  photoUrl?: string;
  routeRole?: 'start' | 'stop' | 'end';
  routeLabel?: string;
}

export type MapNearbyPlaceKind = 'fuel' | 'place';

export interface MapNearbyPlacePin {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  kind: MapNearbyPlaceKind;
  category?: SpotCategory | 'fuel' | string;
  iconName?: string;
  categoryLabel?: string;
  address?: string;
  subtitle?: string;
  photoUrl?: string;
  photoAttribution?: string;
  photoAttributionUrl?: string;
  photoLookupStatus?: 'pending' | 'complete';
  sourceLabel?: string;
  distanceLabel?: string;
  priceLabel?: string;
}

export interface SpotFilters {
  category?: SpotCategory | '';
  city?: string;
  vibe?: string;
  page?: number;
  pageSize?: number;
}

export interface SpotFormInput {
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  country: string;
  postalCode?: string;
  category: SpotCategory;
  pillars: SpotPillar[];
  vibe: string;
  rating: number;
  visitedAt: string;
  isPublic: boolean;
  providerPlaceId?: string;
  providerPlaceName?: string;
  providerPlaceAddress?: string;
  verificationStatus?: SpotVerificationStatus;
  verificationSource?: string;
  verificationDistanceMeters?: number | null;
  verifiedAt?: string | null;
}

export interface SpotFormSubmission {
  spot: SpotFormInput;
  existingPhotos: Photo[];
  newPhotos: SpotPhotoUpload[];
}

export interface TripSpot {
  spotId: string;
  title: string;
  timeSlot?: string;
  duration?: number;
  latitude: number;
  longitude: number;
  category: SpotCategory;
  estimatedCost?: number;
  photoUrl?: string;
  city?: string;
  dayNumber?: number;
  notes?: string;
  reason?: string;
  confidence?: number;
}

export interface TripMember {
  id: string;
  displayName: string;
  avatarUrl?: string;
  status?: TripMemberRole | string;
  inviteStatus?: TripInviteStatus;
  presence?: 'active' | 'viewing' | 'offline';
}

export interface TripInviteInput {
  recipient: string;
  role: Exclude<TripMemberRole, 'owner'>;
  message?: string;
}

export interface ItineraryDay {
  dayNumber: number;
  date: string;
  spots: TripSpot[];
}

export interface Itinerary {
  id: string;
  destination: string;
  days: ItineraryDay[];
  totalEstimatedCost: number;
  weatherForecast: string;
}

export interface Trip {
  id: string;
  title: string;
  destination: string;
  description?: string;
  isPublic: boolean;
  startDate: string;
  endDate: string;
  spots: TripSpot[];
  members: TripMember[];
  itinerary?: Itinerary;
  coverImageUrl?: string;
  budget?: number;
  currency?: string;
  status?: TripStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface TripPlannerInput {
  destination: string;
  endDestination?: string;
  destinationLatitude?: number;
  destinationLongitude?: number;
  endDestinationLatitude?: number;
  endDestinationLongitude?: number;
  startDate: string;
  endDate: string;
  budgetFloor?: number;
  budget: number;
  interests: SpotCategory[];
  pace: TripPace;
  groupSize: number;
}

export type TripFuelType = 'regular' | 'midgrade' | 'premium' | 'diesel' | 'ev';

export interface TripFuelSettings {
  mpg?: number;
  gasPricePerGallon?: number;
  fuelType?: TripFuelType;
}

export interface FuelStationPrice {
  id: string;
  name: string;
  brand?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
  fuelType: 'all' | 'regular' | 'midgrade' | 'premium' | 'diesel' | string;
  pricePerUnit?: number | null;
  currency: string;
  isOpen?: boolean;
  updatedAt?: string;
  source?: string;
  prices?: Array<{
    fuelType: string;
    price: number;
    currency: string;
    updatedAt?: string;
  }>;
}

export interface FuelStationLookup {
  configured: boolean;
  coverage: string;
  stations: FuelStationPrice[];
  source: string;
  license?: string;
  radiusKm?: number;
  sortBy?: string;
}

export interface FeedItem {
  id: string;
  type: 'spot' | 'trip' | 'review';
  actor: UserProfile;
  title: string;
  excerpt: string;
  createdAt: string;
  imageUrl?: string;
  targetId: string;
  targetPath?: string;
  targetLocation?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  type: string;
  templateKey?: string;
  templateVersion?: number;
  category?: string;
  priority?: 'low' | 'normal' | 'urgent' | string;
  actionUrl?: string;
  actorUserId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  sourceEventId?: string | null;
  groupKey?: string | null;
  metadataJson?: string | null;
  readAt?: string | null;
  expiresAt?: string | null;
  archivedAt?: string | null;
}

export type NotificationConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export interface NotificationPreference {
  id?: string;
  userId?: string;
  category: string;
  inAppEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  digestCadence: 'instant' | 'daily' | 'weekly' | 'off' | string;
  quietHoursStartMinutes?: number | null;
  quietHoursEndMinutes?: number | null;
  timeZoneId: string;
}

export interface NotificationPreferenceInput {
  category: string;
  inAppEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  digestCadence: string;
  quietHoursStartMinutes?: number | null;
  quietHoursEndMinutes?: number | null;
  timeZoneId: string;
}

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastPayload {
  title: string;
  message: string;
  tone?: ToastTone;
  autoHideMs?: number;
}

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  tone: ToastTone;
  autoHideMs: number;
}

export interface MapViewport {
  center: [number, number];
  zoom: number;
  style: string;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface LocationPing {
  tripId: string;
  lat: number;
  lng: number;
  userId: string;
  displayName: string;
}
