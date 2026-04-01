const analyticsServiceMock = vi.hoisted(() => ({
  setConsent: vi.fn(),
}));

vi.mock('@/services/analyticsService', () => ({
  analyticsService: analyticsServiceMock,
}));

describe('analytics consent utility', () => {
  beforeEach(() => {
    vi.resetModules();
    analyticsServiceMock.setConsent.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hydrates persisted consent and syncs it into the analytics service', async () => {
    localStorage.setItem('atlas-analytics-consent', 'granted');

    const { initializeAnalyticsConsent, useAnalyticsConsent } = await import('@/utils/analyticsConsent');

    expect(initializeAnalyticsConsent()).toBe('granted');
    expect(useAnalyticsConsent().consent.value).toBe('granted');
    expect(analyticsServiceMock.setConsent).toHaveBeenCalledWith('granted');
  });

  it('persists explicit consent choices and can reset back to unknown', async () => {
    const { resetAnalyticsConsent, setAnalyticsConsent, useAnalyticsConsent } = await import('@/utils/analyticsConsent');

    setAnalyticsConsent('denied');

    expect(useAnalyticsConsent().consent.value).toBe('denied');
    expect(localStorage.getItem('atlas-analytics-consent')).toBe('denied');
    expect(analyticsServiceMock.setConsent).toHaveBeenLastCalledWith('denied');

    resetAnalyticsConsent();

    expect(useAnalyticsConsent().consent.value).toBe('unknown');
    expect(localStorage.getItem('atlas-analytics-consent')).toBeNull();
    expect(analyticsServiceMock.setConsent).toHaveBeenLastCalledWith('unknown');
  });
});
