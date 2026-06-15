import type * as Sentry from '@sentry/vue';
import { describe, expect, it } from 'vitest';
import { parseSentrySampleRate, sanitizeSentryEvent } from '@/utils/sentry';

describe('Sentry helpers', () => {
  it('parses valid sample rates and falls back for missing or invalid values', () => {
    expect(parseSentrySampleRate('0')).toBe(0);
    expect(parseSentrySampleRate('0.75')).toBe(0.75);
    expect(parseSentrySampleRate(undefined)).toBe(0.1);
    expect(parseSentrySampleRate('invalid')).toBe(0.1);
    expect(parseSentrySampleRate('-1')).toBe(0.1);
    expect(parseSentrySampleRate('2')).toBe(0.1);
  });

  it('redacts sensitive route values throughout an event', () => {
    const event = {
      message: 'Open /trips/shared/secret',
      logentry: { message: 'https://scope.test/path?token=log-secret' },
      transaction: '/trips/shared/transaction-secret',
      request: {
        url: 'https://scope.test/path?shareToken=url-secret',
        headers: {
          referer: 'https://scope.test/trips/shared/header-secret',
          accept: 'application/json',
        },
        query_string: {
          token: 'query-secret',
          next: '/trips/shared/next-secret',
        },
      },
      breadcrumbs: [
        {
          category: '/trips/shared/category-secret',
          message: 'https://scope.test/path?share_token=message-secret',
          data: {
            url: '/trips/shared/data-secret',
            status: 200,
          },
        },
      ],
    } as unknown as Sentry.ErrorEvent;

    expect(sanitizeSentryEvent(event)).toBe(event);
    expect(event).toMatchObject({
      message: 'Open /trips/shared/[redacted]',
      logentry: { message: 'https://scope.test/path?token=[redacted]' },
      transaction: '/trips/shared/[redacted]',
      request: {
        url: 'https://scope.test/path?shareToken=[redacted]',
        headers: {
          referer: 'https://scope.test/trips/shared/[redacted]',
          accept: 'application/json',
        },
        query_string: {
          token: '[redacted]',
          next: '/trips/shared/[redacted]',
        },
      },
      breadcrumbs: [
        {
          category: '/trips/shared/[redacted]',
          message: 'https://scope.test/path?share_token=[redacted]',
          data: {
            url: '/trips/shared/[redacted]',
            status: 200,
          },
        },
      ],
    });
  });

  it('supports string and tuple query formats without requiring optional event fields', () => {
    const stringQueryEvent = {
      request: { query_string: 'next=/trips/shared/string-secret' },
    } as Sentry.ErrorEvent;
    sanitizeSentryEvent(stringQueryEvent);
    expect(stringQueryEvent.request?.query_string).toBe('next=/trips/shared/[redacted]');

    const tupleQueryEvent = {
      request: {
        query_string: [
          ['share_token', 'tuple-secret'],
          ['next', '/trips/shared/next-secret'],
        ],
      },
    } as Sentry.ErrorEvent;
    sanitizeSentryEvent(tupleQueryEvent);
    expect(tupleQueryEvent.request?.query_string).toEqual([
      ['share_token', '[redacted]'],
      ['next', '/trips/shared/[redacted]'],
    ]);

    expect(sanitizeSentryEvent({} as unknown as Sentry.ErrorEvent)).toEqual({});
  });
});
