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
  vi.stubEnv('VITE_DEMO_MODE', 'false');
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

 it('shares one refresh request across concurrent 401 retries', async () => {
  const { default: api, configureApiSessionHandlers, setAccessToken } = await import('@/services/api');
  const refreshAccessToken = vi.fn(async () => {
   await new Promise((resolve) => setTimeout(resolve, 10));
   return 'fresh-token';
  });
  const requestAttempts = new Map<string, number>();
  const retriedAuthorizationHeaders: string[] = [];

  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
   const url = config.url ?? '';
   const attempt = requestAttempts.get(url) ?? 0;
   requestAttempts.set(url, attempt + 1);

   if (attempt === 0) {
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

   retriedAuthorizationHeaders.push(String(AxiosHeaders.from(config.headers).get('Authorization') ?? ''));
   return buildAxiosResponse(config, 200, { data: [url] });
  };

  configureApiSessionHandlers({
   refreshAccessToken,
   handleUnauthorized: vi.fn(),
  });
  setAccessToken('stale-token');

  const responses = await Promise.all([
   api.get('/api/content/spots/saved'),
   api.get('/api/content/trips/public'),
   api.get('/api/content/spots/user/user-1'),
  ]);

  expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  expect(retriedAuthorizationHeaders).toEqual(['Bearer fresh-token', 'Bearer fresh-token', 'Bearer fresh-token']);
  expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
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

 it('surfaces an offline-friendly network message when no response is returned', async () => {
  Object.defineProperty(window.navigator, 'onLine', {
   configurable: true,
   value: false,
  });

  const { default: api, ApiClientError } = await import('@/services/api');

  api.defaults.adapter = async (config: InternalAxiosRequestConfig) =>
   Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config));

  await expect(api.get('/api/content/feed')).rejects.toBeInstanceOf(ApiClientError);
  await expect(api.get('/api/content/feed')).rejects.toMatchObject({
   code: 'ERR_NETWORK',
   message: 'You appear to be offline. Reconnect to Scope and try again.',
   isNetworkError: true,
  });
 });

 it('surfaces a timeout-specific message for stalled requests', async () => {
  const { default: api } = await import('@/services/api');

  api.defaults.adapter = async (config: InternalAxiosRequestConfig) =>
   Promise.reject(new AxiosError('timeout of 10000ms exceeded', 'ECONNABORTED', config));

  await expect(api.get('/api/content/feed')).rejects.toMatchObject({
   code: 'ECONNABORTED',
   message: 'Scope timed out while contacting the server. Check your connection and try again.',
   isNetworkError: true,
  });
 });

 it('drops access tokens that cannot ride an ISO-8859-1 header', async () => {
  // This exact class of input used to crash XHR's setRequestHeader with
  // "String contains non ISO-8859-1 code point" (regression from a real
  // production report). The client should discard the token silently
  // instead of letting the request construction throw.
  const { default: api, setAccessToken, getAccessToken } = await import('@/services/api');
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => buildAxiosResponse(config, 200, { ok: true }));

  api.defaults.adapter = adapter;
  setAccessToken('unicode-token-\u2028-\u1f600');

  expect(getAccessToken()).toBe('');

  await api.get('/api/content/feed');

  const requestConfig = adapter.mock.calls[0]?.[0] as InternalAxiosRequestConfig;
  const headers = AxiosHeaders.from(requestConfig.headers);
  expect(headers.get('Authorization')).toBeFalsy();
 });

 it('ignores csrf cookies whose decoded value contains non-latin characters', async () => {
  // %F0%9F%8E%89 decodes to a code point, which is valid UTF-8 but
  // outside ISO-8859-1. The client should fall back to leaving the
  // header unset instead of throwing when the XHR layer rejects it.
  document.cookie = 'XSRF-TOKEN=%F0%9F%8E%89; path=/';

  const { default: api } = await import('@/services/api');
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => buildAxiosResponse(config, 200, { ok: true }));

  api.defaults.adapter = adapter;

  await api.post('/api/core/auth/login', {
   email: 'explorer@example.com',
   password: 'super-secret',
  });

  const requestConfig = adapter.mock.calls[0]?.[0] as InternalAxiosRequestConfig;
  const headers = AxiosHeaders.from(requestConfig.headers);
  expect(headers.get('X-CSRF-Token')).toBeFalsy();
 });

 it('hydrates csrf from array headers, nested payloads, and cached bootstrap state', async () => {
  vi.stubEnv('VITE_CSRF_ENDPOINT', '/api/core/auth/csrf');

  const { default: api } = await import('@/services/api');
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
   if (config.url === '/api/core/auth/csrf') {
    return buildAxiosResponse(config, 200, {
     data: {
      csrf: 'nested-csrf-token',
     },
    }, { 'x-csrf-token': ['array-csrf-token'] } as unknown as Record<string, string>);
   }

   return buildAxiosResponse(config, 200, { ok: true });
  });

  api.defaults.adapter = adapter;

  await api.post('/api/content/spots', { title: 'First' });
  await api.post('/api/content/spots', { title: 'Second' });

  const firstFormRequest = adapter.mock.calls[1]?.[0] as InternalAxiosRequestConfig;
  const secondFormRequest = adapter.mock.calls[2]?.[0] as InternalAxiosRequestConfig;

  expect(AxiosHeaders.from(firstFormRequest.headers).get('X-CSRF-Token')).toBe('array-csrf-token');
  expect(AxiosHeaders.from(secondFormRequest.headers).get('X-CSRF-Token')).toBe('array-csrf-token');
  expect(adapter).toHaveBeenCalledTimes(3);
 });

 it('falls back to string csrf bootstrap payloads and normalizes unexpected errors', async () => {
  vi.stubEnv('VITE_CSRF_ENDPOINT', '/api/core/auth/csrf');

  const { default: api, ApiClientError } = await import('@/services/api');
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
   if (config.url === '/api/core/auth/csrf') {
    return buildAxiosResponse(config, 200, ' string-csrf-token ');
   }

   if (config.url === '/api/unexpected-error') {
    throw new Error('plain adapter failure');
   }

   if (config.url === '/api/non-error') {
    throw 'bad adapter failure';
   }

   return buildAxiosResponse(config, 200, { ok: true });
  });

  api.defaults.adapter = adapter;

  await api.post('/api/content/spots', { title: 'Payload token' });
  const formRequest = adapter.mock.calls[1]?.[0] as InternalAxiosRequestConfig;
  expect(AxiosHeaders.from(formRequest.headers).get('X-CSRF-Token')).toBe('string-csrf-token');

  await expect(api.get('/api/unexpected-error')).rejects.toMatchObject({
   message: 'plain adapter failure',
   code: 'unexpected_error',
  });
  await expect(api.get('/api/non-error')).rejects.toBeInstanceOf(ApiClientError);
  await expect(api.get('/api/non-error')).rejects.toMatchObject({
   message: 'Scope hit an unexpected API error.',
   code: 'unexpected_error',
  });
 });

 it('runs the unauthorized handler when refresh cannot recover a 401', async () => {
  const { default: api, configureApiSessionHandlers, setAccessToken } = await import('@/services/api');
  const handleUnauthorized = vi.fn();
  const refreshAccessToken = vi.fn()
   .mockResolvedValueOnce('')
   .mockRejectedValueOnce(new Error('refresh offline'));

  let requestCount = 0;
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
   requestCount += 1;
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
  };

  configureApiSessionHandlers({ refreshAccessToken, handleUnauthorized });
  setAccessToken('expired-token');

  await expect(api.get('/api/content/feed')).rejects.toMatchObject({ status: 401 });
  expect(handleUnauthorized).toHaveBeenCalledTimes(2);
  expect(requestCount).toBe(1);

  setAccessToken('expired-token-again');
  await expect(api.get('/api/content/feed')).rejects.toMatchObject({
   message: 'refresh offline',
   code: 'unexpected_error',
  });
  expect(handleUnauthorized).toHaveBeenCalledTimes(3);
 });
});
