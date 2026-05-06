import rawUsers from '@/mock/users.json';
import type { UserProfile } from '@/types';
import { sanitizeUserProfile } from '@/utils/sanitizers';

const fallbackCatalogUsers: UserProfile[] = [
  sanitizeUserProfile({
    id: 'user-1',
    username: 'scopedemo',
    email: 'demo@scope.travel',
    // Anonymous demo persona used for mock mode. Once real accounts land,
    // this fallback should simply never surface to the UI.
    displayName: 'Local preview user',
    // Intentionally blank so the Avatar component falls back to its
    // neutral silhouette placeholder instead of a seeded stock face.
    avatarUrl: '',
    bio: 'Sample demo profile used until a real account connects.',
    interests: ['food', 'culture', 'nightlife'],
    stats: { spots: 42, trips: 8, friends: 126 },
  }),
];

const rawCatalogUsers = (rawUsers as UserProfile[]).map((user) =>
  sanitizeUserProfile(user, { allowGeneratedAvatar: true }),
);

const mergedCatalogUsers = [...fallbackCatalogUsers, ...rawCatalogUsers];
const uniqueCatalogUsers = new Map<string, UserProfile>();

for (const user of mergedCatalogUsers) {
  uniqueCatalogUsers.set(user.id, user);
}

export const catalogMockUsers: UserProfile[] = [...uniqueCatalogUsers.values()];

export function getCatalogMockUserById(userId: string): UserProfile | undefined {
  return catalogMockUsers.find((user) => user.id === userId);
}

export function findCatalogMockUser(criteria: Partial<Pick<UserProfile, 'id' | 'email' | 'username'>>): UserProfile | undefined {
  return catalogMockUsers.find(
    (user) =>
      (criteria.id && user.id === criteria.id)
      || (criteria.email && user.email === criteria.email)
      || (criteria.username && user.username === criteria.username),
  );
}
