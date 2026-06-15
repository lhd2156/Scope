import type * as Sentry from '@sentry/vue';

const DEFAULT_SENTRY_TRACES_SAMPLE_RATE = 0.1;
const REDACTED_ROUTE_VALUE = '[redacted]';
const SHARE_ROUTE_TOKEN_PATTERN = /(\/trips\/shared\/)[^/?#\s]+/gi;
const SHARE_TOKEN_QUERY_PATTERN = /([?&](?:token|shareToken|share_token)=)[^&#\s]+/gi;
const SENSITIVE_QUERY_KEYS = new Set(['token', 'sharetoken', 'share_token']);

type SentryRequestData = NonNullable<Sentry.ErrorEvent['request']>;
type SentryQueryParams = SentryRequestData['query_string'];

export function parseSentrySampleRate(rawValue: string | undefined): number {
  if (!rawValue) {
    return DEFAULT_SENTRY_TRACES_SAMPLE_RATE;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
    ? parsed
    : DEFAULT_SENTRY_TRACES_SAMPLE_RATE;
}

function scrubSensitiveRouteValues(value: string): string {
  return value
    .replace(SHARE_ROUTE_TOKEN_PATTERN, `$1${REDACTED_ROUTE_VALUE}`)
    .replace(SHARE_TOKEN_QUERY_PATTERN, `$1${REDACTED_ROUTE_VALUE}`);
}

function scrubRecord<T extends Record<string, unknown>>(values: T, redactSensitiveKeys = false): T {
  let changed = false;
  const entries = Object.entries(values).map(([key, value]) => {
    if (redactSensitiveKeys && SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      changed = true;
      return [key, REDACTED_ROUTE_VALUE];
    }

    if (typeof value !== 'string') {
      return [key, value];
    }

    const scrubbedValue = scrubSensitiveRouteValues(value);
    changed ||= scrubbedValue !== value;
    return [key, scrubbedValue];
  });

  return changed ? (Object.fromEntries(entries) as T) : values;
}

function scrubQueryParams(queryParams: SentryQueryParams): SentryQueryParams {
  if (typeof queryParams === 'string') {
    return scrubSensitiveRouteValues(queryParams);
  }

  if (Array.isArray(queryParams)) {
    let changed = false;
    const nextQueryParams = queryParams.map(([key, value]) => {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
        changed = true;
        return [key, REDACTED_ROUTE_VALUE] as [string, string];
      }

      const scrubbedValue = scrubSensitiveRouteValues(value);
      changed ||= scrubbedValue !== value;
      return [key, scrubbedValue] as [string, string];
    });

    return changed ? nextQueryParams : queryParams;
  }

  return queryParams && typeof queryParams === 'object'
    ? scrubRecord(queryParams, true)
    : queryParams;
}

function scrubOptionalRecord<T extends Record<string, unknown>>(values: T | undefined): T | undefined {
  return values ? scrubRecord(values) : values;
}

function scrubOptionalString(value: string | undefined): string | undefined {
  return value ? scrubSensitiveRouteValues(value) : value;
}

export function sanitizeSentryEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.message) {
    event.message = scrubSensitiveRouteValues(event.message);
  }
  if (event.logentry?.message) {
    event.logentry.message = scrubSensitiveRouteValues(event.logentry.message);
  }
  if (event.transaction) {
    event.transaction = scrubSensitiveRouteValues(event.transaction);
  }

  if (event.request) {
    if (event.request.url) {
      event.request.url = scrubSensitiveRouteValues(event.request.url);
    }
    event.request.headers = scrubOptionalRecord(event.request.headers);
    event.request.query_string = scrubQueryParams(event.request.query_string);
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
      ...breadcrumb,
      category: scrubOptionalString(breadcrumb.category),
      message: scrubOptionalString(breadcrumb.message),
      data: scrubOptionalRecord(breadcrumb.data),
    }));
  }

  return event;
}
