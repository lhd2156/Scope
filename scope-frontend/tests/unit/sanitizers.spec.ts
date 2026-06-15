import {
  sanitizeAuthForm,
  sanitizeAuthPayload,
  sanitizeAvatarUrl,
  sanitizeFeedItem,
  sanitizeFriendRequest,
  sanitizeImageUrl,
  sanitizeItinerary,
  sanitizeMapPoint,
  sanitizeMultilineText,
  sanitizeNotificationItem,
  sanitizeNotificationPreference,
  sanitizeRegisterForm,
  sanitizeReview,
  sanitizeSpotFormSubmission,
  sanitizeSpotDetail,
  sanitizeSpotSummary,
  sanitizeTrip,
  sanitizeTripMember,
  sanitizeTripSpot,
  sanitizeUserProfile,
} from '@/utils/sanitizers';
import type {
  AuthPayload,
  FeedItem,
  FriendRequest,
  Itinerary,
  MapPoint,
  NotificationItem,
  NotificationPreference,
  RegisterForm,
  Review,
  SpotDetail,
  SpotFormSubmission,
  SpotSummary,
  Trip,
  TripMember,
  TripSpot,
  UserProfile,
} from '@/types';
import { getFeedPhotoFallback, getSpotPhotoFallback, getTripCoverFallback, resolveSpotPhotoUrl } from '@/utils/imageFallbacks';

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

  it('resizes Pexels spot photos for card-sized surfaces', () => {
    const resolvedUrl = resolveSpotPhotoUrl(
      'scenic',
      'https://images.pexels.com/photos/32448258/pexels-photo-32448258.jpeg?auto=compress&cs=tinysrgb&w=1600',
      720,
    );
    const url = new URL(resolvedUrl);

    expect(url.hostname).toBe('images.pexels.com');
    expect(url.searchParams.get('auto')).toBe('compress');
    expect(url.searchParams.get('cs')).toBe('tinysrgb');
    expect(url.searchParams.get('w')).toBe('720');
  });

  it('hydrates display models with demo photo and avatar fallbacks when media is missing', () => {
    const user: UserProfile = {
      id: 'user-99',
      username: 'scope-fallback',
      email: 'fallback@example.com',
      displayName: 'Fallback Traveler',
      interests: ['scenic'],
    };

    const spot: SpotSummary & { admin_area?: string; state_code?: string } = {
      id: 'spot-99',
      title: 'Fallback Canyon Stop',
      latitude: 35.1,
      longitude: -106.6,
      category: 'adventure',
      createdAt: '2026-03-30T12:00:00Z',
      rating: 4.7,
      state_code: 'NM',
      admin_area: 'New Mexico',
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
    expect(sanitizedSpot.stateCode).toBe('NM');
    expect(sanitizedSpot.adminArea).toBe('New Mexico');
    expect(sanitizedTrip.coverImageUrl).toBe(getTripCoverFallback(trip));
    expect(sanitizedTrip.members[0]?.avatarUrl).toBe('');
    expect(sanitizedFeedItem.imageUrl).toBe(getFeedPhotoFallback(feedItem));
  });

  it('normalizes review feed activity from wire and demo feed signals', () => {
    const actor: UserProfile = {
      id: 'user-reviewer',
      username: 'reviewer',
      email: 'reviewer@example.com',
      displayName: 'Sofia Ramirez',
      interests: [],
    };

    const wireReview = sanitizeFeedItem({
      id: 'feed-wire-review',
      type: 'spot.reviewed',
      activity_type: 'spot.reviewed',
      actor,
      title: 'Sofia Ramirez reviewed Fort Worth Water Gardens',
      excerpt: '4.8/5: Worth saving because it gives the map a clear anchor.',
      createdAt: '2026-03-30T12:00:00Z',
      targetId: 'spot-water-gardens',
    } as unknown as FeedItem);

    const demoReview = sanitizeFeedItem({
      id: 'feed-demo-review',
      type: 'spot',
      activityType: 'review-posted',
      actor,
      title: 'Reviewed Mule Alley Mercantile Row',
      excerpt: 'A polished Stockyards retail lane.',
      createdAt: '2026-03-30T12:00:00Z',
      targetId: 'demo-spot-1',
    } as unknown as FeedItem);

    expect(wireReview.type).toBe('review');
    expect(demoReview.type).toBe('review');
  });

  it('redacts anonymous review identity and preserves the anonymous flag', () => {
    const sanitized = sanitizeReview({
      id: 'review-anonymous',
      spot_id: 'spot-1',
      user_id: '22222222-2222-4222-8222-222222222222',
      rating: '4.5',
      comment: '  Private but useful review note.  ',
      isAnonymous: true,
      created_at: '2026-06-08T00:00:00Z',
    } as unknown as Review);

    expect(sanitized.isAnonymous).toBe(true);
    expect(sanitized.user.id).toBe('anonymous');
    expect(sanitized.user.displayName).toBe('Anonymous traveler');
    expect(sanitized.user.avatarUrl).toBe('');
    expect(sanitized.comment).toBe('Private but useful review note.');
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

  it('blocks generated avatar hosts even when old callers request an exception', () => {
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
    expect(sanitizeAvatarUrl(user.avatarUrl, { allowGeneratedAvatar: true })).toBeUndefined();
    expect(sanitizeUserProfile(user).avatarUrl).toBe('');
    expect(sanitizeUserProfile(user, { allowGeneratedAvatar: true }).avatarUrl).toBe('');
    expect(sanitizeFeedItem(feedItem).actor.avatarUrl).toBe('');
    expect(sanitizeFeedItem(feedItem, { allowGeneratedActorAvatar: true }).actor.avatarUrl).toBe('');
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

  it('applies safe identity and review defaults to incomplete legacy payloads', () => {
    expect(sanitizeAuthForm({
      email: ' Traveler@Example.COM ',
      password: 'secret',
    })).toEqual({
      email: 'traveler@example.com',
      password: 'secret',
    });
    expect(sanitizeAuthForm({
      email: ' traveler.handle ',
      password: 'secret',
    })).toEqual({
      email: 'traveler.handle',
      password: 'secret',
    });

    expect(sanitizeRegisterForm({
      username: '  ',
      email: undefined,
      password: null,
      displayName: '',
      firstName: '',
      lastName: '',
      phoneNumber: '',
      dateOfBirth: undefined,
    } as unknown as RegisterForm)).toMatchObject({
      username: '',
      email: '',
      password: '',
      displayName: 'New explorer',
      dateOfBirth: '',
    });
    expect(sanitizeRegisterForm({
      username: 'traveler',
      email: 'traveler@example.com',
      password: 'secret',
      displayName: 'Traveler',
      firstName: '',
      lastName: '',
      phoneNumber: '',
      dateOfBirth: '1995-06-08',
    })).toMatchObject({
      dateOfBirth: '1995-06-08',
    });

    expect(sanitizeAuthPayload({
      username: '',
      email: undefined,
      displayName: '',
      interests: null,
      showActivityStatus: 'yes',
      profileVisibility: 'everyone',
      accessToken: null,
      refreshToken: undefined,
    } as unknown as AuthPayload)).toMatchObject({
      username: 'scope-user',
      displayName: 'New explorer',
      interests: undefined,
      showActivityStatus: true,
      profileVisibility: 'friends',
      accessToken: '',
      refreshToken: '',
    });
    expect(sanitizeAuthPayload({
      username: 'traveler',
      email: 'traveler@example.com',
      displayName: 'Traveler',
      interests: [' food ', ''],
      showActivityStatus: false,
      profileVisibility: 'public',
      accessToken: ' token ',
      refreshToken: ' refresh ',
    } as AuthPayload)).toMatchObject({
      interests: ['food'],
      showActivityStatus: false,
      profileVisibility: 'public',
      accessToken: 'token',
      refreshToken: 'refresh',
    });

    expect(sanitizeUserProfile({
      id: '',
      username: '',
      email: '',
      displayName: '',
      interests: [],
      profileVisibility: 'private',
    })).toMatchObject({
      username: 'scope-user',
      displayName: 'New explorer',
      profileVisibility: 'private',
    });

    expect(sanitizeReview(null as unknown as Review)).toMatchObject({
      id: '',
      spotId: '',
      rating: 0,
      comment: '',
      user: {
        id: 'unknown-reviewer',
        username: 'traveler-unknown-',
        displayName: 'Traveler unknown-',
      },
    });

    expect(sanitizeReview({
      id: 'review-wire',
      spot_id: 'spot-wire',
      userId: 'wire-user',
      username: 'wire.handle',
      display_name: 'Wire Traveler',
      avatar_url: '/media/wire.png',
      rating: '4.5',
      comment: '  Legacy review  ',
      created_at: '2026-06-08T12:00:00Z',
      sentiment_score: '0.7',
    } as unknown as Review)).toMatchObject({
      id: 'review-wire',
      spotId: 'spot-wire',
      rating: 4.5,
      comment: 'Legacy review',
      sentiment_score: 0.7,
      user: {
        id: 'wire-user',
        username: 'wire.handle',
        displayName: 'Wire Traveler',
      },
    });
  });

  it('prefers backend review averages over the creator seed rating when present', () => {
    expect(sanitizeSpotSummary({
      id: 'spot-average',
      title: 'Average Updated Spot',
      description: 'Review average should drive public rating.',
      latitude: 32.7,
      longitude: -97.3,
      address: '1 Main',
      city: 'Fort Worth',
      country: 'US',
      category: 'food',
      rating: 4.9,
      average_rating: '4.25',
      photoUrl: '',
      createdAt: '2026-03-29T10:00:00Z',
    } as unknown as SpotSummary).rating).toBe(4.25);
  });

  it('normalizes incomplete trip and spot wire variants without inventing unsafe values', () => {
    expect(sanitizeSpotSummary({
      id: 'wire-spot',
      title: '',
      latitude: 91,
      longitude: -181,
      category: 'invalid',
      average_rating: 'bad',
      province: ' Ontario ',
      region: ' North ',
      state: ' Texas ',
      postal_code: ' 76102 ',
      created_at: '2026-06-08T12:00:00Z',
      is_public: false,
    } as unknown as SpotSummary)).toMatchObject({
      title: 'Untitled spot',
      category: 'other',
      rating: 0,
      province: 'Ontario',
      region: 'North',
      state: 'Texas',
      postalCode: '76102',
      isPublic: false,
    });

    expect(sanitizeMapPoint({
      id: 'map-empty',
      title: '',
      latitude: 0,
      longitude: 0,
      category: 'other',
    } as MapPoint).title).toBe('Untitled spot');

    const spotIdVariants = [
      { spotId: 'camel-id' },
      { spot_id: 'snake-id' },
      { spot: 'nested-id' },
      {},
    ];
    expect(spotIdVariants.map((variant) => sanitizeTripSpot({
      ...variant,
      title: '',
      spot_title: '',
      latitude: 'bad',
      longitude: null,
      category: 'invalid',
    } as unknown as TripSpot).spotId)).toEqual([
      'camel-id',
      'snake-id',
      'nested-id',
      '',
    ]);

    expect(sanitizeTripMember({
      id: '',
      userId: 'camel-user',
      displayName: '',
      display_name: 'Legacy Member',
      role: 'editor',
    } as unknown as TripMember)).toMatchObject({
      id: 'camel-user',
      displayName: 'Legacy Member',
      status: 'editor',
      inviteStatus: 'accepted',
    });
    expect(sanitizeTripMember({
      id: 'fallback-id',
      displayName: '',
    } as TripMember).displayName).toBe('Traveler fallback');

    expect(sanitizeItinerary({
      destination: '',
      days: [{ dayNumber: 1, spots: null }],
      weatherForecast: '',
    } as unknown as Itinerary)).toMatchObject({
      destination: 'Scope destination',
      days: [{ spots: [] }],
      weatherForecast: 'Forecast pending.',
    });
    expect(sanitizeItinerary({
      destination: '',
      days: null,
      weatherForecast: '',
    } as unknown as Itinerary).days).toEqual([]);

    expect(sanitizeTrip({
      id: 'legacy-trip',
      title: '',
      destination: '',
      is_public: false,
      start_date: '2026-06-08',
      end_date: '2026-06-09',
      created_at: '2026-06-01T00:00:00Z',
      updated_at: '2026-06-02T00:00:00Z',
      spots: null,
      members: null,
    } as unknown as Trip)).toMatchObject({
      title: 'Untitled trip',
      destination: 'Scope destination',
      isPublic: false,
      startDate: '2026-06-08',
      endDate: '2026-06-09',
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-02T00:00:00Z',
      spots: [],
      members: [],
    });
  });

  it('normalizes nested feed, notification, preference, and upload wire fallbacks', () => {
    const nestedFeedBase = {
      id: 'nested-feed',
      type: '',
      title: '',
      excerpt: '',
      createdAt: '',
      targetId: '',
      actor: null,
    };
    expect(sanitizeFeedItem({
      ...nestedFeedBase,
      activity_type: 'trip.created',
      item: {
        id: 'trip-nested',
        title: 'Desert loop',
        creator_id: 'creator-wire',
        description: 'Nested trip',
        created_at: '2026-06-08T00:00:00Z',
        cover_photo_url: 'https://images.example.com/trip.jpg',
      },
    } as unknown as FeedItem)).toMatchObject({
      type: 'trip',
      title: 'Planned Desert loop',
      targetId: 'trip-nested',
      createdAt: '2026-06-08T00:00:00Z',
      actor: { id: 'creator-wire' },
    });
    expect(sanitizeFeedItem({
      ...nestedFeedBase,
      activityType: 'review-posted',
      item: { title: 'Museum review' },
    } as unknown as FeedItem).title).toBe('Reviewed Museum review');
    expect(sanitizeFeedItem({
      ...nestedFeedBase,
      item: { title: 'River overlook' },
    } as unknown as FeedItem).title).toBe('Pinned River overlook');
    expect(sanitizeFeedItem({
      ...nestedFeedBase,
      item: 'invalid',
    } as unknown as FeedItem)).toMatchObject({
      title: 'Scope activity',
      targetId: '',
      createdAt: '1970-01-01T00:00:00.000Z',
    });
    expect(sanitizeFeedItem({
      ...nestedFeedBase,
      created_at: '2026-06-07T00:00:00Z',
      target_path: '/spots/feed-wire',
      image_url: '/media/feed-wire.jpg',
      item: {
        id: 'feed-wire',
        user_id: 'nested-user',
      },
    } as unknown as FeedItem)).toMatchObject({
      createdAt: '2026-06-07T00:00:00Z',
      targetPath: '/spots/feed-wire',
      actor: { id: 'nested-user' },
    });

    expect(sanitizeNotificationItem({
      id: 'notification-wire',
      title: '',
      body: '',
      type: '',
      is_read: true,
      created_at: '2026-06-08T00:00:00Z',
      priority: 'high',
      metadata_json: '{"safe":true}',
      read_at: '2026-06-08T00:01:00Z',
      expires_at: '2026-07-08T00:00:00Z',
      archived_at: '2026-06-09T00:00:00Z',
    } as unknown as NotificationItem)).toMatchObject({
      title: 'Scope update',
      body: 'A new Scope update is available.',
      type: 'general',
      isRead: true,
      priority: 'high',
      metadataJson: '{"safe":true}',
      readAt: '2026-06-08T00:01:00Z',
      expiresAt: '2026-07-08T00:00:00Z',
      archivedAt: '2026-06-09T00:00:00Z',
    });

    expect(sanitizeNotificationPreference({
      category: '',
      user_id: 'wire-user',
      in_app_enabled: false,
      push_enabled: false,
      email_enabled: true,
      digest_cadence: '',
      quiet_hours_start_minutes: '60',
      quiet_hours_end_minutes: '120',
      time_zone_id: '',
    } as unknown as NotificationPreference)).toMatchObject({
      userId: 'wire-user',
      category: 'general',
      inAppEnabled: false,
      pushEnabled: false,
      emailEnabled: true,
      digestCadence: 'daily',
      quietHoursStartMinutes: 60,
      quietHoursEndMinutes: 120,
      timeZoneId: 'UTC',
    });
    expect(sanitizeNotificationPreference({
      userId: 'camel-user',
      category: 'trip',
      inAppEnabled: true,
      pushEnabled: true,
      emailEnabled: false,
      digestCadence: 'weekly',
      quietHoursStartMinutes: 300,
      quietHoursEndMinutes: 420,
      timeZoneId: 'America/Chicago',
    })).toMatchObject({
      userId: 'camel-user',
      category: 'trip',
      digestCadence: 'weekly',
      timeZoneId: 'America/Chicago',
    });

    expect(sanitizeNotificationItem({
      id: 'notification-camel',
      title: 'Camel notification',
      body: 'Camel body',
      type: 'trip',
      isRead: false,
      createdAt: '2026-06-08T00:00:00Z',
      metadataJson: '{"camel":true}',
      readAt: '2026-06-08T00:02:00Z',
      expiresAt: '2026-07-08T00:00:00Z',
      archivedAt: '2026-06-10T00:00:00Z',
    } as NotificationItem)).toMatchObject({
      metadataJson: '{"camel":true}',
      readAt: '2026-06-08T00:02:00Z',
      expiresAt: '2026-07-08T00:00:00Z',
      archivedAt: '2026-06-10T00:00:00Z',
    });

    expect(sanitizeFriendRequest({
      id: 'friend-request',
      user: {
        id: 'friend-user',
        username: 'friend',
        email: 'friend@example.com',
        displayName: 'Friend User',
        interests: [],
      },
      note: '  Hello\u0000 there  ',
    } as FriendRequest).note).toBe('Hello there');

    expect(sanitizeSpotFormSubmission({
      spot: {
        title: '',
        description: '',
        latitude: 0,
        longitude: 0,
        address: '',
        city: '',
        country: '',
        category: 'other',
        vibe: '',
        rating: 0,
        visitedAt: '',
        isPublic: true,
      },
      existingPhotos: [{ id: 'existing', url: '/media/existing.jpg', caption: '' }],
      newPhotos: [],
    }).existingPhotos[0]?.caption).toBe('Untitled spot');

    expect(sanitizeTripSpot({
      spotId: 'legacy-title-id',
      title: '',
      spot_title: ' Legacy stop title ',
      latitude: 0,
      longitude: 0,
      category: 'other',
    } as unknown as TripSpot).title).toBe('Legacy stop title');
    expect(sanitizeTripMember({
      id: '',
      displayName: '',
    } as TripMember).displayName).toBe('New explorer');
    expect(sanitizeTripMember({
      id: 'active-member',
      displayName: 'Active Member',
      inviteStatus: 'pending',
      presence: 'active',
    })).toMatchObject({
      inviteStatus: 'pending',
      presence: 'active',
    });

    expect(sanitizeSpotDetail({
      id: 'empty-detail',
      title: 'Empty detail',
      latitude: 0,
      longitude: 0,
      category: 'other',
      photos: null,
      reviews: null,
    } as unknown as SpotDetail)).toMatchObject({
      photos: [],
      reviews: [],
    });

    expect(sanitizeSpotSummary({
      id: 'camel-spot',
      title: 'Camel spot',
      latitude: 32.75,
      longitude: -97.33,
      category: 'food',
      rating: 4.8,
      province: 'Texas',
      region: 'North Texas',
      state: 'Texas',
      postalCode: '76102',
    } as SpotSummary)).toMatchObject({
      rating: 4.8,
      province: 'Texas',
      region: 'North Texas',
      state: 'Texas',
      postalCode: '76102',
    });
  });
});
