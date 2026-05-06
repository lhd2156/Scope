import { validateSpotFormInput, validateSpotPhotoFile } from '@/utils/validators';
import type { SpotFormInput } from '@/types';

const validInput: SpotFormInput = {
  title: 'Sunset Rooftop Tacos',
  description: 'Street tacos, skyline views, and a late-night crowd.',
  latitude: 32.7555,
  longitude: -97.3308,
  address: '123 Main St',
  city: 'Fort Worth',
  country: 'US',
  category: 'food',
  vibe: 'electric',
  rating: 4.8,
  visitedAt: '2026-03-20',
  isPublic: true,
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
      vibe: '',
      latitude: 120,
      longitude: -200,
      rating: 6,
      visitedAt: 'not-a-date',
    });

    expect(result.title).toContain('clear title');
    expect(result.description).toContain('short story');
    expect(result.address).toContain('street address');
    expect(result.city).toContain('city');
    expect(result.country).toContain('country');
    expect(result.vibe).toContain('vibe');
    expect(result.latitude).toContain('between -90 and 90');
    expect(result.longitude).toContain('between -180 and 180');
    expect(result.rating).toContain('between 0 and 5');
    expect(result.visitedAt).toContain('Choose when you visited');
  });

  it('accepts supported photo types and rejects unsupported files', () => {
    const validPhoto = new File(['scope'], 'spot.png', { type: 'image/png' });
    const invalidPhoto = new File(['scope'], 'spot.gif', { type: 'image/gif' });

    expect(validateSpotPhotoFile(validPhoto)).toBeNull();
    expect(validateSpotPhotoFile(invalidPhoto)).toContain('Only JPEG, PNG, and WebP');
  });
});
