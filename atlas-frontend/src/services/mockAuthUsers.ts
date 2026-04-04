import rawUsers from '@/mock/users.json';
import type { UserProfile } from '@/types';
import { sanitizeUserProfile } from '@/utils/sanitizers';
import { buildPravatarAvatarUrl } from '@/utils/demoMedia';

const fallbackAuthUsers: UserProfile[] = [
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

const demoAuthUsers = (rawUsers as UserProfile[])
  .slice(0, 2)
  .map((user) => sanitizeUserProfile(user));

export const authMockUsers: UserProfile[] = [...fallbackAuthUsers, ...demoAuthUsers];

export function findAuthMockUser(criteria: Partial<Pick<UserProfile, 'id' | 'email' | 'username'>>): UserProfile | undefined {
  return authMockUsers.find(
    (user) =>
      (criteria.id && user.id === criteria.id)
      || (criteria.email && user.email === criteria.email)
      || (criteria.username && user.username === criteria.username),
  );
}
