import rawUsers from '@/mock/users.json';
import type { UserProfile } from '@/types';
import { sanitizeUserProfile } from '@/utils/sanitizers';
import { buildPravatarAvatarUrl } from '@/utils/demoMedia';

const fallbackCatalogUsers: UserProfile[] = [
  sanitizeUserProfile({
    id: 'user-1',
    username: 'louisdo',
    email: 'louis@example.com',
    displayName: 'Louis Do',
    avatarUrl: buildPravatarAvatarUrl(12),
    bio: 'Collecting rooftop dinners, skyline pins, and story-worthy city nights across Texas.',
    homeBase: 'Fort Worth, TX',
    interests: ['food', 'culture', 'nightlife'],
    stats: { spots: 42, trips: 8, friends: 126 },
  }),
];

const rawCatalogUsers = (rawUsers as UserProfile[]).map((user) => sanitizeUserProfile(user));

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
