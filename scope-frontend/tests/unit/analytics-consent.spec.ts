const analyticsServiceMock = vi.hoisted(() => ({
  setConsent: vi.fn(),
}));

vi.mock('@/services/analyticsService', () => ({
  analyticsService: analyticsServiceMock,
}));

async function loadConsentModule() {
  vi.resetModules();
  return import('@/utils/analyticsConsent');
}

describe('analyticsConsent utility', () => {
  beforeEach(() => {
    localStorage.clear();
    analyticsServiceMock.setConsent.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializes once from stored consent and exposes readonly state helpers', async () => {
    const {
      ANALYTICS_CONSENT_STORAGE_KEY,
      initializeAnalyticsConsent,
      useAnalyticsConsent,
    } = await loadConsentModule();
    localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, 'granted');

    expect(initializeAnalyticsConsent()).toBe('granted');
    expect(initializeAnalyticsConsent()).toBe('granted');

    const consentState = useAnalyticsConsent();
    expect(consentState.consent.value).toBe('granted');
    expect(consentState.hasAnalyticsConsentChoice.value).toBe(true);
    expect(consentState.isAnalyticsConsentInitialized.value).toBe(true);
    expect(analyticsServiceMock.setConsent).toHaveBeenCalledWith('granted');
  });

  it('persists explicit choices and removes storage when consent is reset', async () => {
    const {
      ANALYTICS_CONSENT_STORAGE_KEY,
      readStoredAnalyticsConsent,
      resetAnalyticsConsent,
      setAnalyticsConsent,
    } = await loadConsentModule();

    expect(readStoredAnalyticsConsent()).toBe('unknown');
    localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, 'maybe');
    expect(readStoredAnalyticsConsent()).toBe('unknown');

    expect(setAnalyticsConsent('denied')).toBe('denied');
    expect(localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe('denied');
    expect(readStoredAnalyticsConsent()).toBe('denied');

    expect(setAnalyticsConsent('granted')).toBe('granted');
    expect(localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe('granted');

    expect(resetAnalyticsConsent()).toBe('unknown');
    expect(localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBeNull();
    expect(analyticsServiceMock.setConsent).toHaveBeenLastCalledWith('unknown');
  });

  it('returns unknown when browser storage is unavailable', async () => {
    const { initializeAnalyticsConsent, readStoredAnalyticsConsent, setAnalyticsConsent } = await loadConsentModule();
    const originalWindow = window;

    vi.stubGlobal('window', undefined);
    expect(readStoredAnalyticsConsent()).toBe('unknown');
    expect(initializeAnalyticsConsent()).toBe('unknown');
    expect(setAnalyticsConsent('granted')).toBe('granted');

    vi.stubGlobal('window', originalWindow);
  });
});
