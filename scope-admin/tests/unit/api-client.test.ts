import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { apiClient, getStoredToken, setStoredToken } from '@/api/client';
import { ADMIN_STORAGE_TOKEN_KEY } from '@/utils/constants';

describe('api client', () => {
  it('stores and clears JWT tokens', () => {
    setStoredToken('jwt-token');
    expect(getStoredToken()).toBe('jwt-token');
    setStoredToken(null);
    expect(localStorage.getItem(ADMIN_STORAGE_TOKEN_KEY)).toBeNull();
  });

  it('attaches Authorization headers', async () => {
    setStoredToken('admin-token');
    let captured: InternalAxiosRequestConfig | undefined;

    await apiClient.get('/probe', {
      adapter: async (config) => {
        captured = config;
        return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse;
      },
    });

    expect(captured?.headers.Authorization).toBe('Bearer admin-token');
  });

  it('does not attach Authorization when token is absent', async () => {
    let captured: InternalAxiosRequestConfig | undefined;

    await apiClient.get('/probe', {
      adapter: async (config) => {
        captured = config;
        return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse;
      },
    });

    expect(captured?.headers.Authorization).toBeUndefined();
  });

  it('clears token on unauthorized responses', async () => {
    setStoredToken('expired');
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    await expect(
      apiClient.get('/probe', {
        adapter: async (config) =>
          ({ data: {}, status: 401, statusText: 'Unauthorized', headers: {}, config }) as AxiosResponse,
      }),
    ).rejects.toBeTruthy();

    expect(getStoredToken()).toBeNull();
    expect(dispatchSpy).toHaveBeenCalled();
  });

  it('uses slash-relative API base URL by default', () => {
    expect(apiClient.defaults.baseURL).toBe('/');
  });
});
