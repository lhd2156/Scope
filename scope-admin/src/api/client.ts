import axios, { AxiosError, type AxiosResponse } from 'axios';
import { ADMIN_STORAGE_TOKEN_KEY } from '@/utils/constants';

const apiBaseURL = import.meta.env.VITE_API_BASE_URL || '/';

export const apiClient = axios.create({
  baseURL: apiBaseURL,
  timeout: 20_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function getStoredToken(): string | null {
  localStorage.removeItem(ADMIN_STORAGE_TOKEN_KEY);
  return sessionStorage.getItem(ADMIN_STORAGE_TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  localStorage.removeItem(ADMIN_STORAGE_TOKEN_KEY);
  if (token) {
    sessionStorage.setItem(ADMIN_STORAGE_TOKEN_KEY, token);
    return;
  }

  sessionStorage.removeItem(ADMIN_STORAGE_TOKEN_KEY);
}

apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function handleUnauthorizedResponse(response: AxiosResponse | undefined): void {
  if (response?.status !== 401) {
    return;
  }

  setStoredToken(null);
  window.dispatchEvent(new CustomEvent('scope-admin-unauthorized'));
  if (!window.location.pathname.endsWith('/login')) {
    window.location.assign('/admin/login');
  }
}

apiClient.interceptors.response.use(
  (response) => {
    if (response.status === 401) {
      handleUnauthorizedResponse(response);
      return Promise.reject(
        new AxiosError(
          'Unauthorized',
          AxiosError.ERR_BAD_RESPONSE,
          response.config,
          response.request,
          response,
        ),
      );
    }

    return response;
  },
  (error: AxiosError) => {
    handleUnauthorizedResponse(error.response);
    return Promise.reject(error);
  },
);

export interface PaginatedRequest {
  page?: number;
  pageSize?: number;
  q?: string;
  search?: string;
  flagged?: boolean | '';
  status?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

type Envelope<T> = {
  data?: T;
  results?: T;
  items?: T;
  total?: number;
  count?: number;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
  };
};

export function unwrapData<T>(payload: Envelope<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload && payload.data !== undefined) {
    return payload.data as T;
  }
  return payload as T;
}

export function unwrapList<T>(
  response: AxiosResponse<Envelope<T[]> | T[]>,
  page = 1,
  pageSize = 25,
): PaginatedResult<T> {
  const payload = response.data;
  const envelope = payload as Envelope<T[]>;
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(envelope.data)
      ? envelope.data
      : Array.isArray(envelope.results)
        ? envelope.results
        : Array.isArray(envelope.items)
          ? envelope.items
          : [];

  return {
    items,
    total: envelope.meta?.total ?? envelope.total ?? envelope.count ?? items.length,
    page: envelope.meta?.page ?? page,
    pageSize: envelope.meta?.pageSize ?? pageSize,
  };
}
