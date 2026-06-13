const apiMock = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));

const axiosPutMock = vi.hoisted(() => vi.fn());
const trackThemeToggleMock = vi.hoisted(() => vi.fn());

vi.mock('axios', () => ({
  default: {
    put: axiosPutMock,
  },
}));

vi.mock('@/services/api', () => ({
  default: apiMock,
}));

vi.mock('@/services/analyticsService', () => ({
  trackThemeToggle: trackThemeToggleMock,
}));

describe('Phase 5 service and utility edge coverage', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    window.localStorage.clear();
    apiMock.delete.mockReset();
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.put.mockReset();
    axiosPutMock.mockReset();
    trackThemeToggleMock.mockReset();
    document.head.innerHTML = '';
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-reduced-motion');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('enriches starter spot galleries through id, provider id, dedupe, and no-op paths', async () => {
    const { enrichStarterSpotGallery } = await import('@/utils/starterSpotGalleries');

    const knownSpot = {
      id: 'DEMO-SPOT-1',
      title: 'Stockyards Test',
      category: 'food',
      photoUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format',
      photos: [
        {
          id: 'existing',
          url: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?x=1',
          caption: 'Existing',
        },
      ],
    };

    const enriched = enrichStarterSpotGallery(knownSpot as never);
    expect(enriched.photos).toHaveLength(3);
    expect(enriched.photos.map((photo) => photo.caption)).toContain('Stockyards texture detail');

    const providerCase = enrichStarterSpotGallery({
      id: 'local-copy',
      providerPlaceId: 'SHOWCASE:90000000-0000-0000-0000-000000000002',
      title: 'Provider Gallery',
      category: 'scenic',
      photoUrl: 'invalid-url?cache=1',
      photos: undefined,
    } as never);
    expect(providerCase.photos).toHaveLength(2);
    expect(providerCase.photos[0]?.id).toBe('local-copy-starter-gallery-2');

    const snakeProviderCase = enrichStarterSpotGallery({
      id: 'wire-copy',
      provider_place_id: 'showcase:demo-spot-3',
      title: 'Wire Gallery',
      category: 'nature',
      photos: [],
    } as never);
    expect(snakeProviderCase.photos).toHaveLength(4);

    const singlePhotoPlan = { id: 'demo-spot-6', title: 'One Photo', category: 'food', photos: [] };
    expect(enrichStarterSpotGallery(singlePhotoPlan as never)).toBe(singlePhotoPlan);

    const unknownSpot = { id: 'unknown', title: 'Unknown', category: 'food', photos: [] };
    expect(enrichStarterSpotGallery(unknownSpot as never)).toBe(unknownSpot);

    const fallbackCategory = enrichStarterSpotGallery({
      id: 'demo-spot-1',
      title: 'Fallback Category Gallery',
      category: 'mystery',
      photoUrl: 'not-a-url?',
      photos: [{ id: 'existing', url: 'not-a-url?cache=1' }],
    } as never);
    expect(fallbackCategory.photos.map((photo: { caption?: string }) => photo.caption)).toContain('Stockyards texture detail');
  });

  it('normalizes image fallback, feed, trip cover, and travel media URLs', async () => {
    const imageFallbacks = await import('@/utils/imageFallbacks');
    const travelMedia = await import('@/utils/travelMedia');

    expect(imageFallbacks.buildPravatarUrl('')).toContain('https://i.pravatar.cc/150?img=');
    expect(imageFallbacks.resolveAvatarUrl('  https://cdn.example.com/avatar.png  ', 'seed')).toBe('https://cdn.example.com/avatar.png');
    expect(imageFallbacks.resolveAvatarUrl(null, 'seed')).toBe('');
    expect(imageFallbacks.getSpotPhotoFallback('missing' as never, 320)).toContain('w=320');
    expect(imageFallbacks.isSpotPhotoFallbackUrl('')).toBe(false);
    expect(imageFallbacks.isSpotPhotoFallbackUrl('https://images.unsplash.com/photo-1506929562872-bb421503ef21?x=1')).toBe(true);
    expect(imageFallbacks.isSpotPhotoFallbackUrl('photo-1506929562872-bb421503ef21')).toBe(true);
    expect(imageFallbacks.isSpotPhotoFallbackUrl('https://cdn.example.com/image.jpg')).toBe(false);
    expect(imageFallbacks.resolveSpotPhotoUrl('food', 'https://images.unsplash.com/photo-custom?w=10', 900)).toContain('w=900');
    expect(imageFallbacks.resolveSpotPhotoUrl('food', 'https://images.pexels.com/photos/1.jpeg', 700)).toContain('w=700');
    expect(imageFallbacks.resolveSpotPhotoUrl('food', 'not a url', 500)).toBe('not a url');
    expect(imageFallbacks.resolveTripCoverImageUrl({
      coverImageUrl: '',
      spots: [{ category: 'nightlife', photoUrl: 'https://images.pexels.com/photos/2.jpeg' }],
    } as never)).toContain('images.pexels.com');
    expect(imageFallbacks.resolveTripCoverImageUrl({ coverImageUrl: '', spots: [] } as never)).toContain('photo-1506929562872');
    expect(imageFallbacks.resolveTripStopPhotoUrl({ category: 'other', photoUrl: '' }, 300)).toContain('w=300');
    expect(imageFallbacks.resolveFeedImageUrl({ type: 'unknown', imageUrl: '' } as never, 310)).toContain('w=310');

    expect(travelMedia.pickTravelPhotoForSeed('unknown' as never, '')).toBe(travelMedia.CATEGORY_TRAVEL_PHOTO_POOL.other[0]);
    expect(travelMedia.pickTravelPhotoForSeed('food', 'taco-route')).toContain('images.unsplash.com');
    expect(travelMedia.buildPravatarAvatarUrl(999)).toBe('https://i.pravatar.cc/150?img=70');
    expect(travelMedia.buildPravatarAvatarUrl(Number.NaN)).toBe('https://i.pravatar.cc/150?img=1');
    expect(travelMedia.buildInitialsAvatarUrl('Louis Do')).toContain('name=Louis+Do');
    expect(travelMedia.getCategoryTravelPhoto('scenic')).toContain('photo-1506929562872');
  });

  it('uses resilient S3 upload fallbacks and live upload branches', async () => {
    const objectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:scope-upload');
    const { deletePhoto, getPresignedUploadTarget, updatePhotoCaption, uploadFileToPresignedTarget } = await import('@/services/s3Service');

    apiMock.get.mockRejectedValueOnce(new Error('content api offline'));
    await expect(getPresignedUploadTarget({
      fileName: 'My Photo.JPG',
      contentType: 'image/jpeg',
      sizeBytes: 12,
    })).resolves.toMatchObject({
      uploadUrl: 'blob:scope-upload',
      fileUrl: 'blob:scope-upload',
      method: 'PUT',
      expiresInSeconds: 3600,
    });

    apiMock.get.mockResolvedValueOnce({
      data: {
        data: {
          uploadUrl: 'https://upload.example.com/post',
          fileUrl: 'https://cdn.example.com/post.jpg',
          method: 'POST',
          headers: { 'x-upload': '1' },
          expiresInSeconds: 60,
        },
      },
    });
    await expect(getPresignedUploadTarget({
      fileName: 'post.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 20,
    })).resolves.toMatchObject({ method: 'POST', fileUrl: 'https://cdn.example.com/post.jpg' });

    apiMock.get.mockRejectedValueOnce(new Error('no url global'));
    const originalUrl = URL;
    vi.stubGlobal('URL', undefined);
    await expect(getPresignedUploadTarget({
      fileName: 'Offline Photo.PNG',
      contentType: 'image/png',
      sizeBytes: 1,
    })).resolves.toMatchObject({ uploadUrl: 'local://offline-photo.png' });
    vi.stubGlobal('URL', originalUrl);

    await expect(uploadFileToPresignedTarget({
      uploadUrl: 'local://offline-photo.png',
      fileUrl: 'local://offline-photo.png',
      method: 'PUT',
      expiresInSeconds: 3600,
    }, new Blob(['x']))).resolves.toBe('local://offline-photo.png');

    apiMock.post.mockResolvedValueOnce({ data: { data: { fileUrl: 'https://cdn.example.com/live-post.jpg' } } });
    await expect(uploadFileToPresignedTarget({
      uploadUrl: 'https://upload.example.com/post',
      fileUrl: 'https://cdn.example.com/post.jpg',
      method: 'POST',
      headers: { 'x-upload': '1' },
      expiresInSeconds: 60,
    }, new Blob(['x']))).resolves.toBe('https://cdn.example.com/live-post.jpg');
    expect(apiMock.post).toHaveBeenCalledWith(
      'https://upload.example.com/post',
      expect.any(FormData),
      expect.objectContaining({ timeout: 20_000 }),
    );

    axiosPutMock.mockResolvedValueOnce({});
    await expect(uploadFileToPresignedTarget({
      uploadUrl: 'https://upload.example.com/put',
      fileUrl: 'https://cdn.example.com/live-put.jpg',
      method: 'PUT',
      headers: { 'content-type': 'image/jpeg' },
      expiresInSeconds: 60,
    }, new Blob(['x']))).resolves.toBe('https://cdn.example.com/live-put.jpg');
    expect(axiosPutMock).toHaveBeenCalledWith('https://upload.example.com/put', expect.any(Blob), expect.objectContaining({ timeout: 20_000 }));

    apiMock.delete.mockRejectedValueOnce(new Error('already gone'));
    apiMock.put.mockRejectedValueOnce(new Error('caption offline'));
    await expect(deletePhoto('photo-1')).resolves.toBeUndefined();
    await expect(updatePhotoCaption('photo-1', 'New caption')).resolves.toBeUndefined();

    objectUrlSpy.mockRestore();
  });

  it('builds trip planner preset itineraries across default, match, and invalid date routes', async () => {
    const {
      buildTripPlannerPresetItinerary,
      getTripPlannerPreset,
      matchTripPlannerPreset,
    } = await import('@/services/tripPlannerPresets');

    expect(matchTripPlannerPreset(null)).toBeNull();
    expect(matchTripPlannerPreset('  ')).toBeNull();
    expect(matchTripPlannerPreset('Weekend in Cleveland')).toBeNull();

    const defaultPreset = getTripPlannerPreset();
    const matchedPreset = getTripPlannerPreset('Torres del Paine');
    expect(defaultPreset).not.toBe(matchedPreset);
    matchedPreset.stops[0]!.title = 'Mutated copy';
    expect(getTripPlannerPreset('Patagonia').stops[0]!.title).toBe('Mount Fitz Roy');

    expect(buildTripPlannerPresetItinerary({
      destination: 'Cleveland',
      endDestination: '',
      startDate: '2026-06-01',
      endDate: '2026-06-02',
      budgetFloor: 0,
      budget: 500,
      interests: [],
      pace: 'moderate',
      groupSize: 2,
    } as never)).toBeNull();

    const packed = buildTripPlannerPresetItinerary({
      destination: 'Patagonia',
      endDestination: 'Torres del Paine',
      startDate: '2026-06-01',
      endDate: '2026-06-01',
      budgetFloor: 0,
      budget: 5000,
      interests: ['adventure'],
      pace: 'packed',
      groupSize: 4,
    } as never);
    expect(packed?.destination).toBe('Patagonia to Torres del Paine');
    expect(packed?.days).toHaveLength(1);
    expect(packed?.days[0]?.spots.map((spot) => spot.timeSlot)).toEqual(['08:30', '12:30', '16:30']);

    const invalidDate = buildTripPlannerPresetItinerary({
      destination: 'fitz roy',
      endDestination: '',
      startDate: 'not-a-date',
      endDate: '2026-06-30',
      budgetFloor: 0,
      budget: 5000,
      interests: [],
      pace: 'relaxed',
      groupSize: 1,
    } as never);
    expect(invalidDate?.days[0]?.date).toBe('not-a-date');
  });

  it('keeps local mock spot authors and preset itinerary previews stable across update fallbacks', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_DEMO_MODE', 'false');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-11T15:00:00.000Z'));

    try {
      const {
        buildItineraryPreview,
        createMockSpot,
        getSpotById,
        mockUsers,
        updateMockSpot,
      } = await import('@/services/mockData');

      const submission = {
        spot: {
          title: '  Phase Five Author Guard  ',
          description: 'A local-only branch coverage spot for preserving existing authors.',
          latitude: 36.1627,
          longitude: -86.7816,
          address: '100 Test Ave',
          city: 'Nashville',
          country: 'United States',
          category: 'culture',
          pillars: ['local'],
          vibe: 'coverage guard',
          rating: 4.1,
          visitedAt: '2026-06-01',
          isPublic: true,
        },
        existingPhotos: [{
          id: 'phase5-existing',
          url: 'https://images.example.com/phase5-existing.jpg',
          caption: '',
        }],
        newPhotos: [],
      };

      const firstAuthor = mockUsers[0]!;
      const secondAuthor = mockUsers[1]!;
      const created = createMockSpot(submission as never, firstAuthor);
      const updated = updateMockSpot(created.id, {
        ...submission,
        spot: {
          ...submission.spot,
          title: 'Phase Five Author Guard Updated',
          category: 'food',
        },
      } as never, secondAuthor);

      expect(updated.author?.id).toBe(firstAuthor.id);
      expect(getSpotById(created.id)?.author?.id).toBe(firstAuthor.id);
      expect(updated.photos[0]?.caption).toBe('Phase Five Author Guard Updated');

      const presetPreview = buildItineraryPreview({
        destination: 'Patagonia',
        endDestination: 'Torres del Paine',
        startDate: '2026-11-02',
        endDate: '2026-11-04',
        budgetFloor: 1000,
        budget: 5000,
        interests: ['adventure', 'nature'],
        pace: 'moderate',
        groupSize: 3,
      } as never);

      expect(presetPreview.destination).toBe('Patagonia to Torres del Paine');
      expect(presetPreview.days.flatMap((day) => day.spots).map((spot) => spot.title)).toContain('Mount Fitz Roy');
    } finally {
      vi.useRealTimers();
    }
  });

  it('covers local trip persistence, share links, and generic preview itinerary fallbacks', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_ENABLE_TRIP_MOCK_FALLBACK', 'true');
    vi.stubEnv('VITE_ENABLE_TRIP_LOCAL_WRITE_FALLBACK', 'true');

    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: undefined,
    });

    try {
      const tripService = await import('@/services/tripService');
      const {
        buildItineraryPreview,
        getSpotById,
        getTripById,
        mockTrips,
        mockUsers,
      } = await import('@/services/mockData');
      const coverage = tripService.__tripServiceCoverage!;
      const sparseSpot = {
        spotId: 'sparse-stop',
        title: 'Sparse Stop',
        latitude: 32.7,
        longitude: -97.3,
        category: 'food',
        dayNumber: undefined,
        timeSlot: undefined,
        estimatedCost: undefined,
      };
      const existingTrip = mockTrips[0]!;
      const tripInput = {
        title: '  Phase 5 Local Trip  ',
        destination: 'Dallas',
        description: '',
        startDate: '2026-06-10',
        endDate: '2026-06-11',
        budget: undefined,
        isPublic: false,
        status: undefined,
        members: [],
        spots: [sparseSpot],
      };

      const localShareToken = coverage.createLocalShareToken(' !!! ', existingTrip);
      expect(localShareToken).toMatch(/^local-trip-/);
      expect(coverage.decodeLocalShareTrip('not-a-share-token')).toBeNull();
      expect(coverage.decodeLocalShareTrip(localShareToken)).toMatchObject({ id: existingTrip.id });
      expect(coverage.buildTripShareLink('local-token')).toMatchObject({
        path: '/trips/shared/local-token',
        url: expect.stringContaining('/trips/shared/local-token'),
      });

      const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: undefined,
      });
      expect(coverage.buildTripShareLink('server-token')).toMatchObject({
        url: '/trips/shared/server-token',
      });
      if (originalWindowDescriptor) {
        Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
      }

      window.localStorage.setItem('scope.trips.v1', JSON.stringify([existingTrip]));
      const localMerge = coverage.mergeLocalTrips([{ ...existingTrip, id: 'server-trip' }]);
      expect(localMerge.map((trip: { id: string }) => trip.id)).toEqual(expect.arrayContaining([existingTrip.id, 'server-trip']));
      coverage.writeLocalTripShares({ stale: existingTrip.id, keep: 'other-trip' });
      coverage.removeLocalTripSharesForTrip(existingTrip.id);
      expect(coverage.readLocalTripShares()).toEqual({ keep: 'other-trip' });

      const itinerary = coverage.buildTripItinerary('phase5-trip', 'Dallas', '2026-06-10', [
        sparseSpot,
        { ...sparseSpot, spotId: 'late-stop', title: 'Late Stop', dayNumber: 1, timeSlot: '18:00', estimatedCost: 0 },
      ]);
      expect(itinerary?.days[0]?.spots.map((spot: { title: string }) => spot.title)).toEqual(['Sparse Stop', 'Late Stop']);
      expect(itinerary?.totalEstimatedCost).toBe(0);

      const persisted = await coverage.buildPersistedTrip('phase5-local-trip', tripInput, {
        ...existingTrip,
        members: [{ id: '', displayName: '', status: 'owner' }],
        spots: [],
      });
      expect(persisted.members[0]).toMatchObject({
        id: '',
        displayName: 'New explorer',
      });
      expect(persisted.itinerary?.days[0]?.spots[0]?.timeSlot).toBe('09:00');
      const ownerFallbackTrip = await coverage.buildPersistedTrip('phase5-owner-fallback', {
        ...tripInput,
        members: undefined,
      });
      expect(ownerFallbackTrip.members[0]).toMatchObject({
        id: mockUsers[0]?.id ?? 'user-1',
        displayName: mockUsers[0]?.displayName ?? 'Scope traveler',
      });
      expect(coverage.formatInviteDisplayName('maya.reed@example.com')).toBe('Maya Reed');
      expect(await coverage.buildMockTripListEnvelope(1, 0, () => true)).toMatchObject({
        meta: expect.objectContaining({ pageSize: expect.any(Number) }),
      });

      const preview = buildItineraryPreview({
        destination: 'Cleveland',
        endDestination: 'Pittsburgh',
        startDate: '2026-07-01',
        endDate: '2026-07-01',
        budgetFloor: 0,
        budget: 400,
        interests: ['food'],
        pace: 'packed',
        groupSize: 3,
      } as never);
      expect(preview.destination).toBe('Cleveland to Pittsburgh');
      expect(preview.days[0]?.spots.map((spot) => spot.timeSlot)).toContain('19:00');
      expect(getSpotById('missing-spot-id')).toBeUndefined();
      expect(getTripById('missing-trip-id')).toBeUndefined();
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: originalCrypto,
      });
    }
  });

  it('guards content, theme, motion, PWA, and geolocation browser edges', async () => {
    const { validateContentSafety } = await import('@/utils/contentSafety');
    expect(validateContentSafety([{ field: 'title', value: '' }])).toEqual({ clean: true });
    expect(validateContentSafety([{ field: 'tags', value: ['friendly', 'sc0pe test blocked slur'] }])).toMatchObject({
      clean: false,
      field: 'tags',
    });

    vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
      throw new Error('storage denied');
    });
    const theme = await import('@/utils/theme');
    expect(theme.getStoredTheme()).toBe('dark');
    window.localStorage.setItem('scope-theme', 'light');
    expect(theme.initializeTheme()).toBe('light');
    theme.applyTheme('not-real' as never, { track: true, source: 'settings' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    theme.toggleTheme('settings');
    expect(trackThemeToggleMock).toHaveBeenCalledWith(expect.objectContaining({
      source: 'settings',
      routeName: 'settings',
    }));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('write denied');
    });
    expect(() => theme.applyTheme('light')).not.toThrow();

    const listeners: Array<(event: { matches: boolean }) => void> = [];
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn((_event, listener) => listeners.push(listener as never)),
    })));
    const motion = await import('@/utils/motion');
    expect(motion.initializeMotionPreference()).toBe(true);
    listeners[0]?.({ matches: false });
    expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('no-preference');

    const originalWindow = window;
    vi.stubGlobal('window', undefined);
    vi.resetModules();
    const motionNoWindow = await import('@/utils/motion');
    expect(motionNoWindow.initializeMotionPreference()).toBe(false);
    vi.stubGlobal('window', originalWindow);

    vi.stubEnv('VITE_DISABLE_SERVICE_WORKER', 'true');
    vi.resetModules();
    const pwaDisabled = await import('@/utils/pwa');
    await expect(pwaDisabled.registerAppServiceWorker({ isProduction: true, serviceWorkerContainer: {
      register: vi.fn(),
    } })).resolves.toBeNull();

    vi.stubEnv('VITE_DISABLE_SERVICE_WORKER', 'false');
    vi.resetModules();
    const registerMock = vi.fn().mockResolvedValue({ scope: '/' });
    Object.defineProperty(window, 'trustedTypes', {
      configurable: true,
      value: {
        createPolicy: vi.fn(() => ({ createScriptURL: (value: string) => ({ trusted: value }) })),
      },
    });
    const pwaTrusted = await import('@/utils/pwa');
    await expect(pwaTrusted.registerAppServiceWorker({ isProduction: true, serviceWorkerContainer: {
      register: registerMock,
    } })).resolves.toEqual({ scope: '/' });
    expect(registerMock).toHaveBeenCalledWith({ trusted: '/sw.js' }, { scope: '/', updateViaCache: 'none' });

    Object.defineProperty(window, 'trustedTypes', {
      configurable: true,
      value: {
        createPolicy: vi.fn(() => {
          throw new Error('policy blocked');
        }),
      },
    });
    vi.resetModules();
    const pwaFallback = await import('@/utils/pwa');
    await expect(pwaFallback.registerAppServiceWorker({ isProduction: true, serviceWorkerContainer: {
      register: vi.fn().mockRejectedValue(new Error('registration failed')),
    } })).resolves.toBeNull();

    const { getCurrentLocation, isGeolocationSupported, mapGeolocationPosition, startLocationWatch, stopLocationWatch } = await import('@/utils/geolocation');
    const originalNavigator = navigator;
    vi.stubGlobal('navigator', {});
    expect(isGeolocationSupported()).toBe(false);
    await expect(getCurrentLocation()).rejects.toThrow('Geolocation is not supported');
    expect(startLocationWatch(vi.fn(), vi.fn())).toBeNull();

    const watchPosition = vi.fn((success) => {
      success({
        coords: { latitude: 32, longitude: -97, accuracy: 5, heading: null, speed: null },
        timestamp: 123,
      });
      return 42;
    });
    const clearWatch = vi.fn();
    const getCurrentPosition = vi.fn((success) => success({
      coords: { latitude: 33, longitude: -98, accuracy: 4, heading: 90, speed: 12 },
      timestamp: 456,
    }));
    vi.stubGlobal('navigator', {
      geolocation: {
        watchPosition,
        clearWatch,
        getCurrentPosition,
      },
    });
    const onLocation = vi.fn();
    expect(startLocationWatch(onLocation, vi.fn())).toBe(42);
    expect(onLocation).toHaveBeenCalledWith(expect.objectContaining({ latitude: 32, longitude: -97 }));
    await expect(getCurrentLocation({ timeout: 1 })).resolves.toMatchObject({ latitude: 33, heading: 90 });
    stopLocationWatch(42);
    expect(clearWatch).toHaveBeenCalledWith(42);

    vi.stubGlobal('navigator', originalNavigator);
    expect(mapGeolocationPosition({
      coords: { latitude: 1, longitude: 2, accuracy: 3, heading: 4, speed: 5 },
      timestamp: 6,
    } as GeolocationPosition)).toEqual({
      latitude: 1,
      longitude: 2,
      accuracy: 3,
      heading: 4,
      speed: 5,
      timestamp: 6,
    });
  });
});
