import { validateSpotFormInput, validateSpotPhotoFile } from '@/utils/validators';
import { inferSpotCategoryFromSignals } from '@/utils/spotCategoryInference';
import type { SpotFormInput } from '@/types';

const validInput: SpotFormInput = {
  title: 'Sunset Rooftop Tacos',
  description: 'Street tacos, skyline views, and a late-night crowd.',
  latitude: 32.7555,
  longitude: -97.3308,
  address: '123 Main St',
  city: 'Fort Worth',
  country: 'US',
  postalCode: '76102',
  category: 'food',
  vibe: 'electric',
  rating: 4.8,
  visitedAt: '2026-03-20',
  isPublic: true,
  pillars: ['hidden-gem'],
};

describe('spot validators', () => {
  it('flags invalid form values', () => {
    const result = validateSpotFormInput({
      ...validInput,
      title: '',
      description: '',
      address: '',
      city: '',
      country: '',
      pillars: [],
      vibe: '',
      latitude: 120,
      longitude: -200,
      rating: 6,
      visitedAt: 'not-a-date',
    });

    expect(result.title).toContain('Name the place');
    expect(result.description).toContain('short story');
    expect(result.address).toContain('street address');
    expect(result.city).toContain('city');
    expect(result.country).toContain('country');
    expect(result.pillars).toContain('vibe pillar');
    expect(result.latitude).toContain('between -90 and 90');
    expect(result.longitude).toContain('between -180 and 180');
    expect(result.rating).toContain('between 0 and 5');
    expect(result.visitedAt).toContain('Choose when you visited');
  });

  it('flags overlong copy, duplicate pillars, unsupported pillars, and oversized photos', () => {
    const overlongResult = validateSpotFormInput({
      ...validInput,
      title: 'T'.repeat(121),
      description: 'D'.repeat(2001),
      address: 'A'.repeat(161),
      city: 'C'.repeat(161),
      country: 'U'.repeat(161),
      postalCode: '7'.repeat(33),
      vibe: 'V'.repeat(49),
      pillars: ['hidden-gem', 'photo-worthy', 'date-night', 'group-friendly', 'quick-stop'],
    });

    expect(overlongResult.title).toContain('under 120');
    expect(overlongResult.description).toContain('under 2000');
    expect(overlongResult.address).toContain('under 160');
    expect(overlongResult.city).toContain('under 160');
    expect(overlongResult.country).toContain('under 160');
    expect(overlongResult.postalCode).toContain('under 32');
    expect(overlongResult.vibe).toContain('under 48');
    expect(overlongResult.pillars).toContain('up to 4');

    const unsupportedPillarResult = validateSpotFormInput({
      ...validInput,
      pillars: ['hidden-gem', 'made-up-pillar' as never],
    });
    expect(unsupportedPillarResult.pillars).toContain('approved list');

    const duplicatePillarResult = validateSpotFormInput({
      ...validInput,
      pillars: ['hidden-gem', 'hidden-gem', 'photo-worthy', 'date-night', 'group-friendly'],
    });
    expect(duplicatePillarResult.pillars).toContain('up to 4');

    const oversizedPhoto = new File(['x'.repeat(10 * 1024 * 1024 + 1)], 'huge.webp', {
      type: 'image/webp',
    });
    expect(validateSpotPhotoFile(oversizedPhoto)).toContain('10 MB or smaller');
  });

  it('accepts supported photo types and rejects unsupported files', () => {
    const validPhoto = new File(['scope'], 'spot.png', { type: 'image/png' });
    const invalidPhoto = new File(['scope'], 'spot.gif', { type: 'image/gif' });

    expect(validateSpotPhotoFile(validPhoto)).toBeNull();
    expect(validateSpotPhotoFile(invalidPhoto)).toContain('Only JPEG, PNG, and WebP');
  });

  it('infers spot categories from provider and typed place signals', () => {
    expect(inferSpotCategoryFromSignals(['coffee', 'Starbucks'])).toBe('food');
    expect(inferSpotCategoryFromSignals(['supermarket', 'Costco Wholesale'])).toBe('shopping');
    expect(inferSpotCategoryFromSignals(['bowling alley', 'Main Event'])).toBe('entertainment');
    expect(inferSpotCategoryFromSignals(['Six Flags Over Texas theme park'])).toBe('entertainment');
    expect(inferSpotCategoryFromSignals(['Sparkle car wash'])).toBe('other');
    expect(inferSpotCategoryFromSignals(['botanical garden trail'])).toBe('nature');
  });
});
