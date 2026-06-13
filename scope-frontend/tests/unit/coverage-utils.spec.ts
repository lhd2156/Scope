import { createPinia, setActivePinia } from 'pinia';

const searchServiceMock = vi.hoisted(() => ({
  searchContent: vi.fn(),
  searchNearby: vi.fn(),
}));

vi.mock('@/services/searchService', () => ({
  searchContent: searchServiceMock.searchContent,
  searchNearby: searchServiceMock.searchNearby,
}));

describe('long-tail utility coverage', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete document.documentElement.dataset.scopeQa;
    delete (window as Window & { __SCOPE_VISUAL_QA__?: boolean }).__SCOPE_VISUAL_QA__;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    searchServiceMock.searchContent.mockReset();
    searchServiceMock.searchNearby.mockReset();
    setActivePinia(createPinia());
  });

  afterEach(() => {
    delete document.documentElement.dataset.scopeQa;
    delete (window as Window & { __SCOPE_VISUAL_QA__?: boolean }).__SCOPE_VISUAL_QA__;
  });

  it('moves focus through visible, enabled controls only', async () => {
    const { focusFirstElement, focusLastElement, getFocusableElements, moveFocus } = await import('@/utils/a11y');
    const container = document.createElement('div');
    container.innerHTML = `
      <button id="first">First</button>
      <button id="hidden" hidden>Hidden</button>
      <button id="disabled" aria-disabled="true">Disabled</button>
      <a id="second" href="/spots">Second</a>
    `;
    document.body.appendChild(container);

    const focusable = getFocusableElements(container);
    expect(focusable.map((element) => element.id)).toEqual(['first', 'second']);
    expect(focusFirstElement(container)).toBe(true);
    expect(document.activeElement?.id).toBe('first');
    expect(moveFocus(container, 1)).toBe(true);
    expect(document.activeElement?.id).toBe('second');
    expect(moveFocus(container, 1)).toBe(true);
    expect(document.activeElement?.id).toBe('first');
    expect(focusLastElement(container)).toBe(true);
    expect(document.activeElement?.id).toBe('second');
    expect(getFocusableElements(null)).toEqual([]);
    expect(focusFirstElement(null)).toBe(false);
    expect(focusLastElement(document.createElement('div'))).toBe(false);

    const originalWindow = window;
    vi.stubGlobal('window', undefined);
    expect(getFocusableElements(container).map((element) => element.id)).toEqual(['first', 'second']);
    vi.stubGlobal('window', originalWindow);
  });

  it('skips style-hidden controls and moves backward from outside the focus group', async () => {
    const { getFocusableElements, moveFocus } = await import('@/utils/a11y');
    const container = document.createElement('div');
    container.innerHTML = `
      <button id="visually-hidden" style="display: none">Hidden by style</button>
      <button id="visibility-hidden" style="visibility: hidden">Visibility hidden</button>
      <button id="negative-tabindex" tabindex="-1">Negative tabindex</button>
      <button id="first-visible">First visible</button>
      <button id="last-visible">Last visible</button>
    `;
    document.body.appendChild(container);
    document.body.focus();

    expect(getFocusableElements(container).map((element) => element.id)).toEqual([
      'first-visible',
      'last-visible',
    ]);
    expect(moveFocus(container, -1)).toBe(true);
    expect(document.activeElement?.id).toBe('last-visible');
    expect(moveFocus(document.createElement('div'), 1)).toBe(false);

    const originalDocument = document;
    vi.stubGlobal('document', undefined);
    expect(moveFocus(container, 1)).toBe(true);
    vi.stubGlobal('document', originalDocument);
  });

  it('reads QA sessions from URLs and keeps document state in sync', async () => {
    const { getScopeQaSession, isScopeQaMode, syncScopeQaDocumentState } = await import('@/utils/qaMode');

    expect(getScopeQaSession('https://scope.local/?scopeQaSession=guest')).toBe('guest');
    expect(getScopeQaSession('?scopeQaSession=authenticated')).toBe('authenticated');
    expect(getScopeQaSession('scopeQaSession=guest')).toBe('guest');
    expect(getScopeQaSession('?scopeQaSession=unknown')).toBeNull();
    expect(isScopeQaMode('?scopeQaSession=guest')).toBe(true);

    syncScopeQaDocumentState('?scopeQaSession=guest');
    expect(document.documentElement.dataset.scopeQa).toBe('true');
    syncScopeQaDocumentState('');
    expect(document.documentElement.dataset.scopeQa).toBeUndefined();

    vi.stubGlobal('__SCOPE_VISUAL_QA__', true);
    Object.defineProperty(window, '__SCOPE_VISUAL_QA__', { configurable: true, value: true });
    syncScopeQaDocumentState('');
    expect(document.documentElement.dataset.scopeQa).toBe('true');
  });

  it('keeps QA sessions available in test mode and no-ops without a document', async () => {
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VITE_ENABLE_AUTH_MOCK_FALLBACK', 'false');
    vi.stubEnv('VITE_DEMO_MODE', 'false');
    vi.resetModules();
    const { getScopeQaSession, syncScopeQaDocumentState } = await import('@/utils/qaMode');

    expect(getScopeQaSession('?scopeQaSession=guest')).toBe('guest');

    vi.stubEnv('VITE_DEMO_MODE', 'true');
    expect(getScopeQaSession('?scopeQaSession=authenticated')).toBe('authenticated');

    const originalDocument = document;
    vi.stubGlobal('document', undefined);
    expect(() => syncScopeQaDocumentState('?scopeQaSession=guest')).not.toThrow();
    vi.stubGlobal('document', originalDocument);
  });

  it('reads QA sessions from the current location and empty non-browser searches', async () => {
    vi.resetModules();
    const { getScopeQaSession } = await import('@/utils/qaMode');

    window.history.replaceState({}, '', '/map?scopeQaSession=guest');
    expect(getScopeQaSession()).toBe('guest');

    const originalWindow = window;
    vi.stubGlobal('window', undefined);
    expect(getScopeQaSession()).toBeNull();
    vi.stubGlobal('window', originalWindow);
  });

  it('reads map CSS tokens with browser and non-browser fallbacks', async () => {
    const { readCssToken, readMapColorToken } = await import('@/components/map/mapColorTokens');
    const computedStyleSpy = vi.spyOn(globalThis, 'getComputedStyle').mockReturnValue({
      getPropertyValue: vi.fn((token: string) => (token === '--scope-accent' ? '  #11aa99  ' : '')),
    } as unknown as CSSStyleDeclaration);

    expect(readCssToken('--scope-accent')).toBe('#11aa99');
    expect(readMapColorToken('--missing-token', '#123456')).toBe('#123456');

    const originalWindow = window;
    vi.stubGlobal('window', undefined);
    expect(readCssToken('--scope-accent')).toBe('');
    vi.stubGlobal('window', originalWindow);

    computedStyleSpy.mockRestore();
  });

  it('normalizes async errors for UI copy', async () => {
    const { ApiClientError } = await import('@/services/api');
    const { toAsyncErrorMessage } = await import('@/utils/errors');

    expect(toAsyncErrorMessage(new ApiClientError({ message: 'API says no' }), 'Fallback')).toBe('API says no');
    expect(toAsyncErrorMessage(new ApiClientError({ message: '' }), 'Fallback')).toBe('Fallback');
    expect(toAsyncErrorMessage(new Error('  Plain failure  '), 'Fallback')).toBe('Plain failure');
    expect(toAsyncErrorMessage(new Error('   '), 'Fallback')).toBe('Fallback');
    expect(toAsyncErrorMessage('bad', 'Fallback')).toBe('Fallback');
  });

  it('stores search and nearby results, errors, and clear state', async () => {
    const { useSearchStore } = await import('@/stores/search');
    const store = useSearchStore();

    await store.search('   ');
    expect(store.results).toBeNull();

    searchServiceMock.searchContent.mockResolvedValueOnce({
      query: 'tacos',
      type: 'spots',
      total: 1,
      results: [{ id: 'spot-1', name: 'Tacos' }],
    });
    await store.search(' tacos ', 'spots', 5, 2);
    expect(searchServiceMock.searchContent).toHaveBeenCalledWith('tacos', 'spots', 5, 2);
    expect(store.results?.total).toBe(1);
    expect(store.lastQuery).toBe('tacos');
    expect(store.loading).toBe(false);

    searchServiceMock.searchContent.mockRejectedValueOnce(new Error('search down'));
    await store.search('coffee');
    expect(store.error).toBe('search down');
    expect(store.results).toBeNull();

    searchServiceMock.searchContent.mockRejectedValueOnce('search down');
    await store.search('tea');
    expect(store.error).toBe('Search failed');
    expect(store.results).toBeNull();

    searchServiceMock.searchNearby.mockResolvedValueOnce({
      center: { lat: 32.75, lon: -97.33 },
      radius: '10km',
      total: 0,
      results: [],
    });
    await store.nearby(32.75, -97.33, 10, 4);
    expect(searchServiceMock.searchNearby).toHaveBeenCalledWith(32.75, -97.33, 10, 4);
    expect(store.geoResults?.radius).toBe('10km');

    searchServiceMock.searchNearby.mockRejectedValueOnce('nearby down');
    await store.nearby(32.75, -97.33);
    expect(store.error).toBe('Nearby search failed');
    expect(store.geoResults).toBeNull();

    searchServiceMock.searchNearby.mockRejectedValueOnce(new Error('nearby offline'));
    await store.nearby(32.75, -97.33);
    expect(store.error).toBe('nearby offline');
    expect(store.geoResults).toBeNull();

    store.clearResults();
    expect(store.results).toBeNull();
    expect(store.geoResults).toBeNull();
    expect(store.error).toBeNull();
    expect(store.lastQuery).toBe('');
  });

  it('unwraps service envelopes, normalizes arrays, and paginates local collections defensively', async () => {
    const {
      createPaginationMeta,
      normalizeArrayEnvelopeData,
      paginateItems,
      sortByCreatedAtDescending,
      unwrapApiData,
    } = await import('@/services/serviceUtils');

    expect(unwrapApiData({ data: { id: 'wrapped' }, meta: { total: 1 } })).toEqual({ id: 'wrapped' });
    expect(unwrapApiData({ id: 'raw' })).toEqual({ id: 'raw' });
    expect(normalizeArrayEnvelopeData({ data: ['a', 'b'] })).toEqual(['a', 'b']);
    expect(normalizeArrayEnvelopeData(['c'])).toEqual(['c']);
    expect(normalizeArrayEnvelopeData({ data: 'not-array' } as never)).toEqual([]);
    expect(normalizeArrayEnvelopeData(null)).toEqual([]);

    expect(createPaginationMeta(0, -2, 0)).toEqual({
      page: 1,
      pageSize: 1,
      total: 0,
      totalPages: 1,
    });
    expect(createPaginationMeta(5)).toEqual({
      page: 1,
      pageSize: 5,
      total: 5,
      totalPages: 1,
    });
    expect(createPaginationMeta(0)).toEqual({
      page: 1,
      pageSize: 1,
      total: 0,
      totalPages: 1,
    });
    expect(paginateItems(['a', 'b', 'c'], 2, 2)).toEqual({
      data: ['c'],
      meta: {
        page: 2,
        pageSize: 2,
        total: 3,
        totalPages: 2,
      },
    });
    expect(paginateItems(['a', 'b'])).toEqual({
      data: ['a', 'b'],
      meta: {
        page: 1,
        pageSize: 2,
        total: 2,
        totalPages: 1,
      },
    });
    expect(paginateItems([])).toEqual({
      data: [],
      meta: {
        page: 1,
        pageSize: 1,
        total: 0,
        totalPages: 1,
      },
    });
    expect(sortByCreatedAtDescending([
      { id: 'old', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'new', createdAt: '2026-02-01T00:00:00Z' },
    ]).map((item) => item.id)).toEqual(['new', 'old']);
  });

  it('covers default local mock data creation, filtering, and itinerary edge behavior', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_DEMO_MODE', 'false');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));

    try {
      const {
        buildItineraryPreview,
        createMockSpot,
        filterSpots,
        getSpotById,
        getTripById,
        mockSpots,
        mockUsers,
        updateMockSpot,
      } = await import('@/services/mockData');

      const baseSubmission = {
        spot: {
          title: '  Test dry route stop  ',
          description: '  Safe local fallback stop without uploaded media.  ',
          latitude: 32.7555,
          longitude: -97.3308,
          address: '  100 Main St  ',
          city: 'Fort Worth',
          country: 'United States',
          category: 'food',
          pillars: ['group-friendly'],
          vibe: 'quiet fallback',
          rating: 4.2,
          visitedAt: '2026-05-20',
          isPublic: true,
        },
        existingPhotos: [],
        newPhotos: [],
      };

      const created = createMockSpot(baseSubmission as never, null);
      expect(created).toMatchObject({
        title: 'Test dry route stop',
        author: undefined,
        photoUrl: expect.stringContaining('images.unsplash.com'),
        photos: [],
      });
      expect(getSpotById(created.id)?.reviews).toEqual([]);
      expect(getSpotById('missing-spot')).toBeUndefined();
      expect(getTripById('missing-trip')).toBeUndefined();

      const author = mockUsers[0]!;
      const updated = updateMockSpot(created.id, {
        ...baseSubmission,
        spot: {
          ...baseSubmission.spot,
          title: 'Updated fallback gallery',
          category: 'scenic',
          vibe: 'gallery fallback',
        },
        existingPhotos: [{
          id: 'existing-photo',
          url: 'https://images.example.com/existing.jpg',
          caption: '',
        }],
        newPhotos: [{
          id: 'upload-photo',
          file: new File(['image'], 'fallback.jpg', { type: 'image/jpeg' }),
          previewUrl: 'https://images.example.com/upload.jpg',
          caption: '   ',
          mimeType: 'image/jpeg',
          sizeBytes: 5,
        }],
      } as never, author);

      expect(updated).toMatchObject({
        id: created.id,
        title: 'Updated fallback gallery',
        author: expect.objectContaining({ id: author.id }),
      });
      expect(updated.photos.map((photo) => photo.caption)).toEqual([
        'Updated fallback gallery',
        'Updated fallback gallery',
      ]);
      expect(getSpotById(created.id)?.photoUrl).toBe('https://images.example.com/existing.jpg');

      expect(filterSpots({}).length).toBeGreaterThanOrEqual(mockSpots.length);
      expect(filterSpots({ category: '', city: 'not a real city', vibe: 'missing vibe' })).toEqual([]);

      const relaxedPreview = buildItineraryPreview({
        destination: 'Quartzsite, AZ',
        endDestination: '',
        startDate: '2026-06-10',
        endDate: '2026-06-11',
        budgetFloor: 0,
        budget: 600,
        interests: ['scenic'],
        pace: 'relaxed',
        groupSize: 1,
      } as never);
      expect(relaxedPreview.destination).toBe('Quartzsite, AZ');
      expect(relaxedPreview.days).toHaveLength(2);

      const packedPreview = buildItineraryPreview({
        destination: 'Quartzsite, AZ',
        endDestination: 'Tucson, AZ',
        startDate: '2026-06-10',
        endDate: '2026-06-10',
        budgetFloor: 0,
        budget: 1200,
        interests: ['food', 'nature'],
        pace: 'packed',
        groupSize: 6,
      } as never);
      expect(packedPreview.destination).toBe('Quartzsite, AZ to Tucson, AZ');
      expect(packedPreview.days.flatMap((day) => day.spots).map((spot) => spot.timeSlot)).toContain('20:00');

      const invalidDatePreview = buildItineraryPreview({
        destination: 'Nowhere',
        endDestination: '',
        startDate: 'not-a-date',
        endDate: 'also-not-a-date',
        budgetFloor: 0,
        budget: 200,
        interests: [],
        pace: 'moderate',
        groupSize: 2,
      } as never);
      expect(invalidDatePreview.days).toHaveLength(1);
      expect(invalidDatePreview.days[0]?.date).toBe('');
      expect(invalidDatePreview.totalEstimatedCost).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
