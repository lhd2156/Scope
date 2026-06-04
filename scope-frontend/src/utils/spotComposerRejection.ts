import { isApiClientError } from '@/services/api';
import type { ApiErrorDetail, SpotComposerRejection } from '@/types';

const BLOCKED_COPY_MESSAGE = 'This contains a blocked slur or hate term.';
const DEFAULT_SAVE_MESSAGE = 'Scope could not save that spot right now.';

const FIELD_ALIASES: Record<string, string> = {
  address: 'location',
  city: 'location',
  country: 'location',
  latitude: 'location',
  longitude: 'location',
  locationVerification: 'location',
  providerPlaceId: 'location',
  provider_place_id: 'location',
  verification: 'location',
  file: 'photos',
  photo: 'photos',
  captions: 'photos',
  isPublic: 'visibility',
  is_public: 'visibility',
  content: 'safety',
  non_field_errors: 'publish',
};

const FIELD_LABELS: Record<string, string> = {
  title: 'title',
  description: 'description',
  vibe: 'vibe',
  pillars: 'vibe pillars',
  photos: 'photos',
  location: 'place verification',
  visibility: 'visibility',
  safety: 'copy safety',
  publish: 'publish settings',
};

function normalizeField(field?: string): string {
  if (!field) {
    return 'publish';
  }

  const rootField = field.split('.')[0] ?? field;
  return FIELD_ALIASES[rootField] ?? rootField;
}

function isSafetyDetail(detail: ApiErrorDetail): boolean {
  const field = normalizeField(detail.field);
  return (
    ['title', 'description', 'vibe', 'pillars', 'photos', 'safety'].includes(field) &&
    /\b(?:blocked|slur|hate|abusive|identity)\b/i.test(detail.message)
  );
}

function uniqueFields(details: ApiErrorDetail[]): string[] {
  const fields = details.map((detail) => normalizeField(detail.field));
  return [...new Set(fields.length ? fields : ['publish'])];
}

function hasField(fields: string[], field: string): boolean {
  return fields.includes(field);
}

function readableFieldList(fields: string[]): string {
  const labels = fields.map((field) => FIELD_LABELS[field] ?? field.replace(/_/g, ' '));
  return [...new Set(labels)].slice(0, 4).join(', ');
}

function resolveMessage(details: ApiErrorDetail[], fallbackMessage: string): string {
  const fields = uniqueFields(details);

  if (details.some(isSafetyDetail)) {
    return BLOCKED_COPY_MESSAGE;
  }

  if (hasField(fields, 'location')) {
    return 'The place could not be verified as a real spot.';
  }

  if (hasField(fields, 'photos')) {
    return 'Public spots need at least one valid JPEG, PNG, or WebP photo.';
  }

  if (hasField(fields, 'pillars')) {
    return 'Choose 1 to 4 vibe pillars before publishing.';
  }

  if (hasField(fields, 'visibility')) {
    return 'This spot needs verified public publish settings before it can go live.';
  }

  const safeDetail = details.find((detail) => detail.message && detail.message.length <= 160);
  return safeDetail?.message || fallbackMessage || DEFAULT_SAVE_MESSAGE;
}

function resolveTitle(details: ApiErrorDetail[]): string {
  const fields = uniqueFields(details);

  if (details.some(isSafetyDetail)) {
    return 'Clean up the copy';
  }

  if (hasField(fields, 'location')) {
    return 'Verify a more exact place';
  }

  if (hasField(fields, 'photos')) {
    return 'Add a publish-ready photo';
  }

  if (hasField(fields, 'pillars')) {
    return 'Tune the vibe pillars';
  }

  return 'Needs a quick fix';
}

function resolveAction(details: ApiErrorDetail[]): string {
  const fields = uniqueFields(details);

  if (details.some(isSafetyDetail)) {
    return 'Edit the highlighted copy, then try publishing again.';
  }

  if (hasField(fields, 'location')) {
    return 'Move the pin, use a more specific address, then verify the place again.';
  }

  if (hasField(fields, 'photos')) {
    return 'Upload a valid photo or save this as a private draft.';
  }

  if (hasField(fields, 'pillars')) {
    return 'Select between 1 and 4 pillars that best match the spot.';
  }

  if (hasField(fields, 'visibility')) {
    return 'Switch to private draft or complete the public publish checks.';
  }

  const fieldList = readableFieldList(fields);
  return fieldList ? `Review ${fieldList}, then try again.` : 'Review the highlighted fields, then try again.';
}

export function buildSpotComposerRejection(error: unknown, fallbackMessage = DEFAULT_SAVE_MESSAGE): SpotComposerRejection {
  const details = isApiClientError(error) ? error.details ?? [] : [];
  const fields = uniqueFields(details);

  return {
    id: Date.now(),
    title: resolveTitle(details),
    message: resolveMessage(details, isApiClientError(error) ? error.message : fallbackMessage),
    action: resolveAction(details),
    fields,
  };
}
