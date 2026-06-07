import {
  sanitizeAvatarUrl,
  sanitizeFeedItem,
  sanitizeImageUrl,
  sanitizeMultilineText,
  sanitizeSpotFormSubmission,
  sanitizeSpotDetail,
  sanitizeSpotSummary,
  sanitizeTrip,
  sanitizeTripMember,
  sanitizeUserProfile,
} from '@/utils/sanitizers';
import type { FeedItem, SpotDetail, SpotFormSubmission, SpotSummary, Trip, TripMember, UserProfile } from '@/types';
import { getFeedPhotoFallback, getSpotPhotoFallback, getTripCoverFallback } from '@/utils/imageFallbacks';

describe('sanitizers', () => {
  it('normalizes multiline user content and strips control characters', () => {
    expect(sanitizeMultilineText('  Hello\u0000   world\n\n\nNext\tline  ')).toBe('Hello world\n\nNext line');
  });

  it('allows only safe image url schemes', () => {
    expect(sanitizeImageUrl('https://images.example.com/avatar.png')).toBe('https://images.example.com/avatar.png');
    expect(sanitizeImageUrl('blob:scope-preview')).toBe('blob:scope-preview');
    expect(sanitizeImageUrl('javascript:alert(1)')).toBeUndefined();
    expect(sanitizeImageUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBeUndefined();
  });

  it('hydrates display models with demo photo and avatar fallbacks when media is missing', () => {
    const user: UserProfile = {
      id: 'user-99',
      username: 'scope-fallback',
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

    // Users and trip members without an explicit avatar are sanitized to
    // an empty URL so the Avatar component renders its neutral
    // silhouette placeholder (Instagram style) instead of seeding a
    // random pravatar face that isn't actually theirs.
    expect(sanitizedUser.avatarUrl).toBe('');
    expect(sanitizedSpot.photoUrl).toBe(getSpotPhotoFallback('adventure'));
    expect(sanitizedTrip.coverImageUrl).toBe(getTripCoverFallback(trip));
    expect(sanitizedTrip.members[0]?.avatarUrl).toBe('');
    expect(sanitizedFeedItem.imageUrl).toBe(getFeedPhotoFallback(feedItem));
  });

  it('repairs handle-like display names when the real display name was collapsed into the username', () => {
    const sanitized = sanitizeUserProfile({
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louisdo',
      interests: [],
    });

    expect(sanitized.displayName).toBe('Louis Do');
  });

  it('strips generated stock faces while preserving user-provided profile photos', () => {
    const user: UserProfile = {
      id: 'user-1',
      username: 'louisdo',
      email: 'louis@example.com',
      displayName: 'Louis Do',
      avatarUrl: 'https://i.pravatar.cc/300?img=12',
      interests: [],
    };
    const member: TripMember = {
      id: 'member-1',
      displayName: 'Louis Do',
      avatarUrl: 'https://i.pravatar.cc/150?img=12',
    };

    expect(sanitizeUserProfile(user).avatarUrl).toBe('');
    expect(sanitizeTripMember(member).avatarUrl).toBe('');
    expect(sanitizeUserProfile({
      ...user,
      avatarUrl: 'https://images.example.com/louis.jpg',
    }).avatarUrl).toBe('https://images.example.com/louis.jpg');
  });

  it('keeps partial saved trips renderable instead of dropping the draft', () => {
    const sanitized = sanitizeTrip({
      id: 'enw',
      title: '  Evening North West route  ',
      destination: ' Dallas ',
      isPublic: false,
      startDate: '2026-05-07',
      endDate: '2026-05-07',
      spots: [
        {
          spotId: 'stop-1',
          title: '  First stop  ',
          latitude: 32.7767,
          longitude: -96.797,
          category: 'unknown-category' as never,
          reason: '  Matches\u0000 scenic   preference  ',
          confidence: 1.4,
        },
      ],
    } as Trip);

    expect(sanitized.id).toBe('enw');
    expect(sanitized.title).toBe('Evening North West route');
    expect(sanitized.destination).toBe('Dallas');
    expect(sanitized.members).toEqual([]);
    expect(sanitized.spots[0]?.category).toBe('other');
    expect(sanitized.spots[0]?.reason).toBe('Matches scenic preference');
    expect(sanitized.spots[0]?.confidence).toBe(1);
  });

  it('allows generated avatars only for explicit demo/mock people', () => {
    const user: UserProfile = {
      id: 'demo-user-1',
      username: 'maya',
      email: 'maya@example.com',
      displayName: 'Maya Chen',
      avatarUrl: 'https://i.pravatar.cc/300?img=32',
      interests: [],
    };
    const feedItem: FeedItem = {
      id: 'feed-demo-1',
      type: 'spot',
      actor: user,
      title: 'Maya pinned Botanic River Walk',
      excerpt: 'Demo activity with a visible community avatar.',
      createdAt: '2026-03-30T12:00:00Z',
      targetId: 'spot-demo-1',
    };

    expect(sanitizeAvatarUrl(user.avatarUrl)).toBeUndefined();
    expect(sanitizeAvatarUrl(user.avatarUrl, { allowGeneratedAvatar: true })).toBe(user.avatarUrl);
    expect(sanitizeUserProfile(user).avatarUrl).toBe('');
    expect(sanitizeUserProfile(user, { allowGeneratedAvatar: true }).avatarUrl).toBe(user.avatarUrl);
    expect(sanitizeFeedItem(feedItem).actor.avatarUrl).toBe('');
    expect(sanitizeFeedItem(feedItem, { allowGeneratedActorAvatar: true }).actor.avatarUrl).toBe(user.avatarUrl);
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
          file: new File(['scope'], 'cover.png', { type: 'image/png' }),
          previewUrl: 'blob:scope-upload',
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
    expect(sanitized.newPhotos[0]?.previewUrl).toBe('blob:scope-upload');
    expect(sanitized.newPhotos[0]?.caption).toBe('cover shot');
  });

  it('hydrates real content review rows without requiring mocked nested users', () => {
    const sanitized = sanitizeSpotDetail({
      id: 'spot-live-1',
      title: 'Live Water Garden',
      latitude: 32.7477,
      longitude: -97.3268,
      category: 'scenic',
      rating: '4.6',
      created_at: '2026-05-21T16:20:00Z',
      user_id: 'owner-live-user',
      liked: true,
      photos: [],
      reviews: [
        {
          id: 'review-live-1',
          spot_id: 'spot-live-1',
          user_id: '6f86f77d-aaaa-bbbb-cccc-123456789abc',
          rating: '4.6',
          comment: '  Real review from content API.  ',
          created_at: '2026-05-21T16:30:00Z',
        },
      ],
    } as unknown as SpotDetail);

    expect(sanitized.rating).toBe(4.6);
    expect(sanitized.createdAt).toBe('2026-05-21T16:20:00Z');
    expect(sanitized.userId).toBe('owner-live-user');
    expect(sanitized.liked).toBe(true);
    expect(sanitized.reviews[0]).toMatchObject({
      id: 'review-live-1',
      spotId: 'spot-live-1',
      rating: 4.6,
      comment: 'Real review from content API.',
      createdAt: '2026-05-21T16:30:00Z',
    });
    expect(sanitized.reviews[0]?.user).toMatchObject({
      id: '6f86f77d-aaaa-bbbb-cccc-123456789abc',
      username: 'traveler-6f86f77d',
      displayName: 'Traveler 6f86f77d',
      interests: [],
    });
  });

  it('resolves seeded repeated-digit review IDs to showcase personas', () => {
    const sanitized = sanitizeSpotDetail({
      id: 'spot-live-2',
      title: 'Seeded River Walk',
      latitude: 29.4241,
      longitude: -98.4936,
      category: 'scenic',
      rating: '4.7',
      created_at: '2026-05-22T16:20:00Z',
      photos: [],
      reviews: [
        {
          id: 'review-live-2',
          spot_id: 'spot-live-2',
          user_id: '44444444-4444-4444-4444-444444444444',
          rating: '4.8',
          comment: 'Worth saving because it anchors the route.',
          created_at: '2026-05-22T16:30:00Z',
        },
        {
          id: 'review-live-3',
          spot_id: 'spot-live-2',
          user_id: '66666666-6666-6666-6666-666666666666',
          rating: '4.7',
          comment: 'The kind of stop that makes the city feel less abstract.',
          created_at: '2026-05-22T16:35:00Z',
        },
      ],
    } as unknown as SpotDetail);

    expect(sanitized.reviews.map((review) => review.user.displayName)).toEqual([
      'Sofia Ramirez',
      'Aisha Bello',
    ]);
    expect(sanitized.reviews.map((review) => review.user.username)).toEqual([
      'sofia.ramirez',
      'aisha.bello',
    ]);
    expect(sanitized.reviews.map((review) => review.user.avatarUrl)).toEqual([
      expect.stringContaining('pexels-photo-1181686'),
      expect.stringContaining('pexels-photo-733872'),
    ]);
  });
});
