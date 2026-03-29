import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { ApiErrorDetail, ApiErrorResponse } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || '/';
const API_TIMEOUT_MS = 10_000;
const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);
const REFRESH_ENDPOINT_PATH = '/api/core/auth/refresh';

let accessToken = '';
let csrfToken = '';
let refreshAccessTokenHandler: (() => Promise<string | null>) | null = null;
let unauthorizedHandler: (() => void | Promise<void>) | null = null;

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
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

function isRefreshRequest(requestConfig: InternalAxiosRequestConfig | undefined): boolean {
  const url = requestConfig?.url ?? '';
  return url.includes(REFRESH_ENDPOINT_PATH);
}

async function runUnauthorizedHandler(): Promise<void> {
  await unauthorizedHandler?.();
}

function normalizeApiError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) {
    return error;
  }

  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    const responsePayload = error.response?.data;
    const fallbackMessage = error.message || 'Atlas could not reach the API right now.';

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

function applyRequestHeaders(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const headers = AxiosHeaders.from(config.headers);

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  } else {
    headers.delete('Authorization');
  }

  if (csrfToken && MUTATING_METHODS.has((config.method ?? 'get').toLowerCase())) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  config.headers = headers;
  return config;
}

function captureResponseSessionHeaders(response: AxiosResponse): AxiosResponse {
  const nextCsrfToken = getHeaderValue(response.headers, 'x-csrf-token');

  if (nextCsrfToken) {
    csrfToken = nextCsrfToken;
  }

  return response;
}

async function retryUnauthorizedRequest(error: AxiosError<ApiErrorResponse>): Promise<AxiosResponse | never> {
  const requestConfig = error.config as RetriableRequestConfig | undefined;

  if (
    error.response?.status !== 401 ||
    !requestConfig ||
    requestConfig._retry ||
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
  csrfToken = token.trim();
};

export const clearApiSession = (): void => {
  accessToken = '';
  csrfToken = '';
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
