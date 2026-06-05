import { describe, expect, it } from 'vitest';
import {
  buildInitialsAvatarUrl,
  buildPravatarAvatarUrl,
  getCategoryTravelPhoto,
  pickTravelPhotoForSeed,
} from '@/utils/travelMedia';

describe('demo media utilities', () => {
  it('picks stable category photos with an empty-seed fallback', () => {
    expect(pickTravelPhotoForSeed('food', '')).toBe(getCategoryTravelPhoto('food'));
    expect(pickTravelPhotoForSeed('culture', 'museum day')).toBe(pickTravelPhotoForSeed('culture', 'museum day'));
  });

  it('normalizes avatar ids and encodes initials avatar params', () => {
    expect(buildPravatarAvatarUrl(-20)).toContain('img=1');
    expect(buildPravatarAvatarUrl(500)).toContain('img=70');
    expect(buildPravatarAvatarUrl(Number.NaN)).toContain('img=1');

    const url = new URL(buildInitialsAvatarUrl('Maya Chen', '0f172a', 'ffffff'));
    expect(url.searchParams.get('name')).toBe('Maya Chen');
    expect(url.searchParams.get('background')).toBe('0f172a');
    expect(url.searchParams.get('color')).toBe('ffffff');
    expect(url.searchParams.get('bold')).toBe('true');
  });
});
