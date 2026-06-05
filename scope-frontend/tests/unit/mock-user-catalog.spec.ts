import { describe, expect, it } from 'vitest';
import {
  catalogMockUsers,
  findCatalogMockUser,
  getCatalogMockUserById,
} from '@/services/mockUserCatalog';

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
});
