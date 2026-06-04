describe('trusted HTML utilities', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns plain strings when Trusted Types are not available', async () => {
    const { installTrustedTypesDefaultPolicy, toTrustedHtml, toTrustedSanitizedHtml } = await import('@/utils/trustedHtml');

    expect(() => installTrustedTypesDefaultPolicy()).not.toThrow();
    expect(toTrustedHtml(null)).toBe('');
    expect(toTrustedHtml('<strong>scope</strong>')).toBe('&lt;strong&gt;scope&lt;/strong&gt;');
    expect(toTrustedSanitizedHtml('<strong>scope</strong>')).toBe('<strong>scope</strong>');
  });

  it('installs the default policy once and reuses the scope HTML policy', async () => {
    const policies = new Map<string, { createHTML: (input: string) => string }>();
    const trustedTypes = {
      createPolicy: vi.fn((name: string, policy: { createHTML: (input: string) => string }) => {
        if (policies.has(name)) {
          throw new Error('duplicate policy');
        }

        const createdPolicy = {
          createHTML: vi.fn((input: string) => `trusted:${policy.createHTML(input)}`),
        };
        policies.set(name, createdPolicy);
        return createdPolicy;
      }),
    };
    vi.stubGlobal('window', {
      ...window,
      trustedTypes,
    });

    const { installTrustedTypesDefaultPolicy, toTrustedHtml, toTrustedSanitizedHtml } = await import('@/utils/trustedHtml');

    installTrustedTypesDefaultPolicy();
    installTrustedTypesDefaultPolicy();

    expect(trustedTypes.createPolicy).toHaveBeenCalledTimes(1);
    expect(trustedTypes.createPolicy).toHaveBeenCalledWith('default', expect.objectContaining({
      createHTML: expect.any(Function),
    }));
    expect(trustedTypes.createPolicy.mock.calls[0]?.[1].createHTML('<scope-default>')).toBe('&lt;scope-default&gt;');

    expect(toTrustedHtml('<p>first</p>')).toBe('trusted:&lt;p&gt;first&lt;/p&gt;');
    expect(toTrustedSanitizedHtml('<p>second</p>')).toBe('trusted:<p>second</p>');
    expect(trustedTypes.createPolicy).toHaveBeenCalledTimes(2);
  });

  it('falls back to the original value when policy creation fails', async () => {
    vi.stubGlobal('window', {
      ...window,
      trustedTypes: {
        createPolicy: vi.fn(() => {
          throw new Error('policy blocked');
        }),
      },
    });

    const { installTrustedTypesDefaultPolicy, toTrustedHtml, toTrustedSanitizedHtml } = await import('@/utils/trustedHtml');

    expect(() => installTrustedTypesDefaultPolicy()).not.toThrow();
    expect(toTrustedHtml('<em>fallback</em>')).toBe('&lt;em&gt;fallback&lt;/em&gt;');
    expect(toTrustedSanitizedHtml('<em>fallback</em>')).toBe('<em>fallback</em>');
  });
});
