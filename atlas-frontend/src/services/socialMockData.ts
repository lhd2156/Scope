import { mockUsers } from '@/services/mockData';
import type { FriendConnection, FriendRequest, UserProfile } from '@/types';
import { sanitizeFriendConnection, sanitizeFriendRequest, sanitizeUserProfile } from '@/utils/sanitizers';
import { buildPravatarUrl } from '@/utils/demoPhotos';

const incomingRequestUser: UserProfile = sanitizeUserProfile({
  id: 'user-4',
  username: 'sofia-park',
  email: 'sofia@example.com',
  displayName: 'Sofia Park',
  avatarUrl: buildPravatarUrl('user-4'),
  bio: 'Coffee trails, museum courtyards, and itinerary notes that never miss.',
  homeBase: 'Houston, TX',
  interests: ['culture', 'food', 'shopping'],
  stats: { spots: 31, trips: 9, friends: 58 },
});

const outgoingRequestUser: UserProfile = sanitizeUserProfile({
  id: 'user-5',
  username: 'gabriel-m',
  email: 'gabriel@example.com',
  displayName: 'Gabriel Martinez',
  avatarUrl: buildPravatarUrl('user-5'),
  bio: 'Road-trip optimizer collecting the best sunrise pins in every city.',
  homeBase: 'San Antonio, TX',
  interests: ['adventure', 'nature', 'scenic'],
  stats: { spots: 24, trips: 5, friends: 41 },
});

export const mockFriendConnections: FriendConnection[] = [
  {
    id: 'friend-1',
    user: {
      ...mockUsers[1],
      avatarUrl: buildPravatarUrl('user-2'),
    },
    presence: 'online',
    sharedTrips: 2,
    mutualFriends: 14,
    favoriteCategories: ['culture', 'shopping', 'scenic'],
    nextAdventure: 'Dallas design district sprint',
    lastActiveAt: '2026-03-29T03:28:00Z',
  },
  {
    id: 'friend-2',
    user: {
      ...mockUsers[2],
      avatarUrl: buildPravatarUrl('user-3'),
    },
    presence: 'planning',
    sharedTrips: 4,
    mutualFriends: 9,
    favoriteCategories: ['adventure', 'food', 'nature'],
    nextAdventure: 'Austin sunrise route',
    lastActiveAt: '2026-03-29T02:54:00Z',
  },
  {
    id: 'friend-3',
    user: incomingRequestUser,
    presence: 'offline',
    sharedTrips: 0,
    mutualFriends: 6,
    favoriteCategories: ['culture', 'food'],
    nextAdventure: 'Houston museum + pastry loop',
    lastActiveAt: '2026-03-28T20:15:00Z',
  },
].map((connection) => sanitizeFriendConnection(connection));

export const mockFriendRequests: FriendRequest[] = [
  {
    id: 'request-1',
    user: incomingRequestUser,
    direction: 'incoming',
    createdAt: '2026-03-29T01:40:00Z',
    mutualFriends: 6,
    note: 'Heading to Fort Worth next weekend and want to trade scenic + coffee pins.',
  },
  {
    id: 'request-2',
    user: outgoingRequestUser,
    direction: 'outgoing',
    createdAt: '2026-03-28T22:10:00Z',
    mutualFriends: 3,
    note: 'Sent after matching on scenic road-trip collections and shared itinerary pacing.',
  },
].map((request) => sanitizeFriendRequest(request));
