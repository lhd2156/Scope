export type ThemeMode = 'dark' | 'light';
export type SpotCategory = 'food' | 'nature' | 'nightlife' | 'culture' | 'adventure' | 'shopping' | 'scenic' | 'other';
export type TripPace = 'relaxed' | 'moderate' | 'packed';
export type TripStatus = 'planning' | 'active' | 'completed' | 'cancelled';

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
}

export type FriendPresence = 'online' | 'planning' | 'offline';

export interface FriendConnection {
  id: string;
  user: UserProfile;
  presence: FriendPresence;
  sharedTrips: number;
  mutualFriends: number;
  favoriteCategories: SpotCategory[];
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

export interface AuthPayload {
  id: string;
  username: string;
  email?: string;
  displayName?: string;
  accessToken: string;
  refreshToken: string;
}

export interface AuthForm {
  email: string;
  password: string;
}

export interface RegisterForm extends AuthForm {
  username: string;
  displayName: string;
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
  category: SpotCategory;
  vibe?: string;
  rating: number;
  photoUrl?: string;
  createdAt: string;
  author?: UserProfile;
  liked?: boolean;
  likesCount?: number;
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
  category: SpotCategory;
  vibe: string;
  rating: number;
  visitedAt: string;
  isPublic: boolean;
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
}

export interface TripMember {
  id: string;
  displayName: string;
  avatarUrl?: string;
  status?: string;
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
}

export interface TripPlannerInput {
  destination: string;
  startDate: string;
  endDate: string;
  budget: number;
  interests: SpotCategory[];
  pace: TripPace;
  groupSize: number;
}

export interface FeedItem {
  id: string;
  type: 'spot' | 'trip';
  actor: UserProfile;
  title: string;
  excerpt: string;
  createdAt: string;
  imageUrl?: string;
  targetId: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  type: string;
}

export type NotificationConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

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
