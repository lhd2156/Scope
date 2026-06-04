import type { SpotFormInput, SpotPillar } from '@/types';

export const MAX_SPOT_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_SPOT_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const SPOT_PHOTO_ACCEPT = '.jpg,.jpeg,.png,.webp';
export const ALLOWED_SPOT_PILLARS: readonly SpotPillar[] = [
  'hidden-gem',
  'photo-worthy',
  'date-night',
  'group-friendly',
  'solo-friendly',
  'family-friendly',
  'budget-friendly',
  'worth-the-drive',
  'quick-stop',
  'calm',
  'lively',
  'luxury-feel',
] as const;

const TITLE_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 2000;
const LOCATION_FIELD_MAX_LENGTH = 160;
const POSTAL_CODE_MAX_LENGTH = 32;
const VIBE_MAX_LENGTH = 48;

type SpotFormField = keyof SpotFormInput | 'photos' | 'locationVerification' | 'safety';

export type SpotFormErrors = Partial<Record<SpotFormField, string>>;

export function validateSpotPhotoFile(file: File): string | null {
  if (!ALLOWED_SPOT_PHOTO_TYPES.includes(file.type as (typeof ALLOWED_SPOT_PHOTO_TYPES)[number])) {
    return 'Only JPEG, PNG, and WebP photos are supported.';
  }

  if (file.size > MAX_SPOT_PHOTO_SIZE_BYTES) {
    return 'Each upload must be 10 MB or smaller.';
  }

  return null;
}

export function validateSpotFormInput(input: SpotFormInput): SpotFormErrors {
  const errors: SpotFormErrors = {};
  const title = input.title.trim();
  const description = input.description.trim();
  const address = input.address.trim();
  const city = input.city.trim();
  const country = input.country.trim();
  const postalCode = input.postalCode?.trim() ?? '';
  const vibe = input.vibe.trim();

  if (!title) {
    errors.title = 'Name the place.';
  } else if (title.length > TITLE_MAX_LENGTH) {
    errors.title = `Keep the place name under ${TITLE_MAX_LENGTH} characters.`;
  }

  if (!description) {
    errors.description = 'Add a short story so travelers know why this stop matters.';
  } else if (description.length > DESCRIPTION_MAX_LENGTH) {
    errors.description = `Keep the description under ${DESCRIPTION_MAX_LENGTH} characters.`;
  }

  if (!address) {
    errors.address = 'Add a street address or landmark.';
  } else if (address.length > LOCATION_FIELD_MAX_LENGTH) {
    errors.address = `Keep the address under ${LOCATION_FIELD_MAX_LENGTH} characters.`;
  }

  if (!city) {
    errors.city = 'Add the city for discovery filters.';
  } else if (city.length > LOCATION_FIELD_MAX_LENGTH) {
    errors.city = `Keep the city under ${LOCATION_FIELD_MAX_LENGTH} characters.`;
  }

  if (!country) {
    errors.country = 'Add the country or ISO region code.';
  } else if (country.length > LOCATION_FIELD_MAX_LENGTH) {
    errors.country = `Keep the country under ${LOCATION_FIELD_MAX_LENGTH} characters.`;
  }

  if (postalCode.length > POSTAL_CODE_MAX_LENGTH) {
    errors.postalCode = `Keep the ZIP or postal code under ${POSTAL_CODE_MAX_LENGTH} characters.`;
  }

  if (vibe.length > VIBE_MAX_LENGTH) {
    errors.vibe = `Keep the vibe under ${VIBE_MAX_LENGTH} characters.`;
  }

  const pillars = Array.isArray(input.pillars) ? input.pillars : [];
  const uniquePillars = new Set(pillars);
  if (!pillars.length) {
    errors.pillars = 'Choose at least one vibe pillar.';
  } else if (pillars.length > 4 || uniquePillars.size > 4) {
    errors.pillars = 'Choose up to 4 vibe pillars.';
  } else if (pillars.some((pillar) => !ALLOWED_SPOT_PILLARS.includes(pillar))) {
    errors.pillars = 'Choose pillars from the approved list.';
  }

  if (Number.isNaN(new Date(input.visitedAt).getTime())) {
    errors.visitedAt = 'Choose when you visited this spot.';
  }

  if (input.rating < 0 || input.rating > 5) {
    errors.rating = 'Ratings must stay between 0 and 5.';
  }

  if (input.latitude < -90 || input.latitude > 90) {
    errors.latitude = 'Latitude must be between -90 and 90.';
  }

  if (input.longitude < -180 || input.longitude > 180) {
    errors.longitude = 'Longitude must be between -180 and 180.';
  }

  return errors;
}
