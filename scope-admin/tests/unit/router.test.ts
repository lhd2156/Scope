import { describe, expect, it } from 'vitest';
import { router } from '@/router';
import { ADMIN_STORAGE_TOKEN_KEY } from '@/utils/constants';

describe('admin router guards', () => {
  it('redirects guests away from protected pages and signed-in admins away from login', async () => {
    await router.push('/dashboard');
    await router.isReady();
    expect(router.currentRoute.value.path).toBe('/login');

    sessionStorage.setItem(ADMIN_STORAGE_TOKEN_KEY, 'token');
    await router.push('/dashboard');
    await router.isReady();
    expect(router.currentRoute.value.path).toBe('/dashboard');

    await router.push('/login');
    await router.isReady();
    expect(router.currentRoute.value.path).toBe('/dashboard');

    await router.push('/unknown/path');
    await router.isReady();
    expect(router.currentRoute.value.path).toBe('/dashboard');
  });
});
