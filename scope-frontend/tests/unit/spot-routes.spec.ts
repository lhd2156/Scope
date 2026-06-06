import { buildSpotPath, buildSpotSlug, isUuidLike, normalizeSpotRouteParam } from '@/utils/spotRoutes';

describe('spot route helpers', () => {
  it('builds readable spot slugs while preserving id fallbacks', () => {
    expect(buildSpotPath({
      id: '90000000-0000-0000-0000-000000000003',
      title: 'San Antonio River Walk Blue Hour',
      city: 'San Antonio',
      country: 'US',
    })).toBe('/spots/san-antonio-river-walk-blue-hour-san-antonio');

    expect(buildSpotSlug({
      id: 'fallback-id',
      title: '   ',
    })).toBe('fallback-id');
  });

  it('normalizes route params without crashing on malformed encoding', () => {
    expect(isUuidLike('90000000-0000-0000-0000-000000000003')).toBe(true);
    expect(isUuidLike('river-walk-blue-hour')).toBe(false);
    expect(normalizeSpotRouteParam('river%20walk')).toBe('river walk');
    expect(normalizeSpotRouteParam('%E0%A4%A')).toBe('%E0%A4%A');
  });
});
