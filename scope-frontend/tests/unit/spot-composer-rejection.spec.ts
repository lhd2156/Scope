import { ApiClientError } from '@/services/api';
import { buildSpotComposerRejection } from '@/utils/spotComposerRejection';

describe('spot composer rejection mapping', () => {
  it('maps backend safety details to safe retry copy without echoing the blocked term', () => {
    const rejection = buildSpotComposerRejection(
      new ApiClientError({
        message: 'Invalid input data',
        details: [
          {
            field: 'title',
            message: 'The blocked slur is hidden-token',
          },
        ],
      }),
    );

    expect(rejection.title).toBe('Clean up the copy');
    expect(rejection.message).toBe('This contains a blocked slur or hate term.');
    expect(JSON.stringify(rejection)).not.toContain('hidden-token');
  });

  it('maps backend location failures to an actionable place verification retry', () => {
    const rejection = buildSpotComposerRejection(
      new ApiClientError({
        message: 'Invalid input data',
        details: [
          {
            field: 'location',
            message: 'Provider result was too far away',
          },
        ],
      }),
    );

    expect(rejection.fields).toEqual(['location']);
    expect(rejection.title).toBe('Verify a more exact place');
    expect(rejection.action).toContain('Move the pin');
  });

  it('maps publish-specific fields to stable user-facing recovery paths', () => {
    const photos = buildSpotComposerRejection(new ApiClientError({
      message: 'Invalid input data',
      details: [{ field: 'file', message: 'Unsupported upload type' }],
    }));
    const pillars = buildSpotComposerRejection(new ApiClientError({
      message: 'Invalid input data',
      details: [{ field: 'pillars', message: 'Select at least one pillar' }],
    }));
    const visibility = buildSpotComposerRejection(new ApiClientError({
      message: 'Invalid input data',
      details: [{ field: 'is_public', message: 'Public publish checks failed' }],
    }));

    expect(photos).toMatchObject({
      title: 'Add a publish-ready photo',
      message: 'Public spots need at least one valid JPEG, PNG, or WebP photo.',
      action: 'Upload a valid photo or save this as a private draft.',
      fields: ['photos'],
    });
    expect(pillars).toMatchObject({
      title: 'Tune the vibe pillars',
      message: 'Choose 1 to 4 vibe pillars before publishing.',
      action: 'Select between 1 and 4 pillars that best match the spot.',
      fields: ['pillars'],
    });
    expect(visibility).toMatchObject({
      title: 'Needs a quick fix',
      message: 'This spot needs verified public publish settings before it can go live.',
      action: 'Switch to private draft or complete the public publish checks.',
      fields: ['visibility'],
    });
  });

  it('falls back to concise backend detail copy, readable field lists, and default save copy', () => {
    const customField = buildSpotComposerRejection(new ApiClientError({
      message: 'Validation failed',
      details: [
        { field: 'best_time', message: 'Best time must be a real value.' },
        { field: 'non_field_errors', message: 'Spot could not be published.' },
      ],
    }));
    const noDetails = buildSpotComposerRejection(new ApiClientError({
      message: '',
      details: [],
    }));
    const nonApi = buildSpotComposerRejection(new Error('Network exploded'), '');

    expect(customField).toMatchObject({
      title: 'Needs a quick fix',
      message: 'Best time must be a real value.',
      action: 'Review best time, publish settings, then try again.',
      fields: ['best_time', 'publish'],
    });
    expect(noDetails).toMatchObject({
      title: 'Needs a quick fix',
      message: 'Scope could not save that spot right now.',
      action: 'Review publish settings, then try again.',
      fields: ['publish'],
    });
    expect(nonApi).toMatchObject({
      message: 'Scope could not save that spot right now.',
      fields: ['publish'],
    });
  });
});
