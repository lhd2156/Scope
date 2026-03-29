import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

function buildAxiosResponse(
  config: InternalAxiosRequestConfig,
  status: number,
  data: unknown,
  headers: Record<string, string> = {},
) {
  return {
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers,
    config,
  };
}

function clearCsrfCookies() {
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  document.cookie = 'csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  document.cookie = 'csrf-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  document.cookie = 'csrfToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

describe('api client', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    clearCsrfCookies();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    clearCsrfCookies();
  });

  it('attaches bearer and csrf headers to mutating requests', async () => {
    const { default: api, setAccessToken, setCsrfToken } = await import('@/services/api');
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => buildAxiosResponse(config, 200, { ok: true }));

    api.defaults.adapter = adapter;
    setAccessToken('demo-token');
    setCsrfToken('csrf-token');

    await api.post('/api/content/spots', { title: 'Sunset Rooftop Tacos' });

    const requestConfig = adapter.mock.calls[0]?.[0] as InternalAxiosRequestConfig;
    const headers = AxiosHeaders.from(requestConfig.headers);

    expect(headers.get('Authorization')).toBe('Bearer demo-token');
    expect(headers.get('X-CSRF-Token')).toBe('csrf-token');
  });

  it('hydrates the csrf header from a readable cookie on the first form submission', async () => {
    document.cookie = 'XSRF-TOKEN=cookie-csrf-token; path=/';

    const { default: api } = await import('@/services/api');
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => buildAxiosResponse(config, 200, { ok: true }));

    api.defaults.adapter = adapter;

    await api.post('/api/core/auth/login', {
      email: 'louis@example.com',
      password: 'super-secret',
    });

    const requestConfig = adapter.mock.calls[0]?.[0] as InternalAxiosRequestConfig;
    const headers = AxiosHeaders.from(requestConfig.headers);

    expect(adapter).toHaveBeenCalledTimes(1);
    expect(headers.get('X-CSRF-Token')).toBe('cookie-csrf-token');
  });

  it('bootstraps a csrf token from the configured endpoint before the first form submission', async () => {
    vi.stubEnv('VITE_CSRF_ENDPOINT', '/api/core/auth/csrf');

    const { default: api } = await import('@/services/api');
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url === '/api/core/auth/csrf') {
        return buildAxiosResponse(
          config,
          200,
          { data: { csrfToken: 'bootstrapped-csrf-token' } },
          { 'x-csrf-token': 'bootstrapped-csrf-token' },
        );
      }

      return buildAxiosResponse(config, 200, { ok: true });
    });

    api.defaults.adapter = adapter;

    await api.post('/api/content/spots', { title: 'Sunset Rooftop Tacos' });

    const bootstrapRequest = adapter.mock.calls[0]?.[0] as InternalAxiosRequestConfig;
    const formRequest = adapter.mock.calls[1]?.[0] as InternalAxiosRequestConfig;
    const formHeaders = AxiosHeaders.from(formRequest.headers);

    expect(adapter).toHaveBeenCalledTimes(2);
    expect(bootstrapRequest.url).toBe('/api/core/auth/csrf');
    expect(formHeaders.get('X-CSRF-Token')).toBe('bootstrapped-csrf-token');
  });

  it('refreshes the access token and retries a 401 response once', async () => {
    const { default: api, configureApiSessionHandlers, setAccessToken } = await import('@/services/api');
    const refreshAccessToken = vi.fn().mockResolvedValue('fresh-token');
    const requestTokens: string[] = [];
    let hasRejected = false;

    api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      const headers = AxiosHeaders.from(config.headers);
      const authorizationHeader = headers.get('Authorization') ?? '';
      requestTokens.push(authorizationHeader);

      if (!hasRejected) {
        hasRejected = true;
        return Promise.reject(
          new AxiosError(
            'Unauthorized',
            'ERR_BAD_REQUEST',
            config,
            undefined,
            buildAxiosResponse(config, 401, {
              error: {
                code: 'auth_expired',
                message: 'Access token expired',
              },
            }),
          ),
        );
      }

      return buildAxiosResponse(config, 200, { data: ['ok'] });
    };

    configureApiSessionHandlers({
      refreshAccessToken,
      handleUnauthorized: vi.fn(),
    });
    setAccessToken('stale-token');

    const response = await api.get('/api/content/feed');

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(requestTokens).toEqual(['Bearer stale-token', 'Bearer fresh-token']);
    expect(response.data).toEqual({ data: ['ok'] });
  });

  it('normalizes API errors into ApiClientError instances', async () => {
    const { default: api, ApiClientError } = await import('@/services/api');

    api.defaults.adapter = async (config: InternalAxiosRequestConfig) =>
      Promise.reject(
        new AxiosError(
          'Request failed',
          'ERR_BAD_RESPONSE',
          config,
          undefined,
          buildAxiosResponse(config, 409, {
            error: {
              code: 'trip_conflict',
              message: 'Trip dates overlap with an existing itinerary.',
            },
          }),
        ),
      );

    await expect(api.get('/api/content/trips')).rejects.toBeInstanceOf(ApiClientError);
    await expect(api.get('/api/content/trips')).rejects.toMatchObject({
      code: 'trip_conflict',
      status: 409,
      message: 'Trip dates overlap with an existing itinerary.',
    });
  });
});
