import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LOCAL_PREVIEW_AUTH_CURRENT_USER_STORAGE_KEY,
  LOCAL_PREVIEW_AUTH_USERS_STORAGE_KEY,
  findLocalPreviewUser,
  readCurrentLocalPreviewUser,
  readLocalPreviewUsers,
  rememberLocalPreviewUser,
  removeLocalPreviewUser,
  toLocalPreviewUserProfile,
  updateLocalPreviewUserProfile,
  writeLocalPreviewUsers,
} from '@/services/localPreviewUserStorage';

const storedUser = {
  id: 'local-user-1',
  username: 'LocalUser',
  displayName: 'Local User',
  email: 'LOCAL@example.com',
  phoneNumber: '(555) 123-4567',
  interests: ['food'],
  homeBase: 'Fort Worth',
};

describe('local preview user storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('reads only valid users and matches by normalized email, username, display name, and phone', () => {
    window.localStorage.setItem(LOCAL_PREVIEW_AUTH_USERS_STORAGE_KEY, JSON.stringify([
      storedUser,
      { id: '', username: 'bad', displayName: 'Bad' },
      'not-user',
    ]));

    expect(readLocalPreviewUsers()).toHaveLength(1);
    expect(findLocalPreviewUser({ email: ' local@EXAMPLE.com ' })?.id).toBe('local-user-1');
    expect(findLocalPreviewUser({ username: 'localuser' })?.id).toBe('local-user-1');
    expect(findLocalPreviewUser({ displayName: ' local user ' })?.id).toBe('local-user-1');
    expect(findLocalPreviewUser({ phoneNumber: '5551234567' })?.id).toBe('local-user-1');
  });

  it('persists, remembers, updates, removes, and selects the current preview user', () => {
    writeLocalPreviewUsers([storedUser], storedUser.id);
    expect(window.localStorage.getItem(LOCAL_PREVIEW_AUTH_CURRENT_USER_STORAGE_KEY)).toBe(storedUser.id);

    const remembered = rememberLocalPreviewUser({
      ...storedUser,
      displayName: 'Updated User',
      avatarUrl: 'https://images.example.com/avatar.jpg',
    });
    expect(remembered.displayName).toBe('Updated User');
    expect(readCurrentLocalPreviewUser()?.displayName).toBe('Updated User');

    const profile = toLocalPreviewUserProfile(remembered);
    expect(profile).toMatchObject({
      id: 'local-user-1',
      displayName: 'Updated User',
      email: 'local@example.com',
    });

    expect(updateLocalPreviewUserProfile('local-user-1', {
      displayName: 'Profile Update',
      interests: ['culture'],
    })).toMatchObject({
      displayName: 'Profile Update',
      interests: ['culture'],
    });
    expect(updateLocalPreviewUserProfile('missing', { displayName: 'Missing' })).toBeNull();

    removeLocalPreviewUser('local-user-1');
    expect(readLocalPreviewUsers()).toEqual([]);
  });

  it('returns empty storage results for malformed JSON and tolerates storage failures', () => {
    window.localStorage.setItem(LOCAL_PREVIEW_AUTH_USERS_STORAGE_KEY, '{bad json');
    expect(readLocalPreviewUsers()).toEqual([]);

    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage denied');
    });
    expect(readCurrentLocalPreviewUser()).toBeUndefined();
    getItemSpy.mockRestore();

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    writeLocalPreviewUsers([storedUser], storedUser.id);
    setItemSpy.mockRestore();
  });
});
