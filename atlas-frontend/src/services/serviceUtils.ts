import type { ApiEnvelope, PaginationMeta } from '@/types';

function isApiEnvelope<T>(payload: ApiEnvelope<T> | T): payload is ApiEnvelope<T> {
  return typeof payload === 'object' && payload !== null && 'data' in payload;
}

export function unwrapApiData<T>(payload: ApiEnvelope<T> | T): T {
  return isApiEnvelope(payload) ? payload.data : payload;
}

export function createPaginationMeta(total: number, page = 1, pageSize = total || 1): PaginationMeta {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);

  return {
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / safePageSize)),
  };
}

export function paginateItems<T>(items: T[], page = 1, pageSize = items.length || 1): ApiEnvelope<T[]> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const startIndex = (safePage - 1) * safePageSize;
  const pagedItems = items.slice(startIndex, startIndex + safePageSize);

  return {
    data: pagedItems,
    meta: createPaginationMeta(items.length, safePage, safePageSize),
  };
}

export function sortByCreatedAtDescending<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}
