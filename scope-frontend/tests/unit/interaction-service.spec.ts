describe('interactionService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.doUnmock('@/services/api');
    vi.doUnmock('@/utils/qaMode');
  });

  async function loadInteractionService(options: {
    qaMode?: boolean;
    post?: ReturnType<typeof vi.fn>;
  } = {}) {
    const post = options.post ?? vi.fn().mockResolvedValue(undefined);

    vi.doMock('@/services/api', () => ({
      default: {
        post,
      },
    }));
    vi.doMock('@/utils/qaMode', () => ({
      isScopeQaMode: () => options.qaMode === true,
    }));

    const service = await import('@/services/interactionService');
    return {
      ...service,
      post,
    };
  }

  it('skips interaction wire calls in QA mode', async () => {
    const { flushInteractions, logInteraction, post } = await loadInteractionService({ qaMode: true });

    logInteraction({ spotId: 'spot-qa', type: 'view' });
    await flushInteractions();

    expect(post).not.toHaveBeenCalled();
  });

  it('flushes scheduled interactions with normalized payloads and beforeunload support', async () => {
    vi.useFakeTimers();
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const { logInteraction, post } = await loadInteractionService();

    logInteraction({
      spotId: 'spot-1',
      type: 'view',
    });

    expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    expect(post).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('beforeunload'));
    await vi.runOnlyPendingTimersAsync();

    expect(post).toHaveBeenCalledWith('/api/content/interactions/', {
      spotId: 'spot-1',
      interactionType: 'view',
      context: null,
    });
  });

  it('flushes immediately at the max batch size and swallows failed posts', async () => {
    vi.useFakeTimers();
    const post = vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValue(undefined);
    const { flushInteractions, logInteraction } = await loadInteractionService({ post });

    for (let index = 0; index < 25; index += 1) {
      logInteraction({
        spotId: `spot-${index}`,
        type: 'click',
        context: { index },
      });
    }

    await vi.waitFor(() => {
      expect(post).toHaveBeenCalledTimes(25);
    });
    await flushInteractions();

    expect(post).toHaveBeenNthCalledWith(2, '/api/content/interactions/', {
      spotId: 'spot-1',
      interactionType: 'click',
      context: { index: 1 },
    });
    expect(post).toHaveBeenCalledTimes(25);
  });
});
