import { describe, expect, it } from 'vitest';
import {
  getCategoryTravelPhoto,
  pickTravelPhotoForSeed,
} from '@/utils/travelMedia';

describe('demo media utilities', () => {
  it('picks stable category photos with an empty-seed fallback', () => {
    expect(pickTravelPhotoForSeed('food', '')).toBe(getCategoryTravelPhoto('food'));
    expect(pickTravelPhotoForSeed('culture', 'museum day')).toBe(pickTravelPhotoForSeed('culture', 'museum day'));
  });

  it('keeps profile-avatar generation out of shared travel media helpers', async () => {
    expect(Object.keys(await import('@/utils/travelMedia'))).not.toContain('buildPravatarAvatarUrl');
    expect(Object.keys(await import('@/utils/travelMedia'))).not.toContain('buildInitialsAvatarUrl');
  });
});
