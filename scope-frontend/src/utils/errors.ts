import { isApiClientError } from '@/services/api';

export function toAsyncErrorMessage(error: unknown, fallbackMessage: string): string {
  if (isApiClientError(error)) {
    return error.message || fallbackMessage;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallbackMessage;
}
