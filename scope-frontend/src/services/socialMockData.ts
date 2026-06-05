import { localFallbackEnabled } from '@/services/demoMode';
import rawUsers from '@/mock/users.json';
import type { FriendConnection, FriendRequest, UserProfile } from '@/types';
import { sanitizeFriendConnection, sanitizeFriendRequest, sanitizeUserProfile } from '@/utils/sanitizers';
import { buildPravatarUrl } from '@/utils/imageFallbacks';

// Real Scope members start with an empty travel circle and add friends
// themselves through search. The `demo*` arrays below stay around purely
// to seed the local preview experience.
const SOCIAL_MOCK_FALLBACK_ENABLED =
  localFallbackEnabled('VITE', 'ENABLE', 'SOCIAL', 'MOCK', 'FALLBACK');
const canonicalDemoUsers = new Map((rawUsers as UserProfile[]).map((user) => [user.id, user]));

function buildUserProfile(input: Partial<UserProfile> & Pick<UserProfile, 'id' | 'username' | 'displayName'>): UserProfile {
  return sanitizeUserProfile(
    {
      email: `${input.username}@example.com`,
      bio: 'Scope traveler curating premium photo-led adventures across the map.',
      homeBase: 'Austin, TX',
      interests: ['food', 'culture', 'scenic'],
      stats: { spots: 18, trips: 4, friends: 32 },
      ...input,
    },
    { allowGeneratedAvatar: true },
  );
}

function buildCanonicalDemoUser(userId: string): UserProfile {
  const user = canonicalDemoUsers.get(userId);
  if (!user) {
    throw new Error(`Demo user ${userId} is missing from the mock catalog`);
  }

  return buildUserProfile(user);
}

const mayaChen = buildCanonicalDemoUser('demo-user-2');

const theoAlvarez = buildUserProfile({
  id: 'friend-theo-alvarez',
  username: 'theo.alvarez',
  displayName: 'Theo Alvarez',
  avatarUrl: buildPravatarUrl('user-3'),
  homeBase: 'Austin, TX',
  interests: ['adventure', 'food', 'nature'],
  stats: { spots: 35, trips: 7, friends: 64 },
});

const sofiaRamirez = buildCanonicalDemoUser('demo-user-4');

const jordanReed = buildCanonicalDemoUser('demo-user-5');

const priyaNair = buildUserProfile({
  id: 'friend-priya-nair',
  username: 'priya.nair',
  displayName: 'Priya Nair',
  avatarUrl: buildPravatarUrl('user-6'),
  homeBase: 'Houston, TX',
  interests: ['food', 'nightlife', 'culture'],
  stats: { spots: 31, trips: 8, friends: 58 },
});

const noahKim = buildUserProfile({
  id: 'friend-noah-kim',
  username: 'noah.kim',
  displayName: 'Noah Kim',
  avatarUrl: buildPravatarUrl('user-7'),
  homeBase: 'Denver, CO',
  interests: ['adventure', 'nature', 'scenic'],
  stats: { spots: 26, trips: 6, friends: 44 },
});

const rileyBrooks = buildUserProfile({
  id: 'friend-riley-brooks',
  username: 'riley.brooks',
  displayName: 'Riley Brooks',
  avatarUrl: buildPravatarUrl('user-8'),
  homeBase: 'Nashville, TN',
  interests: ['nightlife', 'food', 'culture'],
  stats: { spots: 24, trips: 5, friends: 39 },
  showActivityStatus: false,
});

const lenaOrtiz = buildUserProfile({
  id: 'friend-lena-ortiz',
  username: 'lena.ortiz',
  displayName: 'Lena Ortiz',
  avatarUrl: buildPravatarUrl('user-9'),
  homeBase: 'Phoenix, AZ',
  interests: ['scenic', 'shopping'],
  stats: { spots: 14, trips: 4, friends: 21 },
});

export const demoFriendConnections: FriendConnection[] = [
  {
    id: 'friend-1',
    user: mayaChen,
    presence: 'online',
    sharedTrips: 2,
    mutualFriends: 14,
    favoriteCategories: ['culture', 'shopping', 'scenic'],
    nextAdventure: 'Dallas design district sprint',
    lastActiveAt: '2026-05-20T05:24:00Z',
  },
  {
    id: 'friend-2',
    user: theoAlvarez,
    presence: 'planning',
    sharedTrips: 4,
    mutualFriends: 9,
    favoriteCategories: ['adventure', 'food', 'nature'],
    nextAdventure: 'Austin sunrise route',
    lastActiveAt: '2026-05-20T05:25:00Z',
  },
  {
    id: 'friend-3',
    user: priyaNair,
    presence: 'online',
    sharedTrips: 1,
    mutualFriends: 12,
    favoriteCategories: ['food', 'nightlife', 'culture'],
    nextAdventure: 'Houston tasting crawl',
    lastActiveAt: '2026-05-20T05:23:00Z',
  },
  {
    id: 'friend-4',
    user: noahKim,
    presence: 'online',
    sharedTrips: 2,
    mutualFriends: 7,
    favoriteCategories: ['adventure', 'nature', 'scenic'],
    nextAdventure: 'Rocky Mountain overlook loop',
    lastActiveAt: '2026-05-20T05:20:00Z',
  },
  {
    id: 'friend-5',
    user: rileyBrooks,
    presence: 'hidden',
    sharedTrips: 3,
    mutualFriends: 10,
    favoriteCategories: ['nightlife', 'food', 'culture'],
    nextAdventure: 'Nashville live music sprint',
    lastActiveAt: '2026-05-20T05:21:00Z',
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
].map((connection) => sanitizeFriendConnection(connection, { allowGeneratedUserAvatar: true }));

export const demoFriendRequests: FriendRequest[] = [
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
      username: 'ella.price',
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
].map((request) => sanitizeFriendRequest(request, { allowGeneratedUserAvatar: true }));

// Default exports used by the live Friends experience. Real Scope members
// should always start empty and grow their circle through search + requests.
// Local preview opts back into the seeded dataset above.
export const mockFriendConnections: FriendConnection[] = SOCIAL_MOCK_FALLBACK_ENABLED
  ? demoFriendConnections
  : [];

export const mockFriendRequests: FriendRequest[] = SOCIAL_MOCK_FALLBACK_ENABLED
  ? demoFriendRequests
  : [];
