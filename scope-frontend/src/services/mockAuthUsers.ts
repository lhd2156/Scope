import rawUsers from '@/mock/users.json';
import type { UserProfile } from '@/types';
import { sanitizeUserProfile } from '@/utils/sanitizers';

const fallbackAuthUsers: UserProfile[] = [
  sanitizeUserProfile({
    id: 'user-1',
    username: 'scopedemo',
    email: 'demo@scope.travel',
    // Anonymous demo persona used while the app is running in mock mode.
    // Swap out for the signed-in user once real accounts are wired up.
    displayName: 'Scope traveler',
    // Leave avatarUrl blank so the Avatar component renders its neutral
    // silhouette placeholder (Instagram-style) until the user uploads one.
    avatarUrl: '',
    bio: 'Sample demo profile used until a real account connects.',
    interests: ['food', 'culture', 'nightlife'],
    stats: { spots: 42, trips: 8, friends: 126 },
  }),
];

const demoAuthUsers = (rawUsers as UserProfile[])
  .slice(0, 2)
  .map((user) => sanitizeUserProfile(user));

// Canonical demo users (from src/mock/users.json) take precedence so their
// richer fields (e.g. "demo-user-1") win when both sources expose the same
// demo@scope.travel email. The hand-crafted fallback above only surfaces
// when users.json is empty or misses the shared demo identity.
export const authMockUsers: UserProfile[] = [...demoAuthUsers, ...fallbackAuthUsers];

export function findAuthMockUser(
  criteria: Partial<Pick<UserProfile, 'id' | 'email' | 'username' | 'displayName'>>,
): UserProfile | undefined {
  return authMockUsers.find(
    (user) =>
      (criteria.id && user.id === criteria.id)
      || (criteria.email && user.email === criteria.email)
      || (criteria.username && user.username === criteria.username)
      || (criteria.displayName && user.displayName.toLowerCase() === criteria.displayName.toLowerCase()),
  );
}
