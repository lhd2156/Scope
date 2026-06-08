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

 it('uses configured base URLs and exposes default error/session helpers', async () => {
  vi.stubEnv('VITE_API_BASE_URL', ' https://api.scopetrips.test/root ');

  const {
   default: api,
   ApiClientError,
   clearApiSession,
   configureApiSessionHandlers,
   isApiClientError,
   setAccessToken,
   setCsrfToken,
  } = await import('@/services/api');

  expect(api.defaults.baseURL).toBe('https://api.scopetrips.test/root');
  const error = new ApiClientError({ message: 'Default code' });
  expect(error.code).toBe('api_error');
  expect(isApiClientError(error)).toBe(true);
  expect(isApiClientError(new Error('other'))).toBe(false);

  setAccessToken('token');
  setCsrfToken('csrf');
  configureApiSessionHandlers({});
  clearApiSession();
 });

 it('falls back to the same-origin base URL and tolerates missing document cookies', async () => {
  vi.stubEnv('VITE_API_BASE_URL', '');

  const { default: api } = await import('@/services/api');
  const originalDocument = document;
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) =>
   buildAxiosResponse(config, 200, { ok: true }));
  api.defaults.adapter = adapter;

  try {
   vi.stubGlobal('document', undefined);
   await api.post('/api/content/spots', { title: 'No cookie environment' });
  } finally {
   vi.stubGlobal('document', originalDocument);
  }

  expect(api.defaults.baseURL).toBe('/');
  expect(AxiosHeaders.from(adapter.mock.calls[0]?.[0].headers).get('X-CSRF-Token')).toBeFalsy();
 });

 it('ignores empty csrf response headers and primitive bootstrap payloads', async () => {
  vi.stubEnv('VITE_CSRF_ENDPOINT', '/api/core/auth/csrf');

  const { default: api } = await import('@/services/api');
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
   if (config.url === '/api/core/auth/csrf') {
    return buildAxiosResponse(config, 200, 42, { 'x-csrf-token': ' ' });
   }
   return buildAxiosResponse(config, 200, { ok: true });
  });
  api.defaults.adapter = adapter;

  await api.post('/api/content/spots', { title: 'No bootstrap token' });

  const mutationRequest = adapter.mock.calls.find((call) => call[0].url === '/api/content/spots')?.[0];
  expect(AxiosHeaders.from(mutationRequest?.headers).get('X-CSRF-Token')).toBeFalsy();
 });

 it('ignores empty array csrf headers and blank direct payload tokens', async () => {
  vi.stubEnv('VITE_CSRF_ENDPOINT', '/api/core/auth/csrf');

  const { default: api } = await import('@/services/api');
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
   if (config.url === '/api/core/auth/csrf') {
    return buildAxiosResponse(
     config,
     200,
     { csrfToken: ' ' },
     { 'x-csrf-token': [' '] } as unknown as Record<string, string>,
    );
   }
   return buildAxiosResponse(config, 200, { ok: true });
  });
  api.defaults.adapter = adapter;

  await api.post('/api/content/spots', { title: 'Blank bootstrap token' });

  const mutationRequest = adapter.mock.calls.find((call) => call[0].url === '/api/content/spots')?.[0];
  expect(AxiosHeaders.from(mutationRequest?.headers).get('X-CSRF-Token')).toBeFalsy();
 });

 it('keeps an encoded cookie value when decoding only produces whitespace', async () => {
  document.cookie = 'XSRF-TOKEN=%20; path=/';

  const { default: api } = await import('@/services/api');
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) =>
   buildAxiosResponse(config, 200, { ok: true }));
  api.defaults.adapter = adapter;

  await api.post('/api/content/spots', { title: 'Encoded cookie' });

  expect(AxiosHeaders.from(adapter.mock.calls[0]?.[0].headers).get('X-CSRF-Token')).toBe('%20');
 });

 it('permits tab-safe headers and uses the generic network message while online', async () => {
  Object.defineProperty(window.navigator, 'onLine', {
   configurable: true,
   value: true,
  });

  const { default: api, setAccessToken } = await import('@/services/api');
  let attempts = 0;
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
   attempts += 1;
   expect(AxiosHeaders.from(config.headers).get('Authorization')).toBe('Bearer tab\tseparated');
   return Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config));
  };

  setAccessToken('tab\tseparated');

  await expect(api.get('/api/content/feed')).rejects.toMatchObject({
   message: 'Scope could not reach the API right now. Check your connection and try again.',
   code: 'ERR_NETWORK',
   isNetworkError: true,
  });
  expect(attempts).toBe(3);
 });

 it('shares one csrf bootstrap across concurrent mutations', async () => {
  vi.stubEnv('VITE_CSRF_ENDPOINT', '/api/core/auth/csrf');

  const { default: api } = await import('@/services/api');
  let releaseBootstrap!: () => void;
  const bootstrapGate = new Promise<void>((resolve) => {
   releaseBootstrap = resolve;
  });
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
   if (config.url === '/api/core/auth/csrf') {
    await bootstrapGate;
    return buildAxiosResponse(config, 200, { csrfToken: 'shared-csrf-token' });
   }
   return buildAxiosResponse(config, 200, { ok: true });
  });
  api.defaults.adapter = adapter;

  const first = api.post('/api/content/spots', { title: 'First' });
  const second = api.post('/api/content/trips', { title: 'Second' });
  await Promise.resolve();
  releaseBootstrap();
  await Promise.all([first, second]);

  expect(adapter.mock.calls.filter((call) => call[0].url === '/api/core/auth/csrf')).toHaveLength(1);
  const mutationCalls = adapter.mock.calls.filter((call) => call[0].url !== '/api/core/auth/csrf');
  expect(mutationCalls).toHaveLength(2);
  expect(mutationCalls.every((call) =>
   AxiosHeaders.from(call[0].headers).get('X-CSRF-Token') === 'shared-csrf-token')).toBe(true);
 });

 it('continues a mutation without a csrf header when bootstrap is unavailable', async () => {
  vi.stubEnv('VITE_CSRF_ENDPOINT', '/api/core/auth/csrf');

  const { default: api } = await import('@/services/api');
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
   if (config.url === '/api/core/auth/csrf') {
    throw new Error('csrf offline');
   }
   return buildAxiosResponse(config, 200, { ok: true });
  });
  api.defaults.adapter = adapter;

  await api.post('/api/content/spots', { title: 'Still submit' });

  const mutationRequest = adapter.mock.calls.find((call) => call[0].url === '/api/content/spots')?.[0];
  expect(AxiosHeaders.from(mutationRequest?.headers).get('X-CSRF-Token')).toBeFalsy();
 });

 it('does not retry rate limits or mutations and bounds transient GET retries', async () => {
  const { default: api } = await import('@/services/api');
  const attempts = new Map<string, number>();
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
   const url = config.url ?? '';
   const attempt = attempts.get(url) ?? 0;
   attempts.set(url, attempt + 1);

   if (url === '/api/transient-get' && attempt === 2) {
    return buildAxiosResponse(config, 200, { ok: true });
   }

   const status = url === '/api/rate-limited' ? 429 : 503;
   return Promise.reject(new AxiosError(
    'Service unavailable',
    'ERR_BAD_RESPONSE',
    config,
    undefined,
    buildAxiosResponse(config, status, { message: 'retry later' }),
   ));
  };

  await expect(api.get('/api/transient-get')).resolves.toMatchObject({ status: 200 });
  await expect(api.get('/api/rate-limited')).rejects.toMatchObject({ status: 429 });
  await expect(api.post('/api/transient-post', {})).rejects.toMatchObject({ status: 503 });

  expect(attempts.get('/api/transient-get')).toBe(3);
  expect(attempts.get('/api/rate-limited')).toBe(1);
  expect(attempts.get('/api/transient-post')).toBe(1);
 });

 it('normalizes a 401 immediately when no refresh handler is configured', async () => {
  const { default: api, configureApiSessionHandlers } = await import('@/services/api');
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => Promise.reject(
   new AxiosError(
    '',
    undefined,
    config,
    undefined,
    buildAxiosResponse(config, 401, { message: 'unauthorized' }),
   ),
  ));
  api.defaults.adapter = adapter;
  configureApiSessionHandlers({});

  await expect(api.get('/api/private')).rejects.toMatchObject({
   code: 'network_error',
   status: 401,
   message: 'Scope could not reach the API right now.',
  });
  expect(adapter).toHaveBeenCalledTimes(1);
 });

 it('removes authorization when a refresh handler returns a header-unsafe token', async () => {
  const { default: api, configureApiSessionHandlers, setAccessToken } = await import('@/services/api');
  let attempt = 0;
  const authorizationHeaders: Array<string | null | undefined> = [];
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
   attempt += 1;
   authorizationHeaders.push(AxiosHeaders.from(config.headers).get('Authorization'));
   if (attempt === 1) {
    return Promise.reject(new AxiosError(
     'Unauthorized',
     'ERR_BAD_REQUEST',
     config,
     undefined,
     buildAxiosResponse(config, 401, { message: 'expired' }),
    ));
   }
   return buildAxiosResponse(config, 200, { ok: true });
  };
  configureApiSessionHandlers({
   refreshAccessToken: vi.fn().mockResolvedValue('unsafe-\u2028-token'),
  });
  setAccessToken('stale-token');

  await expect(api.get('/api/private')).resolves.toMatchObject({ status: 200 });
  expect(authorizationHeaders).toEqual(['Bearer stale-token', undefined]);
 });
});
