import { describe, expect, it } from 'vitest';
import { sanitizeInternalRouteTarget } from '@/utils/navigationSafety';

describe('navigationSafety', () => {
  it('allows same-app paths with query strings and hashes', () => {
    expect(sanitizeInternalRouteTarget('/trips/new?assistant=open#route', '/map')).toBe('/trips/new?assistant=open#route');
  });

  it('falls back for external or scheme-like redirect targets', () => {
    expect(sanitizeInternalRouteTarget('https://evil.example/phish', '/map')).toBe('/map');
    expect(sanitizeInternalRouteTarget('//evil.example/phish', '/map')).toBe('/map');
    expect(sanitizeInternalRouteTarget('javascript:alert(1)', '/map')).toBe('/map');
  });

  it('can drop unsafe optional action links instead of navigating to a fallback', () => {
    expect(sanitizeInternalRouteTarget('https://evil.example/phish', '')).toBe('');
  });

  it('normalizes malformed inputs and unsafe fallbacks to a same-app route', () => {
    expect(sanitizeInternalRouteTarget(null, '/map')).toBe('/map');
    expect(sanitizeInternalRouteTarget('/trips\\admin', '/map')).toBe('/map');
    expect(sanitizeInternalRouteTarget('/safe', 'https://evil.example/phish')).toBe('/safe');
    expect(sanitizeInternalRouteTarget('not-a-route', '//evil.example/phish')).toBe('/');
  });

  it('falls back if URL parsing returns an external or malformed normalized target', () => {
    const originalUrl = globalThis.URL;
    class ExternalUrl {
      origin = 'https://evil.example';
      pathname = '/phish';
      search = '';
      hash = '';
    }
    vi.stubGlobal('URL', ExternalUrl);

    expect(sanitizeInternalRouteTarget('/profile', '/map')).toBe('/map');

    class ProtocolRelativeUrl {
      origin = 'https://scope.local';
      pathname = '//evil.example/phish';
      search = '';
      hash = '';
    }
    vi.stubGlobal('URL', ProtocolRelativeUrl);

    expect(sanitizeInternalRouteTarget('/profile', '/map')).toBe('/map');

    class ThrowingUrl {
      constructor() {
        throw new Error('URL parser unavailable');
      }
    }
    vi.stubGlobal('URL', ThrowingUrl);

    expect(sanitizeInternalRouteTarget('/profile', '/map')).toBe('/map');
    vi.stubGlobal('URL', originalUrl);
  });
});
