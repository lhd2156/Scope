import type { FriendConnection, FriendRequest, SpotCategory, UserProfile } from '@/types';
import { sanitizeFriendConnection, sanitizeFriendRequest, sanitizeUserProfile } from '@/utils/sanitizers';
import { buildPravatarUrl } from '@/utils/demoPhotos';

interface SuggestedConnection {
  user: UserProfile;
  reason: string;
  mutualFriends: number;
  favoriteCategories: SpotCategory[];
}

function buildUserProfile(input: Partial<UserProfile> & Pick<UserProfile, 'id' | 'username' | 'displayName'>): UserProfile {
  return sanitizeUserProfile({
    email: `${input.username}@example.com`,
    bio: 'Atlas traveler curating premium photo-led adventures across the map.',
    homeBase: 'Austin, TX',
    interests: ['food', 'culture', 'scenic'],
    stats: { spots: 18, trips: 4, friends: 32 },
    ...input,
  });
}

const mayaChen = buildUserProfile({
  id: 'user-2',
  username: 'maya-chen',
  displayName: 'Maya Chen',
  avatarUrl: buildPravatarUrl('user-2'),
  homeBase: 'Dallas, TX',
  interests: ['culture', 'shopping', 'scenic'],
  stats: { spots: 28, trips: 6, friends: 73 },
});

const theoAlvarez = buildUserProfile({
  id: 'user-3',
  username: 'theo-alvarez',
  displayName: 'Theo Alvarez',
  avatarUrl: buildPravatarUrl('user-3'),
  homeBase: 'Austin, TX',
  interests: ['adventure', 'food', 'nature'],
  stats: { spots: 35, trips: 7, friends: 64 },
});

const sofiaRamirez = buildUserProfile({
  id: 'user-4',
  username: 'sofia-ramirez',
  displayName: 'Sofia Ramirez',
  avatarUrl: buildPravatarUrl('user-4'),
  homeBase: 'Fort Worth, TX',
  interests: ['culture', 'food'],
  stats: { spots: 17, trips: 3, friends: 26 },
});

const jordanReed = buildUserProfile({
  id: 'user-5',
  username: 'jordan-reed',
  displayName: 'Jordan Reed',
  avatarUrl: buildPravatarUrl('user-5'),
  homeBase: 'San Antonio, TX',
  interests: ['scenic', 'nature'],
  stats: { spots: 20, trips: 5, friends: 29 },
});

const priyaNair = buildUserProfile({
  id: 'user-6',
  username: 'priya-nair',
  displayName: 'Priya Nair',
  avatarUrl: buildPravatarUrl('user-6'),
  homeBase: 'Houston, TX',
  interests: ['food', 'nightlife', 'culture'],
  stats: { spots: 31, trips: 8, friends: 58 },
});

const noahKim = buildUserProfile({
  id: 'user-7',
  username: 'noah-kim',
  displayName: 'Noah Kim',
  avatarUrl: buildPravatarUrl('user-7'),
  homeBase: 'Denver, CO',
  interests: ['adventure', 'nature', 'scenic'],
  stats: { spots: 26, trips: 6, friends: 44 },
});

const rileyBrooks = buildUserProfile({
  id: 'user-8',
  username: 'riley-brooks',
  displayName: 'Riley Brooks',
  avatarUrl: buildPravatarUrl('user-8'),
  homeBase: 'Nashville, TN',
  interests: ['nightlife', 'food', 'culture'],
  stats: { spots: 24, trips: 5, friends: 39 },
});

const lenaOrtiz = buildUserProfile({
  id: 'user-9',
  username: 'lena-ortiz',
  displayName: 'Lena Ortiz',
  avatarUrl: buildPravatarUrl('user-9'),
  homeBase: 'Phoenix, AZ',
  interests: ['scenic', 'shopping'],
  stats: { spots: 14, trips: 4, friends: 21 },
});

const amaraGrant = buildUserProfile({
  id: 'user-10',
  username: 'amara-grant',
  displayName: 'Amara Grant',
  avatarUrl: buildPravatarUrl('user-10'),
  homeBase: 'Boulder, CO',
  interests: ['adventure', 'nature', 'scenic'],
  stats: { spots: 27, trips: 6, friends: 44 },
});

export const mockFriendConnections: FriendConnection[] = [
  {
    id: 'friend-1',
    user: mayaChen,
    presence: 'online',
    sharedTrips: 2,
    mutualFriends: 14,
    favoriteCategories: ['culture', 'shopping', 'scenic'],
    nextAdventure: 'Dallas design district sprint',
    lastActiveAt: '2026-03-29T03:28:00Z',
  },
  {
    id: 'friend-2',
    user: theoAlvarez,
    presence: 'planning',
    sharedTrips: 4,
    mutualFriends: 9,
    favoriteCategories: ['adventure', 'food', 'nature'],
    nextAdventure: 'Austin sunrise route',
    lastActiveAt: '2026-03-29T02:54:00Z',
  },
  {
    id: 'friend-3',
    user: priyaNair,
    presence: 'online',
    sharedTrips: 1,
    mutualFriends: 12,
    favoriteCategories: ['food', 'nightlife', 'culture'],
    nextAdventure: 'Houston tasting crawl',
    lastActiveAt: '2026-03-28T20:15:00Z',
  },
  {
    id: 'friend-4',
    user: noahKim,
    presence: 'offline',
    sharedTrips: 2,
    mutualFriends: 7,
    favoriteCategories: ['adventure', 'nature', 'scenic'],
    nextAdventure: 'Rocky Mountain overlook loop',
    lastActiveAt: '2026-03-28T16:40:00Z',
  },
  {
    id: 'friend-5',
    user: rileyBrooks,
    presence: 'offline',
    sharedTrips: 3,
    mutualFriends: 10,
    favoriteCategories: ['nightlife', 'food', 'culture'],
    nextAdventure: 'Nashville live music sprint',
    lastActiveAt: '2026-03-27T22:11:00Z',
  },
  {
    id: 'friend-6',
    user: lenaOrtiz,
    presence: 'offline',
    sharedTrips: 1,
    mutualFriends: 5,
    favoriteCategories: ['scenic', 'shopping'],
    nextAdventure: 'Desert sunset shopping loop',
    lastActiveAt: '2026-03-27T14:05:00Z',
  },
].map((connection) => sanitizeFriendConnection(connection));

export const mockFriendRequests: FriendRequest[] = [
  {
    id: 'request-1',
    user: sofiaRamirez,
    direction: 'incoming',
    createdAt: '2026-03-29T01:40:00Z',
    mutualFriends: 9,
    note: 'Heading to Fort Worth next weekend and want to trade scenic + coffee pins.',
  },
  {
    id: 'request-2',
    user: jordanReed,
    direction: 'incoming',
    createdAt: '2026-03-28T22:10:00Z',
    mutualFriends: 3,
    note: 'Sent after matching on scenic road-trip collections and shared itinerary pacing.',
  },
  {
    id: 'request-3',
    user: buildUserProfile({
      id: 'user-11',
      username: 'ella-price',
      displayName: 'Ella Price',
      avatarUrl: buildPravatarUrl('user-11'),
      homeBase: 'Portland, OR',
      interests: ['culture', 'nature', 'food'],
      stats: { spots: 16, trips: 3, friends: 18 },
    }),
    direction: 'incoming',
    createdAt: '2026-03-28T19:05:00Z',
    mutualFriends: 4,
    note: 'Waiting on a response after swapping favorite weekend market routes.',
  },
].map((request) => sanitizeFriendRequest(request));

export const mockPeopleYouMayKnow: SuggestedConnection[] = [
  {
    user: priyaNair,
    reason: 'High overlap on culture-first city weekends and polished dining picks.',
    mutualFriends: 8,
    favoriteCategories: ['culture', 'food', 'shopping'],
  },
  {
    user: noahKim,
    reason: 'Shared love for scenic drives, sunrise stops, and route pacing.',
    mutualFriends: 5,
    favoriteCategories: ['scenic', 'food', 'nature'],
  },
  {
    user: amaraGrant,
    reason: 'Atlas keeps matching your saved scenic pins with her adventure routes.',
    mutualFriends: 4,
    favoriteCategories: ['adventure', 'nature', 'scenic'],
  },
];
