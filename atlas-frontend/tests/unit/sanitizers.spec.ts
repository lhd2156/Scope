import {
  sanitizeFeedItem,
  sanitizeImageUrl,
  sanitizeMultilineText,
  sanitizeSpotFormSubmission,
  sanitizeSpotSummary,
  sanitizeTrip,
  sanitizeUserProfile,
} from '@/utils/sanitizers';
import type { FeedItem, SpotFormSubmission, SpotSummary, Trip, UserProfile } from '@/types';

describe('sanitizers', () => {
  it('normalizes multiline user content and strips control characters', () => {
    expect(sanitizeMultilineText('  Hello\u0000   world\n\n\nNext\tline  ')).toBe('Hello world\n\nNext line');
  });

  it('allows only safe image url schemes', () => {
    expect(sanitizeImageUrl('https://images.example.com/avatar.png')).toBe('https://images.example.com/avatar.png');
    expect(sanitizeImageUrl('blob:atlas-preview')).toBe('blob:atlas-preview');
    expect(sanitizeImageUrl('javascript:alert(1)')).toBeUndefined();
    expect(sanitizeImageUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBeUndefined();
  });

  it('hydrates display models with demo photo and avatar fallbacks when media is missing', () => {
    const user: UserProfile = {
      id: 'user-99',
      username: 'atlas-fallback',
      email: 'fallback@example.com',
      displayName: 'Fallback Traveler',
      interests: ['scenic'],
    };

    const spot: SpotSummary = {
      id: 'spot-99',
      title: 'Fallback Canyon Stop',
      latitude: 35.1,
      longitude: -106.6,
      category: 'adventure',
      createdAt: '2026-03-30T12:00:00Z',
      rating: 4.7,
    };

    const trip: Trip = {
      id: 'trip-99',
      title: 'Fallback Route',
      destination: 'New Mexico',
      isPublic: true,
      startDate: '2026-04-02',
      endDate: '2026-04-03',
      members: [{ id: 'user-99', displayName: 'Fallback Traveler' }],
      spots: [
        {
          spotId: 'spot-99',
          title: 'Fallback Canyon Stop',
          latitude: 35.1,
          longitude: -106.6,
          category: 'adventure',
        },
      ],
    };

    const feedItem: FeedItem = {
      id: 'feed-99',
      type: 'trip',
      actor: user,
      title: 'Fallback Traveler planned Fallback Route',
      excerpt: 'A route with resilient media fallbacks.',
      createdAt: '2026-03-30T12:00:00Z',
      targetId: 'trip-99',
    };

    const sanitizedUser = sanitizeUserProfile(user);
    const sanitizedSpot = sanitizeSpotSummary(spot);
    const sanitizedTrip = sanitizeTrip(trip);
    const sanitizedFeedItem = sanitizeFeedItem(feedItem);

    expect(sanitizedUser.avatarUrl).toMatch(/^https:\/\/i\.pravatar\.cc\/150\?img=\d+$/);
    expect(sanitizedSpot.photoUrl).toBe('https://images.unsplash.com/photo-1527004013197-933c4bb611b3?w=800');
    expect(sanitizedTrip.coverImageUrl).toBe('https://images.unsplash.com/photo-1527004013197-933c4bb611b3?w=800');
    expect(sanitizedTrip.members[0]?.avatarUrl).toMatch(/^https:\/\/i\.pravatar\.cc\/150\?img=\d+$/);
    expect(sanitizedFeedItem.imageUrl).toBe('https://images.unsplash.com/photo-1527004013197-933c4bb611b3?w=800');
  });

  it('sanitizes spot submissions before they are persisted for display', () => {
    const submission: SpotFormSubmission = {
      spot: {
        title: '  <b>Rooftop\u0000 tacos</b>  ',
        description: 'First line\u0000\n\n\nSecond\tline',
        latitude: 32.7555,
        longitude: -97.3308,
        address: ' 123 Main St ',
        city: ' Fort Worth\u0000 ',
        country: ' us ',
        category: 'food',
        vibe: ' electric ',
        rating: 4.8,
        visitedAt: '2026-03-20',
        isPublic: true,
      },
      existingPhotos: [
        {
          id: 'photo-1',
          url: 'javascript:alert(1)',
          caption: ' hero\u0000 ',
        },
      ],
      newPhotos: [
        {
          id: 'upload-1',
          file: new File(['atlas'], 'cover.png', { type: 'image/png' }),
          previewUrl: 'blob:atlas-upload',
          caption: ' cover\u0000 shot ',
          mimeType: 'image/png',
          sizeBytes: 1024,
        },
      ],
    };

    const sanitized = sanitizeSpotFormSubmission(submission);

    expect(sanitized.spot.title).toBe('<b>Rooftop tacos</b>');
    expect(sanitized.spot.description).toBe('First line\n\nSecond line');
    expect(sanitized.spot.city).toBe('Fort Worth');
    expect(sanitized.spot.country).toBe('US');
    expect(sanitized.existingPhotos[0]?.url).toBe('');
    expect(sanitized.existingPhotos[0]?.caption).toBe('hero');
    expect(sanitized.newPhotos[0]?.previewUrl).toBe('blob:atlas-upload');
    expect(sanitized.newPhotos[0]?.caption).toBe('cover shot');
  });
});
