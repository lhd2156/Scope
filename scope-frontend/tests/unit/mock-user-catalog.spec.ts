import { describe, expect, it } from 'vitest';
import {
  catalogMockUsers,
  findCatalogMockUser,
  getCatalogMockUserById,
} from '@/services/mockUserCatalog';
import {
  isShowcaseUserId,
  resolveShowcaseUserProfile,
  searchShowcaseUserProfiles,
} from '@/utils/showcaseActors';

describe('mock user catalog', () => {
  it('deduplicates catalog users and resolves legacy numeric ids', () => {
    expect(catalogMockUsers.length).toBeGreaterThan(1);
    expect(new Set(catalogMockUsers.map((user) => user.id)).size).toBe(catalogMockUsers.length);

    expect(getCatalogMockUserById('demo-user-5')?.displayName).toBe('Jordan Reed');
    expect(getCatalogMockUserById('user-5')?.id).toBe('demo-user-5');
    expect(getCatalogMockUserById('missing-user')).toBeUndefined();
  });

  it('finds users by id, email, or username criteria', () => {
    expect(findCatalogMockUser({ id: 'demo-user-2' })?.displayName).toBe('Maya Chen');
    expect(findCatalogMockUser({ email: 'elijah.brooks@showcase.scope.local' })?.displayName).toBe('Elijah Brooks');
    expect(findCatalogMockUser({ username: 'sofia.ramirez' })?.displayName).toBe('Sofia Ramirez');
    expect(findCatalogMockUser({ email: 'nobody@example.com' })).toBeUndefined();
  });

  it('keeps production showcase profile aliases and photos canonical', () => {
    const sofia = resolveShowcaseUserProfile('demo-user-4');
    const jordan = resolveShowcaseUserProfile('55555555-5555-5555-5555-555555555551');
    const maya = resolveShowcaseUserProfile('22222222-2222-2222-2222-222222222222');
    const elijah = resolveShowcaseUserProfile('demo-user-3');

    expect(sofia).toMatchObject({
      displayName: 'Sofia Ramirez',
      username: 'sofia.ramirez',
      avatarUrl: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=600',
    });
    expect(jordan).toMatchObject({
      displayName: 'Jordan Reed',
      avatarUrl: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=600',
    });
    expect(maya?.avatarUrl).toContain('/photos/220453/');
    expect(elijah?.avatarUrl).toContain('/photos/1239291/');
    expect(isShowcaseUserId('demo-user-4')).toBe(true);
    expect(isShowcaseUserId('real-user-4')).toBe(false);
  });

  it('searches showcase people by handle, name, city, and vibe', () => {
    expect(searchShowcaseUserProfiles('@sofia', 1, 6)).toEqual([
      expect.objectContaining({
        id: '44444444-4444-4444-4444-444444444441',
        displayName: 'Sofia Ramirez',
      }),
    ]);
    expect(searchShowcaseUserProfiles('Denver scenic', 1, 6)).toEqual([
      expect.objectContaining({ displayName: 'Jordan Reed' }),
    ]);
  });
});
