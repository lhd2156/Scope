import rawUsers from '@/mock/users.json';
import { demoFriendConnections, demoFriendRequests } from '@/services/socialMockData';
import type { UserProfile } from '@/types';
import { sanitizeUserProfile } from '@/utils/sanitizers';

const fallbackCatalogUsers: UserProfile[] = [
  sanitizeUserProfile({
    id: 'user-1',
    username: 'scope-showcase',
    email: 'traveler@showcase.scopetrips.com',
    // Anonymous showcase persona used for local preview mode. Once real accounts land,
    // this fallback should simply never surface to the UI.
    displayName: 'Scope traveler',
    // Intentionally blank so the Avatar component falls back to its
    // neutral silhouette placeholder instead of a seeded stock face.
    avatarUrl: '',
    bio: 'Sample showcase profile used until a real account connects.',
    interests: ['food', 'culture', 'nightlife'],
    stats: { spots: 42, trips: 8, friends: 126 },
  }),
];

const rawCatalogUsers = (rawUsers as UserProfile[]).map((user) =>
  sanitizeUserProfile(user, { allowGeneratedAvatar: true }),
);
const socialCatalogUsers = [
  ...demoFriendConnections.map((connection) => connection.user),
  ...demoFriendRequests.map((request) => request.user),
].map((user) => sanitizeUserProfile(user, { allowGeneratedAvatar: true }));

const mergedCatalogUsers = [...fallbackCatalogUsers, ...rawCatalogUsers, ...socialCatalogUsers];
const uniqueCatalogUsers = new Map<string, UserProfile>();

for (const user of mergedCatalogUsers) {
  uniqueCatalogUsers.set(user.id, user);
}

export const catalogMockUsers: UserProfile[] = [...uniqueCatalogUsers.values()];

function getMockUserIdVariants(userId: string): string[] {
  const variants = [userId];
  const numericLegacyMatch = /^user-(\d+)$/i.exec(userId);
  if (numericLegacyMatch) {
    variants.push(`demo-user-${numericLegacyMatch[1]}`);
  }

  return variants;
}

export function getCatalogMockUserById(userId: string): UserProfile | undefined {
  const exactMatch = catalogMockUsers.find((user) => user.id === userId);
  if (exactMatch) {
    return exactMatch;
  }

  const variants = getMockUserIdVariants(userId);
  return catalogMockUsers.find((user) => variants.includes(user.id));
}

export function findCatalogMockUser(criteria: Partial<Pick<UserProfile, 'id' | 'email' | 'username'>>): UserProfile | undefined {
  return catalogMockUsers.find(
    (user) =>
      (criteria.id && user.id === criteria.id)
      || (criteria.email && user.email === criteria.email)
      || (criteria.username && user.username === criteria.username),
  );
}
