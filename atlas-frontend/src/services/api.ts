import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { DEMO_MODE_ENABLED } from '@/services/demoMode';
import type { ApiErrorDetail, ApiErrorResponse } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || '/';
const API_TIMEOUT_MS = 10_000;
const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);
const REFRESH_ENDPOINT_PATH = '/api/core/auth/refresh';
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const CSRF_BOOTSTRAP_ENDPOINT = import.meta.env.VITE_CSRF_ENDPOINT?.trim() || '';
const CSRF_COOKIE_NAMES = ['XSRF-TOKEN', 'csrftoken', 'csrf-token', 'csrfToken'];

let accessToken = '';
let csrfToken = '';
let csrfBootstrapPromise: Promise<string | null> | null = null;
let refreshAccessTokenHandler: (() => Promise<string | null>) | null = null;
let unauthorizedHandler: (() => void | Promise<void>) | null = null;

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  atlasSkipAuthRefresh?: boolean;
  atlasSkipCsrfBootstrap?: boolean;
}

interface ApiClientErrorOptions {
  message: string;
  code?: string;
  status?: number;
  details?: ApiErrorDetail[];
  traceId?: string;
  isNetworkError?: boolean;
}

export interface ApiSessionLifecycleHandlers {
  refreshAccessToken?: (() => Promise<string | null>) | null;
  handleUnauthorized?: (() => void | Promise<void>) | null;
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly details?: ApiErrorDetail[];
  readonly traceId?: string;
  readonly isNetworkError: boolean;

  constructor(options: ApiClientErrorOptions) {
    super(options.message);
    this.name = 'ApiClientError';
    this.code = options.code ?? 'api_error';
    this.status = options.status;
    this.details = options.details;
    this.traceId = options.traceId;
    this.isNetworkError = options.isNetworkError ?? false;
  }
}

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: API_TIMEOUT_MS,
});

function isApiErrorResponse(payload: unknown): payload is ApiErrorResponse {
  return typeof payload === 'object' && payload !== null && 'error' in payload;
}

function getHeaderValue(headers: AxiosResponse['headers'], name: string): string | null {
  const headerValue = headers[name.toLowerCase()] ?? headers[name];

  if (Array.isArray(headerValue)) {
    return headerValue[0]?.trim() || null;
  }

  if (typeof headerValue === 'string') {
    return headerValue.trim() || null;
  }

  return null;
}

function getPayloadValue(payload: unknown, key: string): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const candidate = (payload as Record<string, unknown>)[key];
  return typeof candidate === 'string' ? candidate.trim() || null : null;
}

function extractCsrfTokenFromPayload(payload: unknown): string | null {
  if (typeof payload === 'string') {
    return payload.trim() || null;
  }

  const directToken =
    getPayloadValue(payload, 'csrfToken') ??
    getPayloadValue(payload, 'csrf_token') ??
    getPayloadValue(payload, 'token');

  if (directToken) {
    return directToken;
  }

  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const nestedPayload = (payload as Record<string, unknown>).data;

  return (
    getPayloadValue(nestedPayload, 'csrfToken') ??
    getPayloadValue(nestedPayload, 'csrf_token') ??
    getPayloadValue(nestedPayload, 'token')
  );
}

function readCookieValue(cookieName: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const escapedCookieName = cookieName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cookieMatch = document.cookie.match(new RegExp(`(?:^|;\\s*)${escapedCookieName}=([^;]*)`));

  if (!cookieMatch?.[1]) {
    return null;
  }

  const decodedCookie = decodeURIComponent(cookieMatch[1]).trim();
  return decodedCookie || null;
}

function readCookieCsrfToken(): string | null {
  for (const cookieName of CSRF_COOKIE_NAMES) {
    const cookieToken = readCookieValue(cookieName);

    if (cookieToken) {
      return cookieToken;
    }
  }

  return null;
}

function rememberCsrfToken(nextToken: string | null | undefined): string {
  const normalizedToken = nextToken?.trim() ?? '';

  if (normalizedToken) {
    csrfToken = normalizedToken;
  }

  return csrfToken;
}

function isMutatingRequest(requestConfig: InternalAxiosRequestConfig): boolean {
  return MUTATING_METHODS.has((requestConfig.method ?? 'get').toLowerCase());
}

function isRefreshRequest(requestConfig: InternalAxiosRequestConfig | undefined): boolean {
  const url = requestConfig?.url ?? '';
  return url.includes(REFRESH_ENDPOINT_PATH);
}

async function bootstrapCsrfToken(): Promise<string> {
  if (csrfToken) {
    return csrfToken;
  }

  const cookieBackedToken = readCookieCsrfToken();

  if (cookieBackedToken) {
    csrfToken = cookieBackedToken;
    return csrfToken;
  }

  if (!CSRF_BOOTSTRAP_ENDPOINT) {
    return csrfToken;
  }

  if (!csrfBootstrapPromise) {
    csrfBootstrapPromise = api
      .get(CSRF_BOOTSTRAP_ENDPOINT, {
        headers: {
          'Cache-Control': 'no-store',
        },
        atlasSkipAuthRefresh: true,
        atlasSkipCsrfBootstrap: true,
      } as RetriableRequestConfig)
      .then((response) => {
        rememberCsrfToken(
          getHeaderValue(response.headers, 'x-csrf-token') ??
            extractCsrfTokenFromPayload(response.data) ??
            readCookieCsrfToken(),
        );
        return csrfToken || null;
      })
      .catch(() => null)
      .finally(() => {
        csrfBootstrapPromise = null;
      });
  }

  const nextToken = await csrfBootstrapPromise;
  return nextToken ?? csrfToken;
}

async function runUnauthorizedHandler(): Promise<void> {
  await unauthorizedHandler?.();
}

function getNetworkFailureMessage(error: AxiosError<ApiErrorResponse>): string {
  if (error.code === 'ECONNABORTED') {
    return 'Atlas timed out while contacting the server. Check your connection and try again.';
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'You appear to be offline. Reconnect to Atlas and try again.';
  }

  return 'Atlas could not reach the API right now. Check your connection and try again.';
}

function normalizeApiError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) {
    return error;
  }

  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    const responsePayload = error.response?.data;
    const fallbackMessage = error.response ? error.message || 'Atlas could not reach the API right now.' : getNetworkFailureMessage(error);

    if (isApiErrorResponse(responsePayload)) {
      return new ApiClientError({
        message: responsePayload.error.message,
        code: responsePayload.error.code,
        status: error.response?.status,
        details: responsePayload.error.details,
        traceId: responsePayload.error.traceId,
        isNetworkError: !error.response,
      });
    }

    return new ApiClientError({
      message: fallbackMessage,
      code: error.code ?? 'network_error',
      status: error.response?.status,
      isNetworkError: !error.response,
    });
  }

  if (error instanceof Error) {
    return new ApiClientError({
      message: error.message,
      code: 'unexpected_error',
    });
  }

  return new ApiClientError({
    message: 'Atlas hit an unexpected API error.',
    code: 'unexpected_error',
  });
}

async function applyRequestHeaders(config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> {
  if (DEMO_MODE_ENABLED) {
    throw new ApiClientError({
      message: 'Atlas demo mode routes API requests to local fixture data.',
      code: 'demo_mode',
    });
  }

  const requestConfig = config as RetriableRequestConfig;
  const headers = AxiosHeaders.from(requestConfig.headers);

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  } else {
    headers.delete('Authorization');
  }

  if (isMutatingRequest(requestConfig)) {
    if (!csrfToken && !requestConfig.atlasSkipCsrfBootstrap) {
      await bootstrapCsrfToken();
    }

    if (csrfToken) {
      headers.set(CSRF_HEADER_NAME, csrfToken);
    }
  }

  requestConfig.headers = headers;
  return requestConfig;
}

function captureResponseSessionHeaders(response: AxiosResponse): AxiosResponse {
  rememberCsrfToken(
    getHeaderValue(response.headers, 'x-csrf-token') ??
      extractCsrfTokenFromPayload(response.data) ??
      readCookieCsrfToken(),
  );

  return response;
}

async function retryUnauthorizedRequest(error: AxiosError<ApiErrorResponse>): Promise<AxiosResponse | never> {
  const requestConfig = error.config as RetriableRequestConfig | undefined;

  if (
    error.response?.status !== 401 ||
    !requestConfig ||
    requestConfig._retry ||
    requestConfig.atlasSkipAuthRefresh ||
    isRefreshRequest(requestConfig) ||
    !refreshAccessTokenHandler
  ) {
    throw normalizeApiError(error);
  }

  requestConfig._retry = true;

  try {
    const refreshedToken = await refreshAccessTokenHandler();

    if (!refreshedToken) {
      await runUnauthorizedHandler();
      throw normalizeApiError(error);
    }

    setAccessToken(refreshedToken);
    requestConfig.headers = AxiosHeaders.from(requestConfig.headers);
    requestConfig.headers.set('Authorization', `Bearer ${refreshedToken}`);
    return api(requestConfig);
  } catch (refreshError) {
    await runUnauthorizedHandler();
    throw normalizeApiError(refreshError);
  }
}

export const setAccessToken = (token: string): void => {
  accessToken = token.trim();
};

export const getAccessToken = (): string => accessToken;

export const setCsrfToken = (token: string): void => {
  rememberCsrfToken(token);
};

export const clearApiSession = (): void => {
  accessToken = '';
  csrfToken = '';
  csrfBootstrapPromise = null;
};

export const configureApiSessionHandlers = (handlers: ApiSessionLifecycleHandlers): void => {
  refreshAccessTokenHandler = handlers.refreshAccessToken ?? null;
  unauthorizedHandler = handlers.handleUnauthorized ?? null;
};

export const isApiClientError = (error: unknown): error is ApiClientError => error instanceof ApiClientError;

api.interceptors.request.use((config) => applyRequestHeaders(config));
api.interceptors.response.use(
  (response) => captureResponseSessionHeaders(response),
  async (error: AxiosError<ApiErrorResponse>) => retryUnauthorizedRequest(error),
);

export default api;
