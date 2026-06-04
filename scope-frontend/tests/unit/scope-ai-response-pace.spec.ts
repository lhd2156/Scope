import {
  getScopeAiResponseStartedAt,
  getScopeAiMinimumReplyMs,
  waitForScopeAiResponsePace,
} from '@/utils/scopeAiResponsePace';

describe('scopeAiResponsePace', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SCOPE_AI_MIN_REPLY_MS', '');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('keeps test runs instant unless a minimum is configured', () => {
    expect(getScopeAiMinimumReplyMs()).toBe(0);
  });

  it('honors a configured minimum reply delay', async () => {
    vi.stubEnv('VITE_SCOPE_AI_MIN_REPLY_MS', '2200');
    vi.useFakeTimers();
    vi.spyOn(performance, 'now').mockReturnValue(1_000);

    let resolved = false;
    const promise = waitForScopeAiResponsePace(getScopeAiResponseStartedAt()).then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(2_199);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(resolved).toBe(true);
  });

  it('clamps unsafe configured delays', () => {
    vi.stubEnv('VITE_SCOPE_AI_MIN_REPLY_MS', '999999');
    expect(getScopeAiMinimumReplyMs()).toBe(10_000);

    vi.stubEnv('VITE_SCOPE_AI_MIN_REPLY_MS', '-50');
    expect(getScopeAiMinimumReplyMs()).toBe(0);
  });

  it('ignores invalid delays and returns immediately when no wait remains', async () => {
    vi.stubEnv('VITE_SCOPE_AI_MIN_REPLY_MS', 'later');
    expect(getScopeAiMinimumReplyMs()).toBe(0);

    await expect(waitForScopeAiResponsePace(100, 0)).resolves.toBeUndefined();

    vi.spyOn(performance, 'now').mockReturnValue(250);
    await expect(waitForScopeAiResponsePace(100, 100)).resolves.toBeUndefined();
  });

  it('falls back to Date.now when the Performance API is unavailable', () => {
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(12_345);
    vi.stubGlobal('performance', undefined);

    expect(getScopeAiResponseStartedAt()).toBe(12_345);

    dateNowSpy.mockRestore();
  });
});
