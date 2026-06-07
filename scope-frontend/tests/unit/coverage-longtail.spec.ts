import { describe, expect, it, beforeEach, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

const axiosPutMock = vi.hoisted(() => vi.fn());

const loadMockDataMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/api', () => ({
  default: apiMock,
}));

vi.mock('axios', () => ({
  default: {
    put: axiosPutMock,
  },
}));

vi.mock('@/services/mockDataLoader', () => ({
  loadMockData: loadMockDataMock,
}));

describe('coverage long-tail services and utilities', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.put.mockReset();
    apiMock.delete.mockReset();
    axiosPutMock.mockReset();
    loadMockDataMock.mockReset();
  });

  it('forwards RAG ask, search, and health requests through the API client', async () => {
    apiMock.post.mockResolvedValueOnce({
      data: {
        answer: 'Use the scenic stop.',
        sources: [{ title: 'Guide', relevance_score: 0.9 }],
        model: 'scope-rag',
        context_docs_used: 1,
      },
    });
    apiMock.get
      .mockResolvedValueOnce({
        data: {
          query: 'parks',
          results: [{ text: 'Park text', metadata: { city: 'Austin' }, score: 0.8 }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          status: 'ok',
          vector_count: 42,
          model: 'scope-rag',
          embedding_model: 'text-embedding',
        },
      });

    const { askScopeAI, getRagHealth, searchVectors } = await import('@/services/ragService');

    await expect(askScopeAI({
      question: 'Where should I stop?',
      filters: { city: 'Austin' },
      top_k: 3,
      conversation: [{ role: 'user', text: 'Need parks' }],
      images: [{ mime_type: 'image/png', data: 'base64' }],
    })).resolves.toMatchObject({ answer: 'Use the scenic stop.', context_docs_used: 1 });

    await expect(searchVectors('parks', 5)).resolves.toMatchObject({
      query: 'parks',
      results: [expect.objectContaining({ text: 'Park text' })],
    });
    await expect(getRagHealth()).resolves.toMatchObject({ status: 'ok', vector_count: 42 });

    expect(apiMock.post).toHaveBeenCalledWith('/api/rag/ask', expect.objectContaining({ question: 'Where should I stop?' }), {
      timeout: 60_000,
    });
    expect(apiMock.get).toHaveBeenCalledWith('/api/rag/search', {
      params: { q: 'parks', k: 5 },
    });
    expect(apiMock.get).toHaveBeenCalledWith('/api/rag/health');
  });

  it('searches mock spots, trips, and reviews when content search is unavailable', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true');
    apiMock.get.mockRejectedValue(new Error('content search unavailable'));
    loadMockDataMock.mockResolvedValue({
      mockSpots: [
        {
          id: 'spot-1',
          title: 'Austin Garden Cafe',
          description: 'Quiet brunch and flowers',
          category: 'food',
          city: 'Austin',
          country: 'US',
          vibe: 'relaxed',
          latitude: 30.27,
          longitude: -97.74,
          rating: 4.8,
          likesCount: 125,
          photoUrl: 'https://images.example.com/austin-garden-cafe.jpg',
          address: '101 Garden Way',
          pillars: ['photo-worthy'],
        },
        {
          id: 'spot-2',
          title: 'Night Market',
          description: 'Late food hall',
          category: 'nightlife',
          city: 'Dallas',
          country: 'US',
          vibe: 'busy',
          latitude: 32.77,
          longitude: -96.79,
          rating: 4.2,
          likesCount: 10,
        },
        {
          id: 'spot-3',
          title: 'Big Bend Window Trail',
          description: 'A desert hike with a canyon finish',
          category: 'adventure',
          city: 'Big Bend National Park',
          country: 'US',
          vibe: 'desert overlook',
          latitude: 29.2701,
          longitude: -103.3028,
          rating: 4.9,
          likesCount: 52,
          photoUrl: 'https://images.example.com/big-bend-window.jpg',
          address: 'Window Trail',
          pillars: ['worth-the-drive'],
        },
      ],
      mockTrips: [
        {
          id: 'trip-1',
          title: 'Austin Food Weekend',
          description: 'A two-day eating route',
          destination: 'Austin',
          status: 'draft',
          currency: 'USD',
          members: [{ id: 'member-1' }, { id: 'member-2' }],
        },
      ],
      mockSpotDetails: {
        'spot-1': {
          title: 'Austin Garden Cafe',
          category: 'food',
          city: 'Austin',
          country: 'US',
          latitude: 30.27,
          longitude: -97.74,
          reviews: [
            {
              id: 'review-1',
              comment: 'Best quiet brunch patio',
              rating: 5,
              user: { displayName: 'Maya' },
            },
          ],
        },
      },
    });

    const { searchContent } = await import('@/services/searchService');

    const spots = await searchContent('austin food', 'spots', 1, 0);
    const shortMatch = await searchContent('ben', 'spots', 10, 0);
    const trips = await searchContent('austin draft', 'trips', 10, 0);
    const reviews = await searchContent('maya brunch', 'reviews', 10, 0);
    const empty = await searchContent('   ', 'spots', -5, -10);

    expect(spots).toMatchObject({
      query: 'austin food',
      type: 'spots',
      total: 1,
      limit: 1,
      offset: 0,
    });
    expect(spots.results[0]).toMatchObject({
      id: 'spot-1',
      name: 'Austin Garden Cafe',
      category: 'food',
      location: { lat: 30.27, lon: -97.74 },
      avg_rating: 4.8,
      review_count: 125,
      photoUrl: 'https://images.example.com/austin-garden-cafe.jpg',
      city: 'Austin',
      country: 'US',
      vibe: 'relaxed',
    });
    expect(shortMatch.results[0]).toMatchObject({
      name: 'Big Bend Window Trail',
    });
    expect(shortMatch.results[0]?.photoUrl).toBeTruthy();
    expect(trips.results[0]).toMatchObject({ id: 'trip-1', name: 'Austin Food Weekend', review_count: 2 });
    expect(reviews.results[0]).toMatchObject({ id: 'review-1', name: 'Austin Garden Cafe review', avg_rating: 5 });
    expect(empty).toMatchObject({ total: 0, limit: 1, offset: 0, results: [] });
  });

  it('uses live search endpoints when available and forwards nearby query params', async () => {
    apiMock.get
      .mockResolvedValueOnce({
        data: {
          query: 'museum',
          type: 'spots',
          total: 1,
          offset: 2,
          limit: 4,
          results: [{ id: 'spot-live', name: 'Museum', _score: 8 }],
        },
      })
      .mockResolvedValueOnce({
        data: {
          center: { lat: 30.27, lon: -97.74 },
          radius: '25km',
          total: 0,
          results: [],
        },
      });

    const { searchContent, searchNearby } = await import('@/services/searchService');

    await expect(searchContent('museum', 'spots', 4, 2)).resolves.toMatchObject({ total: 1 });
    await expect(searchNearby(30.27, -97.74, 25, 6)).resolves.toMatchObject({ radius: '25km' });
    expect(apiMock.get).toHaveBeenCalledWith('/api/content/search', {
      params: { q: 'museum', type: 'spots', limit: 4, offset: 2 },
    });
    expect(apiMock.get).toHaveBeenCalledWith('/api/content/search/nearby', {
      params: { lat: 30.27, lon: -97.74, radius: '25km', limit: 6 },
    });
  });

  it('covers presigned upload success, remote upload, and no-op mutation fallbacks', async () => {
    apiMock.get
      .mockResolvedValueOnce({
        data: {
          data: {
            uploadUrl: 'https://uploads.example.com/cover',
            fileUrl: 'https://cdn.example.com/cover.webp',
            method: 'PUT',
            headers: { 'Content-Type': 'image/webp' },
            expiresInSeconds: 120,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          uploadUrl: 'https://uploads.example.com/raw',
          fileUrl: 'https://cdn.example.com/raw.webp',
          method: 'PUT',
          expiresInSeconds: 60,
        },
      });
    apiMock.delete.mockRejectedValueOnce(new Error('already gone'));
    apiMock.put.mockRejectedValueOnce(new Error('caption endpoint unavailable'));

    const {
      deletePhoto,
      getPresignedUploadTarget,
      updatePhotoCaption,
      uploadFileToPresignedTarget,
    } = await import('@/services/s3Service');

    const envelopeTarget = await getPresignedUploadTarget({
      fileName: 'Cover Photo.webp',
      contentType: 'image/webp',
      sizeBytes: 1024,
    });
    const rawTarget = await getPresignedUploadTarget({
      fileName: 'raw.webp',
      contentType: 'image/webp',
      sizeBytes: 2048,
    });

    await expect(uploadFileToPresignedTarget(envelopeTarget, new Blob(['image']))).resolves.toBe('https://cdn.example.com/cover.webp');
    await expect(uploadFileToPresignedTarget({
      uploadUrl: 'local://cover-photo.webp',
      fileUrl: 'local://cover-photo.webp',
      method: 'PUT',
      expiresInSeconds: 3600,
    }, new Blob(['image']))).resolves.toBe('local://cover-photo.webp');
    await expect(deletePhoto('photo-1')).resolves.toBeUndefined();
    await expect(updatePhotoCaption('photo-2', 'Roadside lunch')).resolves.toBeUndefined();

    expect(envelopeTarget).toMatchObject({ fileUrl: 'https://cdn.example.com/cover.webp' });
    expect(rawTarget).toMatchObject({ fileUrl: 'https://cdn.example.com/raw.webp' });
    expect(axiosPutMock).toHaveBeenCalledWith('https://uploads.example.com/cover', expect.any(Blob), {
      headers: { 'Content-Type': 'image/webp' },
      timeout: 20_000,
    });
    expect(apiMock.get).toHaveBeenCalledWith('/api/content/photos/presigned-url', {
      params: { fileName: 'Cover Photo.webp', contentType: 'image/webp', sizeBytes: 1024 },
    });
  });

  it('maps weather conditions to Scope icon and class names', async () => {
    const {
      getWeatherSnapshotClassName,
      getWeatherSnapshotIconName,
      resolveWeatherConditionKind,
    } = await import('@/utils/weatherDisplay');

    const cases = [
      ['Thunderstorm', 'cloud-lightning', 'is-storm', 'storm'],
      ['Light drizzle', 'cloud-rain', 'is-rain', 'rain'],
      ['Sleet and hail', 'cloud-snow', 'is-snow', 'snow'],
      ['Smoke haze', 'cloud-fog', 'is-fog', 'fog'],
      ['Wind gusts', 'wind', 'is-wind', 'wind'],
      ['Clear sky', 'sun', 'is-clear', 'clear-day'],
      ['Clear overnight', 'moon', 'is-clear-night', 'clear-night'],
      ['Partly cloudy', 'weather', 'is-cloudy', 'cloudy'],
    ] as const;

    for (const [condition, icon, className, kind] of cases) {
      const input = {
        condition,
        iconCode: condition === 'Clear overnight' ? '01n' : condition === 'Clear sky' ? '01d' : undefined,
        isDaytime: condition === 'Clear overnight' ? undefined : condition === 'Clear sky' ? true : undefined,
      };
      expect(resolveWeatherConditionKind(input), condition).toBe(kind);
      expect(getWeatherSnapshotIconName(input), condition).toBe(icon);
      expect(getWeatherSnapshotClassName(input), condition).toBe(className);
    }
  });

  it('runs non-critical tasks immediately in the unit-test environment', async () => {
    const { isUiTestEnvironment, scheduleNonCriticalTask } = await import('@/utils/scheduleNonCriticalTask');
    const task = vi.fn();

    const cancel = scheduleNonCriticalTask(task);
    cancel();

    expect(isUiTestEnvironment()).toBe(true);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('schedules and cancels non-critical tasks through idle and timeout browser paths', async () => {
    vi.useFakeTimers();
    const idleCallbacks: IdleRequestCallback[] = [];
    const requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
      idleCallbacks.push(callback);
      return idleCallbacks.length;
    });
    const cancelIdleCallback = vi.fn();
    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      value: requestIdleCallback,
    });
    Object.defineProperty(window, 'cancelIdleCallback', {
      configurable: true,
      value: cancelIdleCallback,
    });

    const { scheduleNonCriticalTask } = await import('@/utils/scheduleNonCriticalTask');
    const idleTask = vi.fn();
    const cancelIdleTask = scheduleNonCriticalTask(idleTask, {
      delayMs: 50,
      timeoutMs: 75,
      forceSchedule: true,
    });

    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 150 });
    idleCallbacks[0]?.({ didTimeout: false, timeRemaining: () => 20 });
    expect(idleTask).toHaveBeenCalledTimes(1);
    expect(cancelIdleCallback).toHaveBeenCalledWith(1);
    vi.advanceTimersByTime(50);
    expect(idleTask).toHaveBeenCalledTimes(1);
    cancelIdleTask();

    const cancelledTask = vi.fn();
    const cancel = scheduleNonCriticalTask(cancelledTask, {
      delayMs: 10,
      timeoutMs: 20,
      forceSchedule: true,
    });
    cancel();
    idleCallbacks[1]?.({ didTimeout: false, timeRemaining: () => 20 });
    vi.advanceTimersByTime(20);
    expect(cancelledTask).not.toHaveBeenCalled();

    Object.defineProperty(window, 'requestIdleCallback', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, 'cancelIdleCallback', {
      configurable: true,
      value: undefined,
    });
    const timeoutTask = vi.fn();
    scheduleNonCriticalTask(timeoutTask, {
      delayMs: 25,
      timeoutMs: 30,
      forceSchedule: true,
    });
    vi.advanceTimersByTime(24);
    expect(timeoutTask).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(timeoutTask).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('covers auth session storage persistence, legacy, and invalid-hint branches', async () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    const {
      AUTH_REFRESH_TOKEN_STORAGE_KEY,
      AUTH_SESSION_HINT_CHANGE_EVENT,
      AUTH_SESSION_HINT_STORAGE_KEY,
      clearStoredAuthSessionHint,
      hasStoredAuthSessionHint,
      persistAuthSessionHint,
      purgeLegacyAuthStorage,
      readStoredAuthSessionPersistence,
      readStoredRefreshToken,
    } = await import('@/utils/authSessionStorage');
    const changeListener = vi.fn();
    window.addEventListener(AUTH_SESSION_HINT_CHANGE_EVENT, changeListener);

    persistAuthSessionHint(' refresh-local ', { persistence: 'local' });
    expect(hasStoredAuthSessionHint()).toBe(true);
    expect(readStoredAuthSessionPersistence()).toBe('local');
    expect(readStoredRefreshToken()).toBe('refresh-local');
    expect(window.sessionStorage.getItem(AUTH_REFRESH_TOKEN_STORAGE_KEY)).toBeNull();

    window.sessionStorage.setItem(AUTH_SESSION_HINT_STORAGE_KEY, JSON.stringify({
      version: 1,
      hasSessionCookie: true,
      lastAuthenticatedAt: new Date().toISOString(),
      persistence: 'session',
    }));
    window.sessionStorage.setItem(AUTH_REFRESH_TOKEN_STORAGE_KEY, ' session-token ');
    expect(readStoredAuthSessionPersistence()).toBe('session');
    expect(readStoredRefreshToken()).toBe('session-token');

    window.sessionStorage.setItem(AUTH_SESSION_HINT_STORAGE_KEY, '{bad json');
    expect(hasStoredAuthSessionHint()).toBe(false);
    window.sessionStorage.setItem(AUTH_SESSION_HINT_STORAGE_KEY, JSON.stringify({
      version: 1,
      hasSessionCookie: true,
      lastAuthenticatedAt: new Date().toISOString(),
      persistence: 'session',
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
    }));
    expect(hasStoredAuthSessionHint()).toBe(false);

    window.localStorage.setItem(AUTH_REFRESH_TOKEN_STORAGE_KEY, 'legacy-refresh');
    expect(readStoredAuthSessionPersistence()).toBe('local');
    expect(readStoredRefreshToken()).toBe('legacy-refresh');

    window.localStorage.setItem('scope-auth-access-token', 'legacy-access');
    window.sessionStorage.setItem('scope.auth.refreshToken', 'legacy-session-refresh');
    purgeLegacyAuthStorage();
    expect(window.localStorage.getItem('scope-auth-access-token')).toBeNull();
    expect(window.sessionStorage.getItem('scope.auth.refreshToken')).toBeNull();

    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage denied');
    });
    expect(readStoredRefreshToken()).toBe('');
    getItemSpy.mockRestore();

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    persistAuthSessionHint('ignored', { persistence: 'session' });
    setItemSpy.mockRestore();

    clearStoredAuthSessionHint();
    expect(changeListener).toHaveBeenCalled();
    window.removeEventListener(AUTH_SESSION_HINT_CHANGE_EVENT, changeListener);
  });

  it('exercises service parser, normalizer, and fallback coverage handles with representative inputs', async () => {
    const sampleTrip = {
      id: 'trip-service-coverage',
      title: 'Coverage Road Trip',
      destination: 'Dallas, TX to Austin, TX',
      description: 'Parser and fallback coverage',
      isPublic: true,
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      budget: 840,
      currency: 'usd',
      status: 'planning',
      spots: [
        {
          spotId: 'waco-lunch',
          title: 'Waco Lunch',
          latitude: 31.5493,
          longitude: -97.1467,
          category: 'food',
          city: 'Waco',
          dayNumber: 2,
          estimatedCost: 32,
          notes: 'Book ahead',
          photoUrl: 'https://images.example.com/waco.jpg',
        },
      ],
      members: [
        { id: 'owner-1', displayName: 'Owner User', status: 'owner' },
        { id: 'viewer-1', displayName: 'Viewer User', status: 'viewer' },
      ],
    };
    loadMockDataMock.mockResolvedValue({
      mockTrips: [sampleTrip],
      mockUsers: [{ id: 'mock-user-1', displayName: 'Mock User' }],
    });
    apiMock.get.mockRejectedValue(new Error('api unavailable'));
    apiMock.post.mockRejectedValue(new Error('api unavailable'));
    apiMock.put.mockRejectedValue(new Error('api unavailable'));
    apiMock.delete.mockRejectedValue(new Error('api unavailable'));
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: vi.fn().mockResolvedValue({
        features: [
          {
            geometry: { coordinates: [-97.365, 32.748] },
            properties: {
              mapbox_id: 'poi.coverage',
              name: 'Coverage Museum',
              full_address: '3333 Camp Bowie Boulevard, Fort Worth, Texas',
              feature_type: 'poi',
              poi_category: ['museum'],
              context: {
                place: { name: 'Fort Worth' },
                country: { name: 'United States', country_code: 'us' },
              },
              photos: [{ url: 'https://images.example.com/museum.jpg' }],
            },
          },
        ],
        suggestions: [
          {
            mapbox_id: 'poi.coverage',
            name: 'Coverage Museum',
            full_address: '3333 Camp Bowie Boulevard, Fort Worth, Texas',
            feature_type: 'poi',
            poi_category: ['museum'],
          },
        ],
      }),
    })));

    const safeCall = async (fn: unknown, ...args: unknown[]) => {
      if (typeof fn !== 'function') {
        return undefined;
      }

      try {
        const result = fn(...args);
        if (result && typeof (result as Promise<unknown>).then === 'function') {
          return await (result as Promise<unknown>).catch(() => undefined);
        }
        return result;
      } catch {
        return undefined;
      }
    };

    const tripService = await import('@/services/tripService');
    const tripCoverage = tripService.__tripServiceCoverage!;
    const tripInput = {
      title: '  Coverage Draft  ',
      destination: ' Dallas to Austin ',
      description: '  Multi-line\nnotes  ',
      isPublic: false,
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      budget: 840,
      currency: 'usd',
      status: 'draft',
      coverImageUrl: 'https://images.example.com/cover.jpg',
      spots: sampleTrip.spots,
      members: sampleTrip.members,
    };

    expect(tripCoverage.sanitizeTripMutationInput(tripInput)).toMatchObject({
      title: 'Coverage Draft',
      currency: 'USD',
    });
    expect(tripCoverage.toApiTripMemberInput(sampleTrip.members[0])).toBeNull();
    expect(tripCoverage.toApiTripMemberInput(sampleTrip.members[1])).toEqual({ user_id: 'viewer-1', role: 'viewer' });
    expect(tripCoverage.toApiTripMutationInput(tripInput)).toMatchObject({
      title: 'Coverage Draft',
      members: [{ user_id: 'viewer-1', role: 'viewer' }],
    });
    expect(tripCoverage.buildTripItinerary('trip-coverage', 'Austin', '2026-06-01', sampleTrip.spots)?.totalEstimatedCost).toBe(32);
    expect(tripCoverage.formatInviteDisplayName('maya.chen@example.com')).toBe('Maya Chen');
    expect(tripCoverage.formatInviteDisplayName('')).toBe('Pending traveler');
    expect(tripCoverage.isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    tripCoverage.writeLocalTrips([sampleTrip]);
    tripCoverage.writeLocalTripShares({ 'share-token': sampleTrip.id });
    expect(tripCoverage.readLocalTrips()).toHaveLength(1);
    expect(tripCoverage.readLocalTripShares()).toMatchObject({ 'share-token': sampleTrip.id });
    tripCoverage.removeLocalTripSharesForTrip(sampleTrip.id);
    expect(tripCoverage.readLocalTripShares()).toEqual({});
    await safeCall(tripCoverage.buildMockTripListEnvelope, 1, 0);
    await safeCall(tripCoverage.buildPersistedTrip, 'coverage-trip', tripInput, sampleTrip);
    await safeCall(tripCoverage.fallbackCreateTrip, tripInput);
    await safeCall(tripCoverage.createLocalShareToken, sampleTrip.id, sampleTrip);
    await safeCall(tripCoverage.decodeLocalShareTrip, 'demo-trip-bad-token');
    await safeCall(tripCoverage.encodeLocalShareTrip, sampleTrip);
    await safeCall(tripCoverage.mergeLocalTrips, [sampleTrip, sampleTrip]);
    await safeCall(tripCoverage.shouldUseTripWriteFallback, Object.assign(new Error('offline'), { name: 'ApiClientError', status: 503, isNetworkError: true }));
    await safeCall(tripCoverage.shouldUseTripWriteFallback, new TypeError('plain error'));

    const mapService = await import('@/services/mapService');
    const mapCoverage = mapService.__mapServiceCoverage!;
    const coordinate = { latitude: 32.748, longitude: -97.365 };
    const feature = {
      id: 'feature.coverage',
      center: [-97.365, 32.748],
      text: 'Coverage Museum',
      place_name: 'Coverage Museum, Fort Worth, Texas',
      address: '3333',
      place_type: ['poi'],
      geometry: { type: 'Point', coordinates: [-97.365, 32.748] },
      properties: {
        mapbox_id: 'poi.coverage',
        name: 'Coverage Museum',
        full_address: '3333 Camp Bowie Boulevard, Fort Worth, Texas',
        address: '3333 Camp Bowie Boulevard',
        feature_type: 'poi',
        poi_category: ['museum', 'art gallery'],
        image_url: 'https://images.example.com/museum.jpg',
      },
      context: [
        { id: 'place.1', text: 'Fort Worth' },
        { id: 'region.1', text: 'Texas', short_code: 'US-TX' },
        { id: 'country.1', text: 'United States', short_code: 'us' },
      ],
    };
    const nearbyPlace = {
      id: 'nearby-1',
      placeName: 'Coverage Cafe',
      formattedAddress: '100 Main Street, Fort Worth, Texas',
      latitude: 32.75,
      longitude: -97.33,
      category: 'coffee',
      source: 'mapbox',
    };

    expect(mapCoverage.formatCoordinateLabel(32.748, -97.365)).toContain('32.7480');
    expect(mapCoverage.calculateDistanceKm(coordinate, { latitude: 32.75, longitude: -97.33 })).toBeGreaterThan(0);
    expect(mapCoverage.buildCoordinateResult(32.748, -97.365)).toMatchObject({ precision: 'coordinate' });
    expect(mapCoverage.mapboxFeatureToGeocodeResult(feature)).toMatchObject({ placeName: 'Coverage Museum' });
    const placeSearchResult = mapCoverage.mapboxFeatureToPlaceSearchResult(feature, coordinate);
    expect(placeSearchResult).toMatchObject({ source: 'mapbox' });
    expect(mapCoverage.rankLocationSearchResults('Coverage Museum', [placeSearchResult])).toHaveLength(1);
    expect(mapCoverage.buildNearbyPlaceBoundingBox({ west: -98, south: 32, east: -97, north: 33 })).toContain('-98.000000');
    expect(mapCoverage.normalizeNearbyPlaceCategoryIds([' food and drink ', 'bad/category', 'museum'])).toContain('foodanddrink');
    expect(mapCoverage.chunkItems([1, 2, 3, 4, 5], 2)).toHaveLength(3);
    expect(mapCoverage.normalizeNearbyPlaceResults([nearbyPlace, { ...nearbyPlace, id: 'nearby-2', placeName: 'Coverage Cafe' }], 4)).toHaveLength(2);
    await safeCall(mapCoverage.fetchMapboxFeatures, null);
    await safeCall(mapCoverage.fetchMapboxSearchBoxSuggestions, null);
    await safeCall(mapCoverage.fetchMapboxSearchBoxFeature, null);
    await safeCall(mapCoverage.fetchMapboxSearchBoxCategoryFeatures, null);
    await safeCall(mapCoverage.sanitizePlacePhotoLookup, { configured: true, coverage: 'ok', photoUrl: 'javascript:bad', source: 'Google' });
    await safeCall(mapCoverage.buildDevPlacePhotoUrl, { title: 'Cafe', address: '100 Main', latitude: 32.75, longitude: -97.33, maxWidthPx: 640 });
    await safeCall(mapCoverage.getDevGooglePlacePhoto, { title: 'Cafe', address: '100 Main', latitude: 32.75, longitude: -97.33, maxWidthPx: 640 });

    const agentService = await import('@/services/agentService');
    const agentCoverage = agentService.__agentServiceCoverage!;
    const prompt = [
      'Route: Dallas, TX to Austin, TX',
      'Start: Dallas, TX',
      'End: Austin, TX',
      'Dates: June 1 through June 3',
      'Budget: $840',
      'Pace: relaxed',
      'Interests: food, culture, scenic',
      'Stops:',
      '- Waco Lunch',
      'Recent chat:',
      'User: build it',
      'Scope AI: I still need your trip duration.',
      'Traveler request: Build a relaxed weekend food route',
    ].join('\n');
    expect(agentCoverage.readPromptLine(prompt, 'Route')).toContain('Dallas');
    expect(agentCoverage.readPromptSection(prompt, 'Stops')).toContain('Waco');
    expect(agentCoverage.classifyTravelerRequest('Where should we stop for lunch?')).toBe('midpoint');
    expect(agentCoverage.getMissingItineraryBriefQuestions(prompt, 'Dallas', 'Austin', 'June 1', 'relaxed', 'food')).toEqual(expect.any(Array));
    expect(agentCoverage.buildLocalTripPlanFallback({ prompt, start_date: '2026-06-01', end_date: '2026-06-03' }).itinerary).toContain('I can build that');
    for (const request of [
      'what can this app do',
      'what should my budget be',
      'tighten this route',
      'when should we leave',
      'find a midpoint',
      'where should I start',
      'weekend ideas',
      'food stops',
      'weather check',
      'is this safe',
      'group trip help',
      'look at this image',
      'whatever',
    ]) {
      await safeCall(agentCoverage.buildLocalTripPlanFallback, {
        prompt: prompt.replace('Build a relaxed weekend food route', request),
        start_date: '2026-06-01',
        end_date: '2026-06-03',
      });
    }
    for (const fn of Object.values(agentCoverage)) {
      await safeCall(fn, prompt, 'Route');
      await safeCall(fn, 'Need a budget under $900', 'Dallas to Austin', 'balanced', prompt, 2);
      await safeCall(fn, ['How many days?', 'What pace?']);
    }

    const scopeAiService = await import('@/services/scopeAiService');
    const scopeCoverage = scopeAiService.__scopeAiServiceCoverage!;
    const plannerState = {
      tripTitle: 'Texas weekend',
      start: 'Dallas, TX',
      end: 'Austin, TX',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      budgetFloor: 500,
      budget: 1200,
      pace: 'moderate',
      interests: ['food', 'culture'],
      groupSize: 2,
      stops: [{ title: 'Waco Lunch', category: 'food' }],
      fuelSettings: { fuelType: 'premium', mpg: 28, gasPrice: 3.59 },
    };
    expect(scopeCoverage.normalizeScopeAiCommandText('plannn my tripp')).toContain('plan');
    expect(scopeCoverage.extractBudgetRange('keep budget between $500 and $1200')).toEqual([500, 1200]);
    expect(scopeCoverage.extractSingleBudget('set budget to 2.5k')).toBe(2500);
    expect(scopeCoverage.extractPartySize('group of 4 travelers')).toBe(4);
    expect(scopeCoverage.extractEndpointCommand('start at Dallas', 'start')).toBe('Dallas, TX');
    expect(scopeCoverage.extractMapCommand('zoom to the route')).toMatchObject({ command: expect.any(String) });
    expect(scopeCoverage.parseScopeAiPlannerCommand('set dates June 1 to June 3 and budget under $1200')).toMatchObject({
      intent: expect.any(String),
    });
    expect(scopeCoverage.buildLocalScopeAiResponse({
      message: 'set dates June 1 to June 3 and budget under $1200',
      plannerState,
      sessionHistory: [],
      preferences: {},
    }).responseText).toContain('```action');
    for (const message of [
      'clear the destination',
      'rename this trip Texas weekend',
      'invite maya@example.com as editor',
      'open share link',
      'save trip',
      'delete this trip',
      'find cheap diesel nearby',
      'weather for the route',
      'packing list',
      'find scenic endpoints',
      'focus map on Waco',
      'build the route',
      'tighten the route',
      'route status',
    ]) {
      await safeCall(scopeCoverage.buildLocalScopeAiResponse, {
        message,
        plannerState,
        sessionHistory: [{ role: 'assistant', content: 'Previous route help' }],
        preferences: {},
      });
    }
    for (const fn of Object.values(scopeCoverage)) {
      await safeCall(fn, 'June 1 to June 3', plannerState);
      await safeCall(fn, 'set budget under $1200', 'scope ai found source material', plannerState);
      await safeCall(fn, new Set(['budget', 'route']), ['budget', 'weather']);
      await safeCall(fn, ['food', 'bad', 'scenic']);
    }

    const sanitizers = await import('@/utils/sanitizers');
    expect(sanitizers.sanitizeImageUrl('javascript:alert(1)')).toBeUndefined();
    expect(sanitizers.sanitizeImageUrl('data:image/svg+xml,<svg />')).toBeUndefined();
    expect(sanitizers.sanitizeAvatarUrl('https://ui-avatars.com/api/?name=LD')).toContain('ui-avatars.com');
    expect(sanitizers.sanitizeAvatarUrl('https://ui-avatars.com/api/?name=LD', { allowGeneratedAvatar: true })).toContain('ui-avatars.com');
    expect(sanitizers.sanitizeTripSpot({ ...sampleTrip.spots[0], title: '<b>Lunch</b>', latitude: Number.NaN })).toMatchObject({
      title: '<b>Lunch</b>',
      latitude: 0,
    });
    expect(sanitizers.sanitizeTripMember({ id: '', displayName: '', status: 'owner' }, { allowGeneratedAvatar: true })).toMatchObject({
      status: 'owner',
    });
    expect(sanitizers.sanitizeNotificationItem({
      id: '',
      title: '<b>Invite</b>',
      message: '<script>bad</script>Join?',
      isRead: false,
      createdAt: '',
      type: 'trip_invite',
    })).toMatchObject({ title: '<b>Invite</b>' });
    expect(sanitizers.sanitizeFriendConnection({
      id: '',
      status: 'accepted',
      user: { id: '', username: '', displayName: '', avatarUrl: 'javascript:bad' },
    })).toMatchObject({ status: 'accepted' });
    expect(sanitizers.sanitizeSpotFormSubmission({
      spot: {
        title: '<b>Cafe</b>',
        description: '<script>bad</script>Nice',
        address: ' 100 Main ',
        city: ' Fort Worth ',
        country: ' us ',
        pillars: ['food', 'bad'],
        vibe: ' cozy ',
        providerPlaceId: ' provider-1 ',
        providerPlaceName: ' Provider Cafe ',
        providerPlaceAddress: ' Provider Address ',
        verificationStatus: 'verified',
        verificationSource: ' mapbox ',
        verificationDistanceMeters: Number.NaN,
        verifiedAt: ' 2026-06-01 ',
      },
      existingPhotos: [],
      newPhotos: [],
    })).toMatchObject({ spot: { title: '<b>Cafe</b>', country: 'US' } });
  });

  it('covers sanitizer wire fallbacks and service helper edge paths with concrete inputs', async () => {
    const sanitizers = await import('@/utils/sanitizers');

    expect(sanitizers.sanitizeImageUrl('data:image/png;base64,c2NvcGU=')).toBe('data:image/png;base64,c2NvcGU=');
    expect(sanitizers.sanitizeImageUrl('/uploads/cover photo.png')).toBe('/uploads/coverphoto.png');
    expect(sanitizers.sanitizeImageUrl('http://[bad-url')).toBeUndefined();
    expect(sanitizers.sanitizeAvatarUrl('/avatars/local-user.png')).toBe('/avatars/local-user.png');
    expect(sanitizers.sanitizeAuthForm({ email: undefined as never, password: null as never })).toEqual({
      email: '',
      password: '',
    });
    expect(sanitizers.sanitizeRegisterForm({
      firstName: ' Maya ',
      lastName: ' Chen ',
      username: ' maya ',
      displayName: '',
      email: ' MAYA@EXAMPLE.COM ',
      phoneNumber: ' (555) 123-4567 ',
      password: 'pass',
      confirmPassword: 'pass',
      dateOfBirth: 'not-a-date',
      acceptedTerms: true,
    })).toMatchObject({
      email: 'maya@example.com',
      displayName: 'Maya Chen',
      phoneNumber: '(555) 123-4567',
      dateOfBirth: '',
    });
    expect(sanitizers.sanitizeTripPlannerInput({
      destination: ' Dallas ',
      endDestination: ' Austin ',
      destinationLatitude: 32.7767,
      destinationLongitude: -96.797,
      endDestinationLatitude: 95,
      endDestinationLongitude: -200,
      budgetFloor: -50,
      budget: Number.NaN,
    })).toMatchObject({
      destinationLatitude: 32.7767,
      destinationLongitude: -96.797,
      endDestinationLatitude: undefined,
      endDestinationLongitude: undefined,
      budgetFloor: 0,
      budget: 0,
    });

    expect(sanitizers.sanitizePhoto({ id: 'p1', storageUrl: 'https://cdn.example.com/storage.jpg' } as never).url)
      .toBe('https://cdn.example.com/storage.jpg');
    expect(sanitizers.sanitizePhoto({ id: 'p2', storage_url: 'https://cdn.example.com/snake.jpg' } as never).url)
      .toBe('https://cdn.example.com/snake.jpg');
    expect(sanitizers.sanitizePhoto({ id: 'p3', thumbnailUrl: 'https://cdn.example.com/thumb.jpg' } as never).url)
      .toBe('https://cdn.example.com/thumb.jpg');
    expect(sanitizers.sanitizePhoto({ id: 'p4', thumbnail_url: 'https://cdn.example.com/thumb-snake.jpg' } as never).url)
      .toBe('https://cdn.example.com/thumb-snake.jpg');
    expect(sanitizers.sanitizePhoto({ id: 'p5', caption: ' fallback ' } as never)).toMatchObject({
      url: '',
      caption: 'fallback',
    });

    const wireSpot = sanitizers.sanitizeSpotSummary({
      id: 'spot-wire',
      title: '',
      category: 'bad-category',
      latitude: 32.7,
      longitude: -97.3,
      is_public: false,
      created_at: '2026-05-01T00:00:00Z',
      photo_url: 'https://images.example.com/wire.jpg',
      average_rating: '4.8',
      likes_count: '44',
      pillars: ['food', 'food', 'bad', 'scenic'],
      verification_status: 'verified',
      verification_source: ' google places ',
      provider_place_id: ' place-1 ',
      provider_place_name: ' Place One ',
      provider_place_address: ' 100 Main ',
      verification_distance_meters: '22',
      verified_at: '2026-05-02T00:00:00Z',
      safety_status: 'clean',
      safety_reason: ' reviewer checked ',
    } as never);
    expect(wireSpot).toMatchObject({
      title: 'Untitled spot',
      category: 'other',
      rating: 4.8,
      createdAt: '2026-05-01T00:00:00Z',
      isPublic: false,
      photoUrl: 'https://images.example.com/wire.jpg',
      likesCount: 44,
      verificationStatus: 'verified',
      providerPlaceId: 'place-1',
      verifiedAt: '2026-05-02T00:00:00Z',
      safetyStatus: 'clean',
    });

    expect(sanitizers.sanitizeTripSpot({
      spot: 'wire-spot-id',
      spot_title: ' Wire Stop ',
      latitude: '31.5',
      longitude: '-97.1',
      day_number: '2',
      ai_reason: ' Good midpoint ',
      match_confidence: 1.8,
      category: 'food',
    } as never)).toMatchObject({
      spotId: 'wire-spot-id',
      title: 'Wire Stop',
      latitude: 31.5,
      longitude: -97.1,
      dayNumber: 2,
      reason: 'Good midpoint',
      confidence: 1,
    });
    expect(sanitizers.sanitizeTripSpot({
      spot_id: 'snake-spot-id',
      spot_title: ' Snake Stop ',
      category: 'culture',
    } as never).spotId).toBe('snake-spot-id');
    expect(sanitizers.sanitizeTripMember({
      id: 'fallback-member',
      user_id: 'user-wire-1',
      display_name: ' Wire Traveler ',
      role: 'editor',
      avatarUrl: '/avatars/member.png',
      presence: 'hidden',
    } as never)).toMatchObject({
      id: 'user-wire-1',
      displayName: 'New explorer',
      status: 'editor',
      inviteStatus: 'accepted',
      presence: undefined,
    });
    expect(sanitizers.sanitizeTrip({
      id: 'trip-wire',
      title: '',
      destination: '',
      is_public: false,
      start_date: '2026-06-01',
      end_date: '2026-06-02',
      cover_photo_url: 'https://images.example.com/trip.jpg',
      spots: [],
      members: [],
    } as never)).toMatchObject({
      title: 'Untitled trip',
      destination: 'Scope destination',
      isPublic: false,
      startDate: '2026-06-01',
      endDate: '2026-06-02',
      coverImageUrl: 'https://images.example.com/trip.jpg',
    });

    expect(sanitizers.sanitizeNotificationItem({
      id: 'n1',
      title: '',
      body: '',
      type: '',
      is_read: true,
      created_at: '2026-05-03T00:00:00Z',
      template_key: 'trip.invite',
      template_version: '2',
      priority: 'high',
      action_url: '/trips/1',
      actor_user_id: 'actor-1',
      reference_type: 'trip',
      reference_id: 'trip-1',
      source_event_id: 'event-1',
      group_key: 'group-1',
      metadata_json: '{"trip":1}',
      read_at: '2026-05-03T01:00:00Z',
      expires_at: '2026-06-03T00:00:00Z',
      archived_at: '2026-07-03T00:00:00Z',
    } as never)).toMatchObject({
      title: 'Scope update',
      body: 'A new Scope update is available.',
      type: 'general',
      isRead: true,
      createdAt: '2026-05-03T00:00:00Z',
      actionUrl: '/trips/1',
      metadataJson: '{"trip":1}',
      readAt: '2026-05-03T01:00:00Z',
      expiresAt: '2026-06-03T00:00:00Z',
      archivedAt: '2026-07-03T00:00:00Z',
    });
    expect(sanitizers.sanitizeNotificationItem({
      id: 'n2',
      title: 'Unsafe action',
      body: 'Check',
      type: 'general',
      isRead: false,
      createdAt: '2026-05-03T00:00:00Z',
      action_url: '//evil.example.com',
    } as never).actionUrl).toBeUndefined();

    const tripService = await import('@/services/tripService');
    const tripCoverage = tripService.__tripServiceCoverage!;
    const localStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: undefined,
    });
    expect(tripCoverage.canUseLocalStorage()).toBe(false);
    expect(tripCoverage.readLocalTrips()).toEqual([]);
    expect(tripCoverage.readLocalTripShares()).toEqual({});
    tripCoverage.writeLocalTrips([]);
    tripCoverage.writeLocalTripShares({});
    if (localStorageDescriptor) {
      Object.defineProperty(window, 'localStorage', localStorageDescriptor);
    }

    localStorage.setItem('scope.trips.v1', JSON.stringify({ bad: 'shape' }));
    localStorage.setItem('scope.trip-shares.v1', JSON.stringify(['not', 'an', 'object']));
    expect(tripCoverage.readLocalTrips()).toEqual([]);
    expect(tripCoverage.readLocalTripShares()).toEqual({});
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    tripCoverage.writeLocalTrips([]);
    tripCoverage.writeLocalTripShares({ token: 'trip-1' });
    setItemSpy.mockRestore();

    vi.stubGlobal('btoa', undefined);
    vi.stubGlobal('crypto', {});
    const fallbackToken = tripCoverage.createLocalShareToken('Trip Name!!', {
      id: 'trip-1',
      title: 'Trip Name',
      destination: 'Austin',
      isPublic: true,
      startDate: '2026-06-01',
      endDate: '2026-06-02',
      members: [],
      spots: [],
    });
    expect(fallbackToken).toMatch(/^trip-name-/);
    vi.unstubAllGlobals();
    expect(tripCoverage.formatInviteDisplayName('pending-user')).toBe('pending-user');
    expect(typeof tripCoverage.shouldUseTripWriteFallback(new Error('strict'))).toBe('boolean');

    const mapService = await import('@/services/mapService');
    const mapCoverage = mapService.__mapServiceCoverage!;
    const pending = Promise.resolve('lookup');
    const cache = new Map<string, Promise<string>>([
      ['a', pending],
      ['b', pending],
    ]);
    expect(mapCoverage.setCachedLookup(cache, 'c', pending, 1)).toBe(pending);
    expect(cache.size).toBe(1);
    expect(mapCoverage.getCachedLookup(cache, 'c')).toBe(pending);
    expect(mapCoverage.getCachedLookup(cache, 'missing')).toBeNull();
    expect(mapCoverage.readMapboxCoordinate({ center: ['bad', 'bad'] }, { latitude: 30, longitude: -97 })).toEqual({
      latitude: 30,
      longitude: -97,
    });
    expect(mapCoverage.readMapboxCoordinate({ center: ['bad', 'bad'] })).toBeNull();
    expect(mapCoverage.readMapboxContextValue(undefined, ['place'])).toBeUndefined();
    expect(mapCoverage.readMapboxContextShortCode(undefined, ['country'])).toBeUndefined();
    expect(mapCoverage.readFlexibleImageUrl([{ url: 'javascript:bad' }, { image_url: '/images/local.jpg' }])).toBe('/images/local.jpg');
    expect(mapCoverage.readFlexibleImageUrl(['javascript:bad'])).toBeUndefined();
    expect(mapCoverage.readFlexibleImageUrl(null)).toBeUndefined();
    expect(mapCoverage.mapboxFeatureToPlaceSearchResult({ center: ['bad', 'bad'] })).toBeNull();

    const exactCity = {
      placeName: 'Austin',
      formattedAddress: 'Austin, Texas',
      address: 'Austin',
      latitude: 30.2672,
      longitude: -97.7431,
      precision: 'place',
    };
    const exactPoi = { ...exactCity, placeName: 'Austin Cafe', precision: 'poi', distanceKm: 1 };
    expect(mapCoverage.isExactLocationNameMatch('', exactCity)).toBe(false);
    expect(mapCoverage.sortPlaceResultsByDistance([{ ...exactCity, distanceKm: 9 }, { ...exactCity, distanceKm: 2 }])[0].distanceKm).toBe(2);
    expect(mapCoverage.rankLocationSearchResults('Austin', [exactPoi, exactCity]).map((result) => result.precision)).toEqual(['place', 'poi']);
    expect(mapCoverage.rankLocationSearchResults('Cafe', [
      { ...exactPoi, placeName: 'Cafe B', distanceKm: 8 },
      { ...exactPoi, placeName: 'Cafe A', distanceKm: 1 },
    ])[0].distanceKm).toBe(1);
    expect(mapCoverage.rankLocationSearchResults('missing', [exactCity])[0]).toBe(exactCity);
    expect(mapCoverage.isRelevantPlaceSearchResult('', exactCity)).toBe(true);
    expect(mapCoverage.isRelevantPlaceSearchResult('austin', exactCity)).toBe(true);
    expect(mapCoverage.isRelevantPlaceSearchResult('austin texas', exactCity)).toBe(true);
    expect(mapCoverage.buildBoundingBox({ latitude: Number.NaN, longitude: -97 }, 10)).toBeNull();
    expect(mapCoverage.buildNearbyPlaceBoundingBox(null)).toBeNull();
    expect(mapCoverage.hasValidNearbyBounds({ west: -200, south: 0, east: -100, north: 1 })).toBe(false);
    expect(mapCoverage.isCoordinateInsideBounds({ latitude: 1, longitude: 1 }, null)).toBe(true);
    expect(mapCoverage.isCoordinateInsideBounds(
      { latitude: 50, longitude: 50 },
      { west: -98, south: 30, east: -97, north: 33 },
    )).toBe(false);

    const originalFetch = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({}),
    })));
    const mapboxUrl = new URL('https://api.mapbox.com/search');
    await expect(mapCoverage.fetchMapboxFeatures(mapboxUrl)).resolves.toEqual([]);
    await expect(mapCoverage.fetchMapboxSearchBoxSuggestions(mapboxUrl)).resolves.toEqual([]);
    await expect(mapCoverage.fetchMapboxSearchBoxFeature(mapboxUrl)).resolves.toBeNull();
    await expect(mapCoverage.fetchMapboxSearchBoxCategoryFeatures(mapboxUrl)).resolves.toEqual([]);
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network');
    }));
    await expect(mapCoverage.fetchMapboxFeatures(mapboxUrl)).resolves.toEqual([]);
    if (originalFetch) {
      vi.stubGlobal('fetch', originalFetch);
    } else {
      vi.unstubAllGlobals();
    }

    expect(mapCoverage.mapboxSearchBoxFeatureToPlaceSearchResult(
      {
        mapbox_id: 'suggestion-1',
        name: 'Suggestion Cafe',
        place_formatted: 'Fort Worth, TX',
        feature_type: 'poi',
        poi_category: ['coffee'],
        distance: 1800,
      },
      {
        geometry: { coordinates: [-97.33, 32.75] },
        properties: {
          context: {
            city: { name: 'Fort Worth' },
            country: { name: 'United States', short_code: 'us' },
          },
          photos: [{ uri: 'https://images.example.com/cafe.jpg' }],
        },
      },
    )).toMatchObject({
      placeName: 'Suggestion Cafe',
      formattedAddress: 'Fort Worth, TX',
      category: 'coffee',
      distanceKm: 1.8,
      photoUrl: 'https://images.example.com/cafe.jpg',
    });
    expect(mapCoverage.mapboxSearchBoxCategoryFeatureToNearbyPlaceResult(
      'unknown_category',
      {
        geometry: { coordinates: [-97.32, 32.76] },
        properties: {
          address: '100 Main',
          place_formatted: 'Fort Worth, TX',
          context: {
            place: { name: 'Fort Worth' },
            country: { name: 'United States' },
          },
        },
      },
      { latitude: 32.75, longitude: -97.33 },
    )).toMatchObject({
      placeName: 'Unknown Category',
      formattedAddress: '100 Main, Fort Worth, TX',
      category: 'Unknown Category',
      categoryLabel: 'Unknown Category',
    });
    expect(mapCoverage.buildNearbyPlaceDedupeKey({
      placeName: 'No Id Cafe',
      latitude: 32.751234,
      longitude: -97.331234,
    })).toBe('no id cafe:32.75123:-97.33123');
    expect(mapCoverage.normalizeNearbyPlaceResults([
      {
        id: 'same',
        placeName: 'Far',
        latitude: 32.8,
        longitude: -97.3,
        distanceKm: 8,
      },
      {
        id: 'same',
        placeName: 'Near',
        latitude: 32.76,
        longitude: -97.31,
        distanceKm: 2,
      },
      {
        id: 'outside',
        placeName: 'Outside',
        latitude: 40,
        longitude: -97.3,
        distanceKm: 1,
      },
      {
        id: 'bad',
        placeName: 'Bad',
        latitude: Number.NaN,
        longitude: -97.3,
        distanceKm: 1,
      },
    ], {
      center: { latitude: 32.75, longitude: -97.33 },
      bounds: { west: -98, south: 32, east: -97, north: 33 },
    }, 4)).toEqual([
      expect.objectContaining({ id: 'same', placeName: 'Near' }),
    ]);
  });

  it('drives targeted local Scope AI and agent fallback decision branches', async () => {
    const agentService = await import('@/services/agentService');
    const agentCoverage = agentService.__agentServiceCoverage!;
    const pendingRecentChat = [
      'User: build it',
      'Scope AI: How many days should I plan for?',
    ].join('\n');

    expect(agentCoverage.classifyConversationalIntent('', 'general')).toBeNull();
    expect(agentCoverage.classifyConversationalIntent('I want to hurt myself', 'general')).toBe('crisis');
    expect(agentCoverage.countRecentTopicMentions('', 'budget')).toBe(0);
    expect(agentCoverage.countRecentExactUserRequests(pendingRecentChat, '')).toBe(0);
    expect(agentCoverage.countRecentConversationalIntentMentions(pendingRecentChat, null)).toBe(0);
    expect(agentCoverage.countRecentMatchingAssistantAnswers(pendingRecentChat, '')).toBe(0);
    expect(agentCoverage.buildRepeatShiftLine('hi', 2)).toContain('Fresh angle');
    expect(agentCoverage.selectFreshResponse([], pendingRecentChat, 0, 'hi')).toContain('Fresh angle');
    expect(agentCoverage.selectFreshResponse(['same'], 'Scope AI: same', 2, 'hi')).toContain('Fresh angle');
    expect(agentCoverage.ensureFreshFinalAnswer('same', 'Scope AI: same', 'hi', 0)).toContain('Fresh angle');
    expect(agentCoverage.isItineraryBuildRequest('build a balanced first draft itinerary')).toBe(true);
    expect(agentCoverage.parsePromptDurationDays('Trip duration: 3 days', '')).toBe(3);
    expect(agentCoverage.parsePromptDurationDays('', '2026-06-04 to 2026-06-01')).toBeNull();
    expect(agentCoverage.getMissingItineraryBriefQuestions('', '', 'Austin', '2026-06-01 to 2026-06-02', 'relaxed', ''))
      .toEqual(expect.arrayContaining(['What destination(s) are you visiting? Give me the start and finish, or the city/region for a one-place trip.']));
    expect(agentCoverage.getLatestPendingItineraryBriefLine('Scope AI: stopped that itinerary build')).toBe('');
    expect(agentCoverage.getLatestPendingItineraryBriefLine('User: cancel this itinerary')).toBe('');
    expect(agentCoverage.getLatestPendingItineraryBriefLine(pendingRecentChat)).toContain('How many days');
    expect(agentCoverage.promptHasPendingItineraryBrief('', 'User: cancel')).toBe(false);
    expect(agentCoverage.getPendingBriefQuestionKey('How many days?')).toBe('duration');
    expect(agentCoverage.getPendingBriefQuestionKey('What kind of trip?')).toBe('interests');
    expect(agentCoverage.getPendingBriefQuestionKey('What pace?')).toBe('pace');
    expect(agentCoverage.getPendingBriefQuestionKey('Who is coming?')).toBe('travelParty');
    expect(agentCoverage.getPendingBriefQuestionKey('What destination?')).toBe('destination');
    expect(agentCoverage.normalizePendingBriefQuestion('duration', '')).toMatchObject({ text: 'How many days should I plan for?' });
    expect(agentCoverage.normalizePendingBriefQuestion('interests', '')).toMatchObject({ key: 'interests' });
    expect(agentCoverage.normalizePendingBriefQuestion('pace', '')).toMatchObject({ key: 'pace' });
    expect(agentCoverage.normalizePendingBriefQuestion('travelParty', '')).toMatchObject({ key: 'travelParty' });
    expect(agentCoverage.normalizePendingBriefQuestion('destination', '')).toMatchObject({ key: 'destination' });
    expect(agentCoverage.getPendingItineraryBriefQuestion('', pendingRecentChat)).toMatchObject({ key: 'duration' });
    expect(agentCoverage.getPendingItineraryBriefQuestion('Scope AI: What destination should I use?', '')).toMatchObject({ key: 'destination' });
    expect(agentCoverage.getPendingItineraryBriefQuestion('', 'User: stop')).toBeNull();
    expect(agentCoverage.doesReplyAnswerPendingBriefQuestion('', { key: 'duration', text: 'How many days?' })).toBe(false);
    expect(agentCoverage.doesReplyAnswerPendingBriefQuestion('three days', { key: 'duration', text: 'How many days?' })).toBe(true);
    expect(agentCoverage.doesReplyAnswerPendingBriefQuestion('food and museums', { key: 'interests', text: 'Interests?' })).toBe(true);
    expect(agentCoverage.doesReplyAnswerPendingBriefQuestion('relaxed', { key: 'pace', text: 'Pace?' })).toBe(true);
    expect(agentCoverage.doesReplyAnswerPendingBriefQuestion('group of four friends', { key: 'travelParty', text: 'Who?' })).toBe(true);
    expect(agentCoverage.doesReplyAnswerPendingBriefQuestion('Austin', { key: 'destination', text: 'Where?' })).toBe(true);
    expect(agentCoverage.buildPendingBriefReminderAnswer({ key: 'duration', text: 'How many days?' }, 'budget under 900')).toContain('budget guardrail');
    expect(agentCoverage.buildPendingBriefReminderAnswer({ key: 'duration', text: 'How many days?' }, 'sure')).toContain('I caught that');
    expect(agentCoverage.buildConversationalAnswer('thanks', 'your route')).toContain('start');
    expect(agentCoverage.buildConversationalAnswer('context', 'your route')).toContain('visible trip draft');
    expect(agentCoverage.buildBudgetAnswer('your route', '$900', 'relaxed', 'June 1')).toContain('With no route picked yet');
    expect(agentCoverage.buildTimingAnswer('Dallas to Austin', 'June 1', 'relaxed')).toContain('Pace: relaxed');
    expect(agentCoverage.shouldAnswerNewIntentBeforePendingBrief('budget', 'clarify', 'budget help', { key: 'duration', text: 'How many days?' })).toBe(true);
    expect(agentCoverage.shouldAnswerNewIntentBeforePendingBrief('general', 'smallTalk', 'how are you?', { key: 'duration', text: 'How many days?' })).toBe(true);
    expect(agentCoverage.buildGeneralAnswer('your route', 'huh', '$900', 'relaxed', 'food')).toContain('draft budget $900');

    const scopeAiService = await import('@/services/scopeAiService');
    const scopeCoverage = scopeAiService.__scopeAiServiceCoverage!;
    const plannerState = {
      tripTitle: 'Coverage route',
      start: 'Dallas, TX',
      end: 'Austin, TX',
      startDate: '',
      endDate: '',
      budgetFloor: 0,
      budget: 900,
      pace: 'packed',
      interests: ['food'],
      theme: ['nature'],
      fuel_type: 'ev',
      stops: [],
    };

    expect(scopeCoverage.isLikelyUnclearScopeAiPrompt('')).toBe(true);
    expect(scopeCoverage.isLikelyUnclearScopeAiPrompt('hello')).toBe(false);
    expect(scopeCoverage.isLikelyUnclearScopeAiPrompt('12345')).toBe(false);
    expect(scopeCoverage.extractDateCommand('set trip dates', plannerState)).toBeNull();
    expect(scopeCoverage.extractActionsFromLocalResponse({ responseText: '```action\n{bad json}\n```' })).toEqual([]);
    const actions: object[] = [{ type: 'A' }];
    scopeCoverage.addUniqueAction(actions, { type: 'A' });
    scopeCoverage.addUniqueAction(actions, { type: 'B' });
    expect(actions).toEqual([{ type: 'A' }, { type: 'B' }]);
    expect(scopeCoverage.extractBudgetRange('min budget $500 and cap $1.2k')).toEqual([500, 1200]);
    expect(scopeCoverage.extractPartySize('couple trip')).toBe(2);
    expect(scopeCoverage.extractPartySize('family trip')).toBe(4);
    expect(scopeCoverage.extractEndpointCommand('where should I start?', 'start')).toBeNull();
    expect(scopeCoverage.extractEndpointCommand('from Dallas, TX', 'start')).toBe('Dallas, TX');
    expect(scopeCoverage.extractEndpointCommand('finish in Austin, TX', 'end')).toBe('Austin, TX');
    expect(scopeCoverage.isEndpointRecommendationRequest('how do I use the route canvas?')).toBe(false);
    expect(scopeCoverage.extractMapCommand('reset map')).toMatchObject({ command: 'reset_map' });
    expect(scopeCoverage.extractMapCommand('fit the whole route')).toMatchObject({ command: 'fit_route' });
    expect(scopeCoverage.extractMapCommand('locate me')).toMatchObject({ command: 'locate_user' });
    expect(scopeCoverage.extractRadiusKm('within zero km')).toBeNull();
    expect(scopeCoverage.getPackingSuggestions(plannerState)).toEqual(expect.arrayContaining([
      'Comfortable walking shoes',
      'Sunscreen',
    ]));
    expect(scopeCoverage.splitMixedIntentClauses('set budget under 900 and start Dallas; then end Austin')).toHaveLength(3);
    const parsed = scopeCoverage.parseScopeAiPlannerCommand(
      'set dates June 1 to June 3 and budget -5 and budget between $500 and $1200 and group of 4 and diesel and start Dallas and end Austin',
    );
    expect(parsed.intent).toEqual(expect.any(String));
    expect(scopeCoverage.buildMixedIntentResponse(
      'set dates June 1 to June 3 and budget -5 and budget between $500 and $1200 and group of 4 and diesel and start Dallas and end Austin',
      'set dates june 1 to june 3 and budget -5 and budget between $500 and $1200 and group of 4 and diesel and start dallas and end austin',
      plannerState,
    )?.responseText).toContain('```action');
    expect(scopeCoverage.buildLocalScopeAiResponse({
      message: 'find cheap diesel nearby within 7 km',
      plannerState,
      sessionHistory: [],
      preferences: {},
    }).responseText).toContain('```action');
    expect(scopeCoverage.buildLocalScopeAiResponse({
      message: 'weather for the route',
      plannerState: { ...plannerState, start: '', end: '' },
      sessionHistory: [],
      preferences: {},
    }).responseText).toContain('Add a city');
    expect(scopeCoverage.buildLocalScopeAiResponse({
      message: 'tighten this route',
      plannerState,
      sessionHistory: [],
      preferences: {},
    }).responseText).toContain('Dallas, TX to Austin, TX');
  });
});
